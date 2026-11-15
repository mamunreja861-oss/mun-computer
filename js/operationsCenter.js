/**
 * operationsCenter.js - Complete 9-Module Operations Suite for MUN COMPUTER ERP
 * 1. Counter Day Book            (counter-daybook)
 * 2. Daily Opening Cash          (daily-opening-cash)
 * 3. Daily Closing Cash          (daily-closing-cash)
 * 4. Staff Attendance            (staff-attendance)
 * 5. Time Management Register    (time-register)
 * 6. GPS Location Attendance     (gps-attendance)
 * 7. Staff Photo & Location Map  (staff-location-map)
 * 8. Attendance Reports          (attendance-reports)
 * 9. Cash Reports                (cash-reports)
 */

import {
  KEYS,
  getItem,
  formatINR,
  numberToWords,
  syncAmountWords,
  formatDate,
  getTodayDate
} from './storage.js';
import { getCurrentUser, isSuperAdmin, canMenu, canExtra, getCashOperationLimit } from './auth.js';
import {
  COUNTER_TXN_TYPES,
  DENOMINATION_SPEC,
  normalizeDenominations,
  calculateDenominationTotal,
  getAllDaybookEntries,
  getAllCounterCashTxns,
  addCounterCashTxn,
  deleteCounterCashTxn,
  calculateDayTally,
  buildCounterLedgerRows,
  saveOpeningCashEntry,
  saveDaybookEntry,
  syncDaybookFromServer,
  syncAddCounterCashTxnToServer,
  syncDeleteCounterCashTxnToServer,
  syncDaybookSnapshotToServer
} from './daybook.js';
import {
  getShiftConfig,
  saveShiftConfig,
  getAllAttendance,
  recordAttendance,
  deleteAttendanceRecord,
  getAllGpsAttendanceLogs,
  saveGpsAttendancePunch,
  deleteGpsAttendanceLog,
  getMonthlyAttendanceReport,
  formatMinutesAsDuration,
  to24HourTime,
  getAttendancePhotoImageUrl,
  syncAttendanceRecordsFromServer,
  syncAttendanceRecordToServer,
  fetchAttendancePhotosFromServer,
  saveAttendancePhotoToServer,
  verifyAttendancePhotoOnServer,
  deleteAttendancePhotoOnServer
} from './payroll.js';
import { getAllPayments } from './payments.js';
import { getAllExpenses } from './expenses.js';
import { downloadCSV, downloadExcelSheet, exportTablePDF } from './reports.js';
import { showA4PrintPdfPopup } from './a4PrintPopup.js';
import {
  renderBwDocumentHeader,
  renderAcknowledgementSection,
  drawBwPdfHeader,
  getBwAutoTableStyles,
  finalizeBwPdfPagination
} from './documentEngine.js';
import {
  generateReportId,
  exportUniversalCSV,
  exportUniversalExcel,
  exportUniversalPDF,
  printUniversalReport,
  buildSumTotalsRow
} from './exportUtility.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const OpsState = {
  daybookDate: getTodayDate(),
  daybookSearchQuery: '',
  openingDate: getTodayDate(),
  closingDate: getTodayDate(),
  attDateFilter: getTodayDate(),
  attMonthFilter: getTodayDate().slice(0, 7),
  attStaffFilter: 'all',
  timeRegDate: getTodayDate(),
  timeRegMonth: getTodayDate().slice(0, 7),
  cashReportFrom: `${getTodayDate().slice(0, 7)}-01`,
  cashReportTo: getTodayDate(),
  cashReportQuery: '',
  cashReportDenomDate: getTodayDate(),
  attReportMonth: getTodayDate().slice(0, 7),
  attReportStaff: 'all',
  mapFilterDate: '',
  mapFilterStaff: 'all',
  mapFilterEvent: 'ALL',
  selectedGpsLogId: '',
  photoDateFilter: '',
  photoFromDate: '',
  photoToDate: '',
  photoStaffFilter: 'all',
  photoEventFilter: 'ALL',
  photoVerifyFilter: 'ALL',
  photoSearchQuery: '',
  hydratedDaybook: false,
  hydratedAttendance: false,
  hydratedPhotos: false,
  gpsDraft: {
    staffId: '',
    eventType: 'IN',
    latitude: null,
    longitude: null,
    accuracy: 0,
    capturedAt: '',
    gpsCapturedAtMs: 0,
    gpsCapturedIso: '',
    photoDataUrl: '',
    photoCaptureMethod: '',
    photoCapturedAtMs: 0,
    photoCapturedIso: '',
    cameraActive: false,
    submitting: false,
    consentAccepted: false,
    notes: ''
  }
};

let activeMediaStream = null;

function hasLiveMediaStream() {
  if (!activeMediaStream) return false;
  try {
    const tracks = activeMediaStream.getVideoTracks();
    return tracks.some(t => t.readyState === 'live' && t.enabled);
  } catch {
    return false;
  }
}

function reattachActiveCameraStream() {
  if (!hasLiveMediaStream()) return;
  const vid = document.getElementById('gps-camera-video');
  const placeholder = document.getElementById('gps-camera-placeholder');
  if (vid) {
    if (vid.srcObject !== activeMediaStream) {
      vid.srcObject = activeMediaStream;
    }
    vid.play().catch(() => {});
  }
  if (placeholder) placeholder.style.display = 'none';
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getLivePositionPromise(options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function stopActiveAttendanceCamera() {
  if (activeMediaStream) {
    try {
      activeMediaStream.getTracks().forEach(track => track.stop());
    } catch {
      // ignore track cleanup errors
    }
    activeMediaStream = null;
  }
  OpsState.gpsDraft.cameraActive = false;
  const vid = document.getElementById('gps-camera-video');
  if (vid && vid.srcObject) {
    vid.srcObject = null;
  }
  const placeholder = document.getElementById('gps-camera-placeholder');
  if (placeholder) placeholder.style.display = '';
}

function getActiveStaffList() {
  const users = getItem(KEYS.USERS, []);
  const active = users.filter(u => u.status === 'ACTIVE' || u.active !== false);
  return active.length > 0 ? active : users;
}

function canViewAllAttendanceScope(user = getCurrentUser()) {
  if (!user) return false;
  if (isSuperAdmin(user) || user.role === 'ADMIN' || user.role === 'MANAGER') return true;
  return false;
}

function canViewAllPhotosScope(user = getCurrentUser()) {
  if (!user) return false;
  if (isSuperAdmin(user) || user.role === 'ADMIN') return true;
  if (user.role === 'MANAGER') return Boolean(canExtra('canViewAllAttendancePhotos', user));
  return false;
}

function ensureOpsHydration(kind, rerenderFn) {
  if (kind === 'daybook' && !OpsState.hydratedDaybook) {
    OpsState.hydratedDaybook = true;
    syncDaybookFromServer().then(res => { if (res && rerenderFn) rerenderFn(); });
  } else if (kind === 'attendance' && !OpsState.hydratedAttendance) {
    OpsState.hydratedAttendance = true;
    syncAttendanceRecordsFromServer().then(() => { if (rerenderFn) rerenderFn(); });
  } else if (kind === 'photos' && !OpsState.hydratedPhotos) {
    OpsState.hydratedPhotos = true;
    fetchAttendancePhotosFromServer().then(() => { if (rerenderFn) rerenderFn(); });
  }
}

function getCombinedAttendancePhotos() {
  const user = getCurrentUser();
  const canAll = canViewAllPhotosScope(user);
  const myUid = user?.uid || user?.id || '';
  const serverPhotos = Array.isArray(window._munServerAttendancePhotos) ? window._munServerAttendancePhotos : [];
  const localPhotos = getAllGpsAttendanceLogs();
  const map = new Map();
  serverPhotos.forEach(p => { if (p && p.id) map.set(p.id, { ...p, fromServer: true }); });
  localPhotos.forEach(p => { if (p && p.id && !map.has(p.id)) map.set(p.id, p); });
  let list = Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (!canAll && myUid) {
    list = list.filter(p => p.staffId === myUid);
  }
  return list;
}

function getCombinedCashRowsForDateRange(fromDate, toDate, query = '') {
  const q = String(query || '').trim().toLowerCase();
  const rows = [];

  getAllPayments().forEach(p => {
    if ((p.paymentMethod === 'Cash' || !p.paymentMethod) && p.paymentDate >= fromDate && p.paymentDate <= toDate) {
      rows.push({
        id: p.id,
        date: p.paymentDate,
        time: '-',
        type: 'CASH_RECEIVED',
        typeLabel: 'Cash Received (Service)',
        partyName: p.customerName || 'Customer',
        amount: Number(p.paymentAmount) || 0,
        reference: p.transactionId || p.serviceId || '',
        notes: p.remarks || 'Service Payment',
        source: 'PAYMENT'
      });
    }
  });

  getAllExpenses().forEach(e => {
    if ((e.paymentMethod === 'Cash' || !e.paymentMethod) && e.date >= fromDate && e.date <= toDate) {
      rows.push({
        id: e.id,
        date: e.date,
        time: '-',
        type: 'CASH_PAYMENT',
        typeLabel: 'Cash Payment (Expense)',
        partyName: e.vendorName || e.title || 'Expense',
        amount: Number(e.amount) || 0,
        reference: e.billNumber || e.category || '',
        notes: e.title || e.remarks || '',
        source: 'EXPENSE'
      });
    }
  });

  getAllCounterCashTxns().forEach(t => {
    if (t.paymentMode && t.paymentMode !== 'Cash') return;
    if (t.date >= fromDate && t.date <= toDate) {
      rows.push({
        id: t.id,
        date: t.date,
        time: t.time || '-',
        type: t.type,
        typeLabel: COUNTER_TXN_TYPES[t.type] || t.type,
        partyName: t.partyName || 'Counter',
        amount: Number(t.amount) || 0,
        reference: t.reference || '',
        notes: t.notes || '',
        createdBy: t.createdBy || '',
        actorUid: t.actorUid || '',
        source: 'COUNTER'
      });
    }
  });

  rows.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  if (!q) return rows;
  return rows.filter(r =>
    r.partyName.toLowerCase().includes(q) ||
    r.typeLabel.toLowerCase().includes(q) ||
    r.notes.toLowerCase().includes(q) ||
    r.reference.toLowerCase().includes(q) ||
    (r.createdBy || '').toLowerCase().includes(q) ||
    (r.actorUid || '').toLowerCase().includes(q) ||
    r.date.includes(q) ||
    r.id.toLowerCase().includes(q)
  );
}

function getTxnBadge(type) {
  if (type === 'CASH_RECEIVED') return `<span class="badge badge-success">⬇ Cash Received</span>`;
  if (type === 'CASH_PAYMENT') return `<span class="badge badge-danger">⬆ Cash Payment</span>`;
  if (type === 'CASH_DEPOSIT') return `<span class="badge badge-warning">🏦 Cash Deposit</span>`;
  if (type === 'CASH_WITHDRAWAL') return `<span class="badge badge-info">💵 Cash Withdrawal</span>`;
  return `<span class="badge badge-neutral">${esc(type)}</span>`;
}

function renderDenominationComparisonTableHtml(tally, { showActions = true, date = tally?.date || getTodayDate() } = {}) {
  const openDen = normalizeDenominations(tally?.openingDenominations);
  const closeDen = normalizeDenominations(tally?.denominations);
  const openTotal = calculateDenominationTotal(openDen);
  const closeTotal = calculateDenominationTotal(closeDen);
  const canPrint = canMenu('counter-daybook', 'print') || canMenu('cash-reports', 'print');

  return `
    <div class="table-card" style="margin-bottom:1.25rem;">
      <div class="table-toolbar" style="flex-wrap:wrap; gap:0.5rem;">
        <div class="table-toolbar-left">
          <h3 style="margin:0; font-size:1rem; font-weight:700;">📋 Daily Cash & Denomination Report — ${formatDate(date)}</h3>
          <div style="font-size:0.76rem; color:var(--text-muted); margin-top:0.15rem;">
            Separate ₹10 Notes & ₹10 Coins · Opening Cash vs Closing Cash Breakdown
          </div>
        </div>
        ${showActions ? `
          <div class="table-toolbar-right" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openDenomViewForDate('daily-opening-cash', '${date}')">🌅 Edit Opening</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openDenomViewForDate('daily-closing-cash', '${date}')">🔒 Edit Closing</button>
            ${canPrint ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.printDenominationReport('${date}', false)">🖨 Print / PDF Denomination</button>` : ''}
            ${canPrint ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printDenominationReport('${date}', true)">📄 Blank Register Sheet</button>` : ''}
          </div>
        ` : ''}
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Denomination</th>
              <th style="text-align:right;">Opening Qty</th>
              <th style="text-align:right;">Opening Total (₹)</th>
              <th style="text-align:right;">Closing Qty</th>
              <th style="text-align:right;">Closing Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${DENOMINATION_SPEC.map(spec => {
              const oq = openDen[spec.key] || 0;
              const cq = closeDen[spec.key] || 0;
              const ot = oq * spec.value;
              const ct = cq * spec.value;
              return `
                <tr>
                  <td style="font-weight:700;">
                    ${esc(spec.label)}
                    <span style="font-size:0.72rem; font-weight:400; color:var(--text-muted); margin-left:0.3rem;">· ${spec.kind === 'note' ? 'Note' : 'Coin'}</span>
                  </td>
                  <td class="tabular-nums" style="text-align:right; font-weight:600; color:${oq > 0 ? 'var(--text-main)' : 'var(--text-muted)'};">${oq > 0 ? oq : '—'}</td>
                  <td class="tabular-nums" style="text-align:right; font-weight:600; color:${ot > 0 ? 'var(--blue-600)' : 'var(--text-muted)'};">${ot > 0 ? formatINR(ot) : '—'}</td>
                  <td class="tabular-nums" style="text-align:right; font-weight:600; color:${cq > 0 ? 'var(--text-main)' : 'var(--text-muted)'};">${cq > 0 ? cq : '—'}</td>
                  <td class="tabular-nums" style="text-align:right; font-weight:600; color:${ct > 0 ? 'var(--success)' : 'var(--text-muted)'};">${ct > 0 ? formatINR(ct) : '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--surface-alt); border-top:2px solid var(--border-strong);">
              <td style="font-weight:800;">TOTAL CASH</td>
              <td style="text-align:right; color:var(--text-muted);">—</td>
              <td class="tabular-nums" style="text-align:right; font-weight:800; font-size:1rem; color:var(--blue-600);">${formatINR(openTotal)}</td>
              <td style="text-align:right; color:var(--text-muted);">—</td>
              <td class="tabular-nums" style="text-align:right; font-weight:800; font-size:1rem; color:var(--success);">${formatINR(closeTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   1. COUNTER DAY BOOK VIEW (Professional Daily Shop Accounting System)
   ========================================================================= */
function renderModeBadge(mode) {
  const m = String(mode || 'Cash');
  if (m === 'Cash') return `<span class="badge badge-success">Cash</span>`;
  if (m === 'UPI') return `<span class="badge badge-info">UPI</span>`;
  if (m === 'QR') return `<span class="badge badge-violet">QR</span>`;
  if (m === 'Due') return `<span class="badge badge-warning">Due</span>`;
  return `<span class="badge badge-neutral">${esc(m)}</span>`;
}

export function renderCounterDayBookView() {
  ensureOpsHydration('daybook', () => window.MJK?.renderApp?.());
  const date = OpsState.daybookDate || getTodayDate();
  const tally = calculateDayTally(date);
  const query = OpsState.daybookSearchQuery || '';
  const ledgerRows = buildCounterLedgerRows(date, query);
  const cashLimit = getCashOperationLimit();
  const canAdd = canMenu('counter-daybook', 'add');
  const canDelete = canMenu('counter-daybook', 'delete');
  const canExport = canMenu('counter-daybook', 'export');
  const canPrint = canMenu('counter-daybook', 'print');

  const totalCashIn = Number(tally.totalCashIn ?? tally.cashReceived) || 0;
  const totalCashOut = Number(tally.totalCashOut ?? tally.cashPayment) || 0;

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <span>📒 Counter Day Book</span>
          <span class="badge badge-success" style="font-size:0.72rem;">DAILY ACCOUNTING REGISTER</span>
          ${cashLimit > 0 ? `<span class="badge badge-warning" style="font-size:0.72rem;">Limit: ${formatINR(cashLimit)} / Txn</span>` : ''}
        </h2>
        <p class="page-subtitle">Daily Opening Balance, Cash In (Collections), Cash Out (Expenses), Running Balance &amp; Net Closing Cash in Hand</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.45rem; flex-wrap:wrap;">
        ${canAdd ? `<button type="button" class="btn btn-success btn-sm" onclick="window.MJK.openCounterCashTxnModal('CASH_RECEIVED', '${date}')">+ Add Cash In / Collection</button>` : ''}
        ${canAdd ? `<button type="button" class="btn btn-danger btn-sm" onclick="window.MJK.openCounterCashTxnModal('CASH_PAYMENT', '${date}')">+ Add Expense / Cash Out</button>` : ''}
        ${canPrint ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.printDailyCashReport('${date}')">🖨 Print Day Book</button>` : ''}
        ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDailyCashPdf('${date}')">📄 PDF</button>` : ''}
        ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDailyCashExcel('${date}')">📊 Excel</button>` : ''}
        ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDailyCashCsv('${date}')">📄 CSV</button>` : ''}
      </div>
    </div>

    <!-- Date Filter & Search Bar -->
    <div class="card" style="padding:0.9rem 1.1rem; margin-bottom:1.15rem;">
      <div style="display:flex; align-items:flex-end; gap:0.75rem; flex-wrap:wrap;">
        <div>
          <label class="form-label" style="font-size:0.75rem;">Day Book Date (Historical Filter)</label>
          <input type="date" class="form-control" value="${esc(date)}" onchange="window.MJK.setOpsDaybookDate(this.value)">
        </div>
        <div style="flex:1; min-width:min(100%, 240px);">
          <label class="form-label" style="font-size:0.75rem;">Search Day Book (Voucher ID, Particulars, Category, Mode)</label>
          <input type="text" class="form-control" placeholder="Search transactions for ${formatDate(date)}..." value="${esc(query)}" oninput="window.MJK.setOpsDaybookSearch(this.value)">
        </div>
        ${canAdd ? `
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-violet btn-sm" onclick="window.MJK.openCounterCashTxnModal('CASH_DEPOSIT', '${date}')">🏦 Bank Deposit</button>
            <button type="button" class="btn btn-orange btn-sm" onclick="window.MJK.openCounterCashTxnModal('CASH_WITHDRAWAL', '${date}')">💵 Bank Withdrawal</button>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- 4 Counter Summary Dashboard Cards (Figures + English Words) -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:0.9rem; margin-bottom:0.9rem;">
      <div class="stat-card">
        <div class="stat-label">1. Opening Balance</div>
        <div class="stat-value tabular-nums" style="color:var(--blue-600); font-size:1.45rem;">${formatINR(tally.openingCash)}</div>
        <div style="font-size:0.72rem; font-weight:600; color:var(--text-main); margin-top:0.2rem;">${esc(numberToWords(tally.openingCash))}</div>
        <div class="stat-footer" style="font-size:0.7rem; margin-top:0.35rem;">${tally.openingSaved ? '✓ Opening Confirmed' : (tally.prevDate ? `Carried from ${formatDate(tally.prevDate)}` : 'Starting cash drawer')}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">2. Total Cash In (Collections)</div>
        <div class="stat-value tabular-nums" style="color:var(--success); font-size:1.45rem;">+${formatINR(totalCashIn)}</div>
        <div style="font-size:0.72rem; font-weight:600; color:var(--text-main); margin-top:0.2rem;">${esc(numberToWords(totalCashIn))}</div>
        <div class="stat-footer" style="font-size:0.7rem; margin-top:0.35rem;">Receipts: ${formatINR(tally.serviceCashIn)} · Manual: ${formatINR(tally.manualCashReceived)}${tally.cashWithdrawal > 0 ? ` · Bank In: ${formatINR(tally.cashWithdrawal)}` : ''}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">3. Total Cash Out (Expenses)</div>
        <div class="stat-value tabular-nums" style="color:var(--danger); font-size:1.45rem;">-${formatINR(totalCashOut)}</div>
        <div style="font-size:0.72rem; font-weight:600; color:var(--text-main); margin-top:0.2rem;">${esc(numberToWords(totalCashOut))}</div>
        <div class="stat-footer" style="font-size:0.7rem; margin-top:0.35rem;">Expenses: ${formatINR(tally.cashExpenses)} · Payouts: ${formatINR(tally.manualCashPayment)}${tally.cashDeposit > 0 ? ` · Banked: ${formatINR(tally.cashDeposit)}` : ''}</div>
      </div>

      <div class="stat-card" style="border:1.5px solid var(--blue-600);">
        <div class="stat-label">4. Net Closing Cash in Hand</div>
        <div class="stat-value tabular-nums" style="color:var(--blue-700); font-size:1.45rem;">${formatINR(tally.closingCash)}</div>
        <div style="font-size:0.72rem; font-weight:600; color:var(--text-main); margin-top:0.2rem;">${esc(numberToWords(tally.closingCash))}</div>
        <div class="stat-footer" style="font-size:0.7rem; margin-top:0.35rem;">Expected: ${formatINR(tally.expectedClosing)} · Diff: ${formatINR(tally.difference)} · ${esc(tally.status)}</div>
      </div>
    </div>

    <!-- Separate Digital & Credit Tracking Strip (Never mixed into Physical Cash in Hand) -->
    <div class="card" style="padding:0.7rem 1rem; margin-bottom:1.15rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; font-size:0.8rem;">
      <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:center;">
        <span><strong>UPI Collections:</strong> <span class="tabular-nums" style="color:var(--blue-600); font-weight:700;">${formatINR(tally.upiIn)}</span></span>
        <span><strong>QR Collections:</strong> <span class="tabular-nums" style="color:var(--violet-600); font-weight:700;">${formatINR(tally.qrIn)}</span></span>
        ${tally.bankIn > 0 ? `<span><strong>Bank / Card In:</strong> <span class="tabular-nums" style="font-weight:700;">${formatINR(tally.bankIn)}</span></span>` : ''}
        <span><strong>Pending Due / Credit:</strong> <span class="tabular-nums" style="color:var(--warning); font-weight:700;">${formatINR(tally.duePendingTotal)}</span> <span style="font-size:0.7rem; color:var(--text-muted);">(excluded from Cash In until collected)</span></span>
      </div>
      <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openDenomViewForDate('daily-opening-cash', '${date}')">🌅 Opening Drawer</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openDenomViewForDate('daily-closing-cash', '${date}')">🔒 Closing Tally</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('bank-reconciliation')">🏦 Reconcile Bank &amp; Cash</button>
      </div>
    </div>

    <!-- Comprehensive 8-Column Transaction Table -->
    <div class="table-card" style="margin-bottom:1.25rem;">
      <div class="table-toolbar" style="flex-wrap:wrap; gap:0.5rem;">
        <div class="table-toolbar-left">
          <h3 style="margin:0; font-size:1rem; font-weight:700;">Counter Day Book Ledger — ${formatDate(date)} (${ledgerRows.length} entries)</h3>
          <div style="font-size:0.74rem; color:var(--text-muted); margin-top:0.15rem;">Chronological running physical cash balance starting from Opening Balance (${formatINR(tally.openingCash)})</div>
        </div>
        <div class="table-toolbar-right" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDailyCashPdf('${date}')">📄 PDF</button>` : ''}
          ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDailyCashExcel('${date}')">📊 Excel</button>` : ''}
          ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportDailyCashCsv('${date}')">📥 CSV</button>` : ''}
          ${canPrint ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printDailyCashReport('${date}')">🖨 Print Day Book</button>` : ''}
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Time / Date</th>
              <th>Receipt / Voucher ID</th>
              <th>Particulars / Customer Name</th>
              <th>Category / Transaction Type</th>
              <th>Payment Mode</th>
              <th style="text-align:right;">Cash In (+)</th>
              <th style="text-align:right;">Cash Out (-)</th>
              <th style="text-align:right;">Running Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background:var(--surface-alt);">
              <td class="tabular-nums" style="font-size:0.78rem; color:var(--text-muted);">Opening · ${formatDate(date)}</td>
              <td class="font-mono" style="font-size:0.76rem; color:var(--text-muted);">OPEN-BAL</td>
              <td style="font-weight:700;">Opening Cash in Hand</td>
              <td><span class="badge badge-info" style="font-size:0.68rem;">Opening Balance</span></td>
              <td>${renderModeBadge('Cash')}</td>
              <td class="tabular-nums" style="text-align:right; color:var(--text-muted);">—</td>
              <td class="tabular-nums" style="text-align:right; color:var(--text-muted);">—</td>
              <td class="tabular-nums" style="text-align:right; font-weight:800; color:var(--blue-600);">${formatINR(tally.openingCash)}</td>
            </tr>
            ${ledgerRows.map(r => `
              <tr>
                <td class="tabular-nums" style="font-size:0.78rem; white-space:nowrap;">
                  <div style="font-weight:600;">${esc(r.time || '-')}</div>
                  <div style="font-size:0.7rem; color:var(--text-muted);">${formatDate(r.date)}</div>
                </td>
                <td class="font-mono" style="font-weight:700; font-size:0.78rem; color:var(--blue-600);">
                  <div>${esc(r.voucherId || r.id)}</div>
                  ${r.source === 'COUNTER' && canDelete ? `<button type="button" class="btn btn-outline btn-sm" style="margin-top:0.2rem; padding:1px 6px; font-size:0.66rem; color:var(--danger);" onclick="window.MJK.promptDeleteCounterCashTxn('${esc(r.id)}')">🗑 Delete</button>` : ''}
                </td>
                <td>
                  <div style="font-weight:700;">${esc(r.partyName)}</div>
                  ${r.notes ? `<div style="font-size:0.72rem; color:var(--text-muted);">${esc(r.notes)}</div>` : ''}
                </td>
                <td style="font-size:0.8rem;">${esc(r.categoryLabel)}</td>
                <td>${renderModeBadge(r.paymentMode)}</td>
                <td class="amount tabular-nums" style="text-align:right; font-weight:700; color:${r.cashIn > 0 ? 'var(--success)' : 'var(--text-muted)'};">
                  ${r.cashIn > 0
                    ? `+${formatINR(r.cashIn)}`
                    : (r.nonCashAmount > 0 && (r.type === 'CASH_RECEIVED' || r.type === 'CASH_WITHDRAWAL')
                        ? `<span style="font-size:0.72rem; color:var(--text-muted);" title="Digital mode - separate from physical cash">${formatINR(r.nonCashAmount)} (${esc(r.paymentMode)})</span>`
                        : (r.paymentMode === 'Due'
                            ? `<span style="font-size:0.7rem; color:var(--warning);">Due ${formatINR(r.nonCashAmount)}</span>`
                            : '—'))}
                </td>
                <td class="amount tabular-nums" style="text-align:right; font-weight:700; color:${r.cashOut > 0 ? 'var(--danger)' : 'var(--text-muted)'};">
                  ${r.cashOut > 0
                    ? `-${formatINR(r.cashOut)}`
                    : (r.nonCashAmount > 0 && (r.type === 'CASH_PAYMENT' || r.type === 'CASH_DEPOSIT')
                        ? `<span style="font-size:0.72rem; color:var(--text-muted);">${formatINR(r.nonCashAmount)} (${esc(r.paymentMode)})</span>`
                        : '—')}
                </td>
                <td class="amount tabular-nums" style="text-align:right; font-weight:800; color:${r.runningBalance >= 0 ? 'var(--text-main)' : 'var(--danger)'};">
                  ${formatINR(r.runningBalance)}
                </td>
              </tr>
            `).join('') || `
              <tr>
                <td colspan="8" style="text-align:center; padding:1.75rem; color:var(--text-muted);">
                  No transactions recorded for ${formatDate(date)}. Use <strong>+ Add Cash In / Collection</strong> or <strong>+ Add Expense / Cash Out</strong> above.
                </td>
              </tr>
            `}
          </tbody>
          <tfoot>
            <tr style="background:var(--surface-alt); border-top:2px solid var(--border-strong); font-weight:800;">
              <td colspan="5" style="text-align:right; padding:0.65rem;">Day Book Totals (${formatDate(date)}):</td>
              <td class="tabular-nums" style="text-align:right; color:var(--success);">+${formatINR(totalCashIn)}</td>
              <td class="tabular-nums" style="text-align:right; color:var(--danger);">-${formatINR(totalCashOut)}</td>
              <td class="tabular-nums" style="text-align:right; color:var(--blue-700);">${formatINR(tally.expectedClosing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    ${renderDenominationComparisonTableHtml(tally, { showActions: true, date })}
  `;
}

/* =========================================================================
   2. DAILY OPENING CASH VIEW
   ========================================================================= */
export function renderDailyOpeningCashView() {
  const date = OpsState.openingDate || getTodayDate();
  const tally = calculateDayTally(date);
  const den = normalizeDenominations(tally.openingDenominations);
  const openDenomTotal = calculateDenominationTotal(den);
  const recentEntries = getAllDaybookEntries()
    .slice()
    .sort((a, b) => (b.date > a.date ? 1 : -1))
    .slice(0, 12);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">🌅 Daily Opening Cash</h2>
        <p class="page-subtitle">Carry forward Previous Day Balance & count opening Notes and Coins (₹10 Notes & ₹10 Coins separated) before counter service begins</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printDenominationReport('${date}', false)">🖨 Denomination Print</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printDenominationReport('${date}', true)">📄 Blank Sheet</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportOpeningClosingPdf('${date}', 'OPENING')">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportOpeningClosingExcel('${date}', 'OPENING')">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportOpeningClosingCsv('${date}', 'OPENING')">📄 CSV</button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap:1.25rem; margin-bottom:1.5rem; align-items:start;">
      <div class="card" style="padding:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
          <h3 style="margin:0; font-size:1.05rem;">Opening Drawer Setup</h3>
          <input type="date" class="form-control" style="width:auto;" value="${esc(date)}" onchange="window.MJK.setOpsOpeningDate(this.value)">
        </div>

        <div style="background:var(--info-bg); border:1px solid var(--info-border); border-radius:var(--radius-md); padding:0.75rem 0.9rem; margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <div style="font-size:0.72rem; font-weight:700; color:var(--info);">PREVIOUS DAY CLOSING BALANCE</div>
            <div class="tabular-nums" style="font-size:1.2rem; font-weight:900; color:var(--text-main);">${formatINR(tally.previousDayBalance)}</div>
            <div style="font-size:0.71rem; color:var(--text-main); font-weight:600; margin-top:0.15rem;">${esc(numberToWords(tally.previousDayBalance))}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${tally.prevDate ? `Closing of ${formatDate(tally.prevDate)}` : 'No prior closed date found'}</div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.carryForwardPrevBalance(${tally.previousDayBalance})">
            ↩ Carry Forward
          </button>
        </div>

        <form onsubmit="window.MJK.handleSaveOpeningCashForm(event, '${date}')">
          <div class="form-group">
            <label class="form-label">Opening Cash Amount (₹) <span class="req">*</span></label>
            <input type="number" id="ops-opening-amount" class="form-control tabular-nums" style="font-size:1.2rem; font-weight:800;" value="${tally.openingCash}" min="0" required oninput="window.MJK?.syncAmountWords?.(this, 'ops-opening-amount-words')">
            <div id="ops-opening-amount-words" class="amount-words-hint">Amount in Words: ${esc(numberToWords(tally.openingCash))}</div>
            <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.15rem;">Auto-updates as you enter Notes & Coins Qty on the right.</div>
          </div>
          <div class="form-group">
            <label class="form-label">Opening Remarks / Verified By</label>
            <input type="text" id="ops-opening-notes" class="form-control" value="${esc(tally.openingNotes)}" placeholder="e.g. Morning float verified by counter staff">
          </div>
          <button type="submit" class="btn btn-success" style="width:100%;">✓ Save Daily Opening Cash</button>
        </form>
      </div>

      <div class="card" style="padding:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.75rem; flex-wrap:wrap;">
          <div>
            <h3 style="margin:0; font-size:1.05rem;">Opening Notes & Coins Denomination</h3>
            <div style="font-size:0.74rem; color:var(--text-muted);">Dokan kholar somoy drawer-e je cash thake tar hisab</div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.resetDenomInputs('op')">↺ Clear Qty</button>
        </div>

        <div class="table-responsive">
          <table class="data-table" style="margin:0;">
            <thead>
              <tr>
                <th>Denomination</th>
                <th style="text-align:right; width:110px;">Opening Qty</th>
                <th style="text-align:right; width:125px;">Opening Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${DENOMINATION_SPEC.map(spec => {
                const qty = den[spec.key] || 0;
                const sub = qty * spec.value;
                return `
                  <tr>
                    <td style="font-weight:700; padding:0.42rem 0.65rem;">
                      ${esc(spec.label)}
                    </td>
                    <td style="padding:0.32rem 0.5rem; text-align:right;">
                      <input type="number" id="op-${spec.key}" class="form-control form-control-sm tabular-nums" style="width:88px; margin-left:auto; text-align:right;" min="0" step="1" value="${qty}" oninput="window.MJK.recalcOpeningDenom()">
                    </td>
                    <td id="op-sub-${spec.key}" class="tabular-nums" style="padding:0.42rem 0.65rem; text-align:right; font-weight:700; color:${sub > 0 ? 'var(--blue-600)' : 'var(--text-muted)'};">
                      ${sub > 0 ? formatINR(sub) : '—'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--surface-alt); border-top:2px solid var(--border-strong);">
                <td style="font-weight:800; padding:0.6rem 0.65rem;">TOTAL CASH</td>
                <td style="text-align:right; color:var(--text-muted); padding:0.6rem 0.5rem;">—</td>
                <td id="op-denom-total" class="tabular-nums" style="text-align:right; font-weight:800; font-size:1.08rem; color:var(--blue-600); padding:0.6rem 0.65rem;">
                  ${formatINR(openDenomTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-toolbar"><h3 style="margin:0; font-size:0.95rem;">Recent Daily Opening Balances</h3></div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Previous Day Balance</th>
              <th>Opening Cash</th>
              <th>Cash Received</th>
              <th>Closing Cash</th>
              <th>Verified By</th>
              <th style="text-align:right;">Denomination</th>
            </tr>
          </thead>
          <tbody>
            ${recentEntries.map(e => `
              <tr>
                <td class="date tabular-nums" style="font-weight:700;">${formatDate(e.date)}</td>
                <td class="tabular-nums">${formatINR(e.previousDayBalance || 0)}</td>
                <td class="tabular-nums" style="font-weight:700; color:var(--blue-600);">${formatINR(e.openingCash || 0)}</td>
                <td class="tabular-nums" style="color:var(--success);">+${formatINR(e.cashReceived ?? e.serviceCashIn ?? 0)}</td>
                <td class="tabular-nums" style="font-weight:700;">${formatINR(e.closingCash ?? e.countedPhysicalCash ?? 0)}</td>
                <td>${esc(e.verifiedBy || '-')}</td>
                <td style="text-align:right;">
                  <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printDenominationReport('${esc(e.date)}', false)">📋 Sheet</button>
                </td>
              </tr>
            `).join('') || `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No opening cash logs saved yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   3. DAILY CLOSING CASH VIEW
   ========================================================================= */
export function renderDailyClosingCashView() {
  const date = OpsState.closingDate || getTodayDate();
  const tally = calculateDayTally(date);
  const openDen = normalizeDenominations(tally.openingDenominations);
  const closeDen = normalizeDenominations(tally.denominations);
  const openDenomTotal = calculateDenominationTotal(openDen);
  const closeDenomTotal = calculateDenominationTotal(closeDen);
  const diffColor = tally.difference === 0 ? 'var(--success)' : tally.difference > 0 ? 'var(--warning)' : 'var(--danger)';

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">🔒 Daily Closing Cash & Physical Verification</h2>
        <p class="page-subtitle">Tally end-of-day physical Notes & Coins (₹10 Notes & ₹10 Coins separated) against system expected closing cash</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printDenominationReport('${date}', false)">🖨 Denomination</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printDenominationReport('${date}', true)">📄 Blank Sheet</button>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.printDailyCashReport('${date}')">🖨 Print Closing</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportOpeningClosingPdf('${date}', 'CLOSING')">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportOpeningClosingExcel('${date}', 'CLOSING')">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportOpeningClosingCsv('${date}', 'CLOSING')">📄 CSV</button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:minmax(min(100%, 310px), 1fr) minmax(min(100%, 440px), 1.45fr); gap:1.25rem; align-items:start;">
      <div class="card" style="padding:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; margin-bottom:1rem; gap:0.5rem;">
          <h3 style="margin:0; font-size:1.05rem;">System Expected Cash Summary</h3>
          <input type="date" class="form-control" style="width:auto;" value="${esc(date)}" onchange="window.MJK.setOpsClosingDate(this.value)">
        </div>
        <div style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.88rem;">
          <div style="display:flex; justify-content:space-between; padding:0.45rem 0; border-bottom:1px solid var(--border-subtle);">
            <span>Opening Cash (Prev Bal: ${formatINR(tally.previousDayBalance)})</span>
            <strong class="tabular-nums">${formatINR(tally.openingCash)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:0.45rem 0; border-bottom:1px solid var(--border-subtle); color:var(--success);">
            <span>(+) Total Cash Received</span>
            <strong class="tabular-nums">+${formatINR(tally.cashReceived)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:0.45rem 0; border-bottom:1px solid var(--border-subtle); color:var(--info);">
            <span>(+) Cash Withdrawal (To Counter)</span>
            <strong class="tabular-nums">+${formatINR(tally.cashWithdrawal)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:0.45rem 0; border-bottom:1px solid var(--border-subtle); color:var(--danger);">
            <span>(-) Total Cash Payment</span>
            <strong class="tabular-nums">-${formatINR(tally.cashPayment)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:0.45rem 0; border-bottom:1px solid var(--border-subtle); color:var(--warning);">
            <span>(-) Cash Deposit (Banked Out)</span>
            <strong class="tabular-nums">-${formatINR(tally.cashDeposit)}</strong>
          </div>
          <div style="padding:0.7rem; background:var(--blue-50); border-radius:6px; margin-top:0.25rem;">
            <div style="display:flex; justify-content:space-between; font-size:1rem;">
              <strong style="color:#1e3a8a;">Expected Closing Cash:</strong>
              <strong id="cl-expected-val" data-val="${tally.expectedClosing}" class="tabular-nums" style="color:#1d4ed8;">${formatINR(tally.expectedClosing)}</strong>
            </div>
            <div style="font-size:0.72rem; color:#1e40af; font-weight:600; margin-top:0.2rem;">${esc(numberToWords(tally.expectedClosing))}</div>
          </div>
        </div>
      </div>

      <form class="card" style="padding:1.25rem;" onsubmit="window.MJK.handleSaveClosingCashForm(event, '${date}')">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.75rem; flex-wrap:wrap;">
          <div>
            <h3 style="margin:0; font-size:1.05rem;">Daily Cash & Denomination Count</h3>
            <div style="font-size:0.74rem; color:var(--text-muted);">Opening reference on left · Enter Closing Qty on right</div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.resetDenomInputs('cl')">↺ Clear Closing Qty</button>
        </div>

        <div class="table-responsive" style="margin-bottom:0.9rem;">
          <table class="data-table" style="margin:0;">
            <thead>
              <tr>
                <th>Denomination</th>
                <th style="text-align:right;">Open Qty</th>
                <th style="text-align:right;">Open Total (₹)</th>
                <th style="text-align:right; width:96px;">Closing Qty</th>
                <th style="text-align:right;">Closing Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${DENOMINATION_SPEC.map(spec => {
                const oq = openDen[spec.key] || 0;
                const ot = oq * spec.value;
                const cq = closeDen[spec.key] || 0;
                const ct = cq * spec.value;
                return `
                  <tr>
                    <td style="font-weight:700; padding:0.38rem 0.55rem;">${esc(spec.label)}</td>
                    <td class="tabular-nums" style="text-align:right; padding:0.38rem 0.55rem; color:${oq > 0 ? 'var(--text-main)' : 'var(--text-muted)'};">${oq > 0 ? oq : '—'}</td>
                    <td class="tabular-nums" style="text-align:right; padding:0.38rem 0.55rem; color:${ot > 0 ? 'var(--blue-600)' : 'var(--text-muted)'};">${ot > 0 ? formatINR(ot) : '—'}</td>
                    <td style="padding:0.28rem 0.4rem; text-align:right;">
                      <input type="number" id="cl-${spec.key}" class="form-control form-control-sm tabular-nums" style="width:82px; margin-left:auto; text-align:right;" min="0" step="1" value="${cq}" oninput="window.MJK.recalcClosingDenom()">
                    </td>
                    <td id="cl-sub-${spec.key}" class="tabular-nums" style="text-align:right; padding:0.38rem 0.55rem; font-weight:700; color:${ct > 0 ? 'var(--success)' : 'var(--text-muted)'};">
                      ${ct > 0 ? formatINR(ct) : '—'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--surface-alt); border-top:2px solid var(--border-strong);">
                <td style="font-weight:800; padding:0.55rem;">TOTAL CASH</td>
                <td style="text-align:right; color:var(--text-muted); padding:0.55rem;">—</td>
                <td class="tabular-nums" style="text-align:right; font-weight:800; color:var(--blue-600); padding:0.55rem;">${formatINR(openDenomTotal)}</td>
                <td style="text-align:right; color:var(--text-muted); padding:0.55rem;">—</td>
                <td id="cl-denom-total" class="tabular-nums" style="text-align:right; font-weight:800; font-size:1.05rem; color:var(--success); padding:0.55rem;">${formatINR(closeDenomTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Physical Closing Cash (₹) *</label>
            <input type="number" id="cl-physical-amount" class="form-control tabular-nums" style="font-weight:800; font-size:1.05rem;" value="${tally.closingCash}" min="0" required oninput="window.MJK.updateClosingVariance()">
            <div id="cl-physical-amount-words" class="amount-words-hint">Amount in Words: ${esc(numberToWords(tally.closingCash))}</div>
          </div>
          <div class="form-group">
            <label class="form-label">Variance / Difference</label>
            <div id="cl-variance-box" class="form-control tabular-nums" style="font-weight:800; color:${diffColor}; background:var(--surface-alt);">
              ${tally.difference === 0 ? 'Balanced (₹0)' : (tally.difference > 0 ? `+${formatINR(tally.difference)} Excess` : `${formatINR(tally.difference)} Shortage`)}
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Closing Notes / Handover Remarks</label>
          <input type="text" id="cl-notes" class="form-control" value="${esc(tally.notes)}" placeholder="e.g. Locked cash box & verified by manager">
        </div>

        <button type="submit" class="btn btn-primary" style="width:100%;">🔒 Save & Lock Daily Closing Cash</button>
      </form>
    </div>
  `;
}

/* =========================================================================
   4. STAFF ATTENDANCE REGISTER VIEW
   ========================================================================= */
export function renderStaffAttendanceView({ embedded = false } = {}) {
  ensureOpsHydration('attendance', () => window.MJK?.renderApp?.());
  const currentUser = getCurrentUser();
  const canAll = canViewAllAttendanceScope(currentUser);
  const myUid = currentUser?.uid || currentUser?.id || '';
  const dateFilter = OpsState.attDateFilter || '';
  const staffFilter = canAll ? (OpsState.attStaffFilter || 'all') : myUid;
  const allRecords = getAllAttendance();
  const staffList = canAll ? getActiveStaffList() : getActiveStaffList().filter(u => (u.uid || u.id) === myUid);
  const canAdd = canMenu('staff-attendance', 'add') || canMenu('attendance-tracking', 'add');
  const canEdit = canMenu('staff-attendance', 'edit') || canMenu('attendance-tracking', 'edit');
  const canDelete = canMenu('staff-attendance', 'delete') || canMenu('attendance-tracking', 'delete');

  const filtered = allRecords.filter(r => {
    if (!canAll && myUid && r.staffId !== myUid) return false;
    const matchDate = !dateFilter || r.date === dateFilter;
    const matchStaff = staffFilter === 'all' || r.staffId === staffFilter;
    return matchDate && matchStaff;
  });

  const actionsHtml = `
    <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printStaffAttendanceRegister()">🖨 Print</button>
    <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportStaffAttendancePDF()">📄 PDF</button>
    <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportStaffAttendanceExcel()">📊 Excel</button>
    <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportStaffAttendanceCSV()">📄 CSV</button>
    ${canAdd ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openStaffAttendanceModal()">+ Mark Attendance</button>` : ''}
  `;

  return `
    ${embedded ? `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap; margin-bottom:1rem;">
        <div>
          <h3 style="margin:0; font-size:1.05rem;">Daily Staff Attendance Register</h3>
          <p style="margin:0.15rem 0 0 0; font-size:0.78rem; color:var(--text-muted);">Morning In, Out Time, Late Entry, Early Leave, Working Hours &amp; Present / Absent / Leave</p>
        </div>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">${actionsHtml}</div>
      </div>
    ` : `
      <div class="page-header">
        <div>
          <h2 class="page-title">🧑‍💼 Staff Attendance Management</h2>
          <p class="page-subtitle">Staff Name, Employee ID, Date, Morning In Time, Out Time, Late Entry, Early Leave, Total Working Hours & Present / Absent / Leave</p>
        </div>
        <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">${actionsHtml}</div>
      </div>
    `}

    <div class="card" style="padding:0.9rem 1.1rem; margin-bottom:1.15rem;">
      <div style="display:flex; align-items:flex-end; gap:0.75rem; flex-wrap:wrap;">
        <div>
          <label class="form-label" style="font-size:0.75rem;">Filter by Date</label>
          <input type="date" class="form-control" value="${esc(dateFilter)}" onchange="window.MJK.setOpsAttDateFilter(this.value)">
        </div>
        ${canAll ? `
          <div>
            <label class="form-label" style="font-size:0.75rem;">Filter by Staff Member</label>
            <select class="form-control" onchange="window.MJK.setOpsAttStaffFilter(this.value)">
              <option value="all" ${staffFilter === 'all' ? 'selected' : ''}>All Staff (${staffList.length})</option>
              ${staffList.map(u => `<option value="${esc(u.uid || u.id)}" ${staffFilter === (u.uid || u.id) ? 'selected' : ''}>${esc(u.name)} (${esc(u.uid || u.id)})</option>`).join('')}
            </select>
          </div>
        ` : ''}
        ${dateFilter ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.setOpsAttDateFilter('')">Show All Dates</button>` : ''}
      </div>
    </div>

    <div class="table-card">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <h3 style="margin:0; font-size:1rem;">${canAll ? 'Staff Attendance Register' : 'My Attendance Register'} (${filtered.length} entries)</h3>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff Name & Employee ID</th>
              <th>Date</th>
              <th>Morning In Time</th>
              <th>Out Time</th>
              <th>Late Entry</th>
              <th>Early Leave</th>
              <th>Total Working Hours</th>
              <th>Status</th>
              ${(canEdit || canDelete) ? `<th style="text-align:right;">Actions</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${filtered.map(r => {
              const statusBadge = r.status === 'Present'
                ? 'badge-success'
                : r.status === 'Half Day'
                  ? 'badge-warning'
                  : r.status === 'Leave'
                    ? 'badge-info'
                    : 'badge-danger';
              return `
                <tr>
                  <td>
                    <div style="font-weight:700;">${esc(r.staffName)}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted); font-family:monospace;">ID: ${esc(r.staffId || '-')} · ${esc(r.role || 'Staff')}</div>
                  </td>
                  <td class="date tabular-nums">${formatDate(r.date)}</td>
                  <td class="tabular-nums" style="font-weight:600;">${esc(r.clockIn || '-')}</td>
                  <td class="tabular-nums" style="font-weight:600;">${esc(r.clockOut || '-')}</td>
                  <td>
                    ${r.lateMinutes > 0
                      ? `<span class="badge badge-danger">${esc(r.lateLabel)}</span>`
                      : `<span class="badge badge-success">${esc(r.lateLabel || 'On Time')}</span>`}
                  </td>
                  <td>
                    ${r.earlyLeaveMinutes > 0
                      ? `<span class="badge badge-warning">${esc(r.earlyLeaveLabel)}</span>`
                      : `<span class="badge badge-neutral">${esc(r.earlyLeaveLabel || 'Full Shift')}</span>`}
                  </td>
                  <td class="tabular-nums" style="font-weight:700; color:var(--blue-600);">${esc(r.workingHoursLabel || '0h 00m')}</td>
                  <td><span class="badge ${statusBadge}">${esc(r.status)}</span></td>
                  ${(canEdit || canDelete) ? `
                    <td style="text-align:right; white-space:nowrap;">
                      ${canEdit ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openStaffAttendanceModal('${esc(r.id)}')">✎ Edit</button>` : ''}
                      ${canDelete ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteAttendance('${esc(r.id)}')">🗑</button>` : ''}
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join('') || `
              <tr>
                <td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted);">
                  No attendance entries found for this filter.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   5. TIME MANAGEMENT REGISTER VIEW
   ========================================================================= */
export function renderTimeRegisterView() {
  ensureOpsHydration('attendance', () => window.MJK?.renderApp?.());
  const currentUser = getCurrentUser();
  const canAll = canViewAllAttendanceScope(currentUser);
  const myUid = currentUser?.uid || currentUser?.id || '';
  const shiftCfg = getShiftConfig();
  const date = OpsState.timeRegDate || getTodayDate();
  const month = OpsState.timeRegMonth || getTodayDate().slice(0, 7);
  const staffList = canAll ? getActiveStaffList() : getActiveStaffList().filter(u => (u.uid || u.id) === myUid);
  const dailyRecords = getAllAttendance().filter(r => r.date === date && (canAll || !myUid || r.staffId === myUid));
  const monthlyReport = getMonthlyAttendanceReport(month, canAll ? 'all' : myUid);
  const canEditShift = canMenu('time-register', 'edit');
  const canAdd = canMenu('time-register', 'add');

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">⏱️ Time Management Register</h2>
        <p class="page-subtitle">Daily Staff In-Time & Out-Time, Working Hours, Late Tracking, Overtime Calculation & Monthly Performance Report</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printTimeRegisterReport()">🖨 Print</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportTimeRegisterPDF()">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportTimeRegisterExcel()">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportTimeRegisterCSV()">📄 CSV</button>
      </div>
    </div>

    <!-- Standard Shift Configuration & Quick Time Entry -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap:1.15rem; margin-bottom:1.25rem;">
      ${canEditShift ? `
        <form class="card" style="padding:1.1rem;" onsubmit="window.MJK.handleSaveShiftConfig(event)">
          <h3 style="margin:0 0 0.75rem 0; font-size:0.98rem;">Standard Counter Shift Rules</h3>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Morning In-Time</label>
              <input type="time" id="shift-in-time" class="form-control" value="${esc(shiftCfg.morningInTime)}">
            </div>
            <div class="form-group">
              <label class="form-label">Evening Out-Time</label>
              <input type="time" id="shift-out-time" class="form-control" value="${esc(shiftCfg.eveningOutTime)}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Late Grace (Mins)</label>
              <input type="number" id="shift-grace-mins" class="form-control" value="${shiftCfg.graceMinutes}" min="0" max="120">
            </div>
            <div class="form-group">
              <label class="form-label">Standard Shift (Hours)</label>
              <input type="number" id="shift-std-hours" class="form-control" value="${shiftCfg.standardHours}" min="1" max="18" step="0.5">
            </div>
          </div>
          <button type="submit" class="btn btn-secondary btn-sm">💾 Save Shift Rules</button>
        </form>
      ` : ''}

      ${canAdd ? `
        <form class="card" style="padding:1.1rem;" onsubmit="window.MJK.handleQuickTimeLog(event)">
          <h3 style="margin:0 0 0.75rem 0; font-size:0.98rem;">Quick Daily In-Time / Out-Time Entry</h3>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Staff Member *</label>
              <select id="tr-staff-id" class="form-control" required ${canAll ? '' : 'disabled'}>
                ${staffList.map(u => `<option value="${esc(u.uid || u.id)}">${esc(u.name)} (${esc(u.uid || u.id)})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input type="date" id="tr-date" class="form-control" value="${esc(date)}" required onchange="window.MJK.setOpsTimeRegDate(this.value)">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">In-Time</label>
              <input type="time" id="tr-in-time" class="form-control" value="${esc(shiftCfg.morningInTime)}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Out-Time</label>
              <input type="time" id="tr-out-time" class="form-control" value="${esc(shiftCfg.eveningOutTime)}">
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-sm">⏱️ Record Time Entry</button>
        </form>
      ` : ''}
    </div>

    <!-- Daily Time Register Table -->
    <div class="table-card" style="margin-bottom:1.5rem;">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <h3 style="margin:0; font-size:1rem;">${canAll ? 'Daily Time Register' : 'My Daily Time Log'} — ${formatDate(date)}</h3>
        </div>
        <div class="table-toolbar-right">
          <input type="date" class="form-control" style="width:auto;" value="${esc(date)}" onchange="window.MJK.setOpsTimeRegDate(this.value)">
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff Name & ID</th>
              <th>In-Time</th>
              <th>Out-Time</th>
              <th>Working Hours</th>
              <th>Late Tracking</th>
              <th>Early Leave</th>
              <th>Overtime</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${dailyRecords.map(r => `
              <tr>
                <td>
                  <div style="font-weight:700;">${esc(r.staffName)}</div>
                  <div style="font-size:0.7rem; color:var(--text-muted); font-family:monospace;">${esc(r.staffId || '-')}</div>
                </td>
                <td class="tabular-nums">${esc(r.clockIn || '-')}</td>
                <td class="tabular-nums">${esc(r.clockOut || '-')}</td>
                <td class="tabular-nums" style="font-weight:700; color:var(--blue-600);">${esc(r.workingHoursLabel || '0h 00m')}</td>
                <td>${r.lateMinutes > 0 ? `<span class="badge badge-danger">${esc(r.lateLabel)}</span>` : `<span class="badge badge-success">On Time</span>`}</td>
                <td>${r.earlyLeaveMinutes > 0 ? `<span class="badge badge-warning">${esc(r.earlyLeaveLabel)}</span>` : `<span class="badge badge-neutral">Full Shift</span>`}</td>
                <td class="tabular-nums" style="font-weight:700; color:${r.overtimeMinutes > 0 ? 'var(--success)' : 'var(--text-muted)'};">${esc(r.overtimeLabel || '0h 00m')}</td>
                <td><span class="badge badge-info">${esc(r.status)}</span></td>
              </tr>
            `).join('') || `<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No time entries logged for ${formatDate(date)}.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Monthly Staff Performance Report -->
    <div class="table-card">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <h3 style="margin:0; font-size:1rem;">Monthly Staff Performance Summary (${esc(month)})</h3>
        </div>
        <div class="table-toolbar-right">
          <input type="month" class="form-control" style="width:auto;" value="${esc(month)}" onchange="window.MJK.setOpsTimeRegMonth(this.value)">
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff Member & ID</th>
              <th>Present Days</th>
              <th>Late Count</th>
              <th>Early Leaves</th>
              <th>Total Working Hours</th>
              <th>Total Overtime</th>
              <th>Punctuality Score</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyReport.staffRows.map(s => `
              <tr>
                <td>
                  <div style="font-weight:700;">${esc(s.staffName)}</div>
                  <div style="font-size:0.72rem; color:var(--text-muted); font-family:monospace;">${esc(s.staffId)} · ${esc(s.role)}</div>
                </td>
                <td class="tabular-nums" style="font-weight:700; color:var(--success);">${s.presentDays}</td>
                <td class="tabular-nums" style="color:${s.lateDays > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight:700;">${s.lateDays}</td>
                <td class="tabular-nums">${s.earlyLeaveDays}</td>
                <td class="tabular-nums" style="font-weight:700;">${esc(s.totalWorkingLabel)}</td>
                <td class="tabular-nums" style="font-weight:700; color:var(--blue-600);">${esc(s.totalOvertimeLabel)}</td>
                <td>
                  <span class="badge ${s.onTimePct >= 85 ? 'badge-success' : s.onTimePct >= 65 ? 'badge-warning' : 'badge-danger'}">
                    ${s.onTimePct}% On-Time
                  </span>
                </td>
              </tr>
            `).join('') || `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No attendance data for this month.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   6. GPS + PHOTO LOCATION ATTENDANCE VIEW
   ========================================================================= */
export function renderGpsAttendanceView({ embedded = false } = {}) {
  ensureOpsHydration('photos', () => window.MJK?.renderApp?.());
  const currentUser = getCurrentUser();
  const canAllAtt = canViewAllAttendanceScope(currentUser);
  const canAllPhotos = canViewAllPhotosScope(currentUser);
  const myUid = currentUser?.uid || currentUser?.id || '';
  const staffList = canAllAtt ? getActiveStaffList() : getActiveStaffList().filter(u => (u.uid || u.id) === myUid);

  if (!OpsState.gpsDraft.staffId && staffList.length > 0) {
    OpsState.gpsDraft.staffId = myUid || staffList[0].uid || staffList[0].id;
  }
  if (!canAllAtt && myUid) {
    OpsState.gpsDraft.staffId = myUid;
  }

  const draft = OpsState.gpsDraft;
  const logs = getCombinedAttendancePhotos();
  const hasGps = Number.isFinite(draft.latitude) && Number.isFinite(draft.longitude) && !(draft.latitude === 0 && draft.longitude === 0);
  const hasLivePhoto = Boolean(draft.photoDataUrl && draft.photoCaptureMethod === 'LIVE_CAMERA');
  const isCameraOn = hasLiveMediaStream();
  const isAdminActor = isSuperAdmin(currentUser) || currentUser?.role === 'ADMIN';
  const canDeletePhoto = isAdminActor && canMenu('attendance-photo-gallery', 'delete');

  if (isCameraOn) {
    requestAnimationFrame(() => reattachActiveCameraStream());
  }

  return `
    ${embedded ? `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap; margin-bottom:1rem;">
        <div>
          <h3 style="margin:0; font-size:1.05rem;">Live GPS Location &amp; Camera Check-In</h3>
          <p style="margin:0.15rem 0 0 0; font-size:0.78rem; color:var(--text-muted);">Real-time Live Camera Selfie &amp; Live GPS Verification — Manual/Gallery File Upload is Strictly Disabled</p>
        </div>
        <span class="badge badge-success" style="font-size:0.72rem;">LIVE CAMERA + LIVE GPS ONLY</span>
      </div>
    ` : `
      <div class="page-header">
        <div>
          <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span>📍 GPS Location & Photo Attendance</span>
            <span class="badge badge-success" style="font-size:0.72rem;">LIVE CAMERA + LIVE GPS ONLY</span>
          </h2>
          <p class="page-subtitle">Real-time Live Camera Selfie & Live GPS Verification — Manual/Gallery File Upload is Strictly Disabled</p>
        </div>
        <div class="page-actions"></div>
      </div>
    `}

    <!-- Live Security Policy Strip -->
    <div class="card" style="padding:0.85rem 1.1rem; margin-bottom:1.15rem; background:linear-gradient(135deg, rgba(16,185,129,0.08), rgba(37,99,235,0.06)); border:1px solid rgba(16,185,129,0.3);">
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap:0.75rem; font-size:0.8rem;">
        <div style="display:flex; align-items:flex-start; gap:0.5rem;">
          <span style="font-size:1.1rem; line-height:1;">🚫</span>
          <div>
            <div style="font-weight:800; color:var(--text-primary);">১. নো ম্যানুয়াল আপলোড (No Gallery Upload)</div>
            <div style="color:var(--text-muted); font-size:0.74rem;">গ্যালারি বা ফাইল থেকে কোনো ছবি আপলোড সম্পূর্ণ বন্ধ।</div>
          </div>
        </div>
        <div style="display:flex; align-items:flex-start; gap:0.5rem;">
          <span style="font-size:1.1rem; line-height:1;">📷</span>
          <div>
            <div style="font-weight:800; color:var(--text-primary);">২. লাইভ ক্যামেরা (Live Camera Only)</div>
            <div style="color:var(--text-muted); font-size:0.74rem;">শুধুমাত্র Start Camera → Capture Photo দিয়ে রিয়েল-টাইম ছবি।</div>
          </div>
        </div>
        <div style="display:flex; align-items:flex-start; gap:0.5rem;">
          <span style="font-size:1.1rem; line-height:1;">🛰️</span>
          <div>
            <div style="font-weight:800; color:var(--text-primary);">৩. লাইভ জিপিএস ম্যাচ (Live GPS Match)</div>
            <div style="color:var(--text-muted); font-size:0.74rem;">সাবমিটের সময় বর্তমান Lat/Lng লাইভ GPS-এর সঙ্গে মিলিয়ে সেভ হবে।</div>
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 310px), 1fr)); gap:1.25rem; margin-bottom:1.5rem;">
      <!-- Left: Consent, Staff, In/Out & Live GPS -->
      <div class="card" style="padding:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
          <h3 style="margin:0; font-size:1.05rem;">1. Employee Consent & Live GPS Capture</h3>
          <span class="badge ${hasGps ? 'badge-success' : 'badge-warning'}" style="font-size:0.7rem;">
            ${hasGps ? '✓ GPS Locked' : '⏳ Waiting GPS'}
          </span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Select Staff Member *</label>
            <select id="gps-staff-select" class="form-control" ${canAllAtt ? '' : 'disabled'} onchange="window.MJK.updateGpsDraftField('staffId', this.value)">
              ${staffList.map(u => `<option value="${esc(u.uid || u.id)}" ${draft.staffId === (u.uid || u.id) ? 'selected' : ''}>${esc(u.name)} (${esc(u.uid || u.id)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Attendance Punch Type *</label>
            <select id="gps-event-type" class="form-control" onchange="window.MJK.updateGpsDraftField('eventType', this.value)">
              <option value="IN" ${draft.eventType === 'IN' ? 'selected' : ''}>🌅 Morning In-Time GPS + Photo</option>
              <option value="OUT" ${draft.eventType === 'OUT' ? 'selected' : ''}>🌙 Evening Out-Time GPS + Photo</option>
            </select>
          </div>
        </div>

        <label style="display:flex; align-items:flex-start; gap:0.55rem; padding:0.75rem; background:var(--info-bg); border:1px solid var(--info-border); border-radius:8px; margin-bottom:0.9rem; cursor:pointer; font-size:0.8rem;">
          <input type="checkbox" id="gps-consent-checkbox" ${draft.consentAccepted ? 'checked' : ''} onchange="window.MJK.updateGpsDraftField('consentAccepted', this.checked)" style="margin-top:0.2rem;">
          <span>
            <strong>কর্মীর সম্মতি / Employee Consent:</strong> GPS ও ক্যামেরার অনুমতি নিয়ে আমি স্বেচ্ছায় আমার বর্তমান লাইভ লোকেশন (Latitude/Longitude) ও লাইভ ক্যামেরার ছবি attendance verification-এর জন্য সংরক্ষণের সম্মতি দিচ্ছি।
          </span>
        </label>

        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.85rem;">
          <button type="button" class="btn btn-primary" onclick="window.MJK.captureLiveGpsLocation()">📍 ${hasGps ? 'Refresh Live GPS Location' : 'Capture Live GPS Location'}</button>
          ${hasGps ? `
            <a href="https://www.google.com/maps?q=${draft.latitude},${draft.longitude}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
              🗺️ Open Google Maps
            </a>
          ` : ''}
        </div>

        <div style="padding:0.8rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:8px; font-size:0.82rem; margin-bottom:0.85rem;">
          ${hasGps ? `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem;">
              <div><strong>Latitude:</strong> <span class="font-mono" style="color:var(--blue-600); font-weight:700;">${draft.latitude}</span></div>
              <div><strong>Longitude:</strong> <span class="font-mono" style="color:var(--blue-600); font-weight:700;">${draft.longitude}</span></div>
              <div><strong>Accuracy:</strong> ±${Math.round(draft.accuracy)}m</div>
              <div><strong>Captured (IST):</strong> ${esc(draft.capturedAt || 'Just now')}</div>
            </div>
          ` : `
            <div style="color:var(--text-muted);">No live GPS coordinates captured yet. Tick consent above and click "Capture Live GPS Location".</div>
          `}
        </div>

        ${hasGps ? `
          <div style="border-radius:8px; overflow:hidden; border:1px solid var(--border-subtle); height:190px;">
            <iframe
              title="Captured GPS Location"
              width="100%"
              height="190"
              style="border:0;"
              loading="lazy"
              src="https://maps.google.com/maps?q=${draft.latitude},${draft.longitude}&z=16&output=embed"
            ></iframe>
          </div>
        ` : ''}
      </div>

      <!-- Right: Live Camera Selfie Capture & Save (No Manual Upload) -->
      <div class="card" style="padding:1.25rem; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
            <h3 style="margin:0; font-size:1.05rem;">2. Live Camera Selfie Capture</h3>
            <span class="badge ${hasLivePhoto ? 'badge-success' : isCameraOn ? 'badge-info' : 'badge-warning'}" style="font-size:0.7rem;">
              ${hasLivePhoto ? '✓ Live Photo Ready' : isCameraOn ? '🔴 Camera Active' : '📷 Live Camera Only'}
            </span>
          </div>

          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.85rem; align-items:center;">
            <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.startAttendanceCamera()">📷 Start Camera</button>
            <button type="button" class="btn btn-success btn-sm" onclick="window.MJK.captureAttendanceSnapshot()">📸 Capture Photo</button>
            ${hasLivePhoto ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.retakeAttendancePhoto()">🔄 Retake Live Photo</button>` : ''}
            <span style="font-size:0.72rem; color:var(--danger); font-weight:700;">🚫 Gallery Upload Disabled</span>
          </div>

          <div class="erp-grid-2-tight" style="margin-bottom:0.85rem;">
            <div style="background:#0f172a; border-radius:8px; overflow:hidden; min-height:175px; display:flex; align-items:center; justify-content:center; position:relative;">
              <video id="gps-camera-video" autoplay playsinline muted style="width:100%; height:175px; object-fit:cover;"></video>
              <span id="gps-camera-placeholder" style="position:absolute; color:#94a3b8; font-size:0.75rem; text-align:center; padding:0.5rem; ${isCameraOn ? 'display:none;' : ''}">Click "Start Camera" for Live Feed</span>
            </div>
            <div style="background:var(--surface-alt); border:1px dashed var(--border-strong); border-radius:8px; overflow:hidden; min-height:175px; display:flex; align-items:center; justify-content:center; position:relative;">
              ${hasLivePhoto
                ? `<img src="${draft.photoDataUrl}" alt="Captured Live Staff Photo" style="width:100%; height:175px; object-fit:cover;">
                   <span class="badge badge-success" style="position:absolute; bottom:6px; right:6px; font-size:0.65rem;">LIVE CAMERA</span>`
                : `<span style="color:var(--text-muted); font-size:0.75rem; text-align:center; padding:0.5rem;">Live Captured Selfie Preview</span>`}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Location Note / Remarks (Optional)</label>
            <input type="text" id="gps-punch-notes" class="form-control" value="${esc(draft.notes)}" placeholder="e.g. MUN COMPUTER Main Counter / Field Visit" oninput="window.MJK.updateGpsDraftField('notes', this.value)">
          </div>
        </div>

        <button type="button" class="btn btn-success" ${draft.submitting ? 'disabled' : ''} style="width:100%; font-weight:800; padding:0.75rem;" onclick="window.MJK.submitGpsAttendancePunch()">
          ${draft.submitting
            ? '⏳ Verifying Live GPS & Saving Attendance...'
            : `✓ Verify Live GPS & Save ${draft.eventType === 'OUT' ? 'Out-Time' : 'In-Time'} Attendance`}
        </button>
      </div>
    </div>

    <!-- Attendance Location History -->
    <div class="table-card">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <h3 style="margin:0; font-size:1rem;">${canAllPhotos ? 'All Staff GPS + Photo History' : 'My GPS + Photo Attendance History'} (${logs.length} verified punches)</h3>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Staff Name & ID</th>
              <th>Punch Type</th>
              <th>Date & Time Stamp (IST)</th>
              <th>GPS Coordinates (Lat, Lng)</th>
              <th>Google Maps Mapping</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(g => {
              const imgUrl = getAttendancePhotoImageUrl(g, false);
              return `
                <tr>
                  <td>
                    ${imgUrl
                      ? `<img src="${imgUrl}" alt="${esc(g.staffName)}" style="width:46px; height:46px; object-fit:cover; border-radius:6px; border:1px solid var(--border-subtle);">`
                      : `<div style="width:46px; height:46px; border-radius:6px; background:var(--surface-alt); display:flex; align-items:center; justify-content:center;">👤</div>`}
                  </td>
                  <td>
                    <div style="font-weight:700;">${esc(g.staffName)}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted); font-family:monospace;">ID: ${esc(g.staffId || '-')}</div>
                    ${g.notes ? `<div style="font-size:0.7rem; color:var(--blue-600);">${esc(g.notes)}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge ${g.eventType === 'IN' ? 'badge-success' : 'badge-warning'}">
                      ${g.eventType === 'IN' ? '🌅 Morning In' : '🌙 Evening Out'}
                    </span>
                  </td>
                  <td class="tabular-nums" style="font-size:0.8rem;">${esc(g.istTimestamp || `${formatDate(g.date)} ${g.time12}`)}</td>
                  <td class="font-mono" style="font-size:0.78rem;">
                    <div>${g.latitude}, ${g.longitude}</div>
                    <div style="font-size:0.68rem; color:var(--text-muted);">Accuracy: ±${Math.round(g.accuracy || 0)}m</div>
                  </td>
                  <td>
                    <a href="https://www.google.com/maps?q=${g.latitude},${g.longitude}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">🗺️ Google Maps</a>
                  </td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.printAttendancePhoto('${esc(g.id)}')" title="Print Photo & Location">🖨</button>
                    ${canDeletePhoto ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteGpsLog('${esc(g.id)}')" title="Admin Delete with Reason">🗑</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('') || `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No GPS + Photo punches recorded yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   7. STAFF PHOTO & LOCATION MAPPING VIEW
   ========================================================================= */
export function renderStaffLocationMapView({ embedded = false } = {}) {
  ensureOpsHydration('photos', () => window.MJK?.renderApp?.());
  const currentUser = getCurrentUser();
  const canAllPhotos = canViewAllPhotosScope(currentUser);
  const myUid = currentUser?.uid || currentUser?.id || '';
  const staffList = canAllPhotos ? getActiveStaffList() : getActiveStaffList().filter(u => (u.uid || u.id) === myUid);

  const logs = getCombinedAttendancePhotos().filter(g => {
    const matchStaff = !canAllPhotos || OpsState.mapFilterStaff === 'all' || g.staffId === OpsState.mapFilterStaff;
    const matchDate = !OpsState.mapFilterDate || g.date === OpsState.mapFilterDate;
    const matchEvt = OpsState.mapFilterEvent === 'ALL' || g.eventType === OpsState.mapFilterEvent;
    return matchStaff && matchDate && matchEvt;
  });

  const selected = logs.find(l => l.id === OpsState.selectedGpsLogId) || logs[0] || null;
  const selectedImg = getAttendancePhotoImageUrl(selected, false);

  return `
    ${embedded ? `
      <div style="margin-bottom:1rem;">
        <h3 style="margin:0; font-size:1.05rem;">Staff Photo &amp; GPS Location Mapping</h3>
        <p style="margin:0.15rem 0 0 0; font-size:0.78rem; color:var(--text-muted);">Visual verification of employee In-Time / Out-Time selfies paired with live Google Maps coordinates</p>
      </div>
    ` : `
      <div class="page-header">
        <div>
          <h2 class="page-title">🗺️ Staff Photo & Location Mapping</h2>
          <p class="page-subtitle">Visual verification of employee In-Time / Out-Time selfies paired with live Google Maps coordinates</p>
        </div>
        <div class="page-actions"></div>
      </div>
    `}

    <div class="card" style="padding:0.9rem 1.1rem; margin-bottom:1.15rem;">
      <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:flex-end;">
        <div>
          <label class="form-label" style="font-size:0.75rem;">Filter Date</label>
          <input type="date" class="form-control" value="${esc(OpsState.mapFilterDate)}" onchange="window.MJK.setOpsMapFilter('date', this.value)">
        </div>
        ${canAllPhotos ? `
          <div>
            <label class="form-label" style="font-size:0.75rem;">Staff Member</label>
            <select class="form-control" onchange="window.MJK.setOpsMapFilter('staff', this.value)">
              <option value="all" ${OpsState.mapFilterStaff === 'all' ? 'selected' : ''}>All Staff</option>
              ${staffList.map(u => `<option value="${esc(u.uid || u.id)}" ${OpsState.mapFilterStaff === (u.uid || u.id) ? 'selected' : ''}>${esc(u.name)} (${esc(u.uid || u.id)})</option>`).join('')}
            </select>
          </div>
        ` : ''}
        <div>
          <label class="form-label" style="font-size:0.75rem;">Punch Type</label>
          <select class="form-control" onchange="window.MJK.setOpsMapFilter('event', this.value)">
            <option value="ALL" ${OpsState.mapFilterEvent === 'ALL' ? 'selected' : ''}>All Punches</option>
            <option value="IN" ${OpsState.mapFilterEvent === 'IN' ? 'selected' : ''}>Morning In-Time Only</option>
            <option value="OUT" ${OpsState.mapFilterEvent === 'OUT' ? 'selected' : ''}>Evening Out-Time Only</option>
          </select>
        </div>
        ${OpsState.mapFilterDate ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.setOpsMapFilter('date', '')">Clear Date</button>` : ''}
      </div>
    </div>

    ${selected ? `
      <div class="card" style="padding:1rem; margin-bottom:1.25rem; display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap:1rem; align-items:center;">
        <div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
          ${selectedImg
            ? `<img src="${selectedImg}" alt="${esc(selected.staffName)}" style="width:104px; height:104px; object-fit:cover; border-radius:10px; border:2px solid var(--blue-600);">`
            : `<div style="width:104px; height:104px; border-radius:10px; background:var(--surface-alt); display:flex; align-items:center; justify-content:center; font-size:2rem;">👤</div>`}
          <div style="min-width:0; flex:1 1 180px;">
            <span class="badge ${selected.eventType === 'IN' ? 'badge-success' : 'badge-warning'}">${selected.eventType === 'IN' ? '🌅 Morning In Pin' : '🌙 Evening Out Pin'}</span>
            <h3 style="margin:0.35rem 0 0.15rem 0; font-size:1.1rem;">${esc(selected.staffName)}</h3>
            <div class="font-mono" style="font-size:0.74rem; color:var(--text-muted); margin-bottom:0.2rem;">Employee ID: <strong>${esc(selected.staffId || '-')}</strong></div>
            <div style="font-size:0.8rem; color:var(--text-muted);">${esc(selected.istTimestamp)}</div>
            <div class="font-mono" style="font-size:0.78rem; color:var(--blue-600); font-weight:700; margin-top:0.25rem;">
              Lat: ${selected.latitude} · Lng: ${selected.longitude}
            </div>
            <div style="margin-top:0.5rem; display:flex; gap:0.4rem; flex-wrap:wrap;">
              <a href="https://www.google.com/maps?q=${selected.latitude},${selected.longitude}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
                🗺️ Google Maps
              </a>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.downloadAttendancePhoto('${esc(selected.id)}')">⬇ Download</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printAttendancePhoto('${esc(selected.id)}')">🖨 Print</button>
            </div>
          </div>
        </div>
        <div style="border-radius:8px; overflow:hidden; border:1px solid var(--border-subtle); height:230px;">
          <iframe
            title="Selected Staff Map Pin"
            width="100%"
            height="230"
            style="border:0;"
            loading="lazy"
            src="https://maps.google.com/maps?q=${selected.latitude},${selected.longitude}&z=16&output=embed"
          ></iframe>
        </div>
      </div>
    ` : ''}

    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 245px), 1fr)); gap:1rem;">
      ${logs.map(g => {
        const thumbUrl = getAttendancePhotoImageUrl(g, false);
        return `
          <div class="card" style="padding:0.85rem; cursor:pointer; border:${selected?.id === g.id ? '2px solid var(--blue-600)' : '1px solid var(--border-subtle)'};" onclick="window.MJK.selectStaffLocationPin('${esc(g.id)}')">
            <div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:0.6rem;">
              ${thumbUrl
                ? `<img src="${thumbUrl}" alt="${esc(g.staffName)}" style="width:54px; height:54px; object-fit:cover; border-radius:8px;">`
                : `<div style="width:54px; height:54px; border-radius:8px; background:var(--surface-alt); display:flex; align-items:center; justify-content:center;">👤</div>`}
              <div style="min-width:0;">
                <div style="font-weight:700; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(g.staffName)}</div>
                <div class="font-mono" style="font-size:0.68rem; color:var(--text-muted);">${esc(g.staffId || '-')}</div>
                <span class="badge ${g.eventType === 'IN' ? 'badge-success' : 'badge-warning'}" style="font-size:0.68rem;">${g.eventType === 'IN' ? 'In-Time' : 'Out-Time'} · ${esc(g.time12)}</span>
              </div>
            </div>
            <div style="font-size:0.76rem; color:var(--text-muted); margin-bottom:0.35rem;">📅 ${formatDate(g.date)} · ±${Math.round(g.accuracy || 0)}m</div>
            <div class="font-mono" style="font-size:0.74rem; color:var(--blue-600); font-weight:600; margin-bottom:0.55rem;">📍 ${g.latitude}, ${g.longitude}</div>
            <a href="https://www.google.com/maps?q=${g.latitude},${g.longitude}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="width:100%;" onclick="event.stopPropagation()">🗺️ Google Maps</a>
          </div>
        `;
      }).join('') || `
        <div class="card" style="grid-column:1/-1; padding:2.5rem; text-align:center; color:var(--text-muted);">
          No GPS + Photo location punches match the current filter.
        </div>
      `}
    </div>
  `;
}

/* =========================================================================
   7B. MANDATORY ATTENDANCE PHOTO GALLERY & ADMIN VERIFICATION VIEW
   ========================================================================= */
export function renderAttendancePhotoGalleryView({ embedded = false } = {}) {
  ensureOpsHydration('photos', () => window.MJK?.renderApp?.());
  const currentUser = getCurrentUser();
  const isAdminActor = isSuperAdmin(currentUser) || currentUser?.role === 'ADMIN';
  const canAllPhotos = canViewAllPhotosScope(currentUser);
  const canVerify = isAdminActor || (canAllPhotos && canMenu('attendance-photo-gallery', 'approve'));
  const canDeletePhoto = isAdminActor && canMenu('attendance-photo-gallery', 'delete');
  const canPrint = canMenu('attendance-photo-gallery', 'print') || isAdminActor;
  const myUid = currentUser?.uid || currentUser?.id || '';
  const staffList = canAllPhotos ? getActiveStaffList() : getActiveStaffList().filter(u => (u.uid || u.id) === myUid);

  const allPhotos = getCombinedAttendancePhotos();
  const q = (OpsState.photoSearchQuery || '').trim().toLowerCase();

  const filtered = allPhotos.filter(p => {
    if (OpsState.photoDateFilter && p.date !== OpsState.photoDateFilter) return false;
    if (OpsState.photoFromDate && p.date < OpsState.photoFromDate) return false;
    if (OpsState.photoToDate && p.date > OpsState.photoToDate) return false;
    if (canAllPhotos && OpsState.photoStaffFilter !== 'all' && p.staffId !== OpsState.photoStaffFilter) return false;
    if (OpsState.photoEventFilter !== 'ALL' && p.eventType !== OpsState.photoEventFilter) return false;
    if (OpsState.photoVerifyFilter !== 'ALL' && (p.verificationStatus || 'PENDING') !== OpsState.photoVerifyFilter) return false;
    if (q) {
      const hay = `${p.staffName || ''} ${p.staffId || ''} ${p.notes || ''} ${p.date || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const morningCount = allPhotos.filter(p => p.eventType === 'IN').length;
  const eveningCount = allPhotos.filter(p => p.eventType === 'OUT').length;
  const verifiedCount = allPhotos.filter(p => p.verificationStatus === 'VERIFIED').length;
  const pendingCount = allPhotos.filter(p => !p.verificationStatus || p.verificationStatus === 'PENDING').length;

  return `
    ${embedded ? `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap; margin-bottom:1rem;">
        <div>
          <h3 style="margin:0; font-size:1.05rem;">Verified Attendance Photo Gallery</h3>
          <p style="margin:0.15rem 0 0 0; font-size:0.78rem; color:var(--text-muted);">
            ${canAllPhotos ? 'Morning In & Evening Out photos, GPS coordinates, verification, download, print & Administrator-only delete' : 'Your Morning In & Evening Out attendance photos with GPS verification'}
          </p>
        </div>
        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
          <span class="badge ${canAllPhotos ? 'badge-success' : 'badge-info'}" style="font-size:0.72rem;">
            ${canAllPhotos ? 'ALL STAFF PHOTOS' : 'MY ATTENDANCE PHOTOS ONLY'}
          </span>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.refreshAttendancePhotoGallery()">🔄 Refresh Gallery</button>
        </div>
      </div>
    ` : `
      <div class="page-header">
        <div>
          <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span>📸 Attendance Photo Gallery & Verification</span>
            <span class="badge ${canAllPhotos ? 'badge-success' : 'badge-info'}" style="font-size:0.72rem;">
              ${canAllPhotos ? 'ALL STAFF PHOTOS' : 'MY ATTENDANCE PHOTOS ONLY'}
            </span>
          </h2>
          <p class="page-subtitle">
            ${canAllPhotos
              ? 'Morning In & Evening Out Selfie Photos, GPS Location, Google Maps, Download, Print, Verification & Administrator-Only Delete (with mandatory Reason)'
              : 'Your own Morning In & Evening Out attendance photos with GPS coordinates, Download & Print.'}
          </p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.refreshAttendancePhotoGallery()">🔄 Refresh Gallery</button>
        </div>
      </div>
    `}

    <!-- Summary KPI Strip -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:0.85rem; margin-bottom:1.15rem;">
      <div class="stat-card"><div class="stat-label">Total Photos</div><div class="stat-value tabular-nums">${allPhotos.length}</div></div>
      <div class="stat-card"><div class="stat-label">🌅 Morning In Photos</div><div class="stat-value tabular-nums" style="color:var(--success);">${morningCount}</div></div>
      <div class="stat-card"><div class="stat-label">🌙 Evening Out Photos</div><div class="stat-value tabular-nums" style="color:var(--warning);">${eveningCount}</div></div>
      <div class="stat-card"><div class="stat-label">✓ Verified</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${verifiedCount}</div></div>
      <div class="stat-card"><div class="stat-label">⏳ Pending Verify</div><div class="stat-value tabular-nums">${pendingCount}</div></div>
    </div>

    <!-- Search & Filter Bar -->
    <div class="card" style="padding:0.9rem 1.1rem; margin-bottom:1.15rem;">
      <div style="display:flex; gap:0.65rem; flex-wrap:wrap; align-items:flex-end;">
        <div style="flex:1; min-width:min(100%, 190px);">
          <label class="form-label" style="font-size:0.75rem;">Search Staff Name / Employee ID</label>
          <input type="text" class="form-control" placeholder="Search name, MUNCOMPUTER-ST-..., note..." value="${esc(OpsState.photoSearchQuery)}" oninput="window.MJK.setOpsPhotoFilter('search', this.value)">
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">Exact Date</label>
          <input type="date" class="form-control" value="${esc(OpsState.photoDateFilter)}" onchange="window.MJK.setOpsPhotoFilter('date', this.value)">
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">History From</label>
          <input type="date" class="form-control" value="${esc(OpsState.photoFromDate)}" onchange="window.MJK.setOpsPhotoFilter('from', this.value)">
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">History To</label>
          <input type="date" class="form-control" value="${esc(OpsState.photoToDate)}" onchange="window.MJK.setOpsPhotoFilter('to', this.value)">
        </div>
        ${canAllPhotos ? `
          <div>
            <label class="form-label" style="font-size:0.75rem;">Staff Member</label>
            <select class="form-control" onchange="window.MJK.setOpsPhotoFilter('staff', this.value)">
              <option value="all" ${OpsState.photoStaffFilter === 'all' ? 'selected' : ''}>All Staff (${staffList.length})</option>
              ${staffList.map(u => `<option value="${esc(u.uid || u.id)}" ${OpsState.photoStaffFilter === (u.uid || u.id) ? 'selected' : ''}>${esc(u.name)} (${esc(u.uid || u.id)})</option>`).join('')}
            </select>
          </div>
        ` : ''}
        <div>
          <label class="form-label" style="font-size:0.75rem;">Shift Punch</label>
          <select class="form-control" onchange="window.MJK.setOpsPhotoFilter('event', this.value)">
            <option value="ALL" ${OpsState.photoEventFilter === 'ALL' ? 'selected' : ''}>All (In & Out)</option>
            <option value="IN" ${OpsState.photoEventFilter === 'IN' ? 'selected' : ''}>🌅 Morning In Only</option>
            <option value="OUT" ${OpsState.photoEventFilter === 'OUT' ? 'selected' : ''}>🌙 Evening Out Only</option>
          </select>
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">Verification</label>
          <select class="form-control" onchange="window.MJK.setOpsPhotoFilter('verify', this.value)">
            <option value="ALL" ${OpsState.photoVerifyFilter === 'ALL' ? 'selected' : ''}>All Status</option>
            <option value="VERIFIED" ${OpsState.photoVerifyFilter === 'VERIFIED' ? 'selected' : ''}>✓ Verified</option>
            <option value="PENDING" ${OpsState.photoVerifyFilter === 'PENDING' ? 'selected' : ''}>⏳ Pending</option>
            <option value="FLAGGED" ${OpsState.photoVerifyFilter === 'FLAGGED' ? 'selected' : ''}>⚠ Flagged</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.resetOpsPhotoFilters()">Clear Filters</button>
      </div>
    </div>

    <!-- Photo Gallery Grid -->
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap:1rem; margin-bottom:1.5rem;">
      ${filtered.map(p => {
        const imgUrl = getAttendancePhotoImageUrl(p, false);
        const vStatus = p.verificationStatus || 'PENDING';
        const vBadge = vStatus === 'VERIFIED' ? 'badge-success' : vStatus === 'FLAGGED' ? 'badge-danger' : 'badge-warning';
        return `
          <div class="card" style="overflow:hidden; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="position:relative; height:210px; background:#0f172a;">
                ${imgUrl
                  ? `<img src="${imgUrl}" alt="${esc(p.staffName)}" style="width:100%; height:210px; object-fit:cover;">`
                  : `<div style="height:210px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:2.5rem;">📷</div>`}
                <span class="badge ${p.eventType === 'IN' ? 'badge-success' : 'badge-warning'}" style="position:absolute; top:10px; left:10px;">
                  ${p.eventType === 'IN' ? '🌅 Morning In' : '🌙 Evening Out'}
                </span>
                <span class="badge ${vBadge}" style="position:absolute; top:10px; right:10px;">
                  ${vStatus === 'VERIFIED' ? '✓ Verified' : vStatus === 'FLAGGED' ? '⚠ Flagged' : '⏳ Pending'}
                </span>
              </div>
              <div style="padding:0.9rem 1rem;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
                  <div>
                    <div style="font-weight:800; font-size:0.98rem;">${esc(p.staffName)}</div>
                    <div class="font-mono" style="font-size:0.72rem; color:var(--blue-600); font-weight:700;">ID: ${esc(p.staffId || '-')}</div>
                  </div>
                  <span class="badge badge-neutral" style="font-size:0.68rem;">${esc(p.role || 'Staff')}</span>
                </div>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.45rem;">
                  🕒 ${esc(p.istTimestamp || `${formatDate(p.date)} ${p.time12 || ''}`)}
                </div>
                <div class="font-mono" style="font-size:0.75rem; color:var(--text-main); margin-top:0.25rem;">
                  📍 ${p.latitude}, ${p.longitude} <span style="color:var(--text-muted);">(±${Math.round(p.accuracy || 0)}m)</span>
                </div>
                ${p.notes ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">📝 ${esc(p.notes)}</div>` : ''}
                ${p.verifiedByName ? `<div style="font-size:0.7rem; color:var(--success); margin-top:0.25rem;">✓ Verified by ${esc(p.verifiedByName)}</div>` : ''}
              </div>
            </div>
            <div style="padding:0.75rem 1rem; border-top:1px solid var(--border-subtle); background:var(--surface-alt); display:flex; gap:0.35rem; flex-wrap:wrap;">
              <a href="https://www.google.com/maps?q=${p.latitude},${p.longitude}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">🗺️ Maps</a>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.downloadAttendancePhoto('${esc(p.id)}')">⬇ Download</button>
              ${canPrint ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printAttendancePhoto('${esc(p.id)}')">🖨 Print</button>` : ''}
              ${canVerify && vStatus !== 'VERIFIED' ? `<button type="button" class="btn btn-success btn-sm" onclick="window.MJK.handleVerifyAttendancePhoto('${esc(p.id)}', 'VERIFIED')">✓ Verify</button>` : ''}
              ${canVerify && vStatus !== 'FLAGGED' ? `<button type="button" class="btn btn-warning btn-sm" onclick="window.MJK.handleVerifyAttendancePhoto('${esc(p.id)}', 'FLAGGED')">⚠ Flag</button>` : ''}
              ${canDeletePhoto ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.promptDeleteGpsLog('${esc(p.id)}')">🗑 Delete</button>` : ''}
            </div>
          </div>
        `;
      }).join('') || `
        <div class="card" style="grid-column:1/-1; padding:2.5rem; text-align:center; color:var(--text-muted);">
          No attendance photos match your search filters yet. Capture a Morning In or Evening Out photo in GPS Attendance!
        </div>
      `}
    </div>

    <!-- Previous Photo History Table -->
    <div class="table-card">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <h3 style="margin:0; font-size:1rem;">Previous Photo History Ledger (${filtered.length} records)</h3>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Employee ID & Name</th>
              <th>Shift Punch</th>
              <th>Date & Time (IST)</th>
              <th>GPS & Map</th>
              <th>Verification</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(p => {
              const imgUrl = getAttendancePhotoImageUrl(p, false);
              const vStatus = p.verificationStatus || 'PENDING';
              return `
                <tr>
                  <td>${imgUrl ? `<img src="${imgUrl}" alt="${esc(p.staffName)}" style="width:42px; height:42px; object-fit:cover; border-radius:6px;">` : '👤'}</td>
                  <td>
                    <div style="font-weight:700;">${esc(p.staffName)}</div>
                    <div class="font-mono" style="font-size:0.7rem; color:var(--text-muted);">${esc(p.staffId || '-')}</div>
                  </td>
                  <td><span class="badge ${p.eventType === 'IN' ? 'badge-success' : 'badge-warning'}">${p.eventType === 'IN' ? 'Morning In' : 'Evening Out'}</span></td>
                  <td class="tabular-nums" style="font-size:0.8rem;">${esc(p.istTimestamp || `${formatDate(p.date)} ${p.time12 || ''}`)}</td>
                  <td class="font-mono" style="font-size:0.74rem;">
                    <a href="https://www.google.com/maps?q=${p.latitude},${p.longitude}" target="_blank" rel="noopener noreferrer">${p.latitude}, ${p.longitude}</a>
                  </td>
                  <td><span class="badge ${vStatus === 'VERIFIED' ? 'badge-success' : vStatus === 'FLAGGED' ? 'badge-danger' : 'badge-warning'}">${esc(vStatus)}</span></td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.downloadAttendancePhoto('${esc(p.id)}')">⬇</button>
                    ${canPrint ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printAttendancePhoto('${esc(p.id)}')">🖨</button>` : ''}
                    ${canDeletePhoto ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteGpsLog('${esc(p.id)}')">🗑</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('') || `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No previous photo history available.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   8. ATTENDANCE REPORTS VIEW
   ========================================================================= */
export function renderAttendanceReportsView() {
  ensureOpsHydration('attendance', () => window.MJK?.renderApp?.());
  const currentUser = getCurrentUser();
  const canAll = canViewAllAttendanceScope(currentUser);
  const myUid = currentUser?.uid || currentUser?.id || '';
  const month = OpsState.attReportMonth || getTodayDate().slice(0, 7);
  const staffFilter = canAll ? (OpsState.attReportStaff || 'all') : myUid;
  const staffList = canAll ? getActiveStaffList() : getActiveStaffList().filter(u => (u.uid || u.id) === myUid);
  const report = getMonthlyAttendanceReport(month, staffFilter);
  const canExport = canMenu('attendance-reports', 'export');
  const canPrint = canMenu('attendance-reports', 'print');

  const totals = report.staffRows.reduce((acc, s) => {
    acc.present += s.presentDays;
    acc.absent += s.absentDays;
    acc.leave += s.leaveDays;
    acc.late += s.lateDays;
    acc.workMins += s.totalWorkingMinutes;
    acc.otMins += s.totalOvertimeMinutes;
    acc.gps += s.gpsPunches;
    return acc;
  }, { present: 0, absent: 0, leave: 0, late: 0, workMins: 0, otMins: 0, gps: 0 });

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">📊 ${canAll ? 'Monthly Attendance & Performance Reports' : 'My Monthly Attendance Report'}</h2>
        <p class="page-subtitle">Monthly Staff Attendance Summary, Working Hours, Late Entry, Overtime & GPS Punch Analytics</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        ${canPrint ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.printMonthlyAttendanceReport()">🖨 Print</button>` : ''}
        ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAttendanceReportPdf()">📄 PDF</button>` : ''}
        ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAttendanceReportExcel()">📊 Excel</button>` : ''}
        ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportAttendanceReportCsv()">📄 CSV</button>` : ''}
      </div>
    </div>

    <div class="card" style="padding:0.9rem 1.1rem; margin-bottom:1.15rem;">
      <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:flex-end;">
        <div>
          <label class="form-label" style="font-size:0.75rem;">Select Month</label>
          <input type="month" class="form-control" value="${esc(month)}" onchange="window.MJK.setOpsAttReportFilter('month', this.value)">
        </div>
        ${canAll ? `
          <div>
            <label class="form-label" style="font-size:0.75rem;">Filter Staff</label>
            <select class="form-control" onchange="window.MJK.setOpsAttReportFilter('staff', this.value)">
              <option value="all" ${staffFilter === 'all' ? 'selected' : ''}>All Staff Members</option>
              ${staffList.map(u => `<option value="${esc(u.uid || u.id)}" ${staffFilter === (u.uid || u.id) ? 'selected' : ''}>${esc(u.name)} (${esc(u.uid || u.id)})</option>`).join('')}
            </select>
          </div>
        ` : ''}
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:0.85rem; margin-bottom:1.25rem;">
      <div class="stat-card"><div class="stat-label">Total Present</div><div class="stat-value tabular-nums" style="color:var(--success);">${totals.present}</div></div>
      <div class="stat-card"><div class="stat-label">Absent / Leave</div><div class="stat-value tabular-nums" style="color:var(--danger);">${totals.absent} / ${totals.leave}</div></div>
      <div class="stat-card"><div class="stat-label">Late Entries</div><div class="stat-value tabular-nums" style="color:var(--warning);">${totals.late}</div></div>
      <div class="stat-card"><div class="stat-label">Total Work Hours</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${formatMinutesAsDuration(totals.workMins)}</div></div>
      <div class="stat-card"><div class="stat-label">Overtime Hours</div><div class="stat-value tabular-nums" style="color:var(--info);">${formatMinutesAsDuration(totals.otMins)}</div></div>
      <div class="stat-card"><div class="stat-label">GPS Punches</div><div class="stat-value tabular-nums">${totals.gps}</div></div>
    </div>

    <div class="table-card">
      <div class="table-toolbar"><h3 style="margin:0; font-size:1rem;">Staff Performance Matrix (${esc(month)})</h3></div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff Name & ID</th>
              <th>Present</th>
              <th>Half Day</th>
              <th>Absent</th>
              <th>Leave</th>
              <th>Late Days</th>
              <th>Working Hrs</th>
              <th>Overtime</th>
              <th>GPS Punches</th>
              <th>On-Time %</th>
            </tr>
          </thead>
          <tbody>
            ${report.staffRows.map(s => `
              <tr>
                <td>
                  <div style="font-weight:700;">${esc(s.staffName)}</div>
                  <div style="font-size:0.72rem; color:var(--text-muted); font-family:monospace;">${esc(s.staffId)} · ${esc(s.role)}</div>
                </td>
                <td class="tabular-nums" style="font-weight:700; color:var(--success);">${s.presentDays}</td>
                <td class="tabular-nums">${s.halfDays}</td>
                <td class="tabular-nums" style="color:var(--danger);">${s.absentDays}</td>
                <td class="tabular-nums">${s.leaveDays}</td>
                <td class="tabular-nums" style="color:var(--warning); font-weight:700;">${s.lateDays}</td>
                <td class="tabular-nums" style="font-weight:700;">${esc(s.totalWorkingLabel)}</td>
                <td class="tabular-nums" style="color:var(--blue-600); font-weight:700;">${esc(s.totalOvertimeLabel)}</td>
                <td class="tabular-nums">${s.gpsPunches}</td>
                <td><span class="badge ${s.onTimePct >= 85 ? 'badge-success' : 'badge-warning'}">${s.onTimePct}%</span></td>
              </tr>
            `).join('') || `<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted);">No attendance records found for ${esc(month)}.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   9. CASH REPORTS VIEW
   ========================================================================= */
export function renderCashReportsView() {
  const fromDate = OpsState.cashReportFrom || `${getTodayDate().slice(0, 7)}-01`;
  const toDate = OpsState.cashReportTo || getTodayDate();
  const q = OpsState.cashReportQuery || '';

  const rows = getCombinedCashRowsForDateRange(fromDate, toDate, q);
  const summary = rows.reduce((acc, r) => {
    if (r.type === 'CASH_RECEIVED') acc.received += r.amount;
    else if (r.type === 'CASH_PAYMENT') acc.payment += r.amount;
    else if (r.type === 'CASH_DEPOSIT') acc.deposit += r.amount;
    else if (r.type === 'CASH_WITHDRAWAL') acc.withdrawal += r.amount;
    return acc;
  }, { received: 0, payment: 0, deposit: 0, withdrawal: 0 });

  const netDrawer = (summary.received + summary.withdrawal) - (summary.payment + summary.deposit);

  const dailySnapshots = getAllDaybookEntries()
    .filter(e => e.date >= fromDate && e.date <= toDate)
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">📑 Counter Cash Reports & Date-wise Search</h2>
        <p class="page-subtitle">Date-range cash flow report for Opening Cash, Cash Received, Cash Payment, Deposit, Withdrawal & Closing Cash</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.printCashRangeReport()">🖨 Print</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportCashRangePdf()">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportCashRangeExcel()">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportCashRangeCsv()">📄 CSV</button>
      </div>
    </div>

    <div class="card" style="padding:0.9rem 1.1rem; margin-bottom:1.15rem;">
      <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:flex-end;">
        <div>
          <label class="form-label" style="font-size:0.75rem;">From Date</label>
          <input type="date" class="form-control" value="${esc(fromDate)}" onchange="window.MJK.setOpsCashReportFilter('from', this.value)">
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">To Date</label>
          <input type="date" class="form-control" value="${esc(toDate)}" onchange="window.MJK.setOpsCashReportFilter('to', this.value)">
        </div>
        <div style="flex:1; min-width:min(100%, 200px);">
          <label class="form-label" style="font-size:0.75rem;">Search Keyword / Party / Ref</label>
          <input type="text" class="form-control" placeholder="Search cash entries..." value="${esc(q)}" oninput="window.MJK.setOpsCashReportFilter('query', this.value)">
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.85rem; margin-bottom:1.25rem;">
      <div class="stat-card a4-avoid-break"><div class="stat-label">Total Cash Received</div><div class="stat-value tabular-nums" style="color:var(--success);">+${formatINR(summary.received)}</div><div class="amount-words-hint" style="color:var(--text-main);">${esc(numberToWords(summary.received))}</div></div>
      <div class="stat-card a4-avoid-break"><div class="stat-label">Total Cash Payment</div><div class="stat-value tabular-nums" style="color:var(--danger);">-${formatINR(summary.payment)}</div><div class="amount-words-hint" style="color:var(--text-main);">${esc(numberToWords(summary.payment))}</div></div>
      <div class="stat-card a4-avoid-break"><div class="stat-label">Total Cash Deposit</div><div class="stat-value tabular-nums" style="color:var(--warning);">-${formatINR(summary.deposit)}</div><div class="amount-words-hint" style="color:var(--text-main);">${esc(numberToWords(summary.deposit))}</div></div>
      <div class="stat-card a4-avoid-break"><div class="stat-label">Total Cash Withdrawal</div><div class="stat-value tabular-nums" style="color:var(--info);">+${formatINR(summary.withdrawal)}</div><div class="amount-words-hint" style="color:var(--text-main);">${esc(numberToWords(summary.withdrawal))}</div></div>
      <div class="stat-card a4-avoid-break"><div class="stat-label">Net Drawer Flow</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${formatINR(netDrawer)}</div><div class="amount-words-hint" style="color:var(--text-main);">${esc(numberToWords(netDrawer))}</div></div>
    </div>

    <!-- Saved Daybook Daily Snapshots -->
    <div class="table-card" style="margin-bottom:1.25rem;">
      <div class="table-toolbar"><h3 style="margin:0; font-size:1rem;">Daily Opening & Closing Cash Summary (${dailySnapshots.length} days)</h3></div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Prev Day Bal</th>
              <th>Opening Cash</th>
              <th>Cash Received</th>
              <th>Cash Payment</th>
              <th>Deposit / Withdrawal</th>
              <th>Closing Cash</th>
              <th>Status</th>
              <th style="text-align:right;">Denomination</th>
            </tr>
          </thead>
          <tbody>
            ${dailySnapshots.map(d => `
              <tr>
                <td class="date tabular-nums" style="font-weight:700;">${formatDate(d.date)}</td>
                <td class="tabular-nums">${formatINR(d.previousDayBalance || 0)}</td>
                <td class="tabular-nums">${formatINR(d.openingCash || 0)}</td>
                <td class="tabular-nums" style="color:var(--success);">+${formatINR(d.cashReceived ?? d.serviceCashIn ?? 0)}</td>
                <td class="tabular-nums" style="color:var(--danger);">-${formatINR(d.cashPayment ?? d.cashExpenses ?? 0)}</td>
                <td class="tabular-nums" style="font-size:0.78rem;">Dep: ${formatINR(d.cashDeposit || 0)} · Wdr: ${formatINR(d.cashWithdrawal || 0)}</td>
                <td class="tabular-nums" style="font-weight:800; color:var(--blue-600);">${formatINR(d.closingCash ?? d.countedPhysicalCash ?? 0)}</td>
                <td><span class="badge ${d.status === 'Balanced' ? 'badge-success' : 'badge-info'}">${esc(d.status || 'Saved')}</span></td>
                <td style="text-align:right; white-space:nowrap;">
                  <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.setCashReportDenomDate('${esc(d.date)}')">View</button>
                  <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printDenominationReport('${esc(d.date)}', false)">🖨 Sheet</button>
                </td>
              </tr>
            `).join('') || `<tr><td colspan="9" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No saved opening/closing snapshots in this date range.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Selected Date Denomination Breakdown -->
    <div style="margin-bottom:0.5rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
      <div style="font-size:0.82rem; font-weight:700; color:var(--text-muted);">Selected Date for Denomination Breakdown:</div>
      <input type="date" class="form-control" style="width:auto;" value="${esc(OpsState.cashReportDenomDate || toDate)}" onchange="window.MJK.setCashReportDenomDate(this.value)">
    </div>
    ${renderDenominationComparisonTableHtml(calculateDayTally(OpsState.cashReportDenomDate || toDate), { showActions: true, date: OpsState.cashReportDenomDate || toDate })}

    <!-- All Cash Transactions in Range -->
    <div class="table-card">
      <div class="table-toolbar"><h3 style="margin:0; font-size:1rem;">Detailed Cash Transaction Report (${rows.length} entries)</h3></div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ref ID</th>
              <th>Date</th>
              <th>Type</th>
              <th>Party / Description</th>
              <th>Remarks</th>
              <th style="text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="code tabular-nums">${esc(r.id)}</td>
                <td class="date tabular-nums">${formatDate(r.date)}</td>
                <td>${getTxnBadge(r.type)}</td>
                <td style="font-weight:600;">${esc(r.partyName)}</td>
                <td style="font-size:0.8rem; color:var(--text-muted);">${esc(r.notes || r.reference || '-')}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700;">${formatINR(r.amount)}</td>
              </tr>
            `).join('') || `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No cash transactions found for this range.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* =========================================================================
   INTERACTIVE HANDLERS FOR ALL 9 OPERATIONS MODULES
   ========================================================================= */
export function createOperationsHandlers({ showToast, openModal, closeModal, showConfirmDialog, render }) {
  const sumDenom = (prefix) => {
    const val = (id) => Math.max(0, Math.floor(Number(document.getElementById(id)?.value) || 0));
    const denominations = {};
    let total = 0;

    DENOMINATION_SPEC.forEach(spec => {
      const qty = val(`${prefix}-${spec.key}`);
      const sub = qty * spec.value;
      denominations[spec.key] = qty;
      total += sub;

      const subEl = document.getElementById(`${prefix}-sub-${spec.key}`);
      if (subEl) {
        subEl.textContent = sub > 0 ? formatINR(sub) : '—';
        subEl.style.color = sub > 0 ? (prefix === 'op' ? 'var(--blue-600)' : 'var(--success)') : 'var(--text-muted)';
      }
    });

    const totalEl = document.getElementById(`${prefix}-denom-total`);
    if (totalEl) totalEl.textContent = formatINR(total);

    return { total, denominations };
  };

  return {
    stopActiveAttendanceCamera,

    setOpsDaybookDate: (date) => {
      OpsState.daybookDate = date || getTodayDate();
      render();
    },

    setOpsDaybookSearch: (q) => {
      OpsState.daybookSearchQuery = q || '';
      render();
    },

    setOpsOpeningDate: (date) => {
      OpsState.openingDate = date || getTodayDate();
      render();
    },

    setOpsClosingDate: (date) => {
      OpsState.closingDate = date || getTodayDate();
      render();
    },

    setCashReportDenomDate: (date) => {
      OpsState.cashReportDenomDate = date || getTodayDate();
      render();
    },

    openDenomViewForDate: (route, date) => {
      if (route === 'daily-opening-cash') OpsState.openingDate = date || getTodayDate();
      if (route === 'daily-closing-cash') OpsState.closingDate = date || getTodayDate();
      window.MJK?.navigateTo?.(route);
    },

    resetDenomInputs: (prefix) => {
      DENOMINATION_SPEC.forEach(spec => {
        const el = document.getElementById(`${prefix}-${spec.key}`);
        if (el) el.value = 0;
      });
      if (prefix === 'op') {
        window.MJK?.recalcOpeningDenom?.();
      } else if (prefix === 'cl') {
        window.MJK?.recalcClosingDenom?.();
      }
    },

    carryForwardPrevBalance: (amount) => {
      const el = document.getElementById('ops-opening-amount');
      if (el) {
        el.value = Number(amount) || 0;
        syncAmountWords(el, 'ops-opening-amount-words');
      }
      showToast(`Carried forward Previous Day Balance: ${formatINR(amount)}`, 'info');
    },

    recalcOpeningDenom: () => {
      const { total } = sumDenom('op');
      const totalEl = document.getElementById('op-denom-total');
      const inputEl = document.getElementById('ops-opening-amount');
      if (totalEl) totalEl.textContent = formatINR(total);
      if (inputEl) {
        inputEl.value = total;
        syncAmountWords(inputEl, 'ops-opening-amount-words');
      }
    },

    handleSaveOpeningCashForm: async (e, date) => {
      e.preventDefault();
      if (!canMenu('daily-opening-cash', 'add') && !canMenu('daily-opening-cash', 'edit')) {
        showToast('Permission Denied: Opening Cash modification not permitted.', 'danger');
        return;
      }
      const amount = Number(document.getElementById('ops-opening-amount')?.value) || 0;
      const limit = getCashOperationLimit();
      if (limit > 0 && amount > limit) {
        showToast(`Cash limit exceeded! Maximum allowed per operation: ${formatINR(limit)}.`, 'danger');
        return;
      }
      const notes = document.getElementById('ops-opening-notes')?.value || '';
      const { denominations } = sumDenom('op');
      const user = getCurrentUser();
      const tally = calculateDayTally(date);
      try {
        const res = await saveOpeningCashEntry({
          date,
          openingCash: amount,
          previousDayBalance: tally.previousDayBalance,
          openingDenominations: denominations,
          openingNotes: notes,
          verifiedBy: `${user?.name || 'Counter Staff'} (${user?.uid || ''})`
        });
        if (res.success && res.entry) {
          await syncDaybookSnapshotToServer(res.entry);
        }
        showToast(`Saved Daily Opening Cash (${formatINR(amount)}) for ${formatDate(date)}.`, 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to save opening cash entry.', 'danger');
      }
    },

    recalcClosingDenom: () => {
      const { total } = sumDenom('cl');
      const inputEl = document.getElementById('cl-physical-amount');
      if (inputEl) {
        inputEl.value = total;
        syncAmountWords(inputEl, 'cl-physical-amount-words');
      }
      window.MJK.updateClosingVariance();
    },

    updateClosingVariance: () => {
      const expEl = document.getElementById('cl-expected-val');
      const phyEl = document.getElementById('cl-physical-amount');
      const varBox = document.getElementById('cl-variance-box');
      if (phyEl) syncAmountWords(phyEl, 'cl-physical-amount-words');
      if (!expEl || !phyEl || !varBox) return;
      const expected = Number(expEl.dataset.val) || 0;
      const physical = Number(phyEl.value) || 0;
      const diff = physical - expected;
      if (diff === 0) {
        varBox.textContent = 'Balanced (₹0)';
        varBox.style.color = 'var(--success)';
      } else if (diff > 0) {
        varBox.textContent = `+${formatINR(diff)} Excess`;
        varBox.style.color = 'var(--warning)';
      } else {
        varBox.textContent = `${formatINR(diff)} Shortage`;
        varBox.style.color = 'var(--danger)';
      }
    },

    handleSaveClosingCashForm: async (e, date) => {
      e.preventDefault();
      if (!canMenu('daily-closing-cash', 'add') && !canMenu('daily-closing-cash', 'edit')) {
        showToast('Permission Denied: Closing Cash modification not permitted.', 'danger');
        return;
      }
      const physical = Number(document.getElementById('cl-physical-amount')?.value) || 0;
      const limit = getCashOperationLimit();
      if (limit > 0 && physical > limit) {
        showToast(`Cash limit exceeded! Maximum allowed per operation: ${formatINR(limit)}.`, 'danger');
        return;
      }
      const notes = document.getElementById('cl-notes')?.value || '';
      const { denominations } = sumDenom('cl');
      const user = getCurrentUser();
      const tally = calculateDayTally(date);
      try {
        const res = await saveDaybookEntry({
          date,
          previousDayBalance: tally.previousDayBalance,
          openingCash: tally.openingCash,
          serviceCashIn: tally.serviceCashIn,
          manualCashReceived: tally.manualCashReceived,
          cashReceived: tally.cashReceived,
          cashExpenses: tally.cashExpenses,
          manualCashPayment: tally.manualCashPayment,
          cashPayment: tally.cashPayment,
          cashDeposit: tally.cashDeposit,
          cashWithdrawal: tally.cashWithdrawal,
          expectedClosing: tally.expectedClosing,
          countedPhysicalCash: physical,
          denominations,
          verifiedBy: `${user?.name || 'Counter Staff'} (${user?.uid || ''})`,
          notes
        });
        if (res.success && res.entry) {
          await syncDaybookSnapshotToServer(res.entry);
        }
        showToast(`Saved Daily Closing Cash (${formatINR(physical)}) — ${res.entry.status}`, 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to save closing cash entry.', 'danger');
      }
    },

    openCounterCashTxnModal: (defaultType = 'CASH_RECEIVED', date = getTodayDate()) => {
      if (!canMenu('counter-daybook', 'add')) {
        showToast('Permission Denied: You cannot add Counter Day Book entries.', 'danger');
        return;
      }
      const limit = getCashOperationLimit();
      const defaultCategory = defaultType === 'CASH_PAYMENT' ? 'Shop Expense' : defaultType === 'CASH_DEPOSIT' ? 'Bank Deposit' : defaultType === 'CASH_WITHDRAWAL' ? 'Bank Withdrawal' : 'Service Fee Collection';
      const content = `
        <form onsubmit="window.MJK.handleSaveCounterCashTxn(event)">
          ${limit > 0 ? `<div class="badge badge-warning" style="margin-bottom:0.75rem; display:inline-block;">Your Cash Operation Limit: ${formatINR(limit)} per entry</div>` : ''}
          <div style="margin-bottom:0.85rem;">
            <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.35rem;">Quick Shop &amp; Gas Presets:</div>
            <div style="display:flex; flex-wrap:wrap; gap:0.35rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('ctxn-type').value='CASH_RECEIVED'; document.getElementById('ctxn-category').value='Gas Hose Pipe Sale'; document.getElementById('ctxn-party').value='Walk-in Customer';">🔥 Gas Hose Pipe Sale</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('ctxn-type').value='CASH_RECEIVED'; document.getElementById('ctxn-category').value='Gas Accessories Sale'; document.getElementById('ctxn-party').value='Walk-in Customer';">🛠️ Gas Accessories Sale</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('ctxn-type').value='CASH_RECEIVED'; document.getElementById('ctxn-category').value='Customer Due Collection'; document.getElementById('ctxn-party').value='';">💰 Customer Due Collection</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('ctxn-type').value='CASH_PAYMENT'; document.getElementById('ctxn-category').value='Shop Expense'; document.getElementById('ctxn-party').value='Shop Petty Expense';">📉 Shop Expense</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('ctxn-type').value='CASH_PAYMENT'; document.getElementById('ctxn-category').value='PNB Point AEPS Withdrawal'; document.getElementById('ctxn-party').value='PNB Point AEPS Payout';">🏦 PNB AEPS Payout</button>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Transaction Type *</label>
              <select id="ctxn-type" class="form-control" required>
                <option value="CASH_RECEIVED" ${defaultType === 'CASH_RECEIVED' ? 'selected' : ''}>⬇ Cash In / Collection</option>
                <option value="CASH_PAYMENT" ${defaultType === 'CASH_PAYMENT' ? 'selected' : ''}>⬆ Expense / Cash Out</option>
                <option value="CASH_DEPOSIT" ${defaultType === 'CASH_DEPOSIT' ? 'selected' : ''}>🏦 Cash Deposit (Banked Out)</option>
                <option value="CASH_WITHDRAWAL" ${defaultType === 'CASH_WITHDRAWAL' ? 'selected' : ''}>💵 Cash Withdrawal (To Counter)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Payment Mode *</label>
              <select id="ctxn-mode" class="form-control" required>
                <option value="Cash" selected>Cash</option>
                <option value="UPI">UPI</option>
                <option value="QR">QR</option>
                <option value="Due">Due (Credit - Excluded from Cash In)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input type="date" id="ctxn-date" class="form-control" value="${esc(date)}" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Category / Transaction Label *</label>
              <input type="text" id="ctxn-category" class="form-control" required value="${esc(defaultCategory)}" list="ctxn-category-list" placeholder="e.g. Gas Accessories Sale / Shop Expense">
              <datalist id="ctxn-category-list">
                <option value="Gas Hose Pipe Sale">
                <option value="Gas Accessories Sale">
                <option value="Service Fee Collection">
                <option value="Customer Due Collection">
                <option value="Shop Expense">
                <option value="Bank Deposit">
                <option value="Bank Withdrawal">
              </datalist>
            </div>
            <div class="form-group">
              <label class="form-label">Particulars / Customer Name *</label>
              <input type="text" id="ctxn-party" class="form-control" required placeholder="e.g. Customer Name / Vendor">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Amount (₹) *</label>
              <input type="number" id="ctxn-amount" class="form-control tabular-nums" min="1" ${limit > 0 ? `max="${limit}"` : ''} step="any" required placeholder="Enter amount" oninput="window.MJK?.syncAmountWords?.(this, 'ctxn-amount-words', { allowZero: false })">
              <div id="ctxn-amount-words" class="amount-words-hint" style="display:none;"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Receipt / Voucher / Ref No.</label>
              <input type="text" id="ctxn-ref" class="form-control" placeholder="Optional Voucher / Receipt / RRN">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Notes / Remarks</label>
            <input type="text" id="ctxn-notes" class="form-control" placeholder="Optional remarks">
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Day Book Entry</button>
          </div>
        </form>
      `;
      openModal(defaultType === 'CASH_PAYMENT' ? 'Add Expense / Cash Out Entry' : 'Add Cash In / Collection Entry', content, null);
    },

    handleSaveCounterCashTxn: async (e) => {
      e.preventDefault();
      if (!canMenu('counter-daybook', 'add')) {
        showToast('Permission Denied: Counter Day Book entry not allowed.', 'danger');
        return;
      }
      const user = getCurrentUser();
      const date = document.getElementById('ctxn-date')?.value || getTodayDate();
      const amount = Number(document.getElementById('ctxn-amount')?.value) || 0;
      const paymentMode = document.getElementById('ctxn-mode')?.value || 'Cash';
      const category = document.getElementById('ctxn-category')?.value || 'Counter Entry';
      const limit = getCashOperationLimit(user);
      if (limit > 0 && amount > limit) {
        showToast(`Cash Limit Exceeded: Your allowed Cash Operation Limit is ${formatINR(limit)}.`, 'danger');
        return;
      }
      const payload = {
        date,
        type: document.getElementById('ctxn-type')?.value || 'CASH_RECEIVED',
        paymentMode,
        category,
        amount,
        partyName: document.getElementById('ctxn-party')?.value || 'Counter Entry',
        reference: document.getElementById('ctxn-ref')?.value || '',
        notes: document.getElementById('ctxn-notes')?.value || '',
        createdBy: user?.name || 'Staff',
        actorUid: user?.uid || user?.id || ''
      };
      const serverRes = await syncAddCounterCashTxnToServer(payload);
      if (!serverRes.success) {
        showToast(serverRes.message || 'Server rejected counter cash entry.', 'danger');
        return;
      }
      try {
        const res = await addCounterCashTxn({ ...payload, ...(serverRes.entry || {}), paymentMode, category });
        if (res.success) {
          OpsState.daybookDate = date;
          closeModal();
          showToast(`Day Book entry saved (${formatINR(res.entry.amount)} · ${paymentMode}).`, 'success');
          render();
        }
      } catch (err) {
        showToast(err?.message || 'Unable to save Day Book entry.', 'danger');
      }
    },

    promptDeleteCounterCashTxn: (id) => {
      if (!canMenu('counter-daybook', 'delete')) {
        showToast('Permission Denied: You do not have permission to delete Cash entries.', 'danger');
        return;
      }
      const content = `
        <form onsubmit="window.MJK.confirmDeleteCounterCashWithReason(event, '${esc(id)}')">
          <p style="font-size:0.86rem; color:var(--text-muted); margin-bottom:0.75rem;">
            Deleting Counter Cash Entry <strong>${esc(id)}</strong> requires a mandatory reason that will be recorded permanently in the Audit & Delete History log.
          </p>
          <div class="form-group">
            <label class="form-label">Delete Reason <span class="req">*</span></label>
            <textarea id="ctxn-del-reason" class="form-control" rows="3" required minlength="3" placeholder="Enter clear reason for removing this cash entry..."></textarea>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-danger">🗑 Confirm Delete & Log Reason</button>
          </div>
        </form>
      `;
      openModal('Delete Counter Cash Entry (Reason Required)', content, null);
    },

    confirmDeleteCounterCashWithReason: async (e, id) => {
      e.preventDefault();
      const reason = (document.getElementById('ctxn-del-reason')?.value || '').trim();
      if (reason.length < 3) {
        showToast('Please enter a Delete Reason (at least 3 characters).', 'warning');
        return;
      }
      const srv = await syncDeleteCounterCashTxnToServer(id, reason);
      if (!srv.success) {
        showToast(srv.message || 'Server denied deletion.', 'danger');
        return;
      }
      deleteCounterCashTxn(id);
      closeModal();
      showToast('Cash entry deleted and reason logged permanently.', 'info');
      render();
    },

    /* --- Staff Attendance & Time Management Handlers --- */
    setOpsAttDateFilter: (d) => {
      OpsState.attDateFilter = d || '';
      render();
    },

    setOpsAttStaffFilter: (sid) => {
      OpsState.attStaffFilter = sid || 'all';
      render();
    },

    setOpsTimeRegDate: (d) => {
      OpsState.timeRegDate = d || getTodayDate();
      render();
    },

    setOpsTimeRegMonth: (m) => {
      OpsState.timeRegMonth = m || getTodayDate().slice(0, 7);
      render();
    },

    handleSaveShiftConfig: (e) => {
      e.preventDefault();
      if (!canMenu('time-register', 'edit')) {
        showToast('Permission Denied: Only Admin/Manager can update shift rules.', 'danger');
        return;
      }
      saveShiftConfig({
        morningInTime: document.getElementById('shift-in-time')?.value || '09:00',
        eveningOutTime: document.getElementById('shift-out-time')?.value || '19:00',
        graceMinutes: Number(document.getElementById('shift-grace-mins')?.value) || 15,
        standardHours: Number(document.getElementById('shift-std-hours')?.value) || 10
      });
      if (typeof window.MJK?.syncTeamStateToServer === 'function') {
        window.MJK.syncTeamStateToServer();
      }
      showToast('Standard counter shift timings updated!', 'success');
      render();
    },

    handleQuickTimeLog: async (e) => {
      e.preventDefault();
      const currentUser = getCurrentUser();
      const canAll = canViewAllAttendanceScope(currentUser);
      const staffId = canAll ? document.getElementById('tr-staff-id')?.value : (currentUser?.uid || currentUser?.id);
      const staffList = getActiveStaffList();
      const staff = staffList.find(u => (u.uid || u.id) === staffId);
      const date = document.getElementById('tr-date')?.value || getTodayDate();
      const inTime24 = document.getElementById('tr-in-time')?.value || '09:00';
      const outTime24 = document.getElementById('tr-out-time')?.value || '';
      try {
        const res = await recordAttendance({
          staffId,
          staffName: staff?.name || currentUser?.name || 'Staff Member',
          date,
          status: 'Present',
          inTime24,
          outTime24
        });
        if (res.success) await syncAttendanceRecordToServer(res.entry);
        showToast(`Time Register updated for ${res.entry.staffName} (${res.entry.workingHoursLabel}).`, 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to record attendance.', 'danger');
      }
    },

    openStaffAttendanceModal: (attId = null) => {
      const currentUser = getCurrentUser();
      const canAll = canViewAllAttendanceScope(currentUser);
      const myUid = currentUser?.uid || currentUser?.id || '';
      const existing = attId ? getAllAttendance().find(a => a.id === attId) : null;
      const staffList = canAll ? getActiveStaffList() : getActiveStaffList().filter(u => (u.uid || u.id) === myUid);
      const shiftCfg = getShiftConfig();
      const content = `
        <form onsubmit="window.MJK.handleSaveStaffAttendance(event, '${esc(attId || '')}')">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Staff Name *</label>
              <select id="att-staff-id" class="form-control" required ${canAll ? '' : 'disabled'}>
                ${staffList.map(u => `<option value="${esc(u.uid || u.id)}" ${(existing?.staffId || myUid) === (u.uid || u.id) ? 'selected' : ''}>${esc(u.name)} (${esc(u.uid || u.id)})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input type="date" id="att-date" class="form-control" value="${esc(existing?.date || OpsState.attDateFilter || getTodayDate())}" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Attendance Status *</label>
              <select id="att-status" class="form-control" required>
                ${['Present', 'Half Day', 'Absent', 'Leave'].map(st => `<option value="${st}" ${(existing?.status || 'Present') === st ? 'selected' : ''}>${st}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Morning In Time</label>
              <input type="time" id="att-in-time" class="form-control" value="${esc(existing ? to24HourTime(existing.inTime24 || existing.clockIn, shiftCfg.morningInTime) : shiftCfg.morningInTime)}">
            </div>
            <div class="form-group">
              <label class="form-label">Out Time</label>
              <input type="time" id="att-out-time" class="form-control" value="${esc(existing ? to24HourTime(existing.outTime24 || existing.clockOut, shiftCfg.eveningOutTime) : shiftCfg.eveningOutTime)}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Remarks / Notes</label>
            <input type="text" id="att-notes" class="form-control" value="${esc(existing?.notes || '')}" placeholder="Optional shift remarks">
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">${existing ? 'Update Attendance' : 'Save Attendance'}</button>
          </div>
        </form>
      `;
      openModal(existing ? 'Edit Staff Attendance' : 'Mark Staff Attendance', content, null);
    },

    handleSaveStaffAttendance: async (e, attId) => {
      e.preventDefault();
      const currentUser = getCurrentUser();
      const canAll = canViewAllAttendanceScope(currentUser);
      const staffId = canAll ? document.getElementById('att-staff-id')?.value : (currentUser?.uid || currentUser?.id);
      const staffList = getActiveStaffList();
      const staff = staffList.find(u => (u.uid || u.id) === staffId);
      const date = document.getElementById('att-date')?.value || getTodayDate();
      const status = document.getElementById('att-status')?.value || 'Present';
      const inTime24 = document.getElementById('att-in-time')?.value || '';
      const outTime24 = document.getElementById('att-out-time')?.value || '';
      const notes = document.getElementById('att-notes')?.value || '';

      try {
        const res = await recordAttendance({
          id: attId || undefined,
          staffId,
          staffName: staff?.name || currentUser?.name || 'Staff Member',
          date,
          status,
          inTime24,
          outTime24,
          notes
        });
        if (res.success) await syncAttendanceRecordToServer(res.entry);
        OpsState.attDateFilter = date;
        closeModal();
        showToast('Staff attendance saved.', 'success');
        render();
      } catch (err) {
        showToast(err?.message || 'Unable to save staff attendance.', 'danger');
      }
    },

    promptDeleteAttendance: (id) => {
      if (!canMenu('staff-attendance', 'delete')) {
        showToast('Permission Denied: You cannot delete attendance records.', 'danger');
        return;
      }
      showConfirmDialog('Delete Attendance Entry?', 'Remove this staff attendance record?', () => {
        deleteAttendanceRecord(id);
        showToast('Attendance entry removed.', 'info');
        render();
      });
    },

    /* --- GPS + Photo Location Attendance Handlers (Live Camera + Live GPS Only) --- */
    updateGpsDraftField: (field, val) => {
      const protectedFields = new Set(['latitude', 'longitude', 'accuracy', 'capturedAt', 'gpsCapturedAtMs', 'gpsCapturedIso', 'photoDataUrl', 'photoCaptureMethod', 'photoCapturedAtMs', 'photoCapturedIso']);
      if (protectedFields.has(field)) return;
      OpsState.gpsDraft[field] = val;
    },

    captureLiveGpsLocation: async () => {
      if (!OpsState.gpsDraft.consentAccepted) {
        showToast('Please tick the Employee Consent box first before capturing live GPS location.', 'warning');
        return;
      }
      if (!navigator.geolocation) {
        showToast('Live GPS Geolocation is not supported in this browser.', 'danger');
        return;
      }
      showToast('Acquiring live GPS coordinates...', 'info');
      try {
        const pos = await getLivePositionPromise({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
          showToast('Invalid GPS coordinates returned by device. Please ensure GPS/Location is enabled.', 'danger');
          return;
        }
        const now = new Date();
        OpsState.gpsDraft.latitude = lat;
        OpsState.gpsDraft.longitude = lng;
        OpsState.gpsDraft.accuracy = Math.round(pos.coords.accuracy || 0);
        OpsState.gpsDraft.capturedAt = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        OpsState.gpsDraft.gpsCapturedAtMs = Date.now();
        OpsState.gpsDraft.gpsCapturedIso = now.toISOString();
        showToast(`Live GPS captured: ${lat}, ${lng} (±${OpsState.gpsDraft.accuracy}m)`, 'success');
        render();
      } catch (err) {
        showToast(`Live GPS lookup failed (${err.message}). Please allow Location access in browser.`, 'danger');
      }
    },

    startAttendanceCamera: async () => {
      if (!OpsState.gpsDraft.consentAccepted) {
        showToast('Please tick the Employee Consent box first before starting Live Camera.', 'warning');
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Live Camera API unavailable in this browser/frame. Manual upload is disabled; please open in a camera-enabled browser.', 'danger');
        return;
      }
      try {
        stopActiveAttendanceCamera();
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        activeMediaStream = stream;
        OpsState.gpsDraft.cameraActive = true;
        const vid = document.getElementById('gps-camera-video');
        const placeholder = document.getElementById('gps-camera-placeholder');
        if (vid) {
          vid.srcObject = stream;
          await vid.play().catch(() => {});
        }
        if (placeholder) placeholder.style.display = 'none';
        showToast('Live Camera active — click "Capture Photo" to take real-time selfie.', 'success');
      } catch (err) {
        OpsState.gpsDraft.cameraActive = false;
        showToast(`Live Camera access denied/error (${err.message}). Allow Camera permission — gallery upload is disabled.`, 'danger');
      }
    },

    captureAttendanceSnapshot: () => {
      const vid = document.getElementById('gps-camera-video');
      if (!hasLiveMediaStream() || !vid || !vid.srcObject || vid.readyState < 2 || vid.videoWidth === 0) {
        showToast('Live Camera is not running. Click "Start Camera" first to capture a real-time photo.', 'warning');
        return;
      }
      const canvas = document.createElement('canvas');
      const maxW = 420;
      const ratio = vid.videoHeight / vid.videoWidth;
      canvas.width = maxW;
      canvas.height = Math.round(maxW * (ratio || 0.75));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      const now = new Date();
      OpsState.gpsDraft.photoDataUrl = canvas.toDataURL('image/jpeg', 0.78);
      OpsState.gpsDraft.photoCaptureMethod = 'LIVE_CAMERA';
      OpsState.gpsDraft.photoCapturedAtMs = Date.now();
      OpsState.gpsDraft.photoCapturedIso = now.toISOString();
      stopActiveAttendanceCamera();
      showToast('Live camera selfie captured!', 'success');
      render();
    },

    retakeAttendancePhoto: () => {
      OpsState.gpsDraft.photoDataUrl = '';
      OpsState.gpsDraft.photoCaptureMethod = '';
      OpsState.gpsDraft.photoCapturedAtMs = 0;
      OpsState.gpsDraft.photoCapturedIso = '';
      render();
      requestAnimationFrame(() => {
        window.MJK?.startAttendanceCamera?.();
      });
    },

    submitGpsAttendancePunch: async () => {
      const d = OpsState.gpsDraft;
      if (d.submitting) return;
      if (!d.consentAccepted) {
        showToast('Employee consent checkbox is mandatory before saving live GPS & photo.', 'warning');
        return;
      }
      if (!Number.isFinite(d.latitude) || !Number.isFinite(d.longitude) || (d.latitude === 0 && d.longitude === 0)) {
        showToast('Please capture Live GPS Location first.', 'warning');
        return;
      }
      if (!d.photoDataUrl || d.photoCaptureMethod !== 'LIVE_CAMERA' || !d.photoCapturedAtMs) {
        showToast('Live Camera photo required. Gallery/file uploads are disabled — click "Start Camera" & "Capture Photo".', 'warning');
        return;
      }
      // Require live photo to be recent (within 10 minutes)
      if (Date.now() - d.photoCapturedAtMs > 10 * 60 * 1000) {
        OpsState.gpsDraft.photoDataUrl = '';
        OpsState.gpsDraft.photoCaptureMethod = '';
        OpsState.gpsDraft.photoCapturedAtMs = 0;
        OpsState.gpsDraft.photoCapturedIso = '';
        showToast('Captured photo expired (over 10 mins old). Please take a fresh Live Camera photo.', 'warning');
        render();
        return;
      }

      OpsState.gpsDraft.submitting = true;
      render();

      try {
        // Real-time live GPS verification & matching right before saving
        let livePos;
        try {
          livePos = await getLivePositionPromise({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
        } catch (gpsErr) {
          showToast(`Live GPS verification failed (${gpsErr.message}). Location access must remain ON to save attendance.`, 'danger');
          return;
        }

        const liveLat = Number(livePos.coords.latitude.toFixed(6));
        const liveLng = Number(livePos.coords.longitude.toFixed(6));
        const liveAccuracy = Math.round(livePos.coords.accuracy || 0);

        if (!Number.isFinite(liveLat) || !Number.isFinite(liveLng) || (liveLat === 0 && liveLng === 0)) {
          showToast('Live GPS verification returned invalid coordinates. Attendance not saved.', 'danger');
          return;
        }

        const matchDistanceMeters = Math.round(haversineDistanceMeters(d.latitude, d.longitude, liveLat, liveLng));
        const allowedDriftMeters = Math.max(1000, Math.round((d.accuracy || 0) + liveAccuracy + 500));
        if (matchDistanceMeters > allowedDriftMeters) {
          const now = new Date();
          OpsState.gpsDraft.latitude = liveLat;
          OpsState.gpsDraft.longitude = liveLng;
          OpsState.gpsDraft.accuracy = liveAccuracy;
          OpsState.gpsDraft.capturedAt = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
          OpsState.gpsDraft.gpsCapturedAtMs = Date.now();
          OpsState.gpsDraft.gpsCapturedIso = now.toISOString();
          showToast(`Live GPS moved by ${matchDistanceMeters}m from earlier capture. Updated to current GPS — please verify and click Save again.`, 'warning');
          return;
        }

        const currentUser = getCurrentUser();
        const canAllAtt = canViewAllAttendanceScope(currentUser);
        const effectiveStaffId = canAllAtt ? d.staffId : (currentUser?.uid || currentUser?.id);
        const staffList = getActiveStaffList();
        const staff = staffList.find(u => (u.uid || u.id) === effectiveStaffId) || currentUser;

        const now = new Date();
        const punchPayload = {
          staffId: effectiveStaffId,
          staffName: staff?.name || 'Staff Member',
          role: staff?.designation || staff?.role || 'Staff',
          eventType: d.eventType,
          latitude: liveLat,
          longitude: liveLng,
          accuracy: liveAccuracy,
          photoDataUrl: d.photoDataUrl,
          captureMethod: 'LIVE_CAMERA',
          gpsVerifiedLive: true,
          gpsMatchDistanceMeters: matchDistanceMeters,
          photoCapturedAt: d.photoCapturedIso || new Date(d.photoCapturedAtMs).toISOString(),
          gpsCapturedAt: now.toISOString(),
          consentAccepted: d.consentAccepted,
          notes: d.notes
        };

        const srv = await saveAttendancePhotoToServer(punchPayload);
        if (!srv.success || !srv.photo) {
          showToast(srv.message || 'Server rejected GPS attendance. Live Camera & Live GPS verification failed.', 'danger');
          return;
        }

        const res = await saveGpsAttendancePunch({
          ...punchPayload,
          id: srv.photo.id,
          date: srv.photo.date,
          time24: srv.photo.time24,
          time12: srv.photo.time12,
          istTimestamp: srv.photo.istTimestamp
        });

        await fetchAttendancePhotosFromServer();
        stopActiveAttendanceCamera();
        OpsState.gpsDraft.photoDataUrl = '';
        OpsState.gpsDraft.photoCaptureMethod = '';
        OpsState.gpsDraft.photoCapturedAtMs = 0;
        OpsState.gpsDraft.photoCapturedIso = '';
        OpsState.gpsDraft.notes = '';
        OpsState.selectedGpsLogId = srv.photo.id || res.entry?.id || '';
        showToast(`Verified Live GPS (±${liveAccuracy}m, matched ${matchDistanceMeters}m) & Live Photo saved for ${srv.photo.staffName}!`, 'success');
      } finally {
        OpsState.gpsDraft.submitting = false;
        render();
      }
    },

    promptDeleteGpsLog: (id) => {
      const currentUser = getCurrentUser();
      const isAdminActor = isSuperAdmin(currentUser) || currentUser?.role === 'ADMIN';
      if (!isAdminActor || !canMenu('attendance-photo-gallery', 'delete')) {
        showToast('ACCESS DENIED: Only Administrator can delete Staff Attendance Photos.', 'danger');
        return;
      }
      const photo = getCombinedAttendancePhotos().find(p => p.id === id);
      const content = `
        <form onsubmit="window.MJK.confirmDeleteAttendancePhotoWithReason(event, '${esc(id)}')">
          <div style="background:var(--danger-bg); border:1px solid var(--danger-border); border-radius:8px; padding:0.75rem; margin-bottom:0.85rem; font-size:0.84rem; color:#991b1b;">
            <strong>Administrator Photo Deletion Policy:</strong> Deleting attendance photo <strong>${esc(id)}</strong>${photo ? ` (${esc(photo.staffName)} · ${esc(photo.staffId)})` : ''} is irreversible and requires a clear <strong>Delete Reason</strong> recorded in Audit & Delete History.
          </div>
          <div class="form-group">
            <label class="form-label">Delete Reason <span class="req">*</span></label>
            <textarea id="photo-del-reason" class="form-control" rows="3" required minlength="3" placeholder="e.g. Duplicate punch / Test upload / Blurry camera capture..."></textarea>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-danger">🗑 Delete Photo & Log Reason</button>
          </div>
        </form>
      `;
      openModal('Delete Attendance Photo (Administrator Only)', content, null);
    },

    confirmDeleteAttendancePhotoWithReason: async (e, id) => {
      e.preventDefault();
      const reason = (document.getElementById('photo-del-reason')?.value || '').trim();
      if (reason.length < 3) {
        showToast('Please provide a clear Delete Reason (minimum 3 characters).', 'warning');
        return;
      }
      const srv = await deleteAttendancePhotoOnServer(id, reason);
      if (!srv.success) {
        showToast(srv.message || 'Server denied attendance photo deletion.', 'danger');
        return;
      }
      deleteGpsAttendanceLog(id);
      if (Array.isArray(window._munServerAttendancePhotos)) {
        window._munServerAttendancePhotos = window._munServerAttendancePhotos.filter(p => p.id !== id);
      }
      closeModal();
      showToast('Attendance photo deleted and Delete Reason recorded permanently.', 'info');
      render();
    },

    handleVerifyAttendancePhoto: async (id, status) => {
      const srv = await verifyAttendancePhotoOnServer(id, status, '');
      if (srv.success) {
        await fetchAttendancePhotosFromServer();
        showToast(`Photo marked as ${status}.`, 'success');
        render();
      } else {
        showToast(srv.message || 'Verification failed.', 'danger');
      }
    },

    downloadAttendancePhoto: (id) => {
      const photo = getCombinedAttendancePhotos().find(p => p.id === id);
      if (!photo) {
        showToast('Attendance photo record not found.', 'warning');
        return;
      }
      const url = getAttendancePhotoImageUrl(photo, true);
      if (!url) {
        showToast('No image data available to download.', 'warning');
        return;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = `MUN_Attendance_${photo.staffId || 'STAFF'}_${photo.date || ''}_${photo.eventType || 'IN'}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Downloading attendance photo...', 'success');
    },

    printAttendancePhoto: (id) => {
      const photo = getCombinedAttendancePhotos().find(p => p.id === id);
      if (!photo) {
        showToast('Attendance photo not found.', 'warning');
        return;
      }
      const imgUrl = getAttendancePhotoImageUrl(photo, false);
      const bodyHtml = `
        <div class="mun-bw-doc" style="border:1.5px solid #000000; padding:14px;">
          ${renderBwDocumentHeader({
            docTitle: 'ATTENDANCE PHOTO & GPS RECORD',
            docNumber: photo.id,
            docDateTime: photo.istTimestamp || `${formatDate(photo.date)} ${photo.time12 || ''}`,
            statusText: photo.verificationStatus || 'PENDING',
            extraRightLines: [`Shift: ${photo.eventType === 'IN' ? 'Morning In-Time' : 'Evening Out-Time'}`]
          })}
          <div style="display:grid; grid-template-columns:250px 1fr; gap:16px; align-items:start;">
            <div style="border:1.5px solid #000000; text-align:center;">
              ${imgUrl ? `<img src="${imgUrl}" alt="${esc(photo.staffName)}" style="width:100%; max-height:270px; object-fit:cover; display:block;">` : '<div style="padding:40px;">No Photo</div>'}
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:9pt;">
              <tr><td style="font-weight:700; width:38%;">Staff Name</td><td>${esc(photo.staffName)}</td></tr>
              <tr><td style="font-weight:700;">Employee ID</td><td class="font-mono">${esc(photo.staffId || '-')}</td></tr>
              <tr><td style="font-weight:700;">Role / Designation</td><td>${esc(photo.role || 'Staff')}</td></tr>
              <tr><td style="font-weight:700;">Date &amp; Time (IST)</td><td>${esc(photo.istTimestamp || `${formatDate(photo.date)} ${photo.time12 || ''}`)}</td></tr>
              <tr><td style="font-weight:700;">GPS Coordinates</td><td class="font-mono">Lat: ${photo.latitude}, Lng: ${photo.longitude} (±${Math.round(photo.accuracy || 0)}m)</td></tr>
              <tr><td style="font-weight:700;">Google Maps URL</td><td style="word-break:break-all;">https://www.google.com/maps?q=${photo.latitude},${photo.longitude}</td></tr>
              <tr><td style="font-weight:700;">Location Notes</td><td>${esc(photo.notes || '-')}</td></tr>
            </table>
          </div>
          ${renderAcknowledgementSection({ includeCustomerSignature: false })}
        </div>
      `;
      showA4PrintPdfPopup({
        title: `Attendance Photo — ${photo.staffName} (${photo.date})`,
        subtitle: `Employee ID: ${photo.staffId} · GPS: ${photo.latitude}, ${photo.longitude}`,
        bodyHtml,
        pdfConfig: {
          filename: `MUN_Attendance_Photo_${photo.staffId || 'STAFF'}_${photo.date || ''}`,
          reportTitle: 'STAFF ATTENDANCE PHOTO & GPS VERIFICATION',
          metaLine: `Name: ${photo.staffName} | ID: ${photo.staffId} | ${photo.istTimestamp}`,
          headers: ['Field', 'Recorded Value'],
          rows: [
            ['Staff Name', photo.staffName],
            ['Employee ID', photo.staffId || '-'],
            ['Shift Punch', photo.eventType === 'IN' ? 'Morning In-Time' : 'Evening Out-Time'],
            ['Date & Time (IST)', photo.istTimestamp || `${photo.date} ${photo.time12 || ''}`],
            ['GPS Coordinates', `${photo.latitude}, ${photo.longitude} (±${Math.round(photo.accuracy || 0)}m)`],
            ['Google Maps Link', `https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`],
            ['Verification', photo.verificationStatus || 'PENDING']
          ]
        }
      });
    },

    refreshAttendancePhotoGallery: async () => {
      OpsState.hydratedPhotos = true;
      await fetchAttendancePhotosFromServer();
      showToast('Attendance Photo Gallery refreshed from server.', 'success');
      render();
    },

    setOpsPhotoFilter: (field, val) => {
      if (field === 'date') OpsState.photoDateFilter = val || '';
      if (field === 'from') OpsState.photoFromDate = val || '';
      if (field === 'to') OpsState.photoToDate = val || '';
      if (field === 'staff') OpsState.photoStaffFilter = val || 'all';
      if (field === 'event') OpsState.photoEventFilter = val || 'ALL';
      if (field === 'verify') OpsState.photoVerifyFilter = val || 'ALL';
      if (field === 'search') OpsState.photoSearchQuery = val || '';
      render();
    },

    resetOpsPhotoFilters: () => {
      OpsState.photoDateFilter = '';
      OpsState.photoFromDate = '';
      OpsState.photoToDate = '';
      OpsState.photoStaffFilter = 'all';
      OpsState.photoEventFilter = 'ALL';
      OpsState.photoVerifyFilter = 'ALL';
      OpsState.photoSearchQuery = '';
      render();
    },

    /* --- Staff Photo & Location Map Handlers --- */
    setOpsMapFilter: (field, val) => {
      if (field === 'date') OpsState.mapFilterDate = val || '';
      if (field === 'staff') OpsState.mapFilterStaff = val || 'all';
      if (field === 'event') OpsState.mapFilterEvent = val || 'ALL';
      render();
    },

    selectStaffLocationPin: (id) => {
      OpsState.selectedGpsLogId = id;
      render();
    },

    /* --- Reports & Exports --- */
    setOpsAttReportFilter: (field, val) => {
      if (field === 'month') OpsState.attReportMonth = val || getTodayDate().slice(0, 7);
      if (field === 'staff') OpsState.attReportStaff = val || 'all';
      render();
    },

    setOpsCashReportFilter: (field, val) => {
      if (field === 'from') OpsState.cashReportFrom = val;
      if (field === 'to') OpsState.cashReportTo = val;
      if (field === 'query') OpsState.cashReportQuery = val;
      render();
    },

    exportDailyCashCsv: (date) => {
      const rows = getCombinedCashRowsForDateRange(date, date, '');
      downloadCSV(
        `MUN_Counter_DayBook_${date}`,
        rows.map(r => ({
          Ref_ID: r.id,
          Date: r.date,
          Time: r.time || '',
          Type: r.typeLabel,
          Party: r.partyName,
          Notes: r.notes || r.reference || '',
          Amount_INR: Number(r.amount) || 0
        })),
        [
          { key: 'Ref_ID', label: 'Ref ID' },
          { key: 'Date', label: 'Date' },
          { key: 'Time', label: 'Time' },
          { key: 'Type', label: 'Transaction Type' },
          { key: 'Party', label: 'Party / Particulars' },
          { key: 'Notes', label: 'Notes / Reference' },
          { key: 'Amount_INR', label: 'Amount (INR)' }
        ]
      );
      showToast('Daily Cash CSV downloaded.', 'success');
    },

    exportDailyCashExcel: (date) => {
      const rows = getCombinedCashRowsForDateRange(date, date, '');
      downloadExcelSheet(
        `MUN_Counter_DayBook_${date}`,
        'Counter_DayBook',
        rows.map(r => ({
          'Ref ID': r.id,
          'Date': r.date,
          'Time': r.time || '',
          'Transaction Type': r.typeLabel,
          'Party / Particulars': r.partyName,
          'Recorded By': r.createdBy || 'System',
          'Notes / Reference': r.notes || r.reference || '',
          'Amount (INR)': Number(r.amount) || 0
        })),
        `No counter entries recorded for ${formatDate(date)}`
      );
      showToast('Counter Day Book Excel (.xlsx) downloaded.', 'success');
    },

    exportDailyCashPdf: (date) => {
      const tally = calculateDayTally(date);
      const rows = buildCounterLedgerRows(date, '');
      const totalCashIn = Number(tally.totalCashIn ?? tally.cashReceived) || 0;
      const totalCashOut = Number(tally.totalCashOut ?? tally.cashPayment) || 0;
      const rptId = generateReportId('MUN-CDB');

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const bw = getBwAutoTableStyles();
      const startY = drawBwPdfHeader(doc, {
        docTitle: 'DAILY CASH BOOK & COUNTER LEDGER',
        docNumber: rptId,
        docDateTime: formatDate(date),
        metaLine: `Opening: Rs.${tally.openingCash} | Cash In: Rs.${totalCashIn} | Cash Out: Rs.${totalCashOut} | Closing Cash in Hand: Rs.${tally.closingCash}`
      });

      const pdfRows = rows.length > 0
        ? rows.map(r => [
            `${formatDate(r.date)} ${r.time || ''}`.trim(),
            r.voucherId || r.id,
            `${r.partyName}${r.notes ? ` (${r.notes})` : ''}`,
            r.categoryLabel || '-',
            r.paymentMode || 'Cash',
            r.cashIn > 0 ? `Rs.${r.cashIn}` : (r.nonCashAmount > 0 && (r.type === 'CASH_RECEIVED' || r.type === 'CASH_WITHDRAWAL') ? `Rs.${r.nonCashAmount} (${r.paymentMode})` : '-'),
            r.cashOut > 0 ? `Rs.${r.cashOut}` : (r.nonCashAmount > 0 && (r.type === 'CASH_PAYMENT' || r.type === 'CASH_DEPOSIT') ? `Rs.${r.nonCashAmount} (${r.paymentMode})` : '-'),
            `Rs.${r.runningBalance}`
          ])
        : [['-', '-', 'No transactions recorded for selected date', '-', '-', '-', '-', `Rs.${tally.openingCash}`]];

      autoTable(doc, {
        head: [['Time / Date', 'Receipt / Voucher ID', 'Particulars / Customer Name', 'Category / Transaction Type', 'Mode', 'Cash In (+)', 'Cash Out (-)', 'Running Balance']],
        body: pdfRows,
        foot: [['GRAND TOTAL', `${rows.length} Txns`, 'Closing Cash in Hand', '-', 'Cash', `Rs.${totalCashIn}`, `Rs.${totalCashOut}`, `Rs.${tally.closingCash}`]],
        showHead: 'everyPage',
        showFoot: 'lastPage',
        startY,
        margin: { left: 10, right: 10, bottom: 16 },
        ...bw,
        columnStyles: {
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right', fontStyle: 'bold' }
        }
      });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      let finalY = (doc.lastAutoTable?.finalY || 130) + 7;
      if (finalY + 18 > pageH - 12) {
        doc.addPage();
        finalY = 16;
      }
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8.2);
      doc.setFont('helvetica', 'bold');
      doc.text(`Closing Cash Summary: Opening Rs.${tally.openingCash} + Cash In Rs.${totalCashIn} - Cash Out Rs.${totalCashOut} = Closing Rs.${tally.closingCash}`, 10, finalY);
      doc.setFont('helvetica', 'normal');
      doc.text(`Closing Balance in Words: ${numberToWords(tally.closingCash)}`, 10, finalY + 4.5);
      doc.setDrawColor(11, 59, 140);
      doc.line(pageW - 65, finalY + 9, pageW - 10, finalY + 9);
      doc.setFont('helvetica', 'bold');
      doc.text('Authorized Signature (MUN COMPUTER)', pageW - 10, finalY + 13, { align: 'right' });

      finalizeBwPdfPagination(doc, `MUN COMPUTER · Daily Cash Book (${formatDate(date)}) · ${rptId}`);
      doc.save(`MUN_Counter_DayBook_${date}.pdf`);
      showToast('Counter Day Book PDF downloaded.', 'success');
    },

    exportCashRangeCsv: () => {
      const fromDate = OpsState.cashReportFrom;
      const toDate = OpsState.cashReportTo;
      const rows = getCombinedCashRowsForDateRange(fromDate, toDate, OpsState.cashReportQuery);
      downloadCSV(
        `MUN_Cash_Report_${fromDate}_to_${toDate}`,
        rows.map(r => ({
          Ref_ID: r.id,
          Date: r.date,
          Type: r.typeLabel,
          Party: r.partyName,
          Reference: r.reference || '',
          Notes: r.notes || '',
          Amount_INR: Number(r.amount) || 0
        })),
        [
          { key: 'Ref_ID', label: 'Ref ID' },
          { key: 'Date', label: 'Date' },
          { key: 'Type', label: 'Type' },
          { key: 'Party', label: 'Party' },
          { key: 'Reference', label: 'Reference' },
          { key: 'Notes', label: 'Notes' },
          { key: 'Amount_INR', label: 'Amount (INR)' }
        ]
      );
      showToast('Cash Report CSV downloaded.', 'success');
    },

    exportCashRangeExcel: () => {
      const fromDate = OpsState.cashReportFrom;
      const toDate = OpsState.cashReportTo;
      const rows = getCombinedCashRowsForDateRange(fromDate, toDate, OpsState.cashReportQuery);
      downloadExcelSheet(
        `MUN_Cash_Report_${fromDate}_to_${toDate}`,
        'Cash_Report',
        rows.map(r => ({
          'Ref ID': r.id,
          'Date': r.date,
          'Type': r.typeLabel,
          'Party': r.partyName,
          'Reference': r.reference || '',
          'Notes': r.notes || '',
          'Amount (INR)': Number(r.amount) || 0
        })),
        'No cash entries found for selected period'
      );
      showToast('Cash Report Excel (.xlsx) downloaded.', 'success');
    },

    printDenominationReport: (date = getTodayDate(), blankMode = false) => {
      const tally = calculateDayTally(date);
      const openDen = normalizeDenominations(tally.openingDenominations);
      const closeDen = normalizeDenominations(tally.denominations);
      const openTotal = calculateDenominationTotal(openDen);
      const closeTotal = calculateDenominationTotal(closeDen);

      const denomRowsHtml = DENOMINATION_SPEC.map(spec => {
        const oq = openDen[spec.key] || 0;
        const cq = closeDen[spec.key] || 0;
        const ot = oq * spec.value;
        const ct = cq * spec.value;
        return `
          <tr>
            <td style="font-weight:700;">${esc(spec.label)}</td>
            <td class="text-right tabular-nums">${blankMode ? '[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]' : (oq > 0 ? oq : '—')}</td>
            <td class="text-right tabular-nums">${blankMode ? '—' : (ot > 0 ? formatINR(ot) : '—')}</td>
            <td class="text-right tabular-nums">${blankMode ? '[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]' : (cq > 0 ? cq : '—')}</td>
            <td class="text-right tabular-nums">${blankMode ? '—' : (ct > 0 ? formatINR(ct) : '—')}</td>
          </tr>
        `;
      }).join('');

      const bodyHtml = `
        <div class="mun-bw-doc">
          ${renderBwDocumentHeader({
            docTitle: 'DAILY CASH & DENOMINATION REPORT',
            docDateTime: blankMode ? '____ / ____ / 20____' : formatDate(date)
          })}

          <div class="a4-avoid-break" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:10px; font-size:8.5pt;">
            <div style="border:1px solid #000000; padding:6px 8px;">
              <div style="font-size:7.5pt; font-weight:700;">Prev Day Balance</div>
              <strong class="tabular-nums">${blankMode ? '₹ ____________' : formatINR(tally.previousDayBalance)}</strong>
            </div>
            <div style="border:1px solid #000000; padding:6px 8px;">
              <div style="font-size:7.5pt; font-weight:700;">Opening Cash</div>
              <strong class="tabular-nums">${blankMode ? '₹ ____________' : formatINR(tally.openingCash)}</strong>
            </div>
            <div style="border:1px solid #000000; padding:6px 8px;">
              <div style="font-size:7.5pt; font-weight:700;">Expected Closing</div>
              <strong class="tabular-nums">${blankMode ? '₹ ____________' : formatINR(tally.expectedClosing)}</strong>
            </div>
            <div style="border:1.5px solid #000000; padding:6px 8px;">
              <div style="font-size:7.5pt; font-weight:700;">Physical Closing</div>
              <strong class="tabular-nums">${blankMode ? '₹ ____________' : formatINR(tally.closingCash)}</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Denomination</th>
                <th class="text-right">Opening Qty</th>
                <th class="text-right">Opening Total (₹)</th>
                <th class="text-right">Closing Qty</th>
                <th class="text-right">Closing Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${denomRowsHtml}
              <tr style="font-weight:800;">
                <td><strong>TOTAL CASH</strong></td>
                <td class="text-right">—</td>
                <td class="text-right tabular-nums"><strong>${blankMode ? '₹ [ Total ]' : formatINR(openTotal)}</strong></td>
                <td class="text-right">—</td>
                <td class="text-right tabular-nums"><strong>${blankMode ? '₹ [ Total ]' : formatINR(closeTotal)}</strong></td>
              </tr>
            </tbody>
          </table>

          ${!blankMode ? `
            <div class="a4-avoid-break" style="border:1px solid #000000; padding:8px 10px; font-size:8pt; line-height:1.5; margin-bottom:10px;">
              <div><strong>Opening Cash in Words:</strong> ${esc(numberToWords(tally.openingCash))}</div>
              <div><strong>Expected Closing in Words:</strong> ${esc(numberToWords(tally.expectedClosing))}</div>
              <div><strong>Physical Closing in Words:</strong> ${esc(numberToWords(tally.closingCash))}</div>
            </div>
          ` : ''}

          <div class="a4-avoid-break" style="border:1px solid #000000; padding:8px 10px; font-size:8pt; line-height:1.5; margin-bottom:16px;">
            <div style="font-weight:700; margin-bottom:3px;">Hisab korar niyam (Counting Rules):</div>
            <div>1. <strong>Qty (Quantity):</strong> Count notes and coins separately (₹10 Notes &amp; ₹10 Coins in separate rows).</div>
            <div>2. <strong>Opening Total:</strong> Total cash in counter drawer when opening the shop.</div>
            <div>3. <strong>Closing Total:</strong> Total physical cash remaining in drawer at shop closing.</div>
          </div>

          ${renderAcknowledgementSection({ includeCustomerSignature: false, dateStr: blankMode ? '' : formatDate(date) })}
        </div>
      `;

      showA4PrintPdfPopup({
        title: blankMode
          ? 'Daily Cash & Denomination Register Sheet (Blank)'
          : `Daily Cash & Denomination Report — ${formatDate(date)}`,
        subtitle: blankMode
          ? 'Printable Register Sheet (Separate ₹10 Notes & ₹10 Coins)'
          : `Opening ${formatINR(openTotal)} · Closing ${formatINR(closeTotal)}`,
        bodyHtml,
        pdfConfig: {
          onDownload: () => {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const bw = getBwAutoTableStyles();
            const startY = drawBwPdfHeader(doc, {
              docTitle: 'DAILY CASH & DENOMINATION REPORT',
              docDateTime: blankMode ? '____ / ____ / 20____' : formatDate(date),
              metaLine: blankMode
                ? 'Prev Bal: Rs. _________ | Opening: Rs. _________ | Closing: Rs. _________'
                : `Prev Bal: Rs.${tally.previousDayBalance} | Opening Cash: Rs.${tally.openingCash} | Expected: Rs.${tally.expectedClosing} | Physical Closing: Rs.${tally.closingCash}`
            });

            const pdfRows = DENOMINATION_SPEC.map(spec => {
              const oq = openDen[spec.key] || 0;
              const cq = closeDen[spec.key] || 0;
              const ot = oq * spec.value;
              const ct = cq * spec.value;
              return [
                spec.pdfLabel,
                blankMode ? '[      ]' : (oq > 0 ? String(oq) : '-'),
                blankMode ? '-' : (ot > 0 ? `Rs.${ot}` : '-'),
                blankMode ? '[      ]' : (cq > 0 ? String(cq) : '-'),
                blankMode ? '-' : (ct > 0 ? `Rs.${ct}` : '-')
              ];
            });
            pdfRows.push([
              'TOTAL CASH',
              '-',
              blankMode ? 'Rs.[ Total ]' : `Rs.${openTotal}`,
              '-',
              blankMode ? 'Rs.[ Total ]' : `Rs.${closeTotal}`
            ]);

            autoTable(doc, {
              head: [['Denomination', 'Opening Qty', 'Opening Total (Rs.)', 'Closing Qty', 'Closing Total (Rs.)']],
              body: pdfRows,
              startY,
              margin: { left: 10, right: 10, bottom: 16 },
              ...bw,
              columnStyles: {
                0: { fontStyle: 'bold' },
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' }
              },
              didParseCell: (data) => {
                if (data.row.index === pdfRows.length - 1) {
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            });

            let afterY = (doc.lastAutoTable?.finalY || 140) + 7;
            doc.setTextColor(0, 0, 0);
            if (!blankMode) {
              doc.setFontSize(8);
              doc.setFont('helvetica', 'bold');
              doc.text(`Opening Cash in Words: ${numberToWords(tally.openingCash)}`, 10, afterY);
              doc.text(`Physical Closing in Words: ${numberToWords(tally.closingCash)}`, 10, afterY + 4.5);
              afterY += 10;
            }
            doc.setFontSize(8.2);
            doc.setFont('helvetica', 'bold');
            doc.text('Counting Rules:', 10, afterY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.6);
            doc.text('1. Count notes and coins separately (Rs.10 Notes & Rs.10 Coins in separate rows).', 10, afterY + 4.5);
            doc.text('2. Opening Total: Total cash in counter drawer at shop opening.', 10, afterY + 9);
            doc.text('3. Closing Total: Physical cash remaining in drawer at closing.', 10, afterY + 13.5);

            const sigY = afterY + 28;
            doc.setDrawColor(0, 0, 0);
            doc.line(10, sigY, 75, sigY);
            doc.line(130, sigY, 198, sigY);
            doc.text('Counter Staff Signature', 18, sigY + 4.5);
            doc.text('Proprietor / Manager Signature', 138, sigY + 4.5);

            finalizeBwPdfPagination(doc, 'MUN COMPUTER · Daily Cash & Denomination Report');
            doc.save(blankMode ? 'MUN_Daily_Cash_Denomination_Blank_Sheet.pdf' : `MUN_Daily_Cash_Denomination_${date}.pdf`);
          }
        }
      });
    },

    printDailyCashReport: (date) => {
      const tally = calculateDayTally(date);
      const rows = buildCounterLedgerRows(date, '');
      const totalCashIn = Number(tally.totalCashIn ?? tally.cashReceived) || 0;
      const totalCashOut = Number(tally.totalCashOut ?? tally.cashPayment) || 0;

      const bodyHtml = `
        <div class="mun-bw-doc">
          ${renderBwDocumentHeader({
            docTitle: 'DAILY CASH BOOK',
            docDateTime: formatDate(date)
          })}

          <div class="a4-avoid-break" style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:10px; font-size:8.4pt;">
            <div style="border:1px solid #000000; padding:6px;">
              <div style="font-size:7.4pt; font-weight:700;">Opening Balance</div>
              <strong style="font-size:10pt;" class="tabular-nums">${formatINR(tally.openingCash)}</strong>
              <div style="font-size:7pt; margin-top:2px;">${esc(numberToWords(tally.openingCash))}</div>
            </div>
            <div style="border:1px solid #000000; padding:6px;">
              <div style="font-size:7.4pt; font-weight:700;">Total Cash In</div>
              <strong style="font-size:10pt;" class="tabular-nums">+${formatINR(totalCashIn)}</strong>
              <div style="font-size:7pt; margin-top:2px;">${esc(numberToWords(totalCashIn))}</div>
            </div>
            <div style="border:1px solid #000000; padding:6px;">
              <div style="font-size:7.4pt; font-weight:700;">Total Cash Out</div>
              <strong style="font-size:10pt;" class="tabular-nums">-${formatINR(totalCashOut)}</strong>
              <div style="font-size:7pt; margin-top:2px;">${esc(numberToWords(totalCashOut))}</div>
            </div>
            <div style="border:1.5px solid #000000; padding:6px;">
              <div style="font-size:7.4pt; font-weight:700;">Closing Cash Balance</div>
              <strong style="font-size:10pt;" class="tabular-nums">${formatINR(tally.closingCash)}</strong>
              <div style="font-size:7pt; margin-top:2px;">${esc(numberToWords(tally.closingCash))}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Time / Date</th>
                <th>Receipt / Voucher ID</th>
                <th>Particulars / Customer</th>
                <th>Category / Type</th>
                <th>Mode</th>
                <th class="text-right">Cash In (+)</th>
                <th class="text-right">Cash Out (-)</th>
                <th class="text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Opening</td>
                <td class="font-mono">OPEN-BAL</td>
                <td><strong>Opening Cash in Hand</strong></td>
                <td>Opening Balance</td>
                <td>Cash</td>
                <td class="text-right">—</td>
                <td class="text-right">—</td>
                <td class="text-right font-mono tabular-nums"><strong>${formatINR(tally.openingCash)}</strong></td>
              </tr>
              ${rows.map(r => `
                <tr>
                  <td>${esc(r.time)} · ${formatDate(r.date)}</td>
                  <td class="font-mono">${esc(r.voucherId || r.id)}</td>
                  <td><strong>${esc(r.partyName)}</strong>${r.notes ? `<br><span style="font-size:7pt;">${esc(r.notes)}</span>` : ''}</td>
                  <td>${esc(r.categoryLabel)}</td>
                  <td>${esc(r.paymentMode)}</td>
                  <td class="text-right font-mono tabular-nums">${r.cashIn > 0 ? `+${formatINR(r.cashIn)}` : (r.nonCashAmount > 0 && (r.type === 'CASH_RECEIVED' || r.type === 'CASH_WITHDRAWAL') ? `${formatINR(r.nonCashAmount)} (${esc(r.paymentMode)})` : '—')}</td>
                  <td class="text-right font-mono tabular-nums">${r.cashOut > 0 ? `-${formatINR(r.cashOut)}` : (r.nonCashAmount > 0 && (r.type === 'CASH_PAYMENT' || r.type === 'CASH_DEPOSIT') ? `${formatINR(r.nonCashAmount)} (${esc(r.paymentMode)})` : '—')}</td>
                  <td class="text-right font-mono tabular-nums"><strong>${formatINR(r.runningBalance)}</strong></td>
                </tr>
              `).join('') || '<tr><td colspan="8" class="text-center">No transactions recorded for selected date.</td></tr>'}
              <tr style="font-weight:800;">
                <td colspan="5" class="text-right"><strong>Day Totals (${formatDate(date)}):</strong></td>
                <td class="text-right font-mono tabular-nums"><strong>+${formatINR(totalCashIn)}</strong></td>
                <td class="text-right font-mono tabular-nums"><strong>-${formatINR(totalCashOut)}</strong></td>
                <td class="text-right font-mono tabular-nums"><strong>${formatINR(tally.closingCash)}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="a4-avoid-break" style="border:1px solid #000000; padding:8px 10px; font-size:8pt;">
            <div><strong>UPI In:</strong> ${formatINR(tally.upiIn)} &nbsp;|&nbsp; <strong>QR In:</strong> ${formatINR(tally.qrIn)} &nbsp;|&nbsp; <strong>Pending Due (Excluded from Cash In):</strong> ${formatINR(tally.duePendingTotal)}</div>
            <div style="margin-top:3px;"><strong>Opening Cash in Words:</strong> ${esc(numberToWords(tally.openingCash))}</div>
            <div style="margin-top:2px;"><strong>Closing Cash Balance in Words:</strong> ${esc(numberToWords(tally.closingCash))}</div>
          </div>

          ${renderAcknowledgementSection({ includeCustomerSignature: false, dateStr: formatDate(date) })}
        </div>
      `;
      showA4PrintPdfPopup({
        title: `Counter Day Book — ${formatDate(date)}`,
        subtitle: `Opening ${formatINR(tally.openingCash)} · Closing ${formatINR(tally.closingCash)}`,
        bodyHtml,
        defaultFormat: 'a4-landscape',
        pdfConfig: {
          onDownload: () => window.MJK.exportDailyCashPdf(date)
        }
      });
    },

    exportCashRangePdf: async () => {
      const fromDate = OpsState.cashReportFrom;
      const toDate = OpsState.cashReportTo;
      const rows = getCombinedCashRowsForDateRange(fromDate, toDate, OpsState.cashReportQuery);
      const totalAmt = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const headers = ['Ref ID', 'Date', 'Transaction Type', 'Party / Particulars', 'Reference', 'Amount (INR)'];
      const matrix = rows.map(r => [r.id, formatDate(r.date), r.typeLabel, r.partyName, r.reference || '-', formatINR(r.amount)]);
      await exportUniversalPDF({
        filename: `MUN_Cash_Report_${fromDate}_to_${toDate}`,
        title: 'COUNTER CASH FLOW REPORT',
        subtitle: `Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`,
        summaryCards: [
          { label: 'Transactions', value: String(rows.length) },
          { label: 'Total Volume', value: formatINR(totalAmt) }
        ],
        headers,
        rows: matrix,
        totalsRow: ['GRAND TOTAL', `${rows.length} Entries`, '-', numberToWords(totalAmt), '-', formatINR(totalAmt)]
      });
      showToast('Cash Report PDF downloaded.', 'success');
    },

    printCashRangeReport: () => {
      const fromDate = OpsState.cashReportFrom;
      const toDate = OpsState.cashReportTo;
      const rows = getCombinedCashRowsForDateRange(fromDate, toDate, OpsState.cashReportQuery);
      const totalRangeAmt = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      printUniversalReport({
        title: 'INCOME & CASH FLOW STATEMENT',
        subtitle: `Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`,
        filename: `MUN_Cash_Report_${fromDate}_to_${toDate}`,
        summaryCards: [
          { label: 'Total Entries', value: String(rows.length) },
          { label: 'Total Cash Flow', value: formatINR(totalRangeAmt) }
        ],
        headers: ['Ref ID', 'Date', 'Type', 'Party', 'Reference', 'Amount (INR)'],
        rows: rows.map(r => [r.id, formatDate(r.date), r.typeLabel, r.partyName, r.reference || '-', formatINR(r.amount)]),
        totalsRow: ['GRAND TOTAL', `${rows.length} Entries`, '-', numberToWords(totalRangeAmt), '-', formatINR(totalRangeAmt)]
      });
    },

    exportOpeningClosingPdf: async (date = getTodayDate(), mode = 'CLOSING') => {
      const tally = calculateDayTally(date);
      const openDen = normalizeDenominations(tally.openingDenominations);
      const closeDen = normalizeDenominations(tally.denominations);
      const openTotal = calculateDenominationTotal(openDen);
      const closeTotal = calculateDenominationTotal(closeDen);
      await exportUniversalPDF({
        filename: `MUN_Cash_${mode}_${date}`,
        title: mode === 'OPENING' ? 'DAILY OPENING CASH & DENOMINATION REPORT' : 'DAILY CLOSING CASH & RECONCILIATION REPORT',
        subtitle: `Date: ${formatDate(date)} · Expected Closing: ${formatINR(tally.expectedClosing)}`,
        summaryCards: [
          { label: 'Prev Balance', value: formatINR(tally.previousDayBalance) },
          { label: 'Opening Cash', value: formatINR(tally.openingCash) },
          { label: 'Expected Closing', value: formatINR(tally.expectedClosing) },
          { label: 'Physical Closing', value: formatINR(tally.closingCash) }
        ],
        headers: ['Denomination', 'Kind', 'Open Qty', 'Open Total (INR)', 'Close Qty', 'Close Total (INR)'],
        rows: DENOMINATION_SPEC.map(spec => {
          const oq = openDen[spec.key] || 0;
          const cq = closeDen[spec.key] || 0;
          return [spec.pdfLabel, spec.kind === 'note' ? 'Note' : 'Coin', oq, oq * spec.value, cq, cq * spec.value];
        }),
        totalsRow: ['GRAND TOTAL', '-', '-', formatINR(openTotal), '-', formatINR(closeTotal)]
      });
      showToast(`${mode === 'OPENING' ? 'Opening' : 'Closing'} Cash PDF downloaded.`, 'success');
    },

    exportOpeningClosingExcel: (date = getTodayDate(), mode = 'CLOSING') => {
      const tally = calculateDayTally(date);
      const openDen = normalizeDenominations(tally.openingDenominations);
      const closeDen = normalizeDenominations(tally.denominations);
      const openTotal = calculateDenominationTotal(openDen);
      const closeTotal = calculateDenominationTotal(closeDen);
      exportUniversalExcel({
        filename: `MUN_Cash_${mode}_${date}`,
        sheetName: `${mode}_Denomination`,
        title: mode === 'OPENING' ? 'DAILY OPENING CASH & DENOMINATION REPORT' : 'DAILY CLOSING CASH & RECONCILIATION REPORT',
        subtitle: `Date: ${formatDate(date)} | Prev Day Bal: ${tally.previousDayBalance} | Opening: ${tally.openingCash} | Closing: ${tally.closingCash}`,
        headers: ['Denomination', 'Kind', 'Open Qty', 'Open Total (INR)', 'Close Qty', 'Close Total (INR)'],
        rows: DENOMINATION_SPEC.map(spec => {
          const oq = openDen[spec.key] || 0;
          const cq = closeDen[spec.key] || 0;
          return [spec.label, spec.kind === 'note' ? 'Note' : 'Coin', oq, oq * spec.value, cq, cq * spec.value];
        }),
        totalsRow: ['GRAND TOTAL', '', '', openTotal, '', closeTotal]
      });
      showToast(`${mode === 'OPENING' ? 'Opening' : 'Closing'} Cash Excel downloaded.`, 'success');
    },

    exportOpeningClosingCsv: (date = getTodayDate(), mode = 'CLOSING') => {
      const tally = calculateDayTally(date);
      const openDen = normalizeDenominations(tally.openingDenominations);
      const closeDen = normalizeDenominations(tally.denominations);
      const openTotal = calculateDenominationTotal(openDen);
      const closeTotal = calculateDenominationTotal(closeDen);
      exportUniversalCSV({
        filename: `MUN_Cash_${mode}_${date}`,
        title: mode === 'OPENING' ? 'DAILY OPENING CASH & DENOMINATION REPORT' : 'DAILY CLOSING CASH & RECONCILIATION REPORT',
        subtitle: `Date: ${formatDate(date)}`,
        headers: ['Denomination', 'Kind', 'Open Qty', 'Open Total (INR)', 'Close Qty', 'Close Total (INR)'],
        rows: DENOMINATION_SPEC.map(spec => {
          const oq = openDen[spec.key] || 0;
          const cq = closeDen[spec.key] || 0;
          return [spec.label, spec.kind === 'note' ? 'Note' : 'Coin', oq, oq * spec.value, cq, cq * spec.value];
        }),
        totalsRow: ['GRAND TOTAL', '', '', openTotal, '', closeTotal]
      });
      showToast(`${mode === 'OPENING' ? 'Opening' : 'Closing'} Cash CSV downloaded.`, 'success');
    },

    exportStaffAttendanceCSV: () => {
      const currentUser = getCurrentUser();
      const canAll = canViewAllAttendanceScope(currentUser);
      const myUid = currentUser?.uid || currentUser?.id || '';
      const dateFilter = OpsState.attDateFilter || '';
      const staffFilter = canAll ? (OpsState.attStaffFilter || 'all') : myUid;
      const filtered = getAllAttendance().filter(r => (!canAll && myUid ? r.staffId === myUid : true) && (!dateFilter || r.date === dateFilter) && (staffFilter === 'all' || r.staffId === staffFilter));
      exportUniversalCSV({
        filename: `MUN_Staff_Attendance_${dateFilter || 'All'}`,
        title: 'STAFF ATTENDANCE REGISTER',
        subtitle: `Date Filter: ${dateFilter || 'All Dates'}`,
        headers: ['Staff ID', 'Staff Name', 'Date', 'In Time', 'Out Time', 'Late Entry', 'Early Leave', 'Working Hours', 'Status'],
        rows: filtered.map(r => [r.staffId || '-', r.staffName, formatDate(r.date), r.clockIn || '-', r.clockOut || '-', r.lateLabel || 'On Time', r.earlyLeaveLabel || 'Full Shift', r.workingHoursLabel || '0h 00m', r.status]),
        totalsRow: ['TOTAL', `${filtered.length} Records`, '', '', '', '', '', '', 'VERIFIED']
      });
      showToast('Staff Attendance CSV downloaded.', 'success');
    },

    exportStaffAttendanceExcel: () => {
      const currentUser = getCurrentUser();
      const canAll = canViewAllAttendanceScope(currentUser);
      const myUid = currentUser?.uid || currentUser?.id || '';
      const dateFilter = OpsState.attDateFilter || '';
      const staffFilter = canAll ? (OpsState.attStaffFilter || 'all') : myUid;
      const filtered = getAllAttendance().filter(r => (!canAll && myUid ? r.staffId === myUid : true) && (!dateFilter || r.date === dateFilter) && (staffFilter === 'all' || r.staffId === staffFilter));
      exportUniversalExcel({
        filename: `MUN_Staff_Attendance_${dateFilter || 'All'}`,
        sheetName: 'Staff_Attendance',
        title: 'STAFF ATTENDANCE REGISTER',
        subtitle: `Date Filter: ${dateFilter || 'All Dates'}`,
        headers: ['Staff ID', 'Staff Name', 'Date', 'In Time', 'Out Time', 'Late Entry', 'Early Leave', 'Working Hours', 'Status'],
        rows: filtered.map(r => [r.staffId || '-', r.staffName, formatDate(r.date), r.clockIn || '-', r.clockOut || '-', r.lateLabel || 'On Time', r.earlyLeaveLabel || 'Full Shift', r.workingHoursLabel || '0h 00m', r.status]),
        totalsRow: ['TOTAL', `${filtered.length} Records`, '', '', '', '', '', '', '']
      });
      showToast('Staff Attendance Excel (.xlsx) downloaded.', 'success');
    },

    exportStaffAttendancePDF: async () => {
      const currentUser = getCurrentUser();
      const canAll = canViewAllAttendanceScope(currentUser);
      const myUid = currentUser?.uid || currentUser?.id || '';
      const dateFilter = OpsState.attDateFilter || '';
      const staffFilter = canAll ? (OpsState.attStaffFilter || 'all') : myUid;
      const filtered = getAllAttendance().filter(r => (!canAll && myUid ? r.staffId === myUid : true) && (!dateFilter || r.date === dateFilter) && (staffFilter === 'all' || r.staffId === staffFilter));
      await exportUniversalPDF({
        filename: `MUN_Staff_Attendance_${dateFilter || 'All'}`,
        title: 'STAFF ATTENDANCE REGISTER',
        subtitle: `Date Filter: ${dateFilter || 'All Dates'}`,
        headers: ['Staff ID', 'Staff Name', 'Date', 'In Time', 'Out Time', 'Late Entry', 'Working Hours', 'Status'],
        rows: filtered.map(r => [r.staffId || '-', r.staffName, formatDate(r.date), r.clockIn || '-', r.clockOut || '-', r.lateLabel || 'On Time', r.workingHoursLabel || '0h 00m', r.status]),
        totalsRow: ['TOTAL', `${filtered.length} Entries`, '-', '-', '-', '-', '-', 'VERIFIED']
      });
      showToast('Staff Attendance PDF downloaded.', 'success');
    },

    printStaffAttendanceRegister: () => {
      const currentUser = getCurrentUser();
      const canAll = canViewAllAttendanceScope(currentUser);
      const myUid = currentUser?.uid || currentUser?.id || '';
      const dateFilter = OpsState.attDateFilter || '';
      const staffFilter = canAll ? (OpsState.attStaffFilter || 'all') : myUid;
      const filtered = getAllAttendance().filter(r => (!canAll && myUid ? r.staffId === myUid : true) && (!dateFilter || r.date === dateFilter) && (staffFilter === 'all' || r.staffId === staffFilter));
      printUniversalReport({
        title: 'STAFF ATTENDANCE REGISTER',
        subtitle: `Date Filter: ${dateFilter || 'All Dates'}`,
        filename: `MUN_Staff_Attendance_${dateFilter || 'All'}`,
        headers: ['Staff ID', 'Staff Name', 'Date', 'In Time', 'Out Time', 'Late Entry', 'Working Hours', 'Status'],
        rows: filtered.map(r => [r.staffId || '-', r.staffName, formatDate(r.date), r.clockIn || '-', r.clockOut || '-', r.lateLabel || 'On Time', r.workingHoursLabel || '0h 00m', r.status]),
        totalsRow: ['TOTAL', `${filtered.length} Entries`, '-', '-', '-', '-', '-', 'VERIFIED']
      });
    },

    exportTimeRegisterCSV: () => {
      const currentUser = getCurrentUser();
      const canAll = canViewAllAttendanceScope(currentUser);
      const myUid = currentUser?.uid || currentUser?.id || '';
      const date = OpsState.timeRegDate || getTodayDate();
      const dailyRecords = getAllAttendance().filter(r => r.date === date && (canAll || !myUid || r.staffId === myUid));
      exportUniversalCSV({
        filename: `MUN_Time_Register_${date}`,
        title: 'DAILY TIME MANAGEMENT REGISTER',
        subtitle: `Date: ${formatDate(date)}`,
        headers: ['Staff ID', 'Staff Name', 'In-Time', 'Out-Time', 'Working Hours', 'Late Tracking', 'Early Leave', 'Overtime', 'Status'],
        rows: dailyRecords.map(r => [r.staffId || '-', r.staffName, r.clockIn || '-', r.clockOut || '-', r.workingHoursLabel || '0h 00m', r.lateMinutes > 0 ? r.lateLabel : 'On Time', r.earlyLeaveMinutes > 0 ? r.earlyLeaveLabel : 'Full Shift', r.overtimeLabel || '0h 00m', r.status]),
        totalsRow: ['TOTAL', `${dailyRecords.length} Staff`, '', '', '', '', '', '', '']
      });
      showToast('Time Register CSV downloaded.', 'success');
    },

    exportTimeRegisterExcel: () => {
      const currentUser = getCurrentUser();
      const canAll = canViewAllAttendanceScope(currentUser);
      const myUid = currentUser?.uid || currentUser?.id || '';
      const date = OpsState.timeRegDate || getTodayDate();
      const month = OpsState.timeRegMonth || getTodayDate().slice(0, 7);
      const dailyRecords = getAllAttendance().filter(r => r.date === date && (canAll || !myUid || r.staffId === myUid));
      const monthlyReport = getMonthlyAttendanceReport(month, canAll ? 'all' : myUid);
      exportUniversalExcel({
        filename: `MUN_Time_Register_${date}`,
        sheetName: 'Daily_Time_Register',
        title: 'DAILY TIME MANAGEMENT REGISTER',
        subtitle: `Date: ${formatDate(date)}`,
        headers: ['Staff ID', 'Staff Name', 'In-Time', 'Out-Time', 'Working Hours', 'Late Tracking', 'Early Leave', 'Overtime', 'Status'],
        rows: dailyRecords.map(r => [r.staffId || '-', r.staffName, r.clockIn || '-', r.clockOut || '-', r.workingHoursLabel || '0h 00m', r.lateMinutes > 0 ? r.lateLabel : 'On Time', r.earlyLeaveMinutes > 0 ? r.earlyLeaveLabel : 'Full Shift', r.overtimeLabel || '0h 00m', r.status]),
        totalsRow: ['TOTAL', `${dailyRecords.length} Staff`, '', '', '', '', '', '', ''],
        extraSheets: [{
          sheetName: 'Monthly_Summary',
          title: `MONTHLY TIME PERFORMANCE (${month})`,
          headers: ['Staff ID', 'Staff Name', 'Present', 'Late', 'Early Leaves', 'Working Hours', 'Overtime', 'Punctuality %'],
          rows: monthlyReport.staffRows.map(s => [s.staffId, s.staffName, s.presentDays, s.lateDays, s.earlyLeaveDays, s.totalWorkingLabel, s.totalOvertimeLabel, `${s.onTimePct}%`])
        }]
      });
      showToast('Time Register Excel (.xlsx) downloaded.', 'success');
    },

    exportTimeRegisterPDF: async () => {
      const currentUser = getCurrentUser();
      const canAll = canViewAllAttendanceScope(currentUser);
      const myUid = currentUser?.uid || currentUser?.id || '';
      const date = OpsState.timeRegDate || getTodayDate();
      const dailyRecords = getAllAttendance().filter(r => r.date === date && (canAll || !myUid || r.staffId === myUid));
      await exportUniversalPDF({
        filename: `MUN_Time_Register_${date}`,
        title: 'DAILY TIME MANAGEMENT REGISTER',
        subtitle: `Date: ${formatDate(date)}`,
        headers: ['Staff ID', 'Staff Name', 'In-Time', 'Out-Time', 'Working Hours', 'Late Tracking', 'Overtime', 'Status'],
        rows: dailyRecords.map(r => [r.staffId || '-', r.staffName, r.clockIn || '-', r.clockOut || '-', r.workingHoursLabel || '0h 00m', r.lateMinutes > 0 ? r.lateLabel : 'On Time', r.overtimeLabel || '0h 00m', r.status]),
        totalsRow: ['TOTAL', `${dailyRecords.length} Staff`, '-', '-', '-', '-', '-', 'VERIFIED']
      });
      showToast('Time Register PDF downloaded.', 'success');
    },

    printTimeRegisterReport: () => {
      const currentUser = getCurrentUser();
      const canAll = canViewAllAttendanceScope(currentUser);
      const myUid = currentUser?.uid || currentUser?.id || '';
      const date = OpsState.timeRegDate || getTodayDate();
      const dailyRecords = getAllAttendance().filter(r => r.date === date && (canAll || !myUid || r.staffId === myUid));
      printUniversalReport({
        title: 'DAILY TIME MANAGEMENT REGISTER',
        subtitle: `Date: ${formatDate(date)}`,
        filename: `MUN_Time_Register_${date}`,
        headers: ['Staff ID', 'Staff Name', 'In-Time', 'Out-Time', 'Working Hours', 'Late Tracking', 'Overtime', 'Status'],
        rows: dailyRecords.map(r => [r.staffId || '-', r.staffName, r.clockIn || '-', r.clockOut || '-', r.workingHoursLabel || '0h 00m', r.lateMinutes > 0 ? r.lateLabel : 'On Time', r.overtimeLabel || '0h 00m', r.status]),
        totalsRow: ['TOTAL', `${dailyRecords.length} Staff`, '-', '-', '-', '-', '-', 'VERIFIED']
      });
    },

    exportAttendanceReportCsv: () => {
      const report = getMonthlyAttendanceReport(OpsState.attReportMonth, OpsState.attReportStaff);
      downloadCSV(
        `MUN_Attendance_Report_${OpsState.attReportMonth}`,
        report.staffRows.map(s => ({
          Staff_ID: s.staffId,
          Staff_Name: s.staffName,
          Present: s.presentDays,
          Half_Day: s.halfDays,
          Absent: s.absentDays,
          Leave: s.leaveDays,
          Late_Days: s.lateDays,
          Working_Hours: s.totalWorkingLabel,
          Overtime_Hours: s.totalOvertimeLabel,
          GPS_Punches: s.gpsPunches,
          On_Time_Percent: `${s.onTimePct}%`
        })),
        [
          { key: 'Staff_ID', label: 'Staff ID' },
          { key: 'Staff_Name', label: 'Staff Name' },
          { key: 'Present', label: 'Present' },
          { key: 'Half_Day', label: 'Half Day' },
          { key: 'Absent', label: 'Absent' },
          { key: 'Leave', label: 'Leave' },
          { key: 'Late_Days', label: 'Late Days' },
          { key: 'Working_Hours', label: 'Working Hours' },
          { key: 'Overtime_Hours', label: 'Overtime Hours' },
          { key: 'GPS_Punches', label: 'GPS Punches' },
          { key: 'On_Time_Percent', label: 'On-Time %' }
        ],
        `MONTHLY ATTENDANCE REPORT (${OpsState.attReportMonth})`
      );
      showToast('Monthly Attendance CSV downloaded.', 'success');
    },

    exportAttendanceReportExcel: () => {
      const report = getMonthlyAttendanceReport(OpsState.attReportMonth, OpsState.attReportStaff);
      downloadExcelSheet(
        `MUN_Attendance_Report_${OpsState.attReportMonth}`,
        'Attendance_Report',
        report.staffRows.map(s => ({
          'Staff ID': s.staffId,
          'Staff Name': s.staffName,
          'Present': s.presentDays,
          'Half Day': s.halfDays,
          'Absent': s.absentDays,
          'Leave': s.leaveDays,
          'Late Days': s.lateDays,
          'Working Hours': s.totalWorkingLabel,
          'Overtime Hours': s.totalOvertimeLabel,
          'GPS Punches': s.gpsPunches,
          'On-Time %': `${s.onTimePct}%`
        })),
        'No attendance records found',
        `MONTHLY ATTENDANCE REPORT (${OpsState.attReportMonth})`
      );
      showToast('Monthly Attendance Excel (.xlsx) downloaded.', 'success');
    },

    exportAttendanceReportPdf: async () => {
      const report = getMonthlyAttendanceReport(OpsState.attReportMonth, OpsState.attReportStaff);
      const headers = ['Staff ID', 'Staff Name', 'Present', 'Half Day', 'Absent', 'Leave', 'Late', 'Work Hrs', 'Overtime', 'On-Time %'];
      const rows = report.staffRows.map(s => [
        s.staffId, s.staffName, s.presentDays, s.halfDays, s.absentDays, s.leaveDays, s.lateDays,
        s.totalWorkingLabel, s.totalOvertimeLabel, `${s.onTimePct}%`
      ]);
      const totals = buildSumTotalsRow(headers, rows, [2, 3, 4, 5, 6], 'GRAND TOTAL');
      await exportUniversalPDF({
        filename: `MUN_Attendance_Report_${OpsState.attReportMonth}`,
        title: `MONTHLY ATTENDANCE REPORT (${OpsState.attReportMonth})`,
        subtitle: `Staff Count: ${report.staffRows.length}`,
        headers,
        rows,
        totalsRow: totals
      });
      showToast('Monthly Attendance PDF downloaded.', 'success');
    },

    printMonthlyAttendanceReport: () => {
      const report = getMonthlyAttendanceReport(OpsState.attReportMonth, OpsState.attReportStaff);
      const headers = ['Staff', 'Present', 'Half Day', 'Absent', 'Leave', 'Late', 'Work Hrs', 'Overtime', 'On-Time %'];
      const rows = report.staffRows.map(s => [
        s.staffName, s.presentDays, s.halfDays, s.absentDays, s.leaveDays, s.lateDays,
        s.totalWorkingLabel, s.totalOvertimeLabel, `${s.onTimePct}%`
      ]);
      printUniversalReport({
        title: `MONTHLY ATTENDANCE REPORT (${OpsState.attReportMonth})`,
        subtitle: `Staff Count: ${report.staffRows.length}`,
        filename: `MUN_Attendance_Report_${OpsState.attReportMonth}`,
        headers,
        rows,
        totalsRow: buildSumTotalsRow(headers, rows, [1, 2, 3, 4, 5], 'GRAND TOTAL')
      });
    }
  };
}
