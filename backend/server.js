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
app.set("trust proxy", true);

// CORS SEGURO Y MULTIDOMINIO
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://haciendoProyectos.online",
        "http://haciendoProyectos.online",
        "https://sistema-gestion-agronova-1.onrender.com",
        "https://sistema-gestion-agronova-4ilb-oybd4f10k-ls-projects-565d7927.vercel.app",
        "https://sistema-gestion-agronova-4ilb-24id44cc1-ls-projects-565d7927.vercel.app"
        
    ],
    credentials: true
}))

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===================== BASE DE DATOS =====================
console.log("🗄️ Inicializando base de datos...");
const database = require("./database");

// *** 🔥 MUY IMPORTANTE ***
database.initDatabase()
    .then(() => console.log("🗄️ Base de datos lista."))
    .catch((e) => {
        console.error("❌ Error iniciando DB:", e);
        process.exit(1);
    });

// ===================== MIDDLEWARES =====================
console.log("🛣️ Cargando middleware...");

let authRequired, isAdmin, isUser, sanitizeBody, validateLogin, validateRegister;

try {
    ({
        authRequired,
        isAdmin,
        isUser,
        sanitizeBody,
        validateLogin,
        validateRegister
    } = require("./middleware"));
} catch (err) {
    console.error("❌ Error cargando middlewares:", err);
    process.exit(1);
}

// Sanitizar body en TODAS las rutas
app.use(sanitizeBody);

// ===================== LOADER PARA FRONTEND =====================
app.get("/loader.js", (req, res) => {
    res.type("application/javascript").send(`
        (() => {
            const loc = window.location;
            const PORT = loc.port ? ":" + loc.port : "";
            window.API_BASE = \`\${loc.protocol}//\${loc.hostname}\${PORT}/api\`;
            console.log("📡 API Base:", window.API_BASE);
        })();
    `);
});

// ===================== RUTAS =====================
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
    process.exit(1);
}

// ===================== FRONTEND =====================
console.log("📁 Serviendo frontend desde /public");

app.use(express.static(path.join(__dirname, "public")));

// Toda ruta que NO sea /api → frontend
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===================== ERROR HANDLER GLOBAL =====================
app.use((err, req, res, next) => {
    console.error("🔥 ERROR GLOBAL:", err);
    res.status(500).json({
        error: "Error interno del servidor",
        details: err.message
    });
});

// ===================== SERVIDOR MULTIPUERTO =====================
const PORTS = [
    process.env.PORT && parseInt(process.env.PORT),
    3001,
    3000,
    4000,
    5000,
    8080
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



