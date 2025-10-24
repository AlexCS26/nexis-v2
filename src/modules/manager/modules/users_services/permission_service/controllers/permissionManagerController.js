/**
 * @fileoverview Controlador de gestión de permisos
 * @module admin/controllers/permissionManagerController
 * @description CRUD completo de permisos con protección de permisos del sistema
 */

const mongoose = require("mongoose");
const Permission = require("../models/permission.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../../core/utils/responseUtils");
const { registerAudit } = require("../../../../../../core/utils/auditUtils");

/**
 * @desc Crear un nuevo permiso
 * @route POST /api/v1/admin/permissions
 * @access Private (Admin)
 */
exports.createPermission = async (req, res) => {
  try {
    const { name, code, module, action, description, category, isActive } =
      req.body;

    if (!name || !code || !module || !action) {
      return errorResponse(
        res,
        400,
        "Campos obligatorios: name, code, module, action"
      );
    }

    const existingPermission = await Permission.findOne({
      code: code.toUpperCase(),
    });
    if (existingPermission) {
      return errorResponse(res, 400, "El código de permiso ya existe");
    }

    const newPermission = new Permission({
      name,
      code: code.toUpperCase(),
      module: module.toUpperCase(),
      action: action.toUpperCase(),
      description,
      category: category ? category.toUpperCase() : null,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user.id,
    });

    await newPermission.save();

    // 🔹 Registrar en auditoría
    await registerAudit({
      userId: req.user.id,
      action: "CREATE",
      module: "PERMISSION",
      target: newPermission,
      description: `Creó el permiso ${newPermission.name} (${newPermission.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(
      res,
      201,
      "Permiso creado correctamente",
      newPermission
    );
  } catch (error) {
    console.error("Error al crear permiso:", error);
    return errorResponse(res, 500, "Error interno al crear permiso", error);
  }
};

/**
 * @desc Obtener todos los permisos
 * @route GET /api/v1/admin/permissions
 * @access Private (Admin)
 */
exports.getPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find().sort({ module: 1, action: 1 });

    return successResponse(
      res,
      200,
      "Permisos obtenidos correctamente",
      permissions
    );
  } catch (error) {
    console.error("Error al obtener permisos:", error);
    return errorResponse(res, 500, "Error interno al obtener permisos", error);
  }
};

/**
 * @desc Obtener un permiso por ID
 * @route GET /api/v1/admin/permissions/:id
 * @access Private (Admin)
 */
exports.getPermissionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "ID de permiso no válido");
    }

    const permission = await Permission.findById(id);
    if (!permission) return errorResponse(res, 404, "Permiso no encontrado");

    return successResponse(
      res,
      200,
      "Permiso obtenido correctamente",
      permission
    );
  } catch (error) {
    console.error("Error al obtener permiso:", error);
    return errorResponse(res, 500, "Error interno al obtener permiso", error);
  }
};

/**
 * @desc Actualizar un permiso
 * @route PUT /api/v1/admin/permissions/:id
 * @access Private (Admin)
 */
exports.updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "ID de permiso no válido");
    }

    const permission = await Permission.findById(id);
    if (!permission) return errorResponse(res, 404, "Permiso no encontrado");

    if (permission.isSystemPermission) {
      return errorResponse(
        res,
        403,
        "No se puede modificar un permiso del sistema"
      );
    }

    const { name, code, module, action, description, category, isActive } =
      req.body;

    if (name) permission.name = name;
    if (code) permission.code = code.toUpperCase();
    if (module) permission.module = module.toUpperCase();
    if (action) permission.action = action.toUpperCase();
    if (description) permission.description = description;
    if (category) permission.category = category.toUpperCase();
    if (isActive !== undefined) permission.isActive = isActive;

    permission.updatedBy = req.user.id;

    await permission.save();

    // 🔹 Registrar en auditoría
    await registerAudit({
      userId: req.user.id,
      action: "UPDATE",
      module: "PERMISSION",
      target: permission,
      description: `Actualizó el permiso ${permission.name} (${permission.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(
      res,
      200,
      "Permiso actualizado correctamente",
      permission
    );
  } catch (error) {
    console.error("Error al actualizar permiso:", error);
    return errorResponse(
      res,
      500,
      "Error interno al actualizar permiso",
      error
    );
  }
};

/**
 * @desc Eliminar un permiso
 * @route DELETE /api/v1/admin/permissions/:id
 * @access Private (Admin)
 */
exports.deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "ID de permiso no válido");
    }

    const permission = await Permission.findById(id);
    if (!permission) return errorResponse(res, 404, "Permiso no encontrado");

    if (permission.isSystemPermission) {
      return errorResponse(
        res,
        403,
        "No se puede eliminar un permiso del sistema"
      );
    }

    await permission.deleteOne();

    // 🔹 Registrar en auditoría
    await registerAudit({
      userId: req.user.id,
      action: "DELETE",
      module: "PERMISSION",
      target: permission,
      description: `Eliminó el permiso ${permission.name} (${permission.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(res, 200, "Permiso eliminado correctamente");
  } catch (error) {
    console.error("Error al eliminar permiso:", error);
    return errorResponse(res, 500, "Error interno al eliminar permiso", error);
  }
};
