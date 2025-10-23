/**
 * @fileoverview Controlador de autenticación para gerencia/admin — Nexis ERP v8.3 ENTERPRISE+
 * @module admin/controllers/authManagerController
 * @description Sistema unificado con Access, Refresh y Persistent Tokens sincronizados con Mongo.
 */

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Session = require("../../../../../user/modules/users_services/session_service/models/session.model");
const User = require("../../../../../user/modules/users_services/user_service/models/user.model");
const Role = require("../../role_service/models/role.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../utils/responseUtils");

/* ──────────────────────────────────────────────
 * 🔧 Variables de entorno seguras
 * ────────────────────────────────────────────── */
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || "default_access_secret";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "default_refresh_secret";
const PERSISTENT_TOKEN_SECRET =
  process.env.PERSISTENT_TOKEN_SECRET || "default_persistent_secret";

const ACCESS_TOKEN_EXPIRES = (
  process.env.ACCESS_TOKEN_EXPIRES_IN || "1h"
).trim();
const REFRESH_TOKEN_EXPIRES = (
  process.env.REFRESH_TOKEN_EXPIRES_IN || "7d"
).trim();
const PERSISTENT_TOKEN_EXPIRES = (
  process.env.PERSISTENT_TOKEN_EXPIRES_IN || "30d"
).trim();

// Equivalentes en milisegundos
const ACCESS_TOKEN_EXPIRES_MS = 60 * 60 * 1000; // 1 hora
const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const PERSISTENT_TOKEN_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

/* ──────────────────────────────────────────────
 * 🔐 Generadores de tokens
 * ────────────────────────────────────────────── */
const generateAccessToken = (userId) =>
  jwt.sign({ id: userId, type: "access" }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });

const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId, type: "refresh" }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });

const generatePersistentToken = (userId) =>
  jwt.sign({ id: userId, type: "persistent" }, PERSISTENT_TOKEN_SECRET, {
    expiresIn: PERSISTENT_TOKEN_EXPIRES,
  });

/* ──────────────────────────────────────────────
 * 🚀 Login gerencia/admin
 * ────────────────────────────────────────────── */
exports.loginManager = async (req, res) => {
  try {
    const { email, password, deviceInfo, ipAddress, location } = req.body;

    // 1️⃣ Buscar usuario
    const user = await User.findOne({ email })
      .select("+password role status")
      .populate("role", "name code level status");

    if (!user) return errorResponse(res, 401, "Credenciales inválidas");
    if (user.status !== "ACTIVE")
      return errorResponse(res, 403, "Usuario inactivo o bloqueado");
    if (!user.role || user.role.level < 5)
      return errorResponse(res, 403, "Acceso restringido a gerencia");

    // 2️⃣ Validar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return errorResponse(res, 401, "Credenciales inválidas");

    // 3️⃣ Generar tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    const persistentToken = generatePersistentToken(user._id);

    // 4️⃣ Crear sesión
    const now = Date.now();
    const session = new Session({
      user: user._id,
      accessToken,
      refreshToken,
      persistentToken,
      accessTokenExpiresAt: new Date(now + ACCESS_TOKEN_EXPIRES_MS),
      refreshTokenExpiresAt: new Date(now + REFRESH_TOKEN_EXPIRES_MS),
      persistentTokenExpiresAt: new Date(now + PERSISTENT_TOKEN_EXPIRES_MS),
      deviceInfo: deviceInfo || {},
      ipAddress: req.ip || ipAddress || "0.0.0.0",
      location: location || "unknown",
      isActive: true,
      isRevoked: false,
    });

    await session.save();

    // 5️⃣ Actualizar último acceso
    user.lastAccess = new Date(now);
    await user.save();

    // 6️⃣ Respuesta limpia
    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    return successResponse(res, 200, "Inicio de sesión gerencial exitoso", {
      user: userResponse,
      accessToken,
      refreshToken,
      persistentToken,
    });
  } catch (error) {
    console.error("Login gerencia error:", error);
    return errorResponse(res, 500, "Error interno al iniciar sesión", error);
  }
};

/* ──────────────────────────────────────────────
 * ♻️ Refresh Token — Renovar Access Token
 * ────────────────────────────────────────────── */
exports.refreshManagerToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return errorResponse(res, 400, "Refresh token requerido");

    // Validar sesión activa
    const session = await Session.findOne({
      refreshToken,
      isActive: true,
      isRevoked: false,
    });
    if (!session) return errorResponse(res, 401, "Sesión inválida o expirada");

    // Validar token JWT
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

    // Crear nuevo Access Token
    const newAccessToken = generateAccessToken(decoded.id);
    session.accessToken = newAccessToken;
    session.accessTokenExpiresAt = new Date(
      Date.now() + ACCESS_TOKEN_EXPIRES_MS
    );
    await session.save();

    return successResponse(res, 200, "Access token renovado", {
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Error al refrescar token gerencia:", error);
    return errorResponse(res, 401, "Refresh token inválido o expirado", error);
  }
};

/* ──────────────────────────────────────────────
 * 🚪 Logout gerencia/admin
 * ────────────────────────────────────────────── */
exports.logoutManager = async (req, res) => {
  try {
    const { persistentToken } = req.body;
    if (!persistentToken)
      return errorResponse(res, 400, "Token persistente requerido");

    const session = await Session.findOne({ persistentToken });
    if (!session) return errorResponse(res, 404, "Sesión no encontrada");

    session.isActive = false;
    session.isRevoked = true;
    await session.save();

    return successResponse(res, 200, "Sesión cerrada correctamente");
  } catch (error) {
    console.error("Logout gerencia error:", error);
    return errorResponse(res, 500, "Error interno al cerrar sesión", error);
  }
};
