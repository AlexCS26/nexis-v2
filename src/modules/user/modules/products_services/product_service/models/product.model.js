/**
 * @fileoverview Modelo de Producto — E-commerce + ERP Ready
 * @description Modelo robusto con soporte para variantes, imágenes, SEO y búsquedas rápidas.
 */

const mongoose = require("mongoose");
const slugify = require("slugify");

const productSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // permite que productos sin code no fallen
      index: true,
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [150, "Product name cannot exceed 150 characters"],
    },
    slug: {
      type: String,
      trim: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    brand: {
      type: String,
      trim: true,
      maxlength: [100, "Brand name too long"],
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
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
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    minStock: {
      type: Number,
      default: 0,
      min: [0, "Minimum stock cannot be negative"],
    },
    maxStock: {
      type: Number,
      default: 0,
      min: [0, "Maximum stock cannot be negative"],
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
        url: { type: String, trim: true, required: true },
        alt: { type: String, trim: true },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    // 🔹 Referencia a la colección de variantes
    variants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Variant",
      },
    ],
    // ⭐ Valoraciones promedio
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    meta: {
      viewsCount: { type: Number, default: 0 },
      salesCount: { type: Number, default: 0 },
      isFeatured: { type: Boolean, default: false },
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "DISCONTINUED"],
      default: "ACTIVE",
      uppercase: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
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

/* ========================================================
   🧠 Middlewares
   ======================================================== */

// Generar automáticamente el slug si no existe o cambia el nombre
productSchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  } else if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Ocultar campos internos al devolver datos
productSchema.methods.toJSON = function () {
  const product = this.toObject();
  delete product.__v;
  delete product.deletedAt;
  return product;
};

/* ========================================================
   ⚡ Indexes para búsquedas rápidas y SEO
   ======================================================== */
productSchema.index({ name: "text", brand: "text", tags: "text" });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ name: 1, sku: 1, status: 1 });
productSchema.index({ "meta.salesCount": -1 });
productSchema.index({ "meta.isFeatured": 1 });
productSchema.index({ "rating.average": -1 });

module.exports = mongoose.model("Product", productSchema);
