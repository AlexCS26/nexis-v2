/**
 * @fileoverview Modelo de auditoría del sistema
 * @module manager/modules/audit_services/audit_service/models/audit.model
 * @description Registra todas las acciones críticas del sistema con trazabilidad corporativa.
 */

const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema(
  {
    // 🔹 Código único generado por el contador corporativo
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true, // Ej: AU-00001
      trim: true,
      index: true,
    },

    // 🔹 Tipo de acción
    action: {
      type: String,
      required: [true, "Audit action is required"],
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "PERMISSION",
        "OTHER",
      ],
    },

    // 🔹 Módulo afectado
    module: {
      type: String,
      required: [true, "Module is required"],
      trim: true,
      uppercase: true, // Ej: "USER", "PRODUCT", "SALE", "MOVEMENT"
    },

    // 🔹 Entidad objetivo
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    targetModel: {
      type: String,
      trim: true,
      uppercase: true, // Ej: "PRODUCT", "USER", etc.
    },

    // 🔹 Descripción humana legible
    description: {
      type: String,
      trim: true,
    },

    // 🔹 Contexto técnico
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },

    // 🔹 Relaciones
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
    },
  },
  { timestamps: true }
);

// Índices para rendimiento
auditSchema.index({ code: 1 });
auditSchema.index({ action: 1, module: 1 });
auditSchema.index({ user: 1, store: 1 });

auditSchema.methods.toJSON = function () {
  const audit = this.toObject();
  delete audit.__v;
  return audit;
};

module.exports = mongoose.model("Audit", auditSchema);
