const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// =====================================================
// CORS (solo una vez)
// =====================================================
app.use(cors({
    origin: "*",
    credentials: true
}));

app.use(express.json());

// cargar DB
const db = require("./database");

// middlewares
const middleware = require("./middleware");

// =====================================================
// SERVIR ARCHIVOS ESTÁTICOS (IMPORTANTE QUE ESTÉ ARRIBA)
// =====================================================
app.use("/", express.static(path.join(__dirname, "public")));

// =====================================================
// RUTAS DEL BACKEND
// =====================================================
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/stats", require("./routes/stats"));
app.use("/api/users", require("./routes/users"));
app.use("/api/payments", require("./routes/payments"));

// =====================================================
// PUERTO
// =====================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("============================================");
  console.log("🌾 AGROMARKET - Sistema de Gestión Agrícola");
  console.log("============================================");
  console.log(`✅ Servidor corriendo en: http://localhost:${PORT}`);
  console.log("============================================");
});
