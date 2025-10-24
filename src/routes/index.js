/**
 * @fileoverview Rutas principales de la API (ERP + E-commerce)
 * @module routes/index
 */

const express = require("express");
const router = express.Router();

/* ============================
 * RUTAS DE E-COMMERCE (Públicas)
 * ============================ */
const ecommerceProductRoutes = require("@ecommerce/modules/products_services/product_service/routes/product.routes");
const ecommerceOrderRoutes = require("@ecommerce/modules/orders_services/orders_service/routes/order.routes");
// const ecommerceUserRoutes = require("@ecommerce/modules/users_service/routes/user.routes");
// const ecommerceOrderRoutes = require("@ecommerce/modules/orders_service/routes/order.routes");

router.use("/ecommerce/products", ecommerceProductRoutes);
// router.use("/ecommerce/users", ecommerceUserRoutes);
// router.use("/ecommerce/orders", ecommerceOrderRoutes);

/* ============================
 * RUTAS DE USUARIOS (ERP)
 * ============================ */
const authRoutes = require("@user/modules/users_services/auth_service/routes/authRoute");
const userRoutes = require("@user/modules/users_services/user_service/routes/userRoute");
const sessionRoute = require("@user/modules/users_services/session_service/routes/sessionRoute");
const productRoute = require("@user/modules/products_services/product_service/routes/productRoute");
const categoryRoute = require("@user/modules/products_services/category_service/routes/categoryRoute");
const variantRoute = require("@user/modules/products_services/variant_service/routes/variantRoute");
const storeRoutes = require("@user/modules/store_services/store_service/routes/storeRoutes");
const saleUserRoutes = require("@user/modules/sales_services/sales_service/routes/saleUserRoutes");
const inventoryUserRoutes = require("@user/modules/inventory_services/inventory_service/routes/inventoryUser.routes");
const customerUserRoutes = require("@user/modules/customers_services/customer_service/routes/customerUser.routes");
const externalLookupRoutes = require("@user/modules/system_services/external_lookup_service/routes/externalLookup.routes");

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/sessions", sessionRoute);
router.use("/products", productRoute);
router.use("/categories", categoryRoute);
router.use("/variants", variantRoute);
router.use("/stores", storeRoutes);
router.use("/sales", saleUserRoutes);
router.use("/inventory", inventoryUserRoutes);
router.use("/customers", customerUserRoutes);
router.use("/external", externalLookupRoutes);

/* ============================
 * RUTAS DE ADMINISTRACIÓN (Manager / ERP)
 * ============================ */
const authManagerRoutes = require("@manager/modules/users_services/auth_services/routes/authManager.routes");
const permissionManagerRoutes = require("@manager/modules/users_services/permission_service/routes/permissionManager.routes");
const managerUserRoutes = require("@manager/modules/users_services/user_service/routes/userManager.routes");
const roleManagerRoutes = require("@manager/modules/users_services/role_service/routes/roleManager.routes");
const productManagerRoutes = require("@manager/modules/products_services/product_service/routes/productManager.routes");
const categoryManagerRoutes = require("@manager/modules/products_services/category_service/routes/categoryManager.routes");
const variantManagerRoutes = require("@manager/modules/products_services/variant_service/routes/variantManager.routes");
const storeManagerRoutes = require("@manager/modules/store_services/routes/storeManager.routes");
const saleManagerRoutes = require("@manager/modules/sales_services/sales_service/routes/saleManager.routes");
const inventoryManagerRoutes = require("@manager/modules/inventory_services/inventory_service/routes/inventoryManager.routes");
const customerManagerRoutes = require("@manager/modules/users_services/customer_service/routes/customerManager.routes");

router.use("/admin/auth", authManagerRoutes);
router.use("/admin/users", managerUserRoutes);
router.use("/admin/permissions", permissionManagerRoutes);
router.use("/admin/roles", roleManagerRoutes);
router.use("/admin/products", productManagerRoutes);
router.use("/admin/categories", categoryManagerRoutes);
router.use("/admin/variants", variantManagerRoutes);
router.use("/admin/stores", storeManagerRoutes);
router.use("/admin/sales", saleManagerRoutes);
router.use("/admin/inventory", inventoryManagerRoutes);
router.use("/admin/customers", customerManagerRoutes);

module.exports = router;
