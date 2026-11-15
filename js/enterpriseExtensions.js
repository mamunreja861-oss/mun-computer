/**
 * enterpriseExtensions.js - Central Authority Modules:
 * 1. Universal Server-Side Search & Pagination (no focus loss)
 * 2. Complete Admin Service Catalog Manager (Add, Edit, Soft Delete, Restore, Audit)
 * 3. Application Workflow with UID/Customer Auto-Fetch & Timeline
 * 4. Murshidabad Master & Domkal Municipality (LGD 273007) 21-Ward Location & Import Verification Center
 * 5. Customer Merge, Real Document Vault Upload/Preview & Administration Recovery Code Issuer
 */

import * as XLSX from 'xlsx';
import { getAuthHeaders, getItem, KEYS, formatDate, formatDateTime, formatINR, numberToWords, syncAmountWords, logAuditAction } from './storage.js';
import { getCurrentUser, isSuperAdmin, can } from './auth.js';
import { removeCatalogService, restoreCatalogService, getServiceStatuses } from './services.js';
import { getAllRateChartItems, getRateChartItemById } from './rateChart.js';
import { getAdminOptionLabels } from './followups.js';
import * as MurshidabadVillageDb from './murshidabadVillageDb.js';
import { resolveWardForApp, formatWardLabel } from './wardVillageMaster.js';
import { exportUniversalCSV, exportUniversalExcel, exportUniversalPDF, printUniversalReport } from './exportUtility.js';

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const escAttr = (v) => esc(v).replace(/'/g, '&#39;');

let toastFn = (msg, type = 'info') => console.log(`[${type}]`, msg);
let modalFn = (title, html, cb) => {};
let closeModalFn = () => {};
let confirmFn = (title, msg, onConfirm) => { if (onConfirm) onConfirm(); };
let renderFn = () => {};

export function registerUiHooks({ showToast, openModal, closeModal, showConfirmDialog, render }) {
  if (showToast) toastFn = showToast;
  if (openModal) modalFn = openModal;
  if (closeModal) closeModalFn = closeModal;
  if (showConfirmDialog) confirmFn = showConfirmDialog;
  if (render) renderFn = render;
}

// ---------------------------------------------------------------------------
// 1. UNIVERSAL SERVER-SIDE SEARCH ENGINE (NEVER LOSES FOCUS)
// ---------------------------------------------------------------------------
const searchState = {
  q: '',
  type: 'all',
  district: '',
  blockOrMunicipality: '',
  status: 'all',
  dateFrom: '',
  dateTo: '',
  sort: 'relevance',
  page: 1,
  limit: 15,
  loading: false,
  error: null,
  data: null
};

let searchTimer = null;

export function renderUniversalSearchView() {
  return `
    <div class="page-header" style="flex-wrap:wrap; gap:1rem;">
      <div>
        <h2 class="page-title">🔍 ERP Search Engine</h2>
        <p class="page-subtitle">
          Search across Applications, Customers, Services, User Requests, Documents, Murshidabad & Domkal Wards/Localities, PIN Codes, and Audit Logs.
        </p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.5rem;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.clearUniversalSearch()">✕ Reset Filters</button>
      </div>
    </div>

    <div class="card" style="padding:1.1rem; margin-bottom:1rem; border:1px solid var(--border-subtle); background:var(--surface);">
      <div style="display:flex; gap:0.55rem; flex-wrap:wrap; align-items:center;">
        <input
          type="text"
          id="central-universal-search-input"
          class="form-control"
          style="flex:1; min-width:min(100%, 260px); height:42px; font-size:0.9rem;"
          placeholder="Search UID, Request ID, App ID, Name, Mobile (+91), Aadhaar last 4, Block, GP, Municipality, Ward, Village, PIN..."
          value="${esc(searchState.q)}"
          oninput="window.MJK.onUniversalSearchInput(this.value)"
          onkeydown="if(event.key==='Enter'){event.preventDefault();window.MJK.runUniversalSearchNow();}"
          autocomplete="off"
        >
        <button type="button" class="btn btn-primary" style="height:42px;" onclick="window.MJK.runUniversalSearchNow()">
          🔍 Search
        </button>
        <button type="button" class="btn btn-secondary" style="height:42px;" onclick="window.MJK.clearUniversalSearch()">
          Clear
        </button>
      </div>

      <!-- Advanced Filters Row -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:0.55rem; margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid var(--border-subtle);">
        <div>
          <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">District</label>
          <input type="text" id="us-filter-district" class="form-control" style="height:34px; font-size:0.8rem;" placeholder="e.g. Murshidabad" value="${esc(searchState.district)}" onchange="window.MJK.updateUniversalFilter('district', this.value)">
        </div>
        <div>
          <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">Block / Municipality</label>
          <input type="text" id="us-filter-block" class="form-control" style="height:34px; font-size:0.8rem;" placeholder="e.g. Domkal" value="${esc(searchState.blockOrMunicipality)}" onchange="window.MJK.updateUniversalFilter('blockOrMunicipality', this.value)">
        </div>
        <div>
          <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">Status</label>
          <select id="us-filter-status" class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.updateUniversalFilter('status', this.value)">
            <option value="all" ${searchState.status === 'all' ? 'selected' : ''}>All Statuses</option>
            <option value="ACTIVE" ${searchState.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
            <option value="PENDING_APPROVAL" ${searchState.status === 'PENDING_APPROVAL' ? 'selected' : ''}>PENDING_APPROVAL</option>
            <option value="PENDING_VERIFICATION" ${searchState.status === 'PENDING_VERIFICATION' ? 'selected' : ''}>PENDING_VERIFICATION</option>
            <option value="VERIFIED" ${searchState.status === 'VERIFIED' ? 'selected' : ''}>VERIFIED</option>
            <option value="Completed" ${searchState.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Pending" ${searchState.status === 'Pending' ? 'selected' : ''}>Pending</option>
          </select>
        </div>
        <div>
          <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">Sort Order</label>
          <select id="us-filter-sort" class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.updateUniversalFilter('sort', this.value)">
            <option value="relevance" ${searchState.sort === 'relevance' ? 'selected' : ''}>Relevance</option>
            <option value="newest" ${searchState.sort === 'newest' ? 'selected' : ''}>Newest First</option>
            <option value="oldest" ${searchState.sort === 'oldest' ? 'selected' : ''}>Oldest First</option>
            <option value="name" ${searchState.sort === 'name' ? 'selected' : ''}>Alphabetical (A-Z)</option>
          </select>
        </div>
      </div>

      <!-- Entity Type Filter Tabs -->
      <div id="universal-search-tabs" style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-top:0.75rem;">
        ${['all', 'customers', 'receipts', 'inventory', 'applications', 'services', 'users', 'documents', 'locations', 'audit']
          .map(
            (t) => `
          <button type="button" class="btn btn-sm ${searchState.type === t ? 'btn-primary' : 'btn-outline'}"
            onclick="window.MJK.updateUniversalFilter('type', '${t}')">
            ${t.toUpperCase()}
          </button>`
          )
          .join('')}
      </div>
    </div>

    <div id="universal-search-results-container">
      <div style="padding:2rem; text-align:center; color:var(--text-muted);">Loading ERP search index...</div>
    </div>
  `;
}

export function initUniversalSearchAfterRender() {
  executeUniversalSearch();
}

export function refreshUniversalSearchIfActive() {
  if (document.getElementById('universal-search-results-container')) {
    executeUniversalSearch();
  }
}

export function onUniversalSearchInput(val) {
  searchState.q = val;
  searchState.page = 1;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => executeUniversalSearch(), 220);
}

export function runUniversalSearchNow() {
  clearTimeout(searchTimer);
  const el = document.getElementById('central-universal-search-input');
  if (el) searchState.q = el.value;
  searchState.page = 1;
  executeUniversalSearch();
}

export function clearUniversalSearch() {
  searchState.q = '';
  searchState.type = 'all';
  searchState.district = '';
  searchState.blockOrMunicipality = '';
  searchState.status = 'all';
  searchState.dateFrom = '';
  searchState.dateTo = '';
  searchState.sort = 'relevance';
  searchState.page = 1;
  const el = document.getElementById('central-universal-search-input');
  if (el) el.value = '';
  const dEl = document.getElementById('us-filter-district');
  if (dEl) dEl.value = '';
  const bEl = document.getElementById('us-filter-block');
  if (bEl) bEl.value = '';
  executeUniversalSearch();
}

export function updateUniversalFilter(key, value) {
  searchState[key] = value;
  if (key !== 'page') searchState.page = 1;
  if (key === 'type') {
    const tabsWrap = document.getElementById('universal-search-tabs');
    if (tabsWrap) {
      tabsWrap.innerHTML = ['all', 'customers', 'receipts', 'inventory', 'applications', 'services', 'users', 'documents', 'locations', 'audit']
        .map(
          (t) => `
          <button type="button" class="btn btn-sm ${searchState.type === t ? 'btn-primary' : 'btn-outline'}"
            onclick="window.MJK.updateUniversalFilter('type', '${t}')">
            ${t.toUpperCase()}
          </button>`
        )
        .join('');
    }
  }
  executeUniversalSearch();
}

function isPresetDemoServiceRecord(srv) {
  if (!srv) return false;
  const id = String(srv.id || srv.code || '').trim();
  if (/^SRV-2026-000(0[0-9]{2}|10[0-7])$/i.test(id)) return true;
  if (Array.isArray(srv.auditHistory) && srv.auditHistory.some(h => h.action === 'SEED_SERVICE')) return true;
  return false;
}

function collectLocalRealSearchHits({ q = '', type = 'all', district = '', blockOrMunicipality = '', status = 'all' } = {}) {
  const cleanQ = String(q || '').trim().toLowerCase();
  const digitsOnly = cleanQ.replace(/[^0-9]/g, '');
  const typeFilter = String(type || 'all').toLowerCase();
  const hits = [];

  const matchScore = (fields = []) => {
    if (!cleanQ) return 10;
    let best = 0;
    for (const f of fields) {
      if (f === undefined || f === null || f === '') continue;
      const val = String(f).toLowerCase();
      if (val === cleanQ) best = Math.max(best, 100);
      else if (val.startsWith(cleanQ)) best = Math.max(best, 75);
      else if (val.includes(cleanQ)) best = Math.max(best, 55);
      else if (digitsOnly.length >= 4 && val.replace(/[^0-9]/g, '').includes(digitsOnly)) best = Math.max(best, 65);
    }
    return best;
  };

  const passFilters = (hit) => {
    if (district && hit.district && !hit.district.toLowerCase().includes(district.toLowerCase())) return false;
    if (blockOrMunicipality && hit.blockOrMunicipality && !hit.blockOrMunicipality.toLowerCase().includes(blockOrMunicipality.toLowerCase())) return false;
    if (status && status !== 'all' && String(hit.status || '').toLowerCase() !== status.toLowerCase()) return false;
    return true;
  };

  // 1. Real Customer Records
  if (typeFilter === 'all' || typeFilter === 'customers') {
    const customers = getItem(KEYS.CUSTOMERS, []);
    (Array.isArray(customers) ? customers : []).forEach((c) => {
      const s = matchScore([c.id, c.applicationId, c.name, c.phone, c.altPhone, c.village, c.villageOrWard, c.block, c.district, c.pinCode, c.schemeName]);
      if (s > 0) {
        const hit = {
          id: c.id,
          entityType: 'customers',
          title: c.name || 'Customer',
          subtitle: `${c.id} · ${c.phone || '-'} · ${c.villageOrWard || c.village || c.block || 'Customer Profile'}`,
          code: c.id,
          status: c.currentStatus || 'ACTIVE',
          district: c.district || 'Murshidabad',
          blockOrMunicipality: c.block || c.village || '',
          createdAt: c.createdAt || c.regDate || '',
          score: s,
          actionType: 'customer',
          actionId: c.id
        };
        if (passFilters(hit)) hits.push(hit);
      }
    });
  }

  // 2. Actual Receipts & Transactions (Service Receipts, Collections, Invoices, Counter Cash & Expenses)
  if (typeFilter === 'all' || typeFilter === 'receipts' || typeFilter === 'services') {
    const services = getItem(KEYS.SERVICES, []);
    (Array.isArray(services) ? services : []).forEach((srv) => {
      if (isPresetDemoServiceRecord(srv)) return;
      const s = matchScore([srv.id, srv.receiptId, srv.refNumber, srv.serviceName, srv.category, srv.customerName, srv.phone, srv.remarks]);
      if (s > 0) {
        const hit = {
          id: srv.id,
          entityType: typeFilter === 'services' ? 'services' : 'receipts',
          title: `${srv.serviceName || 'Service Entry'} — ${srv.customerName || 'Walk-in'}`,
          subtitle: `${srv.receiptId || srv.id} · ${srv.category || 'Service'} · Total ${formatINR(srv.totalAmount)} · Due ${formatINR(srv.dueAmount)}`,
          code: srv.receiptId || srv.id,
          status: srv.status || 'New',
          district: 'Murshidabad',
          blockOrMunicipality: '',
          createdAt: srv.createdAt || srv.appDate || '',
          score: s,
          actionType: 'service_receipt',
          actionId: srv.id
        };
        if (passFilters(hit)) hits.push(hit);
      }
    });
  }

  if (typeFilter === 'all' || typeFilter === 'receipts') {
    const payments = getItem(KEYS.PAYMENTS, []);
    (Array.isArray(payments) ? payments : []).forEach((p) => {
      const s = matchScore([p.id, p.receiptId, p.invoiceNumber, p.customerName, p.paymentMethod, p.transactionId, p.remarks]);
      if (s > 0) {
        const hit = {
          id: p.id,
          entityType: 'receipts',
          title: `Payment Receipt — ${p.customerName || 'Customer'} (${formatINR(p.paymentAmount)})`,
          subtitle: `${p.id} · Mode: ${p.paymentMethod || 'Cash'} · ${p.receiptId || p.invoiceNumber || 'Collection'} · ${formatDate(p.paymentDate)}`,
          code: p.id,
          status: 'Collected',
          district: 'Murshidabad',
          blockOrMunicipality: '',
          createdAt: p.createdAt || p.paymentDate || '',
          score: s,
          actionType: 'payment_receipt',
          actionId: p.id
        };
        if (passFilters(hit)) hits.push(hit);
      }
    });

    const invoices = getItem(KEYS.INVOICES, []);
    (Array.isArray(invoices) ? invoices : []).forEach((inv) => {
      const itemDesc = (inv.items || []).map(i => i.description).join(', ');
      const s = matchScore([inv.id, inv.customerName, inv.phone, itemDesc, inv.paymentMethod]);
      if (s > 0) {
        const hit = {
          id: inv.id,
          entityType: 'receipts',
          title: `Invoice ${inv.id} — ${inv.customerName || 'Customer'}`,
          subtitle: `${itemDesc || 'Billing Invoice'} · Total ${formatINR(inv.totalAmount)} · Balance ${formatINR(inv.balanceDue)}`,
          code: inv.id,
          status: inv.status || 'Pending',
          district: 'Murshidabad',
          blockOrMunicipality: '',
          createdAt: inv.createdAt || inv.date || '',
          score: s,
          actionType: 'invoice_receipt',
          actionId: inv.id
        };
        if (passFilters(hit)) hits.push(hit);
      }
    });
  }

  // 3. Gas Accessories & Inventory Items
  if (typeFilter === 'all' || typeFilter === 'inventory') {
    const invItems = getItem(KEYS.INVENTORY, []);
    (Array.isArray(invItems) ? invItems : []).forEach((item) => {
      const s = matchScore([item.id, item.sku, item.itemName, item.name, item.category, item.supplier, item.brand, item.notes]);
      if (s > 0) {
        const qty = Number(item.quantity ?? item.stockQty ?? 0);
        const hit = {
          id: item.id,
          entityType: 'inventory',
          title: item.itemName || item.name || 'Inventory Item',
          subtitle: `${item.category || 'Gas Accessories'} · SKU: ${item.sku || item.id} · Stock: ${qty} ${item.unit || 'Pcs'} · Rate: ${formatINR(item.sellingPrice ?? item.rate ?? 0)}`,
          code: item.sku || item.id,
          status: qty <= (Number(item.minStockLevel ?? item.reorderLevel ?? 5)) ? 'LOW STOCK' : 'IN STOCK',
          district: 'MUN COMPUTER',
          blockOrMunicipality: item.category || 'Inventory',
          createdAt: item.updatedAt || item.createdAt || '',
          score: s,
          actionType: 'inventory',
          actionId: item.id
        };
        if (passFilters(hit)) hits.push(hit);
      }
    });
  }

  // 4. Genuine Applications & Follow-up Cases created by user
  if (typeFilter === 'all' || typeFilter === 'applications') {
    const cases = getItem(KEYS.FOLLOWUP_CASES, []);
    (Array.isArray(cases) ? cases : []).forEach((c) => {
      const s = matchScore([c.id, c.applicationId, c.customerName, c.phone, c.schemeName, c.currentStatus, c.villageOrWard]);
      if (s > 0) {
        const hit = {
          id: c.id,
          entityType: 'applications',
          title: `${c.schemeName || 'Application'} — ${c.customerName || 'Citizen'}`,
          subtitle: `App ID: ${c.applicationId || c.id} · Mobile: ${c.phone || '-'} · Next: ${c.nextFollowupDate ? formatDate(c.nextFollowupDate) : 'None'}`,
          code: c.applicationId || c.id,
          status: c.currentStatus || 'Submitted',
          district: 'Murshidabad',
          blockOrMunicipality: c.villageOrWard || '',
          createdAt: c.createdAt || c.startDate || '',
          score: s,
          actionType: 'case',
          actionId: c.id
        };
        if (passFilters(hit)) hits.push(hit);
      }
    });

    const anpApps = getItem(KEYS.ANNAPURNA_APPLICATIONS, []);
    (Array.isArray(anpApps) ? anpApps : []).forEach((a) => {
      const rw = resolveWardForApp(a);
      const wardDisp = a.wardNumber || a.wardName || (rw ? formatWardLabel(rw) : a.gpOrWard) || '';
      const s = matchScore([
        a.id,
        a.applicationId,
        a.applicantName,
        a.customerName,
        a.customerPhone,
        a.headOfFamily,
        a.voterIdEpic,
        wardDisp,
        a.wardNumber,
        a.wardName,
        a.gpOrWard,
        a.village,
        a.blockOrMunicipality
      ]);
      if (s > 0) {
        const hit = {
          id: a.id,
          entityType: 'applications',
          title: `Annapurna Yojana — ${a.applicantName || a.customerName || 'Applicant'}`,
          subtitle: `App ID: ${a.applicationId || a.id} · ${wardDisp ? `${wardDisp} · ` : ''}${a.village || '-'} · Mobile: ${a.customerPhone || '-'}`,
          code: a.applicationId || a.id,
          status: a.currentStatus || 'Submitted',
          district: a.district || 'Murshidabad',
          blockOrMunicipality: [wardDisp, a.village, a.blockOrMunicipality].filter(Boolean).join(' · '),
          createdAt: a.updatedAt || a.createdAt || a.applicationDate || '',
          score: s,
          actionType: 'annapurna_app',
          actionId: a.id
        };
        if (passFilters(hit)) hits.push(hit);
      }
    });
  }

  // 5. All Active Services from Live Service Rate Chart Master (Single Source of Truth)
  if (typeFilter === 'all' || typeFilter === 'services') {
    const rateItems = getAllRateChartItems().filter((srv) => srv && srv.isActive !== false);
    rateItems.forEach((srv) => {
      const shop = Math.max(0, Number(srv.serviceCharge) || 0);
      const gov = Math.max(0, Number(srv.govFee) || 0);
      const total = shop + gov;
      const s = matchScore([
        srv.id,
        srv.serviceName,
        srv.nameBn,
        srv.category,
        srv.remarks,
        srv.unit,
        String(total),
        String(shop)
      ]);
      if (s > 0) {
        const feeParts = [`Shop ${formatINR(shop)}`];
        if (gov > 0) feeParts.push(`Govt ${formatINR(gov)}`);
        feeParts.push(`Total ${formatINR(total)}`);
        const hit = {
          id: srv.id,
          entityType: 'services',
          title: srv.nameBn ? `${srv.serviceName} (${srv.nameBn})` : srv.serviceName,
          subtitle: `${srv.category} · ${srv.unit || 'Per Application'} · ${feeParts.join(' · ')}`,
          code: srv.id,
          status: 'ACTIVE',
          district: 'MUN COMPUTER',
          blockOrMunicipality: srv.category,
          createdAt: srv.updatedAt || srv.createdAt || '',
          score: s,
          actionType: 'rate_chart_service',
          actionId: srv.id
        };
        if (passFilters(hit)) hits.push(hit);
      }
    });
  }

  return hits;
}

export function handleUniversalSearchHitClick(actionType, actionId, entityType) {
  closeModalFn();
  if (actionType === 'rate_chart_service' && actionId) {
    const item = getRateChartItemById(actionId);
    if (item) {
      window._rateChartSearch = item.serviceName || '';
      window._rateChartCat = 'all';
    }
    window.MJK?.navigateTo?.('rate-chart');
    return;
  }
  if (actionType === 'customer' && actionId) {
    window.MJK?.viewCustomerProfile?.(actionId);
    return;
  }
  if (actionType === 'service_receipt' && actionId) {
    window.MJK?.printServiceReceipt?.(actionId);
    return;
  }
  if (actionType === 'payment_receipt' && actionId) {
    window.MJK?.printPaymentReceipt?.(actionId);
    return;
  }
  if (actionType === 'invoice_receipt' && actionId) {
    window.MJK?.printInvoice?.(actionId);
    return;
  }
  if (actionType === 'annapurna_app' && actionId) {
    window.MJK?.navigateTo?.('govt-annapurna');
    setTimeout(() => window.MJK?.openAnnapurnaDetailModal?.(actionId), 60);
    return;
  }
  if (actionType === 'case' && actionId) {
    window.MJK?.openCaseDetailModal?.(actionId);
    return;
  }
  const routeMap = {
    inventory: 'inventory',
    applications: 'followups',
    customers: 'customers',
    services: 'services',
    receipts: 'payments',
    locations: 'locations-master'
  };
  window.MJK?.navigateTo?.(routeMap[entityType] || 'universal-search');
}

async function executeUniversalSearch() {
  const container = document.getElementById('universal-search-results-container');
  if (!container) return;

  container.innerHTML = `<div class="card" style="padding:2rem; text-align:center; color:var(--text-muted);">Searching live business records...</div>`;

  const localHits = collectLocalRealSearchHits(searchState);
  let serverHits = [];

  try {
    const qs = new URLSearchParams({
      q: searchState.q || '',
      type: searchState.type || 'all',
      district: searchState.district || '',
      blockOrMunicipality: searchState.blockOrMunicipality || '',
      status: searchState.status || 'all',
      sort: searchState.sort || 'relevance',
      page: '1',
      limit: '100'
    });
    const resp = await fetch(`/api/search?${qs.toString()}`, { headers: getAuthHeaders() });
    if (resp.ok) {
      const data = await resp.json();
      if (data?.success && Array.isArray(data.results)) {
        // Live Service Rate Chart owns the 'services' catalog index so stale server prices never shadow Rate Chart edits
        serverHits = data.results.filter((r) => r.entityType !== 'services' && !isPresetDemoServiceRecord({ id: r.id || r.code, ...(r.meta || {}) }));
      }
    }
  } catch {
    // Offline/local fallback seamlessly continues with live localHits
  }

  // Merge local real records + real server records without duplicates
  const mergedMap = new Map();
  [...localHits, ...serverHits].forEach((hit) => {
    const key = `${hit.entityType}:${hit.id}`;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, hit);
    }
  });

  const allHits = Array.from(mergedMap.values());
  const countsByType = {};
  allHits.forEach((h) => {
    countsByType[h.entityType] = (countsByType[h.entityType] || 0) + 1;
  });

  const sortMode = searchState.sort || 'relevance';
  allHits.sort((a, b) => {
    if (sortMode === 'newest') return Date.parse(b.createdAt || '0') - Date.parse(a.createdAt || '0');
    if (sortMode === 'oldest') return Date.parse(a.createdAt || '0') - Date.parse(b.createdAt || '0');
    if (sortMode === 'name') return String(a.title || '').localeCompare(String(b.title || ''));
    return (b.score || 0) - (a.score || 0);
  });

  const limit = Number(searchState.limit || 15);
  const total = allHits.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(Math.max(1, Number(searchState.page || 1)), totalPages);
  const results = allHits.slice((page - 1) * limit, page * limit);

  const summaryBadges = Object.entries(countsByType)
    .filter(([, cnt]) => cnt > 0)
    .map(([k, cnt]) => `<span class="badge badge-neutral" style="font-size:0.72rem;">${esc(k.toUpperCase())}: ${cnt}</span>`)
    .join(' ');

  if (!results.length) {
    container.innerHTML = `
      <div class="card" style="padding:2.5rem; text-align:center;">
        <div style="font-size:1.8rem; margin-bottom:0.5rem;">🔍</div>
        <div style="font-weight:800; font-size:1.05rem;">No Records Found</div>
        <div style="font-size:0.82rem; color:var(--text-muted); margin-top:0.35rem;">
          No matching customers, receipts, gas accessories inventory, applications, or user-created services exist.
        </div>
        <button type="button" class="btn btn-secondary btn-sm" style="margin-top:0.85rem;" onclick="window.MJK.clearUniversalSearch()">Reset Search</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-card" style="border:1px solid var(--border-subtle); border-radius:var(--radius-lg); overflow:hidden;">
      <div style="padding:0.75rem 1rem; background:var(--surface-alt); border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <div style="font-size:0.82rem; font-weight:700;">
          Showing ${results.length} of ${total} real matches (Page ${page} / ${totalPages})
        </div>
        <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">${summaryBadges}</div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Code / ID</th>
              <th>Record Title & Details</th>
              <th>Location / Context</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${results
              .map(
                (r) => `
              <tr style="cursor:pointer;" onclick="window.MJK.handleUniversalSearchHitClick('${escAttr(r.actionType || '')}', '${escAttr(r.actionId || r.id || '')}', '${escAttr(r.entityType || '')}')">
                <td><span class="badge badge-info" style="font-size:0.68rem;">${esc(String(r.entityType || '').toUpperCase())}</span></td>
                <td class="font-mono" style="font-weight:700; font-size:0.78rem; color:var(--blue-600);">${esc(r.code)}</td>
                <td>
                  <div style="font-weight:700; font-size:0.86rem;">${esc(r.title)}</div>
                  <div style="font-size:0.74rem; color:var(--text-muted);">${esc(r.subtitle)}</div>
                </td>
                <td style="font-size:0.78rem; color:var(--text-muted);">
                  ${esc(r.district || '-')}${r.blockOrMunicipality ? ` · ${esc(r.blockOrMunicipality)}` : ''}
                </td>
                <td><span class="badge ${r.status === 'ACTIVE' || r.status === 'VERIFIED' || r.status === 'Completed' || r.status === 'Collected' || r.status === 'IN STOCK' ? 'badge-success' : 'badge-warning'}" style="font-size:0.68rem;">${esc(r.status)}</span></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <div style="padding:0.75rem 1rem; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
        <button type="button" class="btn btn-secondary btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="window.MJK.updateUniversalFilter('page', ${page - 1})">
          ← Previous
        </button>
        <span style="font-size:0.78rem; color:var(--text-muted);">Page ${page} of ${totalPages}</span>
        <button type="button" class="btn btn-secondary btn-sm" ${page >= totalPages ? 'disabled' : ''} onclick="window.MJK.updateUniversalFilter('page', ${page + 1})">
          Next →
        </button>
      </div>
    </div>
  `;
}

async function executeQuickModalSearch(q) {
  const resultsContainer = document.getElementById('global-search-results');
  if (!resultsContainer) return;
  const cleanQ = String(q || '').trim();
  if (!cleanQ) {
    resultsContainer.innerHTML = `<div style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:1.5rem;">Type to search live MUN COMPUTER records...</div>`;
    return;
  }
  const localHits = collectLocalRealSearchHits({ q: cleanQ, type: 'all' });
  let serverHits = [];
  try {
    const resp = await fetch(`/api/search?q=${encodeURIComponent(cleanQ)}&limit=15`, { headers: getAuthHeaders() });
    if (resp.ok) {
      const data = await resp.json();
      serverHits = (data.results || []).filter((r) => r.entityType !== 'services' && !isPresetDemoServiceRecord({ id: r.id || r.code, ...(r.meta || {}) }));
    }
  } catch {
    // local fallback only
  }
  const mergedMap = new Map();
  [...localHits, ...serverHits].forEach((hit) => {
    const key = `${hit.entityType}:${hit.id}`;
    if (!mergedMap.has(key)) mergedMap.set(key, hit);
  });
  const list = Array.from(mergedMap.values()).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 15);
  if (!list.length) {
    resultsContainer.innerHTML = `<div style="font-size:0.9rem; font-weight:700; color:var(--text-muted); text-align:center; padding:1.75rem;">No Records Found</div>`;
    return;
  }
  resultsContainer.innerHTML = list
    .map(
      (r) => `
    <div onclick="window.MJK.handleUniversalSearchHitClick('${escAttr(r.actionType || '')}', '${escAttr(r.actionId || r.id || '')}', '${escAttr(r.entityType || '')}')"
      style="padding:0.65rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); cursor:pointer; background:var(--surface-alt); display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
      <div>
        <div style="font-weight:700; font-size:0.84rem;">${esc(r.title)}</div>
        <div style="font-size:0.73rem; color:var(--text-muted);">${esc(r.subtitle)}</div>
      </div>
      <span class="badge badge-neutral" style="font-size:0.68rem;">${esc(String(r.entityType || '').toUpperCase())}</span>
    </div>`
    )
    .join('');
}

export function refreshOpenGlobalSearchModalIfOpen() {
  const input = document.getElementById('global-search-modal-input');
  const resultsContainer = document.getElementById('global-search-results');
  if (input && resultsContainer) {
    executeQuickModalSearch(input.value);
  }
}

export function openServerGlobalSearch() {
  const content = `
    <div style="display:flex; gap:0.5rem; margin-bottom:0.85rem;">
      <input type="text" id="global-search-modal-input" class="form-control"
        placeholder="Search Customer, Mobile, Service & Rate Chart, Receipt ID, Gas Inventory, Application..." autofocus>
      <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('universal-search'); window.MJK.closeModal();">
        Full View →
      </button>
    </div>
    <div id="global-search-results" style="max-height:380px; overflow-y:auto; display:flex; flex-direction:column; gap:0.45rem;">
      <div style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:1.5rem;">Type to search live MUN COMPUTER records...</div>
    </div>
  `;
  modalFn('Global Search (Ctrl+K)', content, null);

  setTimeout(() => {
    const input = document.getElementById('global-search-modal-input');
    const resultsContainer = document.getElementById('global-search-results');
    if (!input || !resultsContainer) return;
    input.focus();
    let timer = null;
    input.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(timer);
      if (!q) {
        resultsContainer.innerHTML = `<div style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:1.5rem;">Type to search live MUN COMPUTER records...</div>`;
        return;
      }
      timer = setTimeout(() => {
        executeQuickModalSearch(q);
      }, 160);
    });
  }, 80);
}

// ---------------------------------------------------------------------------
// 2. ADMIN SERVICE CATALOG MANAGEMENT (ADD, EDIT, SOFT DELETE, RESTORE)
// ---------------------------------------------------------------------------
let catalogCache = [];
let catalogFilter = { q: '', includeDeleted: false, category: 'all' };

export async function refreshCatalogCache() {
  try {
    const resp = await fetch(`/api/services?includeDeleted=true`, { headers: getAuthHeaders() });
    const data = await resp.json();
    if (data.success && Array.isArray(data.services)) {
      catalogCache = data.services;
    }
  } catch {
    // keep cache
  }
  return catalogCache;
}

export function renderAdminServiceCatalogModal() {
  refreshCatalogCache().then(() => openCatalogManagerModalInner());
}

function openCatalogManagerModalInner() {
  const cur = getCurrentUser();
  const isAdminUser = cur && (['ADMIN', 'MANAGER'].includes(String(cur.role || '').toUpperCase()) || isSuperAdmin(cur));
  const activeCount = catalogCache.filter((s) => !s.isDeleted).length;
  const deletedCount = catalogCache.filter((s) => s.isDeleted).length;
  const categories = Array.from(new Set(catalogCache.map((s) => s.category))).sort();

  const html = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.85rem;">
      <div style="font-size:0.8rem; color:var(--text-muted);">
        Active Catalog Services: <strong>${activeCount}</strong> · Soft-Deleted Archive: <strong>${deletedCount}</strong>
      </div>
      <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        ${isAdminUser ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.catalogBulkDelete()">🗑 Remove Selected</button>` : ''}
        ${isAdminUser ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openCatalogUpsertModal()">+ Add New Service</button>` : ''}
      </div>
    </div>

    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.75rem;">
      <input type="text" id="catalog-search-input" class="form-control" style="flex:1; min-width:180px; height:36px;" placeholder="Search service name, code, category..." value="${esc(catalogFilter.q)}" oninput="window.MJK.filterCatalogTable()">
      <select id="catalog-cat-select" class="form-control" style="width:190px; height:36px;" onchange="window.MJK.filterCatalogTable()">
        <option value="all">All Categories (${categories.length})</option>
        ${categories.map((c) => `<option value="${esc(c)}" ${catalogFilter.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
      <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.78rem; padding:0 0.5rem; border:1px solid var(--border-subtle); border-radius:var(--radius-sm); cursor:pointer;">
        <input type="checkbox" id="catalog-show-deleted" ${catalogFilter.includeDeleted ? 'checked' : ''} onchange="window.MJK.filterCatalogTable()">
        Show Deleted (${deletedCount})
      </label>
    </div>

    <div id="catalog-table-container" style="max-height:420px; overflow-y:auto; border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
      ${buildCatalogRowsHtml()}
    </div>
  `;
  modalFn('Central Service Catalog Manager (Add / Edit / Soft-Delete / Restore)', html, null);
}

function buildCatalogRowsHtml() {
  const cur = getCurrentUser();
  const isAdminUser = cur && (['ADMIN', 'MANAGER'].includes(String(cur.role || '').toUpperCase()) || isSuperAdmin(cur));
  const q = (catalogFilter.q || '').toLowerCase();
  const rows = catalogCache.filter((s) => {
    if (!catalogFilter.includeDeleted && s.isDeleted) return false;
    if (catalogFilter.category !== 'all' && s.category !== catalogFilter.category) return false;
    if (q) {
      return (
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (!rows.length) {
    return `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-size:0.84rem;">No catalog services match your filters.</div>`;
  }

  return `
    <table class="data-table" style="font-size:0.8rem;">
      <thead>
        <tr>
          ${isAdminUser ? '<th style="width:32px;"><input type="checkbox" id="catmgr-select-all" title="Select all visible services" onchange="document.querySelectorAll(\'.catmgr-select-row\').forEach(cb => cb.checked = this.checked)"></th>' : ''}
          <th>Pos</th>
          <th>ID / Code</th>
          <th>Service Name & Category</th>
          <th>Fee Breakdown</th>
          <th>Status</th>
          ${isAdminUser ? '<th style="text-align:right;">Admin Actions</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (s) => `
          <tr style="${s.isDeleted ? 'opacity:0.65; background:rgba(239,68,68,0.04);' : ''}">
            ${isAdminUser ? `<td><input type="checkbox" class="catmgr-select-row" value="${escAttr(s.id)}"></td>` : ''}
            <td class="font-mono">${s.position}</td>
            <td>
              <div class="font-mono" style="font-weight:700; color:var(--blue-600);">${esc(s.id)}</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">${esc(s.code)}</div>
            </td>
            <td>
              <div style="font-weight:700;">${esc(s.name)}</div>
              <div style="font-size:0.72rem; color:var(--text-muted);">${esc(s.category)} · ${esc(s.subcategory)}</div>
            </td>
            <td class="tabular-nums">
              <div style="font-weight:700;">₹${s.price}</div>
              <div style="font-size:0.68rem; color:var(--text-muted);">Gov: ₹${s.govFee} + Srv: ₹${s.serviceCharge}</div>
            </td>
            <td>
              ${
                s.isDeleted
                  ? `<span class="badge badge-danger">DELETED</span>`
                  : s.isActive
                    ? `<span class="badge badge-success">ACTIVE</span>`
                    : `<span class="badge badge-warning">INACTIVE</span>`
              }
            </td>
            ${
              isAdminUser
                ? `<td style="text-align:right; white-space:nowrap;">
                    ${
                      s.isDeleted
                        ? `
                          <button type="button" class="btn btn-success btn-sm" onclick="window.MJK.catalogRestore('${escAttr(s.id)}')">↺ Restore</button>
                          <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.catalogPermanentDelete('${escAttr(s.id)}', '${escAttr(s.name)}')">✕ Delete Forever</button>
                        `
                        : `
                          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openCatalogUpsertModal('${escAttr(s.id)}')">✎ Edit Rate</button>
                          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.catalogToggle('${escAttr(s.id)}')">${s.isActive ? 'Disable' : 'Enable'}</button>
                          <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.catalogSoftDelete('${escAttr(s.id)}')">🗑 Delete</button>
                          <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.catalogPermanentDelete('${escAttr(s.id)}', '${escAttr(s.name)}')" title="Permanently Delete">✕</button>
                        `
                    }
                  </td>`
                : ''
            }
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

export function filterCatalogTable() {
  const qEl = document.getElementById('catalog-search-input');
  const cEl = document.getElementById('catalog-cat-select');
  const dEl = document.getElementById('catalog-show-deleted');
  if (qEl) catalogFilter.q = qEl.value;
  if (cEl) catalogFilter.category = cEl.value;
  if (dEl) catalogFilter.includeDeleted = dEl.checked;
  const container = document.getElementById('catalog-table-container');
  if (container) container.innerHTML = buildCatalogRowsHtml();
}

export function openCatalogUpsertModal(serviceId = null) {
  const existing = serviceId ? catalogCache.find((s) => s.id === serviceId) : null;
  const html = `
    <form onsubmit="window.MJK.submitCatalogUpsert(event, '${existing ? existing.id : ''}')">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Service Name *</label>
          <input type="text" id="cat-srv-name" class="form-control" required value="${esc(existing?.name || '')}" placeholder="e.g. Caste Certificate Online">
        </div>
        <div class="form-group">
          <label class="form-label">Category *</label>
          <input type="text" id="cat-srv-category" class="form-control" required value="${esc(existing?.category || 'Certificates')}" placeholder="e.g. Certificates">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Subcategory</label>
          <input type="text" id="cat-srv-subcat" class="form-control" value="${esc(existing?.subcategory || '')}" placeholder="Subcategory">
        </div>
        <div class="form-group">
          <label class="form-label">Display Position</label>
          <input type="number" id="cat-srv-pos" class="form-control" value="${existing?.position ?? catalogCache.length + 1}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Govt Fee (₹)</label>
          <input type="number" id="cat-srv-gov" class="form-control" min="0" value="${existing?.govFee ?? 0}" oninput="window.MJK.syncAmountWords(this, 'cat-srv-gov-words')">
          <div id="cat-srv-gov-words" class="amount-words-hint"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Service Charge (₹) *</label>
          <input type="number" id="cat-srv-charge" class="form-control" min="0" required value="${existing?.serviceCharge ?? 100}" oninput="window.MJK.syncAmountWords(this, 'cat-srv-charge-words')">
          <div id="cat-srv-charge-words" class="amount-words-hint"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="cat-srv-desc" class="form-control" rows="2">${esc(existing?.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Image / Icon URL (Optional)</label>
        <input type="text" id="cat-srv-img" class="form-control" value="${esc(existing?.imageUrl || '')}" placeholder="https://...">
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.renderAdminServiceCatalogModal()">← Back to Catalog</button>
        <button type="submit" class="btn btn-primary">${existing ? 'Save Changes' : 'Add Service'}</button>
      </div>
    </form>
  `;
  modalFn(existing ? `Edit Service (${existing.id})` : 'Add New Central Service', html, null);
  setTimeout(() => {
    syncAmountWords(document.getElementById('cat-srv-gov'), 'cat-srv-gov-words');
    syncAmountWords(document.getElementById('cat-srv-charge'), 'cat-srv-charge-words');
  }, 10);
}

export async function submitCatalogUpsert(e, existingId = '') {
  e.preventDefault();
  const payload = {
    name: document.getElementById('cat-srv-name')?.value.trim(),
    category: document.getElementById('cat-srv-category')?.value.trim(),
    subcategory: document.getElementById('cat-srv-subcat')?.value.trim(),
    position: Number(document.getElementById('cat-srv-pos')?.value || 1),
    govFee: Number(document.getElementById('cat-srv-gov')?.value || 0),
    serviceCharge: Number(document.getElementById('cat-srv-charge')?.value || 0),
    description: document.getElementById('cat-srv-desc')?.value.trim(),
    imageUrl: document.getElementById('cat-srv-img')?.value.trim()
  };
  const url = existingId ? `/api/services/${encodeURIComponent(existingId)}` : '/api/services';
  const method = existingId ? 'PUT' : 'POST';
  const resp = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(payload) });
  const data = await resp.json();
  if (resp.ok && data.success) {
    toastFn(data.message, 'success');
    await refreshCatalogCache();
    openCatalogManagerModalInner();
  } else {
    toastFn(data.message || 'Failed to save service.', 'danger');
  }
}

export async function catalogSoftDelete(id) {
  const srv = catalogCache.find((s) => s.id === id);
  const resp = await fetch(`/api/services/${encodeURIComponent(id)}`, { method: 'DELETE', headers: getAuthHeaders() });
  const data = await resp.json();
  if (resp.ok && srv) {
    removeCatalogService(srv.category, srv.name);
  }
  toastFn(data.message || 'Done', resp.ok ? 'warning' : 'danger');
  await refreshCatalogCache();
  openCatalogManagerModalInner();
  renderFn();
}

export async function catalogRestore(id) {
  const srv = catalogCache.find((s) => s.id === id);
  const resp = await fetch(`/api/services/${encodeURIComponent(id)}/restore`, { method: 'POST', headers: getAuthHeaders() });
  const data = await resp.json();
  if (resp.ok && srv) {
    restoreCatalogService(srv.category, srv.name);
  }
  toastFn(data.message || 'Restored', resp.ok ? 'success' : 'danger');
  await refreshCatalogCache();
  openCatalogManagerModalInner();
  renderFn();
}

export async function catalogToggle(id) {
  const resp = await fetch(`/api/services/${encodeURIComponent(id)}/toggle`, { method: 'POST', headers: getAuthHeaders() });
  const data = await resp.json();
  toastFn(data.message || 'Updated', resp.ok ? 'info' : 'danger');
  await refreshCatalogCache();
  openCatalogManagerModalInner();
}

export function catalogPermanentDelete(id, name = '') {
  const srv = catalogCache.find((s) => s.id === id);
  confirmFn(
    'Permanently Delete Service?',
    `Are you sure you want to permanently remove "${name || id}" from the Central Service Catalog? Existing customer bills are not deleted.`,
    async () => {
      const resp = await fetch(`/api/services/${encodeURIComponent(id)}/permanent`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await resp.json();
      if (resp.ok && srv) {
        removeCatalogService(srv.category, srv.name);
      }
      toastFn(data.message || 'Service permanently deleted', resp.ok ? 'warning' : 'danger');
      await refreshCatalogCache();
      openCatalogManagerModalInner();
      renderFn();
    }
  );
}

export function catalogBulkDelete() {
  const checked = Array.from(document.querySelectorAll('.catmgr-select-row:checked')).map((cb) => cb.value).filter(Boolean);
  if (checked.length === 0) {
    toastFn('Select at least one service row using the checkboxes to remove.', 'warning');
    return;
  }
  confirmFn(
    `Remove ${checked.length} Selected Service(s)?`,
    `Soft-delete and remove ${checked.length} selected service(s) from the active catalog? Existing customer bills remain safe.`,
    async () => {
      let okCount = 0;
      for (const id of checked) {
        const srv = catalogCache.find((s) => s.id === id);
        const resp = await fetch(`/api/services/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (resp.ok) {
          okCount += 1;
          if (srv) removeCatalogService(srv.category, srv.name);
        }
      }
      toastFn(`Removed ${okCount} service(s) from the active catalog.`, okCount > 0 ? 'warning' : 'danger');
      await refreshCatalogCache();
      openCatalogManagerModalInner();
      renderFn();
    }
  );
}

// ---------------------------------------------------------------------------
// 3. CENTRAL APPLICATION WORKFLOW & UID AUTO-FETCH
// ---------------------------------------------------------------------------
let appsCache = [];
let appSearchQuery = '';
let appStatusFilter = 'all';

export function renderApplicationsView() {
  const html = `
    <div class="page-header" style="flex-wrap:wrap; gap:1rem;">
      <div>
        <h2 class="page-title">📝 Central Application Workflow (Date-Serial IDs)</h2>
        <p class="page-subtitle">Automatic DDMMMYYNNNN IDs (e.g. 15NOV260001), UID Customer Auto-Fetch, Staff Assignment &amp; Chronological Timeline</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.45rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printApplicationsReport()">🖨 Print</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportApplicationsPDF()">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportApplicationsExcel()">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportApplicationsCSV()">📄 CSV</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.refreshApplicationsList()">🔄 Refresh</button>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openCentralApplicationModal()">+ New Application</button>
      </div>
    </div>

    <div class="table-card">
      <div class="table-toolbar" style="gap:0.5rem; flex-wrap:wrap;">
        <input type="text" id="central-app-search" class="form-control toolbar-search" placeholder="Search APP ID, Customer, Mobile, Service..." value="${esc(appSearchQuery)}" oninput="window.MJK.filterApplicationsTable()">
        <select id="central-app-status" class="form-control toolbar-select" onchange="window.MJK.filterApplicationsTable()">
          <option value="all">All Statuses</option>
          ${['New', 'Pending', 'Under Process', 'Under Verification', 'Hold Up', 'Completed', 'Rejected', 'Cancelled']
            .map((st) => `<option value="${st}" ${appStatusFilter === st ? 'selected' : ''}>${st}</option>`)
            .join('')}
        </select>
      </div>
      <div id="central-applications-table-wrap">
        <div style="padding:2rem; text-align:center; color:var(--text-muted);">Loading applications...</div>
      </div>
    </div>
  `;
  return html;
}

export async function refreshApplicationsList() {
  const wrap = document.getElementById('central-applications-table-wrap');
  if (!wrap) return;
  try {
    const resp = await fetch('/api/applications', { headers: getAuthHeaders() });
    const data = await resp.json();
    if (data.success && Array.isArray(data.applications)) appsCache = data.applications;
    filterApplicationsTable();
  } catch {
    wrap.innerHTML = `<div style="padding:1.5rem; color:var(--danger);">Failed to fetch applications.</div>`;
  }
}

export function filterApplicationsTable() {
  const qEl = document.getElementById('central-app-search');
  const sEl = document.getElementById('central-app-status');
  if (qEl) appSearchQuery = qEl.value.trim().toLowerCase();
  if (sEl) appStatusFilter = sEl.value;

  const wrap = document.getElementById('central-applications-table-wrap');
  if (!wrap) return;

  const filtered = appsCache.filter((a) => {
    if (appStatusFilter !== 'all' && a.status !== appStatusFilter) return false;
    if (appSearchQuery) {
      return (
        a.id.toLowerCase().includes(appSearchQuery) ||
        a.customerName.toLowerCase().includes(appSearchQuery) ||
        (a.phone || '').includes(appSearchQuery) ||
        a.serviceName.toLowerCase().includes(appSearchQuery)
      );
    }
    return true;
  });

  if (!filtered.length) {
    wrap.innerHTML = `
      <div style="padding:2.5rem; text-align:center; color:var(--text-muted);">
        No applications found. Click <strong>+ New Application</strong> to submit with UID Auto-Fetch.
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Application ID</th>
            <th>Customer</th>
            <th>Service</th>
            <th>Fee / Paid / Due</th>
            <th>Status</th>
            <th>Assigned Staff</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (a) => `
            <tr>
              <td>
                <div class="font-mono" style="font-weight:700; color:var(--blue-600);">${esc(a.id)}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${formatDate(a.createdAt)}</div>
              </td>
              <td>
                <div style="font-weight:700;">${esc(a.customerName)}</div>
                <div class="font-mono" style="font-size:0.72rem; color:var(--text-muted);">${esc(a.customerId || '-')} · ${esc(a.phone)}</div>
              </td>
              <td>
                <div style="font-weight:600;">${esc(a.serviceName)}</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">${esc(a.category)}</div>
              </td>
              <td class="tabular-nums">
                <div>Total: ${formatINR(a.totalAmount)}</div>
                <div style="font-size:0.72rem; color:${a.dueAmount > 0 ? 'var(--danger)' : 'var(--success)'};">Paid: ${formatINR(a.paidAmount)} · Due: ${formatINR(a.dueAmount)}</div>
              </td>
              <td><span class="badge ${a.status === 'Completed' ? 'badge-success' : a.status === 'Rejected' ? 'badge-danger' : 'badge-info'}">${esc(a.status)}</span></td>
              <td class="font-mono" style="font-size:0.78rem;">${esc(a.assignedStaffUid || '-')}</td>
              <td style="text-align:right; white-space:nowrap;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openAppTimelineModal('${a.id}')">Status & Timeline</button>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function getFilteredApplicationsForExport() {
  return appsCache.filter((a) => {
    if (appStatusFilter !== 'all' && a.status !== appStatusFilter) return false;
    if (appSearchQuery) {
      return (
        a.id.toLowerCase().includes(appSearchQuery) ||
        a.customerName.toLowerCase().includes(appSearchQuery) ||
        (a.phone || '').includes(appSearchQuery) ||
        a.serviceName.toLowerCase().includes(appSearchQuery)
      );
    }
    return true;
  });
}

export function exportApplicationsCSV() {
  const list = getFilteredApplicationsForExport();
  const headers = ['Application ID', 'Date', 'Customer Name', 'Mobile', 'Service', 'Category', 'Total Fee', 'Paid', 'Due', 'Status', 'Staff'];
  const rows = list.map((a) => [a.id, formatDate(a.createdAt), a.customerName, a.phone || '-', a.serviceName, a.category || '-', Number(a.totalAmount) || 0, Number(a.paidAmount) || 0, Number(a.dueAmount) || 0, a.status, a.assignedStaffUid || '-']);
  const totalFee = list.reduce((s, a) => s + (Number(a.totalAmount) || 0), 0);
  const totalPaid = list.reduce((s, a) => s + (Number(a.paidAmount) || 0), 0);
  const totalDue = list.reduce((s, a) => s + (Number(a.dueAmount) || 0), 0);
  exportUniversalCSV({
    filename: 'MUN_Applications_Report',
    title: 'CENTRAL APPLICATIONS REGISTER',
    subtitle: `Status Filter: ${appStatusFilter}`,
    headers,
    rows,
    totalsRow: ['GRAND TOTAL', `${list.length} Apps`, '', '', '', '', totalFee, totalPaid, totalDue, '', '']
  });
  toastFn('Applications CSV exported.', 'success');
}

export function exportApplicationsExcel() {
  const list = getFilteredApplicationsForExport();
  const headers = ['Application ID', 'Date', 'Customer Name', 'Mobile', 'Service', 'Category', 'Total Fee (INR)', 'Paid (INR)', 'Due (INR)', 'Status', 'Staff'];
  const rows = list.map((a) => [a.id, formatDate(a.createdAt), a.customerName, a.phone || '-', a.serviceName, a.category || '-', Number(a.totalAmount) || 0, Number(a.paidAmount) || 0, Number(a.dueAmount) || 0, a.status, a.assignedStaffUid || '-']);
  const totalFee = list.reduce((s, a) => s + (Number(a.totalAmount) || 0), 0);
  const totalPaid = list.reduce((s, a) => s + (Number(a.paidAmount) || 0), 0);
  const totalDue = list.reduce((s, a) => s + (Number(a.dueAmount) || 0), 0);
  exportUniversalExcel({
    filename: 'MUN_Applications_Report',
    sheetName: 'Applications',
    title: 'CENTRAL APPLICATIONS REGISTER',
    subtitle: `Status Filter: ${appStatusFilter}`,
    headers,
    rows,
    totalsRow: ['GRAND TOTAL', `${list.length} Apps`, '', '', '', '', totalFee, totalPaid, totalDue, '', '']
  });
  toastFn('Applications Excel (.xlsx) exported.', 'success');
}

export async function exportApplicationsPDF() {
  const list = getFilteredApplicationsForExport();
  const headers = ['App ID', 'Date', 'Customer', 'Mobile', 'Service', 'Total Fee', 'Paid', 'Due', 'Status'];
  const rows = list.map((a) => [a.id, formatDate(a.createdAt), a.customerName, a.phone || '-', a.serviceName, formatINR(a.totalAmount), formatINR(a.paidAmount), formatINR(a.dueAmount), a.status]);
  const totalFee = list.reduce((s, a) => s + (Number(a.totalAmount) || 0), 0);
  const totalPaid = list.reduce((s, a) => s + (Number(a.paidAmount) || 0), 0);
  const totalDue = list.reduce((s, a) => s + (Number(a.dueAmount) || 0), 0);
  await exportUniversalPDF({
    filename: 'MUN_Applications_Report',
    title: 'CENTRAL APPLICATIONS REGISTER',
    subtitle: `Status Filter: ${appStatusFilter}`,
    summaryCards: [
      { label: 'Total Apps', value: String(list.length) },
      { label: 'Total Billed', value: formatINR(totalFee) },
      { label: 'Total Collected', value: formatINR(totalPaid) },
      { label: 'Outstanding Due', value: formatINR(totalDue) }
    ],
    headers,
    rows,
    totalsRow: ['GRAND TOTAL', `${list.length} Apps`, '-', '-', '-', formatINR(totalFee), formatINR(totalPaid), formatINR(totalDue), '-']
  });
  toastFn('Applications PDF downloaded.', 'success');
}

export function printApplicationsReport() {
  const list = getFilteredApplicationsForExport();
  const headers = ['App ID', 'Date', 'Customer', 'Mobile', 'Service', 'Total Fee', 'Paid', 'Due', 'Status'];
  const rows = list.map((a) => [a.id, formatDate(a.createdAt), a.customerName, a.phone || '-', a.serviceName, formatINR(a.totalAmount), formatINR(a.paidAmount), formatINR(a.dueAmount), a.status]);
  const totalFee = list.reduce((s, a) => s + (Number(a.totalAmount) || 0), 0);
  const totalPaid = list.reduce((s, a) => s + (Number(a.paidAmount) || 0), 0);
  const totalDue = list.reduce((s, a) => s + (Number(a.dueAmount) || 0), 0);
  printUniversalReport({
    title: 'CENTRAL APPLICATIONS REGISTER',
    subtitle: `Status Filter: ${appStatusFilter}`,
    filename: 'MUN_Applications_Report',
    summaryCards: [
      { label: 'Total Apps', value: String(list.length) },
      { label: 'Total Billed', value: formatINR(totalFee) },
      { label: 'Total Collected', value: formatINR(totalPaid) },
      { label: 'Outstanding Due', value: formatINR(totalDue) }
    ],
    headers,
    rows,
    totalsRow: ['GRAND TOTAL', `${list.length} Apps`, '-', '-', '-', formatINR(totalFee), formatINR(totalPaid), formatINR(totalDue), '-']
  });
}

export async function openCentralApplicationModal() {
  const catalog = await refreshCatalogCache();
  const activeServices = catalog.filter((s) => !s.isDeleted && s.isActive);

  const html = `
    <div style="padding:0.75rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:0.85rem;">
      <label class="form-label" style="font-size:0.76rem;">Auto-Fetch Existing Customer (Enter Customer ID, UID, or 10-Digit Mobile)</label>
      <div style="display:flex; gap:0.5rem;">
        <input type="text" id="app-autofetch-input" class="form-control font-mono" placeholder="e.g. CUST-2026-000001 or 98XXXXXXXX">
        <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.runCustomerAutofetch()">⚡ Auto-Fetch</button>
      </div>
      <div id="app-autofetch-status" style="font-size:0.74rem; color:var(--text-muted); margin-top:0.35rem;"></div>
    </div>

    <form onsubmit="window.MJK.submitCentralApplication(event)">
      <input type="hidden" id="app-cust-id" value="">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Customer Name *</label>
          <input type="text" id="app-cust-name" class="form-control" required>
        </div>
        <div class="form-group">
          <label class="form-label">Mobile Number *</label>
          <input type="tel" id="app-cust-phone" class="form-control font-mono" maxlength="10" required>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Search &amp; Select Service from Rate Chart *</label>
          <input type="text" id="app-srv-filter" class="form-control" style="margin-bottom:0.4rem;" placeholder="Filter services (English / Bengali)..." oninput="window.MJK.filterCentralAppServices(this.value)">
          <select id="app-srv-select" class="form-control" onchange="window.MJK.onAppServiceSelected(this.value)" required>
            <option value="">-- Choose Service (${activeServices.length}) --</option>
            ${activeServices.map((s) => `<option value="${esc(s.id)}" data-name="${esc(s.name)}" data-cat="${esc(s.category)}" data-gov="${s.govFee}" data-charge="${s.serviceCharge}" data-price="${s.price}">${esc(s.category)} — ${esc(s.name)}${s.nameBn ? ` (${esc(s.nameBn)})` : ''} · ₹${s.price}</option>`).join('')}
          </select>
          <div id="app-srv-rate-breakdown" style="font-size:0.74rem; color:var(--blue-600); font-weight:600; margin-top:0.3rem;"></div>
        </div>
        <div class="form-group">
          <label class="form-label">District / Block / Ward Summary</label>
          <input type="text" id="app-loc-summary" class="form-control" placeholder="Murshidabad · Domkal">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Total Fee (₹)</label>
          <input type="number" id="app-total-amt" class="form-control" value="0" min="0" oninput="window.MJK.syncAmountWords(this, 'app-total-amt-words')">
          <div id="app-total-amt-words" class="amount-words-hint"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Paid Now (₹)</label>
          <input type="number" id="app-paid-amt" class="form-control" value="0" min="0" oninput="window.MJK.syncAmountWords(this, 'app-paid-amt-words')">
          <div id="app-paid-amt-words" class="amount-words-hint"></div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Notes / Remarks</label>
        <input type="text" id="app-notes" class="form-control" placeholder="Optional officer notes">
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Application (Auto Date-Serial ID)</button>
      </div>
    </form>
  `;
  modalFn('New Central Application Entry', html, null);
  setTimeout(() => {
    syncAmountWords(document.getElementById('app-total-amt'), 'app-total-amt-words');
    syncAmountWords(document.getElementById('app-paid-amt'), 'app-paid-amt-words');
  }, 10);
}

export function filterCentralAppServices(query = '') {
  const sel = document.getElementById('app-srv-select');
  if (!sel) return;
  const q = String(query || '').trim().toLowerCase();
  Array.from(sel.options).forEach((opt, idx) => {
    if (idx === 0) return;
    opt.style.display = (!q || opt.textContent.toLowerCase().includes(q)) ? '' : 'none';
  });
}

export async function runCustomerAutofetch() {
  const q = document.getElementById('app-autofetch-input')?.value.trim();
  const statusEl = document.getElementById('app-autofetch-status');
  if (!q) return;
  try {
    const resp = await fetch(`/api/customers/autofetch?q=${encodeURIComponent(q)}`, { headers: getAuthHeaders() });
    const data = await resp.json();
    if (resp.ok && data.success && data.customer) {
      const c = data.customer;
      document.getElementById('app-cust-id').value = c.id;
      document.getElementById('app-cust-name').value = c.name;
      document.getElementById('app-cust-phone').value = c.phone;
      document.getElementById('app-loc-summary').value = [c.district, c.blockOrMunicipality, c.gpOrWard, c.pinCode].filter(Boolean).join(' · ');
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--success); font-weight:700;">✓ Loaded ${esc(c.name)} (${esc(c.id)})</span>`;
      return;
    }
    // fallback search localStorage customers
    const localCusts = getItem(KEYS.CUSTOMERS, []);
    const localMatch = localCusts.find((c) => c.id?.toUpperCase() === q.toUpperCase() || String(c.phone || '').includes(q));
    if (localMatch) {
      document.getElementById('app-cust-id').value = localMatch.id;
      document.getElementById('app-cust-name').value = localMatch.name;
      document.getElementById('app-cust-phone').value = localMatch.phone;
      document.getElementById('app-loc-summary').value = [localMatch.district, localMatch.village, localMatch.pinCode].filter(Boolean).join(' · ');
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--success); font-weight:700;">✓ Loaded from directory: ${esc(localMatch.name)}</span>`;
      return;
    }
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--warning);">No customer found matching "${esc(q)}". Enter details manually below.</span>`;
  } catch {
    if (statusEl) statusEl.textContent = 'Autofetch failed.';
  }
}

export function onAppServiceSelected(srvId) {
  const sel = document.getElementById('app-srv-select');
  const opt = sel?.selectedOptions?.[0];
  const totalInput = document.getElementById('app-total-amt');
  const breakdownEl = document.getElementById('app-srv-rate-breakdown');
  if (opt && totalInput) {
    const shop = Number(opt.dataset.charge || 0);
    const gov = Number(opt.dataset.gov || 0);
    const total = Number(opt.dataset.price || (shop + gov));
    totalInput.value = total;
    syncAmountWords(totalInput, 'app-total-amt-words');
    if (breakdownEl) {
      breakdownEl.textContent = opt.value
        ? `Rate Breakdown: Shop Charge ₹${shop} + Govt Fee ₹${gov} = Total ₹${total}`
        : '';
    }
  }
}

export async function submitCentralApplication(e) {
  e.preventDefault();
  const sel = document.getElementById('app-srv-select');
  const opt = sel?.selectedOptions?.[0];
  const locSummary = document.getElementById('app-loc-summary')?.value.trim() || '';
  const payload = {
    customerId: document.getElementById('app-cust-id')?.value || '',
    customerName: document.getElementById('app-cust-name')?.value.trim(),
    phone: document.getElementById('app-cust-phone')?.value.trim(),
    serviceId: sel?.value || '',
    serviceName: opt?.dataset?.name || 'Custom Service',
    category: opt?.dataset?.cat || 'General',
    govFee: Number(opt?.dataset?.gov || 0),
    serviceCharge: Number(opt?.dataset?.charge || 0),
    totalAmount: Number(document.getElementById('app-total-amt')?.value || 0),
    paidAmount: Number(document.getElementById('app-paid-amt')?.value || 0),
    district: 'Murshidabad',
    blockOrMunicipality: locSummary,
    notes: document.getElementById('app-notes')?.value.trim()
  };

  const resp = await fetch('/api/applications', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  if (resp.ok && data.success) {
    toastFn(data.message, 'success');
    closeModalFn();
    refreshApplicationsList();
  } else {
    toastFn(data.message || 'Failed to create application.', 'danger');
  }
}

export function openAppTimelineModal(appId) {
  const app = appsCache.find((a) => a.id === appId);
  if (!app) return;
  const users = getItem(KEYS.USERS, []).filter((u) => u.status === 'ACTIVE');
  const statusOptions = getServiceStatuses({ includeValues: ['Under Process', 'Under Verification', 'Hold Up', app.status] });
  const html = `
    <div style="margin-bottom:1rem; padding:0.75rem; background:var(--surface-alt); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
      <div class="font-mono" style="font-weight:800; color:var(--blue-600);">${esc(app.id)} — ${esc(app.serviceName)}</div>
      <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.2rem;">Customer: ${esc(app.customerName)} (${esc(app.phone)})</div>
      <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">
        Total: <strong>${formatINR(app.totalAmount)}</strong> (${esc(numberToWords(app.totalAmount))})
      </div>
    </div>

    <form onsubmit="window.MJK.submitApplicationUpdate(event, '${app.id}')">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Update Status</label>
          <select id="upd-app-status" class="form-control">
            ${statusOptions
              .map((st) => `<option value="${escAttr(st)}" ${app.status === st ? 'selected' : ''}>${esc(st)}</option>`)
              .join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Assign Staff</label>
          <select id="upd-app-staff" class="form-control">
            ${users.map((u) => `<option value="${esc(u.uid)}" ${app.assignedStaffUid === u.uid ? 'selected' : ''}>${esc(u.name)} (${esc(u.uid)})</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Paid Amount (₹)</label>
          <input type="number" id="upd-app-paid" class="form-control" value="${app.paidAmount}" min="0" max="${app.totalAmount}" oninput="window.MJK.syncAmountWords(this, 'upd-app-paid-words')">
          <div id="upd-app-paid-words" class="amount-words-hint">Amount in Words: ${esc(numberToWords(app.paidAmount))}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Timeline Note</label>
          <input type="text" id="upd-app-note" class="form-control" placeholder="e.g. Verified documents">
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
        <button type="submit" class="btn btn-primary btn-sm">Update Application</button>
      </div>
    </form>

    <div style="margin-top:1.1rem; border-top:1px solid var(--border-subtle); padding-top:0.85rem;">
      <div style="font-size:0.78rem; font-weight:700; margin-bottom:0.5rem;">Chronological Timeline (${(app.timeline || []).length})</div>
      <div style="max-height:180px; overflow-y:auto; display:flex; flex-direction:column; gap:0.4rem;">
        ${(app.timeline || [])
          .map(
            (t) => `
          <div style="padding:0.5rem 0.65rem; background:var(--surface-alt); border-radius:var(--radius-sm); font-size:0.76rem;">
            <div style="display:flex; justify-content:space-between;">
              <strong>${esc(t.status)}</strong>
              <span class="font-mono" style="color:var(--text-muted);">${formatDateTime(t.timestamp)}</span>
            </div>
            <div style="color:var(--text-muted);">${esc(t.note)} (By ${esc(t.actorUid)})</div>
          </div>`
          )
          .join('')}
      </div>
    </div>
  `;
  modalFn(`Manage Application ${app.id}`, html, null);
}

export async function submitApplicationUpdate(e, appId) {
  e.preventDefault();
  const payload = {
    status: document.getElementById('upd-app-status')?.value,
    assignedStaffUid: document.getElementById('upd-app-staff')?.value,
    paidAmount: Number(document.getElementById('upd-app-paid')?.value || 0),
    timelineNote: document.getElementById('upd-app-note')?.value.trim()
  };
  const resp = await fetch(`/api/applications/${encodeURIComponent(appId)}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  toastFn(data.message || 'Updated', resp.ok ? 'success' : 'danger');
  if (resp.ok) {
    closeModalFn();
    refreshApplicationsList();
  }
}

// ---------------------------------------------------------------------------
// 4. MURSHIDABAD 5-AREA VILLAGE & PIN CODE MASTER + BULK EXCEL/CSV CENTER
// ---------------------------------------------------------------------------
let locOverview = null;
let locDomkalData = null;
let locAllEntries = [];
let locActiveArea = 'ALL';
let locActiveGpOrWard = 'ALL';
let locActiveStatus = 'ALL';
let locSearchQuery = '';
let locImportStagedRows = [];

export function renderLocationsMasterView() {
  return `
    <div class="page-header" style="flex-wrap:wrap; gap:0.85rem;">
      <div>
        <h2 class="page-title">🗺️ Murshidabad Village & PIN Code Master Database</h2>
        <p class="page-subtitle">
          Complete verified Census 2011 & India Post PIN directory for Domkal Block, Domkal Municipality (21 Wards), Jalangi, Raninagar-I & Raninagar-II.
        </p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.45rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddLocationModal()">+ Add Village / Locality</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openAutoVerifyLocationModal()">✓ Verify & Auto-Add</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openLocationImportModal()">📥 Import Excel / CSV</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printLocationsMasterReport()">🖨 Print</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportLocationsPDF()">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportLocationsFile('xlsx')">📊 Export Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportLocationsFile('csv')">📄 Export CSV</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openPollingStationModal()">+ Booth</button>
      </div>
    </div>

    <div id="locations-master-body">
      <div class="card" style="padding:2rem; text-align:center; color:var(--text-muted);">Loading Murshidabad Village & PIN Code database...</div>
    </div>
  `;
}

export async function loadLocationsMasterBody() {
  const container = document.getElementById('locations-master-body');
  if (!container) return;

  try {
    const [ovResp, domResp, allJson] = await Promise.all([
      MurshidabadVillageDb.getMurshidabadOverview(),
      MurshidabadVillageDb.getDomkalWardBreakdown(),
      MurshidabadVillageDb.listMurshidabadVillages()
    ]);
    locOverview = ovResp;
    locDomkalData = domResp;
    locAllEntries = Array.isArray(allJson.entries) ? allJson.entries : [];
    paintLocationsMasterBody();
  } catch {
    container.innerHTML = `<div class="card" style="padding:1.5rem; color:var(--danger);">Failed to load Murshidabad Village & PIN Code database.</div>`;
  }
}

function getFilteredLocationEntries() {
  const q = locSearchQuery.trim().toLowerCase();
  return locAllEntries.filter((e) => {
    if (locActiveArea !== 'ALL' && e.blockOrMunicipality !== locActiveArea) return false;
    if (locActiveGpOrWard !== 'ALL' && e.gpOrWard !== locActiveGpOrWard) return false;
    if (locActiveStatus !== 'ALL' && e.verificationStatus !== locActiveStatus) return false;
    if (q) {
      const hay = `${e.district || 'Murshidabad'} ${e.name} ${e.villageOrLocality || ''} ${e.originalSpelling || ''} ${e.pinCode} ${e.gpOrWard} ${e.blockOrMunicipality} ${e.postOffice} ${e.policeStation} ${e.mouzaName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function buildLocationsTableHtml(rows) {
  const cur = getCurrentUser();
  const isAdmin = cur && ['ADMIN', 'MANAGER'].includes(String(cur.role || '').toUpperCase());
  const isSuper = isSuperAdmin(cur);

  if (!rows.length) {
    return `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-size:0.86rem;">No villages or localities match your current search/filters. Try clearing filters or use "Verify & Auto-Add".</div>`;
  }

  return `
    <div class="table-responsive">
      <table class="data-table" style="font-size:0.82rem;">
        <thead>
          <tr>
            <th>District</th>
            <th>Block / Municipality</th>
            <th>GP / Ward</th>
            <th>Village / Locality</th>
            <th>PIN Code</th>
            <th>Post Office &amp; P.S.</th>
            <th>Status</th>
            ${isAdmin || isSuper ? '<th style="text-align:right;">Actions</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows
            .slice(0, 400)
            .map((r) => `
            <tr>
              <td>
                <div style="font-weight:700;">${esc(r.district || 'Murshidabad')}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">West Bengal</div>
              </td>
              <td>
                <div style="font-weight:700;">${esc(r.blockOrMunicipality)}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${r.areaType === 'URBAN' ? 'Urban Municipality' : 'Rural CD Block'}</div>
              </td>
              <td class="font-mono" style="font-size:0.78rem; color:var(--blue-600); font-weight:700;">${esc(r.gpOrWard)}</td>
              <td>
                <div style="font-weight:700;">${esc(r.villageOrLocality || r.name)}</div>
                ${r.originalSpelling && r.originalSpelling !== r.name ? `<div style="font-size:0.7rem; color:var(--text-muted);">Source: ${esc(r.originalSpelling)}</div>` : ''}
              </td>
              <td class="tabular-nums font-mono" style="font-weight:800; color:var(--text-main); font-size:0.88rem;">${esc(r.pinCode || '------')}</td>
              <td>
                <div>${esc(r.postOffice || '-')}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">P.S. ${esc(r.policeStation || '-')}</div>
              </td>
              <td>
                <span class="badge ${r.verificationStatus === 'VERIFIED' ? 'badge-success' : r.verificationStatus === 'REJECTED' ? 'badge-danger' : 'badge-warning'}" style="font-size:0.68rem;">
                  ${r.verificationStatus === 'VERIFIED' ? 'VERIFIED' : r.verificationStatus}
                </span>
              </td>
              ${
                isAdmin || isSuper
                  ? `<td style="text-align:right; white-space:nowrap;">
                      ${r.verificationStatus !== 'VERIFIED' && isSuper ? `<button type="button" class="btn btn-success btn-sm" onclick="window.MJK.verifyLocationEntry('${escAttr(r.id)}', '${escAttr(r.areaType)}')">✓ Approve</button>` : ''}
                      <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openEditLocationEntryModal('${escAttr(r.id)}')">✎ Edit</button>
                      <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteLocationEntry('${escAttr(r.id)}', '${escAttr(r.villageOrLocality || r.name)}')">🗑 Delete</button>
                    </td>`
                  : ''
              }
            </tr>`)
            .join('')}
        </tbody>
      </table>
    </div>
    ${rows.length > 400 ? `<div style="padding:0.6rem 1rem; font-size:0.76rem; color:var(--text-muted); border-top:1px solid var(--border-subtle);">Showing first 400 of ${rows.length} entries. Filter by Block/Municipality or search by Village/PIN to narrow results.</div>` : ''}
  `;
}

function paintLocationsMasterBody() {
  const container = document.getElementById('locations-master-body');
  if (!container || !locOverview || !locDomkalData) return;

  const counts = locOverview.actualVerifiedCounts || {};
  const ac = counts.areaCounts || {};
  const wards = locDomkalData.wards || [];
  const filteredRows = getFilteredLocationEntries();

  const uniqueGpWards = Array.from(
    new Set(
      locAllEntries
        .filter((e) => locActiveArea === 'ALL' || e.blockOrMunicipality === locActiveArea)
        .map((e) => e.gpOrWard)
        .filter(Boolean)
    )
  ).sort();

  const finderAreas = ['Domkal', 'Domkal Municipality', 'Jalangi', 'Raninagar-I', 'Raninagar-II'];
  const quickFinderArea = locActiveArea !== 'ALL' ? locActiveArea : 'Domkal';
  const quickFinderVillages = locAllEntries.filter((e) => e.blockOrMunicipality === quickFinderArea);

  container.innerHTML = `
    <!-- Summary KPI Strip -->
    <div class="stats-grid" style="margin-bottom:1rem;">
      <div class="stat-card">
        <div class="stat-label">Total Verified Villages & Localities</div>
        <div class="stat-value tabular-nums">${locAllEntries.length}</div>
        <div class="stat-desc">Domkal: ${ac.domkalBlock || 0} · Jalangi: ${ac.jalangiBlock || 0} · Raninagar-I: ${ac.raninagar1Block || 0} · Raninagar-II: ${ac.raninagar2Block || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Domkal Municipality (LGD 273007)</div>
        <div class="stat-value tabular-nums">${wards.length} Wards</div>
        <div class="stat-desc">${ac.domkalMunicipalityLocalities || 0} Localities (${counts.domkalLocalitiesVerified || 0} Verified)</div>
        <div style="margin-top:0.45rem;">
          <button type="button" class="btn btn-primary btn-sm" style="padding:0.18rem 0.5rem; font-size:0.72rem;" onclick="window._anpActiveTab='masters'; window.MJK.navigateTo('govt-annapurna');">
            Manage Annapurna Ward &amp; Village Master
          </button>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">India Post PIN Codes Covered</div>
        <div class="stat-value tabular-nums font-mono">8 PINs</div>
        <div class="stat-desc font-mono" style="font-size:0.74rem;">742303 · 742406 · 742121 · 742305 · 742306 · 742304 · 742302 · 742308</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Filtered Results</div>
        <div id="loc-filtered-count" class="stat-value tabular-nums" style="color:var(--blue-600);">${filteredRows.length}</div>
        <div class="stat-desc">Zero duplicates · Verified Census 2011 &amp; LGD records</div>
      </div>
    </div>

    <!-- Interactive Dependent Dropdown Quick PIN Finder -->
    <div class="card" style="padding:1rem; margin-bottom:1rem;">
      <div style="font-weight:800; font-size:0.9rem; margin-bottom:0.65rem;">🔎 Quick Dependent PIN Code Finder (District → Block/Municipality → Village/Locality → Auto PIN)</div>
      <div class="form-row" style="margin-bottom:0; align-items:end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">1. District</label>
          <select class="form-control" disabled><option value="Murshidabad">Murshidabad (West Bengal)</option></select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">2. Block / Municipality</label>
          <select id="loc-qf-area" class="form-control" onchange="window.MJK.updateQuickPinFinderArea(this.value)">
            ${finderAreas.map((a) => `<option value="${esc(a)}" ${quickFinderArea === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">3. Village / Locality</label>
          <select id="loc-qf-village" class="form-control" onchange="window.MJK.updateQuickPinFinderVillage(this.value)">
            <option value="">-- Select Village / Locality (${quickFinderVillages.length}) --</option>
            ${quickFinderVillages.map((v) => `<option value="${esc(v.id)}">${esc(v.name)} (${esc(v.gpOrWard)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">4. Auto-Displayed PIN &amp; Post Office</label>
          <div id="loc-qf-output" class="form-control tabular-nums font-mono" style="display:flex; align-items:center; font-weight:800; background:var(--surface-alt); color:var(--blue-700);">
            Select a village to view PIN
          </div>
        </div>
      </div>
    </div>

    <!-- Full Searchable Village & Municipality Table -->
    <div class="table-card">
      <div class="table-toolbar" style="flex-wrap:wrap; gap:0.5rem;">
        <div class="table-toolbar-left" style="flex-wrap:wrap; gap:0.5rem;">
          <input
            type="text"
            id="loc-master-search"
            class="form-control toolbar-search"
            placeholder="Search Village Name or 6-digit PIN (e.g. Mamudpur or 742406)..."
            value="${esc(locSearchQuery)}"
            oninput="window.MJK.onLocMasterSearchInput(this.value)"
          >
          <select class="form-control toolbar-select" onchange="window.MJK.setLocMasterFilter('area', this.value)">
            <option value="ALL" ${locActiveArea === 'ALL' ? 'selected' : ''}>All 5 Target Areas (${locAllEntries.length})</option>
            <option value="Domkal" ${locActiveArea === 'Domkal' ? 'selected' : ''}>Domkal Block (${ac.domkalBlock || 0})</option>
            <option value="Domkal Municipality" ${locActiveArea === 'Domkal Municipality' ? 'selected' : ''}>Domkal Municipality (21 Wards)</option>
            <option value="Jalangi" ${locActiveArea === 'Jalangi' ? 'selected' : ''}>Jalangi Block (${ac.jalangiBlock || 0})</option>
            <option value="Raninagar-I" ${locActiveArea === 'Raninagar-I' ? 'selected' : ''}>Raninagar-I Block (${ac.raninagar1Block || 0})</option>
            <option value="Raninagar-II" ${locActiveArea === 'Raninagar-II' ? 'selected' : ''}>Raninagar-II Block (${ac.raninagar2Block || 0})</option>
          </select>
          <select class="form-control toolbar-select" onchange="window.MJK.setLocMasterFilter('gpward', this.value)">
            <option value="ALL">All GPs / Wards (${uniqueGpWards.length})</option>
            ${uniqueGpWards.map((gw) => `<option value="${esc(gw)}" ${locActiveGpOrWard === gw ? 'selected' : ''}>${esc(gw)}</option>`).join('')}
          </select>
          <select class="form-control toolbar-select" onchange="window.MJK.setLocMasterFilter('status', this.value)">
            <option value="ALL" ${locActiveStatus === 'ALL' ? 'selected' : ''}>All Statuses</option>
            <option value="VERIFIED" ${locActiveStatus === 'VERIFIED' ? 'selected' : ''}>VERIFIED Only</option>
            <option value="PENDING_VERIFICATION" ${locActiveStatus === 'PENDING_VERIFICATION' ? 'selected' : ''}>PENDING Only</option>
          </select>
        </div>
      </div>

      <div id="loc-master-table-wrap">
        ${buildLocationsTableHtml(filteredRows)}
      </div>
    </div>
  `;
}

export function onLocMasterSearchInput(val) {
  locSearchQuery = String(val || '');
  const filtered = getFilteredLocationEntries();
  const wrap = document.getElementById('loc-master-table-wrap');
  const countEl = document.getElementById('loc-filtered-count');
  if (wrap) wrap.innerHTML = buildLocationsTableHtml(filtered);
  if (countEl) countEl.textContent = String(filtered.length);
}

export function setLocMasterFilter(kind, value) {
  if (kind === 'area') {
    locActiveArea = value;
    locActiveGpOrWard = 'ALL';
    paintLocationsMasterBody();
    return;
  }
  if (kind === 'gpward') {
    locActiveGpOrWard = value;
  } else if (kind === 'status') {
    locActiveStatus = value;
  }
  const filtered = getFilteredLocationEntries();
  const wrap = document.getElementById('loc-master-table-wrap');
  const countEl = document.getElementById('loc-filtered-count');
  if (wrap) wrap.innerHTML = buildLocationsTableHtml(filtered);
  if (countEl) countEl.textContent = String(filtered.length);
}

export function updateQuickPinFinderArea(area) {
  const vilSel = document.getElementById('loc-qf-village');
  const outEl = document.getElementById('loc-qf-output');
  if (!vilSel) return;
  const list = locAllEntries.filter((e) => e.blockOrMunicipality === area);
  vilSel.innerHTML =
    `<option value="">-- Select Village / Locality (${list.length}) --</option>` +
    list.map((v) => `<option value="${esc(v.id)}">${esc(v.name)} (${esc(v.gpOrWard)})</option>`).join('');
  if (outEl) outEl.textContent = 'Select a village to view PIN';
}

export function updateQuickPinFinderVillage(entryId) {
  const outEl = document.getElementById('loc-qf-output');
  if (!outEl) return;
  const rec = locAllEntries.find((e) => e.id === entryId);
  if (!rec) {
    outEl.textContent = 'Select a village to view PIN';
    return;
  }
  outEl.textContent = `${rec.pinCode || 'N/A'} · P.O. ${rec.postOffice || '-'} (${rec.gpOrWard})`;
}

export function setDomkalWardFilter(wardCode) {
  locActiveArea = 'Domkal Municipality';
  locActiveGpOrWard = wardCode;
  paintLocationsMasterBody();
}

export function openAddLocationModal() {
  const html = `
    <form onsubmit="window.MJK.submitAddLocationModal(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">District *</label>
          <input type="text" id="add-loc-district" class="form-control" required value="Murshidabad" placeholder="Murshidabad">
        </div>
        <div class="form-group">
          <label class="form-label">Block / Municipality *</label>
          <select id="add-loc-block" class="form-control" required onchange="const t=document.getElementById('add-loc-type'); if(t){ t.value = this.value === 'Domkal Municipality' ? 'URBAN' : 'RURAL'; }">
            <option value="Domkal">Domkal Block</option>
            <option value="Domkal Municipality">Domkal Municipality</option>
            <option value="Jalangi">Jalangi Block</option>
            <option value="Raninagar-I">Raninagar-I Block</option>
            <option value="Raninagar-II">Raninagar-II Block</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Village / Locality *</label>
          <input type="text" id="add-loc-name" class="form-control" required placeholder="Official village or para name">
        </div>
        <div class="form-group">
          <label class="form-label">6-Digit Indian PIN Code *</label>
          <input type="text" id="add-loc-pin" class="form-control font-mono" maxlength="6" pattern="[0-9]{6}" required placeholder="e.g. 742406">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Area Type *</label>
          <select id="add-loc-type" class="form-control" onchange="const w=document.getElementById('add-loc-block'); if(w && this.value==='URBAN'){ w.value='Domkal Municipality'; }">
            <option value="RURAL">Rural (CD Block / Gram Panchayat)</option>
            <option value="URBAN">Urban (Municipality / Ward)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Gram Panchayat / Ward (e.g. Juginda or WARD 03) *</label>
          <input type="text" id="add-loc-gpward" class="form-control" required placeholder="e.g. Juginda or WARD 16">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Post Office (P.O.)</label>
          <input type="text" id="add-loc-po" class="form-control" placeholder="e.g. Juginda">
        </div>
        <div class="form-group">
          <label class="form-label">Police Station (P.S.)</label>
          <input type="text" id="add-loc-ps" class="form-control" placeholder="e.g. Domkal">
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Verified Entry</button>
      </div>
    </form>
  `;
  modalFn('Add Murshidabad Village / Municipality Locality', html, null);
}

export async function submitAddLocationModal(e) {
  e.preventDefault();
  const blockVal = document.getElementById('add-loc-block')?.value;
  const payload = {
    areaType: blockVal === 'Domkal Municipality' ? 'URBAN' : document.getElementById('add-loc-type')?.value,
    district: document.getElementById('add-loc-district')?.value.trim() || 'Murshidabad',
    blockOrMunicipality: blockVal,
    gpOrWard: document.getElementById('add-loc-gpward')?.value.trim(),
    villageOrLocality: document.getElementById('add-loc-name')?.value.trim(),
    postOffice: document.getElementById('add-loc-po')?.value.trim(),
    policeStation: document.getElementById('add-loc-ps')?.value.trim(),
    pinCode: document.getElementById('add-loc-pin')?.value.replace(/[^0-9]/g, '').slice(0, 6),
    verificationStatus: 'VERIFIED'
  };
  const data = await MurshidabadVillageDb.createMurshidabadVillage(payload);
  toastFn(data.message || 'Done', data.ok && data.success ? 'success' : 'danger');
  if (data.ok && data.success) {
    closeModalFn();
    loadLocationsMasterBody();
  }
}

export function openAutoVerifyLocationModal() {
  const html = `
    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">
      Verifies the 6-digit PIN Code directly against official India Post records for Murshidabad before automatically adding a missing village or locality (preventing guessed PINs and duplicates).
    </div>
    <form onsubmit="window.MJK.submitAutoVerifyLocationModal(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Block / Municipality *</label>
          <select id="auto-loc-block" class="form-control" required>
            <option value="Domkal">Domkal Block</option>
            <option value="Domkal Municipality">Domkal Municipality</option>
            <option value="Jalangi">Jalangi Block</option>
            <option value="Raninagar-I">Raninagar-I Block</option>
            <option value="Raninagar-II">Raninagar-II Block</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">GP or Ward (Optional)</label>
          <input type="text" id="auto-loc-gpward" class="form-control" placeholder="e.g. Juginda or WARD 05">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Missing Village / Locality Name *</label>
          <input type="text" id="auto-loc-name" class="form-control" required placeholder="Official Village Name">
        </div>
        <div class="form-group">
          <label class="form-label">6-Digit PIN Code *</label>
          <input type="text" id="auto-loc-pin" class="form-control font-mono" maxlength="6" pattern="[0-9]{6}" required placeholder="e.g. 742303">
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Verify PIN &amp; Auto-Add</button>
      </div>
    </form>
  `;
  modalFn('Verify & Auto-Add Missing Murshidabad Village', html, null);
}

export async function submitAutoVerifyLocationModal(e) {
  e.preventDefault();
  const blockVal = document.getElementById('auto-loc-block')?.value || 'Domkal';
  const payload = {
    areaType: blockVal === 'Domkal Municipality' ? 'URBAN' : 'RURAL',
    district: 'Murshidabad',
    blockOrMunicipality: blockVal,
    gpOrWard: document.getElementById('auto-loc-gpward')?.value.trim(),
    villageOrLocality: document.getElementById('auto-loc-name')?.value.trim(),
    pinCode: document.getElementById('auto-loc-pin')?.value.replace(/[^0-9]/g, '').slice(0, 6)
  };
  const data = await MurshidabadVillageDb.autoVerifyMurshidabadVillage(payload);
  toastFn(data.message || 'Verified', data.ok && data.success ? 'success' : 'danger');
  if (data.ok && data.success) {
    closeModalFn();
    loadLocationsMasterBody();
  }
}

export function openEditLocationEntryModal(entryId) {
  const rec = locAllEntries.find((e) => e.id === entryId);
  if (!rec) return;
  const knownBlocks = ['Domkal', 'Domkal Municipality', 'Jalangi', 'Raninagar-I', 'Raninagar-II'];
  const currentBlock = rec.blockOrMunicipality || 'Domkal';
  const html = `
    <form onsubmit="window.MJK.submitEditLocationEntryModal(event, '${escAttr(rec.id)}')">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">District *</label>
          <input type="text" id="edit-loc-district" class="form-control" required value="${esc(rec.district || 'Murshidabad')}">
        </div>
        <div class="form-group">
          <label class="form-label">Block / Municipality *</label>
          <select id="edit-loc-block" class="form-control" required ${rec.areaType === 'URBAN' ? 'disabled' : ''}>
            ${knownBlocks.map((b) => `<option value="${esc(b)}" ${currentBlock === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}
            ${!knownBlocks.includes(currentBlock) ? `<option value="${esc(currentBlock)}" selected>${esc(currentBlock)}</option>` : ''}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Village / Locality *</label>
          <input type="text" id="edit-loc-name" class="form-control" required value="${esc(rec.villageOrLocality || rec.name)}">
        </div>
        <div class="form-group">
          <label class="form-label">${rec.areaType === 'URBAN' ? 'Ward Code' : 'Gram Panchayat'} *</label>
          <input type="text" id="edit-loc-gpward" class="form-control" required value="${esc(rec.gpOrWard)}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Post Office (P.O.)</label>
          <input type="text" id="edit-loc-po" class="form-control" value="${esc(rec.postOffice)}">
        </div>
        <div class="form-group">
          <label class="form-label">Police Station (P.S.)</label>
          <input type="text" id="edit-loc-ps" class="form-control" value="${esc(rec.policeStation)}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">6-Digit PIN Code *</label>
          <input type="text" id="edit-loc-pin" class="form-control font-mono" maxlength="6" pattern="[0-9]{6}" required value="${esc(rec.pinCode)}">
        </div>
        <div class="form-group">
          <label class="form-label">Verification Status</label>
          <select id="edit-loc-status" class="form-control">
            <option value="VERIFIED" ${rec.verificationStatus === 'VERIFIED' ? 'selected' : ''}>VERIFIED</option>
            <option value="PENDING_VERIFICATION" ${rec.verificationStatus === 'PENDING_VERIFICATION' ? 'selected' : ''}>PENDING_VERIFICATION</option>
          </select>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>
  `;
  modalFn(`Edit Entry: ${rec.villageOrLocality || rec.name}`, html, null);
}

export async function submitEditLocationEntryModal(e, entryId) {
  e.preventDefault();
  const existing = locAllEntries.find((item) => item.id === entryId);
  const payload = {
    areaType: existing?.areaType || 'RURAL',
    district: document.getElementById('edit-loc-district')?.value.trim() || existing?.district || 'Murshidabad',
    blockOrMunicipality: document.getElementById('edit-loc-block')?.value || existing?.blockOrMunicipality || 'Domkal',
    villageOrLocality: document.getElementById('edit-loc-name')?.value.trim(),
    gpOrWard: document.getElementById('edit-loc-gpward')?.value.trim(),
    postOffice: document.getElementById('edit-loc-po')?.value.trim(),
    policeStation: document.getElementById('edit-loc-ps')?.value.trim(),
    pinCode: document.getElementById('edit-loc-pin')?.value.replace(/[^0-9]/g, '').slice(0, 6),
    verificationStatus: document.getElementById('edit-loc-status')?.value
  };
  const data = await MurshidabadVillageDb.updateMurshidabadVillage(entryId, payload);
  toastFn(data.message || 'Updated', data.ok && data.success ? 'success' : 'danger');
  if (data.ok && data.success) {
    closeModalFn();
    loadLocationsMasterBody();
  }
}

export function promptDeleteLocationEntry(entryId, name) {
  confirmFn(
    'Delete Village / Locality Entry?',
    `Remove "${name}" from the Murshidabad Location Master? Existing customer records keep their saved addresses.`,
    async () => {
      const data = await MurshidabadVillageDb.deleteMurshidabadVillage(entryId);
      toastFn(data.message || 'Deleted', data.ok ? 'warning' : 'danger');
      if (data.ok) loadLocationsMasterBody();
    }
  );
}

export async function verifyLocationEntry(entryId, areaType) {
  const data = await MurshidabadVillageDb.verifyMurshidabadVillage(entryId, areaType, 'APPROVE');
  toastFn(data.message || 'Approved', data.ok ? 'success' : 'danger');
  if (data.ok) loadLocationsMasterBody();
}

export function exportLocationsFile(format = 'xlsx') {
  const list = getFilteredLocationEntries();
  if (!list.length) {
    toastFn('No filtered location rows to export.', 'warning');
    return;
  }
  const headers = ['Area Type', 'District', 'Block / Municipality', 'GP / Ward', 'Mouza', 'Village / Locality', 'Post Office', 'Police Station', 'PIN Code', 'Status', 'Source'];
  const rows = list.map((r) => [
    r.areaType || '-',
    r.district || 'Murshidabad',
    r.blockOrMunicipality || '-',
    r.gpOrWard || '-',
    r.mouzaName || '-',
    r.name || '-',
    r.postOffice || '-',
    r.policeStation || '-',
    r.pinCode || '-',
    r.verificationStatus || '-',
    r.sourceName || '-'
  ]);
  const subtitle = `Area: ${locActiveArea} | GP/Ward: ${locActiveGpOrWard} | Status: ${locActiveStatus}`;
  if (format === 'csv') {
    exportUniversalCSV({
      filename: 'Murshidabad_Villages_PIN',
      title: 'MURSHIDABAD VILLAGE & PIN CODE MASTER DIRECTORY',
      subtitle,
      headers,
      rows,
      totalsRow: ['TOTAL', `${rows.length} Locations`, '', '', '', '', '', '', '', '', '']
    });
  } else {
    exportUniversalExcel({
      filename: 'Murshidabad_Villages_PIN',
      sheetName: 'Murshidabad_Locations',
      title: 'MURSHIDABAD VILLAGE & PIN CODE MASTER DIRECTORY',
      subtitle,
      headers,
      rows,
      totalsRow: ['TOTAL', `${rows.length} Locations`, '', '', '', '', '', '', '', '', '']
    });
  }
  toastFn(`Exported ${rows.length} rows as ${format.toUpperCase()} with official header.`, 'success');
}

export async function exportLocationsPDF() {
  const list = getFilteredLocationEntries();
  if (!list.length) {
    toastFn('No filtered location rows to export.', 'warning');
    return;
  }
  const headers = ['Area', 'Block / Municipality', 'GP / Ward', 'Village / Locality', 'Post Office', 'Police Station', 'PIN', 'Status'];
  const rows = list.map((r) => [r.areaType || '-', r.blockOrMunicipality || '-', r.gpOrWard || '-', r.name || '-', r.postOffice || '-', r.policeStation || '-', r.pinCode || '-', r.verificationStatus || '-']);
  await exportUniversalPDF({
    filename: 'Murshidabad_Villages_PIN',
    title: 'MURSHIDABAD VILLAGE & PIN CODE MASTER DIRECTORY',
    subtitle: `Area: ${locActiveArea} | Records: ${rows.length}`,
    headers,
    rows,
    totalsRow: ['TOTAL', `${rows.length} Locations`, '-', '-', '-', '-', '-', 'VERIFIED']
  });
  toastFn(`Exported ${rows.length} locations to PDF.`, 'success');
}

export function printLocationsMasterReport() {
  const list = getFilteredLocationEntries();
  if (!list.length) {
    toastFn('No filtered location rows to print.', 'warning');
    return;
  }
  const headers = ['Area', 'Block / Municipality', 'GP / Ward', 'Village / Locality', 'Post Office', 'Police Station', 'PIN', 'Status'];
  const rows = list.map((r) => [r.areaType || '-', r.blockOrMunicipality || '-', r.gpOrWard || '-', r.name || '-', r.postOffice || '-', r.policeStation || '-', r.pinCode || '-', r.verificationStatus || '-']);
  printUniversalReport({
    title: 'MURSHIDABAD VILLAGE & PIN CODE MASTER DIRECTORY',
    subtitle: `Area: ${locActiveArea} | Records: ${rows.length}`,
    filename: 'Murshidabad_Villages_PIN',
    headers,
    rows,
    totalsRow: ['TOTAL', `${rows.length} Locations`, '-', '-', '-', '-', '-', 'VERIFIED']
  });
}

export function verifyDomkalLocality(localityId) {
  return verifyLocationEntry(localityId, 'URBAN');
}

export function openEditLocalitySpelling(localityId) {
  return openEditLocationEntryModal(localityId);
}

export function openPollingStationModal() {
  const html = `
    <form onsubmit="window.MJK.submitPollingStation(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Domkal Ward (WARD 01-21) *</label>
          <select id="ps-ward" class="form-control" required>
            ${Array.from({ length: 21 }, (_, i) => `WARD ${String(i + 1).padStart(2, '0')}`)
              .map((w) => `<option value="${w}">${w}</option>`)
              .join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Polling Station Number *</label>
          <input type="text" id="ps-num" class="form-control font-mono" placeholder="e.g. 142" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Polling Station / School Name *</label>
        <input type="text" id="ps-name" class="form-control" placeholder="Exact booth name from CP_01.pdf" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Building / Locality</label>
          <input type="text" id="ps-building" class="form-control" placeholder="Locality / Para">
        </div>
        <div class="form-group">
          <label class="form-label">Source Document</label>
          <input type="text" id="ps-source" class="form-control" value="CP_01.pdf (Verified Upload)">
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Polling Station</button>
      </div>
    </form>
  `;
  modalFn('Register Verified Ward Polling Station', html, null);
}

export async function submitPollingStation(e) {
  e.preventDefault();
  const payload = {
    wardCode: document.getElementById('ps-ward')?.value,
    psNumber: document.getElementById('ps-num')?.value.trim(),
    psName: document.getElementById('ps-name')?.value.trim(),
    buildingOrLocality: document.getElementById('ps-building')?.value.trim(),
    sourceName: document.getElementById('ps-source')?.value.trim()
  };
  const resp = await fetch('/api/locations/polling-station', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  toastFn(data.success ? 'Polling station saved!' : data.message, data.success ? 'success' : 'danger');
  if (data.success) {
    closeModalFn();
    loadLocationsMasterBody();
  }
}

export function openLocationImportModal() {
  locImportStagedRows = [];
  const html = `
    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">
      Upload an <strong>Excel (.xlsx / .xls)</strong> or <strong>CSV (.csv)</strong> file, or paste CSV rows below. Columns supported: <code>areaType, district, block, gp, village, postOffice, pinCode</code> (or Urban <code>ward, locality, pinCode</code>). Exact duplicates are automatically skipped.
    </div>
    <div class="form-row" style="align-items:end; margin-bottom:0.75rem;">
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">Upload Excel / CSV File</label>
        <input type="file" id="loc-import-file" class="form-control" accept=".xlsx,.xls,.csv" onchange="window.MJK.handleLocationFileUpload(this)">
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.downloadImportTemplateExcel()">⬇ Download Sample Excel Template</button>
      </div>
    </div>
    <label class="form-label">Or Paste CSV Rows</label>
    <textarea id="loc-import-csv" class="form-control font-mono" rows="4" placeholder="RURAL,Murshidabad,Domkal,Domkal,Juginda,Mamudpur,Juginda,742406&#10;URBAN,Murshidabad,Domkal Municipality,WARD 03,Domkal,Nutan Para,Domkal,742303"></textarea>
    <div style="display:flex; gap:0.5rem; margin-top:0.75rem; flex-wrap:wrap;">
      <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.previewLocationImport()">1. Validate &amp; Check Duplicates</button>
      <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.commitLocationImport()">2. Import Non-Duplicate Rows</button>
    </div>
    <div id="loc-import-preview-out" style="margin-top:0.85rem; max-height:240px; overflow-y:auto;"></div>
  `;
  modalFn('Bulk Excel / CSV Location Import Center', html, null);
}

export function downloadImportTemplateExcel() {
  const sample = [
    { areaType: 'RURAL', district: 'Murshidabad', subdivision: 'Domkal', block: 'Domkal', gp: 'Juginda', village: 'Sample Village Name', postOffice: 'Juginda', pinCode: '742406' },
    { areaType: 'URBAN', district: 'Murshidabad', municipality: 'Domkal Municipality', ward: 'WARD 03', mouza: 'Domkal', locality: 'Sample Para Name', postOffice: 'Domkal', pinCode: '742303' }
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'Murshidabad_Village_Import_Template.xlsx');
}

export function handleLocationFileUpload(inputEl) {
  const file = inputEl?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const wb = XLSX.read(evt.target.result, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      locImportStagedRows = jsonRows.map((r) => ({
        areaType: r.areaType || r.AreaType || (r.ward || r.Ward || r.BlockOrMunicipality === 'Domkal Municipality' ? 'URBAN' : 'RURAL'),
        district: r.district || r.District || 'Murshidabad',
        subdivision: r.subdivision || r.Subdivision || 'Domkal',
        municipality: r.municipality || r.Municipality || '',
        block: r.block || r.Block || r.BlockOrMunicipality || '',
        ward: r.ward || r.Ward || (r.BlockOrMunicipality === 'Domkal Municipality' ? (r.GPOrWard || '') : ''),
        gp: r.gp || r.GP || r.GPOrWard || r.mouza || r.Mouza || '',
        village: r.village || r.Village || r.VillageOrLocality || r.locality || r.Locality || '',
        postOffice: r.postOffice || r.PostOffice || '',
        pinCode: String(r.pinCode || r.PinCode || r.PIN || '').replace(/[^0-9]/g, '').slice(0, 6)
      }));
      toastFn(`Loaded ${locImportStagedRows.length} rows from "${file.name}". Validating...`, 'info');
      previewLocationImport();
    } catch {
      toastFn('Could not parse Excel/CSV file.', 'danger');
    }
  };
  reader.readAsArrayBuffer(file);
}

function getImportRowsToProcess() {
  if (locImportStagedRows.length > 0) return locImportStagedRows;
  const raw = document.getElementById('loc-import-csv')?.value || '';
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [areaType, district, subdivisionOrMunicipality, blockOrWard, gpOrMouza, villageOrLocality, postOffice, pinCode] = line
        .split(',')
        .map((s) => (s || '').trim());
      return {
        areaType,
        district,
        subdivision: subdivisionOrMunicipality,
        municipality: areaType?.toUpperCase() === 'URBAN' ? subdivisionOrMunicipality : '',
        block: areaType?.toUpperCase() === 'URBAN' ? '' : blockOrWard,
        ward: areaType?.toUpperCase() === 'URBAN' ? blockOrWard : '',
        gp: gpOrMouza,
        village: villageOrLocality,
        postOffice,
        pinCode
      };
    });
}

export async function previewLocationImport() {
  const rows = getImportRowsToProcess();
  const out = document.getElementById('loc-import-preview-out');
  if (!rows.length) {
    if (out) out.innerHTML = `<div style="color:var(--warning); font-size:0.8rem;">Upload an Excel/CSV file or enter CSV lines above.</div>`;
    return;
  }
  const resp = await fetch('/api/locations/import/preview', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ rows })
  });
  const data = await resp.json();
  if (!resp.ok || !data.success) {
    if (out) out.innerHTML = `<div style="color:var(--danger);">${esc(data.message)}</div>`;
    return;
  }
  const previewObj = data.preview || {};
  const previewRows = Array.isArray(previewObj.rows) ? previewObj.rows : [];
  const sum = previewObj.summary || {};
  out.innerHTML = `
    <div style="font-size:0.78rem; margin-bottom:0.5rem; font-weight:700;">
      Total: ${sum.total || previewRows.length} · Exact Duplicates Skipped: ${sum.exactDuplicates || 0} · Missing PINs: ${sum.missingPins || 0}
    </div>
    <table class="data-table" style="font-size:0.76rem;">
      <thead><tr><th>#</th><th>Area</th><th>Block/Ward</th><th>Locality/Village</th><th>PIN</th><th>Check</th></tr></thead>
      <tbody>
        ${previewRows
          .slice(0, 120)
          .map(
            (r) => `
          <tr>
            <td>${r.rowIndex}</td>
            <td>${esc(r.areaType)}</td>
            <td>${esc(r.blockOrWard)}</td>
            <td>${esc(r.villageOrLocality)}</td>
            <td class="font-mono">${esc(r.pinCode || 'MISSING')}</td>
            <td><span class="badge ${r.duplicateFlag === 'NONE' && r.hierarchyValid ? 'badge-success' : 'badge-warning'}">${r.duplicateFlag !== 'NONE' ? esc(r.duplicateFlag) : esc(r.validationMessage)}</span></td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

export async function commitLocationImport() {
  const rows = getImportRowsToProcess();
  if (!rows.length) {
    toastFn('Please upload a file or paste CSV rows first.', 'warning');
    return;
  }
  const resp = await fetch('/api/locations/import/commit', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fileName: 'admin-bulk-import.xlsx', sourceName: 'Admin Excel/CSV Bulk Import', rows })
  });
  const data = await resp.json();
  toastFn(data.success ? `Batch ${data.batch.importId} imported (duplicates skipped).` : data.message, data.success ? 'success' : 'danger');
  if (data.success) {
    locImportStagedRows = [];
    closeModalFn();
    loadLocationsMasterBody();
  }
}

// ---------------------------------------------------------------------------
// 5. CUSTOMER MERGE & DOCUMENT VAULT UPLOAD & RECOVERY CODE
// ---------------------------------------------------------------------------
export function openCustomerMergeModal() {
  const customers = getItem(KEYS.CUSTOMERS, []);
  if (customers.length < 2) {
    toastFn('Need at least 2 customers in directory to merge duplicates.', 'info');
    return;
  }
  const opts = customers.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.id)} · ${esc(c.phone)})</option>`).join('');
  const html = `
    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.85rem;">
      Merge a duplicate customer profile into the primary record. All linked applications, services, visits & documents will be consolidated safely.
    </div>
    <form onsubmit="window.MJK.submitCustomerMerge(event)">
      <div class="form-group">
        <label class="form-label">Duplicate Source Customer (Will be archived/removed) *</label>
        <select id="merge-source-cust" class="form-control" required>${opts}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Target Primary Customer (Will retain all records) *</label>
        <select id="merge-target-cust" class="form-control" required>${opts}</select>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Merge Duplicate Into Primary</button>
      </div>
    </form>
  `;
  modalFn('Merge Duplicate Customers (Admin Only)', html, null);
}

export function submitCustomerMerge(e) {
  e.preventDefault();
  const srcId = document.getElementById('merge-source-cust')?.value;
  const tgtId = document.getElementById('merge-target-cust')?.value;
  if (!srcId || !tgtId || srcId === tgtId) {
    toastFn('Please select two distinct customer records.', 'danger');
    return;
  }

  // Merge in localStorage ERP store
  const customers = getItem(KEYS.CUSTOMERS, []);
  const src = customers.find((c) => c.id === srcId);
  const tgt = customers.find((c) => c.id === tgtId);
  if (!src || !tgt) return;

  const services = getItem(KEYS.SERVICES, []);
  services.forEach((s) => {
    if (s.customerId === srcId) {
      s.customerId = tgtId;
      s.customerName = tgt.name;
    }
  });
  localStorage.setItem(KEYS.SERVICES, JSON.stringify(services));
  localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers.filter((c) => c.id !== srcId)));
  logAuditAction('CUSTOMER_MERGED', `Merged duplicate ${src.name} (${srcId}) into ${tgt.name} (${tgtId})`);

  // Also notify central server if present
  fetch('/api/customers/merge', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ sourceId: srcId, targetId: tgtId })
  }).catch(() => {});

  closeModalFn();
  toastFn(`Successfully merged ${src.name} into ${tgt.name}!`, 'success');
  renderFn();
}

export function openRealDocumentUploadModal(presetAppId = '', presetCustomerId = '') {
  const users = getItem(KEYS.USERS, []).filter(u => u.status === 'ACTIVE');
  const html = `
    <form onsubmit="window.MJK.submitRealDocumentUpload(event)">
      <input type="hidden" id="doc-up-cust-id" value="${escAttr(presetCustomerId || '')}">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Document Title *</label>
          <input type="text" id="doc-up-title" class="form-control" required placeholder="e.g. Staff Police Verification / Aadhaar KYC / Trade License">
        </div>
        <div class="form-group">
          <label class="form-label">Category *</label>
          <select id="doc-up-cat" class="form-control">
            <option value="Staff Verification & KYC">Staff Verification & KYC</option>
            <option value="Confidential Staff Docs">Confidential Staff Docs</option>
            <option value="KYC / Identity Proof">KYC / Identity Proof</option>
            <option value="Application Attachment">Application Attachment</option>
            <option value="Grievance Proof / Receipt">Grievance Proof / Receipt</option>
            <option value="Trade License & Registration">Trade License & Registration</option>
            <option value="PNB CSP / Banking">PNB CSP / Banking</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Linked Staff Member (Optional)</label>
          <select id="doc-up-staff-uid" class="form-control">
            <option value="">General / Customer Document</option>
            ${users.map(u => `<option value="${escAttr(u.uid || u.id || '')}">${esc(u.name)} (${esc(u.uid || u.id || '')})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Linked Application / Customer ID</label>
          <input type="text" id="doc-up-link" class="form-control font-mono" value="${escAttr(presetAppId || presetCustomerId || '')}" placeholder="Optional CUST- / APP-">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Expiry Date (Optional)</label>
          <input type="date" id="doc-up-expiry" class="form-control">
        </div>
        <div class="form-group">
          <label class="form-label">Select File (PDF, JPG, PNG ≤ 5MB) *</label>
          <input type="file" id="doc-up-file" class="form-control" accept=".pdf,.jpg,.jpeg,.png,.webp" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Remarks</label>
        <input type="text" id="doc-up-remarks" class="form-control" placeholder="Optional confidential / verification notes">
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Upload Securely</button>
      </div>
    </form>
  `;
  modalFn('Secure Document Upload (Central Vault)', html, null);
}

export function submitRealDocumentUpload(e) {
  e.preventDefault();
  const fileEl = document.getElementById('doc-up-file');
  const file = fileEl?.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toastFn('File size exceeds 5 MB limit.', 'danger');
    return;
  }
  const customerId = document.getElementById('doc-up-cust-id')?.value.trim() || '';
  const applicationId = document.getElementById('doc-up-link')?.value.trim() || '';
  const userId = document.getElementById('doc-up-staff-uid')?.value.trim() || '';
  const expiryDate = document.getElementById('doc-up-expiry')?.value.trim() || '';
  const reader = new FileReader();
  reader.onload = async () => {
    const payload = {
      title: document.getElementById('doc-up-title')?.value.trim(),
      category: document.getElementById('doc-up-cat')?.value,
      customerId,
      applicationId,
      userId,
      expiryDate,
      remarks: document.getElementById('doc-up-remarks')?.value.trim(),
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64Data: String(reader.result || '')
    };
    const resp = await fetch('/api/documents/upload', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (resp.ok && data.success && data.document) {
      const docs = getItem(KEYS.DOCUMENTS, []);
      docs.unshift({
        id: data.document.id,
        name: data.document.title,
        category: data.document.category,
        customerId: customerId || data.document.customerId || '',
        applicationId: applicationId || data.document.applicationId || '',
        staffUid: userId || data.document.userId || '',
        userId: userId || data.document.userId || '',
        uploadDate: data.document.createdAt.split('T')[0],
        expiryDate: expiryDate || data.document.expiryDate || '',
        file: `${data.document.fileName} (/api/documents/${data.document.id}/download)`,
        downloadUrl: `/api/documents/${data.document.id}/download`,
        remarks: data.document.remarks,
        fromServer: true
      });
      localStorage.setItem(KEYS.DOCUMENTS, JSON.stringify(docs));
      closeModalFn();
      toastFn(data.message, 'success');
      if (customerId && window.MJK?.activeCustProfileId === customerId && window.MJK?.viewCustomerProfile) {
        window.MJK.viewCustomerProfile(customerId, 'documents');
      } else {
        renderFn();
      }
    } else {
      toastFn(data.message || 'Upload failed.', 'danger');
    }
  };
  reader.readAsDataURL(file);
}

export async function issueRecoveryCodeForUser(uid) {
  const resp = await fetch('/api/users/recovery-code', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ uid })
  });
  const data = await resp.json();
  if (resp.ok && data.success) {
    modalFn(
      'One-Time Recovery Code Issued',
      `<div style="text-align:center; padding:1rem;">
        <div style="font-size:0.82rem; color:var(--text-muted);">Share securely with <strong>${esc(uid)}</strong> (Valid 10 minutes):</div>
        <div class="font-mono" style="font-size:1.8rem; font-weight:800; letter-spacing:4px; color:var(--blue-600); margin:1rem 0;">${esc(data.code)}</div>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.closeModal()">Close</button>
      </div>`,
      null
    );
  } else {
    toastFn(data.message || 'Failed to issue recovery code.', 'danger');
  }
}
