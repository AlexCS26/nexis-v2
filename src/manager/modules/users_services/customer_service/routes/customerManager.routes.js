/**
 * @fileoverview Rutas de clientes para administradores / manager
 * @module admin/routes/customerManagerRoutes
 */

const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerManagerController");
const {
  verifyManagerToken,
  hasPermission,
} = require("../../../../../middlewares/protect");

// 🔹 Todas las rutas requieren autenticación de manager/admin
router.use(verifyManagerToken);

/**
 * @desc Listar clientes con filtros y paginación
 * @route GET /api/v1/admin/customers
 */
router.get(
  "/",
  hasPermission("CUSTOMERS_VIEW"),
  customerController.listCustomers
);

/**
 * @desc Crear un nuevo cliente
 * @route POST /api/v1/admin/customers
 */
router.post(
  "/",
  hasPermission("CUSTOMERS_CREATE"),
  customerController.createCustomer
);

/**
 * @desc Obtener un cliente por ID
 * @route GET /api/v1/admin/customers/:id
 */
router.get(
  "/:id",
  hasPermission("CUSTOMERS_VIEW"),
  customerController.getCustomerById
);

/**
 * @desc Actualizar cliente
 * @route PUT /api/v1/admin/customers/:id
 */
router.put(
  "/:id",
  hasPermission("CUSTOMERS_EDIT"),
  customerController.updateCustomer
);

/**
 * @desc Cambiar estado del cliente (ACTIVE / INACTIVE)
 * @route PATCH /api/v1/admin/customers/:id/status
 */
router.patch(
  "/:id/status",
  hasPermission("CUSTOMERS_EDIT"),
  customerController.updateStatus
);

/**
 * @desc Eliminar cliente (soft delete)
 * @route DELETE /api/v1/admin/customers/:id
 */
router.delete(
  "/:id",
  hasPermission("CUSTOMERS_DELETE"),
  customerController.deleteCustomer
);

module.exports = router;
