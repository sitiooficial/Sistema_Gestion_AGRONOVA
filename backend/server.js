const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// cargar DB (crea tablas si no existen)
const db = require("./database");

// middlewares
const middleware = require("./middleware");

// rutas
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/stats", require("./routes/stats"));
app.use("/api/users", require("./routes/users"));
app.use("/api/payments", require("./routes/payments"));

// servir front (public)
app.use("/", express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;


app.use(cors({
    origin: '*',
    credentials: true
}));
app.listen(PORT, async () => {
  console.log("============================================");
  console.log("🌾 AGROMARKET - Sistema de Gestión Agrícola");
  console.log("============================================");
  console.log(`✅ Servidor corriendo en: http://localhost:${PORT}`);
  console.log("✅ Base de datos: Conectada");
  console.log("============================================");
});

