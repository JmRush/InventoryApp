const {
  verifyAdminCredentials,
  loginUser,
  logoutUser,
  sanitizeNextPath,
  requireGuest,
} = require("../middleware/auth");
const { verifyCsrf } = require("../middleware/csrf");
const { loginLimiter } = require("../middleware/rateLimit");

function getLogin(req, res) {
  res.render("login", {
    title: "Login",
    error: null,
    nextPath: sanitizeNextPath(req.query.next),
    username: "",
  });
}

async function postLogin(req, res, next) {
  try {
    const username = (req.body.username || "").trim();
    const password = req.body.password || "";
    const nextPath = sanitizeNextPath(req.body.next);

    if (!username || !password) {
      return res.status(400).render("login", {
        title: "Login",
        error: "Username and password are required",
        nextPath,
        username,
      });
    }

    const valid = await verifyAdminCredentials(username, password);
    if (!valid) {
      // Generic message to avoid user enumeration
      return res.status(401).render("login", {
        title: "Login",
        error: "Invalid username or password",
        nextPath,
        username,
      });
    }

    await loginUser(req, username);
    return res.redirect(nextPath);
  } catch (err) {
    return next(err);
  }
}

async function postLogout(req, res, next) {
  try {
    const cookieName = req.app.get("sessionCookieName") || "inventory.sid";
    await logoutUser(req);
    res.clearCookie(cookieName, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return res.redirect("/manga");
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getLogin: [requireGuest, getLogin],
  postLogin: [requireGuest, loginLimiter, verifyCsrf, postLogin],
  postLogout: [verifyCsrf, postLogout],
};
