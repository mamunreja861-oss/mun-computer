import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { murshidabadMaster } from './murshidabadMaster.js';
import { globalReferenceEngine, resolveCanonicalPrefix } from './globalReferenceEngine.js';
import { getDataDir, getSourceDataDir, isVercelRuntime } from './dataDir.js';

const DATA_DIR = getDataDir();
const ERP_DB_FILE = path.join(DATA_DIR, 'erp-db.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'audit-logs.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const ATTENDANCE_PHOTOS_DIR = path.join(DATA_DIR, 'attendance-photos');
const AUTO_BACKUPS_DIR = path.join(DATA_DIR, 'auto-backups');

export const MAIN_ADMIN_UID = 'MC-ADM-14012025';
export const SUPER_ADMIN_UID = MAIN_ADMIN_UID;
export const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || '8101352105';
export const DEFAULT_TEMP_PASSWORD = 'MUNC2026';

export type AppRole = 'ADMIN' | 'MANAGER' | 'MAKER' | 'CHECKER' | 'STAFF';
export type AccountStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'CORRECTION_REQUIRED' | 'SUSPENDED';
export type ApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED';

export interface CounterState {
  year: number;
  MUNCM: number;
  MUNCS: number;
  UID_SLNO: number;
  REQ: number;
  APP: number;
  SRV: number;
  CUST: number;
  DOC: number;
  LOC: number;
  AUD: number;
  DEL?: number;
  BKP?: number;
}

export interface GlobalYearSerialState {
  year: number;
  year2: string;
  lastSerial: number;
  updatedAt: string;
}

export const MONTH_ABBR_UPPER = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

export function getKolkataDateParts(date = new Date()): {
  year: number;
  yearStr: string;
  monthStr: string;
  monthAbbr: string;
  year2: string;
  dayStr: string;
  isoDate: string;
  appDatePrefix: string;
} {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date); // YYYY-MM-DD
  const [yearStr, monthStr, dayStr] = formatted.split('-');
  const monthIdx = Math.max(0, Math.min(11, parseInt(monthStr, 10) - 1));
  const monthAbbr = MONTH_ABBR_UPPER[monthIdx] || 'JAN';
  const year2 = yearStr.slice(-2);
  return {
    year: parseInt(yearStr, 10),
    yearStr,
    monthStr,
    monthAbbr,
    year2,
    dayStr,
    isoDate: formatted,
    appDatePrefix: `${dayStr}${monthAbbr}${year2}`
  };
}

export function formatApplicationIdDatePrefix(dateInput?: Date | string): {
  datePrefix: string;
  year: number;
  year2: string;
} {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput.trim())) {
    const clean = dateInput.trim().slice(0, 10);
    const [yStr, mStr, dStr] = clean.split('-');
    const mIdx = Math.max(0, Math.min(11, parseInt(mStr, 10) - 1));
    const year2 = yStr.slice(-2).padStart(2, '0');
    return {
      datePrefix: `${dStr.padStart(2, '0')}${MONTH_ABBR_UPPER[mIdx] || 'JAN'}${year2}`,
      year: parseInt(yStr, 10) || getKolkataDateParts().year,
      year2
    };
  }
  const dt = dateInput instanceof Date && !isNaN(dateInput.getTime()) ? dateInput : new Date();
  const parts = getKolkataDateParts(dt);
  return { datePrefix: parts.appDatePrefix, year: parts.year, year2: parts.year2 };
}

export function parseApplicationSerialId(rawId?: string): {
  day: string;
  month: string;
  year2: string;
  seq: number;
} | null {
  const s = String(rawId || '').trim().toUpperCase();
  const m = s.match(/^(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})(\d{4,})$/);
  if (!m) return null;
  const seq = parseInt(m[4], 10);
  if (!Number.isFinite(seq) || seq <= 0) return null;
  return { day: m[1], month: m[2], year2: m[3], seq };
}

export function getRoleCode(role: string): 'AD' | 'MN' | 'ST' {
  const r = String(role || 'STAFF').trim().toUpperCase();
  if (r === 'ADMIN') return 'AD';
  if (r === 'MANAGER') return 'MN';
  return 'ST';
}

export function getIdFormatPreview(role: string) {
  const { yearStr, dayStr, isoDate } = getKolkataDateParts();
  const r = String(role || 'STAFF').trim().toUpperCase();
  const prefix = r === 'ADMIN' ? 'ADMIN' : r === 'MANAGER' ? 'MGR' : 'STF';
  const status = prefix === 'ADMIN' ? null : globalReferenceEngine.getCounterStatus(prefix);
  return {
    prefix: status ? status.organization_code : 'MUN',
    roleCode: getRoleCode(role),
    year: yearStr,
    day: dayStr,
    placeholderSerial: status ? status.next_global_sl : '00000001',
    formatPreview: prefix === 'ADMIN' ? MAIN_ADMIN_UID : status!.preview_reference_no,
    timezone: 'Asia/Kolkata',
    dateStr: isoDate
  };
}

export function generateSecureTempPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%&*!?';
  const all = upper + lower + digits + symbols;
  const chars: string[] = [
    upper[crypto.randomInt(0, upper.length)],
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    digits[crypto.randomInt(0, digits.length)],
    symbols[crypto.randomInt(0, symbols.length)],
    symbols[crypto.randomInt(0, symbols.length)]
  ];
  while (chars.length < length) {
    chars.push(all[crypto.randomInt(0, all.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

export function validatePasswordStrength(
  password: string,
  context?: { uid?: string; name?: string; phone?: string; dob?: string; aadhaarClean?: string }
): { valid: boolean; reason?: string } {
  const pwd = String(password || '');
  if (pwd.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long.' };
  }
  if (pwd.length > 128) {
    return { valid: false, reason: 'Password must not exceed 128 characters.' };
  }
  if (!/[A-Z]/.test(pwd)) {
    return { valid: false, reason: 'Password must include at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(pwd)) {
    return { valid: false, reason: 'Password must include at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(pwd)) {
    return { valid: false, reason: 'Password must include at least one number (0-9).' };
  }
  if (!/[^A-Za-z0-9]/.test(pwd)) {
    return { valid: false, reason: 'Password must include at least one special character (e.g. @#$%&*!).' };
  }
  const lowerPwd = pwd.toLowerCase();
  const compactPwd = lowerPwd.replace(/[^a-z0-9]/g, '');
  if (context?.uid) {
    const cleanUid = context.uid.toLowerCase();
    const compactUid = cleanUid.replace(/[^a-z0-9]/g, '');
    if (lowerPwd.includes(cleanUid) || (compactUid.length >= 6 && compactPwd.includes(compactUid))) {
      return { valid: false, reason: 'Password cannot contain your User ID.' };
    }
  }
  if (context?.phone) {
    const p10 = context.phone.replace(/[^0-9]/g, '').slice(-10);
    if (p10.length === 10 && (pwd.includes(p10) || pwd.includes(p10.slice(-6)))) {
      return { valid: false, reason: 'Password cannot contain your registered mobile number.' };
    }
  }
  if (context?.aadhaarClean) {
    const a12 = context.aadhaarClean.replace(/[^0-9]/g, '');
    if (a12.length === 12 && (pwd.includes(a12) || pwd.includes(a12.slice(-4)))) {
      return { valid: false, reason: 'Password cannot contain your Aadhaar number or digits.' };
    }
  }
  if (context?.dob) {
    const dobDigits = context.dob.replace(/[^0-9]/g, '');
    if (dobDigits.length >= 6) {
      const yyyy = dobDigits.slice(0, 4);
      const mmdd = dobDigits.slice(4, 8);
      const ddmmyyyy = dobDigits.length === 8 ? `${dobDigits.slice(6, 8)}${dobDigits.slice(4, 6)}${yyyy}` : '';
      if (pwd.includes(dobDigits) || (ddmmyyyy && pwd.includes(ddmmyyyy)) || (mmdd.length === 4 && pwd.includes(`${mmdd}${yyyy}`))) {
        return { valid: false, reason: 'Password cannot contain your Date of Birth.' };
      }
    }
  }
  if (context?.name) {
    const nameTokens = context.name
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length >= 3);
    if (nameTokens.some(tok => lowerPwd.includes(tok))) {
      return { valid: false, reason: 'Password cannot contain your personal name.' };
    }
  }
  const blockedCommon = new Set([
    'munc2026', 'password', 'password1', 'password123', 'pass@123', 'admin@123',
    'admin123', '12345678', '123456789', 'qwerty123', 'qwerty@123', 'welcome@123',
    'letmein@1', 'muncomputer', 'mun@2026', 'mc-adm-14012025'
  ]);
  if (blockedCommon.has(lowerPwd)) {
    return { valid: false, reason: 'Common or compromised passwords are not permitted.' };
  }
  return { valid: true };
}

export interface ServiceCatalogItem {
  id: string; // SRV-YYYY-000001
  code: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  govFee: number;
  serviceCharge: number;
  description: string;
  imageUrl?: string;
  position: number;
  isActive: boolean;
  isDeleted: boolean;
  year: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  auditHistory?: Array<{
    timestamp: string;
    actorUid: string;
    action: string;
    oldValue?: any;
    newValue?: any;
  }>;
}

export interface CustomerRecord {
  id: string; // CUST-YYYY-000001
  uid?: string;
  name: string;
  fatherName?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  aadhaarMasked?: string;
  aadhaarEncrypted?: string;
  aadhaarHash?: string;
  areaType: 'RURAL' | 'URBAN';
  state: string;
  district: string;
  subdivision?: string;
  blockOrMunicipality: string;
  gpOrWard: string;
  mouza?: string;
  villageOrLocality: string;
  postOffice: string;
  policeStation?: string;
  pinCode: string;
  address: string;
  category?: string;
  jobCardNo?: string;
  assignedStaffUid?: string;
  remarks?: string;
  year: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type ApplicationStatus =
  | 'New'
  | 'Pending'
  | 'Under Process'
  | 'Under Verification'
  | 'Hold Up'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled';

export interface ApplicationRecord {
  id: string; // APP-YYYY-000001
  refNumber: string;
  customerId: string;
  customerUid?: string;
  customerName: string;
  phone: string;
  serviceId: string;
  serviceName: string;
  category: string;
  subcategory: string;
  govFee: number;
  serviceCharge: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: ApplicationStatus;
  assignedStaffUid?: string;
  assignedStaffName?: string;
  verifiedByUid?: string;
  areaType?: 'RURAL' | 'URBAN';
  district?: string;
  blockOrMunicipality?: string;
  gpOrWard?: string;
  villageOrLocality?: string;
  pinCode?: string;
  notes?: string;
  timeline: Array<{
    timestamp: string;
    status: string;
    actorUid: string;
    note: string;
  }>;
  year: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface DocumentVaultRecord {
  id: string; // DOC-YYYY-000001
  title: string;
  category: string;
  customerId?: string;
  applicationId?: string;
  userId?: string;
  fileName: string;
  storedFileName: string;
  mimeType: string;
  sizeBytes: number;
  remarks?: string;
  expiryDate?: string;
  uploadedByUid: string;
  year: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  channel: 'general' | 'services' | 'customers' | 'urgent';
  senderUid: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  isEdited?: boolean;
}

export interface AttendancePhotoRecord {
  id: string;
  staffId: string; // Employee ID (permanent UID)
  staffName: string;
  staffRole: string;
  eventType: 'IN' | 'OUT';
  date: string; // YYYY-MM-DD (IST)
  time24: string;
  time12: string;
  istTimestamp: string;
  timestampIso: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  mapsUrl: string;
  storedFileName: string;
  mimeType: string;
  sizeBytes: number;
  consentAccepted: boolean;
  captureMethod?: 'LIVE_CAMERA';
  gpsVerifiedLive?: boolean;
  gpsMatchDistanceMeters?: number;
  photoCapturedAt?: string;
  gpsCapturedAt?: string;
  verifiedStatus?: 'PENDING' | 'VERIFIED' | 'FLAGGED';
  verifiedByUid?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  notes?: string;
  createdByUid: string;
  createdAt: string;
}

export interface AttendanceRecordServer {
  id: string;
  date: string;
  staffId: string;
  staffName: string;
  role: string;
  status: string;
  inTime24: string;
  outTime24: string;
  clockIn: string;
  clockOut: string;
  workingMinutes: number;
  workingHoursLabel: string;
  lateMinutes: number;
  lateEntry: boolean;
  lateLabel: string;
  earlyLeaveMinutes: number;
  earlyLeave: boolean;
  earlyLeaveLabel: string;
  overtimeMinutes: number;
  overtimeLabel: string;
  inGpsLat?: number | null;
  inGpsLng?: number | null;
  outGpsLat?: number | null;
  outGpsLng?: number | null;
  inPhotoId?: string;
  outPhotoId?: string;
  notes?: string;
  updatedByUid?: string;
  updatedAt: string;
}

export interface CounterCashTxnServer {
  id: string;
  date: string;
  time: string;
  type: 'CASH_RECEIVED' | 'CASH_PAYMENT' | 'CASH_DEPOSIT' | 'CASH_WITHDRAWAL';
  partyName: string;
  amount: number;
  reference: string;
  notes: string;
  actorUid: string;
  actorName: string;
  createdAt: string;
}

export interface CounterDaybookSnapshot {
  id: string;
  date: string;
  previousDayBalance: number;
  openingCash: number;
  openingSaved: boolean;
  openingDenominations?: Record<string, number>;
  openingNotes?: string;
  cashReceived: number;
  cashPayment: number;
  cashDeposit: number;
  cashWithdrawal: number;
  expectedClosing: number;
  countedPhysicalCash: number;
  closingCash: number;
  closingSaved: boolean;
  difference: number;
  status: string;
  denominations?: Record<string, number>;
  verifiedBy: string;
  verifiedByUid: string;
  notes?: string;
  updatedAt: string;
}

export interface DeleteHistoryRecord {
  id: string;
  targetType: 'ATTENDANCE_PHOTO' | 'ATTENDANCE_RECORD' | 'COUNTER_CASH_TXN' | 'USER_ACCOUNT' | 'SERVICE' | 'CUSTOMER' | 'INVOICE' | 'EXPENSE' | 'OTHER';
  targetId: string;
  targetSummary: string;
  reason: string;
  deletedByUid: string;
  deletedByName: string;
  deletedAt: string;
  metadata?: Record<string, any>;
}

export interface AutoBackupSnapshotMeta {
  id: string;
  fileName: string;
  createdAt: string;
  triggerType: 'AUTO' | 'MANUAL' | 'PRE_RESTORE';
  actorUid: string;
  sizeBytes: number;
  counts: {
    services: number;
    customers: number;
    applications: number;
    attendancePhotos: number;
    users: number;
  };
}

export interface CentralErpDatabase {
  countersByYear: Record<string, CounterState>;
  globalSerialByYear?: Record<string, GlobalYearSerialState>;
  services: ServiceCatalogItem[];
  customers: CustomerRecord[];
  applications: ApplicationRecord[];
  documents: DocumentVaultRecord[];
  recoveryCodes: Array<{
    codeHash: string;
    uid: string;
    createdBy: string;
    expiresAt: number;
    used: boolean;
  }>;
  chats?: ChatMessageRecord[];
  attendanceRecords?: AttendanceRecordServer[];
  attendancePhotos?: AttendancePhotoRecord[];
  counterCashTxns?: CounterCashTxnServer[];
  counterDaybook?: CounterDaybookSnapshot[];
  deleteHistory?: DeleteHistoryRecord[];
  backupSnapshots?: AutoBackupSnapshotMeta[];
  followupCases?: any[];
  adminOptions?: AdminOptionRecord[];
  followupSchedules?: FollowupScheduleMilestoneRecord[];
  statusHistory?: StatusHistoryRecord[];
  followups?: FollowupEntryRecord[];
  grievances?: GrievanceRecord[];
  reminders?: ReminderRecord[];
  inventoryCategories?: InventoryCategoryRecord[];
  annapurnaApplications?: any[];
  gasState?: Record<string, any>;
  teamState?: {
    tasks?: any[];
    timeLogs?: any[];
    shiftConfig?: Record<string, any>;
    updatedAt?: string;
    updatedByUid?: string;
  };
  hrState?: {
    leaves?: any[];
    holidays?: any[];
    payrollRuns?: any[];
    payslips?: any[];
    recruitment?: any[];
    training?: any[];
    kpiConfig?: Record<string, any>;
    kpiReviews?: any[];
    employeeLetters?: any[];
    rewardsDisciplinary?: any[];
    employeeProfiles?: Record<string, any>;
    updatedAt?: string;
    updatedByUid?: string;
  };
  extendedErp?: Record<string, any>;
  menuConfig?: MenuConfigState;
}

export const FIXED_11_DEPARTMENT_KEYS = [
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
  'SYSTEM & SECURITY'
] as const;

export interface MenuDepartmentOverride {
  title?: string;
  icon?: string;
}

export interface MenuSubmenuOverride {
  label?: string;
  icon?: string;
  order?: number;
  enabled?: boolean;
  group?: string;
}

export interface CustomSubmenuEntry {
  id: string;
  label: string;
  group: string;
  icon: string;
  targetRoute: string;
  customUrl?: string;
  description?: string;
  order: number;
  enabled: boolean;
  keywords?: string;
  createdAt: string;
  createdBy: string;
}

export interface MenuConfigState {
  departments: Record<string, MenuDepartmentOverride>;
  submenus: Record<string, MenuSubmenuOverride>;
  customSubmenus: CustomSubmenuEntry[];
  updatedAt?: string;
  updatedByUid?: string;
}

export interface InventoryCategoryRecord {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  createdBy?: string;
}

export const DEFAULT_GAS_INVENTORY_CATEGORIES = [
  'Gas Hose Pipe',
  'Gas Lighter',
  'Gas Regulator',
  'Gas Oven / Stove',
  'Gas Spare Parts & Fittings',
  'Other Gas Accessories'
];

export type AdminOptionCategory =
  | 'customer_type'
  | 'service_scheme'
  | 'application_status'
  | 'contact_method'
  | 'customer_response'
  | 'action_taken'
  | 'followup_result'
  | 'pending_reason'
  | 'case_priority'
  | 'grievance_portal'
  | 'customer_feedback'
  | 'other_dropdown';

export interface AdminOptionRecord {
  id: string;
  category: AdminOptionCategory;
  label: string;
  sortOrder: number;
  isActive: boolean;
  isDeleted?: boolean;
  isDefault?: boolean;
  meta?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdByUid?: string;
  updatedByUid?: string;
}

export interface FollowupScheduleMilestoneRecord {
  id: string;
  day: number;
  title: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  isDeleted?: boolean;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryRecord {
  id: string;
  applicationId: string;
  caseId: string;
  customerId?: string;
  customerName?: string;
  previousStatus: string;
  newStatus: string;
  date: string;
  time: string;
  updatedBy: string;
  updatedByUid: string;
  remarks: string;
  timestamp: string;
}

export interface FollowupEntryRecord {
  id: string;
  applicationId: string;
  caseId: string;
  customerId?: string;
  customerName?: string;
  entryNo: number;
  followupDate: string;
  cycleDay: number;
  milestoneLabel: string;
  contactMethod: string;
  customerResponse: string;
  currentStatusSnapshot: string;
  actionTaken: string;
  nextFollowupDate: string;
  note: string;
  staffName: string;
  staffUid: string;
  followupResult: string;
  pendingReason?: string;
  casePriority?: string;
  customerFeedback?: string;
  attachmentName?: string;
  attachmentDocId?: string;
  reminderEnabled: boolean;
  timestamp: string;
}

export interface GrievanceRecord {
  id: string;
  applicationId: string;
  caseId: string;
  customerId?: string;
  customerName?: string;
  phone?: string;
  portal: string;
  referenceNumber: string;
  date: string;
  status: string;
  remarks: string;
  submittedTo?: string;
  department?: string;
  atr?: string;
  aadhaarSeedingStatus?: string;
  bankMapping?: string;
  customPortalName?: string;
  portalFields?: Record<string, any>;
  recordedBy: string;
  recordedByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderRecord {
  id: string;
  applicationId: string;
  caseId: string;
  customerId?: string;
  customerName?: string;
  phone?: string;
  milestoneDay: number;
  reminderDate: string;
  enabled: boolean;
  status: 'ACTIVE' | 'COMPLETED' | 'DISMISSED';
  note?: string;
  assignedStaff?: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_ADMIN_OPTION_SEEDS: Array<{
  category: AdminOptionCategory;
  label: string;
  meta?: Record<string, any>;
}> = [
  // Customer Types
  { category: 'customer_type', label: 'General Public' },
  { category: 'customer_type', label: 'Student' },
  { category: 'customer_type', label: 'Farmer / KCC' },
  { category: 'customer_type', label: 'Merchant / Shopkeeper' },
  { category: 'customer_type', label: 'Job Aspirant' },
  { category: 'customer_type', label: 'Senior Citizen' },
  { category: 'customer_type', label: 'Woman Beneficiary' },
  { category: 'customer_type', label: 'SC / ST / OBC' },
  { category: 'customer_type', label: 'BPL / Antyodaya' },

  // Services / Schemes
  { category: 'service_scheme', label: 'Annapurna Yojana' },
  { category: 'service_scheme', label: 'Lakshmir Bhandar' },
  { category: 'service_scheme', label: 'Krishak Bandhu' },
  { category: 'service_scheme', label: 'PM-KISAN Samman Nidhi' },
  { category: 'service_scheme', label: 'Swasthya Sathi' },
  { category: 'service_scheme', label: 'Old Age / Widow Pension' },
  { category: 'service_scheme', label: 'Bangla Awas Yojana' },
  { category: 'service_scheme', label: 'Ration Card Services' },
  { category: 'service_scheme', label: 'PAN Card Services' },
  { category: 'service_scheme', label: 'Aadhaar Assistance' },
  { category: 'service_scheme', label: 'Voter Card Services' },
  { category: 'service_scheme', label: 'Caste / Income Certificate' },
  { category: 'service_scheme', label: 'NPCI / DBT Bank Mapping' },
  { category: 'service_scheme', label: 'Kanyashree / Rupashree' },
  { category: 'service_scheme', label: 'Passport Assistance' },
  { category: 'service_scheme', label: 'Banglarbhumi Land Record' },
  { category: 'service_scheme', label: 'Job Application Portal' },
  { category: 'service_scheme', label: 'General Digital Service' },

  // Application Statuses (14 Exact Prompt Defaults)
  { category: 'application_status', label: 'Draft', meta: { tone: 'neutral', isFinal: false } },
  { category: 'application_status', label: 'Submitted', meta: { tone: 'info', isFinal: false } },
  { category: 'application_status', label: 'Under Verification', meta: { tone: 'info', isFinal: false } },
  { category: 'application_status', label: 'Document Required', meta: { tone: 'warning', isFinal: false } },
  { category: 'application_status', label: 'Pending at Department', meta: { tone: 'warning', isFinal: false } },
  { category: 'application_status', label: 'Approved', meta: { tone: 'success', isFinal: false } },
  { category: 'application_status', label: 'Sanctioned', meta: { tone: 'success', isFinal: false } },
  { category: 'application_status', label: 'Rejected', meta: { tone: 'danger', isFinal: false } },
  { category: 'application_status', label: 'Grievance Raised', meta: { tone: 'orange', isFinal: false } },
  { category: 'application_status', label: 'Escalated to CMO', meta: { tone: 'orange', isFinal: false } },
  { category: 'application_status', label: 'Escalated to MLA', meta: { tone: 'orange', isFinal: false } },
  { category: 'application_status', label: 'Resolved', meta: { tone: 'success', isFinal: false } },
  { category: 'application_status', label: 'Benefit Received', meta: { tone: 'success', isFinal: false } },
  { category: 'application_status', label: 'Closed', meta: { tone: 'neutral', isFinal: true } },

  // Contact Methods
  { category: 'contact_method', label: 'Phone Call' },
  { category: 'contact_method', label: 'WhatsApp Message' },
  { category: 'contact_method', label: 'Counter Visit' },
  { category: 'contact_method', label: 'Portal Status Check' },
  { category: 'contact_method', label: 'Department Follow-up' },
  { category: 'contact_method', label: 'Field Visit' },
  { category: 'contact_method', label: 'SMS / Reminder' },
  { category: 'contact_method', label: 'Email' },

  // Customer Responses
  { category: 'customer_response', label: 'Answered & Confirmed' },
  { category: 'customer_response', label: 'Documents Promised' },
  { category: 'customer_response', label: 'Requested Callback' },
  { category: 'customer_response', label: 'Visited Counter' },
  { category: 'customer_response', label: 'Not Reachable / Switched Off' },
  { category: 'customer_response', label: 'No Response' },
  { category: 'customer_response', label: 'Grievance Requested' },
  { category: 'customer_response', label: 'Satisfied with Progress' },

  // Actions Taken
  { category: 'action_taken', label: 'Called Customer & Updated Status' },
  { category: 'action_taken', label: 'Portal Status Verified' },
  { category: 'action_taken', label: 'WhatsApp Reminder Sent' },
  { category: 'action_taken', label: 'Uploaded Pending Documents' },
  { category: 'action_taken', label: 'Department Follow-up Enquiry' },
  { category: 'action_taken', label: 'Grievance Filed / Escalated' },
  { category: 'action_taken', label: 'Bank / NPCI Mapping Checked' },
  { category: 'action_taken', label: 'Scheduled Next Follow-up' },
  { category: 'action_taken', label: 'Case Review Completed' },

  // Follow-up Results
  { category: 'followup_result', label: 'Progressing Smoothly' },
  { category: 'followup_result', label: 'Document Awaited from Customer' },
  { category: 'followup_result', label: 'Pending with Department / Officer' },
  { category: 'followup_result', label: 'Escalation Required' },
  { category: 'followup_result', label: 'Rescheduled by Customer' },
  { category: 'followup_result', label: 'Benefit / Approval Received' },
  { category: 'followup_result', label: 'Customer Unresponsive' },
  { category: 'followup_result', label: 'Completed' },

  // Pending Reasons (10 Exact Prompt Defaults)
  { category: 'pending_reason', label: 'Document Pending' },
  { category: 'pending_reason', label: 'Department Verification' },
  { category: 'pending_reason', label: 'Bank Account Issue' },
  { category: 'pending_reason', label: 'Aadhaar Seeding Issue' },
  { category: 'pending_reason', label: 'NPCI Mapping Issue' },
  { category: 'pending_reason', label: 'Payment Pending' },
  { category: 'pending_reason', label: 'Technical Issue' },
  { category: 'pending_reason', label: 'Officer Approval Pending' },
  { category: 'pending_reason', label: 'Customer Response Pending' },
  { category: 'pending_reason', label: 'Other' },

  // Case Priorities (4 Exact Prompt Defaults)
  { category: 'case_priority', label: 'Normal', meta: { badge: 'neutral', weight: 1 } },
  { category: 'case_priority', label: 'Medium', meta: { badge: 'info', weight: 2 } },
  { category: 'case_priority', label: 'High', meta: { badge: 'warning', weight: 3 } },
  { category: 'case_priority', label: 'Urgent', meta: { badge: 'danger', weight: 4 } },

  // Grievance Portals (5 Exact Prompt Defaults)
  { category: 'grievance_portal', label: 'CMO', meta: { fields: ['referenceNumber', 'date', 'status', 'remarks'] } },
  { category: 'grievance_portal', label: 'MLA', meta: { fields: ['referenceNumber', 'date', 'remarks'] } },
  { category: 'grievance_portal', label: 'CPGRAMS', meta: { fields: ['referenceNumber', 'department', 'atr', 'status'] } },
  { category: 'grievance_portal', label: 'NPCI', meta: { fields: ['aadhaarSeedingStatus', 'bankMapping', 'remarks'] } },
  { category: 'grievance_portal', label: 'Other', meta: { fields: ['customPortalName', 'referenceNumber', 'date', 'status', 'remarks'] } },

  // Customer Feedback (4 Exact Prompt Defaults)
  { category: 'customer_feedback', label: 'Satisfied' },
  { category: 'customer_feedback', label: 'Partially Satisfied' },
  { category: 'customer_feedback', label: 'Not Satisfied' },
  { category: 'customer_feedback', label: 'No Response' }
];

export const DEFAULT_FOLLOWUP_SCHEDULE_SEEDS: Array<{ day: number; title: string; description: string }> = [
  { day: 0, title: 'Customer Registration', description: 'Initial application registration & Day 0 current status setup' },
  { day: 7, title: 'First Call', description: 'Verify receipt acknowledgement & check any missing documents' },
  { day: 15, title: 'Status Check', description: 'Portal status check & customer progress call' },
  { day: 30, title: 'Application Review', description: '30-day review of department processing & verification' },
  { day: 45, title: 'Department Follow-up', description: 'Follow up with concerned officer/portal if still pending' },
  { day: 60, title: 'Grievance Follow-up', description: 'Check grievance escalation or portal ATR response' },
  { day: 75, title: 'Final Review', description: 'Pre-90-day resolution check & benefit readiness check' },
  { day: 90, title: 'Final Case Review', description: '90-Day cycle review & closure / reopen assessment' }
];

// ---------------------------------------------------------------------------
// CRYPTOGRAPHY: VERHOEFF AADHAAR + AES-256-GCM + HMAC SECRETS
// ---------------------------------------------------------------------------
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

export function validateVerhoeffAadhaar(raw: string): { valid: boolean; clean: string; reason?: string } {
  const clean = String(raw || '').replace(/[^0-9]/g, '');
  if (clean.length !== 12) {
    return { valid: false, clean, reason: 'Aadhaar number must be exactly 12 digits.' };
  }
  if (/^([01])/.test(clean)) {
    return { valid: false, clean, reason: 'Invalid Aadhaar number: cannot start with 0 or 1.' };
  }
  if (/^(\d)\1{11}$/.test(clean)) {
    return { valid: false, clean, reason: 'Invalid Aadhaar number: repeated identical digits.' };
  }
  let c = 0;
  const digits = clean.split('').reverse().map(Number);
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]];
  }
  if (c !== 0) {
    return { valid: false, clean, reason: 'Invalid Aadhaar number: Verhoeff checksum verification failed.' };
  }
  return { valid: true, clean };
}

function getRuntimeSecretKey(purpose: string): Buffer {
  const envSecret =
    purpose === 'aadhaar'
      ? process.env.AADHAAR_ENC_KEY || process.env.SESSION_SECRET
      : process.env.SESSION_SECRET || process.env.AADHAAR_ENC_KEY;

  if (envSecret && envSecret.length >= 16) {
    return crypto.createHash('sha256').update(`${purpose}:${envSecret}`).digest();
  }

  // Persist an installation-local CSPRNG key in data/.server-secret (or read from bundled source data on Vercel) so sessions/CAPTCHA stay stable across serverless instances
  const secretFile = path.join(DATA_DIR, '.server-secret');
  const sourceSecretFile = path.join(getSourceDataDir(), '.server-secret');
  let master = '';
  if (fs.existsSync(secretFile)) {
    master = fs.readFileSync(secretFile, 'utf-8').trim();
  } else if (fs.existsSync(sourceSecretFile)) {
    master = fs.readFileSync(sourceSecretFile, 'utf-8').trim();
  }
  if (!master || master.length < 32) {
    if (isVercelRuntime()) {
      const vercelSeed =
        process.env.VERCEL_PROJECT_PRODUCTION_URL ||
        process.env.VERCEL_URL ||
        process.env.VERCEL_GIT_REPO_ID ||
        process.env.VERCEL_GIT_COMMIT_SHA;
      if (vercelSeed) {
        master = crypto
          .createHash('sha512')
          .update(`mun-vercel:${vercelSeed}:${MAIN_ADMIN_UID}`)
          .digest('hex');
      }
    }
    if (!master || master.length < 32) {
      master = crypto.randomBytes(48).toString('hex');
    }
    try {
      fs.writeFileSync(secretFile, master, { encoding: 'utf-8', mode: 0o600 });
    } catch {
      // ignore if read-only
    }
  }
  return crypto.createHash('sha256').update(`${purpose}:${master}`).digest();
}

export function encryptSensitive(plainText: string): string {
  const clean = String(plainText || '').trim();
  if (!clean) return '';
  const key = getRuntimeSecretKey('aadhaar');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSensitive(cipherText: string): string {
  try {
    const parts = String(cipherText || '').split(':');
    if (parts.length !== 3) return '';
    const [ivHex, tagHex, dataHex] = parts;
    const key = getRuntimeSecretKey('aadhaar');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

export function hashSensitive(plainText: string): string {
  return crypto.createHash('sha256').update(String(plainText || '').trim()).digest('hex');
}

export function maskAadhaar(raw: string): string {
  const clean = String(raw || '').replace(/[^0-9]/g, '');
  if (clean.length !== 12) return 'XXXX XXXX XXXX';
  return `XXXX XXXX ${clean.slice(-4)}`;
}

export function maskPhone(raw: string): string {
  const clean = String(raw || '').replace(/[^0-9]/g, '').slice(-10);
  if (clean.length < 4) return '**********';
  return 'XXXXXX' + clean.slice(-4);
}

// ---------------------------------------------------------------------------
// HMAC TOKENS FOR SESSIONS, CAPTCHA & MULTI-STEP FORGOT PASSWORD
// ---------------------------------------------------------------------------
function signPayload(payload: Record<string, any>, purpose: string): string {
  const json = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getRuntimeSecretKey(purpose))
    .update(json)
    .digest('base64url');
  return `${json}.${sig}`;
}

function verifyPayloadDetailed<T = Record<string, any>>(
  token: string,
  purpose: string
): { valid: boolean; expired?: boolean; payload?: T } {
  if (!token || !token.includes('.')) return { valid: false };
  const [json, sig] = token.split('.');
  if (!json || !sig) return { valid: false };
  const expected = crypto
    .createHmac('sha256', getRuntimeSecretKey(purpose))
    .update(json)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false };
  }
  try {
    const data = JSON.parse(Buffer.from(json, 'base64url').toString('utf8'));
    if (data.exp && Date.now() > data.exp) {
      return { valid: false, expired: true, payload: data as T };
    }
    return { valid: true, payload: data as T };
  } catch {
    return { valid: false };
  }
}

function verifyPayload<T = Record<string, any>>(token: string, purpose: string): T | null {
  const res = verifyPayloadDetailed<T>(token, purpose);
  return res.valid && res.payload ? res.payload : null;
}

export const DEFAULT_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface AccessTokenPayload {
  uid: string;
  role: string;
  isSuperAdmin: boolean;
  sv?: number;
  sid?: string;
  did?: string;
  iat?: number;
  exp?: number;
}

export function issueAccessToken(user: {
  uid: string;
  role: string;
  isSuperAdmin?: boolean;
  sessionVersion?: number;
  sessionId?: string;
  deviceId?: string;
  ttlMs?: number;
}): string {
  const ttl = Math.max(1000, Number(user.ttlMs || DEFAULT_ACCESS_TOKEN_TTL_MS));
  return signPayload(
    {
      uid: user.uid,
      role: user.role,
      isSuperAdmin: Boolean(user.isSuperAdmin || user.uid === SUPER_ADMIN_UID),
      sv: Number(user.sessionVersion || 1),
      ...(user.sessionId ? { sid: user.sessionId } : {}),
      ...(user.deviceId ? { did: user.deviceId } : {}),
      nonce: crypto.randomBytes(6).toString('hex'),
      iat: Date.now(),
      exp: Date.now() + ttl
    },
    'session'
  );
}

export function verifyAccessTokenDetailed(
  token: string
): { valid: boolean; expired?: boolean; payload?: AccessTokenPayload } {
  return verifyPayloadDetailed<AccessTokenPayload>(token, 'session');
}

export function issueSessionToken(user: {
  uid: string;
  role: string;
  isSuperAdmin?: boolean;
  sessionVersion?: number;
  sessionId?: string;
  deviceId?: string;
  ttlMs?: number;
}): string {
  return issueAccessToken(user);
}

export function verifySessionToken(token: string): AccessTokenPayload | null {
  return verifyPayload(token, 'session');
}

export function generateCaptchaChallenge(): { svg: string; captchaToken: string } {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  const noiseLines = Array.from({ length: 5 }, (_, i) => {
    const x1 = crypto.randomInt(0, 40);
    const y1 = crypto.randomInt(5, 45);
    const x2 = crypto.randomInt(120, 180);
    const y2 = crypto.randomInt(5, 45);
    const colors = ['#93c5fd', '#60a5fa', '#7dd3fc', '#a5b4fc', '#bfdbfe'];
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors[i % colors.length]}" stroke-width="1.3" opacity="0.65"/>`;
  }).join('');

  const letterSpans = code
    .split('')
    .map((ch, idx) => {
      const x = 18 + idx * 24;
      const y = 32 + crypto.randomInt(-3, 4);
      const rot = crypto.randomInt(-11, 12);
      const letterColors = ['#0047cc', '#0052d9', '#003da6', '#1d4ed8'];
      const fill = letterColors[idx % letterColors.length];
      return `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" fill="${fill}" font-family="monospace" font-size="22" font-weight="900" font-style="italic">${ch}</text>`;
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="170" height="48" viewBox="0 0 170 48"><rect width="170" height="48" rx="10" fill="#ffffff"/>${noiseLines}${letterSpans}</svg>`;
  const captchaToken = signPayload(
    {
      answerHash: hashSensitive(code.toUpperCase()),
      nonce: crypto.randomBytes(8).toString('hex'),
      exp: Date.now() + 5 * 60 * 1000
    },
    'captcha'
  );
  return { svg, captchaToken };
}

export function verifyCaptchaChallenge(captchaToken: string, userInput: string): boolean {
  const payload = verifyPayload<{ answerHash: string }>(captchaToken, 'captcha');
  if (!payload || !userInput) return false;
  return payload.answerHash === hashSensitive(String(userInput).trim().toUpperCase());
}

export function issueForgotStepToken(uid: string, stage: 'STEP1' | 'IDENTITY_VERIFIED'): string {
  return signPayload(
    {
      uid,
      stage,
      nonce: crypto.randomBytes(8).toString('hex'),
      exp: Date.now() + 10 * 60 * 1000
    },
    'forgot'
  );
}

export function verifyForgotStepToken(token: string, expectedStage: 'STEP1' | 'IDENTITY_VERIFIED'): { uid: string } | null {
  const data = verifyPayload<{ uid: string; stage: string }>(token, 'forgot');
  if (!data || data.stage !== expectedStage) return null;
  return { uid: data.uid };
}

export function issueMfaPendingToken(uid: string, panelRole: string): string {
  return signPayload(
    {
      uid,
      panelRole,
      nonce: crypto.randomBytes(8).toString('hex'),
      exp: Date.now() + 5 * 60 * 1000
    },
    'mfa'
  );
}

export function verifyMfaPendingToken(token: string): { uid: string; panelRole: string } | null {
  const data = verifyPayload<{ uid: string; panelRole: string }>(token, 'mfa');
  if (!data || !data.uid) return null;
  return { uid: data.uid, panelRole: data.panelRole || 'ADMIN' };
}

// Preset service catalog seeding removed — only genuine user-created services are stored.

// ---------------------------------------------------------------------------
// CENTRAL DATABASE CLASS
// ---------------------------------------------------------------------------
class CentralErpDatabaseService {
  private db: CentralErpDatabase = {
    countersByYear: {},
    globalSerialByYear: {},
    services: [],
    customers: [],
    applications: [],
    documents: [],
    recoveryCodes: [],
    chats: [],
    attendanceRecords: [],
    attendancePhotos: [],
    counterCashTxns: [],
    counterDaybook: [],
    deleteHistory: [],
    backupSnapshots: [],
    followupCases: [],
    adminOptions: [],
    followupSchedules: [],
    statusHistory: [],
    followups: [],
    grievances: [],
    reminders: [],
    inventoryCategories: [],
    annapurnaApplications: [],
    gasState: {},
    teamState: {
      tasks: [],
      timeLogs: []
    }
  };

  private buildDefaultGasInventoryCategories(): InventoryCategoryRecord[] {
    const nowIso = new Date().toISOString();
    return DEFAULT_GAS_INVENTORY_CATEGORIES.map((name, idx) => ({
      id: `CAT-GAS-${String(idx + 1).padStart(2, '0')}`,
      name,
      isDefault: true,
      createdAt: nowIso,
      createdBy: SUPER_ADMIN_UID
    }));
  }

  private ensureInventoryCategoriesSeeded(): void {
    if (!Array.isArray(this.db.inventoryCategories)) {
      this.db.inventoryCategories = [];
    }
  }

  init(): void {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    if (!fs.existsSync(ATTENDANCE_PHOTOS_DIR)) fs.mkdirSync(ATTENDANCE_PHOTOS_DIR, { recursive: true });
    if (!fs.existsSync(AUTO_BACKUPS_DIR)) fs.mkdirSync(AUTO_BACKUPS_DIR, { recursive: true });

    if (fs.existsSync(ERP_DB_FILE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(ERP_DB_FILE, 'utf-8'));
        this.db = {
          countersByYear: parsed.countersByYear || {},
          globalSerialByYear: parsed.globalSerialByYear && typeof parsed.globalSerialByYear === 'object' ? parsed.globalSerialByYear : {},
          services: Array.isArray(parsed.services) ? parsed.services : [],
          customers: Array.isArray(parsed.customers) ? parsed.customers : [],
          applications: Array.isArray(parsed.applications) ? parsed.applications : [],
          documents: Array.isArray(parsed.documents) ? parsed.documents : [],
          recoveryCodes: Array.isArray(parsed.recoveryCodes) ? parsed.recoveryCodes : [],
          chats: Array.isArray(parsed.chats) ? parsed.chats : [],
          attendanceRecords: Array.isArray(parsed.attendanceRecords) ? parsed.attendanceRecords : [],
          attendancePhotos: Array.isArray(parsed.attendancePhotos) ? parsed.attendancePhotos : [],
          counterCashTxns: Array.isArray(parsed.counterCashTxns) ? parsed.counterCashTxns : [],
          counterDaybook: Array.isArray(parsed.counterDaybook) ? parsed.counterDaybook : [],
          deleteHistory: Array.isArray(parsed.deleteHistory) ? parsed.deleteHistory : [],
          backupSnapshots: Array.isArray(parsed.backupSnapshots) ? parsed.backupSnapshots : [],
          followupCases: Array.isArray(parsed.followupCases) ? parsed.followupCases : [],
          adminOptions: Array.isArray(parsed.adminOptions) ? parsed.adminOptions : [],
          followupSchedules: Array.isArray(parsed.followupSchedules) ? parsed.followupSchedules : [],
          statusHistory: Array.isArray(parsed.statusHistory) ? parsed.statusHistory : [],
          followups: Array.isArray(parsed.followups) ? parsed.followups : [],
          grievances: Array.isArray(parsed.grievances) ? parsed.grievances : [],
          reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
          inventoryCategories: Array.isArray(parsed.inventoryCategories) ? parsed.inventoryCategories : [],
          annapurnaApplications: Array.isArray(parsed.annapurnaApplications) ? parsed.annapurnaApplications : [],
          gasState: parsed.gasState && typeof parsed.gasState === 'object' ? parsed.gasState : {},
          teamState: parsed.teamState && typeof parsed.teamState === 'object' ? parsed.teamState : { tasks: [], timeLogs: [] },
          hrState: parsed.hrState && typeof parsed.hrState === 'object' ? parsed.hrState : undefined,
          extendedErp: parsed.extendedErp && typeof parsed.extendedErp === 'object' ? parsed.extendedErp : {},
          menuConfig: parsed.menuConfig && typeof parsed.menuConfig === 'object'
            ? {
                departments: parsed.menuConfig.departments && typeof parsed.menuConfig.departments === 'object' ? parsed.menuConfig.departments : {},
                submenus: parsed.menuConfig.submenus && typeof parsed.menuConfig.submenus === 'object' ? parsed.menuConfig.submenus : {},
                customSubmenus: Array.isArray(parsed.menuConfig.customSubmenus) ? parsed.menuConfig.customSubmenus : [],
                updatedAt: parsed.menuConfig.updatedAt,
                updatedByUid: parsed.menuConfig.updatedByUid
              }
            : { departments: {}, submenus: {}, customSubmenus: [] }
        };
      } catch {
        this.db.services = [];
      }
    }

    // Purge any preset/demo SEED_SERVICE entries (SRV-2026-000001..000107) so search only shows real records
    if (Array.isArray(this.db.services) && this.db.services.length > 0) {
      this.db.services = this.db.services.filter(
        s => !(Array.isArray(s.auditHistory) && s.auditHistory.some(h => h.action === 'SEED_SERVICE'))
      );
    }
    this.ensure90DayDefaultSeeds();
    this.ensureInventoryCategoriesSeeded();

    this.syncCountersWithExistingData();
    this.syncGlobalSerialWithRecords();
    this.save();
  }

  private save(): void {
    fs.writeFileSync(ERP_DB_FILE, JSON.stringify(this.db, null, 2), 'utf-8');
  }

  private getCurrentYear(): number {
    return getKolkataDateParts().year;
  }

  private ensureYearCounter(year = this.getCurrentYear()): CounterState {
    const key = String(year);
    if (!this.db.countersByYear[key]) {
      this.db.countersByYear[key] = {
        year,
        MUNCM: 0,
        MUNCS: 0,
        UID_SLNO: 0,
        REQ: 0,
        APP: 0,
        SRV: 0,
        CUST: 0,
        DOC: 0,
        LOC: 0,
        AUD: 0,
        DEL: 0,
        BKP: 0
      };
    } else {
      if (this.db.countersByYear[key].UID_SLNO === undefined) this.db.countersByYear[key].UID_SLNO = 0;
      if (this.db.countersByYear[key].DEL === undefined) this.db.countersByYear[key].DEL = 0;
      if (this.db.countersByYear[key].BKP === undefined) this.db.countersByYear[key].BKP = 0;
    }
    return this.db.countersByYear[key];
  }

  private parseGlobalSerialId(rawId: string): { prefix: string; year2: string; seq: number } | null {
    const clean = String(rawId || '').trim().toUpperCase();
    const mV2 = clean.match(/^MUN-([A-Z0-9_-]{2,15})-(\d{4})-(\d{8,})$/);
    if (mV2) {
      const seq = parseInt(mV2[3], 10);
      if (!Number.isFinite(seq) || seq <= 0) return null;
      return { prefix: mV2[1], year2: mV2[2].slice(-2), seq };
    }
    const m = clean.match(/^([A-Z]{2,10})-(\d{2})-(\d{4,})$/);
    if (!m) return null;
    const seq = parseInt(m[3], 10);
    if (!Number.isFinite(seq) || seq <= 0) return null;
    return { prefix: m[1], year2: m[2], seq };
  }

  private isValidGlobalReferenceId(rawId: string): boolean {
    const clean = String(rawId || '').trim().toUpperCase();
    return /^MUN-[A-Z0-9_-]{2,15}-\d{4}-\d{8,}$/.test(clean);
  }

  private formatGlobalSerial(prefix: string, year2: string, seq: number): string {
    const meta = resolveCanonicalPrefix(prefix);
    const resolvedPrefix = meta ? meta.prefix : (String(prefix || 'CUST').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'CUST');
    const year4 = year2.length === 4 ? year2 : `20${year2.slice(-2)}`;
    const padded = String(Math.max(1, Math.floor(seq))).padStart(8, '0');
    return `MUN-${resolvedPrefix}-${year4}-${padded}`;
  }

  private ensureGlobalYearSerial(yearInput?: number): GlobalYearSerialState {
    if (!this.db.globalSerialByYear || typeof this.db.globalSerialByYear !== 'object') {
      this.db.globalSerialByYear = {};
    }
    const year = yearInput || this.getCurrentYear();
    const year2 = String(year).slice(-2).padStart(2, '0');
    if (!this.db.globalSerialByYear[year2]) {
      this.db.globalSerialByYear[year2] = {
        year,
        year2,
        lastSerial: 0,
        updatedAt: new Date().toISOString()
      };
    }
    return this.db.globalSerialByYear[year2];
  }

  private syncGlobalSerialWithRecords(): void {
    const { year, yearStr } = getKolkataDateParts();
    const curYear2 = yearStr.slice(-2);
    this.ensureGlobalYearSerial(year);

    const checkId = (id?: string) => {
      const appParsed = parseApplicationSerialId(id);
      if (appParsed) {
        const yFull = 2000 + parseInt(appParsed.year2, 10);
        const state = this.ensureGlobalYearSerial(appParsed.year2 === curYear2 ? year : yFull);
        if (appParsed.seq > state.lastSerial) {
          state.lastSerial = appParsed.seq;
          state.updatedAt = new Date().toISOString();
        }
        return;
      }
      const parsed = this.parseGlobalSerialId(String(id || ''));
      if (!parsed) return;
      // Ignore system housekeeping prefixes if any match 2-digit pattern
      if (parsed.prefix === 'AUD' || parsed.prefix === 'DEL' || parsed.prefix === 'BKP') return;
      const yFull = 2000 + parseInt(parsed.year2, 10);
      const state = this.ensureGlobalYearSerial(parsed.year2 === curYear2 ? year : yFull);
      if (parsed.seq > state.lastSerial) {
        state.lastSerial = parsed.seq;
        state.updatedAt = new Date().toISOString();
      }
    };

    for (const c of this.db.customers) {
      checkId(c.id);
      checkId((c as any).applicationId);
    }
    for (const a of this.db.applications) checkId(a.id);
    for (const d of this.db.documents) checkId(d.id);
    for (const s of this.db.services) checkId(s.id);
    for (const m of this.db.chats || []) checkId(m.id);
    for (const ar of this.db.attendanceRecords || []) checkId(ar.id);
    for (const ap of this.db.attendancePhotos || []) checkId(ap.id);
    for (const t of this.db.counterCashTxns || []) checkId(t.id);
    for (const dbSnap of this.db.counterDaybook || []) checkId(dbSnap.id);
    for (const fc of this.db.followupCases || []) {
      checkId(fc.id);
      checkId(fc.applicationId);
    }
  }

  private syncCountersWithExistingData(): void {
    const users = this.loadUsers();
    const bumpMax = (yearStr: string, field: keyof Omit<CounterState, 'year'>, num: number) => {
      const y = parseInt(yearStr, 10);
      if (!Number.isFinite(y) || !Number.isFinite(num)) return;
      const c = this.ensureYearCounter(y);
      if (num > (c[field] || 0)) c[field] = num;
    };

    for (const u of users) {
      const reqMatch = String(u.requestId || '').match(/^REQ-(\d{4})-(\d+)$/);
      if (reqMatch) bumpMax(reqMatch[1], 'REQ', parseInt(reqMatch[2], 10));

      const mMatch = String(u.uid || '').match(/^MUNCM-(\d{4})-(\d+)$/);
      if (mMatch) bumpMax(mMatch[1], 'MUNCM', parseInt(mMatch[2], 10));

      const sMatch = String(u.uid || '').match(/^MUNCS-(\d{4})-(\d+)$/);
      if (sMatch) bumpMax(sMatch[1], 'MUNCS', parseInt(sMatch[2], 10));

      const compMatch = String(u.uid || '').match(/^MUNCOMPUTER-(?:AD|MN|ST)-(\d{4})-(\d{2})-(\d{4,})$/);
      if (compMatch) bumpMax(compMatch[1], 'UID_SLNO', parseInt(compMatch[3], 10));
    }

    for (const srv of this.db.services) {
      const m = String(srv.id || '').match(/^SRV-(\d{4})-(\d+)$/);
      if (m) bumpMax(m[1], 'SRV', parseInt(m[2], 10));
    }
    for (const cust of this.db.customers) {
      const m = String(cust.id || '').match(/^CUST-(\d{4})-(\d+)$/);
      if (m) bumpMax(m[1], 'CUST', parseInt(m[2], 10));
    }
    for (const app of this.db.applications) {
      const m = String(app.id || '').match(/^APP-(\d{4})-(\d+)$/);
      if (m) bumpMax(m[1], 'APP', parseInt(m[2], 10));
    }
    for (const doc of this.db.documents) {
      const m = String(doc.id || '').match(/^DOC-(\d{4})-(\d+)$/);
      if (m) bumpMax(m[1], 'DOC', parseInt(m[2], 10));
    }
    for (const aud of this.loadAuditLogs()) {
      const m = String(aud.id || '').match(/^AUD-(\d{4})-(\d+)$/);
      if (m) bumpMax(m[1], 'AUD', parseInt(m[2], 10));
    }
    for (const del of this.db.deleteHistory || []) {
      const m = String(del.id || '').match(/^DEL-(\d{4})-(\d+)$/);
      if (m) bumpMax(m[1], 'DEL', parseInt(m[2], 10));
    }
  }

  // ONE GLOBAL SEQUENTIAL SERIAL NUMBER ENGINE (Shared Across ALL Business Modules — 8-Digit Version 2.0 FINAL)
  allocateGlobalSerial(
    prefix: string,
    opts?: { entityType?: string; entityId?: string; createdBy?: string; idempotencyKey?: string; creationYear?: number }
  ): { id: string; prefix: string; year: number; year2: string; serial: number; globalSl: string; referenceNo: string } {
    const allocated = globalReferenceEngine.generateGlobalReference({
      prefix: prefix || 'CUST',
      entityType: opts?.entityType,
      entityId: opts?.entityId,
      createdBy: opts?.createdBy || 'SYSTEM',
      idempotencyKey: opts?.idempotencyKey,
      creationYear: opts?.creationYear
    });
    return {
      id: allocated.reference_no,
      referenceNo: allocated.reference_no,
      prefix: allocated.module_prefix,
      year: allocated.creation_year,
      year2: String(allocated.creation_year).slice(-2).padStart(2, '0'),
      serial: allocated.serial_num,
      globalSl: allocated.global_sl
    };
  }

  getGlobalSerialStatus(previewPrefix = 'CUST'): {
    year: number;
    year2: string;
    lastSerial: number;
    nextSerial: number;
    nextPadded: string;
    previewId: string;
    organization_code: string;
    last_serial: number;
    last_global_sl: string;
    next_serial: number;
    next_global_sl: string;
    serial_length: number;
    preview_reference_no: string;
    total_registered: number;
    active_count: number;
    deleted_count: number;
    archived_count: number;
    byYear: Record<string, GlobalYearSerialState>;
  } {
    const status = globalReferenceEngine.getCounterStatus(previewPrefix);
    const year = status.creation_year;
    const year2 = String(year).slice(-2).padStart(2, '0');
    return {
      year,
      year2,
      lastSerial: status.last_serial,
      nextSerial: status.next_serial,
      nextPadded: status.next_global_sl,
      previewId: status.preview_reference_no,
      organization_code: status.organization_code,
      last_serial: status.last_serial,
      last_global_sl: status.last_global_sl,
      next_serial: status.next_serial,
      next_global_sl: status.next_global_sl,
      serial_length: status.serial_length,
      preview_reference_no: status.preview_reference_no,
      total_registered: status.total_registered,
      active_count: status.active_count,
      deleted_count: status.deleted_count,
      archived_count: status.archived_count,
      byYear: { ...(this.db.globalSerialByYear || {}) }
    };
  }

  syncGlobalSerialFloor(_serialOrId: number | string, _year2Input?: string): {
    year: number;
    year2: string;
    lastSerial: number;
    nextSerial: number;
  } {
    const check = globalReferenceEngine.verifyConsistency(true);
    const status = globalReferenceEngine.getCounterStatus('CUST');
    return {
      year: status.creation_year,
      year2: String(status.creation_year).slice(-2).padStart(2, '0'),
      lastSerial: check.lastSerial,
      nextSerial: status.next_serial
    };
  }

  allocateApplicationId(dateInput?: Date | string, actorUid = 'SYSTEM'): {
    applicationId: string;
    datePrefix: string;
    year: number;
    year2: string;
    serial: number;
    globalSl: string;
  } {
    const { datePrefix, year, year2 } = formatApplicationIdDatePrefix(dateInput);
    const allocated = globalReferenceEngine.generateGlobalReference({
      prefix: 'CASE',
      entityType: 'CASE',
      createdBy: actorUid,
      creationYear: year
    });
    return {
      applicationId: allocated.reference_no,
      datePrefix,
      year: allocated.creation_year,
      year2,
      serial: allocated.serial_num,
      globalSl: allocated.global_sl
    };
  }

  getNextApplicationIdPreview(dateInput?: Date | string): {
    previewId: string;
    datePrefix: string;
    year: number;
    year2: string;
    nextSerial: number;
    nextGlobalSl: string;
  } {
    const { datePrefix, year, year2 } = formatApplicationIdDatePrefix(dateInput);
    const status = globalReferenceEngine.getCounterStatus('CASE');
    return {
      previewId: `MUN-CASE-${year}-${status.next_global_sl}`,
      datePrefix,
      year,
      year2,
      nextSerial: status.next_serial,
      nextGlobalSl: status.next_global_sl
    };
  }

  private generateHousekeepingId(prefix: 'AUD' | 'DEL' | 'BKP', actorUid = 'SYSTEM'): string {
    return globalReferenceEngine.generateGlobalReference({
      prefix,
      createdBy: actorUid
    }).reference_no;
  }

  // Strictly monotonic atomic ID generator (Universal Global SL v2.0 — never reuses deleted/cancelled SLs)
  generateNextId(prefix: string, actorUid = 'SYSTEM', entityId?: string): string {
    const clean = String(prefix || 'CUST').trim().toUpperCase();
    return globalReferenceEngine.generateGlobalReference({
      prefix: clean,
      entityId,
      createdBy: actorUid
    }).reference_no;
  }

  // Atomic collision-safe Permanent UID generator routed through Universal Global SL (MGR / STF)
  generatePermanentUid(role: AppRole): string {
    const prefix = String(role || 'STAFF').trim().toUpperCase() === 'MANAGER' ? 'MGR' : 'STF';
    return globalReferenceEngine.generateGlobalReference({
      prefix,
      entityType: prefix === 'MGR' ? 'USER_MANAGER' : 'USER_STAFF',
      createdBy: 'SYSTEM'
    }).reference_no;
  }

  getCurrentCounters(): CounterState {
    return this.ensureYearCounter(this.getCurrentYear());
  }

  // -------------------------------------------------------------------------
  // USERS & AUDIT HELPERS (Preserving /data/users.json intact)
  // -------------------------------------------------------------------------
  loadUsers(): any[] {
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  saveUsers(users: any[]): void {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  }

  loadAuditLogs(): any[] {
    if (!fs.existsSync(AUDIT_LOGS_FILE)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(AUDIT_LOGS_FILE, 'utf-8'));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  logAudit(action: string, details: string, uid = 'SYSTEM', extra: Record<string, any> = {}): void {
    const logs = this.loadAuditLogs();
    const id = this.generateHousekeepingId('AUD');
    const timestamp = new Date().toISOString();
    const prevHash = logs[0]?.entryHash || 'GENESIS';
    const entryHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ id, timestamp, action, details, uid, prevHash }))
      .digest('hex');

    logs.unshift({
      id,
      timestamp,
      action,
      details,
      uid,
      prevHash,
      entryHash,
      ...extra
    });
    if (logs.length > 1500) logs.length = 1500;
    fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  }

  // Administration recovery code generation (Administration can generate a 10-min offline recovery code if SMS Gateway is off)
  createRecoveryCode(targetUid: string, actorUid: string): { code: string; expiresAt: string } {
    const code = String(crypto.randomInt(10000000, 99999999));
    const expiresAt = Date.now() + 10 * 60 * 1000;
    this.db.recoveryCodes = this.db.recoveryCodes.filter(r => r.expiresAt > Date.now() && !r.used);
    this.db.recoveryCodes.push({
      codeHash: bcrypt.hashSync(code, 8),
      uid: targetUid.toUpperCase(),
      createdBy: actorUid,
      expiresAt,
      used: false
    });
    this.save();
    this.logAudit(
      'RECOVERY_CODE_ISSUED',
      `Administration (${actorUid}) issued one-time recovery code for ${targetUid}.`,
      actorUid,
      { targetUid }
    );
    return { code, expiresAt: new Date(expiresAt).toISOString() };
  }

  verifyRecoveryCode(uid: string, code: string): boolean {
    const cleanUid = uid.trim().toUpperCase();
    const now = Date.now();
    const match = this.db.recoveryCodes.find(
      r => r.uid === cleanUid && !r.used && r.expiresAt >= now && bcrypt.compareSync(String(code).trim(), r.codeHash)
    );
    if (!match) return false;
    match.used = true;
    this.save();
    return true;
  }

  // -------------------------------------------------------------------------
  // SERVICE CATALOG CRUD (Soft Delete, Restore, Audit Trail)
  // -------------------------------------------------------------------------
  listServices(opts?: { includeDeleted?: boolean; category?: string; activeOnly?: boolean; q?: string }) {
    let list = [...this.db.services];
    if (!opts?.includeDeleted) {
      list = list.filter(s => !s.isDeleted);
    }
    if (opts?.activeOnly) {
      list = list.filter(s => s.isActive);
    }
    if (opts?.category && opts.category !== 'all') {
      list = list.filter(s => s.category.toLowerCase() === opts.category!.toLowerCase());
    }
    if (opts?.q && opts.q.trim()) {
      const q = opts.q.trim().toLowerCase();
      list = list.filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.subcategory.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.description || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => (a.position || 9999) - (b.position || 9999));
    return list;
  }

  upsertService(input: Partial<ServiceCatalogItem>, actorUid: string): { success: boolean; service?: ServiceCatalogItem; message: string } {
    const now = new Date().toISOString();
    const name = String(input.name || '').trim();
    const category = String(input.category || 'Other Services').trim();
    if (!name || !category) {
      return { success: false, message: 'Service name and category are required.' };
    }

    const govFee = Math.max(0, Number(input.govFee || 0));
    const serviceCharge = Math.max(0, Number(input.serviceCharge ?? input.price ?? 0));
    const totalPrice = input.price !== undefined && input.serviceCharge === undefined ? Math.max(0, Number(input.price)) : govFee + serviceCharge;

    if (input.id) {
      const existing = this.db.services.find(s => s.id === input.id);
      if (!existing) {
        return { success: false, message: `Service ${input.id} not found.` };
      }
      const oldSnapshot = {
        name: existing.name,
        category: existing.category,
        subcategory: existing.subcategory,
        price: existing.price,
        govFee: existing.govFee,
        serviceCharge: existing.serviceCharge,
        isActive: existing.isActive,
        position: existing.position
      };
      existing.name = name;
      existing.category = category;
      existing.subcategory = String(input.subcategory || name).trim();
      existing.govFee = govFee;
      existing.serviceCharge = serviceCharge;
      existing.price = totalPrice;
      existing.description = String(input.description ?? existing.description).trim();
      if (input.imageUrl !== undefined) existing.imageUrl = String(input.imageUrl).trim();
      if (input.position !== undefined) existing.position = Number(input.position) || existing.position;
      if (input.isActive !== undefined) existing.isActive = Boolean(input.isActive);
      existing.updatedAt = now;
      existing.updatedBy = actorUid;
      existing.auditHistory = existing.auditHistory || [];
      existing.auditHistory.unshift({
        timestamp: now,
        actorUid,
        action: 'UPDATE_SERVICE',
        oldValue: oldSnapshot,
        newValue: {
          name: existing.name,
          category: existing.category,
          price: existing.price,
          isActive: existing.isActive
        }
      });
      this.save();
      this.logAudit('SERVICE_UPDATED', `Updated service ${existing.id} (${existing.name})`, actorUid, {
        serviceId: existing.id,
        oldValue: oldSnapshot,
        newValue: { name: existing.name, price: existing.price }
      });
      return { success: true, service: existing, message: `Service ${existing.name} updated.` };
    }

    const id = this.generateNextId('SRV');
    const maxPos = this.db.services.reduce((m, s) => Math.max(m, s.position || 0), 0);
    const created: ServiceCatalogItem = {
      id,
      code: String(input.code || `MC-${String(maxPos + 1).padStart(3, '0')}`),
      name,
      category,
      subcategory: String(input.subcategory || name).trim(),
      price: totalPrice,
      govFee,
      serviceCharge,
      description: String(input.description || `${category} — ${name}`).trim(),
      imageUrl: input.imageUrl ? String(input.imageUrl).trim() : '',
      position: Number(input.position || maxPos + 1),
      isActive: input.isActive !== false,
      isDeleted: false,
      year: this.getCurrentYear(),
      createdAt: now,
      updatedAt: now,
      createdBy: actorUid,
      updatedBy: actorUid,
      auditHistory: [
        {
          timestamp: now,
          actorUid,
          action: 'CREATE_SERVICE',
          newValue: { id, name, category, price: totalPrice }
        }
      ]
    };

    this.db.services.push(created);
    this.save();
    this.logAudit('SERVICE_CREATED', `Created new service ${created.id} (${created.name}) in ${created.category}`, actorUid, {
      serviceId: created.id
    });
    return { success: true, service: created, message: `Service ${created.id} (${created.name}) added.` };
  }

  softDeleteService(serviceId: string, actorUid: string): { success: boolean; message: string; service?: ServiceCatalogItem } {
    const srv = this.db.services.find(s => s.id === serviceId);
    if (!srv) return { success: false, message: 'Service not found.' };
    if (srv.isDeleted) return { success: false, message: 'Service is already soft-deleted.' };

    const now = new Date().toISOString();
    srv.isDeleted = true;
    srv.isActive = false;
    srv.updatedAt = now;
    srv.updatedBy = actorUid;
    srv.auditHistory = srv.auditHistory || [];
    srv.auditHistory.unshift({
      timestamp: now,
      actorUid,
      action: 'SOFT_DELETE_SERVICE',
      oldValue: { isDeleted: false, isActive: true },
      newValue: { isDeleted: true, isActive: false }
    });
    this.save();
    globalReferenceEngine.markReferenceStatus(srv.id, 'DELETED', actorUid);
    this.logAudit(
      'SERVICE_SOFT_DELETED',
      `Soft-deleted service ${srv.id} (${srv.name}). Historical applications & invoices preserved.`,
      actorUid,
      { serviceId: srv.id }
    );
    return { success: true, service: srv, message: `Service "${srv.name}" moved to Deleted Services Archive.` };
  }

  restoreService(serviceId: string, actorUid: string): { success: boolean; message: string; service?: ServiceCatalogItem } {
    const srv = this.db.services.find(s => s.id === serviceId);
    if (!srv) return { success: false, message: 'Service not found.' };

    const now = new Date().toISOString();
    srv.isDeleted = false;
    srv.isActive = true;
    srv.updatedAt = now;
    srv.updatedBy = actorUid;
    srv.auditHistory = srv.auditHistory || [];
    srv.auditHistory.unshift({
      timestamp: now,
      actorUid,
      action: 'RESTORE_SERVICE',
      oldValue: { isDeleted: true },
      newValue: { isDeleted: false, isActive: true }
    });
    this.save();
    this.logAudit('SERVICE_RESTORED', `Restored service ${srv.id} (${srv.name})`, actorUid, { serviceId: srv.id });
    return { success: true, service: srv, message: `Service "${srv.name}" restored and activated.` };
  }

  toggleServiceActive(serviceId: string, actorUid: string): { success: boolean; service?: ServiceCatalogItem; message: string } {
    const srv = this.db.services.find(s => s.id === serviceId);
    if (!srv) return { success: false, message: 'Service not found.' };
    if (srv.isDeleted) return { success: false, message: 'Restore service before activating.' };

    const now = new Date().toISOString();
    const prev = srv.isActive;
    srv.isActive = !srv.isActive;
    srv.updatedAt = now;
    srv.updatedBy = actorUid;
    srv.auditHistory = srv.auditHistory || [];
    srv.auditHistory.unshift({
      timestamp: now,
      actorUid,
      action: srv.isActive ? 'ACTIVATE_SERVICE' : 'DEACTIVATE_SERVICE',
      oldValue: { isActive: prev },
      newValue: { isActive: srv.isActive }
    });
    this.save();
    this.logAudit('SERVICE_STATUS_CHANGED', `${srv.name} (${srv.id}) marked ${srv.isActive ? 'ACTIVE' : 'INACTIVE'}`, actorUid);
    return { success: true, service: srv, message: `${srv.name} is now ${srv.isActive ? 'Active' : 'Inactive'}.` };
  }

  permanentDeleteService(serviceId: string, actorUid: string): { success: boolean; message: string } {
    const idx = this.db.services.findIndex(s => s.id === serviceId);
    if (idx === -1) return { success: false, message: 'Service not found.' };
    const removed = this.db.services.splice(idx, 1)[0];
    globalReferenceEngine.markReferenceStatus(removed.id, 'DELETED', actorUid);
    this.save();
    this.logAudit(
      'SERVICE_PERMANENT_DELETE',
      `Permanently deleted service ${removed.id} (${removed.name}) from catalog`,
      actorUid,
      { serviceId: removed.id }
    );
    return { success: true, message: `Permanently removed "${removed.name}" from Central Service Catalog.` };
  }

  // -------------------------------------------------------------------------
  // CUSTOMER MASTER + AUTO-FETCH + ADMIN DUPLICATE MERGE
  // -------------------------------------------------------------------------
  listCustomers(q = '') {
    let list = [...this.db.customers];
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      const digits = needle.replace(/[^0-9]/g, '');
      list = list.filter(
        c =>
          c.id.toLowerCase().includes(needle) ||
          (c.uid || '').toLowerCase().includes(needle) ||
          c.name.toLowerCase().includes(needle) ||
          (c.phone || '').includes(digits || needle) ||
          (c.villageOrLocality || '').toLowerCase().includes(needle) ||
          (c.blockOrMunicipality || '').toLowerCase().includes(needle) ||
          (c.gpOrWard || '').toLowerCase().includes(needle) ||
          (c.pinCode || '').includes(needle) ||
          (c.aadhaarMasked || '').slice(-4).includes(needle)
      );
    }
    return list.map(c => {
      const { aadhaarEncrypted, aadhaarHash, ...safe } = c;
      return safe;
    });
  }

  getCustomerAutoFetch(lookup: string) {
    const clean = String(lookup || '').trim().toUpperCase();
    const digits = clean.replace(/[^0-9]/g, '').slice(-10);
    const match = this.db.customers.find(
      c =>
        c.id.toUpperCase() === clean ||
        (c.uid && c.uid.toUpperCase() === clean) ||
        (digits.length === 10 && c.phone.replace(/[^0-9]/g, '').slice(-10) === digits)
    );
    if (!match) return null;
    const { aadhaarEncrypted, aadhaarHash, ...safe } = match;
    const recentApplications = this.db.applications.filter(a => a.customerId === match.id).slice(0, 10);
    return { customer: safe, recentApplications };
  }

  upsertCustomer(input: any, actorUid: string): { success: boolean; customer?: any; message: string } {
    const name = String(input.name || '').trim();
    const phone10 = String(input.phone || '').replace(/[^0-9]/g, '').slice(-10);
    if (!name || phone10.length !== 10) {
      return { success: false, message: 'Customer Name and 10-digit Mobile Number are required.' };
    }

    let aadhaarMasked = input.aadhaarMasked || '';
    let aadhaarEncrypted = '';
    let aadhaarHash = '';

    if (input.aadhaarNumber) {
      const v = validateVerhoeffAadhaar(String(input.aadhaarNumber));
      if (!v.valid) {
        return { success: false, message: v.reason || 'Invalid 12-digit Aadhaar Number.' };
      }
      aadhaarMasked = maskAadhaar(v.clean);
      aadhaarEncrypted = encryptSensitive(v.clean);
      aadhaarHash = hashSensitive(v.clean);
    }

    const now = new Date().toISOString();
    if (input.id) {
      const existing = this.db.customers.find(c => c.id === input.id);
      if (existing) {
        existing.name = name;
        existing.fatherName = String(input.fatherName ?? existing.fatherName ?? '').trim();
        existing.phone = phone10;
        existing.altPhone = String(input.altPhone ?? existing.altPhone ?? '').trim();
        existing.email = String(input.email ?? existing.email ?? '').trim();
        existing.areaType = input.areaType === 'URBAN' ? 'URBAN' : 'RURAL';
        existing.state = String(input.state || existing.state || 'West Bengal');
        existing.district = String(input.district || existing.district || 'Murshidabad');
        existing.subdivision = String(input.subdivision || existing.subdivision || '');
        existing.blockOrMunicipality = String(input.blockOrMunicipality || existing.blockOrMunicipality || '');
        existing.gpOrWard = String(input.gpOrWard || existing.gpOrWard || '');
        existing.mouza = String(input.mouza || existing.mouza || '');
        existing.villageOrLocality = String(input.villageOrLocality || input.village || existing.villageOrLocality || '');
        existing.postOffice = String(input.postOffice || existing.postOffice || '');
        existing.policeStation = String(input.policeStation || existing.policeStation || '');
        existing.pinCode = String(input.pinCode || existing.pinCode || '');
        existing.address = String(input.address || existing.address || '');
        if (aadhaarEncrypted) {
          existing.aadhaarMasked = aadhaarMasked;
          existing.aadhaarEncrypted = aadhaarEncrypted;
          existing.aadhaarHash = aadhaarHash;
        }
        existing.updatedAt = now;
        this.save();
        this.logAudit('CUSTOMER_UPDATED', `Updated customer ${existing.id} (${existing.name})`, actorUid);
        const { aadhaarEncrypted: _e, aadhaarHash: _h, ...safe } = existing;
        return { success: true, customer: safe, message: 'Customer updated.' };
      }
    }

    let id = '';
    const requestedId = String(input.id || '').trim();
    if (requestedId && this.isValidGlobalReferenceId(requestedId)) {
      id = requestedId.toUpperCase();
    } else {
      id = this.generateNextId('CUST', actorUid);
    }
    const created: CustomerRecord = {
      id,
      uid: input.uid ? String(input.uid).toUpperCase() : id,
      name,
      fatherName: String(input.fatherName || '').trim(),
      phone: phone10,
      altPhone: String(input.altPhone || '').trim(),
      email: String(input.email || '').trim(),
      aadhaarMasked: aadhaarMasked || undefined,
      aadhaarEncrypted: aadhaarEncrypted || undefined,
      aadhaarHash: aadhaarHash || undefined,
      areaType: input.areaType === 'URBAN' ? 'URBAN' : 'RURAL',
      state: String(input.state || 'West Bengal'),
      district: String(input.district || 'Murshidabad'),
      subdivision: String(input.subdivision || ''),
      blockOrMunicipality: String(input.blockOrMunicipality || ''),
      gpOrWard: String(input.gpOrWard || ''),
      mouza: String(input.mouza || ''),
      villageOrLocality: String(input.villageOrLocality || input.village || ''),
      postOffice: String(input.postOffice || ''),
      policeStation: String(input.policeStation || ''),
      pinCode: String(input.pinCode || ''),
      address: String(input.address || ''),
      category: String(input.category || 'General Public'),
      jobCardNo: String(input.jobCardNo || ''),
      assignedStaffUid: String(input.assignedStaffUid || actorUid),
      remarks: String(input.remarks || ''),
      year: this.getCurrentYear(),
      createdAt: now,
      updatedAt: now,
      createdBy: actorUid
    };

    this.db.customers.unshift(created);
    this.save();
    this.logAudit('CUSTOMER_CREATED', `Registered customer ${created.id} (${created.name})`, actorUid);
    const { aadhaarEncrypted: _e, aadhaarHash: _h, ...safe } = created;
    return { success: true, customer: safe, message: `Customer ${created.id} registered.` };
  }

  mergeCustomers(sourceId: string, targetId: string, actorUid: string): { success: boolean; message: string; target?: any } {
    if (!sourceId || !targetId || sourceId === targetId) {
      return { success: false, message: 'Select two distinct customers to merge.' };
    }
    const source = this.db.customers.find(c => c.id === sourceId);
    const target = this.db.customers.find(c => c.id === targetId);
    if (!source || !target) {
      return { success: false, message: 'Source or Target customer record not found.' };
    }

    let movedApps = 0;
    for (const app of this.db.applications) {
      if (app.customerId === source.id) {
        app.customerId = target.id;
        app.customerName = target.name;
        app.updatedAt = new Date().toISOString();
        movedApps += 1;
      }
    }
    let movedDocs = 0;
    for (const doc of this.db.documents) {
      if (doc.customerId === source.id) {
        doc.customerId = target.id;
        movedDocs += 1;
      }
    }

    if (!target.fatherName && source.fatherName) target.fatherName = source.fatherName;
    if (!target.aadhaarMasked && source.aadhaarMasked) {
      target.aadhaarMasked = source.aadhaarMasked;
      target.aadhaarEncrypted = source.aadhaarEncrypted;
      target.aadhaarHash = source.aadhaarHash;
    }
    if (!target.address && source.address) target.address = source.address;
    target.updatedAt = new Date().toISOString();

    this.db.customers = this.db.customers.filter(c => c.id !== source.id);
    this.save();
    this.logAudit(
      'CUSTOMER_MERGED',
      `Merged duplicate customer ${source.id} (${source.name}) into ${target.id} (${target.name}). Moved ${movedApps} apps, ${movedDocs} docs.`,
      actorUid
    );
    const { aadhaarEncrypted: _e, aadhaarHash: _h, ...safe } = target;
    return {
      success: true,
      target: safe,
      message: `Merged ${source.id} into ${target.id} (${movedApps} applications & ${movedDocs} documents transferred).`
    };
  }

  deleteCustomer(customerId: string, actorUid: string): { success: boolean; message: string } {
    const cleanId = String(customerId || '').trim();
    const idx = this.db.customers.findIndex(c => c.id === cleanId);
    if (idx === -1) {
      return { success: false, message: 'Customer record not found.' };
    }
    const [removed] = this.db.customers.splice(idx, 1);
    this.save();
    globalReferenceEngine.markReferenceStatus(removed.id, 'DELETED', actorUid);
    this.logAudit('CUSTOMER_DELETED', `Deleted customer ${removed.id} (${removed.name})`, actorUid);
    return { success: true, message: `Customer ${removed.id} deleted.` };
  }

  // -------------------------------------------------------------------------
  // APPLICATIONS WORKFLOW & TIMELINE
  // -------------------------------------------------------------------------
  listApplications(opts?: { status?: string; staffUid?: string; customerId?: string; q?: string }) {
    let list = [...this.db.applications];
    if (opts?.status && opts.status !== 'all') {
      list = list.filter(a => a.status === opts.status);
    }
    if (opts?.staffUid) {
      list = list.filter(a => a.assignedStaffUid === opts.staffUid || a.createdBy === opts.staffUid);
    }
    if (opts?.customerId) {
      list = list.filter(a => a.customerId === opts.customerId);
    }
    if (opts?.q && opts.q.trim()) {
      const q = opts.q.trim().toLowerCase();
      list = list.filter(
        a =>
          a.id.toLowerCase().includes(q) ||
          a.refNumber.toLowerCase().includes(q) ||
          a.customerName.toLowerCase().includes(q) ||
          a.phone.includes(q) ||
          a.serviceName.toLowerCase().includes(q)
      );
    }
    return list;
  }

  createApplication(input: any, actorUid: string): { success: boolean; application?: ApplicationRecord; message: string } {
    const customerName = String(input.customerName || '').trim();
    const serviceName = String(input.serviceName || '').trim();
    const phone = String(input.phone || '').replace(/[^0-9]/g, '').slice(-10);

    if (!customerName || !serviceName) {
      return { success: false, message: 'Customer Name and Service Name are required.' };
    }

    const now = new Date().toISOString();
    const requestedId = String(input.id || '').trim();
    let id = '';
    if (requestedId && this.isValidGlobalReferenceId(requestedId)) {
      id = requestedId.toUpperCase();
    } else {
      id = this.generateNextId('CASE', actorUid);
    }
    const govFee = Math.max(0, Number(input.govFee || 0));
    const serviceCharge = Math.max(0, Number(input.serviceCharge ?? input.totalAmount ?? 0));
    const totalAmount = Number(input.totalAmount ?? govFee + serviceCharge);
    const paidAmount = Math.max(0, Number(input.paidAmount || 0));
    const dueAmount = Math.max(0, totalAmount - paidAmount);

    const record: ApplicationRecord = {
      id,
      refNumber: String(input.refNumber || id),
      customerId: String(input.customerId || ''),
      customerUid: input.customerUid ? String(input.customerUid) : undefined,
      customerName,
      phone,
      serviceId: String(input.serviceId || ''),
      serviceName,
      category: String(input.category || 'General'),
      subcategory: String(input.subcategory || serviceName),
      govFee,
      serviceCharge,
      totalAmount,
      paidAmount,
      dueAmount,
      status: (input.status as ApplicationStatus) || 'New',
      assignedStaffUid: String(input.assignedStaffUid || actorUid),
      assignedStaffName: String(input.assignedStaffName || ''),
      areaType: input.areaType,
      district: input.district,
      blockOrMunicipality: input.blockOrMunicipality,
      gpOrWard: input.gpOrWard,
      villageOrLocality: input.villageOrLocality,
      pinCode: input.pinCode,
      notes: String(input.notes || ''),
      timeline: [
        {
          timestamp: now,
          status: (input.status as ApplicationStatus) || 'New',
          actorUid,
          note: 'Application registered'
        }
      ],
      year: this.getCurrentYear(),
      createdAt: now,
      updatedAt: now,
      createdBy: actorUid
    };

    this.db.applications.unshift(record);
    this.save();
    this.logAudit('APPLICATION_CREATED', `Created application ${record.id} (${record.serviceName}) for ${record.customerName}`, actorUid, {
      applicationId: record.id
    });
    return { success: true, application: record, message: `Application ${record.id} created.` };
  }

  updateApplication(
    appId: string,
    updates: Partial<ApplicationRecord> & { timelineNote?: string },
    actorUid: string
  ): { success: boolean; application?: ApplicationRecord; message: string } {
    const app = this.db.applications.find(a => a.id === appId);
    if (!app) return { success: false, message: 'Application not found.' };

    const now = new Date().toISOString();
    const prevStatus = app.status;

    if (updates.status) app.status = updates.status;
    if (updates.assignedStaffUid !== undefined) app.assignedStaffUid = updates.assignedStaffUid;
    if (updates.assignedStaffName !== undefined) app.assignedStaffName = updates.assignedStaffName;
    if (updates.verifiedByUid !== undefined) app.verifiedByUid = updates.verifiedByUid;
    if (updates.paidAmount !== undefined) {
      app.paidAmount = Math.max(0, Number(updates.paidAmount));
      app.dueAmount = Math.max(0, app.totalAmount - app.paidAmount);
    }
    if (updates.notes !== undefined) app.notes = updates.notes;
    app.updatedAt = now;

    if (updates.status || updates.timelineNote) {
      app.timeline.unshift({
        timestamp: now,
        status: app.status,
        actorUid,
        note: updates.timelineNote || (prevStatus !== app.status ? `Status changed from ${prevStatus} to ${app.status}` : 'Updated details')
      });
    }

    this.save();
    this.logAudit('APPLICATION_UPDATED', `Updated application ${app.id} -> Status: ${app.status}`, actorUid, { applicationId: app.id });
    return { success: true, application: app, message: `Application ${app.id} updated.` };
  }

  // -------------------------------------------------------------------------
  // DOCUMENT VAULT (UPLOAD / LIST / PROTECTED DOWNLOAD)
  // -------------------------------------------------------------------------
  saveUploadedDocument(params: {
    title: string;
    category: string;
    customerId?: string;
    applicationId?: string;
    userId?: string;
    fileName: string;
    mimeType: string;
    base64Data: string;
    remarks?: string;
    expiryDate?: string;
    actorUid: string;
  }): { success: boolean; document?: DocumentVaultRecord; message: string } {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(params.mimeType)) {
      return { success: false, message: 'Only PDF, JPG, PNG, and WEBP files are allowed.' };
    }

    const base64Clean = String(params.base64Data || '').replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(base64Clean, 'base64');
    if (buf.length === 0) {
      return { success: false, message: 'Empty file upload.' };
    }
    if (buf.length > 5 * 1024 * 1024) {
      return { success: false, message: 'File exceeds maximum 5 MB limit.' };
    }

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const docId = this.generateNextId('DOC');
    const ext = params.mimeType === 'application/pdf' ? '.pdf' : params.mimeType === 'image/png' ? '.png' : params.mimeType === 'image/webp' ? '.webp' : '.jpg';
    const storedFileName = `${docId}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, storedFileName), buf);

    const now = new Date().toISOString();
    const record: DocumentVaultRecord = {
      id: docId,
      title: String(params.title || params.fileName || docId).trim(),
      category: String(params.category || 'KYC / Application Document').trim(),
      customerId: params.customerId,
      applicationId: params.applicationId,
      userId: params.userId,
      fileName: String(params.fileName || storedFileName).replace(/[^a-zA-Z0-9._-]/g, '_'),
      storedFileName,
      mimeType: params.mimeType,
      sizeBytes: buf.length,
      remarks: params.remarks || '',
      expiryDate: params.expiryDate || '',
      uploadedByUid: params.actorUid,
      year: this.getCurrentYear(),
      createdAt: now,
      updatedAt: now
    };

    this.db.documents.unshift(record);
    this.save();
    this.logAudit('DOCUMENT_UPLOADED', `Uploaded document ${record.id} (${record.title})`, params.actorUid, { docId: record.id });
    return { success: true, document: record, message: `Document ${record.id} uploaded securely.` };
  }

  listDocuments() {
    return [...this.db.documents];
  }

  getDocumentById(docId: string) {
    return this.db.documents.find(d => d.id === docId) || null;
  }

  getDocumentFilePath(doc: DocumentVaultRecord): string {
    return path.join(UPLOADS_DIR, path.basename(doc.storedFileName));
  }

  deleteDocument(docId: string, actorUid: string): { success: boolean; message: string } {
    const idx = this.db.documents.findIndex(d => d.id === docId);
    if (idx === -1) return { success: false, message: 'Document not found.' };
    const [removed] = this.db.documents.splice(idx, 1);
    const filePath = this.getDocumentFilePath(removed);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // non-blocking
      }
    }
    this.save();
    this.logAudit('DOCUMENT_DELETED', `Deleted document ${removed.id} (${removed.title})`, actorUid);
    return { success: true, message: 'Document deleted.' };
  }

  // -------------------------------------------------------------------------
  // UNIVERSAL SERVER-SIDE SEARCH & PAGINATION
  // -------------------------------------------------------------------------
  universalSearch(params: {
    q?: string;
    type?: string; // all | applications | customers | services | users | documents | locations | audit
    district?: string;
    blockOrMunicipality?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: 'relevance' | 'newest' | 'oldest' | 'name';
    page?: number;
    limit?: number;
    actorRole?: string;
  }) {
    const rawQ = String(params.q || '').trim();
    const q = rawQ.toLowerCase();
    const digitsOnly = q.replace(/[^0-9]/g, '');
    const digits10 = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
    const typeFilter = (params.type || 'all').toLowerCase();
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
    const dateFrom = params.dateFrom ? Date.parse(params.dateFrom) : null;
    const dateTo = params.dateTo ? Date.parse(params.dateTo + 'T23:59:59Z') : null;

    type SearchHit = {
      id: string;
      entityType: 'applications' | 'customers' | 'services' | 'users' | 'documents' | 'locations' | 'audit';
      title: string;
      subtitle: string;
      code: string;
      status: string;
      district?: string;
      blockOrMunicipality?: string;
      createdAt: string;
      score: number;
      meta: Record<string, any>;
    };

    const hits: SearchHit[] = [];
    const seenKeys = new Set<string>();
    const addHit = (hit: SearchHit) => {
      const dedupKey = `${hit.entityType}:${hit.id}`;
      if (seenKeys.has(dedupKey)) return;
      if (params.district && hit.district && hit.district.toLowerCase() !== params.district.toLowerCase()) return;
      if (
        params.blockOrMunicipality &&
        hit.blockOrMunicipality &&
        !hit.blockOrMunicipality.toLowerCase().includes(params.blockOrMunicipality.toLowerCase())
      ) {
        return;
      }
      if (params.status && params.status !== 'all' && hit.status.toLowerCase() !== params.status.toLowerCase()) return;
      if (dateFrom && hit.createdAt && Date.parse(hit.createdAt) < dateFrom) return;
      if (dateTo && hit.createdAt && Date.parse(hit.createdAt) > dateTo) return;
      seenKeys.add(dedupKey);
      hits.push(hit);
    };

    const matchScore = (fields: Array<string | undefined>): number => {
      if (!q) return 10;
      let best = 0;
      for (const f of fields) {
        if (!f) continue;
        const val = String(f).toLowerCase();
        if (val === q) best = Math.max(best, 100);
        else if (val.startsWith(q)) best = Math.max(best, 75);
        else if (val.includes(q)) best = Math.max(best, 50);
        else if (digitsOnly.length >= 4 && val.replace(/[^0-9]/g, '').includes(digits10 || digitsOnly)) best = Math.max(best, 65);
      }
      return best;
    };

    // 1. Applications
    if (typeFilter === 'all' || typeFilter === 'applications') {
      for (const a of this.db.applications) {
        const s = matchScore([a.id, a.refNumber, a.customerName, a.customerId, a.customerUid, a.phone, a.serviceName, a.blockOrMunicipality, a.gpOrWard, a.villageOrLocality, a.pinCode]);
        if (s > 0) {
          addHit({
            id: a.id,
            entityType: 'applications',
            title: `${a.serviceName} — ${a.customerName}`,
            subtitle: `App ID: ${a.id} · Ref: ${a.refNumber} · ₹${a.totalAmount}`,
            code: a.id,
            status: a.status,
            district: a.district || 'Murshidabad',
            blockOrMunicipality: a.blockOrMunicipality || '',
            createdAt: a.createdAt,
            score: s,
            meta: a
          });
        }
      }

      // Annapurna Yojana Applications (Ward & Village aware)
      for (const anp of this.db.annapurnaApplications || []) {
        const wardLabel = anp.wardName || anp.wardNumber || anp.gpOrWard || '';
        const s = matchScore([
          anp.id,
          anp.applicationId,
          anp.applicantName,
          anp.customerName,
          anp.customerPhone,
          anp.headOfFamily,
          anp.voterIdEpic,
          wardLabel,
          anp.village,
          anp.blockOrMunicipality,
          anp.currentStatus
        ]);
        if (s > 0) {
          addHit({
            id: anp.id || anp.applicationId,
            entityType: 'applications',
            title: `Annapurna Yojana — ${anp.applicantName || anp.customerName || 'Applicant'}`,
            subtitle: `App ID: ${anp.applicationId || anp.id} · ${[wardLabel, anp.village, anp.blockOrMunicipality].filter(Boolean).join(' / ') || 'Domkal'} · ${anp.customerPhone || '-'}`,
            code: anp.applicationId || anp.id,
            status: anp.currentStatus || 'Submitted',
            district: anp.district || 'Murshidabad',
            blockOrMunicipality: wardLabel || anp.blockOrMunicipality || '',
            createdAt: anp.createdAt || anp.applicationDate || '',
            score: s,
            meta: { ...anp, actionType: 'annapurna_app', actionId: anp.id || anp.applicationId }
          });
        }
      }
    }

    // 2. Customers
    if (typeFilter === 'all' || typeFilter === 'customers') {
      for (const c of this.db.customers) {
        const s = matchScore([c.id, c.uid, c.name, c.phone, c.villageOrLocality, c.blockOrMunicipality, c.gpOrWard, c.district, c.postOffice, c.pinCode, c.aadhaarMasked]);
        if (s > 0) {
          const { aadhaarEncrypted, aadhaarHash, ...safe } = c;
          addHit({
            id: c.id,
            entityType: 'customers',
            title: c.name,
            subtitle: `${c.id} · Mobile: ${maskPhone(c.phone)} · ${c.villageOrLocality || c.blockOrMunicipality} (${c.pinCode || '-'})`,
            code: c.id,
            status: 'ACTIVE',
            district: c.district,
            blockOrMunicipality: c.blockOrMunicipality,
            createdAt: c.createdAt,
            score: s,
            meta: safe
          });
        }
      }
    }

    // 3. Services (only user-created real service entries; never preset SEED_SERVICE or SRV-2026-000001..000107 demo records)
    if (typeFilter === 'all' || typeFilter === 'services') {
      for (const srv of this.db.services) {
        if (srv.isDeleted) continue;
        if (Array.isArray(srv.auditHistory) && srv.auditHistory.some(h => h.action === 'SEED_SERVICE')) continue;
        if (/^SRV-2026-000(0[0-9]{2}|10[0-7])$/i.test(String(srv.id || ''))) continue;
        const s = matchScore([srv.id, srv.code, srv.name, srv.category, srv.subcategory, srv.description]);
        if (s > 0) {
          addHit({
            id: srv.id,
            entityType: 'services',
            title: srv.name,
            subtitle: `${srv.category} · ${srv.id} · Fee ₹${srv.price}`,
            code: srv.id,
            status: srv.isActive ? 'ACTIVE' : 'INACTIVE',
            createdAt: srv.createdAt,
            score: s,
            meta: srv
          });
        }
      }
    }

    // 4. Users & Requests (Admin/Manager) - only when query entered or explicitly filtered to users
    if (typeFilter === 'users' || (typeFilter === 'all' && q.length > 0)) {
      const users = this.loadUsers();
      for (const u of users) {
        const s = matchScore([u.uid, u.requestId, u.name, u.phone, u.aadhaarMasked, u.role, u.address]);
        if (s > 0) {
          addHit({
            id: u.uid || u.requestId,
            entityType: 'users',
            title: `${u.name} (${u.role})`,
            subtitle: `${u.uid ? `UID: ${u.uid}` : `Req: ${u.requestId}`} · Aadhaar: ${u.aadhaarMasked || 'XXXX-XXXX-XXXX'}`,
            code: u.uid || u.requestId,
            status: u.status,
            createdAt: u.createdAt,
            score: s,
            meta: {
              requestId: u.requestId,
              uid: u.uid,
              name: u.name,
              role: u.role,
              status: u.status,
              phoneMasked: u.phoneMasked || maskPhone(u.phone),
              aadhaarMasked: u.aadhaarMasked
            }
          });
        }
      }
    }

    // 5. Documents
    if (typeFilter === 'all' || typeFilter === 'documents') {
      for (const d of this.db.documents) {
        const s = matchScore([d.id, d.title, d.category, d.fileName, d.customerId, d.applicationId]);
        if (s > 0) {
          addHit({
            id: d.id,
            entityType: 'documents',
            title: d.title,
            subtitle: `${d.id} · ${d.category} · ${d.fileName}`,
            code: d.id,
            status: 'VERIFIED',
            createdAt: d.createdAt,
            score: s,
            meta: d
          });
        }
      }
    }

    // 6. Murshidabad & Domkal Locations (only when explicitly filtering Locations tab)
    if (typeFilter === 'locations') {
      const locResults = murshidabadMaster.searchLocations(rawQ || 'Domkal', 80);
      for (const loc of locResults) {
        const s = q ? matchScore([loc.title, loc.subtitle, loc.district, loc.pinCode, loc.kind]) : 10;
        if (s > 0) {
          addHit({
            id: loc.id,
            entityType: 'locations',
            title: loc.title,
            subtitle: loc.subtitle,
            code: loc.pinCode || loc.kind,
            status: loc.verificationStatus,
            district: loc.district || 'Murshidabad',
            blockOrMunicipality: loc.subtitle,
            createdAt: '2026-01-01T00:00:00.000Z',
            score: s,
            meta: loc
          });
        }
      }
    }

    // 7. Audit logs (Admin/Manager only - only when query entered or explicitly on audit tab)
    if ((typeFilter === 'audit' || (typeFilter === 'all' && q.length > 0)) && ['ADMIN', 'MANAGER'].includes((params.actorRole || '').toUpperCase())) {
      const logs = this.loadAuditLogs().slice(0, 150);
      for (const l of logs) {
        const s = matchScore([l.action, l.details, l.uid, l.id]);
        if (s > 0) {
          addHit({
            id: l.id,
            entityType: 'audit',
            title: l.action,
            subtitle: l.details,
            code: l.uid || 'SYSTEM',
            status: 'LOGGED',
            createdAt: l.timestamp,
            score: s,
            meta: l
          });
        }
      }
    }

    const countsByType: Record<string, number> = {
      applications: 0,
      customers: 0,
      services: 0,
      users: 0,
      documents: 0,
      locations: 0,
      audit: 0
    };
    hits.forEach(h => {
      countsByType[h.entityType] = (countsByType[h.entityType] || 0) + 1;
    });

    const sortMode = params.sort || 'relevance';
    hits.sort((a, b) => {
      if (sortMode === 'newest') return Date.parse(b.createdAt || '0') - Date.parse(a.createdAt || '0');
      if (sortMode === 'oldest') return Date.parse(a.createdAt || '0') - Date.parse(b.createdAt || '0');
      if (sortMode === 'name') return a.title.localeCompare(b.title);
      return b.score - a.score;
    });

    const total = hits.length;
    const start = (page - 1) * limit;
    const paginated = hits.slice(start, start + limit);

    return {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      countsByType,
      results: paginated
    };
  }

  // -------------------------------------------------------------------------
  // BACKUP & RESTORE
  // -------------------------------------------------------------------------
  exportFullBackup(actorUid: string) {
    this.logAudit('DATABASE_BACKUP_EXPORT', `Full central database snapshot exported by ${actorUid}`, actorUid);
    return {
      exportedAt: new Date().toISOString(),
      exportedBy: actorUid,
      app: 'MUN COMPUTER — CORPORATE ERP SYSTEM (MC-ADM-14012025)',
      database: this.db,
      murshidabadMaster: murshidabadMaster.getOverview(),
      usersCount: this.loadUsers().length
    };
  }

  restoreBackup(snapshot: any, actorUid: string): { success: boolean; message: string } {
    const dbPart = snapshot?.database || snapshot;
    if (!dbPart || !Array.isArray(dbPart.services)) {
      return { success: false, message: 'Invalid central backup format.' };
    }
    try {
      this.createAutoBackupSnapshot(actorUid, 'PRE_RESTORE');
    } catch {
      // non-blocking safety snapshot
    }
    this.db = {
      countersByYear: dbPart.countersByYear || {},
      globalSerialByYear: dbPart.globalSerialByYear && typeof dbPart.globalSerialByYear === 'object'
        ? dbPart.globalSerialByYear
        : (this.db.globalSerialByYear || {}),
      services: dbPart.services || [],
      customers: dbPart.customers || [],
      applications: dbPart.applications || [],
      documents: dbPart.documents || [],
      recoveryCodes: dbPart.recoveryCodes || [],
      chats: Array.isArray(dbPart.chats) ? dbPart.chats : (this.db.chats || []),
      attendanceRecords: Array.isArray(dbPart.attendanceRecords) ? dbPart.attendanceRecords : (this.db.attendanceRecords || []),
      attendancePhotos: Array.isArray(dbPart.attendancePhotos) ? dbPart.attendancePhotos : (this.db.attendancePhotos || []),
      counterCashTxns: Array.isArray(dbPart.counterCashTxns) ? dbPart.counterCashTxns : (this.db.counterCashTxns || []),
      counterDaybook: Array.isArray(dbPart.counterDaybook) ? dbPart.counterDaybook : (this.db.counterDaybook || []),
      deleteHistory: Array.isArray(dbPart.deleteHistory) ? dbPart.deleteHistory : (this.db.deleteHistory || []),
      backupSnapshots: Array.isArray(this.db.backupSnapshots) ? this.db.backupSnapshots : [],
      followupCases: Array.isArray(dbPart.followupCases) ? dbPart.followupCases : (this.db.followupCases || []),
      annapurnaApplications: Array.isArray(dbPart.annapurnaApplications) ? dbPart.annapurnaApplications : (this.db.annapurnaApplications || []),
      extendedErp: dbPart.extendedErp && typeof dbPart.extendedErp === 'object' ? dbPart.extendedErp : (this.db.extendedErp || {}),
      menuConfig: dbPart.menuConfig && typeof dbPart.menuConfig === 'object' ? dbPart.menuConfig : (this.db.menuConfig || { departments: {}, submenus: {}, customSubmenus: [] })
    };
    this.syncCountersWithExistingData();
    this.syncGlobalSerialWithRecords();
    this.save();
    const consistency = globalReferenceEngine.verifyConsistency(true);
    this.logAudit(
      'DATABASE_BACKUP_RESTORE',
      `Central database snapshot restored by ${actorUid} (Global SL verified: last_serial=${consistency.lastSerial})`,
      actorUid
    );
    return { success: true, message: 'Central database restored safely (user auth records preserved).' };
  }

  clearOperationalData(actorUid: string): { success: boolean; message: string } {
    this.db.customers = [];
    this.db.applications = [];
    this.db.documents = [];
    this.db.recoveryCodes = [];
    this.db.chats = [];
    this.db.attendanceRecords = [];
    this.db.attendancePhotos = [];
    this.db.counterCashTxns = [];
    this.db.counterDaybook = [];
    this.db.deleteHistory = [];
    this.db.followupCases = [];
    this.db.statusHistory = [];
    this.db.followups = [];
    this.db.grievances = [];
    this.db.reminders = [];
    this.db.annapurnaApplications = [];
    this.db.gasState = {};
    this.db.teamState = { tasks: [], timeLogs: [] };
    this.db.hrState = {
      leaves: [],
      holidays: [],
      payrollRuns: [],
      payslips: [],
      recruitment: [],
      training: [],
      kpiConfig: this.db.hrState?.kpiConfig,
      kpiReviews: [],
      employeeLetters: [],
      rewardsDisciplinary: [],
      employeeProfiles: {}
    };
    this.db.extendedErp = {};
    this.save();
    this.logAudit('SYSTEM_CLEAN', `Operational data cleared to fresh clean state by ${actorUid} (service catalog, accounts, and config preserved)`, actorUid);
    return { success: true, message: 'All central operational records cleared (service catalog, accounts, and system settings preserved).' };
  }

  // -------------------------------------------------------------------------
  // TEAM COUNTER CHAT CRUD (CREATE, EDIT, DELETE)
  // -------------------------------------------------------------------------
  listChats(channel?: string): ChatMessageRecord[] {
    if (!Array.isArray(this.db.chats)) this.db.chats = [];
    let list = [...this.db.chats];
    if (channel && channel !== 'all') {
      list = list.filter(m => m.channel === channel);
    }
    list.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    return list;
  }

  createChatMessage(
    input: { channel?: string; message: string },
    actor: { uid: string; name?: string; role?: string }
  ): { success: boolean; chat?: ChatMessageRecord; message: string } {
    const cleanText = String(input.message || '').trim();
    if (!cleanText) return { success: false, message: 'Message cannot be empty.' };
    if (!Array.isArray(this.db.chats)) this.db.chats = [];

    const allowedChannels = ['general', 'services', 'customers', 'urgent'];
    const channel = (allowedChannels.includes(String(input.channel || 'general'))
      ? String(input.channel)
      : 'general') as ChatMessageRecord['channel'];

    const now = new Date().toISOString();
    const record: ChatMessageRecord = {
      id: this.generateNextId('CHT'),
      channel,
      senderUid: actor.uid,
      senderName: actor.name || actor.uid,
      senderRole: actor.role || 'STAFF',
      message: cleanText,
      createdAt: now,
      updatedAt: now,
      isEdited: false
    };
    this.db.chats.push(record);
    if (this.db.chats.length > 1000) {
      this.db.chats = this.db.chats.slice(-1000);
    }
    this.save();
    return { success: true, chat: record, message: 'Message sent.' };
  }

  editChatMessage(
    chatId: string,
    newText: string,
    actor: { uid: string; role?: string }
  ): { success: boolean; chat?: ChatMessageRecord; message: string } {
    if (!Array.isArray(this.db.chats)) this.db.chats = [];
    const target = this.db.chats.find(c => c.id === chatId);
    if (!target) return { success: false, message: 'Chat message not found.' };

    const isPrivileged = ['ADMIN', 'MANAGER'].includes(String(actor.role || '').toUpperCase());
    if (target.senderUid !== actor.uid && !isPrivileged) {
      return { success: false, message: 'You can only edit your own chat messages.' };
    }

    const clean = String(newText || '').trim();
    if (!clean) return { success: false, message: 'Updated message cannot be empty.' };

    const now = new Date().toISOString();
    target.message = clean;
    target.updatedAt = now;
    target.editedAt = now;
    target.isEdited = true;
    this.save();
    this.logAudit('CHAT_EDITED', `Edited chat message ${chatId} by ${actor.uid}`, actor.uid);
    return { success: true, chat: target, message: 'Chat message updated.' };
  }

  deleteChatMessage(
    chatId: string,
    actor: { uid: string; role?: string }
  ): { success: boolean; message: string } {
    if (!Array.isArray(this.db.chats)) this.db.chats = [];
    const idx = this.db.chats.findIndex(c => c.id === chatId);
    if (idx === -1) return { success: false, message: 'Chat message not found.' };

    const target = this.db.chats[idx];
    const isPrivileged = ['ADMIN', 'MANAGER'].includes(String(actor.role || '').toUpperCase());
    if (target.senderUid !== actor.uid && !isPrivileged) {
      return { success: false, message: 'You can only delete your own chat messages.' };
    }

    this.db.chats.splice(idx, 1);
    this.save();
    globalReferenceEngine.markReferenceStatus(chatId, 'DELETED', actor.uid);
    this.logAudit('CHAT_DELETED', `Deleted chat message ${chatId} by ${actor.uid}`, actor.uid);
    return { success: true, message: 'Chat message deleted.' };
  }

  // -------------------------------------------------------------------------
  // DELETE REASON & PERMANENT DELETE HISTORY
  // -------------------------------------------------------------------------
  recordDeleteHistory(entry: Omit<DeleteHistoryRecord, 'id' | 'deletedAt'>): DeleteHistoryRecord {
    if (!Array.isArray(this.db.deleteHistory)) this.db.deleteHistory = [];
    const record: DeleteHistoryRecord = {
      id: this.generateHousekeepingId('DEL'),
      deletedAt: new Date().toISOString(),
      ...entry
    };
    this.db.deleteHistory.unshift(record);
    if (this.db.deleteHistory.length > 1000) this.db.deleteHistory.length = 1000;
    this.save();
    this.logAudit(
      'DELETE_WITH_REASON',
      `[${record.targetType}] Deleted ${record.targetId} (${record.targetSummary}) by ${record.deletedByUid}. Reason: ${record.reason}`,
      record.deletedByUid,
      { deleteHistoryId: record.id, targetType: record.targetType, targetId: record.targetId, reason: record.reason }
    );
    return record;
  }

  listDeleteHistory(targetType?: string): DeleteHistoryRecord[] {
    if (!Array.isArray(this.db.deleteHistory)) this.db.deleteHistory = [];
    let list = [...this.db.deleteHistory];
    if (targetType && targetType !== 'ALL') {
      list = list.filter(d => d.targetType === targetType);
    }
    return list;
  }

  // -------------------------------------------------------------------------
  // ATTENDANCE RECORDS & MANDATORY ATTENDANCE PHOTO GALLERY STORAGE
  // -------------------------------------------------------------------------
  listAttendanceRecords(filters?: { date?: string; month?: string; staffId?: string }): AttendanceRecordServer[] {
    if (!Array.isArray(this.db.attendanceRecords)) this.db.attendanceRecords = [];
    let list = [...this.db.attendanceRecords];
    if (filters?.date) list = list.filter(r => r.date === filters.date);
    if (filters?.month) list = list.filter(r => String(r.date || '').startsWith(filters.month!));
    if (filters?.staffId && filters.staffId !== 'all') {
      list = list.filter(r => String(r.staffId || '').toUpperCase() === filters.staffId!.toUpperCase());
    }
    list.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : Date.parse(b.updatedAt || '0') - Date.parse(a.updatedAt || '0')));
    return list;
  }

  upsertAttendanceRecord(input: Partial<AttendanceRecordServer>, actorUid: string): AttendanceRecordServer {
    if (!Array.isArray(this.db.attendanceRecords)) this.db.attendanceRecords = [];
    const date = String(input.date || getKolkataDateParts().isoDate);
    const staffId = String(input.staffId || '').trim().toUpperCase();
    const existingIdx = this.db.attendanceRecords.findIndex(
      r => (input.id && r.id === input.id) || (r.date === date && String(r.staffId || '').toUpperCase() === staffId)
    );
    const prev = existingIdx !== -1 ? this.db.attendanceRecords[existingIdx] : ({} as Partial<AttendanceRecordServer>);
    const requestedAttId = String(input.id || prev.id || '').trim();
    if (requestedAttId && this.parseGlobalSerialId(requestedAttId)) {
      this.syncGlobalSerialFloor(requestedAttId);
    }
    const record: AttendanceRecordServer = {
      id: requestedAttId || this.generateNextId('ATT'),
      date,
      staffId,
      staffName: String(input.staffName || prev.staffName || staffId),
      role: String(input.role || prev.role || 'Staff'),
      status: String(input.status || prev.status || 'Present'),
      inTime24: String(input.inTime24 ?? prev.inTime24 ?? ''),
      outTime24: String(input.outTime24 ?? prev.outTime24 ?? ''),
      clockIn: String(input.clockIn ?? prev.clockIn ?? '-'),
      clockOut: String(input.clockOut ?? prev.clockOut ?? '-'),
      workingMinutes: Number(input.workingMinutes ?? prev.workingMinutes ?? 0),
      workingHoursLabel: String(input.workingHoursLabel ?? prev.workingHoursLabel ?? '0h 00m'),
      lateMinutes: Number(input.lateMinutes ?? prev.lateMinutes ?? 0),
      lateEntry: Boolean(input.lateEntry ?? prev.lateEntry),
      lateLabel: String(input.lateLabel ?? prev.lateLabel ?? '-'),
      earlyLeaveMinutes: Number(input.earlyLeaveMinutes ?? prev.earlyLeaveMinutes ?? 0),
      earlyLeave: Boolean(input.earlyLeave ?? prev.earlyLeave),
      earlyLeaveLabel: String(input.earlyLeaveLabel ?? prev.earlyLeaveLabel ?? '-'),
      overtimeMinutes: Number(input.overtimeMinutes ?? prev.overtimeMinutes ?? 0),
      overtimeLabel: String(input.overtimeLabel ?? prev.overtimeLabel ?? '0h 00m'),
      inGpsLat: input.inGpsLat ?? prev.inGpsLat ?? null,
      inGpsLng: input.inGpsLng ?? prev.inGpsLng ?? null,
      outGpsLat: input.outGpsLat ?? prev.outGpsLat ?? null,
      outGpsLng: input.outGpsLng ?? prev.outGpsLng ?? null,
      inPhotoId: input.inPhotoId ?? prev.inPhotoId,
      outPhotoId: input.outPhotoId ?? prev.outPhotoId,
      notes: String(input.notes ?? prev.notes ?? ''),
      updatedByUid: actorUid,
      updatedAt: new Date().toISOString()
    };
    if (existingIdx !== -1) this.db.attendanceRecords[existingIdx] = record;
    else this.db.attendanceRecords.unshift(record);
    this.save();
    return record;
  }

  saveAttendancePhoto(params: {
    staffId: string;
    staffName: string;
    staffRole: string;
    eventType: 'IN' | 'OUT';
    date?: string;
    time24?: string;
    time12?: string;
    istTimestamp?: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    photoDataUrl: string;
    captureMethod?: string;
    gpsVerifiedLive?: boolean;
    gpsMatchDistanceMeters?: number;
    photoCapturedAt?: string;
    gpsCapturedAt?: string;
    consentAccepted: boolean;
    notes?: string;
    actorUid: string;
  }): { success: boolean; photo?: AttendancePhotoRecord; message: string } {
    if (!params.consentAccepted) {
      return { success: false, message: 'Employee consent for GPS & Live Camera capture is mandatory.' };
    }
    if (params.captureMethod !== 'LIVE_CAMERA') {
      return { success: false, message: 'Manual/gallery photo uploads are disabled. Live Camera capture is mandatory.' };
    }
    if (params.gpsVerifiedLive !== true) {
      return { success: false, message: 'Live GPS verification is mandatory before saving attendance.' };
    }
    const lat = Number(params.latitude);
    const lng = Number(params.longitude);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      (lat === 0 && lng === 0)
    ) {
      return { success: false, message: 'Valid live GPS Latitude & Longitude required.' };
    }
    const rawDataUrl = String(params.photoDataUrl || '');
    const match = rawDataUrl.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/i);
    if (!match) {
      return { success: false, message: 'Valid captured photo image (JPEG/PNG/WEBP) is required.' };
    }
    const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const buffer = Buffer.from(match[3], 'base64');
    if (buffer.length > 3 * 1024 * 1024) {
      return { success: false, message: 'Captured photo exceeds 3MB limit.' };
    }

    if (!fs.existsSync(ATTENDANCE_PHOTOS_DIR)) fs.mkdirSync(ATTENDANCE_PHOTOS_DIR, { recursive: true });
    if (!Array.isArray(this.db.attendancePhotos)) this.db.attendancePhotos = [];

    const id = this.generateNextId('PH');
    const storedFileName = `${id}.${ext}`;
    fs.writeFileSync(path.join(ATTENDANCE_PHOTOS_DIR, storedFileName), buffer);

    const now = new Date();
    const date = params.date || getKolkataDateParts(now).isoDate;
    const time24 =
      params.time24 ||
      now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
    const time12 =
      params.time12 ||
      now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    const istTimestamp =
      params.istTimestamp ||
      now.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

    const record: AttendancePhotoRecord = {
      id,
      staffId: String(params.staffId || params.actorUid).trim().toUpperCase(),
      staffName: String(params.staffName || 'Staff Member').trim(),
      staffRole: String(params.staffRole || 'STAFF').trim(),
      eventType: params.eventType === 'OUT' ? 'OUT' : 'IN',
      date,
      time24,
      time12,
      istTimestamp,
      timestampIso: now.toISOString(),
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      accuracy: Math.round(Number(params.accuracy) || 0),
      mapsUrl: `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`,
      storedFileName,
      mimeType,
      sizeBytes: buffer.length,
      consentAccepted: true,
      captureMethod: 'LIVE_CAMERA',
      gpsVerifiedLive: true,
      gpsMatchDistanceMeters: Number(params.gpsMatchDistanceMeters) || 0,
      photoCapturedAt: params.photoCapturedAt || now.toISOString(),
      gpsCapturedAt: params.gpsCapturedAt || now.toISOString(),
      verifiedStatus: 'PENDING',
      notes: String(params.notes || '').trim(),
      createdByUid: params.actorUid,
      createdAt: now.toISOString()
    };

    this.db.attendancePhotos.unshift(record);
    this.save();
    this.logAudit(
      'ATTENDANCE_PHOTO_SAVED',
      `Saved ${record.eventType === 'IN' ? 'Morning In' : 'Evening Out'} photo ${record.id} for ${record.staffName} (${record.staffId}) at GPS ${record.latitude},${record.longitude}`,
      params.actorUid,
      { photoId: record.id, staffId: record.staffId, eventType: record.eventType }
    );
    return { success: true, photo: record, message: 'Attendance photo & GPS captured securely.' };
  }

  listAttendancePhotos(filters?: {
    date?: string;
    fromDate?: string;
    toDate?: string;
    staffId?: string;
    eventType?: string;
    q?: string;
  }): AttendancePhotoRecord[] {
    if (!Array.isArray(this.db.attendancePhotos)) this.db.attendancePhotos = [];
    let list = [...this.db.attendancePhotos];
    if (filters?.date) list = list.filter(p => p.date === filters.date);
    if (filters?.fromDate) list = list.filter(p => p.date >= filters.fromDate!);
    if (filters?.toDate) list = list.filter(p => p.date <= filters.toDate!);
    if (filters?.staffId && filters.staffId !== 'all') {
      list = list.filter(p => String(p.staffId || '').toUpperCase() === filters.staffId!.toUpperCase());
    }
    if (filters?.eventType && filters.eventType !== 'ALL') {
      list = list.filter(p => p.eventType === filters.eventType);
    }
    if (filters?.q && filters.q.trim()) {
      const q = filters.q.trim().toLowerCase();
      list = list.filter(p =>
        [p.id, p.staffId, p.staffName, p.date, p.notes, `${p.latitude},${p.longitude}`]
          .some(v => String(v || '').toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => Date.parse(b.createdAt || '0') - Date.parse(a.createdAt || '0'));
    return list;
  }

  getAttendancePhotoById(id: string): AttendancePhotoRecord | null {
    if (!Array.isArray(this.db.attendancePhotos)) return null;
    return this.db.attendancePhotos.find(p => p.id === id) || null;
  }

  getAttendancePhotoFilePath(record: AttendancePhotoRecord): string {
    return path.join(ATTENDANCE_PHOTOS_DIR, path.basename(record.storedFileName));
  }

  verifyAttendancePhoto(
    id: string,
    actorUid: string,
    verifiedStatus: 'VERIFIED' | 'FLAGGED' | 'PENDING',
    notes?: string
  ): { success: boolean; photo?: AttendancePhotoRecord; message: string } {
    if (!Array.isArray(this.db.attendancePhotos)) this.db.attendancePhotos = [];
    const target = this.db.attendancePhotos.find(p => p.id === id);
    if (!target) return { success: false, message: 'Attendance photo not found.' };
    target.verifiedStatus = verifiedStatus;
    target.verifiedByUid = actorUid;
    target.verifiedAt = new Date().toISOString();
    if (notes !== undefined) target.verificationNotes = String(notes).trim();
    this.save();
    this.logAudit(
      'ATTENDANCE_PHOTO_VERIFIED',
      `Marked photo ${target.id} (${target.staffName} · ${target.staffId}) as ${verifiedStatus}`,
      actorUid,
      { photoId: target.id, verifiedStatus }
    );
    return { success: true, photo: target, message: `Attendance photo marked as ${verifiedStatus}.` };
  }

  deleteAttendancePhoto(
    id: string,
    actorUid: string,
    actorName: string,
    reason: string
  ): { success: boolean; message: string; deleteRecord?: DeleteHistoryRecord } {
    if (!Array.isArray(this.db.attendancePhotos)) this.db.attendancePhotos = [];
    const cleanReason = String(reason || '').trim();
    if (cleanReason.length < 3) {
      return { success: false, message: 'Mandatory Delete Reason (min 3 characters) is required to delete an Attendance Photo.' };
    }
    const idx = this.db.attendancePhotos.findIndex(p => p.id === id);
    if (idx === -1) return { success: false, message: 'Attendance photo not found.' };

    const [removed] = this.db.attendancePhotos.splice(idx, 1);
    const filePath = this.getAttendancePhotoFilePath(removed);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // non-blocking
      }
    }
    const deleteRecord = this.recordDeleteHistory({
      targetType: 'ATTENDANCE_PHOTO',
      targetId: removed.id,
      targetSummary: `${removed.staffName} (${removed.staffId}) · ${removed.eventType === 'IN' ? 'Morning In' : 'Evening Out'} Photo on ${removed.date} (${removed.time12})`,
      reason: cleanReason,
      deletedByUid: actorUid,
      deletedByName: actorName,
      metadata: {
        staffId: removed.staffId,
        staffName: removed.staffName,
        date: removed.date,
        eventType: removed.eventType,
        latitude: removed.latitude,
        longitude: removed.longitude
      }
    });
    globalReferenceEngine.markReferenceStatus(removed.id, 'DELETED', actorUid);
    this.save();
    return { success: true, message: 'Attendance photo deleted and permanently logged with Delete Reason.', deleteRecord };
  }

  // -------------------------------------------------------------------------
  // COUNTER DAY BOOK SERVER LEDGER (WITH ACTOR AUDIT & DELETE HISTORY)
  // -------------------------------------------------------------------------
  listCounterCashTxns(filters?: { date?: string; fromDate?: string; toDate?: string }): CounterCashTxnServer[] {
    if (!Array.isArray(this.db.counterCashTxns)) this.db.counterCashTxns = [];
    let list = [...this.db.counterCashTxns];
    if (filters?.date) list = list.filter(t => t.date === filters.date);
    if (filters?.fromDate) list = list.filter(t => t.date >= filters.fromDate!);
    if (filters?.toDate) list = list.filter(t => t.date <= filters.toDate!);
    list.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : Date.parse(b.createdAt || '0') - Date.parse(a.createdAt || '0')));
    return list;
  }

  addCounterCashTxn(input: Partial<CounterCashTxnServer>, actor: { uid: string; name: string }): CounterCashTxnServer {
    if (!Array.isArray(this.db.counterCashTxns)) this.db.counterCashTxns = [];
    const now = new Date();
    const requestedTxnId = String(input.id || '').trim();
    if (requestedTxnId && this.parseGlobalSerialId(requestedTxnId)) {
      this.syncGlobalSerialFloor(requestedTxnId);
    }
    const record: CounterCashTxnServer = {
      id: requestedTxnId || this.generateNextId('TXN'),
      date: String(input.date || getKolkataDateParts(now).isoDate),
      time: String(
        input.time ||
          now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
      ),
      type: (input.type as CounterCashTxnServer['type']) || 'CASH_RECEIVED',
      partyName: String(input.partyName || 'Counter Entry').trim(),
      amount: Math.max(0, Number(input.amount) || 0),
      reference: String(input.reference || '').trim(),
      notes: String(input.notes || '').trim(),
      actorUid: actor.uid,
      actorName: actor.name,
      createdAt: now.toISOString()
    };
    this.db.counterCashTxns.unshift(record);
    this.save();
    this.logAudit(
      'COUNTER_CASH_TXN',
      `${record.type} ₹${record.amount} on ${record.date} (${record.partyName}, Ref: ${record.reference || 'N/A'}) by ${actor.name} (${actor.uid})`,
      actor.uid,
      { txnId: record.id, amount: record.amount, type: record.type }
    );
    return record;
  }

  deleteCounterCashTxn(
    id: string,
    actorUid: string,
    actorName: string,
    reason: string
  ): { success: boolean; message: string } {
    if (!Array.isArray(this.db.counterCashTxns)) this.db.counterCashTxns = [];
    const cleanReason = String(reason || '').trim();
    if (cleanReason.length < 3) {
      return { success: false, message: 'Delete Reason (minimum 3 characters) is required.' };
    }
    const idx = this.db.counterCashTxns.findIndex(t => t.id === id);
    if (idx === -1) return { success: false, message: 'Counter cash entry not found.' };
    const [removed] = this.db.counterCashTxns.splice(idx, 1);
    this.recordDeleteHistory({
      targetType: 'COUNTER_CASH_TXN',
      targetId: removed.id,
      targetSummary: `${removed.type} ₹${removed.amount} on ${removed.date} (${removed.partyName})`,
      reason: cleanReason,
      deletedByUid: actorUid,
      deletedByName: actorName
    });
    globalReferenceEngine.markReferenceStatus(removed.id, 'DELETED', actorUid);
    this.save();
    return { success: true, message: 'Counter cash entry deleted with audit reason.' };
  }

  listCounterDaybookSnapshots(filters?: { date?: string; fromDate?: string; toDate?: string }): CounterDaybookSnapshot[] {
    if (!Array.isArray(this.db.counterDaybook)) this.db.counterDaybook = [];
    let list = [...this.db.counterDaybook];
    if (filters?.date) list = list.filter(d => d.date === filters.date);
    if (filters?.fromDate) list = list.filter(d => d.date >= filters.fromDate!);
    if (filters?.toDate) list = list.filter(d => d.date <= filters.toDate!);
    list.sort((a, b) => (b.date > a.date ? 1 : -1));
    return list;
  }

  saveCounterDaybookSnapshot(input: Partial<CounterDaybookSnapshot>, actor: { uid: string; name: string }): CounterDaybookSnapshot {
    if (!Array.isArray(this.db.counterDaybook)) this.db.counterDaybook = [];
    const date = String(input.date || getKolkataDateParts().isoDate);
    const idx = this.db.counterDaybook.findIndex(d => d.date === date);
    const prev = idx !== -1 ? this.db.counterDaybook[idx] : ({} as Partial<CounterDaybookSnapshot>);
    const expectedClosing = Number(input.expectedClosing ?? prev.expectedClosing ?? 0);
    const countedPhysicalCash = Number(input.countedPhysicalCash ?? input.closingCash ?? prev.countedPhysicalCash ?? expectedClosing);
    const difference = countedPhysicalCash - expectedClosing;
    const requestedDybId = String(input.id || prev.id || '').trim();
    if (requestedDybId && this.parseGlobalSerialId(requestedDybId)) {
      this.syncGlobalSerialFloor(requestedDybId);
    }
    const snap: CounterDaybookSnapshot = {
      id: requestedDybId || this.generateNextId('DYB'),
      date,
      previousDayBalance: Number(input.previousDayBalance ?? prev.previousDayBalance ?? 0),
      openingCash: Number(input.openingCash ?? prev.openingCash ?? 0),
      openingSaved: Boolean(input.openingSaved ?? prev.openingSaved ?? true),
      openingDenominations: input.openingDenominations || prev.openingDenominations,
      openingNotes: String(input.openingNotes ?? prev.openingNotes ?? ''),
      cashReceived: Number(input.cashReceived ?? prev.cashReceived ?? 0),
      cashPayment: Number(input.cashPayment ?? prev.cashPayment ?? 0),
      cashDeposit: Number(input.cashDeposit ?? prev.cashDeposit ?? 0),
      cashWithdrawal: Number(input.cashWithdrawal ?? prev.cashWithdrawal ?? 0),
      expectedClosing,
      countedPhysicalCash,
      closingCash: countedPhysicalCash,
      closingSaved: Boolean(input.closingSaved ?? prev.closingSaved ?? false),
      difference,
      status: String(input.status || (difference === 0 ? 'Balanced' : difference > 0 ? 'Excess Cash' : 'Cash Shortage')),
      denominations: input.denominations || prev.denominations,
      verifiedBy: actor.name,
      verifiedByUid: actor.uid,
      notes: String(input.notes ?? prev.notes ?? ''),
      updatedAt: new Date().toISOString()
    };
    if (idx !== -1) this.db.counterDaybook[idx] = snap;
    else this.db.counterDaybook.unshift(snap);
    this.save();
    this.logAudit(
      snap.closingSaved ? 'DAILY_CLOSING_CASH' : 'DAILY_OPENING_CASH',
      `DayBook ${date} saved by ${actor.name} (${actor.uid}): Opening ₹${snap.openingCash}, Closing ₹${snap.closingCash}, Diff ₹${snap.difference} (${snap.status})`,
      actor.uid
    );
    return snap;
  }

  // -------------------------------------------------------------------------
  // AUTOMATIC BACKUP SNAPSHOT ENGINE
  // -------------------------------------------------------------------------
  createAutoBackupSnapshot(actorUid: string, triggerType: 'AUTO' | 'MANUAL' | 'PRE_RESTORE' = 'MANUAL'): AutoBackupSnapshotMeta {
    if (!fs.existsSync(AUTO_BACKUPS_DIR)) fs.mkdirSync(AUTO_BACKUPS_DIR, { recursive: true });
    if (!Array.isArray(this.db.backupSnapshots)) this.db.backupSnapshots = [];

    const now = new Date();
    const id = this.generateHousekeepingId('BKP');
    const fileName = `${id}.json`;
    const users = this.loadUsers();
    const payload = {
      id,
      createdAt: now.toISOString(),
      triggerType,
      actorUid,
      app: 'MUN COMPUTER — CENTRAL AUTHORITY',
      database: this.db,
      usersCount: users.length,
      murshidabadMaster: murshidabadMaster.getOverview()
    };
    const jsonText = JSON.stringify(payload, null, 2);
    const fullPath = path.join(AUTO_BACKUPS_DIR, fileName);
    fs.writeFileSync(fullPath, jsonText, 'utf-8');

    const meta: AutoBackupSnapshotMeta = {
      id,
      fileName,
      createdAt: payload.createdAt,
      triggerType,
      actorUid,
      sizeBytes: Buffer.byteLength(jsonText, 'utf-8'),
      counts: {
        services: this.db.services.length,
        customers: this.db.customers.length,
        applications: this.db.applications.length,
        attendancePhotos: (this.db.attendancePhotos || []).length,
        users: users.length
      }
    };

    this.db.backupSnapshots.unshift(meta);
    // Keep latest 30 automatic snapshots on disk
    while (this.db.backupSnapshots.length > 30) {
      const oldest = this.db.backupSnapshots.pop();
      if (oldest) {
        const oldPath = path.join(AUTO_BACKUPS_DIR, path.basename(oldest.fileName));
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
        }
      }
    }
    this.save();
    this.logAudit('AUTO_BACKUP_CREATED', `${triggerType} backup snapshot ${id} saved by ${actorUid}`, actorUid, { backupId: id });
    return meta;
  }

  listBackupSnapshots(): AutoBackupSnapshotMeta[] {
    if (!Array.isArray(this.db.backupSnapshots)) this.db.backupSnapshots = [];
    return [...this.db.backupSnapshots];
  }

  getBackupSnapshotFilePath(id: string): string | null {
    const meta = (this.db.backupSnapshots || []).find(b => b.id === id);
    if (!meta) return null;
    const p = path.join(AUTO_BACKUPS_DIR, path.basename(meta.fileName));
    return fs.existsSync(p) ? p : null;
  }

  // -------------------------------------------------------------------------
  // 90-DAY FOLLOW-UP CASES, DYNAMIC ADMIN OPTIONS, SCHEDULES, STATUS HISTORY & GRIEVANCES
  // -------------------------------------------------------------------------
  private ensure90DayDefaultSeeds(): void {
    if (!Array.isArray(this.db.adminOptions)) this.db.adminOptions = [];
    if (!Array.isArray(this.db.followupSchedules)) this.db.followupSchedules = [];
    if (!Array.isArray(this.db.statusHistory)) this.db.statusHistory = [];
    if (!Array.isArray(this.db.followups)) this.db.followups = [];
    if (!Array.isArray(this.db.grievances)) this.db.grievances = [];
    if (!Array.isArray(this.db.reminders)) this.db.reminders = [];
  }

  get90DayBootstrap(): Record<string, any> {
    this.ensure90DayDefaultSeeds();
    return {
      adminOptions: this.listAdminOptions(undefined, true),
      followupSchedules: this.listFollowupSchedules(true),
      followupCases: this.listFollowupCases(),
      statusHistory: this.listStatusHistory(),
      followups: this.listFollowups(),
      grievances: this.listGrievances(),
      reminders: this.listReminders()
    };
  }

  listAdminOptions(category?: string, includeInactive = true): AdminOptionRecord[] {
    this.ensure90DayDefaultSeeds();
    return (this.db.adminOptions || [])
      .filter(o => !o.isDeleted)
      .filter(o => !category || o.category === category)
      .filter(o => includeInactive || o.isActive)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.label.localeCompare(b.label));
  }

  upsertAdminOption(
    input: Partial<AdminOptionRecord> & { category: AdminOptionCategory; label: string },
    actorUid: string
  ): { success: boolean; option?: AdminOptionRecord; message?: string } {
    this.ensure90DayDefaultSeeds();
    const label = String(input.label || '').trim();
    const category = input.category;
    if (!category || !label) {
      return { success: false, message: 'Category and option label are required.' };
    }
    const nowIso = new Date().toISOString();
    const list = this.db.adminOptions!;

    if (input.id) {
      const idx = list.findIndex(o => o.id === input.id);
      if (idx !== -1) {
        const dup = list.find(
          o => !o.isDeleted && o.id !== input.id && o.category === category && o.label.toLowerCase() === label.toLowerCase()
        );
        if (dup) {
          return { success: false, message: `"${label}" already exists in ${category}.` };
        }
        list[idx] = {
          ...list[idx],
          label,
          category,
          sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : list[idx].sortOrder,
          isActive: typeof input.isActive === 'boolean' ? input.isActive : list[idx].isActive,
          meta: input.meta ? { ...(list[idx].meta || {}), ...input.meta } : list[idx].meta,
          updatedAt: nowIso,
          updatedByUid: actorUid
        };
        this.save();
        this.logAudit('ADMIN_OPTION_UPDATE', `Updated ${category} option "${label}" (${list[idx].id}) by ${actorUid}`, actorUid);
        return { success: true, option: list[idx] };
      }
    }

    const existingDup = list.find(
      o => !o.isDeleted && o.category === category && o.label.toLowerCase() === label.toLowerCase()
    );
    if (existingDup) {
      if (!existingDup.isActive) {
        existingDup.isActive = true;
        existingDup.updatedAt = nowIso;
        existingDup.updatedByUid = actorUid;
        this.save();
        return { success: true, option: existingDup };
      }
      return { success: false, message: `"${label}" already exists in ${category}.` };
    }

    const maxSort = list.filter(o => o.category === category).reduce((m, o) => Math.max(m, o.sortOrder || 0), 0);
    const created: AdminOptionRecord = {
      id: this.generateNextId('FLW', actorUid),
      category,
      label,
      sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : maxSort + 1,
      isActive: input.isActive !== false,
      isDeleted: false,
      isDefault: false,
      meta: input.meta || {},
      createdAt: nowIso,
      updatedAt: nowIso,
      createdByUid: actorUid,
      updatedByUid: actorUid
    };
    list.push(created);
    this.save();
    this.logAudit('ADMIN_OPTION_ADD', `Added ${category} option "${label}" by ${actorUid}`, actorUid);
    return { success: true, option: created };
  }

  toggleAdminOptionActive(id: string, actorUid: string): { success: boolean; option?: AdminOptionRecord; message?: string } {
    this.ensure90DayDefaultSeeds();
    const target = this.db.adminOptions!.find(o => o.id === id && !o.isDeleted);
    if (!target) return { success: false, message: 'Option not found.' };
    target.isActive = !target.isActive;
    target.updatedAt = new Date().toISOString();
    target.updatedByUid = actorUid;
    this.save();
    this.logAudit(
      'ADMIN_OPTION_TOGGLE',
      `${target.isActive ? 'Activated' : 'Deactivated'} ${target.category} option "${target.label}" by ${actorUid}`,
      actorUid
    );
    return { success: true, option: target };
  }

  private isOptionReferenced(option: AdminOptionRecord): boolean {
    const val = option.label.toLowerCase();
    const cases = this.db.followupCases || [];
    if (cases.some(c =>
      String(c.currentStatus || '').toLowerCase() === val ||
      String(c.schemeName || '').toLowerCase() === val ||
      String(c.customerType || '').toLowerCase() === val ||
      String(c.priority || '').toLowerCase() === val ||
      String(c.pendingReason || '').toLowerCase() === val ||
      (Array.isArray(c.services) && c.services.some((s: string) => String(s).toLowerCase() === val))
    )) {
      return true;
    }
    if ((this.db.statusHistory || []).some(h => String(h.newStatus || '').toLowerCase() === val || String(h.previousStatus || '').toLowerCase() === val)) {
      return true;
    }
    if ((this.db.followups || []).some(f =>
      String(f.contactMethod || '').toLowerCase() === val ||
      String(f.customerResponse || '').toLowerCase() === val ||
      String(f.actionTaken || '').toLowerCase() === val ||
      String(f.followupResult || '').toLowerCase() === val ||
      String(f.pendingReason || '').toLowerCase() === val ||
      String(f.customerFeedback || '').toLowerCase() === val
    )) {
      return true;
    }
    if ((this.db.grievances || []).some(g => String(g.portal || '').toLowerCase() === val || String(g.status || '').toLowerCase() === val)) {
      return true;
    }
    return false;
  }

  deleteAdminOption(id: string, actorUid: string): { success: boolean; softDeleted?: boolean; message: string } {
    this.ensure90DayDefaultSeeds();
    const idx = this.db.adminOptions!.findIndex(o => o.id === id && !o.isDeleted);
    if (idx === -1) return { success: false, message: 'Option not found.' };
    const target = this.db.adminOptions![idx];
    const referenced = this.isOptionReferenced(target);
    if (referenced || target.isDefault) {
      target.isActive = false;
      target.isDeleted = true;
      target.updatedAt = new Date().toISOString();
      target.updatedByUid = actorUid;
      this.save();
      this.logAudit('ADMIN_OPTION_ARCHIVE', `Archived referenced/default ${target.category} option "${target.label}" by ${actorUid}`, actorUid);
      return { success: true, softDeleted: true, message: `"${target.label}" deactivated & archived to protect historical records.` };
    }
    this.db.adminOptions!.splice(idx, 1);
    this.save();
    this.logAudit('ADMIN_OPTION_DELETE', `Deleted ${target.category} option "${target.label}" by ${actorUid}`, actorUid);
    return { success: true, softDeleted: false, message: `"${target.label}" deleted.` };
  }

  restoreDefaultAdminOptions(category: string | undefined, actorUid: string): { success: boolean; restoredCount: number; options: AdminOptionRecord[] } {
    this.ensure90DayDefaultSeeds();
    const nowIso = new Date().toISOString();
    let restoredCount = 0;
    const seeds = category ? DEFAULT_ADMIN_OPTION_SEEDS.filter(s => s.category === category) : DEFAULT_ADMIN_OPTION_SEEDS;

    seeds.forEach((seed, idx) => {
      const existing = this.db.adminOptions!.find(
        o => o.category === seed.category && o.label.toLowerCase() === seed.label.toLowerCase()
      );
      if (existing) {
        if (!existing.isActive || existing.isDeleted) {
          existing.isActive = true;
          existing.isDeleted = false;
          existing.updatedAt = nowIso;
          existing.updatedByUid = actorUid;
          restoredCount++;
        }
      } else {
        this.db.adminOptions!.push({
          id: `OPT-${seed.category.toUpperCase()}-${String(idx + 1).padStart(3, '0')}-${Date.now().toString(36).slice(-3)}`,
          category: seed.category,
          label: seed.label,
          sortOrder: idx + 1,
          isActive: true,
          isDeleted: false,
          isDefault: true,
          meta: seed.meta || {},
          createdAt: nowIso,
          updatedAt: nowIso,
          createdByUid: actorUid
        });
        restoredCount++;
      }
    });

    this.save();
    this.logAudit('ADMIN_OPTIONS_RESTORE', `Restored defaults${category ? ` for ${category}` : ''} (${restoredCount} items) by ${actorUid}`, actorUid);
    return { success: true, restoredCount, options: this.listAdminOptions(category, true) };
  }

  listFollowupSchedules(includeInactive = true): FollowupScheduleMilestoneRecord[] {
    this.ensure90DayDefaultSeeds();
    return (this.db.followupSchedules || [])
      .filter(s => !s.isDeleted)
      .filter(s => includeInactive || s.isActive)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.day - b.day);
  }

  upsertFollowupScheduleMilestone(
    input: Partial<FollowupScheduleMilestoneRecord> & { day: number; title: string },
    actorUid: string
  ): { success: boolean; milestone?: FollowupScheduleMilestoneRecord; message?: string } {
    this.ensure90DayDefaultSeeds();
    const day = Number(input.day);
    const title = String(input.title || '').trim();
    if (isNaN(day) || day < 0 || !title) {
      return { success: false, message: 'Valid milestone day (>= 0) and title are required.' };
    }
    const nowIso = new Date().toISOString();
    const list = this.db.followupSchedules!;

    if (input.id) {
      const idx = list.findIndex(s => s.id === input.id);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          day,
          title,
          description: input.description !== undefined ? String(input.description || '').trim() : list[idx].description,
          sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : list[idx].sortOrder,
          isActive: typeof input.isActive === 'boolean' ? input.isActive : list[idx].isActive,
          updatedAt: nowIso
        };
        this.save();
        this.logAudit('SCHEDULE_MILESTONE_UPDATE', `Updated Day ${day} "${title}" by ${actorUid}`, actorUid);
        return { success: true, milestone: list[idx] };
      }
    }

    const maxSort = list.reduce((m, s) => Math.max(m, s.sortOrder || 0), 0);
    const created: FollowupScheduleMilestoneRecord = {
      id: this.generateNextId('FLW', actorUid),
      day,
      title,
      description: String(input.description || '').trim(),
      sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : maxSort + 1,
      isActive: input.isActive !== false,
      isDeleted: false,
      isDefault: false,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    list.push(created);
    this.save();
    this.logAudit('SCHEDULE_MILESTONE_ADD', `Added follow-up milestone Day ${day} "${title}" by ${actorUid}`, actorUid);
    return { success: true, milestone: created };
  }

  toggleFollowupScheduleMilestone(id: string, actorUid: string): { success: boolean; milestone?: FollowupScheduleMilestoneRecord; message?: string } {
    this.ensure90DayDefaultSeeds();
    const target = this.db.followupSchedules!.find(s => s.id === id && !s.isDeleted);
    if (!target) return { success: false, message: 'Schedule milestone not found.' };
    target.isActive = !target.isActive;
    target.updatedAt = new Date().toISOString();
    this.save();
    this.logAudit('SCHEDULE_MILESTONE_TOGGLE', `${target.isActive ? 'Enabled' : 'Disabled'} Day ${target.day} "${target.title}" by ${actorUid}`, actorUid);
    return { success: true, milestone: target };
  }

  reorderFollowupSchedule(orderedIds: string[], actorUid: string): { success: boolean; schedule: FollowupScheduleMilestoneRecord[] } {
    this.ensure90DayDefaultSeeds();
    const nowIso = new Date().toISOString();
    orderedIds.forEach((id, idx) => {
      const m = this.db.followupSchedules!.find(s => s.id === id);
      if (m) {
        m.sortOrder = idx + 1;
        m.updatedAt = nowIso;
      }
    });
    this.save();
    this.logAudit('SCHEDULE_REORDER', `Reordered 90-day follow-up schedule milestones by ${actorUid}`, actorUid);
    return { success: true, schedule: this.listFollowupSchedules(true) };
  }

  deleteFollowupScheduleMilestone(id: string, actorUid: string): { success: boolean; message: string } {
    this.ensure90DayDefaultSeeds();
    const idx = this.db.followupSchedules!.findIndex(s => s.id === id && !s.isDeleted);
    if (idx === -1) return { success: false, message: 'Milestone not found.' };
    const target = this.db.followupSchedules![idx];
    target.isActive = false;
    target.isDeleted = true;
    target.updatedAt = new Date().toISOString();
    this.save();
    this.logAudit('SCHEDULE_MILESTONE_DELETE', `Deactivated/removed Day ${target.day} "${target.title}" by ${actorUid}`, actorUid);
    return { success: true, message: `Day ${target.day} (${target.title}) removed from active schedule.` };
  }

  restoreDefaultFollowupSchedule(actorUid: string): { success: boolean; schedule: FollowupScheduleMilestoneRecord[] } {
    this.ensure90DayDefaultSeeds();
    const nowIso = new Date().toISOString();
    DEFAULT_FOLLOWUP_SCHEDULE_SEEDS.forEach((m, idx) => {
      const existing = this.db.followupSchedules!.find(s => s.day === m.day);
      if (existing) {
        existing.title = m.title;
        existing.description = m.description;
        existing.sortOrder = idx + 1;
        existing.isActive = true;
        existing.isDeleted = false;
        existing.updatedAt = nowIso;
      } else {
        this.db.followupSchedules!.push({
          id: `SCH-DAY-${m.day}`,
          day: m.day,
          title: m.title,
          description: m.description,
          sortOrder: idx + 1,
          isActive: true,
          isDeleted: false,
          isDefault: true,
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }
    });
    this.save();
    this.logAudit('SCHEDULE_RESTORE_DEFAULT', `Restored default 90-day schedule milestones by ${actorUid}`, actorUid);
    return { success: true, schedule: this.listFollowupSchedules(true) };
  }

  listStatusHistory(caseIdOrAppId?: string): StatusHistoryRecord[] {
    if (!Array.isArray(this.db.statusHistory)) this.db.statusHistory = [];
    const list = caseIdOrAppId
      ? this.db.statusHistory.filter(h => h.caseId === caseIdOrAppId || h.applicationId === caseIdOrAppId || h.customerId === caseIdOrAppId)
      : this.db.statusHistory;
    return [...list].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }

  listFollowups(caseIdOrAppId?: string): FollowupEntryRecord[] {
    if (!Array.isArray(this.db.followups)) this.db.followups = [];
    const list = caseIdOrAppId
      ? this.db.followups.filter(f => f.caseId === caseIdOrAppId || f.applicationId === caseIdOrAppId || f.customerId === caseIdOrAppId)
      : this.db.followups;
    return [...list].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }

  listGrievances(caseIdOrAppId?: string): GrievanceRecord[] {
    if (!Array.isArray(this.db.grievances)) this.db.grievances = [];
    const list = caseIdOrAppId
      ? this.db.grievances.filter(g => g.caseId === caseIdOrAppId || g.applicationId === caseIdOrAppId || g.customerId === caseIdOrAppId)
      : this.db.grievances;
    return [...list].sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));
  }

  upsertGrievance(input: Partial<GrievanceRecord>, actorUid: string, actorName: string): { success: boolean; grievance?: GrievanceRecord; caseRecord?: any; message?: string } {
    this.ensure90DayDefaultSeeds();
    const nowIso = new Date().toISOString();
    const portal = String(input.portal || 'Other').trim();
    const caseIdx = (this.db.followupCases || []).findIndex(
      c => (input.caseId && c.id === input.caseId) || (input.applicationId && c.applicationId === input.applicationId)
    );
    const linkedCase = caseIdx !== -1 ? this.db.followupCases![caseIdx] : null;
    const grvId = input.id && this.isValidGlobalReferenceId(String(input.id))
      ? String(input.id).trim().toUpperCase()
      : this.generateNextId('GRV', actorUid);
    const refNo = String(input.referenceNumber || '').trim() || grvId;

    if (input.id) {
      const gIdx = this.db.grievances!.findIndex(g => g.id === input.id);
      if (gIdx !== -1) {
        this.db.grievances![gIdx] = {
          ...this.db.grievances![gIdx],
          ...input,
          portal,
          referenceNumber: refNo,
          updatedAt: nowIso
        };
        if (linkedCase && Array.isArray(linkedCase.grievances)) {
          const cgIdx = linkedCase.grievances.findIndex((x: any) => x.id === input.id);
          if (cgIdx !== -1) linkedCase.grievances[cgIdx] = this.db.grievances![gIdx];
          linkedCase.updatedAt = nowIso;
        }
        this.save();
        return { success: true, grievance: this.db.grievances![gIdx], caseRecord: linkedCase };
      }
    }

    const record: GrievanceRecord = {
      id: grvId,
      applicationId: linkedCase?.applicationId || String(input.applicationId || ''),
      caseId: linkedCase?.id || String(input.caseId || ''),
      customerId: linkedCase?.customerId || String(input.customerId || ''),
      customerName: linkedCase?.customerName || String(input.customerName || ''),
      phone: linkedCase?.phone || String(input.phone || '').trim(),
      portal,
      referenceNumber: refNo,
      date: String(input.date || getKolkataDateParts().isoDate).slice(0, 10),
      status: String(input.status || 'Pending').trim(),
      remarks: String(input.remarks || '').trim(),
      submittedTo: String(input.submittedTo || input.department || portal).trim(),
      department: String(input.department || '').trim(),
      atr: String(input.atr || '').trim(),
      aadhaarSeedingStatus: String(input.aadhaarSeedingStatus || '').trim(),
      bankMapping: String(input.bankMapping || '').trim(),
      customPortalName: String(input.customPortalName || '').trim(),
      portalFields: input.portalFields || {},
      recordedBy: actorName,
      recordedByUid: actorUid,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    this.db.grievances!.unshift(record);

    if (linkedCase) {
      if (!Array.isArray(linkedCase.grievances)) linkedCase.grievances = [];
      linkedCase.grievances.unshift(record);
      if (!Array.isArray(linkedCase.timeline)) linkedCase.timeline = [];
      linkedCase.timeline.push({
        id: this.generateNextId('TL', actorUid),
        entryNo: linkedCase.timeline.length + 1,
        date: record.date,
        timestamp: nowIso,
        cycleDay: 0,
        milestoneLabel: `Grievance Logged (${record.portal})`,
        followupMode: 'Portal Status Check',
        previousStatus: linkedCase.currentStatus,
        newStatus: linkedCase.currentStatus,
        note: `Portal: ${record.portal} · Ref: ${record.referenceNumber} · ${record.remarks || record.status}`,
        recordedBy: actorName
      });
      linkedCase.updatedAt = nowIso;
    }

    this.save();
    this.logAudit('GRIEVANCE_LOGGED', `Logged ${record.portal} grievance ${record.referenceNumber} for ${record.applicationId} by ${actorUid}`, actorUid);
    return { success: true, grievance: record, caseRecord: linkedCase };
  }

  listReminders(caseIdOrAppId?: string): ReminderRecord[] {
    if (!Array.isArray(this.db.reminders)) this.db.reminders = [];
    const list = caseIdOrAppId
      ? this.db.reminders.filter(r => r.caseId === caseIdOrAppId || r.applicationId === caseIdOrAppId || r.customerId === caseIdOrAppId)
      : this.db.reminders;
    return [...list].sort((a, b) => (a.reminderDate || '').localeCompare(b.reminderDate || ''));
  }

  upsertReminder(input: Partial<ReminderRecord>, actorUid: string): { success: boolean; reminder?: ReminderRecord } {
    this.ensure90DayDefaultSeeds();
    const nowIso = new Date().toISOString();
    const list = this.db.reminders!;
    const existing = list.find(
      r =>
        (input.id && r.id === input.id) ||
        (input.applicationId && r.applicationId === input.applicationId && r.milestoneDay === Number(input.milestoneDay) && r.status === 'ACTIVE')
    );
    if (existing) {
      existing.reminderDate = String(input.reminderDate || existing.reminderDate);
      existing.enabled = input.enabled !== undefined ? Boolean(input.enabled) : existing.enabled;
      existing.status = (input.status as any) || existing.status;
      existing.note = input.note !== undefined ? String(input.note) : existing.note;
      existing.assignedStaff = input.assignedStaff || existing.assignedStaff;
      existing.updatedAt = nowIso;
      this.save();
      return { success: true, reminder: existing };
    }
    const created: ReminderRecord = {
      id: input.id && this.isValidGlobalReferenceId(String(input.id))
        ? String(input.id).trim().toUpperCase()
        : this.generateNextId('REM', actorUid),
      applicationId: String(input.applicationId || ''),
      caseId: String(input.caseId || ''),
      customerId: String(input.customerId || ''),
      customerName: String(input.customerName || ''),
      phone: String(input.phone || ''),
      milestoneDay: Number(input.milestoneDay || 0),
      reminderDate: String(input.reminderDate || getKolkataDateParts().isoDate),
      enabled: input.enabled !== false,
      status: (input.status as any) || 'ACTIVE',
      note: String(input.note || ''),
      assignedStaff: String(input.assignedStaff || actorUid),
      createdAt: nowIso,
      updatedAt: nowIso
    };
    list.push(created);
    this.save();
    return { success: true, reminder: created };
  }

  listFollowupCases(): any[] {
    if (!Array.isArray(this.db.followupCases)) this.db.followupCases = [];
    return [...this.db.followupCases];
  }

  upsertFollowupCase(payload: any, actorUid: string, actorName = actorUid): any {
    this.ensure90DayDefaultSeeds();
    if (!Array.isArray(this.db.followupCases)) this.db.followupCases = [];
    const nowIso = new Date().toISOString();
    const requestedCaseId = String(payload?.id || '').trim();
    const requestedAppId = String(payload?.applicationId || '').trim();

    if (requestedCaseId && (this.parseGlobalSerialId(requestedCaseId) || parseApplicationSerialId(requestedCaseId))) {
      this.syncGlobalSerialFloor(requestedCaseId);
    }
    if (requestedAppId && (this.parseGlobalSerialId(requestedAppId) || parseApplicationSerialId(requestedAppId))) {
      this.syncGlobalSerialFloor(requestedAppId);
    }

    // Duplicate Application ID protection on explicit new creation
    if (payload?.forceNew && requestedAppId) {
      const dup = this.db.followupCases.find(c => c.applicationId === requestedAppId && c.id !== requestedCaseId);
      if (dup) {
        return { error: true, duplicateApplicationId: true, message: `Duplicate Application ID "${requestedAppId}" rejected.` };
      }
    }

    const idx = this.db.followupCases.findIndex(
      c => (requestedCaseId && c.id === requestedCaseId) || (requestedAppId && c.applicationId === requestedAppId && !payload?.forceNew)
    );

    if (idx !== -1) {
      const prev = this.db.followupCases[idx];
      const prevTl = Array.isArray(prev.timeline) ? prev.timeline : [];
      const incTl = Array.isArray(payload.timeline) ? payload.timeline : prevTl;
      const mergedTl = incTl.length >= prevTl.length ? incTl : prevTl;

      const updated = {
        ...prev,
        ...payload,
        id: prev.id,
        timeline: mergedTl,
        updatedByUid: actorUid,
        updatedAt: nowIso
      };
      this.db.followupCases[idx] = updated;
      this.save();
      return updated;
    }

    const id = requestedCaseId && this.isValidGlobalReferenceId(requestedCaseId)
      ? requestedCaseId.toUpperCase()
      : this.generateNextId('CASE', actorUid);
    const applicationId = requestedAppId && this.isValidGlobalReferenceId(requestedAppId)
      ? requestedAppId.toUpperCase()
      : (requestedAppId || this.generateNextId('CASE', actorUid));
    const initialStatus = String(payload?.currentStatus || 'Submitted').trim() || 'Submitted';
    const startDate = String(payload?.startDate || getKolkataDateParts().isoDate).slice(0, 10);
    const nowTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

    const record = {
      ...payload,
      id,
      applicationId,
      startDate,
      currentStatus: initialStatus,
      priority: payload?.priority || 'Normal',
      customerType: payload?.customerType || 'General Public',
      timeline: Array.isArray(payload.timeline) ? payload.timeline : [],
      grievances: Array.isArray(payload.grievances) ? payload.grievances : [],
      createdByUid: actorUid,
      updatedByUid: actorUid,
      createdAt: payload?.createdAt || nowIso,
      updatedAt: nowIso
    };
    this.db.followupCases.unshift(record);

    // Log initial status into StatusHistory silently if not already present
    if (!(this.db.statusHistory || []).some(h => h.applicationId === applicationId)) {
      this.db.statusHistory!.unshift({
        id: this.generateNextId('TL', actorUid),
        applicationId,
        caseId: id,
        customerId: record.customerId || '',
        customerName: record.customerName || '',
        previousStatus: 'New Registration',
        newStatus: initialStatus,
        date: startDate,
        time: nowTime,
        updatedBy: actorName,
        updatedByUid: actorUid,
        remarks: payload?.remarks || 'Application Registered',
        timestamp: nowIso
      });
    }

    this.save();
    this.logAudit(
      'CASE_90D_SYNC',
      `90-Day Application ${record.applicationId} (${record.customerName || 'Customer'}) created by ${actorUid}`,
      actorUid
    );
    return record;
  }

  updateCaseStatusOnly(
    caseId: string,
    payload: { newStatus: string; remarks?: string; addNewStatusIfMissing?: boolean },
    actorUid: string,
    actorName: string
  ): { success: boolean; caseRecord?: any; statusEntry?: StatusHistoryRecord; message?: string } {
    this.ensure90DayDefaultSeeds();
    if (!Array.isArray(this.db.followupCases)) this.db.followupCases = [];
    const idx = this.db.followupCases.findIndex(c => c.id === caseId || c.applicationId === caseId);
    if (idx === -1) return { success: false, message: 'Application / case not found.' };

    const newStatus = String(payload.newStatus || '').trim();
    if (!newStatus) return { success: false, message: 'Current Status is required.' };

    const prev = this.db.followupCases[idx];
    const previousStatus = String(prev.currentStatus || 'Submitted');
    const now = new Date();
    const nowIso = now.toISOString();
    const { isoDate } = getKolkataDateParts(now);
    const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    const remarks = String(payload.remarks || '').trim();

    if (payload.addNewStatusIfMissing) {
      this.upsertAdminOption({ category: 'application_status', label: newStatus, isActive: true }, actorUid);
    }

    const statusEntry: StatusHistoryRecord = {
      id: this.generateNextId('TL', actorUid),
      applicationId: prev.applicationId,
      caseId: prev.id,
      customerId: prev.customerId || '',
      customerName: prev.customerName || '',
      previousStatus,
      newStatus,
      date: isoDate,
      time: timeStr,
      updatedBy: actorName,
      updatedByUid: actorUid,
      remarks: remarks || `Status updated from ${previousStatus} to ${newStatus}`,
      timestamp: nowIso
    };
    this.db.statusHistory!.unshift(statusEntry);

    const tl = Array.isArray(prev.timeline) ? [...prev.timeline] : [];
    tl.push({
      id: this.generateNextId('TL', actorUid),
      entryNo: tl.length + 1,
      date: isoDate,
      time: timeStr,
      timestamp: nowIso,
      cycleDay: 0,
      milestoneLabel: 'Current Status Updated',
      followupMode: 'Status Update',
      previousStatus,
      newStatus,
      note: remarks || `Application Status manually changed from "${previousStatus}" to "${newStatus}" (independent of 90-Day Schedule).`,
      recordedBy: actorName
    });

    const updated = {
      ...prev,
      currentStatus: newStatus,
      timeline: tl,
      updatedByUid: actorUid,
      updatedBy: actorName,
      updatedAt: nowIso
    };
    this.db.followupCases[idx] = updated;
    this.save();
    this.logAudit(
      'CASE_STATUS_CHANGE',
      `Application ${updated.applicationId} status changed: ${previousStatus} -> ${newStatus} by ${actorName} (${actorUid})`,
      actorUid
    );
    return { success: true, caseRecord: updated, statusEntry };
  }

  reopenFollowupCase(
    caseId: string,
    reason: string,
    actorUid: string,
    actorName: string
  ): { success: boolean; caseRecord?: any; message?: string } {
    this.ensure90DayDefaultSeeds();
    if (!Array.isArray(this.db.followupCases)) this.db.followupCases = [];
    const idx = this.db.followupCases.findIndex(c => c.id === caseId || c.applicationId === caseId);
    if (idx === -1) return { success: false, message: 'Application / case not found.' };

    const prev = this.db.followupCases[idx];
    const now = new Date();
    const nowIso = now.toISOString();
    const { isoDate } = getKolkataDateParts(now);
    const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    const cleanReason = String(reason || 'Reopened for further follow-up').trim();

    const tl = Array.isArray(prev.timeline) ? [...prev.timeline] : [];
    tl.push({
      id: this.generateNextId('TL', actorUid),
      entryNo: tl.length + 1,
      date: isoDate,
      time: timeStr,
      timestamp: nowIso,
      cycleDay: 90,
      milestoneLabel: 'Case Reopened',
      followupMode: 'Case Review',
      previousStatus: prev.currentStatus,
      newStatus: prev.currentStatus === 'Closed' ? 'Under Verification' : prev.currentStatus,
      note: `Case Reopened: ${cleanReason}`,
      recordedBy: actorName
    });

    const newStatus = prev.currentStatus === 'Closed' ? 'Under Verification' : prev.currentStatus;
    if (newStatus !== prev.currentStatus) {
      this.db.statusHistory!.unshift({
        id: this.generateNextId('TL', actorUid),
        applicationId: prev.applicationId,
        caseId: prev.id,
        customerId: prev.customerId || '',
        customerName: prev.customerName || '',
        previousStatus: prev.currentStatus,
        newStatus,
        date: isoDate,
        time: timeStr,
        updatedBy: actorName,
        updatedByUid: actorUid,
        remarks: `Case Reopened: ${cleanReason}`,
        timestamp: nowIso
      });
    }

    const updated = {
      ...prev,
      currentStatus: newStatus,
      cycleCompleted: false,
      reopenedAt: nowIso,
      reopenedBy: actorName,
      reopenCount: Number(prev.reopenCount || 0) + 1,
      nextFollowupDate: isoDate,
      timeline: tl,
      updatedByUid: actorUid,
      updatedAt: nowIso
    };
    this.db.followupCases[idx] = updated;
    this.save();
    this.logAudit('CASE_REOPENED', `Reopened case ${updated.applicationId} by ${actorName}: ${cleanReason}`, actorUid);
    return { success: true, caseRecord: updated };
  }

  rescheduleFollowupCase(
    caseId: string,
    payload: { nextFollowupDate: string; milestoneDay?: number | null; reason?: string; reminderEnabled?: boolean },
    actorUid: string,
    actorName: string
  ): { success: boolean; caseRecord?: any; message?: string } {
    this.ensure90DayDefaultSeeds();
    if (!Array.isArray(this.db.followupCases)) this.db.followupCases = [];
    const idx = this.db.followupCases.findIndex(c => c.id === caseId || c.applicationId === caseId);
    if (idx === -1) return { success: false, message: 'Application / case not found.' };

    const nextDate = String(payload.nextFollowupDate || '').slice(0, 10);
    if (!nextDate) return { success: false, message: 'Next Follow-up Date is required.' };

    const prev = this.db.followupCases[idx];
    const now = new Date();
    const nowIso = now.toISOString();
    const { isoDate } = getKolkataDateParts(now);
    const schedule = Array.isArray(prev.schedule) ? prev.schedule.map((m: any) => ({ ...m })) : [];
    const targetMilestoneDay = payload.milestoneDay !== undefined && payload.milestoneDay !== null
      ? Number(payload.milestoneDay)
      : Number(prev.nextMilestoneDay || 0);

    if (targetMilestoneDay > 0) {
      const m = schedule.find((x: any) => Number(x.day) === targetMilestoneDay && !x.completed);
      if (m) m.scheduledDate = nextDate;
    }

    const tl = Array.isArray(prev.timeline) ? [...prev.timeline] : [];
    tl.push({
      id: this.generateNextId('TL', actorUid),
      entryNo: tl.length + 1,
      date: isoDate,
      timestamp: nowIso,
      cycleDay: targetMilestoneDay,
      milestoneLabel: 'Follow-up Rescheduled',
      followupMode: 'Reschedule',
      previousStatus: prev.currentStatus,
      newStatus: prev.currentStatus,
      note: `Rescheduled follow-up to ${nextDate}${payload.reason ? ` (${payload.reason})` : ''}`,
      nextFollowupDate: nextDate,
      recordedBy: actorName
    });

    const updated = {
      ...prev,
      schedule,
      nextFollowupDate: nextDate,
      reminderEnabled: payload.reminderEnabled !== undefined ? Boolean(payload.reminderEnabled) : prev.reminderEnabled,
      timeline: tl,
      updatedByUid: actorUid,
      updatedAt: nowIso
    };
    this.db.followupCases[idx] = updated;

    if (updated.reminderEnabled !== false) {
      this.upsertReminder({
        applicationId: updated.applicationId,
        caseId: updated.id,
        customerId: updated.customerId,
        customerName: updated.customerName,
        phone: updated.phone,
        milestoneDay: targetMilestoneDay,
        reminderDate: nextDate,
        enabled: true,
        status: 'ACTIVE',
        note: payload.reason || 'Rescheduled follow-up',
        assignedStaff: updated.assignedStaff
      }, actorUid);
    }

    this.save();
    return { success: true, caseRecord: updated };
  }

  appendFollowupCaseTimeline(caseId: string, entry: any, actorUid: string, actorName = actorUid): { success: boolean; caseRecord?: any; message?: string } {
    this.ensure90DayDefaultSeeds();
    if (!Array.isArray(this.db.followupCases)) this.db.followupCases = [];
    const idx = this.db.followupCases.findIndex(c => c.id === caseId || c.applicationId === caseId);
    if (idx === -1) return { success: false, message: 'Follow-up case not found.' };

    const prev = this.db.followupCases[idx];
    const timeline = Array.isArray(prev.timeline) ? [...prev.timeline] : [];

    // Prevent exact duplicate rapid-fire entry
    if (entry?.id && timeline.some(t => t.id === entry.id)) {
      return { success: true, caseRecord: prev };
    }

    const nowIso = new Date().toISOString();
    const { isoDate } = getKolkataDateParts();
    const timeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    const entryNo = entry?.entryNo || timeline.length + 1;
    const prevStatus = String(prev.currentStatus || 'Submitted');
    // Current Status is ONLY changed if explicitly passed AND different; never auto-overwritten by milestones!
    const nextStatus = entry?.newStatus && String(entry.newStatus).trim() ? String(entry.newStatus).trim() : prevStatus;

    const tlItem = {
      ...entry,
      entryNo,
      recordedByUid: actorUid,
      recordedBy: entry?.recordedBy || actorName,
      timestamp: entry?.timestamp || nowIso
    };
    timeline.push(tlItem);

    if (nextStatus !== prevStatus) {
      this.db.statusHistory!.unshift({
        id: this.generateNextId('TL', actorUid),
        applicationId: prev.applicationId,
        caseId: prev.id,
        customerId: prev.customerId || '',
        customerName: prev.customerName || '',
        previousStatus: prevStatus,
        newStatus: nextStatus,
        date: String(entry?.date || isoDate).slice(0, 10),
        time: timeStr,
        updatedBy: actorName,
        updatedByUid: actorUid,
        remarks: String(entry?.note || 'Updated during follow-up entry'),
        timestamp: nowIso
      });
    }

    this.db.followups!.unshift({
      id: tlItem.id || this.generateNextId('FLW', actorUid),
      applicationId: prev.applicationId,
      caseId: prev.id,
      customerId: prev.customerId || '',
      customerName: prev.customerName || '',
      entryNo,
      followupDate: String(entry?.date || isoDate).slice(0, 10),
      cycleDay: Number(entry?.cycleDay ?? 0),
      milestoneLabel: String(entry?.milestoneLabel || 'Follow-up'),
      contactMethod: String(entry?.followupMode || entry?.contactMethod || 'Phone Call'),
      customerResponse: String(entry?.customerResponse || ''),
      currentStatusSnapshot: nextStatus,
      actionTaken: String(entry?.actionTaken || entry?.nextAction || ''),
      nextFollowupDate: String(entry?.nextFollowupDate || ''),
      note: String(entry?.note || ''),
      staffName: String(entry?.assignedStaff || prev.assignedStaff || actorName),
      staffUid: actorUid,
      followupResult: String(entry?.followupResult || ''),
      pendingReason: String(entry?.pendingReason || ''),
      casePriority: String(entry?.priority || prev.priority || 'Normal'),
      customerFeedback: String(entry?.customerFeedback || ''),
      attachmentName: String(entry?.attachmentName || ''),
      attachmentDocId: String(entry?.attachmentDocId || ''),
      reminderEnabled: entry?.reminderEnabled !== false,
      timestamp: nowIso
    });

    if (entry?.nextFollowupDate && entry?.reminderEnabled !== false) {
      this.upsertReminder({
        applicationId: prev.applicationId,
        caseId: prev.id,
        customerId: prev.customerId,
        customerName: prev.customerName,
        phone: prev.phone,
        milestoneDay: Number(entry?.nextMilestoneDay ?? prev.nextMilestoneDay ?? 0),
        reminderDate: String(entry.nextFollowupDate).slice(0, 10),
        enabled: true,
        status: 'ACTIVE',
        note: String(entry?.nextAction || entry?.note || ''),
        assignedStaff: entry?.assignedStaff || prev.assignedStaff
      }, actorUid);
    }

    const updated = {
      ...prev,
      currentStatus: nextStatus,
      priority: entry?.priority || prev.priority || 'Normal',
      pendingReason: entry?.pendingReason !== undefined ? entry.pendingReason : prev.pendingReason,
      customerFeedback: entry?.customerFeedback !== undefined ? entry.customerFeedback : prev.customerFeedback,
      nextFollowupDate: entry?.nextFollowupDate !== undefined ? entry.nextFollowupDate : prev.nextFollowupDate,
      timeline,
      updatedByUid: actorUid,
      updatedAt: nowIso
    };
    this.db.followupCases[idx] = updated;
    this.save();
    this.logAudit(
      'CASE_FOLLOWUP_APPEND',
      `Appended non-overwriting timeline entry #${entryNo} to ${updated.applicationId || updated.id} by ${actorUid}`,
      actorUid
    );
    return { success: true, caseRecord: updated };
  }

  deleteFollowupCase(caseId: string, actorUid: string): { success: boolean } {
    if (!Array.isArray(this.db.followupCases)) this.db.followupCases = [];
    const target = this.db.followupCases.find(c => c.id === caseId);
    this.db.followupCases = this.db.followupCases.filter(c => c.id !== caseId);
    this.save();
    if (target) {
      globalReferenceEngine.markReferenceStatus(target.id, 'DELETED', actorUid);
      if (target.applicationId) globalReferenceEngine.markReferenceStatus(target.applicationId, 'DELETED', actorUid);
      this.logAudit('CASE_90D_DELETE', `Deleted 90-Day Case ${target.applicationId || caseId} by ${actorUid}`, actorUid);
    }
    return { success: true };
  }

  getInventoryCategories(): InventoryCategoryRecord[] {
    this.ensureInventoryCategoriesSeeded();
    return [...(this.db.inventoryCategories || [])];
  }

  addInventoryCategory(
    rawName: string,
    actorUid: string,
    preferredId?: string
  ): { success: boolean; message?: string; category?: InventoryCategoryRecord; categories: InventoryCategoryRecord[] } {
    this.ensureInventoryCategoriesSeeded();
    const cleanName = String(rawName || '').replace(/\s+/g, ' ').trim();
    if (!cleanName || cleanName.length < 2) {
      return { success: false, message: 'Category name must be at least 2 characters.', categories: this.getInventoryCategories() };
    }
    if (cleanName.length > 80) {
      return { success: false, message: 'Category name cannot exceed 80 characters.', categories: this.getInventoryCategories() };
    }
    const existing = (this.db.inventoryCategories || []).find(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      return { success: true, category: existing, categories: this.getInventoryCategories() };
    }
    const isDefault = DEFAULT_GAS_INVENTORY_CATEGORIES.some(d => d.toLowerCase() === cleanName.toLowerCase());
    const created: InventoryCategoryRecord = {
      id: preferredId && String(preferredId).trim() ? String(preferredId).trim() : this.generateNextId('CAT', actorUid),
      name: cleanName,
      isDefault,
      createdAt: new Date().toISOString(),
      createdBy: actorUid
    };
    this.db.inventoryCategories!.push(created);
    this.save();
    this.logAudit('INVENTORY_CATEGORY_ADD', `Added inventory category "${cleanName}" by ${actorUid}`, actorUid);
    return { success: true, category: created, categories: this.getInventoryCategories() };
  }

  deleteInventoryCategory(
    idOrName: string,
    actorUid: string
  ): { success: boolean; message?: string; categories: InventoryCategoryRecord[] } {
    this.ensureInventoryCategoriesSeeded();
    const target = String(idOrName || '').trim();
    if (!target) {
      return { success: false, message: 'Category identifier required.', categories: this.getInventoryCategories() };
    }
    const list = this.db.inventoryCategories || [];
    const match = list.find(c => c.id === target || c.name.toLowerCase() === target.toLowerCase());
    if (!match) {
      return { success: false, message: 'Category not found.', categories: this.getInventoryCategories() };
    }
    if (list.length === 0) {
      return { success: false, message: 'No inventory categories to delete.', categories: this.getInventoryCategories() };
    }
    this.db.inventoryCategories = list.filter(c => c.id !== match.id);
    this.save();
    this.logAudit('INVENTORY_CATEGORY_DELETE', `Deleted inventory category "${match.name}" by ${actorUid}`, actorUid);
    return { success: true, categories: this.getInventoryCategories() };
  }

  restoreDefaultGasCategories(actorUid: string): { success: boolean; categories: InventoryCategoryRecord[] } {
    this.ensureInventoryCategoriesSeeded();
    const current = this.db.inventoryCategories || [];
    const defaults = this.buildDefaultGasInventoryCategories();
    const customOnly = current.filter(c => !DEFAULT_GAS_INVENTORY_CATEGORIES.some(d => d.toLowerCase() === c.name.toLowerCase()));
    this.db.inventoryCategories = [...defaults, ...customOnly];
    this.save();
    this.logAudit('INVENTORY_CATEGORY_RESTORE', `Restored default gas categories by ${actorUid}`, actorUid);
    return { success: true, categories: this.getInventoryCategories() };
  }

  syncInventoryCategories(
    incoming: any[],
    actorUid: string
  ): { success: boolean; categories: InventoryCategoryRecord[] } {
    this.ensureInventoryCategoriesSeeded();
    const merged: InventoryCategoryRecord[] = [];
    const seen = new Set<string>();
    const combined = [...(this.db.inventoryCategories || []), ...(Array.isArray(incoming) ? incoming : [])];
    combined.forEach((item: any) => {
      const name = String(item?.name || '').replace(/\s+/g, ' ').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({
        id: String(item?.id || this.generateNextId('CAT', actorUid)),
        name,
        isDefault: Boolean(item?.isDefault || DEFAULT_GAS_INVENTORY_CATEGORIES.some(d => d.toLowerCase() === key)),
        createdAt: String(item?.createdAt || new Date().toISOString()),
        createdBy: String(item?.createdBy || actorUid)
      });
    });
    if (merged.length > 0) {
      this.db.inventoryCategories = merged;
      this.save();
    }
    return { success: true, categories: this.getInventoryCategories() };
  }

  // -------------------------------------------------------------------------
  // ANNAPURNA YOJANA APPLICATIONS MULTI-USER PERSISTENCE
  // -------------------------------------------------------------------------
  listAnnapurnaApplications(): any[] {
    if (!Array.isArray(this.db.annapurnaApplications)) this.db.annapurnaApplications = [];
    return [...this.db.annapurnaApplications];
  }

  upsertAnnapurnaApplication(appData: any, actorUid: string): { success: boolean; app?: any; applications: any[]; message?: string } {
    if (!Array.isArray(this.db.annapurnaApplications)) this.db.annapurnaApplications = [];
    if (!appData || (!appData.id && !appData.applicationId)) {
      return { success: false, message: 'Application identifier required.', applications: this.listAnnapurnaApplications() };
    }
    const idx = this.db.annapurnaApplications.findIndex(
      a => (appData.id && a.id === appData.id) || (appData.applicationId && a.applicationId === appData.applicationId)
    );
    const nowIso = new Date().toISOString();
    const record = {
      ...appData,
      updatedAt: appData.updatedAt || nowIso,
      syncedByUid: actorUid
    };
    if (idx !== -1) {
      this.db.annapurnaApplications[idx] = { ...this.db.annapurnaApplications[idx], ...record };
    } else {
      this.db.annapurnaApplications.unshift(record);
    }
    this.save();
    return { success: true, app: idx !== -1 ? this.db.annapurnaApplications[idx] : record, applications: this.listAnnapurnaApplications() };
  }

  syncAnnapurnaApplications(incomingApps: any[], actorUid: string): { success: boolean; applications: any[] } {
    if (!Array.isArray(this.db.annapurnaApplications)) this.db.annapurnaApplications = [];
    const byKey = new Map<string, any>();
    const keyOf = (a: any) => String(a?.id || a?.applicationId || '').trim();

    for (const existing of this.db.annapurnaApplications) {
      const k = keyOf(existing);
      if (k) byKey.set(k, existing);
    }
    for (const inc of Array.isArray(incomingApps) ? incomingApps : []) {
      const k = keyOf(inc);
      if (!k) continue;
      const prev = byKey.get(k);
      if (!prev) {
        byKey.set(k, { ...inc, syncedByUid: inc.syncedByUid || actorUid });
      } else {
        const prevTs = Date.parse(prev.updatedAt || prev.createdAt || '0') || 0;
        const incTs = Date.parse(inc.updatedAt || inc.createdAt || '0') || 0;
        if (incTs >= prevTs) {
          byKey.set(k, { ...prev, ...inc, syncedByUid: actorUid });
        }
      }
    }
    this.db.annapurnaApplications = Array.from(byKey.values()).sort(
      (a, b) => (Date.parse(b.updatedAt || b.createdAt || '0') || 0) - (Date.parse(a.updatedAt || a.createdAt || '0') || 0)
    );
    this.save();
    return { success: true, applications: this.listAnnapurnaApplications() };
  }

  deleteAnnapurnaApplication(idOrAppId: string, actorUid: string): { success: boolean; applications: any[] } {
    if (!Array.isArray(this.db.annapurnaApplications)) this.db.annapurnaApplications = [];
    const target = this.db.annapurnaApplications.find(a => a.id === idOrAppId || a.applicationId === idOrAppId);
    this.db.annapurnaApplications = this.db.annapurnaApplications.filter(a => a.id !== idOrAppId && a.applicationId !== idOrAppId);
    if (target) {
      this.save();
      globalReferenceEngine.markReferenceStatus(target.id || idOrAppId, 'DELETED', actorUid);
      this.logAudit('ANNAPURNA_APP_DELETE', `Deleted Annapurna App ${target.applicationId || idOrAppId} by ${actorUid}`, actorUid);
    }
    return { success: true, applications: this.listAnnapurnaApplications() };
  }

  // -------------------------------------------------------------------------
  // LPG & GAS SERVICES MODULE PERSISTENCE (ADDITIVE INSIDE erp-db.json)
  // -------------------------------------------------------------------------
  getGasState(): Record<string, any> {
    if (!this.db.gasState || typeof this.db.gasState !== 'object') {
      this.db.gasState = {};
    }
    return { ...this.db.gasState };
  }

  syncGasState(incoming: Record<string, any>, actorUid: string): { success: boolean; gasState: Record<string, any> } {
    if (!this.db.gasState || typeof this.db.gasState !== 'object') {
      this.db.gasState = {};
    }
    if (incoming && typeof incoming === 'object') {
      const allowedKeys = [
        'customers',
        'bookings',
        'deliveryPersons',
        'eligibilityRules',
        'subsidies',
        'nonTakerLedgers',
        'collections',
        'warehouses',
        'stockMovements',
        'damagedStock',
        'suppliers',
        'purchases',
        'serviceEntries',
        'auditLogs',
        'settings',
        'inventorySnapshot'
      ];
      for (const k of allowedKeys) {
        if (incoming[k] !== undefined) {
          this.db.gasState[k] = incoming[k];
        }
      }
      this.db.gasState.updatedAt = new Date().toISOString();
      this.db.gasState.updatedByUid = actorUid;
      this.save();
    }
    return { success: true, gasState: this.getGasState() };
  }

  // -------------------------------------------------------------------------
  // TEAM MANAGEMENT STATE PERSISTENCE (ADDITIVE INSIDE erp-db.json)
  // -------------------------------------------------------------------------
  getTeamState(): Record<string, any> {
    if (!this.db.teamState || typeof this.db.teamState !== 'object') {
      this.db.teamState = { tasks: [], timeLogs: [] };
    }
    return {
      tasks: Array.isArray(this.db.teamState.tasks) ? this.db.teamState.tasks : [],
      timeLogs: Array.isArray(this.db.teamState.timeLogs) ? this.db.teamState.timeLogs : [],
      shiftConfig: this.db.teamState.shiftConfig || null,
      updatedAt: this.db.teamState.updatedAt || null,
      updatedByUid: this.db.teamState.updatedByUid || null
    };
  }

  syncTeamState(
    incoming: Record<string, any>,
    actorUid: string,
    allowShiftEdit = true
  ): { success: boolean; teamState: Record<string, any> } {
    if (!this.db.teamState || typeof this.db.teamState !== 'object') {
      this.db.teamState = { tasks: [], timeLogs: [] };
    }
    if (incoming && typeof incoming === 'object') {
      if (Array.isArray(incoming.tasks)) {
        this.db.teamState.tasks = incoming.tasks;
      }
      if (Array.isArray(incoming.timeLogs)) {
        this.db.teamState.timeLogs = incoming.timeLogs;
      }
      if (allowShiftEdit && incoming.shiftConfig && typeof incoming.shiftConfig === 'object') {
        this.db.teamState.shiftConfig = incoming.shiftConfig;
      }
      this.db.teamState.updatedAt = new Date().toISOString();
      this.db.teamState.updatedByUid = actorUid;
      this.save();
    }
    return { success: true, teamState: this.getTeamState() };
  }

  // -------------------------------------------------------------------------
  // CENTRALIZED EMPLOYEE ID HR INTEGRATION (LEAVES, PAYROLL, PAYSLIPS, KPI)
  // -------------------------------------------------------------------------
  private ensureHrState() {
    if (!this.db.hrState || typeof this.db.hrState !== 'object') {
      this.db.hrState = {};
    }
    if (!Array.isArray(this.db.hrState.leaves)) this.db.hrState.leaves = [];
    if (!Array.isArray(this.db.hrState.holidays)) this.db.hrState.holidays = [];
    if (!Array.isArray(this.db.hrState.payrollRuns)) this.db.hrState.payrollRuns = [];
    if (!Array.isArray(this.db.hrState.payslips)) this.db.hrState.payslips = [];
    if (!Array.isArray(this.db.hrState.recruitment)) this.db.hrState.recruitment = [];
    if (!Array.isArray(this.db.hrState.training)) this.db.hrState.training = [];
    if (!Array.isArray(this.db.hrState.kpiReviews)) this.db.hrState.kpiReviews = [];
    if (!Array.isArray(this.db.hrState.employeeLetters)) this.db.hrState.employeeLetters = [];
    if (!Array.isArray(this.db.hrState.rewardsDisciplinary)) this.db.hrState.rewardsDisciplinary = [];
    if (!this.db.hrState.employeeProfiles || typeof this.db.hrState.employeeProfiles !== 'object') {
      this.db.hrState.employeeProfiles = {};
    }
    if (!this.db.hrState.kpiConfig || typeof this.db.hrState.kpiConfig !== 'object') {
      this.db.hrState.kpiConfig = {
        taskCompletionWeight: 40,
        onTimeTaskWeight: 20,
        attendanceWeight: 25,
        serviceQualityWeight: 15,
        updatedAt: new Date().toISOString()
      };
    }
    return this.db.hrState;
  }

  getHrState(scopedEmployeeId?: string): Record<string, any> {
    const hr = this.ensureHrState();
    const filterByEmp = (list: any[]) => {
      if (!scopedEmployeeId) return [...list];
      const target = scopedEmployeeId.trim().toUpperCase();
      return list.filter((r: any) => String(r?.employeeId || r?.staffId || r?.staffUid || '').trim().toUpperCase() === target);
    };
    const scopedProfiles: Record<string, any> = {};
    if (scopedEmployeeId) {
      const target = scopedEmployeeId.trim().toUpperCase();
      if (hr.employeeProfiles && hr.employeeProfiles[target]) {
        scopedProfiles[target] = hr.employeeProfiles[target];
      }
    } else {
      Object.assign(scopedProfiles, hr.employeeProfiles || {});
    }
    return {
      leaves: filterByEmp(hr.leaves || []),
      holidays: [...(hr.holidays || [])],
      payrollRuns: filterByEmp(hr.payrollRuns || []),
      payslips: filterByEmp(hr.payslips || []),
      recruitment: scopedEmployeeId ? [] : [...(hr.recruitment || [])],
      training: [...(hr.training || [])],
      kpiConfig: { ...(hr.kpiConfig || {}) },
      kpiReviews: filterByEmp(hr.kpiReviews || []),
      employeeLetters: filterByEmp(hr.employeeLetters || []),
      rewardsDisciplinary: filterByEmp(hr.rewardsDisciplinary || []),
      employeeProfiles: scopedProfiles,
      updatedAt: hr.updatedAt || null,
      updatedByUid: hr.updatedByUid || null
    };
  }

  applyLeave(payload: Record<string, any>, actorUid: string, employeeName = ''): { success: boolean; leave?: any; message?: string } {
    const hr = this.ensureHrState();
    const employeeId = String(payload.employeeId || actorUid || '').trim().toUpperCase();
    const fromDate = String(payload.fromDate || '').slice(0, 10);
    const toDate = String(payload.toDate || fromDate || '').slice(0, 10);
    if (!employeeId || !fromDate || !toDate) {
      return { success: false, message: 'Employee ID, From Date, and To Date are required.' };
    }
    if (toDate < fromDate) {
      return { success: false, message: 'To Date cannot be earlier than From Date.' };
    }
    const startMs = Date.parse(fromDate + 'T00:00:00Z');
    const endMs = Date.parse(toDate + 'T00:00:00Z');
    const days = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
    const nowIso = new Date().toISOString();
    const leave = {
      id: String(payload.id || this.generateNextId('LV', actorUid)),
      employeeId,
      employeeName: String(payload.employeeName || employeeName || employeeId),
      leaveType: String(payload.leaveType || 'Casual Leave'),
      fromDate,
      toDate,
      days,
      isHalfDay: Boolean(payload.isHalfDay),
      reason: String(payload.reason || '').trim() || 'Personal / Official Leave',
      status: 'Pending',
      appliedByUid: actorUid,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    hr.leaves!.unshift(leave);
    hr.updatedAt = nowIso;
    hr.updatedByUid = actorUid;
    this.save();
    this.logAudit('LEAVE_APPLIED', `Leave ${leave.id} applied for ${employeeId} (${fromDate} to ${toDate})`, actorUid);
    return { success: true, leave };
  }

  decideLeave(
    leaveId: string,
    decision: 'Approved' | 'Rejected',
    actorUid: string,
    actorName = '',
    remarks = ''
  ): { success: boolean; leave?: any; syncedDates?: string[]; message?: string } {
    const hr = this.ensureHrState();
    const idx = (hr.leaves || []).findIndex((l: any) => l.id === leaveId);
    if (idx === -1) return { success: false, message: 'Leave application not found.' };

    const leave = hr.leaves![idx];
    const nowIso = new Date().toISOString();
    leave.status = decision;
    leave.decidedByUid = actorUid;
    leave.decidedByName = actorName || actorUid;
    leave.decidedAt = nowIso;
    leave.decisionRemarks = String(remarks || '').trim();
    leave.updatedAt = nowIso;

    const syncedDates: string[] = [];
    // B. Leave -> Attendance Automatic Synchronization (ONLY Approved triggers Attendance 'Leave')
    if (decision === 'Approved' && leave.fromDate && leave.toDate) {
      let cursor = new Date(`${leave.fromDate}T00:00:00Z`);
      const end = new Date(`${leave.toDate}T00:00:00Z`);
      let safety = 0;
      while (cursor.getTime() <= end.getTime() && safety < 62) {
        const dStr = cursor.toISOString().slice(0, 10);
        syncedDates.push(dStr);
        this.upsertAttendanceRecord(
          {
            date: dStr,
            staffId: leave.employeeId,
            staffName: leave.employeeName || leave.employeeId,
            status: leave.isHalfDay ? 'Half-Day' : 'Leave',
            inTime24: '',
            outTime24: '',
            clockIn: '-',
            clockOut: '-',
            notes: `Auto-synced from Approved Leave ${leave.id} (${leave.leaveType})${leave.reason ? ': ' + leave.reason : ''}`
          },
          actorUid
        );
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        safety++;
      }
    }

    hr.leaves![idx] = leave;
    hr.updatedAt = nowIso;
    hr.updatedByUid = actorUid;
    this.save();
    this.logAudit(
      `LEAVE_${decision.toUpperCase()}`,
      `Leave ${leave.id} for ${leave.employeeId} marked ${decision}${syncedDates.length ? ` & synced ${syncedDates.length} attendance day(s)` : ''}`,
      actorUid
    );
    return { success: true, leave, syncedDates };
  }

  runEmployeePayroll(
    payload: Record<string, any>,
    actorUid: string
  ): { success: boolean; duplicate?: boolean; payrollRun?: any; payslip?: any; message?: string } {
    const hr = this.ensureHrState();
    const employeeId = String(payload.employeeId || '').trim().toUpperCase();
    const monthYear = String(payload.monthYear || '').trim().slice(0, 7); // YYYY-MM
    if (!employeeId || !/^\d{4}-\d{2}$/.test(monthYear)) {
      return { success: false, message: 'Valid Employee ID and Month (YYYY-MM) are required.' };
    }

    // E. Duplicate payroll prevention for same Employee ID + Period
    const duplicateRun = (hr.payrollRuns || []).find(
      (r: any) =>
        String(r.employeeId || '').trim().toUpperCase() === employeeId &&
        String(r.monthYear || '').trim().slice(0, 7) === monthYear
    );
    if (duplicateRun) {
      return {
        success: false,
        duplicate: true,
        message: `Payroll already processed for ${employeeId} for period ${monthYear} (Run ${duplicateRun.id}). Duplicate processing blocked.`
      };
    }

    const nowIso = new Date().toISOString();
    const runId = String(payload.id || this.generateNextId('PAYRUN', actorUid));
    const payslipId = String(payload.payslipId || this.generateNextId('SLIP', actorUid));

    const payrollRun = {
      id: runId,
      payslipId,
      employeeId,
      employeeName: String(payload.employeeName || employeeId),
      designation: String(payload.designation || 'Staff'),
      monthYear,
      baseSalary: Math.max(0, Number(payload.baseSalary) || 0),
      workingDaysInMonth: Math.max(1, Number(payload.workingDaysInMonth) || 26),
      presentDays: Math.max(0, Number(payload.presentDays) || 0),
      halfDays: Math.max(0, Number(payload.halfDays) || 0),
      approvedLeaveDays: Math.max(0, Number(payload.approvedLeaveDays) || 0),
      absentDays: Math.max(0, Number(payload.absentDays) || 0),
      payableDays: Math.max(0, Number(payload.payableDays) || 0),
      overtimeHours: Math.max(0, Number(payload.overtimeHours) || 0),
      overtimePay: Math.max(0, Number(payload.overtimePay) || 0),
      commissions: Math.max(0, Number(payload.commissions) || 0),
      bonus: Math.max(0, Number(payload.bonus) || 0),
      absenceDeduction: Math.max(0, Number(payload.absenceDeduction) || 0),
      otherDeductions: Math.max(0, Number(payload.otherDeductions) || 0),
      grossPay: Math.max(0, Number(payload.grossPay) || 0),
      netPay: Math.max(0, Number(payload.netPay) || 0),
      paymentMode: String(payload.paymentMode || 'Bank Transfer'),
      status: String(payload.status || 'Processed'),
      notes: String(payload.notes || ''),
      processedByUid: actorUid,
      processedAt: nowIso
    };

    const payslip = {
      id: payslipId,
      payrollRunId: runId,
      employeeId,
      employeeName: payrollRun.employeeName,
      designation: payrollRun.designation,
      monthYear,
      baseSalary: payrollRun.baseSalary,
      payableDays: payrollRun.payableDays,
      presentDays: payrollRun.presentDays,
      approvedLeaveDays: payrollRun.approvedLeaveDays,
      absentDays: payrollRun.absentDays,
      overtimePay: payrollRun.overtimePay,
      commissions: payrollRun.commissions,
      bonus: payrollRun.bonus,
      totalDeductions: payrollRun.absenceDeduction + payrollRun.otherDeductions,
      grossPay: payrollRun.grossPay,
      netPay: payrollRun.netPay,
      paymentMode: payrollRun.paymentMode,
      status: payrollRun.status,
      generatedByUid: actorUid,
      generatedAt: nowIso
    };

    hr.payrollRuns!.unshift(payrollRun);
    hr.payslips!.unshift(payslip);
    hr.updatedAt = nowIso;
    hr.updatedByUid = actorUid;
    this.save();
    this.logAudit('PAYROLL_PROCESSED', `Processed payroll ${runId} & payslip ${payslipId} for ${employeeId} (${monthYear}): Net ₹${payrollRun.netPay}`, actorUid);
    return { success: true, payrollRun, payslip };
  }

  syncHrState(incoming: Record<string, any>, actorUid: string, isPrivileged = false): { success: boolean; hrState: Record<string, any> } {
    const hr = this.ensureHrState();
    const nowIso = new Date().toISOString();
    if (incoming && typeof incoming === 'object') {
      const staffAllowedSections = ['training'];
      const privilegedSections = [
        'leaves',
        'holidays',
        'recruitment',
        'training',
        'kpiReviews',
        'employeeLetters',
        'rewardsDisciplinary'
      ];
      for (const sec of privilegedSections) {
        if (Array.isArray(incoming[sec]) && (isPrivileged || staffAllowedSections.includes(sec))) {
          (hr as any)[sec] = incoming[sec];
        }
      }
      if (isPrivileged && incoming.kpiConfig && typeof incoming.kpiConfig === 'object') {
        hr.kpiConfig = { ...hr.kpiConfig, ...incoming.kpiConfig, updatedAt: nowIso };
      }
      if (isPrivileged && incoming.employeeProfiles && typeof incoming.employeeProfiles === 'object') {
        hr.employeeProfiles = { ...(hr.employeeProfiles || {}), ...incoming.employeeProfiles };
      }
      hr.updatedAt = nowIso;
      hr.updatedByUid = actorUid;
      this.save();
    }
    return { success: true, hrState: this.getHrState() };
  }

  // -------------------------------------------------------------------------
  // EXTENDED ERP STATE (SALES, INVENTORY, FINANCE, GROWTH, SECURITY)
  // -------------------------------------------------------------------------
  getExtendedErpState(): Record<string, any> {
    if (!this.db.extendedErp || typeof this.db.extendedErp !== 'object') {
      this.db.extendedErp = {};
    }
    return { ...this.db.extendedErp };
  }

  syncExtendedErpState(incoming: Record<string, any>, actorUid: string, isAdmin = false): { success: boolean; extendedErp: Record<string, any> } {
    if (!this.db.extendedErp || typeof this.db.extendedErp !== 'object') {
      this.db.extendedErp = {};
    }
    const allowedKeys = [
      'quotations', 'estimates', 'salesReturns', 'creditNotes',
      'purchaseOrders', 'purchaseBills', 'stockAdjustments', 'stockTransfers',
      'bankAccounts', 'journalEntries', 'bankReconciliations',
      'customerFeedback', 'leads', 'referrals', 'promotions'
    ];
    const adminKeys = ['branches', 'notificationPrefs', 'securitySettings'];
    for (const k of allowedKeys) {
      if (incoming[k] !== undefined) {
        this.db.extendedErp[k] = incoming[k];
      }
    }
    if (isAdmin) {
      for (const k of adminKeys) {
        if (incoming[k] !== undefined) {
          this.db.extendedErp[k] = incoming[k];
        }
      }
    }
    this.db.extendedErp.updatedAt = new Date().toISOString();
    this.db.extendedErp.updatedByUid = actorUid;
    this.save();
    return { success: true, extendedErp: this.getExtendedErpState() };
  }

  // -------------------------------------------------------------------------
  // AUTHORIZED MENU & SUBMENU CUSTOMIZATION (FIXED 11 DEPARTMENTS)
  // -------------------------------------------------------------------------
  getMenuConfig(): MenuConfigState {
    const raw = this.db.menuConfig;
    if (!raw || typeof raw !== 'object') {
      this.db.menuConfig = { departments: {}, submenus: {}, customSubmenus: [] };
    }
    return {
      departments: { ...(this.db.menuConfig?.departments || {}) },
      submenus: { ...(this.db.menuConfig?.submenus || {}) },
      customSubmenus: Array.isArray(this.db.menuConfig?.customSubmenus) ? [...this.db.menuConfig.customSubmenus] : [],
      updatedAt: this.db.menuConfig?.updatedAt,
      updatedByUid: this.db.menuConfig?.updatedByUid
    };
  }

  saveMenuConfig(incoming: any, actorUid: string): { success: boolean; message: string; menuConfig: MenuConfigState } {
    const fixedSet = new Set<string>(FIXED_11_DEPARTMENT_KEYS as readonly string[]);
    const protectedMenus = new Set<string>(['dashboard', 'menu-management']);
    const cleanDepts: Record<string, MenuDepartmentOverride> = {};
    const incomingDepts = incoming?.departments && typeof incoming.departments === 'object' ? incoming.departments : {};

    for (const key of Object.keys(incomingDepts)) {
      if (!fixedSet.has(key)) continue; // Strictly prevent adding extra independent departments
      const item = incomingDepts[key];
      if (!item || typeof item !== 'object') continue;
      const cleanTitle = typeof item.title === 'string' ? item.title.trim().slice(0, 48) : '';
      const cleanIcon = typeof item.icon === 'string' ? item.icon.trim().slice(0, 40) : '';
      if (cleanTitle || cleanIcon) {
        cleanDepts[key] = {
          ...(cleanTitle ? { title: cleanTitle } : {}),
          ...(cleanIcon ? { icon: cleanIcon } : {})
        };
      }
    }

    const cleanSubmenus: Record<string, MenuSubmenuOverride> = {};
    const incomingSubs = incoming?.submenus && typeof incoming.submenus === 'object' ? incoming.submenus : {};
    for (const subId of Object.keys(incomingSubs)) {
      const cleanId = String(subId || '').trim().slice(0, 64);
      if (!cleanId) continue;
      const sub = incomingSubs[subId];
      if (!sub || typeof sub !== 'object') continue;
      const entry: MenuSubmenuOverride = {};
      if (typeof sub.label === 'string' && sub.label.trim()) {
        entry.label = sub.label.trim().slice(0, 64);
      }
      if (typeof sub.icon === 'string' && sub.icon.trim()) {
        entry.icon = sub.icon.trim().slice(0, 40);
      }
      if (typeof sub.order === 'number' && Number.isFinite(sub.order)) {
        entry.order = Math.max(0, Math.round(sub.order));
      }
      if (typeof sub.enabled === 'boolean') {
        entry.enabled = protectedMenus.has(cleanId) ? true : sub.enabled;
      }
      if (typeof sub.group === 'string' && fixedSet.has(sub.group)) {
        entry.group = sub.group;
      }
      if (Object.keys(entry).length > 0) {
        cleanSubmenus[cleanId] = entry;
      }
    }

    const incomingCustom = Array.isArray(incoming?.customSubmenus) ? incoming.customSubmenus : [];
    const seenCustomIds = new Set<string>();
    const cleanCustom: CustomSubmenuEntry[] = [];
    for (const rawItem of incomingCustom) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const label = String(rawItem.label || '').trim().slice(0, 64);
      const group = String(rawItem.group || '').trim();
      if (!label || !fixedSet.has(group)) continue;
      let id = String(rawItem.id || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      if (!id.startsWith('custom-menu-')) {
        id = `custom-menu-${id || Date.now().toString(36)}`;
      }
      id = id.slice(0, 64);
      if (seenCustomIds.has(id)) continue;
      seenCustomIds.add(id);

      cleanCustom.push({
        id,
        label,
        group,
        icon: String(rawItem.icon || 'bookmark').trim().slice(0, 40) || 'bookmark',
        targetRoute: String(rawItem.targetRoute || 'dashboard').trim().slice(0, 64) || 'dashboard',
        customUrl: typeof rawItem.customUrl === 'string' ? rawItem.customUrl.trim().slice(0, 300) : '',
        description: typeof rawItem.description === 'string' ? rawItem.description.trim().slice(0, 240) : '',
        order: typeof rawItem.order === 'number' && Number.isFinite(rawItem.order) ? Math.max(0, Math.round(rawItem.order)) : 999,
        enabled: rawItem.enabled !== false,
        keywords: typeof rawItem.keywords === 'string' ? rawItem.keywords.trim().slice(0, 120) : '',
        createdAt: typeof rawItem.createdAt === 'string' && rawItem.createdAt ? rawItem.createdAt : new Date().toISOString(),
        createdBy: typeof rawItem.createdBy === 'string' && rawItem.createdBy ? rawItem.createdBy : actorUid
      });
    }

    const nextConfig: MenuConfigState = {
      departments: cleanDepts,
      submenus: cleanSubmenus,
      customSubmenus: cleanCustom,
      updatedAt: new Date().toISOString(),
      updatedByUid: actorUid
    };

    this.db.menuConfig = nextConfig;
    this.save();
    this.logAudit('MENU_CONFIG_UPDATE', `Sidebar navigation & menu configuration updated by ${actorUid} (${Object.keys(cleanDepts).length} dept overrides, ${Object.keys(cleanSubmenus).length} submenu overrides, ${cleanCustom.length} custom menus)`, actorUid);
    return {
      success: true,
      message: 'Menu configuration saved and applied live.',
      menuConfig: this.getMenuConfig()
    };
  }

  resetMenuConfig(actorUid: string): { success: boolean; message: string; menuConfig: MenuConfigState } {
    this.db.menuConfig = {
      departments: {},
      submenus: {},
      customSubmenus: [],
      updatedAt: new Date().toISOString(),
      updatedByUid: actorUid
    };
    this.save();
    this.logAudit('MENU_CONFIG_RESET', `Sidebar menu configuration restored to default structure by ${actorUid}`, actorUid);
    return {
      success: true,
      message: `Default ${FIXED_11_DEPARTMENT_KEYS.length}-department ERP menu structure restored.`,
      menuConfig: this.getMenuConfig()
    };
  }
}

export const centralDb = new CentralErpDatabaseService();
