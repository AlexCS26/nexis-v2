const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // permite que productos sin code no fallen
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
    },
    name: {
      type: String,
      required: [true, "Variant name is required"],
      trim: true,
      maxlength: [100, "Variant name cannot exceed 100 characters"],
    },
    sku: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    barcode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    attributes: [
      {
        key: { type: String, trim: true, required: true },
        value: { type: String, trim: true, required: true },
      },
    ],
    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    costPrice: {
      type: Number,
      default: 0,
      min: [0, "Cost price cannot be negative"],
    },
    salePrice: {
      type: Number,
      required: [true, "Sale price is required"],
      min: [0, "Sale price cannot be negative"],
    },
    discountPrice: {
      type: Number,
      min: [0, "Discount price cannot be negative"],
    },
    images: [
      {
        url: { type: String, trim: true },
        alt: { type: String, trim: true },
      },
    ],
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "DISCONTINUED"],
      default: "ACTIVE",
      uppercase: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: [true, "Store is required"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Ocultar campos internos al devolver datos
variantSchema.methods.toJSON = function () {
  const variant = this.toObject();
  delete variant.__v;
  return variant;
};

// Índices para búsquedas rápidas
variantSchema.index({ name: 1, sku: 1, status: 1 });
variantSchema.index({ product: 1, status: 1 });
variantSchema.index({ store: 1, status: 1 });

module.exports = mongoose.model("Variant", variantSchema);
