const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { randomBytes } = require("crypto");
const config = require("./config");
const { HttpError } = require("./utils");

fs.mkdirSync(config.uploadDir, { recursive: true });

const EXTENSIONS = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

/** Accepts one image max size 5mb and save it in storages*/
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (req, file, cb) =>
      cb(
        null,
        `${Date.now()}-${randomBytes(6).toString("hex")}${EXTENSIONS[file.mimetype]}`,
      ),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    EXTENSIONS[file.mimetype]
      ? cb(null, true)
      : cb(new HttpError(400, "Images must be PNG, JPG, GIF or WebP")),
});

const publicPath = (file) => (file ? `/uploads/${file.filename}` : null);

function removeUpload(urlPath) {
  if (!urlPath?.startsWith("/uploads/")) return;
  fs.rm(
    path.join(config.uploadDir, path.basename(urlPath)),
    { force: true },
    () => {},
  );
}

module.exports = { imageUpload, publicPath, removeUpload };
