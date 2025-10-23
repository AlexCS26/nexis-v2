/**
 * @fileoverview Configuración profesional de CORS — Nexis ERP API
 * @description Permite orígenes definidos en .env y protege el acceso no autorizado.
 */

const cors = require("cors");

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : [];

    // Permitir herramientas locales (Postman, etc.) sin origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origen no autorizado por CORS: ${origin}`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

module.exports = cors(corsOptions);
