/**
 * yuvaSikshaViews.js
 * Complete Corporate UI, Interactive Chart.js Analytics & Synchronized Register
 * for "Banglar Yuva Siksha Barasa Card Management"
 * MUN COMPUTER CORPORATE ERP SYSTEM
 */

import Chart from 'chart.js/auto';
import { getLucideIcon } from './lucideIcons.js';
import { formatDate, formatINR, getTodayDate } from './storage.js';
import { canMenu } from './auth.js';
import {
  YUVA_ELIGIBLE_CATEGORIES,
  YUVA_APPLICATION_STATUSES,
  YUVA_APPROVAL_STATUSES,
  YUVA_PAYMENT_STATUSES,
  getEligibleYuvaServices,
  getSynchronizedYuvaApplications,
  updateYuvaApplicationProgress,
  computeYuvaDashboardStats,
  filterYuvaApplications,
  buildYuvaMonthlyAnalytics,
  exportYuvaApplications
} from './yuvaSikshaEngine.js';

let yuvaBarChartInstance = null;

function esc(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getYuvaUiState() {
  if (!window._yuvaSikshaUiState) {
    const today = getTodayDate();
    window._yuvaSikshaUiState = {
      query: '',
      service: 'all',
      category: 'all',
      status: 'all',
      dateFrom: '',
      dateTo: '',
      year: today.slice(0, 4),
      month: 'all',
      chartMode: 'applications', // applications | disbursement | combined
      showServicesPanel: false,
      page: 1,
      pageSize: 10
    };
  }
  return window._yuvaSikshaUiState;
}

function statusBadgeHtml(label, kind = 'app') {
  const s = String(label || '').toLowerCase();
  let bg = '#EFF6FF';
  let color = '#1D4ED8';
  let border = '#BFDBFE';

  if (/approv|sanction|disburs|paid|complet/.test(s)) {
    bg = '#ECFDF5';
    color = '#15803D';
    border = '#A7F3D0';
  } else if (/reject|cancel/.test(s)) {
    bg = '#FEF2F2';
    color = '#B91C1C';
    border = '#FECACA';
  } else if (/hold|query|pending|review|partial/.test(s)) {
    bg = '#FFFBEB';
    color = '#92400E';
    border = '#FDE68A';
  } else if (kind === 'active' || s === 'active' || /process/.test(s)) {
    bg = '#EFF6FF';
    color = '#2456C7';
    border = '#93C5FD';
  }

  return `<span style="display:inline-block; padding:0.18rem 0.5rem; font-size:0.71rem; font-weight:700; border-radius:4px; background:${bg}; color:${color}; border:1px solid ${border}; white-space:nowrap;">${esc(label || '-')}</span>`;
}

export function renderYuvaSikshaBarasaView() {
  const ui = getYuvaUiState();
  const eligibleServices = getEligibleYuvaServices();
  const allApps = getSynchronizedYuvaApplications();
  const stats = computeYuvaDashboardStats(allApps);
  const filteredApps = filterYuvaApplications(allApps, ui);

  const canExport = canMenu('yuva-siksha-barasa', 'export') || canMenu('reports', 'export');
  const canEdit = canMenu('yuva-siksha-barasa', 'edit');

  const uniqueServiceNames = Array.from(new Set([
    ...eligibleServices.map(s => s.serviceName),
    ...allApps.map(a => a.serviceName)
  ])).filter(Boolean).sort((a, b) => a.localeCompare(b));

  const currentYearNum = new Date().getFullYear();
  const yearSet = new Set([String(currentYearNum), String(currentYearNum - 1), String(currentYearNum - 2)]);
  allApps.forEach(a => {
    const yr = String(a.applicationDate || '').slice(0, 4);
    if (/^\d{4}$/.test(yr)) yearSet.add(yr);
  });
  const availableYears = Array.from(yearSet).sort((a, b) => b.localeCompare(a));

  const monthSet = new Set();
  allApps.forEach(a => {
    const ym = String(a.applicationDate || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(ym)) monthSet.add(ym);
  });
  const targetYr = ui.year === 'all' ? String(currentYearNum) : ui.year;
  for (let m = 1; m <= 12; m++) {
    monthSet.add(`${targetYr}-${String(m).padStart(2, '0')}`);
  }
  const availableMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

  // Pagination calculation
  const pageSize = Math.max(5, Number(ui.pageSize) || 10);
  const totalPages = Math.max(1, Math.ceil(filteredApps.length / pageSize));
  if (ui.page > totalPages) ui.page = totalPages;
  if (ui.page < 1) ui.page = 1;
  const startIdx = (ui.page - 1) * pageSize;
  const pageRows = filteredApps.slice(startIdx, startIdx + pageSize);

  const kpiCards = [
    {
      label: 'Total Registered Applications',
      value: stats.totalApplications,
      accent: '#2456C7',
      bg: '#F8FAFC',
      icon: 'clipboard-list',
      filterStatus: 'all'
    },
    {
      label: "Today's Applications",
      value: stats.todaysApplications,
      accent: '#0284C7',
      bg: '#F0F9FF',
      icon: 'calendar-check',
      filterToday: true
    },
    {
      label: 'Monthly Applications',
      value: stats.monthlyApplications,
      accent: '#4F46E5',
      bg: '#EEF2FF',
      icon: 'calendar',
      filterThisMonth: true
    },
    {
      label: 'Pending Applications',
      value: stats.pendingApplications,
      accent: '#B45309',
      bg: '#FFFBEB',
      icon: 'clock',
      filterStatus: 'Pending Verification'
    },
    {
      label: 'Approved Applications',
      value: stats.approvedApplications,
      accent: '#15803D',
      bg: '#ECFDF5',
      icon: 'check-circle-2',
      filterStatus: 'Approved'
    },
    {
      label: 'Rejected Applications',
      value: stats.rejectedApplications,
      accent: '#B91C1C',
      bg: '#FEF2F2',
      icon: 'x-circle',
      filterStatus: 'Rejected'
    },
    {
      label: 'Active Applications',
      value: stats.activeApplications,
      accent: '#0B1530',
      bg: '#EFF6FF',
      icon: 'graduation-cap',
      filterStatus: 'Active'
    },
    {
      label: 'Total Disbursement',
      value: formatINR(stats.totalDisbursement),
      accent: '#B45309',
      bg: '#FEFCE8',
      goldBorder: true,
      icon: 'indian-rupee',
      isMoney: true
    },
    {
      label: 'Monthly Disbursement',
      value: formatINR(stats.monthlyDisbursement),
      accent: '#047857',
      bg: '#ECFDF5',
      goldBorder: true,
      icon: 'wallet',
      isMoney: true
    }
  ];

  const categoryCounts = new Map();
  YUVA_ELIGIBLE_CATEGORIES.forEach(c => categoryCounts.set(c, 0));
  eligibleServices.forEach(s => {
    categoryCounts.set(s.eligibleCategory, (categoryCounts.get(s.eligibleCategory) || 0) + 1);
  });

  return `
    <div class="page-content">
      <!-- Corporate Navy & Royal Blue Hero Header with Champagne Gold Accent -->
      <div style="background:linear-gradient(135deg, #0B1530 0%, #152C61 58%, #2456C7 100%); color:#FFFFFF; border-radius:var(--radius-lg); padding:1.35rem 1.5rem; margin-bottom:1.15rem; border-bottom:3px solid #D6B56D; box-shadow:var(--shadow-md);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
          <div style="min-width:0; flex:1 1 320px;">
            <div style="display:inline-flex; align-items:center; gap:0.4rem; background:rgba(214,181,109,0.18); border:1px solid rgba(214,181,109,0.55); color:#F3E5AB; font-size:0.71rem; font-weight:800; padding:0.2rem 0.65rem; border-radius:4px; letter-spacing:0.04em; margin-bottom:0.45rem;">
              ${getLucideIcon('graduation-cap', 14)} SERVICES • AUTOMATIC CATEGORY &amp; TAG SYNCHRONIZATION
            </div>
            <h2 style="font-size:1.45rem; font-weight:800; margin:0 0 0.3rem 0; color:#FFFFFF; display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
              <span style="display:inline-flex; padding:0.35rem; border-radius:8px; background:rgba(255,255,255,0.12); color:#D6B56D;">
                ${getLucideIcon('graduation-cap', 22)}
              </span>
              <span>Banglar Yuva Siksha Barasa Card Management</span>
            </h2>
            <p style="font-size:0.83rem; color:#CBD5E1; margin:0; max-width:860px; line-height:1.45;">
              Live connected to <strong style="color:#FFFFFF;">Service List &amp; Rate Chart</strong>, <strong style="color:#FFFFFF;">Customer / Lead Registration</strong>, and <strong style="color:#FFFFFF;">Service Registration</strong>. Eligible student, scholarship, education loan &amp; youth welfare records sync automatically with zero duplicate data entry.
            </p>
          </div>
          <div style="display:flex; gap:0.45rem; flex-wrap:wrap; align-items:center;">
            <button type="button" class="btn btn-sm" style="background:#D6B56D; color:#0B1530; font-weight:800; border:none;" onclick="window.MJK.toggleYuvaServicesPanel()">
              ${getLucideIcon('layers', 14)} Auto-Fetched Services (${eligibleServices.length})
            </button>
            <button type="button" class="btn btn-sm" style="background:rgba(255,255,255,0.15); color:#FFFFFF; border:1px solid rgba(255,255,255,0.3); font-weight:700;" onclick="window.MJK.navigateTo('services')">
              ${getLucideIcon('plus-circle', 14)} Register Service Entry
            </button>
            <button type="button" class="btn btn-sm" style="background:rgba(255,255,255,0.12); color:#FFFFFF; border:1px solid rgba(255,255,255,0.28); font-weight:700;" onclick="window.MJK.navigateTo('rate-chart')">
              ${getLucideIcon('receipt', 14)} Rate Chart
            </button>
            <button type="button" class="btn btn-sm" style="background:#2456C7; color:#FFFFFF; border:1px solid rgba(255,255,255,0.35); font-weight:700;" onclick="window.MJK.refreshYuvaSync()">
              ${getLucideIcon('refresh-cw', 14)} Sync Now
            </button>
          </div>
        </div>
      </div>

      <!-- Auto-Fetched Eligible Master Services Inspector Panel -->
      ${ui.showServicesPanel ? `
        <div class="card" style="margin-bottom:1.1rem; border:1px solid #BFDBFE; background:#F8FAFC;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem; padding-bottom:0.55rem; border-bottom:1px solid var(--border-subtle);">
            <div>
              <strong style="font-size:0.92rem; color:#0B1530;">Auto-Fetched Eligible Master Services (${eligibleServices.length} Services Detected Across 8 Categories)</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">Automatically updated whenever services, categories, or tags change in Service List &amp; Rate Chart.</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.toggleYuvaServicesPanel()">Hide Panel</button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap:0.55rem; margin-bottom:0.75rem;">
            ${YUVA_ELIGIBLE_CATEGORIES.map(cat => `
              <div style="padding:0.55rem 0.7rem; background:#FFFFFF; border:1px solid var(--border-subtle); border-left:3px solid #2456C7; border-radius:6px; cursor:pointer;" onclick="window.MJK.setYuvaFilter('category', '${esc(cat)}')">
                <div style="font-size:0.75rem; font-weight:800; color:#0B1530;">${esc(cat)}</div>
                <div class="tabular-nums" style="font-size:0.72rem; color:#2456C7; font-weight:700; margin-top:0.15rem;">${categoryCounts.get(cat) || 0} Master Service(s)</div>
              </div>
            `).join('')}
          </div>
          <div style="max-height:210px; overflow-y:auto; border:1px solid var(--border-subtle); border-radius:6px; background:#FFFFFF;">
            <table class="data-table" style="font-size:0.78rem;">
              <thead>
                <tr>
                  <th>Service Name</th>
                  <th>Eligible Category</th>
                  <th>Master Category &amp; Tags</th>
                  <th style="text-align:right;">Rate (₹)</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                ${eligibleServices.map(s => `
                  <tr>
                    <td>
                      <strong>${esc(s.serviceName)}</strong>
                      ${s.nameBn ? `<div style="font-size:0.7rem; color:var(--text-muted);">${esc(s.nameBn)}</div>` : ''}
                    </td>
                    <td><span style="font-size:0.71rem; font-weight:700; color:#2456C7;">${esc(s.eligibleCategory)}</span></td>
                    <td>
                      <div style="font-size:0.71rem; color:var(--text-muted);">${esc(s.rawCategory)}</div>
                      <div style="font-size:0.68rem; color:#475569;">${esc((s.tags || []).slice(0, 4).join(', '))}</div>
                    </td>
                    <td style="text-align:right;" class="font-mono tabular-nums">${formatINR(s.totalRate)}</td>
                    <td style="font-size:0.7rem; color:var(--text-muted);">${esc((s.sources || []).join(', '))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- 9 Dynamic KPI Statistics Cards -->
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 190px), 1fr)); gap:0.75rem; margin-bottom:1.15rem;">
        ${kpiCards.map(k => `
          <div
            class="card"
            onclick="${k.filterToday ? 'window.MJK.quickYuvaToday()' : k.filterThisMonth ? 'window.MJK.quickYuvaThisMonth()' : k.filterStatus ? `window.MJK.quickYuvaStatus('${esc(k.filterStatus)}')` : 'void(0)'}"
            style="padding:0.85rem 1rem; margin:0; cursor:${k.isMoney ? 'default' : 'pointer'}; background:${k.bg}; border:1px solid ${k.goldBorder ? '#D6B56D' : 'var(--border-subtle)'}; border-left:4px solid ${k.accent}; transition:transform 0.12s ease;"
          >
            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem;">
              <span style="font-size:0.7rem; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.03em;">${esc(k.label)}</span>
              <span style="color:${k.accent}; display:inline-flex;">${getLucideIcon(k.icon, 16)}</span>
            </div>
            <div class="tabular-nums font-mono" style="font-size:1.45rem; font-weight:800; color:${k.accent}; margin-top:0.35rem;">
              ${esc(k.value)}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Monthly Analytics & Interactive Bar Chart -->
      <div class="card" style="margin-bottom:1.15rem; border:1px solid var(--border-subtle);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.75rem; margin-bottom:0.85rem;">
          <div>
            <h3 style="margin:0; font-size:1rem; font-weight:800; color:#0B1530; display:flex; align-items:center; gap:0.45rem;">
              ${getLucideIcon('bar-chart-2', 18)}
              <span>Monthly Analytics &amp; Disbursement Trends</span>
            </h3>
            <div style="font-size:0.76rem; color:var(--text-muted); margin-top:0.15rem;">
              Interactive month-wise tracking of Registered Applications, Approved Trends, Active Counts, Pending Trends &amp; Monthly Disbursements.
            </div>
          </div>
          <div style="display:flex; gap:0.45rem; flex-wrap:wrap; align-items:center;">
            <select class="form-control" style="width:auto; height:32px; font-size:0.78rem;" onchange="window.MJK.setYuvaFilter('chartMode', this.value)">
              <option value="applications" ${ui.chartMode === 'applications' ? 'selected' : ''}>Application Trends (Reg / Appr / Act / Pend)</option>
              <option value="disbursement" ${ui.chartMode === 'disbursement' ? 'selected' : ''}>Monthly Disbursement (₹)</option>
              <option value="combined" ${ui.chartMode === 'combined' ? 'selected' : ''}>Combined Apps + Disbursement</option>
            </select>
            <select class="form-control" style="width:auto; height:32px; font-size:0.78rem;" onchange="window.MJK.setYuvaFilter('year', this.value)">
              <option value="all" ${ui.year === 'all' ? 'selected' : ''}>All Years</option>
              ${availableYears.map(yr => `<option value="${esc(yr)}" ${ui.year === yr ? 'selected' : ''}>Year ${esc(yr)}</option>`).join('')}
            </select>
            <select class="form-control" style="width:auto; height:32px; font-size:0.78rem;" onchange="window.MJK.setYuvaFilter('month', this.value)">
              <option value="all" ${ui.month === 'all' ? 'selected' : ''}>All Months</option>
              ${availableMonths.map(ym => `<option value="${esc(ym)}" ${ui.month === ym ? 'selected' : ''}>${esc(ym)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="position:relative; height:290px; width:100%;">
          <canvas id="yuva-analytics-bar-chart"></canvas>
        </div>
      </div>

      <!-- Searchable, Filterable, Paginated Synchronized Application Register -->
      <div class="card" style="padding:0; overflow:hidden; border:1px solid var(--border-subtle);">
        <div style="padding:0.9rem 1.1rem; border-bottom:1px solid var(--border-subtle); background:#0B1530; color:#FFFFFF; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.65rem;">
          <div>
            <strong style="font-size:0.96rem; display:flex; align-items:center; gap:0.4rem;">
              ${getLucideIcon('graduation-cap', 17)}
              <span>Synchronized Student &amp; Youth Application Register (${filteredApps.length} of ${allApps.length})</span>
            </strong>
            <div style="font-size:0.73rem; color:#CBD5E1; margin-top:0.15rem;">
              Showing real-time synchronized records deduplicated by Application ID, Customer ID &amp; Service ID.
            </div>
          </div>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            ${canExport ? `
              <button type="button" class="btn btn-sm" style="background:#D6B56D; color:#0B1530; font-weight:800; border:none;" onclick="window.MJK.exportYuvaAction('excel')">
                ${getLucideIcon('file-spreadsheet', 14)} Excel Export
              </button>
              <button type="button" class="btn btn-sm" style="background:#2456C7; color:#FFFFFF; border:1px solid rgba(255,255,255,0.25); font-weight:700;" onclick="window.MJK.exportYuvaAction('pdf')">
                ${getLucideIcon('file-text', 14)} PDF Export
              </button>
              <button type="button" class="btn btn-sm" style="background:rgba(255,255,255,0.14); color:#FFFFFF; border:1px solid rgba(255,255,255,0.25);" onclick="window.MJK.exportYuvaAction('print')">
                ${getLucideIcon('printer', 14)} Print
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Multi-Filter Bar -->
        <div style="padding:0.85rem 1.1rem; background:#F8FAFC; border-bottom:1px solid var(--border-subtle); display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap:0.6rem; align-items:end;">
          <div style="grid-column:span 2 / auto;">
            <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">GLOBAL SEARCH</label>
            <input
              type="text"
              id="yuva-global-search"
              class="form-control"
              style="height:34px; font-size:0.8rem;"
              placeholder="Search App ID, Student Name, Mobile, Service, Tags..."
              value="${esc(ui.query)}"
              oninput="window.MJK.setYuvaSearchQuery(this.value)"
            >
          </div>
          <div>
            <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">CATEGORY-WISE FILTER</label>
            <select class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.setYuvaFilter('category', this.value)">
              <option value="all" ${ui.category === 'all' ? 'selected' : ''}>All Eligible Categories (8)</option>
              ${YUVA_ELIGIBLE_CATEGORIES.map(c => `<option value="${esc(c)}" ${ui.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">SERVICE-WISE FILTER</label>
            <select class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.setYuvaFilter('service', this.value)">
              <option value="all" ${ui.service === 'all' ? 'selected' : ''}>All Eligible Services (${uniqueServiceNames.length})</option>
              ${uniqueServiceNames.map(s => `<option value="${esc(s)}" ${ui.service === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">STATUS-WISE FILTER</label>
            <select class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.setYuvaFilter('status', this.value)">
              <option value="all" ${ui.status === 'all' ? 'selected' : ''}>All Statuses</option>
              ${Array.from(new Set([...YUVA_APPLICATION_STATUSES, ...YUVA_APPROVAL_STATUSES])).map(st => `
                <option value="${esc(st)}" ${ui.status === st ? 'selected' : ''}>${esc(st)}</option>
              `).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">DATE FROM</label>
            <input type="date" class="form-control" style="height:34px; font-size:0.8rem;" value="${esc(ui.dateFrom)}" onchange="window.MJK.setYuvaFilter('dateFrom', this.value)">
          </div>
          <div>
            <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">DATE TO</label>
            <input type="date" class="form-control" style="height:34px; font-size:0.8rem;" value="${esc(ui.dateTo)}" onchange="window.MJK.setYuvaFilter('dateTo', this.value)">
          </div>
          <div>
            <button type="button" class="btn btn-secondary btn-sm" style="height:34px; width:100%;" onclick="window.MJK.resetYuvaFilters()">Reset Filters</button>
          </div>
        </div>

        <!-- 12-Column Data Table -->
        <div style="overflow-x:auto;">
          <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.81rem;">
            <thead>
              <tr style="background:#F1F5F9; border-bottom:1px solid var(--border-subtle);">
                <th style="width:52px; text-align:center;">SL No.</th>
                <th>Application ID</th>
                <th>Customer / Student Name</th>
                <th>Mobile Number</th>
                <th>Service Name</th>
                <th>Service Category</th>
                <th>Application Date</th>
                <th>Application Status</th>
                <th>Approval Status</th>
                <th style="text-align:right;">Disbursement Amount</th>
                <th>Payment Status</th>
                <th style="text-align:right;">Action / View Details</th>
              </tr>
            </thead>
            <tbody>
              ${pageRows.length === 0 ? `
                <tr>
                  <td colspan="12" style="padding:2.5rem 1rem; text-align:center; color:var(--text-muted);">
                    <div style="font-weight:700; font-size:0.95rem; color:#0B1530; margin-bottom:0.35rem;">
                      No matching student or youth service applications found
                    </div>
                    <div style="font-size:0.8rem; max-width:560px; margin:0 auto 0.85rem;">
                      Register a new service under <strong style="color:#2456C7;">Education</strong>, <strong style="color:#2456C7;">Student Welfare Schemes</strong>, <strong style="color:#2456C7;">Education Loan</strong>, or <strong style="color:#2456C7;">Banglar Yuva Siksha Barasa Card</strong> in Service Registration — it will sync here automatically.
                    </div>
                    <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('services')">
                      + Register Eligible Service Application
                    </button>
                  </td>
                </tr>
              ` : pageRows.map((row, idx) => `
                <tr style="border-bottom:1px solid var(--border-subtle);">
                  <td class="tabular-nums font-mono" style="text-align:center; color:var(--text-muted);">${startIdx + idx + 1}</td>
                  <td>
                    <span
                      class="font-mono tabular-nums"
                      style="font-weight:800; color:#2456C7; cursor:pointer;"
                      onclick="window.MJK.openYuvaDetailModal('${esc(row.recordKey)}')"
                    >${esc(row.applicationId)}</span>
                  </td>
                  <td>
                    <div style="font-weight:700; color:#0B1530;">${esc(row.studentName)}</div>
                    ${row.village || row.ward ? `<div style="font-size:0.7rem; color:var(--text-muted);">${esc([row.ward, row.village].filter(Boolean).join(' · '))}</div>` : ''}
                  </td>
                  <td class="font-mono tabular-nums">${esc(row.mobile)}</td>
                  <td>
                    <div style="font-weight:600; color:var(--text-main);">${esc(row.serviceName)}</div>
                    ${row.tags && row.tags.length ? `<div style="font-size:0.68rem; color:#64748B;">${esc(row.tags.slice(0, 3).join(' · '))}</div>` : ''}
                  </td>
                  <td>
                    <span style="display:inline-block; padding:0.16rem 0.45rem; font-size:0.7rem; font-weight:700; border-radius:4px; background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE; white-space:nowrap;">
                      ${esc(row.serviceCategory)}
                    </span>
                  </td>
                  <td class="font-mono tabular-nums" style="white-space:nowrap;">${formatDate(row.applicationDate)}</td>
                  <td>${statusBadgeHtml(row.applicationStatus, 'active')}</td>
                  <td>${statusBadgeHtml(row.approvalStatus, 'approval')}</td>
                  <td class="font-mono tabular-nums" style="text-align:right; font-weight:800; color:#0B1530;">
                    ${formatINR(row.disbursementAmount)}
                  </td>
                  <td>${statusBadgeHtml(row.paymentStatus, 'payment')}</td>
                  <td style="text-align:right; white-space:nowrap;">
                    <div style="display:inline-flex; gap:0.3rem;">
                      <button type="button" class="btn btn-primary btn-sm" style="background:#2456C7;" onclick="window.MJK.openYuvaDetailModal('${esc(row.recordKey)}')">
                        ${getLucideIcon('eye', 13)} View Details
                      </button>
                      ${canEdit ? `
                        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openYuvaUpdateModal('${esc(row.recordKey)}')">
                          ${getLucideIcon('edit-3', 13)} Update
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Pagination Footer -->
        <div style="padding:0.75rem 1.1rem; background:#F8FAFC; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.78rem; color:var(--text-muted);">
            <span>Showing <strong class="tabular-nums">${filteredApps.length ? startIdx + 1 : 0}</strong>–<strong class="tabular-nums">${Math.min(startIdx + pageSize, filteredApps.length)}</strong> of <strong class="tabular-nums">${filteredApps.length}</strong> records</span>
            <select class="form-control" style="width:auto; height:28px; font-size:0.75rem; padding:0 0.4rem;" onchange="window.MJK.setYuvaPageSize(this.value)">
              ${[10, 25, 50, 100].map(sz => `<option value="${sz}" ${pageSize === sz ? 'selected' : ''}>${sz} / page</option>`).join('')}
            </select>
          </div>
          <div style="display:flex; align-items:center; gap:0.35rem;">
            <button type="button" class="btn btn-secondary btn-sm" ${ui.page <= 1 ? 'disabled' : ''} onclick="window.MJK.setYuvaPage(${ui.page - 1})">← Prev</button>
            <span class="tabular-nums" style="font-size:0.78rem; font-weight:700; padding:0 0.45rem; color:#0B1530;">Page ${ui.page} / ${totalPages}</span>
            <button type="button" class="btn btn-secondary btn-sm" ${ui.page >= totalPages ? 'disabled' : ''} onclick="window.MJK.setYuvaPage(${ui.page + 1})">Next →</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initYuvaChartsAfterRender(currentRoute) {
  if (yuvaBarChartInstance) {
    try { yuvaBarChartInstance.destroy(); } catch {}
    yuvaBarChartInstance = null;
  }
  if (currentRoute !== 'yuva-siksha-barasa') return;
  const canvas = document.getElementById('yuva-analytics-bar-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const ui = getYuvaUiState();
  const apps = getSynchronizedYuvaApplications();
  const data = buildYuvaMonthlyAnalytics(apps, ui);

  let datasets = [];
  if (ui.chartMode === 'disbursement') {
    datasets = [
      {
        label: 'Monthly Disbursement (₹)',
        data: data.disbursement,
        backgroundColor: 'rgba(214, 181, 109, 0.88)',
        borderColor: '#0B1530',
        borderWidth: 1.5,
        borderRadius: 4
      }
    ];
  } else if (ui.chartMode === 'combined') {
    datasets = [
      {
        label: 'Registered Apps',
        data: data.registered,
        backgroundColor: '#2456C7',
        borderRadius: 4,
        yAxisID: 'y'
      },
      {
        label: 'Approved Apps',
        data: data.approved,
        backgroundColor: '#16A34A',
        borderRadius: 4,
        yAxisID: 'y'
      },
      {
        label: 'Monthly Disbursement (₹)',
        data: data.disbursement,
        backgroundColor: 'rgba(214, 181, 109, 0.85)',
        borderColor: '#92400E',
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: 'y1'
      }
    ];
  } else {
    datasets = [
      { label: 'Registered', data: data.registered, backgroundColor: '#2456C7', borderRadius: 4 },
      { label: 'Approved', data: data.approved, backgroundColor: '#16A34A', borderRadius: 4 },
      { label: 'Active', data: data.active, backgroundColor: '#0B1530', borderRadius: 4 },
      { label: 'Pending', data: data.pending, backgroundColor: '#D97706', borderRadius: 4 }
    ];
  }

  const scales = ui.chartMode === 'combined'
    ? {
        x: { grid: { display: false } },
        y: { beginAtZero: true, position: 'left', ticks: { precision: 0 }, title: { display: true, text: 'Applications' } },
        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Disbursement (₹)' } }
      }
    : {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } }
      };

  yuvaBarChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, font: { size: 11, weight: '700' } }
        }
      },
      scales
    }
  });
}

export function setupYuvaSikshaHandlers(MJK, showToast, openModal, closeModal, render) {
  let searchDebounce = null;

  MJK.toggleYuvaServicesPanel = () => {
    const ui = getYuvaUiState();
    ui.showServicesPanel = !ui.showServicesPanel;
    render();
  };

  MJK.refreshYuvaSync = () => {
    const count = getSynchronizedYuvaApplications().length;
    showToast(`Synchronized ${count} eligible student & youth application(s) from master ERP stores.`, 'success');
    render();
  };

  MJK.setYuvaFilter = (key, value) => {
    const ui = getYuvaUiState();
    ui[key] = value;
    ui.page = 1;
    render();
  };

  MJK.setYuvaSearchQuery = (val) => {
    const ui = getYuvaUiState();
    ui.query = val || '';
    ui.page = 1;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      render();
      const inp = document.getElementById('yuva-global-search');
      if (inp) {
        inp.focus();
        try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch {}
      }
    }, 180);
  };

  MJK.resetYuvaFilters = () => {
    const today = getTodayDate();
    window._yuvaSikshaUiState = {
      query: '',
      service: 'all',
      category: 'all',
      status: 'all',
      dateFrom: '',
      dateTo: '',
      year: today.slice(0, 4),
      month: 'all',
      chartMode: getYuvaUiState().chartMode || 'applications',
      showServicesPanel: getYuvaUiState().showServicesPanel || false,
      page: 1,
      pageSize: getYuvaUiState().pageSize || 10
    };
    render();
  };

  MJK.quickYuvaToday = () => {
    const today = getTodayDate();
    const ui = getYuvaUiState();
    ui.dateFrom = today;
    ui.dateTo = today;
    ui.status = 'all';
    ui.page = 1;
    render();
  };

  MJK.quickYuvaThisMonth = () => {
    const today = getTodayDate();
    const ui = getYuvaUiState();
    ui.dateFrom = `${today.slice(0, 7)}-01`;
    ui.dateTo = today;
    ui.status = 'all';
    ui.page = 1;
    render();
  };

  MJK.quickYuvaStatus = (st) => {
    const ui = getYuvaUiState();
    ui.status = st || 'all';
    ui.dateFrom = '';
    ui.dateTo = '';
    ui.page = 1;
    render();
  };

  MJK.setYuvaPage = (pageNum) => {
    const ui = getYuvaUiState();
    ui.page = Math.max(1, Number(pageNum) || 1);
    render();
  };

  MJK.setYuvaPageSize = (sz) => {
    const ui = getYuvaUiState();
    ui.pageSize = Math.max(5, Number(sz) || 10);
    ui.page = 1;
    render();
  };

  MJK.exportYuvaAction = async (format) => {
    const ui = getYuvaUiState();
    const filtered = filterYuvaApplications(getSynchronizedYuvaApplications(), ui);
    if (filtered.length === 0) {
      showToast('No application records match the current filters to export.', 'warning');
      return;
    }
    const res = await exportYuvaApplications(filtered, format);
    if (res?.message) showToast(res.message, 'success');
  };

  MJK.openYuvaDetailModal = (recordKey) => {
    const row = getSynchronizedYuvaApplications().find(r => r.recordKey === recordKey || r.applicationId === recordKey);
    if (!row) {
      showToast('Application record not found.', 'warning');
      return;
    }
    const canEdit = canMenu('yuva-siksha-barasa', 'edit');

    const content = `
      <div style="display:flex; flex-direction:column; gap:0.9rem;">
        <div style="padding:0.95rem 1rem; border-radius:8px; background:linear-gradient(135deg, #0B1530 0%, #1E3A8A 100%); color:#FFFFFF; border-bottom:2px solid #D6B56D;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.6rem;">
            <div>
              <div style="font-size:0.7rem; font-weight:800; color:#D6B56D; letter-spacing:0.04em;">APPLICATION ID</div>
              <div class="font-mono tabular-nums" style="font-size:1.1rem; font-weight:800;">${esc(row.applicationId)}</div>
              <div style="font-size:0.95rem; font-weight:700; margin-top:0.2rem;">${esc(row.studentName)}</div>
              <div style="font-size:0.78rem; color:#CBD5E1;">Mobile: <span class="font-mono">${esc(row.mobile)}</span> ${row.customerId ? `· Cust ID: <span class="font-mono">${esc(row.customerId)}</span>` : ''}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.68rem; color:#CBD5E1; text-transform:uppercase; font-weight:700;">Disbursement Amount</div>
              <div class="font-mono tabular-nums" style="font-size:1.3rem; font-weight:800; color:#F3E5AB;">${formatINR(row.disbursementAmount)}</div>
              <div style="margin-top:0.25rem;">${statusBadgeHtml(row.approvalStatus, 'approval')}</div>
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:0.65rem; font-size:0.81rem;">
          <div style="padding:0.65rem 0.8rem; border:1px solid var(--border-subtle); border-radius:6px; background:var(--surface-alt);">
            <div style="font-size:0.69rem; font-weight:700; color:var(--text-muted);">SERVICE NAME</div>
            <div style="font-weight:800; color:#0B1530; margin-top:0.15rem;">${esc(row.serviceName)}</div>
            <div style="font-size:0.72rem; color:#2456C7; font-weight:700; margin-top:0.15rem;">${esc(row.serviceCategory)}</div>
          </div>
          <div style="padding:0.65rem 0.8rem; border:1px solid var(--border-subtle); border-radius:6px; background:var(--surface-alt);">
            <div style="font-size:0.69rem; font-weight:700; color:var(--text-muted);">APPLICATION &amp; PAYMENT STATUS</div>
            <div style="display:flex; gap:0.35rem; flex-wrap:wrap; margin-top:0.25rem;">
              ${statusBadgeHtml(row.applicationStatus, 'active')}
              ${statusBadgeHtml(row.paymentStatus, 'payment')}
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.25rem;">Applied: <span class="font-mono">${formatDate(row.applicationDate)}</span></div>
          </div>
          <div style="padding:0.65rem 0.8rem; border:1px solid var(--border-subtle); border-radius:6px; background:var(--surface-alt);">
            <div style="font-size:0.69rem; font-weight:700; color:var(--text-muted);">SOURCE &amp; SYNC REFERENCE</div>
            <div style="font-weight:700; margin-top:0.15rem;">${esc(row.sourceType.replace(/_/g, ' '))}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">Service ID: <span class="font-mono">${esc(row.serviceId)}</span></div>
          </div>
        </div>

        ${row.tags && row.tags.length ? `
          <div style="font-size:0.77rem;">
            <strong style="color:var(--text-muted); font-size:0.7rem;">MATCHED TAGS:</strong>
            <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.25rem;">
              ${row.tags.map(t => `<span style="padding:0.15rem 0.45rem; background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE; border-radius:4px; font-size:0.71rem; font-weight:600;">${esc(t)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${row.remarks ? `
          <div style="padding:0.65rem 0.8rem; border:1px solid var(--border-subtle); border-radius:6px; background:#F8FAFC; font-size:0.8rem;">
            <strong>Remarks / Notes:</strong> ${esc(row.remarks)}
          </div>
        ` : ''}
      </div>
    `;

    openModal(
      `Application Details — ${row.applicationId}`,
      content,
      `
        ${canEdit ? `<button type="button" class="btn btn-primary" style="background:#2456C7;" onclick="window.MJK.openYuvaUpdateModal('${esc(row.recordKey)}')">Update Status &amp; Disbursement</button>` : ''}
        <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Close</button>
      `,
      'modal-lg'
    );
  };

  MJK.openYuvaUpdateModal = (recordKey) => {
    const row = getSynchronizedYuvaApplications().find(r => r.recordKey === recordKey || r.applicationId === recordKey);
    if (!row) return;

    const content = `
      <form onsubmit="window.MJK.handleYuvaUpdateSubmit(event, '${esc(row.recordKey)}')">
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.85rem;">
          Updating <strong style="color:#0B1530;">${esc(row.studentName)}</strong> (${esc(row.applicationId)}) · Changes sync directly with the master ERP record.
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Application Status <span class="req">*</span></label>
            <select id="yuva-upd-app-status" class="form-control" required>
              ${YUVA_APPLICATION_STATUSES.map(st => `<option value="${esc(st)}" ${row.applicationStatus === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Approval Status <span class="req">*</span></label>
            <select id="yuva-upd-appr-status" class="form-control" required>
              ${YUVA_APPROVAL_STATUSES.map(st => `<option value="${esc(st)}" ${row.approvalStatus === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Disbursement Amount (₹)</label>
            <input type="number" id="yuva-upd-disbursement" class="form-control font-mono" min="0" step="1" value="${Number(row.disbursementAmount) || 0}">
          </div>
          <div class="form-group">
            <label class="form-label">Payment Status <span class="req">*</span></label>
            <select id="yuva-upd-payment-status" class="form-control" required>
              ${YUVA_PAYMENT_STATUSES.map(st => `<option value="${esc(st)}" ${row.paymentStatus === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Verification / Remarks</label>
          <textarea id="yuva-upd-remarks" class="form-control" rows="2" placeholder="Enter card status, approval reference, or disbursement notes...">${esc(row.remarks || '')}</textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" style="background:#2456C7;">Save &amp; Sync Master Record</button>
        </div>
      </form>
    `;

    openModal(`Update Card / Disbursement (${row.applicationId})`, content, null);
  };

  MJK.handleYuvaUpdateSubmit = (e, recordKey) => {
    e.preventDefault();
    const res = updateYuvaApplicationProgress(recordKey, {
      applicationStatus: document.getElementById('yuva-upd-app-status')?.value,
      approvalStatus: document.getElementById('yuva-upd-appr-status')?.value,
      disbursementAmount: document.getElementById('yuva-upd-disbursement')?.value,
      paymentStatus: document.getElementById('yuva-upd-payment-status')?.value,
      remarks: document.getElementById('yuva-upd-remarks')?.value
    });
    if (!res.success) {
      showToast(res.message || 'Unable to update record.', 'danger');
      return;
    }
    closeModal();
    showToast('Application status & disbursement synced to master database.', 'success');
    render();
  };
}
