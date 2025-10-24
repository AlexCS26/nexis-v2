/**
 * @fileoverview Servidor principal de la API Nexis ERP (Producción - Kyob)
 * @version 1.0.1
 * @description Configuración completa de Express con conexión MongoDB,
 *              middlewares globales, seguridad, CORS y verificación de salud.
 */
require("module-alias/register");
require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const os = require("os");
const moment = require("moment-timezone");

// Configuración y rutas
const connectDB = require("./src/core/config/db");
const corsMiddleware = require("./src/core/config/cors.config");
const apiRoutes = require("./src/routes/index");

// Inicializar aplicación
const app = express();

/* ==========================================
   Configuración base del entorno
   ========================================== */
app.set("trust proxy", 1);
app.use(helmet());
app.use(corsMiddleware);
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined"));

/* ==========================================
   Conexión a la base de datos
   ========================================== */
(async () => {
  try {
    await connectDB();
    console.log("Conectado a MongoDB");
  } catch (error) {
    console.error("Error al conectar con MongoDB:", error.message);
    process.exit(1);
  }
})();

/* ==========================================
   Limitador de solicitudes
   ========================================== */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
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
    version: "v1.0.1",
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
    },
  });
});

/* ==========================================
   Endpoint de verificación de salud (Kyob)
   ========================================== */
app.get("/api/v1/health", (req, res) => {
  const now = moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss");
  res.status(200).json({
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
  console.error("Error no controlado:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("Promesa rechazada sin manejar:", err.message);
});

/* ==========================================
   Inicialización dinámica del servidor
   ========================================== */
const PORT = Number(process.env.PORT) || Number(process.env.APP_PORT) || 8000;

// Escucha en 0.0.0.0 para entornos con contenedor
app.listen(PORT, "0.0.0.0", () => {
  console.clear();
  console.log("===========================================");
  console.log("NEXIS ERP API INICIADO");
  console.log(`Puerto asignado: ${PORT}`);
  console.log(`URL base: http://localhost:${PORT}/api/v1`);
  console.log(
    `Inicio: ${moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss")}`
  );
  console.log(`Entorno: ${process.env.NODE_ENV || "production"}`);
  console.log("===========================================");
});
