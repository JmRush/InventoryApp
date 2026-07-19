const crypto = require("crypto");

const CSRF_FIELD = "_csrf";
const CSRF_SESSION_KEY = "csrfToken";

function createCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function ensureCsrfToken(req) {
  if (!req.session) {
    return null;
  }
  if (!req.session[CSRF_SESSION_KEY]) {
    req.session[CSRF_SESSION_KEY] = createCsrfToken();
  }
  return req.session[CSRF_SESSION_KEY];
}

function readSubmittedCsrfToken(req) {
  return (
    (req.body && req.body[CSRF_FIELD]) ||
    req.get("x-csrf-token") ||
    ""
  );
}

function tokensMatch(expected, provided) {
  if (typeof expected !== "string" || typeof provided !== "string") {
    return false;
  }
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length === 0 || expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Expose a per-session CSRF token to all views.
 */
function attachCsrfToken(req, res, next) {
  const token = ensureCsrfToken(req);
  res.locals.csrfToken = token;
  res.locals.csrfField = CSRF_FIELD;
  next();
}

/**
 * Validate CSRF for state-changing requests.
 * Must run after body parsers / multer so multipart forms can include _csrf.
 */
function verifyCsrf(req, res, next) {
  const expected = req.session && req.session[CSRF_SESSION_KEY];
  const provided = readSubmittedCsrfToken(req);

  if (!tokensMatch(expected, provided)) {
    const err = new Error("Invalid CSRF token");
    err.status = 403;
    return next(err);
  }

  // Rotate token after successful validation to limit replay window
  req.session[CSRF_SESSION_KEY] = createCsrfToken();
  res.locals.csrfToken = req.session[CSRF_SESSION_KEY];
  next();
}

module.exports = {
  CSRF_FIELD,
  attachCsrfToken,
  verifyCsrf,
  ensureCsrfToken,
};
