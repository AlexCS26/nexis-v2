/**
 * @fileoverview Rutas de variantes para usuarios normales
 * @module user/routes/variantUserRoutes
 */

const express = require("express");
const router = express.Router();
const variantController = require("../controllers/variantController");

// 🔹 Rutas públicas: list, get by id y search

/**
 * @desc Listar variantes activas por producto y tienda
 * @route GET /api/v1/variants
 * @access Public
 */
router.get("/", variantController.listVariants);

/**
 * @desc Obtener una variante por ID
 * @route GET /api/v1/variants/:id
 * @access Public
 */
router.get("/:id", variantController.getVariantById);

/**
 * @desc Buscar variantes por nombre, SKU o barcode
 * @route GET /api/v1/variants/search
 * @access Public
 */
router.get("/search", variantController.searchVariants);

module.exports = router;
