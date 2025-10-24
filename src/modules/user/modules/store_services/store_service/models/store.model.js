const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Store code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9\-]+$/, "Invalid store code format"], // Ej: ST-001
    },
    name: {
      type: String,
      required: [true, "Store name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?\d{7,15}$/, "Invalid phone number format"],
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      region: { type: String, trim: true }, // departamento / provincia
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true, default: "PERU" },
    },
    isMain: {
      type: Boolean,
      default: false, // indica si es la tienda principal
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      uppercase: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// 🔄 Middleware: asegúrate de que solo una tienda tenga `isMain = true`
storeSchema.pre("save", async function (next) {
  if (this.isMain) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { isMain: false }
    );
  }
  next();
});

// 🧠 Ocultar campos internos en las respuestas
storeSchema.methods.toJSON = function () {
  const store = this.toObject();
  delete store.__v;
  return store;
};

module.exports = mongoose.model("Store", storeSchema);
