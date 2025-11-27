/* ============================================================
   AGRONOVA S.A.C. — FRONTEND CONTROLLER (app.js)
   Manejo de Autenticación, Roles, Productos, Carrito y UI
============================================================ */

// ================= UTILIDADES =====================
const $ = (id) => document.getElementById(id);

function showAlert(type, message) {
    const alert = $("alert");
    const icon = $("alertIcon");
    const msg = $("alertMessage");

    const icons = {
        success: "✓",
        error: "⚠️",
        warning: "❗"
    };

    icon.textContent = icons[type] || "ℹ️";
    msg.textContent = message;

    alert.className = `alert active ${type}`;

    setTimeout(() => {
        alert.classList.remove("active");
    }, 3000);
}

// ================= CONTROL DE PANTALLAS =====================
function showScreen(screenId) {
    document.querySelectorAll(".auth-container").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".app-container").forEach(el => el.classList.remove("active"));

    $(screenId).classList.add("active");
}

// ================= LOADER =====================
window.onload = () => {
    setTimeout(() => {
        $("loader").classList.add("hidden");

        // Si hay un usuario logeado, llevarlo a su panel
        const user = JSON.parse(localStorage.getItem("ag_user"));
        if (user) loadUserSession(user);
        else showScreen("loginScreen");
    }, 800);
};

// ================= BASE DE DATOS LOCAL =====================
const USERS_KEY = "ag_users";
const PRODUCTS_KEY = "ag_products";

// Si no hay productos creados → inicializar
if (!localStorage.getItem(PRODUCTS_KEY)) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify([
        {
            id: 1,
            name: "Fertilizante Premium",
            category: "Insumos",
            price: 120.50,
            stock: 35
        },
        {
            id: 2,
            name: "Semillas de Maíz",
            category: "Semillas",
            price: 85.00,
            stock: 50
        },
        {
            id: 3,
            name: "Herbicida Total",
            category: "Insumos",
            price: 98.75,
            stock: 20
        }
    ]));
}

// ============================================================
//                  SISTEMA DE AUTENTICACIÓN
// ============================================================

// ================= REGISTRO =====================
$("registerForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const name = $("regName").value.trim();
    const email = $("regEmail").value.trim().toLowerCase();
    const password = $("regPassword").value.trim();

    let users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];

    if (users.find(u => u.email === email)) {
        showAlert("error", "Este correo ya está registrado");
        return;
    }

    const newUser = {
        id: Date.now(),
        name,
        email,
        password,
        role: users.length === 0 ? "admin" : "user" // el primero es admin
    };

    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    showAlert("success", "Cuenta creada correctamente");
    showScreen("loginScreen");
});

// ================= LOGIN =====================
$("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const email = $("loginEmail").value.trim().toLowerCase();
    const password = $("loginPassword").value.trim();

    let users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];

    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
        showAlert("error", "Credenciales incorrectas");
        return;
    }

    localStorage.setItem("ag_user", JSON.stringify(user));
    loadUserSession(user);
});

// ================= CARGA DE SESIÓN POR ROL =====================
function loadUserSession(user) {
    $("userNameDisplay").textContent = user.name;

    if (user.role === "admin") {
        $("adminPanel").classList.add("active");
        $("customerPanel").classList.remove("active");
    } else {
        $("customerPanel").classList.add("active");
        $("adminPanel").classList.remove("active");
    }

    showScreen("appMain");
    renderProducts();
    updateCartCount();
}

// ================= LOGOUT =====================
function logout() {
    localStorage.removeItem("ag_user");
    showScreen("loginScreen");
    showAlert("success", "Sesión cerrada");
}

// ================= USER MENU =====================
$("userBtn").addEventListener("click", () => {
    $("userDropdown").classList.toggle("active");
});

document.addEventListener("click", (e) => {
    if (!e.target.closest(".user-menu")) {
        $("userDropdown").classList.remove("active");
    }
});

// ============================================================
//                           PRODUCTOS
// ============================================================

function getProducts() {
    return JSON.parse(localStorage.getItem(PRODUCTS_KEY)) || [];
}

function renderProducts() {
    const products = getProducts();

    // Carrusel
    const carousel = $("carousel");
    carousel.innerHTML = "";

    // Grid
    const grid = $("productsGrid");
    grid.innerHTML = "";

    products.forEach(prod => {
        const card = `
            <div class="product-card">
                <div class="product-image">🌱</div>
                <div class="product-info">
                    <h3>${prod.name}</h3>
                    <div class="category">${prod.category}</div>
                    <div class="price">S/ ${prod.price.toFixed(2)}</div>
                    <div class="stock">Stock disponible: ${prod.stock}</div>
                    <button class="btn-cart" onclick="addToCart(${prod.id})" ${prod.stock <= 0 ? "disabled" : ""}>
                        Añadir al Carrito
                    </button>
                </div>
            </div>
        `;

        carousel.innerHTML += card;
        grid.innerHTML += card;
    });
}

// ============================================================
//                        CARRITO DE COMPRAS
// ============================================================

let cart = JSON.parse(localStorage.getItem("ag_cart")) || [];

function updateCartCount() {
    $("cartBadge").textContent = cart.length;
}

function addToCart(id) {
    const products = getProducts();
    const product = products.find(p => p.id === id);

    if (!product || product.stock === 0) return;

    const item = cart.find(c => c.id === id);

    if (item) item.qty++;
    else cart.push({ id, qty: 1 });

    localStorage.setItem("ag_cart", JSON.stringify(cart));

    updateCartCount();
    showAlert("success", "Producto añadido al carrito");
}

// ================= MODAL DE CARRITO =====================
$("cartBtn").addEventListener("click", () => {
    renderCartModal();
    $("cartModal").classList.add("active");
});

function closeModal(modal) {
    $(modal).classList.remove("active");
}

// ================= RENDER MODAL =====================
function renderCartModal() {
    const products = getProducts();
    const body = $("cartItems");
    let total = 0;

    body.innerHTML = "";

    cart.forEach(item => {
        const prod = products.find(p => p.id === item.id);
        const subtotal = prod.price * item.qty;
        total += subtotal;

        body.innerHTML += `
            <div class="cart-item">
                <div class="cart-item-image">🌱</div>
                <div class="cart-item-info">
                    <h4>${prod.name}</h4>
                    <div class="price">S/ ${prod.price.toFixed(2)}</div>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="changeQty(${prod.id}, -1)">-</button>
                        <span class="quantity-display">${item.qty}</span>
                        <button class="quantity-btn" onclick="changeQty(${prod.id}, 1)">+</button>
                    </div>
                </div>
            </div>
        `;
    });

    $("cartTotal").textContent = `S/ ${total.toFixed(2)}`;
}

// ================= CAMBIAR CANTIDAD =====================
function changeQty(id, delta) {
    const item = cart.find(c => c.id === id);
    if (!item) return;

    item.qty += delta;

    if (item.qty <= 0) {
        cart = cart.filter(c => c.id !== id);
    }

    localStorage.setItem("ag_cart", JSON.stringify(cart));
    updateCartCount();
    renderCartModal();
}

// ============================================================
//                EXPORTAR/CONEXIÓN LISTO
// ============================================================

console.log("AGRONOVA Frontend cargado correctamente.");
