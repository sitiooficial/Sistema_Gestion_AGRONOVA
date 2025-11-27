// =============================================
// 📁 database.js — SQLite + sincronizado middleware.js
// =============================================
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

// Crear carpeta /data incluso en Render
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
    console.log("📁 Creando carpeta /data para la base de datos...");
    fs.mkdirSync(dataDir);
}

// Ruta final de BD (Render lo permite)
const DB_PATH = path.join(dataDir, "agromarket.db");
console.log("📌 Ruta final BD:", DB_PATH);

// Inicializar DB
const db = new sqlite3.Database(DB_PATH);

// =============================================
// CREACIÓN DE TABLAS
// =============================================
function createTables() {
    console.log("🗄️ Inicializando base de datos...");

    db.serialize(() => {
        // Tabla Users
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabla Products
        db.run(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                price REAL NOT NULL,
                stock INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabla Orders
        db.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);

        // Tabla Cart
        db.run(`
            CREATE TABLE IF NOT EXISTS cart (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                qty INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(product_id) REFERENCES products(id)
            )
        `);

    });
}

// =============================================
// USUARIOS
// =============================================

// Obtener usuario por email (para login)
function getUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

// Obtener usuario por ID (para middleware authenticate)
function getUserById(id) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT id, name, email, role FROM users WHERE id = ?`, [id], (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

// Crear usuario (REGISTRO)
async function createUser(name, email, passwordHash, role = "user") {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO users (name, email, password, role)
            VALUES (?, ?, ?, ?)
        `;
        db.run(sql, [name, email, passwordHash, role], function (err) {
            if (err) return reject(err);
            resolve({
                id: this.lastID,
                name,
                email,
                role
            });
        });
    });
}

// Actualizar Rol (admin puede cambiar roles)
function updateUserRole(id, role) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE users SET role = ? WHERE id = ?`,
            [role, id],
            function (err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            }
        );
    });
}

// Obtener todos los usuarios (solo admin)
function listUsers() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id, name, email, role FROM users`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

// =============================================
// PRODUCTOS
// =============================================
function createProduct(name, category, price, stock) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO products (name, category, price, stock)
             VALUES (?, ?, ?, ?)`,
            [name, category, price, stock],
            function (err) {
                if (err) return reject(err);
                resolve({ id: this.lastID });
            }
        );
    });
}

function updateProduct(id, name, category, price, stock) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE products 
             SET name=?, category=?, price=?, stock=? 
             WHERE id=?`,
            [name, category, price, stock, id],
            function (err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            }
        );
    });
}

function deleteProduct(id) {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM products WHERE id=?`, [id], function (err) {
            if (err) return reject(err);
            resolve(this.changes > 0);
        });
    });
}

function listProducts() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM products`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

// =============================================
// EXPORTAR
// =============================================
module.exports = {
    db,
    createTables,

    // User
    getUserByEmail,
    getUserById,
    createUser,
    updateUserRole,
    listUsers,

    // Products
    createProduct,
    updateProduct,
    deleteProduct,
    listProducts
};
