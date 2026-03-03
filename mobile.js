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
const isDesktop = false;

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
    console.log('FPT Mobile System Initialized');

    updateClock();
    setInterval(() => {
        updateClock();
    }, 1000);

    await fetchBcvRate();
    await fetchProducts();

    if (searchInput) searchInput.addEventListener('input', handleSearch);
    if (categoryFilter) categoryFilter.addEventListener('change', handleFilter);

    setupCurrencyToggle();
    if (!isDesktop) setupLoginModal();
    setupBarcodeScanner();
    setupAddProduct();
    setupProductForm();
    setupImagePreview();
    setupCart();

    if (cartTrigger) {
        cartTrigger.onclick = () => cartModal.classList.add('active');
    }
    if (closeCart) {
        closeCart.onclick = () => cartModal.classList.remove('active');
    }

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

    logoutBtn.addEventListener('click', async () => {
        isLoggedIn = false;
        localStorage.removeItem('isLoggedIn'); // Guardar en persistencia
        modal.classList.remove('active');
        updateModalView();
        renderProducts();
        await supabaseClient.auth.signOut(); // Cierra sesión en Supabase Real
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        try {
            submitBtn.textContent = 'Verificando...';
            submitBtn.disabled = true;

            // Usa la Autenticación real de Supabase
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: username,
                password: password,
            });

            if (error) throw new Error('Usuario o contraseña no encontrados.');

            if (data.session) {
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
            document.body.style.overflow = 'hidden';
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
        document.body.style.overflow = '';
        form.reset();

        const preview = document.getElementById('image-preview');
        const placeholder = document.getElementById('upload-placeholder');
        if (preview && placeholder) {
            preview.src = '';
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
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

            applyFilters(false);
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

    let limit = LOAD_STEP;
    if (!append) {
        productsGrid.innerHTML = '';
        if (displayedCount > LOAD_STEP) limit = displayedCount;
        else displayedCount = 0;
    }
    const start = append ? displayedCount : 0;
    const toShow = filteredProducts.slice(start, start + limit);

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

        // RENDER ORIGINAL PARA TARJETAS (MÓVIL)
        const optHtml = isLoggedIn ? `
                <div style="position: relative; z-index: 50;">
                    <button type="button" class="options-btn" onclick="toggleOptionsMenu(event, '${p.id}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                    </button>
                    <div id="menu-${p.id}" class="options-menu">
                        <button type="button" class="option-item" onclick="openEditModal('${p.id}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            <span>Editar</span>
                        </button>
                        <button type="button" class="option-item delete" onclick="deleteProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            <span>Eliminar</span>
                        </button>
                    </div>
                </div>` : '';

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
                ${p.image_url ? `<div class="card-image"><img src="${p.image_url}" alt="${p.name}"></div>` : ''}
                <div class="card-header" style="flex-direction: row; justify-content: space-between; align-items: flex-start;">
                    <div class="card-title"><h3>${p.name}</h3></div>
                    ${optHtml}
                </div>
                <div class="card-body">
                    <div class="price-stock-row">
                        <div class="price-section">
                            ${selectedCurrency === 'usd' ?
                `<span class="price-usd">$ ${priceUsd.toFixed(2)}</span>` :
                `<span class="price-usd">$ ${baseCost.toFixed(2)}</span>
                                 <span class="price-ves">Bs. ${Math.round(priceVes).toLocaleString('es-VE')}</span>`}
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


    displayedCount = append ? displayedCount + LOAD_STEP : limit;
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

    const product = products.find(p => p.id == id);
    if (!product) return;

    const saveBtn = document.getElementById('save-product-btn');
    const pIdEl = document.getElementById('p-id');
    const pNameEl = document.getElementById('p-name');
    const pBarcodeEl = document.getElementById('p-barcode');
    const pCategoryEl = document.getElementById('p-category');
    const pCostEl = document.getElementById('p-cost');
    const pSalePriceEl = document.getElementById('p-sale-price');
    const pStockEl = document.getElementById('p-stock');
    const pMinStockEl = document.getElementById('p-min-stock') || document.getElementById('p-min_stock');
    const pImageEl = document.getElementById('p-image');

    if (saveBtn) saveBtn.textContent = 'Actualizar';
    if (pIdEl) pIdEl.value = product.id;
    if (pNameEl) pNameEl.value = product.name;
    if (pBarcodeEl) pBarcodeEl.value = product.barcode || '';
    if (pCategoryEl) pCategoryEl.value = product.category || 'VARIOS';
    if (pCostEl) pCostEl.value = product.cost_price || 0;
    if (pSalePriceEl) pSalePriceEl.value = (product.sale_price != null) ? product.sale_price : product.cost_price;
    if (pStockEl) pStockEl.value = product.stock || 0;
    if (pMinStockEl) pMinStockEl.value = product.min_stock || 5;

    const preview = document.getElementById('image-preview');
    const placeholder = document.getElementById('upload-placeholder');
    if (preview && placeholder) {
        if (product.image_url) {
            preview.src = product.image_url;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            preview.src = '';
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
        }
    }
    if (pImageEl) pImageEl.value = '';
    document.body.style.overflow = 'hidden';

    const modal = document.getElementById('product-modal');
    if (modal) modal.classList.add('active');
};

// Desktop functions removed in mobile version


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

let observer;
function setupInfiniteScroll() {
    if (!productsGrid) return;
    if (observer) observer.disconnect();
    const last = productsGrid.lastElementChild;
    if (!last || displayedCount >= filteredProducts.length) return;

    observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) renderProducts(true);
    }, {
        threshold: 0.1
    });
    observer.observe(last);
}



function handleSearch() { applyFilters(); }
function handleFilter() { applyFilters(); }

function applyFilters(resetCount = true) {
    if (!searchInput) return;
    const term = searchInput.value.toLowerCase();
    const cat = categoryFilter ? categoryFilter.value : 'all';
    filteredProducts = products.filter(p => {
        const matchesS = p.name.toLowerCase().includes(term) || (p.barcode && p.barcode.includes(term)) || (p.brand && p.brand.toLowerCase().includes(term));
        const matchesC = cat === 'all' || p.category === cat;
        return matchesS && matchesC;
    });
    if (resetCount) displayedCount = 0;
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
