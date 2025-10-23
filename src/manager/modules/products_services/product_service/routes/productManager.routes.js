/**
 * @fileoverview Rutas de administración de productos para managers.
 * @module admin/routes/productManagerRoutes
 */

const express = require("express");
const router = express.Router();
const managerProductController = require("../controllers/productManagerController");
const {
  verifyManagerToken,
  hasPermission,
} = require("../../../../../middlewares/protect");

/**
 * @desc Listar todos los productos con filtros, búsqueda y paginación
 * @route GET /api/v1/manager/products
 * @access Private (Manager)
 */
router.get(
  "/",
  verifyManagerToken,
  hasPermission("PRODUCTS_VIEW"),
  managerProductController.listProducts
);

/**
 * @desc Obtener un producto por ID
 * @route GET /api/v1/manager/products/:id
 * @access Private (Manager)
 */
router.get(
  "/:id",
  verifyManagerToken,
  hasPermission("PRODUCTS_VIEW"),
  managerProductController.getProductById
);

/**
 * @desc Crear un nuevo producto
 * @route POST /api/v1/manager/products
 * @access Private (Manager)
 */
router.post(
  "/",
  verifyManagerToken,
  hasPermission("PRODUCTS_CREATE"),
  managerProductController.createProduct
);

/**
 * @desc Actualizar un producto existente
 * @route PUT /api/v1/manager/products/:id
 * @access Private (Manager)
 */
router.put(
  "/:id",
  verifyManagerToken,
  hasPermission("PRODUCTS_EDIT"),
  managerProductController.updateProduct
);

/**
 * @desc Cambiar estado de un producto (ACTIVE / INACTIVE / DISCONTINUED)
 * @route PATCH /api/v1/manager/products/:id/status
 * @access Private (Manager)
 */
router.patch(
  "/:id/status",
  verifyManagerToken,
  hasPermission("PRODUCTS_EDIT"),
  managerProductController.updateStatus
);

/**
 * @desc Eliminar un producto
 * @route DELETE /api/v1/manager/products/:id
 * @access Private (Manager)
 */
router.delete(
  "/:id",
  verifyManagerToken,
  hasPermission("PRODUCTS_DELETE"),
  managerProductController.deleteProduct
);

module.exports = router;
