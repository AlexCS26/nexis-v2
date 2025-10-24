/**
 * @fileoverview Rutas públicas del catálogo de productos (E-commerce)
 * @module ecommerce/modules/products_service/routes/product.routes
 * @description Define las rutas del catálogo público de productos visibles para los clientes del e-commerce.
 *              Incluye endpoints optimizados para SEO, búsqueda avanzada y listados destacados.
 */

const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller.js");

/**
 * @desc Listar productos activos del catálogo público
 * @route GET /api/v1/ecommerce/products
 * @access Public
 */
router.get("/", productController.listCatalog);

/**
 * @desc Buscar productos por nombre, marca o etiquetas
 * @route GET /api/v1/ecommerce/products/search?q=
 * @access Public
 */
router.get("/search", productController.searchProducts);

/**
 * @desc Listar productos destacados, recomendados o más vendidos
 * @route GET /api/v1/ecommerce/products/featured
 * @access Public
 */
router.get("/featured", productController.listFeatured);

/**
 * @desc Obtener detalle de un producto por slug (SEO-friendly)
 * @route GET /api/v1/ecommerce/products/:slug
 * @access Public
 */
router.get("/:slug", productController.getBySlug);

module.exports = router;
