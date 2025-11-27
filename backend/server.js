// =============================================
// 📦 AGROMARKET - Backend Node.js + Express
// =============================================

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// ===================== MIDDLEWARES GLOBALES =====================
app.use(cors());

    origin: '*';
  
}));

app.use(express.json());

// Base de datos SQLite
const db = require("./database");

// Importar middleware correctamente
const middleware = require("./middleware");
const { authRequired, isAdmin, isUser } = middleware;
console.log("🛣️ middleware.js cargado correctamente");

// ===================== RUTAS DE API =====================
try {
    app.use("/api/auth", require("./routes/auth"));
    app.use("/api/products", authRequired, require("./routes/products"));
    app.use("/api/cart", authRequired, require("./routes/cart"));
    app.use("/api/orders", authRequired, require("./routes/orders"));
    app.use("/api/stats", authRequired, require("./routes/stats"));
    app.use("/api/users", isAdmin, require("./routes/users"));
    app.use("/api/payments", authRequired, require("./routes/payments"));

    const inventarioRoutes = require('./routes/inventario.routes');
    app.use('/api/inventario', authRequired, inventarioRoutes);

} catch (err) {
    console.error("❌ Error cargando rutas:", err.message);
}

// ===================== SERVIR FRONTEND =====================
app.use(express.static(path.join(__dirname, "public")));

// Catch-all
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "frontend.html"));
});

// ===================== MANEJO GLOBAL DE ERRORES =====================
app.use((err, req, res, next) => {
    console.error("🔥 ERROR GLOBAL:", err);
    res.status(500).json({
        ok: false,
        error: "Error interno del servidor"
    });
});

// ===================== INICIO DEL SERVIDOR =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("============================================");
    console.log("🌾 AGROMARKET - Sistema de Gestión Agrícola");
    console.log("============================================");
    console.log(`🚀 Servidor activo en: http://localhost:${PORT}`);
    console.log("📁 Sirviendo frontend desde /public");
    console.log("🗄️ Base de datos SQLite: Conectada");
    console.log("============================================");
});


