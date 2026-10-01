const express = require("express");
const cors = require("cors");
const multer = require("multer");
const config = require("./config");

function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads", express.static(config.uploadDir, { maxAge: "7d" }));

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/users", require("./routes/users"));
  app.use("/api/uploads", require("./routes/uploads"));
  app.use("/api/groups", require("./routes/groups"));
  app.use("/api/channels", require("./routes/channels"));
  app.use("/api/requests", require("./routes/requests"));
  app.use("/api/admin", require("./routes/admin"));

  app.use((req, res) =>
    res.status(404).json({ error: `No route for ${req.method} ${req.path}` }),
  );

  // Express 5 sends errors thrown in async handlers here.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res
        .status(400)
        .json({
          error:
            err.code === "LIMIT_FILE_SIZE"
              ? "Images must be 5 MB or smaller"
              : err.message,
        });
    }
    if (err.type === "entity.parse.failed")
      return res.status(400).json({ error: "Request body is not valid JSON" });
    if (err.code === 11000)
      return res.status(409).json({ error: "That value is already in use" });
    if (!err.status) console.error(err);
    res
      .status(err.status || 500)
      .json({
        error: err.status ? err.message : "Something went wrong on the server",
      });
  });

  return app;
}

module.exports = { createApp };
