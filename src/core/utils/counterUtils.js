// utils/counterUtils.js
/**
 * @fileoverview Utilidad corporativa para manejo de contadores secuenciales.
 * @module utils/counterUtils
 * @description Proporciona una API segura para generar códigos únicos por módulo, tienda y año fiscal.
 */

const mongoose = require("mongoose");
const Counter = require("../manager/modules/system_services/counter_service/models/counter.model");

/**
 * Obtiene o crea el siguiente número de secuencia formateado.
 * @param {String} prefix - Prefijo del contador (ej. 'SL', 'MV', 'AU')
 * @param {String} storeId - ID de la tienda o sucursal
 * @param {mongoose.ClientSession} [session] - Sesión opcional de transacción
 * @returns {Promise<String>} Código secuencial (ej. SL-00001)
 */
exports.getNextCode = async (prefix, storeId, session = null) => {
  if (!prefix || !storeId) throw new Error("Prefix and storeId are required");

  const year = new Date().getFullYear();

  try {
    // Busca o crea el contador
    const counter = await Counter.findOneAndUpdate(
      { prefix, store: storeId, fiscalYear: year },
      { $inc: { currentValue: 1 } },
      { new: true, upsert: true, session }
    );

    // Reinicio si excede el máximo configurado
    if (counter.currentValue > counter.maxValue) {
      counter.currentValue = counter.startValue;
      counter.lastReset = new Date();
      await counter.save({ session });
    }

    // Formatear el número (ej: SL-00001)
    const formattedNumber = counter.currentValue
      .toString()
      .padStart(counter.padding, "0");

    return `${prefix}-${formattedNumber}`;
  } catch (error) {
    console.error("Counter generation failed:", error.message);
    throw new Error("Failed to generate counter code");
  }
};

/**
 * Reinicia manualmente el contador para un prefijo específico
 * @param {String} prefix - Prefijo del contador
 * @param {String} storeId - ID de la tienda
 * @param {Number} [newStart=1] - Nuevo valor inicial
 */
exports.resetCounter = async (prefix, storeId, newStart = 1) => {
  const year = new Date().getFullYear();

  const counter = await Counter.findOneAndUpdate(
    { prefix, store: storeId, fiscalYear: year },
    { currentValue: newStart - 1, startValue: newStart, lastReset: new Date() },
    { new: true }
  );

  if (!counter) {
    throw new Error(`Counter with prefix ${prefix} not found`);
  }

  return counter;
};
