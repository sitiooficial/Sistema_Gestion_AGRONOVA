// middleware.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// =====================================================
// 1) AUTENTICACIÓN JWT
// =====================================================
function authenticate(req, res, next) {
    let token = req.headers["authorization"];
    if (!token) return res.status(401).json({ error: "Token requerido" });

    try {
        token = token.replace(/^Bearer\s+/i, "");
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error("❌ Error verificando token:", err.message);
        return res.status(401).json({ error: "Token inválido" });
    }
}

const authRequired = authenticate;

// =====================================================
// 2) USUARIO AUTENTICADO
// =====================================================
function isUser(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Usuario no autenticado" });
    next();
}

// =====================================================
// 3) ADMIN
// =====================================================
function isAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });
    if (req.user.role !== "admin")
        return res.status(403).json({ error: "Acceso restringido a administradores" });
    next();
}

// =====================================================
// 4) VALIDAR ID
// =====================================================
function validateId(req, res, next) {
    const { id } = req.params;
    if (!id || isNaN(id)) return res.status(400).json({ success: false, error: "ID inválido" });
    next();
}

// =====================================================
// 5) SANITIZAR BODY
// =====================================================
function sanitizeBody(req, res, next) {
    if (!req.body) return next();
    for (const key in req.body) {
        if (typeof req.body[key] === "string") {
            req.body[key] = req.body[key].trim()
                .replace(/<script.*?>.*?<\/script>/gi, "")
                .replace(/[<>]/g, "");
        }
    }
    next();
}

// =====================================================
// 6) VALIDAR PRODUCTO
// =====================================================
function validateProduct(req, res, next) {
    const { name, category, price, stock } = req.body;
    if (!name || !category || price === undefined || stock === undefined)
        return res.status(400).json({ success: false, error: "Campos requeridos: name, category, price, stock" });
    if (isNaN(price) || isNaN(stock))
        return res.status(400).json({ success: false, error: "price y stock deben ser numéricos" });
    next();
}

// =====================================================
// 7) VALIDACIÓN REGISTRO / LOGIN
// =====================================================
function validateRegister(req, res, next) {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Todos los campos son requeridos" });
    if (password.length < 6) return res.status(400).json({ error: "La contraseña debe tener mínimo 6 caracteres" });
    next();
}

function validateLogin(req, res, next) {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email y contraseña requeridos" });
    next();
}

// =====================================================
// 8) RATE LIMIT SIMPLE
// =====================================================
const rateLimitMap = new Map();
function rateLimit(maxRequests, windowMs) {
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
        const attempts = rateLimitMap.get(ip);
        while (attempts.length && attempts[0] <= now - windowMs) attempts.shift();
        if (attempts.length >= maxRequests)
            return res.status(429).json({ success: false, error: "Too Many Requests" });
        attempts.push(now);
        next();
    };
}

// =====================================================
// 9) ASYNC HANDLER
// =====================================================
function asyncHandler(fn) {
    return function (req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// =====================================================
// 10) TOKENS
// =====================================================
function generateToken(id, role) {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function generateResetToken() {
    return crypto.randomBytes(32).toString("hex");
}

// =====================================================
console.log("🛣️ middleware.js cargado correctamente");

// =====================================================
module.exports = {
    authRequired,
    authenticate,
    isUser,
    isAdmin,
    validateId,
    sanitizeBody,
    validateProduct,
    validateRegister,
    validateLogin,
    rateLimit,
    asyncHandler,
    generateToken,
    generateResetToken
};

