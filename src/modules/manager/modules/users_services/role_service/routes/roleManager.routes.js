/**
 * @fileoverview Rutas de gestión de roles
 * @module admin/routes/roleManager.routes
 * @description Rutas REST para el CRUD de roles con verificación de token de manager y permisos específicos
 */

const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleManagerController");
const { verifyManagerToken, hasPermission } = require("@middlewares/protect");

// Crear un nuevo rol
router.post(
  "/",
  verifyManagerToken,
  hasPermission("ROLES_CREATE"),
  roleController.createRole
);

// Obtener todos los roles
router.get(
  "/",
  verifyManagerToken,
  hasPermission("ROLES_VIEW"),
  roleController.getRoles
);

// Obtener un rol específico por ID
router.get(
  "/:id",
  verifyManagerToken,
  hasPermission("ROLES_VIEW"),
  roleController.getRoleById
);

// Actualizar un rol por ID
router.put(
  "/:id",
  verifyManagerToken,
  hasPermission("ROLES_EDIT"),
  roleController.updateRole
);

// Eliminar un rol por ID
router.delete(
  "/:id",
  verifyManagerToken,
  hasPermission("ROLES_DELETE"),
  roleController.deleteRole
);

module.exports = router;
