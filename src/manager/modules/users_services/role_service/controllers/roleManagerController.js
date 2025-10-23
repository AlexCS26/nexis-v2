/**
 * @fileoverview Controlador de gestión de roles
 * @module admin/controllers/roleManagerController
 * @description CRUD completo de roles con manejo de permisos y protección de roles del sistema
 */

const mongoose = require("mongoose");
const Role = require("../models/role.model");
const Permission = require("../../permission_service/models/permission.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../utils/responseUtils");
const { registerAudit } = require("../../../../../utils/auditUtils");

/**
 * @desc Crear un nuevo rol
 * @route POST /api/v1/admin/roles
 * @access Private (Admin)
 */
exports.createRole = async (req, res) => {
  try {
    const { name, displayName, description, level, permissions } = req.body;

    if (!name || !level) {
      return errorResponse(
        res,
        400,
        "El nombre y nivel del rol son obligatorios"
      );
    }

    // 🔹 Verificar nombre duplicado
    const existingRole = await Role.findOne({ name: name.toUpperCase() });
    if (existingRole) {
      return errorResponse(res, 400, "El rol ya existe");
    }

    // 🔹 Validar permisos si se enviaron
    let validPermissions = [];
    if (permissions && permissions.length > 0) {
      validPermissions = await Permission.find({
        _id: { $in: permissions },
        isActive: true,
      });
      if (validPermissions.length !== permissions.length) {
        return errorResponse(
          res,
          400,
          "Algunos permisos no existen o no están activos"
        );
      }
    }

    // 🔹 Crear nuevo rol
    const newRole = new Role({
      name: name.toUpperCase(),
      displayName,
      description,
      level,
      permissions: validPermissions.map((p) => p._id),
      createdBy: req.user.id,
    });

    await newRole.save();

    const roleResponse = await Role.findById(newRole._id).populate(
      "permissions",
      "code name module action"
    );

    // 🔹 Registrar auditoría
    await registerAudit({
      userId: req.user.id,
      action: "CREATE",
      module: "ROLE",
      target: newRole,
      description: `Creó el rol "${displayName || name}" con nivel ${level}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(res, 201, "Rol creado correctamente", roleResponse);
  } catch (error) {
    console.error("Error al crear rol:", error);
    return errorResponse(res, 500, "Error interno al crear rol", error);
  }
};

/**
 * @desc Obtener todos los roles
 * @route GET /api/v1/admin/roles
 * @access Private (Admin)
 */
exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find()
      .populate("permissions", "code name module action")
      .sort({ level: -1 });

    return successResponse(res, 200, "Roles obtenidos correctamente", roles);
  } catch (error) {
    console.error("Error al obtener roles:", error);
    return errorResponse(res, 500, "Error interno al obtener roles", error);
  }
};

/**
 * @desc Obtener un rol por ID
 * @route GET /api/v1/admin/roles/:id
 * @access Private (Admin)
 */
exports.getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "ID de rol no válido");
    }

    const role = await Role.findById(id).populate(
      "permissions",
      "code name module action"
    );

    if (!role) {
      return errorResponse(res, 404, "Rol no encontrado");
    }

    return successResponse(res, 200, "Rol obtenido correctamente", role);
  } catch (error) {
    console.error("Error al obtener rol:", error);
    return errorResponse(res, 500, "Error interno al obtener rol", error);
  }
};

/**
 * @desc Actualizar un rol existente
 * @route PUT /api/v1/admin/roles/:id
 * @access Private (Admin)
 */
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "ID de rol no válido");
    }

    const role = await Role.findById(id);
    if (!role) {
      return errorResponse(res, 404, "Rol no encontrado");
    }

    // 🔹 Bloquear modificación de roles del sistema
    if (role.isSystemRole) {
      return errorResponse(
        res,
        403,
        "No se puede modificar un rol del sistema"
      );
    }

    const { name, displayName, description, level, permissions, isActive } =
      req.body;

    // 🔹 Validar permisos si se enviaron
    if (permissions && permissions.length > 0) {
      const validPermissions = await Permission.find({
        _id: { $in: permissions },
        isActive: true,
      });
      if (validPermissions.length !== permissions.length) {
        return errorResponse(
          res,
          400,
          "Algunos permisos no existen o no están activos"
        );
      }
      role.permissions = validPermissions.map((p) => p._id);
    }

    // 🔹 Actualizar campos del rol
    if (name) role.name = name.toUpperCase();
    if (displayName) role.displayName = displayName;
    if (description) role.description = description;
    if (level) role.level = level;
    if (isActive !== undefined) role.isActive = isActive;
    role.updatedBy = req.user.id;

    await role.save();

    const updatedRole = await Role.findById(id).populate(
      "permissions",
      "code name module action"
    );

    // 🔹 Registrar auditoría
    await registerAudit({
      userId: req.user.id,
      action: "UPDATE",
      module: "ROLE",
      target: role,
      description: `Actualizó el rol "${role.displayName || role.name}"`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(
      res,
      200,
      "Rol actualizado correctamente",
      updatedRole
    );
  } catch (error) {
    console.error("Error al actualizar rol:", error);
    return errorResponse(res, 500, "Error interno al actualizar rol", error);
  }
};

/**
 * @desc Eliminar un rol (no se pueden eliminar roles del sistema)
 * @route DELETE /api/v1/admin/roles/:id
 * @access Private (Admin)
 */
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "ID de rol no válido");
    }

    const role = await Role.findById(id);
    if (!role) {
      return errorResponse(res, 404, "Rol no encontrado");
    }

    // 🔹 Bloquear eliminación de roles del sistema
    if (role.isSystemRole) {
      return errorResponse(res, 403, "No se puede eliminar un rol del sistema");
    }

    await role.deleteOne();

    // 🔹 Registrar auditoría
    await registerAudit({
      userId: req.user.id,
      action: "DELETE",
      module: "ROLE",
      target: role,
      description: `Eliminó el rol "${role.displayName || role.name}"`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return successResponse(res, 200, "Rol eliminado correctamente");
  } catch (error) {
    console.error("Error al eliminar rol:", error);
    return errorResponse(res, 500, "Error interno al eliminar rol", error);
  }
};
