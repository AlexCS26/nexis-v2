/**
 * @fileoverview Controlador de administración de usuarios.
 * @module admin/controllers/userAdminController
 * @description Operaciones CRUD y gestión de estado de usuarios por administradores.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../../../../../user/modules/users_services/user_service/models/user.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../utils/responseUtils");
const { registerAudit } = require("../../../../../utils/auditUtils");

/**
 * @desc Obtener todos los usuarios con filtros, búsqueda y paginación
 * @route GET /api/v1/admin/users
 * @access Private (Admin)
 */
exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status,
      role,
      store,
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ];
    }

    if (status) query.status = status;
    if (role) query.role = role;
    if (store) query.store = store;

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(query)
        .select("firstName lastName email role store status createdAt")
        .populate("role", "name code")
        .populate("store", "name code")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),

      User.countDocuments(query),
    ]);

    return successResponse(res, 200, "Usuarios obtenidos correctamente", {
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      users,
    });
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return errorResponse(res, 500, "Error interno al obtener usuarios", error);
  }
};

/**
 * @desc Crear un nuevo usuario
 * @route POST /api/v1/admin/users
 * @access Private (Admin)
 */
exports.createUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      store,
      phone,
      birthDate,
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return errorResponse(res, 400, "El correo ya está registrado");

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role,
      store,
      phone,
      birthDate,
      createdBy: req.user.id,
    });

    await newUser.save();

    // 🔹 Registro de auditoría
    await registerAudit({
      userId: req.user.id,
      action: "CREATE",
      module: "USER",
      target: newUser,
      description: `Usuario ${newUser.email} creado por ${req.user.email}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store || null,
    });

    return successResponse(res, 201, "Usuario creado correctamente", {
      id: newUser._id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
    });
  } catch (error) {
    console.error("Error al crear usuario:", error);
    return errorResponse(res, 500, "Error interno al crear usuario", error);
  }
};

/**
 * @desc Actualizar información de un usuario
 * @route PUT /api/v1/admin/users/:id
 * @access Private (Admin)
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "ID de usuario no válido");

    const updates = { ...req.body, updatedBy: req.user.id };
    delete updates.password;

    const user = await User.findByIdAndUpdate(id, updates, { new: true })
      .select("firstName lastName email role status")
      .populate("role", "name code")
      .populate("store", "name code");

    if (!user) return errorResponse(res, 404, "Usuario no encontrado");

    // 🔹 Registro de auditoría
    await registerAudit({
      userId: req.user.id,
      action: "UPDATE",
      module: "USER",
      target: user,
      description: `Usuario ${user.email} actualizado por ${req.user.email}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store || null,
    });

    return successResponse(res, 200, "Usuario actualizado correctamente", user);
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    return errorResponse(res, 500, "Error interno del servidor", error);
  }
};

/**
 * @desc Eliminar un usuario (borrado físico)
 * @route DELETE /api/v1/admin/users/:id
 * @access Private (Admin)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "ID de usuario no válido");

    const user = await User.findByIdAndDelete(id);
    if (!user) return errorResponse(res, 404, "Usuario no encontrado");

    // 🔹 Registro de auditoría
    await registerAudit({
      userId: req.user.id,
      action: "DELETE",
      module: "USER",
      target: user,
      description: `Usuario ${user.email} eliminado por ${req.user.email}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store || null,
    });

    return successResponse(res, 200, "Usuario eliminado correctamente");
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    return errorResponse(res, 500, "Error interno del servidor", error);
  }
};

/**
 * @desc Cambiar estado de un usuario (ACTIVE / INACTIVE / BLOCKED)
 * @route PATCH /api/v1/admin/users/:id/status
 * @access Private (Admin)
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "ID de usuario no válido");

    if (!["ACTIVE", "INACTIVE", "BLOCKED"].includes(status))
      return errorResponse(res, 400, "Estado no permitido");

    const user = await User.findByIdAndUpdate(
      id,
      { status, updatedBy: req.user.id },
      { new: true }
    )
      .select("firstName lastName email role status")
      .populate("role", "name code");

    if (!user) return errorResponse(res, 404, "Usuario no encontrado");

    // 🔹 Registro de auditoría
    await registerAudit({
      userId: req.user.id,
      action: "UPDATE",
      module: "USER",
      target: user,
      description: `Estado del usuario ${user.email} cambiado a ${status} por ${req.user.email}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store || null,
    });

    return successResponse(res, 200, `Estado actualizado a ${status}`, user);
  } catch (error) {
    console.error("Error al actualizar estado del usuario:", error);
    return errorResponse(res, 500, "Error interno del servidor", error);
  }
};

/**
 * @desc Obtener un usuario por ID
 * @route GET /api/v1/admin/users/:id
 * @access Private (Admin)
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "ID de usuario no válido");

    const user = await User.findById(id)
      .select(
        "firstName lastName email phone birthDate role store status createdAt updatedAt"
      )
      .populate("role", "name code permissions level")
      .populate("store", "name code address");

    if (!user) return errorResponse(res, 404, "Usuario no encontrado");

    return successResponse(res, 200, "Usuario obtenido correctamente", user);
  } catch (error) {
    console.error("Error al obtener usuario por ID:", error);
    return errorResponse(res, 500, "Error interno al obtener usuario", error);
  }
};
