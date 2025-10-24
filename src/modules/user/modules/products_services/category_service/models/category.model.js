const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
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
      required: [true, "Category name is required"],
      trim: true,
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    isVisible: {
      type: Boolean,
      default: true,
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
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

categorySchema.methods.toJSON = function () {
  const category = this.toObject();
  delete category.__v;
  return category;
};

categorySchema.index({ name: 1, code: 1, status: 1 });

module.exports = mongoose.model("Category", categorySchema);
