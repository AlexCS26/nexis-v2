/**
 * @fileoverview Rutas del módulo de perfil de usuario autenticado.
 * @module user/routes/userProfile.routes
 */

const express = require("express");
const router = express.Router();
const profileController = require("../controllers/userController");
const { verifyToken } = require("../../../../../middlewares/protect");

/**
 * @route GET /api/v1/users/me
 * @desc Obtener el perfil del usuario autenticado
 * @access Private
 */
router.get("/me", verifyToken, profileController.getProfile);

/**
 * @route PUT /api/v1/users/me
 * @desc Actualizar el perfil del usuario autenticado
 * @access Private
 */
router.put("/me", verifyToken, profileController.updateProfile);

module.exports = router;
