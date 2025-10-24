/**
 * @fileoverview Rutas de tiendas para administradores / manager
 * @module admin/routes/storeManagerRoutes
 */

const express = require("express");
const router = express.Router();
const storeController = require("../controllers/storeManagerController");
const { verifyManagerToken, hasPermission } = require("@middlewares/protect");

// 🔹 Todas las rutas requieren autenticación de manager/admin
router.use(verifyManagerToken);

/**
 * @desc Listar tiendas con filtros y paginación
 * @route GET /api/v1/admin/stores
 */
router.get("/", hasPermission("STORES_VIEW"), storeController.listStores);

/**
 * @desc Crear una nueva tienda
 * @route POST /api/v1/admin/stores
 */
router.post("/", hasPermission("STORES_CREATE"), storeController.createStore);

/**
 * @desc Obtener una tienda por ID
 * @route GET /api/v1/admin/stores/:id
 */
router.get("/:id", hasPermission("STORES_VIEW"), storeController.getStoreById);

/**
 * @desc Actualizar una tienda por ID
 * @route PUT /api/v1/admin/stores/:id
 */
router.put("/:id", hasPermission("STORES_EDIT"), storeController.updateStore);

/**
 * @desc Cambiar estado de la tienda
 * @route PATCH /api/v1/admin/stores/:id/status
 */
router.patch(
  "/:id/status",
  hasPermission("STORES_EDIT"),
  storeController.updateStatus
);

/**
 * @desc Eliminar (soft delete) una tienda
 * @route DELETE /api/v1/admin/stores/:id
 */
router.delete(
  "/:id",
  hasPermission("STORES_DELETE"),
  storeController.deleteStore
);

module.exports = router;
