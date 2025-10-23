/**
 * @fileoverview Controlador de inventario para usuarios (cajeros / vendedores)
 * @module user/controllers/inventoryUserController
 * @description Permite listar, consultar y visualizar el estado del inventario de la tienda del usuario autenticado.
 */

const mongoose = require("mongoose");
const Inventory = require("../../../../../manager/modules/inventory_services/inventory_service/models/inventory.model");
const Movement = require("../../../../../manager/modules/inventory_services/movement_service/models/movement.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../utils/responseUtils");

/* ──────────────────────────────────────────────
 * LISTAR INVENTARIO DE LA TIENDA (versión pro)
 * ────────────────────────────────────────────── */
exports.listInventory = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", lowStock } = req.query;
    const query = { store: req.user.store, status: "ACTIVE" };

    if (search) {
      query.$or = [
        { "product.name": new RegExp(search, "i") },
        { "variant.name": new RegExp(search, "i") },
        { "product.code": new RegExp(search, "i") },
      ];
    }

    if (lowStock === "true") query.currentStock = { $lte: 5 };

    const skip = (page - 1) * limit;

    /* 🚀 Buscar inventario con datos contextuales */
    const [items, total] = await Promise.all([
      Inventory.find(query)
        .populate({
          path: "product",
          select: "name code category minStock maxStock supplier",
          populate: [{ path: "category", select: "name" }],
        })
        .populate("variant", "name sku barcode")
        .populate("store", "name code")
        .sort({ currentStock: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),

      Inventory.countDocuments(query),
    ]);

    /* 🔹 Añadir último movimiento y formatear resultado */
    const itemIds = items.map((i) => i._id);
    const movements = await Movement.aggregate([
      { $match: { inventory: { $in: itemIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$inventory",
          lastType: { $first: "$type" },
          lastQuantity: { $first: "$quantity" },
          lastAt: { $first: "$createdAt" },
        },
      },
    ]);

    const movementMap = Object.fromEntries(
      movements.map((m) => [m._id.toString(), m])
    );

    const enriched = items.map((i) => {
      const mv = movementMap[i._id.toString()];
      return {
        ...i,
        lastMovement: mv
          ? {
              type: mv.lastType,
              quantity: mv.lastQuantity,
              date: mv.lastAt,
            }
          : null,
      };
    });

    return successResponse(
      res,
      200,
      "Inventario obtenido correctamente",
      enriched,
      {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      }
    );
  } catch (error) {
    console.error("Error listando inventario:", error);
    return errorResponse(res, 500, "Error interno listando inventario", error);
  }
};

/* ──────────────────────────────────────────────
 * DETALLE DE INVENTARIO
 * ────────────────────────────────────────────── */
exports.getInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "ID de inventario inválido");

    const item = await Inventory.findOne({
      _id: id,
      store: req.user.store,
    })
      .populate("product", "name code category salePrice discountPrice")
      .populate("variant", "name sku barcode salePrice discountPrice")
      .populate("store", "name code");

    if (!item)
      return errorResponse(
        res,
        404,
        "Inventario no encontrado o no pertenece a tu tienda"
      );

    return successResponse(res, 200, "Inventario obtenido correctamente", item);
  } catch (error) {
    console.error("Error obteniendo inventario:", error);
    return errorResponse(
      res,
      500,
      "Error interno al obtener inventario",
      error
    );
  }
};

/* ──────────────────────────────────────────────
 * PRODUCTOS CON BAJO STOCK
 * ────────────────────────────────────────────── */
exports.getLowStock = async (req, res) => {
  try {
    const lowStockLimit = 5;
    const items = await Inventory.find({
      store: req.user.store,
      currentStock: { $lte: lowStockLimit },
    })
      .populate("product", "name code salePrice")
      .populate("variant", "name sku")
      .sort({ currentStock: 1 });

    return successResponse(
      res,
      200,
      "Productos con bajo stock obtenidos correctamente",
      items
    );
  } catch (error) {
    console.error("Error listando bajo stock:", error);
    return errorResponse(res, 500, "Error interno listando bajo stock", error);
  }
};

/* ──────────────────────────────────────────────
 * RESUMEN SIMPLE PARA DASHBOARD
 * ────────────────────────────────────────────── */
exports.getInventorySummary = async (req, res) => {
  try {
    const storeId = req.user.store;

    const [summary] = await Inventory.aggregate([
      { $match: { store: new mongoose.Types.ObjectId(storeId) } },
      {
        $group: {
          _id: "$store",
          totalItems: { $sum: 1 },
          totalUnits: { $sum: "$currentStock" },
          totalValue: { $sum: "$valuation" },
          lowStockCount: {
            $sum: { $cond: [{ $lte: ["$currentStock", 5] }, 1, 0] },
          },
        },
      },
    ]);

    return successResponse(
      res,
      200,
      "Resumen de inventario obtenido",
      summary || {
        totalItems: 0,
        totalUnits: 0,
        totalValue: 0,
        lowStockCount: 0,
      }
    );
  } catch (error) {
    console.error("Error generando resumen:", error);
    return errorResponse(res, 500, "Error interno al generar resumen", error);
  }
};

/* ──────────────────────────────────────────────
 * MOVIMIENTOS RECIENTES DE STOCK
 * ────────────────────────────────────────────── */
exports.getRecentMovements = async (req, res) => {
  try {
    const storeId = req.user.store;

    const movements = await Movement.find({ store: storeId })
      .populate("product", "name code")
      .populate("variant", "name sku")
      .sort({ createdAt: -1 })
      .limit(10);

    return successResponse(
      res,
      200,
      "Últimos movimientos obtenidos",
      movements
    );
  } catch (error) {
    console.error("Error listando movimientos:", error);
    return errorResponse(res, 500, "Error interno listando movimientos", error);
  }
};

/* ===========================================================
 * DASHBOARD DE INVENTARIO — Profesional con variantes anidadas
 * =========================================================== */
exports.getInventoryDashboard = async (req, res) => {
  try {
    const storeId = req.user.store;
    const storeObjId = new mongoose.Types.ObjectId(storeId);

    const [summary, topStocked, lowStockItems, recentMovements] =
      await Promise.all([
        // === 1️⃣ Resumen general (sin cambios)
        Inventory.aggregate([
          { $match: { store: storeObjId, status: "ACTIVE" } },
          {
            $group: {
              _id: null,
              totalItems: { $sum: 1 },
              totalUnits: { $sum: "$currentStock" },
              totalAvailable: { $sum: "$availableStock" },
              totalValue: { $sum: "$valuation" },
              avgUnitCost: { $avg: "$averageCost" },
              lowStock: {
                $sum: { $cond: [{ $lte: ["$currentStock", 5] }, 1, 0] },
              },
              outOfStock: {
                $sum: { $cond: [{ $eq: ["$currentStock", 0] }, 1, 0] },
              },
            },
          },
          {
            $project: {
              _id: 0,
              totalItems: 1,
              totalUnits: 1,
              totalAvailable: 1,
              totalValue: { $round: ["$totalValue", 2] },
              avgUnitCost: { $round: ["$avgUnitCost", 2] },
              lowStock: 1,
              outOfStock: 1,
              lowStockRate: {
                $cond: [
                  { $gt: ["$totalItems", 0] },
                  { $round: [{ $divide: ["$lowStock", "$totalItems"] }, 3] },
                  0,
                ],
              },
              outOfStockRate: {
                $cond: [
                  { $gt: ["$totalItems", 0] },
                  { $round: [{ $divide: ["$outOfStock", "$totalItems"] }, 3] },
                  0,
                ],
              },
            },
          },
        ]),

        // === 2️⃣ Top productos con variantes anidadas
        Inventory.aggregate([
          { $match: { store: storeObjId, status: "ACTIVE" } },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "product",
            },
          },
          { $unwind: "$product" },
          {
            $lookup: {
              from: "categories",
              localField: "product.category",
              foreignField: "_id",
              as: "category",
            },
          },
          { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "variants",
              localField: "product._id",
              foreignField: "product",
              as: "variants",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    name: 1,
                    sku: 1,
                    stock: 1,
                    salePrice: 1,
                    costPrice: 1,
                    discountPrice: 1,
                    attributes: 1,
                  },
                },
              ],
            },
          },
          {
            $group: {
              _id: "$product._id",
              code: { $first: "$product.code" },
              name: { $first: "$product.name" },
              category: { $first: "$category.name" },
              totalStock: { $sum: "$currentStock" },
              totalValue: { $sum: "$valuation" },
              avgCost: { $avg: "$averageCost" },
              variants: { $first: "$variants" },
            },
          },
          { $sort: { totalStock: -1 } },
          { $limit: 5 },
        ]),

        // === 3️⃣ Bajo stock (igual)
        Inventory.aggregate([
          {
            $match: {
              store: storeObjId,
              status: "ACTIVE",
              currentStock: { $lte: 5 },
            },
          },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "product",
            },
          },
          { $unwind: "$product" },
          {
            $project: {
              _id: "$product.name",
              code: "$product.code",
              currentStock: 1,
              minStock: { $ifNull: ["$product.minStock", 5] },
              averageCost: 1,
              valuation: 1,
              deficit: {
                $max: [
                  { $subtract: ["$product.minStock", "$currentStock"] },
                  0,
                ],
              },
            },
          },
          { $sort: { deficit: -1 } },
          { $limit: 5 },
        ]),

        // === 4️⃣ Movimientos recientes (igual)
        Movement.find({ store: storeId })
          .populate({
            path: "product",
            select: "name code category",
            populate: {
              path: "category",
              select: "name",
              model: "Category",
            },
          })
          .populate("variant", "name sku")
          .populate("createdBy", "firstName lastName email")
          .populate("updatedBy", "firstName lastName email")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ]);

    const inventorySummary = summary?.[0] || {};
    const formattedMovements = recentMovements.map((m) => ({
      type: m.type,
      productCode: m.product?.code || "N/A",
      productName: m.product?.name || "Desconocido",
      category: m.product?.category?.name || "Sin categoría",
      variant: m.variant?.name || null,
      quantity: m.quantity,
      user:
        m.updatedBy?.firstName || m.createdBy?.firstName
          ? `${m.updatedBy?.firstName || m.createdBy?.firstName} ${
              m.updatedBy?.lastName || m.createdBy?.lastName || ""
            }`.trim()
          : "Sistema",
      createdAt: m.createdAt,
    }));

    return successResponse(res, 200, "Dashboard profesional obtenido", {
      summary: inventorySummary,
      topStocked,
      lowStockItems,
      recentMovements: formattedMovements,
    });
  } catch (error) {
    console.error("❌ Error obteniendo dashboard:", error);
    return errorResponse(res, 500, "Error al obtener dashboard", error);
  }
};
