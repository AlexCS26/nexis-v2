/**
 * @fileoverview Controlador del catálogo público de productos (E-commerce)
 * @module ecommerce/modules/products_service/controllers/product.controller
 * @description Controlador optimizado del catálogo público, con soporte SEO, búsqueda avanzada, listados destacados y estructura profesional.
 */

const Product = require("@user/modules/products_services/product_service/models/product.model");
const { successResponse, errorResponse } = require("@core/utils/responseUtils");

/**
 * @desc Listar productos activos (catálogo público principal)
 * @route GET /api/v1/ecommerce/products
 * @access Public
 */
exports.listCatalog = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      sort = "newest",
    } = req.query;

    const filters = { status: "ACTIVE" };

    if (category) filters.category = category;
    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      price_asc: { salePrice: 1 },
      price_desc: { salePrice: -1 },
      popular: { "meta.salesCount": -1 },
      rating: { "rating.average": -1 },
    }[sort] || { createdAt: -1 };

    const products = await Product.find(filters)
      .select(
        "name slug brand salePrice discountPrice rating images category createdAt"
      )
      .populate("category", "name slug")
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(filters);

    const mapped = products.map((p) => {
      const finalPrice =
        p.discountPrice && p.discountPrice < p.salePrice
          ? p.discountPrice
          : p.salePrice;

      const primaryImage =
        p.images?.find((img) => img.isPrimary)?.url ||
        p.images?.[0]?.url ||
        null;

      return {
        id: p._id,
        name: p.name,
        slug: p.slug,
        brand: p.brand || null,
        category: p.category ? p.category.name : null,
        price: {
          sale: p.salePrice,
          discount: p.discountPrice || null,
          formatted: `S/ ${finalPrice.toFixed(2)}`,
        },
        rating: p.rating?.average || 0,
        image: primaryImage,
        createdAt: p.createdAt,
      };
    });

    return successResponse(
      res,
      200,
      "Catálogo público cargado correctamente",
      mapped,
      {
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      }
    );
  } catch (error) {
    console.error("Error listando catálogo público:", error);
    return errorResponse(res, 500, "Error interno del servidor", error);
  }
};

/**
 * @desc Buscar productos por nombre, marca o etiquetas
 * @route GET /api/v1/ecommerce/products/search?q=
 * @access Public
 */
exports.searchProducts = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q)
      return errorResponse(res, 400, "Debe especificar un término de búsqueda");

    const products = await Product.find({
      status: "ACTIVE",
      $or: [
        { name: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ],
    })
      .select("name slug salePrice discountPrice images brand")
      .limit(parseInt(limit))
      .sort({ name: 1 });

    const results = products.map((p) => {
      const finalPrice =
        p.discountPrice && p.discountPrice < p.salePrice
          ? p.discountPrice
          : p.salePrice;

      const primaryImage =
        p.images?.find((img) => img.isPrimary)?.url ||
        p.images?.[0]?.url ||
        null;

      return {
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        price: `S/ ${finalPrice.toFixed(2)}`,
        image: primaryImage,
      };
    });

    return successResponse(res, 200, "Resultados de búsqueda", results);
  } catch (error) {
    console.error("Error buscando productos:", error);
    return errorResponse(res, 500, "Error interno del servidor", error);
  }
};

/**
 * @desc Obtener un producto por slug (SEO / Detalle)
 * @route GET /api/v1/ecommerce/products/:slug
 * @access Public
 */
exports.getBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const product = await Product.findOne({ slug, status: "ACTIVE" })
      .select(
        "name slug description brand tags images salePrice discountPrice stock category variants rating createdAt updatedAt"
      )
      .populate("category", "name slug")
      .populate("variants", "name sku salePrice stock images");

    if (!product) return errorResponse(res, 404, "Producto no encontrado");

    const finalPrice =
      product.discountPrice && product.discountPrice < product.salePrice
        ? product.discountPrice
        : product.salePrice;

    const data = {
      id: product._id,
      name: product.name,
      slug: product.slug,
      brand: product.brand || null,
      description: product.description || null,
      tags: product.tags || [],
      category: product.category ? product.category.name : null,
      price: {
        sale: product.salePrice,
        discount: product.discountPrice || null,
        formatted: `S/ ${finalPrice.toFixed(2)}`,
      },
      rating: product.rating || { average: 0, count: 0 },
      stock: product.stock,
      images: product.images || [],
      variants: product.variants || [],
      seo: {
        title: `${product.name} | Nexis E-commerce`,
        description:
          product.description?.slice(0, 160) ||
          `Compra ${product.name} al mejor precio.`,
        keywords: product.tags?.join(", ") || "",
      },
      timestamps: {
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    };

    return successResponse(res, 200, "Producto obtenido correctamente", data);
  } catch (error) {
    console.error("Error obteniendo producto por slug:", error);
    return errorResponse(res, 500, "Error interno del servidor", error);
  }
};

/**
 * @desc Listar productos destacados, más vendidos o recomendados (automático + curado)
 * @route GET /api/v1/ecommerce/products/featured
 * @access Public
 */
exports.listFeatured = async (req, res) => {
  try {
    // Filtro base
    const filters = { status: "ACTIVE" };

    // Buscar productos destacados o con alto rendimiento
    const products = await Product.find({
      ...filters,
      $or: [
        { "meta.isFeatured": true }, // Curado manualmente
        { "meta.salesCount": { $gt: 20 } }, // Más vendidos
        { "rating.average": { $gte: 4.5 } }, // Muy bien valorados
      ],
    })
      .select(
        "name slug salePrice discountPrice brand images category rating meta"
      )
      .populate("category", "name slug")
      .sort({ "meta.salesCount": -1, rating: -1 })
      .limit(12);

    // Si no hay suficientes, usar fallback (nuevos productos)
    if (products.length < 4) {
      const recent = await Product.find(filters)
        .sort({ createdAt: -1 })
        .limit(8)
        .select(
          "name slug salePrice discountPrice brand images category rating"
        );

      products.push(...recent);
    }

    const formatted = products.map((p) => {
      const finalPrice =
        p.discountPrice && p.discountPrice < p.salePrice
          ? p.discountPrice
          : p.salePrice;

      const image =
        p.images?.find((img) => img.isPrimary)?.url ||
        p.images?.[0]?.url ||
        null;

      return {
        id: p._id,
        name: p.name,
        slug: p.slug,
        brand: p.brand || null,
        category: p.category ? p.category.name : null,
        price: {
          sale: p.salePrice,
          discount: p.discountPrice || null,
          formatted: `S/ ${finalPrice.toFixed(2)}`,
        },
        rating: p.rating?.average || 0,
        sales: p.meta?.salesCount || 0,
        featured: p.meta?.isFeatured || false,
        image,
      };
    });

    return successResponse(
      res,
      200,
      "Productos destacados generados dinámicamente",
      formatted
    );
  } catch (error) {
    console.error("Error generando productos destacados:", error);
    return errorResponse(res, 500, "Error interno del servidor", error);
  }
};
