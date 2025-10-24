// utils/auditUtils.js
const mongoose = require("mongoose");
const Audit = require("../../modules/manager/modules/audit_services/audit_service/models/audit.model");
const Counter = require("../../modules/manager/modules/system_services/counter_service/models/counter.model");

/**
 * Registra una acción en el sistema de auditoría
 * @param {Object} params - Parámetros del registro
 * @param {String} params.userId - ID del usuario que realiza la acción
 * @param {String} params.action - Acción realizada (CREATE, UPDATE, DELETE, LOGIN, etc.)
 * @param {String} params.module - Módulo afectado (PRODUCT, SALE, USER, etc.)
 * @param {Object} [params.target] - Documento afectado (para obtener id y modelo)
 * @param {String} [params.description] - Descripción legible de la acción
 * @param {String} [params.ipAddress] - Dirección IP del cliente
 * @param {String} [params.userAgent] - Agente de usuario del cliente
 * @param {String} [params.storeId] - ID de la tienda (si aplica)
 */

// utils/auditUtils.js - VERSIÓN CORREGIDA
exports.registerAudit = async ({
  userId,
  action,
  module,
  target = null,
  description = "",
  ipAddress = "",
  userAgent = "",
  storeId = null,
}) => {
  // ❌ ELIMINA el parámetro session completamente

  try {
    console.log("🟡 registerAudit called:", { action, module, userId });

    const targetObj = target?.toObject ? target.toObject() : target;

    // ✅ SOLUCIÓN: Usar código del target o generar uno temporal
    let code = targetObj?.code;

    // Si no hay código, crear uno temporal basado en timestamp
    if (!code) {
      code = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log("🟡 Using temporary code:", code);
    }

    const auditData = {
      code, // ✅ Ahora SIEMPRE tendrá un valor
      user: userId,
      action: action.toUpperCase(),
      module: module.toUpperCase(),
      description,
      ipAddress,
      userAgent,
      store: storeId,
    };

    if (target && target._id) {
      auditData.targetId = target._id;
      auditData.targetModel =
        target.constructor?.modelName?.toUpperCase() || module.toUpperCase();
    }

    console.log("🟡 Creating audit with code:", code);

    // ✅ CREAR SIN SESIÓN - más simple y confiable
    const auditRecord = await Audit.create(auditData);
    console.log("✅ Audit created successfully:", auditRecord._id);

    return auditRecord;
  } catch (error) {
    console.error("❌ Audit creation failed:", error.message);
    // No relanzar el error para no afectar el flujo principal
    return null;
  }
};
