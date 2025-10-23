const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ✅ Esquema profesional con validaciones y buenas prácticas
const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    documentId: {
      type: String, // e.g., DNI, Passport
      trim: true,
      unique: true,
      sparse: true, // permite múltiples nulos sin error
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      unique: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // ❗ importante: oculta la contraseña por defecto en consultas
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?\d{7,15}$/, "Invalid phone number format"],
    },
    birthDate: {
      type: Date,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "BLOCKED"],
      default: "ACTIVE",
      uppercase: true,
    },
    lastAccess: {
      type: Date,
    },
    avatar: {
      type: String, // URL a la foto del usuario (opcional)
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // quién creó el usuario
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // quién lo modificó
    },
  },
  { timestamps: true }
);

// 🔒 Encriptar contraseña antes de guardar
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// 🔑 Comparar contraseñas
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// 🧠 Método útil para ocultar campos sensibles al devolver datos
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

module.exports = mongoose.model("User", userSchema);
