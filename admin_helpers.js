/**
 * Render shopping list for admin.
 */
window.renderPurchaseList = async function () {
  const container = document.getElementById('admin-orders-list');
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
 * Render profit/analytics report for admin.
 */
window.renderProfitReport = async function () {
  const container = document.getElementById('admin-orders-list');

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

  document.getElementById('profit-data').innerHTML = `
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
};

/**
 * Show price setter modal.
 */
window.showPriceSetter = async function () {
  document.getElementById('price-setter-modal').classList.remove('hidden');
  const container = document.getElementById('price-inputs');
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
 * Save current prices to localStorage and Supabase.
 */
window.saveCurrentPrices = async function () {
  const inputs = document.querySelectorAll('[id^=pset-]');
  const prices = {};
  inputs.forEach(inp => {
    const id = inp.id.split('-')[1];
    if (inp.value) prices[id] = inp.value;
  });

  localStorage.setItem('fm_current_prices', JSON.stringify(prices));
  localStorage.setItem('fm_prices_updated', new Date().toLocaleString());

  // Sync to Supabase
  await _supabase.from('app_settings').upsert({
    key: 'current_prices',
    value: JSON.stringify(prices)
  }, { onConflict: 'key' });

  document.getElementById('price-setter-modal').classList.add('hidden');
  renderProfitReport();
  alert('Prices Saved!');
};
