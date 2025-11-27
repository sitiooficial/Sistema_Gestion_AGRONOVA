const express = require("express");
const router = express.Router();
const db = require("../database");
const { asyncHandler } = require("../middleware");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

// ===============================
// 📊 1) Ventas por día
// ===============================
router.get("/sales", asyncHandler(async (req, res) => {
    const rows = await db.query(`
        SELECT date, SUM(total) AS total
        FROM orders
        GROUP BY date
        ORDER BY date ASC
    `);

    res.json({
        labels: rows.map(r => r.date),
        values: rows.map(r => r.total)
    });
}));

// ===============================
// 📈 2) Totales
// ===============================
router.get("/totals", asyncHandler(async (req, res) => {
    const revenue = await db.query(`SELECT SUM(total) as t FROM orders`);
    const users = await db.query(`SELECT COUNT(*) as c FROM users`);

    res.json({
        revenue: revenue[0].t || 0,
        users: users[0].c || 0
    });
}));

// ===============================
// 📦 3) Stock bajo
// ===============================
router.get("/low-stock", asyncHandler(async (req, res) => {
    const low = await db.query(`
        SELECT name, stock FROM products WHERE stock < 10
    `);
    res.json(low);
}));

// ===============================
// 🤖 4) IA — Predicción simple
// ===============================
router.get("/ai/predict", asyncHandler(async (req, res) => {
    res.json({
        message: "Se espera aumento de ventas en los próximos 7 días."
    });
}));

// ===============================
// 🧠 5) IA — Recomendación
// ===============================
router.get("/ai/recommend", asyncHandler(async (req, res) => {
    res.json({
        message: "Recomendar aumentar el stock de fertilizantes y semillas."
    });
}));

// ===============================
// 📄 6) Exportar PDF
// ===============================
router.get("/export/pdf", asyncHandler(async (req, res) => {
    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    doc.fontSize(22).text("Reporte Administrativo", { align: "center" });
    doc.moveDown();

    doc.fontSize(16).text("Generado: " + new Date().toLocaleString());
    doc.end();
}));

// ===============================
// 📥 7) Exportar Excel
// ===============================
router.get("/export/excel", asyncHandler(async (req, res) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Reporte");

    sheet.addRow(["Reporte Administrativo"]);
    sheet.addRow(["Fecha:", new Date().toLocaleString()]);

    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", "attachment; filename=report.xlsx");

    workbook.xlsx.write(res).then(() => res.end());
}));


//
console.log("🛣️ [./STATS] cargada");

router.get("/", (req, res) => {
    res.json({ status: "STATS ok" });
});
module.exports = router;
