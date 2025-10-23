/**
 * @fileoverview Rutas de inventario para managers / administradores
 * @module manager/routes/inventoryManagerRoutes
 * @description Permite listar, auditar y analizar inventarios en múltiples tiendas.
 */

const express = require("express");
const router = express.Router();
const inventoryManagerController = require("../controllers/inventoryManagerController");
const {
  verifyManagerToken,
  hasPermission,
} = require("../../../../../middlewares/protect");

/* =========================================================
 * INVENTORY ROUTES (MANAGER LEVEL)
 * ========================================================= */

/**
 * @desc Listar inventarios globales o por tienda
 * @route GET /api/v1/manager/inventory
 * @access Private (Manager)
 */
router.get(
  "/",
  verifyManagerToken,
  hasPermission("INVENTORY_VIEW"),
  inventoryManagerController.listInventories
);

/**
 * @desc Obtener resumen global de inventarios (todas las tiendas)
 * @route GET /api/v1/manager/inventory/summary
 * @access Private (Manager)
 */
router.get(
  "/summary",
  verifyManagerToken,
  hasPermission("INVENTORY_SUMMARY_VIEW"),
  inventoryManagerController.getGlobalSummary
);

/**
 * @desc Obtener valoración del inventario (costos y valor total)
 * @route GET /api/v1/manager/inventory/valuation
 * @access Private (Manager)
 */
router.get(
  "/valuation",
  verifyManagerToken,
  hasPermission("INVENTORY_VALUATION_VIEW"),
  inventoryManagerController.getInventoryValuation
);

/**
 * @desc Obtener rotación de stock (productos más vendidos / con más movimientos)
 * @route GET /api/v1/manager/inventory/rotation
 * @access Private (Manager)
 */
router.get(
  "/rotation",
  verifyManagerToken,
  hasPermission("INVENTORY_ROTATION_VIEW"),
  inventoryManagerController.getStockRotation
);

/**
 * @desc Obtener alertas globales de inventario (bajo, agotado, sobrestock)
 * @route GET /api/v1/manager/inventory/alerts
 * @access Private (Manager)
 */
router.get(
  "/alerts",
  verifyManagerToken,
  hasPermission("INVENTORY_ALERTS_VIEW"),
  inventoryManagerController.getInventoryAlerts
);

/**
 * @desc Obtener histórico de movimientos de inventario (con filtros)
 * @route GET /api/v1/manager/inventory/movements
 * @access Private (Manager)
 */
router.get(
  "/movements",
  verifyManagerToken,
  hasPermission("INVENTORY_MOVEMENTS_VIEW"),
  inventoryManagerController.getMovementsHistory
);

/**
 * @desc Ajustar manualmente el stock (entrada o salida)
 * @route PATCH /api/v1/manager/inventory/adjust
 * @access Private (Manager)
 */
router.patch(
  "/adjust",
  verifyManagerToken,
  hasPermission("INVENTORY_ADJUST"),
  inventoryManagerController.adjustStock
);

module.exports = router;
