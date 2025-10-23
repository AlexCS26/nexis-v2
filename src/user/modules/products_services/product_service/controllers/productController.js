/**
 * @fileoverview Controlador de productos para usuarios normales
 * @module user/controllers/productController
 */

const Product = require("../models/product.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../utils/responseUtils");

/**
 * @desc Listar productos activos con búsqueda extendida profesional (producto + variantes)
 * @route GET /api/v1/products
 * @access Public
 */
exports.listProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;

    const matchStage = { status: "ACTIVE" };

    if (category) matchStage.category = category;

    // 🔹 Filtro de búsqueda extendido — productos y variantes
    const searchFilter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { sku: { $regex: search, $options: "i" } },
            { barcode: { $regex: search, $options: "i" } },
            { "variantsData.name": { $regex: search, $options: "i" } },
            { "variantsData.sku": { $regex: search, $options: "i" } },
            { "variantsData.barcode": { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const pipeline = [
      { $match: matchStage },

      // 🔸 Traer datos de categoría
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

      // 🔸 Unir variantes activas
      {
        $lookup: {
          from: "variants",
          localField: "variants",
          foreignField: "_id",
          as: "variantsData",
          pipeline: [
            { $match: { status: "ACTIVE" } },
            {
              $project: {
                name: 1,
                sku: 1,
                barcode: 1,
                attributes: 1,
                stock: 1,
                salePrice: 1,
                costPrice: 1,
                discountPrice: 1,
              },
            },
          ],
        },
      },

      // 🔹 Aplicar búsqueda extendida (producto o variante)
      ...(search ? [{ $match: searchFilter }] : []),

      // 🔸 Orden, paginación
      { $sort: { name: 1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },

      // 🔸 Limpieza final
      {
        $project: {
          name: 1,
          sku: 1,
          barcode: 1,
          status: 1,
          category: 1,
          stock: 1,
          salePrice: 1,
          discountPrice: 1,
          costPrice: 1,
          variants: "$variantsData",
        },
      },
    ];

    // Ejecutar pipeline optimizado
    const products = await Product.aggregate(pipeline);

    // Total general (solo una vez, sin pipeline pesado)
    const total = await Product.countDocuments(matchStage);

    return successResponse(
      res,
      200,
      "Products retrieved successfully",
      products,
      {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      }
    );
  } catch (error) {
    console.error("❌ Error fetching products:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/**
 * @desc Obtener un producto por ID
 * @route GET /api/v1/products/:id
 * @access Public
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ _id: id, status: "ACTIVE" })
      .populate("category", "name")
      .populate("variants");

    if (!product) {
      return errorResponse(res, 404, "Product not found");
    }

    return successResponse(res, 200, "Product retrieved successfully", product);
  } catch (error) {
    console.error("Error fetching product by ID:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/**
 * @desc Buscar productos por nombre, SKU o barcode
 * @route GET /api/v1/products/search
 * @access Public
 */
exports.searchProducts = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    if (!q) return errorResponse(res, 400, "Search query is required");

    const query = {
      status: "ACTIVE",
      $or: [
        { name: { $regex: q, $options: "i" } },
        { sku: { $regex: q, $options: "i" } },
        { barcode: { $regex: q, $options: "i" } },
      ],
    };

    const products = await Product.find(query)
      .populate("category", "name")
      .populate("variants")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ name: 1 });

    const total = await Product.countDocuments(query);

    return successResponse(res, 200, "Search results", products, {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error searching products:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};
