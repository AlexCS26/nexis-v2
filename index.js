/**
 * @fileoverview Servidor principal de la API Nexis ERP (Producción)
 * @version 1.0.0
 * @description Configuración base del servidor Express, conexión a MongoDB,
 *              middlewares globales, CORS, seguridad y rutas principales.
 */

require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const os = require("os");
const moment = require("moment-timezone");

// Configuración y rutas
const connectDB = require("./src/config/db");
const corsMiddleware = require("./src/config/cors.config");
const apiRoutes = require("./src/routes/index");

// Inicializar app
const app = express();

/* ==========================================
   Configuración base del entorno
   ========================================== */
app.set("trust proxy", 1); // ← Solución al error X-Forwarded-For (confía en el proxy)
connectDB();

/* ==========================================
   Middlewares globales
   ========================================== */
app.use(helmet()); // Seguridad HTTP
app.use(corsMiddleware); // CORS centralizado
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev")); // Logs de peticiones HTTP

/* ==========================================
   Limitador de solicitudes
   ========================================== */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes, inténtelo más tarde." },
});
app.use("/api/v1", apiLimiter);

/* ==========================================
   Rutas principales
   ========================================== */
app.use("/api/v1", apiRoutes);

/* ==========================================
   Ruta raíz informativa
   ========================================== */
app.get("/", (req, res) => {
  const now = moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss");
  const uptime = process.uptime();
  const uptimeFormatted = `${Math.floor(uptime / 60)}m ${Math.floor(
    uptime % 60
  )}s`;

  res.json({
    status: "OK",
    app: "Nexis ERP API",
    version: "v1.0.0",
    environment: process.env.NODE_ENV || "development",
    server: {
      hostname: os.hostname(),
      platform: os.platform(),
      uptime: uptimeFormatted,
      memory: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
      time: now,
    },
    endpoints: {
      health: "/api/v1/health",
      userProfile: "/api/v1/users/me",
      adminUsers: "/api/v1/admin/users",
    },
  });
});

/* ==========================================
   Ruta de salud
   ========================================== */
app.get("/api/v1/health", (req, res) => {
  const now = moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss");
  res.json({
    status: "Healthy",
    database: "Connected",
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: now,
  });
});

/* ==========================================
   Manejo global de errores no controlados
   ========================================== */
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err.message);
});

/* ==========================================
   Inicialización del servidor
   ========================================== */
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.clear();
    console.log("===========================================");
    console.log("NEXIS ERP API STARTED");
    console.log(`Base URL: http://localhost:${PORT}/api/v1`);
    console.log(
      `Started at: ${moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss")}`
    );
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log("===========================================");
  });
}

module.exports = app; // Exportación para Vercel o entorno sin puerto manual
