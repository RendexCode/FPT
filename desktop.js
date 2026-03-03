// Configuración de Supabase
const SUPABASE_URL = 'https://gqrlqrtoqujvpfanilzr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxcmxxcnRvcXVqdnBmYW5pbHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MTg2MzcsImV4cCI6MjA4NzI5NDYzN30.4wqhRMDBuBpTC5WzzMdNXxUWrLSxMnf_lDtjUnsz4O4';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado de la aplicación
let products = [];
let bcvRate = 0;
let filteredProducts = [];
let displayedCount = 0;
const LOAD_STEP = 12;
let cart = [];

let selectedCurrency = 'usd';
let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

// Detectar si estamos en versión escritorio
const isDesktop = true;

// Elementos del DOM
const productsGrid = document.getElementById('products-grid');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const bcvRateDisplay = document.getElementById('bcv-rate');
const loader = document.getElementById('loader');
const liveClock = document.getElementById('live-clock');
const currencyFilter = document.getElementById('currency-filter');
const cartBadge = document.getElementById('cart-badge');
const cartModal = document.getElementById('cart-modal');
const cartTrigger = document.getElementById('cart-trigger');
const closeCart = document.getElementById('close-cart');

const cartItemsContainer = document.getElementById('cart-items');


// Inicialización
async function init() {
    isLoggedIn = true;
    console.log('FPT Desktop System Initialized');

    updateClock();
    setInterval(() => {
        updateClock();
    }, 1000);

    await fetchBcvRate();
    await fetchProducts();

    if (searchInput) searchInput.addEventListener('input', handleSearch);
    if (categoryFilter) categoryFilter.addEventListener('change', handleFilter);

    setupCurrencyToggle();

    // Restaurar eventos de inicialización de paneles/simulador
    setupAddProduct();
    setupProductForm();
    setupImagePreview();
    setupCart();

    // Sincronizar UI con el estado de sesión cargado de localStorage
    updateModalViewFromGlobal();
}




function updateModalViewFromGlobal() {
    const addBtn = document.getElementById('add-product-trigger');
    const searchInput = document.getElementById('search-input');
    const loginTrigger = document.getElementById('login-trigger');

    if (isLoggedIn) {
        if (addBtn) addBtn.style.display = 'flex';
        if (searchInput) searchInput.style.paddingRight = '7.5rem';
        if (loginTrigger && loginTrigger.querySelector('span')) {
            loginTrigger.querySelector('span').textContent = 'Admin Activo';
            loginTrigger.style.background = 'var(--primary)';
        }
    } else {
        if (addBtn) addBtn.style.display = 'none';
        if (searchInput) searchInput.style.paddingRight = '4.5rem';
        if (loginTrigger && loginTrigger.querySelector('span')) {
            loginTrigger.querySelector('span').textContent = 'Panel Admin';
            loginTrigger.style.background = '';
        }
    }
}



// Mobile functions removed in desktop version

function setupCurrencyToggle() {
    if (!currencyFilter) return; // Guard for desktop where filter is removed
    const buttons = document.querySelectorAll('.toggle-btn');
    const updateContainerColor = (val) => {
        currencyFilter.classList.remove('usd-active', 'ves-active');
        if (val === 'usd') currencyFilter.classList.add('usd-active');
        if (val === 'ves') currencyFilter.classList.add('ves-active');
    };

    updateContainerColor(selectedCurrency);


    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCurrency = btn.dataset.value;
            updateContainerColor(selectedCurrency);
            renderProducts();
        });
    });
}

function updateClock() {
    if (!liveClock) return;
    const now = new Date();
    liveClock.textContent = now.toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}




async function fetchBcvRate() {
    try {
        const { data, error } = await supabaseClient.from('global_settings').select('*').eq('key', 'currency_config');
        if (error) throw error;
        if (data && data.length > 0) {
            const config = typeof data[0].value === 'string' ? JSON.parse(data[0].value) : data[0].value;
            bcvRate = config.bcv_rate || 1.0;
            if (bcvRateDisplay) bcvRateDisplay.textContent = bcvRate.toFixed(2);
            renderProducts();
        }
    } catch (err) {
        console.error('Error al cargar tasa:', err);
        if (bcvRateDisplay) bcvRateDisplay.textContent = 'Error';
    }
}


async function fetchProducts() {
    if (loader) loader.style.display = 'flex';
    try {
        const { data, error } = await supabaseClient.from('products').select('*').eq('active', true).order('name', { ascending: true });
        if (error) throw error;
        products = data;
        filteredProducts = [...products];
        populateCategories();
        renderProducts();
    } catch (err) {
        console.error('Error al cargar productos:', err);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}


function populateCategories() {
    if (!categoryFilter) return; // Guard for desktop
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    categoryFilter.innerHTML = '<option value="all">Categorías</option>';
    categories.sort().forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
}
// Escanner code removed for desktop
function setupInfiniteScroll() { }

function setupAddProduct() {
    const addBtn = document.getElementById('add-product-trigger');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openDetailPanel('');
        });
    }
}


function setupProductForm() {
    const productModal = document.getElementById('product-modal');
    const cancelBtn = document.getElementById('cancel-product-btn');
    const form = document.getElementById('product-form');

    const closeModal = () => {
        const formContainer = document.getElementById('panel-form-container');
        const placeholder = document.getElementById('panel-placeholder');
        if (formContainer) formContainer.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        document.querySelectorAll('.product-list-item').forEach(el => el.classList.remove('selected'));
        form.reset();

        const preview = document.getElementById('image-preview');
        const imgPlaceholder = document.getElementById('upload-placeholder');
        if (preview && imgPlaceholder) {
            preview.src = '';
            preview.style.display = 'none';
            imgPlaceholder.style.display = 'flex';
        }
    };

    const closePanelBtn = document.getElementById('close-panel');
    if (closePanelBtn) closePanelBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);



    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('p-id').value;
        const name = document.getElementById('p-name').value;
        const barcode = document.getElementById('p-barcode').value || null;
        const category = document.getElementById('p-category').value;
        const cost_price = parseFloat(document.getElementById('p-cost').value) || 0;

        let sale_price = parseFloat(document.getElementById('p-sale-price').value);
        if (isNaN(sale_price)) {
            sale_price = cost_price; // Usa precio base si el campo de divisa está vacío
        }
        const stock = parseInt(document.getElementById('p-stock').value) || 0;
        const min_stock = parseInt(document.getElementById('p-min-stock').value) || 0;

        const imageFile = document.getElementById('p-image').files[0];
        let image_url = null;

        // Mantener la imagen actual si no se selecciona una nueva al editar
        if (id) {
            const currentProduct = products.find(p => p.id == id);
            if (currentProduct) image_url = currentProduct.image_url;
        }

        const productData = {
            name, barcode, category, cost_price, sale_price, stock, min_stock, active: true
        };

        const saveBtn = document.getElementById('save-product-btn');
        saveBtn.textContent = 'Guardando...';
        saveBtn.disabled = true;

        try {
            if (imageFile) {
                // Eliminar imagen anterior si existe
                if (image_url) {
                    try {
                        const oldPath = image_url.split('/storage/v1/object/public/products/')[1];
                        if (oldPath) await supabaseClient.storage.from('products').remove([oldPath]);
                    } catch (e) { console.error("Error eliminando:", e); }
                }

                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `product-images/${fileName}`;

                const { error: uploadError } = await supabaseClient.storage.from('products').upload(filePath, imageFile);
                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabaseClient.storage.from('products').getPublicUrl(filePath);
                productData.image_url = publicUrlData.publicUrl;
            } else if (id) {
                productData.image_url = image_url;
            }

            if (id) {
                // Update
                const { error } = await supabaseClient.from('products').update(productData).eq('id', id);
                if (error) throw error;
                // Actualizar array local
                const index = products.findIndex(p => p.id == id);
                if (index !== -1) {
                    products[index] = { ...products[index], ...productData };
                }
            } else {
                // Insert
                const { data, error } = await supabaseClient.from('products').insert([productData]).select();
                if (error) throw error;
                if (data && data.length > 0) {
                    products.push(data[0]);
                }
            }

            applyFilters();
            closeModal();

        } catch (err) {
            alert('Error al guardar producto: ' + err.message);
        } finally {
            saveBtn.textContent = id ? 'Actualizar' : 'Guardar';
            saveBtn.disabled = false;
        }
    });

    window.addEventListener('click', (e) => {
        if (e.target === productModal) closeModal();
    });
}

function renderProducts(append = false) {
    if (!productsGrid) {
        console.error('CRITICAL: Element #products-grid not found!');
        return;
    }

    if (!append) {
        productsGrid.innerHTML = '';
        displayedCount = 0;
    }
    const start = append ? displayedCount : 0;
    const toShow = filteredProducts.slice(start, start + LOAD_STEP);

    console.log(`Rendering ${toShow.length} products (isDesktop: ${isDesktop})`);

    if (toShow.length === 0 && !append) {
        productsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: #94a3b8; font-weight: 600;">No hay productos</div>';
        return;
    }



    toShow.forEach(p => {
        const baseCost = p.cost_price || 0;
        const priceVes = baseCost * bcvRate;
        const priceUsd = (p.sale_price != null) ? p.sale_price : baseCost;
        const stock = p.stock || 0;
        const isLowStock = stock < (p.min_stock || 5);
        const stockLabel = stock === 0 ? 'Agotado' : (isLowStock ? 'Bajo' : 'OK');
        const stockClass = stock <= 0 ? 'badge-out' : (isLowStock ? 'badge-low' : 'badge-stock');

        toShow.forEach(p => {
            const baseCost = p.cost_price || 0;
            const priceVes = baseCost * bcvRate;
            const priceUsd = (p.sale_price != null) ? p.sale_price : baseCost;
            const stock = p.stock || 0;
            const isLowStock = stock < (p.min_stock || 5);

            // RENDER LIGERO PARA LISTA (ESCRITORIO) - MULTI PRECIO
            const row = document.createElement('div');
            row.className = 'product-list-item';
            row.dataset.id = p.id;
            row.onclick = () => openDetailPanel(p.id);

            const rowImg = p.image_url
                ? `<img src="${p.image_url}" class="list-img">`
                : `<div class="list-img-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
               </div>`;

            row.innerHTML = `
            ${rowImg}
            <div class="item-main-info">
                <h4>${p.name}</h4>
                <p>${p.category || 'VARIOS'} | <span style="opacity: 0.7">Cod: ${p.barcode || '-'}</span></p>
            </div>
            <div class="multi-price-display">
                <div class="price-box base">
                    <span class="pl">BASE</span>
                    <span class="pv">$ ${baseCost.toFixed(2)}</span>
                </div>
                <div class="price-box ves">
                    <span class="pl">BOLÍVARES</span>
                    <span class="pv">Bs. ${Math.round(priceVes).toLocaleString('es-VE')}</span>
                </div>
                <div class="price-separator">|</div>
                <div class="price-box usd">
                    <span class="pl">DIVISA</span>
                    <span class="pv">$ ${priceUsd.toFixed(2)}</span>
                </div>
            </div>

            <div class="row-actions">
                <div class="stock-tag ${stock <= 0 ? 'low' : (isLowStock ? 'low' : 'ok')}">
                    ${stock} disp.
                </div>
                <button class="add-to-cart-btn" onclick="addToCart(event, '${p.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
            </div>
        `;

            productsGrid.appendChild(row);
        });
    });


    displayedCount = append ? displayedCount + LOAD_STEP : LOAD_STEP;
    setupInfiniteScroll();
}

// Mobile functions removed in desktop version

window.openEditModal = (id) => {
    openDetailPanel(id);
};

window.switchPanel = (panel) => {
    const panels = {
        'placeholder': document.getElementById('panel-placeholder'),
        'product': document.getElementById('panel-form-container'),
        'cart': document.getElementById('panel-cart-container'),
        'history': document.getElementById('panel-history-container')
    };

    // Hide all panels
    Object.values(panels).forEach(p => { if (p) p.style.display = 'none'; });

    // Show target panel
    const target = panels[panel];
    if (target) target.style.display = (panel === 'placeholder') ? 'flex' : 'flex';

    // Update Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        const pMap = { 'product': 'panel-form-container', 'cart': 'panel-cart-container', 'history': 'panel-history-container' };
        if (pMap[panel] === btn.dataset.panel) btn.classList.add('active');
    });

    if (panel === 'cart') updateCartUI();
    if (panel === 'history') updateHistoryUI();
};

window.openDetailPanel = (id) => {
    switchPanel('product');
    const deleteBtn = document.getElementById('delete-current-btn');
    const title = document.getElementById('panel-title');

    const form = document.getElementById('product-form');
    if (form) form.reset();
    document.querySelectorAll('.product-list-item').forEach(el => el.classList.remove('selected'));



    if (id) {
        const item = document.querySelector(`.product-list-item[data-id="${id}"]`);
        if (item) item.classList.add('selected');

        const product = products.find(p => p.id == id);
        if (product) {
            title.textContent = 'Editar Producto';
            document.getElementById('p-id').value = id;
            document.getElementById('p-name').value = product.name;
            document.getElementById('p-barcode').value = product.barcode || '';
            document.getElementById('p-category').value = product.category || 'VARIOS';
            document.getElementById('p-cost').value = product.cost_price || 0;
            document.getElementById('p-sale-price').value = (product.sale_price != null) ? product.sale_price : product.cost_price;
            document.getElementById('p-stock').value = product.stock || 0;
            const minStockEl = document.getElementById('p-min-stock') || document.getElementById('p-min_stock');
            if (minStockEl) minStockEl.value = product.min_stock || 5;

            const preview = document.getElementById('image-preview');
            const uplPlaceholder = document.getElementById('upload-placeholder');
            if (product.image_url) {
                preview.src = product.image_url;
                preview.style.display = 'block';
                if (uplPlaceholder) uplPlaceholder.style.display = 'none';
            } else {
                preview.style.display = 'none';
                if (uplPlaceholder) uplPlaceholder.style.display = 'flex';
            }

            if (deleteBtn) {
                deleteBtn.style.display = 'block';
                deleteBtn.onclick = () => deleteProduct(id, product.name);
            }
            document.getElementById('save-product-btn').textContent = 'Guardar';
        }
    } else {
        title.textContent = 'Nuevo Producto';
        document.getElementById('p-id').value = '';
        if (deleteBtn) deleteBtn.style.display = 'none';
        const preview = document.getElementById('image-preview');
        const uplPlaceholder = document.getElementById('upload-placeholder');
        if (preview) preview.style.display = 'none';
        if (uplPlaceholder) uplPlaceholder.style.display = 'flex';
        document.getElementById('save-product-btn').textContent = 'Crear';
    }
};


window.deleteProduct = async (id, name) => {
    if (confirm(`¿Estás seguro de que deseas eliminar el producto: ${name}?`)) {
        try {
            const { error } = await supabaseClient.from('products').update({ active: false }).eq('id', id);
            if (error) throw error;
            const product = products.find(p => p.id == id);
            if (product && product.image_url) {
                try {
                    const path = product.image_url.split('/storage/v1/object/public/products/')[1];
                    if (path) await supabaseClient.storage.from('products').remove([path]);
                } catch (e) { console.error("Error eliminando foto:", e); }
            }
            products = products.filter(p => p.id != id);
            applyFilters();
        } catch (err) {
            alert('Error al eliminar: ' + err.message);
        }
    }
};

// Cerrar menús al hacer clic fuera
document.addEventListener('click', () => {
    document.querySelectorAll('.options-menu').forEach(m => m.classList.remove('active'));
});

function setupInfiniteScroll() {
    let observer;
    const scrollContainer = document.querySelector('.inventory-list-container');
    const items = document.querySelectorAll('.product-list-item');
    const last = items[items.length - 1];

    if (!last || displayedCount >= filteredProducts.length) return;

    observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) renderProducts(true);
    }, {
        root: scrollContainer,
        threshold: 0.1
    });
    observer.observe(last);
}


function handleSearch() { applyFilters(); }
function handleFilter() { applyFilters(); }

function applyFilters() {
    if (!searchInput) return;
    const term = searchInput.value.toLowerCase();
    const cat = categoryFilter ? categoryFilter.value : 'all';
    filteredProducts = products.filter(p => {
        const matchesS = p.name.toLowerCase().includes(term) || (p.barcode && p.barcode.includes(term)) || (p.brand && p.brand.toLowerCase().includes(term));
        const matchesC = cat === 'all' || p.category === cat;
        return matchesS && matchesC;
    });
    renderProducts();
}


function setupImagePreview() {
    const input = document.getElementById('p-image');
    const preview = document.getElementById('image-preview');
    const placeholder = document.getElementById('upload-placeholder');

    input.addEventListener('change', () => {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    // Reset preview on "Add Product"
    const addBtn = document.getElementById('add-product-trigger');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            preview.src = '';
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
            input.value = '';
        });
    }
}

// Lógica del Carrito / Simulador
function setupCart() {
    const clearBtn = document.getElementById('clear-cart-btn');
    const closePanel = document.getElementById('close-cart-panel');
    const cartPanel = document.getElementById('panel-cart-container');
    const formPanel = document.getElementById('panel-form-container');
    const placeholders = document.getElementById('panel-placeholder');
    const saveBtn = document.getElementById('save-sale-btn');
    const histBtn = document.getElementById('history-trigger-btn');
    const closeHist = document.getElementById('close-history-panel');
    const clearHist = document.getElementById('clear-history-btn');
    const histPanel = document.getElementById('panel-history-container');

    if (closePanel) {
        closePanel.onclick = () => {
            switchPanel('placeholder');
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            if (confirm('¿Vaciar todo el simulador?')) {
                cart = [];
                updateCartUI();
            }
        };
    }


    if (saveBtn) {
        saveBtn.onclick = () => {
            if (cart.length === 0) return alert('El simulador está vacío');
            saveSale();
        };
    }




    if (closeHist) {
        closeHist.onclick = () => {
            switchPanel('placeholder');
        };
    }


    if (clearHist) {
        clearHist.onclick = () => {
            if (confirm('¿Borrar todo el historial de ventas permanentemente?')) {
                localStorage.removeItem('sales_history');
                updateHistoryUI();
            }
        };
    }
}

function saveSale() {
    const history = JSON.parse(localStorage.getItem('sales_history') || '[]');
    const totalUsd = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const newSale = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        items: [...cart],
        totalUsd: totalUsd,
        totalVes: totalUsd * bcvRate
    };

    history.push(newSale);
    localStorage.setItem('sales_history', JSON.stringify(history));

    alert('Venta registrada en el historial');
    cart = [];
    updateCartUI();

    // Abrir historial automáticamente
    switchPanel('history');
}

function updateHistoryUI() {
    const container = document.getElementById('history-list');
    if (!container) return;

    const history = JSON.parse(localStorage.getItem('sales_history') || '[]');
    container.innerHTML = '';

    if (history.length === 0) {
        container.innerHTML = '<p class="empty-cart-msg">No hay ventas registradas</p>';
        return;
    }

    // Ordenar por fecha (más reciente primero)
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    history.forEach(sale => {
        const date = new Date(sale.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement('div');
        div.className = 'history-item';
        div.style.cssText = 'background: white; border-radius: 12px; padding: 1rem; border: 1px solid #e2e8f0;';

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; border-bottom: 1px dashed #f1f5f9; padding-bottom: 0.5rem;">
                <span style="font-size: 0.75rem; font-weight: 800; color: #64748b;">${dateStr}</span>
                <span style="font-weight: 900; color: #10b981;">$ ${sale.totalUsd.toFixed(2)}</span>
            </div>
            <div style="margin: 0.75rem 0; padding-left: 0.5rem; border-left: 2px solid #f1f5f9;">
                <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem;">
                    ${sale.items.map(i => `
                        <li style="font-size: 0.85rem; color: #334155; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-weight: 800; color: #64748b; min-width: 25px;">${i.quantity}x</span>
                            <span style="flex: 1;">${i.name}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>

            <div style="margin-top: 0.5rem; font-size: 0.75rem; font-weight: 700; color: #ef4444; text-align: right;">
                Bs. ${Math.round(sale.totalVes).toLocaleString('es-VE')}
            </div>
        `;
        container.appendChild(div);

    });
}

window.addToCart = (event, productId) => {
    if (event) event.stopPropagation();
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity++;
    } else {
        // Usar precio de venta (divisa) si está disponible, sino el de costo
        const itemPrice = product.sale_price || product.cost_price || 0;
        cart.push({
            id: product.id,
            name: product.name,
            price: itemPrice,
            quantity: 1
        });
    }

    // Auto-abrir panel de simulador en escritorio
    if (isDesktop) {
        switchPanel('cart');
    }

    updateCartUI();
};

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartUI();
}

function changeQuantity(id, delta) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) removeFromCart(id);
        else updateCartUI();
    }
}

function updateCartUI() {
    const cartItemsContainer = document.getElementById('cart-items');
    if (!cartItemsContainer) return;

    cartItemsContainer.innerHTML = '';
    let totalUsd = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">No hay productos en el simulador</p>';
    } else {
        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            totalUsd += itemTotal;

            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="ticket-info">
                    <div class="ticket-name">${item.name}</div>
                    <div class="ticket-details-row">
                        <span>${item.quantity} x $${item.price.toFixed(2)}</span>
                        <span class="ticket-subtotal">$${itemTotal.toFixed(2)}</span>
                    </div>
                </div>
                <div class="cart-item-actions">
                    <div class="qty-control small">
                        <button onclick="changeQuantity('${item.id}', -1)">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="changeQuantity('${item.id}', 1)">+</button>
                    </div>
                    <button class="remove-item" onclick="removeFromCart('${item.id}')" title="Eliminar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
            cartItemsContainer.appendChild(div);

        });
    }

    const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
    if (cartBadge) {
        cartBadge.textContent = itemCount;
        cartBadge.style.display = itemCount > 0 ? 'flex' : 'none';
    }

    const totalDisplayUsd = document.getElementById('cart-total-usd');
    const totalDisplayVes = document.getElementById('cart-total-ves');

    if (totalDisplayUsd) totalDisplayUsd.textContent = `$ ${totalUsd.toFixed(2)}`;
    if (totalDisplayVes) {
        const totalVes = totalUsd * bcvRate;
        totalDisplayVes.textContent = `Bs. ${Math.round(totalVes).toLocaleString('es-VE')}`;
    }
}


document.addEventListener('DOMContentLoaded', init);
