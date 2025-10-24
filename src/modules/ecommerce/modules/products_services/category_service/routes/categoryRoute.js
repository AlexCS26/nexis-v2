/**
 * @fileoverview Rutas de categorías para usuarios normales
 * @module user/routes/categoryUserRoutes
 */

const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");

// 🔹 Rutas públicas, no requieren token

/**
 * @desc Listar categorías activas y visibles
 * @route GET /api/v1/categories
 * @access Public
 */
router.get("/", categoryController.listCategories);

module.exports = router;
