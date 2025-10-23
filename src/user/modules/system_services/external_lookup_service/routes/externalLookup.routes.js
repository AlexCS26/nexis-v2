/**
 * @fileoverview Rutas de consultas externas (RENIEC / SUNAT)
 * @module system_services/external_lookup_service/routes/externalLookupRoutes
 */

const express = require("express");
const router = express.Router();
const controller = require("../controllers/externalLookupController");
const { verifyToken } = require("../../../../../middlewares/protect");

/**
 * @desc Consultar datos externos por tipo y número (DNI / RUC)
 * @route GET /api/v1/external/lookup?type=dni&number=46027897
 * @access Usuario autenticado
 */
router.get("/lookup", verifyToken, controller.lookupByDocument);

module.exports = router;
