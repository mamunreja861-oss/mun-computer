/**
 * storage.js - Centralized LocalStorage Service & Data Layer
 * MUN COMPUTER BUSINESS MANAGER - Official Business ERP
 */

const STORAGE_PREFIX = 'MUN_COMPUTER_ERP_v1_';

export const KEYS = {
  BUSINESS_PROFILE: `${STORAGE_PREFIX}business_profile`,
  BUSINESS_UNITS: `${STORAGE_PREFIX}business_units`,
  USERS: `${STORAGE_PREFIX}users`,
  CURRENT_USER: `${STORAGE_PREFIX}current_user`,
  CURRENT_UNIT_ID: `${STORAGE_PREFIX}active_unit_id`,
  CUSTOMERS: `${STORAGE_PREFIX}customers`,
  SERVICES: `${STORAGE_PREFIX}services`,
  FOLLOWUPS: `${STORAGE_PREFIX}followups`,
  PAYMENTS: `${STORAGE_PREFIX}payments`,
  INVOICES: `${STORAGE_PREFIX}invoices`,
  EXPENSES: `${STORAGE_PREFIX}expenses`,
  TARGETS: `${STORAGE_PREFIX}targets`,
  PROJECTS: `${STORAGE_PREFIX}projects`,
  INVESTMENTS: `${STORAGE_PREFIX}investments`,
  COMPETITORS: `${STORAGE_PREFIX}competitors`,
  MARKETING: `${STORAGE_PREFIX}marketing`,
  DOCUMENTS: `${STORAGE_PREFIX}documents`,
  TASKS: `${STORAGE_PREFIX}tasks`,
  AUDIT_LOGS: `${STORAGE_PREFIX}audit_logs`,
  SETTINGS: `${STORAGE_PREFIX}settings`,
  BANKING: `${STORAGE_PREFIX}banking`,
  INVENTORY: `${STORAGE_PREFIX}inventory`,
  INVENTORY_CATEGORIES: `${STORAGE_PREFIX}inventory_categories`,
  DAYBOOK: `${STORAGE_PREFIX}daybook`,
  PAYROLL: `${STORAGE_PREFIX}payroll`,
  GOVT_CASES: `${STORAGE_PREFIX}govt_cases`,
  GOVT_SCHEMES_CUSTOM: `${STORAGE_PREFIX}govt_schemes_custom`,
  GOVT_FOLLOWUPS: `${STORAGE_PREFIX}govt_followups`,
  CUSTOMER_VISITS: `${STORAGE_PREFIX}customer_visits`,
  CUSTOM_SERVICES: `${STORAGE_PREFIX}custom_services`,
  ANNAPURNA_APPLICATIONS: `${STORAGE_PREFIX}annapurna_applications`,
  CUSTOM_PROBLEMS: `${STORAGE_PREFIX}custom_problems`,
  CUSTOM_STATUSES: `${STORAGE_PREFIX}custom_statuses`,
  ANNAPURNA_CONFIG: `${STORAGE_PREFIX}annapurna_config`,
  CUSTOM_SERVICE_CATALOG: `${STORAGE_PREFIX}custom_service_catalog`,
  CUSTOM_BANKING_SERVICES: `${STORAGE_PREFIX}custom_banking_services`,
  CUSTOM_BANK_PARTNERS: `${STORAGE_PREFIX}custom_bank_partners`,
  COUNTER_CASH_TXNS: `${STORAGE_PREFIX}counter_cash_txns`,
  GPS_ATTENDANCE: `${STORAGE_PREFIX}gps_attendance`,
  SHIFT_CONFIG: `${STORAGE_PREFIX}shift_config`,
  FOLLOWUP_CASES: `${STORAGE_PREFIX}followup_cases`,
  ADMIN_OPTIONS: `${STORAGE_PREFIX}admin_options`,
  FOLLOWUP_SCHEDULE: `${STORAGE_PREFIX}followup_schedule`,
  STATUS_HISTORY: `${STORAGE_PREFIX}status_history`,
  FOLLOWUP_LEDGER: `${STORAGE_PREFIX}followup_ledger`,
  GRIEVANCES: `${STORAGE_PREFIX}grievances`,
  REMINDERS: `${STORAGE_PREFIX}reminders`,
  WARD_VILLAGE_MASTER: `${STORAGE_PREFIX}ward_village_master`,
  UPI_PAYMENT_SETTINGS: `${STORAGE_PREFIX}upi_payment_settings`,
  PAYMENT_VOUCHERS: `${STORAGE_PREFIX}payment_vouchers`,
  REFUNDS: `${STORAGE_PREFIX}refunds`,
  GAS_CUSTOMERS: `${STORAGE_PREFIX}gas_customers`,
  GAS_BOOKINGS: `${STORAGE_PREFIX}gas_bookings`,
  GAS_DELIVERY_PERSONS: `${STORAGE_PREFIX}gas_delivery_persons`,
  GAS_ELIGIBILITY_RULES: `${STORAGE_PREFIX}gas_eligibility_rules`,
  GAS_SUBSIDY: `${STORAGE_PREFIX}gas_subsidy`,
  GAS_NON_TAKER_LEDGER: `${STORAGE_PREFIX}gas_non_taker_ledger`,
  GAS_COLLECTIONS: `${STORAGE_PREFIX}gas_collections`,
  GAS_WAREHOUSES: `${STORAGE_PREFIX}gas_warehouses`,
  GAS_STOCK_MOVEMENTS: `${STORAGE_PREFIX}gas_stock_movements`,
  GAS_DAMAGED_STOCK: `${STORAGE_PREFIX}gas_damaged_stock`,
  GAS_SUPPLIERS: `${STORAGE_PREFIX}gas_suppliers`,
  GAS_PURCHASES: `${STORAGE_PREFIX}gas_purchases`,
  GAS_SERVICE_ENTRIES: `${STORAGE_PREFIX}gas_service_entries`,
  GAS_AUDIT_LOGS: `${STORAGE_PREFIX}gas_audit_logs`,
  GAS_SETTINGS: `${STORAGE_PREFIX}gas_settings`,
  TIME_PRODUCTIVITY_LOGS: `${STORAGE_PREFIX}time_productivity_logs`,
  // Centralized HR & Employee ID Integration Keys
  LEAVES: `${STORAGE_PREFIX}leaves`,
  HOLIDAYS: `${STORAGE_PREFIX}holidays`,
  PAYROLL_RUNS: `${STORAGE_PREFIX}payroll_runs`,
  PAYSLIPS: `${STORAGE_PREFIX}payslips`,
  RECRUITMENT: `${STORAGE_PREFIX}recruitment`,
  TRAINING: `${STORAGE_PREFIX}training`,
  KPI_CONFIG: `${STORAGE_PREFIX}kpi_config`,
  KPI_REVIEWS: `${STORAGE_PREFIX}kpi_reviews`,
  EMPLOYEE_LETTERS: `${STORAGE_PREFIX}employee_letters`,
  REWARDS_DISCIPLINARY: `${STORAGE_PREFIX}rewards_disciplinary`,
  EMPLOYEE_PROFILES: `${STORAGE_PREFIX}employee_profiles`,
  // Extended ERP Department Keys
  QUOTATIONS: `${STORAGE_PREFIX}quotations`,
  ESTIMATES: `${STORAGE_PREFIX}estimates`,
  SALES_RETURNS: `${STORAGE_PREFIX}sales_returns`,
  CREDIT_NOTES: `${STORAGE_PREFIX}credit_notes`,
  PURCHASE_ORDERS: `${STORAGE_PREFIX}purchase_orders`,
  PURCHASE_BILLS: `${STORAGE_PREFIX}purchase_bills`,
  STOCK_ADJUSTMENTS: `${STORAGE_PREFIX}stock_adjustments`,
  STOCK_TRANSFERS: `${STORAGE_PREFIX}stock_transfers`,
  BANK_ACCOUNTS: `${STORAGE_PREFIX}bank_accounts`,
  JOURNAL_ENTRIES: `${STORAGE_PREFIX}journal_entries`,
  BANK_RECONCILIATIONS: `${STORAGE_PREFIX}bank_reconciliations`,
  CUSTOMER_FEEDBACK: `${STORAGE_PREFIX}customer_feedback`,
  LEADS: `${STORAGE_PREFIX}leads`,
  REFERRALS: `${STORAGE_PREFIX}referrals`,
  PROMOTIONS: `${STORAGE_PREFIX}promotions`,
  BRANCHES: `${STORAGE_PREFIX}branches`,
  NOTIFICATION_PREFS: `${STORAGE_PREFIX}notification_prefs`,
  SECURITY_SETTINGS: `${STORAGE_PREFIX}security_settings`,
  MENU_CONFIG: `${STORAGE_PREFIX}menu_config`
};

/* --- Indian Currency & Date Formatting Helpers --- */

/**
 * Format currency in Indian Rupee (INR) format (e.g. ₹1,25,000.00)
 */
export function formatINR(amount, showDecimals = false) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0
  }).format(num);
}

/**
 * Parse monetary value accurately without IEEE-754 float drift
 */
function parseMonetaryParts(amount) {
  if (amount === null || amount === undefined || typeof amount === 'boolean') return null;
  let str = typeof amount === 'number'
    ? (Number.isFinite(amount) ? String(amount) : '')
    : String(amount).trim();
  if (!str) return null;

  str = str.replace(/[₹,\s]/g, '').replace(/^(?:rs\.?|inr)\s*/i, '');
  if (!str) return null;

  const match = str.match(/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/);
  if (!match) {
    const fallback = Number(str);
    if (!Number.isFinite(fallback)) return null;
    str = fallback.toFixed(2);
    const m2 = str.match(/^(-?)(\d+)\.(\d{2})$/);
    if (!m2) return null;
    return {
      isNegative: m2[1] === '-',
      rupees: Number(m2[2]),
      paise: Number(m2[3])
    };
  }

  const isNegative = match[1] === '-';
  let rupees = Number(match[2] || '0');
  const fracRaw = match[3] !== undefined ? match[3] : (match[4] || '');
  let paise = 0;

  if (fracRaw.length > 0) {
    const padded = fracRaw.padEnd(3, '0');
    paise = Number(padded.slice(0, 2));
    const thirdDigit = Number(padded[2]);
    if (thirdDigit >= 5) {
      paise += 1;
      if (paise >= 100) {
        paise = 0;
        rupees += 1;
      }
    }
  }

  if (!Number.isFinite(rupees) || !Number.isFinite(paise)) return null;
  return { isNegative, rupees, paise };
}

/**
 * Convert numeric INR amount into Indian English words
 * Supports Ones, Tens, Hundreds, Thousands, Lakhs, Crores + Paise
 * e.g. 65000 -> "Sixty Five Thousand Rupees Only"
 * e.g. 100500.5 -> "One Lakh Five Hundred Rupees and Fifty Paise Only"
 */
export function numberToWords(amount) {
  const parsed = parseMonetaryParts(amount);
  if (!parsed) return 'Zero Rupees Only';

  const { isNegative, rupees, paise } = parsed;
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigits = (n) => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o ? `${tens[t]} ${ones[o]}` : tens[t];
  };

  const threeDigits = (n) => {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const parts = [];
    if (h > 0) parts.push(`${ones[h]} Hundred`);
    if (rem > 0) parts.push(twoDigits(rem));
    return parts.join(' ');
  };

  const intToIndianWords = (n) => {
    if (n === 0) return '';
    const parts = [];
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const rest = n % 1000;

    if (crore > 0) parts.push(`${crore >= 100 ? intToIndianWords(crore) : twoDigits(crore)} Crore`);
    if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);
    if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
    if (rest > 0) parts.push(threeDigits(rest));
    return parts.join(' ').trim();
  };

  const segments = [];
  if (rupees > 0) {
    segments.push(`${intToIndianWords(rupees)} ${rupees === 1 ? 'Rupee' : 'Rupees'}`);
  }
  if (paise > 0) {
    segments.push(`${twoDigits(paise)} ${paise === 1 ? 'Paisa' : 'Paise'}`);
  }
  const core = segments.join(' and ') + ' Only';
  return isNegative ? `Minus ${core}` : core;
}

/**
 * Evaluate live monetary input state for displaying Amount in Words safely
 * Empty -> no text | Invalid/negative -> validation message | Valid -> Amount in Words
 */
export function getAmountWordsState(rawValue, options = {}) {
  const {
    allowNegative = false,
    allowZero = true,
    badInput = false,
    prefix = 'Amount in Words: '
  } = options;

  if (badInput) {
    return {
      state: 'invalid',
      numericValue: null,
      words: '',
      displayText: 'Invalid amount — please enter a valid number'
    };
  }

  if (rawValue === null || rawValue === undefined) {
    return { state: 'empty', numericValue: null, words: '', displayText: '' };
  }

  const rawStr = String(rawValue).trim();
  if (!rawStr) {
    return { state: 'empty', numericValue: null, words: '', displayText: '' };
  }

  const cleaned = rawStr.replace(/[₹,\s]/g, '').replace(/^(?:rs\.?|inr)\s*/i, '');
  if (!cleaned) {
    return { state: 'empty', numericValue: null, words: '', displayText: '' };
  }

  const parsed = parseMonetaryParts(cleaned);
  const num = Number(cleaned);
  if (!parsed || !Number.isFinite(num)) {
    return {
      state: 'invalid',
      numericValue: null,
      words: '',
      displayText: 'Invalid amount — please enter a valid number'
    };
  }

  if (!allowNegative && num < 0) {
    return {
      state: 'invalid',
      numericValue: num,
      words: '',
      displayText: 'Invalid amount — negative values are not allowed'
    };
  }

  if (!allowZero && num === 0) {
    return {
      state: 'invalid',
      numericValue: 0,
      words: '',
      displayText: 'Amount must be greater than zero'
    };
  }

  const words = numberToWords(cleaned);
  return {
    state: 'valid',
    numericValue: num,
    words,
    displayText: prefix ? `${prefix}${words}` : words
  };
}

/**
 * Sync an amount input (or value) with a target preview element directly below it
 */
export function syncAmountWords(inputOrValue, targetElOrId, options = {}) {
  if (typeof document === 'undefined') return null;
  const target = typeof targetElOrId === 'string'
    ? document.getElementById(targetElOrId)
    : targetElOrId;
  if (!target) return null;

  const isInput = inputOrValue && typeof inputOrValue === 'object' && 'value' in inputOrValue;
  const val = isInput ? inputOrValue.value : inputOrValue;
  const badInput = Boolean(isInput && inputOrValue.validity?.badInput);

  const res = getAmountWordsState(val, { ...options, badInput });
  if (res.state === 'empty') {
    target.textContent = '';
    target.style.display = 'none';
  } else if (res.state === 'invalid') {
    target.textContent = res.displayText;
    target.style.display = 'block';
    target.style.color = 'var(--danger, #dc2626)';
  } else {
    target.textContent = res.displayText;
    target.style.display = 'block';
    target.style.color = options.color || 'var(--blue-600, #2563eb)';
  }
  return res;
}

/**
 * Format date to Indian standard (DD-MM-YYYY)
 */
export function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateString;
  }
}

/**
 * Format date and time for Asia/Kolkata timezone
 */
export function formatDateTime(dateString) {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateString;
  }
}

/**
 * Get current ISO date in YYYY-MM-DD format
 */
export function getTodayDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current formatted IST Date & Time string
 */
export function getNowISTString(date = new Date()) {
  try {
    return new Date(date).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }) + ' IST';
  } catch {
    return new Date().toISOString();
  }
}

const GLOBAL_COUNTER_CACHE_KEY = '_munGlobalCounterCache';

function getKolkataYearString(dateInput = null) {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (!isNaN(d.getTime())) {
      const iso = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      if (/^\d{4}/.test(iso)) return iso.slice(0, 4);
    }
  } catch {
    // ignore
  }
  return String(new Date().getFullYear());
}

export function getGlobalCounterSnapshot() {
  if (typeof window !== 'undefined' && window[GLOBAL_COUNTER_CACHE_KEY]) {
    return window[GLOBAL_COUNTER_CACHE_KEY];
  }
  return null;
}

function updateGlobalCounterCache(partial) {
  if (typeof window === 'undefined' || !partial) return;
  const prev = window[GLOBAL_COUNTER_CACHE_KEY] || {};
  window[GLOBAL_COUNTER_CACHE_KEY] = { ...prev, ...partial };
}

/**
 * Preview next Universal Global Reference No synchronously from cached backend counter.
 * Read-only helper; NEVER allocates or increments a counter.
 */
export function previewNextGlobalReference(prefix = 'CASE', dateInput = null) {
  const cleanPrefix = String(prefix || 'CASE').trim().toUpperCase();
  const orgCode = (cleanPrefix === 'MGR' || cleanPrefix === 'STF') ? 'MC' : 'MUN';
  const year = getKolkataYearString(dateInput);
  const snap = getGlobalCounterSnapshot();
  if (snap && Number.isFinite(Number(snap.next_serial))) {
    const sl = snap.next_global_sl || String(snap.next_serial).padStart(8, '0');
    return `${orgCode}-${cleanPrefix}-${year}-${sl}`;
  }
  return `${orgCode}-${cleanPrefix}-${year}-00000001`;
}

export function previewNextApplicationId(dateInput = null) {
  return previewNextGlobalReference('CASE', dateInput);
}

/**
 * Fetch current Universal Global Counter status from backend SQLite authority.
 */
export async function fetchGlobalCounterStatus(prefix = 'CUST') {
  const cleanPrefix = String(prefix || 'CUST').trim().toUpperCase();
  const res = await fetch(`/api/references/counter?prefix=${encodeURIComponent(cleanPrefix)}`, {
    headers: getAuthHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || 'Failed to fetch Global SL counter status from backend.');
  }
  updateGlobalCounterCache(data);
  return data;
}

/**
 * Authoritative Backend Universal Global Reference Generator.
 * Calls POST /api/references/generate inside SQLite BEGIN IMMEDIATE transaction.
 * NEVER falls back to frontend random/timestamp/local counters.
 */
export async function allocateGlobalReferenceRecord(prefix, options = {}) {
  const cleanPrefix = String(prefix || '').trim().toUpperCase();
  if (!cleanPrefix) {
    throw new Error('Official Reference Prefix is required.');
  }
  const payload = {
    prefix: cleanPrefix,
    entityType: options.entityType || cleanPrefix,
    entityId: options.entityId || undefined,
    idempotencyKey: options.idempotencyKey || undefined,
    legacyReferenceNo: options.legacyReferenceNo || undefined,
    createdAt: options.createdAt || undefined
  };
  const res = await fetch('/api/references/generate', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !data?.reference_no) {
    throw new Error(data?.message || `Failed to generate Global Reference No for ${cleanPrefix}.`);
  }
  const serialNum = Number(data.serial_num);
  if (Number.isFinite(serialNum) && serialNum > 0) {
    updateGlobalCounterCache({
      last_serial: serialNum,
      next_serial: serialNum + 1,
      next_global_sl: String(serialNum + 1).padStart(8, '0'),
      creation_year: String(data.creation_year || getKolkataYearString()),
      last_updated: data.created_at || new Date().toISOString()
    });
  }
  return data;
}

export async function allocateGlobalReference(prefix, options = {}) {
  const data = await allocateGlobalReferenceRecord(prefix, options);
  return data.reference_no;
}

export async function getGlobalReferenceDetails(referenceNo) {
  const clean = String(referenceNo || '').trim().toUpperCase();
  if (!clean) return null;
  const res = await fetch(`/api/references/${encodeURIComponent(clean)}`, {
    headers: getAuthHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) return null;
  return data.reference || data;
}

export async function searchGlobalReferences(query = '', options = {}) {
  const params = new URLSearchParams();
  if (query) params.set('q', String(query));
  if (options.prefix) params.set('prefix', String(options.prefix));
  if (options.status) params.set('status', String(options.status));
  if (options.limit) params.set('limit', String(options.limit));
  const res = await fetch(`/api/references/search?${params.toString()}`, {
    headers: getAuthHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || 'Failed to search Global References.');
  }
  return data;
}

export async function markGlobalReferenceDeleted(referenceNo, status = 'DELETED') {
  const clean = String(referenceNo || '').trim().toUpperCase();
  if (!clean) return { success: false };
  try {
    const res = await fetch('/api/references/mark-deleted', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ referenceNo: clean, status })
    });
    return await res.json().catch(() => ({ success: res.ok }));
  } catch (err) {
    console.warn('markGlobalReferenceDeleted non-fatal error:', err);
    return { success: false };
  }
}

export async function verifyGlobalReferenceConsistency() {
  const res = await fetch('/api/references/verify', {
    headers: getAuthHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || 'Failed to verify Global Reference consistency.');
  }
  return data;
}

export async function runGlobalReferenceMigration(items = []) {
  const res = await fetch('/api/references/migrate', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ items })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || 'Failed to run Global Reference migration.');
  }
  return data;
}

export function getAuthHeaders() {
  const cur = getItem(KEYS.CURRENT_USER, null);
  const token = localStorage.getItem('MUN_COMPUTER_SESSION_TOKEN') || '';
  const csrf = localStorage.getItem('MUN_COMPUTER_CSRF_TOKEN') || '';
  const headers = { 'Content-Type': 'application/json' };
  if (cur?.uid || cur?.id) headers['x-actor-uid'] = cur.uid || cur.id;
  if (cur?.role) headers['x-actor-role'] = cur.role;
  if (token) headers['x-session-token'] = token;
  if (csrf) headers['x-csrf-token'] = csrf;
  return headers;
}

/* --- Storage API Core (Fast In-Memory Cache Validated Against Raw Strings) --- */

const _rawStorageCache = new Map();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e || !e.key) _rawStorageCache.clear();
    else _rawStorageCache.delete(e.key);
  });
}

function cloneCachedValue(val) {
  if (Array.isArray(val)) {
    return val.map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? { ...item } : item));
  }
  if (val && typeof val === 'object') {
    return { ...val };
  }
  return val;
}

export function getItem(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      _rawStorageCache.delete(key);
      return fallback;
    }
    const cached = _rawStorageCache.get(key);
    if (cached && cached.raw === raw) {
      return cloneCachedValue(cached.data);
    }
    const parsed = JSON.parse(raw);
    _rawStorageCache.set(key, { raw, data: parsed });
    return cloneCachedValue(parsed);
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return fallback;
  }
}

export function setItem(key, value) {
  try {
    const raw = JSON.stringify(value);
    localStorage.setItem(key, raw);
    _rawStorageCache.set(key, { raw, data: cloneCachedValue(value) });
    return true;
  } catch (err) {
    console.error(`Error writing ${key} to storage:`, err);
    return false;
  }
}

export function removeItem(key) {
  try {
    _rawStorageCache.delete(key);
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.error(`Error removing ${key} from storage:`, err);
    return false;
  }
}

/* --- Audit Log Tracker (Backend Global SL when authenticated) --- */
export function logAuditAction(action, details, user = 'System') {
  const logs = getItem(KEYS.AUDIT_LOGS, []);
  const ts = new Date().toISOString();
  const entry = {
    id: '',
    timestamp: ts,
    action,
    details,
    user: typeof user === 'object' ? user.name || user.username : user
  };
  logs.unshift(entry);
  if (logs.length > 400) logs.pop();
  setItem(KEYS.AUDIT_LOGS, logs);

  // If authenticated, assign an authoritative backend AUD Reference No asynchronously
  if (typeof localStorage !== 'undefined' && localStorage.getItem('MUN_COMPUTER_SESSION_TOKEN')) {
    allocateGlobalReference('AUD', { entityType: 'AUDIT_LOG', createdAt: ts })
      .then((refNo) => {
        const curLogs = getItem(KEYS.AUDIT_LOGS, []);
        const target = curLogs.find((l) => l.timestamp === ts && l.action === action && !l.id);
        if (target) {
          target.id = refNo;
          setItem(KEYS.AUDIT_LOGS, curLogs);
        }
      })
      .catch(() => {
        // Non-blocking audit decoration
      });
  }
}

/* --- Initial Default Seed Data for MUN COMPUTER --- */

export const INITIAL_DATA = {
  businessProfile: {
    id: 'BIZ-MUN-001',
    name: 'MUN COMPUTER',
    tagline: 'Your Trusted Partner in Digital Transformation',
    brandDescriptor: 'DIGITAL SERVICES | BANKING SOLUTIONS | TECHNOLOGY EXCELLENCE',
    subDescriptor: 'A Unified Digital Service, Financial Facilitation & IT Solutions Enterprise.',
    slogan: 'Empowering Digital Access. Connecting People. Simplifying Services.',
    ownership: 'Sole Proprietorship',
    operatingModel: 'Single Business Unit',
    administrator: 'Mamun Reja',
    administratorTitle: 'Proprietor & Chief Administrator',
    founderName: 'Mamun Reja',
    ownerName: 'Mamun Reja',
    headOffice: 'Domkal, Murshidabad',
    category: 'Digital Services & Technology Solutions Enterprise',
    businessType: 'Sole Proprietorship – Integrated Digital Services, Banking Facilitation, E-Governance and Information Technology Solutions.',
    registrationStructure: 'Single Proprietorship Establishment – Single Consolidated Operating Unit.',
    brandPositioning: 'A Customer-Centric, Technology-Driven and Service-Oriented Digital Enterprise.',
    phone: '+91 8101352105',
    email: 'muncomputer2019@gmail.com',
    address: 'MUN COMPUTER, Mamudpur (Chowmatha More), Ward No. 16, Domkal Municipality, P.O. – Juginda, P.S. – Domkal, District – Murshidabad, West Bengal – 742406, India.',
    shortAddress: 'Mamudpur (Chowmatha More), Ward 16, Domkal, Murshidabad, WB - 742406',
    area: 'Mamudpur (Chowmatha More)',
    ward: 'Ward No. 16, Domkal Municipality',
    village: 'Mamudpur',
    postOffice: 'Juginda',
    policeStation: 'Domkal',
    district: 'Murshidabad',
    state: 'West Bengal',
    pinCode: '742406',
    country: 'India',
    tradeLicense: '',
    gstin: '',
    pan: '',
    bankAccount: '',
    openingHours: '08:00 AM – 09:30 PM',
    operatingSchedule: 'Seven Days a Week – Subject to Applicable Holidays and Operational Availability.',
    overview: 'MUN COMPUTER is an integrated digital services and technology solutions enterprise headquartered in Mamudpur, Domkal, Murshidabad, West Bengal, India. The organization operates through a centralized business management structure, delivering a comprehensive portfolio of digital facilitation, banking correspondent services, e-Governance assistance, smart card printing, computer solutions and professional documentation services. Its operational framework integrates customer relationship management, financial administration, transaction monitoring, inventory management and service delivery under a unified business identity. MUN COMPUTER is committed to operational transparency, service accessibility, customer confidentiality, technological efficiency and sustainable business development.',
    description: 'MUN COMPUTER is an integrated digital services and technology solutions enterprise headquartered in Mamudpur, Domkal, Murshidabad, delivering digital facilitation, banking correspondent services, e-Governance assistance, PVC smart card printing, computer solutions and professional documentation.',
    brandColor: '#0b192c',
    accentColor: '#2563eb',
    startDate: '2021-04-01',
    status: 'ACTIVE BUSINESS',
    divisionsCount: 8
  },

  businessUnits: [
    {
      id: 'mun-computer',
      name: 'MUN COMPUTER – Corporate Central Operations',
      shortCode: 'MUN',
      icon: 'cpu',
      model: 'CENTRALIZED SINGLE-UNIT BUSINESS STRUCTURE',
      classification: 'Single Ownership | Single Establishment | Integrated Operations',
      desc: 'Centralized single-unit operations delivering 8 core service divisions under direct executive administration.'
    }
  ],

  users: [
    {
      requestId: 'MC-ADM-14012025',
      uid: 'MC-ADM-14012025',
      id: 'MC-ADM-14012025',
      username: 'mc-adm-14012025',
      name: 'Sarmina Khatun',
      fullName: 'Sarmina Khatun',
      role: 'ADMIN',
      isMainAdmin: true,
      isSuperAdmin: true,
      designation: 'Permanent Master Administrator',
      email: 'admin@muncomputer.in',
      phone: '9735407045',
      phoneMasked: 'XXXXXX7045',
      aadhaarMasked: 'XXXX XXXX 9364',
      address: 'MUN COMPUTER, Mamudpur, Juginda, Domkal, Murshidabad - 742406',
      mustChangePassword: false,
      status: 'ACTIVE',
      approvalStatus: 'APPROVED',
      verificationStatus: 'VERIFIED',
      active: true
    }
  ],

  customers: [],
  services: [],
  followups: [],
  followupCases: [],
  payments: [],
  invoices: [],
  expenses: [],
  targets: [],
  projects: [],
  investments: [],
  competitors: [],
  marketing: [],
  documents: [],
  tasks: [],
  banking: [],
  inventory: [],
  daybook: [],
  payroll: []
};

export const CLEAN_DATA_FLAG = `${STORAGE_PREFIX}clean_fresh_slate_2026_v10`;
export const CORP_PROFILE_FLAG = `${STORAGE_PREFIX}corp_profile_v10`;

/**
 * Purge all demo/mock/operational records from localStorage while retaining root credentials,
 * Service Rate Chart structure, navigation/menu config, and system settings.
 */
export function clearAllOperationalData() {
  setItem(KEYS.USERS, INITIAL_DATA.users);
  setItem(KEYS.CUSTOMERS, []);
  setItem(KEYS.SERVICES, []);
  setItem(KEYS.FOLLOWUPS, []);
  setItem(KEYS.FOLLOWUP_CASES, []);
  setItem(KEYS.STATUS_HISTORY, []);
  setItem(KEYS.FOLLOWUP_LEDGER, []);
  setItem(KEYS.GRIEVANCES, []);
  setItem(KEYS.REMINDERS, []);
  setItem(KEYS.PAYMENTS, []);
  setItem(KEYS.INVOICES, []);
  setItem(KEYS.EXPENSES, []);
  setItem(KEYS.TARGETS, []);
  setItem(KEYS.PROJECTS, []);
  setItem(KEYS.INVESTMENTS, []);
  setItem(KEYS.COMPETITORS, []);
  setItem(KEYS.MARKETING, []);
  setItem(KEYS.DOCUMENTS, []);
  setItem(KEYS.TASKS, []);
  setItem(KEYS.BANKING, []);
  setItem(KEYS.INVENTORY, []);
  setItem(KEYS.DAYBOOK, []);
  setItem(KEYS.PAYROLL, []);
  setItem(KEYS.CUSTOMER_VISITS, []);
  setItem(KEYS.ANNAPURNA_APPLICATIONS, []);
  setItem(KEYS.GOVT_CASES, []);
  setItem(KEYS.GOVT_SCHEMES_CUSTOM, []);
  setItem(KEYS.GOVT_FOLLOWUPS, []);
  setItem(KEYS.CUSTOM_SERVICES, []);
  setItem(KEYS.CUSTOM_PROBLEMS, []);
  setItem(KEYS.CUSTOM_STATUSES, []);
  setItem(KEYS.ANNAPURNA_CONFIG, {
    extraSchemes: [],
    extraProblemCategories: [],
    extraStatuses: [],
    extraComplaintTypes: []
  });
  setItem(KEYS.CUSTOM_SERVICE_CATALOG, {
    customCategories: [],
    customSubServices: []
  });
  setItem(KEYS.CUSTOM_BANKING_SERVICES, []);
  setItem(KEYS.CUSTOM_BANK_PARTNERS, []);
  setItem(KEYS.COUNTER_CASH_TXNS, []);
  setItem(KEYS.GPS_ATTENDANCE, []);
  setItem(KEYS.PAYMENT_VOUCHERS, []);
  setItem(KEYS.REFUNDS, []);
  setItem(KEYS.GAS_CUSTOMERS, []);
  setItem(KEYS.GAS_BOOKINGS, []);
  setItem(KEYS.GAS_DELIVERY_PERSONS, []);
  setItem(KEYS.GAS_ELIGIBILITY_RULES, []);
  setItem(KEYS.GAS_SUBSIDY, []);
  setItem(KEYS.GAS_NON_TAKER_LEDGER, []);
  setItem(KEYS.GAS_COLLECTIONS, []);
  setItem(KEYS.GAS_WAREHOUSES, []);
  setItem(KEYS.GAS_STOCK_MOVEMENTS, []);
  setItem(KEYS.GAS_DAMAGED_STOCK, []);
  setItem(KEYS.GAS_SUPPLIERS, []);
  setItem(KEYS.GAS_PURCHASES, []);
  setItem(KEYS.GAS_SERVICE_ENTRIES, []);
  setItem(KEYS.GAS_AUDIT_LOGS, []);
  setItem(KEYS.TIME_PRODUCTIVITY_LOGS, []);
  // Clear all HR & Extended ERP transactional stores
  setItem(KEYS.LEAVES, []);
  setItem(KEYS.HOLIDAYS, []);
  setItem(KEYS.PAYROLL_RUNS, []);
  setItem(KEYS.PAYSLIPS, []);
  setItem(KEYS.RECRUITMENT, []);
  setItem(KEYS.TRAINING, []);
  setItem(KEYS.KPI_REVIEWS, []);
  setItem(KEYS.EMPLOYEE_LETTERS, []);
  setItem(KEYS.REWARDS_DISCIPLINARY, []);
  setItem(KEYS.EMPLOYEE_PROFILES, {});
  setItem(KEYS.QUOTATIONS, []);
  setItem(KEYS.ESTIMATES, []);
  setItem(KEYS.SALES_RETURNS, []);
  setItem(KEYS.CREDIT_NOTES, []);
  setItem(KEYS.PURCHASE_ORDERS, []);
  setItem(KEYS.PURCHASE_BILLS, []);
  setItem(KEYS.STOCK_ADJUSTMENTS, []);
  setItem(KEYS.STOCK_TRANSFERS, []);
  setItem(KEYS.BANK_ACCOUNTS, []);
  setItem(KEYS.JOURNAL_ENTRIES, []);
  setItem(KEYS.BANK_RECONCILIATIONS, []);
  setItem(KEYS.CUSTOMER_FEEDBACK, []);
  setItem(KEYS.LEADS, []);
  setItem(KEYS.REFERRALS, []);
  setItem(KEYS.PROMOTIONS, []);
  setItem(KEYS.BRANCHES, []);
  setItem(KEYS.AUDIT_LOGS, []);
  // Clear transient ID/serial counters & legacy flags while preserving Rate Chart & settings
  removeItem(`${STORAGE_PREFIX}counters`);
  removeItem('MUN_APP_SERIAL_COUNTER_MAP');
  removeItem('MUN_REFERRAL_COUNTER');
  removeItem('mun_yuva_siksha_meta_v1');
  removeItem(`${STORAGE_PREFIX}clean_fresh_slate_2026_v5`);
  removeItem(`${STORAGE_PREFIX}clean_fresh_slate_2026_v6`);
  removeItem(`${STORAGE_PREFIX}clean_fresh_slate_2026_v7`);
  removeItem(`${STORAGE_PREFIX}clean_fresh_slate_2026_v8`);
  removeItem(`${STORAGE_PREFIX}clean_fresh_slate_2026_v9`);
  removeItem(`${STORAGE_PREFIX}corp_profile_v8`);
  removeItem(`${STORAGE_PREFIX}corp_profile_v9`);
  try {
    localStorage.setItem(CLEAN_DATA_FLAG, 'true');
  } catch (err) {
    console.error('Failed to set clean data flag:', err);
  }
}

/**
 * Initialize storage with default data if empty or upgrade keys
 */
export function initializeStorage() {
  // If clean data flag not yet set in this browser, purge legacy demo records immediately
  if (localStorage.getItem(CLEAN_DATA_FLAG) !== 'true') {
    clearAllOperationalData();
  }

  // Update or set the Corporate Profile to the new International Enterprise standard
  if (!getItem(KEYS.BUSINESS_PROFILE) || localStorage.getItem(CORP_PROFILE_FLAG) !== 'true') {
    setItem(KEYS.BUSINESS_PROFILE, INITIAL_DATA.businessProfile);
    setItem(KEYS.BUSINESS_UNITS, INITIAL_DATA.businessUnits);
    setItem(KEYS.CURRENT_UNIT_ID, 'mun-computer');
    setItem(KEYS.USERS, INITIAL_DATA.users);

    try {
      localStorage.setItem(CORP_PROFILE_FLAG, 'true');
    } catch (err) {
      console.warn('Storage flag set error', err);
    }
  }

  // Enforce single official business unit: MUN COMPUTER
  setItem(KEYS.BUSINESS_UNITS, INITIAL_DATA.businessUnits);
  setItem(KEYS.CURRENT_UNIT_ID, 'mun-computer');
  if (!getItem(KEYS.USERS)) {
    setItem(KEYS.USERS, INITIAL_DATA.users);
  }
  if (!getItem(KEYS.CUSTOMERS)) {
    setItem(KEYS.CUSTOMERS, []);
  }
  if (!getItem(KEYS.SERVICES)) {
    setItem(KEYS.SERVICES, []);
  }
  if (!getItem(KEYS.FOLLOWUPS)) {
    setItem(KEYS.FOLLOWUPS, []);
  }
  if (!getItem(KEYS.FOLLOWUP_CASES)) {
    setItem(KEYS.FOLLOWUP_CASES, []);
  }
  if (!getItem(KEYS.ADMIN_OPTIONS)) {
    setItem(KEYS.ADMIN_OPTIONS, []);
  }
  if (!getItem(KEYS.FOLLOWUP_SCHEDULE)) {
    setItem(KEYS.FOLLOWUP_SCHEDULE, []);
  }
  if (!getItem(KEYS.STATUS_HISTORY)) {
    setItem(KEYS.STATUS_HISTORY, []);
  }
  if (!getItem(KEYS.FOLLOWUP_LEDGER)) {
    setItem(KEYS.FOLLOWUP_LEDGER, []);
  }
  if (!getItem(KEYS.GRIEVANCES)) {
    setItem(KEYS.GRIEVANCES, []);
  }
  if (!getItem(KEYS.REMINDERS)) {
    setItem(KEYS.REMINDERS, []);
  }
  if (!getItem(KEYS.PAYMENTS)) {
    setItem(KEYS.PAYMENTS, []);
  }
  if (!getItem(KEYS.INVOICES)) {
    setItem(KEYS.INVOICES, []);
  }
  if (!getItem(KEYS.EXPENSES)) {
    setItem(KEYS.EXPENSES, []);
  }
  if (!getItem(KEYS.TARGETS)) {
    setItem(KEYS.TARGETS, []);
  }
  if (!getItem(KEYS.PROJECTS)) {
    setItem(KEYS.PROJECTS, []);
  }
  if (!getItem(KEYS.INVESTMENTS)) {
    setItem(KEYS.INVESTMENTS, []);
  }
  if (!getItem(KEYS.COMPETITORS)) {
    setItem(KEYS.COMPETITORS, []);
  }
  if (!getItem(KEYS.MARKETING)) {
    setItem(KEYS.MARKETING, []);
  }
  if (!getItem(KEYS.DOCUMENTS)) {
    setItem(KEYS.DOCUMENTS, []);
  }
  if (!getItem(KEYS.TASKS)) {
    setItem(KEYS.TASKS, []);
  }
  if (!getItem(KEYS.BANKING)) {
    setItem(KEYS.BANKING, []);
  }
  if (!getItem(KEYS.INVENTORY)) {
    setItem(KEYS.INVENTORY, []);
  }
  if (!getItem(KEYS.INVENTORY_CATEGORIES)) {
    const nowIso = new Date().toISOString();
    setItem(KEYS.INVENTORY_CATEGORIES, [
      { id: 'CAT-GAS-01', name: 'Gas Hose Pipe', isDefault: true, createdAt: nowIso },
      { id: 'CAT-GAS-02', name: 'Gas Lighter', isDefault: true, createdAt: nowIso },
      { id: 'CAT-GAS-03', name: 'Gas Regulator', isDefault: true, createdAt: nowIso },
      { id: 'CAT-GAS-04', name: 'Gas Oven / Stove', isDefault: true, createdAt: nowIso },
      { id: 'CAT-GAS-05', name: 'Gas Spare Parts & Fittings', isDefault: true, createdAt: nowIso },
      { id: 'CAT-GAS-06', name: 'Other Gas Accessories', isDefault: true, createdAt: nowIso }
    ]);
  }
  if (!getItem(KEYS.DAYBOOK)) {
    setItem(KEYS.DAYBOOK, []);
  }
  if (!getItem(KEYS.PAYROLL)) {
    setItem(KEYS.PAYROLL, []);
  }
  if (!getItem(KEYS.CUSTOMER_VISITS)) {
    setItem(KEYS.CUSTOMER_VISITS, []);
  }
  if (!getItem(KEYS.CUSTOM_SERVICES)) {
    setItem(KEYS.CUSTOM_SERVICES, []);
  }
  if (!getItem(KEYS.ANNAPURNA_APPLICATIONS)) {
    setItem(KEYS.ANNAPURNA_APPLICATIONS, []);
  }
  if (!getItem(KEYS.CUSTOM_PROBLEMS)) {
    setItem(KEYS.CUSTOM_PROBLEMS, []);
  }
  if (!getItem(KEYS.CUSTOM_STATUSES)) {
    setItem(KEYS.CUSTOM_STATUSES, []);
  }
  if (!getItem(KEYS.ANNAPURNA_CONFIG)) {
    setItem(KEYS.ANNAPURNA_CONFIG, {
      extraSchemes: [],
      extraProblemCategories: [],
      extraStatuses: [],
      extraComplaintTypes: []
    });
  }
  if (!getItem(KEYS.CUSTOM_SERVICE_CATALOG)) {
    setItem(KEYS.CUSTOM_SERVICE_CATALOG, {
      customCategories: [],
      customSubServices: []
    });
  }
  if (!getItem(KEYS.CUSTOM_BANKING_SERVICES)) {
    setItem(KEYS.CUSTOM_BANKING_SERVICES, []);
  }
  if (!getItem(KEYS.CUSTOM_BANK_PARTNERS)) {
    setItem(KEYS.CUSTOM_BANK_PARTNERS, []);
  }
  if (!getItem(KEYS.COUNTER_CASH_TXNS)) {
    setItem(KEYS.COUNTER_CASH_TXNS, []);
  }
  if (!getItem(KEYS.GPS_ATTENDANCE)) {
    setItem(KEYS.GPS_ATTENDANCE, []);
  }
  if (!getItem(KEYS.TIME_PRODUCTIVITY_LOGS)) {
    setItem(KEYS.TIME_PRODUCTIVITY_LOGS, []);
  }
  if (!getItem(KEYS.SHIFT_CONFIG)) {
    setItem(KEYS.SHIFT_CONFIG, {
      morningInTime: '09:00',
      eveningOutTime: '19:00',
      graceMinutes: 15,
      standardHours: 10
    });
  }
  if (!getItem(KEYS.PAYMENT_VOUCHERS)) {
    setItem(KEYS.PAYMENT_VOUCHERS, []);
  }
  if (!getItem(KEYS.REFUNDS)) {
    setItem(KEYS.REFUNDS, []);
  }
  if (!getItem(KEYS.GAS_CUSTOMERS)) {
    setItem(KEYS.GAS_CUSTOMERS, []);
  }
  if (!getItem(KEYS.GAS_BOOKINGS)) {
    setItem(KEYS.GAS_BOOKINGS, []);
  }
  if (!getItem(KEYS.GAS_ELIGIBILITY_RULES)) {
    setItem(KEYS.GAS_ELIGIBILITY_RULES, []);
  }
  if (!getItem(KEYS.GAS_SUBSIDY)) {
    setItem(KEYS.GAS_SUBSIDY, []);
  }
  if (!getItem(KEYS.GAS_NON_TAKER_LEDGER)) {
    setItem(KEYS.GAS_NON_TAKER_LEDGER, []);
  }
  if (!getItem(KEYS.GAS_COLLECTIONS)) {
    setItem(KEYS.GAS_COLLECTIONS, []);
  }
  if (!getItem(KEYS.GAS_WAREHOUSES)) {
    setItem(KEYS.GAS_WAREHOUSES, []);
  }
  if (!getItem(KEYS.GAS_STOCK_MOVEMENTS)) {
    setItem(KEYS.GAS_STOCK_MOVEMENTS, []);
  }
  if (!getItem(KEYS.GAS_DAMAGED_STOCK)) {
    setItem(KEYS.GAS_DAMAGED_STOCK, []);
  }
  if (!getItem(KEYS.GAS_SUPPLIERS)) {
    setItem(KEYS.GAS_SUPPLIERS, []);
  }
  if (!getItem(KEYS.GAS_PURCHASES)) {
    setItem(KEYS.GAS_PURCHASES, []);
  }
  if (!getItem(KEYS.GAS_SERVICE_ENTRIES)) {
    setItem(KEYS.GAS_SERVICE_ENTRIES, []);
  }
  if (!getItem(KEYS.GAS_AUDIT_LOGS)) {
    setItem(KEYS.GAS_AUDIT_LOGS, []);
  }
  if (!getItem(KEYS.UPI_PAYMENT_SETTINGS)) {
    setItem(KEYS.UPI_PAYMENT_SETTINGS, {
      upiId: '',
      upiDisplayName: '',
      paymentInstructions: '',
      qrImageDataUrl: '',
      qrImageMime: '',
      qrFileName: '',
      updatedAt: ''
    });
  }
  if (!getItem(KEYS.AUDIT_LOGS)) {
    setItem(KEYS.AUDIT_LOGS, []);
  }
  const arrayDefaults = [
    KEYS.LEAVES,
    KEYS.HOLIDAYS,
    KEYS.PAYROLL_RUNS,
    KEYS.PAYSLIPS,
    KEYS.RECRUITMENT,
    KEYS.TRAINING,
    KEYS.KPI_REVIEWS,
    KEYS.EMPLOYEE_LETTERS,
    KEYS.REWARDS_DISCIPLINARY,
    KEYS.QUOTATIONS,
    KEYS.ESTIMATES,
    KEYS.SALES_RETURNS,
    KEYS.CREDIT_NOTES,
    KEYS.PURCHASE_ORDERS,
    KEYS.PURCHASE_BILLS,
    KEYS.STOCK_ADJUSTMENTS,
    KEYS.STOCK_TRANSFERS,
    KEYS.BANK_ACCOUNTS,
    KEYS.JOURNAL_ENTRIES,
    KEYS.BANK_RECONCILIATIONS,
    KEYS.CUSTOMER_FEEDBACK,
    KEYS.LEADS,
    KEYS.REFERRALS,
    KEYS.PROMOTIONS,
    KEYS.BRANCHES
  ];
  arrayDefaults.forEach((k) => {
    if (!getItem(k)) setItem(k, []);
  });
  if (!getItem(KEYS.EMPLOYEE_PROFILES)) {
    setItem(KEYS.EMPLOYEE_PROFILES, {});
  }
  if (!getItem(KEYS.KPI_CONFIG)) {
    setItem(KEYS.KPI_CONFIG, {
      taskCompletionWeight: 40,
      onTimeTaskWeight: 20,
      attendanceWeight: 25,
      serviceQualityWeight: 15,
      updatedAt: new Date().toISOString()
    });
  }
  if (!getItem(KEYS.NOTIFICATION_PREFS)) {
    setItem(KEYS.NOTIFICATION_PREFS, {
      lowStockAlertEnabled: true,
      leaveAlertEnabled: true,
      overdueTaskAlertEnabled: true,
      duePaymentAlertEnabled: true,
      docExpiryDays: 30
    });
  }
  if (!getItem(KEYS.SECURITY_SETTINGS)) {
    setItem(KEYS.SECURITY_SETTINGS, {
      sessionTimeoutMinutes: 15,
      maxDailyPasswordChanges: 5,
      enforceAuditLogging: true,
      requireDeleteReason: true
    });
  }
}

/**
 * Backup entire database to JSON string
 */
export function exportDatabaseBackup() {
  const backup = {};
  for (const [keyName, storageKey] of Object.entries(KEYS)) {
    backup[keyName] = getItem(storageKey);
  }
  backup.SERVICE_RATE_CHART = getItem('mun_service_rate_chart_v1');
  backup.SERVICE_RATE_CHART_META = getItem('mun_service_rate_chart_meta_v1');
  backup.exportedAt = new Date().toISOString();
  backup.app = 'MUN COMPUTER BUSINESS MANAGER';
  backup.shop = 'MUN COMPUTER';
  backup.version = '2.0.0';
  return JSON.stringify(backup, null, 2);
}

/**
 * Restore database from JSON string
 */
export function restoreDatabaseBackup(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.app && !data.shop) {
      throw new Error('Invalid backup file. Header signature does not match MUN COMPUTER BUSINESS MANAGER.');
    }
    for (const [keyName, storageKey] of Object.entries(KEYS)) {
      if (data[keyName] !== undefined) {
        setItem(storageKey, data[keyName]);
      }
    }
    if (data.SERVICE_RATE_CHART !== undefined) {
      setItem('mun_service_rate_chart_v1', data.SERVICE_RATE_CHART);
    }
    if (data.SERVICE_RATE_CHART_META !== undefined) {
      setItem('mun_service_rate_chart_meta_v1', data.SERVICE_RATE_CHART_META);
    }
    logAuditAction('DATABASE_RESTORE', 'All database tables restored from backup file.');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Reset data to pristine clean blank state
 */
export function resetToDefaults() {
  clearAllOperationalData();
  logAuditAction('DATABASE_RESET', 'Database reset to clean blank state.');
}

