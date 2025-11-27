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

const DATA_DIR = path.join(__dirname, "..", "data");

if (!fs.existsSync(DATA_DIR)) {
    console.log("📁 Creando carpeta /data para la base de datos...");
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "agromarket.db");

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

    db.run("PRAGMA foreign_keys = ON");

    createTables();
    createDefaultAdmin();
}

// ============================================
// CREAR TABLAS
// ============================================

function createTables() {
    const queries = [

        // --- USERS ---
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

        // --- PRODUCTS ---
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

        // --- SALES ---
        `
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total REAL NOT NULL,
            payment_method TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        `,

        // --- SALE_ITEMS ---
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

        // --- CART ---
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
        `,

        // --- INVENTORY LOG ---
        `
        CREATE TABLE IF NOT EXISTS inventory_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            previous_stock INTEGER NOT NULL,
            new_stock INTEGER NOT NULL,
            created_by INTEGER,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );
        `,
    ];

    queries.forEach((q) => db.run(q));

    console.log("✅ Tablas creadas/verificadas");
}

// ============================================
// CREAR ADMIN POR DEFECTO
// ============================================

function createDefaultAdmin() {
    const email = process.env.ADMIN_EMAIL || "admin@agromarket.com";
    const password = process.env.ADMIN_PASSWORD || "admin123";

    db.get("SELECT id FROM users WHERE email = ?", [email], async (err, row) => {
        if (err) return console.error(err);

        if (!row) {
            const hashed = await bcrypt.hash(password, 10);

            db.run(
                `
                INSERT INTO users (name, email, password, role)
                VALUES (?, ?, ?, 'admin')
            `,
                ["Administrador", email, hashed],
                (err) => {
                    if (err) console.error("Error creando admin:", err);
                    else console.log("👑 Admin creado:", email);
                }
            );
        }
    });
}

// ======================================================
// 🔥 FUNCIONES COMPLETAS PARA USUARIOS
// ======================================================

function createUser(name, email, password, role = "customer") {
    return new Promise(async (resolve, reject) => {
        try {
            const hashed = await bcrypt.hash(password, 10);

            db.run(
                `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
                [name, email, hashed, role],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id: this.lastID });
                }
            );
        } catch (e) {
            reject(e);
        }
    });
}

function findUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function findUserById(id) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function getAllUsers() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM users ORDER BY id DESC`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function updateUserResetToken(email, token, expires) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?`,
            [token, expires, email],
            function (err) {
                if (err) reject(err);
                else resolve(true);
            }
        );
    });
}

// ======================================================
// 🔥 FUNCIONES COMPLETAS PARA PRODUCTOS
// ======================================================

function createProduct(data) {
    const { name, category, description, price, stock, min_stock } = data;

    return new Promise((resolve, reject) => {
        db.run(
            `
            INSERT INTO products (name, category, description, price, stock, min_stock) 
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [name, category, description, price, stock, min_stock],
            function (err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
            }
        );
    });
}

function getAllProducts() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM products ORDER BY id DESC`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getProductById(id) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM products WHERE id = ?`, [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function updateProduct(id, data) {
    const { name, category, description, price, stock, min_stock } = data;

    return new Promise((resolve, reject) => {
        db.run(
            `
            UPDATE products SET 
                name=?, category=?, description=?, price=?, stock=?, min_stock=?, 
                updated_at=CURRENT_TIMESTAMP 
            WHERE id=?
            `,
            [name, category, description, price, stock, min_stock, id],
            function (err) {
                if (err) reject(err);
                else resolve(true);
            }
        );
    });
}

function deleteProduct(id) {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM products WHERE id = ?`, [id], function (err) {
            if (err) reject(err);
            else resolve(true);
        });
    });
}

function updateStock(id, newStock) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE products SET stock=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [newStock, id],
            function (err) {
                if (err) reject(err);
                else resolve(true);
            }
        );
    });
}

// ======================================================
// 🔥 INVENTARIO
// ======================================================

function logInventoryChange(data) {
    const {
        product_id,
        type,
        quantity,
        previous_stock,
        new_stock,
        created_by,
        notes,
    } = data;

    return new Promise((resolve, reject) => {
        db.run(
            `
            INSERT INTO inventory_log 
            (product_id, type, quantity, previous_stock, new_stock, created_by, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [product_id, type, quantity, previous_stock, new_stock, created_by, notes],
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

function getInventoryLog() {
    return new Promise((resolve, reject) => {
        db.all(
            `
            SELECT log.*, p.name AS product_name, u.name AS user_name
            FROM inventory_log log
            LEFT JOIN products p ON p.id = log.product_id
            LEFT JOIN users u ON u.id = log.created_by
            ORDER BY log.id DESC
            `,
            [],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

// ======================================================
// 🔥 CARRITO
// ======================================================

function addToCart(user_id, product_id, quantity) {
    return new Promise((resolve, reject) => {
        db.run(
            `
            INSERT INTO cart (user_id, product_id, quantity)
            VALUES (?, ?, ?)
            `,
            [user_id, product_id, quantity],
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

function getCart(user_id) {
    return new Promise((resolve, reject) => {
        db.all(
            `
            SELECT c.*, p.name, p.price 
            FROM cart c 
            JOIN products p ON p.id = c.product_id
            WHERE c.user_id = ?
            `,
            [user_id],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

function clearCart(user_id) {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM cart WHERE user_id=?`, [user_id], function (err) {
            if (err) reject(err);
            else resolve(true);
        });
    });
}

// ======================================================
// 🔥 VENTAS
// ======================================================

function createSale(user_id, total, payment_method) {
    return new Promise((resolve, reject) => {
        db.run(
            `
            INSERT INTO sales (user_id, total, payment_method)
            VALUES (?, ?, ?)
            `,
            [user_id, total, payment_method],
            function (err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
            }
        );
    });
}

function addSaleItem(data) {
    const { sale_id, product_id, product_name, quantity, price, subtotal } = data;

    return new Promise((resolve, reject) => {
        db.run(
            `
            INSERT INTO sale_items 
            (sale_id, product_id, product_name, quantity, price, subtotal)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [sale_id, product_id, product_name, quantity, price, subtotal],
            function (err) {
                if (err) reject(err);
                else resolve(true);
            }
        );
    });
}

function getSalesByUser(user_id) {
    return new Promise((resolve, reject) => {
        db.all(
            `
            SELECT * FROM sales WHERE user_id=? ORDER BY id DESC
            `,
            [user_id],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

function getAllSales() {
    return new Promise((resolve, reject) => {
        db.all(
            `
            SELECT s.*, u.name AS user_name 
            FROM sales s 
            JOIN users u ON u.id = s.user_id
            ORDER BY s.id DESC
            `,
            [],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

function getSaleDetails(id) {
    return new Promise((resolve, reject) => {
        db.all(
            `
            SELECT * FROM sale_items WHERE sale_id=?
            `,
            [id],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

// ======================================================
// UTILIDADES
// ======================================================

function isConnected() {
    return !!db;
}

function close() {
    db.close();
}

// ======================================================
// EXPORTAR
// ======================================================

module.exports = {
    initializeDatabase,

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

    // Inventario
    logInventoryChange,
    getInventoryLog,

    // Carrito
    addToCart,
    getCart,
    clearCart,

    // Ventas
    createSale,
    addSaleItem,
    getSalesByUser,
    getAllSales,
    getSaleDetails,

    // Utilidades
    isConnected,
    close
};
