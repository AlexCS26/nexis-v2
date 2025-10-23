/**
 * @fileoverview Rutas de gestión de sesiones de usuario
 * @module routes/sessionRoutes
 */

const express = require("express");
const router = express.Router();
const sessionController = require("../controllers/sessionController");
const { verifyToken } = require("../../../../../middlewares/protect");

/* ============================
 * RUTAS DE SESIONES
 * ============================ */

/**
 * Listar todas las sesiones activas del usuario
 * GET /api/v1/sessions
 */
router.get("/", verifyToken, sessionController.listUserSessions);

/**
 * Cerrar una sesión específica
 * POST /api/v1/sessions/logout
 */
router.post("/logout", verifyToken, sessionController.logoutSession);

/**
 * Cerrar todas las demás sesiones del usuario
 * POST /api/v1/sessions/logout-all
 */
router.post("/logout-all", verifyToken, sessionController.logoutAllSessions);

/**
 * Verificar sesión actual
 * GET /api/v1/sessions/verify
 */
router.get("/verify", verifyToken, sessionController.verifySessionEndpoint);

module.exports = router;
