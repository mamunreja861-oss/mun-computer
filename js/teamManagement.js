/**
 * teamManagement.js - Complete 7-Submenu TEAM MANAGEMENT Suite
 * MUN COMPUTER Smart Business Manager
 *
 * Submenus:
 * 1. Staff Directory & Profiles      (staff-directory)
 * 2. Attendance & Live Tracking      (attendance-tracking - merged: Daily, GPS Check-In, Map, Verified Photo Gallery)
 * 3. Time Management Register        (time-register - shift rules, In/Out, overtime & productivity log)
 * 4. Staff & Tasks Assignment        (tasks - staff-wise assignment, progress tracking & sync)
 * 5. Team Chat & Messaging           (chat - via chat.js)
 * 6. Document Vault                  (documents - central server vault + staff confidential/verification docs)
 * 7. Employee Performance & Reports  (employee-reports - monthly attendance, tasks & universal Print/PDF/Excel/CSV)
 */

import {
  KEYS,
  getItem,
  setItem,
  getTodayDate,
  formatDate,
  getAuthHeaders,
  logAuditAction,
  allocateGlobalReference,
  markGlobalReferenceDeleted
} from './storage.js';
import { getCurrentUser, isSuperAdmin, canMenu, formatRoleLabel } from './auth.js';
import { getAllUsers, fetchUsersFromBackend } from './settings.js';
import {
  getAllAttendance,
  getMonthlyAttendanceReport,
  formatMinutesAsDuration,
  syncAttendanceRecordsFromServer,
  fetchAttendancePhotosFromServer
} from './payroll.js';
import {
  renderStaffAttendanceView,
  renderGpsAttendanceView,
  renderStaffLocationMapView,
  renderAttendancePhotoGalleryView,
  renderTimeRegisterView,
  stopActiveAttendanceCamera
} from './operationsCenter.js';
import {
  generateReportId,
  exportUniversalCSV,
  exportUniversalExcel,
  exportUniversalPDF,
  printUniversalReport,
  buildSumTotalsRow
} from './exportUtility.js';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const TeamState = {
  hydratedTeamState: false,
  hydratedUsers: false,
  hydratedDocs: false,
  dirSearch: '',
  dirRoleFilter: 'all',
  dirStatusFilter: 'all',
  prodDateFilter: getTodayDate(),
  prodStaffFilter: 'all',
  taskSearch: '',
  taskStaffFilter: 'all',
  taskStatusFilter: 'all',
  taskPriorityFilter: 'all',
  docSearch: '',
  docCategoryFilter: 'all',
  docStaffFilter: 'all',
  perfMonth: getTodayDate().slice(0, 7),
  perfStaffFilter: 'all',
  perfReportType: 'performance_matrix'
};

let _teamSyncTimer = null;

export function getAllProductivityLogs() {
  return getItem(KEYS.TIME_PRODUCTIVITY_LOGS, []);
}

export function getAllTeamTasks() {
  return getItem(KEYS.TASKS, []);
}

export function getTeamStateBundle() {
  return {
    tasks: getAllTeamTasks(),
    timeLogs: getAllProductivityLogs(),
    shiftConfig: getItem(KEYS.SHIFT_CONFIG, null)
  };
}

export async function pushTeamStateToServer() {
  if (typeof fetch !== 'function' || !getCurrentUser()) return false;
  try {
    const resp = await fetch('/api/team/state', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(getTeamStateBundle())
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export function scheduleTeamServerSync() {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  if (!getCurrentUser()) return;
  if (_teamSyncTimer) clearTimeout(_teamSyncTimer);
  _teamSyncTimer = setTimeout(() => {
    _teamSyncTimer = null;
    pushTeamStateToServer();
  }, 350);
}

export async function syncTeamStateFromServer() {
  if (typeof fetch !== 'function' || !getCurrentUser()) return null;
  try {
    const resp = await fetch('/api/team/state', { headers: getAuthHeaders() });
    if (!resp.ok) return null;
    const data = await resp.json();
    const ts = data?.teamState;
    if (!ts || typeof ts !== 'object') return null;

    if (Array.isArray(ts.tasks) && (ts.updatedAt || ts.tasks.length > 0 || getAllTeamTasks().length === 0)) {
      setItem(KEYS.TASKS, ts.tasks);
    }
    if (Array.isArray(ts.timeLogs) && (ts.updatedAt || ts.timeLogs.length > 0 || getAllProductivityLogs().length === 0)) {
      setItem(KEYS.TIME_PRODUCTIVITY_LOGS, ts.timeLogs);
    }
    if (ts.shiftConfig && typeof ts.shiftConfig === 'object') {
      setItem(KEYS.SHIFT_CONFIG, ts.shiftConfig);
    }
    return ts;
  } catch {
    return null;
  }
}

export async function syncTeamDocumentsFromServer() {
  if (typeof fetch !== 'function' || !getCurrentUser()) return [];
  try {
    const resp = await fetch('/api/documents', { headers: getAuthHeaders() });
    if (!resp.ok) return getItem(KEYS.DOCUMENTS, []);
    const data = await resp.json();
    const serverDocs = Array.isArray(data?.documents) ? data.documents : [];
    const localDocs = getItem(KEYS.DOCUMENTS, []);
    const map = new Map();

    serverDocs.forEach((d) => {
      if (!d || !d.id) return;
      map.set(d.id, {
        id: d.id,
        name: d.title || d.fileName || d.id,
        category: d.category || 'Other Documents',
        customerId: d.customerId || '',
        applicationId: d.applicationId || '',
        staffUid: d.userId || '',
        uploadDate: d.createdAt ? String(d.createdAt).split('T')[0] : getTodayDate(),
        expiryDate: d.expiryDate || '',
        file: d.fileName || 'Stored on server',
        downloadUrl: `/api/documents/${encodeURIComponent(d.id)}/download`,
        remarks: d.remarks || '',
        uploadedByUid: d.uploadedByUid || '',
        fromServer: true
      });
    });

    localDocs.forEach((d) => {
      if (d && d.id && !map.has(d.id)) {
        map.set(d.id, d);
      }
    });

    const merged = Array.from(map.values()).sort((a, b) =>
      String(b.uploadDate || '').localeCompare(String(a.uploadDate || ''))
    );
    setItem(KEYS.DOCUMENTS, merged);
    return merged;
  } catch {
    return getItem(KEYS.DOCUMENTS, []);
  }
}

function ensureTeamHydration(kind, rerenderFn) {
  if (kind === 'users' && !TeamState.hydratedUsers) {
    TeamState.hydratedUsers = true;
    fetchUsersFromBackend().then(() => { if (rerenderFn) rerenderFn(); });
  } else if (kind === 'team' && !TeamState.hydratedTeamState) {
    TeamState.hydratedTeamState = true;
    Promise.allSettled([
      syncTeamStateFromServer(),
      fetchUsersFromBackend(),
      syncAttendanceRecordsFromServer()
    ]).then(() => { if (rerenderFn) rerenderFn(); });
  } else if (kind === 'docs' && !TeamState.hydratedDocs) {
    TeamState.hydratedDocs = true;
    Promise.allSettled([
      syncTeamDocumentsFromServer(),
      fetchUsersFromBackend()
    ]).then(() => { if (rerenderFn) rerenderFn(); });
  }
}

function getScopedTeamUsers() {
  const users = getAllUsers();
  return users.slice().sort((a, b) => {
    const order = { ADMIN: 0, MANAGER: 1, CHECKER: 2, MAKER: 3, STAFF: 4 };
    const ra = order[String(a.role || 'STAFF').toUpperCase()] ?? 5;
    const rb = order[String(b.role || 'STAFF').toUpperCase()] ?? 5;
    if (ra !== rb) return ra - rb;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function canViewAllTeamScope(user = getCurrentUser()) {
  if (!user) return false;
  const r = String(user.role || '').toUpperCase();
  return isSuperAdmin(user) || r === 'ADMIN' || r === 'MANAGER';
}

function isAdminUser(user = getCurrentUser()) {
  if (!user) return false;
  return isSuperAdmin(user) || String(user.role || '').toUpperCase() === 'ADMIN';
}

/* =========================================================================
   1. STAFF DIRECTORY & PROFILES VIEW (staff-directory)
   ========================================================================= */
export function renderStaffDirectoryView() {
  ensureTeamHydration('users', () => window.MJK?.renderApp?.());
  const currentUser = getCurrentUser();
  const isAdminActor = isAdminUser(currentUser);
  const canPrint = canMenu('staff-directory', 'print') || isAdminActor;
  const canExport = canMenu('staff-directory', 'export') || isAdminActor || String(currentUser?.role || '').toUpperCase() === 'MANAGER';

  const users = getScopedTeamUsers();
  const today = getTodayDate();
  const todayAtt = getAllAttendance().filter(a => a.date === today);
  const allTasks = getAllTeamTasks();

  const q = (TeamState.dirSearch || '').trim().toLowerCase();
  const filtered = users.filter((u) => {
    const roleUpper = String(u.role || 'STAFF').toUpperCase();
    const statusUpper = String(u.status || 'ACTIVE').toUpperCase();
    if (TeamState.dirRoleFilter !== 'all' && roleUpper !== TeamState.dirRoleFilter) return false;
    if (TeamState.dirStatusFilter !== 'all' && statusUpper !== TeamState.dirStatusFilter) return false;
    if (q) {
      const hay = [
        u.name,
        u.uid,
        u.requestId,
        u.role,
        u.designation,
        u.phone,
        u.phoneMasked,
        u.email,
        u.district,
        u.blockOrMunicipality,
        u.villageOrLocality
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const activeCount = users.filter(u => u.status === 'ACTIVE').length;
  const staffCount = users.filter(u => ['STAFF', 'MAKER', 'CHECKER'].includes(String(u.role || '').toUpperCase())).length;
  const managerCount = users.filter(u => String(u.role || '').toUpperCase() === 'MANAGER').length;
  const pendingCount = users.filter(u => u.status === 'PENDING_APPROVAL' || u.status === 'CORRECTION_REQUIRED').length;

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">👥 Staff Directory &amp; Profiles</h2>
        <p class="page-subtitle">সকল স্টাফের তালিকা, ভূমিকা ও কন্টাক্ট ইনফো — Complete team roster, roles, contact details &amp; profile insights</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.refreshStaffDirectory()">↻ Sync Roster</button>
        ${canPrint ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportStaffDirectory('print')">🖨 Print</button>` : ''}
        ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportStaffDirectory('pdf')">📄 PDF</button>` : ''}
        ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportStaffDirectory('excel')">📊 Excel</button>` : ''}
        ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportStaffDirectory('csv')">📥 CSV</button>` : ''}
        ${isAdminActor ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('admin-managers')">🛡️ Manage Roles &amp; Accounts</button>` : ''}
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(165px, 1fr)); gap:0.85rem; margin-bottom:1.15rem;">
      <div class="stat-card"><div class="stat-label">Total Roster</div><div class="stat-value tabular-nums">${users.length}</div></div>
      <div class="stat-card"><div class="stat-label">Active Members</div><div class="stat-value tabular-nums" style="color:var(--success);">${activeCount}</div></div>
      <div class="stat-card"><div class="stat-label">Staff / Operators</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${staffCount}</div></div>
      <div class="stat-card"><div class="stat-label">Managers</div><div class="stat-value tabular-nums">${managerCount}</div></div>
      <div class="stat-card"><div class="stat-label">Pending Approval</div><div class="stat-value tabular-nums" style="color:${pendingCount > 0 ? 'var(--warning)' : 'var(--text-muted)'};">${pendingCount}</div></div>
    </div>

    <div class="card" style="padding:0.9rem 1.1rem; margin-bottom:1.15rem;">
      <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:flex-end;">
        <div style="flex:1; min-width:min(100%, 220px);">
          <label class="form-label" style="font-size:0.75rem;">Search Staff Name, UID, Designation or Contact</label>
          <input id="team-dir-search" type="text" class="form-control" placeholder="Search name, MC26..., mobile, role..." value="${esc(TeamState.dirSearch)}" oninput="window.MJK.setTeamFilter('dirSearch', this.value)">
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">Role</label>
          <select class="form-control" onchange="window.MJK.setTeamFilter('dirRoleFilter', this.value)">
            <option value="all" ${TeamState.dirRoleFilter === 'all' ? 'selected' : ''}>All Roles</option>
            <option value="ADMIN" ${TeamState.dirRoleFilter === 'ADMIN' ? 'selected' : ''}>Administration</option>
            <option value="MANAGER" ${TeamState.dirRoleFilter === 'MANAGER' ? 'selected' : ''}>Manager</option>
            <option value="STAFF" ${TeamState.dirRoleFilter === 'STAFF' ? 'selected' : ''}>Staff</option>
            <option value="CHECKER" ${TeamState.dirRoleFilter === 'CHECKER' ? 'selected' : ''}>Checker</option>
            <option value="MAKER" ${TeamState.dirRoleFilter === 'MAKER' ? 'selected' : ''}>Maker</option>
          </select>
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">Account Status</label>
          <select class="form-control" onchange="window.MJK.setTeamFilter('dirStatusFilter', this.value)">
            <option value="all" ${TeamState.dirStatusFilter === 'all' ? 'selected' : ''}>All Status</option>
            <option value="ACTIVE" ${TeamState.dirStatusFilter === 'ACTIVE' ? 'selected' : ''}>Active</option>
            <option value="PENDING_APPROVAL" ${TeamState.dirStatusFilter === 'PENDING_APPROVAL' ? 'selected' : ''}>Pending Approval</option>
            <option value="SUSPENDED" ${TeamState.dirStatusFilter === 'SUSPENDED' ? 'selected' : ''}>Suspended</option>
          </select>
        </div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <h3 style="margin:0; font-size:1rem;">Team Roster &amp; Contact Directory (${filtered.length} members)</h3>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff Member &amp; UID</th>
              <th>Role &amp; Designation</th>
              <th>Contact Info</th>
              <th>Location</th>
              <th>Today Attendance</th>
              <th>Open Tasks</th>
              <th>Status</th>
              <th style="text-align:right;">Profile</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((u) => {
              const uid = u.uid || u.id || u.requestId || '-';
              const att = todayAtt.find(a => a.staffId === uid);
              const openTasks = allTasks.filter(t => (t.assignedUid === uid || t.assignedName === u.name) && t.status !== 'Completed').length;
              const phoneShow = u.phone || u.phoneMasked || '-';
              const st = String(u.status || 'ACTIVE').toUpperCase();
              const stBadge = st === 'ACTIVE' ? 'badge-success' : st === 'SUSPENDED' || st === 'REJECTED' ? 'badge-danger' : 'badge-warning';
              const roleBadge = String(u.role || '').toUpperCase() === 'ADMIN' ? 'badge-violet' : String(u.role || '').toUpperCase() === 'MANAGER' ? 'badge-info' : 'badge-neutral';
              return `
                <tr>
                  <td>
                    <div style="font-weight:700;">${esc(u.name || 'Unnamed Staff')}</div>
                    <div class="font-mono" style="font-size:0.72rem; color:var(--blue-600);">${esc(uid)}</div>
                  </td>
                  <td>
                    <span class="badge ${roleBadge}">${esc(formatRoleLabel(u.role || 'STAFF'))}</span>
                    <div style="font-size:0.74rem; color:var(--text-muted); margin-top:2px;">${esc(u.designation || 'Counter Executive')}</div>
                  </td>
                  <td style="font-size:0.8rem;">
                    <div class="tabular-nums">📞 ${esc(phoneShow)}</div>
                    <div style="font-size:0.73rem; color:var(--text-muted);">${esc(u.email || '-')}</div>
                  </td>
                  <td style="font-size:0.78rem; color:var(--text-muted);">
                    ${esc([u.villageOrLocality, u.blockOrMunicipality, u.district].filter(Boolean).join(', ') || 'Murshidabad')}
                  </td>
                  <td>
                    ${att
                      ? `<span class="badge ${att.status === 'Present' ? 'badge-success' : att.status === 'Half Day' ? 'badge-warning' : 'badge-danger'}">${esc(att.status)}</span>
                         <div class="tabular-nums" style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">In: ${esc(att.clockIn || '-')}</div>`
                      : `<span style="font-size:0.76rem; color:var(--text-muted);">Not Marked</span>`}
                  </td>
                  <td class="tabular-nums" style="font-weight:700; color:${openTasks > 0 ? 'var(--warning)' : 'var(--text-muted)'};">${openTasks}</td>
                  <td><span class="badge ${stBadge}">${esc(st.replace(/_/g, ' '))}</span></td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.viewEmployeeProfileById('${esc(uid)}')" title="Open Centralized Employee Profile (Attendance, Leaves, Payroll, KPI, Docs)">Profile</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openStaffProfileModal('${esc(uid)}')" title="Quick Summary Modal">Quick View</button>
                  </td>
                </tr>
              `;
            }).join('') || `
              <tr>
                <td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">
                  No staff members match the current search filter.
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
   2. MERGED ATTENDANCE & LIVE TRACKING VIEW (attendance-tracking)
   ========================================================================= */
export function renderAttendanceLiveTrackingView(appState) {
  const currentUser = getCurrentUser();
  const activeTab = appState.attendanceTab || 'daily';

  const tabs = [
    { id: 'daily', label: 'Daily Attendance', icon: '🧑‍💼', menuId: 'staff-attendance' },
    { id: 'gps', label: 'GPS Location & Check-In', icon: '📍', menuId: 'gps-attendance' },
    { id: 'map', label: 'Photo & Location Map', icon: '🗺️', menuId: 'staff-location-map' },
    { id: 'gallery', label: 'Verified Photo Gallery', icon: '📸', menuId: 'attendance-photo-gallery' }
  ].filter(t => canMenu(t.menuId, 'view', currentUser) || canMenu('attendance-tracking', 'view', currentUser));

  const effectiveTab = tabs.some(t => t.id === activeTab) ? activeTab : (tabs[0]?.id || 'daily');
  if (appState.attendanceTab !== effectiveTab) {
    appState.attendanceTab = effectiveTab;
  }

  let bodyHtml = '';
  if (effectiveTab === 'gps') {
    bodyHtml = renderGpsAttendanceView({ embedded: true });
  } else if (effectiveTab === 'map') {
    bodyHtml = renderStaffLocationMapView({ embedded: true });
  } else if (effectiveTab === 'gallery') {
    bodyHtml = renderAttendancePhotoGalleryView({ embedded: true });
  } else {
    bodyHtml = renderStaffAttendanceView({ embedded: true });
  }

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">📍 Attendance &amp; Live Tracking</h2>
        <p class="page-subtitle">ডেইলি অ্যাটেন্ডেন্স, লাইভ জিপিএস লোকেশন, চেক-ইন ফটো এবং ভেরিফাইড ফটো গ্যালারি — Unified Attendance &amp; Live Verification Hub</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('time-register')">⏱️ Time Register</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('employee-reports')">📊 Performance Reports</button>
      </div>
    </div>

    <div class="tabs-bar" role="tablist" aria-label="Attendance & Live Tracking Sections">
      ${tabs.map(t => `
        <button
          type="button"
          role="tab"
          aria-selected="${effectiveTab === t.id ? 'true' : 'false'}"
          class="tab-btn ${effectiveTab === t.id ? 'active' : ''}"
          onclick="window.MJK.switchAttendanceTab('${t.id}')"
        >
          <span>${t.icon}</span>
          <span>${t.label}</span>
        </button>
      `).join('')}
    </div>

    <div role="tabpanel">
      ${bodyHtml}
    </div>
  `;
}

/* =========================================================================
   3. TIME MANAGEMENT REGISTER + PRODUCTIVITY LOG (time-register)
   ========================================================================= */
export function renderTimeManagementView() {
  ensureTeamHydration('team', () => window.MJK?.renderApp?.());
  const baseHtml = renderTimeRegisterView();

  const currentUser = getCurrentUser();
  const canAll = canViewAllTeamScope(currentUser);
  const myUid = currentUser?.uid || currentUser?.id || '';
  const staffList = canAll ? getScopedTeamUsers().filter(u => u.status === 'ACTIVE') : getScopedTeamUsers().filter(u => (u.uid || u.id) === myUid);

  const prodLogs = getAllProductivityLogs().filter((log) => {
    if (!canAll && myUid && log.staffUid !== myUid) return false;
    if (TeamState.prodDateFilter && log.date !== TeamState.prodDateFilter) return false;
    if (canAll && TeamState.prodStaffFilter !== 'all' && log.staffUid !== TeamState.prodStaffFilter) return false;
    return true;
  });

  const totalUnits = prodLogs.reduce((s, l) => s + (Number(l.unitsCompleted) || 0), 0);
  const totalProdHours = prodLogs.reduce((s, l) => s + (Number(l.productiveHours) || 0), 0);

  const canAdd = canMenu('time-register', 'add') || canAll;
  const canDelete = isAdminUser(currentUser) || canMenu('time-register', 'delete');

  return `
    ${baseHtml}

    <div class="table-card" style="margin-top:1.5rem;">
      <div class="table-toolbar" style="flex-wrap:wrap; gap:0.75rem;">
        <div class="table-toolbar-left">
          <h3 style="margin:0; font-size:1rem;">📈 Staff Productivity &amp; Work Output Log (${prodLogs.length} entries)</h3>
          <div style="font-size:0.76rem; color:var(--text-muted); margin-top:0.15rem;">
            Total Output: <strong class="tabular-nums">${totalUnits}</strong> tasks/services · Logged Productive Hours: <strong class="tabular-nums">${totalProdHours.toFixed(1)}h</strong>
          </div>
        </div>
        <div class="table-toolbar-right" style="display:flex; gap:0.45rem; flex-wrap:wrap; align-items:center;">
          <input type="date" class="form-control" style="width:auto;" value="${esc(TeamState.prodDateFilter)}" onchange="window.MJK.setTeamFilter('prodDateFilter', this.value)">
          ${TeamState.prodDateFilter ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.setTeamFilter('prodDateFilter', '')">All Dates</button>` : ''}
          ${canAll ? `
            <select class="form-control" style="width:auto;" onchange="window.MJK.setTeamFilter('prodStaffFilter', this.value)">
              <option value="all" ${TeamState.prodStaffFilter === 'all' ? 'selected' : ''}>All Staff (${staffList.length})</option>
              ${staffList.map(u => `<option value="${esc(u.uid || u.id)}" ${TeamState.prodStaffFilter === (u.uid || u.id) ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
            </select>
          ` : ''}
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportProductivityReport('print')">🖨 Print</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportProductivityReport('pdf')">📄 PDF</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportProductivityReport('excel')">📊 Excel</button>
          ${canAdd ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openProductivityLogModal()">+ Log Work Productivity</button>` : ''}
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Staff Name &amp; UID</th>
              <th>Work Summary / Counter Output</th>
              <th style="text-align:right;">Units Completed</th>
              <th style="text-align:right;">Productive Hrs</th>
              <th style="text-align:right;">Break (Mins)</th>
              <th>Efficiency Note</th>
              ${canDelete ? `<th style="text-align:right;">Actions</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${prodLogs.map(l => `
              <tr>
                <td class="date tabular-nums">${formatDate(l.date)}</td>
                <td>
                  <div style="font-weight:700;">${esc(l.staffName)}</div>
                  <div class="font-mono" style="font-size:0.7rem; color:var(--text-muted);">${esc(l.staffUid)}</div>
                </td>
                <td style="font-weight:600;">${esc(l.workSummary)}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700; color:var(--blue-600);">${Number(l.unitsCompleted) || 0}</td>
                <td class="tabular-nums" style="text-align:right; font-weight:700; color:var(--success);">${Number(l.productiveHours || 0).toFixed(1)}h</td>
                <td class="tabular-nums" style="text-align:right;">${Number(l.breakMinutes) || 0}m</td>
                <td style="font-size:0.78rem; color:var(--text-muted);">${esc(l.notes || '-')}</td>
                ${canDelete ? `
                  <td style="text-align:right;">
                    <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteProductivityLog('${esc(l.id)}')">🗑</button>
                  </td>
                ` : ''}
              </tr>
            `).join('') || `
              <tr>
                <td colspan="${canDelete ? 8 : 7}" style="text-align:center; padding:1.75rem; color:var(--text-muted);">
                  No productivity logs recorded for this filter. Use <strong>+ Log Work Productivity</strong> to record daily counter output.
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
   4. STAFF & TASKS ASSIGNMENT VIEW (tasks)
   ========================================================================= */
export function renderStaffTasksView() {
  ensureTeamHydration('team', () => window.MJK?.renderApp?.());
  const currentUser = getCurrentUser();
  const canAll = canViewAllTeamScope(currentUser);
  const canAdd = canMenu('tasks', 'add') || canAll;
  const canEdit = canMenu('tasks', 'edit') || canAll;
  const canDelete = canMenu('tasks', 'delete') || isAdminUser(currentUser);
  const users = getScopedTeamUsers();
  const tasks = getAllTeamTasks();
  const today = getTodayDate();

  const q = (TeamState.taskSearch || '').trim().toLowerCase();
  const filtered = tasks.filter((t) => {
    if (TeamState.taskStaffFilter !== 'all') {
      const targetUid = t.assignedUid || '';
      const targetName = t.assignedName || t.assignedTo || '';
      if (targetUid !== TeamState.taskStaffFilter && targetName !== TeamState.taskStaffFilter) return false;
    }
    if (TeamState.taskStatusFilter !== 'all' && (t.status || 'Pending') !== TeamState.taskStatusFilter) return false;
    if (TeamState.taskPriorityFilter !== 'all' && (t.priority || 'Medium') !== TeamState.taskPriorityFilter) return false;
    if (q) {
      const hay = `${t.id || ''} ${t.title || ''} ${t.assignedName || ''} ${t.category || ''} ${t.notes || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const pendingCnt = tasks.filter(t => (t.status || 'Pending') === 'Pending').length;
  const inProgressCnt = tasks.filter(t => t.status === 'In Progress').length;
  const completedCnt = tasks.filter(t => t.status === 'Completed').length;
  const overdueCnt = tasks.filter(t => t.status !== 'Completed' && t.deadline && t.deadline < today).length;

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">📋 Staff &amp; Tasks Assignment</h2>
        <p class="page-subtitle">কর্মী অনুযায়ী টাস্ক অ্যাসাইনমেন্ট ও প্রোগ্রেস ট্র্যাকিং — Assign daily counter tasks, monitor progress &amp; verify completion</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('tasks', 'print')">🖨 Print</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('tasks', 'pdf')">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('tasks', 'excel')">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('tasks', 'csv')">📥 CSV</button>
        ${canAdd ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openTaskModal()">+ Assign New Task</button>` : ''}
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:0.85rem; margin-bottom:1.15rem;">
      <div class="stat-card"><div class="stat-label">Total Tasks</div><div class="stat-value tabular-nums">${tasks.length}</div></div>
      <div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value tabular-nums" style="color:var(--warning);">${pendingCnt}</div></div>
      <div class="stat-card"><div class="stat-label">In Progress</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${inProgressCnt}</div></div>
      <div class="stat-card"><div class="stat-label">Completed</div><div class="stat-value tabular-nums" style="color:var(--success);">${completedCnt}</div></div>
      <div class="stat-card"><div class="stat-label">Overdue</div><div class="stat-value tabular-nums" style="color:${overdueCnt > 0 ? 'var(--danger)' : 'var(--text-muted)'};">${overdueCnt}</div></div>
    </div>

    <div class="card" style="padding:0.9rem 1.1rem; margin-bottom:1.15rem;">
      <div style="display:flex; gap:0.7rem; flex-wrap:wrap; align-items:flex-end;">
        <div style="flex:1; min-width:min(100%, 200px);">
          <label class="form-label" style="font-size:0.75rem;">Search Task / Assignee / Category</label>
          <input id="team-task-search" type="text" class="form-control" placeholder="Search tasks..." value="${esc(TeamState.taskSearch)}" oninput="window.MJK.setTeamFilter('taskSearch', this.value)">
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">Staff Member</label>
          <select class="form-control" onchange="window.MJK.setTeamFilter('taskStaffFilter', this.value)">
            <option value="all" ${TeamState.taskStaffFilter === 'all' ? 'selected' : ''}>All Staff</option>
            ${users.map(u => {
              const key = u.uid || u.id || u.name;
              return `<option value="${esc(key)}" ${TeamState.taskStaffFilter === key ? 'selected' : ''}>${esc(u.name)} (${esc(formatRoleLabel(u.role))})</option>`;
            }).join('')}
          </select>
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">Status</label>
          <select class="form-control" onchange="window.MJK.setTeamFilter('taskStatusFilter', this.value)">
            <option value="all" ${TeamState.taskStatusFilter === 'all' ? 'selected' : ''}>All Status</option>
            <option value="Pending" ${TeamState.taskStatusFilter === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="In Progress" ${TeamState.taskStatusFilter === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Completed" ${TeamState.taskStatusFilter === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">Priority</label>
          <select class="form-control" onchange="window.MJK.setTeamFilter('taskPriorityFilter', this.value)">
            <option value="all" ${TeamState.taskPriorityFilter === 'all' ? 'selected' : ''}>All Priorities</option>
            <option value="High" ${TeamState.taskPriorityFilter === 'High' ? 'selected' : ''}>High</option>
            <option value="Medium" ${TeamState.taskPriorityFilter === 'Medium' ? 'selected' : ''}>Medium</option>
            <option value="Low" ${TeamState.taskPriorityFilter === 'Low' ? 'selected' : ''}>Low</option>
          </select>
        </div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <h3 style="margin:0; font-size:1rem;">Task Assignments &amp; Progress Tracker (${filtered.length} tasks)</h3>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Task Title &amp; Category</th>
              <th>Assigned Staff</th>
              <th>Priority</th>
              <th>Deadline</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Instructions / Notes</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(t => {
              const prog = Number.isFinite(Number(t.progressPct)) ? Number(t.progressPct) : (t.status === 'Completed' ? 100 : t.status === 'In Progress' ? 50 : 0);
              const isOverdue = t.status !== 'Completed' && t.deadline && t.deadline < today;
              const pBadge = t.priority === 'High' ? 'badge-danger' : t.priority === 'Low' ? 'badge-neutral' : 'badge-warning';
              const sBadge = t.status === 'Completed' ? 'badge-success' : t.status === 'In Progress' ? 'badge-info' : 'badge-neutral';
              return `
                <tr>
                  <td>
                    <div style="font-weight:700;">${esc(t.title)}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${esc(t.id)} · ${esc(t.category || 'Counter Operations')}</div>
                  </td>
                  <td>
                    <div style="font-weight:600;">${esc(t.assignedName || t.assignedTo || '-')}</div>
                    ${t.assignedUid ? `<div class="font-mono" style="font-size:0.7rem; color:var(--blue-600);">${esc(t.assignedUid)}</div>` : ''}
                  </td>
                  <td><span class="badge ${pBadge}">${esc(t.priority || 'Medium')}</span></td>
                  <td class="date tabular-nums" style="${isOverdue ? 'color:var(--danger); font-weight:700;' : ''}">
                    ${formatDate(t.deadline)} ${isOverdue ? '⚠' : ''}
                  </td>
                  <td style="min-width:110px;">
                    <div style="display:flex; align-items:center; gap:0.4rem;">
                      <div style="flex:1; height:7px; border-radius:4px; background:var(--surface-alt); overflow:hidden; border:1px solid var(--border-subtle);">
                        <div style="width:${Math.max(0, Math.min(100, prog))}%; height:100%; background:${prog >= 100 ? 'var(--success)' : 'var(--blue-600)'};"></div>
                      </div>
                      <span class="tabular-nums font-mono" style="font-size:0.74rem; font-weight:700;">${prog}%</span>
                    </div>
                  </td>
                  <td><span class="badge ${sBadge}">${esc(t.status || 'Pending')}</span></td>
                  <td style="font-size:0.78rem; color:var(--text-muted);">${esc(t.notes || '-')}</td>
                  <td style="text-align:right; white-space:nowrap;">
                    ${canEdit ? `<button type="button" class="btn btn-success btn-sm" onclick="window.MJK.toggleTaskStatus('${esc(t.id)}')">${t.status === 'Completed' ? '↺ Reopen' : t.status === 'In Progress' ? '✓ Complete' : '▶ Start'}</button>` : ''}
                    ${canEdit ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openTaskModal('${esc(t.id)}')">✎ Edit</button>` : ''}
                    ${canDelete ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteTask('${esc(t.id)}')">🗑</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('') || `
              <tr>
                <td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">
                  No tasks assigned yet. Click <strong>+ Assign New Task</strong> to create the first assignment.
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
   6. DOCUMENT VAULT VIEW (documents)
   ========================================================================= */
export function renderTeamDocumentVaultView() {
  ensureTeamHydration('docs', () => window.MJK?.renderApp?.());
  const curUser = getCurrentUser();
  const canAddDoc = canMenu('documents', 'add', curUser);
  const canDelDoc = canMenu('documents', 'delete', curUser);
  const users = getScopedTeamUsers();
  const documents = getItem(KEYS.DOCUMENTS, []);

  const categories = Array.from(new Set([
    'Staff Verification & KYC',
    'Confidential Staff Docs',
    'Trade License & Registration',
    'PNB CSP / Banking',
    'KYC / Identity Proof',
    'Application Attachment',
    'Agreements',
    ...documents.map(d => d.category).filter(Boolean)
  ]));

  const q = (TeamState.docSearch || '').trim().toLowerCase();
  const filtered = documents.filter((d) => {
    if (TeamState.docCategoryFilter !== 'all' && d.category !== TeamState.docCategoryFilter) return false;
    if (TeamState.docStaffFilter !== 'all' && (d.staffUid || d.userId || '') !== TeamState.docStaffFilter) return false;
    if (q) {
      const hay = `${d.id || ''} ${d.name || ''} ${d.category || ''} ${d.remarks || ''} ${d.staffUid || ''} ${d.file || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const expiringCount = documents.filter(d => d.expiryDate && new Date(d.expiryDate) < new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)).length;
  const serverFileCount = documents.filter(d => Boolean(d.downloadUrl)).length;
  const staffDocCount = documents.filter(d => Boolean(d.staffUid || d.userId) || String(d.category || '').toLowerCase().includes('staff')).length;

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">🔒 Document Vault</h2>
        <p class="page-subtitle">স্টাফদের প্রয়োজনীয় সিক্রেট ডকুমেন্টস ও ভেরিফিকেশন ফাইল — Protected vault for staff verification records, licenses &amp; confidential files</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.refreshTeamDocuments()">↻ Refresh</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('documents', 'print')">🖨 Print</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('documents', 'pdf')">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('documents', 'excel')">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('documents', 'csv')">📥 CSV</button>
        ${canAddDoc ? `
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openRealDocumentUploadModal()">☁️ Upload File</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openDocumentModal()">+ Register Document</button>
        ` : ''}
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(165px, 1fr)); gap:0.85rem; margin-bottom:1.15rem;">
      <div class="stat-card"><div class="stat-label">Total Vault Records</div><div class="stat-value tabular-nums">${documents.length}</div></div>
      <div class="stat-card"><div class="stat-label">Uploaded Vault Files</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${serverFileCount}</div></div>
      <div class="stat-card"><div class="stat-label">Staff / Verification Docs</div><div class="stat-value tabular-nums" style="color:var(--success);">${staffDocCount}</div></div>
      <div class="stat-card"><div class="stat-label">Expiring (&le; 60 Days)</div><div class="stat-value tabular-nums" style="color:${expiringCount > 0 ? 'var(--danger)' : 'var(--text-muted)'};">${expiringCount}</div></div>
    </div>

    <div class="card" style="padding:0.9rem 1.1rem; margin-bottom:1.15rem;">
      <div style="display:flex; gap:0.7rem; flex-wrap:wrap; align-items:flex-end;">
        <div style="flex:1; min-width:min(100%, 220px);">
          <label class="form-label" style="font-size:0.75rem;">Search Document Title, ID or Remarks</label>
          <input id="team-doc-search" type="text" class="form-control" placeholder="Search documents..." value="${esc(TeamState.docSearch)}" oninput="window.MJK.setTeamFilter('docSearch', this.value)">
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">Category</label>
          <select class="form-control" onchange="window.MJK.setTeamFilter('docCategoryFilter', this.value)">
            <option value="all" ${TeamState.docCategoryFilter === 'all' ? 'selected' : ''}>All Categories</option>
            ${categories.map(c => `<option value="${esc(c)}" ${TeamState.docCategoryFilter === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">Linked Staff Member</label>
          <select class="form-control" onchange="window.MJK.setTeamFilter('docStaffFilter', this.value)">
            <option value="all" ${TeamState.docStaffFilter === 'all' ? 'selected' : ''}>All / Business Docs</option>
            ${users.map(u => {
              const uid = u.uid || u.id;
              return `<option value="${esc(uid)}" ${TeamState.docStaffFilter === uid ? 'selected' : ''}>${esc(u.name)} (${esc(uid)})</option>`;
            }).join('')}
          </select>
        </div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <h3 style="margin:0; font-size:1rem;">Protected Document Vault (${filtered.length} records)</h3>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Document Name &amp; File</th>
              <th>Category</th>
              <th>Linked Employee ID / Ref</th>
              <th>Issue / Upload Date</th>
              <th>Expiry Date</th>
              <th>Remarks</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(d => {
              const isExpiring = d.expiryDate && new Date(d.expiryDate) < new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
              const linkedUser = (d.staffUid || d.userId) ? users.find(u => (u.uid || u.id) === (d.staffUid || d.userId)) : null;
              return `
                <tr>
                  <td>
                    <div style="font-weight:700;">${esc(d.name)}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${esc(d.id)} · ${esc(d.file || 'Stored')}</div>
                  </td>
                  <td><span class="badge badge-info">${esc(d.category || 'Document')}</span></td>
                  <td style="font-size:0.78rem;">
                    ${linkedUser ? `<a href="javascript:void(0)" onclick="window.MJK.viewEmployeeProfileById('${esc(d.staffUid || d.userId)}')"><strong>${esc(linkedUser.name)}</strong></a><div class="font-mono" style="font-size:0.68rem; color:var(--blue-600);">${esc(d.staffUid || d.userId)}</div>` : (d.customerId || d.applicationId ? `<span class="font-mono">${esc(d.applicationId || d.customerId)}</span>` : '<span style="color:var(--text-muted);">MUN COMPUTER Vault</span>')}
                  </td>
                  <td class="date tabular-nums">${d.issueDate ? `Issued: ${formatDate(d.issueDate)}` : formatDate(d.uploadDate)}</td>
                  <td class="date tabular-nums" style="${isExpiring ? 'color:var(--danger); font-weight:bold;' : ''}">
                    ${d.expiryDate ? `${formatDate(d.expiryDate)}${isExpiring ? ' ⚠ Renew Soon' : ''}` : 'No Expiry'}
                  </td>
                  <td style="font-size:0.78rem; color:var(--text-muted);">${esc(d.remarks || '-')}</td>
                  <td style="text-align:right; white-space:nowrap;">
                    ${d.downloadUrl ? `<a class="btn btn-outline btn-sm" href="${esc(d.downloadUrl)}" target="_blank" rel="noopener noreferrer" download>⬇ Download</a>` : ''}
                    ${canDelDoc ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteDocument('${esc(d.id)}')">🗑</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('') || `
              <tr>
                <td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">
                  No documents found in vault. Click <strong>☁️ Upload File</strong> or <strong>+ Register Document</strong> to add protected files.
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
   7. EMPLOYEE PERFORMANCE & REPORTS VIEW (employee-reports)
   ========================================================================= */
function buildEmployeePerformanceRows(month, staffFilter = 'all') {
  const report = getMonthlyAttendanceReport(month, staffFilter);
  const allTasks = getAllTeamTasks();
  const prodLogs = getAllProductivityLogs().filter(l => !month || String(l.date || '').startsWith(month));

  return report.staffRows.map((s) => {
    const staffTasks = allTasks.filter(t => t.assignedUid === s.staffId || t.assignedName === s.staffName);
    const tasksCompleted = staffTasks.filter(t => t.status === 'Completed').length;
    const taskRate = staffTasks.length > 0 ? Math.round((tasksCompleted / staffTasks.length) * 100) : 100;
    const staffProd = prodLogs.filter(l => l.staffUid === s.staffId || l.staffName === s.staffName);
    const outputUnits = staffProd.reduce((sum, l) => sum + (Number(l.unitsCompleted) || 0), 0);
    const prodHours = staffProd.reduce((sum, l) => sum + (Number(l.productiveHours) || 0), 0);

    return {
      ...s,
      tasksTotal: staffTasks.length,
      tasksCompleted,
      taskRate,
      prodLogsCount: staffProd.length,
      outputUnits,
      prodHours
    };
  });
}

export function renderEmployeePerformanceView() {
  ensureTeamHydration('team', () => window.MJK?.renderApp?.());
  const currentUser = getCurrentUser();
  const canAll = canViewAllTeamScope(currentUser);
  const myUid = currentUser?.uid || currentUser?.id || '';
  const month = TeamState.perfMonth || getTodayDate().slice(0, 7);
  const staffFilter = canAll ? (TeamState.perfStaffFilter || 'all') : myUid;
  const staffList = canAll ? getScopedTeamUsers().filter(u => u.status === 'ACTIVE') : getScopedTeamUsers().filter(u => (u.uid || u.id) === myUid);

  const rows = buildEmployeePerformanceRows(month, staffFilter);
  const totals = rows.reduce((acc, r) => {
    acc.present += r.presentDays;
    acc.absent += r.absentDays;
    acc.leave += r.leaveDays;
    acc.late += r.lateDays;
    acc.workMins += r.totalWorkingMinutes;
    acc.otMins += r.totalOvertimeMinutes;
    acc.gps += r.gpsPunches;
    acc.tasksTotal += r.tasksTotal;
    acc.tasksCompleted += r.tasksCompleted;
    acc.outputUnits += r.outputUnits;
    return acc;
  }, { present: 0, absent: 0, leave: 0, late: 0, workMins: 0, otMins: 0, gps: 0, tasksTotal: 0, tasksCompleted: 0, outputUnits: 0 });

  const avgPunctuality = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r.onTimePct, 0) / rows.length)
    : 100;

  const canExport = canMenu('employee-reports', 'export') || canMenu('attendance-reports', 'export') || canAll;
  const canPrint = canMenu('employee-reports', 'print') || canMenu('attendance-reports', 'print') || true;

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">📊 ${canAll ? 'Employee Performance &amp; Reports' : 'My Performance &amp; Attendance Report'}</h2>
        <p class="page-subtitle">মাসিক অ্যাটেন্ডেন্স, পারফরম্যান্স এবং ইউনিভার্সাল প্রিন্ট/পিডিএফ/এক্সেল রিপোর্ট — Official MUN COMPUTER Corporate Exports</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        ${canPrint ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.exportEmployeePerformanceReport('print')">🖨 Print</button>` : ''}
        ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportEmployeePerformanceReport('pdf')">📄 PDF</button>` : ''}
        ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportEmployeePerformanceReport('excel')">📊 Excel</button>` : ''}
        ${canExport ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportEmployeePerformanceReport('csv')">📥 CSV</button>` : ''}
      </div>
    </div>

    <div class="card" style="padding:0.9rem 1.1rem; margin-bottom:1.15rem;">
      <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:flex-end;">
        <div>
          <label class="form-label" style="font-size:0.75rem;">Report Month</label>
          <input type="month" class="form-control" value="${esc(month)}" onchange="window.MJK.setTeamFilter('perfMonth', this.value)">
        </div>
        ${canAll ? `
          <div>
            <label class="form-label" style="font-size:0.75rem;">Filter Staff Member</label>
            <select class="form-control" onchange="window.MJK.setTeamFilter('perfStaffFilter', this.value)">
              <option value="all" ${staffFilter === 'all' ? 'selected' : ''}>All Staff Members</option>
              ${staffList.map(u => `<option value="${esc(u.uid || u.id)}" ${staffFilter === (u.uid || u.id) ? 'selected' : ''}>${esc(u.name)} (${esc(u.uid || u.id)})</option>`).join('')}
            </select>
          </div>
        ` : ''}
        <div>
          <label class="form-label" style="font-size:0.75rem;">Export Dataset</label>
          <select class="form-control" onchange="window.MJK.setTeamFilter('perfReportType', this.value)">
            <option value="performance_matrix" ${TeamState.perfReportType === 'performance_matrix' ? 'selected' : ''}>Monthly Attendance &amp; Performance Matrix</option>
            <option value="daily_attendance" ${TeamState.perfReportType === 'daily_attendance' ? 'selected' : ''}>Monthly Attendance Day-by-Day Log</option>
            <option value="productivity_log" ${TeamState.perfReportType === 'productivity_log' ? 'selected' : ''}>Time &amp; Productivity Log</option>
            <option value="tasks_summary" ${TeamState.perfReportType === 'tasks_summary' ? 'selected' : ''}>Staff Tasks Assignment Report</option>
          </select>
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:0.85rem; margin-bottom:1.25rem;">
      <div class="stat-card"><div class="stat-label">Total Present Days</div><div class="stat-value tabular-nums" style="color:var(--success);">${totals.present}</div></div>
      <div class="stat-card"><div class="stat-label">Absent / Leave</div><div class="stat-value tabular-nums" style="color:var(--danger);">${totals.absent} / ${totals.leave}</div></div>
      <div class="stat-card"><div class="stat-label">Late Entries</div><div class="stat-value tabular-nums" style="color:var(--warning);">${totals.late}</div></div>
      <div class="stat-card"><div class="stat-label">Working Hours</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${formatMinutesAsDuration(totals.workMins)}</div></div>
      <div class="stat-card"><div class="stat-label">Overtime Hours</div><div class="stat-value tabular-nums">${formatMinutesAsDuration(totals.otMins)}</div></div>
      <div class="stat-card"><div class="stat-label">Tasks Done / Total</div><div class="stat-value tabular-nums" style="color:var(--success);">${totals.tasksCompleted}/${totals.tasksTotal}</div></div>
      <div class="stat-card"><div class="stat-label">Output Units</div><div class="stat-value tabular-nums">${totals.outputUnits}</div></div>
      <div class="stat-card"><div class="stat-label">Avg Punctuality</div><div class="stat-value tabular-nums" style="color:var(--blue-600);">${avgPunctuality}%</div></div>
    </div>

    <div class="table-card">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <h3 style="margin:0; font-size:1rem;">Unified Employee Performance &amp; Attendance Matrix (${esc(month)})</h3>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff Name &amp; UID</th>
              <th>Present</th>
              <th>Half Day</th>
              <th>Absent / Leave</th>
              <th>Late</th>
              <th>Working Hrs</th>
              <th>Overtime</th>
              <th>Tasks Done</th>
              <th>Output Units</th>
              <th>GPS Punches</th>
              <th>On-Time %</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>
                  <div style="font-weight:700;">${esc(r.staffName)}</div>
                  <div class="font-mono" style="font-size:0.7rem; color:var(--text-muted);">${esc(r.staffId)} · ${esc(r.role)}</div>
                </td>
                <td class="tabular-nums" style="font-weight:700; color:var(--success);">${r.presentDays}</td>
                <td class="tabular-nums">${r.halfDays}</td>
                <td class="tabular-nums">${r.absentDays} / ${r.leaveDays}</td>
                <td class="tabular-nums" style="color:${r.lateDays > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight:700;">${r.lateDays}</td>
                <td class="tabular-nums" style="font-weight:700;">${esc(r.totalWorkingLabel)}</td>
                <td class="tabular-nums" style="color:var(--blue-600); font-weight:700;">${esc(r.totalOvertimeLabel)}</td>
                <td class="tabular-nums">
                  <strong>${r.tasksCompleted}/${r.tasksTotal}</strong>
                  <span style="font-size:0.72rem; color:var(--text-muted);">(${r.taskRate}%)</span>
                </td>
                <td class="tabular-nums" style="font-weight:700;">${r.outputUnits}</td>
                <td class="tabular-nums">${r.gpsPunches}</td>
                <td><span class="badge ${r.onTimePct >= 85 ? 'badge-success' : r.onTimePct >= 65 ? 'badge-warning' : 'badge-danger'}">${r.onTimePct}%</span></td>
              </tr>
            `).join('') || `
              <tr>
                <td colspan="11" style="text-align:center; padding:2rem; color:var(--text-muted);">
                  No attendance or performance records found for ${esc(month)}.
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
   TEAM MANAGEMENT HANDLERS
   ========================================================================= */
export function createTeamHandlers({ appState, showToast, openModal, closeModal, showConfirmDialog, render }) {
  return {
    setTeamFilter: (field, val) => {
      const active = document.activeElement;
      const activeId = active?.id || '';
      const selStart = typeof active?.selectionStart === 'number' ? active.selectionStart : null;
      const selEnd = typeof active?.selectionEnd === 'number' ? active.selectionEnd : null;
      TeamState[field] = val ?? '';
      render();
      if (activeId) {
        const restored = document.getElementById(activeId);
        if (restored) {
          restored.focus();
          if (selStart !== null && selEnd !== null && typeof restored.setSelectionRange === 'function') {
            try { restored.setSelectionRange(selStart, selEnd); } catch {}
          }
        }
      }
    },

    switchAttendanceTab: (tabId) => {
      if (appState.attendanceTab === 'gps' && tabId !== 'gps') {
        stopActiveAttendanceCamera();
      }
      appState.attendanceTab = tabId || 'daily';
      render();
    },

    refreshStaffDirectory: async () => {
      TeamState.hydratedUsers = true;
      await fetchUsersFromBackend();
      showToast('Staff Directory synced from server.', 'success');
      render();
    },

    openStaffProfileModal: (uid) => {
      const users = getScopedTeamUsers();
      const u = users.find(x => (x.uid || x.id || x.requestId) === uid);
      if (!u) {
        showToast('Staff profile not found.', 'warning');
        return;
      }
      const curMonth = getTodayDate().slice(0, 7);
      const perf = buildEmployeePerformanceRows(curMonth, u.uid || u.id)[0] || {
        presentDays: 0, lateDays: 0, totalWorkingLabel: '0h 00m', totalOvertimeLabel: '0h 00m',
        tasksCompleted: 0, tasksTotal: 0, outputUnits: 0, onTimePct: 100
      };
      const staffDocs = getItem(KEYS.DOCUMENTS, []).filter(d => (d.staffUid || d.userId) === (u.uid || u.id));
      const phoneShow = u.phone || u.phoneMasked || '-';
      const content = `
        <div style="display:flex; flex-direction:column; gap:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; padding-bottom:0.75rem; border-bottom:1px solid var(--border-subtle);">
            <div>
              <h3 style="margin:0; font-size:1.15rem;">${esc(u.name || 'Staff Member')}</h3>
              <div class="font-mono" style="font-size:0.8rem; color:var(--blue-600); font-weight:700; margin-top:0.2rem;">UID: ${esc(u.uid || u.requestId || '-')}</div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.15rem;">${esc(formatRoleLabel(u.role || 'STAFF'))} · ${esc(u.designation || 'Counter Executive')}</div>
            </div>
            <span class="badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}">${esc(u.status || 'ACTIVE')}</span>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; font-size:0.82rem;">
            <div><strong>Mobile:</strong> <span class="tabular-nums">${esc(phoneShow)}</span></div>
            <div><strong>Email:</strong> ${esc(u.email || '-')}</div>
            <div><strong>District:</strong> ${esc(u.district || 'Murshidabad')}</div>
            <div><strong>Block / Municipality:</strong> ${esc(u.blockOrMunicipality || '-')}</div>
            <div><strong>Joined / Registered:</strong> ${formatDate(u.registrationDate || (u.createdAt || '').split('T')[0])}</div>
            <div><strong>Last Login:</strong> ${esc(u.lastLoginAt ? u.lastLoginAt.split('T')[0] : '-')}</div>
          </div>

          <div style="padding:0.85rem; border-radius:var(--radius-md); background:var(--surface-alt); border:1px solid var(--border-subtle);">
            <div style="font-weight:700; font-size:0.82rem; margin-bottom:0.5rem;">Current Month Summary (${esc(curMonth)})</div>
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.5rem; font-size:0.78rem;">
              <div><div style="color:var(--text-muted);">Present</div><strong class="tabular-nums">${perf.presentDays} days</strong></div>
              <div><div style="color:var(--text-muted);">Work Hrs</div><strong class="tabular-nums">${esc(perf.totalWorkingLabel)}</strong></div>
              <div><div style="color:var(--text-muted);">Tasks</div><strong class="tabular-nums">${perf.tasksCompleted}/${perf.tasksTotal}</strong></div>
              <div><div style="color:var(--text-muted);">Punctuality</div><strong class="tabular-nums">${perf.onTimePct}%</strong></div>
            </div>
          </div>

          <div style="font-size:0.8rem; color:var(--text-muted);">
            <strong>Linked Vault Documents:</strong> ${staffDocs.length} document(s) stored
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.closeModal(); window.MJK.viewEmployeeProfileById('${esc(u.uid || u.id)}');">Open Full Employee 360° Profile</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.closeModal(); window.MJK.setTeamFilter('taskStaffFilter', '${esc(u.uid || u.id || u.name)}'); window.MJK.navigateTo('tasks');">View Tasks</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.closeModal(); window.MJK.setTeamFilter('perfStaffFilter', '${esc(u.uid || u.id)}'); window.MJK.navigateTo('employee-reports');">Performance Report</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.closeModal()">Close</button>
          </div>
        </div>
      `;
      openModal(`Staff Profile — ${u.name}`, content, null);
    },

    exportStaffDirectory: async (format = 'pdf') => {
      const users = getScopedTeamUsers();
      const headers = ['UID / ID', 'Staff Name', 'Role', 'Designation', 'Mobile', 'Email', 'Location', 'Status'];
      const rows = users.map(u => [
        u.uid || u.requestId || '-',
        u.name || '-',
        formatRoleLabel(u.role || 'STAFF'),
        u.designation || '-',
        u.phone || u.phoneMasked || '-',
        u.email || '-',
        [u.villageOrLocality, u.blockOrMunicipality, u.district].filter(Boolean).join(', ') || 'Murshidabad',
        u.status || 'ACTIVE'
      ]);
      const cfg = {
        filename: `MUN_COMPUTER_Staff_Directory_${getTodayDate()}`,
        sheetName: 'Staff_Directory',
        reportTitle: 'STAFF DIRECTORY & PROFILES ROSTER',
        title: 'STAFF DIRECTORY & PROFILES ROSTER',
        subtitle: `Total Team Accounts: ${users.length}`,
        reportId: generateReportId('MUN-STF'),
        status: `${users.length} MEMBERS`,
        headers,
        rows
      };
      if (format === 'csv') { exportUniversalCSV(cfg); showToast('Staff Directory CSV downloaded.', 'success'); }
      else if (format === 'excel') { exportUniversalExcel(cfg); showToast('Staff Directory Excel downloaded.', 'success'); }
      else if (format === 'print') { printUniversalReport({ ...cfg, includeAcknowledgement: true }); }
      else { await exportUniversalPDF(cfg); showToast('Staff Directory PDF downloaded.', 'success'); }
    },

    openProductivityLogModal: () => {
      const currentUser = getCurrentUser();
      const canAll = canViewAllTeamScope(currentUser);
      const myUid = currentUser?.uid || currentUser?.id || '';
      const staffList = canAll ? getScopedTeamUsers().filter(u => u.status === 'ACTIVE') : getScopedTeamUsers().filter(u => (u.uid || u.id) === myUid);
      const content = `
        <form onsubmit="window.MJK.handleSaveProductivityLog(event)">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Staff Member *</label>
              <select id="prod-staff" class="form-control" ${canAll ? '' : 'disabled'} required>
                ${staffList.map(u => `<option value="${esc(u.uid || u.id)}">${esc(u.name)} (${esc(u.uid || u.id)})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input type="date" id="prod-date" class="form-control" value="${esc(TeamState.prodDateFilter || getTodayDate())}" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Work Summary / Tasks Completed *</label>
            <input type="text" id="prod-summary" class="form-control" required placeholder="e.g. Processed 18 CSC applications & 6 LPG refills">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Output Units Completed *</label>
              <input type="number" id="prod-units" class="form-control" min="0" value="1" required>
            </div>
            <div class="form-group">
              <label class="form-label">Productive Hours *</label>
              <input type="number" id="prod-hours" class="form-control" min="0.5" max="24" step="0.5" value="8" required>
            </div>
            <div class="form-group">
              <label class="form-label">Break Time (Mins)</label>
              <input type="number" id="prod-break" class="form-control" min="0" max="240" value="30">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Efficiency / Remarks</label>
            <input type="text" id="prod-notes" class="form-control" placeholder="Optional quality / counter note">
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Productivity Log</button>
          </div>
        </form>
      `;
      openModal('Log Staff Work Productivity', content, null);
    },

    handleSaveProductivityLog: async (e) => {
      e.preventDefault();
      const currentUser = getCurrentUser();
      const canAll = canViewAllTeamScope(currentUser);
      const staffUid = canAll ? (document.getElementById('prod-staff')?.value || '') : (currentUser?.uid || currentUser?.id || '');
      const staff = getScopedTeamUsers().find(u => (u.uid || u.id) === staffUid) || currentUser;
      const logId = await allocateGlobalReference('TL', { entityType: 'TIMELINE', entityId: staffUid });
      const entry = {
        id: logId,
        staffUid,
        staffName: staff?.name || 'Staff Member',
        date: document.getElementById('prod-date')?.value || getTodayDate(),
        workSummary: (document.getElementById('prod-summary')?.value || '').trim(),
        unitsCompleted: Math.max(0, Number(document.getElementById('prod-units')?.value) || 0),
        productiveHours: Math.max(0, Number(document.getElementById('prod-hours')?.value) || 0),
        breakMinutes: Math.max(0, Number(document.getElementById('prod-break')?.value) || 0),
        notes: (document.getElementById('prod-notes')?.value || '').trim(),
        createdAt: new Date().toISOString()
      };
      const logs = getAllProductivityLogs();
      logs.unshift(entry);
      setItem(KEYS.TIME_PRODUCTIVITY_LOGS, logs);
      logAuditAction('TEAM_PRODUCTIVITY_LOG', `Logged ${entry.unitsCompleted} units (${entry.productiveHours}h) for ${entry.staffName} on ${entry.date} (${entry.id})`);
      scheduleTeamServerSync();
      closeModal();
      showToast('Work productivity log saved.', 'success');
      render();
    },

    promptDeleteProductivityLog: (id) => {
      showConfirmDialog('Delete Productivity Log?', 'Remove this work productivity record permanently?', () => {
        const logs = getAllProductivityLogs().filter(l => l.id !== id);
        setItem(KEYS.TIME_PRODUCTIVITY_LOGS, logs);
        markGlobalReferenceDeleted(id);
        scheduleTeamServerSync();
        showToast('Productivity log removed.', 'info');
        render();
      });
    },

    exportProductivityReport: async (format = 'pdf') => {
      const currentUser = getCurrentUser();
      const canAll = canViewAllTeamScope(currentUser);
      const myUid = currentUser?.uid || currentUser?.id || '';
      const logs = getAllProductivityLogs().filter(l =>
        (canAll || !myUid || l.staffUid === myUid) &&
        (!TeamState.prodDateFilter || l.date === TeamState.prodDateFilter) &&
        (!canAll || TeamState.prodStaffFilter === 'all' || l.staffUid === TeamState.prodStaffFilter)
      );
      const headers = ['Date', 'Staff UID', 'Staff Name', 'Work Summary', 'Units', 'Productive Hrs', 'Break Mins', 'Notes'];
      const rows = logs.map(l => [
        formatDate(l.date), l.staffUid, l.staffName, l.workSummary,
        Number(l.unitsCompleted) || 0, Number(l.productiveHours) || 0, Number(l.breakMinutes) || 0, l.notes || '-'
      ]);
      const cfg = {
        filename: `MUN_Time_Productivity_${TeamState.prodDateFilter || 'All'}`,
        sheetName: 'Time_Productivity',
        reportTitle: 'STAFF TIME & PRODUCTIVITY LOG',
        title: 'STAFF TIME & PRODUCTIVITY LOG',
        subtitle: `Filter Date: ${TeamState.prodDateFilter || 'All Dates'} · Entries: ${logs.length}`,
        headers,
        rows,
        totalsRow: buildSumTotalsRow(headers, rows, [4, 5, 6], 'TOTAL')
      };
      if (format === 'excel') { exportUniversalExcel(cfg); showToast('Productivity Excel downloaded.', 'success'); }
      else if (format === 'print') { printUniversalReport(cfg); }
      else { await exportUniversalPDF(cfg); showToast('Productivity PDF downloaded.', 'success'); }
    },

    openTaskModal: (editId = '') => {
      const existing = editId ? getAllTeamTasks().find(t => t.id === editId) : null;
      const users = getScopedTeamUsers().filter(u => u.status === 'ACTIVE');
      const content = `
        <form id="task-form" onsubmit="window.MJK.handleSaveTask(event, '${esc(editId)}')">
          <div class="form-group">
            <label class="form-label">Task Title <span class="req">*</span></label>
            <input type="text" id="tsk-title" class="form-control" required value="${esc(existing?.title || '')}" placeholder="e.g. Verify PVC prints &amp; counter cash reconciliation">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Assign To *</label>
              <select id="tsk-user" class="form-control" required>
                ${users.map(u => {
                  const uid = u.uid || u.id || '';
                  const sel = existing ? (existing.assignedUid === uid || existing.assignedName === u.name) : false;
                  return `<option value="${esc(uid)}" data-name="${esc(u.name)}" ${sel ? 'selected' : ''}>${esc(u.name)} (${esc(formatRoleLabel(u.role))})</option>`;
                }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <select id="tsk-category" class="form-control">
                ${['Counter Operations', 'Customer Follow-up', 'PVC / Document Print', 'Banking Reconciliation', 'LPG & Gas Services', 'Other'].map(c => `
                  <option value="${c}" ${existing?.category === c ? 'selected' : ''}>${c}</option>
                `).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select id="tsk-priority" class="form-control">
                <option value="High" ${existing?.priority === 'High' ? 'selected' : ''}>High</option>
                <option value="Medium" ${!existing || existing?.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="Low" ${existing?.priority === 'Low' ? 'selected' : ''}>Low</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select id="tsk-status" class="form-control">
                <option value="Pending" ${!existing || existing?.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="In Progress" ${existing?.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Completed" ${existing?.status === 'Completed' ? 'selected' : ''}>Completed</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Progress %</label>
              <input type="number" id="tsk-progress" class="form-control" min="0" max="100" value="${Number(existing?.progressPct ?? (existing?.status === 'Completed' ? 100 : 0))}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Deadline</label>
              <input type="date" id="tsk-deadline" class="form-control" value="${esc(existing?.deadline || getTodayDate())}">
            </div>
            <div class="form-group">
              <label class="form-label">Instructions / Notes</label>
              <input type="text" id="tsk-notes" class="form-control" value="${esc(existing?.notes || '')}" placeholder="Counter instructions...">
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">${existing ? 'Update Task' : 'Assign Task'}</button>
          </div>
        </form>
      `;
      openModal(existing ? 'Edit Staff Task (MUN COMPUTER)' : 'Assign Staff Task (MUN COMPUTER)', content, null);
    },

    handleSaveTask: async (e, editId = '') => {
      e.preventDefault();
      const tasks = getAllTeamTasks();
      const selEl = document.getElementById('tsk-user');
      const assignedUid = selEl?.value || '';
      const assignedName = selEl?.selectedOptions?.[0]?.dataset?.name || assignedUid;
      const status = document.getElementById('tsk-status')?.value || 'Pending';
      let progressPct = Math.max(0, Math.min(100, Number(document.getElementById('tsk-progress')?.value) || 0));
      if (status === 'Completed') progressPct = 100;
      else if (status === 'In Progress' && progressPct === 0) progressPct = 50;

      const payload = {
        title: (document.getElementById('tsk-title')?.value || '').trim(),
        assignedUid,
        assignedName,
        category: document.getElementById('tsk-category')?.value || 'Counter Operations',
        priority: document.getElementById('tsk-priority')?.value || 'Medium',
        status,
        progressPct,
        deadline: document.getElementById('tsk-deadline')?.value || getTodayDate(),
        notes: (document.getElementById('tsk-notes')?.value || '').trim() || 'Assigned on counter',
        updatedAt: new Date().toISOString()
      };

      if (editId) {
        const idx = tasks.findIndex(t => t.id === editId);
        if (idx !== -1) {
          tasks[idx] = { ...tasks[idx], ...payload };
        }
      } else {
        const tskId = await allocateGlobalReference('FLW', { entityType: 'TASK', entityId: assignedUid });
        tasks.unshift({
          id: tskId,
          createdAt: new Date().toISOString(),
          ...payload
        });
      }
      setItem(KEYS.TASKS, tasks);
      scheduleTeamServerSync();
      closeModal();
      showToast(editId ? 'Task updated & synced.' : 'Task assigned & synced.', 'success');
      render();
    },

    toggleTaskStatus: (id) => {
      const tasks = getAllTeamTasks();
      const index = tasks.findIndex(t => t.id === id);
      if (index !== -1) {
        const cur = tasks[index].status || 'Pending';
        const next = cur === 'Pending' ? 'In Progress' : cur === 'In Progress' ? 'Completed' : 'Pending';
        tasks[index].status = next;
        tasks[index].progressPct = next === 'Completed' ? 100 : next === 'In Progress' ? 50 : 0;
        tasks[index].updatedAt = new Date().toISOString();
        setItem(KEYS.TASKS, tasks);
        scheduleTeamServerSync();
        showToast(`Task status updated to ${next}.`, 'info');
        render();
      }
    },

    promptDeleteTask: (id) => {
      showConfirmDialog('Delete Task?', 'Remove this task record permanently?', () => {
        const tasks = getAllTeamTasks().filter(t => t.id !== id);
        setItem(KEYS.TASKS, tasks);
        markGlobalReferenceDeleted(id);
        scheduleTeamServerSync();
        showToast('Task removed.', 'info');
        render();
      });
    },

    refreshTeamDocuments: async () => {
      TeamState.hydratedDocs = true;
      await syncTeamDocumentsFromServer();
      showToast('Document Vault refreshed from server.', 'success');
      render();
    },

    exportEmployeePerformanceReport: async (format = 'pdf') => {
      const currentUser = getCurrentUser();
      const canAll = canViewAllTeamScope(currentUser);
      const myUid = currentUser?.uid || currentUser?.id || '';
      const month = TeamState.perfMonth || getTodayDate().slice(0, 7);
      const staffFilter = canAll ? (TeamState.perfStaffFilter || 'all') : myUid;
      const type = TeamState.perfReportType || 'performance_matrix';

      let cfg;
      if (type === 'daily_attendance') {
        const recs = getAllAttendance().filter(r => (!month || String(r.date || '').startsWith(month)) && (staffFilter === 'all' || r.staffId === staffFilter));
        const headers = ['Date', 'Staff UID', 'Staff Name', 'In Time', 'Out Time', 'Late', 'Working Hours', 'Overtime', 'Status'];
        const rows = recs.map(r => [
          formatDate(r.date), r.staffId || '-', r.staffName, r.clockIn || '-', r.clockOut || '-',
          r.lateMinutes > 0 ? r.lateLabel : 'On Time', r.workingHoursLabel || '0h 00m', r.overtimeLabel || '0h 00m', r.status
        ]);
        cfg = {
          filename: `MUN_Attendance_Daywise_${month}`,
          sheetName: 'Daily_Attendance',
          title: `EMPLOYEE DAILY ATTENDANCE LOG (${month})`,
          subtitle: `Records: ${recs.length}`,
          headers,
          rows
        };
      } else if (type === 'productivity_log') {
        const logs = getAllProductivityLogs().filter(l => (!month || String(l.date || '').startsWith(month)) && (staffFilter === 'all' || l.staffUid === staffFilter));
        const headers = ['Date', 'Staff UID', 'Staff Name', 'Work Summary', 'Units', 'Productive Hrs', 'Break Mins', 'Notes'];
        const rows = logs.map(l => [
          formatDate(l.date), l.staffUid, l.staffName, l.workSummary,
          Number(l.unitsCompleted) || 0, Number(l.productiveHours) || 0, Number(l.breakMinutes) || 0, l.notes || '-'
        ]);
        cfg = {
          filename: `MUN_Time_Productivity_${month}`,
          sheetName: 'Productivity_Log',
          title: `EMPLOYEE TIME & PRODUCTIVITY REPORT (${month})`,
          subtitle: `Entries: ${logs.length}`,
          headers,
          rows,
          totalsRow: buildSumTotalsRow(headers, rows, [4, 5, 6], 'TOTAL')
        };
      } else if (type === 'tasks_summary') {
        const tasks = getAllTeamTasks().filter(t => staffFilter === 'all' || t.assignedUid === staffFilter);
        const headers = ['Task ID', 'Title', 'Assigned Staff', 'Category', 'Priority', 'Progress %', 'Deadline', 'Status'];
        const rows = tasks.map(t => [
          t.id, t.title, t.assignedName || '-', t.category || 'Counter', t.priority || 'Medium',
          `${t.progressPct ?? 0}%`, formatDate(t.deadline), t.status || 'Pending'
        ]);
        cfg = {
          filename: `MUN_Staff_Tasks_${month}`,
          sheetName: 'Staff_Tasks',
          title: `STAFF TASKS ASSIGNMENT REPORT (${month})`,
          subtitle: `Tasks: ${tasks.length}`,
          headers,
          rows
        };
      } else {
        const perfRows = buildEmployeePerformanceRows(month, staffFilter);
        const headers = ['Staff UID', 'Staff Name', 'Role', 'Present', 'Half Day', 'Absent', 'Leave', 'Late', 'Work Hrs', 'Overtime', 'Tasks Done', 'Output Units', 'GPS Punches', 'On-Time %'];
        const rows = perfRows.map(r => [
          r.staffId, r.staffName, r.role, r.presentDays, r.halfDays, r.absentDays, r.leaveDays,
          r.lateDays, r.totalWorkingLabel, r.totalOvertimeLabel, `${r.tasksCompleted}/${r.tasksTotal}`,
          r.outputUnits, r.gpsPunches, `${r.onTimePct}%`
        ]);
        cfg = {
          filename: `MUN_Employee_Performance_${month}`,
          sheetName: 'Employee_Performance',
          title: `EMPLOYEE PERFORMANCE & ATTENDANCE REPORT (${month})`,
          subtitle: `Evaluated Staff: ${perfRows.length}`,
          headers,
          rows,
          totalsRow: buildSumTotalsRow(headers, rows, [3, 4, 5, 6, 7, 11, 12], 'GRAND TOTAL')
        };
      }

      if (format === 'csv') { exportUniversalCSV(cfg); showToast(`${cfg.title} CSV downloaded.`, 'success'); }
      else if (format === 'excel') { exportUniversalExcel(cfg); showToast(`${cfg.title} Excel (.xlsx) downloaded.`, 'success'); }
      else if (format === 'print') { printUniversalReport({ ...cfg, includeAcknowledgement: true }); }
      else { await exportUniversalPDF(cfg); showToast(`${cfg.title} PDF downloaded.`, 'success'); }
    },

    syncTeamStateToServer: pushTeamStateToServer
  };
}
