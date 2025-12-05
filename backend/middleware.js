// =====================================================
// middleware.js — EDGE-COMPATIBLE (sin jsonwebtoken, sin crypto node)
// Usa Web Crypto API (crypto.subtle)
// =====================================================

// =============================
// Helpers para JWT Web Crypto
// =============================
async function importKey(secret) {
    return crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

async function signJWT(payload, secret) {
    const key = await importKey(secret);
    const header = { alg: "HS256", typ: "JWT" };

    const base64 = obj =>
        btoa(JSON.stringify(obj))
            .replace(/=/g, "")
            .replace(/\+/g, "-")
            .replace(/\//g, "_");

    const data = `${base64(header)}.${base64(payload)}`;

    const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(data)
    );

    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    return `${data}.${signature}`;
}

async function verifyJWT(token, secret) {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) throw new Error("Token inválido");

    const key = await importKey(secret);

    const data = `${h}.${p}`;

    const signatureBinary = Uint8Array.from(
        atob(s.replace(/-/g, "+").replace(/_/g, "/")),
        c => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
        "HMAC",
        key,
        signatureBinary,
        new TextEncoder().encode(data)
    );

    if (!valid) throw new Error("Firma no válida");

    return JSON.parse(atob(p));
}

// =====================================================
// 1) AUTHENTICATE
// =====================================================
async function authenticate(req, res, next) {
    try {
        let token = req.headers.get("authorization");

        if (!token) {
            return res.status(401).json({ error: "Token requerido" });
        }

        token = token.replace(/^Bearer\s+/i, "");

        const decoded = await verifyJWT(token, process.env.JWT_SECRET);

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
    }
}

const authRequired = authenticate;

// =====================================================
// 2) isUser
// =====================================================
function isUser(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
    }
    next();
}

// =====================================================
// 3) SOLO ADMIN
// =====================================================
function isAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });

    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Acceso solo administradores" });
    }

    next();
}

// =====================================================
// 4) VALIDACIONES
// =====================================================
function validateId(req, res, next) {
    const id = req.params.id;
    if (!id || isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
    }
    next();
}

function sanitizeBody(req, res, next) {
    if (!req.body) return next();

    for (const k in req.body) {
        if (typeof req.body[k] === "string") {
            req.body[k] = req.body[k]
                .trim()
                .replace(/<script.*?>.*?<\/script>/gi, "")
                .replace(/[<>]/g, "");
        }
    }

    next();
}

// PRODUCTO
function validateProduct(req, res, next) {
    const { name, category, price, stock } = req.body;

    if (!name || !category || price === undefined || stock === undefined) {
        return res.status(400).json({
            error: "Campos requeridos: name, category, price, stock"
        });
    }

    if (isNaN(price) || isNaN(stock)) {
        return res.status(400).json({
            error: "price y stock deben ser numéricos"
        });
    }

    next();
}

// REGISTER
function validateRegister(req, res, next) {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "Todos los campos son requeridos" });
    }

    if (password.length < 6) {
        return res.status(400).json({
            error: "La contraseña debe tener mínimo 6 caracteres"
        });
    }

    next();
}

// LOGIN
function validateLogin(req, res, next) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    next();
}

// =====================================================
// 5) RATE LIMIT SIMPLE
// =====================================================
const rateMap = new Map();

function rateLimit(maxRequests, windowMs) {
    return (req, res, next) => {
        const ip = req.ip || "unknown";
        const now = Date.now();

        if (!rateMap.has(ip)) rateMap.set(ip, []);

        const attempts = rateMap.get(ip);

        while (attempts.length && attempts[0] <= now - windowMs) {
            attempts.shift();
        }

        if (attempts.length >= maxRequests) {
            return res.status(429).json({ error: "Too Many Requests" });
        }

        attempts.push(now);
        next();
    };
}

// =====================================================
// 6) ASYNC HANDLER
// =====================================================
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// =====================================================
// 7) GENERAR TOKEN (Edge-SAFE)
// =====================================================
async function generateToken(id, role) {
    const payload = {
        id,
        role,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 días
    };

    return await signJWT(payload, process.env.JWT_SECRET);
}

// =====================================================
// EXPORTAR
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
    generateToken
};
