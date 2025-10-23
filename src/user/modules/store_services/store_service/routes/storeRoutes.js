/**
 * @fileoverview Rutas de tiendas para usuarios normales
 * @module user/routes/storeRoutes
 */

const express = require("express");
const router = express.Router();
const storeController = require("../controllers/storeController");
const { verifyToken } = require("../../../../../middlewares/protect");

/**
 * @desc Listar todas las tiendas activas
 * @route GET /api/v1/stores
 * @access Usuario autenticado
 */
router.get("/", verifyToken, storeController.listStores);

/**
 * @desc Obtener una tienda por ID
 * @route GET /api/v1/stores/:id
 * @access Usuario autenticado
 */
router.get("/:id", verifyToken, storeController.getStoreById);

/**
 * @desc Buscar tiendas por nombre, código o ciudad
 * @route GET /api/v1/stores/search
 * @access Usuario autenticado
 */
router.get("/search", verifyToken, storeController.searchStores);

module.exports = router;
