/**
 * @fileoverview Controlador de pedidos (E-commerce)
 * @module @ecommerce/modules/orders_service/controllers/order.controller
 * @description Controlador profesional para gestionar pedidos del e-commerce.
 * Basado en usuarios autenticados (Customer), sin búsquedas por email.
 * Incluye creación, obtención, listado del usuario y actualización de estado.
 */

const mongoose = require("mongoose");
const Order = require("../models/order.model");
const Product = require("@user/modules/products_services/product_service/models/product.model");
const Variant = require("@user/modules/products_services/variant_service/models/variant.model");
const Customer = require("@user/modules/customers_services/customer_service/models/customer.model");
const Counter = require("@manager/modules/system_services/counter_service/models/counter.model");
const {
  registerMovementAndUpdateInventory,
} = require("@core/utils/inventoryUtils");
const { successResponse, errorResponse } = require("@core/utils/responseUtils");

const IGV_RATE = 0.18;

/* ==========================================================
   🧾 Crear nuevo pedido (checkout autenticado)
   POST /api/v1/ecommerce/orders
   ========================================================== */
exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const {
        items,
        shippingAddress,
        paymentMethod,
        shippingCost = 0,
      } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error("Debe incluir al menos un producto en el pedido.");
      }

      const userId = req.user?.id;
      if (!userId) {
        throw new Error("Debe iniciar sesión para realizar un pedido.");
      }

      const customer = await Customer.findById(userId).session(session);
      if (!customer || customer.status !== "ACTIVE") {
        throw new Error("Cliente no válido o inactivo.");
      }

      // 🔢 Generar código secuencial
      const orderCode = await Counter.getNextSequence(
        "OR",
        "ECOMMERCE",
        session
      );

      let subtotal = 0;
      const processedItems = [];

      // 📦 Procesar productos
      for (const item of items) {
        const variantId = item.variant || null;
        const variant = variantId
          ? await Variant.findById(variantId).session(session)
          : null;
        const product = variant
          ? await Product.findById(variant.product).session(session)
          : await Product.findById(item.product).session(session);

        if (!product)
          throw new Error(`Producto no encontrado (${item.product})`);
        if (item.quantity <= 0)
          throw new Error(`Cantidad inválida para ${product.name}`);

        const unitPrice = variant?.salePrice ?? product.salePrice;
        const itemSubtotal = unitPrice * item.quantity;
        subtotal += itemSubtotal;

        processedItems.push({
          product: product._id,
          variant: variant?._id || null,
          name: variant ? `${product.name} (${variant.name})` : product.name,
          quantity: item.quantity,
          unitPrice,
          subtotal: itemSubtotal,
        });

        // Actualizar inventario
        await registerMovementAndUpdateInventory({
          type: "OUT",
          reason: "ORDER",
          productId: product._id,
          variantId: variant?._id || null,
          quantity: item.quantity,
          reference: orderCode,
          note: `Pedido e-commerce ${orderCode}`,
          userId,
          session,
        });

        // Incrementar contador de ventas
        await Product.findByIdAndUpdate(
          product._id,
          { $inc: { "meta.salesCount": item.quantity } },
          { session }
        );
      }

      // 💰 Calcular totales e impuestos
      const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
      const pricesIncludeTax = true;

      let base = 0,
        tax = 0,
        total = 0;

      if (pricesIncludeTax) {
        base = subtotal / (1 + IGV_RATE);
        tax = subtotal - base;
        total = subtotal + shippingCost;
      } else {
        base = subtotal;
        tax = subtotal * IGV_RATE;
        total = subtotal + tax + shippingCost;
      }

      base = round2(base);
      tax = round2(tax);
      total = round2(total);
      subtotal = round2(subtotal);

      // 🧾 Crear pedido
      const [newOrder] = await Order.create(
        [
          {
            code: orderCode,
            customer: customer._id,
            shippingAddress,
            items: processedItems,
            subtotal,
            shippingCost,
            tax,
            total,
            paymentMethod,
            status: "PENDING",
          },
        ],
        { session }
      );

      req.newOrderId = newOrder._id;
    });

    const order = await Order.findById(req.newOrderId)
      .populate("customer", "firstName lastName email phone")
      .populate("items.product", "name slug images");

    return successResponse(res, 201, "Pedido registrado correctamente", order);
  } catch (error) {
    console.error("Error creando pedido:", error);
    return errorResponse(
      res,
      500,
      error.message || "Error al crear pedido",
      error
    );
  } finally {
    await session.endSession();
  }
};

/* ==========================================================
   🔍 Obtener pedido por código
   GET /api/v1/ecommerce/orders/:code
   ========================================================== */
exports.getOrderByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user?.id;

    const order = await Order.findOne({ code, customer: userId })
      .populate("customer", "firstName lastName email phone")
      .populate("items.product", "name slug images")
      .populate("items.variant", "name");

    if (!order)
      return errorResponse(res, 404, "Pedido no encontrado o no autorizado");

    return successResponse(res, 200, "Pedido obtenido correctamente", order);
  } catch (error) {
    console.error("Error obteniendo pedido:", error);
    return errorResponse(res, 500, "Error interno al obtener pedido", error);
  }
};

/* ==========================================================
   📋 Listar pedidos del usuario autenticado
   GET /api/v1/ecommerce/orders/my
   ========================================================== */
exports.listMyOrders = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 401, "Debe iniciar sesión.");

    const orders = await Order.find({ customer: userId })
      .sort({ createdAt: -1 })
      .populate("items.product", "name slug images")
      .select("code total status createdAt");

    return successResponse(res, 200, "Pedidos del cliente obtenidos", orders);
  } catch (error) {
    console.error("Error listando pedidos del cliente:", error);
    return errorResponse(res, 500, "Error al listar pedidos", error);
  }
};

/* ==========================================================
   🚚 Actualizar estado del pedido
   PATCH /api/v1/ecommerce/orders/:code/status
   ========================================================== */
exports.updateStatus = async (req, res) => {
  try {
    const { code } = req.params;
    const { status } = req.body;

    const validStatuses = [
      "PENDING",
      "PAID",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ];

    if (!validStatuses.includes(status)) {
      return errorResponse(res, 400, "Estado inválido.");
    }

    const order = await Order.findOneAndUpdate(
      { code },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!order) return errorResponse(res, 404, "Pedido no encontrado");

    return successResponse(res, 200, "Estado del pedido actualizado", order);
  } catch (error) {
    console.error("Error actualizando estado del pedido:", error);
    return errorResponse(
      res,
      500,
      "Error al actualizar estado del pedido",
      error
    );
  }
};
