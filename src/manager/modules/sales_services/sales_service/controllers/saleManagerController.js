/**
 * @fileoverview Controlador de ventas para administradores / managers
 * @module admin/controllers/saleManagerController
 * @description Gestión completa de ventas con control multi-tienda, auditoría avanzada y reversión de stock.
 */

const mongoose = require("mongoose");
const Sale = require("../../../../../user/modules/sales_services/sales_service/models/sales.model");
const Product = require("../../../../../user/modules/products_services/product_service/models/product.model");
const Variant = require("../../../../../user/modules/products_services/variant_service/models/variant.model");
const Counter = require("../../../system_services/counter_service/models/counter.model");
const Customer = require("../../../../../user/modules/customers_services/customer_service/models/customer.model");
const { registerMovement } = require("../../../../../utils/movementUtils");
const { registerAudit } = require("../../../../../utils/auditUtils");
const {
  registerMovementAndUpdateInventory,
} = require("../../../../../utils/inventoryUtils");

const {
  successResponse,
  errorResponse,
} = require("../../../../../utils/responseUtils");

const IGV_RATE = 0.18;

/* ──────────────────────────────────────────────────────────────
 * LISTAR TODAS LAS VENTAS (multi-tienda)
 * ────────────────────────────────────────────────────────────── */
exports.listSales = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status,
      user,
      store,
    } = req.query;

    const query = {};

    // ✅ Control multi-tienda: solo restringe si el usuario no tiene acceso global
    if (!req.user.multiStoreAccess && req.user.store) {
      query.store = req.user.store;
    } else if (store) {
      query.store = store;
    }

    if (status) query.status = status.toUpperCase();
    if (user) query.createdBy = user;

    if (search) {
      query.$or = [
        { code: new RegExp(search, "i") },
        { "items.name": new RegExp(search, "i") },
        { "customer.name": new RegExp(search, "i") },
      ];
    }

    const skip = (page - 1) * limit;

    const [sales, total] = await Promise.all([
      Sale.find(query)
        .populate("store", "name code")
        .populate("customer", "name documentNumber")
        .populate("createdBy", "firstName lastName")
        .populate("updatedBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Sale.countDocuments(query),
    ]);

    return successResponse(res, 200, "Ventas obtenidas correctamente", sales, {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error listando ventas:", error);
    return errorResponse(res, 500, "Error interno listando ventas", error);
  }
};

/* ──────────────────────────────────────────────────────────────
 * OBTENER UNA VENTA POR ID
 * ────────────────────────────────────────────────────────────── */
exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "ID de venta inválido");

    const sale = await Sale.findById(id)
      .populate("store", "name code")
      .populate("customer", "name documentNumber")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!sale) return errorResponse(res, 404, "Venta no encontrada");

    if (
      !req.user.multiStoreAccess &&
      req.user.store?.toString() !== sale.store._id.toString()
    ) {
      return errorResponse(res, 403, "No tienes acceso a esta venta");
    }

    return successResponse(res, 200, "Venta obtenida correctamente", sale);
  } catch (error) {
    console.error("Error obteniendo venta:", error);
    return errorResponse(res, 500, "Error interno al obtener venta", error);
  }
};

/* ──────────────────────────────────────────────────────────────
 * CREAR VENTA MANUAL (multi-tienda, con inventario y auditoría)
 * ────────────────────────────────────────────────────────────── */
exports.createSale = async (req, res) => {
  const session = await mongoose.startSession();
  let newSaleId = null;

  try {
    await session.withTransaction(async () => {
      const { customer, documentType, paymentMethod, items, store } = req.body;

      /* ────────────────────────────────
       * 🏬 Determinar tienda
       * ──────────────────────────────── */
      const storeId = store || req.user.store;
      if (!storeId)
        throw new Error("Debe especificar una tienda para registrar la venta");

      /* ────────────────────────────────
       * 📦 Validar items
       * ──────────────────────────────── */
      if (!items || !Array.isArray(items) || items.length === 0)
        throw new Error("Debe agregar al menos un producto a la venta");

      /* ────────────────────────────────
       * 👤 Determinar cliente
       * ──────────────────────────────── */
      let customerId = customer || null;
      if (!customerId) {
        let genericCustomer = await Customer.findOne({ isGeneric: true });
        if (!genericCustomer) {
          [genericCustomer] = await Customer.create(
            [
              {
                name: "VENTA MANAGER",
                documentNumber: "00000000",
                isGeneric: true,
                createdBy: req.user.id,
              },
            ],
            { session }
          );
        }
        customerId = genericCustomer._id;
      }

      /* ────────────────────────────────
       * 🧾 Generar código de venta
       * ──────────────────────────────── */
      const saleCode = await Counter.getNextSequence("SL", storeId, session);

      let subtotal = 0;
      const processedItems = [];

      /* ────────────────────────────────
       * 🔁 Procesar productos
       * ──────────────────────────────── */
      for (const item of items) {
        const variant = item.variant
          ? await Variant.findById(item.variant).session(session)
          : null;
        const product = variant
          ? await Product.findById(variant.product).session(session)
          : await Product.findById(item.product).session(session);

        if (!product)
          throw new Error(`Producto no encontrado (${item.product})`);
        if (item.quantity <= 0)
          throw new Error(`Cantidad inválida para ${product.name}`);

        // 🔹 Precios base y descuento
        const basePrice = variant?.salePrice ?? product.salePrice;
        const discountPrice = variant?.discountPrice ?? product.discountPrice;
        const hasDiscount =
          item.applyDiscount && discountPrice && discountPrice < basePrice;

        const effectivePrice = hasDiscount ? discountPrice : basePrice;
        const discount = basePrice - effectivePrice;
        const itemSubtotal = effectivePrice * item.quantity;

        subtotal += itemSubtotal;

        processedItems.push({
          product: product._id,
          variant: variant?._id || null,
          name: variant ? `${product.name} (${variant.name})` : product.name,
          quantity: item.quantity,
          unitPrice: basePrice,
          discount,
          subtotal: itemSubtotal,
        });

        // ✅ Registrar salida de inventario
        await registerMovementAndUpdateInventory({
          type: "OUT",
          reason: "SALE",
          productId: product._id,
          variantId: variant?._id || null,
          storeId,
          quantity: item.quantity,
          cost: variant?.costPrice || product.costPrice || 0,
          reference: saleCode,
          note: `Salida de stock por venta (${saleCode})`,
          userId: req.user.id,
          session,
        });
      }

      /* ────────────────────────────────
       * 💰 Cálculo fiscal (IGV)
       * ──────────────────────────────── */
      const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
      const pricesIncludeTax = true; // Retail: precios ya incluyen IGV

      let base, tax, total;
      if (pricesIncludeTax) {
        base = subtotal / (1 + IGV_RATE);
        tax = subtotal - base;
        total = subtotal; // No se suma IGV porque ya está incluido
      } else {
        base = subtotal;
        tax = subtotal * IGV_RATE;
        total = subtotal + tax;
      }

      subtotal = round2(subtotal);
      base = round2(base);
      tax = round2(tax);
      total = round2(total);

      /* ────────────────────────────────
       * 🧾 Crear venta
       * ──────────────────────────────── */
      const [newSale] = await Sale.create(
        [
          {
            code: saleCode,
            store: storeId,
            customer: customerId,
            documentType: documentType || "BOLETA",
            items: processedItems,
            base,
            subtotal,
            tax,
            total,
            paymentMethod: paymentMethod || "EFECTIVO",
            status: "PAID",
            createdBy: req.user.id,
          },
        ],
        { session }
      );

      newSaleId = newSale._id;
    });

    /* ────────────────────────────────
     * 🔍 Venta completa
     * ──────────────────────────────── */
    const saleResponse = await Sale.findById(newSaleId)
      .populate("store", "name code")
      .populate("customer", "name documentNumber")
      .populate("createdBy", "firstName lastName");

    /* ────────────────────────────────
     * 🧾 Auditoría
     * ──────────────────────────────── */
    await registerAudit({
      userId: req.user.id,
      action: "CREATE",
      module: "SALE",
      target: saleResponse,
      description: `Creó una venta manual ${
        saleResponse.code
      } (S/ ${saleResponse.total.toFixed(2)})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: saleResponse.store._id,
    });

    return successResponse(
      res,
      201,
      "Venta creada correctamente",
      saleResponse
    );
  } catch (error) {
    console.error("Error creando venta:", error);
    return errorResponse(
      res,
      500,
      error.message || "Error interno al registrar venta",
      error
    );
  } finally {
    await session.endSession();
  }
};

/* ──────────────────────────────────────────────────────────────
 * ANULAR / CANCELAR VENTA (con reversión de inventario)
 * ────────────────────────────────────────────────────────────── */
exports.cancelSale = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "ID de venta inválido");

    let cancelledSale;

    await session.withTransaction(async () => {
      const sale = await Sale.findById(id).session(session);
      if (!sale) throw new Error("Venta no encontrada");
      if (sale.status === "CANCELLED")
        throw new Error("La venta ya fue anulada");

      // 🔹 Control multi-tienda
      if (
        !req.user.multiStoreAccess &&
        req.user.store?.toString() !== sale.store.toString()
      ) {
        throw new Error("No tienes permiso para anular esta venta");
      }

      // 🔹 Revertir cada ítem vendido
      for (const item of sale.items) {
        const variant = item.variant
          ? await Variant.findById(item.variant).session(session)
          : null;
        const product = variant
          ? await Product.findById(variant.product).session(session)
          : await Product.findById(item.product).session(session);

        if (!product) continue;

        // ✅ Registrar reversión de inventario (entrada)
        await registerMovementAndUpdateInventory({
          type: "IN",
          reason: "SALE_CANCELLED",
          productId: product._id,
          variantId: variant?._id || null,
          storeId: sale.store,
          quantity: item.quantity,
          cost: variant?.costPrice || product.costPrice || 0,
          reference: sale.code,
          note: `Reversión de stock por anulación de venta (${sale.code})`,
          userId: req.user.id,
          session,
        });
      }

      // ✅ Marcar venta como cancelada
      sale.status = "CANCELLED";
      sale.updatedBy = req.user.id;
      sale.deletedAt = new Date();
      await sale.save({ session });
      cancelledSale = sale;
    });

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "CANCEL",
      module: "SALE",
      target: cancelledSale,
      description: `Anuló la venta ${cancelledSale.code}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: cancelledSale.store,
    });

    return successResponse(
      res,
      200,
      "Venta anulada correctamente",
      cancelledSale
    );
  } catch (error) {
    console.error("Error anulando venta:", error);
    return errorResponse(
      res,
      500,
      error.message || "Error interno al anular venta",
      error
    );
  } finally {
    await session.endSession();
  }
};

/* ──────────────────────────────────────────────────────────────
 * RESUMEN DE VENTAS (para dashboards ERP)
 * ────────────────────────────────────────────────────────────── */
exports.getSummaryReport = async (req, res) => {
  try {
    const { store, from, to } = req.query;

    const query = { status: "PAID" };

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    if (!req.user.multiStoreAccess && req.user.store) {
      query.store = req.user.store;
    } else if (store) {
      query.store = store;
    }

    const stats = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$store",
          totalSales: { $sum: 1 },
          totalAmount: { $sum: "$total" },
          totalTax: { $sum: "$tax" },
          avgTicket: { $avg: "$total" },
        },
      },
      {
        $lookup: {
          from: "stores",
          localField: "_id",
          foreignField: "_id",
          as: "storeInfo",
        },
      },
      { $unwind: "$storeInfo" },
      {
        $project: {
          store: "$storeInfo.name",
          totalSales: 1,
          totalAmount: 1,
          totalTax: 1,
          avgTicket: 1,
        },
      },
    ]);

    return successResponse(res, 200, "Resumen de ventas obtenido", stats);
  } catch (error) {
    console.error("Error obteniendo resumen de ventas:", error);
    return errorResponse(res, 500, "Error interno generando resumen", error);
  }
};
