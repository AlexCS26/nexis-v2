/**
 * @fileoverview Modelo de gestión de sesiones de usuario.
 * @module user/models/session
 * @description Registra las sesiones activas de cada usuario, asociadas a sus tokens de acceso y persistencia.
 */

const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    // Usuario al que pertenece la sesión
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Token de acceso (corto plazo, 15m - 1h)
    accessToken: {
      type: String,
      required: true,
    },

    // Token persistente (refresh token, largo plazo, 7d - 30d)
    persistentToken: {
      type: String,
      required: true,
    },

    // Información del dispositivo o entorno de inicio
    deviceInfo: {
      os: { type: String, trim: true },
      browser: { type: String, trim: true },
      appVersion: { type: String, trim: true },
    },

    // IP y ubicación
    ipAddress: { type: String, trim: true },
    location: {
      country: { type: String, trim: true },
      city: { type: String, trim: true },
    },

    // Estado de la sesión
    isActive: { type: Boolean, default: true },
    isRevoked: { type: Boolean, default: false },

    // Control de expiración
    accessTokenExpiresAt: { type: Date, required: true },
    persistentTokenExpiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
