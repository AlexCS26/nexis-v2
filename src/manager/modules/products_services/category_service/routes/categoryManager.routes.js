/**
 * @fileoverview Rutas de administración de categorías para managers.
 * @module admin/routes/categoryManagerRoutes
 */

const express = require("express");
const router = express.Router();
const managerCategoryController = require("../controllers/categoryManagerController");
const {
  verifyManagerToken,
  hasPermission,
} = require("../../../../../middlewares/protect");

/**
 * @desc Listar todas las categorías con filtros y paginación
 * @route GET /api/v1/manager/categories
 * @access Private (Manager)
 */
router.get(
  "/",
  verifyManagerToken,
  hasPermission("CATEGORIES_VIEW"),
  managerCategoryController.listCategories
);

/**
 * @desc Obtener una categoría por ID
 * @route GET /api/v1/manager/categories/:id
 * @access Private (Manager)
 */
router.get(
  "/:id",
  verifyManagerToken,
  hasPermission("CATEGORIES_VIEW"),
  managerCategoryController.getCategoryById
);

/**
 * @desc Crear una nueva categoría
 * @route POST /api/v1/manager/categories
 * @access Private (Manager)
 */
router.post(
  "/",
  verifyManagerToken,
  hasPermission("CATEGORIES_CREATE"),
  managerCategoryController.createCategory
);

/**
 * @desc Actualizar una categoría existente
 * @route PUT /api/v1/manager/categories/:id
 * @access Private (Manager)
 */
router.put(
  "/:id",
  verifyManagerToken,
  hasPermission("CATEGORIES_EDIT"),
  managerCategoryController.updateCategory
);

/**
 * @desc Cambiar estado de una categoría (ACTIVE / INACTIVE)
 * @route PATCH /api/v1/manager/categories/:id/status
 * @access Private (Manager)
 */
router.patch(
  "/:id/status",
  verifyManagerToken,
  hasPermission("CATEGORIES_EDIT"),
  managerCategoryController.updateStatus
);

/**
 * @desc Eliminar una categoría (soft delete)
 * @route DELETE /api/v1/manager/categories/:id
 * @access Private (Manager)
 */
router.delete(
  "/:id",
  verifyManagerToken,
  hasPermission("CATEGORIES_DELETE"),
  managerCategoryController.deleteCategory
);

module.exports = router;
