// =============================================
// 🌾 AGROMARKET - Backend Node.js + Express
// =============================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// ===================== CONFIGURACIONES =====================
app.set("trust proxy", true);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===================== BASE DE DATOS =====================
console.log("🗄️ Inicializando base de datos...");
const { initDatabase } = require("./database/database");

// ===================== MIDDLEWARES =====================
console.log("🛣️ Cargando middleware...");
const { authRequired, isAdmin, sanitizeBody } = require("./middleware");

// Sanitizar body
app.use(sanitizeBody);

// ===================== LOADER PARA FRONTEND =====================
app.get("/loader.js", (req, res) => {
    res.type("application/javascript").send(`
        (() => {
            const loc = window.location;
            window.API_BASE = \`\${loc.protocol}//\${loc.hostname}:\${loc.port}\` + "/api";
            console.log("📡 API Base:", window.API_BASE);
        })();
    `);
});

// ===================== RUTAS =====================
console.log("🛣️ Cargando rutas...");

try {
    // Rutas reales existentes
    app.use("/api/auth", require("./routes/auth"));
    app.use("/api/products", authRequired, require("./routes/products"));

    app.use("/api/cart", authRequired, require("./routes/cart"));
    app.use("/api/orders", authRequired, require("./routes/orders"));
    app.use("/api/stats", authRequired, require("./routes/stats"));
    app.use("/api/payments", authRequired, require("./routes/payments"));
    const inventarioRoutes = require("./routes/inventario.routes");
    app.use("/api/inventario", authRequired, inventarioRoutes);
    app.use("/api/users", authRequired, isAdmin, require("./routes/users"));
    

} catch (err) {
    console.error("❌ Error cargando rutas:", err.message);
}

// ===================== FRONTEND =====================
console.log("📁 Serviendo frontend desde /public");

app.use(express.static(path.join(__dirname, "public")));

app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
corsOptions = {
  origin: '*',
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: 'Content-Type',
};
app.use(cors(corsOptions));
// --- Cargar rutas dinámicas ---
const routersPath = './config/routers.json';
app.get('/api/routers', (req, res) => {
  try {
    const routers = JSON.parse(fs.readFileSync(routersPath));
    res.json(routers);
  } catch (err) {
    console.error('❌ Error leyendo routers.json:', err);
    res.status(500).json({ error: 'No se pudieron cargar las rutas' });
  }
});

// --- Eventos SSE ---
let clients = [];

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);
  console.log('📡 Cliente SSE conectado. Total:', clients.length);

  req.on('close', () => {
    clients = clients.filter(c => c !== res);
    console.log('❌ Cliente SSE desconectado. Restantes:', clients.length);
  });
});

// --- Enviar eventos periódicos ---
setInterval(() => {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage().rss,
  });
  clients.forEach(c => c.write(`data: ${payload}\n\n`));
}, process.env.SSE_PING_INTERVAL || 3000);



// ===================== GLOBAL ERROR HANDLER =====================
app.use((err, req, res, next) => {
    console.error("🔥 ERROR GLOBAL:", err);
    res.status(500).json({ error: "Error interno del servidor" });
});

// ===================== INICIALIZAR SERVIDOR =====================
function start() {
    try {
        initDatabase(); // ⚠ NO usar await porque no es async
        console.log("🔥 BD LISTA");

        const PORT = process.env.PORT || 3000;

        app.listen(PORT, () => {
            console.log("============================================");
            console.log("🌾 AGROMARKET - Sistema de Gestión Agrícola");
            console.log("============================================");
            console.log(`🚀 Servidor activo en: http://localhost:${PORT}`);
            console.log(`🌍 API Base: http://localhost:${PORT}/api`);
            console.log("📁 Frontend listo en /public");
            console.log("============================================");
        });

    } catch (err) {
        console.error("❌ Error iniciando servidor:", err);
        process.exit(1);
    }
}

start();
