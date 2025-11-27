// app.js
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// =====================================
// Inicializar DB en memoria
// =====================================
const db = require("./database"); // usuarios, productos, ventas, carritos

// Asegurar que los arrays existan
db.users = db.users || [];
db.products = db.products || [];
db.sales = db.sales || [];
db.cart = db.cart || [];

console.log("🗄️ Base de datos cargada:");
console.log("Usuarios:", db.users.length);
console.log("Productos:", db.products.length);
console.log("Ventas:", db.sales.length);

// =====================================
// Servidor
// =====================================
const app = express();
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

// Redirigir cualquier GET desconocido a index.html (SPA)
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
// SPA catch-all: SOLO para rutas que NO empiezan por /api
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"), (err) => {
    if (err) res.status(500).send('Error sirviendo index.html');
  });
});
// =====================================
// Levantar servidor
// =====================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("============================================");
  console.log("🌾 AGROMARKET - Sistema de Gestión Agrícola");
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log("✅ Base de datos: Conectada en memoria");
  console.log("============================================");
});

