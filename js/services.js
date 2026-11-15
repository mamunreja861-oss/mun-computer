/**
 * services.js - Service Registration, Tracking & Delivery Management
 * Official Shop: MUN COMPUTER
 */

import { getItem, setItem, KEYS, allocateGlobalReference, markGlobalReferenceDeleted, getTodayDate, logAuditAction } from './storage.js';

export const SERVICE_CATALOG = {
  'Online Form Fill-up': [
    'Government Forms',
    'Private Forms',
    'Registration Forms'
  ],
  'Job Application': [
    'Central Govt Jobs',
    'State Govt Jobs',
    'Railway',
    'SSC',
    'Banking',
    'Police',
    'Defence'
  ],
  'Exam Services': [
    'Admit Card',
    'Exam Registration',
    'Result',
    'Answer Key',
    'Counselling'
  ],
  'Education': [
    'Banglar Yuva Siksha Barasa Card',
    'School Admission',
    'College Admission',
    'University Forms',
    'Scholarship',
    'Education Loan',
    'Skill Development & Training',
    'Migration'
  ],
  'PAN Card': [
    'New PAN',
    'Correction',
    'Reprint',
    'e-PAN'
  ],
  'Aadhaar Assistance': [
    'Aadhaar Download',
    'PVC Order Assistance',
    'Update Appointment Assistance'
  ],
  'Voter Card': [
    'New Voter Registration',
    'Correction',
    'Address Change',
    'Download EPIC'
  ],
  'Passport': [
    'New Passport Application',
    'Renewal',
    'Appointment Assistance'
  ],
  'Certificates': [
    'Income',
    'Caste',
    'Residence',
    'Birth',
    'Death',
    'Other Certificates'
  ],
  'Ration Card': [
    'New Application',
    'Correction',
    'Member Add/Delete',
    'Status'
  ],
  'Land Services': [
    'Land Record Search',
    'Record Download',
    'Mutation Application Assistance'
  ],
  'Printing': [
    'Black & White Print',
    'Colour Print',
    'Photo Print'
  ],
  'Xerox': [
    'Black & White Xerox',
    'Colour Xerox',
    'Bulk Xerox'
  ],
  'Scanning': [
    'Document Scan',
    'PDF Scan',
    'Photo Scan'
  ],
  'Photo Editing': [
    'Passport Photo',
    'Stamp Size Photo',
    'Background Removal'
  ],
  'PVC Card': [
    'Aadhaar PVC',
    'PAN PVC',
    'Voter PVC',
    'ID Card',
    'Custom PVC'
  ],
  'PDF Services': [
    'PDF Merge',
    'Split',
    'Compress',
    'Convert',
    'Edit'
  ],
  'Typing': [
    'Bengali',
    'English',
    'Hindi',
    'Application',
    'Letter',
    'Resume'
  ],
  'Computer Services': [
    'Online Data Entry',
    'Email',
    'Document Upload',
    'File Conversion'
  ],
  'Internet Services': [
    'Email Creation',
    'Online Registration',
    'Website Assistance'
  ],
  'Recharge': [
    'Mobile Recharge',
    'DTH Recharge',
    'Data Recharge'
  ],
  'Bill Payment': [
    'Electricity',
    'Water',
    'Gas',
    'Broadband',
    'Mobile Bill'
  ],
  'Travel': [
    'Train',
    'Bus',
    'Flight',
    'Hotel Booking (where authorized)'
  ],
  'Business Services': [
    'GST Application Assistance',
    'Udyam Registration',
    'FSSAI Application'
  ],
  'PNB CSP / Banking': [
    'AEPS Cash Withdrawal / Balance Enquiry',
    'Cash Deposit / Money Transfer (DMT)',
    'PMJDY / New Savings Account Opening',
    'NPCI / DBT Aadhaar Seeding Assistance',
    'Passbook Print & KYC Update',
    'Social Security (PMSBY / PMJJBY / APY)'
  ],
  'Other Services': [
    'Lamination',
    'Binding',
    'Stationery',
    'Photocopy',
    'Printout'
  ]
};

export const SERVICE_CATEGORIES = Object.keys(SERVICE_CATALOG);

const RATE_CHART_STORAGE_KEY = 'mun_service_rate_chart_v1';
let _rateChartInitializer = null;

export function registerRateChartInitializer(fn) {
  if (typeof fn === 'function') {
    _rateChartInitializer = fn;
  }
}

export function emitRateChartUpdated(reason = 'sync') {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('mun-rate-chart-updated', {
      detail: { reason, at: Date.now() }
    }));
  }
}

export function getCustomServiceCatalogData() {
  const raw = getItem(KEYS.CUSTOM_SERVICE_CATALOG, null);
  return {
    customCategories: Array.isArray(raw?.customCategories) ? raw.customCategories : [],
    customSubServices: Array.isArray(raw?.customSubServices) ? raw.customSubServices : [],
    removedCatalogServices: Array.isArray(raw?.removedCatalogServices) ? raw.removedCatalogServices : [],
    customStatuses: Array.isArray(raw?.customStatuses) ? raw.customStatuses : []
  };
}

export function saveCustomServiceCatalogData(data) {
  setItem(KEYS.CUSTOM_SERVICE_CATALOG, {
    customCategories: Array.isArray(data?.customCategories) ? data.customCategories : [],
    customSubServices: Array.isArray(data?.customSubServices) ? data.customSubServices : [],
    removedCatalogServices: Array.isArray(data?.removedCatalogServices) ? data.removedCatalogServices : [],
    customStatuses: Array.isArray(data?.customStatuses) ? data.customStatuses : []
  });
}

function makeCatalogRemovalKey(category, serviceName) {
  return `${String(category || '').trim()}::${String(serviceName || '').trim()}`.toLowerCase();
}

export function getRemovedCatalogServices() {
  return getCustomServiceCatalogData().removedCatalogServices.map(entry => {
    if (typeof entry === 'string') {
      const [category, serviceName] = entry.split('::');
      return { key: entry.toLowerCase(), category: category || 'Other Services', serviceName: serviceName || entry };
    }
    return {
      key: makeCatalogRemovalKey(entry.category, entry.serviceName),
      category: entry.category || 'Other Services',
      serviceName: entry.serviceName || ''
    };
  });
}

export function removeCatalogService(category, serviceName) {
  const cleanCat = String(category || 'Other Services').trim();
  const cleanName = String(serviceName || '').trim();
  if (!cleanName) return { success: false, message: 'Service name is required.' };

  const data = getCustomServiceCatalogData();
  const key = makeCatalogRemovalKey(cleanCat, cleanName);

  // Also remove from customSubServices if it was a custom service
  const prevCustomLen = data.customSubServices.length;
  data.customSubServices = data.customSubServices.filter(
    s => makeCatalogRemovalKey(s.category, s.name) !== key
  );

  // Add to removedCatalogServices if it is a built-in (or prevent reappearing)
  const isBuiltIn = Object.entries(SERVICE_CATALOG).some(
    ([cat, subs]) => cat.toLowerCase() === cleanCat.toLowerCase() && (subs || []).some(sub => sub.toLowerCase() === cleanName.toLowerCase())
  ) || UNIFIED_SERVICE_DIRECTORY.some(
    u => (u.name || '').toLowerCase() === cleanName.toLowerCase() || (u.subcategory || '').toLowerCase() === cleanName.toLowerCase()
  );

  if (isBuiltIn || prevCustomLen === data.customSubServices.length) {
    const alreadyRemoved = data.removedCatalogServices.some(r =>
      (typeof r === 'string' ? r.toLowerCase() : makeCatalogRemovalKey(r.category, r.serviceName)) === key
    );
    if (!alreadyRemoved) {
      data.removedCatalogServices.push({ category: cleanCat, serviceName: cleanName, removedAt: new Date().toISOString() });
    }
  }

  saveCustomServiceCatalogData(data);
  logAuditAction('CATALOG_SERVICE_REMOVED', `Removed service "${cleanName}" (${cleanCat}) from active catalog`);
  emitRateChartUpdated('catalog_remove');
  return { success: true };
}

export function restoreCatalogService(category, serviceName) {
  const data = getCustomServiceCatalogData();
  const key = makeCatalogRemovalKey(category, serviceName);
  data.removedCatalogServices = data.removedCatalogServices.filter(
    r => (typeof r === 'string' ? r.toLowerCase() : makeCatalogRemovalKey(r.category, r.serviceName)) !== key
  );
  saveCustomServiceCatalogData(data);
  logAuditAction('CATALOG_SERVICE_RESTORED', `Restored service "${serviceName}" (${category})`);
  emitRateChartUpdated('catalog_restore');
  return { success: true };
}

export function restoreAllRemovedCatalogServices() {
  const data = getCustomServiceCatalogData();
  const count = data.removedCatalogServices.length;
  data.removedCatalogServices = [];
  saveCustomServiceCatalogData(data);
  if (count > 0) {
    logAuditAction('CATALOG_SERVICE_RESTORED_ALL', `Restored ${count} removed catalog service(s)`);
    emitRateChartUpdated('catalog_restore_all');
  }
  return { success: true, count };
}

export function getBaseServiceCatalog() {
  const custom = getCustomServiceCatalogData();
  const removedKeys = new Set(
    (custom.removedCatalogServices || []).map(r =>
      typeof r === 'string' ? r.toLowerCase() : makeCatalogRemovalKey(r.category, r.serviceName)
    )
  );

  const merged = {};
  Object.entries(SERVICE_CATALOG).forEach(([cat, subs]) => {
    const filteredSubs = (subs || []).filter(sub => !removedKeys.has(makeCatalogRemovalKey(cat, sub)));
    if (filteredSubs.length > 0) {
      merged[cat] = filteredSubs;
    }
  });
  custom.customCategories.forEach(cat => {
    const cleanCat = String(cat || '').trim();
    if (cleanCat && !merged[cleanCat]) {
      merged[cleanCat] = [];
    }
  });
  custom.customSubServices.forEach(entry => {
    const cat = String(entry?.category || '').trim() || 'Other Services';
    const name = String(entry?.name || '').trim();
    if (!name) return;
    if (removedKeys.has(makeCatalogRemovalKey(cat, name))) return;
    if (!merged[cat]) merged[cat] = [];
    if (!merged[cat].some(s => s.toLowerCase() === name.toLowerCase())) {
      merged[cat].push(name);
    }
  });
  return merged;
}

function getLiveRateChartMasterItems(includeInactive = false) {
  let list = getItem(RATE_CHART_STORAGE_KEY, null);
  if (!Array.isArray(list)) {
    if (typeof _rateChartInitializer === 'function') {
      list = _rateChartInitializer();
    }
  }
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter(item => item && item.serviceName && (includeInactive || item.isActive !== false));
}

export function getServiceCatalog() {
  const activeItems = getLiveRateChartMasterItems(false);
  const merged = {};
  activeItems.forEach(item => {
    const cat = String(item.category || '').trim() || 'Other Services';
    const name = String(item.serviceName || '').trim();
    if (!name) return;
    if (!merged[cat]) merged[cat] = [];
    if (!merged[cat].some(s => s.toLowerCase() === name.toLowerCase())) {
      merged[cat].push(name);
    }
  });
  // Preserve any explicitly created empty custom categories
  const custom = getCustomServiceCatalogData();
  (custom.customCategories || []).forEach(cat => {
    const cleanCat = String(cat || '').trim();
    if (cleanCat && !Object.keys(merged).some(k => k.toLowerCase() === cleanCat.toLowerCase())) {
      merged[cleanCat] = [];
    }
  });
  return merged;
}

export function getServiceCategories() {
  return Object.keys(getServiceCatalog());
}

export function getCustomSubServices() {
  return getCustomServiceCatalogData().customSubServices;
}

export async function addCustomServiceEntry({
  category = 'Other Services',
  newCategoryName = '',
  serviceName = '',
  nameBn = '',
  unit = 'Per Application',
  defaultCharge = 0,
  defaultGovFee = 0,
  tags = [],
  subcategory = '',
  remarks = ''
}) {
  const targetCat = String(newCategoryName || category || 'Other Services').trim();
  const cleanName = String(serviceName || '').trim();
  if (!cleanName) {
    return { success: false, message: 'Service name is required.' };
  }
  if (!targetCat) {
    return { success: false, message: 'Category name is required.' };
  }

  const data = getCustomServiceCatalogData();
  const isBaseCat = Object.keys(SERVICE_CATALOG).some(c => c.toLowerCase() === targetCat.toLowerCase());
  const matchedBaseCat = Object.keys(SERVICE_CATALOG).find(c => c.toLowerCase() === targetCat.toLowerCase());
  const resolvedCat = matchedBaseCat || data.customCategories.find(c => c.toLowerCase() === targetCat.toLowerCase()) || targetCat;

  if (!isBaseCat && !data.customCategories.some(c => c.toLowerCase() === resolvedCat.toLowerCase())) {
    data.customCategories.push(resolvedCat);
  }

  const existingIdx = data.customSubServices.findIndex(
    s => s.category.toLowerCase() === resolvedCat.toLowerCase() && s.name.toLowerCase() === cleanName.toLowerCase()
  );

  const normalizedTags = Array.isArray(tags)
    ? tags.map(t => String(t || '').trim()).filter(Boolean)
    : String(tags || '').split(/[,;|]+/).map(t => t.trim()).filter(Boolean);

  const customSrvId = existingIdx !== -1 ? data.customSubServices[existingIdx].id : await allocateGlobalReference('SITEM', { entityType: 'CUSTOM_SERVICE_ITEM' });
  const entryPayload = {
    id: customSrvId,
    category: resolvedCat,
    subcategory: String(subcategory || cleanName).trim(),
    name: cleanName,
    nameBn: String(nameBn || '').trim(),
    unit: unit || 'Per Application',
    defaultCharge: Math.max(0, Number(defaultCharge) || 0),
    defaultGovFee: Math.max(0, Number(defaultGovFee) || 0),
    tags: normalizedTags,
    remarks: String(remarks || '').trim(),
    isCustom: true,
    updatedAt: new Date().toISOString(),
    createdAt: existingIdx !== -1 ? data.customSubServices[existingIdx].createdAt : new Date().toISOString()
  };

  if (existingIdx !== -1) {
    data.customSubServices[existingIdx] = entryPayload;
  } else {
    data.customSubServices.unshift(entryPayload);
  }

  const newKey = makeCatalogRemovalKey(resolvedCat, cleanName);
  data.removedCatalogServices = (data.removedCatalogServices || []).filter(
    r => (typeof r === 'string' ? r.toLowerCase() : makeCatalogRemovalKey(r.category, r.serviceName)) !== newKey
  );

  saveCustomServiceCatalogData(data);
  logAuditAction('CUSTOM_SERVICE_ADD', `Saved custom service "${cleanName}" under category "${resolvedCat}"`);
  emitRateChartUpdated('custom_service_add');
  return { success: true, category: resolvedCat, entry: entryPayload, isNew: existingIdx === -1 };
}

export function deleteCustomServiceEntry(id) {
  const data = getCustomServiceCatalogData();
  const target = data.customSubServices.find(s => s.id === id);
  if (!target) return { success: false, message: 'Custom service not found.' };
  data.customSubServices = data.customSubServices.filter(s => s.id !== id);
  saveCustomServiceCatalogData(data);
  logAuditAction('CUSTOM_SERVICE_DELETE', `Removed custom service "${target.name}" (${target.category})`);
  emitRateChartUpdated('custom_service_delete');
  return { success: true, deleted: target };
}

export function updateCustomServiceEntry(id, updates = {}) {
  const data = getCustomServiceCatalogData();
  const idx = data.customSubServices.findIndex(s => s.id === id);
  if (idx === -1) return { success: false, message: 'Custom service not found.' };

  const current = data.customSubServices[idx];
  const nextCategory = String(updates.category || current.category || 'Other Services').trim();
  const nextName = String(updates.serviceName ?? updates.name ?? current.name ?? '').trim();
  if (!nextName) return { success: false, message: 'Service name is required.' };

  const dup = data.customSubServices.find(
    (s, i) => i !== idx && s.category.toLowerCase() === nextCategory.toLowerCase() && s.name.toLowerCase() === nextName.toLowerCase()
  );
  if (dup) {
    return { success: false, message: `"${nextName}" already exists under "${nextCategory}".` };
  }

  const isBaseCat = Object.keys(SERVICE_CATALOG).some(c => c.toLowerCase() === nextCategory.toLowerCase());
  if (!isBaseCat && !data.customCategories.some(c => c.toLowerCase() === nextCategory.toLowerCase())) {
    data.customCategories.push(nextCategory);
  }

  const updatedEntry = {
    ...current,
    category: nextCategory,
    subcategory: updates.subcategory !== undefined ? String(updates.subcategory || nextName).trim() : (current.subcategory || nextName),
    name: nextName,
    nameBn: updates.nameBn !== undefined ? String(updates.nameBn || '').trim() : (current.nameBn || ''),
    unit: updates.unit || current.unit || 'Per Application',
    defaultCharge: updates.defaultCharge !== undefined ? Math.max(0, Number(updates.defaultCharge) || 0) : (Number(current.defaultCharge) || 0),
    defaultGovFee: updates.defaultGovFee !== undefined ? Math.max(0, Number(updates.defaultGovFee) || 0) : (Number(current.defaultGovFee) || 0),
    tags: updates.tags !== undefined
      ? (Array.isArray(updates.tags) ? updates.tags : String(updates.tags || '').split(/[,;|]+/).map(t => t.trim()).filter(Boolean))
      : (current.tags || []),
    remarks: updates.remarks !== undefined ? String(updates.remarks || '').trim() : (current.remarks || ''),
    updatedAt: new Date().toISOString()
  };

  data.customSubServices[idx] = updatedEntry;
  saveCustomServiceCatalogData(data);
  logAuditAction(
    'CUSTOM_SERVICE_EDIT',
    `Updated custom service "${updatedEntry.name}" (${updatedEntry.category}) rate to Shop ₹${updatedEntry.defaultCharge} / Govt ₹${updatedEntry.defaultGovFee}`
  );
  emitRateChartUpdated('custom_service_edit');
  return { success: true, entry: updatedEntry };
}

export function getSubcategoriesForCategory(category) {
  const catalog = getServiceCatalog();
  if (catalog[category]) return catalog[category];
  const target = String(category || '').trim().toLowerCase();
  const matchedKey = Object.keys(catalog).find(k => k.toLowerCase() === target);
  return matchedKey ? catalog[matchedKey] : [];
}

export const SERVICE_STATUSES = [
  'New',
  'Pending',
  'Document Pending',
  'Processing',
  'Submitted',
  'Verification',
  'Approved',
  'Rejected',
  'Completed',
  'Delivered',
  'Cancelled'
];

export function getCustomServiceStatuses() {
  return getCustomServiceCatalogData().customStatuses;
}

export function getServiceStatusRecords() {
  const custom = getCustomServiceStatuses()
    .map((item) => (typeof item === 'string' ? { id: `CST-${item}`, label: item, isDefault: false } : item))
    .filter((item) => item && item.label && !SERVICE_STATUSES.some((d) => d.toLowerCase() === item.label.toLowerCase()));

  const defaults = SERVICE_STATUSES.map((label) => ({
    id: `DEF-SRV-ST-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    label,
    isDefault: true
  }));

  return [...defaults, ...custom];
}

export function getServiceStatuses(optsOrList = {}) {
  const includeValues = Array.isArray(optsOrList) ? optsOrList : (optsOrList?.includeValues || []);
  const labels = getServiceStatusRecords().map((r) => r.label);
  const seen = new Set(labels.map((l) => l.toLowerCase()));
  (Array.isArray(includeValues) ? includeValues : [includeValues]).forEach((val) => {
    const clean = String(val || '').trim();
    if (clean && !seen.has(clean.toLowerCase())) {
      labels.push(clean);
      seen.add(clean.toLowerCase());
    }
  });
  return labels;
}

export async function addCustomServiceStatus(label) {
  const clean = String(label || '').trim();
  if (!clean) return { success: false, message: 'Status label is required.' };
  const all = getServiceStatusRecords();
  if (all.some((r) => r.label.toLowerCase() === clean.toLowerCase())) {
    return { success: false, message: `Status "${clean}" already exists.` };
  }
  const data = getCustomServiceCatalogData();
  const entry = {
    id: await allocateGlobalReference('SITEM', { entityType: 'CUSTOM_SERVICE_STATUS' }),
    label: clean,
    isDefault: false,
    createdAt: new Date().toISOString()
  };
  data.customStatuses.push(entry);
  saveCustomServiceCatalogData(data);
  logAuditAction('SERVICE_STATUS_ADD', `Added custom service status "${clean}"`);
  return { success: true, entry };
}

export function deleteCustomServiceStatus(idOrLabel) {
  const key = String(idOrLabel || '').trim();
  if (!key) return { success: false, message: 'Status identifier is required.' };
  if (SERVICE_STATUSES.some((s) => s.toLowerCase() === key.toLowerCase() || `def-srv-st-${s.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` === key.toLowerCase())) {
    return { success: false, message: 'Default system statuses cannot be deleted.' };
  }
  const data = getCustomServiceCatalogData();
  const custom = data.customStatuses || [];
  const next = custom.filter((item) => {
    const id = typeof item === 'string' ? `CST-${item}` : item?.id;
    const label = typeof item === 'string' ? item : item?.label;
    return id !== key && String(label || '').toLowerCase() !== key.toLowerCase();
  });
  if (next.length === custom.length) {
    return { success: false, message: 'Custom status not found or protected.' };
  }
  data.customStatuses = next;
  saveCustomServiceCatalogData(data);
  logAuditAction('SERVICE_STATUS_DELETE', `Deleted custom service status "${key}"`);
  return { success: true };
}

export function getServiceCategoryRecords() {
  const customData = getCustomServiceCatalogData();
  const baseKeys = Object.keys(SERVICE_CATALOG);
  const customCats = (customData.customCategories || [])
    .map((c) => String(c || '').trim())
    .filter((c) => c && !baseKeys.some((b) => b.toLowerCase() === c.toLowerCase()));

  return [
    ...baseKeys.map((label) => ({ id: `DEF-CAT-${label}`, label, isDefault: true })),
    ...customCats.map((label) => ({ id: `CUST-CAT-${label}`, label, isDefault: false }))
  ];
}

export function addCustomServiceCategory(categoryName) {
  const clean = String(categoryName || '').trim();
  if (!clean) return { success: false, message: 'Category name is required.' };
  const data = getCustomServiceCatalogData();
  const all = getServiceCategoryRecords();
  if (all.some((c) => c.label.toLowerCase() === clean.toLowerCase())) {
    return { success: false, message: `Category "${clean}" already exists.` };
  }
  data.customCategories.push(clean);
  saveCustomServiceCatalogData(data);
  logAuditAction('SERVICE_CATEGORY_ADD', `Added custom service/product category "${clean}"`);
  emitRateChartUpdated('category_add');
  return { success: true, category: clean };
}

export function deleteCustomServiceCategory(categoryName) {
  const clean = String(categoryName || '').trim().replace(/^CUST-CAT-/, '');
  if (!clean) return { success: false, message: 'Category name is required.' };
  if (Object.keys(SERVICE_CATALOG).some((b) => b.toLowerCase() === clean.toLowerCase())) {
    return { success: false, message: 'Default system categories cannot be deleted.' };
  }
  const data = getCustomServiceCatalogData();
  const prevLen = data.customCategories.length;
  data.customCategories = (data.customCategories || []).filter((c) => String(c || '').trim().toLowerCase() !== clean.toLowerCase());
  if (data.customCategories.length === prevLen) {
    return { success: false, message: 'Custom category not found or protected.' };
  }
  saveCustomServiceCatalogData(data);
  logAuditAction('SERVICE_CATEGORY_DELETE', `Deleted custom category "${clean}"`);
  emitRateChartUpdated('category_delete');
  return { success: true };
}

export function getAllServices() {
  return getItem(KEYS.SERVICES, []);
}

export function getServiceById(id) {
  const services = getAllServices();
  return services.find(s => s.id === id) || null;
}

export function getServicesByReceiptId(receiptId) {
  if (!receiptId) return [];
  return getAllServices()
    .filter(s => (s.receiptId || s.id) === receiptId)
    .sort((a, b) => (Number(a.receiptItemIndex) || 0) - (Number(b.receiptItemIndex) || 0));
}

export function normalizeBillingPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  if (digits.length >= 6) return digits;
  return '';
}

function doesServiceBelongToCustomer(serviceRecord, customerId = '', normPhone = '') {
  if (!serviceRecord) return false;
  const cleanCustId = String(customerId || '').trim();
  const srvCustId = String(serviceRecord.customerId || '').trim();
  if (cleanCustId && srvCustId && cleanCustId === srvCustId) return true;
  if (normPhone) {
    const srvPhone = normalizeBillingPhone(serviceRecord.phone);
    if (srvPhone && srvPhone === normPhone) return true;
  }
  return false;
}

export function getReceiptSummary(receiptId, servicesList = null) {
  if (!receiptId) return null;
  const all = Array.isArray(servicesList) ? servicesList : getAllServices();
  const items = all
    .filter(s => (s.receiptId || s.id) === receiptId)
    .sort((a, b) => (Number(a.receiptItemIndex) || 0) - (Number(b.receiptItemIndex) || 0));
  if (items.length === 0) return null;

  const primary = items[0];
  let totalShop = 0;
  let totalGov = 0;
  let totalOther = 0;
  let grandTotal = 0;
  let totalPaid = 0;
  const statuses = [];

  items.forEach(item => {
    totalShop += Math.max(0, Number(item.serviceCharge) || 0);
    totalGov += Math.max(0, Number(item.govFee) || 0);
    totalOther += Math.max(0, Number(item.otherCharges) || 0);
    grandTotal += Math.max(0, Number(item.totalAmount) || 0);
    totalPaid += Math.max(0, Number(item.paidAmount) || 0);
    if (item.status && !statuses.includes(item.status)) {
      statuses.push(item.status);
    }
  });

  const totalDue = Math.max(0, grandTotal - totalPaid);
  return {
    receiptId,
    itemCount: items.length,
    totalShop,
    totalGov,
    totalOther,
    grandTotal,
    totalPaid,
    totalDue,
    statuses,
    collectiveStatus: statuses.length === 1 ? statuses[0] : (totalDue > 0 ? 'Pending' : (statuses[0] || 'New')),
    appDate: primary.appDate || getTodayDate(),
    customerId: primary.customerId || '',
    customerName: primary.customerName || 'Walk-in Customer',
    phone: primary.phone || '',
    items
  };
}

/**
 * Checks if an active unpaid or open receipt already exists for the same customer on the given date.
 * Anonymous walk-ins without customerId or phone never auto-merge with unrelated walk-in sales.
 */
export function findOpenReceiptForCustomerDate(customerId = '', phone = '', targetDate = '', servicesList = null) {
  const cleanCustId = String(customerId || '').trim();
  const normPhone = normalizeBillingPhone(phone);
  if (!cleanCustId && !normPhone) return null;

  const resolvedDate = String(targetDate || getTodayDate()).trim();
  const all = Array.isArray(servicesList) ? servicesList : getAllServices();

  // Preserve order of appearance (most recent first since new entries are unshifted)
  const groupedOrder = [];
  const groupsMap = new Map();

  all.forEach(srv => {
    const srvDate = String(srv.appDate || '').trim() || getTodayDate();
    if (srvDate !== resolvedDate) return;
    if (!doesServiceBelongToCustomer(srv, cleanCustId, normPhone)) return;

    const rId = srv.receiptId || srv.id;
    if (!rId) return;
    if (!groupsMap.has(rId)) {
      groupsMap.set(rId, []);
      groupedOrder.push(rId);
    }
    groupsMap.get(rId).push(srv);
  });

  for (const rId of groupedOrder) {
    const items = groupsMap.get(rId) || [];
    const activeItems = items.filter(it => !['Cancelled', 'Rejected'].includes(it.status));
    if (activeItems.length === 0) continue;

    const grandTotal = activeItems.reduce((sum, it) => sum + (Math.max(0, Number(it.totalAmount) || 0)), 0);
    const totalPaid = activeItems.reduce((sum, it) => sum + (Math.max(0, Number(it.paidAmount) || 0)), 0);
    const totalDue = Math.max(0, grandTotal - totalPaid);
    const allClosedDelivered = activeItems.every(it => ['Completed', 'Delivered'].includes(it.status));

    // Active if it still has balance due OR any line item is not yet Completed/Delivered
    if (totalDue > 0 || !allClosedDelivered) {
      return getReceiptSummary(rId, all);
    }
  }

  return null;
}

function reindexReceiptItems(servicesList, receiptId) {
  if (!receiptId) return;
  const matching = servicesList
    .filter(s => (s.receiptId || s.id) === receiptId)
    .sort((a, b) => (Number(a.receiptItemIndex) || 0) - (Number(b.receiptItemIndex) || 0));
  const totalCount = matching.length;
  matching.forEach((item, idx) => {
    item.receiptItemIndex = idx + 1;
    item.receiptItemCount = totalCount;
  });
}

export async function saveService(serviceData) {
  const services = getAllServices();
  const charge = Number(serviceData.serviceCharge) || 0;
  const govFee = Number(serviceData.govFee) || 0;
  const other = Number(serviceData.otherCharges) || 0;
  const totalAmount = charge + govFee + other;
  
  const advance = Number(serviceData.advancePayment || serviceData.advance) || 0;
  const paid = serviceData.paidAmount !== undefined ? Number(serviceData.paidAmount) : advance;
  const due = Math.max(0, totalAmount - paid);

  if (serviceData.id) {
    const index = services.findIndex(s => s.id === serviceData.id);
    if (index !== -1) {
      const resolvedReceiptId = serviceData.receiptId || services[index].receiptId || await allocateGlobalReference('RCPT', { entityType: 'RECEIPT' });
      services[index] = {
        ...services[index],
        ...serviceData,
        receiptId: resolvedReceiptId,
        shopName: 'MUN COMPUTER',
        serviceCharge: charge,
        govFee,
        otherCharges: other,
        totalAmount,
        advancePayment: advance,
        advance,
        paidAmount: paid,
        dueAmount: due,
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.SERVICES, services);
      logAuditAction('SERVICE_UPDATE', `Updated MUN COMPUTER service record: ${services[index].serviceName} (${services[index].id})`);
      return { success: true, service: services[index] };
    }
  }

  const resolvedAppDate = serviceData.appDate || getTodayDate();
  const openExisting = !serviceData.disableAutoMerge
    ? findOpenReceiptForCustomerDate(serviceData.customerId || '', serviceData.phone || '', resolvedAppDate, services)
    : null;

  const targetReceiptId = openExisting ? openExisting.receiptId : (serviceData.receiptId || await allocateGlobalReference('RCPT', { entityType: 'RECEIPT' }));
  const nextIndex = openExisting ? openExisting.itemCount + 1 : (Number(serviceData.receiptItemIndex) || 1);
  const nextCount = openExisting ? openExisting.itemCount + 1 : (Number(serviceData.receiptItemCount) || 1);
  const serviceId = await allocateGlobalReference('SRV', { entityType: 'SERVICE' });

  const newService = {
    id: serviceId,
    receiptId: targetReceiptId,
    receiptItemIndex: nextIndex,
    receiptItemCount: nextCount,
    paymentMode: serviceData.paymentMode || 'Cash',
    shopName: 'MUN COMPUTER',
    customerId: serviceData.customerId || openExisting?.customerId || '',
    customerName: serviceData.customerName || openExisting?.customerName || '',
    phone: serviceData.phone || openExisting?.phone || '',
    businessUnitId: serviceData.businessUnitId || 'mun-computer',
    category: serviceData.category || 'Online Form Fill-up',
    subcategory: serviceData.subcategory || '',
    serviceName: serviceData.serviceName || serviceData.subcategory || 'General Application',
    refNumber: serviceData.refNumber || serviceId,
    appDate: resolvedAppDate,
    deliveryDate: serviceData.deliveryDate || resolvedAppDate,
    serviceCharge: charge,
    govFee,
    otherCharges: other,
    totalAmount,
    advancePayment: advance,
    advance,
    paidAmount: paid,
    dueAmount: due,
    assignedStaff: serviceData.assignedStaff || getItem(KEYS.CURRENT_USER, null)?.uid || 'MC-ADM-14012025',
    requiredDocs: serviceData.requiredDocs || '',
    documentStatus: serviceData.documentStatus || (serviceData.docsReceived ? 'Received' : 'Pending'),
    docsReceived: !!serviceData.docsReceived,
    status: serviceData.status || 'New',
    remarks: serviceData.remarks || '',
    attachment: serviceData.attachment || '',
    createdAt: new Date().toISOString()
  };

  services.unshift(newService);
  if (openExisting) {
    reindexReceiptItems(services, targetReceiptId);
  }
  setItem(KEYS.SERVICES, services);
  const summary = getReceiptSummary(targetReceiptId, services);
  logAuditAction(
    openExisting ? 'SERVICE_RECEIPT_MERGE' : 'SERVICE_CREATE',
    openExisting
      ? `Merged service "${newService.serviceName}" into open Receipt ${targetReceiptId} for ${newService.customerName} · Consolidated Total ₹${summary?.grandTotal || totalAmount}`
      : `Registered service: ${newService.serviceName} for ${newService.customerName} at MUN COMPUTER (${newService.id})`
  );
  return {
    success: true,
    service: newService,
    merged: !!openExisting,
    existingReceiptId: openExisting ? openExisting.receiptId : '',
    receiptId: targetReceiptId,
    receiptSummary: summary
  };
}

export async function saveServiceBatch({
  customerId = '',
  customerName = '',
  phone = '',
  businessUnitId = 'mun-computer',
  receiptId = '',
  appDate = '',
  paymentMode = 'Cash',
  collectiveStatus = '',
  totalAdvancePaid = 0,
  disableAutoMerge = false,
  items = []
}) {
  const validItems = Array.isArray(items) ? items.filter(it => it && (it.serviceName || it.subcategory || it.category)) : [];
  if (validItems.length === 0) {
    return { success: false, message: 'At least one service item is required.' };
  }

  const services = getAllServices();
  const today = appDate || getTodayDate();
  const openExisting = !disableAutoMerge
    ? findOpenReceiptForCustomerDate(customerId, phone, today, services)
    : null;

  const sharedReceiptId = openExisting ? openExisting.receiptId : (receiptId || await allocateGlobalReference('RCPT', { entityType: 'RECEIPT' }));
  const existingCount = openExisting ? openExisting.itemCount : 0;
  const finalItemCount = existingCount + validItems.length;
  const resolvedCustomerId = customerId || openExisting?.customerId || '';
  const resolvedCustomerName = customerName || openExisting?.customerName || 'Walk-in Customer';
  const resolvedPhone = phone || openExisting?.phone || '';

  const currentUid = getItem(KEYS.CURRENT_USER, null)?.uid || 'MC-ADM-14012025';
  const nowIso = new Date().toISOString();
  const resolvedCollectiveStatus = String(collectiveStatus || '').trim();

  let remainingNewPaid = Math.max(0, Number(totalAdvancePaid) || 0);
  let newItemsTotal = 0;
  let newItemsPaid = 0;
  const createdServices = [];

  // Process new items cleanly, appending index after any existing items on open receipt
  for (let idx = 0; idx < validItems.length; idx++) {
    const item = validItems[idx];
    const charge = Math.max(0, Number(item.serviceCharge) || 0);
    const govFee = Math.max(0, Number(item.govFee) || 0);
    const other = Math.max(0, Number(item.otherCharges) || 0);
    const itemTotal = charge + govFee + other;
    const itemPaid = Math.min(itemTotal, remainingNewPaid);
    remainingNewPaid = Math.max(0, remainingNewPaid - itemPaid);
    const itemDue = Math.max(0, itemTotal - itemPaid);

    newItemsTotal += itemTotal;
    newItemsPaid += itemPaid;

    const svcName = String(item.serviceName || item.subcategory || 'General Application').trim();
    const serviceId = await allocateGlobalReference('SRV', { entityType: 'SERVICE' });
    const record = {
      id: serviceId,
      receiptId: sharedReceiptId,
      receiptItemIndex: existingCount + idx + 1,
      receiptItemCount: finalItemCount,
      paymentMode: paymentMode || 'Cash',
      shopName: 'MUN COMPUTER',
      customerId: resolvedCustomerId,
      customerName: resolvedCustomerName,
      phone: resolvedPhone,
      businessUnitId: businessUnitId || 'mun-computer',
      category: item.category || 'Online Form Fill-up',
      subcategory: item.subcategory || svcName,
      serviceName: svcName,
      tags: Array.isArray(item.tags) ? item.tags : (item.tags ? String(item.tags).split(/[,;|]+/).map(t => t.trim()).filter(Boolean) : []),
      refNumber: String(item.refNumber || '').trim() || serviceId,
      appDate: item.appDate || today,
      deliveryDate: item.deliveryDate || today,
      serviceCharge: charge,
      govFee,
      otherCharges: other,
      totalAmount: itemTotal,
      advancePayment: itemPaid,
      advance: itemPaid,
      paidAmount: itemPaid,
      dueAmount: itemDue,
      assignedStaff: item.assignedStaff || currentUid,
      requiredDocs: item.requiredDocs || '',
      documentStatus: item.documentStatus || (item.docsReceived ? 'Received' : 'Pending'),
      docsReceived: !!item.docsReceived,
      status: item.status || resolvedCollectiveStatus || 'New',
      remarks: item.remarks || '',
      attachment: item.attachment || '',
      createdAt: nowIso
    };
    createdServices.push(record);
  }

  // If merging and newly collected payment exceeds new items' cost, settle prior unpaid items in the same receipt
  if (openExisting && remainingNewPaid > 0) {
    const existingRows = services
      .filter(s => (s.receiptId || s.id) === sharedReceiptId)
      .sort((a, b) => (Number(a.receiptItemIndex) || 0) - (Number(b.receiptItemIndex) || 0));
    existingRows.forEach(row => {
      if (remainingNewPaid <= 0) return;
      const curDue = Math.max(0, (Number(row.totalAmount) || 0) - (Number(row.paidAmount) || 0));
      if (curDue > 0) {
        const applied = Math.min(curDue, remainingNewPaid);
        remainingNewPaid = Math.max(0, remainingNewPaid - applied);
        row.paidAmount = (Number(row.paidAmount) || 0) + applied;
        row.advancePayment = (Number(row.advancePayment) || 0) + applied;
        row.advance = row.advancePayment;
        row.dueAmount = Math.max(0, (Number(row.totalAmount) || 0) - row.paidAmount);
        row.updatedAt = nowIso;
      }
    });
  }

  for (let i = createdServices.length - 1; i >= 0; i--) {
    services.unshift(createdServices[i]);
  }
  reindexReceiptItems(services, sharedReceiptId);
  setItem(KEYS.SERVICES, services);

  const summary = getReceiptSummary(sharedReceiptId, services);
  const grandTotal = summary ? summary.grandTotal : newItemsTotal;
  const totalPaid = summary ? summary.totalPaid : newItemsPaid;
  const totalDue = summary ? summary.totalDue : Math.max(0, newItemsTotal - newItemsPaid);

  const namesSummary = createdServices.map(s => s.serviceName).join(', ');
  logAuditAction(
    openExisting ? 'SERVICE_RECEIPT_MERGE' : (validItems.length > 1 ? 'SERVICE_BATCH_CREATE' : 'SERVICE_CREATE'),
    openExisting
      ? `Appended ${validItems.length} service(s) (${namesSummary}) into existing Receipt ${sharedReceiptId} for ${resolvedCustomerName} · Consolidated Total ₹${grandTotal} · Paid ₹${totalPaid} · Due ₹${totalDue}`
      : `Registered ${validItems.length} service(s) under Receipt ${sharedReceiptId} (${resolvedCollectiveStatus || 'New'}) for ${resolvedCustomerName} (${namesSummary}) · Total ₹${grandTotal}`
  );

  return {
    success: true,
    merged: !!openExisting,
    existingReceiptId: openExisting ? openExisting.receiptId : '',
    previousGrandTotal: openExisting ? openExisting.grandTotal : 0,
    previousPaid: openExisting ? openExisting.totalPaid : 0,
    previousDue: openExisting ? openExisting.totalDue : 0,
    previousItemCount: openExisting ? openExisting.itemCount : 0,
    receiptId: sharedReceiptId,
    services: createdServices,
    allReceiptServices: summary ? summary.items : createdServices,
    newItemsTotal,
    grandTotal,
    totalPaid,
    totalDue
  };
}

export function updateServiceStatus(id, newStatus, remarks = '') {
  const services = getAllServices();
  const index = services.findIndex(s => s.id === id);
  if (index !== -1) {
    const oldStatus = services[index].status;
    services[index].status = newStatus;
    if (remarks) {
      services[index].remarks = `${services[index].remarks ? services[index].remarks + ' | ' : ''}${newStatus}: ${remarks}`;
    }
    services[index].updatedAt = new Date().toISOString();
    setItem(KEYS.SERVICES, services);
    logAuditAction('SERVICE_STATUS_CHANGE', `Changed status from ${oldStatus} to ${newStatus} on ${services[index].id}`);
    return { success: true, service: services[index] };
  }
  return { success: false, message: 'Service not found' };
}

export function deleteService(id) {
  const services = getAllServices();
  const target = services.find(s => s.id === id);
  if (!target) return { success: false, message: 'Service not found' };

  const updated = services.filter(s => s.id !== id);
  if (target.receiptId) {
    reindexReceiptItems(updated, target.receiptId);
  }
  setItem(KEYS.SERVICES, updated);
  markGlobalReferenceDeleted(id, 'DELETED');
  logAuditAction('SERVICE_DELETE', `Deleted service record: ${target.serviceName} (${target.id})`);
  return { success: true };
}

export function deleteMultipleServices(ids = []) {
  const idSet = new Set((ids || []).map(String));
  if (idSet.size === 0) return { success: false, count: 0 };
  const services = getAllServices();
  const touchedReceipts = new Set(
    services.filter(s => idSet.has(s.id) && s.receiptId).map(s => s.receiptId)
  );
  const removedIds = services.filter(s => idSet.has(s.id)).map(s => s.id);
  const updated = services.filter(s => !idSet.has(s.id));
  const deletedCount = services.length - updated.length;
  touchedReceipts.forEach(rId => reindexReceiptItems(updated, rId));
  setItem(KEYS.SERVICES, updated);
  removedIds.forEach(rId => markGlobalReferenceDeleted(rId, 'DELETED'));
  if (deletedCount > 0) {
    logAuditAction('SERVICE_BULK_DELETE', `Bulk deleted ${deletedCount} service record(s)`);
  }
  return { success: true, count: deletedCount };
}

/* =========================================================================
   AUTOMATED SERVICE SELECTION & AUTO-MAPPING DIRECTORY
   Eliminates manual category searching and prevents duplicate entries.
   Automatically maps Category, Subcategory, Fees and Master Register.
   ========================================================================= */

export const UNIFIED_SERVICE_DIRECTORY = [
  // --- 1. West Bengal Government Schemes (20) ---
  {
    name: 'Annapurna Yojana',
    nameBn: 'অন্নপূর্ণা যোজনা',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-annapurna',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Lakshmir Bhandar',
    nameBn: 'লক্ষ্মীর ভাণ্ডার',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Kanyashree Prakalpa',
    nameBn: 'কন্যাশ্রী প্রকল্প',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Rupashree Prakalpa',
    nameBn: 'রূপশ্রী প্রকল্প',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 60,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Swasthya Sathi',
    nameBn: 'স্বাস্থ্য সাথী',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Krishak Bandhu',
    nameBn: 'কৃষক বন্ধু',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 60,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Bangla Shasya Bima',
    nameBn: 'বাংলা শস্য বীমা',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Manabik Pension Scheme',
    nameBn: 'মানবিক পেনশন প্রকল্প',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Jai Johar',
    nameBn: 'জয় জোহার',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Taposili Bandhu',
    nameBn: 'তফসিলী বন্ধু',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Yuvashree',
    nameBn: 'যুবশ্রী',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 60,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Banglar Yuva Siksha Barasa Card',
    nameBn: 'বাংলার যুব শিক্ষা ভরসা কার্ড',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Banglar Yuva Siksha Barasa Card',
    subcategory: 'Student Welfare Schemes',
    tags: ['Banglar Yuva Siksha Barasa Card', 'Student Welfare Schemes', 'Youth Welfare Schemes', 'Education'],
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'yuva-siksha-barasa',
    masterRegisterTarget: 'Banglar Yuva Siksha Barasa Card Management',
    masterRegisterSync: true
  },
  {
    name: 'Aikyashree Scholarship',
    nameBn: 'ঐক্যশ্রী স্কলারশিপ',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Education',
    subcategory: 'Scholarship',
    defaultCharge: 70,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Swami Vivekananda Scholarship',
    nameBn: 'স্বামী বিবেকানন্দ স্কলারশিপ (SVMCM)',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Education',
    subcategory: 'Scholarship',
    defaultCharge: 80,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Sikshashree',
    nameBn: 'শিক্ষাশ্রী',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Education',
    subcategory: 'Scholarship',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Medhashree',
    nameBn: 'মেধাশ্রী',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Education',
    subcategory: 'Scholarship',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'West Bengal Student Credit Card',
    nameBn: 'স্টুডেন্ট ক্রেডিট কার্ড',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Education',
    subcategory: 'University Forms',
    defaultCharge: 100,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Banglar Awas Yojana',
    nameBn: 'বাংলার আবাস যোজনা',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Khadya Sathi',
    nameBn: 'খাদ্য সাথী',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Ration Card',
    subcategory: 'Status',
    defaultCharge: 30,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Bina Mulya Samajik Suraksha Yojana',
    nameBn: 'বিনা মূল্যে সামাজিক সুরক্ষা যোজনা (BM-SSY)',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 60,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },
  {
    name: 'Other State Welfare Schemes',
    nameBn: 'অন্যান্য রাজ্য সরকারি প্রকল্প',
    group: 'West Bengal Government Schemes (রাজ্য সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'State Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (State Division)',
    masterRegisterSync: true
  },

  // --- 2. Central Government Schemes (22) ---
  {
    name: 'PM-KISAN',
    nameBn: 'পিএম কিষাণ সম্মান নিধি',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'Ayushman Bharat – PM-JAY',
    nameBn: 'আয়ুষ্মান ভারত – পিএম-জেএওয়াই',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'ABHA',
    nameBn: 'আভা কার্ড (ABHA Health Card)',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'PVC Card',
    subcategory: 'ID Card',
    defaultCharge: 40,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'PMAY – Gramin',
    nameBn: 'পিএমএওয়াই – গ্রামীণ',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'PMAY – Urban',
    nameBn: 'পিএমএওয়াই – আরবান',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 60,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'PM Ujjwala Yojana',
    nameBn: 'প্রধানমন্ত্রী উজ্জ্বলা যোজনা',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'PM Surya Ghar',
    nameBn: 'প্রধানমন্ত্রী সূর্য ঘর মুফত বিজলী যোজনা',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 80,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'PM Fasal Bima Yojana',
    nameBn: 'প্রধানমন্ত্রী ফসল বীমা যোজনা',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'PM Jan Dhan Yojana',
    nameBn: 'প্রধানমন্ত্রী জন ধন যোজনা',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 40,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'PMJJBY',
    nameBn: 'প্রধানমন্ত্রী জীবন জ্যোতি বীমা যোজনা',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 40,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'PMSBY',
    nameBn: 'প্রধানমন্ত্রী সুরক্ষা বীমা যোজনা',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 30,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'Atal Pension Yojana',
    nameBn: 'অটল পেনশন যোজনা (APY)',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'PM Shram Yogi Maandhan',
    nameBn: 'পিএম শ্রম যোগী মানধন (PM-SYM)',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'PM SVANidhi',
    nameBn: 'পিএম স্বনিধি (PM SVANidhi)',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Business Services',
    subcategory: 'Government Forms',
    defaultCharge: 80,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'PM Vishwakarma',
    nameBn: 'পিএম বিশ্বকর্মা যোজনা',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 70,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'PM Mudra Yojana',
    nameBn: 'প্রধানমন্ত্রী মুদ্রা যোজনা (PMMY)',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Business Services',
    subcategory: 'Government Forms',
    defaultCharge: 120,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'PMEGP',
    nameBn: 'পিএমইজিপি (PMEGP)',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Business Services',
    subcategory: 'Government Forms',
    defaultCharge: 150,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'e-Shram',
    nameBn: 'ই-শ্রম কার্ড (e-Shram)',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'PVC Card',
    subcategory: 'ID Card',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'National Scholarship Portal',
    nameBn: 'ন্যাশনাল স্কলারশিপ পোর্টাল (NSP)',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Education',
    subcategory: 'Scholarship',
    defaultCharge: 80,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'Sukanya Samriddhi Yojana',
    nameBn: 'সুকন্যা সমৃদ্ধি যোজনা (SSY)',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'National Social Assistance Programme',
    nameBn: 'জাতীয় সামাজিক সহায়তা প্রকল্প (NSAP)',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },
  {
    name: 'Other Central Welfare Schemes',
    nameBn: 'অন্যান্য কেন্দ্রীয় সরকারি প্রকল্প',
    group: 'Central Government Schemes (কেন্দ্রীয় সরকারি প্রকল্প)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: true,
    isGrievance: false,
    govtLevel: 'Central Government',
    targetModule: 'govt-applications',
    masterRegisterTarget: 'Govt Welfare Cases (Central Division)',
    masterRegisterSync: true
  },

  // --- 3. Public Grievances & Complaint Channels (10) ---
  {
    name: 'CMO Grievance Redressal',
    nameBn: 'মুখ্যমন্ত্রীর দপ্তর গণঅভিযোগ (CMO Portal)',
    group: 'Public Grievance & Complaints (গণঅভিযোগ প্রতিকার)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 60,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: true,
    govtLevel: 'State Government',
    targetModule: 'govt-grievances',
    masterRegisterTarget: 'Public Grievance Master Register',
    masterRegisterSync: true
  },
  {
    name: 'CPGRAMS Central Grievance',
    nameBn: 'সিপিগ্রামস কেন্দ্রীয় গণঅভিযোগ (CPGRAMS)',
    group: 'Public Grievance & Complaints (গণঅভিযোগ প্রতিকার)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 60,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: true,
    govtLevel: 'Central Government',
    targetModule: 'govt-grievances',
    masterRegisterTarget: 'Public Grievance Master Register',
    masterRegisterSync: true
  },
  {
    name: 'District Magistrate (DM) Grievance',
    nameBn: 'জেলাশাসক অভিযোগ (DM Grievance)',
    group: 'Public Grievance & Complaints (গণঅভিযোগ প্রতিকার)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: true,
    govtLevel: 'State Government',
    targetModule: 'govt-grievances',
    masterRegisterTarget: 'Public Grievance Master Register',
    masterRegisterSync: true
  },
  {
    name: 'Sub-Divisional Officer (SDO) Grievance',
    nameBn: 'মহকুমা শাসক অভিযোগ (SDO Grievance)',
    group: 'Public Grievance & Complaints (গণঅভিযোগ প্রতিকার)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: true,
    govtLevel: 'State Government',
    targetModule: 'govt-grievances',
    masterRegisterTarget: 'Public Grievance Master Register',
    masterRegisterSync: true
  },
  {
    name: 'Block Development Officer (BDO) Grievance',
    nameBn: 'বিডিও অফিস অভিযোগ (BDO Grievance)',
    group: 'Public Grievance & Complaints (গণঅভিযোগ প্রতিকার)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: true,
    govtLevel: 'State Government',
    targetModule: 'govt-grievances',
    masterRegisterTarget: 'Public Grievance Master Register',
    masterRegisterSync: true
  },
  {
    name: 'MLA / Public Representative Complaint',
    nameBn: 'বিধায়ক অভিযোগ (MLA Complaint)',
    group: 'Public Grievance & Complaints (গণঅভিযোগ প্রতিকার)',
    category: 'Online Form Fill-up',
    subcategory: 'Government Forms',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: true,
    govtLevel: 'State Government',
    targetModule: 'govt-grievances',
    masterRegisterTarget: 'Public Grievance Master Register',
    masterRegisterSync: true
  },
  {
    name: 'Food & Supplies Ration Complaint',
    nameBn: 'খাদ্য ও সরবরাহ রেশনের অভিযোগ',
    group: 'Public Grievance & Complaints (গণঅভিযোগ প্রতিকার)',
    category: 'Ration Card',
    subcategory: 'Status',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: true,
    govtLevel: 'State Government',
    targetModule: 'govt-grievances',
    masterRegisterTarget: 'Public Grievance Master Register',
    masterRegisterSync: true
  },
  {
    name: 'WBSEDCL Electricity Grievance',
    nameBn: 'বিদ্যুৎ দপ্তর অভিযোগ (WBSEDCL)',
    group: 'Public Grievance & Complaints (গণঅভিযোগ প্রতিকার)',
    category: 'Bill Payment',
    subcategory: 'Electricity',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: true,
    govtLevel: 'State Government',
    targetModule: 'govt-grievances',
    masterRegisterTarget: 'Public Grievance Master Register',
    masterRegisterSync: true
  },

  // --- 4. PAN Card Services ---
  {
    name: 'New PAN Card Application',
    nameBn: 'নতুন প্যান কার্ড আবেদন (New PAN)',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'PAN Card',
    subcategory: 'New PAN',
    defaultCharge: 107,
    defaultGovFee: 107,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'PAN Card Correction / Update',
    nameBn: 'প্যান কার্ড সংশোধন (Correction)',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'PAN Card',
    subcategory: 'Correction',
    defaultCharge: 107,
    defaultGovFee: 107,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'e-PAN Card Download',
    nameBn: 'ই-প্যান ডাউনলোড (e-PAN)',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'PAN Card',
    subcategory: 'e-PAN',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'PAN Card Reprint / Duplicate',
    nameBn: 'প্যান কার্ড পুনর্মুদ্রণ (Reprint)',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'PAN Card',
    subcategory: 'Reprint',
    defaultCharge: 50,
    defaultGovFee: 50,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },

  // --- 5. Aadhaar Assistance & PVC ---
  {
    name: 'Aadhaar Card Download & Print',
    nameBn: 'আধার কার্ড ডাউনলোড ও প্রিন্ট',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'Aadhaar Assistance',
    subcategory: 'Aadhaar Download',
    defaultCharge: 30,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Aadhaar PVC Smart Card Order',
    nameBn: 'আধার পিভিসি স্মার্ট কার্ড অর্ডার',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'PVC Card',
    subcategory: 'Aadhaar PVC',
    defaultCharge: 50,
    defaultGovFee: 50,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Aadhaar Update Appointment Assistance',
    nameBn: 'আধার আপডেট অ্যাপয়েন্টমেন্ট বুকিং',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'Aadhaar Assistance',
    subcategory: 'Update Appointment Assistance',
    defaultCharge: 50,
    defaultGovFee: 50,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },

  // --- 6. Voter & Passport ---
  {
    name: 'New Voter Registration (Form 6)',
    nameBn: 'নতুন ভোটার কার্ড আবেদন (Form 6)',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'Voter Card',
    subcategory: 'New Voter Registration',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Voter Card Correction (Form 8)',
    nameBn: 'ভোটার কার্ড সংশোধন (Form 8)',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'Voter Card',
    subcategory: 'Correction',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Voter Card EPIC Download',
    nameBn: 'ভোটার কার্ড ই-এপিক ডাউনলোড',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'Voter Card',
    subcategory: 'Download EPIC',
    defaultCharge: 30,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'New Passport Application',
    nameBn: 'নতুন পাসপোর্ট আবেদন',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'Passport',
    subcategory: 'New Passport Application',
    defaultCharge: 300,
    defaultGovFee: 1500,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Passport Renewal / Re-issue',
    nameBn: 'পাসপোর্ট নবীকরণ (Renewal)',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'Passport',
    subcategory: 'Renewal',
    defaultCharge: 300,
    defaultGovFee: 1500,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },

  // --- 7. Ration Card & Public Distribution ---
  {
    name: 'Ration Card - New Application',
    nameBn: 'নতুন রেশন কার্ড আবেদন (Form 3/4)',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'Ration Card',
    subcategory: 'New Application',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Ration Card - Member Add / Delete',
    nameBn: 'রেশন কার্ডে নাম যোগ বা বিয়োগ',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'Ration Card',
    subcategory: 'Member Add/Delete',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Ration Card - Status & Aadhaar Seeding',
    nameBn: 'রেশন কার্ড স্ট্যাটাস ও আধার লিঙ্কিং',
    group: 'Identity Cards & Documents (পরিচয়পত্র ও নথিপত্র)',
    category: 'Ration Card',
    subcategory: 'Status',
    defaultCharge: 30,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },

  // --- 8. Certificates & Land Services ---
  {
    name: 'Income Certificate (e-District / SDO)',
    nameBn: 'ইনকাম সার্টিফিকেট আবেদন',
    group: 'Certificates & Land Services (সার্টিফিকেট ও জমি সংক্রান্ত)',
    category: 'Certificates',
    subcategory: 'Income',
    defaultCharge: 70,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Caste Certificate (SC / ST / OBC)',
    nameBn: 'জাতিগত শংসাপত্র (SC/ST/OBC Certificate)',
    group: 'Certificates & Land Services (সার্টিফিকেট ও জমি সংক্রান্ত)',
    category: 'Certificates',
    subcategory: 'Caste',
    defaultCharge: 80,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Residential / Domicile Certificate',
    nameBn: 'বাসিন্দা শংসাপত্র (Domicile Certificate)',
    group: 'Certificates & Land Services (সার্টিফিকেট ও জমি সংক্রান্ত)',
    category: 'Certificates',
    subcategory: 'Residence',
    defaultCharge: 60,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Birth Certificate Application',
    nameBn: 'জন্ম শংসাপত্র আবেদন',
    group: 'Certificates & Land Services (সার্টিফিকেট ও জমি সংক্রান্ত)',
    category: 'Certificates',
    subcategory: 'Birth',
    defaultCharge: 70,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Death Certificate Application',
    nameBn: 'মৃত্যু শংসাপত্র আবেদন',
    group: 'Certificates & Land Services (সার্টিফিকেট ও জমি সংক্রান্ত)',
    category: 'Certificates',
    subcategory: 'Death',
    defaultCharge: 70,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Land Record (Khatian / RoR / Parcha) Search',
    nameBn: 'জমির খতিয়ান ও দাগের তথ্য সন্ধান',
    group: 'Certificates & Land Services (সার্টিফিকেট ও জমি সংক্রান্ত)',
    category: 'Land Services',
    subcategory: 'Land Record Search',
    defaultCharge: 50,
    defaultGovFee: 20,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Land Record (Porcha) Download & Print',
    nameBn: 'খতিয়ান পর্চা সার্টিফায়েড ডাউনলোড',
    group: 'Certificates & Land Services (সার্টিফিকেট ও জমি সংক্রান্ত)',
    category: 'Land Services',
    subcategory: 'Record Download',
    defaultCharge: 40,
    defaultGovFee: 20,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Land Mutation Application Assistance',
    nameBn: 'জমির মিউটেশন আবেদন সহযোগিতা',
    group: 'Certificates & Land Services (সার্টিফিকেট ও জমি সংক্রান্ত)',
    category: 'Land Services',
    subcategory: 'Mutation Application Assistance',
    defaultCharge: 200,
    defaultGovFee: 50,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },

  // --- 9. Jobs, Exams & Education ---
  {
    name: 'Central Govt Job Online Application',
    nameBn: 'কেন্দ্রীয় সরকারি চাকরির আবেদন',
    group: 'Job Applications & Exam Services (চাকরি ও পরীক্ষা)',
    category: 'Job Application',
    subcategory: 'Central Govt Jobs',
    defaultCharge: 100,
    defaultGovFee: 100,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'State Govt Job Application (WBPSC / WBP)',
    nameBn: 'রাজ্য সরকারি চাকরির আবেদন (পুলিশ / পিএসসি)',
    group: 'Job Applications & Exam Services (চাকরি ও পরীক্ষা)',
    category: 'Job Application',
    subcategory: 'State Govt Jobs',
    defaultCharge: 100,
    defaultGovFee: 100,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Railway Recruitment Application (RRB / RRC)',
    nameBn: 'রেলওয়ে চাকরির ফর্ম ফিলাপ',
    group: 'Job Applications & Exam Services (চাকরি ও পরীক্ষা)',
    category: 'Job Application',
    subcategory: 'Railway',
    defaultCharge: 100,
    defaultGovFee: 500,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'SSC Application (CGL / CHSL / MTS / GD)',
    nameBn: 'এসএসসি পরীক্ষার অনলাইন আবেদন',
    group: 'Job Applications & Exam Services (চাকরি ও পরীক্ষা)',
    category: 'Job Application',
    subcategory: 'SSC',
    defaultCharge: 100,
    defaultGovFee: 100,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Exam Admit Card Download & Print',
    nameBn: 'এডমিট কার্ড ডাউনলোড ও প্রিন্ট',
    group: 'Job Applications & Exam Services (চাকরি ও পরীক্ষা)',
    category: 'Exam Services',
    subcategory: 'Admit Card',
    defaultCharge: 30,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Exam Result & Rank Card Printout',
    nameBn: 'পরীক্ষার রেজাল্ট ও র‍্যাঙ্ক কার্ড প্রিন্ট',
    group: 'Job Applications & Exam Services (চাকরি ও পরীক্ষা)',
    category: 'Exam Services',
    subcategory: 'Result',
    defaultCharge: 20,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'School / College Admission Form',
    nameBn: 'স্কুল ও কলেজ ভর্তি ফর্ম পূরণ',
    group: 'Job Applications & Exam Services (চাকরি ও পরীক্ষা)',
    category: 'Education',
    subcategory: 'College Admission',
    defaultCharge: 80,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },

  // --- 10. Printing, Xerox, Photo & Media ---
  {
    name: 'Black & White Printout',
    nameBn: 'সাদা-কালো প্রিন্ট',
    group: 'Counter Printing & Digital Services (প্রিন্টিং ও জেরক্স)',
    category: 'Printing',
    subcategory: 'Black & White Print',
    defaultCharge: 5,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Colour Printout',
    nameBn: 'রঙিন প্রিন্ট',
    group: 'Counter Printing & Digital Services (প্রিন্টিং ও জেরক্স)',
    category: 'Printing',
    subcategory: 'Colour Print',
    defaultCharge: 15,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Black & White Xerox',
    nameBn: 'সাদা-কালো জেরক্স',
    group: 'Counter Printing & Digital Services (প্রিন্টিং ও জেরক্স)',
    category: 'Xerox',
    subcategory: 'Black & White Xerox',
    defaultCharge: 3,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Colour Xerox',
    nameBn: 'রঙিন জেরক্স',
    group: 'Counter Printing & Digital Services (প্রিন্টিং ও জেরক্স)',
    category: 'Xerox',
    subcategory: 'Colour Xerox',
    defaultCharge: 10,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Document Scanning (PDF Conversion)',
    nameBn: 'ডকুমেন্ট স্ক্যানিং (PDF)',
    group: 'Counter Printing & Digital Services (প্রিন্টিং ও জেরক্স)',
    category: 'Scanning',
    subcategory: 'PDF Scan',
    defaultCharge: 20,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Passport Size Photo (8 Copies)',
    nameBn: 'পাসপোর্ট সাইজ ছবি (৮ কপি)',
    group: 'Counter Printing & Digital Services (প্রিন্টিং ও জেরক্স)',
    category: 'Photo Editing',
    subcategory: 'Passport Photo',
    defaultCharge: 40,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Custom PVC Smart Card Print',
    nameBn: 'কাস্টম পিভিসি স্মার্ট কার্ড প্রিন্ট',
    group: 'Counter Printing & Digital Services (প্রিন্টিং ও জেরক্স)',
    category: 'PVC Card',
    subcategory: 'Custom PVC',
    defaultCharge: 60,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Bengali / English Application Typing',
    nameBn: 'বাংলা / ইংরেজি দরখাস্ত টাইপিং',
    group: 'Counter Printing & Digital Services (প্রিন্টিং ও জেরক্স)',
    category: 'Typing',
    subcategory: 'Bengali',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Lamination (A4 / ID Card)',
    nameBn: 'লেমিনেশন (A4 / আইডি কার্ড)',
    group: 'Counter Printing & Digital Services (প্রিন্টিং ও জেরক্স)',
    category: 'Other Services',
    subcategory: 'Lamination',
    defaultCharge: 20,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Spiral Binding',
    nameBn: 'স্পাইরাল বাইন্ডিং',
    group: 'Counter Printing & Digital Services (প্রিন্টিং ও জেরক্স)',
    category: 'Other Services',
    subcategory: 'Binding',
    defaultCharge: 30,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },

  // --- 11. Utilities, Banking & Business ---
  {
    name: 'Electricity Bill Payment (WBSEDCL)',
    nameBn: 'বিদ্যুৎ বিল পেমেন্ট',
    group: 'Recharge, Bill Payment & Business (বিল ও ব্যবসা)',
    category: 'Bill Payment',
    subcategory: 'Electricity',
    defaultCharge: 15,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Mobile / DTH Recharge',
    nameBn: 'মোবাইল / ডিটিএইচ রিচার্জ',
    group: 'Recharge, Bill Payment & Business (বিল ও ব্যবসা)',
    category: 'Recharge',
    subcategory: 'Mobile Recharge',
    defaultCharge: 10,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Udyam MSME Business Registration',
    nameBn: 'উদ্যম এমএসএমই সার্টিফিকেট',
    group: 'Recharge, Bill Payment & Business (বিল ও ব্যবসা)',
    category: 'Business Services',
    subcategory: 'Udyam Registration',
    defaultCharge: 150,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'GST Registration Assistance',
    nameBn: 'জিএসটি রেজিস্ট্রেশন সহায়তা',
    group: 'Recharge, Bill Payment & Business (বিল ও ব্যবসা)',
    category: 'Business Services',
    subcategory: 'GST Application Assistance',
    defaultCharge: 500,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  },
  {
    name: 'Train / Bus Ticket Booking',
    nameBn: 'ট্রেন বা বাস টিকিট বুকিং',
    group: 'Recharge, Bill Payment & Business (বিল ও ব্যবসা)',
    category: 'Travel',
    subcategory: 'Train',
    defaultCharge: 50,
    defaultGovFee: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false
  }
];

/**
 * Base seed unified service list (for initial Rate Chart seeding & reset)
 */
export function getBaseUnifiedServiceList() {
  const removedKeys = new Set(
    (getCustomServiceCatalogData().removedCatalogServices || []).map(r =>
      typeof r === 'string' ? r.toLowerCase() : makeCatalogRemovalKey(r.category, r.serviceName)
    )
  );
  const customEntries = getCustomSubServices().map(cs => ({
    name: cs.name,
    nameBn: cs.nameBn || '',
    group: 'Custom Services (কাস্টম সার্ভিস)',
    category: cs.category,
    subcategory: cs.name,
    defaultCharge: Number(cs.defaultCharge) || 0,
    defaultGovFee: Number(cs.defaultGovFee) || 0,
    unit: cs.unit || 'Per Application',
    remarks: cs.remarks || '',
    isGovtScheme: false,
    isGrievance: false,
    isCustom: true,
    customId: cs.id,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry (Custom)',
    masterRegisterSync: false
  }));
  return [...customEntries, ...UNIFIED_SERVICE_DIRECTORY].filter(s => {
    const k1 = makeCatalogRemovalKey(s.category, s.name);
    const k2 = makeCatalogRemovalKey(s.category, s.subcategory);
    return !removedKeys.has(k1) && !removedKeys.has(k2);
  });
}

function findUnifiedMetadata(category, serviceName) {
  const catLower = String(category || '').trim().toLowerCase();
  const nameLower = String(serviceName || '').trim().toLowerCase();
  if (!nameLower) return null;
  return (
    UNIFIED_SERVICE_DIRECTORY.find(u => u.category.toLowerCase() === catLower && u.name.toLowerCase() === nameLower) ||
    UNIFIED_SERVICE_DIRECTORY.find(u => u.category.toLowerCase() === catLower && u.subcategory.toLowerCase() === nameLower) ||
    UNIFIED_SERVICE_DIRECTORY.find(u => u.name.toLowerCase() === nameLower) ||
    UNIFIED_SERVICE_DIRECTORY.find(u => u.subcategory.toLowerCase() === nameLower) ||
    null
  );
}

/**
 * Get all active services directly from the live Service Rate Chart master (Single Source of Truth)
 */
export function getUnifiedServiceList() {
  const activeItems = getLiveRateChartMasterItems(false);
  const customList = getCustomSubServices();
  const customMap = new Map(customList.map(cs => [makeCatalogRemovalKey(cs.category, cs.name), cs]));

  return activeItems.map(item => {
    const meta = findUnifiedMetadata(item.category, item.serviceName);
    const customMatch = customMap.get(makeCatalogRemovalKey(item.category, item.serviceName));
    const defaultCharge = Math.max(0, Number(item.serviceCharge) || 0);
    const defaultGovFee = Math.max(0, Number(item.govFee) || 0);
    const isCustom = Boolean(item.isCustom || customMatch);

    return {
      rateId: item.id,
      name: item.serviceName,
      nameBn: item.nameBn || meta?.nameBn || '',
      group: meta?.group || (isCustom ? 'Custom Services (কাস্টম সার্ভিস)' : `${item.category || 'Other Services'} (Rate Chart)`),
      category: item.category || 'Other Services',
      subcategory: meta?.subcategory || item.serviceName,
      defaultCharge,
      defaultGovFee,
      totalRate: defaultCharge + defaultGovFee,
      unit: item.unit || customMatch?.unit || 'Per Application',
      remarks: item.remarks || customMatch?.remarks || '',
      isGovtScheme: Boolean(meta?.isGovtScheme),
      isGrievance: Boolean(meta?.isGrievance),
      govtLevel: meta?.govtLevel || '',
      isCustom,
      customId: customMatch?.id || '',
      targetModule: meta?.targetModule || 'services',
      masterRegisterTarget: meta?.masterRegisterTarget || (isCustom ? 'Service Registry (Custom)' : 'Service Registry'),
      masterRegisterSync: Boolean(meta?.masterRegisterSync)
    };
  });
}

/**
 * Auto-maps a given service name to its live Rate Chart entry, Category, Subcategory, Fees and Master Register.
 */
export function autoMapService(serviceName, preferredCategory = '', preferredRateId = '') {
  if (!serviceName && !preferredRateId) return null;
  const target = String(serviceName || '').trim().toLowerCase();
  const prefCat = String(preferredCategory || '').trim().toLowerCase();
  const prefId = String(preferredRateId || '').trim();
  const unifiedList = getUnifiedServiceList();

  let found = null;
  if (prefId) {
    found = unifiedList.find(s => s.rateId === prefId) || null;
  }
  if (!found && prefCat && target) {
    found = unifiedList.find(s =>
      s.category.toLowerCase() === prefCat &&
      (s.name.toLowerCase() === target || s.subcategory.toLowerCase() === target)
    ) || null;
  }
  if (!found && target) {
    found =
      unifiedList.find(s => s.name.toLowerCase() === target) ||
      unifiedList.find(s => s.subcategory.toLowerCase() === target) ||
      unifiedList.find(s => s.nameBn && s.nameBn.toLowerCase() === target) ||
      unifiedList.find(s =>
        s.name.toLowerCase().includes(target) ||
        (s.nameBn && s.nameBn.toLowerCase().includes(target))
      ) ||
      null;
  }

  if (found) {
    return {
      ...found,
      matched: true,
      badgeText: `✓ Auto-Mapped: Category: "${found.category}" ➔ Subcategory: "${found.subcategory}" ➔ Master Register: "${found.masterRegisterTarget}"`
    };
  }

  // Fallback if not found in active Rate Chart: map to Online Form Fill-up (or preferredCategory)
  return {
    rateId: '',
    name: serviceName,
    nameBn: '',
    group: 'Custom Services',
    category: preferredCategory || 'Online Form Fill-up',
    subcategory: serviceName || 'General Service',
    defaultCharge: 0,
    defaultGovFee: 0,
    totalRate: 0,
    isGovtScheme: false,
    isGrievance: false,
    targetModule: 'services',
    masterRegisterTarget: 'Service Registry',
    masterRegisterSync: false,
    matched: false,
    badgeText: `✓ General Service Registered: Category: "${preferredCategory || 'Online Form Fill-up'}"`
  };
}

/**
 * Checks for duplicate service entry for a customer to prevent double booking.
 * Checks both the active Services list and the Govt Master Register.
 */
export function checkDuplicateServiceEntry(customerId, serviceName, excludeServiceId = null) {
  if (!customerId || !serviceName) {
    return { isDuplicate: false, message: '' };
  }

  const srvTarget = String(serviceName).trim().toLowerCase();

  // 1. Check existing active services
  const allServices = getAllServices();
  const existingService = allServices.find(s => {
    if (excludeServiceId && s.id === excludeServiceId) return false;
    if (s.customerId !== customerId) return false;
    const sameName = (s.serviceName && s.serviceName.toLowerCase() === srvTarget) ||
                     (s.subcategory && s.subcategory.toLowerCase() === srvTarget);
    const isActive = !['Completed', 'Delivered', 'Cancelled'].includes(s.status);
    return sameName && isActive;
  });

  if (existingService) {
    return {
      isDuplicate: true,
      type: 'SERVICE_ACTIVE',
      existingRecord: existingService,
      message: `⚠️ Active service already exists for this customer: "${existingService.serviceName}" (${existingService.id}) with status "${existingService.status}".`
    };
  }

  // 2. Check Govt Master Register (KEYS.GOVT_CASES)
  try {
    const govtCases = getItem(KEYS.GOVT_CASES, []);
    const existingCase = govtCases.find(c => {
      const isCustMatch = (c.customerId && c.customerId === customerId) ||
                          (c.mobileNumber && existingService?.phone && c.mobileNumber === existingService.phone);
      if (!isCustMatch) return false;
      const sameScheme = (c.schemeName && c.schemeName.toLowerCase() === srvTarget);
      const isActive = !['Closed', 'Resolved', 'Rejected'].includes(c.currentStatus);
      return sameScheme && isActive;
    });

    if (existingCase) {
      return {
        isDuplicate: true,
        type: 'GOVT_CASE_ACTIVE',
        existingRecord: existingCase,
        message: `⚠️ Active Master Register case already exists: "${existingCase.schemeName}" (${existingCase.caseId}) with status "${existingCase.currentStatus}".`
      };
    }
  } catch (err) {
    console.error('Duplicate check error in govt cases:', err);
  }

  return { isDuplicate: false, message: '' };
}
