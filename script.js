// =========================================
// 1. CONFIGURATION & INIT
// =========================================
// Supabase configuration (can be overridden by build tools if needed)
const SUPABASE_URL = 'https://gkxiujmyfsdyxnwhgyzc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGl1am15ZnNkeXhud2hneXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzU3MzUsImV4cCI6MjA4MjM1MTczNX0.oNv2crqvx94abVYFrNhnlQ_ACIdBe1UxMkIDHeBeH7U';

let _supabase;
if (window.supabase && window.supabase.createClient) {
  _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.supabase = _supabase; // Expose client as window.supabase
} else {
  alert('CRITICAL ERROR: Supabase library not loaded. Check internet connection or ad-blockers.');
}

// =========================================
// 2. STATE MANAGEMENT
// =========================================
// Helper to safely parse JSON
function safeParse(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.warn(`Error parsing ${key}, resetting.`, e);
    localStorage.removeItem(key);
    return fallback;
  }
}

// Cache version - increment this when product units change
const CACHE_VERSION = '2.0';
const currentVersion = localStorage.getItem('fm_cache_version');

// Clear cart if cache version changed (fixes packet/gram display issues)
if (currentVersion !== CACHE_VERSION) {
  console.log('Cache version updated - clearing cart to refresh product units');
  localStorage.removeItem('fm_cart');
  localStorage.setItem('fm_cache_version', CACHE_VERSION);
}

const app = {
  user: safeParse('fm_user', null),
  cart: safeParse('fm_cart', []),
  products: [],
  currentScreen: 'loading',
  isAdmin: false,
  adminOrdersCache: []
};

/**
 * Sync prices from Supabase to localStorage.
 * This ensures prices set on one device are available on all devices.
 */
async function syncPricesFromSupabase() {
  try {
    const { data, error } = await _supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'current_prices')
      .single();

    if (error) {
      console.log('No prices in Supabase yet, using local prices');
      return;
    }

    if (data && data.value) {
      const prices = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      localStorage.setItem('fm_current_prices', JSON.stringify(prices));
      console.log('Prices synced from Supabase:', Object.keys(prices).length, 'products');
    }
  } catch (e) {
    console.error('Error syncing prices:', e);
  }
}

// =========================================
// 3. HELPER FUNCTIONS (UI Components)
// =========================================

/**
 * Generates HTML for a single product card.
 * @param {object} product - The product object from Supabase.
 * @returns {string} HTML string for a product card.
 */
function createProductCardHtml(product) {
  const cartItem = app.cart.find(i => i.id === product.id);
  const qty = cartItem ? cartItem.quantity : 0;
  const isStdPacket = product.minimum_quantity_unit !== '250g';
  const unitDisplay = isStdPacket ? (product.minimum_quantity_unit === 'pc' ? 'pc' : 'pkt') : '250g';

  return `
    <div class="product-card">
      <div class="product-image" style="background-image: url('${product.image}')"></div>
      <h3>${product.name}</h3>
      <div class="price">Price TBD / ${unitDisplay}</div>
      <div class="actions">
        ${qty === 0 ?
      `<button class="btn btn-primary btn-sm btn-block" onclick="addToCart('${product.id}')">Add</button>` :
      product.minimum_quantity_unit === '250g' ?
        `<div style="display:flex; align-items:center; justify-content:center; gap:2px;">
          <button type="button" class="qty-btn" onclick="adjustGrams('${product.id}', -50)" style="width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">-</button>
          <input type="number"
            id="grams-${product.id}"
            value="${cartItem && cartItem.customGrams ? cartItem.customGrams : qty * 250}"
            min="0"
            step="50"
            onchange="setCustomQuantity('${product.id}', this.value)"
            style="width:55px; padding:4px; border:2px solid #4caf50; border-radius:6px; text-align:center; font-size:14px; font-weight:600; height:30px;">
          <button type="button" class="qty-btn" onclick="adjustGrams('${product.id}', 50)" style="width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">+</button>
        </div>` :
        `<div class="qty-selector">
          <button type="button" class="qty-btn" onclick="updateCart('${product.id}', -1)">-</button>
          <span class="qty-val">${qty}</span>
          <button type="button" class="qty-btn" onclick="updateCart('${product.id}', 1)">+</button>
        </div>`
    }
      </div>
    </div>
  `;
}

/**
 * Generates HTML for a single cart item.
 * @param {object} item - The cart item object from app.cart.
 * @returns {string} HTML string for a cart item.
 */
function createCartItemHtml(item) {
  const product = app.products.find(p => p.id === item.id);
  if (!product) return '';

  const grams = item.customGrams ? item.customGrams : (item.quantity * 250);
  // Calculate total: If price is available, show approximate. Else TBD.
  // Note: For 250g items, quantity is number of 250g units.
  // Price is per 250g. So quantity * price is correct.
  const perItemTotal = (product && product.price) ? (product.price * item.quantity) : null;

  const isPacket = product.minimum_quantity_unit !== '250g';

  const controls = isPacket ?
    `<div style="display:flex; align-items:center; gap:2px;">
       <button type="button" class="qty-btn" onclick="updateCart('${item.id}', -1)" style="width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">-</button>
       <div style="width:30px; text-align:center; font-weight:600;">${item.quantity}</div>
       <button type="button" class="qty-btn" onclick="updateCart('${item.id}', 1)" style="width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">+</button>
       <button type="button" onclick="removeFromCart('${item.id}')" style="background:#f44336; color:white; border:none; width:28px; height:28px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; margin-left:4px;">✕</button>
     </div>`
    :
    `<div style="display:flex; align-items:center; gap:2px;">
       <button type="button" class="qty-btn" onclick="adjustGrams('${item.id}', -50)" style="width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">-</button>
       <input type="number" 
          id="grams-${item.id}"
          value="${grams}" 
          min="0" step="50" 
          onchange="setCustomQuantity('${item.id}', this.value)"
          style="width:55px; padding:4px; border:2px solid #4caf50; border-radius:6px; text-align:center; font-size:14px; font-weight:600; height:30px;">
       <button type="button" class="qty-btn" onclick="adjustGrams('${item.id}', 50)" style="width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">+</button>
       <button type="button" onclick="removeFromCart('${item.id}')" style="background:#f44336; color:white; border:none; width:28px; height:28px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; margin-left:4px;">✕</button>
     </div>`;

  return `
    <div style="display:flex; gap:12px; align-items:center; background:white; padding:12px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <div style="width:84px; height:84px; background-image: url('${product.image}'); background-size:cover; background-position:center; border-radius:8px; flex-shrink:0;"></div>
      <div style="flex:1;">
        <div style="font-weight:700; margin-bottom:6px;">${product.name}</div>
        <div style="color:#666; font-size:13px; margin-bottom:8px;">${perItemTotal ? '₹' + perItemTotal + ' (est)' : 'Price TBD'}</div>
        ${controls}
      </div>
      <div style="text-align:right; min-width:80px;">
        <div style="font-size:13px; color:#666;">Total</div>
        <div style="font-weight:700; font-size:16px;">${perItemTotal ? '₹' + perItemTotal : 'TBD'}</div>
      </div>
    </div>
  `;
}

/**
 * Generates HTML for an order card in order history.
 * @param {object} order - The order object from Supabase.
 * @returns {string} HTML string for an order card.
 */
function createOrderCardHtml(order) {
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  return `
    <div class="order-card" onclick="viewOrderDetails('${order.id}')">
      <div class="order-header">
        <span class="order-date">${new Date(order.created_at).toLocaleDateString()}</span>
        <span class="order-status ${order.status === 'finalized' ? 'Finalized' : 'Pending'}">${order.status === 'finalized' ? 'Finalized' : 'Pending Price'}</span>
      </div>
      <div class="info-value">
        ${order.total_amount ? '₹' + order.total_amount : 'Total TBD'}
      </div>
      <div class="text-muted" style="font-size: 12px;">
        ${items.map(i => i.name).join(', ').substring(0, 50)}...
      </div>
    </div>
  `;
}

// =========================================
// 4. SCREEN RENDERING FUNCTIONS
// =========================================

/**
 * Renders the User Registration/Login screen.
 * @returns {string} HTML string for the auth screen.
 */
async function renderAuthScreen() {
  // Auth screen is rendered in HTML, not dynamically
  // This function exists for consistency but returns empty
  return '';
}

/**
 * Renders the Product Catalog view.
 * @returns {string} HTML string for the catalog screen.
 */
async function renderCatalogView() {
  const { data, error } = await _supabase
    .from('products')
    .select('*')
    .eq('available', true)  // Only show products that are in stock
    .order('name');

  if (error) {
    console.error('Error fetching products:', error);
    return '<p class="text-center text-danger">Error loading products</p>';
  }

  app.products = data;
  const productHtml = data.map(p => createProductCardHtml(p)).join('');

  return `
    <div class="search-bar-container">
      <input type="text" id="search-input" class="search-input" placeholder="Search vegetables, fruits...">
    </div>
    <div class="category-tabs">
      <div class="cat-chip active" onclick="filterCatalog('all', this)">All</div>
      <div class="cat-chip" onclick="filterCatalog('fruits', this)">Fruits</div>
      <div class="cat-chip" onclick="filterCatalog('vegetable', this)">Vegetables</div>
      <div class="cat-chip" onclick="filterCatalog('green leafs', this)">Greens</div>
      <div class="cat-chip" onclick="filterCatalog('jaggery', this)">Jaggery</div>
      <div class="cat-chip" onclick="filterCatalog('honey', this)">Honey</div>
      <div class="cat-chip" onclick="filterCatalog('other', this)">Other</div>
    </div>
    <div id="product-list" class="product-grid">
      ${productHtml || '<p style="grid-column: 1/-1;" class="text-center text-muted">No products found.</p>'}
    </div>
  `;
}

/**
 * Renders the Customer Cart View.
 * @returns {string} HTML string for the cart screen.
 */
async function renderCustomerCartView() {
  // Check if orders are closed
  let ordersOpen = true;
  try {
    const { data, error } = await _supabase.from('app_settings').select('value').eq('key', 'order_window_open').single();
    if (!error && data) {
      ordersOpen = data.value === 'true';
      localStorage.setItem('fm_orders_open', ordersOpen ? 'true' : 'false');
    } else {
      ordersOpen = localStorage.getItem('fm_orders_open') !== 'false';
    }
  } catch (e) {
    ordersOpen = localStorage.getItem('fm_orders_open') !== 'false';
  }

  if (app.cart.length === 0) {
    return `
      <div class="padded-container text-center" style="margin-top: 50px;">
        <span class="material-icons-round" style="font-size: 64px; color: #ccc;">shopping_cart_checkout</span>
        <p>Your cart is empty.</p>
        <button class="btn btn-primary" onclick="navigateTo('catalog')">Start Shopping</button>
      </div>
    `;
  }

  const closedBanner = !ordersOpen ? `
    <div style="background: linear-gradient(135deg, #f44336, #d32f2f); color: white; padding: 16px; border-radius: 12px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(244,67,54,0.3);">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="material-icons-round" style="font-size: 32px;">store</span>
        <div>
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">Orders Currently Closed</div>
          <div style="font-size: 13px; opacity: 0.95;">We're not accepting new orders right now. Please check back later!</div>
        </div>
      </div>
    </div>
  ` : '';

  const itemsHtml = app.cart.map(item => createCartItemHtml(item)).join('');

  const grandTotalVal = app.cart.reduce((sum, it) => {
    const product = app.products.find(p => p.id === it.id);
    if (product && product.price) return sum + (product.price * it.quantity);
    return sum;
  }, 0);

  return `
    ${closedBanner}
    <div style="display:flex; flex-direction:column; gap:12px; padding:12px;">
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${itemsHtml}
      </div>

      <div style="background:white; padding:12px; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.04); display:flex; justify-content:space-between; align-items:center;">
        <div style="font-weight:600;">Grand Total:</div>
        <div style="font-weight:700;">${grandTotalVal > 0 ? '₹' + grandTotalVal : 'Prices TBD'}</div>
      </div>

      <div>
        ${!ordersOpen ?
      `<button class="btn btn-danger btn-block" disabled style="opacity: 0.6; cursor: not-allowed;">🚫 Orders Closed - Cannot Place Order</button>` :
      `<button class="btn btn-primary btn-block" onclick="placeOrder()">Place Order (Pay Later)</button>`
    }
      </div>
    </div>
  `;
}

/**
 * Renders the Order History screen.
 * @returns {string} HTML string for orders screen.
 */
async function renderOrdersScreen() {
  const { data, error } = await _supabase
    .from('orders')
    .select('*')
    .eq('customer_phone', app.user.phone)
    .order('created_at', { ascending: false });

  if (error) {
    return `<p class="text-center text-danger">Error fetching history</p>`;
  }

  if (data.length === 0) {
    return `<p class="text-center text-muted" style="padding: 20px;">No past orders.</p>`;
  }

  return `
    <div class="padded-container">
      ${data.map(order => createOrderCardHtml(order)).join('')}
    </div>
  `;
}

/**
 * Renders the Profile screen.
 * @returns {string} HTML string for profile screen.
 */
async function renderProfileScreen() {
  return `
    <div class="padded-container">
      <div class="info-card">
        <div class="input-group">
          <label>Full Name</label>
          <input type="text" id="p-name" value="${app.user.name}">
        </div>
        <div class="input-group">
          <label>Phone</label>
          <input type="text" id="p-phone" value="${app.user.phone}" readonly style="background: #f0f0f0;">
        </div>
        <div class="input-group">
          <label>House Number</label>
          <input type="text" id="p-house" value="${app.user.house}">
        </div>
        <button class="btn btn-primary btn-block" onclick="updateProfile()">Save Changes</button>
      </div>
      
      <button class="btn btn-danger btn-block btn-outline" onclick="logout()">Logout</button>
    </div>
  `;
}

/**
 * Renders the Admin Login screen.
 * @returns {string} HTML string for admin login screen.
 */
async function renderAdminLoginScreen() {
  return `
    <div class="padded-container">
      <div class="input-group">
        <label>Admin Password</label>
        <input type="password" id="admin-pass">
      </div>
      <button class="btn btn-primary btn-block" onclick="checkAdminLogin()">Login</button>
    </div>
  `;
}

/**
 * Renders the Admin Dashboard screen.
 * @returns {string} HTML string for admin dashboard.
 */
async function renderAdminDashboard() {
  const isOpen = localStorage.getItem('fm_orders_open') !== 'false';

  return `
    <div class="padded-container">
      <!-- ADMIN HEADER & TOGGLE -->
      <div style="background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span class="material-icons-round" style="color: ${isOpen ? '#4caf50' : '#f44336'}; font-size: 28px;">store</span>
          <div>
            <div style="font-size: 12px; color: #666;">Order Window</div>
            <div style="font-weight: 600; color: ${isOpen ? '#4caf50' : '#f44336'};">${isOpen ? 'Orders Open' : 'Closed'}</div>
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 13px; color: #999;">Closed</span>
          <label style="position: relative; display: inline-block; width: 50px; height: 26px;">
            <input type="checkbox" id="orders-toggle" onchange="toggleOrderWindow()" style="display: none;" ${isOpen ? 'checked' : ''}>
            <div style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px;" 
              onclick="this.previousElementSibling.click()"></div>
            <div style="position: absolute; content: ''; height: 22px; width: 22px; left: ${isOpen ? '26px' : '2px'}; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" 
              id="toggle-knob"></div>
            <span style="font-size: 13px; color: #666; position: absolute; right: -40px; top: 4px;">Open</span>
          </label>
        </div>
      </div>
      
      <div style="text-align: right; margin-bottom: 10px;">
        <small onclick="alert('System Healthy')" style="cursor: pointer; color: #666; text-decoration: underline;">Run System Check</small>
      </div>

      <div class="category-tabs">
        <div class="cat-chip active" id="tab-pending" onclick="switchAdminTab('pending')">Pending</div>
        <div class="cat-chip" id="tab-finalized" onclick="switchAdminTab('finalized')">Finalized</div>
        <div class="cat-chip" id="tab-sent" onclick="switchAdminTab('sent')">Sent</div>
        <div class="cat-chip" id="tab-products" onclick="switchAdminTab('products')">Products</div>
        <div class="cat-chip" id="tab-stats" onclick="switchAdminTab('stats')">Stats</div>
        <div class="cat-chip" id="tab-shopping" onclick="switchAdminTab('shopping')">Shopping</div>
        <div class="cat-chip" id="tab-profit" onclick="switchAdminTab('profit')">💰 Profit</div>
        <div class="cat-chip" id="tab-customers" onclick="switchAdminTab('customers')">👥 Customers</div>
      </div>
      <div id="admin-orders-list"></div>
    </div>
  `;
}

// =========================================
// 5. CENTRAL DISPATCHER
// =========================================

/**
 * Main screen rendering dispatcher.
 * @param {string} screenId - The screen identifier to render
 * @param {object} data - Optional data to pass to the rendering function
 */
async function renderScreen(screenId, data = {}) {
  const contentArea = document.getElementById('content-area');
  const title = document.getElementById('page-title');
  const headerRight = document.querySelector('.header-right');

  contentArea.innerHTML = '';
  if (headerRight) headerRight.innerHTML = '';
  setLoading(true);

  // Handle Admin Portal Routing
  if (screenId === 'admin-portal') {
    screenId = app.isAdmin ? 'admin-dashboard' : 'admin-login';
  }

  try {
    let screenHtml = '';

    switch (screenId) {
      case 'catalog':
        title.innerText = 'Product Catalog';
        screenHtml = await renderCatalogView();
        break;
      case 'cart':
        title.innerText = 'Your Cart';
        screenHtml = await renderCustomerCartView();
        break;
      case 'orders':
        title.innerText = 'My Orders';
        screenHtml = await renderOrdersScreen();
        break;
      case 'profile':
        title.innerText = 'Profile';
        screenHtml = await renderProfileScreen();
        break;
      case 'admin-login':
        title.innerText = 'Seller Login';
        screenHtml = await renderAdminLoginScreen();
        break;
      case 'admin-dashboard':
        title.innerText = 'Admin Dashboard';
        if (headerRight) {
          headerRight.innerHTML = `<span class="material-icons-round" onclick="navigateTo('catalog')" style="font-size: 24px;">close</span>`;
        }
        screenHtml = await renderAdminDashboard();
        break;
      default:
        screenHtml = '<p class="text-center">Page not found</p>';
    }

    contentArea.innerHTML = screenHtml;

    // Attach screen-specific event listeners
    attachScreenSpecificEventListeners(screenId);

  } catch (error) {
    console.error("Error rendering screen:", error);
    contentArea.innerHTML = '<p class="text-center" style="color:red;">Error loading content!</p><p>Please try again.</p>';
  } finally {
    setLoading(false);
  }
}

// =========================================
// 6. EVENT LISTENER MANAGEMENT
// =========================================

/**
 * Attaches event listeners specific to the currently rendered screen.
 * @param {string} screen - The screen identifier
 */
function attachScreenSpecificEventListeners(screen) {
  switch (screen) {
    case 'catalog':
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.addEventListener('input', handleCatalogSearch);
      }
      break;

    case 'admin-dashboard':
      // Load pending orders by default
      loadAdminOrders('pending');
      break;

    default:
      // No specific listeners for this screen
      break;
  }
}

// =========================================
// 7. EVENT HANDLER FUNCTIONS
// =========================================

/**
 * Handles catalog search input.
 * @param {Event} e - Input event
 */
function handleCatalogSearch(e) {
  const term = e.target.value.toLowerCase();
  const filtered = app.products.filter(p => p.name.toLowerCase().includes(term));
  renderProductGrid(filtered);
}

/**
 * Renders the product grid with filtered products.
 * @param {Array} products - Array of product objects
 */
function renderProductGrid(products) {
  const grid = document.getElementById('product-list');
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = '<p class="text-center text-muted" style="grid-column: 1/-1;">No products found.</p>';
    return;
  }

  grid.innerHTML = products.map(p => createProductCardHtml(p)).join('');
}

/**
 * Filters catalog by category.
 * @param {string} category - Category to filter by
 * @param {HTMLElement} chipElement - The chip element that was clicked
 */
window.filterCatalog = function (category, chipElement) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  chipElement.classList.add('active');

  if (category === 'all') {
    renderProductGrid(app.products);
  } else {
    const filtered = app.products.filter(p => {
      if (category === 'fruits') {
        return p.category === 'fruits' || p.category === 'fruit';
      }
      if (category === 'vegetable') {
        return p.category === 'vegetable' || p.category === 'vegetables';
      }
      return p.category === category;
    });
    renderProductGrid(filtered);
  }
};

// =========================================
// 8. NAVIGATION & LIFECYCLE
// =========================================

/**
 * Navigation function to switch between screens.
 * @param {string} screenId - The screen to navigate to
 */
function navigateTo(screenId) {
  console.log(`Navigating to: ${screenId}`);

  // Hide all main views
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-app').classList.add('hidden');
  document.getElementById('loading-overlay').classList.add('hidden');

  // Handle specific screens
  if (screenId === 'auth-screen') {
    document.getElementById('auth-screen').classList.remove('hidden');
  } else {
    document.getElementById('main-app').classList.remove('hidden');

    // Update Bottom Nav Active State
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const navMap = {
      'catalog': 'Catalog',
      'cart': 'Cart',
      'orders': 'Orders',
      'profile': 'Profile',
      'admin-portal': 'Seller',
      'admin-login': 'Seller',
      'admin-dashboard': 'Seller'
    };

    const navItems = Array.from(document.querySelectorAll('.nav-item'));
    const activeItem = navItems.find(item => item.innerText.includes(navMap[screenId]));
    if (activeItem) activeItem.classList.add('active');

    // Render content using new architecture
    renderScreen(screenId);
  }
}

/**
 * Initializes the application.
 */
function init() {
  renderBottomNav();

  if (!app.user) {
    navigateTo('auth-screen');
  } else {
    navigateTo('catalog');
  }

  setupEventListeners();
}

/**
 * Renders the bottom navigation cart badge.
 */
function renderBottomNav() {
  const badge = document.getElementById('nav-cart-count');
  if (badge) {
    const count = app.cart.reduce((sum, i) => sum + i.quantity, 0);
    if (count > 0) {
      badge.innerText = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

// =========================================
// 9. CART & ORDER ACTIONS
// =========================================

/**
 * Adds a product to the cart.
 * @param {string} productId - The product ID
 */
window.refreshCatalog = function () {
  const searchInput = document.getElementById('search-input');
  if (searchInput && searchInput.value.trim() !== '') {
    const term = searchInput.value.toLowerCase().trim();
    const filtered = app.products.filter(p => p.name.toLowerCase().includes(term));
    renderProductGrid(filtered);
  } else {
    const activeChip = document.querySelector('.cat-chip.active');
    if (activeChip) {
      activeChip.click();
    } else {
      renderProductGrid(app.products);
    }
  }
};

window.addToCart = function (productId) {
  const product = app.products.find(p => p.id === productId);
  if (!product) return;

  const existing = app.cart.find(i => i.id === productId);
  if (existing) {
    existing.quantity++;
  } else {
    app.cart.push({
      id: productId,
      name: product.name,
      quantity: 1,
      minQtyUnit: product.minimum_quantity_unit
    });
  }
  saveCart();
  refreshCatalog();
  renderBottomNav();
  toast('Added to cart');
};

/**
 * Updates cart item quantity.
 * @param {string} productId - The product ID
 * @param {number} change - The quantity change (positive or negative)
 */
window.updateCart = function (productId, change) {
  const item = app.cart.find(i => i.id === productId);
  if (!item) return;

  item.quantity += change;
  if (item.quantity <= 0) {
    app.cart = app.cart.filter(i => i.id !== productId);
  }

  saveCart();

  // Update current view
  if (app.products.length > 0 && document.getElementById('product-list')) {
    refreshCatalog();
  }
  if (document.getElementById('content-area')) {
    const currentScreen = app.currentScreen;
    if (currentScreen === 'cart') {
      renderScreen('cart');
    }
  }
  renderBottomNav();
};

/**
 * Set custom quantity in grams for 250g products.
 * @param {string} prodId - Product ID
 * @param {number} grams - Grams amount
 */
window.setCustomQuantity = function (prodId, grams) {
  const gramsNum = parseInt(grams) || 0;

  if (gramsNum === 0) {
    removeFromCart(prodId);
    return;
  }

  const quantity = Math.ceil(gramsNum / 250);
  const item = app.cart.find(i => i.id === prodId);

  if (item) {
    item.quantity = quantity;
    item.customGrams = gramsNum;
  }

  saveCart();
  refreshCatalog();
  renderBottomNav();
};

/**
 * Adjust grams input by delta.
 * @param {string} prodId - Product ID
 * @param {number} delta - Grams to add/subtract
 */
window.adjustGrams = function (prodId, delta) {
  try {
    const input = document.getElementById(`grams-${prodId}`);
    if (!input) return;

    const current = parseInt(input.value) || 0;
    let next = current + delta;
    if (next < 0) next = 0;
    input.value = next;

    const quantity = Math.ceil(next / 250);
    const item = app.cart.find(i => i.id === prodId);

    if (!item && quantity > 0) {
      const product = app.products.find(p => p.id === prodId) || { name: 'Item', minimum_quantity_unit: '250g' };
      app.cart.push({
        id: prodId,
        name: product.name,
        quantity: quantity,
        minQtyUnit: product.minimum_quantity_unit,
        customGrams: next
      });
    } else if (item) {
      if (quantity <= 0) {
        app.cart = app.cart.filter(i => i.id !== prodId);
      } else {
        item.quantity = quantity;
        item.customGrams = next;
      }
    }

    saveCart();
    // Render appropriate view
    if (document.getElementById('product-list')) {
      refreshCatalog();
    } else {
      // Assuming we are in cart if product list is not present
      renderCustomerCartView().then(html => {
        const contentArea = document.getElementById('content-area');
        if (contentArea) contentArea.innerHTML = html;
      });
    }
    renderBottomNav();
  } catch (e) {
    console.error('adjustGrams error', e);
  }
};

/**
 * Remove item from cart.
 * @param {string} prodId - Product ID
 */
window.removeFromCart = function (prodId) {
  app.cart = app.cart.filter(i => i.id !== prodId);
  saveCart();
  refreshCatalog();
  renderBottomNav();

  // If on cart screen, re-render
  if (document.getElementById('content-area')) {
    renderScreen('cart');
  }
};

/**
 * Saves cart to localStorage.
 */
function saveCart() {
  localStorage.setItem('fm_cart', JSON.stringify(app.cart));
}

/**
 * Place order (checkout).
 */
window.placeOrder = async function () {
  // Seller WhatsApp number
  const SELLER_WHATSAPP = '6361983041';

  // Check if orders are open
  let ordersOpen = true;
  try {
    const { data, error } = await _supabase.from('app_settings').select('value').eq('key', 'order_window_open').single();
    ordersOpen = (!error && data) ? data.value === 'true' : localStorage.getItem('fm_orders_open') !== 'false';
  } catch (e) {
    ordersOpen = localStorage.getItem('fm_orders_open') !== 'false';
  }

  if (!ordersOpen) {
    alert('🚫 Orders are currently closed.\n\nWe are not accepting new orders at this time. Please check back later!');
    return;
  }

  if (!confirm('Confirm Order? Prices will be finalized by seller.')) return;

  setLoading(true);

  try {
    // 1. Check for existing PENDING order for this user
    const { data: existingOrders } = await _supabase
      .from('orders')
      .select('*')
      .eq('customer_phone', app.user.phone)
      .eq('status', 'pending');

    const existingOrder = existingOrders && existingOrders.length > 0 ? existingOrders[0] : null;

    let finalItems = [];
    let isUpdate = false;

    if (existingOrder) {
      // --- MERGE WITH EXISTING ORDER ---
      isUpdate = true;
      console.log('Found existing pending order:', existingOrder.id);

      const oldItems = typeof existingOrder.items === 'string' ? JSON.parse(existingOrder.items) : existingOrder.items;

      // valid deep copy
      finalItems = JSON.parse(JSON.stringify(oldItems));

      // Merge new items from cart
      app.cart.forEach(newItem => {
        // Find if this product is already in the order
        const existingItemIndex = finalItems.findIndex(i => i.productId === newItem.id);

        if (existingItemIndex > -1) {
          // Update quantity & grams
          finalItems[existingItemIndex].orderedQuantity += newItem.quantity;

          if (newItem.customGrams) {
            const oldGrams = finalItems[existingItemIndex].customGrams || 0;
            finalItems[existingItemIndex].customGrams = oldGrams + newItem.customGrams;
          }
        } else {
          // Add new item to list
          finalItems.push({
            productId: newItem.id,
            name: newItem.name,
            orderedQuantity: newItem.quantity,
            minQtyUnit: newItem.minQtyUnit,
            customGrams: newItem.customGrams || null,
            pricePer250gAtOrder: 0,
            actualWeight: 0,
            finalPrice: 0
          });
        }
      });

      // Update Supabase
      const { error: updateError } = await _supabase
        .from('orders')
        .update({
          items: JSON.stringify(finalItems),
          // We don't update created_at so it keeps its queue position
        })
        .eq('id', existingOrder.id);

      if (updateError) throw updateError;

    } else {
      // --- CREATE NEW ORDER ---
      finalItems = app.cart.map(i => ({
        productId: i.id,
        name: i.name,
        orderedQuantity: i.quantity,
        minQtyUnit: i.minQtyUnit,
        customGrams: i.customGrams || null,
        pricePer250gAtOrder: 0,
        actualWeight: 0,
        finalPrice: 0
      }));

      const orderPayload = {
        customer_name: app.user.name,
        customer_phone: app.user.phone,
        house_no: app.user.house,
        items: JSON.stringify(finalItems),
        status: 'pending',
        total_amount: 0,
        created_at: new Date().toISOString()
      };

      const { error: insertError } = await _supabase.from('orders').insert([orderPayload]);
      if (insertError) throw insertError;
    }

    setLoading(false);

    // --- WhatsApp Message Construction ---
    const orderItemsList = finalItems.map(i => {
      const grams = i.customGrams || (i.orderedQuantity * 250);
      const unit = i.minQtyUnit === 'packet' ? `${i.orderedQuantity} pkt` : `${grams}g`;
      return `• ${i.name}: ${unit}`;
    }).join('\n');

    const timestamp = new Date().toLocaleString('en-IN', {
      dateStyle: 'short',
      timeStyle: 'short'
    });

    const header = isUpdate ? `🛒 *UPDATED ORDER - Fresh Market*` : `🛒 *NEW ORDER - Fresh Market*`;
    const note = isUpdate ? `\n\n_Note: Customer added items to previous pending order._` : ``;

    const whatsappMessage = encodeURIComponent(
      `${header}\n\n` +
      `👤 *Customer:* ${app.user.name}\n` +
      `📞 *Phone:* ${app.user.phone}\n` +
      `🏠 *House:* ${app.user.house}\n` +
      `🕐 *Time:* ${timestamp}\n\n` +
      `📦 *Total Items (Combined):*\n${orderItemsList}\n\n` +
      `💰 *Price:* To be confirmed` +
      note
    );

    // Open WhatsApp
    window.open(`https://wa.me/91${SELLER_WHATSAPP}?text=${whatsappMessage}`, '_blank');

    if (isUpdate) {
      alert('Items added to your existing pending order!\n\nCheck WhatsApp for the updated full list.');
    } else {
      alert('Order Placed Successfully!\n\nA WhatsApp message has been opened to send your order to the seller.');
    }

    // Clear cart and go to orders
    app.cart = [];
    saveCart();
    renderBottomNav();
    navigateTo('orders');

  } catch (error) {
    setLoading(false);
    console.error(error);
    alert('Order processing failed: ' + error.message);
  }
};

// =========================================
// 10. PROFILE & AUTH ACTIONS
// =========================================

/**
 * Logout function.
 */
window.logout = function () {
  localStorage.removeItem('fm_user');
  app.user = null;
  app.cart = [];
  saveCart();
  navigateTo('auth-screen');
};

/**
 * Update user profile.
 */
window.updateProfile = function () {
  const name = document.getElementById('p-name').value;
  const house = document.getElementById('p-house').value;
  app.user.name = name;
  app.user.house = house;
  localStorage.setItem('fm_user', JSON.stringify(app.user));
  toast('Profile updated');
};

/**
 * View order details.
 * @param {string} orderId - Order ID
 */
window.viewOrderDetails = function (orderId) {
  toast('Tap on order details coming soon');
};

// =========================================
// 11. ADMIN ACTIONS
// =========================================

/**
 * Check admin login.
 */
window.checkAdminLogin = async function () {
  const pass = document.getElementById('admin-pass').value;
  if (pass === 'devampro123') {
    app.isAdmin = true;
    // Sync prices from Supabase when admin logs in
    await syncPricesFromSupabase();
    navigateTo('admin-dashboard');
  } else {
    alert('Invalid Password');
  }
};

/**
 * Load admin orders based on status filter.
 * @param {string} statusFilter - 'pending' or 'finalized'
 */
window.loadAdminOrders = async function (statusFilter) {
  const container = document.getElementById('admin-orders-list');
  if (!container) return;

  container.innerHTML = '<div class="spinner"></div>';

  // Add Item Modal (Hidden by default)
  const modalHtml = `
  <div id="add-to-order-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:2000; align-items:center; justify-content:center;">
    <div style="background:white; width:90%; max-width:400px; padding:20px; border-radius:12px;">
      <h4>Add Item to Order</h4>
      <input type="hidden" id="ato-order-id">
      <div style="margin:16px 0;">
        <label style="display:block;margin-bottom:4px;font-size:14px;">Product</label>
        <select id="ato-product" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;"></select>
      </div>
      <div style="margin:16px 0;">
        <label style="display:block;margin-bottom:4px;font-size:14px;">Quantity (Packets or Units of 250g)</label>
        <div style="display:flex; gap:8px;">
          <input type="number" id="ato-qty" value="1" min="1" style="flex:1; padding:10px; border:1px solid #ddd; border-radius:6px;">
          <span id="ato-unit-label" style="display:flex;align-items:center;background:#eee;padding:0 12px;border-radius:6px;font-size:14px;">Qty</span>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="btn" onclick="document.getElementById('add-to-order-modal').style.display='none'">Cancel</button>
        <button class="btn btn-primary" onclick="confirmAddItem()">Add Item</button>
      </div>
    </div>
  </div>`;

  // Sync prices from Supabase first to ensure latest prices are loaded
  await syncPricesFromSupabase();

  const currentPrices = JSON.parse(localStorage.getItem('fm_current_prices') || '{}');
  console.log('Loaded prices for', Object.keys(currentPrices).length, 'products');

  try {
    let query = _supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (statusFilter === 'pending') query = query.neq('status', 'finalized').neq('status', 'sent');
    else query = query.eq('status', statusFilter);

    const { data, error } = await query;
    if (error) throw error;

    app.adminOrdersCache = data;

    if (data.length === 0) {
      container.innerHTML = '<div class="text-center text-muted" style="padding:40px;">No orders found</div>';
      return;
    }

    const searchHtml = `
    <div style="padding:10px; display:flex; gap:10px; background:white; margin-bottom:12px; border-radius:8px; border:1px solid #eee;">
      <input type="text" id="admin-search" placeholder="Search customer..." style="flex:1; padding:8px; border:1px solid #ddd; border-radius:6px;" onkeyup="filterAdminOrders()">
      <select id="admin-sort" style="width:100px; padding:8px; border:1px solid #ddd; border-radius:6px;" onchange="filterAdminOrders()">
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="name">Name</option>
      </select>
    </div>
    <div id="filtered-orders-list"></div>
    `;

    container.innerHTML = modalHtml + searchHtml;
    filterAdminOrders();
    return;

    container.innerHTML = modalHtml + data.map(o => {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      return `
      <div class="order-card">
        <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid #f0f0f0; padding-bottom:8px;">
          <div>
            <div style="font-weight:700;">${o.customer_name}</div>
            <div class="text-muted" style="font-size:12px;">${o.house_no}</div>
          </div>
          <div class="text-right">
            <div style="font-weight:700;">${o.id.slice(0, 6).toUpperCase()}</div>
            <div style="font-size:12px; color:#666;">${new Date(o.created_at).toLocaleTimeString()}</div>
            <a href="https://wa.me/91${o.customer_phone}" target="_blank" style="font-size:12px; color:#25D366; text-decoration:none; display:flex; align-items:center; gap:4px; justify-content:flex-end; margin-top:2px;">
              <span class="material-icons-round" style="font-size:14px;">chat</span> WhatsApp
            </a>
          </div>
        </div>

        <div style="background:#f9f9f9; padding:10px; border-radius:8px;">
          ${items.map(i => {
        const unit = i.minQtyUnit === 'packet' ? 'pkt' : '250g';
        const prefillPrice = i.pricePer250gAtOrder || currentPrices[i.productId] || '';

        // Debug: log price auto-fill
        if (!prefillPrice) {
          console.log(`No price for ${i.name} (ID: ${i.productId}). Available prices:`, Object.keys(currentPrices));
        }

        return `
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                ${o.status !== 'finalized' ?
            `<div onclick="deleteItemFromOrder('${o.id}', '${i.productId}')" style="color:#d32f2f; font-weight:bold; font-size:18px; cursor:pointer; padding:0 4px; line-height:1;">✕</div>`
            : ''}
                <div style="flex:2;">
                  <div style="font-size:14px; font-weight:500;">${i.name}</div>
                  <div style="font-size:11px; color:#666;">
                    Ordered: ${i.minQtyUnit === '250g' ? (i.customGrams || (i.orderedQuantity * 250)) + 'g' : i.orderedQuantity + ' pkt'}
                  </div>
                </div>
                <div style="flex:1;">
                  <input type="number" id="wt-${o.id}-${i.productId}" 
                    class="admin-input-sm" style="width:100%"
                    placeholder="Wt"
                    value="${i.actualWeight || (i.minQtyUnit === '250g' ? (i.customGrams || (i.orderedQuantity * 250)) : i.orderedQuantity)}"
                    onchange="calculateTotal('${o.id}')">
                </div>
                <div style="flex:1;">
                  <input type="number" id="price-${o.id}-${i.productId}" 
                    class="admin-input-sm" style="width:100%" 
                    placeholder="Rate"
                    value="${prefillPrice}"
                    onchange="calculateTotal('${o.id}')">
                </div>
                <div style="width:60px; text-align:right;">
                  <div style="font-weight:600; font-size:14px;">₹<span id="sub-${o.id}-${i.productId}">0</span></div>
                </div>
              </div>
            `;
      }).join('')}
          ${o.status !== 'finalized' ? `<div style="text-align:center; margin-top:12px; border-top:1px dashed #eee; padding-top:8px;"><button class="btn btn-outline" style="padding:6px 16px; font-size:12px;" onclick="showAddItemModal('${o.id}')">+ Add Item</button></div>` : ''}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
          <div>
            <div style="font-size:12px; color:#666;">Total</div>
            <div style="font-size:20px; font-weight:700; color:var(--primary);">₹<span id="total-${o.id}">${o.total_amount || 0}</span></div>
          </div>
          <div style="display:flex; gap:8px;">
            ${o.status === 'finalized' ?
          `<button class="btn btn-outline" style="padding:6px 10px; font-size:13px; color:#25D366; border-color:#25D366; margin-right:6px;" onclick="shareBill('${o.id}')">Share Bill 📱</button>
           <button class="btn btn-outline" style="padding:6px 10px; font-size:13px;" onclick="rollbackOrder('${o.id}')">↩️</button>` :
          `<button class="btn btn-outline" style="color:red; border-color:red; padding:8px;" onclick="rejectOrder('${o.id}')">✕</button>
               <button class="btn btn-primary" onclick="saveOrder('${o.id}')">Finalize & Save</button>`
        }
          </div>
        </div>
      </div>
    `;
    }).join('');

    // Init totals
    data.forEach(o => calculateTotal(o.id));

  } catch (e) {
    console.error(e);
    container.innerHTML = '<p class="text-danger">Error loading orders</p>';
  }
};

/**
 * Calculate order total dynamically.
 * @param {string} orderId - Order ID
 */
window.calculateTotal = function (orderId) {
  const rows = document.querySelectorAll(`[id^='wt-${orderId}-']`);
  let grandTotal = 0;

  rows.forEach(row => {
    // Extract productId using slice instead of split to handle UUIDs with dashes
    const prefix = `wt-${orderId}-`;
    const productId = row.id.slice(prefix.length);

    // Get input element to check data-unit
    const inputEl = document.getElementById(`wt-${orderId}-${productId}`);
    const unit = inputEl.getAttribute('data-unit') || '250g';

    const wtVal = parseFloat(inputEl.value) || 0;
    const priceVal = parseFloat(document.getElementById(`price-${orderId}-${productId}`).value) || 0;

    // Calculate subtotal
    let subtotal = 0;
    if (unit !== '250g') {
      // Packets / Pieces / Bunches -> Price per Unit * Quantity
      subtotal = wtVal * priceVal;
    } else {
      // Weight in grams -> Price per 250g
      subtotal = (wtVal / 250) * priceVal;
    }
    grandTotal += subtotal;

    // Update subtotal display
    const subSpan = document.getElementById(`sub-${orderId}-${productId}`);
    if (subSpan) subSpan.innerText = Math.round(subtotal);
  });

  const totalSpan = document.getElementById(`total-${orderId}`);
  if (totalSpan) totalSpan.innerText = Math.round(grandTotal);
};

/**
 * Save/finalize order.
 * @param {string} orderId - Order ID
 */
window.saveOrder = async function (orderId) {
  if (!confirm('Finalize order and send bill?')) return;

  const totalSpan = document.getElementById(`total-${orderId}`);
  const grandTotal = parseFloat(totalSpan.innerText);

  const { data: order } = await _supabase.from('orders').select('*').eq('id', orderId).single();

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

  const updatedItems = items.map(item => {
    const wtVal = parseFloat(document.getElementById(`wt-${orderId}-${item.productId}`).value) || 0;
    const priceVal = parseFloat(document.getElementById(`price-${orderId}-${item.productId}`).value) || 0;

    let finalPrice = 0;
    if (item.minQtyUnit !== '250g') {
      finalPrice = wtVal * priceVal;
    } else {
      finalPrice = (wtVal / 250) * priceVal;
    }

    return {
      ...item,
      actualWeight: wtVal,
      pricePer250gAtOrder: priceVal,
      finalPrice: Math.round(finalPrice)
    };
  });

  const finalTotal = updatedItems.reduce((acc, i) => acc + i.finalPrice, 0);

  await _supabase.from('orders').update({
    items: JSON.stringify(updatedItems),
    total_amount: finalTotal,
    status: 'finalized'
  }).eq('id', orderId);

  toast('Order Finalized. Moved to "Finalized" tab.');
  loadAdminOrders('pending');
};

/**
 * Delete single item from pending order.
 * @param {string} orderId - Order ID
 * @param {string} productId - Product ID to remove
 */
window.deleteItemFromOrder = async function (orderId, productId) {
  if (!confirm('Remove this item from the order?')) return;

  const order = app.adminOrdersCache.find(o => o.id === orderId);
  if (!order) return;

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const newItems = items.filter(i => i.productId !== productId);

  if (newItems.length === 0) {
    if (confirm('This is the last item. Delete the entire order?')) {
      await _supabase.from('orders').delete().eq('id', orderId);
    } else {
      await _supabase.from('orders').update({ items: JSON.stringify([]) }).eq('id', orderId);
    }
  } else {
    await _supabase.from('orders').update({ items: JSON.stringify(newItems) }).eq('id', orderId);
  }

  loadAdminOrders('pending');
};

/**
 * Reject/delete order.
 * @param {string} orderId - Order ID
 */
window.rejectOrder = async function (orderId) {
  if (!confirm('Delete this order?')) return;
  await _supabase.from('orders').delete().eq('id', orderId);
  loadAdminOrders('pending');
};



/**
 * Show Add Item Modal.
 */
window.showAddItemModal = async function (orderId) {
  document.getElementById('ato-order-id').value = orderId;
  const modal = document.getElementById('add-to-order-modal');
  const select = document.getElementById('ato-product');

  select.innerHTML = '<option>Loading...</option>';
  modal.style.display = 'flex'; // Show modal

  // Fetch products
  const { data: products } = await _supabase.from('products').select('*').order('name');

  select.innerHTML = products.map(p =>
    `<option value="${p.id}" data-unit="${p.minimum_quantity_unit}" data-name="${p.name}">${p.name} (${p.minimum_quantity_unit || '250g'})</option>`
  ).join('');

  select.onchange = updateAtoUnit;
  updateAtoUnit();
};

window.updateAtoUnit = function () {
  const sel = document.getElementById('ato-product');
  if (sel.options.length === 0) return;
  const opt = sel.options[sel.selectedIndex];
  const unit = opt.getAttribute('data-unit') || '250g';
  document.getElementById('ato-unit-label').innerText = unit === 'packet' ? 'Pkts' : 'x 250g';
};

window.confirmAddItem = async function () {
  const orderId = document.getElementById('ato-order-id').value;
  const select = document.getElementById('ato-product');
  const opt = select.options[select.selectedIndex];
  const productId = select.value;
  const name = opt.getAttribute('data-name');
  const unit = opt.getAttribute('data-unit') || '250g';
  const qty = parseFloat(document.getElementById('ato-qty').value);

  if (qty <= 0) return;

  const order = app.adminOrdersCache.find(o => o.id === orderId);
  let items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

  // Check if exists
  const existing = items.find(i => i.productId === productId);
  if (existing) {
    existing.orderedQuantity += qty;
    if (unit === '250g') {
      const addedGrams = qty * 250;
      existing.customGrams = (existing.customGrams || (existing.orderedQuantity * 250)) + addedGrams; // Fix logic to ensure base is present
    }
  } else {
    items.push({
      productId: productId,
      name: name,
      orderedQuantity: qty,
      minQtyUnit: unit,
      customGrams: unit === '250g' ? qty * 250 : null,
      pricePer250gAtOrder: 0,
      actualWeight: 0,
      finalPrice: 0
    });
  }

  await _supabase.from('orders').update({ items: JSON.stringify(items) }).eq('id', orderId);
  document.getElementById('add-to-order-modal').style.display = 'none';
  loadAdminOrders('pending');
};

/**
 * Rollback finalized order to pending.
 * @param {string} id - Order ID
 */
window.rollbackOrder = async function (id) {
  if (!confirm('Move back to pending?')) return;
  await _supabase.from('orders').update({ status: 'pending' }).eq('id', id);
  loadAdminOrders('finalized');
};

/**
 * Share finalized bill via WhatsApp.
 */
window.shareBill = async function (orderId) {
  const order = app.adminOrdersCache.find(o => o.id === orderId);
  if (!order) return;
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

  // Prompt to verify phone number
  const newPhone = prompt(`Confirm WhatsApp Number for ${order.customer_name}:`, order.customer_phone);
  if (!newPhone) return; // Cancelled

  const total = order.total_amount || 0;

  const message = `*Fresh Market Bill* %0AOrder for: *${order.customer_name}* %0APhone: ${newPhone} %0AHouse: ${order.customer_house_number || 'N/A'} %0A%0AItems: %0A${items.map(i => `${i.name} (${i.actualWeight}${i.minQtyUnit !== '250g' ? (i.minQtyUnit === 'pc' ? 'pc' : 'pkt') : 'g'}): ₹${i.finalPrice || 0}`).join('%0A')} %0A%0A*Total: ₹${total}*`;

  // Update DB: Status -> Sent, and Phone if changed
  const updateData = { status: 'sent' };
  if (newPhone !== order.customer_phone) {
    updateData.customer_phone = newPhone;
  }

  await _supabase.from('orders').update(updateData).eq('id', orderId);

  window.open(`https://wa.me/91${newPhone}?text=${message}`, '_blank');

  // Refresh current view (will remove from Finalized, or refresh Sent)
  const currentTab = document.querySelector('.cat-chip.active').id.replace('tab-', '');
  loadAdminOrders(currentTab);
};

// Override switchAdminTab to support 'sent' and preserve logic
window.switchAdminTab = function (tab) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  const tabEl = document.getElementById('tab-' + tab);
  if (tabEl) tabEl.classList.add('active');

  const list = document.getElementById('admin-orders-list');
  if (list) list.innerHTML = '<div class="spinner"></div>';

  switch (tab) {
    case 'pending':
    case 'finalized':
    case 'sent':
      loadAdminOrders(tab);
      break;
    case 'products':
      loadAdminProducts();
      break;
    case 'stats':
      if (window.renderAnalytics) window.renderAnalytics();
      else list.innerHTML = '<p class="text-center">Analytics Module Loading...</p>';
      break;
    case 'shopping':
      renderPurchaseList();
      break;
    case 'profit':
      renderProfitReport();
      break;
    case 'customers':
      if (window.renderCustomerHistory) window.renderCustomerHistory();
      else list.innerHTML = '<p class="text-center">History Module Loading...</p>';
      break;
  }
};

/**
 * Filter and render admin orders.
 */
window.filterAdminOrders = function () {
  try {
    const searchInput = document.getElementById('admin-search');
    if (!searchInput) return; // Guard
    const search = searchInput.value.toLowerCase();
    const sort = document.getElementById('admin-sort').value;
    const listContainer = document.getElementById('filtered-orders-list');

    if (!app.adminOrdersCache) return;

    const currentPrices = JSON.parse(localStorage.getItem('fm_current_prices') || '{}');

    let filtered = app.adminOrdersCache.filter(o => {
      const text = (o.customer_name + ' ' + o.house_no + ' ' + o.customer_phone).toLowerCase();
      return text.includes(search);
    });

    // Sort
    if (sort === 'newest') {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sort === 'oldest') {
      filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sort === 'name') {
      filtered.sort((a, b) => a.customer_name.localeCompare(b.customer_name));
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = '<div class="text-center text-muted" style="padding:40px;">No matching orders</div>';
      return;
    }

    listContainer.innerHTML = filtered.map(o => {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      return `
      <div class="order-card">
        <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid #f0f0f0; padding-bottom:8px;">
          <div>
            <div style="font-weight:700;">${o.customer_name}</div>
            <div class="text-muted" style="font-size:12px;">${o.house_no}</div>
          </div>
          <div class="text-right">
            <div style="font-weight:700;">${o.id.slice(0, 6).toUpperCase()}</div>
            <div style="font-size:12px; color:#666;">${new Date(o.created_at).toLocaleTimeString()}</div>
            <a href="https://wa.me/91${o.customer_phone}" target="_blank" style="font-size:12px; color:#25D366; text-decoration:none; display:flex; align-items:center; gap:4px; justify-content:flex-end; margin-top:2px;">
              <span class="material-icons-round" style="font-size:14px;">chat</span> WhatsApp
            </a>
          </div>
        </div>

        <div style="background:#f9f9f9; padding:10px; border-radius:8px;">
          ${items.map(i => {
        const isPacket = i.minQtyUnit !== '250g';
        const unitLabel = isPacket ? (i.minQtyUnit === 'pc' ? 'pc' : 'pkt') : 'g';
        const prefillPrice = i.pricePer250gAtOrder || currentPrices[i.productId] || '';

        // If packet/pc, weight is Quantity (e.g. 1, 2). If 250g, weight is Grams (250, 500).
        const actualWeight = i.actualWeight || (isPacket ? i.orderedQuantity : (i.customGrams || (i.orderedQuantity * 250)));

        return `
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                ${o.status !== 'finalized' ?
            `<div onclick="deleteItemFromOrder('${o.id}', '${i.productId}')" style="color:#d32f2f; font-weight:bold; font-size:18px; cursor:pointer; padding:0 4px; line-height:1;">✕</div>`
            : ''}
                <div style="flex:2;">
                  <div style="font-size:14px; font-weight:500;">${i.name}</div>
                  <div style="font-size:11px; color:#666;">
                    Ordered: ${isPacket ? i.orderedQuantity + ' ' + unitLabel : (i.customGrams || (i.orderedQuantity * 250)) + 'g'}
                  </div>
                </div>
                <div style="flex:1;">
                  <input type="number" id="wt-${o.id}-${i.productId}" 
                    data-unit="${i.minQtyUnit || '250g'}"
                    class="admin-input-sm" style="width:100%"
                    placeholder="${isPacket ? 'Qty' : 'Wt (g)'}"
                    value="${actualWeight}"
                    onchange="calculateTotal('${o.id}')">
                </div>
                <div style="flex:1;">
                  <input type="number" id="price-${o.id}-${i.productId}" 
                    class="admin-input-sm" style="width:100%" 
                    placeholder="${isPacket ? 'Rate/Unit' : 'Rate/250g'}"
                    value="${prefillPrice}"
                    onchange="calculateTotal('${o.id}')">
                </div>
                <div style="width:60px; text-align:right;">
                  <div style="font-weight:600; font-size:14px;">₹<span id="sub-${o.id}-${i.productId}">0</span></div>
                </div>
              </div>
            `;
      }).join('')}
          ${o.status !== 'finalized' ? `<div style="text-align:center; margin-top:12px; border-top:1px dashed #eee; padding-top:8px;"><button class="btn btn-outline" style="padding:6px 16px; font-size:12px;" onclick="showAddItemModal('${o.id}')">+ Add Item</button></div>` : ''}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
          <div>
            <div style="font-size:12px; color:#666;">Total</div>
            <div style="font-size:20px; font-weight:700; color:var(--primary);">₹<span id="total-${o.id}">${o.total_amount || 0}</span></div>
          </div>
          <div style="display:flex; gap:8px;">
            ${o.status === 'finalized' ?
          `<button class="btn btn-outline" style="padding:6px 10px; font-size:13px; color:#25D366; border-color:#25D366; margin-right:6px;" onclick="shareBill('${o.id}')">Share Bill 📱</button>
             <button class="btn btn-outline" style="padding:6px 10px; font-size:13px;" onclick="rollbackOrder('${o.id}')">↩️</button>` :
          `<button class="btn btn-outline" style="color:red; border-color:red; padding:8px;" onclick="rejectOrder('${o.id}')">✕</button>
             <button class="btn btn-primary" onclick="saveOrder('${o.id}')">Finalize & Save</button>`
        }
          </div>
        </div>
      </div>
    `;
    }).join('');

    // Init totals
    filtered.forEach(o => calculateTotal(o.id));

  } catch (e) {
    console.error('Render Error:', e);
    const list = document.getElementById('admin-orders-list');
    if (list) list.innerHTML = `<div class="text-danger" style="padding:20px; text-align:center;">Error displaying orders: ${e.message}</div>`;
  }
};

// =========================================
// 12. UTILITIES
// =========================================

/**
 * Show/hide loading overlay.
 * @param {boolean} isLoading - Whether to show loading
 */
function setLoading(isLoading) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    if (isLoading) overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
  }
}

/**
 * Show toast notification.
 * @param {string} msg - Message to display
 */
function toast(msg) {
  try {
    const existing = document.getElementById('app-toast');
    if (existing) existing.remove();

    const t = document.createElement('div');
    t.id = 'app-toast';
    t.innerText = msg;
    Object.assign(t.style, {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: '80px',
      background: 'rgba(0,0,0,0.85)',
      color: 'white',
      padding: '12px 18px',
      borderRadius: '999px',
      zIndex: 9999,
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      fontSize: '14px',
      maxWidth: '90%',
      textAlign: 'center',
      opacity: '0',
      transition: 'opacity 200ms ease'
    });

    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; });

    const duration = 1800;
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 220);
    }, duration);
  } catch (e) {
    try { console.log(msg); } catch (err) { }
  }
}

/**
 * Global login handler.
 */
window.updatePhoneConfirm = function () {
  const input = document.getElementById('auth-phone');
  const ui = document.getElementById('phone-confirm-ui');
  const display = document.getElementById('phone-display');

  let val = input.value.replace(/\D/g, '');
  if (val.length > 10) val = val.slice(-10); // Enforce max 10

  if (val.length === 10) {
    ui.style.display = 'block';
    display.textContent = val.replace(/(\d{5})(\d{5})/, '$1 $2');
  } else {
    ui.style.display = 'none';
    document.getElementById('phone-confirm-check').checked = false;
  }
};

/**
 * Global login handler.
 */
window.handleLogin = function () {
  console.log('Login clicked');
  try {
    const nameInput = document.getElementById('auth-name');
    const phoneInput = document.getElementById('auth-phone');
    const houseInput = document.getElementById('auth-house');

    if (!nameInput || !phoneInput || !houseInput) {
      alert('Error: Input fields not found. Please refresh.');
      return;
    }

    const name = nameInput.value.trim();
    let phone = phoneInput.value;
    const house = houseInput.value.trim();

    phone = phone.replace(/\D/g, '');

    if (!name) { alert('Please enter your name'); return; }
    if (!house) { alert('Please enter your house number'); return; }

    if (phone.length > 10) {
      phone = phone.slice(-10);
    }

    if (phone.length !== 10) {
      alert('Please enter a valid 10-digit phone number. Current digits: ' + phone.length);
      return;
    }

    // Check confirmation
    const confirmCheck = document.getElementById('phone-confirm-check');
    if (confirmCheck && !confirmCheck.checked) {
      alert('Please check the box to confirm your phone number is correct.');
      return;
    }

    app.user = { name, phone, house };
    localStorage.setItem('fm_user', JSON.stringify(app.user));
    console.log('Login success, user saved:', app.user);

    const btn = document.querySelector('#auth-form button');
    if (btn) btn.innerText = 'Logging in...';

    setTimeout(() => {
      navigateTo('catalog');
    }, 100);

  } catch (err) {
    console.error(err);
    alert('Login Error: ' + err.message);
  }
};

/**
 * Setup global event listeners.
 */
function setupEventListeners() {
  // Delegated listener for quantity buttons
  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.qty-btn');
    if (!btn) return;
    const prod = btn.dataset && btn.dataset.prod;
    const action = btn.dataset && btn.dataset.action;
    if (!prod || !action) return;

    if (action === 'dec') {
      if (document.getElementById(`grams-${prod}`)) adjustGrams(prod, -50);
      else updateCart(prod, -1);
    } else if (action === 'inc') {
      if (document.getElementById(`grams-${prod}`)) adjustGrams(prod, 50);
      else updateCart(prod, 1);
    }

    e.preventDefault();
  });
}

// =========================================
// 13. ADDITIONAL ADMIN FUNCTIONS
// =========================================

/**
 * Toggle order window open/closed.
 */
window.toggleOrderWindow = async function () {
  const toggle = document.getElementById('orders-toggle');
  if (!toggle) return;
  const isOpen = toggle.checked;

  try {
    const { error } = await _supabase.from('app_settings').upsert({
      key: 'order_window_open',
      value: isOpen ? 'true' : 'false',
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

    if (error) throw error;

    localStorage.setItem('fm_orders_open', isOpen ? 'true' : 'false');

    const knob = document.getElementById('toggle-knob');
    if (knob) {
      knob.style.left = isOpen ? '26px' : '2px';
    }
  } catch (e) {
    console.error(e);
    alert('Failed to switch. Check internet.');
    toggle.checked = !isOpen;
  }
};

/**
 * Switch admin tab.
 * @param {string} tab - Tab name
 */
window.switchAdminTab = function (tab) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  const tabEl = document.getElementById('tab-' + tab);
  if (tabEl) tabEl.classList.add('active');

  const list = document.getElementById('admin-orders-list');
  if (!list) return;
  list.innerHTML = '<div class="spinner"></div>';

  switch (tab) {
    case 'pending':
    case 'finalized':
      loadAdminOrders(tab);
      break;
    case 'products':
      if (window.loadAdminProducts) window.loadAdminProducts();
      else list.innerHTML = '<p style="padding:20px; text-align:center;">Products tab coming soon</p>';
      break;
    case 'stats':
      if (window.renderAnalytics) window.renderAnalytics();
      else list.innerHTML = '<p style="padding:20px; text-align:center;">Stats coming soon</p>';
      break;
    case 'shopping':
      renderPurchaseList();
      break;
    case 'profit':
      renderProfitReport();
      break;
    case 'customers':
      if (window.renderCustomerHistory) window.renderCustomerHistory();
      else list.innerHTML = '<p style="padding:20px; text-align:center;">Customer history coming soon</p>';
      break;
  }
};

/**
 * Load and display products for admin management.
 */
window.loadAdminProducts = async function () {
  const container = document.getElementById('admin-orders-list');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const { data: products, error } = await _supabase
      .from('products')
      .select('*')
      .order('name');

    if (error) throw error;

    // DIAGNOSTIC: Log actual column names from Supabase
    if (products.length > 0) {
      console.log('=== SUPABASE PRODUCT COLUMNS ===');
      console.log('Sample product:', products[0]);
      console.log('Column names:', Object.keys(products[0]));
      console.log('================================');
    }

    container.innerHTML = `
      <div style="padding:16px;">
        <div style="background:white; border-radius:12px; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3>Products (${products.length})</h3>
            <button class="btn btn-primary" onclick="showAddProductModal()">+ Add Product</button>
          </div>
          
          <div id="product-modal" class="hidden" style="background:white; padding:16px; border-radius:12px; margin-bottom:16px; border:2px solid var(--primary);">
            <h4 id="modal-title">Add New Product</h4>
            <input type="hidden" id="edit-product-id">
            <div style="display:grid; gap:12px; margin:16px 0;">
              <div>
                <label style="display:block; font-size:14px; margin-bottom:4px;">Product Name</label>
                <input type="text" id="product-name" placeholder="e.g., Tomato" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
              </div>
              <div>
                <label style="display:block; font-size:14px; margin-bottom:4px;">Category</label>
                <select id="product-category" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
                  <option value="vegetable">Vegetable</option>
                  <option value="fruits">Fruits</option>
                  <option value="green leafs">Green Leafs</option>
                  <option value="jaggery">Jaggery</option>
                  <option value="honey">Honey</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div>
                  <label style="display:block; font-size:14px; margin-bottom:4px;">Unit Type</label>
                  <select id="product-unit" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
                    <option value="250g">250g</option>
                    <option value="packet">Packet</option>
                  </select>
                </div>
                <div>
                  <label style="display:block; font-size:14px; margin-bottom:4px;">Min Quantity</label>
                  <input type="number" id="product-min-qty" value="1" min="1" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
                </div>
              </div>
              <div>
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" id="product-available" checked style="width:18px; height:18px;">
                  <span>Available for ordering</span>
                </label>
              </div>
            </div>
            <div style="display:flex; gap:8px; justify-content:flex-end;">
              <button class="btn btn-outline" onclick="hideProductModal()">Cancel</button>
              <button class="btn btn-primary" onclick="saveProduct()">Save Product</button>
            </div>
          </div>
          
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="text-align:left; border-bottom:2px solid #eee;">
                <th style="padding:8px;">Name</th>
                <th style="padding:8px;">Unit</th>
                <th style="padding:8px;">Min Qty</th>
                <th style="padding:8px;">Status</th>
                <th style="padding:8px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${products.map(p => {
      // Use actual Supabase column names (singular: minimum_quantity_unit)
      const unit = p.minimum_quantity_unit || '250g';
      const minQty = 1; // Not stored in DB, always default to 1
      const isAvailable = p.available !== undefined ? p.available : true;

      return `
                <tr style="border-bottom:1px solid #f9f9f9;">
                  <td style="padding:10px; font-weight:500;">${p.name}</td>
                  <td style="padding:10px;">${unit}</td>
                  <td style="padding:10px;">${minQty}</td>
                  <td style="padding:10px;">
                    <button 
                      class="btn btn-outline" 
                      style="padding:4px 12px; font-size:12px; ${isAvailable ? 'background:#e8f5e9; color:#4caf50; border-color:#4caf50;' : 'background:#ffebee; color:#f44336; border-color:#f44336;'}" 
                      onclick="toggleProductStock('${p.id}', ${!isAvailable})">
                      ${isAvailable ? '✓ In Stock' : '✗ Out of Stock'}
                    </button>
                  </td>
                  <td style="padding:10px;">
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:12px; margin-right:4px;" onclick='editProduct(${JSON.stringify(p)})'>Edit</button>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:12px; color:red; border-color:red;" onclick="deleteProduct('${p.id}', '${p.name}')">Delete</button>
                  </td>
                </tr>
              `;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    console.error('Error loading products:', e);
    container.innerHTML = '<p class="text-danger" style="padding:20px;">Error loading products</p>';
  }
};

/**
 * Show modal to add new product.
 */
window.showAddProductModal = function () {
  document.getElementById('modal-title').innerText = 'Add New Product';
  document.getElementById('edit-product-id').value = '';
  document.getElementById('product-name').value = '';
  document.getElementById('product-category').value = 'vegetable';
  document.getElementById('product-unit').value = '250g';
  document.getElementById('product-min-qty').value = '1';
  document.getElementById('product-available').checked = true;
  document.getElementById('product-modal').classList.remove('hidden');
};

/**
 * Hide product modal.
 */
window.hideProductModal = function () {
  document.getElementById('product-modal').classList.add('hidden');
};

/**
 * Edit existing product.
 * @param {object} product - Product object
 */
window.editProduct = function (product) {
  document.getElementById('modal-title').innerText = 'Edit Product';
  document.getElementById('edit-product-id').value = product.id;
  document.getElementById('product-name').value = product.name;
  document.getElementById('product-category').value = product.category || 'other';
  document.getElementById('product-unit').value = product.minimum_quantity_unit || '250g';
  document.getElementById('product-min-qty').value = 1; // Always 1, not stored in DB
  document.getElementById('product-available').checked = product.available !== undefined ? product.available : true;
  document.getElementById('product-modal').classList.remove('hidden');
};

/**
 * Save product (add or update).
 */
window.saveProduct = async function () {
  const id = document.getElementById('edit-product-id').value;
  const name = document.getElementById('product-name').value.trim();
  const unit = document.getElementById('product-unit').value;
  const minQty = parseInt(document.getElementById('product-min-qty').value);
  const available = document.getElementById('product-available').checked;

  if (!name) {
    alert('Please enter product name');
    return;
  }

  const category = document.getElementById('product-category').value;

  try {
    // Use actual Supabase column names from schema (singular: minimum_quantity_unit)
    const productData = {
      name: name,
      category: category,
      minimum_quantity_unit: unit,
      available: available
    };

    console.log('Saving product with data:', productData);

    if (id) {
      // Update existing product
      const { error } = await _supabase
        .from('products')
        .update(productData)
        .eq('id', id);

      if (error) throw error;
      alert('Product updated successfully!');
    } else {
      // Add new product
      const { error } = await _supabase
        .from('products')
        .insert([productData]);

      if (error) throw error;
      alert('Product added successfully!');
    }

    hideProductModal();
    loadAdminProducts(); // Reload the list
  } catch (e) {
    console.error('Error saving product:', e);
    alert('Error saving product: ' + e.message);
  }
};

/**
 * Delete product.
 * @param {string} id - Product ID
 * @param {string} name - Product name
 */
window.deleteProduct = async function (id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  try {
    const { error } = await _supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
    alert('Product deleted successfully!');
    loadAdminProducts(); // Reload the list
  } catch (e) {
    console.error('Error deleting product:', e);
    alert('Error deleting product: ' + e.message);
  }
};

/**
 * Toggle product stock status (available/unavailable).
 * @param {string} id - Product ID
 * @param {boolean} newStatus - New availability status
 */
window.toggleProductStock = async function (id, newStatus) {
  console.log('Toggling stock for product:', id, 'to:', newStatus);

  try {
    const { data, error } = await _supabase
      .from('products')
      .update({ available: newStatus })
      .eq('id', id)
      .select();

    console.log('Update result:', { data, error });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.warn('No rows updated - check if product ID exists or RLS policy');
      alert('Update may have failed. Check if the product exists and you have permission.');
    } else {
      console.log('Successfully updated product:', data[0]);
      toast(newStatus ? 'Product marked as In Stock' : 'Product marked as Out of Stock');
    }

    // Reload the product list to show updated status
    loadAdminProducts();
  } catch (e) {
    console.error('Error toggling stock:', e);
    alert('Error updating stock status: ' + e.message);
  }
};

/**
 * Render purchase/shopping list.
 */
window.renderPurchaseList = async function () {
  const container = document.getElementById('admin-orders-list');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';

  const { data: orders } = await _supabase.from('orders').select('items').neq('status', 'finalized');

  const needed = {};
  orders.forEach(o => {
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
    items.forEach(i => {
      if (!needed[i.productId]) needed[i.productId] = { name: i.name, unit: i.minQtyUnit, totalQty: 0, totalGrams: 0 };
      needed[i.productId].totalQty += i.orderedQuantity;
      if (i.minQtyUnit === '250g') {
        const grams = i.customGrams || (i.orderedQuantity * 250);
        needed[i.productId].totalGrams += grams;
      }
    });
  });

  const html = `
    <div style="padding:16px;">
      <div style="background:white; border-radius:12px; padding:16px;">
        <h3>Shopping List 🛒</h3>
        <table style="width:100%; border-collapse:collapse;">
          <thead><tr style="text-align:left; border-bottom:1px solid #eee;"><th style="padding:8px;">Item</th><th style="padding:8px;">Qty</th></tr></thead>
          <tbody>
            ${Object.values(needed).map(i => `
              <tr style="border-bottom:1px solid #f9f9f9;">
                <td style="padding:10px;">${i.name}</td>
                <td style="padding:10px; font-weight:600;">
                  ${i.unit === 'packet' ? i.totalQty + ' pkts' : (i.totalGrams / 1000).toFixed(2) + ' kg'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  container.innerHTML = html;
};

/**
 * Render profit report.
 */
window.renderProfitReport = async function () {
  const container = document.getElementById('admin-orders-list');
  if (!container) return;

  const lastUpdated = localStorage.getItem('fm_prices_updated') || 'Never';

  container.innerHTML = `
    <div style="padding:16px;">
      <div style="background:linear-gradient(135deg,#4caf50,#2e7d32); padding:16px; border-radius:12px; color:white; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="opacity:0.9; font-size:12px;">Current Prices</div>
          <div style="font-weight:600;">Updated: ${lastUpdated}</div>
        </div>
        <button class="btn" style="background:white; color:green;" onclick="showPriceSetter()">Edit Prices</button>
      </div>

      <div id="price-setter-modal" class="hidden" style="background:white; padding:16px; border-radius:12px; margin-bottom:16px; border:1px solid #eee;">
        <h4>Set Today's Selling Prices (₹/250g)</h4>
        <div id="price-inputs" style="max-height:300px; overflow-y:auto; margin-bottom:12px;"></div>
        <button class="btn btn-primary btn-block" onclick="saveCurrentPrices()">Save Prices</button>
      </div>
      
      <div id="profit-data">Loading stats...</div>
    </div>
  `;

  const { data: orders } = await _supabase.from('orders').select('*').eq('status', 'finalized');

  let totalRev = 0;
  const productStats = {};

  orders.forEach(o => {
    totalRev += (o.total_amount || o.grand_total_final || 0);
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
    items.forEach(i => {
      if (!productStats[i.productId]) productStats[i.productId] = { name: i.name, revenue: 0, weight: 0 };
      productStats[i.productId].revenue += i.finalPrice || 0;
      productStats[i.productId].weight += i.actualWeight || 0;
    });
  });

  const profitDataEl = document.getElementById('profit-data');
  if (profitDataEl) {
    profitDataEl.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
        <div style="background:white; padding:12px; border-radius:8px; text-align:center; box-shadow:var(--shadow);">
          <div style="color:#666; font-size:12px;">Total Revenue</div>
          <div style="font-size:24px; font-weight:700; color:var(--primary);">₹${totalRev.toFixed(0)}</div>
        </div>
        <div style="background:white; padding:12px; border-radius:8px; text-align:center; box-shadow:var(--shadow);">
          <div style="color:#666; font-size:12px;">Orders</div>
          <div style="font-size:24px; font-weight:700;">${orders.length}</div>
        </div>
      </div>
      
      <div style="background:white; border-radius:12px; padding:16px;">
        <h4>Item Breakdown</h4>
        ${Object.values(productStats).map(p => `
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #f5f5f5; padding-bottom:8px;">
            <span>${p.name}</span>
            <span style="font-weight:600;">₹${p.revenue.toFixed(0)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
};

/**
 * Show price setter modal.
 */
window.showPriceSetter = async function () {
  const modal = document.getElementById('price-setter-modal');
  if (modal) modal.classList.remove('hidden');

  const container = document.getElementById('price-inputs');
  if (!container) return;

  const { data: products } = await _supabase.from('products').select('*').order('name');
  const current = JSON.parse(localStorage.getItem('fm_current_prices') || '{}');

  container.innerHTML = products.map(p => `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <label style="font-size:14px; flex:1;">${p.name}</label>
      <input type="number" id="pset-${p.id}" value="${current[p.id] || ''}" placeholder="Price" style="width:80px; padding:6px; border:1px solid #ddd; border-radius:6px;">
    </div>
  `).join('');
};

/**
 * Save current prices.
 */
window.saveCurrentPrices = async function () {
  const inputs = document.querySelectorAll('[id^=pset-]');
  const prices = {};
  inputs.forEach(inp => {
    // Extract product ID using slice to handle UUIDs with dashes
    const prefix = 'pset-';
    const id = inp.id.slice(prefix.length);
    if (inp.value) prices[id] = inp.value;
  });

  console.log('Saving prices for products:', Object.keys(prices));

  localStorage.setItem('fm_current_prices', JSON.stringify(prices));
  localStorage.setItem('fm_prices_updated', new Date().toLocaleString());

  await _supabase.from('app_settings').upsert({
    key: 'current_prices',
    value: JSON.stringify(prices)
  }, { onConflict: 'key' });

  const modal = document.getElementById('price-setter-modal');
  if (modal) modal.classList.add('hidden');

  renderProfitReport();
  alert('Prices Saved!');
};

// Start App when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
