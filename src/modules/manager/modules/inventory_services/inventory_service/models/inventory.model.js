/**
 * @fileoverview Modelo de inventario multi-tienda, multi-producto y multi-variantes
 * @module inventory/models/inventory.model
 * @description Mantiene el estado actual del inventario por producto, variante y tienda.
 * Compatible con sistemas de movimientos (IN / OUT / TRANSFER / ADJUSTMENT).
 */

const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    // 🔹 Producto o variante asociada
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
      index: true,
    },

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      default: null,
      index: true,
    },

    // 🔹 Tienda o almacén donde se encuentra el producto
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: [true, "Store reference is required"],
      index: true,
    },

    // 🔹 Datos de cantidad
    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },

    reservedStock: {
      type: Number,
      default: 0,
      min: [0, "Reserved stock cannot be negative"],
      description: "Stock comprometido por pedidos o cotizaciones",
    },

    availableStock: {
      type: Number,
      default: 0,
      min: [0, "Available stock cannot be negative"],
      description: "Stock disponible = currentStock - reservedStock",
    },

    // 🔹 Control de costos
    costMethod: {
      type: String,
      enum: ["PROMEDIO", "FIFO", "LIFO"],
      default: "PROMEDIO",
      uppercase: true,
    },

    averageCost: {
      type: Number,
      default: 0,
      min: [0, "Average cost cannot be negative"],
      description: "Costo promedio ponderado",
    },

    lastCost: {
      type: Number,
      default: 0,
      min: [0, "Last cost cannot be negative"],
      description: "Último costo registrado",
    },

    // 🔹 Información extendida
    valuation: {
      type: Number,
      default: 0,
      description: "Valor total del stock = currentStock * averageCost",
    },

    lastMovementAt: {
      type: Date,
      default: Date.now,
      description: "Fecha del último movimiento registrado",
    },

    // 🔹 Estado del inventario
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "AUDIT_PENDING"],
      default: "ACTIVE",
      uppercase: true,
    },

    // 🔹 Auditoría y trazabilidad
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "inventories",
  }
);

//
// 🔹 Hooks y cálculos automáticos
//
inventorySchema.pre("save", function (next) {
  // Calcula stock disponible automáticamente
  this.availableStock = Math.max(this.currentStock - this.reservedStock, 0);

  // Calcula valoración total del inventario
  this.valuation = parseFloat(
    (this.currentStock * this.averageCost).toFixed(2)
  );

  next();
});

//
// 🔹 Métodos estáticos — usados por controladores o servicios
//

/**
 * Actualiza o crea inventario automáticamente
 * @param {Object} params - { productId, variantId, storeId, quantity, cost, type }
 * @param {mongoose.ClientSession} [session] - sesión transaccional opcional
 */
inventorySchema.statics.updateStock = async function (
  { productId, variantId = null, storeId, quantity, cost = 0, type },
  session = null
) {
  const inventory = await this.findOneAndUpdate(
    { product: productId, variant: variantId, store: storeId },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true, session }
  );

  const prevStock = inventory.currentStock;
  let newStock = prevStock;

  if (type === "IN") newStock += quantity;
  else if (type === "OUT") newStock -= quantity;

  // Costo promedio (solo para entradas)
  if (type === "IN" && cost > 0) {
    const totalValue = inventory.averageCost * prevStock + cost * quantity;
    const totalUnits = prevStock + quantity;
    inventory.averageCost = totalUnits > 0 ? totalValue / totalUnits : cost;
    inventory.lastCost = cost;
  }

  inventory.currentStock = newStock;
  inventory.availableStock = Math.max(newStock - inventory.reservedStock, 0);
  inventory.lastMovementAt = new Date();
  inventory.valuation = inventory.currentStock * inventory.averageCost;

  await inventory.save({ session });
  return inventory;
};

//
// 🔹 Índices para rendimiento
//
inventorySchema.index({ store: 1, product: 1, variant: 1 }, { unique: true });
inventorySchema.index({ store: 1, status: 1 });
inventorySchema.index({ product: 1, status: 1 });

//
// 🔹 Limpieza al exportar
//
inventorySchema.methods.toJSON = function () {
  const inv = this.toObject();
  delete inv.__v;
  return inv;
};

module.exports = mongoose.model("Inventory", inventorySchema);
