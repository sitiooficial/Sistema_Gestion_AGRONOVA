const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// DB en memoria
const db = require("./database");
db.users = db.users || [];
db.products = db.products || [];
db.sales = db.sales || [];
db.cart = db.cart || [];

const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// API routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/sales", require("./routes/sales"));

// Servir frontend
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

// SPA fallback (usa app.use, no app.get)
app.use((req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("============================================");
  console.log("🌾 AGROMARKET - Sistema de Gestión Agrícola");
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log("✅ Base de datos: Conectada en memoria");
  console.log("============================================");
});
