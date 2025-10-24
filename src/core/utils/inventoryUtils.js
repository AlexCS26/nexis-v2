/**
 * @fileoverview Utilidades de inventario centralizadas
 * @module utils/inventoryUtils
 * @description Gestiona los movimientos y sincronización de inventario con productos y variantes.
 */

const mongoose = require("mongoose");
const Movement = require("../../modules/manager/modules/inventory_services/movement_service/models/movement.model");
const Inventory = require("../../modules/manager/modules/inventory_services/inventory_service/models/inventory.model");
const Product = require("../../modules/user/modules/products_services/product_service/models/product.model");
const Variant = require("../../modules/user/modules/products_services/variant_service/models/variant.model");
const { registerAudit } = require("./auditUtils");

/**
 * Registra un movimiento de inventario y actualiza stocks + auditoría.
 * @param {Object} data
 * @returns {Promise<{movement: Object, updatedInventory: Object}>}
 */
exports.registerMovementAndUpdateInventory = async ({
  type, // IN / OUT / TRANSFER / ADJUSTMENT
  reason, // Motivo (SALE, PURCHASE, RETURN, etc.)
  productId,
  variantId = null,
  storeId,
  quantity,
  cost = 0,
  reference = "",
  note = "",
  userId,
  session = null,
}) => {
  if (!productId || !storeId || !quantity)
    throw new Error("Faltan datos obligatorios para registrar movimiento");

  // 🔹 Buscar inventario actual o crearlo si no existe
  const inventory = await Inventory.findOneAndUpdate(
    { product: productId, variant: variantId, store: storeId },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true, session }
  );

  const prevStock = inventory.currentStock;
  let newStock = prevStock;

  // 🔹 Actualizar stock según tipo de movimiento
  if (type === "IN") newStock += quantity;
  else if (type === "OUT") newStock -= quantity;
  else if (type === "ADJUSTMENT") newStock = quantity; // cantidad exacta (por ajuste físico)

  // 🔹 Cálculo de costos (solo en entradas)
  if (type === "IN" && cost > 0) {
    const totalValue = inventory.averageCost * prevStock + cost * quantity;
    const totalUnits = prevStock + quantity;
    inventory.averageCost = totalUnits > 0 ? totalValue / totalUnits : cost;
    inventory.lastCost = cost;
  }

  // 🔹 Actualizar datos del inventario
  inventory.currentStock = Math.max(newStock, 0);
  inventory.availableStock = Math.max(
    inventory.currentStock - inventory.reservedStock,
    0
  );
  inventory.lastMovementAt = new Date();
  inventory.valuation = parseFloat(
    (inventory.currentStock * inventory.averageCost).toFixed(2)
  );

  await inventory.save({ session });

  // ✅ Sincronizar stock con Product o Variant
  if (variantId) {
    await Variant.findByIdAndUpdate(
      variantId,
      { stock: inventory.currentStock, updatedAt: new Date() },
      { session }
    );
  } else {
    await Product.findByIdAndUpdate(
      productId,
      { stock: inventory.currentStock, updatedAt: new Date() },
      { session }
    );
  }

  // 🔹 Registrar movimiento histórico
  const [movement] = await Movement.create(
    [
      {
        code: `MV-${Date.now()}`,
        type,
        reason,
        product: productId,
        variant: variantId,
        store: storeId,
        quantity,
        previousStock: prevStock,
        newStock: inventory.currentStock,
        reference,
        note,
        createdBy: userId,
      },
    ],
    { session }
  );

  // 🔹 Registrar auditoría
  await registerAudit({
    userId,
    action: "UPDATE", // ✅ usa valor existente en enum
    module: "INVENTORY",
    target: inventory,
    description: `Movimiento ${type} (${reason}) — ${quantity} unidades (${reference})`,
    storeId,
  });

  return { movement, updatedInventory: inventory };
};
