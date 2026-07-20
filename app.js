var createError = require("http-errors");
var express = require("express");
var path = require("path");
var crypto = require("crypto");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var helmet = require("helmet");
var session = require("express-session");
var MongoStore = require("connect-mongo").default;

require("dotenv").config();

var indexRouter = require("./routes/index");
var mangaRouter = require("./routes/manga");
var authRouter = require("./routes/auth");
var { attachAuthLocals, getAdminCredentials } = require("./middleware/auth");
var { attachCsrfToken } = require("./middleware/csrf");
var { appLimiter } = require("./middleware/rateLimit");
var { deleteUploadedFile, UPLOAD_ROOT } = require("./middleware/uploads");

var app = express();
const mongoose = require("mongoose");
mongoose.set("strictQuery", false);

const isProduction = process.env.NODE_ENV === "production";
const mongoDB = isProduction
  ? process.env.PROD_MONGODB
  : process.env.DEV_MONGODB || process.env.PROD_MONGODB;
const sessionCookieName = "inventory.sid";

if (!mongoDB) {
  console.error("DEV_MONGODB or PROD_MONGODB must be set");
  process.exit(1);
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error(
    "SESSION_SECRET must be set to a strong value (at least 32 characters).\n" +
      'Run: node scripts/set-admin-password.js "your-strong-password"'
  );
  process.exit(1);
}

try {
  getAdminCredentials();
} catch (err) {
  console.error(err.message);
  console.error('Run: node scripts/set-admin-password.js "your-strong-password"');
  process.exit(1);
}

if (isProduction && process.env.TRUST_PROXY !== "1") {
  console.error(
    "TRUST_PROXY=1 is required in production because this app expects HTTPS " +
      "termination at one trusted reverse proxy"
  );
  process.exit(1);
}

if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

app.set("sessionCookieName", sessionCookieName);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "img-src": ["'self'", "data:", "https://media.kitsu.app", "https://media.kitsu.io"],
        "script-src": ["'self'"],
        "style-src": ["'self'"],
        "connect-src": ["'self'", "https://kitsu.io"],
        "form-action": ["'self'"],
        "object-src": ["'none'"],
        "upgrade-insecure-requests": isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(logger(isProduction ? "combined" : "dev"));
app.use(appLimiter);
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use(cookieParser());

app.use(
  session({
    name: sessionCookieName,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    unset: "destroy",
    store: MongoStore.create({
      mongoUrl: mongoDB,
      ttl: 60 * 60 * 8,
      autoRemove: "native",
      crypto: {
        secret: crypto
          .createHmac("sha256", process.env.SESSION_SECRET)
          .update("connect-mongo session encryption")
          .digest("hex"),
      },
    }),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      priority: "high",
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use(attachAuthLocals);
app.use(attachCsrfToken);

app.use(
  "/data/uploads",
  express.static(UPLOAD_ROOT, {
    dotfiles: "deny",
    index: false,
  })
);
app.use(express.static(path.join(__dirname, "public"), {
  dotfiles: "deny",
  index: false,
}));

app.get("/healthz", function healthCheck(req, res) {
  res.set("Cache-Control", "no-store");
  const healthy = mongoose.connection.readyState === 1;
  res.status(healthy ? 200 : 503).json({ status: healthy ? "ok" : "unavailable" });
});

app.use("/", indexRouter);
app.use("/", authRouter);
app.use("/manga", mangaRouter);

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(async function (err, req, res, next) {
  if (req.file) {
    try {
      await deleteUploadedFile(req.file.filename);
      req.file = undefined;
    } catch (cleanupErr) {
      console.error("Failed to clean up upload after request error", cleanupErr);
    }
  }

  const status = err.status || 500;
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  if (status === 403) {
    return res.status(403).render("errorPage", {
      error: "Request blocked (invalid or missing security token)",
    });
  }

  res.status(status);
  if (status === 404) {
    return res.render("errorPage", { error: "Page not found" });
  }
  if (status === 400) {
    return res.render("errorPage", { error: err.message });
  }
  console.error(err);
  res.render("error");
});

module.exports = app;

app.locals.databaseReady = mongoose.connect(mongoDB);
