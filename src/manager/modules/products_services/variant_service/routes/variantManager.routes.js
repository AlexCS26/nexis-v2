/**
 * @fileoverview Rutas de variantes para administradores / manager
 * @module admin/routes/variantManagerRoutes
 */

const express = require("express");
const router = express.Router();
const variantController = require("../controllers/variantManagerController");
const {
  verifyManagerToken,
  hasPermission,
} = require("../../../../../middlewares/protect");

/**
 * @desc Listar todas las variantes con filtros y paginación
 * @route GET /api/v1/admin/variants
 * @access Private (Manager/Admin)
 */
router.get(
  "/",
  verifyManagerToken,
  hasPermission("VARIANTS_VIEW"),
  variantController.listVariants
);

/**
 * @desc Crear una nueva variante
 * @route POST /api/v1/admin/variants
 * @access Private (Manager/Admin)
 */
router.post(
  "/",
  verifyManagerToken,
  hasPermission("VARIANTS_CREATE"),
  variantController.createVariant
);

/**
 * @desc Obtener una variante por ID
 * @route GET /api/v1/admin/variants/:id
 * @access Private (Manager/Admin)
 */
router.get(
  "/:id",
  verifyManagerToken,
  hasPermission("VARIANTS_VIEW"),
  variantController.getVariantById
);

/**
 * @desc Actualizar una variante por ID
 * @route PUT /api/v1/admin/variants/:id
 * @access Private (Manager/Admin)
 */
router.put(
  "/:id",
  verifyManagerToken,
  hasPermission("VARIANTS_EDIT"),
  variantController.updateVariant
);

/**
 * @desc Cambiar estado de la variante
 * @route PATCH /api/v1/admin/variants/:id/status
 * @access Private (Manager/Admin)
 */
router.patch(
  "/:id/status",
  verifyManagerToken,
  hasPermission("VARIANTS_EDIT"),
  variantController.updateStatus
);

/**
 * @desc Eliminar (soft delete) una variante
 * @route DELETE /api/v1/admin/variants/:id
 * @access Private (Manager/Admin)
 */
router.delete(
  "/:id",
  verifyManagerToken,
  hasPermission("VARIANTS_DELETE"),
  variantController.deleteVariant
);

module.exports = router;
