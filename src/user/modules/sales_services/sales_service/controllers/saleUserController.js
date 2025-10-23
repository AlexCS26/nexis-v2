/**
 * @fileoverview Controlador de ventas para usuarios (cajeros / vendedores)
 * @module user/controllers/saleUserController
 * @description Registro y gestión de ventas propias del usuario autenticado, con auditoría y movimientos de inventario.
 */

const mongoose = require("mongoose");
const Sale = require("../models/sales.model");
const Product = require("../../../products_services/product_service/models/product.model");
const Variant = require("../../../products_services/variant_service/models/variant.model");
const Counter = require("../../../../../manager/modules/system_services/counter_service/models/counter.model");
const Customer = require("../../../customers_services/customer_service/models/customer.model");
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

/**
 * @desc Listar ventas del usuario (por tienda)
 * @route GET /api/v1/user/sales
 * @access Private (User)
 */
exports.listSales = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status } = req.query;
    const query = { store: req.user.store };

    if (search) {
      query.$or = [
        { code: new RegExp(search, "i") },
        { "items.name": new RegExp(search, "i") },
      ];
    }

    if (status) query.status = status.toUpperCase();

    const skip = (page - 1) * limit;

    const [sales, total] = await Promise.all([
      Sale.find(query)
        .populate("store", "name code")
        .populate("customer", "name documentNumber")
        .populate("createdBy", "firstName lastName")
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

/**
 * @desc Crear una nueva venta (control inventario + auditoría)
 * @route POST /api/v1/user/sales
 * @access Private (User)
 */
exports.createSale = async (req, res) => {
  const session = await mongoose.startSession();
  let newSaleId = null;
  let saleCode = null;

  try {
    await session.withTransaction(async () => {
      const { customer, documentType, paymentMethod, items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error(
          "Debe agregar al menos un producto o variante a la venta"
        );
      }

      /* ────────────────────────────────
       * 🧩 Cliente
       * ──────────────────────────────── */
      let customerId = customer || null;
      if (!customerId) {
        let genericCustomer = await Customer.findOne({ isGeneric: true });
        if (!genericCustomer) {
          [genericCustomer] = await Customer.create(
            [
              {
                name: "VENTA RÁPIDA",
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
       * 🧾 Generar código secuencial
       * ──────────────────────────────── */
      saleCode = await Counter.getNextSequence("SL", req.user.store, session);

      let subtotal = 0;
      const processedItems = [];

      /* ────────────────────────────────
       * 📦 Procesar productos
       * ──────────────────────────────── */
      for (const item of items) {
        // ✅ Soporte tanto para variant como variantId
        const variantId = item.variant || item.variantId || null;

        // Buscar la variante (si existe)
        const variant = variantId
          ? await Variant.findById(variantId).session(session)
          : null;

        // Buscar producto base
        const product = variant
          ? await Product.findById(variant.product).session(session)
          : await Product.findById(item.product).session(session);

        if (!product)
          throw new Error(
            `Producto no encontrado: ${item.product || "desconocido"}`
          );

        if (item.quantity <= 0)
          throw new Error(`Cantidad inválida para ${product.name}`);

        /* ────────────────────────────────
         * 💰 Cálculo de precios
         * ──────────────────────────────── */
        const basePrice = variant?.salePrice ?? product.salePrice;
        const hasDiscount =
          (variant?.discountPrice && variant.discountPrice < basePrice) ||
          (product.discountPrice && product.discountPrice < basePrice);

        let effectivePrice = basePrice;
        let discount = 0;

        if (hasDiscount && item.applyDiscount === true) {
          effectivePrice =
            variant?.discountPrice ?? product.discountPrice ?? basePrice;
          discount = basePrice - effectivePrice;
        }

        const itemSubtotal = effectivePrice * item.quantity;
        subtotal += itemSubtotal;

        /* ────────────────────────────────
         * 🧾 Registrar detalle de ítem
         * ──────────────────────────────── */
        processedItems.push({
          product: product._id,
          variant: variant?._id || null,
          name: variant ? `${product.name} (${variant.name})` : product.name,
          quantity: item.quantity,
          unitPrice: basePrice,
          discount,
          subtotal: itemSubtotal,
        });

        /* ────────────────────────────────
         * 📦 Actualizar inventario
         * ──────────────────────────────── */
        await registerMovementAndUpdateInventory({
          type: "OUT",
          reason: "SALE",
          productId: product._id,
          variantId: variant?._id || null,
          storeId: req.user.store,
          quantity: item.quantity,
          cost: variant?.costPrice || product.costPrice || 0,
          reference: saleCode,
          note: `Venta ${saleCode} realizada por ${req.user.firstName}`,
          userId: req.user.id,
          session,
        });
      }

      /* ────────────────────────────────
       * 💰 Totales e impuestos
       * ──────────────────────────────── */
      const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
      const pricesIncludeTax = true;

      let base = 0,
        tax = 0,
        total = 0;

      if (pricesIncludeTax) {
        base = subtotal / (1 + IGV_RATE);
        tax = subtotal - base;
        total = subtotal;
      } else {
        base = subtotal;
        tax = subtotal * IGV_RATE;
        total = subtotal + tax;
      }

      base = round2(base);
      tax = round2(tax);
      total = round2(total);
      subtotal = round2(subtotal);

      /* ────────────────────────────────
       * 🧾 Registrar venta
       * ──────────────────────────────── */
      const [newSale] = await Sale.create(
        [
          {
            code: saleCode,
            store: req.user.store,
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
     * 🔍 Obtener venta completa
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
      description: `Registró la venta ${
        saleResponse.code
      } (S/ ${saleResponse.total.toFixed(2)})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
    });

    /* ────────────────────────────────
     * ✅ Respuesta final
     * ──────────────────────────────── */
    return successResponse(
      res,
      201,
      "Venta registrada correctamente",
      saleResponse
    );
  } catch (error) {
    console.error("❌ Error creando venta:", error);
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
/**
 * @desc Obtener venta por ID
 * @route GET /api/v1/user/sales/:id
 * @access Private (User)
 */
exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "ID de venta inválido");

    const sale = await Sale.findOne({
      _id: id,
      store: req.user.store,
    })
      .populate("store", "name code")
      .populate("customer", "name documentNumber")
      .populate("createdBy", "firstName lastName");

    if (!sale)
      return errorResponse(
        res,
        404,
        "Venta no encontrada o no pertenece a tu tienda"
      );

    return successResponse(res, 200, "Venta obtenida correctamente", sale);
  } catch (error) {
    console.error("Error obteniendo venta:", error);
    return errorResponse(res, 500, "Error interno al obtener venta", error);
  }
};

/**
 * @desc Anular una venta (reversión de inventario)
 * @route PATCH /api/v1/user/sales/:id/cancel
 * @access Private (User)
 */
exports.cancelSale = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "ID de venta inválido");

    let cancelledSale;

    await session.withTransaction(async () => {
      const sale = await Sale.findOne({
        _id: id,
        store: req.user.store,
      }).session(session);

      if (!sale) throw new Error("Venta no encontrada en tu tienda");
      if (sale.status === "CANCELLED")
        throw new Error("La venta ya fue anulada");

      // 🔹 Revertir inventario de cada ítem
      for (const item of sale.items) {
        const variant = item.variant
          ? await Variant.findById(item.variant).session(session)
          : null;

        const product = variant
          ? await Product.findById(variant.product).session(session)
          : await Product.findById(item.product).session(session);

        if (!product) continue;

        // ✅ Registrar entrada de inventario (reversión)
        await registerMovementAndUpdateInventory({
          type: "IN",
          reason: "SALE_CANCELLED",
          productId: product._id,
          variantId: variant?._id || null,
          storeId: req.user.store,
          quantity: item.quantity,
          cost: variant?.costPrice || product.costPrice || 0,
          reference: sale.code,
          note: `Reversión por anulación de venta ${sale.code}`,
          userId: req.user.id,
          session,
        });
      }

      sale.status = "CANCELLED";
      sale.updatedBy = req.user.id;
      sale.deletedAt = new Date();
      await sale.save({ session });
      cancelledSale = sale;
    });

    // 🔹 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "CANCEL",
      module: "SALE",
      target: cancelledSale,
      description: `Anuló la venta ${cancelledSale.code}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
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

/**
 * @fileoverview Resumen analítico de ventas — Nexis ERP Pro
 * @desc KPIs completos: rendimiento diario, mensual, top productos, top clientes y ranking de vendedores.
 * @route GET /api/v1/user/sales/dashboard
 * @access Private (User)
 */
exports.getSalesDashboard = async (req, res) => {
  try {
    const storeId = req.user.store;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5; // 👈 opcional: ?limit=10 si quieres más

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfPrevMonth = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1
    );
    const endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    /* =======================================================
     * 🔹 1. VENTAS DEL DÍA
     * ======================================================= */
    const [dailySales] = await Sale.aggregate([
      {
        $match: {
          store: new mongoose.Types.ObjectId(storeId),
          createdBy: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: today },
          status: "PAID",
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          totalOrders: { $sum: 1 },
          avgTicket: { $avg: "$total" },
        },
      },
    ]);

    /* =======================================================
     * 🔹 2. VENTAS DEL MES ACTUAL
     * ======================================================= */
    const [monthlySales] = await Sale.aggregate([
      {
        $match: {
          store: new mongoose.Types.ObjectId(storeId),
          createdBy: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startOfMonth },
          status: "PAID",
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          totalOrders: { $sum: 1 },
          avgTicket: { $avg: "$total" },
        },
      },
    ]);

    /* =======================================================
     * 🔹 3. VENTAS DEL MES ANTERIOR (para comparar)
     * ======================================================= */
    const [previousMonth] = await Sale.aggregate([
      {
        $match: {
          store: new mongoose.Types.ObjectId(storeId),
          createdBy: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
          status: "PAID",
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    /* =======================================================
     * 🔹 4. TOP PRODUCTOS DEL MES
     * ======================================================= */
    const topProducts = await Sale.aggregate([
      {
        $match: {
          store: new mongoose.Types.ObjectId(storeId),
          createdBy: new mongoose.Types.ObjectId(userId),
          status: "PAID",
          createdAt: { $gte: startOfMonth },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          quantity: { $sum: "$items.quantity" },
          totalAmount: { $sum: "$items.subtotal" },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: limit },
    ]);

    /* =======================================================
     * 🔹 5. TOP CLIENTES DEL MES
     * ======================================================= */
    const topCustomers = await Sale.aggregate([
      {
        $match: {
          store: new mongoose.Types.ObjectId(storeId),
          createdBy: new mongoose.Types.ObjectId(userId),
          status: "PAID",
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true, // 👈 mantiene las ventas sin cliente
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$customer.name", "VENTA RÁPIDA"] }, // 👈 etiqueta fallback
          totalSpent: { $sum: "$total" },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: limit },
    ]);

    /* =======================================================
     * 🔹 6. TENDENCIA DE VENTAS POR DÍA
     * ======================================================= */
    const dailyTrend = await Sale.aggregate([
      {
        $match: {
          store: new mongoose.Types.ObjectId(storeId),
          createdBy: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startOfMonth },
          status: "PAID",
        },
      },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalSales: { $sum: "$total" },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]);

    const dailySalesData = dailyTrend.map((d) => ({
      date: `${String(d._id.day).padStart(2, "0")}/${d._id.month}`,
      totalSales: d.totalSales,
    }));

    /* =======================================================
     * 🔹 7. CRECIMIENTO MENSUAL
     * ======================================================= */
    const currentMonthSales = monthlySales?.totalSales || 0;
    const prevMonthSales = previousMonth?.totalSales || 0;

    const growthRate =
      prevMonthSales > 0
        ? (
            ((currentMonthSales - prevMonthSales) / prevMonthSales) *
            100
          ).toFixed(2)
        : 0;

    /* =======================================================
     * 🔹 8. CLIENTES NUEVOS EN EL MES
     * ======================================================= */
    const newCustomers = await Customer.countDocuments({
      store: storeId,
      createdAt: { $gte: startOfMonth },
    });

    /* =======================================================
     * 🔹 9. TOP VENDEDORES DEL MES
     * ======================================================= */
    const topSellers = await Sale.aggregate([
      {
        $match: {
          store: new mongoose.Types.ObjectId(storeId),
          status: "PAID",
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: "$createdBy",
          totalSales: { $sum: "$total" },
          totalOrders: { $sum: 1 },
          avgTicket: { $avg: "$total" },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$user._id",
          name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
          totalSales: 1,
          totalOrders: 1,
          avgTicket: 1,
        },
      },
    ]);

    /* =======================================================
     * 🔹 RESPUESTA FINAL (estructura profesional)
     * ======================================================= */
    const summary = {
      today: {
        totalSales: dailySales?.totalSales || 0,
        totalOrders: dailySales?.totalOrders || 0,
        avgTicket: dailySales?.avgTicket || 0,
      },
      month: {
        totalSales: monthlySales?.totalSales || 0,
        totalOrders: monthlySales?.totalOrders || 0,
        avgTicket: monthlySales?.avgTicket || 0,
        growthRate: Number(growthRate),
        previousMonth: previousMonth?.totalSales || 0,
        newCustomers,
      },
      topProducts,
      topCustomers,
      topSellers, // 🏆 Ranking de vendedores
      dailySales: dailySalesData,
    };

    return successResponse(
      res,
      200,
      "Dashboard de ventas actualizado",
      summary
    );
  } catch (error) {
    console.error("❌ Error obteniendo resumen de dashboard:", error);
    return errorResponse(
      res,
      500,
      "Error al obtener el resumen de ventas",
      error
    );
  }
};
