/**
 * @fileoverview Controlador de inventario para managers / administradores
 * @module manager/controllers/inventoryManagerController
 * @description Permite gestionar, analizar y supervisar el inventario de todas las tiendas.
 */

const mongoose = require("mongoose");
const Inventory = require("../models/inventory.model");
const Movement = require("../../movement_service/models/movement.model");
const Store = require("../../../../../user/modules/store_services/store_service/models/store.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../../core/utils/responseUtils");

/* ──────────────────────────────────────────────
 * LISTAR INVENTARIO (GLOBAL / POR TIENDA)
 * ────────────────────────────────────────────── */
exports.listInventories = async (req, res) => {
  try {
    const { page = 1, limit = 30, search = "", store, status } = req.query;
    const query = {};

    if (store && mongoose.Types.ObjectId.isValid(store)) query.store = store;

    if (status) query.status = status.toUpperCase();

    if (search) {
      query.$or = [
        { "product.name": new RegExp(search, "i") },
        { "variant.name": new RegExp(search, "i") },
      ];
    }

    const skip = (page - 1) * limit;

    const [inventories, total] = await Promise.all([
      Inventory.find(query)
        .populate("store", "name code")
        .populate("product", "name code category salePrice")
        .populate("variant", "name sku barcode")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Inventory.countDocuments(query),
    ]);

    return successResponse(
      res,
      200,
      "Inventarios obtenidos correctamente",
      inventories,
      {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      }
    );
  } catch (error) {
    console.error("Error listando inventarios:", error);
    return errorResponse(res, 500, "Error interno listando inventarios", error);
  }
};

/* ──────────────────────────────────────────────
 * RESUMEN GLOBAL DE INVENTARIO
 * ────────────────────────────────────────────── */
exports.getGlobalSummary = async (req, res) => {
  try {
    const [summary] = await Inventory.aggregate([
      {
        $group: {
          _id: "$store",
          totalItems: { $sum: 1 },
          totalUnits: { $sum: "$currentStock" },
          totalValue: { $sum: "$valuation" },
          lowStockCount: {
            $sum: { $cond: [{ $lte: ["$currentStock", 5] }, 1, 0] },
          },
          outOfStockCount: {
            $sum: { $cond: [{ $eq: ["$currentStock", 0] }, 1, 0] },
          },
        },
      },
    ]);

    const stores = await Store.find().select("name code");

    return successResponse(res, 200, "Resumen global de inventarios", {
      summary,
      stores,
    });
  } catch (error) {
    console.error("Error generando resumen global:", error);
    return errorResponse(res, 500, "Error interno al generar resumen", error);
  }
};

/* ──────────────────────────────────────────────
 * VALORACIÓN DE INVENTARIO (COSTOS / VALOR)
 * ────────────────────────────────────────────── */
exports.getInventoryValuation = async (req, res) => {
  try {
    const { store } = req.query;
    const match =
      store && mongoose.Types.ObjectId.isValid(store)
        ? { store: new mongoose.Types.ObjectId(store) }
        : {};

    const valuation = await Inventory.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$store",
          totalItems: { $sum: 1 },
          totalUnits: { $sum: "$currentStock" },
          avgCost: { $avg: "$averageCost" },
          totalValue: { $sum: "$valuation" },
        },
      },
    ]);

    return successResponse(
      res,
      200,
      "Valoración de inventario obtenida",
      valuation
    );
  } catch (error) {
    console.error("Error obteniendo valoración de inventario:", error);
    return errorResponse(
      res,
      500,
      "Error interno obteniendo valoración",
      error
    );
  }
};

/* ──────────────────────────────────────────────
 * ROTACIÓN DE STOCK (Productos más y menos vendidos)
 * ────────────────────────────────────────────── */
exports.getStockRotation = async (req, res) => {
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const rotation = await Movement.aggregate([
      { $match: { createdAt: { $gte: last30Days } } },
      {
        $group: {
          _id: { product: "$product", type: "$type" },
          totalQuantity: { $sum: "$quantity" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $project: {
          product: "$productInfo.name",
          type: "$_id.type",
          totalQuantity: 1,
        },
      },
      { $sort: { totalQuantity: -1 } },
    ]);

    return successResponse(
      res,
      200,
      "Rotación de inventario obtenida",
      rotation
    );
  } catch (error) {
    console.error("Error obteniendo rotación:", error);
    return errorResponse(res, 500, "Error interno obteniendo rotación", error);
  }
};

/* ──────────────────────────────────────────────
 * ALERTAS GLOBALES (Agotados / Bajo / Sobre Stock)
 * ────────────────────────────────────────────── */
exports.getInventoryAlerts = async (req, res) => {
  try {
    const [low, out, over] = await Promise.all([
      Inventory.find({ currentStock: { $gt: 0, $lte: 5 } })
        .populate("product", "name code")
        .populate("store", "name code"),
      Inventory.find({ currentStock: 0 })
        .populate("product", "name code")
        .populate("store", "name code"),
      Inventory.find({ currentStock: { $gte: 200 } })
        .populate("product", "name code")
        .populate("store", "name code"),
    ]);

    return successResponse(
      res,
      200,
      "Alertas globales de inventario obtenidas",
      {
        low,
        out,
        over,
      }
    );
  } catch (error) {
    console.error("Error generando alertas globales:", error);
    return errorResponse(res, 500, "Error interno generando alertas", error);
  }
};

/* ──────────────────────────────────────────────
 * HISTÓRICO DE MOVIMIENTOS (Filtros por fecha, tipo o tienda)
 * ────────────────────────────────────────────── */
exports.getMovementsHistory = async (req, res) => {
  try {
    const { store, startDate, endDate, type } = req.query;
    const query = {};

    if (store && mongoose.Types.ObjectId.isValid(store)) query.store = store;
    if (type) query.type = type.toUpperCase();
    if (startDate && endDate)
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };

    const movements = await Movement.find(query)
      .populate("product", "name code")
      .populate("variant", "name sku")
      .populate("store", "name code")
      .sort({ createdAt: -1 });

    return successResponse(
      res,
      200,
      "Histórico de movimientos obtenido",
      movements
    );
  } catch (error) {
    console.error("Error obteniendo histórico de movimientos:", error);
    return errorResponse(res, 500, "Error interno obteniendo histórico", error);
  }
};

/* ──────────────────────────────────────────────
 * AJUSTE MANUAL DE STOCK (Entrada o Salida)
 * ────────────────────────────────────────────── */
exports.adjustStock = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      productId,
      variantId = null,
      storeId,
      quantity,
      reason,
      note,
    } = req.body;

    if (!productId || !storeId || typeof quantity !== "number") {
      return errorResponse(res, 400, "Datos de ajuste incompletos o inválidos");
    }

    // Determinar tipo de movimiento
    const type = quantity >= 0 ? "IN" : "OUT";
    const absQuantity = Math.abs(quantity);

    await session.withTransaction(async () => {
      // 🔹 Actualizar inventario o crearlo si no existe
      const inventory = await Inventory.updateStock(
        {
          productId,
          variantId,
          storeId,
          quantity: absQuantity,
          type,
        },
        session
      );

      // 🔹 Registrar movimiento de inventario
      await Movement.create(
        [
          {
            code: `AJ-${Date.now()}`,
            type,
            reason: reason || "MANUAL_ADJUSTMENT",
            product: productId,
            variant: variantId,
            store: storeId,
            quantity: absQuantity,
            previousStock:
              type === "IN"
                ? inventory.currentStock - absQuantity
                : inventory.currentStock + absQuantity,
            newStock: inventory.currentStock,
            note:
              note || `Ajuste manual por ${req.user.firstName || "manager"}`,
            createdBy: req.user.id,
          },
        ],
        { session }
      );
    });

    return successResponse(
      res,
      200,
      "Ajuste de inventario realizado correctamente"
    );
  } catch (error) {
    console.error("Error ajustando inventario:", error);
    return errorResponse(res, 500, "Error interno ajustando inventario", error);
  } finally {
    await session.endSession();
  }
};
