/**
 * @fileoverview Rutas de gestión de ventas para administradores / managers
 * @module admin/routes/saleManagerRoutes
 * @description Rutas seguras con control de permisos, auditoría y soporte multi-tienda.
 */

const express = require("express");
const router = express.Router();
const saleManagerController = require("../controllers/saleManagerController");
const { verifyManagerToken, hasPermission } = require("@middlewares/protect");

/**
 * @desc Listar todas las ventas (multi-tienda, con filtros)
 * @route GET /api/v1/admin/sales
 * @access Private (Admin/Manager)
 */
router.get(
  "/",
  verifyManagerToken,
  hasPermission("SALES_VIEW"),
  saleManagerController.listSales
);

/**
 * @desc Obtener una venta por ID
 * @route GET /api/v1/admin/sales/:id
 * @access Private (Admin/Manager)
 */
router.get(
  "/:id",
  verifyManagerToken,
  hasPermission("SALES_VIEW"),
  saleManagerController.getSaleById
);

/**
 * @desc Crear una venta manual (desde panel manager)
 * @route POST /api/v1/admin/sales
 * @access Private (Admin/Manager)
 */
router.post(
  "/",
  verifyManagerToken,
  hasPermission("SALES_CREATE"),
  saleManagerController.createSale
);

/**
 * @desc Anular o cancelar una venta
 * @route PATCH /api/v1/admin/sales/:id/cancel
 * @access Private (Admin/Manager)
 */
router.patch(
  "/:id/cancel",
  verifyManagerToken,
  hasPermission("SALES_CANCEL"),
  saleManagerController.cancelSale
);

/**
 * @desc Obtener resumen de ventas (opcional para dashboard ERP)
 * @route GET /api/v1/admin/sales/summary
 * @access Private (Admin/Manager)
 */
router.get(
  "/summary",
  verifyManagerToken,
  hasPermission("SALES_VIEW"),
  saleManagerController.getSummaryReport
);

module.exports = router;
