/**
 * @fileoverview Modelo de cliente
 * @module user/modules/customers_services/customer_service/models/customer.model
 * @description Representa a los clientes del sistema (reales o genéricos).
 */

const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    // 🔹 Nombre completo o razón social
    name: {
      type: String,
      required: [true, "El nombre del cliente es obligatorio"],
      trim: true,
      maxlength: [150, "El nombre no puede exceder los 150 caracteres"],
    },

    // 🔹 Tipo de documento (para Perú: DNI, RUC, CE, PASAPORTE)
    documentType: {
      type: String,
      enum: ["DNI", "RUC", "CE", "PASAPORTE", "OTRO"],
      default: "DNI",
    },

    // 🔹 Número de documento
    documentNumber: {
      type: String,
      trim: true,
      maxlength: [
        15,
        "El número de documento no puede exceder los 15 caracteres",
      ],
    },

    // 🔹 Correo electrónico
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Correo electrónico no válido"],
      default: null,
    },

    // 🔹 Teléfono o celular
    phone: {
      type: String,
      trim: true,
      maxlength: [20, "El teléfono no puede exceder los 20 caracteres"],
      default: null,
    },

    // 🔹 Dirección (opcional)
    address: {
      type: String,
      trim: true,
      maxlength: [200, "La dirección no puede exceder los 200 caracteres"],
      default: null,
    },

    // 🔹 Cliente genérico (para “Venta rápida”)
    isGeneric: {
      type: Boolean,
      default: false,
      index: true,
    },

    // 🔹 Estado del cliente
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      uppercase: true,
    },

    // 🔹 Auditoría
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  { timestamps: true }
);

// 🔹 Índices para búsqueda rápida
customerSchema.index({ name: "text", documentNumber: "text" });

customerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Customer", customerSchema);
