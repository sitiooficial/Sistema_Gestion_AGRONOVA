const express = require("express");
const router = express.Router();

router.post("/create", (req, res) => {
    const { amount, method } = req.body;

    return res.json({
        success: true,
        message: "Pago simulado correctamente",
        method,
        amount,
        transactionId: "PAY-" + Date.now()
    });
});

console.log("🛣️ [./payments.js] cargada");

router.get("/", (req, res) => {
    res.json({ status: "PAYMENTS ok" });
});

module.exports = router;
