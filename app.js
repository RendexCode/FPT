// Configuración de Supabase
const SUPABASE_URL = 'https://gqrlqrtoqujvpfanilzr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PLn9H05OB_CFkUfrEy4W2A_-FSJ08qN';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado de la aplicación
let products = [];
let bcvRate = 0;
let filteredProducts = [];
let displayedCount = 0;
const LOAD_STEP = 20;
let selectedCurrency = 'usd';
let isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'; // Cargar sesión al iniciar

// Elementos del DOM
const productsGrid = document.getElementById('products-grid');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const bcvRateDisplay = document.getElementById('bcv-rate');
const loader = document.getElementById('loader');
const liveClock = document.getElementById('live-clock');
const currencyFilter = document.getElementById('currency-filter');
const rateCountdown = document.getElementById('rate-countdown');

// Inicialización
async function init() {
    updateClock();
    updateRateCountdown();
    setInterval(() => {
        updateClock();
        updateRateCountdown();
    }, 1000);

    await fetchBcvRate();
    await fetchProducts();

    searchInput.addEventListener('input', handleSearch);
    categoryFilter.addEventListener('change', handleFilter);
    setupCurrencyToggle();
    setupLoginModal();
    setupBarcodeScanner();
    setupAddProduct();
    setupProductForm();

    // Sincronizar UI con el estado de sesión cargado de localStorage
    updateModalViewFromGlobal();
}

function updateModalViewFromGlobal() {
    const addBtn = document.getElementById('add-product-trigger');
    const searchInput = document.getElementById('search-input');
    if (isLoggedIn && addBtn) {
        addBtn.style.display = 'flex';
        searchInput.style.paddingRight = '7.5rem';
    } else if (addBtn) {
        addBtn.style.display = 'none';
        searchInput.style.paddingRight = '4.5rem';
    }
}

function setupAddProduct() {
    const addBtn = document.getElementById('add-product-trigger');
    addBtn.addEventListener('click', () => {
        if (!isLoggedIn) {
            alert('Debes iniciar sesión para agregar productos.');
            document.getElementById('login-modal').classList.add('active');
            return;
        }
        alert('Abriendo formulario para nuevo producto...');
    });
}

function setupLoginModal() {
    const trigger = document.getElementById('login-trigger');
    const modal = document.getElementById('login-modal');
    const closeBtn = document.getElementById('close-modal');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const loggedInActions = document.getElementById('logged-in-actions');

    const updateModalView = () => {
        const addBtn = document.getElementById('add-product-trigger');
        if (isLoggedIn) {
            loginForm.style.display = 'none';
            loggedInActions.style.display = 'flex';
            if (addBtn) {
                addBtn.style.display = 'flex';
                searchInput.style.paddingRight = '7.5rem';
            }
        } else {
            loginForm.style.display = 'flex';
            loggedInActions.style.display = 'none';
            if (addBtn) {
                addBtn.style.display = 'none';
                searchInput.style.paddingRight = '4.5rem';
            }
        }
    };

    trigger.addEventListener('click', () => {
        updateModalView();
        modal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => modal.classList.remove('active'));

    logoutBtn.addEventListener('click', () => {
        isLoggedIn = false;
        localStorage.removeItem('isLoggedIn'); // Guardar en persistencia
        modal.classList.remove('active');
        updateModalView();
        renderProducts();
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        try {
            submitBtn.textContent = 'Verificando...';
            submitBtn.disabled = true;

            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('full_name', username)
                .eq('password', password)
                .single();

            if (error) throw new Error('Usuario o contraseña no encontrados.');

            if (data) {
                isLoggedIn = true;
                localStorage.setItem('isLoggedIn', 'true'); // Guardar sesión
                modal.classList.remove('active');
                loginForm.reset();
                updateModalView();
                renderProducts();
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            submitBtn.textContent = 'Acceder al Sistema';
            submitBtn.disabled = false;
        }
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // Estado inicial al cargar
    updateModalView();
}

function setupCurrencyToggle() {
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
    const now = new Date();
    liveClock.textContent = now.toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

function updateRateCountdown() {
    const now = new Date();
    const min = (59 - now.getMinutes()).toString().padStart(2, '0');
    const sec = (59 - now.getSeconds()).toString().padStart(2, '0');
    if (rateCountdown) rateCountdown.textContent = `${min}:${sec}`;
}

async function fetchBcvRate() {
    try {
        const { data, error } = await supabaseClient.from('global_settings').select('*').eq('key', 'currency_config');
        if (error) throw error;
        if (data && data.length > 0) {
            const config = typeof data[0].value === 'string' ? JSON.parse(data[0].value) : data[0].value;
            bcvRate = config.bcv_rate || 1.0;
            bcvRateDisplay.textContent = bcvRate.toFixed(2);
            renderProducts();
        }
    } catch (err) {
        console.error('Error al cargar tasa:', err);
        bcvRateDisplay.textContent = 'Error';
    }
}

async function fetchProducts() {
    loader.style.display = 'flex';
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
        loader.style.display = 'none';
    }
}

function populateCategories() {
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    categoryFilter.innerHTML = '<option value="all">Categorías</option>';
    categories.sort().forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
}

function setupBarcodeScanner() {
    window.scannerTarget = 'search';
    const scanTrigger = document.getElementById('scan-trigger');
    const scanFormTrigger = document.getElementById('scan-form-trigger');
    const scannerModal = document.getElementById('scanner-modal');
    const closeScanner = document.getElementById('close-scanner');
    let html5QrCode;
    let isScanning = false;

    const startScanner = async () => {
        try {
            const devices = await Html5Qrcode.getCameras();
            if (!devices || devices.length === 0) throw new Error("No hay cámaras");
            html5QrCode = new Html5Qrcode("reader");
            await html5QrCode.start({ facingMode: "environment" }, { fps: 15, qrbox: { width: 250, height: 150 } }, (text) => {
                if (window.scannerTarget === 'form') {
                    document.getElementById('p-barcode').value = text;
                } else {
                    searchInput.value = text;
                    handleSearch();
                }
                stopScanner();
            });
            isScanning = true;
        } catch (err) {
            alert("Error al abrir cámara. Asegúrate de usar HTTPS o Localhost.");
            scannerModal.classList.remove('active');
        }
    };

    const stopScanner = async () => {
        if (isScanning && html5QrCode) {
            try { await html5QrCode.stop(); } catch (e) { }
            isScanning = false;
        }
        scannerModal.classList.remove('active');
    };

    scanTrigger.addEventListener('click', () => {
        window.scannerTarget = 'search';
        scannerModal.classList.add('active');
        setTimeout(startScanner, 300);
    });

    if (scanFormTrigger) {
        scanFormTrigger.addEventListener('click', () => {
            window.scannerTarget = 'form';
            scannerModal.classList.add('active');
            setTimeout(startScanner, 300);
        });
    }

    closeScanner.addEventListener('click', stopScanner);
}

function setupAddProduct() {
    const addBtn = document.getElementById('add-product-trigger');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            if (!isLoggedIn) {
                document.getElementById('login-modal').classList.add('active');
                return;
            }
            document.getElementById('product-form').reset();
            document.getElementById('p-id').value = '';
            document.getElementById('save-product-btn').textContent = 'Guardar';
            document.body.style.overflow = 'hidden'; // Bloquear scroll de la página base
            document.getElementById('product-modal').classList.add('active');
        });
    }
}

function setupProductForm() {
    const productModal = document.getElementById('product-modal');
    const cancelBtn = document.getElementById('cancel-product-btn');
    const form = document.getElementById('product-form');

    const closeModal = () => {
        productModal.classList.remove('active');
        document.body.style.overflow = ''; // Restaurar scroll de la página base
        form.reset();
    };

    cancelBtn.addEventListener('click', closeModal);

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

        const productData = {
            name, barcode, category, cost_price, sale_price, stock, min_stock, active: true
        };

        const saveBtn = document.getElementById('save-product-btn');
        saveBtn.textContent = 'Guardando...';
        saveBtn.disabled = true;

        try {
            if (id) {
                // Update
                const { error } = await supabaseClient.from('products').update(productData).eq('id', id);
                if (error) throw error;
                // Actualizar array local
                const index = products.findIndex(p => p.id === id);
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
    if (!append) {
        productsGrid.innerHTML = '';
        displayedCount = 0;
    }
    const start = append ? displayedCount : 0;
    const toShow = filteredProducts.slice(start, start + LOAD_STEP);
    if (toShow.length === 0 && !append) {
        productsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: #94a3b8; font-weight: 600;">No hay productos</div>';
        return;
    }

    toShow.forEach(p => {
        const baseCost = p.cost_price || 0;
        const priceVes = baseCost * bcvRate;                                // Precio Base = VES
        const priceUsd = (p.sale_price != null) ? p.sale_price : baseCost;  // Precio Divisa = USD (o base si no hay divisa)
        const stock = p.stock || 0;
        const stockLabel = stock === 0 ? 'Sin Stock' : (stock < 5 ? 'Bajo Stock' : 'Disponible');
        const stockClass = stock <= 0 ? 'badge-out' : (stock < 5 ? 'badge-low' : 'badge-stock');

        // Menú de opciones (3 puntos) para cada producto
        const optHtml = isLoggedIn ? `
            <div style="position: relative; z-index: 50;">
                <button class="options-btn" onclick="toggleOptionsMenu(event, '${p.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                </button>
                <div id="menu-${p.id}" class="options-menu">
                    <button class="option-item" onclick="openEditModal('${p.id}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        <span>Editar</span>
                    </button>
                    <button class="option-item delete" onclick="deleteProduct('${p.id}', '${p.name}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        <span>Eliminar</span>
                    </button>
                </div>
            </div>` : '';

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title"><h3>${p.name}</h3></div>
                ${optHtml}
            </div>
            <div class="card-body">
                <div class="price-stock-row">
                    <div class="price-section">
                        ${selectedCurrency === 'usd' ? `<span class="price-usd">$ ${priceUsd.toFixed(2)}</span>` : `<span class="price-ves">Bs. ${Math.round(priceVes).toLocaleString('es-VE')}</span>`}
                    </div>
                    <div class="stock-section"><span class="badge ${stockClass}">${stockLabel} (${stock})</span></div>
                </div>
            </div>
            <div class="card-footer">
                <span class="card-code">Cod: ${p.barcode || 'N/A'}</span>
                <span class="card-category">${p.category || 'Varios'}</span>
            </div>`;
        productsGrid.appendChild(card);
    });

    displayedCount = append ? displayedCount + LOAD_STEP : LOAD_STEP;
    setupInfiniteScroll();
}

// Funciones globales para el menú de opciones
window.toggleOptionsMenu = (event, id) => {
    event.stopPropagation();
    // Cerrar otros menús abiertos
    document.querySelectorAll('.options-menu').forEach(m => {
        if (m.id !== `menu-${id}`) m.classList.remove('active');
    });
    const menu = document.getElementById(`menu-${id}`);
    menu.classList.toggle('active');
};

window.openEditModal = (id) => {
    // Cerrar menús
    document.querySelectorAll('.options-menu').forEach(m => m.classList.remove('active'));

    const product = products.find(p => p.id === id);
    if (!product) return;

    document.getElementById('save-product-btn').textContent = 'Actualizar';
    document.getElementById('p-id').value = product.id;
    document.getElementById('p-name').value = product.name;
    document.getElementById('p-barcode').value = product.barcode || '';
    document.getElementById('p-category').value = product.category || 'VARIOS';
    document.getElementById('p-cost').value = product.cost_price || 0;

    // Si sale_price es igual a cost_price y no se definió por separado, podríamos mostrarlo. 
    // Para no confundir, mostramos el sale_price existente.
    document.getElementById('p-sale-price').value = (product.sale_price != null) ? product.sale_price : product.cost_price;

    document.getElementById('p-stock').value = product.stock || 0;
    document.getElementById('p-min-stock').value = product.min_stock || 5;

    document.body.style.overflow = 'hidden'; // Bloquear scroll al editar
    document.getElementById('product-modal').classList.add('active');
};

window.deleteProduct = async (id, name) => {
    if (confirm(`¿Estás seguro de que deseas eliminar el producto: ${name}?`)) {
        try {
            const { error } = await supabaseClient.from('products').update({ active: false }).eq('id', id);
            if (error) throw error;
            products = products.filter(p => p.id !== id);
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

let observer;
function setupInfiniteScroll() {
    if (observer) observer.disconnect();
    const last = productsGrid.lastElementChild;
    if (!last || displayedCount >= filteredProducts.length) return;
    observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) renderProducts(true);
    }, { threshold: 0.1 });
    observer.observe(last);
}

function handleSearch() { applyFilters(); }
function handleFilter() { applyFilters(); }

function applyFilters() {
    const term = searchInput.value.toLowerCase();
    const cat = categoryFilter.value;
    filteredProducts = products.filter(p => {
        const matchesS = p.name.toLowerCase().includes(term) || (p.barcode && p.barcode.includes(term)) || (p.brand && p.brand.toLowerCase().includes(term));
        const matchesC = cat === 'all' || p.category === cat;
        return matchesS && matchesC;
    });
    renderProducts();
}

document.addEventListener('DOMContentLoaded', init);
