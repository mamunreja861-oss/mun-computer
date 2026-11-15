/**
 * server/permissions.ts - 3-Level Role & Individual Permission Control Engine
 * MUN COMPUTER BUSINESS MANAGER ("One Business, Three Levels of Control")
 */

export const PERMISSION_ACTIONS = [
  'view',
  'add',
  'edit',
  'delete',
  'approve',
  'export',
  'print'
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type MenuPermissionSet = Record<PermissionAction, boolean>;

export interface MenuDefinition {
  id: string;
  label: string;
  group: string;
  description: string;
}

export interface ExtraPermissionControls {
  cashOperationLimit: number; // 0 = Unlimited
  customerAccessScope: 'ALL' | 'ASSIGNED';
  customerAccessLimit: number; // 0 = Unlimited
  canApproveTransactions: boolean;
  canViewAllAttendancePhotos: boolean;
  canManageBackupSettings: boolean;
  canManageUserPermissions: boolean;
  accountActive: boolean;
}

export const MAIN_ADMIN_UID = 'MC-ADM-14012025';

export interface EffectivePermissions {
  role: string;
  isMainAdmin: boolean;
  isSuperAdmin: boolean;
  menus: Record<string, MenuPermissionSet>;
  extra: ExtraPermissionControls;
}

export const MENU_DEFINITIONS: MenuDefinition[] = [
  // 1. MAIN DASHBOARD
  { id: 'dashboard', label: 'Executive Dashboard', group: 'MAIN DASHBOARD', description: 'KPI cards and business summary' },
  { id: 'business-overview', label: 'Business Overview', group: 'MAIN DASHBOARD', description: 'Unified department overview & cross-unit KPIs' },
  { id: 'todays-summary', label: "Today's Summary", group: 'MAIN DASHBOARD', description: 'Live daily counter, service & attendance summary' },
  { id: 'pending-activities', label: 'Pending Activities', group: 'MAIN DASHBOARD', description: 'Pending leaves, overdue tasks, bookings & dues' },
  { id: 'quick-actions', label: 'Quick Actions', group: 'MAIN DASHBOARD', description: 'Fast counter & workflow action launcher' },
  { id: 'universal-search', label: 'Universal Search', group: 'MAIN DASHBOARD', description: 'Cross-module global search' },

  // 2. ANNAPURNA YOJANA SYSTEM
  { id: 'govt-annapurna', label: 'Annapurna Yojana System', group: 'ANNAPURNA YOJANA SYSTEM', description: 'Annapurna Yojana live analytics, reminders & overview' },
  { id: 'annapurna-applications', label: 'Case & Problem Tracking', group: 'ANNAPURNA YOJANA SYSTEM', description: 'Annapurna Yojana case registration & Category A-I problem tracking' },
  { id: 'annapurna-complaints', label: 'Claims, RTI & Complaints', group: 'ANNAPURNA YOJANA SYSTEM', description: 'Annapurna claims, RTI filings & grievance tracking' },
  { id: 'annapurna-timeline', label: 'Case Timeline & Follow-ups', group: 'ANNAPURNA YOJANA SYSTEM', description: 'Annapurna chronological timeline & office visit follow-ups' },
  { id: 'annapurna-reports', label: 'Annapurna Reports & Exports', group: 'ANNAPURNA YOJANA SYSTEM', description: 'Annapurna Yojana ward, scheme & filtered case exports' },
  { id: 'yuva-siksha-barasa', label: 'Banglar Yuva Siksha Barasa Card Management', group: 'ANNAPURNA YOJANA SYSTEM', description: 'Auto-synced student, youth, education loan & scholarship card management' },

  // 2. TEAM MANAGEMENT
  { id: 'staff-directory', label: 'All Employees', group: 'TEAM MANAGEMENT', description: 'Staff roster, roles, contact info & directory' },
  { id: 'recruitment', label: 'Recruitment & Job Posting', group: 'TEAM MANAGEMENT', description: 'Open positions & applicant pipeline' },
  { id: 'employee-profile', label: 'Employee ID & Profile', group: 'TEAM MANAGEMENT', description: '360° unified Employee Profile keyed by Employee ID' },
  { id: 'attendance-tracking', label: 'Attendance Management', group: 'TEAM MANAGEMENT', description: 'Daily attendance, live GPS punch, photo map & verified photo gallery' },
  { id: 'leave-management', label: 'Leave & Holiday Management', group: 'TEAM MANAGEMENT', description: 'Leave applications, holiday calendar & attendance sync' },
  { id: 'salary-payroll', label: 'Salary & Payroll', group: 'TEAM MANAGEMENT', description: 'Attendance-integrated monthly payroll calculation & runs' },
  { id: 'payslips', label: 'Payslip & Salary History', group: 'TEAM MANAGEMENT', description: 'Monthly employee payslips & salary payout history' },
  { id: 'tasks', label: 'Staff Task Management', group: 'TEAM MANAGEMENT', description: 'Staff assignments, task board & KPI progress tracking' },
  { id: 'kpi-performance', label: 'KPI / KRA / Performance', group: 'TEAM MANAGEMENT', description: 'Weighted KPI scorecards & performance reviews' },
  { id: 'training', label: 'Training & Development', group: 'TEAM MANAGEMENT', description: 'Employee skill programs, enrollments & completions' },
  { id: 'offer-letters', label: 'Offer & Appointment Letters', group: 'TEAM MANAGEMENT', description: 'Generate & print official Offer and Appointment letters' },
  { id: 'documents', label: 'Employee Documents', group: 'TEAM MANAGEMENT', description: 'Employee KYC, contracts, issue/expiry tracking & downloads' },
  { id: 'rewards-disciplinary', label: 'Rewards & Disciplinary Records', group: 'TEAM MANAGEMENT', description: 'Appreciations, bonuses, warnings & disciplinary log' },
  { id: 'employee-reports', label: 'Staff Reports & Analytics', group: 'TEAM MANAGEMENT', description: 'Monthly attendance, task productivity & Print/PDF/Excel reports' },
  // Preserved legacy/internal team aliases & chat/time-register
  { id: 'staff-attendance', label: 'Staff Attendance (Legacy)', group: 'TEAM MANAGEMENT', description: 'Attendance register & status' },
  { id: 'time-register', label: 'Time Management Register', group: 'TEAM MANAGEMENT', description: 'Working hours, overtime, shift rules & productivity log' },
  { id: 'gps-attendance', label: 'GPS Location Attendance (Legacy)', group: 'TEAM MANAGEMENT', description: 'GPS coordinates + selfie punch' },
  { id: 'staff-location-map', label: 'Staff Photo & Location Mapping (Legacy)', group: 'TEAM MANAGEMENT', description: 'GPS pins & Google Maps check' },
  { id: 'attendance-photo-gallery', label: 'Attendance Photo Gallery Verification', group: 'TEAM MANAGEMENT', description: 'Morning In & Evening Out photo verification, download, print & Admin delete' },
  { id: 'attendance-reports', label: 'Attendance Reports (Legacy)', group: 'TEAM MANAGEMENT', description: 'Monthly attendance & punctuality reports' },
  { id: 'chat', label: 'Team Chat & Messaging', group: 'TEAM MANAGEMENT', description: 'Internal counter team messaging' },

  // 3. CUSTOMER MANAGEMENT
  { id: 'customers', label: 'All Customers', group: 'CUSTOMER MANAGEMENT', description: 'Customer profiles, visits & search' },
  { id: 'customer-registration', label: 'Customer Registration', group: 'CUSTOMER MANAGEMENT', description: 'Onboard & register new customers' },
  { id: 'customer-profiles', label: 'Customer Profiles', group: 'CUSTOMER MANAGEMENT', description: '360° Customer profile, services, dues & timeline' },
  { id: 'customer-documents', label: 'Customer Documents', group: 'CUSTOMER MANAGEMENT', description: 'Customer KYC & submitted document vault' },
  { id: 'services', label: 'Customer Service History', group: 'CUSTOMER MANAGEMENT', description: 'Service bookings, receipts & tracking' },
  { id: 'followups', label: 'Customer Follow-ups', group: 'CUSTOMER MANAGEMENT', description: '90-day lifecycle callbacks & due reminders' },
  { id: 'grievances', label: 'Complaints & Support', group: 'CUSTOMER MANAGEMENT', description: 'Customer grievances, portal escalation & resolution' },
  { id: 'customer-feedback', label: 'Customer Feedback', group: 'CUSTOMER MANAGEMENT', description: 'Customer ratings, NPS & service feedback log' },
  { id: 'customer-dues', label: 'Customer Due Management', group: 'CUSTOMER MANAGEMENT', description: 'Outstanding receivable dues & quick collection' },
  { id: 'customer-reports', label: 'Customer Reports', group: 'CUSTOMER MANAGEMENT', description: 'Customer acquisition, retention & dues reports' },

  // 4. SALES & BILLING
  { id: 'sales-dashboard', label: 'Sales Dashboard', group: 'SALES & BILLING', description: 'Sales performance, collections & aging overview' },
  { id: 'new-invoice', label: 'New Invoice', group: 'SALES & BILLING', description: 'Create new tax or counter invoice' },
  { id: 'invoices', label: 'All Invoices', group: 'SALES & BILLING', description: 'Official bills and printable invoices' },
  { id: 'quotations', label: 'Quotation Management', group: 'SALES & BILLING', description: 'Create, track & convert quotations to invoices' },
  { id: 'estimates', label: 'Estimates', group: 'SALES & BILLING', description: 'Service & hardware cost estimates' },
  { id: 'payments', label: 'Payment Collection', group: 'SALES & BILLING', description: 'Customer payments and pending dues' },
  { id: 'sales-returns', label: 'Sales Returns', group: 'SALES & BILLING', description: 'Handle sales returns & stock reversal' },
  { id: 'credit-notes', label: 'Credit Notes', group: 'SALES & BILLING', description: 'Issue customer credit notes & adjustments' },
  { id: 'gst-billing', label: 'GST Billing', group: 'SALES & BILLING', description: 'GST tax invoices, HSN/SAC & CGST/SGST summary' },
  { id: 'customer-ledger', label: 'Customer Ledger', group: 'SALES & BILLING', description: 'Account statement per customer' },
  { id: 'sales-reports', label: 'Sales Reports', group: 'SALES & BILLING', description: 'Sales register, collections & GST sales reports' },

  // 5. INVENTORY & PURCHASE
  { id: 'inventory-dashboard', label: 'Inventory Dashboard', group: 'INVENTORY & PURCHASE', description: 'Stock valuation, fast-movers & reorder health' },
  { id: 'product-categories', label: 'Product Categories', group: 'INVENTORY & PURCHASE', description: 'Manage product & inventory categories' },
  { id: 'inventory', label: 'Stock Management', group: 'INVENTORY & PURCHASE', description: 'Stock levels and hardware items' },
  { id: 'stock-adjustment', label: 'Stock Adjustment', group: 'INVENTORY & PURCHASE', description: 'Damage, shrinkage & physical count adjustments' },
  { id: 'purchase-orders', label: 'Purchase Orders', group: 'INVENTORY & PURCHASE', description: 'Create & track supplier purchase orders' },
  { id: 'suppliers', label: 'Supplier Management', group: 'INVENTORY & PURCHASE', description: 'Vendor directory & payable contacts' },
  { id: 'purchase-bills', label: 'Purchase Bills', group: 'INVENTORY & PURCHASE', description: 'Supplier purchase bills & inward stock' },
  { id: 'stock-transfers', label: 'Stock Transfers', group: 'INVENTORY & PURCHASE', description: 'Inter-counter / warehouse stock transfers' },
  { id: 'low-stock-alerts', label: 'Low Stock Alerts', group: 'INVENTORY & PURCHASE', description: 'Critical reorder threshold monitor' },
  { id: 'barcode-management', label: 'Barcode Management', group: 'INVENTORY & PURCHASE', description: 'SKU codes & printable barcode labels' },
  { id: 'inventory-reports', label: 'Inventory Reports', group: 'INVENTORY & PURCHASE', description: 'Stock valuation, movement & reorder reports' },

  // 6. FINANCE & ACCOUNTING
  { id: 'finance-dashboard', label: 'Finance Dashboard', group: 'FINANCE & ACCOUNTING', description: 'Cash, bank, receivables, payables & profit overview' },
  { id: 'counter-daybook', label: 'Cash Book', group: 'FINANCE & ACCOUNTING', description: 'Daily cash book & counter ledger' },
  { id: 'daily-opening-cash', label: 'Daily Opening Cash', group: 'FINANCE & ACCOUNTING', description: 'Morning opening float & balance carry-forward' },
  { id: 'daily-closing-cash', label: 'Daily Closing Cash', group: 'FINANCE & ACCOUNTING', description: 'Evening physical cash count & lock' },
  { id: 'cash-reports', label: 'Cash Reports', group: 'FINANCE & ACCOUNTING', description: 'Date-range cash flow reports' },
  { id: 'bank-accounts', label: 'Bank Accounts', group: 'FINANCE & ACCOUNTING', description: 'Business bank accounts & settlement balances' },
  { id: 'daily-transactions', label: 'Daily Transactions', group: 'FINANCE & ACCOUNTING', description: 'Unified daily inflow/outflow ledger stream' },
  { id: 'income', label: 'Income Management', group: 'FINANCE & ACCOUNTING', description: 'Revenue, margin & profit analytics' },
  { id: 'expenses', label: 'Expense Management', group: 'FINANCE & ACCOUNTING', description: 'Expense entries & approval requests' },
  { id: 'accounts-payable', label: 'Accounts Payable', group: 'FINANCE & ACCOUNTING', description: 'Supplier bills, unpaid expenses & salary dues' },
  { id: 'accounts-receivable', label: 'Accounts Receivable', group: 'FINANCE & ACCOUNTING', description: 'Customer invoices & service dues receivable' },
  { id: 'general-ledger', label: 'General Ledger', group: 'FINANCE & ACCOUNTING', description: 'Chart of accounts & debit/credit summary' },
  { id: 'journal-entries', label: 'Journal Entries', group: 'FINANCE & ACCOUNTING', description: 'Double-entry manual accounting journals' },
  { id: 'bank-reconciliation', label: 'Bank Reconciliation', group: 'FINANCE & ACCOUNTING', description: 'Match bank statements with ERP ledger entries' },
  { id: 'gst-management', label: 'GST Management', group: 'FINANCE & ACCOUNTING', description: 'Output GST vs Input GST reconciliation' },
  { id: 'financial-reports', label: 'Financial Reports', group: 'FINANCE & ACCOUNTING', description: 'Comprehensive financial statements & cash reports' },
  { id: 'profit-loss', label: 'Profit & Loss', group: 'FINANCE & ACCOUNTING', description: 'Live Income Statement (Revenue vs Cost & Expenses)' },
  { id: 'balance-sheet', label: 'Balance Sheet', group: 'FINANCE & ACCOUNTING', description: 'Assets, Liabilities & Capital Snapshot' },

  // 7. LPG & GAS SERVICES
  { id: 'gas-dashboard', label: 'LPG Dashboard', group: 'LPG & GAS SERVICES', description: 'LPG & Gas operational summary, alerts & KPIs' },
  { id: 'gas-new-booking', label: 'New Gas Booking', group: 'LPG & GAS SERVICES', description: 'Quick refill & new connection booking' },
  { id: 'gas-customers', label: 'Customer Registration', group: 'LPG & GAS SERVICES', description: 'LPG consumer profiles, Consumer IDs & service history' },
  { id: 'gas-bookings', label: 'Booking Management', group: 'LPG & GAS SERVICES', description: 'Refill & new booking history and register' },
  { id: 'gas-delivery-management', label: 'Delivery Management', group: 'LPG & GAS SERVICES', description: 'Assign delivery staff & complete deliveries' },
  { id: 'gas-eligibility', label: 'Delivery Tracking', group: 'LPG & GAS SERVICES', description: 'Booking interval, tracking & dispatch queue' },
  { id: 'gas-collections', label: 'Cash Collection', group: 'LPG & GAS SERVICES', description: 'Gas receipts, partial payments & Admin reversals' },
  { id: 'gas-accessories', label: 'Cylinder Inventory', group: 'LPG & GAS SERVICES', description: 'Cylinders, regulators, pipes, stoves & retail' },
  { id: 'gas-subsidy', label: 'Agency Transactions', group: 'LPG & GAS SERVICES', description: 'DBT subsidy & agency transaction reconciliation' },
  { id: 'gas-complaints', label: 'Customer Complaints', group: 'LPG & GAS SERVICES', description: 'LPG leakage, delay & replacement complaints' },
  { id: 'gas-reports', label: 'LPG Reports', group: 'LPG & GAS SERVICES', description: '19 standardized Print, PDF, Excel & CSV gas reports' },
  // Preserved extra LPG routes
  { id: 'gas-non-taker', label: 'Non-Taker Subsidy Due Ledger', group: 'LPG & GAS SERVICES', description: 'Authorized advance ledger & recovery tracking' },
  { id: 'gas-storage', label: 'Hardware & Storage', group: 'LPG & GAS SERVICES', description: 'Warehouses, racks, stock movements & damaged stock' },
  { id: 'gas-suppliers', label: 'Supplier & Purchase', group: 'LPG & GAS SERVICES', description: 'LPG hardware suppliers & purchase inward stock' },
  { id: 'gas-service-replacement', label: 'Customer Service & Replacement Entry', group: 'LPG & GAS SERVICES', description: 'Regulator/pipe replacement service & automatic stock deduction' },
  { id: 'gas-settings', label: 'Gas Settings', group: 'LPG & GAS SERVICES', description: 'Gas rules, interval presets, charges & Admin overrides' },

  // 8. OPERATIONS MANAGEMENT
  { id: 'operations-dashboard', label: 'Operations Dashboard', group: 'OPERATIONS MANAGEMENT', description: 'Counter service queue, tasks & delivery command view' },
  { id: 'daily-task-manager', label: 'Daily Task Manager', group: 'OPERATIONS MANAGEMENT', description: 'Daily counter checklist & operational task tracker' },
  { id: 'service-requests', label: 'Service Request Management', group: 'OPERATIONS MANAGEMENT', description: 'Active customer service requests queue' },
  { id: 'service-delivery-tracking', label: 'Service Delivery Tracking', group: 'OPERATIONS MANAGEMENT', description: 'SLA & service completion milestone tracker' },
  { id: 'document-processing', label: 'Document Processing', group: 'OPERATIONS MANAGEMENT', description: 'KYC & certificate document processing queue' },
  { id: 'applications', label: 'Application Management', group: 'OPERATIONS MANAGEMENT', description: 'Service application tracking & status' },
  { id: 'services', label: 'Services & Tracking', group: 'OPERATIONS MANAGEMENT', description: 'Counter services, receipts & delivery tracking' },
  { id: 'operational-reports', label: 'Operational Reports', group: 'OPERATIONS MANAGEMENT', description: 'Combined counter service & operational productivity reports' },

  // 9. GROWTH & MARKETING
  { id: 'growth-dashboard', label: 'Business Growth Dashboard', group: 'GROWTH & MARKETING', description: 'Targets, leads, referrals & marketing summary' },
  { id: 'growth-plan', label: 'Business Growth Plan', group: 'GROWTH & MARKETING', description: 'Quarterly expansion roadmap & milestones' },
  { id: 'targets', label: 'Revenue Targets', group: 'GROWTH & MARKETING', description: 'Monthly revenue goals & progress' },
  { id: 'profit-targets', label: 'Monthly Profit Targets', group: 'GROWTH & MARKETING', description: 'Net profit goals vs realized margin' },
  { id: 'marketing', label: 'Marketing Campaigns', group: 'GROWTH & MARKETING', description: 'Customer outreach & promotional campaigns' },
  { id: 'promotions-offers', label: 'Promotions & Offers', group: 'GROWTH & MARKETING', description: 'Seasonal discounts & service combo offers' },
  { id: 'customer-acquisition', label: 'Customer Acquisition', group: 'GROWTH & MARKETING', description: 'Monthly customer acquisition & retention metrics' },
  { id: 'referral-management', label: 'Referral Management', group: 'GROWTH & MARKETING', description: 'Customer referral tracking & reward ledger' },
  { id: 'lead-management', label: 'Lead Management', group: 'GROWTH & MARKETING', description: 'Prospect pipeline & conversion tracker' },
  { id: 'whatsapp-connect', label: 'Follow-up Campaigns', group: 'GROWTH & MARKETING', description: 'Manual pre-filled +91 WhatsApp dispatch & campaigns' },
  { id: 'projects', label: 'Business Development', group: 'GROWTH & MARKETING', description: 'Expansion projects & new service initiatives' },
  { id: 'investments', label: 'Capital & Investments', group: 'GROWTH & MARKETING', description: 'Capital & asset ledger' },
  { id: 'competitors', label: 'Competitor Analysis', group: 'GROWTH & MARKETING', description: 'Market benchmarking & pricing comparison' },
  { id: 'growth-reports', label: 'Growth Reports', group: 'GROWTH & MARKETING', description: 'Targets, campaign ROI & lead conversion reports' },

  // 10. REPORTS & ANALYTICS
  { id: 'reports', label: 'Business Performance', group: 'REPORTS & ANALYTICS', description: 'Overall business performance analytics' },
  { id: 'daily-reports', label: 'Daily Reports', group: 'REPORTS & ANALYTICS', description: 'Daily consolidated counter & service MIS' },
  { id: 'monthly-reports', label: 'Monthly Reports', group: 'REPORTS & ANALYTICS', description: 'Monthly consolidated financial & operational MIS' },
  { id: 'employee-performance-analytics', label: 'Employee Performance', group: 'REPORTS & ANALYTICS', description: 'Cross-staff KPI, attendance & task comparison' },
  { id: 'sales-analytics', label: 'Sales Analytics', group: 'REPORTS & ANALYTICS', description: 'Revenue breakdown & invoice payment mix' },
  { id: 'purchase-analytics', label: 'Purchase Analytics', group: 'REPORTS & ANALYTICS', description: 'Supplier spend & purchase order insights' },
  { id: 'inventory-analytics', label: 'Inventory Analytics', group: 'REPORTS & ANALYTICS', description: 'Stock turnover & reorder value insights' },
  { id: 'financial-analytics', label: 'Financial Analytics', group: 'REPORTS & ANALYTICS', description: 'Cashflow, profit margin & expense ratios' },
  { id: 'customer-analytics', label: 'Customer Analytics', group: 'REPORTS & ANALYTICS', description: 'Top customers, area spread & repeat visits' },
  { id: 'department-reports', label: 'Department-wise Reports', group: 'REPORTS & ANALYTICS', description: 'Performance scorecard by ERP department' },
  { id: 'custom-report-builder', label: 'Custom Report Builder', group: 'REPORTS & ANALYTICS', description: 'Dynamic multi-module query & export builder' },
  { id: 'pdf-excel-export', label: 'PDF & Excel Export', group: 'REPORTS & ANALYTICS', description: 'Centralized A4 Print, PDF, Excel & CSV exporter' },

  // 11. SYSTEM & SECURITY
  { id: 'login-history', label: 'Login History', group: 'SYSTEM & SECURITY', description: 'Authentication sign-in & failed login records' },
  { id: 'audit-logs', label: 'Audit Logs', group: 'SYSTEM & SECURITY', description: 'Immutable system & financial audit trail' },
  { id: 'activity-logs', label: 'Activity Logs', group: 'SYSTEM & SECURITY', description: 'Chronological user activity & delete history' },
  { id: 'notification-settings', label: 'Notification Settings', group: 'SYSTEM & SECURITY', description: 'Configure alert thresholds & badge rules' },
  { id: 'settings', label: 'Backup & Restore', group: 'SYSTEM & SECURITY', description: 'System settings, auto-snapshots & backups' },
  { id: 'database-management', label: 'Database Management', group: 'SYSTEM & SECURITY', description: 'Relational SQLite stats, health & integrity' },
  { id: 'admin-settings', label: 'System Configuration', group: 'SYSTEM & SECURITY', description: 'Manage all dropdowns, services, statuses & defaults (Admin-Only)' },
  { id: 'business', label: 'Company Profile', group: 'SYSTEM & SECURITY', description: 'Shop profile, official letterhead & corporate identity' },
  { id: 'locations-master', label: 'Branch Management', group: 'SYSTEM & SECURITY', description: 'Locations, Domkal Wards & counter branches' },
  { id: 'data-import-export', label: 'Data Import & Export', group: 'SYSTEM & SECURITY', description: 'Bulk data CSV/Excel/JSON import and export' },
  { id: 'security-settings', label: 'Security Settings', group: 'SYSTEM & SECURITY', description: 'Session timeout, MFA, password policy & recovery settings' },
  { id: 'rate-chart', label: 'Service Rate Chart', group: 'SYSTEM & SECURITY', description: 'Official service rate chart, shop charges & govt fee catalog' },
  { id: 'menu-management', label: 'Menu Management', group: 'SYSTEM & SECURITY', description: 'Customize department names, submenu labels, order, icons & visibility (Admin-Only)' },

  // ADMINISTRATION (EXACTLY 2 SUBMENUS: MANAGER & STAFF)
  { id: 'admin-managers', label: 'MANAGER', group: 'ADMINISTRATION', description: 'Create, edit, activate, deactivate & manage Manager accounts (Administration Only)' },
  { id: 'admin-staff', label: 'STAFF', group: 'ADMINISTRATION', description: 'Create, edit, activate, deactivate & manage Staff accounts' }
];

function makeSet(overrides: Partial<MenuPermissionSet> = {}): MenuPermissionSet {
  return {
    view: false,
    add: false,
    edit: false,
    delete: false,
    approve: false,
    export: false,
    print: false,
    ...overrides
  };
}

function allTrueSet(): MenuPermissionSet {
  return {
    view: true,
    add: true,
    edit: true,
    delete: true,
    approve: true,
    export: true,
    print: true
  };
}

export function getDefaultRolePermissions(roleInput?: string): EffectivePermissions {
  const role = String(roleInput || 'STAFF').trim().toUpperCase();
  const menus: Record<string, MenuPermissionSet> = {};

  if (role === 'ADMIN') {
    for (const def of MENU_DEFINITIONS) {
      menus[def.id] = allTrueSet();
    }
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
    for (const def of MENU_DEFINITIONS) {
      menus[def.id] = makeSet();
    }
    const managerBusinessFull = [
      // Dashboard
      'dashboard', 'business-overview', 'todays-summary', 'pending-activities', 'quick-actions', 'universal-search',
      // Team Management (Supervision, Leave/Attendance Approval, Tasks, Performance)
      'staff-directory', 'recruitment', 'employee-profile', 'attendance-tracking', 'leave-management',
      'salary-payroll', 'payslips', 'tasks', 'kpi-performance', 'training', 'offer-letters', 'documents',
      'rewards-disciplinary', 'employee-reports', 'staff-attendance', 'time-register', 'gps-attendance',
      'staff-location-map', 'attendance-reports', 'chat',
      // Customer Management
      'customers', 'customer-registration', 'customer-profiles', 'customer-documents', 'services',
      'followups', 'grievances', 'customer-feedback', 'customer-dues', 'customer-reports',
      // Sales & Billing
      'sales-dashboard', 'new-invoice', 'invoices', 'quotations', 'estimates', 'payments',
      'sales-returns', 'credit-notes', 'gst-billing', 'customer-ledger', 'sales-reports',
      // Inventory & Purchase
      'inventory-dashboard', 'rate-chart', 'product-categories', 'inventory', 'stock-adjustment',
      'purchase-orders', 'suppliers', 'purchase-bills', 'stock-transfers', 'low-stock-alerts',
      'barcode-management', 'inventory-reports',
      // Finance (Operational cash & receivables/payables)
      'finance-dashboard', 'counter-daybook', 'daily-opening-cash', 'daily-closing-cash', 'cash-reports',
      'bank-accounts', 'daily-transactions', 'accounts-payable', 'accounts-receivable',
      // LPG & Gas Services
      'gas-dashboard', 'gas-new-booking', 'gas-customers', 'gas-bookings', 'gas-delivery-management',
      'gas-eligibility', 'gas-subsidy', 'gas-non-taker', 'gas-collections', 'gas-accessories',
      'gas-storage', 'gas-suppliers', 'gas-service-replacement', 'gas-complaints', 'gas-reports',
      // Services (Annapurna Yojana System & Banglar Yuva Siksha Barasa Card)
      'govt-annapurna', 'annapurna-applications', 'annapurna-complaints', 'annapurna-timeline', 'annapurna-reports', 'yuva-siksha-barasa',
      // Operations
      'operations-dashboard', 'daily-task-manager', 'service-requests', 'service-delivery-tracking',
      'document-processing', 'applications', 'operational-reports',
      // Growth
      'growth-dashboard', 'growth-plan', 'targets', 'profit-targets', 'promotions-offers',
      'customer-acquisition', 'referral-management', 'lead-management', 'whatsapp-connect', 'growth-reports',
      // Reports
      'reports', 'daily-reports', 'monthly-reports', 'employee-performance-analytics',
      'sales-analytics', 'purchase-analytics', 'inventory-analytics', 'financial-analytics',
      'customer-analytics', 'department-reports', 'custom-report-builder', 'pdf-excel-export',
      // System (Locations only)
      'locations-master'
    ];
    for (const id of managerBusinessFull) {
      menus[id] = makeSet({
        view: true,
        add: true,
        edit: true,
        delete: false,
        approve: true,
        export: true,
        print: true
      });
    }
    // Manager manages Staff accounts ONLY under ADMINISTRATION -> STAFF
    menus['admin-managers'] = makeSet();
    menus['admin-staff'] = makeSet({ view: true, add: true, edit: true, delete: false, approve: false, export: true, print: true });
    // Manager expense: can enter & request approval, Admin approves by default
    menus['expenses'] = makeSet({ view: true, add: true, edit: true, delete: false, approve: false, export: true, print: true });
    // Read-only financial analytics for manager
    for (const finView of ['income', 'general-ledger', 'journal-entries', 'bank-reconciliation', 'gst-management', 'financial-reports', 'profit-loss', 'balance-sheet']) {
      menus[finView] = makeSet({ view: true, add: false, edit: false, delete: false, approve: false, export: true, print: true });
    }
    // Attendance Photo Gallery: Manager sees own by default; Admin permission enables verifying all staff photos; NEVER delete
    menus['attendance-photo-gallery'] = makeSet({ view: true, add: false, edit: false, delete: false, approve: false, export: true, print: true });
    menus['projects'] = makeSet({ view: true, add: true, edit: true, print: true });

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

  // STAFF / EMPLOYEE / MAKER / CHECKER default work-access template
  for (const def of MENU_DEFINITIONS) {
    menus[def.id] = makeSet();
  }

  // Personal Dashboard
  menus['dashboard'] = makeSet({ view: true });
  menus['business-overview'] = makeSet({ view: true });
  menus['todays-summary'] = makeSet({ view: true });
  menus['pending-activities'] = makeSet({ view: true });
  menus['quick-actions'] = makeSet({ view: true });
  menus['universal-search'] = makeSet({ view: true });

  // Employee Self-Service HR Modules (Own profile, Own attendance, Leave application, Own payslips, Assigned tasks, Own performance, Training, Personal documents)
  menus['employee-profile'] = makeSet({ view: true, print: true });
  menus['attendance-tracking'] = makeSet({ view: true, add: true, print: true });
  menus['staff-attendance'] = makeSet({ view: true, add: true });
  menus['time-register'] = makeSet({ view: true, add: true });
  menus['gps-attendance'] = makeSet({ view: true, add: true });
  menus['staff-location-map'] = makeSet({ view: true });
  menus['attendance-photo-gallery'] = makeSet({ view: true, print: true });
  menus['leave-management'] = makeSet({ view: true, add: true }); // Can apply leave; CANNOT approve
  menus['payslips'] = makeSet({ view: true, print: true }); // Own payslips only
  menus['tasks'] = makeSet({ view: true, edit: true }); // Assigned tasks only
  menus['kpi-performance'] = makeSet({ view: true }); // Own performance only
  menus['training'] = makeSet({ view: true, add: true });
  menus['documents'] = makeSet({ view: true, add: true, print: true }); // Personal documents only
  menus['employee-reports'] = makeSet({ view: true, print: true });
  menus['attendance-reports'] = makeSet({ view: true, print: true });
  menus['chat'] = makeSet({ view: true, add: true, edit: true, delete: true });

  // Customer & Counter Operations
  menus['customers'] = makeSet({ view: true, add: true, edit: true, print: true });
  menus['customer-registration'] = makeSet({ view: true, add: true });
  menus['customer-profiles'] = makeSet({ view: true, print: true });
  menus['customer-documents'] = makeSet({ view: true, add: true, print: true });
  menus['services'] = makeSet({ view: true, add: true, edit: false, print: true });
  menus['followups'] = makeSet({ view: true, add: true, edit: true });
  menus['grievances'] = makeSet({ view: true, add: true, edit: true });
  menus['customer-feedback'] = makeSet({ view: true, add: true });
  menus['customer-dues'] = makeSet({ view: true, print: true });
  menus['rate-chart'] = makeSet({ view: true, print: true }); // Strict view-only for Staff
  menus['whatsapp-connect'] = makeSet({ view: true, add: true });
  menus['new-invoice'] = makeSet({ view: true, add: true, print: true });
  menus['invoices'] = makeSet({ view: true, add: true, print: true });
  menus['quotations'] = makeSet({ view: true, add: true, print: true });
  menus['estimates'] = makeSet({ view: true, add: true, print: true });
  menus['payments'] = makeSet({ view: true, add: true, print: true });
  menus['expenses'] = makeSet({ view: true, add: true });

  // Operations Desk
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

  // LPG & Gas Counter Operations
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

  const normalizedStaffRole = role === 'MAKER' || role === 'CHECKER' || !role ? 'STAFF' : role;
  return {
    role: normalizedStaffRole,
    isMainAdmin: false,
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

export function resolveEffectivePermissions(user: {
  uid?: string;
  userId?: string;
  role?: string;
  isMainAdmin?: boolean;
  isSuperAdmin?: boolean;
  status?: string;
  permissionOverrides?: Record<string, Partial<MenuPermissionSet>>;
  extraPermissions?: Partial<ExtraPermissionControls>;
} | null | undefined): EffectivePermissions {
  if (!user) {
    const empty = getDefaultRolePermissions('STAFF');
    for (const key of Object.keys(empty.menus)) {
      empty.menus[key] = makeSet();
    }
    empty.extra.accountActive = false;
    return empty;
  }

  const resolvedUid = String(user.uid || user.userId || '').trim().toUpperCase();
  const isMainAdmin = Boolean(user.isMainAdmin || user.isSuperAdmin || resolvedUid === MAIN_ADMIN_UID);
  const rawRole = String(user.role || 'STAFF').trim().toUpperCase();
  const role = rawRole === 'ADMIN' || rawRole === 'MANAGER' ? rawRole : 'STAFF';
  const base = getDefaultRolePermissions(isMainAdmin ? 'ADMIN' : role);
  base.isMainAdmin = isMainAdmin;
  base.isSuperAdmin = isMainAdmin;

  if (isMainAdmin) {
    return base;
  }

  const overrides = user.permissionOverrides || {};
  for (const def of MENU_DEFINITIONS) {
    const ov = overrides[def.id];
    if (ov && typeof ov === 'object') {
      const target = base.menus[def.id];
      for (const act of PERMISSION_ACTIONS) {
        if (typeof ov[act] === 'boolean') {
          target[act] = ov[act] as boolean;
        }
      }
    }
  }

  const extOv = user.extraPermissions || {};
  if (typeof extOv.cashOperationLimit === 'number' && Number.isFinite(extOv.cashOperationLimit)) {
    base.extra.cashOperationLimit = Math.max(0, extOv.cashOperationLimit);
  }
  if (extOv.customerAccessScope === 'ALL' || extOv.customerAccessScope === 'ASSIGNED') {
    base.extra.customerAccessScope = extOv.customerAccessScope;
  }
  if (typeof extOv.customerAccessLimit === 'number' && Number.isFinite(extOv.customerAccessLimit)) {
    base.extra.customerAccessLimit = Math.max(0, extOv.customerAccessLimit);
  }
  if (typeof extOv.canApproveTransactions === 'boolean') {
    base.extra.canApproveTransactions = extOv.canApproveTransactions;
  }
  if (typeof extOv.canViewAllAttendancePhotos === 'boolean') {
    base.extra.canViewAllAttendancePhotos = extOv.canViewAllAttendancePhotos;
  }
  if (typeof extOv.canManageBackupSettings === 'boolean') {
    base.extra.canManageBackupSettings = extOv.canManageBackupSettings;
  }
  if (typeof extOv.canManageUserPermissions === 'boolean') {
    base.extra.canManageUserPermissions = extOv.canManageUserPermissions;
  }

  base.extra.accountActive = user.status === 'ACTIVE';

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

export function hasMenuPermission(
  user: any,
  menuId: string,
  action: PermissionAction = 'view'
): boolean {
  const eff = resolveEffectivePermissions(user);
  if (eff.isMainAdmin || eff.isSuperAdmin) return true;
  if (!eff.extra.accountActive) return false;
  const set = eff.menus[menuId];
  if (!set) return false;
  return Boolean(set[action]);
}
