/**
 * gasServiceEngine.js - LPG & Gas Services Management Core Engine
 * MUN COMPUTER Business Manager
 *
 * Strictly enforces:
 * - Zero demo/mock data seeded into operational business tables
 * - Reuse of central KEYS.INVENTORY, KEYS.CUSTOMERS, KEYS.PAYMENTS & companyConfig
 * - Non-Taker formula: Outstanding = Actual Authorized Advance - Total Recovery
 * - Administrative Booking Eligibility tracking (ignoring Cancelled bookings)
 * - Atomic Inventory Stock Deduction on Customer Service & Replacement Entry
 * - Strict RBAC guards for Settings, Negative Stock Override, Reversals & Deletes
 */

import {
  KEYS,
  getItem,
  setItem,
  allocateGlobalReference,
  markGlobalReferenceDeleted,
  getTodayDate,
  logAuditAction,
  getAuthHeaders
} from './storage.js';
import { getCurrentUser, isSuperAdmin, canMenu } from './auth.js';
import { getAllCustomers, saveCustomer } from './customers.js';
import { getAllInventory, saveInventoryItem, adjustStock, getInventoryCategories } from './inventory.js';
import { getAllPayments, recordPayment } from './payments.js';

export const BOOKING_ELIGIBILITY_DISCLAIMER =
  'Administrative Reminder Only: Booking eligibility intervals (25 / 30 / 45 / 60 / Custom days) are internal counter tracking reminders and do NOT represent official Government, MoPNG, or Oil Marketing Company (IOCL / HPCL / BPCL) booking rules.';

export const SUBSIDY_SECURITY_NOTICE =
  'Security & Accuracy Policy: Expected Subsidy and Verified Credited Amount are tracked separately. Bank passwords, OTPs, and UPI PINs are strictly prohibited and never stored.';

export const NON_TAKER_ACCOUNTING_NOTICE =
  'Accounting Policy: Government DBT subsidy is NOT treated as business income or customer debt. This ledger tracks ONLY actual authorized advances extended by MUN COMPUTER with explicit customer consent.';

export const GAS_SERVICE_TYPES = [
  'Regulator Change',
  'Gas Pipe Change',
  'Both Regulator and Pipe Change',
  'Other Gas Service'
];

export const GAS_COLLECTION_CATEGORIES = [
  'Gas Booking Payment',
  'Authorized Advance Recovery',
  'Gas Service Charge',
  'Accessories Sales',
  'Other Receivables'
];

export const GAS_PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other'];

export const GAS_SUBSIDY_STATUSES = [
  'Expected',
  'Pending',
  'Credited',
  'Failed',
  'Under Verification',
  'Not Applicable'
];

export const GAS_DELIVERY_PIPELINE_STAGES = [
  'Booking Received',
  'Booking Confirmed',
  'Order Processing',
  'Ready for Dispatch',
  'Delivery Assigned',
  'Out for Delivery',
  'Delivered Successfully'
];

export const GAS_EXCEPTION_STATUSES = [
  'Delivery Attempted',
  'Customer Not Available',
  'Delivery Rescheduled',
  'Booking Cancelled',
  'Payment Pending'
];

export const GAS_BOOKING_STATUSES = [
  ...GAS_DELIVERY_PIPELINE_STAGES,
  ...GAS_EXCEPTION_STATUSES
];

export const GAS_DELIVERY_PRICING_METHODS = [
  'Distance-Based Tiers',
  'Fixed Charge',
  'Per KM Charge',
  'Area/Village-Based Charge',
  'Custom Manual Charge',
  'Free Delivery'
];

export function normalizeGasBookingStatus(status) {
  const raw = String(status ?? '').trim();
  if (!raw) return 'Booking Received';
  const low = raw.toLowerCase();
  if (low === 'booked') return 'Booking Received';
  if (low === 'pending') return 'Order Processing';
  if (low === 'delivered') return 'Delivered Successfully';
  if (low === 'cancelled') return 'Booking Cancelled';
  if (GAS_BOOKING_STATUSES.includes(raw)) return raw;
  return 'Booking Received';
}

export function isBookingCancelledStatus(status) {
  const s = normalizeGasBookingStatus(status);
  return s === 'Booking Cancelled' || String(status || '').trim() === 'Cancelled';
}

export function isBookingDeliveredStatus(status) {
  const s = normalizeGasBookingStatus(status);
  return s === 'Delivered Successfully' || String(status || '').trim() === 'Delivered';
}

export const DEFAULT_DELIVERY_PRICING_CONFIG = {
  defaultMethod: 'Distance-Based Tiers',
  fixedCharge: 30,
  perKmRate: 6,
  distanceTiers: [
    { id: 'TIER-1', minKm: 0, maxKm: 2, label: '0–2 KM', charge: 20 },
    { id: 'TIER-2', minKm: 2, maxKm: 5, label: '2–5 KM', charge: 30 },
    { id: 'TIER-3', minKm: 5, maxKm: 8, label: '5–8 KM', charge: 40 },
    { id: 'TIER-4', minKm: 8, maxKm: 10, label: '8–10 KM', charge: 50 }
  ],
  aboveMaxTierDefaultCharge: 70
};

export const DEFAULT_CYLINDER_TYPES = [
  { id: 'CYL-14', name: '14.2 Kg', defaultPrice: 900, isActive: true },
  { id: 'CYL-5', name: '5 Kg', defaultPrice: 350, isActive: true },
  { id: 'CYL-19', name: '19 Kg', defaultPrice: 1850, isActive: true },
  { id: 'CYL-OTHER', name: 'Other', defaultPrice: 0, isActive: true }
];

export const DEFAULT_MAIN_CENTRE = {
  name: 'MUN COMPUTER (Main Centre)',
  fullAddress:
    'Vill: Mamudpur (Chomatha More), P.O.: Juginda, P.S.: Domkal, Dist.: Murshidabad, West Bengal - 742406, India',
  geocodeQuery: 'Mamudpur, Juginda, Domkal, Murshidabad, West Bengal 742406, India',
  lat: null,
  lng: null
};

export const DEFAULT_GAS_SETTINGS = {
  defaultEligibilityDays: 30,
  intervalPresets: [25, 30, 45, 60],
  nonTakerReferencePresets: [120, 130],
  gasCompanies: ['Indane', 'HP Gas', 'Bharatgas'],
  connectionCategories: ['Domestic', 'Commercial', 'Ujjwala', 'PMUY'],
  cylinderTypes: DEFAULT_CYLINDER_TYPES,
  agencies: [],
  deliveryAreas: [],
  paymentMethods: ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other'],
  deliveryPricingConfig: DEFAULT_DELIVERY_PRICING_CONFIG,
  mainCentre: DEFAULT_MAIN_CENTRE,
  storageLocations: ['Main Counter', 'Gas Godown / Store Room'],
  defaultServiceCharges: {
    regulatorChange: 150,
    pipeChange: 100,
    bothChange: 200,
    otherService: 100
  },
  defaultPipeServiceCycleDays: 730,
  allowNegativeStockAdminOverride: true,
  autoSyncCustomerDirectory: true,
  updatedAt: ''
};

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normStr(val) {
  return String(val ?? '').trim();
}

function normKey(val) {
  return String(val ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export function addDaysIso(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + (Number(days) || 0));
  return d.toISOString().slice(0, 10);
}

export function diffDaysIso(fromDateStr, toDateStr) {
  if (!fromDateStr || !toDateStr) return null;
  const d1 = new Date(`${String(fromDateStr).slice(0, 10)}T00:00:00Z`);
  const d2 = new Date(`${String(toDateStr).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

function getActorInfo() {
  const u = getCurrentUser();
  return {
    user: u,
    uid: u?.uid || u?.id || 'SYSTEM',
    name: u?.name || 'System Operator',
    role: String(u?.role || 'STAFF').trim().toUpperCase(),
    isAdmin: Boolean(u && (isSuperAdmin(u) || String(u.role || '').trim().toUpperCase() === 'ADMIN'))
  };
}

/* =========================================================================
   RBAC & AUDIT TRAIL
   ========================================================================= */

export function canPerformGasAction(actionType = 'view', menuId = 'gas-dashboard') {
  const actor = getActorInfo();
  if (!actor.user) return false;
  if (actor.isAdmin) return true;

  switch (actionType) {
    case 'settings':
      return canMenu('gas-settings', 'edit', actor.user) || canMenu('gas-settings', 'add', actor.user);
    case 'reverse':
    case 'negativeStockOverride':
    case 'priceOverride':
      return false; // Strictly Admin-only unless Admin role
    case 'delete':
      return canMenu(menuId, 'delete', actor.user);
    case 'approve':
      return canMenu(menuId, 'approve', actor.user);
    case 'export':
      return canMenu(menuId, 'export', actor.user);
    case 'print':
      return canMenu(menuId, 'print', actor.user);
    case 'edit':
      return canMenu(menuId, 'edit', actor.user);
    case 'add':
      return canMenu(menuId, 'add', actor.user);
    default:
      return canMenu(menuId, 'view', actor.user);
  }
}

export function getGasAuditLogs() {
  return getItem(KEYS.GAS_AUDIT_LOGS, []);
}

export function logGasAudit(action, details, meta = {}) {
  const actor = getActorInfo();
  const logs = getGasAuditLogs();
  const entry = {
    id: '',
    timestamp: new Date().toISOString(),
    date: getTodayDate(),
    action: String(action || 'GAS_ACTION'),
    details: String(details || ''),
    actorUid: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    meta
  };
  logs.unshift(entry);
  if (logs.length > 800) logs.pop();
  setItem(KEYS.GAS_AUDIT_LOGS, logs);
  logAuditAction(entry.action, entry.details, actor.name);
  scheduleGasServerSync();
  if (getCurrentUser()) {
    allocateGlobalReference('AUD', { entityType: 'GAS_AUDIT_LOG' }).then((refNo) => {
      entry.id = refNo;
      const latest = getGasAuditLogs();
      const idx = latest.findIndex(x => x.timestamp === entry.timestamp && x.action === entry.action && !x.id);
      if (idx !== -1) {
        latest[idx].id = refNo;
        setItem(KEYS.GAS_AUDIT_LOGS, latest);
      }
    }).catch(() => {});
  }
  return entry;
}

/* =========================================================================
   SERVER SYNC (OPTIONAL NON-BLOCKING BRIDGE TO /api/gas/state)
   ========================================================================= */

let _gasSyncTimer = null;

export function getGasStateBundle() {
  return {
    customers: getAllGasCustomers(),
    bookings: getAllGasBookings(),
    deliveryPersons: getAllGasDeliveryPersons(),
    eligibilityRules: getAllGasEligibilityRules(),
    subsidies: getAllGasSubsidies(),
    nonTakerLedgers: getAllNonTakerLedgers(),
    collections: getAllGasCollections(),
    warehouses: getAllGasWarehouses(),
    stockMovements: getAllGasStockMovements(),
    damagedStock: getAllGasDamagedStock(),
    suppliers: getAllGasSuppliers(),
    purchases: getAllGasPurchases(),
    serviceEntries: getAllGasServiceEntries(),
    auditLogs: getGasAuditLogs(),
    settings: getGasSettings(),
    inventorySnapshot: getAllInventory()
  };
}

export function scheduleGasServerSync() {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  if (!getCurrentUser()) return;
  if (_gasSyncTimer) clearTimeout(_gasSyncTimer);
  _gasSyncTimer = setTimeout(() => {
    _gasSyncTimer = null;
    pushGasStateToServer();
  }, 450);
}

export async function pushGasStateToServer() {
  if (typeof fetch !== 'function' || !getCurrentUser()) return false;
  try {
    const res = await fetch('/api/gas/state', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(getGasStateBundle())
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function syncGasStateFromServer() {
  if (typeof fetch !== 'function' || !getCurrentUser()) return null;
  try {
    const res = await fetch('/api/gas/state', { headers: getAuthHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    const gs = data?.gasState;
    if (!gs || typeof gs !== 'object') return null;

    const mapKeys = [
      ['customers', KEYS.GAS_CUSTOMERS],
      ['bookings', KEYS.GAS_BOOKINGS],
      ['deliveryPersons', KEYS.GAS_DELIVERY_PERSONS],
      ['eligibilityRules', KEYS.GAS_ELIGIBILITY_RULES],
      ['subsidies', KEYS.GAS_SUBSIDY],
      ['nonTakerLedgers', KEYS.GAS_NON_TAKER_LEDGER],
      ['collections', KEYS.GAS_COLLECTIONS],
      ['warehouses', KEYS.GAS_WAREHOUSES],
      ['stockMovements', KEYS.GAS_STOCK_MOVEMENTS],
      ['damagedStock', KEYS.GAS_DAMAGED_STOCK],
      ['suppliers', KEYS.GAS_SUPPLIERS],
      ['purchases', KEYS.GAS_PURCHASES],
      ['serviceEntries', KEYS.GAS_SERVICE_ENTRIES],
      ['auditLogs', KEYS.GAS_AUDIT_LOGS]
    ];
    for (const [prop, storageKey] of mapKeys) {
      const localArr = getItem(storageKey, []);
      if ((!Array.isArray(localArr) || localArr.length === 0) && Array.isArray(gs[prop]) && gs[prop].length > 0) {
        setItem(storageKey, gs[prop]);
      }
    }
    if (gs.settings && typeof gs.settings === 'object' && !getItem(KEYS.GAS_SETTINGS, null)) {
      setItem(KEYS.GAS_SETTINGS, normalizeGasSettingsObject(gs.settings));
    }
    const localInv = getAllInventory();
    if ((!Array.isArray(localInv) || localInv.length === 0) && Array.isArray(gs.inventorySnapshot) && gs.inventorySnapshot.length > 0) {
      setItem(KEYS.INVENTORY, gs.inventorySnapshot);
    }
    return gs;
  } catch {
    return null;
  }
}

/* =========================================================================
   13. GAS SETTINGS, AGENCIES, CYLINDERS, AREAS & PRICING RULES
   ========================================================================= */

function normalizeAgenciesList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set();
  const out = [];
  rawList.forEach((item, i) => {
    const obj = typeof item === 'string' ? { name: item } : item;
    const name = normStr(obj?.name);
    if (!name) return;
    const key = name.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: normStr(obj?.id) || `AGY-${i + 1}`,
      name,
      company: normStr(obj?.company) || '',
      code: normStr(obj?.code) || '',
      phone: normStr(obj?.phone) || '',
      address: normStr(obj?.address) || '',
      isActive: obj?.isActive !== false
    });
  });
  return out;
}

function normalizeCylinderTypesList(rawList) {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return DEFAULT_CYLINDER_TYPES.map(c => ({ ...c }));
  }
  const seen = new Set();
  const out = [];
  rawList.forEach((item, i) => {
    const obj = typeof item === 'string' ? { name: item } : item;
    const name = normStr(obj?.name);
    if (!name) return;
    const key = name.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    const preset = DEFAULT_CYLINDER_TYPES.find(d => d.name.toUpperCase() === key);
    out.push({
      id: normStr(obj?.id) || preset?.id || `CYL-${i + 1}`,
      name,
      defaultPrice: Math.max(0, Number(obj?.defaultPrice ?? preset?.defaultPrice ?? 900) || 0),
      isActive: obj?.isActive !== false
    });
  });
  return out.length > 0 ? out : DEFAULT_CYLINDER_TYPES.map(c => ({ ...c }));
}

function normalizeDeliveryAreasList(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter(a => a && normStr(a.name))
    .map((a, i) => ({
      id: normStr(a.id) || `AREA-${i + 1}`,
      name: normStr(a.name),
      distanceKm: Number.isFinite(Number(a.distanceKm)) ? Math.max(0, Number(a.distanceKm)) : 0,
      charge: Math.max(0, round2(Number(a.charge) || 0)),
      isActive: a.isActive !== false
    }));
}

function normalizeGasSettingsObject(stored = {}) {
  const s = stored && typeof stored === 'object' ? stored : {};
  const pricing = s.deliveryPricingConfig && typeof s.deliveryPricingConfig === 'object' ? s.deliveryPricingConfig : {};
  const tiers = Array.isArray(pricing.distanceTiers) && pricing.distanceTiers.length > 0
    ? pricing.distanceTiers.map((t, i) => ({
        id: normStr(t.id) || `TIER-${i + 1}`,
        minKm: Math.max(0, Number(t.minKm) || 0),
        maxKm: Math.max(0, Number(t.maxKm) || 0),
        label: normStr(t.label) || `${Number(t.minKm) || 0}–${Number(t.maxKm) || 0} KM`,
        charge: Math.max(0, round2(Number(t.charge) || 0))
      }))
    : DEFAULT_DELIVERY_PRICING_CONFIG.distanceTiers.map(t => ({ ...t }));

  return {
    ...DEFAULT_GAS_SETTINGS,
    ...s,
    intervalPresets: Array.isArray(s.intervalPresets) ? [...s.intervalPresets] : [...DEFAULT_GAS_SETTINGS.intervalPresets],
    nonTakerReferencePresets: Array.isArray(s.nonTakerReferencePresets) && s.nonTakerReferencePresets.length > 0
      ? [...s.nonTakerReferencePresets]
      : [...DEFAULT_GAS_SETTINGS.nonTakerReferencePresets],
    gasCompanies: Array.isArray(s.gasCompanies) && s.gasCompanies.length > 0
      ? [...s.gasCompanies]
      : [...DEFAULT_GAS_SETTINGS.gasCompanies],
    connectionCategories: Array.isArray(s.connectionCategories) && s.connectionCategories.length > 0
      ? [...s.connectionCategories]
      : [...DEFAULT_GAS_SETTINGS.connectionCategories],
    cylinderTypes: normalizeCylinderTypesList(s.cylinderTypes),
    agencies: normalizeAgenciesList(s.agencies),
    deliveryAreas: normalizeDeliveryAreasList(s.deliveryAreas),
    paymentMethods: Array.isArray(s.paymentMethods) && s.paymentMethods.length > 0
      ? [...s.paymentMethods]
      : [...DEFAULT_GAS_SETTINGS.paymentMethods],
    deliveryPricingConfig: {
      ...DEFAULT_DELIVERY_PRICING_CONFIG,
      ...pricing,
      distanceTiers: tiers
    },
    mainCentre: {
      ...DEFAULT_MAIN_CENTRE,
      ...(s.mainCentre && typeof s.mainCentre === 'object' ? s.mainCentre : {})
    },
    storageLocations: Array.isArray(s.storageLocations) && s.storageLocations.length > 0
      ? [...s.storageLocations]
      : [...DEFAULT_GAS_SETTINGS.storageLocations],
    defaultServiceCharges: {
      ...DEFAULT_GAS_SETTINGS.defaultServiceCharges,
      ...(s.defaultServiceCharges || {})
    }
  };
}

export function getGasSettings() {
  const stored = getItem(KEYS.GAS_SETTINGS, null);
  return normalizeGasSettingsObject(stored || {});
}

export function saveGasSettings(updates = {}, { allowCustomerAgencyWrite = false, allowMainCentreGeoSave = false } = {}) {
  const allowed =
    canPerformGasAction('settings', 'gas-settings') ||
    (allowCustomerAgencyWrite && (canPerformGasAction('add', 'gas-customers') || canPerformGasAction('edit', 'gas-customers'))) ||
    (allowMainCentreGeoSave && canPerformGasAction('view', 'gas-customers'));
  if (!allowed) {
    return { success: false, message: 'Permission Denied: Only Administration or authorized roles can modify Gas Settings.' };
  }
  const current = getGasSettings();
  const merged = {
    ...current,
    ...updates,
    defaultEligibilityDays: Math.max(1, Math.min(365, parseInt(updates.defaultEligibilityDays ?? current.defaultEligibilityDays, 10) || 30)),
    defaultPipeServiceCycleDays: Math.max(30, parseInt(updates.defaultPipeServiceCycleDays ?? current.defaultPipeServiceCycleDays, 10) || 730),
    allowNegativeStockAdminOverride: updates.allowNegativeStockAdminOverride !== undefined
      ? Boolean(updates.allowNegativeStockAdminOverride)
      : current.allowNegativeStockAdminOverride,
    autoSyncCustomerDirectory: updates.autoSyncCustomerDirectory !== undefined
      ? Boolean(updates.autoSyncCustomerDirectory)
      : current.autoSyncCustomerDirectory,
    defaultServiceCharges: {
      ...current.defaultServiceCharges,
      ...(updates.defaultServiceCharges || {})
    },
    deliveryPricingConfig: updates.deliveryPricingConfig
      ? { ...current.deliveryPricingConfig, ...updates.deliveryPricingConfig }
      : current.deliveryPricingConfig,
    mainCentre: updates.mainCentre
      ? { ...current.mainCentre, ...updates.mainCentre }
      : current.mainCentre,
    updatedAt: new Date().toISOString()
  };
  const next = normalizeGasSettingsObject(merged);
  setItem(KEYS.GAS_SETTINGS, next);
  logGasAudit('GAS_SETTINGS_UPDATE', `Updated Gas Settings (Eligibility: ${next.defaultEligibilityDays}d, Agencies: ${next.agencies.length})`);
  return { success: true, settings: next };
}

export function getGasAgencies({ activeOnly = false } = {}) {
  const list = getGasSettings().agencies || [];
  return activeOnly ? list.filter(a => a.isActive !== false) : list;
}

export async function saveGasAgency(data = {}) {
  const canEdit =
    canPerformGasAction('settings', 'gas-settings') ||
    canPerformGasAction('add', 'gas-customers') ||
    canPerformGasAction('edit', 'gas-customers');
  if (!canEdit) {
    return { success: false, message: 'Permission Denied: Not authorized to manage Gas Agencies.' };
  }
  const name = normStr(data.name);
  if (!name) return { success: false, message: 'Agency / Distributor Name is required.' };
  const s = getGasSettings();
  const agencies = [...s.agencies];
  const isEdit = Boolean(data.id);
  const dup = agencies.find(a => a.id !== data.id && a.name.toUpperCase() === name.toUpperCase());
  if (dup) {
    return { success: false, message: `Agency "${name}" already exists.` };
  }
  const rec = {
    id: normStr(data.id) || await allocateGlobalReference('GASDP', { entityType: 'GAS_AGENCY' }),
    name,
    company: normStr(data.company),
    code: normStr(data.code),
    phone: normStr(data.phone),
    address: normStr(data.address),
    isActive: data.isActive !== false
  };
  if (isEdit) {
    const idx = agencies.findIndex(a => a.id === data.id);
    if (idx !== -1) agencies[idx] = rec;
    else agencies.push(rec);
  } else {
    agencies.push(rec);
  }
  const res = saveGasSettings({ agencies }, { allowCustomerAgencyWrite: true });
  if (!res.success) return res;
  return { success: true, agency: rec, settings: res.settings };
}

export function deleteGasAgency(id) {
  const canEdit =
    canPerformGasAction('settings', 'gas-settings') ||
    canPerformGasAction('edit', 'gas-customers');
  if (!canEdit) {
    return { success: false, message: 'Permission Denied: Not authorized to delete Gas Agencies.' };
  }
  const s = getGasSettings();
  const nextAgencies = (s.agencies || []).filter(a => a.id !== id);
  markGlobalReferenceDeleted(id).catch(() => {});
  return saveGasSettings({ agencies: nextAgencies }, { allowCustomerAgencyWrite: true });
}

export function getGasCylinderTypes({ activeOnly = false } = {}) {
  const list = getGasSettings().cylinderTypes || [];
  return activeOnly ? list.filter(c => c.isActive !== false) : list;
}

export async function saveGasCylinderType(data = {}) {
  if (!canPerformGasAction('settings', 'gas-settings')) {
    return { success: false, message: 'Permission Denied: Only Administration can manage Cylinder Types.' };
  }
  const name = normStr(data.name);
  if (!name) return { success: false, message: 'Cylinder Type Name is required.' };
  const s = getGasSettings();
  const list = [...s.cylinderTypes];
  const dup = list.find(c => c.id !== data.id && c.name.toUpperCase() === name.toUpperCase());
  if (dup) return { success: false, message: `Cylinder Type "${name}" already exists.` };
  const rec = {
    id: normStr(data.id) || await allocateGlobalReference('PRD', { entityType: 'GAS_CYLINDER_TYPE' }),
    name,
    defaultPrice: Math.max(0, round2(Number(data.defaultPrice) || 0)),
    isActive: data.isActive !== false
  };
  const idx = list.findIndex(c => c.id === rec.id);
  if (idx !== -1) list[idx] = rec;
  else list.push(rec);
  const res = saveGasSettings({ cylinderTypes: list });
  return res.success ? { success: true, cylinderType: rec, settings: res.settings } : res;
}

export function deleteGasCylinderType(id) {
  if (!canPerformGasAction('settings', 'gas-settings')) {
    return { success: false, message: 'Permission Denied: Only Administration can delete Cylinder Types.' };
  }
  const s = getGasSettings();
  const next = (s.cylinderTypes || []).filter(c => c.id !== id);
  markGlobalReferenceDeleted(id).catch(() => {});
  return saveGasSettings({ cylinderTypes: next });
}

export function getGasDeliveryAreas({ activeOnly = false } = {}) {
  const list = getGasSettings().deliveryAreas || [];
  return activeOnly ? list.filter(a => a.isActive !== false) : list;
}

export async function saveGasDeliveryArea(data = {}) {
  if (!canPerformGasAction('settings', 'gas-settings')) {
    return { success: false, message: 'Permission Denied: Only Administration can manage Delivery Areas.' };
  }
  const name = normStr(data.name);
  if (!name) return { success: false, message: 'Area / Village Name is required.' };
  const s = getGasSettings();
  const list = [...s.deliveryAreas];
  const dup = list.find(a => a.id !== data.id && a.name.toUpperCase() === name.toUpperCase());
  if (dup) return { success: false, message: `Delivery Area "${name}" already exists.` };
  const rec = {
    id: normStr(data.id) || await allocateGlobalReference('SITEM', { entityType: 'GAS_DELIVERY_AREA' }),
    name,
    distanceKm: Math.max(0, Number(data.distanceKm) || 0),
    charge: Math.max(0, round2(Number(data.charge) || 0)),
    isActive: data.isActive !== false
  };
  const idx = list.findIndex(a => a.id === rec.id);
  if (idx !== -1) list[idx] = rec;
  else list.push(rec);
  const res = saveGasSettings({ deliveryAreas: list });
  return res.success ? { success: true, area: rec, settings: res.settings } : res;
}

export function deleteGasDeliveryArea(id) {
  if (!canPerformGasAction('settings', 'gas-settings')) {
    return { success: false, message: 'Permission Denied: Only Administration can delete Delivery Areas.' };
  }
  const s = getGasSettings();
  const next = (s.deliveryAreas || []).filter(a => a.id !== id);
  markGlobalReferenceDeleted(id).catch(() => {});
  return saveGasSettings({ deliveryAreas: next });
}

export function calculateSuggestedDeliveryCharge({
  method = '',
  distanceKm = 0,
  areaId = '',
  areaName = '',
  customCharge = null
} = {}) {
  const s = getGasSettings();
  const cfg = s.deliveryPricingConfig || DEFAULT_DELIVERY_PRICING_CONFIG;
  const activeMethod = GAS_DELIVERY_PRICING_METHODS.includes(method) ? method : (cfg.defaultMethod || 'Distance-Based Tiers');
  const km = Math.max(0, Number(distanceKm) || 0);

  if (activeMethod === 'Free Delivery') {
    return { charge: 0, method: activeMethod, note: 'Free Delivery applied' };
  }
  if (activeMethod === 'Custom Manual Charge') {
    const manual = Math.max(0, round2(Number(customCharge) || 0));
    return { charge: manual, method: activeMethod, note: 'Custom manual charge' };
  }
  if (activeMethod === 'Fixed Charge') {
    const fixed = Math.max(0, round2(Number(cfg.fixedCharge) || 0));
    return { charge: fixed, method: activeMethod, note: `Fixed Delivery Charge (₹${fixed})` };
  }
  if (activeMethod === 'Per KM Charge') {
    const rate = Math.max(0, Number(cfg.perKmRate) || 0);
    const calc = round2(km * rate);
    return { charge: calc, method: activeMethod, note: `${km} KM × ₹${rate}/KM` };
  }
  if (activeMethod === 'Area/Village-Based Charge') {
    const areas = getGasDeliveryAreas({ activeOnly: true });
    const match = areas.find(
      a => (areaId && a.id === areaId) || (areaName && a.name.toLowerCase() === String(areaName).trim().toLowerCase())
    );
    if (match) {
      return { charge: Math.max(0, round2(match.charge)), method: activeMethod, note: `Area Tariff: ${match.name}` };
    }
    return { charge: Math.max(0, round2(Number(customCharge ?? cfg.fixedCharge) || 0)), method: activeMethod, note: 'Area not mapped; using default' };
  }

  // Distance-Based Tiers (default)
  const tiers = [...(cfg.distanceTiers || [])].sort((a, b) => Number(a.minKm) - Number(b.minKm));
  if (km <= 0 && tiers.length > 0) {
    return { charge: Math.max(0, round2(tiers[0].charge)), method: activeMethod, note: tiers[0].label || 'Base tier' };
  }
  const matched = tiers.find(t => km >= Number(t.minKm) && km <= Number(t.maxKm));
  if (matched) {
    return { charge: Math.max(0, round2(matched.charge)), method: activeMethod, note: `Tier: ${matched.label} (₹${matched.charge})` };
  }
  const above = Math.max(0, round2(Number(cfg.aboveMaxTierDefaultCharge ?? 70) || 0));
  return { charge: above, method: activeMethod, note: 'Above 10 KM (Custom/Extended Tier)' };
}

/* =========================================================================
   DELIVERY PERSONNEL MANAGEMENT (CRUD)
   ========================================================================= */

export function getAllGasDeliveryPersons({ activeOnly = false } = {}) {
  const list = getItem(KEYS.GAS_DELIVERY_PERSONS, []);
  const clean = Array.isArray(list) ? list : [];
  return activeOnly ? clean.filter(p => p.isActive !== false) : clean;
}

export function getGasDeliveryPersonById(id) {
  return getAllGasDeliveryPersons().find(p => p.id === id) || null;
}

export async function saveGasDeliveryPerson(data = {}) {
  const canManage =
    canPerformGasAction('settings', 'gas-settings') ||
    canPerformGasAction('edit', 'gas-bookings') ||
    canPerformGasAction('add', 'gas-bookings');
  if (!canManage) {
    return { success: false, message: 'Permission Denied: Not authorized to manage Delivery Personnel.' };
  }
  const name = normStr(data.name);
  const mobileDigits = normStr(data.mobile).replace(/\D/g, '');
  if (!name) return { success: false, message: 'Delivery Person Name is required.' };
  if (mobileDigits.length < 10) return { success: false, message: 'Valid 10-digit Mobile Number is required.' };

  const list = getAllGasDeliveryPersons();
  const mobile = mobileDigits.slice(-10);
  const dup = list.find(p => p.id !== data.id && String(p.mobile || '').replace(/\D/g, '').slice(-10) === mobile);
  if (dup) {
    return { success: false, message: `Mobile ${mobile} is already assigned to ${dup.name} (${dup.id}).` };
  }

  const nowIso = new Date().toISOString();
  const availabilityStatus = ['Available', 'On Delivery', 'Off Duty'].includes(data.availabilityStatus)
    ? data.availabilityStatus
    : 'Available';

  if (data.id) {
    const idx = list.findIndex(p => p.id === data.id);
    if (idx === -1) return { success: false, message: 'Delivery person record not found.' };
    list[idx] = {
      ...list[idx],
      name,
      mobile,
      address: normStr(data.address ?? list[idx].address),
      assignedArea: normStr(data.assignedArea ?? list[idx].assignedArea),
      vehicleInfo: normStr(data.vehicleInfo ?? list[idx].vehicleInfo),
      availabilityStatus,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : list[idx].isActive !== false,
      updatedAt: nowIso
    };
    setItem(KEYS.GAS_DELIVERY_PERSONS, list);
    logGasAudit('GAS_RIDER_UPDATE', `Updated Delivery Person ${list[idx].name} (${list[idx].id})`);
    return { success: true, person: list[idx] };
  }

  const personId = await allocateGlobalReference('GASDP', { entityType: 'GAS_DELIVERY_PERSON' });
  const person = {
    id: personId,
    name,
    mobile,
    address: normStr(data.address),
    assignedArea: normStr(data.assignedArea),
    vehicleInfo: normStr(data.vehicleInfo),
    availabilityStatus,
    isActive: data.isActive !== false,
    createdAt: nowIso,
    updatedAt: nowIso
  };
  list.unshift(person);
  setItem(KEYS.GAS_DELIVERY_PERSONS, list);
  logGasAudit('GAS_RIDER_ADD', `Added Delivery Person ${person.name} (${person.id})`);
  return { success: true, person };
}

export function toggleGasDeliveryPersonStatus(id) {
  const canManage =
    canPerformGasAction('settings', 'gas-settings') ||
    canPerformGasAction('edit', 'gas-bookings');
  if (!canManage) return { success: false, message: 'Permission Denied.' };
  const list = getAllGasDeliveryPersons();
  const idx = list.findIndex(p => p.id === id);
  if (idx === -1) return { success: false, message: 'Delivery person not found.' };
  list[idx] = {
    ...list[idx],
    isActive: list[idx].isActive === false,
    updatedAt: new Date().toISOString()
  };
  setItem(KEYS.GAS_DELIVERY_PERSONS, list);
  logGasAudit('GAS_RIDER_TOGGLE', `${list[idx].name} set to ${list[idx].isActive ? 'Active' : 'Inactive'}`);
  return { success: true, person: list[idx] };
}

export function deleteGasDeliveryPerson(id) {
  const canManage =
    canPerformGasAction('settings', 'gas-settings') ||
    canPerformGasAction('delete', 'gas-bookings');
  if (!canManage) return { success: false, message: 'Permission Denied.' };
  const list = getAllGasDeliveryPersons();
  const target = list.find(p => p.id === id);
  if (!target) return { success: false, message: 'Delivery person not found.' };

  const activeAssigned = getAllGasBookings().filter(
    b => b.deliveryPersonId === id && !isBookingDeliveredStatus(b.deliveryStatus) && !isBookingCancelledStatus(b.deliveryStatus)
  );
  if (activeAssigned.length > 0) {
    return {
      success: false,
      message: `Cannot delete ${target.name}: currently assigned to ${activeAssigned.length} active booking(s). Set Inactive instead.`
    };
  }
  setItem(KEYS.GAS_DELIVERY_PERSONS, list.filter(p => p.id !== id));
  markGlobalReferenceDeleted(id).catch(() => {});
  logGasAudit('GAS_RIDER_DELETE', `Deleted Delivery Person ${target.name} (${target.id})`);
  return { success: true };
}

/* =========================================================================
   2. GAS CUSTOMER REGISTER
   ========================================================================= */

export function getAllGasCustomers() {
  return getItem(KEYS.GAS_CUSTOMERS, []);
}

export function getGasCustomerById(id) {
  return getAllGasCustomers().find(c => c.id === id) || null;
}

export function findGasCustomerByConsumerId(consumerId, excludeId = null) {
  const target = normKey(consumerId);
  if (!target) return null;
  return getAllGasCustomers().find(c => {
    if (excludeId && c.id === excludeId) return false;
    return normKey(c.consumerId) === target || normKey(c.lpgId17) === target;
  }) || null;
}

export function findGasCustomerByLpgId17(lpgId17, excludeId = null) {
  const target = normKey(lpgId17);
  if (!target) return null;
  return getAllGasCustomers().find(c => {
    if (excludeId && c.id === excludeId) return false;
    return normKey(c.lpgId17) === target || normKey(c.consumerId) === target;
  }) || null;
}

function formatMaskedBankLast4(rawVal) {
  const str = normStr(rawVal);
  if (!str) return '';
  const digits = str.replace(/\D/g, '').slice(-4);
  if (!digits) return '';
  return `XXXX${digits}`;
}

function normalizeBankAccountLast4(rawVal) {
  const str = normStr(rawVal);
  if (!str) return { valid: true, digits: '', masked: '' };
  const stripped = /^X{2,4}\d{4}$/i.test(str) ? str.slice(-4) : str;
  if (!/^\d{4}$/.test(stripped)) {
    return {
      valid: false,
      digits: '',
      masked: '',
      message: 'Bank Account Number (Last 4 Digits Only) must contain strictly 4 numeric digits (e.g., 1234).'
    };
  }
  return { valid: true, digits: stripped, masked: `XXXX${stripped}` };
}

export function normalizeBankSeedStatus(rawVal) {
  const low = normStr(rawVal).toLowerCase();
  if (!low || low === 'pending') return 'Pending';
  if (low === 'yes - active' || low === 'npci seeded' || low === 'linked' || low === 'yes' || low === 'active') {
    return 'Yes - Active';
  }
  if (low === 'not linked' || low === 'no') return 'Not Linked';
  return normStr(rawVal) || 'Pending';
}

export function buildCustomerStructuredAddress(data = {}) {
  const areaType = normStr(data.areaType).toUpperCase();
  const vilLabel = areaType === 'URBAN' ? 'Locality' : 'Vill';
  const prefixParts = [
    normStr(data.houseNo) ? `House ${normStr(data.houseNo)}` : '',
    normStr(data.street),
    normStr(data.paraLocality),
    normStr(data.landmark) ? `Near ${normStr(data.landmark)}` : ''
  ].filter(Boolean);
  const cascadeParts = [
    normStr(data.village) ? `${vilLabel}: ${normStr(data.village)}` : '',
    areaType === 'URBAN' && normStr(data.gpOrWard) ? normStr(data.gpOrWard) : '',
    areaType === 'URBAN' && normStr(data.blockOrMunicipality) ? normStr(data.blockOrMunicipality) : '',
    areaType !== 'URBAN' && normStr(data.gpOrWard) ? `GP: ${normStr(data.gpOrWard)}` : '',
    areaType !== 'URBAN' && normStr(data.blockOrMunicipality) ? `Block: ${normStr(data.blockOrMunicipality)}` : '',
    normStr(data.postOffice) ? `P.O.: ${normStr(data.postOffice)}` : '',
    normStr(data.policeStation) ? `P.S.: ${normStr(data.policeStation)}` : '',
    normStr(data.district) ? `Dist: ${normStr(data.district)}` : '',
    normStr(data.state)
  ].filter(Boolean);
  const base = [...prefixParts, ...cascadeParts].join(', ');
  const pin = normStr(data.pinCode);
  return base + (pin ? `${base ? ' - ' : 'PIN: '}${pin}` : '');
}

export async function saveGasCustomer(data = {}) {
  const isEdit = Boolean(data.id);
  if (!canPerformGasAction(isEdit ? 'edit' : 'add', 'gas-customers')) {
    return { success: false, message: 'Permission Denied: You are not authorized to save Gas Customers.' };
  }

  const fullName = normStr(data.fullName || data.name);
  const guardianName = normStr(data.guardianName);
  const mobile = normStr(data.mobile || data.phone).replace(/[^0-9+]/g, '');
  const consumerId = normStr(data.consumerId);
  const lpgId17 = normStr(data.lpgId17);

  if (!fullName) {
    return { success: false, message: 'Customer Full Name is required.' };
  }
  if (!guardianName) {
    return { success: false, message: 'Father / Guardian Name is required.' };
  }
  const mobileDigits = mobile.replace(/[^0-9]/g, '');
  if (mobileDigits.length < 10) {
    return { success: false, message: 'Valid 10-digit Mobile / WhatsApp Number is required.' };
  }
  const primaryMobile = mobileDigits.slice(-10);

  const sameAsWa = data.sameAsWhatsapp !== undefined ? Boolean(data.sameAsWhatsapp) : undefined;
  const rawWaDigits = normStr(data.whatsapp ?? data.altMobile).replace(/[^0-9]/g, '');
  if (sameAsWa === false && rawWaDigits && rawWaDigits.length < 10) {
    return { success: false, message: 'Secondary WhatsApp Number must be 10 digits (or check "Same as WhatsApp").' };
  }
  const resolvedWhatsapp = sameAsWa === true
    ? primaryMobile
    : (rawWaDigits.length >= 10 ? rawWaDigits.slice(-10) : primaryMobile);

  const bankAcCheck = normalizeBankAccountLast4(
    data.bankAccountLast4 !== undefined ? data.bankAccountLast4 : data.maskedAccount
  );
  if (!bankAcCheck.valid) {
    return { success: false, message: bankAcCheck.message };
  }

  if (consumerId) {
    const dup = findGasCustomerByConsumerId(consumerId, data.id || null);
    if (dup) {
      return {
        success: false,
        message: `Duplicate Consumer ID detected: "${consumerId}" is already registered to ${dup.fullName} (${dup.id}).`
      };
    }
  }
  if (lpgId17) {
    const clean17 = lpgId17.replace(/\s+/g, '');
    if (/^\d+$/.test(clean17) && clean17.length !== 17) {
      return {
        success: false,
        message: '17-Digit LPG ID must contain exactly 17 digits (or leave blank since it is optional).'
      };
    }
    const dup17 = findGasCustomerByLpgId17(clean17, data.id || null);
    if (dup17) {
      return {
        success: false,
        message: `Duplicate 17-Digit LPG ID detected: "${clean17}" is already registered to ${dup17.fullName} (${dup17.id}).`
      };
    }
  }

  const list = getAllGasCustomers();
  const settings = getGasSettings();
  const actor = getActorInfo();
  const nowIso = new Date().toISOString();

  const agencies = getGasAgencies();
  const agencyObj = agencies.find(
    a => (data.agencyId && a.id === data.agencyId) || (data.agencyName && a.name.toUpperCase() === normStr(data.agencyName).toUpperCase())
  );
  const agencyId = agencyObj?.id || normStr(data.agencyId);
  const agencyName = agencyObj?.name || normStr(data.agencyName);

  const structuredAddr = buildCustomerStructuredAddress(data);
  const villageAddress = normStr(data.savedDeliveryAddress || data.villageAddress) || structuredAddr;

  const latNum = data.lat !== '' && data.lat !== null && data.lat !== undefined ? Number(data.lat) : null;
  const lngNum = data.lng !== '' && data.lng !== null && data.lng !== undefined ? Number(data.lng) : null;
  const lat = Number.isFinite(latNum) ? Number(latNum.toFixed(6)) : null;
  const lng = Number.isFinite(lngNum) ? Number(lngNum.toFixed(6)) : null;

  let linkedCustomerId = normStr(data.customerId);
  if (!linkedCustomerId && settings.autoSyncCustomerDirectory) {
    const existingCentral = getAllCustomers().find(c => {
      const p = String(c.phone || '').replace(/[^0-9]/g, '').slice(-10);
      return p && p === primaryMobile;
    });
    if (existingCentral) {
      linkedCustomerId = existingCentral.id;
    } else {
      const createdCentral = await saveCustomer({
        name: fullName,
        fatherName: guardianName,
        phone: primaryMobile,
        altPhone: resolvedWhatsapp,
        village: normStr(data.village) || normStr(villageAddress) || 'Mamudpur',
        postOffice: normStr(data.postOffice),
        policeStation: normStr(data.policeStation),
        district: normStr(data.district) || 'Murshidabad',
        state: normStr(data.state) || 'West Bengal',
        pinCode: normStr(data.pinCode),
        address: villageAddress,
        category: 'LPG & Gas Customer',
        services: ['LPG & Gas Services'],
        notes: `Linked Gas ID: ${consumerId || lpgId17 || 'LPG Customer'}`
      });
      if (createdCentral && createdCentral.id) {
        linkedCustomerId = createdCentral.id;
      }
    }
  }

  const customInterval = data.customIntervalDays !== '' && data.customIntervalDays !== undefined && data.customIntervalDays !== null
    ? Math.max(1, parseInt(data.customIntervalDays, 10) || 0)
    : null;

  if (isEdit) {
    const idx = list.findIndex(c => c.id === data.id);
    if (idx === -1) {
      return { success: false, message: 'Gas Customer record not found.' };
    }
    const prev = list[idx];
    const hasAcField = data.bankAccountLast4 !== undefined || data.maskedAccount !== undefined;
    const nextDigits = hasAcField ? bankAcCheck.digits : (normStr(prev.bankAccountLast4) || formatMaskedBankLast4(prev.maskedAccount).replace(/\D/g, ''));
    const nextMasked = hasAcField ? bankAcCheck.masked : (nextDigits ? `XXXX${nextDigits}` : formatMaskedBankLast4(prev.maskedAccount));

    const updated = {
      ...prev,
      fullName,
      guardianName,
      mobile: primaryMobile,
      altMobile: resolvedWhatsapp,
      whatsapp: resolvedWhatsapp,
      sameAsWhatsapp: sameAsWa !== undefined ? sameAsWa : (resolvedWhatsapp === primaryMobile),
      houseNo: normStr(data.houseNo ?? prev.houseNo),
      street: normStr(data.street ?? prev.street),
      paraLocality: normStr(data.paraLocality ?? prev.paraLocality),
      landmark: normStr(data.landmark ?? prev.landmark),
      areaType: normStr(data.areaType ?? prev.areaType) || 'RURAL',
      subdivision: normStr(data.subdivision ?? prev.subdivision),
      blockOrMunicipality: normStr(data.blockOrMunicipality ?? prev.blockOrMunicipality),
      gpOrWard: normStr(data.gpOrWard ?? prev.gpOrWard),
      wardId: normStr(data.wardId ?? prev.wardId),
      wardNo: normStr(data.wardNo ?? prev.wardNo),
      wardNumber: normStr(data.wardNumber ?? prev.wardNumber),
      village: normStr(data.village ?? prev.village),
      postOffice: normStr(data.postOffice ?? prev.postOffice),
      policeStation: normStr(data.policeStation ?? prev.policeStation),
      district: normStr(data.district ?? prev.district) || 'Murshidabad',
      state: normStr(data.state ?? prev.state) || 'West Bengal',
      pinCode: normStr(data.pinCode ?? prev.pinCode),
      villageAddress: villageAddress || prev.villageAddress || '',
      savedDeliveryAddress: villageAddress || prev.savedDeliveryAddress || prev.villageAddress || '',
      lat: lat !== null ? lat : (data.clearCoords ? null : (prev.lat ?? null)),
      lng: lng !== null ? lng : (data.clearCoords ? null : (prev.lng ?? null)),
      placeId: normStr(data.placeId ?? prev.placeId),
      mapPinLabel: normStr(data.mapPinLabel ?? prev.mapPinLabel),
      consumerId,
      lpgId17,
      gasCompany: normStr(data.gasCompany ?? prev.gasCompany) || 'Indane',
      agencyId: agencyId || (data.agencyName === '' ? '' : prev.agencyId || ''),
      agencyName: agencyName || (data.agencyName === '' ? '' : prev.agencyName || ''),
      connectionCategory: normStr(data.connectionCategory ?? prev.connectionCategory) || 'Domestic',
      cylinderType: normStr(data.cylinderType ?? prev.cylinderType) || '14.2 Kg',
      dbcStatus: normStr(data.dbcStatus ?? prev.dbcStatus) || 'Single',
      ekycStatus: normStr(data.ekycStatus ?? prev.ekycStatus) || 'Pending',
      bankLinkStatus: normalizeBankSeedStatus(data.bankLinkStatus ?? prev.bankLinkStatus),
      bankName: normStr(data.bankName ?? prev.bankName),
      bankAccountLast4: nextDigits,
      maskedAccount: nextMasked,
      subsidyEligible: data.subsidyEligible === 'No' || data.subsidyEligible === false ? 'No' : 'Yes',
      nonTakerFlag: data.nonTakerFlag === 'Yes' || data.nonTakerFlag === true ? 'Yes' : 'No',
      customIntervalDays: customInterval,
      status: normStr(data.status ?? prev.status) || 'Active',
      customerId: linkedCustomerId || prev.customerId || '',
      remarks: normStr(data.remarks ?? prev.remarks),
      updatedAt: nowIso,
      updatedByUid: actor.uid
    };
    delete updated.aadhaarKycStatus;
    list[idx] = updated;
    setItem(KEYS.GAS_CUSTOMERS, list);
    logGasAudit('GAS_CUSTOMER_UPDATE', `Updated Gas Customer ${updated.fullName} (${updated.consumerId || updated.lpgId17 || updated.id})`, { id: updated.id });
    return { success: true, customer: updated };
  }

  const gasCustomerId = await allocateGlobalReference('GASCUST', { entityType: 'GAS_CUSTOMER' });
  const newCustomer = {
    id: gasCustomerId,
    customerId: linkedCustomerId,
    fullName,
    guardianName,
    mobile: primaryMobile,
    altMobile: resolvedWhatsapp,
    whatsapp: resolvedWhatsapp,
    sameAsWhatsapp: sameAsWa !== undefined ? sameAsWa : (resolvedWhatsapp === primaryMobile),
    houseNo: normStr(data.houseNo),
    street: normStr(data.street),
    paraLocality: normStr(data.paraLocality),
    landmark: normStr(data.landmark),
    areaType: normStr(data.areaType) || 'RURAL',
    subdivision: normStr(data.subdivision),
    blockOrMunicipality: normStr(data.blockOrMunicipality),
    gpOrWard: normStr(data.gpOrWard),
    wardId: normStr(data.wardId),
    wardNo: normStr(data.wardNo),
    wardNumber: normStr(data.wardNumber),
    village: normStr(data.village),
    postOffice: normStr(data.postOffice),
    policeStation: normStr(data.policeStation),
    district: normStr(data.district) || 'Murshidabad',
    state: normStr(data.state) || 'West Bengal',
    pinCode: normStr(data.pinCode),
    villageAddress,
    savedDeliveryAddress: villageAddress,
    lat,
    lng,
    placeId: normStr(data.placeId),
    mapPinLabel: normStr(data.mapPinLabel),
    consumerId,
    lpgId17,
    gasCompany: normStr(data.gasCompany) || 'Indane',
    agencyId,
    agencyName,
    connectionCategory: normStr(data.connectionCategory) || 'Domestic',
    cylinderType: normStr(data.cylinderType) || '14.2 Kg',
    dbcStatus: normStr(data.dbcStatus) || 'Single',
    ekycStatus: normStr(data.ekycStatus) || 'Pending',
    bankLinkStatus: normalizeBankSeedStatus(data.bankLinkStatus),
    bankName: normStr(data.bankName),
    bankAccountLast4: bankAcCheck.digits,
    maskedAccount: bankAcCheck.masked,
    subsidyEligible: data.subsidyEligible === 'No' || data.subsidyEligible === false ? 'No' : 'Yes',
    nonTakerFlag: data.nonTakerFlag === 'Yes' || data.nonTakerFlag === true ? 'Yes' : 'No',
    customIntervalDays: customInterval,
    status: normStr(data.status) || 'Active',
    remarks: normStr(data.remarks),
    registrationDate: normStr(data.registrationDate) || getTodayDate(),
    lastBookingDate: '',
    lastServiceDate: '',
    nextServiceDueDate: '',
    createdAt: nowIso,
    updatedAt: nowIso,
    createdByUid: actor.uid
  };

  list.unshift(newCustomer);
  setItem(KEYS.GAS_CUSTOMERS, list);
  logGasAudit('GAS_CUSTOMER_ADD', `Registered Gas Customer ${newCustomer.fullName} (${newCustomer.consumerId || newCustomer.lpgId17 || newCustomer.id})`, { id: newCustomer.id });
  return { success: true, customer: newCustomer };
}

export function updateGasCustomerCoordinates(gasCustomerId, { lat, lng, label = '', placeId = '', source = 'agent_doorstep_gps' } = {}) {
  const canEdit = canPerformGasAction('edit', 'gas-customers') || canPerformGasAction('edit', 'gas-bookings');
  if (!canEdit) {
    return { success: false, message: 'Permission Denied: Not authorized to update customer GPS coordinates.' };
  }
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
    return { success: false, message: 'Valid latitude and longitude coordinates are required.' };
  }

  const list = getAllGasCustomers();
  const idx = list.findIndex(c => c.id === gasCustomerId);
  if (idx === -1) {
    return { success: false, message: 'Gas Customer profile not found.' };
  }

  const cleanLat = Number(nLat.toFixed(6));
  const cleanLng = Number(nLng.toFixed(6));
  const nowIso = new Date().toISOString();
  const actor = getActorInfo();

  list[idx] = {
    ...list[idx],
    lat: cleanLat,
    lng: cleanLng,
    mapPinLabel: normStr(label) || list[idx].mapPinLabel || `Doorstep GPS (${cleanLat}, ${cleanLng})`,
    placeId: normStr(placeId) || list[idx].placeId || '',
    gpsSource: source,
    gpsUpdatedAt: nowIso,
    updatedAt: nowIso,
    updatedByUid: actor.uid
  };
  setItem(KEYS.GAS_CUSTOMERS, list);

  // Also sync onto any open active bookings for this customer
  const bookings = getAllGasBookings();
  let updatedBookingCount = 0;
  for (let i = 0; i < bookings.length; i += 1) {
    if (
      bookings[i].gasCustomerId === gasCustomerId &&
      !isBookingDeliveredStatus(bookings[i].deliveryStatus || bookings[i].status) &&
      !isBookingCancelledStatus(bookings[i].deliveryStatus || bookings[i].status)
    ) {
      bookings[i] = {
        ...bookings[i],
        deliveryLat: cleanLat,
        deliveryLng: cleanLng,
        updatedAt: nowIso
      };
      updatedBookingCount += 1;
    }
  }
  if (updatedBookingCount > 0) {
    setItem(KEYS.GAS_BOOKINGS, bookings);
  }

  logGasAudit(
    'GAS_CUSTOMER_GPS_PIN',
    `Captured Doorstep GPS (${cleanLat}, ${cleanLng}) for ${list[idx].fullName} (${list[idx].id})`,
    { gasCustomerId, lat: cleanLat, lng: cleanLng, source, updatedBookingCount }
  );
  return { success: true, customer: list[idx], updatedBookingCount };
}

export function deleteGasCustomer(id) {
  if (!canPerformGasAction('delete', 'gas-customers')) {
    return { success: false, message: 'Permission Denied: Only authorized roles can delete Gas Customer records.' };
  }
  const list = getAllGasCustomers();
  const target = list.find(c => c.id === id);
  if (!target) return { success: false, message: 'Gas Customer not found.' };

  const bookings = getAllGasBookings().filter(b => b.gasCustomerId === id && !isBookingCancelledStatus(b.deliveryStatus));
  const openLedgers = getAllNonTakerLedgers().filter(l => l.gasCustomerId === id && Number(l.outstandingAmount) > 0);
  if (bookings.length > 0 || openLedgers.length > 0) {
    return {
      success: false,
      message: `Cannot delete ${target.fullName}: customer has ${bookings.length} active booking(s) and ${openLedgers.length} open advance ledger(s). Set status to Inactive instead.`
    };
  }

  setItem(KEYS.GAS_CUSTOMERS, list.filter(c => c.id !== id));
  markGlobalReferenceDeleted(id).catch(() => {});
  logGasAudit('GAS_CUSTOMER_DELETE', `Deleted Gas Customer ${target.fullName} (${target.id})`, { id });
  return { success: true };
}

export function getGasCustomerFullHistory(gasCustomerId) {
  const customer = getGasCustomerById(gasCustomerId);
  if (!customer) return null;
  const bookings = getAllGasBookings().filter(b => b.gasCustomerId === gasCustomerId);
  const collections = getAllGasCollections().filter(c => c.gasCustomerId === gasCustomerId);
  const subsidies = getAllGasSubsidies().filter(s => s.gasCustomerId === gasCustomerId);
  const nonTakerLedgers = getAllNonTakerLedgers().filter(l => l.gasCustomerId === gasCustomerId);
  const serviceEntries = getAllGasServiceEntries().filter(e => e.gasCustomerId === gasCustomerId);
  const eligibility = getCustomerEligibilityStatus(customer);

  const totalBookedValue = bookings.filter(b => !isBookingCancelledStatus(b.deliveryStatus)).reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
  const totalCollected = collections.filter(c => c.status !== 'Reversed').reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const bookingDue = bookings.filter(b => !isBookingCancelledStatus(b.deliveryStatus)).reduce((s, b) => s + (Number(b.dueAmount) || 0), 0);
  const serviceDue = serviceEntries.filter(e => e.status !== 'Cancelled').reduce((s, e) => s + (Number(e.dueAmount) || 0), 0);
  const nonTakerDue = nonTakerLedgers.reduce((s, l) => s + (Number(l.outstandingAmount) || 0), 0);

  return {
    customer,
    eligibility,
    bookings,
    collections,
    subsidies,
    nonTakerLedgers,
    serviceEntries,
    totals: {
      totalBookings: bookings.length,
      totalBookedValue,
      totalCollected,
      bookingDue,
      serviceDue,
      nonTakerDue,
      totalOutstandingDue: round2(bookingDue + serviceDue + nonTakerDue)
    }
  };
}

/* =========================================================================
   3. GAS BOOKING REGISTER & 7-STAGE DELIVERY PIPELINE
   ========================================================================= */

export function getAllGasBookings() {
  return getItem(KEYS.GAS_BOOKINGS, []);
}

export function getGasBookingById(id) {
  return getAllGasBookings().find(b => b.id === id) || null;
}

export async function saveGasBooking(data = {}) {
  const isEdit = Boolean(data.id);
  if (!canPerformGasAction(isEdit ? 'edit' : 'add', 'gas-bookings')) {
    return { success: false, message: 'Permission Denied: Not authorized to save Gas Bookings.' };
  }

  const gasCustomer = getGasCustomerById(data.gasCustomerId);
  if (!gasCustomer) {
    return { success: false, message: 'Please select a valid registered Gas Customer.' };
  }

  const bookingDate = normStr(data.bookingDate) || getTodayDate();
  const bookingRefNo = normStr(data.bookingRefNo);
  const bookings = getAllGasBookings();

  if (bookingRefNo) {
    const dupRef = bookings.find(
      b => b.id !== data.id && !isBookingCancelledStatus(b.deliveryStatus) && normKey(b.bookingRefNo) === normKey(bookingRefNo)
    );
    if (dupRef) {
      return { success: false, message: `Duplicate Booking Reference No "${bookingRefNo}" already exists on ${dupRef.bookingNo}.` };
    }
  }

  const quantity = Math.max(1, parseInt(data.quantity, 10) || 1);
  const refillPrice = Math.max(0, Number(data.refillPrice) || 0);
  const deliveryCharge = Math.max(0, round2(Number(data.deliveryCharge) || 0));
  const additionalServiceCharge = Math.max(0, round2(Number(data.additionalServiceCharge) || 0));
  const discount = Math.max(0, round2(Number(data.discount) || 0));
  const totalAmount = Math.max(0, round2(refillPrice * quantity + deliveryCharge + additionalServiceCharge - discount));
  const deliveryDistanceKm = Number.isFinite(Number(data.deliveryDistanceKm))
    ? Math.max(0, Number(data.deliveryDistanceKm))
    : 0;
  const deliveryPricingMethod = GAS_DELIVERY_PRICING_METHODS.includes(data.deliveryPricingMethod)
    ? data.deliveryPricingMethod
    : (getGasSettings().deliveryPricingConfig?.defaultMethod || 'Distance-Based Tiers');

  const rawStatus = normStr(data.deliveryStatus) || 'Booking Received';
  const deliveryStatus = GAS_BOOKING_STATUSES.includes(rawStatus) ? rawStatus : normalizeGasBookingStatus(rawStatus);
  const actor = getActorInfo();
  const nowIso = new Date().toISOString();

  const rider = data.deliveryPersonId ? getGasDeliveryPersonById(data.deliveryPersonId) : null;
  const deliveryPersonId = rider?.id || normStr(data.deliveryPersonId);
  const deliveryPersonName = rider?.name || normStr(data.deliveryPersonName) || normStr(data.deliveryStaff);
  const deliveryPersonMobile = rider?.mobile || normStr(data.deliveryPersonMobile);

  const deliveryAddressSnapshot =
    normStr(data.deliveryAddressSnapshot) ||
    gasCustomer.savedDeliveryAddress ||
    gasCustomer.villageAddress ||
    '';

  const deliveryLat = Number.isFinite(Number(data.deliveryLat))
    ? Number(data.deliveryLat)
    : (Number.isFinite(Number(gasCustomer.lat)) ? Number(gasCustomer.lat) : null);
  const deliveryLng = Number.isFinite(Number(data.deliveryLng))
    ? Number(data.deliveryLng)
    : (Number.isFinite(Number(gasCustomer.lng)) ? Number(gasCustomer.lng) : null);

  const agencies = getGasAgencies();
  const agObj = agencies.find(
    a => (data.agencyId && a.id === data.agencyId) || (data.agencyName && a.name.toUpperCase() === normStr(data.agencyName).toUpperCase())
  );
  const agencyId = agObj?.id || normStr(data.agencyId) || gasCustomer.agencyId || '';
  const agencyName = agObj?.name || normStr(data.agencyName) || gasCustomer.agencyName || '';
  const customerTakingGas = data.customerTakingGas === 'No' ? 'No' : 'Yes';

  if (isEdit) {
    const idx = bookings.findIndex(b => b.id === data.id);
    if (idx === -1) return { success: false, message: 'Booking record not found.' };
    const existing = bookings[idx];
    const prevStatus = normalizeGasBookingStatus(existing.deliveryStatus);
    const existingPaid = Math.max(0, round2(Number(existing.paidAmount) || 0));
    const enteredPaid = Math.max(0, round2(Number(data.paidAmount) || 0));
    const paidAmount = Math.min(totalAmount, Math.max(existingPaid, enteredPaid));
    const additionalPaymentDelta = round2(Math.max(0, paidAmount - existingPaid));
    const dueAmount = Math.max(0, round2(totalAmount - paidAmount));
    const paymentStatus = totalAmount === 0 || dueAmount <= 0 ? 'Paid' : (paidAmount > 0 ? 'Partial' : 'Due');

    const timeline = Array.isArray(existing.deliveryTimeline) ? [...existing.deliveryTimeline] : [];
    if (prevStatus !== deliveryStatus) {
      const tlId = await allocateGlobalReference('TL', { entityType: 'GAS_BOOKING_TIMELINE' });
      timeline.push({
        id: tlId,
        stage: deliveryStatus,
        timestamp: nowIso,
        actor: actor.name,
        actorUid: actor.uid,
        note: normStr(data.timelineNote || data.remarks) || `Status changed from ${prevStatus} to ${deliveryStatus}`
      });
    }

    const updated = {
      ...existing,
      gasCustomerId: gasCustomer.id,
      customerName: gasCustomer.fullName,
      consumerId: gasCustomer.consumerId,
      lpgId17: gasCustomer.lpgId17 || '',
      mobile: gasCustomer.mobile,
      altMobile: gasCustomer.altMobile || gasCustomer.whatsapp || gasCustomer.mobile,
      gasCompany: normStr(data.gasCompany) || gasCustomer.gasCompany,
      agencyId,
      agencyName,
      bookingDate,
      bookingMode: normStr(data.bookingMode) || existing.bookingMode || 'Counter',
      bookingRefNo,
      cylinderType: normStr(data.cylinderType) || gasCustomer.cylinderType || '14.2 Kg',
      quantity,
      deliveryStatus,
      deliveryDate: isBookingDeliveredStatus(deliveryStatus)
        ? (normStr(data.deliveryDate) || existing.deliveryDate || getTodayDate())
        : (normStr(data.deliveryDate) || existing.deliveryDate || ''),
      deliveryPersonId,
      deliveryPersonName,
      deliveryPersonMobile,
      deliveryStaff: deliveryPersonName || normStr(data.deliveryStaff ?? existing.deliveryStaff),
      deliveryArea: normStr(data.deliveryArea ?? existing.deliveryArea),
      deliveryAddressSnapshot,
      deliveryLat,
      deliveryLng,
      routePolyline: normStr(data.routePolyline ?? existing.routePolyline),
      estimatedTravelTime: normStr(data.estimatedTravelTime ?? existing.estimatedTravelTime),
      distanceRemainingKm: data.distanceRemainingKm !== undefined && data.distanceRemainingKm !== ''
        ? Math.max(0, Number(data.distanceRemainingKm) || 0)
        : (existing.distanceRemainingKm ?? deliveryDistanceKm),
      deliveryInstructions: normStr(data.deliveryInstructions ?? existing.deliveryInstructions),
      specialNotes: normStr(data.specialNotes ?? existing.specialNotes),
      customerTakingGas,
      refillPrice,
      deliveryDistanceKm,
      deliveryPricingMethod,
      deliveryCharge,
      additionalServiceCharge,
      selectedServices: Array.isArray(data.selectedServices) ? data.selectedServices : (existing.selectedServices || []),
      discount,
      totalAmount,
      paidAmount: existingPaid,
      dueAmount: Math.max(0, round2(totalAmount - existingPaid)),
      paymentMode: normStr(data.paymentMode) || existing.paymentMode || 'Cash',
      paymentStatus: totalAmount === 0 || (totalAmount - existingPaid) <= 0 ? 'Paid' : (existingPaid > 0 ? 'Partial' : 'Due'),
      remarks: normStr(data.remarks ?? existing.remarks),
      deliveryTimeline: timeline,
      updatedAt: nowIso,
      updatedByUid: actor.uid
    };
    bookings[idx] = updated;
    setItem(KEYS.GAS_BOOKINGS, bookings);

    if (additionalPaymentDelta > 0 && !data.skipInitialCollection) {
      const colRes = await recordGasCollection({
        gasCustomerId: gasCustomer.id,
        bookingId: updated.id,
        category: 'Gas Booking Payment',
        collectionDate: getTodayDate(),
        amount: additionalPaymentDelta,
        paymentMode: updated.paymentMode,
        transactionRef: normStr(data.transactionRef),
        remarks: `Payment recorded on booking update (${updated.bookingNo})`
      });
      if (!colRes.success) {
        return { success: false, message: colRes.message };
      }
    }

    refreshCustomerLastBookingDate(gasCustomer.id);
    logGasAudit('GAS_BOOKING_UPDATE', `Updated Booking ${updated.bookingNo} (${updated.deliveryStatus}) for ${gasCustomer.fullName}`, { id: updated.id });
    return { success: true, booking: getGasBookingById(updated.id) };
  }

  const initialPaid = Math.max(0, round2(Number(data.paidAmount) || 0));
  const paidAmount = Math.min(totalAmount, initialPaid);

  const bookingNo = await allocateGlobalReference('GASBK', { entityType: 'GAS_BOOKING' });
  const initialTlId = await allocateGlobalReference('TL', { entityType: 'GAS_BOOKING_TIMELINE' });
  const timeline = [
    {
      id: initialTlId,
      stage: 'Booking Received',
      timestamp: nowIso,
      actor: actor.name,
      actorUid: actor.uid,
      note: 'Booking registered'
    }
  ];
  if (deliveryStatus !== 'Booking Received') {
    const secondTlId = await allocateGlobalReference('TL', { entityType: 'GAS_BOOKING_TIMELINE' });
    timeline.push({
      id: secondTlId,
      stage: deliveryStatus,
      timestamp: nowIso,
      actor: actor.name,
      actorUid: actor.uid,
      note: deliveryPersonName ? `Assigned to ${deliveryPersonName}` : `Initial stage set to ${deliveryStatus}`
    });
  }

  const newBooking = {
    id: bookingNo,
    bookingNo,
    gasCustomerId: gasCustomer.id,
    customerId: gasCustomer.customerId || '',
    customerName: gasCustomer.fullName,
    consumerId: gasCustomer.consumerId,
    lpgId17: gasCustomer.lpgId17 || '',
    mobile: gasCustomer.mobile,
    altMobile: gasCustomer.altMobile || gasCustomer.whatsapp || gasCustomer.mobile,
    gasCompany: normStr(data.gasCompany) || gasCustomer.gasCompany,
    agencyId,
    agencyName,
    bookingDate,
    bookingMode: normStr(data.bookingMode) || 'Counter',
    bookingRefNo,
    cylinderType: normStr(data.cylinderType) || gasCustomer.cylinderType || '14.2 Kg',
    quantity,
    deliveryStatus,
    deliveryDate: isBookingDeliveredStatus(deliveryStatus) ? (normStr(data.deliveryDate) || bookingDate) : normStr(data.deliveryDate),
    deliveryPersonId,
    deliveryPersonName,
    deliveryPersonMobile,
    deliveryStaff: deliveryPersonName || normStr(data.deliveryStaff),
    deliveryArea: normStr(data.deliveryArea) || normStr(gasCustomer.village),
    deliveryAddressSnapshot,
    deliveryLat,
    deliveryLng,
    routePolyline: normStr(data.routePolyline),
    estimatedTravelTime: normStr(data.estimatedTravelTime),
    distanceRemainingKm: deliveryDistanceKm,
    deliveryInstructions: normStr(data.deliveryInstructions),
    specialNotes: normStr(data.specialNotes),
    customerTakingGas,
    linkedNonTakerLedgerId: '',
    liveDriverGps: null,
    deliveryTimeline: timeline,
    refillPrice,
    deliveryDistanceKm,
    deliveryPricingMethod,
    deliveryCharge,
    additionalServiceCharge,
    selectedServices: Array.isArray(data.selectedServices) ? data.selectedServices : [],
    discount,
    totalAmount,
    paidAmount: 0,
    dueAmount: totalAmount,
    paymentMode: normStr(data.paymentMode) || 'Cash',
    paymentStatus: totalAmount === 0 ? 'Paid' : 'Due',
    remarks: normStr(data.remarks),
    createdAt: nowIso,
    updatedAt: nowIso,
    createdByUid: actor.uid
  };

  // Permanent history: always prepend as a distinct booking record
  bookings.unshift(newBooking);
  setItem(KEYS.GAS_BOOKINGS, bookings);
  refreshCustomerLastBookingDate(gasCustomer.id);

  // If paid at time of booking, record linked collection transparently
  if (paidAmount > 0 && !data.skipInitialCollection) {
    const colRes = await recordGasCollection({
      gasCustomerId: gasCustomer.id,
      bookingId: newBooking.id,
      category: 'Gas Booking Payment',
      collectionDate: bookingDate,
      amount: paidAmount,
      paymentMode: newBooking.paymentMode,
      transactionRef: normStr(data.transactionRef),
      remarks: `Initial payment with booking ${newBooking.bookingNo}`
    });
    if (!colRes.success) {
      setItem(KEYS.GAS_BOOKINGS, getAllGasBookings().filter(b => b.id !== newBooking.id));
      refreshCustomerLastBookingDate(gasCustomer.id);
      return { success: false, message: colRes.message };
    }
  }

  // Optional Non-Taker Advance integration when customer is not taking gas
  if (customerTakingGas === 'No' && data.recordNonTakerAdvance && Number(data.nonTakerAdvanceAmount) > 0) {
    const ntRes = await createNonTakerLedger({
      gasCustomerId: gasCustomer.id,
      bookingId: newBooking.id,
      entryDate: bookingDate,
      actualAuthorizedAdvance: Number(data.nonTakerAdvanceAmount),
      consentConfirmed: Boolean(data.nonTakerConsentConfirmed),
      authorizationNote: `Booking ${newBooking.bookingNo}: Customer declined cylinder delivery`,
      remarks: `Auto-linked from booking ${newBooking.bookingNo}`
    });
    if (ntRes.success && ntRes.ledger) {
      const updatedBks = getAllGasBookings();
      const idx = updatedBks.findIndex(b => b.id === newBooking.id);
      if (idx !== -1) {
        updatedBks[idx].linkedNonTakerLedgerId = ntRes.ledger.id;
        setItem(KEYS.GAS_BOOKINGS, updatedBks);
      }
    }
  }

  logGasAudit('GAS_BOOKING_CREATE', `Created Booking ${newBooking.bookingNo} for ${gasCustomer.fullName} (Total: ₹${totalAmount})`, { id: newBooking.id });
  return { success: true, booking: getGasBookingById(newBooking.id) };
}

export async function updateGasBookingStatus(id, deliveryStatus, extra = {}) {
  if (!canPerformGasAction('edit', 'gas-bookings')) {
    return { success: false, message: 'Permission Denied: Cannot update booking status.' };
  }
  const normalizedNext = normalizeGasBookingStatus(deliveryStatus);
  if (!GAS_BOOKING_STATUSES.includes(normalizedNext)) {
    return { success: false, message: 'Invalid booking delivery status.' };
  }
  const bookings = getAllGasBookings();
  const idx = bookings.findIndex(b => b.id === id);
  if (idx === -1) return { success: false, message: 'Booking not found.' };

  const actor = getActorInfo();
  const nowIso = new Date().toISOString();
  const prev = bookings[idx];
  const timeline = Array.isArray(prev.deliveryTimeline) ? [...prev.deliveryTimeline] : [];
  const tlId = await allocateGlobalReference('TL', { entityType: 'GAS_BOOKING_TIMELINE' });
  timeline.push({
    id: tlId,
    stage: normalizedNext,
    timestamp: nowIso,
    actor: actor.name,
    actorUid: actor.uid,
    note: normStr(extra.note || extra.remarks) || `Updated stage to ${normalizedNext}`
  });

  const rider = extra.deliveryPersonId ? getGasDeliveryPersonById(extra.deliveryPersonId) : null;

  bookings[idx] = {
    ...prev,
    deliveryStatus: normalizedNext,
    deliveryDate: isBookingDeliveredStatus(normalizedNext)
      ? (normStr(extra.deliveryDate) || prev.deliveryDate || getTodayDate())
      : (extra.deliveryDate !== undefined ? normStr(extra.deliveryDate) : prev.deliveryDate),
    deliveryPersonId: rider ? rider.id : (extra.deliveryPersonId ?? prev.deliveryPersonId ?? ''),
    deliveryPersonName: rider ? rider.name : (normStr(extra.deliveryPersonName) || prev.deliveryPersonName || prev.deliveryStaff || ''),
    deliveryPersonMobile: rider ? rider.mobile : (normStr(extra.deliveryPersonMobile) || prev.deliveryPersonMobile || ''),
    deliveryStaff: rider ? rider.name : (normStr(extra.deliveryStaff || extra.deliveryPersonName) || prev.deliveryStaff || ''),
    distanceRemainingKm: isBookingDeliveredStatus(normalizedNext)
      ? 0
      : (extra.distanceRemainingKm !== undefined ? Math.max(0, Number(extra.distanceRemainingKm) || 0) : prev.distanceRemainingKm),
    estimatedTravelTime: extra.estimatedTravelTime !== undefined ? normStr(extra.estimatedTravelTime) : (prev.estimatedTravelTime || ''),
    remarks: extra.remarks !== undefined ? normStr(extra.remarks) : prev.remarks,
    deliveryTimeline: timeline,
    updatedAt: nowIso,
    updatedByUid: actor.uid
  };
  setItem(KEYS.GAS_BOOKINGS, bookings);
  refreshCustomerLastBookingDate(bookings[idx].gasCustomerId);
  logGasAudit('GAS_BOOKING_STATUS', `Booking ${bookings[idx].bookingNo} marked ${normalizedNext}`, { id });
  return { success: true, booking: bookings[idx] };
}

export async function assignDeliveryPersonToBooking(bookingId, deliveryPersonId, { autoAdvanceStage = true, note = '' } = {}) {
  if (!canPerformGasAction('edit', 'gas-bookings')) {
    return { success: false, message: 'Permission Denied: Cannot assign delivery personnel.' };
  }
  const rider = getGasDeliveryPersonById(deliveryPersonId);
  if (!rider) {
    return { success: false, message: 'Please select a valid Delivery Person.' };
  }
  const bookings = getAllGasBookings();
  const idx = bookings.findIndex(b => b.id === bookingId);
  if (idx === -1) return { success: false, message: 'Booking not found.' };

  const prev = bookings[idx];
  const prevStage = normalizeGasBookingStatus(prev.deliveryStatus);
  const earlyStages = ['Booking Received', 'Booking Confirmed', 'Order Processing', 'Ready for Dispatch'];
  const nextStage = autoAdvanceStage && earlyStages.includes(prevStage) ? 'Delivery Assigned' : prevStage;
  const actor = getActorInfo();
  const nowIso = new Date().toISOString();

  const timeline = Array.isArray(prev.deliveryTimeline) ? [...prev.deliveryTimeline] : [];
  const tlId = await allocateGlobalReference('TL', { entityType: 'GAS_BOOKING_TIMELINE' });
  timeline.push({
    id: tlId,
    stage: nextStage,
    timestamp: nowIso,
    actor: actor.name,
    actorUid: actor.uid,
    note: normStr(note) || `Assigned delivery rider ${rider.name} (${rider.mobile})`
  });

  bookings[idx] = {
    ...prev,
    deliveryPersonId: rider.id,
    deliveryPersonName: rider.name,
    deliveryPersonMobile: rider.mobile,
    deliveryStaff: rider.name,
    deliveryStatus: nextStage,
    deliveryTimeline: timeline,
    updatedAt: nowIso,
    updatedByUid: actor.uid
  };
  setItem(KEYS.GAS_BOOKINGS, bookings);
  logGasAudit('GAS_BOOKING_ASSIGN_RIDER', `Assigned ${rider.name} to ${prev.bookingNo}`, { bookingId, riderId: rider.id });
  return { success: true, booking: bookings[idx] };
}

export function updateBookingLiveTracking(bookingId, payload = {}) {
  if (!canPerformGasAction('edit', 'gas-bookings')) {
    return { success: false, message: 'Permission Denied: Cannot update delivery tracking.' };
  }
  const bookings = getAllGasBookings();
  const idx = bookings.findIndex(b => b.id === bookingId);
  if (idx === -1) return { success: false, message: 'Booking not found.' };

  const prev = bookings[idx];
  const nowIso = new Date().toISOString();
  const actor = getActorInfo();

  const next = { ...prev, updatedAt: nowIso, updatedByUid: actor.uid };
  if (payload.routePolyline !== undefined) next.routePolyline = normStr(payload.routePolyline);
  if (payload.estimatedTravelTime !== undefined) next.estimatedTravelTime = normStr(payload.estimatedTravelTime);
  if (payload.distanceRemainingKm !== undefined && payload.distanceRemainingKm !== '') {
    next.distanceRemainingKm = Math.max(0, Number(payload.distanceRemainingKm) || 0);
  }
  if (payload.deliveryDistanceKm !== undefined && payload.deliveryDistanceKm !== '') {
    next.deliveryDistanceKm = Math.max(0, Number(payload.deliveryDistanceKm) || 0);
  }
  if (Number.isFinite(Number(payload.driverLat)) && Number.isFinite(Number(payload.driverLng))) {
    next.liveDriverGps = {
      lat: Number(Number(payload.driverLat).toFixed(6)),
      lng: Number(Number(payload.driverLng).toFixed(6)),
      accuracyMeters: Math.round(Number(payload.accuracyMeters) || 0),
      updatedAt: nowIso,
      capturedBy: actor.name,
      source: 'device_geolocation'
    };
  }
  bookings[idx] = next;
  setItem(KEYS.GAS_BOOKINGS, bookings);
  scheduleGasServerSync();
  return { success: true, booking: next };
}

function refreshCustomerLastBookingDate(gasCustomerId) {
  const customers = getAllGasCustomers();
  const idx = customers.findIndex(c => c.id === gasCustomerId);
  if (idx === -1) return;
  const validDates = getAllGasBookings()
    .filter(b => b.gasCustomerId === gasCustomerId && !isBookingCancelledStatus(b.deliveryStatus))
    .map(b => b.bookingDate)
    .filter(Boolean)
    .sort((a, b) => (a < b ? 1 : -1));
  customers[idx].lastBookingDate = validDates[0] || '';
  setItem(KEYS.GAS_CUSTOMERS, customers);
}

/* =========================================================================
   4. BOOKING ELIGIBILITY (ADMINISTRATIVE TRACKING)
   ========================================================================= */

export function getAllGasEligibilityRules() {
  return getItem(KEYS.GAS_ELIGIBILITY_RULES, []);
}

export async function saveGasEligibilityRule(data = {}) {
  if (!canPerformGasAction('add', 'gas-eligibility') && !canPerformGasAction('settings', 'gas-settings')) {
    return { success: false, message: 'Permission Denied: Cannot save eligibility rule.' };
  }
  const rules = getAllGasEligibilityRules();
  const intervalDays = Math.max(1, Math.min(365, parseInt(data.intervalDays, 10) || 30));
  const record = {
    id: data.id || await allocateGlobalReference('GASDBT', { entityType: 'GAS_ELIGIBILITY_RULE' }),
    ruleName: normStr(data.ruleName) || `${normStr(data.gasCompany || 'All')} ${normStr(data.connectionCategory || 'All')} Rule`,
    gasCompany: normStr(data.gasCompany) || 'All',
    connectionCategory: normStr(data.connectionCategory) || 'All',
    intervalDays,
    isActive: data.isActive !== false,
    updatedAt: new Date().toISOString()
  };
  const idx = rules.findIndex(r => r.id === record.id);
  if (idx !== -1) rules[idx] = record;
  else rules.unshift(record);
  setItem(KEYS.GAS_ELIGIBILITY_RULES, rules);
  logGasAudit('GAS_ELIGIBILITY_RULE', `Saved eligibility rule "${record.ruleName}" (${intervalDays} days)`);
  return { success: true, rule: record };
}

export function resolveIntervalDaysForCustomer(customer) {
  if (customer?.customIntervalDays && Number(customer.customIntervalDays) > 0) {
    return { days: Number(customer.customIntervalDays), source: 'Customer Override' };
  }
  const rules = getAllGasEligibilityRules().filter(r => r.isActive !== false);
  const specific = rules.find(
    r =>
      (r.gasCompany === 'All' || r.gasCompany === customer.gasCompany) &&
      (r.connectionCategory === 'All' || r.connectionCategory === customer.connectionCategory)
  );
  if (specific) {
    return { days: Number(specific.intervalDays), source: `Rule: ${specific.ruleName}` };
  }
  const settings = getGasSettings();
  return { days: Number(settings.defaultEligibilityDays) || 30, source: 'System Default' };
}

export function getCustomerEligibilityStatus(customer, asOfDate = getTodayDate(), allBookings = null) {
  const bookings = (allBookings || getAllGasBookings()).filter(b => b.gasCustomerId === customer.id);
  const validBookings = bookings
    .filter(b => !isBookingCancelledStatus(b.deliveryStatus) && b.bookingDate)
    .sort((a, b) => (a.bookingDate < b.bookingDate ? 1 : -1));

  const lastValid = validBookings[0] || null;
  const { days: intervalDays, source: intervalSource } = resolveIntervalDaysForCustomer(customer);

  if (!lastValid) {
    return {
      gasCustomerId: customer.id,
      customerName: customer.fullName,
      consumerId: customer.consumerId || customer.lpgId17 || '-',
      mobile: customer.mobile,
      gasCompany: customer.gasCompany,
      lastValidBookingDate: '',
      lastValidBookingNo: '',
      intervalDays,
      intervalSource,
      nextEligibleDate: asOfDate,
      daysSinceLast: null,
      daysRemaining: 0,
      bucket: 'neverBooked',
      statusLabel: 'No Prior Valid Booking'
    };
  }

  const nextEligibleDate = addDaysIso(lastValid.bookingDate, intervalDays);
  const daysSinceLast = diffDaysIso(lastValid.bookingDate, asOfDate);
  const daysRemaining = diffDaysIso(asOfDate, nextEligibleDate);
  const hasOpenPendingBooking = validBookings.some(
    b => !isBookingDeliveredStatus(b.deliveryStatus) && !isBookingCancelledStatus(b.deliveryStatus)
  );

  let bucket = 'notYetDue';
  let statusLabel = `Upcoming in ${daysRemaining} day(s)`;

  if (hasOpenPendingBooking) {
    bucket = 'alreadyBooked';
    statusLabel = 'Already Booked (Delivery In Progress)';
  } else if (nextEligibleDate === asOfDate) {
    bucket = 'eligibleToday';
    statusLabel = 'Eligible Today';
  } else if (nextEligibleDate < asOfDate) {
    bucket = 'overdue';
    statusLabel = `Overdue (${Math.abs(daysRemaining)} day(s) past)`;
  } else if (daysRemaining > 0 && daysRemaining <= 7) {
    bucket = 'upcoming7';
    statusLabel = `Upcoming in ${daysRemaining}d (<=7 Days)`;
  } else if (daysRemaining > 7 && daysRemaining <= 15) {
    bucket = 'upcoming15';
    statusLabel = `Upcoming in ${daysRemaining}d (<=15 Days)`;
  }

  const isEligibleNow = bucket === 'eligibleToday' || bucket === 'overdue' || bucket === 'neverBooked';

  return {
    gasCustomerId: customer.id,
    customerName: customer.fullName,
    consumerId: customer.consumerId || customer.lpgId17 || '-',
    mobile: customer.mobile,
    gasCompany: customer.gasCompany,
    lastValidBookingDate: lastValid.bookingDate,
    lastValidBookingNo: lastValid.bookingNo,
    intervalDays,
    intervalSource,
    nextEligibleDate,
    daysSinceLast,
    daysRemaining,
    bucket,
    isEligibleNow,
    hasOpenPendingBooking,
    statusLabel
  };
}

export function getGasEligibilitySummary(asOfDate = getTodayDate()) {
  const customers = getAllGasCustomers().filter(c => c.status !== 'Inactive' && c.status !== 'Suspended');
  const bookings = getAllGasBookings();
  const rows = customers.map(c => getCustomerEligibilityStatus(c, asOfDate, bookings));

  return {
    asOfDate,
    disclaimer: BOOKING_ELIGIBILITY_DISCLAIMER,
    rows,
    eligibleToday: rows.filter(r => r.bucket === 'eligibleToday'),
    upcoming7: rows.filter(r => r.bucket === 'upcoming7'),
    upcoming15: rows.filter(r => r.bucket === 'upcoming15'),
    overdue: rows.filter(r => r.bucket === 'overdue'),
    eligibleNotBooked: rows.filter(r => r.bucket === 'eligibleToday' || r.bucket === 'overdue'),
    alreadyBooked: rows.filter(r => r.bucket === 'alreadyBooked'),
    neverBooked: rows.filter(r => r.bucket === 'neverBooked')
  };
}

/* =========================================================================
   5. SUBSIDY & DBT TRACKING
   ========================================================================= */

export function getAllGasSubsidies() {
  return getItem(KEYS.GAS_SUBSIDY, []);
}

export function computeAutoSubsidyFields({
  bookingDate = '',
  actualCredited = 0,
  bankReference = '',
  subsidyEligible = 'Yes',
  markFailed = false
} = {}) {
  const baseDate = normStr(bookingDate) || getTodayDate();
  const autoCreditDate = addDaysIso(baseDate, 7);
  const creditedNum = Math.max(0, round2(Number(actualCredited) || 0));

  let autoStatus = 'Pending';
  if (creditedNum > 0) {
    autoStatus = 'Credited';
  } else if (subsidyEligible === 'No' || subsidyEligible === false) {
    autoStatus = 'Not Applicable';
  } else if (Boolean(markFailed) || (Boolean(normStr(bankReference)) && creditedNum === 0)) {
    autoStatus = 'Failed';
  }

  return {
    bookingDate: baseDate,
    dbtCreditDate: autoCreditDate,
    dbtStatus: autoStatus
  };
}

export async function saveGasSubsidy(data = {}) {
  const isEdit = Boolean(data.id);
  if (!canPerformGasAction(isEdit ? 'edit' : 'add', 'gas-subsidy')) {
    return { success: false, message: 'Permission Denied: Cannot record Subsidy & DBT entry.' };
  }

  // Strictly reject or strip any forbidden sensitive credential keys
  const forbiddenKeys = ['bankPassword', 'password', 'otp', 'upiPin', 'pin', 'mpin', 'cvv', 'atmPin'];
  for (const fk of forbiddenKeys) {
    if (data[fk] !== undefined && normStr(data[fk]) !== '') {
      return {
        success: false,
        message: 'Security Policy Violation: Bank passwords, OTPs, and UPI PINs must NEVER be entered or stored.'
      };
    }
  }

  const gasCustomer = getGasCustomerById(data.gasCustomerId);
  if (!gasCustomer) {
    return { success: false, message: 'Please select a valid Gas Customer.' };
  }

  const list = getAllGasSubsidies();
  const prev = isEdit ? list.find(s => s.id === data.id) : null;
  if (isEdit && !prev) {
    return { success: false, message: 'Subsidy record not found.' };
  }

  const booking = data.bookingId ? getGasBookingById(data.bookingId) : null;
  const expectedSubsidy = Math.max(0, round2(Number(data.expectedSubsidy) || 0));
  const actualCredited = Math.max(0, round2(Number(data.actualCredited) || 0));
  const variance = round2(actualCredited - expectedSubsidy);
  const bankReference = normStr(data.bankReference ?? prev?.bankReference);

  const rawMasked = data.maskedBankLast4 !== undefined ? data.maskedBankLast4 : (prev?.maskedBankLast4 || gasCustomer.maskedAccount);
  const maskedDigits = normStr(rawMasked).replace(/\D/g, '').slice(-4);
  const maskedBankLast4 = maskedDigits ? `XXXX${maskedDigits}` : '';

  const baseBookingDate = booking?.bookingDate || normStr(data.bookingDate) || prev?.bookingDate || getTodayDate();
  const autoComputed = computeAutoSubsidyFields({
    bookingDate: baseBookingDate,
    actualCredited,
    bankReference,
    subsidyEligible: gasCustomer.subsidyEligible,
    markFailed: data.markFailed
  });

  const dbtCreditDate = autoComputed.dbtCreditDate;
  const dbtStatus = autoComputed.dbtStatus;

  const actor = getActorInfo();
  const nowIso = new Date().toISOString();

  let savedEntry = null;
  if (isEdit) {
    const idx = list.findIndex(s => s.id === data.id);
    list[idx] = {
      ...prev,
      gasCustomerId: gasCustomer.id,
      customerName: gasCustomer.fullName,
      consumerId: gasCustomer.consumerId || gasCustomer.lpgId17 || gasCustomer.id,
      mobile: gasCustomer.mobile,
      bookingId: booking ? booking.id : normStr(data.bookingId ?? prev.bookingId),
      bookingNo: booking ? booking.bookingNo : normStr(data.bookingNo ?? prev.bookingNo),
      bookingDate: baseBookingDate,
      deliveryDate: booking ? booking.deliveryDate : normStr(data.deliveryDate ?? prev.deliveryDate),
      expectedSubsidy,
      actualCredited,
      variance,
      dbtCreditDate,
      bankReference,
      maskedBankLast4,
      dbtStatus,
      remarks: normStr(data.remarks ?? prev.remarks),
      updatedAt: nowIso,
      updatedByUid: actor.uid
    };
    savedEntry = list[idx];
    setItem(KEYS.GAS_SUBSIDY, list);
    logGasAudit('GAS_SUBSIDY_UPDATE', `Updated DBT entry ${savedEntry.id} (${dbtStatus}, Auto Credit Date: ${dbtCreditDate}, Credited: ₹${actualCredited})`);
  } else {
    const subsidyId = await allocateGlobalReference('GASDBT', { entityType: 'GAS_SUBSIDY' });
    savedEntry = {
      id: subsidyId,
      gasCustomerId: gasCustomer.id,
      customerName: gasCustomer.fullName,
      consumerId: gasCustomer.consumerId || gasCustomer.lpgId17 || gasCustomer.id,
      mobile: gasCustomer.mobile,
      bookingId: booking ? booking.id : normStr(data.bookingId),
      bookingNo: booking ? booking.bookingNo : normStr(data.bookingNo),
      bookingDate: baseBookingDate,
      deliveryDate: booking ? booking.deliveryDate : normStr(data.deliveryDate),
      expectedSubsidy,
      actualCredited,
      variance,
      dbtCreditDate,
      bankReference,
      maskedBankLast4,
      dbtStatus,
      remarks: normStr(data.remarks),
      createdAt: nowIso,
      updatedAt: nowIso,
      createdByUid: actor.uid
    };
    list.unshift(savedEntry);
    setItem(KEYS.GAS_SUBSIDY, list);
    logGasAudit('GAS_SUBSIDY_CREATE', `Logged DBT Subsidy ${savedEntry.id} for ${gasCustomer.fullName} (Expected ₹${expectedSubsidy}, Auto Credit: ${dbtCreditDate}, Status: ${dbtStatus})`);
  }

  // Sync DBT calculation summary back to linked booking record
  const linkedBkId = savedEntry.bookingId;
  if (linkedBkId) {
    const bookings = getAllGasBookings();
    const bIdx = bookings.findIndex(b => b.id === linkedBkId);
    if (bIdx !== -1) {
      const timeline = Array.isArray(bookings[bIdx].deliveryTimeline) ? [...bookings[bIdx].deliveryTimeline] : [];
      if (dbtStatus === 'Credited' && bookings[bIdx].subsidyStatus !== 'Credited') {
        timeline.push({
          stage: bookings[bIdx].deliveryStatus || 'Delivered Successfully',
          timestamp: nowIso,
          actor: actor.name,
          note: `Subsidy DBT Credited: ₹${actualCredited} (Est. Date ${dbtCreditDate})`
        });
      }
      bookings[bIdx] = {
        ...bookings[bIdx],
        subsidyId: savedEntry.id,
        subsidyStatus: dbtStatus,
        dbtCreditDate,
        subsidyCreditedAmount: actualCredited,
        deliveryTimeline: timeline,
        updatedAt: nowIso
      };
      setItem(KEYS.GAS_BOOKINGS, bookings);
      scheduleGasServerSync();
    }
  }

  return { success: true, subsidy: savedEntry };
}

/* =========================================================================
   6. NON-TAKER SUBSIDY DUE LEDGER
   ========================================================================= */

export function getAllNonTakerLedgers() {
  return getItem(KEYS.GAS_NON_TAKER_LEDGER, []);
}

export function getNonTakerLedgerById(id) {
  return getAllNonTakerLedgers().find(l => l.id === id) || null;
}

function recomputeLedgerTotals(ledger) {
  const activeRecoveries = (Array.isArray(ledger.recoveries) ? ledger.recoveries : []).filter(r => !r.reversed);
  const totalRecovery = round2(activeRecoveries.reduce((sum, r) => sum + (Number(r.amount) || 0), 0));
  const actualAuthorizedAdvance = Math.max(0, round2(Number(ledger.actualAuthorizedAdvance) || 0));
  const outstandingAmount = Math.max(0, round2(actualAuthorizedAdvance - totalRecovery));
  const status = outstandingAmount <= 0 ? 'Settled' : (totalRecovery > 0 ? 'Partially Recovered' : 'Open');
  return {
    ...ledger,
    actualAuthorizedAdvance,
    totalRecovery,
    outstandingAmount,
    status
  };
}

export async function createNonTakerLedger(data = {}) {
  if (!canPerformGasAction('add', 'gas-non-taker')) {
    return { success: false, message: 'Permission Denied: Cannot create Non-Taker Advance Ledger.' };
  }
  const gasCustomer = getGasCustomerById(data.gasCustomerId);
  if (!gasCustomer) {
    return { success: false, message: 'Please select a valid Gas Customer.' };
  }

  const actualAuthorizedAdvance = round2(Number(data.actualAuthorizedAdvance ?? data.advanceAmount) || 0);
  if (actualAuthorizedAdvance <= 0) {
    return { success: false, message: 'Actual Authorized Advance amount must be greater than zero.' };
  }
  if (!data.consentConfirmed) {
    return { success: false, message: 'Explicit customer consent / authorization confirmation is required.' };
  }

  const list = getAllNonTakerLedgers();
  const actor = getActorInfo();
  const nowIso = new Date().toISOString();

  const initialRec = Math.max(0, round2(Number(data.initialRecovery) || 0));
  if (initialRec > actualAuthorizedAdvance) {
    return { success: false, message: 'Initial recovery cannot exceed Actual Authorized Advance.' };
  }

  const ledgerId = await allocateGlobalReference('GASNT', { entityType: 'NON_TAKER_LEDGER' });
  let ledger = recomputeLedgerTotals({
    id: ledgerId,
    gasCustomerId: gasCustomer.id,
    customerName: gasCustomer.fullName,
    consumerId: gasCustomer.consumerId,
    mobile: gasCustomer.mobile,
    bookingId: normStr(data.bookingId),
    entryDate: normStr(data.entryDate) || getTodayDate(),
    referencePreset: normStr(data.referencePreset) || `₹${actualAuthorizedAdvance}`,
    actualAuthorizedAdvance,
    totalRecovery: 0,
    outstandingAmount: actualAuthorizedAdvance,
    consentConfirmed: true,
    authorizationNote: normStr(data.authorizationNote) || 'Customer consented cash/value advance',
    recoveries: [],
    status: 'Open',
    remarks: normStr(data.remarks),
    createdAt: nowIso,
    updatedAt: nowIso,
    createdByUid: actor.uid
  });

  list.unshift(ledger);
  setItem(KEYS.GAS_NON_TAKER_LEDGER, list);
  logGasAudit('GAS_NONTAKER_CREATE', `Created Non-Taker Advance ${ledger.id} for ${gasCustomer.fullName}: Advance ₹${actualAuthorizedAdvance}`);

  if (initialRec > 0) {
    const recRes = await recordNonTakerRecovery({
      ledgerId: ledger.id,
      amount: initialRec,
      paymentMode: normStr(data.paymentMode) || 'Cash',
      collectionDate: ledger.entryDate,
      transactionRef: normStr(data.transactionRef),
      remarks: 'Initial recovery on ledger entry'
    });
    if (recRes.success) {
      ledger = recRes.ledger;
    }
  }

  return { success: true, ledger };
}

export async function recordNonTakerRecovery({ ledgerId, amount, paymentMode = 'Cash', collectionDate = getTodayDate(), transactionRef = '', remarks = '' }) {
  if (!canPerformGasAction('add', 'gas-non-taker') && !canPerformGasAction('add', 'gas-collections')) {
    return { success: false, message: 'Permission Denied: Cannot record Non-Taker recovery.' };
  }
  const ledgers = getAllNonTakerLedgers();
  const idx = ledgers.findIndex(l => l.id === ledgerId);
  if (idx === -1) return { success: false, message: 'Non-Taker Ledger record not found.' };

  const currentLedger = recomputeLedgerTotals(ledgers[idx]);
  const recAmt = round2(Number(amount) || 0);
  if (recAmt <= 0) {
    return { success: false, message: 'Recovery amount must be greater than zero.' };
  }
  if (recAmt > currentLedger.outstandingAmount) {
    return {
      success: false,
      message: `Recovery amount (₹${recAmt}) exceeds current Outstanding Due (₹${currentLedger.outstandingAmount}).`
    };
  }

  // Create collection record first (checks duplicate transactionRef!)
  const colRes = await recordGasCollection({
    gasCustomerId: currentLedger.gasCustomerId,
    nonTakerLedgerId: currentLedger.id,
    category: 'Authorized Advance Recovery',
    collectionDate: collectionDate || getTodayDate(),
    amount: recAmt,
    paymentMode,
    transactionRef,
    remarks: remarks || `Recovery against Advance Ledger ${currentLedger.id}`,
    skipNonTakerSync: true
  });
  if (!colRes.success) {
    return { success: false, message: colRes.message };
  }

  const actor = getActorInfo();
  const recId = await allocateGlobalReference('GASNT', { entityType: 'NON_TAKER_RECOVERY' });
  const recEntry = {
    id: recId,
    date: collectionDate || getTodayDate(),
    amount: recAmt,
    paymentMode,
    transactionRef: normStr(transactionRef),
    collectionId: colRes.collection.id,
    remarks: normStr(remarks),
    recordedBy: actor.name,
    recordedAt: new Date().toISOString(),
    reversed: false
  };

  currentLedger.recoveries = [...(currentLedger.recoveries || []), recEntry];
  const updatedLedger = recomputeLedgerTotals(currentLedger);
  updatedLedger.updatedAt = new Date().toISOString();
  ledgers[idx] = updatedLedger;
  setItem(KEYS.GAS_NON_TAKER_LEDGER, ledgers);

  logGasAudit(
    'GAS_NONTAKER_RECOVERY',
    `Recovered ₹${recAmt} on ${updatedLedger.id}. New Outstanding: ₹${updatedLedger.outstandingAmount}`
  );
  return { success: true, ledger: updatedLedger, recovery: recEntry, collection: colRes.collection };
}

export function reverseNonTakerRecovery(ledgerId, recoveryId, reason = 'Admin reversal') {
  if (!canPerformGasAction('reverse', 'gas-non-taker')) {
    return { success: false, message: 'Permission Denied: Only Administration can reverse Non-Taker recoveries.' };
  }
  const ledgers = getAllNonTakerLedgers();
  const idx = ledgers.findIndex(l => l.id === ledgerId);
  if (idx === -1) return { success: false, message: 'Ledger record not found.' };

  const recoveries = Array.isArray(ledgers[idx].recoveries) ? [...ledgers[idx].recoveries] : [];
  const rIdx = recoveries.findIndex(r => r.id === recoveryId);
  if (rIdx === -1) return { success: false, message: 'Recovery entry not found.' };
  if (recoveries[rIdx].reversed) return { success: false, message: 'Recovery is already reversed.' };

  recoveries[rIdx] = {
    ...recoveries[rIdx],
    reversed: true,
    reversedAt: new Date().toISOString(),
    reversalReason: normStr(reason)
  };
  ledgers[idx] = recomputeLedgerTotals({ ...ledgers[idx], recoveries });
  ledgers[idx].updatedAt = new Date().toISOString();
  setItem(KEYS.GAS_NON_TAKER_LEDGER, ledgers);

  if (recoveries[rIdx].collectionId) {
    reverseGasCollection(recoveries[rIdx].collectionId, reason, { skipNonTakerSync: true });
  }

  logGasAudit('GAS_NONTAKER_REVERSE', `Reversed recovery ${recoveryId} on ${ledgerId}. Reason: ${reason}`);
  return { success: true, ledger: ledgers[idx] };
}

/* =========================================================================
   7. GAS COLLECTION & PAYMENTS
   ========================================================================= */

export function getAllGasCollections() {
  return getItem(KEYS.GAS_COLLECTIONS, []);
}

export function checkDuplicateGasTxnRef(transactionRef) {
  const ref = normKey(transactionRef);
  if (!ref) return null;
  const dupCol = getAllGasCollections().find(c => c.status !== 'Reversed' && normKey(c.transactionRef) === ref);
  if (dupCol) return dupCol;
  const dupCentral = getAllPayments().find(p => p.paymentStatus !== 'Refunded' && normKey(p.transactionId) === ref);
  return dupCentral || null;
}

export async function recordGasCollection(data = {}) {
  if (!canPerformGasAction('add', 'gas-collections')) {
    return { success: false, message: 'Permission Denied: Not authorized to record Gas Collections.' };
  }

  const amount = round2(Number(data.amount) || 0);
  if (amount <= 0) {
    return { success: false, message: 'Collection amount must be greater than zero.' };
  }

  const transactionRef = normStr(data.transactionRef);
  if (transactionRef) {
    const dup = checkDuplicateGasTxnRef(transactionRef);
    if (dup) {
      return {
        success: false,
        message: `Duplicate Transaction Reference detected: "${transactionRef}" already recorded on ${dup.receiptNo || dup.id}.`
      };
    }
  }

  const gasCustomer = data.gasCustomerId ? getGasCustomerById(data.gasCustomerId) : null;
  const customerName = gasCustomer?.fullName || normStr(data.customerName) || 'Walk-In Gas Customer';
  const consumerId = gasCustomer?.consumerId || normStr(data.consumerId);
  const mobile = gasCustomer?.mobile || normStr(data.mobile);
  const category = GAS_COLLECTION_CATEGORIES.includes(data.category) ? data.category : 'Gas Booking Payment';
  const paymentMode = GAS_PAYMENT_MODES.includes(data.paymentMode) ? data.paymentMode : 'Cash';
  const collectionDate = normStr(data.collectionDate) || getTodayDate();

  // If linked to Non-Taker Ledger (and called directly from Collections view), route through ledger recovery check
  if (data.nonTakerLedgerId && !data.skipNonTakerSync) {
    return await recordNonTakerRecovery({
      ledgerId: data.nonTakerLedgerId,
      amount,
      paymentMode,
      collectionDate,
      transactionRef,
      remarks: data.remarks
    });
  }

  const collections = getAllGasCollections();
  const receiptNo = await allocateGlobalReference('GASRCP', { entityType: 'GAS_COLLECTION' });
  const actor = getActorInfo();
  const nowIso = new Date().toISOString();

  const entry = {
    id: receiptNo,
    receiptNo,
    gasCustomerId: gasCustomer?.id || normStr(data.gasCustomerId),
    customerId: gasCustomer?.customerId || '',
    customerName,
    consumerId,
    mobile,
    category,
    collectionDate,
    amount,
    paymentMode,
    transactionRef,
    bookingId: normStr(data.bookingId),
    nonTakerLedgerId: normStr(data.nonTakerLedgerId),
    serviceEntryId: normStr(data.serviceEntryId),
    saleId: normStr(data.saleId),
    status: 'Verified',
    remarks: normStr(data.remarks),
    recordedBy: actor.name,
    recordedByUid: actor.uid,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  // Sync linked booking paid/due amount
  if (entry.bookingId) {
    const bookings = getAllGasBookings();
    const bIdx = bookings.findIndex(b => b.id === entry.bookingId);
    if (bIdx !== -1) {
      const b = bookings[bIdx];
      const newPaid = round2((Number(b.paidAmount) || 0) + amount);
      const newDue = Math.max(0, round2((Number(b.totalAmount) || 0) - newPaid));
      bookings[bIdx] = {
        ...b,
        paidAmount: newPaid,
        dueAmount: newDue,
        paymentStatus: newDue <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Due'),
        updatedAt: nowIso
      };
      setItem(KEYS.GAS_BOOKINGS, bookings);
    }
  }

  // Sync linked service entry amountReceived/dueAmount
  if (entry.serviceEntryId && !data.skipServiceEntrySync) {
    const entries = getAllGasServiceEntries();
    const sIdx = entries.findIndex(e => e.id === entry.serviceEntryId || e.serviceId === entry.serviceEntryId);
    if (sIdx !== -1) {
      const e = entries[sIdx];
      const newRec = round2((Number(e.amountReceived) || 0) + amount);
      const newDue = Math.max(0, round2((Number(e.totalAmount) || 0) - newRec));
      entries[sIdx] = {
        ...e,
        amountReceived: newRec,
        dueAmount: newDue,
        paymentStatus: newDue <= 0 ? 'Paid' : (newRec > 0 ? 'Partial' : 'Due'),
        updatedAt: nowIso
      };
      setItem(KEYS.GAS_SERVICE_ENTRIES, entries);
    }
  }

  collections.unshift(entry);
  setItem(KEYS.GAS_COLLECTIONS, collections);

  // Sync to central MUN COMPUTER payments ledger safely (skipServiceSync: true)
  try {
    if (typeof recordPayment === 'function' && !data.skipCentralPaymentSync) {
      await recordPayment({
        customerId: entry.customerId || entry.gasCustomerId || 'WALKIN',
        customerName,
        customerPhone: mobile,
        serviceName: `LPG & Gas - ${category}`,
        paymentAmount: amount,
        paymentMode,
        transactionId: transactionRef || entry.receiptNo,
        paymentDate: collectionDate,
        notes: entry.remarks || `Gas Receipt ${entry.receiptNo}`,
        skipServiceSync: true,
        skipInvoiceSync: true,
        bypassDuplicateWindow: true
      });
    }
  } catch {
    // Non-blocking sync
  }

  logGasAudit('GAS_COLLECTION_ADD', `Collected ₹${amount} (${category}, ${paymentMode}) on ${entry.receiptNo} from ${customerName}`);
  return { success: true, collection: entry };
}

export function reverseGasCollection(id, reason = 'Admin reversal', options = {}) {
  if (!canPerformGasAction('reverse', 'gas-collections')) {
    return { success: false, message: 'Permission Denied: Only Administration can reverse Gas Collections.' };
  }
  const collections = getAllGasCollections();
  const idx = collections.findIndex(c => c.id === id || c.receiptNo === id);
  if (idx === -1) return { success: false, message: 'Collection record not found.' };
  if (collections[idx].status === 'Reversed') {
    return { success: false, message: 'This collection receipt is already reversed.' };
  }

  const col = collections[idx];
  const actor = getActorInfo();
  const nowIso = new Date().toISOString();

  collections[idx] = {
    ...col,
    status: 'Reversed',
    reversalReason: normStr(reason) || 'Admin approved reversal',
    reversedBy: actor.name,
    reversedByUid: actor.uid,
    reversedAt: nowIso,
    updatedAt: nowIso
  };
  setItem(KEYS.GAS_COLLECTIONS, collections);

  // Roll back linked Booking
  if (col.bookingId) {
    const bookings = getAllGasBookings();
    const bIdx = bookings.findIndex(b => b.id === col.bookingId);
    if (bIdx !== -1) {
      const b = bookings[bIdx];
      const newPaid = Math.max(0, round2((Number(b.paidAmount) || 0) - (Number(col.amount) || 0)));
      const newDue = Math.max(0, round2((Number(b.totalAmount) || 0) - newPaid));
      bookings[bIdx] = {
        ...b,
        paidAmount: newPaid,
        dueAmount: newDue,
        paymentStatus: newDue <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Due'),
        updatedAt: nowIso
      };
      setItem(KEYS.GAS_BOOKINGS, bookings);
    }
  }

  // Roll back linked Service Entry
  if (col.serviceEntryId && !options.skipServiceEntrySync) {
    const entries = getAllGasServiceEntries();
    const sIdx = entries.findIndex(e => e.id === col.serviceEntryId || e.serviceId === col.serviceEntryId);
    if (sIdx !== -1) {
      const e = entries[sIdx];
      const newRec = Math.max(0, round2((Number(e.amountReceived) || 0) - (Number(col.amount) || 0)));
      const newDue = Math.max(0, round2((Number(e.totalAmount) || 0) - newRec));
      entries[sIdx] = {
        ...e,
        amountReceived: newRec,
        dueAmount: newDue,
        paymentStatus: newDue <= 0 ? 'Paid' : (newRec > 0 ? 'Partial' : 'Due'),
        updatedAt: nowIso
      };
      setItem(KEYS.GAS_SERVICE_ENTRIES, entries);
    }
  }

  // Roll back linked Non-Taker recovery if not triggered from ledger
  if (col.nonTakerLedgerId && !options.skipNonTakerSync) {
    const ledgers = getAllNonTakerLedgers();
    const lIdx = ledgers.findIndex(l => l.id === col.nonTakerLedgerId);
    if (lIdx !== -1 && Array.isArray(ledgers[lIdx].recoveries)) {
      ledgers[lIdx].recoveries = ledgers[lIdx].recoveries.map(r =>
        r.collectionId === col.id ? { ...r, reversed: true, reversedAt: nowIso, reversalReason: reason } : r
      );
      ledgers[lIdx] = recomputeLedgerTotals(ledgers[lIdx]);
      setItem(KEYS.GAS_NON_TAKER_LEDGER, ledgers);
    }
  }

  logGasAudit('GAS_COLLECTION_REVERSE', `Reversed collection ${col.receiptNo} (₹${col.amount}). Reason: ${reason}`);
  return { success: true, collection: collections[idx] };
}

/* =========================================================================
   8 & 9. ACCESSORIES, RETAIL SALES, HARDWARE & STORAGE
   ========================================================================= */

export function getAllGasWarehouses() {
  return getItem(KEYS.GAS_WAREHOUSES, []);
}

export async function saveGasWarehouse(data = {}) {
  if (!canPerformGasAction('add', 'gas-storage')) {
    return { success: false, message: 'Permission Denied: Not authorized to manage Storage locations.' };
  }
  const name = normStr(data.name);
  if (!name) return { success: false, message: 'Storage / Warehouse Name is required.' };
  const list = getAllGasWarehouses();
  const warehouseId = data.id || await allocateGlobalReference('GASWH', { entityType: 'GAS_WAREHOUSE' });
  const record = {
    id: warehouseId,
    name,
    locationType: normStr(data.locationType) || 'Shop Counter / Godown',
    rackCount: Math.max(1, parseInt(data.rackCount, 10) || 1),
    inchargeName: normStr(data.inchargeName),
    notes: normStr(data.notes),
    updatedAt: new Date().toISOString()
  };
  const idx = list.findIndex(w => w.id === record.id);
  if (idx !== -1) list[idx] = { ...list[idx], ...record };
  else list.unshift({ ...record, createdAt: new Date().toISOString() });
  setItem(KEYS.GAS_WAREHOUSES, list);
  logGasAudit('GAS_WAREHOUSE_SAVE', `Saved storage location "${record.name}"`);
  return { success: true, warehouse: record };
}

export function getAllGasStockMovements() {
  return getItem(KEYS.GAS_STOCK_MOVEMENTS, []);
}

export function getAllGasDamagedStock() {
  return getItem(KEYS.GAS_DAMAGED_STOCK, []);
}

export async function recordGasStockMovement({
  productId,
  movementType = 'STOCK_IN',
  quantity,
  fromWarehouse = '',
  toWarehouse = '',
  referenceId = '',
  reason = '',
  allowNegativeOverride = false
}) {
  const actor = getActorInfo();
  const inv = getAllInventory();
  const product = inv.find(i => i.id === productId);
  if (!product) {
    return { success: false, message: 'Selected product SKU not found in inventory.' };
  }

  const qty = Math.abs(Number(quantity) || 0);
  if (qty <= 0) {
    return { success: false, message: 'Movement quantity must be greater than zero.' };
  }

  const isOutward = movementType === 'STOCK_OUT' || movementType === 'DAMAGE';
  if (isOutward) {
    if (allowNegativeOverride && !actor.isAdmin) {
      return { success: false, message: 'Permission Denied: Negative stock override is restricted to Administration.' };
    }
    const adjRes = await adjustStock(productId, -qty, `${movementType}: ${reason || referenceId}`, {
      strict: true,
      allowNegative: Boolean(allowNegativeOverride && actor.isAdmin),
      damagedDelta: movementType === 'DAMAGE' ? qty : 0
    });
    if (!adjRes.success) return adjRes;
  } else if (movementType === 'STOCK_IN' || movementType === 'SERVICE_RESTORE') {
    const adjRes = await adjustStock(productId, qty, `${movementType}: ${reason || referenceId}`);
    if (!adjRes.success) return adjRes;
  } else if (movementType === 'TRANSFER') {
    const items = getAllInventory();
    const idx = items.findIndex(i => i.id === productId);
    if (idx !== -1 && toWarehouse) {
      items[idx].warehouseName = toWarehouse;
      items[idx].updatedAt = new Date().toISOString();
      setItem(KEYS.INVENTORY, items);
    }
  }

  const movements = getAllGasStockMovements();
  const updatedProduct = getAllInventory().find(i => i.id === productId);
  const movId = await allocateGlobalReference('GASMOV', { entityType: 'GAS_STOCK_MOVEMENT' });
  const movEntry = {
    id: movId,
    date: getTodayDate(),
    timestamp: new Date().toISOString(),
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    category: product.category,
    brand: product.brand || '',
    movementType,
    quantity: qty,
    balanceAfter: Number(updatedProduct?.stockQuantity) || 0,
    fromWarehouse: normStr(fromWarehouse) || product.warehouseName || 'Main Counter',
    toWarehouse: normStr(toWarehouse),
    referenceId: normStr(referenceId),
    reason: normStr(reason) || movementType,
    actorUid: actor.uid,
    actorName: actor.name
  };
  movements.unshift(movEntry);
  setItem(KEYS.GAS_STOCK_MOVEMENTS, movements);

  if (movementType === 'DAMAGE') {
    const damaged = getAllGasDamagedStock();
    const dmgId = await allocateGlobalReference('ADJ', { entityType: 'GAS_DAMAGED_STOCK' });
    damaged.unshift({
      id: dmgId,
      date: getTodayDate(),
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      quantity: qty,
      reason: normStr(reason) || 'Damaged / Defective Item',
      costLoss: round2(qty * (Number(product.costPrice) || 0)),
      recordedBy: actor.name,
      createdAt: new Date().toISOString()
    });
    setItem(KEYS.GAS_DAMAGED_STOCK, damaged);
  }

  logGasAudit('GAS_STOCK_MOVEMENT', `${movementType} x${qty} on ${product.name} (${referenceId || reason || 'Manual'})`);
  return { success: true, movement: movEntry, product: updatedProduct };
}

export async function saveAccessoriesSale({
  gasCustomerId = '',
  customerName = '',
  mobile = '',
  productId,
  quantity = 1,
  unitPrice,
  discount = 0,
  amountReceived,
  paymentMode = 'Cash',
  transactionRef = '',
  saleDate = getTodayDate(),
  remarks = '',
  allowNegativeOverride = false
}) {
  if (!canPerformGasAction('add', 'gas-accessories')) {
    return { success: false, message: 'Permission Denied: Not authorized to record Accessories Sales.' };
  }
  const actor = getActorInfo();
  const inv = getAllInventory();
  const product = inv.find(i => i.id === productId);
  if (!product) return { success: false, message: 'Please select a valid accessory / product from stock.' };

  const qty = Math.max(1, Number(quantity) || 1);
  if (Number(product.stockQuantity) < qty && !(allowNegativeOverride && actor.isAdmin)) {
    return {
      success: false,
      message: `Insufficient stock for ${product.name} (Available: ${product.stockQuantity}, Requested: ${qty}).`
    };
  }

  const price = unitPrice !== undefined && unitPrice !== '' ? Math.max(0, Number(unitPrice) || 0) : (Number(product.sellingPrice) || 0);
  const disc = Math.max(0, Number(discount) || 0);
  const totalAmount = Math.max(0, round2(price * qty - disc));
  const paid = amountReceived !== undefined && amountReceived !== '' ? Math.max(0, round2(Number(amountReceived) || 0)) : totalAmount;

  if (paid > 0 && transactionRef) {
    const dup = checkDuplicateGasTxnRef(transactionRef);
    if (dup) {
      return { success: false, message: `Duplicate Transaction Reference "${transactionRef}" detected.` };
    }
  }

  const saleId = await allocateGlobalReference('PRD', { entityType: 'GAS_ACCESSORY_SALE' });
  const movRes = await recordGasStockMovement({
    productId: product.id,
    movementType: 'STOCK_OUT',
    quantity: qty,
    referenceId: saleId,
    reason: `Accessories Retail Sale (${qty} x ${product.name})`,
    allowNegativeOverride
  });
  if (!movRes.success) return movRes;

  let collection = null;
  if (paid > 0) {
    const cust = gasCustomerId ? getGasCustomerById(gasCustomerId) : null;
    const colRes = await recordGasCollection({
      gasCustomerId: cust?.id || '',
      customerName: cust?.fullName || customerName || 'Retail Counter Customer',
      mobile: cust?.mobile || mobile,
      category: 'Accessories Sales',
      collectionDate: saleDate,
      amount: paid,
      paymentMode,
      transactionRef,
      saleId,
      remarks: remarks || `Retail Sale: ${product.name} x${qty} (Total ₹${totalAmount})`
    });
    if (colRes.success) collection = colRes.collection;
  }

  logGasAudit('GAS_ACCESSORY_SALE', `Sold ${qty} x ${product.name} (Total ₹${totalAmount}, Paid ₹${paid}) [${saleId}]`);
  return {
    success: true,
    saleId,
    productName: product.name,
    quantity: qty,
    totalAmount,
    paidAmount: paid,
    dueAmount: Math.max(0, round2(totalAmount - paid)),
    collection
  };
}

/* =========================================================================
   10. SUPPLIER & PURCHASE
   ========================================================================= */

export function getAllGasSuppliers() {
  return getItem(KEYS.GAS_SUPPLIERS, []);
}

export async function saveGasSupplier(data = {}) {
  if (!canPerformGasAction('add', 'gas-suppliers')) {
    return { success: false, message: 'Permission Denied: Cannot manage Gas Suppliers.' };
  }
  const name = normStr(data.name || data.supplierName);
  if (!name) return { success: false, message: 'Supplier Name is required.' };
  const list = getAllGasSuppliers();
  const nowIso = new Date().toISOString();

  if (data.id) {
    const idx = list.findIndex(s => s.id === data.id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        name,
        contactPerson: normStr(data.contactPerson ?? list[idx].contactPerson),
        mobile: normStr(data.mobile ?? list[idx].mobile),
        gstin: normStr(data.gstin ?? list[idx].gstin),
        address: normStr(data.address ?? list[idx].address),
        category: normStr(data.category ?? list[idx].category) || 'LPG Hardware & Accessories',
        notes: normStr(data.notes ?? list[idx].notes),
        updatedAt: nowIso
      };
      setItem(KEYS.GAS_SUPPLIERS, list);
      logGasAudit('GAS_SUPPLIER_UPDATE', `Updated Supplier ${name}`);
      return { success: true, supplier: list[idx] };
    }
  }

  const supplierId = await allocateGlobalReference('GASSUP', { entityType: 'GAS_SUPPLIER' });
  const supplier = {
    id: supplierId,
    name,
    contactPerson: normStr(data.contactPerson),
    mobile: normStr(data.mobile),
    gstin: normStr(data.gstin),
    address: normStr(data.address),
    category: normStr(data.category) || 'LPG Hardware & Accessories',
    notes: normStr(data.notes),
    createdAt: nowIso,
    updatedAt: nowIso
  };
  list.unshift(supplier);
  setItem(KEYS.GAS_SUPPLIERS, list);
  logGasAudit('GAS_SUPPLIER_ADD', `Added Supplier ${supplier.name} (${supplier.id})`);
  return { success: true, supplier };
}

export function getAllGasPurchases() {
  return getItem(KEYS.GAS_PURCHASES, []);
}

export async function saveGasPurchase(data = {}) {
  if (!canPerformGasAction('add', 'gas-suppliers')) {
    return { success: false, message: 'Permission Denied: Cannot save Purchase Invoice.' };
  }

  const supplier = data.supplierId ? getAllGasSuppliers().find(s => s.id === data.supplierId) : null;
  const supplierName = supplier?.name || normStr(data.supplierName);
  if (!supplierName) {
    return { success: false, message: 'Please select or enter a Supplier.' };
  }

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const validItems = rawItems
    .map(item => ({
      productId: normStr(item.productId),
      quantity: Math.max(0, Number(item.quantity) || 0),
      unitCost: Math.max(0, round2(Number(item.unitCost) || 0))
    }))
    .filter(item => item.productId && item.quantity > 0);

  if (validItems.length === 0) {
    return { success: false, message: 'Add at least one product SKU with quantity > 0 to record a purchase.' };
  }

  const inv = getAllInventory();
  const resolvedLines = [];
  for (const line of validItems) {
    const prod = inv.find(p => p.id === line.productId);
    if (!prod) {
      return { success: false, message: `Product ${line.productId} not found in inventory.` };
    }
    const lineTotal = round2(line.quantity * line.unitCost);
    resolvedLines.push({
      productId: prod.id,
      sku: prod.sku,
      productName: prod.name,
      category: prod.category,
      quantity: line.quantity,
      unitCost: line.unitCost,
      lineTotal
    });
  }

  const subtotal = round2(resolvedLines.reduce((s, l) => s + l.lineTotal, 0));
  const gstAmount = Math.max(0, round2(Number(data.gstAmount) || 0));
  const otherCharges = Math.max(0, round2(Number(data.otherCharges) || 0));
  const totalAmount = round2(subtotal + gstAmount + otherCharges);
  const paidAmount = Math.min(totalAmount, Math.max(0, round2(Number(data.paidAmount) || 0)));
  const dueAmount = Math.max(0, round2(totalAmount - paidAmount));
  const paymentStatus = totalAmount === 0 || dueAmount <= 0 ? 'Paid' : (paidAmount > 0 ? 'Partial' : 'Due');

  const purchases = getAllGasPurchases();
  const purchaseNo = await allocateGlobalReference('GASPUR', { entityType: 'GAS_PURCHASE' });
  const actor = getActorInfo();
  const nowIso = new Date().toISOString();

  // Increment inventory & record STOCK_IN movements atomically
  for (const line of resolvedLines) {
    const items = getAllInventory();
    const idx = items.findIndex(i => i.id === line.productId);
    if (idx !== -1 && line.unitCost > 0) {
      items[idx].costPrice = line.unitCost;
      items[idx].supplier = supplierName;
      setItem(KEYS.INVENTORY, items);
    }
    await recordGasStockMovement({
      productId: line.productId,
      movementType: 'STOCK_IN',
      quantity: line.quantity,
      toWarehouse: normStr(data.warehouseName) || 'Main Counter',
      referenceId: purchaseNo,
      reason: `Supplier Purchase Bill ${normStr(data.billNumber) || purchaseNo} (${supplierName})`
    });
  }

  const purchase = {
    id: purchaseNo,
    purchaseNo,
    billNumber: normStr(data.billNumber) || purchaseNo,
    purchaseDate: normStr(data.purchaseDate) || getTodayDate(),
    supplierId: supplier?.id || '',
    supplierName,
    items: resolvedLines,
    subtotal,
    gstAmount,
    otherCharges,
    totalAmount,
    paidAmount,
    dueAmount,
    paymentMode: normStr(data.paymentMode) || 'Cash',
    paymentStatus,
    remarks: normStr(data.remarks),
    createdBy: actor.name,
    createdAt: nowIso
  };

  purchases.unshift(purchase);
  setItem(KEYS.GAS_PURCHASES, purchases);
  logGasAudit('GAS_PURCHASE_ADD', `Recorded Purchase ${purchase.purchaseNo} from ${supplierName}: ₹${totalAmount} (${resolvedLines.length} item(s))`);
  return { success: true, purchase };
}

/* =========================================================================
   11. CUSTOMER SERVICE & REPLACEMENT ENTRY (SEPARATE ATOMIC MODULE)
   ========================================================================= */

export function getAllGasServiceEntries() {
  return getItem(KEYS.GAS_SERVICE_ENTRIES, []);
}

export function getGasServiceEntryById(id) {
  return getAllGasServiceEntries().find(e => e.id === id || e.serviceId === id) || null;
}

export function calculateServiceFinancials(input = {}) {
  const regulatorCharge = Math.max(0, round2(Number(input.regulatorCharge) || 0));
  const pipeCharge = Math.max(0, round2(Number(input.pipeCharge) || 0));
  const otherCharge = Math.max(0, round2(Number(input.otherCharge) || 0));
  const serviceFee = Math.max(0, round2(Number(input.serviceFee) || 0));
  const discount = Math.max(0, round2(Number(input.discount) || 0));

  const grossAmount = round2(regulatorCharge + pipeCharge + otherCharge + serviceFee);
  const totalAmount = Math.max(0, round2(grossAmount - discount));
  const amountReceived = Math.max(0, round2(Number(input.amountReceived) || 0));
  const dueAmount = Math.max(0, round2(totalAmount - amountReceived));
  const paymentStatus = totalAmount === 0 || dueAmount <= 0 ? 'Paid' : (amountReceived > 0 ? 'Partial' : 'Due');

  return {
    regulatorCharge,
    pipeCharge,
    otherCharge,
    serviceFee,
    discount,
    grossAmount,
    totalAmount,
    amountReceived,
    dueAmount,
    paymentStatus
  };
}

export async function saveGasServiceEntry(payload = {}) {
  if (!canPerformGasAction('add', 'gas-service-replacement')) {
    return { success: false, message: 'Permission Denied: Not authorized to create Service & Replacement entries.' };
  }

  const actor = getActorInfo();
  const gasCustomer = getGasCustomerById(payload.gasCustomerId);
  if (!gasCustomer) {
    return { success: false, message: 'Please select a valid Gas Customer from the Register.' };
  }

  const serviceType = GAS_SERVICE_TYPES.includes(payload.serviceType)
    ? payload.serviceType
    : 'Regulator Change';
  const serviceDate = normStr(payload.serviceDate) || getTodayDate();

  const needsRegulator = serviceType === 'Regulator Change' || serviceType === 'Both Regulator and Pipe Change';
  const needsPipe = serviceType === 'Gas Pipe Change' || serviceType === 'Both Regulator and Pipe Change';

  const deductions = [];
  const inv = getAllInventory();

  if (needsRegulator && payload.regulatorProductId) {
    const qty = Math.max(1, Number(payload.regulatorQty) || 1);
    deductions.push({ role: 'Regulator', productId: payload.regulatorProductId, quantity: qty });
  }
  if (needsPipe && payload.pipeProductId) {
    const qty = Math.max(1, Number(payload.pipeQty) || 1);
    deductions.push({ role: 'Pipe', productId: payload.pipeProductId, quantity: qty });
  }
  if (payload.extraProductId && Number(payload.extraQty) > 0) {
    deductions.push({ role: 'Extra', productId: payload.extraProductId, quantity: Number(payload.extraQty) });
  }

  // Merge duplicate SKU deductions in the same transaction before validation!
  const combinedBySku = new Map();
  for (const d of deductions) {
    const prev = combinedBySku.get(d.productId) || 0;
    combinedBySku.set(d.productId, prev + d.quantity);
  }

  const allowOverride = Boolean(payload.allowNegativeOverride);
  if (allowOverride && !actor.isAdmin) {
    return {
      success: false,
      message: 'Permission Denied: Negative stock override is restricted strictly to Administration.'
    };
  }

  // PHASE 1: ATOMIC PRE-VALIDATION (ZERO MUTATIONS ALLOWED HERE)
  for (const [prodId, reqQty] of combinedBySku.entries()) {
    const item = inv.find(p => p.id === prodId);
    if (!item) {
      return {
        success: false,
        message: `Inventory item "${prodId}" not found. Entry aborted with zero stock changes.`
      };
    }
    const avail = Number(item.stockQuantity) || 0;
    if (avail < reqQty && !allowOverride) {
      return {
        success: false,
        message: `Insufficient stock for "${item.name}" (Available: ${avail}, Required: ${reqQty}). Service entry aborted and NO stock was deducted.`
      };
    }
  }

  const financials = calculateServiceFinancials(payload);
  if (financials.amountReceived > financials.totalAmount && financials.totalAmount > 0) {
    return {
      success: false,
      message: `Amount Received (₹${financials.amountReceived}) cannot exceed Net Total Amount (₹${financials.totalAmount}).`
    };
  }

  if (financials.amountReceived > 0 && payload.transactionRef) {
    const dup = checkDuplicateGasTxnRef(payload.transactionRef);
    if (dup) {
      return {
        success: false,
        message: `Duplicate Transaction Reference "${payload.transactionRef}" already exists on ${dup.receiptNo || dup.id}.`
      };
    }
  }

  // PHASE 2: ALL CHECKS PASSED -> GENERATE ID, DEDUCT STOCK & SAVE
  const entries = getAllGasServiceEntries();
  const serviceId = await allocateGlobalReference('GASSRV', { entityType: 'GAS_SERVICE_ENTRY' });

  const regProd = payload.regulatorProductId ? inv.find(i => i.id === payload.regulatorProductId) : null;
  const pipeProd = payload.pipeProductId ? inv.find(i => i.id === payload.pipeProductId) : null;
  const extraProd = payload.extraProductId ? inv.find(i => i.id === payload.extraProductId) : null;

  const movementIds = [];
  for (const [prodId, reqQty] of combinedBySku.entries()) {
    const movRes = await recordGasStockMovement({
      productId: prodId,
      movementType: 'STOCK_OUT',
      quantity: reqQty,
      referenceId: serviceId,
      reason: `Service & Replacement (${serviceType}) for ${gasCustomer.fullName}`,
      allowNegativeOverride: allowOverride
    });
    if (movRes.success && movRes.movement) {
      movementIds.push(movRes.movement.id);
    }
  }

  const settings = getGasSettings();
  const nextServiceDueDate = normStr(payload.nextServiceDueDate) || addDaysIso(serviceDate, settings.defaultPipeServiceCycleDays || 730);
  const nowIso = new Date().toISOString();

  const entry = {
    id: serviceId,
    serviceId,
    gasCustomerId: gasCustomer.id,
    customerId: gasCustomer.customerId || '',
    customerName: gasCustomer.fullName,
    consumerId: gasCustomer.consumerId,
    mobile: gasCustomer.mobile,
    villageAddress: gasCustomer.villageAddress,
    serviceDate,
    serviceType,
    complaintIssue: normStr(payload.complaintIssue),
    previousRegulatorDetails: normStr(payload.previousRegulatorDetails),
    newRegulatorDetails: normStr(payload.newRegulatorDetails) || (regProd ? regProd.name : ''),
    regulatorBrand: normStr(payload.regulatorBrand) || (regProd?.brand || ''),
    regulatorProductId: regProd?.id || '',
    regulatorSku: regProd?.sku || '',
    regulatorQty: needsRegulator && regProd ? Math.max(1, Number(payload.regulatorQty) || 1) : 0,
    previousPipeDetails: normStr(payload.previousPipeDetails),
    newPipeDetails: normStr(payload.newPipeDetails) || (pipeProd ? pipeProd.name : ''),
    pipeBrand: normStr(payload.pipeBrand) || (pipeProd?.brand || ''),
    pipeProductId: pipeProd?.id || '',
    pipeSku: pipeProd?.sku || '',
    pipeQty: needsPipe && pipeProd ? Math.max(1, Number(payload.pipeQty) || 1) : 0,
    extraProductId: extraProd?.id || '',
    extraProductName: extraProd?.name || '',
    extraQty: extraProd ? Math.max(0, Number(payload.extraQty) || 0) : 0,
    deductedItems: Array.from(combinedBySku.entries()).map(([productId, quantity]) => ({ productId, quantity })),
    movementIds,
    technicianName: normStr(payload.technicianName) || actor.name,
    remarks: normStr(payload.remarks),
    nextServiceDueDate,
    ...financials,
    paymentMode: normStr(payload.paymentMode) || 'Cash',
    transactionRef: normStr(payload.transactionRef),
    status: 'Completed',
    createdAt: nowIso,
    updatedAt: nowIso,
    createdByUid: actor.uid
  };

  entries.unshift(entry);
  setItem(KEYS.GAS_SERVICE_ENTRIES, entries);

  // Update customer service dates
  const customers = getAllGasCustomers();
  const cIdx = customers.findIndex(c => c.id === gasCustomer.id);
  if (cIdx !== -1) {
    customers[cIdx].lastServiceDate = serviceDate;
    customers[cIdx].nextServiceDueDate = nextServiceDueDate;
    customers[cIdx].updatedAt = nowIso;
    setItem(KEYS.GAS_CUSTOMERS, customers);
  }

  // Record collection if received > 0
  if (entry.amountReceived > 0) {
    await recordGasCollection({
      gasCustomerId: gasCustomer.id,
      serviceEntryId: entry.serviceId,
      category: 'Gas Service Charge',
      collectionDate: serviceDate,
      amount: entry.amountReceived,
      paymentMode: entry.paymentMode,
      transactionRef: entry.transactionRef,
      remarks: `Service & Replacement ${entry.serviceId} (${entry.serviceType})`,
      skipServiceEntrySync: true
    });
  }

  logGasAudit(
    'GAS_SERVICE_ENTRY_CREATE',
    `Saved Service ${entry.serviceId} (${entry.serviceType}) for ${gasCustomer.fullName}. Total ₹${entry.totalAmount}, Stock items deducted: ${entry.deductedItems.length}`
  );
  return { success: true, entry };
}

export async function reverseGasServiceEntry(serviceId, reason = 'Admin reversal / cancellation') {
  if (!canPerformGasAction('reverse', 'gas-service-replacement')) {
    return { success: false, message: 'Permission Denied: Only Administration can cancel/reverse a Service & Replacement Entry.' };
  }
  const entries = getAllGasServiceEntries();
  const idx = entries.findIndex(e => e.id === serviceId || e.serviceId === serviceId);
  if (idx === -1) return { success: false, message: 'Service & Replacement entry not found.' };

  const entry = entries[idx];
  if (entry.status === 'Cancelled') {
    return { success: false, message: 'Service entry is already cancelled and stock was restored.' };
  }

  const actor = getActorInfo();
  const nowIso = new Date().toISOString();

  // Restore deducted stock
  for (const item of Array.isArray(entry.deductedItems) ? entry.deductedItems : []) {
    if (item.productId && Number(item.quantity) > 0) {
      await recordGasStockMovement({
        productId: item.productId,
        movementType: 'SERVICE_RESTORE',
        quantity: Number(item.quantity),
        referenceId: entry.serviceId,
        reason: `Stock restored on Admin cancellation of ${entry.serviceId}: ${reason}`
      });
    }
  }

  // Reverse linked Gas Collections
  const linkedCols = getAllGasCollections().filter(c => c.serviceEntryId === entry.serviceId && c.status !== 'Reversed');
  for (const col of linkedCols) {
    reverseGasCollection(col.id, `Service Entry ${entry.serviceId} cancelled: ${reason}`, { skipServiceEntrySync: true });
  }

  entries[idx] = {
    ...entry,
    status: 'Cancelled',
    cancellationReason: normStr(reason),
    cancelledBy: actor.name,
    cancelledByUid: actor.uid,
    cancelledAt: nowIso,
    updatedAt: nowIso
  };
  setItem(KEYS.GAS_SERVICE_ENTRIES, entries);

  logGasAudit('GAS_SERVICE_ENTRY_REVERSE', `Cancelled Service ${entry.serviceId} & restored stock. Reason: ${reason}`);
  return { success: true, entry: entries[idx] };
}

/* =========================================================================
   1. GAS DASHBOARD KPI & ANALYTICS AGGREGATOR
   ========================================================================= */

export function getGasDashboardStats({ dateFrom = '', dateTo = '' } = {}) {
  const today = getTodayDate();
  const inRange = (d) => {
    if (!d) return true;
    const ds = String(d).slice(0, 10);
    if (dateFrom && ds < dateFrom) return false;
    if (dateTo && ds > dateTo) return false;
    return true;
  };

  const customers = getAllGasCustomers();
  const allBookingsRaw = getAllGasBookings();
  const bookings = allBookingsRaw.filter(b => inRange(b.bookingDate));
  const eligibility = getGasEligibilitySummary(today);
  const subsidies = getAllGasSubsidies().filter(s => inRange(s.bookingDate));
  const nonTakerLedgers = getAllNonTakerLedgers().filter(l => inRange(l.entryDate));
  const collections = getAllGasCollections().filter(c => c.status !== 'Reversed' && inRange(c.collectionDate));
  const serviceEntries = getAllGasServiceEntries().filter(e => e.status !== 'Cancelled' && inRange(e.serviceDate));
  const inventory = getAllInventory();
  const deliveryPersons = getAllGasDeliveryPersons();

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === 'Active').length;
  const totalBookings = bookings.length;
  const todaysBookings = allBookingsRaw.filter(b => b.bookingDate === today && !isBookingCancelledStatus(b.deliveryStatus)).length;
  const upcomingBookings = eligibility.upcoming7.length;
  const eligibleCustomersCount = eligibility.eligibleNotBooked.length + eligibility.eligibleToday.filter(
    e => !eligibility.eligibleNotBooked.some(n => n.gasCustomerId === e.gasCustomerId)
  ).length;

  const stageCounts = {};
  for (const st of GAS_BOOKING_STATUSES) stageCounts[st] = 0;
  for (const b of bookings) {
    const st = normalizeGasBookingStatus(b.deliveryStatus);
    stageCounts[st] = (stageCounts[st] || 0) + 1;
  }

  const cancelledCount = bookings.filter(b => isBookingCancelledStatus(b.deliveryStatus)).length;
  const deliveredSuccessCount = bookings.filter(b => isBookingDeliveredStatus(b.deliveryStatus)).length;
  const pendingDeliveries = allBookingsRaw.filter(
    b => !isBookingDeliveredStatus(b.deliveryStatus) && !isBookingCancelledStatus(b.deliveryStatus)
  ).length;

  const totalDeliveryCharges = round2(
    bookings.filter(b => !isBookingCancelledStatus(b.deliveryStatus)).reduce((s, b) => s + (Number(b.deliveryCharge) || 0), 0)
  );
  const totalGasSales = round2(
    bookings.filter(b => !isBookingCancelledStatus(b.deliveryStatus)).reduce((s, b) => s + (Number(b.totalAmount) || 0), 0)
  );

  const totalCollection = round2(collections.reduce((s, c) => s + (Number(c.amount) || 0), 0));
  const bookingDue = bookings.filter(b => !isBookingCancelledStatus(b.deliveryStatus)).reduce((s, b) => s + (Number(b.dueAmount) || 0), 0);
  const serviceDue = serviceEntries.reduce((s, e) => s + (Number(e.dueAmount) || 0), 0);
  const nonTakerOutstanding = round2(nonTakerLedgers.reduce((s, l) => s + (Number(l.outstandingAmount) || 0), 0));
  const outstandingAmount = round2(bookingDue + serviceDue + nonTakerOutstanding);

  const subsidyCredited = round2(subsidies.filter(s => s.dbtStatus === 'Credited').reduce((sum, s) => sum + (Number(s.actualCredited) || 0), 0));
  const subsidyPending = round2(subsidies.filter(s => s.dbtStatus === 'Expected' || s.dbtStatus === 'Pending' || s.dbtStatus === 'Under Verification').reduce((sum, s) => sum + (Number(s.expectedSubsidy) || 0), 0));

  const customerServiceCount = serviceEntries.length;
  const regulatorReplacementCount = serviceEntries.filter(
    e => e.serviceType === 'Regulator Change' || e.serviceType === 'Both Regulator and Pipe Change'
  ).length;
  const gasPipeReplacementCount = serviceEntries.filter(
    e => e.serviceType === 'Gas Pipe Change' || e.serviceType === 'Both Regulator and Pipe Change'
  ).length;

  const accessoriesSales = round2(
    collections.filter(c => c.category === 'Accessories Sales').reduce((s, c) => s + (Number(c.amount) || 0), 0)
  );
  const inventoryCostValue = round2(inventory.reduce((s, i) => s + (Number(i.stockQuantity) || 0) * (Number(i.costPrice) || 0), 0));
  const inventoryRetailValue = round2(inventory.reduce((s, i) => s + (Number(i.stockQuantity) || 0) * (Number(i.sellingPrice) || 0), 0));
  const lowStockItems = inventory.filter(i => (Number(i.stockQuantity) || 0) <= (Number(i.minStockLevel) || 5));

  // Chart data: last 7 days collections & bookings
  const dailyTrend = [];
  for (let offset = 6; offset >= 0; offset--) {
    const dt = addDaysIso(today, -offset);
    const dayCol = round2(collections.filter(c => c.collectionDate === dt).reduce((s, c) => s + (Number(c.amount) || 0), 0));
    const dayBks = bookings.filter(b => b.bookingDate === dt && !isBookingCancelledStatus(b.deliveryStatus)).length;
    dailyTrend.push({ date: dt, label: dt.slice(5), collection: dayCol, bookings: dayBks });
  }

  return {
    totalCustomers,
    activeCustomers,
    totalBookings,
    totalGasBookings: totalBookings,
    todaysBookings,
    upcomingBookings,
    eligibleCustomersCount,
    pendingDeliveries,
    pendingDeliveriesCount: pendingDeliveries,
    receivedCount: stageCounts['Booking Received'] || 0,
    confirmedCount: stageCounts['Booking Confirmed'] || 0,
    processingCount: stageCounts['Order Processing'] || 0,
    readyDispatchCount: stageCounts['Ready for Dispatch'] || 0,
    deliveryAssignedCount: stageCounts['Delivery Assigned'] || 0,
    outForDeliveryCount: stageCounts['Out for Delivery'] || 0,
    deliveredSuccessCount,
    cancelledCount,
    stageCounts,
    totalDeliveryCharges,
    totalGasSales,
    activeDeliveryPersons: deliveryPersons.filter(p => p.isActive !== false).length,
    totalCollection,
    outstandingAmount,
    subsidyCredited,
    subsidyPending,
    nonTakerOutstanding,
    customerServiceCount,
    regulatorReplacementCount,
    gasPipeReplacementCount,
    accessoriesSales,
    inventoryValue: inventoryCostValue,
    inventoryRetailValue,
    lowStockCount: lowStockItems.length,
    lowStockItems,
    dailyTrend,
    eligibility
  };
}

/* =========================================================================
   12. GAS REPORTS ENGINE (ALL 19 REPORTS WITH TOTALS FOR EXPORTUTILITY)
   ========================================================================= */

export const GAS_REPORT_DEFINITIONS = [
  { id: 'customer_master', title: 'Gas Customer Master Report', category: 'Customers & Eligibility', description: 'Complete LPG customer profiles, Consumer IDs, Agencies & eKYC/Bank status' },
  { id: 'booking_register', title: 'Booking Register Report', category: 'Bookings & Delivery', description: 'All gas bookings, cylinder types, distances, delivery charges & delivery tracking' },
  { id: 'pending_deliveries', title: 'Pending Delivery Report', category: 'Bookings & Delivery', description: 'Open refill & cylinder deliveries across dispatch & out-for-delivery stages' },
  { id: 'eligibility_list', title: 'Booking Eligibility List Report', category: 'Customers & Eligibility', description: 'Customers eligible today or overdue based on administrative reminder intervals' },
  { id: 'upcoming_eligibility', title: 'Upcoming Eligibility Report', category: 'Customers & Eligibility', description: 'Customers becoming eligible within the next 7 to 15 days' },
  { id: 'subsidy_dbt', title: 'Subsidy & DBT Tracking Report', category: 'Subsidy & Advance', description: 'Expected vs Verified Credited DBT subsidy amounts and bank status' },
  { id: 'non_taker_ledger', title: 'Non-Taker Subsidy Due Ledger Report', category: 'Subsidy & Advance', description: 'Authorized advance balances: Outstanding = Advance - Recovery' },
  { id: 'non_taker_recovery', title: 'Non-Taker Recovery Report', category: 'Subsidy & Advance', description: 'Itemized partial and full advance recovery transactions' },
  { id: 'daily_collection', title: 'Daily Gas Collection Report', category: 'Finance & Collections', description: 'Day-wise gas booking, service, accessory & advance collections' },
  { id: 'monthly_collection', title: 'Monthly Gas Collection Report', category: 'Finance & Collections', description: 'Month-wise collection summary across all Gas categories' },
  { id: 'payment_mode_summary', title: 'Payment Mode Summary', category: 'Finance & Collections', description: 'Collections grouped by Cash, UPI, Bank Transfer & Card' },
  { id: 'accessories_sales', title: 'Accessories Sales Report', category: 'Hardware & Stock', description: 'Retail sales of gas pipes, lighters, regulators, stoves & spares' },
  { id: 'inventory_valuation', title: 'Hardware Inventory Valuation Report', category: 'Hardware & Stock', description: 'Current stock quantity, cost value, retail value & margin potential' },
  { id: 'low_stock', title: 'Low Stock Report', category: 'Hardware & Stock', description: 'Gas hardware items at or below minimum reorder threshold' },
  { id: 'stock_movement', title: 'Stock Movement History', category: 'Hardware & Stock', description: 'Stock In, Stock Out, Transfers, Damages & Service Restorations' },
  { id: 'supplier_purchase', title: 'Supplier Purchase Report', category: 'Hardware & Stock', description: 'Supplier bills, quantities received, GST & supplier balance' },
  { id: 'service_replacement_register', title: 'Customer Service & Replacement Register', category: 'Service & Replacement', description: 'Complete register of Regulator/Pipe/Gas service entries & billing' },
  { id: 'regulator_pipe_replacement', title: 'Regulator & Pipe Replacement History', category: 'Service & Replacement', description: 'Hardware replacements linked to Service IDs & Inventory SKUs' },
  { id: 'financial_profit_loss', title: 'Gas Financial Profit & Loss Summary', category: 'Finance & Collections', description: 'Collections & service revenue vs purchase cost & damaged stock loss' }
];

export function buildGasReportDataset(reportKey, { dateFrom = '', dateTo = '', search = '', status = 'all' } = {}) {
  const meta = GAS_REPORT_DEFINITIONS.find(r => r.id === reportKey) || GAS_REPORT_DEFINITIONS[0];
  const q = normStr(search).toLowerCase();
  const inDate = (d) => {
    if (!dateFrom && !dateTo) return true;
    const ds = String(d || '').slice(0, 10);
    if (!ds) return true;
    if (dateFrom && ds < dateFrom) return false;
    if (dateTo && ds > dateTo) return false;
    return true;
  };
  const matchSearch = (parts) => !q || parts.some(p => String(p || '').toLowerCase().includes(q));

  let headers = [];
  let rows = [];
  let sumCols = [];

  if (reportKey === 'customer_master') {
    headers = ['Cust ID', 'Full Name', 'Mobile', 'Consumer / LPG ID', 'Agency / Company', 'Category', 'Cylinder', 'eKYC', 'Bank Last 4', 'Status'];
    rows = getAllGasCustomers()
      .filter(c => (status === 'all' || c.status === status) && matchSearch([c.id, c.fullName, c.mobile, c.consumerId, c.lpgId17, c.villageAddress, c.agencyName, c.gasCompany]))
      .map(c => [
        c.id,
        c.fullName,
        c.mobile,
        c.consumerId || c.lpgId17 || '-',
        c.agencyName || c.gasCompany,
        c.connectionCategory,
        c.cylinderType,
        c.ekycStatus,
        c.maskedAccount || c.bankLinkStatus,
        c.status
      ]);
  } else if (reportKey === 'booking_register' || reportKey === 'pending_deliveries') {
    headers = ['Booking No', 'Date', 'Customer', 'Agency', 'Cylinder', 'Qty', 'Dist (KM)', 'Del Fee (₹)', 'Total (₹)', 'Paid (₹)', 'Due (₹)', 'Rider', 'Stage'];
    rows = getAllGasBookings()
      .filter(b => inDate(b.bookingDate))
      .filter(b => (
        reportKey === 'pending_deliveries'
          ? (!isBookingDeliveredStatus(b.deliveryStatus) && !isBookingCancelledStatus(b.deliveryStatus))
          : (status === 'all' || normalizeGasBookingStatus(b.deliveryStatus) === normalizeGasBookingStatus(status))
      ))
      .filter(b => matchSearch([b.bookingNo, b.customerName, b.consumerId, b.lpgId17, b.bookingRefNo, b.agencyName, b.deliveryPersonName]))
      .map(b => [
        b.bookingNo,
        b.bookingDate,
        b.customerName,
        b.agencyName || b.gasCompany,
        b.cylinderType,
        b.quantity,
        b.deliveryDistanceKm || 0,
        b.deliveryCharge || 0,
        b.totalAmount,
        b.paidAmount,
        b.dueAmount,
        b.deliveryPersonName || b.deliveryStaff || '-',
        normalizeGasBookingStatus(b.deliveryStatus)
      ]);
    sumCols = [5, 7, 8, 9, 10];
  } else if (reportKey === 'eligibility_list' || reportKey === 'upcoming_eligibility') {
    const elig = getGasEligibilitySummary(getTodayDate());
    const pool = reportKey === 'eligibility_list'
      ? [...elig.eligibleToday, ...elig.overdue, ...elig.neverBooked]
      : [...elig.upcoming7, ...elig.upcoming15];
    headers = ['Cust ID', 'Customer Name', 'Mobile', 'Consumer ID', 'Company', 'Last Booking', 'Interval (Days)', 'Next Eligible Date', 'Status'];
    rows = pool
      .filter(r => matchSearch([r.gasCustomerId, r.customerName, r.mobile, r.consumerId]))
      .map(r => [r.gasCustomerId, r.customerName, r.mobile, r.consumerId, r.gasCompany, r.lastValidBookingDate || 'None', r.intervalDays, r.nextEligibleDate, r.statusLabel]);
  } else if (reportKey === 'subsidy_dbt') {
    headers = ['DBT ID', 'Customer', 'Consumer ID', 'Booking No', 'Booking Date', 'Expected (₹)', 'Credited (₹)', 'Variance (₹)', 'Credit Date', 'Bank Ref', 'Status'];
    rows = getAllGasSubsidies()
      .filter(s => inDate(s.bookingDate))
      .filter(s => (status === 'all' || s.dbtStatus === status) && matchSearch([s.id, s.customerName, s.consumerId, s.bankReference]))
      .map(s => [s.id, s.customerName, s.consumerId, s.bookingNo || '-', s.bookingDate, s.expectedSubsidy, s.actualCredited, s.variance, s.dbtCreditDate || '-', s.bankReference || '-', s.dbtStatus]);
    sumCols = [5, 6, 7];
  } else if (reportKey === 'non_taker_ledger') {
    headers = ['Ledger ID', 'Date', 'Customer', 'Consumer ID', 'Advance (₹)', 'Recovered (₹)', 'Outstanding (₹)', 'Status', 'Consent Note'];
    rows = getAllNonTakerLedgers()
      .filter(l => inDate(l.entryDate) && (status === 'all' || l.status === status) && matchSearch([l.id, l.customerName, l.consumerId]))
      .map(l => [l.id, l.entryDate, l.customerName, l.consumerId, l.actualAuthorizedAdvance, l.totalRecovery, l.outstandingAmount, l.status, l.authorizationNote]);
    sumCols = [4, 5, 6];
  } else if (reportKey === 'non_taker_recovery') {
    headers = ['Recovery ID', 'Ledger ID', 'Date', 'Customer', 'Amount (₹)', 'Mode', 'Txn Ref', 'Status'];
    rows = [];
    for (const l of getAllNonTakerLedgers()) {
      for (const r of l.recoveries || []) {
        if (!inDate(r.date)) continue;
        if (!matchSearch([r.id, l.id, l.customerName, r.transactionRef])) continue;
        rows.push([r.id, l.id, r.date, l.customerName, r.reversed ? 0 : r.amount, r.paymentMode, r.transactionRef || '-', r.reversed ? 'Reversed' : 'Active']);
      }
    }
    sumCols = [4];
  } else if (reportKey === 'daily_collection' || reportKey === 'accessories_sales') {
    headers = ['Receipt No', 'Date', 'Customer', 'Category', 'Mode', 'Txn Ref', 'Amount (₹)', 'Status', 'Remarks'];
    rows = getAllGasCollections()
      .filter(c => inDate(c.collectionDate))
      .filter(c => reportKey === 'accessories_sales' ? c.category === 'Accessories Sales' : true)
      .filter(c => (status === 'all' || c.status === status) && matchSearch([c.receiptNo, c.customerName, c.category, c.transactionRef]))
      .map(c => [c.receiptNo, c.collectionDate, c.customerName, c.category, c.paymentMode, c.transactionRef || '-', c.status === 'Reversed' ? 0 : c.amount, c.status, c.remarks]);
    sumCols = [6];
  } else if (reportKey === 'monthly_collection') {
    headers = ['Month', 'Transactions', 'Cash (₹)', 'UPI (₹)', 'Bank/Card (₹)', 'Total Collected (₹)'];
    const byMonth = new Map();
    for (const c of getAllGasCollections().filter(x => x.status !== 'Reversed' && inDate(x.collectionDate))) {
      const m = String(c.collectionDate || '').slice(0, 7) || 'Unknown';
      if (!byMonth.has(m)) byMonth.set(m, { month: m, count: 0, cash: 0, upi: 0, other: 0, total: 0 });
      const b = byMonth.get(m);
      const amt = Number(c.amount) || 0;
      b.count += 1;
      b.total = round2(b.total + amt);
      if (c.paymentMode === 'Cash') b.cash = round2(b.cash + amt);
      else if (c.paymentMode === 'UPI') b.upi = round2(b.upi + amt);
      else b.other = round2(b.other + amt);
    }
    rows = Array.from(byMonth.values()).sort((a, b) => (a.month < b.month ? 1 : -1)).map(x => [x.month, x.count, x.cash, x.upi, x.other, x.total]);
    sumCols = [1, 2, 3, 4, 5];
  } else if (reportKey === 'payment_mode_summary') {
    headers = ['Payment Mode', 'Receipt Count', 'Verified Collection (₹)'];
    const byMode = new Map();
    for (const c of getAllGasCollections().filter(x => x.status !== 'Reversed' && inDate(x.collectionDate))) {
      const mode = c.paymentMode || 'Cash';
      if (!byMode.has(mode)) byMode.set(mode, { mode, count: 0, total: 0 });
      const b = byMode.get(mode);
      b.count += 1;
      b.total = round2(b.total + (Number(c.amount) || 0));
    }
    rows = Array.from(byMode.values()).map(x => [x.mode, x.count, x.total]);
    sumCols = [1, 2];
  } else if (reportKey === 'inventory_valuation' || reportKey === 'low_stock') {
    headers = ['SKU', 'Product Name', 'Category', 'Brand', 'Storage', 'Stock Qty', 'Min Level', 'Cost (₹)', 'Sell (₹)', 'Cost Value (₹)', 'Retail Value (₹)'];
    rows = getAllInventory()
      .filter(i => reportKey === 'low_stock' ? (Number(i.stockQuantity) || 0) <= (Number(i.minStockLevel) || 5) : true)
      .filter(i => matchSearch([i.sku, i.name, i.category, i.brand, i.warehouseName]))
      .map(i => {
        const qty = Number(i.stockQuantity) || 0;
        const costVal = round2(qty * (Number(i.costPrice) || 0));
        const retVal = round2(qty * (Number(i.sellingPrice) || 0));
        return [i.sku, i.name, i.category, i.brand || '-', i.warehouseName || i.shelfLocation || 'Main Counter', qty, i.minStockLevel || 5, i.costPrice || 0, i.sellingPrice || 0, costVal, retVal];
      });
    sumCols = [5, 9, 10];
  } else if (reportKey === 'stock_movement') {
    headers = ['Movement ID', 'Date', 'SKU', 'Product Name', 'Type', 'Qty', 'Balance After', 'Reference', 'Reason'];
    rows = getAllGasStockMovements()
      .filter(m => inDate(m.date) && matchSearch([m.id, m.sku, m.productName, m.movementType, m.referenceId]))
      .map(m => [m.id, m.date, m.sku, m.productName, m.movementType, m.quantity, m.balanceAfter, m.referenceId || '-', m.reason]);
    sumCols = [5];
  } else if (reportKey === 'supplier_purchase') {
    headers = ['Purchase No', 'Bill No', 'Date', 'Supplier', 'Items', 'Subtotal (₹)', 'GST (₹)', 'Total (₹)', 'Paid (₹)', 'Due (₹)', 'Status'];
    rows = getAllGasPurchases()
      .filter(p => inDate(p.purchaseDate) && (status === 'all' || p.paymentStatus === status) && matchSearch([p.purchaseNo, p.billNumber, p.supplierName]))
      .map(p => [p.purchaseNo, p.billNumber, p.purchaseDate, p.supplierName, (p.items || []).length, p.subtotal, p.gstAmount, p.totalAmount, p.paidAmount, p.dueAmount, p.paymentStatus]);
    sumCols = [5, 6, 7, 8, 9];
  } else if (reportKey === 'service_replacement_register') {
    headers = ['Service ID', 'Date', 'Customer', 'Consumer ID', 'Service Type', 'Regulator (₹)', 'Pipe (₹)', 'Fee/Other (₹)', 'Discount (₹)', 'Total (₹)', 'Paid (₹)', 'Due (₹)', 'Status'];
    rows = getAllGasServiceEntries()
      .filter(e => inDate(e.serviceDate) && (status === 'all' || e.status === status) && matchSearch([e.serviceId, e.customerName, e.consumerId, e.serviceType]))
      .map(e => [e.serviceId, e.serviceDate, e.customerName, e.consumerId, e.serviceType, e.regulatorCharge, e.pipeCharge, round2((Number(e.otherCharge) || 0) + (Number(e.serviceFee) || 0)), e.discount, e.totalAmount, e.amountReceived, e.dueAmount, e.status]);
    sumCols = [5, 6, 7, 8, 9, 10, 11];
  } else if (reportKey === 'regulator_pipe_replacement') {
    headers = ['Service ID', 'Date', 'Customer', 'Type', 'Old Regulator', 'New Regulator / SKU', 'Old Pipe', 'New Pipe / SKU', 'Technician', 'Next Service Due'];
    rows = getAllGasServiceEntries()
      .filter(e => inDate(e.serviceDate) && e.status !== 'Cancelled' && matchSearch([e.serviceId, e.customerName, e.newRegulatorDetails, e.newPipeDetails, e.technicianName]))
      .map(e => [e.serviceId, e.serviceDate, e.customerName, e.serviceType, e.previousRegulatorDetails || '-', e.newRegulatorDetails || '-', e.previousPipeDetails || '-', e.newPipeDetails || '-', e.technicianName, e.nextServiceDueDate || '-']);
  } else if (reportKey === 'financial_profit_loss') {
    const collections = getAllGasCollections().filter(c => c.status !== 'Reversed' && inDate(c.collectionDate));
    const purchases = getAllGasPurchases().filter(p => inDate(p.purchaseDate));
    const damaged = getAllGasDamagedStock().filter(d => inDate(d.date));
    const bookingCol = round2(collections.filter(c => c.category === 'Gas Booking Payment').reduce((s, c) => s + (Number(c.amount) || 0), 0));
    const serviceCol = round2(collections.filter(c => c.category === 'Gas Service Charge').reduce((s, c) => s + (Number(c.amount) || 0), 0));
    const accessoryCol = round2(collections.filter(c => c.category === 'Accessories Sales').reduce((s, c) => s + (Number(c.amount) || 0), 0));
    const advanceRec = round2(collections.filter(c => c.category === 'Authorized Advance Recovery').reduce((s, c) => s + (Number(c.amount) || 0), 0));
    const otherCol = round2(collections.filter(c => c.category === 'Other Receivables').reduce((s, c) => s + (Number(c.amount) || 0), 0));
    const totalRevenue = round2(bookingCol + serviceCol + accessoryCol + advanceRec + otherCol);
    const totalPurchases = round2(purchases.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0));
    const damagedLoss = round2(damaged.reduce((s, d) => s + (Number(d.costLoss) || 0), 0));
    const netSurplus = round2(totalRevenue - totalPurchases - damagedLoss);

    headers = ['Line Item', 'Classification', 'Amount (₹)'];
    rows = [
      ['Gas Booking Payments Collected', 'Income / Inflow', bookingCol],
      ['Customer Service & Replacement Charges', 'Income / Inflow', serviceCol],
      ['Accessories & Retail Sales', 'Income / Inflow', accessoryCol],
      ['Authorized Advance Recoveries', 'Recovery Inflow', advanceRec],
      ['Other Gas Receivables', 'Income / Inflow', otherCol],
      ['Total Supplier Hardware Purchases', 'Outflow / Cost', -totalPurchases],
      ['Damaged / Scrap Stock Cost Loss', 'Loss / Write-off', -damagedLoss],
      ['Net Operating Surplus (Inflow - Outflow)', 'Summary', netSurplus]
    ];
  }

  let totalsRow = null;
  if (rows.length > 0 && sumCols.length > 0) {
    totalsRow = headers.map((_, idx) => {
      if (idx === 0) return 'TOTAL';
      if (sumCols.includes(idx)) {
        return round2(rows.reduce((sum, r) => sum + (Number(r[idx]) || 0), 0));
      }
      return '';
    });
  }

  return {
    key: meta.id,
    title: meta.title,
    category: meta.category,
    subtitle: `${meta.description}${dateFrom || dateTo ? ` | Period: ${dateFrom || 'Start'} to ${dateTo || 'Today'}` : ''}`,
    filename: `MUN_COMPUTER_Gas_${meta.id}`,
    headers,
    rows,
    totalsRow
  };
}
