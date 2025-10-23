/**
 * @fileoverview Rutas de clientes para usuarios normales
 * @module user/routes/customerRoutes
 */

const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const { verifyToken } = require("../../../../../middlewares/protect");

/**
 * @desc Listar todos los clientes activos
 * @route GET /api/v1/customers
 * @access Usuario autenticado
 */
router.get("/", verifyToken, customerController.listCustomers);

/**
 * @desc Buscar clientes por nombre o documento
 * @route GET /api/v1/customers/search?q=
 * @access Usuario autenticado
 */
router.get("/search", verifyToken, customerController.searchCustomers);

/**
 * @desc Obtener un cliente por ID
 * @route GET /api/v1/customers/:id
 * @access Usuario autenticado
 */
router.get("/:id", verifyToken, customerController.getCustomerById);

/**
 * @desc Crear un nuevo cliente
 * @route POST /api/v1/customers
 * @access Usuario autenticado
 */
router.post("/", verifyToken, customerController.createCustomer);

module.exports = router;
