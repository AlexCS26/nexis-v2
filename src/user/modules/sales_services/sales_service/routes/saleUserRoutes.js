/**
 * @fileoverview Rutas de ventas para usuarios (cajeros / vendedores)
 * @module user/routes/saleUserRoutes
 * @description Define las rutas protegidas de ventas para usuarios autenticados (cajeros, vendedores).
 */

const express = require("express");
const router = express.Router();
const saleUserController = require("../controllers/saleUserController");
const { verifyToken } = require("../../../../../middlewares/protect");

/**
 * @desc Listar ventas del usuario autenticado (por tienda)
 * @route GET /api/v1/user/sales
 * @access Private (User)
 */
router.get("/", verifyToken, saleUserController.listSales);

/**
 * @desc Resumen de ventas para dashboard
 * @route GET /api/v1/user/sales/dashboard
 * @access Private (User)
 */
router.get("/dashboard", verifyToken, saleUserController.getSalesDashboard);

/**
 * @desc Crear una nueva venta (usa cliente genérico si no se envía)
 * @route POST /api/v1/user/sales
 * @access Private (User)
 */
router.post("/", verifyToken, saleUserController.createSale);

/**
 * @desc Obtener una venta específica por ID
 * @route GET /api/v1/user/sales/:id
 * @access Private (User)
 */
router.get("/:id", verifyToken, saleUserController.getSaleById);

/**
 * @desc Anular o cancelar una venta (solo si está pagada)
 * @route PATCH /api/v1/user/sales/:id/cancel
 * @access Private (User)
 */
router.patch("/:id/cancel", verifyToken, saleUserController.cancelSale);

module.exports = router;
