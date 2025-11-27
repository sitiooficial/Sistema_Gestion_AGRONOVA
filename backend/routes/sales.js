const express = require("express");
const router = express.Router();
const db = require("../database");
const { authRequired } = require("../middleware");

router.post("/register", authRequired, (req, res) => {
    const { product_id, quantity, total } = req.body;

    db.run(
        "INSERT INTO sales (product_id, quantity, total, date) VALUES (?, ?, ?, datetime('now'))",
        [product_id, quantity, total],
        () => res.json({ success: true })
    );
});

router.get("/recent", authRequired, (req, res) => {
    db.all(
        "SELECT * FROM sales ORDER BY date DESC LIMIT 10",
        [],
        (err, rows) => res.json(rows)
    );
});

console.log("🛣️ [./sales] cargada");

router.get("/", (req, res) => {
    res.json({ status: "SALES ok" });
});


module.exports = router;
