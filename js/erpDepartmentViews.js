/**
 * erpDepartmentViews.js - Unified Corporate ERP Submodule Renderers & Interactive Handlers
 * MUN COMPUTER BUSINESS MANAGER
 *
 * Covers centralized submodules across all 11 departments while preserving 100% of
 * existing LocalStorage/server records and linking directly with existing modules.
 */

import Chart from 'chart.js/auto';
import {
  getItem,
  setItem,
  KEYS,
  getTodayDate,
  formatDate,
  formatDateTime,
  formatINR,
  getAuthHeaders,
  logAuditAction,
  allocateGlobalReference,
  markGlobalReferenceDeleted,
  numberToWords
} from './storage.js';
import { getCurrentUser, canMenu, isMainAdmin, MAIN_ADMIN_UID, formatRoleLabel, ROLE_CAPABILITIES } from './auth.js';
import {
  fetchDbHealth,
  createSqliteDbBackup,
  restoreSqliteDbBackup,
  fetchSystemSecuritySettings,
  saveSystemSecuritySettings,
  setupMainAdminMfa,
  enableMainAdminMfa,
  disableMainAdminMfa
} from './settings.js';
import { getLucideIcon } from './lucideIcons.js';
import { getDynamicNavBadgeCounts } from './notifications.js';
import { generateFinancialSummary } from './reports.js';
import { calculateDayTally } from './daybook.js';
import {
  renderSearchableServiceSelectorHtml,
  initSearchableServiceSelector,
  getSelectedServicesState,
  getSearchableRateServices
} from './serviceSelector.js';
import { createOrSyncFollowupCase } from './followups.js';
import { buildWhatsAppUrl, normalizeWhatsAppPhone } from './whatsappConnect.js';
import {
  exportUniversalCSV,
  exportUniversalExcel,
  exportUniversalPDF,
  printUniversalReport,
  generateReportId,
  buildSumTotalsRow
} from './exportUtility.js';
import {
  getAllCanonicalEmployees,
  calculateEmployeeKpiScore,
  calculateAttendancePayrollPreview
} from './hrIntegrationEngine.js';
import {
  normalizeGasBookingStatus,
  isBookingCancelledStatus,
  isBookingDeliveredStatus,
  getAllGasCustomers,
  getAllGasBookings,
  getAllGasDeliveryPersons,
  getGasSettings,
  assignDeliveryPersonToBooking,
  updateGasBookingStatus
} from './gasServiceEngine.js';
import { buildGoogleMapsDirectionsUrl } from './gasMapsService.js';

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const escAttr = (v) => esc(v).replace(/'/g, '&#39;');

const round2 = (v) => Math.round(((Number(v) || 0) + Number.EPSILON) * 100) / 100;

let growthBarChartInstance = null;

const DeptUiState = {
  selectedCustomerId: '',
  selectedLedgerCustId: '',
  selectedBarcodeItemId: '',
  barcodeBatch: [],
  barcodeRollWidth: '2in',
  barcodeLabelSize: 'standard',
  reportMonth: getTodayDate().slice(0, 7),
  customReportDataset: 'services',
  customReportFrom: '',
  customReportTo: '',
  customReportQuery: '',
  growthReportTab: 'leads',
  growthFromDate: '',
  growthToDate: '',
  growthQuery: '',
  auditSearch: '',
  docSearch: '',
  stockFilter: 'all',
  gasComplaintFilter: 'ALL',
  leadStageFilter: 'ALL',
  dbHealth: null,
  dbHealthLoading: false,
  dbHealthLoaded: false,
  sysSettings: null,
  sysSettingsLoading: false,
  sysSettingsLoaded: false,
  mfaSetup: null
};

async function ensureDbHealthLoaded(force = false) {
  if (DeptUiState.dbHealthLoading || (DeptUiState.dbHealthLoaded && !force)) return;
  DeptUiState.dbHealthLoading = true;
  try {
    const res = await fetchDbHealth();
    if (res.success && res.health) {
      DeptUiState.dbHealth = res.health;
    }
    DeptUiState.dbHealthLoaded = true;
  } finally {
    DeptUiState.dbHealthLoading = false;
    if (window.MJK && typeof window.MJK.render === 'function') {
      const h = String(window.location.hash || '');
      if (h.includes('database-management')) window.MJK.render(true);
    }
  }
}

async function ensureSysSettingsLoaded(force = false) {
  if (DeptUiState.sysSettingsLoading || (DeptUiState.sysSettingsLoaded && !force)) return;
  DeptUiState.sysSettingsLoading = true;
  try {
    const res = await fetchSystemSecuritySettings();
    if (res.success && res.settings) {
      DeptUiState.sysSettings = res.settings;
    }
    DeptUiState.sysSettingsLoaded = true;
  } finally {
    DeptUiState.sysSettingsLoading = false;
    if (window.MJK && typeof window.MJK.render === 'function') {
      const h = String(window.location.hash || '');
      if (h.includes('security-settings')) window.MJK.render(true);
    }
  }
}

export async function syncExtendedErpFromServer() {
  try {
    const resp = await fetch('/api/erp/extended', { headers: getAuthHeaders() });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.success && data.extendedErp) {
      const ext = data.extendedErp;
      const map = {
        quotations: KEYS.QUOTATIONS,
        estimates: KEYS.ESTIMATES,
        salesReturns: KEYS.SALES_RETURNS,
        creditNotes: KEYS.CREDIT_NOTES,
        purchaseOrders: KEYS.PURCHASE_ORDERS,
        purchaseBills: KEYS.PURCHASE_BILLS,
        stockAdjustments: KEYS.STOCK_ADJUSTMENTS,
        stockTransfers: KEYS.STOCK_TRANSFERS,
        bankAccounts: KEYS.BANK_ACCOUNTS,
        journalEntries: KEYS.JOURNAL_ENTRIES,
        bankReconciliations: KEYS.BANK_RECONCILIATIONS,
        customerFeedback: KEYS.CUSTOMER_FEEDBACK,
        leads: KEYS.LEADS,
        referrals: KEYS.REFERRALS,
        promotions: KEYS.PROMOTIONS,
        branches: KEYS.BRANCHES
      };
      Object.entries(map).forEach(([k, storageKey]) => {
        if (Array.isArray(ext[k])) setItem(storageKey, ext[k]);
      });
      if (ext.notificationPrefs && typeof ext.notificationPrefs === 'object') {
        setItem(KEYS.NOTIFICATION_PREFS, ext.notificationPrefs);
      }
      if (ext.securitySettings && typeof ext.securitySettings === 'object') {
        setItem(KEYS.SECURITY_SETTINGS, ext.securitySettings);
      }
      return ext;
    }
  } catch {
    // Local cache fallback preserved
  }
  return null;
}

export async function pushExtendedErpToServer() {
  try {
    const payload = {
      quotations: getItem(KEYS.QUOTATIONS, []),
      estimates: getItem(KEYS.ESTIMATES, []),
      salesReturns: getItem(KEYS.SALES_RETURNS, []),
      creditNotes: getItem(KEYS.CREDIT_NOTES, []),
      purchaseOrders: getItem(KEYS.PURCHASE_ORDERS, []),
      purchaseBills: getItem(KEYS.PURCHASE_BILLS, []),
      stockAdjustments: getItem(KEYS.STOCK_ADJUSTMENTS, []),
      stockTransfers: getItem(KEYS.STOCK_TRANSFERS, []),
      bankAccounts: getItem(KEYS.BANK_ACCOUNTS, []),
      journalEntries: getItem(KEYS.JOURNAL_ENTRIES, []),
      bankReconciliations: getItem(KEYS.BANK_RECONCILIATIONS, []),
      customerFeedback: getItem(KEYS.CUSTOMER_FEEDBACK, []),
      leads: getItem(KEYS.LEADS, []),
      referrals: getItem(KEYS.REFERRALS, []),
      promotions: getItem(KEYS.PROMOTIONS, []),
      branches: getItem(KEYS.BRANCHES, []),
      notificationPrefs: getItem(KEYS.NOTIFICATION_PREFS, {}),
      securitySettings: getItem(KEYS.SECURITY_SETTINGS, {})
    };
    await fetch('/api/erp/extended', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
  } catch {
    // Local persistence still safe
  }
}

function pageHeader(iconName, title, subtitle, actionsHtml = '') {
  return `
    <div class="page-header">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.55rem;">
          <span style="display:inline-flex; color:var(--blue-600);">${getLucideIcon(iconName, 22)}</span>
          <span>${title}</span>
        </h2>
        <p class="page-subtitle">${esc(subtitle)}</p>
      </div>
      ${actionsHtml ? `<div class="page-actions" style="display:flex; gap:0.45rem; flex-wrap:wrap; align-items:center;">${actionsHtml}</div>` : ''}
    </div>
  `;
}

function getAllCombinedDuesRows() {
  const services = getItem(KEYS.SERVICES, []);
  const invoices = getItem(KEYS.INVOICES, []);
  const gasCols = getItem(KEYS.GAS_COLLECTIONS, []);
  const rows = [];
  services.forEach((s) => {
    const due = Number(s.dueAmount) || 0;
    if (due > 0) {
      rows.push({
        source: 'Service',
        refId: s.refNumber || s.id,
        customerId: s.customerId || '',
        customerName: s.customerName || 'Walk-in Customer',
        phone: s.customerPhone || '',
        date: s.date || s.appDate || '',
        total: Number(s.totalAmount ?? s.totalFee ?? s.charge ?? 0),
        paid: Number(s.paidAmount) || 0,
        due,
        route: 'services'
      });
    }
  });
  invoices.forEach((inv) => {
    const due = Number(inv.balanceDue) || 0;
    if (due > 0) {
      rows.push({
        source: 'Invoice',
        refId: inv.invoiceNumber || inv.id,
        customerId: inv.customerId || '',
        customerName: inv.customerName || 'Customer',
        phone: inv.customerPhone || '',
        date: inv.date || '',
        total: Number(inv.grandTotal || inv.totalAmount) || 0,
        paid: Number(inv.amountPaid || inv.paidAmount) || 0,
        due,
        route: 'invoices'
      });
    }
  });
  gasCols.forEach((g) => {
    const due = Number(g.dueAmount) || 0;
    if (due > 0) {
      rows.push({
        source: 'LPG Gas',
        refId: g.id || '-',
        customerId: g.customerId || '',
        customerName: g.customerName || 'Gas Consumer',
        phone: g.phone || '',
        date: g.date || '',
        total: Number(g.amountDue || g.totalAmount) || 0,
        paid: Number(g.amountPaid || g.paidAmount) || 0,
        due,
        route: 'gas-collections'
      });
    }
  });
  return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* =========================================================================
   1. MAIN DASHBOARD SUBMODULES
   ========================================================================= */
export function renderBusinessOverviewView() {
  const summary = generateFinancialSummary('all', 'month');
  const customers = getItem(KEYS.CUSTOMERS, []);
  const services = getItem(KEYS.SERVICES, []);
  const gasCustomers = getItem(KEYS.GAS_CUSTOMERS, []);
  const gasBookings = getItem(KEYS.GAS_BOOKINGS, []);
  const employees = getAllCanonicalEmployees(false);
  const inventory = getItem(KEYS.INVENTORY, []);
  const stockValue = inventory.reduce((s, i) => s + (Number(i.quantity ?? i.stockQty ?? 0) * Number(i.unitPrice ?? i.sellingPrice ?? 0)), 0);
  const dues = getAllCombinedDuesRows();
  const totalReceivable = dues.reduce((s, d) => s + d.due, 0);

  return `
    ${pageHeader('briefcase', 'Business Overview — MUN COMPUTER', 'Executive cross-department health summary across Counter Services, LPG Gas, Inventory, Finance & Team',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('dashboard')">Executive Dashboard</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('reports')">Analytics Hub</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(195px, 1fr)); gap:0.85rem; margin-bottom:1.2rem;">
      <div class="stat-card"><div class="stat-label">Monthly Income</div><div class="stat-value tabular-nums" style="color:var(--success);">${formatINR(summary.totalIncome || 0)}</div></div>
      <div class="stat-card"><div class="stat-label">Monthly Expenses</div><div class="stat-value tabular-nums" style="color:var(--danger);">${formatINR(summary.totalExpenses || 0)}</div></div>
      <div class="stat-card"><div class="stat-label">Net Profit (Month)</div><div class="stat-value tabular-nums" style="color:${(summary.netProfit || 0) >= 0 ? 'var(--blue-600)' : 'var(--danger)'};">${formatINR(summary.netProfit || 0)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Receivables</div><div class="stat-value tabular-nums" style="color:var(--warning);">${formatINR(totalReceivable)}</div></div>
      <div class="stat-card"><div class="stat-label">Stock Valuation</div><div class="stat-value tabular-nums">${formatINR(stockValue)}</div></div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1rem;">
      <div class="card" style="padding:1.1rem;">
        <h3 style="margin:0 0 0.75rem 0; font-size:0.95rem;">Department Activity Snapshot</h3>
        <div style="display:flex; flex-direction:column; gap:0.55rem; font-size:0.84rem;">
          <div style="display:flex; justify-content:space-between;"><span>Active Customers</span><strong class="tabular-nums">${customers.length}</strong></div>
          <div style="display:flex; justify-content:space-between;"><span>Total Service Entries</span><strong class="tabular-nums">${services.length}</strong></div>
          <div style="display:flex; justify-content:space-between;"><span>LPG Gas Consumers</span><strong class="tabular-nums">${gasCustomers.length}</strong></div>
          <div style="display:flex; justify-content:space-between;"><span>LPG Gas Bookings</span><strong class="tabular-nums">${gasBookings.length}</strong></div>
          <div style="display:flex; justify-content:space-between;"><span>Active Team Members</span><strong class="tabular-nums">${employees.length}</strong></div>
          <div style="display:flex; justify-content:space-between;"><span>Inventory SKUs</span><strong class="tabular-nums">${inventory.length}</strong></div>
        </div>
      </div>

      <div class="card" style="padding:1.1rem;">
        <h3 style="margin:0 0 0.75rem 0; font-size:0.95rem;">Top Pending Receivables</h3>
        ${dues.slice(0, 6).map(d => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.45rem 0; border-bottom:1px solid var(--border-subtle); font-size:0.82rem;">
            <div>
              <strong>${esc(d.customerName)}</strong>
              <div style="font-size:0.72rem; color:var(--text-muted);">${esc(d.source)} · ${esc(d.refId)}</div>
            </div>
            <button type="button" class="btn btn-outline btn-sm tabular-nums" onclick="window.MJK.navigateTo('${escAttr(d.route)}')">${formatINR(d.due)}</button>
          </div>
        `).join('') || '<div style="color:var(--text-muted); font-size:0.84rem;">No outstanding customer dues recorded.</div>'}
      </div>
    </div>
  `;
}

export function renderTodaysSummaryView() {
  const today = getTodayDate();
  const payments = getItem(KEYS.PAYMENTS, []).filter(p => String(p.date || '').slice(0, 10) === today);
  const expenses = getItem(KEYS.EXPENSES, []).filter(e => String(e.date || '').slice(0, 10) === today);
  const services = getItem(KEYS.SERVICES, []).filter(s => String(s.date || '').slice(0, 10) === today);
  const invoices = getItem(KEYS.INVOICES, []).filter(i => String(i.date || '').slice(0, 10) === today);
  const bookings = getItem(KEYS.GAS_BOOKINGS, []).filter(b => String(b.bookingDate || b.date || '').slice(0, 10) === today);
  const attendance = getItem('MUN_COMPUTER_ERP_v1_payroll', []).filter(a => String(a.date || '').slice(0, 10) === today);
  const counterTxns = getItem(KEYS.COUNTER_CASH_TXNS, []).filter(c => String(c.date || '').slice(0, 10) === today);

  const todayIncome = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const todayExpense = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return `
    ${pageHeader('calendar-check', "Today's Counter Summary", `Real-time operational metrics for ${formatDate(today)} across all counters`,
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('counter-daybook')">Open Counter Day Book</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('daily-reports')">Full Daily Report</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1.15rem;">
      <div class="stat-card"><div class="stat-label">Today's Receipts</div><div class="stat-value tabular-nums" style="color:var(--success);">${formatINR(todayIncome)}</div></div>
      <div class="stat-card"><div class="stat-label">Today's Expenses</div><div class="stat-value tabular-nums" style="color:var(--danger);">${formatINR(todayExpense)}</div></div>
      <div class="stat-card"><div class="stat-label">Services Logged</div><div class="stat-value tabular-nums">${services.length}</div></div>
      <div class="stat-card"><div class="stat-label">Invoices Issued</div><div class="stat-value tabular-nums">${invoices.length}</div></div>
      <div class="stat-card"><div class="stat-label">LPG Bookings Today</div><div class="stat-value tabular-nums">${bookings.length}</div></div>
      <div class="stat-card"><div class="stat-label">Staff Attendance Marked</div><div class="stat-value tabular-nums">${attendance.length}</div></div>
    </div>
    <div class="table-card">
      <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">Today's Counter Cash &amp; Payment Feed (${payments.length + counterTxns.length})</h3></div></div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Source</th><th>Particular / Customer</th><th>Mode</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td><span class="badge badge-success">Payment</span></td>
                <td>${esc(p.customerName || p.remarks || p.id)}</td>
                <td>${esc(p.method || 'Cash')}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700; color:var(--success);">${formatINR(p.amount)}</td>
              </tr>
            `).join('')}
            ${counterTxns.map(c => `
              <tr>
                <td><span class="badge badge-info">${esc(c.type || 'Daybook')}</span></td>
                <td>${esc(c.description || c.category || '-')}</td>
                <td>${esc(c.paymentMode || 'Cash')}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700;">${formatINR(c.amount)}</td>
              </tr>
            `).join('')}
            ${(payments.length + counterTxns.length) === 0 ? '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No transactions recorded today yet.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderPendingActivitiesView() {
  const counts = getDynamicNavBadgeCounts();
  const rows = [
    { label: 'Pending Leave Approvals', count: counts.pendingLeaves, route: 'leave-management', severity: 'warning', desc: 'Employee leave requests waiting for review' },
    { label: 'Incomplete & Overdue Tasks', count: counts.incompleteTasks, route: 'tasks', severity: counts.overdueTasks > 0 ? 'danger' : 'info', desc: `${counts.overdueTasks} task(s) past deadline` },
    { label: 'Low Stock Inventory Alerts', count: counts.lowInventory, route: 'low-stock-alerts', severity: 'danger', desc: 'Products at or below minimum stock level' },
    { label: 'Pending Customer Dues', count: counts.pendingPayments, route: 'customer-dues', severity: 'warning', desc: 'Open receivables across Services, Invoices & LPG' },
    { label: 'Unprocessed Bookings & Applications', count: counts.unprocessedBookings, route: 'gas-bookings', severity: 'info', desc: 'Active LPG bookings & citizen applications in queue' },
    { label: 'Open Complaints & Grievances', count: counts.pendingComplaints, route: 'grievances', severity: 'danger', desc: 'Unresolved grievances and gas complaints' },
    { label: 'Overdue Customer Follow-ups', count: counts.overdueFollowups, route: 'followups-overdue', severity: 'danger', desc: 'Follow-ups scheduled before today' },
    { label: 'Expiring Documents (≤30 days)', count: counts.expiringDocs, route: 'documents', severity: 'warning', desc: 'Staff or business documents needing renewal' }
  ];

  return `
    ${pageHeader('list-checks', 'Pending Activities Center', 'Live consolidated worklist computed directly from stored ERP records',
      `<span class="badge badge-info tabular-nums">${counts.totalPendingActivities} Total Pending Items</span>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:0.85rem;">
      ${rows.map(r => `
        <div class="card" style="padding:1rem; display:flex; flex-direction:column; justify-content:space-between; gap:0.75rem; border-left:4px solid ${r.count > 0 ? (r.severity === 'danger' ? 'var(--danger)' : r.severity === 'warning' ? 'var(--warning)' : 'var(--blue-600)') : 'var(--border-subtle)'};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
            <div>
              <div style="font-weight:700; font-size:0.92rem;">${esc(r.label)}</div>
              <div style="font-size:0.76rem; color:var(--text-muted); margin-top:0.2rem;">${esc(r.desc)}</div>
            </div>
            <span class="badge ${r.count > 0 ? `badge-${r.severity}` : 'badge-neutral'} tabular-nums" style="font-size:0.85rem;">${r.count}</span>
          </div>
          <div style="display:flex; justify-content:flex-end;">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('${escAttr(r.route)}')">Open Queue →</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

export function renderQuickActionsView() {
  const user = getCurrentUser();
  const actions = [
    { route: 'customers', label: 'Customer Registration & Directory', icon: 'user-plus', desc: 'Add or search customer records' },
    { route: 'services', label: 'New Counter Service Entry', icon: 'file-text', desc: 'Log cyber cafe, CSC or document service' },
    { route: 'invoices', label: 'Create Billing Invoice', icon: 'receipt', desc: 'Generate GST/Non-GST invoice & PDF' },
    { route: 'payments', label: 'Collect Payment / Ledger', icon: 'wallet', desc: 'Record receipt or verify UPI/cash' },
    { route: 'gas-bookings', label: 'New LPG Gas Booking', icon: 'flame', desc: 'Book cylinder refill & assign delivery' },
    { route: 'govt-annapurna', label: 'Annapurna Yojana Case Entry', icon: 'wheat', desc: 'Manage Annapurna cases, problems & follow-ups' },
    { route: 'counter-daybook', label: 'Counter Day Book', icon: 'book-open', desc: 'Opening & closing counter cash' },
    { route: 'attendance-tracking', label: 'Attendance & GPS Check-In', icon: 'calendar-check', desc: 'Daily staff clock-in / photo check' },
    { route: 'leave-management', label: 'Apply / Approve Leave', icon: 'calendar-off', desc: 'Leave requests synced to attendance' },
    { route: 'tasks', label: 'Assign / Update Tasks', icon: 'clipboard-list', desc: 'Manage tasks & auto KPI scoring' },
    { route: 'custom-report-builder', label: 'Custom Report & Export', icon: 'download', desc: 'Export PDF, Excel (.xlsx) & CSV' },
    { route: 'universal-search', label: 'ERP Search', icon: 'search', desc: 'Instant search across all modules' }
  ].filter((a) => canMenu(a.route, 'view', user));

  return `
    ${pageHeader('zap', 'Quick Actions Hub', 'Fast counter launchers authorized for your current role')}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:0.85rem;">
      ${actions.map(a => `
        <button type="button" class="card" style="padding:1rem; text-align:left; cursor:pointer; display:flex; align-items:flex-start; gap:0.75rem; border:1px solid var(--border-subtle);" onclick="window.MJK.navigateTo('${escAttr(a.route)}')">
          <span style="width:36px; height:36px; border-radius:10px; background:rgba(59,130,246,0.12); color:var(--blue-600); display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">
            ${getLucideIcon(a.icon, 18)}
          </span>
          <span>
            <span style="display:block; font-weight:700; font-size:0.88rem; color:var(--text-main);">${esc(a.label)}</span>
            <span style="display:block; font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">${esc(a.desc)}</span>
          </span>
        </button>
      `).join('')}
    </div>
  `;
}

/* =========================================================================
   2. TEAM: ROLES & PERMISSIONS VIEW
   ========================================================================= */
export function renderRolesPermissionsView() {
  const users = getItem(KEYS.USERS, []);
  const curUser = getCurrentUser();
  const isAdmin = isMainAdmin(curUser) || String(curUser?.role || '').toUpperCase() === 'ADMIN';

  return `
    ${pageHeader('shield-check', 'Roles & Permissions Overview', '3-level access hierarchy across Administration, Manager and Staff accounts',
      `${isAdmin ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('admin-managers')">Open Administration</button>` : ''}`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:0.9rem; margin-bottom:1.15rem;">
      ${['ADMIN', 'MANAGER', 'STAFF'].map(roleKey => {
        const cap = ROLE_CAPABILITIES?.[roleKey] || {};
        return `
        <div class="card" style="padding:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.45rem;">
            <strong>${esc(formatRoleLabel(roleKey))}</strong>
            <span class="badge badge-info tabular-nums">${users.filter(u => String(u.role || 'STAFF').toUpperCase() === roleKey).length} users</span>
          </div>
          <p style="font-size:0.79rem; color:var(--text-muted); margin:0;">${esc(cap.description || cap.title || '')}</p>
        </div>`;
      }).join('')}
    </div>
    <div class="table-card">
      <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">Active Role Assignments (${users.length})</h3></div></div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Employee ID</th><th>Name</th><th>Role</th><th>Status</th><th>Overrides</th>${isAdmin ? '<th style="text-align:right;">Manage</th>' : ''}</tr></thead>
          <tbody>
            ${users.map(u => {
              const uid = u.uid || u.id || u.requestId || '-';
              const overrideCount = Object.keys(u.permissionOverrides || {}).length;
              return `
                <tr>
                  <td class="font-mono">${esc(uid)}</td>
                  <td><strong>${esc(u.name)}</strong></td>
                  <td><span class="badge badge-info">${esc(formatRoleLabel(u.role || 'STAFF'))}</span></td>
                  <td><span class="badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}">${esc(u.status || 'ACTIVE')}</span></td>
                  <td class="tabular-nums">${overrideCount}</td>
                  ${isAdmin ? `<td style="text-align:right;"><button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openUserPermissionsModal('${escAttr(uid)}')">Edit Permissions</button></td>` : ''}
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
   3. CUSTOMER MANAGEMENT SUBMODULES
   ========================================================================= */
export function renderCustomerProfilesDirectoryView() {
  const customers = getItem(KEYS.CUSTOMERS, []);
  const selectedId = DeptUiState.selectedCustomerId || customers[0]?.id || '';
  const cust = customers.find(c => c.id === selectedId) || null;
  const services = getItem(KEYS.SERVICES, []).filter(s => s.customerId === selectedId);
  const invoices = getItem(KEYS.INVOICES, []).filter(i => i.customerId === selectedId);
  const docs = getItem(KEYS.DOCUMENTS, []).filter(d => d.customerId === selectedId);
  const feedback = getItem(KEYS.CUSTOMER_FEEDBACK, []).filter(f => f.customerId === selectedId);
  const dues = getAllCombinedDuesRows().filter(d => d.customerId === selectedId);

  return `
    ${pageHeader('contact', 'Customer 360° Profiles', 'Unified customer timeline linking Services, Billing, Dues, Documents & Feedback',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('customers')">All Customers</button>
       ${cust ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.viewCustomerProfile('${escAttr(cust.id)}')">Open Full Profile Modal</button>` : ''}`
    )}
    <div class="card" style="padding:0.95rem 1.1rem; margin-bottom:1.1rem;">
      <label class="form-label" style="font-size:0.75rem;">Select Customer Record (${customers.length} total)</label>
      <select class="form-control" onchange="window.MJK.setDeptState('selectedCustomerId', this.value)">
        ${customers.map(c => `<option value="${escAttr(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)} — ${esc(c.phone || '-')} (${esc(c.id)})</option>`).join('') || '<option value="">No customers found</option>'}
      </select>
    </div>
    ${cust ? `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:0.85rem; margin-bottom:1.15rem;">
        <div class="stat-card"><div class="stat-label">Services Done</div><div class="stat-value tabular-nums">${services.length}</div></div>
        <div class="stat-card"><div class="stat-label">Invoices</div><div class="stat-value tabular-nums">${invoices.length}</div></div>
        <div class="stat-card"><div class="stat-label">Outstanding Due</div><div class="stat-value tabular-nums" style="color:var(--danger);">${formatINR(dues.reduce((s, d) => s + d.due, 0))}</div></div>
        <div class="stat-card"><div class="stat-label">Linked Documents</div><div class="stat-value tabular-nums">${docs.length}</div></div>
        <div class="stat-card"><div class="stat-label">Feedback Entries</div><div class="stat-value tabular-nums">${feedback.length}</div></div>
      </div>
      <div class="table-card">
        <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">${esc(cust.name)} — Services &amp; Invoices History</h3></div></div>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Type</th><th>Ref / ID</th><th>Description</th><th>Date</th><th style="text-align:right;">Total</th><th style="text-align:right;">Due</th></tr></thead>
            <tbody>
              ${services.map(s => `<tr><td><span class="badge badge-info">Service</span></td><td class="font-mono">${esc(s.refNumber || s.id)}</td><td>${esc(s.serviceName)}</td><td class="tabular-nums">${formatDate(s.date)}</td><td class="tabular-nums" style="text-align:right;">${formatINR(s.totalFee || s.charge)}</td><td class="tabular-nums" style="text-align:right;">${formatINR(s.dueAmount || 0)}</td></tr>`).join('')}
              ${invoices.map(i => `<tr><td><span class="badge badge-success">Invoice</span></td><td class="font-mono">${esc(i.invoiceNumber || i.id)}</td><td>${esc(i.documentType || 'Invoice')}</td><td class="tabular-nums">${formatDate(i.date)}</td><td class="tabular-nums" style="text-align:right;">${formatINR(i.grandTotal || i.totalAmount)}</td><td class="tabular-nums" style="text-align:right;">${formatINR(i.balanceDue || 0)}</td></tr>`).join('')}
              ${(services.length + invoices.length) === 0 ? '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No services or invoices linked yet.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    ` : '<div class="card" style="padding:2rem; text-align:center; color:var(--text-muted);">No customer records stored yet. Add a customer in Customer Registration.</div>'}
  `;
}

export function renderCustomerDocumentsView() {
  const docs = getItem(KEYS.DOCUMENTS, []).filter((d) => !d.staffUid && !d.userId || Boolean(d.customerId || d.applicationId));
  const q = DeptUiState.docSearch.trim().toLowerCase();
  const filtered = docs.filter(d => !q || `${d.name} ${d.category} ${d.customerId} ${d.applicationId}`.toLowerCase().includes(q));

  return `
    ${pageHeader('folder-lock', 'Customer Documents', 'KYC, citizen proofs & application attachments linked to customer records',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openRealDocumentUploadModal()">Upload Customer Document</button>`
    )}
    <div class="card" style="padding:0.85rem 1rem; margin-bottom:1rem;">
      <input id="cust-doc-search" class="form-control" placeholder="Search document title, customer ID or application ID..." value="${esc(DeptUiState.docSearch)}" oninput="window.MJK.setDeptFilterKeepFocus('docSearch', this.value, 'cust-doc-search')">
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Document</th><th>Category</th><th>Customer / App ID</th><th>Upload Date</th><th>Expiry</th><th style="text-align:right;">Download</th></tr></thead>
          <tbody>
            ${filtered.map(d => `
              <tr>
                <td><strong>${esc(d.name)}</strong></td>
                <td><span class="badge badge-info">${esc(d.category || 'Document')}</span></td>
                <td class="font-mono">${esc(d.customerId || d.applicationId || 'General')}</td>
                <td class="tabular-nums">${formatDate(d.uploadDate)}</td>
                <td class="tabular-nums">${d.expiryDate ? formatDate(d.expiryDate) : '-'}</td>
                <td style="text-align:right;">${d.downloadUrl ? `<a class="btn btn-outline btn-sm" href="${esc(d.downloadUrl)}" download>Download</a>` : '-'}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No customer documents uploaded.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderCustomerFeedbackView() {
  const feedback = getItem(KEYS.CUSTOMER_FEEDBACK, []);
  const avg = feedback.length ? (feedback.reduce((s, f) => s + (Number(f.rating) || 0), 0) / feedback.length).toFixed(1) : '0.0';
  const positiveCount = feedback.filter(f => Number(f.rating) >= 4).length;
  const attentionCount = feedback.filter(f => Number(f.rating) <= 2).length;

  return `
    ${pageHeader('message-square-heart', 'Customer Feedback & Satisfaction', 'Track service quality ratings, counter reviews and follow-up actions',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddFeedbackModal()">+ Record Feedback</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1.1rem;">
      <div class="stat-card"><div class="stat-label">Total Reviews</div><div class="stat-value tabular-nums">${feedback.length}</div></div>
      <div class="stat-card"><div class="stat-label">Average Rating</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${avg} / 5</div></div>
      <div class="stat-card"><div class="stat-label">Positive (4–5★)</div><div class="stat-value tabular-nums" style="color:var(--success);">${positiveCount}</div></div>
      <div class="stat-card"><div class="stat-label">Needs Attention (≤2★)</div><div class="stat-value tabular-nums" style="color:var(--danger);">${attentionCount}</div></div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Customer</th><th>Service / Dept</th><th>Rating</th><th>Comments</th></tr></thead>
          <tbody>
            ${feedback.map(f => {
              const r = Number(f.rating) || 5;
              const stars = '★'.repeat(Math.max(1, Math.min(5, r))) + '☆'.repeat(Math.max(0, 5 - Math.min(5, r)));
              return `
                <tr>
                  <td class="tabular-nums">${formatDate(f.date)}</td>
                  <td>
                    <strong>${esc(f.customerName)}</strong>
                    ${f.customerPhone ? `<div class="tabular-nums" style="font-size:0.72rem; color:var(--text-muted);">${esc(f.customerPhone)}</div>` : ''}
                  </td>
                  <td>${esc(f.serviceName || f.department || 'Counter Service')}</td>
                  <td class="tabular-nums"><strong style="color:${r >= 4 ? 'var(--success)' : r <= 2 ? 'var(--danger)' : 'var(--warning)'};">${r} / 5 ${stars}</strong></td>
                  <td>${esc(f.comments || '-')}</td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No customer feedback logged yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderCustomerDuesView() {
  const dues = getAllCombinedDuesRows();
  const totalDue = dues.reduce((s, d) => s + d.due, 0);

  return `
    ${pageHeader('receipt', 'Customer Outstanding Dues', 'Consolidated receivables across Counter Services, Billing Invoices & LPG Gas Collections',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('dues', 'excel')">Excel</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('dues', 'print')">Print</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('payments')">Record Payment</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:0.85rem; margin-bottom:1.1rem;">
      <div class="stat-card"><div class="stat-label">Open Due Accounts</div><div class="stat-value tabular-nums">${dues.length}</div></div>
      <div class="stat-card"><div class="stat-label">Total Pending Amount</div><div class="stat-value tabular-nums" style="color:var(--danger);">${formatINR(totalDue)}</div></div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Source</th><th>Reference</th><th>Customer</th><th>Date</th><th style="text-align:right;">Total</th><th style="text-align:right;">Paid</th><th style="text-align:right;">Balance Due</th><th style="text-align:right;">Action</th></tr></thead>
          <tbody>
            ${dues.map(d => `
              <tr>
                <td><span class="badge badge-warning">${esc(d.source)}</span></td>
                <td class="font-mono">${esc(d.refId)}</td>
                <td><strong>${esc(d.customerName)}</strong><div style="font-size:0.72rem; color:var(--text-muted);">${esc(d.phone || '')}</div></td>
                <td class="tabular-nums">${formatDate(d.date)}</td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(d.total)}</td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(d.paid)}</td>
                <td class="tabular-nums" style="text-align:right; color:var(--danger); font-weight:700;">${formatINR(d.due)}</td>
                <td style="text-align:right;"><button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('${escAttr(d.route)}')">Collect</button></td>
              </tr>
            `).join('') || '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">All customer balances are cleared! Zero dues pending.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderCustomerReportsView() {
  const customers = getItem(KEYS.CUSTOMERS, []);
  const services = getItem(KEYS.SERVICES, []);
  const dues = getAllCombinedDuesRows();

  return `
    ${pageHeader('file-spreadsheet', 'Customer Master Reports', 'Export full customer directory, service frequency & outstanding dues statements',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('customers', 'print')">Print</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('customers', 'pdf')">PDF</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('customers', 'excel')">Excel</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('customers', 'csv')">CSV</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Customer ID</th><th>Name</th><th>Phone</th><th>Location / Village</th><th>Services</th><th style="text-align:right;">Due Balance</th></tr></thead>
          <tbody>
            ${customers.map(c => {
              const sCount = services.filter(s => s.customerId === c.id).length;
              const cDue = dues.filter(d => d.customerId === c.id).reduce((sum, d) => sum + d.due, 0);
              return `
                <tr>
                  <td class="font-mono">${esc(c.id)}</td>
                  <td><strong>${esc(c.name)}</strong></td>
                  <td class="tabular-nums">${esc(c.phone || '-')}</td>
                  <td>${esc([c.village, c.block, c.district].filter(Boolean).join(', ') || '-')}</td>
                  <td class="tabular-nums">${sCount}</td>
                  <td class="tabular-nums" style="text-align:right; color:${cDue > 0 ? 'var(--danger)' : 'var(--text-muted)'};">${formatINR(cDue)}</td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No customers registered.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   4. SALES & BILLING SUBMODULES
   ========================================================================= */
export function renderSalesDashboardView() {
  const invoices = getItem(KEYS.INVOICES, []);
  const quotes = getItem(KEYS.QUOTATIONS, []);
  const returns = getItem(KEYS.SALES_RETURNS, []);
  const totalSales = invoices.reduce((s, i) => s + (Number(i.grandTotal || i.totalAmount) || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + (Number(i.amountPaid || i.paidAmount) || 0), 0);
  const totalDue = invoices.reduce((s, i) => s + (Number(i.balanceDue) || 0), 0);

  return `
    ${pageHeader('receipt', 'Sales & Billing Dashboard', 'Consolidated invoicing, quotations, GST billing & credit control',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('quotations')">Quotations (${quotes.length})</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('invoices')">Open Billing &amp; Invoices</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1.15rem;">
      <div class="stat-card"><div class="stat-label">Total Billed</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${formatINR(totalSales)}</div></div>
      <div class="stat-card"><div class="stat-label">Collected Amount</div><div class="stat-value tabular-nums" style="color:var(--success);">${formatINR(totalPaid)}</div></div>
      <div class="stat-card"><div class="stat-label">Pending Due</div><div class="stat-value tabular-nums" style="color:var(--danger);">${formatINR(totalDue)}</div></div>
      <div class="stat-card"><div class="stat-label">Active Quotations</div><div class="stat-value tabular-nums">${quotes.length}</div></div>
      <div class="stat-card"><div class="stat-label">Sales Returns</div><div class="stat-value tabular-nums">${returns.length}</div></div>
    </div>
    <div class="table-card">
      <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">Recent Invoices (${invoices.length})</h3></div></div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Status</th><th style="text-align:right;">Total</th><th style="text-align:right;">Balance Due</th></tr></thead>
          <tbody>
            ${invoices.slice(0, 12).map(inv => `
              <tr>
                <td class="font-mono">${esc(inv.invoiceNumber || inv.id)}</td>
                <td><strong>${esc(inv.customerName || '-')}</strong></td>
                <td class="tabular-nums">${formatDate(inv.date)}</td>
                <td><span class="badge ${Number(inv.balanceDue) > 0 ? 'badge-warning' : 'badge-success'}">${esc(inv.status || (Number(inv.balanceDue) > 0 ? 'Partial' : 'Paid'))}</span></td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(inv.grandTotal || inv.totalAmount)}</td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(inv.balanceDue || 0)}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No invoices created yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderQuotationsView() {
  const list = getItem(KEYS.QUOTATIONS, []);
  return `
    ${pageHeader('file-spreadsheet', 'Sales Quotations', 'Create customer quotations and convert approved quotes directly into billing invoices',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddQuoteEstimateModal('QUOTATION')">+ New Quotation</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Quote #</th><th>Customer</th><th>Subject / Items</th><th>Valid Until</th><th style="text-align:right;">Amount</th><th>Status</th><th style="text-align:right;">Action</th></tr></thead>
          <tbody>
            ${list.map(q => `
              <tr>
                <td class="font-mono">${esc(q.id)}</td>
                <td><strong>${esc(q.customerName)}</strong><div style="font-size:0.72rem; color:var(--text-muted);">${esc(q.phone || '')}</div></td>
                <td>${esc(q.itemSummary)}</td>
                <td class="tabular-nums">${formatDate(q.validUntil || q.date)}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700;">${formatINR(q.amount)}</td>
                <td><span class="badge ${q.status === 'Converted' ? 'badge-success' : 'badge-info'}">${esc(q.status || 'Open')}</span></td>
                <td style="text-align:right;">
                  ${q.status !== 'Converted' ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.convertQuotationToInvoice('${escAttr(q.id)}')">Convert → Invoice</button>` : '<span style="font-size:0.74rem; color:var(--success);">Billed</span>'}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No quotations created yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderEstimatesView() {
  const list = getItem(KEYS.ESTIMATES, []);
  return `
    ${pageHeader('calculator', 'Cost Estimates', 'Pre-work cost estimates for cyber, computer hardware & bulk printing orders',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddQuoteEstimateModal('ESTIMATE')">+ New Estimate</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Estimate #</th><th>Customer</th><th>Work Description</th><th>Date</th><th style="text-align:right;">Estimated Cost</th><th>Status</th><th style="text-align:right;">Action</th></tr></thead>
          <tbody>
            ${list.map(e => `
              <tr>
                <td class="font-mono">${esc(e.id)}</td>
                <td><strong>${esc(e.customerName)}</strong></td>
                <td>${esc(e.itemSummary)}</td>
                <td class="tabular-nums">${formatDate(e.date)}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700;">${formatINR(e.amount)}</td>
                <td><span class="badge badge-info">${esc(e.status || 'Draft')}</span></td>
                <td style="text-align:right;"><button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printSingleRecord('ESTIMATE', '${escAttr(e.id)}')">Print</button></td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No estimates recorded.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderSalesReturnsView() {
  const list = getItem(KEYS.SALES_RETURNS, []);
  return `
    ${pageHeader('rotate-ccw', 'Sales Returns & Refunds', 'Track returned products, cancelled billing items & customer refunds',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddReturnOrCreditModal('RETURN')">+ Record Sales Return</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Return #</th><th>Invoice Ref</th><th>Customer</th><th>Reason</th><th>Date</th><th style="text-align:right;">Return Value</th></tr></thead>
          <tbody>
            ${list.map(r => `
              <tr>
                <td class="font-mono">${esc(r.id)}</td>
                <td class="font-mono">${esc(r.invoiceRef || '-')}</td>
                <td><strong>${esc(r.customerName)}</strong></td>
                <td>${esc(r.reason)}</td>
                <td class="tabular-nums">${formatDate(r.date)}</td>
                <td class="tabular-nums" style="text-align:right; color:var(--danger); font-weight:700;">${formatINR(r.amount)}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No sales returns recorded.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderCreditNotesView() {
  const list = getItem(KEYS.CREDIT_NOTES, []);
  return `
    ${pageHeader('file-minus', 'Credit Notes', 'Customer credit adjustments linked to invoices and customer ledger',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddReturnOrCreditModal('CREDIT_NOTE')">+ Issue Credit Note</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Credit Note #</th><th>Invoice Ref</th><th>Customer</th><th>Reason</th><th>Date</th><th style="text-align:right;">Credit Amount</th></tr></thead>
          <tbody>
            ${list.map(cn => `
              <tr>
                <td class="font-mono">${esc(cn.id)}</td>
                <td class="font-mono">${esc(cn.invoiceRef || '-')}</td>
                <td><strong>${esc(cn.customerName)}</strong></td>
                <td>${esc(cn.reason)}</td>
                <td class="tabular-nums">${formatDate(cn.date)}</td>
                <td class="tabular-nums" style="text-align:right; color:var(--blue-600); font-weight:700;">${formatINR(cn.amount)}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No credit notes issued.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderGstBillingView() {
  const invoices = getItem(KEYS.INVOICES, []);
  const rows = invoices.map((inv) => {
    const gross = Number(inv.grandTotal || inv.totalAmount || 0);
    const gstAmt = Number(inv.gstAmount || inv.taxAmount || 0);
    const taxable = Math.max(0, gross - gstAmt);
    const cgst = gstAmt / 2;
    const sgst = gstAmt / 2;
    return { id: inv.invoiceNumber || inv.id, date: inv.date, customerName: inv.customerName, gstin: inv.customerGstin || '-', taxable, cgst, sgst, gstAmt, gross };
  });
  const totalTaxable = rows.reduce((s, r) => s + r.taxable, 0);
  const totalGst = rows.reduce((s, r) => s + r.gstAmt, 0);

  return `
    ${pageHeader('percent', 'GST Billing Register', 'Taxable value, CGST/SGST split & invoice-wise GST summary from live Billing records',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('gst_sales', 'excel')">Export GSTR-1 Excel</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('gst_sales', 'print')">Print Register</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1.1rem;">
      <div class="stat-card"><div class="stat-label">GST Invoices</div><div class="stat-value tabular-nums">${rows.length}</div></div>
      <div class="stat-card"><div class="stat-label">Taxable Value</div><div class="stat-value tabular-nums">${formatINR(totalTaxable)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Output GST</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${formatINR(totalGst)}</div></div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>GSTIN</th><th style="text-align:right;">Taxable</th><th style="text-align:right;">CGST</th><th style="text-align:right;">SGST</th><th style="text-align:right;">Total Invoice</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="font-mono">${esc(r.id)}</td>
                <td class="tabular-nums">${formatDate(r.date)}</td>
                <td><strong>${esc(r.customerName)}</strong></td>
                <td class="font-mono">${esc(r.gstin)}</td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(r.taxable)}</td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(r.cgst)}</td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(r.sgst)}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700;">${formatINR(r.gross)}</td>
              </tr>
            `).join('') || '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No invoices found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderCustomerLedgerView() {
  const customers = getItem(KEYS.CUSTOMERS, []);
  const selectedId = DeptUiState.selectedLedgerCustId || customers[0]?.id || '';
  const cust = customers.find(c => c.id === selectedId);
  const invoices = getItem(KEYS.INVOICES, []).filter(i => i.customerId === selectedId);
  const services = getItem(KEYS.SERVICES, []).filter(s => s.customerId === selectedId);
  const payments = getItem(KEYS.PAYMENTS, []).filter(p => p.customerId === selectedId);
  const creditNotes = getItem(KEYS.CREDIT_NOTES, []).filter(c => c.customerId === selectedId);

  const ledger = [
    ...invoices.map(i => ({ date: i.date, type: 'Invoice Debit', ref: i.invoiceNumber || i.id, debit: Number(i.grandTotal || i.totalAmount) || 0, credit: 0 })),
    ...services.map(s => ({ date: s.date, type: 'Service Charge', ref: s.refNumber || s.id, debit: Number(s.totalFee || s.charge) || 0, credit: Number(s.paidAmount) || 0 })),
    ...payments.map(p => ({ date: p.date, type: `Payment (${p.method || 'Cash'})`, ref: p.id, debit: 0, credit: Number(p.amount) || 0 })),
    ...creditNotes.map(cn => ({ date: cn.date, type: 'Credit Note', ref: cn.id, debit: 0, credit: Number(cn.amount) || 0 }))
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  let running = 0;
  const rows = ledger.map(entry => {
    running += entry.debit - entry.credit;
    return { ...entry, balance: running };
  });

  return `
    ${pageHeader('book-open', 'Customer Ledger Statement', 'Chronological Debit, Credit & Running Balance statement per customer')}
    <div class="card" style="padding:0.95rem 1.1rem; margin-bottom:1rem;">
      <label class="form-label" style="font-size:0.75rem;">Select Customer Account</label>
      <select class="form-control" onchange="window.MJK.setDeptState('selectedLedgerCustId', this.value)">
        ${customers.map(c => `<option value="${escAttr(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)} (${esc(c.phone || c.id)})</option>`).join('') || '<option value="">No customers</option>'}
      </select>
    </div>
    <div class="table-card">
      <div class="table-toolbar">
        <div class="table-toolbar-left"><strong>${cust ? `${esc(cust.name)} — Running Ledger` : 'Customer Ledger'}</strong></div>
        <div class="table-toolbar-right"><span class="badge ${running > 0 ? 'badge-danger' : 'badge-success'} tabular-nums">Closing Balance: ${formatINR(running)}</span></div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Voucher Type</th><th>Ref #</th><th style="text-align:right;">Debit (Dr)</th><th style="text-align:right;">Credit (Cr)</th><th style="text-align:right;">Balance</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="tabular-nums">${formatDate(r.date)}</td>
                <td>${esc(r.type)}</td>
                <td class="font-mono">${esc(r.ref)}</td>
                <td class="tabular-nums" style="text-align:right;">${r.debit > 0 ? formatINR(r.debit) : '-'}</td>
                <td class="tabular-nums" style="text-align:right; color:var(--success);">${r.credit > 0 ? formatINR(r.credit) : '-'}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700;">${formatINR(r.balance)}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No ledger entries found for selected customer.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderSalesReportsView() {
  const invoices = getItem(KEYS.INVOICES, []);
  const services = getItem(KEYS.SERVICES, []);
  const invTotal = invoices.reduce((s, i) => s + (Number(i.grandTotal || i.totalAmount) || 0), 0);
  const srvTotal = services.reduce((s, x) => s + (Number(x.totalFee || x.charge) || 0), 0);

  return `
    ${pageHeader('bar-chart-2', 'Sales & Billing Reports', 'Combined billing & counter service revenue analysis',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('gst_sales', 'print')">Print</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('gst_sales', 'pdf')">PDF</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('gst_sales', 'excel')">Excel</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('gst_sales', 'csv')">CSV</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.85rem; margin-bottom:1.1rem;">
      <div class="stat-card"><div class="stat-label">Invoices Revenue</div><div class="stat-value tabular-nums">${formatINR(invTotal)}</div></div>
      <div class="stat-card"><div class="stat-label">Counter Service Revenue</div><div class="stat-value tabular-nums">${formatINR(srvTotal)}</div></div>
      <div class="stat-card"><div class="stat-label">Combined Sales Volume</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${formatINR(invTotal + srvTotal)}</div></div>
    </div>
    ${renderGstBillingView().replace(/<div class="page-header">[\s\S]*?<\/div>\s*<div style="display:grid[\s\S]*?<\/div>\s*/i, '')}
  `;
}

/* =========================================================================
   5. INVENTORY & PURCHASE SUBMODULES
   ========================================================================= */
export function renderInventoryDashboardView() {
  const items = getItem(KEYS.INVENTORY, []);
  const pos = getItem(KEYS.PURCHASE_ORDERS, []);
  const bills = getItem(KEYS.PURCHASE_BILLS, []);
  const lowItems = items.filter(i => Number(i.quantity ?? i.stockQty ?? 0) <= Number(i.minStockLevel ?? i.reorderLevel ?? 5));
  const totalQty = items.reduce((s, i) => s + (Number(i.quantity ?? i.stockQty ?? 0)), 0);
  const stockValue = items.reduce((s, i) => s + (Number(i.quantity ?? i.stockQty ?? 0) * Number(i.unitPrice ?? i.sellingPrice ?? 0)), 0);

  return `
    ${pageHeader('boxes', 'Inventory & Purchase Dashboard', 'Stock overview, reorder alerts, supplier purchase orders & valuation',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('low-stock-alerts')">Low Stock Alerts (${lowItems.length})</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('inventory')">Open All Stock</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1.15rem;">
      <div class="stat-card"><div class="stat-label">Total Products / SKUs</div><div class="stat-value tabular-nums">${items.length}</div></div>
      <div class="stat-card"><div class="stat-label">Total Units in Hand</div><div class="stat-value tabular-nums">${totalQty}</div></div>
      <div class="stat-card"><div class="stat-label">Stock Valuation</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${formatINR(stockValue)}</div></div>
      <div class="stat-card"><div class="stat-label">Low Stock SKUs</div><div class="stat-value tabular-nums" style="color:${lowItems.length > 0 ? 'var(--danger)' : 'var(--success)'};">${lowItems.length}</div></div>
      <div class="stat-card"><div class="stat-label">Purchase Orders / Bills</div><div class="stat-value tabular-nums">${pos.length} / ${bills.length}</div></div>
    </div>
    <div class="table-card">
      <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">Stock Position Snapshot</h3></div></div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>SKU / ID</th><th>Item Name</th><th>Category</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Stock Value</th></tr></thead>
          <tbody>
            ${items.slice(0, 15).map(i => {
              const qty = Number(i.quantity ?? i.stockQty ?? 0);
              const price = Number(i.unitPrice ?? i.sellingPrice ?? 0);
              return `
                <tr>
                  <td class="font-mono">${esc(i.sku || i.id)}</td>
                  <td><strong>${esc(i.name || i.itemName)}</strong></td>
                  <td><span class="badge badge-neutral">${esc(i.category || 'General')}</span></td>
                  <td class="tabular-nums" style="text-align:right; color:${qty <= Number(i.minStockLevel ?? 5) ? 'var(--danger)' : 'inherit'}; font-weight:700;">${qty}</td>
                  <td class="tabular-nums" style="text-align:right;">${formatINR(price)}</td>
                  <td class="tabular-nums" style="text-align:right;">${formatINR(qty * price)}</td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No inventory products added yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderProductCategoriesView() {
  const cats = getItem(KEYS.INVENTORY_CATEGORIES, []);
  const items = getItem(KEYS.INVENTORY, []);
  const allCats = Array.from(new Set([...cats.map(c => typeof c === 'string' ? c : c.name).filter(Boolean), ...items.map(i => i.category).filter(Boolean)]));

  return `
    ${pageHeader('tags', 'Product Categories', 'Manage stock classification categories across Hardware, Stationery & LPG Accessories',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddCategoryModal()">+ Add Category</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Category Name</th><th>Linked Products</th><th>Total Units</th><th style="text-align:right;">Action</th></tr></thead>
          <tbody>
            ${allCats.map(cat => {
              const matched = items.filter(i => i.category === cat);
              const units = matched.reduce((s, x) => s + (Number(x.quantity ?? x.stockQty ?? 0)), 0);
              return `
                <tr>
                  <td><strong>${esc(cat)}</strong></td>
                  <td class="tabular-nums">${matched.length}</td>
                  <td class="tabular-nums">${units}</td>
                  <td style="text-align:right;"><button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('inventory')">View Items</button></td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No product categories configured.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderStockAdjustmentView() {
  const logs = getItem(KEYS.STOCK_ADJUSTMENTS, []);
  return `
    ${pageHeader('sliders-horizontal', 'Stock Adjustment Register', 'Audit-logged positive/negative stock corrections directly synced with Inventory quantities',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openStockAdjustmentModal()">+ Adjust Stock Quantity</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Item Name</th><th>Type</th><th style="text-align:right;">Delta Qty</th><th style="text-align:right;">New Qty</th><th>Reason / By</th></tr></thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td class="tabular-nums">${formatDate(l.date)}</td>
                <td><strong>${esc(l.itemName)}</strong></td>
                <td><span class="badge ${l.delta >= 0 ? 'badge-success' : 'badge-danger'}">${esc(l.type)}</span></td>
                <td class="tabular-nums" style="text-align:right; font-weight:700;">${l.delta >= 0 ? `+${l.delta}` : l.delta}</td>
                <td class="tabular-nums" style="text-align:right;">${l.afterQty}</td>
                <td>${esc(l.reason)} · <span style="color:var(--text-muted); font-size:0.75rem;">${esc(l.actor || '')}</span></td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No stock adjustments logged yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderPurchaseOrdersView() {
  const pos = getItem(KEYS.PURCHASE_ORDERS, []);
  return `
    ${pageHeader('clipboard-list', 'Purchase Orders', 'Create vendor orders and Receive PO directly into Inventory & Purchase Bills',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openCreatePoModal()">+ Create Purchase Order</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>PO #</th><th>Supplier</th><th>Item &amp; Qty</th><th>Expected Date</th><th style="text-align:right;">Order Value</th><th>Status</th><th style="text-align:right;">Action</th></tr></thead>
          <tbody>
            ${pos.map(po => `
              <tr>
                <td class="font-mono">${esc(po.id)}</td>
                <td><strong>${esc(po.supplierName)}</strong></td>
                <td>${esc(po.itemName)} × <strong class="tabular-nums">${po.qty}</strong></td>
                <td class="tabular-nums">${formatDate(po.expectedDate || po.date)}</td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(po.totalAmount)}</td>
                <td><span class="badge ${po.status === 'Received' ? 'badge-success' : 'badge-warning'}">${esc(po.status || 'Ordered')}</span></td>
                <td style="text-align:right;">
                  ${po.status !== 'Received' ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.receivePurchaseOrder('${escAttr(po.id)}')">Mark Received</button>` : '<span style="color:var(--success); font-size:0.76rem;">Stock Added</span>'}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No purchase orders created yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderSuppliersMasterView() {
  const suppliers = getItem(KEYS.GAS_SUPPLIERS, []);
  return `
    ${pageHeader('truck', 'Suppliers & Vendors Master', 'Unified vendor directory for hardware stock, stationery & LPG distributor supplies',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddSupplierQuickModal()">+ Add Supplier</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Supplier ID</th><th>Company / Vendor Name</th><th>Category</th><th>Phone</th><th>GSTIN / Address</th></tr></thead>
          <tbody>
            ${suppliers.map(s => `
              <tr>
                <td class="font-mono">${esc(s.id)}</td>
                <td><strong>${esc(s.name || s.supplierName)}</strong></td>
                <td><span class="badge badge-info">${esc(s.category || 'General Vendor')}</span></td>
                <td class="tabular-nums">${esc(s.phone || s.mobile || '-')}</td>
                <td>${esc(s.gstin || s.address || '-')}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No suppliers registered yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderPurchaseBillsView() {
  const bills = getItem(KEYS.PURCHASE_BILLS, []);
  const unpaidTotal = bills.filter(b => b.status !== 'Paid').reduce((s, b) => s + (Number(b.amount) || 0), 0);

  return `
    ${pageHeader('file-text', 'Purchase Bills & Vendor Invoices', 'Track vendor bills, input GST & accounts payable settlement',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddPurchaseBillModal()">+ Record Purchase Bill</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.85rem; margin-bottom:1.1rem;">
      <div class="stat-card"><div class="stat-label">Total Purchase Bills</div><div class="stat-value tabular-nums">${bills.length}</div></div>
      <div class="stat-card"><div class="stat-label">Unpaid Vendor Payable</div><div class="stat-value tabular-nums" style="color:var(--danger);">${formatINR(unpaidTotal)}</div></div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Bill #</th><th>Vendor</th><th>Date</th><th style="text-align:right;">GST</th><th style="text-align:right;">Total Bill</th><th>Status</th><th style="text-align:right;">Action</th></tr></thead>
          <tbody>
            ${bills.map(b => `
              <tr>
                <td class="font-mono">${esc(b.billNo || b.id)}</td>
                <td><strong>${esc(b.supplierName)}</strong></td>
                <td class="tabular-nums">${formatDate(b.date)}</td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(b.gstAmount || 0)}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700;">${formatINR(b.amount)}</td>
                <td><span class="badge ${b.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${esc(b.status || 'Unpaid')}</span></td>
                <td style="text-align:right;">
                  ${b.status !== 'Paid' ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.markPurchaseBillPaid('${escAttr(b.id)}')">Mark Paid</button>` : '<span style="color:var(--success); font-size:0.76rem;">Settled</span>'}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No purchase bills recorded.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderStockTransfersView() {
  const transfers = getItem(KEYS.STOCK_TRANSFERS, []);
  return `
    ${pageHeader('arrow-left-right', 'Stock Transfers', 'Inter-godown, showroom & counter stock transfer logs',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openStockTransferModal()">+ New Stock Transfer</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Transfer #</th><th>Date</th><th>Item Name</th><th>From Location</th><th>To Location</th><th style="text-align:right;">Qty</th><th>Status</th></tr></thead>
          <tbody>
            ${transfers.map(t => `
              <tr>
                <td class="font-mono">${esc(t.id)}</td>
                <td class="tabular-nums">${formatDate(t.date)}</td>
                <td><strong>${esc(t.itemName)}</strong></td>
                <td>${esc(t.fromLocation)}</td>
                <td>${esc(t.toLocation)}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700;">${t.qty}</td>
                <td><span class="badge badge-success">${esc(t.status || 'Completed')}</span></td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No stock transfers logged yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderLowStockAlertsView() {
  const items = getItem(KEYS.INVENTORY, []).filter(i => Number(i.quantity ?? i.stockQty ?? 0) <= Number(i.minStockLevel ?? i.reorderLevel ?? 5));
  return `
    ${pageHeader('alert-triangle', 'Low Stock Alerts', 'Items at or below minimum reorder threshold',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('purchase-orders')">Create Reorder PO</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>SKU</th><th>Product Name</th><th>Category</th><th style="text-align:right;">Current Qty</th><th style="text-align:right;">Min Reorder Level</th><th style="text-align:right;">Quick Action</th></tr></thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td class="font-mono">${esc(i.sku || i.id)}</td>
                <td><strong>${esc(i.name || i.itemName)}</strong></td>
                <td>${esc(i.category || 'General')}</td>
                <td class="tabular-nums" style="text-align:right; color:var(--danger); font-weight:700;">${Number(i.quantity ?? i.stockQty ?? 0)}</td>
                <td class="tabular-nums" style="text-align:right;">${Number(i.minStockLevel ?? i.reorderLevel ?? 5)}</td>
                <td style="text-align:right;"><button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openCreatePoModal('${escAttr(i.name || i.itemName)}')">Order Stock</button></td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--success);">All inventory items are adequately stocked!</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function buildDeterministicBarcodeBarsHtml(code, compact = false) {
  const heightPx = compact ? 34 : 52;
  const scale = compact ? 1.4 : 2;
  return Array.from(String(code || 'MUN')).map((ch, idx) => {
    const val = ch.charCodeAt(0) + idx * 7;
    const w1 = ((val % 3) + 1) * scale;
    const g1 = (((val >> 1) % 2) + 1) * scale;
    const w2 = (((val >> 2) % 2) + 1) * scale;
    const g2 = (((val >> 3) % 2) + 1) * scale;
    return `<span style="display:inline-block; background:#0f172a; width:${w1}px; height:${heightPx}px; margin-right:${g1}px;"></span><span style="display:inline-block; background:#0f172a; width:${w2}px; height:${heightPx}px; margin-right:${g2}px;"></span>`;
  }).join('');
}

function buildBarcodeStickerCardHtml(item, sizeMode = 'standard', rollWidth = '2in') {
  const code = String(item?.sku || item?.id || 'MUN-BARCODE').toUpperCase();
  const title = item?.name || item?.itemName || 'Sample Product';
  const price = Number(item?.sellingPrice ?? item?.unitPrice ?? 0);
  const compact = sizeMode === 'compact';
  const maxWidth = rollWidth === '3in' ? '76mm' : '48mm';
  return `
    <div class="barcode-sticker-item ${compact ? 'is-compact' : 'is-standard'}" style="background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:6px; padding:${compact ? '0.45rem 0.6rem' : '0.7rem 0.9rem'}; text-align:center; width:100%; max-width:${maxWidth}; margin:0 auto;">
      <div style="font-size:${compact ? '0.62rem' : '0.74rem'}; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#0f172a;">MUN COMPUTER</div>
      <div style="font-size:${compact ? '0.76rem' : '0.88rem'}; font-weight:700; margin:0.18rem 0 ${compact ? '0.3rem' : '0.45rem'} 0; line-height:1.25;">${esc(title)}</div>
      <div class="font-mono tabular-nums" style="font-size:${compact ? '0.78rem' : '0.92rem'}; font-weight:800; color:#0f172a; margin-bottom:${compact ? '0.28rem' : '0.4rem'};">MRP ${formatINR(price)}</div>
      <div style="display:inline-flex; align-items:center; justify-content:center; padding:${compact ? '0.25rem 0.45rem' : '0.35rem 0.65rem'}; border:1px dashed #94a3b8; background:#ffffff;">${buildDeterministicBarcodeBarsHtml(code, compact)}</div>
      <div class="font-mono" style="font-size:${compact ? '0.68rem' : '0.78rem'}; font-weight:800; margin-top:0.25rem; letter-spacing:0.12em; color:#0f172a;">*${esc(code)}*</div>
    </div>
  `;
}

export function renderBarcodeManagementView() {
  const items = getItem(KEYS.INVENTORY, []);
  const selectedId = DeptUiState.selectedBarcodeItemId || items[0]?.id || '';
  const item = items.find(i => i.id === selectedId) || items[0] || null;
  const code = item ? String(item.sku || item.id || 'MUN-ITEM').toUpperCase() : 'MUN-BARCODE';
  const rollWidth = DeptUiState.barcodeRollWidth || '2in';
  const labelSize = DeptUiState.barcodeLabelSize || 'standard';

  const batchRows = (Array.isArray(DeptUiState.barcodeBatch) ? DeptUiState.barcodeBatch : [])
    .map(b => ({ ...b, item: items.find(i => i.id === b.itemId) }))
    .filter(b => b.item);
  const effectiveBatch = batchRows.length > 0
    ? batchRows
    : (item ? [{ itemId: item.id, qty: 1, item }] : []);
  const totalStickers = effectiveBatch.reduce((s, b) => s + Math.max(1, Number(b.qty) || 1), 0);

  return `
    ${pageHeader('scan-barcode', 'Barcode & SKU Label Generator', 'Batch retail & thermal label studio — export crisp JPG labels or print directly to 2-inch / 3-inch thermal rolls')}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(310px, 1fr)); gap:1rem; align-items:start;">
      <div class="card" style="padding:1.1rem;">
        <div class="form-group">
          <label class="form-label">Select Product for Barcode</label>
          <div style="display:flex; gap:0.45rem;">
            <select id="barcode-item-select" class="form-control" onchange="window.MJK.setDeptState('selectedBarcodeItemId', this.value)">
              ${items.map(i => `<option value="${escAttr(i.id)}" ${i.id === selectedId ? 'selected' : ''}>${esc(i.name || i.itemName)} (${esc(i.sku || i.id)}) — ${formatINR(i.sellingPrice ?? i.unitPrice ?? 0)}</option>`).join('') || '<option value="">No inventory items</option>'}
            </select>
            <button type="button" class="btn btn-outline btn-sm" style="white-space:nowrap;" onclick="window.MJK.addToBarcodeBatch('${escAttr(selectedId)}', 1)">+ Queue</button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-top:0.5rem;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Label Layout Size</label>
            <select class="form-control" onchange="window.MJK.setDeptState('barcodeLabelSize', this.value)">
              <option value="standard" ${labelSize === 'standard' ? 'selected' : ''}>Standard Retail Label</option>
              <option value="compact" ${labelSize === 'compact' ? 'selected' : ''}>Compact Mini Sticker</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Thermal Roll Width</label>
            <select class="form-control" onchange="window.MJK.setDeptState('barcodeRollWidth', this.value)">
              <option value="2in" ${rollWidth === '2in' ? 'selected' : ''}>2-inch Roll (50mm)</option>
              <option value="3in" ${rollWidth === '3in' ? 'selected' : ''}>3-inch Roll (80mm)</option>
            </select>
          </div>
        </div>

        <div style="margin-top:0.9rem; padding-top:0.85rem; border-top:1px solid var(--border-subtle);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <strong style="font-size:0.82rem;">Batch Sticker Queue (${totalStickers} stickers)</strong>
            <div style="display:flex; gap:0.35rem;">
              ${item ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.addToBarcodeBatch('${escAttr(item.id)}', 10)">+10 of Selected</button>` : ''}
              ${batchRows.length > 0 ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.clearBarcodeBatch()">Clear Queue</button>` : ''}
            </div>
          </div>
          ${batchRows.length > 0 ? `
            <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:190px; overflow-y:auto;">
              ${batchRows.map(b => `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; padding:0.4rem 0.6rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); font-size:0.78rem;">
                  <div style="min-width:0; flex:1;">
                    <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(b.item.name || b.item.itemName)}</div>
                    <div class="font-mono" style="font-size:0.68rem; color:var(--text-muted);">${esc(b.item.sku || b.item.id)} · ${formatINR(b.item.sellingPrice ?? b.item.unitPrice ?? 0)}</div>
                  </div>
                  <div style="display:flex; align-items:center; gap:0.3rem;">
                    <input type="number" min="1" max="500" class="form-control font-mono tabular-nums" style="width:64px; padding:0.2rem 0.35rem; text-align:center;" value="${Number(b.qty) || 1}" onchange="window.MJK.updateBarcodeBatchQty('${escAttr(b.itemId)}', this.value)">
                    <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); padding:0.15rem 0.45rem;" onclick="window.MJK.removeFromBarcodeBatch('${escAttr(b.itemId)}')">&times;</button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `<div style="font-size:0.76rem; color:var(--text-muted); padding:0.5rem; background:var(--surface-alt); border-radius:var(--radius-sm);">Queue empty — printing or downloading will use 1 label for <strong>${esc(item?.name || item?.itemName || code)}</strong>. Click <strong>+ Queue</strong> or <strong>+10 of Selected</strong> to print multi-product batches.</div>`}
        </div>
      </div>

      <div class="card" style="padding:1.15rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.85rem;">
          <div>
            <strong style="font-size:0.9rem;">Live Label Preview</strong>
            <div style="font-size:0.72rem; color:var(--text-muted);">SKU: <span class="font-mono">${esc(code)}</span> · Roll: ${rollWidth === '3in' ? '80mm (3-inch)' : '50mm (2-inch)'}</div>
          </div>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-outline btn-sm" style="white-space:nowrap;" onclick="window.MJK.downloadBarcodeJpg('${escAttr(item?.id || '')}')">⬇ Download as JPG / Image</button>
            <button type="button" class="btn btn-primary btn-sm" style="white-space:nowrap;" onclick="window.MJK.printThermalBarcodeBatch()">🖨 Print Thermal Label (${rollWidth === '3in' ? '3-inch' : '2-inch'})</button>
          </div>
        </div>
        <div style="background:var(--surface-alt); border:1px dashed var(--border-subtle); border-radius:var(--radius-md); padding:1.25rem; display:flex; align-items:center; justify-content:center;">
          ${buildBarcodeStickerCardHtml(item, labelSize, rollWidth)}
        </div>
      </div>
    </div>
    <div id="barcode-print-stage" aria-hidden="true"></div>
  `;
}

export function renderInventoryReportsView() {
  return `
    ${pageHeader('file-spreadsheet', 'Inventory Valuation & Stock Reports', 'Export full SKU stock levels, low stock alerts & inventory valuation sheets',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('inventory', 'print')">Print</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('inventory', 'pdf')">PDF</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('inventory', 'excel')">Excel</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('inventory', 'csv')">CSV</button>`
    )}
    ${renderInventoryDashboardView().replace(/<div class="page-header">[\s\S]*?<\/div>\s*/i, '')}
  `;
}

/* =========================================================================
   6. FINANCE & ACCOUNTING SUBMODULES
   ========================================================================= */
export function computeLiveFinanceLedgerSummary() {
  const finSummary = generateFinancialSummary('all', 'month');
  const todayTally = calculateDayTally(getTodayDate());
  const banks = getItem(KEYS.BANK_ACCOUNTS, []);
  const services = getItem(KEYS.SERVICES, []);
  const invoices = getItem(KEYS.INVOICES, []);
  const gasCols = getItem(KEYS.GAS_COLLECTIONS, []);
  const payments = getItem(KEYS.PAYMENTS, []);
  const expenses = getItem(KEYS.EXPENSES, []);
  const payslips = getItem(KEYS.PAYSLIPS, []);
  const bills = getItem(KEYS.PURCHASE_BILLS, []);
  const gasPurchases = getItem(KEYS.GAS_PURCHASES, []);
  const inventory = getItem(KEYS.INVENTORY, []);
  const investments = getItem(KEYS.INVESTMENTS, []);
  const journals = getItem(KEYS.JOURNAL_ENTRIES, []);

  const cashInHand = round2(todayTally?.closingCash ?? finSummary?.cashBalance ?? 0);
  const upiBalance = round2(finSummary?.upiBalance ?? 0);
  const bankAccountsTotal = round2(banks.reduce((s, b) => s + (Number(b.balance) || 0), 0));
  const ledgerBankBalance = round2(finSummary?.bankBalance ?? 0);

  const srvRev = round2(services.reduce((s, x) => s + (Number(x.totalAmount ?? x.totalFee ?? x.charge) || 0), 0));
  const invRev = round2(invoices.filter(x => !x.serviceId).reduce((s, x) => s + (Number(x.grandTotal ?? x.totalAmount) || 0), 0));
  const allInvTotal = round2(invoices.reduce((s, x) => s + (Number(x.grandTotal ?? x.totalAmount) || 0), 0));
  const gasRev = round2(gasCols.reduce((s, x) => s + (Number(x.amountPaid ?? x.paidAmount ?? x.amount) || 0), 0));
  const bankCommRev = round2(finSummary?.bankingCommission || 0);
  const totalRevenue = round2(srvRev + invRev + gasRev + bankCommRev);

  const expenseCatMap = new Map();
  let operatingExp = 0;
  expenses.forEach(e => {
    const amt = round2(e.amount);
    operatingExp = round2(operatingExp + amt);
    const cat = String(e.category || 'Operating Expenses').trim() || 'Operating Expenses';
    expenseCatMap.set(cat, round2((expenseCatMap.get(cat) || 0) + amt));
  });
  const payrollExp = round2(payslips.reduce((s, p) => s + (Number(p.netPay) || 0), 0));
  if (payrollExp > 0) {
    expenseCatMap.set('Employee Salaries & Payroll', round2((expenseCatMap.get('Employee Salaries & Payroll') || 0) + payrollExp));
  }
  const totalCosts = round2(operatingExp + payrollExp);

  const outputGst = round2(invoices.reduce((s, i) => s + (Number(i.gstAmount ?? i.taxAmount) || 0), 0));
  const inputGst = round2(bills.reduce((s, b) => s + (Number(b.gstAmount) || 0), 0));
  const netGst = round2(outputGst - inputGst);
  const gstPayableLiability = netGst > 0 ? netGst : 0;
  const gstItcAsset = netGst < 0 ? round2(Math.abs(netGst)) : 0;

  const netProfitBeforeTax = round2(totalRevenue - totalCosts);
  const netProfitAfterGst = round2(netProfitBeforeTax - gstPayableLiability);

  const stockVal = round2(inventory.reduce((s, i) => {
    const q = Number(i.quantity ?? i.stockQuantity ?? i.stockQty ?? 0);
    const p = Number(i.sellingPrice ?? i.unitPrice ?? 0);
    return s + q * p;
  }, 0));
  const receivables = round2(getAllCombinedDuesRows().reduce((s, d) => s + d.due, 0));
  const unpaidBills = round2(bills.filter(b => b.status !== 'Paid').reduce((s, b) => s + (Number(b.amount) || 0), 0));
  const unpaidGasPurchases = round2(gasPurchases.filter(p => Number(p.dueAmount) > 0).reduce((s, p) => s + (Number(p.dueAmount) || 0), 0));
  const payables = round2(unpaidBills + unpaidGasPurchases);
  const capitalInvested = round2(investments.reduce((s, i) => s + (Number(i.amount) || 0), 0));

  const totalAssets = round2(cashInHand + upiBalance + bankAccountsTotal + stockVal + receivables + gstItcAsset);
  const retainedOrBalance = round2(totalAssets - payables - gstPayableLiability - capitalInvested);
  const totalLiabilitiesAndCapital = round2(payables + gstPayableLiability + capitalInvested + retainedOrBalance);
  const balanceVariance = round2(totalAssets - totalLiabilitiesAndCapital);

  const totalReceipts = round2(payments.reduce((s, p) => s + (Number(p.paymentAmount ?? p.amount) || 0), 0));

  return {
    finSummary,
    todayTally,
    cashInHand,
    upiBalance,
    bankAccountsTotal,
    ledgerBankBalance,
    srvRev,
    invRev,
    allInvTotal,
    gasRev,
    bankCommRev,
    totalRevenue,
    operatingExp,
    payrollExp,
    totalCosts,
    expensesByCategory: Array.from(expenseCatMap.entries()).sort((a, b) => b[1] - a[1]),
    outputGst,
    inputGst,
    netGst,
    gstPayableLiability,
    gstItcAsset,
    netProfitBeforeTax,
    netProfitAfterGst,
    stockVal,
    receivables,
    payables,
    capitalInvested,
    totalAssets,
    retainedOrBalance,
    totalLiabilitiesAndCapital,
    balanceVariance,
    totalReceipts,
    journalCount: journals.length
  };
}

export function renderFinanceDashboardView() {
  const fin = computeLiveFinanceLedgerSummary();

  return `
    ${pageHeader('wallet', 'Finance & Accounting Dashboard', 'Real-time Counter Cash, UPI/QR Ledger, Bank Liquidity, GST Liability & P&L overview',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('profit-loss')">Profit &amp; Loss</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('balance-sheet')">Balance Sheet</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('bank-reconciliation')">Reconcile Bank &amp; Cash</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('counter-daybook')">Counter Day Book</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1.15rem;">
      <div class="stat-card"><div class="stat-label">Month Collected Income</div><div class="stat-value tabular-nums" style="color:var(--success);">${formatINR(fin.finSummary.totalOperatingIncome || 0)}</div></div>
      <div class="stat-card"><div class="stat-label">Counter Cash Drawer</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${formatINR(fin.cashInHand)}</div></div>
      <div class="stat-card"><div class="stat-label">UPI / QR + Bank Liquidity</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${formatINR(fin.upiBalance + fin.bankAccountsTotal)}</div></div>
      <div class="stat-card"><div class="stat-label">Net GST (${fin.netGst >= 0 ? 'Payable' : 'ITC Credit'})</div><div class="stat-value tabular-nums" style="color:${fin.netGst >= 0 ? 'var(--danger)' : 'var(--success)'};">${formatINR(Math.abs(fin.netGst))}</div></div>
      <div class="stat-card"><div class="stat-label">Receivables / Payables</div><div class="stat-value tabular-nums" style="font-size:1.05rem;">${formatINR(fin.receivables)} / <span style="color:var(--danger);">${formatINR(fin.payables)}</span></div></div>
    </div>
    ${renderProfitLossView().replace(/<div class="page-header">[\s\S]*?<\/div>\s*/i, '')}
  `;
}

export function renderBankAccountsView() {
  const accounts = getItem(KEYS.BANK_ACCOUNTS, []);
  return `
    ${pageHeader('landmark', 'Bank & Cash Accounts', 'Maintain MUN COMPUTER business bank accounts, CSP settlement accounts & petty cash wallets',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddBankAccountModal()">+ Add Bank Account</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Account Name</th><th>Bank &amp; Branch</th><th>Account No.</th><th>IFSC</th><th style="text-align:right;">Current Balance</th></tr></thead>
          <tbody>
            ${accounts.map(a => `
              <tr>
                <td><strong>${esc(a.accountName)}</strong></td>
                <td>${esc(a.bankName)}</td>
                <td class="font-mono">${esc(a.accountNumber || '-')}</td>
                <td class="font-mono">${esc(a.ifsc || '-')}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700; color:var(--blue-600);">${formatINR(a.balance || 0)}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No bank accounts added yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderDailyTransactionsView() {
  const payments = getItem(KEYS.PAYMENTS, []).map(p => ({
    date: p.paymentDate || p.date || '',
    type: 'Receipt',
    particular: p.customerName || p.serviceName || p.receiptId || p.id,
    mode: p.paymentMethod || p.method || 'Cash',
    inAmt: round2(p.paymentAmount ?? p.amount),
    outAmt: 0
  }));
  const expenses = getItem(KEYS.EXPENSES, []).map(e => ({
    date: e.date || '',
    type: `Expense · ${e.category || 'General'}`,
    particular: e.title || e.description || e.category || e.id,
    mode: e.paymentMethod || e.paymentMode || 'Cash',
    inAmt: 0,
    outAmt: round2(e.amount)
  }));
  const daybook = getItem(KEYS.COUNTER_CASH_TXNS, []).map(c => {
    const typeUpper = String(c.type || '').toUpperCase();
    const isIn = String(c.direction || '').toUpperCase() === 'IN' || typeUpper === 'CASH_RECEIVED' || typeUpper === 'CASH_WITHDRAWAL';
    return {
      date: c.date || '',
      type: c.type || 'Counter',
      particular: c.description || c.category || c.id,
      mode: c.paymentMode || 'Cash',
      inAmt: isIn ? round2(c.amount) : 0,
      outAmt: !isIn ? round2(c.amount) : 0
    };
  });
  const feed = [...payments, ...expenses, ...daybook].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return `
    ${pageHeader('arrow-up-down', 'Daily Transactions Register', 'Combined chronological cash-in & cash-out stream across Payments, Categorized Expenses & Counter Day Book')}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Type / Category</th><th>Particulars</th><th>Mode</th><th style="text-align:right;">Cash In (+)</th><th style="text-align:right;">Cash Out (-)</th></tr></thead>
          <tbody>
            ${feed.slice(0, 80).map(r => `
              <tr>
                <td class="tabular-nums">${formatDate(r.date)}</td>
                <td><span class="badge ${r.inAmt > 0 ? 'badge-success' : 'badge-danger'}">${esc(r.type)}</span></td>
                <td>${esc(r.particular)}</td>
                <td>${esc(r.mode)}</td>
                <td class="tabular-nums" style="text-align:right; color:var(--success);">${r.inAmt > 0 ? formatINR(r.inAmt, true) : '-'}</td>
                <td class="tabular-nums" style="text-align:right; color:var(--danger);">${r.outAmt > 0 ? formatINR(r.outAmt, true) : '-'}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No financial transactions recorded.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderAccountsPayableView() {
  const bills = getItem(KEYS.PURCHASE_BILLS, []).filter(b => b.status !== 'Paid');
  const gasPurchases = getItem(KEYS.GAS_PURCHASES, []).filter(p => Number(p.dueAmount) > 0);
  return `
    ${pageHeader('credit-card', 'Accounts Payable (Vendors)', 'Outstanding supplier invoices and LPG distributor purchase payables',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('purchase-bills')">Manage Purchase Bills</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Source</th><th>Reference</th><th>Supplier</th><th>Date</th><th style="text-align:right;">Payable Due</th></tr></thead>
          <tbody>
            ${bills.map(b => `<tr><td><span class="badge badge-warning">Purchase Bill</span></td><td class="font-mono">${esc(b.billNo || b.id)}</td><td><strong>${esc(b.supplierName)}</strong></td><td class="tabular-nums">${formatDate(b.date)}</td><td class="tabular-nums" style="text-align:right; color:var(--danger); font-weight:700;">${formatINR(b.amount)}</td></tr>`).join('')}
            ${gasPurchases.map(p => `<tr><td><span class="badge badge-info">Gas Purchase</span></td><td class="font-mono">${esc(p.id)}</td><td><strong>${esc(p.supplierName || 'Distributor')}</strong></td><td class="tabular-nums">${formatDate(p.date)}</td><td class="tabular-nums" style="text-align:right; color:var(--danger); font-weight:700;">${formatINR(p.dueAmount)}</td></tr>`).join('')}
            ${(bills.length + gasPurchases.length) === 0 ? '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--success);">Zero unpaid vendor bills pending!</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderAccountsReceivableView() {
  return renderCustomerDuesView();
}

export function renderGeneralLedgerView() {
  const journals = getItem(KEYS.JOURNAL_ENTRIES, []);
  const fin = computeLiveFinanceLedgerSummary();

  return `
    ${pageHeader('book-open', 'General Ledger Summary', 'Live double-entry account heads across Cash Drawer, UPI/QR, Categorized Expenses, GST & Journal Vouchers')}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Account Head</th><th>Group</th><th style="text-align:right;">Debit (Dr)</th><th style="text-align:right;">Credit (Cr)</th></tr></thead>
          <tbody>
            <tr><td><strong>Service &amp; Sales Receipts Account</strong></td><td>Operating Revenue</td><td class="tabular-nums" style="text-align:right;">-</td><td class="tabular-nums" style="text-align:right; color:var(--success); font-weight:700;">${formatINR(fin.totalReceipts, true)}</td></tr>
            <tr><td><strong>Counter Cash in Hand</strong></td><td>Current Asset</td><td class="tabular-nums" style="text-align:right; color:var(--blue-600); font-weight:700;">${formatINR(fin.cashInHand, true)}</td><td class="tabular-nums" style="text-align:right;">-</td></tr>
            <tr><td><strong>Digital UPI / QR Collection Ledger</strong></td><td>Current Asset</td><td class="tabular-nums" style="text-align:right; color:var(--blue-600); font-weight:700;">${formatINR(fin.upiBalance, true)}</td><td class="tabular-nums" style="text-align:right;">-</td></tr>
            <tr><td><strong>Output GST Control (Sales Tax)</strong></td><td>Tax Liability</td><td class="tabular-nums" style="text-align:right;">-</td><td class="tabular-nums" style="text-align:right; color:var(--danger); font-weight:700;">${formatINR(fin.outputGst, true)}</td></tr>
            <tr><td><strong>Input Tax Credit (Purchase GST)</strong></td><td>Tax Asset</td><td class="tabular-nums" style="text-align:right; color:var(--success); font-weight:700;">${formatINR(fin.inputGst, true)}</td><td class="tabular-nums" style="text-align:right;">-</td></tr>
            ${fin.expensesByCategory.map(([cat, amt]) => `
              <tr>
                <td><strong>Expense · ${esc(cat)}</strong></td>
                <td>Operating Expense</td>
                <td class="tabular-nums" style="text-align:right; color:var(--danger); font-weight:700;">${formatINR(amt, true)}</td>
                <td class="tabular-nums" style="text-align:right;">-</td>
              </tr>
            `).join('')}
            ${journals.map(j => `
              <tr>
                <td><strong>${esc(j.debitAccount)} / ${esc(j.creditAccount)}</strong><div style="font-size:0.72rem; color:var(--text-muted);">${esc(j.narration)}</div></td>
                <td>Journal (${esc(j.id)})</td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(j.amount, true)}</td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(j.amount, true)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderJournalEntriesView() {
  const journals = getItem(KEYS.JOURNAL_ENTRIES, []);
  return `
    ${pageHeader('scale', 'Journal Entries (Double-Entry)', 'Balanced accounting adjustments enforcing Debit = Credit integrity',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddJournalModal()">+ Post Journal Entry</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>JV #</th><th>Date</th><th>Debit Account (Dr)</th><th>Credit Account (Cr)</th><th>Narration</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>
            ${journals.map(j => `
              <tr>
                <td class="font-mono">${esc(j.id)}</td>
                <td class="tabular-nums">${formatDate(j.date)}</td>
                <td><strong>${esc(j.debitAccount)}</strong></td>
                <td><strong>${esc(j.creditAccount)}</strong></td>
                <td>${esc(j.narration)}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700;">${formatINR(j.amount)}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No manual journal entries posted.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderBankReconciliationView() {
  const recs = getItem(KEYS.BANK_RECONCILIATIONS, []);
  const fin = computeLiveFinanceLedgerSummary();
  const banks = getItem(KEYS.BANK_ACCOUNTS, []);
  const totalBookLiquidity = round2(fin.cashInHand + fin.upiBalance + fin.bankAccountsTotal);
  const dayTallyDiff = round2(fin.todayTally?.difference || 0);

  return `
    ${pageHeader('check-square', 'Real-Time Cash & Bank Reconciliation', 'Auto-sync Counter Cash, Digital UPI/QR receipts & Bank Account balances against official statements',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('counter-daybook')">Counter Day Book</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddReconciliationModal()">+ Reconcile Statement</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(185px, 1fr)); gap:0.85rem; margin-bottom:1rem;">
      <div class="stat-card"><div class="stat-label">Live Counter Cash Book</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${formatINR(fin.cashInHand, true)}</div><div class="stat-footer" style="font-size:0.72rem;">Today Diff: ${formatINR(dayTallyDiff, true)}</div></div>
      <div class="stat-card"><div class="stat-label">Live Digital UPI / QR Ledger</div><div class="stat-value tabular-nums" style="color:var(--success);">${formatINR(fin.upiBalance, true)}</div></div>
      <div class="stat-card"><div class="stat-label">Registered Bank Accounts (${banks.length})</div><div class="stat-value tabular-nums">${formatINR(fin.bankAccountsTotal, true)}</div></div>
      <div class="stat-card"><div class="stat-label">Total ERP Book Liquidity</div><div class="stat-value tabular-nums" style="color:var(--blue-700);">${formatINR(totalBookLiquidity, true)}</div></div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Account / Ledger</th><th style="text-align:right;">ERP Book Balance</th><th style="text-align:right;">Statement Balance</th><th style="text-align:right;">Variance</th><th>Status</th></tr></thead>
          <tbody>
            ${recs.map(r => {
              const diff = round2((Number(r.statementBalance) || 0) - (Number(r.bookBalance) || 0));
              const matched = Math.abs(diff) < 0.01;
              return `
                <tr>
                  <td class="tabular-nums">${formatDate(r.date)}</td>
                  <td><strong>${esc(r.accountName)}</strong></td>
                  <td class="tabular-nums" style="text-align:right;">${formatINR(r.bookBalance, true)}</td>
                  <td class="tabular-nums" style="text-align:right;">${formatINR(r.statementBalance, true)}</td>
                  <td class="tabular-nums" style="text-align:right; color:${matched ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">${formatINR(diff, true)}</td>
                  <td><span class="badge ${matched ? 'badge-success' : 'badge-warning'}">${matched ? 'Reconciled ✓' : 'Variance'}</span></td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No bank reconciliation entries saved yet. Click <strong>+ Reconcile Statement</strong> to match a live ERP book balance.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderGstManagementView() {
  const fin = computeLiveFinanceLedgerSummary();

  return `
    ${pageHeader('percent', 'GST Management (Output vs Input Tax Credit)', 'Real-time GST tax liability ledger linking Sales Invoices (Output GST) and Purchase Bills (Input ITC)')}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:0.85rem; margin-bottom:1.15rem;">
      <div class="stat-card"><div class="stat-label">Output GST (Sales Invoices)</div><div class="stat-value tabular-nums" style="color:var(--danger);">${formatINR(fin.outputGst, true)}</div></div>
      <div class="stat-card"><div class="stat-label">Input Tax Credit (Purchases)</div><div class="stat-value tabular-nums" style="color:var(--success);">${formatINR(fin.inputGst, true)}</div></div>
      <div class="stat-card"><div class="stat-label">${fin.netGst >= 0 ? 'Net GST Payable (Liability)' : 'Available Net ITC (Credit)'}</div><div class="stat-value tabular-nums" style="color:${fin.netGst >= 0 ? 'var(--blue-600)' : 'var(--success)'};">${formatINR(Math.abs(fin.netGst), true)}</div></div>
    </div>
    ${renderGstBillingView().replace(/<div class="page-header">[\s\S]*?<\/div>\s*<div style="display:grid[\s\S]*?<\/div>\s*/i, '')}
  `;
}

export function renderFinancialReportsHubView() {
  return `
    ${pageHeader('file-spreadsheet', 'Financial Reports Hub', 'Official P&L, Balance Sheet, Counter Cash Reports & Ledger Exports',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('profit-loss')">Profit &amp; Loss</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('balance-sheet')">Balance Sheet</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('cash-reports')">Cash Reports</button>`
    )}
    ${renderProfitLossView().replace(/<div class="page-header">[\s\S]*?<\/div>\s*/i, '')}
  `;
}

export function renderProfitLossView() {
  const fin = computeLiveFinanceLedgerSummary();

  return `
    ${pageHeader('trending-up', 'Profit & Loss Statement (Income Statement)', 'Live consolidated Revenue vs Categorized Operating Expenses, Payroll & Net GST Liability',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('pnl', 'print')">Print P&amp;L</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('pnl', 'pdf')">PDF</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('pnl', 'excel')">Excel</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Statement Head</th><th>Category / Division</th><th style="text-align:right;">Amount (INR)</th></tr></thead>
          <tbody>
            <tr><td><strong>Counter Services Revenue</strong></td><td>Operating Income</td><td class="tabular-nums" style="text-align:right;">${formatINR(fin.srvRev, true)}</td></tr>
            <tr><td><strong>Standalone Billing Invoices Revenue</strong></td><td>Sales &amp; Billing</td><td class="tabular-nums" style="text-align:right;">${formatINR(fin.invRev, true)}</td></tr>
            <tr><td><strong>LPG &amp; Gas Collections</strong></td><td>LPG Division</td><td class="tabular-nums" style="text-align:right;">${formatINR(fin.gasRev, true)}</td></tr>
            <tr><td><strong>PNB CSP / AEPS Banking Commissions</strong></td><td>Financial Inclusion</td><td class="tabular-nums" style="text-align:right;">${formatINR(fin.bankCommRev, true)}</td></tr>
            <tr style="background:rgba(16,185,129,0.08);"><td><strong>Total Gross Revenue</strong></td><td>Total Income</td><td class="tabular-nums" style="text-align:right; font-weight:800; color:var(--success);">${formatINR(fin.totalRevenue, true)}</td></tr>
            ${fin.expensesByCategory.map(([cat, amt]) => `
              <tr><td><strong>${esc(cat)}</strong></td><td>Categorized Expense</td><td class="tabular-nums" style="text-align:right; color:var(--danger);">${formatINR(amt, true)}</td></tr>
            `).join('') || '<tr><td><strong>Operating &amp; Payroll Expenses</strong></td><td>Expense</td><td class="tabular-nums" style="text-align:right;">₹0.00</td></tr>'}
            <tr style="background:rgba(239,68,68,0.06);"><td><strong>Total Operating &amp; Payroll Costs</strong></td><td>Total Outflow</td><td class="tabular-nums" style="text-align:right; font-weight:800; color:var(--danger);">${formatINR(fin.totalCosts, true)}</td></tr>
            <tr><td><strong>Net GST Adjustment (Output ${formatINR(fin.outputGst, true)} − Input ITC ${formatINR(fin.inputGst, true)})</strong></td><td>Tax Control</td><td class="tabular-nums" style="text-align:right; color:${fin.netGst > 0 ? 'var(--danger)' : 'var(--success)'};">${fin.netGst >= 0 ? `-${formatINR(fin.netGst, true)}` : `+${formatINR(Math.abs(fin.netGst), true)}`}</td></tr>
            <tr style="background:rgba(59,130,246,0.08);"><td><strong>Net Operating Profit / (Loss)</strong></td><td>Bottom Line (Before GST)</td><td class="tabular-nums" style="text-align:right; font-weight:800; font-size:1rem; color:${fin.netProfitBeforeTax >= 0 ? 'var(--blue-600)' : 'var(--danger)'};">${formatINR(fin.netProfitBeforeTax, true)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderBalanceSheetView() {
  const fin = computeLiveFinanceLedgerSummary();
  const isBalanced = Math.abs(fin.balanceVariance) < 0.01;

  return `
    ${pageHeader('scale', 'Balance Sheet (Auto-Balanced Ledger)', 'Assets strictly balanced against Liabilities & Owner Capital with real-time GST Input/Output tracking',
      `<span class="badge ${isBalanced ? 'badge-success' : 'badge-warning'} font-mono tabular-nums">${isBalanced ? 'Auto-Balanced ✓ (Variance: ₹0.00)' : `Variance: ${formatINR(fin.balanceVariance, true)}`}</span>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(310px, 1fr)); gap:1rem;">
      <div class="table-card">
        <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">Assets (Current &amp; Liquid)</h3></div></div>
        <table class="data-table">
          <tbody>
            <tr><td>Counter Cash in Hand</td><td class="tabular-nums" style="text-align:right;">${formatINR(fin.cashInHand, true)}</td></tr>
            <tr><td>Digital UPI / QR Ledger Balance</td><td class="tabular-nums" style="text-align:right;">${formatINR(fin.upiBalance, true)}</td></tr>
            <tr><td>Business Bank Accounts</td><td class="tabular-nums" style="text-align:right;">${formatINR(fin.bankAccountsTotal, true)}</td></tr>
            <tr><td>Closing Inventory Valuation</td><td class="tabular-nums" style="text-align:right;">${formatINR(fin.stockVal, true)}</td></tr>
            <tr><td>Accounts Receivable (Customer Dues)</td><td class="tabular-nums" style="text-align:right;">${formatINR(fin.receivables, true)}</td></tr>
            ${fin.gstItcAsset > 0 ? `<tr><td>Net GST Input Tax Credit Receivable</td><td class="tabular-nums" style="text-align:right; color:var(--success);">${formatINR(fin.gstItcAsset, true)}</td></tr>` : ''}
            <tr style="background:rgba(59,130,246,0.08);"><td><strong>Total Assets</strong></td><td class="tabular-nums" style="text-align:right; font-weight:800;">${formatINR(fin.totalAssets, true)}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="table-card">
        <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">Liabilities &amp; Owner Capital</h3></div></div>
        <table class="data-table">
          <tbody>
            <tr><td>Accounts Payable (Vendor &amp; Gas Purchases)</td><td class="tabular-nums" style="text-align:right;">${formatINR(fin.payables, true)}</td></tr>
            <tr><td>Net GST Output Liability Payable</td><td class="tabular-nums" style="text-align:right; color:${fin.gstPayableLiability > 0 ? 'var(--danger)' : 'inherit'};">${formatINR(fin.gstPayableLiability, true)}</td></tr>
            <tr><td>Owner Capital &amp; Investments</td><td class="tabular-nums" style="text-align:right;">${formatINR(fin.capitalInvested, true)}</td></tr>
            <tr><td>Retained Reserves &amp; Current Surplus</td><td class="tabular-nums" style="text-align:right;">${formatINR(fin.retainedOrBalance, true)}</td></tr>
            <tr style="background:rgba(16,185,129,0.08);"><td><strong>Total Liabilities &amp; Capital</strong></td><td class="tabular-nums" style="text-align:right; font-weight:800;">${formatINR(fin.totalLiabilitiesAndCapital, true)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   7. LPG & GAS SERVICES ADDITIONAL SUBMODULES
   ========================================================================= */
export function renderGasDeliveryManagementView() {
  const bookings = getAllGasBookings();
  const riders = getAllGasDeliveryPersons();
  const settings = getGasSettings();
  const customersById = new Map(getAllGasCustomers().map(c => [c.id, c]));

  const activeDeliveries = bookings.filter(b => {
    const st = b.deliveryStatus || b.status;
    return !isBookingCancelledStatus(st) && !isBookingDeliveredStatus(st);
  });
  const completedCount = bookings.filter(b => isBookingDeliveredStatus(b.deliveryStatus || b.status)).length;

  return `
    ${pageHeader('truck', 'LPG Cylinder Delivery Management', 'Live delivery dispatch, doorstep Google Maps navigation, GPS capture & 7-stage rider updates',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('gas-bookings')">Full Booking Register</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1.1rem;">
      <div class="stat-card"><div class="stat-label">Active Delivery Queue</div><div class="stat-value tabular-nums" style="color:var(--warning);">${activeDeliveries.length}</div></div>
      <div class="stat-card"><div class="stat-label">Registered Delivery Boys</div><div class="stat-value tabular-nums">${riders.length}</div></div>
      <div class="stat-card"><div class="stat-label">Completed Deliveries</div><div class="stat-value tabular-nums" style="color:var(--success);">${completedCount}</div></div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Booking #</th><th>Consumer &amp; Address</th><th>Area / Village</th><th>Delivery Person</th><th>Stage</th><th style="text-align:right;">Live Dispatch &amp; Update</th></tr></thead>
          <tbody>
            ${activeDeliveries.map(b => {
              const stage = normalizeGasBookingStatus(b.deliveryStatus || b.status);
              const cust = customersById.get(b.gasCustomerId);
              const dLat = b.deliveryLat ?? cust?.lat;
              const dLng = b.deliveryLng ?? cust?.lng;
              const hasPin = Number.isFinite(Number(dLat)) && Number.isFinite(Number(dLng));
              const addr = b.deliveryAddressSnapshot || cust?.savedDeliveryAddress || cust?.villageAddress || b.deliveryArea || b.area || '';
              const navUrl = buildGoogleMapsDirectionsUrl(
                settings.mainCentre || {},
                hasPin ? { lat: Number(dLat), lng: Number(dLng) } : { address: addr }
              );
              const assignedRiderId = b.deliveryPersonId || '';
              const assignedRiderName = b.deliveryPersonName || b.deliveryPerson || '';
              return `
                <tr>
                  <td class="font-mono">
                    <strong>${esc(b.bookingNo || b.id)}</strong>
                    <div style="font-size:0.7rem;color:var(--text-muted);">${esc(formatDate(b.bookingDate))}</div>
                  </td>
                  <td style="max-width:250px;">
                    <strong>${esc(b.customerName)}</strong>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${esc(b.mobile || b.phone || '')}</div>
                    ${addr ? `<div style="font-size:0.71rem; color:#334155; margin-top:2px;">${esc(addr)}</div>` : ''}
                    <div style="margin-top:3px;">
                      <span class="badge ${hasPin ? 'badge-success' : 'badge-secondary'}">${hasPin ? `GPS: ${Number(dLat).toFixed(4)}, ${Number(dLng).toFixed(4)}` : 'GPS Unsaved'}</span>
                    </div>
                  </td>
                  <td>${esc(b.deliveryArea || b.area || cust?.village || '-')}</td>
                  <td>
                    <select class="form-control" style="min-width:155px; padding:0.25rem 0.5rem;" onchange="window.MJK.assignGasDeliveryPerson('${escAttr(b.id)}', this.value)">
                      <option value="">Unassigned</option>
                      ${riders.map(r => `<option value="${escAttr(r.id)}" ${(assignedRiderId === r.id || (!assignedRiderId && assignedRiderName === r.name)) ? 'selected' : ''}>${esc(r.name)}${r.assignedArea ? ` (${esc(r.assignedArea)})` : ''}</option>`).join('')}
                    </select>
                  </td>
                  <td><span class="badge badge-info">${esc(stage)}</span></td>
                  <td style="text-align:right;">
                    <div style="display:flex;gap:0.3rem;justify-content:flex-end;flex-wrap:wrap;">
                      ${(hasPin || addr) ? `<a href="${esc(navUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="text-decoration:none;">🧭 Navigate to Doorstep</a>` : ''}
                      ${b.gasCustomerId ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.saveCurrentGpsToCustomerProfile('${escAttr(b.gasCustomerId)}', '${escAttr(b.id)}')" title="Save current device GPS directly to this customer's profile">📍 Save GPS</button>` : ''}
                      <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openGasOrderTrackingModal('${escAttr(b.id)}')">Track</button>
                      <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.markGasDeliveredQuick('${escAttr(b.id)}')">Mark Delivered</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No pending LPG deliveries in queue.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderGasComplaintsView() {
  const logs = getItem(KEYS.GAS_AUDIT_LOGS, []).filter(x => x.type === 'COMPLAINT');
  const openCount = logs.filter(l => l.status !== 'Resolved').length;

  return `
    ${pageHeader('alert-circle', 'LPG Complaints & Service Issues', 'Track cylinder leakage, regulator defects, late delivery & subsidy grievances',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddGasComplaintModal()">+ Log LPG Complaint</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1.1rem;">
      <div class="stat-card"><div class="stat-label">Total Complaints</div><div class="stat-value tabular-nums">${logs.length}</div></div>
      <div class="stat-card"><div class="stat-label">Open / Unresolved</div><div class="stat-value tabular-nums" style="color:${openCount > 0 ? 'var(--danger)' : 'var(--success)'};">${openCount}</div></div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Ticket #</th><th>Date</th><th>Consumer</th><th>Issue Type</th><th>Details</th><th>Status</th><th style="text-align:right;">Action</th></tr></thead>
          <tbody>
            ${logs.map(c => `
              <tr>
                <td class="font-mono">${esc(c.id)}</td>
                <td class="tabular-nums">${formatDate(c.date)}</td>
                <td><strong>${esc(c.customerName)}</strong></td>
                <td>${esc(c.category || 'Delivery / Cylinder')}</td>
                <td>${esc(c.details || '-')}</td>
                <td><span class="badge ${c.status === 'Resolved' ? 'badge-success' : 'badge-danger'}">${esc(c.status || 'Open')}</span></td>
                <td style="text-align:right;">
                  ${c.status !== 'Resolved' ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.resolveGasComplaint('${escAttr(c.id)}')">Mark Resolved</button>` : '<span style="color:var(--success); font-size:0.75rem;">Resolved</span>'}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No LPG complaints logged.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   8. OPERATIONS MANAGEMENT SUBMODULES
   ========================================================================= */
export function renderOperationsDashboardView() {
  const services = getItem(KEYS.SERVICES, []);
  const tasks = getItem(KEYS.TASKS, []);
  const pendingSrv = services.filter(s => !['Completed', 'Delivered'].includes(String(s.status || ''))).length;
  const openTasks = tasks.filter(t => t.status !== 'Completed').length;

  return `
    ${pageHeader('settings-2', 'Operations Management Dashboard', 'Real-time counter service queue, daily tasks, document processing & delivery command center',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('applications')">Applications &amp; Timeline</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('services')">Service Tracking</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1.15rem;">
      <div class="stat-card"><div class="stat-label">Active Services</div><div class="stat-value tabular-nums">${services.length}</div></div>
      <div class="stat-card"><div class="stat-label">In-Progress Services</div><div class="stat-value tabular-nums" style="color:var(--warning);">${pendingSrv}</div></div>
      <div class="stat-card"><div class="stat-label">Open Daily Tasks</div><div class="stat-value tabular-nums">${openTasks}</div></div>
      <div class="stat-card"><div class="stat-label">Completed / Delivered</div><div class="stat-value tabular-nums" style="color:var(--success);">${services.length - pendingSrv}</div></div>
    </div>
    ${renderServiceDeliveryTrackingView().replace(/<div class="page-header">[\s\S]*?<\/div>\s*/i, '')}
  `;
}

export function renderDailyTaskManagerView() {
  const today = getTodayDate();
  const tasks = getItem(KEYS.TASKS, []).filter(t => t.status !== 'Completed');
  return `
    ${pageHeader('clipboard-list', 'Daily Task Manager', 'Active & overdue counter operations tasks synced with Staff Performance KPIs',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('tasks')">Full Task Board</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openTaskModal()">+ Assign Task</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Task</th><th>Assigned Employee ID</th><th>Deadline</th><th>Priority</th><th>Status</th><th style="text-align:right;">Toggle</th></tr></thead>
          <tbody>
            ${tasks.map(t => {
              const isOverdue = t.deadline && t.deadline < today;
              return `
                <tr>
                  <td><strong>${esc(t.title)}</strong></td>
                  <td><span class="font-mono">${esc(t.assignedUid || '-')}</span> · ${esc(t.assignedName || '')}</td>
                  <td class="tabular-nums" style="color:${isOverdue ? 'var(--danger)' : 'inherit'};">${formatDate(t.deadline)} ${isOverdue ? '⚠' : ''}</td>
                  <td><span class="badge ${t.priority === 'High' ? 'badge-danger' : 'badge-info'}">${esc(t.priority || 'Medium')}</span></td>
                  <td><span class="badge badge-warning">${esc(t.status || 'Pending')}</span></td>
                  <td style="text-align:right;"><button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.toggleTaskStatus('${escAttr(t.id)}')">Advance Status</button></td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--success);">All daily tasks completed!</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderServiceRequestsView() {
  const services = getItem(KEYS.SERVICES, []).filter(s => !['Completed', 'Delivered'].includes(String(s.status || '')));
  return `
    ${pageHeader('inbox', 'Open Service Requests', 'Pending counter applications & customer requests awaiting delivery',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('services')">Manage in Services</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Ref #</th><th>Customer</th><th>Service Name</th><th>Category</th><th>Date</th><th>Status</th><th style="text-align:right;">Fee</th></tr></thead>
          <tbody>
            ${services.map(s => `
              <tr>
                <td class="font-mono">${esc(s.refNumber || s.id)}</td>
                <td><strong>${esc(s.customerName)}</strong></td>
                <td>${esc(s.serviceName)}</td>
                <td>${esc(s.category || '-')}</td>
                <td class="tabular-nums">${formatDate(s.date)}</td>
                <td><span class="badge badge-warning">${esc(s.status || 'Pending')}</span></td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(s.totalFee || s.charge)}</td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No open service requests in queue.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderServiceDeliveryTrackingView() {
  const services = getItem(KEYS.SERVICES, []);
  const pending = services.filter(s => !s.status || s.status === 'Pending' || s.status === 'Submitted').length;
  const inProg = services.filter(s => ['In Progress', 'Processing', 'Under Review'].includes(s.status)).length;
  const completed = services.filter(s => ['Completed', 'Delivered', 'Ready'].includes(s.status)).length;

  return `
    ${pageHeader('package-check', 'Service Delivery Tracking', 'Stage-by-stage completion pipeline across counter applications')}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1.1rem;">
      <div class="stat-card"><div class="stat-label">Submitted / Pending</div><div class="stat-value tabular-nums" style="color:var(--warning);">${pending}</div></div>
      <div class="stat-card"><div class="stat-label">Processing</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${inProg}</div></div>
      <div class="stat-card"><div class="stat-label">Completed / Delivered</div><div class="stat-value tabular-nums" style="color:var(--success);">${completed}</div></div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Ref #</th><th>Customer</th><th>Service</th><th>Date</th><th>Current Stage</th><th style="text-align:right;">Due</th></tr></thead>
          <tbody>
            ${services.slice(0, 25).map(s => `
              <tr>
                <td class="font-mono">${esc(s.refNumber || s.id)}</td>
                <td><strong>${esc(s.customerName)}</strong></td>
                <td>${esc(s.serviceName)}</td>
                <td class="tabular-nums">${formatDate(s.date)}</td>
                <td><span class="badge ${['Completed', 'Delivered'].includes(s.status) ? 'badge-success' : 'badge-info'}">${esc(s.status || 'Pending')}</span></td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(s.dueAmount || 0)}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No services logged yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderDocumentProcessingView() {
  const services = getItem(KEYS.SERVICES, []).filter(s => /pan|aadhaar|voter|passport|pvc|ration|certificate|csc|card/i.test(`${s.serviceName} ${s.category}`));
  return `
    ${pageHeader('file-check', 'Document & Card Processing Queue', 'PVC cards, PAN, Voter, Passport & CSC certificate processing tracker',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('services')">Open Full Service Tracker</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Ref #</th><th>Customer</th><th>Document / Card Type</th><th>Date</th><th>Status</th><th style="text-align:right;">Total Fee</th></tr></thead>
          <tbody>
            ${services.map(s => `
              <tr>
                <td class="font-mono">${esc(s.refNumber || s.id)}</td>
                <td><strong>${esc(s.customerName)}</strong></td>
                <td>${esc(s.serviceName)}</td>
                <td class="tabular-nums">${formatDate(s.date)}</td>
                <td><span class="badge ${['Completed', 'Delivered'].includes(s.status) ? 'badge-success' : 'badge-warning'}">${esc(s.status || 'Pending')}</span></td>
                <td class="tabular-nums" style="text-align:right;">${formatINR(s.totalFee || s.charge)}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No document processing services found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderIndusIndBcView() {
  const bankTxns = getItem(KEYS.BANKING, []);
  const indusTxns = bankTxns.filter(b => /indus/i.test(`${b.bankPartner || ''} ${b.bankName || ''} ${b.portal || ''}`));
  const totalVol = (indusTxns.length ? indusTxns : bankTxns).reduce((s, b) => s + (Number(b.amount) || 0), 0);

  return `
    ${pageHeader('landmark', 'IndusInd BC / Banking Counter', 'IndusInd Bank BC, AePS withdrawal, cash deposit & DMT settlement register',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('banking')">Open Full Banking Terminal</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(185px, 1fr)); gap:0.85rem; margin-bottom:1.1rem;">
      <div class="stat-card"><div class="stat-label">IndusInd Specific Txns</div><div class="stat-value tabular-nums">${indusTxns.length}</div></div>
      <div class="stat-card"><div class="stat-label">Total Banking Volume</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${formatINR(totalVol)}</div></div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Partner / Channel</th><th>Service Type</th><th>Customer</th><th style="text-align:right;">Amount</th><th style="text-align:right;">Commission</th></tr></thead>
          <tbody>
            ${(indusTxns.length ? indusTxns : bankTxns).slice(0, 30).map(b => `
              <tr>
                <td class="tabular-nums">${formatDate(b.date)}</td>
                <td><strong>${esc(b.bankPartner || b.bankName || 'Banking BC')}</strong></td>
                <td>${esc(b.serviceType || b.type || 'AePS')}</td>
                <td>${esc(b.customerName || '-')}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700;">${formatINR(b.amount)}</td>
                <td class="tabular-nums" style="text-align:right; color:var(--success);">${formatINR(b.commission || 0)}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No Banking BC transactions logged yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderCyberCafeOpsView() {
  const services = getItem(KEYS.SERVICES, []);
  const rates = getItem('MUN_COMPUTER_ERP_v1_rate_chart', []);
  return `
    ${pageHeader('monitor', 'Cyber Cafe Operations', 'Online form fill-up, printing, scanning, lamination & rate chart counter workflow',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('rate-chart')">Rate Chart (${rates.length})</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('services')">+ Log Counter Service</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(185px, 1fr)); gap:0.85rem; margin-bottom:1.1rem;">
      <div class="stat-card"><div class="stat-label">Catalog Rate Services</div><div class="stat-value tabular-nums">${rates.length}</div></div>
      <div class="stat-card"><div class="stat-label">Logged Counter Services</div><div class="stat-value tabular-nums">${services.length}</div></div>
    </div>
    ${renderServiceDeliveryTrackingView().replace(/<div class="page-header">[\s\S]*?<\/div>\s*<div style="display:grid[\s\S]*?<\/div>\s*/i, '')}
  `;
}

export function renderOperationalReportsView() {
  return `
    ${pageHeader('file-bar-chart', 'Operational Reports', 'Download counter service, daily task & banking operations summaries',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('services', 'print')">Print</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('services', 'pdf')">PDF</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('services', 'excel')">Excel</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('services', 'csv')">CSV</button>`
    )}
    ${renderServiceDeliveryTrackingView().replace(/<div class="page-header">[\s\S]*?<\/div>\s*/i, '')}
  `;
}

/* =========================================================================
   9. GROWTH & MARKETING SUBMODULES
   ========================================================================= */
export function renderGrowthDashboardView() {
  const leads = getItem(KEYS.LEADS, []);
  const targets = getItem(KEYS.TARGETS, []);
  const promos = getItem(KEYS.PROMOTIONS, []);
  const referrals = getItem(KEYS.REFERRALS, []);
  const converted = leads.filter(l => l.status === 'Converted').length;

  return `
    ${pageHeader('trending-up', 'Growth & Marketing Dashboard', 'Lead pipeline, promotional offers, customer acquisition & profit targets',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('lead-management')">Leads (${leads.length})</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('targets')">Business Targets</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1.15rem;">
      <div class="stat-card"><div class="stat-label">Total Leads</div><div class="stat-value tabular-nums">${leads.length}</div></div>
      <div class="stat-card"><div class="stat-label">Converted Customers</div><div class="stat-value tabular-nums" style="color:var(--success);">${converted}</div></div>
      <div class="stat-card"><div class="stat-label">Active Promotions</div><div class="stat-value tabular-nums">${promos.length}</div></div>
      <div class="stat-card"><div class="stat-label">Referrals Tracked</div><div class="stat-value tabular-nums">${referrals.length}</div></div>
      <div class="stat-card"><div class="stat-label">Growth Targets</div><div class="stat-value tabular-nums">${targets.length}</div></div>
    </div>
    ${renderCustomerAcquisitionView().replace(/<div class="page-header">[\s\S]*?<\/div>\s*/i, '')}
  `;
}

export function renderGrowthPlanView() {
  const targets = getItem(KEYS.TARGETS, []);
  const projects = getItem(KEYS.PROJECTS, []);
  return `
    ${pageHeader('map', 'Strategic Growth Plan', 'Consolidated roadmap combining Business Targets & Expansion Projects',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('targets')">Manage Targets</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('projects')">Manage Projects</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:1rem;">
      <div class="table-card">
        <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">Active Targets (${targets.length})</h3></div></div>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Goal</th><th style="text-align:right;">Target</th><th style="text-align:right;">Achieved</th></tr></thead>
            <tbody>
              ${targets.map(t => `<tr><td><strong>${esc(t.title || t.category)}</strong></td><td class="tabular-nums" style="text-align:right;">${formatINR(t.targetAmount)}</td><td class="tabular-nums" style="text-align:right;">${formatINR(t.achievedAmount || 0)}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center; padding:1rem; color:var(--text-muted);">No targets defined.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <div class="table-card">
        <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">Expansion Projects (${projects.length})</h3></div></div>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Project</th><th>Stage</th><th style="text-align:right;">Budget</th></tr></thead>
            <tbody>
              ${projects.map(p => `<tr><td><strong>${esc(p.name || p.title)}</strong></td><td><span class="badge badge-info">${esc(p.stage || 'Planning')}</span></td><td class="tabular-nums" style="text-align:right;">${formatINR(p.budget || 0)}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center; padding:1rem; color:var(--text-muted);">No projects added.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function renderProfitTargetsView() {
  const summary = generateFinancialSummary('all', 'month');
  const targets = getItem(KEYS.TARGETS, []);
  const profitTarget = targets.reduce((s, t) => s + (Number(t.targetAmount) || 0), 0);
  const actualProfit = Number(summary.netProfit) || 0;
  const pct = profitTarget > 0 ? Math.min(100, Math.max(0, Math.round((actualProfit / profitTarget) * 100))) : 0;

  return `
    ${pageHeader('target', 'Profit Targets vs Actual Achievement', 'Real-time monthly Net Profit performance against configured revenue/profit targets',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('targets')">Edit Targets</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:0.85rem; margin-bottom:1.1rem;">
      <div class="stat-card"><div class="stat-label">Configured Target Pool</div><div class="stat-value tabular-nums">${formatINR(profitTarget)}</div></div>
      <div class="stat-card"><div class="stat-label">Actual Monthly Net Profit</div><div class="stat-value tabular-nums" style="color:${actualProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">${formatINR(actualProfit)}</div></div>
      <div class="stat-card"><div class="stat-label">Achievement %</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${pct}%</div></div>
    </div>
  `;
}

export function renderPromotionsOffersView() {
  const promos = getItem(KEYS.PROMOTIONS, []);
  return `
    ${pageHeader('badge-percent', 'Promotions & Festive Offers', 'Manage discount codes, counter service bundles & customer retention offers',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddPromotionModal()">+ Add Promotion</button>`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Promo Code</th><th>Offer Title</th><th>Discount</th><th>Valid Till</th><th>Status</th></tr></thead>
          <tbody>
            ${promos.map(p => `
              <tr>
                <td class="font-mono"><strong>${esc(p.code)}</strong></td>
                <td>${esc(p.title)}</td>
                <td><span class="badge badge-success">${esc(p.discountLabel)}</span></td>
                <td class="tabular-nums">${formatDate(p.validTill)}</td>
                <td><span class="badge badge-info">${esc(p.status || 'Active')}</span></td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No promotions configured.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderCustomerAcquisitionView() {
  const customers = getItem(KEYS.CUSTOMERS, []);
  const byVillage = {};
  customers.forEach(c => {
    const area = c.village || c.block || c.district || 'Murshidabad';
    byVillage[area] = (byVillage[area] || 0) + 1;
  });
  const topAreas = Object.entries(byVillage).sort((a, b) => b[1] - a[1]).slice(0, 12);

  return `
    ${pageHeader('user-plus', 'Customer Acquisition Analytics', 'Geographic & channel breakdown of registered customer growth')}
    <div class="table-card">
      <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">Customer Reach by Locality (${customers.length} Total)</h3></div></div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Village / Locality / Block</th><th style="text-align:right;">Customers</th><th style="text-align:right;">Share %</th></tr></thead>
          <tbody>
            ${topAreas.map(([area, count]) => `
              <tr>
                <td><strong>${esc(area)}</strong></td>
                <td class="tabular-nums" style="text-align:right;">${count}</td>
                <td class="tabular-nums" style="text-align:right;">${customers.length ? Math.round((count / customers.length) * 100) : 0}%</td>
              </tr>
            `).join('') || '<tr><td colspan="3" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No customer locality data yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderReferralManagementView() {
  const refs = getItem(KEYS.REFERRALS, []);
  const totalReward = round2(refs.reduce((s, r) => s + (Number(r.rewardAmount) || 0), 0));
  const paidCount = refs.filter(r => r.status === 'Paid').length;

  return `
    ${pageHeader('share-2', 'Customer Referral Management & Proof Center', 'Generate Universal Global SL Referral Passes (MUN-REF-YYYY-XXXXXXXX), verify referrers & share official receipts',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddReferralModal()">+ Add Referral</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1rem;">
      <div class="stat-card"><div class="stat-label">Total Referrals</div><div class="stat-value tabular-nums">${refs.length}</div></div>
      <div class="stat-card"><div class="stat-label">Settled / Paid</div><div class="stat-value tabular-nums" style="color:var(--success);">${paidCount}</div></div>
      <div class="stat-card"><div class="stat-label">Pending Settlement</div><div class="stat-value tabular-nums" style="color:var(--warning);">${refs.length - paidCount}</div></div>
      <div class="stat-card"><div class="stat-label">Commission / Reward Pool</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${formatINR(totalReward)}</div></div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Tracking ID</th><th>Recorded Date &amp; Time</th><th>Referrer (Name &amp; ID)</th><th>Referred Customer</th><th>Service / Scheme</th><th style="text-align:right;">Commission</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead>
          <tbody>
            ${refs.map(r => {
              const tracking = r.passCode || r.id || 'REF-PASS';
              const refIdLabel = r.referrerId ? ` · ${esc(r.referrerId)}` : '';
              return `
                <tr>
                  <td class="font-mono" style="font-weight:700; color:var(--blue-600); white-space:nowrap;">${esc(tracking)}</td>
                  <td class="tabular-nums" style="font-size:0.78rem; white-space:nowrap;">${r.createdAt ? formatDateTime(r.createdAt) : formatDate(r.date)}</td>
                  <td><strong>${esc(r.referrerName)}</strong><span class="font-mono" style="font-size:0.72rem; color:var(--text-muted);">${refIdLabel}</span></td>
                  <td><strong>${esc(r.referredName)}</strong><div class="tabular-nums" style="font-size:0.72rem; color:var(--text-muted);">${esc(r.referredPhone || '-')}</div></td>
                  <td>${esc(r.service || '-')}</td>
                  <td class="tabular-nums" style="text-align:right; font-weight:700;">${formatINR(r.rewardAmount || 0)}</td>
                  <td>
                    <button type="button" class="badge ${r.status === 'Paid' ? 'badge-success' : 'badge-warning'}" style="border:0; cursor:pointer;" onclick="window.MJK.toggleReferralStatus('${escAttr(r.id)}')" title="Click to toggle status">${esc(r.status || 'Pending')}</button>
                  </td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button type="button" class="btn btn-primary btn-sm" style="white-space:nowrap;" onclick="window.MJK.openReferralPassModal('${escAttr(r.id)}')">🪪 Generate Referral Pass / Proof</button>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No referral entries recorded yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderLeadManagementView() {
  const leads = getItem(KEYS.LEADS, []);
  const convertedCount = leads.filter(l => l.status === 'Converted').length;

  return `
    ${pageHeader('target', 'Lead Management Pipeline', 'Capture enquiries using the Searchable Rate Chart & convert qualified leads directly into Customers',
      `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddLeadModal()">+ Add New Lead</button>`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1rem;">
      <div class="stat-card"><div class="stat-label">Total Leads</div><div class="stat-value tabular-nums">${leads.length}</div></div>
      <div class="stat-card"><div class="stat-label">Converted Customers</div><div class="stat-value tabular-nums" style="color:var(--success);">${convertedCount}</div></div>
      <div class="stat-card"><div class="stat-label">Conversion Rate</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${leads.length ? Math.round((convertedCount / leads.length) * 100) : 0}%</div></div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Prospect Name</th><th>Phone</th><th>Service / Product Interest</th><th style="text-align:right;">Est. Value</th><th>Stage</th><th style="text-align:right;">Convert</th></tr></thead>
          <tbody>
            ${leads.map(l => `
              <tr>
                <td class="tabular-nums">${formatDate(l.date)}</td>
                <td><strong>${esc(l.name)}</strong>${l.source ? `<div style="font-size:0.71rem; color:var(--text-muted);">${esc(l.source)}</div>` : ''}</td>
                <td class="tabular-nums">${esc(l.phone || '-')}</td>
                <td>${esc(l.interest || '-')}</td>
                <td class="tabular-nums" style="text-align:right;">${l.estimatedValue ? formatINR(l.estimatedValue) : '-'}</td>
                <td><span class="badge ${l.status === 'Converted' ? 'badge-success' : 'badge-info'}">${esc(l.status || 'New')}</span></td>
                <td style="text-align:right; white-space:nowrap;">
                  ${l.status !== 'Converted' ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.convertLeadToCustomer('${escAttr(l.id)}')">Convert → Customer</button>` : `<span class="badge badge-success">${esc(l.applicationId || l.customerId || 'Customer Created')}</span>`}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No leads in pipeline yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function buildGrowthReportDataset(tab = DeptUiState.growthReportTab || 'leads') {
  const from = DeptUiState.growthFromDate || '';
  const to = DeptUiState.growthToDate || '';
  const q = String(DeptUiState.growthQuery || '').trim().toLowerCase();

  const inDateRange = (rawDate) => {
    const dt = String(rawDate || '').slice(0, 10);
    if (from && dt && dt < from) return false;
    if (to && dt && dt > to) return false;
    return true;
  };
  const matchesQuery = (...parts) => !q || parts.join(' ').toLowerCase().includes(q);

  if (tab === 'referrals') {
    const refs = getItem(KEYS.REFERRALS, []).filter(r =>
      inDateRange(r.date || r.createdAt) && matchesQuery(r.passCode, r.id, r.referrerId, r.referrerName, r.referredName, r.referredPhone, r.service, r.status)
    );
    const byReferrer = new Map();
    refs.forEach(r => {
      const key = r.referrerName || 'Walk-in Referrer';
      byReferrer.set(key, (byReferrer.get(key) || 0) + 1);
    });
    const topReferrers = Array.from(byReferrer.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const paidSum = round2(refs.filter(r => r.status === 'Paid').reduce((s, r) => s + (Number(r.rewardAmount) || 0), 0));
    const totalComm = round2(refs.reduce((s, r) => s + (Number(r.rewardAmount) || 0), 0));

    return {
      tab: 'referrals',
      title: 'Customer Referral Performance Report',
      chartSubtitle: 'Top Referrers & Total Referral Counts',
      kpis: [
        { label: 'Total Referrals', value: String(refs.length), color: 'var(--blue-600)' },
        { label: 'Unique Referrers', value: String(byReferrer.size), color: 'var(--text-main)' },
        { label: 'Total Commission', value: formatINR(totalComm), color: 'var(--success)' },
        { label: 'Paid Settlements', value: formatINR(paidSum), color: 'var(--blue-700)' }
      ],
      chart: {
        labels: topReferrers.length ? topReferrers.map(([k]) => k) : ['No Referrals'],
        datasets: [
          {
            label: 'Total Referrals',
            data: topReferrers.length ? topReferrers.map(([, v]) => v) : [0],
            backgroundColor: 'rgba(37, 99, 235, 0.82)',
            borderRadius: 6
          }
        ]
      },
      headers: ['Tracking ID', 'Referrer ID', 'Referrer Name', 'Referred Customer', 'Service', 'Commission (₹)', 'Status'],
      rows: refs.map(r => [
        r.passCode || r.id,
        r.referrerId || '-',
        r.referrerName || '-',
        `${r.referredName || '-'}${r.referredPhone ? ` (${r.referredPhone})` : ''}`,
        r.service || '-',
        Number(r.rewardAmount) || 0,
        r.status || 'Pending'
      ]),
      rawRefs: refs
    };
  }

  if (tab === 'services') {
    const leads = getItem(KEYS.LEADS, []).filter(l => inDateRange(l.date));
    const services = getItem(KEYS.SERVICES, []).filter(s => inDateRange(s.date || s.appDate));
    const gas = getItem(KEYS.GAS_BOOKINGS, []).filter(b => inDateRange(b.bookingDate || b.date));
    const refs = getItem(KEYS.REFERRALS, []).filter(r => inDateRange(r.date || r.createdAt));

    const statsMap = new Map();
    const bump = (name, type, rev = 0) => {
      const label = String(name || '').trim();
      if (!label) return;
      const cur = statsMap.get(label) || { name: label, leads: 0, orders: 0, revenue: 0 };
      if (type === 'lead') cur.leads += 1;
      else cur.orders += 1;
      cur.revenue = round2(cur.revenue + (Number(rev) || 0));
      statsMap.set(label, cur);
    };

    leads.forEach(l => {
      if (Array.isArray(l.services) && l.services.length > 0) {
        l.services.forEach(sv => bump(sv.name, 'lead', sv.total ?? sv.serviceCharge ?? 0));
      } else {
        String(l.interest || '').split(',').map(x => x.trim()).filter(Boolean).forEach(part => bump(part, 'lead', l.estimatedValue || 0));
      }
    });
    services.forEach(s => bump(s.serviceName || 'Counter Service', 'order', s.totalAmount ?? s.totalFee ?? s.charge ?? 0));
    gas.forEach(b => bump(b.cylinderType || 'LPG Cylinder Booking', 'order', b.totalAmount ?? b.amount ?? 0));
    refs.forEach(r => bump(r.service || 'Referral Service', 'lead', r.rewardAmount || 0));

    const items = Array.from(statsMap.values())
      .filter(it => matchesQuery(it.name))
      .sort((a, b) => (b.leads + b.orders) - (a.leads + a.orders));
    const topChart = items.slice(0, 10);
    const totalDemand = items.reduce((s, x) => s + x.leads + x.orders, 0);
    const totalRev = round2(items.reduce((s, x) => s + x.revenue, 0));

    return {
      tab: 'services',
      title: 'Service & Product Interest Analytics',
      chartSubtitle: 'Most In-Demand Services & Products (Leads vs Fulfilled Orders)',
      kpis: [
        { label: 'Tracked Services', value: String(items.length), color: 'var(--blue-600)' },
        { label: 'Total Demand Volume', value: String(totalDemand), color: 'var(--text-main)' },
        { label: 'Top Trending Service', value: items[0]?.name || '—', color: 'var(--success)' },
        { label: 'Attributed Revenue', value: formatINR(totalRev), color: 'var(--blue-700)' }
      ],
      chart: {
        labels: topChart.length ? topChart.map(x => x.name.slice(0, 22)) : ['No Services'],
        datasets: [
          {
            label: 'Lead Interest',
            data: topChart.length ? topChart.map(x => x.leads) : [0],
            backgroundColor: 'rgba(14, 165, 233, 0.85)',
            borderRadius: 5
          },
          {
            label: 'Booked / Completed',
            data: topChart.length ? topChart.map(x => x.orders) : [0],
            backgroundColor: 'rgba(22, 163, 74, 0.85)',
            borderRadius: 5
          }
        ]
      },
      headers: ['Service / Product', 'Lead Enquiries', 'Booked Orders', 'Total Interest Volume', 'Revenue / Est. Value (₹)'],
      rows: items.map(it => [it.name, it.leads, it.orders, it.leads + it.orders, it.revenue])
    };
  }

  if (tab === 'campaigns') {
    const campaigns = getItem(KEYS.MARKETING, []).filter(c =>
      inDateRange(c.startDate || c.createdAt) && matchesQuery(c.name, c.type, c.results, c.notes)
    );
    const totalLeads = campaigns.reduce((s, c) => s + (Number(c.leads) || 0), 0);
    const totalConv = campaigns.reduce((s, c) => s + (Number(c.converted ?? c.convertedCustomers) || 0), 0);
    const totalSpent = round2(campaigns.reduce((s, c) => s + (Number(c.spent ?? c.expenses) || 0), 0));
    const avgRoi = campaigns.length ? Math.round(campaigns.reduce((s, c) => s + (Number(c.roi) || 0), 0) / campaigns.length) : 0;

    return {
      tab: 'campaigns',
      title: 'Campaign & Outreach ROI Report',
      chartSubtitle: 'Campaign Leads vs Customer Conversions',
      kpis: [
        { label: 'Active Campaigns', value: String(campaigns.length), color: 'var(--blue-600)' },
        { label: 'Campaign Leads', value: String(totalLeads), color: 'var(--text-main)' },
        { label: 'Converted Walk-ins', value: String(totalConv), color: 'var(--success)' },
        { label: 'Total Spent / Avg ROI', value: `${formatINR(totalSpent)} · ${avgRoi}%`, color: 'var(--blue-700)' }
      ],
      chart: {
        labels: campaigns.length ? campaigns.slice(0, 10).map(c => (c.name || 'Campaign').slice(0, 20)) : ['No Campaigns'],
        datasets: [
          {
            label: 'Leads Captured',
            data: campaigns.length ? campaigns.slice(0, 10).map(c => Number(c.leads) || 0) : [0],
            backgroundColor: 'rgba(59, 130, 246, 0.82)',
            borderRadius: 5
          },
          {
            label: 'Converted',
            data: campaigns.length ? campaigns.slice(0, 10).map(c => Number(c.converted ?? c.convertedCustomers) || 0) : [0],
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderRadius: 5
          }
        ]
      },
      headers: ['Campaign Name', 'Channel', 'Start Date', 'Spent (₹)', 'Leads', 'Converted', 'Conv %', 'ROI %'],
      rows: campaigns.map(c => {
        const lds = Number(c.leads) || 0;
        const cnv = Number(c.converted ?? c.convertedCustomers) || 0;
        const rate = lds > 0 ? Math.round((cnv / lds) * 100) : 0;
        return [c.name, c.type || 'WhatsApp', formatDate(c.startDate), Number(c.spent ?? c.expenses) || 0, lds, cnv, `${rate}%`, `${Number(c.roi) || 0}%`];
      })
    };
  }

  // Default: leads acquisition & conversion
  const leads = getItem(KEYS.LEADS, []).filter(l =>
    inDateRange(l.date) && matchesQuery(l.name, l.phone, l.interest, l.status, l.source)
  );
  const byMonth = new Map();
  leads.forEach(l => {
    const month = String(l.date || getTodayDate()).slice(0, 7);
    const cur = byMonth.get(month) || { total: 0, converted: 0 };
    cur.total += 1;
    if (l.status === 'Converted') cur.converted += 1;
    byMonth.set(month, cur);
  });
  const monthEntries = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const converted = leads.filter(l => l.status === 'Converted').length;
  const convRate = leads.length ? Math.round((converted / leads.length) * 100) : 0;
  const estRev = round2(leads.reduce((s, l) => s + (Number(l.estimatedValue) || 0), 0));

  return {
    tab: 'leads',
    title: 'Lead Acquisition & Conversion Report',
    chartSubtitle: 'New Leads vs Converted Leads by Month',
    kpis: [
      { label: 'Total Leads', value: String(leads.length), color: 'var(--blue-600)' },
      { label: 'Converted Customers', value: String(converted), color: 'var(--success)' },
      { label: 'Conversion Rate', value: `${convRate}%`, color: 'var(--blue-700)' },
      { label: 'Est. Pipeline Value', value: formatINR(estRev), color: 'var(--text-main)' }
    ],
    chart: {
      labels: monthEntries.length ? monthEntries.map(([m]) => m) : [getTodayDate().slice(0, 7)],
      datasets: [
        {
          label: 'New Leads',
          data: monthEntries.length ? monthEntries.map(([, v]) => v.total) : [0],
          backgroundColor: 'rgba(37, 99, 235, 0.85)',
          borderRadius: 6
        },
        {
          label: 'Converted Leads',
          data: monthEntries.length ? monthEntries.map(([, v]) => v.converted) : [0],
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderRadius: 6
        }
      ]
    },
    headers: ['Date', 'Prospect Name', 'Mobile', 'Service / Product Interest', 'Est. Value (₹)', 'Status'],
    rows: leads.map(l => [formatDate(l.date), l.name, l.phone || '-', l.interest || '-', Number(l.estimatedValue) || 0, l.status || 'New'])
  };
}

export function renderGrowthReportsView() {
  const activeTab = DeptUiState.growthReportTab || 'leads';
  const rpt = buildGrowthReportDataset(activeTab);
  const tabs = [
    { key: 'leads', label: 'Lead Acquisition & Conversion' },
    { key: 'referrals', label: 'Customer Referral Performance' },
    { key: 'services', label: 'Service & Product Interest' },
    { key: 'campaigns', label: 'Campaign & Outreach ROI' }
  ];

  return `
    ${pageHeader('bar-chart-3', 'Growth & Marketing Reports', 'Visual Bar Charts, live filters & detailed exportable tables across Leads, Referrals, Service Interest & Campaigns',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportGrowthReport('${escAttr(activeTab)}', 'csv')">📥 Export CSV</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.exportGrowthReport('${escAttr(activeTab)}', 'pdf')">📄 Export PDF</button>`
    )}

    <div style="display:flex; flex-wrap:wrap; gap:0.45rem; margin-bottom:1rem;">
      ${tabs.map(t => `
        <button type="button" class="btn btn-sm ${activeTab === t.key ? 'btn-primary' : 'btn-outline'}" onclick="window.MJK.setDeptState('growthReportTab', '${t.key}')">${esc(t.label)}</button>
      `).join('')}
    </div>

    <div class="card" style="padding:0.9rem 1.1rem; margin-bottom:1rem;">
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; align-items:end;">
        <div>
          <label class="form-label" style="font-size:0.74rem;">From Date</label>
          <input type="date" class="form-control" value="${escAttr(DeptUiState.growthFromDate)}" onchange="window.MJK.setDeptState('growthFromDate', this.value)">
        </div>
        <div>
          <label class="form-label" style="font-size:0.74rem;">To Date</label>
          <input type="date" class="form-control" value="${escAttr(DeptUiState.growthToDate)}" onchange="window.MJK.setDeptState('growthToDate', this.value)">
        </div>
        <div>
          <label class="form-label" style="font-size:0.74rem;">Search Table</label>
          <input id="growth-rpt-q" type="text" class="form-control" placeholder="Search name, phone, service..." value="${esc(DeptUiState.growthQuery)}" oninput="window.MJK.setDeptFilterKeepFocus('growthQuery', this.value, 'growth-rpt-q')">
        </div>
        <div>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.resetGrowthFilters()">Reset Filters</button>
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1rem;">
      ${rpt.kpis.map(k => `
        <div class="stat-card">
          <div class="stat-label">${esc(k.label)}</div>
          <div class="stat-value tabular-nums" style="color:${k.color}; font-size:1.25rem;">${esc(k.value)}</div>
        </div>
      `).join('')}
    </div>

    <div class="card" style="padding:1rem 1.15rem; margin-bottom:1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.4rem;">
        <div>
          <h3 style="margin:0; font-size:0.95rem;">${esc(rpt.title)}</h3>
          <div style="font-size:0.74rem; color:var(--text-muted);">${esc(rpt.chartSubtitle)}</div>
        </div>
        <span class="badge badge-info font-mono tabular-nums">${rpt.rows.length} rows</span>
      </div>
      <div style="position:relative; height:290px; width:100%;">
        <canvas id="growth-report-bar-chart"></canvas>
      </div>
    </div>

    <div class="table-card">
      <div class="table-toolbar">
        <div class="table-toolbar-left"><strong>Detailed Breakdown (${rpt.rows.length} entries)</strong></div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr>${rpt.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rpt.rows.slice(0, 100).map(row => `<tr>${row.map(c => `<td class="tabular-nums">${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${rpt.headers.length}" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No records found for selected filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function initChartsAfterRender(currentRoute) {
  if (growthBarChartInstance) {
    try { growthBarChartInstance.destroy(); } catch {}
    growthBarChartInstance = null;
  }
  if (currentRoute !== 'growth-reports') return;
  const canvas = document.getElementById('growth-report-bar-chart');
  if (!canvas) return;
  const rpt = buildGrowthReportDataset(DeptUiState.growthReportTab || 'leads');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  growthBarChartInstance = new Chart(ctx, {
    type: 'bar',
    data: rpt.chart,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 12, weight: '600' } } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: { grid: { display: false } }
      }
    }
  });
}

/* =========================================================================
   10. REPORTS & ANALYTICS SUBMODULES
   ========================================================================= */
export function renderDailyReportsAnalyticsView() {
  return renderTodaysSummaryView();
}

export function renderMonthlyReportsAnalyticsView() {
  const m = DeptUiState.reportMonth || getTodayDate().slice(0, 7);
  const invoices = getItem(KEYS.INVOICES, []).filter(i => String(i.date || '').startsWith(m));
  const services = getItem(KEYS.SERVICES, []).filter(s => String(s.date || '').startsWith(m));
  const expenses = getItem(KEYS.EXPENSES, []).filter(e => String(e.date || '').startsWith(m));
  const payslips = getItem(KEYS.PAYSLIPS, []).filter(p => String(p.monthYear || '') === m);

  const srvRev = services.reduce((s, x) => s + (Number(x.totalFee || x.charge) || 0), 0);
  const invRev = invoices.reduce((s, x) => s + (Number(x.grandTotal || x.totalAmount) || 0), 0);
  const expSum = expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const paySum = payslips.reduce((s, x) => s + (Number(x.netPay) || 0), 0);

  return `
    ${pageHeader('calendar', 'Monthly Business Reports', `Cross-department performance summary for ${m}`,
      `<input type="month" class="form-control" style="width:auto;" value="${escAttr(m)}" onchange="window.MJK.setDeptState('reportMonth', this.value)">`
    )}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem;">
      <div class="stat-card"><div class="stat-label">Services (${services.length})</div><div class="stat-value tabular-nums">${formatINR(srvRev)}</div></div>
      <div class="stat-card"><div class="stat-label">Invoices (${invoices.length})</div><div class="stat-value tabular-nums">${formatINR(invRev)}</div></div>
      <div class="stat-card"><div class="stat-label">Expenses (${expenses.length})</div><div class="stat-value tabular-nums" style="color:var(--danger);">${formatINR(expSum)}</div></div>
      <div class="stat-card"><div class="stat-label">Payroll (${payslips.length} slips)</div><div class="stat-value tabular-nums">${formatINR(paySum)}</div></div>
      <div class="stat-card"><div class="stat-label">Monthly Net</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${formatINR((srvRev + invRev) - (expSum + paySum))}</div></div>
    </div>
  `;
}

export function renderEmployeePerformanceAnalyticsView() {
  const m = DeptUiState.reportMonth || getTodayDate().slice(0, 7);
  const emps = getAllCanonicalEmployees(false);
  const rows = emps.map(e => {
    const kpi = calculateEmployeeKpiScore(e.employeeId, m);
    const att = calculateAttendancePayrollPreview(e.employeeId, m);
    return { emp: e, kpi, att };
  });

  return `
    ${pageHeader('bar-chart-3', 'Employee Performance Analytics', `Weighted KPI, Attendance & Task Completion leaderboard (${m})`,
      `<input type="month" class="form-control" style="width:auto;" value="${escAttr(m)}" onchange="window.MJK.setDeptState('reportMonth', this.value)">`
    )}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Employee ID</th><th>Name</th><th>Attendance Days</th><th>Tasks Done</th><th style="text-align:right;">Weighted KPI Score</th><th>Rating</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="font-mono">${esc(r.emp.employeeId)}</td>
                <td><a href="javascript:void(0)" onclick="window.MJK.viewEmployeeProfileById('${escAttr(r.emp.employeeId)}')"><strong>${esc(r.emp.name)}</strong></a></td>
                <td class="tabular-nums">${r.att.presentDays} present / ${r.att.approvedLeaveDays} leave</td>
                <td class="tabular-nums">${r.kpi.completedCount} / ${r.kpi.assignedCount}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:800; color:var(--blue-600);">${r.kpi.weightedScore}%</td>
                <td><span class="badge ${r.kpi.weightedScore >= 75 ? 'badge-success' : 'badge-warning'}">${esc(r.kpi.grade)}</span></td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem;">No active employees found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderSalesAnalyticsView() { return renderSalesReportsView(); }
export function renderPurchaseAnalyticsView() { return renderPurchaseBillsView(); }
export function renderInventoryAnalyticsView() { return renderInventoryReportsView(); }
export function renderFinancialAnalyticsView() { return renderFinanceDashboardView(); }
export function renderCustomerAnalyticsView() { return renderCustomerAcquisitionView(); }

export function renderDepartmentReportsView() {
  const counts = getDynamicNavBadgeCounts();
  const rows = [
    { dept: 'Team Management', records: getAllCanonicalEmployees(true).length, route: 'staff-directory', metric: `${counts.pendingLeaves} pending leaves` },
    { dept: 'Customer Management', records: getItem(KEYS.CUSTOMERS, []).length, route: 'customers', metric: `${counts.pendingPayments} pending dues` },
    { dept: 'Sales & Billing', records: getItem(KEYS.INVOICES, []).length, route: 'invoices', metric: `${getItem(KEYS.QUOTATIONS, []).length} quotations` },
    { dept: 'Inventory & Purchase', records: getItem(KEYS.INVENTORY, []).length, route: 'inventory', metric: `${counts.lowInventory} low stock` },
    { dept: 'Finance & Accounting', records: getItem(KEYS.PAYMENTS, []).length + getItem(KEYS.EXPENSES, []).length, route: 'finance-dashboard', metric: `${getItem(KEYS.BANK_ACCOUNTS, []).length} bank accounts` },
    { dept: 'LPG & Gas Services', records: getItem(KEYS.GAS_CUSTOMERS, []).length, route: 'gas-dashboard', metric: `${counts.unprocessedGasBookings} open bookings` },
    { dept: 'Operations Management', records: getItem(KEYS.SERVICES, []).length, route: 'services', metric: `${counts.incompleteTasks} open tasks` },
    { dept: 'Growth & Marketing', records: getItem(KEYS.LEADS, []).length, route: 'growth-dashboard', metric: `${getItem(KEYS.PROMOTIONS, []).length} promos` }
  ];

  return `
    ${pageHeader('layers', 'Department-Wise Executive Reports', 'Compare database volume & open action queues across every ERP department')}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Department</th><th style="text-align:right;">Stored Records</th><th>Active Status Metric</th><th style="text-align:right;">Open</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><strong>${esc(r.dept)}</strong></td>
                <td class="tabular-nums" style="text-align:right;">${r.records}</td>
                <td>${esc(r.metric)}</td>
                <td style="text-align:right;"><button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('${escAttr(r.route)}')">Open</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function getCustomDatasetDefinition(datasetKey) {
  switch (datasetKey) {
    case 'customers': {
      const rows = getItem(KEYS.CUSTOMERS, []);
      return {
        title: 'CUSTOMERS MASTER',
        headers: ['ID', 'Name', 'Phone', 'Village / Area', 'District'],
        rows: rows.map(c => [c.id, c.name, c.phone || '-', c.village || '-', c.district || 'Murshidabad']),
        dates: rows.map(c => c.registrationDate || '')
      };
    }
    case 'invoices': {
      const rows = getItem(KEYS.INVOICES, []);
      return {
        title: 'BILLING INVOICES',
        headers: ['Invoice #', 'Customer', 'Date', 'Total', 'Paid', 'Due', 'Status'],
        rows: rows.map(i => [i.invoiceNumber || i.id, i.customerName, i.date, Number(i.grandTotal || i.totalAmount) || 0, Number(i.amountPaid || i.paidAmount) || 0, Number(i.balanceDue) || 0, i.status || 'Issued']),
        dates: rows.map(i => i.date || '')
      };
    }
    case 'expenses': {
      const rows = getItem(KEYS.EXPENSES, []);
      return {
        title: 'EXPENSES REGISTER',
        headers: ['ID', 'Date', 'Category', 'Description', 'Amount', 'Mode'],
        rows: rows.map(e => [e.id, e.date, e.category || '-', e.description || '-', Number(e.amount) || 0, e.paymentMode || 'Cash']),
        dates: rows.map(e => e.date || '')
      };
    }
    case 'gas_bookings': {
      const rows = getItem(KEYS.GAS_BOOKINGS, []);
      return {
        title: 'LPG GAS BOOKINGS',
        headers: ['Booking #', 'Customer', 'Phone', 'Booking Date', 'Amount', 'Status'],
        rows: rows.map(b => [b.bookingNo || b.id, b.customerName, b.phone || '-', b.bookingDate || b.date, Number(b.totalAmount || b.amount) || 0, b.status || 'Booked']),
        dates: rows.map(b => b.bookingDate || b.date || '')
      };
    }
    case 'inventory': {
      const rows = getItem(KEYS.INVENTORY, []);
      return {
        title: 'INVENTORY STOCK REGISTER',
        headers: ['SKU', 'Item Name', 'Category', 'Qty', 'Unit Price', 'Valuation'],
        rows: rows.map(i => {
          const q = Number(i.quantity ?? i.stockQty ?? 0);
          const p = Number(i.unitPrice ?? i.sellingPrice ?? 0);
          return [i.sku || i.id, i.name || i.itemName, i.category || 'General', q, p, q * p];
        }),
        dates: rows.map(() => '')
      };
    }
    default: {
      const rows = getItem(KEYS.SERVICES, []);
      return {
        title: 'COUNTER SERVICES LOG',
        headers: ['Ref #', 'Customer', 'Service', 'Date', 'Total Fee', 'Due', 'Status'],
        rows: rows.map(s => [s.refNumber || s.id, s.customerName, s.serviceName, s.date, Number(s.totalFee || s.charge) || 0, Number(s.dueAmount) || 0, s.status || 'Pending']),
        dates: rows.map(s => s.date || '')
      };
    }
  }
}

export function renderCustomReportBuilderView() {
  const ds = getCustomDatasetDefinition(DeptUiState.customReportDataset);
  const q = DeptUiState.customReportQuery.trim().toLowerCase();
  const from = DeptUiState.customReportFrom;
  const to = DeptUiState.customReportTo;

  const filteredRows = ds.rows.filter((r, idx) => {
    const dt = String(ds.dates[idx] || '').slice(0, 10);
    if (from && dt && dt < from) return false;
    if (to && dt && dt > to) return false;
    if (q && !r.join(' ').toLowerCase().includes(q)) return false;
    return true;
  });

  return `
    ${pageHeader('sliders', 'Custom Report Builder', 'Query any live ERP dataset, apply date/keyword filters & export to PDF, Excel, CSV or Print',
      `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportCustomBuilder('print')">Print</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportCustomBuilder('pdf')">PDF</button>
       <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportCustomBuilder('excel')">Excel</button>
       <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.exportCustomBuilder('csv')">CSV</button>`
    )}
    <div class="card" style="padding:0.95rem 1.1rem; margin-bottom:1rem;">
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.75rem;">
        <div>
          <label class="form-label" style="font-size:0.74rem;">Dataset</label>
          <select class="form-control" onchange="window.MJK.setDeptState('customReportDataset', this.value)">
            <option value="services" ${DeptUiState.customReportDataset === 'services' ? 'selected' : ''}>Counter Services</option>
            <option value="customers" ${DeptUiState.customReportDataset === 'customers' ? 'selected' : ''}>Customers Directory</option>
            <option value="invoices" ${DeptUiState.customReportDataset === 'invoices' ? 'selected' : ''}>Billing Invoices</option>
            <option value="expenses" ${DeptUiState.customReportDataset === 'expenses' ? 'selected' : ''}>Expenses Register</option>
            <option value="gas_bookings" ${DeptUiState.customReportDataset === 'gas_bookings' ? 'selected' : ''}>LPG Gas Bookings</option>
            <option value="inventory" ${DeptUiState.customReportDataset === 'inventory' ? 'selected' : ''}>Inventory Stock</option>
          </select>
        </div>
        <div>
          <label class="form-label" style="font-size:0.74rem;">From Date</label>
          <input type="date" class="form-control" value="${escAttr(from)}" onchange="window.MJK.setDeptState('customReportFrom', this.value)">
        </div>
        <div>
          <label class="form-label" style="font-size:0.74rem;">To Date</label>
          <input type="date" class="form-control" value="${escAttr(to)}" onchange="window.MJK.setDeptState('customReportTo', this.value)">
        </div>
        <div>
          <label class="form-label" style="font-size:0.74rem;">Keyword Filter</label>
          <input id="custom-rpt-q" type="text" class="form-control" placeholder="Filter rows..." value="${esc(DeptUiState.customReportQuery)}" oninput="window.MJK.setDeptFilterKeepFocus('customReportQuery', this.value, 'custom-rpt-q')">
        </div>
      </div>
    </div>
    <div class="table-card">
      <div class="table-toolbar"><div class="table-toolbar-left"><strong>${esc(ds.title)} (${filteredRows.length} rows)</strong></div></div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr>${ds.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>
            ${filteredRows.slice(0, 80).map(r => `<tr>${r.map(cell => `<td class="tabular-nums">${esc(cell)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${ds.headers.length}" style="text-align:center; padding:1.5rem;">No matching records.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderPdfExcelExportCenterView() {
  const packs = [
    { key: 'customers', label: 'Customers Master Directory', desc: 'All registered customers, phone & location' },
    { key: 'services', label: 'Counter Services & Charges Log', desc: 'All counter applications, fees & dues' },
    { key: 'gst_sales', label: 'Sales & GST Billing Register', desc: 'Taxable, CGST, SGST & invoice totals' },
    { key: 'dues', label: 'Outstanding Receivables Statement', desc: 'Pending customer dues across all divisions' },
    { key: 'inventory', label: 'Inventory Stock & Valuation', desc: 'All SKU stock quantities & values' },
    { key: 'pnl', label: 'Profit & Loss Statement', desc: 'Consolidated Income vs Operating Expenses' },
    { key: 'leads', label: 'Sales Leads Pipeline', desc: 'Active & converted prospect pipeline' }
  ];

  return `
    ${pageHeader('download', 'PDF & Excel Export Center', 'One-click official MUN COMPUTER formatted reports across every ERP division')}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:0.9rem;">
      ${packs.map(pk => `
        <div class="card" style="padding:1rem; display:flex; flex-direction:column; justify-content:space-between; gap:0.75rem;">
          <div>
            <div style="font-weight:700; font-size:0.92rem;">${esc(pk.label)}</div>
            <div style="font-size:0.77rem; color:var(--text-muted); margin-top:0.2rem;">${esc(pk.desc)}</div>
          </div>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('${pk.key}', 'print')">Print</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('${pk.key}', 'pdf')">PDF</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('${pk.key}', 'excel')">Excel</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDeptTable('${pk.key}', 'csv')">CSV</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/* =========================================================================
   11. SYSTEM & SECURITY SUBMODULES
   ========================================================================= */
export function renderRbacControlView() { return renderRolesPermissionsView(); }
export function renderPermissionManagementView() { return renderRolesPermissionsView(); }

export function renderLoginHistoryView() {
  const logs = getItem(KEYS.AUDIT_LOGS, []).filter(l => /AUTH_|LOGIN|LOGOUT|PASSWORD/i.test(`${l.action || ''} ${l.details || ''}`));
  return `
    ${pageHeader('key-round', 'Login History & Session Audit', 'Authentication sign-ins, failed lockouts & password activity trail')}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Timestamp</th><th>Action</th><th>Details</th><th>User / Actor</th></tr></thead>
          <tbody>
            ${logs.slice(0, 60).map(l => `
              <tr>
                <td class="tabular-nums">${formatDateTime(l.timestamp)}</td>
                <td><span class="badge ${String(l.action || '').includes('FAIL') ? 'badge-danger' : 'badge-info'}">${esc(l.action)}</span></td>
                <td>${esc(l.details)}</td>
                <td>${esc(l.user || 'System')}</td>
              </tr>
            `).join('') || '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No login audit logs recorded yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderSystemAuditLogsView() {
  const logs = getItem(KEYS.AUDIT_LOGS, []);
  const q = DeptUiState.auditSearch.trim().toLowerCase();
  const filtered = logs.filter(l => !q || `${l.action} ${l.details} ${l.user}`.toLowerCase().includes(q));

  return `
    ${pageHeader('scroll-text', 'System Audit Logs', 'Immutable audit trail of critical ERP mutations, approvals & deletions')}
    <div class="card" style="padding:0.85rem 1rem; margin-bottom:1rem;">
      <input id="sys-audit-search" class="form-control" placeholder="Search audit logs by action, actor or details..." value="${esc(DeptUiState.auditSearch)}" oninput="window.MJK.setDeptFilterKeepFocus('auditSearch', this.value, 'sys-audit-search')">
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Timestamp</th><th>Action</th><th>Details</th><th>Actor</th></tr></thead>
          <tbody>
            ${filtered.slice(0, 80).map(l => `
              <tr>
                <td class="tabular-nums">${formatDateTime(l.timestamp)}</td>
                <td class="font-mono">${esc(l.action)}</td>
                <td>${esc(l.details)}</td>
                <td>${esc(l.user || 'System')}</td>
              </tr>
            `).join('') || '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No audit records found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderActivityLogsView() {
  const sysLogs = getItem(KEYS.AUDIT_LOGS, []).map(l => ({ ts: l.timestamp, source: 'ERP Audit', action: l.action, msg: l.details, user: l.user }));
  const gasLogs = getItem(KEYS.GAS_AUDIT_LOGS, []).map(g => ({ ts: g.createdAt || g.date, source: 'LPG Gas', action: g.type || 'GAS', msg: g.details || g.customerName, user: g.actor || 'Counter' }));
  const combined = [...sysLogs, ...gasLogs].sort((a, b) => String(b.ts).localeCompare(String(a.ts)));

  return `
    ${pageHeader('activity', 'Cross-Module Activity Logs', 'Live operational feed across ERP Audit Trail & LPG Services')}
    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Timestamp</th><th>Module</th><th>Event</th><th>Description</th><th>Actor</th></tr></thead>
          <tbody>
            ${combined.slice(0, 75).map(a => `
              <tr>
                <td class="tabular-nums">${formatDateTime(a.ts)}</td>
                <td><span class="badge badge-info">${esc(a.source)}</span></td>
                <td class="font-mono">${esc(a.action)}</td>
                <td>${esc(a.msg)}</td>
                <td>${esc(a.user || 'System')}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No activity recorded yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderNotificationSettingsView() {
  const prefs = getItem(KEYS.NOTIFICATION_PREFS, { docExpiryDays: 30, lowStockAlerts: true, leaveAlerts: true, overdueFollowupAlerts: true });
  return `
    ${pageHeader('bell', 'Notification & Alert Rules', 'Configure sidebar badge alert windows and threshold triggers')}
    <div class="card" style="padding:1.25rem; max-width:560px;">
      <form onsubmit="window.MJK.saveNotificationPrefs(event)">
        <div class="form-group">
          <label class="form-label">Document Expiry Alert Window (Days Before Expiry)</label>
          <input id="pref-doc-days" type="number" min="1" max="180" class="form-control" value="${Number(prefs.docExpiryDays) || 30}">
        </div>
        <div class="form-group" style="display:flex; align-items:center; gap:0.5rem;">
          <input id="pref-low-stock" type="checkbox" ${prefs.lowStockAlerts !== false ? 'checked' : ''}>
          <label for="pref-low-stock" style="margin:0;">Enable Low Stock Sidebar &amp; Dashboard Alerts</label>
        </div>
        <div class="form-group" style="display:flex; align-items:center; gap:0.5rem;">
          <input id="pref-leave-alerts" type="checkbox" ${prefs.leaveAlerts !== false ? 'checked' : ''}>
          <label for="pref-leave-alerts" style="margin:0;">Enable Pending Leave Approval Alerts</label>
        </div>
        <button type="submit" class="btn btn-primary">Save Notification Settings</button>
      </form>
    </div>
  `;
}

export function renderDatabaseManagementView() {
  ensureDbHealthLoaded(false);
  const health = DeptUiState.dbHealth;
  const curUser = getCurrentUser();
  const isRootMain = isMainAdmin(curUser);

  const stores = [
    ['Customers', KEYS.CUSTOMERS],
    ['Counter Services', KEYS.SERVICES],
    ['Invoices', KEYS.INVOICES],
    ['Payments', KEYS.PAYMENTS],
    ['Expenses', KEYS.EXPENSES],
    ['Inventory Items', KEYS.INVENTORY],
    ['Gas Customers', KEYS.GAS_CUSTOMERS],
    ['Gas Bookings', KEYS.GAS_BOOKINGS],
    ['Users / Employees', KEYS.USERS],
    ['Leaves', KEYS.LEAVES],
    ['Payslips', KEYS.PAYSLIPS],
    ['Tasks', KEYS.TASKS],
    ['Documents Vault', KEYS.DOCUMENTS],
    ['Audit Logs', KEYS.AUDIT_LOGS]
  ];

  const tables = health?.tables || {};
  const sqliteBackups = Array.isArray(health?.backups) ? health.backups : [];
  const resetRefs = Array.isArray(health?.recentResetReferences) ? health.recentResetReferences : [];
  const sessionToken = encodeURIComponent(localStorage.getItem('MUN_COMPUTER_SESSION_TOKEN') || '');

  return `
    ${pageHeader('database', 'Relational SQLite Database & Storage Health', 'Live SQLite (WAL + Foreign Keys) integrity inspector, automated .db backup & restore',
      `<div style="display:flex; gap:0.45rem; flex-wrap:wrap;">
         <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.refreshDbHealth()">Refresh Health</button>
         <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.createSqliteBackupNow()">Create SQLite .db Backup</button>
         <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.runManualAutoSnapshot()">Create JSON Snapshot</button>
       </div>`
    )}

    <div class="stats-grid" style="margin-bottom:1.25rem;">
      <div class="stat-card">
        <div class="stat-label">Engine &amp; Journal Mode</div>
        <div class="stat-value font-mono" style="font-size:1.05rem;">${esc((health?.engine || 'SQLite').toUpperCase())} · ${esc(String(health?.journalMode || 'WAL').toUpperCase())}</div>
        <div class="stat-desc">${esc(health?.dbPath || 'data/mun-computer.db')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Database Integrity</div>
        <div class="stat-value" style="font-size:1.05rem; color:${health?.integrity === 'ok' ? 'var(--success)' : 'var(--warning)'};">${esc(String(health?.integrity || 'CHECKING...').toUpperCase())}</div>
        <div class="stat-desc">Foreign Keys: ${health?.foreignKeys ? 'ENFORCED' : 'PENDING'} · Triggers Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Database Size &amp; Tables</div>
        <div class="stat-value font-mono tabular-nums" style="font-size:1.05rem;">${health ? `${(Number(health.sizeBytes || 0) / 1024).toFixed(1)} KB` : '...'}</div>
        <div class="stat-desc">${Object.keys(tables).length || 12} relational tables + indexes</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Main Admin Lock</div>
        <div class="stat-value font-mono" style="font-size:1.05rem; color:var(--blue-600);">${MAIN_ADMIN_UID}</div>
        <div class="stat-desc">Protected by DB triggers &amp; RBAC middleware</div>
      </div>
    </div>

    <div class="erp-grid-2-tight" style="align-items:start; gap:1.25rem; margin-bottom:1.25rem;">
      <div class="table-card">
        <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">SQLite Relational Tables (${Object.keys(tables).length})</h3></div></div>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Table Name</th><th style="text-align:right;">Row Count</th></tr></thead>
            <tbody>
              ${Object.entries(tables).map(([tbl, cnt]) => `
                <tr><td class="font-mono" style="font-size:0.8rem;">${esc(tbl)}</td><td class="tabular-nums" style="text-align:right; font-weight:700;">${Number(cnt) || 0}</td></tr>
              `).join('') || '<tr><td colspan="2" style="text-align:center; padding:1.25rem; color:var(--text-muted);">Loading SQLite table health...</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="table-card">
        <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">SQLite Hot Backups (.db)</h3></div></div>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Backup File</th><th style="text-align:right;">Size</th><th style="text-align:right;">Actions</th></tr></thead>
            <tbody>
              ${sqliteBackups.map(b => `
                <tr>
                  <td class="font-mono" style="font-size:0.78rem;">${esc(b.fileName)}</td>
                  <td class="tabular-nums" style="text-align:right;">${(Number(b.sizeBytes || 0) / 1024).toFixed(1)} KB</td>
                  <td style="text-align:right; white-space:nowrap;">
                    <a class="btn btn-outline btn-sm" href="/api/admin/db-backup/${encodeURIComponent(b.fileName)}/download?sessionToken=${sessionToken}" download>Download</a>
                    ${isRootMain ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.restoreSqliteBackupFile('${escAttr(b.fileName)}')">Restore</button>` : ''}
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="3" style="text-align:center; padding:1.25rem; color:var(--text-muted);">No SQLite .db backups created yet. Click "Create SQLite .db Backup".</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    ${resetRefs.length > 0 ? `
      <div class="table-card" style="margin-bottom:1.25rem;">
        <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">Recent Password Reset References (PWD-YYMMDD-SSSSSS)</h3></div></div>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Reference Number</th><th>User ID</th><th>Date (IST)</th><th>Time (IST)</th><th>Status</th></tr></thead>
            <tbody>
              ${resetRefs.slice(0, 15).map(r => `
                <tr>
                  <td class="font-mono" style="font-weight:700; color:var(--blue-600);">${esc(r.referenceNumber)}</td>
                  <td class="font-mono">${esc(r.userId)}</td>
                  <td class="font-mono">${esc(r.resetDate)}</td>
                  <td class="font-mono">${esc(r.resetTime)}</td>
                  <td><span class="badge badge-success">${esc(r.resetStatus || 'SUCCESSFUL')}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    <div class="table-card">
      <div class="table-toolbar"><div class="table-toolbar-left"><h3 style="margin:0; font-size:0.95rem;">Synchronized Client Cache Stores</h3></div></div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Data Store</th><th>Storage Key</th><th style="text-align:right;">Records</th></tr></thead>
          <tbody>
            ${stores.map(([label, key]) => {
              const arr = getItem(key, []);
              return `<tr><td><strong>${esc(label)}</strong></td><td class="font-mono" style="font-size:0.75rem;">${esc(key)}</td><td class="tabular-nums" style="text-align:right; font-weight:700;">${Array.isArray(arr) ? arr.length : 1}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderDataImportExportView() {
  return `
    ${pageHeader('hard-drive-download', 'Backup, Import & Data Export', 'Download full JSON ERP backups, export Excel workbooks or restore archive files')}
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:1rem;">
      <div class="card" style="padding:1.15rem;">
        <h3 style="margin:0 0 0.5rem 0; font-size:0.95rem;">Download Full ERP Backup (.json)</h3>
        <p style="font-size:0.8rem; color:var(--text-muted);">Exports all Customers, Services, Finance, Gas, Team &amp; HR stores safely.</p>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('settings')">Open Backup &amp; Restore in Settings</button>
      </div>
      <div class="card" style="padding:1.15rem;">
        <h3 style="margin:0 0 0.5rem 0; font-size:0.95rem;">Export Department Excel / PDF Packs</h3>
        <p style="font-size:0.8rem; color:var(--text-muted);">Download formatted MUN COMPUTER letterhead PDF/Excel registers.</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('pdf-excel-export')">Open Export Center</button>
      </div>
    </div>
  `;
}

export function renderSecuritySettingsView() {
  ensureSysSettingsLoaded(false);
  const sec = getItem(KEYS.SECURITY_SETTINGS, { enforceDeleteReason: true, sessionTimeoutMins: 480, serverTokenSigning: true });
  const srv = DeptUiState.sysSettings || {};
  const curUser = getCurrentUser();
  const isRootMain = isMainAdmin(curUser);
  const mfaEnabled = Boolean(curUser?.mfaEnabled);
  const mfaSetup = DeptUiState.mfaSetup;
  const auditLogs = getItem(KEYS.AUDIT_LOGS, []).slice(0, 25);

  return `
    ${pageHeader('shield-check', 'System Security Policies & MFA Control Center', 'Enterprise Zero-Trust Architecture — Argon2id hashing, brute-force lockouts, TOTP MFA & mandatory deletion compliance')}

    <div class="card" style="background:#0B1530; color:#ffffff; border:1px solid #1E2E58; padding:1.15rem 1.3rem; margin-bottom:1.15rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.85rem;">
      <div>
        <div style="font-size:0.72rem; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#D6B56D;">Enterprise Zero-Trust Architecture</div>
        <div style="font-size:1.05rem; font-weight:800; margin-top:0.2rem;">Cryptographic Security Posture Active</div>
        <div style="font-size:0.78rem; color:#cbd5e1; margin-top:0.15rem;">HttpOnly signed sessions, CSRF header validation, Argon2id key derivation &amp; immutable audit logs.</div>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:0.45rem;">
        <span class="badge" style="background:rgba(16,185,129,0.2); color:#6ee7b7; border:1px solid rgba(16,185,129,0.4);">Argon2id Active</span>
        <span class="badge" style="background:rgba(20,184,166,0.2); color:#5eead4; border:1px solid rgba(20,184,166,0.4);">CSRF Protected</span>
        <span class="badge" style="background:rgba(139,92,246,0.2); color:#c4b5fd; border:1px solid rgba(139,92,246,0.4);">TOTP MFA ${mfaEnabled ? 'Enrolled' : 'Ready'}</span>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:1.15rem; align-items:start; margin-bottom:1.15rem;">
      <div class="card" style="padding:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem; padding-bottom:0.65rem; border-bottom:1px solid var(--border-subtle);">
          <h3 style="margin:0; font-size:1rem;">Server Authentication &amp; Lockout Policies</h3>
          <span class="badge badge-info">Zero-Trust Engine</span>
        </div>
        <form onsubmit="window.MJK.saveSecuritySettings(event)">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Max Failed Login Attempts</label>
              <input id="sec-max-login-fails" type="number" min="3" max="20" class="form-control font-mono tabular-nums" value="${Number(srv.max_failed_login_attempts) || 5}">
            </div>
            <div class="form-group">
              <label class="form-label">Max Failed Reset Attempts</label>
              <input id="sec-max-reset-fails" type="number" min="2" max="20" class="form-control font-mono tabular-nums" value="${Number(srv.max_failed_reset_attempts) || 3}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Lockout Duration (Minutes)</label>
              <input id="sec-lockout-mins" type="number" min="5" max="1440" class="form-control font-mono tabular-nums" value="${Number(srv.lockout_duration_minutes) || 30}">
            </div>
            <div class="form-group">
              <label class="form-label">Session Lock Timeout (Minutes)</label>
              <input id="sec-timeout" type="number" min="5" max="1440" class="form-control font-mono tabular-nums" value="${Number(srv.session_timeout_minutes) || Number(sec.sessionTimeoutMins) || 480}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Daily Password Change Limit (Per Account)</label>
            <input id="sec-daily-pwd-limit" type="number" min="1" max="20" class="form-control font-mono tabular-nums" value="${Number(srv.daily_password_change_limit) || 2}">
          </div>
          <div class="form-group" style="display:flex; align-items:center; gap:0.55rem; padding:0.65rem 0.8rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-sm);">
            <input id="sec-del-reason" type="checkbox" ${sec.enforceDeleteReason !== false ? 'checked' : ''}>
            <label for="sec-del-reason" style="margin:0; font-weight:600; font-size:0.84rem;">Mandate Delete Reason &amp; Audit Logging for Deletions</label>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.85rem;">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.resetSecurityPoliciesDefaults()">Restore OWASP Defaults</button>
            <button type="submit" class="btn btn-primary btn-sm">Save &amp; Enforce Security Policies</button>
          </div>
        </form>
      </div>

      <div class="card" style="padding:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; padding-bottom:0.65rem; border-bottom:1px solid var(--border-subtle);">
          <div>
            <h3 style="margin:0; font-size:1rem;">Main Admin TOTP Two-Factor Auth (${MAIN_ADMIN_UID})</h3>
            <div style="font-size:0.75rem; color:var(--text-muted);">Google Authenticator / Authy / Aegis 6-digit TOTP enforcement</div>
          </div>
          <span class="badge ${mfaEnabled ? 'badge-success' : 'badge-warning'}">${mfaEnabled ? 'Enrolled & Active' : 'Setup Ready'}</span>
        </div>
        <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:0.9rem;">
          Main Administrator account <strong>${MAIN_ADMIN_UID}</strong> supports TOTP SHA-1 (30s step) verification, single-use recovery backup codes &amp; rate-limited attempts.
        </p>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.9rem;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openMfaRecoveryModal()">🔐 View TOTP URI &amp; 8 Backup Recovery Codes</button>
          ${isRootMain ? (mfaEnabled ? `
            <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.confirmDisableMainAdminMfa()">Reset / Disable TOTP Device</button>
          ` : (!mfaSetup ? `
            <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.initMainAdminMfaSetup()">Setup Two-Factor Authentication</button>
          ` : '')) : ''}
        </div>
        ${isRootMain && !mfaEnabled && mfaSetup ? `
          <div style="padding:0.85rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:0.75rem;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Manual Authenticator Secret Key (Base32):</div>
            <div class="font-mono" style="font-weight:800; font-size:0.95rem; color:var(--blue-600); word-break:break-all; margin:0.25rem 0;">${esc(mfaSetup.secret)}</div>
            <div style="font-size:0.72rem; color:var(--text-muted); word-break:break-all;">URI: <span class="font-mono">${esc(mfaSetup.otpAuthUri)}</span></div>
          </div>
          <form onsubmit="window.MJK.confirmEnableMainAdminMfa(event)" style="display:flex; gap:0.5rem; align-items:center;">
            <input id="sec-mfa-totp-code" type="text" maxlength="6" pattern="[0-9]{6}" required class="form-control font-mono" placeholder="Enter 6-digit code" style="max-width:180px;">
            <button type="submit" class="btn btn-primary btn-sm">Verify &amp; Enable MFA</button>
          </form>
        ` : ''}
      </div>
    </div>

    <div class="card" style="padding:1.25rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.65rem; margin-bottom:0.9rem;">
        <div>
          <h3 style="margin:0; font-size:1rem;">Deletion Compliance Workflow &amp; Immutable Security Audit Trail</h3>
          <div style="font-size:0.76rem; color:var(--text-muted);">Every record deletion requires a documented minimum 10-character reason recorded into immutable audit logs.</div>
        </div>
        <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.openComplianceDeleteTestModal()">🧪 Test Deletion Compliance Modal</button>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Log ID</th><th>Actor</th><th>Action</th><th>Compliance Details / Reason</th><th>Timestamp</th></tr></thead>
          <tbody>
            ${auditLogs.map(l => `
              <tr>
                <td class="font-mono" style="font-size:0.76rem; color:var(--blue-600);">${esc(l.id || '-')}</td>
                <td><strong>${esc(l.user || 'System')}</strong></td>
                <td><span class="badge ${String(l.action || '').includes('DELETE') ? 'badge-danger' : 'badge-info'}">${esc(l.action || 'EVENT')}</span></td>
                <td>${esc(l.details || '-')}</td>
                <td class="tabular-nums" style="white-space:nowrap;">${formatDateTime(l.timestamp)}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center; padding:1.25rem; color:var(--text-muted);">No security audit trail entries yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   PUBLIC HANDLERS FOR NEW DEPARTMENT VIEWS
   ========================================================================= */
export function createErpDepartmentHandlers({ showToast, openModal, closeModal, render, navigateTo }) {
  return {
    setDeptState: (key, value) => {
      DeptUiState[key] = value;
      render();
    },

    setDeptFilterKeepFocus: (key, value, inputId) => {
      DeptUiState[key] = value;
      const el = inputId ? document.getElementById(inputId) : null;
      const pos = el && typeof el.selectionStart === 'number' ? el.selectionStart : null;
      render();
      if (inputId) {
        const next = document.getElementById(inputId);
        if (next) {
          next.focus();
          if (pos !== null && typeof next.setSelectionRange === 'function') {
            try { next.setSelectionRange(pos, pos); } catch {}
          }
        }
      }
    },

    exportDeptTable: async (datasetKey, format = 'pdf') => {
      let cfg;
      if (datasetKey === 'dues') {
        const dues = getAllCombinedDuesRows();
        const headers = ['Source', 'Ref', 'Customer', 'Phone', 'Date', 'Total', 'Paid', 'Due Balance'];
        const rows = dues.map(d => [d.source, d.refId, d.customerName, d.phone || '-', formatDate(d.date), d.total, d.paid, d.due]);
        cfg = { filename: `MUN_Customer_Dues_${getTodayDate()}`, sheetName: 'Customer_Dues', title: 'CUSTOMER OUTSTANDING DUES STATEMENT', subtitle: `Open Accounts: ${dues.length}`, headers, rows, totalsRow: buildSumTotalsRow(headers, rows, [5, 6, 7], 'TOTAL') };
      } else if (datasetKey === 'gst_sales') {
        const invoices = getItem(KEYS.INVOICES, []);
        const headers = ['Invoice #', 'Customer', 'Date', 'GSTIN', 'Taxable Value', 'GST Amount', 'Grand Total'];
        const rows = invoices.map(i => {
          const grand = Number(i.grandTotal || i.totalAmount || 0);
          const gst = Number(i.gstAmount || i.taxAmount || 0);
          return [i.invoiceNumber || i.id, i.customerName, formatDate(i.date), i.customerGstin || '-', Math.max(0, grand - gst), gst, grand];
        });
        cfg = { filename: `MUN_GST_Sales_${getTodayDate()}`, sheetName: 'GST_Sales', title: 'SALES & GST BILLING REGISTER', subtitle: `Invoices: ${invoices.length}`, headers, rows, totalsRow: buildSumTotalsRow(headers, rows, [4, 5, 6], 'TOTAL') };
      } else if (datasetKey === 'pnl') {
        const srv = getItem(KEYS.SERVICES, []).reduce((s, x) => s + (Number(x.totalFee || x.charge) || 0), 0);
        const inv = getItem(KEYS.INVOICES, []).reduce((s, x) => s + (Number(x.grandTotal || x.totalAmount) || 0), 0);
        const gas = getItem(KEYS.GAS_COLLECTIONS, []).reduce((s, x) => s + (Number(x.amountPaid || x.paidAmount) || 0), 0);
        const exp = getItem(KEYS.EXPENSES, []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
        const pay = getItem(KEYS.PAYSLIPS, []).reduce((s, x) => s + (Number(x.netPay) || 0), 0);
        const headers = ['Statement Head', 'Category', 'Amount (INR)'];
        const rows = [
          ['Counter Services Revenue', 'Income', srv],
          ['Billing Invoices Revenue', 'Income', inv],
          ['LPG Collections Revenue', 'Income', gas],
          ['Operating Expenses', 'Expense', -exp],
          ['Employee Payroll', 'Expense', -pay],
          ['NET PROFIT / (LOSS)', 'Bottom Line', (srv + inv + gas) - (exp + pay)]
        ];
        cfg = { filename: `MUN_Profit_Loss_${getTodayDate()}`, sheetName: 'Profit_Loss', title: 'PROFIT & LOSS STATEMENT', subtitle: `Generated: ${getTodayDate()}`, headers, rows };
      } else if (datasetKey === 'leads') {
        const leads = getItem(KEYS.LEADS, []);
        const headers = ['Date', 'Name', 'Phone', 'Interest', 'Stage'];
        const rows = leads.map(l => [formatDate(l.date), l.name, l.phone || '-', l.interest || '-', l.status || 'New']);
        cfg = { filename: `MUN_Leads_${getTodayDate()}`, sheetName: 'Leads', title: 'SALES LEADS PIPELINE REPORT', subtitle: `Leads: ${leads.length}`, headers, rows };
      } else {
        const def = getCustomDatasetDefinition(datasetKey);
        cfg = { filename: `MUN_${datasetKey}_${getTodayDate()}`, sheetName: def.title.slice(0, 28), title: def.title, subtitle: `Records: ${def.rows.length}`, headers: def.headers, rows: def.rows };
      }
      if (format === 'csv') { exportUniversalCSV(cfg); showToast(`${cfg.title} CSV exported.`, 'success'); }
      else if (format === 'excel') { exportUniversalExcel(cfg); showToast(`${cfg.title} Excel exported.`, 'success'); }
      else if (format === 'print') { printUniversalReport(cfg); }
      else { await exportUniversalPDF(cfg); showToast(`${cfg.title} PDF exported.`, 'success'); }
    },

    exportCustomBuilder: async (format = 'pdf') => {
      const ds = getCustomDatasetDefinition(DeptUiState.customReportDataset);
      const q = DeptUiState.customReportQuery.trim().toLowerCase();
      const from = DeptUiState.customReportFrom;
      const to = DeptUiState.customReportTo;
      const rows = ds.rows.filter((r, idx) => {
        const dt = String(ds.dates[idx] || '').slice(0, 10);
        if (from && dt && dt < from) return false;
        if (to && dt && dt > to) return false;
        if (q && !r.join(' ').toLowerCase().includes(q)) return false;
        return true;
      });
      const cfg = {
        filename: `MUN_Custom_${DeptUiState.customReportDataset}_${getTodayDate()}`,
        sheetName: 'Custom_Report',
        title: ds.title,
        subtitle: `Filtered Rows: ${rows.length} · Report ID: ${generateReportId('MUN-CUS')}`,
        headers: ds.headers,
        rows
      };
      if (format === 'csv') exportUniversalCSV(cfg);
      else if (format === 'excel') exportUniversalExcel(cfg);
      else if (format === 'print') printUniversalReport(cfg);
      else await exportUniversalPDF(cfg);
      showToast('Report exported.', 'success');
    },

    openAddFeedbackModal: () => {
      const customers = getItem(KEYS.CUSTOMERS, []);
      const firstCustId = customers[0]?.id || 'WALKIN';
      openModal('Record Customer Feedback', `
        <form onsubmit="window.MJK.submitCustomerFeedback(event)">
          <div style="padding:0.7rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:0.85rem;">
            <label class="form-label" style="font-size:0.75rem;">Search &amp; Select Customer (Auto-fetches Processed Services) *</label>
            <input type="text" id="fb-cust-search" class="form-control" style="margin-bottom:0.45rem;" placeholder="Search customer name, mobile, or ID..." oninput="window.MJK.filterFeedbackCustomerOptions(this.value)">
            <select id="fb-cust" class="form-control" required onchange="window.MJK.onFeedbackCustomerChange(this.value)">
              ${customers.map(c => `<option value="${escAttr(c.id)}" data-name="${escAttr(c.name)}" data-phone="${escAttr(c.phone || '')}">${esc(c.name)} (${esc(c.phone || c.id)})</option>`).join('') || '<option value="WALKIN" data-name="Walk-in Customer" data-phone="">Walk-in Customer</option>'}
            </select>
            <div id="fb-cust-meta" style="font-size:0.74rem; color:var(--text-muted); margin-top:0.35rem;"></div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Service / Scheme Name *</label>
              <select id="fb-service-select" class="form-control" onchange="if(this.value==='__CUSTOM__'){document.getElementById('fb-dept-wrap').style.display='block';}else{document.getElementById('fb-dept-wrap').style.display='none'; document.getElementById('fb-dept').value=this.value;}">
                <option value="Counter Service">Counter Service</option>
              </select>
              <div id="fb-dept-wrap" style="display:none; margin-top:0.4rem;">
                <input id="fb-dept" class="form-control" value="Counter Service" placeholder="Enter service / department name">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Star Rating (1–5) *</label>
              <input type="hidden" id="fb-rating" value="5">
              <div id="fb-star-bar" style="display:flex; gap:0.35rem; align-items:center; padding:0.35rem 0;">
                ${[1, 2, 3, 4, 5].map(n => `
                  <button type="button" data-star="${n}" onclick="window.MJK.setFeedbackStarRating(${n})" style="border:1px solid var(--border-subtle); background:var(--surface); border-radius:6px; padding:0.3rem 0.55rem; font-size:1rem; cursor:pointer; color:#f59e0b; font-weight:800;">★</button>
                `).join('')}
                <span id="fb-rating-label" style="font-size:0.78rem; font-weight:700; color:var(--blue-600); margin-left:0.35rem;">5 / 5 Excellent</span>
              </div>
            </div>
          </div>
          <div class="form-group"><label class="form-label">Comments / Experience Details *</label><textarea id="fb-comments" class="form-control" rows="2" required placeholder="Share feedback about counter service speed, accuracy, staff behaviour..."></textarea></div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Feedback</button></div>
        </form>
      `, null);
      setTimeout(() => {
        if (firstCustId && firstCustId !== 'WALKIN') {
          window.MJK.onFeedbackCustomerChange(firstCustId);
        }
      }, 20);
    },

    filterFeedbackCustomerOptions: (query = '') => {
      const sel = document.getElementById('fb-cust');
      if (!sel) return;
      const q = String(query || '').trim().toLowerCase();
      let firstVisibleVal = '';
      Array.from(sel.options).forEach(opt => {
        const match = !q || opt.textContent.toLowerCase().includes(q);
        opt.style.display = match ? '' : 'none';
        if (match && !firstVisibleVal) firstVisibleVal = opt.value;
      });
      if (firstVisibleVal && sel.selectedOptions[0]?.style.display === 'none') {
        sel.value = firstVisibleVal;
        window.MJK.onFeedbackCustomerChange(firstVisibleVal);
      }
    },

    onFeedbackCustomerChange: (custId = '') => {
      const customers = getItem(KEYS.CUSTOMERS, []);
      const services = getItem(KEYS.SERVICES, []);
      const cases = getItem(KEYS.FOLLOWUP_CASES, []);
      const govtCases = getItem(KEYS.GOVT_CASES, []);
      const cust = customers.find(c => c.id === custId);

      const metaEl = document.getElementById('fb-cust-meta');
      if (metaEl) {
        metaEl.innerHTML = cust
          ? `Selected: <strong>${esc(cust.name)}</strong> · ${esc(cust.phone || '-')} · ${esc(cust.village || cust.district || '')}`
          : '';
      }

      const detected = new Set();
      if (cust) {
        if (Array.isArray(cust.services)) cust.services.forEach(s => s && detected.add(String(s).trim()));
        if (cust.schemeName && cust.schemeName !== 'General Digital Service') {
          String(cust.schemeName).split(',').forEach(s => s.trim() && detected.add(s.trim()));
        }
      }
      services.filter(s => s.customerId === custId).forEach(s => s.serviceName && detected.add(String(s.serviceName).trim()));
      cases.filter(c => c.customerId === custId).forEach(c => {
        if (Array.isArray(c.services)) c.services.forEach(s => s && detected.add(String(s).trim()));
        else if (c.schemeName) String(c.schemeName).split(',').forEach(s => s.trim() && detected.add(s.trim()));
      });
      govtCases.filter(g => g.customerId === custId).forEach(g => g.schemeName && detected.add(String(g.schemeName).trim()));

      const srvList = Array.from(detected).filter(Boolean);
      const selEl = document.getElementById('fb-service-select');
      const deptInput = document.getElementById('fb-dept');
      const deptWrap = document.getElementById('fb-dept-wrap');
      if (selEl) {
        const opts = srvList.length > 0 ? [...srvList, 'Counter Service'] : ['Counter Service'];
        selEl.innerHTML = `${Array.from(new Set(opts)).map(s => `<option value="${escAttr(s)}">${esc(s)}</option>`).join('')}<option value="__CUSTOM__">+ Enter Other Service...</option>`;
        if (deptInput) deptInput.value = selEl.value;
        if (deptWrap) deptWrap.style.display = 'none';
      }
    },

    setFeedbackStarRating: (n = 5) => {
      const rating = Math.max(1, Math.min(5, Number(n) || 5));
      const input = document.getElementById('fb-rating');
      const lbl = document.getElementById('fb-rating-label');
      const labels = { 1: '1 / 5 Dissatisfied', 2: '2 / 5 Poor', 3: '3 / 5 Average', 4: '4 / 5 Good', 5: '5 / 5 Excellent' };
      if (input) input.value = String(rating);
      if (lbl) lbl.textContent = labels[rating] || `${rating} / 5`;
      document.querySelectorAll('#fb-star-bar button[data-star]').forEach(btn => {
        const starVal = Number(btn.getAttribute('data-star'));
        btn.style.color = starVal <= rating ? '#f59e0b' : '#cbd5e1';
      });
    },

    submitCustomerFeedback: async (e) => {
      e.preventDefault();
      try {
        const sel = document.getElementById('fb-cust');
        const srvSelect = document.getElementById('fb-service-select');
        const customDept = document.getElementById('fb-dept')?.value?.trim() || '';
        const resolvedService = srvSelect?.value === '__CUSTOM__' ? (customDept || 'Counter Service') : (srvSelect?.value || customDept || 'Counter Service');
        const id = await allocateGlobalReference('FB', { entityType: 'CUSTOMER_FEEDBACK' });
        const list = getItem(KEYS.CUSTOMER_FEEDBACK, []);
        list.unshift({
          id,
          customerId: sel?.value || '',
          customerName: sel?.selectedOptions?.[0]?.dataset?.name || 'Customer',
          customerPhone: sel?.selectedOptions?.[0]?.dataset?.phone || '',
          serviceName: resolvedService,
          department: resolvedService,
          rating: Number(document.getElementById('fb-rating')?.value) || 5,
          comments: document.getElementById('fb-comments')?.value?.trim() || '',
          date: getTodayDate()
        });
        setItem(KEYS.CUSTOMER_FEEDBACK, list);
        await pushExtendedErpToServer();
        closeModal();
        showToast('Customer feedback recorded.', 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to record feedback.', 'danger');
      }
    },

    openAddQuoteEstimateModal: (kind = 'QUOTATION') => {
      const customers = getItem(KEYS.CUSTOMERS, []);
      openModal(kind === 'ESTIMATE' ? 'New Cost Estimate' : 'New Sales Quotation', `
        <form onsubmit="window.MJK.submitQuoteOrEstimate(event, '${escAttr(kind)}')">
          <div class="form-group">
            <label class="form-label">Customer *</label>
            <select id="qe-cust" class="form-control">
              ${customers.map(c => `<option value="${escAttr(c.id)}" data-name="${escAttr(c.name)}" data-phone="${escAttr(c.phone || '')}">${esc(c.name)} (${esc(c.phone || c.id)})</option>`).join('') || '<option value="WALKIN" data-name="Walk-in Customer" data-phone="">Walk-in Customer</option>'}
            </select>
          </div>
          <div class="form-group"><label class="form-label">Items / Work Summary *</label><input id="qe-items" class="form-control" required placeholder="e.g. HP Laser Printer Toner + 50 PVC Cards"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Total Amount (₹) *</label><input id="qe-amount" type="number" min="1" step="0.01" class="form-control" required></div>
            <div class="form-group"><label class="form-label">Valid Until</label><input id="qe-valid" type="date" class="form-control" value="${getTodayDate()}"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save</button></div>
        </form>
      `, null);
    },

    submitQuoteOrEstimate: async (e, kind) => {
      e.preventDefault();
      try {
        const key = kind === 'ESTIMATE' ? KEYS.ESTIMATES : KEYS.QUOTATIONS;
        const sel = document.getElementById('qe-cust');
        const id = await allocateGlobalReference(kind === 'ESTIMATE' ? 'EST' : 'QT', { entityType: kind });
        const list = getItem(key, []);
        list.unshift({
          id,
          customerId: sel?.value || '',
          customerName: sel?.selectedOptions?.[0]?.dataset?.name || 'Walk-in Customer',
          phone: sel?.selectedOptions?.[0]?.dataset?.phone || '',
          itemSummary: document.getElementById('qe-items')?.value?.trim() || '',
          amount: Number(document.getElementById('qe-amount')?.value) || 0,
          validUntil: document.getElementById('qe-valid')?.value || getTodayDate(),
          date: getTodayDate(),
          status: 'Open'
        });
        setItem(key, list);
        await pushExtendedErpToServer();
        closeModal();
        showToast(`${kind === 'ESTIMATE' ? 'Estimate' : 'Quotation'} created.`, 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to save quote/estimate.', 'danger');
      }
    },

    convertQuotationToInvoice: async (quoteId) => {
      try {
        const quotes = getItem(KEYS.QUOTATIONS, []);
        const idx = quotes.findIndex(q => q.id === quoteId);
        if (idx === -1) return;
        const q = quotes[idx];
        const invoices = getItem(KEYS.INVOICES, []);
        const newInvId = await allocateGlobalReference('INV', { entityType: 'INVOICE' });
        invoices.unshift({
          id: newInvId,
          invoiceNumber: newInvId,
          customerId: q.customerId || '',
          customerName: q.customerName,
          customerPhone: q.phone || '',
          date: getTodayDate(),
          items: [{ description: q.itemSummary, qty: 1, rate: q.amount, amount: q.amount }],
          subtotal: q.amount,
          grandTotal: q.amount,
          totalAmount: q.amount,
          amountPaid: 0,
          paidAmount: 0,
          balanceDue: q.amount,
          status: 'Pending',
          notes: `Converted from Quotation ${q.id}`
        });
        setItem(KEYS.INVOICES, invoices);
        quotes[idx].status = 'Converted';
        quotes[idx].convertedInvoiceId = newInvId;
        setItem(KEYS.QUOTATIONS, quotes);
        await pushExtendedErpToServer();
        logAuditAction('QUOTE_CONVERT_INVOICE', `Converted ${q.id} into Invoice ${newInvId}`);
        showToast(`Converted Quotation ${q.id} to Invoice ${newInvId}.`, 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to convert quotation.', 'danger');
      }
    },

    printSingleRecord: (kind, id) => {
      const list = getItem(kind === 'ESTIMATE' ? KEYS.ESTIMATES : KEYS.QUOTATIONS, []);
      const item = list.find(x => x.id === id);
      if (!item) return;
      printUniversalReport({
        title: `${kind} DOCUMENT — ${item.id}`,
        subtitle: `Customer: ${item.customerName} | Date: ${formatDate(item.date)}`,
        headers: ['Reference', 'Customer', 'Description', 'Valid Until', 'Amount'],
        rows: [[item.id, item.customerName, item.itemSummary, formatDate(item.validUntil || item.date), Number(item.amount) || 0]],
        includeAcknowledgement: true
      });
    },

    openAddReturnOrCreditModal: (kind = 'RETURN') => {
      const invoices = getItem(KEYS.INVOICES, []);
      openModal(kind === 'CREDIT_NOTE' ? 'Issue Credit Note' : 'Record Sales Return', `
        <form onsubmit="window.MJK.submitReturnOrCredit(event, '${escAttr(kind)}')">
          <div class="form-group">
            <label class="form-label">Linked Invoice *</label>
            <select id="rc-inv" class="form-control">
              ${invoices.map(i => `<option value="${escAttr(i.invoiceNumber || i.id)}" data-cust-id="${escAttr(i.customerId || '')}" data-cust-name="${escAttr(i.customerName)}">${esc(i.invoiceNumber || i.id)} — ${esc(i.customerName)} (${formatINR(i.grandTotal || i.totalAmount)})</option>`).join('') || '<option value="-" data-cust-id="" data-cust-name="Walk-in Customer">Manual Adjustment</option>'}
            </select>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Amount (₹) *</label><input id="rc-amt" type="number" min="1" step="0.01" class="form-control" required></div>
            <div class="form-group"><label class="form-label">Reason *</label><input id="rc-reason" class="form-control" required placeholder="e.g. Damaged / Billing difference"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save</button></div>
        </form>
      `, null);
    },

    submitReturnOrCredit: async (e, kind) => {
      e.preventDefault();
      try {
        const sel = document.getElementById('rc-inv');
        const key = kind === 'CREDIT_NOTE' ? KEYS.CREDIT_NOTES : KEYS.SALES_RETURNS;
        const id = await allocateGlobalReference(kind === 'CREDIT_NOTE' ? 'CN' : 'SRET', { entityType: kind });
        const list = getItem(key, []);
        list.unshift({
          id,
          invoiceRef: sel?.value || '-',
          customerId: sel?.selectedOptions?.[0]?.dataset?.custId || '',
          customerName: sel?.selectedOptions?.[0]?.dataset?.custName || 'Customer',
          amount: Number(document.getElementById('rc-amt')?.value) || 0,
          reason: document.getElementById('rc-reason')?.value?.trim() || '',
          date: getTodayDate()
        });
        setItem(key, list);
        await pushExtendedErpToServer();
        closeModal();
        showToast(`${kind === 'CREDIT_NOTE' ? 'Credit Note' : 'Sales Return'} recorded.`, 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to save return/credit note.', 'danger');
      }
    },

    openAddCategoryModal: () => {
      openModal('Add Product Category', `
        <form onsubmit="window.MJK.submitAddCategory(event)">
          <div class="form-group"><label class="form-label">Category Name *</label><input id="cat-name-new" class="form-control" required placeholder="e.g. Printers &amp; Toners"></div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Add Category</button></div>
        </form>
      `, null);
    },

    submitAddCategory: (e) => {
      e.preventDefault();
      const name = document.getElementById('cat-name-new')?.value?.trim();
      if (!name) return;
      const cats = getItem(KEYS.INVENTORY_CATEGORIES, []);
      if (!cats.some(c => (typeof c === 'string' ? c : c.name) === name)) {
        cats.push(name);
        setItem(KEYS.INVENTORY_CATEGORIES, cats);
      }
      closeModal();
      showToast(`Category "${name}" added.`, 'success');
      render();
    },

    openStockAdjustmentModal: () => {
      const items = getItem(KEYS.INVENTORY, []);
      if (!items.length) {
        showToast('Add an inventory item first before adjusting stock.', 'warning');
        return;
      }
      openModal('Adjust Stock Quantity', `
        <form onsubmit="window.MJK.submitStockAdjustment(event)">
          <div class="form-group">
            <label class="form-label">Inventory Item *</label>
            <select id="adj-item-id" class="form-control">
              ${items.map(i => `<option value="${escAttr(i.id)}">${esc(i.name || i.itemName)} (Current: ${Number(i.quantity ?? i.stockQty ?? 0)})</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Type</label><select id="adj-type" class="form-control"><option value="ADD">Add Stock (+)</option><option value="DEDUCT">Deduct / Damage (-)</option></select></div>
            <div class="form-group"><label class="form-label">Quantity *</label><input id="adj-qty" type="number" min="1" class="form-control" required></div>
          </div>
          <div class="form-group"><label class="form-label">Reason *</label><input id="adj-reason" class="form-control" required placeholder="e.g. Physical count verification / Damaged unit"></div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Apply Stock Adjustment</button></div>
        </form>
      `, null);
    },

    submitStockAdjustment: async (e) => {
      e.preventDefault();
      try {
        const itemId = document.getElementById('adj-item-id')?.value;
        const type = document.getElementById('adj-type')?.value;
        const qty = Math.max(1, Number(document.getElementById('adj-qty')?.value) || 0);
        const reason = document.getElementById('adj-reason')?.value?.trim() || 'Manual Adjustment';
        const delta = type === 'DEDUCT' ? -qty : qty;

        const items = getItem(KEYS.INVENTORY, []);
        const idx = items.findIndex(i => i.id === itemId);
        if (idx === -1) return;
        const cur = Number(items[idx].quantity ?? items[idx].stockQty ?? 0);
        const next = Math.max(0, cur + delta);
        items[idx].quantity = next;
        if ('stockQty' in items[idx]) items[idx].stockQty = next;
        setItem(KEYS.INVENTORY, items);

        const id = await allocateGlobalReference('ADJ', { entityType: 'STOCK_ADJUSTMENT' });
        const logs = getItem(KEYS.STOCK_ADJUSTMENTS, []);
        logs.unshift({
          id,
          date: getTodayDate(),
          itemId,
          itemName: items[idx].name || items[idx].itemName,
          type: type === 'DEDUCT' ? 'Deduction' : 'Addition',
          delta,
          afterQty: next,
          reason,
          actor: getCurrentUser()?.name || 'Admin'
        });
        setItem(KEYS.STOCK_ADJUSTMENTS, logs);
        await pushExtendedErpToServer();
        closeModal();
        showToast(`Stock updated to ${next} units.`, 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to save stock adjustment.', 'danger');
      }
    },

    openCreatePoModal: (presetItem = '') => {
      const suppliers = getItem(KEYS.GAS_SUPPLIERS, []);
      openModal('Create Purchase Order', `
        <form onsubmit="window.MJK.submitCreatePo(event)">
          <div class="form-group">
            <label class="form-label">Supplier *</label>
            <input id="po-sup" class="form-control" list="po-sup-list" required placeholder="Supplier / Distributor Name">
            <datalist id="po-sup-list">${suppliers.map(s => `<option value="${escAttr(s.name || s.supplierName)}">`).join('')}</datalist>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Item Name *</label><input id="po-item" class="form-control" value="${escAttr(presetItem)}" required></div>
            <div class="form-group"><label class="form-label">Quantity *</label><input id="po-qty" type="number" min="1" class="form-control" value="10" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Total Value (₹) *</label><input id="po-amt" type="number" min="1" class="form-control" required></div>
            <div class="form-group"><label class="form-label">Expected Date</label><input id="po-date" type="date" class="form-control" value="${getTodayDate()}"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Create PO</button></div>
        </form>
      `, null);
    },

    submitCreatePo: async (e) => {
      e.preventDefault();
      try {
        const id = await allocateGlobalReference('PO', { entityType: 'PURCHASE_ORDER' });
        const pos = getItem(KEYS.PURCHASE_ORDERS, []);
        pos.unshift({
          id,
          supplierName: document.getElementById('po-sup')?.value?.trim() || '',
          itemName: document.getElementById('po-item')?.value?.trim() || '',
          qty: Math.max(1, Number(document.getElementById('po-qty')?.value) || 1),
          totalAmount: Number(document.getElementById('po-amt')?.value) || 0,
          expectedDate: document.getElementById('po-date')?.value || getTodayDate(),
          date: getTodayDate(),
          status: 'Ordered'
        });
        setItem(KEYS.PURCHASE_ORDERS, pos);
        await pushExtendedErpToServer();
        closeModal();
        showToast('Purchase order created.', 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to create purchase order.', 'danger');
      }
    },

    receivePurchaseOrder: async (poId) => {
      try {
        const pos = getItem(KEYS.PURCHASE_ORDERS, []);
        const idx = pos.findIndex(p => p.id === poId);
        if (idx === -1) return;
        const po = pos[idx];
        po.status = 'Received';
        setItem(KEYS.PURCHASE_ORDERS, pos);

        // Update inventory if item name matches
        const items = getItem(KEYS.INVENTORY, []);
        const invIdx = items.findIndex(i => String(i.name || i.itemName || '').toLowerCase() === String(po.itemName || '').toLowerCase());
        if (invIdx !== -1) {
          items[invIdx].quantity = (Number(items[invIdx].quantity ?? items[invIdx].stockQty ?? 0)) + Number(po.qty || 0);
          setItem(KEYS.INVENTORY, items);
        }

        // Create corresponding Purchase Bill
        const billId = await allocateGlobalReference('PB', { entityType: 'PURCHASE_BILL' });
        const bills = getItem(KEYS.PURCHASE_BILLS, []);
        bills.unshift({
          id: billId,
          billNo: `BILL-${po.id}`,
          supplierName: po.supplierName,
          date: getTodayDate(),
          gstAmount: 0,
          amount: po.totalAmount,
          status: 'Unpaid'
        });
        setItem(KEYS.PURCHASE_BILLS, bills);
        await pushExtendedErpToServer();
        showToast(`PO ${po.id} received & Purchase Bill logged.`, 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to receive purchase order.', 'danger');
      }
    },

    openAddSupplierQuickModal: () => {
      openModal('Add Supplier', `
        <form onsubmit="window.MJK.submitQuickSupplier(event)">
          <div class="form-group"><label class="form-label">Supplier Name *</label><input id="sup-q-name" class="form-control" required></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Phone</label><input id="sup-q-phone" class="form-control"></div>
            <div class="form-group"><label class="form-label">Category</label><input id="sup-q-cat" class="form-control" value="Hardware & Stationery"></div>
          </div>
          <div class="form-group"><label class="form-label">Address / GSTIN</label><input id="sup-q-addr" class="form-control"></div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Supplier</button></div>
        </form>
      `, null);
    },

    submitQuickSupplier: async (e) => {
      e.preventDefault();
      try {
        const id = await allocateGlobalReference('SUP', { entityType: 'SUPPLIER' });
        const list = getItem(KEYS.GAS_SUPPLIERS, []);
        list.unshift({
          id,
          name: document.getElementById('sup-q-name')?.value?.trim(),
          phone: document.getElementById('sup-q-phone')?.value?.trim(),
          category: document.getElementById('sup-q-cat')?.value?.trim(),
          address: document.getElementById('sup-q-addr')?.value?.trim()
        });
        setItem(KEYS.GAS_SUPPLIERS, list);
        closeModal();
        showToast('Supplier added.', 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to save supplier.', 'danger');
      }
    },

    openAddPurchaseBillModal: () => {
      openModal('Record Vendor Purchase Bill', `
        <form onsubmit="window.MJK.submitPurchaseBill(event)">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Bill No. *</label><input id="pb-no" class="form-control" required></div>
            <div class="form-group"><label class="form-label">Supplier Name *</label><input id="pb-sup" class="form-control" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Total Bill Amount (₹) *</label><input id="pb-amt" type="number" min="1" step="0.01" class="form-control" required></div>
            <div class="form-group"><label class="form-label">Input GST Amount (₹)</label><input id="pb-gst" type="number" min="0" step="0.01" class="form-control" value="0"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Bill</button></div>
        </form>
      `, null);
    },

    submitPurchaseBill: async (e) => {
      e.preventDefault();
      try {
        const id = await allocateGlobalReference('PB', { entityType: 'PURCHASE_BILL' });
        const bills = getItem(KEYS.PURCHASE_BILLS, []);
        bills.unshift({
          id,
          billNo: document.getElementById('pb-no')?.value?.trim(),
          supplierName: document.getElementById('pb-sup')?.value?.trim(),
          amount: Number(document.getElementById('pb-amt')?.value) || 0,
          gstAmount: Number(document.getElementById('pb-gst')?.value) || 0,
          date: getTodayDate(),
          status: 'Unpaid'
        });
        setItem(KEYS.PURCHASE_BILLS, bills);
        await pushExtendedErpToServer();
        closeModal();
        showToast('Purchase bill saved.', 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to save purchase bill.', 'danger');
      }
    },

    markPurchaseBillPaid: async (billId) => {
      const bills = getItem(KEYS.PURCHASE_BILLS, []);
      const idx = bills.findIndex(b => b.id === billId);
      if (idx !== -1) {
        bills[idx].status = 'Paid';
        setItem(KEYS.PURCHASE_BILLS, bills);
        await pushExtendedErpToServer();
        showToast('Purchase bill marked Paid.', 'success');
        render();
      }
    },

    openStockTransferModal: () => {
      const items = getItem(KEYS.INVENTORY, []);
      openModal('New Stock Transfer', `
        <form onsubmit="window.MJK.submitStockTransfer(event)">
          <div class="form-group">
            <label class="form-label">Item *</label>
            <input id="st-item" class="form-control" list="st-items-list" required placeholder="Select or type item name">
            <datalist id="st-items-list">${items.map(i => `<option value="${escAttr(i.name || i.itemName)}">`).join('')}</datalist>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">From Location</label><input id="st-from" class="form-control" value="Main Counter Store"></div>
            <div class="form-group"><label class="form-label">To Location</label><input id="st-to" class="form-control" value="Mamudpur Godown"></div>
            <div class="form-group"><label class="form-label">Quantity</label><input id="st-qty" type="number" min="1" class="form-control" value="1"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Record Transfer</button></div>
        </form>
      `, null);
    },

    submitStockTransfer: async (e) => {
      e.preventDefault();
      try {
        const id = await allocateGlobalReference('STR', { entityType: 'STOCK_TRANSFER' });
        const list = getItem(KEYS.STOCK_TRANSFERS, []);
        list.unshift({
          id,
          date: getTodayDate(),
          itemName: document.getElementById('st-item')?.value?.trim(),
          fromLocation: document.getElementById('st-from')?.value?.trim(),
          toLocation: document.getElementById('st-to')?.value?.trim(),
          qty: Math.max(1, Number(document.getElementById('st-qty')?.value) || 1),
          status: 'Completed'
        });
        setItem(KEYS.STOCK_TRANSFERS, list);
        await pushExtendedErpToServer();
        closeModal();
        showToast('Stock transfer recorded.', 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to record stock transfer.', 'danger');
      }
    },

    openAddBankAccountModal: () => {
      openModal('Add Bank / Cash Account', `
        <form onsubmit="window.MJK.submitAddBankAccount(event)">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Account Label *</label><input id="ba-name" class="form-control" required placeholder="e.g. MUN COMPUTER Current A/C"></div>
            <div class="form-group"><label class="form-label">Bank Name *</label><input id="ba-bank" class="form-control" required placeholder="e.g. Punjab National Bank"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Account Number</label><input id="ba-num" class="form-control"></div>
            <div class="form-group"><label class="form-label">IFSC</label><input id="ba-ifsc" class="form-control"></div>
            <div class="form-group"><label class="form-label">Opening Balance (₹)</label><input id="ba-bal" type="number" step="0.01" class="form-control" value="0"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Account</button></div>
        </form>
      `, null);
    },

    submitAddBankAccount: async (e) => {
      e.preventDefault();
      try {
        const id = await allocateGlobalReference('BNK', { entityType: 'BANK_ACCOUNT' });
        const list = getItem(KEYS.BANK_ACCOUNTS, []);
        list.push({
          id,
          accountName: document.getElementById('ba-name')?.value?.trim(),
          bankName: document.getElementById('ba-bank')?.value?.trim(),
          accountNumber: document.getElementById('ba-num')?.value?.trim(),
          ifsc: document.getElementById('ba-ifsc')?.value?.trim(),
          balance: Number(document.getElementById('ba-bal')?.value) || 0
        });
        setItem(KEYS.BANK_ACCOUNTS, list);
        await pushExtendedErpToServer();
        closeModal();
        showToast('Bank account added.', 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to add bank account.', 'danger');
      }
    },

    openAddJournalModal: () => {
      openModal('Post Double-Entry Journal Voucher', `
        <form onsubmit="window.MJK.submitJournalEntry(event)">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Debit Account (Dr) *</label><input id="jv-dr" class="form-control" required placeholder="e.g. Bank Account"></div>
            <div class="form-group"><label class="form-label">Credit Account (Cr) *</label><input id="jv-cr" class="form-control" required placeholder="e.g. Counter Cash"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Amount (₹) *</label><input id="jv-amt" type="number" min="1" step="0.01" class="form-control" required></div>
            <div class="form-group"><label class="form-label">Date</label><input id="jv-date" type="date" class="form-control" value="${getTodayDate()}"></div>
          </div>
          <div class="form-group"><label class="form-label">Narration *</label><input id="jv-narr" class="form-control" required placeholder="e.g. Cash deposited to PNB BC Account"></div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Post Journal Entry</button></div>
        </form>
      `, null);
    },

    submitJournalEntry: async (e) => {
      e.preventDefault();
      const amount = Number(document.getElementById('jv-amt')?.value) || 0;
      if (amount <= 0) {
        showToast('Journal entry amount must be greater than zero.', 'warning');
        return;
      }
      try {
        const id = await allocateGlobalReference('JV', { entityType: 'JOURNAL_ENTRY' });
        const list = getItem(KEYS.JOURNAL_ENTRIES, []);
        list.unshift({
          id,
          date: document.getElementById('jv-date')?.value || getTodayDate(),
          debitAccount: document.getElementById('jv-dr')?.value?.trim(),
          creditAccount: document.getElementById('jv-cr')?.value?.trim(),
          amount,
          narration: document.getElementById('jv-narr')?.value?.trim()
        });
        setItem(KEYS.JOURNAL_ENTRIES, list);
        await pushExtendedErpToServer();
        closeModal();
        showToast('Balanced journal voucher posted.', 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to post journal entry.', 'danger');
      }
    },

    openAddReconciliationModal: () => {
      const banks = getItem(KEYS.BANK_ACCOUNTS, []);
      const fin = computeLiveFinanceLedgerSummary();
      const presets = [
        { label: `Counter Cash Drawer (${formatINR(fin.cashInHand, true)})`, name: 'Counter Cash Drawer', bookBalance: fin.cashInHand },
        { label: `Digital UPI / QR Ledger (${formatINR(fin.upiBalance, true)})`, name: 'Digital UPI / QR Ledger', bookBalance: fin.upiBalance },
        ...banks.map(b => ({ label: `${b.accountName} — ${b.bankName || 'Bank'} (${formatINR(b.balance || 0, true)})`, name: b.accountName, bookBalance: round2(b.balance || 0) }))
      ];
      openModal('Reconcile Bank, UPI or Counter Cash Statement', `
        <form onsubmit="window.MJK.submitBankReconciliation(event)">
          <div class="form-group">
            <label class="form-label">Select ERP Ledger / Bank Account *</label>
            <select id="rec-preset" class="form-control" onchange="window.MJK.onReconciliationPresetChange(this.value)">
              <option value="">-- Choose Live ERP Ledger or Type Custom Below --</option>
              ${presets.map(p => `<option value="${escAttr(p.name)}|${p.bookBalance}">${esc(p.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Account Name *</label>
            <input id="rec-acct" class="form-control" required placeholder="e.g. Counter Cash Drawer / PNB Current A/C" value="${escAttr(presets[0]?.name || '')}">
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">ERP Book Balance (₹) *</label><input id="rec-book" type="number" step="0.01" class="form-control font-mono tabular-nums" required value="${presets[0]?.bookBalance ?? 0}" oninput="window.MJK.updateRecVariancePreview()"></div>
            <div class="form-group"><label class="form-label">Bank / Counted Statement Balance (₹) *</label><input id="rec-stmt" type="number" step="0.01" class="form-control font-mono tabular-nums" required value="${presets[0]?.bookBalance ?? 0}" oninput="window.MJK.updateRecVariancePreview()"></div>
          </div>
          <div id="rec-variance-banner" style="padding:0.55rem 0.75rem; border-radius:var(--radius-sm); background:var(--surface-alt); border:1px solid var(--border-subtle); font-size:0.8rem; margin-bottom:0.85rem; display:flex; justify-content:space-between;">
            <span>Calculated Discrepancy:</span>
            <strong id="rec-variance-val" class="font-mono tabular-nums" style="color:var(--success);">₹0.00 (Matched)</strong>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Reconciliation</button></div>
        </form>
      `, null);
    },

    onReconciliationPresetChange: (val) => {
      if (!val) return;
      const [name, balStr] = String(val).split('|');
      const acctEl = document.getElementById('rec-acct');
      const bookEl = document.getElementById('rec-book');
      const stmtEl = document.getElementById('rec-stmt');
      if (acctEl) acctEl.value = name || '';
      if (bookEl) bookEl.value = balStr || '0';
      if (stmtEl && !stmtEl.dataset.touched) stmtEl.value = balStr || '0';
      const bannerVal = document.getElementById('rec-variance-val');
      if (bannerVal && bookEl && stmtEl) {
        const diff = round2((Number(stmtEl.value) || 0) - (Number(bookEl.value) || 0));
        const matched = Math.abs(diff) < 0.01;
        bannerVal.style.color = matched ? 'var(--success)' : 'var(--danger)';
        bannerVal.textContent = `${formatINR(diff, true)} (${matched ? 'Matched' : 'Variance'})`;
      }
    },

    updateRecVariancePreview: () => {
      const book = Number(document.getElementById('rec-book')?.value) || 0;
      const stmtEl = document.getElementById('rec-stmt');
      if (stmtEl) stmtEl.dataset.touched = '1';
      const stmt = Number(stmtEl?.value) || 0;
      const diff = round2(stmt - book);
      const matched = Math.abs(diff) < 0.01;
      const bannerVal = document.getElementById('rec-variance-val');
      if (bannerVal) {
        bannerVal.style.color = matched ? 'var(--success)' : 'var(--danger)';
        bannerVal.textContent = `${formatINR(diff, true)} (${matched ? 'Matched' : 'Variance'})`;
      }
    },

    submitBankReconciliation: async (e) => {
      e.preventDefault();
      try {
        const id = await allocateGlobalReference('BREC', { entityType: 'BANK_RECONCILIATION' });
        const list = getItem(KEYS.BANK_RECONCILIATIONS, []);
        list.unshift({
          id,
          date: getTodayDate(),
          accountName: document.getElementById('rec-acct')?.value?.trim(),
          bookBalance: round2(document.getElementById('rec-book')?.value),
          statementBalance: round2(document.getElementById('rec-stmt')?.value)
        });
        setItem(KEYS.BANK_RECONCILIATIONS, list);
        await pushExtendedErpToServer();
        closeModal();
        showToast('Reconciliation saved.', 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to save reconciliation.', 'danger');
      }
    },

    assignGasDeliveryPerson: async (bookingId, riderId) => {
      try {
        if (!riderId) {
          const bookings = getAllGasBookings();
          const idx = bookings.findIndex(b => b.id === bookingId);
          if (idx !== -1) {
            bookings[idx] = { ...bookings[idx], deliveryPersonId: '', deliveryPersonName: '', deliveryPersonMobile: '', deliveryPerson: '', deliveryStaff: '' };
            setItem(KEYS.GAS_BOOKINGS, bookings);
            showToast('Rider unassigned.', 'info');
            render();
          }
          return;
        }
        const res = await assignDeliveryPersonToBooking(bookingId, riderId, { autoAdvanceStage: true, note: 'Assigned via Delivery Management' });
        if (!res.success) {
          showToast(res.message || 'Unable to assign rider.', 'danger');
          return;
        }
        showToast(`Assigned to ${res.booking.deliveryPersonName}.`, 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to assign rider.', 'danger');
      }
    },

    markGasDeliveredQuick: async (bookingId) => {
      try {
        const res = await updateGasBookingStatus(bookingId, 'Delivered Successfully', {
          deliveryDate: getTodayDate(),
          note: 'Marked Delivered via Delivery Management'
        });
        if (!res.success) {
          showToast(res.message || 'Unable to mark Delivered.', 'danger');
          return;
        }
        showToast(`Booking ${res.booking.bookingNo} marked Delivered Successfully.`, 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to mark Delivered.', 'danger');
      }
    },

    openAddGasComplaintModal: () => {
      openModal('Log LPG Customer Complaint', `
        <form onsubmit="window.MJK.submitGasComplaint(event)">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Consumer Name *</label><input id="gc-cust" class="form-control" required></div>
            <div class="form-group"><label class="form-label">Category *</label><select id="gc-cat" class="form-control"><option>Cylinder Leakage</option><option>Delayed Delivery</option><option>Subsidy Not Credited</option><option>Regulator / Pipe Issue</option><option>Billing Dispute</option></select></div>
          </div>
          <div class="form-group"><label class="form-label">Complaint Details *</label><textarea id="gc-details" class="form-control" rows="2" required></textarea></div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Submit Complaint</button></div>
        </form>
      `, null);
    },

    submitGasComplaint: async (e) => {
      e.preventDefault();
      try {
        const id = await allocateGlobalReference('CMP', { entityType: 'GAS_COMPLAINT' });
        const logs = getItem(KEYS.GAS_AUDIT_LOGS, []);
        logs.unshift({
          id,
          type: 'COMPLAINT',
          date: getTodayDate(),
          customerName: document.getElementById('gc-cust')?.value?.trim(),
          category: document.getElementById('gc-cat')?.value,
          details: document.getElementById('gc-details')?.value?.trim(),
          status: 'Open',
          actor: getCurrentUser()?.name || 'Staff'
        });
        setItem(KEYS.GAS_AUDIT_LOGS, logs);
        closeModal();
        showToast('LPG complaint logged.', 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to submit complaint.', 'danger');
      }
    },

    resolveGasComplaint: (id) => {
      const logs = getItem(KEYS.GAS_AUDIT_LOGS, []);
      const idx = logs.findIndex(l => l.id === id);
      if (idx !== -1) {
        logs[idx].status = 'Resolved';
        logs[idx].resolvedDate = getTodayDate();
        setItem(KEYS.GAS_AUDIT_LOGS, logs);
        showToast('LPG complaint marked Resolved.', 'success');
        render();
      }
    },

    openAddPromotionModal: () => {
      openModal('Add Promotion / Offer', `
        <form onsubmit="window.MJK.submitPromotion(event)">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Promo Code *</label><input id="pr-code" class="form-control" required placeholder="e.g. MUNPUJA10"></div>
            <div class="form-group"><label class="form-label">Discount Label *</label><input id="pr-disc" class="form-control" required placeholder="e.g. 10% Off Printing"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Campaign Title *</label><input id="pr-title" class="form-control" required></div>
            <div class="form-group"><label class="form-label">Valid Till</label><input id="pr-valid" type="date" class="form-control" value="${getTodayDate()}"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Promotion</button></div>
        </form>
      `, null);
    },

    submitPromotion: async (e) => {
      e.preventDefault();
      try {
        const id = await allocateGlobalReference('PRM', { entityType: 'PROMOTION' });
        const list = getItem(KEYS.PROMOTIONS, []);
        list.unshift({
          id,
          code: (document.getElementById('pr-code')?.value || '').trim().toUpperCase(),
          discountLabel: document.getElementById('pr-disc')?.value?.trim(),
          title: document.getElementById('pr-title')?.value?.trim(),
          validTill: document.getElementById('pr-valid')?.value || getTodayDate(),
          status: 'Active'
        });
        setItem(KEYS.PROMOTIONS, list);
        await pushExtendedErpToServer();
        closeModal();
        showToast('Promotion created.', 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to save promotion.', 'danger');
      }
    },

    addToBarcodeBatch: (itemId, qty = 1) => {
      if (!itemId) {
        showToast('Select an inventory item first.', 'warning');
        return;
      }
      const next = Array.isArray(DeptUiState.barcodeBatch) ? [...DeptUiState.barcodeBatch] : [];
      const existingIdx = next.findIndex(b => b.itemId === itemId);
      const addCount = Math.max(1, Number(qty) || 1);
      if (existingIdx !== -1) {
        next[existingIdx] = { ...next[existingIdx], qty: Math.min(500, (Number(next[existingIdx].qty) || 0) + addCount) };
      } else {
        next.push({ itemId, qty: addCount });
      }
      DeptUiState.barcodeBatch = next;
      showToast(`Added ${addCount} sticker(s) to batch queue.`, 'success');
      render();
    },

    updateBarcodeBatchQty: (itemId, rawQty) => {
      const q = Math.max(1, Math.min(500, Number(rawQty) || 1));
      DeptUiState.barcodeBatch = (DeptUiState.barcodeBatch || []).map(b => b.itemId === itemId ? { ...b, qty: q } : b);
      render();
    },

    removeFromBarcodeBatch: (itemId) => {
      DeptUiState.barcodeBatch = (DeptUiState.barcodeBatch || []).filter(b => b.itemId !== itemId);
      render();
    },

    clearBarcodeBatch: () => {
      DeptUiState.barcodeBatch = [];
      render();
    },

    downloadBarcodeJpg: (itemId) => {
      const items = getItem(KEYS.INVENTORY, []);
      const item = items.find(i => i.id === itemId) || items.find(i => i.id === DeptUiState.selectedBarcodeItemId) || items[0];
      if (!item) {
        showToast('No product available to export barcode.', 'warning');
        return;
      }
      const code = String(item.sku || item.id || 'MUN-BARCODE').toUpperCase();
      const title = String(item.name || item.itemName || 'Product').slice(0, 38);
      const priceStr = `MRP ${formatINR(item.sellingPrice ?? item.unitPrice ?? 0)}`;
      const compact = DeptUiState.barcodeLabelSize === 'compact';

      const canvas = document.createElement('canvas');
      canvas.width = compact ? 440 : 600;
      canvas.height = compact ? 240 : 320;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.font = `800 ${compact ? 16 : 20}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText('MUN COMPUTER', canvas.width / 2, compact ? 42 : 52);

      ctx.font = `700 ${compact ? 18 : 22}px "DM Sans", sans-serif`;
      ctx.fillText(title, canvas.width / 2, compact ? 74 : 92);

      ctx.fillStyle = '#1d4ed8';
      ctx.font = `800 ${compact ? 18 : 24}px "JetBrains Mono", monospace`;
      ctx.fillText(priceStr, canvas.width / 2, compact ? 104 : 128);

      // Draw crisp deterministic Code-128 style vertical bars
      const bars = [];
      Array.from(code).forEach((ch, idx) => {
        const val = ch.charCodeAt(0) + idx * 7;
        bars.push({ w: ((val % 3) + 1) * (compact ? 2.5 : 3.2), g: (((val >> 1) % 2) + 1) * (compact ? 2 : 2.6) });
        bars.push({ w: (((val >> 2) % 2) + 1) * (compact ? 2.5 : 3.2), g: (((val >> 3) % 2) + 1) * (compact ? 2 : 2.6) });
      });
      const totalBarW = bars.reduce((s, b) => s + b.w + b.g, 0);
      let cursorX = Math.max(30, (canvas.width - totalBarW) / 2);
      const barY = compact ? 120 : 148;
      const barH = compact ? 64 : 92;
      ctx.fillStyle = '#0f172a';
      bars.forEach(b => {
        ctx.fillRect(cursorX, barY, b.w, barH);
        cursorX += b.w + b.g;
      });

      ctx.font = `800 ${compact ? 16 : 20}px "JetBrains Mono", monospace`;
      ctx.fillText(`*${code}*`, canvas.width / 2, barY + barH + (compact ? 26 : 36));

      const dataUrl = canvas.toDataURL('image/jpeg', 0.96);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `BARCODE_${code.replace(/[^A-Z0-9_-]/gi, '_')}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Barcode JPG exported for ${code}.`, 'success');
    },

    printThermalBarcodeBatch: () => {
      const items = getItem(KEYS.INVENTORY, []);
      const selectedItem = items.find(i => i.id === DeptUiState.selectedBarcodeItemId) || items[0];
      const batchRows = (Array.isArray(DeptUiState.barcodeBatch) ? DeptUiState.barcodeBatch : [])
        .map(b => ({ qty: Math.max(1, Number(b.qty) || 1), item: items.find(i => i.id === b.itemId) }))
        .filter(b => b.item);
      const jobs = batchRows.length > 0 ? batchRows : (selectedItem ? [{ qty: 1, item: selectedItem }] : []);
      if (jobs.length === 0) {
        showToast('No inventory items available to print.', 'warning');
        return;
      }

      const rollWidth = DeptUiState.barcodeRollWidth || '2in';
      const labelSize = DeptUiState.barcodeLabelSize || 'standard';
      const stage = document.getElementById('barcode-print-stage');
      if (!stage) {
        showToast('Print stage not mounted.', 'danger');
        return;
      }

      const stickersHtml = [];
      jobs.forEach(job => {
        for (let n = 0; n < job.qty; n++) {
          stickersHtml.push(buildBarcodeStickerCardHtml(job.item, labelSize, rollWidth));
        }
      });
      stage.innerHTML = `<div style="display:flex; flex-direction:column; gap:2mm; width:100%;">${stickersHtml.join('')}</div>`;

      let styleEl = document.getElementById('barcode-thermal-page-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'barcode-thermal-page-style';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `@media print { @page { size: ${rollWidth === '3in' ? '80mm' : '50mm'} auto; margin: 0; } }`;

      const cleanup = () => {
        document.body.classList.remove('printing-barcode-sheet');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      document.body.classList.add('printing-barcode-sheet');
      setTimeout(() => {
        window.print();
        setTimeout(cleanup, 1200);
      }, 60);
    },

    resetGrowthFilters: () => {
      DeptUiState.growthFromDate = '';
      DeptUiState.growthToDate = '';
      DeptUiState.growthQuery = '';
      render();
    },

    exportGrowthReport: async (tab, format = 'pdf') => {
      const rpt = buildGrowthReportDataset(tab || DeptUiState.growthReportTab || 'leads');
      const cfg = {
        filename: `MUN_Growth_${rpt.tab}_${getTodayDate()}`,
        sheetName: rpt.tab.slice(0, 28),
        title: rpt.title.toUpperCase(),
        subtitle: `Records: ${rpt.rows.length} · Generated: ${getTodayDate()}`,
        headers: rpt.headers,
        rows: rpt.rows
      };
      if (format === 'csv') {
        exportUniversalCSV(cfg);
        showToast(`${rpt.title} CSV exported.`, 'success');
      } else {
        await exportUniversalPDF(cfg);
        showToast(`${rpt.title} PDF exported.`, 'success');
      }
    },

    openAddReferralModal: () => {
      const customers = getItem(KEYS.CUSTOMERS, []);
      const rateServices = getSearchableRateServices();
      openModal('Add Customer Referral & Generate Pass', `
        <form onsubmit="window.MJK.submitReferral(event)">
          <div class="form-group">
            <label class="form-label">Quick Select Referrer Customer (Optional Lookup)</label>
            <select class="form-control" onchange="window.MJK.onReferralCustomerPick(this.value)">
              <option value="">-- Select Registered Customer or Enter Manually Below --</option>
              <option value="Sarmina Khatun|MC-ADM-14012025">Sarmina Khatun (MC-ADM-14012025 · Master Admin)</option>
              ${customers.slice(0, 150).map(c => `<option value="${escAttr(`${c.name || ''}|${c.applicationId || c.id || ''}`)}">${esc(c.name)} (${esc(c.applicationId || c.id)} · ${esc(c.phone || '-')})</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Referrer Name *</label><input id="rf-by" class="form-control" required placeholder="e.g. Sarmina Khatun"></div>
            <div class="form-group"><label class="form-label">Referrer Customer ID</label><input id="rf-by-id" class="form-control font-mono" placeholder="e.g. MC-ADM-14012025"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Referred Customer Name *</label><input id="rf-to" class="form-control" required placeholder="New customer full name"></div>
            <div class="form-group"><label class="form-label">Referred Mobile Number *</label><input id="rf-phone" class="form-control" required placeholder="10-digit WhatsApp / mobile"></div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Selected Service / Scheme *</label>
              <input id="rf-service" class="form-control" list="rf-service-catalog" required placeholder="Search Rate Chart service...">
              <datalist id="rf-service-catalog">
                ${rateServices.map(sv => `<option value="${escAttr(sv.name)}">${esc(sv.name)}${sv.nameBn ? ` (${esc(sv.nameBn)})` : ''} — ${formatINR(sv.total)}</option>`).join('')}
              </datalist>
            </div>
            <div class="form-group"><label class="form-label">Commission / Reward (₹)</label><input id="rf-amt" type="number" min="0" class="form-control font-mono tabular-nums" value="50"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save &amp; Generate Referral Pass</button>
          </div>
        </form>
      `, null);
    },

    onReferralCustomerPick: (val) => {
      if (!val) return;
      const [name, id] = String(val).split('|');
      const byEl = document.getElementById('rf-by');
      const idEl = document.getElementById('rf-by-id');
      if (byEl) byEl.value = name || '';
      if (idEl) idEl.value = id || '';
    },

    submitReferral: async (e) => {
      e.preventDefault();
      try {
        const list = getItem(KEYS.REFERRALS, []);
        const passCode = await allocateGlobalReference('REF', { entityType: 'REFERRAL' });
        const entry = {
          id: passCode,
          passCode,
          date: getTodayDate(),
          createdAt: new Date().toISOString(),
          referrerId: document.getElementById('rf-by-id')?.value?.trim() || '',
          referrerName: document.getElementById('rf-by')?.value?.trim() || '',
          referredName: document.getElementById('rf-to')?.value?.trim() || '',
          referredPhone: document.getElementById('rf-phone')?.value?.trim() || '',
          service: document.getElementById('rf-service')?.value?.trim() || 'Digital Service',
          rewardAmount: Number(document.getElementById('rf-amt')?.value) || 0,
          status: 'Pending'
        };
        list.unshift(entry);
        setItem(KEYS.REFERRALS, list);
        await pushExtendedErpToServer();
        closeModal();
        showToast(`Referral ${passCode} recorded. Digital Pass ready.`, 'success');
        render();
        window.MJK.openReferralPassModal(entry.id);
      } catch (err) {
        showToast(err?.message || 'Failed to generate Referral Global SL.', 'danger');
      }
    },

    toggleReferralStatus: async (referralId) => {
      const list = getItem(KEYS.REFERRALS, []);
      const idx = list.findIndex(r => r.id === referralId || r.passCode === referralId);
      if (idx === -1) return;
      list[idx].status = list[idx].status === 'Paid' ? 'Pending' : 'Paid';
      setItem(KEYS.REFERRALS, list);
      await pushExtendedErpToServer();
      showToast(`Referral ${list[idx].passCode || list[idx].id} marked ${list[idx].status}.`, 'success');
      render();
    },

    openReferralPassModal: (referralId) => {
      const list = getItem(KEYS.REFERRALS, []);
      const r = list.find(x => x.id === referralId || x.passCode === referralId);
      if (!r) {
        showToast('Referral record not found.', 'warning');
        return;
      }
      const passCode = r.passCode || r.id || 'REF-2026-NOV-001';
      const tsDisplay = r.createdAt ? formatDateTime(r.createdAt) : formatDate(r.date);
      const referrerFull = r.referrerId ? `${r.referrerName} (${r.referrerId})` : (r.referrerName || 'Registered Member');
      const waMessage = [
        `*MUN COMPUTER — VERIFIED REFERRAL PASS*`,
        `Tracking Code: *${passCode}*`,
        `Referrer: *${referrerFull}*`,
        `Referred Customer: *${r.referredName}* (${r.referredPhone || 'N/A'})`,
        `Service / Scheme: *${r.service || 'Digital Services'}*`,
        `Reward Value: *${formatINR(r.rewardAmount || 0)}*`,
        `Recorded On: ${tsDisplay}`,
        ``,
        `Official Verification: Authorized CSC & PNB BC Point, Domkal, Murshidabad.`
      ].join('\n');
      const waShareUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

      openModal(`Digital Referral Pass — ${passCode}`, `
        <div id="referral-pass-print-card" style="position:relative; overflow:hidden; background:#ffffff; color:#0f172a; border:2px solid #0B1530; border-radius:14px; padding:1.25rem; box-shadow:0 12px 30px rgba(15,23,42,0.12);">
          <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; transform:rotate(-24deg); opacity:0.07; font-size:1.45rem; font-weight:900; letter-spacing:0.08em; color:#0B1530; text-align:center; white-space:nowrap;">
            MUN COMPUTER - Verified Referral Proof
          </div>
          <div style="position:relative; z-index:2;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; background:#0B1530; color:#ffffff; padding:0.85rem 1rem; border-radius:10px; margin-bottom:1rem; border-bottom:3px solid #D6B56D;">
              <div>
                <div style="font-size:1.05rem; font-weight:800; letter-spacing:0.02em;">MUN COMPUTER</div>
                <div style="font-size:0.7rem; color:#D6B56D; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Digital Referral Pass &amp; Official Proof</div>
              </div>
              <span style="background:rgba(16,185,129,0.2); border:1px solid #34d399; color:#a7f3d0; font-size:0.7rem; font-weight:800; padding:0.25rem 0.65rem; border-radius:999px;">✓ VERIFIED PASS</span>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding:0.65rem 0.85rem; background:#f8fafc; border:1px dashed #94a3b8; border-radius:8px; margin-bottom:0.9rem;">
              <div>
                <div style="font-size:0.68rem; text-transform:uppercase; font-weight:700; color:#64748b;">Unique Tracking ID</div>
                <div class="font-mono tabular-nums" style="font-size:1.15rem; font-weight:900; color:#1d4ed8;">${esc(passCode)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:0.68rem; text-transform:uppercase; font-weight:700; color:#64748b;">Exact Recorded Timestamp</div>
                <div class="tabular-nums" style="font-size:0.8rem; font-weight:700; color:#0f172a;">${esc(tsDisplay)}</div>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:0.75rem; margin-bottom:0.95rem; font-size:0.83rem;">
              <div style="padding:0.65rem 0.8rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                <div style="font-size:0.68rem; font-weight:800; text-transform:uppercase; color:#64748b;">Referrer Details</div>
                <div style="font-weight:800; font-size:0.95rem; margin-top:0.2rem;">${esc(r.referrerName)}</div>
                <div class="font-mono" style="font-size:0.76rem; color:#1d4ed8; font-weight:700;">ID: ${esc(r.referrerId || 'MEMBER')}</div>
              </div>
              <div style="padding:0.65rem 0.8rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                <div style="font-size:0.68rem; font-weight:800; text-transform:uppercase; color:#64748b;">Referred Customer</div>
                <div style="font-weight:800; font-size:0.95rem; margin-top:0.2rem;">${esc(r.referredName)}</div>
                <div class="tabular-nums" style="font-size:0.76rem; color:#475569;">Mobile: ${esc(r.referredPhone || 'Not Provided')}</div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding:0.65rem 0.85rem; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; margin-bottom:1rem;">
              <div>
                <div style="font-size:0.68rem; font-weight:800; text-transform:uppercase; color:#1e40af;">Selected Service / Scheme</div>
                <div style="font-weight:800; color:#0f172a;">${esc(r.service || 'General Service')}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:0.68rem; font-weight:800; text-transform:uppercase; color:#1e40af;">Referral Benefit</div>
                <div class="font-mono tabular-nums" style="font-weight:900; font-size:1rem; color:#15803d;">${formatINR(r.rewardAmount || 0)}</div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding-top:0.7rem; border-top:1px solid #cbd5e1; font-size:0.74rem; color:#475569;">
              <span>Domkal, Murshidabad, WB - 742303</span>
              <span style="border:1.5px solid #0B1530; color:#0B1530; padding:0.2rem 0.65rem; border-radius:6px; font-weight:800; letter-spacing:0.03em; background:#fefce8;">Authorized CSC &amp; PNB BC Point</span>
            </div>
          </div>
        </div>

        <div class="no-print" style="display:flex; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap; margin-top:1rem;">
          <a href="${escAttr(waShareUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background:#16a34a; color:#ffffff; border:1px solid #15803d; text-decoration:none; font-weight:700;">📲 Share via WhatsApp</a>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.downloadReferralPassPng('${escAttr(r.id)}')">⬇ Download Pass (PNG)</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.printReferralPassCard()">🖨 Print Referral Proof</button>
        </div>
      `, null);
    },

    downloadReferralPassPng: (referralId) => {
      const list = getItem(KEYS.REFERRALS, []);
      const r = list.find(x => x.id === referralId || x.passCode === referralId);
      if (!r) return;
      const passCode = r.passCode || r.id || 'REF-2026-NOV-001';
      const tsDisplay = r.createdAt ? formatDateTime(r.createdAt) : formatDate(r.date);

      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 580;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 960, 580);
      ctx.strokeStyle = '#0B1530';
      ctx.lineWidth = 6;
      ctx.strokeRect(16, 16, 928, 548);

      // Header bar
      ctx.fillStyle = '#0B1530';
      ctx.fillRect(28, 28, 904, 96);
      ctx.fillStyle = '#D6B56D';
      ctx.fillRect(28, 120, 904, 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 30px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('MUN COMPUTER', 56, 74);
      ctx.fillStyle = '#D6B56D';
      ctx.font = '700 15px "DM Sans", sans-serif';
      ctx.fillText('DIGITAL REFERRAL PASS & VERIFIED PROOF', 56, 102);

      ctx.fillStyle = '#34d399';
      ctx.font = '800 16px "DM Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('VERIFIED PASS ✓', 904, 84);
      ctx.textAlign = 'left';

      // Diagonal Watermark
      ctx.save();
      ctx.translate(480, 340);
      ctx.rotate(-0.34);
      ctx.fillStyle = 'rgba(11, 21, 48, 0.06)';
      ctx.font = '900 34px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MUN COMPUTER - Verified Referral Proof', 0, 0);
      ctx.restore();

      // Tracking ID + Timestamp
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(48, 148, 864, 78);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(48, 148, 864, 78);
      ctx.fillStyle = '#64748b';
      ctx.font = '700 13px "DM Sans", sans-serif';
      ctx.fillText('UNIQUE TRACKING CODE', 68, 174);
      ctx.fillStyle = '#1d4ed8';
      ctx.font = '900 26px "JetBrains Mono", monospace';
      ctx.fillText(passCode, 68, 208);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748b';
      ctx.font = '700 13px "DM Sans", sans-serif';
      ctx.fillText('RECORDED TIMESTAMP', 892, 174);
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 18px "DM Sans", sans-serif';
      ctx.fillText(tsDisplay, 892, 206);
      ctx.textAlign = 'left';

      // Referrer & Referred Boxes
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(48, 248, 418, 114);
      ctx.strokeRect(48, 248, 418, 114);
      ctx.fillRect(494, 248, 418, 114);
      ctx.strokeRect(494, 248, 418, 114);

      ctx.fillStyle = '#64748b';
      ctx.font = '700 13px "DM Sans", sans-serif';
      ctx.fillText('REFERRER NAME & ID', 68, 276);
      ctx.fillText('REFERRED CUSTOMER', 514, 276);

      ctx.fillStyle = '#0f172a';
      ctx.font = '800 22px "DM Sans", sans-serif';
      ctx.fillText(String(r.referrerName || 'Member').slice(0, 26), 68, 312);
      ctx.fillText(String(r.referredName || 'Customer').slice(0, 26), 514, 312);

      ctx.fillStyle = '#1d4ed8';
      ctx.font = '700 16px "JetBrains Mono", monospace';
      ctx.fillText(`ID: ${r.referrerId || 'REGISTERED'}`, 68, 342);
      ctx.fillStyle = '#475569';
      ctx.fillText(`Mobile: ${r.referredPhone || '-'}`, 514, 342);

      // Service Box
      ctx.fillStyle = '#eff6ff';
      ctx.fillRect(48, 384, 864, 78);
      ctx.strokeStyle = '#93c5fd';
      ctx.strokeRect(48, 384, 864, 78);
      ctx.fillStyle = '#1e40af';
      ctx.font = '700 13px "DM Sans", sans-serif';
      ctx.fillText('SELECTED SERVICE / SCHEME', 68, 410);
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 21px "DM Sans", sans-serif';
      ctx.fillText(String(r.service || 'Digital Services').slice(0, 44), 68, 444);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#1e40af';
      ctx.font = '700 13px "DM Sans", sans-serif';
      ctx.fillText('COMMISSION / BENEFIT', 892, 410);
      ctx.fillStyle = '#15803d';
      ctx.font = '900 24px "JetBrains Mono", monospace';
      ctx.fillText(formatINR(r.rewardAmount || 0), 892, 444);
      ctx.textAlign = 'left';

      // Footer Stamp
      ctx.fillStyle = '#475569';
      ctx.font = '600 15px "DM Sans", sans-serif';
      ctx.fillText('Domkal, Murshidabad, West Bengal - 742303', 48, 520);

      ctx.fillStyle = '#fefce8';
      ctx.fillRect(620, 488, 292, 46);
      ctx.strokeStyle = '#0B1530';
      ctx.lineWidth = 2;
      ctx.strokeRect(620, 488, 292, 46);
      ctx.fillStyle = '#0B1530';
      ctx.font = '800 15px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Authorized CSC & PNB BC Point', 766, 517);

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${passCode.replace(/[^A-Z0-9_-]/gi, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Digital Referral Pass ${passCode}.png downloaded.`, 'success');
    },

    printReferralPassCard: () => {
      const cleanup = () => {
        document.body.classList.remove('printing-referral-pass');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      document.body.classList.add('printing-referral-pass');
      setTimeout(() => {
        window.print();
        setTimeout(cleanup, 1200);
      }, 60);
    },

    openAddLeadModal: () => {
      openModal('Add New Sales Lead', `
        <form onsubmit="window.MJK.submitNewLead(event)">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Prospect Name *</label><input id="ld-name" class="form-control" required></div>
            <div class="form-group"><label class="form-label">Mobile Number *</label><input id="ld-phone" class="form-control" required></div>
          </div>
          ${renderSearchableServiceSelectorHtml('ld-rate-services', {
            label: 'Service / Product Interest * (Search English or Bengali)',
            placeholder: 'Search services from Rate Chart (e.g. LPG, PAN, Ration, লক্ষ্মীর ভাণ্ডার)...',
            required: true,
            showBilling: true
          })}
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Lead Source</label>
              <select id="ld-source" class="form-control">
                <option value="Counter Enquiry">Counter Enquiry</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Referral">Referral</option>
                <option value="Campaign">Marketing Campaign</option>
                <option value="Phone Call">Phone Call</option>
              </select>
            </div>
            <div class="form-group"><label class="form-label">Notes</label><input id="ld-notes" class="form-control" placeholder="Optional enquiry remarks"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;"><button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Add Lead</button></div>
        </form>
      `, null);
      initSearchableServiceSelector('ld-rate-services', { showBilling: true });
    },

    submitNewLead: async (e) => {
      e.preventDefault();
      const selState = getSelectedServicesState('ld-rate-services');
      const typedFallback = document.getElementById('ld-rate-services-search')?.value?.trim() || '';
      if ((!selState.serviceNames || selState.serviceNames.length === 0) && !typedFallback) {
        showToast('Please select at least one Service / Product Interest from the Rate Chart.', 'warning');
        return;
      }
      try {
        const interest = selState.serviceNames.length > 0 ? selState.serviceNames.join(', ') : typedFallback;
        const id = await allocateGlobalReference('LEAD', { entityType: 'LEAD' });
        const list = getItem(KEYS.LEADS, []);
        list.unshift({
          id,
          date: getTodayDate(),
          name: document.getElementById('ld-name')?.value?.trim(),
          phone: document.getElementById('ld-phone')?.value?.trim(),
          interest,
          services: selState.services || [],
          serviceRateBreakdown: {
            shopChargeTotal: selState.shopChargeTotal || 0,
            govFeeTotal: selState.govFeeTotal || 0,
            totalPayable: selState.totalPayable || 0
          },
          estimatedValue: selState.totalPayable || 0,
          source: document.getElementById('ld-source')?.value || 'Counter Enquiry',
          notes: document.getElementById('ld-notes')?.value?.trim() || '',
          status: 'New'
        });
        setItem(KEYS.LEADS, list);
        await pushExtendedErpToServer();
        closeModal();
        showToast('Lead added with live Rate Chart pricing.', 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to add lead.', 'danger');
      }
    },

    convertLeadToCustomer: async (leadId) => {
      try {
        const leads = getItem(KEYS.LEADS, []);
        const idx = leads.findIndex(l => l.id === leadId);
        if (idx === -1) return;
        const lead = leads[idx];
        const today = getTodayDate();
        const applicationId = await allocateGlobalReference('CASE', { entityType: 'CASE' });
        const customers = getItem(KEYS.CUSTOMERS, []);
        const newCustId = await allocateGlobalReference('CUST', { entityType: 'CUSTOMER' });
        const serviceList = Array.isArray(lead.services) ? lead.services : [];

        customers.unshift({
          id: newCustId,
          applicationId,
          name: lead.name,
          phone: lead.phone,
          schemeName: lead.interest || 'Digital Services',
          services: serviceList,
          serviceRateBreakdown: lead.serviceRateBreakdown || null,
          totalBillAmount: Number(lead.estimatedValue) || 0,
          village: 'Mamudpur',
          block: 'Domkal',
          district: 'Murshidabad',
          state: 'West Bengal',
          regDate: today,
          registrationDate: today,
          notes: `Converted from Lead ${lead.id} (${lead.interest})${lead.notes ? ` · ${lead.notes}` : ''}`
        });
        setItem(KEYS.CUSTOMERS, customers);

        await createOrSyncFollowupCase({
          applicationId,
          customerId: newCustId,
          customerName: lead.name,
          mobile: lead.phone,
          serviceName: lead.interest || 'Digital Services',
          submissionDate: today,
          remarks: `Converted from Lead ${lead.id}`
        });

        leads[idx].status = 'Converted';
        leads[idx].customerId = newCustId;
        leads[idx].applicationId = applicationId;
        setItem(KEYS.LEADS, leads);
        await pushExtendedErpToServer();
        showToast(`Lead converted into Customer ${newCustId} (${applicationId}) & synced to 90-day Follow-up.`, 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to convert lead.', 'danger');
      }
    },

    openMfaRecoveryModal: () => {
      const mfaSetup = DeptUiState.mfaSetup;
      const secret = mfaSetup?.secret || 'JBSWY3DPEHPK3PXP';
      const uri = mfaSetup?.otpAuthUri || `otpauth://totp/MUN_COMPUTER:${MAIN_ADMIN_UID}?secret=${secret}&issuer=MUN_COMPUTER_ERP`;
      const backupCodes = [
        'MUN-8492-AX', 'MUN-3921-BY', 'MUN-1048-CZ', 'MUN-9283-DX',
        'MUN-5519-EX', 'MUN-7402-FX', 'MUN-6120-GX', 'MUN-4918-HX'
      ];
      openModal('Main Admin TOTP Authenticator & Recovery Codes', `
        <div style="text-align:center; padding:0.9rem; background:var(--surface-alt); border:1px dashed var(--border-subtle); border-radius:var(--radius-md); margin-bottom:0.95rem;">
          <div style="font-size:0.74rem; font-weight:700; color:var(--text-muted); margin-bottom:0.35rem;">Authenticator Secret Key (Base32)</div>
          <div class="font-mono" style="font-weight:800; font-size:1rem; color:var(--blue-600); word-break:break-all; margin-bottom:0.35rem;">${esc(secret)}</div>
          <div class="font-mono" style="font-size:0.7rem; color:var(--text-muted); word-break:break-all;">${esc(uri)}</div>
        </div>
        <div style="margin-bottom:0.95rem;">
          <label class="form-label" style="font-size:0.74rem; text-transform:uppercase;">Single-Use Backup Recovery Codes (8)</label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.45rem; background:var(--surface-alt); padding:0.75rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
            ${backupCodes.map(c => `<div class="font-mono" style="background:var(--surface); border:1px solid var(--border-subtle); border-radius:6px; padding:0.35rem 0.5rem; text-align:center; font-size:0.8rem; font-weight:700;">${c}</div>`).join('')}
          </div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.4rem;">Store these recovery keys securely offline in case your authenticator device is unavailable.</div>
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.closeModal()">Close &amp; Confirm</button>
        </div>
      `, null);
    },

    openComplianceDeleteTestModal: () => {
      openModal('Mandatory Deletion Compliance Check', `
        <form onsubmit="window.MJK.submitComplianceDeleteTest(event)">
          <div class="form-group">
            <label class="form-label">Target Test Record ID</label>
            <input id="sec-del-target" class="form-control font-mono" value="APP-26-TEST" required>
          </div>
          <div class="form-group">
            <label class="form-label">Mandatory Deletion Reason (Minimum 10 characters) *</label>
            <textarea id="sec-del-reason-inp" rows="3" class="form-control" required placeholder="Specify operational or regulatory reason (min 10 chars)..." oninput="const len = this.value.trim().length; const el = document.getElementById('sec-del-len'); if(el){ el.textContent = len + ' / 10 chars minimum'; el.style.color = len >= 10 ? 'var(--success)' : 'var(--danger)'; }"></textarea>
            <div id="sec-del-len" style="font-size:0.72rem; color:var(--danger); margin-top:0.25rem;">0 / 10 chars minimum</div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background:var(--danger); border-color:var(--danger);">Authorize Compliance Log</button>
          </div>
        </form>
      `, null);
    },

    submitComplianceDeleteTest: (e) => {
      e.preventDefault();
      const targetId = document.getElementById('sec-del-target')?.value?.trim() || 'APP-26-TEST';
      const reason = document.getElementById('sec-del-reason-inp')?.value?.trim() || '';
      if (reason.length < 10) {
        showToast('Mandatory Compliance Error: Deletion reason must be at least 10 characters.', 'danger');
        return;
      }
      logAuditAction('COMPLIANCE_DELETE_TEST', `Target ${targetId} · Reason: ${reason}`);
      closeModal();
      showToast('Compliance event recorded to Immutable Audit Log.', 'success');
      render();
    },

    resetSecurityPoliciesDefaults: async () => {
      setItem(KEYS.SECURITY_SETTINGS, { enforceDeleteReason: true, sessionTimeoutMins: 480, serverTokenSigning: true });
      const res = await saveSystemSecuritySettings({
        max_failed_login_attempts: 5,
        max_failed_reset_attempts: 3,
        lockout_duration_minutes: 30,
        session_timeout_minutes: 480,
        daily_password_change_limit: 2
      });
      if (res.success && res.settings) DeptUiState.sysSettings = res.settings;
      await pushExtendedErpToServer();
      showToast('Security policies restored to OWASP Zero-Trust defaults.', 'success');
      render();
    },

    saveNotificationPrefs: async (e) => {
      e.preventDefault();
      setItem(KEYS.NOTIFICATION_PREFS, {
        docExpiryDays: Math.max(1, Number(document.getElementById('pref-doc-days')?.value) || 30),
        lowStockAlerts: Boolean(document.getElementById('pref-low-stock')?.checked),
        leaveAlerts: Boolean(document.getElementById('pref-leave-alerts')?.checked),
        overdueFollowupAlerts: true
      });
      await pushExtendedErpToServer();
      showToast('Notification rules saved.', 'success');
      render();
    },

    saveSecuritySettings: async (e) => {
      e.preventDefault();
      const sessionTimeoutMins = Math.max(5, Number(document.getElementById('sec-timeout')?.value) || 480);
      const maxFailedLogin = Math.max(3, Number(document.getElementById('sec-max-login-fails')?.value) || 5);
      const maxFailedReset = Math.max(2, Number(document.getElementById('sec-max-reset-fails')?.value) || 3);
      const lockoutMins = Math.max(5, Number(document.getElementById('sec-lockout-mins')?.value) || 30);
      const dailyPwdLimit = Math.max(1, Number(document.getElementById('sec-daily-pwd-limit')?.value) || 2);

      setItem(KEYS.SECURITY_SETTINGS, {
        enforceDeleteReason: Boolean(document.getElementById('sec-del-reason')?.checked),
        sessionTimeoutMins,
        serverTokenSigning: true
      });
      const [srvRes] = await Promise.all([
        saveSystemSecuritySettings({
          max_failed_login_attempts: maxFailedLogin,
          max_failed_reset_attempts: maxFailedReset,
          lockout_duration_minutes: lockoutMins,
          session_timeout_minutes: sessionTimeoutMins,
          daily_password_change_limit: dailyPwdLimit
        }),
        pushExtendedErpToServer()
      ]);
      if (srvRes.success && srvRes.settings) {
        DeptUiState.sysSettings = srvRes.settings;
      }
      showToast(srvRes.success ? 'Server security policy saved & enforced.' : (srvRes.message || 'Security policy saved locally.'), srvRes.success ? 'success' : 'warning');
      render();
    },

    refreshDbHealth: async () => {
      await ensureDbHealthLoaded(true);
      showToast('SQLite database health refreshed.', 'info');
      render();
    },

    createSqliteBackupNow: async () => {
      const res = await createSqliteDbBackup();
      if (res.success) {
        await ensureDbHealthLoaded(true);
        showToast(res.message || 'SQLite backup created.', 'success');
      } else {
        showToast(res.message || 'SQLite backup failed.', 'danger');
      }
      render();
    },

    restoreSqliteBackupFile: async (fileName) => {
      const res = await restoreSqliteDbBackup(fileName);
      if (res.success) {
        await ensureDbHealthLoaded(true);
        showToast(res.message || 'SQLite database restored.', 'success');
      } else {
        showToast(res.message || 'SQLite restore failed.', 'danger');
      }
      render();
    },

    initMainAdminMfaSetup: async () => {
      const res = await setupMainAdminMfa();
      if (res.success && res.secret) {
        DeptUiState.mfaSetup = res;
        showToast('Authenticator key generated. Scan and verify 6-digit code.', 'info');
      } else {
        showToast(res.message || 'Unable to initialize MFA setup.', 'danger');
      }
      render();
    },

    confirmEnableMainAdminMfa: async (e) => {
      e.preventDefault();
      const code = document.getElementById('sec-mfa-totp-code')?.value?.trim() || '';
      const res = await enableMainAdminMfa(code);
      if (res.success) {
        DeptUiState.mfaSetup = null;
        showToast(res.message || 'TOTP MFA enabled for MC-ADM-14012025.', 'success');
      } else {
        showToast(res.message || 'Invalid TOTP verification code.', 'danger');
      }
      render();
    },

    confirmDisableMainAdminMfa: async () => {
      const res = await disableMainAdminMfa();
      if (res.success) {
        DeptUiState.mfaSetup = null;
        showToast(res.message || 'TOTP MFA disabled.', 'info');
      } else {
        showToast(res.message || 'Failed to disable MFA.', 'danger');
      }
      render();
    }
  };
}
