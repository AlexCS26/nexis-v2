const Category = require("../models/category.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../../core/utils/responseUtils");

/**
 * Listar categorías activas y visibles
 * GET /api/v1/categories
 */
exports.listCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      status: "ACTIVE",
      isVisible: true,
    })
      .sort({ name: 1 })
      .select("name code description"); // Solo campos necesarios

    return successResponse(
      res,
      200,
      "Categorías obtenidas correctamente",
      categories
    );
  } catch (error) {
    return errorResponse(res, 500, "Error al obtener las categorías", error);
  }
};
