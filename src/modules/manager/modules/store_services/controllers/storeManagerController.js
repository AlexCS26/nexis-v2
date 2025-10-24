/**
 * @fileoverview Controlador de tiendas para administradores
 * @module admin/controllers/storeManagerController
 */

const mongoose = require("mongoose");
const Store = require("../../../../user/modules/store_services/store_service/models/store.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../core/utils/responseUtils");
const { registerAudit } = require("../../../../../core/utils/auditUtils");
const Counter = require("../../system_services/counter_service/models/counter.model");

/**
 * @desc Listar todas las tiendas con filtros y paginación
 * @route GET /api/v1/admin/stores
 * @access Private (Admin)
 */
exports.listStores = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { code: new RegExp(search, "i") },
        { "address.city": new RegExp(search, "i") },
      ];
    }

    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const [stores, total] = await Promise.all([
      Store.find(query)
        .populate("createdBy", "firstName lastName")
        .populate("updatedBy", "firstName lastName")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Store.countDocuments(query),
    ]);

    return successResponse(res, 200, "Stores retrieved successfully", stores, {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching stores:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/**
 * @desc Crear una nueva tienda
 * @route POST /api/v1/admin/stores
 * @access Private (Admin)
 */
exports.createStore = async (req, res) => {
  const session = await mongoose.startSession();
  let newStoreId = null;

  try {
    await session.withTransaction(async () => {
      const { name, description, email, phone, address, isMain, status } =
        req.body;

      if (!name) throw new Error("Required field missing: name");

      // ✅ Contador global para tiendas
      const storeCode = await Counter.getNextSequence("ST", null, session);

      // Evitar duplicado (no debería ocurrir, pero por seguridad)
      const existingStore = await Store.findOne({ code: storeCode }).session(
        session
      );
      if (existingStore) throw new Error("Store code already exists");

      const [createdStore] = await Store.create(
        [
          {
            code: storeCode,
            name,
            description,
            email,
            phone,
            address,
            isMain,
            status,
            createdBy: req.user.id,
          },
        ],
        { session }
      );

      newStoreId = createdStore._id;
    });

    const storeResponse = await Store.findById(newStoreId).populate(
      "createdBy",
      "firstName lastName"
    );

    if (!storeResponse) throw new Error("Store not found after creation");

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "CREATE",
      module: "STORE",
      target: storeResponse,
      description: `Creó la tienda "${storeResponse.name}" (${storeResponse.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: storeResponse._id,
    }).catch((err) => console.warn("⚠️ Audit failed:", err.message));

    return successResponse(
      res,
      201,
      "Store created successfully",
      storeResponse
    );
  } catch (error) {
    console.error("Error creating store:", error);

    if (
      ["Store code already exists", "Required field missing: name"].includes(
        error.message
      )
    )
      return errorResponse(res, 400, error.message);

    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Obtener una tienda por ID
 * @route GET /api/v1/admin/stores/:id
 * @access Private (Admin)
 */
exports.getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid store ID");

    const store = await Store.findById(id)
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!store) return errorResponse(res, 404, "Store not found");

    return successResponse(res, 200, "Store retrieved successfully", store);
  } catch (error) {
    console.error("Error fetching store by ID:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/**
 * @desc Actualizar una tienda
 * @route PUT /api/v1/admin/stores/:id
 * @access Private (Admin)
 */
exports.updateStore = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid store ID");

    let updatedStore;

    await session.withTransaction(async () => {
      const storeBefore = await Store.findById(id).session(session);
      if (!storeBefore) throw new Error("Store not found");

      // 🚫 Ya no generamos nuevo código aquí
      const updates = {
        ...req.body,
        updatedBy: req.user.id,
        updatedAt: new Date(),
      };
      delete updates.createdBy;

      updatedStore = await Store.findByIdAndUpdate(id, updates, {
        new: true,
        session,
      }).populate("updatedBy", "firstName lastName");
    });

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "UPDATE",
      module: "STORE",
      target: updatedStore,
      description: `Actualizó la tienda "${updatedStore.name}" (${updatedStore.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: updatedStore._id,
    }).catch((err) => console.warn("⚠️ Audit failed:", err.message));

    return successResponse(
      res,
      200,
      "Store updated successfully",
      updatedStore
    );
  } catch (error) {
    console.error("Error updating store:", error);
    if (error.message === "Store not found")
      return errorResponse(res, 404, error.message);
    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Cambiar estado de la tienda (ACTIVE / INACTIVE)
 * @route PATCH /api/v1/admin/stores/:id/status
 * @access Private (Admin)
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid store ID");
    if (!["ACTIVE", "INACTIVE"].includes(status))
      return errorResponse(res, 400, "Invalid status");

    const updatedStore = await Store.findByIdAndUpdate(
      id,
      { status, updatedBy: req.user.id, statusChangeDate: new Date() },
      { new: true }
    );

    if (!updatedStore) return errorResponse(res, 404, "Store not found");

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "STATUS_CHANGE",
      module: "STORE",
      target: updatedStore,
      description: `Cambió el estado de la tienda "${updatedStore.name}" a "${status}"`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: updatedStore._id,
    }).catch((err) => console.warn("⚠️ Audit failed:", err.message));

    return successResponse(
      res,
      200,
      `Status updated to ${status}`,
      updatedStore
    );
  } catch (error) {
    console.error("Error updating store status:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/**
 * @desc Eliminar una tienda (soft delete)
 * @route DELETE /api/v1/admin/stores/:id
 * @access Private (Admin)
 */
exports.deleteStore = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid store ID");

    const deletedStore = await Store.findByIdAndUpdate(
      id,
      {
        status: "INACTIVE",
        updatedBy: req.user.id,
        deletedAt: new Date(),
      },
      { new: true }
    );

    if (!deletedStore) return errorResponse(res, 404, "Store not found");

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "DELETE",
      module: "STORE",
      target: deletedStore,
      description: `Eliminó la tienda "${deletedStore.name}" (${deletedStore.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: deletedStore._id,
    }).catch((err) => console.warn("⚠️ Audit failed:", err.message));

    return successResponse(
      res,
      200,
      "Store deleted successfully",
      deletedStore
    );
  } catch (error) {
    console.error("Error deleting store:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};
