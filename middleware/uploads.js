const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const DEFAULT_UPLOAD_ROOT = path.resolve(
  __dirname,
  "..",
  "public",
  "data",
  "uploads"
);
const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : DEFAULT_UPLOAD_ROOT;
const PUBLIC_UPLOAD_PREFIX = "data/uploads/";
const MAX_FILE_SIZE = 8_000_000;
const ALLOWED_UPLOADS = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
]);

fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

function uploadError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function checkDeclaredFileType(req, file, cb) {
  if (!file || typeof file.originalname !== "string" || typeof file.mimetype !== "string") {
    return cb(uploadError("Invalid upload metadata"));
  }
  const extension = path.extname(file.originalname).toLowerCase();
  const expectedMime = ALLOWED_UPLOADS.get(extension);
  if (!expectedMime || file.mimetype !== expectedMime) {
    return cb(uploadError("Only JPEG and PNG images are allowed"));
  }
  cb(null, true);
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOAD_ROOT);
  },
  filename(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 10,
    parts: 11,
  },
  fileFilter: checkDeclaredFileType,
});

function isJpeg(header) {
  return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
}

function isPng(header) {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return header.length >= 8 && header.subarray(0, 8).equals(pngSignature);
}

/**
 * Resolve a path that is guaranteed to be a direct child of UPLOAD_ROOT.
 * Only the basename is used so caller-controlled directory segments cannot escape.
 */
function resolveContainedUploadPath(candidate) {
  if (!candidate || typeof candidate !== "string") {
    return null;
  }
  const filename = path.basename(candidate);
  if (!filename || filename === "." || filename === "..") {
    return null;
  }
  const resolved = path.resolve(UPLOAD_ROOT, filename);
  if (path.dirname(resolved) !== UPLOAD_ROOT) {
    return null;
  }
  return resolved;
}

function requireContainedUploadPath(candidate) {
  const resolved = resolveContainedUploadPath(candidate);
  if (!resolved) {
    throw new Error("Refusing to access a file outside the upload directory");
  }
  return resolved;
}

async function deleteUploadedFile(filePath) {
  if (!filePath) {
    return;
  }
  const resolved = requireContainedUploadPath(filePath);
  try {
    await fs.promises.unlink(resolved);
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
}

async function verifyUploadedImage(req, res, next) {
  if (!req.file) {
    return next();
  }

  const safePath = resolveContainedUploadPath(req.file.filename);
  if (!safePath) {
    return next(uploadError("Invalid upload location"));
  }

  try {
    const header = Buffer.alloc(12);
    const handle = await fs.promises.open(safePath, "r");
    try {
      await handle.read(header, 0, header.length, 0);
    } finally {
      await handle.close();
    }

    const extension = path.extname(path.basename(req.file.filename)).toLowerCase();
    const valid =
      ((extension === ".jpg" || extension === ".jpeg") && isJpeg(header)) ||
      (extension === ".png" && isPng(header));

    if (!valid) {
      await deleteUploadedFile(req.file.filename);
      req.file = undefined;
      return next(uploadError("Uploaded file content is not a valid JPEG or PNG image"));
    }
    next();
  } catch (err) {
    try {
      await deleteUploadedFile(req.file && req.file.filename);
    } catch (cleanupErr) {
      console.error("Failed to clean up rejected upload", cleanupErr);
    }
    next(err);
  }
}

function handleUpload(uploadMiddleware) {
  return function uploadHandler(req, res, next) {
    uploadMiddleware(req, res, function onUpload(err) {
      if (!err) {
        return next();
      }
      if (err instanceof multer.MulterError) {
        return next(uploadError("Upload failed. Use one JPEG or PNG under 8MB"));
      }
      next(err);
    });
  };
}

function publicPathForUpload(file) {
  if (!file || !resolveContainedUploadPath(file.filename)) {
    throw new Error("Invalid upload location");
  }
  return `${PUBLIC_UPLOAD_PREFIX}${path.basename(file.filename)}`;
}

function resolveStoredUpload(publicPath) {
  if (typeof publicPath !== "string" || !publicPath.startsWith(PUBLIC_UPLOAD_PREFIX)) {
    return null;
  }
  const filename = publicPath.slice(PUBLIC_UPLOAD_PREFIX.length);
  if (!filename || filename !== path.basename(filename)) {
    return null;
  }
  return resolveContainedUploadPath(filename);
}

async function deleteStoredUpload(publicPath) {
  const resolved = resolveStoredUpload(publicPath);
  if (!resolved) {
    console.warn("Skipped unsafe or non-upload image path");
    return;
  }
  await deleteUploadedFile(resolved);
}

module.exports = {
  UPLOAD_ROOT,
  uploadCreateImage: handleUpload(upload.single("item_picture")),
  uploadUpdateImage: handleUpload(upload.single("item_picture_update")),
  verifyUploadedImage,
  publicPathForUpload,
  deleteUploadedFile,
  deleteStoredUpload,
  resolveStoredUpload,
};
