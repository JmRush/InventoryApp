const rateLimit = require("express-rate-limit");

const appLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests. Please try again later.",
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts. Please try again in 15 minutes.",
  handler: (req, res) => {
    res.status(429).render("login", {
      title: "Login",
      error: "Too many login attempts. Please try again in 15 minutes.",
      nextPath: "/manga",
      username: "",
    });
  },
});

module.exports = {
  appLimiter,
  loginLimiter,
};
