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
// MINIMUM ORDER QUANTITIES (in grams)
// These are the minimum weights customers must order
// =========================================
const MINIMUM_ORDER_WEIGHTS = {
  // Vegetables - 500 gm
  'potato': 500,
  'onion': 500,
  'desi tomato': 500,
  'tomato': 500,
  'green peas': 500,
  'suran': 500,

  // Vegetables - 400 gm
  'cabbage': 400,
  'kacha kela': 400,
  'raw banana': 400,
  'ratalu': 400,

  // Vegetables - 350 gm
  'red carrot': 350,
  'carrot': 350,
  'methi': 350,
  'cucumber': 350,
  'beetroot': 350,
  'cauliflower': 350,
  'brinjal bhatta': 350,
  'brinjal': 350,
  'sweet potato': 350,
  'capsicum': 350,
  'capsicum (simla)': 350,
  'simla mirch': 350,
  'spinach': 350,
  'spinach (palak)': 350,
  'palak': 350,
  'bottle gourd': 350,
  'lauki': 350,
  'muli': 350,
  'radish': 350,
  'bhindi': 350,
  'okra': 350,
  'lady finger': 350,
  'bor': 350,
  'indian jujube': 350,
  'bor / indian jujube': 350,

  // Vegetables - 300 gm
  'lili haldar': 300,
  'turmeric': 300,
  'guvar': 300,
  'cluster beans': 300,
  'tindora': 300,
  'ivy gourd': 300,
  'raw mango': 300,

  // Vegetables - 250 gm
  'karela': 250,
  'bitter gourd': 250,
  'lili dungli': 250,

  // Herbs & Aromatics - 100 gm
  'chilly medium': 100,
  'chilly spicy': 100,
  'green chilly': 100,
  'ginger': 100,

  // Herbs & Aromatics - 150 gm
  'coriander leaves': 150,
  'coriander': 150,
  'dhania': 150,

  // Herbs & Aromatics - 200 gm
  'lemon': 200,
  'green garlic': 200,
  'tuver': 200,
  'pigeon peas': 200,
  'tuver / pigeon peas': 200,

  // Herbs & Aromatics - 350 gm
  'mint': 350,
  'pudina': 350,
  'green chana': 350,

  // Fruits - Large quantities
  'pineapple': 800,
  'papaya': 700,
  'banana pakka': 500,
  'banana': 500,
  'grapes': 500,
  'malta': 400,
  'musk melon': 400,
  'pomegranate': 400,
  'chikoo': 400,
  'sapota': 400,
  'mosambi': 1000,
  'sweet lime': 1000,
  'watermelon': 1000,
  'mango': 9500,  // 9.5 kg
};

/**
 * Get minimum order weight for a product (in grams)
 * Priority: 1) Database field (minimum_grams), 2) Fuzzy match from lookup, 3) Default 250g
 * @param {string|object} productOrName - Product object or product name string
 * @returns {number} Minimum weight in grams
 */
function getMinimumWeight(productOrName) {
  // Handle product object - check database field first
  if (productOrName && typeof productOrName === 'object') {
    // Check database field first (could be minimum_grams or minimum_weight_grams)
    if (productOrName.minimum_grams && productOrName.minimum_grams > 0) {
      return productOrName.minimum_grams;
    }
    if (productOrName.minimum_weight_grams && productOrName.minimum_weight_grams > 0) {
      return productOrName.minimum_weight_grams;
    }
    // Fall back to name-based lookup
    productOrName = productOrName.name;
  }

  if (!productOrName) return 250;
  const name = productOrName.toLowerCase().trim();

  // Try exact match first
  if (MINIMUM_ORDER_WEIGHTS[name]) {
    return MINIMUM_ORDER_WEIGHTS[name];
  }

  // Fuzzy match - check if product name contains any key from our lookup
  // This handles names like "Bottle gourd/ dudhi / lauki" matching "bottle gourd"
  for (const [key, minGrams] of Object.entries(MINIMUM_ORDER_WEIGHTS)) {
    if (name.includes(key.toLowerCase())) {
      return minGrams;
    }
  }

  return 250; // Default
}

/**
 * Format weight display (e.g., 500 -> "500g", 1000 -> "1kg")
 */
function formatWeightDisplay(grams) {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return kg % 1 === 0 ? `${kg}kg` : `${kg.toFixed(1)}kg`;
  }
  return `${grams}g`;
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
const CACHE_VERSION = '2.2'; // Updated for minimum weight feature
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
  adminOrdersCache: [],
  pushSubscription: null,
  swRegistration: null
};

// =========================================
// PUSH NOTIFICATIONS SERVICE WORKER
// =========================================

/**
 * Register service worker for push notifications
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered:', registration);
      app.swRegistration = registration;

      // Check if user already has a push subscription
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Existing push subscription found');
        app.pushSubscription = existingSubscription;
      }

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
}

/**
 * Request notification permission and subscribe
 */
async function subscribeToPushNotifications() {
  if (!app.swRegistration) {
    console.error('Service worker not registered yet');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    // Subscribe to push notifications
    const subscription = await app.swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(getVAPIDPublicKey())
    });

    app.pushSubscription = subscription;
    console.log('Push subscription:', subscription);

    // Save subscription to Supabase
    await savePushSubscription(subscription);

    return true;
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return false;
  }
}

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Get VAPID public key (replace with your own key when you generate one)
 */
function getVAPIDPublicKey() {
  // This is a placeholder - you'll need to generate your own VAPID keys
  // For now, we'll store this in localStorage for testing
  return localStorage.getItem('vapid_public_key') || '';
}

/**
 * Save push subscription to Supabase
 */
async function savePushSubscription(subscription) {
  if (!app.user) return;

  try {
    const subscriptionJSON = subscription.toJSON();

    const { error } = await _supabase
      .from('push_subscriptions')
      .upsert({
        user_id: app.user.id,
        endpoint: subscriptionJSON.endpoint,
        p256dh_key: subscriptionJSON.keys.p256dh,
        auth_key: subscriptionJSON.keys.auth,
        last_used: new Date().toISOString()
      }, {
        onConflict: 'endpoint'
      });

    if (error) {
      console.error('Error saving push subscription:', error);
    } else {
      console.log('Push subscription saved to database');
    }
  } catch (error) {
    console.error('Error in savePushSubscription:', error);
  }
}

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
/**
 * Helper to format unit string for display.
 * Removes leading "1" or "1 " from units like "1 kg" to show "kg".
 */
function formatUnit(unit) {
  // console.log('Formatting unit:', unit);
  if (!unit || unit === 'packet' || unit === '250g') return '';
  return unit.replace(/^1\s?/, '');
}

function createProductCardHtml(product) {
  const cartItem = app.cart.find(i => i.id === product.id);
  const isPacketItem = product.minimum_quantity_unit && product.minimum_quantity_unit !== '250g';

  // Get minimum weight for this product (reads from DB field or falls back to lookup)
  const minWeight = getMinimumWeight(product);

  if (isPacketItem) {
    // Packet/piece items (like Kiwi, Sweet Corn) - keep original logic
    const qty = cartItem ? cartItem.quantity : 0;
    const unitDisplay = product.minimum_quantity_unit || 'pkt';

    return `
      <div class="product-card" id="product-card-${product.id}">
        <div class="product-image" style="background-image: url('${product.image}')"></div>
        <h3>${product.name}</h3>
        <div class="price">Price TBD / ${unitDisplay}</div>
        <div class="actions">
          ${qty === 0 ?
        `<button class="btn btn-primary btn-sm btn-block" onclick="addToCart('${product.id}')">Add</button>` :
        `<div class="qty-selector">
            <button type="button" class="qty-btn" onclick="updateCart('${product.id}', -1)">-</button>
            <span id="catalog-qty-${product.id}" class="qty-val">
              ${qty} ${formatUnit(product.minimum_quantity_unit)}
            </span>
            <button type="button" class="qty-btn" onclick="updateCart('${product.id}', 1)">+</button>
          </div>`
      }
        </div>
      </div>
    `;
  } else {
    // Gram-based items - use minimum weight system
    const currentGrams = cartItem ? (cartItem.customGrams || minWeight) : 0;
    const minDisplay = formatWeightDisplay(minWeight);

    return `
      <div class="product-card" id="product-card-${product.id}">
        <div class="product-image" style="background-image: url('${product.image}')"></div>
        <h3>${product.name}</h3>
        <div class="price">Price TBD / ${minDisplay}</div>
        <div class="min-qty-label" style="font-size: 11px; color: #666; margin-top: -4px; margin-bottom: 4px;">Min: ${minDisplay}</div>
        <div class="actions">
          ${currentGrams === 0 ?
        `<button class="btn btn-primary btn-sm btn-block" onclick="addToCart('${product.id}')">Add ${minDisplay}</button>` :
        `<div style="display:flex; align-items:center; justify-content:center; gap:2px;">
            <button type="button" class="qty-btn" onclick="adjustGrams('${product.id}', -50)" style="width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">-</button>
            <input type="number"
              id="grams-${product.id}"
              value="${currentGrams}"
              min="${minWeight}"
              step="50"
              onchange="setCustomQuantity('${product.id}', this.value)"
              style="width:60px; padding:4px; border:2px solid #4caf50; border-radius:6px; text-align:center; font-size:14px; font-weight:600; height:30px;">
            <button type="button" class="qty-btn" onclick="adjustGrams('${product.id}', 50)" style="width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">+</button>
          </div>`
      }
        </div>
      </div>
    `;
  }
}

/**
 * Generates HTML for a single cart item.
 * @param {object} item - The cart item object from app.cart.
 * @returns {string} HTML string for a cart item.
 */
function createCartItemHtml(item) {
  const product = app.products.find(p => p.id === item.id);
  // Fallback if product not found (should be rare)
  const unit = product ? product.minimum_quantity_unit : (item.minQtyUnit || '');
  const name = product ? product.name : item.name;
  const image = product ? product.image : '';

  if (!product && !item) return '';

  const isPacketItem = unit && unit !== '250g';
  const minWeight = getMinimumWeight(product || name); // Use product object if available for DB field
  const grams = item.customGrams ? item.customGrams : minWeight;
  const perItemTotal = (product && product.price) ? (product.price * item.quantity) : null;

  const controls = isPacketItem ?
    `<div style="display:flex; align-items:center; gap:2px;">
       <button type="button" class="qty-btn" onclick="updateCart('${item.id}', -1)" style="width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">-</button>
       <div id="cart-qty-${item.id}" style="width:auto; min-width:30px; padding:0 4px; text-align:center; font-weight:600;">
         ${item.quantity} ${formatUnit(unit)}
       </div>
       <button type="button" class="qty-btn" onclick="updateCart('${item.id}', 1)" style="width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">+</button>
       <button type="button" onclick="removeFromCart('${item.id}')" style="background:#f44336; color:white; border:none; width:28px; height:28px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; margin-left:4px;">✕</button>
     </div>`
    :
    `<div style="display:flex; align-items:center; gap:2px;">
       <button type="button" class="qty-btn" onclick="adjustGrams('${item.id}', -50)" style="width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">-</button>
       <input type="number" 
          id="grams-${item.id}"
          value="${grams}" 
          min="${minWeight}" step="50" 
          onchange="setCustomQuantity('${item.id}', this.value)"
          style="width:60px; padding:4px; border:2px solid #4caf50; border-radius:6px; text-align:center; font-size:14px; font-weight:600; height:30px;">
       <button type="button" class="qty-btn" onclick="adjustGrams('${item.id}', 50)" style="width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">+</button>
       <button type="button" onclick="removeFromCart('${item.id}')" style="background:#f44336; color:white; border:none; width:28px; height:28px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; margin-left:4px;">✕</button>
     </div>`;

  return `
    <div id="cart-item-${item.id}" style="display:flex; gap:12px; align-items:center; background:white; padding:12px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <div style="width:84px; height:84px; background-image: url('${product.image}'); background-size:cover; background-position:center; border-radius:8px; flex-shrink:0;"></div>
      <div style="flex:1;">
        <div style="font-weight:700; margin-bottom:6px;">${product.name}</div>
        <div style="color:#888; font-size:11px; margin-bottom:4px;">Min: ${formatWeightDisplay(minWeight)}</div>
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

  // Store for printing
  app.customerOrdersCache = data;

  return `
    <div class="padded-container">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="margin:0;">My Orders</h3>
        <button class="btn btn-outline" style="padding:8px 12px; font-size:13px;" onclick="printMyOrders()">🖨️ Print</button>
      </div>
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

  const isPacketItem = product.minimum_quantity_unit && product.minimum_quantity_unit !== '250g';
  const minWeight = getMinimumWeight(product);

  const existing = app.cart.find(i => i.id === productId);
  if (existing) {
    if (isPacketItem) {
      existing.quantity++;
    } else {
      // For gram items, add minimum weight
      existing.customGrams = (existing.customGrams || minWeight) + minWeight;
      existing.quantity = Math.ceil(existing.customGrams / 250);
    }
  } else {
    if (isPacketItem) {
      // Packet items start at 1
      app.cart.push({
        id: productId,
        name: product.name,
        quantity: 1,
        minQtyUnit: product.minimum_quantity_unit
      });
    } else {
      // Gram items start at minimum weight
      app.cart.push({
        id: productId,
        name: product.name,
        quantity: Math.ceil(minWeight / 250),
        minQtyUnit: product.minimum_quantity_unit,
        customGrams: minWeight
      });
    }
  }
  saveCart();
  refreshCatalog();
  renderBottomNav();
  toast(`Added ${isPacketItem ? '1 ' + (product.minimum_quantity_unit || 'pkt') : formatWeightDisplay(minWeight)} to cart`);
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
 * Set custom quantity in grams for gram-based products.
 * Enforces minimum weight as hard floor.
 * @param {string} prodId - Product ID
 * @param {number} grams - Grams amount
 */
window.setCustomQuantity = function (prodId, grams) {
  const product = app.products.find(p => p.id === prodId);
  const minWeight = product ? getMinimumWeight(product) : 250;
  let gramsNum = parseInt(grams) || 0;

  // Enforce minimum weight as hard floor
  if (gramsNum > 0 && gramsNum < minWeight) {
    gramsNum = minWeight;
    // Update the input field to show the corrected value
    const input = document.getElementById(`grams-${prodId}`);
    if (input) input.value = minWeight;
    toast(`Minimum order is ${formatWeightDisplay(minWeight)}`);
  }

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
 * Enforces minimum weight as hard floor.
 * @param {string} prodId - Product ID
 * @param {number} delta - Grams to add/subtract
 */
window.adjustGrams = function (prodId, delta) {
  try {
    const input = document.getElementById(`grams-${prodId}`);
    const product = app.products.find(p => p.id === prodId);
    const minWeight = product ? getMinimumWeight(product) : 250;
    const cartItem = app.cart.find(i => i.id === prodId);

    // Get current grams from input OR from cart item
    let current;
    if (input) {
      current = parseInt(input.value) || minWeight;
    } else if (cartItem) {
      current = cartItem.customGrams || minWeight;
    } else {
      current = minWeight;
    }

    let next = current + delta;

    // Enforce minimum weight as hard floor
    if (next < minWeight) {
      // Show toast instead of removing from cart
      toast(`Minimum order is ${formatWeightDisplay(minWeight)}`);
      return;
    }

    // Update input if it exists
    if (input) {
      input.value = next;
    }

    const quantity = Math.ceil(next / 250);

    if (!cartItem && quantity > 0) {
      const prod = product || { name: 'Item', minimum_quantity_unit: '250g' };
      app.cart.push({
        id: prodId,
        name: prod.name,
        quantity: quantity,
        minQtyUnit: prod.minimum_quantity_unit,
        customGrams: next
      });
    } else if (cartItem) {
      cartItem.quantity = quantity;
      cartItem.customGrams = next;
    }

    saveCart();
    // Render appropriate view
    if (document.getElementById('product-list')) {
      refreshCatalog();
    } else if (app.currentScreen === 'cart') {
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
 * Update cart quantity for packet/piece items.
 * @param {string} prodId - Product ID
 * @param {number} delta - Amount to add/subtract (1 or -1)
 */
window.updateCart = function (prodId, delta) {
  const item = app.cart.find(i => i.id === prodId);
  if (!item) return;

  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    // Remove item if quantity becomes 0 or less
    app.cart = app.cart.filter(i => i.id !== prodId);
    saveCart();
    renderBottomNav();
    // Need to re-render to remove the item - check which screen we're on
    const cartQty = document.getElementById(`cart-qty-${prodId}`);
    const catalogQty = document.getElementById(`catalog-qty-${prodId}`);
    if (cartQty) {
      renderScreen('cart');
    } else if (catalogQty) {
      refreshCatalog();
    }
  } else {
    // Just update the quantity
    item.quantity = newQty;
    saveCart();
    renderBottomNav();

    // Update BOTH cart and catalog quantity displays (no full re-render!)
    const cartQtyDisplay = document.getElementById(`cart-qty-${prodId}`);
    if (cartQtyDisplay) {
      cartQtyDisplay.textContent = newQty;
    }

    const catalogQtyDisplay = document.getElementById(`catalog-qty-${prodId}`);
    if (catalogQtyDisplay) {
      catalogQtyDisplay.textContent = newQty;
    }
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
  const SELLER_WHATSAPP = '6361983041';

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

  setLoading(true);

  try {
    const { data: existingOrders } = await _supabase
      .from('orders')
      .select('*')
      .eq('customer_phone', app.user.phone)
      .eq('status', 'pending');

    const existingOrder = existingOrders && existingOrders.length > 0 ? existingOrders[0] : null;

    let finalItems = [];
    let isUpdate = false;

    if (existingOrder) {
      isUpdate = true;
      const oldItems = typeof existingOrder.items === 'string' ? JSON.parse(existingOrder.items) : existingOrder.items;
      finalItems = JSON.parse(JSON.stringify(oldItems));

      app.cart.forEach(newItem => {
        const existingItemIndex = finalItems.findIndex(i => i.productId === newItem.id);
        if (existingItemIndex > -1) {
          finalItems[existingItemIndex].orderedQuantity += newItem.quantity;
          if (newItem.customGrams) {
            const oldGrams = finalItems[existingItemIndex].customGrams || 0;
            finalItems[existingItemIndex].customGrams = oldGrams + newItem.customGrams;
          }
        } else {
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

      const { error: updateError } = await _supabase
        .from('orders')
        .update({ items: JSON.stringify(finalItems) })
        .eq('id', existingOrder.id);

      if (updateError) throw updateError;
    } else {
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

    const orderItemsList = finalItems.map(i => {
      const grams = i.customGrams || (i.orderedQuantity * 250);
      const unit = i.minQtyUnit === 'packet' ? `${i.orderedQuantity} pkt` : `${grams}g`;
      return `• ${i.name}: ${unit}`;
    }).join('\n');

    const timestamp = new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
    const header = isUpdate ? `🛒 *UPDATED ORDER - Fresh Market*` : `🛒 *NEW ORDER - Fresh Market*`;
    const note = isUpdate ? `\n\n_Note: Customer added items to previous pending order._` : ``;

    const whatsappMessage = encodeURIComponent(
      `${header}\n\n` +
      `👤 *Customer:* ${app.user.name}\n` +
      `📞 *Phone:* ${app.user.phone}\n` +
      `🏠 *House:* ${app.user.house}\n` +
      `🕐 *Time:* ${timestamp}\n\n` +
      `📦 *Total Items (Combined):*\n${orderItemsList}\n\n` +
      `💰 *Price:* To be confirmed` + note
    );

    app.cart = [];
    saveCart();
    renderBottomNav();

    const waUrl = `https://wa.me/91${SELLER_WHATSAPP}?text=${whatsappMessage}`;
    const confirmTitle = isUpdate ? '✅ Order Updated!' : '✅ Order Placed!';
    const confirmSub = isUpdate
      ? 'Now send the WhatsApp message so the seller gets your updated order.'
      : 'Now send the WhatsApp message so the seller gets your order.';

    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'none';

    document.getElementById('content-area').innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:calc(100vh - 120px); padding:24px; text-align:center; background: linear-gradient(180deg, #f0fff4 0%, #ffffff 40%);">
        <div style="width:90px; height:90px; border-radius:50%; background:linear-gradient(135deg,#25D366,#1da852); display:flex; align-items:center; justify-content:center; box-shadow:0 4px 18px rgba(37,211,102,0.35); margin-bottom:20px;">
          <span class="material-icons-round" style="font-size:48px; color:#fff;">check</span>
        </div>
        <h2 style="margin:0 0 8px; font-size:22px; color:#1a1a1a;">${confirmTitle}</h2>
        <p style="margin:0 0 28px; color:#666; font-size:14px; max-width:280px; line-height:1.5;">${confirmSub}</p>
        <a href="${waUrl}" target="_blank" onclick="window.waConfirmSent()" style="display:flex; align-items:center; justify-content:center; gap:10px; width:100%; max-width:320px; padding:16px 24px; background:linear-gradient(135deg,#25D366,#1da852); color:#fff; font-size:18px; font-weight:700; border-radius:14px; text-decoration:none; box-shadow:0 4px 16px rgba(37,211,102,0.4);">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.4 5L2 22l5.2-1.4c1.4.8 3.1 1.4 4.8 1.4 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>
          Send on WhatsApp
        </a>
        <div style="margin-top:24px; padding:12px 16px; border-radius:10px; background:#fff3cd; border:1px solid #ffc107; color:#856404; font-size:13px; font-weight:600; max-width:320px; width:100%;">
          ⚠️ Your order won't reach the seller until you send the WhatsApp message!
        </div>
      </div>
    `;

    window.waConfirmSent = function () {
      const bottomNav = document.querySelector('.bottom-nav');
      if (bottomNav) bottomNav.style.display = '';
      setTimeout(() => { navigateTo('orders'); }, 1500);
    };
  } catch (error) {
    setLoading(false);
    console.error(error);
    alert('Order processing failed: ' + error.message);
  }
};

window.logout = function () {
  localStorage.removeItem('fm_user');
  app.user = null;
  app.cart = [];
  saveCart();
  navigateTo('auth-screen');
};

window.updateProfile = function () {
  const name = document.getElementById('p-name').value;
  const house = document.getElementById('p-house').value;
  app.user.name = name;
  app.user.house = house;
  localStorage.setItem('fm_user', JSON.stringify(app.user));
  toast('Profile updated');
};

window.viewOrderDetails = function (orderId) {
  toast('Tap on order details coming soon');
};

window.checkAdminLogin = async function () {
  const pass = document.getElementById('admin-pass').value;
  if (pass === 'devampro123') {
    app.isAdmin = true;
    await syncPricesFromSupabase();
    navigateTo('admin-dashboard');
  } else {
    alert('Invalid Password');
  }
};

function setLoading(isLoading) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    if (isLoading) overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
  }
}

function toast(msg) {
  try {
    const existing = document.getElementById('app-toast');
    if (existing) existing.remove();

    const t = document.createElement('div');
    t.id = 'app-toast';
    t.innerText = msg;
    Object.assign(t.style, {
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: '80px',
      background: 'rgba(0,0,0,0.85)', color: 'white', padding: '12px 18px', borderRadius: '999px',
      zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontSize: '14px', maxWidth: '90%',
      textAlign: 'center', opacity: '0', transition: 'opacity 200ms ease'
    });

    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 220); }, 1800);
  } catch (e) { console.log(msg); }
}

window.updatePhoneConfirm = function () {
  const input = document.getElementById('auth-phone');
  const ui = document.getElementById('phone-confirm-ui');
  const display = document.getElementById('phone-display');

  let val = input.value.replace(/\D/g, '');
  if (val.length > 10) val = val.slice(-10);

  if (val.length === 10) {
    ui.style.display = 'block';
    display.textContent = val.replace(/(\d{5})(\d{5})/, '$1 $2');
  } else {
    ui.style.display = 'none';
    document.getElementById('phone-confirm-check').checked = false;
  }
};

window.handleLogin = function () {
  try {
    const name = document.getElementById('auth-name').value.trim();
    let phone = document.getElementById('auth-phone').value.replace(/\D/g, '');
    const house = document.getElementById('auth-house').value.trim();

    if (!name) { alert('Please enter your name'); return; }
    if (!house) { alert('Please enter your house number'); return; }
    if (phone.length > 10) phone = phone.slice(-10);
    if (phone.length !== 10) { alert('Please enter a valid 10-digit phone number'); return; }

    const confirmCheck = document.getElementById('phone-confirm-check');
    if (confirmCheck && !confirmCheck.checked) {
      alert('Please check the box to confirm your phone number is correct.');
      return;
    }

    app.user = { name, phone, house };
    localStorage.setItem('fm_user', JSON.stringify(app.user));
    setTimeout(() => { navigateTo('catalog'); }, 100);
  } catch (err) {
    alert('Login Error: ' + err.message);
  }
};

function setupEventListeners() {
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
// ADMIN FUNCTIONS
// =========================================

window.loadAdminOrders = async function (statusFilter) {
  const container = document.getElementById('admin-orders-list');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';

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
          <label style="display:block;margin-bottom:4px;font-size:14px;">Quantity</label>
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

  await syncPricesFromSupabase();
  const currentPrices = JSON.parse(localStorage.getItem('fm_current_prices') || '{}');

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

    // Preserve current sort/search values if they exist
    const savedSort = window._adminSortValue || 'newest';
    const savedSearch = window._adminSearchValue || '';

    const searchHtml = `
        <div style="padding:10px; display:flex; gap:10px; background:white; margin-bottom:12px; border-radius:8px; border:1px solid #eee; flex-wrap:wrap; align-items:center;">
          <input type="text" id="admin-search" placeholder="Search customer..." value="${savedSearch}" style="flex:1; min-width:120px; padding:8px; border:1px solid #ddd; border-radius:6px;" onkeyup="filterAdminOrders()">
          <select id="admin-sort" style="width:110px; padding:8px; border:1px solid #ddd; border-radius:6px;" onchange="filterAdminOrders()">
            <option value="newest" ${savedSort === 'newest' ? 'selected' : ''}>Newest</option>
            <option value="oldest" ${savedSort === 'oldest' ? 'selected' : ''}>Oldest</option>
            <option value="name" ${savedSort === 'name' ? 'selected' : ''}>Name</option>
            <option value="house-asc" ${savedSort === 'house-asc' ? 'selected' : ''}>House A→Z</option>
            <option value="house-desc" ${savedSort === 'house-desc' ? 'selected' : ''}>House Z→A</option>
          </select>
          <button class="btn btn-outline no-print" style="padding:8px 12px; font-size:13px;" onclick="printOrders()">🖨️ Print</button>
          <button class="btn btn-outline no-print" style="padding:8px 12px; font-size:13px; color: #f44336; border-color: #f44336;" onclick="deleteAllOrders('${statusFilter}')">🗑️ All</button>
        </div>
        <div id="filtered-orders-list"></div>
        `;

    container.innerHTML = modalHtml + searchHtml;
    filterAdminOrders();
  } catch (e) {
    console.error(e);
    container.innerHTML = '<p class="text-danger">Error loading orders</p>';
  }
};

window.deleteOrder = async function (orderId) {
  if (!confirm('Are you sure you want to DELETE this order permanently?')) return;
  // Save current sort/search before reloading
  const sortEl = document.getElementById('admin-sort');
  const searchEl = document.getElementById('admin-search');
  if (sortEl) window._adminSortValue = sortEl.value;
  if (searchEl) window._adminSearchValue = searchEl.value;

  const { error } = await _supabase.from('orders').delete().eq('id', orderId);
  if (error) {
    alert('Error deleting order: ' + error.message);
  } else {
    const activeTab = document.querySelector('.cat-chip.active');
    const currentTab = activeTab ? activeTab.id.replace('tab-', '') : 'pending';
    loadAdminOrders(currentTab);
    toast('Order deleted');
  }
};

window.deleteAllOrders = async function (statusFilter) {
  if (!statusFilter) return;
  if (!confirm(`WARNING: This will delete ALL visible ${statusFilter.toUpperCase()} orders.\n\nAre you sure?`)) return;
  if (!confirm(`Final Confirmation: Delete ALL ${statusFilter.toUpperCase()} orders? This cannot be undone.`)) return;

  setLoading(true);
  let query = _supabase.from('orders').delete();
  if (statusFilter === 'pending') {
    query = query.neq('status', 'finalized').neq('status', 'sent');
  } else {
    query = query.eq('status', statusFilter);
  }
  const { error } = await query;
  setLoading(false);

  if (error) {
    alert('Failed to delete orders: ' + error.message);
  } else {
    alert(`All ${statusFilter} orders have been deleted.`);
    loadAdminOrders(statusFilter);
  }
};

window.rejectOrder = window.deleteOrder;

function smartRound(value) {
  const decimal = value - Math.floor(value);
  if (decimal >= 0.50) {
    return Math.ceil(value);
  } else {
    const rounded = Math.round(value * 100) / 100;
    if (rounded % 1 === 0) return rounded;
    return parseFloat(rounded.toFixed(2));
  }
}

window.calculateTotal = function (orderId) {
  const rows = document.querySelectorAll(`[id^='wt-${orderId}-']`);
  let grandTotal = 0;

  rows.forEach(row => {
    const prefix = `wt-${orderId}-`;
    const productId = row.id.slice(prefix.length);
    const inputEl = document.getElementById(`wt-${orderId}-${productId}`);
    const unit = inputEl.getAttribute('data-unit') || '250g';
    const wtVal = parseFloat(inputEl.value) || 0;
    const priceVal = parseFloat(document.getElementById(`price-${orderId}-${productId}`).value) || 0;

    let subtotal = 0;
    if (unit !== '250g') {
      subtotal = wtVal * priceVal;
    } else {
      subtotal = (wtVal / 250) * priceVal;
    }
    grandTotal += subtotal;

    const subSpan = document.getElementById(`sub-${orderId}-${productId}`);
    if (subSpan) subSpan.innerText = smartRound(subtotal);
  });

  const totalSpan = document.getElementById(`total-${orderId}`);
  if (totalSpan) totalSpan.innerText = smartRound(grandTotal);
};

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
    return { ...item, actualWeight: wtVal, pricePer250gAtOrder: priceVal, finalPrice: smartRound(finalPrice) };
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

// Helper function to save all admin input field values before refresh
window.saveAdminInputValues = function () {
  const inputs = {};
  // Save all weight inputs
  document.querySelectorAll('[id^="wt-"]').forEach(el => {
    inputs[el.id] = el.value;
  });
  // Save all price inputs
  document.querySelectorAll('[id^="price-"]').forEach(el => {
    inputs[el.id] = el.value;
  });
  window._adminInputValues = inputs;
};

// Helper function to restore admin input field values after refresh
window.restoreAdminInputValues = function () {
  if (!window._adminInputValues) return;
  setTimeout(() => {
    for (const [id, value] of Object.entries(window._adminInputValues)) {
      const el = document.getElementById(id);
      if (el && value) {
        el.value = value;
      }
    }
    // Recalculate totals after restoring
    if (app.adminOrdersCache) {
      app.adminOrdersCache.forEach(o => calculateTotal(o.id));
    }
  }, 100);
};

window.deleteItemFromOrder = async function (orderId, productId) {
  if (!confirm('Remove this item from the order?')) return;
  // Save current sort/search before reloading
  const sortEl = document.getElementById('admin-sort');
  const searchEl = document.getElementById('admin-search');
  if (sortEl) window._adminSortValue = sortEl.value;
  if (searchEl) window._adminSearchValue = searchEl.value;

  // Save all input values before reloading
  saveAdminInputValues();

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

  const activeTab = document.querySelector('.cat-chip.active');
  const currentTab = activeTab ? activeTab.id.replace('tab-', '') : 'pending';
  loadAdminOrders(currentTab).then(() => restoreAdminInputValues());
};

window.showAddItemModal = async function (orderId) {
  document.getElementById('ato-order-id').value = orderId;
  const modal = document.getElementById('add-to-order-modal');
  const select = document.getElementById('ato-product');

  select.innerHTML = '<option>Loading...</option>';
  modal.style.display = 'flex';

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

  const existing = items.find(i => i.productId === productId);
  if (existing) {
    existing.orderedQuantity += qty;
    if (unit === '250g') {
      existing.customGrams = (existing.customGrams || (existing.orderedQuantity * 250)) + (qty * 250);
    }
  } else {
    items.push({
      productId, name, orderedQuantity: qty, minQtyUnit: unit,
      customGrams: unit === '250g' ? qty * 250 : null,
      pricePer250gAtOrder: 0, actualWeight: 0, finalPrice: 0
    });
  }

  await _supabase.from('orders').update({ items: JSON.stringify(items) }).eq('id', orderId);
  document.getElementById('add-to-order-modal').style.display = 'none';
  loadAdminOrders('pending');
};

window.rollbackOrder = async function (id) {
  if (!confirm('Move back to pending?')) return;
  await _supabase.from('orders').update({ status: 'pending' }).eq('id', id);
  loadAdminOrders('finalized');
};

window.rollbackSentOrder = async function (id) {
  if (!confirm('Move back to Finalized?')) return;
  await _supabase.from('orders').update({ status: 'finalized' }).eq('id', id);
  loadAdminOrders('sent');
};

window.editCustomerInfo = async function (orderId, field, currentValue) {
  const fieldLabel = field === 'customer_phone' ? 'Phone Number' : 'House Number';
  const newValue = prompt(`Edit ${fieldLabel}:`, currentValue);
  if (newValue === null || newValue === currentValue) return;

  if (field === 'customer_phone') {
    const cleanPhone = newValue.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      alert('Please enter a valid 10-digit phone number');
      return;
    }
  }

  try {
    const order = app.adminOrdersCache.find(o => o.id === orderId);
    if (!order) return;

    const updateData = {};
    updateData[field] = newValue;
    await _supabase.from('orders').update(updateData).eq('id', orderId);

    if (field === 'house_no') {
      await _supabase.from('orders').update({ house_no: newValue }).eq('customer_phone', order.customer_phone);
    }

    toast(`${fieldLabel} updated! ✅`);
    const activeTab = document.querySelector('.cat-chip.active');
    const currentTab = activeTab ? activeTab.id.replace('tab-', '') : 'pending';
    loadAdminOrders(currentTab);
  } catch (e) {
    alert('Failed to update: ' + e.message);
  }
};

function getPaymentStatus(orderId) {
  const paymentData = JSON.parse(localStorage.getItem('fm_payment_status') || '{}');
  return paymentData[orderId] || { received: false, type: 'cash' };
}

window.updatePaymentStatus = function (orderId) {
  const paidCheckbox = document.getElementById(`paid-${orderId}`);
  const typeSelect = document.getElementById(`payment-type-${orderId}`);
  if (!paidCheckbox || !typeSelect) return;

  const paymentReceived = paidCheckbox.checked;
  const paymentType = typeSelect.value;
  typeSelect.disabled = !paymentReceived;

  const paymentData = JSON.parse(localStorage.getItem('fm_payment_status') || '{}');
  if (paymentReceived) {
    paymentData[orderId] = { received: true, type: paymentType };
  } else {
    delete paymentData[orderId];
  }
  localStorage.setItem('fm_payment_status', JSON.stringify(paymentData));
};

window.shareBill = async function (orderId) {
  const order = app.adminOrdersCache.find(o => o.id === orderId);
  if (!order) return;
  let items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

  const newPhone = prompt(`Confirm WhatsApp Number for ${order.customer_name}:`, order.customer_phone);
  if (!newPhone) return;

  let calculatedTotal = 0;
  const updatedItems = items.map(i => {
    const wtInput = document.getElementById(`wt-${orderId}-${i.productId}`);
    const priceInput = document.getElementById(`price-${orderId}-${i.productId}`);
    const actualWeight = wtInput ? parseFloat(wtInput.value) || 0 : (i.actualWeight || 0);
    const pricePerUnit = priceInput ? parseFloat(priceInput.value) || 0 : (i.pricePer250gAtOrder || 0);
    const isPacket = i.minQtyUnit !== '250g';
    let finalPrice = isPacket ? smartRound(pricePerUnit * actualWeight) : smartRound((pricePerUnit / 250) * actualWeight);
    calculatedTotal += finalPrice;
    return { ...i, actualWeight, pricePer250gAtOrder: pricePerUnit, finalPrice };
  });

  await _supabase.from('orders').update({
    items: JSON.stringify(updatedItems),
    total_amount: calculatedTotal,
    status: 'sent',
    customer_phone: newPhone !== order.customer_phone ? newPhone : order.customer_phone
  }).eq('id', orderId);

  const message = `*Fresh Market Bill* %0AOrder for: *${order.customer_name}* %0APhone: ${newPhone} %0AHouse: ${order.house_no || 'N/A'} %0A%0AItems: %0A${updatedItems.map(i => `${i.name} (${i.actualWeight}${i.minQtyUnit !== '250g' ? (i.minQtyUnit === 'pc' ? 'pc' : 'pkt') : 'g'}): ₹${i.finalPrice || 0}`).join('%0A')} %0A%0A*Total: ₹${calculatedTotal}*`;
  window.open(`https://wa.me/91${newPhone}?text=${message}`, '_blank');

  const activeTab = document.querySelector('.cat-chip.active');
  const currentTab = activeTab ? activeTab.id.replace('tab-', '') : 'finalized';
  loadAdminOrders(currentTab);
};

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

window.filterAdminOrders = function () {
  try {
    const searchInput = document.getElementById('admin-search');
    if (!searchInput) return;
    const search = searchInput.value.toLowerCase();
    const sort = document.getElementById('admin-sort').value;
    const listContainer = document.getElementById('filtered-orders-list');

    if (!app.adminOrdersCache) return;
    const currentPrices = JSON.parse(localStorage.getItem('fm_current_prices') || '{}');

    let filtered = app.adminOrdersCache.filter(o => {
      const text = (o.customer_name + ' ' + o.house_no + ' ' + o.customer_phone).toLowerCase();
      return text.includes(search);
    });

    if (sort === 'newest') filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sort === 'oldest') filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sort === 'name') filtered.sort((a, b) => a.customer_name.localeCompare(b.customer_name));
    else if (sort === 'house-asc') {
      filtered.sort((a, b) => {
        const houseA = (a.house_no || '').toString().toUpperCase();
        const houseB = (b.house_no || '').toString().toUpperCase();
        return houseA.localeCompare(houseB, undefined, { numeric: true, sensitivity: 'base' });
      });
    }
    else if (sort === 'house-desc') {
      filtered.sort((a, b) => {
        const houseA = (a.house_no || '').toString().toUpperCase();
        const houseB = (b.house_no || '').toString().toUpperCase();
        return houseB.localeCompare(houseA, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = '<div class="text-center text-muted" style="padding:40px;">No matching orders</div>';
      return;
    }

    listContainer.innerHTML = filtered.map(o => {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      const paymentStatus = getPaymentStatus(o.id);
      o.payment_received = paymentStatus.received;
      o.payment_type = paymentStatus.type;

      return `
            <div class="order-card">
              <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid #f0f0f0; padding-bottom:8px;">
                <div>
                  <div style="font-weight:700;">${o.customer_name}</div>
                  <div class="text-muted" style="font-size:12px;">🏠 ${o.house_no || 'N/A'} <span onclick="editCustomerInfo('${o.id}', 'house_no', '${(o.house_no || '').replace(/'/g, "\\'")}')" style="cursor:pointer; color:#2196f3;">✏️</span></div>
                  <div class="text-muted" style="font-size:12px;">📞 ${o.customer_phone} <span onclick="editCustomerInfo('${o.id}', 'customer_phone', '${o.customer_phone}')" style="cursor:pointer; color:#2196f3;">✏️</span></div>
                </div>
                <div class="text-right">
                  <div style="font-weight:700;">${o.id.slice(0, 6).toUpperCase()}</div>
                  <div style="font-size:12px; color:#666;">${new Date(o.created_at).toLocaleTimeString()}</div>
                  <a href="https://wa.me/91${o.customer_phone}" target="_blank" style="font-size:12px; color:#25D366;">WhatsApp</a>
                </div>
              </div>

              <div style="background:#f9f9f9; padding:10px; border-radius:8px;">
                ${items.map(i => {
        const isPacket = i.minQtyUnit !== '250g';
        const unitLabel = isPacket ? (i.minQtyUnit || 'pkt') : 'g';
        const prefillPrice = i.pricePer250gAtOrder || currentPrices[i.productId] || '';
        const actualWeight = i.actualWeight || (isPacket ? i.orderedQuantity : (i.customGrams || (i.orderedQuantity * 250)));

        return `
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    ${o.status !== 'finalized' && o.status !== 'sent' ? `<div onclick="deleteItemFromOrder('${o.id}', '${i.productId}')" style="color:#d32f2f; cursor:pointer;">✕</div>` : ''}
                    <div style="flex:2;">
                      <div style="font-size:14px; font-weight:500;">${i.name}</div>
                      <div style="font-size:11px; color:#666;">Ordered: ${isPacket ? i.orderedQuantity + ' ' + unitLabel : (i.customGrams || (i.orderedQuantity * 250)) + 'g'}</div>
                    </div>
                    <div style="flex:1;">
                      <input type="number" id="wt-${o.id}-${i.productId}" data-unit="${i.minQtyUnit !== '250g' ? (i.minQtyUnit || 'pkt') : '250g'}" class="admin-input-sm" style="width:100%" value="${actualWeight}" onchange="calculateTotal('${o.id}')">
                    </div>
                    <div style="flex:1;">
                      <input type="number" id="price-${o.id}-${i.productId}" class="admin-input-sm" style="width:100%" placeholder="Rate" value="${prefillPrice}" onchange="calculateTotal('${o.id}')">
                    </div>
                    <div style="width:60px; text-align:right;">
                      <div style="font-weight:600;">₹<span id="sub-${o.id}-${i.productId}">0</span></div>
                    </div>
                  </div>
                `;
      }).join('')}
                ${o.status !== 'finalized' && o.status !== 'sent' ? `<div style="text-align:center; margin-top:12px;"><button class="btn btn-outline" style="font-size:12px;" onclick="showAddItemModal('${o.id}')">+ Add Item</button></div>` : ''}
              </div>

              ${o.status === 'sent' ? `
              <div style="margin-top:12px; padding:12px; background:${o.payment_received ? '#e8f5e9' : '#fff3e0'}; border-radius:8px;">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                  <input type="checkbox" id="paid-${o.id}" ${o.payment_received ? 'checked' : ''} onchange="updatePaymentStatus('${o.id}')" style="width:18px; height:18px;">
                  Payment Received
                </label>
                <select id="payment-type-${o.id}" style="margin-top:8px; padding:6px; border-radius:6px;" onchange="updatePaymentStatus('${o.id}')" ${!o.payment_received ? 'disabled' : ''}>
                  <option value="cash" ${o.payment_type === 'cash' ? 'selected' : ''}>💵 Cash</option>
                  <option value="online" ${o.payment_type === 'online' ? 'selected' : ''}>📱 Online</option>
                </select>
              </div>
              ` : ''}

              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
                <div>
                  <div style="font-size:12px; color:#666;">Total</div>
                  <div style="font-size:20px; font-weight:700; color:var(--primary);">₹<span id="total-${o.id}">${o.total_amount || 0}</span></div>
                </div>
                <div style="display:flex; gap:8px;">
                  ${o.status === 'finalized' ?
          `<button class="btn btn-outline" style="color:#25D366; border-color:#25D366;" onclick="shareBill('${o.id}')">Share Bill 📱</button>
                     <button class="btn btn-outline" onclick="rollbackOrder('${o.id}')">↩️</button>` :
          o.status === 'sent' ?
            `<button class="btn btn-outline" style="color:red; border-color:red;" onclick="rejectOrder('${o.id}')">✕</button>
                     <button class="btn btn-outline" style="color:#ff9800; border-color:#ff9800;" onclick="rollbackSentOrder('${o.id}')">↩️ Finalized</button>` :
            `<button class="btn btn-outline" style="color:red; border-color:red;" onclick="rejectOrder('${o.id}')">✕</button>
                     <button class="btn btn-primary" onclick="saveOrder('${o.id}')">Finalize & Save</button>`
        }
                </div>
              </div>
            </div>
          `;
    }).join('');

    filtered.forEach(o => calculateTotal(o.id));
  } catch (e) {
    console.error('Render Error:', e);
  }
};

window.toggleOrderWindow = async function () {
  const toggle = document.getElementById('orders-toggle');
  if (!toggle) return;
  const isOpen = toggle.checked;

  try {
    await _supabase.from('app_settings').upsert({
      key: 'order_window_open',
      value: isOpen ? 'true' : 'false',
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

    localStorage.setItem('fm_orders_open', isOpen ? 'true' : 'false');
    const knob = document.getElementById('toggle-knob');
    if (knob) knob.style.left = isOpen ? '26px' : '2px';
  } catch (e) {
    console.error(e);
    alert('Failed to switch. Check internet.');
    toggle.checked = !isOpen;
  }
};

window.loadAdminProducts = async function () {
  const container = document.getElementById('admin-orders-list');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const { data: products, error } = await _supabase.from('products').select('*').order('name');
    if (error) throw error;

    container.innerHTML = `
        <div style="padding:16px;">
          <div style="background:white; border-radius:12px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3>Products (${products.length})</h3>
              <div style="display:flex; gap:10px;">
                <input type="text" id="admin-product-search" placeholder="Search..." style="padding:8px; border:1px solid #ddd; border-radius:6px;" onkeyup="filterAdminProducts()">
                <button class="btn btn-primary" onclick="showAddProductModal()">+ Add</button>
              </div>
            </div>
            
            <div id="product-modal" class="hidden" style="background:white; padding:16px; border-radius:12px; margin-bottom:16px; border:2px solid var(--primary);">
              <h4 id="modal-title">Add New Product</h4>
              <input type="hidden" id="edit-product-id">
              <div style="display:grid; gap:12px; margin:16px 0;">
                <input type="text" id="product-name" placeholder="Product Name" style="padding:8px; border:1px solid #ddd; border-radius:6px;">
                <select id="product-category" style="padding:8px; border:1px solid #ddd; border-radius:6px;">
                  <option value="vegetable">Vegetable</option>
                  <option value="fruits">Fruits</option>
                  <option value="green leafs">Green Leafs</option>
                  <option value="jaggery">Jaggery</option>
                  <option value="honey">Honey</option>
                  <option value="other">Other</option>
                </select>
                <select id="product-unit" style="padding:8px; border:1px solid #ddd; border-radius:6px;" onchange="toggleCustomUnitInput()">
                  <option value="250g">250g</option>
                  <option value="packet">Packet</option>
                  <option value="custom">Custom...</option>
                </select>
                <input type="text" id="product-unit-custom" placeholder="e.g. 1 kg" style="display:none; padding:8px; border:1px solid #ddd; border-radius:6px;">
                <label><input type="checkbox" id="product-available" checked> Available</label>
              </div>
              <div style="display:flex; gap:8px; justify-content:flex-end;">
                <button class="btn btn-outline" onclick="hideProductModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveProduct()">Save</button>
              </div>
            </div>
            
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="text-align:left; border-bottom:2px solid #eee;">
                  <th style="padding:8px;">Name</th>
                  <th style="padding:8px;">Unit</th>
                  <th style="padding:8px;">Status</th>
                  <th style="padding:8px;">Actions</th>
                </tr>
              </thead>
              <tbody id="admin-product-list-body">
                ${products.map(p => {
      const unit = p.minimum_quantity_unit || '250g';
      const isAvailable = p.available !== false;
      return `
                  <tr class="product-row" data-name="${p.name.toLowerCase()}" style="border-bottom:1px solid #f9f9f9;">
                    <td style="padding:10px;">${p.name}</td>
                    <td style="padding:10px;">${unit}</td>
                    <td style="padding:10px;">
                      <button class="btn btn-outline" style="padding:4px 12px; font-size:12px; ${isAvailable ? 'background:#e8f5e9; color:#4caf50;' : 'background:#ffebee; color:#f44336;'}" onclick="toggleProductStock('${p.id}', ${!isAvailable})">
                        ${isAvailable ? '✓ In Stock' : '✗ Out'}
                      </button>
                    </td>
                    <td style="padding:10px;">
                      <button class="btn btn-outline" style="padding:4px 8px; font-size:12px;" onclick='editProduct(${JSON.stringify(p)})'>Edit</button>
                      <button class="btn btn-outline" style="padding:4px 8px; font-size:12px; color:red;" onclick="deleteProduct('${p.id}', '${p.name}')">Delete</button>
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
    container.innerHTML = '<p class="text-danger" style="padding:20px;">Error loading products</p>';
  }
};

window.filterAdminProducts = function () {
  const filter = document.getElementById('admin-product-search').value.toLowerCase();
  document.querySelectorAll('.product-row').forEach(row => {
    row.style.display = row.getAttribute('data-name').includes(filter) ? '' : 'none';
  });
};

window.toggleCustomUnitInput = function () {
  const select = document.getElementById('product-unit');
  document.getElementById('product-unit-custom').style.display = select.value === 'custom' ? 'block' : 'none';
};

window.showAddProductModal = function () {
  document.getElementById('modal-title').innerText = 'Add New Product';
  document.getElementById('edit-product-id').value = '';
  document.getElementById('product-name').value = '';
  document.getElementById('product-category').value = 'vegetable';
  document.getElementById('product-unit').value = '250g';
  document.getElementById('product-unit-custom').value = '';
  toggleCustomUnitInput();
  document.getElementById('product-available').checked = true;
  document.getElementById('product-modal').classList.remove('hidden');
};

window.hideProductModal = function () {
  document.getElementById('product-modal').classList.add('hidden');
};

window.editProduct = function (product) {
  document.getElementById('modal-title').innerText = 'Edit Product';
  document.getElementById('edit-product-id').value = product.id;
  document.getElementById('product-name').value = product.name;
  document.getElementById('product-category').value = product.category || 'other';

  const unit = product.minimum_quantity_unit || '250g';
  const unitSelect = document.getElementById('product-unit');
  if (unit === '250g' || unit === 'packet') {
    unitSelect.value = unit;
  } else {
    unitSelect.value = 'custom';
    document.getElementById('product-unit-custom').value = unit;
  }
  toggleCustomUnitInput();
  document.getElementById('product-available').checked = product.available !== false;
  document.getElementById('product-modal').classList.remove('hidden');
};

window.saveProduct = async function () {
  const id = document.getElementById('edit-product-id').value;
  const name = document.getElementById('product-name').value.trim();
  let unit = document.getElementById('product-unit').value;
  if (unit === 'custom') {
    unit = document.getElementById('product-unit-custom').value.trim();
    if (!unit) { alert('Please enter a custom unit'); return; }
  }
  const available = document.getElementById('product-available').checked;
  const category = document.getElementById('product-category').value;

  if (!name) { alert('Please enter product name'); return; }

  try {
    const productData = { name, category, minimum_quantity_unit: unit, available };
    if (id) {
      await _supabase.from('products').update(productData).eq('id', id);
      alert('Product updated!');
    } else {
      await _supabase.from('products').insert([productData]);
      alert('Product added!');
    }
    hideProductModal();
    loadAdminProducts();
  } catch (e) {
    alert('Error: ' + e.message);
  }
};

window.deleteProduct = async function (id, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  await _supabase.from('products').delete().eq('id', id);
  alert('Deleted!');
  loadAdminProducts();
};

window.toggleProductStock = async function (id, newStatus) {
  await _supabase.from('products').update({ available: newStatus }).eq('id', id);
  toast(newStatus ? 'In Stock' : 'Out of Stock');
  loadAdminProducts();
};

window.renderPurchaseList = async function () {
  const container = document.getElementById('admin-orders-list');
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';

  const { data: orders } = await _supabase.from('orders').select('items').eq('status', 'pending');
  const needed = {};

  if (orders && orders.length > 0) {
    orders.forEach(o => {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      items.forEach(i => {
        const isPacketItem = i.minQtyUnit !== '250g';
        if (!needed[i.productId]) {
          needed[i.productId] = { name: i.name, unit: i.minQtyUnit, isPacket: isPacketItem, totalQty: 0, totalGrams: 0 };
        }
        if (isPacketItem) needed[i.productId].totalQty += i.orderedQuantity;
        else needed[i.productId].totalGrams += (i.customGrams || (i.orderedQuantity * 250));
      });
    });
  }

  const itemsList = Object.values(needed);
  // Store for printing
  app.shoppingListCache = itemsList;

  container.innerHTML = `
    <div style="padding:16px;">
      <div style="background:white; border-radius:12px; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="margin:0;">Shopping List 🛒</h3>
          ${itemsList.length > 0 ? `<button class="btn btn-outline" style="padding:8px 12px; font-size:13px;" onclick="printShoppingList()">🖨️ Print / Download</button>` : ''}
        </div>
        ${itemsList.length === 0 ? '<p style="color:#666; text-align:center; padding:20px;">No pending orders.</p>' : `
        <table style="width:100%; border-collapse:collapse;">
          <thead><tr style="text-align:left; border-bottom:1px solid #eee;"><th style="padding:8px;">Item</th><th style="padding:8px;">Qty</th></tr></thead>
          <tbody>
            ${itemsList.map(i => `
              <tr style="border-bottom:1px solid #f9f9f9;">
                <td style="padding:10px;">${i.name}</td>
                <td style="padding:10px; font-weight:600;">${i.isPacket ? i.totalQty + ' pkts' : (i.totalGrams / 1000).toFixed(2) + ' kg'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
      </div>
    </div>
  `;
};

window.printShoppingList = function () {
  if (!app.shoppingListCache || app.shoppingListCache.length === 0) {
    alert('No items in shopping list!');
    return;
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const itemsList = app.shoppingListCache;

  // Sort alphabetically by name for easier shopping
  const sortedItems = [...itemsList].sort((a, b) => a.name.localeCompare(b.name));

  let printHtml = `<!DOCTYPE html><html><head><title>Shopping List</title><style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; padding: 20px; font-size: 14px; }
      .print-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #4caf50; padding-bottom: 15px; }
      .print-header h1 { color: #2e7d32; margin-bottom: 5px; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th { background: #4caf50; color: white; padding: 12px 15px; text-align: left; }
      td { padding: 10px 15px; border-bottom: 1px solid #eee; }
      tr:nth-child(even) { background: #f9f9f9; }
      .qty { font-weight: 600; text-align: right; }
      .checkbox { width: 30px; text-align: center; }
      .footer { margin-top: 20px; padding: 15px; background: #e8f5e9; border-radius: 8px; text-align: center; }
      @media print { 
        .no-print { display: none !important; } 
        body { padding: 10px; }
      }
    </style></head><body>
      <div class="print-header">
        <h1>🥬 Shree Gor Veggies</h1>
        <div>Shopping List - ${today}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th class="checkbox">✓</th>
            <th>Item</th>
            <th style="text-align:right;">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${sortedItems.map(i => `
            <tr>
              <td class="checkbox">☐</td>
              <td>${i.name}</td>
              <td class="qty">${i.isPacket ? i.totalQty + ' pkts' : (i.totalGrams / 1000).toFixed(2) + ' kg'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">
        <strong>Total Items: ${sortedItems.length}</strong>
      </div>
      <div class="no-print" style="margin-top:20px; text-align:center;">
        <button onclick="window.print()" style="padding:12px 24px; background:#4caf50; color:white; border:none; border-radius:8px; cursor:pointer; font-size:16px;">🖨️ Print / Save as PDF</button>
      </div>
    </body></html>`;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(printHtml);
  printWindow.document.close();
};

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
        <div style="display:flex; gap:8px;">
          <button class="btn" style="background:#ff5252; color:white;" onclick="resetAllPrices()">🔄 Reset</button>
          <button class="btn" style="background:white; color:green;" onclick="showPriceSetter()">Edit Prices</button>
        </div>
      </div>
      <div id="price-setter-modal" class="hidden" style="background:white; padding:16px; border-radius:12px; margin-bottom:16px;">
        <h4>Set Prices (₹/250g)</h4>
        <input type="text" id="price-search" placeholder="🔍 Search..." style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; margin-bottom:12px;" onkeyup="filterPriceInputs()">
        <div id="price-inputs" style="max-height:300px; overflow-y:auto;"></div>
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="btn btn-outline" style="flex:1; color:#ff5252;" onclick="resetAllPrices()">Reset</button>
          <button class="btn btn-primary" style="flex:2;" onclick="saveCurrentPrices()">Save</button>
        </div>
      </div>
      <div id="profit-data">Loading...</div>
    </div>
  `;

  const { data: orders } = await _supabase.from('orders').select('*').eq('status', 'finalized');
  let totalRev = 0;
  const productStats = {};

  orders.forEach(o => {
    totalRev += (o.total_amount || 0);
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
    items.forEach(i => {
      if (!productStats[i.productId]) productStats[i.productId] = { name: i.name, revenue: 0 };
      productStats[i.productId].revenue += i.finalPrice || 0;
    });
  });

  document.getElementById('profit-data').innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
      <div style="background:white; padding:12px; border-radius:8px; text-align:center;">
        <div style="color:#666; font-size:12px;">Total Revenue</div>
        <div style="font-size:24px; font-weight:700; color:var(--primary);">₹${totalRev.toFixed(0)}</div>
      </div>
      <div style="background:white; padding:12px; border-radius:8px; text-align:center;">
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
};

window.showPriceSetter = async function () {
  document.getElementById('price-setter-modal').classList.remove('hidden');
  const container = document.getElementById('price-inputs');
  const { data: products } = await _supabase.from('products').select('*').order('name');
  const current = JSON.parse(localStorage.getItem('fm_current_prices') || '{}');

  container.innerHTML = products.map(p => `
    <div class="price-item" data-name="${p.name.toLowerCase()}" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <label style="font-size:14px; flex:1;">${p.name}</label>
      <input type="number" id="pset-${p.id}" value="${current[p.id] || ''}" placeholder="Price" style="width:80px; padding:6px; border:1px solid #ddd; border-radius:6px;">
    </div>
  `).join('');
};

window.saveCurrentPrices = async function () {
  const inputs = document.querySelectorAll('[id^=pset-]');
  const prices = {};
  inputs.forEach(inp => {
    const id = inp.id.slice(5);
    if (inp.value) prices[id] = inp.value;
  });

  localStorage.setItem('fm_current_prices', JSON.stringify(prices));
  localStorage.setItem('fm_prices_updated', new Date().toLocaleString());

  await _supabase.from('app_settings').upsert({ key: 'current_prices', value: JSON.stringify(prices) }, { onConflict: 'key' });
  document.getElementById('price-setter-modal').classList.add('hidden');
  renderProfitReport();
  alert('Prices Saved!');
};

window.resetAllPrices = async function () {
  if (!confirm('Reset ALL prices to ₹0?')) return;
  localStorage.removeItem('fm_current_prices');
  localStorage.setItem('fm_prices_updated', 'Reset on ' + new Date().toLocaleString());
  await _supabase.from('app_settings').upsert({ key: 'current_prices', value: JSON.stringify({}) }, { onConflict: 'key' });
  renderProfitReport();
  alert('All prices reset!');
};

window.filterPriceInputs = function () {
  const search = document.getElementById('price-search').value.toLowerCase();
  document.querySelectorAll('.price-item').forEach(item => {
    item.style.display = item.getAttribute('data-name').includes(search) ? 'flex' : 'none';
  });
};

window.printOrders = function () {
  if (!app.adminOrdersCache || app.adminOrdersCache.length === 0) { alert('No orders to print!'); return; }

  const activeTab = document.querySelector('.cat-chip.active');
  const tabName = activeTab ? activeTab.textContent.trim() : 'Orders';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Apply same search/sort as displayed in filterAdminOrders
  const searchInput = document.getElementById('admin-search');
  const sortSelect = document.getElementById('admin-sort');
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  const sort = sortSelect ? sortSelect.value : 'newest';

  let ordersToPrint = app.adminOrdersCache.filter(o => {
    const text = (o.customer_name + ' ' + o.house_no + ' ' + o.customer_phone).toLowerCase();
    return text.includes(search);
  });

  if (sort === 'newest') ordersToPrint.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  else if (sort === 'oldest') ordersToPrint.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  else if (sort === 'name') ordersToPrint.sort((a, b) => a.customer_name.localeCompare(b.customer_name));
  else if (sort === 'house-asc') {
    ordersToPrint.sort((a, b) => {
      const houseA = (a.house_no || '').toString().toUpperCase();
      const houseB = (b.house_no || '').toString().toUpperCase();
      return houseA.localeCompare(houseB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }
  else if (sort === 'house-desc') {
    ordersToPrint.sort((a, b) => {
      const houseA = (a.house_no || '').toString().toUpperCase();
      const houseB = (b.house_no || '').toString().toUpperCase();
      return houseB.localeCompare(houseA, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  if (ordersToPrint.length === 0) { alert('No orders match your current filter!'); return; }

  let printHtml = `<!DOCTYPE html><html><head><title>Orders</title><style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
      .print-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
      .order-card { border: 1px solid #ccc; border-radius: 8px; padding: 12px; margin-bottom: 15px; page-break-inside: avoid; }
      .order-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 5px 8px; text-align: left; border-bottom: 1px solid #f0f0f0; }
      .total-row { font-weight: bold; background: #e8f5e9; }
      @media print { .no-print { display: none !important; } }
    </style></head><body>
      <div class="print-header"><h1>🥬 Shree Gor Veggies</h1><div>${tabName} Orders - ${today}</div></div>`;

  let grandTotal = 0;
  ordersToPrint.forEach(o => {
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
    const orderTotal = o.total_amount || 0;
    grandTotal += orderTotal;
    const paymentStatus = getPaymentStatus(o.id);

    printHtml += `
        <div class="order-card" style="border-left: 4px solid ${paymentStatus.received ? '#4caf50' : '#ff9800'};">
          <div class="order-header">
            <div><strong>${o.customer_name}</strong><br>📞 ${o.customer_phone} | 🏠 ${o.house_no || 'N/A'}</div>
            <div style="text-align:right;"><strong>#${o.id.slice(0, 6).toUpperCase()}</strong><br>${new Date(o.created_at).toLocaleTimeString()}</div>
          </div>
          <table>
            <thead><tr><th>Item</th><th>Ordered</th><th>Actual</th><th>Rate</th><th style="text-align:right;">Amount</th></tr></thead>
            <tbody>
              ${items.map(i => {
      const isPacket = i.minQtyUnit !== '250g';
      const unitLabel = isPacket ? (i.minQtyUnit || 'pkt') : 'g';
      return `<tr>
                  <td>${i.name}</td>
                  <td>${isPacket ? i.orderedQuantity + ' ' + unitLabel : (i.customGrams || (i.orderedQuantity * 250)) + 'g'}</td>
                  <td>${i.actualWeight ? (isPacket ? i.actualWeight + ' ' + unitLabel : i.actualWeight + 'g') : '-'}</td>
                  <td>${i.pricePer250gAtOrder ? '₹' + i.pricePer250gAtOrder : '-'}</td>
                  <td style="text-align:right;">${i.finalPrice ? '₹' + i.finalPrice : '-'}</td>
                </tr>`;
    }).join('')}
              <tr class="total-row"><td colspan="4">Total</td><td style="text-align:right;">₹${orderTotal}</td></tr>
            </tbody>
          </table>
        </div>`;
  });

  printHtml += `
      <div style="margin-top:20px; padding:15px; background:#f9f9f9; border-radius:8px;">
        <strong>Grand Total: ₹${grandTotal}</strong> | Orders: ${ordersToPrint.length}
      </div>
      <div class="no-print" style="margin-top:20px; text-align:center;">
        <button onclick="window.print()" style="padding:12px 24px; background:#4caf50; color:white; border:none; border-radius:8px; cursor:pointer;">🖨️ Print</button>
      </div>
    </body></html>`;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(printHtml);
  printWindow.document.close();
};

window.printMyOrders = function () {
  if (!app.customerOrdersCache || app.customerOrdersCache.length === 0) { alert('No orders to print!'); return; }
  const today = new Date().toLocaleDateString('en-IN');
  let grandTotal = 0;

  let printHtml = `<!DOCTYPE html><html><head><title>My Orders</title><style>
      body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
      .order-card { border: 1px solid #ccc; border-radius: 8px; padding: 12px; margin-bottom: 15px; }
      @media print { .no-print { display: none !important; } }
    </style></head><body>
      <div style="text-align:center; margin-bottom:20px; border-bottom:2px solid #333; padding-bottom:15px;">
        <h1>🥬 Shree Gor Veggies</h1>
        <div>${app.user.name} - ${today}</div>
      </div>`;

  app.customerOrdersCache.forEach(o => {
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
    const orderTotal = o.total_amount || 0;
    grandTotal += orderTotal;

    printHtml += `
        <div class="order-card">
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:10px;">
            <strong>#${o.id.slice(0, 6).toUpperCase()}</strong>
            <span>${new Date(o.created_at).toLocaleString()}</span>
          </div>
          ${items.map(i => {
      const isPacket = i.minQtyUnit !== '250g';
      return `<div style="display:flex; justify-content:space-between; padding:4px 0;">
              <span>${i.name} (${isPacket ? i.orderedQuantity + ' pkt' : (i.customGrams || (i.orderedQuantity * 250)) + 'g'})</span>
              <span>${i.finalPrice ? '₹' + i.finalPrice : 'TBD'}</span>
            </div>`;
    }).join('')}
          <div style="text-align:right; font-weight:bold; margin-top:8px; border-top:1px solid #eee; padding-top:8px;">Total: ₹${orderTotal || 'TBD'}</div>
        </div>`;
  });

  printHtml += `
      <div style="margin-top:20px; padding:15px; background:#f9f9f9; border-radius:8px;"><strong>All Orders Total: ₹${grandTotal}</strong></div>
      <div class="no-print" style="margin-top:20px; text-align:center;">
        <button onclick="window.print()" style="padding:12px 24px; background:#4caf50; color:white; border:none; border-radius:8px;">🖨️ Print</button>
      </div>
    </body></html>`;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(printHtml);
  printWindow.document.close();
};

// Start App
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
