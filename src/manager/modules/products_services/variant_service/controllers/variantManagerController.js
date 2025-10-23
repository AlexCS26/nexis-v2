/**
 * @fileoverview Controlador de variantes para administradores / manager
 * @module admin/controllers/variantManagerController
 */

const mongoose = require("mongoose");
const Variant = require("../../../../../user/modules/products_services/variant_service/models/variant.model");
const Product = require("../../../../../user/modules/products_services/product_service/models/product.model");
const {
  successResponse,
  errorResponse,
} = require("../../../../../utils/responseUtils");
const { registerAudit } = require("../../../../../utils/auditUtils");
const {
  registerMovementAndUpdateInventory,
} = require("../../../../../utils/inventoryUtils");
const Counter = require("../../../system_services/counter_service/models/counter.model");

/**
 * @desc Listar variantes con filtros y paginación
 * @route GET /api/v1/admin/variants
 * @access Private (Admin/Manager)
 */
exports.listVariants = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status, product } = req.query;

    const query = { store: req.user.store }; // ✅ Filtrar por tienda del usuario

    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { sku: new RegExp(search, "i") },
        { barcode: new RegExp(search, "i") },
      ];
    }

    if (status) query.status = status;
    if (product) query.product = product;

    const skip = (page - 1) * limit;

    const [variants, total] = await Promise.all([
      Variant.find(query)
        .populate("product", "name code")
        .populate("store", "name code")
        .populate("createdBy", "firstName lastName")
        .populate("updatedBy", "firstName lastName")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Variant.countDocuments(query),
    ]);

    return successResponse(
      res,
      200,
      "Variants retrieved successfully",
      variants,
      {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      }
    );
  } catch (error) {
    console.error("Error fetching variants:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};
/**
 * @desc Crear una nueva variante y vincularla al producto
 * @route POST /api/v1/admin/variants
 * @access Private (Admin/Manager)
 */
exports.createVariant = async (req, res) => {
  const session = await mongoose.startSession();
  let newVariantId = null;

  try {
    await session.withTransaction(async () => {
      let {
        name,
        sku,
        barcode,
        product,
        attributes,
        stock = 0,
        costPrice = 0,
        salePrice,
        discountPrice,
        images,
      } = req.body;

      // ✅ Permitir tanto ID directo como objeto producto
      const productId =
        typeof product === "object" && product !== null ? product._id : product;

      if (!name || !productId || !salePrice) {
        throw new Error("Required fields missing: name, product, salePrice");
      }

      // ✅ Validar existencia del producto
      const productExists = await Product.findById(productId)
        .session(session)
        .select("_id variants name");
      if (!productExists) {
        throw new Error("Product not found or invalid product ID");
      }

      // ✅ Verificar duplicados por tienda
      const existingVariant = await Variant.findOne({
        $or: [{ sku }, { barcode }],
        store: req.user.store,
      }).session(session);

      if (existingVariant)
        throw new Error("SKU or Barcode already exists in this store");

      // 🔢 Generar código secuencial único por tienda
      const variantCode = await Counter.getNextSequence(
        "VR",
        req.user.store,
        session
      );

      // ✅ Crear variante
      const [createdVariant] = await Variant.create(
        [
          {
            code: variantCode,
            name,
            sku,
            barcode,
            product: productId,
            attributes,
            stock,
            costPrice,
            salePrice,
            discountPrice,
            images,
            store: req.user.store,
            createdBy: req.user.id,
          },
        ],
        { session }
      );

      newVariantId = createdVariant._id;

      // ✅ Vincular variante al producto (solo si no está ya incluida)
      if (!productExists.variants?.includes(createdVariant._id)) {
        productExists.variants.push(createdVariant._id);
        await productExists.save({ session });
      }

      // ✅ Registrar inventario si tiene stock inicial
      if (stock > 0) {
        await registerMovementAndUpdateInventory({
          type: "IN",
          reason: "INVENTORY_INIT",
          productId: productId,
          variantId: createdVariant._id,
          storeId: req.user.store,
          quantity: stock,
          cost: costPrice,
          reference: variantCode,
          note: `Stock inicial de la variante ${createdVariant.name}`,
          userId: req.user.id,
          session,
        });
      }
    });

    // ✅ Obtener variante completa ya persistida
    const variantResponse = await Variant.findById(newVariantId)
      .populate("product", "name code")
      .populate("store", "name code")
      .populate("createdBy", "firstName lastName");

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "CREATE",
      module: "VARIANT",
      target: variantResponse,
      description: `Creó la variante "${variantResponse.name}" (${variantResponse.code}) del producto "${variantResponse.product?.name}"`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
    });

    return successResponse(
      res,
      201,
      "Variant created successfully and linked to product",
      variantResponse
    );
  } catch (error) {
    console.error("Error creating variant:", error);
    if (error.message.includes("exists"))
      return errorResponse(res, 400, error.message);
    if (
      error.message.includes("Required fields") ||
      error.message.includes("Product not found")
    )
      return errorResponse(res, 400, error.message);

    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Actualizar una variante (sin regenerar código)
 * @route PUT /api/v1/admin/variants/:id
 * @access Private (Admin/Manager)
 */
exports.updateVariant = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid variant ID");

    let updatedVariant;

    await session.withTransaction(async () => {
      const variantBefore = await Variant.findOne({
        _id: id,
        store: req.user.store,
      }).session(session);

      if (!variantBefore) throw new Error("Variant not found in your store");

      const updates = {
        ...req.body,
        updatedBy: req.user.id,
        updatedAt: new Date(),
      };

      delete updates.createdBy;
      delete updates.store;
      delete updates.code;

      updatedVariant = await Variant.findByIdAndUpdate(id, updates, {
        new: true,
        session,
      })
        .populate("product", "name code")
        .populate("store", "name code")
        .populate("updatedBy", "firstName lastName");

      // ⚙️ Detectar cambio manual de stock
      const newStock = req.body.stock;
      const oldStock = variantBefore.stock;

      if (typeof newStock === "number" && newStock !== oldStock) {
        const diff = newStock - oldStock;
        const type = diff > 0 ? "IN" : "OUT";
        const qty = Math.abs(diff);

        await registerMovementAndUpdateInventory({
          type,
          reason: "ADJUSTMENT",
          productId: variantBefore.product,
          variantId: variantBefore._id,
          storeId: req.user.store,
          quantity: qty,
          cost: req.body.costPrice || variantBefore.costPrice || 0,
          reference: variantBefore.code,
          note: `Ajuste de stock manual (${type}) en variante ${variantBefore.name}`,
          userId: req.user.id,
          session,
        });
      }
    });

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "UPDATE",
      module: "VARIANT",
      target: updatedVariant,
      description: `Actualizó la variante "${updatedVariant.name}" (${updatedVariant.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
    });

    return successResponse(
      res,
      200,
      "Variant updated successfully",
      updatedVariant
    );
  } catch (error) {
    console.error("Error updating variant:", error);
    if (error.message === "Variant not found in your store")
      return errorResponse(res, 404, error.message);

    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Cambiar estado de una variante (sin regenerar código)
 * @route PATCH /api/v1/admin/variants/:id/status
 * @access Private (Admin/Manager)
 */
exports.updateStatus = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid variant ID");
    if (!["ACTIVE", "INACTIVE", "DISCONTINUED"].includes(status))
      return errorResponse(res, 400, "Invalid status");

    let updatedVariant;

    await session.withTransaction(async () => {
      const variantBefore = await Variant.findOne({
        _id: id,
        store: req.user.store,
      }).session(session);

      if (!variantBefore) throw new Error("Variant not found in your store");

      updatedVariant = await Variant.findByIdAndUpdate(
        id,
        {
          status,
          updatedBy: req.user.id,
          statusChangeDate: new Date(),
        },
        { new: true, session }
      )
        .populate("product", "name code")
        .populate("store", "name code")
        .populate("updatedBy", "firstName lastName");
    });

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "STATUS_CHANGE",
      module: "VARIANT",
      target: updatedVariant,
      description: `Cambió el estado de la variante "${updatedVariant.name}" a ${status}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
    });

    return successResponse(
      res,
      200,
      `Status updated to ${status}`,
      updatedVariant
    );
  } catch (error) {
    console.error("Error updating variant status:", error);
    if (error.message === "Variant not found in your store") {
      return errorResponse(res, 404, error.message);
    }
    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Eliminar una variante (soft delete sin cambiar código)
 * @route DELETE /api/v1/admin/variants/:id
 * @access Private (Admin/Manager)
 */
exports.deleteVariant = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid variant ID");

    let deletedVariant;

    await session.withTransaction(async () => {
      const variantBefore = await Variant.findOne({
        _id: id,
        store: req.user.store,
      }).session(session);

      if (!variantBefore) throw new Error("Variant not found in your store");

      deletedVariant = await Variant.findByIdAndUpdate(
        id,
        {
          status: "INACTIVE",
          deletedAt: new Date(),
          updatedBy: req.user.id,
        },
        { new: true, session }
      )
        .populate("product", "name code")
        .populate("store", "name code")
        .populate("updatedBy", "firstName lastName");
    });

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "DELETE",
      module: "VARIANT",
      target: deletedVariant,
      description: `Eliminó la variante "${deletedVariant.name}" (${deletedVariant.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
    });

    return successResponse(
      res,
      200,
      "Variant deleted successfully",
      deletedVariant
    );
  } catch (error) {
    console.error("Error deleting variant:", error);
    if (error.message === "Variant not found in your store") {
      return errorResponse(res, 404, error.message);
    }
    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Obtener una variante por ID
 * @route GET /api/v1/admin/variants/:id
 * @access Private (Admin/Manager)
 */
exports.getVariantById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid variant ID");

    const variant = await Variant.findOne({
      _id: id,
      store: req.user.store,
    })
      .populate("product", "name code")
      .populate("store", "name code")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!variant)
      return errorResponse(res, 404, "Variant not found in your store");

    return successResponse(res, 200, "Variant retrieved successfully", variant);
  } catch (error) {
    console.error("Error fetching variant by ID:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};
