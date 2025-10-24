const Session = require("../models/session.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../../core/utils/responseUtils");

/**
 * Listar todas las sesiones activas de un usuario
 */
exports.listUserSessions = async (req, res) => {
  try {
    const userId = req.user.id; // usar id resumido del token

    const sessions = await Session.find({ user: userId, isActive: true })
      .select("-accessToken -persistentToken")
      .sort({ createdAt: -1 });

    return successResponse(res, 200, "Sesiones activas del usuario", sessions);
  } catch (error) {
    console.error("Error listando sesiones:", error);
    return errorResponse(res, 500, "Error interno listando sesiones", error);
  }
};

/**
 * Cerrar una sesión específica por persistentToken
 */
exports.logoutSession = async (req, res) => {
  try {
    const { persistentToken } = req.body;
    if (!persistentToken)
      return errorResponse(res, 400, "Token persistente requerido");

    const session = await Session.findOne({
      persistentToken,
      user: req.user.id, // usar id resumido
    });
    if (!session) return errorResponse(res, 404, "Sesión no encontrada");

    session.isActive = false;
    session.isRevoked = true;
    await session.save();

    return successResponse(res, 200, "Sesión cerrada correctamente");
  } catch (error) {
    console.error("Error cerrando sesión:", error);
    return errorResponse(res, 500, "Error interno al cerrar sesión", error);
  }
};

/**
 * Cerrar todas las sesiones de un usuario (excepto la actual)
 */
exports.logoutAllSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.session._id;

    await Session.updateMany(
      { user: userId, _id: { $ne: currentSessionId }, isActive: true },
      { $set: { isActive: false, isRevoked: true } }
    );

    return successResponse(
      res,
      200,
      "Todas las demás sesiones fueron cerradas"
    );
  } catch (error) {
    console.error("Error cerrando todas las sesiones:", error);
    return errorResponse(res, 500, "Error interno al cerrar sesiones", error);
  }
};

/**
 * Verificar sesión actual
 */
exports.verifySessionEndpoint = async (req, res) => {
  try {
    const { session, user } = req;

    if (!session) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Sesión inválida o cerrada",
      });
    }

    // Verificar expiración
    if (new Date() > session.accessTokenExpiresAt) {
      session.isActive = false;
      session.isRevoked = true;
      await session.save();
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Sesión expirada",
      });
    }

    return successResponse(res, 200, "Sesión válida", {
      session: {
        id: session._id,
        createdAt: session.createdAt,
        expiresAt: session.accessTokenExpiresAt,
        isActive: session.isActive,
      },
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    return errorResponse(res, 500, "Error interno al verificar sesión", error);
  }
};
