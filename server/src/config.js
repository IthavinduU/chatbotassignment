const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  quiet: true,
});

module.exports = {
  port: Number(process.env.PORT) || 3000,
  mongoUrl: process.env.MONGO_URL || "mongodb://127.0.0.1:27017",
  dbName: process.env.DB_NAME || "fabulari_chat",
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:4200",
  channelInactiveDays: Number(process.env.CHANNEL_INACTIVE_DAYS ?? 30),
  seedDemo: (process.env.SEED_DEMO ?? "true") === "true",
  isProduction: process.env.NODE_ENV === "production",
  uploadDir: path.join(__dirname, "..", "uploads"),
};
