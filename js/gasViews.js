/**
 * gasViews.js - LPG & Gas Services UI Views & Print Templates
 * MUN COMPUTER Business Manager
 */

import {
  formatINR,
  formatDate,
  formatDateTime,
  getTodayDate,
  numberToWords,
  KEYS,
  getItem
} from './storage.js';
import { getAllInventory, getInventoryCategories } from './inventory.js';
import {
  BOOKING_ELIGIBILITY_DISCLAIMER,
  SUBSIDY_SECURITY_NOTICE,
  NON_TAKER_ACCOUNTING_NOTICE,
  GAS_SERVICE_TYPES,
  GAS_COLLECTION_CATEGORIES,
  GAS_PAYMENT_MODES,
  GAS_SUBSIDY_STATUSES,
  GAS_DELIVERY_PIPELINE_STAGES,
  GAS_EXCEPTION_STATUSES,
  GAS_BOOKING_STATUSES,
  GAS_DELIVERY_PRICING_METHODS,
  GAS_REPORT_DEFINITIONS,
  normalizeGasBookingStatus,
  isBookingCancelledStatus,
  isBookingDeliveredStatus,
  canPerformGasAction,
  getGasSettings,
  getGasAgencies,
  getGasCylinderTypes,
  getGasDeliveryAreas,
  getAllGasDeliveryPersons,
  getAllGasCustomers,
  getGasCustomerById,
  getGasCustomerFullHistory,
  getAllGasBookings,
  getAllGasEligibilityRules,
  getGasEligibilitySummary,
  getAllGasSubsidies,
  getAllNonTakerLedgers,
  getAllGasCollections,
  getAllGasWarehouses,
  getAllGasStockMovements,
  getAllGasDamagedStock,
  getAllGasSuppliers,
  getAllGasPurchases,
  getAllGasServiceEntries,
  getGasAuditLogs,
  getGasDashboardStats,
  buildGasReportDataset
} from './gasServiceEngine.js';
import { buildGoogleMapsDirectionsUrl } from './gasMapsService.js';
import {
  renderBwDocumentHeader,
  renderOnlinePaymentUpiSection,
  renderLegalTermsSection,
  renderAcknowledgementSection,
  escDoc,
  formatINRDoc
} from './documentEngine.js';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function gasBadge(label, tone = 'info') {
  const palette = {
    success: { bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0' },
    warning: { bg: '#fffbeb', fg: '#b45309', bd: '#fde68a' },
    danger: { bg: '#fef2f2', fg: '#b91c1c', bd: '#fecaca' },
    info: { bg: '#eff6ff', fg: '#1d4ed8', bd: '#bfdbfe' },
    neutral: { bg: '#f1f5f9', fg: '#475569', bd: '#cbd5e1' }
  }[tone] || { bg: '#eff6ff', fg: '#1d4ed8', bd: '#bfdbfe' };
  return `<span style="display:inline-flex;align-items:center;padding:0.18rem 0.52rem;font-size:0.72rem;font-weight:700;border-radius:6px;background:${palette.bg};color:${palette.fg};border:1px solid ${palette.bd};white-space:nowrap;">${esc(label)}</span>`;
}

function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (['active', 'delivered', 'delivered successfully', 'credited', 'paid', 'settled', 'verified', 'completed', 'done', 'npci seeded', 'yes - active', 'yes', 'stock_in', 'service_restore', 'available'].includes(s)) return 'success';
  if (['booking received', 'booking confirmed', 'order processing', 'ready for dispatch', 'delivery assigned', 'out for delivery', 'on delivery'].includes(s)) return 'info';
  if (['pending', 'booked', 'delivery attempted', 'customer not available', 'delivery rescheduled', 'payment pending', 'partially recovered', 'partial', 'expected', 'under verification', 'upcoming', 'eligible today', 'off duty'].includes(s)) return 'warning';
  if (['booking cancelled', 'cancelled', 'failed', 'rejected', 'due', 'reversed', 'overdue', 'inactive', 'suspended', 'damage', 'stock_out', 'low'].includes(s)) return 'danger';
  return 'neutral';
}

function renderPolicyNotice(title, body, tone = 'info') {
  const colors = {
    info: { bg: '#eff6ff', bd: '#bfdbfe', fg: '#1e3a8a' },
    warning: { bg: '#fffbeb', bd: '#fde68a', fg: '#78350f' }
  }[tone] || { bg: '#eff6ff', bd: '#bfdbfe', fg: '#1e3a8a' };
  return `
    <div style="background:${colors.bg};border:1px solid ${colors.bd};color:${colors.fg};border-radius:var(--radius-md);padding:0.75rem 1rem;margin-bottom:1rem;font-size:0.82rem;line-height:1.45;">
      <strong>${esc(title)}:</strong> ${esc(body)}
    </div>
  `;
}

function renderEmptyState(title, message, btnLabel = '', onclickAttr = '') {
  return `
    <div class="table-card" style="padding:2.25rem 1.25rem;text-align:center;">
      <div style="font-size:1.05rem;font-weight:700;color:var(--text-main);margin-bottom:0.35rem;">${esc(title)}</div>
      <div style="font-size:0.84rem;color:var(--text-muted);max-width:480px;margin:0 auto ${btnLabel ? '1rem' : '0'};">${esc(message)}</div>
      ${btnLabel ? `<button type="button" class="btn btn-primary btn-sm" onclick="${onclickAttr}">${esc(btnLabel)}</button>` : ''}
    </div>
  `;
}

/* =========================================================================
   1. GAS DASHBOARD
   ========================================================================= */

export function renderGasDashboardView(state = {}) {
  const dateFrom = state.gasDashDateFrom || '';
  const dateTo = state.gasDashDateTo || '';
  const s = getGasDashboardStats({ dateFrom, dateTo });
  const deliveryPersons = getAllGasDeliveryPersons();
  const canAddCust = canPerformGasAction('add', 'gas-customers');
  const canAddBook = canPerformGasAction('add', 'gas-bookings');
  const canAddSrv = canPerformGasAction('add', 'gas-service-replacement');

  const kpis = [
    { label: 'Total Gas Bookings', val: s.totalGasBookings, sub: `Today: ${s.todaysBookings}`, tone: 'info' },
    { label: 'Pending Deliveries', val: s.pendingDeliveries, sub: `Out: ${s.outForDeliveryCount} · Assigned: ${s.deliveryAssignedCount}`, tone: s.pendingDeliveries > 0 ? 'warning' : 'neutral' },
    { label: 'Delivered Successfully', val: s.deliveredSuccessCount, sub: `Cancelled: ${s.cancelledCount}`, tone: 'success' },
    { label: 'Total Gas Sales', val: formatINR(s.totalGasSales), sub: `Delivery Fees: ${formatINR(s.totalDeliveryCharges)}`, tone: 'info' },
    { label: 'Total Collection', val: formatINR(s.totalCollection), sub: `Accessories: ${formatINR(s.accessoriesSales)}`, tone: 'success' },
    { label: 'Outstanding Amount', val: formatINR(s.outstandingAmount), sub: `Non-Taker Due: ${formatINR(s.nonTakerOutstanding)}`, tone: s.outstandingAmount > 0 ? 'danger' : 'success' },
    { label: 'Total Customers', val: s.totalCustomers, sub: `${s.activeCustomers} Active · Eligible: ${s.eligibleCustomersCount}`, tone: 'info' },
    { label: 'Active Delivery Team', val: s.activeDeliveryPersons, sub: `${deliveryPersons.length} Total Riders`, tone: 'info' },
    { label: 'Subsidy Credited / Pending', val: formatINR(s.subsidyCredited), sub: `Pending DBT: ${formatINR(s.subsidyPending)}`, tone: 'info' },
    { label: 'Service & Low Stock', val: `${s.customerServiceCount} Svc`, sub: `Low Stock Alerts: ${s.lowStockCount}`, tone: s.lowStockCount > 0 ? 'danger' : 'success' }
  ];

  const maxTrendCol = Math.max(1, ...s.dailyTrend.map(t => t.collection));
  const upcomingList = [...s.eligibility.eligibleToday, ...s.eligibility.overdue, ...s.eligibility.upcoming7].slice(0, 6);

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Gas Delivery & Operations Dashboard</h1>
        <p class="page-subtitle">7-Stage LPG Delivery Pipeline, Customers, Bookings, Route Charges, Riders & Hardware Service</p>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
        <input type="date" class="form-control" style="width:auto;min-width:138px;" value="${esc(dateFrom)}" onchange="window.MJK.setGasFilter('gasDashDateFrom', this.value)" title="Filter From Date">
        <input type="date" class="form-control" style="width:auto;min-width:138px;" value="${esc(dateTo)}" onchange="window.MJK.setGasFilter('gasDashDateTo', this.value)" title="Filter To Date">
        ${(dateFrom || dateTo) ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.resetGasDashDates()">Clear Dates</button>` : ''}
        ${canAddCust ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openGasCustomerModal()">+ Gas Customer</button>` : ''}
        ${canAddBook ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasBookingModal()">+ New Gas Booking</button>` : ''}
        ${canAddSrv ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('gas-service-replacement')">Service / Stock</button>` : ''}
      </div>
    </div>

    <div class="table-card" style="padding:1rem;margin-bottom:1.15rem;border-top:3px solid #1d4ed8;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem;">
        <div>
          <h3 style="margin:0;font-size:0.95rem;font-weight:800;color:#0f172a;">Live 7-Stage LPG Delivery Pipeline</h3>
          <span style="font-size:0.75rem;color:var(--text-muted);">Click any stage below to inspect matching orders in the Booking Register</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.navigateGasBookingsByStatus('all')">Open Full Booking Register →</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:0.55rem;">
        ${GAS_DELIVERY_PIPELINE_STAGES.map((stage, idx) => {
          const count = s.stageCounts?.[stage] || 0;
          const isFinal = stage === 'Delivered Successfully';
          return `
            <button type="button" onclick="window.MJK.navigateGasBookingsByStatus('${esc(stage)}')" style="text-align:left;cursor:pointer;background:${isFinal ? '#ecfdf5' : '#eff6ff'};border:1px solid ${isFinal ? '#a7f3d0' : '#bfdbfe'};border-radius:8px;padding:0.6rem 0.7rem;transition:transform 0.12s;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem;">
                <span style="font-size:0.68rem;font-weight:700;color:${isFinal ? '#047857' : '#1d4ed8'};">STAGE ${idx + 1}</span>
                <span style="font-size:1.05rem;font-weight:800;color:${isFinal ? '#047857' : '#0b3b8c'};font-variant-numeric:tabular-nums;">${count}</span>
              </div>
              <div style="font-size:0.76rem;font-weight:700;color:#0f172a;line-height:1.25;">${esc(stage)}</div>
            </button>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.65rem;padding-top:0.6rem;border-top:1px dashed var(--border-subtle);align-items:center;">
        <span style="font-size:0.72rem;font-weight:700;color:var(--text-muted);">Exceptions:</span>
        ${GAS_EXCEPTION_STATUSES.map(ex => {
          const cnt = s.stageCounts?.[ex] || 0;
          return `<button type="button" class="btn btn-outline btn-sm" style="padding:0.18rem 0.55rem;font-size:0.72rem;" onclick="window.MJK.navigateGasBookingsByStatus('${esc(ex)}')">${esc(ex)}: <strong>${cnt}</strong></button>`;
        }).join('')}
      </div>
    </div>

    <div class="metrics-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0.85rem;margin-bottom:1.25rem;">
      ${kpis.map(k => `
        <div class="metric-card" style="background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:0.95rem 1rem;">
          <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;margin-bottom:0.35rem;">${esc(k.label)}</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--text-main);font-variant-numeric:tabular-nums;">${esc(k.val)}</div>
          <div style="font-size:0.76rem;color:var(--text-muted);margin-top:0.25rem;">${esc(k.sub)}</div>
        </div>
      `).join('')}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem;margin-bottom:1.25rem;">
      <div class="table-card" style="padding:1rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.85rem;">
          <div>
            <h3 style="margin:0;font-size:0.95rem;font-weight:700;">7-Day Collection & Booking Activity</h3>
            <span style="font-size:0.76rem;color:var(--text-muted);">Verified collections & daily refill counts</span>
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('gas-reports')">Open Reports</button>
        </div>
        <div style="display:flex;align-items:flex-end;gap:0.65rem;height:150px;padding:0.5rem 0;border-bottom:1px solid var(--border-subtle);">
          ${s.dailyTrend.map(t => {
            const pct = Math.max(4, Math.round((t.collection / maxTrendCol) * 100));
            return `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0.25rem;height:100%;justify-content:flex-end;">
                <span style="font-size:0.68rem;font-variant-numeric:tabular-nums;color:var(--text-muted);">${t.collection > 0 ? formatINR(t.collection) : '₹0'}</span>
                <div style="width:100%;max-width:34px;height:${pct}%;background:linear-gradient(180deg,#2563eb 0%,#1d4ed8 100%);border-radius:4px 4px 0 0;" title="${t.date}: ${formatINR(t.collection)} · ${t.bookings} booking(s)"></div>
              </div>
            `;
          }).join('')}
        </div>
        <div style="display:flex;gap:0.65rem;padding-top:0.35rem;">
          ${s.dailyTrend.map(t => `
            <div style="flex:1;text-align:center;font-size:0.7rem;color:var(--text-muted);font-variant-numeric:tabular-nums;">
              <div>${esc(t.label)}</div>
              <div style="font-weight:600;color:var(--text-main);">${t.bookings} bk</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="table-card" style="padding:1rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
          <div>
            <h3 style="margin:0;font-size:0.95rem;font-weight:700;">Delivery Team & Stock Snapshot</h3>
            <span style="font-size:0.76rem;color:var(--text-muted);">Active delivery personnel & critical stock alerts</span>
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openGasSettingsTab('personnel')">Manage Riders</button>
        </div>
        ${deliveryPersons.length === 0 ? `
          <div style="padding:0.75rem;background:#f8fafc;border:1px dashed var(--border-subtle);border-radius:6px;margin-bottom:0.75rem;font-size:0.8rem;color:var(--text-muted);">
            No delivery persons configured yet. Add riders in <strong>Gas Settings → Delivery Personnel</strong>.
          </div>
        ` : `
          <table class="data-table" style="margin-bottom:0.75rem;">
            <thead><tr><th>Rider</th><th>Area</th><th>Status</th></tr></thead>
            <tbody>
              ${deliveryPersons.slice(0, 4).map(p => `
                <tr>
                  <td><strong>${esc(p.name)}</strong><div style="font-size:0.72rem;color:var(--text-muted);">${esc(p.mobile)}</div></td>
                  <td style="font-size:0.78rem;">${esc(p.assignedArea || 'All Areas')}</td>
                  <td>${gasBadge(p.isActive === false ? 'Inactive' : (p.availabilityStatus || 'Available'), statusTone(p.isActive === false ? 'Inactive' : (p.availabilityStatus || 'Available')))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
        ${s.lowStockItems.length === 0 ? `
          <div style="padding:0.5rem;text-align:center;color:var(--text-muted);font-size:0.8rem;">No hardware low stock alerts.</div>
        ` : `
          <table class="data-table">
            <thead><tr><th>Low Stock SKU</th><th style="text-align:right;">Qty</th><th>Action</th></tr></thead>
            <tbody>
              ${s.lowStockItems.slice(0, 3).map(i => `
                <tr>
                  <td><strong>${esc(i.name)}</strong></td>
                  <td style="text-align:right;">${gasBadge(i.stockQuantity, 'danger')}</td>
                  <td><button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.navigateTo('gas-suppliers')">Purchase</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>

    <div class="table-card" style="padding:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem;">
        <div>
          <h3 style="margin:0;font-size:0.95rem;font-weight:700;">Booking Eligibility Reminder Queue</h3>
          <span style="font-size:0.76rem;color:var(--text-muted);">Administrative reminder queue — verify directly on Gas Booking Register</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.navigateTo('gas-eligibility')">View Full Eligibility List</button>
      </div>
      ${upcomingList.length === 0 ? `
        <div style="padding:1.25rem;text-align:center;color:var(--text-muted);font-size:0.84rem;">No eligible or upcoming reminders yet. Register Gas Customers and Bookings to track intervals.</div>
      ` : `
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr><th>Customer</th><th>Consumer ID</th><th>Last Valid Booking</th><th>Interval</th><th>Next Reminder Date</th><th>Status</th><th>Quick Action</th></tr></thead>
            <tbody>
              ${upcomingList.map(r => `
                <tr>
                  <td><strong>${esc(r.customerName)}</strong><div style="font-size:0.74rem;color:var(--text-muted);">${esc(r.mobile)}</div></td>
                  <td class="font-mono">${esc(r.consumerId || '-')}</td>
                  <td>${r.lastValidBookingDate ? esc(formatDate(r.lastValidBookingDate)) : '-'}</td>
                  <td>${r.intervalDays} days</td>
                  <td>${esc(formatDate(r.nextEligibleDate))}</td>
                  <td>${gasBadge(r.statusLabel, statusTone(r.bucket === 'overdue' ? 'overdue' : 'warning'))}</td>
                  <td><button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasBookingModal('', '${esc(r.gasCustomerId)}')">Book Now</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

/* =========================================================================
   2. GAS CUSTOMER REGISTER
   ========================================================================= */

export function renderGasCustomersView(state = {}) {
  const q = String(state.gasCustSearch || '').trim().toLowerCase();
  const statusFilter = state.gasCustStatusFilter || 'all';
  const companyFilter = state.gasCustCompanyFilter || 'all';
  const agencyFilter = state.gasCustAgencyFilter || 'all';
  const settings = getGasSettings();
  const agencies = getGasAgencies();
  const all = getAllGasCustomers();
  const filtered = all.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (companyFilter !== 'all' && c.gasCompany !== companyFilter) return false;
    if (agencyFilter !== 'all' && (c.agencyName || '') !== agencyFilter && (c.agencyId || '') !== agencyFilter) return false;
    if (!q) return true;
    return [
      c.id,
      c.fullName,
      c.mobile,
      c.altMobile,
      c.consumerId,
      c.lpgId17,
      c.villageAddress,
      c.savedDeliveryAddress,
      c.village,
      c.pinCode,
      c.agencyName
    ].some(f => String(f || '').toLowerCase().includes(q));
  });

  const canAdd = canPerformGasAction('add', 'gas-customers');
  const canEdit = canPerformGasAction('edit', 'gas-customers');
  const canDelete = canPerformGasAction('delete', 'gas-customers');

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Gas Customer Register</h1>
        <p class="page-subtitle">Manage LPG Consumer Profiles, Agencies, Optional 17-Digit LPG IDs, Structured Delivery Addresses & Google Map Pins</p>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openGasAgencyQuickModal()">Manage Agencies</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('customer_master', 'pdf')">Export PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('customer_master', 'excel')">Export Excel</button>
        ${canAdd ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasCustomerModal()">+ Register Gas Customer</button>` : ''}
      </div>
    </div>

    <div class="table-card" style="padding:0.85rem 1rem;margin-bottom:1rem;display:flex;gap:0.65rem;flex-wrap:wrap;align-items:center;">
      <input id="gas-cust-search" type="text" class="form-control" style="flex:1;min-width:220px;" placeholder="Search Name, Consumer ID, 17-Digit LPG ID, Mobile, Agency, Village, PIN..." value="${esc(state.gasCustSearch || '')}" oninput="window.MJK.setGasSearch('gasCustSearch', this.value, 'gas-cust-search')">
      <select class="form-control" style="width:auto;max-width:220px;" onchange="window.MJK.setGasFilter('gasCustAgencyFilter', this.value)">
        <option value="all" ${agencyFilter === 'all' ? 'selected' : ''}>All Agencies</option>
        ${agencies.map(a => `<option value="${esc(a.name)}" ${agencyFilter === a.name ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
      </select>
      <select class="form-control" style="width:auto;" onchange="window.MJK.setGasFilter('gasCustCompanyFilter', this.value)">
        <option value="all" ${companyFilter === 'all' ? 'selected' : ''}>All Companies</option>
        ${(settings.gasCompanies || []).map(co => `<option value="${esc(co)}" ${companyFilter === co ? 'selected' : ''}>${esc(co)}</option>`).join('')}
      </select>
      <select class="form-control" style="width:auto;" onchange="window.MJK.setGasFilter('gasCustStatusFilter', this.value)">
        <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
        <option value="Active" ${statusFilter === 'Active' ? 'selected' : ''}>Active</option>
        <option value="Inactive" ${statusFilter === 'Inactive' ? 'selected' : ''}>Inactive</option>
        <option value="Suspended" ${statusFilter === 'Suspended' ? 'selected' : ''}>Suspended</option>
      </select>
    </div>

    ${filtered.length === 0 ? renderEmptyState(
      'No Gas Customers Found',
      'Register your first LPG customer with structured delivery address, agency, and Google Maps pin.',
      canAdd ? '+ Register Gas Customer' : '',
      'window.MJK.openGasCustomerModal()'
    ) : `
      <div class="table-card" style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Customer & Contact</th>
              <th>Consumer / 17-Digit LPG ID</th>
              <th>Agency & Connection</th>
              <th>Delivery Address & Map Pin</th>
              <th>eKYC & Bank (Last 4)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(c => {
              const hasPin = Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng));
              const addrText = c.savedDeliveryAddress || c.villageAddress || '-';
              const navUrl = hasPin
                ? buildGoogleMapsDirectionsUrl(settings.mainCentre || {}, { lat: c.lat, lng: c.lng })
                : (addrText !== '-' ? buildGoogleMapsDirectionsUrl(settings.mainCentre || {}, { address: addrText }) : '');
              const secWa = c.whatsapp || c.altMobile;
              const showSecWa = secWa && secWa !== c.mobile;
              return `
                <tr>
                  <td>
                    <strong>${esc(c.fullName)}</strong>
                    ${c.guardianName ? `<div style="font-size:0.72rem;color:#334155;">C/O: ${esc(c.guardianName)}</div>` : ''}
                    <div style="font-size:0.74rem;color:var(--text-muted);">${esc(c.id)} · ${esc(c.mobile)}${showSecWa ? ` · WA: ${esc(secWa)}` : ''}</div>
                  </td>
                  <td>
                    <div class="font-mono" style="font-weight:700;">${esc(c.consumerId || `Optional (${c.id})`)}</div>
                    ${c.lpgId17 ? `<div class="font-mono" style="font-size:0.72rem;color:var(--text-muted);">LPG-17: ${esc(c.lpgId17)}</div>` : `<div style="font-size:0.7rem;color:var(--text-muted);">17-Digit LPG ID: Optional</div>`}
                  </td>
                  <td>
                    <div>${c.agencyName ? gasBadge(c.agencyName, 'info') : gasBadge('Agency Unset', 'neutral')}</div>
                    <div style="font-size:0.74rem;color:var(--text-muted);margin-top:2px;">${esc(c.gasCompany)} · ${esc(c.connectionCategory)} · ${esc(c.cylinderType)}</div>
                  </td>
                  <td style="max-width:250px;">
                    <div style="font-size:0.77rem;color:var(--text-main);line-height:1.35;">${esc(addrText)}</div>
                    <div style="display:flex;gap:0.3rem;align-items:center;margin-top:3px;flex-wrap:wrap;">
                      ${hasPin ? gasBadge(`Pinned (${Number(c.lat).toFixed(4)}, ${Number(c.lng).toFixed(4)})`, 'success') : gasBadge('Map Not Pinned', 'neutral')}
                      ${navUrl ? `<a href="${esc(navUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:0.7rem;font-weight:700;color:#1d4ed8;text-decoration:underline;">Map ↗</a>` : ''}
                    </div>
                  </td>
                  <td>
                    <div style="display:flex;gap:0.25rem;flex-wrap:wrap;">
                      ${gasBadge(`eKYC: ${c.ekycStatus || 'Pending'}`, statusTone(c.ekycStatus))}
                      ${gasBadge(`NPCI: ${c.bankLinkStatus || 'Pending'}`, statusTone(c.bankLinkStatus))}
                      ${c.maskedAccount ? gasBadge(`A/C: ${c.maskedAccount}`, 'info') : ''}
                    </div>
                    ${c.bankName ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">${esc(c.bankName)}</div>` : ''}
                    ${c.nonTakerFlag === 'Yes' ? `<div style="margin-top:3px;">${gasBadge('Non-Taker', 'warning')}</div>` : ''}
                  </td>
                  <td>
                    ${gasBadge(c.status, statusTone(c.status))}
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">${c.customIntervalDays ? `${c.customIntervalDays}d` : `${settings.defaultEligibilityDays}d`}</div>
                  </td>
                  <td>
                    <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                      <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openGasCustomerHistoryModal('${esc(c.id)}')">History</button>
                      <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasBookingModal('', '${esc(c.id)}')">Book</button>
                      ${canEdit ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openGasCustomerModal('${esc(c.id)}')">Edit</button>` : ''}
                      ${canDelete ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.deleteGasCustomerConfirm('${esc(c.id)}')">Delete</button>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

/* =========================================================================
   3. GAS BOOKING REGISTER
   ========================================================================= */

export function renderGasBookingsView(state = {}) {
  const q = String(state.gasBookSearch || '').trim().toLowerCase();
  const statusFilter = state.gasBookStatusFilter || 'all';
  const agencyFilter = state.gasBookAgencyFilter || 'all';
  const dateFrom = state.gasBookDateFrom || '';
  const dateTo = state.gasBookDateTo || '';
  const delDateFilter = state.gasBookDeliveryDateFilter || '';
  const payStatusFilter = state.gasBookPayStatusFilter || 'all';
  const riderFilter = state.gasBookDeliveryPersonFilter || 'all';
  const areaFilter = String(state.gasBookAreaFilter || '').trim().toLowerCase();

  const settings = getGasSettings();
  const agencies = getGasAgencies();
  const deliveryPersons = getAllGasDeliveryPersons();
  const customersById = new Map(getAllGasCustomers().map(c => [c.id, c]));
  const all = getAllGasBookings();
  const filtered = all.filter(b => {
    const normSt = normalizeGasBookingStatus(b.deliveryStatus);
    if (statusFilter !== 'all' && normSt !== statusFilter) return false;
    if (agencyFilter !== 'all' && (b.agencyName || '') !== agencyFilter && (b.agencyId || '') !== agencyFilter) return false;
    if (dateFrom && String(b.bookingDate || '') < dateFrom) return false;
    if (dateTo && String(b.bookingDate || '') > dateTo) return false;
    if (delDateFilter && String(b.deliveryDate || '') !== delDateFilter) return false;
    if (payStatusFilter !== 'all' && String(b.paymentStatus || '') !== payStatusFilter) return false;
    if (riderFilter !== 'all' && (b.deliveryPersonId || '') !== riderFilter && (b.deliveryPersonName || '') !== riderFilter) return false;
    if (areaFilter) {
      const areaHay = [b.deliveryArea, b.deliveryAddressSnapshot].join(' ').toLowerCase();
      if (!areaHay.includes(areaFilter)) return false;
    }
    if (!q) return true;
    return [
      b.bookingNo,
      b.customerName,
      b.consumerId,
      b.lpgId17,
      b.mobile,
      b.bookingRefNo,
      b.gasCompany,
      b.agencyName,
      b.deliveryAddressSnapshot,
      b.deliveryPersonName
    ].some(f => String(f || '').toLowerCase().includes(q));
  });

  const canAdd = canPerformGasAction('add', 'gas-bookings');
  const canEdit = canPerformGasAction('edit', 'gas-bookings');

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Gas Booking & Delivery Register</h1>
        <p class="page-subtitle">7-Stage LPG Delivery Tracking, Road Distance & Fee Calculation, Rider Assignment, Live Map & Customer Receipts</p>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('booking_register', 'pdf')">Export PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('booking_register', 'excel')">Export Excel</button>
        ${canAdd ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasBookingModal()">+ New Gas Booking</button>` : ''}
      </div>
    </div>

    <div class="table-card" style="padding:0.85rem 1rem;margin-bottom:1rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.55rem;align-items:end;">
      <div style="grid-column:span 2;min-width:210px;">
        <label class="form-label" style="font-size:0.72rem;margin-bottom:2px;">Search Booking / Customer / Phone / Address</label>
        <input id="gas-book-search" type="text" class="form-control" placeholder="Booking No, Name, Mobile, Consumer/LPG ID, Rider..." value="${esc(state.gasBookSearch || '')}" oninput="window.MJK.setGasSearch('gasBookSearch', this.value, 'gas-book-search')">
      </div>
      <div>
        <label class="form-label" style="font-size:0.72rem;margin-bottom:2px;">Delivery Stage / Status</label>
        <select class="form-control" onchange="window.MJK.setGasFilter('gasBookStatusFilter', this.value)">
          <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All Stages</option>
          <optgroup label="7-Stage Delivery Pipeline">
            ${GAS_DELIVERY_PIPELINE_STAGES.map(st => `<option value="${esc(st)}" ${statusFilter === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
          </optgroup>
          <optgroup label="Exceptions & Holds">
            ${GAS_EXCEPTION_STATUSES.map(st => `<option value="${esc(st)}" ${statusFilter === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
          </optgroup>
        </select>
      </div>
      <div>
        <label class="form-label" style="font-size:0.72rem;margin-bottom:2px;">Agency / Distributor</label>
        <select class="form-control" onchange="window.MJK.setGasFilter('gasBookAgencyFilter', this.value)">
          <option value="all" ${agencyFilter === 'all' ? 'selected' : ''}>All Agencies</option>
          ${agencies.map(a => `<option value="${esc(a.name)}" ${agencyFilter === a.name ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label" style="font-size:0.72rem;margin-bottom:2px;">Delivery Person</label>
        <select class="form-control" onchange="window.MJK.setGasFilter('gasBookDeliveryPersonFilter', this.value)">
          <option value="all" ${riderFilter === 'all' ? 'selected' : ''}>All Riders</option>
          ${deliveryPersons.map(p => `<option value="${esc(p.id)}" ${riderFilter === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label" style="font-size:0.72rem;margin-bottom:2px;">Payment Status</label>
        <select class="form-control" onchange="window.MJK.setGasFilter('gasBookPayStatusFilter', this.value)">
          <option value="all" ${payStatusFilter === 'all' ? 'selected' : ''}>All Payments</option>
          <option value="Paid" ${payStatusFilter === 'Paid' ? 'selected' : ''}>Paid</option>
          <option value="Partial" ${payStatusFilter === 'Partial' ? 'selected' : ''}>Partial</option>
          <option value="Due" ${payStatusFilter === 'Due' ? 'selected' : ''}>Due</option>
        </select>
      </div>
      <div>
        <label class="form-label" style="font-size:0.72rem;margin-bottom:2px;">Booking From</label>
        <input type="date" class="form-control" value="${esc(dateFrom)}" onchange="window.MJK.setGasFilter('gasBookDateFrom', this.value)">
      </div>
      <div>
        <label class="form-label" style="font-size:0.72rem;margin-bottom:2px;">Booking To</label>
        <input type="date" class="form-control" value="${esc(dateTo)}" onchange="window.MJK.setGasFilter('gasBookDateTo', this.value)">
      </div>
      <div>
        <label class="form-label" style="font-size:0.72rem;margin-bottom:2px;">Delivery Date</label>
        <input type="date" class="form-control" value="${esc(delDateFilter)}" onchange="window.MJK.setGasFilter('gasBookDeliveryDateFilter', this.value)">
      </div>
      <div>
        <label class="form-label" style="font-size:0.72rem;margin-bottom:2px;">Village / Area</label>
        <input id="gas-book-area" type="text" class="form-control" placeholder="Filter Village / Area..." value="${esc(state.gasBookAreaFilter || '')}" oninput="window.MJK.setGasSearch('gasBookAreaFilter', this.value, 'gas-book-area')">
      </div>
      <div>
        <button type="button" class="btn btn-outline btn-sm" style="width:100%;" onclick="window.MJK.resetGasBookingFilters()">Clear All Filters</button>
      </div>
    </div>

    ${filtered.length === 0 ? renderEmptyState(
      'No Gas Bookings Match Filters',
      'Create a new gas booking or clear active filters to inspect permanent booking & delivery records.',
      canAdd ? '+ Create Gas Booking' : '',
      'window.MJK.openGasBookingModal()'
    ) : `
      <div class="table-card" style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Booking No & Date</th>
              <th>Customer, Agency & Address</th>
              <th>Cylinder & Charges</th>
              <th style="text-align:right;">Total / Paid / Due</th>
              <th>Delivery Pipeline & Rider</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(b => {
              const stage = normalizeGasBookingStatus(b.deliveryStatus);
              const isCanc = isBookingCancelledStatus(stage);
              const isDel = isBookingDeliveredStatus(stage);
              const riderName = b.deliveryPersonName || b.deliveryStaff || '';
              const custRec = customersById.get(b.gasCustomerId);
              const dLat = b.deliveryLat ?? custRec?.lat;
              const dLng = b.deliveryLng ?? custRec?.lng;
              const hasDestPin = Number.isFinite(Number(dLat)) && Number.isFinite(Number(dLng));
              const destAddr = b.deliveryAddressSnapshot || custRec?.savedDeliveryAddress || custRec?.villageAddress || b.deliveryArea || '';
              const doorstepNavUrl = buildGoogleMapsDirectionsUrl(
                settings.mainCentre || {},
                hasDestPin ? { lat: Number(dLat), lng: Number(dLng) } : { address: destAddr }
              );
              return `
                <tr>
                  <td>
                    <strong class="font-mono">${esc(b.bookingNo)}</strong>
                    <div style="font-size:0.74rem;color:var(--text-muted);">${esc(formatDate(b.bookingDate))}${b.bookingRefNo ? ` · Ref: ${esc(b.bookingRefNo)}` : ''}</div>
                    <div style="margin-top:3px;">${gasBadge(b.customerTakingGas === 'No' ? 'Taking Gas: No' : 'Taking Gas: Yes', b.customerTakingGas === 'No' ? 'warning' : 'success')}</div>
                  </td>
                  <td style="max-width:250px;">
                    <strong>${esc(b.customerName)}</strong> <span style="font-size:0.74rem;color:var(--text-muted);">(${esc(b.mobile)})</span>
                    <div style="font-size:0.72rem;color:var(--text-muted);">${esc(b.consumerId || b.lpgId17 || 'Consumer ID Optional')} · ${esc(b.agencyName || b.gasCompany)}</div>
                    ${destAddr ? `<div style="font-size:0.72rem;color:#334155;margin-top:2px;">${esc(destAddr)}</div>` : ''}
                    <div style="margin-top:3px;">${hasDestPin ? gasBadge(`Pin: ${Number(dLat).toFixed(4)}, ${Number(dLng).toFixed(4)}`, 'success') : gasBadge('GPS Pin Unsaved', 'neutral')}</div>
                  </td>
                  <td>
                    <div><strong>${esc(b.cylinderType)} × ${b.quantity}</strong> <span style="font-size:0.73rem;color:var(--text-muted);">(@ ${formatINR(b.refillPrice)})</span></div>
                    <div style="font-size:0.72rem;color:var(--text-muted);">
                      Dist: <strong>${Number(b.deliveryDistanceKm || 0)} km</strong> · Del Fee: <strong>${formatINR(b.deliveryCharge || 0)}</strong>
                      ${Number(b.additionalServiceCharge) > 0 ? ` · Addl: ${formatINR(b.additionalServiceCharge)}` : ''}
                    </div>
                  </td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums;">
                    <div><strong>${formatINR(b.totalAmount)}</strong></div>
                    <div style="font-size:0.72rem;color:#047857;">Paid: ${formatINR(b.paidAmount)}</div>
                    <div style="margin-top:2px;">${gasBadge(`Due: ${formatINR(b.dueAmount)}`, Number(b.dueAmount) > 0 ? 'danger' : 'success')}</div>
                  </td>
                  <td>
                    <div>${gasBadge(stage, statusTone(stage))}</div>
                    <div style="font-size:0.73rem;color:var(--text-main);margin-top:3px;">
                      ${riderName ? `Rider: <strong>${esc(riderName)}</strong>${b.deliveryPersonMobile ? ` (${esc(b.deliveryPersonMobile)})` : ''}` : '<span style="color:var(--text-muted);">Rider Unassigned</span>'}
                    </div>
                    ${b.deliveryDate ? `<div style="font-size:0.71rem;color:var(--text-muted);">Del Date: ${esc(formatDate(b.deliveryDate))}</div>` : ''}
                  </td>
                  <td>
                    <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                      <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasOrderTrackingModal('${esc(b.id)}')">Track & Map</button>
                      ${(hasDestPin || destAddr) ? `<a href="${esc(doorstepNavUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="text-decoration:none;">🧭 Navigate to Doorstep</a>` : ''}
                      ${canEdit && b.gasCustomerId ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.saveCurrentGpsToCustomerProfile('${esc(b.gasCustomerId)}', '${esc(b.id)}')" title="Capture live device GPS & save permanently to customer profile">📍 Save GPS</button>` : ''}
                      ${canEdit && !isDel && !isCanc ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openGasAssignRiderModal('${esc(b.id)}')">Assign Rider</button>` : ''}
                      <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.printGasBookingReceipt('${esc(b.id)}')">Receipt</button>
                      ${Number(b.dueAmount) > 0 && !isCanc ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openGasCollectionModal('', { bookingId: '${esc(b.id)}', gasCustomerId: '${esc(b.gasCustomerId)}', amount: ${Number(b.dueAmount)}, category: 'Gas Booking Payment' })">Collect Due</button>` : ''}
                      ${canEdit ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openGasBookingModal('${esc(b.id)}')">Edit</button>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

/* =========================================================================
   4. BOOKING ELIGIBILITY
   ========================================================================= */

export function renderGasEligibilityView(state = {}) {
  const bucketFilter = state.gasEligBucket || 'all';
  const summary = getGasEligibilitySummary(getTodayDate());
  const rules = getAllGasEligibilityRules();
  const list = bucketFilter === 'all' ? summary.rows : (summary[bucketFilter] || summary.rows);

  const tabs = [
    { id: 'all', label: `All Active (${summary.rows.length})` },
    { id: 'eligibleToday', label: `Eligible Today (${summary.eligibleToday.length})` },
    { id: 'upcoming7', label: `Upcoming 7d (${summary.upcoming7.length})` },
    { id: 'upcoming15', label: `Upcoming 15d (${summary.upcoming15.length})` },
    { id: 'eligibleNotBooked', label: `Eligible & Not Booked (${summary.eligibleNotBooked.length})` },
    { id: 'overdue', label: `Overdue (${summary.overdue.length})` },
    { id: 'alreadyBooked', label: `Already Booked (${summary.alreadyBooked.length})` }
  ];

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Booking Eligibility</h1>
        <p class="page-subtitle">Administrative Tracking Intervals Computed From Last Valid Non-Cancelled Booking</p>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openGasEligibilityRuleModal()">+ Custom Tracking Rule</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('eligibility_list', 'pdf')">Export PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('eligibility_list', 'excel')">Export Excel</button>
      </div>
    </div>

    ${renderPolicyNotice('Disclaimer', BOOKING_ELIGIBILITY_DISCLAIMER, 'warning')}

    <div class="tab-nav" style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:1rem;">
      ${tabs.map(t => `
        <button type="button" class="btn btn-sm ${bucketFilter === t.id ? 'btn-primary' : 'btn-secondary'}" onclick="window.MJK.setGasFilter('gasEligBucket', '${t.id}')">${esc(t.label)}</button>
      `).join('')}
    </div>

    ${list.length === 0 ? renderEmptyState(
      'No Customers in This Eligibility Bucket',
      'Adjust filter tabs or register customers and bookings to track eligibility reminder dates.'
    ) : `
      <div class="table-card" style="overflow-x:auto;margin-bottom:1rem;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Consumer ID</th>
              <th>Last Valid Booking</th>
              <th>Interval Rule</th>
              <th>Next Eligible Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(r => `
              <tr>
                <td><strong>${esc(r.customerName)}</strong><div style="font-size:0.74rem;color:var(--text-muted);">${esc(r.mobile)} · ${esc(r.gasCompany)}</div></td>
                <td class="font-mono">${esc(r.consumerId)}</td>
                <td>${r.lastValidBookingDate ? `${esc(formatDate(r.lastValidBookingDate))} <span style="font-size:0.72rem;color:var(--text-muted);">(${esc(r.lastValidBookingNo)})</span>` : 'No valid booking'}</td>
                <td><strong>${r.intervalDays} days</strong><div style="font-size:0.72rem;color:var(--text-muted);">${esc(r.intervalSource)}</div></td>
                <td><strong>${esc(formatDate(r.nextEligibleDate))}</strong></td>
                <td>${gasBadge(r.statusLabel, statusTone(r.bucket === 'overdue' ? 'overdue' : (r.bucket === 'alreadyBooked' ? 'active' : 'pending')))}</td>
                <td><button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasBookingModal('', '${esc(r.gasCustomerId)}')">Create Booking</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}

    ${rules.length > 0 ? `
      <div class="table-card" style="padding:1rem;">
        <h3 style="margin:0 0 0.65rem;font-size:0.9rem;font-weight:700;">Active Administrative Interval Rules</h3>
        <table class="data-table">
          <thead><tr><th>Rule Name</th><th>Company</th><th>Category</th><th>Interval Days</th></tr></thead>
          <tbody>
            ${rules.map(rl => `
              <tr>
                <td><strong>${esc(rl.ruleName)}</strong></td>
                <td>${esc(rl.gasCompany)}</td>
                <td>${esc(rl.connectionCategory)}</td>
                <td><strong>${rl.intervalDays} Days</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
  `;
}

/* =========================================================================
   5. SUBSIDY & DBT TRACKING
   ========================================================================= */

export function renderGasSubsidyView(state = {}) {
  const q = String(state.gasSubSearch || '').trim().toLowerCase();
  const statusFilter = state.gasSubStatusFilter || 'all';
  const all = getAllGasSubsidies();
  const filtered = all.filter(s => {
    if (statusFilter !== 'all' && s.dbtStatus !== statusFilter) return false;
    if (!q) return true;
    return [s.id, s.customerName, s.consumerId, s.bookingNo, s.bankReference]
      .some(f => String(f || '').toLowerCase().includes(q));
  });

  const canAdd = canPerformGasAction('add', 'gas-subsidy');
  const canEdit = canPerformGasAction('edit', 'gas-subsidy');

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Subsidy & DBT Tracking</h1>
        <p class="page-subtitle">Track Expected Subsidy vs Actual Verified DBT Credited Amounts & Bank Reference Status</p>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('subsidy_dbt', 'pdf')">Export PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('subsidy_dbt', 'excel')">Export Excel</button>
        ${canAdd ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasSubsidyModal()">+ Log Subsidy / DBT Entry</button>` : ''}
      </div>
    </div>

    ${renderPolicyNotice('Security & Accuracy Notice', SUBSIDY_SECURITY_NOTICE, 'info')}

    <div class="table-card" style="padding:0.85rem 1rem;margin-bottom:1rem;display:flex;gap:0.65rem;flex-wrap:wrap;align-items:center;">
      <input id="gas-sub-search" type="text" class="form-control" style="flex:1;min-width:220px;" placeholder="Search by Customer, Consumer ID, Booking No, or Bank Reference..." value="${esc(state.gasSubSearch || '')}" oninput="window.MJK.setGasSearch('gasSubSearch', this.value, 'gas-sub-search')">
      <select class="form-control" style="width:auto;" onchange="window.MJK.setGasFilter('gasSubStatusFilter', this.value)">
        <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All DBT Statuses</option>
        ${GAS_SUBSIDY_STATUSES.map(st => `<option value="${esc(st)}" ${statusFilter === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
      </select>
    </div>

    ${filtered.length === 0 ? renderEmptyState(
      'No Subsidy / DBT Records Found',
      'Record expected subsidy and update with verified DBT credit date and bank reference once confirmed.',
      canAdd ? '+ Log Subsidy / DBT Entry' : '',
      'window.MJK.openGasSubsidyModal()'
    ) : `
      <div class="table-card" style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>DBT ID & Date</th>
              <th>Customer & Consumer ID</th>
              <th>Linked Booking</th>
              <th style="text-align:right;">Expected</th>
              <th style="text-align:right;">Verified Credited</th>
              <th style="text-align:right;">Variance</th>
              <th>Bank Ref / Masked A/C</th>
              <th>DBT Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(s => `
              <tr>
                <td>
                  <strong class="font-mono">${esc(s.id)}</strong>
                  <div style="font-size:0.74rem;color:var(--text-muted);">Book: ${esc(formatDate(s.bookingDate))}</div>
                  ${s.dbtCreditDate ? `<div style="font-size:0.72rem;color:#1d4ed8;font-weight:600;">Est/Credit (+7d): ${esc(formatDate(s.dbtCreditDate))}</div>` : ''}
                </td>
                <td><strong>${esc(s.customerName)}</strong><div style="font-size:0.74rem;color:var(--text-muted);">${esc(s.consumerId || 'Optional')}</div></td>
                <td>${esc(s.bookingNo || '-')}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${formatINR(s.expectedSubsidy)}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;"><strong>${formatINR(s.actualCredited)}</strong></td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${formatINR(s.variance)}</td>
                <td>
                  <div class="font-mono">${esc(s.bankReference || '-')}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted);">${s.maskedBankLast4 ? `A/C: ${esc(s.maskedBankLast4)}` : ''}${s.dbtCreditDate ? ` · Credit: ${esc(formatDate(s.dbtCreditDate))}` : ''}</div>
                </td>
                <td>${gasBadge(s.dbtStatus, statusTone(s.dbtStatus))}</td>
                <td>${canEdit ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openGasSubsidyModal('${esc(s.id)}')">Update</button>` : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

/* =========================================================================
   6. NON-TAKER SUBSIDY DUE LEDGER
   ========================================================================= */

export function renderGasNonTakerView(state = {}) {
  const q = String(state.gasNtSearch || '').trim().toLowerCase();
  const statusFilter = state.gasNtStatusFilter || 'all';
  const all = getAllNonTakerLedgers();
  const filtered = all.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (!q) return true;
    return [l.id, l.customerName, l.consumerId, l.authorizationNote]
      .some(f => String(f || '').toLowerCase().includes(q));
  });

  const totAdv = all.reduce((s, l) => s + (Number(l.actualAuthorizedAdvance) || 0), 0);
  const totRec = all.reduce((s, l) => s + (Number(l.totalRecovery) || 0), 0);
  const totOut = all.reduce((s, l) => s + (Number(l.outstandingAmount) || 0), 0);

  const canAdd = canPerformGasAction('add', 'gas-non-taker');
  const canReverse = canPerformGasAction('reverse', 'gas-non-taker');

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Non-Taker Subsidy Due Ledger</h1>
        <p class="page-subtitle">Authorized Advance Recovery Ledger · Formula: Outstanding = Actual Authorized Advance − Total Recovery</p>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('non_taker_ledger', 'pdf')">Export PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('non_taker_ledger', 'excel')">Export Excel</button>
        ${canAdd ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasNonTakerModal()">+ New Authorized Advance</button>` : ''}
      </div>
    </div>

    ${renderPolicyNotice('Accounting Policy', NON_TAKER_ACCOUNTING_NOTICE, 'warning')}

    <div class="metrics-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.85rem;margin-bottom:1rem;">
      <div class="metric-card" style="background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:0.9rem 1rem;">
        <div style="font-size:0.75rem;color:var(--text-muted);">Total Authorized Advances</div>
        <div style="font-size:1.25rem;font-weight:800;font-variant-numeric:tabular-nums;">${formatINR(totAdv)}</div>
      </div>
      <div class="metric-card" style="background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:0.9rem 1rem;">
        <div style="font-size:0.75rem;color:var(--text-muted);">Total Recovered</div>
        <div style="font-size:1.25rem;font-weight:800;color:#047857;font-variant-numeric:tabular-nums;">${formatINR(totRec)}</div>
      </div>
      <div class="metric-card" style="background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:0.9rem 1rem;">
        <div style="font-size:0.75rem;color:var(--text-muted);">Current Outstanding Due</div>
        <div style="font-size:1.25rem;font-weight:800;color:#b91c1c;font-variant-numeric:tabular-nums;">${formatINR(totOut)}</div>
      </div>
    </div>

    <div class="table-card" style="padding:0.85rem 1rem;margin-bottom:1rem;display:flex;gap:0.65rem;flex-wrap:wrap;align-items:center;">
      <input id="gas-nt-search" type="text" class="form-control" style="flex:1;min-width:220px;" placeholder="Search by Ledger ID, Customer Name, Consumer ID..." value="${esc(state.gasNtSearch || '')}" oninput="window.MJK.setGasSearch('gasNtSearch', this.value, 'gas-nt-search')">
      <select class="form-control" style="width:auto;" onchange="window.MJK.setGasFilter('gasNtStatusFilter', this.value)">
        <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
        <option value="Open" ${statusFilter === 'Open' ? 'selected' : ''}>Open</option>
        <option value="Partially Recovered" ${statusFilter === 'Partially Recovered' ? 'selected' : ''}>Partially Recovered</option>
        <option value="Settled" ${statusFilter === 'Settled' ? 'selected' : ''}>Settled</option>
      </select>
    </div>

    ${filtered.length === 0 ? renderEmptyState(
      'No Authorized Advance Ledger Entries',
      'Record only verified cash/value advances given with explicit customer consent (Presets: ₹120 / ₹130 / Custom).',
      canAdd ? '+ New Authorized Advance' : '',
      'window.MJK.openGasNonTakerModal()'
    ) : `
      <div class="table-card" style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ledger ID & Date</th>
              <th>Customer & Consumer ID</th>
              <th>Consent & Reference</th>
              <th style="text-align:right;">Authorized Advance</th>
              <th style="text-align:right;">Total Recovery</th>
              <th style="text-align:right;">Outstanding Due</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(l => `
              <tr>
                <td><strong class="font-mono">${esc(l.id)}</strong><div style="font-size:0.74rem;color:var(--text-muted);">${esc(formatDate(l.entryDate))}</div></td>
                <td><strong>${esc(l.customerName)}</strong><div style="font-size:0.74rem;color:var(--text-muted);">${esc(l.consumerId)} · ${esc(l.mobile)}</div></td>
                <td>
                  <div style="font-size:0.8rem;">${esc(l.authorizationNote)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted);">Preset: ${esc(l.referencePreset)} · Recoveries: ${(l.recoveries || []).filter(r => !r.reversed).length}</div>
                </td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${formatINR(l.actualAuthorizedAdvance)}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;color:#047857;"><strong>${formatINR(l.totalRecovery)}</strong></td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${gasBadge(formatINR(l.outstandingAmount), l.outstandingAmount > 0 ? 'danger' : 'success')}</td>
                <td>${gasBadge(l.status, statusTone(l.status))}</td>
                <td>
                  <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                    ${l.outstandingAmount > 0 && canAdd ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasNonTakerRecoveryModal('${esc(l.id)}')">Recover</button>` : ''}
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openGasNonTakerHistoryModal('${esc(l.id)}')">Recoveries (${(l.recoveries || []).length})${canReverse ? '' : ''}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

/* =========================================================================
   7. GAS COLLECTION & PAYMENTS
   ========================================================================= */

export function renderGasCollectionsView(state = {}) {
  const q = String(state.gasColSearch || '').trim().toLowerCase();
  const catFilter = state.gasColCatFilter || 'all';
  const all = getAllGasCollections();
  const filtered = all.filter(c => {
    if (catFilter !== 'all' && c.category !== catFilter) return false;
    if (!q) return true;
    return [c.receiptNo, c.customerName, c.consumerId, c.category, c.transactionRef, c.remarks]
      .some(f => String(f || '').toLowerCase().includes(q));
  });

  const canAdd = canPerformGasAction('add', 'gas-collections');
  const canReverse = canPerformGasAction('reverse', 'gas-collections');

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Gas Collection & Payments</h1>
        <p class="page-subtitle">Record Verified Payments, Partial Recoveries, Printable Receipts & Admin-Approved Reversals</p>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('daily_collection', 'pdf')">Export PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('daily_collection', 'excel')">Export Excel</button>
        ${canAdd ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasCollectionModal()">+ Record Gas Collection</button>` : ''}
      </div>
    </div>

    <div class="table-card" style="padding:0.85rem 1rem;margin-bottom:1rem;display:flex;gap:0.65rem;flex-wrap:wrap;align-items:center;">
      <input id="gas-col-search" type="text" class="form-control" style="flex:1;min-width:220px;" placeholder="Search by Receipt No, Customer, Transaction Ref, or Remarks..." value="${esc(state.gasColSearch || '')}" oninput="window.MJK.setGasSearch('gasColSearch', this.value, 'gas-col-search')">
      <select class="form-control" style="width:auto;" onchange="window.MJK.setGasFilter('gasColCatFilter', this.value)">
        <option value="all" ${catFilter === 'all' ? 'selected' : ''}>All Categories</option>
        ${GAS_COLLECTION_CATEGORIES.map(c => `<option value="${esc(c)}" ${catFilter === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
    </div>

    ${filtered.length === 0 ? renderEmptyState(
      'No Gas Collections Recorded',
      'Record Booking Payments, Authorized Advance Recoveries, Service Charges, or Accessories Sales here.',
      canAdd ? '+ Record Gas Collection' : '',
      'window.MJK.openGasCollectionModal()'
    ) : `
      <div class="table-card" style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Receipt No & Date</th>
              <th>Customer</th>
              <th>Category</th>
              <th>Mode & Txn Ref</th>
              <th style="text-align:right;">Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(c => `
              <tr>
                <td><strong class="font-mono">${esc(c.receiptNo)}</strong><div style="font-size:0.74rem;color:var(--text-muted);">${esc(formatDate(c.collectionDate))}</div></td>
                <td><strong>${esc(c.customerName)}</strong><div style="font-size:0.74rem;color:var(--text-muted);">${esc(c.consumerId || c.mobile || '-')}</div></td>
                <td>${esc(c.category)}<div style="font-size:0.72rem;color:var(--text-muted);">${esc(c.bookingId || c.serviceEntryId || c.nonTakerLedgerId || '')}</div></td>
                <td><div>${esc(c.paymentMode)}</div><div class="font-mono" style="font-size:0.72rem;color:var(--text-muted);">${esc(c.transactionRef || '-')}</div></td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;"><strong>${formatINR(c.amount)}</strong></td>
                <td>${gasBadge(c.status, statusTone(c.status))}</td>
                <td>
                  <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.printGasCollectionReceipt('${esc(c.id)}')">Print Receipt</button>
                    ${canReverse && c.status !== 'Reversed' ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.reverseGasCollectionPrompt('${esc(c.id)}')">Reverse</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

/* =========================================================================
   8. ACCESSORIES & RETAIL
   ========================================================================= */

export function renderGasAccessoriesView(state = {}) {
  const q = String(state.gasAccSearch || '').trim().toLowerCase();
  const catFilter = state.gasAccCatFilter || 'all';
  const categories = getInventoryCategories();
  const inv = getAllInventory().filter(i => {
    if (catFilter !== 'all' && i.category !== catFilter) return false;
    if (!q) return true;
    return [i.sku, i.name, i.category, i.brand].some(f => String(f || '').toLowerCase().includes(q));
  });
  const accSales = getAllGasCollections().filter(c => c.category === 'Accessories Sales' && c.status !== 'Reversed');
  const canAdd = canPerformGasAction('add', 'gas-accessories');

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Accessories & Retail</h1>
        <p class="page-subtitle">Integrated Inventory & Retail Counter for Gas Hose Pipes, Regulators, Lighters, Stoves & Fittings</p>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('accessories_sales', 'pdf')">Sales PDF</button>
        ${canAdd ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openGasInventoryItemModal()">+ Add Gas Accessory SKU</button>` : ''}
        ${canAdd ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasAccessorySaleModal()">+ Quick Retail Sale</button>` : ''}
      </div>
    </div>

    <div class="table-card" style="padding:0.85rem 1rem;margin-bottom:1rem;display:flex;gap:0.65rem;flex-wrap:wrap;align-items:center;">
      <input id="gas-acc-search" type="text" class="form-control" style="flex:1;min-width:220px;" placeholder="Search SKU, Product Name, Brand..." value="${esc(state.gasAccSearch || '')}" oninput="window.MJK.setGasSearch('gasAccSearch', this.value, 'gas-acc-search')">
      <select class="form-control" style="width:auto;" onchange="window.MJK.setGasFilter('gasAccCatFilter', this.value)">
        <option value="all" ${catFilter === 'all' ? 'selected' : ''}>All Product Categories</option>
        ${categories.map(c => `<option value="${esc(c)}" ${catFilter === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
    </div>

    ${inv.length === 0 ? renderEmptyState(
      'No Accessories / Hardware SKUs Added Yet',
      'Add Gas Hose Pipes, Gas Regulators, Gas Lighters, Stoves, and Spare Parts to manage retail sales and Service replacements seamlessly.',
      canAdd ? '+ Add First Accessory SKU' : '',
      'window.MJK.openGasInventoryItemModal()'
    ) : `
      <div class="table-card" style="overflow-x:auto;margin-bottom:1.25rem;">
        <table class="data-table">
          <thead>
            <tr>
              <th>SKU & Product</th>
              <th>Category & Brand</th>
              <th style="text-align:right;">Stock</th>
              <th style="text-align:right;">Cost</th>
              <th style="text-align:right;">Selling Price</th>
              <th>Storage</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${inv.map(i => `
              <tr>
                <td><strong>${esc(i.name)}</strong><div class="font-mono" style="font-size:0.74rem;color:var(--text-muted);">${esc(i.sku)}</div></td>
                <td>${esc(i.category)}${i.brand ? ` · ${esc(i.brand)}` : ''}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${gasBadge(`${i.stockQuantity} ${i.unit || 'Pcs'}`, Number(i.stockQuantity) <= Number(i.minStockLevel || 5) ? 'danger' : 'success')}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${formatINR(i.costPrice)}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;"><strong>${formatINR(i.sellingPrice)}</strong></td>
                <td>${esc(i.warehouseName || i.shelfLocation || 'Main Counter')}</td>
                <td>
                  <div style="display:flex;gap:0.35rem;">
                    ${canAdd ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasAccessorySaleModal('${esc(i.id)}')">Sell</button>` : ''}
                    ${canAdd ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openGasInventoryItemModal('${esc(i.id)}')">Edit</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}

    ${accSales.length > 0 ? `
      <div class="table-card" style="padding:1rem;overflow-x:auto;">
        <h3 style="margin:0 0 0.75rem;font-size:0.95rem;font-weight:700;">Recent Accessories Retail Sales (${accSales.length})</h3>
        <table class="data-table">
          <thead><tr><th>Receipt No</th><th>Date</th><th>Customer</th><th>Details</th><th>Mode</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>
            ${accSales.slice(0, 15).map(s => `
              <tr>
                <td class="font-mono">${esc(s.receiptNo)}</td>
                <td>${esc(formatDate(s.collectionDate))}</td>
                <td>${esc(s.customerName)}</td>
                <td>${esc(s.remarks)}</td>
                <td>${esc(s.paymentMode)}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;"><strong>${formatINR(s.amount)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
  `;
}

/* =========================================================================
   9. HARDWARE & STORAGE
   ========================================================================= */

export function renderGasStorageView() {
  const warehouses = getAllGasWarehouses();
  const inv = getAllInventory();
  const movements = getAllGasStockMovements();
  const damaged = getAllGasDamagedStock();
  const canAdd = canPerformGasAction('add', 'gas-storage');

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Hardware & Storage</h1>
        <p class="page-subtitle">Warehouse Locations, Stock In / Out / Transfer, Damaged Stock Register & Full Movement Audit Trail</p>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('inventory_valuation', 'pdf')">Valuation PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('stock_movement', 'excel')">Movement Excel</button>
        ${canAdd ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openGasWarehouseModal()">+ Storage Location</button>` : ''}
        ${canAdd ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasStockMovementModal()">+ Stock In / Out / Damage</button>` : ''}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;margin-bottom:1.25rem;">
      <div class="table-card" style="padding:1rem;">
        <h3 style="margin:0 0 0.65rem;font-size:0.92rem;font-weight:700;">Storage Locations & Racks (${warehouses.length})</h3>
        ${warehouses.length === 0 ? `<div style="font-size:0.82rem;color:var(--text-muted);">No custom warehouses defined. Defaulting to Main Counter / Gas Rack A1.</div>` : `
          <ul style="margin:0;padding-left:1.1rem;font-size:0.84rem;">
            ${warehouses.map(w => `<li style="margin-bottom:0.35rem;"><strong>${esc(w.name)}</strong> (${esc(w.locationType)}, ${w.rackCount} rack(s))</li>`).join('')}
          </ul>
        `}
      </div>
      <div class="table-card" style="padding:1rem;">
        <h3 style="margin:0 0 0.65rem;font-size:0.92rem;font-weight:700;">Damaged / Defective Stock (${damaged.length})</h3>
        ${damaged.length === 0 ? `<div style="font-size:0.82rem;color:var(--text-muted);">No damaged or scrapped hardware recorded.</div>` : `
          <div style="font-size:0.82rem;">
            ${damaged.slice(0, 5).map(d => `<div style="padding:0.25rem 0;border-bottom:1px solid var(--border-subtle);">${esc(d.productName)} — <strong>${d.quantity}</strong> (${esc(d.reason)})</div>`).join('')}
          </div>
        `}
      </div>
    </div>

    <div class="table-card" style="padding:1rem;overflow-x:auto;margin-bottom:1.25rem;">
      <h3 style="margin:0 0 0.75rem;font-size:0.95rem;font-weight:700;">Current Hardware Stock by Location (${inv.length})</h3>
      ${inv.length === 0 ? `<div style="font-size:0.84rem;color:var(--text-muted);">No hardware SKUs in stock yet.</div>` : `
        <table class="data-table">
          <thead><tr><th>SKU</th><th>Product Name</th><th>Category</th><th>Storage / Rack</th><th style="text-align:right;">Opening</th><th style="text-align:right;">Available</th><th style="text-align:right;">Damaged</th></tr></thead>
          <tbody>
            ${inv.map(i => `
              <tr>
                <td class="font-mono">${esc(i.sku)}</td>
                <td><strong>${esc(i.name)}</strong></td>
                <td>${esc(i.category)}</td>
                <td>${esc(i.warehouseName || 'Main Counter')} / ${esc(i.rackShelf || i.shelfLocation || 'A1')}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${Number(i.openingStock ?? i.stockQuantity) || 0}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;"><strong>${Number(i.stockQuantity) || 0}</strong></td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${Number(i.damagedStock) || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <div class="table-card" style="padding:1rem;overflow-x:auto;">
      <h3 style="margin:0 0 0.75rem;font-size:0.95rem;font-weight:700;">Stock Movement History (${movements.length})</h3>
      ${movements.length === 0 ? `<div style="font-size:0.84rem;color:var(--text-muted);">Stock movements from Purchases, Retail Sales, Service Replacements & Transfers appear here.</div>` : `
        <table class="data-table">
          <thead><tr><th>Movement ID</th><th>Date</th><th>Product</th><th>Type</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Balance After</th><th>Reference</th><th>Reason</th></tr></thead>
          <tbody>
            ${movements.slice(0, 50).map(m => `
              <tr>
                <td class="font-mono">${esc(m.id)}</td>
                <td>${esc(formatDate(m.date))}</td>
                <td><strong>${esc(m.productName)}</strong> <span class="font-mono" style="font-size:0.72rem;color:var(--text-muted);">${esc(m.sku)}</span></td>
                <td>${gasBadge(m.movementType, statusTone(m.movementType))}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${m.quantity}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;"><strong>${m.balanceAfter}</strong></td>
                <td class="font-mono">${esc(m.referenceId || '-')}</td>
                <td>${esc(m.reason)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

/* =========================================================================
   10. SUPPLIER & PURCHASE
   ========================================================================= */

export function renderGasSuppliersView() {
  const suppliers = getAllGasSuppliers();
  const purchases = getAllGasPurchases();
  const canAdd = canPerformGasAction('add', 'gas-suppliers');

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Supplier & Purchase</h1>
        <p class="page-subtitle">Manage Gas Hardware Suppliers & Purchase Bills (Auto-Increments Inventory Stock)</p>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('supplier_purchase', 'pdf')">Export PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('supplier_purchase', 'excel')">Export Excel</button>
        ${canAdd ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openGasSupplierModal()">+ Add Supplier</button>` : ''}
        ${canAdd ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasPurchaseModal()">+ Record Purchase Bill</button>` : ''}
      </div>
    </div>

    <div class="table-card" style="padding:1rem;overflow-x:auto;margin-bottom:1.25rem;">
      <h3 style="margin:0 0 0.75rem;font-size:0.95rem;font-weight:700;">Registered Suppliers (${suppliers.length})</h3>
      ${suppliers.length === 0 ? `<div style="font-size:0.84rem;color:var(--text-muted);">No suppliers registered yet. Add a supplier before recording purchase bills.</div>` : `
        <table class="data-table">
          <thead><tr><th>Supplier ID</th><th>Supplier Name</th><th>Contact & Mobile</th><th>GSTIN</th><th>Address</th><th>Action</th></tr></thead>
          <tbody>
            ${suppliers.map(s => `
              <tr>
                <td class="font-mono">${esc(s.id)}</td>
                <td><strong>${esc(s.name)}</strong></td>
                <td>${esc(s.contactPerson || '-')} · ${esc(s.mobile || '-')}</td>
                <td class="font-mono">${esc(s.gstin || '-')}</td>
                <td>${esc(s.address || '-')}</td>
                <td>${canAdd ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openGasSupplierModal('${esc(s.id)}')">Edit</button>` : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    ${purchases.length === 0 ? renderEmptyState(
      'No Purchase Bills Recorded',
      'Recording a purchase bill automatically adds stock quantities into Inventory and logs STOCK_IN movements.',
      canAdd ? '+ Record Purchase Bill' : '',
      'window.MJK.openGasPurchaseModal()'
    ) : `
      <div class="table-card" style="padding:1rem;overflow-x:auto;">
        <h3 style="margin:0 0 0.75rem;font-size:0.95rem;font-weight:700;">Supplier Purchase Bills (${purchases.length})</h3>
        <table class="data-table">
          <thead><tr><th>Purchase No</th><th>Bill No</th><th>Date</th><th>Supplier</th><th>Items</th><th style="text-align:right;">Total</th><th style="text-align:right;">Paid</th><th style="text-align:right;">Due</th><th>Status</th></tr></thead>
          <tbody>
            ${purchases.map(p => `
              <tr>
                <td class="font-mono"><strong>${esc(p.purchaseNo)}</strong></td>
                <td class="font-mono">${esc(p.billNumber)}</td>
                <td>${esc(formatDate(p.purchaseDate))}</td>
                <td><strong>${esc(p.supplierName)}</strong></td>
                <td>${(p.items || []).map(it => `${esc(it.productName)} x${it.quantity}`).join(', ')}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;"><strong>${formatINR(p.totalAmount)}</strong></td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${formatINR(p.paidAmount)}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${formatINR(p.dueAmount)}</td>
                <td>${gasBadge(p.paymentStatus, statusTone(p.paymentStatus))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

/* =========================================================================
   11. CUSTOMER SERVICE & REPLACEMENT ENTRY (SEPARATE MODULE)
   ========================================================================= */

export function renderGasServiceReplacementView(state = {}) {
  const q = String(state.gasSrvSearch || '').trim().toLowerCase();
  const typeFilter = state.gasSrvTypeFilter || 'all';
  const customers = getAllGasCustomers();
  const inventory = getAllInventory();
  const settings = getGasSettings();
  const entries = getAllGasServiceEntries().filter(e => {
    if (typeFilter !== 'all' && e.serviceType !== typeFilter) return false;
    if (!q) return true;
    return [e.serviceId, e.customerName, e.consumerId, e.serviceType, e.newRegulatorDetails, e.newPipeDetails, e.technicianName]
      .some(f => String(f || '').toLowerCase().includes(q));
  });

  const canAdd = canPerformGasAction('add', 'gas-service-replacement');
  const canReverse = canPerformGasAction('reverse', 'gas-service-replacement');
  const isAdmin = canPerformGasAction('negativeStockOverride', 'gas-service-replacement');

  const regulatorProducts = inventory.filter(i => /regulator/i.test(i.category) || /regulator/i.test(i.name));
  const pipeProducts = inventory.filter(i => /pipe|hose/i.test(i.category) || /pipe|hose/i.test(i.name));
  const allInvFallback = inventory;

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Customer Service & Replacement Entry</h1>
        <p class="page-subtitle">Regulator & Gas Pipe Replacement, Auto Financial Calculation & Atomic Inventory Stock Deduction</p>
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('service_replacement_register', 'pdf')">Service Register PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportGasReportDirect('regulator_pipe_replacement', 'excel')">Replacements Excel</button>
      </div>
    </div>

    ${canAdd ? `
      <div class="table-card" style="padding:1.15rem;margin-bottom:1.25rem;">
        <h3 style="margin:0 0 0.85rem;font-size:1rem;font-weight:700;">New Service & Replacement Entry</h3>
        ${customers.length === 0 ? `
          <div style="padding:0.85rem;background:#fffbeb;border:1px solid #fde68a;border-radius:var(--radius-md);font-size:0.84rem;color:#78350f;">
            Please register at least one Gas Customer in <strong>Gas Customer Register</strong> first.
            <button type="button" class="btn btn-secondary btn-sm" style="margin-left:0.5rem;" onclick="window.MJK.openGasCustomerModal()">+ Register Customer</button>
          </div>
        ` : `
          <form id="gas-srv-entry-form" onsubmit="window.MJK.submitGasServiceEntry(event)">
            <div class="form-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0.75rem;margin-bottom:0.85rem;">
              <div class="form-group">
                <label class="form-label">Gas Customer *</label>
                <select id="gsrv-cust" class="form-control" required onchange="window.MJK.handleGasServiceCustChange(this.value)">
                  <option value="">-- Select Registered Gas Customer --</option>
                  ${customers.map(c => `<option value="${esc(c.id)}">${esc(c.fullName)} (${esc(c.consumerId)} · ${esc(c.mobile)})</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Service Date *</label>
                <input id="gsrv-date" type="date" class="form-control" value="${esc(getTodayDate())}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Service Type *</label>
                <select id="gsrv-type" class="form-control" required onchange="window.MJK.handleGasServiceTypeChange(this.value)">
                  ${GAS_SERVICE_TYPES.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Technician / Staff Name</label>
                <input id="gsrv-tech" type="text" class="form-control" placeholder="Staff / Technician name">
              </div>
            </div>

            <div class="form-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0.75rem;margin-bottom:0.85rem;">
              <div class="form-group">
                <label class="form-label">Complaint / Inspection Issue</label>
                <input id="gsrv-complaint" type="text" class="form-control" placeholder="e.g., Gas smell near regulator / Cracked pipe">
              </div>
              <div class="form-group">
                <label class="form-label">Next Service Due Date</label>
                <input id="gsrv-next-due" type="date" class="form-control">
              </div>
              <div class="form-group">
                <label class="form-label">Remarks</label>
                <input id="gsrv-remarks" type="text" class="form-control" placeholder="Safety test & leak check remarks">
              </div>
            </div>

            <div id="gsrv-regulator-box" style="background:var(--surface-alt);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:0.85rem;margin-bottom:0.85rem;">
              <div style="font-size:0.8rem;font-weight:700;color:var(--blue-700);margin-bottom:0.5rem;">Regulator Replacement Details (Linked to Inventory)</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.65rem;">
                <div>
                  <label class="form-label">Select Regulator SKU from Stock</label>
                  <select id="gsrv-reg-sku" class="form-control" onchange="window.MJK.handleGasServiceSkuPick('reg', this)">
                    <option value="">-- Optional / No Stock Deduction --</option>
                    ${(regulatorProducts.length > 0 ? regulatorProducts : allInvFallback).map(i => `<option value="${esc(i.id)}" data-price="${Number(i.sellingPrice) || 0}" data-brand="${esc(i.brand || '')}" data-stock="${Number(i.stockQuantity) || 0}">${esc(i.name)} (${esc(i.sku)}) · Stock: ${i.stockQuantity} · ₹${i.sellingPrice}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="form-label">Regulator Qty</label>
                  <input id="gsrv-reg-qty" type="number" min="1" step="1" value="1" class="form-control" oninput="window.MJK.recalcGasServiceTotals()">
                </div>
                <div>
                  <label class="form-label">Previous Regulator Info</label>
                  <input id="gsrv-old-reg" type="text" class="form-control" placeholder="Old regulator brand / condition">
                </div>
                <div>
                  <label class="form-label">New Regulator Details / Brand</label>
                  <input id="gsrv-new-reg" type="text" class="form-control" placeholder="New regulator model / serial">
                </div>
              </div>
            </div>

            <div id="gsrv-pipe-box" style="display:none;background:var(--surface-alt);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:0.85rem;margin-bottom:0.85rem;">
              <div style="font-size:0.8rem;font-weight:700;color:var(--blue-700);margin-bottom:0.5rem;">Gas Pipe / Suraksha Hose Replacement Details (Linked to Inventory)</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.65rem;">
                <div>
                  <label class="form-label">Select Pipe SKU from Stock</label>
                  <select id="gsrv-pipe-sku" class="form-control" onchange="window.MJK.handleGasServiceSkuPick('pipe', this)">
                    <option value="">-- Optional / No Stock Deduction --</option>
                    ${(pipeProducts.length > 0 ? pipeProducts : allInvFallback).map(i => `<option value="${esc(i.id)}" data-price="${Number(i.sellingPrice) || 0}" data-brand="${esc(i.brand || '')}" data-stock="${Number(i.stockQuantity) || 0}">${esc(i.name)} (${esc(i.sku)}) · Stock: ${i.stockQuantity} · ₹${i.sellingPrice}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="form-label">Pipe Qty</label>
                  <input id="gsrv-pipe-qty" type="number" min="1" step="1" value="1" class="form-control" oninput="window.MJK.recalcGasServiceTotals()">
                </div>
                <div>
                  <label class="form-label">Previous Pipe Info</label>
                  <input id="gsrv-old-pipe" type="text" class="form-control" placeholder="Old pipe condition / expiry">
                </div>
                <div>
                  <label class="form-label">New Pipe Details / Brand</label>
                  <input id="gsrv-new-pipe" type="text" class="form-control" placeholder="Suraksha / ISI hose details">
                </div>
              </div>
            </div>

            <div style="background:var(--surface-alt);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:0.85rem;margin-bottom:0.85rem;">
              <div style="font-size:0.8rem;font-weight:700;color:var(--blue-700);margin-bottom:0.5rem;">Charges, Discount & Payment Calculation</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:0.65rem;">
                <div><label class="form-label">Regulator Charge (₹)</label><input id="gsrv-chg-reg" type="number" min="0" step="0.01" value="0" class="form-control" oninput="window.MJK.recalcGasServiceTotals()"></div>
                <div><label class="form-label">Pipe Charge (₹)</label><input id="gsrv-chg-pipe" type="number" min="0" step="0.01" value="0" class="form-control" oninput="window.MJK.recalcGasServiceTotals()"></div>
                <div><label class="form-label">Other Charges (₹)</label><input id="gsrv-chg-other" type="number" min="0" step="0.01" value="0" class="form-control" oninput="window.MJK.recalcGasServiceTotals()"></div>
                <div><label class="form-label">Service Fee (₹)</label><input id="gsrv-chg-fee" type="number" min="0" step="0.01" value="${Number(settings.defaultServiceCharges?.regulatorChange || 150)}" class="form-control" oninput="window.MJK.recalcGasServiceTotals()"></div>
                <div><label class="form-label">Discount (₹)</label><input id="gsrv-discount" type="number" min="0" step="0.01" value="0" class="form-control" oninput="window.MJK.recalcGasServiceTotals()"></div>
                <div><label class="form-label">Net Total (₹)</label><input id="gsrv-total" type="number" readonly value="${Number(settings.defaultServiceCharges?.regulatorChange || 150)}" class="form-control" style="font-weight:800;background:#fff;"></div>
                <div><label class="form-label">Received (₹)</label><input id="gsrv-received" type="number" min="0" step="0.01" value="${Number(settings.defaultServiceCharges?.regulatorChange || 150)}" class="form-control" oninput="window.MJK.recalcGasServiceTotals()"></div>
                <div><label class="form-label">Due Amount (₹)</label><input id="gsrv-due" type="number" readonly value="0" class="form-control" style="font-weight:700;background:#fff;"></div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.65rem;margin-top:0.65rem;align-items:end;">
                <div>
                  <label class="form-label">Payment Mode</label>
                  <select id="gsrv-pay-mode" class="form-control">
                    ${GAS_PAYMENT_MODES.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="form-label">Transaction Reference / UTR</label>
                  <input id="gsrv-txn-ref" type="text" class="form-control" placeholder="Optional UTR / Ref">
                </div>
                ${isAdmin && settings.allowNegativeStockAdminOverride ? `
                  <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.78rem;padding:0.45rem 0;">
                    <input id="gsrv-neg-override" type="checkbox"> Admin Negative Stock Override
                  </label>
                ` : ''}
                <div style="text-align:right;">
                  <button type="submit" class="btn btn-primary">Save Service & Deduct Stock</button>
                </div>
              </div>
            </div>
          </form>
        `}
      </div>
    ` : ''}

    <div class="table-card" style="padding:0.85rem 1rem;margin-bottom:1rem;display:flex;gap:0.65rem;flex-wrap:wrap;align-items:center;">
      <input id="gas-srv-search" type="text" class="form-control" style="flex:1;min-width:220px;" placeholder="Search Service ID, Customer, Consumer ID, Regulator/Pipe details..." value="${esc(state.gasSrvSearch || '')}" oninput="window.MJK.setGasSearch('gasSrvSearch', this.value, 'gas-srv-search')">
      <select class="form-control" style="width:auto;" onchange="window.MJK.setGasFilter('gasSrvTypeFilter', this.value)">
        <option value="all" ${typeFilter === 'all' ? 'selected' : ''}>All Service Types</option>
        ${GAS_SERVICE_TYPES.map(t => `<option value="${esc(t)}" ${typeFilter === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
      </select>
    </div>

    ${entries.length === 0 ? renderEmptyState(
      'No Service & Replacement Entries Found',
      'Use the form above to record Regulator Change, Gas Pipe Change, Both, or Other Gas Service with automatic stock deduction.'
    ) : `
      <div class="table-card" style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Service ID & Date</th>
              <th>Customer</th>
              <th>Service Type & Hardware</th>
              <th style="text-align:right;">Total</th>
              <th style="text-align:right;">Paid</th>
              <th style="text-align:right;">Due</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(e => `
              <tr>
                <td><strong class="font-mono">${esc(e.serviceId)}</strong><div style="font-size:0.74rem;color:var(--text-muted);">${esc(formatDate(e.serviceDate))}</div></td>
                <td><strong>${esc(e.customerName)}</strong><div style="font-size:0.74rem;color:var(--text-muted);">${esc(e.consumerId)} · ${esc(e.mobile)}</div></td>
                <td>
                  <strong>${esc(e.serviceType)}</strong>
                  <div style="font-size:0.74rem;color:var(--text-muted);">
                    ${e.newRegulatorDetails ? `Reg: ${esc(e.newRegulatorDetails)} (${e.regulatorQty || 1})` : ''}
                    ${e.newPipeDetails ? ` · Pipe: ${esc(e.newPipeDetails)} (${e.pipeQty || 1})` : ''}
                  </div>
                </td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;"><strong>${formatINR(e.totalAmount)}</strong></td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${formatINR(e.amountReceived)}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${gasBadge(formatINR(e.dueAmount), e.dueAmount > 0 ? 'danger' : 'success')}</td>
                <td>${gasBadge(e.status, statusTone(e.status))}</td>
                <td>
                  <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.printGasServiceReceipt('${esc(e.serviceId)}')">Receipt</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportGasServicePdf('${esc(e.serviceId)}')">PDF</button>
                    ${canReverse && e.status !== 'Cancelled' ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.reverseGasServicePrompt('${esc(e.serviceId)}')">Cancel & Restore</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

/* =========================================================================
   12. GAS REPORTS (ALL 19 STANDARDIZED REPORTS)
   ========================================================================= */

export function renderGasReportsView(state = {}) {
  const activeKey = state.gasReportKey || GAS_REPORT_DEFINITIONS[0].id;
  const dateFrom = state.gasReportDateFrom || '';
  const dateTo = state.gasReportDateTo || '';
  const search = state.gasReportSearch || '';
  const dataset = buildGasReportDataset(activeKey, { dateFrom, dateTo, search });

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Gas Reports</h1>
        <p class="page-subtitle">19 Standardized Gas Reports with MUN COMPUTER Corporate Header — Print, PDF, Excel & CSV</p>
      </div>
      <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportActiveGasReport('print')">Print Report</button>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.exportActiveGasReport('pdf')">Download PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportActiveGasReport('excel')">Download Excel</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportActiveGasReport('csv')">Download CSV</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0.55rem;margin-bottom:1rem;">
      ${GAS_REPORT_DEFINITIONS.map((r, idx) => `
        <button type="button" class="btn btn-sm ${activeKey === r.id ? 'btn-primary' : 'btn-secondary'}" style="justify-content:flex-start;text-align:left;padding:0.55rem 0.75rem;" onclick="window.MJK.setGasFilter('gasReportKey', '${esc(r.id)}')">
          <span style="opacity:0.75;margin-right:0.35rem;font-variant-numeric:tabular-nums;">${String(idx + 1).padStart(2, '0')}.</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.title)}</span>
        </button>
      `).join('')}
    </div>

    <div class="table-card" style="padding:0.85rem 1rem;margin-bottom:1rem;display:flex;gap:0.65rem;flex-wrap:wrap;align-items:center;">
      <input id="gas-rpt-search" type="text" class="form-control" style="flex:1;min-width:200px;" placeholder="Filter active report rows..." value="${esc(search)}" oninput="window.MJK.setGasSearch('gasReportSearch', this.value, 'gas-rpt-search')">
      <input type="date" class="form-control" style="width:auto;" value="${esc(dateFrom)}" onchange="window.MJK.setGasFilter('gasReportDateFrom', this.value)">
      <input type="date" class="form-control" style="width:auto;" value="${esc(dateTo)}" onchange="window.MJK.setGasFilter('gasReportDateTo', this.value)">
      <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.resetGasReportFilters()">Reset</button>
    </div>

    <div class="table-card" style="padding:1rem;overflow-x:auto;">
      <div style="margin-bottom:0.75rem;">
        <h3 style="margin:0;font-size:1rem;font-weight:800;">${esc(dataset.title)}</h3>
        <div style="font-size:0.78rem;color:var(--text-muted);">${esc(dataset.subtitle)} · ${dataset.rows.length} row(s)</div>
      </div>

      ${dataset.rows.length === 0 ? `
        <div style="padding:2rem 1rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">No matching records found for this report & date filter.</div>
      ` : `
        <table class="data-table">
          <thead><tr>${dataset.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>
            ${dataset.rows.map(row => `
              <tr>${row.map(cell => `<td style="font-variant-numeric:tabular-nums;">${esc(cell)}</td>`).join('')}</tr>
            `).join('')}
            ${dataset.totalsRow ? `
              <tr style="background:var(--surface-alt);font-weight:800;">
                ${dataset.totalsRow.map(cell => `<td style="font-variant-numeric:tabular-nums;">${esc(cell)}</td>`).join('')}
              </tr>
            ` : ''}
          </tbody>
        </table>
      `}
    </div>
  `;
}

/* =========================================================================
   13. GAS SETTINGS (DYNAMIC AGENCIES, CYLINDERS, PRICING, AREAS, RIDERS) & AUDIT LOGS
   ========================================================================= */

export function renderGasSettingsView(state = {}) {
  const s = getGasSettings();
  const auditLogs = getGasAuditLogs();
  const canEdit = canPerformGasAction('settings', 'gas-settings');
  const activeTab = state?.gasSettingsTab || 'general';
  const agencies = getGasAgencies();
  const cylinders = getGasCylinderTypes();
  const areas = getGasDeliveryAreas();
  const riders = getAllGasDeliveryPersons();
  const pricing = s.deliveryPricingConfig || {};
  const tiers = pricing.distanceTiers || [];
  const mc = s.mainCentre || {};

  const tabs = [
    { id: 'general', label: 'General & Main Centre' },
    { id: 'agencies', label: `Agencies (${agencies.length})` },
    { id: 'cylinders', label: `Cylinder Types (${cylinders.length})` },
    { id: 'pricing', label: 'Delivery Pricing Rules' },
    { id: 'areas', label: `Areas & Villages (${areas.length})` },
    { id: 'personnel', label: `Delivery Personnel (${riders.length})` }
  ];

  let tabBody = '';
  if (activeTab === 'general') {
    tabBody = `
      <form onsubmit="window.MJK.submitGasSettings(event)">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.85rem;margin-bottom:0.85rem;">
          <div class="form-group">
            <label class="form-label">Default Booking Eligibility Interval (Days)</label>
            <select id="gset-elig-days" class="form-control" ${!canEdit ? 'disabled' : ''}>
              ${[25, 30, 45, 60].map(d => `<option value="${d}" ${Number(s.defaultEligibilityDays) === d ? 'selected' : ''}>${d} Days (Preset)</option>`).join('')}
              ${![25, 30, 45, 60].includes(Number(s.defaultEligibilityDays)) ? `<option value="${s.defaultEligibilityDays}" selected>${s.defaultEligibilityDays} Days (Custom)</option>` : ''}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Custom Override Default Interval (Days)</label>
            <input id="gset-elig-custom" type="number" min="1" max="365" value="${Number(s.defaultEligibilityDays) || 30}" class="form-control" ${!canEdit ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label class="form-label">Non-Taker Reference Presets (Comma-separated ₹)</label>
            <input id="gset-nt-presets" type="text" value="${esc((s.nonTakerReferencePresets || [120, 130]).join(', '))}" class="form-control" ${!canEdit ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label class="form-label">Gas Companies (Comma-separated)</label>
            <input id="gset-companies" type="text" value="${esc((s.gasCompanies || []).join(', '))}" class="form-control" ${!canEdit ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label class="form-label">Payment Methods (Comma-separated)</label>
            <input id="gset-paymethods" type="text" value="${esc((s.paymentMethods || GAS_PAYMENT_MODES).join(', '))}" class="form-control" ${!canEdit ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label class="form-label">Default Pipe Re-inspection Cycle (Days)</label>
            <input id="gset-pipe-cycle" type="number" min="30" value="${Number(s.defaultPipeServiceCycleDays) || 730}" class="form-control" ${!canEdit ? 'disabled' : ''}>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.75rem;margin-bottom:0.85rem;">
          <div><label class="form-label">Regulator Change Fee (₹)</label><input id="gset-fee-reg" type="number" min="0" value="${Number(s.defaultServiceCharges?.regulatorChange || 150)}" class="form-control" ${!canEdit ? 'disabled' : ''}></div>
          <div><label class="form-label">Pipe Change Fee (₹)</label><input id="gset-fee-pipe" type="number" min="0" value="${Number(s.defaultServiceCharges?.pipeChange || 100)}" class="form-control" ${!canEdit ? 'disabled' : ''}></div>
          <div><label class="form-label">Both Reg + Pipe Fee (₹)</label><input id="gset-fee-both" type="number" min="0" value="${Number(s.defaultServiceCharges?.bothChange || 200)}" class="form-control" ${!canEdit ? 'disabled' : ''}></div>
          <div><label class="form-label">Other Service Fee (₹)</label><input id="gset-fee-other" type="number" min="0" value="${Number(s.defaultServiceCharges?.otherService || 100)}" class="form-control" ${!canEdit ? 'disabled' : ''}></div>
        </div>

        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:0.85rem;margin-bottom:0.9rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.55rem;">
            <strong style="font-size:0.86rem;color:#0b3b8c;">Main Delivery Dispatch Centre (MUN COMPUTER)</strong>
            ${canEdit ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.geocodeGasMainCentre()">Locate Main Centre on Map (Geocode)</button>` : ''}
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.65rem;">
            <div><label class="form-label">Centre Name</label><input id="gset-mc-name" type="text" class="form-control" value="${esc(mc.name || 'MUN COMPUTER')}" ${!canEdit ? 'disabled' : ''}></div>
            <div style="grid-column:span 2;"><label class="form-label">Full Origin Address</label><input id="gset-mc-addr" type="text" class="form-control" value="${esc(mc.fullAddress || '')}" ${!canEdit ? 'disabled' : ''}></div>
            <div><label class="form-label">Origin Latitude</label><input id="gset-mc-lat" type="number" step="0.000001" class="form-control font-mono" value="${mc.lat ?? ''}" placeholder="Click Locate or enter" ${!canEdit ? 'disabled' : ''}></div>
            <div><label class="form-label">Origin Longitude</label><input id="gset-mc-lng" type="number" step="0.000001" class="form-control font-mono" value="${mc.lng ?? ''}" placeholder="Click Locate or enter" ${!canEdit ? 'disabled' : ''}></div>
          </div>
        </div>

        <div style="display:flex;gap:1.5rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem;">
          <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.84rem;">
            <input id="gset-neg-override" type="checkbox" ${s.allowNegativeStockAdminOverride ? 'checked' : ''} ${!canEdit ? 'disabled' : ''}> Allow Admin Negative Stock Override
          </label>
          <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.84rem;">
            <input id="gset-sync-cust" type="checkbox" ${s.autoSyncCustomerDirectory ? 'checked' : ''} ${!canEdit ? 'disabled' : ''}> Auto-sync Gas Customers to Central Customer Directory
          </label>
        </div>

        ${canEdit ? `<button type="submit" class="btn btn-primary">Save General Settings & Main Centre</button>` : ''}
      </form>
    `;
  } else if (activeTab === 'agencies') {
    tabBody = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.85rem;flex-wrap:wrap;gap:0.5rem;">
        <div>
          <h3 style="margin:0;font-size:0.95rem;font-weight:800;">LPG Agencies / Distributors</h3>
          <div style="font-size:0.78rem;color:var(--text-muted);">Dynamic agencies shown across Customer Registration, Booking Register & Filters (e.g., MAMENPUR INDANE GRAMIN VITRAK)</div>
        </div>
        ${canEdit ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasAgencyEditModal()">+ Add Agency / Distributor</button>` : ''}
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>Agency / Distributor Name</th><th>Company</th><th>Code / Phone</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${agencies.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1.25rem;">No agencies registered yet.</td></tr>` : agencies.map(a => `
              <tr>
                <td><strong>${esc(a.name)}</strong>${a.address ? `<div style="font-size:0.74rem;color:var(--text-muted);">${esc(a.address)}</div>` : ''}</td>
                <td>${esc(a.company || '-')}</td>
                <td class="font-mono" style="font-size:0.78rem;">${esc([a.code, a.phone].filter(Boolean).join(' · ') || '-')}</td>
                <td>${gasBadge(a.isActive === false ? 'Inactive' : 'Active', statusTone(a.isActive === false ? 'Inactive' : 'Active'))}</td>
                <td>
                  ${canEdit ? `
                    <div style="display:flex;gap:0.35rem;">
                      <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openGasAgencyEditModal('${esc(a.id)}')">Edit</button>
                      <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.deleteGasAgencyConfirm('${esc(a.id)}')">Delete</button>
                    </div>
                  ` : '-'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (activeTab === 'cylinders') {
    tabBody = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.85rem;flex-wrap:wrap;gap:0.5rem;">
        <div>
          <h3 style="margin:0;font-size:0.95rem;font-weight:800;">LPG Cylinder Types & Default Refill Prices</h3>
          <div style="font-size:0.78rem;color:var(--text-muted);">Manage cylinder capacities (14.2 Kg, 5 Kg, 19 Kg, Custom) and default booking prices</div>
        </div>
        ${canEdit ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasCylinderTypeModal()">+ Add Cylinder Type</button>` : ''}
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>Cylinder Type</th><th style="text-align:right;">Default Refill Price (₹)</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${cylinders.map(cy => `
              <tr>
                <td><strong>${esc(cy.name)}</strong></td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;"><strong>${formatINR(cy.defaultPrice)}</strong></td>
                <td>${gasBadge(cy.isActive === false ? 'Inactive' : 'Active', statusTone(cy.isActive === false ? 'Inactive' : 'Active'))}</td>
                <td>
                  ${canEdit ? `
                    <div style="display:flex;gap:0.35rem;">
                      <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openGasCylinderTypeModal('${esc(cy.id)}')">Edit</button>
                      <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.deleteGasCylinderTypeConfirm('${esc(cy.id)}')">Delete</button>
                    </div>
                  ` : '-'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (activeTab === 'pricing') {
    tabBody = `
      <form onsubmit="window.MJK.submitGasDeliveryPricingConfig(event)">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.75rem;margin-bottom:1rem;">
          <div>
            <label class="form-label">Default Delivery Pricing Method</label>
            <select id="gpric-method" class="form-control" ${!canEdit ? 'disabled' : ''}>
              ${GAS_DELIVERY_PRICING_METHODS.map(m => `<option value="${esc(m)}" ${(pricing.defaultMethod || 'Distance-Based Tiers') === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Fixed Delivery Charge (₹)</label><input id="gpric-fixed" type="number" min="0" step="0.01" class="form-control" value="${Number(pricing.fixedCharge ?? 30)}" ${!canEdit ? 'disabled' : ''}></div>
          <div><label class="form-label">Per KM Rate (₹ / KM)</label><input id="gpric-perkm" type="number" min="0" step="0.5" class="form-control" value="${Number(pricing.perKmRate ?? 10)}" ${!canEdit ? 'disabled' : ''}></div>
          <div><label class="form-label">Above Max Tier Default (₹)</label><input id="gpric-above" type="number" min="0" step="1" class="form-control" value="${Number(pricing.aboveMaxTierDefaultCharge ?? 70)}" ${!canEdit ? 'disabled' : ''}></div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
          <strong style="font-size:0.86rem;">Distance-Based Tier Table (e.g. 0–2 KM, 2–5 KM, 5–10 KM)</strong>
          ${canEdit ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.addGasPricingTierRow()">+ Add Tier Row</button>` : ''}
        </div>
        <div style="overflow-x:auto;margin-bottom:1rem;">
          <table class="data-table">
            <thead><tr><th>Tier Label</th><th>Min KM</th><th>Max KM</th><th>Delivery Charge (₹)</th><th>Remove</th></tr></thead>
            <tbody id="gpric-tiers-body">
              ${tiers.map((t, idx) => `
                <tr data-tier-row>
                  <td><input type="text" class="form-control" data-tier-field="label" value="${esc(t.label)}" ${!canEdit ? 'disabled' : ''}></td>
                  <td><input type="number" min="0" step="0.1" class="form-control" data-tier-field="minKm" value="${Number(t.minKm)}" ${!canEdit ? 'disabled' : ''}></td>
                  <td><input type="number" min="0" step="0.1" class="form-control" data-tier-field="maxKm" value="${Number(t.maxKm)}" ${!canEdit ? 'disabled' : ''}></td>
                  <td><input type="number" min="0" step="1" class="form-control" data-tier-field="charge" value="${Number(t.charge)}" ${!canEdit ? 'disabled' : ''}></td>
                  <td>${canEdit ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">Remove</button>` : `${idx + 1}`}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${canEdit ? `<button type="submit" class="btn btn-primary">Save Delivery Pricing Rules</button>` : ''}
      </form>
    `;
  } else if (activeTab === 'areas') {
    tabBody = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.85rem;flex-wrap:wrap;gap:0.5rem;">
        <div>
          <h3 style="margin:0;font-size:0.95rem;font-weight:800;">Delivery Areas / Villages & Standard Charges</h3>
          <div style="font-size:0.78rem;color:var(--text-muted);">Used by Area/Village-Based Charge calculation in New Gas Booking</div>
        </div>
        ${canEdit ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasDeliveryAreaModal()">+ Add Delivery Area</button>` : ''}
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>Village / Area Name</th><th style="text-align:right;">Estimated Dist (KM)</th><th style="text-align:right;">Area Charge (₹)</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${areas.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1.25rem;">No delivery areas configured yet.</td></tr>` : areas.map(ar => `
              <tr>
                <td><strong>${esc(ar.name)}</strong></td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${Number(ar.distanceKm || 0)} KM</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;"><strong>${formatINR(ar.charge)}</strong></td>
                <td>${gasBadge(ar.isActive === false ? 'Inactive' : 'Active', statusTone(ar.isActive === false ? 'Inactive' : 'Active'))}</td>
                <td>
                  ${canEdit ? `
                    <div style="display:flex;gap:0.35rem;">
                      <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openGasDeliveryAreaModal('${esc(ar.id)}')">Edit</button>
                      <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.deleteGasDeliveryAreaConfirm('${esc(ar.id)}')">Delete</button>
                    </div>
                  ` : '-'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    tabBody = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.85rem;flex-wrap:wrap;gap:0.5rem;">
        <div>
          <h3 style="margin:0;font-size:0.95rem;font-weight:800;">LPG Delivery Personnel</h3>
          <div style="font-size:0.78rem;color:var(--text-muted);">Manage riders assigned to gas bookings and live dispatch tracking</div>
        </div>
        ${canEdit ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openGasDeliveryPersonModal()">+ Add Delivery Person</button>` : ''}
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>ID & Name</th><th>Mobile</th><th>Assigned Area & Vehicle</th><th>Availability</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            ${riders.length === 0 ? `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:1.25rem;">No delivery riders added yet. Click "+ Add Delivery Person" to get started.</td></tr>` : riders.map(p => `
              <tr>
                <td><strong class="font-mono">${esc(p.id)}</strong><div style="font-weight:700;">${esc(p.name)}</div></td>
                <td class="font-mono">${esc(p.mobile)}</td>
                <td><div>${esc(p.assignedArea || 'All Domkal Villages')}</div><div style="font-size:0.73rem;color:var(--text-muted);">${esc([p.vehicleInfo, p.address].filter(Boolean).join(' · ') || '-')}</div></td>
                <td>${gasBadge(p.availabilityStatus || 'Available', statusTone(p.availabilityStatus || 'Available'))}</td>
                <td>${gasBadge(p.isActive === false ? 'Inactive' : 'Active', statusTone(p.isActive === false ? 'Inactive' : 'Active'))}</td>
                <td>
                  ${canEdit ? `
                    <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                      <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openGasDeliveryPersonModal('${esc(p.id)}')">Edit</button>
                      <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.toggleGasDeliveryPerson('${esc(p.id)}')">${p.isActive === false ? 'Activate' : 'Deactivate'}</button>
                      <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.deleteGasDeliveryPersonConfirm('${esc(p.id)}')">Delete</button>
                    </div>
                  ` : '-'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Gas Settings & Master Configuration</h1>
        <p class="page-subtitle">Agencies, Cylinder Types, Delivery Pricing Rules, Delivery Personnel, Main Centre Location & Audit Trail</p>
      </div>
    </div>

    ${!canEdit ? renderPolicyNotice('Read-Only Access', 'Gas Settings modifications are restricted to Administration.', 'warning') : ''}

    <div class="tab-nav" style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-bottom:1rem;">
      ${tabs.map(t => `
        <button type="button" class="btn btn-sm ${activeTab === t.id ? 'btn-primary' : 'btn-secondary'}" onclick="window.MJK.setGasFilter('gasSettingsTab', '${t.id}')">${esc(t.label)}</button>
      `).join('')}
    </div>

    <div class="table-card" style="padding:1.15rem;margin-bottom:1.25rem;">
      ${tabBody}
    </div>

    <div class="table-card" style="padding:1rem;overflow-x:auto;">
      <h3 style="margin:0 0 0.75rem;font-size:0.95rem;font-weight:700;">LPG & Gas Audit Log (${auditLogs.length})</h3>
      ${auditLogs.length === 0 ? `<div style="font-size:0.84rem;color:var(--text-muted);">No Gas operations logged yet.</div>` : `
        <table class="data-table">
          <thead><tr><th>Timestamp</th><th>Action</th><th>Actor</th><th>Details</th></tr></thead>
          <tbody>
            ${auditLogs.slice(0, 40).map(a => `
              <tr>
                <td style="font-size:0.76rem;white-space:nowrap;">${esc(formatDateTime(a.timestamp))}</td>
                <td><span class="font-mono" style="font-size:0.75rem;font-weight:700;">${esc(a.action)}</span></td>
                <td>${esc(a.actorName)} (${esc(a.actorRole)})</td>
                <td style="font-size:0.82rem;">${esc(a.details)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

/* =========================================================================
   PRINTABLE DOCUMENT: CUSTOMER LPG DELIVERY & BOOKING RECEIPT
   ========================================================================= */

export function buildGasBookingReceiptHtml(b) {
  const stage = normalizeGasBookingStatus(b.deliveryStatus);
  const qty = Math.max(1, Number(b.quantity) || 1);
  const refillSubtotal = (Number(b.refillPrice) || 0) * qty;
  const rows = [
    {
      label: `LPG Cylinder Refill — ${b.cylinderType || '14.2 Kg'} (${b.gasCompany || 'LPG'})${b.agencyName ? ` · Agency: ${b.agencyName}` : ''}`,
      qty,
      amt: refillSubtotal
    }
  ];
  if (Number(b.deliveryCharge) > 0) {
    rows.push({
      label: `Home Delivery Charge (${Number(b.deliveryDistanceKm || 0)} KM · ${b.deliveryPricingMethod || 'Standard'})`,
      qty: 1,
      amt: Number(b.deliveryCharge) || 0
    });
  }
  if (Number(b.additionalServiceCharge) > 0) {
    rows.push({
      label: 'Additional Handling / Service Charge',
      qty: 1,
      amt: Number(b.additionalServiceCharge) || 0
    });
  }

  return `
    <div class="mun-bw-doc">
      ${renderBwDocumentHeader({
        docTitle: 'LPG GAS BOOKING & DELIVERY RECEIPT',
        docNumber: b.bookingNo || b.id,
        docDateTime: b.createdAt ? formatDateTime(b.createdAt) : formatDate(b.bookingDate),
        statusText: stage.toUpperCase(),
        serviceRefNumber: b.bookingRefNo || b.consumerId || b.lpgId17 || ''
      })}
      <div style="border:1px solid #000000;padding:8px 10px;margin-bottom:10px;font-size:8.5pt;line-height:1.45;">
        <div><strong>Customer Name:</strong> ${escDoc(b.customerName)} | <strong>Mobile:</strong> ${escDoc(b.mobile)}${b.altMobile && b.altMobile !== b.mobile ? ` / ${escDoc(b.altMobile)}` : ''}</div>
        <div>
          <strong>Agency / Distributor:</strong> ${escDoc(b.agencyName || b.gasCompany || '-')}
          ${b.consumerId ? ` | <strong>Consumer ID:</strong> <span class="font-mono">${escDoc(b.consumerId)}</span>` : ''}
          ${b.lpgId17 ? ` | <strong>17-Digit LPG ID:</strong> <span class="font-mono">${escDoc(b.lpgId17)}</span>` : ''}
        </div>
        <div><strong>Delivery Address:</strong> ${escDoc(b.deliveryAddressSnapshot || '-')}</div>
        <div>
          <strong>Booking Date:</strong> ${escDoc(formatDate(b.bookingDate))}
          | <strong>Delivery Date:</strong> ${escDoc(b.deliveryDate ? formatDate(b.deliveryDate) : 'Scheduled')}
          | <strong>Customer Taking Gas:</strong> ${escDoc(b.customerTakingGas || 'Yes')}
        </div>
        <div>
          <strong>Assigned Delivery Person:</strong> ${escDoc(b.deliveryPersonName || b.deliveryStaff || 'Not Assigned Yet')}${b.deliveryPersonMobile ? ` (${escDoc(b.deliveryPersonMobile)})` : ''}
          | <strong>Current Status:</strong> ${escDoc(stage)}
        </div>
        ${(b.deliveryInstructions || b.specialNotes) ? `<div><strong>Delivery Notes:</strong> ${escDoc([b.deliveryInstructions, b.specialNotes].filter(Boolean).join(' · '))}</div>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:36px;" class="text-center">#</th>
            <th>Particulars</th>
            <th style="width:60px;" class="text-center">Qty</th>
            <th style="width:110px;" class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td class="text-center">${i + 1}</td>
              <td>${escDoc(r.label)}</td>
              <td class="text-center font-mono">${r.qty}</td>
              <td class="text-right font-mono tabular-nums">${formatINRDoc(r.amt)}</td>
            </tr>
          `).join('')}
          ${Number(b.discount) > 0 ? `
            <tr>
              <td colspan="3" class="text-right">Discount (-)</td>
              <td class="text-right font-mono tabular-nums">-${formatINRDoc(b.discount)}</td>
            </tr>
          ` : ''}
          <tr>
            <td colspan="3" class="text-right"><strong>Net Total Payable</strong></td>
            <td class="text-right font-mono tabular-nums"><strong>${formatINRDoc(b.totalAmount)}</strong></td>
          </tr>
          <tr>
            <td colspan="3" class="text-right">Paid Amount (${escDoc(b.paymentMode || 'Cash')})</td>
            <td class="text-right font-mono tabular-nums">${formatINRDoc(b.paidAmount)}</td>
          </tr>
          <tr>
            <td colspan="3" class="text-right"><strong>Balance Due (${escDoc(b.paymentStatus || 'Due')})</strong></td>
            <td class="text-right font-mono tabular-nums"><strong>${formatINRDoc(b.dueAmount)}</strong></td>
          </tr>
        </tbody>
      </table>

      <div style="border:1px solid #000000;padding:8px 10px;margin-bottom:10px;font-size:8.4pt;">
        <strong>Net Total in Words:</strong> ${escDoc(numberToWords(b.totalAmount || 0))}
        ${b.remarks ? `<div style="margin-top:2px;"><strong>Remarks:</strong> ${escDoc(b.remarks)}</div>` : ''}
      </div>

      ${Number(b.dueAmount) > 0 ? renderOnlinePaymentUpiSection() : ''}
      ${renderLegalTermsSection()}
      ${renderAcknowledgementSection({ includeCustomerSignature: true, dateStr: formatDate(b.deliveryDate || b.bookingDate) })}
    </div>
  `;
}

/* =========================================================================
   PRINTABLE DOCUMENTS: GAS COLLECTION RECEIPT & SERVICE REPLACEMENT RECEIPT
   ========================================================================= */

export function buildGasCollectionReceiptHtml(col) {
  return `
    <div class="mun-bw-doc">
      ${renderBwDocumentHeader({
        docTitle: 'LPG & GAS PAYMENT RECEIPT',
        docNumber: col.receiptNo || col.id,
        docDateTime: col.createdAt ? formatDateTime(col.createdAt) : formatDate(col.collectionDate),
        statusText: String(col.status || 'Verified').toUpperCase(),
        serviceRefNumber: col.bookingId || col.serviceEntryId || col.nonTakerLedgerId || ''
      })}
      <div style="border:1px solid #000000;padding:8px 10px;margin-bottom:10px;font-size:8.6pt;">
        <div><strong>Customer Name:</strong> ${escDoc(col.customerName)} ${col.consumerId ? `| <strong>Consumer ID:</strong> <span class="font-mono">${escDoc(col.consumerId)}</span>` : ''}</div>
        <div><strong>Mobile:</strong> ${escDoc(col.mobile || '-')} | <strong>Collection Date:</strong> ${escDoc(formatDate(col.collectionDate))}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Receipt Category & Particulars</th>
            <th style="width:160px;">Mode / Reference</th>
            <th style="width:110px;" class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${escDoc(col.category)}</strong>
              <div style="font-size:8pt;margin-top:2px;">${escDoc(col.remarks || 'Gas services collection')}</div>
            </td>
            <td style="font-size:8.2pt;">
              <div>Mode: ${escDoc(col.paymentMode)}</div>
              <div>Ref: <span class="font-mono">${escDoc(col.transactionRef || '-')}</span></div>
            </td>
            <td class="text-right font-mono tabular-nums"><strong>${formatINRDoc(col.amount)}</strong></td>
          </tr>
        </tbody>
      </table>
      <div style="border:1px solid #000000;padding:8px 10px;margin-bottom:10px;font-size:8.5pt;">
        <strong>Amount in Words:</strong> ${escDoc(numberToWords(col.amount || 0))}
      </div>
      ${renderLegalTermsSection()}
      ${renderAcknowledgementSection({ includeCustomerSignature: true, dateStr: formatDate(col.collectionDate) })}
    </div>
  `;
}

export function buildGasServiceReceiptHtml(entry) {
  const rows = [];
  if (Number(entry.regulatorCharge) > 0 || entry.newRegulatorDetails) {
    rows.push({
      label: `Regulator Replacement${entry.newRegulatorDetails ? `: ${entry.newRegulatorDetails}` : ''}`,
      qty: entry.regulatorQty || 1,
      amt: Number(entry.regulatorCharge) || 0
    });
  }
  if (Number(entry.pipeCharge) > 0 || entry.newPipeDetails) {
    rows.push({
      label: `Gas Pipe / Suraksha Hose Replacement${entry.newPipeDetails ? `: ${entry.newPipeDetails}` : ''}`,
      qty: entry.pipeQty || 1,
      amt: Number(entry.pipeCharge) || 0
    });
  }
  if (Number(entry.otherCharge) > 0) {
    rows.push({ label: 'Other Hardware / Fittings Charge', qty: 1, amt: Number(entry.otherCharge) || 0 });
  }
  if (Number(entry.serviceFee) > 0 || rows.length === 0) {
    rows.push({ label: `Technician Service & Safety Inspection Fee (${entry.serviceType})`, qty: 1, amt: Number(entry.serviceFee) || 0 });
  }

  return `
    <div class="mun-bw-doc">
      ${renderBwDocumentHeader({
        docTitle: 'LPG SERVICE & REPLACEMENT RECEIPT',
        docNumber: entry.serviceId,
        docDateTime: entry.createdAt ? formatDateTime(entry.createdAt) : formatDate(entry.serviceDate),
        statusText: String(entry.status || 'Completed').toUpperCase(),
        serviceRefNumber: entry.consumerId
      })}
      <div style="border:1px solid #000000;padding:8px 10px;margin-bottom:10px;font-size:8.5pt;">
        <div><strong>Customer:</strong> ${escDoc(entry.customerName)} | <strong>Consumer ID:</strong> <span class="font-mono">${escDoc(entry.consumerId)}</span> | <strong>Mobile:</strong> ${escDoc(entry.mobile)}</div>
        <div><strong>Address:</strong> ${escDoc(entry.villageAddress || '-')} | <strong>Technician:</strong> ${escDoc(entry.technicianName || '-')}</div>
        <div><strong>Service Type:</strong> ${escDoc(entry.serviceType)} | <strong>Next Service Due:</strong> ${escDoc(entry.nextServiceDueDate ? formatDate(entry.nextServiceDueDate) : '-')}</div>
        ${entry.complaintIssue ? `<div><strong>Complaint / Issue:</strong> ${escDoc(entry.complaintIssue)}</div>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:36px;" class="text-center">#</th>
            <th>Service / Replaced Hardware Particulars</th>
            <th style="width:60px;" class="text-center">Qty</th>
            <th style="width:110px;" class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td class="text-center">${i + 1}</td>
              <td>${escDoc(r.label)}</td>
              <td class="text-center font-mono">${r.qty}</td>
              <td class="text-right font-mono tabular-nums">${formatINRDoc(r.amt)}</td>
            </tr>
          `).join('')}
          ${Number(entry.discount) > 0 ? `
            <tr>
              <td colspan="3" class="text-right">Discount (-)</td>
              <td class="text-right font-mono tabular-nums">-${formatINRDoc(entry.discount)}</td>
            </tr>
          ` : ''}
          <tr>
            <td colspan="3" class="text-right"><strong>Net Total Amount</strong></td>
            <td class="text-right font-mono tabular-nums"><strong>${formatINRDoc(entry.totalAmount)}</strong></td>
          </tr>
          <tr>
            <td colspan="3" class="text-right">Amount Received (${escDoc(entry.paymentMode || 'Cash')})</td>
            <td class="text-right font-mono tabular-nums">${formatINRDoc(entry.amountReceived)}</td>
          </tr>
          <tr>
            <td colspan="3" class="text-right"><strong>Balance Due</strong></td>
            <td class="text-right font-mono tabular-nums"><strong>${formatINRDoc(entry.dueAmount)}</strong></td>
          </tr>
        </tbody>
      </table>

      <div style="border:1px solid #000000;padding:8px 10px;margin-bottom:10px;font-size:8.4pt;">
        <strong>Net Total in Words:</strong> ${escDoc(numberToWords(entry.totalAmount || 0))}
        ${entry.remarks ? `<div style="margin-top:2px;"><strong>Remarks:</strong> ${escDoc(entry.remarks)}</div>` : ''}
      </div>

      ${Number(entry.dueAmount) > 0 ? renderOnlinePaymentUpiSection() : ''}
      ${renderLegalTermsSection()}
      ${renderAcknowledgementSection({ includeCustomerSignature: true, dateStr: formatDate(entry.serviceDate) })}
    </div>
  `;
}
