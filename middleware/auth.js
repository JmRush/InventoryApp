const bcrypt = require("bcrypt");
const crypto = require("crypto");

function currentAuthVersion() {
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || "";
  return crypto.createHash("sha256").update(passwordHash).digest("hex");
}

function isAuthenticated(req) {
  const user = req.session && req.session.user;
  if (!user || !user.username || !user.authVersion) {
    return false;
  }
  return safeEqualStrings(user.authVersion, currentAuthVersion());
}

function attachAuthLocals(req, res, next) {
  const authenticated = isAuthenticated(req);
  res.locals.isAuthenticated = authenticated;
  res.locals.currentUser = authenticated ? req.session.user.username : null;
  next();
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) {
    return next();
  }

  if (req.method === "GET") {
    const nextUrl = req.originalUrl || "/manga";
    return res.redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
  }

  return res.status(401).render("errorPage", {
    error: "You must be logged in to do that",
  });
}

function requireGuest(req, res, next) {
  if (isAuthenticated(req)) {
    return res.redirect("/manga");
  }
  return next();
}

function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!username || !passwordHash) {
    const err = new Error(
      "ADMIN_USERNAME and ADMIN_PASSWORD_HASH must be set in the environment"
    );
    err.code = "AUTH_CONFIG_MISSING";
    throw err;
  }

  return { username, passwordHash };
}

function safeEqualStrings(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    // Still do a compare to reduce obvious timing branches on length alone
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

async function verifyAdminCredentials(username, password) {
  const admin = getAdminCredentials();
  const usernameMatches = safeEqualStrings(username, admin.username);
  const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
  return usernameMatches && passwordMatches;
}

function loginUser(req, username) {
  return new Promise((resolve, reject) => {
    const previousCsrf = req.session.csrfToken;
    req.session.regenerate((err) => {
      if (err) {
        return reject(err);
      }
      req.session.user = {
        username,
        authVersion: currentAuthVersion(),
        loggedInAt: new Date().toISOString(),
      };
      // Keep a CSRF token available immediately after regenerate
      req.session.csrfToken = previousCsrf || crypto.randomBytes(32).toString("hex");
      req.session.save((saveErr) => {
        if (saveErr) {
          return reject(saveErr);
        }
        resolve();
      });
    });
  });
}

function logoutUser(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

function sanitizeNextPath(nextPath) {
  if (!nextPath || typeof nextPath !== "string") {
    return "/manga";
  }
  // Prevent open redirects: only allow relative same-origin paths
  if (
    !nextPath.startsWith("/") ||
    nextPath.startsWith("//") ||
    nextPath.includes("\\") ||
    nextPath.includes("://")
  ) {
    return "/manga";
  }
  try {
    const parsed = new URL(nextPath, "https://example.invalid");
    if (parsed.origin !== "https://example.invalid" || parsed.username || parsed.password) {
      return "/manga";
    }
    const sanitized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!sanitized.startsWith("/") || sanitized.startsWith("//")) {
      return "/manga";
    }
    // After URL normalization (which resolves ".."), only keep in-app destinations
    const { pathname } = parsed;
    if (pathname !== "/" && !pathname.startsWith("/manga") && !pathname.startsWith("/login")) {
      return "/manga";
    }
    return sanitized;
  } catch {
    return "/manga";
  }
}

module.exports = {
  isAuthenticated,
  attachAuthLocals,
  requireAuth,
  requireGuest,
  getAdminCredentials,
  verifyAdminCredentials,
  loginUser,
  logoutUser,
  sanitizeNextPath,
  currentAuthVersion,
};
