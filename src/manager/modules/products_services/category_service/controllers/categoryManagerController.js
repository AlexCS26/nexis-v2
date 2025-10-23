/**
 * @fileoverview Controlador de categorías para administradores / manager
 * @module admin/controllers/categoryManagerController
 * @description Operaciones CRUD y gestión de categorías con control por tienda.
 */

const mongoose = require("mongoose");
const Category = require("../../../../../user/modules/products_services/category_service/models/category.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../utils/responseUtils");
const { registerAudit } = require("../../../../../utils/auditUtils");
const Counter = require("../../../system_services/counter_service/models/counter.model");

/**
 * @desc Listar categorías por tienda
 * @route GET /api/v1/admin/categories
 * @access Private (Admin/Manager)
 */
exports.listCategories = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status } = req.query;
    const query = { store: req.user.store };

    if (search) query.name = new RegExp(search, "i");
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      Category.find(query)
        .populate("store", "name code")
        .populate("createdBy", "firstName lastName")
        .populate("updatedBy", "firstName lastName")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Category.countDocuments(query),
    ]);

    return successResponse(
      res,
      200,
      "Categories retrieved successfully",
      categories,
      {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      }
    );
  } catch (error) {
    console.error("Error fetching categories:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/**
 * @desc Crear una nueva categoría (único punto donde se usa Counter)
 * @route POST /api/v1/admin/categories
 * @access Private (Admin/Manager)
 */
exports.createCategory = async (req, res) => {
  const session = await mongoose.startSession();
  let newCategoryId = null;

  try {
    await session.withTransaction(async () => {
      const { name, description, isVisible, status } = req.body;

      // ✅ Generar código secuencial único por tienda
      const categoryCode = await Counter.getNextSequence(
        "CT",
        req.user.store,
        session
      );

      // Evitar duplicados (mismo código en la misma tienda)
      const existingCategory = await Category.findOne({
        code: categoryCode,
        store: req.user.store,
      }).session(session);

      if (existingCategory) {
        throw new Error("Category code already exists in this store");
      }

      const [createdCategory] = await Category.create(
        [
          {
            code: categoryCode,
            name,
            description,
            isVisible,
            status,
            store: req.user.store,
            createdBy: req.user.id,
          },
        ],
        { session }
      );

      newCategoryId = createdCategory._id;
    });

    // Obtener la categoría completa
    const categoryResponse = await Category.findById(newCategoryId)
      .populate("store", "name code")
      .populate("createdBy", "firstName lastName");

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "CREATE",
      module: "CATEGORY",
      target: categoryResponse,
      description: `Creó la categoría "${categoryResponse.name}" (${categoryResponse.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
    });

    return successResponse(
      res,
      201,
      "Category created successfully",
      categoryResponse
    );
  } catch (error) {
    console.error("Error creating category:", error);

    if (error.message === "Category code already exists in this store") {
      return errorResponse(res, 400, error.message);
    }

    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Actualizar una categoría (sin regenerar código)
 * @route PUT /api/v1/admin/categories/:id
 * @access Private (Admin/Manager)
 */
exports.updateCategory = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid category ID");

    let updatedCategory;

    await session.withTransaction(async () => {
      const categoryBefore = await Category.findOne({
        _id: id,
        store: req.user.store,
      }).session(session);

      if (!categoryBefore) throw new Error("Category not found in your store");

      // ✅ No se cambia el código
      const updates = {
        ...req.body,
        updatedBy: req.user.id,
        updatedAt: new Date(),
      };
      delete updates.createdBy;
      delete updates.store;
      delete updates.code;

      updatedCategory = await Category.findByIdAndUpdate(id, updates, {
        new: true,
        session,
      })
        .populate("store", "name code")
        .populate("updatedBy", "firstName lastName");
    });

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "UPDATE",
      module: "CATEGORY",
      target: updatedCategory,
      description: `Actualizó la categoría "${updatedCategory.name}" (${updatedCategory.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
    });

    return successResponse(
      res,
      200,
      "Category updated successfully",
      updatedCategory
    );
  } catch (error) {
    console.error("Error updating category:", error);
    if (error.message === "Category not found in your store")
      return errorResponse(res, 404, error.message);
    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Eliminar categoría (soft delete sin regenerar código)
 * @route DELETE /api/v1/admin/categories/:id
 * @access Private (Admin/Manager)
 */
exports.deleteCategory = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid category ID");

    let deletedCategory;

    await session.withTransaction(async () => {
      const categoryBefore = await Category.findOne({
        _id: id,
        store: req.user.store,
      }).session(session);

      if (!categoryBefore) throw new Error("Category not found in your store");

      deletedCategory = await Category.findByIdAndUpdate(
        id,
        {
          status: "INACTIVE",
          deletedAt: new Date(),
          updatedBy: req.user.id,
        },
        { new: true, session }
      )
        .populate("store", "name code")
        .populate("updatedBy", "firstName lastName");
    });

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "DELETE",
      module: "CATEGORY",
      target: deletedCategory,
      description: `Eliminó la categoría "${deletedCategory.name}" (${deletedCategory.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
    });

    return successResponse(
      res,
      200,
      "Category deleted successfully",
      deletedCategory
    );
  } catch (error) {
    console.error("Error deleting category:", error);
    if (error.message === "Category not found in your store")
      return errorResponse(res, 404, error.message);
    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Cambiar estado (sin regenerar código)
 * @route PATCH /api/v1/admin/categories/:id/status
 * @access Private (Admin/Manager)
 */
exports.updateStatus = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid category ID");
    if (!["ACTIVE", "INACTIVE"].includes(status))
      return errorResponse(res, 400, "Invalid status");

    let updatedCategory;

    await session.withTransaction(async () => {
      const categoryBefore = await Category.findOne({
        _id: id,
        store: req.user.store,
      }).session(session);

      if (!categoryBefore) throw new Error("Category not found in your store");

      updatedCategory = await Category.findByIdAndUpdate(
        id,
        {
          status,
          updatedBy: req.user.id,
          statusChangeDate: new Date(),
        },
        { new: true, session }
      )
        .populate("store", "name code")
        .populate("updatedBy", "firstName lastName");
    });

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "STATUS_CHANGE",
      module: "CATEGORY",
      target: updatedCategory,
      description: `Cambió estado de la categoría "${updatedCategory.name}" a ${status}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
    });

    return successResponse(
      res,
      200,
      `Status updated to ${status}`,
      updatedCategory
    );
  } catch (error) {
    console.error("Error updating category status:", error);
    if (error.message === "Category not found in your store")
      return errorResponse(res, 404, error.message);
    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Obtener categoría por ID
 * @route GET /api/v1/admin/categories/:id
 * @access Private (Admin/Manager)
 */
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid category ID");

    const category = await Category.findOne({
      _id: id,
      store: req.user.store,
    })
      .populate("store", "name code")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!category)
      return errorResponse(res, 404, "Category not found in your store");

    return successResponse(
      res,
      200,
      "Category retrieved successfully",
      category
    );
  } catch (error) {
    console.error("Error fetching category by ID:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};
