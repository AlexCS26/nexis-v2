/**
 * @fileoverview Modelo de usuario E-commerce (cliente web o app)
 * @module ecommerce/modules/users_service/models/ecommerceUser.model
 * @description Representa a los usuarios que se registran en el sitio web o aplicación móvil.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ecommerceUserSchema = new mongoose.Schema(
  {
    // Nombre del cliente final
    fullName: {
      type: String,
      required: [true, "El nombre completo es obligatorio"],
      trim: true,
      maxlength: [150, "El nombre no puede exceder los 150 caracteres"],
    },

    // Correo electrónico (único)
    email: {
      type: String,
      required: [true, "El correo electrónico es obligatorio"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Correo electrónico no válido"],
    },

    // Contraseña cifrada
    password: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
      minlength: [6, "La contraseña debe tener al menos 6 caracteres"],
    },

    // Teléfono opcional
    phone: {
      type: String,
      trim: true,
      maxlength: [20, "El teléfono no puede exceder los 20 caracteres"],
      default: null,
    },

    // Dirección de envío principal
    address: {
      type: String,
      trim: true,
      maxlength: [250, "La dirección no puede exceder los 250 caracteres"],
      default: null,
    },

    // Estado del usuario
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "BLOCKED"],
      default: "ACTIVE",
      uppercase: true,
    },

    // Auditoría mínima
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

// Cifrado automático de contraseña antes de guardar
ecommerceUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Comparar contraseñas
ecommerceUserSchema.methods.comparePassword = async function (
  candidatePassword
) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Ocultar campos internos
ecommerceUserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

// Índices para búsqueda rápida
ecommerceUserSchema.index({ email: 1, fullName: "text" });

module.exports = mongoose.model("EcommerceUser", ecommerceUserSchema);
