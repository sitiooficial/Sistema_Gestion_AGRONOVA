/**
 * ============================================
 * FRONTEND APP - app.js (SINCRONIZADO)
 * Lógica del cliente para AgroMarket
 * ============================================
 */

// ============================================
// CONFIGURACIÓN
// ============================================

const API_URL = 'http://localhost:3000/api';
let currentUser = null;
let authToken = null;
let cart = [];
let allProducts = [];
let selectedPaymentMethod = null;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    authToken = localStorage.getItem('authToken');

    if (authToken) {
        try {
            await verifyToken();
        } catch (e) {
            console.warn("Token inválido");
            logout();
        }
    } else {
        showScreen("loginScreen");
    }

    // Cargar carrito
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartBadge();
    }

    setupEventListeners();
    hideLoader();
}

function setupEventListeners() {

    // Formularios Auth — (TODOS EXISTEN EN EL index.html)
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
    document.getElementById('forgotPasswordForm')?.addEventListener('submit', handleForgotPassword);

    // Form productos (admin)
    document.getElementById('productForm')?.addEventListener('submit', handleProductSubmit);

    // Buscador
    document.getElementById('searchInput')?.addEventListener('input', handleSearch);

    // Cerrar dropdown al hacer click afuera
    document.addEventListener('click', e => {
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

        const r = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await r.json();

        if (!data.success) return showAlert(data.error, "error");

        authToken = data.data.token;
        currentUser = data.data.user;

        localStorage.setItem("authToken", authToken);
        localStorage.setItem("user", JSON.stringify(currentUser));

        showAlert("Bienvenido " + currentUser.name, "success");

        if (currentUser.role === "admin") {
            loadAdminPanel();
        } else {
            loadCustomerPanel();
        }

    } catch (e) {
        showAlert("Error de conexión", "error");
    } finally {
        hideLoader();
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPassword').value;
    const pass2 = document.getElementById('regPasswordConfirm').value;

    if (pass !== pass2) return showAlert("Las contraseñas no coinciden", "error");

    try {
        showLoader();

        const r = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password: pass })
        });

        const data = await r.json();

        if (!data.success) return showAlert(data.error, "error");

        authToken = data.data.token;
        currentUser = data.data.user;

        localStorage.setItem("authToken", authToken);
        localStorage.setItem("user", JSON.stringify(currentUser));

        showAlert("Cuenta creada exitosamente", "success");
        loadCustomerPanel();

    } catch (e) {
        showAlert("Error de conexión", "error");
    } finally {
        hideLoader();
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();

    const email = document.getElementById("forgotEmail").value;

    try {
        showLoader();

        const r = await fetch(`${API_URL}/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const data = await r.json();

        if (!data.success) return showAlert(data.error, "error");

        showAlert("Enlace enviado a tu correo", "success");

        setTimeout(() => showScreen("loginScreen"), 2000);

    } catch (e) {
        showAlert("Error de conexión", "error");
    } finally {
        hideLoader();
    }
}

async function verifyToken() {
    const r = await fetch(`${API_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });

    const data = await r.json();

    if (!data.success) throw new Error("Token inválido");

    currentUser = data.data.user;
    localStorage.setItem("user", JSON.stringify(currentUser));

    if (currentUser.role === "admin") {
        loadAdminPanel();
    } else {
        loadCustomerPanel();
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    cart = [];

    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    localStorage.removeItem("cart");

    showScreen("loginScreen");
    showAlert("Sesión cerrada", "success");
}

// ============================================
// PANEL ADMIN
// ============================================

async function loadAdminPanel() {
    document.getElementById("appContainer").classList.add("active");
    document.getElementById("adminPanel").classList.remove("hidden");
    document.getElementById("customerPanel").classList.add("hidden");
    document.getElementById("cartBtn").classList.add("hidden");

    document.getElementById("userName").textContent = currentUser.name;

    await loadDashboard();
}

async function loadDashboard() {
    try {
        const r = await fetch(`${API_URL}/admin/dashboard`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const data = await r.json();
        if (!data.success) return;

        const stats = data.data;

        document.getElementById('totalProducts').textContent = stats.totalProducts;
        document.getElementById('totalSales').textContent = `S/ ${stats.totalSales.toFixed(2)}`;
        document.getElementById('totalOrders').textContent = stats.totalOrders;
        document.getElementById('lowStock').textContent = stats.lowStock;

        displayRecentSales(stats.recentSales);

    } catch (e) {
        console.error(e);
    }
}

function displayRecentSales(sales) {
    const container = document.getElementById("recentSalesTable");

    if (!sales || sales.length === 0) {
        container.innerHTML = "<p>No hay ventas recientes</p>";
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Método</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                </tr>
            </thead>
        <tbody>
    `;

    sales.forEach(s => {
        html += `
            <tr>
                <td>${s.id}</td>
                <td>${s.user_name}</td>
                <td>S/ ${s.total.toFixed(2)}</td>
                <td>${s.payment_method}</td>
                <td><span class="badge badge-${s.status}">${s.status}</span></td>
                <td>${new Date(s.created_at).toLocaleDateString()}</td>
            </tr>
        `;
    });

    html += "</tbody></table>";
    container.innerHTML = html;
}
    msg.textContent = message;

    alert.className = `alert ${type}`;
    alert.classList.add('show');

    setTimeout(() => {
        alert.classList.remove('show');
    }, 3000);
}

// ============================================
// INVENTARIO (ADMIN)
// ============================================

async function loadInventory() {
    try {
        const response = await fetch(`${API_URL}/inventory`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        if (data.success) {
            displayInventory(data.data);
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
        showAlert('Error cargando inventario', 'error');
    }
}

function displayInventory(items) {
    const tbody = document.getElementById('inventoryTableBody');

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No hay datos de inventario</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(i => `
        <tr>
            <td>${i.id}</td>
            <td>${i.name}</td>
            <td>${i.stock}</td>
            <td>${i.min_stock}</td>
            <td>
                ${i.stock <= i.min_stock ? 
                    '<span class="badge badge-warning">Bajo</span>' : 
                    '<span class="badge badge-success">OK</span>'
                }
            </td>
        </tr>
    `).join('');
}

// ============================================
// USUARIOS (ADMIN)
// ============================================

async function loadUsers() {
    try {
        const res = await fetch(`${API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await res.json();

        if (data.success) {
            displayUsers(data.data);
        }
    } catch (err) {
        console.error(err);
        showAlert('Error cargando usuarios', 'error');
    }
}

function displayUsers(users) {
    const table = document.getElementById('usersTableBody');

    if (!users || users.length === 0) {
        table.innerHTML = '<tr><td colspan="5">No hay usuarios registrados</td></tr>';
        return;
    }

    table.innerHTML = users.map(u => `
        <tr>
            <td>${u.id}</td>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>${new Date(u.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

// ============================================
// VENTAS (ADMIN)
// ============================================

async function loadSalesAdmin() {
    try {
        const res = await fetch(`${API_URL}/admin/sales`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await res.json();
        if (data.success) {
            displaySalesAdmin(data.data);
        }
    } catch (err) {
        console.error(err);
        showAlert('Error cargando ventas', 'error');
    }
}

function displaySalesAdmin(sales) {
    const tbody = document.getElementById('salesTableBody');

    if (!sales || sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No hay ventas registradas</td></tr>';
        return;
    }

    tbody.innerHTML = sales.map(s => `
        <tr>
            <td>${s.id}</td>
            <td>${s.user_name}</td>
            <td>S/ ${s.total.toFixed(2)}</td>
            <td>${s.payment_method}</td>
            <td><span class="badge badge-${s.status}">${s.status}</span></td>
            <td>${new Date(s.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

// ============================================
// FIN DEL ARCHIVO
// ============================================

console.log("AgroMarket Frontend Loaded ✔");
