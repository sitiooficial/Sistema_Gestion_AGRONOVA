// routes/users.js
const express = require("express");
const router = express.Router();

const {
    authRequired,
    isAdmin,
    validateId,
    sanitizeBody,
    asyncHandler,
    generateResetToken
} = require("../middleware");

const db = require("../database");
const bcrypt = require("bcrypt");

// ==============================================
// 1) LISTAR TODOS LOS USUARIOS (ADMIN)
// ==============================================
router.get("/", authRequired, isAdmin, asyncHandler(async (req, res) => {
    const users = await db.prepare("SELECT id, name, email, role FROM users").all();
    res.json({ success: true, users });
}));

// ==============================================
// 2) OBTENER UN USUARIO POR ID (Admin + dueño)
// ==============================================
router.get("/:id", authRequired, validateId, asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (req.user.role !== "admin" && req.user.id != id) {
        return res.status(403).json({ error: "No autorizado" });
    }

    const user = await db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(id);

    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    res.json({ success: true, user });
}));

// ==============================================
// 3) ACTUALIZAR PERFIL
// ==============================================
router.put("/update", authRequired, sanitizeBody, asyncHandler(async (req, res) => {
    const { name, email } = req.body;

    if (!name && !email) {
        return res.status(400).json({ error: "Nada para actualizar" });
    }

    await db.prepare(`
        UPDATE users
        SET name = COALESCE(?, name),
            email = COALESCE(?, email)
        WHERE id = ?
    `).run(name, email, req.user.id);

    res.json({ success: true, message: "Perfil actualizado" });
}));

// ==============================================
// 4) CAMBIAR CONTRASEÑA
// ==============================================
router.put("/change-password", authRequired, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Faltan campos" });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: "La nueva contraseña es demasiado corta" });
    }

    const user = await db.prepare("SELECT password FROM users WHERE id = ?").get(req.user.id);

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
        return res.status(400).json({ error: "La contraseña actual es incorrecta" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashed, req.user.id);

    res.json({ success: true, message: "Contraseña actualizada" });
}));

// ==============================================
// 5) ELIMINAR USUARIO (Admin)
// ==============================================
router.delete("/:id", authRequired, isAdmin, validateId, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const exists = await db.prepare("SELECT id FROM users WHERE id = ?").get(id);
    if (!exists) return res.status(404).json({ error: "Usuario no encontrado" });

    await db.prepare("DELETE FROM users WHERE id = ?").run(id);

    res.json({ success: true, message: "Usuario eliminado" });
}));

// ==============================================
// 6) SOLICITUD DE RESET PASSWORD
// ==============================================
router.post("/reset-password/request", sanitizeBody, asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: "Email requerido" });

    const user = await db.prepare("SELECT id FROM users WHERE email = ?").get(email);

    if (!user) {
        return res.json({ success: true, message: "Si existe, se enviará el correo (anti enumeración)" });
    }

    const token = generateResetToken();
    const expires = Date.now() + 1000 * 60 * 30; // 30 minutos

    await db.prepare(`
        INSERT INTO password_resets (userId, token, expiresAt)
        VALUES (?, ?, ?)
    `).run(user.id, token, expires);

    res.json({
        success: true,
        message: "Token generado. (Aquí deberías enviarlo por correo)",
        token // devolverlo solo para testing
    });
}));

// ==============================================
// 7) CONFIRMAR RESET PASSWORD
// ==============================================
router.post("/reset-password/confirm", asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: "Datos incompletos" });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: "Contraseña muy corta" });
    }

    const reset = await db.prepare(`
        SELECT * FROM password_resets WHERE token = ?
    `).get(token);

    if (!reset) {
        return res.status(400).json({ error: "Token inválido" });
    }

    if (reset.expiresAt < Date.now()) {
        return res.status(400).json({ error: "Token expirado" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await db.prepare(`
        UPDATE users SET password = ? WHERE id = ?
    `).run(hashed, reset.userId);

    await db.prepare(`DELETE FROM password_resets WHERE token = ?`).run(token);

    res.json({ success: true, message: "Contraseña restaurada" });
}));

module.exports = router;
