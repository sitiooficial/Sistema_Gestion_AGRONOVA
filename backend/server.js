// =============================================
// 📦 AGROMARKET - Backend Node.js + Express
// =============================================

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// ===================== MIDDLEWARES =====================
app.use(cors());
app.use(express.json());

// Base de datos SQLite
const db = require("./database");

// Middleware de auth / roles
const { authRequired, isAdmin, isUser } = require("./middleware");
console.log("🛣️ middleware.js cargado correctamente");

// ========================================================
//            RUTA DE PRUEBA PARA AUTODETECCIÓN
// ========================================================
app.get("/api/ping", (req, res) => {
    res.json({ ok: true, message: "Backend activo" });
});
app.set("trust proxy", true);

// ===================== RUTAS DE API =====================
try {
    app.use("/api/auth", require("./routes/auth"));
    app.use("/api/products", authRequired, require("./routes/products"));
    app.use("/api/cart", authRequired, require("./routes/cart"));
    app.use("/api/orders", authRequired, require("./routes/orders"));
    app.use("/api/stats", authRequired, require("./routes/stats"));

    app.use("/api/users", authRequired, isAdmin, require("./routes/users"));

    app.use("/api/payments", authRequired, require("./routes/payments"));

    const inventarioRoutes = require('./routes/inventario.routes');
    app.use('/api/inventario', authRequired, inventarioRoutes);

} catch (err) {
    console.error("❌ Error cargando rutas:", err.message);
}

// ===================== SERVIR FRONTEND =====================
app.use(express.static(path.join(__dirname, "public")));

// Para cualquier ruta NO API → cargar SPA
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===================== MANEJO GLOBAL DE ERRORES =====================
app.use((err, req, res, next) => {
    console.error("🔥 ERROR GLOBAL:", err);
    res.status(500).json({
        ok: false,
        error: "Error interno del servidor"
    });
});

// ===================== SISTEMA DE PUERTOS DINÁMICOS =====================
const PORTS = [3000, 4000, 5000];

function startServer(portIndex = 0) {
    if (portIndex >= PORTS.length) {
        console.error("❌ No se pudo iniciar servidor en ningún puerto");
        return;
    }

    const PORT = PORTS[portIndex];

    const server = app
        .listen(PORT, () => {
            console.log("============================================");
            console.log("🌾 AGROMARKET - Sistema de Gestión Agrícola");
            console.log("============================================");
            console.log(`🚀 Servidor activo en: http://localhost:${PORT}`);
            console.log("📁 Sirviendo frontend desde /public");
            console.log("🗄️ Base de datos SQLite: Conectada");
            console.log("============================================");
        })
        .on("error", (err) => {
            if (err.code === "EADDRINUSE") {
                console.warn(`⚠️ Puerto ${PORT} ocupado, probando el siguiente...`);
                startServer(portIndex + 1);
            } else {
                console.error("❌ Error al iniciar servidor:", err);
            }
        });
}

// Iniciar sistema multipuerto
startServer();

