/**
 * extraViews.js - Enterprise Feature Views for MUN COMPUTER BUSINESS MANAGER
 * Features: PNB CSP Banking, Retail Inventory, Smart PVC Card Studio, Counter Daybook, Staff Payroll
 * Location: Mamudpur, Juginda, Domkal, Murshidabad
 */

import {
  formatINR,
  formatDate,
  formatDateTime,
  getTodayDate,
  numberToWords
} from './storage.js';

import {
  getAllBankingTransactions,
  saveBankingTransaction,
  deleteBankingTransaction,
  getBankingSummary,
  getCustomBankingServices,
  getAllBankPartners,
  BANKING_TYPES,
  BANK_PARTNERS,
  calculateCommission
} from './banking.js';

import {
  getAllInventory,
  saveInventoryItem,
  deleteInventoryItem,
  adjustStock,
  getLowStockItems,
  getInventoryValuation,
  getInventoryCategories,
  syncInventoryCategoriesFromBackend
} from './inventory.js';

import {
  DENOMINATION_SPEC,
  normalizeDenominations,
  getAllDaybookEntries,
  getDaybookForDate,
  calculateDayTally,
  saveDaybookEntry
} from './daybook.js';

import {
  getAllAttendance,
  recordAttendance,
  getPayrollSummary
} from './payroll.js';

import { getAllCustomers } from './customers.js';
import { can } from './auth.js';

/* =========================================================================
   1. PNB CSP KIOSK BANKING VIEW
   ========================================================================= */

export function renderBankingView() {
  const transactions = getAllBankingTransactions();
  const summary = getBankingSummary();
  const customServices = getCustomBankingServices();
  const bankPartners = getAllBankPartners();

  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">PNB CSP Kiosk Banking & AePS Mitra</h1>
        <p class="view-subtitle">Official Banking Correspondent Operations · Mamudpur, Juginda, Domkal, Murshidabad</p>
      </div>
      <div class="view-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="window.MJK.openCustomBankPartnerModal()">+ Add Bank Partner</button>
        <button class="btn btn-secondary btn-sm" onclick="window.MJK.openCustomBankingServiceModal()">+ Custom Banking Service</button>
        <button class="btn btn-outline btn-sm" onclick="window.MJK.printBankingRegister()">🖨 Print</button>
        <button class="btn btn-danger btn-sm" onclick="window.MJK.exportBankingPDF()">📄 PDF</button>
        <button class="btn btn-success btn-sm" onclick="window.MJK.exportBankingExcel()">📊 Excel</button>
        <button class="btn btn-secondary btn-sm" onclick="window.MJK.exportBankingCSV()">⬇ CSV</button>
        <button class="btn btn-primary btn-sm" onclick="window.MJK.openBankingTxnModal()">+ New PNB Transaction</button>
      </div>
    </div>

    <!-- PNB CSP Quick Metrics -->
    <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Total Transactions</span>
          <span class="metric-icon">🏦</span>
        </div>
        <div class="metric-value">${summary.totalTransactions}</div>
        <div class="metric-change positive">Success: ${summary.successCount} verified</div>
      </div>

      <div class="metric-card a4-avoid-break">
        <div class="metric-header">
          <span class="metric-label">Total Banking Volume</span>
          <span class="metric-icon">📊</span>
        </div>
        <div class="metric-value font-mono">${formatINR(summary.totalVolume)}</div>
        <div class="amount-words-hint" style="color:var(--text-main);">${numberToWords(summary.totalVolume)}</div>
        <div class="metric-sub">Cumulative customer funds routed</div>
      </div>

      <div class="metric-card a4-avoid-break">
        <div class="metric-header">
          <span class="metric-label">AePS Cash Disbursed</span>
          <span class="metric-icon">💸</span>
        </div>
        <div class="metric-value font-mono" style="color:var(--danger);">${formatINR(summary.totalWithdrawals)}</div>
        <div class="amount-words-hint" style="color:var(--text-main);">${numberToWords(summary.totalWithdrawals)}</div>
        <div class="metric-sub">Counter cash paid to customers</div>
      </div>

      <div class="metric-card a4-avoid-break">
        <div class="metric-header">
          <span class="metric-label">Bank Mitra Commission</span>
          <span class="metric-icon">💰</span>
        </div>
        <div class="metric-value font-mono" style="color:var(--success);">${formatINR(summary.totalCommission)}</div>
        <div class="amount-words-hint" style="color:var(--text-main);">${numberToWords(summary.totalCommission)}</div>
        <div class="metric-change positive">Earned revenue for MUN COMPUTER</div>
      </div>
    </div>

    <!-- PNB CSP Operational Notice -->
    <div style="background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:1rem 1.25rem; margin-bottom:1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
      <div style="display:flex; align-items:center; gap:0.75rem;">
        <div style="width:40px; height:40px; flex-shrink:0; background:#a31d1d; color:#fff; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.1rem;">PNB</div>
        <div>
          <div style="font-weight:700; font-size:0.95rem;">Official Bank Mitra BC Kiosk Point</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">BC Agent: MUN COMPUTER · BC Code: PNB-742406-01 · ${bankPartners.length} Bank Partners Ready</div>
        </div>
      </div>
      <div style="display:flex; gap:0.5rem; font-size:0.8rem; flex-wrap:wrap;">
        <span style="padding:0.35rem 0.65rem; background:rgba(37,99,235,0.1); color:var(--blue-600); border-radius:var(--radius-md); font-weight:600;">AePS Active</span>
        <span style="padding:0.35rem 0.65rem; background:rgba(16,185,129,0.1); color:var(--success); border-radius:var(--radius-md); font-weight:600;">Micro-ATM Ready</span>
        <span style="padding:0.35rem 0.65rem; background:rgba(245,158,11,0.1); color:var(--warning); border-radius:var(--radius-md); font-weight:600;">Zero Surcharge Policy</span>
      </div>
    </div>

    <!-- Custom Banking Services & Commission Rules -->
    <div class="list-card" style="margin-bottom:1.25rem;">
      <div class="list-header" style="flex-wrap:wrap; gap:0.5rem;">
        <div>
          <h3 class="list-title">Custom Banking Services & Rules (${customServices.length})</h3>
          <div style="font-size:0.76rem; color:var(--text-muted);">যেকোনো নতুন ব্যাংকিং সার্ভিস (যেমন Loan EMI, Aadhaar Pay, Fastag, Insurance, Micro-ATM) ও কমিশন নিয়ম যোগ করুন।</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="window.MJK.openCustomBankingServiceModal()">+ Add Custom Banking Service</button>
      </div>
      ${customServices.length === 0 ? `
        <div style="padding:0.85rem 1rem; background:var(--surface-alt); border:1px dashed var(--border-strong); border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <span style="font-size:0.82rem; color:var(--text-muted);">No custom banking services configured yet. All ${BANKING_TYPES.length} default PNB CSP services are active.</span>
          <button class="btn btn-outline btn-sm" onclick="window.MJK.openCustomBankingServiceModal()">+ Create Custom Banking Service</button>
        </div>
      ` : `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap:0.75rem;">
          ${customServices.map(cs => {
            const commLabel = cs.commissionType === 'percent' ? `${cs.commissionValue}%` : `₹${cs.commissionValue} flat`;
            const flowBadge = cs.cashFlowDirection === 'in'
              ? '<span class="badge badge-success">Cash In (+)</span>'
              : (cs.cashFlowDirection === 'out'
                ? '<span class="badge badge-danger">Cash Out (-)</span>'
                : '<span class="badge badge-neutral">Neutral</span>');
            return `
              <div style="padding:0.85rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); display:flex; flex-direction:column; justify-content:space-between; gap:0.6rem;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.4rem;">
                    <div>
                      <div style="font-weight:700; font-size:0.9rem; color:var(--text-main);">${cs.name}</div>
                      ${cs.nameBn ? `<div style="font-size:0.74rem; color:var(--text-muted);">${cs.nameBn}</div>` : ''}
                    </div>
                    ${flowBadge}
                  </div>
                  <div style="font-size:0.76rem; color:var(--text-muted); margin-top:0.4rem; line-height:1.45;">
                    <div>Bank: <strong>${cs.defaultBank}</strong></div>
                    <div>Commission: <strong style="color:var(--success);">${commLabel}</strong> · Customer Fee: <strong>₹${cs.defaultFee || 0}</strong></div>
                  </div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.35rem;">
                  <button class="btn btn-secondary btn-sm" onclick="window.MJK.openCustomBankingServiceModal('${cs.id}')">✎ Edit</button>
                  <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteCustomBankingService('${cs.id}')">🗑</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>

    <!-- PNB CSP Transactions Table -->
    <div class="list-card">
      <div class="list-header" style="flex-wrap:wrap; gap:0.75rem;">
        <h3 class="list-title">PNB CSP Transactions Log</h3>
        <div style="display:flex; gap:0.5rem; flex:1; justify-content:flex-end; min-width:0;">
          <input type="text" id="banking-search-input" class="form-control form-control-sm toolbar-search" placeholder="Search RRN, customer, phone..." oninput="window.MJK.filterBankingTable(this.value)">
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table" id="banking-data-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>RRN / Txn ID</th>
              <th>Customer</th>
              <th>Transaction Type</th>
              <th>Bank Partner</th>
              <th style="text-align:right;">Amount (₹)</th>
              <th style="text-align:right;">Commission (₹)</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.length === 0 ? `
              <tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted);">No banking transactions recorded yet. Click "+ New PNB Transaction" to begin.</td></tr>
            ` : transactions.map(t => `
              <tr>
                <td>
                  <div style="font-weight:600;">${formatDate(t.date)}</div>
                  <div style="font-size:0.72rem; color:var(--text-muted);">${t.time || ''}</div>
                </td>
                <td>
                  <span class="code font-mono" style="font-weight:700;">${t.rrn || t.id}</span>
                </td>
                <td>
                  <div style="font-weight:600;">${t.customerName}</div>
                  <div style="font-size:0.72rem; color:var(--text-muted);">${t.customerPhone ? `Mob: ${t.customerPhone}` : (t.aadhaarLast4 ? `Aadhaar: **** ${t.aadhaarLast4}` : '')}</div>
                </td>
                <td>
                  <span style="font-weight:600; color:var(--blue-600);">${t.type}</span>
                </td>
                <td>
                  <span style="font-size:0.8rem;">${t.bank}</span>
                </td>
                <td style="text-align:right; font-weight:700; font-family:monospace; font-size:0.95rem;">
                  ${formatINR(t.amount)}
                </td>
                <td style="text-align:right; font-weight:700; color:var(--success); font-family:monospace;">
                  +${formatINR(t.commission)}
                </td>
                <td>
                  <span class="badge ${t.status === 'Success' ? 'badge-success' : 'badge-danger'}">${t.status}</span>
                </td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="btn btn-secondary btn-sm" onclick="window.MJK.printBankingSlip('${t.id}')" title="Print Customer Receipt">🖨 Slip</button>
                  ${can('canDeleteRecords') ? `
                    <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger); margin-left:4px;" onclick="window.MJK.deleteBankingTxn('${t.id}')" title="Delete record">✕</button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   2. RETAIL INVENTORY & HARDWARE STOCK VIEW
   ========================================================================= */

export function renderInventoryView() {
  const items = getAllInventory();
  const val = getInventoryValuation();
  const lowStock = getLowStockItems();
  const categories = getInventoryCategories();
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  if (!window._invCategoriesSyncStarted) {
    window._invCategoriesSyncStarted = true;
    const beforeKey = JSON.stringify(categories);
    syncInventoryCategoriesFromBackend().then(synced => {
      const afterNames = Array.isArray(synced) ? synced.map(c => c.name) : [];
      if (afterNames.length > 0 && JSON.stringify(afterNames) !== beforeKey) {
        if (window.MJK?.refreshInventoryCategoryFilterOptions) {
          window.MJK.refreshInventoryCategoryFilterOptions();
        }
      }
    }).catch(() => {});
  }

  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">Gas Accessories & Retail Inventory</h1>
        <p class="view-subtitle">Gas Hose Pipes, Regulators, Lighters, Stoves, Spare Parts & Stock Ledger · MUN COMPUTER</p>
      </div>
      <div class="view-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="window.MJK.printInventoryReport()">🖨 Print Stock</button>
        <button class="btn btn-danger btn-sm" onclick="window.MJK.exportInventoryPDF()">📄 Stock PDF</button>
        <button class="btn btn-success btn-sm" onclick="window.MJK.exportInventoryExcel()">📊 Stock Excel</button>
        <button class="btn btn-secondary btn-sm" onclick="window.MJK.exportInventoryCSV()">⬇ Stock CSV</button>
        <button class="btn btn-outline btn-sm" onclick="window.MJK.exportSupplierReportPDF()">🏭 Suppliers PDF</button>
        <button class="btn btn-outline btn-sm" onclick="window.MJK.exportSupplierReportExcel()">🏭 Suppliers Excel</button>
        <button class="btn btn-outline btn-sm" onclick="window.MJK.openInventoryCategoryManagerModal()">🏷️ Categories</button>
        <button class="btn btn-secondary btn-sm" onclick="window.MJK.openQuickSaleModal()">⚡ Quick Sale</button>
        <button class="btn btn-primary btn-sm" onclick="window.MJK.openInventoryItemModal()">+ Add Product</button>
      </div>
    </div>

    <!-- Inventory Valuation Metrics -->
    <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Total SKUs</span>
          <span class="metric-icon">📦</span>
        </div>
        <div class="metric-value font-mono" style="font-variant-numeric:tabular-nums;">${val.totalItemsCount}</div>
        <div class="metric-sub">${val.totalUnits} total physical units · ${categories.length} active categories</div>
      </div>

      <div class="metric-card a4-avoid-break">
        <div class="metric-header">
          <span class="metric-label">Stock Value (Cost)</span>
          <span class="metric-icon">🏷️</span>
        </div>
        <div class="metric-value font-mono" style="font-variant-numeric:tabular-nums;">${formatINR(val.totalCostValue)}</div>
        <div class="amount-words-hint" style="color:var(--text-main);">${numberToWords(val.totalCostValue)}</div>
        <div class="metric-sub">Wholesale invested capital</div>
      </div>

      <div class="metric-card a4-avoid-break">
        <div class="metric-header">
          <span class="metric-label">Expected Retail Return</span>
          <span class="metric-icon">📈</span>
        </div>
        <div class="metric-value font-mono" style="color:var(--success); font-variant-numeric:tabular-nums;">${formatINR(val.totalRetailValue)}</div>
        <div class="amount-words-hint" style="color:var(--text-main);">${numberToWords(val.totalRetailValue)}</div>
        <div class="metric-change positive">Margin: +${formatINR(val.potentialProfit)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Low Stock Alerts</span>
          <span class="metric-icon">⚠️</span>
        </div>
        <div class="metric-value font-mono" style="font-variant-numeric:tabular-nums; color:${val.lowStockCount > 0 ? 'var(--warning)' : 'var(--text-main)'};">
          ${val.lowStockCount}
        </div>
        <div class="metric-sub">${val.lowStockCount > 0 ? 'Need urgent reorder from distributor' : 'All items well stocked'}</div>
      </div>
    </div>

    ${lowStock.length > 0 ? `
      <div style="background:var(--warning-bg); border:1px solid var(--warning-border); border-radius:var(--radius-lg); padding:1rem 1.25rem; margin-bottom:1.5rem;">
        <div style="font-weight:700; color:var(--warning); font-size:0.9rem; margin-bottom:0.4rem;">
          ⚠️ Low Stock Warning: ${lowStock.length} items have reached reorder thresholds
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:0.5rem; font-size:0.8rem;">
          ${lowStock.map(i => `
            <span style="background:var(--surface); border:1px solid var(--border-subtle); padding:0.25rem 0.6rem; border-radius:var(--radius-md);">
              <strong>${esc(i.name)}</strong>: Only ${i.stockQuantity} ${esc(i.unit)} left (Min: ${i.minStockLevel})
            </span>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Inventory Table -->
    <div class="list-card">
      <div class="list-header" style="flex-wrap:wrap; gap:0.75rem;">
        <div>
          <h3 class="list-title">Product Catalog & Stock Ledger</h3>
          <div style="font-size:0.76rem; color:var(--text-muted); margin-top:0.2rem;">
            ${categories.length} Categories Configured ·
            <button type="button" style="background:none; border:none; padding:0; color:var(--blue-600); font-weight:600; font-size:0.76rem; cursor:pointer; text-decoration:underline;" onclick="window.MJK.openInventoryCategoryManagerModal()">+ Add / Delete Categories</button>
          </div>
        </div>
        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
          <select id="inventory-category-filter" class="form-control form-control-sm toolbar-select" onchange="window.MJK.filterInventoryTable()" style="min-width:190px;">
            <option value="">All Categories (${categories.length})</option>
            ${categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          </select>
          <input type="text" id="inventory-search-input" class="form-control form-control-sm toolbar-search" placeholder="Filter by product name, category, SKU..." oninput="window.MJK.filterInventoryTable()">
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table" id="inventory-data-table">
          <thead>
            <tr>
              <th>SKU / Code</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Shelf Location</th>
              <th style="text-align:right;">Cost (₹)</th>
              <th style="text-align:right;">Retail (₹)</th>
              <th style="text-align:center;">Stock Qty</th>
              <th>Stock Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? `
              <tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted);">No products registered yet. Click "+ Add New Product" to populate your gas accessories &amp; retail inventory.</td></tr>
            ` : items.map(p => {
              const isLow = p.stockQuantity <= p.minStockLevel;
              return `
                <tr data-category="${esc(p.category || '')}">
                  <td><span class="code font-mono">${esc(p.sku)}</span></td>
                  <td>
                    <div style="font-weight:700;">${esc(p.name)}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${esc(p.supplier || '')}</div>
                  </td>
                  <td><span style="font-size:0.82rem; font-weight:600;">${esc(p.category)}</span></td>
                  <td><span style="font-size:0.8rem; color:var(--text-muted);">${esc(p.shelfLocation || '-')}</span></td>
                  <td style="text-align:right; font-family:monospace; font-variant-numeric:tabular-nums;">${formatINR(p.costPrice)}</td>
                  <td style="text-align:right; font-family:monospace; font-variant-numeric:tabular-nums; font-weight:700; color:var(--blue-600);">${formatINR(p.sellingPrice)}</td>
                  <td style="text-align:center; font-weight:700; font-size:1rem; font-variant-numeric:tabular-nums;">
                    ${p.stockQuantity} <span style="font-size:0.75rem; color:var(--text-muted);">${esc(p.unit)}</span>
                  </td>
                  <td>
                    <span class="badge ${isLow ? 'badge-warning' : 'badge-success'}">
                      ${isLow ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button class="btn btn-secondary btn-sm" onclick="window.MJK.promptStockAdjust('${esc(p.id)}')" title="Adjust stock (+/-)">Qty ±</button>
                    <button class="btn btn-secondary btn-sm" onclick="window.MJK.openInventoryItemModal('${esc(p.id)}')" title="Edit Product">Edit</button>
                    ${can('canDeleteRecords') ? `
                      <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="window.MJK.deleteInventoryItem('${esc(p.id)}')">✕</button>
                    ` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   3. SMART PVC CARD STUDIO & DIGITAL ID GENERATOR
   ========================================================================= */

export function renderCardStudioView() {
  return `
    <div class="view-header page-header">
      <div>
        <h1 class="view-title">Smart PVC Card Studio & Digital ID Generator</h1>
        <p class="view-subtitle">High-Precision Instant CR-80 Thermal Print Layouts · MUN COMPUTER</p>
      </div>
      <div class="view-actions">
        <button class="btn btn-outline" onclick="window.MJK.printCurrentCard()">🖨 Thermal Print Preview (Front + Back)</button>
        <button class="btn btn-primary" onclick="window.MJK.saveCardAsServiceRecord()">💾 Save as Service Job</button>
      </div>
    </div>

    <!-- Template Selector Segmented Control -->
    <div class="pvc-controls-col" style="background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-xl); padding:1rem 1.25rem; margin-bottom:1.5rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.85rem;">
      <div style="font-weight:700; font-size:0.95rem;">Select Official Card Format:</div>
      <div style="display:flex; flex-wrap:wrap; gap:0.5rem;" id="card-template-selectors">
        <button type="button" data-card-tpl="aadhaar" class="btn btn-primary btn-sm" onclick="window.MJK.setCardTemplate('aadhaar', this)">🪪 Aadhaar PVC Card</button>
        <button type="button" data-card-tpl="pan" class="btn btn-secondary btn-sm" onclick="window.MJK.setCardTemplate('pan', this)">💳 NSDL PAN Card</button>
        <button type="button" data-card-tpl="voter" class="btn btn-secondary btn-sm" onclick="window.MJK.setCardTemplate('voter', this)">🗳️ Voter ID (EPIC)</button>
        <button type="button" data-card-tpl="student" class="btn btn-secondary btn-sm" onclick="window.MJK.setCardTemplate('student', this)">🎓 Student ID Card</button>
        <button type="button" data-card-tpl="employee" class="btn btn-secondary btn-sm" onclick="window.MJK.setCardTemplate('employee', this)">💼 Merchant / Staff ID</button>
      </div>
    </div>

    <!-- 2-Column Split: Controls on Left, Live Card Preview on Right -->
    <div class="erp-grid-1-13" style="align-items:start;">
      
      <!-- Left: Form Controls -->
      <div class="list-card pvc-controls-col">
        <div class="list-header">
          <h3 class="list-title" id="card-editor-title">Card Data Editor (Aadhaar Format)</h3>
          <span style="font-size:0.75rem; color:var(--text-muted);">Standard CR-80 (85.6 × 54 mm)</span>
        </div>

        <form id="card-studio-form" oninput="window.MJK.updateLiveCardPreview()">
          <div class="form-group">
            <label class="form-label">Full Customer Name</label>
            <input type="text" id="card-cust-name" class="form-control" value="" placeholder="Enter cardholder name">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Father / Husband Name</label>
              <input type="text" id="card-father-name" class="form-control" value="" placeholder="Enter guardian name">
            </div>
            <div class="form-group">
              <label class="form-label">Date of Birth (DOB)</label>
              <input type="text" id="card-dob" class="form-control" value="" placeholder="DD/MM/YYYY">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Gender</label>
              <select id="card-gender" class="form-control">
                <option value="Male" selected>Male / পুরুষ</option>
                <option value="Female">Female / মহিলা</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Card Identification Number</label>
              <input type="text" id="card-number" class="form-control font-mono" value="" placeholder="Aadhaar/PAN/EPIC No.">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Address Line</label>
            <textarea id="card-address" class="form-control" rows="2" placeholder="Village, Post Office, Police Station, District, PIN"></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Customer Mobile</label>
              <input type="text" id="card-mobile" class="form-control" value="" placeholder="10-digit mobile number">
            </div>
            <div class="form-group">
              <label class="form-label">Issue Date</label>
              <input type="text" id="card-issue-date" class="form-control" value="${getTodayDate()}">
            </div>
          </div>

          <div style="margin-top:1.25rem; display:flex; gap:0.5rem; justify-content:flex-end;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.sendCardDetailsToWhatsApp()">
              📲 WhatsApp Notification to Customer
            </button>
          </div>
        </form>
      </div>

      <!-- Right: Live Front & Back Card Preview -->
      <div style="display:flex; flex-direction:column; gap:1.5rem;">
        
        <!-- Front Side Preview -->
        <div style="background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-xl); padding:1.5rem; box-shadow:var(--shadow-md);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <span style="font-weight:700; font-size:0.9rem;">FRONT SIDE PREVIEW</span>
            <span style="font-size:0.75rem; color:var(--text-muted);">Thermal Resolution: 300 DPI</span>
          </div>

          <div id="pvc-card-front" class="pvc-card-preview" style="width:100%; max-width:440px; min-height:245px; aspect-ratio:1.586; background:linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%); border-radius:14px; border:1px solid #cbd5e1; box-shadow:0 8px 20px rgba(0,0,0,0.12); padding:1rem; position:relative; overflow:hidden; font-family:sans-serif; margin:0 auto;">
            <!-- Top Band -->
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #e2e8f0; padding-bottom:0.4rem; margin-bottom:0.6rem;">
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <div style="font-size:1.4rem;">🏛️</div>
                <div>
                  <div style="font-weight:800; font-size:0.85rem; color:#0f172a; letter-spacing:0.5px;" id="preview-org-name">GOVERNMENT OF INDIA</div>
                  <div style="font-size:0.65rem; color:#64748b;" id="preview-card-type-label">UNIQUE IDENTIFICATION AUTHORITY OF INDIA</div>
                </div>
              </div>
              <div style="font-weight:800; font-size:1rem; color:#2563eb;" id="preview-emblem-badge">🇮🇳</div>
            </div>

            <!-- Middle Layout: Photo + Details -->
            <div style="display:flex; gap:0.85rem; align-items:center;">
              <div style="width:72px; height:88px; flex-shrink:0; background:#e2e8f0; border:1.5px solid #94a3b8; border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden;">
                <span style="font-size:2.2rem;">👤</span>
                <span style="font-size:0.6rem; color:#64748b;">PHOTO</span>
              </div>
              <div style="flex:1; min-width:0; font-size:0.8rem; line-height:1.4;">
                <div style="font-weight:800; font-size:0.95rem; color:#0f172a;" id="prev-name">[Cardholder Name]</div>
                <div style="color:#475569;" id="prev-father">[Guardian Name]</div>
                <div style="color:#475569;"><span style="font-size:0.75rem;">DOB:</span> <strong id="prev-dob">DD/MM/YYYY</strong></div>
                <div style="color:#475569;"><span style="font-size:0.75rem;">Gender:</span> <strong id="prev-gender">Male</strong></div>
              </div>
            </div>

            <!-- Bottom Number Strip -->
            <div style="margin-top:0.6rem; text-align:center; padding:0.35rem; background:rgba(37,99,235,0.08); border-radius:6px; border:1px solid rgba(37,99,235,0.2);">
              <span style="font-weight:800; font-family:monospace; font-size:1.05rem; letter-spacing:2px; color:#1e3e62;" id="prev-number">
                XXXX XXXX XXXX
              </span>
            </div>
          </div>
        </div>

        <!-- Back Side Preview -->
        <div style="background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-xl); padding:1.25rem; box-shadow:var(--shadow-md);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <span style="font-weight:700; font-size:0.9rem;">BACK SIDE PREVIEW</span>
            <span style="font-size:0.75rem; color:var(--text-muted);">Security Hologram & QR Code</span>
          </div>

          <div id="pvc-card-back" class="pvc-card-preview" style="width:100%; max-width:440px; min-height:245px; aspect-ratio:1.586; background:linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius:14px; border:1px solid #cbd5e1; box-shadow:0 8px 20px rgba(0,0,0,0.12); padding:1rem; position:relative; overflow:hidden; font-family:sans-serif; margin:0 auto; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="font-size:0.68rem; font-weight:700; color:#475569; margin-bottom:0.3rem;">OFFICIAL RESIDENTIAL ADDRESS:</div>
              <div style="font-size:0.75rem; color:#1e293b; line-height:1.35; padding-right:1rem;" id="prev-address">
                [Full Residential Address will appear here]
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
              <div style="font-size:0.65rem; color:#64748b;">
                <div>Printed at: <strong>MUN COMPUTER</strong></div>
                <div>Mamudpur, Domkal, Murshidabad</div>
                <div>Helpline: 8101352105</div>
              </div>

              <!-- High-res QR placeholder -->
              <div style="width:68px; height:68px; background:#fff; border:1px solid #000; padding:3px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
                <div style="font-size:1.8rem; line-height:1;">▦</div>
                <span style="font-size:0.5rem; font-weight:bold;">SECURE QR</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

/* =========================================================================
   4. COUNTER CASH DRAWER & DAILY DAYBOOK VIEW
   ========================================================================= */

export function renderDaybookView() {
  const tally = calculateDayTally();
  const pastEntries = getAllDaybookEntries();

  const isBalanced = tally.difference === 0;

  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">Counter Cash Drawer & Daily Daybook</h1>
        <p class="view-subtitle">End-of-Day Physical Cash Reconciliation & CSP Settlement · MUN COMPUTER</p>
      </div>
      <div class="view-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="window.MJK.printDaybookReport()">🖨 Print Daybook</button>
        <button class="btn btn-danger btn-sm" onclick="window.MJK.exportDaybookPDF()">📄 PDF</button>
        <button class="btn btn-success btn-sm" onclick="window.MJK.exportDaybookExcel()">📊 Excel</button>
        <button class="btn btn-secondary btn-sm" onclick="window.MJK.exportDaybookCSV()">⬇ CSV</button>
        <button class="btn btn-primary btn-sm" onclick="window.MJK.saveDaybookRecord()">🔒 Reconcile & Lock Drawer</button>
      </div>
    </div>

    <!-- Reconciliation Banner -->
    <div style="background:var(--surface); border:1px solid ${isBalanced ? 'var(--success)' : 'var(--warning)'}; border-radius:var(--radius-xl); padding:1.5rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.5rem;">
      <div>
        <div style="font-size:0.85rem; color:var(--text-muted);">Current Reconciliation Status:</div>
        <div style="font-size:1.4rem; font-weight:800; color:${isBalanced ? 'var(--success)' : 'var(--warning)'}; display:flex; align-items:center; gap:0.5rem; margin-top:0.2rem;">
          <span>${isBalanced ? '✓' : '⚠️'}</span>
          <span>${isBalanced ? 'Counter Cash Balanced (Exact Match)' : (tally.difference > 0 ? `Excess Cash in Drawer (+${formatINR(tally.difference)})` : `Cash Shortage in Drawer (${formatINR(tally.difference)})`)}</span>
        </div>
      </div>
      <div class="a4-avoid-break" style="display:flex; gap:1.5rem; flex-wrap:wrap; text-align:left;">
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted);">Expected Closing Cash</div>
          <div style="font-size:1.3rem; font-weight:800; font-family:monospace; color:var(--blue-600);">${formatINR(tally.expectedClosing)}</div>
          <div class="amount-words-hint" style="color:var(--text-main);">${numberToWords(tally.expectedClosing)}</div>
        </div>
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted);">Counted Physical Cash</div>
          <div style="font-size:1.3rem; font-weight:800; font-family:monospace; color:${isBalanced ? 'var(--success)' : 'var(--warning)'};" id="live-counted-cash">
            ${formatINR(tally.countedPhysicalCash)}
          </div>
          <div id="live-counted-cash-words" class="amount-words-hint" style="color:var(--text-main);">${numberToWords(tally.countedPhysicalCash)}</div>
        </div>
      </div>
    </div>

    <!-- Daybook Flow Columns -->
    <div class="erp-grid-2" style="margin-bottom:2rem;">
      
      <!-- Left: Cash Inflows & Outflows Breakdown -->
      <div class="list-card">
        <div class="list-header">
          <h3 class="list-title">Today's Cash Flow Breakdown (${formatDate(tally.date)})</h3>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.85rem;">
          <div style="display:flex; justify-content:space-between; gap:0.5rem; padding:0.6rem 0.85rem; background:var(--surface-alt); border-radius:var(--radius-md);">
            <span><strong>1. Opening Drawer Float:</strong></span>
            <span class="font-mono" style="font-weight:700;">${formatINR(tally.openingCash)}</span>
          </div>

          <div style="display:flex; justify-content:space-between; gap:0.5rem; padding:0.6rem 0.85rem; background:rgba(16,185,129,0.08); border-radius:var(--radius-md);">
            <span style="color:var(--success);"><strong>(+) Service Counter Cash:</strong></span>
            <span class="font-mono" style="font-weight:700; color:var(--success);">+${formatINR(tally.serviceCashIn)}</span>
          </div>

          <div style="display:flex; justify-content:space-between; gap:0.5rem; padding:0.6rem 0.85rem; background:rgba(16,185,129,0.08); border-radius:var(--radius-md);">
            <span style="color:var(--success);"><strong>(+) PNB CSP Deposits Received:</strong></span>
            <span class="font-mono" style="font-weight:700; color:var(--success);">+${formatINR(tally.cspCashIn)}</span>
          </div>

          <div style="display:flex; justify-content:space-between; gap:0.5rem; padding:0.6rem 0.85rem; background:rgba(239,68,68,0.08); border-radius:var(--radius-md);">
            <span style="color:var(--danger);"><strong>(-) PNB CSP Cash Withdrawals Dispensed:</strong></span>
            <span class="font-mono" style="font-weight:700; color:var(--danger);">${formatINR(tally.cspCashOut)}</span>
          </div>

          <div style="display:flex; justify-content:space-between; gap:0.5rem; padding:0.6rem 0.85rem; background:rgba(239,68,68,0.08); border-radius:var(--radius-md);">
            <span style="color:var(--danger);"><strong>(-) Daily Counter Expenses Paid:</strong></span>
            <span class="font-mono" style="font-weight:700; color:var(--danger);">${formatINR(tally.cashExpenses)}</span>
          </div>

          <div style="border-top:2px solid var(--border-subtle); padding-top:0.85rem; display:flex; justify-content:space-between; gap:0.5rem; font-size:1.05rem; font-weight:800;">
            <span>Expected Cash in Drawer:</span>
            <span class="font-mono" style="color:var(--blue-600);">${formatINR(tally.expectedClosing)}</span>
          </div>
        </div>
      </div>

      <!-- Right: Currency Denomination Calculator -->
      <div class="list-card">
        <div class="list-header">
          <h3 class="list-title">Physical Currency Denomination Counter</h3>
          <span style="font-size:0.75rem; color:var(--text-muted);">Enter note counts</span>
        </div>

        <form id="denomination-form" oninput="window.MJK.recalculateDenominations()">
          <div style="display:grid; grid-template-columns: minmax(90px, 125px) minmax(0, 1fr) minmax(82px, 125px); gap:0.6rem; align-items:center; margin-bottom:0.5rem;">
            <strong>Denomination</strong>
            <strong>Qty</strong>
            <strong style="text-align:right;">Subtotal (₹)</strong>
          </div>

          ${(() => {
            const norm = normalizeDenominations(tally.denominations);
            return DENOMINATION_SPEC.map(spec => {
              const qty = norm[spec.key] || 0;
              return `
                <div style="display:grid; grid-template-columns: minmax(90px, 125px) minmax(0, 1fr) minmax(82px, 125px); gap:0.6rem; align-items:center; margin-bottom:0.4rem;">
                  <span class="font-mono" style="font-weight:700; font-size:0.86rem;">${spec.label}</span>
                  <input type="number" min="0" class="form-control form-control-sm denom-input" data-key="${spec.key}" data-value="${spec.value}" value="${qty}" style="text-align:center;">
                  <span class="font-mono subtotal-denom" data-key="${spec.key}" style="text-align:right; font-weight:600;">
                    ${qty > 0 ? formatINR(qty * spec.value) : '—'}
                  </span>
                </div>
              `;
            }).join('');
          })()}

          <div class="a4-avoid-break" style="border-top:2px solid var(--border-subtle); margin-top:0.75rem; padding-top:0.75rem;">
            <div style="display:flex; justify-content:space-between; gap:0.5rem; font-size:1.05rem; font-weight:800;">
              <span>Total Physical Count:</span>
              <span class="font-mono" id="denom-grand-total" style="color:var(--success);">${formatINR(tally.countedPhysicalCash)}</span>
            </div>
            <div id="denom-grand-total-words" class="amount-words-hint" style="text-align:right;">${numberToWords(tally.countedPhysicalCash)}</div>
          </div>
        </form>
      </div>

    </div>

    <!-- Daybook Audit Trail -->
    <div class="list-card">
      <div class="list-header">
        <h3 class="list-title">Past Daybook Closures History</h3>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Opening Float</th>
              <th>Cash Inflow</th>
              <th>Cash Outflow</th>
              <th>Expected</th>
              <th>Counted</th>
              <th>Variance</th>
              <th>Status</th>
              <th>Verified By</th>
            </tr>
          </thead>
          <tbody>
            ${pastEntries.length === 0 ? `
              <tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted);">No past daybook closures recorded yet. Count your physical drawer and click "🔒 Reconcile & Lock Drawer".</td></tr>
            ` : pastEntries.map(e => `
              <tr>
                <td><strong>${formatDate(e.date)}</strong></td>
                <td class="font-mono">${formatINR(e.openingCash)}</td>
                <td class="font-mono" style="color:var(--success);">+${formatINR((e.serviceCashIn || 0) + (e.cspCashIn || 0))}</td>
                <td class="font-mono" style="color:var(--danger);">${formatINR((e.cspCashOut || 0) + (e.cashExpenses || 0))}</td>
                <td class="font-mono" style="font-weight:700;">${formatINR(e.expectedClosing)}</td>
                <td class="font-mono" style="font-weight:700;">${formatINR(e.countedPhysicalCash)}</td>
                <td class="font-mono" style="color:${e.difference === 0 ? 'var(--success)' : 'var(--danger)'};">
                  ${e.difference === 0 ? '₹0' : formatINR(e.difference)}
                </td>
                <td>
                  <span class="badge ${e.status === 'Balanced' ? 'badge-success' : 'badge-danger'}">${e.status}</span>
                </td>
                <td style="font-size:0.8rem;">${e.verifiedBy}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   5. STAFF ATTENDANCE & PAYROLL COMMISSION LEDGER VIEW
   ========================================================================= */

export function renderPayrollView() {
  const records = getAllAttendance();
  const summary = getPayrollSummary();

  return `
    <div class="view-header">
      <div>
        <h1 class="view-title">Staff Attendance & Commission Ledger</h1>
        <p class="view-subtitle">Daily Clock-In, Performance Commission & Monthly Salaries · MUN COMPUTER</p>
      </div>
      <div class="view-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="window.MJK.printPayrollReport()">🖨 Print</button>
        <button class="btn btn-danger btn-sm" onclick="window.MJK.exportPayrollPDF()">📄 PDF</button>
        <button class="btn btn-success btn-sm" onclick="window.MJK.exportPayrollExcel()">📊 Excel</button>
        <button class="btn btn-secondary btn-sm" onclick="window.MJK.exportPayrollCSV()">⬇ CSV</button>
        <button class="btn btn-primary btn-sm" onclick="window.MJK.openAttendanceModal()">+ Record Today's Attendance</button>
      </div>
    </div>

    <!-- Staff Summary Cards -->
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap:1.25rem; margin-bottom:2rem;">
      ${summary.length === 0 ? `
        <div class="list-card" style="grid-column:1/-1; text-align:center; padding:1.5rem; color:var(--text-muted);">
          No staff attendance summary yet. Click <strong>+ Record Today's Attendance</strong> to begin tracking.
        </div>
      ` : summary.map(s => `
        <div style="background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-xl); padding:1.5rem; box-shadow:var(--shadow-sm);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
            <div>
              <h3 style="font-weight:800; font-size:1.1rem; margin:0;">${s.staffName}</h3>
              <div style="font-size:0.8rem; color:var(--text-muted);">${s.role}</div>
            </div>
            <span class="badge badge-info">${s.daysPresent} Days Present</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.4rem; font-size:0.85rem; border-top:1px solid var(--border-subtle); padding-top:0.75rem; margin-top:0.5rem;">
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">Services Handled:</span>
              <strong>${s.totalServicesHandled}</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">Base Salary Accrued:</span>
              <strong class="font-mono">${formatINR(s.totalBaseSalary)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">Commission Earned:</span>
              <strong class="font-mono" style="color:var(--success);">+${formatINR(s.totalCommission)}</strong>
            </div>
            <div class="a4-avoid-break" style="border-top:1px solid var(--border-subtle); margin-top:0.4rem; padding-top:0.4rem;">
              <div style="display:flex; justify-content:space-between; font-weight:800; font-size:1rem;">
                <span>Total Payout:</span>
                <span class="font-mono" style="color:var(--blue-600);">${formatINR(s.grandTotalPayout)}</span>
              </div>
              <div class="amount-words-hint" style="text-align:right;">${numberToWords(s.grandTotalPayout)}</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Attendance Log Table -->
    <div class="list-card">
      <div class="list-header">
        <h3 class="list-title">Daily Attendance & Work Log</h3>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Staff Name</th>
              <th>Role</th>
              <th>Clock In / Out</th>
              <th>Status</th>
              <th style="text-align:center;">Jobs Handled</th>
              <th style="text-align:right;">Commission (₹)</th>
              <th style="text-align:right;">Daily Pay (₹)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `
              <tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted);">No attendance entries logged yet.</td></tr>
            ` : records.map(r => `
              <tr>
                <td><strong>${formatDate(r.date)}</strong></td>
                <td><strong>${r.staffName}</strong></td>
                <td style="font-size:0.8rem; color:var(--text-muted);">${r.role}</td>
                <td style="font-size:0.8rem;">${r.clockIn} - ${r.clockOut}</td>
                <td>
                  <span class="badge ${r.status === 'Present' ? 'badge-success' : 'badge-warning'}">${r.status}</span>
                </td>
                <td style="text-align:center; font-weight:700;">${r.servicesHandled}</td>
                <td style="text-align:right; font-family:monospace; color:var(--success);">+${formatINR(r.commissionEarned)}</td>
                <td style="text-align:right; font-family:monospace; font-weight:700;">${formatINR(r.totalDailyPay)}</td>
                <td style="font-size:0.8rem; color:var(--text-muted);">${r.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
