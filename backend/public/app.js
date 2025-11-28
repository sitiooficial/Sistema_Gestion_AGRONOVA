function handleSearch(e) {
  const q = e.target.value.toLowerCase();
  if (!q) {
    displayProducts(allProducts);
    return;
  }

  const filtered = allProducts.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.category || '').toLowerCase().includes(q)
  );

  displayProducts(filtered);
}

/* ============================================================
   PRODUCTOS (ADMIN)
   ============================================================ */

async function handleProductSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('productId').value;
  const name = document.getElementById('productName').value;
  const category = document.getElementById('productCategory').value;
  const price = Number(document.getElementById('productPrice').value);
  const stock = Number(document.getElementById('productStock').value);

  try {
    showLoader();

    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `products/${id}` : 'products';

    const res = await fetch(buildApi(endpoint), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ name, category, price, stock })
    });

    const data = await res.json();

    if (data.success) {
      showAlert(id ? 'Producto actualizado' : 'Producto creado', 'success');
      await loadProductsAdmin();
      document.getElementById('productForm').reset();
    } else {
      showAlert(data.error || 'Error guardando producto', 'error');
    }
  } catch (err) {
    console.error(err);
    showAlert('Error de conexión', 'error');
  } finally {
    hideLoader();
  }
}

async function deleteProduct(id) {
  if (!confirm('¿Eliminar este producto?')) return;

  try {
    showLoader();
    const res = await fetch(buildApi(`products/${id}`), {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await res.json();
    if (data.success) {
      showAlert('Producto eliminado', 'success');
      loadProductsAdmin();
    } else {
      showAlert(data.error || 'Error al eliminar', 'error');
    }
  } catch (err) {
    console.error(err);
    showAlert('Error de conexión', 'error');
  } finally {
    hideLoader();
  }
}

/* ============================================================
   INVENTARIO (ADMIN)
   ============================================================ */

async function loadInventory() {
  try {
    const res = await fetch(buildApi('inventory'), {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();

    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    if (!data.success || data.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No hay datos</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.map(inv => `
      <tr>
        <td>${inv.product_id}</td>
        <td>${inv.name}</td>
        <td>${inv.category}</td>
        <td>${inv.stock}</td>
        <td>${new Date(inv.updated_at).toLocaleDateString()}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error(err);
  }
}

/* ============================================================
   USUARIOS (ADMIN)
   ============================================================ */

async function loadUsers() {
  try {
    const res = await fetch(buildApi('users'), {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();

    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (!data.success) {
      tbody.innerHTML = '<tr><td colspan="5">Error cargando usuarios</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error(err);
  }
}

/* ============================================================
   VENTAS (ADMIN)
   ============================================================ */

async function loadSalesAdmin() {
  try {
    const res = await fetch(buildApi('sales'), {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();

    const tbody = document.getElementById('salesTableBody');
    if (!tbody) return;

    if (!data.success || data.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">No hay ventas</td></tr>';
      return;
    }

    tbody.innerHTML = data.data.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.user_name}</td>
        <td>S/ ${Number(s.total).toFixed(2)}</td>
        <td>${s.payment_method}</td>
        <td><span class="badge badge-${s.status}">${s.status}</span></td>
        <td>${new Date(s.created_at).toLocaleDateString()}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error(err);
  }
}
