/**
 * @fileoverview Controlador de productos para administradores / manager
 * @module admin/controllers/productManagerController
 * @description Operaciones CRUD y gestión de productos y variantes con auditoría robusta.
 */

const mongoose = require("mongoose");
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
 * @desc Listar productos con filtros, búsqueda y paginación
 * @route GET /api/v1/admin/products
 * @access Private (Admin/Manager)
 */
exports.listProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status, category } = req.query;
    const query = { store: req.user.store }; // ✅ Filtrar productos por la tienda del usuario

    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { sku: new RegExp(search, "i") },
        { barcode: new RegExp(search, "i") },
      ];
    }

    if (status) query.status = status;
    if (category) query.category = category;

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("category", "name code")
        .populate("variants")
        .populate("store", "name code")
        .populate("createdBy", "firstName lastName")
        .populate("updatedBy", "firstName lastName")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Product.countDocuments(query),
    ]);

    return successResponse(
      res,
      200,
      "Products retrieved successfully",
      products,
      {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      }
    );
  } catch (error) {
    console.error("Error fetching products:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};

/**
 * @desc Crear un nuevo producto (único punto donde se genera código secuencial)
 * @route POST /api/v1/admin/products
 * @access Private (Admin/Manager)
 */
exports.createProduct = async (req, res) => {
  const session = await mongoose.startSession();
  let newProductId = null;

  try {
    await session.withTransaction(async () => {
      const {
        name,
        description,
        sku,
        barcode,
        category,
        stock = 0,
        minStock,
        maxStock,
        costPrice = 0,
        salePrice,
        discountPrice,
        images,
        variants,
      } = req.body;

      // ✅ Verificar duplicados dentro de la misma tienda
      const existingProduct = await Product.findOne({
        $or: [{ sku }, { barcode }],
        store: req.user.store,
      }).session(session);

      if (existingProduct)
        throw new Error("SKU or Barcode already exists in this store");

      // 🔥 Generar código secuencial por tienda
      const productCode = await Counter.getNextSequence(
        "PR",
        req.user.store,
        session
      );

      // ✅ Crear el producto
      const [createdProduct] = await Product.create(
        [
          {
            code: productCode,
            name,
            description,
            sku,
            barcode,
            category,
            stock,
            minStock,
            maxStock,
            costPrice,
            salePrice,
            discountPrice,
            images,
            variants,
            store: req.user.store,
            createdBy: req.user.id,
          },
        ],
        { session }
      );

      newProductId = createdProduct._id;

      // ✅ Si tiene stock inicial, registramos movimiento + inventario
      if (stock > 0) {
        await registerMovementAndUpdateInventory({
          type: "IN",
          reason: "INVENTORY_INIT",
          productId: createdProduct._id,
          variantId: null,
          storeId: req.user.store,
          quantity: stock,
          cost: costPrice,
          reference: productCode,
          note: `Stock inicial del producto ${createdProduct.name}`,
          userId: req.user.id,
          session,
        });
      }
    });

    // 🧾 Obtener producto actualizado con populate
    const productResponse = await Product.findById(newProductId)
      .populate("category", "name code")
      .populate("store", "name code")
      .populate("createdBy", "firstName lastName");

    // 🧾 Auditoría de creación
    await registerAudit({
      userId: req.user.id,
      action: "CREATE",
      module: "PRODUCT",
      target: productResponse,
      description: `Creó el producto "${productResponse.name}" (${productResponse.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
    });

    return successResponse(
      res,
      201,
      "Product created successfully",
      productResponse
    );
  } catch (error) {
    console.error("Error creating product:", error);
    return errorResponse(
      res,
      500,
      error.message || "Internal server error",
      error
    );
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Actualizar un producto (sin cambiar código)
 * @route PUT /api/v1/admin/products/:id
 * @access Private (Admin/Manager)
 */
exports.updateProduct = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid product ID");

    let updatedProduct;

    await session.withTransaction(async () => {
      const productBefore = await Product.findOne({
        _id: id,
        store: req.user.store,
      }).session(session);

      if (!productBefore) throw new Error("Product not found in your store");

      const updates = {
        ...req.body,
        updatedBy: req.user.id,
        updatedAt: new Date(),
      };

      delete updates.createdBy;
      delete updates.store;
      delete updates.code; // ✅ Mantener el mismo código

      updatedProduct = await Product.findByIdAndUpdate(id, updates, {
        new: true,
        session,
      })
        .populate("category", "name code")
        .populate("variants")
        .populate("store", "name code")
        .populate("updatedBy", "firstName lastName");

      // ⚙️ Detectar cambio de stock (ajuste manual)
      const newStock = req.body.stock;
      const oldStock = productBefore.stock;

      if (typeof newStock === "number" && newStock !== oldStock) {
        const diff = newStock - oldStock;
        const type = diff > 0 ? "IN" : "OUT";
        const qty = Math.abs(diff);

        await registerMovementAndUpdateInventory({
          type,
          reason: "ADJUSTMENT",
          productId: productBefore._id,
          variantId: null,
          storeId: req.user.store,
          quantity: qty,
          cost: req.body.costPrice || productBefore.costPrice || 0,
          reference: productBefore.code,
          note: `Ajuste de stock manual (${type}) realizado por manager`,
          userId: req.user.id,
          session,
        });
      }
    });

    // 🧾 Auditoría general
    await registerAudit({
      userId: req.user.id,
      action: "UPDATE",
      module: "PRODUCT",
      target: updatedProduct,
      description: `Actualizó el producto "${updatedProduct.name}" (${updatedProduct.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
    });

    return successResponse(
      res,
      200,
      "Product updated successfully",
      updatedProduct
    );
  } catch (error) {
    console.error("Error updating product:", error);
    if (error.message === "Product not found in your store") {
      return errorResponse(res, 404, error.message);
    }
    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Cambiar estado del producto (sin regenerar código)
 * @route PATCH /api/v1/admin/products/:id/status
 * @access Private (Admin/Manager)
 */
exports.updateStatus = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid product ID");
    if (!["ACTIVE", "INACTIVE", "DISCONTINUED"].includes(status))
      return errorResponse(res, 400, "Invalid status");

    let updatedProduct;

    await session.withTransaction(async () => {
      const productBefore = await Product.findOne({
        _id: id,
        store: req.user.store,
      }).session(session);

      if (!productBefore) throw new Error("Product not found in your store");

      updatedProduct = await Product.findByIdAndUpdate(
        id,
        {
          status,
          updatedBy: req.user.id,
          statusChangeDate: new Date(),
        },
        { new: true, session }
      )
        .populate("category", "name code")
        .populate("variants")
        .populate("store", "name code")
        .populate("updatedBy", "firstName lastName");
    });

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "STATUS_CHANGE",
      module: "PRODUCT",
      target: updatedProduct,
      description: `Cambió estado del producto "${updatedProduct.name}" a ${status}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
    });

    return successResponse(
      res,
      200,
      `Status updated to ${status}`,
      updatedProduct
    );
  } catch (error) {
    console.error("Error updating product status:", error);
    if (error.message === "Product not found in your store") {
      return errorResponse(res, 404, error.message);
    }
    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Eliminar un producto (soft delete sin cambiar código)
 * @route DELETE /api/v1/admin/products/:id
 * @access Private (Admin/Manager)
 */
exports.deleteProduct = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid product ID");

    let deletedProduct;

    await session.withTransaction(async () => {
      const productBefore = await Product.findOne({
        _id: id,
        store: req.user.store,
      }).session(session);

      if (!productBefore) throw new Error("Product not found in your store");

      deletedProduct = await Product.findByIdAndUpdate(
        id,
        {
          status: "INACTIVE",
          deletedAt: new Date(),
          updatedBy: req.user.id,
        },
        { new: true, session }
      )
        .populate("category", "name code")
        .populate("variants")
        .populate("store", "name code")
        .populate("updatedBy", "firstName lastName");
    });

    // 🧾 Auditoría
    await registerAudit({
      userId: req.user.id,
      action: "DELETE",
      module: "PRODUCT",
      target: deletedProduct,
      description: `Eliminó el producto "${deletedProduct.name}" (${deletedProduct.code})`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      storeId: req.user.store,
    });

    return successResponse(
      res,
      200,
      "Product deleted successfully",
      deletedProduct
    );
  } catch (error) {
    console.error("Error deleting product:", error);
    if (error.message === "Product not found in your store") {
      return errorResponse(res, 404, error.message);
    }
    return errorResponse(res, 500, "Internal server error", error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc Obtener un producto por ID (solo de la tienda del usuario)
 * @route GET /api/v1/admin/products/:id
 * @access Private (Admin/Manager)
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return errorResponse(res, 400, "Invalid product ID");

    const product = await Product.findOne({
      _id: id,
      store: req.user.store,
    })
      .populate("category", "name code")
      .populate("variants")
      .populate("store", "name code")
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!product)
      return errorResponse(res, 404, "Product not found in your store");

    return successResponse(res, 200, "Product retrieved successfully", product);
  } catch (error) {
    console.error("Error fetching product by ID:", error);
    return errorResponse(res, 500, "Internal server error", error);
  }
};
