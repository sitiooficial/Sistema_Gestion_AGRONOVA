const path = require("path");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = path.join(__dirname, "agromarket.db");

let db = null;

/* ============================================
   1) INICIAR BASE DE DATOS
============================================ */
function initDatabase() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(true);

        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error("❌ Error conectando SQLite:", err);
                return reject(err);
            }

            console.log("✅ SQLite conectado:", DB_PATH);

            db.run("PRAGMA foreign_keys = ON");

            createTables()
                .then(() => createDefaultAdmin())
                .then(() => resolve(true))
                .catch((e) => reject(e));
        });
    });
}

/* ============================================
   2) TABLAS
============================================ */
function createTables() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
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

            console.log("✅ Tablas verificadas");
            resolve(true);
        });
    });
}

/* ============================================
   3) CREAR ADMIN SI NO EXISTE
============================================ */
function createDefaultAdmin() {
    return new Promise((resolve, reject) => {
        const email = "admin@agromarket.com";
        const pass = "admin123";

        db.get(
            "SELECT id FROM users WHERE email = ?", 
            [email],
            async (err, row) => {
                if (err) return reject(err);
                if (row) return resolve(true);

                try {
                    const hashed = await bcrypt.hash(pass, 10);

                    db.run(
                        `INSERT INTO users (name, email, password, role)
                         VALUES (?, ?, ?, ?)`,
                        ["Administrador", email, hashed, "admin"],
                        (err2) => {
                            if (err2) reject(err2);
                            else {
                                console.log("👑 Admin creado:", email);
                                resolve(true);
                            }
                        }
                    );
                } catch (e) {
                    reject(e);
                }
            }
        );
    });
}

/* ============================================
   4) USUARIOS
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
                if (err) {
                    console.error("❌ Error creando usuario:", err);
                    return reject(err);
                }
                resolve({ id: this.lastID });
            }
        );
    });
}

function findUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
            if (err) {
                console.error("❌ Error findUserByEmail:", err);
                return reject(err);
            }
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
                if (err) {
                    console.error("❌ Error findUserById:", err);
                    return reject(err);
                }
                resolve(row);
            }
        );
    });
}

/* ============================================
   4.1) RESET TOKEN
============================================ */
function updateUserResetToken(userId, resetToken, expiresAt) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE users
            SET reset_token = ?, reset_token_expires = ?
            WHERE id = ?
        `;

        db.run(query, [resetToken, expiresAt, userId], function (err) {
            if (err) {
                console.error("❌ Error al actualizar reset token:", err);
                return reject(err);
            }
            resolve(true);
        });
    });
}

/* ============================================
   5) PRODUCTOS
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
                if (err) {
                    console.error("❌ Error creando producto:", err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            }
        );
    });
}

function getAllProducts() {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT * FROM products WHERE status = 'active'",
            (err, rows) => {
                if (err) {
                    console.error("❌ Error obteniendo productos:", err);
                    reject(err);
                } else {
                    resolve(rows);
                }
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

    // Usuarios
    createUser,
    findUserByEmail,
    findUserById,
    updateUserResetToken,

    // Productos
    createProduct,
    getAllProducts,

    // Utils
    isConnected,
    close,
};
