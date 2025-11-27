// routes/orders.js (CommonJS)
const express = require("express");
const router = express.Router();

const middleware = require("../middleware");
const { asyncHandler } = middleware;

// =======================================
// CREAR ORDEN
// =======================================
router.post(
    "/create",
    middleware.authRequired,
    middleware.isUser,
    asyncHandler(async (req, res) => {
        const db = require("../database");

        const userId = req.user.id;
        const { items, total } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Items requeridos" });
        }

        if (!total || isNaN(total)) {
            return res.status(400).json({ error: "Total inválido" });
        }

        const newOrder = db.createOrder(userId, items, total);

        return res.json({
            success: true,
            order: newOrder
        });
    })
);

// =======================================
// LISTAR ORDENES DEL USUARIO
// =======================================
router.get(
    "/mine",
    middleware.authRequired,
    middleware.isUser,
    asyncHandler(async (req, res) => {
        const db = require("../database");
        const userId = req.user.id;

        const orders = db.getUserOrders(userId);

        res.json({
            success: true,
            orders
        });
    })
);

// =======================================
// LISTAR TODAS (solo admin)
// =======================================
router.get(
    "/all",
    middleware.authRequired,
    middleware.isAdmin,
    asyncHandler(async (req, res) => {
        const db = require("../database");

        const all = db.getAllOrders();

        res.json({
            success: true,
            orders: all
        });
    })
);

module.exports = router;
