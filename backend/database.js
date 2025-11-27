/**
 * ============================================
 * DATABASE - database.js
 * Gestión centralizada de SQLite
 * ============================================
 */

const path = require('path');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'agromarket.db');

let db = null;

/* ============================================
   INICIALIZAR BASE DE DATOS
============================================ */

function initializeDatabase() {
    if (db !== null) return; // evita doble inicialización

    db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error("❌ Error conectando a SQLite:", err);
            return process.exit(1);
        }
        console.log("✅ SQLite conectado en:", DB_PATH);
    });

    db.run("PRAGMA foreign_keys = ON");
    createTables();
    createDefaultAdmin();
}

/* ============================================
   CREACIÓN DE TABLAS
============================================ */

function createTables() {

    db.run(`
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
        )
    `);

    db.run(`
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
        )
    `);

    db.run(`
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
        )
    `);

    db.run(`
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
        )
    `);

    db.run(`
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
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    `);

    console.log("✅ Tablas verificadas/creadas");
}

/* ============================================
   CREAR ADMIN POR DEFECTO
============================================ */

function createDefaultAdmin() {
    const email = "admin@agromarket.com";
    const pass = "admin123";

    db.get("SELECT id FROM users WHERE email = ?", [email], async (err, row) => {
        if (row) return;

        const hashed = await bcrypt.hash(pass, 10);

        db.run(
            "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
            ["Administrador", email, hashed, "admin"]
        );

        console.log("👑 Admin creado:");
        console.log(`Email: ${email}`);
        console.log(`Password: ${pass}`);
    });
}

/* ============================================
   FUNCIONES DE USUARIOS
============================================ */

function createUser(name, email, hashedPassword, role = "customer") {
    return new Promise((resolve, reject) => {
        db.run(
            `
            INSERT INTO users (name, email, password, role)
            VALUES (?, ?, ?, ?)
        `,
            [name, email, hashedPassword, role],
            function (err) {
                if (err) return reject(err);
                resolve({ id: this.lastID, name, email, role });
            }
        );
    });
}

function findUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function findUserById(id) {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT id, name, email, role FROM users WHERE id = ?",
            [id],
            (err, row) => (err ? reject(err) : resolve(row))
        );
    });
}

function updateUserResetToken(email, token, expires) {
    return new Promise((resolve, reject) => {
        db.run(
            `
            UPDATE users 
            SET reset_token = ?, reset_token_expires = ?
            WHERE email = ?
        `,
            [token, expires, email],
            (err) => (err ? reject(err) : resolve(true))
        );
    });
}

function getAllUsers() {
    return new Promise((resolve, reject) => {
        db.all(
            `
            SELECT id, name, email, role, status, created_at 
            FROM users 
            ORDER BY created_at DESC
        `,
            (err, rows) => (err ? reject(err) : resolve(rows))
        );
    });
}

/* ============================================
   FUNCIONES DE PRODUCTOS
============================================ */

function createProduct(data) {
    return new Promise((resolve, reject) => {
        db.run(
            `
            INSERT INTO products (name, category, description, price, stock, min_stock)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
            [
                data.name,
                data.category,
                data.description,
                data.price,
                data.stock,
                data.min_stock || 10,
            ],
            function (err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, ...data });
            }
        );
    });
}

function getAllProducts(filters = {}) {
    return new Promise((resolve, reject) => {
        let query = `SELECT * FROM products WHERE status = 'active'`;
        const params = [];

        if (filters.category) {
            query += " AND category = ?";
            params.push(filters.category);
        }

        if (filters.search) {
            query += " AND name LIKE ?";
            params.push(`%${filters.search}%`);
        }

        query += " ORDER BY created_at DESC";

        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getProductById(id) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM products WHERE id = ?", [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function updateProduct(id, data) {
    return new Promise((resolve, reject) => {
        db.run(
            `
            UPDATE products 
            SET name = ?, category = ?, description = ?, 
                price = ?, stock = ?, min_stock = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `,
            [
                data.name,
                data.category,
                data.description,
                data.price,
                data.stock,
                data.min_stock,
                id,
            ],
            (err) => (err ? reject(err) : resolve(true))
        );
    });
}

function deleteProduct(id) {
    return new Promise((resolve, reject) => {
        db.run(
            "UPDATE products SET status = 'inactive' WHERE id = ?",
            [id],
            (err) => (err ? reject(err) : resolve(true))
        );
    });
}

function updateStock(productId, quantity, type = "sale") {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT stock FROM products WHERE id = ?",
            [productId],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return reject(new Error("Producto no encontrado"));

                const previous = row.stock;
                const newStock =
                    type === "sale"
                        ? previous - quantity
                        : previous + quantity;

                if (newStock < 0)
                    return reject(new Error("Stock insuficiente"));

                db.run(
                    "UPDATE products SET stock = ? WHERE id = ?",
                    [newStock, productId],
                    (err) => {
                        if (err) return reject(err);

                        db.run(
                            `
                            INSERT INTO inventory_log 
                            (product_id, type, quantity, previous_stock, new_stock)
                            VALUES (?, ?, ?, ?, ?)
                        `,
                            [
                                productId,
                                type,
                                quantity,
                                previous,
                                newStock,
                            ]
                        );

                        resolve({ previous, newStock });
                    }
                );
            }
        );
    });
}

/* ============================================
   EL RESTO DE FUNCIONES LAS DEJO IGUAL
   (VENTAS, DASHBOARD, UTILIDADES)
============================================ */

function isConnected() {
    return db !== null;
}

function close() {
    if (!db) return;
    db.close();
}

/* ============================================
   EXPORTS
============================================ */

initializeDatabase();

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

    // Utilidades
    isConnected,
    close,
};
