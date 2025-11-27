/**
 * ============================================
 * DATABASE - database.js (VERSIÓN PRODUCCIÓN)
 * Gestión de base de datos SQLite robusta
 * ============================================
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();

// ============================================
// DEFINIR RUTA DE BASE DE DATOS SEGÚN ENTORNO
// ============================================

// Carpeta "data" segura y con permisos de escritura
const DATA_DIR = path.join(__dirname, "..", "data");

// Crear carpeta si no existe
if (!fs.existsSync(DATA_DIR)) {
    console.log("📁 Creando carpeta /data para la base de datos...");
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Permitir especificar ruta personalizada desde .env
const DB_PATH =
    process.env.DB_PATH ||
    path.join(DATA_DIR, "agromarket.db");

console.log("📌 Ruta final BD:", DB_PATH);

let db = null;

// ============================================
// INICIALIZACIÓN DE BASE DE DATOS
// ============================================

function initializeDatabase() {
    db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error("❌ Error abriendo la BD:", err.message);
            process.exit(1);
        }
        console.log("✅ SQLite cargado correctamente");
    });

    // Foreign keys ON
    db.run("PRAGMA foreign_keys = ON");

    createTables();
    createDefaultAdmin();
}

// ============================================
// CREAR TABLAS
// ============================================

function createTables() {
    const tableQueries = [
        `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'customer',
            status TEXT DEFAULT 'active',
            reset_token TEXT,
            reset_token_expires INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        `,
        `
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            stock INTEGER NOT NULL,
            min_stock INTEGER DEFAULT 10,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        `,
        `
        CREATE TABLE IF NOT EXISTS inventory_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            previous_stock INTEGER NOT NULL,
            new_stock INTEGER NOT NULL,
            notes TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );
        `,
        `
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total REAL NOT NULL,
            payment_method TEXT NOT NULL,
            payment_status TEXT DEFAULT 'pending',
            transaction_id TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        `,
        `
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            subtotal REAL NOT NULL,
            FOREIGN KEY (sale_id) REFERENCES sales(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
        `,
        `
        CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
        `
    ];

    tableQueries.forEach((query) => db.run(query));

    console.log("✅ Tablas creadas/verificadas");
}

// ============================================
// CREAR ADMIN POR DEFECTO
// ============================================

function createDefaultAdmin() {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@agromarket.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    db.get("SELECT id FROM users WHERE email = ?", [adminEmail], async (err, row) => {
        if (err) return console.error("Error leyendo admin:", err);

        if (!row) {
            const hashed = await bcrypt.hash(adminPassword, 10);

            db.run(
                `
                INSERT INTO users (name, email, password, role)
                VALUES (?, ?, ?, 'admin')
            `,
                ["Administrador", adminEmail, hashed],
                (err) => {
                    if (err) console.log("⚠ Error creando admin:", err);
                    else console.log("👑 Admin creado:", adminEmail);
                }
            );
        }
    });
}

// ============================================
// (TODAS LAS MISMAS FUNCIONES QUE YA TENÍAS)
// OMITIDAS AQUÍ PARA NO DUPLICAR 1000 LÍNEAS
// 💬 Las mantengo intactas como tú las enviastes
// ============================================

// (PEGAR AQUÍ TODAS LAS FUNCIONES EXACTAS QUE YA TENÍAS)


// ============================================
// EXPORTAR
// ============================================

module.exports = {
    // Usuarios
    createUser,
    findUserByEmail,
    findUserById,
    updateUserResetToken,
    getAllUsers,

    // Productos
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    updateStock,
    getLowStockProducts,
    getProductCategories,
    getProductStatistics,
    searchProducts,

    // Inventario
    logInventoryChange,
    getInventoryLog,

    // Ventas
    createSale,
    getSalesByUser,
    getAllSales,
    getSaleDetails,
    updateSaleStatus,
    getSaleByTransactionId,
    logRefund,
    getSalesSummary,
    getSalesByPeriod,
    getTopSellingProducts,
    getSalesByCustomer,
    getSalesStatistics,
    getSalesByDate,

    // Dashboard
    getDashboardStats,

    // Utilidades
    isConnected,
    close
};
