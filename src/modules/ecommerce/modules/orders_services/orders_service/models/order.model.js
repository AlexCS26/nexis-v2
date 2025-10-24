/**
 * @fileoverview Modelo de pedido (E-commerce)
 * @module ecommerce/modules/orders_service/models/order.model
 * @description Define la estructura de los pedidos generados por clientes en el e-commerce público.
 */

const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    // 🔹 Código del pedido (p. ej. OR-2025-00001)
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // 🔹 Cliente asociado (opcional si es invitado)
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    // 🔹 Información del cliente (en caso de invitado)
    customerInfo: {
      name: String,
      email: String,
      phone: String,
    },

    // 🔹 Dirección de envío
    shippingAddress: {
      street: String,
      city: String,
      region: String,
      postalCode: String,
      country: { type: String, default: "Perú" },
    },

    // 🔹 Productos del pedido
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
          default: null,
        },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        subtotal: { type: Number, required: true, min: 0 },
      },
    ],

    // 🔹 Totales
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },

    // 🔹 Método de pago
    paymentMethod: {
      type: String,
      enum: ["CARD", "TRANSFER", "YAPE", "PLIN", "PAYPAL", "CASH_ON_DELIVERY"],
      default: "CARD",
    },

    // 🔹 Estado del pedido
    status: {
      type: String,
      enum: [
        "PENDING",
        "PAID",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "PENDING",
    },

    // 🔹 Tracking de envío
    tracking: {
      carrier: String,
      trackingNumber: String,
      estimatedDelivery: Date,
    },

    // 🔹 Auditoría
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// 🔹 Índices recomendados
orderSchema.index({ code: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ "customer.email": 1 });

module.exports = mongoose.model("Order", orderSchema);
