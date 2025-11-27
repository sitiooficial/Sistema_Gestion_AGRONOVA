// ============================================
// CART ROUTER - FIX DEFINITIVO
// ============================================

// Asegurar que Express está cargado
const express = require("express");

// Asegurar que router existe
const router = express.Router();
if (!router) throw new Error("FATAL: router no pudo inicializarse");

// Dependencias
const middleware = require("../middleware");
const asyncHandler = require("../utils/asyncHandler");
const db = require("../database");

// =============================
// ADD ITEM TO CART
// =============================
router.post(
  "/add",
  middleware.isUser,
  asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    if (!db.cart) db.cart = [];

    db.cart.push({
      user: req.user.id,
      productId,
      quantity,
      createdAt: new Date(),
    });

    res.json({
      message: "Producto agregado",
      cart: db.cart.filter((c) => c.user === req.user.id),
    });
  })
);

// =============================
// GET CART
// =============================
router.get(
  "/",
  middleware.isUser,
  asyncHandler(async (req, res) => {
    const cart = db.cart?.filter((i) => i.user === req.user.id) || [];
    res.json(cart);
  })
);

// =============================
// REMOVE ITEM
// =============================
router.delete(
  "/remove/:productId",
  middleware.isUser,
  asyncHandler(async (req, res) => {
    const { productId } = req.params;

    if (!db.cart) db.cart = [];

    db.cart = db.cart.filter(
      (i) => !(i.user === req.user.id && i.productId == productId)
    );

    res.json({
      message: "Producto eliminado",
      cart: db.cart.filter((i) => i.user === req.user.id),
    });
  })
);

// Exportar SIEMPRE al final
module.exports = router;
