/**
 * @fileoverview Rutas de inventario para usuarios (cajeros / vendedores)
 * @module user/routes/inventoryUserRoutes
 * @description Permite listar, consultar y visualizar el inventario de la tienda del usuario autenticado.
 */

const express = require("express");
const router = express.Router();
const inventoryUserController = require("../controllers/inventoryUserController");
const { verifyToken } = require("@middlewares/protect");
/* =========================================================
 * INVENTORY ROUTES (USER LEVEL)
 * ========================================================= */

/**
 * @desc Obtener dashboard de inventario (KPIs + top productos + movimientos)
 * @route GET /api/v1/user/inventory/dashboard
 * @access Private (User)
 */
router.get(
  "/dashboard",
  verifyToken,
  inventoryUserController.getInventoryDashboard
);

/**
 * @desc Obtener resumen general del inventario (simplificado)
 * @route GET /api/v1/user/inventory/summary
 * @access Private (User)
 */
router.get(
  "/summary",
  verifyToken,
  inventoryUserController.getInventorySummary
);

/**
 * @desc Listar productos con bajo stock
 * @route GET /api/v1/user/inventory/low-stock
 * @access Private (User)
 */
router.get("/low-stock", verifyToken, inventoryUserController.getLowStock);

/**
 * @desc Obtener los últimos movimientos de inventario
 * @route GET /api/v1/user/inventory/movements/recent
 * @access Private (User)
 */
router.get(
  "/movements/recent",
  verifyToken,
  inventoryUserController.getRecentMovements
);

/**
 * @desc Obtener lista completa del inventario del usuario
 * @route GET /api/v1/user/inventory
 * @access Private (User)
 */
router.get("/", verifyToken, inventoryUserController.listInventory);

/**
 * @desc Obtener detalle de un producto o variante del inventario
 * ⚠️ Nota: esta ruta debe ir al final, porque usa un parámetro dinámico (:id)
 * @route GET /api/v1/user/inventory/:id
 * @access Private (User)
 */
router.get("/:id", verifyToken, inventoryUserController.getInventoryItem);

module.exports = router;
