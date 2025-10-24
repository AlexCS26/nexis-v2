const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    // 🔹 Código o número de venta
    code: {
      type: String,
      required: [true, "Sale code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9\-]+$/, "Invalid sale code format"], // Ej: SL-0001
    },

    // 🔹 Tienda donde se realizó la venta
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: [true, "Store is required"],
    },

    // 🔹 Cliente (opcional si es venta directa)
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer", // puedes crear un modelo Customer similar
      default: null,
    },

    // 🔹 Tipo de comprobante
    documentType: {
      type: String,
      enum: ["BOLETA", "FACTURA", "TICKET"],
      default: "BOLETA",
    },

    // 🔹 Serie y correlativo (útil en Perú)
    series: { type: String, trim: true },
    number: { type: Number },

    // 🔹 Detalles de los productos vendidos
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: [true, "Product is required"],
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
          default: null,
        },
        name: { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        discount: { type: Number, default: 0, min: 0 },
        subtotal: { type: Number, required: true, min: 0 },
      },
    ],

    // 🔹 Totales financieros
    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be negative"],
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, "Tax cannot be negative"],
    },
    total: {
      type: Number,
      required: true,
      min: [0, "Total cannot be negative"],
    },

    // 🔹 Método de pago
    paymentMethod: {
      type: String,
      enum: ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "YAPE", "PLIN", "OTRO"],
      default: "EFECTIVO",
    },

    // 🔹 Estado de la venta
    status: {
      type: String,
      enum: ["DRAFT", "PAID", "CANCELLED"],
      default: "PAID",
      uppercase: true,
    },

    // 🔹 Auditoría
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // 🔹 Eliminación lógica
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

saleSchema.methods.toJSON = function () {
  const sale = this.toObject();
  delete sale.__v;
  return sale;
};

// 🔹 Índices para optimización
saleSchema.index({ code: 1, status: 1 });
saleSchema.index({ store: 1, status: 1 });
saleSchema.index({ customer: 1, status: 1 });

module.exports = mongoose.model("Sale", saleSchema);
