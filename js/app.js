/**
 * app.js - Main Application Coordinator & View Engine
 * MUN COMPUTER BUSINESS MANAGER - ERP
 */

import {
  initializeStorage,
  KEYS,
  getItem,
  setItem,
  formatINR,
  formatDate,
  formatDateTime,
  getTodayDate,
  getNowISTString,
  exportDatabaseBackup,
  restoreDatabaseBackup,
  resetToDefaults,
  clearAllOperationalData,
  previewNextApplicationId,
  allocateGlobalReference,
  fetchGlobalCounterStatus,
  previewNextGlobalReference,
  markGlobalReferenceDeleted,
  getAuthHeaders,
  numberToWords,
  getAmountWordsState,
  syncAmountWords
} from './storage.js';

let _srvCartUidSeq = 1;

import {
  getCurrentUser,
  setCurrentUser,
  logout,
  can,
  canMenu,
  canExtra,
  getCashOperationLimit,
  refreshSessionPermissions,
  isMainAdmin,
  isSuperAdmin,
  MAIN_ADMIN_UID,
  authenticateAsync,
  changePasswordAsync,
  ROLES,
  canAccessRoute,
  ROLE_CAPABILITIES,
  UID_ORG_PREFIX,
  ROLE_UID_CODES,
  MANAGER_UID,
  formatRoleLabel,
  handleSessionInvalidationResponse
} from './auth.js';
import { getBusinessProfile, updateBusinessProfile, getBusinessUnits, getActiveUnitId, setActiveUnitId, getActiveUnit, addBusinessUnit } from './business.js';
import { getAllCustomers, getCustomerById, saveCustomer, deleteCustomer, checkDuplicatePhone, getCustomerFullHistory, searchCustomers, DEFAULT_CUSTOMER_LOCATION } from './customers.js';
import { getAllServices, getServiceById, getServicesByReceiptId, getReceiptSummary, findOpenReceiptForCustomerDate, saveService, saveServiceBatch, deleteService, deleteMultipleServices, updateServiceStatus, SERVICE_CATEGORIES, SERVICE_STATUSES, getServiceStatuses, getServiceStatusRecords, addCustomServiceStatus, deleteCustomServiceStatus, getServiceCategories, getServiceCategoryRecords, addCustomServiceCategory, deleteCustomServiceCategory, getCustomServiceCatalogData, getCustomSubServices, addCustomServiceEntry, deleteCustomServiceEntry, updateCustomServiceEntry, removeCatalogService, getRemovedCatalogServices, getSubcategoriesForCategory, getUnifiedServiceList, autoMapService, checkDuplicateServiceEntry } from './services.js';
import {
  getAllFollowups,
  saveFollowup,
  updateFollowupStatus,
  rescheduleFollowup,
  deleteFollowup,
  FOLLOWUP_REASONS,
  FOLLOWUP_CYCLE_DAYS,
  FOLLOWUP_MILESTONE_LABELS,
  FOLLOWUP_CASE_STATUSES,
  FOLLOWUP_MODES,
  FINAL_CASE_STATUSES,
  isFinalCaseStatus,
  addDaysToIsoDate,
  buildDefault90DaySchedule,
  sync90DayBootstrapFromServer,
  getAdminOptionCategories,
  getAdminOptions,
  getAdminOptionLabels,
  getFollowupScheduleTemplate,
  saveAdminOptionApi,
  toggleAdminOptionApi,
  deleteAdminOptionApi,
  restoreDefaultAdminOptionsApi,
  addInlineApplicationStatusApi,
  saveScheduleMilestoneApi,
  toggleScheduleMilestoneApi,
  reorderScheduleApi,
  deleteScheduleMilestoneApi,
  restoreDefaultScheduleApi,
  getAllFollowupCases,
  getFollowupCaseById,
  getFollowupCaseByCustomerId,
  getFollowupCasesByCustomerId,
  getAllStatusHistory,
  getStatusHistoryForCase,
  getAllFollowupLedger,
  getAllGrievances,
  getAllReminders,
  syncFollowupCasesFromServer,
  createOrSyncFollowupCase,
  ensureFollowupCaseForCustomer,
  updateCaseCurrentStatus,
  reopenFollowupCase,
  rescheduleFollowupCase,
  addTimelineFollowupEntry,
  saveGrievanceEntry,
  addGrievanceToCase,
  deleteFollowupCase,
  get90DayDashboardData,
  NINE_DAY_REPORT_CATALOG,
  export90DayFollowupReport,
  daysBetweenDates,
  REMINDER_TYPES,
  getSmartReminders,
  getRemindersForCustomer,
  saveSmartReminder,
  toggleCompleteSmartReminder,
  deleteSmartReminder,
  saveCustomAdminOptionLocal,
  deleteCustomAdminOptionLocal
} from './followups.js';
import { getAllPayments, recordPayment, deletePayment, getCustomerDuesReport, getCustomerOutstandingReceivables, PAYMENT_METHODS, PAYMENT_STATUSES, getAllRefunds, verifyPendingPayment, refundPayment } from './payments.js';
import { getAllInvoices, getInvoiceById, findOpenInvoiceForCustomerDate, saveInvoice, deleteInvoice, INVOICE_STATUSES, INVOICE_DOCUMENT_TYPES } from './invoices.js';
import { getAllExpenses, saveExpense, deleteExpense, getExpenseCategorySummary, EXPENSE_CATEGORIES } from './expenses.js';
import { getAllTargets, saveTarget, deleteTarget, TARGET_CATEGORIES } from './targets.js';
import { getAllProjects, saveProject, deleteProject, PROJECT_STAGES } from './projects.js';
import { getAllInvestments, saveInvestment, deleteInvestment, FUNDING_TYPES } from './investments.js';
import { getAllCampaigns, saveCampaign, deleteCampaign, CAMPAIGN_TYPES } from './marketing.js';
import {
  generateFinancialSummary,
  getFilteredDateRange,
  downloadCSV,
  downloadExcelSheet,
  exportTablePDF,
  exportReportPDF,
  exportReportExcel,
  exportReportCSV,
  exportAllDataExcel,
  exportAllDataPDF,
  exportAllDataCSV
} from './reports.js';
import { getAllBankingTransactions, getBankingSummary } from './banking.js';
import { getAllDaybookEntries, getAllCounterCashTxns, COUNTER_TXN_TYPES, syncDaybookFromServer } from './daybook.js';
import { getAllAttendance, getMonthlyAttendanceReport, getAllGpsAttendanceLogs, syncAttendanceRecordsFromServer } from './payroll.js';
import {
  getAllUsers,
  saveUser,
  editUser,
  deleteUser,
  downloadBackupFile,
  restoreFromFile,
  approveUser,
  rejectUser,
  requestUserCorrection,
  toggleUserStatus,
  resetUserPassword,
  fetchUsersFromBackend,
  fetchAuditLogsFromBackend,
  fetchPasswordResetReferences,
  fetchIdFormatPreview,
  getUserDashboardStats,
  getRecentLoginActivity,
  fetchPermissionsSchema,
  saveUserPermissions,
  deleteUserAccount,
  fetchDeleteHistory,
  logDeleteHistory,
  fetchAutoBackupSnapshots,
  triggerAutoBackupSnapshot
} from './settings.js';

import {
  getAllGovtCases,
  getDaysRemaining,
  saveGovtCase,
  detectDuplicateCase,
  ALL_SCHEMES,
  PUBLIC_GRIEVANCE_CHANNELS
} from './govtSchemes.js';

import {
  renderGovtAnnapurnaView
} from './govtViews.js';

import { setupGovtHandlers } from './govtHandlers.js';
import { getSystemNotifications, checkDueDateTimeReminders, getDynamicNavBadgeCounts } from './notifications.js';
import { getLucideIcon } from './lucideIcons.js';
import * as MenuMgmt from './menuManagement.js';
import {
  getAllCustomerServicesList,
  addCustomerVisit,
  getCustomerVisitAnalytics,
  getAllAnnapurnaApps,
  exportAnnapurnaReport,
  addCustomCustomerService,
  syncAnnapurnaAppsFromServer
} from './annapurnaCaseEngine.js';
import { initAnnapurnaChartsAfterRender } from './annapurnaCaseViews.js';
import {
  renderYuvaSikshaBarasaView,
  initYuvaChartsAfterRender,
  setupYuvaSikshaHandlers
} from './yuvaSikshaViews.js';
import {
  syncWardVillageMasterFromServer,
  resolveWardForApp,
  formatWardLabel
} from './wardVillageMaster.js';
import {
  renderLocationCascadeHtml,
  initLocationCascade,
  getLocationCascadeValues,
  syncLocationCascadeSelection,
  saveCustomLocationIfNeeded
} from './locationCascade.js';
import {
  RATE_CHART_KEY,
  renderRateChartView,
  setupRateChartHandlers,
  getAllRateChartItems,
  getRateChartItemById,
  getRateForService,
  upsertRateChartItem,
  deleteRateChartItem,
  restoreRateChartServiceEntry,
  restoreAllRateChartServiceEntries
} from './rateChart.js';
import {
  renderSearchableServiceSelectorHtml,
  initSearchableServiceSelector,
  getSelectedServicesState,
  setSelectedServicesState
} from './serviceSelector.js';
import {
  renderBankingView,
  renderInventoryView
} from './extraViews.js';
import { getInventoryCategories, getAllInventory, adjustStock } from './inventory.js';
import { setupExtraHandlers } from './extraHandlers.js';
import {
  renderCounterDayBookView,
  renderDailyOpeningCashView,
  renderDailyClosingCashView,
  renderStaffAttendanceView,
  renderTimeRegisterView,
  renderGpsAttendanceView,
  renderStaffLocationMapView,
  renderAttendancePhotoGalleryView,
  renderAttendanceReportsView,
  renderCashReportsView,
  createOperationsHandlers,
  stopActiveAttendanceCamera
} from './operationsCenter.js';
import {
  renderWhatsAppQuickButton,
  createWhatsAppHandlers,
  buildWhatsAppUrl,
  normalizeWhatsAppPhone
} from './whatsappConnect.js';
import {
  showA4PrintPdfPopup
} from './a4PrintPopup.js';
import {
  getUpiPaymentSettings,
  syncUpiSettingsFromServer,
  saveUpiPaymentSettings,
  removeUpiQrImage,
  renderBwDocumentHeader,
  renderOnlinePaymentUpiSection,
  renderLegalTermsSection,
  renderAcknowledgementSection,
  buildInvoiceDocumentHtml,
  buildThermalInvoiceReceiptHtml,
  buildServiceReceiptDocumentHtml,
  buildPaymentReceiptDocumentHtml,
  buildPaymentVoucherDocumentHtml,
  buildCustomerStatementDocumentHtml,
  generateBwTablePdf
} from './documentEngine.js';
import * as EnterpriseExt from './enterpriseExtensions.js';
import * as TeamChat from './chat.js';
import {
  generateReportId,
  exportUniversalCSV,
  exportUniversalExcel,
  exportUniversalPDF,
  printUniversalReport,
  buildSumTotalsRow
} from './exportUtility.js';
import { syncGasStateFromServer } from './gasServiceEngine.js';
import {
  renderStaffDirectoryView,
  renderAttendanceLiveTrackingView,
  renderTimeManagementView,
  renderStaffTasksView,
  renderTeamDocumentVaultView,
  renderEmployeePerformanceView,
  createTeamHandlers,
  syncTeamStateFromServer,
  syncTeamDocumentsFromServer,
  scheduleTeamServerSync
} from './teamManagement.js';
import {
  renderGasDashboardView,
  renderGasCustomersView,
  renderGasBookingsView,
  renderGasEligibilityView,
  renderGasSubsidyView,
  renderGasNonTakerView,
  renderGasCollectionsView,
  renderGasAccessoriesView,
  renderGasStorageView,
  renderGasSuppliersView,
  renderGasServiceReplacementView,
  renderGasReportsView,
  renderGasSettingsView
} from './gasViews.js';
import { createGasHandlers } from './gasHandlers.js';
import {
  syncHrStateFromServer,
  renderEmployeeProfileView,
  renderLeaveManagementView,
  renderSalaryPayrollView,
  renderPayslipsView,
  renderKpiPerformanceView,
  renderRecruitmentView,
  renderTrainingView,
  renderOfferLettersView,
  renderRewardsDisciplinaryView,
  createHrHandlers
} from './hrIntegrationEngine.js';
import * as DeptViews from './erpDepartmentViews.js';

/* --- Application State --- */
const AppState = {
  currentRoute: 'dashboard',
  dateFilter: 'month',
  customDateStart: null,
  customDateEnd: null,
  theme: localStorage.getItem('MUN_theme') || 'light',
  searchQuery: '',
  sidebarSearchQuery: '',
  serviceSearchQuery: '',
  serviceCategoryFilter: 'all',
  serviceStatusFilter: 'all',
  userSearchQuery: '',
  sidebarCollapsed: false,
  openNavGroup: null,
  attendanceTab: 'daily',
  reportTab: 'financial',
  reportSearchQuery: '',
  reportStatusFilter: 'all',
  reportCategoryFilter: 'all',
  reportsHydrated: false,
  followupBucketFilter: 'all',
  followupSearchQuery: '',
  followupStaffFilter: 'all',
  followupServiceFilter: 'all',
  followupStatusFilter: 'all',
  followupPriorityFilter: 'all',
  followupDateFilter: '',
  followupRegDateFilter: '',
  grievanceSearchQuery: '',
  grievancePortalFilter: 'all',
  grievanceStatusFilter: 'all',
  adminOptionCategory: 'application_status',
  adminOptionEditId: '',
  adminScheduleEditId: '',
  adminSettingsTab: 'options',
  report90DayFilter: { dateFrom: '', dateTo: '', staff: 'all', service: 'all', status: 'all', priority: 'all' },
  followupCasesHydrated: false,
  activeCustProfileId: '',
  activeCustCaseId: '',
  activeCustProfileTab: 'personal',
  serviceModalCart: [],
  serviceModalReceiptId: '',
  followupViewMode: 'cases',
  reminderBucketFilter: 'pending',
  reminderTypeFilter: 'all',
  reminderSearchQuery: '',
  gasDashDateFrom: '',
  gasDashDateTo: '',
  gasCustSearch: '',
  gasCustStatusFilter: 'all',
  gasCustCompanyFilter: 'all',
  gasCustAgencyFilter: 'all',
  gasBookSearch: '',
  gasBookStatusFilter: 'all',
  gasBookAgencyFilter: 'all',
  gasBookDateFrom: '',
  gasBookDateTo: '',
  gasBookDeliveryDateFilter: '',
  gasBookPayStatusFilter: 'all',
  gasBookDeliveryPersonFilter: 'all',
  gasBookAreaFilter: '',
  gasEligBucket: 'all',
  gasSubSearch: '',
  gasSubStatusFilter: 'all',
  gasNtSearch: '',
  gasNtStatusFilter: 'all',
  gasColSearch: '',
  gasColCatFilter: 'all',
  gasAccSearch: '',
  gasAccCatFilter: 'all',
  gasSrvSearch: '',
  gasSrvTypeFilter: 'all',
  gasSettingsTab: 'general',
  gasReportKey: 'customer_master',
  gasReportDateFrom: '',
  gasReportDateTo: '',
  gasReportSearch: ''
};

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttrJs(value) {
  return escHtml(String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

// Initialize Storage on start
initializeStorage();

/* --- Toast System --- */
export function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✓' : type === 'danger' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
  toast.innerHTML = `
    <span style="font-weight:700; color:var(--${type === 'danger' ? 'danger' : type === 'warning' ? 'warning' : type === 'info' ? 'info' : 'success'});">${icon}</span>
    <div style="flex:1;">${message}</div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/* --- Modal System (Mounted directly on document.body so render() never closes open modals) --- */
function ensureGlobalModalOverlay() {
  let overlay = document.getElementById('global-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'global-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && window.MJK?.closeModal) {
        window.MJK.closeModal();
      }
    });
    overlay.innerHTML = `
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h3 id="global-modal-title" class="modal-title">Modal Title</h3>
          <button type="button" class="modal-close" onclick="window.MJK.closeModal()">✕</button>
        </div>
        <div id="global-modal-body" class="modal-body"></div>
        <div id="global-modal-footer" class="modal-footer"></div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  return overlay;
}

export function openModal(title, htmlContent, footerHtml = '', sizeClass = '') {
  const overlay = ensureGlobalModalOverlay();
  const modalTitle = document.getElementById('global-modal-title');
  const modalBody = document.getElementById('global-modal-body');
  const modalFooter = document.getElementById('global-modal-footer');
  const modalContent = overlay?.querySelector('.modal-content');

  if (!overlay || !modalTitle || !modalBody) return;

  if (modalContent) {
    modalContent.classList.remove('modal-lg');
    if (sizeClass) modalContent.classList.add(sizeClass);
  }

  modalTitle.textContent = title;
  modalBody.innerHTML = htmlContent;
  if (modalFooter) {
    modalFooter.innerHTML = footerHtml || `
      <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Close</button>
    `;
    modalFooter.style.display = footerHtml === null ? 'none' : 'flex';
  }

  overlay.classList.add('open');
}

export function closeModal() {
  const overlay = document.getElementById('global-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

export function showConfirmDialog(title, message, onConfirm) {
  const content = `
    <div style="display:flex; align-items:flex-start; gap:1rem;">
      <div style="width:40px; height:40px; border-radius:50%; background:var(--danger-bg); color:var(--danger); display:flex; align-items:center; justify-content:center; font-size:1.25rem; font-weight:bold; flex-shrink:0;">⚠</div>
      <div>
        <h4 style="font-size:1rem; font-weight:700; margin-bottom:0.25rem;">${title}</h4>
        <p style="font-size:0.85rem; color:var(--text-muted);">${message}</p>
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
    <button class="btn btn-danger" id="confirm-dialog-yes-btn">Confirm Delete</button>
  `;

  openModal('Confirmation Required', content, footer);
  
  setTimeout(() => {
    const btn = document.getElementById('confirm-dialog-yes-btn');
    if (btn) {
      btn.onclick = () => {
        closeModal();
        if (typeof onConfirm === 'function') onConfirm();
      };
    }
  }, 50);
}

export function showDeleteReasonDialog(title, message, onConfirmWithReason) {
  const content = `
    <div style="display:flex; align-items:flex-start; gap:1rem; margin-bottom:1rem;">
      <div style="width:40px; height:40px; border-radius:50%; background:var(--danger-bg); color:var(--danger); display:flex; align-items:center; justify-content:center; font-size:1.25rem; font-weight:bold; flex-shrink:0;">🗑</div>
      <div>
        <h4 style="font-size:1rem; font-weight:700; margin-bottom:0.25rem;">${escHtml(title)}</h4>
        <p style="font-size:0.84rem; color:var(--text-muted); margin:0;">${escHtml(message)}</p>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:0;">
      <label class="form-label">Mandatory Delete Reason <span class="req">*</span></label>
      <textarea id="delete-reason-modal-input" class="form-control" rows="3" required minlength="3" placeholder="Enter exact reason for deletion (minimum 3 characters, permanently recorded in Delete History)..."></textarea>
    </div>
  `;

  const footer = `
    <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
    <button type="button" class="btn btn-danger" id="delete-reason-confirm-btn">Confirm Delete & Log Reason</button>
  `;

  openModal('Delete Reason Required (Security Audit)', content, footer);

  setTimeout(() => {
    const input = document.getElementById('delete-reason-modal-input');
    const btn = document.getElementById('delete-reason-confirm-btn');
    if (input) input.focus();
    if (btn) {
      btn.onclick = async () => {
        const reason = String(input?.value || '').trim();
        if (reason.length < 3) {
          showToast('Please enter a valid Delete Reason (at least 3 characters).', 'warning');
          input?.focus();
          return;
        }
        closeModal();
        if (typeof onConfirmWithReason === 'function') {
          await onConfirmWithReason(reason);
        }
      };
    }
  }, 60);
}

const _settingsSecurityCache = {
  deleteHistory: [],
  snapshots: [],
  deleteFilter: 'ALL',
  loaded: false,
  loading: false
};

async function hydrateSettingsSecurityData(force = false) {
  if (_settingsSecurityCache.loading || (_settingsSecurityCache.loaded && !force)) return;
  _settingsSecurityCache.loading = true;
  try {
    const cur = getCurrentUser();
    const canViewBackups = isSuperAdmin(cur) || cur?.role === 'ADMIN' || canExtra('canManageBackupSettings', cur);
    const [delHist, snaps] = await Promise.all([
      fetchDeleteHistory('ALL'),
      canViewBackups ? fetchAutoBackupSnapshots() : Promise.resolve([])
    ]);
    _settingsSecurityCache.deleteHistory = Array.isArray(delHist) ? delHist : [];
    _settingsSecurityCache.snapshots = Array.isArray(snaps) ? snaps : [];
    _settingsSecurityCache.loaded = true;
  } finally {
    _settingsSecurityCache.loading = false;
    if (AppState.currentRoute === 'settings') render();
  }
}

/* --- Theme Support --- */
function applyTheme(theme) {
  AppState.theme = theme;
  localStorage.setItem('MUN_theme', theme);
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function toggleTheme() {
  const next = AppState.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  render();
  showToast(`Switched to ${next} mode`, 'info');
}

const DELETED_GOVT_ROUTES = new Set([
  'govt-schemes',
  'govt-applications',
  'govt-grievances',
  'govt-master-register',
  'govt-documents',
  'govt-followups',
  'govt-reports'
]);

const REMOVED_OPS_ROUTE_ALIASES = {
  'card-studio': 'counter-daybook',
  daybook: 'counter-daybook',
  'daily-opening': 'daily-opening-cash',
  'daily-closing': 'daily-closing-cash',
  payroll: 'salary-payroll',
  'staff-attendance': 'attendance-tracking',
  'gps-attendance': 'attendance-tracking',
  'staff-location-map': 'attendance-tracking',
  'attendance-photo-gallery': 'attendance-tracking',
  'attendance-reports': 'employee-reports'
};

function normalizeRoute(route) {
  if (!route) return 'dashboard';
  if (route === 'gps-attendance') AppState.attendanceTab = 'gps';
  else if (route === 'staff-location-map') AppState.attendanceTab = 'map';
  else if (route === 'attendance-photo-gallery') AppState.attendanceTab = 'gallery';
  else if (route === 'staff-attendance') AppState.attendanceTab = 'daily';
  if (route === 'annapurna-applications') window._anpActiveTab = 'applications';
  else if (route === 'annapurna-complaints') window._anpActiveTab = 'complaints';
  else if (route === 'annapurna-timeline') window._anpActiveTab = 'timeline';
  else if (route === 'annapurna-reports') window._anpActiveTab = 'reports';
  if (route === 'user-approvals' || route === 'rbac-control' || route === 'permission-management' || route === 'roles-permissions') {
    const cur = getCurrentUser();
    const r = String(cur?.role || '').toUpperCase();
    if (r === 'ADMIN' || isMainAdmin(cur)) return 'admin-managers';
    if (r === 'MANAGER') return 'admin-staff';
    return 'dashboard';
  }
  if (REMOVED_OPS_ROUTE_ALIASES[route]) return REMOVED_OPS_ROUTE_ALIASES[route];
  return DELETED_GOVT_ROUTES.has(route) ? 'customers' : route;
}

const COLLAPSIBLE_NAV_GROUPS = new Set([
  'MAIN DASHBOARD',
  'ANNAPURNA YOJANA SYSTEM',
  'CUSTOMER MANAGEMENT',
  'OPERATIONS MANAGEMENT',
  'LPG & GAS SERVICES',
  'SALES & BILLING',
  'TEAM MANAGEMENT',
  'INVENTORY & PURCHASE',
  'FINANCE & ACCOUNTING',
  'GROWTH & MARKETING',
  'REPORTS & ANALYTICS',
  'SYSTEM & SECURITY',
  'ADMINISTRATION'
]);

const NAV_GROUP_DISPLAY_META = {
  'MAIN DASHBOARD': { title: 'MAIN DASHBOARD', icon: getLucideIcon('layout-dashboard', 17), accent: '#60A5FA', isLpg: false },
  'ANNAPURNA YOJANA SYSTEM': { title: 'SERVICES', icon: getLucideIcon('wheat', 17), accent: '#22C55E', isLpg: false },
  'CUSTOMER MANAGEMENT': { title: 'CUSTOMER MANAGEMENT', icon: getLucideIcon('users', 17), accent: '#06B6D4', isLpg: false },
  'OPERATIONS MANAGEMENT': { title: 'OPERATIONS MANAGEMENT', icon: getLucideIcon('settings', 17), accent: '#A78BFA', isLpg: false },
  'LPG & GAS SERVICES': { title: 'LPG & GAS SERVICES', icon: getLucideIcon('flame', 17), accent: '#EF4444', isLpg: true },
  'SALES & BILLING': { title: 'SALES & BILLING', icon: getLucideIcon('receipt', 17), accent: '#10B981', isLpg: false },
  'TEAM MANAGEMENT': { title: 'TEAM MANAGEMENT', icon: getLucideIcon('user-round', 17), accent: '#F59E0B', isLpg: false },
  'INVENTORY & PURCHASE': { title: 'INVENTORY & PURCHASE', icon: getLucideIcon('package', 17), accent: '#A78BFA', isLpg: false },
  'FINANCE & ACCOUNTING': { title: 'FINANCE & ACCOUNTING', icon: getLucideIcon('wallet', 17), accent: '#14B8A6', isLpg: false },
  'GROWTH & MARKETING': { title: 'GROWTH & MARKETING', icon: getLucideIcon('trending-up', 17), accent: '#F472B6', isLpg: false },
  'REPORTS & ANALYTICS': { title: 'REPORTS & ANALYTICS', icon: getLucideIcon('chart-column', 17), accent: '#38BDF8', isLpg: false },
  'SYSTEM & SECURITY': { title: 'SYSTEM & SECURITY', icon: getLucideIcon('shield-check', 17), accent: '#94A3B8', isLpg: false },
  'ADMINISTRATION': { title: 'ADMINISTRATION', icon: getLucideIcon('shield-check', 17), accent: '#D6B56D', isLpg: false }
};

function syncNavAccordionDom(nextGroup) {
  AppState.openNavGroup = nextGroup || null;
  const groups = document.querySelectorAll('#app-sidebar .nav-accordion-group');
  groups.forEach((groupEl) => {
    const groupKey = groupEl.getAttribute('data-nav-group');
    const isOpen = Boolean(AppState.openNavGroup && groupKey === AppState.openNavGroup);
    groupEl.classList.toggle('open', isOpen);
    groupEl.classList.remove('search-expanded');
    const trigger = groupEl.querySelector('.nav-accordion-trigger');
    if (trigger) {
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
  });
}

export function toggleNavGroup(group, event) {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  if (AppState.sidebarCollapsed) {
    AppState.sidebarCollapsed = false;
    AppState.openNavGroup = group;
    render();
    return;
  }
  const nextGroup = AppState.openNavGroup === group ? null : group;
  syncNavAccordionDom(nextGroup);
  if (nextGroup) {
    const escapedGroup = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(nextGroup)
      : nextGroup.replace(/"/g, '\\"');
    const targetEl = document.querySelector(`#app-sidebar .nav-accordion-group[data-nav-group="${escapedGroup}"]`);
    if (targetEl && typeof targetEl.scrollIntoView === 'function') {
      requestAnimationFrame(() => {
        targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
  }
}

export function closeNavAccordions() {
  if (AppState.openNavGroup) {
    syncNavAccordionDom(null);
  }
}

function getBaseSidebarNavCatalog(user) {
  const counts = getDynamicNavBadgeCounts(user);
  return [
    // 1. MAIN DASHBOARD
    { id: 'dashboard', label: 'Executive Dashboard', icon: 'layout-dashboard', group: 'MAIN DASHBOARD', keywords: 'home summary overview main' },
    { id: 'business-overview', label: 'Business Overview', icon: 'briefcase', group: 'MAIN DASHBOARD', keywords: 'profit health company stats' },
    { id: 'todays-summary', label: "Today's Summary", icon: 'calendar-check', group: 'MAIN DASHBOARD', keywords: 'daily counter cash revenue today' },
    { id: 'pending-activities', label: 'Pending Activities', icon: 'list-checks', group: 'MAIN DASHBOARD', badge: counts.totalPendingActivities, badgeType: 'warning', keywords: 'alerts pending approvals dues tasks' },
    { id: 'quick-actions', label: 'Quick Actions', icon: 'zap', group: 'MAIN DASHBOARD', keywords: 'shortcuts launcher counter' },

    // 2. SERVICES (ANNAPURNA YOJANA & BANGLAR YUVA SIKSHA BARASA CARD)
    { id: 'govt-annapurna', label: 'Annapurna Yojana System', icon: 'wheat', group: 'ANNAPURNA YOJANA SYSTEM', badge: counts.unprocessedApplications, badgeType: 'warning', keywords: 'annapurna yojana scheme rice govt dashboard overview' },
    { id: 'annapurna-applications', label: 'Case & Problem Tracking', icon: 'clipboard-list', group: 'ANNAPURNA YOJANA SYSTEM', keywords: 'annapurna case service problem tracking category status' },
    { id: 'annapurna-complaints', label: 'Claims, RTI & Complaints', icon: 'message-square-warning', group: 'ANNAPURNA YOJANA SYSTEM', keywords: 'annapurna claims rti grievance complaints' },
    { id: 'annapurna-timeline', label: 'Case Timeline & Follow-ups', icon: 'history', group: 'ANNAPURNA YOJANA SYSTEM', keywords: 'annapurna timeline followup office visit log' },
    { id: 'annapurna-reports', label: 'Annapurna Reports & Exports', icon: 'file-spreadsheet', group: 'ANNAPURNA YOJANA SYSTEM', keywords: 'annapurna reports pdf excel csv export ward' },
    { id: 'yuva-siksha-barasa', label: 'Banglar Yuva Siksha Barasa Card Management', icon: 'graduation-cap', group: 'ANNAPURNA YOJANA SYSTEM', keywords: 'banglar yuva siksha barasa card student youth education loan scholarship skill training' },

    // 3. CUSTOMER MANAGEMENT
    { id: 'customers', label: 'All Customers', icon: 'users', group: 'CUSTOMER MANAGEMENT', keywords: 'customer directory phone village' },
    { id: 'customer-registration', label: 'Customer Registration', icon: 'user-plus', group: 'CUSTOMER MANAGEMENT', keywords: 'new customer application register' },
    { id: 'customer-profiles', label: 'Customer Profiles', icon: 'contact', group: 'CUSTOMER MANAGEMENT', keywords: 'customer 360 history' },
    { id: 'customer-documents', label: 'Customer Documents', icon: 'folder-lock', group: 'CUSTOMER MANAGEMENT', keywords: 'kyc aadhaar attachment' },
    { id: 'followups', label: 'Follow-ups & Reminders', icon: 'phone-call', group: 'CUSTOMER MANAGEMENT', badge: counts.overdueFollowups, badgeType: 'danger', keywords: '90 day followup reminder call' },
    { id: 'customer-feedback', label: 'Customer Feedback', icon: 'message-square-heart', group: 'CUSTOMER MANAGEMENT', keywords: 'review rating satisfaction' },
    { id: 'grievances', label: 'Complaints & Support', icon: 'alert-circle', group: 'CUSTOMER MANAGEMENT', badge: counts.pendingComplaints, badgeType: 'danger', keywords: 'grievance cmo cpgrams complaint' },
    { id: 'customer-dues', label: 'Customer Dues', icon: 'receipt', group: 'CUSTOMER MANAGEMENT', badge: counts.pendingPayments, badgeType: 'warning', keywords: 'due balance receivable pending collection' },
    { id: 'customer-reports', label: 'Customer Reports', icon: 'file-spreadsheet', group: 'CUSTOMER MANAGEMENT', keywords: 'customer export pdf excel csv' },

    // 4. OPERATIONS MANAGEMENT
    { id: 'operations-dashboard', label: 'Operations Dashboard', icon: 'settings-2', group: 'OPERATIONS MANAGEMENT', keywords: 'counter ops queue' },
    { id: 'daily-task-manager', label: 'Daily Task Manager', icon: 'clipboard-list', group: 'OPERATIONS MANAGEMENT', keywords: 'daily tasks queue' },
    { id: 'service-requests', label: 'Service Requests', icon: 'inbox', group: 'OPERATIONS MANAGEMENT', keywords: 'open pending services' },
    { id: 'service-delivery-tracking', label: 'Service Delivery Tracking', icon: 'package-check', group: 'OPERATIONS MANAGEMENT', keywords: 'delivery status pipeline' },
    { id: 'document-processing', label: 'Document Processing', icon: 'file-check', group: 'OPERATIONS MANAGEMENT', keywords: 'pvc pan voter passport csc' },
    { id: 'applications', label: 'Applications & Timeline', icon: 'file-text', group: 'OPERATIONS MANAGEMENT', keywords: 'application status tracking' },
    { id: 'services', label: 'Services & Tracking', icon: 'layers', group: 'OPERATIONS MANAGEMENT', keywords: 'all services counter receipts' },
    { id: 'operational-reports', label: 'Operational Reports', icon: 'file-bar-chart', group: 'OPERATIONS MANAGEMENT', keywords: 'ops pdf excel export' },

    // 4. LPG & GAS SERVICES
    { id: 'gas-dashboard', label: 'Gas Dashboard', icon: 'flame', group: 'LPG & GAS SERVICES', keywords: 'lpg indane bharat hp overview' },
    { id: 'gas-customers', label: 'Gas Customer Register', icon: 'users', group: 'LPG & GAS SERVICES', keywords: 'consumer lpg kyc book' },
    { id: 'gas-new-booking', label: 'New Gas Booking', icon: 'plus-circle', group: 'LPG & GAS SERVICES', keywords: 'cylinder refill book' },
    { id: 'gas-bookings', label: 'All Gas Bookings', icon: 'cylinder', group: 'LPG & GAS SERVICES', badge: counts.unprocessedGasBookings, badgeType: 'warning', keywords: 'booking register refill queue' },
    { id: 'gas-delivery-management', label: 'Delivery Management', icon: 'truck', group: 'LPG & GAS SERVICES', keywords: 'delivery rider assign dispatch' },
    { id: 'gas-collections', label: 'Gas Billing & Payments', icon: 'wallet', group: 'LPG & GAS SERVICES', keywords: 'gas payment collection receipt' },
    { id: 'gas-subsidy', label: 'Subsidy Management', icon: 'landmark', group: 'LPG & GAS SERVICES', keywords: 'dbt subsidy non taker' },
    { id: 'gas-eligibility', label: 'Booking Eligibility', icon: 'calendar-check', group: 'LPG & GAS SERVICES', keywords: 'cooldown 15 days 21 days eligible' },
    { id: 'gas-accessories', label: 'LPG Stock & Inventory', icon: 'shopping-bag', group: 'LPG & GAS SERVICES', keywords: 'pipe regulator stove storage' },
    { id: 'gas-complaints', label: 'LPG Complaints', icon: 'alert-circle', group: 'LPG & GAS SERVICES', keywords: 'leakage complaint cylinder' },
    { id: 'gas-reports', label: 'Gas Reports', icon: 'file-spreadsheet', group: 'LPG & GAS SERVICES', keywords: 'lpg pdf excel csv export' },

    // 5. SALES & BILLING
    { id: 'sales-dashboard', label: 'Sales Dashboard', icon: 'bar-chart-2', group: 'SALES & BILLING', keywords: 'sales summary revenue billing' },
    { id: 'new-invoice', label: 'New Invoice / Billing', icon: 'file-plus', group: 'SALES & BILLING', keywords: 'create invoice bill receipt' },
    { id: 'invoices', label: 'All Invoices', icon: 'receipt', group: 'SALES & BILLING', keywords: 'invoices bills print gst' },
    { id: 'quotations', label: 'Quotations', icon: 'file-spreadsheet', group: 'SALES & BILLING', keywords: 'quote convert invoice' },
    { id: 'estimates', label: 'Estimates', icon: 'calculator', group: 'SALES & BILLING', keywords: 'cost estimate quote' },
    { id: 'sales-returns', label: 'Sales Returns', icon: 'rotate-ccw', group: 'SALES & BILLING', keywords: 'return refund bill cancel' },
    { id: 'credit-notes', label: 'Credit Notes', icon: 'file-minus', group: 'SALES & BILLING', keywords: 'credit adjustment note' },
    { id: 'gst-billing', label: 'GST Billing', icon: 'percent', group: 'SALES & BILLING', keywords: 'cgst sgst gstr1 tax' },
    { id: 'customer-ledger', label: 'Customer Ledger', icon: 'book-open', group: 'SALES & BILLING', keywords: 'debit credit statement balance' },
    { id: 'sales-reports', label: 'Sales Reports', icon: 'file-bar-chart', group: 'SALES & BILLING', keywords: 'sales export excel pdf' },

    // 6. TEAM MANAGEMENT
    { id: 'staff-directory', label: 'All Employees', icon: 'users', group: 'TEAM MANAGEMENT', keywords: 'staff roster directory uid' },
    { id: 'recruitment', label: 'Recruitment & Job Posting', icon: 'user-plus', group: 'TEAM MANAGEMENT', badge: counts.pendingJobApps, badgeType: 'info', keywords: 'hiring jobs candidates applicants' },
    { id: 'employee-profile', label: 'Employee ID & Profile', icon: 'id-card', group: 'TEAM MANAGEMENT', keywords: 'employee id 360 salary documents kpi' },
    { id: 'attendance-tracking', label: 'Attendance Management', icon: 'calendar-check', group: 'TEAM MANAGEMENT', keywords: 'gps photo check in out attendance' },
    { id: 'leave-management', label: 'Leave & Holiday Management', icon: 'calendar-off', group: 'TEAM MANAGEMENT', badge: counts.pendingLeaves, badgeType: 'warning', keywords: 'leave holiday request approval' },
    { id: 'salary-payroll', label: 'Salary & Payroll', icon: 'banknote', group: 'TEAM MANAGEMENT', keywords: 'salary wages deduction overtime payroll' },
    { id: 'payslips', label: 'Payslip & Salary History', icon: 'file-text', group: 'TEAM MANAGEMENT', keywords: 'payslip slip salary print pdf' },
    { id: 'tasks', label: 'Tasks & Assignment', icon: 'clipboard-list', group: 'TEAM MANAGEMENT', badge: counts.incompleteTasks, badgeType: counts.overdueTasks > 0 ? 'danger' : 'info', keywords: 'task checklist assignment overdue' },
    { id: 'kpi-performance', label: 'KPI / KRA & Performance', icon: 'gauge', group: 'TEAM MANAGEMENT', keywords: 'kpi kra performance weights evaluation' },
    { id: 'training', label: 'Training & Development', icon: 'graduation-cap', group: 'TEAM MANAGEMENT', keywords: 'skill training course certification' },
    { id: 'documents', label: 'Employee Documents', icon: 'folder-lock', group: 'TEAM MANAGEMENT', badge: counts.expiringDocs, badgeType: 'warning', keywords: 'vault kyc docs expiry verification' },
    { id: 'offer-letters', label: 'Offer & Appointment Letters', icon: 'file-signature', group: 'TEAM MANAGEMENT', keywords: 'offer appointment increment experience letter' },
    { id: 'rewards-disciplinary', label: 'Rewards & Disciplinary', icon: 'award', group: 'TEAM MANAGEMENT', keywords: 'bonus award warning appreciation' },
    { id: 'employee-reports', label: 'HR & Payroll Reports', icon: 'bar-chart-3', group: 'TEAM MANAGEMENT', keywords: 'attendance reports productivity export' },

    // 7. INVENTORY & PURCHASE
    { id: 'inventory-dashboard', label: 'Inventory Dashboard', icon: 'boxes', group: 'INVENTORY & PURCHASE', keywords: 'stock valuation summary' },
    { id: 'inventory', label: 'All Products / Stock', icon: 'package', group: 'INVENTORY & PURCHASE', keywords: 'hardware stationery items sku' },
    { id: 'product-categories', label: 'Product Categories', icon: 'tags', group: 'INVENTORY & PURCHASE', keywords: 'category group classification' },
    { id: 'stock-adjustment', label: 'Stock Adjustment', icon: 'sliders-horizontal', group: 'INVENTORY & PURCHASE', keywords: 'add deduct damage audit stock' },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: 'clipboard-list', group: 'INVENTORY & PURCHASE', keywords: 'po vendor order receive' },
    { id: 'suppliers', label: 'Suppliers / Vendors', icon: 'truck', group: 'INVENTORY & PURCHASE', keywords: 'vendor supplier agency' },
    { id: 'purchase-bills', label: 'Purchase Bills', icon: 'file-text', group: 'INVENTORY & PURCHASE', keywords: 'vendor invoice payable gst' },
    { id: 'stock-transfers', label: 'Stock Transfers', icon: 'arrow-left-right', group: 'INVENTORY & PURCHASE', keywords: 'transfer warehouse godown counter' },
    { id: 'low-stock-alerts', label: 'Low Stock Alerts', icon: 'alert-triangle', group: 'INVENTORY & PURCHASE', badge: counts.lowInventory, badgeType: 'danger', keywords: 'reorder low qty alert' },
    { id: 'barcode-management', label: 'Barcode Management', icon: 'scan-barcode', group: 'INVENTORY & PURCHASE', keywords: 'barcode sku print label' },
    { id: 'inventory-reports', label: 'Inventory Reports', icon: 'file-spreadsheet', group: 'INVENTORY & PURCHASE', keywords: 'stock report excel pdf' },

    // 9. FINANCE & ACCOUNTING
    { id: 'finance-dashboard', label: 'Finance Dashboard', icon: 'wallet', group: 'FINANCE & ACCOUNTING', keywords: 'accounts cash liquidity pnl' },
    { id: 'bank-accounts', label: 'Bank Accounts', icon: 'landmark', group: 'FINANCE & ACCOUNTING', keywords: 'pnb bank balance account' },
    { id: 'daily-transactions', label: 'Daily Transactions', icon: 'arrow-up-down', group: 'FINANCE & ACCOUNTING', keywords: 'cash in out ledger feed' },
    { id: 'counter-daybook', label: 'Counter Day Book', icon: 'book-open', group: 'FINANCE & ACCOUNTING', keywords: 'daybook opening closing cash' },
    { id: 'daily-opening-cash', label: 'Daily Opening Cash', icon: 'sun', group: 'FINANCE & ACCOUNTING', keywords: 'opening cash morning float counter drawer' },
    { id: 'daily-closing-cash', label: 'Daily Closing Cash', icon: 'lock', group: 'FINANCE & ACCOUNTING', keywords: 'closing cash evening counter reconcile' },
    { id: 'income', label: 'Income Management', icon: 'trending-up', group: 'FINANCE & ACCOUNTING', keywords: 'income profit revenue' },
    { id: 'expenses', label: 'Expense Management', icon: 'trending-down', group: 'FINANCE & ACCOUNTING', keywords: 'expense bills rent electricity' },
    { id: 'payments', label: 'Payments & Receipts', icon: 'wallet', group: 'FINANCE & ACCOUNTING', keywords: 'collect upi cash voucher' },
    { id: 'accounts-payable', label: 'Accounts Payable', icon: 'credit-card', group: 'FINANCE & ACCOUNTING', keywords: 'vendor due payable' },
    { id: 'accounts-receivable', label: 'Accounts Receivable', icon: 'hand-coins', group: 'FINANCE & ACCOUNTING', keywords: 'customer due receivable' },
    { id: 'general-ledger', label: 'General Ledger', icon: 'book-open', group: 'FINANCE & ACCOUNTING', keywords: 'trial ledger accounts' },
    { id: 'journal-entries', label: 'Journal Entries', icon: 'scale', group: 'FINANCE & ACCOUNTING', keywords: 'double entry debit credit jv' },
    { id: 'bank-reconciliation', label: 'Bank Reconciliation', icon: 'check-square', group: 'FINANCE & ACCOUNTING', keywords: 'statement variance match' },
    { id: 'gst-management', label: 'GST Management', icon: 'percent', group: 'FINANCE & ACCOUNTING', keywords: 'itc output input gst tax' },
    { id: 'financial-reports', label: 'Financial Reports', icon: 'file-spreadsheet', group: 'FINANCE & ACCOUNTING', keywords: 'cash reports accounts export' },
    { id: 'profit-loss', label: 'Profit & Loss', icon: 'trending-up', group: 'FINANCE & ACCOUNTING', keywords: 'income statement net profit' },
    { id: 'balance-sheet', label: 'Balance Sheet', icon: 'scale', group: 'FINANCE & ACCOUNTING', keywords: 'assets liabilities capital' },

    // 9. GROWTH & MARKETING
    { id: 'growth-dashboard', label: 'Growth Dashboard', icon: 'trending-up', group: 'GROWTH & MARKETING', keywords: 'growth leads conversion' },
    { id: 'growth-plan', label: 'Growth Plan', icon: 'map', group: 'GROWTH & MARKETING', keywords: 'roadmap expansion plan' },
    { id: 'targets', label: 'Monthly Targets', icon: 'target', group: 'GROWTH & MARKETING', keywords: 'sales targets goals' },
    { id: 'profit-targets', label: 'Profit Targets', icon: 'target', group: 'GROWTH & MARKETING', keywords: 'net profit goal achievement' },
    { id: 'marketing', label: 'Marketing Campaigns', icon: 'megaphone', group: 'GROWTH & MARKETING', keywords: 'campaigns whatsapp banner' },
    { id: 'promotions-offers', label: 'Promotions & Offers', icon: 'badge-percent', group: 'GROWTH & MARKETING', keywords: 'promo code discount offer' },
    { id: 'customer-acquisition', label: 'Customer Acquisition', icon: 'user-plus', group: 'GROWTH & MARKETING', keywords: 'locality growth village reach' },
    { id: 'referral-management', label: 'Referral Management', icon: 'share-2', group: 'GROWTH & MARKETING', keywords: 'referral commission reward' },
    { id: 'lead-management', label: 'Lead Management', icon: 'target', group: 'GROWTH & MARKETING', keywords: 'prospect lead convert customer' },
    { id: 'projects', label: 'Expansion Projects', icon: 'rocket', group: 'GROWTH & MARKETING', keywords: 'new business project' },
    { id: 'investments', label: 'Capital & Investments', icon: 'briefcase', group: 'GROWTH & MARKETING', keywords: 'capital investment equity' },
    { id: 'competitors', label: 'Competitor Analysis', icon: 'search', group: 'GROWTH & MARKETING', keywords: 'market pricing competitor' },
    { id: 'growth-reports', label: 'Growth Reports', icon: 'file-spreadsheet', group: 'GROWTH & MARKETING', keywords: 'leads acquisition export' },

    // 10. REPORTS & ANALYTICS
    { id: 'reports', label: 'Executive Reports', icon: 'chart-column', group: 'REPORTS & ANALYTICS', keywords: 'analytics summary financial' },
    { id: 'daily-reports', label: 'Daily Reports', icon: 'calendar-check', group: 'REPORTS & ANALYTICS', keywords: 'today report summary' },
    { id: 'monthly-reports', label: 'Monthly Reports', icon: 'calendar', group: 'REPORTS & ANALYTICS', keywords: 'month wise comparison' },
    { id: 'employee-performance-analytics', label: 'Employee Performance', icon: 'gauge', group: 'REPORTS & ANALYTICS', keywords: 'kpi leaderboard staff analytics' },
    { id: 'sales-analytics', label: 'Sales Analytics', icon: 'bar-chart-2', group: 'REPORTS & ANALYTICS', keywords: 'billing revenue analytics' },
    { id: 'purchase-analytics', label: 'Purchase Analytics', icon: 'clipboard-list', group: 'REPORTS & ANALYTICS', keywords: 'vendor purchase bills' },
    { id: 'inventory-analytics', label: 'Inventory Analytics', icon: 'boxes', group: 'REPORTS & ANALYTICS', keywords: 'stock valuation analytics' },
    { id: 'financial-analytics', label: 'Financial Analytics', icon: 'wallet', group: 'REPORTS & ANALYTICS', keywords: 'pnl balance sheet analytics' },
    { id: 'customer-analytics', label: 'Customer Analytics', icon: 'users', group: 'REPORTS & ANALYTICS', keywords: 'locality distribution growth' },
    { id: 'department-reports', label: 'Department Reports', icon: 'layers', group: 'REPORTS & ANALYTICS', keywords: 'all departments comparison' },
    { id: 'custom-report-builder', label: 'Custom Report Builder', icon: 'sliders', group: 'REPORTS & ANALYTICS', keywords: 'query filter export builder' },
    { id: 'pdf-excel-export', label: 'PDF / Excel Export', icon: 'download', group: 'REPORTS & ANALYTICS', keywords: 'csv xlsx pdf print hub' },

    // 12. SYSTEM & SECURITY
    { id: 'universal-search', label: 'ERP Search', icon: 'search', group: 'SYSTEM & SECURITY', keywords: 'global find search records' },
    { id: 'business', label: 'Company Profile', icon: 'building-2', group: 'SYSTEM & SECURITY', keywords: 'mun computer letterhead address' },
    { id: 'rate-chart', label: 'Service Rate Chart', icon: 'receipt', group: 'SYSTEM & SECURITY', keywords: 'rate fee directory pricing service chart' },
    { id: 'menu-management', label: 'Menu Management', icon: 'sliders', group: 'SYSTEM & SECURITY', keywords: 'customize rename reorder icon submenu menu' },
    { id: 'login-history', label: 'Login History', icon: 'key-round', group: 'SYSTEM & SECURITY', keywords: 'signin auth session logs' },
    { id: 'audit-logs', label: 'Audit Logs', icon: 'scroll-text', group: 'SYSTEM & SECURITY', keywords: 'audit history trail' },
    { id: 'activity-logs', label: 'Activity Logs', icon: 'activity', group: 'SYSTEM & SECURITY', keywords: 'activity events system' },
    { id: 'notification-settings', label: 'Notification Settings', icon: 'bell', group: 'SYSTEM & SECURITY', keywords: 'alerts expiry window thresholds' },
    { id: 'database-management', label: 'Database Management', icon: 'database', group: 'SYSTEM & SECURITY', keywords: 'sqlite db health backup snapshot' },
    { id: 'data-import-export', label: 'Backup / Restore / Export', icon: 'hard-drive-download', group: 'SYSTEM & SECURITY', keywords: 'json backup restore import' },
    { id: 'locations-master', label: 'Locations & Domkal Wards', icon: 'map-pin', group: 'SYSTEM & SECURITY', keywords: 'murshidabad domkal ward village' },
    { id: 'settings', label: 'System Settings', icon: 'settings', group: 'SYSTEM & SECURITY', keywords: 'settings theme backup' },
    { id: 'security-settings', label: 'Security Settings', icon: 'lock', group: 'SYSTEM & SECURITY', keywords: 'session mfa lockout policy' },

    // ADMINISTRATION (EXACTLY TWO SUBMENUS: MANAGER & STAFF)
    { id: 'admin-managers', label: 'MANAGER', icon: 'user-check', group: 'ADMINISTRATION', keywords: 'administration manager accounts' },
    { id: 'admin-staff', label: 'STAFF', icon: 'users', group: 'ADMINISTRATION', keywords: 'administration staff accounts' }
  ];
}

function getSidebarNavCatalog(user) {
  return MenuMgmt.applyMenuConfigToCatalog(getBaseSidebarNavCatalog(user));
}

function highlightMatchHtml(text, query) {
  const safe = escHtml(text);
  const q = String(query || '').trim();
  if (!q) return safe;
  const escapedRe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${escapedRe})`, 'ig'), '<mark class="sidebar-match">$1</mark>');
}

function renderSidebarSearchDropdownHtml(query, allowedItems) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return '';
  const hits = allowedItems.filter((item) => {
    const deptTitle = MenuMgmt.getDepartmentMeta(item.group).title;
    const hay = `${item.label} ${item.group} ${deptTitle} ${item.id} ${item.keywords || ''}`.toLowerCase();
    return hay.includes(q);
  });
  if (!hits.length) {
    return `<div style="padding:0.65rem; text-align:center; font-size:0.76rem; color:#94A3B8;">No matching modules for "${escHtml(query)}"</div>`;
  }
  return hits.slice(0, 18).map((item) => {
    const deptTitle = MenuMgmt.getDepartmentMeta(item.group).title;
    return `
      <button
        type="button"
        class="sidebar-search-hit"
        onclick="window.MJK.navigateFromSidebarSearch('${escAttrJs(item.id)}', '${escAttrJs(item.group)}')"
      >
        <span class="sidebar-search-hit-title">
          <span style="display:inline-flex; color:${item.group === 'LPG & GAS SERVICES' ? '#EF4444' : '#60A5FA'};">${getLucideIcon(item.icon, 14)}</span>
          <span>${highlightMatchHtml(item.label, query)}</span>
        </span>
        <span class="sidebar-search-dept">${highlightMatchHtml(deptTitle, query)} · #${escHtml(item.id)}</span>
      </button>
    `;
  }).join('');
}

/* --- Router & View Management with Route Protection --- */
export function navigateTo(route) {
  const targetRoute = normalizeRoute(route);
  document.body.classList.remove('mobile-drawer-open');
  if ((AppState.currentRoute === 'gps-attendance' || AppState.currentRoute === 'attendance-tracking') && targetRoute !== 'gps-attendance' && targetRoute !== 'attendance-tracking') {
    stopActiveAttendanceCamera();
  }
  const user = getCurrentUser();
  if (targetRoute !== 'login' && user && !canAccessRoute(targetRoute, user)) {
    showToast(`Access Restricted: ${user.role} role is not authorized to access ${targetRoute.toUpperCase()}`, 'danger');
    AppState.deniedRoute = targetRoute;
    AppState.currentRoute = 'access-denied';
    window.location.hash = `#access-denied`;
    render();
    return;
  }
  const prevRoute = AppState.currentRoute;
  if (targetRoute === 'govt-annapurna' && String(prevRoute || '').startsWith('annapurna-')) {
    window._anpActiveTab = 'dashboard';
  }
  const matchedNav = getSidebarNavCatalog(user).find(n => n.id === targetRoute);
  if (matchedNav) {
    AppState.openNavGroup = matchedNav.group;
  }
  AppState.currentRoute = targetRoute;
  window.location.hash = `#${targetRoute}`;
  render();
  if (targetRoute === 'govt-annapurna' || targetRoute.startsWith('annapurna-')) {
    Promise.allSettled([
      syncWardVillageMasterFromServer(),
      syncAnnapurnaAppsFromServer()
    ]).then(() => {
      if (AppState.currentRoute === targetRoute) render();
    });
  } else if (targetRoute.startsWith('gas-')) {
    syncGasStateFromServer().then((gs) => {
      if (gs && String(AppState.currentRoute || '').startsWith('gas-')) render();
    });
  } else if (['time-register', 'tasks', 'employee-reports', 'employee-profile', 'leave-management', 'salary-payroll', 'payslips', 'kpi-performance', 'recruitment', 'training', 'offer-letters', 'rewards-disciplinary', 'employee-performance-analytics'].includes(targetRoute)) {
    Promise.allSettled([
      syncTeamStateFromServer(),
      syncHrStateFromServer(),
      fetchUsersFromBackend(),
      syncAttendanceRecordsFromServer()
    ]).then(() => {
      if (AppState.currentRoute === targetRoute) render();
    });
  } else if (targetRoute === 'documents' || targetRoute === 'customer-documents') {
    Promise.allSettled([
      syncTeamDocumentsFromServer(),
      fetchUsersFromBackend()
    ]).then(() => {
      if (AppState.currentRoute === targetRoute) render();
    });
  } else if (targetRoute === 'staff-directory' || targetRoute === 'admin-managers' || targetRoute === 'admin-staff') {
    const syncTasks = [fetchUsersFromBackend(), syncHrStateFromServer()];
    if (targetRoute === 'admin-managers' || targetRoute === 'admin-staff') {
      syncTasks.push(fetchPasswordResetReferences().then(refs => { AppState.resetReferences = refs; }));
      if (isMainAdmin(user) || String(user?.role || '').toUpperCase() === 'ADMIN') {
        syncTasks.push(fetchAuditLogsFromBackend().then(logs => { if (Array.isArray(logs)) setItem(KEYS.AUDIT_LOGS, logs); }));
      }
    }
    Promise.allSettled(syncTasks).then(() => {
      if (AppState.currentRoute === targetRoute) render();
    });
  } else if (['quotations', 'estimates', 'sales-returns', 'credit-notes', 'purchase-orders', 'purchase-bills', 'stock-adjustment', 'stock-transfers', 'bank-accounts', 'journal-entries', 'bank-reconciliation', 'customer-feedback', 'lead-management', 'referral-management', 'promotions-offers', 'notification-settings', 'security-settings'].includes(targetRoute)) {
    DeptViews.syncExtendedErpFromServer().then((ext) => {
      if (ext && AppState.currentRoute === targetRoute) render();
    });
  }
}

window.addEventListener('hashchange', () => {
  const user = getCurrentUser();
  if (!user) return;
  const rawRoute = window.location.hash.replace('#', '') || 'dashboard';
  const route = normalizeRoute(rawRoute);
  if ((AppState.currentRoute === 'gps-attendance' || AppState.currentRoute === 'attendance-tracking') && route !== 'gps-attendance' && route !== 'attendance-tracking') {
    stopActiveAttendanceCamera();
  }
  if (route !== rawRoute) {
    window.location.hash = `#${route}`;
  }
  if (route !== 'login' && route !== 'access-denied' && !canAccessRoute(route, user)) {
    showToast(`Access Restricted: ${user.role} cannot access ${route.toUpperCase()}`, 'danger');
    AppState.deniedRoute = route;
    AppState.currentRoute = 'access-denied';
    render();
    return;
  }
  if (route !== AppState.currentRoute) {
    AppState.currentRoute = route;
    render();
  }
});

/* --- Global Quick Search (Ctrl+K) --- */
export function openGlobalSearch() {
  if (typeof EnterpriseExt.openServerGlobalSearch === 'function') {
    EnterpriseExt.openServerGlobalSearch();
    return;
  }
  const customers = getAllCustomers();
  const services = getAllServices();
  const invoices = getAllInvoices();
  
  const content = `
    <div class="form-group" style="margin-bottom:1rem;">
      <input type="text" id="global-search-modal-input" class="form-control" placeholder="Search customer, phone, reference number, or invoice in MUN COMPUTER..." autofocus>
    </div>
    <div id="global-search-results" style="max-height:360px; overflow-y:auto; display:flex; flex-direction:column; gap:0.5rem;">
      <div style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:1.5rem;">Type above to search across all MUN COMPUTER records...</div>
    </div>
  `;

  openModal('Search Records (Ctrl+K)', content, null);

  setTimeout(() => {
    const input = document.getElementById('global-search-modal-input');
    const resultsContainer = document.getElementById('global-search-results');
    if (!input || !resultsContainer) return;

    input.focus();
    input.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        resultsContainer.innerHTML = `<div style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:1.5rem;">Type above to search...</div>`;
        return;
      }

      const activeRateItems = getAllRateChartItems().filter(r => r.isActive !== false);
      const matchRate = activeRateItems.filter(r =>
        (r.serviceName || '').toLowerCase().includes(q) ||
        (r.nameBn || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q)
      );
      const matchCust = customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.id.toLowerCase().includes(q));
      const matchSrv = services.filter(s => s.serviceName.toLowerCase().includes(q) || s.refNumber.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q));
      const matchInv = invoices.filter(i => i.id.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q));

      if (!matchRate.length && !matchCust.length && !matchSrv.length && !matchInv.length) {
        resultsContainer.innerHTML = `<div style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:1.5rem;">No matching records found for "${q}"</div>`;
        return;
      }

      let html = '';
      if (matchRate.length) {
        html += `<div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-top:0.5rem;">Service Directory &amp; Rate Chart (${matchRate.length})</div>`;
        matchRate.slice(0, 8).forEach(r => {
          const shop = Number(r.serviceCharge) || 0;
          const gov = Number(r.govFee) || 0;
          const total = shop + gov;
          html += `
            <div onclick="window._rateChartSearch='${escAttrJs(r.serviceName)}'; window._rateChartCat='all'; window.MJK.navigateTo('rate-chart'); window.MJK.closeModal();" style="padding:0.6rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); cursor:pointer; background:var(--surface-alt); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600; font-size:0.85rem;">${escHtml(r.serviceName)}${r.nameBn ? ` (${escHtml(r.nameBn)})` : ''}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${escHtml(r.category)} · Shop ${formatINR(shop)}${gov > 0 ? ` · Govt ${formatINR(gov)}` : ''} · Total ${formatINR(total)}</div>
              </div>
              <span class="badge badge-info">₹${total}</span>
            </div>
          `;
        });
      }

      if (matchCust.length) {
        html += `<div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-top:0.5rem;">Customers (${matchCust.length})</div>`;
        matchCust.slice(0, 5).forEach(c => {
          html += `
            <div onclick="window.MJK.viewCustomerProfile('${c.id}'); window.MJK.closeModal();" style="padding:0.6rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); cursor:pointer; background:var(--surface-alt); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600; font-size:0.85rem;">${c.name}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${c.phone} · ${c.village || c.district}</div>
              </div>
              <span class="badge badge-neutral">${c.id}</span>
            </div>
          `;
        });
      }

      if (matchSrv.length) {
        html += `<div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-top:0.5rem;">Services (${matchSrv.length})</div>`;
        matchSrv.slice(0, 5).forEach(s => {
          html += `
            <div onclick="window.MJK.navigateTo('services'); window.MJK.closeModal();" style="padding:0.6rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); cursor:pointer; background:var(--surface-alt); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600; font-size:0.85rem;">${s.serviceName}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${s.customerName} · Ref: ${s.refNumber}</div>
              </div>
              <span class="badge badge-info">${s.status}</span>
            </div>
          `;
        });
      }

      if (matchInv.length) {
        html += `<div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-top:0.5rem;">Invoices (${matchInv.length})</div>`;
        matchInv.slice(0, 5).forEach(i => {
          html += `
            <div onclick="window.MJK.printInvoice('${i.id}'); window.MJK.closeModal();" style="padding:0.6rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); cursor:pointer; background:var(--surface-alt); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600; font-size:0.85rem;">Invoice ${i.id} - ${formatINR(i.totalAmount)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${i.customerName} · ${formatDate(i.date)}</div>
              </div>
              <span class="badge badge-success">${i.status}</span>
            </div>
          `;
        });
      }

      resultsContainer.innerHTML = html;
    });
  }, 100);
}

// Global Keyboard Shortcut: Ctrl+K or Cmd+K, Escape to close mobile drawer / open dropdowns, and Click Outside to collapse sidebar dropdowns
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openGlobalSearch();
  } else if (e.key === 'Escape') {
    closeNavAccordions();
    const sb = document.getElementById('app-sidebar');
    const bd = document.getElementById('sidebar-backdrop');
    if (sb && sb.classList.contains('mobile-open')) {
      sb.classList.remove('mobile-open');
      if (bd) bd.classList.remove('active');
      document.body.classList.remove('mobile-drawer-open');
      const toggleBtn = document.getElementById('mobile-menu-toggle-btn');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    }
  }
});

document.addEventListener('click', (e) => {
  const target = e.target;
  const profileDropdown = document.getElementById('topbar-profile-dropdown');
  if (profileDropdown && profileDropdown.classList.contains('open')) {
    if (!target || typeof target.closest !== 'function' || !target.closest('.topbar-profile-wrap')) {
      profileDropdown.classList.remove('open');
      const trig = document.getElementById('topbar-profile-trigger');
      if (trig) trig.setAttribute('aria-expanded', 'false');
    }
  }
  if (!AppState.openNavGroup || AppState.sidebarSearchQuery) return;
  if (target && typeof target.closest === 'function' && (target.closest('.nav-accordion-group.open') || target.closest('.sidebar-search-wrap'))) {
    return;
  }
  closeNavAccordions();
});

/* =========================================================================
   VIEW RENDERERS
   ========================================================================= */

/* --- 1. Login View --- */
function renderLoginView() {
  const mode = AppState.loginRoleMode || 'ADMIN';
  const roleCode = ROLE_UID_CODES[mode] || '26';
  const prefilledUid = mode === 'ADMIN' ? MAIN_ADMIN_UID : 'MC26000';

  return `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at 18% 22%, rgba(16,185,129,0.16) 0%, transparent 45%), radial-gradient(circle at 82% 24%, rgba(124,58,237,0.18) 0%, transparent 45%), radial-gradient(circle at 22% 84%, rgba(249,115,22,0.14) 0%, transparent 45%), linear-gradient(160deg, #070e18 0%, #0b192c 55%, #091322 100%); padding:clamp(0.85rem, 3vw, 1.5rem);">
      <div style="max-width:460px; width:100%; background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-xl); overflow:hidden; box-shadow:0 25px 50px -12px rgba(0, 0, 0, 0.45);">
        <div style="height:5px; width:100%; background:var(--grad-4color);"></div>
        <div style="padding:clamp(1.25rem, 4vw, 2.35rem);">
          <div style="text-align:center; margin-bottom:1.5rem;">
            <div style="width:58px; height:58px; background:linear-gradient(135deg, #10b981 0%, #0d9488 45%, #7c3aed 100%); color:#fff; border-radius:var(--radius-lg); display:inline-flex; align-items:center; justify-content:center; font-size:1.45rem; font-weight:800; margin-bottom:1rem; box-shadow:0 8px 20px rgba(13, 148, 136, 0.35);">
              MUN
            </div>
            <h1 style="font-size:1.35rem; font-weight:800; color:var(--text-main);">MUN COMPUTER</h1>
            <p style="font-size:0.78rem; color:var(--text-muted); margin-top:0.25rem;">OFFICIAL CORPORATE ERP · ADMINISTRATION PORTAL</p>
          </div>

          <div style="display:grid; grid-template-columns:repeat(3,1fr); background:var(--surface-alt); padding:0.3rem; border-radius:var(--radius-md); gap:0.25rem; margin-bottom:1.25rem; border:1px solid var(--border-subtle);">
            <button type="button" class="btn ${mode === 'ADMIN' ? 'btn-violet' : 'btn-secondary'}" style="padding:0.55rem 0.35rem; font-size:0.72rem; font-weight:700;" onclick="window.MJK.setLoginRoleMode('ADMIN')">ADMINISTRATION</button>
            <button type="button" class="btn ${mode === 'MANAGER' ? 'btn-orange' : 'btn-secondary'}" style="padding:0.55rem 0.35rem; font-size:0.72rem; font-weight:700;" onclick="window.MJK.setLoginRoleMode('MANAGER')">MANAGER</button>
            <button type="button" class="btn ${mode === 'STAFF' ? 'btn-success' : 'btn-secondary'}" style="padding:0.55rem 0.35rem; font-size:0.72rem; font-weight:700;" onclick="window.MJK.setLoginRoleMode('STAFF')">STAFF</button>
          </div>

          <form id="login-form" onsubmit="window.MJK.handleLogin(event)">
            <div class="form-group">
              <label class="form-label">${escHtml(formatRoleLabel(mode))} User ID (UID) *</label>
              <input type="text" id="login-username" class="form-control font-mono" value="${escHtml(prefilledUid)}" required placeholder="${escHtml(`${UID_ORG_PREFIX}-${roleCode}-YYYY-DD-SLNO`)}" autocomplete="username">
            </div>

            <div class="form-group" style="margin-bottom:1.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                <label class="form-label" style="margin:0;">Account Password *</label>
                <button type="button" onclick="window.MJK.toggleLoginPwdVisibility()" style="background:none; border:none; color:var(--teal-600); font-size:0.75rem; cursor:pointer; font-weight:600;">
                  <span id="login-pwd-toggle-label">Show Password 👁️</span>
                </button>
              </div>
              <input type="password" id="login-password" class="form-control" required placeholder="Enter account password" autocomplete="current-password">
            </div>

            <button type="submit" id="btn-erp-login" class="btn btn-primary" style="width:100%; padding:0.8rem; font-size:0.95rem; font-weight:700;">
              Sign In (${escHtml(formatRoleLabel(mode))}) →
            </button>
          </form>
        </div>
      </div>
    </div>
  `;
}

/* --- 1B. Access Denied View --- */
function renderAccessDeniedView() {
  const user = getCurrentUser();
  const deniedRoute = AppState.deniedRoute || 'requested module';
  const roleName = user ? formatRoleLabel(user.role) : 'GUEST';
  const capabilities = user ? (ROLE_CAPABILITIES[user.role] || {}) : {};

  return `
    <div style="min-height:65vh; display:flex; align-items:center; justify-content:center; padding:2rem;">
      <div style="max-width:540px; width:100%; background:var(--surface); border:1px solid var(--danger-border); border-radius:var(--radius-xl); padding:2.5rem; text-align:center; box-shadow:var(--shadow-lg);">
        <div style="width:64px; height:64px; border-radius:50%; background:var(--danger-bg); color:var(--danger); display:inline-flex; align-items:center; justify-content:center; font-size:2rem; font-weight:bold; margin-bottom:1.25rem;">
          ⛔
        </div>
        <h2 style="font-size:1.4rem; font-weight:800; color:var(--text-main); margin-bottom:0.4rem;">Access Restricted</h2>
        <p style="font-size:0.88rem; color:var(--text-muted); line-height:1.55; margin-bottom:1.25rem;">
          Your current session role is <span class="user-role-badge" style="font-size:0.8rem; padding:0.2rem 0.5rem; vertical-align:middle;">${escHtml(roleName)}</span>. Access to <strong>${escHtml(deniedRoute.toUpperCase())}</strong> is restricted under role-based access control.
        </p>

        <div style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:1rem; text-align:left; font-size:0.8rem; margin-bottom:1.5rem;">
          <div style="font-weight:700; color:var(--text-main); margin-bottom:0.35rem;">What can ${escHtml(roleName)} access?</div>
          <p style="color:var(--text-muted); margin:0 0 0.5rem 0;">${escHtml(capabilities.description || 'Authorized modules for this role.')}</p>
          <div style="display:flex; flex-wrap:wrap; gap:0.35rem;">
            ${(capabilities.accessibleModules || []).map(m => `<span class="badge badge-info" style="font-size:0.7rem;">✓ ${escHtml(m)}</span>`).join('')}
          </div>
        </div>

        <div style="display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="window.MJK.navigateTo('dashboard')">
            ← Back to Dashboard
          </button>
          <button class="btn btn-primary" onclick="window.MJK.openSwitchRoleModal()">
            Switch Role / Account
          </button>
        </div>
      </div>
    </div>
  `;
}

/* --- 2. Main Dashboard View --- */
function renderDashboardView() {
  const activeUnitId = getActiveUnitId();
  const summary = generateFinancialSummary(activeUnitId, AppState.dateFilter, AppState.customDateStart, AppState.customDateEnd);
  
  const allCustomers = getAllCustomers();
  const allServices = getAllServices();
  const allFollowups = getAllFollowups();
  const allInvoices = getAllInvoices();
  const allTargets = getAllTargets();
  const allProjects = getAllProjects();

  const todayStr = getTodayDate();
  const todayCustomers = allCustomers.filter(c => c.regDate === todayStr);
  const flwDash = get90DayDashboardData();
  const overdueFollowups = allFollowups.filter(f => f.status === 'Overdue');
  const totalOverdueAlerts = overdueFollowups.length + flwDash.stats.overdueCount;
  const todayFollowups = allFollowups.filter(f => f.status === 'Today');
  const pendingServices = allServices.filter(s => s.status !== 'Completed' && s.status !== 'Delivered' && s.status !== 'Cancelled');
  const completedServices = allServices.filter(s => s.status === 'Completed' || s.status === 'Delivered');

  // Revenue Target
  const primaryTarget = allTargets.find(t => t.category.includes('Revenue')) || allTargets[0];
  const targetPct = primaryTarget ? primaryTarget.percentage : 0;

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">WELCOME TO MUN COMPUTER</h2>
        <p class="page-subtitle">Smart Business Management System</p>
      </div>

      <div class="page-actions">
        <!-- Date Filter Segmented Control -->
        <div class="segmented-control">
          <button class="segmented-btn ${AppState.dateFilter === 'today' ? 'active' : ''}" onclick="window.MJK.setDateFilter('today')">Today</button>
          <button class="segmented-btn ${AppState.dateFilter === 'yesterday' ? 'active' : ''}" onclick="window.MJK.setDateFilter('yesterday')">Yesterday</button>
          <button class="segmented-btn ${AppState.dateFilter === 'week' ? 'active' : ''}" onclick="window.MJK.setDateFilter('week')">This Week</button>
          <button class="segmented-btn ${AppState.dateFilter === 'month' ? 'active' : ''}" onclick="window.MJK.setDateFilter('month')">This Month</button>
          <button class="segmented-btn ${AppState.dateFilter === 'last_month' ? 'active' : ''}" onclick="window.MJK.setDateFilter('last_month')">Last Month</button>
          <button class="segmented-btn ${AppState.dateFilter === 'quarter' ? 'active' : ''}" onclick="window.MJK.setDateFilter('quarter')">Quarter</button>
          <button class="segmented-btn ${AppState.dateFilter === 'year' ? 'active' : ''}" onclick="window.MJK.setDateFilter('year')">Year</button>
        </div>

        <button class="btn btn-violet" onclick="window.MJK.openAllDataExportModal()" title="Download All Business Data in PDF, Excel, CSV">
          📥 Download All Data
        </button>
        ${canMenu('payments', 'add') ? `
          <button class="btn btn-success" onclick="window.MJK.openCashCollectionModal()" title="Quick Cash Collection against Customer Dues or Walk-in">
            💰 + Cash Collection
          </button>
        ` : ''}
        <button class="btn btn-primary" onclick="window.MJK.openNewEntryModal()">
          + Quick Action
        </button>
      </div>
    </div>

    <!-- Overdue Warning Alert Banner if any overdue follow-up or 90-day case -->
    ${totalOverdueAlerts > 0 ? `
      <div style="background:var(--danger-bg); border:1px solid var(--danger-border); border-radius:var(--radius-lg); padding:0.85rem 1.25rem; margin-bottom:1.5rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <span style="color:var(--danger); font-size:1.25rem; font-weight:bold;">⚠</span>
          <div>
            <div style="font-weight:700; color:var(--danger); font-size:0.9rem;">Attention: ${totalOverdueAlerts} Overdue 90-Day Case / Follow-up Alert(s) at MUN COMPUTER</div>
            <div style="font-size:0.78rem; color:var(--text-muted);">${flwDash.stats.overdueCount} 90-Day cycle case(s) &amp; ${overdueFollowups.length} reminder(s) awaiting action or status update.</div>
          </div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="window.MJK.navigateTo('followups')">
          Resolve Overdue Now →
        </button>
      </div>
    ` : ''}

    <!-- Primary Metric Stat Grid -->
    <div class="stat-grid">
      <!-- Total Collected Payments -->
      <div class="stat-card a4-avoid-break">
        <div class="stat-header">
          <span class="stat-label">Total Collected Payments</span>
          <div class="stat-icon" style="background:#dcfce7; color:#15803d;">₹</div>
        </div>
        <div class="stat-value tabular-nums" style="color:var(--success);">${formatINR(summary.collectedRevenue)}</div>
        <div class="amount-words-hint" style="color:var(--text-muted); margin-bottom:0.3rem;">${escHtml(numberToWords(summary.collectedRevenue))}</div>
        <div class="stat-footer">
          <span class="stat-badge positive">Verified Inflow</span>
          <span>Cash, UPI, QR, Bank</span>
        </div>
      </div>

      <!-- Total Customer Due -->
      <div class="stat-card a4-avoid-break">
        <div class="stat-header">
          <span class="stat-label">Total Customer Due</span>
          <div class="stat-icon" style="background:#fee2e2; color:#b91c1c;">!</div>
        </div>
        <div class="stat-value tabular-nums" style="color:var(--danger);">${formatINR(summary.totalDues)}</div>
        <div class="amount-words-hint" style="color:var(--text-muted); margin-bottom:0.3rem;">${escHtml(numberToWords(summary.totalDues))}</div>
        <div class="stat-footer">
          <span class="stat-badge negative">Pending Collection</span>
          <a href="#payments" style="color:var(--blue-600); text-decoration:underline;">View Due List</a>
        </div>
      </div>

      <!-- Total Expenses -->
      <div class="stat-card a4-avoid-break">
        <div class="stat-header">
          <span class="stat-label">Total Expenses</span>
          <div class="stat-icon" style="background:#fef3c7; color:#b45309;">📉</div>
        </div>
        <div class="stat-value tabular-nums">${formatINR(summary.totalExpenses)}</div>
        <div class="amount-words-hint" style="color:var(--text-muted); margin-bottom:0.3rem;">${escHtml(numberToWords(summary.totalExpenses))}</div>
        <div class="stat-footer">
          <span class="stat-badge warning">${summary.expensesCount} Entries</span>
          <span>Rent, Bills, Salaries</span>
        </div>
      </div>

      <!-- Net Income / Cash Flow -->
      <div class="stat-card a4-avoid-break">
        <div class="stat-header">
          <span class="stat-label">Net Income (Cash Flow)</span>
          <div class="stat-icon" style="background:#e0e7ff; color:#4338ca;">✦</div>
        </div>
        <div class="stat-value tabular-nums" style="color:${summary.netCashFlow >= 0 ? 'var(--blue-600)' : 'var(--danger)'};">
          ${formatINR(summary.netCashFlow)}
        </div>
        <div class="amount-words-hint" style="color:var(--text-muted); margin-bottom:0.3rem;">${escHtml(numberToWords(summary.netCashFlow))}</div>
        <div class="stat-footer">
          <span class="stat-badge ${summary.netCashFlow >= 0 ? 'positive' : 'negative'}">
            Est. Profit: ${formatINR(summary.estimatedNetProfit)}
          </span>
        </div>
      </div>

      <!-- Total & Today's Customers -->
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Total Customers</span>
          <div class="stat-icon" style="background:var(--green-50); color:var(--green-600);">👥</div>
        </div>
        <div class="stat-value tabular-nums">${allCustomers.length}</div>
        <div class="stat-footer">
          <span class="stat-badge positive">${todayCustomers.length} Today</span>
          <span>Registered in system</span>
        </div>
      </div>

      <!-- Services Completed & Pending -->
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Services Delivered</span>
          <div class="stat-icon" style="background:var(--orange-50); color:var(--orange-600);">📑</div>
        </div>
        <div class="stat-value tabular-nums">${completedServices.length} <span style="font-size:0.9rem; font-weight:500; color:var(--text-muted);">/ ${allServices.length}</span></div>
        <div class="stat-footer">
          <span class="stat-badge warning">${pendingServices.length} Pending</span>
          <span>In Processing / Verification</span>
        </div>
      </div>

      <!-- Today's Follow-ups -->
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Today's Follow-ups</span>
          <div class="stat-icon" style="background:var(--violet-50); color:var(--violet-600);">📞</div>
        </div>
        <div class="stat-value tabular-nums">${todayFollowups.length}</div>
        <div class="stat-footer">
          <span style="color:var(--danger); font-weight:600;">${overdueFollowups.length} Overdue</span>
        </div>
      </div>

      <!-- Monthly Target Achievement -->
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Revenue Target</span>
          <div class="stat-icon" style="background:var(--teal-50); color:var(--teal-600);">🎯</div>
        </div>
        <div class="stat-value tabular-nums">${targetPct}%</div>
        <div class="stat-footer">
          <div style="width:100%; background:var(--surface-alt); height:6px; border-radius:999px; overflow:hidden;">
            <div style="width:${targetPct}%; background:var(--grad-4color); height:100%;"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Advanced 90 Days Follow-up & Case Tracking Command Strip (6 Live Clickable Cards + Quick Case Lookup) -->
    <div class="card card-3d" style="padding:1.15rem 1.25rem; margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; margin-bottom:0.9rem;">
        <div>
          <h3 style="font-size:1rem; font-weight:800; margin:0;">📞 90 Days Follow-up &amp; Application Lifecycle Tracker</h3>
          <div style="font-size:0.76rem; color:var(--text-muted);">Live Day 0 → Day 90 tracking · Click any status bucket to open filtered queue</div>
        </div>
        <div style="display:flex; gap:0.45rem; flex-wrap:wrap; align-items:center;">
          <input type="text" id="dash-quick-case-search" class="form-control" style="width:240px; height:36px; font-size:0.8rem;"
            placeholder="Search Customer / App ID / Mobile..."
            value="${escHtml(AppState.followupSearchQuery || '')}"
            onkeydown="if(event.key==='Enter'){event.preventDefault();window.MJK.quickJumpToCaseSearch(this.value);}">
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.quickJumpToCaseSearch(document.getElementById('dash-quick-case-search')?.value || '')">🔍 Search Cases</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('customer-registration')">+ Register Application</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 165px), 1fr)); gap:0.75rem;">
        ${[
          { route: 'followups-today', label: "Today's Follow-ups", val: flwDash.stats.todayCount, tone: 'info', icon: '📅', sub: 'Scheduled Today' },
          { route: 'followups-upcoming', label: 'Upcoming Follow-ups', val: flwDash.stats.upcomingCount, tone: 'violet', icon: '⏳', sub: 'Scheduled Ahead' },
          { route: 'followups-overdue', label: 'Overdue Follow-ups', val: flwDash.stats.overdueCount, tone: 'danger', icon: '🚨', sub: 'Needs Immediate Call' },
          { route: 'followups-pending', label: 'Pending Applications', val: flwDash.stats.pendingCount, tone: 'orange', icon: '🔄', sub: 'Active Open Cases' },
          { route: 'followups-completed', label: 'Completed Follow-ups', val: flwDash.stats.completedCount, tone: 'success', icon: '✅', sub: 'Closed / Resolved' },
          { route: 'followups-review90', label: '90 Days Review', val: flwDash.stats.review90Count || 0, tone: 'teal', icon: '🏁', sub: 'Day 75–90 Assessment' }
        ].map(card => `
          <button type="button" class="kpi-tile-3d kpi-tone-${card.tone}" onclick="window.MJK.navigateTo('${card.route}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="kpi-tile-label">${card.icon} ${card.label}</span>
            </div>
            <div class="kpi-tile-val tabular-nums">${card.val}</div>
            <div class="kpi-tile-sub">${card.sub}</div>
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Charts Section -->
    <div class="charts-grid">
      <!-- Daily & Monthly Revenue vs Expenses Chart -->
      <div class="chart-card">
        <div class="chart-header">
          <h3 class="chart-title">Revenue & Expense Performance (MUN COMPUTER)</h3>
          <div class="chart-legend">
            <div class="legend-item"><div class="legend-color" style="background:#10b981;"></div> Collections</div>
            <div class="legend-item"><div class="legend-color" style="background:#f97316;"></div> Expenses</div>
          </div>
        </div>
        <div class="svg-chart-viewport" style="display:flex; align-items:center; justify-content:center;">
          ${renderRevenueSvgChart()}
        </div>
      </div>

      <!-- Service Category Distribution Chart -->
      <div class="chart-card">
        <div class="chart-header">
          <h3 class="chart-title">Top Service Categories at MUN COMPUTER</h3>
        </div>
        <div style="flex:1; display:flex; flex-direction:column; justify-content:space-around;">
          ${renderCategoryBars(allServices)}
        </div>
      </div>
    </div>

    <!-- Activity & Quick Task Feeds -->
    <div class="dashboard-lists-grid">
      <!-- Urgent & Today Follow-ups -->
      <div class="list-card">
        <div class="list-header">
          <h3 class="list-title">Today's Customer Action Queue</h3>
          <a href="#followups" class="list-view-all">All Follow-ups (${allFollowups.length}) →</a>
        </div>
        <div>
          ${todayFollowups.concat(overdueFollowups).slice(0, 5).map(f => `
            <div class="activity-item">
              <div class="activity-left">
                <div class="activity-icon-badge" style="background:${f.status === 'Overdue' ? 'var(--danger-bg)' : 'var(--warning-bg)'}; color:${f.status === 'Overdue' ? 'var(--danger)' : 'var(--warning)'};">
                  ${f.status === 'Overdue' ? '!' : '⏰'}
                </div>
                <div>
                  <div class="activity-main-text">${f.customerName} <span class="date tabular-nums" style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${f.phone})</span></div>
                  <div class="activity-sub-text">${f.reason}: ${f.notes || 'No extra notes'}</div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <a href="tel:${f.phone}" class="btn btn-secondary btn-sm" title="Call Customer">📞</a>
                <button class="btn btn-success btn-sm" onclick="window.MJK.quickCompleteFollowup('${f.id}')" title="Mark Done">✓</button>
              </div>
            </div>
          `).join('') || `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">No pending follow-ups for today! Great job.</div>`}
        </div>
      </div>

      <!-- Recent Payments & Inflow Activity -->
      <div class="list-card">
        <div class="list-header">
          <h3 class="list-title">Recent Transactions at Counter</h3>
          <a href="#payments" class="list-view-all">View All Ledger →</a>
        </div>
        <div>
          ${getAllPayments().slice(0, 5).map(p => `
            <div class="activity-item">
              <div class="activity-left">
                <div class="activity-icon-badge" style="background:var(--success-bg); color:var(--success);">₹</div>
                <div>
                  <div class="activity-main-text">${p.customerName}</div>
                  <div class="activity-sub-text">${p.paymentMethod} · ${p.remarks || 'Service payment'} · ${formatDate(p.paymentDate)}</div>
                </div>
              </div>
              <div style="text-align:right;">
                <div class="amount tabular-nums" style="font-weight:700; color:var(--success); font-size:0.92rem;">+${formatINR(p.paymentAmount)}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${p.id}</div>
              </div>
            </div>
          `).join('') || `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">No payment transactions recorded yet.</div>`}
        </div>
      </div>
    </div>
  `;
}

function renderRevenueSvgChart() {
  const payments = getAllPayments();
  const expenses = getAllExpenses();

  if (payments.length === 0 && expenses.length === 0) {
    return `
      <div style="height:180px; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.85rem; text-align:center; padding:1.5rem;">
        <span style="font-size:2rem; opacity:0.75; margin-bottom:0.4rem;">📊</span>
        <div style="font-weight:700; color:var(--text-main); margin-bottom:0.25rem;">Clean Financial Slate</div>
        <div style="font-size:0.78rem; max-width:340px;">Real-time collections and expenses will plot automatically as you record physical counter entries.</div>
      </div>
    `;
  }

  // Group real payments & expenses across the latest 6 months
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'short' });
    buckets.push({ key, label, rev: 0, exp: 0 });
  }
  const bucketMap = new Map(buckets.map(b => [b.key, b]));

  payments.forEach(p => {
    const mKey = String(p.paymentDate || '').slice(0, 7);
    const b = bucketMap.get(mKey);
    if (b) b.rev += Number(p.paymentAmount) || 0;
  });

  expenses.forEach(e => {
    const mKey = String(e.date || '').slice(0, 7);
    const b = bucketMap.get(mKey);
    if (b) b.exp += Number(e.amount) || 0;
  });

  const maxVal = Math.max(100, ...buckets.map(b => Math.max(b.rev, b.exp)));
  const xCenters = [75, 150, 225, 300, 375, 450];
  const baselineY = 158;
  const maxBarH = 128;

  const barsSvg = buckets.map((b, idx) => {
    const cx = xCenters[idx];
    const revH = Math.round((b.rev / maxVal) * maxBarH);
    const expH = Math.round((b.exp / maxVal) * maxBarH);
    const revY = baselineY - revH;
    const expY = baselineY - expH;
    return `
      <rect x="${cx - 18}" y="${revY}" width="16" height="${Math.max(revH, b.rev > 0 ? 4 : 0)}" rx="3" fill="#10b981">
        <title>${b.label} Collections: ${formatINR(b.rev)}</title>
      </rect>
      <rect x="${cx + 2}" y="${expY}" width="16" height="${Math.max(expH, b.exp > 0 ? 4 : 0)}" rx="3" fill="#f97316">
        <title>${b.label} Expenses: ${formatINR(b.exp)}</title>
      </rect>
      <text x="${cx}" y="174" fill="var(--text-muted)" font-size="10" text-anchor="middle">${escHtml(b.label)}</text>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 500 180" style="width:100%; height:100%; overflow:visible;">
      <line x1="36" y1="30" x2="484" y2="30" stroke="var(--border-subtle)" stroke-dasharray="3,3" />
      <line x1="36" y1="73" x2="484" y2="73" stroke="var(--border-subtle)" stroke-dasharray="3,3" />
      <line x1="36" y1="116" x2="484" y2="116" stroke="var(--border-subtle)" stroke-dasharray="3,3" />
      <line x1="36" y1="${baselineY}" x2="484" y2="${baselineY}" stroke="var(--border-strong)" />
      ${barsSvg}
    </svg>
  `;
}

function renderCategoryBars(services) {
  if (!services || services.length === 0) {
    return `
      <div style="text-align:center; padding:2rem 1rem; color:var(--text-muted); font-size:0.85rem;">
        <span style="font-size:1.8rem; display:block; margin-bottom:0.4rem; opacity:0.7;">📑</span>
        <div style="font-weight:700; color:var(--text-main); margin-bottom:0.25rem;">No Service Requests Yet</div>
        <div style="font-size:0.75rem;">Categories will show distribution as you register customer services.</div>
      </div>
    `;
  }

  const counts = {};
  services.forEach(s => {
    const c = s.category || 'Other';
    counts[c] = (counts[c] || 0) + 1;
  });

  const barColors = [
    'linear-gradient(90deg, #0d9488, #0ea5e9)',
    'linear-gradient(90deg, #059669, #10b981)',
    'linear-gradient(90deg, #7c3aed, #6366f1)',
    'linear-gradient(90deg, #ea580c, #f59e0b)',
    'linear-gradient(90deg, #0284c7, #7c3aed)'
  ];

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = Math.max(...sorted.map(s => s[1]), 1);

  return sorted.map(([cat, count], idx) => {
    const pct = Math.round((count / max) * 100);
    return `
      <div style="margin-bottom:0.75rem;">
        <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
          <span style="font-weight:600;">${escHtml(cat)}</span>
          <span class="tabular-nums" style="color:var(--text-muted);">${count} requests</span>
        </div>
        <div style="width:100%; background:var(--surface-alt); height:8px; border-radius:999px; overflow:hidden;">
          <div style="width:${pct}%; background:${barColors[idx % barColors.length]}; height:100%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

/* --- 3. Customers View (Universal Search & Master Directory) --- */
function renderCustomersView() {
  const curUser = getCurrentUser();
  let customers = getAllCustomers();
  const scope = canExtra('customerAccessScope', curUser);
  const custLimit = Number(canExtra('customerAccessLimit', curUser) || 0);
  const isScopedToAssigned = scope === 'ASSIGNED' && !isSuperAdmin(curUser) && curUser?.role !== 'ADMIN';
  if (isScopedToAssigned) {
    customers = customers.filter(c => !c.assignedStaffUid || c.assignedStaffUid === curUser?.uid || c.createdByUid === curUser?.uid);
  }
  if (custLimit > 0 && !isSuperAdmin(curUser) && curUser?.role !== 'ADMIN') {
    customers = customers.slice(0, custLimit);
  }

  const canAddCust = canMenu('customers', 'add', curUser);
  const canEditCust = canMenu('customers', 'edit', curUser);
  const canDelCust = canMenu('customers', 'delete', curUser);
  const canExportCust = canMenu('customers', 'export', curUser);
  const canPrintCust = canMenu('customers', 'print', curUser);

  const allServices = getAllServices();
  const rawQuery = (AppState.searchQuery || '').trim();
  const filtered = searchCustomers(rawQuery, customers);

  // Default Location Keywords for Quick Access (Mamudpur, Juginda, Domkal, Murshidabad, West Bengal, 742406)
  const defaultLocationKeywords = [
    { label: 'Mamudpur', type: 'Village' },
    { label: 'Juginda', type: 'Post Office' },
    { label: 'Domkal', type: 'Police Station' },
    { label: 'Murshidabad', type: 'District' },
    { label: 'West Bengal', type: 'State' },
    { label: '742406', type: 'PIN Code' }
  ];

  return `
    <div class="page-header" style="margin-bottom:1rem;">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem;">
          <span>👤 Customer Directory & Search System</span>
          <span class="badge badge-info" style="font-size:0.75rem;">MUN COMPUTER</span>
          ${isScopedToAssigned ? `<span class="badge badge-warning" style="font-size:0.7rem;">Assigned Scope${custLimit > 0 ? ` (Max ${custLimit})` : ''}</span>` : ''}
        </h2>
        <p class="page-subtitle">
          Universal multi-field citizen & client search by Name, Village, Post Office, Police Station, District, PIN, Mobile (+91), ID, Aadhaar, Job Card & Service IDs.
        </p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        ${canExportCust ? `
          <button class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('customer', 'pdf')" title="Download Customer Report PDF">
            📄 PDF
          </button>
          <button class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('customer', 'excel')" title="Download Customer Report Excel">
            📊 Excel
          </button>
          <button class="btn btn-outline btn-sm" onclick="window.MJK.exportCustomersCSV()" title="Export customer records to CSV">
            📥 CSV
          </button>
        ` : ''}
        ${canPrintCust ? `
          <button class="btn btn-outline btn-sm" onclick="window.MJK.exportAnnapurnaReportAction('customer', 'print')" title="Print Customer Directory Report">
            🖨 Print
          </button>
        ` : ''}
        ${can('canManageUsers') ? `
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openCustomerMergeModal()" title="Merge duplicate customer records">
            🔗 Merge Duplicates
          </button>
        ` : ''}
        ${canAddCust ? `
          <button class="btn btn-primary btn-sm" onclick="window.MJK.openCustomerModal()">
            + Register New Customer
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Universal Search Box Card -->
    <div class="card" style="margin-bottom:1.25rem; padding:1.1rem; border:1px solid var(--border-subtle); background:var(--surface); box-shadow:var(--shadow-sm);">
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <!-- Top Search Row -->
        <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
          <div style="position:relative; flex:1; min-width:min(100%, 240px);">
            <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:1.1rem; color:var(--text-muted); pointer-events:none;">🔍</span>
            <input 
              type="text" 
              id="universal-customer-search-input"
              class="form-control" 
              placeholder="Search by Name, Village, Post Office, Police Station, District, PIN (742406), Mobile (+91), ID, Aadhaar (last 4), Job Card, Service ID..." 
              value="${rawQuery}" 
              oninput="window.MJK.setCustomerSearch(this.value)"
              style="padding-left:2.5rem; height:42px; font-size:0.88rem; border-radius:var(--radius-md); border:1.5px solid ${rawQuery ? 'var(--blue-600)' : 'var(--border-subtle)'}; background:var(--surface);"
              autocomplete="off"
            >
          </div>
          ${rawQuery ? `
            <button class="btn btn-secondary" onclick="window.MJK.setCustomerSearch('')" style="height:42px; padding:0 1rem; font-weight:700;" title="Clear Search Filter">
              ✕ Clear Search
            </button>
          ` : ''}
          ${canAddCust ? `
            <button class="btn btn-primary" onclick="window.MJK.openCustomerModal()" style="height:42px; white-space:nowrap;">
              + Add Customer
            </button>
          ` : ''}
        </div>

        <!-- Default Location Quick Search Keywords (Mamudpur, Juginda, Domkal, Murshidabad, West Bengal, 742406) -->
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; border-top:1px solid var(--border-subtle); padding-top:0.65rem;">
          <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">
              📍 QUICK LOCATION KEYWORDS:
            </span>
            ${defaultLocationKeywords.map(loc => {
              const isActive = rawQuery.toLowerCase() === loc.label.toLowerCase();
              return `
                <button 
                  type="button"
                  class="btn btn-sm" 
                  onclick="window.MJK.setCustomerSearch('${loc.label}')"
                  style="font-size:0.75rem; padding:0.2rem 0.55rem; border-radius:999px; background:${isActive ? 'var(--blue-600)' : 'var(--surface-alt)'}; color:${isActive ? '#ffffff' : 'var(--text-main)'}; border:1px solid ${isActive ? 'var(--blue-600)' : 'var(--border-subtle)'}; font-weight:${isActive ? '700' : '600'};"
                  title="Filter by ${loc.type}: ${loc.label}"
                >
                  🏷️ ${loc.label} <span style="opacity:0.75; font-size:0.68rem;">(${loc.type})</span>
                </button>
              `;
            }).join('')}
          </div>

          <div style="font-size:0.78rem; color:var(--text-muted);">
            ${rawQuery ? `
              Showing <strong>${filtered.length}</strong> matching record${filtered.length === 1 ? '' : 's'} for "<span style="color:var(--blue-600); font-weight:700;">${rawQuery}</span>"
            ` : `
              Master Database: <strong>${customers.length}</strong> registered customer${customers.length === 1 ? '' : 's'}
            `}
          </div>
        </div>
      </div>
    </div>

    <!-- Customer Results Table / Empty States -->
    <div class="table-card" style="box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); overflow:hidden;">
      <div class="table-responsive">
        <table class="data-table" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:var(--surface-alt); text-align:left; border-bottom:1px solid var(--border-subtle); font-size:0.8rem;">
              <th style="padding:0.7rem 0.85rem; width:45px; text-align:center;">#</th>
              <th style="padding:0.7rem 0.85rem;">Customer Name</th>
              <th style="padding:0.7rem 0.85rem;">Customer ID</th>
              <th style="padding:0.7rem 0.85rem;">Mobile Number</th>
              <th style="padding:0.7rem 0.85rem;">Village</th>
              <th style="padding:0.7rem 0.85rem;">Post Office</th>
              <th style="padding:0.7rem 0.85rem;">District</th>
              <th style="padding:0.7rem 0.85rem;">Service Details</th>
              <th style="padding:0.7rem 0.85rem;">Registration Date</th>
              <th style="padding:0.7rem 0.85rem; text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${customers.length === 0 ? `
              <!-- Empty Database State -->
              <tr>
                <td colspan="10" style="padding:3rem 1.5rem; text-align:center;">
                  <div style="max-width:440px; margin:0 auto; display:flex; flex-direction:column; align-items:center; gap:0.75rem;">
                    <div style="width:58px; height:58px; border-radius:50%; background:var(--blue-50); color:var(--blue-600); display:flex; align-items:center; justify-content:center; font-size:1.6rem;">
                      👥
                    </div>
                    <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-main); margin:0;">
                      Customer Directory is Empty
                    </h3>
                    <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.5; margin:0;">
                      No real customer records exist yet in the database. All demo data has been cleaned. Click below to register your first customer at MUN COMPUTER with default location set to Mamudpur, Juginda, Domkal.
                    </p>
                    <button class="btn btn-primary" onclick="window.MJK.openCustomerModal()" style="margin-top:0.5rem;">
                      + Add New Customer
                    </button>
                  </div>
                </td>
              </tr>
            ` : filtered.length === 0 ? `
              <!-- No Search Results Found State -->
              <tr>
                <td colspan="10" style="padding:3rem 1.5rem; text-align:center;">
                  <div style="max-width:480px; margin:0 auto; display:flex; flex-direction:column; align-items:center; gap:0.75rem;">
                    <div style="width:56px; height:56px; border-radius:50%; background:#fef2f2; color:#ef4444; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">
                      🔍
                    </div>
                    <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-main); margin:0;">
                      No Results Found for "${rawQuery}"
                    </h3>
                    <p style="font-size:0.84rem; color:var(--text-muted); line-height:1.5; margin:0;">
                      We couldn't find any customer matching <strong>"${rawQuery}"</strong> in names, location (Mamudpur/Juginda/Domkal/Murshidabad/742406), mobile numbers, IDs, Aadhaar, Job Card or Service IDs.
                    </p>
                    <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                      <button class="btn btn-secondary" onclick="window.MJK.setCustomerSearch('')">
                        ✕ Clear Search
                      </button>
                      <button class="btn btn-primary" onclick="window.MJK.openCustomerModal()">
                        + Register New Customer
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ` : filtered.map((c, index) => {
              // Linked services & visit history
              const custServices = allServices.filter(s => s.customerId === c.id);
              const visitStats = getCustomerVisitAnalytics(c.id);
              const profileServices = Array.isArray(c.services) ? c.services : [];
              const latestService = custServices.length > 0 ? custServices[0] : null;
              const serviceDetailsText = `
                ${profileServices.length > 0
                  ? `<div style="font-weight:700; color:var(--blue-700); font-size:0.76rem;">${profileServices.length} Selected Service(s)</div>
                     <div style="font-size:0.71rem; color:var(--text-muted); max-width:210px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${profileServices.join(', ')}</div>`
                  : (custServices.length > 0
                    ? `<span style="font-weight:700; color:var(--blue-700);">${custServices.length} Service(s)</span>: <span style="color:var(--text-muted); font-size:0.75rem;">${latestService.serviceName || latestService.category}</span>`
                    : `<span style="color:var(--text-muted); font-size:0.75rem;">No services selected</span>`)
                }
                <div style="font-size:0.7rem; color:#047857; margin-top:2px;">
                  Visits: <strong>${visitStats.totalVisitCount}</strong>${visitStats.lastVisitDate ? ` · Last: ${formatDate(visitStats.lastVisitDate)}` : ''}
                </div>
              `;

              // Normalized phone display
              const cleanPhone = (c.phone || '').replace(/[^0-9]/g, '');
              const formattedPhone = cleanPhone.length === 10 ? `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}` : (c.phone || '-');

              return `
                <tr style="border-bottom:1px solid var(--border-subtle); transition:background 0.15s ease;">
                  <!-- 1. Serial Number -->
                  <td style="padding:0.7rem 0.85rem; text-align:center; font-family:monospace; font-size:0.78rem; color:var(--text-muted); font-weight:700;">
                    ${index + 1}
                  </td>

                  <!-- 2. Customer Name -->
                  <td style="padding:0.7rem 0.85rem;">
                    <div style="font-weight:700; color:var(--text-main); font-size:0.88rem;">${c.name}</div>
                    ${c.fatherName ? `<div style="font-size:0.72rem; color:var(--text-muted);">S/D/W of: ${c.fatherName}</div>` : ''}
                    ${c.aadhaarLast4 ? `<div style="font-size:0.68rem; color:#059669; font-weight:600;">Aadhaar: **** **** ${c.aadhaarLast4}</div>` : ''}
                  </td>

                  <!-- 3. Customer ID -->
                  <td style="padding:0.7rem 0.85rem; font-family:monospace; font-weight:700; font-size:0.8rem; color:var(--blue-700);">
                    <a href="javascript:void(0)" onclick="window.MJK.viewCustomerProfile('${c.id}')" style="text-decoration:none; color:inherit;" title="View Full Customer Profile">
                      ${c.id}
                    </a>
                  </td>

                  <!-- 4. Mobile Number -->
                  <td style="padding:0.7rem 0.85rem; font-size:0.82rem; white-space:nowrap;">
                    <div style="display:flex; align-items:center; gap:0.35rem;">
                      <a href="tel:${cleanPhone}" style="color:var(--text-main); font-weight:600; text-decoration:none;">
                        📞 ${formattedPhone}
                      </a>
                    </div>
                    ${c.altPhone ? `<div style="font-size:0.7rem; color:var(--text-muted);">Alt: ${c.altPhone}</div>` : ''}
                  </td>

                  <!-- 5. Village -->
                  <td style="padding:0.7rem 0.85rem; font-size:0.82rem; font-weight:600; color:var(--text-main);">
                    ${c.village || '-'}
                  </td>

                  <!-- 6. Post Office -->
                  <td style="padding:0.7rem 0.85rem; font-size:0.82rem; color:var(--text-main);">
                    ${c.postOffice || '-'}
                  </td>

                  <!-- 7. District -->
                  <td style="padding:0.7rem 0.85rem; font-size:0.82rem;">
                    <div>${c.district || '-'}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted);">${c.state ? `${c.state} · ` : ''}${c.pinCode || '-'}</div>
                  </td>

                  <!-- 8. Service Details -->
                  <td style="padding:0.7rem 0.85rem; font-size:0.8rem;">
                    ${serviceDetailsText}
                  </td>

                  <!-- 9. Registration Date -->
                  <td style="padding:0.7rem 0.85rem; font-size:0.78rem; font-family:monospace; color:var(--text-muted); white-space:nowrap;">
                    ${formatDate(c.regDate)}
                  </td>

                  <!-- 10. View Details & Actions -->
                  <td style="padding:0.7rem 0.85rem; text-align:right; white-space:nowrap;">
                    <div style="display:inline-flex; gap:0.25rem;">
                      ${canMenu('whatsapp-connect', 'view', curUser) ? renderWhatsAppQuickButton({
                        phone: c.phone,
                        customerName: c.name,
                        serviceName: (Array.isArray(c.services) && c.services.length > 0) ? c.services[0] : (latestService?.serviceName || ''),
                        context: 'CUSTOMER'
                      }, true) : ''}
                      <button class="btn btn-primary btn-sm" onclick="window.MJK.viewCustomerProfile('${c.id}')" title="View Full Profile, Visits & Cases">
                        👁 View
                      </button>
                      ${canAddCust || canEditCust ? `
                        <button class="btn btn-success btn-sm" onclick="window.MJK.openCustomerVisitModal('${c.id}')" title="Add New Visit">
                          + Visit
                        </button>
                      ` : ''}
                      ${canEditCust ? `
                        <button class="btn btn-secondary btn-sm" onclick="window.MJK.editCustomer('${c.id}')" title="Edit Customer Details">
                          ✎
                        </button>
                      ` : ''}
                      ${canDelCust ? `
                        <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.promptDeleteCustomer('${c.id}')" title="Delete Customer">
                          🗑
                        </button>
                      ` : ''}
                    </div>
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

/* --- 4. Services View --- */
function renderServicesView() {
  const curUser = getCurrentUser();
  const canAddSrv = canMenu('services', 'add', curUser);
  const canEditSrv = canMenu('services', 'edit', curUser);
  const canDelSrv = canMenu('services', 'delete', curUser);
  const canExportSrv = canMenu('services', 'export', curUser);
  const canPrintSrv = canMenu('services', 'print', curUser);

  const services = getAllServices();
  const activeRateItems = getAllRateChartItems().filter(x => x.isActive !== false);
  const categories = getServiceCategories();
  const totalCatalogServices = activeRateItems.length;
  const customServices = getCustomSubServices();
  const filterCat = AppState.serviceCategoryFilter || 'all';
  const filterStatus = AppState.serviceStatusFilter || 'all';
  const query = (AppState.serviceSearchQuery || '').toLowerCase();

  const receiptCounts = new Map();
  const receiptSummariesMap = new Map();
  services.forEach(sv => {
    if (sv.receiptId) {
      receiptCounts.set(sv.receiptId, (receiptCounts.get(sv.receiptId) || 0) + 1);
      const cur = receiptSummariesMap.get(sv.receiptId) || { total: 0, paid: 0 };
      cur.total += Math.max(0, Number(sv.totalAmount) || 0);
      cur.paid += Math.max(0, Number(sv.paidAmount) || 0);
      receiptSummariesMap.set(sv.receiptId, cur);
    }
  });

  const filtered = services.filter(s => {
    if (filterCat !== 'all' && s.category !== filterCat) return false;
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (query) {
      return (
        s.serviceName.toLowerCase().includes(query) ||
        s.refNumber.toLowerCase().includes(query) ||
        (s.receiptId || '').toLowerCase().includes(query) ||
        s.customerName.toLowerCase().includes(query) ||
        s.phone.includes(query)
      );
    }
    return true;
  });

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Service Management (MUN COMPUTER)</h2>
        <p class="page-subtitle">Track all ${categories.length} categories (${totalCatalogServices} active Rate Chart services${customServices.length > 0 ? ` · ${customServices.length} custom` : ''}): Form Fill-up, Job Applications, Exam, Education, PVC & Business Services</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openCategoryCatalogModal()">📋 Official Directory (${categories.length} · ${totalCatalogServices})</button>
        ${(canEditSrv && (['ADMIN', 'MANAGER'].includes(String(curUser?.role || '').toUpperCase()) || isSuperAdmin(curUser))) ? `
          <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.renderAdminServiceCatalogModal()">🛠️ Service Catalog Manager</button>
        ` : ''}
        ${canAddSrv ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openCustomServiceModal()">✨ + Add Custom Service</button>` : ''}
        ${canEditSrv ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openManageDynamicOptionsModal('service_category')">🏷️ Manage Categories</button>` : ''}
        ${canEditSrv ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openManageDynamicOptionsModal('service_status')">⚙️ Manage Statuses</button>` : ''}
        ${canExportSrv ? `
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportServicesPDF()" title="Download Services PDF">📄 PDF</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportServicesExcel()" title="Download Services Excel (.xlsx)">📊 Excel</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportServicesCSV()" title="Download Services CSV">📥 CSV</button>
        ` : ''}
        ${canPrintSrv ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printServicesReport()" title="Print Services Register">🖨 Print</button>` : ''}
        ${canAddSrv ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openServiceModal()">+ New Service Entry</button>` : ''}
      </div>
    </div>

    <div class="table-card">
      <div class="table-toolbar">
        <div class="table-toolbar-left" style="gap:0.5rem; flex-wrap:wrap;">
          <input type="text" id="service-directory-search-input" class="form-control toolbar-search" placeholder="Search service, ref #, receipt #, client..." value="${AppState.serviceSearchQuery || ''}" oninput="window.MJK.setServiceSearch(this.value)">
          ${AppState.serviceSearchQuery ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.setServiceSearch('')">✕ Clear</button>` : ''}
          
          <select class="form-control toolbar-select" onchange="window.MJK.setServiceCatFilter(this.value)">
            <option value="all">All ${categories.length} Categories</option>
            ${categories.map(c => `<option value="${c}" ${filterCat === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          ${canEditSrv ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openManageDynamicOptionsModal('service_category')" title="Add or delete custom categories">+</button>` : ''}

          <select class="form-control toolbar-select" onchange="window.MJK.setServiceStatusFilter(this.value)">
            <option value="all">All Statuses</option>
            ${getServiceStatuses({ includeValues: services.map(s => s.status) }).map(st => `<option value="${escHtml(st)}" ${filterStatus === st ? 'selected' : ''}>${escHtml(st)}</option>`).join('')}
          </select>
          ${canEditSrv ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openManageDynamicOptionsModal('service_status')" title="Add or delete custom service statuses">+</button>` : ''}
        </div>
        <div class="table-toolbar-right" style="gap:0.5rem; flex-wrap:wrap;">
          ${customServices.length > 0 ? `<span class="badge badge-info">Custom Services: ${customServices.length}</span>` : ''}
          ${canDelSrv ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.promptBulkDeleteServices()">🗑 Delete Selected</button>` : ''}
          <span style="font-size:0.8rem; color:var(--text-muted);">Count: <strong>${filtered.length}</strong></span>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:36px;"><input type="checkbox" id="srv-select-all" title="Select all visible services" onchange="document.querySelectorAll('.srv-select-row').forEach(cb => cb.checked = this.checked)"></th>
              <th>Ref / Receipt / Service ID</th>
              <th>Service Details</th>
              <th>Customer</th>
              <th>Financials</th>
              <th>Status</th>
              <th>Dates</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(s => {
              const statusClass = s.status === 'Completed' || s.status === 'Approved' ? 'badge-success' : s.status === 'Rejected' || s.status === 'Cancelled' ? 'badge-danger' : s.status.includes('Pending') ? 'badge-warning' : 'badge-info';
              const grpCount = s.receiptId ? (receiptCounts.get(s.receiptId) || 1) : 1;
              const grpSummary = s.receiptId ? receiptSummariesMap.get(s.receiptId) : null;
              const grpDue = grpSummary ? Math.max(0, grpSummary.total - grpSummary.paid) : 0;
              return `
                <tr>
                  <td><input type="checkbox" class="srv-select-row" value="${escHtml(s.id)}"></td>
                  <td>
                    <div class="code tabular-nums" style="font-weight:700; color:var(--blue-600);">${s.refNumber}</div>
                    ${s.receiptId ? `<div class="tabular-nums font-mono" style="font-size:0.7rem; color:var(--text-main); font-weight:600;">Receipt: ${escHtml(s.receiptId)}${grpCount > 1 ? ` · ${s.receiptItemIndex || 1}/${grpCount}` : ''}</div>` : ''}
                    <div style="font-size:0.68rem; color:var(--text-muted);">${s.id}</div>
                  </td>
                  <td>
                    <div style="font-weight:600;">${s.serviceName}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted); display:flex; align-items:center; gap:0.35rem; margin-top:0.15rem; flex-wrap:wrap;">
                      <span class="badge badge-neutral" style="font-size:0.68rem; padding:0.1rem 0.35rem;">${s.category}</span>
                      ${s.subcategory ? `<span>· ${s.subcategory}</span>` : ''}
                    </div>
                  </td>
                  <td>
                    <div style="font-weight:600;">${s.customerName}</div>
                    <div class="tabular-nums" style="font-size:0.72rem; color:var(--text-muted);">📞 ${s.phone}</div>
                  </td>
                  <td>
                    <div class="tabular-nums" style="font-weight:600;">Total: ${formatINR(s.totalAmount)}</div>
                    <div class="tabular-nums" style="font-size:0.72rem; color:${s.dueAmount > 0 ? 'var(--danger)' : 'var(--success)'};">
                      Paid: ${formatINR(s.paidAmount)} ${s.dueAmount > 0 ? `(Due: ${formatINR(s.dueAmount)})` : '✓ Fully Paid'}
                    </div>
                    ${grpCount > 1 && grpSummary ? `
                      <div class="tabular-nums" style="font-size:0.69rem; color:var(--text-muted); margin-top:0.15rem;">
                        Bill (${grpCount} items): <strong style="color:var(--text-main);">${formatINR(grpSummary.total)}</strong> · ${grpDue > 0 ? `<span style="color:var(--danger); font-weight:600;">Bill Due ${formatINR(grpDue)}</span>` : '<span style="color:var(--success); font-weight:600;">Bill Settled</span>'}
                      </div>
                    ` : ''}
                  </td>
                  <td>
                    ${canEditSrv ? `
                      <button class="badge ${statusClass}" style="cursor:pointer;" onclick="window.MJK.openStatusChangeModal('${s.id}')" title="Click to update status">
                        ${s.status} ✎
                      </button>
                    ` : `<span class="badge ${statusClass}">${s.status}</span>`}
                  </td>
                  <td>
                    <div class="date tabular-nums" style="font-size:0.75rem;">App: ${formatDate(s.appDate)}</div>
                    <div class="date tabular-nums" style="font-size:0.72rem; color:var(--text-muted);">Due: ${formatDate(s.deliveryDate)}</div>
                  </td>
                  <td style="text-align:right; white-space:nowrap;">
                    <div style="display:inline-flex; gap:0.3rem; flex-wrap:wrap; justify-content:flex-end;">
                      ${canMenu('whatsapp-connect', 'view', curUser) ? renderWhatsAppQuickButton({
                        phone: s.phone,
                        customerName: s.customerName,
                        serviceName: s.serviceName,
                        refNumber: s.refNumber,
                        status: s.status,
                        totalAmount: s.totalAmount,
                        paidAmount: s.paidAmount,
                        dueAmount: s.dueAmount,
                        context: 'SERVICE'
                      }, true) : ''}
                      ${s.dueAmount > 0 && canMenu('payments', 'add', curUser) ? `<button class="btn btn-success btn-sm" onclick="window.MJK.openCashCollectionModal('${escAttrJs(s.customerId || '')}', '${escAttrJs(s.receiptId || s.id)}')" title="Collect Outstanding Due">💰 Collect</button>` : ''}
                      ${canEditSrv ? `<button class="btn btn-secondary btn-sm" onclick="window.MJK.openQuickRateEditModal('${s.id}')" title="Change Rate / Price">₹ Rate</button>` : ''}
                      ${canPrintSrv ? `<button class="btn btn-secondary btn-sm" onclick="window.MJK.printServiceReceipt('${s.id}')" title="Print Receipt">🖨 Receipt</button>` : ''}
                      ${canEditSrv ? `<button class="btn btn-secondary btn-sm" onclick="window.MJK.editService('${s.id}')" title="Edit Service Entry">✎ Edit</button>` : ''}
                      ${canDelSrv ? `<button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.promptDeleteService('${s.id}')" title="Delete Service">🗑 Delete</button>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('') || `
              <tr>
                <td colspan="8">
                  <div class="empty-state">
                    <div class="empty-state-icon">📑</div>
                    <div class="empty-state-title">No Services Found</div>
                    <div class="empty-state-desc">Add a service registration or change your search criteria.</div>
                    ${canAddSrv ? `<button class="btn btn-primary btn-sm" onclick="window.MJK.openServiceModal()">+ New Service</button>` : ''}
                  </div>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* --- 4B. Dedicated Customer & Multi-Application Registration View --- */
function renderCustomerRegistrationView() {
  const curUser = getCurrentUser();
  const customers = getAllCustomers();
  const recentCases = getAllFollowupCases().slice(0, 12);
  const custTypes = getAdminOptionLabels('customer_type', { activeOnly: true });
  const priorities = getAdminOptionLabels('case_priority', { activeOnly: true });
  const activeStaffList = getAllUsers().filter(u => u.status === 'ACTIVE' && u.uid);
  const nextCustId = previewNextGlobalReference('CUST');
  const todayDate = getTodayDate();
  const nextAppId = previewNextApplicationId(todayDate);

  setTimeout(() => {
    const locMount = document.getElementById('reg-view-loc-mount');
    if (locMount && locMount.dataset.initialized !== '1') {
      locMount.dataset.initialized = '1';
      initLocationCascade('regv-loc', { state: 'West Bengal', district: 'Murshidabad' });
    }
    const srvWrap = document.getElementById('regv-services-wrap');
    if (srvWrap && srvWrap.dataset.initialized !== '1') {
      srvWrap.dataset.initialized = '1';
      initSearchableServiceSelector('regv-services', {
        showBilling: true,
        singleSelect: false
      });
    }
  }, 20);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">📝 Customer &amp; Multi-Application Registration</h2>
        <p class="page-subtitle">Register new citizens or issue new Applications under existing customers with auto-location fill, live Rate Chart billing &amp; 90-day lifecycle tracking</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.navigateTo('customers')">👥 All Customers (${customers.length})</button>
        <button type="button" class="btn btn-violet" onclick="window.MJK.navigateTo('followups')">📞 90-Day Tracker</button>
      </div>
    </div>

    <div class="card card-3d" style="padding:1.35rem; margin-bottom:1.5rem;">
      <form id="dedicated-reg-form" onsubmit="window.MJK.handleSaveDedicatedRegistration(event)">
        <div style="padding:0.85rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:1rem;">
          <div style="font-size:0.76rem; font-weight:800; color:var(--violet-600); text-transform:uppercase; margin-bottom:0.45rem;">
            Link Existing Customer (Optional — One Customer Can Have Multiple Independent Applications)
          </div>
          <select id="regv-existing-cust" class="form-control" onchange="window.MJK.prefillDedicatedRegistrationCustomer(this.value)">
            <option value="">-- Brand New Customer (Auto-generate new Customer ID) --</option>
            ${customers.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.name)} · ${escHtml(c.phone)} (${escHtml(c.id)})</option>`).join('')}
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Customer ID (Auto)</label>
            <input type="text" id="regv-cust-id" class="form-control font-mono" value="${escHtml(nextCustId)}" readonly style="background:var(--surface-alt); font-weight:700;">
          </div>
          <div class="form-group">
            <label class="form-label">Application ID (Auto) <span class="req">*</span></label>
            <input type="text" id="regv-app-id" class="form-control font-mono" value="${escHtml(nextAppId)}" required style="font-weight:700; color:var(--violet-600);" oninput="this.dataset.edited='1'">
          </div>
          <div class="form-group">
            <label class="form-label">Registration Date <span class="req">*</span></label>
            <input type="date" id="regv-regdate" class="form-control" value="${todayDate}" required onchange="const ap=document.getElementById('regv-app-id'); if(ap && ap.dataset.edited!=='1') ap.value=window.MJK.previewNextApplicationId(this.value);">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Customer Name <span class="req">*</span></label>
            <input type="text" id="regv-name" class="form-control" required placeholder="Full Name">
          </div>
          <div class="form-group">
            <label class="form-label">Mobile Number <span class="req">*</span></label>
            <input type="tel" id="regv-phone" class="form-control" required placeholder="10-digit Mobile">
          </div>
          <div class="form-group">
            <label class="form-label">Alternative Mobile (Optional)</label>
            <input type="tel" id="regv-altphone" class="form-control" placeholder="Optional Alternate Mobile">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Customer Type (Dynamic)</label>
            <select id="regv-custtype" class="form-control">
              ${custTypes.map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Case Priority (Dynamic)</label>
            <select id="regv-priority" class="form-control">
              ${priorities.map(p => `<option value="${escHtml(p)}" ${p === 'Normal' ? 'selected' : ''}>${escHtml(p)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Assigned Staff <span class="req">*</span></label>
            <select id="regv-staff" class="form-control" required>
              ${activeStaffList.map(u => `<option value="${escHtml(u.uid)}" ${(curUser?.uid || '') === u.uid ? 'selected' : ''}>${escHtml(u.name)} (${escHtml(u.uid)})</option>`).join('')}
            </select>
          </div>
        </div>

        ${renderSearchableServiceSelectorHtml('regv-services', {
          label: 'Select Service / Scheme (Search English or Bengali)',
          placeholder: 'Type service name in English or Bengali (e.g. PAN, Ration, লক্ষ্মীর ভাণ্ডার)...',
          required: true,
          showBilling: true,
          headerRightHtml: `
            <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
              <span id="regv-services-count" class="tabular-nums" style="font-size:0.74rem; font-weight:700; color:var(--blue-600);">0 selected</span>
              <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; font-weight:700; color:var(--violet-600); cursor:pointer;">
                <input type="checkbox" id="regv-separate-apps">
                Create separate Application ID per selected service
              </label>
            </div>
          `
        })}

        <div id="reg-view-loc-mount">
          ${renderLocationCascadeHtml('regv-loc', { title: '📍 Location Details (State / District / Village / P.O. / P.S. / PIN)', required: true })}
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">House / Para / Landmark (Optional)</label>
            <input type="text" id="regv-address" class="form-control" placeholder="Optional house number or landmark (auto-combined if empty)">
          </div>
          <div class="form-group">
            <label class="form-label">Remarks / Initial Application Note</label>
            <input type="text" id="regv-remarks" class="form-control" placeholder="Application remarks, documents verified, portal notes...">
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.78rem; font-weight:700;">
            <input type="checkbox" id="regv-open-doc-after"> Upload Supporting Document immediately after saving
          </label>
          <button type="submit" class="btn btn-primary">✓ Register &amp; Create Application</button>
        </div>
      </form>
    </div>

    <div class="table-card card-3d">
      <div class="table-toolbar">
        <div class="table-toolbar-left"><span style="font-weight:800;">Recently Registered Applications (${recentCases.length})</span></div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Application ID</th>
              <th>Customer &amp; Mobile</th>
              <th>Service / Scheme</th>
              <th>Current Status</th>
              <th>Priority &amp; Staff</th>
              <th style="text-align:right;">Open</th>
            </tr>
          </thead>
          <tbody>
            ${recentCases.map(cs => `
              <tr>
                <td class="font-mono" style="font-weight:700; color:var(--violet-600);">${escHtml(cs.applicationId)}</td>
                <td><strong>${escHtml(cs.customerName)}</strong><div style="font-size:0.73rem; color:var(--text-muted);">${escHtml(cs.customerId || '')} · ${escHtml(cs.phone || '-')}</div></td>
                <td>${escHtml(cs.schemeName || '-')}</td>
                <td><span class="badge badge-info">${escHtml(cs.currentStatus)}</span></td>
                <td><span class="badge badge-neutral">${escHtml(cs.priority || 'Normal')}</span> · ${escHtml(cs.assignedStaff || '-')}</td>
                <td style="text-align:right;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.viewCustomerProfile('${escAttrJs(cs.customerId || cs.id)}', 'status', '${escAttrJs(cs.id)}')">7-Tab Profile</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No applications registered yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* --- 5. Advanced 90 Days Customer Follow-up & Case Management View --- */
function renderFollowupsView(forcedBucket = null, forcedMode = null) {
  const curUser = getCurrentUser();
  const canAddFlw = canMenu('followups', 'add', curUser);
  const canEditFlw = canMenu('followups', 'edit', curUser);
  const canDelFlw = canMenu('followups', 'delete', curUser);

  if (!AppState.followupCasesHydrated) {
    AppState.followupCasesHydrated = true;
    sync90DayBootstrapFromServer().then(() => {
      if (String(AppState.currentRoute || '').startsWith('followups') || AppState.currentRoute === 'grievances' || AppState.currentRoute === 'admin-settings') {
        render();
      }
    });
  }

  const viewMode = forcedMode || AppState.followupViewMode || 'cases';
  const allSmartReminders = getSmartReminders({ filter: 'all' });
  const pendingRemCount = allSmartReminders.filter(r => !r.isCompleted).length;
  const overdueRemCount = allSmartReminders.filter(r => r.isOverdue).length;
  const upcomingRemCount = allSmartReminders.filter(r => r.isUpcoming).length;
  const completedRemCount = allSmartReminders.filter(r => r.isCompleted).length;

  const dash = get90DayDashboardData();
  const { stats, buckets } = dash;
  const activeBucket = forcedBucket || AppState.followupBucketFilter || 'all';
  const query = (AppState.followupSearchQuery || '').trim().toLowerCase();
  const staffFilter = AppState.followupStaffFilter || 'all';
  const serviceFilter = AppState.followupServiceFilter || 'all';
  const statusFilter = AppState.followupStatusFilter || 'all';
  const priorityFilter = AppState.followupPriorityFilter || 'all';
  const dateFilter = AppState.followupDateFilter || '';
  const regDateFilter = AppState.followupRegDateFilter || '';

  const staffOptions = Array.from(new Set(dash.cases.map(c => c.assignedStaff).filter(Boolean)));
  const serviceOptions = Array.from(new Set([
    ...getAdminOptionLabels('service_scheme', { activeOnly: true }),
    ...dash.cases.map(c => c.schemeName).filter(Boolean)
  ]));
  const statusOptions = getAdminOptionLabels('application_status', {
    activeOnly: false,
    includeValues: dash.cases.map(c => c.currentStatus)
  });
  const priorityOptions = getAdminOptionLabels('case_priority', {
    activeOnly: false,
    includeValues: dash.cases.map(c => c.priority)
  });

  let displayedCases = activeBucket === 'all'
    ? dash.cases
    : (buckets[activeBucket] || dash.cases);

  if (query) {
    displayedCases = displayedCases.filter(c => {
      const hay = [
        c.applicationId,
        c.customerId,
        c.customerName,
        c.phone,
        c.schemeName,
        c.villageOrWard,
        c.wardNumber,
        c.wardName,
        c.village,
        c.currentStatus,
        c.assignedStaff,
        c.priority
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(query);
    });
  }
  if (staffFilter !== 'all') displayedCases = displayedCases.filter(c => String(c.assignedStaff || '') === staffFilter);
  if (serviceFilter !== 'all') displayedCases = displayedCases.filter(c => String(c.schemeName || '') === serviceFilter || (Array.isArray(c.services) && c.services.includes(serviceFilter)));
  if (statusFilter !== 'all') displayedCases = displayedCases.filter(c => String(c.currentStatus || '') === statusFilter);
  if (priorityFilter !== 'all') displayedCases = displayedCases.filter(c => String(c.priority || 'Normal') === priorityFilter);
  if (dateFilter) displayedCases = displayedCases.filter(c => String(c._metrics?.effectiveNextDate || '') === dateFilter);
  if (regDateFilter) displayedCases = displayedCases.filter(c => String(c.startDate || '').slice(0, 10) === regDateFilter);

  const legacyFollowups = getAllFollowups();

  const bucketCards = [
    { key: 'today', label: "Today's", count: stats.todayCount, sub: 'Scheduled Today', tone: 'info', icon: '📅' },
    { key: 'upcoming', label: 'Upcoming', count: stats.upcomingCount, sub: 'Next 90-Day Cycle', tone: 'violet', icon: '⏳' },
    { key: 'overdue', label: 'Overdue', count: stats.overdueCount, sub: 'Immediate Action', tone: 'danger', icon: '🚨' },
    { key: 'pending', label: 'Pending', count: stats.pendingCount, sub: 'Active Open Cases', tone: 'orange', icon: '🔄' },
    { key: 'completed', label: 'Completed', count: stats.completedCount, sub: 'Closed / Resolved', tone: 'success', icon: '✅' },
    { key: 'review90', label: '90 Days Review', count: stats.review90Count || 0, sub: 'Day 75–90 Assessment', tone: 'teal', icon: '🏁' }
  ];

  const getStatusBadgeClass = (st) => {
    if (isFinalCaseStatus(st) || ['Approved', 'Sanctioned', 'Resolved', 'Benefit Received'].includes(st)) return 'badge-success';
    if (st === 'Rejected') return 'badge-danger';
    if (['Document Required', 'Pending at Department', 'Grievance Raised', 'Escalated to CMO', 'Escalated to MLA'].includes(st)) return 'badge-warning';
    return 'badge-info';
  };

  let remindersTabHtml = '';
  if (viewMode === 'reminders') {
    const rBucket = AppState.reminderBucketFilter || 'pending';
    const rType = AppState.reminderTypeFilter || 'all';
    const rQuery = AppState.reminderSearchQuery || '';
    const filteredReminders = getSmartReminders({ filter: rBucket, type: rType, query: rQuery });

    remindersTabHtml = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap:0.75rem; margin-bottom:1.15rem;">
        ${[
          { key: 'pending', label: 'Pending Reminders', count: pendingRemCount, tone: 'orange', icon: '🔔' },
          { key: 'upcoming', label: 'Upcoming', count: upcomingRemCount, tone: 'violet', icon: '📅' },
          { key: 'overdue', label: 'Overdue Alerts', count: overdueRemCount, tone: 'danger', icon: '🚨' },
          { key: 'completed', label: 'Completed', count: completedRemCount, tone: 'success', icon: '✅' },
          { key: 'all', label: 'All Scheduled', count: allSmartReminders.length, tone: 'info', icon: '📋' }
        ].map(b => `
          <button type="button" class="kpi-tile-3d kpi-tone-${b.tone} ${rBucket === b.key ? 'active-tile' : ''}" onclick="window.MJK.setReminderBucketFilter('${b.key}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="kpi-tile-label">${b.icon} ${b.label}</span>
              ${rBucket === b.key ? `<span class="badge badge-info" style="font-size:0.65rem;">ACTIVE</span>` : ''}
            </div>
            <div class="kpi-tile-val tabular-nums">${b.count}</div>
          </button>
        `).join('')}
      </div>

      <div class="table-card card-3d" style="overflow:hidden;">
        <div class="table-toolbar" style="flex-wrap:wrap; gap:0.5rem;">
          <div class="table-toolbar-left" style="gap:0.5rem; flex-wrap:wrap;">
            <input type="text" class="form-control toolbar-search" placeholder="Search customer, phone, seminar tag, gas delivery..." value="${escHtml(rQuery)}" oninput="window.MJK.setReminderSearchQuery(this.value)">
            <select class="form-control toolbar-select" onchange="window.MJK.setReminderTypeFilter(this.value)">
              <option value="all">All Reminder Categories</option>
              ${REMINDER_TYPES.map(rt => `<option value="${escHtml(rt)}" ${rType === rt ? 'selected' : ''}>${escHtml(rt)}</option>`).join('')}
            </select>
          </div>
          <div class="table-toolbar-right">
            ${canAddFlw ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openReminderModal()">+ Schedule Seminar / Gas / Promo Reminder</button>` : ''}
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Category &amp; Tag</th>
                <th>Scheduled Date &amp; Time</th>
                <th>Status</th>
                <th>Notes</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredReminders.map(r => {
                const typeBadge = r.reminderType === 'Product Seminar' ? 'badge-violet' : r.reminderType === 'Gas Delivery' ? 'badge-warning' : r.reminderType === 'Promotional Check-in' ? 'badge-info' : 'badge-neutral';
                const statusBadge = r.isCompleted ? 'badge-success' : r.isOverdue ? 'badge-danger' : 'badge-warning';
                const statusText = r.isCompleted ? 'Completed' : r.isOverdue ? 'Overdue' : 'Scheduled';
                const cleanPhone = (r.phone || '').replace(/[^0-9]/g, '');
                return `
                  <tr>
                    <td>
                      <div style="font-weight:700;">
                        ${r.customerId
                          ? `<a href="javascript:void(0)" onclick="window.MJK.viewCustomerProfile('${escAttrJs(r.customerId)}')" style="color:var(--blue-600); text-decoration:none;">${escHtml(r.customerName)}</a>`
                          : escHtml(r.customerName)}
                      </div>
                      <div class="tabular-nums" style="font-size:0.74rem; color:var(--text-muted);">${escHtml(r.phone || '-')}</div>
                    </td>
                    <td>
                      <span class="badge ${typeBadge}">${escHtml(r.reminderType)}</span>
                      <div style="font-weight:700; font-size:0.82rem; margin-top:0.2rem;">${escHtml(r.title)}</div>
                      ${r.seminarTag && r.seminarTag !== r.title ? `<div style="font-size:0.72rem; color:var(--violet-600);">Tag: ${escHtml(r.seminarTag)}</div>` : ''}
                    </td>
                    <td class="tabular-nums">
                      <div style="font-weight:700;">${formatDate(r.reminderDate)}</div>
                      <div style="font-size:0.76rem; color:var(--blue-600); font-weight:600;">⏰ ${escHtml(r.reminderTime)}</div>
                    </td>
                    <td>
                      <span class="badge ${statusBadge}">${statusText}</span>
                      ${r.notifiedAt ? `<div style="font-size:0.68rem; color:var(--text-muted); margin-top:2px;">Notified</div>` : ''}
                    </td>
                    <td style="max-width:220px; font-size:0.78rem; color:var(--text-muted);">${escHtml(r.note || '-')}</td>
                    <td style="text-align:right; white-space:nowrap;">
                      <div style="display:inline-flex; gap:0.25rem; flex-wrap:wrap; justify-content:flex-end;">
                        ${canEditFlw ? `
                          <button type="button" class="btn ${r.isCompleted ? 'btn-secondary' : 'btn-success'} btn-sm" onclick="window.MJK.toggleSmartReminderDone('${escAttrJs(r.id)}', ${!r.isCompleted})" title="${r.isCompleted ? 'Reopen Reminder' : 'Mark Completed'}">
                            ${r.isCompleted ? '↺ Reopen' : '✓ Done'}
                          </button>
                          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openReminderModal('${escAttrJs(r.customerId || '')}', '${escAttrJs(r.id)}')" title="Edit Reminder">✎</button>
                        ` : ''}
                        ${cleanPhone ? `<a href="tel:${cleanPhone}" class="btn btn-outline btn-sm" title="Call">📞</a>` : ''}
                        ${canDelFlw ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteSmartReminder('${escAttrJs(r.id)}')" title="Delete Reminder">🗑</button>` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('') || `
                <tr>
                  <td colspan="6">
                    <div class="empty-state">
                      <div class="empty-state-icon">📅</div>
                      <div class="empty-state-title">No Scheduled Reminders</div>
                      <div class="empty-state-desc">Tag customers for upcoming Product Seminars, Gas Deliveries, or Promotional Check-ins with automatic date &amp; time alerts.</div>
                      ${canAddFlw ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openReminderModal()">+ Schedule First Reminder</button>` : ''}
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return `
    <div class="page-header" style="margin-bottom:1rem;">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <span>📞 Smart Follow-ups, Reminders &amp; 90-Day Lifecycle</span>
          <span class="badge badge-info" style="font-size:0.74rem;">Day 0 → Day 90</span>
        </h2>
        <p class="page-subtitle">
          Dynamic Status &amp; Category Management, Seminar/Gas Delivery/Promotional Reminders &amp; 90-Day Customer Tracking
        </p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.45rem; flex-wrap:wrap;">
        ${canEditFlw ? `
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openManageDynamicOptionsModal('followup_status')">⚙️ Manage Statuses</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openManageDynamicOptionsModal('followup_scheme')">🏷️ Manage Categories</button>
        ` : ''}
        ${canAddFlw ? `
          <button type="button" class="btn btn-success btn-sm" onclick="window.MJK.openReminderModal()">
            📅 + Schedule Reminder
          </button>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openFollowupModal()">
            + Auto-Fetch Follow-up Entry
          </button>
          <button type="button" class="btn btn-violet btn-sm" onclick="window.MJK.openNewCase90DayModal()">
            + New Application Case
          </button>
        ` : ''}
      </div>
    </div>

    <div class="tab-nav" style="margin-bottom:1rem;">
      <button type="button" class="tab-btn ${viewMode === 'cases' ? 'active' : ''}" onclick="window.MJK.setFollowupViewMode('cases')">
        📋 90-Day Application Cases (${stats.totalCases})
      </button>
      <button type="button" class="tab-btn ${viewMode === 'reminders' ? 'active' : ''}" onclick="window.MJK.setFollowupViewMode('reminders')">
        📅 Seminar, Gas Delivery &amp; Promo Reminders (${pendingRemCount} Pending${overdueRemCount > 0 ? ` · ${overdueRemCount} Due` : ''})
      </button>
    </div>

    ${viewMode === 'reminders' ? remindersTabHtml : ''}
    ${viewMode === 'reminders' ? '' : `
    ${stats.overdueCount > 0 ? `
      <div style="background:var(--danger-bg); border:1px solid var(--danger-border); border-radius:var(--radius-lg); padding:0.9rem 1.15rem; margin-bottom:1.15rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <span style="font-size:1.35rem;">🚨</span>
          <div>
            <div style="font-weight:800; color:var(--danger); font-size:0.92rem;">
              Automatic Overdue Alert: ${stats.overdueCount} Application(s) Missed Scheduled Follow-up Date!
            </div>
            <div style="font-size:0.78rem; color:var(--text-muted);">
              ${buckets.overdue.slice(0, 3).map(c => `${escHtml(c.customerName)} (${escHtml(c.applicationId)} · ${c._metrics.overdueDays}d overdue)`).join(' · ')}
              ${buckets.overdue.length > 3 ? ` +${buckets.overdue.length - 3} more` : ''}
            </div>
          </div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="window.MJK.setFollowupBucketFilter('overdue')">
          Show Overdue Only (${stats.overdueCount})
        </button>
      </div>
    ` : ''}

    <!-- 6 Smart Dashboard Counter Cards & Filter Sections -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 165px), 1fr)); gap:0.75rem; margin-bottom:1.15rem;">
      ${bucketCards.map(b => {
        const isSelected = activeBucket === b.key;
        return `
          <button type="button"
            class="kpi-tile-3d kpi-tone-${b.tone} ${isSelected ? 'active-tile' : ''}"
            onclick="window.MJK.setFollowupBucketFilter('${isSelected ? 'all' : b.key}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="kpi-tile-label">${b.icon} ${b.label}</span>
              ${isSelected ? `<span class="badge badge-info" style="font-size:0.65rem;">ACTIVE</span>` : ''}
            </div>
            <div class="kpi-tile-val tabular-nums">${b.count}</div>
            <div class="kpi-tile-sub">${b.sub}</div>
          </button>
        `;
      }).join('')}
    </div>

    <!-- Quick 4-Card Export Bar + Link to Full 11 Reports -->
    <div class="card card-3d" style="padding:0.9rem 1.05rem; margin-bottom:1.15rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
        <div>
          <div style="font-size:0.84rem; font-weight:800; color:var(--text-main);">📊 Quick Follow-up Reports (PDF, Excel, Print)</div>
          <div style="font-size:0.73rem; color:var(--text-muted);">Need all 11 reports with Staff/Service/Status filters? Visit Reports &amp; Analytics.</div>
        </div>
        <div style="display:flex; gap:0.45rem; flex-wrap:wrap; align-items:center;">
          ${[
            { id: 'daily', label: 'Daily' },
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'completed-90', label: '90d Done' }
          ].map(rep => `
            <div style="display:flex; align-items:center; gap:0.2rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:8px; padding:0.25rem 0.45rem;">
              <span style="font-size:0.72rem; font-weight:700; color:var(--text-main); margin-right:0.2rem;">${rep.label}:</span>
              <button type="button" class="btn btn-outline btn-sm" style="padding:0.16rem 0.45rem; font-size:0.7rem;" onclick="window.MJK.exportFollowupReportAction('${rep.id}', 'pdf')">PDF</button>
              <button type="button" class="btn btn-outline btn-sm" style="padding:0.16rem 0.45rem; font-size:0.7rem;" onclick="window.MJK.exportFollowupReportAction('${rep.id}', 'excel')">Excel</button>
              <button type="button" class="btn btn-outline btn-sm" style="padding:0.16rem 0.4rem; font-size:0.7rem;" onclick="window.MJK.exportFollowupReportAction('${rep.id}', 'print')">🖨</button>
            </div>
          `).join('')}
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.navigateTo('reports')">All 11 Reports →</button>
        </div>
      </div>
    </div>

    <!-- Active Cases Multi-Filter & Table -->
    <div class="table-card card-3d" style="overflow:hidden;">
      <div class="table-toolbar" style="flex-direction:column; align-items:stretch; gap:0.65rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span style="font-weight:800; font-size:0.92rem;">
              ${activeBucket === 'all' ? `All 90-Day Applications (${displayedCases.length})` : `${activeBucket.toUpperCase()} Applications (${displayedCases.length})`}
            </span>
            ${activeBucket !== 'all' ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.setFollowupBucketFilter('all')">Show All (${stats.totalCases})</button>` : ''}
          </div>
          <input type="text" class="form-control" style="max-width:340px;"
            placeholder="Search Application ID, Customer, Mobile, Service, Staff..."
            value="${escHtml(AppState.followupSearchQuery || '')}"
            oninput="window.MJK.setFollowupSearchQuery(this.value)">
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 155px), 1fr)); gap:0.45rem;">
          <select class="form-control" style="height:34px; font-size:0.78rem;" onchange="window.MJK.setFollowupListFilter('service', this.value)">
            <option value="all">All Services / Schemes</option>
            ${serviceOptions.map(s => `<option value="${escHtml(s)}" ${serviceFilter === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
          </select>
          <select class="form-control" style="height:34px; font-size:0.78rem;" onchange="window.MJK.setFollowupListFilter('status', this.value)">
            <option value="all">All Current Statuses</option>
            ${statusOptions.map(s => `<option value="${escHtml(s)}" ${statusFilter === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
          </select>
          <select class="form-control" style="height:34px; font-size:0.78rem;" onchange="window.MJK.setFollowupListFilter('staff', this.value)">
            <option value="all">All Assigned Staff</option>
            ${staffOptions.map(s => `<option value="${escHtml(s)}" ${staffFilter === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
          </select>
          <select class="form-control" style="height:34px; font-size:0.78rem;" onchange="window.MJK.setFollowupListFilter('priority', this.value)">
            <option value="all">All Priorities</option>
            ${priorityOptions.map(p => `<option value="${escHtml(p)}" ${priorityFilter === p ? 'selected' : ''}>${escHtml(p)}</option>`).join('')}
          </select>
          <input type="date" class="form-control" style="height:34px; font-size:0.78rem;" value="${escHtml(regDateFilter)}" title="Filter by Registration Date" onchange="window.MJK.setFollowupListFilter('regDate', this.value)">
          <input type="date" class="form-control" style="height:34px; font-size:0.78rem;" value="${escHtml(dateFilter)}" title="Filter by Next Follow-up Date" onchange="window.MJK.setFollowupListFilter('followupDate', this.value)">
          <button type="button" class="btn btn-secondary btn-sm" style="height:34px;" onclick="window.MJK.resetFollowupListFilters()">↺ Reset Filters</button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Application ID &amp; Customer</th>
              <th>Service &amp; Priority</th>
              <th>90-Day Cycle (0–90d)</th>
              <th>Current Status (Independent)</th>
              <th>Next Follow-up / Alert</th>
              <th>Latest Note</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${displayedCases.map(c => {
              const m = c._metrics;
              const tl = Array.isArray(c.timeline) ? c.timeline : [];
              const latest = tl[tl.length - 1];
              const cleanPhone = (c.phone || '').replace(/[^0-9]/g, '');
              const rowBg = m.isOverdue ? 'background:rgba(239, 68, 68, 0.06);' : m.isToday ? 'background:rgba(14, 165, 233, 0.06);' : '';
              return `
                <tr style="${rowBg}">
                  <td>
                    <div class="font-mono" style="font-weight:800; font-size:0.78rem; color:var(--violet-600);">${escHtml(c.applicationId)}</div>
                    <div style="font-weight:700; font-size:0.86rem; margin-top:2px;">
                      ${c.customerId
                        ? `<a href="javascript:void(0)" onclick="window.MJK.viewCustomerProfile('${escAttrJs(c.customerId)}', 'followups', '${escAttrJs(c.id)}')" style="color:var(--blue-600); text-decoration:none;">${escHtml(c.customerName)}</a>`
                        : escHtml(c.customerName)}
                    </div>
                    <div class="tabular-nums" style="font-size:0.73rem; color:var(--text-muted);">${escHtml(c.phone || '-')}</div>
                  </td>
                  <td>
                    <div style="font-weight:700; font-size:0.82rem;">${escHtml(c.schemeName || '-')}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(c.priority || 'Normal')} · ${escHtml(c.villageOrWard || '-')}</div>
                  </td>
                  <td style="min-width:145px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.73rem; font-weight:700; margin-bottom:3px;">
                      <span>Day ${m.elapsedDays} / 90</span>
                      <span style="color:var(--text-muted);">${m.completedMilestonesCount}/${m.totalMilestones} pts</span>
                    </div>
                    <div style="height:6px; background:var(--surface-alt); border-radius:999px; overflow:hidden; border:1px solid var(--border-subtle);">
                      <div style="height:100%; width:${m.progressPct}%; background:${m.isCompleted ? '#16a34a' : m.isOverdue ? '#dc2626' : '#6d28d9'};"></div>
                    </div>
                    <div style="font-size:0.68rem; color:var(--text-muted); margin-top:3px;">
                      Reg: ${formatDate(m.startDate)} · ${m.isCompleted ? 'Closed' : `${m.remainingDays}d left`}
                    </div>
                  </td>
                  <td>
                    <button type="button" class="badge ${getStatusBadgeClass(c.currentStatus)}" style="cursor:pointer;"
                      onclick="window.MJK.openCustomerStatusModal('${escAttrJs(c.id)}')" title="Click to update Current Status (Independent of Follow-up Schedule)">
                      ${escHtml(c.currentStatus)} ✎
                    </button>
                    <div style="font-size:0.72rem; color:var(--text-muted); margin-top:3px;">Staff: <strong>${escHtml(c.assignedStaff || '-')}</strong></div>
                  </td>
                  <td>
                    ${m.isCompleted
                      ? `<span class="badge badge-success">✓ Closed / Done</span>`
                      : m.isOverdue
                        ? `<span class="badge badge-danger">🚨 OVERDUE (${m.overdueDays}d)</span>
                           <div style="font-size:0.72rem; color:var(--danger); font-weight:700; margin-top:2px;">Due: ${formatDate(m.effectiveNextDate)}</div>`
                        : m.isToday
                          ? `<span class="badge badge-warning">📅 DUE TODAY</span>
                             <div style="font-size:0.72rem; font-weight:700; margin-top:2px;">${m.nextMilestone?.label ? escHtml(m.nextMilestone.label.split('—')[0]) : formatDate(m.effectiveNextDate)}</div>`
                          : `<div class="tabular-nums" style="font-weight:700; font-size:0.8rem;">${m.effectiveNextDate ? formatDate(m.effectiveNextDate) : '-'}</div>
                             <div style="font-size:0.7rem; color:var(--text-muted);">Day ${c.nextMilestoneDay || m.nextMilestone?.day || '-'} Schedule</div>`
                    }
                  </td>
                  <td style="max-width:230px;">
                    ${latest ? `
                      <div style="font-size:0.76rem; color:var(--text-main); line-height:1.35;">
                        <strong>#${latest.entryNo || tl.length} [Day ${latest.cycleDay ?? 0}]:</strong> ${escHtml(latest.note)}
                      </div>
                      <div style="font-size:0.68rem; color:var(--text-muted); margin-top:2px;">
                        ${formatDate(latest.date)} · ${escHtml(latest.contactMethod || latest.followupMode || '')} · ${tl.length} log(s)
                      </div>
                    ` : '<span style="color:var(--text-muted); font-size:0.75rem;">No notes yet</span>'}
                  </td>
                  <td style="text-align:right; white-space:nowrap;">
                    <div style="display:flex; gap:0.25rem; justify-content:flex-end; flex-wrap:wrap;">
                      ${canAddFlw || canEditFlw ? `
                        <button class="btn btn-primary btn-sm" onclick="window.MJK.openFollowupModal('${escAttrJs(c.id)}')" title="Add Follow-up Entry">+ Follow-up</button>
                        <button class="btn btn-outline btn-sm" onclick="window.MJK.openCustomerStatusModal('${escAttrJs(c.id)}')" title="Update Current Status">Status</button>
                        ${m.isCompleted
                          ? `<button class="btn btn-warning btn-sm" onclick="window.MJK.openReopenCaseModal('${escAttrJs(c.id)}')" title="Reopen Closed Case">Reopen</button>`
                          : `<button class="btn btn-secondary btn-sm" onclick="window.MJK.openCaseRescheduleModal('${escAttrJs(c.id)}')" title="Manual Reschedule">📅</button>`
                        }
                        <button class="btn btn-secondary btn-sm" onclick="window.MJK.openGrievanceModal('${escAttrJs(c.id)}')" title="Log Portal Grievance">⚖️</button>
                      ` : ''}
                      ${c.customerId ? `<button class="btn btn-secondary btn-sm" onclick="window.MJK.viewCustomerProfile('${escAttrJs(c.customerId)}', 'status', '${escAttrJs(c.id)}')" title="7-Tab Profile">👤</button>` : ''}
                      ${cleanPhone ? `<a href="tel:${cleanPhone}" class="btn btn-outline btn-sm" title="Call Customer">📞</a>` : ''}
                      ${canDelFlw ? `<button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteFollowupCase('${escAttrJs(c.id)}')" title="Delete Case">🗑</button>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('') || `
              <tr>
                <td colspan="7">
                  <div class="empty-state">
                    <div class="empty-state-icon">📞</div>
                    <div class="empty-state-title">${query ? 'No Matching Applications' : 'No 90-Day Applications Yet'}</div>
                    <div class="empty-state-desc">Register a customer or start a new Application Case to track Day 0–90 follow-ups.</div>
                    ${canAddFlw ? `<button class="btn btn-primary btn-sm" onclick="window.MJK.openNewCase90DayModal()">+ New Application Case</button>` : ''}
                  </div>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>

    ${legacyFollowups.length > 0 ? `
      <div class="table-card" style="margin-top:1.25rem; overflow:hidden;">
        <div class="table-toolbar"><div class="table-toolbar-left"><span style="font-weight:700; font-size:0.86rem;">Legacy Reminder Queue (${legacyFollowups.length})</span></div></div>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Status</th><th>Customer</th><th>Reason</th><th>Scheduled</th><th>Notes</th><th style="text-align:right;">Actions</th></tr></thead>
            <tbody>
              ${legacyFollowups.map(f => `
                <tr>
                  <td><span class="badge ${f.status === 'Overdue' ? 'badge-danger' : f.status === 'Today' ? 'badge-warning' : f.status === 'Completed' ? 'badge-success' : 'badge-neutral'}">${escHtml(f.status)}</span></td>
                  <td><strong>${escHtml(f.customerName)}</strong><div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(f.phone)}</div></td>
                  <td>${escHtml(f.reason)}</td>
                  <td>${formatDate(f.followDate)} ${escHtml(f.followTime || '')}</td>
                  <td>${escHtml(f.notes || '-')}</td>
                  <td style="text-align:right; white-space:nowrap;">
                    ${canEditFlw ? `<button class="btn btn-success btn-sm" onclick="window.MJK.quickCompleteFollowup('${escAttrJs(f.id)}')">✓</button>` : ''}
                    ${canEditFlw ? `<button class="btn btn-secondary btn-sm" onclick="window.MJK.openRescheduleModal('${escAttrJs(f.id)}')">📅</button>` : ''}
                    ${canDelFlw ? `<button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteFollowup('${escAttrJs(f.id)}')">🗑</button>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
    `}
  `;
}

/* --- 5B. Grievance Tracking View (Portal-Specific Multi-Grievance Register) --- */
function renderGrievancesView() {
  const portalOptions = getAdminOptionLabels('grievance_portal', { activeOnly: true });
  const allCases = getAllFollowupCases();
  const baseList = getAllGrievances();
  const seen = new Set(baseList.map(g => g.id));
  const combined = [...baseList];
  allCases.forEach(c => {
    (c.grievances || []).forEach(g => {
      if (!seen.has(g.id)) {
        seen.add(g.id);
        combined.push({ ...g, applicationId: g.applicationId || c.applicationId, customerId: g.customerId || c.customerId, customerName: g.customerName || c.customerName });
      }
    });
  });

  const q = (AppState.grievanceSearchQuery || '').trim().toLowerCase();
  const pf = AppState.grievancePortalFilter || 'all';
  const sf = AppState.grievanceStatusFilter || 'all';
  const filtered = combined.filter(g => {
    const portalVal = g.portal || g.type || 'Other';
    const stVal = g.status || 'Pending';
    if (pf !== 'all' && portalVal !== pf) return false;
    if (sf !== 'all' && stVal !== sf) return false;
    if (!q) return true;
    const hay = [g.applicationId, g.customerName, g.phone, g.referenceNumber, portalVal, g.department, g.remarks, g.description, stVal].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">⚖️ Portal Grievance &amp; Escalation Tracking</h2>
        <p class="page-subtitle">Dynamic portal schemas (CMO, MLA, CPGRAMS, NPCI, Other &amp; custom Admin portals) supporting multiple grievances per Application</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-outline" onclick="window.MJK.exportFollowupReportAction('grievance', 'pdf')">📄 Export PDF</button>
        <button type="button" class="btn btn-outline" onclick="window.MJK.exportFollowupReportAction('grievance', 'excel')">📊 Export Excel</button>
        <button type="button" class="btn btn-primary" onclick="window.MJK.openGrievanceModal()">+ Log New Grievance</button>
      </div>
    </div>

    <div class="table-card card-3d">
      <div class="table-toolbar" style="flex-wrap:wrap; gap:0.5rem;">
        <div class="table-toolbar-left">
          <span style="font-weight:800;">Grievance Register (${filtered.length})</span>
        </div>
        <div class="table-toolbar-right" style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <select class="form-control toolbar-select" onchange="window.MJK.setGrievancePortalFilter(this.value)">
            <option value="all">All Portals (${combined.length})</option>
            ${portalOptions.map(p => `<option value="${escHtml(p)}" ${pf === p ? 'selected' : ''}>${escHtml(p)}</option>`).join('')}
          </select>
          <select class="form-control toolbar-select" onchange="window.MJK.setGrievanceStatusFilter(this.value)">
            <option value="all">All Statuses</option>
            ${['Pending', 'In Progress', 'Resolved', 'Escalated'].map(s => `<option value="${escHtml(s)}" ${sf === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
          </select>
          <input type="text" class="form-control toolbar-search" placeholder="Search Ref No, App ID, Customer, Mobile..."
            value="${escHtml(AppState.grievanceSearchQuery || '')}"
            oninput="window.MJK.setGrievanceSearchQuery(this.value)">
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Portal &amp; Ref No</th>
              <th>Application &amp; Customer</th>
              <th>Portal-Specific Details</th>
              <th>Date &amp; Status</th>
              <th>Remarks</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(g => {
              const portalTitle = g.portal === 'Other' && g.customPortalName ? `Other (${g.customPortalName})` : (g.portal || g.type || 'Grievance');
              const extraParts = [];
              if (g.department) extraParts.push(`Dept: ${g.department}`);
              if (g.atr) extraParts.push(`ATR: ${g.atr}`);
              if (g.aadhaarSeedingStatus) extraParts.push(`Aadhaar Seeding: ${g.aadhaarSeedingStatus}`);
              if (g.bankMapping) extraParts.push(`Bank Mapping: ${g.bankMapping}`);
              if (!extraParts.length && g.submittedTo) extraParts.push(`To: ${g.submittedTo}`);
              const statusVal = g.status || 'Pending';
              const statusCls = statusVal === 'Resolved' ? 'badge-success' : statusVal === 'Escalated' ? 'badge-danger' : statusVal === 'In Progress' ? 'badge-info' : 'badge-warning';
              return `
                <tr>
                  <td>
                    <span class="badge badge-orange">${escHtml(portalTitle)}</span>
                    <div class="font-mono" style="font-weight:700; font-size:0.78rem; margin-top:3px;">${escHtml(g.referenceNumber || '-')}</div>
                  </td>
                  <td>
                    <div class="font-mono" style="font-weight:700; color:var(--violet-600); font-size:0.78rem;">${escHtml(g.applicationId || '-')}</div>
                    <div style="font-weight:700;">${escHtml(g.customerName || '-')}</div>
                    ${g.phone ? `<div class="tabular-nums" style="font-size:0.72rem; color:var(--text-muted);">${escHtml(g.phone)}</div>` : ''}
                  </td>
                  <td style="font-size:0.78rem; color:var(--text-main);">${escHtml(extraParts.join(' · ') || '-')}</td>
                  <td>
                    <span class="badge ${statusCls}">${escHtml(statusVal)}</span>
                    <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">${formatDate(g.date)}</div>
                  </td>
                  <td style="max-width:240px; font-size:0.78rem;">${escHtml(g.remarks || g.description || '-')}</td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openGrievanceModal('${escAttrJs(g.caseId || g.applicationId || '')}', '${escAttrJs(g.id)}')">✎ Edit</button>
                    ${g.customerId ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.viewCustomerProfile('${escAttrJs(g.customerId)}', 'grievances', '${escAttrJs(g.caseId || '')}')">👤</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('') || `
              <tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No grievances recorded yet. Click "+ Log New Grievance" above to submit one.</td></tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* --- 5C. Dynamic Admin Control System (ADMIN ONLY) --- */
function renderAdminSettingsView() {
  const curUser = getCurrentUser();
  if (!curUser || String(curUser.role || '').toUpperCase() !== 'ADMIN') {
    return renderAccessDeniedView();
  }

  const activeTab = AppState.adminSettingsTab || 'options';
  const categories = getAdminOptionCategories();
  const activeCat = AppState.adminOptionCategory || 'application_status';
  const catMeta = categories.find(c => c.key === activeCat) || categories[0];
  const catOptions = getAdminOptions(activeCat, { activeOnly: false });
  const editOpt = AppState.adminOptionEditId ? catOptions.find(o => o.id === AppState.adminOptionEditId) : null;

  const scheduleList = getFollowupScheduleTemplate({ activeOnly: false });
  const editSched = AppState.adminScheduleEditId ? scheduleList.find(s => s.id === AppState.adminScheduleEditId) : null;

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">🎛️ Dynamic Admin Control System (Admin-Only)</h2>
        <p class="page-subtitle">Add, Edit, Delete, Activate &amp; Deactivate all dropdowns, services, statuses, grievance portals &amp; 90-day schedule milestones live without touching code</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-outline" onclick="window.MJK.adminRestoreOptions('${escAttrJs(activeCat)}')">↺ Restore "${escHtml(catMeta.label)}" Defaults</button>
        <button type="button" class="btn btn-secondary" onclick="window.MJK.adminRestoreOptions('')">↺ Restore All Default Options</button>
      </div>
    </div>

    <div class="tab-nav" style="margin-bottom:1.15rem;">
      <button type="button" class="tab-btn ${activeTab === 'options' ? 'active' : ''}" onclick="window.MJK.setAdminSettingsTab('options')">🗂️ Manage All Dropdowns (${getAdminOptions('', { activeOnly: false }).length})</button>
      <button type="button" class="tab-btn ${activeTab === 'schedule' ? 'active' : ''}" onclick="window.MJK.setAdminSettingsTab('schedule')">📅 Manage 90-Day Schedule Days (${scheduleList.length})</button>
      <button type="button" class="tab-btn ${activeTab === 'staff' ? 'active' : ''}" onclick="window.MJK.setAdminSettingsTab('staff')">🧑‍💼 Manage Staff Members</button>
      <button type="button" class="tab-btn ${activeTab === 'upi' ? 'active' : ''}" onclick="window.MJK.setAdminSettingsTab('upi')">📱 UPI QR &amp; Payment Settings</button>
    </div>

    ${activeTab === 'options' ? `
      <div class="erp-grid-1-2">
        <div class="card card-3d" style="padding:1rem;">
          <div style="font-size:0.75rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.6rem;">Configurable Categories</div>
          <div style="display:flex; flex-direction:column; gap:0.3rem;">
            ${categories.map(cat => {
              const cnt = getAdminOptions(cat.key, { activeOnly: false }).length;
              const isSel = cat.key === activeCat;
              return `
                <button type="button" onclick="window.MJK.setAdminOptionCategory('${cat.key}')"
                  style="display:flex; justify-content:space-between; align-items:center; padding:0.55rem 0.75rem; border-radius:var(--radius-md); text-align:left; font-size:0.82rem; font-weight:${isSel ? '700' : '500'}; background:${isSel ? 'var(--grad-teal-blue)' : 'var(--surface-alt)'}; color:${isSel ? '#ffffff' : 'var(--text-main)'}; border:1px solid ${isSel ? 'transparent' : 'var(--border-subtle)'};">
                  <span>${escHtml(cat.label)}</span>
                  <span style="font-size:0.72rem; opacity:0.85;">${cnt}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div class="card card-3d" style="padding:1.15rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.85rem;">
            <div>
              <h3 style="margin:0; font-size:1.05rem;">${escHtml(catMeta.label)}</h3>
              <div style="font-size:0.76rem; color:var(--text-muted);">${escHtml(catMeta.description)}</div>
            </div>
          </div>

          <form onsubmit="window.MJK.adminSaveOption(event)" style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:flex-end; padding:0.85rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:1rem;">
            <input type="hidden" id="adm-opt-id" value="${escHtml(editOpt?.id || '')}">
            <div style="flex:1; min-width:min(100%, 220px);">
              <label class="form-label" style="font-size:0.75rem;">${editOpt ? `Edit Option (${escHtml(editOpt.label)})` : `Add New ${escHtml(catMeta.label)} Option`} *</label>
              <input type="text" id="adm-opt-label" class="form-control" required value="${escHtml(editOpt?.label || '')}" placeholder="Enter option display name...">
            </div>
            <div style="width:110px;">
              <label class="form-label" style="font-size:0.75rem;">Sort Order</label>
              <input type="number" id="adm-opt-order" class="form-control" value="${editOpt ? (editOpt.sortOrder || 1) : (catOptions.length + 1)}">
            </div>
            <button type="submit" class="btn btn-primary">${editOpt ? '✓ Update Option' : '+ Add Option'}</button>
            ${editOpt ? `<button type="button" class="btn btn-secondary" onclick="window.MJK.adminEditOption('')">Cancel Edit</button>` : ''}
          </form>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Option Label</th>
                  <th>Visibility Status</th>
                  <th style="text-align:right;">Controls</th>
                </tr>
              </thead>
              <tbody>
                ${catOptions.map(o => `
                  <tr style="${o.isActive === false ? 'opacity:0.6;' : ''}">
                    <td class="tabular-nums">${o.sortOrder || 0}</td>
                    <td><strong>${escHtml(o.label)}</strong> ${o.isDefault ? `<span style="font-size:0.68rem; color:var(--text-muted);">(Default)</span>` : ''}</td>
                    <td>
                      <span class="badge ${o.isActive !== false ? 'badge-success' : 'badge-neutral'}">
                        ${o.isActive !== false ? 'Active (Visible)' : 'Deactivated (History Only)'}
                      </span>
                    </td>
                    <td style="text-align:right; white-space:nowrap;">
                      <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.adminEditOption('${escAttrJs(o.id)}')">✎ Edit</button>
                      <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.adminToggleOption('${escAttrJs(o.id)}')">${o.isActive !== false ? 'Deactivate' : 'Activate'}</button>
                      <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.adminDeleteOption('${escAttrJs(o.id)}')">🗑</button>
                    </td>
                  </tr>
                `).join('') || '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No options in this category yet.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ` : activeTab === 'schedule' ? `
      <div class="card card-3d" style="padding:1.15rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
          <div>
            <h3 style="margin:0; font-size:1.05rem;">Database-Driven 90-Day Follow-up Milestones</h3>
            <div style="font-size:0.76rem; color:var(--text-muted);">Changes apply dynamically to new applications and milestones without altering Current Status automatically</div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.adminRestoreSchedule()">↺ Restore Default Day 0–90 Schedule</button>
        </div>

        <form onsubmit="window.MJK.adminSaveMilestone(event)" style="display:grid; grid-template-columns:110px 1fr 1.4fr auto; gap:0.5rem; align-items:flex-end; padding:0.85rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:1rem;">
          <input type="hidden" id="adm-sch-id" value="${escHtml(editSched?.id || '')}">
          <div>
            <label class="form-label" style="font-size:0.75rem;">Day Offset *</label>
            <input type="number" id="adm-sch-day" class="form-control" min="0" required value="${editSched ? editSched.day : 90}">
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">Milestone Title *</label>
            <input type="text" id="adm-sch-title" class="form-control" required value="${escHtml(editSched?.title || '')}" placeholder="e.g. Department Escalation Check">
          </div>
          <div>
            <label class="form-label" style="font-size:0.75rem;">Description / Instructions</label>
            <input type="text" id="adm-sch-desc" class="form-control" value="${escHtml(editSched?.description || '')}" placeholder="Notes for staff...">
          </div>
          <div style="display:flex; gap:0.35rem;">
            <button type="submit" class="btn btn-primary">${editSched ? '✓ Update' : '+ Add Day'}</button>
            ${editSched ? `<button type="button" class="btn btn-secondary" onclick="window.MJK.adminEditMilestone('')">Cancel</button>` : ''}
          </div>
        </form>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Day</th>
                <th>Title</th>
                <th>Description</th>
                <th>Status</th>
                <th style="text-align:right;">Controls</th>
              </tr>
            </thead>
            <tbody>
              ${scheduleList.map((m, idx) => `
                <tr style="${m.isActive === false ? 'opacity:0.6;' : ''}">
                  <td>
                    <button type="button" class="btn btn-secondary btn-sm" ${idx === 0 ? 'disabled' : ''} onclick="window.MJK.adminMoveMilestone('${escAttrJs(m.id)}', -1)">↑</button>
                    <button type="button" class="btn btn-secondary btn-sm" ${idx === scheduleList.length - 1 ? 'disabled' : ''} onclick="window.MJK.adminMoveMilestone('${escAttrJs(m.id)}', 1)">↓</button>
                  </td>
                  <td class="tabular-nums" style="font-weight:800;">Day ${m.day}</td>
                  <td><strong>${escHtml(m.title)}</strong></td>
                  <td style="font-size:0.78rem; color:var(--text-muted);">${escHtml(m.description || '-')}</td>
                  <td><span class="badge ${m.isActive !== false ? 'badge-success' : 'badge-neutral'}">${m.isActive !== false ? 'Enabled' : 'Disabled'}</span></td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.adminEditMilestone('${escAttrJs(m.id)}')">✎</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.adminToggleMilestone('${escAttrJs(m.id)}')">${m.isActive !== false ? 'Disable' : 'Enable'}</button>
                    <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.adminDeleteMilestone('${escAttrJs(m.id)}')">🗑</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : activeTab === 'upi' ? (() => {
      const upi = getUpiPaymentSettings();
      const previewSrc = AppState.upiDraftQrDataUrl !== undefined ? AppState.upiDraftQrDataUrl : (upi.qrImageDataUrl || '');
      const previewName = AppState.upiDraftQrFileName !== undefined ? AppState.upiDraftQrFileName : (upi.qrFileName || '');
      return `
        <div class="erp-grid-2" style="align-items:start;">
          <div class="card card-3d" style="padding:1.25rem;">
            <h3 style="margin:0 0 0.35rem 0; font-size:1.05rem;">Admin-Controlled UPI QR Code &amp; Payment Settings</h3>
            <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:1rem;">
              Upload your original UPI QR code image (JPG, JPEG, PNG, WebP) and set your official UPI ID &amp; display name. The system stores and prints your exact image without altering or generating any QR code.
            </p>
            <form onsubmit="window.MJK.handleSaveUpiSettings(event)">
              <div class="form-group">
                <label class="form-label">Original UPI QR Code Image (JPG, JPEG, PNG, WebP)</label>
                <input type="file" id="adm-upi-qr-file" class="form-control" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onchange="window.MJK.onUpiQrFileSelected(this)">
                <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.25rem;">
                  ${previewName ? `Selected / Saved File: <strong>${escHtml(previewName)}</strong>` : 'No QR image uploaded yet.'}
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Official UPI ID</label>
                <input type="text" id="adm-upi-id" class="form-control font-mono" value="${escHtml(upi.upiId || '')}" placeholder="Enter your official UPI ID (e.g. name@bank)">
              </div>
              <div class="form-group">
                <label class="form-label">UPI Display Name / Payment Name</label>
                <input type="text" id="adm-upi-name" class="form-control" value="${escHtml(upi.upiDisplayName || '')}" placeholder="Enter payee display name (e.g. MUN COMPUTER)">
              </div>
              <div class="form-group">
                <label class="form-label">Payment Instructions (Shown on Bills &amp; Receipts)</label>
                <textarea id="adm-upi-instructions" class="form-control" rows="3" placeholder="e.g. Scan & Pay using any UPI app and share Transaction/UTR ID at counter for verification.">${escHtml(upi.paymentInstructions || '')}</textarea>
              </div>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:1rem;">
                <button type="submit" class="btn btn-primary">💾 Save UPI Payment Settings</button>
                ${(upi.qrImageDataUrl || previewSrc) ? `<button type="button" class="btn btn-outline" style="color:var(--danger);" onclick="window.MJK.handleRemoveUpiQr()">🗑 Remove QR Image</button>` : ''}
              </div>
            </form>
          </div>
          <div class="card card-3d" style="padding:1.25rem;">
            <h4 style="margin:0 0 0.6rem 0; font-size:0.95rem;">Live Bill / Invoice Preview (Strict B&amp;W)</h4>
            <div style="border:1.5px solid #000000; background:#ffffff; color:#000000; padding:12px;">
              <div style="font-weight:800; text-transform:uppercase; border-bottom:1px solid #000000; padding-bottom:4px; margin-bottom:8px;">ONLINE PAYMENT – UPI</div>
              ${previewSrc
                ? `<div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                     <img src="${escHtml(previewSrc)}" alt="Admin Uploaded UPI QR Code" style="width:120px; height:120px; object-fit:contain; border:1px solid #000000; padding:4px; background:#ffffff;">
                     <div style="font-size:0.84rem; line-height:1.5; color:#000000;">
                       <div><strong>Scan &amp; Pay Using Any UPI Application.</strong></div>
                       <div><strong>UPI ID:</strong> <span class="font-mono">${escHtml(upi.upiId || '[ADMIN UPI ID]')}</span></div>
                       <div><strong>Payment Name:</strong> ${escHtml(upi.upiDisplayName || '[ADMIN DISPLAY NAME]')}</div>
                     </div>
                   </div>`
                : `<div style="padding:16px; border:1px dashed #000000; text-align:center; font-size:0.82rem; color:#000000;">
                     [ADMIN UPLOADED ORIGINAL QR CODE]<br>Upload your original UPI QR image on the left to preview it here.
                   </div>`}
              <div style="margin-top:8px; font-size:0.76rem; color:#000000; border-top:1px solid #000000; padding-top:6px;">
                Note: Payments are marked Paid only after verified UTR/Admin confirmation — never automatically on QR scan.
              </div>
            </div>
          </div>
        </div>
      `;
    })() : `
      <div class="card card-3d" style="padding:1.15rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
          <div>
            <h3 style="margin:0;">Active Staff &amp; Role Assignments</h3>
            <div style="font-size:0.78rem; color:var(--text-muted);">Staff members shown dynamically in Registration &amp; Follow-up dropdowns</div>
          </div>
          ${canAccessRoute('admin-staff', getCurrentUser()) ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('${canAccessRoute('admin-managers', getCurrentUser()) ? 'admin-managers' : 'admin-staff'}')">Open Administration →</button>` : ''}
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>UID</th><th>Name</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              ${getAllUsers().map(u => `
                <tr>
                  <td class="font-mono">${escHtml(u.uid || u.requestId || '-')}</td>
                  <td><strong>${escHtml(u.name || '-')}</strong></td>
                  <td><span class="badge badge-info">${escHtml(u.role || 'STAFF')}</span></td>
                  <td><span class="badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}">${escHtml(u.status || 'ACTIVE')}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `}
  `;
}

/* --- 6. Payments & Dues View --- */
function renderPaymentsView() {
  const curUser = getCurrentUser();
  const canAddPay = canMenu('payments', 'add', curUser);
  const canDelPay = canMenu('payments', 'delete', curUser);
  const canExportPay = canMenu('payments', 'export', curUser);
  const canPrintPay = canMenu('payments', 'print', curUser);

  const payments = getAllPayments();
  const duesReport = getCustomerDuesReport();
  const totalDuesSum = duesReport.reduce((sum, d) => sum + d.totalDue, 0);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">💰 Payments &amp; Ledger — Payment Management</h2>
        <p class="page-subtitle">Track collections, multiple partial payments, customer dues, and audit trails</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        ${canExportPay ? `
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportPaymentsPDF()" title="Download Payments PDF">📄 PDF</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportPaymentsExcel()" title="Download Payments Excel (.xlsx)">📊 Excel</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportPaymentsCSV()" title="Download Payments CSV">📥 CSV</button>
        ` : ''}
        ${canPrintPay ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printPaymentsReport()" title="Print Payments Ledger">🖨 Print</button>` : ''}
        ${canAddPay ? `<button type="button" class="btn btn-success btn-sm" onclick="window.MJK.openCashCollectionModal()">💰 + Cash Collection</button>` : ''}
        ${canAddPay ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openPaymentModal()">+ Record New Payment</button>` : ''}
      </div>
    </div>

    <!-- Outstanding Dues Section -->
    <div style="margin-bottom:2rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem;">
        <div>
          <h3 style="font-size:1.1rem; font-weight:700; margin:0;">
            Customer Due Balances (Total: <span class="tabular-nums" style="color:var(--danger);">${formatINR(totalDuesSum)}</span>)
          </h3>
          <div style="font-size:0.74rem; color:var(--text-muted); font-weight:600; margin-top:2px;">${escHtml(numberToWords(totalDuesSum))} · ${duesReport.length} clients with pending dues</div>
        </div>
        <div style="display:flex; gap:0.35rem; flex-wrap:wrap; align-items:center;">
          ${canExportPay ? `
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportOutstandingDuesPDF()" title="Download Outstanding Dues PDF">📄 Dues PDF</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportOutstandingDuesExcel()" title="Download Outstanding Dues Excel">📊 Dues Excel</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportOutstandingDuesCSV()" title="Download Outstanding Dues CSV">📥 Dues CSV</button>
          ` : ''}
          ${canPrintPay ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printOutstandingDuesReport()" title="Print Outstanding Dues Report">🖨 Print Dues</button>` : ''}
        </div>
      </div>

      <div class="table-card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Pending Services &amp; Invoices</th>
                <th>Total Balance Due</th>
                <th style="text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${duesReport.map(d => `
                <tr>
                  <td style="font-weight:600;">${d.customerName}</td>
                  <td class="tabular-nums">
                    <a href="tel:${d.phone}" style="color:var(--text-main);">📞 ${d.phone}</a>
                  </td>
                  <td>
                    ${d.pendingServices.map(ps => `
                      <div style="font-size:0.78rem;">
                        ${ps.serviceName} (<span class="tabular-nums" style="color:var(--danger); font-weight:600;">Due: ${formatINR(ps.due)}</span>)
                      </div>
                    `).join('')}
                  </td>
                  <td class="amount tabular-nums" style="font-weight:800; color:var(--danger); font-size:1rem;">
                    <div>${formatINR(d.totalDue)}</div>
                    <div style="font-size:0.69rem; font-weight:600; color:var(--text-muted);">${escHtml(numberToWords(d.totalDue))}</div>
                  </td>
                  <td style="text-align:right; white-space:nowrap;">
                    <div style="display:inline-flex; gap:0.3rem; align-items:center;">
                      ${canMenu('whatsapp-connect', 'view', curUser) ? renderWhatsAppQuickButton({
                        phone: d.phone,
                        customerName: d.customerName,
                        serviceName: d.pendingServices.map(ps => ps.serviceName).join(', '),
                        dueAmount: d.totalDue,
                        context: 'BILLING'
                      }, true) : ''}
                      ${canAddPay ? `
                        <button class="btn btn-success btn-sm" onclick="window.MJK.openCashCollectionModal('${escAttrJs(d.customerId)}')">
                          💰 Collect Due
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('') || `
                <tr>
                  <td colspan="5" style="text-align:center; padding:1.25rem; color:var(--success); font-weight:600;">
                    ✓ Zero Outstanding Dues! All customer accounts are fully paid up.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Transactions History Ledger -->
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
        <h3 style="font-size:1.1rem; font-weight:700;">Recorded Transactions Ledger (MUN COMPUTER)</h3>
        <span style="font-size:0.8rem; color:var(--text-muted);">${payments.length} audited transactions</span>
      </div>

      <div class="table-card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Receipt / Txn ID</th>
                <th>Customer</th>
                <th>Date &amp; Time</th>
                <th>Mode</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Remarks / Ref</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(p => {
                const isPendingVerif = p.verificationStatus === 'PENDING_VERIFICATION';
                const isRefunded = p.paymentStatus === 'Refunded';
                const stText = p.paymentStatus || (isPendingVerif ? 'Unpaid' : (Number(p.remainingDue) > 0 ? 'Partially Paid' : 'Paid'));
                const badgeCls = stText === 'Paid' ? 'badge-success' : (stText === 'Partially Paid' ? 'badge-warning' : (stText === 'Refunded' ? 'badge-neutral' : 'badge-danger'));
                return `
                  <tr>
                    <td>
                      <div class="code tabular-nums" style="font-weight:700; color:var(--blue-600);">${escHtml(p.id)}</div>
                      <div style="font-size:0.7rem; color:var(--text-muted);">${escHtml(p.transactionId || '-')}</div>
                    </td>
                    <td>
                      <div style="font-weight:600;">${escHtml(p.customerName)}</div>
                      ${p.customerId ? `<button type="button" class="btn btn-outline btn-sm" style="margin-top:2px; padding:1px 6px; font-size:0.68rem;" onclick="window.MJK.printCustomerStatement('${escAttrJs(p.customerId)}')">Statement</button>` : ''}
                    </td>
                    <td class="date tabular-nums">${p.paymentDateTime ? formatDateTime(p.paymentDateTime) : formatDate(p.paymentDate)}</td>
                    <td><span class="badge badge-neutral">${escHtml(p.paymentMethod)}</span></td>
                    <td class="amount tabular-nums" style="font-weight:800; color:var(--text-main); font-size:0.95rem;">
                      <div>${isRefunded ? `-${formatINR(p.refundAmount || p.paymentAmount)}` : `+${formatINR(p.paymentAmount)}`}</div>
                      <div style="font-size:0.68rem; font-weight:600; color:var(--text-muted);">${escHtml(numberToWords(p.paymentAmount))}</div>
                    </td>
                    <td>
                      <span class="badge ${badgeCls}">${escHtml(stText)}</span>
                      ${isPendingVerif ? `<div style="font-size:0.68rem; color:var(--danger); font-weight:700; margin-top:2px;">Awaiting UTR/Admin Check</div>` : ''}
                      ${Number(p.remainingDue) > 0 ? `<div style="font-size:0.68rem; color:var(--danger); margin-top:2px;">Bal: ${formatINR(p.remainingDue)}</div>` : ''}
                    </td>
                    <td style="font-size:0.78rem; color:var(--text-muted);">${escHtml(p.remarks || p.reference || '-')}</td>
                    <td style="text-align:right; white-space:nowrap;">
                      ${isPendingVerif && (curUser?.role === 'ADMIN' || canAddPay) ? `<button class="btn btn-primary btn-sm" onclick="window.MJK.openVerifyPaymentModal('${escAttrJs(p.id)}')">✓ Verify</button>` : ''}
                      ${!isRefunded && !isPendingVerif && (curUser?.role === 'ADMIN' || canAddPay) ? `<button class="btn btn-outline btn-sm" onclick="window.MJK.openRefundPaymentModal('${escAttrJs(p.id)}')">↩ Refund</button>` : ''}
                      ${canPrintPay ? `<button class="btn btn-secondary btn-sm" onclick="window.MJK.printPaymentReceipt('${escAttrJs(p.id)}')">🖨 ${isRefunded ? 'Refund Receipt' : 'Receipt'}</button>` : ''}
                      ${canDelPay ? `<button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeletePayment('${escAttrJs(p.id)}')">🗑</button>` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/* --- 7. Invoices & Billing View --- */
function renderInvoicesView() {
  const curUser = getCurrentUser();
  const canAddInv = canMenu('invoices', 'add', curUser);
  const canDelInv = canMenu('invoices', 'delete', curUser);
  const canExportInv = canMenu('invoices', 'export', curUser);
  const canPrintInv = canMenu('invoices', 'print', curUser);
  const invoices = getAllInvoices();

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">🧾 Billing &amp; Invoices Management</h2>
        <p class="page-subtitle">Generate official MUN COMPUTER bills, printable tax invoices, and track due balances</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        ${canExportInv ? `
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportInvoicesPDF()" title="Download Invoices PDF">📄 PDF</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportInvoicesExcel()" title="Download Invoices Excel (.xlsx)">📊 Excel</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportInvoicesCSV()" title="Download Invoices CSV">📥 CSV</button>
        ` : ''}
        ${canPrintInv ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printInvoicesReport()" title="Print Invoices Register">🖨 Print</button>` : ''}
        ${curUser?.role === 'ADMIN' ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openAdminUpiSettings()" title="Configure UPI QR & Payment Settings">📱 UPI QR Settings</button>` : ''}
        ${canMenu('payments', 'add', curUser) ? `<button type="button" class="btn btn-success btn-sm" onclick="window.MJK.openCashCollectionModal()">💰 + Cash Collection</button>` : ''}
        ${canAddInv ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openCreateInvoiceModal()">+ Generate New Invoice</button>` : ''}
      </div>
    </div>

    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Total Amount</th>
              <th>Paid / Due</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.map(inv => `
              <tr>
                <td class="code tabular-nums" style="font-weight:700; color:var(--blue-600);">
                  <div>${escHtml(inv.id)}</div>
                  <div style="font-size:0.7rem; font-weight:600; color:var(--text-muted);">${escHtml(inv.documentType || 'Service Invoice')}${(inv.items || []).length > 1 ? ` · ${inv.items.length} items` : ''}</div>
                </td>
                <td>
                  <div style="font-weight:600;">${inv.customerName}</div>
                  <div class="tabular-nums" style="font-size:0.72rem; color:var(--text-muted);">${inv.phone || '-'}</div>
                </td>
                <td class="date tabular-nums">${formatDate(inv.date)}</td>
                <td class="amount tabular-nums" style="font-weight:700;">
                  <div>${formatINR(inv.totalAmount)}</div>
                  <div style="font-size:0.68rem; color:var(--text-muted); font-weight:500;">${escHtml(numberToWords(inv.totalAmount))}</div>
                </td>
                <td class="tabular-nums" style="font-size:0.8rem;">
                  Paid: ${formatINR(inv.paidAmount)}
                  ${inv.balanceDue > 0 ? `<div style="color:var(--danger); font-weight:600;">Due: ${formatINR(inv.balanceDue)}</div>` : ''}
                </td>
                <td>
                  <span class="badge ${inv.status === 'Paid' ? 'badge-success' : inv.status === 'Partially Paid' ? 'badge-warning' : 'badge-danger'}">
                    ${inv.status}
                  </span>
                </td>
                <td style="text-align:right; white-space:nowrap;">
                  <div style="display:inline-flex; gap:0.3rem; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
                    ${canMenu('whatsapp-connect', 'view', curUser) ? `<button type="button" class="btn btn-sm whitespace-nowrap" style="background:#16a34a; color:#ffffff; border:1px solid #15803d; font-weight:700;" onclick="window.MJK.sendInvoiceToWhatsApp('${escAttrJs(inv.id)}')" title="Send Itemized Bill to WhatsApp">📲 WhatsApp</button>` : ''}
                    ${canPrintInv ? `<button type="button" class="btn btn-outline btn-sm whitespace-nowrap" onclick="window.MJK.printInvoiceThermal('${escAttrJs(inv.id)}')" title="80mm POS Thermal Receipt">🧾 POS Receipt</button>` : ''}
                    ${inv.balanceDue > 0 && canMenu('payments', 'add', curUser) ? `<button type="button" class="btn btn-success btn-sm whitespace-nowrap" onclick="window.MJK.openCashCollectionModal('${escAttrJs(inv.customerId || '')}', '${escAttrJs(inv.id)}')">💰 Collect</button>` : ''}
                    ${canPrintInv ? `<button type="button" class="btn btn-secondary btn-sm whitespace-nowrap" onclick="window.MJK.printInvoice('${escAttrJs(inv.id)}')">🖨 A4 / PDF</button>` : ''}
                    ${canDelInv ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteInvoice('${escAttrJs(inv.id)}')" title="Delete Invoice">🗑</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('') || `
              <tr>
                <td colspan="7">
                  <div class="empty-state">
                    <div class="empty-state-icon">🧾</div>
                    <div class="empty-state-title">No Invoices Generated</div>
                    <div class="empty-state-desc">Generate official MUN COMPUTER customer bills with custom line items and tax options.</div>
                    ${canAddInv ? `<button class="btn btn-primary btn-sm" onclick="window.MJK.openCreateInvoiceModal()">+ Create Invoice</button>` : ''}
                  </div>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* --- 8. Expenses View --- */
const EXPENSE_CATEGORY_ICONS = {
  'Shop Rent': '🏠',
  'Electricity': '⚡',
  'Internet': '🌐',
  'Staff Salary': '👥',
  'Printer Maintenance': '🖨️',
  'Computer Maintenance': '💻',
  'Stationery': '📝',
  'Transport': '🚚',
  'Marketing': '📢',
  'Software': '💿',
  'Office Equipment': '🪑',
  'Bank Charges': '🏦',
  'Business Investment': '💼',
  'Other Expenses': '📦'
};

function getExpenseCategoryIcon(cat) {
  return EXPENSE_CATEGORY_ICONS[cat] || '📉';
}

function renderExpensesView() {
  const curUser = getCurrentUser();
  const canAddExp = canMenu('expenses', 'add', curUser);
  const canEditExp = canMenu('expenses', 'edit', curUser);
  const canDelExp = canMenu('expenses', 'delete', curUser);
  const canExportExp = canMenu('expenses', 'export', curUser);
  const expenses = getAllExpenses();
  const summary = getExpenseCategorySummary();
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">📉 Expense Management (MUN COMPUTER)</h2>
        <p class="page-subtitle">Track shop rent, electricity, broadband, printer maintenance, ink, and staff salaries</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        ${canExportExp ? `
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportExpensesPDF()" title="Download Expenses PDF">📄 PDF</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportExpensesExcel()" title="Download Expenses Excel (.xlsx)">📊 Excel</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportExpensesCSV()" title="Download Expenses CSV">📥 CSV</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.printExpensesReport()" title="Print Expenses Register">🖨 Print</button>
        ` : ''}
        ${canAddExp ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openExpenseModal()">➕ Add New Expense</button>` : ''}
      </div>
    </div>

    <!-- Expense Category Chips -->
    <div style="background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:1.25rem; margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:flex-start; flex-wrap:wrap; gap:0.4rem;">
        <div>
          <h4 style="font-weight:700; font-size:0.95rem; margin:0;">📉 Expense Breakdown (Total: ${formatINR(totalExpenses)})</h4>
          <div class="amount-words-hint" style="color:var(--text-muted);">${escHtml(numberToWords(totalExpenses))}</div>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem;">
        ${Object.entries(summary).filter(([_, amt]) => amt > 0).map(([cat, amt]) => `
          <div style="background:var(--surface-alt); padding:0.6rem 0.8rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${getExpenseCategoryIcon(cat)} ${escHtml(cat)}</div>
            <div class="amount tabular-nums" style="font-weight:800; font-size:1.1rem; color:var(--text-main); margin-top:0.2rem;">${formatINR(amt)}</div>
            <div style="font-size:0.68rem; color:var(--text-muted); font-weight:500; margin-top:0.15rem;">${escHtml(numberToWords(amt))}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Category</th>
              <th>Title / Description</th>
              <th>Vendor / Paid To</th>
              <th>Payment Method</th>
              <th>Date</th>
              <th>Amount</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(e => `
              <tr>
                <td class="code tabular-nums" style="font-weight:700; color:var(--blue-600);">${e.id}</td>
                <td><span class="badge badge-neutral">${getExpenseCategoryIcon(e.category)} ${escHtml(e.category)}</span></td>
                <td style="font-weight:600;">${escHtml(e.title)}</td>
                <td style="font-size:0.8rem; color:var(--text-muted);">${escHtml(e.vendorName || '-')}</td>
                <td><span class="badge badge-neutral">${escHtml(e.paymentMethod)}</span></td>
                <td class="date tabular-nums">${formatDate(e.date)}</td>
                <td class="amount tabular-nums" style="font-weight:800; color:var(--danger); font-size:0.95rem;">
                  <div>-${formatINR(e.amount)}</div>
                  <div style="font-size:0.68rem; font-weight:500; color:var(--text-muted);">${escHtml(numberToWords(e.amount))}</div>
                </td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="btn btn-outline btn-sm" onclick="window.MJK.printExpenseVoucher('${escAttrJs(e.id)}')" title="Print Official Payment Voucher">🧾 Voucher</button>
                  ${canEditExp ? `<button class="btn btn-secondary btn-sm" onclick="window.MJK.editExpense('${escAttrJs(e.id)}')">✎</button>` : ''}
                  ${canDelExp ? `<button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteExpense('${escAttrJs(e.id)}')">🗑</button>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* --- 9. Income & Profit Management View --- */
function renderIncomeView() {
  const summary = generateFinancialSummary('all', AppState.dateFilter, AppState.customDateStart, AppState.customDateEnd);
  const services = getAllServices();

  // Category based revenue estimates (banking principal excluded; only earned commission counted)
  const incomeCats = {
    'Service Income': 0,
    'Printing Income': 0,
    'Xerox Income': 0,
    'PVC Card Income': 0,
    'Commission Income': 0,
    'Banking Commission': Number(summary.bankingCommission) || 0,
    'Other Income': 0
  };

  services.forEach(s => {
    const paid = Number(s.paidAmount) || 0;
    const cat = s.category || '';
    if (cat.includes('PVC')) incomeCats['PVC Card Income'] += paid;
    else if (cat.includes('Printing')) incomeCats['Printing Income'] += paid;
    else if (cat.includes('Xerox')) incomeCats['Xerox Income'] += paid;
    else if (cat.includes('Banking') || cat.includes('CSP')) incomeCats['Banking Commission'] += paid;
    else if (cat.includes('Government') || cat.includes('CSC')) incomeCats['Commission Income'] += paid;
    else if (cat.includes('Job') || cat.includes('Scholarship') || cat.includes('PAN') || cat.includes('Aadhaar')) incomeCats['Service Income'] += paid;
    else incomeCats['Other Income'] += paid;
  });

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">💹 Income &amp; Profit Management</h2>
        <p class="page-subtitle">Clear breakdown of service collections, earned banking commissions, expenses, and net operating profit (customer principal &amp; capital excluded)</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportIncomePDF()" title="Download Income Statement PDF">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportIncomeExcel()" title="Download Income Statement Excel (.xlsx)">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportIncomeCSV()" title="Download Income Statement CSV">📥 CSV</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openIncomeA4Popup()">🖨 Print A4 Statement</button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
      <div class="stat-card a4-avoid-break">
        <span class="stat-label">Total Billed Income</span>
        <div class="stat-value tabular-nums">${formatINR(summary.grossBilled, true)}</div>
        <div class="amount-words-hint" style="color:var(--text-muted);">${escHtml(numberToWords(summary.grossBilled))}</div>
        <div class="stat-footer">Gross Services &amp; Invoices Billed</div>
      </div>
      <div class="stat-card a4-avoid-break">
        <span class="stat-label">Total Operating Income</span>
        <div class="stat-value tabular-nums" style="color:var(--success);">${formatINR(summary.totalOperatingIncome ?? summary.collectedRevenue, true)}</div>
        <div class="amount-words-hint" style="color:var(--text-muted);">${escHtml(numberToWords(summary.totalOperatingIncome ?? summary.collectedRevenue))}</div>
        <div class="stat-footer">Collections (${formatINR(summary.collectedRevenue)}) + Banking Comm (${formatINR(summary.bankingCommission || 0)})</div>
      </div>
      <div class="stat-card a4-avoid-break">
        <span class="stat-label">Outstanding Dues</span>
        <div class="stat-value tabular-nums" style="color:var(--danger);">${formatINR(summary.totalDues, true)}</div>
        <div class="amount-words-hint" style="color:var(--text-muted);">${escHtml(numberToWords(summary.totalDues))}</div>
        <div class="stat-footer">Uncollected client balances</div>
      </div>
      <div class="stat-card a4-avoid-break">
        <span class="stat-label">Total Expenses</span>
        <div class="stat-value tabular-nums" style="color:var(--warning);">${formatINR(summary.totalExpenses, true)}</div>
        <div class="amount-words-hint" style="color:var(--text-muted);">${escHtml(numberToWords(summary.totalExpenses))}</div>
        <div class="stat-footer">Shop operational costs</div>
      </div>
      <div class="stat-card a4-avoid-break">
        <span class="stat-label">Net Profit / Loss</span>
        <div class="stat-value tabular-nums" style="color:${summary.netCashFlow >= 0 ? 'var(--blue-600)' : 'var(--danger)'};">
          ${formatINR(summary.netCashFlow, true)}
        </div>
        <div class="amount-words-hint" style="color:var(--text-muted);">${escHtml(numberToWords(summary.netCashFlow))}</div>
        <div class="stat-footer">Operating Income minus Expenses</div>
      </div>
    </div>

    <div class="list-card">
      <div class="list-header">
        <h3 class="list-title">Categorized Income Stream Analysis (MUN COMPUTER)</h3>
        <span class="badge badge-info">CSP Principal Volume (${formatINR(summary.bankingVolume || 0)}) Excluded</span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap:1rem;">
        ${Object.entries(incomeCats).map(([stream, amt]) => `
          <div style="background:var(--surface-alt); padding:0.85rem 1rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
            <div>
              <div style="font-weight:600; font-size:0.88rem;">${stream}</div>
              <div style="font-size:0.72rem; color:var(--text-muted);">Audited stream</div>
            </div>
            <div style="text-align:right;">
              <div class="amount tabular-nums" style="font-weight:800; font-size:1.1rem; color:var(--success);">
                ${formatINR(amt)}
              </div>
              <div style="font-size:0.67rem; color:var(--text-muted); font-weight:500;">${escHtml(numberToWords(amt))}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* --- 10. Business Profile View: International Corporate & Enterprise ERP Standard --- */

const CORPORATE_PROFILE_SECTIONS = {
  identity: `OFFICIAL BUSINESS NAME:
MUN COMPUTER & DIGITAL SERVICES

TAGLINE:
Your Trusted Hub for Digital Solutions, Financial Inclusion & Government Utility Services

BADGE:
Certified Enterprise Partner & Multi-Service Hub

FOUNDER & CHIEF ADMINISTRATOR:
Mamun Reja`,

  address: `HEAD OFFICE / HUB LOCATION:
MUN COMPUTER & DIGITAL SERVICES
Domkal, Murshidabad, West Bengal, Pin - 742303
(Counter Desk: Mamudpur Chowmatha More, Ward No. 16, Domkal Municipality, P.O. Juginda, P.S. Domkal, Dist. Murshidabad, WB)

OFFICIAL HELPLINE & WHATSAPP:
+91 8101352105

CORPORATE EMAIL:
muncomputer2019@gmail.com`,

  overview: `ABOUT US — MUN COMPUTER & DIGITAL SERVICES:
MUN COMPUTER is a premier digital service facilitation and financial inclusion center dedicated to bridging the gap between essential government, banking, and utility services and local citizens. Operating as an authorized hub for CSC e-Governance, PNB Banking Correspondent (BC) operations, and LPG Gas service distribution, we combine modern enterprise technology with transparent, rapid counter execution.`,

  verticals: `CORE BUSINESS VERTICALS:
1. Financial Inclusion & Banking: PNB BC Point, AEPS, Micro-ATM, Money Transfer, Account Opening.
2. Government & Social Schemes: PAN, Aadhaar Services, Ration, Caste/Income Certificates, Annapurna Case Desk.
3. LPG & Energy Services: Indane/HP/Bharatgas Refill Booking, New Connections, Subsidy & KYC.
4. Retail & Enterprise Billing: POS Invoicing, PVC Card Printing, Inventory & Stock Management.
5. Marketing & Growth Analytics: Lead Pipeline, Customer Referrals, Performance Reporting.`,

  governance: `STAFF RBAC & AUDIT COMPLIANCE:
Multi-tier Role-Based Access Control (RBAC) separating Administration (MC-ADM-14012025), Manager, and Counter Operator roles with Argon2id security and immutable audit logging.`,

  executive_card: `MUN COMPUTER & DIGITAL SERVICES
Your Trusted Hub for Digital Solutions, Financial Inclusion & Government Utility Services
Certified Enterprise Partner & Multi-Service Hub

Head Office / Hub: Domkal, Murshidabad, West Bengal, Pin - 742303
Authorized Divisions: CSC e-Governance · PNB Banking Correspondent (BC) · LPG Gas Distribution
Helpline & WhatsApp Support: +91 8101352105 | Email: muncomputer2019@gmail.com
Proprietor & Chief Administrator: Mamun Reja`
};

function renderBusinessView() {
  const profile = getBusinessProfile() || {};
  const displayPhone = profile.phone || '+91 8101352105';
  const displayEmail = profile.email || 'muncomputer2019@gmail.com';
  const waSupportUrl = buildWhatsAppUrl(displayPhone, 'নমস্কার MUN COMPUTER & DIGITAL SERVICES, আমার একটি পরিষেবা সংক্রান্ত সহায়তা প্রয়োজন।');

  const coreVerticals = [
    {
      num: '01',
      icon: 'landmark',
      title: 'Financial Inclusion & Banking',
      accent: '#2563eb',
      services: ['PNB BC Point', 'AEPS Cash Withdrawal', 'Micro-ATM', 'Domestic Money Transfer', 'Account Opening']
    },
    {
      num: '02',
      icon: 'file-check',
      title: 'Government & Social Schemes',
      accent: '#0d9488',
      services: ['PAN Card Services', 'Aadhaar Facilitation', 'Ration Card Desk', 'Caste & Income Certificates', 'Annapurna Case Desk']
    },
    {
      num: '03',
      icon: 'flame',
      title: 'LPG & Energy Services',
      accent: '#ea580c',
      services: ['Indane / HP / Bharatgas Refill', 'New Gas Connections', 'DBT Subsidy Tracking', 'e-KYC & Safety Inspection', 'Accessories & Regulators']
    },
    {
      num: '04',
      icon: 'printer',
      title: 'Retail & Enterprise Billing',
      accent: '#7c3aed',
      services: ['80mm Thermal POS Billing', 'GST & Non-GST Invoices', 'HD PVC Smart Card Printing', 'Inventory & Barcode SKUs', 'Lamination & Documentation']
    },
    {
      num: '05',
      icon: 'trending-up',
      title: 'Marketing & Growth Analytics',
      accent: '#0284c7',
      services: ['Searchable Lead Pipeline', 'Verified Referral Passes', 'Campaign ROI Tracking', '90-Day Customer Follow-Ups', 'Executive Performance Reports']
    }
  ];

  const complianceItems = [
    { label: 'Proprietor & Chief Administrator', value: 'Mamun Reja' },
    { label: 'Access Governance', value: 'Multi-Tier Role-Based Access Control (Admin / Manager / Staff)' },
    { label: 'Audit Security', value: 'Immutable Chronological Audit Trail & Mandatory Deletion Reason' },
    { label: 'Trade License', value: profile.tradeLicense || 'Registered WB Municipal Establishment' },
    { label: 'GSTIN', value: profile.gstin || 'Configured in Billing Settings' },
    { label: 'Operating Hours', value: profile.openingHours || '08:00 AM – 09:30 PM (7 Days a Week)' }
  ];

  return `
    <!-- 1. Corporate Header & Overview Card -->
    <div style="background:linear-gradient(135deg, #0b1530 0%, #152b5e 58%, #1e40af 100%); color:#ffffff; border-radius:var(--radius-lg); padding:clamp(1.35rem, 3vw, 2.15rem); margin-bottom:1.5rem; box-shadow:var(--shadow-lg); position:relative; overflow:hidden;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1.25rem;">
        <div style="display:flex; align-items:flex-start; gap:1.1rem; flex:1 1 420px; flex-wrap:wrap;">
          <div style="width:92px; height:64px; border-radius:10px; background:#ffffff; border:1.5px solid #d6b56d; padding:6px 10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <img src="/assets/aistudio/MUN_Computer_Tech_Logo_35ee99e8.png" alt="MUN COMPUTER" style="max-width:100%; max-height:100%; object-fit:contain;" />
          </div>
          <div style="min-width:0; flex:1 1 280px;">
            <div style="display:inline-flex; align-items:center; gap:0.45rem; background:rgba(214,181,109,0.16); border:1px solid rgba(214,181,109,0.55); color:#f6df9d; padding:0.25rem 0.75rem; border-radius:6px; font-size:0.74rem; font-weight:800; letter-spacing:0.04em; text-transform:uppercase; margin-bottom:0.65rem;">
              ${getLucideIcon('shield-check', 14)}
              <span>Certified Enterprise Partner &amp; Multi-Service Hub</span>
            </div>
            <h1 class="business-hero-title" style="font-weight:800; letter-spacing:-0.02em; margin:0 0 0.4rem 0; color:#ffffff; font-size:clamp(1.35rem, 2.6vw, 1.95rem); line-height:1.2;">
              MUN COMPUTER &amp; DIGITAL SERVICES
            </h1>
            <p style="font-size:0.96rem; font-weight:600; color:#bfdbfe; margin:0; line-height:1.45; max-width:720px;">
              Your Trusted Hub for Digital Solutions, Financial Inclusion &amp; Government Utility Services
            </p>
          </div>
        </div>

        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
          <button type="button" class="btn btn-primary btn-sm whitespace-nowrap" style="background:#2563eb; border-color:#60a5fa; font-weight:700;" onclick="window.MJK.copyCorporateSection('all')">
            📋 Copy Corporate Profile
          </button>
          <button type="button" class="btn btn-secondary btn-sm whitespace-nowrap" style="background:rgba(255,255,255,0.12); color:#ffffff; border-color:rgba(255,255,255,0.28);" onclick="window.MJK.openEditProfileModal()">
            ✎ Edit Profile
          </button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 190px), 1fr)); gap:0.75rem; margin-top:1.5rem; padding-top:1.25rem; border-top:1px solid rgba(255,255,255,0.14);">
        <div style="background:rgba(255,255,255,0.07); padding:0.65rem 0.9rem; border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; color:#93c5fd; font-weight:700;">HEAD OFFICE / HUB</div>
          <div style="font-size:0.86rem; font-weight:700; color:#ffffff; margin-top:0.15rem;">Domkal, Murshidabad, WB - 742303</div>
        </div>
        <div style="background:rgba(255,255,255,0.07); padding:0.65rem 0.9rem; border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; color:#93c5fd; font-weight:700;">AUTHORIZED AUTHORITIES</div>
          <div style="font-size:0.86rem; font-weight:700; color:#ffffff; margin-top:0.15rem;">CSC e-Gov · PNB BC Point · LPG Hub</div>
        </div>
        <div style="background:rgba(255,255,255,0.07); padding:0.65rem 0.9rem; border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; color:#93c5fd; font-weight:700;">HELPLINE &amp; WHATSAPP</div>
          <div class="font-mono tabular-nums" style="font-size:0.88rem; font-weight:700; color:#ffffff; margin-top:0.15rem;">${escHtml(displayPhone)}</div>
        </div>
        <div style="background:rgba(255,255,255,0.07); padding:0.65rem 0.9rem; border-radius:var(--radius-md); border:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.05em; color:#93c5fd; font-weight:700;">CHIEF ADMINISTRATOR</div>
          <div style="font-size:0.86rem; font-weight:700; color:#ffffff; margin-top:0.15rem;">Mamun Reja</div>
        </div>
      </div>
    </div>

    <!-- 2. Professional About Us Section -->
    <div class="list-card" style="margin-bottom:1.5rem;">
      <div class="list-header" style="margin-bottom:0.85rem;">
        <div style="display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
          <span class="badge badge-info" style="font-weight:800;">ABOUT US</span>
          <h3 class="list-title" style="margin:0;">Enterprise Mission &amp; Service Commitment</h3>
        </div>
        <button type="button" class="btn btn-secondary btn-sm whitespace-nowrap" onclick="window.MJK.copyCorporateSection('overview')">📋 Copy About Us</button>
      </div>
      <div style="padding:1.15rem 1.25rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); font-size:0.92rem; line-height:1.72; color:var(--text-main);">
        <strong>MUN COMPUTER</strong> is a premier digital service facilitation and financial inclusion center dedicated to bridging the gap between essential government, banking, and utility services and local citizens. Operating as an authorized hub for CSC e-Governance, PNB Banking Correspondent (BC) operations, and LPG Gas service distribution, we combine modern enterprise technology with transparent, rapid counter execution.
      </div>
    </div>

    <!-- 3. Core Business Verticals (5 Structured Service Blocks) -->
    <div class="list-card" style="margin-bottom:1.5rem;">
      <div class="list-header" style="margin-bottom:1rem;">
        <div style="display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
          <span class="badge badge-info" style="font-weight:800;">5 VERTICALS</span>
          <h3 class="list-title" style="margin:0;">Core Business Verticals</h3>
        </div>
        <button type="button" class="btn btn-secondary btn-sm whitespace-nowrap" onclick="window.MJK.copyCorporateSection('verticals')">📋 Copy Verticals</button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap:1rem;">
        ${coreVerticals.map(v => `
          <div style="padding:1.05rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); display:flex; flex-direction:column; gap:0.6rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display:inline-flex; align-items:center; gap:0.45rem; color:${v.accent}; font-weight:800; font-size:0.78rem;">
                ${getLucideIcon(v.icon, 16)}
                <span>VERTICAL ${v.num}</span>
              </div>
              <span class="badge badge-neutral" style="font-size:0.68rem;">${v.services.length} Services</span>
            </div>
            <h4 style="margin:0; font-size:0.96rem; font-weight:800; color:var(--text-main);">${escHtml(v.title)}</h4>
            <div style="display:flex; flex-direction:column; gap:0.32rem; font-size:0.79rem; color:var(--text-muted);">
              ${v.services.map(s => `<div style="display:flex; align-items:center; gap:0.4rem;"><span style="color:${v.accent}; font-weight:900;">✓</span><span>${escHtml(s)}</span></div>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 4. Governance, RBAC & Official Hub Footer Contact Card -->
    <div class="erp-grid-2" style="margin-bottom:1.25rem;">
      <div class="list-card">
        <div class="list-header" style="margin-bottom:0.9rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span class="badge badge-info" style="font-weight:800;">GOVERNANCE</span>
            <h3 class="list-title" style="margin:0;">Administration, RBAC &amp; Audit Control</h3>
          </div>
          <button type="button" class="btn btn-secondary btn-sm whitespace-nowrap" onclick="window.MJK.copyCorporateSection('governance')">📋 Copy</button>
        </div>
        <div style="display:grid; gap:0.65rem; font-size:0.82rem;">
          ${complianceItems.map(item => `
            <div style="padding:0.65rem 0.8rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); display:flex; justify-content:space-between; gap:0.75rem; flex-wrap:wrap;">
              <span style="color:var(--text-muted); font-weight:600;">${escHtml(item.label)}</span>
              <span style="color:var(--text-main); font-weight:700; text-align:right;">${escHtml(item.value)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="list-card" style="display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div class="list-header" style="margin-bottom:0.9rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span class="badge badge-success" style="font-weight:800;">HEAD OFFICE</span>
              <h3 class="list-title" style="margin:0;">Official Hub Location &amp; Support Desk</h3>
            </div>
            <button type="button" class="btn btn-secondary btn-sm whitespace-nowrap" onclick="window.MJK.copyCorporateSection('address')">📋 Copy</button>
          </div>

          <div style="padding:0.9rem 1rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:0.85rem;">
            <div style="font-size:0.7rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.25rem;">Registered Hub Address</div>
            <div style="font-size:0.95rem; font-weight:800; color:var(--blue-600); line-height:1.45;">
              Domkal, Murshidabad, West Bengal, Pin - 742303
            </div>
            <div style="font-size:0.79rem; color:var(--text-muted); margin-top:0.25rem;">
              Counter Desk: Mamudpur Chowmatha More, Ward No. 16, Domkal Municipality, P.O. Juginda, P.S. Domkal
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:0.75rem; margin-bottom:1rem;">
            <div style="padding:0.7rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-sm);">
              <div style="font-size:0.68rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Official Mobile</div>
              <div class="font-mono tabular-nums" style="font-weight:800; font-size:0.92rem; color:var(--text-main); margin-top:0.15rem;">${escHtml(displayPhone)}</div>
            </div>
            <div style="padding:0.7rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-sm);">
              <div style="font-size:0.68rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Corporate Email</div>
              <div style="font-weight:700; font-size:0.82rem; color:var(--text-main); margin-top:0.15rem; word-break:break-all;">${escHtml(displayEmail)}</div>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:0.55rem; flex-wrap:wrap; align-items:center; padding-top:0.75rem; border-top:1px solid var(--border-subtle);">
          ${waSupportUrl ? `
            <a href="${escHtml(waSupportUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm whitespace-nowrap" style="background:#16a34a; color:#ffffff; border:1px solid #15803d; font-weight:700; text-decoration:none;">
              📲 Official WhatsApp Helpdesk
            </a>
          ` : ''}
          <button type="button" class="btn btn-outline btn-sm whitespace-nowrap" onclick="window.MJK.openWhatsAppConnectModal({ phone: '${escAttrJs(displayPhone)}', customerName: 'MUN COMPUTER Helpdesk', context: 'GENERAL' })">
            💬 Open WhatsApp Dispatch
          </button>
          <button type="button" class="btn btn-primary btn-sm whitespace-nowrap" onclick="window.MJK.copyCorporateSection('executive_card')">
            📋 Copy Executive Summary
          </button>
        </div>
      </div>
    </div>
  `;
}

/* --- 11. Business Targets View --- */
function renderTargetsView() {
  const targets = getAllTargets();

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Business Target Management</h2>
        <p class="page-subtitle">Calculated automatically from actual MUN COMPUTER transaction records</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('targets', 'pdf')">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('targets', 'excel')">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('targets', 'csv')">📥 CSV</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('targets', 'print')">🖨 Print</button>
        <button class="btn btn-primary btn-sm" onclick="window.MJK.openTargetModal()">+ Set New Target</button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 270px), 1fr)); gap:1.25rem;">
      ${targets.map(t => {
        const statusBadge = t.status === 'Achieved' ? 'badge-success' : t.status === 'Missed' ? 'badge-danger' : 'badge-info';
        return `
          <div class="stat-card" style="min-height:200px;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                <span class="badge ${statusBadge}">${t.status}</span>
                <span class="badge badge-neutral">${t.targetPeriod}</span>
              </div>
              <h4 style="font-size:1.05rem; font-weight:700; margin-bottom:0.25rem;">${t.name}</h4>
              <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:1rem;">${t.description}</p>
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-bottom:0.35rem;">
                <span style="font-weight:600;">Actual: ${t.category.includes('Revenue') || t.category.includes('Profit') ? formatINR(t.actualValue) : t.actualValue}</span>
                <span class="tabular-nums" style="color:var(--text-muted);">Goal: ${t.category.includes('Revenue') || t.category.includes('Profit') ? formatINR(t.targetAmount) : t.targetQuantity}</span>
              </div>
              <div style="width:100%; background:var(--surface-alt); height:10px; border-radius:999px; overflow:hidden; margin-bottom:0.75rem;">
                <div style="width:${t.percentage}%; background:${t.percentage >= 100 ? 'var(--success)' : 'var(--blue-600)'}; height:100%;"></div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted);">
                <span>Assigned: ${t.responsiblePerson}</span>
                <span style="font-weight:700; color:var(--text-main);">${t.percentage}% Achieved</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* --- 12. Projects & Planning View --- */
function renderProjectsView() {
  const projects = getAllProjects();

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">New Business and Project Management</h2>
        <p class="page-subtitle">Track project ventures: PVC Printing Expansion, Cyber Exam Hub, RO Plant, and Machinery</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('projects', 'pdf')">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('projects', 'excel')">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('projects', 'csv')">📥 CSV</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('projects', 'print')">🖨 Print</button>
        <button class="btn btn-primary btn-sm" onclick="window.MJK.openProjectModal()">+ Add New Project</button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 270px), 1fr)); gap:1.25rem;">
      ${projects.map(p => `
        <div class="list-card">
          <div class="list-header">
            <div>
              <span class="badge badge-info" style="margin-bottom:0.25rem;">${p.stage}</span>
              <h3 class="list-title" style="font-size:1.1rem; margin-top:0.2rem;">${p.name}</h3>
            </div>
            <span class="badge badge-neutral">${p.category}</span>
          </div>

          <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:1rem;">
            ${p.description}
          </p>

          <div class="erp-grid-2-tight" style="background:var(--surface-alt); padding:0.85rem; border-radius:var(--radius-md); margin-bottom:1rem; gap:0.5rem; font-size:0.8rem;">
            <div>
              <div style="color:var(--text-muted);">Required Investment:</div>
              <div class="amount tabular-nums" style="font-weight:700;">${formatINR(p.requiredInvestment)}</div>
            </div>
            <div>
              <div style="color:var(--text-muted);">Expected Monthly Profit:</div>
              <div class="amount tabular-nums" style="font-weight:700; color:var(--success);">${formatINR(p.expectedProfit)}</div>
            </div>
          </div>

          <div style="font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
            <span>Deadline: ${formatDate(p.deadline)}</span>
            <span>Lead: ${p.responsiblePerson}</span>
          </div>

          <div style="margin-top:1rem; display:flex; justify-content:flex-end; gap:0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="window.MJK.editProject('${p.id}')">✎ Edit Details</button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteProject('${p.id}')">🗑</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/* --- 13. Investment Management View --- */
function renderInvestmentsView() {
  const investments = getAllInvestments();
  const totalInvested = investments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Investment Management (MUN COMPUTER)</h2>
        <p class="page-subtitle">Track capital allocation, funding sources, partner equity, loans, and subsidies</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('investments', 'pdf')">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('investments', 'excel')">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('investments', 'csv')">📥 CSV</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('investments', 'print')">🖨 Print</button>
        <button class="btn btn-primary btn-sm" onclick="window.MJK.openInvestmentModal()">+ Add Investment</button>
      </div>
    </div>

    <div class="table-card">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <span style="font-weight:700;">Total Capital Registered: <span class="tabular-nums" style="color:var(--blue-600);">${formatINR(totalInvested)}</span></span>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Project / Asset</th>
              <th>Date</th>
              <th>Source & Funding Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Remarks</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${investments.map(inv => `
              <tr>
                <td class="code tabular-nums" style="font-weight:700;">${inv.id}</td>
                <td style="font-weight:600;">${inv.projectName}</td>
                <td class="date tabular-nums">${formatDate(inv.investmentDate)}</td>
                <td>
                  <div>${inv.source}</div>
                  <div style="font-size:0.72rem; color:var(--text-muted);">${inv.fundingType}</div>
                </td>
                <td class="amount tabular-nums" style="font-weight:800; color:var(--blue-600); font-size:0.95rem;">
                  ${formatINR(inv.amount)}
                </td>
                <td><span class="badge badge-success">${inv.status}</span></td>
                <td style="font-size:0.75rem; color:var(--text-muted);">${inv.remarks || '-'}</td>
                <td style="text-align:right;">
                  <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteInvestment('${inv.id}')">🗑</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* --- 14. Marketing Management View --- */
function renderMarketingView() {
  const campaigns = getAllCampaigns();
  const totalSpent = campaigns.reduce((sum, c) => sum + (Number(c.spent) || 0), 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + (Number(c.leads) || 0), 0);
  const totalConverted = campaigns.reduce((sum, c) => sum + (Number(c.converted) || 0), 0);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Marketing Management & Campaigns</h2>
        <p class="page-subtitle">WhatsApp promotions, village market flex banners, customer outreach, and ROI</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('marketing', 'pdf')">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('marketing', 'excel')">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('marketing', 'csv')">📥 CSV</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('marketing', 'print')">🖨 Print</button>
        <button class="btn btn-primary btn-sm" onclick="window.MJK.openMarketingModal()">+ Launch Campaign</button>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="stat-grid" style="margin-bottom:1.5rem;">
      <div class="stat-card">
        <span class="stat-label">Total Marketing Spent</span>
        <div class="stat-value tabular-nums">${formatINR(totalSpent)}</div>
        <div class="stat-footer">Banners, SMS, WhatsApp</div>
      </div>
      <div class="stat-card">
        <span class="stat-label">Total Leads Generated</span>
        <div class="stat-value tabular-nums">${totalLeads}</div>
        <div class="stat-footer">Inquiries & Footfall</div>
      </div>
      <div class="stat-card">
        <span class="stat-label">Clients Converted</span>
        <div class="stat-value tabular-nums" style="color:var(--success);">${totalConverted}</div>
        <div class="stat-footer">
          <span class="stat-badge positive">${totalLeads > 0 ? Math.round((totalConverted/totalLeads)*100) : 0}% Conversion</span>
        </div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Campaign Name</th>
              <th>Type</th>
              <th>Duration</th>
              <th>Budget / Spent</th>
              <th>Leads</th>
              <th>Converted</th>
              <th>Results / ROI</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${campaigns.map(c => `
              <tr>
                <td>
                  <div style="font-weight:700;">${c.name}</div>
                  <div style="font-size:0.72rem; color:var(--text-muted);">${c.id}</div>
                </td>
                <td><span class="badge badge-info">${c.type}</span></td>
                <td class="date tabular-nums" style="font-size:0.78rem;">${formatDate(c.startDate)} to ${formatDate(c.endDate)}</td>
                <td class="tabular-nums">
                  <div>Spent: <strong>${formatINR(c.spent)}</strong></div>
                  <div style="font-size:0.72rem; color:var(--text-muted);">Budget: ${formatINR(c.budget)}</div>
                </td>
                <td class="tabular-nums" style="font-weight:600;">${c.leads}</td>
                <td class="tabular-nums" style="font-weight:700; color:var(--success);">${c.converted}</td>
                <td>
                  <div style="font-size:0.8rem;">${c.results || 'Active campaign'}</div>
                  <div style="font-size:0.72rem; color:var(--blue-600); font-weight:600;">Est. ROI: +${c.roi || 250}%</div>
                </td>
                <td style="text-align:right;">
                  <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteMarketing('${c.id}')">🗑</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* --- 15. Competitor & Market Analysis View --- */
function renderCompetitorsView() {
  const competitors = getItem(KEYS.COMPETITORS, []);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Competitor and Market Analysis</h2>
        <p class="page-subtitle">Analyze nearby centers, price benchmarks, and MUN COMPUTER competitive advantages</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('competitors', 'pdf')">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('competitors', 'excel')">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('competitors', 'csv')">📥 CSV</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('competitors', 'print')">🖨 Print</button>
        <button class="btn btn-primary btn-sm" onclick="window.MJK.openCompetitorModal()">+ Add Competitor Entry</button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 270px), 1fr)); gap:1.25rem;">
      ${competitors.map(c => `
        <div class="list-card">
          <div class="list-header">
            <div>
              <h3 class="list-title" style="font-size:1.1rem;">${c.name}</h3>
              <div style="font-size:0.75rem; color:var(--text-muted);">${c.location}</div>
            </div>
            <span class="badge badge-neutral">${c.category}</span>
          </div>

          <div style="font-size:0.82rem; margin-bottom:0.75rem;">
            <div><strong>Main Services:</strong> ${c.services || c.mainServices}</div>
            <div><strong>Pricing:</strong> ${c.priceRange}</div>
          </div>

          <div style="background:var(--surface-alt); padding:0.75rem; border-radius:var(--radius-md); font-size:0.78rem; margin-bottom:0.75rem;">
            <div style="color:var(--danger); margin-bottom:0.25rem;"><strong>Weaknesses:</strong> ${c.weaknesses}</div>
            <div style="color:var(--success);"><strong>MUN COMPUTER Strategy:</strong> ${c.strategy}</div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.72rem; color:var(--text-muted);">
            <span>Survey Date: ${formatDate(c.researchDate)}</span>
            <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteCompetitor('${c.id}')">🗑</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/* --- 16. Staff & Task Management View --- */
function renderTasksView() {
  const tasks = getItem(KEYS.TASKS, []);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Staff and Task Management</h2>
        <p class="page-subtitle">Daily counter assignments, PVC batch print tasks, and banking journal reconciliation</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('tasks', 'pdf')">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('tasks', 'excel')">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('tasks', 'csv')">📥 CSV</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('tasks', 'print')">🖨 Print</button>
        <button class="btn btn-primary btn-sm" onclick="window.MJK.openTaskModal()">+ Assign New Task</button>
      </div>
    </div>

    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Task Title</th>
              <th>Assigned To</th>
              <th>Priority</th>
              <th>Deadline</th>
              <th>Status</th>
              <th>Instructions / Notes</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(t => `
              <tr>
                <td style="font-weight:700;">${t.title}</td>
                <td>${t.assignedName || t.assignedTo}</td>
                <td>
                  <span class="badge ${t.priority === 'High' ? 'badge-danger' : 'badge-warning'}">${t.priority}</span>
                </td>
                <td class="date tabular-nums">${formatDate(t.deadline)}</td>
                <td>
                  <span class="badge ${t.status === 'Completed' ? 'badge-success' : 'badge-neutral'}">${t.status}</span>
                </td>
                <td style="font-size:0.78rem; color:var(--text-muted);">${t.notes || '-'}</td>
                <td style="text-align:right;">
                  <button class="btn btn-success btn-sm" onclick="window.MJK.toggleTaskStatus('${t.id}')">✓ ${t.status === 'Completed' ? 'Reopen' : 'Complete'}</button>
                  <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteTask('${t.id}')">🗑</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* --- 17. Document Management Vault --- */
function renderDocumentsView() {
  const curUser = getCurrentUser();
  const canAddDoc = canMenu('documents', 'add', curUser);
  const canDelDoc = canMenu('documents', 'delete', curUser);
  const documents = getItem(KEYS.DOCUMENTS, []);

  return `
    <div class="page-header">
      <div>
        <h2 class="page-title">Document Management Vault</h2>
        <p class="page-subtitle">Secure repository for MUN COMPUTER Trade License, PNB Sanction, and Government approvals</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('documents', 'pdf')">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('documents', 'excel')">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('documents', 'csv')">📥 CSV</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('documents', 'print')">🖨 Print</button>
        ${canAddDoc ? `
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openRealDocumentUploadModal()">☁️ Upload File</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openDocumentModal()">+ Register Document</button>
        ` : ''}
      </div>
    </div>

    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Document Name</th>
              <th>Category</th>
              <th>Upload Date</th>
              <th>Expiry Date</th>
              <th>Status</th>
              <th>Remarks</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${documents.map(d => {
              const isExpiring = d.expiryDate && new Date(d.expiryDate) < new Date(Date.now() + 60*24*60*60*1000);
              return `
                <tr>
                  <td>
                    <div style="font-weight:700;">📄 ${d.name}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${d.id} · ${d.file || 'Stored'}</div>
                  </td>
                  <td><span class="badge badge-info">${d.category}</span></td>
                  <td class="date tabular-nums">${formatDate(d.uploadDate)}</td>
                  <td class="date tabular-nums" style="${isExpiring ? 'color:var(--danger); font-weight:bold;' : ''}">
                    ${formatDate(d.expiryDate)} ${isExpiring ? '⚠ Renew Soon' : ''}
                  </td>
                  <td><span class="badge badge-success">Verified</span></td>
                  <td style="font-size:0.78rem; color:var(--text-muted);">${d.remarks || '-'}</td>
                  <td style="text-align:right; display:flex; gap:0.35rem; justify-content:flex-end;">
                    ${d.downloadUrl ? `<a class="btn btn-outline btn-sm" href="${d.downloadUrl}" download>⬇ Download</a>` : ''}
                    ${canDelDoc ? `<button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.promptDeleteDocument('${d.id}')">🗑</button>` : ''}
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

/* --- 18. Centralized Reports View (Master All-Sector ERP Reports) --- */
function renderReportsView() {
  if (!AppState.reportsHydrated) {
    AppState.reportsHydrated = true;
    Promise.allSettled([
      syncDaybookFromServer(),
      syncAttendanceRecordsFromServer()
    ]).then(() => {
      if (AppState.currentRoute === 'reports') {
        render();
      }
    });
  }

  const allowedTabs = ['financial', 'customer-service', 'staff-operations', 'growth-followups'];
  const activeTab = allowedTabs.includes(AppState.reportTab) ? AppState.reportTab : 'financial';
  const summary = generateFinancialSummary('all', AppState.dateFilter, AppState.customDateStart, AppState.customDateEnd);
  const range = summary.dateRange || getFilteredDateRange(AppState.dateFilter, AppState.customDateStart, AppState.customDateEnd);

  const periodOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'quarter', label: 'Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom Date Range' },
    { value: 'all', label: 'All Time' }
  ];

  const q = String(AppState.reportSearchQuery || '').trim().toLowerCase();
  const statusF = String(AppState.reportStatusFilter || 'all').toLowerCase();
  const catF = String(AppState.reportCategoryFilter || 'all').toLowerCase();
  const matchesQuery = (fields) => !q || fields.some(f => String(f || '').toLowerCase().includes(q));
  const matchesStatus = (val) => statusF === 'all' || String(val || '').toLowerCase() === statusF;
  const matchesCat = (val) => catF === 'all' || String(val || '').toLowerCase().includes(catF);

  const allServicesRaw = getAllServices();
  const allExpensesRaw = getAllExpenses();
  const allBankingRaw = getAllBankingTransactions();
  const dynamicCategories = Array.from(new Set([
    ...allServicesRaw.map(s => s.category),
    ...allExpensesRaw.map(e => e.category),
    ...allBankingRaw.map(b => b.type),
    'Cash', 'UPI', 'Bank Transfer'
  ].filter(Boolean))).sort();

  const statusFilterOptions = [
    'Paid', 'Partially Paid', 'Pending', 'Processing', 'Completed',
    'Approved', 'Success', 'Failed', 'Rejected', 'Cancelled', 'Present', 'Overdue'
  ];

  let tabBodyHtml = '';

  if (activeTab === 'financial') {
    const allPayments = getAllPayments();
    const allInvoices = getAllInvoices();
    const allCounterTxns = getAllCounterCashTxns();

    const periodExpenses = allExpensesRaw.filter(e =>
      e.date >= range.start && e.date <= range.end &&
      matchesQuery([e.id, e.title, e.category, e.vendorName, e.paymentMethod, e.remarks]) &&
      matchesCat(e.category || e.paymentMethod)
    );
    const periodPayments = allPayments.filter(p =>
      p.paymentDate >= range.start && p.paymentDate <= range.end &&
      matchesQuery([p.id, p.customerName, p.customerPhone, p.paymentMethod, p.transactionId, p.invoiceId]) &&
      matchesStatus(p.paymentStatus || 'Paid') &&
      matchesCat(p.paymentMethod)
    );
    const periodInvoices = allInvoices.filter(inv =>
      inv.date >= range.start && inv.date <= range.end &&
      matchesQuery([inv.id, inv.customerName, inv.phone, inv.status]) &&
      matchesStatus(inv.status || 'Pending')
    );
    const periodCounterTxns = allCounterTxns.filter(t =>
      t.date >= range.start && t.date <= range.end &&
      matchesQuery([t.id, t.partyName, t.type, t.paymentMode, t.notes]) &&
      matchesCat(t.paymentMode || t.type)
    );

    const counterCashIn = periodCounterTxns
      .filter(t => t.type === 'CASH_RECEIVED' || t.type === 'CASH_WITHDRAWAL')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const counterCashOut = periodCounterTxns
      .filter(t => t.type === 'CASH_PAYMENT' || t.type === 'CASH_DEPOSIT')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totalCashInflow = (summary.totalOperatingIncome ?? summary.collectedRevenue) + counterCashIn;
    const totalCashOutflow = summary.totalExpenses + counterCashOut;

    const expenseCatTotals = {};
    periodExpenses.forEach(e => {
      const cat = e.category || 'General Expense';
      expenseCatTotals[cat] = (expenseCatTotals[cat] || 0) + (Number(e.amount) || 0);
    });

    // Separate Cash / UPI / Bank Mode Breakdown for selected period (#28 UPI & Bank Report)
    const modeStats = {
      Cash: { inAmt: 0, outAmt: 0, count: 0 },
      UPI: { inAmt: 0, outAmt: 0, count: 0 },
      Bank: { inAmt: 0, outAmt: 0, count: 0 }
    };
    const bucketMode = (m) => {
      const s = String(m || 'Cash').toLowerCase();
      if (s === 'upi' || s.includes('qr') || s.includes('phonepe') || s.includes('gpay') || s.includes('paytm')) return 'UPI';
      if (s === 'cash' || !s) return 'Cash';
      return 'Bank';
    };
    periodPayments.forEach(p => {
      const b = bucketMode(p.paymentMethod);
      modeStats[b].inAmt += Number(p.paymentAmount) || 0;
      modeStats[b].count += 1;
    });
    periodExpenses.forEach(e => {
      const b = bucketMode(e.paymentMethod);
      modeStats[b].outAmt += Number(e.amount) || 0;
      modeStats[b].count += 1;
    });
    periodCounterTxns.forEach(t => {
      const b = bucketMode(t.paymentMode);
      const isIn = t.type === 'CASH_RECEIVED' || t.type === 'CASH_WITHDRAWAL';
      if (isIn) modeStats[b].inAmt += Number(t.amount) || 0;
      else modeStats[b].outAmt += Number(t.amount) || 0;
      modeStats[b].count += 1;
    });

    const masterSummaryRows = [
      { label: 'Total Billed Amount', value: summary.grossBilled, tone: 'var(--text-main)', note: 'Gross value of all services & invoices billed in period' },
      { label: 'Total Collected Amount', value: summary.collectedRevenue, tone: 'var(--green-600)', note: 'Verified Cash, UPI & Bank payments received from customers' },
      { label: 'Total Outstanding Due', value: summary.totalDues, tone: 'var(--danger)', note: 'Unpaid customer dues pending recovery' },
      { label: 'Total Operating Income', value: summary.totalOperatingIncome ?? summary.collectedRevenue, tone: 'var(--green-600)', note: `Collections + Earned Banking Commission (${formatINR(summary.bankingCommission || 0, true)}); Banking principal (${formatINR(summary.bankingVolume || 0, true)}) excluded` },
      { label: 'Total Expenses', value: summary.totalExpenses, tone: 'var(--orange-600)', note: 'Rent, electricity, internet, consumables, salary & counter expenses' },
      { label: 'Net Profit / Loss', value: summary.netCashFlow, tone: summary.netCashFlow >= 0 ? 'var(--green-600)' : 'var(--danger)', note: 'Total Operating Income minus Total Expenses', bold: true },
      { label: 'Cash in Hand', value: summary.cashInHand || 0, tone: 'var(--teal-600)', note: 'Separate physical counter cash drawer balance' },
      { label: 'UPI Balance', value: summary.upiBalance || 0, tone: 'var(--blue-600)', note: 'Separate UPI / QR digital wallet balance' },
      { label: 'Bank Balance', value: summary.bankBalance || 0, tone: 'var(--violet-600)', note: 'Separate Bank transfer / account balance' },
      { label: 'Total Capital', value: summary.totalCapital || 0, tone: 'var(--text-main)', note: 'Owner capital introduced minus withdrawals (excluded from income)' },
      { label: 'Total Investments', value: summary.totalInvestments || 0, tone: 'var(--text-main)', note: 'Total capital & hardware/expansion investments (excluded from income)' }
    ];

    tabBodyHtml = `
      <!-- Financial KPI Strip (4-Color Theme) -->
      <div class="kpi-grid" style="margin-bottom:1.25rem;">
        <div class="kpi-card kpi-green a4-avoid-break">
          <div class="kpi-header">
            <span class="kpi-label">Total Operating Income</span>
            <span class="kpi-icon">💰</span>
          </div>
          <div class="kpi-value tabular-nums">${formatINR(summary.totalOperatingIncome ?? summary.collectedRevenue, true)}</div>
          <div class="amount-words-hint" style="color:var(--text-muted); margin-bottom:0.2rem;">${escHtml(numberToWords(summary.totalOperatingIncome ?? summary.collectedRevenue))}</div>
          <div class="kpi-meta">Collected: ${formatINR(summary.collectedRevenue)} · CSP Comm: ${formatINR(summary.bankingCommission || 0)}</div>
        </div>

        <div class="kpi-card kpi-teal a4-avoid-break">
          <div class="kpi-header">
            <span class="kpi-label">Cash · UPI · Bank Split</span>
            <span class="kpi-icon">🔁</span>
          </div>
          <div class="kpi-value tabular-nums">${formatINR((summary.cashInHand || 0) + (summary.upiBalance || 0) + (summary.bankBalance || 0), true)}</div>
          <div class="amount-words-hint" style="color:var(--text-muted); margin-bottom:0.2rem;">Cash: ${formatINR(summary.cashInHand || 0)} · UPI: ${formatINR(summary.upiBalance || 0)} · Bank: ${formatINR(summary.bankBalance || 0)}</div>
          <div class="kpi-meta">In: ${formatINR(totalCashInflow)} · Out: ${formatINR(totalCashOutflow)}</div>
        </div>

        <div class="kpi-card kpi-orange a4-avoid-break">
          <div class="kpi-header">
            <span class="kpi-label">Total Expenses</span>
            <span class="kpi-icon">🧾</span>
          </div>
          <div class="kpi-value tabular-nums">${formatINR(summary.totalExpenses, true)}</div>
          <div class="amount-words-hint" style="color:var(--text-muted); margin-bottom:0.2rem;">${escHtml(numberToWords(summary.totalExpenses))}</div>
          <div class="kpi-meta">${periodExpenses.length} expense entries recorded</div>
        </div>

        <div class="kpi-card kpi-violet a4-avoid-break">
          <div class="kpi-header">
            <span class="kpi-label">Net Profit / Loss</span>
            <span class="kpi-icon">📈</span>
          </div>
          <div class="kpi-value tabular-nums" style="color:${summary.netCashFlow >= 0 ? 'var(--green-600)' : 'var(--danger)'};">${formatINR(summary.netCashFlow, true)}</div>
          <div class="amount-words-hint" style="color:var(--text-muted); margin-bottom:0.2rem;">${escHtml(numberToWords(summary.netCashFlow))}</div>
          <div class="kpi-meta">Pending Dues: ${formatINR(summary.totalDues, true)}</div>
        </div>
      </div>

      <!-- FINAL MASTER FINANCIAL SUMMARY TABLE (Part 8 Standard - Zero Dummy Data) -->
      <div class="table-card a4-avoid-break" style="margin-bottom:1.5rem;">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            <h3 style="font-size:0.98rem; font-weight:800; color:var(--blue-600);">📊 Final Master Financial Summary (Audited Real Data)</h3>
          </div>
          <div class="table-toolbar-right">
            <span class="badge badge-info">${formatDate(range.start)} – ${formatDate(range.end)}</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Financial Summary Metric</th>
                <th style="text-align:right;">Verified Amount</th>
                <th>Amount in Words</th>
                <th>Accounting Rule &amp; Audit Note</th>
              </tr>
            </thead>
            <tbody>
              ${masterSummaryRows.map(row => `
                <tr style="${row.bold ? 'background:var(--surface-alt); font-weight:700;' : ''}">
                  <td style="font-weight:${row.bold ? '800' : '600'};">${escHtml(row.label)}</td>
                  <td class="amount tabular-nums" style="text-align:right; font-weight:800; color:${row.tone};">${formatINR(row.value, true)}</td>
                  <td style="font-size:0.75rem; color:var(--text-muted);">${escHtml(numberToWords(row.value))}</td>
                  <td style="font-size:0.76rem; color:var(--text-muted);">${escHtml(row.note)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Profit & Loss + Cash In-Out Statement -->
      <div class="printable-document" style="background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-xl); padding:1.5rem; margin-bottom:1.5rem;">
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.75rem; border-bottom:2px solid var(--teal-700); padding-bottom:1rem; margin-bottom:1.25rem;">
          <div>
            <h3 style="font-size:1.25rem; font-weight:800; color:var(--violet-600);">MUN COMPUTER — Financial & Sales Statement</h3>
            <p style="font-size:0.8rem; color:var(--text-muted);">Daily &amp; Monthly Operating Income, Banking Commission, Cash/UPI/Bank Balances &amp; Profit Summary</p>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; font-size:0.95rem;">PROFIT &amp; LOSS OVERVIEW</div>
            <div style="font-size:0.78rem; color:var(--text-muted);">Period: ${formatDate(range.start)} to ${formatDate(range.end)}</div>
          </div>
        </div>

        <div class="erp-grid-2">
          <div>
            <h4 style="font-size:0.9rem; font-weight:700; border-bottom:1px solid var(--border-subtle); padding-bottom:0.45rem; margin-bottom:0.75rem; color:var(--green-600);">
              OPERATING INCOME &amp; CASH INFLOW
            </h4>
            <div style="display:flex; flex-direction:column; gap:0.55rem; font-size:0.85rem;">
              <div style="display:flex; justify-content:space-between; gap:0.5rem;">
                <span>Gross Service &amp; Sales Billing:</span>
                <span style="text-align:right;"><span class="tabular-nums" style="font-weight:600;">${formatINR(summary.grossBilled, true)}</span><div style="font-size:0.68rem; color:var(--text-muted);">${escHtml(numberToWords(summary.grossBilled))}</div></span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:0.5rem;">
                <span>Collected Revenue (Cash / UPI / Bank):</span>
                <span style="text-align:right;"><span class="tabular-nums" style="font-weight:700; color:var(--green-600);">${formatINR(summary.collectedRevenue, true)}</span><div style="font-size:0.68rem; color:var(--text-muted);">${escHtml(numberToWords(summary.collectedRevenue))}</div></span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:0.5rem;">
                <span>Earned Banking Commission (CSP / AePS):</span>
                <span style="text-align:right;"><span class="tabular-nums" style="font-weight:700; color:var(--teal-600);">${formatINR(summary.bankingCommission || 0, true)}</span><div style="font-size:0.68rem; color:var(--text-muted);">Principal (${formatINR(summary.bankingVolume || 0)}) excluded</div></span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:0.5rem;">
                <span>Counter Cash In (Received / Withdrawal):</span>
                <span style="text-align:right;"><span class="tabular-nums" style="font-weight:600; color:var(--teal-600);">${formatINR(counterCashIn, true)}</span><div style="font-size:0.68rem; color:var(--text-muted);">${escHtml(numberToWords(counterCashIn))}</div></span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:0.5rem; color:var(--danger);">
                <span>Outstanding Customer Dues:</span>
                <span style="text-align:right;"><span class="tabular-nums">${formatINR(summary.totalDues, true)}</span><div style="font-size:0.68rem; color:var(--text-muted);">${escHtml(numberToWords(summary.totalDues))}</div></span>
              </div>
            </div>
          </div>

          <div>
            <h4 style="font-size:0.9rem; font-weight:700; border-bottom:1px solid var(--border-subtle); padding-bottom:0.45rem; margin-bottom:0.75rem; color:var(--orange-600);">
              EXPENSES &amp; CASH OUTFLOW
            </h4>
            <div style="display:flex; flex-direction:column; gap:0.55rem; font-size:0.85rem;">
              ${Object.keys(expenseCatTotals).length > 0 ? Object.entries(expenseCatTotals).map(([cat, amt]) => `
                <div style="display:flex; justify-content:space-between;">
                  <span>${escHtml(cat)}:</span>
                  <span class="tabular-nums">${formatINR(amt, true)}</span>
                </div>
              `).join('') : `
                <div style="display:flex; justify-content:space-between; color:var(--text-muted);">
                  <span>Business Expenses:</span>
                  <span class="tabular-nums">${formatINR(0, true)}</span>
                </div>
              `}
              <div style="display:flex; justify-content:space-between;">
                <span>Counter Cash Out (Payment / Deposit):</span>
                <span class="tabular-nums" style="font-weight:600; color:var(--orange-600);">${formatINR(counterCashOut, true)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-weight:700; border-top:1px solid var(--border-subtle); padding-top:0.4rem; margin-top:0.2rem;">
                <span>Total Business Expenses:</span>
                <span class="tabular-nums" style="color:var(--danger);">${formatINR(summary.totalExpenses, true)}</span>
              </div>
            </div>
          </div>
        </div>

        <div style="margin-top:1.25rem; border-top:2px solid var(--border-strong); background:var(--surface-alt); padding:0.9rem 1rem; border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <div style="font-size:1rem; font-weight:800;">NET OPERATING PROFIT (OPERATING INCOME - EXPENSES)</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Collected service revenue + earned banking commission minus recorded business expenses</div>
          </div>
          <div class="amount tabular-nums" style="font-size:1.45rem; font-weight:800; color:${summary.netCashFlow >= 0 ? 'var(--green-600)' : 'var(--danger)'};">
            ${formatINR(summary.netCashFlow, true)}
          </div>
        </div>
      </div>

      <!-- Report #28: Separate Cash, UPI & Bank Balance Report -->
      <div class="table-card" style="margin-bottom:1.5rem;">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            <h3 style="font-size:0.95rem; font-weight:700;">💳 Cash, UPI &amp; Bank Separate Balance Report</h3>
          </div>
          <div class="table-toolbar-right">
            <span style="font-size:0.76rem; color:var(--text-muted);">Strict separation of physical cash vs digital wallets</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Payment Mode / Account</th>
                <th style="text-align:right;">Period Inflow</th>
                <th style="text-align:right;">Period Outflow</th>
                <th style="text-align:right;">Closing Balance</th>
                <th style="text-align:right;">Transactions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight:700;">💵 Physical Counter Cash</td>
                <td class="amount tabular-nums" style="text-align:right; color:var(--green-600);">${formatINR(modeStats.Cash.inAmt, true)}</td>
                <td class="amount tabular-nums" style="text-align:right; color:var(--danger);">${formatINR(modeStats.Cash.outAmt, true)}</td>
                <td class="amount tabular-nums" style="text-align:right; font-weight:800; color:var(--teal-600);">${formatINR(summary.cashInHand || 0, true)}</td>
                <td class="tabular-nums" style="text-align:right;">${modeStats.Cash.count}</td>
              </tr>
              <tr>
                <td style="font-weight:700;">📱 UPI / QR Collection</td>
                <td class="amount tabular-nums" style="text-align:right; color:var(--green-600);">${formatINR(modeStats.UPI.inAmt, true)}</td>
                <td class="amount tabular-nums" style="text-align:right; color:var(--danger);">${formatINR(modeStats.UPI.outAmt, true)}</td>
                <td class="amount tabular-nums" style="text-align:right; font-weight:800; color:var(--blue-600);">${formatINR(summary.upiBalance || 0, true)}</td>
                <td class="tabular-nums" style="text-align:right;">${modeStats.UPI.count}</td>
              </tr>
              <tr>
                <td style="font-weight:700;">🏛️ Bank Account / Transfer</td>
                <td class="amount tabular-nums" style="text-align:right; color:var(--green-600);">${formatINR(modeStats.Bank.inAmt, true)}</td>
                <td class="amount tabular-nums" style="text-align:right; color:var(--danger);">${formatINR(modeStats.Bank.outAmt, true)}</td>
                <td class="amount tabular-nums" style="text-align:right; font-weight:800; color:var(--violet-600);">${formatINR(summary.bankBalance || 0, true)}</td>
                <td class="tabular-nums" style="text-align:right;">${modeStats.Bank.count}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Table 1: Billing & Invoices Register -->
      <div class="table-card" style="margin-bottom:1.5rem;">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            <h3 style="font-size:0.95rem; font-weight:700;">🧾 Billing &amp; Invoices Ledger (${periodInvoices.length})</h3>
          </div>
          <div class="table-toolbar-right">
            <span style="font-size:0.78rem; color:var(--text-muted);">${formatDate(range.start)} – ${formatDate(range.end)}</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Total Billed</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${periodInvoices.map(inv => `
                <tr>
                  <td class="code tabular-nums" style="font-weight:700; color:var(--violet-600);">${escHtml(inv.id)}</td>
                  <td class="date tabular-nums">${formatDate(inv.date)}</td>
                  <td>
                    <div style="font-weight:600;">${escHtml(inv.customerName || '-')}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(inv.phone || '-')}</div>
                  </td>
                  <td class="amount tabular-nums" style="font-weight:700;">${formatINR(inv.totalAmount, true)}</td>
                  <td class="amount tabular-nums" style="color:var(--green-600);">${formatINR(inv.paidAmount, true)}</td>
                  <td class="amount tabular-nums" style="color:${Number(inv.balanceDue) > 0 ? 'var(--danger)' : 'var(--text-muted)'};">${formatINR(inv.balanceDue, true)}</td>
                  <td>
                    <span class="badge ${inv.status === 'Paid' ? 'badge-success' : inv.status === 'Partially Paid' ? 'badge-warning' : 'badge-danger'}">
                      ${escHtml(inv.status || 'Pending')}
                    </span>
                  </td>
                </tr>
              `).join('') || `
                <tr>
                  <td colspan="7">
                    <div class="empty-state">
                      <div class="empty-state-icon">🧾</div>
                      <div class="empty-state-title">No Matching Billing / Invoices</div>
                      <div class="empty-state-desc">Generated bills and invoices matching your active date/search filters will appear here.</div>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Table 2: Cash In-Out & Payment Receipts -->
      <div class="table-card">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            <h3 style="font-size:0.95rem; font-weight:700;">💵 Cash In-Out &amp; Payment Collections (${periodPayments.length + periodCounterTxns.length + periodExpenses.length})</h3>
          </div>
          <div class="table-toolbar-right">
            <span class="badge badge-success">In: ${formatINR(totalCashInflow, true)}</span>
            <span class="badge badge-warning">Out: ${formatINR(totalCashOutflow, true)}</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ref / ID</th>
                <th>Particulars / Party</th>
                <th>Flow Type</th>
                <th>Mode / Category</th>
                <th style="text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const combinedRows = [
                  ...periodPayments.map(p => ({
                    date: p.paymentDate,
                    id: p.id,
                    party: p.customerName || 'Customer Payment',
                    flow: 'INFLOW',
                    mode: p.paymentMethod || 'Cash',
                    amount: Number(p.paymentAmount) || 0,
                    isIn: true
                  })),
                  ...periodCounterTxns.map(t => {
                    const isIn = t.type === 'CASH_RECEIVED' || t.type === 'CASH_WITHDRAWAL';
                    return {
                      date: t.date,
                      id: t.id,
                      party: t.partyName || 'Counter Entry',
                      flow: isIn ? 'CASH IN' : 'CASH OUT',
                      mode: `${COUNTER_TXN_TYPES[t.type] || t.type} (${t.paymentMode || 'Cash'})`,
                      amount: Number(t.amount) || 0,
                      isIn
                    };
                  }),
                  ...periodExpenses.map(e => ({
                    date: e.date,
                    id: e.id,
                    party: e.title || e.category || 'Expense',
                    flow: 'OUTFLOW',
                    mode: `${e.category || 'Expense'} (${e.paymentMethod || 'Cash'})`,
                    amount: Number(e.amount) || 0,
                    isIn: false
                  }))
                ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

                if (!combinedRows.length) {
                  return `
                    <tr>
                      <td colspan="6">
                        <div class="empty-state">
                          <div class="empty-state-icon">💵</div>
                          <div class="empty-state-title">No Matching Cash In-Out Transactions</div>
                          <div class="empty-state-desc">Payment receipts, counter cash inflows/outflows, and expenses will appear here.</div>
                        </div>
                      </td>
                    </tr>
                  `;
                }

                return combinedRows.map(r => `
                  <tr>
                    <td class="date tabular-nums">${formatDate(r.date)}</td>
                    <td class="code tabular-nums">${escHtml(r.id)}</td>
                    <td style="font-weight:600;">${escHtml(r.party)}</td>
                    <td>
                      <span class="badge ${r.isIn ? 'badge-success' : 'badge-danger'}">${r.flow}</span>
                    </td>
                    <td style="font-size:0.8rem; color:var(--text-muted);">${escHtml(r.mode)}</td>
                    <td class="amount tabular-nums" style="text-align:right; font-weight:700; color:${r.isIn ? 'var(--green-600)' : 'var(--danger)'};">
                      ${r.isIn ? '+' : '-'}${formatINR(r.amount, true)}
                    </td>
                  </tr>
                `).join('');
              })()}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (activeTab === 'customer-service') {
    const allCustomers = getAllCustomers();

    const periodCustomers = allCustomers.filter(c =>
      c.regDate >= range.start && c.regDate <= range.end &&
      matchesQuery([c.id, c.name, c.phone, c.village, c.address])
    );
    const periodServices = allServicesRaw.filter(s =>
      s.appDate >= range.start && s.appDate <= range.end &&
      matchesQuery([s.id, s.refNumber, s.customerName, s.phone, s.serviceName, s.category]) &&
      matchesStatus(s.status || 'Pending') &&
      matchesCat(s.category)
    );
    const periodBanking = allBankingRaw.filter(b =>
      b.date >= range.start && b.date <= range.end &&
      matchesQuery([b.id, b.rrn, b.customerName, b.customerPhone, b.type, b.bank]) &&
      matchesStatus(b.status || 'Success') &&
      matchesCat(b.type)
    );

    const bankingStats = periodBanking.reduce((acc, t) => {
      const amt = Number(t.amount) || 0;
      const comm = Number(t.commission) || 0;
      if (t.status === 'Success') {
        acc.volume += amt;
        acc.commission += comm;
        if ((t.type || '').includes('Withdrawal')) acc.withdrawals += amt;
        else if ((t.type || '').includes('Deposit')) acc.deposits += amt;
        else if ((t.type || '').includes('Transfer')) acc.transfers += amt;
      }
      return acc;
    }, { volume: 0, commission: 0, withdrawals: 0, deposits: 0, transfers: 0 });

    const cyberCafeServices = periodServices.filter(s => s.category !== 'PNB CSP / Banking');
    const completedServicesCount = periodServices.filter(s => s.status === 'Completed' || s.status === 'Approved').length;
    const cyberServiceTotal = cyberCafeServices.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);

    const serviceCatMap = {};
    cyberCafeServices.forEach(s => {
      const cat = s.category || 'Other Service';
      if (!serviceCatMap[cat]) serviceCatMap[cat] = { count: 0, completed: 0, billed: 0, paid: 0 };
      serviceCatMap[cat].count += 1;
      if (s.status === 'Completed' || s.status === 'Approved') serviceCatMap[cat].completed += 1;
      serviceCatMap[cat].billed += Number(s.totalAmount) || 0;
      serviceCatMap[cat].paid += Number(s.paidAmount) || 0;
    });

    const filteredCustomers = allCustomers.filter(c => matchesQuery([c.id, c.name, c.phone, c.village, c.address]));
    const customerActivity = filteredCustomers.map(c => {
      const custServices = periodServices.filter(s => s.customerId === c.id || (c.phone && s.phone === c.phone));
      const custBanking = periodBanking.filter(b => b.customerId === c.id || (c.phone && b.customerPhone === c.phone));
      const billed = custServices.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
      const paid = custServices.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
      const due = custServices.reduce((sum, s) => sum + (Number(s.dueAmount) || 0), 0);
      const bankVol = custBanking.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
      const bankComm = custBanking.filter(b => b.status === 'Success').reduce((sum, b) => sum + (Number(b.commission) || 0), 0);
      return {
        ...c,
        serviceCount: custServices.length,
        bankingCount: custBanking.length,
        billed,
        paid,
        due,
        bankVol,
        bankComm
      };
    });

    tabBodyHtml = `
      <!-- Customer & Service KPI Strip (4-Color Theme) -->
      <div class="kpi-grid" style="margin-bottom:1.25rem;">
        <div class="kpi-card kpi-green">
          <div class="kpi-header">
            <span class="kpi-label">Customer Activity</span>
            <span class="kpi-icon">👥</span>
          </div>
          <div class="kpi-value tabular-nums">${filteredCustomers.length}</div>
          <div class="kpi-meta">${periodCustomers.length} new registered in period</div>
        </div>

        <div class="kpi-card kpi-teal">
          <div class="kpi-header">
            <span class="kpi-label">CSP Customer Principal Volume</span>
            <span class="kpi-icon">🏦</span>
          </div>
          <div class="kpi-value tabular-nums">${formatINR(bankingStats.volume, true)}</div>
          <div class="kpi-meta">${periodBanking.length} txns · Not counted in shop income</div>
        </div>

        <div class="kpi-card kpi-orange">
          <div class="kpi-header">
            <span class="kpi-label">Cyber Cafe Services</span>
            <span class="kpi-icon">💻</span>
          </div>
          <div class="kpi-value tabular-nums">${cyberCafeServices.length}</div>
          <div class="kpi-meta">Billing: ${formatINR(cyberServiceTotal, true)} · ${completedServicesCount} completed</div>
        </div>

        <div class="kpi-card kpi-violet">
          <div class="kpi-header">
            <span class="kpi-label">Earned Bank BC Commission</span>
            <span class="kpi-icon">💠</span>
          </div>
          <div class="kpi-value tabular-nums" style="color:var(--green-600);">${formatINR(bankingStats.commission, true)}</div>
          <div class="kpi-meta">W/D: ${formatINR(bankingStats.withdrawals)} · Dep: ${formatINR(bankingStats.deposits)}</div>
        </div>
      </div>

      <!-- Table 1: Bank BC / PNB Point Transactions Summary -->
      <div class="table-card" style="margin-bottom:1.5rem;">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            <h3 style="font-size:0.95rem; font-weight:700;">🏦 Bank BC / PNB CSP Transactions (${periodBanking.length})</h3>
          </div>
          <div class="table-toolbar-right" style="gap:0.4rem; flex-wrap:wrap;">
            <span class="badge badge-info">Withdrawals: ${formatINR(bankingStats.withdrawals, true)}</span>
            <span class="badge badge-success">Deposits: ${formatINR(bankingStats.deposits, true)}</span>
            <span class="badge badge-neutral">Transfers: ${formatINR(bankingStats.transfers, true)}</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>RRN / ID</th>
                <th>Customer</th>
                <th>Transaction Type &amp; Bank</th>
                <th>Customer Principal</th>
                <th>Earned Commission</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${periodBanking.map(t => `
                <tr>
                  <td class="date tabular-nums">${formatDate(t.date)}</td>
                  <td class="code tabular-nums">${escHtml(t.rrn || t.id)}</td>
                  <td>
                    <div style="font-weight:600;">${escHtml(t.customerName || 'Walk-in Customer')}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(t.customerPhone || '-')}</div>
                  </td>
                  <td>
                    <div style="font-weight:600;">${escHtml(t.type || '-')}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(t.bank || 'PNB CSP')}</div>
                  </td>
                  <td class="amount tabular-nums" style="font-weight:700;">${formatINR(t.amount, true)}</td>
                  <td class="amount tabular-nums" style="color:var(--green-600); font-weight:700;">${formatINR(t.commission, true)}</td>
                  <td>
                    <span class="badge ${t.status === 'Success' ? 'badge-success' : t.status === 'Failed' ? 'badge-danger' : 'badge-warning'}">
                      ${escHtml(t.status || 'Success')}
                    </span>
                  </td>
                </tr>
              `).join('') || `
                <tr>
                  <td colspan="7">
                    <div class="empty-state">
                      <div class="empty-state-icon">🏦</div>
                      <div class="empty-state-title">No Bank BC Transactions in Period</div>
                      <div class="empty-state-desc">AePS withdrawals, deposits, money transfers, and PNB Point transactions will appear here.</div>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Table 2: Cyber Cafe Services Category Summary & Register -->
      <div class="table-card" style="margin-bottom:1.5rem;">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            <h3 style="font-size:0.95rem; font-weight:700;">💻 Cyber Cafe Services Summary (${cyberCafeServices.length})</h3>
          </div>
          <div class="table-toolbar-right">
            <span style="font-size:0.78rem; color:var(--text-muted);">${Object.keys(serviceCatMap).length} active categories</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Ref #</th>
                <th>Date</th>
                <th>Service &amp; Category</th>
                <th>Customer</th>
                <th>Total Fee</th>
                <th>Paid / Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${cyberCafeServices.map(s => `
                <tr>
                  <td class="code tabular-nums" style="font-weight:700; color:var(--teal-600);">${escHtml(s.refNumber || s.id)}</td>
                  <td class="date tabular-nums">${formatDate(s.appDate)}</td>
                  <td>
                    <div style="font-weight:600;">${escHtml(s.serviceName)}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(s.category || 'Cyber Cafe')}</div>
                  </td>
                  <td>
                    <div style="font-weight:600;">${escHtml(s.customerName || '-')}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(s.phone || '-')}</div>
                  </td>
                  <td class="amount tabular-nums" style="font-weight:700;">${formatINR(s.totalAmount, true)}</td>
                  <td class="tabular-nums" style="font-size:0.8rem;">
                    <span style="color:var(--green-600);">Paid: ${formatINR(s.paidAmount, true)}</span>
                    ${Number(s.dueAmount) > 0 ? `<div style="color:var(--danger);">Due: ${formatINR(s.dueAmount, true)}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge ${s.status === 'Completed' || s.status === 'Approved' ? 'badge-success' : s.status === 'Rejected' || s.status === 'Cancelled' ? 'badge-danger' : 'badge-info'}">
                      ${escHtml(s.status || 'Pending')}
                    </span>
                  </td>
                </tr>
              `).join('') || `
                <tr>
                  <td colspan="7">
                    <div class="empty-state">
                      <div class="empty-state-icon">💻</div>
                      <div class="empty-state-title">No Matching Cyber Cafe Services</div>
                      <div class="empty-state-desc">Form fill-ups, online applications, PVC prints, and digital service orders will appear here.</div>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Table 3: Customer Activity Summary -->
      <div class="table-card">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            <h3 style="font-size:0.95rem; font-weight:700;">👥 Customer Activity Summary (${customerActivity.length})</h3>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone &amp; Location</th>
                <th>Cyber Services</th>
                <th>Bank BC Txns (Comm)</th>
                <th>Total Billed</th>
                <th>Due Balance</th>
              </tr>
            </thead>
            <tbody>
              ${customerActivity.map(c => `
                <tr>
                  <td>
                    <div style="font-weight:600;">${escHtml(c.name || '-')}</div>
                    <div class="code" style="font-size:0.72rem; color:var(--text-muted);">${escHtml(c.id)}</div>
                  </td>
                  <td>
                    <div class="tabular-nums" style="font-weight:600;">${escHtml(c.phone || '-')}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(c.village || c.address || '-')}</div>
                  </td>
                  <td class="tabular-nums">${c.serviceCount}</td>
                  <td class="tabular-nums">${c.bankingCount} (${formatINR(c.bankVol)} · Comm ${formatINR(c.bankComm)})</td>
                  <td class="amount tabular-nums" style="font-weight:600;">${formatINR(c.billed, true)}</td>
                  <td class="amount tabular-nums" style="color:${c.due > 0 ? 'var(--danger)' : 'var(--green-600)'}; font-weight:700;">
                    ${formatINR(c.due, true)}
                  </td>
                </tr>
              `).join('') || `
                <tr>
                  <td colspan="6">
                    <div class="empty-state">
                      <div class="empty-state-icon">👥</div>
                      <div class="empty-state-title">No Customer Records Found</div>
                      <div class="empty-state-desc">Registered customers and their service &amp; banking activity summary will appear here.</div>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (activeTab === 'staff-operations') {
    const monthStr = (range.end || getTodayDate()).slice(0, 7);
    const allAttendance = getAllAttendance();
    const allGpsLogs = getAllGpsAttendanceLogs();
    const allDaybooks = getAllDaybookEntries();
    const allCounterTxns = getAllCounterCashTxns();
    const allAuditLogs = getItem(KEYS.AUDIT_LOGS, []);

    const periodAttendance = allAttendance
      .filter(a =>
        a.date >= range.start && a.date <= range.end &&
        matchesQuery([a.staffName, a.role, a.notes, a.status]) &&
        matchesStatus(a.status || 'Present')
      )
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const periodGpsLogs = allGpsLogs
      .filter(g => g.date >= range.start && g.date <= range.end && matchesQuery([g.staffName, g.address, g.punchType]));
    const periodDaybooks = allDaybooks
      .filter(d => d.date >= range.start && d.date <= range.end && matchesQuery([d.date, d.status, d.notes]))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const periodCounterTxns = allCounterTxns
      .filter(t => t.date >= range.start && t.date <= range.end && matchesQuery([t.id, t.partyName, t.type, t.paymentMode]))
      .sort((a, b) => String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || '')));
    const periodAuditLogs = allAuditLogs
      .filter(l => {
        const d = String(l.timestamp || l.date || '').slice(0, 10);
        return (!d || (d >= range.start && d <= range.end)) &&
          matchesQuery([l.action, l.actorName, l.userName, l.details, l.message]);
      })
      .slice(0, 50);

    const monthlySummary = getMonthlyAttendanceReport(monthStr, 'all');
    const activeStaffSummaryRows = (monthlySummary.staffRows || []).filter(r => r.loggedDays > 0 || r.gpsPunches > 0);
    const presentCount = periodAttendance.filter(a => a.status === 'Present').length;
    const latestDaybook = periodDaybooks[0] || allDaybooks[0] || null;
    const latestClosingCash = Number(latestDaybook?.closingCash ?? latestDaybook?.countedPhysicalCash ?? latestDaybook?.expectedClosing) || 0;

    tabBodyHtml = `
      <!-- Staff & Operations KPI Strip (4-Color Theme) -->
      <div class="kpi-grid" style="margin-bottom:1.25rem;">
        <div class="kpi-card kpi-green">
          <div class="kpi-header">
            <span class="kpi-label">Staff Attendance Logs</span>
            <span class="kpi-icon">🧑‍💼</span>
          </div>
          <div class="kpi-value tabular-nums">${periodAttendance.length}</div>
          <div class="kpi-meta">${presentCount} Present · ${activeStaffSummaryRows.length} active staff</div>
        </div>

        <div class="kpi-card kpi-teal">
          <div class="kpi-header">
            <span class="kpi-label">GPS Photo Punches</span>
            <span class="kpi-icon">📍</span>
          </div>
          <div class="kpi-value tabular-nums">${periodGpsLogs.length}</div>
          <div class="kpi-meta">Geo-verified IN/OUT attendance</div>
        </div>

        <div class="kpi-card kpi-orange">
          <div class="kpi-header">
            <span class="kpi-label">Latest Closing Cash</span>
            <span class="kpi-icon">💼</span>
          </div>
          <div class="kpi-value tabular-nums">${formatINR(latestClosingCash, true)}</div>
          <div class="kpi-meta">${periodDaybooks.length} daily cash snapshots saved</div>
        </div>

        <div class="kpi-card kpi-violet">
          <div class="kpi-header">
            <span class="kpi-label">Operational Activities</span>
            <span class="kpi-icon">⚙️</span>
          </div>
          <div class="kpi-value tabular-nums">${periodCounterTxns.length + periodAuditLogs.length}</div>
          <div class="kpi-meta">${periodCounterTxns.length} counter entries · ${periodAuditLogs.length} audit events</div>
        </div>
      </div>

      <!-- Table 1: Staff Attendance Summary & Register -->
      <div class="table-card" style="margin-bottom:1.5rem;">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            <h3 style="font-size:0.95rem; font-weight:700;">🧑‍💼 Staff Attendance Report (${periodAttendance.length} Logs)</h3>
          </div>
          <div class="table-toolbar-right">
            <span style="font-size:0.78rem; color:var(--text-muted);">Month Summary: ${escHtml(monthStr)}</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Staff Name</th>
                <th>In Time</th>
                <th>Out Time</th>
                <th>Working Hrs</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${periodAttendance.map(a => `
                <tr>
                  <td class="date tabular-nums">${formatDate(a.date)}</td>
                  <td>
                    <div style="font-weight:600;">${escHtml(a.staffName || '-')}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(a.role || 'Staff')}</div>
                  </td>
                  <td class="tabular-nums">${escHtml(a.clockIn || a.inTime24 || '-')}</td>
                  <td class="tabular-nums">${escHtml(a.clockOut || a.outTime24 || '-')}</td>
                  <td class="tabular-nums">${escHtml(a.workingHoursLabel || '-')}</td>
                  <td>
                    <span class="badge ${a.status === 'Present' ? 'badge-success' : a.status === 'Half Day' ? 'badge-warning' : 'badge-danger'}">
                      ${escHtml(a.status || 'Present')}
                    </span>
                  </td>
                  <td style="font-size:0.78rem; color:var(--text-muted);">${escHtml(a.notes || '-')}</td>
                </tr>
              `).join('') || `
                <tr>
                  <td colspan="7">
                    <div class="empty-state">
                      <div class="empty-state-icon">🧑‍💼</div>
                      <div class="empty-state-title">No Staff Attendance Recorded in Period</div>
                      <div class="empty-state-desc">Daily staff attendance, shift check-ins, and GPS punches will appear here.</div>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Table 2: Daily Opening & Closing Cash Report -->
      <div class="table-card" style="margin-bottom:1.5rem;">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            <h3 style="font-size:0.95rem; font-weight:700;">💼 Daily Opening &amp; Closing Cash Register (${periodDaybooks.length})</h3>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Opening Cash</th>
                <th>Cash Received</th>
                <th>Cash Payment</th>
                <th>Deposit / W/D</th>
                <th>Closing Cash</th>
                <th>Variance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${periodDaybooks.map(d => {
                const openingVal = Number(d.openingCash) || 0;
                const receivedVal = Number(d.totalCashReceived ?? d.cashReceived) || 0;
                const paidVal = Number(d.totalCashPayment ?? d.cashPayment) || 0;
                const depositVal = Number(d.cashDeposit) || 0;
                const withdrawVal = Number(d.cashWithdrawal) || 0;
                const closingVal = Number(d.closingCash ?? d.countedPhysicalCash ?? d.expectedClosing) || 0;
                const varianceVal = Number(d.variance) || 0;
                return `
                  <tr>
                    <td class="date tabular-nums" style="font-weight:700;">${formatDate(d.date)}</td>
                    <td class="amount tabular-nums">${formatINR(openingVal, true)}</td>
                    <td class="amount tabular-nums" style="color:var(--green-600);">${formatINR(receivedVal, true)}</td>
                    <td class="amount tabular-nums" style="color:var(--danger);">${formatINR(paidVal, true)}</td>
                    <td class="tabular-nums" style="font-size:0.78rem;">
                      Dep: ${formatINR(depositVal)} / W/D: ${formatINR(withdrawVal)}
                    </td>
                    <td class="amount tabular-nums" style="font-weight:700; color:var(--teal-600);">${formatINR(closingVal, true)}</td>
                    <td class="amount tabular-nums" style="color:${varianceVal === 0 ? 'var(--text-muted)' : varianceVal > 0 ? 'var(--green-600)' : 'var(--danger)'};">
                      ${formatINR(varianceVal, true)}
                    </td>
                    <td>
                      <span class="badge ${d.status === 'Closed' ? 'badge-success' : 'badge-info'}">${escHtml(d.status || 'Saved')}</span>
                    </td>
                  </tr>
                `;
              }).join('') || `
                <tr>
                  <td colspan="8">
                    <div class="empty-state">
                      <div class="empty-state-icon">💼</div>
                      <div class="empty-state-title">No Daily Opening / Closing Cash Snapshots</div>
                      <div class="empty-state-desc">Saved daily opening balances and end-of-day closing cash tallies will appear here.</div>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Table 3: Operational Activity Log -->
      <div class="table-card">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            <h3 style="font-size:0.95rem; font-weight:700;">⚙️ Operational Activity &amp; Audit Log (${periodAuditLogs.length})</h3>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action / Event</th>
                <th>Operator / Actor</th>
                <th>Activity Details</th>
              </tr>
            </thead>
            <tbody>
              ${periodAuditLogs.map(log => `
                <tr>
                  <td class="date tabular-nums" style="font-size:0.78rem;">${formatDateTime(log.timestamp || log.date || '')}</td>
                  <td><span class="badge badge-neutral">${escHtml(log.action || 'ACTIVITY')}</span></td>
                  <td style="font-weight:600;">${escHtml(log.actorName || log.userName || log.actor || 'System')}</td>
                  <td style="font-size:0.8rem; color:var(--text-muted);">${escHtml(log.details || log.message || '-')}</td>
                </tr>
              `).join('') || `
                <tr>
                  <td colspan="4">
                    <div class="empty-state">
                      <div class="empty-state-icon">⚙️</div>
                      <div class="empty-state-title">No Operational Activity Logs in Period</div>
                      <div class="empty-state-desc">Counter transactions, attendance punches, and system operational actions will be logged here.</div>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else {
    // Tab 4: Application & 90-Day Follow-up (#31), Capital & Investment (#32), Business Targets & Marketing (#34)
    const allFollowups = getAllFollowups();
    const allFollowupCases = getAllFollowupCases();
    const allInvestments = getAllInvestments();
    const allTargets = getAllTargets();
    const allCampaigns = getAllCampaigns();
    const allAnnapurna = getAllAnnapurnaApps();

    const periodServices = allServicesRaw.filter(s =>
      s.appDate >= range.start && s.appDate <= range.end &&
      matchesQuery([s.id, s.customerName, s.serviceName, s.status]) &&
      matchesStatus(s.status || 'Pending')
    );
    const appCounts = {
      pending: periodServices.filter(s => ['Pending', 'Submitted'].includes(s.status)).length,
      processing: periodServices.filter(s => ['Processing', 'Under Review', 'In Progress'].includes(s.status)).length,
      completed: periodServices.filter(s => ['Completed', 'Approved', 'Delivered'].includes(s.status)).length,
      rejected: periodServices.filter(s => ['Rejected', 'Cancelled'].includes(s.status)).length
    };

    const filteredFollowupCases = allFollowupCases.filter(fc =>
      matchesQuery([fc.caseId || fc.id, fc.customerName, fc.phone, fc.serviceName, fc.currentStatus]) &&
      matchesStatus(fc.currentStatus)
    );
    const filteredFollowups = allFollowups.filter(f =>
      matchesQuery([f.customerName, f.phone, f.reason, f.status]) &&
      matchesStatus(f.status)
    );
    const filteredInvestments = allInvestments.filter(inv =>
      matchesQuery([inv.id, inv.title, inv.category, inv.fundingType, inv.source, inv.notes]) &&
      matchesCat(inv.category || inv.fundingType)
    );
    const filteredTargets = allTargets.filter(t => matchesQuery([t.title, t.category, t.period]));
    const filteredCampaigns = allCampaigns.filter(c => matchesQuery([c.title, c.channel, c.type, c.status]));

    const totalMarketingBudget = filteredCampaigns.reduce((s, c) => s + (Number(c.budget) || 0), 0);
    const totalMarketingSpent = filteredCampaigns.reduce((s, c) => s + (Number(c.spent) || 0), 0);
    const totalMarketingLeads = filteredCampaigns.reduce((s, c) => s + (Number(c.leads) || 0), 0);

    tabBodyHtml = `
      <!-- Growth, Capital & Follow-ups KPI Strip -->
      <div class="kpi-grid" style="margin-bottom:1.25rem;">
        <div class="kpi-card kpi-green">
          <div class="kpi-header">
            <span class="kpi-label">Applications Status</span>
            <span class="kpi-icon">🗂️</span>
          </div>
          <div class="kpi-value tabular-nums">${periodServices.length}</div>
          <div class="kpi-meta">Done: ${appCounts.completed} · Proc: ${appCounts.processing} · Pend: ${appCounts.pending} · Rej: ${appCounts.rejected}</div>
        </div>

        <div class="kpi-card kpi-teal">
          <div class="kpi-header">
            <span class="kpi-label">90-Day Cases &amp; Annapurna</span>
            <span class="kpi-icon">📞</span>
          </div>
          <div class="kpi-value tabular-nums">${filteredFollowupCases.length} <span style="font-size:0.9rem; font-weight:500;">/ ${allAnnapurna.length}</span></div>
          <div class="kpi-meta">${filteredFollowups.length} scheduled follow-ups · ${allAnnapurna.length} Annapurna cases</div>
        </div>

        <div class="kpi-card kpi-orange">
          <div class="kpi-header">
            <span class="kpi-label">Total Business Capital</span>
            <span class="kpi-icon">💼</span>
          </div>
          <div class="kpi-value tabular-nums">${formatINR(summary.totalCapital || 0, true)}</div>
          <div class="kpi-meta">Investments: ${formatINR(summary.totalInvestments || 0, true)} (Non-income)</div>
        </div>

        <div class="kpi-card kpi-violet">
          <div class="kpi-header">
            <span class="kpi-label">Targets &amp; Campaigns</span>
            <span class="kpi-icon">🎯</span>
          </div>
          <div class="kpi-value tabular-nums">${filteredTargets.length} / ${filteredCampaigns.length}</div>
          <div class="kpi-meta">Leads: ${totalMarketingLeads} · Ad Spend: ${formatINR(totalMarketingSpent)}</div>
        </div>
      </div>

      <!-- Report #31: Application & 90-Day Follow-up Report -->
      <div class="table-card" style="margin-bottom:1.5rem;">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            <h3 style="font-size:0.95rem; font-weight:700;">📞 Report #31: Application &amp; 90-Day Follow-up Tracker (${filteredFollowupCases.length} Cases · ${filteredFollowups.length} Reminders)</h3>
          </div>
          <div class="table-toolbar-right" style="gap:0.4rem; flex-wrap:wrap;">
            <span class="badge badge-warning">Pending: ${appCounts.pending}</span>
            <span class="badge badge-info">Processing: ${appCounts.processing}</span>
            <span class="badge badge-success">Completed: ${appCounts.completed}</span>
            <span class="badge badge-danger">Rejected: ${appCounts.rejected}</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Case / ID</th>
                <th>Customer</th>
                <th>Service / Reason</th>
                <th>Next Follow-up / Deadline</th>
                <th>Cycle Day</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredFollowupCases.slice(0, 30).map(fc => `
                <tr>
                  <td class="code tabular-nums">${escHtml(fc.caseId || fc.id)}</td>
                  <td>
                    <div style="font-weight:600;">${escHtml(fc.customerName || '-')}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(fc.phone || '-')}</div>
                  </td>
                  <td>${escHtml(fc.serviceName || fc.category || '-')}</td>
                  <td class="date tabular-nums">${formatDate(fc.nextFollowupDate || fc.regDate || '')}</td>
                  <td class="tabular-nums">${escHtml(fc.currentDay || 0)} / 90 Days</td>
                  <td><span class="badge ${String(fc.currentStatus || '').includes('Overdue') ? 'badge-danger' : 'badge-info'}">${escHtml(fc.currentStatus || 'Active')}</span></td>
                </tr>
              `).join('') || `
                <tr>
                  <td colspan="6">
                    <div class="empty-state">
                      <div class="empty-state-icon">📞</div>
                      <div class="empty-state-title">No 90-Day Follow-up Cases Recorded</div>
                      <div class="empty-state-desc">90-day application cases, pending client follow-ups, and upcoming deadlines will appear here.</div>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Report #32: Capital & Investment Report -->
      <div class="table-card" style="margin-bottom:1.5rem;">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            <h3 style="font-size:0.95rem; font-weight:700;">💼 Report #32: Capital &amp; Investment Register (${filteredInvestments.length})</h3>
          </div>
          <div class="table-toolbar-right" style="gap:0.4rem;">
            <span class="badge badge-info">Closing Capital: ${formatINR(summary.totalCapital || 0, true)}</span>
            <span class="badge badge-danger">Withdrawals: ${formatINR(summary.ownerWithdrawals || 0, true)}</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Title / Asset</th>
                <th>Category</th>
                <th>Funding Type</th>
                <th style="text-align:right;">Amount</th>
                <th>Audit Classification</th>
              </tr>
            </thead>
            <tbody>
              ${filteredInvestments.map(inv => `
                <tr>
                  <td class="date tabular-nums">${formatDate(inv.investmentDate || inv.date || '')}</td>
                  <td style="font-weight:600;">${escHtml(inv.title || '-')}</td>
                  <td>${escHtml(inv.category || 'Investment')}</td>
                  <td><span class="badge badge-neutral">${escHtml(inv.fundingType || inv.source || 'Owner Capital')}</span></td>
                  <td class="amount tabular-nums" style="text-align:right; font-weight:700;">${formatINR(inv.amount, true)}</td>
                  <td style="font-size:0.75rem; color:var(--text-muted);">Capital / Asset (Excluded from Operating Income)</td>
                </tr>
              `).join('') || `
                <tr>
                  <td colspan="6">
                    <div class="empty-state">
                      <div class="empty-state-icon">💼</div>
                      <div class="empty-state-title">No Capital or Investment Entries Yet</div>
                      <div class="empty-state-desc">Opening capital, additional capital, owner withdrawals, and asset investments will appear here.</div>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Report #34: Business Targets & Marketing Report -->
      <div class="table-card">
        <div class="table-toolbar">
          <div class="table-toolbar-left">
            <h3 style="font-size:0.95rem; font-weight:700;">🎯 Report #34: Business Targets &amp; Marketing Campaigns (${filteredTargets.length} Targets · ${filteredCampaigns.length} Campaigns)</h3>
          </div>
          <div class="table-toolbar-right" style="gap:0.4rem;">
            <span class="badge badge-info">Budget: ${formatINR(totalMarketingBudget)}</span>
            <span class="badge badge-success">Leads: ${totalMarketingLeads}</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title &amp; Category</th>
                <th>Period / Channel</th>
                <th style="text-align:right;">Goal / Budget</th>
                <th style="text-align:right;">Achieved / Spent</th>
                <th>Progress / Leads</th>
              </tr>
            </thead>
            <tbody>
              ${[
                ...filteredTargets.map(t => `
                  <tr>
                    <td><span class="badge badge-info">TARGET</span></td>
                    <td><div style="font-weight:600;">${escHtml(t.title || '-')}</div><div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(t.category || '-')}</div></td>
                    <td>${escHtml(t.period || 'Monthly')}</td>
                    <td class="amount tabular-nums" style="text-align:right;">${formatINR(t.targetValue, true)}</td>
                    <td class="amount tabular-nums" style="text-align:right; color:var(--green-600);">${formatINR(t.currentValue, true)}</td>
                    <td class="tabular-nums" style="font-weight:700;">${Number(t.percentage) || 0}%</td>
                  </tr>
                `),
                ...filteredCampaigns.map(c => `
                  <tr>
                    <td><span class="badge badge-success">CAMPAIGN</span></td>
                    <td><div style="font-weight:600;">${escHtml(c.title || '-')}</div><div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(c.type || '-')}</div></td>
                    <td>${escHtml(c.channel || c.status || '-')}</td>
                    <td class="amount tabular-nums" style="text-align:right;">${formatINR(c.budget, true)}</td>
                    <td class="amount tabular-nums" style="text-align:right;">${formatINR(c.spent, true)}</td>
                    <td class="tabular-nums">${Number(c.leads) || 0} Leads</td>
                  </tr>
                `)
              ].join('') || `
                <tr>
                  <td colspan="6">
                    <div class="empty-state">
                      <div class="empty-state-icon">🎯</div>
                      <div class="empty-state-title">No Business Targets or Marketing Campaigns</div>
                      <div class="empty-state-desc">Monthly/yearly targets and promotional campaign ROI records will appear here.</div>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  const hasActiveSubFilters = Boolean(q || AppState.reportStatusFilter !== 'all' || AppState.reportCategoryFilter !== 'all');

  return `
    <div class="page-header" style="flex-wrap:wrap; gap:1rem;">
      <div>
        <h2 class="page-title">Reports &amp; Analytics (MUN COMPUTER)</h2>
        <p class="page-subtitle">Complete Business Intelligence — Final Master Summary, Cash/UPI/Bank Split, Banking Commission, Staff &amp; Follow-ups</p>
      </div>
      <div class="page-actions" style="display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center;">
        <select class="form-control form-control-sm" style="width:auto; min-width:140px;" onchange="window.MJK.setDateFilter(this.value)" title="Select Report Period">
          ${periodOptions.map(opt => `<option value="${opt.value}" ${AppState.dateFilter === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
        </select>
        ${AppState.dateFilter === 'custom' ? `
          <div style="display:flex; gap:0.35rem; align-items:center;">
            <input type="date" class="form-control form-control-sm" style="width:auto;" value="${escHtml(AppState.customDateStart || range.start)}" onchange="window.MJK.setCustomDateRange(this.value, '${escHtml(AppState.customDateEnd || range.end)}')" title="From Date">
            <span style="font-size:0.78rem; color:var(--text-muted);">to</span>
            <input type="date" class="form-control form-control-sm" style="width:auto;" value="${escHtml(AppState.customDateEnd || range.end)}" onchange="window.MJK.setCustomDateRange('${escHtml(AppState.customDateStart || range.start)}', this.value)" title="To Date">
          </div>
        ` : ''}
        <button type="button" class="btn btn-danger btn-sm" onclick="window.MJK.openReportsA4Popup(false)" title="Preview & Print A4 PDF">
          📄 PDF / A4
        </button>
        <button type="button" class="btn btn-success btn-sm" onclick="window.MJK.exportReportExcel()" title="Download Excel (.xlsx)">
          📊 Excel
        </button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportReportCSV()" title="Download CSV">
          📋 CSV
        </button>
      </div>
    </div>

    <!-- Search, Status & Category Filter Bar -->
    <div style="display:flex; flex-wrap:wrap; gap:0.65rem; align-items:center; background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:0.75rem 1rem; margin-bottom:1rem;">
      <div style="flex:1; min-width:220px;">
        <input id="reports-filter-search" type="text" class="form-control form-control-sm" placeholder="Search Customer, Mobile, Service, Invoice #, Payment ID, RRN, Staff..." value="${escHtml(AppState.reportSearchQuery)}" oninput="window.MJK.setReportSearch(this.value)">
      </div>
      <select class="form-control form-control-sm" style="width:auto; min-width:140px;" onchange="window.MJK.setReportFilter('status', this.value)" title="Filter by Status">
        <option value="all" ${AppState.reportStatusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
        ${statusFilterOptions.map(st => `<option value="${escHtml(st)}" ${AppState.reportStatusFilter === st ? 'selected' : ''}>${escHtml(st)}</option>`).join('')}
      </select>
      <select class="form-control form-control-sm" style="width:auto; min-width:155px;" onchange="window.MJK.setReportFilter('category', this.value)" title="Filter by Category / Mode">
        <option value="all" ${AppState.reportCategoryFilter === 'all' ? 'selected' : ''}>All Categories / Modes</option>
        ${dynamicCategories.map(cat => `<option value="${escHtml(cat)}" ${AppState.reportCategoryFilter === cat ? 'selected' : ''}>${escHtml(cat)}</option>`).join('')}
      </select>
      ${hasActiveSubFilters ? `
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.setReportFilter('reset', '')">✕ Reset</button>
      ` : ''}
    </div>

    <!-- Corporate Specialized Reports Bar (GST, Typing, Daily/Monthly, P&L, Dues, Employee, Service History) -->
    <div style="display:flex; flex-wrap:wrap; gap:0.6rem; align-items:center; justify-content:space-between; background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:0.7rem 1rem; margin-bottom:1rem;">
      <div style="display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
        <span style="font-size:0.8rem; font-weight:700; color:var(--text-main);">📑 Corporate Quick Reports:</span>
        <select id="specialized-report-picker" class="form-control form-control-sm" style="width:auto; min-width:250px;">
          <option value="gst">GST &amp; Tax Summary Report</option>
          <option value="typing">Typing, DTP &amp; Documentation Report</option>
          <option value="daily">Daily Business Report (Today)</option>
          <option value="monthly">Monthly Business Report (This Month)</option>
          <option value="pnl">Profit &amp; Loss Statement</option>
          <option value="outstanding">Outstanding Payment &amp; Dues Report</option>
          <option value="employee">Employee &amp; Staff Performance Report</option>
          <option value="service-history">Complete Service History Report</option>
        </select>
      </div>
      <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.runSpecializedReportExport('print')">🖨 Print</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.runSpecializedReportExport('pdf')">📄 PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.runSpecializedReportExport('excel')">📊 Excel</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.runSpecializedReportExport('csv')">📥 CSV</button>
      </div>
    </div>

    <!-- 4 Master Report Tabs -->
    <div class="tab-nav" role="tablist" aria-label="All Sector Report Categories">
      <button type="button" role="tab" aria-selected="${activeTab === 'financial'}" class="tab-btn ${activeTab === 'financial' ? 'active' : ''}" onclick="window.MJK.setReportTab('financial')">
        💰 Financial &amp; Master Summary
      </button>
      <button type="button" role="tab" aria-selected="${activeTab === 'customer-service'}" class="tab-btn ${activeTab === 'customer-service' ? 'active' : ''}" onclick="window.MJK.setReportTab('customer-service')">
        👥 Customer, Services &amp; CSP
      </button>
      <button type="button" role="tab" aria-selected="${activeTab === 'staff-operations'}" class="tab-btn ${activeTab === 'staff-operations' ? 'active' : ''}" onclick="window.MJK.setReportTab('staff-operations')">
        🧑‍💼 Staff, Attendance &amp; Cash
      </button>
      <button type="button" role="tab" aria-selected="${activeTab === 'growth-followups'}" class="tab-btn ${activeTab === 'growth-followups' ? 'active' : ''}" onclick="window.MJK.setReportTab('growth-followups')">
        🎯 Capital, Targets &amp; Follow-ups
      </button>
    </div>

    <!-- Active Tab Panel -->
    <div role="tabpanel">
      ${tabBodyHtml}
    </div>
  `;
}

/* --- 19. Settings & Backups View --- */
function renderSettingsView() {
  const curUser = getCurrentUser();
  const isSuper = isSuperAdmin(curUser);
  const canManageBackups = isSuper || curUser?.role === 'ADMIN' || canExtra('canManageBackupSettings', curUser);

  hydrateSettingsSecurityData(false);

  const sessionToken = encodeURIComponent(localStorage.getItem('MUN_COMPUTER_SESSION_TOKEN') || '');
  const delFilter = _settingsSecurityCache.deleteFilter || 'ALL';
  const filteredDeleteHistory = delFilter === 'ALL'
    ? _settingsSecurityCache.deleteHistory
    : _settingsSecurityCache.deleteHistory.filter(d => d.targetType === delFilter);

  return `
    <div class="page-header" style="flex-wrap:wrap; gap:1rem;">
      <div>
        <h2 class="page-title">Settings, Security & Backups</h2>
        <p class="page-subtitle">Configure password security, SMS OTP gateway, automatic database backups, and permanent deletion audit history</p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="window.MJK.openChangePasswordModal()">
          🔑 Change Password
        </button>
        ${(isSuper || curUser?.role === 'ADMIN') ? `
          <button class="btn btn-secondary btn-sm" onclick="window.MJK.openSmsConfigModal()">
            📱 SMS Gateway Config
          </button>
          <button class="btn btn-primary btn-sm" onclick="window.MJK.openAdminUpiSettings()">
            📱 UPI QR &amp; Payment Settings
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Quick Stats Bar -->
    <div class="stats-grid" style="margin-bottom:1.5rem;">
      <div class="stat-card">
        <div class="stat-label">Auto-Backup Snapshots</div>
        <div class="stat-value font-mono" style="color:var(--royal-blue); font-variant-numeric:tabular-nums;">${_settingsSecurityCache.snapshots.length}</div>
        <div class="stat-desc">Server snapshots available</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Delete Audit Records</div>
        <div class="stat-value font-mono" style="font-variant-numeric:tabular-nums;">${_settingsSecurityCache.deleteHistory.length}</div>
        <div class="stat-desc">Mandatory reason history</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Filtered Audit View</div>
        <div class="stat-value font-mono" style="color:var(--blue-600); font-variant-numeric:tabular-nums;">${filteredDeleteHistory.length}</div>
        <div class="stat-desc">Scope: ${escHtml(delFilter)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Auto-Snapshot Cycle</div>
        <div class="stat-value font-mono" style="font-size:1.15rem; color:var(--success); font-variant-numeric:tabular-nums;">Every 6 Hours</div>
        <div class="stat-desc">Pre-restore safety enabled</div>
      </div>
    </div>

    <div class="erp-grid-2" style="align-items:start;">
      <!-- SMS Gateway Configuration Summary & Backup -->
      <div style="display:flex; flex-direction:column; gap:1.5rem;">

        <!-- SMS Gateway Configuration Summary -->
        ${(isSuper || curUser?.role === 'ADMIN') ? `
          <div class="list-card">
            <div class="list-header">
              <div>
                <h3 class="list-title">📱 SMS OTP Gateway</h3>
                <p style="font-size:0.75rem; color:var(--text-muted);">Real SMS dispatch for staff registration & password recovery</p>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="window.MJK.openSmsConfigModal()">Configure</button>
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.5;">
              <div>Supports: <strong>Fast2SMS (India DLT/Quick)</strong>, <strong>Twilio</strong>, <strong>MSG91</strong>, and <strong>Custom Webhook</strong>.</div>
              <div style="margin-top:0.5rem; padding:0.6rem 0.8rem; background:var(--surface-alt); border-radius:var(--radius-md); border:1px solid var(--border-subtle); font-size:0.75rem;">
                <div>Default Verification Mobile: <strong>+91 8101352105</strong></div>
                <div style="margin-top:0.25rem;">Cooldown Rate Limit: <strong>60 seconds</strong> · Expiry: <strong>5 minutes</strong></div>
              </div>
              <div style="margin-top:0.75rem; display:flex; justify-content:flex-end;">
                <button class="btn btn-primary btn-sm" onclick="window.MJK.handleTestSms()">
                  ⚡ Send Test SMS (8101352105)
                </button>
              </div>
            </div>
          </div>
        ` : `
          <div class="list-card">
            <div class="list-header">
              <h3 class="list-title">🔐 Password & Account Security</h3>
            </div>
            <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:0.75rem;">
              Update your account password regularly to protect access to customer records and financial ledgers.
            </p>
            <button class="btn btn-primary btn-sm" onclick="window.MJK.openChangePasswordModal()">🔑 Change My Password</button>
          </div>
        `}

        <!-- Inventory & Gas Accessories Category Settings -->
        <div class="list-card">
          <div class="list-header">
            <div>
              <h3 class="list-title">🏷️ Inventory &amp; Gas Product Categories</h3>
              <p style="font-size:0.75rem; color:var(--text-muted);">Preset gas accessories categories &amp; custom category management</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openInventoryCategoryManagerModal()">Manage Categories</button>
          </div>
          <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.6;">
            <div>Active Categories (${getInventoryCategories().length}):</div>
            <div style="margin-top:0.4rem; padding:0.65rem 0.85rem; background:var(--surface-alt); border-radius:var(--radius-md); border:1px solid var(--border-subtle); font-size:0.78rem; color:var(--text-main);">
              ${getInventoryCategories().map(c => escHtml(c)).join(' · ')}
            </div>
            <div style="margin-top:0.75rem; display:flex; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('inventory')">📦 Open Inventory</button>
              <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openInventoryCategoryManagerModal()">+ Add / Delete Categories</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Database Backups -->
      <div style="display:flex; flex-direction:column; gap:1.5rem;">
        <!-- Automatic & Manual Data Backup & Restore -->
        <div class="list-card">
          <div class="list-header">
            <h3 class="list-title">💾 Data Backup & Auto-Snapshots</h3>
            ${canManageBackups ? `
              <button class="btn btn-secondary btn-sm" onclick="window.MJK.runManualAutoSnapshot()">⚡ Snapshot Now</button>
            ` : ''}
          </div>
          ${!canManageBackups ? `
            <div style="padding:0.85rem; background:var(--danger-bg); border:1px solid var(--danger-border); border-radius:var(--radius-md); color:var(--danger); font-size:0.8rem; font-weight:600;">
              ⛔ Restricted: Administrator permission is required to access or restore database backups.
            </div>
          ` : `
            <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">
              Automatic snapshots run every 6 hours and before every restore. Download JSON snapshots or restore from a backup file.
            </p>
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
              <button class="btn btn-primary" onclick="window.MJK.triggerDatabaseBackup()">
                ⬇ Download Full Database Backup (.JSON)
              </button>

              ${_settingsSecurityCache.snapshots.length > 0 ? `
                <div style="border-top:1px solid var(--border-subtle); padding-top:0.75rem;">
                  <div style="font-size:0.76rem; font-weight:700; color:var(--text-main); margin-bottom:0.4rem;">
                    Recent Server Auto-Backups (${_settingsSecurityCache.snapshots.length})
                  </div>
                  <div style="display:flex; flex-direction:column; gap:0.35rem; max-height:185px; overflow-y:auto;">
                    ${_settingsSecurityCache.snapshots.slice(0, 8).map(snap => `
                      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; padding:0.45rem 0.6rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); font-size:0.74rem;">
                        <div>
                          <div class="font-mono" style="font-weight:700; color:var(--text-main);">${escHtml(snap.id)}</div>
                          <div style="color:var(--text-muted); font-size:0.68rem;">${escHtml(snap.trigger || 'AUTO')} · ${formatDateTime(snap.createdAt)} · ${Math.max(1, Math.round((Number(snap.sizeBytes) || 0) / 1024))} KB</div>
                        </div>
                        <a class="btn btn-outline btn-sm" href="/api/backup/snapshots/${encodeURIComponent(snap.id)}/download?token=${sessionToken}" download="${escHtml(snap.filename || snap.id + '.json')}">⬇</a>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <div style="border-top:1px solid var(--border-subtle); padding-top:0.85rem; margin-top:0.25rem;">
                <label class="form-label" style="font-size:0.8rem;">Restore Database From File</label>
                <input type="file" id="restore-backup-file-input" class="form-control" accept=".json" onchange="window.MJK.handleRestoreFile(this)">
              </div>

              ${isSuper ? `
                <div style="border-top:1px solid var(--border-subtle); padding-top:0.85rem; margin-top:0.25rem;">
                  <div style="font-weight:700; color:var(--danger); font-size:0.83rem; margin-bottom:0.25rem;">Clear All Operational Data (সব ডেটা সাফ করুন)</div>
                  <p style="font-size:0.73rem; color:var(--text-muted); margin-bottom:0.5rem;">Permanently cleans all demo customers, services, payments, invoices, expenses, banking, inventory, and tasks and resets reports to ₹0. Login accounts and shop profile are preserved.</p>
                  <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="window.MJK.promptClearAllData()">
                    🧹 Clear Operational Records & Reset Reports
                  </button>
                </div>
              ` : ''}
            </div>
          `}
        </div>

      </div>

    </div>

    <!-- Security Audit: Delete Reason & Delete History -->
    <div class="list-card" style="margin-top:1.5rem;">
      <div class="list-header" style="flex-wrap:wrap; gap:0.75rem;">
        <div>
          <h3 class="list-title">🛡️ Delete Reason & Permanent Delete History (${filteredDeleteHistory.length})</h3>
          <p style="font-size:0.78rem; color:var(--text-muted); margin-top:0.2rem;">
            Mandatory audit record of every deleted photo, user account, transaction, customer, service, invoice, or expense with User ID and Delete Reason.
          </p>
        </div>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
          <select class="form-control toolbar-select" onchange="window.MJK.setDeleteHistoryFilter(this.value)">
            ${['ALL', 'ATTENDANCE_PHOTO', 'USER_ACCOUNT', 'COUNTER_CASH_TXN', 'CUSTOMER', 'SERVICE', 'PAYMENT', 'INVOICE', 'EXPENSE', 'DOCUMENT'].map(t => `<option value="${t}" ${delFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.refreshSettingsSecurity()">🔄 Refresh</button>
        </div>
      </div>
      <div class="table-responsive" style="margin-top:0.75rem; max-height:320px; overflow-y:auto;">
        <table class="data-table" style="font-size:0.8rem;">
          <thead>
            <tr>
              <th>Date & Time (IST)</th>
              <th>Module / Type</th>
              <th>Deleted Record</th>
              <th>Mandatory Delete Reason</th>
              <th>Deleted By (User + UID)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredDeleteHistory.length === 0 ? `
              <tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No deletion audit records matching this filter.</td></tr>
            ` : filteredDeleteHistory.slice(0, 60).map(item => `
              <tr>
                <td class="date tabular-nums" style="white-space:nowrap;">${formatDateTime(item.timestamp)}</td>
                <td><span class="badge badge-danger" style="font-size:0.68rem;">${escHtml(item.targetType || 'OTHER')}</span></td>
                <td>
                  <div style="font-weight:700;">${escHtml(item.targetSummary || item.targetId)}</div>
                  <div class="font-mono" style="font-size:0.7rem; color:var(--text-muted);">${escHtml(item.targetId)}</div>
                </td>
                <td style="color:var(--text-main); max-width:280px;">${escHtml(item.reason)}</td>
                <td>
                  <div style="font-weight:700;">${escHtml(item.deletedByName || '-')}</div>
                  <div class="font-mono" style="font-size:0.7rem; color:var(--blue-600);">${escHtml(item.deletedByUid || '-')}</div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* --- 20. Official ADMINISTRATION User Management View (MANAGER & STAFF) --- */
function renderAdministrationUsersView(section = 'MANAGER') {
  const activeUser = getCurrentUser();
  const isActorAdmin = isMainAdmin(activeUser) || String(activeUser?.role || '').toUpperCase() === 'ADMIN';
  const isActorManager = String(activeUser?.role || '').toUpperCase() === 'MANAGER';
  const activeSection = section === 'STAFF' ? 'STAFF' : 'MANAGER';

  if (activeSection === 'MANAGER' && !isActorAdmin) {
    return `
      <div class="card" style="padding:2rem; max-width:560px; margin:2rem auto; text-align:center;">
        <h3 style="color:var(--danger); margin-bottom:0.5rem;">Access Restricted</h3>
        <p style="font-size:0.86rem; color:var(--text-muted); margin-bottom:1.25rem;">
          Only Main Administration (<strong>${MAIN_ADMIN_UID}</strong>) can view or manage Manager accounts. Managers can manage Staff accounts exclusively under <strong>ADMINISTRATION → STAFF</strong>.
        </p>
        ${isActorManager ? `<button type="button" class="btn btn-primary" onclick="window.MJK.navigateTo('admin-staff')">Go to ADMINISTRATION → STAFF</button>` : `<button type="button" class="btn btn-secondary" onclick="window.MJK.navigateTo('dashboard')">Return to Dashboard</button>`}
      </div>
    `;
  }

  if (activeSection === 'STAFF' && !isActorAdmin && !isActorManager) {
    return renderAccessDeniedView();
  }

  const allUsers = getAllUsers();
  const cachedStats = getUserDashboardStats();
  const sectionUsers = allUsers.filter(u => {
    const r = String(u.role || 'STAFF').toUpperCase();
    if (activeSection === 'MANAGER') {
      return r === 'ADMIN' || r === 'MANAGER' || u.isMainAdmin === true || String(u.uid || '').toUpperCase() === MAIN_ADMIN_UID;
    }
    return r !== 'ADMIN' && r !== 'MANAGER' && !u.isMainAdmin && String(u.uid || '').toUpperCase() !== MAIN_ADMIN_UID;
  });

  const q = (AppState.userSearchQuery || '').trim().toLowerCase();
  const filteredUsers = !q
    ? sectionUsers
    : sectionUsers.filter(u => {
        const hay = [
          u.uid,
          u.username,
          u.name,
          u.role,
          u.designation,
          u.status,
          u.email,
          u.mobileNumber,
          u.phoneMasked,
          u.address
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });

  const stats = {
    totalInSection: sectionUsers.length,
    activeCount: sectionUsers.filter(u => u.status === 'ACTIVE').length,
    inactiveCount: sectionUsers.filter(u => u.status === 'INACTIVE').length,
    suspendedCount: sectionUsers.filter(u => u.status === 'SUSPENDED').length,
    nextUidPreview: window._munNextIdPreview?.previewUid || cachedStats?.nextManagedUid || previewNextGlobalReference(activeSection === 'MANAGER' ? 'MGR' : 'STF')
  };

  if (!AppState._approvalsSynced) {
    AppState._approvalsSynced = true;
    const tasks = [
      fetchUsersFromBackend(),
      fetchPasswordResetReferences().then(refs => { AppState.resetReferences = refs; })
    ];
    if (isActorAdmin) {
      tasks.push(fetchAuditLogsFromBackend().then(logs => {
        if (Array.isArray(logs)) setItem(KEYS.AUDIT_LOGS, logs);
      }));
    }
    Promise.allSettled(tasks).then(() => render());
  }

  const allAuditLogs = getItem(KEYS.AUDIT_LOGS, []);
  const userAuditLogs = allAuditLogs.filter(l =>
    [
      'USER_CREATED', 'USER_EDITED', 'USER_STATUS_CHANGE', 'USER_DELETED',
      'ADMIN_PASSWORD_RESET', 'PASSWORD_RESET', 'PASSWORD_CHANGE', 'PERMISSIONS_UPDATED'
    ].includes(l.action)
  );
  const recentLogins = getRecentLoginActivity().length > 0
    ? getRecentLoginActivity()
    : allAuditLogs.filter(l =>
        ['AUTH_LOGIN', 'AUTH_LOGIN_FAILED', 'ACCOUNT_LOCKED', 'PASSWORD_RESET', 'PASSWORD_CHANGE', 'MFA_ENABLED', 'MFA_DISABLED'].includes(l.action)
      ).slice(0, 15);
  const resetRefs = Array.isArray(AppState.resetReferences) ? AppState.resetReferences : [];

  return `
    <div class="page-header" style="flex-wrap:wrap; gap:1rem;">
      <div>
        <h2 class="page-title">ADMINISTRATION — ${activeSection}</h2>
        <p class="page-subtitle">
          ${activeSection === 'MANAGER'
            ? `Permanent Master Administrator (${MAIN_ADMIN_UID}) & Manager Account Control · Universal Global SL (MC-MGR-YYYY-XXXXXXXX)`
            : 'Staff Account Management · Universal Global SL (MC-STF-YYYY-XXXXXXXX) · Create, edit, activate & suspend'}
        </p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.45rem; flex-wrap:wrap; align-items:center;">
        ${isActorAdmin ? `
          <div style="display:inline-flex; border:1px solid var(--border-subtle); border-radius:8px; overflow:hidden; margin-right:0.25rem;">
            <button type="button" class="btn btn-sm ${activeSection === 'MANAGER' ? 'btn-primary' : 'btn-secondary'}" style="border-radius:0;" onclick="window.MJK.navigateTo('admin-managers')">MANAGER</button>
            <button type="button" class="btn btn-sm ${activeSection === 'STAFF' ? 'btn-primary' : 'btn-secondary'}" style="border-radius:0;" onclick="window.MJK.navigateTo('admin-staff')">STAFF</button>
          </div>
        ` : ''}
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('users', 'pdf')">PDF</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.exportModuleReport('users', 'excel')">Excel</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.refreshApprovalPanel()">Refresh</button>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openUserModal('${activeSection}')">
          + Create ${activeSection === 'MANAGER' ? 'Manager' : 'Staff'} Account
        </button>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:1.35rem;">
      <div class="stat-card">
        <div class="stat-label">Total ${activeSection === 'MANAGER' ? 'Admin & Managers' : 'Staff Accounts'}</div>
        <div class="stat-value font-mono tabular-nums">${stats.totalInSection}</div>
        <div class="stat-desc">${activeSection === 'MANAGER' ? `Includes permanent ${MAIN_ADMIN_UID}` : 'Counter & field operators'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Accounts</div>
        <div class="stat-value font-mono tabular-nums" style="color:var(--success);">${stats.activeCount}</div>
        <div class="stat-desc">Sign-in enabled</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Inactive / Suspended</div>
        <div class="stat-value font-mono tabular-nums" style="color:${(stats.inactiveCount + stats.suspendedCount) > 0 ? 'var(--warning)' : 'var(--text-muted)'};">${stats.inactiveCount} / ${stats.suspendedCount}</div>
        <div class="stat-desc">Login blocked</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Next Auto User ID</div>
        <div class="stat-value font-mono tabular-nums" style="color:var(--blue-600); font-size:1.15rem;">${escHtml(stats.nextUidPreview)}</div>
        <div class="stat-desc">Atomic Universal Global SL counter (00000001+)</div>
      </div>
    </div>

    <div class="list-card" style="margin-bottom:1.5rem;">
      <div class="list-header" style="flex-wrap:wrap; gap:0.75rem;">
        <div>
          <h3 class="list-title">${activeSection === 'MANAGER' ? 'Master Administrator & Manager Directory' : 'Staff Account Directory'} (${filteredUsers.length} of ${sectionUsers.length})</h3>
          <p style="font-size:0.78rem; color:var(--text-muted); margin-top:0.2rem;">
            Permanent Master Admin ID: <strong class="font-mono">${MAIN_ADMIN_UID}</strong> (Immutable &amp; Protected) · Managed Format: <strong class="font-mono">MC-${activeSection === 'MANAGER' ? 'MGR' : 'STF'}-YYYY-XXXXXXXX</strong>
          </p>
        </div>
        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; min-width:min(100%, 240px); flex:1; max-width:420px;">
          <input
            type="search"
            id="user-directory-search-input"
            class="form-control"
            value="${escHtml(AppState.userSearchQuery || '')}"
            oninput="window.MJK.setUserSearch(this.value)"
            placeholder="Search User ID, Name, Username, Mobile, Email..."
          >
          ${AppState.userSearchQuery ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.setUserSearch('')">Clear</button>` : ''}
        </div>
      </div>

      <div class="table-responsive" style="overflow-x:auto; margin-top:0.75rem;">
        <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.82rem;">
          <thead>
            <tr style="border-bottom:2px solid var(--border-subtle); text-align:left; color:var(--text-muted); font-size:0.74rem; text-transform:uppercase;">
              <th style="padding:0.75rem 0.6rem;">User ID</th>
              <th style="padding:0.75rem 0.6rem;">Full Name &amp; Username</th>
              <th style="padding:0.75rem 0.6rem;">Role</th>
              <th style="padding:0.75rem 0.6rem;">Mobile &amp; Email</th>
              <th style="padding:0.75rem 0.6rem;">Created By / IST</th>
              <th style="padding:0.75rem 0.6rem;">Status</th>
              <th style="padding:0.75rem 0.6rem; text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filteredUsers.length === 0 ? `
              <tr><td colspan="7" style="padding:1.5rem; text-align:center; color:var(--text-muted);">No matching ${activeSection.toLowerCase()} accounts found.</td></tr>
            ` : filteredUsers.map(u => {
              const uid = String(u.uid || u.id || '').toUpperCase();
              const isPermanentMain = uid === MAIN_ADMIN_UID || u.isMainAdmin === true;
              const statusVal = String(u.status || 'ACTIVE').toUpperCase();
              const statusBadge =
                statusVal === 'ACTIVE' ? 'badge-success' :
                statusVal === 'INACTIVE' ? 'badge-warning' : 'badge-danger';
              const canManageRow = !isPermanentMain && (isActorAdmin || (isActorManager && String(u.role || '').toUpperCase() === 'STAFF'));

              return `
                <tr style="border-bottom:1px solid var(--border-subtle);">
                  <td style="padding:0.75rem 0.6rem;">
                    <div class="font-mono" style="font-weight:800; color:var(--blue-600);">${escHtml(uid)}</div>
                    ${isPermanentMain ? `<span class="badge badge-info" style="font-size:0.62rem; margin-top:0.2rem;">PERMANENT MAIN ADMIN</span>` : ''}
                  </td>
                  <td style="padding:0.75rem 0.6rem;">
                    <div style="font-weight:700; color:var(--text-main);">${escHtml(u.name)}</div>
                    <div class="font-mono" style="font-size:0.72rem; color:var(--text-muted);">@${escHtml(u.username || uid.toLowerCase())}${u.designation ? ` · ${escHtml(u.designation)}` : ''}</div>
                  </td>
                  <td style="padding:0.75rem 0.6rem;">
                    <span class="badge ${u.role === 'ADMIN' ? 'badge-primary' : u.role === 'MANAGER' ? 'badge-info' : 'badge-neutral'}">${escHtml(formatRoleLabel(u.role))}</span>
                  </td>
                  <td style="padding:0.75rem 0.6rem;">
                    <div class="font-mono">${escHtml(u.phoneMasked || (u.mobileNumber ? 'XXXXXX' + String(u.mobileNumber).slice(-4) : '-'))}</div>
                    ${u.aadhaarMasked ? `<div class="font-mono" style="font-size:0.71rem; color:var(--text-muted);">Aadhaar: ${escHtml(u.aadhaarMasked)}</div>` : ''}
                    ${u.email ? `<div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(u.email)}</div>` : ''}
                  </td>
                  <td style="padding:0.75rem 0.6rem;">
                    <div class="font-mono" style="font-size:0.74rem;">${escHtml(u.createdBy || 'SYSTEM')}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted);">${escHtml(u.registrationDate || formatDate(u.createdAt))}${u.registrationTime ? ` · ${escHtml(u.registrationTime)}` : ''}</div>
                  </td>
                  <td style="padding:0.75rem 0.6rem;">
                    <span class="badge ${statusBadge}" style="font-size:0.68rem;">${escHtml(statusVal)}</span>
                  </td>
                  <td style="padding:0.75rem 0.6rem; text-align:right;">
                    <div style="display:flex; gap:0.35rem; justify-content:flex-end; flex-wrap:wrap;">
                      <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.handleViewUserDetails('${escHtml(uid)}')">Details</button>
                      ${isPermanentMain ? `
                        <span class="font-mono" style="font-size:0.72rem; color:var(--text-muted); align-self:center; padding:0 0.35rem;">Protected</span>
                      ` : canManageRow ? `
                        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openEditUserModal('${escHtml(uid)}')">Edit</button>
                        <button type="button" class="btn btn-outline btn-sm" style="color:${statusVal === 'ACTIVE' ? 'var(--warning)' : 'var(--success)'};" onclick="window.MJK.handleToggleUserStatus('${escHtml(uid)}', '${statusVal === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}')">
                          ${statusVal === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                        ${statusVal !== 'SUSPENDED' ? `
                          <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.handleToggleUserStatus('${escHtml(uid)}', 'SUSPENDED')">Suspend</button>
                        ` : ''}
                        <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.handleResetStaffPassword('${escHtml(uid)}')">Temp Password</button>
                        ${isActorAdmin ? `
                          <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openUserPermissionsModal('${escHtml(uid)}')">Permissions</button>
                          <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.promptDeleteUserWithReason('${escHtml(uid)}', '${escAttrJs(u.name)}')">Delete</button>
                        ` : ''}
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="list-card" style="margin-bottom:1.5rem;">
      <div class="list-header">
        <div>
          <h3 class="list-title">Password Reset Reference Log (MUN-PWD-YYYY-XXXXXXXX)</h3>
          <p style="font-size:0.78rem; color:var(--text-muted); margin-top:0.2rem;">
            Official sequential reference numbers issued upon successful password recovery (no passwords stored in logs).
          </p>
        </div>
      </div>
      <div class="table-responsive" style="margin-top:0.75rem;">
        <table class="data-table" style="font-size:0.8rem;">
          <thead><tr><th>Reference Number</th><th>User ID</th><th>Reset Date (IST)</th><th>Reset Time (IST)</th><th>Status</th></tr></thead>
          <tbody>
            ${resetRefs.slice(0, 20).map(r => `
              <tr>
                <td class="font-mono" style="font-weight:700; color:var(--blue-600);">${escHtml(r.referenceNumber)}</td>
                <td class="font-mono">${escHtml(r.userId)}</td>
                <td class="font-mono">${escHtml(r.resetDate)}</td>
                <td class="font-mono">${escHtml(r.resetTime)}</td>
                <td><span class="badge badge-success">${escHtml(r.resetStatus || 'SUCCESSFUL')}</span></td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--text-muted);">No password reset receipts issued yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    ${isActorAdmin ? `
      <div class="erp-grid-2-tight" style="align-items:start; gap:1.25rem;">
        <div class="list-card">
          <div class="list-header">
            <div>
              <h3 class="list-title">Recent Login &amp; Security Activity</h3>
              <p style="font-size:0.78rem; color:var(--text-muted); margin-top:0.2rem;">Authentication, lockout protection &amp; MFA activity.</p>
            </div>
          </div>
          ${recentLogins.length === 0 ? `
            <div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.82rem;">No authentication activity recorded yet.</div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.75rem; max-height:300px; overflow-y:auto;">
              ${recentLogins.slice(0, 20).map(log => `
                <div style="padding:0.7rem 0.9rem; border:1px solid var(--border-subtle); border-radius:var(--radius-sm); background:var(--surface-alt); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; font-size:0.78rem;">
                  <div>
                    <span class="badge ${log.action === 'AUTH_LOGIN' ? 'badge-success' : log.action === 'ACCOUNT_LOCKED' || log.action === 'AUTH_LOGIN_FAILED' ? 'badge-danger' : 'badge-info'}" style="font-size:0.65rem; margin-right:0.4rem;">${escHtml(log.action)}</span>
                    <span style="color:var(--text-main);">${escHtml(log.details)}</span>
                  </div>
                  <div class="font-mono" style="font-size:0.72rem; color:var(--text-muted);">${escHtml(log.uid || log.user || 'SYSTEM')} · ${formatDateTime(log.timestamp)}</div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="list-card">
          <div class="list-header">
            <div>
              <h3 class="list-title">User Lifecycle Audit Trail</h3>
              <p style="font-size:0.78rem; color:var(--text-muted); margin-top:0.2rem;">SQLite audit log of account creation, edits, status &amp; resets.</p>
            </div>
          </div>
          ${userAuditLogs.length === 0 ? `
            <div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.82rem;">No account lifecycle events logged yet.</div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.75rem; max-height:300px; overflow-y:auto;">
              ${userAuditLogs.slice(0, 25).map(log => `
                <div style="padding:0.7rem 0.9rem; border:1px solid var(--border-subtle); border-radius:var(--radius-sm); background:var(--surface-alt); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; font-size:0.78rem;">
                  <div>
                    <span class="badge ${String(log.action).includes('CREAT') ? 'badge-success' : String(log.action).includes('DELET') ? 'badge-danger' : 'badge-info'}" style="font-size:0.65rem; margin-right:0.4rem;">${escHtml(log.action)}</span>
                    <strong style="color:var(--text-main);">${escHtml(log.details)}</strong>
                  </div>
                  <div class="font-mono" style="font-size:0.72rem; color:var(--text-muted);">By: <strong>${escHtml(log.uid || log.user || 'SYSTEM')}</strong> · ${formatDateTime(log.timestamp)}</div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    ` : ''}
  `;
}

/* =========================================================================
   SHELL & CORE LAYOUT RENDERER
   ========================================================================= */

export function render(explicitMount = null) {
  const validExplicit =
    explicitMount && typeof explicitMount === 'object' && 'innerHTML' in explicitMount ? explicitMount : null;
  const erpMount = validExplicit || document.getElementById('erp-root');
  const legacyRoot = document.getElementById('root');
  // If React owns #root and has not rendered #erp-root yet (e.g. Login page is active), do not overwrite React's DOM
  if (!erpMount && legacyRoot && legacyRoot.dataset.reactManaged === 'true') {
    return;
  }
  const root = erpMount || legacyRoot || document.body;
  const user = getCurrentUser();

  if (!user) {
    if (erpMount) {
      return;
    }
    root.innerHTML = renderLoginView();
    return;
  }

  if (AppState.currentRoute === 'login') {
    AppState.currentRoute = 'dashboard';
  }

  const profile = getBusinessProfile() || {};
  const units = getBusinessUnits();
  const activeUnit = getActiveUnit();
  const notifications = getSystemNotifications();

  // Centralized 11-Department ERP Sidebar Navigation (Zero duplicate menus)
  const badgeCounts = getDynamicNavBadgeCounts(user);
  const navItems = getSidebarNavCatalog(user);

  AppState.currentRoute = normalizeRoute(AppState.currentRoute);

  // Filter ERP Sidebar navigation based on role authorization
  const allowedNavItems = navItems.filter(item => canAccessRoute(item.id, user));
  const currentNavMeta = navItems.find(item => item.id === AppState.currentRoute);

  // Auto-open the active department accordion on first render if none is open yet
  if (!AppState.openNavGroup && currentNavMeta?.group) {
    AppState.openNavGroup = currentNavMeta.group;
  }

  const navSections = [];
  allowedNavItems.forEach((item) => {
    const last = navSections[navSections.length - 1];
    if (last && last.group === item.group) {
      last.items.push(item);
    } else {
      navSections.push({ group: item.group, items: [item] });
    }
  });

  const sidebarSearchQueryNorm = String(AppState.sidebarSearchQuery || '').trim().toLowerCase();

  const renderNavItemHtml = (item, isSubItem = false, deptTitle = '') => {
    const isActive = AppState.currentRoute === item.id;
    const hasBadge = typeof item.badge === 'number' ? item.badge > 0 : Boolean(item.badge);
    const searchHay = `${item.label} ${item.group} ${deptTitle} ${item.id} ${item.keywords || ''}`.toLowerCase();
    const isSearchHit = sidebarSearchQueryNorm ? searchHay.includes(sidebarSearchQueryNorm) : false;
    return `
      <div
        class="nav-item ${isSubItem ? 'nav-sub-item' : ''} ${isActive ? 'active' : ''} ${isSearchHit ? 'search-hit-item' : ''}"
        data-nav-id="${escAttrJs(item.id)}"
        data-search-text="${escAttrJs(searchHay)}"
        onclick="window.MJK.navigateTo('${escAttrJs(item.id)}')"
        title="${escAttrJs(item.label)}"
      >
        <span class="nav-icon">${getLucideIcon(item.icon, 16)}</span>
        <span style="overflow:hidden; text-overflow:ellipsis;">${escHtml(item.label)}</span>
        ${hasBadge ? `<span class="nav-badge ${item.badgeType || ''}">${item.badge}</span>` : ''}
      </div>
    `;
  };

  const navHtml = navSections.map(({ group, items }) => {
    if (!COLLAPSIBLE_NAV_GROUPS.has(group)) {
      return `
        <div class="nav-group-static">
          <div class="nav-group-title">${escHtml(group)}</div>
          ${items.map(item => renderNavItemHtml(item, false, group)).join('')}
        </div>
      `;
    }

    const meta = MenuMgmt.getDepartmentMeta(group);
    const hasSearchMatch = sidebarSearchQueryNorm
      ? (meta.title.toLowerCase().includes(sidebarSearchQueryNorm) || items.some(item => `${item.label} ${item.group} ${meta.title} ${item.id} ${item.keywords || ''}`.toLowerCase().includes(sidebarSearchQueryNorm)))
      : false;
    const isOpen = hasSearchMatch || AppState.openNavGroup === group;
    const hasActiveChild = items.some(item => item.id === AppState.currentRoute);
    const alertBadgeSum = items.reduce((acc, item) => (typeof item.badge === 'number' && item.badge > 0 ? acc + item.badge : acc), 0);

    return `
      <div
        class="nav-accordion-group ${isOpen ? 'open' : ''} ${hasSearchMatch ? 'search-expanded' : ''} ${hasActiveChild ? 'has-active' : ''} ${meta.isLpg ? 'is-lpg-dept' : ''}"
        data-nav-group="${escAttrJs(group)}"
        data-dept-title="${escAttrJs(meta.title.toLowerCase())}"
        style="--dept-accent:${meta.accent};"
      >
        <button
          type="button"
          class="nav-accordion-trigger"
          aria-expanded="${isOpen ? 'true' : 'false'}"
          title="${escAttrJs(meta.title)}"
          onclick="window.MJK.toggleNavGroup('${escAttrJs(group)}', event)"
        >
          <span class="nav-accordion-trigger-left">
            <span class="nav-accordion-icon" style="color:${meta.isLpg ? '#EF4444' : meta.accent};">${meta.icon}</span>
            <span class="nav-accordion-label">${escHtml(meta.title)}</span>
          </span>
          <span class="nav-accordion-right">
            ${alertBadgeSum > 0 ? `<span class="nav-accordion-alert">${alertBadgeSum}</span>` : ''}
            <span class="nav-accordion-count">${items.length}</span>
            <span class="nav-accordion-chevron" aria-hidden="true">${getLucideIcon('chevron-down', 14)}</span>
          </span>
        </button>
        <div class="nav-accordion-body">
          <div class="nav-accordion-inner">
            ${items.map(item => renderNavItemHtml(item, true, meta.title)).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Active view content with role-based route check & error guard
  let viewContent = '';
  try {
    if (!canAccessRoute(AppState.currentRoute, user)) {
      AppState.deniedRoute = AppState.currentRoute;
      viewContent = renderAccessDeniedView();
    } else {
      switch (AppState.currentRoute) {
        // 1. MAIN DASHBOARD
        case 'dashboard': viewContent = renderDashboardView(); break;
        case 'business-overview': viewContent = DeptViews.renderBusinessOverviewView(); break;
        case 'todays-summary': viewContent = DeptViews.renderTodaysSummaryView(); break;
        case 'pending-activities': viewContent = DeptViews.renderPendingActivitiesView(); break;
        case 'quick-actions': viewContent = DeptViews.renderQuickActionsView(); break;

        // 2. TEAM MANAGEMENT & HR INTEGRATION
        case 'staff-directory': viewContent = renderStaffDirectoryView(); break;
        case 'recruitment': viewContent = renderRecruitmentView(); break;
        case 'employee-profile': viewContent = renderEmployeeProfileView(); break;
        case 'attendance-tracking': viewContent = renderAttendanceLiveTrackingView(AppState); break;
        case 'staff-attendance':
          AppState.attendanceTab = 'daily';
          viewContent = renderAttendanceLiveTrackingView(AppState);
          break;
        case 'gps-attendance':
          AppState.attendanceTab = 'gps';
          viewContent = renderAttendanceLiveTrackingView(AppState);
          break;
        case 'staff-location-map':
          AppState.attendanceTab = 'map';
          viewContent = renderAttendanceLiveTrackingView(AppState);
          break;
        case 'attendance-photo-gallery':
          AppState.attendanceTab = 'gallery';
          viewContent = renderAttendanceLiveTrackingView(AppState);
          break;
        case 'leave-management': viewContent = renderLeaveManagementView(); break;
        case 'payroll':
        case 'salary-payroll': viewContent = renderSalaryPayrollView(); break;
        case 'payslips': viewContent = renderPayslipsView(); break;
        case 'tasks': viewContent = renderStaffTasksView(); break;
        case 'kpi-performance': viewContent = renderKpiPerformanceView(); break;
        case 'training': viewContent = renderTrainingView(); break;
        case 'documents': viewContent = renderTeamDocumentVaultView(); break;
        case 'offer-letters': viewContent = renderOfferLettersView(); break;
        case 'rewards-disciplinary': viewContent = renderRewardsDisciplinaryView(); break;
        case 'attendance-reports':
        case 'employee-reports': viewContent = renderEmployeePerformanceView(); break;
        case 'time-register': viewContent = renderTimeManagementView(); break;
        case 'chat': viewContent = TeamChat.renderChatView(); break;

        // 3. CUSTOMER MANAGEMENT
        case 'customers': viewContent = renderCustomersView(); break;
        case 'customer-registration': viewContent = renderCustomerRegistrationView(); break;
        case 'customer-profiles': viewContent = DeptViews.renderCustomerProfilesDirectoryView(); break;
        case 'customer-documents': viewContent = DeptViews.renderCustomerDocumentsView(); break;
        case 'followups': viewContent = renderFollowupsView(); break;
        case 'followups-today': viewContent = renderFollowupsView('today', 'cases'); break;
        case 'followups-upcoming': viewContent = renderFollowupsView('upcoming', 'cases'); break;
        case 'followups-overdue': viewContent = renderFollowupsView('overdue', 'cases'); break;
        case 'followups-pending': viewContent = renderFollowupsView('pending', 'cases'); break;
        case 'followups-completed': viewContent = renderFollowupsView('completed', 'cases'); break;
        case 'followups-review90': viewContent = renderFollowupsView('review90', 'cases'); break;
        case 'followups-reminders': viewContent = renderFollowupsView(null, 'reminders'); break;
        case 'customer-feedback': viewContent = DeptViews.renderCustomerFeedbackView(); break;
        case 'grievances': viewContent = renderGrievancesView(); break;
        case 'customer-dues': viewContent = DeptViews.renderCustomerDuesView(); break;
        case 'customer-reports': viewContent = DeptViews.renderCustomerReportsView(); break;

        // 4. SALES & BILLING
        case 'sales-dashboard': viewContent = DeptViews.renderSalesDashboardView(); break;
        case 'new-invoice':
        case 'invoices': viewContent = renderInvoicesView(); break;
        case 'quotations': viewContent = DeptViews.renderQuotationsView(); break;
        case 'estimates': viewContent = DeptViews.renderEstimatesView(); break;
        case 'sales-returns': viewContent = DeptViews.renderSalesReturnsView(); break;
        case 'credit-notes': viewContent = DeptViews.renderCreditNotesView(); break;
        case 'gst-billing': viewContent = DeptViews.renderGstBillingView(); break;
        case 'customer-ledger': viewContent = DeptViews.renderCustomerLedgerView(); break;
        case 'sales-reports': viewContent = DeptViews.renderSalesReportsView(); break;

        // 5. INVENTORY & PURCHASE
        case 'inventory-dashboard': viewContent = DeptViews.renderInventoryDashboardView(); break;
        case 'inventory': viewContent = renderInventoryView(); break;
        case 'product-categories': viewContent = DeptViews.renderProductCategoriesView(); break;
        case 'stock-adjustment': viewContent = DeptViews.renderStockAdjustmentView(); break;
        case 'purchase-orders': viewContent = DeptViews.renderPurchaseOrdersView(); break;
        case 'suppliers': viewContent = DeptViews.renderSuppliersMasterView(); break;
        case 'purchase-bills': viewContent = DeptViews.renderPurchaseBillsView(); break;
        case 'stock-transfers': viewContent = DeptViews.renderStockTransfersView(); break;
        case 'low-stock-alerts': viewContent = DeptViews.renderLowStockAlertsView(); break;
        case 'barcode-management': viewContent = DeptViews.renderBarcodeManagementView(); break;
        case 'inventory-reports': viewContent = DeptViews.renderInventoryReportsView(); break;

        // 6. FINANCE & ACCOUNTING
        case 'finance-dashboard': viewContent = DeptViews.renderFinanceDashboardView(); break;
        case 'bank-accounts': viewContent = DeptViews.renderBankAccountsView(); break;
        case 'daily-transactions': viewContent = DeptViews.renderDailyTransactionsView(); break;
        case 'counter-daybook':
        case 'daybook': viewContent = renderCounterDayBookView(); break;
        case 'daily-opening-cash': viewContent = renderDailyOpeningCashView(); break;
        case 'daily-closing-cash': viewContent = renderDailyClosingCashView(); break;
        case 'cash-reports': viewContent = renderCashReportsView(); break;
        case 'income': viewContent = renderIncomeView(); break;
        case 'expenses': viewContent = renderExpensesView(); break;
        case 'payments': viewContent = renderPaymentsView(); break;
        case 'accounts-payable': viewContent = DeptViews.renderAccountsPayableView(); break;
        case 'accounts-receivable': viewContent = DeptViews.renderAccountsReceivableView(); break;
        case 'general-ledger': viewContent = DeptViews.renderGeneralLedgerView(); break;
        case 'journal-entries': viewContent = DeptViews.renderJournalEntriesView(); break;
        case 'bank-reconciliation': viewContent = DeptViews.renderBankReconciliationView(); break;
        case 'gst-management': viewContent = DeptViews.renderGstManagementView(); break;
        case 'financial-reports': viewContent = DeptViews.renderFinancialReportsHubView(); break;
        case 'profit-loss': viewContent = DeptViews.renderProfitLossView(); break;
        case 'balance-sheet': viewContent = DeptViews.renderBalanceSheetView(); break;

        // 7. LPG & GAS SERVICES
        case 'gas-dashboard': viewContent = renderGasDashboardView(AppState); break;
        case 'gas-customers': viewContent = renderGasCustomersView(AppState); break;
        case 'gas-new-booking':
        case 'gas-bookings': viewContent = renderGasBookingsView(AppState); break;
        case 'gas-delivery-management': viewContent = DeptViews.renderGasDeliveryManagementView(); break;
        case 'gas-collections': viewContent = renderGasCollectionsView(AppState); break;
        case 'gas-subsidy': viewContent = renderGasSubsidyView(AppState); break;
        case 'gas-non-taker': viewContent = renderGasNonTakerView(AppState); break;
        case 'gas-eligibility': viewContent = renderGasEligibilityView(AppState); break;
        case 'gas-accessories': viewContent = renderGasAccessoriesView(AppState); break;
        case 'gas-storage': viewContent = renderGasStorageView(AppState); break;
        case 'gas-suppliers': viewContent = renderGasSuppliersView(AppState); break;
        case 'gas-service-replacement': viewContent = renderGasServiceReplacementView(AppState); break;
        case 'gas-complaints': viewContent = DeptViews.renderGasComplaintsView(); break;
        case 'gas-reports': viewContent = renderGasReportsView(AppState); break;
        case 'gas-settings': viewContent = renderGasSettingsView(AppState); break;

        // 2. SERVICES (ANNAPURNA YOJANA SYSTEM & BANGLAR YUVA SIKSHA BARASA CARD)
        case 'govt-annapurna':
        case 'annapurna-applications':
        case 'annapurna-complaints':
        case 'annapurna-timeline':
        case 'annapurna-reports':
          viewContent = renderGovtAnnapurnaView();
          break;
        case 'yuva-siksha-barasa':
          viewContent = renderYuvaSikshaBarasaView();
          break;

        // 8. OPERATIONS MANAGEMENT
        case 'operations-dashboard': viewContent = DeptViews.renderOperationsDashboardView(); break;
        case 'daily-task-manager': viewContent = DeptViews.renderDailyTaskManagerView(); break;
        case 'service-requests': viewContent = DeptViews.renderServiceRequestsView(); break;
        case 'service-delivery-tracking': viewContent = DeptViews.renderServiceDeliveryTrackingView(); break;
        case 'document-processing': viewContent = DeptViews.renderDocumentProcessingView(); break;
        case 'banking': viewContent = renderBankingView(); break;
        case 'indusind-bc': viewContent = DeptViews.renderIndusIndBcView(); break;
        case 'cyber-cafe-ops': viewContent = DeptViews.renderCyberCafeOpsView(); break;
        case 'applications': viewContent = EnterpriseExt.renderApplicationsView(); break;
        case 'services': viewContent = renderServicesView(); break;
        case 'rate-chart': viewContent = renderRateChartView(); break;
        case 'operational-reports': viewContent = DeptViews.renderOperationalReportsView(); break;

        // 9. GROWTH & MARKETING
        case 'growth-dashboard': viewContent = DeptViews.renderGrowthDashboardView(); break;
        case 'growth-plan': viewContent = DeptViews.renderGrowthPlanView(); break;
        case 'targets': viewContent = renderTargetsView(); break;
        case 'profit-targets': viewContent = DeptViews.renderProfitTargetsView(); break;
        case 'marketing': viewContent = renderMarketingView(); break;
        case 'promotions-offers': viewContent = DeptViews.renderPromotionsOffersView(); break;
        case 'customer-acquisition': viewContent = DeptViews.renderCustomerAcquisitionView(); break;
        case 'referral-management': viewContent = DeptViews.renderReferralManagementView(); break;
        case 'lead-management': viewContent = DeptViews.renderLeadManagementView(); break;
        case 'projects': viewContent = renderProjectsView(); break;
        case 'investments': viewContent = renderInvestmentsView(); break;
        case 'competitors': viewContent = renderCompetitorsView(); break;
        case 'growth-reports': viewContent = DeptViews.renderGrowthReportsView(); break;

        // 10. REPORTS & ANALYTICS
        case 'reports': viewContent = renderReportsView(); break;
        case 'daily-reports': viewContent = DeptViews.renderDailyReportsAnalyticsView(); break;
        case 'monthly-reports': viewContent = DeptViews.renderMonthlyReportsAnalyticsView(); break;
        case 'employee-performance-analytics': viewContent = DeptViews.renderEmployeePerformanceAnalyticsView(); break;
        case 'sales-analytics': viewContent = DeptViews.renderSalesAnalyticsView(); break;
        case 'purchase-analytics': viewContent = DeptViews.renderPurchaseAnalyticsView(); break;
        case 'inventory-analytics': viewContent = DeptViews.renderInventoryAnalyticsView(); break;
        case 'financial-analytics': viewContent = DeptViews.renderFinancialAnalyticsView(); break;
        case 'customer-analytics': viewContent = DeptViews.renderCustomerAnalyticsView(); break;
        case 'department-reports': viewContent = DeptViews.renderDepartmentReportsView(); break;
        case 'custom-report-builder': viewContent = DeptViews.renderCustomReportBuilderView(); break;
        case 'pdf-excel-export': viewContent = DeptViews.renderPdfExcelExportCenterView(); break;

        // 11. SYSTEM & SECURITY & ADMINISTRATION
        case 'universal-search': viewContent = EnterpriseExt.renderUniversalSearchView(); break;
        case 'business': viewContent = renderBusinessView(); break;
        case 'admin-managers': viewContent = renderAdministrationUsersView('MANAGER'); break;
        case 'admin-staff': viewContent = renderAdministrationUsersView('STAFF'); break;
        case 'menu-management': viewContent = MenuMgmt.renderMenuManagementView({ baseCatalog: getBaseSidebarNavCatalog(user) }); break;
        case 'login-history': viewContent = DeptViews.renderLoginHistoryView(); break;
        case 'audit-logs': viewContent = DeptViews.renderSystemAuditLogsView(); break;
        case 'activity-logs': viewContent = DeptViews.renderActivityLogsView(); break;
        case 'notification-settings': viewContent = DeptViews.renderNotificationSettingsView(); break;
        case 'database-management': viewContent = DeptViews.renderDatabaseManagementView(); break;
        case 'data-import-export': viewContent = DeptViews.renderDataImportExportView(); break;
        case 'locations-master': viewContent = EnterpriseExt.renderLocationsMasterView(); break;
        case 'admin-settings': viewContent = renderAdminSettingsView(); break;
        case 'settings': viewContent = renderSettingsView(); break;
        case 'security-settings': viewContent = DeptViews.renderSecuritySettingsView(); break;

        case 'access-denied': viewContent = renderAccessDeniedView(); break;
        default:
          if (String(AppState.currentRoute).startsWith('custom-menu-')) {
            viewContent = MenuMgmt.renderCustomMenuRouteView(AppState.currentRoute, { navigateTo });
          } else {
            viewContent = renderDashboardView();
          }
      }
    }
  } catch (viewErr) {
    console.error('View render error:', viewErr);
    viewContent = `
      <div class="card" style="padding:2rem; text-align:center; max-width:520px; margin:2rem auto;">
        <h3 style="margin-bottom:0.5rem;">Unable to render view</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">${escHtml(viewErr?.message || 'Unexpected rendering error')}</p>
        <button type="button" class="btn btn-primary" onclick="window.MJK.navigateTo('dashboard')">Return to Dashboard</button>
      </div>
    `;
  }

  // Contextual department quick bars preserving access to companion cash/team/lpg/admin tabs without sidebar duplication
  const activeGroup = currentNavMeta?.group || (
    ['daily-opening-cash', 'cash-reports'].includes(AppState.currentRoute) ? 'FINANCE & ACCOUNTING' :
    ['time-register', 'chat'].includes(AppState.currentRoute) ? 'TEAM MANAGEMENT' :
    ['gas-non-taker', 'gas-storage', 'gas-suppliers', 'gas-service-replacement', 'gas-settings'].includes(AppState.currentRoute) ? 'LPG & GAS SERVICES' :
    AppState.currentRoute === 'admin-settings' ? 'SYSTEM & SECURITY' : ''
  );

  if (activeGroup === 'FINANCE & ACCOUNTING') {
    const finTabs = [
      { id: 'finance-dashboard', label: 'Finance Home' },
      { id: 'counter-daybook', label: 'Counter Day Book' },
      { id: 'daily-opening-cash', label: 'Daily Opening Cash' },
      { id: 'daily-closing-cash', label: 'Daily Closing Cash' },
      { id: 'cash-reports', label: 'Cash Reports' },
      { id: 'payments', label: 'Payments' },
      { id: 'expenses', label: 'Expenses' },
      { id: 'profit-loss', label: 'Profit & Loss' }
    ].filter(t => canAccessRoute(t.id, user));
    if (finTabs.length) {
      viewContent = `
        <div class="finance-subnav-bar no-print" role="navigation" aria-label="Finance Quick Modules">
          <span class="finance-subnav-title">${getLucideIcon('wallet', 15)} Finance</span>
          ${finTabs.map(t => `<button type="button" class="finance-subnav-btn ${AppState.currentRoute === t.id ? 'active' : ''}" onclick="window.MJK.navigateTo('${t.id}')">${escHtml(t.label)}</button>`).join('')}
        </div>
      ` + viewContent;
    }
  } else if (activeGroup === 'TEAM MANAGEMENT') {
    const teamTabs = [
      { id: 'staff-directory', label: 'Employees' },
      { id: 'employee-profile', label: 'Employee Profile' },
      { id: 'attendance-tracking', label: 'Attendance' },
      { id: 'time-register', label: 'Time Register' },
      { id: 'leave-management', label: 'Leaves' },
      { id: 'salary-payroll', label: 'Payroll' },
      { id: 'payslips', label: 'Payslips' },
      { id: 'tasks', label: 'Tasks' },
      { id: 'kpi-performance', label: 'KPI / KRA' },
      { id: 'chat', label: 'Team Chat' }
    ].filter(t => canAccessRoute(t.id, user));
    if (teamTabs.length) {
      viewContent = `
        <div class="finance-subnav-bar no-print" role="navigation" aria-label="Team Quick Modules">
          <span class="finance-subnav-title">${getLucideIcon('users', 15)} Team &amp; HR</span>
          ${teamTabs.map(t => `<button type="button" class="finance-subnav-btn ${AppState.currentRoute === t.id ? 'active' : ''}" onclick="window.MJK.navigateTo('${t.id}')">${escHtml(t.label)}</button>`).join('')}
        </div>
      ` + viewContent;
    }
  } else if (activeGroup === 'LPG & GAS SERVICES') {
    const gasTabs = [
      { id: 'gas-dashboard', label: 'Gas Dashboard' },
      { id: 'gas-customers', label: 'Consumers' },
      { id: 'gas-bookings', label: 'Bookings' },
      { id: 'gas-delivery-management', label: 'Delivery' },
      { id: 'gas-collections', label: 'Payments' },
      { id: 'gas-subsidy', label: 'Subsidy' },
      { id: 'gas-non-taker', label: 'Non-Taker Ledger' },
      { id: 'gas-storage', label: 'Storage' },
      { id: 'gas-suppliers', label: 'Suppliers' },
      { id: 'gas-service-replacement', label: 'Service/Replace' },
      { id: 'gas-settings', label: 'Gas Settings' }
    ].filter(t => canAccessRoute(t.id, user));
    if (gasTabs.length) {
      viewContent = `
        <div class="finance-subnav-bar no-print" role="navigation" aria-label="LPG Gas Modules">
          <span class="finance-subnav-title">${getLucideIcon('flame', 15)} LPG &amp; Gas</span>
          ${gasTabs.map(t => `<button type="button" class="finance-subnav-btn ${AppState.currentRoute === t.id ? 'active' : ''}" onclick="window.MJK.navigateTo('${t.id}')">${escHtml(t.label)}</button>`).join('')}
        </div>
      ` + viewContent;
    }
  } else if (activeGroup === 'SYSTEM & SECURITY' && canAccessRoute('admin-settings', user)) {
    const sysTabs = [
      { id: 'rate-chart', label: 'Service Rate Chart' },
      { id: 'settings', label: 'System Settings' },
      { id: 'menu-management', label: 'Menu Management' },
      { id: 'admin-settings', label: 'UPI QR & Dynamic Options' },
      { id: 'admin-managers', label: 'Administration (Managers)' },
      { id: 'admin-staff', label: 'Administration (Staff)' },
      { id: 'database-management', label: 'Database Health' },
      { id: 'security-settings', label: 'Security Policy' }
    ].filter(t => canAccessRoute(t.id, user));
    viewContent = `
      <div class="finance-subnav-bar no-print" role="navigation" aria-label="System Quick Links">
        <span class="finance-subnav-title">${getLucideIcon('shield-check', 15)} System</span>
        ${sysTabs.map(t => `<button type="button" class="finance-subnav-btn ${AppState.currentRoute === t.id ? 'active' : ''}" onclick="window.MJK.navigateTo('${t.id}')">${escHtml(t.label)}</button>`).join('')}
      </div>
    ` + viewContent;
  }

  const sidebarSearchQuery = AppState.sidebarSearchQuery || '';
  const sidebarSearchResultsHtml = renderSidebarSearchDropdownHtml(sidebarSearchQuery, allowedNavItems);
  const userPhoto = user.photoUrl || user.avatarUrl || '';
  const userInitials = String(user.name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'U';
  const userAvatarHtml = userPhoto
    ? `<img src="${escHtml(userPhoto)}" alt="${escAttrJs(user.name)}" style="width:100%; height:100%; object-fit:cover; border-radius:9999px;" />`
    : escHtml(userInitials);
  const userStatusLabel = String(user.status || 'ACTIVE').toUpperCase();
  const statusColor = userStatusLabel === 'ACTIVE' ? '#10B981' : userStatusLabel === 'PENDING' ? '#F59E0B' : '#EF4444';

  root.innerHTML = `
    <div class="app-layout">
      <!-- Mobile Backdrop -->
      <div id="sidebar-backdrop" class="sidebar-backdrop" onclick="window.MJK.toggleMobileSidebar()"></div>

      <!-- Midnight Navy Corporate ERP Sidebar -->
      <aside id="app-sidebar" class="sidebar ${AppState.sidebarCollapsed ? 'collapsed' : ''}">
        <div class="sidebar-header">
          <div class="brand-lockup" onclick="window.MJK.navigateTo('dashboard')" style="cursor:pointer;">
            <div class="brand-logo-icon" title="MUN COMPUTER">
              <img src="/assets/aistudio/MUN_Computer_Tech_Logo_35ee99e8.png" alt="MUN COMPUTER Logo" class="brand-logo-img" />
            </div>
            <div class="brand-text">
              <span class="brand-title">MUN COMPUTER</span>
              <span class="brand-sub">CORPORATE ERP SYSTEM</span>
            </div>
          </div>
          <button type="button" class="sidebar-collapse-btn" onclick="window.MJK.toggleSidebarCollapse()" title="Toggle Sidebar Width">
            ${getLucideIcon('panel-left', 17)}
          </button>
          <button type="button" class="sidebar-close-mobile" onclick="window.MJK.toggleMobileSidebar()" aria-label="Close Menu" title="Close Menu">${getLucideIcon('x', 18)}</button>
        </div>

        <!-- Business Unit Indicator -->
        <div class="unit-selector-wrapper">
          <div class="unit-selector-box" onclick="window.MJK.openUnitSwitchModal()" title="Business Unit: MUN COMPUTER">
            <div class="unit-info">
              <span class="unit-label">BUSINESS UNIT</span>
              <span class="unit-name">MUN COMPUTER</span>
            </div>
            <span class="unit-badge-official">ERP</span>
          </div>
        </div>

        <!-- Universal Live Sidebar Search -->
        <div class="sidebar-search-wrap">
          <div class="sidebar-search-box">
            <span class="sidebar-search-icon">${getLucideIcon('search', 14)}</span>
            <input
              id="sidebar-live-search-input"
              type="text"
              class="sidebar-search-input"
              placeholder="Search department or menu..."
              value="${escHtml(sidebarSearchQuery)}"
              oninput="window.MJK.handleSidebarSearchInput(this.value)"
              autocomplete="off"
            >
            ${sidebarSearchQuery ? `<button type="button" class="sidebar-search-clear" onclick="window.MJK.clearSidebarSearch()" title="Clear search">${getLucideIcon('x', 13)}</button>` : ''}
          </div>
          <div id="sidebar-search-results" class="sidebar-search-results ${sidebarSearchQuery ? 'open' : ''}">
            ${sidebarSearchResultsHtml}
          </div>
        </div>

        <!-- Live Pending Tasks & Alerts Counter -->
        <div class="sidebar-pending-summary" onclick="window.MJK.navigateTo('pending-activities')" title="Click to open Pending Activities Center">
          <span style="display:inline-flex; align-items:center; gap:0.35rem;">
            ${getLucideIcon('bell', 14)}
            <span>Pending Tasks &amp; Alerts</span>
          </span>
          <strong class="tabular-nums" style="color:${badgeCounts.totalPendingActivities > 0 ? '#D6B56D' : '#10B981'};">${badgeCounts.totalPendingActivities}</strong>
        </div>

        <!-- Centralized 11-Department Navigation -->
        <nav class="sidebar-nav">
          ${navHtml}
        </nav>

        <!-- Sidebar Footer (User Account Summary) -->
        <div class="sidebar-footer">
          <div class="user-snippet" onclick="window.MJK.openUserProfileModal()" style="cursor:pointer;" title="Open My Profile (${escAttrJs(user.uid || user.role)})">
            <div class="user-avatar">${userAvatarHtml}</div>
            <div class="user-details">
              <span class="user-name">${escHtml(user.name)}</span>
              <span class="user-role-badge">${formatRoleLabel(user.role)}</span>
            </div>
          </div>
          <button type="button" class="btn-icon" style="background:transparent; border-color:rgba(148,163,184,0.22); box-shadow:none; color:#CBD5E1; display:inline-flex; align-items:center; justify-content:center;" onclick="window.MJK.handleLogout()" title="Logout from MUN COMPUTER">
            ${getLucideIcon('log-out', 17)}
          </button>
        </div>
      </aside>

      <!-- Main Content Wrapper -->
      <div class="main-wrapper">
        <!-- Top Branding & Navigation Bar -->
        <header class="topbar">
          <div class="topbar-left">
            <button type="button" id="mobile-menu-toggle-btn" class="menu-toggle-mobile" onclick="window.MJK.toggleMobileSidebar()" aria-label="Open Menu" aria-expanded="false">
              ${getLucideIcon('menu', 19)}
            </button>
            <div class="topbar-brand-lockup" onclick="window.MJK.navigateTo('dashboard')" title="MUN COMPUTER">
              <div class="topbar-brand-badge">
                <img src="/assets/aistudio/MUN_Computer_Tech_Logo_35ee99e8.png" alt="MUN COMPUTER Logo" class="topbar-brand-logo" />
              </div>
              <div class="topbar-brand-copy">
                <span class="topbar-brand-name">MUN COMPUTER</span>
              </div>
            </div>
          </div>

          <div class="topbar-right">
            <!-- Compact ERP Search Bar (Directly Left of Profile Menu) -->
            <div class="search-input-box" onclick="window.MJK.openGlobalSearch()" style="cursor:pointer;" title="Search ERP (Ctrl+K)">
              <span class="search-icon-pos">${getLucideIcon('search', 14)}</span>
              <input type="text" placeholder="Search ERP..." aria-label="Search ERP" readonly>
            </div>
            <button type="button" class="topbar-btn mobile-search-btn" onclick="window.MJK.openGlobalSearch()" title="Search ERP (Ctrl+K)">
              ${getLucideIcon('search', 16)}
            </button>

            <!-- User Profile Trigger & Dropdown -->
            <div class="topbar-profile-wrap">
              <button
                type="button"
                id="topbar-profile-trigger"
                class="topbar-profile-trigger"
                aria-haspopup="true"
                aria-expanded="false"
                onclick="window.MJK.toggleTopbarProfileMenu(event)"
                title="${escAttrJs(user.name)} (${escAttrJs(user.uid || user.role)})"
              >
                <span class="topbar-profile-avatar">${userAvatarHtml}</span>
                <span class="topbar-profile-meta">
                  <span class="topbar-profile-name">${escHtml(user.name)}</span>
                  <span class="topbar-profile-role">${escHtml(formatRoleLabel(user.role))}</span>
                </span>
                <span class="topbar-profile-chevron">${getLucideIcon('chevron-down', 14)}</span>
              </button>

              <div id="topbar-profile-dropdown" class="topbar-profile-dropdown" role="menu">
                <div class="topbar-profile-card">
                  <div class="topbar-profile-avatar-lg">${userAvatarHtml}</div>
                  <div style="min-width:0; flex:1;">
                    <div class="topbar-profile-card-name">${escHtml(user.name)}</div>
                    <div class="topbar-profile-card-uid font-mono">${escHtml(user.uid || user.id || 'N/A')}</div>
                    <div class="topbar-profile-card-badges">
                      <span class="topbar-profile-role-pill">${escHtml(formatRoleLabel(user.role))}</span>
                      <span class="topbar-profile-status-pill" style="color:${statusColor};">
                        <span class="status-dot" style="background:${statusColor};"></span>
                        ${escHtml(userStatusLabel)}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="topbar-profile-menu-list">
                  <button type="button" class="topbar-profile-menu-item" onclick="window.MJK.closeTopbarProfileMenu(); window.MJK.openUserProfileModal()">
                    ${getLucideIcon('user-round', 15)} <span>My Profile</span>
                  </button>
                  <button type="button" class="topbar-profile-menu-item" onclick="window.MJK.closeTopbarProfileMenu(); window.MJK.openChangePasswordModal()">
                    ${getLucideIcon('key-round', 15)} <span>Change Password</span>
                  </button>
                  <button type="button" class="topbar-profile-menu-item" onclick="window.MJK.closeTopbarProfileMenu(); window.MJK.navigateTo('${canAccessRoute('settings', user) ? 'settings' : 'employee-profile'}')">
                    ${getLucideIcon('settings', 15)} <span>Account Settings</span>
                  </button>
                  <button type="button" class="topbar-profile-menu-item" onclick="window.MJK.closeTopbarProfileMenu(); ${canAccessRoute('security-settings', user) ? "window.MJK.navigateTo('security-settings')" : 'window.MJK.openUserProfileModal()'}">
                    ${getLucideIcon('shield-check', 15)} <span>Security Settings</span>
                  </button>
                  <div class="topbar-profile-divider"></div>
                  <button type="button" class="topbar-profile-menu-item" onclick="window.MJK.closeTopbarProfileMenu(); window.MJK.openNotificationsModal()">
                    ${getLucideIcon('bell', 15)}
                    <span style="flex:1;">Notifications</span>
                    ${notifications.length > 0 ? `<span class="topbar-menu-badge tabular-nums">${notifications.length}</span>` : ''}
                  </button>
                  <button type="button" class="topbar-profile-menu-item" onclick="window.MJK.closeTopbarProfileMenu(); window.MJK.toggleTheme()">
                    ${AppState.theme === 'dark' ? getLucideIcon('sun', 15) : getLucideIcon('moon', 15)}
                    <span style="flex:1;">${AppState.theme === 'dark' ? 'Day Mode (Light)' : 'Night Mode (Dark)'}</span>
                  </button>
                  <button type="button" class="topbar-profile-menu-item" onclick="window.MJK.closeTopbarProfileMenu(); window.dispatchEvent(new CustomEvent('mun-open-pwa-install'))">
                    ${getLucideIcon('smartphone', 15)}
                    <span style="flex:1;">App / Mobile Link</span>
                  </button>
                  <div class="topbar-profile-divider"></div>
                  <button type="button" class="topbar-profile-menu-item danger" onclick="window.MJK.closeTopbarProfileMenu(); window.MJK.handleLogout()">
                    ${getLucideIcon('log-out', 15)} <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- Main Workspace Container -->
        <main class="page-container">
          ${viewContent}
        </main>
      </div>
    </div>
  `;
  ensureGlobalModalOverlay();
  if (AppState.currentRoute === 'universal-search') {
    EnterpriseExt.initUniversalSearchAfterRender();
  } else if (AppState.currentRoute === 'applications') {
    EnterpriseExt.refreshApplicationsList();
  } else if (AppState.currentRoute === 'locations-master') {
    EnterpriseExt.loadLocationsMasterBody();
  } else if (AppState.currentRoute === 'chat') {
    TeamChat.initChatViewAfterRender();
  }
  if (typeof DeptViews.initChartsAfterRender === 'function') {
    DeptViews.initChartsAfterRender(AppState.currentRoute);
  }
  if (typeof initAnnapurnaChartsAfterRender === 'function') {
    initAnnapurnaChartsAfterRender(AppState.currentRoute);
  }
  if (typeof initYuvaChartsAfterRender === 'function') {
    initYuvaChartsAfterRender(AppState.currentRoute);
  }
}

/* =========================================================================
   PUBLIC ACTIONS ATTACHED TO window.MJK
   ========================================================================= */

window.MJK = {
  ...EnterpriseExt,
  ...TeamChat,
  navigateTo,
  syncAnnapurnaSubRoute: (tabId) => {
    const map = {
      dashboard: 'govt-annapurna',
      'add-case': 'govt-annapurna',
      verification: 'annapurna-applications',
      documents: 'govt-annapurna',
      applications: 'annapurna-applications',
      complaints: 'annapurna-complaints',
      timeline: 'annapurna-timeline',
      reports: 'annapurna-reports',
      masters: 'govt-annapurna'
    };
    const nextRoute = map[tabId] || 'govt-annapurna';
    AppState.currentRoute = nextRoute;
    AppState.openNavGroup = 'ANNAPURNA YOJANA SYSTEM';
    if (window.location.hash !== `#${nextRoute}`) {
      window.location.hash = `#${nextRoute}`;
    }
  },
  closeModal,
  toggleTheme,
  openGlobalSearch: EnterpriseExt.openServerGlobalSearch || openGlobalSearch,
  copyText: (text, label) => {
    const successMsg = label || 'Copied to clipboard!';
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg, 'success');
      }).catch(() => {
        fallbackCopy(text, successMsg);
      });
    } else {
      fallbackCopy(text, successMsg);
    }
    function fallbackCopy(str, msg) {
      try {
        const el = document.createElement('textarea');
        el.value = str;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast(msg, 'success');
      } catch (err) {
        showToast('Text ready to copy', 'info');
      }
    }
  },
  copyCorporateSection: (key) => {
    if (key === 'all') {
      const full = Object.entries(CORPORATE_PROFILE_SECTIONS).map(([k, v]) => v).join('\n\n========================================\n\n');
      window.MJK.copyText(full, 'Full Corporate Profile copied to clipboard!');
      return;
    }
    const text = CORPORATE_PROFILE_SECTIONS[key];
    if (text) {
      window.MJK.copyText(text, 'Section copied to clipboard!');
    }
  },
  setDateFilter: (filter) => {
    if (filter === 'custom') {
      const today = getTodayDate();
      if (!AppState.customDateStart) AppState.customDateStart = `${today.slice(0, 7)}-01`;
      if (!AppState.customDateEnd) AppState.customDateEnd = today;
    }
    AppState.dateFilter = filter;
    render();
  },
  setCustomDateRange: (start, end) => {
    AppState.dateFilter = 'custom';
    if (start) AppState.customDateStart = start;
    if (end) AppState.customDateEnd = end;
    render();
  },
  setReportTab: (tab) => {
    const allowed = ['financial', 'customer-service', 'staff-operations', 'growth-followups'];
    AppState.reportTab = allowed.includes(tab) ? tab : 'financial';
    render();
  },
  setReportSearch: (q) => {
    AppState.reportSearchQuery = q;
    scheduleSearchRender('reports-filter-search');
  },
  setReportFilter: (field, val) => {
    if (field === 'reset') {
      AppState.reportSearchQuery = '';
      AppState.reportStatusFilter = 'all';
      AppState.reportCategoryFilter = 'all';
    } else if (field === 'status') {
      AppState.reportStatusFilter = val || 'all';
    } else if (field === 'category') {
      AppState.reportCategoryFilter = val || 'all';
    }
    render();
  },
  setCustomerSearch: (q) => {
    AppState.searchQuery = q;
    scheduleSearchRender('universal-customer-search-input');
  },
  setServiceSearch: (q) => {
    AppState.serviceSearchQuery = q;
    scheduleSearchRender('service-directory-search-input');
  },
  setServiceCatFilter: (cat) => {
    AppState.serviceCategoryFilter = cat;
    render();
  },
  setServiceStatusFilter: (st) => {
    AppState.serviceStatusFilter = st;
    render();
  },
  setUserSearch: (q) => {
    AppState.userSearchQuery = q;
    scheduleSearchRender('user-directory-search-input');
  },
  toggleNavGroup,
  closeNavAccordions,
  toggleSidebarCollapse: () => {
    AppState.sidebarCollapsed = !AppState.sidebarCollapsed;
    render();
  },
  toggleMobileSidebar: () => {
    const sb = document.getElementById('app-sidebar');
    const bd = document.getElementById('sidebar-backdrop');
    const toggleBtn = document.getElementById('mobile-menu-toggle-btn');
    const isOpen = sb ? sb.classList.toggle('mobile-open') : false;
    if (bd) bd.classList.toggle('active', isOpen);
    document.body.classList.toggle('mobile-drawer-open', isOpen);
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  },
  setLoginRoleMode: (mode) => {
    AppState.loginRoleMode = mode;
    render();
  },
  toggleLoginPwdVisibility: () => {
    const input = document.getElementById('login-password');
    const label = document.getElementById('login-pwd-toggle-label');
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    if (label) label.textContent = isPass ? 'Hide Password 🔒' : 'Show Password 👁️';
  },
  handleLogin: async (e) => {
    e.preventDefault();
    const u = (document.getElementById('login-username')?.value || '').trim();
    const p = (document.getElementById('login-password')?.value || '').trim();
    const btn = document.getElementById('btn-erp-login');

    if (!u || !p) {
      showToast('Please enter User ID and Password.', 'danger');
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Verifying Credentials...`;
    }
    try {
      const res = await authenticateAsync(u, p, AppState.loginRoleMode || 'ADMIN');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `Sign In →`;
      }
      if (res.success) {
        if (res.mustChangePassword) {
          window.MJK.openMandatoryPasswordChangeModal(res.user, p);
          return;
        }
        await refreshSessionPermissions();
        showToast(`Welcome back, ${res.user.name} (${formatRoleLabel(res.user.role)})!`, 'success');
        AppState.currentRoute = 'dashboard';
        window.location.hash = '#dashboard';
        render();
      } else {
        showToast(res.message || 'Authentication failed.', 'danger');
      }
    } catch {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `Sign In →`;
      }
      showToast('Login error. Please verify your credentials.', 'danger');
    }
  },
  toggleModalPwdField: (inputId, btnEl) => {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    const isPwd = inp.type === 'password';
    inp.type = isPwd ? 'text' : 'password';
    if (btnEl) btnEl.textContent = isPwd ? 'Hide' : 'Show';
  },
  updatePwdChecklist: (inputId, boxId) => {
    const val = document.getElementById(inputId)?.value || '';
    const box = document.getElementById(boxId);
    if (!box) return;
    const checks = {
      len: val.length >= 8,
      upper: /[A-Z]/.test(val),
      lower: /[a-z]/.test(val),
      digit: /[0-9]/.test(val),
      sym: /[^A-Za-z0-9]/.test(val)
    };
    const rules = [
      ['len', 'Minimum 8 Characters'],
      ['upper', '1 Capital Letter (A–Z)'],
      ['lower', '1 Small Letter (a–z)'],
      ['digit', '1 Number (0–9)'],
      ['sym', '1 Special Symbol (@#$%&*!)']
    ];
    box.innerHTML = rules
      .map(([k, label]) => {
        const ok = checks[k];
        return `<div style="display:flex; align-items:center; gap:0.4rem; font-size:0.76rem; font-weight:${ok ? '700' : '500'}; color:${ok ? 'var(--success)' : 'var(--text-muted)'};">
          <span>${ok ? '✓' : '○'}</span><span>${label}</span>
        </div>`;
      })
      .join('');
  },
  openChangePasswordModal: async () => {
    let cur = getCurrentUser();
    if (!cur) return;
    try {
      const token = localStorage.getItem('MUN_COMPUTER_SESSION_TOKEN') || '';
      if (token) {
        const resp = await fetch('/api/auth/session', { headers: { 'x-session-token': token } });
        if (resp.ok) {
          const data = await resp.json();
          if (data.success && data.user) {
            cur = { ...cur, ...data.user };
            setCurrentUser(cur);
          }
        }
      }
    } catch {
      // use cached user info if offline
    }

    const limit = Number(cur.dailyPasswordChangeLimit || 5);
    const usedToday = Number(cur.dailyPasswordChangesUsed || 0);
    const remaining = Math.max(0, limit - usedToday);

    const content = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding:0.75rem 0.9rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:1rem; font-size:0.8rem;">
        <div>
          <div style="font-weight:700; color:var(--text-main);">${escHtml(cur.name)}</div>
          <div style="color:var(--text-muted); font-size:0.75rem;">UID: <strong class="font-mono">${escHtml(cur.uid || cur.id)}</strong> · Role: <strong>${escHtml(formatRoleLabel(cur.role))}</strong></div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700; color:${remaining > 0 ? 'var(--blue-600)' : 'var(--danger)'}; font-variant-numeric:tabular-nums;">
            ${remaining} of ${limit} changes left today
          </div>
          <div style="font-size:0.72rem; color:var(--text-muted);">Used today: ${usedToday} / ${limit}</div>
        </div>
      </div>

      ${remaining <= 0 ? `
        <div style="padding:0.85rem; border-radius:var(--radius-md); background:var(--danger-bg); border:1px solid var(--danger-border); color:var(--danger); font-size:0.82rem; font-weight:600; margin-bottom:1rem;">
          ⛔ Daily password change limit reached (${limit}/${limit} changes used today). You can change your password again tomorrow.
        </div>
      ` : ''}

      <form id="erp-voluntary-pwd-form" onsubmit="window.MJK.handleUserPasswordChange(event, '${escHtml(cur.uid || cur.id)}')">
        <div class="form-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <label class="form-label" style="margin:0;">Current Password *</label>
            <button type="button" onclick="window.MJK.toggleModalPwdField('erp-user-current-pwd', this)" style="background:none; border:none; color:var(--blue-600); font-size:0.75rem; font-weight:600; cursor:pointer;">Show</button>
          </div>
          <input type="password" id="erp-user-current-pwd" class="form-control" required placeholder="Enter current password" ${remaining <= 0 ? 'disabled' : ''}>
        </div>

        <div class="form-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <label class="form-label" style="margin:0;">New Password *</label>
            <button type="button" onclick="window.MJK.toggleModalPwdField('erp-user-new-pwd', this)" style="background:none; border:none; color:var(--blue-600); font-size:0.75rem; font-weight:600; cursor:pointer;">Show</button>
          </div>
          <input type="password" id="erp-user-new-pwd" class="form-control" required minlength="8" placeholder="8+ chars, Capital, Small, Number & Symbol" oninput="window.MJK.updatePwdChecklist('erp-user-new-pwd', 'erp-user-pwd-checklist')" ${remaining <= 0 ? 'disabled' : ''}>
        </div>

        <div class="form-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <label class="form-label" style="margin:0;">Confirm New Password *</label>
            <button type="button" onclick="window.MJK.toggleModalPwdField('erp-user-confirm-pwd', this)" style="background:none; border:none; color:var(--blue-600); font-size:0.75rem; font-weight:600; cursor:pointer;">Show</button>
          </div>
          <input type="password" id="erp-user-confirm-pwd" class="form-control" required minlength="8" placeholder="Re-enter new password" ${remaining <= 0 ? 'disabled' : ''}>
        </div>

        <div style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.85rem; margin-top:0.75rem;">
          <div style="font-size:0.76rem; font-weight:700; color:var(--text-main); margin-bottom:0.45rem;">
            Password Instructions (Required for All Users):
          </div>
          <div id="erp-user-pwd-checklist" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap:0.35rem 0.75rem;"></div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.35rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" id="btn-save-user-pwd" class="btn btn-primary" ${remaining <= 0 ? 'disabled' : ''}>Update Password</button>
        </div>
      </form>
    `;
    openModal('🔑 Change Account Password', content, null);
    window.MJK.updatePwdChecklist('erp-user-new-pwd', 'erp-user-pwd-checklist');
  },
  handleUserPasswordChange: async (e, uid) => {
    e.preventDefault();
    const currentPass = document.getElementById('erp-user-current-pwd')?.value || '';
    const newPass = document.getElementById('erp-user-new-pwd')?.value || '';
    const confirmPass = document.getElementById('erp-user-confirm-pwd')?.value || '';
    const btn = document.getElementById('btn-save-user-pwd');

    if (newPass !== confirmPass) {
      showToast('New password and confirmation do not match.', 'danger');
      return;
    }
    if (newPass.length < 8 || !/[A-Z]/.test(newPass) || !/[a-z]/.test(newPass) || !/[0-9]/.test(newPass) || !/[^A-Za-z0-9]/.test(newPass)) {
      showToast('Password must be 8+ characters with 1 Capital letter, 1 Small letter, 1 Number, and 1 Special symbol.', 'danger');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Updating...`;
    }

    const res = await changePasswordAsync(uid, currentPass, newPass, confirmPass);
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Update Password';
    }

    if (res.success) {
      closeModal();
      showToast(res.message || 'Password changed successfully!', 'success');
      render();
    } else {
      showToast(res.message || 'Password update failed.', 'danger');
    }
  },
  openMandatoryPasswordChangeModal: (user, currentPass = '') => {
    const content = `
      <div style="font-size:0.83rem; color:var(--text-muted); margin-bottom:1rem; line-height:1.4;">
        First-time login detected for <strong>${escHtml(user.name)} (${escHtml(user.uid || user.id)})</strong>. Replace your temporary password with a strong custom password before accessing the dashboard.
      </div>
      <form id="erp-password-change-form" onsubmit="window.MJK.handleMandatoryPasswordChange(event, '${escHtml(user.uid || user.id)}')">
        <div class="form-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <label class="form-label" style="margin:0;">Current / Temporary Password *</label>
            <button type="button" onclick="window.MJK.toggleModalPwdField('erp-change-current-pwd', this)" style="background:none; border:none; color:var(--blue-600); font-size:0.75rem; font-weight:600; cursor:pointer;">Show</button>
          </div>
          <input type="password" id="erp-change-current-pwd" class="form-control" required value="${escHtml(currentPass)}" placeholder="Enter current temporary password">
        </div>
        <div class="form-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <label class="form-label" style="margin:0;">New Strong Password *</label>
            <button type="button" onclick="window.MJK.toggleModalPwdField('erp-change-new-pwd', this)" style="background:none; border:none; color:var(--blue-600); font-size:0.75rem; font-weight:600; cursor:pointer;">Show</button>
          </div>
          <input type="password" id="erp-change-new-pwd" class="form-control" required minlength="8" placeholder="8+ chars, Capital, Small, Number & Symbol" oninput="window.MJK.updatePwdChecklist('erp-change-new-pwd', 'erp-mandatory-pwd-checklist')">
        </div>
        <div class="form-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <label class="form-label" style="margin:0;">Confirm New Password *</label>
            <button type="button" onclick="window.MJK.toggleModalPwdField('erp-change-confirm-pwd', this)" style="background:none; border:none; color:var(--blue-600); font-size:0.75rem; font-weight:600; cursor:pointer;">Show</button>
          </div>
          <input type="password" id="erp-change-confirm-pwd" class="form-control" required minlength="8" placeholder="Re-enter new password">
        </div>
        <div style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.85rem; margin-top:0.75rem;">
          <div style="font-size:0.76rem; font-weight:700; color:var(--text-main); margin-bottom:0.45rem;">
            Password Instructions (Required for All Users):
          </div>
          <div id="erp-mandatory-pwd-checklist" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap:0.35rem 0.75rem;"></div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.handleLogout()">Cancel / Sign Out</button>
          <button type="submit" id="btn-save-new-pwd" class="btn btn-primary">Set New Password & Enter ERP</button>
        </div>
      </form>
    `;
    openModal('🔐 Mandatory First-Login Password Change', content, null);
    window.MJK.updatePwdChecklist('erp-change-new-pwd', 'erp-mandatory-pwd-checklist');
  },
  handleMandatoryPasswordChange: async (e, uid) => {
    e.preventDefault();
    const currentPass = document.getElementById('erp-change-current-pwd')?.value || '';
    const newPass = document.getElementById('erp-change-new-pwd')?.value || '';
    const confirmPass = document.getElementById('erp-change-confirm-pwd')?.value || '';
    const btn = document.getElementById('btn-save-new-pwd');

    if (newPass !== confirmPass) {
      showToast('New password and confirmation do not match.', 'danger');
      return;
    }
    if (newPass.length < 8 || !/[A-Z]/.test(newPass) || !/[a-z]/.test(newPass) || !/[0-9]/.test(newPass) || !/[^A-Za-z0-9]/.test(newPass)) {
      showToast('Password must be 8+ characters with 1 Capital letter, 1 Small letter, 1 Number, and 1 Special symbol.', 'danger');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Saving...`;
    }

    const res = await changePasswordAsync(uid, currentPass, newPass, confirmPass);
    if (btn) btn.disabled = false;

    if (res.success) {
      await refreshSessionPermissions();
      closeModal();
      showToast('Password changed successfully! Welcome to MUN COMPUTER ERP.', 'success');
      AppState.currentRoute = 'dashboard';
      window.location.hash = '#dashboard';
      render();
    } else {
      showToast(res.message || 'Password update failed.', 'danger');
    }
  },
  handleLogout: () => {
    logout();
    localStorage.removeItem('mun_computer_v3_user');
    localStorage.removeItem('mun_current_user');
    AppState.currentRoute = 'dashboard';
    closeModal();
    const sb = document.getElementById('app-sidebar');
    const bd = document.getElementById('sidebar-backdrop');
    if (sb) sb.classList.remove('mobile-open');
    if (bd) bd.classList.remove('active');
    document.body.classList.remove('mobile-drawer-open', 'printing-inapp-sheet', 'printing-a4-popup');
    document.querySelector('.main-wrapper')?.scrollTo(0, 0);
    window.scrollTo(0, 0);
    if (window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } else {
      window.location.hash = '';
    }
    window.dispatchEvent(new Event('mun-auth-logout'));
    showToast('Signed out of MUN COMPUTER ERP.', 'info');
  },
  toggleTopbarProfileMenu: (event) => {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    const dd = document.getElementById('topbar-profile-dropdown');
    const trig = document.getElementById('topbar-profile-trigger');
    if (!dd) return;
    const nextOpen = !dd.classList.contains('open');
    dd.classList.toggle('open', nextOpen);
    if (trig) trig.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  },
  closeTopbarProfileMenu: () => {
    const dd = document.getElementById('topbar-profile-dropdown');
    const trig = document.getElementById('topbar-profile-trigger');
    if (dd) dd.classList.remove('open');
    if (trig) trig.setAttribute('aria-expanded', 'false');
  },
  openUserProfileModal: async () => {
    let cur = getCurrentUser();
    if (!cur) return;
    try {
      const token = localStorage.getItem('MUN_COMPUTER_SESSION_TOKEN') || '';
      if (token) {
        const resp = await fetch('/api/auth/session', { headers: { 'x-session-token': token } });
        if (resp.ok) {
          const data = await resp.json();
          if (data.success && data.user) {
            cur = { ...cur, ...data.user };
            setCurrentUser(cur);
          }
        }
      }
    } catch {
      // fallback to cached user
    }
    const initials = String(cur.name || 'U')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p.charAt(0).toUpperCase())
      .join('') || 'U';
    const photo = cur.photoUrl || cur.avatarUrl || '';
    const statusText = String(cur.status || 'ACTIVE').toUpperCase();
    const statusBadgeClass = statusText === 'ACTIVE' ? 'badge-success' : statusText === 'PENDING' ? 'badge-warning' : 'badge-danger';
    const content = `
      <div style="display:flex; align-items:center; gap:1rem; padding:1rem; background:#F8FAFC; border:1px solid var(--border-subtle); border-radius:12px; margin-bottom:1rem;">
        <div style="width:60px; height:60px; border-radius:9999px; background:#0B1530; color:#FFFFFF; display:flex; align-items:center; justify-content:center; font-size:1.35rem; font-weight:800; overflow:hidden; flex-shrink:0; border:2px solid #D6B56D;">
          ${photo ? `<img src="${escHtml(photo)}" alt="${escAttrJs(cur.name)}" style="width:100%; height:100%; object-fit:cover;" />` : escHtml(initials)}
        </div>
        <div style="min-width:0; flex:1;">
          <div style="font-size:1.1rem; font-weight:800; color:var(--text-main);">${escHtml(cur.name)}</div>
          <div class="font-mono" style="font-size:0.78rem; color:#2456C7; font-weight:600;">${escHtml(cur.uid || cur.id || 'N/A')}</div>
          <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap; margin-top:0.35rem;">
            <span class="badge badge-info">${escHtml(formatRoleLabel(cur.role))}</span>
            <span class="badge ${statusBadgeClass}">${escHtml(statusText)}</span>
            <span class="badge badge-neutral">MUN COMPUTER</span>
          </div>
        </div>
      </div>

      <div style="border:1px solid var(--border-subtle); border-radius:10px; padding:0.85rem; display:grid; gap:0.5rem; font-size:0.82rem; margin-bottom:1.1rem;">
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border-subtle); padding-bottom:0.4rem;">
          <span style="color:var(--text-muted);">Business Unit</span>
          <strong style="color:var(--text-main);">MUN COMPUTER</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border-subtle); padding-bottom:0.4rem;">
          <span style="color:var(--text-muted);">Assigned Role</span>
          <strong>${escHtml(formatRoleLabel(cur.role))}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border-subtle); padding-bottom:0.4rem;">
          <span style="color:var(--text-muted);">Mobile Number</span>
          <span class="font-mono">${escHtml(cur.phoneMasked || (cur.phone ? 'XXXXXX' + String(cur.phone).slice(-4) : 'Not Set'))}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:var(--text-muted);">Daily Password Changes Left</span>
          <span class="font-mono" style="font-weight:700;">${Math.max(0, Number(cur.dailyPasswordChangeLimit || 5) - Number(cur.dailyPasswordChangesUsed || 0))} / ${Number(cur.dailyPasswordChangeLimit || 5)}</span>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:0.55rem;">
        <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openChangePasswordModal()">
          ${getLucideIcon('key-round', 14)} Change Password
        </button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.closeModal(); window.MJK.navigateTo('${canAccessRoute('settings', cur) ? 'settings' : 'employee-profile'}')">
          ${getLucideIcon('settings', 14)} Account Settings
        </button>
        ${canAccessRoute('security-settings', cur) ? `
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.closeModal(); window.MJK.navigateTo('security-settings')">
            ${getLucideIcon('shield-check', 14)} Security Settings
          </button>
        ` : `
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openSwitchRoleModal()">
            ${getLucideIcon('users', 14)} Registered Accounts
          </button>
        `}
        <button type="button" class="btn btn-danger btn-sm" onclick="window.MJK.handleLogout()">
          ${getLucideIcon('log-out', 14)} Logout
        </button>
      </div>
    `;
    openModal('My Account Profile — MUN COMPUTER', content, null);
  },
  openSwitchRoleModal: async () => {
    const users = await fetchUsersFromBackend();
    const current = getCurrentUser();
    const currentUid = current ? (current.uid || current.id) : '';

    const content = `
      <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">
        Active registered accounts in MUN COMPUTER ERP:
      </div>
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        ${users.map(u => {
          const isSelected = (u.uid || u.id) === currentUid;
          const roleBadgeClass = u.role === 'ADMIN' ? 'badge-primary' : u.role === 'MANAGER' ? 'badge-info' : 'badge-neutral';
          return `
            <div style="padding:0.9rem; border:${isSelected ? '2px solid var(--blue-600)' : '1px solid var(--border-subtle)'}; background:${isSelected ? 'var(--blue-50)' : 'var(--surface-alt)'}; border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; color:var(--text-main); display:flex; align-items:center; gap:0.4rem;">
                  ${getLucideIcon(u.role === 'ADMIN' ? 'shield-check' : u.role === 'MANAGER' ? 'briefcase' : 'user-round', 15)}
                  <span>${escHtml(u.name)}</span>
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">
                  UID: <strong style="font-family:monospace;">${escHtml(u.uid || u.id || 'Pending')}</strong> · Mobile: ${escHtml(u.phoneMasked || (u.phone ? 'XXXXXX' + String(u.phone).slice(-4) : 'N/A'))} · Status: <span style="color:${u.status === 'ACTIVE' ? 'var(--success)' : 'var(--warning)'}; font-weight:700;">${escHtml(u.status || 'ACTIVE')}</span>
                </div>
              </div>
              <span class="badge ${roleBadgeClass}">${formatRoleLabel(u.role)}</span>
            </div>
          `;
        }).join('')}
      </div>

      <div style="margin-top:1.25rem; padding-top:0.85rem; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openChangePasswordModal()">${getLucideIcon('key-round', 14)} Change My Password</button>
        <div style="display:flex; gap:0.5rem;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.handleLogout()">Switch Account / Sign Out</button>
          <button class="btn btn-primary btn-sm" onclick="window.MJK.closeModal()">Close</button>
        </div>
      </div>
    `;
    openModal('Registered ERP Accounts', content, null);
  },
  openUnitSwitchModal: () => {
    const profile = getBusinessProfile();
    const content = `
      <div style="text-align:center; padding:0.5rem 0 1rem 0;">
        <div style="display:inline-flex; align-items:center; justify-content:center; width:58px; height:58px; border-radius:14px; background:linear-gradient(135deg, #1e3a8a, #2563eb); color:#ffffff; font-size:1.35rem; font-weight:800; box-shadow:0 4px 12px rgba(37,99,235,0.25); margin-bottom:0.75rem;">
          MUN
        </div>
        <h3 style="font-size:1.25rem; font-weight:800; color:var(--text-main); margin-bottom:0.25rem;">MUN COMPUTER</h3>
        <span class="badge badge-success" style="font-size:0.75rem; padding:0.2rem 0.65rem; font-weight:700;">Sole Official Business Unit</span>
        <p style="font-size:0.84rem; color:var(--text-muted); margin-top:0.65rem; max-width:440px; margin-left:auto; margin-right:auto; line-height:1.5;">
          Per business structure, all operations, counter services, banking CSP, customer records, and accounts run under <strong>MUN COMPUTER</strong>.
        </p>
      </div>

      <div style="border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-alt); padding:0.9rem; display:flex; flex-direction:column; gap:0.55rem; font-size:0.82rem;">
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border-subtle); padding-bottom:0.35rem;">
          <span style="color:var(--text-muted);">Business Unit Name</span>
          <strong style="color:var(--blue-600);">MUN COMPUTER</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border-subtle); padding-bottom:0.35rem;">
          <span style="color:var(--text-muted);">Unit Identifier</span>
          <span class="badge badge-neutral" style="font-weight:700;">mun-computer</span>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border-subtle); padding-bottom:0.35rem;">
          <span style="color:var(--text-muted);">Operating Model</span>
          <span class="badge badge-info">Single Store ERP</span>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border-subtle); padding-bottom:0.35rem;">
          <span style="color:var(--text-muted);">Address</span>
          <span>${profile.district}, ${profile.state} (${profile.pinCode})</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:var(--text-muted);">Operational Status</span>
          <span style="color:var(--success); font-weight:700;">● Active (All Records Consolidated)</span>
        </div>
      </div>

      <div style="margin-top:1.25rem; display:flex; justify-content:flex-end;">
        <button class="btn btn-primary" onclick="window.MJK.closeModal()">✓ Confirmed Active Unit: MUN COMPUTER</button>
      </div>
    `;
    openModal('Official Business Unit: MUN COMPUTER', content, null);
  },
  selectUnit: (id) => {
    setActiveUnitId('mun-computer');
    closeModal();
    showToast(`Active Business Unit: MUN COMPUTER`, 'success');
    render();
  },
  openNotificationsModal: () => {
    const notifications = getSystemNotifications();
    const content = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
        <span style="font-size:0.78rem; color:var(--text-muted);">Live Alerts, 90-Day Cases, Seminar, Gas Delivery &amp; Promotional Reminders</span>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openReminderModal()">+ Schedule Reminder</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        ${notifications.map(n => `
          <div style="padding:0.85rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-alt); display:flex; align-items:flex-start; gap:0.75rem;">
            <span style="font-size:1.2rem; color:${n.type === 'danger' ? 'var(--danger)' : n.type === 'warning' ? 'var(--warning)' : 'var(--info)'};">
              ${n.type === 'danger' ? '⚠' : n.type === 'warning' ? '⏰' : 'ℹ'}
            </span>
            <div style="flex:1;">
              <div style="font-weight:700; font-size:0.88rem;">${escHtml(n.title)}</div>
              <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.2rem;">${escHtml(n.message)}</div>
              <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-top:0.5rem;">
                <button class="btn btn-secondary btn-sm" onclick="window.MJK.navigateTo('${escAttrJs(n.actionRoute || 'followups')}'); window.MJK.closeModal();">
                  Open →
                </button>
                ${n.reminderId ? `<button class="btn btn-success btn-sm" onclick="window.MJK.toggleSmartReminderDone('${escAttrJs(n.reminderId)}', true); setTimeout(() => window.MJK.openNotificationsModal(), 80);">✓ Mark Completed</button>` : ''}
              </div>
            </div>
          </div>
        `).join('') || '<div style="text-align:center; padding:2rem; color:var(--text-muted);">No active warnings or reminders for MUN COMPUTER. All systems nominal!</div>'}
      </div>
    `;
    openModal('Internal Alerts & Notification Center', content, null);
  },

  updateCustServiceCount: () => {
    const countEl = document.getElementById('cust-services-count');
    const checkedCount = document.querySelectorAll('input[name="cust-service-cb"]:checked').length;
    if (countEl) {
      countEl.textContent = `${checkedCount} selected`;
    }
  },

  // Customer Modals & Actions
  openCustomerModal: (customerId = null) => {
    const cust = customerId ? getCustomerById(customerId) : null;
    const displayId = cust ? cust.id : previewNextGlobalReference('CUST');
    const regDateVal = cust ? (cust.regDate || getTodayDate()) : getTodayDate();
    const displayAppId = cust?.applicationId || previewNextApplicationId(regDateVal);
    const linkedCase = cust ? getFollowupCaseByCustomerId(cust.id) : null;
    const initialCustomerServices = Array.isArray(cust?.services) && cust.services.length
      ? cust.services
      : ((cust?.schemeName || linkedCase?.schemeName) && (cust?.schemeName || linkedCase?.schemeName) !== 'General Digital Service'
        ? String(cust?.schemeName || linkedCase?.schemeName).split(',').map(s => s.trim()).filter(Boolean)
        : []);
    const curU = getCurrentUser();
    const activeStaffList = getAllUsers().filter(u => u.status === 'ACTIVE' && u.uid);
    const defaultStaff = cust?.assignedStaffUid || cust?.assignedStaff || curU?.uid || MAIN_ADMIN_UID;

    const aadhaarSlotHtml = `
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">Aadhaar Reference (Last 4 Digits)</label>
        <input type="text" id="cust-aadhaar" class="form-control font-mono tabular-nums" maxlength="4" pattern="[0-9]{4}" value="${escHtml(cust ? (cust.aadhaarLast4 || '') : '')}" placeholder="Last 4 digits">
      </div>
    `;

    const content = `
      <form id="customer-form" class="checkout-flow" onsubmit="window.MJK.handleSaveCustomer(event, '${customerId || ''}')">
        <input type="hidden" id="cust-post-action" value="close">

        <!-- Top Auto-Generated Summary Badge -->
        <div class="checkout-meta-bar">
          <div class="checkout-meta-items">
            <span>Customer ID: <strong id="cust-meta-id-lbl">${escHtml(displayId)}</strong></span>
            <span aria-hidden="true">·</span>
            <span>App ID: <strong id="cust-meta-app-lbl">${escHtml(displayAppId)}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Date: <strong id="cust-meta-date-lbl">${formatDate(regDateVal)}</strong></span>
          </div>
          <button type="button" class="checkout-meta-edit-btn" onclick="const w=document.getElementById('cust-meta-edit-wrap'); if(w){ const open=w.style.display!=='none'; w.style.display=open?'none':'block'; this.textContent=open?'Customize IDs / Date':'Hide'; }">
            Customize IDs / Date
          </button>
        </div>

        <div id="cust-meta-edit-wrap" style="display:none; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.75rem;">
          <div class="form-row" style="margin-bottom:0;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Customer ID</label>
              <input type="text" id="cust-id-display" class="form-control font-mono" value="${escHtml(displayId)}" readonly style="font-weight:700; background:var(--surface);">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Application ID <span class="req">*</span></label>
              <input type="text" id="cust-appid" class="form-control font-mono" value="${escHtml(displayAppId)}" required style="font-weight:700; color:var(--violet-600, #6d28d9);" oninput="this.dataset.edited='1'; const l=document.getElementById('cust-meta-app-lbl'); if(l) l.textContent=this.value || '-';">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Registration Date <span class="req">*</span></label>
              <input type="date" id="cust-regdate" class="form-control" value="${escHtml(regDateVal)}" required onchange="const l=document.getElementById('cust-meta-date-lbl'); if(l) l.textContent=this.value; ${!customerId ? `const ap=document.getElementById('cust-appid'); const lbl=document.getElementById('cust-meta-app-lbl'); if(ap && ap.dataset.edited!=='1'){ const nextId=window.MJK.previewNextApplicationId(this.value); ap.value=nextId; if(lbl) lbl.textContent=nextId; }` : ''}">
            </div>
          </div>
        </div>

        <!-- Step 01: Customer Details -->
        <div class="checkout-step-card">
          <div class="checkout-step-header">
            <div class="checkout-step-title-wrap">
              <span class="checkout-step-num">01</span>
              <div>
                <h4 class="checkout-step-title">Customer Details</h4>
                <p class="checkout-step-sub">Essential identity &amp; contact information</p>
              </div>
            </div>
          </div>
          <div class="checkout-grid-2">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Full Name <span class="req">*</span></label>
              <input type="text" id="cust-name" class="form-control" value="${escHtml(cust ? cust.name : '')}" required placeholder="Enter customer full name">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Mobile Number <span class="req">*</span></label>
              <input type="tel" id="cust-phone" class="form-control font-mono tabular-nums" value="${escHtml(cust ? cust.phone : '')}" required placeholder="10-digit mobile number" onblur="window.MJK.checkDuplicatePhoneField(this.value, '${customerId || ''}')">
              <div id="duplicate-phone-warning" style="font-size:0.74rem; color:var(--danger); margin-top:0.2rem; display:none;"></div>
            </div>
            <div class="form-group" style="margin-bottom:0; grid-column: 1 / -1;">
              <label class="form-label">Father's / Guardian Name</label>
              <input type="text" id="cust-father" class="form-control" value="${escHtml(cust ? cust.fatherName : '')}" placeholder="Enter father / guardian name">
            </div>
          </div>
        </div>

        <!-- Step 02: Location & Quick Info -->
        <div class="checkout-step-card">
          <div class="checkout-step-header">
            <div class="checkout-step-title-wrap">
              <span class="checkout-step-num">02</span>
              <div>
                <h4 class="checkout-step-title">Location &amp; Quick Info</h4>
                <p class="checkout-step-sub">Enter PIN Code to auto-fill Village, Post Office, District &amp; State</p>
              </div>
            </div>
          </div>
          ${renderLocationCascadeHtml('cust-loc', {
            required: true,
            checkoutMode: true,
            checkoutSlotHtml: aadhaarSlotHtml
          })}
        </div>

        <!-- Step 03: Searchable Multi-Select Service Bar & Live Rate Chart -->
        <div class="checkout-step-card">
          <div class="checkout-step-header">
            <div class="checkout-step-title-wrap">
              <span class="checkout-step-num">03</span>
              <div>
                <h4 class="checkout-step-title">Services / Schemes &amp; Live Billing</h4>
                <p class="checkout-step-sub">Search English or Bengali services to auto-fetch Shop Charge, Govt Fee &amp; Total Bill</p>
              </div>
            </div>
          </div>
          ${renderSearchableServiceSelectorHtml('cust-services', {
            label: 'Select Services / Schemes (Optional Multi-Select)',
            placeholder: 'Search service in English or Bengali (e.g. PAN, Ration, লক্ষ্মীর ভাণ্ডার)...',
            showBilling: true
          })}
        </div>

        <!-- Collapsible Optional Details Accordion -->
        <div class="checkout-accordion">
          <button type="button" class="checkout-accordion-trigger" aria-expanded="false" onclick="const body=this.nextElementSibling; const open=body.style.display!=='none'; body.style.display=open?'none':'block'; this.setAttribute('aria-expanded', String(!open)); this.querySelector('.acc-icon').textContent=open?'+':'−';">
            <span><strong class="acc-icon" style="margin-right:0.35rem;">+</strong>Add Optional Details</span>
            <span style="font-size:0.74rem; color:var(--text-muted); font-weight:600;">Alt Mobile · Landmark · Job Card · Email · Remarks</span>
          </button>
          <div class="checkout-accordion-body" style="display:none;">
            <div class="checkout-grid-2">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Alternative Mobile</label>
                <input type="tel" id="cust-alt-phone" class="form-control font-mono tabular-nums" value="${escHtml(cust ? (cust.altPhone || '') : '')}" placeholder="Alternate mobile number">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Job Card</label>
                <input type="text" id="cust-jobcard" class="form-control" value="${escHtml(cust ? (cust.jobCardNo || '') : '')}" autocomplete="off">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Email</label>
                <input type="email" id="cust-email" class="form-control" value="${escHtml(cust ? (cust.email || '') : '')}" autocomplete="off">
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">House / Para / Landmark (Optional)</label>
                <input type="text" id="cust-address" class="form-control" value="${escHtml(cust ? (cust.address || '') : '')}" placeholder="Optional landmark (auto-compiled above)">
              </div>
              <div class="form-group" style="margin-bottom:0; grid-column: 1 / -1;">
                <label class="form-label">Remarks</label>
                <textarea id="cust-remarks" class="form-control" rows="2">${escHtml(cust ? (cust.remarks || '') : '')}</textarea>
              </div>
            </div>

            <div style="margin-top:0.85rem; padding-top:0.75rem; border-top:1px dashed var(--border-subtle);">
              <div class="checkout-grid-2">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Customer Category</label>
                  <select id="cust-category" class="form-control">
                    <option ${cust && cust.category === 'General Public' ? 'selected' : ''}>General Public</option>
                    <option ${cust && cust.category === 'Student' ? 'selected' : ''}>Student</option>
                    <option ${cust && cust.category === 'Farmer / KCC' ? 'selected' : ''}>Farmer / KCC</option>
                    <option ${cust && cust.category === 'Merchant / Shopkeeper' ? 'selected' : ''}>Merchant / Shopkeeper</option>
                    <option ${cust && cust.category === 'Job Aspirant' ? 'selected' : ''}>Job Aspirant</option>
                    <option ${cust && cust.category === 'Senior Citizen' ? 'selected' : ''}>Senior Citizen</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Village / Ward Label (90-Day Case)</label>
                  <input type="text" id="cust-village-ward" class="form-control" value="${escHtml(cust?.villageOrWard || cust?.village || '')}" placeholder="Auto-synced from Village">
                </div>
                <div class="form-group" style="margin-bottom:0; grid-column: 1 / -1;">
                  <label class="form-label">Assigned Staff</label>
                  <select id="cust-assigned-staff" class="form-control">
                    ${activeStaffList.map(u => `<option value="${escHtml(u.uid)}" ${defaultStaff === u.uid ? 'selected' : ''}>${escHtml(u.name)} (${escHtml(u.uid)} · ${escHtml(u.role)})</option>`).join('')}
                    ${!activeStaffList.some(u => u.uid === defaultStaff) ? `<option value="${escHtml(defaultStaff)}" selected>${escHtml(defaultStaff)}</option>` : ''}
                  </select>
                </div>
              </div>
              <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.76rem; color:var(--violet-600, #6d28d9); font-weight:700; cursor:pointer; margin-top:0.65rem;">
                <input type="checkbox" id="cust-enable-90day" checked>
                Auto-sync 90-Day Follow-up Schedule
              </label>
            </div>
          </div>
        </div>

        <!-- Full-Width Checkout CTA -->
        <div style="display:flex; flex-direction:column; gap:0.45rem; margin-top:0.25rem;">
          <button type="submit" class="btn btn-primary btn-checkout-cta" onclick="const pa=document.getElementById('cust-post-action'); if(pa) pa.value='close';">
            ${customerId ? 'Update Customer Profile' : 'Register Customer'}
          </button>
          <div style="display:flex; gap:0.45rem;">
            <button type="button" class="btn btn-secondary" style="flex:1;" onclick="window.MJK.closeModal()">Cancel</button>
            ${!customerId ? `
              <button type="button" class="btn btn-outline" style="flex:1; font-weight:700;" onclick="const pa=document.getElementById('cust-post-action'); if(pa) pa.value='service'; document.getElementById('customer-form')?.requestSubmit();">
                Register &amp; Add Services →
              </button>
            ` : ''}
          </div>
        </div>
      </form>
    `;

    openModal(customerId ? 'Edit Customer Profile' : 'Register New Customer', content, null, 'modal-lg');
    initLocationCascade('cust-loc', {
      state: cust?.state || 'West Bengal',
      district: cust?.district || 'Murshidabad',
      village: cust?.village || '',
      postOffice: cust?.postOffice || '',
      policeStation: cust?.policeStation || '',
      pinCode: cust?.pinCode || ''
    });
    setTimeout(() => {
      initSearchableServiceSelector('cust-services', {
        initialServices: initialCustomerServices,
        showBilling: true
      });
    }, 20);
  },

  checkDuplicatePhoneField: (phone, custId) => {
    const dup = checkDuplicatePhone(phone, custId);
    const warn = document.getElementById('duplicate-phone-warning');
    if (dup && warn) {
      warn.textContent = `⚠ Warning: Mobile number matches existing customer "${dup.name}" (${dup.id})`;
      warn.style.display = 'block';
    } else if (warn) {
      warn.style.display = 'none';
    }
  },

  handleSaveCustomer: async (e, id) => {
    e.preventDefault();
    try {
      const existingCust = id ? getCustomerById(id) : null;
      const regDate = document.getElementById('cust-regdate')?.value || getTodayDate();
      const rawAppIdInput = document.getElementById('cust-appid');
      let applicationId = rawAppIdInput?.value?.trim() || '';
      if (!id) {
        applicationId = (rawAppIdInput?.dataset?.edited === '1' && applicationId)
          ? applicationId
          : await allocateGlobalReference('CASE', { entityType: 'CASE' });
      } else if (!applicationId) {
        applicationId = existingCust?.applicationId || await allocateGlobalReference('CASE', { entityType: 'CASE' });
      }

      const selState = getSelectedServicesState('cust-services');
      const selectedServiceNames = selState.serviceNames.length > 0
        ? selState.serviceNames
        : (existingCust && Array.isArray(existingCust.services) ? existingCust.services : []);
      const schemeName = selectedServiceNames.length > 0
        ? selectedServiceNames.join(', ')
        : (existingCust?.schemeName || 'General Digital Service');
      const currentStatus = existingCust ? (existingCust.currentStatus || 'Submitted') : 'Submitted';
      const enable90Day = document.getElementById('cust-enable-90day')?.checked ?? true;
      const postAction = document.getElementById('cust-post-action')?.value || 'close';

      const loc = getLocationCascadeValues('cust-loc');
      if (!loc.state || !loc.district || !loc.village || !loc.postOffice || !loc.pinCode) {
        showToast('Please select/enter State, District, Village, Post Office, and PIN Code.', 'warning');
        return;
      }

      const villageOrWard = document.getElementById('cust-village-ward')?.value?.trim() || loc.gpOrWard || loc.village;
      const assignedStaffUid = document.getElementById('cust-assigned-staff')?.value?.trim() || getCurrentUser()?.uid || MAIN_ADMIN_UID;
      const customLandmark = document.getElementById('cust-address')?.value?.trim() || '';
      const compiledAddress = customLandmark
        ? (loc.formattedAddress ? `${customLandmark}, ${loc.formattedAddress}` : customLandmark)
        : loc.formattedAddress;

      const data = {
        id: id || undefined,
        applicationId,
        schemeName,
        villageOrWard,
        currentStatus,
        name: document.getElementById('cust-name').value.trim(),
        fatherName: document.getElementById('cust-father')?.value?.trim() || '',
        phone: document.getElementById('cust-phone').value.trim(),
        altPhone: document.getElementById('cust-alt-phone')?.value?.trim() || '',
        email: document.getElementById('cust-email')?.value?.trim() || '',
        address: compiledAddress,
        regDate,
        category: document.getElementById('cust-category')?.value || 'General Public',
        services: selectedServiceNames,
        serviceRateBreakdown: selState.services,
        totalBillAmount: selState.totalPayable,
        village: loc.village,
        postOffice: loc.postOffice,
        policeStation: loc.policeStation,
        district: loc.district,
        state: loc.state,
        pinCode: loc.pinCode,
        aadhaarLast4: document.getElementById('cust-aadhaar')?.value?.trim() || '',
        jobCardNo: document.getElementById('cust-jobcard')?.value?.trim() || '',
        remarks: document.getElementById('cust-remarks')?.value?.trim() || '',
        assignedStaff: assignedStaffUid,
        assignedStaffUid,
        createdByUid: id ? undefined : (getCurrentUser()?.uid || '')
      };

      await saveCustomLocationIfNeeded(loc);
      const result = await saveCustomer(data);
      const savedCust = result?.customer;

      if (enable90Day && savedCust?.id) {
        await createOrSyncFollowupCase({
          customerId: savedCust.id,
          customerName: savedCust.name,
          phone: savedCust.phone,
          applicationId: savedCust.applicationId,
          schemeName: savedCust.schemeName,
          villageOrWard: savedCust.villageOrWard,
          currentStatus: savedCust.currentStatus,
          assignedStaff: savedCust.assignedStaff,
          startDate: regDate,
          remarks: data.remarks
        });
      }

      fetch('/api/customers', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...data,
          id: savedCust?.id || data.id,
          villageOrLocality: data.village,
          blockOrMunicipality: loc.blockOrMunicipality || '',
          gpOrWard: loc.gpOrWard || '',
          subdivision: loc.subdivision || ''
        })
      }).catch(() => {});

      closeModal();
      showToast(id ? `Customer updated: ${data.name} (${applicationId})` : `Registered: ${data.name} (${applicationId})`, 'success');
      EnterpriseExt.refreshUniversalSearchIfActive();
      render();

      if (!id && postAction === 'service' && savedCust?.id) {
        setTimeout(() => {
          window.MJK.openServiceModal(null, '', '', '', savedCust.id);
        }, 60);
      }
    } catch (err) {
      showToast(err?.message || 'Failed to save customer.', 'danger');
    }
  },

  editCustomer: (id) => {
    window.MJK.openCustomerModal(id);
  },

  promptDeleteCustomer: (id) => {
    if (!canMenu('customers', 'delete')) {
      showToast('Permission Denied: You do not have Delete permission for Customers.', 'danger');
      return;
    }
    const cust = getCustomerById(id);
    showDeleteReasonDialog(
      'Delete Customer Record?',
      `Customer ${cust ? `${cust.name} (${cust.id})` : id} will be removed and your Delete Reason will be permanently logged.`,
      async (reason) => {
        deleteCustomer(id);
        await logDeleteHistory({
          targetType: 'CUSTOMER',
          targetId: id,
          targetSummary: cust ? `${cust.name} (${cust.phone || ''})` : id,
          reason
        });
        try {
          await fetch(`/api/customers/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
        } catch {}
        showToast('Customer deleted and Delete Reason logged.', 'info');
        render();
      }
    );
  },

  viewCustomerProfile: async (id, initialTab = 'personal') => {
    const history = getCustomerFullHistory(id);
    if (!history) return;
    const c = history.customer;
    const caseRec = await ensureFollowupCaseForCustomer(c);
    const dashData = get90DayDashboardData();
    const caseWithMetrics = dashData.cases.find(x => x.id === caseRec?.id) || caseRec;
    const metrics = caseWithMetrics?._metrics || {
      startDate: c.regDate || getTodayDate(),
      endDate: '',
      elapsedDays: 0,
      remainingDays: 90,
      progressPct: 12,
      completedMilestonesCount: 1,
      totalMilestones: 8,
      isCompleted: false,
      isOverdue: false,
      overdueDays: 0
    };
    const visitStats = getCustomerVisitAnalytics(id);
    AppState.activeCustProfileId = c.id;
    AppState.activeCustProfileTab = initialTab || 'personal';

    const cleanPhone = (c.phone || '').replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}` : (c.phone || '-');
    const timelineNotes = Array.isArray(caseWithMetrics?.timeline) ? caseWithMetrics.timeline : [];
    const schedule = Array.isArray(caseWithMetrics?.schedule) ? caseWithMetrics.schedule : buildDefault90DaySchedule(metrics.startDate, true);
    const grievances = history.grievances || [];
    const documents = history.documents || [];
    const custReminders = getRemindersForCustomer(c.id);
    const dynamicAppStatuses = getAdminOptionLabels('application_status', { activeOnly: true, includeValues: [caseWithMetrics?.currentStatus || 'Submitted'] });

    // Unified chronological Complete Timeline across all events
    const unifiedTimeline = [
      ...timelineNotes.map(tl => ({
        date: tl.date || (tl.timestamp || '').slice(0, 10),
        timestamp: tl.timestamp || tl.date || '',
        kind: 'FOLLOWUP',
        badge: `Day ${tl.cycleDay ?? 0} Follow-up`,
        color: '#6d28d9',
        bg: '#f5f3ff',
        title: `${tl.followupMode || 'Follow-up'} — ${tl.previousStatus || ''} → ${tl.newStatus || ''}`,
        detail: tl.note,
        meta: `By ${tl.recordedBy || 'Staff'}${tl.nextFollowupDate ? ` · Next: ${formatDate(tl.nextFollowupDate)}` : ''}`
      })),
      ...grievances.map(g => ({
        date: g.date || '',
        timestamp: g.createdAt || g.date || '',
        kind: 'GRIEVANCE',
        badge: `Grievance (${g.source || 'Portal'})`,
        color: '#ea580c',
        bg: '#fff7ed',
        title: `${g.type || 'Grievance'} · Ref: ${g.referenceNumber || '-'}`,
        detail: g.description || g.status || '-',
        meta: `To: ${g.submittedTo || '-'} · Status: ${g.status || '-'}`
      })),
      ...visitStats.visitsLatestFirst.map(v => ({
        date: v.visitDate || '',
        timestamp: v.visitDate || '',
        kind: 'VISIT',
        badge: 'Counter Visit',
        color: '#0d9488',
        bg: '#f0fdfa',
        title: `${v.serviceCountOnDay} Service(s): ${(v.servicesProvided || []).join(', ')}`,
        detail: v.remarks || 'Customer visited counter',
        meta: v.daysFromPrevious === null ? 'First Visit' : `${v.daysFromPrevious} day(s) after previous visit`
      })),
      ...history.services.map(s => ({
        date: s.createdAt?.slice(0, 10) || s.serviceDate || '',
        timestamp: s.createdAt || '',
        kind: 'SERVICE',
        badge: 'Billed Service',
        color: '#1d4ed8',
        bg: '#eff6ff',
        title: `${s.serviceName} (${s.refNumber || s.id})`,
        detail: `Status: ${s.status} · Total: ${formatINR(s.totalAmount)}`,
        meta: s.category || ''
      })),
      ...history.payments.map(p => ({
        date: p.paymentDate || '',
        timestamp: p.createdAt || p.paymentDate || '',
        kind: 'PAYMENT',
        badge: 'Payment',
        color: '#15803d',
        bg: '#f0fdf4',
        title: `${p.paymentMethod || 'Cash'} Payment: +${formatINR(p.paymentAmount)}`,
        detail: `Txn ID: ${p.transactionId || p.id}`,
        meta: p.remarks || ''
      })),
      ...documents.map(d => ({
        date: d.uploadDate || d.createdAt?.slice(0, 10) || '',
        timestamp: d.createdAt || d.uploadDate || '',
        kind: 'DOCUMENT',
        badge: 'Document',
        color: '#475569',
        bg: '#f8fafc',
        title: `Uploaded: ${d.name || d.title || d.fileName || 'Document'}`,
        detail: d.category || 'Vault Document',
        meta: d.remarks || ''
      }))
    ].sort((a, b) => (b.timestamp || b.date || '').localeCompare(a.timestamp || a.date || ''));

    const activeUsers = getAllUsers().filter(u => u.status === 'ACTIVE' && u.uid);
    const todayStr = getTodayDate();

    const content = `
      <!-- Header Banner with Unique Customer ID + Application ID + Scheme + Status + Staff -->
      <div style="margin-bottom:1rem; padding-bottom:0.85rem; border-bottom:1px solid var(--border-subtle);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              <h3 style="font-size:1.25rem; font-weight:800; color:var(--blue-600); margin:0;">${escHtml(c.name)}</h3>
              <span class="badge ${FINAL_CASE_STATUSES.has(caseWithMetrics?.currentStatus) ? 'badge-success' : metrics.isOverdue ? 'badge-danger' : 'badge-info'}">
                ${escHtml(caseWithMetrics?.currentStatus || c.currentStatus || 'Submitted')}
              </span>
              ${metrics.isOverdue ? `<span class="badge badge-danger">🚨 ${metrics.overdueDays}d Overdue</span>` : ''}
            </div>
            <div style="font-size:0.79rem; color:var(--text-muted); margin-top:0.25rem;">
              App ID: <strong class="font-mono" style="color:var(--violet-600, #6d28d9);">${escHtml(caseWithMetrics?.applicationId || c.applicationId || '-')}</strong>
              · Scheme: <strong>${escHtml(caseWithMetrics?.schemeName || c.schemeName || '-')}</strong>
              · Village/Ward: <strong>${escHtml(caseWithMetrics?.villageOrWard || c.villageOrWard || c.village || '-')}</strong>
            </div>
            <div style="font-size:0.82rem; margin-top:0.4rem; display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
              <a href="tel:${cleanPhone}" class="btn btn-secondary btn-sm" style="text-decoration:none;">📞 ${escHtml(formattedPhone)}</a>
              ${renderWhatsAppQuickButton({
                phone: c.phone,
                customerName: c.name,
                serviceName: caseWithMetrics?.schemeName || (Array.isArray(c.services) && c.services[0]) || '',
                refNumber: caseWithMetrics?.applicationId || c.applicationId || '',
                status: caseWithMetrics?.currentStatus || '',
                context: 'CUSTOMER'
              }, false)}
              <span class="badge badge-neutral">Staff: ${escHtml(caseWithMetrics?.assignedStaff || c.assignedStaff || '-')}</span>
              <span class="badge badge-neutral">Day ${metrics.elapsedDays} / 90</span>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.35rem;">
            <span class="badge badge-info" style="font-family:monospace; font-size:0.82rem; padding:0.28rem 0.6rem;">${escHtml(c.id)}</span>
            <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
              <button class="btn btn-outline btn-sm" style="font-size:0.71rem;" onclick="window.MJK.exportSingleCustomerReport('${escAttrJs(c.id)}', 'pdf')">📄 PDF</button>
              <button class="btn btn-outline btn-sm" style="font-size:0.71rem;" onclick="window.MJK.exportSingleCustomerReport('${escAttrJs(c.id)}', 'excel')">📊 Excel</button>
              <button class="btn btn-outline btn-sm" style="font-size:0.71rem;" onclick="window.MJK.exportSingleCustomerReport('${escAttrJs(c.id)}', 'csv')">📥 CSV</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Strictly 7 Dedicated Customer Profile Tabs -->
      <div class="tab-nav" style="flex-wrap:wrap; gap:0.25rem; margin-bottom:0.85rem;">
        <button class="tab-btn ${initialTab === 'personal' ? 'active' : ''}" id="tab-cust-personal" onclick="window.MJK.switchCustProfileTab('personal')">👤 Personal Info</button>
        <button class="tab-btn ${initialTab === 'application' ? 'active' : ''}" id="tab-cust-application" onclick="window.MJK.switchCustProfileTab('application')">🗂️ Application Info</button>
        <button class="tab-btn ${initialTab === 'status' ? 'active' : ''}" id="tab-cust-status" onclick="window.MJK.switchCustProfileTab('status')">📊 Current Status</button>
        <button class="tab-btn ${initialTab === 'followups' ? 'active' : ''}" id="tab-cust-followups" onclick="window.MJK.switchCustProfileTab('followups')">📞 Follow-up History (${timelineNotes.length})</button>
        <button class="tab-btn ${initialTab === 'grievances' ? 'active' : ''}" id="tab-cust-grievances" onclick="window.MJK.switchCustProfileTab('grievances')">⚖️ Grievance History (${grievances.length})</button>
        <button class="tab-btn ${initialTab === 'documents' ? 'active' : ''}" id="tab-cust-documents" onclick="window.MJK.switchCustProfileTab('documents')">📄 Documents (${documents.length})</button>
        <button class="tab-btn ${initialTab === 'timeline' ? 'active' : ''}" id="tab-cust-timeline" onclick="window.MJK.switchCustProfileTab('timeline')">⏱️ Complete Timeline (${unifiedTimeline.length})</button>
      </div>

      <!-- TAB 1: Personal Info -->
      <div id="cust-tab-content-personal" style="display:${initialTab === 'personal' ? 'block' : 'none'};">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap:0.65rem; font-size:0.81rem;">
          <div style="padding:0.75rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-alt);">
            <div style="font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Identity &amp; Contact</div>
            <div style="margin-top:0.35rem;"><strong>Name:</strong> ${escHtml(c.name)}</div>
            <div><strong>Guardian:</strong> ${escHtml(c.fatherName || '-')}</div>
            <div><strong>Mobile:</strong> ${escHtml(formattedPhone)} ${c.altPhone ? `· Alt: ${escHtml(c.altPhone)}` : ''}</div>
            ${c.email ? `<div><strong>Email:</strong> ${escHtml(c.email)}</div>` : ''}
            <div><strong>Category:</strong> ${escHtml(c.category || 'General Public')}</div>
            <div><strong>Aadhaar (Last 4):</strong> ${c.aadhaarLast4 ? `XXXX-XXXX-${escHtml(c.aadhaarLast4)}` : '-'}</div>
            <div><strong>Job Card:</strong> ${escHtml(c.jobCardNo || '-')}</div>
          </div>
          <div style="padding:0.75rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-alt);">
            <div style="font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Location &amp; Address</div>
            <div style="margin-top:0.35rem;"><strong>Village / Ward:</strong> ${escHtml(c.villageOrWard || c.village || '-')}</div>
            <div><strong>Post Office:</strong> ${escHtml(c.postOffice || '-')}</div>
            <div><strong>Police Station:</strong> ${escHtml(c.policeStation || '-')}</div>
            <div><strong>District &amp; State:</strong> ${escHtml(c.district || '-')}, ${escHtml(c.state || '-')}</div>
            <div><strong>PIN Code:</strong> ${escHtml(c.pinCode || '-')}</div>
            <div><strong>Full Address:</strong> ${escHtml(c.address || '-')}</div>
          </div>
          <div style="padding:0.75rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-alt);">
            <div style="font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Visit &amp; Financial Summary</div>
            <div style="margin-top:0.35rem;"><strong>Registration Date:</strong> ${formatDate(c.regDate)}</div>
            <div><strong>First Visit:</strong> ${visitStats.firstVisitDate ? formatDate(visitStats.firstVisitDate) : 'None yet'}</div>
            <div><strong>Last Visit:</strong> ${visitStats.lastVisitDate ? formatDate(visitStats.lastVisitDate) : 'None yet'}</div>
            <div><strong>Total Visits:</strong> ${visitStats.totalVisitCount} · <strong>Total Spent:</strong> ${formatINR(history.totalSpent)}</div>
            <div><strong>Pending Due:</strong> <span style="color:${history.totalDue > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:700;">${formatINR(history.totalDue)}</span></div>
          </div>
        </div>
        ${Array.isArray(c.services) && c.services.length > 0 ? `
          <div style="margin-top:0.75rem; padding:0.7rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
            <div style="font-size:0.72rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.35rem;">Registered Services (${c.services.length})</div>
            <div style="display:flex; flex-wrap:wrap; gap:0.3rem;">
              ${c.services.map(s => `<span style="background:#dbeafe; color:#1e40af; padding:0.15rem 0.5rem; border-radius:999px; font-size:0.72rem; font-weight:600;">${escHtml(s)}</span>`).join('')}
            </div>
          </div>
        ` : ''}
        <div style="margin-top:0.75rem; padding:0.75rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-alt);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.45rem;">
            <div style="font-size:0.72rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">📅 Seminars, Gas Delivery &amp; Promo Reminders (${custReminders.length})</div>
            <button type="button" class="btn btn-outline btn-sm" style="font-size:0.71rem;" onclick="window.MJK.openReminderModal('${escAttrJs(c.id)}')">+ Schedule Reminder</button>
          </div>
          ${custReminders.length === 0 ? `
            <div style="font-size:0.78rem; color:var(--text-muted);">No reminders scheduled for this customer yet.</div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:0.35rem; max-height:150px; overflow-y:auto;">
              ${custReminders.map(rem => `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap; padding:0.45rem 0.6rem; border:1px solid var(--border-subtle); border-radius:var(--radius-sm); background:var(--surface); font-size:0.78rem;">
                  <div>
                    <span class="badge ${rem.isCompleted ? 'badge-success' : rem.isOverdue ? 'badge-danger' : 'badge-info'}" style="font-size:0.68rem;">${escHtml(rem.reminderType)}</span>
                    <strong style="margin-left:0.3rem;">${escHtml(rem.title)}</strong>
                    <div style="font-size:0.71rem; color:var(--text-muted);">${formatDate(rem.reminderDate)} at ${escHtml(rem.reminderTime)}${rem.note && rem.note !== rem.title ? ` · ${escHtml(rem.note)}` : ''}</div>
                  </div>
                  ${!rem.isCompleted ? `<button type="button" class="btn btn-success btn-sm" style="font-size:0.69rem; padding:0.15rem 0.45rem;" onclick="window.MJK.toggleSmartReminderDone('${escAttrJs(rem.id)}', true); setTimeout(() => window.MJK.viewCustomerProfile('${escAttrJs(c.id)}', 'personal'), 80);">✓ Done</button>` : '<span style="font-size:0.71rem; color:var(--success); font-weight:700;">✅ Done</span>'}
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      <!-- TAB 2: Application Info -->
      <div id="cust-tab-content-application" style="display:${initialTab === 'application' ? 'block' : 'none'};">
        <div style="padding:0.85rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-alt); margin-bottom:0.75rem; font-size:0.82rem;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 190px), 1fr)); gap:0.55rem;">
            <div><span style="color:var(--text-muted);">Unique Application ID:</span><br><strong class="font-mono" style="color:var(--violet-600, #6d28d9); font-size:0.92rem;">${escHtml(caseWithMetrics?.applicationId || c.applicationId || '-')}</strong></div>
            <div><span style="color:var(--text-muted);">Scheme / Service Name:</span><br><strong>${escHtml(caseWithMetrics?.schemeName || c.schemeName || '-')}</strong></div>
            <div><span style="color:var(--text-muted);">Village / Ward:</span><br><strong>${escHtml(caseWithMetrics?.villageOrWard || c.villageOrWard || c.village || '-')}</strong></div>
            <div><span style="color:var(--text-muted);">Assigned Staff:</span><br><strong>${escHtml(caseWithMetrics?.assignedStaff || c.assignedStaff || '-')}</strong></div>
            <div><span style="color:var(--text-muted);">Day 0 Start Date:</span><br><strong>${formatDate(metrics.startDate)}</strong></div>
            <div><span style="color:var(--text-muted);">Day 90 Target End Date:</span><br><strong>${metrics.endDate ? formatDate(metrics.endDate) : '-'}</strong></div>
          </div>
        </div>
        <div style="font-size:0.78rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.45rem;">Linked Billed Services &amp; Scheme Records (${history.services.length + history.annapurnaApps.length + history.govtCases.length})</div>
        <div style="display:flex; flex-direction:column; gap:0.45rem; max-height:210px; overflow-y:auto;">
          ${history.services.map(s => `
            <div style="padding:0.55rem 0.75rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
              <div><strong>${escHtml(s.serviceName)}</strong><div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(s.category)} · Ref: ${escHtml(s.refNumber)}</div></div>
              <div style="text-align:right;"><span class="badge badge-info">${escHtml(s.status)}</span><div style="font-size:0.73rem; font-weight:700;">${formatINR(s.totalAmount)}</div></div>
            </div>
          `).join('')}
          ${history.annapurnaApps.map(a => {
            const rw = resolveWardForApp(a);
            const wardDisp = a.wardNumber || a.wardName || (rw ? formatWardLabel(rw) : a.gpOrWard) || '';
            const locText = [wardDisp, a.village].filter(Boolean).join(' · ');
            return `
            <div style="padding:0.55rem 0.75rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center; gap:0.5rem; cursor:pointer;" onclick="window.MJK.openAnnapurnaDetailModal('${escAttrJs(a.id)}')">
              <div>
                <strong>Annapurna Yojana (${escHtml(a.applicationId)})</strong>
                <div style="font-size:0.72rem; color:var(--text-muted);">
                  Date: ${formatDate(a.applicationDate || a.submissionDate)}${locText ? ` · ${escHtml(locText)}` : ''}
                </div>
              </div>
              <span class="badge badge-info">${escHtml(a.currentStatus || a.status || 'Active')}</span>
            </div>
          `;
          }).join('')}
          ${history.govtCases.map(g => `
            <div style="padding:0.55rem 0.75rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
              <div><strong>${escHtml(g.schemeName)} (${escHtml(g.applicationId || g.id)})</strong><div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(g.workType || '')}</div></div>
              <span class="badge badge-info">${escHtml(g.status || 'Submitted')}</span>
            </div>
          `).join('')}
          ${(history.services.length + history.annapurnaApps.length + history.govtCases.length) === 0 ? '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.8rem;">Primary 90-Day Case Application is active above. Use "+ Billing Service" below to attach billed counter receipts.</div>' : ''}
        </div>
      </div>

      <!-- TAB 3: Current Status & 90-Day Schedule (Day 0 to Day 90) -->
      <div id="cust-tab-content-status" style="display:${initialTab === 'status' ? 'block' : 'none'};">
        <div style="padding:0.85rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-alt); margin-bottom:0.85rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.45rem;">
            <div>
              <span style="font-size:0.76rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">90-Day Follow-up Progress</span>
              <div style="font-size:1.05rem; font-weight:800;">Day ${metrics.elapsedDays} of 90 (${metrics.completedMilestonesCount}/${metrics.totalMilestones} Milestones Done)</div>
            </div>
            <span class="badge ${metrics.isCompleted ? 'badge-success' : metrics.isOverdue ? 'badge-danger' : 'badge-info'}" style="font-size:0.82rem; padding:0.35rem 0.75rem;">
              ${escHtml(caseWithMetrics?.currentStatus || 'Submitted')}
            </span>
          </div>
          <div style="height:8px; background:var(--surface); border-radius:999px; overflow:hidden; border:1px solid var(--border-subtle);">
            <div style="height:100%; width:${metrics.progressPct}%; background:${metrics.isCompleted ? '#16a34a' : metrics.isOverdue ? '#dc2626' : '#0d9488'};"></div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap:0.5rem; max-height:255px; overflow-y:auto;">
          ${schedule.map(m => {
            const isPastDue = !m.completed && m.scheduledDate < todayStr && !metrics.isCompleted;
            const isDueToday = !m.completed && m.scheduledDate === todayStr && !metrics.isCompleted;
            const borderCol = m.completed ? '#86efac' : isPastDue ? '#fca5a5' : isDueToday ? '#93c5fd' : 'var(--border-subtle)';
            const bgCol = m.completed ? '#f0fdf4' : isPastDue ? '#fef2f2' : isDueToday ? '#eff6ff' : 'var(--surface)';
            return `
              <div style="padding:0.65rem; border:1px solid ${borderCol}; background:${bgCol}; border-radius:var(--radius-md); font-size:0.78rem;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <strong style="color:${m.completed ? '#15803d' : isPastDue ? '#dc2626' : '#0f172a'};">Day ${m.day}</strong>
                  <span style="font-size:0.7rem; font-weight:700;">
                    ${m.completed ? '✅ Done' : isPastDue ? '🚨 Overdue' : isDueToday ? '📅 Today' : '⏳ Scheduled'}
                  </span>
                </div>
                <div style="font-size:0.73rem; color:var(--text-muted); margin-top:2px;">Due: <strong>${formatDate(m.scheduledDate)}</strong></div>
                <div style="font-size:0.72rem; margin-top:3px;">${escHtml(m.label || '')}</div>
                ${m.completed && m.completedDate ? `<div style="font-size:0.69rem; color:#15803d; margin-top:3px;">Completed: ${formatDate(m.completedDate)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- TAB 4: Follow-up History + Inline Non-Overwriting Follow-up Entry Form -->
      <div id="cust-tab-content-followups" style="display:${initialTab === 'followups' ? 'block' : 'none'};">
        <form onsubmit="window.MJK.submitInlineCustomerFollowup(event, '${escAttrJs(caseWithMetrics?.id || '')}', '${escAttrJs(c.id)}')"
          style="padding:0.8rem; border:1px solid #c4b5fd; background:#f5f3ff; border-radius:var(--radius-md); margin-bottom:0.85rem;">
          <div style="font-size:0.78rem; font-weight:800; color:#5b21b6; margin-bottom:0.5rem;">
            + Add New Follow-up Note (Non-Overwriting Sequential Timeline)
          </div>
          <div class="form-row" style="margin-bottom:0.45rem;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:0.72rem;">Milestone Day</label>
              <select id="cp-flw-milestone" class="form-control" style="height:34px; font-size:0.78rem;">
                <option value="">Auto / Custom Day</option>
                ${FOLLOWUP_CYCLE_DAYS.map(d => `<option value="${d}" ${caseWithMetrics?.nextMilestoneDay === d ? 'selected' : ''}>Day ${d}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:0.72rem;">Follow-up Mode</label>
              <select id="cp-flw-mode" class="form-control" style="height:34px; font-size:0.78rem;">
                ${FOLLOWUP_MODES.map(mode => `<option value="${escHtml(mode)}">${escHtml(mode)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:0.25rem; margin-bottom:0.2rem;">
                <label class="form-label" style="font-size:0.72rem; margin:0;">Update Status</label>
                <button type="button" class="btn btn-outline btn-sm" style="padding:0.05rem 0.35rem; font-size:0.65rem;" onclick="window.MJK.openManageDynamicOptionsModal('followup_status', 'cp-flw-status')" title="Manage Custom Statuses">+</button>
              </div>
              <select id="cp-flw-status" class="form-control" style="height:34px; font-size:0.78rem;">
                ${dynamicAppStatuses.map(st => `<option value="${escHtml(st)}" ${(caseWithMetrics?.currentStatus || 'Submitted') === st ? 'selected' : ''}>${escHtml(st)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:0.72rem;">Next Follow-up Date</label>
              <input type="date" id="cp-flw-nextdate" class="form-control" style="height:34px; font-size:0.78rem;" value="${escHtml(caseWithMetrics?.nextFollowupDate || '')}">
            </div>
          </div>
          <div style="display:flex; gap:0.5rem; align-items:flex-end; flex-wrap:wrap;">
            <div style="flex:1; min-width:min(100%, 240px);">
              <textarea id="cp-flw-note" class="form-control" rows="2" required placeholder="Enter new follow-up note (appends sequentially — never overwrites old notes)..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-sm" style="height:38px;">+ Save Note</button>
          </div>
        </form>

        <div style="display:flex; flex-direction:column; gap:0.45rem; max-height:210px; overflow-y:auto;">
          ${[...timelineNotes].reverse().map(tl => `
            <div style="padding:0.65rem; border:1px solid var(--border-subtle); border-left:4px solid #6d28d9; border-radius:var(--radius-md); background:var(--surface);">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.35rem;">
                <span style="font-weight:800; font-size:0.78rem; color:#5b21b6;">#${tl.entryNo || '-'} · ${escHtml(tl.milestoneLabel || `Day ${tl.cycleDay ?? 0}`)}</span>
                <span style="font-size:0.71rem; color:var(--text-muted);">${formatDate(tl.date)} · ${escHtml(tl.followupMode || '')} · By ${escHtml(tl.recordedBy || 'Staff')}</span>
              </div>
              <div style="font-size:0.81rem; margin-top:0.25rem; color:var(--text-main);">${escHtml(tl.note)}</div>
              <div style="font-size:0.71rem; color:var(--text-muted); margin-top:0.25rem;">
                Status: <strong>${escHtml(tl.previousStatus || '-')} → ${escHtml(tl.newStatus || '-')}</strong>
                ${tl.nextFollowupDate ? ` · Next Follow-up: <strong>${formatDate(tl.nextFollowupDate)}</strong>` : ''}
              </div>
            </div>
          `).join('') || '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.8rem;">No follow-up entries recorded yet.</div>'}
        </div>
      </div>

      <!-- TAB 5: Grievance History -->
      <div id="cust-tab-content-grievances" style="display:${initialTab === 'grievances' ? 'block' : 'none'};">
        <form onsubmit="window.MJK.submitInlineCustomerGrievance(event, '${escAttrJs(caseWithMetrics?.id || '')}', '${escAttrJs(c.id)}')"
          style="padding:0.8rem; border:1px solid #fdba74; background:#fff7ed; border-radius:var(--radius-md); margin-bottom:0.85rem;">
          <div style="font-size:0.78rem; font-weight:800; color:#c2410c; margin-bottom:0.5rem;">⚖️ Log New Grievance / Complaint</div>
          <div class="form-row" style="margin-bottom:0.45rem;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:0.72rem;">Channel / Type</label>
              <select id="cp-grv-type" class="form-control" style="height:34px; font-size:0.78rem;">
                ${PUBLIC_GRIEVANCE_CHANNELS.map(ch => `<option value="${escHtml(ch)}">${escHtml(ch)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:0.72rem;">Grievance Ref No</label>
              <input type="text" id="cp-grv-ref" class="form-control" style="height:34px; font-size:0.78rem;" placeholder="e.g. CMO-2026-XXXX">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:0.72rem;">Submitted To</label>
              <input type="text" id="cp-grv-dept" class="form-control" style="height:34px; font-size:0.78rem;" placeholder="BDO / CMO / Portal" value="Concerned Department">
            </div>
          </div>
          <div style="display:flex; gap:0.5rem; align-items:flex-end; flex-wrap:wrap;">
            <div style="flex:1; min-width:min(100%, 240px);">
              <input type="text" id="cp-grv-desc" class="form-control" required placeholder="Describe grievance issue & action requested...">
            </div>
            <button type="submit" class="btn btn-primary btn-sm" style="height:38px;">+ Log Grievance</button>
          </div>
        </form>

        <div style="display:flex; flex-direction:column; gap:0.45rem; max-height:210px; overflow-y:auto;">
          ${grievances.map(g => `
            <div style="padding:0.65rem; border:1px solid var(--border-subtle); border-left:4px solid #ea580c; border-radius:var(--radius-md); background:var(--surface);">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.35rem;">
                <strong>${escHtml(g.type || 'Grievance')} · <span class="font-mono">${escHtml(g.referenceNumber || '-')}</span></strong>
                <span class="badge badge-warning">${escHtml(g.status || 'Submitted')}</span>
              </div>
              <div style="font-size:0.78rem; margin-top:0.25rem;">${escHtml(g.description || '-')}</div>
              <div style="font-size:0.71rem; color:var(--text-muted); margin-top:0.2rem;">
                Submitted To: ${escHtml(g.submittedTo || '-')} · Date: ${formatDate(g.date)} · Source: ${escHtml(g.source || 'Case')}
              </div>
            </div>
          `).join('') || '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.8rem;">No grievances logged for this customer.</div>'}
        </div>
      </div>

      <!-- TAB 6: Documents -->
      <div id="cust-tab-content-documents" style="display:${initialTab === 'documents' ? 'block' : 'none'};">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.65rem;">
          <span style="font-size:0.78rem; color:var(--text-muted);">Documents linked to Customer ID <strong>${escHtml(c.id)}</strong> or Application ID <strong>${escHtml(caseWithMetrics?.applicationId || c.applicationId)}</strong></span>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openRealDocumentUploadModal('${escAttrJs(caseWithMetrics?.applicationId || c.applicationId || '')}', '${escAttrJs(c.id)}')">
            ☁️ + Upload Document
          </button>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.45rem; max-height:240px; overflow-y:auto;">
          ${documents.map(d => `
            <div style="padding:0.6rem 0.75rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
              <div>
                <div style="font-weight:700; font-size:0.83rem;">📄 ${escHtml(d.name || d.title || 'Document')}</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">${escHtml(d.category || '')} · Uploaded: ${formatDate(d.uploadDate || d.createdAt?.slice(0, 10))} ${d.remarks ? `· ${escHtml(d.remarks)}` : ''}</div>
              </div>
              ${d.downloadUrl ? `<a href="${escHtml(d.downloadUrl)}" target="_blank" class="btn btn-secondary btn-sm">⬇ Open</a>` : `<span class="badge badge-neutral">${escHtml(d.file || 'Saved')}</span>`}
            </div>
          `).join('') || '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.8rem;">No documents uploaded for this customer/application yet. Click "+ Upload Document" above.</div>'}
        </div>
      </div>

      <!-- TAB 7: Complete Timeline -->
      <div id="cust-tab-content-timeline" style="display:${initialTab === 'timeline' ? 'block' : 'none'};">
        <div style="font-size:0.76rem; color:var(--text-muted); margin-bottom:0.55rem;">
          Complete chronological audit log across Follow-up Notes, Grievances, Counter Visits, Services, Payments &amp; Documents
        </div>
        <div style="display:flex; flex-direction:column; gap:0.45rem; max-height:275px; overflow-y:auto;">
          ${unifiedTimeline.map(ev => `
            <div style="padding:0.6rem 0.75rem; border:1px solid var(--border-subtle); border-left:4px solid ${ev.color}; border-radius:var(--radius-md); background:${ev.bg};">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.35rem;">
                <span style="font-size:0.72rem; font-weight:800; color:${ev.color}; text-transform:uppercase;">${escHtml(ev.badge)}</span>
                <span style="font-size:0.71rem; color:var(--text-muted); font-weight:600;">${ev.date ? formatDate(ev.date) : '-'}</span>
              </div>
              <div style="font-weight:700; font-size:0.82rem; margin-top:2px;">${escHtml(ev.title)}</div>
              <div style="font-size:0.77rem; color:var(--text-main); margin-top:2px;">${escHtml(ev.detail || '')}</div>
              ${ev.meta ? `<div style="font-size:0.69rem; color:var(--text-muted); margin-top:2px;">${escHtml(ev.meta)}</div>` : ''}
            </div>
          `).join('') || '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.8rem;">No timeline events recorded yet.</div>'}
        </div>
      </div>
    `;

    const footer = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:0.5rem;">
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="window.MJK.exportSingleCustomerReport('${escAttrJs(c.id)}', 'print')">🖨 Print Customer Dossier</button>
          <button class="btn btn-outline" onclick="window.MJK.printCustomerStatement('${escAttrJs(c.id)}')">📄 Account Statement</button>
        </div>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          ${history.totalDue > 0 ? `<button class="btn btn-success btn-sm" onclick="window.MJK.openCashCollectionModal('${escAttrJs(c.id)}')">💰 Collect Due (${formatINR(history.totalDue)})</button>` : ''}
          <button class="btn btn-violet btn-sm" onclick="window.MJK.openReminderModal('${escAttrJs(c.id)}')">📅 + Reminder</button>
          <button class="btn btn-primary btn-sm" onclick="window.MJK.openCustomerVisitModal('${escAttrJs(c.id)}')">📅 + Add Visit</button>
          <button class="btn btn-outline btn-sm" onclick="window.MJK.openServiceModal(null, '', '', '', '${escAttrJs(c.id)}')">⚡ + Billing Service</button>
          <button class="btn btn-secondary btn-sm" onclick="window.MJK.closeModal()">Close</button>
        </div>
      </div>
    `;

    openModal(`Customer 360° Case Profile: ${c.name} (${caseWithMetrics?.applicationId || c.id})`, content, footer, 'modal-lg');
  },

  switchCustProfileTab: (tabKey) => {
    AppState.activeCustProfileTab = tabKey;
    ['personal', 'application', 'status', 'followups', 'grievances', 'documents', 'timeline'].forEach(k => {
      const btn = document.getElementById(`tab-cust-${k}`);
      const pane = document.getElementById(`cust-tab-content-${k}`);
      if (btn) btn.classList.toggle('active', k === tabKey);
      if (pane) pane.style.display = k === tabKey ? 'block' : 'none';
    });
  },

  submitInlineCustomerFollowup: async (e, caseId, customerId) => {
    e.preventDefault();
    try {
      let targetCaseId = caseId;
      if (!targetCaseId) {
        const cust = getCustomerById(customerId);
        const ensured = cust ? await ensureFollowupCaseForCustomer(cust) : null;
        targetCaseId = ensured?.id || '';
      }
      const milestoneVal = document.getElementById('cp-flw-milestone')?.value;
      const res = await addTimelineFollowupEntry(targetCaseId, {
        milestoneDay: milestoneVal !== '' && milestoneVal !== undefined ? Number(milestoneVal) : null,
        followupMode: document.getElementById('cp-flw-mode')?.value || 'Phone Call',
        newStatus: document.getElementById('cp-flw-status')?.value || undefined,
        nextFollowupDate: document.getElementById('cp-flw-nextdate')?.value || '',
        note: document.getElementById('cp-flw-note')?.value || ''
      });
      if (!res?.success) {
        showToast(res?.message || 'Could not save follow-up note.', 'danger');
        return;
      }
      showToast(`Follow-up Entry #${res.entry.entryNo} appended to timeline (Non-Overwriting)!`, 'success');
      await window.MJK.viewCustomerProfile(customerId, 'followups');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save follow-up note.', 'danger');
    }
  },

  submitInlineCustomerGrievance: async (e, caseId, customerId) => {
    e.preventDefault();
    try {
      let targetCaseId = caseId;
      if (!targetCaseId) {
        const cust = getCustomerById(customerId);
        const ensured = cust ? await ensureFollowupCaseForCustomer(cust) : null;
        targetCaseId = ensured?.id || '';
      }
      const res = await addGrievanceToCase(targetCaseId, {
        type: document.getElementById('cp-grv-type')?.value || 'Portal Grievance / Complaint',
        referenceNumber: document.getElementById('cp-grv-ref')?.value || '',
        submittedTo: document.getElementById('cp-grv-dept')?.value || 'Concerned Department',
        description: document.getElementById('cp-grv-desc')?.value || ''
      });
      if (!res?.success) {
        showToast(res?.message || 'Could not log grievance.', 'danger');
        return;
      }
      showToast(`Grievance ${res.grievance.referenceNumber} logged to case & timeline!`, 'success');
      await window.MJK.viewCustomerProfile(customerId, 'grievances');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to log grievance.', 'danger');
    }
  },

  buildServiceAutoPickerOptionsHtml: (selected = '', includeInventory = true) => {
    const inStockAccessories = includeInventory ? getAllInventory().filter(inv => Number(inv.stockQuantity) > 0) : [];
    const list = getUnifiedServiceList();
    const groups = {};
    list.forEach(item => {
      const grp = item.group || item.category || 'Other Services';
      if (!groups[grp]) groups[grp] = [];
      groups[grp].push(item);
    });

    const invGroupHtml = includeInventory && inStockAccessories.length > 0 ? `
      <optgroup label="Gas Accessories &amp; Retail Stock (In Stock)">
        ${inStockAccessories.map(inv => `
          <option value="__INV__${escHtml(inv.id)}">
            ${escHtml(inv.name)} [${escHtml(inv.category || 'Gas Accessories')}] (Stock: ${inv.stockQuantity} ${escHtml(inv.unit || 'Pcs')}) — [₹${Number(inv.sellingPrice) || 0}]
          </option>
        `).join('')}
      </optgroup>
    ` : '';

    return invGroupHtml + Object.keys(groups).map(grp => `
      <optgroup label="${escHtml(grp)}">
        ${groups[grp].map(item => {
          const shop = Number(item.defaultCharge) || 0;
          const gov = Number(item.defaultGovFee) || 0;
          const total = shop + gov;
          const isSel = selected && item.name.toLowerCase() === String(selected).toLowerCase();
          return `
            <option value="${escHtml(item.name)}" data-rate-id="${escHtml(item.rateId || '')}" data-category="${escHtml(item.category || '')}" ${isSel ? 'selected' : ''}>
              ${escHtml(item.name)}${item.nameBn ? ` (${escHtml(item.nameBn)})` : ''} — [Shop ₹${shop}${gov > 0 ? ` + Govt ₹${gov}` : ''} = ₹${total}]
            </option>
          `;
        }).join('')}
      </optgroup>
    `).join('');
  },

  // Service Modals & Actions
  openServiceModal: (serviceId = null, defaultCat = '', defaultSubcat = '', presetServiceName = '', presetCustomerId = '', presetRateId = '') => {
    const srv = serviceId ? getServiceById(serviceId) : null;
    const isEditMode = !!srv;
    const customers = getAllCustomers();
    const serviceCategories = getServiceCategories();
    const initialCat = srv ? srv.category : (defaultCat || serviceCategories[0] || SERVICE_CATEGORIES[0]);
    const initialSubcat = srv ? (srv.subcategory || '') : (defaultSubcat || '');
    const activeCustId = srv ? srv.customerId : (presetCustomerId || '');
    const selectedSrvName = presetServiceName || (srv ? srv.serviceName : '');

    if (!isEditMode) {
      AppState.serviceModalCart = [];
      AppState.serviceModalReceiptId = previewNextGlobalReference('RCPT');
      AppState.serviceModalMergeTarget = null;
    }

    const serviceStatuses = getServiceStatuses(srv ? [srv.status] : []);
    const renderServiceSelectOptions = (selected = '') =>
      window.MJK.buildServiceAutoPickerOptionsHtml(selected, !isEditMode);

    const newCustAadhaarSlot = `
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">Aadhaar Reference (Last 4 Digits)</label>
        <input type="text" id="srv-newcust-aadhaar" class="form-control font-mono tabular-nums" maxlength="4" pattern="[0-9]{4}" placeholder="Last 4 digits">
      </div>
    `;

    const content = isEditMode ? `
      <form id="service-form" onsubmit="window.MJK.handleSaveService(event, '${serviceId || ''}')">
        <input type="hidden" id="srv-edit-id" value="${serviceId || ''}">

        <div class="smart-service-banner" style="background: var(--surface-alt); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.85rem; margin-bottom: 1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem; flex-wrap:wrap; gap:0.4rem;">
            <label style="font-weight:700; color:var(--blue-600); font-size:0.86rem; margin:0;">
              Smart Service Auto-Mapper (Live Rate Chart)
            </label>
            <span class="font-mono tabular-nums" style="font-size:0.74rem; color:var(--text-muted);">Receipt: ${escHtml(srv.receiptId || srv.id)}</span>
          </div>
          ${renderSearchableServiceSelectorHtml('srv-rate-search', {
            label: 'Search Service in English or Bengali',
            placeholder: 'Type service name (English/Bengali) to auto-fill Shop & Govt fee...',
            singleSelect: true,
            showBilling: false
          })}
          <select id="srv-auto-picker" class="form-control" onchange="window.MJK.handleAutoServiceSelect(this.value, this)" style="font-weight:600; font-size:0.86rem;">
            <option value="">-- Or Browse Full Category List --</option>
            ${renderServiceSelectOptions(selectedSrvName)}
          </select>
          <div id="srv-auto-mapped-badge" style="display:none; margin-top:0.55rem; padding:0.45rem 0.7rem; background:#ecfdf5; border:1px solid #10b981; border-radius:6px; color:#065f46; font-size:0.78rem;"></div>
          <div id="srv-duplicate-warning" style="display:none; margin-top:0.55rem; padding:0.45rem 0.7rem; background:#fef2f2; border:1px solid #ef4444; border-radius:6px; color:#991b1b; font-size:0.8rem;"></div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Select Customer <span class="req">*</span></label>
            <select id="srv-cust-id" class="form-control" required onchange="window.MJK.handleCustomerSelectInService(this.value)">
              <option value="">-- Choose Existing Customer --</option>
              ${customers.map(c => `
                <option value="${c.id}" ${activeCustId === c.id ? 'selected' : ''}>${c.name} (${c.phone}) - ${c.village || 'Mamudpur'}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Customer Mobile (WhatsApp Auto Connect)</label>
            <div style="display:flex; gap:0.4rem; align-items:center;">
              <input type="tel" id="srv-phone" class="form-control" value="${escHtml(srv.phone || '')}" placeholder="Enter or select customer mobile">
              <button type="button" class="btn btn-sm" style="background:#16a34a; color:#fff; font-weight:700; white-space:nowrap;" onclick="window.MJK.openServiceModalWhatsApp()">💬 WhatsApp</button>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
              <label class="form-label" style="margin:0;">Main Category <span class="req">*</span></label>
              <button type="button" class="btn btn-outline btn-sm" style="padding:0.1rem 0.4rem; font-size:0.68rem;" onclick="window.MJK.openManageDynamicOptionsModal('service_category', 'srv-cat')" title="Manage Custom Categories">+</button>
            </div>
            <select id="srv-cat" class="form-control" required onchange="const nw=document.getElementById('srv-new-cat-wrap'); if(this.value==='__NEW_CATEGORY__'){if(nw)nw.style.display='block';}else{if(nw)nw.style.display='none'; window.MJK.handleServiceCategoryChange(this.value);}">
              ${serviceCategories.map(c => `<option value="${c}" ${srv.category === c ? 'selected' : ''}>${c}</option>`).join('')}
              <option value="__NEW_CATEGORY__">+ Add New Custom Category...</option>
            </select>
            <div id="srv-new-cat-wrap" style="display:none; margin-top:0.45rem;">
              <input type="text" id="srv-new-cat" class="form-control" placeholder="Enter new custom category name...">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Subcategory / Service <span class="req">*</span></label>
            <select id="srv-subcat" class="form-control" onchange="window.MJK.handleSubcategoryChange(this.value)">
              <option value="">-- Choose Subcategory --</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group" style="flex:2;">
            <label class="form-label">Service Title / Specific Details <span class="req">*</span></label>
            <input type="text" id="srv-name" class="form-control" value="${escHtml(srv.serviceName)}" required oninput="window.MJK.checkServiceModalDuplicate()">
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Acknowledgment / Ref Number</label>
            <input type="text" id="srv-ref" class="form-control font-mono" value="${escHtml(srv.refNumber)}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Expected Delivery Date</label>
            <input type="date" id="srv-delivery-date" class="form-control" value="${escHtml(srv.deliveryDate || getTodayDate())}">
          </div>
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
              <label class="form-label" style="margin:0;">Status</label>
              <button type="button" class="btn btn-outline btn-sm" style="padding:0.1rem 0.4rem; font-size:0.68rem;" onclick="window.MJK.openManageDynamicOptionsModal('service_status', 'srv-status')" title="Manage Custom Statuses">+</button>
            </div>
            <select id="srv-status" class="form-control">
              ${serviceStatuses.map(st => `<option value="${escHtml(st)}" ${srv.status === st ? 'selected' : ''}>${escHtml(st)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row" style="background:var(--surface-alt); padding:0.85rem; border-radius:var(--radius-md); margin-bottom:1rem;">
          <div class="form-group">
            <label class="form-label">Service Charge (₹)</label>
            <input type="number" id="srv-charge" class="form-control font-mono" value="${srv.serviceCharge}" oninput="window.MJK.calculateServiceTotals()">
          </div>
          <div class="form-group">
            <label class="form-label">Govt Fee / Challan (₹)</label>
            <input type="number" id="srv-gov-fee" class="form-control font-mono" value="${srv.govFee}" oninput="window.MJK.calculateServiceTotals()">
          </div>
          <div class="form-group">
            <label class="form-label">Other Charges (₹)</label>
            <input type="number" id="srv-other" class="form-control font-mono" value="${srv.otherCharges}" oninput="window.MJK.calculateServiceTotals()">
          </div>
          <div class="form-group">
            <label class="form-label">Paid / Advance (₹)</label>
            <input type="number" id="srv-advance" class="form-control font-mono" value="${srv.paidAmount ?? srv.advancePayment ?? 0}" oninput="window.MJK.calculateServiceTotals()">
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem; padding:0.6rem 0.85rem; background:var(--blue-50); border-radius:var(--radius-md);">
          <div>
            <div><strong>Calculated Total:</strong> <span id="srv-display-total" class="tabular-nums font-mono">₹0</span></div>
            <div id="srv-display-total-words" style="font-size:0.72rem; color:var(--text-muted); margin-top:0.15rem;">Zero Rupees Only</div>
          </div>
          <div style="text-align:right;">
            <div style="color:var(--danger);"><strong>Balance Due:</strong> <span id="srv-display-due" class="tabular-nums font-mono">₹0</span></div>
            <div id="srv-display-paid-words" style="font-size:0.72rem; color:var(--success); margin-top:0.15rem;">Paid: Zero Rupees Only</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Required Documents / Remarks</label>
          <input type="text" id="srv-docs" class="form-control" value="${escHtml(srv.requiredDocs || '')}" placeholder="e.g. Aadhaar copy, 2 passport photos, marksheet">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Update Service</button>
        </div>
      </form>
    ` : `
      <form id="service-form" class="checkout-flow" onsubmit="window.MJK.handleSaveService(event, '')">
        <input type="hidden" id="srv-edit-id" value="">
        <input type="hidden" id="srv-cust-mode" value="existing">

        <!-- Shared Receipt Summary Bar -->
        <div class="checkout-meta-bar">
          <div class="checkout-meta-items">
            <span>Receipt ID: <strong id="srv-receipt-id-display" class="font-mono">${escHtml(AppState.serviceModalReceiptId)}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Date: <strong>${formatDate(getTodayDate())}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Mode: <strong id="srv-receipt-mode-badge">Single Receipt Batch</strong></span>
          </div>
          <button type="button" class="btn btn-outline btn-sm" style="font-size:0.74rem;" onclick="window.MJK.openCustomServiceModal(true)">
            ✨ + Create Custom Service
          </button>
        </div>

        <!-- Step 01: Customer Selection OR Combined New Customer Registration -->
        <div class="checkout-step-card">
          <div class="checkout-step-header">
            <div class="checkout-step-title-wrap">
              <span class="checkout-step-num">01</span>
              <div>
                <h4 class="checkout-step-title">Customer &amp; Contact</h4>
                <p class="checkout-step-sub">Select an existing customer or register a new profile with this receipt</p>
              </div>
            </div>
            <div style="display:inline-flex; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:2px; gap:2px;">
              <button type="button" id="srv-mode-btn-existing" class="btn btn-primary btn-sm" style="font-size:0.74rem; padding:0.25rem 0.65rem;" onclick="window.MJK.setServiceCustomerMode('existing')">
                Existing Customer
              </button>
              <button type="button" id="srv-mode-btn-new" class="btn btn-secondary btn-sm" style="font-size:0.74rem; padding:0.25rem 0.65rem;" onclick="window.MJK.setServiceCustomerMode('new')">
                + Register New Customer
              </button>
            </div>
          </div>

          <!-- Existing Customer Panel -->
          <div id="srv-existing-cust-panel">
            <div class="checkout-grid-2">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Select Customer <span class="req">*</span></label>
                <select id="srv-cust-id" class="form-control" required onchange="window.MJK.handleCustomerSelectInService(this.value)">
                  <option value="">-- Choose Existing Customer --</option>
                  ${customers.map(c => `
                    <option value="${c.id}" ${activeCustId === c.id ? 'selected' : ''}>${c.name} (${c.phone}) - ${c.village || 'Mamudpur'}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Customer Mobile (WhatsApp Connect)</label>
                <div style="display:flex; gap:0.4rem; align-items:center;">
                  <input type="tel" id="srv-phone" class="form-control font-mono tabular-nums" value="" placeholder="Enter or select customer mobile">
                  <button type="button" class="btn btn-sm" style="background:#16a34a; color:#fff; font-weight:700; white-space:nowrap;" onclick="window.MJK.openServiceModalWhatsApp()">💬 WhatsApp</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Inline New Customer Registration Panel -->
          <div id="srv-newcust-panel" style="display:none;">
            <div class="checkout-grid-2" style="margin-bottom:0.75rem;">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Full Name <span class="req">*</span></label>
                <input type="text" id="srv-newcust-name" class="form-control" placeholder="Enter customer full name">
              </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label">Mobile Number <span class="req">*</span></label>
                    <div style="display:flex; gap:0.4rem; align-items:center;">
                      <input type="tel" id="srv-newcust-phone" class="form-control font-mono tabular-nums" placeholder="10-digit mobile number" oninput="const p=document.getElementById('srv-phone'); if(p) p.value=this.value; window.MJK.refreshServiceModalMergeState();" onblur="window.MJK.checkDuplicatePhoneFieldInService(this.value)">
                      <button type="button" class="btn btn-sm" style="background:#16a34a; color:#fff; font-weight:700; white-space:nowrap;" onclick="window.MJK.openServiceModalWhatsApp()">💬</button>
                    </div>
                    <div id="srv-newcust-dup-warn" style="font-size:0.73rem; color:var(--danger); margin-top:0.2rem; display:none;"></div>
                  </div>
              <div class="form-group" style="margin-bottom:0; grid-column: 1 / -1;">
                <label class="form-label">Father's / Guardian Name</label>
                <input type="text" id="srv-newcust-father" class="form-control" placeholder="Enter father / guardian name">
              </div>
            </div>

            ${renderLocationCascadeHtml('srvcust-loc', {
              required: false,
              checkoutMode: true,
              checkoutSlotHtml: newCustAadhaarSlot
            })}

            <div class="checkout-accordion" style="margin-top:0.75rem;">
              <button type="button" class="checkout-accordion-trigger" aria-expanded="false" onclick="const body=this.nextElementSibling; const open=body.style.display!=='none'; body.style.display=open?'none':'block'; this.setAttribute('aria-expanded', String(!open)); this.querySelector('.acc-icon').textContent=open?'+':'−';">
                <span><strong class="acc-icon" style="margin-right:0.35rem;">+</strong>Add Optional Details</span>
                <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">Alt Mobile · Address · Job Card · Email · Remarks</span>
              </button>
              <div class="checkout-accordion-body" style="display:none;">
                <div class="checkout-grid-2">
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label">Alternative Mobile</label>
                    <input type="tel" id="srv-newcust-altphone" class="form-control font-mono tabular-nums" placeholder="Alternate mobile number">
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label">Job Card</label>
                    <input type="text" id="srv-newcust-jobcard" class="form-control" value="" autocomplete="off">
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label">Email</label>
                    <input type="email" id="srv-newcust-email" class="form-control" value="" autocomplete="off">
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label">House / Para / Landmark (Optional)</label>
                    <input type="text" id="srv-newcust-address" class="form-control" placeholder="Optional landmark (auto-compiled above)">
                  </div>
                  <div class="form-group" style="margin-bottom:0; grid-column: 1 / -1;">
                    <label class="form-label">Remarks</label>
                    <textarea id="srv-newcust-remarks" class="form-control" rows="2"></textarea>
                  </div>
                </div>
                <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.75rem; color:var(--violet-600, #6d28d9); font-weight:700; cursor:pointer; margin-top:0.65rem;">
                  <input type="checkbox" id="srv-newcust-90day" checked>
                  Auto-sync 90-Day Follow-up Schedule
                </label>
              </div>
            </div>
          </div>

          <div id="srv-merge-banner" style="display:none; margin-top:0.75rem; padding:0.7rem 0.85rem; background:var(--blue-50, #eff6ff); border:1px solid var(--blue-200, #bfdbfe); border-radius:var(--radius-md); font-size:0.79rem;"></div>
        </div>

        <!-- Step 02: Add Services to Receipt -->
        <div class="checkout-step-card">
          <div class="checkout-step-header">
            <div class="checkout-step-title-wrap">
              <span class="checkout-step-num">02</span>
              <div>
                <h4 class="checkout-step-title">Add Services to Receipt</h4>
                <p class="checkout-step-sub">Search English/Bengali services or pick from Rate Chart to add instantly with live fee calculation</p>
              </div>
            </div>
            <span id="srv-cart-count-badge" class="tabular-nums" style="font-size:0.78rem; font-weight:700; color:var(--blue-600);">0 services added</span>
          </div>

          ${renderSearchableServiceSelectorHtml('srv-rate-search', {
            label: 'Search Service / Scheme (English or Bengali — Live Rate Chart)',
            placeholder: 'Type service name (e.g. PAN, Caste, Aadhaar, লক্ষ্মীর ভাণ্ডার) to add to receipt...',
            singleSelect: true,
            showBilling: false
          })}

          <div class="form-group" style="margin-bottom:0.65rem;">
            <label class="form-label" style="font-size:0.75rem; color:var(--text-muted);">Or Quick Browse Full Catalog / Inventory Accessories</label>
            <select id="srv-auto-picker" class="form-control" onchange="window.MJK.handleAutoServiceSelect(this.value, this)" style="font-weight:600;">
              <option value="">-- Select a Service or Gas Stock Item to Add --</option>
              ${renderServiceSelectOptions('')}
            </select>
          </div>

          <div id="srv-auto-mapped-badge" style="display:none; margin-bottom:0.6rem; padding:0.45rem 0.7rem; background:#ecfdf5; border:1px solid #10b981; border-radius:6px; color:#065f46; font-size:0.76rem;"></div>
          <div id="srv-duplicate-warning" style="display:none; margin-bottom:0.6rem; padding:0.5rem 0.75rem; background:#fef2f2; border:1px solid #ef4444; border-radius:6px; color:#991b1b; font-size:0.78rem;"></div>

          <!-- Selected Services Cart -->
          <div id="srv-cart-container" class="srv-cart-list"></div>

          <!-- Manual / Custom Service Builder -->
          <div class="checkout-accordion" style="margin-top:0.75rem;">
            <button type="button" class="checkout-accordion-trigger" aria-expanded="false" onclick="const body=this.nextElementSibling; const open=body.style.display!=='none'; body.style.display=open?'none':'block'; this.setAttribute('aria-expanded', String(!open)); this.querySelector('.acc-icon').textContent=open?'+':'−';">
              <span><strong class="acc-icon" style="margin-right:0.35rem;">+</strong> Add Manual / Custom Service Item</span>
              <span style="font-size:0.72rem; color:var(--text-muted);">Category · Rate · Ref</span>
            </button>
            <div class="checkout-accordion-body" style="display:none;">
              <div class="checkout-grid-2">
                <div class="form-group" style="margin-bottom:0;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                    <label class="form-label" style="margin:0;">Main Category</label>
                    <button type="button" class="btn btn-outline btn-sm" style="padding:0.1rem 0.4rem; font-size:0.68rem;" onclick="window.MJK.openManageDynamicOptionsModal('service_category', 'srv-cat')" title="Manage Custom Categories">+</button>
                  </div>
                  <select id="srv-cat" class="form-control" onchange="const nw=document.getElementById('srv-new-cat-wrap'); if(this.value==='__NEW_CATEGORY__'){if(nw)nw.style.display='block';}else{if(nw)nw.style.display='none'; window.MJK.handleServiceCategoryChange(this.value);}">
                    ${serviceCategories.map(c => `<option value="${c}" ${initialCat === c ? 'selected' : ''}>${c}</option>`).join('')}
                    <option value="__NEW_CATEGORY__">+ Add New Custom Category...</option>
                  </select>
                  <div id="srv-new-cat-wrap" style="display:none; margin-top:0.4rem;">
                    <input type="text" id="srv-new-cat" class="form-control" placeholder="Enter new custom category name...">
                  </div>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Subcategory</label>
                  <select id="srv-subcat" class="form-control" onchange="window.MJK.handleSubcategoryChange(this.value)">
                    <option value="">-- Choose Subcategory --</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Service Title</label>
                  <input type="text" id="srv-name" class="form-control" value="${escHtml(initialSubcat || '')}" placeholder="e.g. Custom Application, Printout..." oninput="window.MJK.checkServiceModalDuplicate()">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Ref Number</label>
                  <input type="text" id="srv-ref" class="form-control font-mono" value="" placeholder="Auto Global SL if blank">
                </div>
              </div>

              <div class="form-row" style="margin-top:0.65rem; margin-bottom:0.65rem;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Delivery Date</label>
                  <input type="date" id="srv-delivery-date" class="form-control" value="${getTodayDate()}">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Shop Charge (₹)</label>
                  <input type="number" id="srv-charge" class="form-control font-mono" min="0" value="50" oninput="window.MJK.calculateServiceTotals()">
                  <div id="srv-charge-words" class="amount-words-hint"></div>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Govt Fee (₹)</label>
                  <input type="number" id="srv-gov-fee" class="form-control font-mono" min="0" value="0" oninput="window.MJK.calculateServiceTotals()">
                  <div id="srv-gov-fee-words" class="amount-words-hint"></div>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Other (₹)</label>
                  <input type="number" id="srv-other" class="form-control font-mono" min="0" value="0" oninput="window.MJK.calculateServiceTotals()">
                  <div id="srv-other-words" class="amount-words-hint"></div>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:0.6rem;">
                <label class="form-label">Required Documents / Remarks</label>
                <input type="text" id="srv-docs" class="form-control" value="" placeholder="e.g. Aadhaar copy, 2 passport photos">
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.76rem; cursor:pointer; color:var(--text-main);">
                  <input type="checkbox" id="srv-save-custom">
                  <span>Save custom service &amp; rate to Catalog</span>
                </label>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.addManualServiceToCart()">+ Add to Receipt</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 03: Single Receipt Billing & Collective Status -->
        <div class="srv-billing-summary">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.65rem;">
            <div>
              <strong style="font-size:0.9rem;">Single Receipt Billing Summary</strong>
              <div style="font-size:0.74rem; color:var(--text-muted);" id="srv-billing-breakdown">Add services above to calculate combined bill</div>
              <div style="font-size:0.74rem; color:var(--blue-700, #1d4ed8); font-weight:600; display:none; margin-top:0.15rem;" id="srv-consolidated-summary"></div>
            </div>
            <div style="text-align:right;">
              <div id="srv-display-total-label" style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase;">Grand Total</div>
              <div id="srv-display-total" class="tabular-nums font-mono" style="font-size:1.25rem; font-weight:800; color:var(--blue-600);">₹0</div>
              <div id="srv-display-total-words" style="font-size:0.7rem; color:var(--text-muted); max-width:260px;">Zero Rupees Only</div>
            </div>
          </div>

          <div class="form-row" style="margin-bottom:0;">
            <div class="form-group" style="margin-bottom:0;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <label class="form-label" style="margin:0;">Collective Receipt Status</label>
                <button type="button" class="btn btn-outline btn-sm" style="padding:0.1rem 0.4rem; font-size:0.68rem;" onclick="window.MJK.openManageDynamicOptionsModal('service_status', 'srv-collective-status')" title="Manage Custom Statuses">+</button>
              </div>
              <select id="srv-collective-status" class="form-control">
                ${serviceStatuses.map(st => `<option value="${escHtml(st)}" ${st === 'New' ? 'selected' : ''}>${escHtml(st)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label id="srv-advance-label" class="form-label">Total Paid / Advance Now (₹)</label>
              <div style="display:flex; gap:0.4rem; align-items:center;">
                <input type="number" id="srv-advance" class="form-control font-mono tabular-nums" min="0" value="0" oninput="window.MJK.calculateServiceTotals()">
                <button type="button" id="srv-full-paid-btn" class="btn btn-outline btn-sm" style="white-space:nowrap;" onclick="window.MJK.setServiceCartFullPaid()">Full Paid</button>
              </div>
              <div id="srv-display-paid-words" style="font-size:0.69rem; color:var(--success); margin-top:0.2rem;">Paid: Zero Rupees Only</div>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Payment Mode &amp; Balance Due</label>
              <div style="display:flex; gap:0.5rem; align-items:center;">
                <select id="srv-pay-mode" class="form-control" style="flex:1;">
                  <option value="Cash">Cash</option>
                  <option value="UPI / QR">UPI / QR</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                </select>
                <div style="min-width:110px; text-align:right;">
                  <span style="font-size:0.72rem; color:var(--text-muted); display:block;">Balance Due</span>
                  <strong id="srv-display-due" class="tabular-nums font-mono" style="color:var(--danger); font-size:0.95rem;">₹0</strong>
                  <div id="srv-display-due-words" style="font-size:0.67rem; color:var(--text-muted); font-weight:600; max-width:210px; margin-left:auto;"></div>
                </div>
              </div>
            </div>
          </div>

          <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.78rem; margin-top:0.75rem; cursor:pointer; color:var(--text-main);">
            <input type="checkbox" id="srv-auto-print" checked>
            <span>Open unified printable receipt right after saving</span>
          </label>
        </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.25rem; flex-wrap:wrap; gap:0.5rem;">
          <button type="button" id="srv-view-catalog-btn" class="btn btn-outline btn-sm" onclick="window.MJK.openCategoryCatalogModal()">📋 View Directory (${serviceCategories.length})</button>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; flex:1; justify-content:flex-end;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" id="srv-submit-btn" class="btn btn-primary" style="min-width:210px; font-weight:700;">Submit &amp; Generate Single Receipt</button>
          </div>
        </div>
      </form>
    `;

    openModal(isEditMode ? 'Edit Service Record' : 'New Service Entry (Single Receipt)', content, null, 'modal-lg');
    setTimeout(() => {
      if (activeCustId) {
        window.MJK.handleCustomerSelectInService(activeCustId);
      }

      if (isEditMode) {
        if (selectedSrvName) {
          const badge = document.getElementById('srv-auto-mapped-badge');
          if (badge) badge.style.display = 'none';
        }
        window.MJK.handleServiceCategoryChange(srv.category, srv.subcategory || '');
        window.MJK.calculateServiceTotals();
        initSearchableServiceSelector('srv-rate-search', {
          singleSelect: true,
          showBilling: false,
          onSelectItem: (picked) => {
            if (!picked) return;
            window.MJK.handleAutoServiceSelect(picked.name);
          }
        });
      } else {
        initLocationCascade('srvcust-loc', { state: 'West Bengal', district: 'Murshidabad' });
        window.MJK.handleServiceCategoryChange(initialCat, initialSubcat);
        initSearchableServiceSelector('srv-rate-search', {
          singleSelect: true,
          showBilling: false,
          onSelectItem: (picked) => {
            if (!picked) return;
            window.MJK.addServiceToCart(picked.name, picked.category, picked.id);
          }
        });
        if (selectedSrvName) {
          window.MJK.addServiceToCart(selectedSrvName, defaultCat || '', presetRateId || '');
        } else {
          window.MJK.renderServiceCartList();
          window.MJK.calculateServiceTotals();
        }
      }
    }, 60);
  },

  setServiceCustomerMode: (mode = 'existing') => {
    const modeInput = document.getElementById('srv-cust-mode');
    const existingPanel = document.getElementById('srv-existing-cust-panel');
    const newPanel = document.getElementById('srv-newcust-panel');
    const btnExisting = document.getElementById('srv-mode-btn-existing');
    const btnNew = document.getElementById('srv-mode-btn-new');
    const custSelect = document.getElementById('srv-cust-id');
    const newName = document.getElementById('srv-newcust-name');
    const newPhone = document.getElementById('srv-newcust-phone');
    const submitBtn = document.getElementById('srv-submit-btn');

    const isNew = mode === 'new';
    if (modeInput) modeInput.value = isNew ? 'new' : 'existing';
    if (existingPanel) existingPanel.style.display = isNew ? 'none' : 'block';
    if (newPanel) newPanel.style.display = isNew ? 'block' : 'none';

    if (btnExisting) btnExisting.className = isNew ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm';
    if (btnNew) btnNew.className = isNew ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';

    if (custSelect) custSelect.required = !isNew;
    if (newName) newName.required = isNew;
    if (newPhone) newPhone.required = isNew;

    if (submitBtn) {
      const mergeTarget = AppState.serviceModalMergeTarget;
      submitBtn.textContent = mergeTarget
        ? (isNew ? `Register & Merge into ${mergeTarget.receiptId}` : `Append & Merge into ${mergeTarget.receiptId}`)
        : (isNew ? 'Register Customer & Generate Receipt' : 'Submit & Generate Single Receipt');
    }
    window.MJK.refreshServiceModalMergeState();
    window.MJK.checkServiceModalDuplicate();
  },

  refreshServiceModalMergeState: () => {
    const editId = document.getElementById('srv-edit-id')?.value;
    if (editId) return;

    const custMode = document.getElementById('srv-cust-mode')?.value || 'existing';
    const custId = custMode === 'new' ? '' : (document.getElementById('srv-cust-id')?.value || '');
    const custObj = custId ? getCustomerById(custId) : null;
    const rawPhone = custMode === 'new'
      ? (document.getElementById('srv-newcust-phone')?.value || '')
      : (custObj?.phone || document.getElementById('srv-phone')?.value || '');

    const existingOpen = findOpenReceiptForCustomerDate(custId, rawPhone, getTodayDate());
    AppState.serviceModalMergeTarget = existingOpen || null;

    const receiptDisplay = document.getElementById('srv-receipt-id-display');
    const modeBadge = document.getElementById('srv-receipt-mode-badge');
    const banner = document.getElementById('srv-merge-banner');
    const submitBtn = document.getElementById('srv-submit-btn');
    const advLabel = document.getElementById('srv-advance-label');
    const fullBtn = document.getElementById('srv-full-paid-btn');

    if (existingOpen) {
      if (receiptDisplay) receiptDisplay.textContent = existingOpen.receiptId;
      if (modeBadge) {
        modeBadge.textContent = 'Auto-Merge into Open Bill';
        modeBadge.style.color = 'var(--blue-600)';
      }
      if (advLabel) advLabel.textContent = 'Payment Collected Now (₹)';
      if (fullBtn) fullBtn.textContent = 'Settle Full Bill';
      if (banner) {
        banner.style.display = 'block';
        banner.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.35rem; margin-bottom:0.25rem;">
            <strong style="color:var(--blue-700, #1d4ed8);">
              Existing Active Receipt Found Today · <span class="font-mono">${escHtml(existingOpen.receiptId)}</span>
            </strong>
            <span class="font-mono tabular-nums" style="font-size:0.74rem; color:var(--text-muted);">${existingOpen.itemCount} existing item${existingOpen.itemCount > 1 ? 's' : ''}</span>
          </div>
          <div style="color:var(--text-main);">
            Previous Bill Total: <strong class="font-mono tabular-nums">${formatINR(existingOpen.grandTotal)}</strong> ·
            Already Paid: <strong class="font-mono tabular-nums" style="color:var(--success);">${formatINR(existingOpen.totalPaid)}</strong> ·
            Previous Due: <strong class="font-mono tabular-nums" style="color:${existingOpen.totalDue > 0 ? 'var(--danger)' : 'var(--success)'};">${formatINR(existingOpen.totalDue)}</strong>
          </div>
          <div style="font-size:0.73rem; color:var(--text-muted); margin-top:0.2rem;">
            New services or gas accessories added here will automatically append to <strong>${escHtml(existingOpen.receiptId)}</strong> and recalculate the consolidated bill.
          </div>
        `;
      }
      if (submitBtn) {
        submitBtn.textContent = custMode === 'new'
          ? `Register & Merge into ${existingOpen.receiptId}`
          : `Append & Merge into ${existingOpen.receiptId}`;
      }
    } else {
      const baseId = AppState.serviceModalReceiptId || previewNextGlobalReference('RCPT');
      if (receiptDisplay) receiptDisplay.textContent = baseId;
      if (modeBadge) {
        modeBadge.textContent = 'Single Receipt Batch';
        modeBadge.style.color = '';
      }
      if (advLabel) advLabel.textContent = 'Total Paid / Advance Now (₹)';
      if (fullBtn) fullBtn.textContent = 'Full Paid';
      if (banner) {
        banner.style.display = 'none';
        banner.innerHTML = '';
      }
      if (submitBtn) {
        submitBtn.textContent = custMode === 'new'
          ? 'Register Customer & Generate Receipt'
          : 'Submit & Generate Single Receipt';
      }
    }

    window.MJK.calculateServiceTotals();
  },

  checkDuplicatePhoneFieldInService: (phone) => {
    const dup = checkDuplicatePhone(phone, '');
    const warn = document.getElementById('srv-newcust-dup-warn');
    if (dup && warn) {
      warn.textContent = `⚠ Existing customer found: "${dup.name}" (${dup.id})`;
      warn.style.display = 'block';
    } else if (warn) {
      warn.style.display = 'none';
    }
    window.MJK.refreshServiceModalMergeState();
  },

  addServiceToCart: (serviceName, preferredCategory = '', preferredRateId = '') => {
    if (!serviceName && !preferredRateId) return;
    const mapping = autoMapService(serviceName, preferredCategory, preferredRateId);
    if (!mapping) return;
    const rateItem =
      (preferredRateId ? getRateChartItemById(preferredRateId) : null) ||
      (mapping.rateId ? getRateChartItemById(mapping.rateId) : null) ||
      getRateForService(mapping.name, mapping.category, mapping.subcategory);
    const shopCharge = rateItem ? (Number(rateItem.serviceCharge) || 0) : (Number(mapping.defaultCharge) || 0);
    const govFee = rateItem ? (Number(rateItem.govFee) || 0) : (Number(mapping.defaultGovFee) || 0);
    AppState.serviceModalCart = AppState.serviceModalCart || [];
    AppState.serviceModalCart.push({
      uid: `cart-${_srvCartUidSeq++}`,
      serviceName: mapping.name,
      category: mapping.category,
      subcategory: mapping.subcategory,
      refNumber: '',
      deliveryDate: getTodayDate(),
      serviceCharge: shopCharge,
      govFee,
      otherCharges: 0,
      requiredDocs: '',
      masterRegisterTarget: mapping.masterRegisterTarget,
      isGovtScheme: !!mapping.isGovtScheme,
      isGrievance: !!mapping.isGrievance
    });

    const badge = document.getElementById('srv-auto-mapped-badge');
    if (badge) {
      badge.style.display = 'block';
      badge.innerHTML = `<strong>✓ Added:</strong> ${escHtml(mapping.name)} (${escHtml(mapping.category)} ➔ ${escHtml(mapping.subcategory)})`;
    }

    const advEl = document.getElementById('srv-advance');
    if (advEl) {
      const grandTotal = AppState.serviceModalCart.reduce((sum, it) => sum + (Number(it.serviceCharge) || 0) + (Number(it.govFee) || 0) + (Number(it.otherCharges) || 0), 0);
      advEl.value = grandTotal;
    }

    window.MJK.renderServiceCartList();
    window.MJK.calculateServiceTotals();
    window.MJK.checkServiceModalDuplicate();
  },

  addManualServiceToCart: () => {
    const rawCat = document.getElementById('srv-cat')?.value || 'Other Services';
    const newCatName = document.getElementById('srv-new-cat')?.value?.trim() || '';
    const category = rawCat === '__NEW_CATEGORY__' ? (newCatName || 'Other Services') : rawCat;
    const subcategory = document.getElementById('srv-subcat')?.value || '';
    const nameInput = document.getElementById('srv-name')?.value?.trim() || '';
    const serviceName = nameInput || subcategory || category;
    if (!serviceName) {
      showToast('Please enter a service title before adding.', 'warning');
      return;
    }

    const serviceCharge = Math.max(0, Number(document.getElementById('srv-charge')?.value) || 0);
    const govFee = Math.max(0, Number(document.getElementById('srv-gov-fee')?.value) || 0);
    const otherCharges = Math.max(0, Number(document.getElementById('srv-other')?.value) || 0);
    const refNumber = document.getElementById('srv-ref')?.value?.trim() || '';
    const deliveryDate = document.getElementById('srv-delivery-date')?.value || getTodayDate();
    const requiredDocs = document.getElementById('srv-docs')?.value?.trim() || '';
    const saveAsCustom = document.getElementById('srv-save-custom')?.checked || rawCat === '__NEW_CATEGORY__';

    AppState.serviceModalCart = AppState.serviceModalCart || [];
    AppState.serviceModalCart.push({
      uid: `cart-${_srvCartUidSeq++}`,
      serviceName,
      category,
      subcategory: subcategory || serviceName,
      refNumber,
      deliveryDate,
      serviceCharge,
      govFee,
      otherCharges,
      requiredDocs,
      saveAsCustom
    });

    const advEl = document.getElementById('srv-advance');
    if (advEl) {
      const grandTotal = AppState.serviceModalCart.reduce((sum, it) => sum + (Number(it.serviceCharge) || 0) + (Number(it.govFee) || 0) + (Number(it.otherCharges) || 0), 0);
      advEl.value = grandTotal;
    }

    const nameEl = document.getElementById('srv-name');
    const docsEl = document.getElementById('srv-docs');
    const refEl = document.getElementById('srv-ref');
    if (nameEl) nameEl.value = '';
    if (docsEl) docsEl.value = '';
    if (refEl) refEl.value = '';

    window.MJK.renderServiceCartList();
    window.MJK.calculateServiceTotals();
    window.MJK.checkServiceModalDuplicate();
    showToast(`Added "${serviceName}" to receipt`, 'success');
  },

  updateServiceCartItem: (index, field, value) => {
    const cart = AppState.serviceModalCart || [];
    if (!cart[index]) return;
    if (['serviceCharge', 'govFee', 'otherCharges'].includes(field)) {
      cart[index][field] = Math.max(0, Number(value) || 0);
      const subEl = document.getElementById(`srv-cart-sub-${index}`);
      if (subEl) {
        const subTotal = (Number(cart[index].serviceCharge) || 0) + (Number(cart[index].govFee) || 0) + (Number(cart[index].otherCharges) || 0);
        subEl.textContent = formatINR(subTotal);
      }
      window.MJK.calculateServiceTotals();
    } else {
      cart[index][field] = value;
    }
  },

  removeServiceCartItem: (index) => {
    const cart = AppState.serviceModalCart || [];
    cart.splice(index, 1);
    const advEl = document.getElementById('srv-advance');
    if (advEl) {
      const grandTotal = cart.reduce((sum, it) => sum + (Number(it.serviceCharge) || 0) + (Number(it.govFee) || 0) + (Number(it.otherCharges) || 0), 0);
      advEl.value = grandTotal;
    }
    window.MJK.renderServiceCartList();
    window.MJK.calculateServiceTotals();
    window.MJK.checkServiceModalDuplicate();
  },

  setServiceCartFullPaid: () => {
    const cart = AppState.serviceModalCart || [];
    let newItemsTotal = 0;
    if (cart.length > 0) {
      newItemsTotal = cart.reduce((sum, it) => sum + (Number(it.serviceCharge) || 0) + (Number(it.govFee) || 0) + (Number(it.otherCharges) || 0), 0);
    } else {
      newItemsTotal = (Number(document.getElementById('srv-charge')?.value) || 0) +
        (Number(document.getElementById('srv-gov-fee')?.value) || 0) +
        (Number(document.getElementById('srv-other')?.value) || 0);
    }
    const mergeTarget = AppState.serviceModalMergeTarget;
    const targetAdvance = mergeTarget ? (mergeTarget.totalDue + newItemsTotal) : newItemsTotal;
    const advEl = document.getElementById('srv-advance');
    if (advEl) advEl.value = targetAdvance;
    window.MJK.calculateServiceTotals();
  },

  renderServiceCartList: () => {
    const container = document.getElementById('srv-cart-container');
    const countBadge = document.getElementById('srv-cart-count-badge');
    const cart = AppState.serviceModalCart || [];
    if (countBadge) {
      countBadge.textContent = `${cart.length} ${cart.length === 1 ? 'service' : 'services'} added`;
    }
    if (!container) return;
    if (cart.length === 0) {
      container.innerHTML = `
        <div style="padding:0.85rem; text-align:center; border:1px dashed var(--border-subtle); border-radius:var(--radius-md); color:var(--text-muted); font-size:0.79rem;">
          No services in receipt yet. Select services from the Smart Auto-Mapper above to add multiple services together.
        </div>
      `;
      return;
    }

    container.innerHTML = cart.map((item, idx) => {
      const itemTotal = (Number(item.serviceCharge) || 0) + (Number(item.govFee) || 0) + (Number(item.otherCharges) || 0);
      return `
        <div class="srv-cart-item">
          <div class="srv-cart-item-head">
            <div>
              <div style="font-weight:700; font-size:0.86rem; color:var(--text-main);">
                <span class="font-mono tabular-nums" style="color:var(--text-muted); margin-right:0.3rem;">#${idx + 1}</span>
                ${escHtml(item.serviceName)}
              </div>
              <div style="font-size:0.72rem; color:var(--text-muted);">
                ${escHtml(item.category)}${item.subcategory ? ` · ${escHtml(item.subcategory)}` : ''}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:0.5rem;">
                <strong id="srv-cart-sub-${idx}" class="tabular-nums font-mono" style="color:var(--blue-600); font-size:0.88rem;">${formatINR(itemTotal)}</strong>
                <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border); padding:0.15rem 0.45rem; font-size:0.72rem;" onclick="window.MJK.removeServiceCartItem(${idx})" title="Remove service">✕</button>
              </div>
              <div id="srv-cart-sub-words-${idx}" style="font-size:0.66rem; color:var(--text-muted); font-weight:600; margin-top:2px;">${escHtml(numberToWords(itemTotal))}</div>
            </div>
          </div>
          <div class="srv-cart-item-grid">
            <div>
              <label class="form-label" style="font-size:0.7rem;">Ref Number</label>
              <input type="text" class="form-control font-mono" style="height:32px; font-size:0.75rem; padding:0.2rem 0.45rem;" value="${escHtml(item.refNumber)}" oninput="window.MJK.updateServiceCartItem(${idx}, 'refNumber', this.value)">
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Delivery Date</label>
              <input type="date" class="form-control" style="height:32px; font-size:0.75rem; padding:0.2rem 0.45rem;" value="${escHtml(item.deliveryDate)}" onchange="window.MJK.updateServiceCartItem(${idx}, 'deliveryDate', this.value)">
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Shop Charge (₹)</label>
              <input type="number" min="0" class="form-control font-mono" style="height:32px; font-size:0.78rem; padding:0.2rem 0.45rem;" value="${Number(item.serviceCharge) || 0}" oninput="window.MJK.updateServiceCartItem(${idx}, 'serviceCharge', this.value)">
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Govt Fee (₹)</label>
              <input type="number" min="0" class="form-control font-mono" style="height:32px; font-size:0.78rem; padding:0.2rem 0.45rem;" value="${Number(item.govFee) || 0}" oninput="window.MJK.updateServiceCartItem(${idx}, 'govFee', this.value)">
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Other (₹)</label>
              <input type="number" min="0" class="form-control font-mono" style="height:32px; font-size:0.78rem; padding:0.2rem 0.45rem;" value="${Number(item.otherCharges) || 0}" oninput="window.MJK.updateServiceCartItem(${idx}, 'otherCharges', this.value)">
            </div>
            <div style="grid-column: 1 / -1;">
              <input type="text" class="form-control" style="height:30px; font-size:0.74rem; padding:0.2rem 0.5rem;" value="${escHtml(item.requiredDocs || '')}" placeholder="Documents / note for ${escHtml(item.serviceName)}..." oninput="window.MJK.updateServiceCartItem(${idx}, 'requiredDocs', this.value)">
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  handleAutoServiceSelect: (serviceName, selectEl = null) => {
    if (!serviceName) {
      const badge = document.getElementById('srv-auto-mapped-badge');
      if (badge) badge.style.display = 'none';
      return;
    }

    const selectedOpt = selectEl?.options?.[selectEl.selectedIndex];
    const optRateId = selectedOpt?.dataset?.rateId || '';
    const optCategory = selectedOpt?.dataset?.category || '';

    const editId = document.getElementById('srv-edit-id')?.value;
    if (!editId && String(serviceName).startsWith('__INV__')) {
      const invId = String(serviceName).slice('__INV__'.length);
      const invItem = getAllInventory().find(i => i.id === invId);
      if (invItem) {
        const unitPrice = Math.max(0, Number(invItem.sellingPrice) || 0);
        AppState.serviceModalCart = AppState.serviceModalCart || [];
        AppState.serviceModalCart.push({
          uid: `cart-${_srvCartUidSeq++}`,
          inventoryProductId: invItem.id,
          inventoryQty: 1,
          serviceName: invItem.name,
          category: invItem.category || 'Other Gas Accessories',
          subcategory: invItem.name,
          refNumber: '',
          deliveryDate: getTodayDate(),
          serviceCharge: unitPrice,
          govFee: 0,
          otherCharges: 0,
          requiredDocs: `Stock item · 1 ${invItem.unit || 'Pcs'} @ ${formatINR(unitPrice)}`
        });

        const badge = document.getElementById('srv-auto-mapped-badge');
        if (badge) {
          badge.style.display = 'block';
          badge.innerHTML = `<strong>✓ Added Accessory:</strong> ${escHtml(invItem.name)} (${escHtml(invItem.category || 'Gas Accessories')}) · ${formatINR(unitPrice)}`;
        }
        const advEl = document.getElementById('srv-advance');
        if (advEl) {
          advEl.value = AppState.serviceModalCart.reduce((sum, it) => sum + (Number(it.serviceCharge) || 0) + (Number(it.govFee) || 0) + (Number(it.otherCharges) || 0), 0);
        }
        window.MJK.renderServiceCartList();
        window.MJK.calculateServiceTotals();
      }
      const picker = document.getElementById('srv-auto-picker');
      if (picker) picker.value = '';
      return;
    }

    if (!editId) {
      window.MJK.addServiceToCart(serviceName, optCategory, optRateId);
      const picker = document.getElementById('srv-auto-picker');
      if (picker) picker.value = '';
      return;
    }

    const mapping = autoMapService(serviceName, optCategory, optRateId);
    if (!mapping) return;

    const catSelect = document.getElementById('srv-cat');
    if (catSelect) catSelect.value = mapping.category;

    window.MJK.handleServiceCategoryChange(mapping.category, mapping.subcategory);
    const subcatSelect = document.getElementById('srv-subcat');
    if (subcatSelect) subcatSelect.value = mapping.subcategory;

    const nameInput = document.getElementById('srv-name');
    if (nameInput) nameInput.value = mapping.name;

    const rateItem =
      (optRateId ? getRateChartItemById(optRateId) : null) ||
      (mapping.rateId ? getRateChartItemById(mapping.rateId) : null) ||
      getRateForService(mapping.name, mapping.category, mapping.subcategory);
    const shopCharge = rateItem ? (Number(rateItem.serviceCharge) || 0) : mapping.defaultCharge;
    const govFee = rateItem ? (Number(rateItem.govFee) || 0) : mapping.defaultGovFee;

    const chargeInput = document.getElementById('srv-charge');
    const govFeeInput = document.getElementById('srv-gov-fee');
    const advanceInput = document.getElementById('srv-advance');
    if (chargeInput) chargeInput.value = shopCharge;
    if (govFeeInput) govFeeInput.value = govFee;
    if (advanceInput) advanceInput.value = shopCharge + govFee;

    window.MJK.calculateServiceTotals();

    const badge = document.getElementById('srv-auto-mapped-badge');
    if (badge) {
      badge.style.display = 'block';
      badge.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.35rem;">
          <div>
            <strong>✓ Auto-Mapped:</strong> 
            <span style="color:#1d4ed8; font-weight:700;">${escHtml(mapping.category)}</span> ➔ 
            <span style="color:#047857; font-weight:700;">${escHtml(mapping.subcategory)}</span>
          </div>
          <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-size:0.72rem; font-weight:700;">
            Target: ${escHtml(mapping.masterRegisterTarget)}
          </span>
        </div>
      `;
    }

    window.MJK.checkServiceModalDuplicate();
  },

  checkServiceModalDuplicate: () => {
    const custMode = document.getElementById('srv-cust-mode')?.value || 'existing';
    const custId = custMode === 'new' ? '' : (document.getElementById('srv-cust-id')?.value || '');
    const editId = document.getElementById('srv-edit-id')?.value;
    const warnBox = document.getElementById('srv-duplicate-warning');
    if (!warnBox) return;

    if (!custId) {
      warnBox.style.display = 'none';
      warnBox.innerHTML = '';
      return;
    }

    const cart = !editId ? (AppState.serviceModalCart || []) : [];
    const namesToCheck = cart.length > 0
      ? cart.map(it => it.serviceName).filter(Boolean)
      : [document.getElementById('srv-name')?.value || document.getElementById('srv-auto-picker')?.value].filter(Boolean);

    const dups = [];
    namesToCheck.forEach(nm => {
      const dup = checkDuplicateServiceEntry(custId, nm, editId || null);
      if (dup.isDuplicate) dups.push(dup.message);
    });

    if (dups.length > 0) {
      const wasChecked = document.getElementById('srv-allow-dup')?.checked;
      warnBox.style.display = 'block';
      warnBox.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:0.5rem;">
          <span style="font-size:1.1rem; line-height:1;">⚠️</span>
          <div>
            <strong>Duplicate Notice:</strong><br/>
            <span>${dups.map(d => escHtml(d)).join('<br/>')}</span>
            <label style="display:flex; align-items:center; gap:0.4rem; margin-top:0.35rem; font-size:0.78rem; font-weight:700; cursor:pointer;">
              <input type="checkbox" id="srv-allow-dup" ${wasChecked ? 'checked' : ''}>
              <span>Allow duplicate service registration anyway</span>
            </label>
          </div>
        </div>
      `;
    } else {
      warnBox.style.display = 'none';
      warnBox.innerHTML = '';
    }
  },

  handleServiceCategoryChange: (cat, selectedSub = '') => {
    const subcats = getSubcategoriesForCategory(cat);
    const subSelect = document.getElementById('srv-subcat');
    if (!subSelect) return;

    const rateBySub = new Map(
      getAllRateChartItems()
        .filter(x => x.isActive !== false && x.category.toLowerCase() === String(cat || '').toLowerCase())
        .map(x => [x.serviceName.toLowerCase(), x])
    );

    subSelect.innerHTML = `
      <option value="">-- Choose Subcategory / Service (${subcats.length}) --</option>
      ${subcats.map(s => {
        const rm = rateBySub.get(s.toLowerCase());
        const total = rm ? ((Number(rm.serviceCharge) || 0) + (Number(rm.govFee) || 0)) : null;
        return `<option value="${escHtml(s)}" ${s === selectedSub ? 'selected' : ''}>${escHtml(s)}${total !== null ? ` (₹${total})` : ''}</option>`;
      }).join('')}
    `;

    if (selectedSub) {
      subSelect.value = selectedSub;
    }
  },

  handleSubcategoryChange: (sub) => {
    const nameInput = document.getElementById('srv-name');
    if (nameInput && sub) {
      nameInput.value = sub;
      const editId = document.getElementById('srv-edit-id')?.value;
      if (!editId) {
        const cat = document.getElementById('srv-cat')?.value || '';
        const rateItem = getRateForService(sub, cat, sub);
        if (rateItem) {
          const shopCharge = Number(rateItem.serviceCharge) || 0;
          const govFee = Number(rateItem.govFee) || 0;
          const chargeInput = document.getElementById('srv-charge');
          const govFeeInput = document.getElementById('srv-gov-fee');
          if (chargeInput) chargeInput.value = shopCharge;
          if (govFeeInput) govFeeInput.value = govFee;
          if ((AppState.serviceModalCart || []).length === 0) {
            const advanceInput = document.getElementById('srv-advance');
            if (advanceInput) advanceInput.value = shopCharge + govFee;
          }
          window.MJK.calculateServiceTotals();
        }
      }
      window.MJK.checkServiceModalDuplicate();
    }
  },

  handleCustomerSelectInService: (custId) => {
    const cust = getCustomerById(custId);
    const phoneInput = document.getElementById('srv-phone');
    if (cust && phoneInput) phoneInput.value = cust.phone;
    window.MJK.refreshServiceModalMergeState();
    window.MJK.checkServiceModalDuplicate();
  },

  calculateServiceTotals: () => {
    const editId = document.getElementById('srv-edit-id')?.value;
    const cart = !editId ? (AppState.serviceModalCart || []) : [];

    let shopSum = 0;
    let govSum = 0;
    let otherSum = 0;

    if (!editId && cart.length > 0) {
      cart.forEach(it => {
        shopSum += Number(it.serviceCharge) || 0;
        govSum += Number(it.govFee) || 0;
        otherSum += Number(it.otherCharges) || 0;
      });
    } else {
      shopSum = Number(document.getElementById('srv-charge')?.value) || 0;
      govSum = Number(document.getElementById('srv-gov-fee')?.value) || 0;
      otherSum = Number(document.getElementById('srv-other')?.value) || 0;
    }

    const chargeEl = document.getElementById('srv-charge');
    const govEl = document.getElementById('srv-gov-fee');
    const otherEl = document.getElementById('srv-other');
    const advEl = document.getElementById('srv-advance');
    if (chargeEl) syncAmountWords(chargeEl, 'srv-charge-words', { prefix: '' });
    if (govEl) syncAmountWords(govEl, 'srv-gov-fee-words', { prefix: '' });
    if (otherEl) syncAmountWords(otherEl, 'srv-other-words', { prefix: '' });

    cart.forEach((it, idx) => {
      const subWordsEl = document.getElementById(`srv-cart-sub-words-${idx}`);
      if (subWordsEl) {
        const sub = (Number(it.serviceCharge) || 0) + (Number(it.govFee) || 0) + (Number(it.otherCharges) || 0);
        subWordsEl.textContent = numberToWords(sub);
      }
    });

    const newTotal = shopSum + govSum + otherSum;
    const advanceNow = Math.max(0, Number(advEl?.value) || 0);
    const mergeTarget = !editId ? AppState.serviceModalMergeTarget : null;

    const consolidatedGrandTotal = mergeTarget ? (mergeTarget.grandTotal + newTotal) : newTotal;
    const consolidatedPaid = mergeTarget ? (mergeTarget.totalPaid + advanceNow) : advanceNow;
    const consolidatedDue = Math.max(0, consolidatedGrandTotal - consolidatedPaid);

    const totalLabel = document.getElementById('srv-display-total-label');
    const totalSpan = document.getElementById('srv-display-total');
    const totalWordsEl = document.getElementById('srv-display-total-words');
    const paidWordsEl = document.getElementById('srv-display-paid-words');
    const dueSpan = document.getElementById('srv-display-due');
    const dueWordsEl = document.getElementById('srv-display-due-words');
    const breakdown = document.getElementById('srv-billing-breakdown');
    const consolidatedEl = document.getElementById('srv-consolidated-summary');

    if (totalLabel) totalLabel.textContent = mergeTarget ? 'Consolidated Grand Total' : 'Grand Total';
    if (totalSpan) totalSpan.textContent = formatINR(consolidatedGrandTotal);
    if (totalWordsEl) totalWordsEl.textContent = numberToWords(consolidatedGrandTotal);
    if (paidWordsEl) {
      if (advEl && advEl.validity?.badInput) {
        paidWordsEl.textContent = 'Invalid amount — please enter a valid number';
        paidWordsEl.style.color = 'var(--danger)';
      } else if (advEl && Number(advEl.value) < 0) {
        paidWordsEl.textContent = 'Invalid amount — negative values are not allowed';
        paidWordsEl.style.color = 'var(--danger)';
      } else if (advEl && String(advEl.value).trim() === '' && !mergeTarget) {
        paidWordsEl.textContent = '';
      } else {
        paidWordsEl.textContent = `Paid: ${numberToWords(consolidatedPaid)}`;
        paidWordsEl.style.color = 'var(--success)';
      }
    }
    if (dueSpan) dueSpan.textContent = formatINR(consolidatedDue);
    if (dueWordsEl) dueWordsEl.textContent = numberToWords(consolidatedDue);
    if (breakdown) {
      if (cart.length > 0) {
        breakdown.textContent = `New items (${cart.length}): Shop ${formatINR(shopSum)} + Govt ${formatINR(govSum)}${otherSum > 0 ? ` + Other ${formatINR(otherSum)}` : ''} = ${formatINR(newTotal)}`;
      } else {
        breakdown.textContent = 'Add services above to calculate combined bill';
      }
    }
    if (consolidatedEl) {
      if (mergeTarget) {
        consolidatedEl.style.display = 'block';
        consolidatedEl.textContent = `Merged with ${mergeTarget.receiptId}: Prev ${formatINR(mergeTarget.grandTotal)} + New ${formatINR(newTotal)} · Total Paid After Save: ${formatINR(consolidatedPaid)}`;
      } else {
        consolidatedEl.style.display = 'none';
        consolidatedEl.textContent = '';
      }
    }
  },

  handleSaveService: async (e, id) => {
    e.preventDefault();
    try {
      if (id) {
        const custId = document.getElementById('srv-cust-id')?.value || '';
        const cust = getCustomerById(custId);
        const rawCat = document.getElementById('srv-cat').value;
        const newCatName = document.getElementById('srv-new-cat')?.value?.trim() || '';
        const category = rawCat === '__NEW_CATEGORY__' ? (newCatName || 'Other Services') : rawCat;
        const subcategory = document.getElementById('srv-subcat')?.value || '';
        const nameInput = document.getElementById('srv-name')?.value;
        const serviceName = (nameInput || subcategory || category).trim();

        const serviceCharge = Number(document.getElementById('srv-charge').value) || 0;
        const govFee = Number(document.getElementById('srv-gov-fee').value) || 0;
        const otherCharges = Number(document.getElementById('srv-other').value) || 0;
        const advancePayment = Number(document.getElementById('srv-advance').value) || 0;
        const requiredDocs = document.getElementById('srv-docs').value;

        const data = {
          id,
          customerId: custId,
          customerName: cust ? cust.name : 'Walk-in Customer',
          phone: cust ? cust.phone : document.getElementById('srv-phone').value,
          category,
          subcategory: subcategory || serviceName,
          serviceName,
          refNumber: document.getElementById('srv-ref').value,
          deliveryDate: document.getElementById('srv-delivery-date').value,
          serviceCharge,
          govFee,
          otherCharges,
          advancePayment,
          status: document.getElementById('srv-status').value,
          requiredDocs
        };

        if (rawCat === '__NEW_CATEGORY__' && newCatName) {
          addCustomServiceCategory(newCatName);
        }

        const updRes = await saveService(data);
        if (updRes && updRes.success === false) {
          showToast(updRes.message || 'Could not update service.', 'danger');
          return;
        }
        closeModal();
        showToast('Service updated successfully.', 'success');
        EnterpriseExt.refreshUniversalSearchIfActive();
        render();
        return;
      }

      // New Multi-Service Single-Receipt Flow (Supports Existing OR Inline New Customer Registration)
      const custMode = document.getElementById('srv-cust-mode')?.value || 'existing';
      const collectiveStatus = document.getElementById('srv-collective-status')?.value || 'New';

      let itemsToSave = Array.isArray(AppState.serviceModalCart) ? [...AppState.serviceModalCart] : [];

      // Fallback to inline manual form if cart is empty
      if (itemsToSave.length === 0) {
        const rawCat = document.getElementById('srv-cat')?.value || 'Online Form Fill-up';
        const newCatName = document.getElementById('srv-new-cat')?.value?.trim() || '';
        const category = rawCat === '__NEW_CATEGORY__' ? (newCatName || 'Other Services') : rawCat;
        if (rawCat === '__NEW_CATEGORY__' && newCatName) {
          addCustomServiceCategory(newCatName);
        }
        const subcategory = document.getElementById('srv-subcat')?.value || '';
        const manualTitle = document.getElementById('srv-name')?.value?.trim() || '';
        const serviceName = manualTitle || subcategory || category;
        if (!serviceName) {
          showToast('Please select or add at least one service before submitting.', 'warning');
          return;
        }
        itemsToSave = [{
          serviceName,
          category,
          subcategory: subcategory || serviceName,
          refNumber: document.getElementById('srv-ref')?.value?.trim() || '',
          deliveryDate: document.getElementById('srv-delivery-date')?.value || getTodayDate(),
          serviceCharge: Math.max(0, Number(document.getElementById('srv-charge')?.value) || 0),
          govFee: Math.max(0, Number(document.getElementById('srv-gov-fee')?.value) || 0),
          otherCharges: Math.max(0, Number(document.getElementById('srv-other')?.value) || 0),
          requiredDocs: document.getElementById('srv-docs')?.value?.trim() || '',
          saveAsCustom: !!(document.getElementById('srv-save-custom')?.checked || rawCat === '__NEW_CATEGORY__')
        }];
      }

      itemsToSave = itemsToSave.map(it => ({ ...it, status: collectiveStatus }));

      let custId = '';
      let cust = null;
      let customerNameVal = 'Walk-in Customer';
      let phoneVal = '';
      let registeredNewCustomer = false;

      if (custMode === 'new') {
        const newName = document.getElementById('srv-newcust-name')?.value?.trim() || '';
        const newPhone = document.getElementById('srv-newcust-phone')?.value?.trim() || '';
        if (!newName || !newPhone) {
          showToast('Please enter Full Name and Mobile Number to register the new customer.', 'warning');
          return;
        }

        const loc = getLocationCascadeValues('srvcust-loc');
        const resolvedState = loc.state || 'West Bengal';
        const resolvedDistrict = loc.district || 'Murshidabad';
        const resolvedVillage = loc.village || '';
        const resolvedPost = loc.postOffice || '';
        const resolvedPolice = loc.policeStation || '';
        const resolvedPin = loc.pinCode || document.getElementById('srvcust-loc-pin-quick')?.value?.trim() || '';
        const todayDate = getTodayDate();
        const applicationId = await allocateGlobalReference('CASE', { entityType: 'CASE' });
        const staffUid = getCurrentUser()?.uid || MAIN_ADMIN_UID;
        const primaryScheme = itemsToSave[0]?.serviceName || 'General Digital Service';
        const custRemarks = document.getElementById('srv-newcust-remarks')?.value?.trim() || '';

        const newCustData = {
          applicationId,
          schemeName: primaryScheme,
          villageOrWard: loc.gpOrWard || resolvedVillage || 'Mamudpur',
          currentStatus: 'Submitted',
          name: newName,
          fatherName: document.getElementById('srv-newcust-father')?.value?.trim() || '',
          phone: newPhone,
          altPhone: document.getElementById('srv-newcust-altphone')?.value?.trim() || '',
          email: document.getElementById('srv-newcust-email')?.value?.trim() || '',
          address: document.getElementById('srv-newcust-address')?.value?.trim() || loc.formattedAddress || `${resolvedVillage || 'Mamudpur'}, ${resolvedDistrict}`,
          regDate: todayDate,
          category: 'General Public',
          services: Array.from(new Set(itemsToSave.map(i => i.serviceName).filter(Boolean))),
          village: resolvedVillage,
          postOffice: resolvedPost,
          policeStation: resolvedPolice,
          district: resolvedDistrict,
          state: resolvedState,
          pinCode: resolvedPin,
          aadhaarLast4: document.getElementById('srv-newcust-aadhaar')?.value?.trim() || '',
          jobCardNo: document.getElementById('srv-newcust-jobcard')?.value?.trim() || '',
          remarks: custRemarks,
          assignedStaff: staffUid,
          assignedStaffUid: staffUid,
          createdByUid: getCurrentUser()?.uid || ''
        };

        if (resolvedVillage) {
          await saveCustomLocationIfNeeded({ ...loc, state: resolvedState, district: resolvedDistrict, village: resolvedVillage, postOffice: resolvedPost, policeStation: resolvedPolice, pinCode: resolvedPin });
        }

        const custRes = await saveCustomer(newCustData);
        cust = custRes?.customer || null;
        custId = cust?.id || '';
        customerNameVal = cust?.name || newName;
        phoneVal = cust?.phone || newPhone;
        registeredNewCustomer = !!custId;

        if (document.getElementById('srv-newcust-90day')?.checked && custId) {
          await createOrSyncFollowupCase({
            customerId: custId,
            customerName: customerNameVal,
            phone: phoneVal,
            applicationId: cust.applicationId,
            schemeName: cust.schemeName,
            villageOrWard: cust.villageOrWard,
            currentStatus: cust.currentStatus,
            assignedStaff: cust.assignedStaff,
            startDate: todayDate,
            remarks: custRemarks
          });
        }

        fetch('/api/customers', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...newCustData,
            id: custId,
            villageOrLocality: resolvedVillage,
            blockOrMunicipality: loc.blockOrMunicipality || '',
            gpOrWard: loc.gpOrWard || '',
            subdivision: loc.subdivision || ''
          })
        }).catch(() => {});
      } else {
        custId = document.getElementById('srv-cust-id')?.value || '';
        cust = getCustomerById(custId);
        if (!custId || !cust) {
          showToast('Please select an existing customer or switch to "+ Register New Customer".', 'warning');
          return;
        }
        customerNameVal = cust.name;
        phoneVal = cust.phone || document.getElementById('srv-phone')?.value || '';

        // Check duplicates for existing customer
        const allowDup = document.getElementById('srv-allow-dup')?.checked;
        const hasDup = itemsToSave.some(it => checkDuplicateServiceEntry(custId, it.serviceName).isDuplicate);
        if (hasDup && !allowDup) {
          window.MJK.checkServiceModalDuplicate();
          showToast('Duplicate active service detected. Tick "Allow duplicate" in the warning banner to proceed.', 'warning');
          return;
        }
      }

      const totalAdvancePaid = Math.max(0, Number(document.getElementById('srv-advance')?.value) || 0);
      const paymentMode = document.getElementById('srv-pay-mode')?.value || 'Cash';
      const shouldPrint = !!document.getElementById('srv-auto-print')?.checked;
      const sharedReceiptId = AppState.serviceModalMergeTarget?.receiptId || '';

      const batchRes = await saveServiceBatch({
        customerId: custId,
        customerName: customerNameVal,
        phone: phoneVal,
        receiptId: sharedReceiptId,
        appDate: getTodayDate(),
        paymentMode,
        collectiveStatus,
        totalAdvancePaid,
        items: itemsToSave
      });

      if (!batchRes?.success) {
        showToast(batchRes?.message || 'Could not save services.', 'danger');
        return;
      }

      // Deduct stock if any gas accessories / retail items from inventory were included in cart
      itemsToSave.forEach(it => {
        if (it.inventoryProductId) {
          adjustStock(it.inventoryProductId, -(Number(it.inventoryQty) || 1), `Service receipt ${batchRes.receiptId} (${customerNameVal})`);
        }
      });

      let syncedGovtCount = 0;
      for (let idx = 0; idx < itemsToSave.length; idx++) {
        const it = itemsToSave[idx];
        const savedItem = batchRes.services[idx];
        if (it.saveAsCustom && it.serviceName) {
          await addCustomServiceEntry({
            category: it.category,
            serviceName: it.serviceName,
            defaultCharge: it.serviceCharge,
            defaultGovFee: it.govFee,
            remarks: it.requiredDocs
          });
          await upsertRateChartItem({
            category: it.category,
            serviceName: it.serviceName,
            unit: 'Per Application',
            serviceCharge: it.serviceCharge,
            govFee: it.govFee,
            remarks: it.requiredDocs,
            isActive: true
          });
        }

        const mapping = autoMapService(it.serviceName);
        if (mapping && (mapping.isGovtScheme || mapping.isGrievance || mapping.masterRegisterSync)) {
          try {
            const existingGovtCases = getAllGovtCases();
            const existingGovtCase = existingGovtCases.find(c =>
              c.schemeName.toLowerCase() === mapping.name.toLowerCase() &&
              ((cust && c.mobileNumber === cust.phone) || c.applicantName.toLowerCase() === customerNameVal.toLowerCase())
            );
            if (!existingGovtCase) {
              await saveGovtCase({
                applicantName: customerNameVal,
                relativeName: cust ? (cust.fatherName || cust.relativeName || '') : '',
                hofName: customerNameVal,
                mobileNumber: phoneVal,
                address: cust ? (cust.village || cust.address || 'Mamudpur') : 'Mamudpur',
                district: cust ? (cust.district || 'Murshidabad') : 'Murshidabad',
                blockMunicipality: cust ? (cust.policeStation || 'Domkal') : 'Domkal',
                govtLevel: mapping.govtLevel || 'State Government',
                schemeName: mapping.isGovtScheme ? mapping.name : (mapping.name || it.serviceName),
                caseCategory: mapping.isGrievance ? 'Public Grievance Redressal' : 'New Scheme Application',
                applicationId: savedItem?.refNumber || it.refNumber || '',
                submissionDate: getTodayDate(),
                currentStatus: 'Application Submitted',
                previousPaymentStatus: 'Not Applicable',
                complaintChannel: mapping.isGrievance ? (mapping.name.includes('CMO') ? 'CMO Grievance Portal' : mapping.name.includes('CPGRAMS') ? 'CPGRAMS Central Portal' : 'BDO / SDO Office') : 'None',
                complaintRefNumber: mapping.isGrievance ? (savedItem?.refNumber || it.refNumber) : '-',
                assignedAuthority: 'Block Development Officer (BDO)',
                resolutionStatus: 'Pending Review',
                isAnnapurna: mapping.name === 'Annapurna Yojana',
                remarks: `Auto-registered via MUN COMPUTER Receipt ${batchRes.receiptId} (${it.serviceName}). Fee: ₹${it.serviceCharge}`
              });
              syncedGovtCount += 1;
            }
          } catch (err) {
            console.error('Auto-sync to Master Register failed:', err);
          }
        }
      }

      if (custId) {
        await addCustomerVisit({
          customerId: custId,
          visitDate: getTodayDate(),
          servicesProvided: batchRes.services.map(s => s.serviceName),
          remarks: `Receipt ${batchRes.receiptId} (${(batchRes.allReceiptServices || batchRes.services).length} service${(batchRes.allReceiptServices || batchRes.services).length > 1 ? 's' : ''})`
        });
      }

      AppState.serviceModalCart = [];
      AppState.serviceModalReceiptId = '';
      AppState.serviceModalMergeTarget = null;

      closeModal();
      const baseLabel = batchRes.merged
        ? `Merged ${batchRes.services.length} item(s) into Receipt ${batchRes.receiptId} · Consolidated Total: ${formatINR(batchRes.grandTotal)}${batchRes.totalDue > 0 ? ` (Due: ${formatINR(batchRes.totalDue)})` : ' (Paid)'}`
        : (registeredNewCustomer
          ? `Customer "${customerNameVal}" registered & ${batchRes.services.length} service(s) billed under Receipt ${batchRes.receiptId}`
          : (batchRes.services.length > 1
            ? `${batchRes.services.length} services billed under Receipt ${batchRes.receiptId}`
            : `Service registered under Receipt ${batchRes.receiptId}`));
      showToast(syncedGovtCount > 0 ? `${baseLabel} & synced to Master Register!` : baseLabel, 'success');
      EnterpriseExt.refreshUniversalSearchIfActive();
      render();

      if (shouldPrint && batchRes.services[0]) {
        setTimeout(() => {
          window.MJK.printServiceReceipt(batchRes.services[0].id, batchRes.receiptId);
        }, 80);
      }
    } catch (err) {
      showToast(err?.message || 'Failed to save service entry.', 'danger');
    }
  },

  openCustomServiceModal: (returnToServiceModal = false) => {
    const categories = getServiceCategories();
    const customList = getCustomSubServices();

    const content = `
      <form onsubmit="window.MJK.handleSaveCustomService(event, ${returnToServiceModal ? 'true' : 'false'})">
        <div style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.75rem; margin-bottom:1rem; font-size:0.8rem; color:var(--text-muted);">
          যেকোনো নতুন সার্ভিস বা নতুন ক্যাটাগরি যোগ করুন — এটি স্বয়ংক্রিয়ভাবে <strong>Services Catalog</strong>, <strong>Smart Auto-Mapper</strong> ও <strong>Service Rate Chart</strong>-এ যুক্ত হয়ে যাবে।
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Select Category <span class="req">*</span></label>
            <select id="csrv-cat" class="form-control" required onchange="const nw=document.getElementById('csrv-new-cat-wrap'); if(nw){ nw.style.display = this.value === '__NEW_CATEGORY__' ? 'block' : 'none'; }">
              ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
              <option value="__NEW_CATEGORY__">+ Create New Custom Category...</option>
            </select>
            <div id="csrv-new-cat-wrap" style="display:none; margin-top:0.45rem;">
              <input type="text" id="csrv-new-cat" class="form-control" placeholder="Enter new category name...">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Billing Unit</label>
            <select id="csrv-unit" class="form-control">
              <option value="Per Application">Per Application</option>
              <option value="Per Page">Per Page</option>
              <option value="Per Card">Per Card</option>
              <option value="Per Copy">Per Copy</option>
              <option value="Per Document">Per Document</option>
              <option value="Per Transaction">Per Transaction</option>
              <option value="Fixed Charge">Fixed Charge</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Custom Service Name <span class="req">*</span></label>
            <input type="text" id="csrv-name" class="form-control" required placeholder="e.g. Digital Signature Token / Trade License Renew">
          </div>
          <div class="form-group">
            <label class="form-label">Bengali Name (Optional)</label>
            <input type="text" id="csrv-name-bn" class="form-control" placeholder="e.g. ট্রেড লাইসেন্স রিনিউয়াল">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Default Shop Service Charge (₹) <span class="req">*</span></label>
            <input type="number" id="csrv-charge" class="form-control font-mono" min="0" required value="50" oninput="window.MJK.syncAmountWords(this, 'csrv-charge-words')">
            <div id="csrv-charge-words" class="amount-words-hint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Default Govt / Portal Fee (₹)</label>
            <input type="number" id="csrv-gov" class="form-control font-mono" min="0" value="0" oninput="window.MJK.syncAmountWords(this, 'csrv-gov-words')">
            <div id="csrv-gov-words" class="amount-words-hint"></div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Required Documents / Remarks</label>
          <input type="text" id="csrv-remarks" class="form-control" placeholder="e.g. Aadhaar + Photo + Previous Copy">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap; margin-top:1rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Custom Service</button>
        </div>
      </form>

      ${customList.length > 0 ? `
        <div style="margin-top:1.25rem; border-top:1px solid var(--border-subtle); padding-top:0.85rem;">
          <div style="font-size:0.78rem; font-weight:700; color:var(--text-muted); margin-bottom:0.5rem; text-transform:uppercase;">
            Saved Custom Services (${customList.length})
          </div>
          <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:180px; overflow-y:auto;">
            ${customList.map(cs => `
              <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap; padding:0.5rem 0.65rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); font-size:0.8rem;">
                <div>
                  <strong>${escHtml(cs.name)}</strong> <span class="badge badge-info" style="font-size:0.68rem;">${escHtml(cs.category)}</span>
                  <div class="tabular-nums font-mono" style="font-size:0.74rem; color:var(--text-muted);">Shop: ₹${cs.defaultCharge || 0} · Govt: ₹${cs.defaultGovFee || 0}</div>
                </div>
                <div style="display:flex; gap:0.35rem; align-items:center;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openEditCustomServiceModal('${cs.id}')" title="Edit Rate / Details">✎ Rate</button>
                  <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.promptDeleteCustomService('${cs.id}')" title="Delete Custom Service">🗑 Delete</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    openModal('Add Custom Service & Category (MUN COMPUTER)', content, null);
    setTimeout(() => {
      syncAmountWords(document.getElementById('csrv-charge'), 'csrv-charge-words');
      syncAmountWords(document.getElementById('csrv-gov'), 'csrv-gov-words');
    }, 30);
  },

  handleSaveCustomService: async (e, returnToServiceModal = false) => {
    e.preventDefault();
    try {
      const rawCat = document.getElementById('csrv-cat')?.value;
      const newCat = document.getElementById('csrv-new-cat')?.value?.trim() || '';
      const category = rawCat === '__NEW_CATEGORY__' ? (newCat || 'Other Services') : rawCat;
      const serviceName = (document.getElementById('csrv-name')?.value || '').trim();
      const nameBn = (document.getElementById('csrv-name-bn')?.value || '').trim();
      const unit = document.getElementById('csrv-unit')?.value || 'Per Application';
      const defaultCharge = Math.max(0, Number(document.getElementById('csrv-charge')?.value) || 0);
      const defaultGovFee = Math.max(0, Number(document.getElementById('csrv-gov')?.value) || 0);
      const remarks = (document.getElementById('csrv-remarks')?.value || '').trim();

      if (!serviceName) {
        showToast('Please enter a custom service name.', 'warning');
        return;
      }

      await addCustomServiceEntry({ category, serviceName, nameBn, unit, defaultCharge, defaultGovFee, remarks });
      await upsertRateChartItem({
        category,
        serviceName,
        nameBn,
        unit,
        serviceCharge: defaultCharge,
        govFee: defaultGovFee,
        remarks,
        isActive: true
      });

      closeModal();
      showToast(`Added custom service "${serviceName}" under "${category}".`, 'success');
      render();
      if (returnToServiceModal) {
        setTimeout(() => {
          window.MJK.openServiceModal(null, category, serviceName, serviceName);
        }, 150);
      }
    } catch (err) {
      showToast(err?.message || 'Failed to save custom service.', 'danger');
    }
  },

  promptDeleteCustomService: (id) => {
    showConfirmDialog('Remove Custom Service?', 'This removes the custom service from your Rate Chart, Official Directory, and quick catalog (existing customer records remain safe).', () => {
      const res = deleteCustomServiceEntry(id);
      if (res?.deleted) {
        const rateMatch = getRateForService(res.deleted.name, res.deleted.category);
        if (rateMatch?.id) {
          deleteRateChartItem(rateMatch.id);
        }
      }
      showToast('Custom service removed everywhere.', 'info');
      render();
    });
  },

  openEditCustomServiceModal: (id) => {
    const customList = getCustomSubServices();
    const existing = customList.find(cs => cs.id === id);
    if (!existing) {
      showToast('Custom service entry not found.', 'warning');
      return;
    }
    const categories = getServiceCategories();
    const content = `
      <form onsubmit="window.MJK.submitEditCustomServiceModal(event, '${escHtml(existing.id)}')">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category <span class="req">*</span></label>
            <select id="ecsrv-cat" class="form-control" required>
              ${categories.map(c => `<option value="${escHtml(c)}" ${existing.category === c ? 'selected' : ''}>${escHtml(c)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Billing Unit</label>
            <select id="ecsrv-unit" class="form-control">
              ${['Per Application', 'Per Page', 'Per Card', 'Per Copy', 'Per Document', 'Per Transaction', 'Fixed Charge'].map(u => `<option value="${u}" ${(existing.unit || 'Per Application') === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Service Name <span class="req">*</span></label>
            <input type="text" id="ecsrv-name" class="form-control" required value="${escHtml(existing.name)}">
          </div>
          <div class="form-group">
            <label class="form-label">Bengali Name (Optional)</label>
            <input type="text" id="ecsrv-name-bn" class="form-control" value="${escHtml(existing.nameBn || '')}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Shop Service Rate / Charge (₹) <span class="req">*</span></label>
            <input type="number" id="ecsrv-charge" class="form-control font-mono" min="0" required value="${Number(existing.defaultCharge) || 0}" oninput="window.MJK.syncAmountWords(this, 'ecsrv-charge-words')">
            <div id="ecsrv-charge-words" class="amount-words-hint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Govt / Portal Fee (₹)</label>
            <input type="number" id="ecsrv-gov" class="form-control font-mono" min="0" value="${Number(existing.defaultGovFee) || 0}" oninput="window.MJK.syncAmountWords(this, 'ecsrv-gov-words')">
            <div id="ecsrv-gov-words" class="amount-words-hint"></div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Required Documents / Remarks</label>
          <input type="text" id="ecsrv-remarks" class="form-control" value="${escHtml(existing.remarks || '')}">
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-top:1rem;">
          <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.promptDeleteCustomService('${escHtml(existing.id)}')">🗑 Delete Service</button>
          <div style="display:flex; gap:0.5rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">💾 Update Rate & Details</button>
          </div>
        </div>
      </form>
    `;
    openModal(`Edit Rate: ${existing.name}`, content, null);
    setTimeout(() => {
      syncAmountWords(document.getElementById('ecsrv-charge'), 'ecsrv-charge-words');
      syncAmountWords(document.getElementById('ecsrv-gov'), 'ecsrv-gov-words');
    }, 30);
  },

  submitEditCustomServiceModal: async (e, id) => {
    e.preventDefault();
    try {
      const prev = getCustomSubServices().find(cs => cs.id === id);
      const category = document.getElementById('ecsrv-cat')?.value || 'Other Services';
      const unit = document.getElementById('ecsrv-unit')?.value || 'Per Application';
      const serviceName = (document.getElementById('ecsrv-name')?.value || '').trim();
      const nameBn = (document.getElementById('ecsrv-name-bn')?.value || '').trim();
      const defaultCharge = Math.max(0, Number(document.getElementById('ecsrv-charge')?.value) || 0);
      const defaultGovFee = Math.max(0, Number(document.getElementById('ecsrv-gov')?.value) || 0);
      const remarks = (document.getElementById('ecsrv-remarks')?.value || '').trim();

      const rateItem = prev
        ? (getRateForService(prev.name, prev.category) || getRateForService(serviceName, category))
        : getRateForService(serviceName, category);

      const res = updateCustomServiceEntry(id, {
        category,
        unit,
        serviceName,
        nameBn,
        defaultCharge,
        defaultGovFee,
        remarks
      });

      if (!res?.success) {
        showToast(res?.message || 'Unable to update custom service.', 'warning');
        return;
      }

      await upsertRateChartItem({
        id: rateItem?.id,
        category,
        serviceName,
        nameBn,
        unit,
        serviceCharge: defaultCharge,
        govFee: defaultGovFee,
        remarks,
        isCustom: true,
        isActive: true
      });

      closeModal();
      showToast(`Updated "${serviceName}" rate (Shop ₹${defaultCharge}, Govt ₹${defaultGovFee}) across all modules.`, 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to update custom service.', 'danger');
    }
  },

  getOfficialDirectoryStats: () => {
    const activeItems = getAllRateChartItems().filter(x => x.isActive !== false);
    const grouped = new Map();
    activeItems.forEach(item => {
      const cat = String(item.category || '').trim() || 'Other Services';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat).push(item);
    });
    const customCats = getCustomServiceCatalogData().customCategories || [];
    customCats.forEach(cat => {
      const cleanCat = String(cat || '').trim();
      if (cleanCat && !Array.from(grouped.keys()).some(k => k.toLowerCase() === cleanCat.toLowerCase())) {
        grouped.set(cleanCat, []);
      }
    });
    return {
      activeItems,
      grouped,
      categoryCount: grouped.size,
      serviceCount: activeItems.length
    };
  },

  openCategoryCatalogModal: () => {
    const { categoryCount, serviceCount } = window.MJK.getOfficialDirectoryStats();
    const removedCount = getRemovedCatalogServices().length;
    const canAddRate = canMenu('rate-chart', 'add');
    const currentQuery = window._catalogSearchQuery || '';

    const content = `
      <div style="margin-bottom:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem;">
          <div>
            <div id="catalog-directory-title" style="font-weight:700; font-size:0.95rem;">Official Service Directory (${categoryCount} Categories · ${serviceCount} Services)</div>
            <div style="font-size:0.78rem; color:var(--text-muted);">Live 1:1 sync with Service Rate Chart · Showing Shop Charge (₹), Govt Fee (₹) &amp; Total Rate (₹). Click any service to register, ✎ to edit rate, or 🗑 to remove.</div>
          </div>
          <div style="display:flex; gap:0.45rem; flex-wrap:wrap;">
            ${removedCount > 0 ? `<button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openRemovedCatalogServicesModal()">↺ Removed (${removedCount})</button>` : ''}
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.closeModal(); window.MJK.navigateTo('rate-chart');">🧾 Manage Rate Chart</button>
            ${canAddRate ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddRateItemModal(null, { fromDirectory: true })">✨ + Add Custom Service</button>` : ''}
          </div>
        </div>
        <input type="text" id="catalog-search" class="form-control" value="${escHtml(currentQuery)}" placeholder="Search across ${categoryCount} categories, ${serviceCount} services, Bengali names, or rates..." oninput="window._catalogSearchQuery = this.value; document.getElementById('catalog-grid').innerHTML = window.MJK.filterCategoryCatalog(this.value)">
      </div>

      <div id="catalog-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap:0.85rem; max-height:60vh; overflow-y:auto; padding-right:0.35rem;">
        ${window.MJK.filterCategoryCatalog(currentQuery)}
      </div>

      <div style="margin-top:1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <span style="font-size:0.78rem; color:var(--text-muted);">MUN COMPUTER · 1:1 Synchronized with Live Service Rate Chart Master</span>
        <button class="btn btn-primary" onclick="window.MJK.closeModal()">Close Directory</button>
      </div>
    `;

    openModal('Official Service Directory — MUN COMPUTER', content, null);
  },

  filterCategoryCatalog: (query) => {
    const q = (query || '').toLowerCase().trim();
    const { grouped } = window.MJK.getOfficialDirectoryStats();
    const canEditRate = canMenu('rate-chart', 'edit');
    const canDeleteRate = canMenu('rate-chart', 'delete');
    const customKeySet = new Set(getCustomSubServices().map(cs => `${cs.category}::${cs.name}`.toLowerCase()));

    const categoryEntries = [];
    grouped.forEach((items, cat) => {
      if (!q) {
        categoryEntries.push([cat, items]);
        return;
      }
      const catMatches = cat.toLowerCase().includes(q);
      const matchingItems = items.filter(item => {
        const shop = Number(item.serviceCharge) || 0;
        const gov = Number(item.govFee) || 0;
        const total = shop + gov;
        return (
          (item.serviceName || '').toLowerCase().includes(q) ||
          (item.nameBn || '').toLowerCase().includes(q) ||
          (item.remarks || '').toLowerCase().includes(q) ||
          (item.unit || '').toLowerCase().includes(q) ||
          String(total).includes(q) ||
          String(shop).includes(q)
        );
      });
      if (matchingItems.length > 0) {
        categoryEntries.push([cat, matchingItems]);
      } else if (catMatches) {
        categoryEntries.push([cat, items]);
      }
    });

    if (categoryEntries.length === 0) {
      return `<div style="grid-column:1/-1; padding:2rem; text-align:center; color:var(--text-muted);">No active services matching "${escHtml(query)}"</div>`;
    }

    return categoryEntries.map(([cat, items]) => `
      <div style="border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.85rem; background:var(--surface-alt); display:flex; flex-direction:column; gap:0.55rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.35rem; border-bottom:1px solid var(--border-subtle); padding-bottom:0.4rem;">
          <span style="font-weight:700; font-size:0.92rem; color:var(--blue-600);">${escHtml(cat)}</span>
          <span class="badge badge-info" style="font-size:0.7rem;">${items.length} Services</span>
        </div>
        ${items.length === 0 ? `
          <div style="font-size:0.76rem; color:var(--text-muted); font-style:italic;">No active services in this category yet.</div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:0.4rem;">
            ${items.map(item => {
              const shop = Math.max(0, Number(item.serviceCharge) || 0);
              const gov = Math.max(0, Number(item.govFee) || 0);
              const total = shop + gov;
              const isCustom = Boolean(item.isCustom || customKeySet.has(`${cat}::${item.serviceName}`.toLowerCase()));
              const escCat = escAttrJs(cat);
              const escSub = escAttrJs(item.serviceName);
              const escId = escAttrJs(item.id);
              return `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.35rem; padding:0.42rem 0.55rem; background:var(--surface); border:1px solid ${isCustom ? 'var(--blue-400)' : 'var(--border-subtle)'}; border-radius:var(--radius-sm);">
                  <button type="button" style="flex:1; min-width:0; text-align:left; background:transparent; border:none; padding:0; cursor:pointer; color:var(--text-main);" onclick="window.MJK.startServiceFromCatalog('${escCat}', '${escSub}', '${escId}')" title="Register ${escHtml(item.serviceName)} (${escHtml(item.unit || 'Per Application')})">
                    <div style="font-size:0.79rem; font-weight:700; line-height:1.25; word-break:break-word;">
                      + ${escHtml(item.serviceName)}
                      ${isCustom ? '<span style="color:var(--blue-600); font-weight:700; font-size:0.7rem; margin-left:0.25rem;">[Custom]</span>' : ''}
                    </div>
                    ${item.nameBn ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:1px;">${escHtml(item.nameBn)}</div>` : ''}
                    <div class="tabular-nums font-mono" style="font-size:0.7rem; color:var(--text-muted); margin-top:2px; display:flex; gap:0.45rem; flex-wrap:wrap; align-items:center;">
                      <span>Shop: <strong>₹${shop}</strong></span>
                      <span>Govt: <strong>₹${gov}</strong></span>
                      <span style="color:var(--success); font-weight:800;">Total: ₹${total}</span>
                      <span style="color:var(--text-muted); font-family:inherit;">(${escHtml(item.unit || 'Per Application')})</span>
                    </div>
                  </button>
                  <div style="display:inline-flex; gap:0.2rem; flex-shrink:0;">
                    ${canEditRate ? `<button type="button" class="btn btn-secondary btn-sm" style="padding:0.2rem 0.42rem; font-size:0.72rem;" onclick="window.MJK.openAddRateItemModal('${escId}', { fromDirectory: true })" title="Edit Rate in Rate Chart">✎</button>` : ''}
                    ${canDeleteRate ? `<button type="button" class="btn btn-outline btn-sm" style="padding:0.2rem 0.42rem; font-size:0.72rem; color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.promptRemoveCatalogService('${escCat}', '${escSub}', '${escId}')" title="Remove service from Rate Chart &amp; Directory">🗑</button>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `).join('');
  },

  startServiceFromCatalog: (cat, sub, rateId = '') => {
    closeModal();
    setTimeout(() => {
      window.MJK.openServiceModal(null, cat, sub, sub, '', rateId);
    }, 150);
  },

  openStatusChangeModal: (serviceId) => {
    const s = getServiceById(serviceId);
    if (!s) return;
    const statusList = getServiceStatuses([s.status]);

    const content = `
      <div style="margin-bottom:1rem;">
        <div style="font-weight:700; font-size:1.05rem;">${escHtml(s.serviceName)}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">Client: ${escHtml(s.customerName)} · Ref: ${escHtml(s.refNumber)}</div>
      </div>

      <div class="form-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
          <label class="form-label" style="margin:0;">Update Status To</label>
          <button type="button" class="btn btn-outline btn-sm" style="padding:0.1rem 0.45rem; font-size:0.7rem;" onclick="window.MJK.openManageDynamicOptionsModal('service_status', 'modal-update-status-val')" title="Manage Custom Statuses">+ Manage</button>
        </div>
        <select id="modal-update-status-val" class="form-control">
          ${statusList.map(st => `<option value="${escHtml(st)}" ${s.status === st ? 'selected' : ''}>${escHtml(st)}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Timeline Status Note / Outcome</label>
        <input type="text" id="modal-update-status-notes" class="form-control" placeholder="e.g. PVC card printed, waiting for customer collection">
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
        <button class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.MJK.submitStatusChange('${escAttrJs(serviceId)}')">Update Status</button>
      </div>
    `;

    openModal('Update Service Status', content, null);
  },

  submitStatusChange: (id) => {
    const status = document.getElementById('modal-update-status-val').value;
    const notes = document.getElementById('modal-update-status-notes').value;
    updateServiceStatus(id, status, notes);
    closeModal();
    showToast(`Status updated to "${status}"`, 'success');
    render();
  },

  editService: (id) => {
    window.MJK.openServiceModal(id);
  },

  openQuickRateEditModal: (serviceId) => {
    const s = getServiceById(serviceId);
    if (!s) return;
    const recalcFn = () => window.MJK.updateQuickRateEditWords();

    const content = `
      <form onsubmit="window.MJK.saveQuickRateEdit(event, '${escHtml(s.id)}')">
        <div style="padding:0.75rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:1rem;">
          <div style="font-weight:700; font-size:0.95rem;">${escHtml(s.serviceName)}</div>
          <div style="font-size:0.78rem; color:var(--text-muted);">Customer: ${escHtml(s.customerName)} · Ref: <span class="font-mono">${escHtml(s.refNumber)}</span></div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Shop Service Charge (₹) <span class="req">*</span></label>
            <input type="number" id="qre-charge" class="form-control font-mono" min="0" required value="${Number(s.serviceCharge) || 0}" oninput="window.MJK.updateQuickRateEditWords()">
            <div id="qre-charge-words" class="amount-words-hint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Govt / Portal Fee (₹)</label>
            <input type="number" id="qre-gov" class="form-control font-mono" min="0" value="${Number(s.govFee) || 0}" oninput="window.MJK.updateQuickRateEditWords()">
            <div id="qre-gov-words" class="amount-words-hint"></div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Other Charges (₹)</label>
            <input type="number" id="qre-other" class="form-control font-mono" min="0" value="${Number(s.otherCharges) || 0}" oninput="window.MJK.updateQuickRateEditWords()">
            <div id="qre-other-words" class="amount-words-hint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Paid / Advance Amount (₹)</label>
            <input type="number" id="qre-paid" class="form-control font-mono" min="0" value="${Number(s.paidAmount) || 0}" oninput="window.MJK.updateQuickRateEditWords()">
            <div id="qre-paid-words" class="amount-words-hint"></div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.75rem; padding:0.7rem 0.9rem; background:var(--surface-alt); border-radius:var(--radius-md); margin-bottom:0.85rem;">
          <div>
            <span style="font-size:0.76rem; color:var(--text-muted);">New Total:</span>
            <strong id="qre-total-disp" class="tabular-nums font-mono" style="margin-left:0.35rem; color:var(--blue-600);">${formatINR(s.totalAmount || 0)}</strong>
            <div id="qre-total-words" class="amount-words-hint" style="color:var(--text-muted);">${escHtml(numberToWords(s.totalAmount || 0))}</div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:0.76rem; color:var(--text-muted);">Balance Due:</span>
            <strong id="qre-due-disp" class="tabular-nums font-mono" style="margin-left:0.35rem; color:${(s.dueAmount || 0) > 0 ? 'var(--danger)' : 'var(--success)'};">${formatINR(s.dueAmount || 0)}</strong>
            <div id="qre-due-words" class="amount-words-hint" style="color:var(--text-muted);">${escHtml(numberToWords(s.dueAmount || 0))}</div>
          </div>
        </div>

        <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.8rem; margin-bottom:1rem; cursor:pointer;">
          <input type="checkbox" id="qre-sync-chart">
          <span>Also save Shop Charge &amp; Govt Fee as default rate in <strong>Service Rate Chart</strong></span>
        </label>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">💾 Save New Rate / Price</button>
        </div>
      </form>
    `;
    openModal('Quick Change Rate / Price', content, null);
    setTimeout(recalcFn, 30);
  },

  updateQuickRateEditWords: () => {
    const cEl = document.getElementById('qre-charge');
    const gEl = document.getElementById('qre-gov');
    const oEl = document.getElementById('qre-other');
    const pEl = document.getElementById('qre-paid');
    if (cEl) syncAmountWords(cEl, 'qre-charge-words');
    if (gEl) syncAmountWords(gEl, 'qre-gov-words');
    if (oEl) syncAmountWords(oEl, 'qre-other-words');
    if (pEl) syncAmountWords(pEl, 'qre-paid-words');

    const c = Math.max(0, Number(cEl?.value) || 0);
    const g = Math.max(0, Number(gEl?.value) || 0);
    const o = Math.max(0, Number(oEl?.value) || 0);
    const p = Math.max(0, Number(pEl?.value) || 0);
    const tot = c + g + o;
    const due = Math.max(0, tot - p);

    const totEl = document.getElementById('qre-total-disp');
    const dueEl = document.getElementById('qre-due-disp');
    const totWords = document.getElementById('qre-total-words');
    const dueWords = document.getElementById('qre-due-words');
    if (totEl) totEl.textContent = formatINR(tot);
    if (dueEl) dueEl.textContent = formatINR(due);
    if (totWords) totWords.textContent = numberToWords(tot);
    if (dueWords) dueWords.textContent = numberToWords(due);
  },

  saveQuickRateEdit: async (e, id) => {
    e.preventDefault();
    try {
      const s = getServiceById(id);
      if (!s) return;
      const serviceCharge = Math.max(0, Number(document.getElementById('qre-charge')?.value) || 0);
      const govFee = Math.max(0, Number(document.getElementById('qre-gov')?.value) || 0);
      const otherCharges = Math.max(0, Number(document.getElementById('qre-other')?.value) || 0);
      const advancePayment = Math.max(0, Number(document.getElementById('qre-paid')?.value) || 0);
      const syncChart = Boolean(document.getElementById('qre-sync-chart')?.checked);

      await saveService({
        ...s,
        id: s.id,
        serviceCharge,
        govFee,
        otherCharges,
        advancePayment
      });

      if (syncChart) {
        const rateMatch = getRateForService(s.serviceName, s.category, s.subcategory);
        await upsertRateChartItem({
          id: rateMatch?.id,
          category: s.category,
          serviceName: s.serviceName,
          serviceCharge,
          govFee,
          isActive: true
        });
      }

      closeModal();
      showToast(`Rate updated for "${s.serviceName}" (Total: ${formatINR(serviceCharge + govFee + otherCharges)}).`, 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to update rate.', 'danger');
    }
  },

  promptDeleteService: (id) => {
    if (!canMenu('services', 'delete')) {
      showToast('Permission Denied: You do not have Delete permission for Services.', 'danger');
      return;
    }
    const srv = getServiceById(id);
    showDeleteReasonDialog(
      'Delete Service Entry?',
      `Delete service "${srv ? `${srv.serviceName} (${srv.customerName})` : id}"? Reason is permanently logged.`,
      async (reason) => {
        deleteService(id);
        await logDeleteHistory({
          targetType: 'SERVICE',
          targetId: id,
          targetSummary: srv ? `${srv.serviceName} · ${srv.customerName} (${srv.refNumber || ''})` : id,
          reason
        });
        showToast('Service record deleted & logged.', 'info');
        render();
      }
    );
  },

  promptBulkDeleteServices: () => {
    if (!canMenu('services', 'delete')) {
      showToast('Permission Denied: You do not have Delete permission for Services.', 'danger');
      return;
    }
    const selectedIds = Array.from(document.querySelectorAll('.srv-select-row:checked')).map(cb => cb.value).filter(Boolean);
    if (selectedIds.length === 0) {
      showToast('Select at least one service entry checkbox to delete.', 'warning');
      return;
    }
    showDeleteReasonDialog(
      `Delete ${selectedIds.length} Selected Service Entry(s)?`,
      `This will permanently remove ${selectedIds.length} selected service tracking entry(s) and log your reason.`,
      async (reason) => {
        const res = deleteMultipleServices(selectedIds);
        await logDeleteHistory({
          targetType: 'SERVICE',
          targetId: selectedIds.join(','),
          targetSummary: `Bulk delete (${res.count || selectedIds.length} services)`,
          reason
        });
        showToast(`Deleted ${res.count || selectedIds.length} service record(s) & logged.`, 'warning');
        render();
      }
    );
  },

  promptRemoveCatalogService: (category, serviceName, rateId = '') => {
    if (!canMenu('rate-chart', 'delete')) {
      showToast('Permission Denied: You do not have permission to delete Rate Chart items.', 'danger');
      return;
    }
    showConfirmDialog(
      `Remove "${serviceName}" from Service Rate Chart & Directory?`,
      `This removes "${serviceName}" (${category}) from your Service Rate Chart, Official Service Directory, Quick Entry dropdowns, Billing picker, and Global Search. Existing customer service records stay untouched.`,
      () => {
        const rateMatch = (rateId ? getRateChartItemById(rateId) : null) || getRateForService(serviceName, category);
        if (rateMatch?.id) {
          deleteRateChartItem(rateMatch.id);
        } else {
          removeCatalogService(category, serviceName);
        }
        showToast(`Removed "${serviceName}" (${category}) across all modules.`, 'warning');
        render();
        setTimeout(() => window.MJK.openCategoryCatalogModal(), 120);
      }
    );
  },

  openRemovedCatalogServicesModal: () => {
    const removed = getRemovedCatalogServices();
    const content = `
      <div style="margin-bottom:0.85rem; font-size:0.82rem; color:var(--text-muted);">
        Built-in catalog services hidden or deleted from active menus. Restore individually or restore all.
      </div>
      ${
        removed.length === 0
          ? `<div style="padding:1.75rem; text-align:center; color:var(--text-muted);">No removed catalog services.</div>`
          : `<div style="max-height:50vh; overflow-y:auto; border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
              <table class="data-table" style="font-size:0.82rem;">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Service Name</th>
                    <th style="text-align:right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${removed
                    .map(
                      r => `
                      <tr>
                        <td><span class="badge badge-neutral">${escHtml(r.category)}</span></td>
                        <td style="font-weight:700;">${escHtml(r.serviceName)}</td>
                        <td style="text-align:right;">
                          <button type="button" class="btn btn-success btn-sm" onclick="window.MJK.restoreRemovedCatalogService('${escAttrJs(r.category)}', '${escAttrJs(r.serviceName)}')">↺ Restore</button>
                        </td>
                      </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
      }
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:1rem;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openCategoryCatalogModal()">← Back to Directory</button>
        <div style="display:flex; gap:0.5rem;">
          ${removed.length > 0 ? `<button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.restoreAllCatalogServices()">↺ Restore All (${removed.length})</button>` : ''}
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.closeModal()">Close</button>
        </div>
      </div>
    `;
    openModal('Removed Catalog Services Archive', content, null);
  },

  restoreRemovedCatalogService: async (category, serviceName) => {
    try {
      await restoreRateChartServiceEntry(category, serviceName);
      showToast(`Restored "${serviceName}" (${category}) to Rate Chart & Official Directory.`, 'success');
      render();
      window.MJK.openRemovedCatalogServicesModal();
    } catch (err) {
      showToast(err?.message || 'Failed to restore catalog service.', 'danger');
    }
  },

  restoreAllCatalogServices: async () => {
    try {
      const res = await restoreAllRateChartServiceEntries();
      showToast(`Restored ${res.count || 0} service(s) to Rate Chart & Official Directory.`, 'success');
      render();
      window.MJK.openCategoryCatalogModal();
    } catch (err) {
      showToast(err?.message || 'Failed to restore catalog services.', 'danger');
    }
  },

  printServiceReceipt: (id, explicitReceiptId = null) => {
    const s = id ? getServiceById(id) : null;
    const targetReceiptId = explicitReceiptId || s?.receiptId || '';
    let receiptServices = targetReceiptId ? getServicesByReceiptId(targetReceiptId) : [];
    if (receiptServices.length === 0 && s) {
      receiptServices = [s];
    }
    if (receiptServices.length === 0) return;

    const primary = s || receiptServices[0];
    const displayReceiptId = targetReceiptId || primary.receiptId || primary.id;
    const customerObj = primary.customerId ? getCustomerById(primary.customerId) : null;
    const grandTotal = receiptServices.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
    const totalPaid = receiptServices.reduce((sum, item) => sum + (Number(item.paidAmount) || 0), 0);
    const totalDue = Math.max(0, grandTotal - totalPaid);

    const bodyHtml = buildServiceReceiptDocumentHtml(receiptServices, displayReceiptId, primary, customerObj);

    showA4PrintPdfPopup({
      title: `Service Receipt - ${displayReceiptId}`,
      subtitle: `${primary.customerName} · ${receiptServices.length} Service(s)`,
      bodyHtml,
      defaultFormat: 'a4-portrait',
      pdfConfig: {
        onDownload: (layoutOpts = {}) => {
          generateBwTablePdf({
            filename: `MUN_Receipt_${displayReceiptId}`,
            reportTitle: receiptServices.length > 1 ? `SERVICE RECEIPT (${receiptServices.length} SERVICES)` : 'SERVICE RECEIPT',
            docNumber: displayReceiptId,
            metaLine: `Customer: ${primary.customerName} (${primary.phone || '-'}) | Date: ${formatDate(primary.appDate)}`,
            headers: ['#', 'Service Name', 'Ref #', 'Status', 'Delivery', 'Amount'],
            rows: [
              ...receiptServices.map((item, idx) => [
                String(idx + 1),
                `${item.serviceName} (${item.category || '-'})`,
                item.refNumber || '-',
                item.status || '-',
                formatDate(item.deliveryDate),
                `Rs.${item.totalAmount || 0}`
              ]),
              ['', 'Grand Total', '', '', '', `Rs.${grandTotal}`],
              ['', 'Total in Words', numberToWords(grandTotal), '', '', ''],
              ['', 'Amount Paid', '', '', '', `Rs.${totalPaid}`],
              ['', 'Balance Due', '', '', '', `Rs.${totalDue}`],
              ...(totalDue > 0 ? [['', 'Balance Due in Words', numberToWords(totalDue), '', '', '']] : [])
            ],
            includeUpiBlock: true,
            includeLegalTerms: true,
            includeAcknowledgement: true,
            format: layoutOpts.format || 'a4',
            orientation: layoutOpts.orientation || 'portrait'
          });
        }
      }
    });
  },

  // 90-Day Follow-up & Case Management Actions
  setFollowupBucketFilter: (bucket) => {
    AppState.followupBucketFilter = bucket || 'all';
    render();
  },

  setFollowupSearchQuery: (q) => {
    AppState.followupSearchQuery = q || '';
    scheduleSearchRender();
  },

  exportFollowupReportAction: (periodType, format) => {
    const res = export90DayFollowupReport(periodType, format);
    if (res?.message) showToast(res.message, 'success');
  },

  openNewCase90DayModal: () => {
    const customers = getAllCustomers();
    const activeStaff = getAllUsers().filter(u => u.status === 'ACTIVE' && u.uid);
    const curU = getCurrentUser();
    const todayDate = getTodayDate();
    const nextAppId = previewNextApplicationId(todayDate);

    const content = `
      <form id="case-90d-form" onsubmit="window.MJK.handleCreate90DayCase(event)">
        <div style="padding:0.75rem; background:#f5f3ff; border:1px solid #c4b5fd; border-radius:var(--radius-md); margin-bottom:0.85rem;">
          <label class="form-label" style="font-size:0.76rem; color:#5b21b6;">⚡ Auto-Fetch Customer (Select Existing Customer)</label>
          <select id="c90-cust-select" class="form-control" onchange="window.MJK.handleAutoFetchFor90DayCase(this.value)">
            <option value="">-- Choose Customer (or enter details manually below) --</option>
            ${customers.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.name)} · ${escHtml(c.phone)} · ${escHtml(c.applicationId || c.id)}</option>`).join('')}
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Unique Application ID <span class="req">*</span></label>
            <input type="text" id="c90-appid" class="form-control font-mono" value="${escHtml(nextAppId)}" required oninput="this.dataset.edited='1'">
          </div>
          <div class="form-group">
            <label class="form-label">Registration Date <span class="req">*</span></label>
            <input type="date" id="c90-startdate" class="form-control" value="${todayDate}" required onchange="const ap=document.getElementById('c90-appid'); if(ap && ap.dataset.edited!=='1') ap.value=window.MJK.previewNextApplicationId(this.value);">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Customer Name <span class="req">*</span></label>
            <input type="text" id="c90-name" class="form-control" required placeholder="Customer Name">
          </div>
          <div class="form-group">
            <label class="form-label">Mobile Number <span class="req">*</span></label>
            <input type="tel" id="c90-phone" class="form-control" required placeholder="10-digit Mobile">
          </div>
        </div>

        ${renderSearchableServiceSelectorHtml('c90-services', {
          label: 'Select Scheme / Service (Search English or Bengali)',
          placeholder: 'Search service in English or Bengali (e.g. PAN, Ration, লক্ষ্মীর ভাণ্ডার)...',
          required: true,
          showBilling: true
        })}

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Village / Ward <span class="req">*</span></label>
            <input type="text" id="c90-village" class="form-control" required placeholder="Village or Municipal Ward (e.g. Mamudpur)">
          </div>
          <div class="form-group">
            <label class="form-label">Assigned Staff</label>
            <select id="c90-staff" class="form-control">
              ${activeStaff.map(u => `<option value="${escHtml(u.uid)}" ${(curU?.uid || '') === u.uid ? 'selected' : ''}>${escHtml(u.name)} (${escHtml(u.uid)})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Initial Application Note (Starts Non-Overwriting Timeline)</label>
          <textarea id="c90-note" class="form-control" rows="2" placeholder="Initial submission details, documents verified, portal reference..."></textarea>
        </div>

        <div style="font-size:0.75rem; color:#0f766e; background:#f0fdfa; border:1px solid #99f6e4; padding:0.55rem 0.75rem; border-radius:6px;">
          ✓ Automatically sets initial status to Submitted and generates the 90-day follow-up schedule with overdue alert tracking.
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.1rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Initialize 90-Day Case</button>
        </div>
      </form>
    `;
    openModal('Start New Application Case', content, null, 'modal-lg');
    setTimeout(() => {
      initSearchableServiceSelector('c90-services', { showBilling: true });
    }, 20);
  },

  handleAutoFetchFor90DayCase: (custId) => {
    const cust = getCustomerById(custId);
    if (!cust) return;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    setVal('c90-appid', previewNextApplicationId(document.getElementById('c90-startdate')?.value || getTodayDate()));
    setVal('c90-name', cust.name);
    setVal('c90-phone', cust.phone);
    setVal('c90-village', cust.villageOrWard || cust.village || '');
    setVal('c90-staff', cust.assignedStaff || cust.assignedStaffUid || '');
    const initialList = Array.isArray(cust.services) && cust.services.length
      ? cust.services
      : (cust.schemeName ? [cust.schemeName] : []);
    if (initialList.length) {
      setSelectedServicesState('c90-services', initialList);
    }
  },

  handleCreate90DayCase: async (e) => {
    e.preventDefault();
    try {
      const custId = document.getElementById('c90-cust-select')?.value || '';
      const startDate = document.getElementById('c90-startdate')?.value || getTodayDate();
      const selState = getSelectedServicesState('c90-services');
      if (selState.serviceNames.length === 0) {
        showToast('Please select at least one Service / Scheme.', 'warning');
        return;
      }
      const appEl = document.getElementById('c90-appid');
      const appId = (appEl?.dataset?.edited === '1' && appEl?.value?.trim())
        ? appEl.value.trim()
        : await allocateGlobalReference('CASE', { entityType: 'CASE' });

      const res = await createOrSyncFollowupCase({
        customerId: custId,
        applicationId: appId,
        startDate,
        customerName: document.getElementById('c90-name')?.value?.trim(),
        phone: document.getElementById('c90-phone')?.value?.trim(),
        schemeName: selState.serviceNames.join(', '),
        services: selState.serviceNames,
        serviceRateBreakdown: selState.services,
        totalAmount: selState.totalPayable,
        villageOrWard: document.getElementById('c90-village')?.value?.trim(),
        currentStatus: 'Submitted',
        assignedStaff: document.getElementById('c90-staff')?.value || '',
        initialNote: document.getElementById('c90-note')?.value?.trim(),
        forceNew: true
      });
      closeModal();
      showToast(`Application Case ${res.caseRecord.applicationId} created (Status: Submitted)!`, 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to create 90-day case.', 'danger');
    }
  },

  openFollowupModal: async (presetCaseOrCustId = '') => {
    const customers = getAllCustomers();
    const cases = getAllFollowupCases();
    const activeStaff = getAllUsers().filter(u => u.status === 'ACTIVE' && u.uid);

    let presetCase = presetCaseOrCustId ? (getFollowupCaseById(presetCaseOrCustId) || getFollowupCaseByCustomerId(presetCaseOrCustId)) : null;
    let presetCust = presetCase?.customerId ? getCustomerById(presetCase.customerId) : (presetCaseOrCustId ? getCustomerById(presetCaseOrCustId) : null);
    if (!presetCase && presetCust) {
      presetCase = await ensureFollowupCaseForCustomer(presetCust);
    }

    const prevNotes = Array.isArray(presetCase?.timeline) ? presetCase.timeline : [];

    const content = `
      <form id="followup-form" onsubmit="window.MJK.handleSaveFollowup(event)">
        <input type="hidden" id="flw-case-id" value="${escHtml(presetCase?.id || '')}">

        <!-- Auto-Fetch Lookup Bar -->
        <div style="padding:0.75rem; background:#f5f3ff; border:1px solid #c4b5fd; border-radius:var(--radius-md); margin-bottom:0.85rem;">
          <div class="form-row" style="margin-bottom:0.45rem;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:0.74rem; color:#5b21b6;">⚡ Quick Search (Customer ID / App ID / Mobile)</label>
              <div style="display:flex; gap:0.35rem;">
                <input type="text" id="flw-autofetch-query" class="form-control font-mono" style="height:36px;" placeholder="e.g. APP-2026-... or CUST-... or 98XXXXXXXX"
                  onkeydown="if(event.key==='Enter'){event.preventDefault();window.MJK.autoFetchFollowupByQuery();}">
                <button type="button" class="btn btn-violet btn-sm" onclick="window.MJK.autoFetchFollowupByQuery()">Auto-Fetch</button>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:0.74rem; color:#5b21b6;">Or Select Customer / Case <span class="req">*</span></label>
              <select id="flw-cust-id" class="form-control" style="height:36px;" required onchange="window.MJK.handleCustomerSelectInFollowup(this.value)">
                <option value="">-- Choose Customer / Case --</option>
                ${cases.map(cs => `<option value="${escHtml(cs.customerId || cs.id)}" data-caseid="${escHtml(cs.id)}" ${(presetCase?.id === cs.id) ? 'selected' : ''}>${escHtml(cs.customerName)} · ${escHtml(cs.applicationId)} · ${escHtml(cs.schemeName)}</option>`).join('')}
                ${customers.filter(c => !cases.some(cs => cs.customerId === c.id)).map(c => `<option value="${escHtml(c.id)}" ${presetCust?.id === c.id ? 'selected' : ''}>${escHtml(c.name)} (${escHtml(c.phone)}) · ${escHtml(c.applicationId || c.id)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div id="flw-autofetch-summary" style="font-size:0.76rem; color:#4c1d95; font-weight:600;">
            ${presetCase
              ? `Fetched: <strong>${escHtml(presetCase.customerName)}</strong> · App ID: <span class="font-mono">${escHtml(presetCase.applicationId)}</span> · Scheme: ${escHtml(presetCase.schemeName)} · Village/Ward: ${escHtml(presetCase.villageOrWard || '-')}`
              : 'Select or search a customer to auto-fetch Profile, Application ID, Scheme, Village/Ward &amp; Previous Timeline.'}
          </div>
        </div>

        <!-- Auto-Fetched Customer & Case Metadata -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Application ID</label>
            <input type="text" id="flw-appid" class="form-control font-mono" value="${escHtml(presetCase?.applicationId || presetCust?.applicationId || '')}" readonly style="background:var(--surface-alt);">
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" id="flw-phone" class="form-control" value="${escHtml(presetCase?.phone || presetCust?.phone || '')}" readonly style="background:var(--surface-alt);">
          </div>
          <div class="form-group">
            <label class="form-label">Scheme &amp; Village/Ward</label>
            <input type="text" id="flw-scheme-village" class="form-control" value="${escHtml(presetCase ? `${presetCase.schemeName || ''} (${presetCase.villageOrWard || '-'})` : '')}" readonly style="background:var(--surface-alt);">
          </div>
        </div>

        <!-- Read-Only Previous Notes (Non-Overwriting Guarantee) -->
        <div id="flw-prev-notes-box" style="margin-bottom:0.8rem; padding:0.65rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-alt); max-height:125px; overflow-y:auto;">
          <div style="font-size:0.71rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.3rem;">
            🔒 Previous Timeline Notes (Read-Only — Never Overwritten)
          </div>
          <div id="flw-prev-notes-list" style="display:flex; flex-direction:column; gap:0.25rem; font-size:0.75rem;">
            ${prevNotes.length > 0
              ? [...prevNotes].reverse().map(tl => `<div><strong>#${tl.entryNo} [Day ${tl.cycleDay ?? 0} · ${formatDate(tl.date)}]:</strong> ${escHtml(tl.note)} <span style="color:var(--text-muted);">(${escHtml(tl.newStatus)})</span></div>`).join('')
              : '<div style="color:var(--text-muted);">No previous notes yet. This entry will start Entry #1.</div>'}
          </div>
        </div>

        <!-- New Follow-up Entry Fields -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">90-Day Milestone <span class="req">*</span></label>
            <select id="flw-milestone" class="form-control">
              <option value="">Auto-detect Current Due Milestone</option>
              ${FOLLOWUP_CYCLE_DAYS.map(d => `<option value="${d}" ${presetCase?.nextMilestoneDay === d ? 'selected' : ''}>${escHtml(FOLLOWUP_MILESTONE_LABELS[d] || `Day ${d}`)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Follow-up Mode</label>
            <select id="flw-mode" class="form-control">
              ${FOLLOWUP_MODES.map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
              <label class="form-label" style="margin:0;">Update Current Status <span class="req">*</span></label>
              <button type="button" class="btn btn-outline btn-sm" style="padding:0.1rem 0.4rem; font-size:0.68rem;" onclick="window.MJK.openManageDynamicOptionsModal('followup_status', 'flw-status')" title="Manage Custom Statuses">+</button>
            </div>
            <select id="flw-status" class="form-control">
              ${getAdminOptionLabels('application_status', { activeOnly: true, includeValues: [presetCase?.currentStatus || 'Under Process'] }).map(st => `<option value="${escHtml(st)}" ${(presetCase?.currentStatus || 'Under Process') === st ? 'selected' : ''}>${escHtml(st)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Next Scheduled Follow-up Date</label>
            <input type="date" id="flw-date" class="form-control" value="${escHtml(presetCase?.nextFollowupDate || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Assigned Staff</label>
            <select id="flw-staff" class="form-control">
              ${activeStaff.map(u => `<option value="${escHtml(u.uid)}" ${(presetCase?.assignedStaff || '') === u.uid ? 'selected' : ''}>${escHtml(u.name)} (${escHtml(u.uid)})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">New Follow-up Note / Call Outcome <span class="req">*</span></label>
          <textarea id="flw-notes" class="form-control" rows="3" required placeholder="Enter call response, portal verification status, department update... (Appends sequentially without overwriting previous history)"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Next Action Required</label>
          <input type="text" id="flw-next-action" class="form-control" placeholder="e.g. Check portal status on Day 15 / Collect bank passbook copy">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.1rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">+ Append Follow-up Entry</button>
        </div>
      </form>
    `;

    openModal('Auto-Fetch Follow-up Entry (Non-Overwriting Timeline)', content, null, 'modal-lg');
  },

  autoFetchFollowupByQuery: async () => {
    const q = (document.getElementById('flw-autofetch-query')?.value || '').trim().toLowerCase();
    if (!q) {
      showToast('Enter Customer ID, Application ID, Phone, or Name to auto-fetch.', 'warning');
      return;
    }
    const cases = getAllFollowupCases();
    const matchedCase = cases.find(c =>
      (c.applicationId || '').toLowerCase() === q ||
      (c.customerId || '').toLowerCase() === q ||
      (c.phone || '').includes(q) ||
      (c.customerName || '').toLowerCase().includes(q)
    );
    if (matchedCase) {
      const sel = document.getElementById('flw-cust-id');
      if (sel) sel.value = matchedCase.customerId || matchedCase.id;
      window.MJK.populateFollowupAutofetchFields(matchedCase, matchedCase.customerId ? getCustomerById(matchedCase.customerId) : null);
      showToast(`Auto-fetched Case ${matchedCase.applicationId} (${matchedCase.customerName})`, 'success');
      return;
    }
    const cust = getAllCustomers().find(c =>
      (c.id || '').toLowerCase() === q ||
      (c.applicationId || '').toLowerCase() === q ||
      (c.phone || '').includes(q) ||
      (c.name || '').toLowerCase().includes(q)
    );
    if (cust) {
      const ensured = await ensureFollowupCaseForCustomer(cust);
      const sel = document.getElementById('flw-cust-id');
      if (sel) sel.value = cust.id;
      window.MJK.populateFollowupAutofetchFields(ensured, cust);
      showToast(`Auto-fetched Customer ${cust.name} (${cust.applicationId || cust.id})`, 'success');
      return;
    }
    showToast('No matching Customer or Application ID found.', 'warning');
  },

  handleCustomerSelectInFollowup: async (custOrCaseId) => {
    if (!custOrCaseId) return;
    let caseRec = getFollowupCaseById(custOrCaseId) || getFollowupCaseByCustomerId(custOrCaseId);
    const cust = getCustomerById(custOrCaseId) || (caseRec?.customerId ? getCustomerById(caseRec.customerId) : null);
    if (!caseRec && cust) {
      caseRec = await ensureFollowupCaseForCustomer(cust);
    }
    window.MJK.populateFollowupAutofetchFields(caseRec, cust);
  },

  populateFollowupAutofetchFields: (caseRec, cust) => {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('flw-case-id', caseRec?.id || '');
    setVal('flw-appid', caseRec?.applicationId || cust?.applicationId || '');
    setVal('flw-phone', caseRec?.phone || cust?.phone || '');
    setVal('flw-scheme-village', `${caseRec?.schemeName || cust?.schemeName || '-'} (${caseRec?.villageOrWard || cust?.villageOrWard || cust?.village || '-'})`);
    setVal('flw-date', caseRec?.nextFollowupDate || '');
    if (caseRec?.currentStatus) setVal('flw-status', caseRec.currentStatus);
    if (caseRec?.assignedStaff) setVal('flw-staff', caseRec.assignedStaff);
    if (caseRec?.nextMilestoneDay !== undefined) setVal('flw-milestone', String(caseRec.nextMilestoneDay));

    const sumEl = document.getElementById('flw-autofetch-summary');
    if (sumEl && (caseRec || cust)) {
      sumEl.innerHTML = `Fetched: <strong>${escHtml(caseRec?.customerName || cust?.name)}</strong> · App ID: <span class="font-mono">${escHtml(caseRec?.applicationId || cust?.applicationId)}</span> · Scheme: ${escHtml(caseRec?.schemeName || cust?.schemeName || '-')} · Village/Ward: ${escHtml(caseRec?.villageOrWard || cust?.villageOrWard || '-')}`;
    }

    const listEl = document.getElementById('flw-prev-notes-list');
    if (listEl) {
      const notes = Array.isArray(caseRec?.timeline) ? caseRec.timeline : [];
      listEl.innerHTML = notes.length > 0
        ? [...notes].reverse().map(tl => `<div><strong>#${tl.entryNo} [Day ${tl.cycleDay ?? 0} · ${formatDate(tl.date)}]:</strong> ${escHtml(tl.note)} <span style="color:var(--text-muted);">(${escHtml(tl.newStatus)})</span></div>`).join('')
        : '<div style="color:var(--text-muted);">No previous notes yet. This entry will start Entry #1.</div>';
    }
  },

  handleSaveFollowup: async (e) => {
    e.preventDefault();
    try {
      let caseId = document.getElementById('flw-case-id')?.value?.trim() || '';
      const custId = document.getElementById('flw-cust-id')?.value?.trim() || '';

      if (!caseId && custId) {
        const cust = getCustomerById(custId);
        const ensured = cust ? await ensureFollowupCaseForCustomer(cust) : getFollowupCaseById(custId);
        caseId = ensured?.id || '';
      }

      if (!caseId) {
        showToast('Please select or auto-fetch a Customer / Application first.', 'warning');
        return;
      }

      const milestoneVal = document.getElementById('flw-milestone')?.value;
      const res = await addTimelineFollowupEntry(caseId, {
        milestoneDay: milestoneVal !== '' && milestoneVal !== undefined ? Number(milestoneVal) : null,
        followupMode: document.getElementById('flw-mode')?.value || 'Phone Call',
        newStatus: document.getElementById('flw-status')?.value || undefined,
        nextFollowupDate: document.getElementById('flw-date')?.value || '',
        assignedStaff: document.getElementById('flw-staff')?.value || '',
        note: document.getElementById('flw-notes')?.value || '',
        nextAction: document.getElementById('flw-next-action')?.value || ''
      });

      if (!res?.success) {
        showToast(res?.message || 'Could not append follow-up entry.', 'danger');
        return;
      }

      closeModal();
      showToast(`Appended Timeline Entry #${res.entry.entryNo} to ${res.caseRecord.applicationId} (Previous notes preserved)!`, 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save follow-up entry.', 'danger');
    }
  },

  promptDeleteFollowupCase: (caseId) => {
    if (!canMenu('followups', 'delete')) {
      showToast('Permission Denied: Delete permission required.', 'danger');
      return;
    }
    showConfirmDialog('Delete 90-Day Case?', 'Remove this 90-day follow-up case and its schedule from the tracker.', () => {
      deleteFollowupCase(caseId);
      showToast('90-day follow-up case deleted.', 'info');
      render();
    });
  },

  quickCompleteFollowup: (id) => {
    updateFollowupStatus(id, 'Completed', 'Customer contacted and action settled at MUN COMPUTER.');
    showToast('Follow-up marked as completed!', 'success');
    render();
  },

  openRescheduleModal: (id) => {
    const content = `
      <div class="form-group">
        <label class="form-label">New Follow-up Date <span class="req">*</span></label>
        <input type="date" id="resched-date" class="form-control" value="${getTodayDate()}">
      </div>
      <div class="form-group">
        <label class="form-label">New Time</label>
        <input type="text" id="resched-time" class="form-control" value="03:00 PM">
      </div>
      <div class="form-group">
        <label class="form-label">Reschedule Reason</label>
        <input type="text" id="resched-reason" class="form-control" placeholder="e.g. Customer requested callback tomorrow">
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
        <button class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.MJK.submitReschedule('${id}')">Save Reschedule</button>
      </div>
    `;
    openModal('Reschedule Follow-up', content, null);
  },

  submitReschedule: (id) => {
    const date = document.getElementById('resched-date').value;
    const time = document.getElementById('resched-time').value;
    const reason = document.getElementById('resched-reason').value;
    rescheduleFollowup(id, date, time, reason);
    closeModal();
    showToast(`Rescheduled to ${formatDate(date)}`, 'info');
    render();
  },

  promptDeleteFollowup: (id) => {
    showConfirmDialog('Delete Follow-up?', 'Remove this follow-up reminder from the tracker.', () => {
      deleteFollowup(id);
      showToast('Follow-up deleted.', 'info');
      render();
    });
  },

  // Payment Actions
  openPaymentModal: () => {
    const customers = getAllCustomers();
    const services = getAllServices();
    const upi = getUpiPaymentSettings();

    const content = `
      <form id="payment-form" onsubmit="window.MJK.handleSavePayment(event)">
        <div class="form-row">
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
              <label class="form-label" style="margin:0;">Customer <span class="req">*</span></label>
              <button type="button" class="btn btn-sm" style="background:#16a34a; color:#fff; padding:0.18rem 0.55rem; font-size:0.72rem; font-weight:700;" onclick="window.MJK.openBillingModalWhatsApp('payment')">💬 WhatsApp Connect</button>
            </div>
            <select id="pay-cust-id" class="form-control" required>
              <option value="">-- Choose Customer --</option>
              ${customers.map(c => `<option value="${c.id}">${escHtml(c.name)} (${escHtml(c.phone)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Payment Mode <span class="req">*</span></label>
            <select id="pay-method" class="form-control" required onchange="window.MJK.onPaymentMethodChange(this.value)">
              ${PAYMENT_METHODS.map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div id="pay-upi-qr-box" style="display:none; margin-bottom:0.85rem; padding:0.75rem; border:1px solid var(--border-strong); border-radius:var(--radius-md); background:var(--surface-alt);">
          <div style="font-size:0.78rem; font-weight:800; margin-bottom:0.4rem;">ONLINE PAYMENT – UPI (Admin Configured)</div>
          <div style="display:flex; gap:0.85rem; align-items:center; flex-wrap:wrap;">
            ${upi.qrImageDataUrl ? `<img src="${escHtml(upi.qrImageDataUrl)}" alt="UPI QR" style="width:92px; height:92px; object-fit:contain; border:1px solid #000; background:#fff; padding:3px;">` : '<div style="font-size:0.76rem; padding:8px; border:1px dashed var(--border-strong);">No Admin QR uploaded yet.</div>'}
            <div style="font-size:0.8rem; line-height:1.45;">
              <div><strong>UPI ID:</strong> <span class="font-mono">${escHtml(upi.upiId || 'Not configured')}</span></div>
              <div><strong>Payment Name:</strong> ${escHtml(upi.upiDisplayName || 'Not configured')}</div>
              <div style="font-size:0.73rem; color:var(--text-muted); margin-top:2px;">Displaying QR does NOT mark payment Paid. Confirm UTR or verify receipt below.</div>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Payment Amount (₹) <span class="req">*</span></label>
            <input type="number" id="pay-amount" class="form-control font-mono" required min="1" step="any" placeholder="Amount received" oninput="window.MJK.syncAmountWords(this, 'pay-amount-words')">
            <div id="pay-amount-words" class="amount-words-hint" style="display:none;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Payment Date</label>
            <input type="date" id="pay-date" class="form-control" value="${getTodayDate()}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Related Service (Optional)</label>
            <select id="pay-srv-id" class="form-control">
              <option value="">-- None / General Collection --</option>
              ${services.map(s => `<option value="${s.id}">${escHtml(s.serviceName)} (${escHtml(s.customerName)} - Due: ${formatINR(s.dueAmount)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Transaction ID / UTR Number</label>
            <input type="text" id="pay-ref" class="form-control font-mono" placeholder="UTR / UPI Ref / Cash Counter Ref">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Remarks</label>
          <input type="text" id="pay-remarks" class="form-control" placeholder="e.g. Service billing payment at MUN COMPUTER">
        </div>

        <div id="pay-verify-wrap" style="display:none; padding:0.65rem 0.8rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-alt); margin-bottom:0.75rem;">
          <label style="display:flex; align-items:flex-start; gap:0.5rem; font-size:0.8rem; cursor:pointer; margin:0;">
            <input type="checkbox" id="pay-verified-chk" style="margin-top:3px;">
            <span><strong>Payment Verified &amp; Confirmed</strong> (I have verified bank credit / UTR settlement. Leave unchecked if QR was scanned and confirmation is still pending.)</span>
          </label>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Record Payment</button>
        </div>
      </form>
    `;

    openModal('Record Payment Collection (MUN COMPUTER)', content, null);
  },

  onPaymentMethodChange: (mode) => {
    const isDigital = /upi|qr|bank|card/i.test(String(mode || ''));
    const qrBox = document.getElementById('pay-upi-qr-box');
    const verWrap = document.getElementById('pay-verify-wrap');
    if (qrBox) qrBox.style.display = /upi|qr/i.test(String(mode || '')) ? 'block' : 'none';
    if (verWrap) verWrap.style.display = isDigital ? 'block' : 'none';
  },

  collectDueForCustomer: (custId, totalDue) => {
    window.MJK.openCashCollectionModal(custId || '', '');
  },

  handleSavePayment: async (e) => {
    e.preventDefault();
    try {
      if (!canMenu('payments', 'add')) {
        showToast('Permission Denied: You cannot record payments.', 'danger');
        return;
      }
      const custId = document.getElementById('pay-cust-id').value;
      const cust = getCustomerById(custId);
      const amount = Number(document.getElementById('pay-amount').value);
      const paymentMethod = document.getElementById('pay-method').value;
      const reference = (document.getElementById('pay-ref')?.value || '').trim();
      const isDigital = /upi|qr|bank|card/i.test(String(paymentMethod || ''));
      const isConfirmed = isDigital ? Boolean(document.getElementById('pay-verified-chk')?.checked) : true;

      if (isDigital && isConfirmed && !reference) {
        showToast('Please enter the verified Transaction ID / UTR Number before marking digital payment Paid.', 'warning');
        return;
      }

      const cashLimit = getCashOperationLimit();
      if (String(paymentMethod).toLowerCase().includes('cash') && cashLimit > 0 && amount > cashLimit) {
        showToast(`Cash Operation Limit Exceeded: Your limit is ${formatINR(cashLimit)} per transaction.`, 'danger');
        return;
      }

      const data = {
        customerId: custId,
        customerName: cust ? cust.name : 'Customer',
        customerPhone: cust?.phone || '',
        paymentMethod,
        paymentAmount: amount,
        paymentDate: document.getElementById('pay-date').value,
        serviceId: document.getElementById('pay-srv-id').value,
        transactionId: reference,
        reference,
        remarks: document.getElementById('pay-remarks').value,
        verified: isConfirmed,
        operatorConfirmed: isConfirmed,
        receivedBy: getCurrentUser()?.name || 'Staff',
        verifiedBy: isConfirmed ? (getCurrentUser()?.name || 'Staff') : ''
      };

      const res = await recordPayment(data);
      if (!res?.success) {
        showToast(res?.message || 'Unable to record payment.', 'danger');
        return;
      }
      closeModal();
      showToast(
        isConfirmed
          ? `Verified payment of ${formatINR(amount)} recorded at MUN COMPUTER.`
          : `Payment logged as Pending Verification (${res.payment?.id}). Confirm UTR to mark Paid.`,
        isConfirmed ? 'success' : 'info'
      );
      EnterpriseExt.refreshUniversalSearchIfActive();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to record payment.', 'danger');
    }
  },

  openVerifyPaymentModal: (paymentId) => {
    const p = getAllPayments().find(x => x.id === paymentId);
    if (!p) return;
    const content = `
      <form onsubmit="window.MJK.handleVerifyPayment(event, '${escAttrJs(p.id)}')">
        <div style="margin-bottom:0.85rem; font-size:0.84rem; padding:0.75rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
          <div><strong>Payment ID:</strong> <span class="font-mono">${escHtml(p.id)}</span></div>
          <div><strong>Customer:</strong> ${escHtml(p.customerName)} · <strong>Amount:</strong> ${formatINR(p.paymentAmount)}</div>
          <div><strong>Mode:</strong> ${escHtml(p.paymentMethod)}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Verified Transaction ID / UTR Number <span class="req">*</span></label>
          <input type="text" id="verify-utr-input" class="form-control font-mono" required value="${escHtml(String(p.transactionId || '').startsWith('PEND-') ? '' : (p.transactionId || ''))}" placeholder="Enter 12-digit UTR / Bank Ref">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.15rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">✓ Confirm &amp; Mark Verified</button>
        </div>
      </form>
    `;
    openModal(`Verify Payment (${p.id})`, content, null);
  },

  handleVerifyPayment: (e, paymentId) => {
    e.preventDefault();
    const utrNumber = document.getElementById('verify-utr-input')?.value?.trim() || '';
    const res = verifyPendingPayment(paymentId, {
      utrNumber,
      verifiedBy: getCurrentUser()?.name || getCurrentUser()?.uid || 'Admin'
    });
    if (!res.success) {
      showToast(res.message || 'Verification failed.', 'danger');
      return;
    }
    closeModal();
    showToast(`Payment ${paymentId} verified (UTR: ${utrNumber}).`, 'success');
    render();
  },

  openRefundPaymentModal: (paymentId) => {
    const p = getAllPayments().find(x => x.id === paymentId);
    if (!p) return;
    const content = `
      <form onsubmit="window.MJK.handleRefundPayment(event, '${escAttrJs(p.id)}')">
        <div style="margin-bottom:0.85rem; font-size:0.84rem; padding:0.75rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
          <div><strong>Payment ID:</strong> <span class="font-mono">${escHtml(p.id)}</span></div>
          <div><strong>Customer:</strong> ${escHtml(p.customerName)} · <strong>Paid:</strong> ${formatINR(p.paymentAmount)}</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Refund Amount (₹) <span class="req">*</span></label>
            <input type="number" id="refund-amt" class="form-control font-mono" required min="1" max="${Number(p.paymentAmount) || 0}" step="any" value="${Number(p.paymentAmount) || 0}">
          </div>
          <div class="form-group">
            <label class="form-label">Refund Mode</label>
            <select id="refund-mode" class="form-control">
              ${PAYMENT_METHODS.map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Refund Reference / UTR</label>
          <input type="text" id="refund-ref" class="form-control font-mono" placeholder="Optional refund txn ref">
        </div>
        <div class="form-group">
          <label class="form-label">Refund Reason <span class="req">*</span></label>
          <input type="text" id="refund-reason" class="form-control" required placeholder="e.g. Service cancelled before submission">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.15rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Process Refund &amp; Issue Receipt</button>
        </div>
      </form>
    `;
    openModal(`Refund Payment (${p.id})`, content, null);
  },

  handleRefundPayment: async (e, paymentId) => {
    e.preventDefault();
    try {
      const res = await refundPayment(paymentId, {
        refundAmount: Number(document.getElementById('refund-amt')?.value) || 0,
        refundMode: document.getElementById('refund-mode')?.value || 'Cash',
        refundRef: document.getElementById('refund-ref')?.value || '',
        reason: document.getElementById('refund-reason')?.value || '',
        refundedBy: getCurrentUser()?.name || 'Admin'
      });
      if (!res?.success) {
        showToast(res?.message || 'Refund failed.', 'danger');
        return;
      }
      closeModal();
      showToast(`Refund ${res.refund?.id || ''} processed. Printing Refund Receipt.`, 'info');
      render();
      setTimeout(() => window.MJK.printPaymentReceipt(paymentId), 80);
    } catch (err) {
      showToast(err?.message || 'Failed to process refund.', 'danger');
    }
  },

  printPaymentReceipt: (id) => {
    const payments = getAllPayments();
    const p = payments.find(pay => pay.id === id);
    if (!p) return;
    const customerObj = p.customerId ? getCustomerById(p.customerId) : null;
    const isRefund = p.paymentStatus === 'Refunded';
    const docTitle = isRefund ? 'REFUND RECEIPT' : (p.collectionType === 'Instant Cash Collection' ? 'MONEY RECEIPT' : 'PAYMENT RECEIPT');
    const bodyHtml = buildPaymentReceiptDocumentHtml(p, customerObj);

    showA4PrintPdfPopup({
      title: `${docTitle} - ${isRefund ? (p.refundId || p.id) : p.id}`,
      subtitle: `${p.customerName} · ${formatINR(p.paymentAmount)}`,
      bodyHtml,
      defaultFormat: 'a5-receipt',
      pdfConfig: {
        onDownload: (layoutOpts = {}) => {
          generateBwTablePdf({
            filename: `MUN_Payment_${p.id}`,
            reportTitle: docTitle,
            docNumber: isRefund ? (p.refundId || p.id) : p.id,
            metaLine: `Customer: ${p.customerName} | Date: ${formatDate(p.paymentDate)} | Status: ${p.paymentStatus || 'Paid'}`,
            headers: ['Field', 'Particulars'],
            rows: [
              ['Received From', p.customerName || '-'],
              ['Payment Mode', p.paymentMethod || 'Cash'],
              ['Transaction ID / UTR', p.transactionId || '-'],
              ['Payment Status', p.paymentStatus || 'Paid'],
              ['Amount', `Rs.${isRefund ? (p.refundAmount || p.paymentAmount || 0) : (p.paymentAmount || 0)}`],
              ['Amount in Words', numberToWords(isRefund ? (p.refundAmount || p.paymentAmount || 0) : (p.paymentAmount || 0))],
              ...(Number(p.remainingDue) > 0 ? [['Outstanding Balance', `Rs.${p.remainingDue} (${numberToWords(p.remainingDue)})`]] : []),
              ['Remarks', p.remarks || 'Payment for services']
            ],
            includeUpiBlock: Number(p.remainingDue) > 0 || p.verificationStatus === 'PENDING_VERIFICATION',
            includeLegalTerms: true,
            includeAcknowledgement: true,
            format: layoutOpts.format || 'a5',
            orientation: layoutOpts.orientation || 'portrait'
          });
        }
      }
    });
  },

  printExpenseVoucher: (id) => {
    const exp = getAllExpenses().find(x => x.id === id);
    if (!exp) return;
    const voucherNo = exp.voucherNumber || exp.id;
    const bodyHtml = buildPaymentVoucherDocumentHtml(exp);
    showA4PrintPdfPopup({
      title: `Payment Voucher - ${voucherNo}`,
      subtitle: `${exp.title} · ${formatINR(exp.amount)}`,
      bodyHtml,
      defaultFormat: 'a5-receipt',
      pdfConfig: {
        onDownload: (layoutOpts = {}) => {
          generateBwTablePdf({
            filename: `MUN_Voucher_${voucherNo}`,
            reportTitle: 'PAYMENT VOUCHER',
            docNumber: voucherNo,
            metaLine: `Payee: ${exp.vendorName || '-'} | Date: ${formatDate(exp.date)} | Mode: ${exp.paymentMethod || 'Cash'}`,
            headers: ['Voucher Field', 'Details'],
            rows: [
              ['Voucher Number', voucherNo],
              ['Expense Category', exp.category || '-'],
              ['Particulars', exp.title || '-'],
              ['Payee / Vendor', exp.vendorName || '-'],
              ['Payment Mode', exp.paymentMethod || 'Cash'],
              ['Amount Paid', `Rs.${exp.amount || 0}`],
              ['Amount in Words', numberToWords(exp.amount || 0)],
              ['Remarks', exp.remarks || '-']
            ],
            includeUpiBlock: false,
            includeLegalTerms: false,
            includeAcknowledgement: true,
            format: layoutOpts.format || 'a5',
            orientation: layoutOpts.orientation || 'portrait'
          });
        }
      }
    });
  },

  printCustomerStatement: (customerId) => {
    const customer = getCustomerById(customerId);
    if (!customer) {
      showToast('Customer record not found.', 'warning');
      return;
    }
    const services = getAllServices().filter(s => s.customerId === customer.id || (customer.phone && s.phone === customer.phone));
    const payments = getAllPayments().filter(p => p.customerId === customer.id || (customer.phone && p.customerPhone === customer.phone));
    const invoices = getAllInvoices().filter(i => i.customerId === customer.id || (customer.phone && i.phone === customer.phone));
    const refunds = getAllRefunds().filter(r => r.customerId === customer.id);
    const bodyHtml = buildCustomerStatementDocumentHtml(customer, { services, payments, invoices, refunds });

    showA4PrintPdfPopup({
      title: `Customer Account Statement - ${customer.name}`,
      subtitle: `${customer.id} · ${customer.phone || '-'}`,
      bodyHtml,
      defaultFormat: 'a4-portrait',
      pdfConfig: {
        onDownload: (layoutOpts = {}) => {
          generateBwTablePdf({
            filename: `MUN_Statement_${customer.id}`,
            reportTitle: 'CUSTOMER ACCOUNT STATEMENT',
            docNumber: customer.id,
            metaLine: `Customer: ${customer.name} (${customer.phone || '-'})`,
            headers: ['Date', 'Ref #', 'Type', 'Particulars', 'Amount'],
            rows: [
              ...services.map(s => [formatDate(s.appDate), s.receiptId || s.id, 'Service', s.serviceName, `Rs.${s.totalAmount || 0}`]),
              ...invoices.map(i => [formatDate(i.date), i.id, i.documentType || 'Invoice', (i.items || []).map(x => x.desc).join(', '), `Rs.${i.totalAmount || 0}`]),
              ...payments.map(p => [formatDate(p.paymentDate), p.id, `Payment (${p.paymentMethod})`, `${p.paymentStatus || 'Paid'} · ${p.transactionId || ''}`, `Rs.${p.paymentAmount || 0}`])
            ],
            includeUpiBlock: true,
            includeLegalTerms: false,
            includeAcknowledgement: true,
            format: layoutOpts.format || 'a4',
            orientation: layoutOpts.orientation || 'portrait'
          });
        }
      }
    });
  },

  promptDeletePayment: (id) => {
    if (!canMenu('payments', 'delete')) {
      showToast('Permission Denied: You cannot delete payment records.', 'danger');
      return;
    }
    const pay = getAllPayments().find(x => x.id === id);
    showDeleteReasonDialog(
      'Delete Payment Record?',
      `Reverse payment ${id}${pay ? ` (${pay.customerName} · ${formatINR(pay.paymentAmount)})` : ''} in the audit ledger?`,
      async (reason) => {
        deletePayment(id);
        await logDeleteHistory({
          targetType: 'PAYMENT',
          targetId: id,
          targetSummary: pay ? `${pay.customerName} · ${formatINR(pay.paymentAmount)}` : id,
          reason
        });
        showToast('Payment record deleted & logged.', 'info');
        render();
      }
    );
  },

  buildInvoiceRatePickerOptionsHtml: (selectedId = '') => {
    const rateItems = getAllRateChartItems().filter(x => x.isActive !== false);
    return `
      <option value="">-- Choose Service to Auto-Fill Rate (₹) --</option>
      ${rateItems.map(r => {
        const shop = Math.max(0, Number(r.serviceCharge) || 0);
        const gov = Math.max(0, Number(r.govFee) || 0);
        const total = shop + gov;
        const breakdown = gov > 0 ? `Shop ₹${shop} + Govt ₹${gov} = ₹${total}` : `₹${total}`;
        return `<option value="${escHtml(r.id)}" ${selectedId === r.id ? 'selected' : ''}>${escHtml(r.category)} — ${escHtml(r.serviceName)} (${breakdown})</option>`;
      }).join('')}
    `;
  },

  // Invoice Actions
  openCreateInvoiceModal: () => {
    const customers = getAllCustomers();
    const content = `
      <form id="invoice-form" onsubmit="window.MJK.handleSaveInvoice(event)">
        <div class="form-row">
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
              <label class="form-label" style="margin:0;">Customer <span class="req">*</span></label>
              <button type="button" class="btn btn-sm" style="background:#16a34a; color:#fff; padding:0.18rem 0.55rem; font-size:0.72rem; font-weight:700;" onclick="window.MJK.openBillingModalWhatsApp('invoice')">💬 WhatsApp Connect</button>
            </div>
            <select id="inv-cust-id" class="form-control" required onchange="window.MJK.checkInvoiceMergeState()">
              <option value="">-- Choose Customer --</option>
              ${customers.map(c => `<option value="${c.id}">${escHtml(c.name)} (${escHtml(c.phone)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Document Type</label>
            <select id="inv-doc-type" class="form-control">
              ${INVOICE_DOCUMENT_TYPES.map(dt => `<option value="${escHtml(dt)}">${escHtml(dt)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Invoice Date</label>
            <input type="date" id="inv-date" class="form-control" value="${getTodayDate()}" onchange="window.MJK.checkInvoiceMergeState()">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Service Reference Number (Optional)</label>
            <input type="text" id="inv-service-ref" class="form-control font-mono" placeholder="e.g. 15NOV260001 / Ack #">
          </div>
          <div class="form-group">
            <label class="form-label">Browse Full Service Rate Chart</label>
            <select id="inv-rate-picker" class="form-control" onchange="window.MJK.applyInvoiceRateSelection(this.value)">
              ${window.MJK.buildInvoiceRatePickerOptionsHtml('')}
            </select>
          </div>
        </div>

        <!-- Barcode / SKU / QR Quick Scanner -->
        <div style="padding:0.75rem 0.9rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:0.85rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.4rem; flex-wrap:wrap;">
            <label for="inv-barcode-scan" class="form-label" style="margin:0; font-size:0.78rem; font-weight:800;">
              📷 Barcode / QR Quick Scan (Inventory SKU / Product Code / Rate Chart)
            </label>
            <span style="font-size:0.71rem; color:var(--text-muted);">Scan or type SKU &amp; press Enter to auto-add or increment Qty</span>
          </div>
          <div style="display:flex; gap:0.45rem; flex-wrap:wrap;">
            <input
              type="text"
              id="inv-barcode-scan"
              class="form-control font-mono"
              style="flex:1; min-width:210px;"
              placeholder="Scan barcode / SKU (e.g. MUN-SKU-001) or type item name & press Enter..."
              onkeydown="if(event.key==='Enter'){ event.preventDefault(); window.MJK.handleInvoiceBarcodeScan(this.value); }"
            >
            <button type="button" class="btn btn-primary btn-sm whitespace-nowrap" onclick="window.MJK.handleInvoiceBarcodeScan(document.getElementById('inv-barcode-scan')?.value || '')">
              ⚡ Scan &amp; Add Item
            </button>
          </div>
        </div>

        ${renderSearchableServiceSelectorHtml('inv-rate-search', {
          label: 'Search Service / Scheme (English or Bengali) to Auto-Add Billing Row',
          placeholder: 'Search service to auto-fill Shop Charge + Govt Fee row...',
          singleSelect: true,
          showBilling: false
        })}

        <div id="inv-merge-banner" style="display:none; margin-bottom:0.85rem; padding:0.7rem 0.85rem; background:var(--blue-50, #eff6ff); border:1px solid var(--blue-200, #bfdbfe); border-radius:var(--radius-md); font-size:0.79rem;"></div>

        <div style="border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.75rem; margin-bottom:0.85rem; background:var(--surface-alt);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <strong style="font-size:0.82rem;">Detailed Service &amp; Product Billing Rows</strong>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.addInvoiceItemRow()">+ Add Row</button>
          </div>
          <div class="table-responsive">
            <table class="data-table" style="font-size:0.8rem;">
              <thead>
                <tr>
                  <th style="width:34px;">#</th>
                  <th>Service / Item Name</th>
                  <th>Description / SKU</th>
                  <th style="width:72px;">Qty</th>
                  <th style="width:105px;">Rate (₹)</th>
                  <th style="width:95px; text-align:right;">Amount</th>
                  <th style="width:42px;"></th>
                </tr>
              </thead>
              <tbody id="inv-items-tbody">
                <tr class="inv-item-row">
                  <td class="inv-row-idx text-center">1</td>
                  <td><input type="text" class="form-control inv-row-service" placeholder="Service / Product Name" required></td>
                  <td><input type="text" class="form-control inv-row-desc" placeholder="Description / SKU"></td>
                  <td><input type="number" class="form-control font-mono tabular-nums inv-row-qty" value="1" min="1" oninput="window.MJK.checkInvoiceMergeState()"></td>
                  <td><input type="number" class="form-control font-mono tabular-nums inv-row-rate" value="" min="0" step="any" placeholder="0" required oninput="window.MJK.checkInvoiceMergeState()"></td>
                  <td class="inv-row-amt font-mono tabular-nums" style="text-align:right; font-weight:700;">₹0</td>
                  <td><button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.removeInvoiceItemRow(this)" title="Remove row">✕</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Discount (₹)</label>
            <input type="number" id="inv-discount" class="form-control font-mono tabular-nums" value="0" min="0" step="any" oninput="window.MJK.checkInvoiceMergeState()">
            <div id="inv-discount-words" class="amount-words-hint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">GST / Tax % (Optional)</label>
            <input type="number" id="inv-tax-rate" class="form-control font-mono tabular-nums" value="0" min="0" max="50" step="any" oninput="window.MJK.checkInvoiceMergeState()">
          </div>
          <div class="form-group">
            <label class="form-label">Settlement Mode</label>
            <select id="inv-pay-mode" class="form-control" onchange="window.MJK.onInvoicePaymentModeChange(this.value)">
              <option value="Split">Split Payment (Cash + UPI / Bank + Due)</option>
              <option value="Cash">Cash Only</option>
              <option value="UPI">UPI Only</option>
              <option value="QR Payment">QR Payment Only</option>
              <option value="Bank Transfer">Bank Transfer Only</option>
              <option value="Card Payment">Card Payment Only</option>
              <option value="Unpaid">Unpaid / Full Credit (Due)</option>
            </select>
          </div>
        </div>

        <!-- Multi-Payment Split Settlement Panel (Cash + UPI/Digital + Auto Due) -->
        <div style="padding:0.85rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:0.85rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem; flex-wrap:wrap; gap:0.4rem;">
            <strong style="font-size:0.82rem;">Multi-Payment Split Breakdown (Auto-Syncs Cash Drawer vs UPI Ledger)</strong>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.fillFullCashOrUpiInvoice('cash')">Full Cash</button>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Cash Paid (₹)</label>
              <input type="number" id="inv-paid-cash" class="form-control font-mono tabular-nums" value="0" min="0" step="any" oninput="window.MJK.recalcInvoiceSplitPayment()">
            </div>
            <div class="form-group">
              <label class="form-label">Digital Channel</label>
              <select id="inv-digital-mode" class="form-control" onchange="window.MJK.recalcInvoiceSplitPayment()">
                <option value="UPI">UPI Payment</option>
                <option value="QR Payment">QR Payment</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card Payment">Card Payment</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">UPI / Digital Paid (₹)</label>
              <input type="number" id="inv-paid-digital" class="form-control font-mono tabular-nums" value="0" min="0" step="any" oninput="window.MJK.recalcInvoiceSplitPayment()">
            </div>
            <div class="form-group">
              <label class="form-label">Total Paid Now (₹)</label>
              <input type="number" id="inv-paid" class="form-control font-mono tabular-nums" value="0" min="0" step="any" readonly style="font-weight:800; background:var(--surface);">
              <div id="inv-paid-words" class="amount-words-hint"></div>
            </div>
          </div>
          <div class="form-row" style="margin-top:0.25rem;">
            <div class="form-group" style="flex:1.4;">
              <label class="form-label">Transaction ID / UTR Number (If Digital &gt; ₹0)</label>
              <input type="text" id="inv-txn-id" class="form-control font-mono" placeholder="UTR / UPI / Bank Reference">
            </div>
            <div class="form-group" style="flex:1; display:flex; align-items:flex-end;">
              <div id="inv-split-due-pill" class="tabular-nums font-mono" style="width:100%; padding:0.5rem 0.75rem; border-radius:var(--radius-sm); background:var(--surface); border:1px solid var(--border-subtle); font-weight:800; font-size:0.84rem; text-align:right;">
                Balance Due: ₹0
              </div>
            </div>
          </div>
          <div id="inv-verify-wrap" style="display:none; margin-top:0.55rem; padding:0.55rem 0.75rem; border:1px solid var(--border-subtle); border-radius:var(--radius-sm); background:var(--surface);">
            <label style="display:flex; align-items:flex-start; gap:0.5rem; font-size:0.78rem; cursor:pointer; margin:0;">
              <input type="checkbox" id="inv-pay-verified" checked style="margin-top:3px;">
              <span><strong>Digital Payment Verified &amp; Confirmed</strong> (Confirm UTR/bank receipt before marking digital leg Paid)</span>
            </label>
          </div>
        </div>

        <div id="inv-live-words-summary" style="display:none; margin-top:0.5rem; padding:0.65rem 0.85rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); font-size:0.78rem;"></div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" id="inv-submit-btn" class="btn btn-primary">Generate MUN COMPUTER Bill</button>
        </div>
      </form>
    `;

    openModal('Generate MUN COMPUTER Invoice & POS Bill', content, null, 'modal-lg');
    setTimeout(() => {
      window.MJK.onInvoicePaymentModeChange('Split');
      window.MJK.checkInvoiceMergeState();
      initSearchableServiceSelector('inv-rate-search', {
        singleSelect: true,
        showBilling: false,
        onSelectItem: (item) => window.MJK.applyInvoiceRateItem(item)
      });
    }, 30);
  },

  addInvoiceItemRow: (serviceName = '', description = '', rate = '', sku = '') => {
    const tbody = document.getElementById('inv-items-tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.className = 'inv-item-row';
    if (sku) tr.dataset.sku = String(sku).toUpperCase();
    tr.innerHTML = `
      <td class="inv-row-idx text-center">${tbody.querySelectorAll('.inv-item-row').length + 1}</td>
      <td><input type="text" class="form-control inv-row-service" value="${escHtml(serviceName)}" placeholder="Service / Product Name" required></td>
      <td><input type="text" class="form-control inv-row-desc" value="${escHtml(description)}" placeholder="Description / SKU"></td>
      <td><input type="number" class="form-control font-mono tabular-nums inv-row-qty" value="1" min="1" oninput="window.MJK.checkInvoiceMergeState()"></td>
      <td><input type="number" class="form-control font-mono tabular-nums inv-row-rate" value="${escHtml(rate)}" min="0" step="any" placeholder="0" required oninput="window.MJK.checkInvoiceMergeState()"></td>
      <td class="inv-row-amt font-mono tabular-nums" style="text-align:right; font-weight:700;">₹0</td>
      <td><button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.removeInvoiceItemRow(this)" title="Remove row">✕</button></td>
    `;
    tbody.appendChild(tr);
    window.MJK.checkInvoiceMergeState();
  },

  handleInvoiceBarcodeScan: (rawQuery = '') => {
    const inputEl = document.getElementById('inv-barcode-scan');
    const q = String(rawQuery || inputEl?.value || '').trim();
    if (!q) {
      showToast('Scan or type a product SKU, Barcode, or Item name.', 'warning');
      inputEl?.focus();
      return;
    }
    const qLower = q.toLowerCase();
    const invItems = getAllInventory();
    const matchedInv =
      invItems.find(i => String(i.sku || '').trim().toLowerCase() === qLower || String(i.id || '').trim().toLowerCase() === qLower) ||
      invItems.find(i => String(i.name || i.itemName || '').trim().toLowerCase() === qLower) ||
      invItems.find(i =>
        String(i.sku || '').toLowerCase().includes(qLower) ||
        String(i.id || '').toLowerCase().includes(qLower) ||
        String(i.name || i.itemName || '').toLowerCase().includes(qLower)
      );

    let itemName = '';
    let itemDesc = '';
    let itemRate = 0;
    let itemSku = '';

    if (matchedInv) {
      itemSku = String(matchedInv.sku || matchedInv.id || '').toUpperCase();
      itemName = matchedInv.name || matchedInv.itemName || itemSku;
      itemRate = Number(matchedInv.sellingPrice ?? matchedInv.unitPrice ?? 0) || 0;
      const stock = Number(matchedInv.stockQuantity ?? matchedInv.quantity ?? matchedInv.stockQty ?? 0);
      itemDesc = `SKU: ${itemSku}${matchedInv.category ? ` · ${matchedInv.category}` : ''}`;
      if (stock <= 0) {
        showToast(`Low/Zero Stock Alert: "${itemName}" shows ${stock} in stock.`, 'warning');
      }
    } else {
      const rateItems = getAllRateChartItems().filter(r => r.isActive !== false);
      const matchedRate =
        rateItems.find(r => String(r.id || '').toLowerCase() === qLower || String(r.serviceName || '').toLowerCase() === qLower) ||
        rateItems.find(r => String(r.serviceName || '').toLowerCase().includes(qLower));
      if (!matchedRate) {
        showToast(`No product or service found matching "${q}".`, 'warning');
        inputEl?.select();
        return;
      }
      itemSku = String(matchedRate.id || '').toUpperCase();
      itemName = matchedRate.serviceName;
      itemRate = (Number(matchedRate.serviceCharge) || 0) + (Number(matchedRate.govFee) || 0);
      itemDesc = `${matchedRate.category || 'Rate Chart'} · Code: ${itemSku}`;
    }

    const rows = Array.from(document.querySelectorAll('#inv-items-tbody .inv-item-row'));
    const existingRow = rows.find(tr => {
      const rowSku = String(tr.dataset.sku || '').toUpperCase();
      const rowName = String(tr.querySelector('.inv-row-service')?.value || '').trim().toLowerCase();
      return (itemSku && rowSku === itemSku) || (rowName && rowName === itemName.toLowerCase());
    });

    if (existingRow) {
      const qtyEl = existingRow.querySelector('.inv-row-qty');
      if (qtyEl) qtyEl.value = String((Math.max(1, Number(qtyEl.value) || 1)) + 1);
      window.MJK.checkInvoiceMergeState();
      showToast(`Incremented Qty for ${itemName} (${itemSku}).`, 'success');
    } else {
      const emptyRow = rows.find(tr => !(tr.querySelector('.inv-row-service')?.value?.trim()) && !(Number(tr.querySelector('.inv-row-rate')?.value) > 0));
      if (emptyRow) {
        if (itemSku) emptyRow.dataset.sku = itemSku;
        emptyRow.querySelector('.inv-row-service').value = itemName;
        emptyRow.querySelector('.inv-row-desc').value = itemDesc;
        emptyRow.querySelector('.inv-row-rate').value = itemRate;
        window.MJK.checkInvoiceMergeState();
      } else {
        window.MJK.addInvoiceItemRow(itemName, itemDesc, itemRate, itemSku);
      }
      showToast(`Added ${itemName} (${formatINR(itemRate)}) to invoice.`, 'success');
    }

    if (inputEl) {
      inputEl.value = '';
      inputEl.focus();
    }
  },

  removeInvoiceItemRow: (btn) => {
    const tbody = document.getElementById('inv-items-tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('.inv-item-row');
    if (rows.length <= 1) {
      showToast('At least one service billing row is required.', 'warning');
      return;
    }
    btn.closest('.inv-item-row')?.remove();
    tbody.querySelectorAll('.inv-row-idx').forEach((cell, idx) => {
      cell.textContent = String(idx + 1);
    });
    window.MJK.checkInvoiceMergeState();
  },

  fillFullCashOrUpiInvoice: (kind = 'cash') => {
    const items = window.MJK.collectInvoiceRowsFromDom();
    const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    const disc = Math.max(0, Number(document.getElementById('inv-discount')?.value) || 0);
    const taxRate = Math.max(0, Number(document.getElementById('inv-tax-rate')?.value) || 0);
    const taxable = Math.max(0, subtotal - disc);
    const grand = Math.round((taxable + (taxable * taxRate) / 100) * 100) / 100;
    const cashEl = document.getElementById('inv-paid-cash');
    const digEl = document.getElementById('inv-paid-digital');
    if (kind === 'cash') {
      if (cashEl) cashEl.value = String(grand);
      if (digEl) digEl.value = '0';
    } else {
      if (cashEl) cashEl.value = '0';
      if (digEl) digEl.value = String(grand);
    }
    window.MJK.recalcInvoiceSplitPayment();
  },

  onInvoicePaymentModeChange: (mode) => {
    const cashEl = document.getElementById('inv-paid-cash');
    const digEl = document.getElementById('inv-paid-digital');
    const digModeEl = document.getElementById('inv-digital-mode');
    if (mode === 'Unpaid') {
      if (cashEl) cashEl.value = '0';
      if (digEl) digEl.value = '0';
    } else if (mode === 'Cash') {
      if (digEl) digEl.value = '0';
      if (cashEl && Number(cashEl.value || 0) === 0) window.MJK.fillFullCashOrUpiInvoice('cash');
    } else if (/upi|qr|bank|card/i.test(String(mode || ''))) {
      if (digModeEl) digModeEl.value = mode;
      if (cashEl) cashEl.value = '0';
      if (digEl && Number(digEl.value || 0) === 0) window.MJK.fillFullCashOrUpiInvoice('digital');
    }
    window.MJK.recalcInvoiceSplitPayment();
  },

  recalcInvoiceSplitPayment: () => {
    const cashEl = document.getElementById('inv-paid-cash');
    const digEl = document.getElementById('inv-paid-digital');
    const paidEl = document.getElementById('inv-paid');
    const verifyWrap = document.getElementById('inv-verify-wrap');
    const cashVal = Math.max(0, Number(cashEl?.value) || 0);
    const digVal = Math.max(0, Number(digEl?.value) || 0);
    const totalPaid = Math.round((cashVal + digVal) * 100) / 100;
    if (paidEl) paidEl.value = String(totalPaid);
    if (verifyWrap) verifyWrap.style.display = digVal > 0 ? 'block' : 'none';
    window.MJK.checkInvoiceMergeState();
  },

  collectInvoiceRowsFromDom: () => {
    const rows = Array.from(document.querySelectorAll('#inv-items-tbody .inv-item-row'));
    return rows.map((tr, idx) => {
      const serviceName = tr.querySelector('.inv-row-service')?.value?.trim() || '';
      const desc = tr.querySelector('.inv-row-desc')?.value?.trim() || '';
      const qty = Math.max(1, Number(tr.querySelector('.inv-row-qty')?.value) || 1);
      const rate = Math.max(0, Number(tr.querySelector('.inv-row-rate')?.value) || 0);
      const amount = qty * rate;
      const amtCell = tr.querySelector('.inv-row-amt');
      if (amtCell) amtCell.textContent = formatINR(amount);
      const idxCell = tr.querySelector('.inv-row-idx');
      if (idxCell) idxCell.textContent = String(idx + 1);
      return {
        sku: tr.dataset.sku || '',
        serviceName: serviceName || desc || `Service Item ${idx + 1}`,
        description: desc || serviceName,
        desc: desc ? `${serviceName}${serviceName && desc !== serviceName ? ` — ${desc}` : ''}` : (serviceName || `Service Item ${idx + 1}`),
        qty,
        unitPrice: rate,
        rate,
        amount
      };
    });
  },

  checkInvoiceMergeState: () => {
    const custId = document.getElementById('inv-cust-id')?.value || '';
    const invDate = document.getElementById('inv-date')?.value || getTodayDate();
    const banner = document.getElementById('inv-merge-banner');
    const submitBtn = document.getElementById('inv-submit-btn');
    const wordsSummaryEl = document.getElementById('inv-live-words-summary');
    const duePillEl = document.getElementById('inv-split-due-pill');

    const items = window.MJK.collectInvoiceRowsFromDom();
    const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    const discEl = document.getElementById('inv-discount');
    const taxEl = document.getElementById('inv-tax-rate');
    const paidEl = document.getElementById('inv-paid');

    if (discEl) syncAmountWords(discEl, 'inv-discount-words');
    if (paidEl) syncAmountWords(paidEl, 'inv-paid-words');

    const disc = Math.max(0, Number(discEl?.value) || 0);
    const taxRate = Math.max(0, Number(taxEl?.value) || 0);
    const taxable = Math.max(0, subtotal - disc);
    const taxAmount = Math.round(((taxable * taxRate) / 100) * 100) / 100;
    const newNet = Math.round((taxable + taxAmount) * 100) / 100;
    const cashPaid = Math.max(0, Number(document.getElementById('inv-paid-cash')?.value) || 0);
    const digitalPaid = Math.max(0, Number(document.getElementById('inv-paid-digital')?.value) || 0);
    const paidNow = Math.round((cashPaid + digitalPaid) * 100) / 100;
    if (paidEl) paidEl.value = String(paidNow);
    const itemDue = Math.max(0, Math.round((newNet - paidNow) * 100) / 100);

    if (duePillEl) {
      duePillEl.textContent = `Balance Due: ${formatINR(itemDue)}`;
      duePillEl.style.color = itemDue > 0 ? 'var(--danger)' : 'var(--success)';
    }

    if (wordsSummaryEl) {
      if (subtotal === 0 && paidNow === 0) {
        wordsSummaryEl.style.display = 'none';
        wordsSummaryEl.innerHTML = '';
      } else {
        wordsSummaryEl.style.display = 'block';
        wordsSummaryEl.innerHTML = `
          <div><strong>Subtotal:</strong> <span class="font-mono">${formatINR(subtotal)}</span>${taxAmount > 0 ? ` · <strong>Tax (${taxRate}%):</strong> <span class="font-mono">${formatINR(taxAmount)}</span>` : ''} · <strong>Grand Total:</strong> <span class="font-mono">${formatINR(newNet)}</span> (${escHtml(numberToWords(newNet))})</div>
          <div style="margin-top:0.15rem;"><strong>Cash:</strong> <span class="font-mono">${formatINR(cashPaid)}</span> · <strong>Digital:</strong> <span class="font-mono">${formatINR(digitalPaid)}</span> · <strong>Paid Total:</strong> <span class="font-mono">${formatINR(paidNow)}</span> · <strong>Balance Due:</strong> <span class="font-mono" style="color:${itemDue > 0 ? 'var(--danger)' : 'var(--success)'};">${formatINR(itemDue)}</span></div>
        `;
      }
    }
    if (!banner) return;

    const cust = custId ? getCustomerById(custId) : null;
    const openInv = findOpenInvoiceForCustomerDate(custId, cust?.phone || '', invDate);

    if (openInv) {
      const nextTotal = (Number(openInv.totalAmount) || 0) + newNet;
      const nextPaid = (Number(openInv.paidAmount) || 0) + paidNow;
      const nextDue = Math.max(0, nextTotal - nextPaid);

      banner.style.display = 'block';
      banner.innerHTML = `
        <div style="font-weight:700; color:var(--blue-700, #1d4ed8); margin-bottom:0.2rem;">
          Open Invoice Found on ${formatDate(invDate)} · <span class="font-mono">${escHtml(openInv.id)}</span>
        </div>
        <div style="color:var(--text-main);">
          Previous Total (${(openInv.items || []).length} item${(openInv.items || []).length > 1 ? 's' : ''}): <strong class="font-mono tabular-nums">${formatINR(openInv.totalAmount)}</strong> ·
          Paid: <strong class="font-mono tabular-nums">${formatINR(openInv.paidAmount)}</strong> ·
          Due: <strong class="font-mono tabular-nums">${formatINR(openInv.balanceDue)}</strong>
        </div>
        <div style="margin-top:0.2rem; font-weight:700; color:var(--text-main);">
          After Auto-Merge: Total <span class="font-mono tabular-nums">${formatINR(nextTotal)}</span> · Due <span class="font-mono tabular-nums">${formatINR(nextDue)}</span>
        </div>
      `;
      if (submitBtn) submitBtn.textContent = `Append & Merge into ${openInv.id}`;
    } else {
      banner.style.display = 'none';
      banner.innerHTML = '';
      if (submitBtn) submitBtn.textContent = 'Generate MUN COMPUTER Bill';
    }
  },

  applyInvoiceRateItem: (item) => {
    if (!item) return;
    const shop = Math.max(0, Number(item.serviceCharge) || 0);
    const gov = Math.max(0, Number(item.govFee) || 0);
    const total = shop + gov;
    const descText = gov > 0
      ? `${item.category} · Shop ₹${shop} + Govt ₹${gov}`
      : `${item.category}`;

    const rows = Array.from(document.querySelectorAll('#inv-items-tbody .inv-item-row'));
    const emptyRow = rows.find(tr => !(tr.querySelector('.inv-row-service')?.value?.trim()) && !(Number(tr.querySelector('.inv-row-rate')?.value) > 0));
    if (emptyRow) {
      if (item.id) emptyRow.dataset.sku = String(item.id).toUpperCase();
      emptyRow.querySelector('.inv-row-service').value = item.name || item.serviceName;
      emptyRow.querySelector('.inv-row-desc').value = descText;
      emptyRow.querySelector('.inv-row-rate').value = total;
      window.MJK.checkInvoiceMergeState();
    } else {
      window.MJK.addInvoiceItemRow(item.name || item.serviceName, descText, total, item.id || '');
    }
  },

  applyInvoiceRateSelection: (rateId) => {
    if (!rateId) return;
    const item = getRateChartItemById(rateId);
    if (!item) return;
    window.MJK.applyInvoiceRateItem({ ...item, name: item.serviceName });
    const picker = document.getElementById('inv-rate-picker');
    if (picker) picker.value = '';
  },

  buildInvoiceWhatsAppMessage: (inv) => {
    const items = Array.isArray(inv.items) ? inv.items : [];
    const lines = items.map((it, idx) => {
      const qty = Number(it.qty) || 1;
      const rate = Number(it.unitPrice ?? it.rate) || 0;
      const amt = Number(it.amount) || (qty * rate);
      return `${idx + 1}. ${it.serviceName || it.desc || 'Service'} (${qty} x ₹${rate}) = ${formatINR(amt)}`;
    });
    const split = inv.paymentSplit && typeof inv.paymentSplit === 'object' ? inv.paymentSplit : null;
    const splitLine = split && (Number(split.cash) > 0 || Number(split.digital) > 0)
      ? `Payment Breakdown: ${Number(split.cash) > 0 ? `Cash ${formatINR(split.cash)}` : ''}${Number(split.cash) > 0 && Number(split.digital) > 0 ? ' + ' : ''}${Number(split.digital) > 0 ? `${split.digitalMode || 'UPI'} ${formatINR(split.digital)}` : ''}`
      : `Payment Mode: ${inv.paymentMode || 'Cash'}`;

    return [
      `*MUN COMPUTER & DIGITAL SERVICES*`,
      `Domkal, Murshidabad, WB - 742303`,
      `--------------------------------`,
      `Hello *${inv.customerName || 'Customer'}*,`,
      `Your ${inv.documentType || 'Invoice'} *${inv.id}* (${formatDate(inv.date)}) is ready:`,
      ...lines,
      Number(inv.discount) > 0 ? `Discount: -${formatINR(inv.discount)}` : '',
      Number(inv.taxAmount) > 0 ? `GST (${inv.taxPercent || 0}%): ${formatINR(inv.taxAmount)}` : '',
      `*Grand Total: ${formatINR(inv.totalAmount)}*`,
      `Paid Now: ${formatINR(inv.paidAmount)} (${splitLine})`,
      `*Balance Due: ${formatINR(inv.balanceDue)}*`,
      inv.transactionId ? `UTR / Ref: ${inv.transactionId}` : '',
      `--------------------------------`,
      `Thank you for choosing MUN COMPUTER! Helpdesk: +91 8101352105`
    ].filter(Boolean).join('\n');
  },

  sendInvoiceToWhatsApp: (id) => {
    const inv = getInvoiceById(id);
    if (!inv) {
      showToast('Invoice record not found.', 'warning');
      return;
    }
    const msg = window.MJK.buildInvoiceWhatsAppMessage(inv);
    const info = normalizeWhatsAppPhone(inv.phone);
    if (info.valid) {
      const url = buildWhatsAppUrl(inv.phone, msg);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Launching WhatsApp bill for ${inv.customerName} (${info.display}).`, 'success');
      return;
    }
    window.MJK.openWhatsAppConnectModal({
      phone: inv.phone || '',
      customerName: inv.customerName,
      serviceName: (inv.items || []).map(i => i.serviceName || i.desc).filter(Boolean).join(', ') || 'Invoice',
      refNumber: inv.id,
      status: inv.status,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      dueAmount: inv.balanceDue,
      context: 'BILLING',
      customMessage: msg
    });
  },

  openInvoicePostSaveModal: (invoiceId, wasMerged = false) => {
    const inv = getInvoiceById(invoiceId);
    if (!inv) return;
    const msg = window.MJK.buildInvoiceWhatsAppMessage(inv);
    const phoneInfo = normalizeWhatsAppPhone(inv.phone);
    const waUrl = phoneInfo.valid ? buildWhatsAppUrl(inv.phone, msg) : '';

    const html = `
      <div style="padding:0.25rem 0;">
        <div style="padding:0.9rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">${wasMerged ? 'Merged & Updated Invoice' : 'Invoice Generated Successfully'}</div>
              <div class="font-mono" style="font-size:1.05rem; font-weight:800; color:var(--blue-600);">${escHtml(inv.id)}</div>
            </div>
            <span class="badge ${inv.status === 'Paid' ? 'badge-success' : inv.status === 'Partially Paid' ? 'badge-warning' : 'badge-danger'}">${escHtml(inv.status)}</span>
          </div>
          <div style="margin-top:0.65rem; font-size:0.84rem; display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:0.5rem;">
            <div><strong>Customer:</strong> ${escHtml(inv.customerName)}</div>
            <div><strong>Grand Total:</strong> <span class="font-mono tabular-nums">${formatINR(inv.totalAmount)}</span></div>
            <div><strong>Paid:</strong> <span class="font-mono tabular-nums" style="color:var(--success);">${formatINR(inv.paidAmount)}</span></div>
            <div><strong>Due:</strong> <span class="font-mono tabular-nums" style="color:${inv.balanceDue > 0 ? 'var(--danger)' : 'var(--success)'};">${formatINR(inv.balanceDue)}</span></div>
          </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:0.6rem; justify-content:center;">
          <button type="button" class="btn btn-primary" onclick="window.MJK.closeModal(); window.MJK.printInvoiceThermal('${escAttrJs(inv.id)}')">
            🧾 Print Thermal POS Receipt (80mm)
          </button>
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal(); window.MJK.printInvoice('${escAttrJs(inv.id)}')">
            🖨 View A4 Invoice / PDF
          </button>
          ${waUrl ? `
            <a href="${escHtml(waUrl)}" target="_blank" rel="noopener noreferrer" class="btn" style="background:#16a34a; color:#ffffff; border:1px solid #15803d; font-weight:700; text-decoration:none;">
              📲 Send to WhatsApp
            </a>
          ` : `
            <button type="button" class="btn" style="background:#16a34a; color:#ffffff; border:1px solid #15803d; font-weight:700;" onclick="window.MJK.closeModal(); window.MJK.sendInvoiceToWhatsApp('${escAttrJs(inv.id)}')">
              📲 Send to WhatsApp
            </button>
          `}
        </div>
      </div>
    `;
    openModal('Invoice Ready — Print or Share', html, null);
  },

  handleSaveInvoice: async (e) => {
    e.preventDefault();
    try {
      const custId = document.getElementById('inv-cust-id').value;
      const cust = getCustomerById(custId);
      const items = window.MJK.collectInvoiceRowsFromDom().filter(it => it.serviceName || it.rate > 0);
      if (items.length === 0) {
        showToast('Add at least one service or product billing row.', 'warning');
        return;
      }

      const cashPaid = Math.max(0, Number(document.getElementById('inv-paid-cash')?.value) || 0);
      const digitalPaid = Math.max(0, Number(document.getElementById('inv-paid-digital')?.value) || 0);
      const digitalMode = document.getElementById('inv-digital-mode')?.value || 'UPI';
      const selectedMode = document.getElementById('inv-pay-mode')?.value || 'Split';
      const discount = Number(document.getElementById('inv-discount').value) || 0;
      const taxRate = Number(document.getElementById('inv-tax-rate')?.value) || 0;
      const transactionId = document.getElementById('inv-txn-id')?.value?.trim() || '';
      const isVerifiedDigital = digitalPaid > 0 ? Boolean(document.getElementById('inv-pay-verified')?.checked) : true;

      if (digitalPaid > 0 && isVerifiedDigital && !transactionId) {
        showToast('Enter Transaction ID / UTR Number for verified digital payment.', 'warning');
        return;
      }

      const effectiveDigitalPaid = (digitalPaid > 0 && !isVerifiedDigital) ? 0 : digitalPaid;
      const effectivePaid = Math.round((cashPaid + effectiveDigitalPaid) * 100) / 100;

      let resolvedMode = 'Unpaid';
      if (cashPaid > 0 && digitalPaid > 0) resolvedMode = `Split (Cash + ${digitalMode})`;
      else if (cashPaid > 0) resolvedMode = 'Cash';
      else if (digitalPaid > 0) resolvedMode = digitalMode;
      else if (selectedMode && selectedMode !== 'Split') resolvedMode = selectedMode;

      const subtotal = items.reduce((sum, item) => sum + (Number(item.qty || 1) * Number(item.unitPrice || item.rate || 0)), 0);
      const taxable = Math.max(0, subtotal - discount);
      const taxAmt = Math.round(((taxable * taxRate) / 100) * 100) / 100;
      const grandTotal = Math.round((taxable + taxAmt) * 100) / 100;
      const balanceDue = Math.max(0, Math.round((grandTotal - effectivePaid) * 100) / 100);

      const data = {
        customerId: custId,
        customerName: cust ? cust.name : 'Customer',
        phone: cust ? cust.phone : '',
        address: cust ? (cust.address || `${cust.village || ''}, ${cust.district || ''}`) : '',
        documentType: document.getElementById('inv-doc-type')?.value || 'Service Invoice',
        serviceRefNumber: document.getElementById('inv-service-ref')?.value?.trim() || '',
        date: document.getElementById('inv-date').value,
        discount,
        taxRate,
        paidAmount: effectivePaid,
        paymentMode: resolvedMode,
        transactionId,
        paymentSplit: {
          cash: cashPaid,
          digital: digitalPaid,
          digitalMode,
          utr: transactionId,
          due: balanceDue,
          verifiedDigital: isVerifiedDigital
        },
        items
      };

      const res = await saveInvoice(data);
      if (!res?.success) {
        showToast(res?.message || 'Unable to generate invoice.', 'danger');
        return;
      }

      // Record separate Day Book & Payment Ledger legs so Cash Drawer vs UPI/Bank reconcile accurately
      if (cashPaid > 0 && res?.invoice) {
        await recordPayment({
          customerId: custId,
          customerName: data.customerName,
          customerPhone: data.phone,
          invoiceId: res.invoice.id,
          receiptId: res.invoice.id,
          skipInvoiceSync: true,
          paymentMethod: 'Cash',
          paymentAmount: cashPaid,
          paymentDate: data.date,
          transactionId: '',
          remarks: `Cash leg for ${res.invoice.id}`,
          verified: true,
          operatorConfirmed: true,
          receivedBy: getCurrentUser()?.name || 'Staff',
          verifiedBy: getCurrentUser()?.name || 'Staff'
        });
      }
      if (digitalPaid > 0 && res?.invoice) {
        await recordPayment({
          customerId: custId,
          customerName: data.customerName,
          customerPhone: data.phone,
          invoiceId: res.invoice.id,
          receiptId: res.invoice.id,
          skipInvoiceSync: true,
          paymentMethod: digitalMode,
          paymentAmount: digitalPaid,
          paymentDate: data.date,
          transactionId,
          remarks: isVerifiedDigital ? `${digitalMode} leg for ${res.invoice.id}` : `Pending verification (${digitalMode}) for ${res.invoice.id}`,
          verified: isVerifiedDigital,
          operatorConfirmed: isVerifiedDigital,
          receivedBy: getCurrentUser()?.name || 'Staff',
          verifiedBy: isVerifiedDigital ? (getCurrentUser()?.name || 'Staff') : ''
        });
      }

      closeModal();
      if (res?.merged && res?.invoice) {
        showToast(`Merged into existing Invoice ${res.invoice.id} · Consolidated Total: ${formatINR(res.invoice.totalAmount)} (Due: ${formatINR(res.invoice.balanceDue)})`, 'success');
      } else {
        showToast(`Invoice ${res?.invoice?.id || ''} generated for MUN COMPUTER.`, 'success');
      }
      EnterpriseExt.refreshUniversalSearchIfActive();
      render();
      if (res?.invoice?.id) {
        setTimeout(() => window.MJK.openInvoicePostSaveModal(res.invoice.id, Boolean(res.merged)), 50);
      }
    } catch (err) {
      showToast(err?.message || 'Failed to save invoice.', 'danger');
    }
  },

  printInvoiceThermal: (id) => {
    window.MJK.printInvoice(id, { defaultFormat: 'thermal-80mm' });
  },

  printInvoice: (id, opts = {}) => {
    const inv = getInvoiceById(id);
    if (!inv) return;
    const standardHtml = buildInvoiceDocumentHtml(inv);
    const thermalHtml = buildThermalInvoiceReceiptHtml(inv);
    const defaultFormat = opts?.defaultFormat || 'a4-portrait';
    const docType = inv.documentType || 'SERVICE INVOICE';
    const taxAmt = Number(inv.taxAmount ?? inv.tax) || 0;
    const taxPct = Number(inv.taxPercent ?? inv.taxRate) || 0;
    const waMsg = window.MJK.buildInvoiceWhatsAppMessage(inv);
    const waUrl = buildWhatsAppUrl(inv.phone, waMsg);
    const extraToolbarHtml = waUrl
      ? `<a href="${escHtml(waUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background:#16a34a; color:#ffffff; border:1px solid #15803d; font-weight:700; text-decoration:none;">📲 Send to WhatsApp</a>`
      : `<button type="button" class="btn btn-sm" style="background:#16a34a; color:#ffffff; border:1px solid #15803d; font-weight:700;" onclick="window.MJK.sendInvoiceToWhatsApp('${escAttrJs(inv.id)}')">📲 Send to WhatsApp</button>`;

    showA4PrintPdfPopup({
      title: `${docType} ${inv.id} - MUN COMPUTER`,
      subtitle: `${inv.customerName} · ${formatINR(inv.totalAmount)}`,
      bodyHtml: defaultFormat === 'thermal-80mm' ? thermalHtml : standardHtml,
      alternateBodies: {
        standard: standardHtml,
        'thermal-80mm': thermalHtml
      },
      extraToolbarHtml,
      defaultFormat,
      pdfConfig: {
        onDownload: (layoutOpts = {}) => {
          generateBwTablePdf({
            filename: `MUN_Invoice_${inv.id}`,
            reportTitle: `${String(docType).toUpperCase()} - ${inv.id}`,
            docNumber: inv.id,
            statusText: inv.status || 'FINAL',
            metaLine: `Customer: ${inv.customerName} (${inv.phone || '-'}) | Date: ${formatDate(inv.date)} | Status: ${inv.status}`,
            headers: ['#', 'Service / Description', 'Qty', 'Rate', 'Amount'],
            rows: [
              ...(inv.items || []).map((item, idx) => [
                String(idx + 1),
                item.serviceName ? `${item.serviceName}${item.description && item.description !== item.serviceName ? ` (${item.description})` : ''}` : (item.desc || '-'),
                String(item.qty || 1),
                `Rs.${Number(item.unitPrice || item.rate || 0)}`,
                `Rs.${Number(item.amount || 0)}`
              ]),
              ...(Number(inv.discount) > 0 ? [['', 'Discount', '', '', `-Rs.${Number(inv.discount)}`]] : []),
              ...(taxAmt > 0 ? [['', `GST / Tax (${taxPct}%)`, '', '', `Rs.${taxAmt}`]] : []),
              ['', 'Grand Total', '', '', `Rs.${Number(inv.totalAmount) || 0}`],
              ['', 'Amount in Words', numberToWords(inv.totalAmount || 0), '', ''],
              ['', 'Amount Paid', '', '', `Rs.${Number(inv.paidAmount) || 0}`],
              ['', 'Balance Due', '', '', `Rs.${Number(inv.balanceDue) || 0}`],
              ...(Number(inv.balanceDue) > 0 ? [['', 'Balance Due in Words', numberToWords(inv.balanceDue), '', '']] : [])
            ],
            includeUpiBlock: true,
            includeLegalTerms: true,
            includeAcknowledgement: true,
            format: layoutOpts.format || 'a4',
            orientation: layoutOpts.orientation || 'portrait'
          });
        }
      }
    });
  },

  promptDeleteInvoice: (id) => {
    if (!canMenu('invoices', 'delete')) {
      showToast('Permission Denied: You cannot delete invoices.', 'danger');
      return;
    }
    const inv = getInvoiceById(id);
    showDeleteReasonDialog(
      'Delete Invoice?',
      `Permanently delete invoice ${id}${inv ? ` (${inv.customerName} · ${formatINR(inv.totalAmount)})` : ''}?`,
      async (reason) => {
        deleteInvoice(id);
        await logDeleteHistory({
          targetType: 'INVOICE',
          targetId: id,
          targetSummary: inv ? `${inv.customerName} · ${formatINR(inv.totalAmount)}` : id,
          reason
        });
        showToast('Invoice deleted & logged.', 'info');
        render();
      }
    );
  },

  // Expense Actions
  openExpenseModal: (expenseId = null) => {
    const exp = expenseId ? getAllExpenses().find(e => e.id === expenseId) : null;
    const content = `
      <form id="expense-form" onsubmit="window.MJK.handleSaveExpense(event, '${expenseId || ''}')">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Expense Category <span class="req">*</span></label>
            <select id="exp-cat" class="form-control" required>
              ${EXPENSE_CATEGORIES.map(c => `<option value="${c}" ${exp && exp.category === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Expense Title <span class="req">*</span></label>
            <input type="text" id="exp-title" class="form-control" value="${exp ? exp.title : ''}" required placeholder="e.g. Shop Rent / Printer Ink / Electricity">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Amount (₹) <span class="req">*</span></label>
            <input type="number" id="exp-amount" class="form-control font-mono tabular-nums" min="0" step="any" value="${exp ? exp.amount : ''}" required placeholder="Amount spent" oninput="window.MJK.syncAmountWords(this, 'exp-amount-words')">
            <div id="exp-amount-words" class="amount-words-hint" style="display:none;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" id="exp-date" class="form-control" value="${exp ? exp.date : getTodayDate()}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Payment Method</label>
            <select id="exp-method" class="form-control">
              <option ${exp && exp.paymentMethod === 'Cash' ? 'selected' : ''}>Cash</option>
              <option ${exp && exp.paymentMethod === 'UPI' ? 'selected' : ''}>UPI</option>
              <option ${exp && exp.paymentMethod === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Vendor / Paid To</label>
            <input type="text" id="exp-vendor" class="form-control" value="${exp ? exp.vendorName : ''}" placeholder="Supplier or Landlord name">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Remarks</label>
          <input type="text" id="exp-remarks" class="form-control" value="${exp ? exp.remarks : ''}">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${expenseId ? 'Update Expense' : 'Save Expense'}</button>
        </div>
      </form>
    `;

    openModal(expenseId ? 'Edit Expense' : 'Record Business Expense (MUN COMPUTER)', content, null);
    setTimeout(() => {
      const el = document.getElementById('exp-amount');
      if (el) syncAmountWords(el, 'exp-amount-words');
    }, 30);
  },

  handleSaveExpense: async (e, id) => {
    e.preventDefault();
    try {
      if (!canMenu('expenses', id ? 'edit' : 'add')) {
        showToast('Permission Denied: You cannot save expense entries.', 'danger');
        return;
      }
      const amount = Number(document.getElementById('exp-amount').value);
      const paymentMethod = document.getElementById('exp-method').value;
      const cashLimit = getCashOperationLimit();
      if (String(paymentMethod).toLowerCase().includes('cash') && cashLimit > 0 && amount > cashLimit) {
        showToast(`Cash Operation Limit Exceeded: Your limit is ${formatINR(cashLimit)} per transaction.`, 'danger');
        return;
      }
      const data = {
        id: id || undefined,
        category: document.getElementById('exp-cat').value,
        title: document.getElementById('exp-title').value,
        amount,
        date: document.getElementById('exp-date').value,
        paymentMethod,
        vendorName: document.getElementById('exp-vendor').value,
        remarks: document.getElementById('exp-remarks').value
      };

      const res = await saveExpense(data);
      if (res && res.success === false) {
        showToast(res.message || 'Unable to save expense.', 'danger');
        return;
      }
      closeModal();
      showToast(id ? 'Expense updated.' : 'Expense recorded at MUN COMPUTER.', 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save expense.', 'danger');
    }
  },

  editExpense: (id) => {
    window.MJK.openExpenseModal(id);
  },

  promptDeleteExpense: (id) => {
    if (!canMenu('expenses', 'delete')) {
      showToast('Permission Denied: You cannot delete expenses.', 'danger');
      return;
    }
    const exp = getAllExpenses().find(x => x.id === id);
    showDeleteReasonDialog(
      'Delete Expense Record?',
      `Remove expense "${exp ? `${exp.title} (${formatINR(exp.amount)})` : id}" from financial ledgers?`,
      async (reason) => {
        deleteExpense(id);
        await logDeleteHistory({
          targetType: 'EXPENSE',
          targetId: id,
          targetSummary: exp ? `${exp.title} · ${formatINR(exp.amount)}` : id,
          reason
        });
        showToast('Expense deleted & logged.', 'info');
        render();
      }
    );
  },

  // Target Actions
  openTargetModal: (targetId = null) => {
    const t = targetId ? getAllTargets().find(x => x.id === targetId) : null;
    const content = `
      <form id="target-form" onsubmit="window.MJK.handleSaveTarget(event, '${targetId || ''}')">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Target Name <span class="req">*</span></label>
            <input type="text" id="tgt-name" class="form-control" value="${t ? t.name : ''}" required placeholder="e.g. Monthly Revenue Goal">
          </div>
          <div class="form-group">
            <label class="form-label">Target Category</label>
            <select id="tgt-cat" class="form-control">
              ${TARGET_CATEGORIES.map(c => `<option value="${c}" ${t && t.category === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Target Amount (₹)</label>
            <input type="number" id="tgt-amount" class="form-control font-mono tabular-nums" min="0" step="any" value="${t ? t.targetAmount : ''}" placeholder="Target Amount (₹)" oninput="window.MJK.syncAmountWords(this, 'tgt-amount-words')">
            <div id="tgt-amount-words" class="amount-words-hint" style="display:none;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Target Period</label>
            <input type="text" id="tgt-period" class="form-control" value="${t ? t.targetPeriod : ''}" placeholder="e.g. Current Month / Q1">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" id="tgt-start" class="form-control" value="${t ? t.startDate : getTodayDate()}">
          </div>
          <div class="form-group">
            <label class="form-label">End Date</label>
            <input type="date" id="tgt-end" class="form-control" value="${t ? t.endDate : getTodayDate()}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" id="tgt-desc" class="form-control" value="${t ? t.description : ''}">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Target</button>
        </div>
      </form>
    `;

    openModal(targetId ? 'Edit Target' : 'Create Business Target (MUN COMPUTER)', content, null);
    setTimeout(() => {
      const el = document.getElementById('tgt-amount');
      if (el) syncAmountWords(el, 'tgt-amount-words');
    }, 30);
  },

  handleSaveTarget: async (e, id) => {
    e.preventDefault();
    try {
      const data = {
        id: id || undefined,
        name: document.getElementById('tgt-name').value,
        category: document.getElementById('tgt-cat').value,
        targetAmount: Number(document.getElementById('tgt-amount').value),
        targetPeriod: document.getElementById('tgt-period').value,
        startDate: document.getElementById('tgt-start').value,
        endDate: document.getElementById('tgt-end').value,
        description: document.getElementById('tgt-desc').value
      };

      await saveTarget(data);
      closeModal();
      showToast('Business target saved.', 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save target.', 'danger');
    }
  },

  // Project Actions
  openProjectModal: (projId = null) => {
    const p = projId ? getAllProjects().find(x => x.id === projId) : null;
    const content = `
      <form id="project-form" onsubmit="window.MJK.handleSaveProject(event, '${projId || ''}')">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Project Name <span class="req">*</span></label>
            <input type="text" id="prj-name" class="form-control" value="${p ? p.name : ''}" required placeholder="e.g. PVC Card Expansion / Cyber Exam Hub">
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <input type="text" id="prj-cat" class="form-control" value="${p ? p.category : 'Expansion'}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Market Opportunity & Description</label>
          <textarea id="prj-desc" class="form-control" rows="2">${p ? p.description : ''}</textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Required Investment (₹)</label>
            <input type="number" id="prj-inv" class="form-control font-mono tabular-nums" min="0" step="any" value="${p ? p.requiredInvestment : ''}" placeholder="Required Capital (₹)" oninput="window.MJK.syncAmountWords(this, 'prj-inv-words')">
            <div id="prj-inv-words" class="amount-words-hint" style="display:none;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Expected Monthly Revenue (₹)</label>
            <input type="number" id="prj-rev" class="form-control font-mono tabular-nums" min="0" step="any" value="${p ? p.expectedMonthlyRevenue : ''}" placeholder="Expected Revenue (₹)" oninput="window.MJK.syncAmountWords(this, 'prj-rev-words')">
            <div id="prj-rev-words" class="amount-words-hint" style="display:none;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Expected Monthly Expenses (₹)</label>
            <input type="number" id="prj-exp" class="form-control font-mono tabular-nums" min="0" step="any" value="${p ? p.expectedMonthlyExpenses : ''}" placeholder="Expected Expenses (₹)" oninput="window.MJK.syncAmountWords(this, 'prj-exp-words')">
            <div id="prj-exp-words" class="amount-words-hint" style="display:none;"></div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Stage</label>
            <select id="prj-stage" class="form-control">
              ${PROJECT_STAGES.map(st => `<option value="${st}" ${p && p.stage === st ? 'selected' : ''}>${st}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Target Launch Date</label>
            <input type="date" id="prj-launch" class="form-control" value="${p ? p.launchDate : getTodayDate()}">
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Project</button>
        </div>
      </form>
    `;

    openModal(projId ? 'Edit Business Project' : 'Plan New Business Venture', content, null);
    setTimeout(() => {
      syncAmountWords(document.getElementById('prj-inv'), 'prj-inv-words');
      syncAmountWords(document.getElementById('prj-rev'), 'prj-rev-words');
      syncAmountWords(document.getElementById('prj-exp'), 'prj-exp-words');
    }, 30);
  },

  handleSaveProject: async (e, id) => {
    e.preventDefault();
    try {
      const data = {
        id: id || undefined,
        name: document.getElementById('prj-name').value,
        category: document.getElementById('prj-cat').value,
        description: document.getElementById('prj-desc').value,
        requiredInvestment: Number(document.getElementById('prj-inv').value),
        expectedMonthlyRevenue: Number(document.getElementById('prj-rev').value),
        expectedMonthlyExpenses: Number(document.getElementById('prj-exp').value),
        stage: document.getElementById('prj-stage').value,
        launchDate: document.getElementById('prj-launch').value
      };

      await saveProject(data);
      closeModal();
      showToast('Business project saved.', 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save project.', 'danger');
    }
  },

  editProject: (id) => {
    window.MJK.openProjectModal(id);
  },

  promptDeleteProject: (id) => {
    showConfirmDialog('Delete Project Venture?', 'This business venture plan will be deleted.', () => {
      deleteProject(id);
      showToast('Project deleted.', 'info');
      render();
    });
  },

  // Investment Actions
  openInvestmentModal: () => {
    const content = `
      <form id="investment-form" onsubmit="window.MJK.handleSaveInvestment(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Project / Asset Name <span class="req">*</span></label>
            <input type="text" id="inv-proj" class="form-control" required placeholder="e.g. PVC Machine / Laser Printer">
          </div>
          <div class="form-group">
            <label class="form-label">Funding Source <span class="req">*</span></label>
            <select id="inv-funding" class="form-control">
              ${FUNDING_TYPES.map(f => `<option value="${f}">${f}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Amount (₹) <span class="req">*</span></label>
            <input type="number" id="inv-amount" class="form-control font-mono tabular-nums" min="0" step="any" required placeholder="Capital amount" oninput="window.MJK.syncAmountWords(this, 'inv-amount-words')">
            <div id="inv-amount-words" class="amount-words-hint" style="display:none;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Investment Date</label>
            <input type="date" id="inv-date" class="form-control" value="${getTodayDate()}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Remarks</label>
          <input type="text" id="inv-remarks" class="form-control">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Investment</button>
        </div>
      </form>
    `;

    openModal('Record Capital Investment (MUN COMPUTER)', content, null);
  },

  handleSaveInvestment: async (e) => {
    e.preventDefault();
    try {
      const data = {
        projectName: document.getElementById('inv-proj').value,
        fundingType: document.getElementById('inv-funding').value,
        source: document.getElementById('inv-funding').value,
        amount: Number(document.getElementById('inv-amount').value),
        investmentDate: document.getElementById('inv-date').value,
        remarks: document.getElementById('inv-remarks').value
      };

      await saveInvestment(data);
      closeModal();
      showToast('Investment capital recorded.', 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save investment.', 'danger');
    }
  },

  promptDeleteInvestment: (id) => {
    showConfirmDialog('Delete Investment Record?', 'This entry will be removed from capital ledgers.', () => {
      deleteInvestment(id);
      showToast('Investment deleted.', 'info');
      render();
    });
  },

  // Marketing Actions
  openMarketingModal: () => {
    const content = `
      <form id="marketing-form" onsubmit="window.MJK.handleSaveMarketing(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Campaign Name <span class="req">*</span></label>
            <input type="text" id="mkt-name" class="form-control" required placeholder="e.g. Village WhatsApp Broadcast">
          </div>
          <div class="form-group">
            <label class="form-label">Channel / Type</label>
            <select id="mkt-type" class="form-control">
              ${CAMPAIGN_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Budget (₹)</label>
            <input type="number" id="mkt-budget" class="form-control font-mono tabular-nums" min="0" step="any" value="" placeholder="Budget (₹)" oninput="window.MJK.syncAmountWords(this, 'mkt-budget-words')">
            <div id="mkt-budget-words" class="amount-words-hint" style="display:none;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Actual Spent (₹)</label>
            <input type="number" id="mkt-spent" class="form-control font-mono tabular-nums" min="0" step="any" value="" placeholder="Actual Spent (₹)" oninput="window.MJK.syncAmountWords(this, 'mkt-spent-words')">
            <div id="mkt-spent-words" class="amount-words-hint" style="display:none;"></div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Inquiries / Leads</label>
            <input type="number" id="mkt-leads" class="form-control" value="" placeholder="Total Leads">
          </div>
          <div class="form-group">
            <label class="form-label">Converted Customers</label>
            <input type="number" id="mkt-conv" class="form-control" value="" placeholder="Conversions">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Campaign Outcome / Notes</label>
          <input type="text" id="mkt-notes" class="form-control" placeholder="Targeted village panchayats for PVC cards & PNB accounts">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Launch Campaign</button>
        </div>
      </form>
    `;

    openModal('Launch Marketing Campaign', content, null);
  },

  handleSaveMarketing: async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: document.getElementById('mkt-name').value,
        type: document.getElementById('mkt-type').value,
        budget: Number(document.getElementById('mkt-budget').value),
        spent: Number(document.getElementById('mkt-spent').value),
        leads: Number(document.getElementById('mkt-leads').value),
        converted: Number(document.getElementById('mkt-conv').value),
        notes: document.getElementById('mkt-notes').value
      };

      await saveCampaign(data);
      closeModal();
      showToast('Marketing campaign launched.', 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save campaign.', 'danger');
    }
  },

  promptDeleteMarketing: (id) => {
    showConfirmDialog('Delete Campaign Record?', 'This marketing campaign will be removed.', () => {
      deleteCampaign(id);
      showToast('Campaign deleted.', 'info');
      render();
    });
  },

  // Competitor Actions
  openCompetitorModal: () => {
    const content = `
      <form id="competitor-form" onsubmit="window.MJK.handleSaveCompetitor(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Competitor Name <span class="req">*</span></label>
            <input type="text" id="cmp-name" class="form-control" required placeholder="Shop name">
          </div>
          <div class="form-group">
            <label class="form-label">Location</label>
            <input type="text" id="cmp-loc" class="form-control" placeholder="Distance / Area">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Main Services & Pricing</label>
          <input type="text" id="cmp-serv" class="form-control" placeholder="e.g. Form fillup, xerox, charging extra">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Weaknesses</label>
            <input type="text" id="cmp-weak" class="form-control" placeholder="Slow PCs, no banking">
          </div>
          <div class="form-group">
            <label class="form-label">MUN COMPUTER Strategy</label>
            <input type="text" id="cmp-strat" class="form-control" placeholder="Faster delivery, official rates">
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Competitor</button>
        </div>
      </form>
    `;
    openModal('Add Competitor Benchmark', content, null);
  },

  handleSaveCompetitor: async (e) => {
    e.preventDefault();
    try {
      const list = getItem(KEYS.COMPETITORS, []);
      const refNo = await allocateGlobalReference('CMP', { entityType: 'COMPETITOR' });
      const newC = {
        id: refNo,
        name: document.getElementById('cmp-name').value,
        location: document.getElementById('cmp-loc').value,
        category: 'Cyber & Online',
        services: document.getElementById('cmp-serv').value,
        priceRange: 'Variable',
        weaknesses: document.getElementById('cmp-weak').value,
        strategy: document.getElementById('cmp-strat').value,
        researchDate: getTodayDate()
      };
      list.push(newC);
      setItem(KEYS.COMPETITORS, list);
      closeModal();
      showToast('Competitor analysis saved.', 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save competitor.', 'danger');
    }
  },

  promptDeleteCompetitor: (id) => {
    showConfirmDialog('Delete Competitor Entry?', 'Remove this competitor record.', () => {
      const list = getItem(KEYS.COMPETITORS, []).filter(c => c.id !== id);
      setItem(KEYS.COMPETITORS, list);
      markGlobalReferenceDeleted(id, 'DELETED');
      showToast('Competitor removed.', 'info');
      render();
    });
  },

  // Task Actions
  openTaskModal: () => {
    const users = getAllUsers();
    const content = `
      <form id="task-form" onsubmit="window.MJK.handleSaveTask(event)">
        <div class="form-group">
          <label class="form-label">Task Title <span class="req">*</span></label>
          <input type="text" id="tsk-title" class="form-control" required placeholder="e.g. Clean PVC printer & verify batch prints">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Assign To</label>
            <select id="tsk-user" class="form-control">
              ${users.map(u => `<option value="${u.name}">${u.name} (${u.role})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select id="tsk-priority" class="form-control">
              <option>High</option>
              <option selected>Medium</option>
              <option>Low</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Deadline</label>
          <input type="date" id="tsk-deadline" class="form-control" value="${getTodayDate()}">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Assign Task</button>
        </div>
      </form>
    `;
    openModal('Assign Daily Task (MUN COMPUTER)', content, null);
  },

  handleSaveTask: async (e) => {
    e.preventDefault();
    try {
      const tasks = getItem(KEYS.TASKS, []);
      const refNo = await allocateGlobalReference('FLW', { entityType: 'TASK' });
      const newT = {
        id: refNo,
        title: document.getElementById('tsk-title').value,
        assignedName: document.getElementById('tsk-user').value,
        priority: document.getElementById('tsk-priority').value,
        deadline: document.getElementById('tsk-deadline').value,
        status: 'Pending',
        notes: 'Assigned on counter'
      };
      tasks.push(newT);
      setItem(KEYS.TASKS, tasks);
      closeModal();
      showToast('Task assigned.', 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to assign task.', 'danger');
    }
  },

  toggleTaskStatus: (id) => {
    const tasks = getItem(KEYS.TASKS, []);
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks[index].status = tasks[index].status === 'Completed' ? 'Pending' : 'Completed';
      setItem(KEYS.TASKS, tasks);
      showToast(`Task status updated to ${tasks[index].status}.`, 'info');
      render();
    }
  },

  promptDeleteTask: (id) => {
    showConfirmDialog('Delete Task?', 'Remove this task record.', () => {
      const tasks = getItem(KEYS.TASKS, []).filter(t => t.id !== id);
      setItem(KEYS.TASKS, tasks);
      markGlobalReferenceDeleted(id, 'DELETED');
      showToast('Task removed.', 'info');
      render();
    });
  },

  // Document Vault Actions
  openDocumentModal: () => {
    const users = getAllUsers().filter(u => u.status === 'ACTIVE');
    const content = `
      <form id="doc-form" onsubmit="window.MJK.handleSaveDocument(event)">
        <div class="form-group">
          <label class="form-label">Document Name <span class="req">*</span></label>
          <input type="text" id="doc-name" class="form-control" required placeholder="e.g. Staff Police Verification / Trade License 2026">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="doc-cat" class="form-control">
              <option>Staff Verification &amp; KYC</option>
              <option>Confidential Staff Docs</option>
              <option>Trade License &amp; Registration</option>
              <option>PNB CSP / Banking</option>
              <option>KYC / Identity Proof</option>
              <option>GST</option>
              <option>Agreements</option>
              <option>Other Documents</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Linked Staff Member (Optional)</label>
            <select id="doc-staff-uid" class="form-control">
              <option value="">MUN COMPUTER General Vault</option>
              ${users.map(u => `<option value="${escAttrJs(u.uid || u.id)}">${escHtml(u.name)} (${escHtml(u.uid || u.id)})</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Expiry Date (For Renewal Alerts)</label>
            <input type="date" id="doc-exp" class="form-control" value="">
          </div>
          <div class="form-group">
            <label class="form-label">Remarks</label>
            <input type="text" id="doc-rem" class="form-control" placeholder="File location or reference note">
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Document</button>
        </div>
      </form>
    `;
    openModal('Register Document in Vault', content, null);
  },

  handleSaveDocument: async (e) => {
    e.preventDefault();
    try {
      const docs = getItem(KEYS.DOCUMENTS, []);
      const staffUid = document.getElementById('doc-staff-uid')?.value || '';
      const refNo = await allocateGlobalReference('DOC', { entityType: 'DOCUMENT' });
      const newD = {
        id: refNo,
        name: document.getElementById('doc-name').value,
        category: document.getElementById('doc-cat').value,
        staffUid,
        userId: staffUid,
        uploadDate: getTodayDate(),
        expiryDate: document.getElementById('doc-exp').value,
        remarks: document.getElementById('doc-rem').value,
        file: 'vault_register_entry'
      };
      docs.unshift(newD);
      setItem(KEYS.DOCUMENTS, docs);
      closeModal();
      showToast('Document saved in vault.', 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save document.', 'danger');
    }
  },

  promptDeleteDocument: (id) => {
    if (!canMenu('documents', 'delete')) {
      showToast('Permission Denied: You cannot delete documents.', 'danger');
      return;
    }
    const docItem = getItem(KEYS.DOCUMENTS, []).find(d => d.id === id);
    showDeleteReasonDialog(
      'Delete Document Record?',
      `Remove document "${docItem ? docItem.name : id}" from Document Vault?`,
      async (reason) => {
        const docs = getItem(KEYS.DOCUMENTS, []).filter(d => d.id !== id);
        setItem(KEYS.DOCUMENTS, docs);
        markGlobalReferenceDeleted(id, 'DELETED');
        await logDeleteHistory({
          targetType: 'DOCUMENT',
          targetId: id,
          targetSummary: docItem ? `${docItem.name} (${docItem.category || ''})` : id,
          reason
        });
        try {
          await fetch(`/api/documents/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
        } catch {}
        showToast('Document removed & Delete Reason logged.', 'info');
        render();
      }
    );
  },

  // Business Units & Profile
  openEditProfileModal: () => {
    const p = getBusinessProfile() || {};
    const content = `
      <form id="profile-form" onsubmit="window.MJK.handleSaveProfile(event)" style="max-height:75vh; overflow-y:auto; padding-right:0.5rem;">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Official Entity Name</label>
            <input type="text" id="prof-name" class="form-control" value="MUN COMPUTER" readonly style="font-weight:bold; background:var(--surface-alt);">
          </div>
          <div class="form-group">
            <label class="form-label">Founder & Chief Administrator</label>
            <input type="text" id="prof-founder" class="form-control" value="${p.ownerName || 'Mamun Reja'}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Corporate Tagline</label>
            <input type="text" id="prof-tagline" class="form-control" value="${p.tagline || 'Your Trusted Partner in Digital Transformation'}">
          </div>
          <div class="form-group">
            <label class="form-label">Corporate Slogan</label>
            <input type="text" id="prof-slogan" class="form-control" value="${p.slogan || 'Empowering Digital Access. Connecting People. Simplifying Services.'}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Official Helpline Phone</label>
            <input type="tel" id="prof-phone" class="form-control" value="${escHtml(p.phone || '+91 8101352105')}">
          </div>
          <div class="form-group">
            <label class="form-label">WhatsApp Number</label>
            <input type="tel" id="prof-whatsapp" class="form-control" value="${escHtml(p.whatsapp || p.phone || '+91 8101352105')}">
          </div>
          <div class="form-group">
            <label class="form-label">Corporate Email Address</label>
            <input type="email" id="prof-email" class="form-control" value="${escHtml(p.email || 'muncomputer2019@gmail.com')}">
          </div>
        </div>

        ${renderLocationCascadeHtml('prof-loc', {
          title: '📍 Quick Branch Location Selector (Updates Address Below)',
          required: false,
          compact: true
        })}

        <div class="form-group">
          <label class="form-label">Headquarters Registered Address</label>
          <input type="text" id="prof-address" class="form-control" value="${p.address || 'MUN COMPUTER, Mamudpur (Chowmatha More), Ward No. 16, Domkal Municipality, P.O. – Juginda, P.S. – Domkal, District – Murshidabad, West Bengal – 742406, India.'}">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Operating Hours</label>
            <input type="text" id="prof-hours" class="form-control" value="${p.openingHours || '08:00 AM – 09:30 PM'}">
          </div>
          <div class="form-group">
            <label class="form-label">Operating Schedule</label>
            <input type="text" id="prof-schedule" class="form-control" value="${p.operatingSchedule || 'Seven Days a Week – Subject to Applicable Holidays.'}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Trade License No.</label>
            <input type="text" id="prof-license" class="form-control" value="${escHtml(p.tradeLicense || '')}" placeholder="Enter Trade License No.">
          </div>
          <div class="form-group">
            <label class="form-label">GSTIN</label>
            <input type="text" id="prof-gstin" class="form-control" value="${escHtml(p.gstin || '')}" placeholder="Enter GSTIN (if registered)">
          </div>
          <div class="form-group">
            <label class="form-label">Permanent Account Number (PAN)</label>
            <input type="text" id="prof-pan" class="form-control" value="${escHtml(p.pan || '')}" placeholder="Enter Business PAN">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Primary Bank Account</label>
          <input type="text" id="prof-bank" class="form-control" value="${escHtml(p.bankAccount || '')}" placeholder="Bank Name, Account No., IFSC">
        </div>

        <div class="form-group">
          <label class="form-label">Corporate Business Overview Statement</label>
          <textarea id="prof-overview" class="form-control" rows="3">${p.overview || p.description || ''}</textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Corporate Profile</button>
        </div>
      </form>
    `;

    openModal('Edit MUN COMPUTER Corporate Profile', content, null, 'modal-lg');
    initLocationCascade('prof-loc', {}, {
      onChange: (loc) => {
        const addrEl = document.getElementById('prof-address');
        if (addrEl && loc.state && loc.district) {
          addrEl.value = `MUN COMPUTER, ${loc.formattedAddress}, India.`;
        }
      }
    });
  },

  handleSaveProfile: (e) => {
    e.preventDefault();
    const data = {
      name: 'MUN COMPUTER',
      ownerName: document.getElementById('prof-founder').value,
      founderName: document.getElementById('prof-founder').value,
      administrator: document.getElementById('prof-founder').value,
      tagline: document.getElementById('prof-tagline').value,
      slogan: document.getElementById('prof-slogan').value,
      phone: document.getElementById('prof-phone').value,
      whatsapp: document.getElementById('prof-whatsapp')?.value || document.getElementById('prof-phone').value,
      email: document.getElementById('prof-email').value,
      address: document.getElementById('prof-address').value,
      openingHours: document.getElementById('prof-hours').value,
      operatingSchedule: document.getElementById('prof-schedule').value,
      tradeLicense: document.getElementById('prof-license').value,
      gstin: document.getElementById('prof-gstin').value,
      pan: document.getElementById('prof-pan').value,
      bankAccount: document.getElementById('prof-bank').value,
      overview: document.getElementById('prof-overview').value,
      description: document.getElementById('prof-overview').value
    };

    updateBusinessProfile(data);
    closeModal();
    showToast('MUN COMPUTER corporate profile saved.', 'success');
    render();
  },

  openBusinessUnitModal: () => {
    window.MJK.openUnitSwitchModal();
  },

  handleSaveUnit: (e) => {
    if (e) e.preventDefault();
    closeModal();
    showToast('MUN COMPUTER is the active business unit.', 'info');
    render();
  },

  // Backups and CSV Exports
  triggerDatabaseBackup: () => {
    downloadBackupFile();
    showToast('MUN COMPUTER backup file downloaded.', 'success');
  },

  handleRestoreFile: async (input) => {
    if (!input.files || !input.files[0]) return;
    try {
      await restoreFromFile(input.files[0]);
      showToast('Database successfully restored from backup!', 'success');
      render();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  },

  promptClearAllData: () => {
    showConfirmDialog('Clean All Operational Data / সব ডেটা সাফ করবেন?', 'This will permanently clear all customers, services, payments, invoices, expenses, banking, inventory, and task records and reset all reports to ₹0. Administrative logins and shop profile will remain intact.', async () => {
      clearAllOperationalData();
      try {
        await fetch('/api/admin/clear-operational-data', {
          method: 'POST',
          headers: getAuthHeaders()
        });
      } catch {}
      showToast('All operational data and reports cleared successfully! (সব ডেটা পরিষ্কার করা হয়েছে)', 'success');
      render();
    });
  },

  promptFactoryReset: () => {
    showConfirmDialog('Clean All Operational Data / সব ডেটা সাফ করবেন?', 'This will wipe all records and reset all reports to ₹0 clean slate.', async () => {
      clearAllOperationalData();
      try {
        await fetch('/api/admin/clear-operational-data', {
          method: 'POST',
          headers: getAuthHeaders()
        });
      } catch {}
      showToast('System reset to fresh clean state. (সব ডেটা পরিষ্কার করা হয়েছে)', 'info');
      render();
    });
  },

  exportCustomersCSV: () => {
    const customers = getAllCustomers();
    exportUniversalCSV({
      filename: 'MUN_COMPUTER_Customer_Directory',
      reportTitle: 'CUSTOMER DIRECTORY REPORT',
      reportId: generateReportId('MUN-CUS'),
      status: `${customers.length} CUSTOMERS`,
      headers: [
        { key: 'id', label: 'Customer ID' },
        { key: 'applicationId', label: 'Application ID' },
        { key: 'name', label: 'Full Name' },
        { key: 'fatherName', label: 'Father / Guardian Name' },
        { key: 'phone', label: 'Mobile' },
        { key: 'village', label: 'Village' },
        { key: 'postOffice', label: 'Post Office' },
        { key: 'policeStation', label: 'Police Station' },
        { key: 'district', label: 'District' },
        { key: 'pinCode', label: 'PIN Code' },
        { key: 'category', label: 'Category' },
        { key: 'regDate', label: 'Registration Date' }
      ],
      rows: customers
    });
    showToast('Customer Directory CSV downloaded.', 'success');
  },

  exportServicesCSV: () => {
    const services = getAllServices();
    const rows = services.map(s => [
      s.id,
      s.receiptId || '',
      s.refNumber || '',
      s.serviceName || '',
      s.category || '',
      s.subcategory || '',
      s.customerName || '',
      s.phone || '',
      Number(s.totalAmount) || 0,
      Number(s.paidAmount) || 0,
      Number(s.dueAmount) || 0,
      s.status || '',
      s.appDate || '',
      s.deliveryDate || ''
    ]);
    const headers = ['Service ID', 'Receipt ID', 'Reference Number', 'Service Name', 'Category', 'Subcategory', 'Customer Name', 'Phone', 'Total Fee (INR)', 'Paid (INR)', 'Due (INR)', 'Status', 'App Date', 'Delivery Date'];
    exportUniversalCSV({
      filename: 'MUN_COMPUTER_Services_Register',
      reportTitle: 'SERVICE HISTORY & MANAGEMENT REGISTER',
      reportId: generateReportId('MUN-SRV'),
      status: `${services.length} RECORDS`,
      headers,
      rows,
      totalsRow: buildSumTotalsRow(headers, rows, [8, 9, 10], 'TOTAL')
    });
    showToast('Services Register CSV downloaded.', 'success');
  },

  exportServicesExcel: () => {
    const services = getAllServices();
    const headers = ['Service ID', 'Receipt ID', 'Reference No', 'Service Name', 'Category', 'Subcategory', 'Customer Name', 'Mobile', 'Shop Charge (INR)', 'Govt Fee (INR)', 'Other Charges (INR)', 'Total Fee (INR)', 'Paid (INR)', 'Due (INR)', 'Status', 'App Date', 'Delivery Date'];
    const rows = services.map(s => [
      s.id,
      s.receiptId || '',
      s.refNumber || '',
      s.serviceName || '',
      s.category || '',
      s.subcategory || '',
      s.customerName || '',
      s.phone || '',
      Number(s.serviceCharge) || 0,
      Number(s.govFee) || 0,
      Number(s.otherCharges) || 0,
      Number(s.totalAmount) || 0,
      Number(s.paidAmount) || 0,
      Number(s.dueAmount) || 0,
      s.status || '',
      s.appDate || '',
      s.deliveryDate || ''
    ]);
    exportUniversalExcel({
      filename: 'MUN_COMPUTER_Services_Register',
      sheetName: 'Services_Register',
      reportTitle: 'SERVICE HISTORY & MANAGEMENT REGISTER',
      reportId: generateReportId('MUN-SRV'),
      status: `${services.length} RECORDS`,
      headers,
      rows,
      totalsRow: buildSumTotalsRow(headers, rows, [8, 9, 10, 11, 12, 13], 'GRAND TOTAL'),
      emptyMessage: 'No service records available'
    });
    showToast('Services Register Excel (.xlsx) downloaded.', 'success');
  },

  exportServicesPDF: () => {
    const services = getAllServices();
    const totalBilled = services.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const totalPaid = services.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
    const totalDue = services.reduce((sum, s) => sum + (Number(s.dueAmount) || 0), 0);
    const headers = ['Receipt / Ref #', 'Service Name', 'Category', 'Customer', 'Mobile', 'Total (INR)', 'Paid (INR)', 'Due (INR)', 'Status', 'App Date'];
    const rows = services.map(s => [
      `${s.receiptId ? `${s.receiptId} / ` : ''}${s.refNumber || s.id}`,
      s.serviceName || '-',
      s.category || '-',
      s.customerName || '-',
      s.phone || '-',
      `Rs.${Number(s.totalAmount) || 0}`,
      `Rs.${Number(s.paidAmount) || 0}`,
      `Rs.${Number(s.dueAmount) || 0}`,
      s.status || '-',
      formatDate(s.appDate)
    ]);
    exportUniversalPDF({
      filename: 'MUN_COMPUTER_Services_Register',
      reportTitle: 'SERVICE HISTORY & MANAGEMENT REGISTER',
      reportId: generateReportId('MUN-SRV'),
      status: `${services.length} RECORDS`,
      subtitle: `Total Records: ${services.length} | Billed: Rs.${totalBilled} | Paid: Rs.${totalPaid} | Due: Rs.${totalDue}`,
      headers,
      rows,
      totalsRow: ['GRAND TOTAL', `${services.length} Services`, '', '', '', `Rs.${totalBilled}`, `Rs.${totalPaid}`, `Rs.${totalDue}`, '', ''],
      orientation: 'landscape'
    });
    showToast('Services Register PDF downloaded.', 'success');
  },

  printServicesReport: () => {
    const services = getAllServices();
    const totalBilled = services.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const totalPaid = services.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
    const totalDue = services.reduce((sum, s) => sum + (Number(s.dueAmount) || 0), 0);
    const headers = ['Receipt / Ref #', 'Service & Category', 'Customer', 'Mobile', 'Total (INR)', 'Paid (INR)', 'Due (INR)', 'Status'];
    const rows = services.map(s => [
      s.receiptId || s.refNumber || s.id,
      `${s.serviceName || '-'} (${s.category || '-'})`,
      s.customerName || '-',
      s.phone || '-',
      formatINR(s.totalAmount),
      formatINR(s.paidAmount),
      formatINR(s.dueAmount),
      s.status || '-'
    ]);
    printUniversalReport({
      filename: 'MUN_COMPUTER_Services_Register',
      reportTitle: 'SERVICE HISTORY & MANAGEMENT REGISTER',
      reportId: `SRV-REG-${getTodayDate().replace(/-/g, '')}`,
      status: `${services.length} RECORDS`,
      subtitle: `Total Services: ${services.length} · Gross Billed: ${formatINR(totalBilled)} · Collected: ${formatINR(totalPaid)} · Due: ${formatINR(totalDue)}`,
      headers,
      rows,
      totalsRow: ['GRAND TOTAL', `${services.length} Services`, '', '', formatINR(totalBilled), formatINR(totalPaid), formatINR(totalDue), ''],
      includeAcknowledgement: true,
      orientation: 'landscape'
    });
  },

  exportPaymentsCSV: () => {
    const payments = getAllPayments();
    const headers = ['Payment ID', 'Date', 'Customer', 'Mobile', 'Method', 'Status', 'Amount (INR)', 'Transaction ID', 'Remarks'];
    const rows = payments.map(p => [
      p.id,
      p.paymentDate || '',
      p.customerName || '',
      p.customerPhone || '',
      p.paymentMethod || 'Cash',
      p.paymentStatus || 'Paid',
      Number(p.paymentAmount) || 0,
      p.transactionId || '',
      p.remarks || p.reference || ''
    ]);
    exportUniversalCSV({
      filename: 'MUN_COMPUTER_Payments_Ledger',
      reportTitle: 'PAYMENT RECEIPTS & COLLECTIONS LEDGER',
      reportId: generateReportId('MUN-PAY'),
      status: `${payments.length} TXNS`,
      headers,
      rows,
      totalsRow: buildSumTotalsRow(headers, rows, [6], 'TOTAL')
    });
    showToast('Payments Ledger CSV downloaded.', 'success');
  },

  exportPaymentsExcel: () => {
    const payments = getAllPayments();
    const headers = ['Payment ID', 'Date', 'Customer Name', 'Mobile', 'Payment Method', 'Status', 'Amount (INR)', 'Transaction ID', 'Remarks'];
    const rows = payments.map(p => [
      p.id,
      p.paymentDate || '',
      p.customerName || '',
      p.customerPhone || '',
      p.paymentMethod || 'Cash',
      p.paymentStatus || 'Paid',
      Number(p.paymentAmount) || 0,
      p.transactionId || '',
      p.remarks || p.reference || ''
    ]);
    exportUniversalExcel({
      filename: 'MUN_COMPUTER_Payments_Ledger',
      sheetName: 'Payments_Ledger',
      reportTitle: 'PAYMENT RECEIPTS & COLLECTIONS LEDGER',
      reportId: generateReportId('MUN-PAY'),
      status: `${payments.length} TXNS`,
      headers,
      rows,
      totalsRow: buildSumTotalsRow(headers, rows, [6], 'GRAND TOTAL'),
      emptyMessage: 'No payment transactions recorded'
    });
    showToast('Payments Ledger Excel (.xlsx) downloaded.', 'success');
  },

  exportPaymentsPDF: () => {
    const payments = getAllPayments();
    const totalCollected = payments
      .filter(p => p.paymentStatus !== 'Refunded' && p.verificationStatus !== 'PENDING_VERIFICATION')
      .reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0);
    const headers = ['Payment ID', 'Date', 'Customer Name', 'Mode', 'Status', 'Amount (INR)', 'Txn / Remarks'];
    const rows = payments.map(p => [
      p.id,
      formatDate(p.paymentDate),
      p.customerName || '-',
      p.paymentMethod || 'Cash',
      p.paymentStatus || 'Paid',
      `Rs.${Number(p.paymentAmount) || 0}`,
      `${p.transactionId || '-'} ${p.remarks ? `· ${p.remarks}` : ''}`
    ]);
    exportUniversalPDF({
      filename: 'MUN_COMPUTER_Payments_Ledger',
      reportTitle: 'PAYMENT RECEIPTS & COLLECTIONS LEDGER',
      reportId: generateReportId('MUN-PAY'),
      status: `${payments.length} TXNS`,
      subtitle: `Verified Collected: Rs.${totalCollected} (${numberToWords(totalCollected)})`,
      headers,
      rows,
      totalsRow: ['GRAND TOTAL', '', `${payments.length} Txns`, '', '', `Rs.${totalCollected}`, numberToWords(totalCollected)],
      orientation: 'landscape'
    });
    showToast('Payments Ledger PDF downloaded.', 'success');
  },

  printPaymentsReport: () => {
    const payments = getAllPayments();
    const totalCollected = payments
      .filter(p => p.paymentStatus !== 'Refunded' && p.verificationStatus !== 'PENDING_VERIFICATION')
      .reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0);
    const headers = ['Receipt / Txn ID', 'Date', 'Customer', 'Mode', 'Status', 'Amount (INR)', 'Remarks'];
    const rows = payments.map(p => [
      `${p.id}${p.transactionId ? ` (${p.transactionId})` : ''}`,
      formatDate(p.paymentDate),
      p.customerName || '-',
      p.paymentMethod || 'Cash',
      p.paymentStatus || 'Paid',
      formatINR(p.paymentAmount),
      p.remarks || p.reference || '-'
    ]);
    printUniversalReport({
      filename: 'MUN_COMPUTER_Payments_Ledger',
      reportTitle: 'PAYMENT RECEIPTS & COLLECTIONS LEDGER',
      reportId: `PAY-LED-${getTodayDate().replace(/-/g, '')}`,
      status: `${payments.length} TXNS`,
      subtitle: `Verified Total Collected: ${formatINR(totalCollected)} (${numberToWords(totalCollected)})`,
      headers,
      rows,
      totalsRow: ['GRAND TOTAL', '', `${payments.length} Txns`, '', '', formatINR(totalCollected), numberToWords(totalCollected)],
      includeAcknowledgement: true,
      orientation: 'landscape'
    });
  },

  exportOutstandingDuesCSV: () => {
    const dues = getCustomerDuesReport();
    const headers = ['Customer ID', 'Customer Name', 'Mobile', 'Pending Items', 'Total Balance Due (INR)'];
    const rows = dues.map(d => [
      d.customerId || '',
      d.customerName || '',
      d.phone || '',
      d.pendingServices.map(ps => `${ps.serviceName} (Due: Rs.${ps.due})`).join('; '),
      Number(d.totalDue) || 0
    ]);
    exportUniversalCSV({
      filename: 'MUN_COMPUTER_Outstanding_Dues',
      reportTitle: 'OUTSTANDING PAYMENT & CUSTOMER DUES REPORT',
      reportId: generateReportId('MUN-DUE'),
      status: `${dues.length} CLIENTS`,
      headers,
      rows,
      totalsRow: buildSumTotalsRow(headers, rows, [4], 'TOTAL DUE')
    });
    showToast('Outstanding Dues CSV downloaded.', 'success');
  },

  exportOutstandingDuesExcel: () => {
    const dues = getCustomerDuesReport();
    const headers = ['Customer ID', 'Customer Name', 'Mobile', 'Pending Services & Invoices', 'Total Balance Due (INR)'];
    const rows = dues.map(d => [
      d.customerId || '',
      d.customerName || '',
      d.phone || '',
      d.pendingServices.map(ps => `${ps.serviceName} (Due: Rs.${ps.due})`).join('; '),
      Number(d.totalDue) || 0
    ]);
    exportUniversalExcel({
      filename: 'MUN_COMPUTER_Outstanding_Dues',
      sheetName: 'Outstanding_Dues',
      reportTitle: 'OUTSTANDING PAYMENT & CUSTOMER DUES REPORT',
      reportId: generateReportId('MUN-DUE'),
      status: `${dues.length} CLIENTS`,
      headers,
      rows,
      totalsRow: buildSumTotalsRow(headers, rows, [4], 'TOTAL RECEIVABLE DUE'),
      emptyMessage: 'Zero outstanding dues!'
    });
    showToast('Outstanding Dues Excel (.xlsx) downloaded.', 'success');
  },

  exportOutstandingDuesPDF: () => {
    const dues = getCustomerDuesReport();
    const totalDue = dues.reduce((s, d) => s + (Number(d.totalDue) || 0), 0);
    const headers = ['Customer ID', 'Customer Name', 'Mobile', 'Pending Services & Invoices', 'Balance Due (INR)'];
    const rows = dues.map(d => [
      d.customerId || '-',
      d.customerName || '-',
      d.phone || '-',
      d.pendingServices.map(ps => `${ps.serviceName} (Rs.${ps.due})`).join(', ') || '-',
      `Rs.${Number(d.totalDue) || 0}`
    ]);
    exportUniversalPDF({
      filename: 'MUN_COMPUTER_Outstanding_Dues',
      reportTitle: 'OUTSTANDING PAYMENT & CUSTOMER DUES REPORT',
      reportId: generateReportId('MUN-DUE'),
      status: `${dues.length} CLIENTS`,
      subtitle: `Total Receivable Balance: Rs.${totalDue} (${numberToWords(totalDue)})`,
      headers,
      rows,
      totalsRow: ['GRAND TOTAL', `${dues.length} Clients`, '', numberToWords(totalDue), `Rs.${totalDue}`],
      orientation: 'portrait'
    });
    showToast('Outstanding Dues PDF downloaded.', 'success');
  },

  printOutstandingDuesReport: () => {
    const dues = getCustomerDuesReport();
    const totalDue = dues.reduce((s, d) => s + (Number(d.totalDue) || 0), 0);
    const headers = ['Customer ID', 'Customer Name', 'Mobile', 'Pending Services & Invoices', 'Balance Due'];
    const rows = dues.map(d => [
      d.customerId || '-',
      d.customerName || '-',
      d.phone || '-',
      d.pendingServices.map(ps => `${ps.serviceName} (${formatINR(ps.due)})`).join(', ') || '-',
      formatINR(d.totalDue)
    ]);
    printUniversalReport({
      filename: 'MUN_COMPUTER_Outstanding_Dues',
      reportTitle: 'OUTSTANDING PAYMENT & CUSTOMER DUES REPORT',
      reportId: `DUE-RPT-${getTodayDate().replace(/-/g, '')}`,
      status: `${dues.length} CLIENTS`,
      subtitle: `Total Outstanding Receivable: ${formatINR(totalDue)} (${numberToWords(totalDue)})`,
      headers,
      rows,
      totalsRow: ['GRAND TOTAL', `${dues.length} Clients`, '', numberToWords(totalDue), formatINR(totalDue)],
      includeAcknowledgement: true,
      orientation: 'portrait'
    });
  },

  exportInvoicesCSV: () => {
    const invoices = getAllInvoices();
    const headers = ['Invoice Number', 'Document Type', 'Date', 'Customer Name', 'Mobile', 'Subtotal (INR)', 'Discount (INR)', 'GST / Tax (INR)', 'Total Amount (INR)', 'Paid Amount (INR)', 'Balance Due (INR)', 'Status'];
    const rows = invoices.map(i => [
      i.id,
      i.documentType || 'Service Invoice',
      i.date || '',
      i.customerName || '',
      i.phone || '',
      Number(i.subtotal) || 0,
      Number(i.discount) || 0,
      Number(i.taxAmount ?? i.tax) || 0,
      Number(i.totalAmount) || 0,
      Number(i.paidAmount) || 0,
      Number(i.balanceDue) || 0,
      i.status || ''
    ]);
    exportUniversalCSV({
      filename: 'MUN_COMPUTER_Bills_Invoices',
      reportTitle: 'SALES, PURCHASE & CUSTOMER BILLS / INVOICES REGISTER',
      reportId: generateReportId('MUN-INV'),
      status: `${invoices.length} INVOICES`,
      headers,
      rows,
      totalsRow: buildSumTotalsRow(headers, rows, [5, 6, 7, 8, 9, 10], 'TOTAL')
    });
    showToast('Invoices Register CSV downloaded.', 'success');
  },

  exportInvoicesExcel: () => {
    const invoices = getAllInvoices();
    const headers = ['Invoice Number', 'Document Type', 'Date', 'Customer Name', 'Mobile', 'Subtotal (INR)', 'Discount (INR)', 'GST / Tax (INR)', 'Total Amount (INR)', 'Paid Amount (INR)', 'Balance Due (INR)', 'Status'];
    const rows = invoices.map(i => [
      i.id,
      i.documentType || 'Service Invoice',
      i.date || '',
      i.customerName || '',
      i.phone || '',
      Number(i.subtotal) || 0,
      Number(i.discount) || 0,
      Number(i.taxAmount ?? i.tax) || 0,
      Number(i.totalAmount) || 0,
      Number(i.paidAmount) || 0,
      Number(i.balanceDue) || 0,
      i.status || ''
    ]);
    exportUniversalExcel({
      filename: 'MUN_COMPUTER_Bills_Invoices',
      sheetName: 'Invoices_Register',
      reportTitle: 'SALES, PURCHASE & CUSTOMER BILLS / INVOICES REGISTER',
      reportId: generateReportId('MUN-INV'),
      status: `${invoices.length} INVOICES`,
      headers,
      rows,
      totalsRow: buildSumTotalsRow(headers, rows, [5, 6, 7, 8, 9, 10], 'GRAND TOTAL'),
      emptyMessage: 'No invoices generated yet'
    });
    showToast('Invoices Register Excel (.xlsx) downloaded.', 'success');
  },

  exportInvoicesPDF: () => {
    const invoices = getAllInvoices();
    const totalTax = invoices.reduce((sum, i) => sum + (Number(i.taxAmount ?? i.tax) || 0), 0);
    const totalVal = invoices.reduce((sum, i) => sum + (Number(i.totalAmount) || 0), 0);
    const totalPaid = invoices.reduce((sum, i) => sum + (Number(i.paidAmount) || 0), 0);
    const totalDue = invoices.reduce((sum, i) => sum + (Number(i.balanceDue) || 0), 0);
    const headers = ['Invoice #', 'Type', 'Date', 'Customer Name', 'GST (INR)', 'Total (INR)', 'Paid (INR)', 'Due (INR)', 'Status'];
    const rows = invoices.map(i => [
      i.id,
      i.documentType || 'Service Invoice',
      formatDate(i.date),
      `${i.customerName || '-'} (${i.phone || '-'})`,
      `Rs.${Number(i.taxAmount ?? i.tax) || 0}`,
      `Rs.${Number(i.totalAmount) || 0}`,
      `Rs.${Number(i.paidAmount) || 0}`,
      `Rs.${Number(i.balanceDue) || 0}`,
      i.status || '-'
    ]);
    exportUniversalPDF({
      filename: 'MUN_COMPUTER_Bills_Invoices',
      reportTitle: 'SALES, PURCHASE & CUSTOMER BILLS / INVOICES REGISTER',
      reportId: generateReportId('MUN-INV'),
      status: `${invoices.length} INVOICES`,
      subtitle: `Gross Billed: Rs.${totalVal} | GST: Rs.${totalTax} | Collected: Rs.${totalPaid} | Due: Rs.${totalDue}`,
      headers,
      rows,
      totalsRow: ['GRAND TOTAL', '', '', `${invoices.length} Bills`, `Rs.${totalTax}`, `Rs.${totalVal}`, `Rs.${totalPaid}`, `Rs.${totalDue}`, ''],
      orientation: 'landscape'
    });
    showToast('Invoices Register PDF downloaded.', 'success');
  },

  printInvoicesReport: () => {
    const invoices = getAllInvoices();
    const totalTax = invoices.reduce((sum, i) => sum + (Number(i.taxAmount ?? i.tax) || 0), 0);
    const totalVal = invoices.reduce((sum, i) => sum + (Number(i.totalAmount) || 0), 0);
    const totalPaid = invoices.reduce((sum, i) => sum + (Number(i.paidAmount) || 0), 0);
    const totalDue = invoices.reduce((sum, i) => sum + (Number(i.balanceDue) || 0), 0);
    const headers = ['Invoice #', 'Type', 'Date', 'Customer', 'GST (INR)', 'Total (INR)', 'Paid (INR)', 'Due (INR)', 'Status'];
    const rows = invoices.map(i => [
      i.id,
      i.documentType || 'Service Invoice',
      formatDate(i.date),
      `${i.customerName || '-'} (${i.phone || '-'})`,
      formatINR(Number(i.taxAmount ?? i.tax) || 0),
      formatINR(i.totalAmount),
      formatINR(i.paidAmount),
      formatINR(i.balanceDue),
      i.status || '-'
    ]);
    printUniversalReport({
      filename: 'MUN_COMPUTER_Bills_Invoices',
      reportTitle: 'SALES, PURCHASE & CUSTOMER BILLS / INVOICES REGISTER',
      reportId: `INV-REG-${getTodayDate().replace(/-/g, '')}`,
      status: `${invoices.length} INVOICES`,
      subtitle: `Gross Billed: ${formatINR(totalVal)} · GST: ${formatINR(totalTax)} · Collected: ${formatINR(totalPaid)} · Due: ${formatINR(totalDue)}`,
      headers,
      rows,
      totalsRow: ['GRAND TOTAL', '', '', `${invoices.length} Bills`, formatINR(totalTax), formatINR(totalVal), formatINR(totalPaid), formatINR(totalDue), ''],
      includeAcknowledgement: true,
      orientation: 'landscape'
    });
  },

  exportExpensesCSV: () => {
    const expenses = getAllExpenses();
    const headers = ['Expense ID', 'Date', 'Category', 'Description', 'Vendor', 'Method', 'Amount (INR)', 'Remarks'];
    const rows = expenses.map(e => [
      e.voucherNumber || e.id,
      e.date || '',
      e.category || '',
      e.title || '',
      e.vendorName || '',
      e.paymentMethod || 'Cash',
      Number(e.amount) || 0,
      e.remarks || ''
    ]);
    exportUniversalCSV({
      filename: 'MUN_COMPUTER_Expenses',
      reportTitle: 'BUSINESS EXPENSES REGISTER',
      reportId: generateReportId('MUN-EXP'),
      status: `${expenses.length} ENTRIES`,
      headers,
      rows,
      totalsRow: buildSumTotalsRow(headers, rows, [6], 'TOTAL')
    });
    showToast('Expenses CSV downloaded.', 'success');
  },

  exportExpensesExcel: () => {
    const expenses = getAllExpenses();
    const headers = ['Expense ID', 'Date', 'Category', 'Description', 'Vendor', 'Method', 'Amount (INR)', 'Remarks'];
    const rows = expenses.map(e => [
      e.voucherNumber || e.id,
      e.date || '',
      e.category || '',
      e.title || '',
      e.vendorName || '',
      e.paymentMethod || 'Cash',
      Number(e.amount) || 0,
      e.remarks || ''
    ]);
    exportUniversalExcel({
      filename: 'MUN_COMPUTER_Expenses',
      sheetName: 'Expenses_Register',
      reportTitle: 'BUSINESS EXPENSES REGISTER',
      reportId: generateReportId('MUN-EXP'),
      status: `${expenses.length} ENTRIES`,
      headers,
      rows,
      totalsRow: buildSumTotalsRow(headers, rows, [6], 'GRAND TOTAL'),
      emptyMessage: 'No expense entries recorded'
    });
    showToast('Expenses Excel (.xlsx) downloaded.', 'success');
  },

  exportExpensesPDF: () => {
    const expenses = getAllExpenses();
    const totalExp = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const headers = ['Expense ID', 'Date', 'Category', 'Description', 'Vendor', 'Method', 'Amount (INR)'];
    const rows = expenses.map(e => [
      e.voucherNumber || e.id,
      formatDate(e.date),
      e.category || '-',
      e.title || '-',
      e.vendorName || '-',
      e.paymentMethod || 'Cash',
      `Rs.${Number(e.amount) || 0}`
    ]);
    exportUniversalPDF({
      filename: 'MUN_COMPUTER_Expenses',
      reportTitle: 'BUSINESS EXPENSES REGISTER',
      reportId: generateReportId('MUN-EXP'),
      status: `${expenses.length} ENTRIES`,
      subtitle: `Total Expenses: Rs.${totalExp} (${numberToWords(totalExp)})`,
      headers,
      rows,
      totalsRow: ['GRAND TOTAL', '', '', `${expenses.length} Entries`, '', '', `Rs.${totalExp}`],
      orientation: 'landscape'
    });
    showToast('Expenses PDF downloaded.', 'success');
  },

  printExpensesReport: () => {
    const expenses = getAllExpenses();
    const totalExp = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const headers = ['Voucher / Expense ID', 'Date', 'Category', 'Description', 'Vendor', 'Method', 'Amount (INR)'];
    const rows = expenses.map(e => [
      e.voucherNumber || e.id,
      formatDate(e.date),
      e.category || '-',
      e.title || '-',
      e.vendorName || '-',
      e.paymentMethod || 'Cash',
      formatINR(e.amount)
    ]);
    printUniversalReport({
      filename: 'MUN_COMPUTER_Expenses',
      reportTitle: 'BUSINESS EXPENSES REGISTER',
      reportId: `EXP-REG-${getTodayDate().replace(/-/g, '')}`,
      status: `${expenses.length} ENTRIES`,
      subtitle: `Total Business Expenses: ${formatINR(totalExp)} (${numberToWords(totalExp)})`,
      headers,
      rows,
      totalsRow: ['GRAND TOTAL', '', '', `${expenses.length} Entries`, '', '', formatINR(totalExp)],
      includeAcknowledgement: true,
      orientation: 'landscape'
    });
  },

  exportIncomeCSV: () => {
    const summary = generateFinancialSummary('all', AppState.dateFilter, AppState.customDateStart, AppState.customDateEnd);
    const headers = ['Income Stream / Metric', 'Amount (INR)', 'Amount in Words'];
    const rows = [
      ['Gross Service & Invoice Billing', Number(summary.grossBilled) || 0, numberToWords(summary.grossBilled)],
      ['Verified Collected Revenue (Cash/UPI/Bank)', Number(summary.collectedRevenue) || 0, numberToWords(summary.collectedRevenue)],
      ['Earned Banking Commission (CSP/AePS)', Number(summary.bankingCommission) || 0, numberToWords(summary.bankingCommission || 0)],
      ['Total Operating Income', Number(summary.totalOperatingIncome ?? summary.collectedRevenue) || 0, numberToWords(summary.totalOperatingIncome ?? summary.collectedRevenue)],
      ['Outstanding Customer Dues', Number(summary.totalDues) || 0, numberToWords(summary.totalDues)],
      ['Total Shop Expenses', Number(summary.totalExpenses) || 0, numberToWords(summary.totalExpenses)],
      ['Net Operating Profit / Loss', Number(summary.netCashFlow) || 0, numberToWords(summary.netCashFlow)]
    ];
    exportUniversalCSV({
      filename: `MUN_COMPUTER_Income_Report_${AppState.dateFilter}`,
      reportTitle: `INCOME & PROFIT REPORT (${String(AppState.dateFilter).toUpperCase()})`,
      reportId: generateReportId('MUN-INC'),
      status: `${formatDate(summary.dateRange.start)} TO ${formatDate(summary.dateRange.end)}`,
      headers,
      rows
    });
    showToast('Income Report CSV downloaded.', 'success');
  },

  exportIncomeExcel: () => {
    const summary = generateFinancialSummary('all', AppState.dateFilter, AppState.customDateStart, AppState.customDateEnd);
    const headers = ['Income Stream / Metric', 'Amount (INR)', 'Amount in Words'];
    const rows = [
      ['Gross Service & Invoice Billing', Number(summary.grossBilled) || 0, numberToWords(summary.grossBilled)],
      ['Verified Collected Revenue (Cash/UPI/Bank)', Number(summary.collectedRevenue) || 0, numberToWords(summary.collectedRevenue)],
      ['Earned Banking Commission (CSP/AePS)', Number(summary.bankingCommission) || 0, numberToWords(summary.bankingCommission || 0)],
      ['Total Operating Income', Number(summary.totalOperatingIncome ?? summary.collectedRevenue) || 0, numberToWords(summary.totalOperatingIncome ?? summary.collectedRevenue)],
      ['Outstanding Customer Dues', Number(summary.totalDues) || 0, numberToWords(summary.totalDues)],
      ['Total Shop Expenses', Number(summary.totalExpenses) || 0, numberToWords(summary.totalExpenses)],
      ['Net Operating Profit / Loss', Number(summary.netCashFlow) || 0, numberToWords(summary.netCashFlow)]
    ];
    exportUniversalExcel({
      filename: `MUN_COMPUTER_Income_Report_${AppState.dateFilter}`,
      sheetName: 'Income_Report',
      reportTitle: `INCOME & PROFIT REPORT (${String(AppState.dateFilter).toUpperCase()})`,
      reportId: generateReportId('MUN-INC'),
      status: `${formatDate(summary.dateRange.start)} TO ${formatDate(summary.dateRange.end)}`,
      headers,
      rows
    });
    showToast('Income Report Excel (.xlsx) downloaded.', 'success');
  },

  exportIncomePDF: () => {
    const summary = generateFinancialSummary('all', AppState.dateFilter, AppState.customDateStart, AppState.customDateEnd);
    const headers = ['Income Stream / Metric', 'Amount (INR)', 'Amount in Words'];
    const rows = [
      ['Gross Service & Invoice Billing', `Rs.${Number(summary.grossBilled) || 0}`, numberToWords(summary.grossBilled)],
      ['Verified Collected Revenue (Cash/UPI/Bank)', `Rs.${Number(summary.collectedRevenue) || 0}`, numberToWords(summary.collectedRevenue)],
      ['Earned Banking Commission (CSP/AePS)', `Rs.${Number(summary.bankingCommission) || 0}`, numberToWords(summary.bankingCommission || 0)],
      ['Total Operating Income', `Rs.${Number(summary.totalOperatingIncome ?? summary.collectedRevenue) || 0}`, numberToWords(summary.totalOperatingIncome ?? summary.collectedRevenue)],
      ['Outstanding Customer Dues', `Rs.${Number(summary.totalDues) || 0}`, numberToWords(summary.totalDues)],
      ['Total Shop Expenses', `Rs.${Number(summary.totalExpenses) || 0}`, numberToWords(summary.totalExpenses)],
      ['Net Operating Profit / Loss', `Rs.${Number(summary.netCashFlow) || 0}`, numberToWords(summary.netCashFlow)]
    ];
    exportUniversalPDF({
      filename: `MUN_COMPUTER_Income_Report_${AppState.dateFilter}`,
      reportTitle: `INCOME & PROFIT STATEMENT (${String(AppState.dateFilter).toUpperCase()})`,
      reportId: generateReportId('MUN-INC'),
      status: `${formatDate(summary.dateRange.start)} TO ${formatDate(summary.dateRange.end)}`,
      headers,
      rows,
      orientation: 'portrait'
    });
    showToast('Income Report PDF downloaded.', 'success');
  },

  openIncomeA4Popup: () => {
    const summary = generateFinancialSummary('all', AppState.dateFilter, AppState.customDateStart, AppState.customDateEnd);
    const bodyHtml = `
      <div class="mun-bw-doc">
        ${renderBwDocumentHeader({
          docTitle: `INCOME & PROFIT STATEMENT (${AppState.dateFilter.toUpperCase()})`,
          docNumber: `INC-${getTodayDate().replace(/-/g, '')}`,
          docDateTime: getNowISTString(),
          statusText: `${formatDate(summary.dateRange.start)} TO ${formatDate(summary.dateRange.end)}`
        })}
        <table>
          <thead>
            <tr>
              <th>Financial Stream</th>
              <th class="text-right">Amount (INR)</th>
              <th>Amount in Words</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Gross Service Billing</td><td class="text-right tabular-nums">${formatINR(summary.grossBilled)}</td><td style="font-size:8pt;">${escHtml(numberToWords(summary.grossBilled))}</td></tr>
            <tr><td>Real Collected Inflow (Cash/UPI)</td><td class="text-right tabular-nums"><strong>${formatINR(summary.collectedRevenue)}</strong></td><td style="font-size:8pt;">${escHtml(numberToWords(summary.collectedRevenue))}</td></tr>
            <tr><td>Earned Banking Commission (CSP/AePS)</td><td class="text-right tabular-nums">${formatINR(summary.bankingCommission || 0)}</td><td style="font-size:8pt;">${escHtml(numberToWords(summary.bankingCommission || 0))}</td></tr>
            <tr><td>Outstanding Customer Dues</td><td class="text-right tabular-nums">${formatINR(summary.totalDues)}</td><td style="font-size:8pt;">${escHtml(numberToWords(summary.totalDues))}</td></tr>
            <tr><td>Total Shop Expenses</td><td class="text-right tabular-nums">${formatINR(summary.totalExpenses)}</td><td style="font-size:8pt;">${escHtml(numberToWords(summary.totalExpenses))}</td></tr>
            <tr><td><strong>Estimated Net Operating Profit</strong></td><td class="text-right tabular-nums"><strong>${formatINR(summary.netCashFlow)}</strong></td><td style="font-size:8pt;"><strong>${escHtml(numberToWords(summary.netCashFlow))}</strong></td></tr>
          </tbody>
        </table>
        ${renderAcknowledgementSection({ includeCustomerSignature: false })}
      </div>
    `;
    showA4PrintPdfPopup({
      title: 'Income & Profit Statement (Corporate A4)',
      subtitle: `${formatDate(summary.dateRange.start)} to ${formatDate(summary.dateRange.end)}`,
      bodyHtml,
      pdfConfig: {
        onDownload: (layoutOpts = {}) => exportReportPDF(summary, AppState.dateFilter, layoutOpts)
      }
    });
  },

  runSpecializedReportExport: (format = 'pdf') => {
    const picker = document.getElementById('specialized-report-picker');
    const type = picker?.value || 'gst';
    const f = String(format || 'pdf').toLowerCase();

    const dispatchDataset = ({ filename, sheetName, reportTitle, reportId, status, subtitle, headers, rows, totalsRow }) => {
      if (f === 'csv') {
        exportUniversalCSV({ filename, reportTitle, reportId, status, headers, rows, totalsRow });
        showToast(`${reportTitle} CSV downloaded.`, 'success');
      } else if (f === 'excel') {
        exportUniversalExcel({ filename, sheetName: sheetName || 'Report', reportTitle, reportId, status, headers, rows, totalsRow });
        showToast(`${reportTitle} Excel (.xlsx) downloaded.`, 'success');
      } else if (f === 'print') {
        printUniversalReport({ filename, reportTitle, reportId, status, subtitle, headers, rows, totalsRow, includeAcknowledgement: true });
      } else {
        exportUniversalPDF({ filename, reportTitle, reportId, status, subtitle, headers, rows, totalsRow });
        showToast(`${reportTitle} PDF downloaded.`, 'success');
      }
    };

    if (type === 'gst') {
      const invoices = getAllInvoices();
      const headers = ['Invoice #', 'Doc Type', 'Date', 'Customer', 'Subtotal (INR)', 'Discount (INR)', 'GST %', 'GST Amount (INR)', 'Total (INR)', 'Status'];
      const rows = invoices.map(i => [
        i.id,
        i.documentType || 'Service Invoice',
        formatDate(i.date),
        `${i.customerName || '-'} (${i.phone || '-'})`,
        Number(i.subtotal) || 0,
        Number(i.discount) || 0,
        `${Number(i.taxPercent ?? i.taxRate) || 0}%`,
        Number(i.taxAmount ?? i.tax) || 0,
        Number(i.totalAmount) || 0,
        i.status || '-'
      ]);
      const totalsRow = buildSumTotalsRow(headers, rows, [4, 5, 7, 8], 'TOTAL');
      const totalGst = totalsRow[7];
      dispatchDataset({
        filename: 'MUN_COMPUTER_GST_Report',
        sheetName: 'GST_Report',
        reportTitle: 'GST & TAX SUMMARY REPORT',
        reportId: generateReportId('MUN-GST'),
        status: `${invoices.length} BILLS`,
        subtitle: `Total Bills: ${invoices.length} | Total GST Collected: ${totalGst}`,
        headers,
        rows,
        totalsRow
      });
      return;
    }

    if (type === 'typing') {
      const typingRx = /typing|dtp|document|form|print|xerox|laminat|scan|resume|cv|biodata|letter|affidavit/i;
      const services = getAllServices().filter(s =>
        typingRx.test(`${s.category || ''} ${s.subcategory || ''} ${s.serviceName || ''}`)
      );
      const headers = ['Service ID', 'Receipt #', 'Date', 'Work / Document Title', 'Category', 'Customer', 'Total (INR)', 'Paid (INR)', 'Due (INR)', 'Status'];
      const rows = services.map(s => [
        s.id,
        s.receiptId || '-',
        formatDate(s.appDate),
        s.serviceName || '-',
        s.category || '-',
        `${s.customerName || '-'} (${s.phone || '-'})`,
        Number(s.totalAmount) || 0,
        Number(s.paidAmount) || 0,
        Number(s.dueAmount) || 0,
        s.status || '-'
      ]);
      dispatchDataset({
        filename: 'MUN_COMPUTER_Typing_Documentation_Report',
        sheetName: 'Typing_Report',
        reportTitle: 'TYPING & DOCUMENTATION WORK REPORT',
        reportId: generateReportId('MUN-TYP'),
        status: `${services.length} JOBS`,
        subtitle: `Total Typing & Documentation Jobs: ${services.length}`,
        headers,
        rows,
        totalsRow: buildSumTotalsRow(headers, rows, [6, 7, 8], 'TOTAL')
      });
      return;
    }

    if (type === 'daily' || type === 'monthly') {
      const periodKey = type === 'daily' ? 'today' : 'month';
      const sumObj = generateFinancialSummary('all', periodKey);
      if (f === 'csv') return exportReportCSV(sumObj);
      if (f === 'excel') return exportReportExcel(sumObj);
      if (f === 'pdf') return exportReportPDF(sumObj, periodKey);
      const headers = ['Financial Metric', 'Amount (INR)', 'Amount in Words'];
      const rows = [
        ['Gross Billed Revenue', formatINR(sumObj.grossBilled), numberToWords(sumObj.grossBilled)],
        ['Collected Revenue', formatINR(sumObj.collectedRevenue), numberToWords(sumObj.collectedRevenue)],
        ['Earned Banking Commission', formatINR(sumObj.bankingCommission || 0), numberToWords(sumObj.bankingCommission || 0)],
        ['Total Operating Income', formatINR(sumObj.totalOperatingIncome ?? sumObj.collectedRevenue), numberToWords(sumObj.totalOperatingIncome ?? sumObj.collectedRevenue)],
        ['Total Expenses', formatINR(sumObj.totalExpenses), numberToWords(sumObj.totalExpenses)],
        ['Net Operating Profit / Loss', formatINR(sumObj.netCashFlow), numberToWords(sumObj.netCashFlow)],
        ['Cash In Hand', formatINR(sumObj.cashInHand || 0), numberToWords(sumObj.cashInHand || 0)],
        ['UPI Balance', formatINR(sumObj.upiBalance || 0), numberToWords(sumObj.upiBalance || 0)],
        ['Bank Balance', formatINR(sumObj.bankBalance || 0), numberToWords(sumObj.bankBalance || 0)]
      ];
      return printUniversalReport({
        filename: `MUN_COMPUTER_${type === 'daily' ? 'Daily' : 'Monthly'}_Business_Report`,
        reportTitle: `${type === 'daily' ? 'DAILY' : 'MONTHLY'} BUSINESS REPORT`,
        reportId: generateReportId(type === 'daily' ? 'MUN-DLY' : 'MUN-MTH'),
        status: `${formatDate(sumObj.dateRange.start)} TO ${formatDate(sumObj.dateRange.end)}`,
        headers,
        rows,
        includeAcknowledgement: true
      });
    }

    if (type === 'pnl') {
      if (f === 'print') return window.MJK.openReportsA4Popup(false);
      if (f === 'csv') return window.MJK.exportReportCSV();
      if (f === 'excel') return window.MJK.exportReportExcel();
      return window.MJK.exportReportPDF();
    }

    if (type === 'outstanding') {
      if (f === 'print') return window.MJK.printOutstandingDuesReport();
      if (f === 'csv') return window.MJK.exportOutstandingDuesCSV();
      if (f === 'excel') return window.MJK.exportOutstandingDuesExcel();
      return window.MJK.exportOutstandingDuesPDF();
    }

    if (type === 'employee') {
      const users = getAllUsers();
      const attendance = getAllAttendance();
      const services = getAllServices();
      const headers = ['User ID', 'Name', 'Role', 'Designation', 'Status', 'Attendance Logs', 'Services Handled'];
      const rows = users.map(u => {
        const attCount = attendance.filter(a => a.staffUid === u.uid || a.staffName === u.name).length;
        const srvCount = services.filter(s => s.operatorName === u.name || s.createdBy === u.uid).length;
        return [
          u.uid || u.requestId || '-',
          u.name || '-',
          u.role || 'STAFF',
          u.designation || '-',
          u.status || 'ACTIVE',
          attCount,
          srvCount
        ];
      });
      dispatchDataset({
        filename: 'MUN_COMPUTER_Employee_Report',
        sheetName: 'Employee_Report',
        reportTitle: 'EMPLOYEE & STAFF PERFORMANCE REPORT',
        reportId: generateReportId('MUN-EMP'),
        status: `${users.length} STAFF`,
        subtitle: `Total Registered Staff & Operators: ${users.length}`,
        headers,
        rows,
        totalsRow: buildSumTotalsRow(headers, rows, [5, 6], 'TOTAL')
      });
      return;
    }

    // service-history
    if (f === 'print') return window.MJK.printServicesReport();
    if (f === 'csv') return window.MJK.exportServicesCSV();
    if (f === 'excel') return window.MJK.exportServicesExcel();
    return window.MJK.exportServicesPDF();
  },

  exportModuleReport: (moduleKey, format = 'pdf') => {
    const f = String(format || 'pdf').toLowerCase();
    let cfg = null;

    if (moduleKey === 'targets') {
      const items = getAllTargets();
      const headers = ['Target ID', 'Name', 'Category', 'Period', 'Goal', 'Actual', 'Progress %', 'Lead', 'Status'];
      const rows = items.map(t => [
        t.id,
        t.name || '-',
        t.category || '-',
        t.targetPeriod || '-',
        Number(t.targetAmount || t.targetQuantity) || 0,
        Number(t.actualValue) || 0,
        `${Number(t.percentage) || 0}%`,
        t.responsiblePerson || '-',
        t.status || '-'
      ]);
      cfg = {
        filename: 'MUN_COMPUTER_Business_Targets',
        sheetName: 'Business_Targets',
        reportTitle: 'BUSINESS TARGETS & PERFORMANCE REPORT',
        reportId: generateReportId('MUN-TGT'),
        status: `${items.length} TARGETS`,
        headers,
        rows,
        totalsRow: buildSumTotalsRow(headers, rows, [4, 5], 'TOTAL')
      };
    } else if (moduleKey === 'projects') {
      const items = getAllProjects();
      const headers = ['Project ID', 'Project Name', 'Category', 'Stage', 'Required Inv (INR)', 'Expected Profit (INR)', 'Deadline', 'Lead'];
      const rows = items.map(p => [
        p.id,
        p.name || '-',
        p.category || '-',
        p.stage || '-',
        Number(p.requiredInvestment) || 0,
        Number(p.expectedProfit) || 0,
        formatDate(p.deadline),
        p.responsiblePerson || '-'
      ]);
      cfg = {
        filename: 'MUN_COMPUTER_Projects_Ventures',
        sheetName: 'Projects_Ventures',
        reportTitle: 'NEW BUSINESS & PROJECT MANAGEMENT REPORT',
        reportId: generateReportId('MUN-PRJ'),
        status: `${items.length} PROJECTS`,
        headers,
        rows,
        totalsRow: buildSumTotalsRow(headers, rows, [4, 5], 'TOTAL')
      };
    } else if (moduleKey === 'investments') {
      const items = getAllInvestments();
      const headers = ['Investment ID', 'Project / Asset', 'Date', 'Source', 'Funding Type', 'Amount (INR)', 'Status', 'Remarks'];
      const rows = items.map(i => [
        i.id,
        i.projectName || '-',
        formatDate(i.investmentDate),
        i.source || '-',
        i.fundingType || '-',
        Number(i.amount) || 0,
        i.status || 'Active',
        i.remarks || '-'
      ]);
      cfg = {
        filename: 'MUN_COMPUTER_Investments_Capital',
        sheetName: 'Investments_Capital',
        reportTitle: 'CAPITAL & INVESTMENT MANAGEMENT REPORT',
        reportId: generateReportId('MUN-CAP'),
        status: `${items.length} ENTRIES`,
        headers,
        rows,
        totalsRow: buildSumTotalsRow(headers, rows, [5], 'TOTAL')
      };
    } else if (moduleKey === 'marketing') {
      const items = getAllCampaigns();
      const headers = ['Campaign ID', 'Name', 'Type', 'Start Date', 'End Date', 'Budget (INR)', 'Spent (INR)', 'Leads', 'Converted', 'ROI %'];
      const rows = items.map(c => [
        c.id,
        c.name || '-',
        c.type || '-',
        formatDate(c.startDate),
        formatDate(c.endDate),
        Number(c.budget) || 0,
        Number(c.spent) || 0,
        Number(c.leads) || 0,
        Number(c.converted) || 0,
        `${Number(c.roi) || 0}%`
      ]);
      cfg = {
        filename: 'MUN_COMPUTER_Marketing_Campaigns',
        sheetName: 'Marketing_Campaigns',
        reportTitle: 'MARKETING CAMPAIGNS & ROI REPORT',
        reportId: generateReportId('MUN-MKT'),
        status: `${items.length} CAMPAIGNS`,
        headers,
        rows,
        totalsRow: buildSumTotalsRow(headers, rows, [5, 6, 7, 8], 'TOTAL')
      };
    } else if (moduleKey === 'competitors') {
      const items = getItem(KEYS.COMPETITORS, []);
      const headers = ['ID', 'Competitor Name', 'Location', 'Category', 'Pricing Range', 'Weaknesses', 'MUN COMPUTER Strategy', 'Survey Date'];
      const rows = items.map(c => [
        c.id,
        c.name || '-',
        c.location || '-',
        c.category || '-',
        c.priceRange || '-',
        c.weaknesses || '-',
        c.strategy || '-',
        formatDate(c.researchDate)
      ]);
      cfg = {
        filename: 'MUN_COMPUTER_Competitor_Analysis',
        sheetName: 'Competitor_Analysis',
        reportTitle: 'COMPETITOR & MARKET ANALYSIS REPORT',
        reportId: generateReportId('MUN-CMP'),
        status: `${items.length} ENTRIES`,
        headers,
        rows
      };
    } else if (moduleKey === 'tasks') {
      const items = getItem(KEYS.TASKS, []);
      const headers = ['Task ID', 'Task Title', 'Category', 'Assigned Staff', 'Staff UID', 'Priority', 'Progress %', 'Deadline', 'Status', 'Notes'];
      const rows = items.map(t => [
        t.id,
        t.title || '-',
        t.category || 'Counter Operations',
        t.assignedName || t.assignedTo || '-',
        t.assignedUid || '-',
        t.priority || 'Normal',
        `${t.progressPct ?? (t.status === 'Completed' ? 100 : 0)}%`,
        formatDate(t.deadline),
        t.status || 'Pending',
        t.notes || '-'
      ]);
      cfg = {
        filename: 'MUN_COMPUTER_Staff_Tasks',
        sheetName: 'Staff_Tasks',
        reportTitle: 'STAFF & TASK ASSIGNMENT REPORT',
        reportId: generateReportId('MUN-TSK'),
        status: `${items.length} TASKS`,
        headers,
        rows
      };
    } else if (moduleKey === 'documents') {
      const items = getItem(KEYS.DOCUMENTS, []);
      const headers = ['Doc ID', 'Document Name', 'Category', 'Linked Staff / Ref', 'Upload Date', 'Expiry Date', 'Remarks'];
      const rows = items.map(d => [
        d.id,
        d.name || '-',
        d.category || '-',
        d.staffUid || d.userId || d.applicationId || d.customerId || 'MUN COMPUTER Vault',
        formatDate(d.uploadDate),
        formatDate(d.expiryDate),
        d.remarks || '-'
      ]);
      cfg = {
        filename: 'MUN_COMPUTER_Document_Vault',
        sheetName: 'Document_Vault',
        reportTitle: 'DOCUMENT MANAGEMENT VAULT REGISTER',
        reportId: generateReportId('MUN-DOC'),
        status: `${items.length} DOCS`,
        headers,
        rows
      };
    } else if (moduleKey === 'users') {
      const items = getAllUsers();
      const headers = ['Permanent UID / Req ID', 'Name', 'Role', 'Designation', 'District', 'Email', 'Status', 'Approval Status'];
      const rows = items.map(u => [
        u.uid || u.requestId || '-',
        u.name || '-',
        u.role || 'STAFF',
        u.designation || '-',
        u.district || 'Murshidabad',
        u.email || '-',
        u.status || '-',
        u.approvalStatus || '-'
      ]);
      cfg = {
        filename: 'MUN_COMPUTER_User_Directory',
        sheetName: 'User_Directory',
        reportTitle: 'USER MANAGEMENT & APPROVALS DIRECTORY',
        reportId: generateReportId('MUN-USR'),
        status: `${items.length} ACCOUNTS`,
        headers,
        rows
      };
    }

    if (!cfg) return;
    if (f === 'csv') {
      exportUniversalCSV(cfg);
      showToast(`${cfg.reportTitle} CSV downloaded.`, 'success');
    } else if (f === 'excel') {
      exportUniversalExcel(cfg);
      showToast(`${cfg.reportTitle} Excel (.xlsx) downloaded.`, 'success');
    } else if (f === 'print') {
      printUniversalReport({ ...cfg, includeAcknowledgement: true });
    } else {
      exportUniversalPDF(cfg);
      showToast(`${cfg.reportTitle} PDF downloaded.`, 'success');
    }
  },

  openReportsA4Popup: (autoDownloadPdf = false) => {
    const summary = generateFinancialSummary('all', AppState.dateFilter, AppState.customDateStart, AppState.customDateEnd);
    const printableEl = document.querySelector('.page-container .printable-document') || document.querySelector('.page-container [role="tabpanel"]');
    const tabTitles = {
      'financial': 'FINANCIAL & MASTER SUMMARY REPORT',
      'customer-service': 'CUSTOMER, SERVICE & CSP REPORT',
      'staff-operations': 'STAFF & OPERATIONS REPORT',
      'growth-followups': 'CAPITAL, TARGETS & FOLLOW-UPS REPORT'
    };
    const reportTitle = tabTitles[AppState.reportTab] || 'ALL SECTOR FINANCIAL REPORT';
    const rawContent = printableEl ? printableEl.innerHTML : `
      <p>Gross Billed: ${formatINR(summary.grossBilled)} | Collected: ${formatINR(summary.collectedRevenue)} | Expenses: ${formatINR(summary.totalExpenses)} | Net Profit: ${formatINR(summary.netCashFlow)}</p>
    `;
    const bodyHtml = `
      <div class="mun-bw-doc">
        ${renderBwDocumentHeader({
          docTitle: reportTitle,
          docNumber: `RPT-${getTodayDate().replace(/-/g, '')}`,
          docDateTime: getNowISTString(),
          statusText: `${formatDate(summary.dateRange.start)} TO ${formatDate(summary.dateRange.end)}`
        })}
        ${rawContent}
        ${renderAcknowledgementSection({ includeCustomerSignature: false })}
      </div>
    `;
    showA4PrintPdfPopup({
      title: `${reportTitle} (Corporate A4 Print / PDF)`,
      subtitle: `Period: ${formatDate(summary.dateRange.start)} to ${formatDate(summary.dateRange.end)}`,
      bodyHtml,
      pdfConfig: {
        onDownload: (layoutOpts = {}) => {
          exportReportPDF(summary, AppState.dateFilter, layoutOpts);
          showToast('Financial P&L Report downloaded in Corporate PDF format!', 'success');
        }
      },
      autoDownloadPdf
    });
  },

  exportReportPDF: () => {
    try {
      const summary = generateFinancialSummary('all', AppState.dateFilter, AppState.customDateStart, AppState.customDateEnd);
      exportReportPDF(summary, AppState.dateFilter);
      showToast('📄 Financial P&L Report downloaded in PDF format!', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('PDF generation failed: ' + err.message, 'danger');
    }
  },

  exportReportExcel: () => {
    try {
      const summary = generateFinancialSummary('all', AppState.dateFilter, AppState.customDateStart, AppState.customDateEnd);
      exportReportExcel(summary);
      showToast('📊 Financial Report downloaded in Microsoft Excel (.xlsx) format!', 'success');
    } catch (err) {
      console.error('Excel export error:', err);
      showToast('Excel generation failed: ' + err.message, 'danger');
    }
  },

  exportReportCSV: () => {
    try {
      const summary = generateFinancialSummary('all', AppState.dateFilter, AppState.customDateStart, AppState.customDateEnd);
      exportReportCSV(summary);
      showToast('📋 Financial Report downloaded in CSV format!', 'success');
    } catch (err) {
      console.error('CSV export error:', err);
      showToast('CSV generation failed: ' + err.message, 'danger');
    }
  },

  exportFullFinancialReportCSV: () => {
    window.MJK.exportReportCSV();
  },

  exportAllDataExcel: () => {
    try {
      exportAllDataExcel();
      showToast('📊 Master All Data Workbook downloaded in Excel (.xlsx)!', 'success');
    } catch (err) {
      console.error('All Data Excel export error:', err);
      showToast('Excel workbook generation failed: ' + err.message, 'danger');
    }
  },

  exportAllDataPDF: () => {
    try {
      exportAllDataPDF();
      showToast('📄 Master All Data Audit Report downloaded in PDF format!', 'success');
    } catch (err) {
      console.error('All Data PDF export error:', err);
      showToast('PDF report generation failed: ' + err.message, 'danger');
    }
  },

  exportAllDataCSV: () => {
    try {
      exportAllDataCSV();
      showToast('📋 Master All Data CSV downloaded successfully!', 'success');
    } catch (err) {
      console.error('All Data CSV export error:', err);
      showToast('CSV export failed: ' + err.message, 'danger');
    }
  },

  openAllDataExportModal: () => {
    const content = `
      <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.25rem;">
        Choose your desired format to download all data across Customers, Services, Payments, Invoices, Expenses, Banking CSP, Inventory, and Daybook:
      </div>
      <div style="display:grid; grid-template-columns:1fr; gap:0.75rem;">
        <button class="btn btn-success" style="padding:1rem 1.25rem; justify-content:space-between; text-align:left;" onclick="window.MJK.exportAllDataExcel(); window.MJK.closeModal();">
          <div style="display:flex; align-items:center; gap:0.85rem;">
            <span style="font-size:1.8rem;">📊</span>
            <div>
              <div style="font-weight:700; font-size:0.95rem;">Microsoft Excel Master Workbook (.xlsx)</div>
              <div style="font-size:0.75rem; opacity:0.9; margin-top:0.15rem;">Multi-sheet workbook with Customers, Services, Payments, Invoices, Expenses, Banking CSP, and Inventory in separate tabs.</div>
            </div>
          </div>
          <span style="font-size:1.2rem; font-weight:bold;">⬇</span>
        </button>

        <button class="btn btn-danger" style="padding:1rem 1.25rem; justify-content:space-between; text-align:left;" onclick="window.MJK.exportAllDataPDF(); window.MJK.closeModal();">
          <div style="display:flex; align-items:center; gap:0.85rem;">
            <span style="font-size:1.8rem;">📄</span>
            <div>
              <div style="font-weight:700; font-size:0.95rem;">Adobe PDF Master Audit Document (.pdf)</div>
              <div style="font-size:0.75rem; opacity:0.9; margin-top:0.15rem;">Complete printable audit document with full customer directory, services register, and verified financial balances.</div>
            </div>
          </div>
          <span style="font-size:1.2rem; font-weight:bold;">⬇</span>
        </button>

        <button class="btn btn-secondary" style="padding:1rem 1.25rem; justify-content:space-between; text-align:left;" onclick="window.MJK.exportAllDataCSV(); window.MJK.closeModal();">
          <div style="display:flex; align-items:center; gap:0.85rem;">
            <span style="font-size:1.8rem;">📋</span>
            <div>
              <div style="font-weight:700; font-size:0.95rem;">Master Consolidated CSV (.csv)</div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.15rem;">Standard comma-separated table ready for Tally, accounting software, Google Sheets, or custom spreadsheets.</div>
            </div>
          </div>
          <span style="font-size:1.2rem; font-weight:bold;">⬇</span>
        </button>

        <button class="btn btn-primary" style="padding:1rem 1.25rem; justify-content:space-between; text-align:left;" onclick="window.MJK.triggerDatabaseBackup(); window.MJK.closeModal();">
          <div style="display:flex; align-items:center; gap:0.85rem;">
            <span style="font-size:1.8rem;">💾</span>
            <div>
              <div style="font-weight:700; font-size:0.95rem;">Complete Offline System Backup (.json)</div>
              <div style="font-size:0.75rem; opacity:0.9; margin-top:0.15rem;">Raw 100% database JSON snapshot for disaster recovery and full one-click database restore on any device.</div>
            </div>
          </div>
          <span style="font-size:1.2rem; font-weight:bold;">⬇</span>
        </button>
      </div>
    `;
    openModal('📥 Download All Business Data (সমস্ত ডেটা ডাউনলোড)', content, `
      <button class="btn btn-secondary" onclick="window.MJK.closeModal()">Close</button>
    `);
  },

  // Official User Account Provisioning (ADMINISTRATION -> MANAGER / STAFF · Section 3)
  openUserModal: (defaultRole = null) => {
    const actor = getCurrentUser();
    const isActorAdmin = isMainAdmin(actor) || String(actor?.role || '').toUpperCase() === 'ADMIN';
    const initialRole = isActorAdmin && String(defaultRole || '').toUpperCase() === 'MANAGER' ? 'MANAGER' : 'STAFF';
    const istNow = new Date();
    const istDateStr = istNow.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const istTimeStr = istNow.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const content = `
      <form id="provision-user-form" onsubmit="window.MJK.handleSaveUser(event)">
        <div id="new-user-id-preview" style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.75rem 0.9rem; margin-bottom:0.9rem; font-size:0.78rem;">
          <div style="color:var(--text-muted); font-weight:600;">Official User ID Preview (MC-${initialRole === 'MANAGER' ? 'MGR' : 'STF'}-YYYY-XXXXXXXX):</div>
          <div class="font-mono" style="font-size:1rem; font-weight:800; color:var(--blue-600); margin-top:0.2rem; font-variant-numeric:tabular-nums;">
            ${escHtml(previewNextGlobalReference(initialRole === 'MANAGER' ? 'MGR' : 'STF'))}
          </div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.15rem;">
            Generated atomically by backend SQLite transaction (never duplicated or reused; ${MAIN_ADMIN_UID} excluded).
          </div>
        </div>

        <div style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:0.65rem 0.85rem; margin-bottom:1rem;">
          <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem;">
            Prefilled / Auto-Generated System Controls (Read-Only)
          </div>
          <div class="form-row">
            <div class="form-group" style="margin-bottom:0.35rem;">
              <label class="form-label">Organization Prefix</label>
              <input type="text" class="form-control font-mono" value="MC (MUN COMPUTER)" readonly>
            </div>
            <div class="form-group" style="margin-bottom:0.35rem;">
              <label class="form-label">Account Status</label>
              <input type="text" class="form-control font-mono" value="ACTIVE" readonly>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="margin-bottom:0.35rem;">
              <label class="form-label">Creation Date &amp; Time (IST)</label>
              <input type="text" class="form-control font-mono" value="${escHtml(`${istDateStr} · ${istTimeStr} IST`)}" readonly>
            </div>
            <div class="form-group" style="margin-bottom:0.35rem;">
              <label class="form-label">Created By</label>
              <input type="text" class="form-control font-mono" value="${escHtml(actor?.uid || MAIN_ADMIN_UID)}" readonly>
            </div>
          </div>
          <div style="font-size:0.72rem; color:var(--text-muted);">
            <strong>Temporary Password Policy:</strong> Cryptographically random 12-char password (auto-generated on backend, hashed with Argon2id, forced change on first login).
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Authorized Role *</label>
            <select id="new-user-role" class="form-control" onchange="window.MJK.onNewUserRoleChange(this.value)" ${!isActorAdmin ? 'disabled' : ''}>
              ${isActorAdmin ? `<option value="MANAGER" ${initialRole === 'MANAGER' ? 'selected' : ''}>MANAGER</option>` : ''}
              <option value="STAFF" ${initialRole === 'STAFF' ? 'selected' : ''}>STAFF</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input type="text" id="new-user-name" class="form-control" required minlength="2" placeholder="Enter full legal name">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Date of Birth *</label>
            <input type="date" id="new-user-dob" class="form-control font-mono" required max="${escHtml(istDateStr)}">
          </div>
          <div class="form-group">
            <label class="form-label">10-Digit Mobile Number *</label>
            <input type="tel" id="new-user-phone" class="form-control font-mono" required placeholder="Exact 10-digit mobile" maxlength="10" pattern="[0-9]{10}" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,10)">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label class="form-label">12-Digit Aadhaar Number *</label>
              <button type="button" class="btn btn-outline btn-sm" style="padding:0.1rem 0.45rem; font-size:0.7rem;" onclick="const el=document.getElementById('new-user-aadhaar'); if(el){const next=el.type==='password'?'text':'password'; el.type=next; this.textContent=next==='text'?'Hide':'Show';}">Show</button>
            </div>
            <input type="password" id="new-user-aadhaar" class="form-control font-mono" required autocomplete="off" placeholder="Exact 12-digit Aadhaar (0-9)" maxlength="12" pattern="[0-9]{12}" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,12)">
          </div>
          <div class="form-group">
            <label class="form-label">Designation / Title</label>
            <input type="text" id="new-user-designation" class="form-control" value="${initialRole === 'MANAGER' ? 'Operations Manager' : 'Front Desk Operator'}" placeholder="Job Title">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Username (Optional)</label>
            <input type="text" id="new-user-username" class="form-control font-mono" placeholder="Auto-derived from User ID if blank">
          </div>
          <div class="form-group">
            <label class="form-label">Email Address (Optional)</label>
            <input type="email" id="new-user-email" class="form-control" placeholder="Auto-assigned @muncomputer.in if blank">
          </div>
        </div>

        ${renderLocationCascadeHtml('user-loc', {
          title: 'Residential Location (Optional Auto-Fill for Address)',
          required: false,
          compact: true
        })}

        <div class="form-group">
          <label class="form-label">Full Address *</label>
          <textarea id="new-user-address" class="form-control" rows="2" required minlength="5" placeholder="Enter complete residential address"></textarea>
        </div>

        ${isActorAdmin ? `
          <div style="border:1px dashed var(--border-subtle); border-radius:var(--radius-sm); padding:0.65rem 0.85rem; margin-top:0.5rem;">
            <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.78rem; font-weight:600; cursor:pointer;">
              <input type="checkbox" id="new-user-dup-exc" onchange="const box=document.getElementById('new-user-dup-reason-wrap'); if(box) box.style.display=this.checked?'block':'none';">
              <span>Administrator Policy Exception: Allow Duplicate Aadhaar / Mobile (Requires Logged Reason)</span>
            </label>
            <div id="new-user-dup-reason-wrap" style="display:none; margin-top:0.5rem;">
              <input type="text" id="new-user-dup-reason" class="form-control" placeholder="Enter mandatory audit reason for duplicate Aadhaar/Mobile exception...">
            </div>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" id="btn-submit-provision" class="btn btn-primary">Create Account &amp; Generate User ID</button>
        </div>
      </form>
    `;
    openModal(`Create ${initialRole === 'MANAGER' ? 'Manager' : 'Staff'} Account`, content, null, 'modal-lg');
    window.MJK.onNewUserRoleChange(initialRole);
    initLocationCascade('user-loc', {}, {
      onChange: (loc) => {
        const addrEl = document.getElementById('new-user-address');
        if (addrEl && loc.formattedAddress) {
          addrEl.value = loc.formattedAddress;
        }
      }
    });
  },

  onNewUserRoleChange: async (role) => {
    const desigInput = document.getElementById('new-user-designation');
    if (desigInput) {
      desigInput.value = role === 'MANAGER' ? 'Operations Manager' : 'Front Desk Operator';
    }
    const previewEl = document.getElementById('new-user-id-preview');
    const data = await fetchIdFormatPreview(role);
    if (previewEl && data && data.success) {
      const pfx = role === 'MANAGER' ? 'MGR' : 'STF';
      const roleYear = data.year || new Date().getFullYear();
      const previewUid = data.idPreviews?.[role]?.formatPreview || previewNextGlobalReference(pfx);
      previewEl.innerHTML = `
        <div style="color:var(--text-muted); font-weight:600;">Official User ID Preview (MC-${pfx}-${roleYear}-XXXXXXXX):</div>
        <div class="font-mono" style="font-size:1rem; font-weight:800; color:var(--blue-600); margin-top:0.2rem; font-variant-numeric:tabular-nums;">
          ${escHtml(previewUid)}
        </div>
        <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.15rem;">
          Universal Global SL Counter · Next Serial: <strong>#${escHtml(String(data.nextSerial || 1))}</strong> · Excludes ${MAIN_ADMIN_UID}.
        </div>
      `;
    }
  },

  handleSaveUser: async (e) => {
    e.preventDefault();
    const actor = getCurrentUser();
    const isActorAdmin = isMainAdmin(actor) || String(actor?.role || '').toUpperCase() === 'ADMIN';
    const fullName = document.getElementById('new-user-name')?.value?.trim() || '';
    const dob = document.getElementById('new-user-dob')?.value?.trim() || '';
    const aadhaarNumber = (document.getElementById('new-user-aadhaar')?.value || '').replace(/[^0-9]/g, '');
    const mobileNumber = (document.getElementById('new-user-phone')?.value || '').replace(/[^0-9]/g, '');
    const username = document.getElementById('new-user-username')?.value?.trim() || '';
    const roleEl = document.getElementById('new-user-role');
    const role = isActorAdmin ? (roleEl?.value || 'STAFF') : 'STAFF';
    const designation = document.getElementById('new-user-designation')?.value?.trim() || '';
    const email = document.getElementById('new-user-email')?.value?.trim() || '';
    const loc = getLocationCascadeValues('user-loc');
    saveCustomLocationIfNeeded(loc);
    const address = document.getElementById('new-user-address')?.value?.trim() || loc.formattedAddress || '';
    const allowDuplicateException = isActorAdmin && Boolean(document.getElementById('new-user-dup-exc')?.checked);
    const duplicateExceptionReason = document.getElementById('new-user-dup-reason')?.value?.trim() || '';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      showToast('Please select a valid Date of Birth.', 'danger');
      return;
    }
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      showToast('Aadhaar Number must be an exact 12-digit numeric value (0-9).', 'danger');
      return;
    }
    if (!/^\d{10}$/.test(mobileNumber)) {
      showToast('Mobile Number must be an exact 10-digit numeric value.', 'danger');
      return;
    }
    if (allowDuplicateException && duplicateExceptionReason.length < 5) {
      showToast('Enter an audit reason (minimum 5 characters) for the duplicate Aadhaar/Mobile exception.', 'danger');
      return;
    }

    const btn = document.getElementById('btn-submit-provision');
    if (btn) btn.disabled = true;

    try {
      const res = await saveUser({
        fullName,
        name: fullName,
        dob,
        aadhaarNumber,
        username,
        mobileNumber,
        phone: mobileNumber,
        email,
        role,
        status: 'ACTIVE',
        designation,
        district: loc.district || 'Murshidabad',
        areaType: loc.areaType || 'RURAL',
        blockOrMunicipality: loc.block || '',
        gpOrWard: loc.gpOrWard || '',
        villageOrWard: loc.village || loc.gpOrWard || '',
        postOffice: loc.postOffice || '',
        policeStation: loc.policeStation || '',
        pinCode: loc.pinCode || '',
        address,
        allowDuplicateException,
        duplicateExceptionReason
      });

      if (res.success) {
        closeModal();
        showToast(res.message || `Account ${res.uid} created successfully.`, 'success');
        AppState.currentRoute = role === 'MANAGER' && isActorAdmin ? 'admin-managers' : 'admin-staff';
        window.location.hash = `#${AppState.currentRoute}`;
        render();
        if (res.temporaryPassword && res.uid) {
          window.MJK.showOneTimeCredentialsModal(
            `${role === 'MANAGER' ? 'Manager' : 'Staff'} Account Created`,
            res.uid,
            res.temporaryPassword,
            'Share this one-time 12-character temporary password securely. The user must change it upon first sign-in.'
          );
        }
      } else {
        showToast(res.message || 'Failed to create account.', 'danger');
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  refreshApprovalPanel: async () => {
    const actor = getCurrentUser();
    const isActorAdmin = isMainAdmin(actor) || String(actor?.role || '').toUpperCase() === 'ADMIN';
    const tasks = [
      fetchUsersFromBackend(),
      fetchPasswordResetReferences().then(refs => { AppState.resetReferences = refs; })
    ];
    if (isActorAdmin) {
      tasks.push(fetchAuditLogsFromBackend().then(logs => {
        if (Array.isArray(logs)) setItem(KEYS.AUDIT_LOGS, logs);
      }));
    }
    await Promise.allSettled(tasks);
    render();
    showToast('User directory & reset references refreshed.', 'info');
  },

  handleViewUserDetails: (targetKey) => {
    const users = getAllUsers();
    const u = users.find(x => (x.uid || x.id) === targetKey);
    if (!u) return;

    const content = `
      <div class="erp-grid-2-tight" style="font-size:0.83rem; margin-bottom:1rem;">
        <div><strong>Permanent User ID:</strong> <span class="font-mono" style="color:var(--blue-600); font-weight:700;">${escHtml(u.uid)}</span></div>
        <div><strong>Username:</strong> <span class="font-mono">@${escHtml(u.username || u.uid)}</span></div>
        <div><strong>Full Name:</strong> ${escHtml(u.name)}</div>
        <div><strong>Date of Birth:</strong> <span class="font-mono">${escHtml(u.dob || '-')}</span></div>
        <div><strong>Role &amp; Designation:</strong> <span class="badge badge-info">${escHtml(formatRoleLabel(u.role))}</span> ${escHtml(u.designation || '')}</div>
        <div><strong>Mobile (Masked):</strong> <span class="font-mono">${escHtml(u.phoneMasked || (u.mobileNumber ? 'XXXXXX' + String(u.mobileNumber).slice(-4) : '-'))}</span></div>
        <div><strong>Aadhaar (Masked):</strong> <span class="font-mono">${escHtml(u.aadhaarMasked || 'XXXX XXXX XXXX')}</span></div>
        <div><strong>Email Address:</strong> ${escHtml(u.email || '-')}</div>
        <div><strong>Account Status:</strong> <strong>${escHtml(u.status || 'ACTIVE')}</strong></div>
        <div><strong>Created By:</strong> <span class="font-mono">${escHtml(u.createdBy || 'SYSTEM')}</span></div>
        <div><strong>Registration Date (IST):</strong> <span class="font-mono">${escHtml(u.registrationDate || formatDate(u.createdAt))}</span></div>
        <div><strong>Registration Time (IST):</strong> <span class="font-mono">${escHtml(u.registrationTime || '-')}</span></div>
        <div><strong>Last Login:</strong> ${u.lastLoginAt ? `${formatDateTime(u.lastLoginAt)}` : 'Never signed in'}</div>
        <div><strong>Password Changes:</strong> <span class="font-mono">${Number(u.passwordChangeCount || 0)}</span></div>
      </div>
      <div style="font-size:0.8rem; margin-bottom:0.65rem; padding:0.6rem; background:var(--surface-alt); border-radius:var(--radius-sm);">
        <strong>Address:</strong> ${escHtml(u.address || '-')}
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
        <button class="btn btn-secondary" onclick="window.MJK.closeModal()">Close</button>
      </div>
    `;
    openModal(`Account Profile (${u.uid})`, content, null, 'modal-lg');
  },

  openEditUserModal: (targetKey) => {
    const actor = getCurrentUser();
    const isActorAdmin = isMainAdmin(actor) || String(actor?.role || '').toUpperCase() === 'ADMIN';
    const users = getAllUsers();
    const u = users.find(x => (x.uid || x.id) === targetKey);
    if (!u) return;
    const isPermanentMain = String(u.uid || '').toUpperCase() === MAIN_ADMIN_UID || u.isMainAdmin === true;

    const content = `
      <form onsubmit="window.MJK.handleEditUserSubmit(event, '${escHtml(u.uid)}')">
        <div style="padding:0.65rem 0.85rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); margin-bottom:1rem; font-size:0.78rem;">
          <strong>User ID (Permanent &amp; Immutable):</strong> <span class="font-mono" style="color:var(--blue-600); font-weight:700;">${escHtml(u.uid)}</span>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input type="text" id="edit-user-name" class="form-control" required value="${escHtml(u.name || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Username *</label>
            <input type="text" id="edit-user-username" class="form-control font-mono" required value="${escHtml(u.username || '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">10-Digit Mobile Number</label>
            <input type="tel" id="edit-user-phone" class="form-control font-mono" maxlength="10" pattern="[0-9]{10}" placeholder="Leave unchanged or enter 10 digits" value="">
          </div>
          <div class="form-group">
            <label class="form-label">Email Address *</label>
            <input type="email" id="edit-user-email" class="form-control" required value="${escHtml(u.email || '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Role</label>
            ${isPermanentMain ? `
              <input type="text" class="form-control" value="ADMINISTRATION (Protected)" readonly>
              <input type="hidden" id="edit-user-role" value="ADMIN">
            ` : `
              <select id="edit-user-role" class="form-control" ${!isActorAdmin ? 'disabled' : ''}>
                ${isActorAdmin ? `<option value="MANAGER" ${u.role === 'MANAGER' ? 'selected' : ''}>MANAGER</option>` : ''}
                <option value="STAFF" ${u.role !== 'MANAGER' ? 'selected' : ''}>STAFF</option>
              </select>
            `}
          </div>
          <div class="form-group">
            <label class="form-label">Account Status</label>
            ${isPermanentMain ? `
              <input type="text" class="form-control" value="ACTIVE (Permanent)" readonly>
              <input type="hidden" id="edit-user-status" value="ACTIVE">
            ` : `
              <select id="edit-user-status" class="form-control">
                <option value="ACTIVE" ${u.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
                <option value="INACTIVE" ${u.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option>
                <option value="SUSPENDED" ${u.status === 'SUSPENDED' ? 'selected' : ''}>SUSPENDED</option>
              </select>
            `}
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Designation</label>
            <input type="text" id="edit-user-designation" class="form-control" value="${escHtml(u.designation || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Full Address</label>
            <input type="text" id="edit-user-address" class="form-control" value="${escHtml(u.address || '')}">
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    `;
    openModal(`Edit User Profile (${u.uid})`, content, null, 'modal-lg');
  },

  handleEditUserSubmit: async (e, targetKey) => {
    e.preventDefault();
    const phoneInput = document.getElementById('edit-user-phone')?.value?.trim();
    const res = await editUser({
      uid: targetKey,
      fullName: document.getElementById('edit-user-name')?.value?.trim(),
      username: document.getElementById('edit-user-username')?.value?.trim(),
      ...(phoneInput ? { mobileNumber: phoneInput } : {}),
      email: document.getElementById('edit-user-email')?.value?.trim(),
      role: document.getElementById('edit-user-role')?.value,
      status: document.getElementById('edit-user-status')?.value,
      designation: document.getElementById('edit-user-designation')?.value?.trim(),
      address: document.getElementById('edit-user-address')?.value?.trim()
    });
    if (res.success) {
      closeModal();
      await window.MJK.refreshApprovalPanel();
      showToast(res.message || 'User profile updated.', 'success');
    } else {
      showToast(res.message || 'Failed to update user.', 'danger');
    }
  },

  showOneTimeCredentialsModal: (title, uid, temporaryPassword, note) => {
    const content = `
      <div style="padding:0.5rem 0;">
        <div style="background:var(--warning-bg); border:1px solid var(--warning-border); border-radius:var(--radius-md); padding:0.75rem; font-size:0.8rem; margin-bottom:1rem;">
          <strong>Shown Once Only:</strong> Copy and share this temporary password securely with the user. It is hashed immediately with Argon2id on the server and cannot be retrieved again.
        </div>
        <div style="padding:0.9rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:0.75rem;">
          <div style="font-size:0.74rem; color:var(--text-muted);">Permanent User ID (UID)</div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-top:0.2rem;">
            <strong class="font-mono" style="font-size:1.1rem; color:var(--blue-600);">${escHtml(uid)}</strong>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.copyText('${escHtml(uid)}', 'UID copied!')">Copy UID</button>
          </div>
        </div>
        <div style="padding:0.9rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:1rem;">
          <div style="font-size:0.74rem; color:var(--text-muted);">One-Time Cryptographic Temporary Password</div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-top:0.2rem;">
            <strong class="font-mono" style="font-size:1.15rem; color:var(--success); letter-spacing:0.5px;">${escHtml(temporaryPassword)}</strong>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.copyText('${escHtml(temporaryPassword)}', 'Temporary password copied!')">Copy Password</button>
          </div>
        </div>
        ${note ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:1rem;">${escHtml(note)}</div>` : ''}
        <div style="display:flex; justify-content:flex-end;">
          <button type="button" class="btn btn-primary" onclick="window.MJK.closeModal()">Done</button>
        </div>
      </div>
    `;
    openModal(title, content, null);
  },

  handleApproveStaff: async () => {},
  handleRejectStaff: async () => {},
  confirmRejectStaff: async () => {},
  handleRequestCorrection: () => {},
  confirmRequestCorrection: async () => {},

  handleToggleUserStatus: async (targetKey, nextStatus = undefined) => {
    const res = await toggleUserStatus(targetKey, nextStatus);
    if (res.success) {
      await window.MJK.refreshApprovalPanel();
      showToast(res.message, 'info');
    } else {
      showToast(res.message, 'danger');
    }
  },

  handleResetStaffPassword: (uid) => {
    showConfirmDialog('Generate New Temporary Password?', `Issue a fresh one-time temporary password for ${uid}? Active sessions will be revoked and password change will be required on next login.`, async () => {
      const res = await resetUserPassword(uid);
      if (res.success) {
        render();
        if (res.temporaryPassword) {
          window.MJK.showOneTimeCredentialsModal(
            'New One-Time Temporary Password Issued',
            res.uid || uid,
            res.temporaryPassword,
            'All existing active sessions for this user have been invalidated.'
          );
        } else {
          showToast(res.message, 'success');
        }
      } else {
        showToast(res.message, 'danger');
      }
    });
  },
  render: (preserveRoute = true, explicitMount = null) => {
    if (!preserveRoute) {
      AppState.currentRoute = 'dashboard';
      if (window.location && window.location.hash !== '#dashboard') {
        if (window.history && typeof window.history.replaceState === 'function') {
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#dashboard`);
        } else {
          window.location.hash = '#dashboard';
        }
      }
    }
    render(explicitMount);
  },

  openSmsConfigModal: async () => {
    let currentConfig = { provider: 'fast2sms', apiKey: '', senderId: 'MUNCMP', enabled: true };
    try {
      const r = await fetch('/api/sms/config');
      if (r.ok) {
        const d = await r.json();
        if (d.config) currentConfig = d.config;
      }
    } catch {}

    const content = `
      <form id="sms-config-form" onsubmit="window.MJK.handleSaveSmsConfig(event)">
        <div class="form-group">
          <label class="form-label">SMS Provider Gateway *</label>
          <select id="sms-provider" class="form-control" onchange="window.MJK.onSmsProviderChange(this.value)">
            <option value="fast2sms" ${currentConfig.provider === 'fast2sms' ? 'selected' : ''}>Fast2SMS (India DLT & Quick SMS)</option>
            <option value="twilio" ${currentConfig.provider === 'twilio' ? 'selected' : ''}>Twilio Global SMS</option>
            <option value="msg91" ${currentConfig.provider === 'msg91' ? 'selected' : ''}>MSG91 India</option>
            <option value="generic" ${currentConfig.provider === 'generic' ? 'selected' : ''}>Custom HTTP Webhook API</option>
          </select>
        </div>

        <div id="sms-fast2sms-fields" style="display:${currentConfig.provider === 'fast2sms' ? 'block' : 'none'};">
          <div class="form-group">
            <label class="form-label">Fast2SMS Authorization API Key</label>
            <input type="password" id="fast2sms-key" class="form-control" placeholder="Enter Fast2SMS API Key" value="${currentConfig.apiKey || ''}">
            <small style="font-size:0.72rem; color:var(--text-muted); margin-top:0.2rem; display:block;">
              Obtain from Fast2SMS Dev API Console. Dispatches instant 6-digit OTPs to Indian mobile numbers.
            </small>
          </div>
        </div>

        <div id="sms-twilio-fields" style="display:${currentConfig.provider === 'twilio' ? 'block' : 'none'};">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Account SID</label>
              <input type="text" id="twilio-sid" class="form-control" placeholder="ACxxxxxxxxxxxxxx">
            </div>
            <div class="form-group">
              <label class="form-label">Auth Token</label>
              <input type="password" id="twilio-token" class="form-control" placeholder="Auth Token">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">From Phone Number (E.164)</label>
            <input type="text" id="twilio-from" class="form-control" placeholder="+1234567890">
          </div>
        </div>

        <div id="sms-generic-fields" style="display:${currentConfig.provider === 'generic' ? 'block' : 'none'};">
          <div class="form-group">
            <label class="form-label">Webhook Endpoint URL</label>
            <input type="url" id="generic-url" class="form-control" placeholder="https://api.sms-provider.com/v1/send">
          </div>
          <div class="form-group">
            <label class="form-label">Bearer Token / API Key</label>
            <input type="password" id="generic-key" class="form-control" placeholder="Bearer Token">
          </div>
        </div>

        <div style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.75rem; margin:1rem 0; font-size:0.78rem;">
          <div>📡 <strong>Live SMS Gateway Status:</strong> <span style="color:${currentConfig.isConfigured ? 'var(--success)' : 'var(--warning)'}; font-weight:700;">${currentConfig.isConfigured ? 'Connected & Active' : 'Setup Required'}</span></div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.2rem;">All staff registration and password recovery OTPs will be dispatched through this provider.</div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.5rem;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.handleTestSms()">⚡ Send Test SMS</button>
          <div style="display:flex; gap:0.5rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Close</button>
            <button type="submit" class="btn btn-primary">Save SMS Configuration</button>
          </div>
        </div>
      </form>
    `;
    openModal('SMS Gateway Configuration (Fast2SMS / Twilio)', content, null);
  },

  onSmsProviderChange: (provider) => {
    const fFast = document.getElementById('sms-fast2sms-fields');
    const fTwil = document.getElementById('sms-twilio-fields');
    const fGen = document.getElementById('sms-generic-fields');
    if (fFast) fFast.style.display = provider === 'fast2sms' ? 'block' : 'none';
    if (fTwil) fTwil.style.display = provider === 'twilio' ? 'block' : 'none';
    if (fGen) fGen.style.display = provider === 'generic' ? 'block' : 'none';
  },

  handleSaveSmsConfig: async (e) => {
    e.preventDefault();
    const provider = document.getElementById('sms-provider')?.value || 'fast2sms';
    const apiKey = document.getElementById('fast2sms-key')?.value || document.getElementById('generic-key')?.value || '';
    const accountSid = document.getElementById('twilio-sid')?.value || '';
    const authToken = document.getElementById('twilio-token')?.value || '';
    const fromPhone = document.getElementById('twilio-from')?.value || '';
    const apiUrl = document.getElementById('generic-url')?.value || '';

    try {
      const resp = await fetch('/api/sms/config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ provider, apiKey, accountSid, authToken, fromPhone, apiUrl, enabled: true })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        showToast('SMS Gateway settings updated successfully.', 'success');
        closeModal();
      } else {
        showToast(data.message || 'Failed to save SMS settings.', 'danger');
      }
    } catch {
      showToast('Error communicating with backend server.', 'danger');
    }
  },

  handleTestSms: async () => {
    showToast('Sending live test SMS via configured gateway...', 'info');
    try {
      const resp = await fetch('/api/sms/test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ phone: '8101352105' })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        showToast(data.message || 'Test SMS sent successfully!', 'success');
      } else {
        showToast(data.message || 'SMS delivery failed. Check gateway credentials.', 'danger');
      }
    } catch {
      showToast('SMS Gateway test failed.', 'danger');
    }
  },

  openNewEntryModal: () => {
    const categories = getServiceCategories();
    const content = `
      <div class="erp-grid-2-tight">
        <button class="btn btn-primary" style="padding:1rem; flex-direction:column; gap:0.35rem;" onclick="window.MJK.openCustomerModal();">
          <span style="font-size:1.4rem;">👥</span>
          <strong>Register Customer</strong>
        </button>
        <button class="btn btn-violet" style="padding:1rem; flex-direction:column; gap:0.35rem;" onclick="window.MJK.openServiceModal();">
          <span style="font-size:1.4rem;">📑</span>
          <strong>New Service / PNB BC</strong>
        </button>
        <button class="btn btn-success" style="padding:1rem; flex-direction:column; gap:0.35rem;" onclick="window.MJK.openCashCollectionModal();">
          <span style="font-size:1.4rem;">💰</span>
          <strong>Cash Collection</strong>
        </button>
        <button class="btn btn-orange" style="padding:1rem; flex-direction:column; gap:0.35rem;" onclick="window.MJK.openCounterCashTxnModal('CASH_RECEIVED');">
          <span style="font-size:1.4rem;">📒</span>
          <strong>Counter Cash Entry</strong>
        </button>
        <button class="btn btn-secondary" style="padding:0.85rem; flex-direction:row; gap:0.5rem; grid-column:1/-1; justify-content:center; align-items:center;" onclick="window.MJK.openReminderModal();">
          <span style="font-size:1.2rem;">📅</span>
          <strong>Schedule Seminar / Gas Delivery / Promo Reminder</strong>
        </button>
        <button class="btn btn-secondary" style="padding:0.85rem; flex-direction:row; gap:0.5rem; grid-column:1/-1; justify-content:center; align-items:center;" onclick="window.MJK.openFollowupModal();">
          <span style="font-size:1.2rem;">📞</span>
          <strong>Schedule 90-Day Follow-up</strong>
        </button>
        <button class="btn btn-success" style="padding:0.85rem; flex-direction:row; gap:0.5rem; grid-column:1/-1; justify-content:center; align-items:center;" onclick="window.MJK.openWhatsAppConnectModal({ context: 'GENERAL' });">
          <span style="font-size:1.2rem;">💬</span>
          <strong>Customer WhatsApp Auto Connect (+91)</strong>
        </button>
        <button class="btn btn-outline" style="padding:0.85rem; flex-direction:row; gap:0.5rem; grid-column:1/-1; justify-content:center; align-items:center;" onclick="window.MJK.openCategoryCatalogModal();">
          <span style="font-size:1.2rem;">📋</span>
          <strong>Explore All ${categories.length} Service Categories & Subcategories</strong>
        </button>
      </div>
    `;
    openModal('Quick Action (MUN COMPUTER)', content, null);
  },

  /* ==========================================================================
     1. DEDICATED CASH COLLECTION MODULE (QUICK DUES & INSTANT RECEIPT)
     ========================================================================== */
  openCashCollectionModal: (customerId = '', preselectRefId = '') => {
    const customers = getAllCustomers();
    const duesReport = getCustomerDuesReport();
    const selectedCustId = customerId || '';
    const receivables = selectedCustId ? getCustomerOutstandingReceivables(selectedCustId) : getCustomerOutstandingReceivables('');
    const totalPendingAll = duesReport.reduce((sum, d) => sum + (Number(d.totalDue) || 0), 0);
    const upi = getUpiPaymentSettings();

    const content = `
      <form id="cash-collect-form" onsubmit="window.MJK.submitCashCollection(event, false)">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding:0.7rem 0.9rem; background:#ecfdf5; border:1px solid #86efac; border-radius:var(--radius-md); margin-bottom:0.85rem;">
          <div>
            <div style="font-size:0.74rem; font-weight:800; color:#166534; text-transform:uppercase;">Quick Cash &amp; Due Collection Counter</div>
            <div style="font-size:0.78rem; color:#15803d;">Collect pending customer dues or instant walk-in payments with 1-click receipt</div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:0.7rem; color:#166534; display:block;">Total Market Pending</span>
            <strong class="font-mono tabular-nums" style="color:#dc2626; font-size:1rem;">${formatINR(totalPendingAll)}</strong>
            <div style="font-size:0.66rem; color:#166534; font-weight:600;">${escHtml(numberToWords(totalPendingAll))}</div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Select Customer (Optional for Instant Walk-in)</label>
            <select id="cc-cust-id" class="form-control" onchange="window.MJK.onCashCollectCustomerChange(this.value)">
              <option value="">-- Instant Walk-in / Search All Pending Dues --</option>
              ${customers.map(c => {
                const dueRow = duesReport.find(d => d.customerId === c.id);
                const dueLabel = dueRow && dueRow.totalDue > 0 ? ` — Due: ${formatINR(dueRow.totalDue)}` : '';
                return `<option value="${escHtml(c.id)}" ${selectedCustId === c.id ? 'selected' : ''}>${escHtml(c.name)} (${escHtml(c.phone || '-')})${dueLabel}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group" id="cc-walkin-name-wrap" style="${selectedCustId ? 'display:none;' : ''}">
            <label class="form-label">Walk-in / Payer Name</label>
            <input type="text" id="cc-walkin-name" class="form-control" placeholder="e.g. Walk-in Customer / Counter Client">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Link to Pending Receipt / Invoice (Auto-Updates Due Balance)</label>
          <select id="cc-target-ref" class="form-control" onchange="window.MJK.onCashCollectTargetChange(this.value)">
            <option value="">-- Instant Standalone Cash Collection (No Pending Bill) --</option>
            ${receivables.map(r => {
              const key = `${r.refType}::${r.refId}`;
              const isSel = preselectRefId && (r.refId === preselectRefId || r.serviceId === preselectRefId || r.invoiceId === preselectRefId);
              return `<option value="${escHtml(key)}" data-custid="${escHtml(r.customerId)}" data-due="${r.dueAmount}" data-label="${escHtml(r.label)}" ${isSel ? 'selected' : ''}>[${r.refType === 'invoice' ? 'INV' : 'RCPT'} ${escHtml(r.refId)}] ${escHtml(r.customerName)} · ${escHtml(r.label)} · Due: ${formatINR(r.dueAmount)}</option>`;
            }).join('')}
          </select>
          <div id="cc-target-summary" style="font-size:0.74rem; color:var(--text-muted); margin-top:0.25rem;">
            ${receivables.length > 0 ? `${receivables.length} pending due receipt(s) found.` : 'No pending dues for this selection — ready for instant cash collection.'}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Collection Amount (₹) <span class="req">*</span></label>
            <input type="number" id="cc-amount" class="form-control font-mono tabular-nums" min="1" step="any" required placeholder="Enter amount collected" oninput="window.MJK.updateCashCollectionWords()">
            <div id="cc-amount-words" class="amount-words-hint" style="display:none; font-size:0.74rem; font-weight:700;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Payment Mode <span class="req">*</span></label>
            <select id="cc-method" class="form-control" required onchange="window.MJK.onCashCollectMethodChange(this.value)">
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="QR">QR</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Card">Card</option>
            </select>
          </div>
        </div>

        <div id="cc-upi-qr-box" style="display:none; margin-bottom:0.85rem; padding:0.75rem; border:1px solid var(--border-strong); border-radius:var(--radius-md); background:var(--surface-alt);">
          <div style="font-size:0.78rem; font-weight:800; margin-bottom:0.4rem;">ONLINE PAYMENT – UPI (Admin Configured)</div>
          <div style="display:flex; gap:0.85rem; align-items:center; flex-wrap:wrap;">
            ${upi.qrImageDataUrl ? `<img src="${escHtml(upi.qrImageDataUrl)}" alt="UPI QR" style="width:92px; height:92px; object-fit:contain; border:1px solid #000; background:#fff; padding:3px;">` : '<div style="font-size:0.76rem; padding:8px; border:1px dashed var(--border-strong);">No Admin QR uploaded yet.</div>'}
            <div style="font-size:0.8rem; line-height:1.45;">
              <div><strong>UPI ID:</strong> <span class="font-mono">${escHtml(upi.upiId || 'Not configured')}</span></div>
              <div><strong>Payment Name:</strong> ${escHtml(upi.upiDisplayName || 'Not configured')}</div>
              <div style="font-size:0.73rem; color:var(--text-muted); margin-top:2px;">Displaying QR does NOT mark payment Paid. Confirm UTR or verify receipt below.</div>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Collection Date</label>
            <input type="date" id="cc-date" class="form-control" value="${getTodayDate()}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Transaction ID / UTR / Voucher No</label>
            <input type="text" id="cc-ref" class="form-control font-mono" placeholder="UTR / UPI Ref / Cash Counter Ref">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Collection Particulars / Remarks</label>
          <input type="text" id="cc-remarks" class="form-control" placeholder="e.g. Customer Due Collection / Gas Accessory Cash / Service Balance">
        </div>

        <div id="cc-verify-wrap" style="display:none; padding:0.65rem 0.8rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-alt); margin-bottom:0.75rem;">
          <label style="display:flex; align-items:flex-start; gap:0.5rem; font-size:0.8rem; cursor:pointer; margin:0;">
            <input type="checkbox" id="cc-pay-verified" style="margin-top:3px;">
            <span><strong>Payment Verified &amp; Confirmed</strong> (I have verified bank credit / UTR settlement. Leave unchecked if QR was scanned and confirmation is still pending.)</span>
          </label>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap; margin-top:1.15rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-outline" style="font-weight:700;">💾 Save Collection</button>
          <button type="button" class="btn btn-primary" style="font-weight:700;" onclick="window.MJK.submitCashCollection(null, true)">💾 Save &amp; Print Receipt</button>
        </div>
      </form>
    `;
    openModal('💰 Cash & Due Collection (MUN COMPUTER)', content, null, 'modal-lg');
    setTimeout(() => {
      const sel = document.getElementById('cc-target-ref');
      if (sel && sel.value) {
        window.MJK.onCashCollectTargetChange(sel.value);
      } else if (selectedCustId && receivables.length === 1) {
        sel.value = `${receivables[0].refType}::${receivables[0].refId}`;
        window.MJK.onCashCollectTargetChange(sel.value);
      } else {
        window.MJK.updateCashCollectionWords();
      }
      window.MJK.onCashCollectMethodChange(document.getElementById('cc-method')?.value || 'Cash');
    }, 40);
  },

  onCashCollectMethodChange: (mode) => {
    const isDigital = /upi|qr|bank|card/i.test(String(mode || ''));
    const qrBox = document.getElementById('cc-upi-qr-box');
    const verWrap = document.getElementById('cc-verify-wrap');
    if (qrBox) qrBox.style.display = /upi|qr/i.test(String(mode || '')) ? 'block' : 'none';
    if (verWrap) verWrap.style.display = isDigital ? 'block' : 'none';
  },

  onCashCollectCustomerChange: (customerId) => {
    const walkinWrap = document.getElementById('cc-walkin-name-wrap');
    if (walkinWrap) walkinWrap.style.display = customerId ? 'none' : '';
    const sel = document.getElementById('cc-target-ref');
    const summaryEl = document.getElementById('cc-target-summary');
    if (!sel) return;

    const receivables = getCustomerOutstandingReceivables(customerId || '');
    sel.innerHTML = `<option value="">-- Instant Standalone Cash Collection (No Pending Bill) --</option>` +
      receivables.map(r => `<option value="${escHtml(`${r.refType}::${r.refId}`)}" data-custid="${escHtml(r.customerId)}" data-due="${r.dueAmount}" data-label="${escHtml(r.label)}">[${r.refType === 'invoice' ? 'INV' : 'RCPT'} ${escHtml(r.refId)}] ${escHtml(r.customerName)} · ${escHtml(r.label)} · Due: ${formatINR(r.dueAmount)}</option>`).join('');

    if (summaryEl) {
      summaryEl.textContent = receivables.length > 0
        ? `${receivables.length} pending due receipt(s) found. Select one to auto-fill due amount.`
        : 'No pending dues for this customer — ready for instant cash collection.';
    }
    if (customerId && receivables.length === 1) {
      sel.value = `${receivables[0].refType}::${receivables[0].refId}`;
      window.MJK.onCashCollectTargetChange(sel.value);
    }
  },

  onCashCollectTargetChange: (refKey) => {
    const sel = document.getElementById('cc-target-ref');
    const amtInput = document.getElementById('cc-amount');
    const remInput = document.getElementById('cc-remarks');
    const custSel = document.getElementById('cc-cust-id');
    const walkinWrap = document.getElementById('cc-walkin-name-wrap');
    const opt = sel?.selectedOptions?.[0];
    if (!opt || !refKey) return;

    const dueAmt = Number(opt.getAttribute('data-due')) || 0;
    const label = opt.getAttribute('data-label') || '';
    const refCustId = opt.getAttribute('data-custid') || '';
    if (refCustId && custSel && !custSel.value) {
      custSel.value = refCustId;
      if (walkinWrap) walkinWrap.style.display = 'none';
    }
    if (amtInput && dueAmt > 0) amtInput.value = dueAmt;
    if (remInput && !remInput.value) remInput.value = `Due Collection — ${label}`;
    window.MJK.updateCashCollectionWords();
  },

  updateCashCollectionWords: () => {
    const inputEl = document.getElementById('cc-amount');
    if (inputEl) syncAmountWords(inputEl, 'cc-amount-words');
  },

  submitCashCollection: async (e, printAfter = false) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    try {
      if (!canMenu('payments', 'add')) {
        showToast('Permission Denied: You cannot collect payments.', 'danger');
        return;
      }

      const custId = document.getElementById('cc-cust-id')?.value || '';
      const cust = custId ? getCustomerById(custId) : null;
      const walkinName = document.getElementById('cc-walkin-name')?.value?.trim() || '';
      const targetKey = document.getElementById('cc-target-ref')?.value || '';
      const amount = Number(document.getElementById('cc-amount')?.value) || 0;
      const method = document.getElementById('cc-method')?.value || 'Cash';
      const paymentDate = document.getElementById('cc-date')?.value || getTodayDate();
      const reference = document.getElementById('cc-ref')?.value?.trim() || '';
      const remarks = document.getElementById('cc-remarks')?.value?.trim() || '';

      const isDigital = /upi|qr|bank|card/i.test(String(method || ''));
      const isConfirmed = isDigital ? Boolean(document.getElementById('cc-pay-verified')?.checked) : true;

      if (amount <= 0) {
        showToast('Please enter a valid collection amount greater than zero.', 'warning');
        return;
      }

      if (isDigital && isConfirmed && !reference) {
        showToast('Please enter the verified Transaction ID / UTR Number before marking digital payment Paid.', 'warning');
        return;
      }

      const cashLimit = getCashOperationLimit();
      if (String(method).toLowerCase().includes('cash') && cashLimit > 0 && amount > cashLimit) {
        showToast(`Cash Operation Limit Exceeded: Your limit is ${formatINR(cashLimit)} per transaction.`, 'danger');
        return;
      }

      let serviceId = '';
      let receiptId = '';
      let invoiceId = '';
      let collectionType = 'Instant Cash Collection';
      let skipServiceSync = true;
      let skipInvoiceSync = true;

      if (targetKey.includes('::')) {
        const [refType, refId] = targetKey.split('::');
        collectionType = 'Due Collection';
        if (refType === 'invoice') {
          invoiceId = refId;
          receiptId = refId;
          skipInvoiceSync = false;
        } else {
          receiptId = refId;
          const matchSrv = getAllServices().find(s => (s.receiptId || s.id) === refId);
          serviceId = matchSrv?.id || refId;
          skipServiceSync = false;
        }
      }

      const res = await recordPayment({
        customerId: custId,
        customerName: cust ? cust.name : (walkinName || 'Walk-in Customer'),
        customerPhone: cust?.phone || '',
        serviceId,
        receiptId,
        invoiceId,
        skipServiceSync,
        skipInvoiceSync,
        collectionType,
        paymentMethod: method,
        paymentAmount: amount,
        paymentDate,
        transactionId: reference,
        reference,
        remarks: remarks || `${collectionType} (${method})`,
        verified: isConfirmed,
        operatorConfirmed: isConfirmed,
        receivedBy: getCurrentUser()?.name || 'Staff',
        verifiedBy: isConfirmed ? (getCurrentUser()?.name || 'Staff') : ''
      });

      if (!res?.success) {
        showToast(res?.message || 'Failed to record collection.', 'danger');
        return;
      }

      closeModal();
      showToast(
        isConfirmed
          ? `Collected ${formatINR(amount)} (${numberToWords(amount)}) via ${method}.`
          : `Collection logged as Pending Verification (${res.payment?.id}). Confirm UTR to mark Paid.`,
        isConfirmed ? 'success' : 'info'
      );
      EnterpriseExt.refreshUniversalSearchIfActive();
      render();
      if (printAfter && res.payment?.id) {
        setTimeout(() => window.MJK.printPaymentReceipt(res.payment.id), 90);
      }
    } catch (err) {
      showToast(err?.message || 'Failed to record cash collection.', 'danger');
    }
  },

  /* ==========================================================================
     2. SEMINAR, GAS DELIVERY & PROMOTIONAL REMINDER SYSTEM
     ========================================================================== */
  setFollowupViewMode: (mode) => {
    AppState.followupViewMode = mode === 'reminders' ? 'reminders' : 'cases';
    render();
  },

  setReminderBucketFilter: (bucket) => {
    AppState.reminderBucketFilter = bucket || 'all';
    render();
  },

  setReminderTypeFilter: (type) => {
    AppState.reminderTypeFilter = type || 'all';
    render();
  },

  setReminderSearchQuery: (q) => {
    AppState.reminderSearchQuery = q || '';
    scheduleSearchRender();
  },

  openReminderModal: (prefillCustomerId = '', reminderId = '') => {
    const customers = getAllCustomers();
    const existing = reminderId ? getAllReminders().find(r => r.id === reminderId) : null;
    const custId = existing?.customerId || prefillCustomerId || '';
    const cust = custId ? getCustomerById(custId) : null;
    const activeStaff = getAllUsers().filter(u => u.status === 'ACTIVE' && u.uid);

    const content = `
      <form id="smart-reminder-form" onsubmit="window.MJK.handleSaveSmartReminder(event)">
        <input type="hidden" id="rem-id" value="${escHtml(existing?.id || '')}">

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Reminder Category <span class="req">*</span></label>
            <select id="rem-type" class="form-control" required>
              ${REMINDER_TYPES.map(rt => `<option value="${escHtml(rt)}" ${(existing?.reminderType || 'Product Seminar') === rt ? 'selected' : ''}>${escHtml(rt)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Link Customer Profile</label>
            <select id="rem-cust-id" class="form-control" onchange="window.MJK.onReminderCustomerSelect(this.value)">
              <option value="">-- Select Customer (or enter details below) --</option>
              ${customers.map(c => `<option value="${escHtml(c.id)}" ${custId === c.id ? 'selected' : ''}>${escHtml(c.name)} (${escHtml(c.phone || '-')})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Customer Name <span class="req">*</span></label>
            <input type="text" id="rem-cust-name" class="form-control" required value="${escHtml(existing?.customerName || cust?.name || '')}" placeholder="Customer full name">
          </div>
          <div class="form-group">
            <label class="form-label">Mobile Number</label>
            <input type="tel" id="rem-phone" class="form-control font-mono" value="${escHtml(existing?.phone || cust?.phone || '')}" placeholder="10-digit mobile">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Event / Seminar Tag / Title <span class="req">*</span></label>
            <input type="text" id="rem-title" class="form-control" required value="${escHtml(existing?.title || existing?.seminarTag || '')}" placeholder="e.g. LPG Safety Seminar, Gas Cylinder Refill, Promo Call">
          </div>
          <div class="form-group">
            <label class="form-label">Assigned Staff</label>
            <select id="rem-staff" class="form-control">
              ${activeStaff.map(u => `<option value="${escHtml(u.uid)}" ${(existing?.assignedStaff || getCurrentUser()?.uid || '') === u.uid ? 'selected' : ''}>${escHtml(u.name)} (${escHtml(u.uid)})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Reminder Date <span class="req">*</span></label>
            <input type="date" id="rem-date" class="form-control" required value="${escHtml(existing?.reminderDate || getTodayDate())}">
          </div>
          <div class="form-group">
            <label class="form-label">Reminder Time <span class="req">*</span></label>
            <input type="time" id="rem-time" class="form-control" required value="${escHtml(existing?.reminderTime || '10:00')}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Reminder Notes / Action Details</label>
          <textarea id="rem-note" class="form-control" rows="2" placeholder="Seminar venue/batch, gas pipe/regulator check, promotional offer details...">${escHtml(existing?.note || '')}</textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.1rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">💾 ${existing ? 'Update Reminder' : 'Schedule Reminder'}</button>
        </div>
      </form>
    `;
    openModal(existing ? 'Edit Scheduled Reminder' : '📅 Schedule Seminar / Gas / Promo Reminder', content, null);
  },

  onReminderCustomerSelect: (custId) => {
    const cust = custId ? getCustomerById(custId) : null;
    if (!cust) return;
    const nameEl = document.getElementById('rem-cust-name');
    const phoneEl = document.getElementById('rem-phone');
    if (nameEl) nameEl.value = cust.name || '';
    if (phoneEl) phoneEl.value = cust.phone || '';
  },

  handleSaveSmartReminder: async (e) => {
    e.preventDefault();
    try {
      const id = document.getElementById('rem-id')?.value || '';
      const res = await saveSmartReminder({
        id: id || undefined,
        reminderType: document.getElementById('rem-type')?.value || 'Product Seminar',
        customerId: document.getElementById('rem-cust-id')?.value || '',
        customerName: document.getElementById('rem-cust-name')?.value?.trim() || 'Customer',
        phone: document.getElementById('rem-phone')?.value?.trim() || '',
        title: document.getElementById('rem-title')?.value?.trim() || '',
        assignedStaff: document.getElementById('rem-staff')?.value || '',
        reminderDate: document.getElementById('rem-date')?.value || getTodayDate(),
        reminderTime: document.getElementById('rem-time')?.value || '10:00',
        note: document.getElementById('rem-note')?.value?.trim() || ''
      });
      if (!res?.success) {
        showToast(res?.message || 'Failed to save reminder.', 'danger');
        return;
      }
      closeModal();
      showToast(`${res.reminder.reminderType} reminder scheduled for ${formatDate(res.reminder.reminderDate)} at ${res.reminder.reminderTime}.`, 'success');
      checkDueDateTimeReminders();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save reminder.', 'danger');
    }
  },

  toggleSmartReminderDone: (id, markCompleted = true) => {
    const res = toggleCompleteSmartReminder(id, markCompleted);
    if (res?.success) {
      showToast(markCompleted ? 'Reminder marked Completed.' : 'Reminder reopened as Pending.', 'success');
      render();
    }
  },

  promptDeleteSmartReminder: (id) => {
    showConfirmDialog('Delete Reminder?', 'This removes the scheduled reminder permanently.', () => {
      deleteSmartReminder(id);
      showToast('Reminder deleted.', 'info');
      render();
    });
  },

  /* ==========================================================================
     3. DYNAMIC CUSTOM STATUS & CATEGORY MANAGEMENT
     ========================================================================== */
  promptInlineNewStatus: (targetSelectId = '') => {
    window.MJK.openManageDynamicOptionsModal('followup_status', targetSelectId);
  },

  openManageDynamicOptionsModal: (kind = 'followup_status', targetSelectId = '') => {
    const configMap = {
      service_status: {
        title: 'Manage Service Statuses',
        subtitle: 'Add custom statuses or remove unwanted custom statuses for Applications & Services. Built-in defaults stay protected.',
        placeholder: 'e.g. Sent to District Office / Ready for Delivery',
        records: getServiceStatusRecords()
      },
      service_category: {
        title: 'Manage Service & Product Categories',
        subtitle: 'Add custom categories (including Gas Accessories / Refill Services) or remove unwanted custom categories.',
        placeholder: 'e.g. Gas Cylinder & Safety Accessories',
        records: getServiceCategoryRecords()
      },
      followup_status: {
        title: 'Manage Follow-up Case Statuses',
        subtitle: 'Add custom Current Status options for Smart Follow-ups & Customer Applications.',
        placeholder: 'e.g. Seminar Invited / Waiting Gas Stock',
        records: getAdminOptions('application_status', { activeOnly: false })
      },
      followup_scheme: {
        title: 'Manage Schemes & Service Categories',
        subtitle: 'Add or remove custom Schemes, Gas Services & Categories used in Follow-ups and Customer Registration.',
        placeholder: 'e.g. LPG Pipeline & Safety Inspection',
        records: getAdminOptions('scheme_name', { activeOnly: false })
      }
    };
    const cfg = configMap[kind] || configMap.followup_status;

    const content = `
      <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">${escHtml(cfg.subtitle)}</div>

      <form onsubmit="window.MJK.submitAddDynamicOption(event, '${escAttrJs(kind)}', '${escAttrJs(targetSelectId)}')" style="display:flex; gap:0.5rem; margin-bottom:1rem; flex-wrap:wrap;">
        <input type="text" id="dyn-opt-label" class="form-control" style="flex:1; min-width:210px;" required placeholder="${escHtml(cfg.placeholder)}">
        <button type="submit" class="btn btn-primary">+ Add Custom Entry</button>
      </form>

      <div style="max-height:48vh; overflow-y:auto; border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
        <table class="data-table" style="font-size:0.82rem;">
          <thead>
            <tr>
              <th>Label</th>
              <th>Type</th>
              <th style="text-align:right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${cfg.records.map(r => `
              <tr>
                <td style="font-weight:700;">${escHtml(r.label)}</td>
                <td>
                  ${r.isDefault
                    ? '<span class="badge badge-neutral">System Default</span>'
                    : '<span class="badge badge-info">Custom Saved</span>'}
                </td>
                <td style="text-align:right;">
                  ${r.isDefault
                    ? '<span style="font-size:0.72rem; color:var(--text-muted);">Protected</span>'
                    : `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.deleteDynamicOption('${escAttrJs(kind)}', '${escAttrJs(r.id || r.label)}', '${escAttrJs(targetSelectId)}')">🗑 Delete</button>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:1rem;">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Done</button>
      </div>
    `;
    openModal(`⚙️ ${cfg.title}`, content, null);
  },

  submitAddDynamicOption: async (e, kind, targetSelectId = '') => {
    e.preventDefault();
    try {
      const label = document.getElementById('dyn-opt-label')?.value?.trim() || '';
      if (!label) return;

      let res = { success: false };
      if (kind === 'service_status') res = await addCustomServiceStatus(label);
      else if (kind === 'service_category') res = addCustomServiceCategory(label);
      else if (kind === 'followup_status') res = await saveCustomAdminOptionLocal('application_status', label);
      else if (kind === 'followup_scheme') res = await saveCustomAdminOptionLocal('scheme_name', label);

      if (!res?.success) {
        showToast(res?.message || 'Could not add custom entry.', 'warning');
        return;
      }

      showToast(`Added "${label}" permanently.`, 'success');
      render();

      // Update target select/datalist in background if modal is still behind
      if (targetSelectId) {
        const targetEl = document.getElementById(targetSelectId);
        if (targetEl && targetEl.tagName === 'SELECT') {
          const opt = document.createElement('option');
          opt.value = label;
          opt.textContent = label;
          targetEl.appendChild(opt);
          targetEl.value = label;
        } else if (targetEl && targetEl.tagName === 'INPUT') {
          targetEl.value = label;
        }
      }
      window.MJK.openManageDynamicOptionsModal(kind, targetSelectId);
    } catch (err) {
      showToast(err?.message || 'Failed to add custom entry.', 'danger');
    }
  },

  deleteDynamicOption: (kind, idOrLabel, targetSelectId = '') => {
    let res = { success: false };
    if (kind === 'service_status') res = deleteCustomServiceStatus(idOrLabel);
    else if (kind === 'service_category') res = deleteCustomServiceCategory(idOrLabel);
    else if (kind === 'followup_status') res = deleteCustomAdminOptionLocal(idOrLabel, 'application_status');
    else if (kind === 'followup_scheme') res = deleteCustomAdminOptionLocal(idOrLabel, 'scheme_name');

    if (!res?.success) {
      showToast(res?.message || 'Unable to delete entry.', 'warning');
      return;
    }
    showToast('Custom entry deleted.', 'info');
    render();
    window.MJK.openManageDynamicOptionsModal(kind, targetSelectId);
  }
};

// Initialize Government Schemes & Grievance Division, Banglar Yuva Siksha Barasa Card, Rate Chart, Extra Handlers, Operations Center & WhatsApp Connect
setupGovtHandlers(window.MJK, showToast, openModal, closeModal, showConfirmDialog, render);
setupYuvaSikshaHandlers(window.MJK, showToast, openModal, closeModal, render);
setupRateChartHandlers(window.MJK, showToast, openModal, closeModal, showConfirmDialog, render);
setupExtraHandlers(window.MJK, showToast, openModal, render, closeModal, showConfirmDialog);

const opsHandlers = createOperationsHandlers({ showToast, openModal, closeModal, showConfirmDialog, render });
const teamHandlers = createTeamHandlers({ appState: AppState, showToast, openModal, closeModal, showConfirmDialog, render });
const waHandlers = createWhatsAppHandlers({ openModal, closeModal, showToast });
const hrHandlers = createHrHandlers({ showToast, openModal, closeModal, render });
const erpDeptHandlers = DeptViews.createErpDepartmentHandlers({ showToast, openModal, closeModal, render, navigateTo });
const menuMgmtHandlers = MenuMgmt.createMenuManagementHandlers({
  getBaseCatalog: () => getBaseSidebarNavCatalog(getCurrentUser()),
  showToast,
  openModal,
  closeModal,
  showConfirmDialog,
  render
});
Object.assign(window.MJK, opsHandlers, teamHandlers, waHandlers, hrHandlers, erpDeptHandlers, menuMgmtHandlers, {
  handleSidebarSearchInput: (query) => {
    AppState.sidebarSearchQuery = String(query || '');
    const q = AppState.sidebarSearchQuery.trim().toLowerCase();
    const resultsEl = document.getElementById('sidebar-search-results');
    const clearWrap = document.querySelector('.sidebar-search-box');
    const user = getCurrentUser();
    const allowedItems = getSidebarNavCatalog(user).filter(item => canAccessRoute(item.id, user));
    if (resultsEl) {
      if (q) {
        resultsEl.innerHTML = renderSidebarSearchDropdownHtml(AppState.sidebarSearchQuery, allowedItems);
        resultsEl.classList.add('open');
      } else {
        resultsEl.innerHTML = '';
        resultsEl.classList.remove('open');
      }
    }
    if (clearWrap) {
      let clearBtn = clearWrap.querySelector('.sidebar-search-clear');
      if (AppState.sidebarSearchQuery && !clearBtn) {
        clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'sidebar-search-clear';
        clearBtn.title = 'Clear search';
        clearBtn.innerHTML = getLucideIcon('x', 13);
        clearBtn.onclick = () => window.MJK.clearSidebarSearch();
        clearWrap.appendChild(clearBtn);
      } else if (!AppState.sidebarSearchQuery && clearBtn) {
        clearBtn.remove();
      }
    }

    // Automatically expand matching departments & highlight matching submenus in sidebar
    const groups = document.querySelectorAll('#app-sidebar .nav-accordion-group');
    groups.forEach((groupEl) => {
      const groupKey = groupEl.getAttribute('data-nav-group') || '';
      const deptTitle = (groupEl.getAttribute('data-dept-title') || groupKey).toLowerCase();
      const subEls = groupEl.querySelectorAll('.nav-sub-item');
      const trig = groupEl.querySelector('.nav-accordion-trigger');

      if (!q) {
        const shouldBeOpen = Boolean(AppState.openNavGroup && groupKey === AppState.openNavGroup);
        groupEl.classList.toggle('open', shouldBeOpen);
        groupEl.classList.remove('search-expanded', 'search-dimmed');
        if (trig) trig.setAttribute('aria-expanded', shouldBeOpen ? 'true' : 'false');
        subEls.forEach((subEl) => {
          subEl.classList.remove('search-hit-item', 'search-hidden-item');
        });
        return;
      }

      const deptMatches = deptTitle.includes(q) || groupKey.toLowerCase().includes(q);
      let anySubMatch = false;
      subEls.forEach((subEl) => {
        const hay = (subEl.getAttribute('data-search-text') || subEl.textContent || '').toLowerCase();
        const isHit = deptMatches || hay.includes(q);
        subEl.classList.toggle('search-hit-item', isHit && !deptMatches);
        subEl.classList.toggle('search-hidden-item', !isHit);
        if (isHit) anySubMatch = true;
      });

      const groupMatched = deptMatches || anySubMatch;
      groupEl.classList.toggle('open', groupMatched);
      groupEl.classList.toggle('search-expanded', groupMatched);
      groupEl.classList.toggle('search-dimmed', !groupMatched);
      if (trig) trig.setAttribute('aria-expanded', groupMatched ? 'true' : 'false');
    });
  },
  clearSidebarSearch: () => {
    AppState.sidebarSearchQuery = '';
    const inp = document.getElementById('sidebar-live-search-input');
    if (inp) {
      inp.value = '';
      inp.focus();
    }
    window.MJK.handleSidebarSearchInput('');
  },
  navigateFromSidebarSearch: (routeId, groupName) => {
    AppState.sidebarSearchQuery = '';
    if (groupName) AppState.openNavGroup = groupName;
    navigateTo(routeId);
  },
  renderApp: () => render(),
  setDeleteHistoryFilter: (val) => {
    _settingsSecurityCache.deleteFilter = val || 'ALL';
    render();
  },
  refreshSettingsSecurity: async () => {
    await hydrateSettingsSecurityData(true);
    showToast('Security Delete History & Auto-Backups refreshed.', 'info');
  },
  runManualAutoSnapshot: async () => {
    const res = await triggerAutoBackupSnapshot();
    if (res.success) {
      await hydrateSettingsSecurityData(true);
      showToast(res.message || 'Auto-backup snapshot created.', 'success');
    } else {
      showToast(res.message || 'Failed to create backup snapshot.', 'danger');
    }
  },
  promptDeleteUserWithReason: (targetKey, userName = '') => {
    showDeleteReasonDialog(
      `Delete User Account: ${userName || targetKey}?`,
      `This permanently deletes account ${targetKey} and records the mandatory Delete Reason in Security History.`,
      async (reason) => {
        const res = await deleteUserAccount(targetKey, reason);
        if (res.success) {
          await fetchUsersFromBackend();
          await hydrateSettingsSecurityData(true);
          showToast(res.message || 'User account deleted and logged.', 'success');
          render();
        } else {
          showToast(res.message || 'Failed to delete user.', 'danger');
        }
      }
    );
  },
  openUserPermissionsModal: async (targetKey) => {
    await fetchUsersFromBackend();
    const schema = await fetchPermissionsSchema();
    const targetUser = getAllUsers().find(u => (u.uid && u.uid === targetKey) || (u.requestId && u.requestId === targetKey) || u.id === targetKey);
    if (!targetUser) {
      showToast('User account not found.', 'danger');
      return;
    }
    if (!schema?.success) {
      showToast('Unable to load permissions schema from server.', 'danger');
      return;
    }
    const menus = schema.menus || [];
    const actions = schema.actions || ['view', 'add', 'edit', 'delete', 'approve', 'export', 'print'];
    const roleKey = ['ADMIN', 'MANAGER'].includes(String(targetUser.role || '').toUpperCase())
      ? String(targetUser.role).toUpperCase()
      : 'STAFF';
    const roleDefault = schema.roleDefaults?.[roleKey] || { menus: {}, extra: {} };
    const overrides = targetUser.permissionOverrides || {};
    const extraOverrides = targetUser.extraPermissions || {};
    const isStaffRole = roleKey === 'STAFF';

    const effExtra = {
      ...(roleDefault.extra || {}),
      ...(extraOverrides || {})
    };
    const isChecked = (menuId, act) => {
      if (overrides?.[menuId] && typeof overrides[menuId][act] === 'boolean') return overrides[menuId][act];
      return Boolean(roleDefault.menus?.[menuId]?.[act]);
    };

    const groupedMenus = {};
    menus.forEach(m => {
      const grp = m.group || 'GENERAL';
      if (!groupedMenus[grp]) groupedMenus[grp] = [];
      groupedMenus[grp].push(m);
    });

    const content = `
      <form id="individual-perms-form" onsubmit="window.MJK.submitUserPermissionsModal(event, '${escAttrJs(targetUser.uid || targetUser.requestId)}', '${escAttrJs(roleKey)}')">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; padding:0.85rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:1rem;">
          <div>
            <div style="font-weight:800; font-size:1rem;">${escHtml(targetUser.name)} <span class="badge badge-info">${escHtml(formatRoleLabel(targetUser.role))}</span></div>
            <div class="font-mono" style="font-size:0.76rem; color:var(--blue-600);">UID: ${escHtml(targetUser.uid || targetUser.requestId)} · Status: ${escHtml(targetUser.status || 'ACTIVE')}</div>
          </div>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-outline btn-sm" onclick="document.querySelectorAll('#individual-perms-form input[data-act=view]').forEach(cb => { if(!cb.disabled) cb.checked = true; })">✓ All View On</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.resetUserPermissionsToDefault('${escAttrJs(targetUser.uid || targetUser.requestId)}')">↺ Reset to Role Defaults</button>
          </div>
        </div>

        <!-- Additional Controls -->
        <div style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.9rem; margin-bottom:1rem;">
          <div style="font-size:0.8rem; font-weight:800; color:var(--text-main); margin-bottom:0.65rem; text-transform:uppercase;">
            ⚙️ Additional Role & Operational Controls
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Cash Operation Limit (₹, 0 = Unlimited)</label>
              <input type="number" id="perm-extra-cash-limit" class="form-control font-mono" min="0" value="${Number(effExtra.cashOperationLimit || 0)}">
            </div>
            <div class="form-group">
              <label class="form-label">Customer Access Scope</label>
              <select id="perm-extra-cust-scope" class="form-control">
                <option value="ALL" ${effExtra.customerAccessScope === 'ALL' ? 'selected' : ''}>ALL Customers</option>
                <option value="ASSIGNED" ${effExtra.customerAccessScope === 'ASSIGNED' ? 'selected' : ''}>ASSIGNED / Own Customers Only</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Customer Access Limit (0 = Unlimited)</label>
              <input type="number" id="perm-extra-cust-limit" class="form-control font-mono" min="0" value="${Number(effExtra.customerAccessLimit || 0)}">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap:0.5rem; margin-top:0.4rem; font-size:0.8rem;">
            <label style="display:flex; align-items:center; gap:0.45rem; cursor:pointer;">
              <input type="checkbox" id="perm-extra-approve-txn" ${effExtra.canApproveTransactions ? 'checked' : ''}>
              <span>Can Approve Financial Transactions</span>
            </label>
            <label style="display:flex; align-items:center; gap:0.45rem; cursor:${isStaffRole ? 'not-allowed' : 'pointer'}; opacity:${isStaffRole ? '0.6' : '1'};" title="${isStaffRole ? 'Locked OFF for Staff role' : ''}">
              <input type="checkbox" id="perm-extra-all-photos" ${!isStaffRole && effExtra.canViewAllAttendancePhotos ? 'checked' : ''} ${isStaffRole ? 'disabled' : ''}>
              <span>View All Staff Attendance Photos & GPS ${isStaffRole ? '(Staff Locked)' : ''}</span>
            </label>
            <label style="display:flex; align-items:center; gap:0.45rem; cursor:pointer;">
              <input type="checkbox" id="perm-extra-backup" ${effExtra.canManageBackupSettings ? 'checked' : ''}>
              <span>Can Manage Backup & Settings</span>
            </label>
            <label style="display:flex; align-items:center; gap:0.45rem; cursor:${isStaffRole ? 'not-allowed' : 'pointer'}; opacity:${isStaffRole ? '0.6' : '1'};">
              <input type="checkbox" id="perm-extra-manage-perms" ${!isStaffRole && effExtra.canManageUserPermissions ? 'checked' : ''} ${isStaffRole ? 'disabled' : ''}>
              <span>Can Manage User Permissions ${isStaffRole ? '(Staff Locked)' : ''}</span>
            </label>
          </div>
        </div>

        <!-- Menu-wise & Button-wise Permission Matrix -->
        <div style="max-height:46vh; overflow:auto; border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
          <table class="data-table" style="font-size:0.78rem; width:100%;">
            <thead style="position:sticky; top:0; z-index:2; background:var(--surface);">
              <tr>
                <th style="min-width:210px;">Menu / Module</th>
                ${actions.map(act => `<th style="text-align:center; text-transform:capitalize;">${escHtml(act)}</th>`).join('')}
                <th style="text-align:center;">Row</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(groupedMenus).map(([grp, list]) => {
                const grpMeta = NAV_GROUP_DISPLAY_META[grp];
                const grpIcon = grpMeta && grpMeta.icon && !String(grpMeta.icon).startsWith('<svg') ? `${grpMeta.icon} ` : '';
                return `
                <tr style="background:var(--surface-alt);">
                  <td colspan="${actions.length + 2}" style="font-weight:800; font-size:0.72rem; color:var(--blue-600); letter-spacing:0.5px;">${escHtml(grpIcon + grp)}</td>
                </tr>
                ${list.map(m => `
                  <tr data-menu-row="${escHtml(m.id)}">
                    <td>
                      <div style="font-weight:700;">${escHtml(m.label)}</div>
                      <div style="font-size:0.68rem; color:var(--text-muted);">${escHtml(m.description || m.id)}</div>
                    </td>
                    ${actions.map(act => {
                      const lockPhotoDelete = m.id === 'attendance-photo-gallery' && act === 'delete' && roleKey !== 'ADMIN';
                      return `
                        <td style="text-align:center;">
                          <input type="checkbox"
                            class="perm-matrix-cb"
                            data-menu="${escHtml(m.id)}"
                            data-act="${escHtml(act)}"
                            ${isChecked(m.id, act) && !lockPhotoDelete ? 'checked' : ''}
                            ${lockPhotoDelete ? 'disabled title="Administrator ONLY: Photo delete is locked for Manager & Staff"' : ''}
                          >
                        </td>
                      `;
                    }).join('')}
                    <td style="text-align:center; white-space:nowrap;">
                      <button type="button" class="btn btn-outline btn-sm" style="padding:0.15rem 0.35rem; font-size:0.68rem;" onclick="document.querySelectorAll('tr[data-menu-row=&quot;${escAttrJs(m.id)}&quot;] input.perm-matrix-cb').forEach(cb => { if(!cb.disabled) cb.checked = true; })">All</button>
                      <button type="button" class="btn btn-outline btn-sm" style="padding:0.15rem 0.35rem; font-size:0.68rem;" onclick="document.querySelectorAll('tr[data-menu-row=&quot;${escAttrJs(m.id)}&quot;] input.perm-matrix-cb').forEach(cb => { if(!cb.disabled) cb.checked = false; })">None</button>
                    </td>
                  </tr>
                `).join('')}
              `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">💾 Save Individual Permissions</button>
        </div>
      </form>
    `;

    openModal(`🛡️ Individual Permission Control — ${targetUser.name}`, content, null, 'modal-lg');
  },
  submitUserPermissionsModal: async (e, targetUid, roleKey) => {
    e.preventDefault();
    const permissionOverrides = {};
    document.querySelectorAll('#individual-perms-form input.perm-matrix-cb').forEach(cb => {
      const m = cb.getAttribute('data-menu');
      const a = cb.getAttribute('data-act');
      if (!m || !a) return;
      if (!permissionOverrides[m]) permissionOverrides[m] = {};
      permissionOverrides[m][a] = cb.disabled ? false : Boolean(cb.checked);
    });

    const isStaffRole = roleKey === 'STAFF';
    const extraPermissions = {
      cashOperationLimit: Math.max(0, Number(document.getElementById('perm-extra-cash-limit')?.value) || 0),
      customerAccessScope: document.getElementById('perm-extra-cust-scope')?.value === 'ASSIGNED' ? 'ASSIGNED' : 'ALL',
      customerAccessLimit: Math.max(0, Number(document.getElementById('perm-extra-cust-limit')?.value) || 0),
      canApproveTransactions: Boolean(document.getElementById('perm-extra-approve-txn')?.checked),
      canViewAllAttendancePhotos: isStaffRole ? false : Boolean(document.getElementById('perm-extra-all-photos')?.checked),
      canManageBackupSettings: Boolean(document.getElementById('perm-extra-backup')?.checked),
      canManageUserPermissions: isStaffRole ? false : Boolean(document.getElementById('perm-extra-manage-perms')?.checked)
    };

    const res = await saveUserPermissions({
      uid: targetUid,
      permissionOverrides,
      extraPermissions
    });
    if (res.success) {
      await fetchUsersFromBackend();
      await refreshSessionPermissions();
      closeModal();
      showToast(res.message || 'Individual permissions saved!', 'success');
      render();
    } else {
      showToast(res.message || 'Failed to save permissions.', 'danger');
    }
  },
  resetUserPermissionsToDefault: async (targetUid) => {
    const res = await saveUserPermissions({ uid: targetUid, resetToDefaults: true });
    if (res.success) {
      await fetchUsersFromBackend();
      await refreshSessionPermissions();
      closeModal();
      showToast(res.message || 'Permissions reset to role defaults.', 'info');
      render();
    } else {
      showToast(res.message || 'Failed to reset permissions.', 'danger');
    }
  },
  openServiceModalWhatsApp: () => {
    const custMode = document.getElementById('srv-cust-mode')?.value || 'existing';
    const custId = document.getElementById('srv-cust-id')?.value || '';
    const cust = custMode === 'existing' && custId ? getCustomerById(custId) : null;
    const customerName = custMode === 'new'
      ? (document.getElementById('srv-newcust-name')?.value?.trim() || 'Customer')
      : (cust?.name || 'Customer');
    const phone = custMode === 'new'
      ? (document.getElementById('srv-newcust-phone')?.value?.trim() || document.getElementById('srv-phone')?.value || '')
      : (document.getElementById('srv-phone')?.value || cust?.phone || '');
    const editId = document.getElementById('srv-edit-id')?.value;
    const cart = !editId ? (AppState.serviceModalCart || []) : [];

    let serviceName = '';
    let refNumber = '';
    let status = 'New';
    let totalAmount = 0;

    if (cart.length > 0) {
      serviceName = cart.map(it => it.serviceName).join(', ');
      refNumber = AppState.serviceModalReceiptId || cart[0]?.refNumber || '';
      status = document.getElementById('srv-collective-status')?.value || 'New';
      totalAmount = cart.reduce((sum, it) => sum + (Number(it.serviceCharge) || 0) + (Number(it.govFee) || 0) + (Number(it.otherCharges) || 0), 0);
    } else {
      serviceName = document.getElementById('srv-name')?.value || document.getElementById('srv-subcat')?.value || '';
      refNumber = document.getElementById('srv-ref')?.value || '';
      status = editId
        ? (document.getElementById('srv-status')?.value || 'Pending')
        : (document.getElementById('srv-collective-status')?.value || 'New');
      const charge = Number(document.getElementById('srv-charge')?.value) || 0;
      const govFee = Number(document.getElementById('srv-gov-fee')?.value) || 0;
      const other = Number(document.getElementById('srv-other')?.value) || 0;
      totalAmount = charge + govFee + other;
    }

    const advance = Number(document.getElementById('srv-advance')?.value) || 0;
    const dueAmount = Math.max(0, totalAmount - advance);
    waHandlers.openWhatsAppConnectModal({
      phone,
      customerName,
      serviceName,
      refNumber,
      status,
      totalAmount,
      paidAmount: advance,
      dueAmount,
      context: 'SERVICE'
    });
  },
  openBillingModalWhatsApp: (mode) => {
    const custSelectId = mode === 'invoice' ? 'inv-cust-id' : 'pay-cust-id';
    const custId = document.getElementById(custSelectId)?.value || '';
    const cust = custId ? getCustomerById(custId) : null;
    if (mode === 'invoice') {
      const rows = typeof window.MJK.collectInvoiceRowsFromDom === 'function' ? window.MJK.collectInvoiceRowsFromDom() : [];
      const subtotal = rows.reduce((sum, r) => sum + ((Number(r.qty) || 1) * (Number(r.rate) || 0)), 0);
      const discount = Number(document.getElementById('inv-discount')?.value) || 0;
      const taxRate = Number(document.getElementById('inv-tax-rate')?.value) || 0;
      const paid = Number(document.getElementById('inv-paid')?.value) || 0;
      const taxable = Math.max(0, subtotal - discount);
      const total = Math.max(0, taxable + ((taxable * taxRate) / 100));
      const due = Math.max(0, total - paid);
      const serviceSummary = rows.map(r => r.name || r.description).filter(Boolean).join(', ') || 'Service Bill';
      waHandlers.openWhatsAppConnectModal({
        phone: cust?.phone || '',
        customerName: cust?.name || '',
        serviceName: serviceSummary,
        totalAmount: total,
        paidAmount: paid,
        dueAmount: due,
        context: 'BILLING'
      });
    } else {
      const amt = Number(document.getElementById('pay-amount')?.value) || 0;
      waHandlers.openWhatsAppConnectModal({
        phone: cust?.phone || '',
        customerName: cust?.name || '',
        serviceName: document.getElementById('pay-remarks')?.value || 'Payment Collection',
        paidAmount: amt,
        dueAmount: 0,
        context: 'BILLING'
      });
    }
  },
  setAdminSettingsTab: (tab) => {
    AppState.adminSettingsTab = tab || 'options';
    if (tab !== 'upi') {
      delete AppState.upiDraftQrDataUrl;
      delete AppState.upiDraftQrFileName;
    } else {
      syncUpiSettingsFromServer().then(() => {
        if (AppState.currentRoute === 'admin-settings' && AppState.adminSettingsTab === 'upi') {
          render();
        }
      });
    }
    render();
  },
  openAdminUpiSettings: () => {
    const curUser = getCurrentUser();
    if (!curUser || String(curUser.role || '').toUpperCase() !== 'ADMIN') {
      showToast('Admin permission required to configure UPI QR settings.', 'warning');
      return;
    }
    AppState.adminSettingsTab = 'upi';
    AppState.currentRoute = 'admin-settings';
    window.location.hash = 'admin-settings';
    render();
    syncUpiSettingsFromServer().then(() => {
      if (AppState.currentRoute === 'admin-settings' && AppState.adminSettingsTab === 'upi') {
        render();
      }
    });
  },
  onUpiQrFileSelected: (input) => {
    const file = input?.files?.[0];
    if (!file) return;
    const validMime = /^image\/(jpeg|jpg|png|webp)$/i.test(file.type || '');
    const validExt = /\.(jpg|jpeg|png|webp)$/i.test(file.name || '');
    if (!validMime && !validExt) {
      showToast('Unsupported QR image format. Allowed: JPG, JPEG, PNG, WebP.', 'warning');
      input.value = '';
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast('QR image file must be under 4 MB.', 'warning');
      input.value = '';
      return;
    }
    const typedUpiId = document.getElementById('adm-upi-id')?.value ?? null;
    const typedUpiName = document.getElementById('adm-upi-name')?.value ?? null;
    const typedInstructions = document.getElementById('adm-upi-instructions')?.value ?? null;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl.startsWith('data:image/')) {
        showToast('Invalid image file selected.', 'danger');
        return;
      }
      AppState.upiDraftQrDataUrl = dataUrl;
      AppState.upiDraftQrFileName = file.name;
      render();
      setTimeout(() => {
        if (typedUpiId !== null && document.getElementById('adm-upi-id')) document.getElementById('adm-upi-id').value = typedUpiId;
        if (typedUpiName !== null && document.getElementById('adm-upi-name')) document.getElementById('adm-upi-name').value = typedUpiName;
        if (typedInstructions !== null && document.getElementById('adm-upi-instructions')) document.getElementById('adm-upi-instructions').value = typedInstructions;
      }, 0);
      showToast(`Selected original QR image "${file.name}". Click Save UPI Payment Settings to apply.`, 'info');
    };
    reader.onerror = () => {
      showToast('Failed to read selected QR image file.', 'danger');
    };
    reader.readAsDataURL(file);
  },
  handleSaveUpiSettings: async (e) => {
    e.preventDefault();
    const curUser = getCurrentUser();
    if (!curUser || String(curUser.role || '').toUpperCase() !== 'ADMIN') {
      showToast('Only Admin can save UPI QR & payment settings.', 'danger');
      return;
    }
    const upiId = document.getElementById('adm-upi-id')?.value?.trim() || '';
    const upiDisplayName = document.getElementById('adm-upi-name')?.value?.trim() || '';
    const paymentInstructions = document.getElementById('adm-upi-instructions')?.value?.trim() || '';
    try {
      await saveUpiPaymentSettings({
        upiId,
        upiDisplayName,
        paymentInstructions,
        qrImageDataUrl: AppState.upiDraftQrDataUrl || '',
        qrFileName: AppState.upiDraftQrFileName || ''
      });
      delete AppState.upiDraftQrDataUrl;
      delete AppState.upiDraftQrFileName;
      showToast('Admin UPI QR & payment settings saved.', 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save UPI settings.', 'danger');
    }
  },
  handleRemoveUpiQr: () => {
    const curUser = getCurrentUser();
    if (!curUser || String(curUser.role || '').toUpperCase() !== 'ADMIN') {
      showToast('Only Admin can remove the uploaded UPI QR image.', 'danger');
      return;
    }
    showConfirmDialog(
      'Remove Uploaded UPI QR Image?',
      'This removes the currently uploaded QR code image from bills and receipts until you upload a replacement.',
      async () => {
        try {
          await removeUpiQrImage();
          delete AppState.upiDraftQrDataUrl;
          delete AppState.upiDraftQrFileName;
          showToast('Uploaded UPI QR image removed.', 'info');
          render();
        } catch (err) {
          showToast(err?.message || 'Failed to remove UPI QR image.', 'danger');
        }
      }
    );
  },
  setAdminOptionCategory: (cat) => {
    AppState.adminOptionCategory = cat || 'application_status';
    AppState.adminOptionEditId = '';
    render();
  },
  adminEditOption: (id) => {
    AppState.adminOptionEditId = id || '';
    render();
  },
  adminSaveOption: async (e) => {
    e.preventDefault();
    const id = document.getElementById('adm-opt-id')?.value?.trim() || '';
    const label = document.getElementById('adm-opt-label')?.value?.trim() || '';
    const sortOrder = Number(document.getElementById('adm-opt-order')?.value) || 1;
    const category = AppState.adminOptionCategory || 'application_status';
    if (!label) return;
    const res = await saveAdminOptionApi({ id: id || undefined, category, label, sortOrder });
    if (!res?.success) {
      showToast(res?.message || 'Failed to save option.', 'danger');
      return;
    }
    AppState.adminOptionEditId = '';
    showToast(id ? 'Option updated.' : 'Option added.', 'success');
    render();
  },
  adminToggleOption: async (id) => {
    const res = await toggleAdminOptionApi(id);
    if (!res?.success) {
      showToast(res?.message || 'Failed to toggle option status.', 'danger');
      return;
    }
    showToast('Option status updated.', 'success');
    render();
  },
  adminDeleteOption: (id) => {
    showConfirmDialog('Delete Option?', 'This removes the option from active dropdown lists.', async () => {
      const res = await deleteAdminOptionApi(id);
      if (!res?.success) {
        showToast(res?.message || 'Failed to delete option.', 'danger');
        return;
      }
      if (AppState.adminOptionEditId === id) AppState.adminOptionEditId = '';
      showToast('Option deleted.', 'info');
      render();
    });
  },
  adminRestoreOptions: (category = '') => {
    showConfirmDialog(
      'Restore Default Options?',
      category ? `Restore default options for "${category}"?` : 'Restore all default Admin dropdown options?',
      async () => {
        const res = await restoreDefaultAdminOptionsApi(category);
        if (!res?.success) {
          showToast(res?.message || 'Failed to restore default options.', 'danger');
          return;
        }
        AppState.adminOptionEditId = '';
        showToast('Default options restored.', 'success');
        render();
      }
    );
  },
  adminEditMilestone: (id) => {
    AppState.adminScheduleEditId = id || '';
    render();
  },
  adminSaveMilestone: async (e) => {
    e.preventDefault();
    const id = document.getElementById('adm-sch-id')?.value?.trim() || '';
    const day = Number(document.getElementById('adm-sch-day')?.value);
    const title = document.getElementById('adm-sch-title')?.value?.trim() || '';
    const description = document.getElementById('adm-sch-desc')?.value?.trim() || '';
    if (!title || Number.isNaN(day) || day < 0) return;
    const res = await saveScheduleMilestoneApi({ id: id || undefined, day, title, description });
    if (!res?.success) {
      showToast(res?.message || 'Failed to save milestone.', 'danger');
      return;
    }
    AppState.adminScheduleEditId = '';
    showToast(id ? 'Milestone updated.' : 'Milestone added.', 'success');
    render();
  },
  adminToggleMilestone: async (id) => {
    const res = await toggleScheduleMilestoneApi(id);
    if (!res?.success) {
      showToast(res?.message || 'Failed to toggle milestone.', 'danger');
      return;
    }
    showToast('Milestone status updated.', 'success');
    render();
  },
  adminMoveMilestone: async (id, dir) => {
    const list = getFollowupScheduleTemplate({ activeOnly: false });
    const idx = list.findIndex(m => m.id === id);
    const nextIdx = idx + Number(dir || 0);
    if (idx === -1 || nextIdx < 0 || nextIdx >= list.length) return;
    const orderedIds = list.map(m => m.id);
    const [moved] = orderedIds.splice(idx, 1);
    orderedIds.splice(nextIdx, 0, moved);
    const res = await reorderScheduleApi(orderedIds);
    if (!res?.success) {
      showToast(res?.message || 'Failed to reorder milestones.', 'danger');
      return;
    }
    render();
  },
  adminDeleteMilestone: (id) => {
    showConfirmDialog('Delete Milestone?', 'Remove this milestone from the 90-day template?', async () => {
      const res = await deleteScheduleMilestoneApi(id);
      if (!res?.success) {
        showToast(res?.message || 'Failed to delete milestone.', 'danger');
        return;
      }
      if (AppState.adminScheduleEditId === id) AppState.adminScheduleEditId = '';
      showToast('Milestone deleted.', 'info');
      render();
    });
  },
  adminRestoreSchedule: () => {
    showConfirmDialog('Restore Default Schedule?', 'Restore the default Day 0–90 follow-up schedule?', async () => {
      const res = await restoreDefaultScheduleApi();
      if (!res?.success) {
        showToast(res?.message || 'Failed to restore default schedule.', 'danger');
        return;
      }
      AppState.adminScheduleEditId = '';
      showToast('Default schedule restored.', 'success');
      render();
    });
  },
  numberToWords,
  getAmountWordsState,
  syncAmountWords,
  previewNextApplicationId,
  navigate: navigateTo,

  quickJumpToCaseSearch: (query = '') => {
    AppState.followupSearchQuery = String(query || '').trim();
    AppState.followupViewMode = 'cases';
    navigateTo('followups');
  },

  prefillDedicatedRegistrationCustomer: async (custId = '') => {
    const custIdInput = document.getElementById('regv-cust-id');
    const nameInput = document.getElementById('regv-name');
    const phoneInput = document.getElementById('regv-phone');
    const altPhoneInput = document.getElementById('regv-altphone');
    const custTypeSelect = document.getElementById('regv-custtype');
    const appIdInput = document.getElementById('regv-app-id');
    const regDateInput = document.getElementById('regv-regdate');
    const regDate = regDateInput?.value || getTodayDate();

    if (!custId) {
      if (custIdInput) custIdInput.value = previewNextGlobalReference('CUST');
      if (nameInput) nameInput.value = '';
      if (phoneInput) phoneInput.value = '';
      if (altPhoneInput) altPhoneInput.value = '';
      if (appIdInput) {
        appIdInput.value = previewNextApplicationId(regDate);
        appIdInput.dataset.edited = '';
      }
      await syncLocationCascadeSelection('regv-loc', {
        state: 'West Bengal',
        district: 'Murshidabad',
        village: '',
        postOffice: '',
        policeStation: '',
        pinCode: ''
      });
      setSelectedServicesState('regv-services', []);
      return;
    }

    const cust = getCustomerById(custId);
    if (!cust) return;
    if (custIdInput) custIdInput.value = cust.id;
    if (nameInput) nameInput.value = cust.name || '';
    if (phoneInput) phoneInput.value = cust.phone || '';
    if (altPhoneInput) altPhoneInput.value = cust.altPhone || '';
    if (custTypeSelect && cust.category) custTypeSelect.value = cust.category;
    if (appIdInput) {
      appIdInput.value = previewNextApplicationId(regDate);
      appIdInput.dataset.edited = '';
    }
    await syncLocationCascadeSelection('regv-loc', {
      state: cust.state || 'West Bengal',
      district: cust.district || 'Murshidabad',
      subdivision: cust.subdivision || '',
      blockOrMunicipality: cust.blockOrMunicipality || '',
      gpOrWard: cust.gpOrWard || cust.wardNumber || '',
      village: cust.village || '',
      postOffice: cust.postOffice || '',
      policeStation: cust.policeStation || '',
      pinCode: cust.pinCode || ''
    });
  },

  handleSaveDedicatedRegistration: async (e) => {
    e.preventDefault();
    try {
      const existingCustId = document.getElementById('regv-existing-cust')?.value?.trim() || '';
      const existingCust = existingCustId ? getCustomerById(existingCustId) : null;
      const regDate = document.getElementById('regv-regdate')?.value || getTodayDate();
      const appIdEl = document.getElementById('regv-app-id');
      const customAppIdTyped = appIdEl?.dataset?.edited === '1' && appIdEl?.value?.trim();
      const primaryAppId = customAppIdTyped
        ? appIdEl.value.trim()
        : await allocateGlobalReference('CASE', { entityType: 'CASE' });

      const name = document.getElementById('regv-name')?.value?.trim() || '';
      const phone = document.getElementById('regv-phone')?.value?.trim() || '';
      const altPhone = document.getElementById('regv-altphone')?.value?.trim() || '';
      const category = document.getElementById('regv-custtype')?.value || 'General Public';
      const priority = document.getElementById('regv-priority')?.value || 'Normal';
      const assignedStaffUid = document.getElementById('regv-staff')?.value?.trim() || getCurrentUser()?.uid || MAIN_ADMIN_UID;
      const separateApps = Boolean(document.getElementById('regv-separate-apps')?.checked);
      const customLandmark = document.getElementById('regv-address')?.value?.trim() || '';
      const remarks = document.getElementById('regv-remarks')?.value?.trim() || '';
      const openDocAfter = Boolean(document.getElementById('regv-open-doc-after')?.checked);

      if (!name || !phone) {
        showToast('Customer Name and Mobile Number are required.', 'warning');
        return;
      }

      const selState = getSelectedServicesState('regv-services');
      if (!selState.serviceNames.length) {
        showToast('Please select at least one Service / Scheme.', 'warning');
        return;
      }

      const loc = getLocationCascadeValues('regv-loc');
      if (!loc.state || !loc.district || !loc.village || !loc.postOffice || !loc.pinCode) {
        showToast('Please select/enter State, District, Village, Post Office, and PIN Code.', 'warning');
        return;
      }

      const compiledAddress = customLandmark
        ? (loc.formattedAddress ? `${customLandmark}, ${loc.formattedAddress}` : customLandmark)
        : loc.formattedAddress;
      const villageOrWard = loc.gpOrWard || loc.village || '';

      await saveCustomLocationIfNeeded(loc);

      const custIdVal = existingCust?.id || undefined;
      const mergedServices = existingCust && Array.isArray(existingCust.services)
        ? Array.from(new Set([...existingCust.services, ...selState.serviceNames]))
        : selState.serviceNames;

      const custPayload = {
        id: custIdVal,
        applicationId: existingCust?.applicationId || primaryAppId,
        schemeName: selState.serviceNames.join(', '),
        villageOrWard,
        currentStatus: 'Submitted',
        name,
        fatherName: existingCust?.fatherName || '',
        phone,
        altPhone,
        email: existingCust?.email || '',
        address: compiledAddress,
        regDate: existingCust?.regDate || regDate,
        category,
        services: mergedServices,
        serviceRateBreakdown: selState.services,
        totalBillAmount: selState.totalPayable,
        village: loc.village,
        postOffice: loc.postOffice,
        policeStation: loc.policeStation,
        district: loc.district,
        state: loc.state,
        pinCode: loc.pinCode,
        remarks: remarks || existingCust?.remarks || '',
        assignedStaff: assignedStaffUid,
        assignedStaffUid,
        createdByUid: existingCust ? undefined : (getCurrentUser()?.uid || '')
      };

      const custRes = await saveCustomer(custPayload);
      const savedCust = custRes?.customer;
      const targetCustId = savedCust?.id || custIdVal || '';

      fetch('/api/customers', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...custPayload,
          id: targetCustId,
          villageOrLocality: loc.village,
          blockOrMunicipality: loc.blockOrMunicipality || '',
          gpOrWard: loc.gpOrWard || '',
          subdivision: loc.subdivision || ''
        })
      }).catch(() => {});

      const createdAppIds = [];
      if (separateApps && selState.services.length > 1) {
        for (let idx = 0; idx < selState.services.length; idx++) {
          const srvItem = selState.services[idx];
          const appIdForItem = idx === 0
            ? primaryAppId
            : await allocateGlobalReference('CASE', { entityType: 'CASE' });
          createdAppIds.push(appIdForItem);
          await createOrSyncFollowupCase({
            customerId: targetCustId,
            customerName: name,
            phone,
            applicationId: appIdForItem,
            schemeName: srvItem.name,
            services: [srvItem.name],
            serviceRateBreakdown: [srvItem],
            totalAmount: srvItem.total,
            villageOrWard,
            currentStatus: 'Submitted',
            priority,
            assignedStaff: assignedStaffUid,
            startDate: regDate,
            initialNote: remarks,
            forceNew: true
          });
        }
      } else {
        createdAppIds.push(primaryAppId);
        await createOrSyncFollowupCase({
          customerId: targetCustId,
          customerName: name,
          phone,
          applicationId: primaryAppId,
          schemeName: selState.serviceNames.join(', '),
          services: selState.serviceNames,
          serviceRateBreakdown: selState.services,
          totalAmount: selState.totalPayable,
          villageOrWard,
          currentStatus: 'Submitted',
          priority,
          assignedStaff: assignedStaffUid,
          startDate: regDate,
          initialNote: remarks,
          forceNew: true
        });
      }

      fetch('/api/applications/next-id', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ date: regDate, applicationId: createdAppIds[createdAppIds.length - 1] })
      }).catch(() => {});

      showToast(
        createdAppIds.length > 1
          ? `Registered ${name} with ${createdAppIds.length} Applications (${createdAppIds[0]} … ${createdAppIds[createdAppIds.length - 1]}).`
          : `Registered ${name} · App ID: ${primaryAppId} (Status: Submitted · Total: ${formatINR(selState.totalPayable)}).`,
        'success'
      );
      EnterpriseExt.refreshUniversalSearchIfActive();
      render();

      if (openDocAfter && targetCustId && typeof window.MJK.openRealDocumentUploadModal === 'function') {
        setTimeout(() => {
          window.MJK.openRealDocumentUploadModal(primaryAppId, targetCustId);
        }, 60);
      }
    } catch (err) {
      showToast(err?.message || 'Failed to complete customer registration.', 'danger');
    }
  },

  setFollowupListFilter: (key, val) => {
    const v = val || 'all';
    if (key === 'service') AppState.followupServiceFilter = v;
    else if (key === 'status') AppState.followupStatusFilter = v;
    else if (key === 'staff') AppState.followupStaffFilter = v;
    else if (key === 'priority') AppState.followupPriorityFilter = v;
    else if (key === 'regDate') AppState.followupRegDateFilter = val || '';
    else if (key === 'followupDate') AppState.followupDateFilter = val || '';
    render();
  },

  resetFollowupListFilters: () => {
    AppState.followupBucketFilter = 'all';
    AppState.followupSearchQuery = '';
    AppState.followupStaffFilter = 'all';
    AppState.followupServiceFilter = 'all';
    AppState.followupStatusFilter = 'all';
    AppState.followupPriorityFilter = 'all';
    AppState.followupDateFilter = '';
    AppState.followupRegDateFilter = '';
    render();
  },

  openCustomerStatusModal: (caseIdOrAppId) => {
    const allCases = getAllFollowupCases();
    const cs = allCases.find(c => c.id === caseIdOrAppId || c.applicationId === caseIdOrAppId);
    if (!cs) {
      showToast('Application case record not found.', 'warning');
      return;
    }
    const statusOpts = getAdminOptionLabels('application_status', {
      activeOnly: true,
      includeValues: [cs.currentStatus || 'Submitted']
    });
    const html = `
      <form onsubmit="window.MJK.submitCustomerStatusModal(event, '${escAttrJs(cs.id)}')">
        <div style="padding:0.75rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:0.85rem; font-size:0.82rem;">
          <div><strong>Customer:</strong> ${escHtml(cs.customerName)} (${escHtml(cs.phone || '-')})</div>
          <div style="margin-top:0.2rem;"><strong>App ID:</strong> <span class="font-mono" style="color:var(--violet-600); font-weight:700;">${escHtml(cs.applicationId)}</span> · <strong>Service:</strong> ${escHtml(cs.schemeName || '-')}</div>
        </div>
        <div class="form-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
            <label class="form-label" style="margin:0;">Current Application Status <span class="req">*</span></label>
            <button type="button" class="btn btn-outline btn-sm" style="padding:0.1rem 0.45rem; font-size:0.7rem;" onclick="window.MJK.promptInlineNewStatus('cs-upd-status')">+ Status</button>
          </div>
          <select id="cs-upd-status" class="form-control" required>
            ${statusOpts.map(st => `<option value="${escHtml(st)}" ${(cs.currentStatus || 'Submitted') === st ? 'selected' : ''}>${escHtml(st)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Status Change Remarks</label>
          <textarea id="cs-upd-remarks" class="form-control" rows="2" placeholder="Document verification update, officer remark, approval/rejection details..."></textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Update Status</button>
        </div>
      </form>
    `;
    openModal('Update Application Current Status', html, null);
  },

  submitCustomerStatusModal: async (e, caseId) => {
    e.preventDefault();
    const newStatus = document.getElementById('cs-upd-status')?.value?.trim() || '';
    const remarks = document.getElementById('cs-upd-remarks')?.value?.trim() || '';
    const res = await updateCaseCurrentStatus(caseId, { newStatus, remarks });
    if (!res?.success) {
      showToast(res?.message || 'Failed to update status.', 'danger');
      return;
    }
    closeModal();
    showToast(`Status updated to "${newStatus}".`, 'success');
    render();
  },

  openReopenCaseModal: (caseIdOrAppId) => {
    const allCases = getAllFollowupCases();
    const cs = allCases.find(c => c.id === caseIdOrAppId || c.applicationId === caseIdOrAppId);
    if (!cs) {
      showToast('Case record not found.', 'warning');
      return;
    }
    const html = `
      <form onsubmit="window.MJK.submitReopenCaseModal(event, '${escAttrJs(cs.id)}')">
        <div style="padding:0.75rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:0.85rem; font-size:0.82rem;">
          <div><strong>Customer:</strong> ${escHtml(cs.customerName)} · <span class="font-mono">${escHtml(cs.applicationId)}</span></div>
          <div style="margin-top:0.2rem;">Reopening changes status back to <strong>Under Process</strong> and resumes follow-up scheduling.</div>
        </div>
        <div class="form-group">
          <label class="form-label">Reason for Reopening Case <span class="req">*</span></label>
          <textarea id="reopen-case-reason" class="form-control" rows="2" required placeholder="e.g. New objection raised, correction requested, citizen returned..."></textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-warning">↺ Reopen Case</button>
        </div>
      </form>
    `;
    openModal('Reopen Closed Application Case', html, null);
  },

  submitReopenCaseModal: async (e, caseId) => {
    e.preventDefault();
    const reason = document.getElementById('reopen-case-reason')?.value?.trim() || '';
    const res = await reopenFollowupCase(caseId, reason);
    if (!res?.success) {
      showToast(res?.message || 'Failed to reopen case.', 'danger');
      return;
    }
    closeModal();
    showToast(`Case ${res.caseRecord?.applicationId || ''} reopened.`, 'success');
    render();
  },

  openCaseRescheduleModal: (caseIdOrAppId) => {
    const allCases = getAllFollowupCases();
    const cs = allCases.find(c => c.id === caseIdOrAppId || c.applicationId === caseIdOrAppId);
    if (!cs) {
      showToast('Case record not found.', 'warning');
      return;
    }
    const defaultNextDate = cs.nextFollowupDate || addDaysToIsoDate(getTodayDate(), 7);
    const pendingMilestones = (cs.schedule || []).filter(m => !m.completed);
    const html = `
      <form onsubmit="window.MJK.submitCaseRescheduleModal(event, '${escAttrJs(cs.id)}')">
        <div style="padding:0.75rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:0.85rem; font-size:0.82rem;">
          <div><strong>Customer:</strong> ${escHtml(cs.customerName)} · <span class="font-mono">${escHtml(cs.applicationId)}</span></div>
          <div style="margin-top:0.2rem;"><strong>Service:</strong> ${escHtml(cs.schemeName || '-')} · <strong>Status:</strong> ${escHtml(cs.currentStatus || 'Submitted')}</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">New Follow-up Date <span class="req">*</span></label>
            <input type="date" id="c90-resched-date" class="form-control" value="${escHtml(defaultNextDate)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Target Milestone (Optional)</label>
            <select id="c90-resched-milestone" class="form-control">
              <option value="">Next Pending Milestone</option>
              ${pendingMilestones.map(m => `<option value="${Number(m.day)}" ${Number(cs.nextMilestoneDay) === Number(m.day) ? 'selected' : ''}>${escHtml(m.label || `Day ${m.day}`)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Reschedule Reason</label>
          <input type="text" id="c90-resched-reason" class="form-control" placeholder="e.g. Customer requested call next week, awaiting portal update">
        </div>
        <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.78rem; margin-bottom:1rem;">
          <input type="checkbox" id="c90-resched-rem" checked> Sync Smart Follow-up Reminder Alert
        </label>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Reschedule</button>
        </div>
      </form>
    `;
    openModal('Reschedule 90-Day Case Follow-up', html, null);
  },

  submitCaseRescheduleModal: async (e, caseId) => {
    e.preventDefault();
    const nextFollowupDate = document.getElementById('c90-resched-date')?.value || '';
    const mRaw = document.getElementById('c90-resched-milestone')?.value;
    const milestoneDay = mRaw !== '' && mRaw !== undefined ? Number(mRaw) : null;
    const reason = document.getElementById('c90-resched-reason')?.value?.trim() || '';
    const reminderEnabled = Boolean(document.getElementById('c90-resched-rem')?.checked);
    const res = await rescheduleFollowupCase(caseId, { nextFollowupDate, milestoneDay, reason, reminderEnabled });
    if (!res?.success) {
      showToast(res?.message || 'Failed to reschedule case.', 'danger');
      return;
    }
    closeModal();
    showToast(`Follow-up rescheduled to ${formatDate(nextFollowupDate)}.`, 'success');
    render();
  },

  setGrievancePortalFilter: (portal) => {
    AppState.grievancePortalFilter = portal || 'all';
    render();
  },

  setGrievanceStatusFilter: (status) => {
    AppState.grievanceStatusFilter = status || 'all';
    render();
  },

  setGrievanceSearchQuery: (q) => {
    AppState.grievanceSearchQuery = String(q || '');
    scheduleSearchRender();
  },

  openGrievanceModal: (presetCaseOrAppId = '', editGrievanceId = '') => {
    const allCases = getAllFollowupCases();
    const customers = getAllCustomers();
    const existingList = getAllGrievances();
    const editRecord = editGrievanceId ? existingList.find(g => g.id === editGrievanceId) : null;

    const matchedCase = editRecord
      ? allCases.find(c => c.id === editRecord.caseId || c.applicationId === editRecord.applicationId)
      : (presetCaseOrAppId ? allCases.find(c => c.id === presetCaseOrAppId || c.applicationId === presetCaseOrAppId) : null);
    const matchedCust = (editRecord?.customerId || matchedCase?.customerId)
      ? getCustomerById(editRecord?.customerId || matchedCase?.customerId)
      : (presetCaseOrAppId ? getCustomerById(presetCaseOrAppId) : null);

    const dynamicPortals = getAdminOptionLabels('grievance_portal', { activeOnly: true });
    const portalChoices = Array.from(new Set(['CMO', 'MLA', 'CPGRAMS', 'NPCI', 'Other', ...dynamicPortals]));
    const activePortal = editRecord?.portal || editRecord?.type || portalChoices[0] || 'CMO';
    const activeStatus = editRecord?.status || 'Pending';

    // Combine searchable options from cases & customers
    const directoryEntries = [];
    const usedKeys = new Set();
    allCases.forEach(c => {
      const k = `${c.id}`;
      usedKeys.add(k);
      directoryEntries.push({
        value: c.id,
        customerId: c.customerId || '',
        customerName: c.customerName || '',
        phone: c.phone || '',
        applicationId: c.applicationId || '',
        caseId: c.id,
        label: `${c.customerName} · ${c.phone || '-'} · App ID: ${c.applicationId} (${c.schemeName || 'Case'})`
      });
    });
    customers.forEach(cust => {
      directoryEntries.push({
        value: `CUST::${cust.id}`,
        customerId: cust.id,
        customerName: cust.name || '',
        phone: cust.phone || '',
        applicationId: cust.applicationId || '',
        caseId: '',
        label: `${cust.name} · ${cust.phone || '-'} · Customer (${cust.applicationId || cust.id})`
      });
    });

    const selectedDirectoryVal = matchedCase ? matchedCase.id : (matchedCust ? `CUST::${matchedCust.id}` : '');
    const initAppId = editRecord?.applicationId || matchedCase?.applicationId || matchedCust?.applicationId || '';
    const initCustId = editRecord?.customerId || matchedCase?.customerId || matchedCust?.id || '';
    const initCustName = editRecord?.customerName || matchedCase?.customerName || matchedCust?.name || '';
    const initPhone = editRecord?.phone || matchedCase?.phone || matchedCust?.phone || '';

    const html = `
      <form onsubmit="window.MJK.submitGrievanceModal(event, '${escAttrJs(editRecord?.id || '')}')">
        <input type="hidden" id="grv-case-id" value="${escHtml(editRecord?.caseId || matchedCase?.id || '')}">
        <input type="hidden" id="grv-cust-id" value="${escHtml(initCustId)}">

        <div style="padding:0.75rem; background:#f5f3ff; border:1px solid #c4b5fd; border-radius:var(--radius-md); margin-bottom:0.85rem;">
          <label class="form-label" style="font-size:0.76rem; color:#5b21b6;">⚡ Search &amp; Auto-Fetch Customer / Application ID</label>
          <input type="text" id="grv-cust-filter" class="form-control" style="margin-bottom:0.45rem;" placeholder="Type customer name, mobile number, or Application ID to filter..." oninput="window.MJK.filterGrievanceCustomerOptions(this.value)">
          <select id="grv-cust-select" class="form-control" onchange="window.MJK.onGrievanceCustomerSelect(this)">
            <option value="">-- Select Customer / Application (or enter details below) --</option>
            ${directoryEntries.map(entry => `
              <option value="${escHtml(entry.value)}"
                data-custid="${escHtml(entry.customerId)}"
                data-caseid="${escHtml(entry.caseId)}"
                data-name="${escHtml(entry.customerName)}"
                data-phone="${escHtml(entry.phone)}"
                data-appid="${escHtml(entry.applicationId)}"
                ${selectedDirectoryVal === entry.value ? 'selected' : ''}>
                ${escHtml(entry.label)}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Customer Name <span class="req">*</span></label>
            <input type="text" id="grv-cust-name" class="form-control" value="${escHtml(initCustName)}" required placeholder="Auto-filled or enter name">
          </div>
          <div class="form-group">
            <label class="form-label">Mobile Number</label>
            <input type="tel" id="grv-phone" class="form-control font-mono tabular-nums" value="${escHtml(initPhone)}" placeholder="10-digit Mobile">
          </div>
          <div class="form-group">
            <label class="form-label">Application ID</label>
            <input type="text" id="grv-app-id" class="form-control font-mono" value="${escHtml(initAppId)}" placeholder="e.g. 15NOV260001">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Portal Type <span class="req">*</span></label>
            <select id="grv-portal" class="form-control" required onchange="window.MJK.onGrievancePortalSelectChange(this.value)">
              ${portalChoices.map(p => `<option value="${escHtml(p)}" ${activePortal === p ? 'selected' : ''}>${escHtml(p)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tracking Reference No <span class="req">*</span></label>
            <input type="text" id="grv-ref" class="form-control font-mono" value="${escHtml(editRecord?.referenceNumber || '')}" required placeholder="Portal Tracking / Docket Number">
          </div>
          <div class="form-group">
            <label class="form-label">Submission Date <span class="req">*</span></label>
            <input type="date" id="grv-date" class="form-control" value="${escHtml(editRecord?.date || getTodayDate())}" required>
          </div>
        </div>

        <div id="grv-custom-portal-wrap" style="display:${activePortal === 'Other' ? 'block' : 'none'};" class="form-group">
          <label class="form-label">Specify Custom Portal Name</label>
          <input type="text" id="grv-custom-portal" class="form-control" value="${escHtml(editRecord?.customPortalName || '')}" placeholder="e.g. Duare Sarkar Portal / District Magistrate Desk">
        </div>

        <div id="grv-dept-wrap" class="form-row" style="display:${activePortal === 'NPCI' ? 'none' : 'flex'};">
          <div class="form-group">
            <label class="form-label">Concerned Department / Office</label>
            <input type="text" id="grv-dept" class="form-control" value="${escHtml(editRecord?.department || '')}" placeholder="e.g. Food &amp; Supplies / BDO Domkal">
          </div>
          <div class="form-group">
            <label class="form-label">Action Taken Report (ATR) Summary</label>
            <input type="text" id="grv-atr" class="form-control" value="${escHtml(editRecord?.atr || '')}" placeholder="Official ATR / response note">
          </div>
        </div>

        <div id="grv-npci-wrap" class="form-row" style="display:${activePortal === 'NPCI' ? 'flex' : 'none'};">
          <div class="form-group">
            <label class="form-label">Aadhaar Seeding Status</label>
            <select id="grv-npci-aadhaar" class="form-control">
              ${['Pending Verification', 'Seeded & Active', 'Not Seeded', 'DBT Disabled'].map(s => `<option value="${escHtml(s)}" ${(editRecord?.aadhaarSeedingStatus || '') === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">NPCI Bank Mapping</label>
            <input type="text" id="grv-npci-bank" class="form-control" value="${escHtml(editRecord?.bankMapping || '')}" placeholder="e.g. SBI Mamudpur / IPPB">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Grievance Status <span class="req">*</span></label>
            <select id="grv-status" class="form-control" required>
              ${['Pending', 'In Progress', 'Resolved', 'Escalated'].map(s => `<option value="${escHtml(s)}" ${activeStatus === s ? 'selected' : ''}>${escHtml(s)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="flex:2;">
            <label class="form-label">Remarks / Grievance Description <span class="req">*</span></label>
            <textarea id="grv-remarks" class="form-control" rows="2" required placeholder="Detailed complaint description or current portal update...">${escHtml(editRecord?.remarks || editRecord?.description || '')}</textarea>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${editRecord ? 'Update Grievance' : '✓ Log Grievance'}</button>
        </div>
      </form>
    `;
    openModal(editRecord ? 'Edit Portal Grievance' : 'Log Portal Grievance / Escalation', html, null, 'modal-lg');
  },

  filterGrievanceCustomerOptions: (query = '') => {
    const sel = document.getElementById('grv-cust-select');
    if (!sel) return;
    const q = String(query || '').trim().toLowerCase();
    Array.from(sel.options).forEach((opt, idx) => {
      if (idx === 0) return;
      const text = opt.textContent.toLowerCase();
      opt.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
  },

  onGrievanceCustomerSelect: (selectEl) => {
    const opt = selectEl?.selectedOptions?.[0];
    if (!opt || !opt.value) return;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    setVal('grv-case-id', opt.dataset.caseid || '');
    setVal('grv-cust-id', opt.dataset.custid || '');
    setVal('grv-cust-name', opt.dataset.name || '');
    setVal('grv-phone', opt.dataset.phone || '');
    setVal('grv-app-id', opt.dataset.appid || '');
  },

  onGrievancePortalSelectChange: (portalVal) => {
    const customWrap = document.getElementById('grv-custom-portal-wrap');
    const deptWrap = document.getElementById('grv-dept-wrap');
    const npciWrap = document.getElementById('grv-npci-wrap');
    if (customWrap) customWrap.style.display = portalVal === 'Other' ? 'block' : 'none';
    if (deptWrap) deptWrap.style.display = portalVal === 'NPCI' ? 'none' : 'flex';
    if (npciWrap) npciWrap.style.display = portalVal === 'NPCI' ? 'flex' : 'none';
  },

  submitGrievanceModal: async (e, editId = '') => {
    e.preventDefault();
    const portal = document.getElementById('grv-portal')?.value || 'CMO';
    const customPortalName = document.getElementById('grv-custom-portal')?.value?.trim() || '';
    const res = await saveGrievanceEntry({
      id: editId || undefined,
      caseId: document.getElementById('grv-case-id')?.value?.trim() || '',
      customerId: document.getElementById('grv-cust-id')?.value?.trim() || '',
      customerName: document.getElementById('grv-cust-name')?.value?.trim() || '',
      phone: document.getElementById('grv-phone')?.value?.trim() || '',
      applicationId: document.getElementById('grv-app-id')?.value?.trim() || '',
      portal,
      customPortalName,
      referenceNumber: document.getElementById('grv-ref')?.value?.trim() || '',
      date: document.getElementById('grv-date')?.value || getTodayDate(),
      status: document.getElementById('grv-status')?.value || 'Pending',
      department: document.getElementById('grv-dept')?.value?.trim() || '',
      atr: document.getElementById('grv-atr')?.value?.trim() || '',
      aadhaarSeedingStatus: portal === 'NPCI' ? (document.getElementById('grv-npci-aadhaar')?.value || '') : '',
      bankMapping: portal === 'NPCI' ? (document.getElementById('grv-npci-bank')?.value?.trim() || '') : '',
      remarks: document.getElementById('grv-remarks')?.value?.trim() || ''
    });
    if (!res?.success) {
      showToast('Could not save grievance.', 'danger');
      return;
    }
    closeModal();
    showToast(`Grievance ${res.grievance.referenceNumber} saved (${res.grievance.status}).`, 'success');
    render();
  },

  handleUniversalSearchHitClick: EnterpriseExt.handleUniversalSearchHitClick,
  refreshUniversalSearchIfActive: EnterpriseExt.refreshUniversalSearchIfActive,
  ...createGasHandlers({ AppState, showToast, openModal, closeModal, showConfirmDialog, render, scheduleSearchRender })
});

EnterpriseExt.registerUiHooks({ showToast, openModal, closeModal, showConfirmDialog, render });
TeamChat.registerChatHooks({ showToast, showConfirmDialog });

// Debounced Search Re-Render with Exact Focus & Cursor Preservation
let _searchRenderTimer = null;
function scheduleSearchRender(fallbackInputId = '') {
  if (_searchRenderTimer) clearTimeout(_searchRenderTimer);
  _searchRenderTimer = setTimeout(() => {
    _searchRenderTimer = null;
    const active = document.activeElement;
    const activeId = active?.id || fallbackInputId;
    const selStart = typeof active?.selectionStart === 'number' ? active.selectionStart : null;
    const selEnd = typeof active?.selectionEnd === 'number' ? active.selectionEnd : null;
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
  }, 65);
}

// Initial App Boot (idempotent guard against double initialization)
let _erpBooted = false;
let _reminderTimerId = null;

function runDueReminderSchedulerTick() {
  try {
    const dueNow = checkDueDateTimeReminders();
    if (Array.isArray(dueNow) && dueNow.length > 0) {
      dueNow.forEach(rem => {
        showToast(`⏰ Reminder Due: ${rem.reminderType} — ${rem.customerName} (${rem.title})`, 'warning');
      });
      render();
    }
  } catch {}
}

function bootErpShell() {
  if (_erpBooted) return;
  _erpBooted = true;
  const hash = window.location.hash.replace('#', '');
  if (hash) AppState.currentRoute = normalizeRoute(hash);
  applyTheme(AppState.theme);
  runDueReminderSchedulerTick();
  if (!_reminderTimerId) {
    _reminderTimerId = setInterval(runDueReminderSchedulerTick, 30000);
  }
  const isReactManaged = document.getElementById('root')?.dataset?.reactManaged === 'true';
  if (!isReactManaged) {
    render();
    refreshSessionPermissions().then((ok) => {
      if (ok) {
        render();
        Promise.allSettled([
          fetchGlobalCounterStatus('CASE'),
          syncWardVillageMasterFromServer(),
          syncAnnapurnaAppsFromServer(),
          syncUpiSettingsFromServer(),
          syncGasStateFromServer(),
          syncTeamStateFromServer(),
          syncTeamDocumentsFromServer(),
          syncHrStateFromServer(),
          DeptViews.syncExtendedErpFromServer(),
          MenuMgmt.syncMenuConfigFromServer()
        ]).then(() => {
          render();
        });
      }
    });
  } else {
    MenuMgmt.syncMenuConfigFromServer().then(() => {
      if (document.getElementById('erp-root')) render();
    });
  }
}

function syncRateChartDependentsLive() {
  // 1. Live refresh Official Service Directory modal if open
  const catalogGrid = document.getElementById('catalog-grid');
  if (catalogGrid && typeof window.MJK?.filterCategoryCatalog === 'function') {
    const searchEl = document.getElementById('catalog-search');
    const query = searchEl ? searchEl.value : (window._catalogSearchQuery || '');
    catalogGrid.innerHTML = window.MJK.filterCategoryCatalog(query);
    const titleEl = document.getElementById('catalog-directory-title');
    if (titleEl && typeof window.MJK?.getOfficialDirectoryStats === 'function') {
      const { categoryCount, serviceCount } = window.MJK.getOfficialDirectoryStats();
      titleEl.textContent = `Official Service Directory (${categoryCount} Categories · ${serviceCount} Services)`;
    }
  }

  // 2. Live refresh Quick Entry modal pickers if open
  const srvAutoPicker = document.getElementById('srv-auto-picker');
  if (srvAutoPicker && typeof window.MJK?.buildServiceAutoPickerOptionsHtml === 'function') {
    const isEditMode = Boolean(document.getElementById('srv-edit-id')?.value);
    const prevAutoVal = srvAutoPicker.value;
    const placeholderOpt = srvAutoPicker.options?.[0]?.outerHTML || '<option value="">-- Select a Service to Add to Receipt --</option>';
    srvAutoPicker.innerHTML = placeholderOpt + window.MJK.buildServiceAutoPickerOptionsHtml(prevAutoVal, !isEditMode);
    if (prevAutoVal) srvAutoPicker.value = prevAutoVal;

    const srvCat = document.getElementById('srv-cat');
    const srvSub = document.getElementById('srv-subcat');
    if (srvCat) {
      const prevCat = srvCat.value;
      const cats = getServiceCategories();
      srvCat.innerHTML = `
        ${cats.map(c => `<option value="${escHtml(c)}" ${prevCat === c ? 'selected' : ''}>${escHtml(c)}</option>`).join('')}
        <option value="__NEW_CATEGORY__">+ Add New Custom Category...</option>
      `;
      if (prevCat && cats.includes(prevCat)) {
        srvCat.value = prevCat;
      }
      if (srvSub && typeof window.MJK?.handleServiceCategoryChange === 'function') {
        window.MJK.handleServiceCategoryChange(srvCat.value, srvSub.value || '');
      }
      const viewDirBtn = document.getElementById('srv-view-catalog-btn');
      if (viewDirBtn) viewDirBtn.textContent = `📋 View Directory (${cats.length})`;
    }
  }

  // 3. Live refresh Billing Invoice Rate Picker if open
  const invRatePicker = document.getElementById('inv-rate-picker');
  if (invRatePicker && typeof window.MJK?.buildInvoiceRatePickerOptionsHtml === 'function') {
    const prevRateId = invRatePicker.value;
    invRatePicker.innerHTML = window.MJK.buildInvoiceRatePickerOptionsHtml(prevRateId);
    if (prevRateId) {
      invRatePicker.value = prevRateId;
    }
  }

  // 4. Live refresh Global Search modal (Ctrl+K) & Universal Search view
  if (typeof EnterpriseExt.refreshOpenGlobalSearchModalIfOpen === 'function') {
    EnterpriseExt.refreshOpenGlobalSearchModalIfOpen();
  }
  if (typeof EnterpriseExt.refreshUniversalSearchIfActive === 'function') {
    EnterpriseExt.refreshUniversalSearchIfActive();
  }
}

window.addEventListener('mun-rate-chart-updated', () => {
  syncRateChartDependentsLive();
  if (AppState.currentRoute === 'yuva-siksha-barasa') {
    render();
  }
});

window.addEventListener('storage', (e) => {
  if (e && (e.key === RATE_CHART_KEY || e.key === KEYS.CUSTOM_SERVICE_CATALOG)) {
    syncRateChartDependentsLive();
    const active = document.activeElement;
    const isTypingInRateInput = active && (active.classList?.contains('rate-input-charge') || active.classList?.contains('rate-input-gov'));
    if (!isTypingInRateInput) {
      render();
    }
  }
});

document.addEventListener('DOMContentLoaded', bootErpShell);

if (document.readyState === 'interactive' || document.readyState === 'complete') {
  bootErpShell();
}
