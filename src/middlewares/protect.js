/**
 * @fileoverview Middleware de autenticación y autorización — Nexis ERP v8.3 SECURITY SYNC+
 * @module middleware/authMiddleware
 * @description Verifica Access, Refresh y Persistent Tokens sincronizados con Mongo.
 */

const jwt = require("jsonwebtoken");
const User = require("../user/modules/users_services/user_service/models/user.model");
const Session = require("../user/modules/users_services/session_service/models/session.model");

/* ──────────────────────────────────────────────
 * 🔧 Variables de entorno seguras
 * ────────────────────────────────────────────── */
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || "default_access_secret";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "default_refresh_secret";
const PERSISTENT_TOKEN_SECRET =
  process.env.PERSISTENT_TOKEN_SECRET || "default_persistent_secret";

/* =========================================================
 * 🧩 Middleware principal: verifyToken
 * ========================================================= */
exports.verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing or invalid",
      });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    let tokenType = "access";

    // 🔹 Detectar tipo de token según su firma
    try {
      decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
      tokenType = "access";
    } catch (err1) {
      try {
        decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
        tokenType = "refresh";
      } catch (err2) {
        try {
          decoded = jwt.verify(token, PERSISTENT_TOKEN_SECRET);
          tokenType = "persistent";
        } catch (err3) {
          return res
            .status(401)
            .json({ success: false, message: "Token inválido o expirado" });
        }
      }
    }

    // 🔹 Buscar sesión activa asociada al token
    const session = await Session.findOne({
      user: decoded.id,
      $or: [
        { accessToken: token },
        { refreshToken: token },
        { persistentToken: token },
      ],
      isActive: true,
      isRevoked: false,
    });

    if (!session)
      return res
        .status(401)
        .json({ success: false, message: "Sesión inválida o cerrada" });

    const now = new Date();

    // 🔹 Validar expiración del access token
    if (tokenType === "access" && now > session.accessTokenExpiresAt) {
      return res
        .status(401)
        .json({ success: false, message: "Access token expirado" });
    }

    // 🔹 Validar refresh token
    if (tokenType === "refresh" && now > session.refreshTokenExpiresAt) {
      session.isActive = false;
      session.isRevoked = true;
      await session.save();
      return res
        .status(401)
        .json({ success: false, message: "Refresh token expirado" });
    }

    // 🔹 Validar persistent token
    if (tokenType === "persistent" && now > session.persistentTokenExpiresAt) {
      session.isActive = false;
      session.isRevoked = true;
      await session.save();
      return res
        .status(401)
        .json({ success: false, message: "Sesión persistente expirada" });
    }

    // 🔹 Buscar usuario activo
    const user = await User.findById(session.user)
      .populate({
        path: "role",
        select: "name code level permissions",
        populate: {
          path: "permissions",
          select: "code name isActive module action",
        },
      })
      .populate("store", "name code")
      .select("firstName lastName email role status store");

    if (!user || user.status !== "ACTIVE") {
      await Session.updateMany(
        { user: session.user, isActive: true },
        { isActive: false, isRevoked: true }
      );
      return res
        .status(403)
        .json({ success: false, message: "Usuario inactivo o bloqueado" });
    }

    // ✅ Inyectar sesión y usuario en la request
    req.session = session;
    req.user = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
      store: user.store?._id,
      storeDetails: user.store,
    };

    next();
  } catch (error) {
    console.error("Error en verifyToken:", error);
    return res
      .status(401)
      .json({ success: false, message: "Authentication failed" });
  }
};

/* =========================================================
 * 🧩 Middleware para managers
 * ========================================================= */
exports.verifyManagerToken = async (req, res, next) => {
  try {
    await exports.verifyToken(req, res, async () => {
      // 🔹 Validar nivel de rol
      if (!req.user || !req.user.role || req.user.role.level < 5) {
        return res.status(403).json({
          success: false,
          message: "Access restricted to management users",
        });
      }
      next();
    });
  } catch (error) {
    console.error("Error en verifyManagerToken:", error);
    return res.status(401).json({
      success: false,
      message: "Manager authentication failed",
    });
  }
};

/* =========================================================
 * 🛡️ Middleware para permisos específicos
 * ========================================================= */
exports.hasPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const { role } = req.user;
      if (
        !role.permissions ||
        !Array.isArray(role.permissions) ||
        role.permissions.length === 0
      ) {
        return res.status(403).json({
          success: false,
          message: "Role has no permissions assigned",
        });
      }

      const activePermissions = role.permissions
        .filter((perm) => perm.isActive)
        .map((perm) => perm.code);

      const hasPermission = activePermissions.includes(requiredPermission);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission for this action",
        });
      }

      next();
    } catch (error) {
      console.error("Error en hasPermission:", error);
      res.status(500).json({
        success: false,
        message: "Permission check failed",
      });
    }
  };
};
