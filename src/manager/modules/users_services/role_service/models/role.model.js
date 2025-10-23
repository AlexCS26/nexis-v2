const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      uppercase: true, // Mejora para consistencia (ADMIN, VENDEDOR, etc.)
    },
    displayName: {
      type: String,
      trim: true,
      default: null, // Nombre legible (Administrador General)
    },
    description: {
      type: String,
      trim: true,
    },
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],
    level: {
      type: Number,
      default: 1, // Ejemplo: 1=vendedor, 5=supervisor, 10=admin
      min: 1,
      max: 10,
    },
    isSystemRole: {
      type: Boolean,
      default: false, // true = rol protegido
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // quién creó el rol
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// 🔍 Índices recomendados (rendimiento y unicidad)
roleSchema.index({ name: 1 }, { unique: true });
roleSchema.index({ level: 1 });

// 🚫 Protección de roles del sistema
roleSchema.pre("deleteOne", { document: true, query: false }, function (next) {
  if (this.isSystemRole) {
    const err = new Error("No se puede eliminar un rol del sistema");
    return next(err);
  }
  next();
});

module.exports = mongoose.model("Role", roleSchema);
