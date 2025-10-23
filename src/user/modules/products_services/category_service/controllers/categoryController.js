const Category = require("../models/category.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../utils/responseUtils");

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
      .select("name code description"); // campos necesarios

    return successResponse(res, categories, "Categories fetched successfully");
  } catch (error) {
    return errorResponse(res, error, "Error fetching categories");
  }
};
