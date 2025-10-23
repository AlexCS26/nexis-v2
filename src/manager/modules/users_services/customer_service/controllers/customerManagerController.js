/**
 * @fileoverview Controlador de clientes para administradores
 * @module admin/controllers/customerManagerController
 */

const mongoose = require("mongoose");
const Customer = require("../../../../../user/modules/customers_services/customer_service/models/customer.model");
const Counter = require("../../../system_services/counter_service/models/counter.model");
const { registerAudit } = require("../../../../../utils/auditUtils");
const {
  successResponse,
  errorResponse,
} = require("../../../../../utils/responseUtils");

/* =========================================================
 * 📋 LISTAR CLIENTES CON FILTROS Y PAGINACIÓN
 * ========================================================= */
exports.listCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { documentNumber: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
      ];
    }

    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .populate("createdBy", "firstName lastName")
        .populate("updatedBy", "firstName lastName")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Customer.countDocuments(query),
    ]);

    return successResponse(
      res,
      200,
      "Customers retrieved successfully",
      customers,
      {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      }
    );
  } catch (error) {
    console.error("Error listing customers:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/* =========================================================
 * ✳️ CREAR CLIENTE (ADMIN)
 * ========================================================= */
exports.createCustomer = async (req, res) => {
  const session = await mongoose.startSession();
  let newCustomerId = null;

  try {
    await session.withTransaction(async () => {
      const {
        name,
        documentType,
        documentNumber,
        email,
        phone,
        address,
        isGeneric,
        status,
      } = req.body;

      if (!name) throw new Error("Required field missing: name");

      // 🚫 Evitar duplicado
      if (documentNumber) {
        const existing = await Customer.findOne({ documentNumber }).session(
          session
        );
        if (existing)
          throw new Error("Customer already exists with that document");
      }

      const [createdCustomer] = await Customer.create(
        [
          {
            name,
            documentType,
            documentNumber,
            email,
            phone,
            address,
            isGeneric: !!isGeneric,
            status: status || "ACTIVE",
            createdBy: req.user.id,
          },
        ],
        { session }
      );

      newCustomerId = createdCustomer._id;
    });

    const customer = await Customer.findById(newCustomerId).populate(
      "createdBy",
      "firstName lastName"
    );

    // 🧾 Registrar auditoría
    await registerAudit({
      userId: req.user.id,
      action: "CREATE",
      module: "CUSTOMER",
      target: customer,
      description: `Creó el cliente "${customer.name}" (${
        customer.documentNumber || "sin documento"
      })`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    }).catch((err) => console.warn("⚠️ Audit failed:", err.message));

    return successResponse(res, 201, "Customer created successfully", customer);
  } catch (error) {
    console.error("Error creating customer:", error);

    if (
      [
        "Customer already exists with that document",
        "Required field missing: name",
      ].includes(error.message)
    )
      return errorResponse(res, 400, error.message);

    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/* =========================================================
 * 🔍 OBTENER CLIENTE POR ID
 * ========================================================= */
exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid customer ID");

    const customer = await Customer.findById(id)
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!customer) return errorResponse(res, 404, "Customer not found");

    return successResponse(
      res,
      200,
      "Customer retrieved successfully",
      customer
    );
  } catch (error) {
    console.error("Error fetching customer:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/* =========================================================
 * 🛠️ ACTUALIZAR CLIENTE
 * ========================================================= */
exports.updateCustomer = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid customer ID");

    let updatedCustomer;

    await session.withTransaction(async () => {
      const existing = await Customer.findById(id).session(session);
      if (!existing) throw new Error("Customer not found");

      updatedCustomer = await Customer.findByIdAndUpdate(
        id,
        { ...req.body, updatedBy: req.user.id, updatedAt: new Date() },
        { new: true, session }
      ).populate("updatedBy", "firstName lastName");
    });

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "UPDATE",
      module: "CUSTOMER",
      target: updatedCustomer,
      description: `Actualizó el cliente "${updatedCustomer.name}" (${
        updatedCustomer.documentNumber || "sin documento"
      })`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(
      res,
      200,
      "Customer updated successfully",
      updatedCustomer
    );
  } catch (error) {
    console.error("Error updating customer:", error);
    if (error.message === "Customer not found")
      return errorResponse(res, 404, error.message);
    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/* =========================================================
 * 🔁 CAMBIAR ESTADO DEL CLIENTE
 * ========================================================= */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid customer ID");
    if (!["ACTIVE", "INACTIVE"].includes(status))
      return errorResponse(res, 400, "Invalid status");

    const updated = await Customer.findByIdAndUpdate(
      id,
      { status, updatedBy: req.user.id },
      { new: true }
    );

    if (!updated) return errorResponse(res, 404, "Customer not found");

    await registerAudit({
      userId: req.user.id,
      action: "STATUS_CHANGE",
      module: "CUSTOMER",
      target: updated,
      description: `Cambió el estado del cliente "${updated.name}" a "${status}"`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(res, 200, `Status updated to ${status}`, updated);
  } catch (error) {
    console.error("Error updating status:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/* =========================================================
 * 🗑️ ELIMINAR CLIENTE (Soft Delete)
 * ========================================================= */
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid customer ID");

    const deleted = await Customer.findByIdAndUpdate(
      id,
      { status: "INACTIVE", updatedBy: req.user.id },
      { new: true }
    );

    if (!deleted) return errorResponse(res, 404, "Customer not found");

    await registerAudit({
      userId: req.user.id,
      action: "DELETE",
      module: "CUSTOMER",
      target: deleted,
      description: `Eliminó al cliente "${deleted.name}" (${
        deleted.documentNumber || "sin documento"
      })`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(res, 200, "Customer deleted successfully", deleted);
  } catch (error) {
    console.error("Error deleting customer:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};
