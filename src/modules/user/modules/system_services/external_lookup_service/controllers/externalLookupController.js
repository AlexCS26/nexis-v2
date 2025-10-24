/**
 * @fileoverview Controlador para consultas externas (RENIEC / SUNAT)
 * @module system_services/external_lookup_service/controllers/externalLookupController
 */

const {
  fetchFromRENIEC,
  fetchFromSUNAT,
} = require("../services/externalLookup.service");

const {
  successResponse,
  errorResponse,
} = require("../../../../../../core/utils/responseUtils");

/* =========================================================
 * 🤖 DETECTAR AUTOMÁTICAMENTE EL TIPO DE DOCUMENTO
 * ========================================================= */
function detectDocumentType(number) {
  if (!number) return null;

  const clean = number.trim();

  // 🔹 DNI → 8 dígitos numéricos
  if (/^\d{8}$/.test(clean)) return "dni";

  // 🔹 RUC → 11 dígitos que empiezan con 10, 15, 16, 17 o 20
  if (/^(10|15|16|17|20)\d{9}$/.test(clean)) return "ruc";

  return null;
}

/* =========================================================
 * 🔎 CONSULTAR AUTOMÁTICAMENTE DATOS POR DNI O RUC
 * ========================================================= */
exports.lookupByDocument = async (req, res) => {
  try {
    const { number } = req.query;

    if (!number)
      return errorResponse(res, 400, "Debe ingresar un número de documento");

    const type = detectDocumentType(number);

    if (!type)
      return errorResponse(
        res,
        400,
        "El número ingresado no corresponde a un DNI ni a un RUC válido"
      );

    // 🔹 Llamar al servicio correcto
    const result =
      type === "dni"
        ? await fetchFromRENIEC(number)
        : await fetchFromSUNAT(number);

    if (!result.success)
      return errorResponse(res, result.status, result.message);

    return successResponse(
      res,
      200,
      `Datos obtenidos exitosamente desde ${type.toUpperCase()}`,
      result.data
    );
  } catch (error) {
    console.error("Error in lookupByDocument:", error);
    return errorResponse(res, 500, "Error interno del servidor", error);
  }
};
