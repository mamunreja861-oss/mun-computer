/**
 * annapurnaCaseViews.js
 * Complete UI & Interactive Modals for Annapurna Yojana Case Management & Customer Visit Tracking
 * MUN COMPUTER BUSINESS MANAGER
 */

import Chart from 'chart.js/auto';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  renderBwDocumentHeader,
  renderCustomerMetaBlock,
  renderAcknowledgementSection,
  drawBwPdfHeader,
  getBwAutoTableStyles,
  finalizeBwPdfPagination
} from './documentEngine.js';
import { exportUniversalCSV, exportUniversalExcel, exportUniversalPDF } from './exportUtility.js';
import { getLucideIcon } from './lucideIcons.js';

import {
  STANDARD_CUSTOMER_SERVICES,
  DEFAULT_APP_STATUSES,
  DEFAULT_COMPLAINT_TYPES,
  COMPLAINT_STATUSES,
  PROBLEM_RESOLUTION_STATUSES,
  getAnnapurnaConfig,
  addConfigItem,
  renameConfigItem,
  toggleConfigItemActive,
  isConfigItemActive,
  getActiveConfigItems,
  deleteConfigItem,
  getAllCustomerServicesList,
  getSavedCustomServices,
  addCustomCustomerService,
  deleteCustomCustomerService,
  getCustomProblems,
  saveCustomProblem,
  deleteCustomProblemFromMaster,
  updateProblemMasterItem,
  deleteProblemMasterItem,
  restoreDeletedStandardProblems,
  getCustomStatuses,
  addCustomStatus,
  deleteCustomStatus,
  getAllAppStatuses,
  getAllComplaintTypes,
  getAllProblemCategoriesWithCustom,
  addCustomerVisit,
  getCustomerVisitAnalytics,
  getAllAnnapurnaApps,
  getAnnapurnaAppById,
  saveAnnapurnaApp,
  deleteAnnapurnaApp,
  addDocumentsToApp,
  updateAppStatusOnly,
  addProblemToApp,
  updateIndividualProblemStatus,
  addComplaintToApp,
  updateComplaintInApp,
  addFollowupEntry,
  toggleFollowupCompleted,
  getAnnapurnaReminders,
  computeAnnapurnaDashboardStats,
  buildAnnapurnaMonthlyPayoutAnalytics,
  filterAnnapurnaApplications,
  exportAnnapurnaReport,
  showInAppPrintModal,
  isAppFinalClosed,
  syncAnnapurnaAppsFromServer
} from './annapurnaCaseEngine.js';

import { getAllCustomers, getCustomerById } from './customers.js';
import { formatDate, formatDateTime, formatINR, getTodayDate } from './storage.js';
import {
  renderLocationCascadeHtml,
  initLocationCascade,
  getLocationCascadeValues,
  saveCustomLocationIfNeeded,
  syncLocationCascadeSelection
} from './locationCascade.js';
import {
  isWardMasterAdmin,
  getWardMasterStore,
  getMasterWards,
  getMasterWardById,
  getMasterVillagesByWard,
  getAllMasterVillages,
  resolveWardForApp,
  formatWardLabel,
  syncWardVillageMasterFromServer,
  editMasterWardApi,
  editMasterVillageApi,
  openQuickWardActionModal,
  openQuickVillageActionModal
} from './wardVillageMaster.js';

function getAppStatusBadge(status) {
  const s = (status || '').toLowerCase();
  let bg = '#e0f2fe', color = '#0369a1', border = '#bae6fd';
  if (/approved|sanctioned|beneficiary|resolved|payment started/.test(s)) {
    bg = '#dcfce7'; color = '#166534'; border = '#86efac';
  } else if (/rejected|cancelled|not eligible|discontinued|payment stopped/.test(s)) {
    bg = '#fee2e2'; color = '#991b1b'; border = '#fca5a5';
  } else if (/hold|revert|pending|enquiry|verification|process/.test(s)) {
    bg = '#fef3c7'; color = '#92400e'; border = '#fde68a';
  } else if (/closed/.test(s)) {
    bg = '#f1f5f9'; color = '#475569'; border = '#cbd5e1';
  }
  return `<span style="display:inline-block; padding:0.2rem 0.5rem; font-size:0.72rem; font-weight:700; border-radius:4px; background:${bg}; color:${color}; border:1px solid ${border}; white-space:nowrap;">${escapeHtml(status)}</span>`;
}

function getFiltersState() {
  if (!window._anpFilters) {
    window._anpFilters = {
      query: '',
      problemCategory: 'all',
      currentStatus: 'all',
      complaintType: 'all',
      submissionFrom: '',
      submissionTo: '',
      followupDate: '',
      caseState: 'all',
      wardId: 'all',
      village: 'all',
      gpOrWard: 'all',
      blockOrMunicipality: 'all'
    };
  }
  return window._anpFilters;
}

function getWardMasterTabState() {
  if (!window._anpMasterWardState) {
    window._anpMasterWardState = {
      selectedWardId: 'WRD-01',
      wardSearch: '',
      wardStatusFilter: 'all',
      villageSearch: ''
    };
  }
  return window._anpMasterWardState;
}

let anpLandingBarChart = null;
let anpReportsBarChart = null;

function normalizeAnpTabId(rawTab) {
  if (rawTab === 'applications' || rawTab === 'complaints' || rawTab === 'timeline') {
    window._anpVerifySubTab = rawTab;
    return 'verification';
  }
  if (['dashboard', 'add-case', 'verification', 'documents', 'reports', 'masters'].includes(rawTab)) {
    return rawTab;
  }
  return 'dashboard';
}

function getActiveTab() {
  const normalized = normalizeAnpTabId(window._anpActiveTab || 'dashboard');
  window._anpActiveTab = normalized;
  return normalized;
}

function getVerifySubTab() {
  const sub = window._anpVerifySubTab || 'applications';
  return ['applications', 'complaints', 'timeline'].includes(sub) ? sub : 'applications';
}

function getAnpChartYear() {
  if (!window._anpChartYear) {
    window._anpChartYear = getTodayDate().slice(0, 4);
  }
  return window._anpChartYear;
}

function ensureInlineProbState() {
  if (!window._anpInlineProbState) {
    window._anpInlineProbState = {
      selectedMap: new Map(),
      searchQuery: '',
      expandedCats: new Set()
    };
  }
  return window._anpInlineProbState;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAppWardDisplay(a) {
  if (!a) return '-';
  const rw = resolveWardForApp(a);
  return a.wardNumber || a.wardName || (rw ? formatWardLabel(rw) : a.gpOrWard) || '-';
}

function getDependentFilterVillages(filters, allApps) {
  if (filters.wardId && filters.wardId !== 'all') {
    const wardMasterVils = getMasterVillagesByWard(filters.wardId, { includeInactive: false }).map(v => v.name);
    const appVils = allApps
      .filter(a => {
        const rw = resolveWardForApp(a);
        return (a.wardId || rw?.wardId || '') === filters.wardId;
      })
      .map(a => (a.village || '').trim())
      .filter(Boolean);
    return Array.from(new Set([...wardMasterVils, ...appVils])).sort((a, b) => a.localeCompare(b));
  }
  const allMasterVils = getAllMasterVillages({ includeInactive: false }).map(v => v.name);
  const allAppVils = allApps.map(a => (a.village || '').trim()).filter(Boolean);
  return Array.from(new Set([...allMasterVils, ...allAppVils])).sort((a, b) => a.localeCompare(b));
}

/* =========================================================================
   MAIN ANNAPURNA YOJANA VIEW RENDERER (USED IN MODULE 04)
   ========================================================================= */

export function renderAnnapurnaCaseSystemView(subNavHtml = '') {
  const activeTab = getActiveTab();
  const filters = getFiltersState();
  const stats = computeAnnapurnaDashboardStats();
  const reminders = getAnnapurnaReminders();
  const filteredApps = filterAnnapurnaApplications(filters);
  const allApps = getAllAnnapurnaApps();
  const categories = getAllProblemCategoriesWithCustom();
  const appStatuses = getAllAppStatuses();
  const complaintTypes = getAllComplaintTypes();
  const isAdmin = isWardMasterAdmin();

  const activeWards = getMasterWards({ includeInactive: false });
  const uniqueVillages = getDependentFilterVillages(filters, allApps);
  const uniqueBlocks = Array.from(new Set([
    'Domkal Municipality',
    'Domkal',
    ...allApps.map(a => (a.blockOrMunicipality || '').trim()).filter(Boolean)
  ])).sort((a, b) => a.localeCompare(b));

  const totalDocsCount = allApps.reduce((n, a) => n + (a.documents || []).length, 0);
  const totalTimelineCount = allApps.reduce((n, a) => n + (a.followupTimeline || []).length, 0);
  const totalComplaintsCount = allApps.reduce((n, a) => n + (a.complaints || []).length, 0);

  const tabs = [
    { id: 'dashboard', label: 'Beneficiary List & Directory', badge: `${stats.totalAnnapurnaApplications}` },
    { id: 'add-case', label: 'Add New Application / Case', badge: 'New Entry' },
    { id: 'verification', label: 'Eligibility & Verification Status', badge: `${filteredApps.length} Cases · ${reminders.pendingComplaints.length} Claims` },
    { id: 'documents', label: 'Document Vault & Uploads', badge: `${totalDocsCount} Docs` },
    { id: 'reports', label: 'Scheme Reports & Payout Analytics', badge: '16 Reports' },
    { id: 'masters', label: 'Settings & Configuration', badge: `${activeWards.length} Wards` }
  ];

  const availableYears = Array.from(new Set([
    getTodayDate().slice(0, 4),
    ...allApps.map(a => String(a.applicationDate || a.createdAt || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y))
  ])).sort((a, b) => b.localeCompare(a));
  const chartYear = getAnpChartYear();

  let tabBody = '';

  if (activeTab === 'dashboard') {
    const kpiCards = [
      { label: 'Total Registered Beneficiaries', val: stats.totalAnnapurnaApplications, color: '#15803d', bg: '#f0fdf4', icon: getLucideIcon('users', 15), action: `window.MJK.quickAnpFilter('all', 'all')` },
      { label: 'Approved / Sanctioned', val: stats.approvedApplications, color: '#047857', bg: '#d1fae5', icon: getLucideIcon('check-circle', 15), action: `window.MJK.quickAnpFilter('caseState', 'resolved')` },
      { label: 'Under Verification / Process', val: stats.underProcess + stats.forFurtherVerification + stats.underEnquiry, color: '#0369a1', bg: '#f0f9ff', icon: getLucideIcon('search', 15), action: `window.MJK.quickAnpFilter('caseState', 'pending')` },
      { label: 'Hold Up Applications', val: stats.holdUp, color: '#c2410c', bg: '#fff7ed', icon: getLucideIcon('clock', 15), action: `window.MJK.quickAnpFilter('currentStatus', 'Hold Up')` },
      { label: 'Pending Claims / RTI', val: stats.pendingClaims + stats.rtiPending, color: '#be123c', bg: '#fff1f2', icon: getLucideIcon('scale', 15), action: `window.MJK.setAnpTab('verification', 'complaints')` },
      { label: 'Rejected Cases', val: stats.rejectedApplications, color: '#b91c1c', bg: '#fee2e2', icon: getLucideIcon('alert-circle', 15), action: `window.MJK.quickAnpFilter('currentStatus', 'Rejected')` },
      { label: 'Total Disbursement', val: formatINR(stats.totalDisbursement || 0), color: '#1e3a8a', bg: '#eff6ff', icon: getLucideIcon('indian-rupee', 15), action: `window.MJK.setAnpTab('reports')` },
      { label: 'Monthly Disbursement', val: formatINR(stats.monthlyDisbursement || 0), color: '#92400e', bg: '#fef3c7', icon: getLucideIcon('calendar', 15), action: `window.MJK.setAnpTab('reports')` }
    ];

    tabBody = `
      <!-- Live KPI Summary -->
      <div class="card" style="margin-bottom:1.1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.85rem;">
          <div>
            <h3 style="margin:0; font-size:1.05rem; font-weight:800;">Annapurna Yojana — Beneficiary Directory &amp; Live Payout KPIs</h3>
            <div style="font-size:0.78rem; color:var(--text-muted);">Clean production data only. All KPIs, charts, and directory rows compute dynamically from registered applications.</div>
          </div>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.setAnpTab('add-case')">Add New Application</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.setAnpTab('reports')">Payout Analytics</button>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 195px), 1fr)); gap:0.75rem;">
          ${kpiCards.map(k => `
            <div onclick="${k.action}" style="cursor:pointer; background:${k.bg}; border:1px solid rgba(15,23,42,0.08); border-left:4px solid ${k.color}; border-radius:6px; padding:0.75rem 0.9rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:0.25rem;">
                <span style="font-size:0.7rem; font-weight:700; color:#334155; text-transform:uppercase;">${k.label}</span>
                <span style="color:${k.color}; display:inline-flex; align-items:center;">${k.icon}</span>
              </div>
              <div class="tabular-nums" style="font-size:1.35rem; font-weight:800; color:${k.color}; margin-top:0.25rem;">${k.val}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Interactive Monthly Approvals & Disbursements Bar Chart -->
      <div class="card" style="margin-bottom:1.1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem;">
          <div>
            <h3 style="margin:0; font-size:0.98rem; font-weight:800; display:flex; align-items:center; gap:0.4rem;">
              ${getLucideIcon('chart-column', 17)} Monthly Approvals &amp; Disbursements Trend (${escapeHtml(chartYear)})
            </h3>
            <div style="font-size:0.75rem; color:var(--text-muted);">Month-wise registered cases, sanctioned approvals, and total disbursement payout (₹).</div>
          </div>
          <div style="display:flex; gap:0.4rem; align-items:center;">
            <label style="font-size:0.74rem; font-weight:700; color:var(--text-muted);">Year:</label>
            <select class="form-control" style="width:auto; height:32px; font-size:0.78rem;" onchange="window.MJK.setAnpChartYear(this.value)">
              ${availableYears.map(y => `<option value="${y}" ${chartYear === y ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="position:relative; height:250px; width:100%;">
          <canvas id="anp-landing-bar-chart"></canvas>
        </div>
      </div>

      <!-- Searchable Beneficiary List & Directory Table (Directly Under Chart) -->
      <div class="card" style="padding:0; overflow:hidden; margin-bottom:1.1rem;">
        <div style="padding:0.85rem 1rem; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <strong style="font-size:0.95rem;">Beneficiary List &amp; Directory (${filteredApps.length} of ${allApps.length})</strong>
            <div style="font-size:0.74rem; color:var(--text-muted);">Search by beneficiary name, mobile number, Aadhaar/Govt ID reference, 12-digit App ID, or village address.</div>
          </div>
          <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('application', 'pdf')">📄 PDF</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('application', 'excel')">📊 Excel</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('application', 'print')">🖨 Print</button>
          </div>
        </div>
        <div style="padding:0.65rem 1rem; border-bottom:1px solid var(--border-subtle); background:var(--surface-alt); display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
          <input type="text" id="anp-dir-search" class="form-control" style="flex:1; min-width:210px; height:33px; font-size:0.8rem;" placeholder="Search Beneficiary Name, Mobile, Aadhaar/Govt ID, App ID, Village..." value="${escapeHtml(filters.query)}" oninput="window.MJK.setAnpFilter('query', this.value, 'anp-dir-search')">
          <select class="form-control" style="width:auto; min-width:155px; height:33px; font-size:0.78rem;" onchange="window.MJK.setAnpWardFilter(this.value)">
            <option value="all" ${filters.wardId === 'all' ? 'selected' : ''}>All Wards (${activeWards.length})</option>
            ${activeWards.map(w => `<option value="${escapeHtml(w.wardId)}" ${filters.wardId === w.wardId ? 'selected' : ''}>${escapeHtml(formatWardLabel(w))}</option>`).join('')}
          </select>
          <select class="form-control" style="width:auto; min-width:155px; height:33px; font-size:0.78rem;" onchange="window.MJK.setAnpFilter('village', this.value)">
            <option value="all" ${filters.village === 'all' ? 'selected' : ''}>All Villages / Paras</option>
            ${uniqueVillages.map(v => `<option value="${escapeHtml(v)}" ${filters.village === v ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
          </select>
          <select class="form-control" style="width:auto; min-width:155px; height:33px; font-size:0.78rem;" onchange="window.MJK.setAnpFilter('currentStatus', this.value)">
            <option value="all" ${filters.currentStatus === 'all' ? 'selected' : ''}>All Statuses</option>
            ${appStatuses.map(st => `<option value="${escapeHtml(st)}" ${filters.currentStatus === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.resetAnpFilters()">Reset</button>
        </div>
        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; border-collapse:collapse; font-size:0.81rem;">
            <thead>
              <tr style="background:var(--surface-alt); text-align:left; border-bottom:1px solid var(--border-subtle);">
                <th style="padding:0.65rem 0.75rem;">SL</th>
                <th style="padding:0.65rem 0.75rem;">Application ID &amp; Date</th>
                <th style="padding:0.65rem 0.75rem;">Beneficiary &amp; Mobile</th>
                <th style="padding:0.65rem 0.75rem;">Aadhaar / Govt ID Ref</th>
                <th style="padding:0.65rem 0.75rem;">Ward &amp; Village Address</th>
                <th style="padding:0.65rem 0.75rem;">Status</th>
                <th style="padding:0.65rem 0.75rem; text-align:right;">Disbursement</th>
                <th style="padding:0.65rem 0.75rem; text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredApps.length === 0 ? `
                <tr>
                  <td colspan="8" style="padding:2.25rem; text-align:center; color:var(--text-muted);">
                    No Annapurna beneficiary applications found. Use <strong>Add New Application / Case</strong> to register a real beneficiary record.
                  </td>
                </tr>
              ` : filteredApps.map((a, idx) => `
                <tr style="border-bottom:1px solid var(--border-subtle);">
                  <td class="tabular-nums" style="padding:0.65rem 0.75rem; color:var(--text-muted);">${idx + 1}</td>
                  <td style="padding:0.65rem 0.75rem;">
                    <div class="font-mono tabular-nums" style="font-weight:800; color:var(--blue-700); cursor:pointer;" onclick="window.MJK.openAnnapurnaDetailModal('${a.id}')">${escapeHtml(a.applicationId)}</div>
                    <div class="tabular-nums" style="font-size:0.72rem; color:var(--text-muted);">${formatDate(a.applicationDate)}</div>
                  </td>
                  <td style="padding:0.65rem 0.75rem;">
                    <div style="font-weight:700;">${escapeHtml(a.applicantName)}</div>
                    <div class="font-mono tabular-nums" style="font-size:0.73rem; color:var(--text-muted);">${escapeHtml(a.customerPhone || '-')}</div>
                  </td>
                  <td class="font-mono" style="padding:0.65rem 0.75rem; font-size:0.76rem;">
                    <div>${escapeHtml(a.aadhaarRef || a.voterIdEpic || '-')}</div>
                    ${a.voterIdEpic && a.aadhaarRef ? `<div style="font-size:0.69rem; color:var(--text-muted);">EPIC: ${escapeHtml(a.voterIdEpic)}</div>` : ''}
                  </td>
                  <td style="padding:0.65rem 0.75rem; font-size:0.77rem;">
                    <div style="font-weight:600; color:var(--blue-700);">${escapeHtml(formatAppWardDisplay(a))}</div>
                    <div style="color:var(--text-muted);">${escapeHtml(a.village || '-')}</div>
                  </td>
                  <td style="padding:0.65rem 0.75rem;">
                    ${getAppStatusBadge(a.currentStatus)}
                    <div style="font-size:0.69rem; color:var(--text-muted); margin-top:0.2rem;">${(a.problems || []).length} Problem(s) · ${(a.documents || []).length} Doc(s)</div>
                  </td>
                  <td style="padding:0.65rem 0.75rem; text-align:right;">
                    <div class="font-mono tabular-nums" style="font-weight:800; color:#15803d;">${formatINR(Number(a.disbursementAmount) || 0)}</div>
                    <div style="font-size:0.69rem; color:var(--text-muted);">${escapeHtml(a.paymentStatus || (Number(a.disbursementAmount) > 0 ? 'Disbursed' : 'Pending'))}</div>
                  </td>
                  <td style="padding:0.65rem 0.75rem; text-align:right; white-space:nowrap;">
                    <div style="display:inline-flex; gap:0.25rem; flex-wrap:wrap; justify-content:flex-end;">
                      <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAnnapurnaDetailModal('${a.id}')">👁 View</button>
                      <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openAnnapurnaAppModal('${a.id}')">✏ Edit</button>
                      <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openUpdateAppStatusModal('${a.id}')">🔄 Status</button>
                      <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.printAnnapurnaSlip('${a.id}')">🖨</button>
                      <button type="button" class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.MJK.confirmDeleteAnnapurnaApp('${a.id}')">🗑</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Reminder & Follow-up Summary Strip -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap:0.85rem;">
        <div class="card">
          <h3 style="font-size:0.88rem; font-weight:800; margin-bottom:0.5rem; color:#92400e;">🔔 Today's Follow-ups (${reminders.today.length})</h3>
          ${reminders.today.length === 0 ? `<div style="font-size:0.78rem; color:var(--text-muted);">No follow-ups due today.</div>` : reminders.today.slice(0, 5).map(a => `
            <div style="padding:0.45rem; border:1px solid #fde68a; background:#fffbeb; border-radius:6px; margin-bottom:0.35rem; display:flex; justify-content:space-between; align-items:center; gap:0.4rem;">
              <div style="min-width:0; flex:1;"><div style="font-weight:700; font-size:0.78rem;">${escapeHtml(a.applicantName)}</div><div style="font-size:0.7rem; color:#78350f;">${escapeHtml(a.applicationId)} · ${escapeHtml(a.currentStatus)}</div></div>
              <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAppFollowupModal('${a.id}')">+ Log</button>
            </div>
          `).join('')}
        </div>
        <div class="card">
          <h3 style="font-size:0.88rem; font-weight:800; margin-bottom:0.5rem; color:#b91c1c;">🚨 Overdue Follow-ups (${reminders.overdue.length})</h3>
          ${reminders.overdue.length === 0 ? `<div style="font-size:0.78rem; color:var(--text-muted);">No overdue follow-ups.</div>` : reminders.overdue.slice(0, 5).map(a => `
            <div style="padding:0.45rem; border:1px solid #fecaca; background:#fef2f2; border-radius:6px; margin-bottom:0.35rem; display:flex; justify-content:space-between; align-items:center; gap:0.4rem;">
              <div style="min-width:0; flex:1;"><div style="font-weight:700; font-size:0.78rem;">${escapeHtml(a.applicantName)}</div><div style="font-size:0.7rem; color:#7f1d1d;">Overdue: ${formatDate(a.nextFollowupDate)}</div></div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openAnnapurnaDetailModal('${a.id}')">Open</button>
            </div>
          `).join('')}
        </div>
        <div class="card">
          <h3 style="font-size:0.88rem; font-weight:800; margin-bottom:0.5rem; color:#6d28d9;">📜 Pending RTI &amp; Claims (${reminders.rtiPending.length + reminders.pendingComplaints.length})</h3>
          ${reminders.pendingComplaints.length === 0 ? `<div style="font-size:0.78rem; color:var(--text-muted);">No pending claims or RTI replies.</div>` : reminders.pendingComplaints.slice(0, 5).map(cmp => `
            <div style="padding:0.45rem; border:1px solid #ddd6fe; background:#f5f3ff; border-radius:6px; margin-bottom:0.35rem; display:flex; justify-content:space-between; align-items:center; gap:0.4rem;">
              <div style="min-width:0; flex:1;"><div style="font-weight:700; font-size:0.78rem;">${escapeHtml(cmp.complaintType)} — ${escapeHtml(cmp.applicantName)}</div><div style="font-size:0.7rem; color:#6d28d9;">${escapeHtml(cmp.status)}</div></div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openAppComplaintModal('${cmp.appId}', '${cmp.id}')">Update</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (activeTab === 'add-case') {
    const customers = getAllCustomers();
    ensureInlineProbState();
    tabBody = `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem; padding-bottom:0.7rem; border-bottom:1px solid var(--border-subtle);">
          <div>
            <h3 style="margin:0; font-size:1.05rem; font-weight:800;">Add New Annapurna Application / Case</h3>
            <div style="font-size:0.78rem; color:var(--text-muted);">Required fields: Beneficiary Name, Aadhaar / Govt ID Reference, 10-Digit Mobile Number, 12-Digit Application ID, and Village Address.</div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.setAnpTab('dashboard')">← Back to Beneficiary Directory</button>
        </div>

        <form id="annapurna-inline-app-form" onsubmit="window.MJK.handleSaveAnnapurnaApp(event, '', 'anp-inline')">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Link Registered Customer (Optional)</label>
              <select id="anp-inline-cust-id" class="form-control" onchange="window.MJK.prefillAnnapurnaFromCustomer(this.value, 'anp-inline')">
                <option value="">-- Optional: Select Registered Customer --</option>
                ${customers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (${escapeHtml(c.phone)} · ${escapeHtml(c.id)})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Beneficiary / Applicant Name <span class="req">*</span></label>
              <input type="text" id="anp-inline-applicant-name" class="form-control" required placeholder="Full Beneficiary Name">
            </div>
            <div class="form-group">
              <label class="form-label">Aadhaar / Govt ID Reference <span class="req">*</span></label>
              <input type="text" id="anp-inline-aadhaar-ref" class="form-control font-mono" required placeholder="e.g. XXXX-XXXX-1234 or Ration/EPIC Ref">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Mobile Number (10 Digits) <span class="req">*</span></label>
              <div style="display:flex; align-items:stretch;">
                <span style="display:inline-flex; align-items:center; padding:0 0.65rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-right:0; border-radius:var(--radius-md) 0 0 var(--radius-md); font-weight:700; font-size:0.85rem;">+91</span>
                <input type="tel" id="anp-inline-phone" class="form-control font-mono" style="border-radius:0 var(--radius-md) var(--radius-md) 0;" required maxlength="10" minlength="10" pattern="[0-9]{10}" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,10)" placeholder="10-digit mobile number">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Application ID (12 Digits) <span class="req">*</span></label>
              <input type="text" id="anp-inline-app-id" class="form-control font-mono tabular-nums" required maxlength="12" minlength="12" pattern="[0-9]{12}" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,12)" placeholder="Enter 12-digit Application ID">
            </div>
            <div class="form-group">
              <label class="form-label">Application Date <span class="req">*</span></label>
              <input type="date" id="anp-inline-app-date" class="form-control" required value="${getTodayDate()}">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Head of Family (HOF) Name</label>
              <input type="text" id="anp-inline-hof" class="form-control" placeholder="Head of Family Name">
            </div>
            <div class="form-group">
              <label class="form-label">Voter ID / EPIC Number</label>
              <input type="text" id="anp-inline-epic" class="form-control" placeholder="e.g. WB/08/075/123456">
            </div>
            <div class="form-group">
              <label class="form-label">Village Address / Para <span class="req">*</span></label>
              <input type="text" id="anp-inline-village-address" class="form-control" required placeholder="Village / Locality / Para Address">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Assembly Constituency (AC)</label>
              <input type="text" id="anp-inline-ac" class="form-control" placeholder="e.g. Domkal (75)">
            </div>
            <div class="form-group">
              <label class="form-label">Part Number</label>
              <input type="text" id="anp-inline-part" class="form-control" placeholder="e.g. 142">
            </div>
            <div class="form-group">
              <label class="form-label">Serial Number</label>
              <input type="text" id="anp-inline-serial" class="form-control" placeholder="e.g. 486">
            </div>
          </div>

          ${renderLocationCascadeHtml('anp-inline-loc', {
            title: '📍 Ward, Block &amp; Postal Location (Syncs Village Address automatically if selected)',
            required: false,
            compact: true
          })}

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Current Application Status <span class="req">*</span></label>
              <select id="anp-inline-current-status" class="form-control" required>
                ${appStatuses.map(st => `<option value="${escapeHtml(st)}" ${st === 'Submitted' ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Disbursement Amount (₹)</label>
              <input type="number" id="anp-inline-disbursement" class="form-control font-mono" min="0" step="1" value="0">
            </div>
            <div class="form-group">
              <label class="form-label">Payment Status</label>
              <select id="anp-inline-payment-status" class="form-control">
                <option value="Pending">Pending</option>
                <option value="Initiated">Initiated</option>
                <option value="Disbursed">Disbursed</option>
                <option value="Hold / Stopped">Hold / Stopped</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Next Follow-up Date</label>
              <input type="date" id="anp-inline-next-followup" class="form-control">
            </div>
          </div>

          <!-- Problem Categories A-I -->
          <div style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.85rem; margin-bottom:0.85rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.55rem;">
              <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                <strong style="font-size:0.84rem;">Select Application Problems / Verification Flags (Categories A–I)</strong>
                <span id="anp-inline-prob-selected-count" style="font-size:0.7rem; font-weight:800; padding:0.14rem 0.48rem; border-radius:6px; background:#e2e8f0; color:#475569;">0 selected</span>
              </div>
              <div style="display:flex; gap:0.35rem;">
                <button type="button" class="btn btn-secondary btn-sm" style="padding:0.15rem 0.45rem; font-size:0.7rem;" onclick="window.MJK.setAllAnpProblemCats(true, 'anp-inline')">Expand All</button>
                <button type="button" class="btn btn-secondary btn-sm" style="padding:0.15rem 0.45rem; font-size:0.7rem;" onclick="window.MJK.setAllAnpProblemCats(false, 'anp-inline')">Collapse All</button>
              </div>
            </div>
            <div id="anp-inline-selected-prob-chips" style="display:none; flex-wrap:wrap; gap:0.32rem; margin-bottom:0.55rem;"></div>
            <div style="position:relative; margin-bottom:0.5rem;">
              <span style="position:absolute; left:0.65rem; top:50%; transform:translateY(-50%); font-size:0.82rem; color:var(--text-muted); pointer-events:none;">🔍</span>
              <input type="text" id="anp-inline-problem-search" class="form-control" style="height:36px; padding-left:2rem; padding-right:2.2rem; font-size:0.8rem; background:var(--surface);" placeholder="Search problem (e.g., Aadhaar, NPCI, Housing)..." oninput="window.MJK.onAnpProblemSearch(this.value, 'anp-inline')" onkeydown="if(event.key==='Enter'){event.preventDefault();}">
              <button type="button" id="anp-inline-problem-search-clear" onclick="window.MJK.clearAnpProblemSearch('anp-inline')" style="display:none; position:absolute; right:0.45rem; top:50%; transform:translateY(-50%); width:22px; height:22px; align-items:center; justify-content:center; border:none; border-radius:4px; background:var(--surface-alt); color:var(--text-muted); font-weight:800; cursor:pointer; font-size:0.75rem;">✕</button>
            </div>
            <div id="anp-inline-problem-search-meta" style="display:none; font-size:0.72rem; color:var(--blue-700); font-weight:600; margin-bottom:0.45rem;"></div>
            <div id="anp-inline-problems-accordion-root" style="max-height:260px; overflow-y:auto; display:flex; flex-direction:column; gap:0.45rem; padding-right:0.2rem;"></div>
            <div style="display:flex; gap:0.4rem; margin-top:0.65rem; flex-wrap:wrap; align-items:center;">
              <select id="anp-inline-inline-custom-cat" class="form-control" style="width:auto; max-width:210px; height:34px; font-size:0.76rem;">
                ${categories.map(c => `<option value="${escapeHtml(c.key)}" ${c.key === 'H' ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
              </select>
              <input type="text" id="anp-inline-inline-custom-prob" class="form-control" style="flex:1; min-width:min(100%, 190px); height:34px; font-size:0.78rem;" placeholder="Add custom problem title & save to master..." onkeydown="if(event.key==='Enter'){event.preventDefault(); window.MJK.addInlineCustomProblem('anp-inline');}">
              <button type="button" class="btn btn-outline btn-sm" style="height:34px;" onclick="window.MJK.addInlineCustomProblem('anp-inline')">+ Add &amp; Save Problem</button>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Supporting Documents</label>
              <input type="file" id="anp-inline-doc-files" class="form-control" multiple>
            </div>
            <div class="form-group">
              <label class="form-label">Application Remarks</label>
              <textarea id="anp-inline-remarks" class="form-control" rows="2" placeholder="Verification, bank, housing, or eligibility notes..."></textarea>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.setAnpTab('dashboard')">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Annapurna Application</button>
          </div>
        </form>
      </div>
    `;
  } else if (activeTab === 'verification') {
    const verifySubTab = getVerifySubTab();
    const verifyNavHtml = `
      <div class="card" style="padding:0.75rem 1rem; margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <div style="display:flex; gap:0.45rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-sm ${verifySubTab === 'applications' ? 'btn-primary' : 'btn-secondary'}" onclick="window.MJK.setAnpVerifySubTab('applications')">
            A–I Problems &amp; Verification Queue (${filteredApps.length})
          </button>
          <button type="button" class="btn btn-sm ${verifySubTab === 'complaints' ? 'btn-primary' : 'btn-secondary'}" onclick="window.MJK.setAnpVerifySubTab('complaints')">
            Claims, RTI &amp; Grievances (${totalComplaintsCount})
          </button>
          <button type="button" class="btn btn-sm ${verifySubTab === 'timeline' ? 'btn-primary' : 'btn-secondary'}" onclick="window.MJK.setAnpVerifySubTab('timeline')">
            Chronological Timeline (${totalTimelineCount})
          </button>
        </div>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openAnnapurnaAppModal()">+ New Application</button>
      </div>
    `;

    if (verifySubTab === 'complaints') {
      const rows = [];
      filteredApps.forEach(a => {
        (a.complaints || []).forEach(cmp => rows.push({ app: a, cmp }));
      });
      tabBody = verifyNavHtml + `
        <div class="card" style="padding:0; overflow:hidden;">
          <div style="padding:0.85rem 1rem; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <strong style="font-size:0.95rem;">Claims, RTI &amp; Grievance Register (CMO / BDO / SDO / DM / Camp / RTI)</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">Tracks Claim ID, Applicant, Ward &amp; Village, Linked 12-Digit Application ID, Claim Type, Submission Date, Status, and Next Follow-up.</div>
            </div>
            <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('complaint', 'pdf')">📄 PDF</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('complaint', 'excel')">📊 Excel</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('complaint', 'print')">🖨 Print</button>
              ${allApps.length > 0 ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAppComplaintModal()">+ Log New Claim / Complaint</button>` : ''}
            </div>
          </div>
          <div style="padding:0.65rem 1rem; border-bottom:1px solid var(--border-subtle); background:var(--surface-alt); display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
            <input type="text" class="form-control" style="flex:1; min-width:180px; height:32px; font-size:0.78rem;" placeholder="Search Applicant / App ID / Ward / Village..." value="${escapeHtml(filters.query)}" oninput="window.MJK.setAnpFilter('query', this.value)">
            <select class="form-control" style="width:auto; min-width:155px; height:32px; font-size:0.78rem;" onchange="window.MJK.setAnpWardFilter(this.value)">
              <option value="all" ${filters.wardId === 'all' ? 'selected' : ''}>All Wards (${activeWards.length})</option>
              ${activeWards.map(w => `<option value="${escapeHtml(w.wardId)}" ${filters.wardId === w.wardId ? 'selected' : ''}>${escapeHtml(formatWardLabel(w))}</option>`).join('')}
            </select>
            <select class="form-control" style="width:auto; min-width:165px; height:32px; font-size:0.78rem;" onchange="window.MJK.setAnpFilter('village', this.value)">
              <option value="all" ${filters.village === 'all' ? 'selected' : ''}>All Villages / Paras</option>
              ${uniqueVillages.map(v => `<option value="${escapeHtml(v)}" ${filters.village === v ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.resetAnpFilters()">Reset</button>
          </div>
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; border-collapse:collapse; font-size:0.81rem;">
              <thead>
                <tr style="background:var(--surface-alt); text-align:left; border-bottom:1px solid var(--border-subtle);">
                  <th style="padding:0.65rem 0.85rem;">Claim ID</th>
                  <th style="padding:0.65rem 0.85rem;">Applicant &amp; Ward / Village</th>
                  <th style="padding:0.65rem 0.85rem;">Linked Application ID</th>
                  <th style="padding:0.65rem 0.85rem;">Claim Type</th>
                  <th style="padding:0.65rem 0.85rem;">Submission Date</th>
                  <th style="padding:0.65rem 0.85rem;">Current Status</th>
                  <th style="padding:0.65rem 0.85rem;">Action Taken &amp; Reply</th>
                  <th style="padding:0.65rem 0.85rem;">Next Follow-up</th>
                  <th style="padding:0.65rem 0.85rem; text-align:right;">Manage</th>
                </tr>
              </thead>
              <tbody>
                ${rows.length === 0 ? `
                  <tr><td colspan="9" style="padding:2rem; text-align:center; color:var(--text-muted);">No claims or complaints recorded matching active filters.</td></tr>
                ` : rows.map(({ app, cmp }) => `
                  <tr style="border-bottom:1px solid var(--border-subtle);">
                    <td style="padding:0.65rem 0.85rem; font-family:monospace; font-weight:700;">${escapeHtml(cmp.id)}</td>
                    <td style="padding:0.65rem 0.85rem;">
                      <div style="font-weight:700;">${escapeHtml(app.applicantName)}</div>
                      <div style="font-size:0.71rem; color:var(--text-muted);">${escapeHtml(formatAppWardDisplay(app))} · ${escapeHtml(app.village || '-')}</div>
                    </td>
                    <td style="padding:0.65rem 0.85rem; font-family:monospace; color:var(--blue-700); cursor:pointer;" onclick="window.MJK.openAnnapurnaDetailModal('${app.id}')">${escapeHtml(app.applicationId)}</td>
                    <td style="padding:0.65rem 0.85rem; font-weight:700; color:var(--blue-700);">${escapeHtml(cmp.complaintType)}</td>
                    <td style="padding:0.65rem 0.85rem;">${formatDate(cmp.submissionDate)}</td>
                    <td style="padding:0.65rem 0.85rem;">${getAppStatusBadge(cmp.status)}</td>
                    <td style="padding:0.65rem 0.85rem; max-width:240px;">
                      <div style="font-size:0.77rem;">${escapeHtml(cmp.actionTaken || cmp.description || '-')}</div>
                      ${cmp.replyDetails ? `<div style="font-size:0.72rem; color:#15803d; margin-top:0.2rem;">Reply: ${escapeHtml(cmp.replyDetails)}</div>` : ''}
                    </td>
                    <td style="padding:0.65rem 0.85rem; font-size:0.76rem;">${cmp.nextFollowupDate ? formatDate(cmp.nextFollowupDate) : '-'}</td>
                    <td style="padding:0.65rem 0.85rem; text-align:right;">
                      <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openAppComplaintModal('${app.id}', '${cmp.id}')">✏ Update</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (verifySubTab === 'timeline') {
      const timelineRows = [];
      filteredApps.forEach(a => {
        (a.followupTimeline || []).forEach(tl => timelineRows.push({ app: a, tl }));
      });
      timelineRows.sort((x, y) => String(y.tl.timestamp || y.tl.date || '').localeCompare(String(x.tl.timestamp || x.tl.date || '')));
      tabBody = verifyNavHtml + `
        <div class="card" style="padding:0; overflow:hidden;">
          <div style="padding:0.85rem 1rem; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <strong style="font-size:0.95rem;">Non-Overwriting Chronological Follow-up &amp; Verification Ledger (${timelineRows.length} entries)</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">Tracks every status change, verification, claim, camp submission, and document upload chronologically.</div>
            </div>
            <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
              ${allApps.length > 0 ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAppFollowupModal()">+ Log Activity / Follow-up</button>` : ''}
              <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('followup', 'pdf')">📄 PDF</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('followup', 'excel')">📊 Excel</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('followup', 'print')">🖨 Print</button>
            </div>
          </div>
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; border-collapse:collapse; font-size:0.8rem;">
              <thead>
                <tr style="background:var(--surface-alt); text-align:left; border-bottom:1px solid var(--border-subtle);">
                  <th style="padding:0.6rem 0.8rem;">Date &amp; User</th>
                  <th style="padding:0.6rem 0.8rem;">Applicant, Ward &amp; App ID</th>
                  <th style="padding:0.6rem 0.8rem;">Activity</th>
                  <th style="padding:0.6rem 0.8rem;">Office / Type</th>
                  <th style="padding:0.6rem 0.8rem;">Previous → Updated Status</th>
                  <th style="padding:0.6rem 0.8rem;">Description &amp; Remarks</th>
                  <th style="padding:0.6rem 0.8rem;">Next Follow-up</th>
                  <th style="padding:0.6rem 0.8rem;">State</th>
                </tr>
              </thead>
              <tbody>
                ${timelineRows.length === 0 ? `
                  <tr><td colspan="8" style="padding:2rem; text-align:center; color:var(--text-muted);">No chronological follow-up entries recorded matching active filters.</td></tr>
                ` : timelineRows.map(({ app, tl }) => `
                  <tr style="border-bottom:1px solid var(--border-subtle);">
                    <td style="padding:0.6rem 0.8rem; white-space:nowrap;">
                      <div style="font-weight:700;">${formatDate(tl.date)}</div>
                      <div style="font-size:0.7rem; color:var(--text-muted);">${escapeHtml(tl.recordedBy || 'Staff')} · ${formatDateTime(tl.timestamp)}</div>
                    </td>
                    <td style="padding:0.6rem 0.8rem;">
                      <div style="font-weight:700; cursor:pointer; color:var(--blue-700);" onclick="window.MJK.openAnnapurnaDetailModal('${app.id}')">${escapeHtml(app.applicantName)}</div>
                      <div style="font-family:monospace; font-size:0.72rem;">${escapeHtml(app.applicationId)}</div>
                      <div style="font-size:0.69rem; color:var(--text-muted);">${escapeHtml(formatAppWardDisplay(app))} · ${escapeHtml(app.village || '-')}</div>
                    </td>
                    <td style="padding:0.6rem 0.8rem; font-weight:600;">${escapeHtml(tl.activity)}</td>
                    <td style="padding:0.6rem 0.8rem; font-size:0.74rem; color:var(--text-muted);">${escapeHtml([tl.office, tl.followupType].filter(Boolean).join(' · ') || '-')}</td>
                    <td style="padding:0.6rem 0.8rem; font-size:0.75rem;"><span>${escapeHtml(tl.previousStatus || '-')}</span> → <strong>${escapeHtml(tl.updatedStatus || '-')}</strong></td>
                    <td style="padding:0.6rem 0.8rem; max-width:280px;">
                      <div>${escapeHtml(tl.actionTaken || '-')}</div>
                      ${tl.remarks ? `<div style="font-size:0.72rem; color:var(--text-muted);">${escapeHtml(tl.remarks)}</div>` : ''}
                    </td>
                    <td style="padding:0.6rem 0.8rem; font-size:0.75rem;">${tl.nextFollowupDate ? formatDate(tl.nextFollowupDate) : '-'}</td>
                    <td style="padding:0.6rem 0.8rem;">
                      <button type="button" class="btn btn-sm ${tl.completed ? 'btn-success' : 'btn-secondary'}" style="font-size:0.7rem; padding:0.2rem 0.5rem;" onclick="window.MJK.toggleAnpTimelineDone('${app.id}', '${tl.id}')">
                        ${tl.completed ? '✓ Completed' : '⏳ Pending'}
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      tabBody = verifyNavHtml + `
        <div class="card" style="margin-bottom:1.1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem;">
            <strong style="font-size:0.9rem;">Eligibility &amp; Problem Verification Filters</strong>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.resetAnpFilters()">Reset Filters</button>
          </div>
          <div class="anp-filter-grid">
            <div class="anp-search-span">
              <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">SEARCH (NAME, MOBILE, AADHAAR, APP ID, EPIC)</label>
              <input type="text" class="form-control" style="height:34px; font-size:0.8rem;" placeholder="Search applicant name, phone, Aadhaar ref, app ID..." value="${escapeHtml(filters.query)}" oninput="window.MJK.setAnpFilter('query', this.value)">
            </div>
            <div>
              <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">PROBLEM CATEGORY (A-I)</label>
              <select class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.setAnpFilter('problemCategory', this.value)">
                <option value="all" ${filters.problemCategory === 'all' ? 'selected' : ''}>All Categories (A-I)</option>
                ${categories.map(c => `<option value="${c.key}" ${filters.problemCategory === c.key ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">VERIFICATION STATUS</label>
              <select class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.setAnpFilter('currentStatus', this.value)">
                <option value="all" ${filters.currentStatus === 'all' ? 'selected' : ''}>All Statuses</option>
                ${appStatuses.map(st => `<option value="${escapeHtml(st)}" ${filters.currentStatus === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">WARD NO. FILTER</label>
              <select class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.setAnpWardFilter(this.value)">
                <option value="all" ${filters.wardId === 'all' ? 'selected' : ''}>All Wards (${activeWards.length})</option>
                ${activeWards.map(w => `<option value="${escapeHtml(w.wardId)}" ${filters.wardId === w.wardId ? 'selected' : ''}>${escapeHtml(formatWardLabel(w))}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">VILLAGE / PARA</label>
              <select class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.setAnpFilter('village', this.value)">
                <option value="all" ${filters.village === 'all' ? 'selected' : ''}>All Villages / Paras</option>
                ${uniqueVillages.map(v => `<option value="${escapeHtml(v)}" ${filters.village === v ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">CASE STATE</label>
              <select class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.setAnpFilter('caseState', this.value)">
                <option value="all" ${filters.caseState === 'all' ? 'selected' : ''}>All Cases</option>
                <option value="pending" ${filters.caseState === 'pending' ? 'selected' : ''}>Pending Verification</option>
                <option value="resolved" ${filters.caseState === 'resolved' ? 'selected' : ''}>Approved / Final Cases</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card" style="padding:0; overflow:hidden;">
          <div style="padding:0.75rem 1rem; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div style="font-weight:700; font-size:0.9rem;">Eligibility &amp; Verification Queue (${filteredApps.length} of ${allApps.length})</div>
            <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('verification', 'pdf')">📄 Verification PDF</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('application', 'excel')">📊 Excel</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('application', 'print')">🖨 Print</button>
            </div>
          </div>
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; border-collapse:collapse; font-size:0.82rem;">
              <thead>
                <tr style="background:var(--surface-alt); text-align:left; border-bottom:1px solid var(--border-subtle);">
                  <th style="padding:0.65rem 0.85rem;">Application ID &amp; Date</th>
                  <th style="padding:0.65rem 0.85rem;">Applicant, Aadhaar &amp; Location</th>
                  <th style="padding:0.65rem 0.85rem;">EPIC / AC / Part / Sl</th>
                  <th style="padding:0.65rem 0.85rem;">Eligibility &amp; Status</th>
                  <th style="padding:0.65rem 0.85rem;">Tagged Problems (A-I)</th>
                  <th style="padding:0.65rem 0.85rem;">Docs, Claims &amp; Follow-up</th>
                  <th style="padding:0.65rem 0.85rem; text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filteredApps.length === 0 ? `
                  <tr><td colspan="7" style="padding:2.5rem; text-align:center; color:var(--text-muted);">No applications match the active verification filters.</td></tr>
                ` : filteredApps.map(a => `
                  <tr style="border-bottom:1px solid var(--border-subtle);">
                    <td style="padding:0.65rem 0.85rem;">
                      <div style="font-family:monospace; font-weight:800; color:var(--blue-700); cursor:pointer;" onclick="window.MJK.openAnnapurnaDetailModal('${a.id}')">${escapeHtml(a.applicationId)}</div>
                      <div style="font-size:0.72rem; color:var(--text-muted);">App Date: ${formatDate(a.applicationDate)}</div>
                    </td>
                    <td style="padding:0.65rem 0.85rem;">
                      <div style="font-weight:700;">${escapeHtml(a.applicantName)}</div>
                      <div style="font-size:0.73rem; color:var(--text-muted);">Ref: ${escapeHtml(a.aadhaarRef || '-')} · ${escapeHtml(a.customerPhone || '-')}</div>
                      <div style="font-size:0.71rem; color:var(--blue-700); font-weight:600;">Ward: ${escapeHtml(formatAppWardDisplay(a))} · ${escapeHtml(a.village || '-')}</div>
                    </td>
                    <td style="padding:0.65rem 0.85rem; font-size:0.76rem; font-family:monospace;">
                      <div>EPIC: ${escapeHtml(a.voterIdEpic || '-')}</div>
                      <div style="color:var(--text-muted);">AC:${escapeHtml(a.assemblyConstituency || '-')} P:${escapeHtml(a.partNumber || '-')} S:${escapeHtml(a.serialNumber || '-')}</div>
                    </td>
                    <td style="padding:0.65rem 0.85rem;">
                      ${getAppStatusBadge(a.currentStatus)}
                      <div style="margin-top:0.25rem;">
                        <button type="button" class="btn btn-secondary btn-sm" style="padding:0.15rem 0.45rem; font-size:0.7rem;" onclick="window.MJK.openUpdateAppStatusModal('${a.id}')">Verify / Update</button>
                      </div>
                    </td>
                    <td style="padding:0.65rem 0.85rem; max-width:250px;">
                      ${(a.problems || []).length === 0
                        ? `<span style="font-size:0.74rem; color:var(--text-muted);">No problems tagged</span>`
                        : (a.problems || []).slice(0, 3).map(p => `
                          <div style="font-size:0.73rem; margin-bottom:0.2rem; padding:0.15rem 0.4rem; border-radius:4px; background:${p.problemStatus === 'Resolved' ? '#dcfce7' : '#fff7ed'}; border:1px solid ${p.problemStatus === 'Resolved' ? '#bbf7d0' : '#fed7aa'};">
                            <strong>[${escapeHtml(p.categoryKey)}]</strong> ${escapeHtml(p.title)} <span style="opacity:0.75;">(${escapeHtml(p.problemStatus)})</span>
                          </div>
                        `).join('') + ((a.problems || []).length > 3 ? `<div style="font-size:0.7rem; color:var(--blue-600);">+${a.problems.length - 3} more problem(s)</div>` : '')
                      }
                      <button type="button" class="btn btn-outline btn-sm" style="padding:0.12rem 0.4rem; font-size:0.68rem; margin-top:0.2rem;" onclick="window.MJK.openAddProblemModal('${a.id}')">+ Add Problem</button>
                    </td>
                    <td style="padding:0.65rem 0.85rem; font-size:0.76rem;">
                      <div><strong>${(a.complaints || []).length}</strong> Claim(s) · <strong>${(a.documents || []).length}</strong> Doc(s)</div>
                      <div style="color:${a.nextFollowupDate && a.nextFollowupDate < getTodayDate() && !isAppFinalClosed(a) ? '#b91c1c' : 'var(--text-muted)'}; font-weight:600;">
                        Next: ${a.nextFollowupDate ? formatDate(a.nextFollowupDate) : 'Not set'}
                      </div>
                    </td>
                    <td style="padding:0.65rem 0.85rem; text-align:right; white-space:nowrap;">
                      <div style="display:inline-flex; gap:0.25rem; flex-wrap:wrap; justify-content:flex-end;">
                        <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAnnapurnaDetailModal('${a.id}')">👁 Dossier</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openAppComplaintModal('${a.id}')">⚖ Claim</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openAppFollowupModal('${a.id}')">+ Log</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  } else if (activeTab === 'documents') {
    const docTypes = getActiveConfigItems('documentMasters');
    const qDoc = (filters.query || '').trim().toLowerCase();
    const docRows = [];
    filteredApps.forEach(a => {
      (a.documents || []).forEach(doc => {
        const docName = typeof doc === 'string' ? doc : (doc.name || 'Document');
        const docCat = typeof doc === 'string' ? 'Supporting Document' : (doc.category || doc.docType || 'Supporting Document');
        if (qDoc) {
          const hay = `${docName} ${docCat} ${a.applicantName} ${a.applicationId} ${a.village || ''}`.toLowerCase();
          if (!hay.includes(qDoc)) return;
        }
        docRows.push({ app: a, doc, docName, docCat });
      });
    });

    tabBody = `
      <div class="card" style="margin-bottom:1.1rem;">
        <h3 style="margin:0 0 0.35rem 0; font-size:1rem; font-weight:800;">Centralized Document Vault &amp; Upload Desk</h3>
        <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.85rem;">Upload KYC, Ration Card, NPCI Seeding, Bank Passbook, or Verification proofs directly to any registered Annapurna Beneficiary dossier.</p>
        ${allApps.length === 0 ? `
          <div style="padding:1rem; border:1px dashed var(--border-subtle); border-radius:6px; font-size:0.82rem; color:var(--text-muted);">
            No beneficiary applications registered yet. Register an application in <strong>Add New Application / Case</strong> first to upload documents.
          </div>
        ` : `
          <form onsubmit="window.MJK.handleVaultDocumentUpload(event)" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap:0.75rem; align-items:end;">
            <div>
              <label class="form-label">Select Beneficiary Application <span class="req">*</span></label>
              <select id="anp-vault-app-id" class="form-control" required>
                ${allApps.map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.applicantName)} — ${escapeHtml(a.applicationId)} (${escapeHtml(a.village || '-')})</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label">Document Category</label>
              <select id="anp-vault-doc-type" class="form-control">
                ${docTypes.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
                <option value="Other Supporting Document">Other Supporting Document</option>
              </select>
            </div>
            <div>
              <label class="form-label">Select Files <span class="req">*</span></label>
              <input type="file" id="anp-vault-files" class="form-control" multiple required>
            </div>
            <div>
              <label class="form-label">Remarks</label>
              <input type="text" id="anp-vault-remarks" class="form-control" placeholder="e.g. Verified at BDO counter">
            </div>
            <div>
              <button type="submit" class="btn btn-primary" style="width:100%;">📤 Upload &amp; Attach</button>
            </div>
          </form>
        `}
      </div>

      <div class="card" style="padding:0; overflow:hidden;">
        <div style="padding:0.75rem 1rem; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <strong style="font-size:0.92rem;">Uploaded Verification Documents (${docRows.length})</strong>
          <div style="display:flex; gap:0.45rem; flex-wrap:wrap; align-items:center;">
            <input type="text" id="anp-doc-search" class="form-control" style="width:230px; height:32px; font-size:0.78rem;" placeholder="Search document, beneficiary, App ID..." value="${escapeHtml(filters.query)}" oninput="window.MJK.setAnpFilter('query', this.value, 'anp-doc-search')">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.resetAnpFilters()">Reset</button>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; border-collapse:collapse; font-size:0.81rem;">
            <thead>
              <tr style="background:var(--surface-alt); text-align:left; border-bottom:1px solid var(--border-subtle);">
                <th style="padding:0.65rem 0.85rem;">SL</th>
                <th style="padding:0.65rem 0.85rem;">Document Name</th>
                <th style="padding:0.65rem 0.85rem;">Category</th>
                <th style="padding:0.65rem 0.85rem;">Linked Beneficiary &amp; App ID</th>
                <th style="padding:0.65rem 0.85rem;">Ward &amp; Village</th>
                <th style="padding:0.65rem 0.85rem;">Uploaded Date</th>
                <th style="padding:0.65rem 0.85rem; text-align:right;">Dossier</th>
              </tr>
            </thead>
            <tbody>
              ${docRows.length === 0 ? `
                <tr><td colspan="7" style="padding:2rem; text-align:center; color:var(--text-muted);">No documents uploaded yet.</td></tr>
              ` : docRows.map(({ app, doc, docName, docCat }, idx) => `
                <tr style="border-bottom:1px solid var(--border-subtle);">
                  <td class="tabular-nums" style="padding:0.65rem 0.85rem; color:var(--text-muted);">${idx + 1}</td>
                  <td style="padding:0.65rem 0.85rem; font-weight:700;">📎 ${escapeHtml(docName)}</td>
                  <td style="padding:0.65rem 0.85rem;"><span style="font-size:0.73rem; padding:0.15rem 0.45rem; border-radius:4px; background:#eff6ff; color:#1d4ed8; font-weight:700;">${escapeHtml(docCat)}</span></td>
                  <td style="padding:0.65rem 0.85rem;">
                    <div style="font-weight:700;">${escapeHtml(app.applicantName)}</div>
                    <div class="font-mono" style="font-size:0.72rem; color:var(--blue-700);">${escapeHtml(app.applicationId)}</div>
                  </td>
                  <td style="padding:0.65rem 0.85rem; font-size:0.77rem;">${escapeHtml(formatAppWardDisplay(app))} · ${escapeHtml(app.village || '-')}</td>
                  <td class="tabular-nums" style="padding:0.65rem 0.85rem; font-size:0.76rem; color:var(--text-muted);">${doc?.uploadedAt ? formatDateTime(doc.uploadedAt) : formatDate(app.applicationDate)}</td>
                  <td style="padding:0.65rem 0.85rem; text-align:right;">
                    <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAnnapurnaDetailModal('${app.id}')">👁 Open Dossier</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (activeTab === 'masters') {
    const customProblems = getCustomProblems();
    const customStatuses = getCustomStatuses();
    const customServices = getSavedCustomServices();
    const cfg = getAnnapurnaConfig();

    const renderConfigCard = (title, field, inputId, placeholder, list, isToggleActiveField = null) => `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.55rem;">
          <h3 style="margin:0; font-size:0.92rem; font-weight:800;">${title} (${list.length})</h3>
        </div>
        <form onsubmit="window.MJK.handleAddConfigEntry(event, '${field}', '${inputId}')" style="display:flex; gap:0.35rem; margin-bottom:0.65rem;">
          <input type="text" id="${inputId}" class="form-control" style="flex:1; height:32px; font-size:0.79rem;" placeholder="${placeholder}" required>
          <button type="submit" class="btn btn-primary btn-sm">+ Add</button>
        </form>
        <div style="display:flex; flex-direction:column; gap:0.35rem; max-height:200px; overflow-y:auto;">
          ${list.length === 0
            ? `<div style="font-size:0.76rem; color:var(--text-muted);">No entries configured.</div>`
            : list.map(val => {
                const toggleField = isToggleActiveField || field;
                const active = isConfigItemActive(toggleField, val);
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem; padding:0.35rem 0.55rem; border:1px solid var(--border-subtle); border-radius:4px; background:${active ? 'var(--surface-alt)' : '#f8fafc'}; opacity:${active ? '1' : '0.6'};">
                    <span style="font-size:0.78rem; font-weight:600; ${active ? '' : 'text-decoration:line-through;'}">${escapeHtml(val)}</span>
                    <div style="display:flex; gap:0.25rem; align-items:center;">
                      <button type="button" class="btn btn-secondary btn-sm" style="padding:0.1rem 0.35rem; font-size:0.68rem;" data-field="${escapeHtml(field)}" data-val="${escapeHtml(val)}" onclick="window.MJK.openRenameConfigModal(this.dataset.field, this.dataset.val)" title="Rename / Edit">✏</button>
                      <button type="button" class="btn btn-secondary btn-sm" style="padding:0.1rem 0.35rem; font-size:0.68rem;" data-field="${escapeHtml(toggleField)}" data-val="${escapeHtml(val)}" onclick="window.MJK.toggleConfigActive(this.dataset.field, this.dataset.val)">${active ? 'Active' : 'Inactive'}</button>
                      <button type="button" class="btn btn-secondary btn-sm" style="padding:0.1rem 0.35rem; font-size:0.68rem; color:var(--danger);" data-field="${escapeHtml(field)}" data-val="${escapeHtml(val)}" onclick="window.MJK.removeConfigEntry(this.dataset.field, this.dataset.val)" title="Delete">🗑</button>
                    </div>
                  </div>
                `;
              }).join('')
          }
        </div>
      </div>
    `;

    const wmState = getWardMasterTabState();
    const allMasterWards = getMasterWards({ includeInactive: true });
    const storeAllVils = (getWardMasterStore().villages || []).filter(v => !v.isDeleted);
    const wardSearchQ = (wmState.wardSearch || '').trim().toLowerCase();
    const filteredMasterWards = allMasterWards.filter(w => {
      if (wmState.wardStatusFilter === 'active' && w.isActive === false) return false;
      if (wmState.wardStatusFilter === 'inactive' && w.isActive !== false) return false;
      if (wardSearchQ) {
        const hay = `${w.wardId} ${w.wardNumber} ${w.wardName} ${w.municipalityName}`.toLowerCase();
        if (!hay.includes(wardSearchQ)) return false;
      }
      return true;
    });

    if (!allMasterWards.some(w => w.wardId === wmState.selectedWardId)) {
      wmState.selectedWardId = filteredMasterWards[0]?.wardId || allMasterWards[0]?.wardId || '';
    }
    const selectedWard = getMasterWardById(wmState.selectedWardId) || filteredMasterWards[0] || allMasterWards[0] || null;
    const selectedWardVillagesAll = selectedWard ? getMasterVillagesByWard(selectedWard.wardId, { includeInactive: true }) : [];
    const vilSearchQ = (wmState.villageSearch || '').trim().toLowerCase();
    const filteredWardVillages = selectedWardVillagesAll.filter(v => {
      if (!vilSearchQ) return true;
      return `${v.name} ${v.postOffice} ${v.pinCode}`.toLowerCase().includes(vilSearchQ);
    });

    const locationMasterHtml = `
      <div id="anp-tab5-location-master" class="card" style="margin-bottom:1.15rem; border:1px solid #bfdbfe;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-bottom:0.85rem; padding-bottom:0.65rem; border-bottom:1px solid var(--border-subtle);">
          <div>
            <h3 style="margin:0; font-size:1rem; font-weight:800; color:var(--blue-700);">
              📍 Custom Masters &amp; Config → Location Master → Ward &amp; Village Management
            </h3>
            <div style="font-size:0.76rem; color:var(--text-muted); margin-top:0.15rem;">
              Manage Wards (01–21 &amp; custom) and Ward-linked Villages / Paras. Existing historical applications keep their saved location snapshots.
            </div>
          </div>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
            ${isAdmin
              ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.masterAddWard()">+ Add New Ward</button>`
              : `<span style="font-size:0.74rem; font-weight:700; padding:0.25rem 0.55rem; border-radius:4px; background:#fef3c7; color:#92400e; border:1px solid #fde68a;">Admin Authorization Required to Edit Masters</span>`
            }
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap:1rem; align-items:start;">
          <!-- Left Column: Ward Management -->
          <div style="border:1px solid var(--border-subtle); border-radius:6px; padding:0.75rem; background:var(--surface-alt);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem; margin-bottom:0.55rem;">
              <strong style="font-size:0.88rem;">🏛️ Ward Management (${filteredMasterWards.length} of ${allMasterWards.length})</strong>
              <span class="tabular-nums" style="font-size:0.72rem; color:var(--text-muted);">${storeAllVils.filter(v => v.isActive !== false).length} Active Villages Total</span>
            </div>
            <div style="display:flex; gap:0.35rem; margin-bottom:0.6rem; flex-wrap:wrap;">
              <input type="text" id="wm-ward-search" class="form-control" style="flex:1; min-width:140px; height:32px; font-size:0.78rem;" placeholder="Search Ward No. or Name..." value="${escapeHtml(wmState.wardSearch)}" oninput="window.MJK.masterSetWardSearch(this.value)">
              <select class="form-control" style="width:auto; height:32px; font-size:0.78rem;" onchange="window.MJK.masterSetWardStatusFilter(this.value)">
                <option value="all" ${wmState.wardStatusFilter === 'all' ? 'selected' : ''}>All Status</option>
                <option value="active" ${wmState.wardStatusFilter === 'active' ? 'selected' : ''}>Active Only</option>
                <option value="inactive" ${wmState.wardStatusFilter === 'inactive' ? 'selected' : ''}>Inactive Only</option>
              </select>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:360px; overflow-y:auto; padding-right:2px;">
              ${filteredMasterWards.length === 0
                ? `<div style="padding:1rem; text-align:center; font-size:0.78rem; color:var(--text-muted);">No Wards match this search/filter.</div>`
                : filteredMasterWards.map(w => {
                    const isSel = selectedWard && selectedWard.wardId === w.wardId;
                    const vils = storeAllVils.filter(v => v.wardId === w.wardId);
                    const activeVils = vils.filter(v => v.isActive !== false).length;
                    const wActive = w.isActive !== false;
                    return `
                      <div onclick="window.MJK.masterSelectWard('${escapeHtml(w.wardId)}')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:0.45rem; padding:0.48rem 0.6rem; border-radius:6px; border:${isSel ? '2px solid #2563eb' : '1px solid var(--border-subtle)'}; background:${isSel ? '#eff6ff' : 'var(--surface)'}; opacity:${wActive ? '1' : '0.68'};">
                        <div style="min-width:0; flex:1;">
                          <div style="font-weight:800; font-size:0.81rem; color:${isSel ? '#1d4ed8' : 'var(--text-main)'};">
                            ${escapeHtml(formatWardLabel(w))}
                            <span style="font-size:0.68rem; font-family:monospace; color:var(--text-muted); margin-left:0.25rem;">(${escapeHtml(w.wardId)})</span>
                          </div>
                          <div style="font-size:0.71rem; color:var(--text-muted);">
                            <span class="tabular-nums"><strong>${activeVils}</strong>/${vils.length} Villages</span> ·
                            <span style="font-weight:700; color:${wActive ? '#15803d' : '#b91c1c'};">${wActive ? 'Active' : 'Inactive'}</span>
                          </div>
                        </div>
                        ${isAdmin ? `
                          <div style="display:flex; gap:0.2rem; align-items:center;" onclick="event.stopPropagation()">
                            <button type="button" class="btn btn-secondary btn-sm" style="padding:0.12rem 0.38rem; font-size:0.68rem;" onclick="window.MJK.masterEditWard('${escapeHtml(w.wardId)}')" title="Edit Ward">✏️</button>
                            <button type="button" class="btn btn-secondary btn-sm" style="padding:0.12rem 0.38rem; font-size:0.68rem;" onclick="window.MJK.masterToggleWardActive('${escapeHtml(w.wardId)}', ${!wActive})" title="${wActive ? 'Deactivate Ward' : 'Activate Ward'}">${wActive ? 'Deactivate' : 'Activate'}</button>
                            <button type="button" class="btn btn-secondary btn-sm" style="padding:0.12rem 0.38rem; font-size:0.68rem; color:var(--danger);" onclick="window.MJK.masterDeleteWard('${escapeHtml(w.wardId)}')" title="Delete Ward">🗑️</button>
                          </div>
                        ` : ''}
                      </div>
                    `;
                  }).join('')
              }
            </div>
          </div>

          <!-- Right Column: Village / Locality Management under Selected Ward -->
          <div style="border:1px solid var(--border-subtle); border-radius:6px; padding:0.75rem; background:var(--surface-alt);">
            ${!selectedWard
              ? `<div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.82rem;">Select or add a Ward on the left to manage its Villages / Localities.</div>`
              : `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.45rem; margin-bottom:0.55rem;">
                  <div>
                    <strong style="font-size:0.88rem; color:#15803d;">🏘️ Villages / Localities — ${escapeHtml(formatWardLabel(selectedWard))}</strong>
                    <div style="font-size:0.71rem; color:var(--text-muted);">
                      Linked to ${escapeHtml(selectedWard.wardId)} (${selectedWardVillagesAll.length} records · duplicates blocked inside same Ward)
                    </div>
                  </div>
                  ${isAdmin ? `<button type="button" class="btn btn-success btn-sm" onclick="window.MJK.masterAddVillage('${escapeHtml(selectedWard.wardId)}')">+ Add Village / Para</button>` : ''}
                </div>
                <div style="margin-bottom:0.6rem;">
                  <input type="text" id="wm-vil-search" class="form-control" style="height:32px; font-size:0.78rem;" placeholder="Search Village / Para, P.O., or PIN in ${escapeHtml(selectedWard.wardNumber)}..." value="${escapeHtml(wmState.villageSearch)}" oninput="window.MJK.masterSetVillageSearch(this.value)">
                </div>
                <div style="display:flex; flex-direction:column; gap:0.38rem; max-height:360px; overflow-y:auto; padding-right:2px;">
                  ${filteredWardVillages.length === 0
                    ? `<div style="padding:1rem; text-align:center; font-size:0.78rem; color:var(--text-muted);">No villages / localities recorded under ${escapeHtml(selectedWard.wardNumber)}${vilSearchQ ? ' matching your search' : ''}.</div>`
                    : filteredWardVillages.map(v => {
                        const vActive = v.isActive !== false;
                        return `
                          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.45rem; padding:0.45rem 0.6rem; border-radius:6px; border:1px solid var(--border-subtle); background:var(--surface); opacity:${vActive ? '1' : '0.65'};">
                            <div style="min-width:0; flex:1;">
                              <div style="font-weight:700; font-size:0.8rem; ${vActive ? '' : 'text-decoration:line-through;'}">${escapeHtml(v.name)}</div>
                              <div style="font-size:0.7rem; color:var(--text-muted);">
                                ${v.postOffice ? `P.O.: ${escapeHtml(v.postOffice)} · ` : ''}${v.pinCode ? `PIN: <span class="font-mono">${escapeHtml(v.pinCode)}</span> · ` : ''}
                                <span style="font-weight:700; color:${vActive ? '#15803d' : '#b91c1c'};">${vActive ? 'Active' : 'Inactive'}</span>
                              </div>
                            </div>
                            ${isAdmin ? `
                              <div style="display:flex; gap:0.2rem; align-items:center;">
                                <button type="button" class="btn btn-secondary btn-sm" style="padding:0.12rem 0.38rem; font-size:0.68rem;" onclick="window.MJK.masterEditVillage('${escapeHtml(v.wardId)}', '${escapeHtml(v.id)}')" title="Edit Name or Move to Another Ward">✏️ / Move</button>
                                <button type="button" class="btn btn-secondary btn-sm" style="padding:0.12rem 0.38rem; font-size:0.68rem;" onclick="window.MJK.masterToggleVillageActive('${escapeHtml(v.id)}', ${!vActive})" title="${vActive ? 'Deactivate' : 'Activate'}">${vActive ? 'Deactivate' : 'Activate'}</button>
                                <button type="button" class="btn btn-secondary btn-sm" style="padding:0.12rem 0.38rem; font-size:0.68rem; color:var(--danger);" onclick="window.MJK.masterDeleteVillage('${escapeHtml(v.wardId)}', '${escapeHtml(v.id)}')" title="Delete Village">🗑️</button>
                              </div>
                            ` : ''}
                          </div>
                        `;
                      }).join('')
                  }
                </div>
              `
            }
          </div>
        </div>
      </div>
    `;

    tabBody = `
      ${locationMasterHtml}
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap:1rem;">
        <!-- 1. Application Status Master (System + Custom + Active Toggle) -->
        <div class="card">
          <h3 style="margin:0 0 0.55rem 0; font-size:0.92rem; font-weight:800;">Application Status Master</h3>
          <form onsubmit="window.MJK.handleAddCustomStatus(event)" style="display:flex; gap:0.35rem; margin-bottom:0.65rem;">
            <input type="text" id="new-custom-status-input" class="form-control" style="flex:1; height:32px; font-size:0.79rem;" placeholder="Add custom status..." required>
            <button type="submit" class="btn btn-primary btn-sm">+ Add</button>
          </form>
          <div style="display:flex; flex-direction:column; gap:0.35rem; max-height:200px; overflow-y:auto;">
            ${[...DEFAULT_APP_STATUSES, ...customStatuses.map(c => c.label)].map(st => {
              const isCustom = customStatuses.some(c => c.label === st);
              const active = isConfigItemActive('appStatuses', st);
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem; padding:0.35rem 0.55rem; border:1px solid var(--border-subtle); border-radius:4px; background:var(--surface-alt); opacity:${active ? '1' : '0.6'};">
                  <span style="font-size:0.78rem; font-weight:600;">${escapeHtml(st)} ${isCustom ? '<span style="font-size:0.68rem; color:var(--blue-700);">(Custom)</span>' : ''}</span>
                  <div style="display:flex; gap:0.25rem;">
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:0.1rem 0.35rem; font-size:0.68rem;" onclick="window.MJK.toggleConfigActive('appStatuses', '${escapeHtml(st)}')">${active ? 'Active' : 'Inactive'}</button>
                    ${isCustom ? `<button type="button" class="btn btn-secondary btn-sm" style="padding:0.1rem 0.35rem; font-size:0.68rem; color:var(--danger);" onclick="window.MJK.removeCustomStatus('${escapeHtml(st)}')">🗑</button>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 2. Claim Categories Master -->
        <div class="card">
          <h3 style="margin:0 0 0.55rem 0; font-size:0.92rem; font-weight:800;">Claim & Complaint Categories</h3>
          <form onsubmit="window.MJK.handleAddConfigEntry(event, 'extraComplaintTypes', 'cfg-new-cmp')" style="display:flex; gap:0.35rem; margin-bottom:0.65rem;">
            <input type="text" id="cfg-new-cmp" class="form-control" style="flex:1; height:32px; font-size:0.79rem;" placeholder="Add Claim / Complaint type..." required>
            <button type="submit" class="btn btn-primary btn-sm">+ Add</button>
          </form>
          <div style="display:flex; flex-direction:column; gap:0.35rem; max-height:200px; overflow-y:auto;">
            ${[...DEFAULT_COMPLAINT_TYPES, ...(cfg.extraComplaintTypes || [])].map(ct => {
              const isExtra = (cfg.extraComplaintTypes || []).includes(ct);
              const active = isConfigItemActive('complaintTypes', ct);
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem; padding:0.35rem 0.55rem; border:1px solid var(--border-subtle); border-radius:4px; background:var(--surface-alt); opacity:${active ? '1' : '0.6'};">
                  <span style="font-size:0.78rem; font-weight:600;">${escapeHtml(ct)}</span>
                  <div style="display:flex; gap:0.25rem;">
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:0.1rem 0.35rem; font-size:0.68rem;" onclick="window.MJK.toggleConfigActive('complaintTypes', '${escapeHtml(ct)}')">${active ? 'Active' : 'Inactive'}</button>
                    ${isExtra ? `<button type="button" class="btn btn-secondary btn-sm" style="padding:0.1rem 0.35rem; font-size:0.68rem; color:var(--danger);" onclick="window.MJK.removeConfigEntry('extraComplaintTypes', '${escapeHtml(ct)}')">🗑</button>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 3. Custom Problems Master -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.55rem;">
            <div>
              <h3 style="margin:0; font-size:0.92rem; font-weight:800;">Custom Problems Master (${customProblems.length})</h3>
              <div style="font-size:0.71rem; color:var(--text-muted);">Deleting NEVER corrupts saved historical applications.</div>
            </div>
            <div style="display:flex; gap:0.3rem; flex-wrap:wrap;">
              ${(Object.keys(cfg.standardProblemOverrides || {}).length > 0 || (cfg.deletedStandardProblems || []).length > 0)
                ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.restoreStandardProblemsAction()" title="Restore edited/removed standard A-I problems">↺ Restore Defaults</button>`
                : ''
              }
              <button class="btn btn-primary btn-sm" onclick="window.MJK.openCustomProblemModal()">+ Add</button>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.35rem; max-height:200px; overflow-y:auto;">
            ${customProblems.length === 0
              ? `<div style="font-size:0.78rem; color:var(--text-muted); padding:0.75rem; text-align:center;">No custom problems saved yet.</div>`
              : customProblems.map(cp => `
                <div style="padding:0.45rem 0.6rem; border:1px solid var(--border-subtle); border-radius:4px; background:var(--surface-alt); display:flex; justify-content:space-between; align-items:center; gap:0.4rem;">
                  <div style="min-width:0; flex:1;">
                    <div style="font-weight:700; font-size:0.79rem;">[${escapeHtml(cp.categoryKey)}] ${escapeHtml(cp.title)}</div>
                  </div>
                  <div style="display:flex; gap:0.25rem;">
                    <button class="btn btn-secondary btn-sm" style="padding:0.1rem 0.35rem; font-size:0.68rem;" onclick="window.MJK.openCustomProblemModal('${cp.id}')">✏</button>
                    <button class="btn btn-secondary btn-sm" style="padding:0.1rem 0.35rem; font-size:0.68rem; color:var(--danger);" onclick="window.MJK.deleteCustomProblemMaster('${cp.id}')">🗑</button>
                  </div>
                </div>
              `).join('')
            }
          </div>
        </div>

        <!-- 4. Office Master -->
        ${renderConfigCard('Office Master (BDO / SDO / Camp)', 'officeMasters', 'cfg-new-office', 'e.g. BDO Domkal / SDO Office', cfg.officeMasters)}

        <!-- 5. Document Master -->
        ${renderConfigCard('Document Master', 'documentMasters', 'cfg-new-doc', 'e.g. Ration Card / Bank Passbook', cfg.documentMasters)}

        <!-- 6. RTI Categories -->
        ${renderConfigCard('RTI Categories', 'rtiCategories', 'cfg-new-rti', 'e.g. RTI File / First Appeal', cfg.rtiCategories)}

        <!-- 7. Follow-up Types -->
        ${renderConfigCard('Follow-up Types', 'followupTypes', 'cfg-new-futype', 'e.g. Phone Call / Office Visit', cfg.followupTypes)}

        <!-- 8. Custom Remarks Templates -->
        ${renderConfigCard('Custom Remarks Templates', 'customRemarks', 'cfg-new-remark', 'Add quick remark template...', cfg.customRemarks)}

        <!-- 9. Extra Problem Categories & Customer Services -->
        <div class="card">
          <h3 style="margin:0 0 0.55rem 0; font-size:0.92rem; font-weight:800;">Extra Problem Categories & Services</h3>
          <form onsubmit="window.MJK.handleAddConfigEntry(event, 'extraProblemCategories', 'cfg-new-cat')" style="display:flex; gap:0.35rem; margin-bottom:0.5rem;">
            <input type="text" id="cfg-new-cat" class="form-control" style="flex:1; height:32px; font-size:0.79rem;" placeholder="New Problem Category Name" required>
            <button type="submit" class="btn btn-primary btn-sm">+ Category</button>
          </form>
          <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-bottom:0.75rem;">
            ${(cfg.extraProblemCategories || []).map(v => `<span style="display:inline-flex; align-items:center; gap:0.3rem; background:#fffbeb; border:1px solid #fde68a; color:#92400e; padding:0.15rem 0.45rem; border-radius:4px; font-size:0.73rem; font-weight:700;">${escapeHtml(v)} <button type="button" data-val="${escapeHtml(v)}" onclick="window.MJK.removeConfigEntry('extraProblemCategories', this.dataset.val)" style="color:#b91c1c; font-weight:800;">×</button></span>`).join('') || '<span style="font-size:0.73rem; color:var(--text-muted);">Using A-I defaults</span>'}
          </div>
          <form onsubmit="window.MJK.handleAddMasterCustomService(event)" style="display:flex; gap:0.35rem; margin-bottom:0.5rem;">
            <input type="text" id="new-master-service-input" class="form-control" style="flex:1; height:32px; font-size:0.79rem;" placeholder="Add reusable customer service..." required>
            <button type="submit" class="btn btn-secondary btn-sm">+ Service</button>
          </form>
          <div style="display:flex; flex-wrap:wrap; gap:0.3rem;">
            ${customServices.map(sv => `<span style="display:inline-flex; align-items:center; gap:0.3rem; background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; padding:0.15rem 0.45rem; border-radius:4px; font-size:0.73rem; font-weight:700;">${escapeHtml(sv)} <button type="button" data-val="${escapeHtml(sv)}" onclick="window.MJK.removeMasterCustomService(this.dataset.val)" style="color:#b91c1c; font-weight:800;">×</button></span>`).join('')}
          </div>
        </div>
      </div>
    `;
  } else if (activeTab === 'reports') {
    const reportsList = [
      { id: 'customer', title: '1. Total Applicant / Customer Report', desc: 'Registered customers, mobile numbers, first/last visits, total visit counts, and linked Annapurna applications.', icon: '👥' },
      { id: 'application', title: '2. Application Status Report', desc: 'Complete Annapurna Yojana applications with Applicant, HOF, Village/GP/Block, EPIC/AC/Part/Sl, Status, and Problems (A-I).', icon: '' },
      { id: 'pending', title: '3. Pending Application Report', desc: 'All active non-final Annapurna applications awaiting approval, verification, or claim resolution.', icon: '⏳' },
      { id: 'verification', title: '4. For Further Verification Report', desc: 'Filtered report of all applications currently flagged as "For Further Verification".', icon: '🔎' },
      { id: 'enquiry', title: '5. Under Enquiry Report', desc: 'Applications currently in "Under Enquiry" requiring field or block verification.', icon: '🕵️' },
      { id: 'holdup', title: '6. Hold Up Application Report', desc: 'Applications currently in "Hold Up" or "Application Hold" status for clearance follow-up.', icon: '⏸️' },
      { id: 'complaint', title: '7. Claim & Complaint Report', desc: 'All logged CMO, BDO, SDO, DM, Janakalyan Camp, and Payment/Name claims with statuses and replies.', icon: '⚖️' },
      { id: 'office', title: '8. BDO / SDO Office-wise Report', desc: 'Case counts grouped by BDO, SDO, DM, CMO, and Janakalyan Camp offices with pending vs resolved split.', icon: '🏛️' },
      { id: 'rti', title: '9. RTI File & First Appeal Report', desc: 'Dedicated tracking sheet for RTI File, RTI Application, and RTI First Appeal cases.', icon: '📜' },
      { id: 'payment_stopped', title: '10. Payment Stopped & Bank Report', desc: 'Applications with Payment Stopped status or bank account / DBT failure issues.', icon: '💳' },
      { id: 'name_correction', title: '11. Name Correction Report', desc: 'Cases flagged with Name Correction, Name Mismatch, or Data Entry errors.', icon: '✏️' },
      { id: 'monthly', title: '12. Monthly Application Report', desc: 'Month-by-month summary of registered applications, approvals, pending cases, rejections, and claims.', icon: '📅' },
      { id: 'followup', title: '13. Customer Follow-up Report', desc: 'Complete non-overwriting chronological follow-up history, office channels, remarks, and completion states.', icon: '⏱️' },
      { id: 'npci', title: '14. NPCI & Aadhaar DBT Report', desc: 'Dedicated audit report for NPCI Mapping, Aadhaar Seeding, and DBT problems.', icon: '🏦' },
      { id: 'ward_wise', title: '15. Ward-wise Applications Report', desc: 'Aggregated Annapurna application counts, pending vs approved/rejected split, and villages covered per Ward.', icon: '🏛️' },
      { id: 'village_wise', title: '16. Village / Locality-wise Report', desc: 'Detailed breakdown by Ward & Village / Locality / Para showing case totals and applicant coverage.', icon: '🏘️' }
    ];

    tabBody = `
      <div class="card" style="margin-bottom:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.65rem;">
          <strong style="font-size:0.9rem;">Report Filters (Date, Status, Ward, Village &amp; Block)</strong>
          <button class="btn btn-secondary btn-sm" onclick="window.MJK.resetAnpFilters()">Reset Report Filters</button>
        </div>
        <div class="anp-filter-grid">
          <div>
            <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">DATE FROM</label>
            <input type="date" class="form-control" style="height:34px; font-size:0.8rem;" value="${escapeHtml(filters.submissionFrom)}" onchange="window.MJK.setAnpFilter('submissionFrom', this.value)">
          </div>
          <div>
            <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">DATE TO</label>
            <input type="date" class="form-control" style="height:34px; font-size:0.8rem;" value="${escapeHtml(filters.submissionTo)}" onchange="window.MJK.setAnpFilter('submissionTo', this.value)">
          </div>
          <div>
            <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">STATUS-WISE FILTER</label>
            <select class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.setAnpFilter('currentStatus', this.value)">
              <option value="all">All Statuses</option>
              ${appStatuses.map(st => `<option value="${escapeHtml(st)}" ${filters.currentStatus === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">WARD-WISE FILTER</label>
            <select class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.setAnpWardFilter(this.value)">
              <option value="all" ${filters.wardId === 'all' ? 'selected' : ''}>All Wards</option>
              ${activeWards.map(w => `<option value="${escapeHtml(w.wardId)}" ${filters.wardId === w.wardId ? 'selected' : ''}>${escapeHtml(formatWardLabel(w))}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">VILLAGE / PARA FILTER</label>
            <select class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.setAnpFilter('village', this.value)">
              <option value="all" ${filters.village === 'all' ? 'selected' : ''}>All Villages / Paras</option>
              ${uniqueVillages.map(v => `<option value="${escapeHtml(v)}" ${filters.village === v ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">BLOCK-WISE FILTER</label>
            <select class="form-control" style="height:34px; font-size:0.8rem;" onchange="window.MJK.setAnpFilter('blockOrMunicipality', this.value)">
              <option value="all">All Blocks</option>
              ${uniqueBlocks.map(b => `<option value="${escapeHtml(b)}" ${filters.blockOrMunicipality === b ? 'selected' : ''}>${escapeHtml(b)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Monthly Approvals & Disbursements Bar Chart (Filtered) -->
      <div class="card" style="margin-bottom:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem;">
          <div>
            <h3 style="margin:0; font-size:0.98rem; font-weight:800; display:flex; align-items:center; gap:0.4rem;">
              ${getLucideIcon('chart-column', 17)} Monthly Approvals &amp; Payout Disbursement Graph (${escapeHtml(chartYear)})
            </h3>
            <div style="font-size:0.75rem; color:var(--text-muted);">Live bar chart of monthly approvals &amp; ₹ disbursements matching the active report filters above.</div>
          </div>
          <div style="display:flex; gap:0.4rem; align-items:center;">
            <label style="font-size:0.74rem; font-weight:700; color:var(--text-muted);">Year:</label>
            <select class="form-control" style="width:auto; height:32px; font-size:0.78rem;" onchange="window.MJK.setAnpChartYear(this.value)">
              ${availableYears.map(y => `<option value="${y}" ${chartYear === y ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="position:relative; height:250px; width:100%;">
          <canvas id="anp-reports-bar-chart"></canvas>
        </div>
      </div>

      <!-- Searchable Detailed Payout & Case Breakdown Table (Directly Under Chart) -->
      <div class="card" style="padding:0; overflow:hidden; margin-bottom:1rem;">
        <div style="padding:0.75rem 1rem; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <strong style="font-size:0.92rem;">Detailed Scheme Payout &amp; Beneficiary Table (${filteredApps.length} matching records)</strong>
          <input type="text" id="anp-rep-search" class="form-control" style="width:240px; height:32px; font-size:0.78rem;" placeholder="Search Beneficiary, Aadhaar, App ID..." value="${escapeHtml(filters.query)}" oninput="window.MJK.setAnpFilter('query', this.value, 'anp-rep-search')">
        </div>
        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; border-collapse:collapse; font-size:0.8rem;">
            <thead>
              <tr style="background:var(--surface-alt); text-align:left; border-bottom:1px solid var(--border-subtle);">
                <th style="padding:0.6rem 0.75rem;">SL</th>
                <th style="padding:0.6rem 0.75rem;">Application ID</th>
                <th style="padding:0.6rem 0.75rem;">Beneficiary Name</th>
                <th style="padding:0.6rem 0.75rem;">Aadhaar / Govt ID</th>
                <th style="padding:0.6rem 0.75rem;">Mobile</th>
                <th style="padding:0.6rem 0.75rem;">Ward &amp; Village</th>
                <th style="padding:0.6rem 0.75rem;">App Date</th>
                <th style="padding:0.6rem 0.75rem;">Status</th>
                <th style="padding:0.6rem 0.75rem;">Payment Status</th>
                <th style="padding:0.6rem 0.75rem; text-align:right;">Disbursement (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${filteredApps.length === 0 ? `
                <tr><td colspan="10" style="padding:1.75rem; text-align:center; color:var(--text-muted);">No matching scheme payout records found.</td></tr>
              ` : filteredApps.map((a, idx) => `
                <tr style="border-bottom:1px solid var(--border-subtle);">
                  <td class="tabular-nums" style="padding:0.6rem 0.75rem;">${idx + 1}</td>
                  <td class="font-mono" style="padding:0.6rem 0.75rem; font-weight:700; color:var(--blue-700); cursor:pointer;" onclick="window.MJK.openAnnapurnaDetailModal('${a.id}')">${escapeHtml(a.applicationId)}</td>
                  <td style="padding:0.6rem 0.75rem; font-weight:700;">${escapeHtml(a.applicantName)}</td>
                  <td class="font-mono" style="padding:0.6rem 0.75rem;">${escapeHtml(a.aadhaarRef || a.voterIdEpic || '-')}</td>
                  <td class="font-mono" style="padding:0.6rem 0.75rem;">${escapeHtml(a.customerPhone || '-')}</td>
                  <td style="padding:0.6rem 0.75rem;">${escapeHtml(formatAppWardDisplay(a))} · ${escapeHtml(a.village || '-')}</td>
                  <td class="tabular-nums" style="padding:0.6rem 0.75rem;">${formatDate(a.applicationDate)}</td>
                  <td style="padding:0.6rem 0.75rem;">${getAppStatusBadge(a.currentStatus)}</td>
                  <td style="padding:0.6rem 0.75rem;">${escapeHtml(a.paymentStatus || (Number(a.disbursementAmount) > 0 ? 'Disbursed' : 'Pending'))}</td>
                  <td class="font-mono tabular-nums" style="padding:0.6rem 0.75rem; text-align:right; font-weight:800; color:#15803d;">${formatINR(Number(a.disbursementAmount) || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3 style="margin:0 0 0.35rem 0; font-size:1.05rem; font-weight:800;">Reports & Multi-Format Export Center (${reportsList.length} Reports)</h3>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1.1rem;">
          All reports generate live output directly from saved records matching your active filters above in <strong>PDF</strong>, <strong>Excel (.xlsx)</strong>, <strong>CSV</strong>, and <strong>Print</strong> formats.
        </p>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap:1rem;">
          ${reportsList.map(r => `
            <div style="border:1px solid var(--border-subtle); border-radius:6px; padding:1rem; background:var(--surface-alt); display:flex; flex-direction:column; justify-content:space-between; gap:0.85rem;">
              <div>
                <div style="font-weight:800; font-size:0.93rem; color:var(--text-main);">${r.icon ? `${r.icon} ` : ''}${r.title}</div>
                <div style="font-size:0.77rem; color:var(--text-muted); margin-top:0.35rem; line-height:1.45;">${r.desc}</div>
              </div>
              <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('${r.id}', 'pdf')">📄 PDF</button>
                <button class="btn btn-success btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('${r.id}', 'excel')">📊 Excel</button>
                <button class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('${r.id}', 'csv')">📥 CSV</button>
                <button class="btn btn-secondary btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('${r.id}', 'print')">🖨 Print</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div class="page-content">
      ${subNavHtml}

      <!-- Annapurna Hero Header -->
      <div style="background:linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%); color:#ffffff; border-radius:var(--radius-lg); padding:1.25rem 1.5rem; margin-bottom:1.1rem; box-shadow:var(--shadow-md);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
          <div style="min-width:0; flex:1 1 260px;">
            <div style="display:inline-block; background:rgba(255,255,255,0.2); font-size:0.72rem; font-weight:800; padding:0.2rem 0.6rem; border-radius:4px; margin-bottom:0.35rem;">
              SERVICES • ANNAPURNA YOJANA CASE MANAGEMENT SYSTEM
            </div>
            <h2 style="font-size:1.45rem; font-weight:800; margin:0 0 0.25rem 0; color:#ffffff;">
              Annapurna Yojana Case Management System
            </h2>
            <p style="font-size:0.83rem; color:#dcfce7; margin:0; max-width:820px;">
              Beneficiary Directory → Add Application → Eligibility &amp; Verification → Document Vault → Payout Analytics → Settings &amp; Configuration.
            </p>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-sm" style="background:#ffffff; color:#14532d; font-weight:800;" onclick="window.MJK.setAnpTab('add-case')">Add New Application</button>
          </div>
        </div>
      </div>

      <!-- 6 Clean Operational Sub-Menus -->
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1.1rem;">
        ${tabs.map(t => `
          <button
            type="button"
            class="btn btn-sm ${activeTab === t.id ? 'btn-primary' : 'btn-secondary'}"
            onclick="window.MJK.setAnpTab('${t.id}')"
            style="display:inline-flex; align-items:center; gap:0.45rem; padding:0.42rem 0.8rem;"
          >
            <span>${t.label}</span>
            <span style="font-size:0.68rem; padding:0.1rem 0.42rem; border-radius:4px; background:${activeTab === t.id ? 'rgba(255,255,255,0.25)' : 'var(--surface)'};">${t.badge}</span>
          </button>
        `).join('')}
      </div>

      ${tabBody}
    </div>
  `;
}

/* =========================================================================
   MODALS & HANDLER SETUP
   ========================================================================= */

export function initAnnapurnaChartsAfterRender(currentRoute) {
  const isAnnapurnaRoute = currentRoute === 'govt-annapurna' || String(currentRoute || '').startsWith('annapurna-');
  if (!isAnnapurnaRoute) return;
  const activeTab = getActiveTab();
  const year = getAnpChartYear();
  const filters = getFiltersState();

  if (activeTab === 'dashboard') {
    const canvas = document.getElementById('anp-landing-bar-chart');
    if (canvas) {
      if (anpLandingBarChart) { try { anpLandingBarChart.destroy(); } catch {} anpLandingBarChart = null; }
      const data = buildAnnapurnaMonthlyPayoutAnalytics(getAllAnnapurnaApps(), year);
      anpLandingBarChart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: [
            { label: 'Registered', data: data.registered, backgroundColor: '#2456C7', borderRadius: 4, yAxisID: 'y' },
            { label: 'Approved / Sanctioned', data: data.approved, backgroundColor: '#16A34A', borderRadius: 4, yAxisID: 'y' },
            { label: 'Disbursement (₹)', data: data.disbursement, backgroundColor: '#D6B56D', borderRadius: 4, yAxisID: 'y1' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Applications' } },
            y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Disbursement (₹)' } }
          }
        }
      });
    }
  } else if (activeTab === 'reports') {
    const canvas = document.getElementById('anp-reports-bar-chart');
    if (canvas) {
      if (anpReportsBarChart) { try { anpReportsBarChart.destroy(); } catch {} anpReportsBarChart = null; }
      const data = buildAnnapurnaMonthlyPayoutAnalytics(filterAnnapurnaApplications(filters), year);
      anpReportsBarChart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: [
            { label: 'Approved / Sanctioned', data: data.approved, backgroundColor: '#16A34A', borderRadius: 4, yAxisID: 'y' },
            { label: 'Pending / In-Process', data: data.pending, backgroundColor: '#F59E0B', borderRadius: 4, yAxisID: 'y' },
            { label: 'Disbursement (₹)', data: data.disbursement, backgroundColor: '#2456C7', borderRadius: 4, yAxisID: 'y1' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Cases' } },
            y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Disbursement (₹)' } }
          }
        }
      });
    }
  } else if (activeTab === 'add-case') {
    const stateSel = document.getElementById('anp-inline-loc-state');
    if (stateSel && !stateSel.dataset.cascadeReady) {
      stateSel.dataset.cascadeReady = '1';
      initLocationCascade('anp-inline-loc', { state: 'West Bengal', district: 'Murshidabad' });
      const vilSel = document.getElementById('anp-inline-loc-village');
      const vilAddr = document.getElementById('anp-inline-village-address');
      if (vilSel && vilAddr) {
        vilSel.addEventListener('change', () => {
          if (vilSel.value && vilSel.value !== '__OTHER__' && !vilAddr.value.trim()) {
            vilAddr.value = vilSel.value;
          }
        });
      }
    }
    if (typeof window.MJK?.renderAnpProblemAccordion === 'function') {
      window.MJK.renderAnpProblemAccordion('anp-inline');
    }
  }
}

export function setupAnnapurnaHandlers(MJK, showToast, openModal, closeModal, showConfirmDialog, render) {
  MJK.setAnpTab = (tabId, subTab = null) => {
    const normalized = normalizeAnpTabId(tabId);
    window._anpActiveTab = normalized;
    if (subTab) window._anpVerifySubTab = subTab;
    if (typeof MJK.syncAnnapurnaSubRoute === 'function') {
      MJK.syncAnnapurnaSubRoute(normalized === 'verification' ? getVerifySubTab() : normalized);
    }
    if (normalized === 'masters') {
      syncWardVillageMasterFromServer().then(() => { if (getActiveTab() === 'masters') render(); });
    }
    render();
  };

  MJK.setAnpVerifySubTab = (subTab) => {
    window._anpVerifySubTab = subTab;
    if (typeof MJK.syncAnnapurnaSubRoute === 'function') {
      MJK.syncAnnapurnaSubRoute(subTab);
    }
    render();
  };

  MJK.setAnpChartYear = (yr) => {
    window._anpChartYear = yr || getTodayDate().slice(0, 4);
    render();
  };

  MJK.setAnpFilter = (key, val, focusInputId = '') => {
    const f = getFiltersState();
    f[key] = val;
    const active = document.activeElement;
    const targetId = focusInputId || active?.id || '';
    const selStart = typeof active?.selectionStart === 'number' ? active.selectionStart : null;
    render();
    if (targetId) {
      const el = document.getElementById(targetId);
      if (el) {
        el.focus();
        if (selStart !== null && typeof el.setSelectionRange === 'function') {
          try { el.setSelectionRange(selStart, selStart); } catch {}
        }
      }
    }
  };

  MJK.setAnpWardFilter = (wardId) => {
    const f = getFiltersState();
    f.wardId = wardId || 'all';
    f.village = 'all';
    render();
  };

  MJK.quickAnpFilter = (key, val) => {
    window._anpFilters = {
      query: '',
      problemCategory: 'all',
      currentStatus: 'all',
      complaintType: 'all',
      submissionFrom: '',
      submissionTo: '',
      followupDate: '',
      caseState: 'all',
      wardId: 'all',
      village: 'all',
      gpOrWard: 'all',
      blockOrMunicipality: 'all'
    };
    if (key !== 'all') {
      window._anpFilters[key] = val;
    }
    window._anpActiveTab = 'verification';
    window._anpVerifySubTab = 'applications';
    render();
  };

  MJK.resetAnpFilters = () => {
    window._anpFilters = {
      query: '',
      problemCategory: 'all',
      currentStatus: 'all',
      complaintType: 'all',
      submissionFrom: '',
      submissionTo: '',
      followupDate: '',
      caseState: 'all',
      wardId: 'all',
      village: 'all',
      gpOrWard: 'all',
      blockOrMunicipality: 'all'
    };
    render();
  };

  /* --- Tab 5: Dynamic Ward & Village Master Handlers (Admin Only) --- */
  MJK.masterSelectWard = (wardId) => {
    const st = getWardMasterTabState();
    st.selectedWardId = wardId;
    st.villageSearch = '';
    render();
  };

  MJK.masterSetWardSearch = (val) => {
    const st = getWardMasterTabState();
    st.wardSearch = val || '';
    const active = document.activeElement?.id;
    render();
    if (active === 'wm-ward-search') {
      const el = document.getElementById('wm-ward-search');
      if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch {} }
    }
  };

  MJK.masterSetWardStatusFilter = (val) => {
    const st = getWardMasterTabState();
    st.wardStatusFilter = val || 'all';
    render();
  };

  MJK.masterSetVillageSearch = (val) => {
    const st = getWardMasterTabState();
    st.villageSearch = val || '';
    const active = document.activeElement?.id;
    render();
    if (active === 'wm-vil-search') {
      const el = document.getElementById('wm-vil-search');
      if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch {} }
    }
  };

  MJK.masterAddWard = () => {
    openQuickWardActionModal({
      mode: 'add',
      showToast,
      onCompleted: ({ wardId }) => {
        if (wardId) getWardMasterTabState().selectedWardId = wardId;
        render();
      }
    });
  };

  MJK.masterEditWard = (wardId) => {
    openQuickWardActionModal({
      mode: 'edit',
      wardId,
      showToast,
      onCompleted: () => render()
    });
  };

  MJK.masterToggleWardActive = async (wardId, nextActive) => {
    if (!isWardMasterAdmin()) {
      showToast('Only authorized Administration users can change Ward status.', 'warning');
      return;
    }
    const res = await editMasterWardApi(wardId, { isActive: nextActive });
    if (!res.success) {
      showToast(res.message || 'Could not update Ward status.', 'warning');
      return;
    }
    showToast(res.message || `Ward ${nextActive ? 'activated' : 'deactivated'}.`, 'success');
    render();
  };

  MJK.masterDeleteWard = (wardId) => {
    openQuickWardActionModal({
      mode: 'delete',
      wardId,
      showToast,
      onCompleted: () => {
        const remaining = getMasterWards({ includeInactive: true });
        getWardMasterTabState().selectedWardId = remaining[0]?.wardId || '';
        render();
      }
    });
  };

  MJK.masterAddVillage = (wardId) => {
    openQuickVillageActionModal({
      mode: 'add',
      wardId,
      showToast,
      onCompleted: ({ wardId: chosenWardId }) => {
        if (chosenWardId) getWardMasterTabState().selectedWardId = chosenWardId;
        render();
      }
    });
  };

  MJK.masterEditVillage = (wardId, villageId) => {
    openQuickVillageActionModal({
      mode: 'edit',
      wardId,
      villageId,
      showToast,
      onCompleted: ({ wardId: chosenWardId }) => {
        if (chosenWardId) getWardMasterTabState().selectedWardId = chosenWardId;
        render();
      }
    });
  };

  MJK.masterToggleVillageActive = async (villageId, nextActive) => {
    if (!isWardMasterAdmin()) {
      showToast('Only authorized Administration users can update Village status.', 'warning');
      return;
    }
    const res = await editMasterVillageApi(villageId, { isActive: nextActive });
    if (!res.success) {
      showToast(res.message || 'Could not update Village status.', 'warning');
      return;
    }
    showToast(res.message || `Village ${nextActive ? 'activated' : 'deactivated'}.`, 'success');
    render();
  };

  MJK.masterDeleteVillage = (wardId, villageId) => {
    openQuickVillageActionModal({
      mode: 'delete',
      wardId,
      villageId,
      showToast,
      onCompleted: () => render()
    });
  };

  MJK.exportAnnapurnaReportAction = (reportType, format) => {
    try {
      const res = exportAnnapurnaReport(reportType, format, getFiltersState());
      if (res?.message) showToast(res.message, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate report: ' + (err?.message || 'Error'), 'danger');
    }
  };

  MJK.toggleAnpTimelineDone = (appId, timelineId) => {
    toggleFollowupCompleted(appId, timelineId);
    render();
  };

  /* --- Customer Visit Modal (Add New Visit / Same-Day Grouping) --- */
  MJK.openCustomerVisitModal = (customerId) => {
    const cust = getCustomerById(customerId);
    if (!cust) {
      showToast('Customer not found', 'danger');
      return;
    }
    const allServices = getAllCustomerServicesList();
    const content = `
      <form onsubmit="window.MJK.handleSaveCustomerVisit(event, '${customerId}')">
        <div style="background:var(--surface-alt); padding:0.75rem; border-radius:var(--radius-md); margin-bottom:0.85rem; font-size:0.82rem;">
          Customer: <strong>${escapeHtml(cust.name)}</strong> (${escapeHtml(cust.id)}) · Mobile: <strong>${escapeHtml(cust.phone)}</strong>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.2rem;">
            Same-day grouping active: if multiple services are added on the same date, they are automatically grouped under that day's visit.
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Visit Date <span class="req">*</span></label>
          <input type="date" id="visit-date" class="form-control" value="${getTodayDate()}" required>
        </div>
        <div class="form-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <label class="form-label" style="margin:0;">Select Services Provided in This Visit <span class="req">*</span></label>
            <div style="display:flex; gap:0.35rem;">
              <button type="button" class="btn btn-secondary btn-sm" style="padding:0.15rem 0.45rem; font-size:0.72rem;" onclick="document.querySelectorAll('input[name=visit-srv]').forEach(el=>el.checked=true)">Select All</button>
              <button type="button" class="btn btn-secondary btn-sm" style="padding:0.15rem 0.45rem; font-size:0.72rem;" onclick="document.querySelectorAll('input[name=visit-srv]').forEach(el=>el.checked=false)">Deselect All</button>
            </div>
          </div>
          <div id="visit-services-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 165px), 1fr)); gap:0.35rem; max-height:190px; overflow-y:auto; padding:0.5rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
            ${allServices.map(sv => `
              <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.78rem; cursor:pointer;">
                <input type="checkbox" name="visit-srv" value="${escapeHtml(sv)}">
                <span>${escapeHtml(sv)}</span>
              </label>
            `).join('')}
          </div>
          <div style="display:flex; gap:0.35rem; margin-top:0.5rem;">
            <input type="text" id="visit-custom-srv-input" class="form-control" style="height:34px; font-size:0.8rem;" placeholder="Or enter a new custom service & save...">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.addCustomServiceFromCheckbox('visit-custom-srv-input', 'visit-services-grid', 'visit-srv')">+ Add & Save</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Visit Remarks / Service Notes</label>
          <textarea id="visit-remarks" class="form-control" rows="2" placeholder="Details of documents or work completed..."></textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.viewCustomerProfile('${customerId}')">Back to Profile</button>
          <button type="submit" class="btn btn-primary">Save Visit Record</button>
        </div>
      </form>
    `;
    openModal(`Add New Visit — ${cust.name}`, content, null);
  };

  MJK.addCustomServiceFromCheckbox = (inputId, gridId, checkboxName) => {
    const inp = document.getElementById(inputId);
    const val = inp?.value?.trim();
    if (!val) return;
    const res = addCustomCustomerService(val);
    const grid = document.getElementById(gridId);
    if (grid) {
      const existing = Array.from(grid.querySelectorAll(`input[name="${checkboxName}"]`)).find(
        el => el.value.toLowerCase() === val.toLowerCase()
      );
      if (existing) {
        existing.checked = true;
      } else {
        const lbl = document.createElement('label');
        if (grid.classList.contains('checkout-chip-grid')) {
          lbl.className = 'checkout-service-chip';
        } else {
          lbl.style.cssText = 'display:flex; align-items:center; gap:0.35rem; font-size:0.78rem; cursor:pointer;';
        }
        lbl.innerHTML = `<input type="checkbox" name="${checkboxName}" value="${escapeHtml(val)}" checked> <span>${escapeHtml(val)}</span>`;
        grid.appendChild(lbl);
      }
    }
    if (inp) inp.value = '';
    if (typeof window.MJK?.updateCustServiceCount === 'function') {
      window.MJK.updateCustServiceCount();
    }
    showToast(res.success ? `Saved "${val}" for future use.` : `"${val}" selected.`, 'success');
  };

  MJK.handleSaveCustomerVisit = async (e, customerId) => {
    e.preventDefault();
    const visitDate = document.getElementById('visit-date')?.value || getTodayDate();
    const remarks = document.getElementById('visit-remarks')?.value?.trim() || '';
    const checked = Array.from(document.querySelectorAll('input[name="visit-srv"]:checked')).map(el => el.value);
    try {
      const res = await addCustomerVisit({ customerId, visitDate, servicesProvided: checked, remarks });
      if (!res.success) {
        showToast(res.message, 'warning');
        return;
      }
      showToast(res.groupedIntoSameDay ? 'Service grouped into existing visit on same date!' : 'New customer visit recorded!', 'success');
      MJK.viewCustomerProfile(customerId);
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to record customer visit.', 'danger');
    }
  };

  /* --- Customer Profile Single Export (PDF / Excel / CSV / Print) --- */
  MJK.exportSingleCustomerReport = (customerId, format) => {
    const cust = getCustomerById(customerId);
    if (!cust) return;
    const visits = getCustomerVisitAnalytics(customerId);
    const apps = getAllAnnapurnaApps().filter(a => a.customerId === customerId);

    if (format === 'print') {
      const html = `
        <div class="mun-bw-doc">
          ${renderBwDocumentHeader({
            docTitle: 'CUSTOMER SERVICE DOSSIER',
            docNumber: cust.id,
            docDateTime: formatDate(cust.regDate)
          })}
          ${renderCustomerMetaBlock({
            customerName: cust.name,
            customerAddress: cust.address || `${cust.village || ''}, ${cust.postOffice || ''}, ${cust.district || ''} - ${cust.pinCode || ''}`,
            mobileNumber: cust.phone,
            customerId: cust.id,
            extraPairs: [
              { label: 'First Visit', value: visits.firstVisitDate ? formatDate(visits.firstVisitDate) : '-' },
              { label: 'Last Visit', value: visits.lastVisitDate ? formatDate(visits.lastVisitDate) : '-' },
              { label: 'Visits / Services', value: `${visits.totalVisitCount} / ${visits.totalServicesProvided}` }
            ]
          })}
          <div style="font-weight:900; font-size:9.5pt; margin:8px 0 4px 0; text-transform:uppercase;">Visit History (Same-Day Grouped)</div>
          <table>
            <thead><tr><th>Date</th><th>Days Gap</th><th>Services Provided</th><th>Remarks</th></tr></thead>
            <tbody>
              ${visits.visitsChronological.map(v => `<tr><td class="tabular-nums">${formatDate(v.visitDate)}</td><td>${v.daysFromPrevious === null ? 'First Visit' : `${v.daysFromPrevious} days`}</td><td>${escapeHtml(v.servicesProvided.join(', '))}</td><td>${escapeHtml(v.remarks || '-')}</td></tr>`).join('') || '<tr><td colspan="4" class="text-center">No visits recorded</td></tr>'}
            </tbody>
          </table>
          <div style="font-weight:900; font-size:9.5pt; margin:8px 0 4px 0; text-transform:uppercase;">Annapurna Applications (${apps.length})</div>
          <table>
            <thead><tr><th>App ID</th><th>App Date</th><th>Status</th><th>Problems</th><th>Complaints</th></tr></thead>
            <tbody>
              ${apps.map(a => `<tr><td class="font-mono">${escapeHtml(a.applicationId)}</td><td class="tabular-nums">${formatDate(a.applicationDate)}</td><td>${escapeHtml(a.currentStatus)}</td><td>${escapeHtml((a.problems || []).map(p => p.title).join(', ') || 'None')}</td><td class="tabular-nums">${(a.complaints || []).length}</td></tr>`).join('') || '<tr><td colspan="5" class="text-center">No Annapurna applications</td></tr>'}
            </tbody>
          </table>
          ${renderAcknowledgementSection({ includeCustomerSignature: false })}
        </div>
      `;
      showInAppPrintModal(`Customer Dossier - ${cust.name}`, html, {
        onDownload: () => MJK.exportSingleCustomerReport(customerId, 'pdf')
      });
      return;
    }

    const headers = ['Visit Date', 'Days From Previous Visit', 'Services Count', 'Services Provided', 'Remarks'];
    const rows = visits.visitsChronological.map(v => [
      formatDate(v.visitDate),
      v.daysFromPrevious === null ? 'First Visit' : `${v.daysFromPrevious} days`,
      v.serviceCountOnDay,
      v.servicesProvided.join('; '),
      v.remarks || '-'
    ]);

    if (format === 'csv') {
      exportUniversalCSV({
        filename: `Customer_${cust.id}_Visits`,
        title: `CUSTOMER VISIT DOSSIER — ${cust.name}`,
        subtitle: `Customer ID: ${cust.id} | Mobile: ${cust.phone} | Visits: ${visits.totalVisitCount}`,
        headers,
        rows,
        totalsRow: ['TOTAL', `${visits.totalVisitCount} Visits`, visits.totalServicesProvided, 'Verified Services', '']
      });
      showToast('Customer visit report exported to CSV', 'success');
      return;
    }

    if (format === 'excel') {
      exportUniversalExcel({
        filename: `Customer_${cust.id}_Report`,
        sheetName: 'Visits',
        title: `CUSTOMER VISIT DOSSIER — ${cust.name}`,
        subtitle: `Customer ID: ${cust.id} | Mobile: ${cust.phone} | Visits: ${visits.totalVisitCount}`,
        headers,
        rows,
        totalsRow: ['TOTAL', `${visits.totalVisitCount} Visits`, visits.totalServicesProvided, 'Verified Services', ''],
        extraSheets: [{
          sheetName: 'Annapurna Apps',
          title: `ANNAPURNA APPLICATIONS — ${cust.name}`,
          headers: ['Application ID', 'Application Date', 'Current Status', 'Problems', 'Complaints'],
          rows: apps.map(a => [
            a.applicationId,
            formatDate(a.applicationDate),
            a.currentStatus,
            (a.problems || []).map(p => `${p.title} (${p.problemStatus})`).join('; '),
            (a.complaints || []).length
          ])
        }]
      });
      showToast('Customer report exported to Excel (.xlsx)', 'success');
      return;
    }

    if (format === 'pdf') {
      exportUniversalPDF({
        filename: `Customer_${cust.id}_Report`,
        title: 'CUSTOMER PROFILE & VISIT DOSSIER',
        reportId: cust.id,
        subtitle: `Customer: ${cust.name} | Mobile: ${cust.phone}`,
        summaryCards: [
          { label: 'Total Visits', value: String(visits.totalVisitCount) },
          { label: 'Services Provided', value: String(visits.totalServicesProvided) },
          { label: 'Annapurna Apps', value: String(apps.length) }
        ],
        orientation: 'portrait',
        headers,
        rows,
        totalsRow: ['TOTAL', `${visits.totalVisitCount} Visits`, String(visits.totalServicesProvided), 'Verified Services', '-']
      });
      showToast('Customer report exported to PDF', 'success');
    }
  };

  function closeProblemQuickSubModal() {
    const el = document.getElementById('anp-problem-quick-modal');
    if (el) el.remove();
  }

  function getProbStateForPrefix(prefix = 'anp') {
    if (prefix === 'anp-inline') return ensureInlineProbState();
    return window._anpAppModalProbState;
  }

  function renderProblemAccordionInner(prefix = 'anp') {
    const state = getProbStateForPrefix(prefix);
    if (!state) return;

    const categories = getAllProblemCategoriesWithCustom();
    const isAdmin = isWardMasterAdmin();
    const q = (state.searchQuery || '').trim().toLowerCase();

    const categoriesWithHistorical = categories.map(cat => {
      const details = [...(cat.itemDetails || [])];
      state.selectedMap.forEach((prob) => {
        if (prob.categoryKey === cat.key && !details.some(d => d.title.toLowerCase() === String(prob.title || '').toLowerCase())) {
          details.push({
            title: prob.title,
            originalTitle: prob.title,
            isCustom: false,
            customId: '',
            isHistorical: true,
            categoryKey: cat.key,
            categoryName: cat.name
          });
        }
      });
      return { ...cat, itemDetails: details };
    });

    const selectedList = Array.from(state.selectedMap.values());
    const countBadge = document.getElementById(`${prefix}-prob-selected-count`);
    if (countBadge) {
      countBadge.textContent = `${selectedList.length} selected`;
      countBadge.style.background = selectedList.length > 0 ? '#dcfce7' : '#e2e8f0';
      countBadge.style.color = selectedList.length > 0 ? '#166534' : '#475569';
    }

    const chipsHost = document.getElementById(`${prefix}-selected-prob-chips`);
    if (chipsHost) {
      if (selectedList.length === 0) {
        chipsHost.style.display = 'none';
        chipsHost.innerHTML = '';
      } else {
        chipsHost.style.display = 'flex';
        chipsHost.innerHTML = selectedList.map(p => `
          <span style="display:inline-flex; align-items:center; gap:0.3rem; font-size:0.72rem; font-weight:600; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:0.18rem 0.48rem; border-radius:6px;">
            <span><strong>[${escapeHtml(p.categoryKey)}]</strong> ${escapeHtml(p.title)}</span>
            <button type="button" data-cat-key="${escapeHtml(p.categoryKey)}" data-title="${escapeHtml(p.title)}" onclick="window.MJK.removeSelectedAnpProblemChip(this.dataset.catKey, this.dataset.title, '${escapeHtml(prefix)}')" style="background:none; border:none; color:#1e40af; font-weight:800; cursor:pointer; padding:0 2px; line-height:1;" title="Unselect">×</button>
          </span>
        `).join('');
      }
    }

    const root = document.getElementById(`${prefix}-problems-accordion-root`);
    if (!root) return;

    let totalMatchingItems = 0;
    let totalMatchingCats = 0;

    const catsHtml = categoriesWithHistorical.map(cat => {
      const items = cat.itemDetails || [];
      const matchingItems = q
        ? items.filter(it => `${it.title} ${cat.name}`.toLowerCase().includes(q))
        : items;

      const isVisibleCat = !q || matchingItems.length > 0;
      if (q && matchingItems.length > 0) {
        totalMatchingCats++;
        totalMatchingItems += matchingItems.length;
      }

      const selectedInCat = items.filter(it => state.selectedMap.has(`${cat.key}::${it.title}`)).length;
      const isExpanded = q ? matchingItems.length > 0 : state.expandedCats.has(cat.key);

      return `
        <div
          class="anp-prob-cat-card"
          data-prob-cat="${escapeHtml(cat.key)}"
          style="display:${isVisibleCat ? 'block' : 'none'}; background:var(--surface); border:1px solid ${selectedInCat > 0 ? '#93c5fd' : 'var(--border-subtle)'}; border-radius:8px; overflow:hidden;"
        >
          <div
            role="button"
            tabindex="0"
            onclick="window.MJK.toggleAnpProblemCat('${escapeHtml(cat.key)}', '${escapeHtml(prefix)}')"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.MJK.toggleAnpProblemCat('${escapeHtml(cat.key)}', '${escapeHtml(prefix)}');}"
            style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; padding:0.52rem 0.72rem; cursor:pointer; background:${isExpanded ? 'rgba(37,99,235,0.06)' : 'var(--surface)'}; user-select:none;"
          >
            <div style="display:flex; align-items:center; gap:0.45rem; min-width:0; flex:1;">
              <span class="anp-cat-chevron" style="font-size:0.8rem; color:var(--blue-700); width:14px; display:inline-block; text-align:center;">${isExpanded ? '▾' : '▸'}</span>
              <span style="font-size:0.78rem; font-weight:800; color:var(--blue-700);">${escapeHtml(cat.name)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.35rem; flex-shrink:0;">
              ${selectedInCat > 0 ? `<span style="font-size:0.68rem; font-weight:700; padding:0.1rem 0.42rem; border-radius:4px; background:#dcfce7; color:#166534;">${selectedInCat} selected</span>` : ''}
              <span style="font-size:0.69rem; font-weight:700; padding:0.1rem 0.42rem; border-radius:4px; background:var(--surface-alt); color:var(--text-muted); border:1px solid var(--border-subtle);">
                ${q ? `${matchingItems.length}/${items.length}` : `${items.length}`}
              </span>
            </div>
          </div>
          <div
            class="anp-prob-cat-body"
            style="display:${isExpanded ? 'block' : 'none'}; padding:0.55rem 0.7rem; border-top:1px solid var(--border-subtle);"
          >
            ${items.length === 0
              ? `<div style="font-size:0.74rem; color:var(--text-muted); padding:0.25rem 0;">No problems in this category yet.</div>`
              : `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap:0.38rem;">
                  ${items.map(it => {
                    const key = `${cat.key}::${it.title}`;
                    const checked = state.selectedMap.has(key);
                    const matches = !q || `${it.title} ${cat.name}`.toLowerCase().includes(q);
                    return `
                      <div
                        data-prob-card="1"
                        style="display:${matches ? 'flex' : 'none'}; align-items:center; justify-content:space-between; gap:0.35rem; padding:0.32rem 0.48rem; border-radius:6px; border:1px solid ${checked ? '#60a5fa' : 'var(--border-subtle)'}; background:${checked ? '#eff6ff' : 'var(--surface-alt)'}; transition:background 0.12s, border-color 0.12s;"
                      >
                        <label style="display:flex; align-items:flex-start; gap:0.4rem; font-size:0.75rem; cursor:pointer; flex:1; min-width:0; margin:0;">
                          <input
                            type="checkbox"
                            name="${escapeHtml(prefix)}-prob-cb"
                            data-cat-key="${escapeHtml(cat.key)}"
                            data-cat-name="${escapeHtml(cat.name)}"
                            value="${escapeHtml(it.title)}"
                            ${checked ? 'checked' : ''}
                            onchange="window.MJK.onAnpProblemCheckboxToggle(this, '${escapeHtml(prefix)}')"
                            style="margin-top:2px; flex-shrink:0;"
                          >
                          <span style="line-height:1.3; word-break:break-word; ${checked ? 'font-weight:700; color:#1e3a8a;' : ''}">
                            ${escapeHtml(it.title)}
                            ${it.isCustom ? `<span style="font-size:0.63rem; margin-left:0.25rem; padding:0.04rem 0.28rem; border-radius:3px; background:#fef3c7; color:#92400e; font-weight:700;">Custom</span>` : ''}
                            ${it.isHistorical ? `<span style="font-size:0.63rem; margin-left:0.25rem; padding:0.04rem 0.28rem; border-radius:3px; background:#f1f5f9; color:#475569; font-weight:700;">Saved</span>` : ''}
                          </span>
                        </label>
                        ${(isAdmin && !it.isHistorical) ? `
                          <div style="display:inline-flex; align-items:center; gap:0.18rem; flex-shrink:0;">
                            <button
                              type="button"
                              title="Edit Problem Title"
                              data-cat-key="${escapeHtml(cat.key)}"
                              data-cat-name="${escapeHtml(cat.name)}"
                              data-title="${escapeHtml(it.title)}"
                              data-is-custom="${it.isCustom ? '1' : '0'}"
                              data-custom-id="${escapeHtml(it.customId || '')}"
                              onclick="event.stopPropagation(); window.MJK.openInlineEditProblemModal(this, '${escapeHtml(prefix)}')"
                              style="border:1px solid var(--border-subtle); background:var(--surface); border-radius:4px; padding:0.08rem 0.28rem; font-size:0.68rem; cursor:pointer; line-height:1.2;"
                            >✏️</button>
                            <button
                              type="button"
                              title="Remove Problem from Master"
                              data-cat-key="${escapeHtml(cat.key)}"
                              data-cat-name="${escapeHtml(cat.name)}"
                              data-title="${escapeHtml(it.title)}"
                              data-is-custom="${it.isCustom ? '1' : '0'}"
                              data-custom-id="${escapeHtml(it.customId || '')}"
                              onclick="event.stopPropagation(); window.MJK.openInlineDeleteProblemModal(this, '${escapeHtml(prefix)}')"
                              style="border:1px solid #fecaca; background:var(--surface); color:var(--danger); border-radius:4px; padding:0.08rem 0.28rem; font-size:0.68rem; cursor:pointer; line-height:1.2;"
                            >🗑️</button>
                          </div>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>`
            }
          </div>
        </div>
      `;
    }).join('');

    const emptyNotice = (q && totalMatchingItems === 0)
      ? `<div style="padding:1rem; text-align:center; background:var(--surface); border:1px dashed var(--border-subtle); border-radius:8px; font-size:0.78rem; color:var(--text-muted);">
           No problems match "<strong>${escapeHtml(state.searchQuery)}</strong>". You can add it below as a new custom problem!
         </div>`
      : '';

    root.innerHTML = catsHtml + emptyNotice;

    const metaEl = document.getElementById(`${prefix}-problem-search-meta`);
    if (metaEl) {
      if (q) {
        metaEl.style.display = 'block';
        metaEl.textContent = totalMatchingItems > 0
          ? `Showing ${totalMatchingItems} matching problem(s) across ${totalMatchingCats} categor${totalMatchingCats === 1 ? 'y' : 'ies'}.`
          : `No matching problems found for "${state.searchQuery}".`;
      } else {
        metaEl.style.display = 'none';
        metaEl.textContent = '';
      }
    }

    const clearBtn = document.getElementById(`${prefix}-problem-search-clear`);
    if (clearBtn) {
      clearBtn.style.display = state.searchQuery ? 'inline-flex' : 'none';
    }
  }

  MJK.renderAnpProblemAccordion = renderProblemAccordionInner;

  MJK.handleVaultDocumentUpload = async (e) => {
    e.preventDefault();
    const appId = document.getElementById('anp-vault-app-id')?.value || '';
    const docType = document.getElementById('anp-vault-doc-type')?.value || 'Supporting Document';
    const fileInput = document.getElementById('anp-vault-files');
    const remarks = document.getElementById('anp-vault-remarks')?.value?.trim() || '';
    if (!appId || !fileInput?.files?.length) {
      showToast('Select a beneficiary application and at least one file.', 'warning');
      return;
    }
    const docs = Array.from(fileInput.files).map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      docType,
      uploadedAt: new Date().toISOString()
    }));
    try {
      const res = await addDocumentsToApp(appId, docs, docType, remarks);
      if (!res.success) {
        showToast(res.message || 'Unable to attach documents.', 'warning');
        return;
      }
      showToast(`Attached ${res.addedCount} document(s) to ${appId} vault.`, 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Unable to attach documents.', 'danger');
    }
  };

  /* --- Annapurna Application Create / Edit Modal --- */
  MJK.openAnnapurnaAppModal = (editAppId = null, presetCustomerId = '') => {
    const app = editAppId ? getAnnapurnaAppById(editAppId) : null;
    const customers = getAllCustomers();
    const categories = getAllProblemCategoriesWithCustom();
    const statuses = getAllAppStatuses();
    const selectedCustId = app ? app.customerId : presetCustomerId;
    const selectedCust = selectedCustId ? getCustomerById(selectedCustId) : null;

    const initialSelectedMap = new Map();
    const initialExpandedCats = new Set();
    (app?.problems || []).forEach(p => {
      const catKey = p.categoryKey || 'H';
      const key = `${catKey}::${p.title}`;
      initialSelectedMap.set(key, {
        ...p,
        categoryKey: catKey,
        categoryName: p.categoryName || categories.find(c => c.key === catKey)?.name || 'H. Other Customer Problems',
        problemStatus: p.problemStatus || 'Open / Pending',
        remarks: p.remarks || ''
      });
      initialExpandedCats.add(catKey);
    });

    window._anpAppModalProbState = {
      selectedMap: initialSelectedMap,
      searchQuery: '',
      expandedCats: initialExpandedCats
    };

    const content = `
      <form id="annapurna-app-form" onsubmit="window.MJK.handleSaveAnnapurnaApp(event, '${app ? app.id : ''}')">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Link Registered Customer</label>
            <select id="anp-cust-id" class="form-control" onchange="window.MJK.prefillAnnapurnaFromCustomer(this.value)">
              <option value="">-- Optional: Select Registered Customer --</option>
              ${customers.map(c => `<option value="${c.id}" ${selectedCustId === c.id ? 'selected' : ''}>${escapeHtml(c.name)} (${escapeHtml(c.phone)} · ${escapeHtml(c.id)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Beneficiary / Applicant Name <span class="req">*</span></label>
            <input type="text" id="anp-applicant-name" class="form-control" required value="${escapeHtml(app?.applicantName || selectedCust?.name || '')}" placeholder="Full Beneficiary Name">
          </div>
          <div class="form-group">
            <label class="form-label">Aadhaar / Govt ID Reference <span class="req">*</span></label>
            <input type="text" id="anp-aadhaar-ref" class="form-control font-mono" required value="${escapeHtml(app?.aadhaarRef || app?.voterIdEpic || '')}" placeholder="e.g. XXXX-XXXX-1234 or Ration/EPIC Ref">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Mobile Number (10 Digits) <span class="req">*</span></label>
            <div style="display:flex; align-items:stretch;">
              <span style="display:inline-flex; align-items:center; padding:0 0.65rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-right:0; border-radius:var(--radius-md) 0 0 var(--radius-md); font-weight:700; font-size:0.85rem; color:var(--text-main);">+91</span>
              <input type="tel" id="anp-phone" class="form-control" style="border-radius:0 var(--radius-md) var(--radius-md) 0;" required maxlength="10" minlength="10" pattern="[0-9]{10}" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,10)" value="${escapeHtml(String(app?.customerPhone || selectedCust?.phone || '').replace(/\D/g, '').slice(-10))}" placeholder="10-digit mobile number">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Application ID (12 Digits) <span class="req">*</span></label>
            <input type="text" id="anp-app-id" class="form-control font-mono tabular-nums" required maxlength="12" minlength="12" pattern="[0-9]{12}" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,12)" value="${escapeHtml(String(app?.applicationId || '').replace(/\D/g, '').slice(0, 12))}" placeholder="Enter 12-digit Application ID">
          </div>
          <div class="form-group">
            <label class="form-label">Application Date <span class="req">*</span></label>
            <input type="date" id="anp-app-date" class="form-control" required value="${escapeHtml(app?.applicationDate || getTodayDate())}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Head of Family (HOF) Name</label>
            <input type="text" id="anp-hof" class="form-control" value="${escapeHtml(app?.headOfFamily || '')}" placeholder="Head of Family Name">
          </div>
          <div class="form-group">
            <label class="form-label">Voter ID / EPIC Number</label>
            <input type="text" id="anp-epic" class="form-control" value="${escapeHtml(app?.voterIdEpic || '')}" placeholder="e.g. WB/08/075/123456">
          </div>
          <div class="form-group">
            <label class="form-label">Village Address / Para <span class="req">*</span></label>
            <input type="text" id="anp-village-address" class="form-control" required value="${escapeHtml(app?.village || selectedCust?.village || '')}" placeholder="Village / Locality / Para Address">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Assembly Constituency (AC)</label>
            <input type="text" id="anp-ac" class="form-control" value="${escapeHtml(app?.assemblyConstituency || '')}" placeholder="e.g. Domkal (75)">
          </div>
          <div class="form-group">
            <label class="form-label">Part Number</label>
            <input type="text" id="anp-part" class="form-control" value="${escapeHtml(app?.partNumber || '')}" placeholder="e.g. 142">
          </div>
          <div class="form-group">
            <label class="form-label">Serial Number</label>
            <input type="text" id="anp-serial" class="form-control" value="${escapeHtml(app?.serialNumber || '')}" placeholder="e.g. 486">
          </div>
        </div>

        ${renderLocationCascadeHtml('anp-loc', {
          title: '📍 Location & Postal Details (State / District / P.O. / P.S. / PIN)',
          required: false,
          compact: true
        })}

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Current Application Status (Independent of Problems) <span class="req">*</span></label>
            <select id="anp-current-status" class="form-control" required>
              ${statuses.map(st => `<option value="${escapeHtml(st)}" ${(app?.currentStatus || 'Submitted') === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Disbursement Amount (₹)</label>
            <input type="number" id="anp-disbursement" class="form-control font-mono" min="0" step="1" value="${Number(app?.disbursementAmount) || 0}">
          </div>
          <div class="form-group">
            <label class="form-label">Payment Status</label>
            <select id="anp-payment-status" class="form-control">
              ${['Pending', 'Initiated', 'Disbursed', 'Hold / Stopped'].map(ps => `<option value="${ps}" ${(app?.paymentStatus || 'Pending') === ps ? 'selected' : ''}>${ps}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Next Follow-up Date</label>
            <input type="date" id="anp-next-followup" class="form-control" value="${escapeHtml(app?.nextFollowupDate || '')}">
          </div>
        </div>

        <!-- Problem Categories A-I: Live Search + Collapsible Accordion + Admin Edit/Delete -->
        <div style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.85rem; margin-bottom:0.85rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.55rem;">
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              <strong style="font-size:0.84rem; color:var(--text-main);">Select Application Problems (Categories A – I, Multiple Allowed)</strong>
              <span id="anp-prob-selected-count" style="font-size:0.7rem; font-weight:800; padding:0.14rem 0.48rem; border-radius:6px; background:#e2e8f0; color:#475569;">0 selected</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-secondary btn-sm" style="padding:0.15rem 0.45rem; font-size:0.7rem;" onclick="window.MJK.setAllAnpProblemCats(true)">Expand All</button>
              <button type="button" class="btn btn-secondary btn-sm" style="padding:0.15rem 0.45rem; font-size:0.7rem;" onclick="window.MJK.setAllAnpProblemCats(false)">Collapse All</button>
            </div>
          </div>

          <!-- Selected Problem Quick Chips -->
          <div id="anp-selected-prob-chips" style="display:none; flex-wrap:wrap; gap:0.32rem; margin-bottom:0.55rem;"></div>

          <!-- Sleek Live Search / Quick Filter Bar -->
          <div style="position:relative; margin-bottom:0.5rem;">
            <span style="position:absolute; left:0.65rem; top:50%; transform:translateY(-50%); font-size:0.82rem; color:var(--text-muted); pointer-events:none;">🔍</span>
            <input
              type="text"
              id="anp-problem-search"
              class="form-control"
              style="height:36px; padding-left:2rem; padding-right:2.2rem; font-size:0.8rem; background:var(--surface);"
              placeholder="Type to search problem (e.g., Aadhaar, NPCI, Housing)..."
              oninput="window.MJK.onAnpProblemSearch(this.value)"
              onkeydown="if(event.key==='Enter'){event.preventDefault();}"
            >
            <button
              type="button"
              id="anp-problem-search-clear"
              onclick="window.MJK.clearAnpProblemSearch()"
              title="Clear Search"
              style="display:none; position:absolute; right:0.45rem; top:50%; transform:translateY(-50%); width:22px; height:22px; align-items:center; justify-content:center; border:none; border-radius:4px; background:var(--surface-alt); color:var(--text-muted); font-weight:800; cursor:pointer; font-size:0.75rem;"
            >✕</button>
          </div>
          <div id="anp-problem-search-meta" style="display:none; font-size:0.72rem; color:var(--blue-700); font-weight:600; margin-bottom:0.45rem;"></div>

          <!-- Collapsible Categories A-I Container -->
          <div id="anp-problems-accordion-root" style="max-height:280px; overflow-y:auto; display:flex; flex-direction:column; gap:0.45rem; padding-right:0.2rem;"></div>

          <!-- Inline Custom Problem Adder -->
          <div style="display:flex; gap:0.4rem; margin-top:0.65rem; flex-wrap:wrap; align-items:center;">
            <select id="anp-inline-custom-cat" class="form-control" style="width:auto; max-width:210px; height:34px; font-size:0.76rem;">
              ${categories.map(c => `<option value="${escapeHtml(c.key)}" ${c.key === 'H' ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
            <input
              type="text"
              id="anp-inline-custom-prob"
              class="form-control"
              style="flex:1; min-width:min(100%, 190px); height:34px; font-size:0.78rem;"
              placeholder="Add custom problem title & save to master..."
              onkeydown="if(event.key==='Enter'){event.preventDefault(); window.MJK.addInlineCustomProblem();}"
            >
            <button type="button" class="btn btn-outline btn-sm" style="height:34px;" onclick="window.MJK.addInlineCustomProblem()">+ Add & Save Problem</button>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Supporting Documents (Upload Screenshots / Receipts)</label>
            <input type="file" id="anp-doc-files" class="form-control" multiple>
            ${(app?.documents || []).length > 0 ? `<div style="font-size:0.72rem; color:var(--success); margin-top:0.25rem;">Existing: ${app.documents.map(d => escapeHtml(d.name || d)).join(', ')}</div>` : ''}
          </div>
          <div class="form-group">
            <label class="form-label">Application Remarks</label>
            <textarea id="anp-remarks" class="form-control" rows="2" placeholder="Important notes about eligibility, bank, housing, or verification...">${escapeHtml(app?.remarks || '')}</textarea>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeAnnapurnaAppModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${app ? 'Update Annapurna Application' : 'Save Annapurna Application'}</button>
        </div>
      </form>
    `;

    openModal(app ? `Edit Annapurna Application (${app.applicationId})` : 'Register Annapurna Yojana Application', content, null, 'modal-lg');

    renderProblemAccordionInner();

    const initialWard = app ? resolveWardForApp(app) : (selectedCust ? resolveWardForApp(selectedCust) : null);
    initLocationCascade('anp-loc', {
      areaType: app?.areaType || selectedCust?.areaType || (initialWard ? 'URBAN' : undefined),
      state: app?.state || selectedCust?.state || 'West Bengal',
      district: app?.district || selectedCust?.district || 'Murshidabad',
      blockOrMunicipality: app?.blockOrMunicipality || selectedCust?.blockOrMunicipality || (initialWard ? 'Domkal Municipality' : ''),
      gpOrWard: app?.gpOrWard || app?.wardNumber || selectedCust?.gpOrWard || initialWard?.wardNumber || '',
      village: app?.village || selectedCust?.village || '',
      postOffice: app?.postOffice || selectedCust?.postOffice || '',
      policeStation: app?.policeStation || selectedCust?.policeStation || '',
      pinCode: app?.pinCode || selectedCust?.pinCode || ''
    });

    const modalVillageEl = document.getElementById('anp-loc-village');
    const modalVillageAddrEl = document.getElementById('anp-village-address');
    if (modalVillageEl && modalVillageAddrEl) {
      modalVillageEl.addEventListener('change', () => {
        if (!modalVillageAddrEl.value.trim() && modalVillageEl.value && modalVillageEl.value !== '__NEW__') {
          modalVillageAddrEl.value = modalVillageEl.value;
        }
      });
    }
  };

  MJK.closeAnnapurnaAppModal = () => {
    window._anpAppModalProbState = null;
    closeProblemQuickSubModal();
    closeModal();
  };

  MJK.onAnpProblemSearch = (val, prefix = 'anp') => {
    const state = getProbStateForPrefix(prefix);
    if (!state) return;
    state.searchQuery = val || '';
    renderProblemAccordionInner(prefix);
  };

  MJK.clearAnpProblemSearch = (prefix = 'anp') => {
    const state = getProbStateForPrefix(prefix);
    if (!state) return;
    state.searchQuery = '';
    const inp = document.getElementById(`${prefix}-problem-search`);
    if (inp) {
      inp.value = '';
      inp.focus();
    }
    renderProblemAccordionInner(prefix);
  };

  MJK.toggleAnpProblemCat = (catKey, prefix = 'anp') => {
    const state = getProbStateForPrefix(prefix);
    if (!state) return;
    if (state.expandedCats.has(catKey)) {
      state.expandedCats.delete(catKey);
    } else {
      state.expandedCats.add(catKey);
    }
    renderProblemAccordionInner(prefix);
  };

  MJK.setAllAnpProblemCats = (expandAll, prefix = 'anp') => {
    const state = getProbStateForPrefix(prefix);
    if (!state) return;
    const cats = getAllProblemCategoriesWithCustom();
    state.expandedCats = expandAll ? new Set(cats.map(c => c.key)) : new Set();
    renderProblemAccordionInner(prefix);
  };

  MJK.onAnpProblemCheckboxToggle = (checkboxEl, prefix = 'anp') => {
    const state = getProbStateForPrefix(prefix);
    if (!state || !checkboxEl) return;
    const catKey = checkboxEl.getAttribute('data-cat-key') || 'H';
    const catName = checkboxEl.getAttribute('data-cat-name') || 'H. Other Customer Problems';
    const title = checkboxEl.value;
    const key = `${catKey}::${title}`;

    if (checkboxEl.checked) {
      if (!state.selectedMap.has(key)) {
        state.selectedMap.set(key, {
          categoryKey: catKey,
          categoryName: catName,
          title,
          problemStatus: 'Open / Pending',
          remarks: ''
        });
      }
    } else {
      state.selectedMap.delete(key);
    }
    renderProblemAccordionInner(prefix);
  };

  MJK.removeSelectedAnpProblemChip = (catKey, title, prefix = 'anp') => {
    const state = getProbStateForPrefix(prefix);
    if (!state) return;
    state.selectedMap.delete(`${catKey}::${title}`);
    renderProblemAccordionInner(prefix);
  };

  MJK.openInlineEditProblemModal = (btn, prefix = 'anp') => {
    if (!isWardMasterAdmin()) {
      showToast('Only authorized Administrators can edit problem tags.', 'warning');
      return;
    }
    const catKey = btn?.dataset?.catKey || 'H';
    const catName = btn?.dataset?.catName || catKey;
    const oldTitle = btn?.dataset?.title || '';
    const isCustom = btn?.dataset?.isCustom === '1';
    const customId = btn?.dataset?.customId || '';
    if (!oldTitle) return;

    closeProblemQuickSubModal();
    const overlay = document.createElement('div');
    overlay.id = 'anp-problem-quick-modal';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:12000; background:rgba(15,23,42,0.58); display:flex; align-items:center; justify-content:center; padding:1rem;';
    overlay.innerHTML = `
      <div style="background:var(--surface, #ffffff); color:var(--text-main, #0f172a); width:100%; max-width:440px; border-radius:var(--radius-lg, 10px); border:1px solid var(--border-subtle, #e2e8f0); box-shadow:0 20px 50px rgba(0,0,0,0.32); overflow:hidden;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.85rem 1rem; border-bottom:1px solid var(--border-subtle, #e2e8f0); background:var(--surface-alt, #f8fafc);">
          <strong style="font-size:0.92rem;">✏️ Edit Problem Tag</strong>
          <button type="button" id="anp-pqm-close" class="btn btn-secondary btn-sm" style="padding:0.15rem 0.45rem;">✕</button>
        </div>
        <form id="anp-pqm-edit-form" style="padding:1rem;">
          <div style="font-size:0.74rem; color:var(--text-muted); margin-bottom:0.65rem;">
            Category: <strong>${escapeHtml(catName)}</strong> (${isCustom ? 'Custom' : 'Standard'})
          </div>
          <div class="form-group">
            <label class="form-label">Problem Title <span class="req">*</span></label>
            <input type="text" id="anp-pqm-title-input" class="form-control" required value="${escapeHtml(oldTitle)}" placeholder="Enter problem title">
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.85rem;">
            <button type="button" id="anp-pqm-cancel" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) closeProblemQuickSubModal();
    });
    document.getElementById('anp-pqm-close')?.addEventListener('click', closeProblemQuickSubModal);
    document.getElementById('anp-pqm-cancel')?.addEventListener('click', closeProblemQuickSubModal);

    const inp = document.getElementById('anp-pqm-title-input');
    if (inp) {
      inp.focus();
      try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch {}
    }

    document.getElementById('anp-pqm-edit-form')?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const newTitle = document.getElementById('anp-pqm-title-input')?.value?.trim() || '';
      const res = updateProblemMasterItem({ categoryKey: catKey, oldTitle, newTitle, isCustom, customId });
      if (!res.success) {
        showToast(res.message || 'Unable to update problem tag.', 'warning');
        return;
      }
      const state = getProbStateForPrefix(prefix);
      if (state) {
        const oldKey = `${catKey}::${oldTitle}`;
        const newKey = `${catKey}::${res.newTitle}`;
        if (state.selectedMap.has(oldKey)) {
          const prevObj = state.selectedMap.get(oldKey);
          state.selectedMap.delete(oldKey);
          state.selectedMap.set(newKey, { ...prevObj, title: res.newTitle });
        }
      }
      closeProblemQuickSubModal();
      renderProblemAccordionInner(prefix);
      showToast(`Updated problem tag to "${res.newTitle}".`, 'success');
    });
  };

  MJK.openInlineDeleteProblemModal = (btn, prefix = 'anp') => {
    if (!isWardMasterAdmin()) {
      showToast('Only authorized Administrators can delete problem tags.', 'warning');
      return;
    }
    const catKey = btn?.dataset?.catKey || 'H';
    const catName = btn?.dataset?.catName || catKey;
    const title = btn?.dataset?.title || '';
    const isCustom = btn?.dataset?.isCustom === '1';
    const customId = btn?.dataset?.customId || '';
    if (!title) return;

    closeProblemQuickSubModal();
    const overlay = document.createElement('div');
    overlay.id = 'anp-problem-quick-modal';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:12000; background:rgba(15,23,42,0.58); display:flex; align-items:center; justify-content:center; padding:1rem;';
    overlay.innerHTML = `
      <div style="background:var(--surface, #ffffff); color:var(--text-main, #0f172a); width:100%; max-width:440px; border-radius:var(--radius-lg, 10px); border:1px solid var(--border-subtle, #e2e8f0); box-shadow:0 20px 50px rgba(0,0,0,0.32); overflow:hidden;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.85rem 1rem; border-bottom:1px solid var(--border-subtle, #e2e8f0); background:var(--surface-alt, #f8fafc);">
          <strong style="font-size:0.92rem; color:var(--danger);">🗑️ Remove Problem Tag</strong>
          <button type="button" id="anp-pqm-close" class="btn btn-secondary btn-sm" style="padding:0.15rem 0.45rem;">✕</button>
        </div>
        <div style="padding:1rem;">
          <div style="font-size:0.83rem; margin-bottom:0.85rem; line-height:1.45;">
            Remove <strong>"${escapeHtml(title)}"</strong> from <strong>${escapeHtml(catName)}</strong>?
            <div style="font-size:0.74rem; color:var(--text-muted); margin-top:0.35rem;">
              Existing saved historical Annapurna applications using this problem will remain completely untouched.
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
            <button type="button" id="anp-pqm-cancel" class="btn btn-secondary">Cancel</button>
            <button type="button" id="anp-pqm-confirm-del" class="btn btn-danger">Confirm Remove</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) closeProblemQuickSubModal();
    });
    document.getElementById('anp-pqm-close')?.addEventListener('click', closeProblemQuickSubModal);
    document.getElementById('anp-pqm-cancel')?.addEventListener('click', closeProblemQuickSubModal);
    document.getElementById('anp-pqm-confirm-del')?.addEventListener('click', () => {
      const res = deleteProblemMasterItem({ categoryKey: catKey, title, isCustom, customId });
      if (!res.success) {
        showToast(res.message || 'Could not remove problem tag.', 'warning');
        return;
      }
      const state = getProbStateForPrefix(prefix);
      if (state) {
        state.selectedMap.delete(`${catKey}::${title}`);
      }
      closeProblemQuickSubModal();
      renderProblemAccordionInner(prefix);
      showToast(`Removed "${title}" from problem list.`, 'info');
    });
  };

  MJK.restoreStandardProblemsAction = () => {
    showConfirmDialog(
      'Restore Standard Problems (A–I)?',
      'This will restore all default problem titles and unhide any removed standard problems across Categories A–I. Custom problems and historical applications remain unchanged.',
      () => {
        restoreDeletedStandardProblems();
        showToast('Standard problem categories (A–I) restored to defaults.', 'success');
        render();
      }
    );
  };

  MJK.prefillAnnapurnaFromCustomer = async (custId, prefix = 'anp') => {
    if (!custId) return;
    const cust = getCustomerById(custId);
    if (!cust) return;
    const nameEl = document.getElementById(`${prefix}-applicant-name`);
    const phoneEl = document.getElementById(`${prefix}-phone`);
    const hofEl = document.getElementById(`${prefix}-hof`);
    const vilAddrEl = document.getElementById(`${prefix}-village-address`);
    const cleanPhone = String(cust.phone || '').replace(/\D/g, '').slice(-10);
    if (nameEl && !nameEl.value) nameEl.value = cust.name || '';
    if (phoneEl && !phoneEl.value && cleanPhone) phoneEl.value = cleanPhone;
    if (hofEl && !hofEl.value && cust.fatherName) hofEl.value = cust.fatherName;
    if (vilAddrEl && !vilAddrEl.value && cust.village) vilAddrEl.value = cust.village;
    const custWard = resolveWardForApp(cust);
    await syncLocationCascadeSelection(`${prefix}-loc`, {
      areaType: cust.areaType || (custWard ? 'URBAN' : undefined),
      state: cust.state || 'West Bengal',
      district: cust.district || 'Murshidabad',
      subdivision: cust.subdivision || '',
      blockOrMunicipality: cust.blockOrMunicipality || (custWard ? 'Domkal Municipality' : ''),
      gpOrWard: cust.gpOrWard || cust.wardNumber || custWard?.wardNumber || '',
      village: cust.village || '',
      postOffice: cust.postOffice || '',
      policeStation: cust.policeStation || '',
      pinCode: cust.pinCode || ''
    });
  };

  MJK.addInlineCustomProblem = async (prefix = 'anp') => {
    const inp = document.getElementById(`${prefix}-inline-custom-prob`);
    const catSel = document.getElementById(`${prefix}-inline-custom-cat`);
    const val = inp?.value?.trim();
    if (!val) {
      showToast('Enter a custom problem title first.', 'warning');
      return;
    }
    const catKey = catSel?.value || 'H';
    const categories = getAllProblemCategoriesWithCustom();
    const catObj = categories.find(c => c.key === catKey) || categories.find(c => c.key === 'H');
    const catName = catObj?.name || 'H. Other Customer Problems';

    try {
      const saveRes = await saveCustomProblem({ title: val, categoryKey: catKey, categoryName: catName });
      if (saveRes && !saveRes.success) {
        showToast(saveRes.message || 'Problem already exists in this category.', 'warning');
        return;
      }

      const state = getProbStateForPrefix(prefix);
      if (state) {
        state.selectedMap.set(`${catKey}::${val}`, {
          categoryKey: catKey,
          categoryName: catName,
          title: val,
          problemStatus: 'Open / Pending',
          remarks: ''
        });
        state.expandedCats.add(catKey);
      }

      if (inp) inp.value = '';
      renderProblemAccordionInner(prefix);
      showToast(`Custom problem "${val}" saved to ${catName} and selected.`, 'success');
    } catch (err) {
      showToast(err?.message || 'Failed to save custom problem.', 'danger');
    }
  };

  MJK.handleSaveAnnapurnaApp = async (e, editId, prefix = 'anp') => {
    e.preventDefault();
    const existing = editId ? getAnnapurnaAppById(editId) : null;
    const applicantName = document.getElementById(`${prefix}-applicant-name`)?.value?.trim() || '';
    if (!applicantName) {
      showToast('Beneficiary Name is required.', 'warning');
      return;
    }

    const aadhaarRef = document.getElementById(`${prefix}-aadhaar-ref`)?.value?.trim() || '';
    if (!aadhaarRef) {
      showToast('Aadhaar / Govt ID Reference is required.', 'warning');
      return;
    }

    const rawPhone = String(document.getElementById(`${prefix}-phone`)?.value || '').replace(/\D/g, '').slice(-10);
    const rawAppId = String(document.getElementById(`${prefix}-app-id`)?.value || '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(rawPhone)) {
      showToast('Mobile Number must be exactly 10 digits.', 'warning');
      return;
    }
    if (!/^\d{12}$/.test(rawAppId)) {
      showToast('Application ID must be exactly 12 digits.', 'warning');
      return;
    }

    const loc = getLocationCascadeValues(`${prefix}-loc`);
    const explicitVillageAddr = document.getElementById(`${prefix}-village-address`)?.value?.trim() || '';
    const resolvedVillage = explicitVillageAddr || loc.village || existing?.village || '';
    if (!resolvedVillage) {
      showToast('Village Address is required.', 'warning');
      return;
    }

    const fileInput = document.getElementById(`${prefix}-doc-files`);
    const newDocs = [];
    if (fileInput?.files?.length) {
      for (const file of Array.from(fileInput.files)) {
        newDocs.push({ name: file.name, size: file.size, type: file.type, uploadedAt: new Date().toISOString() });
      }
    }

    const existingProblemsMap = new Map((existing?.problems || []).map(p => [`${p.categoryKey}::${p.title}`, p]));
    const probState = getProbStateForPrefix(prefix);
    let selectedProblems = [];
    if (probState && probState.selectedMap instanceof Map) {
      selectedProblems = Array.from(probState.selectedMap.values()).map(p => {
        const prev = existingProblemsMap.get(`${p.categoryKey}::${p.title}`);
        return prev || {
          categoryKey: p.categoryKey || 'H',
          categoryName: p.categoryName || 'H. Other Customer Problems',
          title: p.title,
          problemStatus: p.problemStatus || 'Open / Pending',
          remarks: p.remarks || ''
        };
      });
    } else {
      selectedProblems = Array.from(document.querySelectorAll(`input[name="${prefix}-prob-cb"]:checked`)).map(el => {
        const key = el.getAttribute('data-cat-key') || 'H';
        const catName = el.getAttribute('data-cat-name') || 'H. Other Customer Problems';
        const title = el.value;
        const prev = existingProblemsMap.get(`${key}::${title}`);
        return prev || { categoryKey: key, categoryName: catName, title, problemStatus: 'Open / Pending', remarks: '' };
      });
    }

    saveCustomLocationIfNeeded({ ...loc, village: resolvedVillage });

    const resolvedLocWard = loc.wardId
      ? getMasterWardById(loc.wardId)
      : (loc.gpOrWard ? resolveWardForApp({ gpOrWard: loc.gpOrWard, wardNumber: loc.gpOrWard }) : null);

    const disbAmt = Math.max(0, Number(document.getElementById(`${prefix}-disbursement`)?.value) || 0);
    const payStatus = document.getElementById(`${prefix}-payment-status`)?.value || (disbAmt > 0 ? 'Disbursed' : 'Pending');

    const data = {
      id: editId || undefined,
      customerId: document.getElementById(`${prefix}-cust-id`)?.value || existing?.customerId || '',
      applicantName,
      aadhaarRef,
      customerPhone: `+91 ${rawPhone}`,
      applicationId: rawAppId,
      applicationDate: document.getElementById(`${prefix}-app-date`)?.value || getTodayDate(),
      headOfFamily: document.getElementById(`${prefix}-hof`)?.value?.trim() || '',
      voterIdEpic: document.getElementById(`${prefix}-epic`)?.value?.trim() || '',
      assemblyConstituency: document.getElementById(`${prefix}-ac`)?.value?.trim() || '',
      partNumber: document.getElementById(`${prefix}-part`)?.value?.trim() || '',
      serialNumber: document.getElementById(`${prefix}-serial`)?.value?.trim() || '',
      areaType: loc.areaType || existing?.areaType || '',
      state: loc.state || existing?.state || 'West Bengal',
      district: loc.district || existing?.district || 'Murshidabad',
      blockOrMunicipality: loc.blockOrMunicipality || existing?.blockOrMunicipality || '',
      wardId: loc.wardId || resolvedLocWard?.wardId || existing?.wardId || '',
      wardNo: loc.wardNo || resolvedLocWard?.wardNo || existing?.wardNo || '',
      wardNumber: loc.wardNumber || resolvedLocWard?.wardNumber || existing?.wardNumber || '',
      wardName: resolvedLocWard?.wardName || existing?.wardName || '',
      gpOrWard: loc.gpOrWard || existing?.gpOrWard || '',
      villageId: existing?.villageId || '',
      village: resolvedVillage,
      postOffice: loc.postOffice || existing?.postOffice || '',
      policeStation: loc.policeStation || existing?.policeStation || '',
      pinCode: loc.pinCode || existing?.pinCode || '',
      currentStatus: document.getElementById(`${prefix}-current-status`)?.value || 'Submitted',
      disbursementAmount: disbAmt,
      paymentStatus: payStatus,
      nextFollowupDate: document.getElementById(`${prefix}-next-followup`)?.value || '',
      remarks: document.getElementById(`${prefix}-remarks`)?.value?.trim() || '',
      problems: selectedProblems,
      documents: [...(existing?.documents || []), ...newDocs]
    };

    try {
      const res = await saveAnnapurnaApp(data);
      if (!res?.success) {
        showToast(res?.message || 'Could not save Annapurna Application.', 'danger');
        return;
      }
      if (prefix === 'anp-inline') {
        window._anpInlineProbState = null;
        window._anpActiveTab = 'dashboard';
      } else {
        window._anpAppModalProbState = null;
        closeProblemQuickSubModal();
        closeModal();
      }
      showToast(res.isNew ? `Annapurna Application ${res.app.applicationId} saved!` : `Updated Application ${res.app.applicationId}`, 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Could not save Annapurna Application.', 'danger');
    }
  };

  MJK.confirmDeleteAnnapurnaApp = (appId) => {
    const app = getAnnapurnaAppById(appId);
    if (!app) return;
    showConfirmDialog(
      'Delete Annapurna Application?',
      `Are you sure you want to delete application "${app.applicationId}" for ${app.applicantName}? All linked problems and timeline entries will be deleted.`,
      () => {
        deleteAnnapurnaApp(appId);
        showToast('Annapurna Application deleted.', 'info');
        render();
      }
    );
  };

  /* --- Detail Dossier Modal (Independent Problems, Claims, Timeline, Audit) --- */
  MJK.openAnnapurnaDetailModal = (appId) => {
    const a = getAnnapurnaAppById(appId);
    if (!a) return;
    const statuses = getAllAppStatuses();
    const timelineDesc = [...(a.followupTimeline || [])].reverse();

    const content = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <!-- Header Summary -->
        <div style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.9rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <div style="font-family:monospace; font-weight:800; color:var(--blue-700); font-size:0.95rem;">${escapeHtml(a.applicationId)} <span style="color:var(--text-muted); font-size:0.75rem;">(Sys ID: ${escapeHtml(a.id)})</span></div>
              <h3 style="margin:0.15rem 0; font-size:1.15rem;">${escapeHtml(a.applicantName)}</h3>
              <div style="font-size:0.78rem; color:var(--text-muted);">
                Mobile: <strong>${escapeHtml(a.customerPhone || '-')}</strong> · HOF: <strong>${escapeHtml(a.headOfFamily || '-')}</strong> · App Date: <strong>${formatDate(a.applicationDate)}</strong>
              </div>
              <div style="font-size:0.77rem; color:var(--blue-700); font-weight:600; margin-top:0.2rem;">
                Ward No.: <strong>${escapeHtml(formatAppWardDisplay(a))}</strong> · Village / Locality / Para: <strong>${escapeHtml(a.village || '-')}</strong>
                ${a.blockOrMunicipality ? ` · ${escapeHtml(a.blockOrMunicipality)}` : ''}
                ${a.pinCode ? ` (${escapeHtml(a.pinCode)})` : ''}
              </div>
              <div style="font-size:0.76rem; color:var(--text-muted); margin-top:0.2rem;">
                Aadhaar / Govt ID Ref: <strong>${escapeHtml(a.aadhaarRef || '-')}</strong> · EPIC/Voter ID: <strong>${escapeHtml(a.voterIdEpic || '-')}</strong> · AC: <strong>${escapeHtml(a.assemblyConstituency || '-')}</strong> · Part: <strong>${escapeHtml(a.partNumber || '-')}</strong> · Serial: <strong>${escapeHtml(a.serialNumber || '-')}</strong>
              </div>
              <div style="font-size:0.76rem; color:var(--text-muted); margin-top:0.2rem;">
                Disbursement Amount: <strong class="tabular-nums" style="color:#065f46;">${formatINR(a.disbursementAmount || 0)}</strong> · Payment Status: <strong>${escapeHtml(a.paymentStatus || 'Pending')}</strong>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Current Application Status</div>
              <div style="margin:0.25rem 0;">${getAppStatusBadge(a.currentStatus)}</div>
              <button class="btn btn-secondary btn-sm" onclick="window.MJK.openUpdateAppStatusModal('${a.id}')">Update Status</button>
            </div>
          </div>
          ${a.remarks ? `<div style="margin-top:0.5rem; font-size:0.78rem; border-top:1px solid var(--border-subtle); padding-top:0.45rem;"><strong>Remarks:</strong> ${escapeHtml(a.remarks)}</div>` : ''}
        </div>

        <!-- Independent Problems List -->
        <div style="border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.85rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
            <strong style="font-size:0.9rem;">Tagged Application Problems (${(a.problems || []).length}) — Independent Status Tracking</strong>
            <button class="btn btn-primary btn-sm" onclick="window.MJK.openAddProblemModal('${a.id}')">+ Add Problem</button>
          </div>
          ${(a.problems || []).length === 0
            ? `<div style="font-size:0.8rem; color:var(--text-muted);">No problems tagged for this application.</div>`
            : `<div style="display:flex; flex-direction:column; gap:0.45rem;">
                ${(a.problems || []).map(p => `
                  <div style="padding:0.55rem 0.7rem; border:1px solid var(--border-subtle); border-radius:6px; background:var(--surface-alt); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                    <div>
                      <div style="font-weight:700; font-size:0.82rem;">[${escapeHtml(p.categoryKey)}] ${escapeHtml(p.title)}</div>
                      <div style="font-size:0.72rem; color:var(--text-muted);">${escapeHtml(p.categoryName)}${p.remarks ? ` · Note: ${escapeHtml(p.remarks)}` : ''}</div>
                    </div>
                    <select class="form-control" style="width:auto; height:30px; font-size:0.75rem;" onchange="window.MJK.changeIndividualProblemStatus('${a.id}', '${p.id}', this.value)">
                      ${PROBLEM_RESOLUTION_STATUSES.map(ps => `<option value="${ps}" ${p.problemStatus === ps ? 'selected' : ''}>${ps}</option>`).join('')}
                    </select>
                  </div>
                `).join('')}
              </div>`
          }
        </div>

        <!-- Claims & Complaints -->
        <div style="border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.85rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
            <strong style="font-size:0.9rem;">Claims & Grievance / Complaints (${(a.complaints || []).length})</strong>
            <button class="btn btn-primary btn-sm" onclick="window.MJK.openAppComplaintModal('${a.id}')">+ Add Claim / Complaint</button>
          </div>
          ${(a.complaints || []).length === 0
            ? `<div style="font-size:0.8rem; color:var(--text-muted);">No claims or complaints submitted yet.</div>`
            : `<div style="display:flex; flex-direction:column; gap:0.45rem;">
                ${(a.complaints || []).map(cmp => `
                  <div style="padding:0.6rem; border:1px solid var(--border-subtle); border-radius:6px; background:var(--surface-alt); display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
                    <div>
                      <div style="font-weight:700; font-size:0.82rem;">${escapeHtml(cmp.complaintType)}${cmp.referenceNumber ? ` — <span style="font-family:monospace;">${escapeHtml(cmp.referenceNumber)}</span>` : ''}</div>
                      <div style="font-size:0.74rem; color:var(--text-muted);">Date: ${formatDate(cmp.submissionDate)}${cmp.submittedTo ? ` · Submitted To: ${escapeHtml(cmp.submittedTo)}` : ''}</div>
                      ${cmp.actionTaken ? `<div style="font-size:0.75rem; margin-top:0.2rem;">Action: ${escapeHtml(cmp.actionTaken)}</div>` : ''}
                      ${cmp.replyDetails ? `<div style="font-size:0.75rem; color:#15803d;">Reply: ${escapeHtml(cmp.replyDetails)}</div>` : ''}
                    </div>
                    <div style="text-align:right;">
                      ${getAppStatusBadge(cmp.status)}
                      <div style="margin-top:0.3rem;"><button class="btn btn-secondary btn-sm" style="font-size:0.7rem;" onclick="window.MJK.openAppComplaintModal('${a.id}', '${cmp.id}')">Update</button></div>
                    </div>
                  </div>
                `).join('')}
              </div>`
          }
        </div>

        <!-- Attached Supporting Documents -->
        <div style="border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.85rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
            <strong style="font-size:0.9rem;">Supporting Documents (${(a.documents || []).length})</strong>
            <button class="btn btn-primary btn-sm" onclick="window.MJK.openAddDocumentsModal('${a.id}')">+ Add Documents</button>
          </div>
          ${(a.documents || []).length === 0
            ? `<div style="font-size:0.8rem; color:var(--text-muted);">No documents uploaded yet.</div>`
            : `<div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
                ${(a.documents || []).map(doc => `
                  <div style="padding:0.35rem 0.6rem; border:1px solid var(--border-subtle); border-radius:4px; background:var(--surface-alt); font-size:0.76rem;">
                    <strong>📎 ${escapeHtml(doc.name || doc)}</strong>
                    ${doc.category ? `<span style="color:var(--text-muted);"> (${escapeHtml(doc.category)})</span>` : ''}
                  </div>
                `).join('')}
              </div>`
          }
        </div>

        <!-- Non-Overwriting Chronological Follow-up Timeline -->
        <div style="border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.85rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
            <strong style="font-size:0.9rem;">Chronological Follow-up Timeline (${timelineDesc.length} entries — Non-Overwriting)</strong>
            <button class="btn btn-primary btn-sm" onclick="window.MJK.openAppFollowupModal('${a.id}')">+ Log Follow-up</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.45rem; max-height:240px; overflow-y:auto;">
            ${timelineDesc.map(tl => `
              <div style="padding:0.55rem 0.7rem; border-left:3px solid var(--blue-600); background:var(--surface-alt); border-radius:4px; font-size:0.78rem;">
                <div style="display:flex; justify-content:space-between;">
                  <strong>${escapeHtml(tl.activity)}</strong>
                  <span style="color:var(--text-muted); font-size:0.72rem;">${formatDate(tl.date)} · ${escapeHtml(tl.recordedBy || 'Staff')}</span>
                </div>
                <div style="font-size:0.74rem; color:var(--text-muted); margin-top:0.15rem;">
                  Status: ${escapeHtml(tl.previousStatus)} → <strong>${escapeHtml(tl.updatedStatus)}</strong>
                  ${tl.nextFollowupDate ? ` · Next Target: <strong>${formatDate(tl.nextFollowupDate)}</strong>` : ''}
                </div>
                <div style="margin-top:0.2rem;">${escapeHtml(tl.actionTaken || '')} ${tl.remarks ? `— ${escapeHtml(tl.remarks)}` : ''}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    openModal(`Annapurna Case Dossier: ${a.applicationId}`, content, `
      <button class="btn btn-outline" onclick="window.MJK.printAnnapurnaSlip('${a.id}')">🖨 Print Slip</button>
      <button class="btn btn-secondary" onclick="window.MJK.closeModal()">Close</button>
    `, 'modal-lg');
  };

  MJK.changeIndividualProblemStatus = async (appId, problemId, newStatus) => {
    try {
      const res = await updateIndividualProblemStatus(appId, problemId, newStatus, 'Updated directly in dossier');
      if (res.success) {
        showToast(`Problem status updated to "${newStatus}" (Application Status & other problems preserved).`, 'success');
        MJK.openAnnapurnaDetailModal(appId);
        render();
      }
    } catch (err) {
      showToast(err?.message || 'Failed to update problem status.', 'danger');
    }
  };

  /* --- Update Application Status Only Modal --- */
  MJK.openUpdateAppStatusModal = (appId) => {
    const app = getAnnapurnaAppById(appId);
    if (!app) return;
    const statuses = getAllAppStatuses();
    const content = `
      <form onsubmit="window.MJK.handleUpdateAppStatusOnly(event, '${app.id}')">
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.8rem;">
          Updating Current Application Status for <strong>${escapeHtml(app.applicantName)}</strong> (${escapeHtml(app.applicationId)}). Tagged Problems remain completely unchanged.
        </div>
        <div class="form-group">
          <label class="form-label">New Current Application Status <span class="req">*</span></label>
          <select id="upd-app-status" class="form-control" required>
            ${statuses.map(st => `<option value="${escapeHtml(st)}" ${app.currentStatus === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Next Follow-up Date</label>
          <input type="date" id="upd-app-next-date" class="form-control" value="${escapeHtml(app.nextFollowupDate || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Remarks</label>
          <textarea id="upd-app-remarks" class="form-control" rows="2" placeholder="Reason for status change..."></textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Status Change</button>
        </div>
      </form>
    `;
    openModal(`Update Application Status — ${app.applicationId}`, content, null);
  };

  MJK.handleUpdateAppStatusOnly = async (e, appId) => {
    e.preventDefault();
    const st = document.getElementById('upd-app-status')?.value;
    const nextDate = document.getElementById('upd-app-next-date')?.value || '';
    const remarks = document.getElementById('upd-app-remarks')?.value?.trim() || '';
    try {
      await updateAppStatusOnly(appId, st, remarks, nextDate);
      closeModal();
      showToast(`Application Status updated to "${st}"`, 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to update application status.', 'danger');
    }
  };

  /* --- Add Problem Modal --- */
  MJK.openAddProblemModal = (appId) => {
    const app = getAnnapurnaAppById(appId);
    if (!app) return;
    const categories = getAllProblemCategoriesWithCustom();
    const content = `
      <form onsubmit="window.MJK.handleAddProblemToApp(event, '${app.id}')">
        <div class="form-group">
          <label class="form-label">Problem Category (A-I)</label>
          <select id="add-prob-cat" class="form-control" onchange="window.MJK.populateCategoryProblemsDropdown(this.value)">
            ${categories.map(c => `<option value="${escapeHtml(c.key)}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Select Standard / Saved Problem</label>
          <select id="add-prob-select" class="form-control">
            ${(categories[0]?.items || []).length > 0
              ? categories[0].items.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')
              : '<option value="">-- No preset problems in this category --</option>'}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Or Enter New Custom Problem Title (Optional)</label>
          <input type="text" id="add-prob-custom" class="form-control" placeholder="Leave empty to use selected problem above">
          <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; margin-top:0.3rem;">
            <input type="checkbox" id="add-prob-save-master" checked> Save custom problem to Master for future reuse
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">Remarks / Details</label>
          <textarea id="add-prob-remarks" class="form-control" rows="2"></textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.openAnnapurnaDetailModal('${app.id}')">Back</button>
          <button type="submit" class="btn btn-primary">Add Problem</button>
        </div>
      </form>
    `;
    openModal(`Add Problem to ${app.applicationId}`, content, null);
  };

  MJK.populateCategoryProblemsDropdown = (catKey) => {
    const categories = getAllProblemCategoriesWithCustom();
    const cat = categories.find(c => c.key === catKey);
    const sel = document.getElementById('add-prob-select');
    if (sel && cat) {
      sel.innerHTML = (cat.items || []).length > 0
        ? cat.items.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')
        : '<option value="">-- No preset problems in this category --</option>';
    }
  };

  MJK.handleAddProblemToApp = async (e, appId) => {
    e.preventDefault();
    const categories = getAllProblemCategoriesWithCustom();
    const catKey = document.getElementById('add-prob-cat')?.value || 'H';
    const cat = categories.find(c => c.key === catKey);
    const customTitle = document.getElementById('add-prob-custom')?.value?.trim();
    const selTitle = document.getElementById('add-prob-select')?.value;
    const title = customTitle || selTitle;
    const saveMaster = document.getElementById('add-prob-save-master')?.checked;
    const remarks = document.getElementById('add-prob-remarks')?.value?.trim() || '';

    try {
      if (customTitle && saveMaster) {
        const saveRes = await saveCustomProblem({ title: customTitle, categoryKey: catKey, categoryName: cat?.name || catKey, remarks });
        if (saveRes && !saveRes.success) {
          showToast(saveRes.message, 'warning');
        }
      }

      if (!title) {
        showToast('Please select or enter a problem title.', 'warning');
        return;
      }

      const res = await addProblemToApp(appId, { categoryKey: catKey, categoryName: cat?.name || catKey, title, remarks });
      if (!res.success) {
        showToast(res.message, 'warning');
        return;
      }
      showToast(`Added problem "${title}"`, 'success');
      MJK.openAnnapurnaDetailModal(appId);
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to add problem.', 'danger');
    }
  };

  /* --- Quick Add Documents Modal --- */
  MJK.openAddDocumentsModal = (appId) => {
    const app = getAnnapurnaAppById(appId);
    if (!app) return;
    const docTypes = getActiveConfigItems('documentMasters');
    const content = `
      <form onsubmit="window.MJK.handleSaveAppDocuments(event, '${app.id}')">
        <div style="background:var(--surface-alt); padding:0.65rem 0.85rem; border-radius:6px; margin-bottom:0.85rem; font-size:0.8rem;">
          <strong>${escapeHtml(app.applicantName)}</strong> (${escapeHtml(app.applicationId)}) · Existing Documents: <strong>${(app.documents || []).length}</strong>
        </div>
        <div class="form-group">
          <label class="form-label">Document Category</label>
          <select id="anp-adddoc-type" class="form-control">
            ${docTypes.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
            <option value="Other Supporting Document">Other Supporting Document</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Upload Files / Screenshots <span class="req">*</span></label>
          <input type="file" id="anp-adddoc-files" class="form-control" multiple>
        </div>
        <div class="form-group">
          <label class="form-label">Document Remarks</label>
          <textarea id="anp-adddoc-remarks" class="form-control" rows="2" placeholder="Note about uploaded document or camp submission..."></textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Attach & Log Document</button>
        </div>
      </form>
    `;
    openModal(`Add Documents — ${app.applicationId}`, content, null);
  };

  MJK.handleSaveAppDocuments = async (e, appId) => {
    e.preventDefault();
    const docType = document.getElementById('anp-adddoc-type')?.value || 'Supporting Document';
    const fileInput = document.getElementById('anp-adddoc-files');
    const remarks = document.getElementById('anp-adddoc-remarks')?.value?.trim() || '';
    const docs = fileInput?.files?.length
      ? Array.from(fileInput.files).map(f => ({ name: f.name, size: f.size, type: f.type, docType, uploadedAt: new Date().toISOString() }))
      : [];
    try {
      const res = await addDocumentsToApp(appId, docs, docType, remarks);
      if (!res.success) {
        showToast(res.message, 'warning');
        return;
      }
      closeModal();
      showToast(`Attached ${res.addedCount} document(s) & logged to timeline.`, 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to attach documents.', 'danger');
    }
  };

  /* --- Claim & Complaint Modal --- */
  MJK.openAppComplaintModal = (appId = null, editComplaintId = null) => {
    const allApps = getAllAnnapurnaApps();
    const app = appId ? getAnnapurnaAppById(appId) : (allApps[0] || null);
    if (!app) {
      showToast('Please register an Annapurna Application first.', 'warning');
      return;
    }
    const existingCmp = editComplaintId ? (app.complaints || []).find(c => c.id === editComplaintId) : null;
    const complaintTypes = getAllComplaintTypes();

    const content = `
      <form onsubmit="window.MJK.handleSaveAppComplaint(event, '${appId ? app.id : ''}', '${editComplaintId || ''}')">
        ${!appId && allApps.length > 0 ? `
          <div class="form-group">
            <label class="form-label">Select Annapurna Application <span class="req">*</span></label>
            <select id="cmp-app-id" class="form-control" required>
              ${allApps.map(a => `<option value="${a.id}" ${a.id === app.id ? 'selected' : ''}>${escapeHtml(a.applicantName)} — ${escapeHtml(a.applicationId)} (${escapeHtml(a.currentStatus)})</option>`).join('')}
            </select>
          </div>
        ` : `<input type="hidden" id="cmp-app-id" value="${app.id}">`}
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Complaint / Claim Category <span class="req">*</span></label>
            <select id="cmp-type" class="form-control" required>
              ${complaintTypes.map(ct => `<option value="${escapeHtml(ct)}" ${(existingCmp?.complaintType || complaintTypes[0]) === ct ? 'selected' : ''}>${escapeHtml(ct)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Submission Date <span class="req">*</span></label>
            <input type="date" id="cmp-date" class="form-control" required value="${escapeHtml(existingCmp?.submissionDate || getTodayDate())}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Current Complaint Status</label>
            <select id="cmp-status" class="form-control">
              ${COMPLAINT_STATUSES.map(cs => `<option value="${cs}" ${(existingCmp?.status || 'Submitted') === cs ? 'selected' : ''}>${cs}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Next Follow-up Date</label>
            <input type="date" id="cmp-next-date" class="form-control" value="${escapeHtml(existingCmp?.nextFollowupDate || '')}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Complaint Description</label>
          <textarea id="cmp-desc" class="form-control" rows="2">${escapeHtml(existingCmp?.description || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Action Taken</label>
            <textarea id="cmp-action" class="form-control" rows="2">${escapeHtml(existingCmp?.actionTaken || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Response / Reply Details</label>
            <textarea id="cmp-reply" class="form-control" rows="2">${escapeHtml(existingCmp?.replyDetails || '')}</textarea>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Supporting Documents / Screenshots</label>
          <input type="file" id="cmp-files" class="form-control" multiple>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${existingCmp ? 'Update Complaint' : 'Submit Claim / Complaint'}</button>
        </div>
      </form>
    `;
    openModal(existingCmp ? `Update Claim / Complaint (${existingCmp.complaintType})` : `Add Claim / Complaint${appId ? ` — ${app.applicationId}` : ''}`, content, null, 'modal-lg');
  };

  MJK.handleSaveAppComplaint = async (e, appId, editComplaintId) => {
    e.preventDefault();
    const targetAppId = appId || document.getElementById('cmp-app-id')?.value;
    if (!targetAppId) {
      showToast('Select an application first.', 'warning');
      return;
    }
    const fileInput = document.getElementById('cmp-files');
    const attachments = fileInput?.files?.length
      ? Array.from(fileInput.files).map(f => ({ name: f.name, size: f.size, uploadedAt: new Date().toISOString() }))
      : [];

    const payload = {
      complaintType: document.getElementById('cmp-type')?.value,
      submissionDate: document.getElementById('cmp-date')?.value,
      status: document.getElementById('cmp-status')?.value,
      nextFollowupDate: document.getElementById('cmp-next-date')?.value || '',
      description: document.getElementById('cmp-desc')?.value?.trim() || '',
      actionTaken: document.getElementById('cmp-action')?.value?.trim() || '',
      replyDetails: document.getElementById('cmp-reply')?.value?.trim() || '',
      attachments
    };

    try {
      if (editComplaintId) {
        await updateComplaintInApp(targetAppId, editComplaintId, payload);
        showToast('Complaint updated & logged to timeline.', 'success');
      } else {
        await addComplaintToApp(targetAppId, payload);
        showToast('Claim / Complaint added & logged to timeline.', 'success');
      }
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save complaint.', 'danger');
    }
  };

  /* --- Chronological Follow-up Timeline Modal --- */
  MJK.openAppFollowupModal = (appId = null) => {
    const allApps = getAllAnnapurnaApps();
    const app = appId ? getAnnapurnaAppById(appId) : (allApps[0] || null);
    if (!app) {
      showToast('Please register an Annapurna Application first.', 'warning');
      return;
    }
    const statuses = getAllAppStatuses();
    const followupTypes = getActiveConfigItems('followupTypes');
    const offices = getActiveConfigItems('officeMasters');
    const quickRemarks = getActiveConfigItems('customRemarks');

    const content = `
      <form onsubmit="window.MJK.handleSaveAppFollowup(event, '${appId ? app.id : ''}')">
        ${!appId ? `
          <div class="form-group">
            <label class="form-label">Select Annapurna Application <span class="req">*</span></label>
            <select id="tl-app-id" class="form-control" required>
              ${allApps.map(a => `<option value="${a.id}" ${a.id === app.id ? 'selected' : ''}>${escapeHtml(a.applicantName)} — ${escapeHtml(a.applicationId)} (${escapeHtml(a.currentStatus)})</option>`).join('')}
            </select>
          </div>
        ` : `
          <input type="hidden" id="tl-app-id" value="${app.id}">
          <div style="background:var(--surface-alt); padding:0.65rem 0.85rem; border-radius:6px; margin-bottom:0.85rem; font-size:0.8rem;">
            <strong>${escapeHtml(app.applicantName)}</strong> (${escapeHtml(app.applicationId)}) · Current Status: <strong>${escapeHtml(app.currentStatus)}</strong>
            <div style="font-size:0.72rem; color:var(--text-muted);">Non-overwriting timeline: all previous entries remain intact.</div>
          </div>
        `}
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Follow-up Date <span class="req">*</span></label>
            <input type="date" id="tl-date" class="form-control" required value="${getTodayDate()}">
          </div>
          <div class="form-group">
            <label class="form-label">Activity <span class="req">*</span></label>
            <input type="text" id="tl-activity" class="form-control" required placeholder="e.g. BDO Visit / Janakalyan Camp / RTI Reply Check">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Follow-up Type</label>
            <select id="tl-fu-type" class="form-control">
              ${followupTypes.map(ft => `<option value="${escapeHtml(ft)}">${escapeHtml(ft)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Office / Camp (Optional)</label>
            <select id="tl-office" class="form-control">
              <option value="">-- Optional Office / Camp --</option>
              ${offices.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Updated Status</label>
            <select id="tl-updated-status" class="form-control">
              ${statuses.map(st => `<option value="${escapeHtml(st)}" ${app.currentStatus === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Next Follow-up Target Date</label>
            <input type="date" id="tl-next-date" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Action Taken <span class="req">*</span></label>
          <input type="text" id="tl-action" class="form-control" required placeholder="Summary of action performed today...">
        </div>
        <div class="form-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
            <label class="form-label" style="margin:0;">Remarks / Department Reply</label>
            ${quickRemarks.length > 0 ? `
              <select class="form-control" style="width:auto; height:28px; font-size:0.74rem;" onchange="if(this.value){ const r=document.getElementById('tl-remarks'); if(r) r.value = r.value ? r.value + ' · ' + this.value : this.value; this.value=''; }">
                <option value="">+ Insert Saved Remark</option>
                ${quickRemarks.map(qr => `<option value="${escapeHtml(qr)}">${escapeHtml(qr)}</option>`).join('')}
              </select>
            ` : ''}
          </div>
          <textarea id="tl-remarks" class="form-control" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Attach Document / Screenshot</label>
          <input type="file" id="tl-files" class="form-control" multiple>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Append Timeline Entry</button>
        </div>
      </form>
    `;
    openModal(`Log Timeline Activity${appId ? ` — ${app.applicationId}` : ''}`, content, null);
  };

  MJK.handleSaveAppFollowup = async (e, appId) => {
    e.preventDefault();
    const targetAppId = appId || document.getElementById('tl-app-id')?.value;
    if (!targetAppId) return;
    const files = document.getElementById('tl-files')?.files;
    const attachments = files?.length
      ? Array.from(files).map(f => ({ name: f.name, size: f.size, uploadedAt: new Date().toISOString() }))
      : [];

    try {
      await addFollowupEntry(targetAppId, {
        date: document.getElementById('tl-date')?.value,
        activity: document.getElementById('tl-activity')?.value?.trim(),
        followupType: document.getElementById('tl-fu-type')?.value || '',
        office: document.getElementById('tl-office')?.value || '',
        updatedStatus: document.getElementById('tl-updated-status')?.value,
        nextFollowupDate: document.getElementById('tl-next-date')?.value || '',
        actionTaken: document.getElementById('tl-action')?.value?.trim(),
        remarks: document.getElementById('tl-remarks')?.value?.trim() || '',
        attachments
      });

      closeModal();
      showToast('Chronological follow-up entry appended!', 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to append follow-up entry.', 'danger');
    }
  };

  /* --- Custom Problem Master CRUD --- */
  MJK.openCustomProblemModal = (editId = null) => {
    const existing = editId ? getCustomProblems().find(p => p.id === editId) : null;
    const allCats = getAllProblemCategoriesWithCustom();
    const content = `
      <form onsubmit="window.MJK.handleSaveCustomProblemMaster(event, '${editId || ''}')">
        <div class="form-group">
          <label class="form-label">Problem Title <span class="req">*</span></label>
          <input type="text" id="cp-title" class="form-control" required value="${escapeHtml(existing?.title || '')}" placeholder="Enter custom problem title">
        </div>
        <div class="form-group">
          <label class="form-label">Problem Category</label>
          <select id="cp-category" class="form-control">
            ${allCats.map(c => `<option value="${escapeHtml(c.key)}" ${(existing?.categoryKey || 'H') === c.key ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="cp-desc" class="form-control" rows="2">${escapeHtml(existing?.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Default Remarks</label>
          <input type="text" id="cp-remarks" class="form-control" value="${escapeHtml(existing?.remarks || '')}">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Rename / Update Problem' : 'Save Problem to Master'}</button>
        </div>
      </form>
    `;
    openModal(existing ? 'Edit / Rename Custom Problem' : 'Add Custom Problem to Master', content, null);
  };

  MJK.handleSaveCustomProblemMaster = async (e, editId) => {
    e.preventDefault();
    const catKey = document.getElementById('cp-category')?.value || 'H';
    const cat = getAllProblemCategoriesWithCustom().find(c => c.key === catKey);
    try {
      const res = await saveCustomProblem({
        id: editId || undefined,
        title: document.getElementById('cp-title')?.value?.trim(),
        categoryKey: catKey,
        categoryName: cat?.name || 'H. Other Customer Problems',
        description: document.getElementById('cp-desc')?.value?.trim() || '',
        remarks: document.getElementById('cp-remarks')?.value?.trim() || ''
      });
      if (res && !res.success) {
        showToast(res.message || 'Unable to save custom problem.', 'warning');
        return;
      }
      closeModal();
      showToast('Custom problem master updated!', 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save custom problem.', 'danger');
    }
  };

  MJK.deleteCustomProblemMaster = (id) => {
    showConfirmDialog(
      'Remove Custom Problem from Master?',
      'This removes the problem from the selection master only. Existing historical Annapurna applications that used this problem will NOT be changed.',
      () => {
        deleteCustomProblemFromMaster(id);
        showToast('Removed from master (old historical records preserved).', 'info');
        render();
      }
    );
  };

  MJK.handleAddCustomStatus = async (e) => {
    e.preventDefault();
    const inp = document.getElementById('new-custom-status-input');
    try {
      const res = await addCustomStatus(inp?.value);
      if (!res.success) {
        showToast(res.message, 'warning');
        return;
      }
      showToast('Custom status added!', 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to add custom status.', 'danger');
    }
  };

  MJK.removeCustomStatus = (label) => {
    deleteCustomStatus(label);
    render();
  };

  MJK.handleAddMasterCustomService = (e) => {
    e.preventDefault();
    const inp = document.getElementById('new-master-service-input');
    const res = addCustomCustomerService(inp?.value);
    if (!res.success) {
      showToast(res.message, 'warning');
      return;
    }
    showToast('Saved custom service for future customer registrations.', 'success');
    render();
  };

  MJK.removeMasterCustomService = (name) => {
    deleteCustomCustomerService(name);
    render();
  };

  MJK.handleAddConfigEntry = (e, field, inputId) => {
    e.preventDefault();
    const inp = document.getElementById(inputId);
    const res = addConfigItem(field, inp?.value);
    if (!res.success) {
      showToast(res.message, 'warning');
      return;
    }
    showToast('Dynamic configuration updated!', 'success');
    render();
  };

  MJK.openRenameConfigModal = (field, oldValue) => {
    const content = `
      <form data-field="${escapeHtml(field)}" data-old-val="${escapeHtml(oldValue)}" onsubmit="window.MJK.handleRenameConfigEntry(event, this.dataset.field, this.dataset.oldVal)">
        <div class="form-group">
          <label class="form-label">Rename / Edit Entry <span class="req">*</span></label>
          <input type="text" id="cfg-rename-input" class="form-control" required value="${escapeHtml(oldValue)}">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    `;
    openModal('Edit Master Entry', content, null);
  };

  MJK.handleRenameConfigEntry = (e, field, oldValue) => {
    e.preventDefault();
    const nextValue = document.getElementById('cfg-rename-input')?.value?.trim();
    const res = renameConfigItem(field, oldValue, nextValue);
    if (!res.success) {
      showToast(res.message || 'Unable to rename entry.', 'warning');
      return;
    }
    closeModal();
    showToast(`Updated "${oldValue}" → "${nextValue}"`, 'success');
    render();
  };

  MJK.toggleConfigActive = (field, value) => {
    const res = toggleConfigItemActive(field, value);
    showToast(`${value}: ${res.active ? 'Active' : 'Inactive'}`, 'info');
    render();
  };

  MJK.removeConfigEntry = (field, value) => {
    deleteConfigItem(field, value);
    render();
  };

  /* --- Print Annapurna Acknowledgement Slip (Iframe-Safe) --- */
  MJK.printAnnapurnaSlip = (appId) => {
    const a = getAnnapurnaAppById(appId);
    if (!a) return;
    const html = `
      <div class="mun-bw-doc" style="padding:10px;">
        ${renderBwDocumentHeader({
          docTitle: 'ANNAPURNA YOJANA APPLICATION SLIP',
          docNumber: a.applicationId,
          docDateTime: formatDate(a.applicationDate),
          statusText: a.currentStatus || 'REGISTERED',
          extraRightLines: ['Annapurna Yojana — Claim, Problem & Follow-up Desk']
        })}
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px; margin-bottom:14px;">
          <div><strong>Applicant:</strong> ${escapeHtml(a.applicantName)}</div>
          <div><strong>Mobile:</strong> ${escapeHtml(a.customerPhone || '-')}</div>
          <div><strong>Head of Family:</strong> ${escapeHtml(a.headOfFamily || '-')}</div>
          <div><strong>Voter ID / EPIC:</strong> ${escapeHtml(a.voterIdEpic || '-')}</div>
          <div><strong>Ward No.:</strong> ${escapeHtml(formatAppWardDisplay(a))}</div>
          <div><strong>Village / Locality / Para:</strong> ${escapeHtml(a.village || '-')}</div>
          <div><strong>AC / Part / Serial:</strong> ${escapeHtml(a.assemblyConstituency || '-')} / ${escapeHtml(a.partNumber || '-')} / ${escapeHtml(a.serialNumber || '-')}</div>
          <div><strong>Current Status:</strong> ${escapeHtml(a.currentStatus)}</div>
        </div>
        <div style="margin-bottom:12px; font-size:12px;">
          <strong>Tagged Problems:</strong>
          ${(a.problems || []).length === 0 ? 'None' : (a.problems || []).map(p => `<div style="margin-top:3px;">• [${escapeHtml(p.categoryKey)}] ${escapeHtml(p.title)} (${escapeHtml(p.problemStatus)})</div>`).join('')}
        </div>
        <div style="margin-bottom:12px; font-size:12px;">
          <strong>Claims & Complaints (${(a.complaints || []).length}):</strong>
          ${(a.complaints || []).length === 0 ? 'None' : (a.complaints || []).map(c => `<div style="margin-top:3px;">• ${escapeHtml(c.complaintType)}${c.referenceNumber ? ` — Ref: ${escapeHtml(c.referenceNumber)}` : ''} (${escapeHtml(c.status)})</div>`).join('')}
        </div>
        <div style="margin-top:34px; display:flex; justify-content:space-between; font-size:12px;">
          <div style="border-top:1px solid #94a3b8; width:190px; text-align:center; padding-top:5px;">Applicant Signature</div>
          <div style="border-top:1px solid #94a3b8; width:190px; text-align:center; padding-top:5px;">Authorized Seal — MUN COMPUTER</div>
        </div>
      </div>
    `;
    showInAppPrintModal(`Annapurna Slip - ${a.applicationId}`, html);
  };
}
