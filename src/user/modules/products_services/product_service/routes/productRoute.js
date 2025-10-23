/**
 * @fileoverview Rutas de productos para usuarios autenticados (vendedores, cajeros)
 * @module user/routes/productUserRoutes
 */

const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { verifyToken } = require("../../../../../middlewares/protect");

/**
 * @desc Listar productos activos con filtros y paginación
 * @route GET /api/v1/user/products
 * @access Private (User)
 */
router.get("/", verifyToken, productController.listProducts);

/**
 * @desc Obtener un producto por ID
 * @route GET /api/v1/user/products/:id
 * @access Private (User)
 */
router.get("/:id", verifyToken, productController.getProductById);

/**
 * @desc Buscar productos por nombre, SKU o barcode
 * @route GET /api/v1/user/products/search
 * @access Private (User)
 */
router.get("/search", verifyToken, productController.searchProducts);

module.exports = router;
