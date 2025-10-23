/**
 * @fileoverview Rutas de autenticación para gerencia/admin
 * @module admin/routes/managerAuth.routes
 */

const express = require("express");
const router = express.Router();
const authManagerController = require("../controllers/authManagerController");
const { verifyManagerToken } = require("../../../../../middlewares/protect");

/**
 * @route POST /api/v1/manager/login
 * @desc Login gerencia/admin
 * @access Public
 */
router.post("/login", authManagerController.loginManager);

/**
 * @route POST /api/v1/manager/refresh
 * @desc Renovar token gerencial
 * @access Public (requiere persistentToken)
 */
router.post("/refresh", authManagerController.refreshManagerToken);

/**
 * @route POST /api/v1/manager/logout
 * @desc Cerrar sesión gerencial
 * @access Private
 */
router.post("/logout", verifyManagerToken, authManagerController.logoutManager);

module.exports = router;
