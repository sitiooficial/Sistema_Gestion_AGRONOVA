// =====================================================
// middleware.js — VERCEL EDGE COMPATIBLE
// (Sin jsonwebtoken, sin crypto de Node, sin stream)
// =====================================================

// =============================
// JWT NATIVO - WebCrypto API
// =============================

// Convertir a Base64URL
const toBase64Url = input =>
    btoa(input)
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

// Parseo Base64URL → JSON
function fromBase64Url(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(str));
}

// Importa clave secreta HMAC SHA256
async function importKey(secret) {
    return await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

// Firmar JWT
async function signJWT(payload, secret) {
    const header = { alg: "HS256", typ: "JWT" };
    const base64Header = toBase64Url(JSON.stringify(header));
    const base64Payload = toBase64Url(JSON.stringify(payload));

    const data = `${base64Header}.${base64Payload}`;
    const key = await importKey(secret);

    const signatureArray = new Uint8Array(
        await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))
    );

    const signature = toBase64Url(String.fromCharCode(...signatureArray));

    return `${data}.${signature}`;
}

// Verificar JWT usando WebCrypto
async function verifyJWT(token, secret) {
    const [header, payload, signature] = token.split(".");

    if (!header || !payload || !signature) {
        throw new Error("Token malformado");
    }

    const data = `${header}.${payload}`;
    const key = await importKey(secret);

    const signatureArray = Uint8Array.from(
        atob(signature.replace(/-/g, "+").replace(/_/g, "/")),
        c => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
        "HMAC",
        key,
        signatureArray,
        new TextEncoder().encode(data)
    );

    if (!valid) throw new Error("Firma inválida");

    return fromBase64Url(payload);
}

// =====================================================
// AUTHENTICATION - Edge Safe
// =====================================================
async function authenticate(req, res, next) {
    try {
        let token = req.headers.get("authorization");

        if (!token) {
            return res.status(401).json({ error: "Token requerido" });
        }

        token = token.replace(/^Bearer\s+/i, "");

        const decoded = await verifyJWT(token, process.env.JWT_SECRET);

        // Expiración manual (ya que no usamos jsonwebtoken)
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
            return res.status(401).json({ error: "Token expirado" });
        }

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({ error: "Token inválido" });
    }
}

const authRequired = authenticate;

// =====================================================
// ROLES
// =====================================================
function isUser(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });
    next();
}

function isAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });

    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Solo administradores" });
    }

    next();
}

// =====================================================
// VALIDADORES
// =====================================================
function validateId(req, res, next) {
    const id = req.params?.id;
    if (!id || isNaN(id)) {
        return res.status(400).json({ error: "ID inválido" });
    }
    next();
}

function sanitizeBody(req, res, next) {
    if (!req.body) return next();

    for (const key in req.body) {
        if (typeof req.body[key] === "string") {
            req.body[key] = req.body[key]
                .trim()
                .replace(/<script.*?>.*?<\/script>/gi, "")
                .replace(/[<>]/g, "");
        }
    }

    next();
}

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

function validateRegister(req, res, next) {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "Todos los campos son requeridos" });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: "Minimo 6 caracteres" });
    }

    next();
}

function validateLogin(req, res, next) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    next();
}

// =====================================================
// RATE LIMIT
// =====================================================
const rateMap = new Map();

function rateLimit(max, ms) {
    return (req, res, next) => {
        const ip = req.ip || "unknown";
        const now = Date.now();

        if (!rateMap.has(ip)) rateMap.set(ip, []);

        const requests = rateMap.get(ip);

        while (requests.length && requests[0] <= now - ms) {
            requests.shift();
        }

        if (requests.length >= max) {
            return res.status(429).json({ error: "Too Many Requests" });
        }

        requests.push(now);
        next();
    };
}

// =====================================================
// asyncHandler
// =====================================================
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// =====================================================
// GENERATE TOKEN (EDGE SAFE)
// =====================================================
async function generateToken(id, role) {
    return await signJWT(
        {
            id,
            role,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 días
        },
        process.env.JWT_SECRET
    );
}

// =====================================================
// EXPORTS
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
