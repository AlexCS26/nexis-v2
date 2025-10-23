/**
 * @fileoverview Controlador de tiendas para usuarios normales
 * @module user/controllers/storeController
 */

const Store = require("../models/store.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../utils/responseUtils");

/**
 * @desc Listar todas las tiendas activas
 * @route GET /api/v1/stores
 * @access Public
 */
exports.listStores = async (req, res) => {
  try {
    const stores = await Store.find({ status: "ACTIVE" })
      .sort({ name: 1 })
      .select("code name description address phone email isMain");

    return successResponse(res, stores, "Stores fetched successfully");
  } catch (error) {
    console.error("Error fetching stores:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/**
 * @desc Obtener una tienda por ID
 * @route GET /api/v1/stores/:id
 * @access Public
 */
exports.getStoreById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) return errorResponse(res, 400, "Store ID is required");

    const store = await Store.findById(id).select(
      "code name description address phone email isMain status"
    );

    if (!store || store.status !== "ACTIVE")
      return errorResponse(res, 404, "Store not found");

    return successResponse(res, store, "Store retrieved successfully");
  } catch (error) {
    console.error("Error fetching store by ID:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/**
 * @desc Buscar tiendas por nombre, código o ciudad
 * @route GET /api/v1/stores/search
 * @access Public
 */
exports.searchStores = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) return errorResponse(res, 400, "Search query is required");

    const query = {
      status: "ACTIVE",
      $or: [
        { name: new RegExp(q, "i") },
        { code: new RegExp(q, "i") },
        { "address.city": new RegExp(q, "i") },
      ],
    };

    const stores = await Store.find(query)
      .sort({ name: 1 })
      .select("code name description address phone email isMain");

    return successResponse(res, stores, "Store search results");
  } catch (error) {
    console.error("Error searching stores:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};
