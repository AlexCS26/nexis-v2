// models/movement.model.js
const mongoose = require("mongoose");

const movementSchema = new mongoose.Schema(
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

    type: {
      type: String,
      enum: ["IN", "OUT", "TRANSFER", "ADJUSTMENT"],
      required: [true, "Movement type is required"],
    },
    reason: {
      type: String,
      enum: [
        "PURCHASE",
        "SALE",
        "RETURN",
        "TRANSFER",
        "ADJUSTMENT",
        "INVENTORY_INIT",
        "OTHER",
      ],
      default: "OTHER",
      uppercase: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      default: null,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
    },
    previousStock: {
      type: Number,
      default: 0,
    },
    newStock: {
      type: Number,
      default: 0,
    },
    reference: {
      type: String,
      trim: true,
      default: null, // Ej: ID de venta, compra o ajuste
    },
    note: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Index para consultas rápidas
movementSchema.index({ type: 1, reason: 1, store: 1 });
movementSchema.index({ product: 1, variant: 1, store: 1 });

movementSchema.methods.toJSON = function () {
  const movement = this.toObject();
  delete movement.__v;
  return movement;
};

module.exports = mongoose.model("Movement", movementSchema);
