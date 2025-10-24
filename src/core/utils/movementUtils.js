// utils/movementUtils.js
const mongoose = require("mongoose");
const Movement = require("../../modules/manager/modules/inventory_services/movement_service/models/movement.model");
const Counter = require("../../modules/manager/modules/system_services/counter_service/models/counter.model");

/**
 * Registra un movimiento de inventario en el sistema
 * @param {Object} params - Parámetros del registro de movimiento
 * @param {String} params.type - Tipo de movimiento (IN, OUT, TRANSFER, ADJUSTMENT)
 * @param {String} params.reason - Razón del movimiento (PURCHASE, SALE, RETURN, etc.)
 * @param {String} params.productId - ID del producto afectado
 * @param {String} [params.variantId] - ID de la variante (si aplica)
 * @param {String} params.storeId - ID de la tienda
 * @param {Number} params.quantity - Cantidad del movimiento
 * @param {Number} params.previousStock - Stock anterior del producto
 * @param {Number} params.newStock - Stock nuevo del producto
 * @param {String} [params.reference] - Referencia (ID de venta, compra, etc.)
 * @param {String} [params.note] - Nota adicional
 * @param {String} params.userId - Usuario que realizó la acción
 */
exports.registerMovement = async ({
  type,
  reason = "OTHER",
  productId,
  variantId = null,
  storeId,
  quantity,
  previousStock = 0,
  newStock = 0,
  reference = null,
  note = "",
  userId,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!type || !productId || !storeId || !quantity) {
      throw new Error("Missing required movement fields");
    }

    // 1️⃣ Obtener siguiente código secuencial del contador corporativo
    const code = await Counter.getNextSequence("MV", storeId, session);

    // 2️⃣ Crear el movimiento
    const movementData = {
      code, // MV-00001
      type: type.toUpperCase(),
      reason: reason.toUpperCase(),
      product: productId,
      variant: variantId,
      store: storeId,
      quantity,
      previousStock,
      newStock,
      reference,
      note,
      createdBy: userId,
    };

    await Movement.create([movementData], { session });

    await session.commitTransaction();
  } catch (error) {
    console.error("Movement log failed:", error.message);
    await session.abortTransaction();
  } finally {
    session.endSession();
  }
};
