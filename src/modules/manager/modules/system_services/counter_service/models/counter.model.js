/**
 * @fileoverview Modelo de contador corporativo para numeración secuencial de documentos
 * @module system/models/counter.model
 * @description Controla la numeración automática y segura de documentos (ventas, compras, etc.)
 */

const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
  {
    /**
     * Tipo o prefijo del documento.
     * Ej: SL = Sale, PO = Purchase Order, QT = Quotation, INV = Invoice, ST = Store, etc.
     */
    prefix: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    /**
     * Tienda o sucursal a la que pertenece el contador.
     * Permite manejar numeración independiente por sede.
     * Si es global (como tiendas o usuarios), puede ser null.
     */
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: false, // 🔹 antes era true
      index: true,
      default: null,
    },

    /**
     * Año fiscal — permite reiniciar los contadores por año.
     */
    fiscalYear: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear(),
      index: true,
    },

    /**
     * Valor actual del contador (último número asignado).
     */
    currentValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Valor inicial — útil para series personalizadas (por ejemplo, comenzar desde 1001).
     */
    startValue: {
      type: Number,
      default: 1,
    },

    /**
     * Valor máximo antes de reiniciar o lanzar alerta (por ejemplo, 99999 o 999999).
     */
    maxValue: {
      type: Number,
      default: 99999,
    },

    /**
     * Longitud de la numeración (número de dígitos con padding).
     * Ej: 5 → SL-00001
     */
    padding: {
      type: Number,
      default: 5,
    },

    /**
     * Descripción del contador (para identificarlo fácilmente).
     */
    description: {
      type: String,
      trim: true,
    },

    /**
     * Fecha del último reinicio o actualización.
     */
    lastReset: {
      type: Date,
    },

    /**
     * Estado (activo/inactivo).
     */
    active: {
      type: Boolean,
      default: true,
    },

    /**
     * Auditoría.
     */
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

/**
 * ✅ Método general: genera y devuelve el siguiente código secuencial seguro.
 * Compatible con contadores globales y por tienda.
 */
counterSchema.statics.getNextSequence = async function (
  prefix,
  storeId = null,
  session = null
) {
  const year = new Date().getFullYear();

  const counter = await this.findOneAndUpdate(
    { prefix, store: storeId, fiscalYear: year },
    { $inc: { currentValue: 1 } },
    { new: true, upsert: true, session }
  );

  // Reinicio de contador si excede maxValue
  if (counter.currentValue > counter.maxValue) {
    counter.currentValue = counter.startValue;
    counter.lastReset = new Date();
    await counter.save({ session });
  }

  const formattedNumber = counter.currentValue
    .toString()
    .padStart(counter.padding, "0");

  return `${prefix}-${formattedNumber}`;
};

counterSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Counter", counterSchema);
