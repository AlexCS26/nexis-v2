/**
 * @fileoverview Rutas de administración de usuarios para managers.
 * @module admin/routes/userManagerRoutes
 */

const express = require("express");
const router = express.Router();
const managerUserController = require("../controllers/userManagerController");
const {
  verifyManagerToken,
  hasPermission,
} = require("../../../../../middlewares/protect");

/**
 * @desc Obtener todos los usuarios (con filtros, búsqueda y paginación)
 * @route GET /api/v1/manager/users
 * @access Private (Manager)
 */
router.get(
  "/",
  verifyManagerToken,
  hasPermission("USERS_VIEW"),
  managerUserController.getAllUsers
);

/**
 * @desc Obtener un usuario por ID
 * @route GET /api/v1/manager/users/:id
 * @access Private (Manager)
 */
router.get(
  "/:id",
  verifyManagerToken,
  hasPermission("USERS_VIEW"),
  managerUserController.getUserById
);

/**
 * @desc Crear un nuevo usuario
 * @route POST /api/v1/manager/users
 * @access Private (Manager)
 */
router.post(
  "/",
  verifyManagerToken,
  hasPermission("USERS_CREATE"),
  managerUserController.createUser
);

/**
 * @desc Actualizar usuario existente
 * @route PUT /api/v1/manager/users/:id
 * @access Private (Manager)
 */
router.put(
  "/:id",
  verifyManagerToken,
  hasPermission("USERS_EDIT"),
  managerUserController.updateUser
);

/**
 * @desc Cambiar estado del usuario
 * @route PATCH /api/v1/manager/users/:id/status
 * @access Private (Manager)
 */
router.patch(
  "/:id/status",
  verifyManagerToken,
  hasPermission("USERS_EDIT"),
  managerUserController.updateStatus
);

/**
 * @desc Eliminar usuario
 * @route DELETE /api/v1/manager/users/:id
 * @access Private (Manager)
 */
router.delete(
  "/:id",
  verifyManagerToken,
  hasPermission("USERS_DELETE"),
  managerUserController.deleteUser
);

module.exports = router;
