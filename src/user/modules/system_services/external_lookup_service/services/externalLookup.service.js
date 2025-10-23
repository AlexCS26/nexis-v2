/**
 * @fileoverview Servicio de integración externa — Decolecta (RENIEC / SUNAT)
 * @module system_services/external_lookup_service/services/externalLookup.service
 */

/* =========================================================
 * 🔹 Consulta información de persona natural por DNI (RENIEC)
 * ========================================================= */
exports.fetchFromRENIEC = async (dni) => {
  try {
    const url = `${process.env.DECOLECTA_DNI_URL}?numero=${dni}`;
    console.log(`📡 Consultando RENIEC → ${url}`);

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DECOLECTA_TOKEN}`,
      },
    });

    if (!res.ok) {
      console.error(`❌ RENIEC response: HTTP ${res.status}`);
      const errorText = await res.text();
      console.error("🔍 RENIEC body:", errorText);
      throw new Error(`HTTP ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    console.log(`✅ RENIEC OK (${dni})`, data);
    return { success: true, data };
  } catch (error) {
    console.error("RENIEC lookup error:", error.stack || error.message);
    return {
      success: false,
      status: 500,
      message: "Error al consultar RENIEC",
      details: error.message,
    };
  }
};

/* =========================================================
 * 🔹 Consulta información de empresa por RUC (SUNAT)
 * ========================================================= */
exports.fetchFromSUNAT = async (ruc) => {
  try {
    const url = `${process.env.DECOLECTA_RUC_URL}?numero=${ruc}`;
    console.log(`📡 Consultando SUNAT → ${url}`);

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DECOLECTA_TOKEN}`,
      },
    });

    if (!res.ok) {
      console.error(`❌ SUNAT response: HTTP ${res.status}`);
      const errorText = await res.text();
      console.error("🔍 SUNAT body:", errorText);
      throw new Error(`HTTP ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    console.log(`✅ SUNAT OK (${ruc})`, data);
    return { success: true, data };
  } catch (error) {
    console.error("SUNAT lookup error:", error.stack || error.message);
    return {
      success: false,
      status: 500,
      message: "Error al consultar SUNAT",
      details: error.message,
    };
  }
};
