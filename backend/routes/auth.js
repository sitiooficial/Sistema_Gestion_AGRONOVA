/**
 * ============================================
 * AUTH ROUTES - routes/auth.js
 * Rutas de autenticación y gestión de usuarios
 * ============================================
 */

const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../database');
const middleware = require('../middleware');
const nodemailer = require('nodemailer');

// Configurar transporter de email (usar variables de entorno en producción)
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'tu-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'tu-contraseña-app'
    }
});

// ============================================
// REGISTRO
// ============================================

router.post('/register', 
    middleware.rateLimit(10, 600000), // 10 requests por 10 minutos
    middleware.sanitizeBody,
    middleware.validateRegister,
    middleware.asyncHandler(async (req, res) => {
        const { name, email, password } = req.body;

        // Verificar si el email ya existe
        const existingUser = await db.findUserByEmail(email);
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'El email ya está registrado'
            });
        }

        // Hash de contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear usuario
        const user = await db.createUser(name, email, hashedPassword, 'customer');

        // Generar token
        const token = middleware.generateToken(user.id, user.role);

        // Enviar email de bienvenida
        try {
            await emailTransporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: '¡Bienvenido a AgroMarket! 🌾',
                html: `
                    <h2>¡Hola ${name}!</h2>
                    <p>Gracias por registrarte en AgroMarket.</p>
                    <p>Tu cuenta ha sido creada exitosamente.</p>
                    <p>Ahora puedes explorar y comprar nuestros productos agrícolas frescos.</p>
                    <br>
                    <p>Saludos,</p>
                    <p><strong>Equipo AgroMarket</strong></p>
                `
            });
        } catch (emailError) {
            console.error('Error enviando email:', emailError);
            // No fallar el registro si el email falla
        }

        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente',
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            }
        });
    })
);

// ============================================
// LOGIN
// ============================================

router.post('/login',
    middleware.rateLimit(20, 600000), // 20 requests por 10 minutos
    middleware.sanitizeBody,
    middleware.validateLogin,
    middleware.asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        // Buscar usuario
        const user = await db.findUserByEmail(email);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Credenciales inválidas'
            });
        }

        // Verificar contraseña
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Credenciales inválidas'
            });
        }

        // Verificar que la cuenta esté activa
        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: 'Cuenta desactivada. Contacta al administrador'
            });
        }

        // Generar token
        const token = middleware.generateToken(user.id, user.role);

        res.json({
            success: true,
            message: 'Login exitoso',
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            }
        });
    })
);

// ============================================
// RECUPERAR CONTRASEÑA
// ============================================

router.post('/forgot-password',
    middleware.rateLimit(5, 600000), // 5 requests por 10 minutos
    middleware.sanitizeBody,
    middleware.asyncHandler(async (req, res) => {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email es requerido'
            });
        }

        const user = await db.findUserByEmail(email);

        // Por seguridad, siempre responder exitoso
        if (!user) {
            return res.json({
                success: true,
                message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña'
            });
        }

        // Generar token de reset
        const resetToken = middleware.generateResetToken();
        const resetExpires = Date.now() + 3600000; // 1 hora

        await db.updateUserResetToken(email, resetToken, resetExpires);

        // Enviar email
        const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;

        try {
            await emailTransporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Recuperar Contraseña - AgroMarket',
                html: `
                    <h2>Recuperar Contraseña</h2>
                    <p>Hola ${user.name},</p>
                    <p>Recibimos una solicitud para recuperar tu contraseña.</p>
                    <p>Haz click en el siguiente enlace para crear una nueva contraseña:</p>
                    <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                        Recuperar Contraseña
                    </a>
                    <p>Este enlace expirará en 1 hora.</p>
                    <p>Si no solicitaste este cambio, ignora este email.</p>
                    <br>
                    <p>Saludos,</p>
                    <p><strong>Equipo AgroMarket</strong></p>
                `
            });
        } catch (emailError) {
            console.error('Error enviando email:', emailError);
            return res.status(500).json({
                success: false,
                error: 'Error enviando email. Intenta más tarde'
            });
        }

        res.json({
            success: true,
            message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña'
        });
    })
);

// ============================================
// VERIFICAR TOKEN
// ============================================

router.get('/verify',
    middleware.authenticate,
    middleware.asyncHandler(async (req, res) => {
        res.json({
            success: true,
            data: {
                user: {
                    id: req.user.id,
                    name: req.user.name,
                    email: req.user.email,
                    role: req.user.role
                }
            }
        });
    })
);

// ============================================
// LOGOUT (Opcional - el token se elimina en el cliente)
// ============================================

router.post('/logout',
    middleware.authenticate,
    (req, res) => {
        // En JWT, el logout se maneja en el cliente eliminando el token
        // Aquí puedes agregar lógica adicional si usas blacklist de tokens
        
        res.json({
            success: true,
            message: 'Logout exitoso'
        });
    }
);

module.exports = router;
