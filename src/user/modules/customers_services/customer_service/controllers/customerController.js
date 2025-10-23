/**
 * @fileoverview Controlador de clientes — Nexis ERP v8.0 ENTERPRISE+
 * @module user/controllers/customerController
 * @description Controladores mejorados con datos extendidos, coherentes con UI v8.0.
 */

const mongoose = require("mongoose");
const Customer = require("../models/customer.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../utils/responseUtils");

/* =========================================================
 * 📋 LISTAR CLIENTES (incluye datos extendidos)
 * ========================================================= */
exports.listCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({
      status: { $in: ["ACTIVE", "INACTIVE"] },
    })
      .sort({ createdAt: -1 })
      .select(
        "name documentType documentNumber email phone address status isGeneric createdAt"
      );

    return successResponse(
      res,
      200,
      "Customers fetched successfully",
      customers
    );
  } catch (error) {
    console.error("Error fetching customers:", error);
    return errorResponse(res, 500, "Internal server error", error);
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

    const customer = await Customer.findById(id).select(
      "name documentType documentNumber email phone address isGeneric status createdAt updatedAt createdBy updatedBy"
    );

    if (!customer) return errorResponse(res, 404, "Customer not found");

    return successResponse(
      res,
      200,
      "Customer retrieved successfully",
      customer
    );
  } catch (error) {
    console.error("Error fetching customer by ID:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/* =========================================================
 * 🔎 BUSCAR CLIENTES (nombre, documento o correo)
 * ========================================================= */
exports.searchCustomers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return errorResponse(res, 400, "Search query is required");

    const regex = new RegExp(q.trim(), "i");

    const query = {
      $or: [
        { name: regex },
        { documentNumber: regex },
        { email: regex },
        { phone: regex },
      ],
    };

    const customers = await Customer.find(query)
      .sort({ name: 1 })
      .select(
        "name documentType documentNumber email phone address status isGeneric createdAt"
      );

    return successResponse(res, 200, "Customer search results", customers);
  } catch (error) {
    console.error("Error searching customers:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/* =========================================================
 * ✳️ CREAR UN NUEVO CLIENTE
 * ========================================================= */
exports.createCustomer = async (req, res) => {
  try {
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

    if (!name) return errorResponse(res, 400, "Customer name is required");

    // 🚫 Evitar duplicados
    if (documentNumber) {
      const existing = await Customer.findOne({ documentNumber });
      if (existing)
        return errorResponse(
          res,
          409,
          "A customer already exists with that document"
        );
    }

    const newCustomer = await Customer.create({
      name,
      documentType,
      documentNumber,
      email,
      phone,
      address,
      status: status || "ACTIVE",
      isGeneric: !!isGeneric,
      createdBy: req.user?.id || null,
    });

    return successResponse(
      res,
      201,
      "Customer created successfully",
      newCustomer
    );
  } catch (error) {
    console.error("Error creating customer:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/* =========================================================
 * ⚙️ ACTUALIZAR CLIENTE (Opcional para futuros módulos)
 * ========================================================= */
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid customer ID");

    const updated = await Customer.findByIdAndUpdate(
      id,
      { ...data, updatedBy: req.user?.id || null },
      { new: true, runValidators: true }
    );

    if (!updated) return errorResponse(res, 404, "Customer not found");

    return successResponse(res, 200, "Customer updated successfully", updated);
  } catch (error) {
    console.error("Error updating customer:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};
