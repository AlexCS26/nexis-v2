/**
 * @fileoverview Rutas de gestión de permisos
 * @module admin/routes/permissionManager.routes
 * @description Define las rutas REST para CRUD de permisos con verificación de autenticación y permisos de administrador
 */

const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionManagerController");
const {
  verifyManagerToken,
  hasPermission,
} = require("../../../../../../core/middlewares/protect");

// Crear permiso
router.post(
  "/",
  verifyManagerToken,
  hasPermission("PERMISSIONS_CREATE"),
  permissionController.createPermission
);

// Obtener todos los permisos
router.get(
  "/",
  verifyManagerToken,
  hasPermission("PERMISSIONS_VIEW"),
  permissionController.getPermissions
);

// Obtener permiso por ID
router.get(
  "/:id",
  verifyManagerToken,
  hasPermission("PERMISSIONS_VIEW"),
  permissionController.getPermissionById
);

// Actualizar permiso
router.put(
  "/:id",
  verifyManagerToken,
  hasPermission("PERMISSIONS_EDIT"),
  permissionController.updatePermission
);

// Eliminar permiso
router.delete(
  "/:id",
  verifyManagerToken,
  hasPermission("PERMISSIONS_DELETE"),
  permissionController.deletePermission
);

module.exports = router;
