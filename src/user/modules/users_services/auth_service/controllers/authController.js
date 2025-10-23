/**
 * @fileoverview Controlador de autenticación para usuarios (vendedores / cajeros)
 * @module user/controllers/authUserController
 * @description Sistema de autenticación con Access, Refresh y Persistent Tokens — Nexis ERP v8.3 AUTH COMPLETE+
 */

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Session = require("../../../../../user/modules/users_services/session_service/models/session.model");
const User = require("../../../../../user/modules/users_services/user_service/models/user.model");
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
const ACCESS_TOKEN_EXPIRES_MS = 60 * 60 * 1000; // 1h
const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7d
const PERSISTENT_TOKEN_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000; // 30d

/* ──────────────────────────────────────────────
 * 🔐 Generadores de token
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
 * 🚀 Iniciar sesión
 * ────────────────────────────────────────────── */
exports.login = async (req, res) => {
  try {
    const { email, password, deviceInfo, ipAddress, location } = req.body;

    // 1️⃣ Buscar usuario
    const user = await User.findOne({ email })
      .select("+password role status")
      .populate("role", "name code level permissions");

    if (!user) return errorResponse(res, 404, "Usuario no encontrado");
    if (user.status !== "ACTIVE")
      return errorResponse(res, 403, "Usuario inactivo o bloqueado");

    // 2️⃣ Validar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return errorResponse(res, 401, "Contraseña incorrecta");

    // 3️⃣ Generar tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    const persistentToken = generatePersistentToken(user._id);

    // 4️⃣ Registrar sesión sincronizada
    const now = Date.now();
    const session = new Session({
      user: user._id,
      accessToken,
      refreshToken,
      persistentToken,
      deviceInfo: deviceInfo || {},
      ipAddress: req.ip || ipAddress || "0.0.0.0",
      location: location || "unknown",
      accessTokenExpiresAt: new Date(now + ACCESS_TOKEN_EXPIRES_MS),
      refreshTokenExpiresAt: new Date(now + REFRESH_TOKEN_EXPIRES_MS),
      persistentTokenExpiresAt: new Date(now + PERSISTENT_TOKEN_EXPIRES_MS),
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
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    };

    return successResponse(res, 200, "Inicio de sesión exitoso", {
      accessToken,
      refreshToken,
      persistentToken,
      user: userResponse,
    });
  } catch (error) {
    console.error("Error en login usuario:", error);
    return errorResponse(res, 500, "Error interno al iniciar sesión", error);
  }
};

/* ──────────────────────────────────────────────
 * ♻️ Refrescar Access Token con Refresh Token
 * ────────────────────────────────────────────── */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return errorResponse(res, 400, "Refresh token requerido");

    // Validar sesión y token
    const session = await Session.findOne({
      refreshToken,
      isActive: true,
      isRevoked: false,
    });
    if (!session) return errorResponse(res, 401, "Sesión inválida");

    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

    const newAccessToken = generateAccessToken(decoded.id);
    session.accessToken = newAccessToken;
    session.accessTokenExpiresAt = new Date(
      Date.now() + ACCESS_TOKEN_EXPIRES_MS
    );
    await session.save();

    return successResponse(res, 200, "Token de acceso renovado", {
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Error al refrescar token:", error);
    return errorResponse(res, 401, "Refresh token inválido o expirado", error);
  }
};

/* ──────────────────────────────────────────────
 * 🚪 Cerrar sesión (revocar tokens)
 * ────────────────────────────────────────────── */
exports.logout = async (req, res) => {
  try {
    const { persistentToken } = req.body;
    if (!persistentToken)
      return errorResponse(res, 400, "Token persistente requerido");

    const session = await Session.findOne({ persistentToken });
    if (session) {
      session.isRevoked = true;
      session.isActive = false;
      await session.save();
    }

    return successResponse(res, 200, "Sesión cerrada correctamente");
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    return errorResponse(res, 500, "Error interno al cerrar sesión", error);
  }
};
