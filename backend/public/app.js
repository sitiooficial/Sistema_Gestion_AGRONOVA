/**
 * ============================================
 * FRONTEND APP - app.js
 * Lógica del cliente para AgroMarket
 * - Loader global automático (intercepta fetch)
 * - Resolución dinámica del API_URL en puertos comunes
 * ============================================
 */

// ============================================
// CONFIGURACIÓN
// ============================================

// Lista de bases que vamos a probar (puedes editar)
const API_BASES_TO_TRY = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:5000',
  'https://sistema-gestion-agronova-1.onrender.com'
];

// valor final con /api al final, se asigna en initializeApp
let API_URL = null;

let currentUser = null;
let authToken = null;
let cart = [];
let allProducts = [];
let selectedPaymentMethod = null;

// Loader counter para manejar llamadas concurrentes
let __fetchCount = 0;
let __hideTimer = null;

// ============================================
// LOADER GLOBAL: interceptar window.fetch
// ============================================

(function installGlobalFetchInterceptor() {
  if (!window.fetch) return; // browsers very old

  const originalFetch = window.fetch.bind(window);

  // pequeña función helper para timeout
  function fetchWithTimeout(resource, options = {}, timeout = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const finalOptions = { ...options, signal: controller.signal };
    return originalFetch(resource, finalOptions)
      .finally(() => clearTimeout(id));
  }

  window.fetch = async function interceptedFetch(input, init) {
    // iniciar loader (incrementa contador)
    __incrementFetchCount();

    try {
      // Usa fetchWithTimeout para evitar colgarse en redes locales (8s por defecto)
      const res = await fetchWithTimeout(input, init, 10000);
      return res;
    } catch (err) {
      // rethrow para que la app maneje el error
      throw err;
    } finally {
      // decrementa contador y esconde loader con pequeño debounce
      __decrementFetchCount();
    }
  };

  // helpers de contador
  window.__incrementFetchCount = function () {
    __fetchCount = Math.max(0, __fetchCount) + 1;
    // mostrar inmediatamente
    const loader = document.getElementById('loader');
    if (loader) loader.classList.remove('hidden');
    // si había timer para esconderlo, limpiar
    if (__hideTimer) {
      clearTimeout(__hideTimer);
      __hideTimer = null;
    }
  };

  window.__decrementFetchCount = function () {
    __fetchCount = Math.max(0, __fetchCount - 1);
    // esperamos un pequeño tiempo (150ms) antes de ocultar para evitar "parpadeos"
    if (__fetchCount === 0) {
      __hideTimer = setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.add('hidden');
        __hideTimer = null;
      }, 150); // <<--- tiempo corto que pediste
    }
  };

})();

// Export local helpers to internal functions
function showLoader() {
  if (window.__incrementFetchCount) window.__incrementFetchCount();
}
function hideLoader() {
  // for manual hide we decrement once (only if fetchCount>0)
  if (window.__decrementFetchCount) window.__decrementFetchCount();
}

// ============================================
// UTIL: detecta qué base de API responde
// ============================================

async function tryResolveApiBase(bases = API_BASES_TO_TRY, timeoutMs = 1200) {
  // Try cached value first
  const cached = localStorage.getItem('agromarket_api_base');
  if (cached) {
    // verify the cached base quickly
    try {
      const ok = await pingBase(cached, timeoutMs);
      if (ok) return cached;
      // else fallthrough to try list
    } catch (_) {}
  }

  for (const base of bases) {
    try {
      const ok = await pingBase(base, timeoutMs);
      if (ok) {
        localStorage.setItem('agromarket_api_base', base);
        return base;
      }
    } catch (err) {
      // siguiente base
    }
  }

  // fallback: devuelve el primero (asumimos puerto 3000)
  return bases[0];
}

async function pingBase(base, timeoutMs = 1000) {
  // intenta hacer un HEAD/GET corto contra /api/health o /api/ping si existe
  // intentamos /api/health, /api/ping, /api
  const candidates = [`${base}/api/health`, `${base}/api/ping`, `${base}/api`];

  for (const url of candidates) {
    try {
      // utiliza fetch con abort
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(id);
      if (res && (res.ok || res.status === 404 || res.status === 200)) {
        // si responde (OK o incluso 404 en /api) asumimos que el server está vivo y accesible
        return true;
      }
    } catch (err) {
      // ignora y prueba siguiente candidato
    }
  }
  return false;
}

// Helper que construye la URL final /api/...
function buildApi(path = '') {
  if (!API_URL) {
    // seguridad: intenta resolver rápido
    return `/api${path.startsWith('/') ? path : '/' + path}`;
  }
  // API_URL tiene /api al final
  if (path.startsWith('/')) path = path.slice(1);
  return `${API_URL}/${path}`;
}

// ============================================
// INICIALIZACIÓN APP
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

async function initializeApp() {
  // mostrar loader inicial
  try {
    showLoader();

    // resolver base del API (intenta puertos)
    const base = await tryResolveApiBase();
    API_URL = `${base}/api`;
    console.log('API_URL resuelto ->', API_URL);

    // cargar token de localStorage
    authToken = localStorage.getItem('authToken') || null;
    if (authToken) {
      try {
        await verifyToken();
      } catch (err) {
        console.warn('verifyToken falló en init:', err);
        logout();
      }
    } else {
      showScreen('loginScreen');
    }

    // cargar carrito
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try { cart = JSON.parse(savedCart); } catch (e) { cart = []; }
      updateCartBadge();
    }

    setupEventListeners();

    // cargar inventario de baja prioridad (no bloquear UI)
    // pero como fetch está interceptado, loader se muestra solo si hay requests activas
    setTimeout(() => {
      if (typeof cargarInventario === 'function') {
        cargarInventario().catch(() => {});
      }
    }, 300);

  } catch (err) {
    console.error('initializeApp error:', err);
  } finally {
    // ocultamos loader (de manera segura, decrementando contador)
    // si no hay fetch en curso, se ocultará rápidamente
    hideLoader();
  }
}

// ============================================
// EVENTOS
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
// AUTENTICACIÓN (usa buildApi para rutas)
// ============================================

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    showLoader();
    const res = await fetch(buildApi('auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (data.success) {
      authToken = data.data.token;
      currentUser = data.data.user;
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('user', JSON.stringify(currentUser));
      showAlert('Bienvenido ' + currentUser.name, 'success');
      if (currentUser.role === 'admin') await loadAdminPanel(); else await loadCustomerPanel();
    } else {
      showAlert(data.error || 'Error al iniciar sesión', 'error');
    }
  } catch (err) {
    console.error(err);
    showAlert('Error de conexión', 'error');
  } finally {
    hideLoader();
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const passwordConfirm = document.getElementById('regPasswordConfirm').value;

  if (password !== passwordConfirm) {
    showAlert('Las contraseñas no coinciden', 'error');
    return;
  }

  try {
    showLoader();
    const res = await fetch(buildApi('auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();

    if (data.success) {
      authToken = data.data.token;
      currentUser = data.data.user;
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('user', JSON.stringify(currentUser));
      showAlert('Cuenta creada exitosamente', 'success');
      await loadCustomerPanel();
    } else {
      showAlert(data.error || 'Error al registrarse', 'error');
    }
  } catch (err) {
    console.error(err);
    showAlert('Error de conexión', 'error');
  } finally {
    hideLoader();
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgotEmail').value;
  try {
    showLoader();
    const res = await fetch(buildApi('auth/forgot-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.success) {
      showAlert('Se envió un enlace a tu correo', 'success');
      setTimeout(() => showScreen('loginScreen'), 1200);
    } else showAlert(data.error || 'Error al enviar enlace', 'error');
  } catch (err) {
    console.error(err);
    showAlert('Error de conexión', 'error');
  } finally {
    hideLoader();
  }
}

async function verifyToken() {
  if (!authToken) throw new Error('No token');
  const res = await fetch(buildApi('auth/verify'), {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const data = await res.json();
  if (data.success) {
    currentUser = data.data.user;
    localStorage.setItem('user', JSON.stringify(currentUser));
    if (currentUser.role === 'admin') await loadAdminPanel(); else await loadCustomerPanel();
  } else {
    throw new Error('Token inválido');
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
// ADMIN PANEL
// ============================================

async function loadAdminPanel() {
  document.getElementById('appContainer').classList.add('active');
  document.getElementById('adminPanel').classList.remove('hidden');
  document.getElementById('customerPanel').classList.add('hidden');
  document.getElementById('cartBtn').classList.add('hidden');
  if (currentUser) document.getElementById('userName').textContent = currentUser.name;
  await loadDashboard();
}

async function loadDashboard() {
  try {
    const res = await fetch(buildApi('admin/dashboard'), {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      const stats = data.data;
      document.getElementById('totalProducts').textContent = stats.totalProducts;
      document.getElementById('totalSales').textContent = `S/ ${Number(stats.totalSales || 0).toFixed(2)}`;
      document.getElementById('totalOrders').textContent = stats.totalOrders;
      document.getElementById('lowStock').textContent = stats.lowStock;
      displayRecentSales(stats.recentSales);
    }
  } catch (err) {
    console.error('Error loadDashboard', err);
  }
}

function displayRecentSales(sales) {
  const container = document.getElementById('recentSalesTable');
  if (!sales || sales.length === 0) {
    container.innerHTML = '<p>No hay ventas recientes</p>';
    return;
  }
  let html = '<table><thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Método</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>';
  sales.forEach(sale => {
    html += `<tr>
      <td>${sale.id}</td>
      <td>${sale.user_name}</td>
      <td>S/ ${Number(sale.total || 0).toFixed(2)}</td>
      <td>${sale.payment_method}</td>
      <td><span class="badge badge-${sale.status}">${sale.status}</span></td>
      <td>${new Date(sale.created_at).toLocaleDateString()}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function showAdminSection(section) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
  const sec = document.getElementById(section + 'Section');
  if (sec) sec.classList.remove('hidden');
  document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
  try { event.target.classList.add('active'); } catch (e) {}
  switch (section) {
    case 'products': loadProductsAdmin(); break;
    case 'inventory': loadInventory(); break;
    case 'sales': loadSalesAdmin(); break;
    case 'users': loadUsers(); break;
  }
}

async function loadProductsAdmin() {
  try {
    const res = await fetch(buildApi('products'), { headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) displayProductsTable(data.data);
  } catch (err) { console.error(err); }
}

function displayProductsTable(products) {
  const tbody = document.getElementById('productsTableBody');
  if (!products || products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">No hay productos</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td>S/ ${Number(p.price || 0).toFixed(2)}</td>
      <td>${p.stock}</td>
      <td><span class="badge badge-${p.status}">${p.status}</span></td>
      <td>
        <button class="btn-action btn-edit" onclick="editProduct(${p.id})">Editar</button>
        <button class="btn-action btn-delete" onclick="deleteProduct(${p.id})">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// ============================================
// CUSTOMER PANEL (productos, carrito, etc.)
// ============================================

async function loadCustomerPanel() {
  document.getElementById('appContainer').classList.add('active');
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('customerPanel').classList.remove('hidden');
  document.getElementById('cartBtn').classList.remove('hidden');
  if (currentUser) document.getElementById('userName').textContent = currentUser.name;
  await loadProducts();
}

async function loadProducts() {
  try {
    showLoader();
    const res = await fetch(buildApi('products'), { headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) {
      allProducts = data.data;
      displayProducts(allProducts);
    }
  } catch (err) {
    console.error('Error loading products', err);
    showAlert('Error cargando productos', 'error');
  } finally {
    hideLoader();
  }
}

function displayProducts(products) {
  displayCarousel(products.slice(0, 6));
  displayGrid(products);
}

function displayCarousel(products) {
  const carousel = document.getElementById('featuredCarousel');
  if (!carousel) return;
  carousel.innerHTML = products.map(createProductCard).join('');
}

function displayGrid(products) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  if (!products || products.length === 0) {
    grid.innerHTML = '<p class="text-center">No hay productos disponibles</p>';
    return;
  }
  grid.innerHTML = products.map(createProductCard).join('');
}

function createProductCard(product) {
  const inCart = cart.find(item => item.id === product.id);
  const disabled = product.stock === 0 ? 'disabled' : '';
  return `
    <div class="product-card">
      <div class="product-image">${getProductEmoji(product.category)}</div>
      <div class="product-info">
        <h3>${product.name}</h3>
        <div class="category">${product.category}</div>
        <div class="price">S/ ${Number(product.price || 0).toFixed(2)}</div>
        <div class="stock">${product.stock > 0 ? `Stock: ${product.stock}` : 'Agotado'}</div>
        <button class="btn-cart" ${disabled} onclick="addToCart(${product.id})">
          ${inCart ? '✓ En Carrito' : '🛒 Agregar'}
        </button>
      </div>
    </div>`;
}

function getProductEmoji(category) {
  const emojis = { 'Frutas':'🍎','Verduras':'🥬','Granos':'🌾','Tubérculos':'🥔','Otros':'🌿' };
  return emojis[category] || '🌿';
}

// ============================================
// CARRITO
// ============================================

function addToCart(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  const existingItem = cart.find(i => i.id === productId);
  if (existingItem) {
    if (existingItem.quantity < product.stock) existingItem.quantity++;
    else { showAlert('No hay más stock disponible', 'warning'); return; }
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, quantity:1, stock: product.stock, category: product.category });
  }
  saveCart();
  updateCartBadge();
  showAlert('Producto agregado al carrito', 'success');
  loadProducts();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  saveCart();
  updateCartBadge();
  displayCart();
}

function updateQuantity(productId, change) {
  const item = cart.find(i => i.id === productId); if (!item) return;
  item.quantity += change;
  if (item.quantity <= 0) removeFromCart(productId);
  else if (item.quantity > item.stock) { item.quantity = item.stock; showAlert('Stock máximo alcanzado', 'warning'); }
  saveCart(); updateCartBadge(); displayCart();
}

function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); }
function updateCartBadge() {
  const total = cart.reduce((s,i)=>s+i.quantity,0); document.getElementById('cartBadge').textContent = total;
}
function openCart(){ displayCart(); document.getElementById('cartModal').classList.add('active'); }
function closeCart(){ document.getElementById('cartModal').classList.remove('active'); }

function displayCart() {
  const container = document.getElementById('cartItems');
  if (!container) return;
  if (cart.length === 0) {
    container.innerHTML = '<p class="text-center">Tu carrito está vacío</p>';
    document.getElementById('cartTotal').textContent = 'S/ 0.00';
    return;
  }
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-image">${getProductEmoji(item.category)}</div>
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <div class="price">S/ ${Number(item.price || 0).toFixed(2)}</div>
        <div class="quantity-controls">
          <button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
          <span class="quantity-display">${item.quantity}</span>
          <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
          <button class="btn-action btn-delete" onclick="removeFromCart(${item.id})" style="margin-left: 10px;">🗑️</button>
        </div>
      </div>
      <div style="font-weight:700; font-size:18px;">S/ ${(item.price*item.quantity).toFixed(2)}</div>
    </div>`).join('');
  const total = cart.reduce((s,i)=>s+(i.price*i.quantity),0);
  document.getElementById('cartTotal').textContent = `S/ ${total.toFixed(2)}`;
}

// ============================================
// CHECKOUT / PAYMENT (resumen rápido)
// ============================================

function openCheckout() {
  if (cart.length === 0) { showAlert('Tu carrito está vacío', 'warning'); return; }
  const total = cart.reduce((s,i)=>s+(i.price*i.quantity),0);
  document.getElementById('checkoutTotal').textContent = `S/ ${total.toFixed(2)}`;
  closeCart();
  document.getElementById('checkoutModal').classList.add('active');
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('active');
  selectedPaymentMethod = null;
  document.querySelectorAll('.payment-method').forEach(el=>el.classList.remove('selected'));
}

function selectPaymentMethod(method) {
  selectedPaymentMethod = method;
  document.querySelectorAll('.payment-method').forEach(el=>el.classList.remove('selected'));
  try { event.target.closest('.payment-method').classList.add('selected'); } catch(e){}
}

async function processPayment() {
  if (!selectedPaymentMethod) { showAlert('Por favor selecciona un método de pago', 'warning'); return; }
  try {
    showLoader();
    // 1) crear venta
    const saleRes = await fetch(buildApi('sales'), {
      method: 'POST',
      headers: { 'Content-Type':'application/json','Authorization':`Bearer ${authToken}` },
      body: JSON.stringify({ items: cart.map(i=>({product_id:i.id, quantity:i.quantity})), payment_method:selectedPaymentMethod })
    });
    const saleData = await saleRes.json();
    if (!saleData.success) throw new Error(saleData.error || 'Error creando la venta');

    // 2) procesar pago (endpoint mock)
    const payRes = await fetch(buildApi('payments/process'), {
      method: 'POST',
      headers: { 'Content-Type':'application/json','Authorization':`Bearer ${authToken}` },
      body: JSON.stringify({ sale_id: saleData.data.id, payment_method: selectedPaymentMethod })
    });
    const payData = await payRes.json();

    if (payData.success) {
      cart = []; saveCart(); updateCartBadge(); closeCheckout();
      showAlert('¡Compra realizada exitosamente! 🎉', 'success');
      alert(`✅ ¡PAGO EXITOSO!\n\nID de Venta: ${saleData.data.id}\nID de Transacción: ${payData.data.transactionId}\nMonto: S/ ${payData.data.amount.toFixed(2)}\nMétodo: ${payData.data.method.toUpperCase()}\n\nGracias por tu compra en AgroMarket`);
      await loadProducts();
    } else throw new Error(payData.error || 'Error procesando el pago');
  } catch (err) {
    console.error(err);
    showAlert(err.message || 'Error procesando pago', 'error');
  } finally {
    hideLoader();
  }
}

// ============================================
// BÚSQUEDA, PRODUCTOS ADMIN, INVENTARIO, USUARIOS, VENTAS
// (estas funciones usan buildApi y fetch interceptado)
// ============================================

function handleSearch(e) {
  const q = e.target.value.toLowerCase();
  if (!q) { displayProducts(allProducts); return; }
  const filtered = allProducts.filter(p => (p.name||'').toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q));
  displayGrid(filtered);
}

function openProductModal() {
  document.getElementById('productModalTitle').textContent = 'Agregar Producto';
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = '';
  document.getElementById('productModal').classList.add('active');
}
function closeProductModal(){ document.getElementById('productModal').classList.remove('active'); }

async function handleProductSubmit(e) {
  e.preventDefault();
  const productId = document.getElementById('productId').value;
  const isEdit = productId !== '';
  const productData = {
    name: document.getElementById('productName').value,
    category: document.getElementById('productCategory').value,
    price: Number(document.getElementById('productPrice').value),
    stock: Number(document.getElementById('productStock').value),
    min_stock: Number(document.getElementById('productMinStock').value),
    description: document.getElementById('productDescription').value
  };
  try {
    showLoader();
    const url = isEdit ? buildApi(`products/${productId}`) : buildApi('products');
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type':'application/json','Authorization':`Bearer ${authToken}` }, body: JSON.stringify(productData) });
    const data = await res.json();
    if (data.success) { showAlert(isEdit ? 'Producto actualizado' : 'Producto creado','success'); closeProductModal(); await loadProductsAdmin(); }
    else showAlert(data.error || 'Error guardando producto','error');
  } catch (err) { console.error(err); showAlert('Error de conexión','error'); }
  finally { hideLoader(); }
}

async function editProduct(id) {
  try {
    const res = await fetch(buildApi(`products/${id}`), { headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) {
      const p = data.data;
      document.getElementById('productModalTitle').textContent = 'Editar Producto';
      document.getElementById('productId').value = p.id;
      document.getElementById('productName').value = p.name;
      document.getElementById('productCategory').value = p.category;
      document.getElementById('productPrice').value = p.price;
      document.getElementById('productStock').value = p.stock;
      document.getElementById('productMinStock').value = p.min_stock;
      document.getElementById('productDescription').value = p.description || '';
      document.getElementById('productModal').classList.add('active');
    }
  } catch (err) { console.error(err); showAlert('Error cargando producto','error'); }
}

async function deleteProduct(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  try {
    const res = await fetch(buildApi(`products/${id}`), { method:'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) { showAlert('Producto eliminado','success'); await loadProductsAdmin(); }
    else showAlert(data.error || 'Error eliminando producto','error');
  } catch (err) { console.error(err); showAlert('Error de conexión','error'); }
}

// INVENTARIO, USERS, SALES
async function loadInventory() {
  try {
    const res = await fetch(buildApi('inventory'), { headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById('inventoryTableBody');
      if (!data.data || data.data.length === 0) { tbody.innerHTML = '<tr><td colspan="5">No hay datos de inventario</td></tr>'; return; }
      tbody.innerHTML = data.data.map(i => `<tr><td>${i.id}</td><td>${i.name}</td><td>${i.stock}</td><td>${i.min_stock}</td><td>${i.stock<=i.min_stock?'<span class="badge badge-warning">Bajo</span>':'<span class="badge badge-success">OK</span>'}</td></tr>`).join('');
    }
  } catch (err) { console.error(err); showAlert('Error cargando inventario','error'); }
}

async function loadUsers() {
  try {
    const res = await fetch(buildApi('admin/users'), { headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById('usersTableBody');
      if (!data.data || data.data.length === 0) { tbody.innerHTML = '<tr><td colspan="5">No hay usuarios registrados</td></tr>'; return; }
      tbody.innerHTML = data.data.map(u => `<tr><td>${u.id}</td><td>${u.name}</td><td>${u.email}</td><td><span class="badge badge-${u.role}">${u.role}</span></td><td>${new Date(u.created_at).toLocaleDateString()}</td></tr>`).join('');
    }
  } catch (err) { console.error(err); showAlert('Error cargando usuarios','error'); }
}

async function loadSalesAdmin() {
  try {
    const res = await fetch(buildApi('admin/sales'), { headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById('salesTableBody');
      if (!data.data || data.data.length === 0) { tbody.innerHTML = '<tr><td colspan="6">No hay ventas registradas</td></tr>'; return; }
      tbody.innerHTML = data.data.map(s => `<tr><td>${s.id}</td><td>${s.user_name}</td><td>S/ ${Number(s.total).toFixed(2)}</td><td>${s.payment_method}</td><td><span class="badge badge-${s.status}">${s.status}</span></td><td>${new Date(s.created_at).toLocaleDateString()}</td></tr>`).join('');
    }
  } catch (err) { console.error(err); showAlert('Error cargando ventas','error'); }
}

// ============================================
// ALERTS & UI UTILITIES
// ============================================

function showScreen(screenId) {
  document.querySelectorAll('.auth-container').forEach(s => s.classList.remove('active'));
  document.getElementById('appContainer').classList.remove('active');
  const el = document.getElementById(screenId);
  if (el) el.classList.add('active');
}

function showAlert(message, type = 'success') {
  const alert = document.getElementById('alert');
  const icon = document.getElementById('alertIcon');
  const msg = document.getElementById('alertMessage');
  const icons = { success:'✓', error:'✕', warning:'⚠' };
  if (icon) icon.textContent = icons[type] || '✓';
  if (msg) msg.textContent = message;
  if (alert) {
    alert.className = `alert ${type} active`;
    setTimeout(()=>{ alert.classList.remove('active'); }, 3500);
  } else {
    // fallback
    console[type === 'error' ? 'error' : 'log'](message);
  }
}

function toggleUserMenu() {
  document.getElementById('userDropdown')?.classList.toggle('active');
}

console.log("AgroMarket Frontend Loaded ✔");

// ============================================
// INVENTARIO EXTRA - ejemplo para /api/inventario (puede usarse si existe endpoint)
// ============================================
const INVENTORY_API = () => buildApi('inventario'); // ejemplo

async function crearProducto() {
  const nombre = document.getElementById("nombre")?.value;
  const cantidad = Number(document.getElementById("cantidad")?.value || 0);
  const categoria = document.getElementById("categoria")?.value || 'Otros';
  try {
    showLoader();
    const res = await fetch(INVENTORY_API(), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ nombre, cantidad, categoria }) });
    const data = await res.json();
    alert(data.message || 'OK');
    await cargarInventario();
  } catch (err) {
    console.error(err);
    alert('Error creando producto');
  } finally {
    hideLoader();
  }
}

async function cargarInventario() {
  try {
    const res = await fetch(INVENTORY_API());
    const productos = await res.json();
    const lista = document.getElementById("lowStockList");
    if (!lista) return;
    lista.innerHTML = "";
    (productos || []).forEach(p => {
      const li = document.createElement("li");
      li.textContent = `${p.nombre} — ${p.cantidad} unidades`;
      lista.appendChild(li);
    });
  } catch (err) {
    console.error('cargarInventario error', err);
  }
}
