/**
 * auth.js - User Authentication & Role-Based Access Control (RBAC)
 * Official Shop: MUN COMPUTER
 */

import { getItem, setItem, KEYS, logAuditAction, getAuthHeaders } from './storage.js';

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF'
};

/**
 * Route Permission Mapping
 * Defines which ERP routes each role is authorized to access
 */
const OPERATIONS_ROUTES = [
  'operations-dashboard',
  'daily-task-manager',
  'service-requests',
  'service-delivery-tracking',
  'document-processing',
  'applications',
  'services',
  'operational-reports'
];

const GAS_SERVICE_ROUTES = [
  'gas-dashboard',
  'gas-customers',
  'gas-bookings',
  'gas-eligibility',
  'gas-subsidy',
  'gas-non-taker',
  'gas-collections',
  'gas-accessories',
  'gas-storage',
  'gas-suppliers',
  'gas-service-replacement',
  'gas-reports',
  'gas-settings'
];

const GAS_MANAGER_ROUTES = GAS_SERVICE_ROUTES.filter(r => r !== 'gas-settings');

const GAS_STAFF_ROUTES = [
  'gas-dashboard',
  'gas-customers',
  'gas-bookings',
  'gas-eligibility',
  'gas-subsidy',
  'gas-collections',
  'gas-accessories',
  'gas-service-replacement'
];

export const ROUTE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    'dashboard',
    'universal-search',
    'applications',
    'locations-master',
    'customers',
    'services',
    'rate-chart',
    'inventory',
    'daybook',
    'payroll',
    'counter-daybook',
    'daily-opening-cash',
    'daily-closing-cash',
    'cash-reports',
    'govt-annapurna',
    'annapurna-applications',
    'annapurna-complaints',
    'annapurna-timeline',
    'annapurna-reports',
    'yuva-siksha-barasa',
    'staff-attendance',
    'time-register',
    'gps-attendance',
    'staff-location-map',
    'attendance-reports',
    'staff-directory',
    'attendance-tracking',
    'employee-reports',
    ...OPERATIONS_ROUTES,
    ...GAS_SERVICE_ROUTES,
    'followups',
    'payments',
    'invoices',
    'expenses',
    'income',
    'business',
    'targets',
    'projects',
    'investments',
    'marketing',
    'competitors',
    'tasks',
    'chat',
    'documents',
    'reports',
    'admin-managers',
    'admin-staff',
    'admin-settings',
    'security-settings',
    'database-management',
    'menu-management',
    'settings'
  ],
  [ROLES.MANAGER]: [
    'dashboard',
    'universal-search',
    'applications',
    'locations-master',
    'customers',
    'services',
    'rate-chart',
    'inventory',
    'daybook',
    'payroll',
    'counter-daybook',
    'daily-opening-cash',
    'daily-closing-cash',
    'cash-reports',
    'govt-annapurna',
    'annapurna-applications',
    'annapurna-complaints',
    'annapurna-timeline',
    'annapurna-reports',
    'yuva-siksha-barasa',
    'staff-attendance',
    'time-register',
    'gps-attendance',
    'staff-location-map',
    'attendance-reports',
    'staff-directory',
    'attendance-tracking',
    'employee-reports',
    ...OPERATIONS_ROUTES,
    ...GAS_MANAGER_ROUTES,
    'followups',
    'payments',
    'invoices',
    'expenses',
    'income',
    'business',
    'targets',
    'projects',
    'tasks',
    'chat',
    'documents',
    'reports',
    'admin-staff'
  ],
  [ROLES.STAFF]: [
    'dashboard',
    'universal-search',
    'applications',
    'locations-master',
    'customers',
    'services',
    'rate-chart',
    'inventory',
    'daybook',
    'payroll',
    'govt-annapurna',
    'annapurna-applications',
    'annapurna-complaints',
    'annapurna-timeline',
    'annapurna-reports',
    'yuva-siksha-barasa',
    'staff-attendance',
    'time-register',
    'gps-attendance',
    'staff-location-map',
    'attendance-reports',
    'staff-directory',
    'attendance-tracking',
    'employee-reports',
    ...OPERATIONS_ROUTES,
    ...GAS_STAFF_ROUTES,
    'followups',
    'payments',
    'tasks',
    'chat',
    'documents'
  ]
};

/**
 * Granular Permission Matrix for Feature Actions
 */
export const PERMISSIONS = {
  [ROLES.ADMIN]: {
    canApproveUsers: true,
    canManageUsers: true,
    canViewFinancials: true,
    canManageSettings: true,
    canDeleteRecords: true,
    canManageTargets: true,
    canManageProjects: true,
    canManageInvestments: true,
    canSwitchBusinessUnits: true,
    canExportData: true,
    canManageCustomers: true,
    canManageServices: true,
    canManageFollowups: true,
    canManagePayments: true,
    canManageInvoices: true,
    canManageExpenses: true,
    canManageTasks: true,
    canManageBanking: true,
    canManageInventory: true,
    canManageDaybook: true,
    canManagePayroll: true
  },
  [ROLES.MANAGER]: {
    canApproveUsers: false,
    canManageUsers: true,
    canManageStaffOnly: true,
    canViewFinancials: true,
    canManageSettings: false,
    canDeleteRecords: false,
    canManageTargets: true,
    canManageProjects: true,
    canManageInvestments: false,
    canSwitchBusinessUnits: true,
    canExportData: true,
    canManageCustomers: true,
    canManageServices: true,
    canManageFollowups: true,
    canManagePayments: true,
    canManageInvoices: true,
    canManageExpenses: true,
    canManageTasks: true,
    canManageBanking: true,
    canManageInventory: true,
    canManageDaybook: true,
    canManagePayroll: true
  },
  [ROLES.STAFF]: {
    canApproveUsers: false,
    canManageUsers: false,
    canViewFinancials: false,
    canManageSettings: false,
    canDeleteRecords: false,
    canManageTargets: false,
    canManageProjects: false,
    canManageInvestments: false,
    canSwitchBusinessUnits: false,
    canExportData: false,
    canManageCustomers: true,
    canManageServices: true,
    canManageFollowups: true,
    canManagePayments: true,
    canManageInvoices: false,
    canManageExpenses: false,
    canManageTasks: true,
    canManageBanking: true,
    canManageInventory: true,
    canManageDaybook: true,
    canManagePayroll: false
  }
};

export const MAIN_ADMIN_UID = 'MC-ADM-14012025';
export const UID_ORG_PREFIX = 'MC';
export const ROLE_UID_CODES = {
  ADMIN: 'ADM',
  MANAGER: 'MGR',
  STAFF: 'STF'
};
export const MANAGER_UID = 'MC-ADM-14012025';
export const MANAGER_UID_PREFIX = 'MC';
export const STAFF_UID_PREFIX = 'MC';

/**
 * Human-facing role display label (3 official levels: ADMINISTRATION, MANAGER, STAFF)
 */
export function formatRoleLabel(role = 'STAFF') {
  const r = String(role || 'STAFF').trim().toUpperCase();
  if (r === 'ADMIN' || r === 'ADMINISTRATION') return 'ADMINISTRATION';
  if (r === 'MANAGER') return 'MANAGER';
  return 'STAFF';
}

/**
 * Role Overview & Capabilities Description
 */
export const ROLE_CAPABILITIES = {
  [ROLES.ADMIN]: {
    title: 'Administration Authority',
    badge: 'Full Access',
    description: 'Complete system control. Manage services, customers, reports, settings, audit logs, and staff operations (user approvals reserved for Administration).',
    accessibleModules: ['All ERP Modules', 'Service & Location Catalog', 'Financial Control', 'Audit Logs & Settings']
  },
  [ROLES.MANAGER]: {
    title: 'Operations Manager',
    badge: 'Operations & Finance',
    description: 'Manage assigned staff, customers, services, application verification, billing, counter payments, and authorized reports.',
    accessibleModules: ['Customers & Applications', 'Service Tracking', 'Billing & Payments', 'Team Tasks & Reports']
  },
  [ROLES.STAFF]: {
    title: 'Front Desk Operator / Staff',
    badge: 'Front Desk & Service Desk',
    description: 'Register customers, enter new applications, upload KYC documents, record counter payments, and print receipts.',
    accessibleModules: ['Customer Registration', 'Application Entry', 'Document Upload', 'Counter Payments & Receipts']
  }
};

/**
 * Get currently authenticated user from localStorage.
 */
export function getCurrentUser() {
  const user = getItem(KEYS.CURRENT_USER);
  if (!user || user.isLoggedOut) {
    return null;
  }
  return user;
}

/**
 * Set active authenticated user in localStorage
 */
export function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(KEYS.CURRENT_USER);
    return;
  }
  const cleanUser = { ...user, isLoggedOut: false, lastLoginAt: user.lastLoginAt || new Date().toISOString() };
  setItem(KEYS.CURRENT_USER, cleanUser);
}

export function isMainAdmin(user = null) {
  const activeUser = user || getCurrentUser();
  if (!activeUser) return false;
  const uid = String(activeUser.uid || activeUser.userId || activeUser.id || '').trim().toUpperCase();
  return (
    uid === MAIN_ADMIN_UID ||
    activeUser.isMainAdmin === true ||
    activeUser.isSuperAdmin === true
  );
}

export function isSuperAdmin(user = null) {
  return isMainAdmin(user);
}

export function handleSessionInvalidationResponse(status, data) {
  if (status === 401 && data && typeof data.message === 'string' && /session|expired|invalidated/i.test(data.message)) {
    logout();
    window.dispatchEvent(new CustomEvent('mun-auth-logout'));
    return true;
  }
  return false;
}

export function normalizeMenuId(route) {
  const r = String(route || '').trim();
  if (r === 'daybook') return 'counter-daybook';
  if (r === 'payroll') return 'salary-payroll';
  if (r === 'card-studio') return 'counter-daybook';
  if (r === 'staff-attendance' || r === 'gps-attendance' || r === 'staff-location-map' || r === 'attendance-photo-gallery') {
    return 'attendance-tracking';
  }
  if (r === 'attendance-reports') return 'employee-reports';
  if (
    r === 'followups-today' ||
    r === 'followups-upcoming' ||
    r === 'followups-overdue' ||
    r === 'followups-pending' ||
    r === 'followups-completed' ||
    r === 'followups-review90' ||
    r === 'followups-reminders'
  ) {
    return 'followups';
  }
  if (r === 'daily-opening') return 'daily-opening-cash';
  if (r === 'daily-closing') return 'daily-closing-cash';
  if (
    r === 'annapurna-applications' ||
    r === 'annapurna-complaints' ||
    r === 'annapurna-timeline' ||
    r === 'annapurna-reports'
  ) {
    return 'govt-annapurna';
  }
  return r;
}

const CLIENT_ALL_MENU_IDS = [
  // 1. MAIN DASHBOARD
  'dashboard', 'business-overview', 'todays-summary', 'pending-activities', 'quick-actions', 'universal-search',
  // 2. SERVICES (ANNAPURNA YOJANA SYSTEM & BANGLAR YUVA SIKSHA BARASA CARD)
  'govt-annapurna', 'annapurna-applications', 'annapurna-complaints', 'annapurna-timeline', 'annapurna-reports', 'yuva-siksha-barasa',
  // 3. TEAM MANAGEMENT
  'staff-directory', 'recruitment', 'employee-profile', 'attendance-tracking', 'leave-management',
  'salary-payroll', 'payslips', 'tasks', 'kpi-performance', 'training', 'offer-letters', 'documents',
  'rewards-disciplinary', 'employee-reports',
  'staff-attendance', 'time-register', 'gps-attendance', 'staff-location-map', 'attendance-photo-gallery', 'attendance-reports', 'chat',
  // 4. CUSTOMER MANAGEMENT
  'customers', 'customer-registration', 'customer-profiles', 'customer-documents', 'services',
  'followups', 'grievances', 'customer-feedback', 'customer-dues', 'customer-reports',
  // 5. SALES & BILLING
  'sales-dashboard', 'new-invoice', 'invoices', 'quotations', 'estimates', 'payments',
  'sales-returns', 'credit-notes', 'gst-billing', 'customer-ledger', 'sales-reports',
  // 6. INVENTORY & PURCHASE
  'inventory-dashboard', 'product-categories', 'inventory', 'stock-adjustment',
  'purchase-orders', 'suppliers', 'purchase-bills', 'stock-transfers', 'low-stock-alerts',
  'barcode-management', 'inventory-reports',
  // 7. FINANCE & ACCOUNTING
  'finance-dashboard', 'counter-daybook', 'daily-opening-cash', 'daily-closing-cash', 'cash-reports',
  'bank-accounts', 'daily-transactions', 'income', 'expenses', 'accounts-payable', 'accounts-receivable',
  'general-ledger', 'journal-entries', 'bank-reconciliation', 'gst-management', 'financial-reports',
  'profit-loss', 'balance-sheet',
  // 8. LPG & GAS SERVICES
  ...GAS_SERVICE_ROUTES, 'gas-new-booking', 'gas-delivery-management', 'gas-complaints',
  // 9. OPERATIONS MANAGEMENT
  'operations-dashboard', 'daily-task-manager', 'service-requests', 'service-delivery-tracking',
  'document-processing', 'applications', 'operational-reports',
  // 10. GROWTH & MARKETING
  'growth-dashboard', 'growth-plan', 'targets', 'profit-targets', 'marketing', 'promotions-offers',
  'customer-acquisition', 'referral-management', 'lead-management', 'whatsapp-connect', 'projects',
  'investments', 'competitors', 'growth-reports',
  // 11. REPORTS & ANALYTICS
  'reports', 'daily-reports', 'monthly-reports', 'employee-performance-analytics',
  'sales-analytics', 'purchase-analytics', 'inventory-analytics', 'financial-analytics',
  'customer-analytics', 'department-reports', 'custom-report-builder', 'pdf-excel-export',
  // 12. SYSTEM & SECURITY
  'login-history', 'audit-logs', 'activity-logs', 'notification-settings', 'settings', 'database-management',
  'admin-settings', 'business', 'locations-master', 'data-import-export', 'security-settings', 'rate-chart', 'menu-management',
  // ADMINISTRATION (EXACTLY 2 SUBMENUS: MANAGER & STAFF)
  'admin-managers', 'admin-staff'
];

function makeSet(overrides = {}) {
  return { view: false, add: false, edit: false, delete: false, approve: false, export: false, print: false, ...overrides };
}

function allTrueSet() {
  return { view: true, add: true, edit: true, delete: true, approve: true, export: true, print: true };
}

function getDefaultRoleEffectiveClient(roleInput = 'STAFF') {
  const rawRole = String(roleInput || 'STAFF').trim().toUpperCase();
  const role = rawRole === 'ADMIN' || rawRole === 'MANAGER' ? rawRole : 'STAFF';
  const menus = {};
  if (role === 'ADMIN') {
    CLIENT_ALL_MENU_IDS.forEach(id => { menus[id] = allTrueSet(); });
    return {
      role: 'ADMIN',
      isMainAdmin: false,
      isSuperAdmin: false,
      menus,
      extra: {
        cashOperationLimit: 0,
        customerAccessScope: 'ALL',
        customerAccessLimit: 0,
        canApproveTransactions: true,
        canViewAllAttendancePhotos: true,
        canManageBackupSettings: true,
        canManageUserPermissions: true,
        accountActive: true
      }
    };
  }
  if (role === 'MANAGER') {
    CLIENT_ALL_MENU_IDS.forEach(id => { menus[id] = makeSet(); });
    [
      'dashboard', 'business-overview', 'todays-summary', 'pending-activities', 'quick-actions', 'universal-search',
      'staff-directory', 'recruitment', 'employee-profile', 'attendance-tracking', 'leave-management',
      'salary-payroll', 'payslips', 'tasks', 'kpi-performance', 'training', 'offer-letters', 'documents',
      'rewards-disciplinary', 'employee-reports', 'staff-attendance', 'time-register', 'gps-attendance',
      'staff-location-map', 'attendance-reports', 'chat',
      'customers', 'customer-registration', 'customer-profiles', 'customer-documents', 'services',
      'followups', 'grievances', 'customer-feedback', 'customer-dues', 'customer-reports',
      'sales-dashboard', 'new-invoice', 'invoices', 'quotations', 'estimates', 'payments',
      'sales-returns', 'credit-notes', 'gst-billing', 'customer-ledger', 'sales-reports',
      'inventory-dashboard', 'rate-chart', 'product-categories', 'inventory', 'stock-adjustment',
      'purchase-orders', 'suppliers', 'purchase-bills', 'stock-transfers', 'low-stock-alerts',
      'barcode-management', 'inventory-reports',
      'finance-dashboard', 'counter-daybook', 'daily-opening-cash', 'daily-closing-cash', 'cash-reports',
      'bank-accounts', 'daily-transactions', 'accounts-payable', 'accounts-receivable',
      ...GAS_MANAGER_ROUTES, 'gas-new-booking', 'gas-delivery-management', 'gas-complaints',
      'govt-annapurna', 'annapurna-applications', 'annapurna-complaints', 'annapurna-timeline', 'annapurna-reports', 'yuva-siksha-barasa',
      'operations-dashboard', 'daily-task-manager', 'service-requests', 'service-delivery-tracking',
      'document-processing', 'applications', 'operational-reports',
      'growth-dashboard', 'growth-plan', 'targets', 'profit-targets', 'promotions-offers',
      'customer-acquisition', 'referral-management', 'lead-management', 'whatsapp-connect', 'growth-reports',
      'reports', 'daily-reports', 'monthly-reports', 'employee-performance-analytics',
      'sales-analytics', 'purchase-analytics', 'inventory-analytics', 'financial-analytics',
      'customer-analytics', 'department-reports', 'custom-report-builder', 'pdf-excel-export',
      'locations-master'
    ].forEach(id => {
      menus[id] = makeSet({ view: true, add: true, edit: true, delete: false, approve: true, export: true, print: true });
    });
    menus['expenses'] = makeSet({ view: true, add: true, edit: true, delete: false, approve: false, export: true, print: true });
    ['income', 'general-ledger', 'journal-entries', 'bank-reconciliation', 'gst-management', 'financial-reports', 'profit-loss', 'balance-sheet'].forEach(id => {
      menus[id] = makeSet({ view: true, export: true, print: true });
    });
    menus['attendance-photo-gallery'] = makeSet({ view: true, export: true, print: true });
    menus['projects'] = makeSet({ view: true, add: true, edit: true, print: true });
    // Manager manages Staff accounts ONLY under ADMINISTRATION -> STAFF
    menus['admin-managers'] = makeSet();
    menus['admin-staff'] = makeSet({ view: true, add: true, edit: true, delete: false, approve: false, export: true, print: true });
    return {
      role: 'MANAGER',
      isMainAdmin: false,
      isSuperAdmin: false,
      menus,
      extra: {
        cashOperationLimit: 50000,
        customerAccessScope: 'ALL',
        customerAccessLimit: 0,
        canApproveTransactions: true,
        canViewAllAttendancePhotos: false,
        canManageBackupSettings: false,
        canManageUserPermissions: false,
        accountActive: true
      }
    };
  }
  CLIENT_ALL_MENU_IDS.forEach(id => { menus[id] = makeSet(); });
  menus['dashboard'] = makeSet({ view: true });
  menus['business-overview'] = makeSet({ view: true });
  menus['todays-summary'] = makeSet({ view: true });
  menus['pending-activities'] = makeSet({ view: true });
  menus['quick-actions'] = makeSet({ view: true });
  menus['universal-search'] = makeSet({ view: true });
  menus['employee-profile'] = makeSet({ view: true, print: true });
  menus['attendance-tracking'] = makeSet({ view: true, add: true, print: true });
  menus['staff-attendance'] = makeSet({ view: true, add: true });
  menus['time-register'] = makeSet({ view: true, add: true });
  menus['gps-attendance'] = makeSet({ view: true, add: true });
  menus['staff-location-map'] = makeSet({ view: true });
  menus['attendance-photo-gallery'] = makeSet({ view: true, print: true });
  menus['leave-management'] = makeSet({ view: true, add: true });
  menus['payslips'] = makeSet({ view: true, print: true });
  menus['tasks'] = makeSet({ view: true, edit: true });
  menus['kpi-performance'] = makeSet({ view: true });
  menus['training'] = makeSet({ view: true, add: true });
  menus['documents'] = makeSet({ view: true, add: true, print: true });
  menus['employee-reports'] = makeSet({ view: true, print: true });
  menus['attendance-reports'] = makeSet({ view: true, print: true });
  menus['chat'] = makeSet({ view: true, add: true, edit: true, delete: true });
  menus['customers'] = makeSet({ view: true, add: true, edit: true, print: true });
  menus['customer-registration'] = makeSet({ view: true, add: true });
  menus['customer-profiles'] = makeSet({ view: true, print: true });
  menus['customer-documents'] = makeSet({ view: true, add: true, print: true });
  menus['services'] = makeSet({ view: true, add: true, print: true });
  menus['followups'] = makeSet({ view: true, add: true, edit: true });
  menus['grievances'] = makeSet({ view: true, add: true, edit: true });
  menus['customer-feedback'] = makeSet({ view: true, add: true });
  menus['customer-dues'] = makeSet({ view: true, print: true });
  menus['rate-chart'] = makeSet({ view: true, print: true });
  menus['whatsapp-connect'] = makeSet({ view: true, add: true });
  menus['new-invoice'] = makeSet({ view: true, add: true, print: true });
  menus['invoices'] = makeSet({ view: true, add: true, print: true });
  menus['quotations'] = makeSet({ view: true, add: true, print: true });
  menus['estimates'] = makeSet({ view: true, add: true, print: true });
  menus['payments'] = makeSet({ view: true, add: true, print: true });
  menus['expenses'] = makeSet({ view: true, add: true });
  menus['operations-dashboard'] = makeSet({ view: true });
  menus['daily-task-manager'] = makeSet({ view: true, edit: true });
  menus['service-requests'] = makeSet({ view: true, add: true, edit: true });
  menus['service-delivery-tracking'] = makeSet({ view: true, edit: true });
  menus['document-processing'] = makeSet({ view: true, add: true, edit: true });
  menus['applications'] = makeSet({ view: true, add: true, edit: true, print: true });
  menus['govt-annapurna'] = makeSet({ view: true, add: true, edit: true, print: true });
  menus['annapurna-applications'] = makeSet({ view: true, add: true, edit: true, print: true });
  menus['annapurna-complaints'] = makeSet({ view: true, add: true, edit: true, print: true });
  menus['annapurna-timeline'] = makeSet({ view: true, add: true, edit: true, print: true });
  menus['annapurna-reports'] = makeSet({ view: true, print: true, export: true });
  menus['yuva-siksha-barasa'] = makeSet({ view: true, add: true, edit: true, print: true, export: true });
  menus['locations-master'] = makeSet({ view: true });
  menus['gas-dashboard'] = makeSet({ view: true });
  menus['gas-new-booking'] = makeSet({ view: true, add: true, print: true });
  menus['gas-customers'] = makeSet({ view: true, add: true, edit: true, print: true });
  menus['gas-bookings'] = makeSet({ view: true, add: true, edit: true, print: true });
  menus['gas-delivery-management'] = makeSet({ view: true, edit: true, print: true });
  menus['gas-eligibility'] = makeSet({ view: true, add: true, print: true });
  menus['gas-subsidy'] = makeSet({ view: true, add: true, print: true });
  menus['gas-collections'] = makeSet({ view: true, add: true, print: true });
  menus['gas-accessories'] = makeSet({ view: true, add: true, print: true });
  menus['gas-service-replacement'] = makeSet({ view: true, add: true, edit: true, print: true });
  menus['gas-complaints'] = makeSet({ view: true, add: true, edit: true });
  if (role === 'CHECKER') {
    menus['reports'] = makeSet({ view: true, print: true });
    menus['gas-reports'] = makeSet({ view: true, print: true });
  }
  return {
    role: role || 'STAFF',
    isSuperAdmin: false,
    menus,
    extra: {
      cashOperationLimit: 5000,
      customerAccessScope: 'ASSIGNED',
      customerAccessLimit: 250,
      canApproveTransactions: false,
      canViewAllAttendancePhotos: false,
      canManageBackupSettings: false,
      canManageUserPermissions: false,
      accountActive: true
    }
  };
}

export function getEffectivePermissions(user = null) {
  const activeUser = user || getCurrentUser();
  if (!activeUser || !activeUser.role) {
    const empty = getDefaultRoleEffectiveClient('STAFF');
    Object.keys(empty.menus).forEach(k => { empty.menus[k] = makeSet(); });
    empty.extra.accountActive = false;
    return empty;
  }

  const rootSuper = isSuperAdmin(activeUser);
  if (rootSuper) {
    const adminEff = getDefaultRoleEffectiveClient('ADMIN');
    adminEff.isSuperAdmin = true;
    return adminEff;
  }

  if (activeUser.effectivePermissions && activeUser.effectivePermissions.menus && activeUser.effectivePermissions.extra) {
    const roleDefault = getDefaultRoleEffectiveClient(String(activeUser.role || 'STAFF').trim().toUpperCase());
    const mergedMenus = { ...roleDefault.menus, ...activeUser.effectivePermissions.menus };
    return {
      ...activeUser.effectivePermissions,
      menus: mergedMenus
    };
  }

  const role = String(activeUser.role || 'STAFF').trim().toUpperCase();
  const base = getDefaultRoleEffectiveClient(role);
  const ov = activeUser.permissionOverrides || {};
  Object.keys(base.menus).forEach(menuId => {
    if (ov[menuId] && typeof ov[menuId] === 'object') {
      base.menus[menuId] = { ...base.menus[menuId], ...ov[menuId] };
    }
  });
  if (activeUser.extraPermissions && typeof activeUser.extraPermissions === 'object') {
    base.extra = { ...base.extra, ...activeUser.extraPermissions };
  }
  if (activeUser.status && activeUser.status !== 'ACTIVE') {
    base.extra.accountActive = false;
  }
  if (role !== 'ADMIN') {
    base.menus['attendance-photo-gallery'].delete = false;
    base.menus['admin-managers'] = makeSet();
    base.menus['admin-settings'] = makeSet();
    base.menus['security-settings'] = makeSet();
    base.menus['database-management'] = makeSet();
    base.menus['menu-management'] = makeSet();
    base.menus['settings'] = makeSet();
    base.extra.canManageBackupSettings = false;
    base.extra.canManageUserPermissions = false;
    if (role !== 'MANAGER') {
      base.menus['admin-staff'] = makeSet();
      base.extra.canViewAllAttendancePhotos = false;
      base.menus['leave-management'].approve = false;
      base.menus['salary-payroll'] = makeSet();
    }
  }
  return base;
}

export function canMenu(menuId, action = 'view', user = null) {
  const activeUser = user || getCurrentUser();
  if (!activeUser || !activeUser.role) return false;
  if (isSuperAdmin(activeUser)) return true;
  const eff = getEffectivePermissions(activeUser);
  if (eff.extra && eff.extra.accountActive === false) return false;
  const normalized = normalizeMenuId(menuId);
  const set = eff.menus?.[normalized];
  if (!set) return false;
  return Boolean(set[action]);
}

export function canExtra(flagName, user = null) {
  const activeUser = user || getCurrentUser();
  if (!activeUser || !activeUser.role) return false;
  if (isSuperAdmin(activeUser)) {
    if (flagName === 'cashOperationLimit' || flagName === 'customerAccessLimit') return 0;
    if (flagName === 'customerAccessScope') return 'ALL';
    return true;
  }
  const eff = getEffectivePermissions(activeUser);
  return eff.extra ? eff.extra[flagName] : undefined;
}

export function getCashOperationLimit(user = null) {
  const activeUser = user || getCurrentUser();
  if (!activeUser || isSuperAdmin(activeUser)) return 0;
  const val = Number(canExtra('cashOperationLimit', activeUser));
  return Number.isFinite(val) && val > 0 ? val : 0;
}

export async function refreshSessionPermissions() {
  const token = localStorage.getItem('MUN_COMPUTER_SESSION_TOKEN') || '';
  const active = getCurrentUser();
  if (!token || !active) return null;
  try {
    const resp = await fetch('/api/auth/session', {
      headers: getAuthHeaders()
    });
    const data = await resp.json();
    if (resp.ok && data.authenticated && data.user) {
      setCurrentUser({ ...active, ...data.user });
      return data.user;
    }
    if (resp.status === 401 || data.authenticated === false) {
      handleSessionInvalidationResponse(401, { message: data.message || 'Session expired' });
    }
  } catch {
    // offline or transient failure
  }
  return null;
}

/**
 * Check if the active user or given user possesses a specific permission flag
 */
export function can(permissionName, user = null) {
  const activeUser = user || getCurrentUser();
  if (!activeUser || !activeUser.role) return false;
  if (isMainAdmin(activeUser)) return true;

  if (permissionName === 'canApproveUsers') {
    return activeUser.role === 'ADMIN' || Boolean(canMenu('admin-managers', 'approve', activeUser));
  }
  if (permissionName === 'canManageUsers') {
    return Boolean(canMenu('admin-managers', 'view', activeUser) || canMenu('admin-staff', 'view', activeUser));
  }
  if (permissionName === 'canManageSettings') {
    return activeUser.role === 'ADMIN' && Boolean(canMenu('settings', 'view', activeUser) || canExtra('canManageBackupSettings', activeUser));
  }
  if (permissionName === 'canViewFinancials') {
    return Boolean(canMenu('payments', 'view', activeUser) || canMenu('income', 'view', activeUser) || canMenu('cash-reports', 'view', activeUser));
  }
  if (permissionName === 'canDeleteRecords') {
    return activeUser.role === 'ADMIN' || Boolean(canMenu('customers', 'delete', activeUser) || canMenu('services', 'delete', activeUser));
  }
  if (permissionName === 'canExportData') {
    return Boolean(canMenu('reports', 'export', activeUser) || canMenu('customers', 'export', activeUser) || canMenu('cash-reports', 'export', activeUser));
  }
  if (permissionName === 'canManageCustomers') return canMenu('customers', 'add', activeUser) || canMenu('customers', 'edit', activeUser);
  if (permissionName === 'canManageServices') return canMenu('services', 'add', activeUser) || canMenu('services', 'edit', activeUser);
  if (permissionName === 'canManageFollowups') return canMenu('followups', 'add', activeUser) || canMenu('followups', 'edit', activeUser);
  if (permissionName === 'canManagePayments') return canMenu('payments', 'add', activeUser) || canMenu('payments', 'edit', activeUser);
  if (permissionName === 'canManageInvoices') return canMenu('invoices', 'add', activeUser) || canMenu('invoices', 'edit', activeUser);
  if (permissionName === 'canManageExpenses') return canMenu('expenses', 'add', activeUser) || canMenu('expenses', 'approve', activeUser);
  if (permissionName === 'canManageTasks') return canMenu('tasks', 'add', activeUser) || canMenu('tasks', 'edit', activeUser);
  if (permissionName === 'canManageInventory') return canMenu('inventory', 'add', activeUser) || canMenu('inventory', 'edit', activeUser);
  if (permissionName === 'canManageDaybook') return canMenu('counter-daybook', 'add', activeUser) || canMenu('counter-daybook', 'edit', activeUser);
  if (permissionName === 'canManagePayroll') return canMenu('staff-attendance', 'edit', activeUser) || activeUser.role === 'ADMIN' || activeUser.role === 'MANAGER';
  if (permissionName === 'canManageTargets') return canMenu('targets', 'add', activeUser) || canMenu('targets', 'edit', activeUser);
  if (permissionName === 'canManageProjects') return canMenu('projects', 'add', activeUser) || canMenu('projects', 'edit', activeUser);
  if (permissionName === 'canManageInvestments') return canMenu('investments', 'add', activeUser) || canMenu('investments', 'edit', activeUser);
  if (permissionName === 'canSwitchBusinessUnits') return canMenu('business', 'view', activeUser);

  const rolePerms = PERMISSIONS[activeUser.role] || {};
  return !!rolePerms[permissionName];
}

/**
 * Check if a role or user is authorized to access a given route
 */
export function canAccessRoute(route, userOrRole = null) {
  if (!route || route === 'login' || route === 'access-denied' || route === 'change-password') return true;

  const adminOnlyRoutes = new Set([
    'admin-managers', 'admin-settings', 'menu-management',
    'security-settings', 'database-management', 'settings'
  ]);

  if (typeof userOrRole === 'string') {
    const r = String(userOrRole).toUpperCase();
    if (adminOnlyRoutes.has(route)) return r === 'ADMIN';
    if (route === 'admin-staff') return r === 'ADMIN' || r === 'MANAGER';
    const def = getDefaultRoleEffectiveClient(userOrRole);
    const norm = normalizeMenuId(route);
    if (route === 'customer-registration') return Boolean(def.menus?.['customers']?.add || def.menus?.['customers']?.view);
    return Boolean(def.menus?.[norm]?.view);
  }

  const targetUser = userOrRole && userOrRole.role ? userOrRole : getCurrentUser();
  if (!targetUser || !targetUser.role) return false;
  if (isMainAdmin(targetUser)) return true;

  const targetRole = String(targetUser.role || '').toUpperCase();
  if (adminOnlyRoutes.has(route)) {
    return targetRole === 'ADMIN';
  }
  if (route === 'admin-staff') {
    return targetRole === 'ADMIN' || (targetRole === 'MANAGER' && canMenu('admin-staff', 'view', targetUser));
  }

  if (String(route).startsWith('custom-menu-')) {
    const cfg = getItem(KEYS.MENU_CONFIG, null);
    const customEntry = Array.isArray(cfg?.customSubmenus) ? cfg.customSubmenus.find(c => c.id === route) : null;
    if (!customEntry || customEntry.enabled === false) return false;
    if (!customEntry.targetRoute || customEntry.targetRoute === 'custom-panel') return true;
    return canAccessRoute(customEntry.targetRoute, targetUser);
  }

  const norm = normalizeMenuId(route);
  if (route === 'customer-registration') return canMenu('customers', 'add', targetUser) || canMenu('customers', 'view', targetUser);
  return canMenu(norm, 'view', targetUser);
}

/**
 * Authenticate credentials strictly against central server API
 */
export async function authenticateAsync(uid, password, panelRole = 'STAFF', captchaToken = '', captchaInput = '') {
  const cleanUid = (uid || '').trim().toUpperCase();
  const inputPass = (password || '').trim();

  if (!cleanUid || !inputPass) {
    return { success: false, message: 'Please provide both User ID and Password.' };
  }

  try {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: cleanUid, password: inputPass, panelRole, captchaToken, captchaInput })
    });
    const data = await resp.json();

    if (resp.ok && data.success) {
      if (data.sessionToken) {
        localStorage.setItem('MUN_COMPUTER_SESSION_TOKEN', data.sessionToken);
      }
      if (data.csrfToken) {
        localStorage.setItem('MUN_COMPUTER_CSRF_TOKEN', data.csrfToken);
      }
      if (data.mfaRequired) {
        return {
          success: true,
          mfaRequired: true,
          mfaPendingToken: data.mfaPendingToken,
          uid: data.uid,
          message: data.message
        };
      }
      setCurrentUser(data.user);
      const users = getItem(KEYS.USERS, []);
      const idx = users.findIndex(u => (u.uid || u.id) === data.user.uid);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...data.user };
      } else {
        users.push(data.user);
      }
      setItem(KEYS.USERS, users);

      return {
        success: true,
        user: data.user,
        mustChangePassword: data.mustChangePassword,
        message: data.message
      };
    }
    return {
      success: false,
      message: data.message || 'Authentication failed. Please check your credentials.'
    };
  } catch {
    return {
      success: false,
      message: 'Central authentication server is unreachable. Please verify server connection.'
    };
  }
}

/**
 * Change password strictly on central server API
 */
export async function changePasswordAsync(uid, currentPassword, newPassword, confirmPassword) {
  try {
    const resp = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ uid, currentPassword, newPassword, confirmPassword })
    });
    const data = await resp.json();

    if (resp.ok && data.success) {
      if (data.sessionToken) {
        localStorage.setItem('MUN_COMPUTER_SESSION_TOKEN', data.sessionToken);
      }
      if (data.csrfToken) {
        localStorage.setItem('MUN_COMPUTER_CSRF_TOKEN', data.csrfToken);
      }
      const active = getCurrentUser();
      if (active && (active.uid === uid || active.id === uid)) {
        const merged = data.user ? { ...active, ...data.user, mustChangePassword: false } : { ...active, mustChangePassword: false };
        setCurrentUser(merged);
      }
      return {
        success: true,
        message: data.message,
        user: data.user,
        dailyLimit: data.dailyLimit,
        dailyChangesUsed: data.dailyChangesUsed,
        remainingChangesToday: data.remainingChangesToday
      };
    }
    return {
      success: false,
      message: data.message || 'Password update failed.',
      dailyLimit: data.dailyLimit,
      dailyChangesUsed: data.dailyChangesUsed,
      remainingChangesToday: data.remainingChangesToday
    };
  } catch {
    return { success: false, message: 'Server unreachable while updating password.' };
  }
}

/**
 * Log out active session, revoke backend SQLite token & clean credentials
 */
export function logout() {
  const user = getCurrentUser();
  const token = localStorage.getItem('MUN_COMPUTER_SESSION_TOKEN') || '';
  if (token) {
    try {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
        keepalive: true
      }).catch(() => {});
    } catch {
      // non-blocking
    }
  }
  if (user) {
    logAuditAction('AUTH_LOGOUT', `User ${user.name} (${user.uid || user.id}) logged out from MUN COMPUTER`, user);
  }
  localStorage.removeItem('MUN_COMPUTER_SESSION_TOKEN');
  localStorage.removeItem('MUN_COMPUTER_CSRF_TOKEN');
  setItem(KEYS.CURRENT_USER, { isLoggedOut: true });
  localStorage.removeItem(KEYS.CURRENT_USER);
}
