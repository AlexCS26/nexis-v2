/**
 * @fileoverview Servidor principal de la API Nexis ERP (Vercel - Serverless)
 * @version 1.2.0
 * @description Configuración completa de Express optimizada para Vercel,
 *              con conexión MongoDB, seguridad, CORS y rutas unificadas.
 */

require("module-alias/register");
require("dotenv").config();

const path = require("path");
const express = require("express");
const serverless = require("serverless-http");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const os = require("os");
const moment = require("moment-timezone");

/* ==========================================
   Fix para entorno Vercel (rutas absolutas)
   ========================================== */
const connectDB = require("../src/core/config/db");
const corsMiddleware = require("../src/core/config/cors.config");
const apiRoutes = require("../src/routes/index");

/* ==========================================
   Inicializar aplicación Express
   ========================================== */
const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(corsMiddleware);
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined"));

/* ==========================================
   Conexión a la base de datos
   ========================================== */
let mongoConnected = false;
(async () => {
  if (!mongoConnected) {
    try {
      await connectDB();
      mongoConnected = true;
      console.log("✅ MongoDB conectado (Vercel)");
    } catch (error) {
      console.error("❌ Error al conectar con MongoDB:", error.message);
    }
  }
})();

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
    app: "Nexis ERP API (Serverless)",
    version: "v1.2.0",
    environment: process.env.NODE_ENV || "production",
    server: {
      hostname: os.hostname(),
      platform: os.platform(),
      uptime: uptimeFormatted,
      memory: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
      time: now,
    },
    endpoints: {
      health: "/api/v1/health",
      users: "/api/v1/users",
      products: "/api/v1/products",
      inventory: "/api/v1/inventory",
    },
  });
});

/* ==========================================
   Endpoint de verificación de salud
   ========================================== */
app.get("/api/v1/health", (req, res) => {
  const now = moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss");
  res.status(200).json({
    status: "Healthy",
    database: mongoConnected ? "Connected" : "Disconnected",
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: now,
  });
});

/* ==========================================
   Manejo global de errores no controlados
   ========================================== */
process.on("uncaughtException", (err) => {
  console.error("Error no controlado:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.error("Promesa rechazada sin manejar:", err.message);
});

/* ==========================================
   Exportación Serverless (sin listen)
   ========================================== */
module.exports = app;
module.exports.handler = serverless(app);
