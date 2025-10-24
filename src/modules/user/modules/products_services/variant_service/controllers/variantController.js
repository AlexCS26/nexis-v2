/**
 * @fileoverview Controlador de variantes para usuarios normales
 * @module user/controllers/variantController
 */

const Variant = require("../models/variant.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../../core/utils/responseUtils");

/**
 * @desc Listar variantes activas por producto y tienda
 * @route GET /api/v1/variants
 * @access Public
 */
exports.listVariants = async (req, res) => {
  try {
    const { product, store } = req.query;

    if (!product) return errorResponse(res, 400, "Product ID is required");

    const query = {
      product,
      status: "ACTIVE",
    };

    if (store) query.store = store;

    const variants = await Variant.find(query)
      .populate("product", "name code")
      .populate("store", "name code")
      .select(
        "name sku barcode attributes stock salePrice discountPrice images"
      );

    return successResponse(res, variants, "Variants fetched successfully");
  } catch (error) {
    console.error("Error fetching variants:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/**
 * @desc Obtener una variante por ID
 * @route GET /api/v1/variants/:id
 * @access Public
 */
exports.getVariantById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) return errorResponse(res, 400, "Variant ID is required");

    const variant = await Variant.findById(id)
      .populate("product", "name code")
      .populate("store", "name code")
      .select(
        "name sku barcode attributes stock salePrice discountPrice images status"
      );

    if (!variant || variant.status !== "ACTIVE")
      return errorResponse(res, 404, "Variant not found");

    return successResponse(res, variant, "Variant retrieved successfully");
  } catch (error) {
    console.error("Error fetching variant by ID:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/**
 * @desc Buscar variantes por nombre, SKU o barcode
 * @route GET /api/v1/variants/search
 * @access Public
 */
exports.searchVariants = async (req, res) => {
  try {
    const { q, product, store } = req.query;

    if (!q) return errorResponse(res, 400, "Search query is required");

    const query = {
      status: "ACTIVE",
      $or: [
        { name: new RegExp(q, "i") },
        { sku: new RegExp(q, "i") },
        { barcode: new RegExp(q, "i") },
      ],
    };

    if (product) query.product = product;
    if (store) query.store = store;

    const variants = await Variant.find(query)
      .populate("product", "name code")
      .populate("store", "name code")
      .select(
        "name sku barcode attributes stock salePrice discountPrice images"
      );

    return successResponse(res, variants, "Variants search results");
  } catch (error) {
    console.error("Error searching variants:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};
