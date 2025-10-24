/**
 * @fileoverview Rutas de pedidos (E-commerce)
 * @module @ecommerce/modules/orders_service/routes/order.routes
 * @description Define las rutas seguras para el flujo de pedidos del e-commerce.
 * Incluye creación (checkout), obtención, listado del usuario autenticado y actualización de estado.
 */

const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const { verifyToken } = require("@middlewares/protect");

/* ==========================================================
   🧾 Crear nuevo pedido (Checkout autenticado)
   POST /api/v1/ecommerce/orders
   ========================================================== */
/**
 * @desc Crear un nuevo pedido del e-commerce (requiere sesión activa)
 * @route POST /api/v1/ecommerce/orders
 * @access Private (User)
 */
router.post("/", verifyToken, orderController.createOrder);

/* ==========================================================
   📋 Listar pedidos del usuario autenticado
   GET /api/v1/ecommerce/orders/my
   ========================================================== */
/**
 * @desc Listar todos los pedidos del usuario autenticado
 * @route GET /api/v1/ecommerce/orders/my
 * @access Private (User)
 */
router.get("/my", verifyToken, orderController.listMyOrders);

/* ==========================================================
   🔍 Obtener detalle de pedido por código
   GET /api/v1/ecommerce/orders/:code
   ========================================================== */
/**
 * @desc Obtener detalle de un pedido por su código (solo si pertenece al usuario)
 * @route GET /api/v1/ecommerce/orders/:code
 * @access Private (User)
 */
router.get("/:code", verifyToken, orderController.getOrderByCode);

/* ==========================================================
   🚚 Actualizar estado del pedido
   PATCH /api/v1/ecommerce/orders/:code/status
   ========================================================== */
/**
 * @desc Actualizar estado del pedido (solo para pasarela o sistema interno)
 * @route PATCH /api/v1/ecommerce/orders/:code/status
 * @access Private (Admin / System)
 */
router.patch("/:code/status", orderController.updateStatus);

module.exports = router;
