/**
 * @fileoverview Rutas principales de la API para servicios de usuario y administración.
 * @module routes/index
 */

const express = require("express");
const router = express.Router();

/* ============================
 * RUTAS DE E-COMMERCE (Públicas)
 * ============================ */
const ecommerceProductRoutes = require("../modules/ecommerce/modules/products_services/product_service/routes/product.routes");
const ecommerceOrderRoutes = require("../modules/ecommerce/modules/orders_services/orders_service/routes/order.routes");
// const ecommerceUserRoutes = require("@ecommerce/modules/users_service/routes/user.routes");
// const ecommerceOrderRoutes = require("@ecommerce/modules/orders_service/routes/order.routes");

router.use("/ecommerce/products", ecommerceProductRoutes);
router.use("/ecommerce/orders", ecommerceOrderRoutes);
// router.use("/ecommerce/users", ecommerceUserRoutes);
/* ============================
 * RUTAS DE USUARIO / CLIENTE
 * ============================ */

/**
 * Gestión de usuarios (registro, perfil, actualización)
 * @path /api/v1/users
 * @access Public / Authenticated (según endpoint)
 */
const userRoutes = require("../modules/user/modules/users_services/user_service/routes/userRoute");

/**
 * Gestión de productos visibles al usuario final
 * @path /api/v1/products
 * @access Public
 */
const productRoute = require("../modules/user/modules/products_services/product_service/routes/productRoute");
const categoryRoute = require("../modules/user/modules/products_services/category_service/routes/categoryRoute");
const variantRoute = require("../modules/user/modules/products_services/variant_service/routes/variantRoute");
const storeRoutes = require("../modules/user/modules/store_services/store_service/routes/storeRoutes");
const saleUserRoutes = require("../modules/user/modules/sales_services/sales_service/routes/saleUserRoutes");
const inventoryUserRoutes = require("../modules/user/modules/inventory_services/inventory_service/routes/inventoryUser.routes");
const customerUserRoutes = require("../modules/user/modules/customers_services/customer_service/routes/customerUser.routes");
const externalLookupRoutes = require("../modules/user/modules/system_services/external_lookup_service/routes/externalLookup.routes");

/**
 * Autenticación de usuarios (login, refresh token, logout)
 * @path /api/v1/auth
 * @access Public
 */
const authRoutes = require("../modules/user/modules/users_services/auth_service/routes/authRoute");

/**
 * Gestión de sesiones de usuario
 * @path /api/v1/sessions
 * @access Authenticated
 */
const sessionRoute = require("../modules/user/modules/users_services/session_service/routes/sessionRoute");

/* ============================
 * RUTAS DE ADMINISTRACIÓN / GERENCIA
 * ============================ */

/**
 * Autenticación de managers/admins
 * @path /api/v1/admin/auth
 * @access Private (Manager/Admin)
 */
const authManagerRoutes = require("../modules/manager/modules/users_services/auth_services/routes/authManager.routes");

/**
 * Gestión de permisos del sistema
 * @path /api/v1/admin/permissions
 * @access Private (Admin/Manager)
 */
const permissionManagerRoutes = require("../modules/manager/modules/users_services/permission_service/routes/permissionManager.routes");

/**
 * Gestión de usuarios por parte de administradores o managers
 * @path /api/v1/admin/users
 * @access Private (Admin/Manager)
 */
const managerUserRoutes = require("../modules/manager/modules/users_services/user_service/routes/userManager.routes");

/**
 * Gestión de roles y asignación de permisos
 * @path /api/v1/admin/roles
 * @access Private (Admin/Manager)
 */
const roleManagerRoutes = require("../modules/manager/modules/users_services/role_service/routes/roleManager.routes");

/**
 * Gestión de productos (CRUD, variantes, stock) para admin/manager
 * @path /api/v1/admin/products
 * @access Private (Admin/Manager)
 */
const productManagerRoutes = require("../modules/manager/modules/products_services/product_service/routes/productManager.routes");
const categoryManagerRoutes = require("../modules/manager/modules/products_services/category_service/routes/categoryManager.routes");
const variantManagerRoutes = require("../modules/manager/modules/products_services/variant_service/routes/variantManager.routes");
const storeManagerRoutes = require("../modules/manager/modules/store_services/routes/storeManager.routes");
const saleManagerRoutes = require("../modules/manager/modules/sales_services/sales_service/routes/saleManager.routes");
const inventoryManagerRoutes = require("../modules/manager/modules/inventory_services/inventory_service/routes/inventoryManager.routes");
const customerManagerRoutes = require("../modules/manager/modules/users_services/customer_service/routes/customerManager.routes");

/* ============================
 * MONTAJE DE RUTAS
 * ============================ */

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
