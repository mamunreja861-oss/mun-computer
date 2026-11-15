/**
 * hrIntegrationEngine.js - Centralized Employee ID Integration & Automatic HR Module Relationships
 * MUN COMPUTER BUSINESS MANAGER
 *
 * Implements:
 * - Single Primary Employee ID reference across Profile, Attendance, Leave, Payroll, Payslips, Tasks, KPI, Training, Documents, Letters, Rewards
 * - A. Attendance -> Payroll calculation & duplicate period lock
 * - B. Leave -> Attendance automatic synchronization (Approved only; Pending excluded)
 * - C. Tasks -> Performance weighted KPI calculation with configurable weights
 * - D. Employee Documents -> Employee Profile aggregation (category, issueDate, expiryDate)
 * - E. Payroll -> Payslip generation & salary history
 */

import { getItem, setItem, KEYS, getTodayDate, formatDate, formatINR, getAuthHeaders, logAuditAction, numberToWords, allocateGlobalReference, markGlobalReferenceDeleted } from './storage.js';
import { getCurrentUser, canMenu, isSuperAdmin } from './auth.js';
import { getAllAttendance, getMonthlyAttendanceReport, recordAttendance } from './payroll.js';
import { getLucideIcon } from './lucideIcons.js';
import { exportUniversalCSV, exportUniversalExcel, exportUniversalPDF, printUniversalReport } from './exportUtility.js';

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const escAttr = (v) => esc(v).replace(/'/g, '&#39;');

const getLocalUsers = () => getItem(KEYS.USERS, []).filter((u) => u && (u.uid || u.id));

export function resolveCanonicalEmployeeId(rawId) {
  return String(rawId || '').trim().toUpperCase();
}

export function getAllCanonicalEmployees(includeInactive = false) {
  const users = getLocalUsers();
  const profiles = getItem(KEYS.EMPLOYEE_PROFILES, {}) || {};
  return users
    .filter((u) => includeInactive || (u.status === 'ACTIVE' && u.uid))
    .map((u) => {
      const empId = resolveCanonicalEmployeeId(u.uid || u.id);
      const prof = profiles[empId] || {};
      return {
        ...u,
        employeeId: empId,
        department: prof.department || (u.role === 'ADMIN' ? 'Administration' : u.role === 'MANAGER' ? 'Operations Management' : 'Counter & Field Services'),
        baseSalary: Number(prof.baseSalary ?? u.baseSalary ?? (u.role === 'ADMIN' ? 25000 : u.role === 'MANAGER' ? 18000 : 12000)),
        joiningDate: prof.joiningDate || u.registrationDate || (u.createdAt ? String(u.createdAt).slice(0, 10) : ''),
        bankAccount: prof.bankAccount || '',
        ifsc: prof.ifsc || '',
        panNumber: prof.panNumber || '',
        reportingManager: prof.reportingManager || 'MC-ADM-14012025',
        employmentType: prof.employmentType || 'Full-Time'
      };
    });
}

export async function syncHrStateFromServer() {
  try {
    const resp = await fetch('/api/hr/state', { headers: getAuthHeaders() });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.success && data.hrState) {
      const h = data.hrState;
      if (Array.isArray(h.leaves)) setItem(KEYS.LEAVES, h.leaves);
      if (Array.isArray(h.holidays)) setItem(KEYS.HOLIDAYS, h.holidays);
      if (Array.isArray(h.payrollRuns)) setItem(KEYS.PAYROLL_RUNS, h.payrollRuns);
      if (Array.isArray(h.payslips)) setItem(KEYS.PAYSLIPS, h.payslips);
      if (Array.isArray(h.recruitment)) setItem(KEYS.RECRUITMENT, h.recruitment);
      if (Array.isArray(h.training)) setItem(KEYS.TRAINING, h.training);
      if (h.kpiConfig && typeof h.kpiConfig === 'object') setItem(KEYS.KPI_CONFIG, h.kpiConfig);
      if (Array.isArray(h.kpiReviews)) setItem(KEYS.KPI_REVIEWS, h.kpiReviews);
      if (Array.isArray(h.employeeLetters)) setItem(KEYS.EMPLOYEE_LETTERS, h.employeeLetters);
      if (Array.isArray(h.rewardsDisciplinary)) setItem(KEYS.REWARDS_DISCIPLINARY, h.rewardsDisciplinary);
      if (h.employeeProfiles && typeof h.employeeProfiles === 'object') {
        const merged = { ...(getItem(KEYS.EMPLOYEE_PROFILES, {}) || {}), ...h.employeeProfiles };
        setItem(KEYS.EMPLOYEE_PROFILES, merged);
      }
      return h;
    }
  } catch {
    // Offline/localStorage fallback intact
  }
  return null;
}

export async function pushHrStateToServer() {
  try {
    const payload = {
      leaves: getItem(KEYS.LEAVES, []),
      holidays: getItem(KEYS.HOLIDAYS, []),
      recruitment: getItem(KEYS.RECRUITMENT, []),
      training: getItem(KEYS.TRAINING, []),
      kpiConfig: getItem(KEYS.KPI_CONFIG, {}),
      kpiReviews: getItem(KEYS.KPI_REVIEWS, []),
      employeeLetters: getItem(KEYS.EMPLOYEE_LETTERS, []),
      rewardsDisciplinary: getItem(KEYS.REWARDS_DISCIPLINARY, []),
      employeeProfiles: getItem(KEYS.EMPLOYEE_PROFILES, {})
    };
    await fetch('/api/hr/state', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
  } catch {
    // Local cache remains persisted
  }
}

/* =========================================================================
   AUTOMATIC RELATIONSHIP B: LEAVE -> ATTENDANCE SYNCHRONIZATION
   ========================================================================= */
export async function syncApprovedLeaveToAttendance(leave) {
  if (!leave || leave.status !== 'Approved' || !leave.fromDate || !leave.toDate) {
    return [];
  }
  const syncedDates = [];
  const empId = resolveCanonicalEmployeeId(leave.employeeId);
  let cursor = new Date(`${String(leave.fromDate).slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${String(leave.toDate).slice(0, 10)}T00:00:00Z`);
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 62) {
    const dStr = cursor.toISOString().slice(0, 10);
    syncedDates.push(dStr);
    await recordAttendance({
      date: dStr,
      staffId: empId,
      staffName: leave.employeeName || empId,
      status: leave.isHalfDay ? 'Half-Day' : 'Leave',
      inTime: '-',
      outTime: '-',
      notes: `Auto-synced Approved Leave ${leave.id} (${leave.leaveType || 'Leave'})`
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard++;
  }
  return syncedDates;
}

export function getApprovedLeaveDaysForMonth(employeeId, monthYear) {
  const empId = resolveCanonicalEmployeeId(employeeId);
  const targetMonth = String(monthYear || '').slice(0, 7);
  const leaves = getItem(KEYS.LEAVES, []);
  const approvedLeaves = leaves.filter(
    (l) => resolveCanonicalEmployeeId(l.employeeId) === empId && l.status === 'Approved'
  );
  const uniqueDates = new Set();
  approvedLeaves.forEach((l) => {
    let cursor = new Date(`${String(l.fromDate).slice(0, 10)}T00:00:00Z`);
    const end = new Date(`${String(l.toDate || l.fromDate).slice(0, 10)}T00:00:00Z`);
    let guard = 0;
    while (cursor.getTime() <= end.getTime() && guard < 62) {
      const dStr = cursor.toISOString().slice(0, 10);
      if (dStr.startsWith(targetMonth)) {
        uniqueDates.add(dStr);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      guard++;
    }
  });
  return uniqueDates.size;
}

/* =========================================================================
   AUTOMATIC RELATIONSHIP C: TASKS -> PERFORMANCE (CONFIGURABLE KPI WEIGHTS)
   ========================================================================= */
export function getKpiWeightsConfig() {
  const raw = getItem(KEYS.KPI_CONFIG, {}) || {};
  const tComp = Math.max(0, Number(raw.taskCompletionWeight ?? 40));
  const onTime = Math.max(0, Number(raw.onTimeTaskWeight ?? 20));
  const att = Math.max(0, Number(raw.attendanceWeight ?? 25));
  const qual = Math.max(0, Number(raw.serviceQualityWeight ?? 15));
  const total = Math.max(1, tComp + onTime + att + qual);
  return {
    taskCompletionWeight: tComp,
    onTimeTaskWeight: onTime,
    attendanceWeight: att,
    serviceQualityWeight: qual,
    totalWeight: total
  };
}

export function calculateEmployeeKpiScore(employeeId, monthYear = getTodayDate().slice(0, 7)) {
  const empId = resolveCanonicalEmployeeId(employeeId);
  const today = getTodayDate();
  const weights = getKpiWeightsConfig();

  const tasks = getItem(KEYS.TASKS, []).filter(
    (t) => resolveCanonicalEmployeeId(t.assignedTo || t.staffId) === empId
  );
  const completedTasks = tasks.filter((t) => t.status === 'Completed');
  const pendingTasks = tasks.filter((t) => t.status !== 'Completed');
  const overdueTasks = pendingTasks.filter((t) => t.dueDate && String(t.dueDate).slice(0, 10) < today);
  const onTimeCompleted = completedTasks.filter(
    (t) => !t.dueDate || !t.completedAt || String(t.completedAt).slice(0, 10) <= String(t.dueDate).slice(0, 10)
  );

  const taskCompletionPct = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 100;
  const onTimePct = completedTasks.length > 0
    ? Math.round((onTimeCompleted.length / completedTasks.length) * 100)
    : (overdueTasks.length > 0 ? 50 : 100);

  // Attendance component from monthly report
  const attReport = getMonthlyAttendanceReport(monthYear, empId);
  const row = (attReport.staffRows || [])[0] || { presentDays: 0, halfDays: 0, lateDays: 0, loggedDays: 0 };
  const punctualityBase = row.loggedDays > 0
    ? Math.max(0, Math.round(((row.presentDays + row.halfDays * 0.5 - row.lateDays * 0.2) / row.loggedDays) * 100))
    : 100;
  const attendancePct = Math.min(100, Math.max(0, punctualityBase));

  // Service quality / review score
  const reviews = getItem(KEYS.KPI_REVIEWS, []).filter((r) => resolveCanonicalEmployeeId(r.employeeId) === empId);
  const latestReview = reviews[0];
  const serviceQualityPct = latestReview ? Math.min(100, Math.max(0, Number(latestReview.qualityScore) || 85)) : 85;

  const weightedScore = Math.round(
    ((taskCompletionPct * weights.taskCompletionWeight) +
      (onTimePct * weights.onTimeTaskWeight) +
      (attendancePct * weights.attendanceWeight) +
      (serviceQualityPct * weights.serviceQualityWeight)) /
      weights.totalWeight
  );

  const grade = weightedScore >= 90 ? 'A+ (Outstanding)' : weightedScore >= 75 ? 'A (Exceeds)' : weightedScore >= 60 ? 'B (Meets)' : 'C (Needs Review)';

  return {
    employeeId: empId,
    monthYear,
    assignedCount: tasks.length,
    completedCount: completedTasks.length,
    pendingCount: pendingTasks.length,
    overdueCount: overdueTasks.length,
    taskCompletionPct,
    onTimePct,
    attendancePct,
    serviceQualityPct,
    weightedScore,
    grade,
    weights
  };
}

/* =========================================================================
   AUTOMATIC RELATIONSHIP A & E: ATTENDANCE -> PAYROLL -> PAYSLIP ENGINE
   ========================================================================= */
export function calculateAttendancePayrollPreview(employeeId, monthYear = getTodayDate().slice(0, 7), overrides = {}) {
  const emp = getAllCanonicalEmployees(true).find((e) => e.employeeId === resolveCanonicalEmployeeId(employeeId));
  const empId = resolveCanonicalEmployeeId(employeeId);
  const baseSalary = Math.max(0, Number(overrides.baseSalary ?? emp?.baseSalary ?? 12000));
  const [yStr, mStr] = String(monthYear).split('-');
  const daysInCalendarMonth = new Date(Number(yStr) || 2026, Number(mStr) || 1, 0).getDate();
  const workingDaysInMonth = Math.max(1, Number(overrides.workingDaysInMonth ?? 26));

  // Real attendance rows for month
  const monthAtt = getAllAttendance().filter(
    (a) => resolveCanonicalEmployeeId(a.staffId) === empId && String(a.date || '').startsWith(monthYear)
  );
  const presentDays = monthAtt.filter((a) => a.status === 'Present').length;
  const halfDays = monthAtt.filter((a) => a.status === 'Half-Day').length;
  const attLeaveDays = monthAtt.filter((a) => a.status === 'Leave').length;
  const approvedLeaveFromModule = getApprovedLeaveDaysForMonth(empId, monthYear);
  const approvedLeaveDays = Math.max(attLeaveDays, approvedLeaveFromModule);
  const absentDays = monthAtt.filter((a) => a.status === 'Absent').length;

  const overtimeMinutes = monthAtt.reduce((sum, a) => sum + (Number(a.overtimeMinutes) || 0), 0);
  const overtimeHours = Math.round((overtimeMinutes / 60) * 10) / 10;

  // Commissions from banking / services handled by staff during month
  const bankingComm = getItem(KEYS.BANKING, [])
    .filter((b) => resolveCanonicalEmployeeId(b.createdByUid || b.staffId) === empId && String(b.date || '').startsWith(monthYear) && b.status === 'Success')
    .reduce((sum, b) => sum + (Number(b.commission) || 0), 0);
  const commissions = Math.max(0, Number(overrides.commissions ?? Math.round(bankingComm * 0.1)));

  const dailyRate = baseSalary / workingDaysInMonth;
  const effectivePresentEquiv = presentDays + halfDays * 0.5 + approvedLeaveDays;
  // If attendance rows exist, pay according to logged attendance + approved leaves capped at workingDaysInMonth; deduction applies for explicit Absents or shortfall when full month closed
  const payableDays = monthAtt.length > 0
    ? Math.min(workingDaysInMonth, Math.max(0, effectivePresentEquiv))
    : workingDaysInMonth;

  const absenceDeduction = overrides.absenceDeduction !== undefined
    ? Math.max(0, Number(overrides.absenceDeduction))
    : Math.round(dailyRate * absentDays);

  const overtimeRatePerHr = Math.round(dailyRate / 8);
  const overtimePay = overrides.overtimePay !== undefined
    ? Math.max(0, Number(overrides.overtimePay))
    : Math.round(overtimeHours * overtimeRatePerHr);

  const bonus = Math.max(0, Number(overrides.bonus ?? 0));
  const otherDeductions = Math.max(0, Number(overrides.otherDeductions ?? 0));
  const earnedBase = monthAtt.length > 0
    ? Math.min(baseSalary, Math.round(dailyRate * payableDays))
    : baseSalary;
  const grossPay = earnedBase + overtimePay + commissions + bonus;
  const netPay = Math.max(0, grossPay - absenceDeduction - otherDeductions);

  const existingRun = getItem(KEYS.PAYROLL_RUNS, []).find(
    (r) => resolveCanonicalEmployeeId(r.employeeId) === empId && String(r.monthYear || '').slice(0, 7) === monthYear
  );

  return {
    employeeId: empId,
    employeeName: emp?.name || empId,
    designation: emp?.designation || emp?.role || 'Staff',
    monthYear,
    daysInCalendarMonth,
    workingDaysInMonth,
    loggedRecords: monthAtt.length,
    presentDays,
    halfDays,
    approvedLeaveDays,
    absentDays,
    payableDays,
    overtimeHours,
    overtimePay,
    commissions,
    bonus,
    baseSalary,
    earnedBase,
    absenceDeduction,
    otherDeductions,
    grossPay,
    netPay,
    alreadyProcessed: Boolean(existingRun),
    existingRunId: existingRun?.id || null
  };
}

export async function processEmployeePayrollAndPayslip(employeeId, monthYear, overrides = {}) {
  const preview = calculateAttendancePayrollPreview(employeeId, monthYear, overrides);
  if (preview.alreadyProcessed) {
    return {
      success: false,
      duplicate: true,
      message: `Payroll already processed for ${preview.employeeId} (${monthYear}). Duplicate payroll blocked.`
    };
  }

  const payload = {
    ...preview,
    paymentMode: overrides.paymentMode || 'Bank Transfer',
    notes: overrides.notes || `Auto-calculated from ${preview.loggedRecords} attendance logs`
  };

  try {
    const resp = await fetch('/api/hr/payroll/run', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return { success: false, duplicate: Boolean(data.duplicate), message: data.message || 'Payroll processing failed.' };
    }
    const runs = getItem(KEYS.PAYROLL_RUNS, []);
    runs.unshift(data.payrollRun);
    setItem(KEYS.PAYROLL_RUNS, runs);

    const slips = getItem(KEYS.PAYSLIPS, []);
    slips.unshift(data.payslip);
    setItem(KEYS.PAYSLIPS, slips);
    return { success: true, payrollRun: data.payrollRun, payslip: data.payslip };
  } catch {
    // Fallback allocation through authoritative Global Reference Engine
    const runs = getItem(KEYS.PAYROLL_RUNS, []);
    if (runs.some((r) => resolveCanonicalEmployeeId(r.employeeId) === preview.employeeId && String(r.monthYear).slice(0, 7) === monthYear)) {
      return { success: false, duplicate: true, message: `Payroll already processed for ${preview.employeeId} (${monthYear}).` };
    }
    const nowIso = new Date().toISOString();
    const runId = await allocateGlobalReference('PAYRUN', { entityType: 'PAYROLL_RUN', entityId: preview.employeeId });
    const payslipId = await allocateGlobalReference('SLIP', { entityType: 'PAYSLIP', entityId: preview.employeeId });
    const payrollRun = { id: runId, payslipId, ...payload, status: 'Processed', processedAt: nowIso };
    const payslip = {
      id: payslipId,
      payrollRunId: runId,
      employeeId: preview.employeeId,
      employeeName: preview.employeeName,
      designation: preview.designation,
      monthYear,
      baseSalary: preview.baseSalary,
      payableDays: preview.payableDays,
      presentDays: preview.presentDays,
      approvedLeaveDays: preview.approvedLeaveDays,
      absentDays: preview.absentDays,
      overtimePay: preview.overtimePay,
      commissions: preview.commissions,
      bonus: preview.bonus,
      totalDeductions: preview.absenceDeduction + preview.otherDeductions,
      grossPay: preview.grossPay,
      netPay: preview.netPay,
      paymentMode: payload.paymentMode,
      status: 'Processed',
      generatedAt: nowIso
    };
    runs.unshift(payrollRun);
    setItem(KEYS.PAYROLL_RUNS, runs);
    const slips = getItem(KEYS.PAYSLIPS, []);
    slips.unshift(payslip);
    setItem(KEYS.PAYSLIPS, slips);
    return { success: true, payrollRun, payslip };
  }
}

/* =========================================================================
   UNIFIED SINGLE-SOURCE EMPLOYEE BUNDLE (ALL 12 EMPLOYEE MODULES)
   ========================================================================= */
export function getUnifiedEmployeeBundle(employeeId, monthYear = getTodayDate().slice(0, 7)) {
  const empId = resolveCanonicalEmployeeId(employeeId);
  const emp = getAllCanonicalEmployees(true).find((e) => e.employeeId === empId) || {
    employeeId: empId,
    name: empId,
    role: 'STAFF',
    designation: 'Staff',
    status: 'ACTIVE'
  };
  const attendance = getAllAttendance().filter((a) => resolveCanonicalEmployeeId(a.staffId) === empId);
  const leaves = getItem(KEYS.LEAVES, []).filter((l) => resolveCanonicalEmployeeId(l.employeeId) === empId);
  const payrollRuns = getItem(KEYS.PAYROLL_RUNS, []).filter((r) => resolveCanonicalEmployeeId(r.employeeId) === empId);
  const payslips = getItem(KEYS.PAYSLIPS, []).filter((s) => resolveCanonicalEmployeeId(s.employeeId) === empId);
  const tasks = getItem(KEYS.TASKS, []).filter((t) => resolveCanonicalEmployeeId(t.assignedTo || t.staffId) === empId);
  const kpi = calculateEmployeeKpiScore(empId, monthYear);
  const training = getItem(KEYS.TRAINING, []).filter(
    (tr) => !tr.employeeId || resolveCanonicalEmployeeId(tr.employeeId) === empId
  );
  const documents = getItem(KEYS.DOCUMENTS, []).filter(
    (d) => resolveCanonicalEmployeeId(d.userId || d.staffUid || d.employeeId) === empId
  );
  const letters = getItem(KEYS.EMPLOYEE_LETTERS, []).filter((l) => resolveCanonicalEmployeeId(l.employeeId) === empId);
  const rewards = getItem(KEYS.REWARDS_DISCIPLINARY, []).filter((r) => resolveCanonicalEmployeeId(r.employeeId) === empId);

  return {
    employee: emp,
    attendance,
    leaves,
    payrollRuns,
    payslips,
    tasks,
    kpi,
    training,
    documents,
    letters,
    rewards
  };
}

/* =========================================================================
   VIEW RENDERERS FOR INTEGRATED TEAM MANAGEMENT SUBMODULES
   ========================================================================= */
let _hrUiState = {
  selectedEmpId: '',
  selectedMonth: getTodayDate().slice(0, 7),
  leaveFilter: 'ALL',
  profileTab: 'overview'
};

function getScopedEmployeesForViewer() {
  const cur = getCurrentUser();
  const selfId = resolveCanonicalEmployeeId(cur?.uid || cur?.id);
  const isPrivileged = cur?.isSuperAdmin || cur?.role === 'ADMIN' || cur?.role === 'MANAGER';
  const all = getAllCanonicalEmployees(true);
  if (!isPrivileged) {
    return all.filter((e) => e.employeeId === selfId);
  }
  return all;
}

export function renderEmployeeProfileView() {
  const cur = getCurrentUser();
  const isPrivileged = cur?.isSuperAdmin || cur?.role === 'ADMIN' || cur?.role === 'MANAGER';
  const emps = getScopedEmployeesForViewer();
  const selfId = resolveCanonicalEmployeeId(cur?.uid || cur?.id);
  const targetId = isPrivileged && _hrUiState.selectedEmpId
    ? resolveCanonicalEmployeeId(_hrUiState.selectedEmpId)
    : (emps[0]?.employeeId || selfId);

  const bundle = getUnifiedEmployeeBundle(targetId, _hrUiState.selectedMonth);
  const emp = bundle.employee;
  const today = getTodayDate();
  const activeTab = _hrUiState.profileTab || 'overview';

  return `
    <div class="page-header" style="flex-wrap:wrap; gap:1rem;">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem;">
          ${getLucideIcon('id-card', 22)} Employee ID &amp; Unified Profile
        </h2>
        <p class="page-subtitle">Single-source profile integrated across Attendance, Leave, Payroll, Payslips, Tasks, KPI, Training, Documents &amp; Letters</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
        ${isPrivileged ? `
          <select class="form-control" style="width:240px; height:38px;" onchange="window.MJK.setHrSelectedEmployee(this.value)">
            ${emps.map((e) => `<option value="${escAttr(e.employeeId)}" ${e.employeeId === targetId ? 'selected' : ''}>${esc(e.name)} (${esc(e.employeeId)})</option>`).join('')}
          </select>
        ` : ''}
        ${isPrivileged ? `
          <button class="btn btn-primary btn-sm" onclick="window.MJK.openEditEmployeeHrModal('${escAttr(emp.employeeId)}')">Edit Salary &amp; HR Info</button>
        ` : ''}
      </div>
    </div>

    <!-- Primary Employee Identity Card -->
    <div class="card" style="padding:1.25rem; margin-bottom:1.25rem; border:1px solid var(--border-subtle);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div style="display:flex; gap:1rem; align-items:center;">
          <div style="width:56px; height:56px; border-radius:12px; background:#0B1630; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:1.35rem; font-weight:800;">
            ${esc(String(emp.name || 'E').charAt(0).toUpperCase())}
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
              <h3 style="margin:0; font-size:1.15rem; font-weight:800;">${esc(emp.name)}</h3>
              <span class="badge badge-info">${esc(emp.designation || emp.role)}</span>
              <span class="badge ${emp.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}">${esc(emp.status || 'ACTIVE')}</span>
            </div>
            <div style="font-size:0.82rem; color:var(--text-muted); margin-top:0.25rem;">
              <strong class="font-mono" style="color:#2563eb;">Employee ID: ${esc(emp.employeeId)}</strong>
              &nbsp;·&nbsp; Dept: ${esc(emp.department || 'Operations')}
              &nbsp;·&nbsp; Mobile: ${esc(emp.phoneMasked || emp.phone || '-')}
              &nbsp;·&nbsp; Joined: ${formatDate(emp.joiningDate) || '-'}
            </div>
          </div>
        </div>
        <div style="display:flex; gap:1.25rem; flex-wrap:wrap; text-align:right;">
          <div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">KPI Score</div>
            <div class="tabular-nums" style="font-size:1.2rem; font-weight:800; color:#2563eb;">${bundle.kpi.weightedScore}%</div>
          </div>
          <div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Base Salary</div>
            <div class="tabular-nums" style="font-size:1.2rem; font-weight:800; color:var(--success);">${formatINR(emp.baseSalary || 0)}</div>
          </div>
        </div>
      </div>

      <div class="tab-nav" style="margin-top:1rem; margin-bottom:0;">
        ${[
          ['overview', 'Summary'],
          ['attendance', `Attendance (${bundle.attendance.length})`],
          ['leaves', `Leaves (${bundle.leaves.length})`],
          ['payroll', `Payslips (${bundle.payslips.length})`],
          ['tasks', `Tasks & KPI (${bundle.tasks.length})`],
          ['documents', `Documents (${bundle.documents.length})`],
          ['letters', `Letters & Rewards (${bundle.letters.length + bundle.rewards.length})`]
        ].map(([k, lbl]) => `
          <button type="button" class="tab-btn ${activeTab === k ? 'active' : ''}" onclick="window.MJK.setHrProfileTab('${k}')">${lbl}</button>
        `).join('')}
      </div>
    </div>

    ${activeTab === 'overview' ? `
      <div class="stat-grid" style="margin-bottom:1.25rem;">
        <div class="stat-card"><div class="stat-label">Attendance Logs</div><div class="stat-value tabular-nums">${bundle.attendance.length}</div><div class="stat-footer">Linked to ${esc(emp.employeeId)}</div></div>
        <div class="stat-card"><div class="stat-label">Approved Leaves</div><div class="stat-value tabular-nums">${bundle.leaves.filter(l => l.status === 'Approved').length}</div><div class="stat-footer">${bundle.leaves.filter(l => l.status === 'Pending').length} Pending</div></div>
        <div class="stat-card"><div class="stat-label">Tasks Completed</div><div class="stat-value tabular-nums">${bundle.kpi.completedCount} / ${bundle.kpi.assignedCount}</div><div class="stat-footer">${bundle.kpi.overdueCount} Overdue</div></div>
        <div class="stat-card"><div class="stat-label">Employee Documents</div><div class="stat-value tabular-nums">${bundle.documents.length}</div><div class="stat-footer">${bundle.payslips.length} Payslips Issued</div></div>
      </div>
      <div class="card" style="padding:1.15rem;">
        <h4 style="margin:0 0 0.75rem 0;">Employment &amp; Bank Details (${esc(emp.employeeId)})</h4>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:0.75rem; font-size:0.84rem;">
          <div><strong>Email:</strong> ${esc(emp.email || '-')}</div>
          <div><strong>Reporting To:</strong> ${esc(emp.reportingManager || 'MC-ADM-14012025')}</div>
          <div><strong>Employment Type:</strong> ${esc(emp.employmentType || 'Full-Time')}</div>
          <div><strong>Bank A/C:</strong> ${esc(emp.bankAccount || 'Not Configured')}</div>
          <div><strong>IFSC:</strong> ${esc(emp.ifsc || '-')}</div>
          <div><strong>PAN:</strong> ${esc(emp.panNumber || '-')}</div>
        </div>
      </div>
    ` : activeTab === 'attendance' ? `
      <div class="table-card">
        <div class="table-toolbar">
          <h4 style="margin:0;">Attendance Logs for ${esc(emp.employeeId)}</h4>
          <button class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('attendance-tracking')">Open Full Attendance</button>
        </div>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>Date</th><th>Status</th><th>Clock In</th><th>Clock Out</th><th>Notes</th></tr></thead><tbody>
          ${bundle.attendance.slice(0, 30).map(a => `
            <tr>
              <td class="tabular-nums">${formatDate(a.date)}</td>
              <td><span class="badge ${a.status === 'Present' ? 'badge-success' : a.status === 'Leave' ? 'badge-info' : a.status === 'Absent' ? 'badge-danger' : 'badge-warning'}">${esc(a.status)}</span></td>
              <td class="tabular-nums">${esc(a.clockIn || '-')}</td>
              <td class="tabular-nums">${esc(a.clockOut || '-')}</td>
              <td>${esc(a.notes || '-')}</td>
            </tr>
          `).join('') || '<tr><td colspan="5" style="text-align:center; padding:1.5rem;">No attendance entries yet for this Employee ID.</td></tr>'}
        </tbody></table></div>
      </div>
    ` : activeTab === 'leaves' ? `
      <div class="table-card">
        <div class="table-toolbar">
          <h4 style="margin:0;">Leave History (${esc(emp.employeeId)})</h4>
          <button class="btn btn-primary btn-sm" onclick="window.MJK.openApplyLeaveModal('${escAttr(emp.employeeId)}')">+ Apply Leave</button>
        </div>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>ID</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th></tr></thead><tbody>
          ${bundle.leaves.map(l => `
            <tr>
              <td class="font-mono">${esc(l.id)}</td>
              <td>${esc(l.leaveType)}</td>
              <td class="tabular-nums">${formatDate(l.fromDate)} → ${formatDate(l.toDate)}</td>
              <td class="tabular-nums">${l.days || 1}</td>
              <td><span class="badge ${l.status === 'Approved' ? 'badge-success' : l.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}">${esc(l.status)}</span></td>
            </tr>
          `).join('') || '<tr><td colspan="5" style="text-align:center; padding:1.5rem;">No leave applications linked to this Employee ID.</td></tr>'}
        </tbody></table></div>
      </div>
    ` : activeTab === 'payroll' ? `
      <div class="table-card">
        <div class="table-toolbar">
          <h4 style="margin:0;">Payslips &amp; Salary History (${esc(emp.employeeId)})</h4>
          <button class="btn btn-secondary btn-sm" onclick="window.MJK.navigateTo('payslips')">Open Payslips Archive</button>
        </div>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>Payslip ID</th><th>Period</th><th>Payable Days</th><th>Gross</th><th>Deductions</th><th>Net Pay</th><th>Action</th></tr></thead><tbody>
          ${bundle.payslips.map(p => `
            <tr>
              <td class="font-mono">${esc(p.id)}</td>
              <td class="tabular-nums">${esc(p.monthYear)}</td>
              <td class="tabular-nums">${p.payableDays}</td>
              <td class="tabular-nums">${formatINR(p.grossPay)}</td>
              <td class="tabular-nums">${formatINR(p.totalDeductions)}</td>
              <td class="tabular-nums" style="font-weight:700; color:var(--success);">${formatINR(p.netPay)}</td>
              <td><button class="btn btn-outline btn-sm" onclick="window.MJK.printEmployeePayslip('${escAttr(p.id)}')">Print Slip</button></td>
            </tr>
          `).join('') || '<tr><td colspan="7" style="text-align:center; padding:1.5rem;">No processed payslips yet.</td></tr>'}
        </tbody></table></div>
      </div>
    ` : activeTab === 'tasks' ? `
      <div class="table-card">
        <div class="table-toolbar">
          <h4 style="margin:0;">Tasks &amp; KPI Performance — Weighted Score: ${bundle.kpi.weightedScore}% (${esc(bundle.kpi.grade)})</h4>
        </div>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>Task</th><th>Priority</th><th>Due Date</th><th>Status</th></tr></thead><tbody>
          ${bundle.tasks.map(t => `
            <tr>
              <td style="font-weight:600;">${esc(t.title)}</td>
              <td>${esc(t.priority || 'Normal')}</td>
              <td class="tabular-nums">${formatDate(t.dueDate) || '-'}</td>
              <td><span class="badge ${t.status === 'Completed' ? 'badge-success' : (t.dueDate && t.dueDate < today) ? 'badge-danger' : 'badge-warning'}">${esc(t.status)}</span></td>
            </tr>
          `).join('') || '<tr><td colspan="4" style="text-align:center; padding:1.5rem;">No tasks assigned to this Employee ID.</td></tr>'}
        </tbody></table></div>
      </div>
    ` : activeTab === 'documents' ? `
      <div class="table-card">
        <div class="table-toolbar">
          <div>
            <h4 style="margin:0;">Employee Documents (${esc(emp.employeeId)})</h4>
            <div style="font-size:0.75rem; color:var(--text-muted);">Maintains Category, Issue Date &amp; Expiry Date</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.MJK.openAddEmployeeDocumentModal('${escAttr(emp.employeeId)}')">+ Upload Employee Doc</button>
        </div>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>Doc ID</th><th>Title</th><th>Category</th><th>Issue Date</th><th>Expiry Date</th><th>Action</th></tr></thead><tbody>
          ${bundle.documents.map(d => {
            const isExpired = d.expiryDate && d.expiryDate < today;
            return `
              <tr>
                <td class="font-mono">${esc(d.id)}</td>
                <td style="font-weight:600;">${esc(d.title || d.fileName)}</td>
                <td>${esc(d.category || 'Employee KYC')}</td>
                <td class="tabular-nums">${formatDate(d.issueDate || d.createdAt) || '-'}</td>
                <td class="tabular-nums" style="color:${isExpired ? 'var(--danger)' : 'inherit'}; font-weight:${isExpired ? '700' : '400'};">${d.expiryDate ? formatDate(d.expiryDate) : 'No Expiry'}</td>
                <td><button class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('documents')">Open Vault</button></td>
              </tr>
            `;
          }).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem;">No employee documents uploaded for this Employee ID yet.</td></tr>'}
        </tbody></table></div>
      </div>
    ` : `
      <div class="table-card">
        <div class="table-toolbar">
          <h4 style="margin:0;">Letters &amp; Rewards/Disciplinary History (${esc(emp.employeeId)})</h4>
        </div>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>Type</th><th>Title / Subject</th><th>Date</th><th>Details</th></tr></thead><tbody>
          ${[
            ...bundle.letters.map(l => ({ type: l.letterType || 'Letter', title: l.designation || l.title, date: l.issueDate, details: `CTC/Salary: ${formatINR(l.salary || 0)}` })),
            ...bundle.rewards.map(r => ({ type: r.recordType || 'Reward', title: r.title, date: r.date, details: r.remarks || '-' }))
          ].map(row => `
            <tr>
              <td><span class="badge badge-info">${esc(row.type)}</span></td>
              <td style="font-weight:600;">${esc(row.title)}</td>
              <td class="tabular-nums">${formatDate(row.date)}</td>
              <td>${esc(row.details)}</td>
            </tr>
          `).join('') || '<tr><td colspan="4" style="text-align:center; padding:1.5rem;">No letters or reward/disciplinary records yet.</td></tr>'}
        </tbody></table></div>
      </div>
    `}
  `;
}

export function renderLeaveManagementView() {
  const cur = getCurrentUser();
  const selfId = resolveCanonicalEmployeeId(cur?.uid || cur?.id);
  const canApprove = canMenu('leave-management', 'approve', cur) && (cur?.isSuperAdmin || cur?.role === 'ADMIN' || cur?.role === 'MANAGER');
  const allLeaves = getItem(KEYS.LEAVES, []);
  const scopedLeaves = canApprove ? allLeaves : allLeaves.filter((l) => resolveCanonicalEmployeeId(l.employeeId) === selfId);
  const filtered = _hrUiState.leaveFilter === 'ALL' ? scopedLeaves : scopedLeaves.filter((l) => l.status === _hrUiState.leaveFilter);
  const holidays = getItem(KEYS.HOLIDAYS, []);

  const pendingCnt = scopedLeaves.filter((l) => l.status === 'Pending').length;
  const approvedCnt = scopedLeaves.filter((l) => l.status === 'Approved').length;
  const rejectedCnt = scopedLeaves.filter((l) => l.status === 'Rejected').length;

  return `
    <div class="page-header" style="flex-wrap:wrap; gap:1rem;">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem;">
          ${getLucideIcon('calendar-off', 22)} Leave &amp; Holiday Management
        </h2>
        <p class="page-subtitle">Approved leaves automatically update Attendance records. Pending leaves are strictly excluded until approved.</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="window.MJK.openApplyLeaveModal()">+ Apply Leave</button>
        ${canApprove ? `<button class="btn btn-secondary" onclick="window.MJK.openAddHolidayModal()">+ Add Holiday</button>` : ''}
      </div>
    </div>

    <div class="stat-grid" style="margin-bottom:1.25rem;">
      <div class="stat-card"><div class="stat-label">Pending Approvals</div><div class="stat-value tabular-nums" style="color:var(--warning);">${pendingCnt}</div><div class="stat-footer">Does NOT count as approved leave</div></div>
      <div class="stat-card"><div class="stat-label">Approved Leaves</div><div class="stat-value tabular-nums" style="color:var(--success);">${approvedCnt}</div><div class="stat-footer">Auto-synced to Attendance</div></div>
      <div class="stat-card"><div class="stat-label">Rejected Leaves</div><div class="stat-value tabular-nums" style="color:var(--danger);">${rejectedCnt}</div><div class="stat-footer">Excluded from Payroll</div></div>
      <div class="stat-card"><div class="stat-label">Holidays Configured</div><div class="stat-value tabular-nums">${holidays.length}</div><div class="stat-footer">Official company calendar</div></div>
    </div>

    <div class="erp-grid-135-1" style="gap:1.25rem;">
      <div class="table-card">
        <div class="table-toolbar">
          <h3 style="margin:0; font-size:0.95rem;">Leave Applications</h3>
          <div style="display:flex; gap:0.35rem;">
            ${['ALL', 'Pending', 'Approved', 'Rejected'].map((st) => `
              <button class="btn btn-sm ${_hrUiState.leaveFilter === st ? 'btn-primary' : 'btn-outline'}" onclick="window.MJK.setHrLeaveFilter('${st}')">${st}</button>
            `).join('')}
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Leave ID</th><th>Employee ID &amp; Name</th><th>Type</th><th>Period</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${filtered.map((l) => `
                <tr>
                  <td class="font-mono">${esc(l.id)}</td>
                  <td>
                    <div style="font-weight:700;">${esc(l.employeeName || l.employeeId)}</div>
                    <div class="font-mono" style="font-size:0.72rem; color:var(--blue-600);">${esc(l.employeeId)}</div>
                  </td>
                  <td>${esc(l.leaveType)}${l.isHalfDay ? ' (Half-Day)' : ''}</td>
                  <td class="tabular-nums">${formatDate(l.fromDate)} → ${formatDate(l.toDate)} (${l.days || 1}d)</td>
                  <td style="max-width:220px; font-size:0.8rem;">${esc(l.reason || '-')}</td>
                  <td><span class="badge ${l.status === 'Approved' ? 'badge-success' : l.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}">${esc(l.status)}</span></td>
                  <td style="white-space:nowrap;">
                    ${canApprove && l.status === 'Pending' ? `
                      <button class="btn btn-success btn-sm" onclick="window.MJK.decideLeaveUi('${escAttr(l.id)}', 'Approved')">Approve &amp; Sync</button>
                      <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.decideLeaveUi('${escAttr(l.id)}', 'Rejected')">Reject</button>
                    ` : `<span style="font-size:0.75rem; color:var(--text-muted);">${l.status === 'Approved' ? 'Synced to Attendance' : l.status}</span>`}
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No leave applications found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="table-card">
        <div class="table-toolbar"><h3 style="margin:0; font-size:0.95rem;">Official Holiday Calendar</h3></div>
        <div style="padding:0.9rem;">
          ${holidays.length ? holidays.map((h) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.55rem 0; border-bottom:1px solid var(--border-subtle);">
              <div>
                <div style="font-weight:700; font-size:0.84rem;">${esc(h.title)}</div>
                <div style="font-size:0.74rem; color:var(--text-muted);">${formatDate(h.date)} · ${esc(h.type || 'Public Holiday')}</div>
              </div>
              ${canApprove ? `<button class="btn btn-outline btn-sm" onclick="window.MJK.deleteHolidayUi('${escAttr(h.id)}')">✕</button>` : ''}
            </div>
          `).join('') : '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.84rem;">No company holidays added yet.</div>'}
        </div>
      </div>
    </div>
  `;
}

export function renderSalaryPayrollView() {
  const cur = getCurrentUser();
  const canProcess = canMenu('salary-payroll', 'add', cur) && (cur?.isSuperAdmin || cur?.role === 'ADMIN' || cur?.role === 'MANAGER');
  const emps = getAllCanonicalEmployees(false);
  const month = _hrUiState.selectedMonth || getTodayDate().slice(0, 7);
  const previews = emps.map((e) => calculateAttendancePayrollPreview(e.employeeId, month));
  const runs = getItem(KEYS.PAYROLL_RUNS, []);

  return `
    <div class="page-header" style="flex-wrap:wrap; gap:1rem;">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem;">
          ${getLucideIcon('wallet', 22)} Salary &amp; Attendance-Integrated Payroll
        </h2>
        <p class="page-subtitle">Automatically calculates payable days, approved leaves, deductions, overtime &amp; commissions from Attendance. Blocks duplicate payroll runs per period.</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.5rem; align-items:center;">
        <input type="month" class="form-control" style="width:165px; height:38px;" value="${esc(month)}" onchange="window.MJK.setHrSelectedMonth(this.value)">
        <button class="btn btn-secondary" onclick="window.MJK.navigateTo('payslips')">View Payslips</button>
      </div>
    </div>

    <div class="table-card" style="margin-bottom:1.25rem;">
      <div class="table-toolbar">
        <h3 style="margin:0; font-size:0.95rem;">Monthly Payroll Calculation Sheet (${esc(month)})</h3>
        <span style="font-size:0.78rem; color:var(--text-muted);">Duplicate Prevention Active (${runs.filter(r => r.monthYear === month).length} processed for ${esc(month)})</span>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Employee ID &amp; Name</th>
              <th>Base Salary</th>
              <th>Present / Half / Leave / Absent</th>
              <th>Payable Days</th>
              <th>OT + Comm</th>
              <th>Deductions</th>
              <th>Net Payable</th>
              <th>Status / Action</th>
            </tr>
          </thead>
          <tbody>
            ${previews.map((p) => `
              <tr>
                <td>
                  <div style="font-weight:700;">${esc(p.employeeName)}</div>
                  <div class="font-mono" style="font-size:0.72rem; color:var(--blue-600);">${esc(p.employeeId)}</div>
                </td>
                <td class="tabular-nums">${formatINR(p.baseSalary)}</td>
                <td class="tabular-nums" style="font-size:0.78rem;">${p.presentDays}P · ${p.halfDays}H · ${p.approvedLeaveDays}L · ${p.absentDays}A</td>
                <td class="tabular-nums">${p.payableDays} / ${p.workingDaysInMonth}</td>
                <td class="tabular-nums" style="color:var(--success);">+${formatINR(p.overtimePay + p.commissions)}</td>
                <td class="tabular-nums" style="color:var(--danger);">-${formatINR(p.absenceDeduction)}</td>
                <td class="tabular-nums" style="font-weight:800;">${formatINR(p.netPay)}</td>
                <td>
                  ${p.alreadyProcessed ? `
                    <span class="badge badge-success">Processed (${esc(p.existingRunId)})</span>
                  ` : canProcess ? `
                    <button class="btn btn-primary btn-sm" onclick="window.MJK.openProcessPayrollModal('${escAttr(p.employeeId)}', '${escAttr(month)}')">Process &amp; Issue Slip</button>
                  ` : `<span class="badge badge-neutral">Authorized Only</span>`}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="8" style="text-align:center; padding:2rem;">No active employees found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderPayslipsView() {
  const cur = getCurrentUser();
  const selfId = resolveCanonicalEmployeeId(cur?.uid || cur?.id);
  const isPrivileged = cur?.isSuperAdmin || cur?.role === 'ADMIN' || cur?.role === 'MANAGER';
  const allSlips = getItem(KEYS.PAYSLIPS, []);
  const slips = isPrivileged ? allSlips : allSlips.filter((s) => resolveCanonicalEmployeeId(s.employeeId) === selfId);

  return `
    <div class="page-header" style="flex-wrap:wrap; gap:1rem;">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem;">
          ${getLucideIcon('file-spreadsheet', 22)} Payslip &amp; Salary History
        </h2>
        <p class="page-subtitle">${isPrivileged ? 'All processed monthly employee payslips & salary payout history' : `Personal payslips for Employee ID: ${esc(selfId)}`}</p>
      </div>
      <div class="page-actions">
        ${isPrivileged ? `<button class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('salary-payroll')">Run Monthly Payroll</button>` : ''}
      </div>
    </div>

    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr><th>Slip ID</th><th>Employee ID &amp; Name</th><th>Period</th><th>Payable Days</th><th>Gross Pay</th><th>Deductions</th><th>Net Pay</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${slips.map((s) => `
              <tr>
                <td class="font-mono" style="font-weight:700;">${esc(s.id)}</td>
                <td>
                  <div style="font-weight:700;">${esc(s.employeeName)}</div>
                  <div class="font-mono" style="font-size:0.72rem; color:var(--blue-600);">${esc(s.employeeId)}</div>
                </td>
                <td class="tabular-nums">${esc(s.monthYear)}</td>
                <td class="tabular-nums">${s.payableDays} (${s.presentDays}P / ${s.approvedLeaveDays}L)</td>
                <td class="tabular-nums">${formatINR(s.grossPay)}</td>
                <td class="tabular-nums" style="color:var(--danger);">${formatINR(s.totalDeductions)}</td>
                <td class="tabular-nums" style="font-weight:800; color:var(--success);">${formatINR(s.netPay)}</td>
                <td>
                  <button class="btn btn-outline btn-sm" onclick="window.MJK.printEmployeePayslip('${escAttr(s.id)}')">Print A4 Payslip</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">No payslips generated yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderKpiPerformanceView() {
  const cur = getCurrentUser();
  const selfId = resolveCanonicalEmployeeId(cur?.uid || cur?.id);
  const isPrivileged = cur?.isSuperAdmin || cur?.role === 'ADMIN' || cur?.role === 'MANAGER';
  const emps = getScopedEmployeesForViewer();
  const month = _hrUiState.selectedMonth || getTodayDate().slice(0, 7);
  const weights = getKpiWeightsConfig();
  const scorecards = emps.map((e) => ({ emp: e, kpi: calculateEmployeeKpiScore(e.employeeId, month) }));

  return `
    <div class="page-header" style="flex-wrap:wrap; gap:1rem;">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem;">
          ${getLucideIcon('target', 22)} KPI / KRA &amp; Performance Evaluation
        </h2>
        <p class="page-subtitle">Live weighted KPI scores calculated automatically from assigned/completed/overdue tasks &amp; attendance punctuality</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <input type="month" class="form-control" style="width:165px; height:38px;" value="${esc(month)}" onchange="window.MJK.setHrSelectedMonth(this.value)">
        ${isPrivileged ? `<button class="btn btn-secondary btn-sm" onclick="window.MJK.openKpiWeightsModal()">Configure KPI Weights</button>` : ''}
      </div>
    </div>

    <div class="card" style="padding:1rem; margin-bottom:1.25rem;">
      <div style="font-size:0.78rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; margin-bottom:0.4rem;">Active KPI Weightage Formula (Total ${weights.totalWeight}%)</div>
      <div style="display:flex; gap:1.5rem; flex-wrap:wrap; font-size:0.86rem;">
        <span>Task Completion: <strong>${weights.taskCompletionWeight}%</strong></span>
        <span>On-Time Delivery: <strong>${weights.onTimeTaskWeight}%</strong></span>
        <span>Attendance Punctuality: <strong>${weights.attendanceWeight}%</strong></span>
        <span>Service Quality Rating: <strong>${weights.serviceQualityWeight}%</strong></span>
      </div>
    </div>

    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Employee ID &amp; Name</th><th>Tasks (Done / Total / Overdue)</th><th>Task %</th><th>On-Time %</th><th>Attendance %</th><th>Quality %</th><th>KPI Score &amp; Grade</th><th>Action</th></tr></thead>
          <tbody>
            ${scorecards.map(({ emp, kpi }) => `
              <tr>
                <td>
                  <div style="font-weight:700;">${esc(emp.name)}</div>
                  <div class="font-mono" style="font-size:0.72rem; color:var(--blue-600);">${esc(emp.employeeId)}</div>
                </td>
                <td class="tabular-nums">${kpi.completedCount} / ${kpi.assignedCount} (<span style="color:${kpi.overdueCount > 0 ? 'var(--danger)' : 'inherit'};">${kpi.overdueCount} overdue</span>)</td>
                <td class="tabular-nums">${kpi.taskCompletionPct}%</td>
                <td class="tabular-nums">${kpi.onTimePct}%</td>
                <td class="tabular-nums">${kpi.attendancePct}%</td>
                <td class="tabular-nums">${kpi.serviceQualityPct}%</td>
                <td>
                  <span class="badge ${kpi.weightedScore >= 75 ? 'badge-success' : kpi.weightedScore >= 60 ? 'badge-warning' : 'badge-danger'}">
                    ${kpi.weightedScore}% · ${esc(kpi.grade)}
                  </span>
                </td>
                <td>
                  ${isPrivileged ? `<button class="btn btn-outline btn-sm" onclick="window.MJK.openKpiReviewModal('${escAttr(emp.employeeId)}')">Rate Quality</button>` : `<button class="btn btn-outline btn-sm" onclick="window.MJK.viewEmployeeProfileById('${escAttr(selfId)}')">My Profile</button>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderRecruitmentView() {
  const recs = getItem(KEYS.RECRUITMENT, []);
  return `
    <div class="page-header">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem;">${getLucideIcon('user-plus', 22)} Recruitment &amp; Job Posting</h2>
        <p class="page-subtitle">Manage open roles, counter operator applications &amp; interview pipeline</p>
      </div>
      <div class="page-actions"><button class="btn btn-primary" onclick="window.MJK.openAddRecruitmentModal()">+ New Job / Applicant</button></div>
    </div>
    <div class="table-card">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Ref ID</th><th>Position / Role</th><th>Applicant Name</th><th>Phone</th><th>Interview Date</th><th>Status</th><th>Action</th></tr></thead><tbody>
        ${recs.map(r => `
          <tr>
            <td class="font-mono">${esc(r.id)}</td>
            <td style="font-weight:700;">${esc(r.position)}</td>
            <td>${esc(r.applicantName)}</td>
            <td class="tabular-nums">${esc(r.phone || '-')}</td>
            <td class="tabular-nums">${formatDate(r.interviewDate) || '-'}</td>
            <td><span class="badge ${r.status === 'Hired' ? 'badge-success' : r.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}">${esc(r.status)}</span></td>
            <td><button class="btn btn-outline btn-sm" onclick="window.MJK.cycleRecruitmentStatus('${escAttr(r.id)}')">Advance Stage</button></td>
          </tr>
        `).join('') || '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No job postings or applicants recorded yet.</td></tr>'}
      </tbody></table></div>
    </div>
  `;
}

export function renderTrainingView() {
  const cur = getCurrentUser();
  const isPrivileged = cur?.isSuperAdmin || cur?.role === 'ADMIN' || cur?.role === 'MANAGER';
  const selfId = resolveCanonicalEmployeeId(cur?.uid || cur?.id);
  const all = getItem(KEYS.TRAINING, []);
  const list = isPrivileged ? all : all.filter(t => !t.employeeId || resolveCanonicalEmployeeId(t.employeeId) === selfId);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem;">${getLucideIcon('graduation-cap', 22)} Training &amp; Development</h2>
        <p class="page-subtitle">CSC, PNB CSP compliance, LPG safety &amp; ERP operational training linked to Employee ID</p>
      </div>
      <div class="page-actions"><button class="btn btn-primary" onclick="window.MJK.openAddTrainingModal()">+ Add Training / Enroll</button></div>
    </div>
    <div class="table-card">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Program ID</th><th>Training Module</th><th>Employee ID</th><th>Target Date</th><th>Status</th><th>Action</th></tr></thead><tbody>
        ${list.map(t => `
          <tr>
            <td class="font-mono">${esc(t.id)}</td>
            <td style="font-weight:700;">${esc(t.title)}<div style="font-size:0.74rem; color:var(--text-muted);">${esc(t.provider || 'MUN COMPUTER Internal')}</div></td>
            <td class="font-mono">${esc(t.employeeId || 'ALL STAFF')}</td>
            <td class="tabular-nums">${formatDate(t.date) || '-'}</td>
            <td><span class="badge ${t.status === 'Completed' ? 'badge-success' : 'badge-info'}">${esc(t.status)}</span></td>
            <td>${t.status !== 'Completed' ? `<button class="btn btn-success btn-sm" onclick="window.MJK.completeTraining('${escAttr(t.id)}')">Mark Completed</button>` : 'Verified'}</td>
          </tr>
        `).join('') || '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No training modules scheduled yet.</td></tr>'}
      </tbody></table></div>
    </div>
  `;
}

export function renderOfferLettersView() {
  const letters = getItem(KEYS.EMPLOYEE_LETTERS, []);
  return `
    <div class="page-header">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem;">${getLucideIcon('file-signature', 22)} Offer &amp; Appointment Letters</h2>
        <p class="page-subtitle">Generate official A4 MUN COMPUTER Offer &amp; Appointment Letters linked to Employee ID</p>
      </div>
      <div class="page-actions"><button class="btn btn-primary" onclick="window.MJK.openCreateLetterModal()">+ Issue Official Letter</button></div>
    </div>
    <div class="table-card">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>Letter ID</th><th>Employee ID &amp; Name</th><th>Letter Type</th><th>Designation</th><th>Monthly Salary</th><th>Issue Date</th><th>Print</th></tr></thead><tbody>
        ${letters.map(l => `
          <tr>
            <td class="font-mono">${esc(l.id)}</td>
            <td><div style="font-weight:700;">${esc(l.employeeName)}</div><div class="font-mono" style="font-size:0.72rem; color:var(--blue-600);">${esc(l.employeeId)}</div></td>
            <td><span class="badge badge-info">${esc(l.letterType)}</span></td>
            <td>${esc(l.designation)}</td>
            <td class="tabular-nums">${formatINR(l.salary)}</td>
            <td class="tabular-nums">${formatDate(l.issueDate)}</td>
            <td><button class="btn btn-outline btn-sm" onclick="window.MJK.printOfficialHrLetter('${escAttr(l.id)}')">Print A4</button></td>
          </tr>
        `).join('') || '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No Offer or Appointment Letters issued yet.</td></tr>'}
      </tbody></table></div>
    </div>
  `;
}

export function renderRewardsDisciplinaryView() {
  const list = getItem(KEYS.REWARDS_DISCIPLINARY, []);
  return `
    <div class="page-header">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem;">${getLucideIcon('award', 22)} Rewards &amp; Disciplinary Records</h2>
        <p class="page-subtitle">Track employee awards, incentives, performance bonuses &amp; disciplinary notes by Employee ID</p>
      </div>
      <div class="page-actions"><button class="btn btn-primary" onclick="window.MJK.openAddRewardRecordModal()">+ Add Record</button></div>
    </div>
    <div class="table-card">
      <div class="table-responsive"><table class="data-table"><thead><tr><th>ID</th><th>Employee ID &amp; Name</th><th>Type</th><th>Title</th><th>Date</th><th>Remarks</th></tr></thead><tbody>
        ${list.map(r => `
          <tr>
            <td class="font-mono">${esc(r.id)}</td>
            <td><div style="font-weight:700;">${esc(r.employeeName)}</div><div class="font-mono" style="font-size:0.72rem; color:var(--blue-600);">${esc(r.employeeId)}</div></td>
            <td><span class="badge ${r.recordType === 'Reward' ? 'badge-success' : 'badge-danger'}">${esc(r.recordType)}</span></td>
            <td style="font-weight:600;">${esc(r.title)}</td>
            <td class="tabular-nums">${formatDate(r.date)}</td>
            <td>${esc(r.remarks || '-')}</td>
          </tr>
        `).join('') || '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No rewards or disciplinary entries recorded yet.</td></tr>'}
      </tbody></table></div>
    </div>
  `;
}

/* =========================================================================
   PUBLIC HR EVENT HANDLERS ATTACHED TO window.MJK
   ========================================================================= */
export function createHrHandlers({ showToast, openModal, closeModal, render }) {
  return {
    setHrSelectedEmployee: (empId) => {
      _hrUiState.selectedEmpId = resolveCanonicalEmployeeId(empId);
      render();
    },
    viewEmployeeProfileById: (empId) => {
      _hrUiState.selectedEmpId = resolveCanonicalEmployeeId(empId);
      _hrUiState.profileTab = 'overview';
      window.MJK.navigateTo('employee-profile');
    },
    setHrProfileTab: (tab) => {
      _hrUiState.profileTab = tab || 'overview';
      render();
    },
    setHrSelectedMonth: (m) => {
      _hrUiState.selectedMonth = m || getTodayDate().slice(0, 7);
      render();
    },
    setHrLeaveFilter: (f) => {
      _hrUiState.leaveFilter = f || 'ALL';
      render();
    },
    openEditEmployeeHrModal: (empId) => {
      const emp = getAllCanonicalEmployees(true).find(e => e.employeeId === resolveCanonicalEmployeeId(empId));
      if (!emp) return;
      openModal(`Edit HR & Salary Details — ${emp.employeeId}`, `
        <form onsubmit="window.MJK.submitEditEmployeeHr(event, '${escAttr(emp.employeeId)}')">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Department</label><input id="hr-emp-dept" class="form-control" value="${esc(emp.department)}"></div>
            <div class="form-group"><label class="form-label">Monthly Base Salary (₹)</label><input id="hr-emp-sal" type="number" min="0" class="form-control" value="${emp.baseSalary}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Joining Date</label><input id="hr-emp-join" type="date" class="form-control" value="${esc(emp.joiningDate)}"></div>
            <div class="form-group"><label class="form-label">Reporting Manager UID</label><input id="hr-emp-mgr" class="form-control" value="${esc(emp.reportingManager)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Bank Account No.</label><input id="hr-emp-bank" class="form-control" value="${esc(emp.bankAccount)}"></div>
            <div class="form-group"><label class="form-label">IFSC Code</label><input id="hr-emp-ifsc" class="form-control" value="${esc(emp.ifsc)}"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save HR Profile</button>
          </div>
        </form>
      `, null);
    },
    submitEditEmployeeHr: async (e, empId) => {
      e.preventDefault();
      const profiles = getItem(KEYS.EMPLOYEE_PROFILES, {}) || {};
      profiles[empId] = {
        ...(profiles[empId] || {}),
        department: document.getElementById('hr-emp-dept')?.value?.trim() || 'Operations',
        baseSalary: Math.max(0, Number(document.getElementById('hr-emp-sal')?.value) || 0),
        joiningDate: document.getElementById('hr-emp-join')?.value || '',
        reportingManager: document.getElementById('hr-emp-mgr')?.value?.trim() || 'MC-ADM-14012025',
        bankAccount: document.getElementById('hr-emp-bank')?.value?.trim() || '',
        ifsc: document.getElementById('hr-emp-ifsc')?.value?.trim() || ''
      };
      setItem(KEYS.EMPLOYEE_PROFILES, profiles);
      await pushHrStateToServer();
      closeModal();
      showToast(`Employee HR profile updated for ${empId}.`, 'success');
      render();
    },
    openApplyLeaveModal: (presetEmpId = '') => {
      const cur = getCurrentUser();
      const selfId = resolveCanonicalEmployeeId(cur?.uid || cur?.id);
      const canChoose = cur?.isSuperAdmin || cur?.role === 'ADMIN' || cur?.role === 'MANAGER';
      const emps = getAllCanonicalEmployees(false);
      const targetId = resolveCanonicalEmployeeId(presetEmpId) || selfId;
      openModal('Apply for Leave', `
        <form onsubmit="window.MJK.submitApplyLeave(event)">
          ${canChoose ? `
            <div class="form-group">
              <label class="form-label">Employee ID *</label>
              <select id="lv-emp-id" class="form-control">
                ${emps.map(e => `<option value="${escAttr(e.employeeId)}" ${e.employeeId === targetId ? 'selected' : ''}>${esc(e.name)} (${esc(e.employeeId)})</option>`).join('')}
              </select>
            </div>
          ` : `<input type="hidden" id="lv-emp-id" value="${escAttr(selfId)}">`}
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Leave Type *</label>
              <select id="lv-type" class="form-control">
                <option value="Casual Leave">Casual Leave</option>
                <option value="Sick / Medical Leave">Sick / Medical Leave</option>
                <option value="Earned Leave">Earned Leave</option>
                <option value="Emergency Leave">Emergency Leave</option>
              </select>
            </div>
            <div class="form-group" style="display:flex; align-items:flex-end;">
              <label style="display:flex; align-items:center; gap:0.45rem; cursor:pointer; font-size:0.85rem;">
                <input type="checkbox" id="lv-half-day"> Half-Day Leave
              </label>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">From Date *</label><input type="date" id="lv-from" class="form-control" required value="${getTodayDate()}"></div>
            <div class="form-group"><label class="form-label">To Date *</label><input type="date" id="lv-to" class="form-control" required value="${getTodayDate()}"></div>
          </div>
          <div class="form-group"><label class="form-label">Reason *</label><textarea id="lv-reason" class="form-control" rows="2" required placeholder="Specify leave reason..."></textarea></div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Submit Leave Application</button>
          </div>
        </form>
      `, null);
    },
    submitApplyLeave: async (e) => {
      e.preventDefault();
      const empId = resolveCanonicalEmployeeId(document.getElementById('lv-emp-id')?.value);
      const emp = getAllCanonicalEmployees(true).find(x => x.employeeId === empId);
      const payload = {
        employeeId: empId,
        employeeName: emp?.name || empId,
        leaveType: document.getElementById('lv-type')?.value || 'Casual Leave',
        fromDate: document.getElementById('lv-from')?.value,
        toDate: document.getElementById('lv-to')?.value,
        isHalfDay: Boolean(document.getElementById('lv-half-day')?.checked),
        reason: document.getElementById('lv-reason')?.value?.trim() || ''
      };
      try {
        const resp = await fetch('/api/hr/leaves', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
          showToast(data.message || 'Unable to apply leave.', 'danger');
          return;
        }
        const leaves = getItem(KEYS.LEAVES, []);
        leaves.unshift(data.leave);
        setItem(KEYS.LEAVES, leaves);
      } catch {
        const leaves = getItem(KEYS.LEAVES, []);
        const lvId = await allocateGlobalReference('LV', { entityType: 'LEAVE', entityId: empId });
        leaves.unshift({ id: lvId, ...payload, days: 1, status: 'Pending', createdAt: new Date().toISOString() });
        setItem(KEYS.LEAVES, leaves);
      }
      closeModal();
      showToast('Leave submitted (Pending approval — not counted as approved yet).', 'info');
      render();
    },
    decideLeaveUi: async (leaveId, decision) => {
      const cur = getCurrentUser();
      if (!canMenu('leave-management', 'approve', cur)) {
        showToast('Access Denied: Only Manager or Admin can approve/reject leaves.', 'danger');
        return;
      }
      try {
        const resp = await fetch(`/api/hr/leaves/${encodeURIComponent(leaveId)}/decision`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ decision })
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
          showToast(data.message || 'Leave decision failed.', 'danger');
          return;
        }
        const leaves = getItem(KEYS.LEAVES, []);
        const idx = leaves.findIndex(l => l.id === leaveId);
        if (idx !== -1) leaves[idx] = data.leave;
        setItem(KEYS.LEAVES, leaves);
        if (decision === 'Approved' && data.leave) {
          await syncApprovedLeaveToAttendance(data.leave);
        }
      } catch {
        const leaves = getItem(KEYS.LEAVES, []);
        const idx = leaves.findIndex(l => l.id === leaveId);
        if (idx !== -1) {
          leaves[idx].status = decision;
          setItem(KEYS.LEAVES, leaves);
          if (decision === 'Approved') await syncApprovedLeaveToAttendance(leaves[idx]);
        }
      }
      showToast(decision === 'Approved' ? 'Leave approved & Attendance automatically updated!' : 'Leave application rejected.', decision === 'Approved' ? 'success' : 'warning');
      render();
    },
    openAddHolidayModal: () => {
      openModal('Add Official Company Holiday', `
        <form onsubmit="window.MJK.submitAddHoliday(event)">
          <div class="form-group"><label class="form-label">Holiday Name *</label><input id="hol-title" class="form-control" required placeholder="e.g. Republic Day"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Date *</label><input type="date" id="hol-date" class="form-control" required></div>
            <div class="form-group"><label class="form-label">Category</label><select id="hol-type" class="form-control"><option>National Holiday</option><option>Festival Holiday</option><option>Local Holiday</option></select></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Holiday</button>
          </div>
        </form>
      `, null);
    },
    submitAddHoliday: async (e) => {
      e.preventDefault();
      const holidays = getItem(KEYS.HOLIDAYS, []);
      const holId = await allocateGlobalReference('HOL', { entityType: 'HOLIDAY' });
      holidays.push({
        id: holId,
        title: document.getElementById('hol-title')?.value?.trim(),
        date: document.getElementById('hol-date')?.value,
        type: document.getElementById('hol-type')?.value
      });
      setItem(KEYS.HOLIDAYS, holidays);
      await pushHrStateToServer();
      closeModal();
      showToast('Holiday added to calendar.', 'success');
      render();
    },
    deleteHolidayUi: async (id) => {
      setItem(KEYS.HOLIDAYS, getItem(KEYS.HOLIDAYS, []).filter(h => h.id !== id));
      markGlobalReferenceDeleted(id);
      await pushHrStateToServer();
      render();
    },
    openProcessPayrollModal: (empId, month) => {
      const p = calculateAttendancePayrollPreview(empId, month);
      if (p.alreadyProcessed) {
        showToast(`Payroll already processed for ${empId} (${month}). Duplicate blocked.`, 'warning');
        return;
      }
      openModal(`Process Payroll — ${p.employeeName} (${month})`, `
        <form onsubmit="window.MJK.submitProcessPayroll(event, '${escAttr(empId)}', '${escAttr(month)}')">
          <div style="background:var(--surface-alt); padding:0.75rem; border-radius:var(--radius-md); margin-bottom:0.85rem; font-size:0.82rem;">
            <strong>Attendance Summary:</strong> ${p.presentDays} Present · ${p.halfDays} Half-Day · ${p.approvedLeaveDays} Approved Leave · ${p.absentDays} Absent (${p.payableDays}/${p.workingDaysInMonth} Payable Days)
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Base Salary (₹)</label><input id="pay-base" type="number" min="0" class="form-control" value="${p.baseSalary}"></div>
            <div class="form-group"><label class="form-label">Bonus / Incentive (₹)</label><input id="pay-bonus" type="number" min="0" class="form-control" value="${p.bonus}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Overtime + Commissions (₹)</label><input id="pay-otc" type="number" min="0" class="form-control" value="${p.overtimePay + p.commissions}"></div>
            <div class="form-group"><label class="form-label">Other Deductions (₹)</label><input id="pay-ded" type="number" min="0" class="form-control" value="0"></div>
          </div>
          <div class="form-group"><label class="form-label">Payment Mode</label><select id="pay-mode" class="form-control"><option>Bank Transfer</option><option>UPI</option><option>Cash</option></select></div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-success">Confirm Payroll &amp; Generate Payslip</button>
          </div>
        </form>
      `, null);
    },
    submitProcessPayroll: async (e, empId, month) => {
      e.preventDefault();
      const otc = Math.max(0, Number(document.getElementById('pay-otc')?.value) || 0);
      const res = await processEmployeePayrollAndPayslip(empId, month, {
        baseSalary: Math.max(0, Number(document.getElementById('pay-base')?.value) || 0),
        bonus: Math.max(0, Number(document.getElementById('pay-bonus')?.value) || 0),
        overtimePay: otc,
        commissions: 0,
        otherDeductions: Math.max(0, Number(document.getElementById('pay-ded')?.value) || 0),
        paymentMode: document.getElementById('pay-mode')?.value || 'Bank Transfer'
      });
      if (!res.success) {
        showToast(res.message || 'Payroll run failed.', 'danger');
        return;
      }
      closeModal();
      showToast(`Payroll processed & Payslip ${res.payslip.id} issued!`, 'success');
      render();
    },
    printEmployeePayslip: (slipId) => {
      const slip = getItem(KEYS.PAYSLIPS, []).find(s => s.id === slipId);
      if (!slip) return;
      printUniversalReport({
        title: `SALARY PAYSLIP — ${slip.monthYear}`,
        subtitle: `${slip.employeeName} (${slip.employeeId}) · ${slip.designation} · Ref: ${slip.id}`,
        summaryStats: [
          { label: 'Payable Days', value: String(slip.payableDays) },
          { label: 'Gross Pay', value: formatINR(slip.grossPay) },
          { label: 'Deductions', value: formatINR(slip.totalDeductions) },
          { label: 'Net Paid', value: formatINR(slip.netPay) }
        ],
        headers: ['Earning / Deduction Component', 'Details', 'Amount (INR)'],
        rows: [
          ['Base Monthly Salary', `${slip.presentDays} Present, ${slip.approvedLeaveDays} Approved Leave, ${slip.absentDays} Absent`, formatINR(slip.baseSalary)],
          ['Overtime Pay', 'Attendance verified overtime', formatINR(slip.overtimePay || 0)],
          ['Commissions & Bonus', 'Service / Banking incentive', formatINR((slip.commissions || 0) + (slip.bonus || 0))],
          ['Total Deductions', 'Absence & other deductions', `-${formatINR(slip.totalDeductions || 0)}`],
          ['NET PAYABLE SALARY', numberToWords(slip.netPay), formatINR(slip.netPay)]
        ]
      });
    },
    openKpiWeightsModal: () => {
      const w = getKpiWeightsConfig();
      openModal('Configure KPI Weightages (%)', `
        <form onsubmit="window.MJK.submitKpiWeights(event)">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Task Completion (%)</label><input id="kw-task" type="number" min="0" max="100" class="form-control" value="${w.taskCompletionWeight}"></div>
            <div class="form-group"><label class="form-label">On-Time Delivery (%)</label><input id="kw-time" type="number" min="0" max="100" class="form-control" value="${w.onTimeTaskWeight}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Attendance Punctuality (%)</label><input id="kw-att" type="number" min="0" max="100" class="form-control" value="${w.attendanceWeight}"></div>
            <div class="form-group"><label class="form-label">Service Quality Rating (%)</label><input id="kw-qual" type="number" min="0" max="100" class="form-control" value="${w.serviceQualityWeight}"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Weights</button>
          </div>
        </form>
      `, null);
    },
    submitKpiWeights: async (e) => {
      e.preventDefault();
      setItem(KEYS.KPI_CONFIG, {
        taskCompletionWeight: Math.max(0, Number(document.getElementById('kw-task')?.value) || 0),
        onTimeTaskWeight: Math.max(0, Number(document.getElementById('kw-time')?.value) || 0),
        attendanceWeight: Math.max(0, Number(document.getElementById('kw-att')?.value) || 0),
        serviceQualityWeight: Math.max(0, Number(document.getElementById('kw-qual')?.value) || 0),
        updatedAt: new Date().toISOString()
      });
      await pushHrStateToServer();
      closeModal();
      showToast('KPI weightage formula updated!', 'success');
      render();
    },
    openKpiReviewModal: (empId) => {
      openModal(`Service Quality Assessment — ${empId}`, `
        <form onsubmit="window.MJK.submitKpiReview(event, '${escAttr(empId)}')">
          <div class="form-group"><label class="form-label">Quality &amp; Customer Handling Score (0 - 100)</label><input id="kr-score" type="number" min="0" max="100" required class="form-control" value="90"></div>
          <div class="form-group"><label class="form-label">Manager Review Notes</label><textarea id="kr-note" class="form-control" rows="2"></textarea></div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Score</button>
          </div>
        </form>
      `, null);
    },
    submitKpiReview: async (e, empId) => {
      e.preventDefault();
      const reviews = getItem(KEYS.KPI_REVIEWS, []);
      const kpiId = await allocateGlobalReference('KPI', { entityType: 'KPI_REVIEW', entityId: empId });
      reviews.unshift({
        id: kpiId,
        employeeId: resolveCanonicalEmployeeId(empId),
        qualityScore: Math.min(100, Math.max(0, Number(document.getElementById('kr-score')?.value) || 85)),
        notes: document.getElementById('kr-note')?.value?.trim() || '',
        reviewedAt: new Date().toISOString()
      });
      setItem(KEYS.KPI_REVIEWS, reviews);
      await pushHrStateToServer();
      closeModal();
      showToast(`KPI score recorded for ${empId}.`, 'success');
      render();
    },
    openAddEmployeeDocumentModal: (empId) => {
      openModal(`Upload Document for ${empId}`, `
        <form onsubmit="window.MJK.submitAddEmployeeDoc(event, '${escAttr(empId)}')">
          <div class="form-group"><label class="form-label">Document Title *</label><input id="ed-title" class="form-control" required placeholder="e.g. Aadhaar KYC / Appointment Copy"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Category *</label><select id="ed-cat" class="form-control"><option>Employee KYC</option><option>Appointment Contract</option><option>Qualification Certificate</option><option>Police Verification</option><option>Other HR Doc</option></select></div>
            <div class="form-group"><label class="form-label">Issue Date</label><input id="ed-issue" type="date" class="form-control" value="${getTodayDate()}"></div>
          </div>
          <div class="form-group"><label class="form-label">Expiry Date (Optional)</label><input id="ed-expiry" type="date" class="form-control"></div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Link Document to Employee ID</button>
          </div>
        </form>
      `, null);
    },
    submitAddEmployeeDoc: async (e, empId) => {
      e.preventDefault();
      const docs = getItem(KEYS.DOCUMENTS, []);
      const docId = await allocateGlobalReference('HRDOC', { entityType: 'HR_DOCUMENT', entityId: empId });
      docs.unshift({
        id: docId,
        userId: resolveCanonicalEmployeeId(empId),
        staffUid: resolveCanonicalEmployeeId(empId),
        title: document.getElementById('ed-title')?.value?.trim(),
        category: document.getElementById('ed-cat')?.value || 'Employee KYC',
        issueDate: document.getElementById('ed-issue')?.value || getTodayDate(),
        expiryDate: document.getElementById('ed-expiry')?.value || '',
        createdAt: new Date().toISOString()
      });
      setItem(KEYS.DOCUMENTS, docs);
      closeModal();
      showToast(`Document ${docId} linked to ${empId} profile.`, 'success');
      render();
    },
    openAddRecruitmentModal: () => {
      openModal('Add Job Applicant / Posting', `
        <form onsubmit="window.MJK.submitAddRecruitment(event)">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Job Position *</label><input id="rec-pos" class="form-control" required placeholder="e.g. CSC Counter Operator"></div>
            <div class="form-group"><label class="form-label">Applicant Name *</label><input id="rec-name" class="form-control" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Phone</label><input id="rec-phone" class="form-control"></div>
            <div class="form-group"><label class="form-label">Interview Date</label><input id="rec-date" type="date" class="form-control" value="${getTodayDate()}"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Applicant</button>
          </div>
        </form>
      `, null);
    },
    submitAddRecruitment: async (e) => {
      e.preventDefault();
      const list = getItem(KEYS.RECRUITMENT, []);
      const jobId = await allocateGlobalReference('JOB', { entityType: 'RECRUITMENT_JOB' });
      list.unshift({
        id: jobId,
        position: document.getElementById('rec-pos')?.value?.trim(),
        applicantName: document.getElementById('rec-name')?.value?.trim(),
        phone: document.getElementById('rec-phone')?.value?.trim() || '',
        interviewDate: document.getElementById('rec-date')?.value || getTodayDate(),
        status: 'Applied'
      });
      setItem(KEYS.RECRUITMENT, list);
      await pushHrStateToServer();
      closeModal();
      render();
    },
    cycleRecruitmentStatus: async (id) => {
      const stages = ['Applied', 'Shortlisted', 'Interview', 'Hired', 'Rejected'];
      const list = getItem(KEYS.RECRUITMENT, []);
      const idx = list.findIndex(r => r.id === id);
      if (idx !== -1) {
        const curIdx = stages.indexOf(list[idx].status);
        list[idx].status = stages[(curIdx + 1) % stages.length];
        setItem(KEYS.RECRUITMENT, list);
        await pushHrStateToServer();
        render();
      }
    },
    openAddTrainingModal: () => {
      const emps = getAllCanonicalEmployees(false);
      openModal('Schedule Training / Development', `
        <form onsubmit="window.MJK.submitAddTraining(event)">
          <div class="form-group"><label class="form-label">Training Program *</label><input id="trn-title" class="form-control" required placeholder="e.g. PNB CSP AePS KYC Compliance"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Employee ID</label><select id="trn-emp" class="form-control"><option value="">ALL STAFF</option>${emps.map(e => `<option value="${escAttr(e.employeeId)}">${esc(e.name)} (${esc(e.employeeId)})</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Date</label><input id="trn-date" type="date" class="form-control" value="${getTodayDate()}"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Assign Training</button>
          </div>
        </form>
      `, null);
    },
    submitAddTraining: async (e) => {
      e.preventDefault();
      const list = getItem(KEYS.TRAINING, []);
      const trnId = await allocateGlobalReference('TRN', { entityType: 'TRAINING' });
      list.unshift({
        id: trnId,
        title: document.getElementById('trn-title')?.value?.trim(),
        employeeId: document.getElementById('trn-emp')?.value || '',
        date: document.getElementById('trn-date')?.value || getTodayDate(),
        status: 'Enrolled'
      });
      setItem(KEYS.TRAINING, list);
      await pushHrStateToServer();
      closeModal();
      render();
    },
    completeTraining: async (id) => {
      const list = getItem(KEYS.TRAINING, []);
      const idx = list.findIndex(t => t.id === id);
      if (idx !== -1) {
        list[idx].status = 'Completed';
        setItem(KEYS.TRAINING, list);
        await pushHrStateToServer();
        showToast('Training marked Completed!', 'success');
        render();
      }
    },
    openCreateLetterModal: () => {
      const emps = getAllCanonicalEmployees(true);
      openModal('Issue Offer / Appointment Letter', `
        <form onsubmit="window.MJK.submitCreateLetter(event)">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Employee ID *</label><select id="ltr-emp" class="form-control" required>${emps.map(e => `<option value="${escAttr(e.employeeId)}">${esc(e.name)} (${esc(e.employeeId)})</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Letter Type</label><select id="ltr-type" class="form-control"><option>Offer Letter</option><option>Appointment Letter</option><option>Confirmation Letter</option></select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Designation *</label><input id="ltr-desig" class="form-control" required value="Counter Executive"></div>
            <div class="form-group"><label class="form-label">Monthly Salary (₹) *</label><input id="ltr-sal" type="number" min="0" class="form-control" required value="12000"></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Issue Letter</button>
          </div>
        </form>
      `, null);
    },
    submitCreateLetter: async (e) => {
      e.preventDefault();
      const empId = resolveCanonicalEmployeeId(document.getElementById('ltr-emp')?.value);
      const emp = getAllCanonicalEmployees(true).find(x => x.employeeId === empId);
      const list = getItem(KEYS.EMPLOYEE_LETTERS, []);
      const ltrId = await allocateGlobalReference('LTR', { entityType: 'OFFER_LETTER', entityId: empId });
      list.unshift({
        id: ltrId,
        employeeId: empId,
        employeeName: emp?.name || empId,
        letterType: document.getElementById('ltr-type')?.value || 'Offer Letter',
        designation: document.getElementById('ltr-desig')?.value?.trim() || 'Executive',
        salary: Math.max(0, Number(document.getElementById('ltr-sal')?.value) || 0),
        issueDate: getTodayDate()
      });
      setItem(KEYS.EMPLOYEE_LETTERS, list);
      await pushHrStateToServer();
      closeModal();
      showToast(`Official letter ${ltrId} issued for ${empId}.`, 'success');
      render();
    },
    printOfficialHrLetter: (letterId) => {
      const l = getItem(KEYS.EMPLOYEE_LETTERS, []).find(x => x.id === letterId);
      if (!l) return;
      printUniversalReport({
        title: String(l.letterType || 'APPOINTMENT LETTER').toUpperCase(),
        subtitle: `Ref: ${l.id} · Employee ID: ${l.employeeId} · Date: ${formatDate(l.issueDate)}`,
        headers: ['Particular', 'Official Terms'],
        rows: [
          ['Candidate / Employee Name', l.employeeName],
          ['Assigned Employee ID', l.employeeId],
          ['Designation', l.designation],
          ['Monthly Emolument (CTC)', `${formatINR(l.salary)} (${numberToWords(l.salary)})`],
          ['Work Location', 'MUN COMPUTER — Mamudpur, Juginda, Domkal, Murshidabad - 742406'],
          ['Reporting Authority', 'Permanent Master Administrator (MC-ADM-14012025)']
        ]
      });
    },
    openAddRewardRecordModal: () => {
      const emps = getAllCanonicalEmployees(true);
      openModal('Add Reward / Disciplinary Record', `
        <form onsubmit="window.MJK.submitAddRewardRecord(event)">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Employee ID *</label><select id="rw-emp" class="form-control" required>${emps.map(e => `<option value="${escAttr(e.employeeId)}">${esc(e.name)} (${esc(e.employeeId)})</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Record Type</label><select id="rw-type" class="form-control"><option>Reward</option><option>Disciplinary</option></select></div>
          </div>
          <div class="form-group"><label class="form-label">Title *</label><input id="rw-title" class="form-control" required placeholder="e.g. Best Monthly Counter Accuracy / Late Warning"></div>
          <div class="form-group"><label class="form-label">Remarks</label><textarea id="rw-rem" class="form-control" rows="2"></textarea></div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Record</button>
          </div>
        </form>
      `, null);
    },
    submitAddRewardRecord: async (e) => {
      e.preventDefault();
      const empId = resolveCanonicalEmployeeId(document.getElementById('rw-emp')?.value);
      const emp = getAllCanonicalEmployees(true).find(x => x.employeeId === empId);
      const list = getItem(KEYS.REWARDS_DISCIPLINARY, []);
      const rwdId = await allocateGlobalReference('RWD', { entityType: 'REWARD_DISCIPLINARY', entityId: empId });
      list.unshift({
        id: rwdId,
        employeeId: empId,
        employeeName: emp?.name || empId,
        recordType: document.getElementById('rw-type')?.value || 'Reward',
        title: document.getElementById('rw-title')?.value?.trim(),
        date: getTodayDate(),
        remarks: document.getElementById('rw-rem')?.value?.trim() || ''
      });
      setItem(KEYS.REWARDS_DISCIPLINARY, list);
      await pushHrStateToServer();
      closeModal();
      render();
    }
  };
}
