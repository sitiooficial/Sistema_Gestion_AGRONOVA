/**
 * ============================================
 * FRONTEND APP - app.js
 * Lógica del cliente para AgroMarket
 * ============================================
 */

// ============================================
// CONFIGURACIÓN
// ============================================

// Cambiar puerto según dónde corras tu backend
const BACKEND_PORTS = [3000, 4000, 5000];
let API_URL = null;
let currentUser = null;
let authToken = null;
let cart = [];
let allProducts = [];
let selectedPaymentMethod = null;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    detectBackend().then(() => initializeApp());
});

async function detectBackend() {
    for (const port of BACKEND_PORTS) {
        const url = `http://localhost:${port}/api`;
        try {
            const response = await fetch(url + '/auth/ping'); // ruta simple de prueba en backend
            if (response.ok) {
                API_URL = url;
                console.log(`Backend detectado en puerto ${port}`);
                return;
            }
        } catch (e) {
            console.warn(`Backend no responde en puerto ${port}`);
        }
    }
    showAlert('No se pudo conectar con el backend en ninguno de los puertos: ' + BACKEND_PORTS.join(', '), 'error');
    throw new Error('Backend no disponible');
}

async function initializeApp() {
    // Verificar si hay token guardado
    authToken = localStorage.getItem('authToken');
    
    if (authToken) {
        try {
            await verifyToken();
        } catch (error) {
            console.error('Token inválido:', error);
            logout();
        }
    } else {
        showScreen('loginScreen');
    }

    // Cargar carrito desde localStorage
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartBadge();
    }

    setupEventListeners();
    hideLoader();
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
    document.getElementById('forgotPasswordForm')?.addEventListener('submit', handleForgotPassword);
    document.getElementById('productForm')?.addEventListener('submit', handleProductSubmit);
    document.getElementById('searchInput')?.addEventListener('input', handleSearch);
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-menu')) {
            document.getElementById('userDropdown')?.classList.remove('active');
        }
    });
}

// ============================================
// AUTENTICACIÓN
// ============================================

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        showLoader();
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data.success) {
            authToken = data.data.token;
            currentUser = data.data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            showAlert('Bienvenido ' + currentUser.name, 'success');

            if (currentUser.role === 'admin') {
                await loadAdminPanel();
            } else {
                await loadCustomerPanel();
            }
        } else {
            showAlert(data.error || 'Error al iniciar sesión', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error de conexión: ' + error.message, 'error');
    } finally {
        hideLoader();
    }
}

async function verifyToken() {
    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data.success) {
            currentUser = data.data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            if (currentUser.role === 'admin') {
                await loadAdminPanel();
            } else {
                await loadCustomerPanel();
            }
        } else {
            throw new Error('Token inválido');
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        logout();
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    cart = [];
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('cart');
    showScreen('loginScreen');
    showAlert('Sesión cerrada', 'success');
}

// ============================================
// RESTO DEL CÓDIGO
// ============================================
// Mantener funciones de admin, cliente, carrito, checkout y utilidades
// Igual que en tu código original, solo reemplazando API_URL por la variable dinámica
