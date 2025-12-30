// --- ANALYTICS DASHBOARD ---
window.renderAnalytics = async function () {
    const container = document.getElementById('admin-orders-list');
    container.innerHTML = '<div class="spinner"></div>';

    try {
        // Fetch all finalized orders
        const { data: orders, error } = await window.supabase
            .from('orders')
            .select('*')
            .eq('status', 'finalized');

        if (error) {
            container.innerHTML = `<p class="text-center text-danger">Error loading analytics: ${error.message}</p>`;
            return;
        }

        if (!orders || orders.length === 0) {
            container.innerHTML = `
            <div class="text-center" style="padding: 40px;">
              <span class="material-icons-round" style="font-size: 64px; color: #ccc;">analytics</span>
              <p style="color: #999; margin-top: 20px;">No finalized orders yet. Analytics will appear once you finalize orders.</p>
            </div>
          `;
            return;
        }

        // Process data
        const analytics = processAnalyticsData(orders);

        // Render UI
        container.innerHTML = `
          <div style="padding: 0;">
            ${renderSummaryCards(analytics)}
            ${renderProductAnalytics(analytics)}
            ${renderCustomerAnalytics(analytics)}
          </div>
        `;
    } catch (e) {
        console.error('Analytics Error:', e);
        container.innerHTML = `<p class="text-center text-danger">Failed to load analytics</p>`;
    }
};

function processAnalyticsData(orders) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let todayRevenue = 0;
    let weeklyOrders = 0;
    const productStats = {}; // { productName: { totalQtyGrams, totalRevenue, orderCount } }
    const customerStats = {}; // { customerPhone: { name, orders, totalSpent, items: {} } }

    orders.forEach(order => {
        const orderDate = new Date(order.created_at);
        const revenue = order.grand_total_final || 0;

        // Today's revenue
        if (orderDate >= todayStart) {
            todayRevenue += revenue;
        }

        // Weekly orders
        if (orderDate >= weekStart) {
            weeklyOrders++;
        }

        // Customer stats
        const custKey = order.customer_phone;
        if (!customerStats[custKey]) {
            customerStats[custKey] = {
                name: order.customer_name,
                phone: order.customer_phone,
                orders: 0,
                totalSpent: 0,
                items: {}, // { productName: quantity }
                lastOrderDate: orderDate
            };
        }
        customerStats[custKey].orders++;
        customerStats[custKey].totalSpent += revenue;
        if (orderDate > customerStats[custKey].lastOrderDate) {
            customerStats[custKey].lastOrderDate = orderDate;
        }

        // Product stats
        if (Array.isArray(order.items)) {
            order.items.forEach(item => {
                const productName = item.name;
                const qty = item.orderedQuantity || 0;
                const unit = item.minQtyUnit || '250g';
                const itemRevenue = item.finalPrice || 0;

                // Convert quantity to grams for consistent aggregation
                let qtyInGrams = 0;
                if (unit === '250g') {
                    qtyInGrams = qty * 250;
                } else if (unit === 'packet') {
                    qtyInGrams = qty * 250; // Assume packet = 250g for aggregation
                } else {
                    // For custom units (bottles, jars), count as pieces
                    qtyInGrams = qty; // Store as count, not grams
                }

                if (!productStats[productName]) {
                    productStats[productName] = {
                        totalQty: 0,
                        totalRevenue: 0,
                        orderCount: 0,
                        unit: unit // Store first seen unit
                    };
                }

                productStats[productName].totalQty += qtyInGrams;
                productStats[productName].totalRevenue += itemRevenue;
                productStats[productName].orderCount++;

                // Customer item tracking
                if (!customerStats[custKey].items[productName]) {
                    customerStats[custKey].items[productName] = 0;
                }
                customerStats[custKey].items[productName] += qty;
            });
        }
    });

    // Find top selling product
    let topProduct = null;
    let maxQty = 0;
    Object.entries(productStats).forEach(([name, stats]) => {
        if (stats.totalQty > maxQty) {
            maxQty = stats.totalQty;
            topProduct = name;
        }
    });

    return {
        todayRevenue,
        weeklyOrders,
        topProduct,
        productStats,
        customerStats
    };
}

function renderSummaryCards(analytics) {
    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px;">
          <div style="background: linear-gradient(135deg, #4caf50, #2e7d32); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 5px;">Today's Sales</div>
            <div style="font-size: 28px; font-weight: bold;">₹${analytics.todayRevenue}</div>
          </div>
          <div style="background: linear-gradient(135deg, #2196f3, #1565c0); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 5px;">This Week</div>
            <div style="font-size: 28px; font-weight: bold;">${analytics.weeklyOrders} <span style="font-size: 14px;">orders</span></div>
          </div>
          <div style="background: linear-gradient(135deg, #ff9800, #e65100); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 5px;">Top Seller</div>
            <div style="font-size: 18px; font-weight: bold;">${analytics.topProduct || 'N/A'}</div>
          </div>
        </div>
      `;
}

function renderProductAnalytics(analytics) {
    const sorted = Object.entries(analytics.productStats)
        .sort((a, b) => b[1].totalRevenue - a[1].totalRevenue);

    let rows = sorted.map(([name, stats]) => {
        // Format quantity display
        let qtyDisplay;
        if (stats.unit === '250g' || stats.unit === 'packet') {
            const kg = stats.totalQty / 1000;
            if (kg >= 1) {
                qtyDisplay = `${kg.toFixed(2)} kg`;
            } else {
                qtyDisplay = `${stats.totalQty} g`;
            }
        } else {
            qtyDisplay = `${stats.totalQty} units`;
        }

        const avgPrice = stats.orderCount > 0 ? (stats.totalRevenue / stats.orderCount).toFixed(0) : 0;

        return `
          <tr>
            <td style="font-weight: 500;">${name}</td>
            <td style="text-align: center;">${qtyDisplay}</td>
            <td style="text-align: center;">₹${stats.totalRevenue}</td>
            <td style="text-align: center;">${stats.orderCount}</td>
            <td style="text-align: center;">₹${avgPrice}</td>
          </tr>
        `;
    }).join('');

    return `
        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #333;">📦 Product Performance</h3>
          <div style="overflow-x: auto;">
            <table style="width: 100%; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 12px; text-align: left; font-size: 12px; color: #666;">Product</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; color: #666;">Qty Sold</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; color: #666;">Revenue</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; color: #666;">Times Ordered</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; color: #666;">Avg ₹/Order</th>
                </tr>
              </thead>
              <tbody style="font-size: 13px;">
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      `;
}

function renderCustomerAnalytics(analytics) {
    const sorted = Object.values(analytics.customerStats)
        .sort((a, b) => b.totalSpent - a.totalSpent);

    let rows = sorted.map(customer => {
        // Find favorite item
        let favoriteItem = 'N/A';
        let maxQty = 0;
        Object.entries(customer.items).forEach(([item, qty]) => {
            if (qty > maxQty) {
                maxQty = qty;
                favoriteItem = item;
            }
        });

        const lastOrderFormatted = new Date(customer.lastOrderDate).toLocaleDateString('en-IN');

        return `
          <tr>
            <td style="font-weight: 500;">${customer.name}<br><span style="font-size: 11px; color: #999;">${customer.phone}</span></td>
            <td style="text-align: center;">${customer.orders}</td>
            <td style="text-align: center;">₹${customer.totalSpent}</td>
            <td style="text-align: center;">${favoriteItem}</td>
            <td style="text-align: center; font-size: 11px;">${lastOrderFormatted}</td>
          </tr>
        `;
    }).join('');

    return `
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #333;">👥 Customer Insights</h3>
          <div style="overflow-x: auto;">
            <table style="width: 100%; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 12px; text-align: left; font-size: 12px; color: #666;">Customer</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; color: #666;">Orders</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; color: #666;">Total Spent</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; color: #666;">Favorite Item</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; color: #666;">Last Order</th>
                </tr>
              </thead>
              <tbody style="font-size: 13px;">
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      `;
}
