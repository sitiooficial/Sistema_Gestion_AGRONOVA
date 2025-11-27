/**
 * ============================================
 * FRONTEND APP - app.js
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

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

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

    // Event listeners
    setupEventListeners();

    hideLoader();
}

function setupEventListeners() {
    // Auth forms
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
    document.getElementById('forgotPasswordForm')?.addEventListener('submit', handleForgotPassword);
    
    // Product form
    document.getElementById('productForm')?.addEventListener('submit', handleProductSubmit);

    // Search
    document.getElementById('searchInput')?.addEventListener('input', handleSearch);

    // Click outside to close dropdowns
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

        const data = await response.json();

        if (data.success) {
            authToken = data.data.token;
            currentUser = data.data.user;
            
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));

            showAlert('Bienvenido ' + currentUser.name, 'success');
            
            // Mostrar pantalla según rol
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

        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

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
    } catch (error) {
        console.error('Error:', error);
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

        const response = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Se envió un enlace a tu correo', 'success');
            setTimeout(() => showScreen('loginScreen'), 2000);
        } else {
            showAlert(data.error || 'Error al enviar enlace', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error de conexión', 'error');
    } finally {
        hideLoader();
    }
}

async function verifyToken() {
    const response = await fetch(`${API_URL}/auth/verify`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });

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

    document.getElementById('userName').textContent = currentUser.name;

    await loadDashboard();
}

async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/admin/dashboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (data.success) {
            const stats = data.data;
            
            document.getElementById('totalProducts').textContent = stats.totalProducts;
            document.getElementById('totalSales').textContent = `S/ ${stats.totalSales.toFixed(2)}`;
            document.getElementById('totalOrders').textContent = stats.totalOrders;
            document.getElementById('lowStock').textContent = stats.lowStock;

            // Mostrar ventas recientes
            displayRecentSales(stats.recentSales);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
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
        html += `
            <tr>
                <td>${sale.id}</td>
                <td>${sale.user_name}</td>
                <td>S/ ${sale.total.toFixed(2)}</td>
                <td>${sale.payment_method}</td>
                <td><span class="badge badge-${sale.status}">${sale.status}</span></td>
                <td>${new Date(sale.created_at).toLocaleDateString()}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function showAdminSection(section) {
    // Ocultar todas las secciones
    document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
    
    // Mostrar la sección seleccionada
    document.getElementById(section + 'Section').classList.remove('hidden');

    // Actualizar nav activo
    document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
    event.target.classList.add('active');

    // Cargar datos según la sección
    switch(section) {
        case 'products':
            loadProductsAdmin();
            break;
        case 'inventory':
            loadInventory();
            break;
        case 'sales':
            loadSalesAdmin();
            break;
        case 'users':
            loadUsers();
            break;
    }
}

async function loadProductsAdmin() {
    try {
        const response = await fetch(`${API_URL}/products`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (data.success) {
            displayProductsTable(data.data);
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
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
            <td>S/ ${p.price.toFixed(2)}</td>
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
// CUSTOMER PANEL
// ============================================

async function loadCustomerPanel() {
    document.getElementById('appContainer').classList.add('active');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('customerPanel').classList.remove('hidden');
    document.getElementById('cartBtn').classList.remove('hidden');

    document.getElementById('userName').textContent = currentUser.name;

    await loadProducts();
}

async function loadProducts() {
    try {
        showLoader();

        const response = await fetch(`${API_URL}/products`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (data.success) {
            allProducts = data.data;
            displayProducts(allProducts);
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showAlert('Error cargando productos', 'error');
    } finally {
        hideLoader();
    }
}

function displayProducts(products) {
    // Carousel de destacados
    const featured = products.slice(0, 6);
    displayCarousel(featured);

    // Grid de todos los productos
    displayGrid(products);
}

function displayCarousel(products) {
    const carousel = document.getElementById('featuredCarousel');
    
    carousel.innerHTML = products.map(p => createProductCard(p)).join('');
}

function displayGrid(products) {
    const grid = document.getElementById('productsGrid');
    
    if (products.length === 0) {
        grid.innerHTML = '<p class="text-center">No hay productos disponibles</p>';
        return;
    }

    grid.innerHTML = products.map(p => createProductCard(p)).join('');
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
                <div class="price">S/ ${product.price.toFixed(2)}</div>
                <div class="stock">${product.stock > 0 ? `Stock: ${product.stock}` : 'Agotado'}</div>
                <button class="btn-cart" ${disabled} onclick="addToCart(${product.id})">
                    ${inCart ? '✓ En Carrito' : '🛒 Agregar'}
                </button>
            </div>
        </div>
    `;
}

function getProductEmoji(category) {
    const emojis = {
        'Frutas': '🍎',
        'Verduras': '🥬',
        'Granos': '🌾',
        'Tubérculos': '🥔',
        'Otros': '🌿'
    };
    return emojis[category] || '🌿';
}

// ============================================
// CARRITO DE COMPRAS
// ============================================

function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        if (existingItem.quantity < product.stock) {
            existingItem.quantity++;
        } else {
            showAlert('No hay más stock disponible', 'warning');
            return;
        }
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            stock: product.stock,
            category: product.category
        });
    }

    saveCart();
    updateCartBadge();
    showAlert('Producto agregado al carrito', 'success');
    
    // Actualizar UI
    loadProducts();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartBadge();
    displayCart();
}

function updateQuantity(productId, change) {
    const item = cart.find(i => i.id === productId);
    
    if (!item) return;

    item.quantity += change;

    if (item.quantity <= 0) {
        removeFromCart(productId);
    } else if (item.quantity > item.stock) {
        item.quantity = item.stock;
        showAlert('Stock máximo alcanzado', 'warning');
    }

    saveCart();
    updateCartBadge();
    displayCart();
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartBadge() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartBadge').textContent = totalItems;
}

function openCart() {
    displayCart();
    document.getElementById('cartModal').classList.add('active');
}

function closeCart() {
    document.getElementById('cartModal').classList.remove('active');
}

function displayCart() {
    const container = document.getElementById('cartItems');
    
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
                <div class="price">S/ ${item.price.toFixed(2)}</div>
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
                    <span class="quantity-display">${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
                    <button class="btn-action btn-delete" onclick="removeFromCart(${item.id})" style="margin-left: 10px;">🗑️</button>
                </div>
            </div>
            <div style="font-weight: 700; font-size: 18px;">
                S/ ${(item.price * item.quantity).toFixed(2)}
            </div>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('cartTotal').textContent = `S/ ${total.toFixed(2)}`;
}

// ============================================
// CHECKOUT Y PAGOS
// ============================================

function openCheckout() {
    if (cart.length === 0) {
        showAlert('Tu carrito está vacío', 'warning');
        return;
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('checkoutTotal').textContent = `S/ ${total.toFixed(2)}`;

    closeCart();
    document.getElementById('checkoutModal').classList.add('active');
}

function closeCheckout() {
    document.getElementById('checkoutModal').classList.remove('active');
    selectedPaymentMethod = null;
    document.querySelectorAll('.payment-method').forEach(el => el.classList.remove('selected'));
}

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    
    document.querySelectorAll('.payment-method').forEach(el => {
        el.classList.remove('selected');
    });
    
    event.target.closest('.payment-method').classList.add('selected');
}

async function processPayment() {
    if (!selectedPaymentMethod) {
        showAlert('Por favor selecciona un método de pago', 'warning');
        return;
    }

    try {
        showLoader();

        // 1. Crear la venta
        const saleResponse = await fetch(`${API_URL}/sales`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                items: cart.map(item => ({
                    product_id: item.id,
                    quantity: item.quantity
                })),
                payment_method: selectedPaymentMethod
            })
        });

        const saleData = await saleResponse.json();

        if (!saleData.success) {
            throw new Error(saleData.error || 'Error creando la venta');
        }

        // 2. Procesar pago
        const paymentResponse = await fetch(`${API_URL}/payments/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                sale_id: saleData.data.id,
                payment_method: selectedPaymentMethod
            })
        });

        const paymentData = await paymentResponse.json();

        if (paymentData.success) {
            // Limpiar carrito
            cart = [];
            saveCart();
            updateCartBadge();

            closeCheckout();

            showAlert('¡Compra realizada exitosamente! 🎉', 'success');
            
            // Mostrar detalles
            alert(`
                ✅ ¡PAGO EXITOSO!
                
                ID de Venta: ${saleData.data.id}
                ID de Transacción: ${paymentData.data.transactionId}
                Monto: S/ ${paymentData.data.amount.toFixed(2)}
                Método: ${paymentData.data.method.toUpperCase()}
                
                Gracias por tu compra en AgroMarket
            `);

            // Recargar productos
            await loadProducts();

        } else {
            throw new Error(paymentData.error || 'Error procesando el pago');
        }

    } catch (error) {
        console.error('Error:', error);
        showAlert(error.message, 'error');
    } finally {
        hideLoader();
    }
}

// ============================================
// BÚSQUEDA
// ============================================

function handleSearch(e) {
    const query = e.target.value.toLowerCase();

    if (query === '') {
        displayProducts(allProducts);
        return;
    }

    const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );

    displayGrid(filtered);
}

// ============================================
// PRODUCTOS (ADMIN)
// ============================================

function openProductModal() {
    document.getElementById('productModalTitle').textContent = 'Agregar Producto';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productModal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

async function handleProductSubmit(e) {
    e.preventDefault();

    const productId = document.getElementById('productId').value;
    const isEdit = productId !== '';

    const productData = {
        name: document.getElementById('productName').value,
        category: document.getElementById('productCategory').value,
        price: document.getElementById('productPrice').value,
        stock: document.getElementById('productStock').value,
        min_stock: document.getElementById('productMinStock').value,
        description: document.getElementById('productDescription').value
    };

    try {
        showLoader();

        const url = isEdit ? `${API_URL}/products/${productId}` : `${API_URL}/products`;
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(productData)
        });

        const data = await response.json();

        if (data.success) {
            showAlert(isEdit ? 'Producto actualizado' : 'Producto creado', 'success');
            closeProductModal();
            await loadProductsAdmin();
        } else {
            showAlert(data.error || 'Error guardando producto', 'error');
        }

    } catch (error) {
        console.error('Error:', error);
        showAlert('Error de conexión', 'error');
    } finally {
        hideLoader();
    }
}

async function editProduct(id) {
    try {
        const response = await fetch(`${API_URL}/products/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (data.success) {
            const product = data.data;
            
            document.getElementById('productModalTitle').textContent = 'Editar Producto';
            document.getElementById('productId').value = product.id;
            document.getElementById('productName').value = product.name;
            document.getElementById('productCategory').value = product.category;
            document.getElementById('productPrice').value = product.price;
            document.getElementById('productStock').value = product.stock;
            document.getElementById('productMinStock').value = product.min_stock;
            document.getElementById('productDescription').value = product.description || '';
            
            document.getElementById('productModal').classList.add('active');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error cargando producto', 'error');
    }
}

async function deleteProduct(id) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/products/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Producto eliminado', 'success');
            await loadProductsAdmin();
        } else {
            showAlert(data.error || 'Error eliminando producto', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error de conexión', 'error');
    }
}

// ============================================
// UI UTILITIES
// ============================================

function showScreen(screenId) {
    document.querySelectorAll('.auth-container').forEach(screen => {
        screen.classList.remove('active');
    });

    document.getElementById('appContainer').classList.remove('active');
    document.getElementById(screenId).classList.add('active');
}

function showLoader() {
    document.getElementById('loader').classList.remove('hidden');
}

function hideLoader() {
    document.getElementById('loader').classList.add('hidden');
}

function showAlert(message, type = 'success') {
    const alert = document.getElementById('alert');
    const icon = document.getElementById('alertIcon');
    const msg = document.getElementById('alertMessage');

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠'
    };

    icon.textContent = icons[type] || '✓';
    msg.textContent = message;

    alert.className = `alert ${type} active`;

    setTimeout(() => {
        alert.classList.remove('active');
    }, 4000);
}

function toggleUserMenu() {
    document.getElementById('userDropdown').classList.toggle('active');
}

// Funciones stub para completar
async function loadInventory() {
    console.log('Loading inventory...');
}

async function loadSalesAdmin() {
    console.log('Loading sales...');
}

async function loadUsers() {
    console.log('Loading users...');
}