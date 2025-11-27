/**
 * ============================================
 * DATABASE - database.js
 * Gestión de base de datos SQLite
 * ============================================
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, 'agromarket.db');
let db = null;

// ============================================
// INICIALIZAR BASE DE DATOS
// ============================================

function initializeDatabase() {
    db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('❌ Error conectando a la base de datos:', err);
            process.exit(1);
        }
        console.log('✅ Base de datos SQLite conectada');
    });

    // Habilitar foreign keys
    db.run('PRAGMA foreign_keys = ON');

    createTables();
    createDefaultAdmin();
}

// ============================================
// CREAR TABLAS
// ============================================

function createTables() {
    // Tabla de Usuarios
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

    // Tabla de Productos
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

    // Tabla de Inventario (historial de cambios)
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

    // Tabla de Ventas
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

    // Tabla de Detalles de Venta
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

    // Tabla de Carrito de Compras (sesiones)
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

    console.log('✅ Tablas creadas/verificadas');
}

// ============================================
// CREAR ADMIN POR DEFECTO
// ============================================

function createDefaultAdmin() {
    const adminEmail = 'admin@agromarket.com';
    const adminPassword = 'admin123';

    db.get('SELECT id FROM users WHERE email = ?', [adminEmail], async (err, row) => {
        if (!row) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            
            db.run(`
                INSERT INTO users (name, email, password, role)
                VALUES (?, ?, ?, ?)
            `, ['Administrador', adminEmail, hashedPassword, 'admin'], (err) => {
                if (err) {
                    console.error('Error creando admin:', err);
                } else {
                    console.log('✅ Usuario admin creado:');
                    console.log(`   Email: ${adminEmail}`);
                    console.log(`   Password: ${adminPassword}`);
                }
            });
        }
    });
}

// ============================================
// FUNCIONES DE USUARIOS
// ============================================

function createUser(name, email, hashedPassword, role = 'customer') {
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO users (name, email, password, role)
            VALUES (?, ?, ?, ?)
        `, [name, email, hashedPassword, role], function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, name, email, role });
        });
    });
}

function findUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function findUserById(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT id, name, email, role FROM users WHERE id = ?', [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function updateUserResetToken(email, token, expires) {
    return new Promise((resolve, reject) => {
        db.run(`
            UPDATE users 
            SET reset_token = ?, reset_token_expires = ?
            WHERE email = ?
        `, [token, expires, email], (err) => {
            if (err) reject(err);
            else resolve(true);
        });
    });
}

function getAllUsers() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT id, name, email, role, status, created_at 
            FROM users 
            ORDER BY created_at DESC
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// ============================================
// FUNCIONES DE PRODUCTOS
// ============================================

function createProduct(data) {
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO products (name, category, description, price, stock, min_stock)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [data.name, data.category, data.description, data.price, data.stock, data.min_stock || 10], 
        function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, ...data });
        });
    });
}

function getAllProducts(filters = {}) {
    return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM products WHERE status = "active"';
        const params = [];

        if (filters.category) {
            query += ' AND category = ?';
            params.push(filters.category);
        }

        if (filters.search) {
            query += ' AND name LIKE ?';
            params.push(`%${filters.search}%`);
        }

        query += ' ORDER BY created_at DESC';

        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getProductById(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function updateProduct(id, data) {
    return new Promise((resolve, reject) => {
        db.run(`
            UPDATE products 
            SET name = ?, category = ?, description = ?, 
                price = ?, stock = ?, min_stock = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [data.name, data.category, data.description, data.price, data.stock, data.min_stock, id],
        (err) => {
            if (err) reject(err);
            else resolve(true);
        });
    });
}

function deleteProduct(id) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE products SET status = "inactive" WHERE id = ?', [id], (err) => {
            if (err) reject(err);
            else resolve(true);
        });
    });
}

function updateStock(productId, quantity, type = 'sale') {
    return new Promise((resolve, reject) => {
        db.get('SELECT stock FROM products WHERE id = ?', [productId], (err, row) => {
            if (err) return reject(err);
            if (!row) return reject(new Error('Producto no encontrado'));

            const previousStock = row.stock;
            const newStock = type === 'sale' ? previousStock - quantity : previousStock + quantity;

            if (newStock < 0) {
                return reject(new Error('Stock insuficiente'));
            }

            db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, productId], (err) => {
                if (err) return reject(err);

                // Registrar en log de inventario
                db.run(`
                    INSERT INTO inventory_log (product_id, type, quantity, previous_stock, new_stock)
                    VALUES (?, ?, ?, ?, ?)
                `, [productId, type, quantity, previousStock, newStock], (err) => {
                    if (err) console.error('Error logging inventory:', err);
                });

                resolve({ previousStock, newStock });
            });
        });
    });
}

// ============================================
// FUNCIONES DE VENTAS
// ============================================

function createSale(userId, items, paymentMethod) {
    return new Promise((resolve, reject) => {
        // Calcular total
        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        db.run(`
            INSERT INTO sales (user_id, total, payment_method)
            VALUES (?, ?, ?)
        `, [userId, total, paymentMethod], function(err) {
            if (err) return reject(err);

            const saleId = this.lastID;

            // Insertar items de la venta
            const insertPromises = items.map(item => {
                return new Promise((res, rej) => {
                    db.run(`
                        INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, subtotal)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [saleId, item.product_id, item.name, item.quantity, item.price, item.price * item.quantity],
                    (err) => {
                        if (err) rej(err);
                        else {
                            // Actualizar stock
                            updateStock(item.product_id, item.quantity, 'sale')
                                .then(() => res())
                                .catch(rej);
                        }
                    });
                });
            });

            Promise.all(insertPromises)
                .then(() => resolve({ id: saleId, total, items }))
                .catch(reject);
        });
    });
}

function getSalesByUser(userId) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM sales 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getAllSales() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT s.*, u.name as user_name, u.email as user_email
            FROM sales s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.created_at DESC
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getSaleDetails(saleId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT s.*, u.name as user_name, u.email as user_email
            FROM sales s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = ?
        `, [saleId], (err, sale) => {
            if (err) return reject(err);
            if (!sale) return reject(new Error('Venta no encontrada'));

            db.all('SELECT * FROM sale_items WHERE sale_id = ?', [saleId], (err, items) => {
                if (err) reject(err);
                else resolve({ ...sale, items });
            });
        });
    });
}

function updateSaleStatus(saleId, status, transactionId = null) {
    return new Promise((resolve, reject) => {
        db.run(`
            UPDATE sales 
            SET status = ?, payment_status = ?, transaction_id = ?
            WHERE id = ?
        `, [status, status, transactionId, saleId], (err) => {
            if (err) reject(err);
            else resolve(true);
        });
    });
}

// ============================================
// FUNCIONES DE DASHBOARD
// ============================================

function getDashboardStats() {
    return new Promise((resolve, reject) => {
        const stats = {};

        // Total de productos
        db.get('SELECT COUNT(*) as total FROM products WHERE status = "active"', (err, row) => {
            if (err) return reject(err);
            stats.totalProducts = row.total;

            // Total de ventas
            db.get('SELECT SUM(total) as total, COUNT(*) as orders FROM sales WHERE status = "completed"', (err, row) => {
                if (err) return reject(err);
                stats.totalSales = row.total || 0;
                stats.totalOrders = row.orders || 0;

                // Productos con stock bajo
                db.get('SELECT COUNT(*) as total FROM products WHERE stock < min_stock AND status = "active"', (err, row) => {
                    if (err) return reject(err);
                    stats.lowStock = row.total;

                    // Ventas recientes
                    db.all(`
                        SELECT s.*, u.name as user_name
                        FROM sales s
                        JOIN users u ON s.user_id = u.id
                        ORDER BY s.created_at DESC
                        LIMIT 10
                    `, (err, sales) => {
                        if (err) return reject(err);
                        stats.recentSales = sales;

                        resolve(stats);
                    });
                });
            });
        });
    });
}

// ============================================
// UTILIDADES
// ============================================

function isConnected() {
    return db !== null;
}

function close() {
    if (db) {
        db.close((err) => {
            if (err) console.error('Error cerrando BD:', err);
            else console.log('✅ Base de datos cerrada');
        });
    }
}

// ============================================
// INICIALIZAR AL CARGAR MÓDULO
// ============================================

initializeDatabase();

// ============================================
// FUNCIONES ADICIONALES
// ============================================

function logInventoryChange(productId, type, quantity, previousStock, newStock, notes = '', createdBy = null) {
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO inventory_log (product_id, type, quantity, previous_stock, new_stock, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [productId, type, quantity, previousStock, newStock, notes, createdBy], (err) => {
            if (err) reject(err);
            else resolve(true);
        });
    });
}

function getInventoryLog(productId) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT il.*, u.name as user_name
            FROM inventory_log il
            LEFT JOIN users u ON il.created_by = u.id
            WHERE il.product_id = ?
            ORDER BY il.created_at DESC
        `, [productId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getLowStockProducts() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM products 
            WHERE stock < min_stock AND status = 'active'
            ORDER BY stock ASC
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getProductCategories() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT DISTINCT category FROM products 
            WHERE status = 'active'
            ORDER BY category
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.category));
        });
    });
}

function getProductStatistics() {
    return new Promise((resolve, reject) => {
        const stats = {};

        db.get('SELECT COUNT(*) as total, SUM(stock) as totalStock FROM products WHERE status = "active"', (err, row) => {
            if (err) return reject(err);
            stats.totalProducts = row.total;
            stats.totalStock = row.totalStock;

            db.all('SELECT category, COUNT(*) as count FROM products WHERE status = "active" GROUP BY category', (err, rows) => {
                if (err) return reject(err);
                stats.byCategory = rows;
                resolve(stats);
            });
        });
    });
}

function searchProducts(filters) {
    return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM products WHERE status = "active"';
        const params = [];

        if (filters.query) {
            query += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${filters.query}%`, `%${filters.query}%`);
        }

        if (filters.categories && filters.categories.length > 0) {
            query += ` AND category IN (${filters.categories.map(() => '?').join(',')})`;
            params.push(...filters.categories);
        }

        if (filters.minPrice !== null) {
            query += ' AND price >= ?';
            params.push(filters.minPrice);
        }

        if (filters.maxPrice !== null) {
            query += ' AND price <= ?';
            params.push(filters.maxPrice);
        }

        if (filters.inStock === true) {
            query += ' AND stock > 0';
        }

        query += ` ORDER BY ${filters.sortBy} ${filters.sortOrder}`;

        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getSaleByTransactionId(transactionId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT * FROM sales WHERE transaction_id = ?
        `, [transactionId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function logRefund(saleId, userId, reason) {
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO inventory_log (product_id, type, quantity, previous_stock, new_stock, notes, created_by)
            SELECT si.product_id, 'refund', si.quantity, 0, 0, ?, ?
            FROM sale_items si
            WHERE si.sale_id = ?
        `, [reason, userId, saleId], (err) => {
            if (err) reject(err);
            else resolve(true);
        });
    });
}

function getSalesSummary(startDate, endDate) {
    return new Promise((resolve, reject) => {
        let query = 'SELECT COUNT(*) as total, SUM(total) as amount FROM sales WHERE status = "completed"';
        const params = [];

        if (startDate) {
            query += ' AND created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND created_at <= ?';
            params.push(endDate);
        }

        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function getSalesByPeriod(period, startDate, endDate) {
    return new Promise((resolve, reject) => {
        const dateFormat = {
            day: '%Y-%m-%d',
            week: '%Y-%W',
            month: '%Y-%m',
            year: '%Y'
        };

        let query = `
            SELECT strftime('${dateFormat[period]}', created_at) as period,
                   COUNT(*) as sales_count,
                   SUM(total) as total_amount
            FROM sales
            WHERE status = 'completed'
        `;
        const params = [];

        if (startDate) {
            query += ' AND created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND created_at <= ?';
            params.push(endDate);
        }

        query += ' GROUP BY period ORDER BY period DESC';

        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getTopSellingProducts(limit = 10) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT si.product_name, SUM(si.quantity) as total_sold, SUM(si.subtotal) as total_revenue
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.status = 'completed'
            GROUP BY si.product_id, si.product_name
            ORDER BY total_sold DESC
            LIMIT ?
        `, [limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getSalesByCustomer() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT u.id, u.name, u.email, 
                   COUNT(s.id) as total_orders,
                   SUM(s.total) as total_spent
            FROM users u
            JOIN sales s ON u.id = s.user_id
            WHERE s.status = 'completed'
            GROUP BY u.id
            ORDER BY total_spent DESC
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getSalesStatistics() {
    return new Promise((resolve, reject) => {
        const stats = {};

        db.get('SELECT COUNT(*) as total, SUM(total) as amount FROM sales WHERE status = "completed"', (err, row) => {
            if (err) return reject(err);
            stats.completedSales = row.total;
            stats.totalRevenue = row.amount || 0;

            db.get('SELECT AVG(total) as avg FROM sales WHERE status = "completed"', (err, row) => {
                if (err) return reject(err);
                stats.averageOrderValue = row.avg || 0;

                db.all('SELECT payment_method, COUNT(*) as count FROM sales WHERE status = "completed" GROUP BY payment_method', (err, rows) => {
                    if (err) return reject(err);
                    stats.byPaymentMethod = rows;
                    resolve(stats);
                });
            });
        });
    });
}

function getSalesByDate(date) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM sales 
            WHERE DATE(created_at) = ?
            ORDER BY created_at DESC
        `, [date], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// ============================================
// EXPORTS
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