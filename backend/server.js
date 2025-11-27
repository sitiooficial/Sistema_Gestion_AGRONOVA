// =============================================
// 📦 AGROMARKET - Backend Node.js + Express
// =============================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

// Crear app
const app = express();

// ===================== CONFIGURACIONES =====================
app.set("trust proxy", true);     // Necesario para producción
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===================== BASE DE DATOS =====================
console.log("🗄️ Inicializando base de datos...");
const db = require("./database");

// ===================== MIDDLEWARES =====================
console.log("🛣️ Cargando middleware...");
const {
    authRequired,
    isAdmin,
    isUser,
    sanitizeBody,
    validateLogin,
    validateRegister,
} = require("./middleware");

// Sanitizar body en TODAS las rutas
app.use(sanitizeBody);

// ===================== LOADER PARA INDEX.HTML =====================
// Esto permite que el frontend detecte automáticamente el backend
app.get("/loader.js", (req, res) => {
    res.type("application/javascript").send(`
        (() => {
            const loc = window.location;
            window.API_BASE = \`\${loc.protocol}//\${loc.hostname}:\${loc.port}\` + "/api";
            console.log("📡 API Base:", window.API_BASE);
        })();
    `);
});

// ===================== RUTAS DE API =====================
console.log("🛣️ Cargando rutas...");

try {
    app.use("/api/auth", require("./routes/auth"));

    app.use("/api/products", authRequired, require("./routes/products"));
    app.use("/api/cart", authRequired, require("./routes/cart"));
    app.use("/api/orders", authRequired, require("./routes/orders"));
    app.use("/api/stats", authRequired, require("./routes/stats"));
    app.use("/api/payments", authRequired, require("./routes/payments"));

    const inventarioRoutes = require("./routes/inventario.routes");
    app.use("/api/inventario", authRequired, inventarioRoutes);

    // Usuarios solo para admin
    app.use("/api/users", authRequired, isAdmin, require("./routes/users"));

} catch (err) {
    console.error("❌ Error cargando rutas:", err.message);
}

// ===================== FRONTEND =====================
console.log("📁 Serviendo frontend desde /public");

app.use(express.static(path.join(__dirname, "public")));

// Toda ruta que NO sea /api → enviar frontend
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===================== GLOBAL ERROR HANDLER =====================
app.use((err, req, res, next) => {
    console.error("🔥 ERROR GLOBAL:", err);
    res.status(500).json({ error: "Error interno del servidor" });
});

// ===================== SERVIDOR CON PUERTOS FLEXIBLES =====================
const PORTS = [
    process.env.PORT && parseInt(process.env.PORT),
    3000,
    4000,
    5000
].filter(Boolean);

function startServer(portIndex = 0) {
    const PORT = PORTS[portIndex];

    if (!PORT) {
        console.error("❌ No hay puertos disponibles");
        process.exit(1);
    }

    const server = app.listen(PORT, () => {
        console.log("============================================");
        console.log("🌾 AGROMARKET - Sistema de Gestión Agrícola");
        console.log("============================================");
        console.log(`🚀 Servidor activo en: http://localhost:${PORT}`);
        console.log(`🌍 API Base: http://localhost:${PORT}/api`);
        console.log("📁 Frontend listo en /public");
        console.log("============================================");
    });

    server.on("error", (err) => {
        console.warn(`⚠️ Puerto ${PORT} ocupado. Intentando siguiente...`);
        startServer(portIndex + 1);
    });
}

startServer();
