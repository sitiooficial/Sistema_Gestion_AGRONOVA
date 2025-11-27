/**
 * ============================================
 * PRODUCT ROUTES - routes/products.js
 * Gestión completa de productos agrícolas
 * ============================================
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const middleware = require('../middleware');

// ============================================
// LISTAR TODOS LOS PRODUCTOS
// ============================================

router.get('/',
    middleware.asyncHandler(async (req, res) => {
        const { category, search, status = 'active' } = req.query;

        const filters = { status };
        if (category) filters.category = category;
        if (search) filters.search = search;

        const products = await db.getAllProducts(filters);

        res.json({
            success: true,
            data: products,
            count: products.length
        });
    })
);

// ============================================
// OBTENER UN PRODUCTO POR ID
// ============================================

router.get('/:id',
    middleware.validateId,
    middleware.asyncHandler(async (req, res) => {
        const product = await db.getProductById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        res.json({
            success: true,
            data: product
        });
    })
);

// ============================================
// CREAR PRODUCTO (ADMIN)
// ============================================

router.post('/',
    middleware.isAdmin,
    middleware.sanitizeBody,
    middleware.validateProduct,
    middleware.asyncHandler(async (req, res) => {
        const { name, category, description, price, stock, min_stock } = req.body;

        const productData = {
            name: name.trim(),
            category,
            description: description ? description.trim() : '',
            price: parseFloat(price),
            stock: parseInt(stock),
            min_stock: parseInt(min_stock) || 10
        };

        const product = await db.createProduct(productData);

        // Registrar en log de inventario
        await db.logInventoryChange(
            product.id,
            'initial',
            productData.stock,
            0,
            productData.stock,
            'Stock inicial al crear producto',
            req.user.id
        );

        res.status(201).json({
            success: true,
            message: 'Producto creado exitosamente',
            data: product
        });
    })
);

// ============================================
// ACTUALIZAR PRODUCTO (ADMIN)
// ============================================

router.put('/:id',
    middleware.isAdmin,
    middleware.validateId,
    middleware.sanitizeBody,
    middleware.validateProduct,
    middleware.asyncHandler(async (req, res) => {
        const productId = req.params.id;

        // Verificar que existe
        const existingProduct = await db.getProductById(productId);
        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const { name, category, description, price, stock, min_stock } = req.body;

        const productData = {
            name: name.trim(),
            category,
            description: description ? description.trim() : '',
            price: parseFloat(price),
            stock: parseInt(stock),
            min_stock: parseInt(min_stock) || 10
        };

        // Si cambió el stock, registrar en log
        if (productData.stock !== existingProduct.stock) {
            const difference = productData.stock - existingProduct.stock;
            const type = difference > 0 ? 'restock' : 'adjustment';
            
            await db.logInventoryChange(
                productId,
                type,
                Math.abs(difference),
                existingProduct.stock,
                productData.stock,
                'Actualización manual de stock',
                req.user.id
            );
        }

        await db.updateProduct(productId, productData);

        res.json({
            success: true,
            message: 'Producto actualizado exitosamente',
            data: { id: productId, ...productData }
        });
    })
);

// ============================================
// ELIMINAR PRODUCTO (ADMIN - Soft Delete)
// ============================================

router.delete('/:id',
    middleware.isAdmin,
    middleware.validateId,
    middleware.asyncHandler(async (req, res) => {
        const productId = req.params.id;

        const product = await db.getProductById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        await db.deleteProduct(productId);

        res.json({
            success: true,
            message: 'Producto eliminado exitosamente'
        });
    })
);

// ============================================
// ACTUALIZAR STOCK (ADMIN)
// ============================================

router.patch('/:id/stock',
    middleware.isAdmin,
    middleware.validateId,
    middleware.asyncHandler(async (req, res) => {
        const productId = req.params.id;
        const { quantity, type, notes } = req.body;

        if (!quantity || isNaN(quantity)) {
            return res.status(400).json({
                success: false,
                error: 'Cantidad inválida'
            });
        }

        const validTypes = ['restock', 'adjustment', 'return'];
        if (!type || !validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Tipo de operación inválido'
            });
        }

        const product = await db.getProductById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const result = await db.updateStock(productId, Math.abs(quantity), type);

        await db.logInventoryChange(
            productId,
            type,
            Math.abs(quantity),
            result.previousStock,
            result.newStock,
            notes || `Operación de ${type}`,
            req.user.id
        );

        res.json({
            success: true,
            message: 'Stock actualizado exitosamente',
            data: {
                previousStock: result.previousStock,
                newStock: result.newStock,
                difference: result.newStock - result.previousStock
            }
        });
    })
);

// ============================================
// OBTENER PRODUCTOS CON STOCK BAJO (ADMIN)
// ============================================

router.get('/alerts/low-stock',
    middleware.isAdmin,
    middleware.asyncHandler(async (req, res) => {
        const products = await db.getLowStockProducts();

        res.json({
            success: true,
            data: products,
            count: products.length
        });
    })
);

// ============================================
// OBTENER HISTORIAL DE INVENTARIO (ADMIN)
// ============================================

router.get('/:id/inventory-log',
    middleware.isAdmin,
    middleware.validateId,
    middleware.asyncHandler(async (req, res) => {
        const productId = req.params.id;

        const product = await db.getProductById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const logs = await db.getInventoryLog(productId);

        res.json({
            success: true,
            data: {
                product: {
                    id: product.id,
                    name: product.name,
                    currentStock: product.stock
                },
                logs: logs
            }
        });
    })
);

// ============================================
// OBTENER CATEGORÍAS DISPONIBLES
// ============================================

router.get('/meta/categories',
    middleware.asyncHandler(async (req, res) => {
        const categories = await db.getProductCategories();

        res.json({
            success: true,
            data: categories
        });
    })
);

// ============================================
// ESTADÍSTICAS DE PRODUCTOS (ADMIN)
// ============================================

router.get('/meta/statistics',
    middleware.isAdmin,
    middleware.asyncHandler(async (req, res) => {
        const stats = await db.getProductStatistics();

        res.json({
            success: true,
            data: stats
        });
    })
);

// ============================================
// BÚSQUEDA AVANZADA
// ============================================

router.post('/search',
    middleware.asyncHandler(async (req, res) => {
        const { 
            query, 
            categories, 
            minPrice, 
            maxPrice, 
            inStock,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.body;

        const filters = {
            query,
            categories: Array.isArray(categories) ? categories : [],
            minPrice: minPrice ? parseFloat(minPrice) : null,
            maxPrice: maxPrice ? parseFloat(maxPrice) : null,
            inStock: inStock !== undefined ? inStock : null,
            sortBy,
            sortOrder
        };

        const products = await db.searchProducts(filters);

        res.json({
            success: true,
            data: products,
            count: products.length,
            filters: filters
        });
    })
);

module.exports = router;