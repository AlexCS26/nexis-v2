const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    // Nombre legible del permiso (para UI)
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Código único, ejemplo: "VENTAS_CREATE" o "INVENTORY_DELETE"
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    // Descripción clara del permiso
    description: {
      type: String,
      trim: true,
      default: null,
    },

    // Módulo principal (ej: "VENTAS", "ALMACÉN", "USUARIOS")
    module: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    // Acción concreta dentro del módulo
    action: {
      type: String,
      required: true,
      enum: [
        "VIEW",
        "CREATE",
        "EDIT",
        "DELETE",
        "APPROVE",
        "EXPORT",
        "IMPORT",
        "MANAGE",
      ],
      uppercase: true,
      trim: true,
    },

    // Categoría para agrupar permisos (útil en paneles o seeds automáticos)
    category: {
      type: String,
      trim: true,
      uppercase: true,
      default: null, // Ejemplo: "GESTIÓN", "CONFIGURACIÓN", "REPORTES"
    },

    // Si el permiso pertenece a un rol del sistema (protegido)
    isSystemPermission: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

// 🔍 Índices recomendados
permissionSchema.index({ code: 1 }, { unique: true });
permissionSchema.index({ module: 1 });
permissionSchema.index({ action: 1 });

// 🚫 Protección de permisos del sistema
permissionSchema.pre(
  "deleteOne",
  { document: true, query: false },
  function (next) {
    if (this.isSystemPermission) {
      const err = new Error("No se puede eliminar un permiso del sistema");
      return next(err);
    }
    next();
  }
);

module.exports = mongoose.model("Permission", permissionSchema);
