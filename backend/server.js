// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// ---------- MIDDLEWARES GLOBALES ----------
app.use(express.json());

// CORS: en producción restringe 'origin' a tu dominio
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));



// ---------- MIDDLEWARES PERSONALIZADOS (NO registrar todo el objeto) ----------
const middleware = require("./middleware");
// ejemplo: si quieres sanitizar todo el body globalmente:
if (typeof middleware.sanitizeBody === 'function') {
  app.use(middleware.sanitizeBody);
}
// no hagas app.use(middleware) porque middleware es un objeto con funciones.



// =====================================
// Inicializar DB en memoria
// =====================================
const db = require("./database"); // usuarios, productos, ventas, carritos
console.log("🗄️ Base de datos cargada:");
console.log("Usuarios:", db.users.length);
console.log("Productos:", db.products.length);
console.log("Ventas:", db.sales.length);

// =====================================
// Servidor
// =====================================

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// =====================================
// Rutas
// =====================================
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/sales", require("./routes/sales"));

// =====================================
// Servir frontend
// =====================================
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// =====================================


// ---------- SERVIR FRONTEND (public) ----------
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

// SPA catch-all: SOLO para rutas que NO empiezan por /api
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"), (err) => {
    if (err) res.status(500).send('Error sirviendo index.html');
  });
});

// ---------- MANEJO GLOBAL DE ERRORES ----------
app.use((err, req, res, next) => {
  console.error("🔥 ERROR GLOBAL:", err);
  res.status(500).json({ ok: false, error: "Error interno del servidor" });
});

// ---------- START ----------
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log("============================================");
  console.log("🌾 AGROMARKET - Sistema de Gestión Agrícola");
  console.log(`🚀 Servidor activo en: http://localhost:${PORT}`);
  console.log("📁 Sirviendo frontend desde /public");
  console.log("🗄️ Base de datos SQLite: Conectada (ver ./database)");
  console.log("============================================");
});


