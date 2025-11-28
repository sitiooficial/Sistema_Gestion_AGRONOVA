// ==========================
// APP.JS OPTIMIZADO COMPLETO
// Opción B — Versión Profesional
// ==========================

/*
  SISTEMA FRONTEND — OPTIMIZADO
  Funcionalidades:
  - Router interno por secciones
  - Manejo de usuario (cliente/admin)
  - Carrito dinámico
  - Productos, ventas, inventario
  - Admin dashboard
  - Fetch wrapper con timeout y manejo de errores
  - Sistema de alertas unificado
  - Prevención de recargas innecesarias
  - Auto-cache local
*/

// ---------------------------------------------------------
// UTILIDADES BÁSICAS
// ---------------------------------------------------------

const API_BASE = "/api";
const TIMEOUT = 12000; // 12s
let currentUser = null;
let cart = [];

// Cache local simple
const Cache = {
  set(key, data) {
    localStorage.setItem(key, JSON.stringify({ data, time: Date.now() }));
  },
  get(key, maxAgeMs = 30000) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, time } = JSON.parse(raw);
    if (Date.now() - time > maxAgeMs) return null;
    return data;
  }
};

// Wrapper seguro para fetch
async function api(endpoint, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(id);

    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);

    return await res.json();
  } catch (err) {
    console.error("API error:", err);
    showAlert(`Error: ${err.message}`, "error");
    return null;
  }
}

// ---------------------------------------------------------
// SISTEMA DE ALERTAS
// ---------------------------------------------------------
function showAlert(msg, type = "info") {
  const box = document.getElementById("alertBox");
  if (!box) return alert(msg);

  box.className = `alert ${type}`;
  box.innerText = msg;
  box.style.display = "block";

  setTimeout(() => {
    box.style.display = "none";
  }, 3000);
}

// ---------------------------------------------------------
// NAVEGACIÓN ENTRE SECCIONES
// ---------------------------------------------------------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.style.display = "none");
  const sc = document.getElementById(id);
  if (sc) sc.style.display = "block";
}

// ---------------------------------------------------------
// LOGIN
// ---------------------------------------------------------
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  const data = await api(`/login`, {
    method: "POST",
    body: JSON.stringify({ username, password })
  });

  if (!data) return;

  currentUser = data.user;

  if (currentUser.role === "admin") {
    showScreen("adminPanel");
    loadAdminData();
  } else {
    showScreen("store");
    loadProducts();
  }
});

// ---------------------------------------------------------
// CARGA DE PRODUCTOS
// ---------------------------------------------------------
async function loadProducts() {
  let cached = Cache.get("products");
  if (cached) return renderProducts(cached);

  const data = await api(`/products`);
  if (!data) return;

  Cache.set("products", data.products);
  renderProducts(data.products);
}

function renderProducts(products) {
  const box = document.getElementById("productList");
  if (!box) return;

  box.innerHTML = products.map(p => `
    <div class="product-item">
      <h3>${p.name}</h3>
      <p>${p.description}</p>
      <strong>S/ ${p.price}</strong>
      <button onclick="addToCart(${p.id})">Agregar</button>
    </div>
  `).join("");
}

// ---------------------------------------------------------
// CARRITO DE COMPRAS
// ---------------------------------------------------------
function addToCart(id) {
  const products = Cache.get("products") || [];
  const item = products.find(p => p.id === id);
  if (!item) return;

  const exists = cart.find(p => p.id === id);
  if (exists) exists.qty++;
  else cart.push({ ...item, qty: 1 });

  renderCart();
}

function renderCart() {
  const box = document.getElementById("cartList");
  if (!box) return;

  if (cart.length === 0) {
    box.innerHTML = `<p>Carrito vacío</p>`;
    return;
  }

  box.innerHTML = cart.map(i => `
    <div class="cart-item">
      <span>${i.name} x ${i.qty}</span>
      <strong>S/ ${(i.price * i.qty).toFixed(2)}</strong>
      <button onclick="removeFromCart(${i.id})">X</button>
    </div>
  `).join("");
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  renderCart();
}

// ---------------------------------------------------------
// PROCESAR PAGO
// ---------------------------------------------------------
document.getElementById("checkoutBtn")?.addEventListener("click", async () => {
  if (cart.length === 0) return showAlert("Carrito vacío", "error");

  const order = {
    userId: currentUser.id,
    items: cart.map(i => ({ id: i.id, qty: i.qty })),
  };

  const payData = await api(`/pay`, {
    method: "POST",
    body: JSON.stringify(order)
  });

  if (!payData) return;

  showAlert("Pago procesado con éxito", "success");
  cart = [];
  renderCart();
});

// ---------------------------------------------------------
// ADMIN: DASHBOARD
// ---------------------------------------------------------
async function loadAdminData() {
  loadProductsAdmin();
  loadInventory();
  loadSales();
  loadUsers();
}

async function loadProductsAdmin() {
  const box = document.getElementById("adminProducts");
  if (!box) return;

  const data = await api(`/products`);
  if (!data) return;

  box.innerHTML = data.products.map(p => `
    <div class="admin-row">
      <span>${p.id}</span>
      <span>${p.name}</span>
      <span>S/ ${p.price}</span>
    </div>
  `).join("");
}

async function loadInventory() {
  const box = document.getElementById("adminInventory");
  if (!box) return;

  const data = await api(`/inventory`);
  if (!data) return;

  box.innerHTML = data.items.map(i => `
    <div class="admin-row">
      <span>${i.product}</span>
      <span>${i.stock}</span>
    </div>
  `).join("");
}

async function loadSales() {
  const box = document.getElementById("adminSales");
  if (!box) return;

  const data = await api(`/sales`);
  if (!data) return;

  box.innerHTML = data.sales.map(s => `
    <div class="admin-row">
      <span>#${s.id}</span>
      <span>S/ ${s.total}</span>
    </div>
  `).join("");
}

async function loadUsers() {
  const box = document.getElementById("adminUsers");
  if (!box) return;

  const data = await api(`/users`);
  if (!data) return;

  box.innerHTML = data.users.map(u => `
    <div class="admin-row">
      <span>${u.id}</span>
      <span>${u.username}</span>
      <span>${u.role}</span>
    </div>
  `).join("");
}

// ---------------------------------------------------------
// INICIO DEL SISTEMA
// ---------------------------------------------------------
showScreen("loginScreen");
