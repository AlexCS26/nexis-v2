/**
 * @fileoverview Controlador de perfil de usuario autenticado.
 * @module user/controllers/profileController
 * @description Gestiona la obtención y actualización del perfil del usuario logueado.
 */

const User = require("../models/user.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../../core/utils/responseUtils");

/* =========================================================
 * OBTENER PERFIL DEL USUARIO AUTENTICADO
 * ========================================================= */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select(
        "firstName lastName email phone birthDate avatar documentId role store status"
      )
      .populate("role", "name code permissions")
      .populate("store", "name code");

    if (!user)
      return errorResponse(res, 404, "Usuario no encontrado o sesión inválida");

    return successResponse(res, 200, "Perfil obtenido correctamente", user);
  } catch (error) {
    console.error("Error al obtener perfil:", error);
    return errorResponse(res, 500, "Error interno del servidor", error);
  }
};

/* =========================================================
 * ACTUALIZAR PERFIL DEL USUARIO AUTENTICADO
 * ========================================================= */
exports.updateProfile = async (req, res) => {
  try {
    // 🧩 Campos que el usuario puede modificar (según tu modelo)
    const editableFields = [
      "firstName",
      "lastName",
      "phone",
      "birthDate",
      "avatar",
    ];

    // 🧱 Filtrar solo los campos válidos del body
    const updates = {};
    for (const key of editableFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // ❌ Bloquear cualquier intento de modificar datos críticos
    const forbiddenFields = ["role", "status", "store", "permissions", "email"];
    for (const field of forbiddenFields) {
      if (req.body[field] !== undefined) {
        return errorResponse(
          res,
          403,
          `El campo '${field}' no puede ser modificado por el usuario`
        );
      }
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    })
      .select(
        "firstName lastName email phone birthDate avatar documentId role store status"
      )
      .populate("role", "name code")
      .populate("store", "name code");

    if (!updatedUser)
      return errorResponse(res, 404, "Usuario no encontrado o sesión inválida");

    return successResponse(
      res,
      200,
      "Perfil actualizado correctamente",
      updatedUser
    );
  } catch (error) {
    console.error("Error al actualizar perfil:", error);
    return errorResponse(res, 500, "Error interno al actualizar perfil", error);
  }
};
