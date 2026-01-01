// =========================================
// 1. CONFIGURATION & INIT
// =========================================
// Supabase configuration
const SUPABASE_URL = 'https://gkxiujmyfsdyxnwhgyzc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGl1am15ZnNkeXhud2hneXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzU3MzUsImV4cCI6MjA4MjM1MTczNX0.oNv2crqvx94abVYFrNhnlQ_ACIdBe1UxMkIDHeBeH7U';

let _supabase;
if (window.supabase && window.supabase.createClient) {
  _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.supabase = _supabase;
} else {
  alert('CRITICAL ERROR: Supabase library not loaded.');
}

// =========================================
// 2. STATE MANAGEMENT
// =========================================
function safeParse(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    localStorage.removeItem(key);
    return fallback;
  }
}

// Cache version
const CACHE_VERSION = '2.0';
const currentVersion = localStorage.getItem('fm_cache_version');

if (currentVersion !== CACHE_VERSION) {
  console.log('Cache version updated - clearing cart');
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

// Sync prices from Supabase
async function syncPricesFromSupabase() {
  try {
    const { data, error } = await _supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'current_prices')
      .single();

    if (error) return;

    if (data && data.value) {
      const prices = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      localStorage.setItem('fm_current_prices', JSON.stringify(prices));
    }
  } catch (e) {
    console.error('Error syncing prices:', e);
  }
}
