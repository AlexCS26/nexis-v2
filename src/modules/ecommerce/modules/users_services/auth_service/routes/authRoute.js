/**
 * @fileoverview Rutas de autenticación de usuarios.
 * @module user/routes/authRoutes
 * @description Define los endpoints públicos de autenticación: login, refresh y logout.
 */

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyToken } = require("@middlewares/protect");
// ===============================================================
// Endpoints de autenticación
// ===============================================================

// Iniciar sesión
router.post("/login", authController.login);

// Renovar token de acceso
router.post("/refresh-token", authController.refreshToken);

// Cerrar sesión (solo con token válido)
router.post("/logout", verifyToken, authController.logout);

module.exports = router;
