const path = require("path");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = path.join(__dirname, "agromarket.db");

let db = null;

/* ============================================
   1) INICIALIZAR DATABASE
============================================ */

function initDatabase() {
    if (db) return;

    db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error("❌ Error conectando SQLite:", err);
            process.exit(1);
        }
        console.log("✅ SQLite conectado:", DB_PATH);
    });

    db.serialize(() => {
        db.run("PRAGMA foreign_keys = ON");
        createTables();
        createDefaultAdmin();
    });
}

/* ============================================
   2) CREACIÓN DE TABLAS
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

    console.log("✅ Tablas verificadas y sincronizadas");
}

/* ============================================
   3) CREAR ADMIN DEFAULT
============================================ */

function createDefaultAdmin() {
    const email = "admin@agromarket.com";
    const pass = "admin123";

    db.get(
        "SELECT id FROM users WHERE email = ?",
        [email],
        async (err, row) => {
            if (row) return; // Ya existe

            try {
                const hashed = await bcrypt.hash(pass, 10);

                db.run(
                    `
                    INSERT INTO users (name, email, password, role)
                    VALUES (?, ?, ?, ?)
                `,
                    ["Administrador", email, hashed, "admin"],
                    (err) => {
                        if (err) {
                            console.error("❌ Error creando admin:", err);
                            return;
                        }
                        console.log("👑 Admin creado:", email);
                    }
                );
            } catch (error) {
                console.error("❌ Error generando hash admin:", error);
            }
        }
    );
}

/* ============================================
   4) MÉTODOS DE USUARIO
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
                if (err) reject(err);
                else resolve({ id: this.lastID });
            }
        );
    });
}

function findUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function findUserById(id) {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT id, name, email, role FROM users WHERE id = ?",
            [id],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

/* ============================================
   ✔ Token de recuperación (corregido)
============================================ */

function updateUserResetToken(userId, resetToken, expiresAt) {
    return new Promise((resolve, reject) => {
        db.run(
            `
            UPDATE users 
            SET reset_token = ?, reset_token_expires = ?
            WHERE id = ?
        `,
            [resetToken, expiresAt, userId],
            function (err) {
                if (err) {
                    console.error("❌ Error al actualizar reset token:", err);
                    reject(err);
                } else resolve(true);
            }
        );
    });
}

/* ============================================
   5) MÉTODOS DE PRODUCTOS
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
                else resolve({ id: this.lastID });
            }
        );
    });
}

function getAllProducts() {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT * FROM products WHERE status = 'active'",
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

/* ============================================
   6) UTILIDADES
============================================ */

function isConnected() {
    return db !== null;
}

function close() {
    if (db) db.close();
}

/* ============================================
   7) EXPORTAR
============================================ */

module.exports = {
    initDatabase,

    // Users
    createUser,
    findUserByEmail,
    findUserById,
    updateUserResetToken,

    // Products
    createProduct,
    getAllProducts,

    // Utils
    isConnected,
    close,
};
