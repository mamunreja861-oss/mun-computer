/**
 * annapurnaCaseEngine.js
 * Complete Customer Service Visit History & Annapurna Yojana Case, Problem, Claim & Follow-up Engine
 * MUN COMPUTER BUSINESS MANAGER
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import {
  KEYS,
  getItem,
  setItem,
  allocateGlobalReference,
  markGlobalReferenceDeleted,
  formatDate,
  formatDateTime,
  getTodayDate,
  logAuditAction,
  getAuthHeaders
} from './storage.js';
import { getCurrentUser } from './auth.js';
import { getAllCustomers, getCustomerById } from './customers.js';
import { showA4PrintPdfPopup } from './a4PrintPopup.js';
import {
  renderBwDocumentHeader,
  renderAcknowledgementSection,
  drawBwPdfHeader,
  getBwAutoTableStyles,
  finalizeBwPdfPagination
} from './documentEngine.js';
import { resolveWardForApp, formatWardLabel } from './wardVillageMaster.js';
import { exportUniversalCSV, exportUniversalExcel, exportUniversalPDF, printUniversalReport } from './exportUtility.js';

/* =========================================================================
   1. MASTER DEFINITIONS (EXACT SPECIFICATION)
   ========================================================================= */

export const STANDARD_CUSTOMER_SERVICES = [
  'CSC Services',
  'PNB CSP',
  'Indian Gas Booking',
  'Gas Delivery',
  'Ayushman Bharat',
  'Aadhaar Services',
  'PAN Card',
  'Voter Card',
  'Ration Card',
  'Government Forms',
  'WB Government Services',
  'Online Application',
  'Money Transfer',
  'Bill Payment',
  'Insurance',
  'Railway Booking',
  'Passport Services',
  'Other Services'
];

export const PROBLEM_CATEGORIES_MASTER = [
  {
    key: 'A',
    name: 'A. Aadhaar / e-KYC Related',
    shortName: 'Aadhaar / e-KYC',
    items: [
      'Aadhaar Related Issue',
      'Aadhaar e-KYC Issue',
      'Aadhaar Verification Pending',
      'Aadhaar Authentication Failed',
      'Aadhaar Details Mismatch',
      'Aadhaar Seeding Pending',
      'Aadhaar OTP Problem',
      'Aadhaar Not Verified'
    ]
  },
  {
    key: 'B',
    name: 'B. NPCI / Bank DBT Related',
    shortName: 'NPCI / Bank DBT',
    items: [
      'NPCI Mapping Pending',
      'NPCI Mapping Failed',
      'NPCI Aadhaar Seeding Pending',
      'Aadhaar Not Seeded with Bank Account',
      'NPCI Mapper Inactive',
      'NPCI Mapper Status Failed',
      'Bank Account Not Linked with Aadhaar',
      'DBT Not Enabled',
      'DBT Payment Failure',
      'Aadhaar Linked to Another Bank',
      'Multiple Bank Account Mapping Issue',
      'Bank Account NPCI Rejected',
      'NPCI Server Error',
      'Bank Account Verification Pending',
      'NPCI Status Not Updated',
      'Other NPCI Problem'
    ]
  },
  {
    key: 'C',
    name: 'C. Housing Condition Related',
    shortName: 'Housing Condition',
    items: [
      'Housing Condition Issue',
      'More Than 3 Rooms',
      'For Further Verification – Housing Condition: More Than 3 Rooms',
      'Under Process – Housing Condition: More Than 3 Rooms',
      'Housing Condition Verification Pending',
      'Housing Condition Mismatch',
      '3 Pucca Rooms in Urban Area',
      'More Than 3 Rooms in Urban Area',
      'More Than 3 Rooms in Rural Area'
    ]
  },
  {
    key: 'D',
    name: 'D. Application Verification Status',
    shortName: 'App Verification',
    items: [
      'For Further Verification',
      'Under Process',
      'Under Enquiry',
      'Application Hold',
      'Hold Up Application',
      'Approval Pending',
      'Revert Application',
      'Pending for Verification',
      'Pending for Approval',
      'Pending at Department',
      'Field Verification Pending',
      'Document Verification Pending',
      'RTI File'
    ]
  },
  {
    key: 'E',
    name: 'E. Government Service & Income Related',
    shortName: 'Govt Service / Income',
    items: [
      'Government Service Issue',
      'Government Service (Self Declared)',
      'Government Service Verification Pending',
      'Government Employee Details Mismatch',
      'Government Service Information Incorrect',
      'Income Tax Issue'
    ]
  },
  {
    key: 'F',
    name: 'F. Data Entry / Application Error',
    shortName: 'Data Entry Error',
    items: [
      'Name Correction',
      'Application Date Issue',
      'Data Entry Mistake',
      'Incorrect Information Entered',
      'Malicious Input',
      'Name Mismatch',
      'Date of Birth Mismatch',
      'Family Details Mismatch',
      'Wrong Category Selected',
      'Duplicate Application',
      'Document Mismatch',
      'Application Details Incorrect',
      'Application Not Found',
      'Application Returned'
    ]
  },
  {
    key: 'G',
    name: 'G. Bank / Payment Related',
    shortName: 'Bank / Payment',
    items: [
      'Bank Account Issue',
      'Bank Account Problem',
      'Bank Account Verification Pending',
      'Account Number Mismatch',
      'IFSC Code Mismatch',
      'Payment Not Received',
      'Payment Stopped',
      'Payment Pending',
      'Payment Processing',
      'Payment Failed',
      'Payment Released'
    ]
  },
  {
    key: 'H',
    name: 'H. Other Customer Problems',
    shortName: 'Other Customer Problems',
    items: [
      'Mobile Number Issue',
      'OTP Not Received',
      'Ration Card Details Problem',
      'Voter ID Details Problem',
      'Income Certificate Problem',
      'Residence Verification Problem',
      'Document Upload Problem',
      'Other Problems',
      'Other Customer Problem'
    ]
  },
  {
    key: 'I',
    name: 'I. Final Application Status',
    shortName: 'Final Status',
    items: [
      'Approved',
      'Sanctioned',
      'Rejected',
      'Cancelled',
      'Not Eligible',
      'Beneficiary Selected',
      'Discontinued',
      'Closed'
    ]
  }
];

export const DEFAULT_APP_STATUSES = [
  'Submitted',
  'Under Process',
  'For Further Verification',
  'Under Enquiry',
  'Hold Up',
  'Application Hold',
  'Approval Pending',
  'Revert Application',
  'Pending at Department',
  'Field Verification Pending',
  'Document Verification Pending',
  'Approved',
  'Payment Started',
  'Payment Stopped',
  'Sanctioned',
  'Beneficiary Selected',
  'Rejected',
  'Cancelled',
  'Not Eligible',
  'Discontinued',
  'Resolved',
  'Closed'
];

export const DEFAULT_COMPLAINT_TYPES = [
  'Annapurna Yojana Claim',
  'CMO Complaint',
  'BDO Complaint',
  'SDO Complaint',
  'DM Complaint',
  'Janakalyan Camp Submission',
  'RTI File',
  'RTI Application',
  'RTI First Appeal',
  'Payment Restart Request',
  'Name Correction Request',
  'Document Verification Request',
  'CPGRAMS Complaint',
  'MLA Complaint',
  'Other Department Complaint'
];

export const COMPLAINT_STATUSES = [
  'Submitted',
  'Pending',
  'Under Review',
  'Under Enquiry',
  'Action Initiated',
  'Awaiting Department Reply',
  'Resolved',
  'Closed',
  'Rejected'
];

export const PROBLEM_RESOLUTION_STATUSES = [
  'Open / Pending',
  'Under Verification',
  'Action Taken',
  'Resolved'
];

export const DEFAULT_OFFICE_MASTERS = [
  'BDO Domkal',
  'SDO Domkal',
  'DM Office Murshidabad',
  'Janakalyan Camp',
  'CMO Grievance Cell',
  'Gram Panchayat Office'
];

export const DEFAULT_DOCUMENT_MASTERS = [
  'Aadhaar Card',
  'Voter ID / EPIC',
  'Ration Card',
  'Bank Passbook',
  'Income Certificate',
  'Housing Condition Photo / Report',
  'RTI Application Copy'
];

export const DEFAULT_RTI_CATEGORIES = [
  'RTI File',
  'RTI Application',
  'RTI First Appeal',
  'RTI Second Appeal'
];

export const DEFAULT_FOLLOWUP_TYPES = [
  'Phone Call',
  'Customer Callback',
  'Office Visit',
  'Janakalyan Camp',
  'Portal Status Check',
  'RTI Reply Check'
];

export const DEFAULT_CUSTOM_REMARKS = [
  'Documents verified and uploaded at counter',
  'Pending at BDO office for field verification',
  'Waiting for RTI reply from department',
  'Customer requested callback after portal update'
];

/* =========================================================================
   2. DYNAMIC CONFIGURATION & CUSTOM MASTERS
   ========================================================================= */

export function getAnnapurnaConfig() {
  const raw = getItem(KEYS.ANNAPURNA_CONFIG, {});
  return {
    extraSchemes: Array.isArray(raw?.extraSchemes) ? raw.extraSchemes : [],
    extraProblemCategories: Array.isArray(raw?.extraProblemCategories) ? raw.extraProblemCategories : [],
    extraStatuses: Array.isArray(raw?.extraStatuses) ? raw.extraStatuses : [],
    extraComplaintTypes: Array.isArray(raw?.extraComplaintTypes) ? raw.extraComplaintTypes : [],
    officeMasters: Array.isArray(raw?.officeMasters) ? raw.officeMasters : [...DEFAULT_OFFICE_MASTERS],
    documentMasters: Array.isArray(raw?.documentMasters) ? raw.documentMasters : [...DEFAULT_DOCUMENT_MASTERS],
    rtiCategories: Array.isArray(raw?.rtiCategories) ? raw.rtiCategories : [...DEFAULT_RTI_CATEGORIES],
    followupTypes: Array.isArray(raw?.followupTypes) ? raw.followupTypes : [...DEFAULT_FOLLOWUP_TYPES],
    customRemarks: Array.isArray(raw?.customRemarks) ? raw.customRemarks : [...DEFAULT_CUSTOM_REMARKS],
    inactiveItems: (raw?.inactiveItems && typeof raw.inactiveItems === 'object') ? raw.inactiveItems : {},
    standardProblemOverrides: (raw?.standardProblemOverrides && typeof raw.standardProblemOverrides === 'object') ? raw.standardProblemOverrides : {},
    deletedStandardProblems: Array.isArray(raw?.deletedStandardProblems) ? raw.deletedStandardProblems : []
  };
}

export function saveAnnapurnaConfig(cfg) {
  setItem(KEYS.ANNAPURNA_CONFIG, cfg);
}

export function addConfigItem(field, value) {
  const clean = (value || '').trim();
  if (!clean) return { success: false, message: 'Value cannot be empty' };
  const cfg = getAnnapurnaConfig();
  cfg[field] = Array.isArray(cfg[field]) ? cfg[field] : [];
  if (cfg[field].some(v => v.toLowerCase() === clean.toLowerCase())) {
    return { success: false, message: `"${clean}" already exists.` };
  }
  cfg[field].push(clean);
  saveAnnapurnaConfig(cfg);
  logAuditAction('ANNAPURNA_CONFIG_UPDATE', `Added "${clean}" to ${field}`);
  return { success: true, config: cfg };
}

export function renameConfigItem(field, oldVal, newVal) {
  const cleanNew = (newVal || '').trim();
  if (!cleanNew) return { success: false, message: 'New value cannot be empty' };
  const cfg = getAnnapurnaConfig();
  if (!Array.isArray(cfg[field])) return { success: false, message: 'Invalid field' };
  const idx = cfg[field].findIndex(v => v === oldVal);
  if (idx === -1) return { success: false, message: 'Entry not found' };
  if (cfg[field].some((v, i) => i !== idx && v.toLowerCase() === cleanNew.toLowerCase())) {
    return { success: false, message: `"${cleanNew}" already exists.` };
  }
  cfg[field][idx] = cleanNew;
  const oldKey = `${field}::${oldVal}`;
  if (cfg.inactiveItems[oldKey]) {
    delete cfg.inactiveItems[oldKey];
    cfg.inactiveItems[`${field}::${cleanNew}`] = true;
  }
  saveAnnapurnaConfig(cfg);
  logAuditAction('ANNAPURNA_CONFIG_RENAME', `Renamed "${oldVal}" to "${cleanNew}" in ${field}`);
  return { success: true, config: cfg };
}

export function toggleConfigItemActive(field, value) {
  const cfg = getAnnapurnaConfig();
  const key = `${field}::${value}`;
  if (cfg.inactiveItems[key]) {
    delete cfg.inactiveItems[key];
  } else {
    cfg.inactiveItems[key] = true;
  }
  saveAnnapurnaConfig(cfg);
  return { success: true, active: !cfg.inactiveItems[key] };
}

export function isConfigItemActive(field, value) {
  const cfg = getAnnapurnaConfig();
  return !cfg.inactiveItems[`${field}::${value}`];
}

export function getActiveConfigItems(field) {
  const cfg = getAnnapurnaConfig();
  const list = Array.isArray(cfg[field]) ? cfg[field] : [];
  return list.filter(v => !cfg.inactiveItems[`${field}::${v}`]);
}

export function deleteConfigItem(field, value) {
  const cfg = getAnnapurnaConfig();
  if (!Array.isArray(cfg[field])) return;
  cfg[field] = cfg[field].filter(v => v !== value);
  if (cfg.inactiveItems) delete cfg.inactiveItems[`${field}::${value}`];
  saveAnnapurnaConfig(cfg);
  logAuditAction('ANNAPURNA_CONFIG_DELETE', `Deleted "${value}" from ${field}`);
}

export function getAllCustomerServicesList() {
  const custom = getItem(KEYS.CUSTOM_SERVICES, []);
  const combined = [...STANDARD_CUSTOMER_SERVICES];
  custom.forEach(s => {
    if (s && !combined.some(x => x.toLowerCase() === s.toLowerCase())) {
      combined.push(s);
    }
  });
  return combined;
}

export function getSavedCustomServices() {
  return getItem(KEYS.CUSTOM_SERVICES, []);
}

export function addCustomCustomerService(serviceName) {
  const clean = (serviceName || '').trim();
  if (!clean) return { success: false, message: 'Service name is required' };
  const custom = getSavedCustomServices();
  const exists = [...STANDARD_CUSTOMER_SERVICES, ...custom].some(
    s => s.toLowerCase() === clean.toLowerCase()
  );
  if (exists) return { success: false, message: `"${clean}" is already in the service list.` };
  custom.push(clean);
  setItem(KEYS.CUSTOM_SERVICES, custom);
  logAuditAction('CUSTOM_SERVICE_ADD', `Added reusable custom customer service: ${clean}`);
  return { success: true, service: clean };
}

export function deleteCustomCustomerService(serviceName) {
  const custom = getSavedCustomServices().filter(s => s !== serviceName);
  setItem(KEYS.CUSTOM_SERVICES, custom);
}

export function getCustomProblems() {
  return getItem(KEYS.CUSTOM_PROBLEMS, []);
}

export async function saveCustomProblem({ id, title, categoryKey, categoryName, description, remarks }) {
  const cleanTitle = (title || '').trim();
  if (!cleanTitle) return { success: false, message: 'Problem title is required' };

  const targetCatKey = categoryKey || 'H';
  const resolvedCatName = categoryName || PROBLEM_CATEGORIES_MASTER.find(c => c.key === targetCatKey)?.name || 'H. Other Customer Problems';
  const list = getCustomProblems();

  if (id) {
    const idx = list.findIndex(p => p.id === id);
    if (idx !== -1) {
      const catObj = getAllProblemCategoriesWithCustom().find(c => c.key === targetCatKey);
      const duplicate = (catObj?.items || []).some(
        item => item.toLowerCase() === cleanTitle.toLowerCase() && item.toLowerCase() !== String(list[idx].title || '').toLowerCase()
      );
      if (duplicate) {
        return { success: false, message: `"${cleanTitle}" already exists in this category.` };
      }
      list[idx] = {
        ...list[idx],
        title: cleanTitle,
        categoryKey: targetCatKey,
        categoryName: resolvedCatName,
        description: description || '',
        remarks: remarks || '',
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.CUSTOM_PROBLEMS, list);
      logAuditAction('CUSTOM_PROBLEM_UPDATE', `Updated custom problem: ${cleanTitle}`);
      return { success: true, problem: list[idx] };
    }
  }

  const catObj = getAllProblemCategoriesWithCustom().find(c => c.key === targetCatKey);
  if ((catObj?.items || []).some(item => item.toLowerCase() === cleanTitle.toLowerCase())) {
    return { success: false, message: `"${cleanTitle}" already exists in ${resolvedCatName}.` };
  }

  const probId = await allocateGlobalReference('PRB', { entityType: 'CUSTOM_PROBLEM' });
  const item = {
    id: probId,
    title: cleanTitle,
    categoryKey: targetCatKey,
    categoryName: resolvedCatName,
    description: description || '',
    remarks: remarks || '',
    createdAt: new Date().toISOString()
  };
  list.push(item);
  setItem(KEYS.CUSTOM_PROBLEMS, list);
  logAuditAction('CUSTOM_PROBLEM_CREATE', `Saved custom problem to master: ${cleanTitle}`);
  return { success: true, problem: item };
}

/**
 * Safely delete a Custom Problem from master WITHOUT touching or corrupting saved historical applications
 */
export function deleteCustomProblemFromMaster(problemId) {
  const list = getCustomProblems();
  const target = list.find(p => p.id === problemId);
  if (!target) return { success: false };
  setItem(KEYS.CUSTOM_PROBLEMS, list.filter(p => p.id !== problemId));
  markGlobalReferenceDeleted(problemId).catch(() => {});
  logAuditAction('CUSTOM_PROBLEM_DELETE', `Removed "${target.title}" from master (old historical applications preserved)`);
  return { success: true };
}

export function getCustomStatuses() {
  return getItem(KEYS.CUSTOM_STATUSES, []);
}

export async function addCustomStatus(label) {
  const clean = (label || '').trim();
  if (!clean) return { success: false, message: 'Status label is required' };
  const existing = getAllAppStatuses();
  if (existing.some(s => s.toLowerCase() === clean.toLowerCase())) {
    return { success: false, message: `Status "${clean}" already exists.` };
  }
  const list = getCustomStatuses();
  const statusId = await allocateGlobalReference('AUDST', { entityType: 'CUSTOM_APP_STATUS' });
  list.push({ id: statusId, label: clean, createdAt: new Date().toISOString() });
  setItem(KEYS.CUSTOM_STATUSES, list);
  logAuditAction('CUSTOM_STATUS_ADD', `Added custom application status: ${clean}`);
  return { success: true };
}

export function deleteCustomStatus(label) {
  const list = getCustomStatuses().filter(s => s.label !== label);
  setItem(KEYS.CUSTOM_STATUSES, list);
}

export function getAllAppStatuses() {
  const custom = getCustomStatuses().map(s => s.label);
  const cfg = getAnnapurnaConfig();
  const extra = Array.isArray(cfg.extraStatuses) ? cfg.extraStatuses : [];
  return Array.from(new Set([...DEFAULT_APP_STATUSES, ...custom, ...extra])).filter(st => isConfigItemActive('appStatuses', st));
}

export function getAllComplaintTypes() {
  const cfg = getAnnapurnaConfig();
  const extra = Array.isArray(cfg.extraComplaintTypes) ? cfg.extraComplaintTypes : [];
  const rti = Array.isArray(cfg.rtiCategories) ? cfg.rtiCategories : [];
  return Array.from(new Set([...DEFAULT_COMPLAINT_TYPES, ...rti, ...extra])).filter(ct => isConfigItemActive('complaintTypes', ct));
}

function resolveStandardProblemOriginalKey(categoryKey, currentTitle, cfg) {
  const stdCat = PROBLEM_CATEGORIES_MASTER.find(c => c.key === categoryKey);
  if (!stdCat) return null;
  const overrides = cfg?.standardProblemOverrides || {};
  const lowTarget = String(currentTitle || '').trim().toLowerCase();

  for (const orig of stdCat.items) {
    const k = `${categoryKey}::${orig}`;
    const effective = (overrides[k] || orig).trim().toLowerCase();
    if (effective === lowTarget) return k;
  }
  return null;
}

/**
 * Edit / Rename either a Custom Problem or a Standard Problem directly from Master/Form
 * Safely preserves all existing saved historical applications.
 */
export function updateProblemMasterItem({ categoryKey, oldTitle, newTitle, isCustom = false, customId = '' }) {
  const cleanNew = String(newTitle || '').trim();
  const cleanOld = String(oldTitle || '').trim();
  const catKey = categoryKey || 'H';
  if (!cleanNew) return { success: false, message: 'Problem title cannot be empty.' };

  const customList = getCustomProblems();
  const matchedCustom = customId
    ? customList.find(p => p.id === customId)
    : customList.find(p => p.categoryKey === catKey && String(p.title || '').trim().toLowerCase() === cleanOld.toLowerCase());

  const currentCats = getAllProblemCategoriesWithCustom();
  const targetCat = currentCats.find(c => c.key === catKey);
  const duplicateExists = (targetCat?.items || []).some(
    t => t.toLowerCase() === cleanNew.toLowerCase() && t.toLowerCase() !== cleanOld.toLowerCase()
  );
  if (duplicateExists) {
    return { success: false, message: `"${cleanNew}" already exists in ${targetCat?.name || catKey}.` };
  }

  if (isCustom || matchedCustom) {
    if (!matchedCustom) return { success: false, message: 'Custom problem entry not found.' };
    matchedCustom.title = cleanNew;
    matchedCustom.updatedAt = new Date().toISOString();
    setItem(KEYS.CUSTOM_PROBLEMS, customList);
    logAuditAction('PROBLEM_MASTER_EDIT', `Renamed custom problem [${catKey}] "${cleanOld}" -> "${cleanNew}"`);
    return { success: true, newTitle: cleanNew, isCustom: true };
  }

  const cfg = getAnnapurnaConfig();
  const origKey = resolveStandardProblemOriginalKey(catKey, cleanOld, cfg);
  if (!origKey) {
    return { success: false, message: 'Standard problem entry not found.' };
  }

  const origTitle = origKey.slice(`${catKey}::`.length);
  if (cleanNew === origTitle) {
    delete cfg.standardProblemOverrides[origKey];
  } else {
    cfg.standardProblemOverrides[origKey] = cleanNew;
  }
  saveAnnapurnaConfig(cfg);
  logAuditAction('PROBLEM_MASTER_EDIT', `Renamed standard problem [${catKey}] "${cleanOld}" -> "${cleanNew}"`);
  return { success: true, newTitle: cleanNew, isCustom: false };
}

/**
 * Delete / Remove either a Custom Problem or a Standard Problem from the Form/Master
 * Never touches or corrupts historical applications.
 */
export function deleteProblemMasterItem({ categoryKey, title, isCustom = false, customId = '' }) {
  const cleanTitle = String(title || '').trim();
  const catKey = categoryKey || 'H';

  const customList = getCustomProblems();
  const matchedCustom = customId
    ? customList.find(p => p.id === customId)
    : customList.find(p => p.categoryKey === catKey && String(p.title || '').trim().toLowerCase() === cleanTitle.toLowerCase());

  if (isCustom || matchedCustom) {
    if (!matchedCustom) return { success: false, message: 'Custom problem entry not found.' };
    setItem(KEYS.CUSTOM_PROBLEMS, customList.filter(p => p.id !== matchedCustom.id));
    logAuditAction('PROBLEM_MASTER_DELETE', `Removed custom problem [${catKey}] "${matchedCustom.title}" from master`);
    return { success: true };
  }

  const cfg = getAnnapurnaConfig();
  const origKey = resolveStandardProblemOriginalKey(catKey, cleanTitle, cfg);
  if (!origKey) {
    return { success: false, message: 'Problem entry not found.' };
  }
  if (!cfg.deletedStandardProblems.includes(origKey)) {
    cfg.deletedStandardProblems.push(origKey);
  }
  delete cfg.standardProblemOverrides[origKey];
  saveAnnapurnaConfig(cfg);
  logAuditAction('PROBLEM_MASTER_DELETE', `Removed standard problem [${catKey}] "${cleanTitle}" from master (historical records preserved)`);
  return { success: true };
}

export function restoreDeletedStandardProblems() {
  const cfg = getAnnapurnaConfig();
  cfg.deletedStandardProblems = [];
  cfg.standardProblemOverrides = {};
  saveAnnapurnaConfig(cfg);
  logAuditAction('PROBLEM_MASTER_RESTORE', 'Restored all standard problem categories (A-I) to default titles');
  return { success: true };
}

export function getAllProblemCategoriesWithCustom() {
  const custom = getCustomProblems();
  const cfg = getAnnapurnaConfig();
  const overrides = cfg.standardProblemOverrides || {};
  const deletedSet = new Set(cfg.deletedStandardProblems || []);

  const extraCats = (cfg.extraProblemCategories || []).map((name, idx) => ({
    key: `EX${idx + 1}`,
    name: `${name}`,
    shortName: name,
    items: []
  }));

  const categories = [...PROBLEM_CATEGORIES_MASTER, ...extraCats].map(cat => {
    const itemDetails = [];
    const items = [];
    const seenLower = new Set();

    (cat.items || []).forEach(origTitle => {
      const stdKey = `${cat.key}::${origTitle}`;
      if (deletedSet.has(stdKey)) return;
      const effectiveTitle = (overrides[stdKey] || origTitle).trim();
      if (!effectiveTitle || seenLower.has(effectiveTitle.toLowerCase())) return;
      seenLower.add(effectiveTitle.toLowerCase());
      items.push(effectiveTitle);
      itemDetails.push({
        title: effectiveTitle,
        originalTitle: origTitle,
        isCustom: false,
        customId: '',
        categoryKey: cat.key,
        categoryName: cat.name
      });
    });

    return {
      ...cat,
      items,
      itemDetails
    };
  });

  custom.forEach(cp => {
    const target = categories.find(c => c.key === cp.categoryKey) || categories.find(c => c.key === 'H');
    if (target && cp.title && !target.items.some(t => t.toLowerCase() === cp.title.toLowerCase())) {
      target.items.push(cp.title);
      target.itemDetails.push({
        title: cp.title,
        originalTitle: cp.title,
        isCustom: true,
        customId: cp.id,
        categoryKey: target.key,
        categoryName: target.name
      });
    }
  });

  return categories;
}

/* =========================================================================
   3. CUSTOMER SERVICE HISTORY & VISIT TRACKING (WITH SAME-DAY GROUPING)
   ========================================================================= */

export function getAllCustomerVisits() {
  return getItem(KEYS.CUSTOMER_VISITS, []);
}

export function getCustomerVisits(customerId) {
  return getAllCustomerVisits().filter(v => v.customerId === customerId);
}

/**
 * Add a Visit or Group Multiple Services Under the Same Date Visit
 */
export async function addCustomerVisit({ customerId, visitDate, servicesProvided = [], remarks = '' }) {
  if (!customerId) return { success: false, message: 'Customer ID is required' };
  const dateStr = (visitDate || getTodayDate()).slice(0, 10);
  const servicesList = Array.isArray(servicesProvided)
    ? servicesProvided.map(s => String(s).trim()).filter(Boolean)
    : [];

  if (servicesList.length === 0) {
    return { success: false, message: 'Select at least one service for this visit' };
  }

  const allVisits = getAllCustomerVisits();
  const user = getCurrentUser();
  const actor = user?.name || user?.uid || 'Staff';
  const nowIso = new Date().toISOString();

  // Same-day grouping: check if customer already has a visit on visitDate
  const existingIdx = allVisits.findIndex(
    v => v.customerId === customerId && (v.visitDate || '').slice(0, 10) === dateStr
  );

  if (existingIdx !== -1) {
    const existing = allVisits[existingIdx];
    const currentEntries = Array.isArray(existing.serviceEntries) ? existing.serviceEntries : [];
    for (const srv of servicesList) {
      const entryId = await allocateGlobalReference('SITEM', { entityType: 'VISIT_SERVICE_ITEM' });
      currentEntries.push({
        id: entryId,
        serviceName: srv,
        remarks: remarks || '',
        recordedAt: nowIso,
        recordedBy: actor
      });
    }

    const uniqueServiceNames = Array.from(new Set([
      ...(existing.servicesProvided || []),
      ...servicesList
    ]));

    allVisits[existingIdx] = {
      ...existing,
      servicesProvided: uniqueServiceNames,
      serviceEntries: currentEntries,
      remarks: remarks
        ? (existing.remarks ? `${existing.remarks} | ${remarks}` : remarks)
        : existing.remarks,
      updatedAt: nowIso
    };
    setItem(KEYS.CUSTOMER_VISITS, allVisits);
    logAuditAction('CUSTOMER_VISIT_GROUPED', `Grouped ${servicesList.length} service(s) into visit on ${dateStr} for ${customerId}`, actor);
    return { success: true, visit: allVisits[existingIdx], groupedIntoSameDay: true };
  }

  const visitId = await allocateGlobalReference('VIS', { entityType: 'CUSTOMER_VISIT' });
  const serviceEntries = [];
  for (const srv of servicesList) {
    const entryId = await allocateGlobalReference('SITEM', { entityType: 'VISIT_SERVICE_ITEM' });
    serviceEntries.push({
      id: entryId,
      serviceName: srv,
      remarks: remarks || '',
      recordedAt: nowIso,
      recordedBy: actor
    });
  }
  const newVisit = {
    id: visitId,
    customerId,
    visitDate: dateStr,
    servicesProvided: Array.from(new Set(servicesList)),
    serviceEntries,
    remarks: remarks || '',
    createdBy: actor,
    createdAt: nowIso
  };

  allVisits.push(newVisit);
  setItem(KEYS.CUSTOMER_VISITS, allVisits);
  logAuditAction('CUSTOMER_VISIT_ADD', `Recorded new visit on ${dateStr} (${servicesList.join(', ')}) for ${customerId}`, actor);
  return { success: true, visit: newVisit, groupedIntoSameDay: false };
}

/**
 * Compute First Visit, Last Visit, Total Visit Count, Total Services Provided,
 * and Days Gap between Previous Visit and Current Visit
 */
export function getCustomerVisitAnalytics(customerId) {
  const visits = getCustomerVisits(customerId);
  // Ensure visits are sorted chronologically ascending for interval calculation
  const sortedAsc = [...visits].sort((a, b) => (a.visitDate || '').localeCompare(b.visitDate || ''));

  let totalServicesCount = 0;
  const enrichedAsc = sortedAsc.map((v, idx) => {
    const entries = Array.isArray(v.serviceEntries) && v.serviceEntries.length > 0
      ? v.serviceEntries
      : (v.servicesProvided || []).map(name => ({
          id: `${v.id}-${name}`,
          serviceName: name,
          remarks: v.remarks || '',
          recordedAt: v.createdAt
        }));

    totalServicesCount += entries.length;

    let daysFromPrevious = null;
    if (idx > 0) {
      const prevDate = new Date(`${sortedAsc[idx - 1].visitDate}T00:00:00`);
      const currDate = new Date(`${v.visitDate}T00:00:00`);
      if (!isNaN(prevDate.getTime()) && !isNaN(currDate.getTime())) {
        daysFromPrevious = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    return {
      ...v,
      serviceEntries: entries,
      serviceCountOnDay: entries.length,
      daysFromPrevious
    };
  });

  const firstVisitDate = enrichedAsc.length > 0 ? enrichedAsc[0].visitDate : null;
  const lastVisitDate = enrichedAsc.length > 0 ? enrichedAsc[enrichedAsc.length - 1].visitDate : null;

  return {
    totalVisitCount: enrichedAsc.length,
    totalServicesProvided: totalServicesCount,
    firstVisitDate,
    lastVisitDate,
    visitsChronological: enrichedAsc,
    visitsLatestFirst: [...enrichedAsc].reverse()
  };
}

/* =========================================================================
   4. ANNAPURNA YOJANA APPLICATION & CASE MANAGEMENT
   ========================================================================= */

export async function syncAnnapurnaAppsFromServer() {
  try {
    const localApps = getItem(KEYS.ANNAPURNA_APPLICATIONS, []);
    const res = await fetch('/api/annapurna/applications', {
      headers: getAuthHeaders()
    });
    if (!res.ok) return getAllAnnapurnaApps();
    const data = await res.json();
    const remoteApps = Array.isArray(data?.applications) ? data.applications : [];

    // Merge local and remote by id/applicationId keeping newest updatedAt
    const mergedMap = new Map();
    const keyOf = (a) => String(a?.id || a?.applicationId || '').trim();
    for (const r of remoteApps) {
      const k = keyOf(r);
      if (k) mergedMap.set(k, r);
    }
    let hasLocalNewer = false;
    for (const l of (Array.isArray(localApps) ? localApps : [])) {
      const k = keyOf(l);
      if (!k) continue;
      const r = mergedMap.get(k);
      if (!r) {
        mergedMap.set(k, l);
        hasLocalNewer = true;
      } else {
        const rTs = Date.parse(r.updatedAt || r.createdAt || '0') || 0;
        const lTs = Date.parse(l.updatedAt || l.createdAt || '0') || 0;
        if (lTs > rTs) {
          mergedMap.set(k, l);
          hasLocalNewer = true;
        }
      }
    }
    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => (Date.parse(b.updatedAt || b.createdAt || '0') || 0) - (Date.parse(a.updatedAt || a.createdAt || '0') || 0)
    );
    setItem(KEYS.ANNAPURNA_APPLICATIONS, merged);

    if (hasLocalNewer && localApps.length > 0) {
      await fetch('/api/annapurna/sync', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ applications: localApps })
      }).catch(() => {});
    }
    return merged;
  } catch {
    return getAllAnnapurnaApps();
  }
}

function pushAnnapurnaAppToServer(appRecord) {
  if (!appRecord) return;
  try {
    fetch('/api/annapurna/applications', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(appRecord)
    }).catch(() => {});
  } catch {}
}

function deleteAnnapurnaAppFromServer(id) {
  if (!id) return;
  try {
    fetch(`/api/annapurna/applications/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    }).catch(() => {});
  } catch {}
}

export function getAllAnnapurnaApps() {
  return getItem(KEYS.ANNAPURNA_APPLICATIONS, []);
}

export function getAnnapurnaAppById(id) {
  return getAllAnnapurnaApps().find(a => a.id === id || a.applicationId === id) || null;
}

export function getAnnapurnaAppsByCustomer(customerId) {
  return getAllAnnapurnaApps().filter(a => a.customerId === customerId);
}

/**
 * Create or Update Annapurna Application
 * Keeps Current Application Status & Customer Problems strictly independent.
 */
export async function saveAnnapurnaApp(data) {
  const apps = getAllAnnapurnaApps();
  const user = getCurrentUser();
  const actor = user?.name || user?.uid || 'Staff';
  const nowIso = new Date().toISOString();
  const today = getTodayDate();

  const cust = data.customerId ? getCustomerById(data.customerId) : null;

  // Normalize selected problems array
  const normalizedProblems = [];
  if (Array.isArray(data.problems)) {
    for (const p of data.problems) {
      const prbId = p.id || await allocateGlobalReference('PRB', { entityType: 'ANNAPURNA_PROBLEM' });
      normalizedProblems.push({
        id: prbId,
        categoryKey: p.categoryKey || 'H',
        categoryName: p.categoryName || 'H. Other Customer Problems',
        title: p.title,
        problemStatus: p.problemStatus || 'Open / Pending',
        remarks: p.remarks || '',
        addedAt: p.addedAt || nowIso,
        updatedAt: p.updatedAt || nowIso
      });
    }
  }

  if (data.id) {
    const idx = apps.findIndex(a => a.id === data.id);
    if (idx !== -1) {
      const prev = apps[idx];
      const prevStatus = prev.currentStatus;
      const newStatus = data.currentStatus || prevStatus;
      const timeline = Array.isArray(prev.followupTimeline) ? [...prev.followupTimeline] : [];
      const statusAudit = Array.isArray(prev.statusAudit) ? [...prev.statusAudit] : [];

      if (prevStatus !== newStatus) {
        const audstId = await allocateGlobalReference('AUDST', { entityType: 'ANNAPURNA_STATUS_AUDIT' });
        const tlId = await allocateGlobalReference('TL', { entityType: 'ANNAPURNA_TIMELINE' });
        statusAudit.unshift({
          id: audstId,
          previousStatus: prevStatus,
          newStatus,
          changedAt: nowIso,
          changedBy: actor
        });
        timeline.push({
          id: tlId,
          date: today,
          timestamp: nowIso,
          activity: 'Application Status Updated',
          previousStatus: prevStatus,
          updatedStatus: newStatus,
          actionTaken: 'Status modified during application update',
          remarks: data.remarks || 'Application details & status updated.',
          nextFollowupDate: data.nextFollowupDate || prev.nextFollowupDate || '',
          attachments: [],
          completed: ['Resolved', 'Approved', 'Sanctioned', 'Closed'].includes(newStatus),
          recordedBy: actor
        });
      }

      const updatedRecord = {
        ...prev,
        ...data,
        aadhaarRef: data.aadhaarRef !== undefined ? String(data.aadhaarRef || '').trim() : (prev.aadhaarRef || ''),
        disbursementAmount: data.disbursementAmount !== undefined ? Math.max(0, Number(data.disbursementAmount) || 0) : (Number(prev.disbursementAmount) || 0),
        paymentStatus: data.paymentStatus !== undefined ? String(data.paymentStatus || '').trim() : (prev.paymentStatus || 'Pending'),
        wardId: data.wardId !== undefined ? data.wardId : (prev.wardId || ''),
        wardNo: data.wardNo !== undefined ? data.wardNo : (prev.wardNo || ''),
        wardNumber: data.wardNumber !== undefined ? data.wardNumber : (prev.wardNumber || ''),
        wardName: data.wardName !== undefined ? data.wardName : (prev.wardName || ''),
        villageId: data.villageId !== undefined ? data.villageId : (prev.villageId || ''),
        gpOrWard: data.gpOrWard || data.wardNumber || prev.gpOrWard || '',
        customerName: data.customerName || cust?.name || prev.customerName || data.applicantName,
        customerPhone: data.customerPhone || cust?.phone || prev.customerPhone || data.mobileNumber || '',
        applicantName: data.applicantName || cust?.name || prev.applicantName,
        problems: normalizedProblems,
        followupTimeline: timeline,
        statusAudit,
        updatedAt: nowIso,
        updatedBy: actor
      };
      if (!updatedRecord.wardId) {
        const resolved = resolveWardForApp(updatedRecord);
        if (resolved) {
          updatedRecord.wardId = resolved.wardId;
          updatedRecord.wardNo = resolved.wardNo;
          updatedRecord.wardNumber = resolved.wardNumber;
          updatedRecord.wardName = resolved.wardName;
        }
      }
      apps[idx] = updatedRecord;

      setItem(KEYS.ANNAPURNA_APPLICATIONS, apps);
      pushAnnapurnaAppToServer(apps[idx]);
      logAuditAction('ANNAPURNA_APP_UPDATE', `Updated Annapurna Application ${apps[idx].applicationId || apps[idx].id}`, actor);
      return { success: true, app: apps[idx], isNew: false };
    }
  }

  const initialStatus = data.currentStatus || 'Submitted';
  const appId = await allocateGlobalReference('ANP', { entityType: 'ANNAPURNA_APP' });
  const initialAudstId = await allocateGlobalReference('AUDST', { entityType: 'ANNAPURNA_STATUS_AUDIT' });
  const initialTlId = await allocateGlobalReference('TL', { entityType: 'ANNAPURNA_TIMELINE' });
  const resolvedWard = !data.wardId ? resolveWardForApp(data) : null;
  const newApp = {
    id: appId,
    customerId: data.customerId || '',
    customerName: data.customerName || cust?.name || data.applicantName || '',
    customerPhone: data.customerPhone || cust?.phone || data.mobileNumber || '',
    applicantName: data.applicantName || cust?.name || '',
    applicationId: data.applicationId || appId,
    applicationDate: data.applicationDate || today,
    aadhaarRef: String(data.aadhaarRef || '').trim(),
    disbursementAmount: Math.max(0, Number(data.disbursementAmount) || 0),
    paymentStatus: String(data.paymentStatus || (Number(data.disbursementAmount) > 0 ? 'Disbursed' : 'Pending')).trim(),
    headOfFamily: data.headOfFamily || '',
    voterIdEpic: data.voterIdEpic || '',
    assemblyConstituency: data.assemblyConstituency || '',
    partNumber: data.partNumber || '',
    serialNumber: data.serialNumber || '',
    state: data.state || 'West Bengal',
    district: data.district || 'Murshidabad',
    blockOrMunicipality: data.blockOrMunicipality || '',
    wardId: data.wardId || resolvedWard?.wardId || '',
    wardNo: data.wardNo || resolvedWard?.wardNo || '',
    wardNumber: data.wardNumber || resolvedWard?.wardNumber || '',
    wardName: data.wardName || resolvedWard?.wardName || '',
    gpOrWard: data.gpOrWard || data.wardNumber || resolvedWard?.wardNumber || '',
    villageId: data.villageId || '',
    village: data.village || '',
    postOffice: data.postOffice || '',
    policeStation: data.policeStation || '',
    pinCode: data.pinCode || '',
    currentStatus: initialStatus,
    remarks: data.remarks || '',
    documents: Array.isArray(data.documents) ? data.documents : [],
    problems: normalizedProblems,
    complaints: Array.isArray(data.complaints) ? data.complaints : [],
    nextFollowupDate: data.nextFollowupDate || '',
    statusAudit: [
      {
        id: initialAudstId,
        previousStatus: 'New',
        newStatus: initialStatus,
        changedAt: nowIso,
        changedBy: actor
      }
    ],
    followupTimeline: [
      {
        id: initialTlId,
        date: data.applicationDate || today,
        timestamp: nowIso,
        activity: 'Annapurna Yojana Application Registered',
        previousStatus: 'New',
        updatedStatus: initialStatus,
        actionTaken: `Application logged (${normalizedProblems.length} problem(s) tagged)`,
        remarks: data.remarks || 'Initial application & problem profiling recorded.',
        nextFollowupDate: data.nextFollowupDate || '',
        attachments: [],
        completed: false,
        recordedBy: actor
      }
    ],
    createdBy: actor,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  apps.unshift(newApp);
  setItem(KEYS.ANNAPURNA_APPLICATIONS, apps);
  pushAnnapurnaAppToServer(newApp);
  logAuditAction('ANNAPURNA_APP_CREATE', `Registered Annapurna Application ${newApp.applicationId} for ${newApp.applicantName}`, actor);
  return { success: true, app: newApp, isNew: true };
}

export function deleteAnnapurnaApp(id) {
  const apps = getAllAnnapurnaApps();
  const target = apps.find(a => a.id === id);
  if (!target) return { success: false };
  setItem(KEYS.ANNAPURNA_APPLICATIONS, apps.filter(a => a.id !== id));
  deleteAnnapurnaAppFromServer(id);
  markGlobalReferenceDeleted(id).catch(() => {});
  logAuditAction('ANNAPURNA_APP_DELETE', `Deleted Annapurna Application ${target.applicationId} (${target.applicantName})`);
  return { success: true };
}

/**
 * Append Supporting Documents to an Application & Log to Non-Overwriting Timeline
 */
export async function addDocumentsToApp(appId, docs = [], docLabel = '', remarks = '') {
  const apps = getAllAnnapurnaApps();
  const idx = apps.findIndex(a => a.id === appId);
  if (idx === -1) return { success: false, message: 'Application not found' };
  const list = Array.isArray(docs) ? docs : [];
  if (list.length === 0 && !docLabel) {
    return { success: false, message: 'Select at least one document or file to attach.' };
  }
  const user = getCurrentUser();
  const actor = user?.name || user?.uid || 'Staff';
  const nowIso = new Date().toISOString();
  const prev = apps[idx];
  const existingDocs = Array.isArray(prev.documents) ? [...prev.documents] : [];
  const appended = list.length > 0
    ? list.map(d => ({ ...d, docType: docLabel || d.docType || 'Supporting Document', uploadedAt: d.uploadedAt || nowIso, uploadedBy: actor }))
    : [{ name: docLabel, docType: docLabel, uploadedAt: nowIso, uploadedBy: actor }];
  const timeline = Array.isArray(prev.followupTimeline) ? [...prev.followupTimeline] : [];
  const tlId = await allocateGlobalReference('TL', { entityType: 'ANNAPURNA_TIMELINE' });
  timeline.push({
    id: tlId,
    date: getTodayDate(),
    timestamp: nowIso,
    activity: 'Documents Uploaded',
    followupType: 'Document Submission',
    office: prev.blockOrMunicipality || '',
    previousStatus: prev.currentStatus,
    updatedStatus: prev.currentStatus,
    actionTaken: `Attached ${appended.length} document(s): ${appended.map(d => d.name).join(', ')}`,
    remarks: remarks || 'Supporting documents attached to application dossier.',
    nextFollowupDate: prev.nextFollowupDate || '',
    attachments: appended,
    completed: true,
    recordedBy: actor
  });
  apps[idx] = {
    ...prev,
    documents: [...existingDocs, ...appended],
    followupTimeline: timeline,
    updatedAt: nowIso,
    updatedBy: actor
  };
  setItem(KEYS.ANNAPURNA_APPLICATIONS, apps);
  pushAnnapurnaAppToServer(apps[idx]);
  logAuditAction('ANNAPURNA_DOC_ADD', `Attached ${appended.length} document(s) to ${prev.applicationId}`, actor);
  return { success: true, app: apps[idx], addedCount: appended.length };
}

/**
 * Update ONLY the Application Status (never alters or overwrites Problems[])
 */
export async function updateAppStatusOnly(appId, newStatus, remarks = '', nextFollowupDate = '') {
  const apps = getAllAnnapurnaApps();
  const idx = apps.findIndex(a => a.id === appId);
  if (idx === -1) return { success: false, message: 'Application not found' };

  const user = getCurrentUser();
  const actor = user?.name || user?.uid || 'Staff';
  const nowIso = new Date().toISOString();
  const prev = apps[idx];
  const prevStatus = prev.currentStatus;

  const audstId = await allocateGlobalReference('AUDST', { entityType: 'ANNAPURNA_STATUS_AUDIT' });
  const tlId = await allocateGlobalReference('TL', { entityType: 'ANNAPURNA_TIMELINE' });
  const statusAudit = Array.isArray(prev.statusAudit) ? [...prev.statusAudit] : [];
  statusAudit.unshift({
    id: audstId,
    previousStatus: prevStatus,
    newStatus,
    changedAt: nowIso,
    changedBy: actor
  });

  const timeline = Array.isArray(prev.followupTimeline) ? [...prev.followupTimeline] : [];
  timeline.push({
    id: tlId,
    date: getTodayDate(),
    timestamp: nowIso,
    activity: 'Application Status Changed',
    previousStatus: prevStatus,
    updatedStatus: newStatus,
    actionTaken: `Status updated from "${prevStatus}" to "${newStatus}"`,
    remarks: remarks || '-',
    nextFollowupDate: nextFollowupDate || prev.nextFollowupDate || '',
    attachments: [],
    completed: ['Approved', 'Sanctioned', 'Rejected', 'Cancelled', 'Closed', 'Resolved'].includes(newStatus),
    recordedBy: actor
  });

  apps[idx] = {
    ...prev,
    currentStatus: newStatus,
    nextFollowupDate: nextFollowupDate || prev.nextFollowupDate,
    statusAudit,
    followupTimeline: timeline,
    updatedAt: nowIso,
    updatedBy: actor
  };

  setItem(KEYS.ANNAPURNA_APPLICATIONS, apps);
  pushAnnapurnaAppToServer(apps[idx]);
  logAuditAction('ANNAPURNA_STATUS_CHANGE', `${prev.applicationId}: ${prevStatus} -> ${newStatus}`, actor);
  return { success: true, app: apps[idx] };
}

/**
 * Add an independent Problem to an Application (never overwrites existing problems or App Status)
 */
export async function addProblemToApp(appId, { categoryKey, categoryName, title, remarks = '' }) {
  const apps = getAllAnnapurnaApps();
  const idx = apps.findIndex(a => a.id === appId);
  if (idx === -1) return { success: false, message: 'Application not found' };

  const cleanTitle = (title || '').trim();
  if (!cleanTitle) return { success: false, message: 'Problem title is required' };

  const user = getCurrentUser();
  const actor = user?.name || user?.uid || 'Staff';
  const nowIso = new Date().toISOString();
  const prev = apps[idx];
  const problems = Array.isArray(prev.problems) ? [...prev.problems] : [];

  if (problems.some(p => p.title.toLowerCase() === cleanTitle.toLowerCase() && p.categoryKey === categoryKey)) {
    return { success: false, message: `"${cleanTitle}" is already added to this application.` };
  }

  const prbId = await allocateGlobalReference('PRB', { entityType: 'ANNAPURNA_PROBLEM' });
  const tlId = await allocateGlobalReference('TL', { entityType: 'ANNAPURNA_TIMELINE' });
  problems.push({
    id: prbId,
    categoryKey: categoryKey || 'H',
    categoryName: categoryName || 'H. Other Customer Problems',
    title: cleanTitle,
    problemStatus: 'Open / Pending',
    remarks,
    addedAt: nowIso,
    updatedAt: nowIso
  });

  const timeline = Array.isArray(prev.followupTimeline) ? [...prev.followupTimeline] : [];
  timeline.push({
    id: tlId,
    date: getTodayDate(),
    timestamp: nowIso,
    activity: `Problem Tagged (${categoryKey || 'H'})`,
    previousStatus: prev.currentStatus,
    updatedStatus: prev.currentStatus,
    actionTaken: `Added Problem: ${cleanTitle}`,
    remarks: remarks || 'Tagged for tracking without altering Application Status.',
    nextFollowupDate: prev.nextFollowupDate || '',
    attachments: [],
    completed: false,
    recordedBy: actor
  });

  apps[idx] = {
    ...prev,
    problems,
    followupTimeline: timeline,
    updatedAt: nowIso
  };
  setItem(KEYS.ANNAPURNA_APPLICATIONS, apps);
  pushAnnapurnaAppToServer(apps[idx]);
  return { success: true, app: apps[idx] };
}

/**
 * Update ONLY ONE specific problem's resolution status without overwriting other problems or Application Status
 */
export async function updateIndividualProblemStatus(appId, problemId, newProblemStatus, notes = '') {
  const apps = getAllAnnapurnaApps();
  const idx = apps.findIndex(a => a.id === appId);
  if (idx === -1) return { success: false, message: 'Application not found' };

  const user = getCurrentUser();
  const actor = user?.name || user?.uid || 'Staff';
  const nowIso = new Date().toISOString();
  const prev = apps[idx];
  const problems = Array.isArray(prev.problems) ? [...prev.problems] : [];
  const pIdx = problems.findIndex(p => p.id === problemId);
  if (pIdx === -1) return { success: false, message: 'Problem entry not found' };

  const targetProb = problems[pIdx];
  const oldProbStatus = targetProb.problemStatus || 'Open / Pending';

  problems[pIdx] = {
    ...targetProb,
    problemStatus: newProblemStatus,
    remarks: notes || targetProb.remarks,
    updatedAt: nowIso
  };

  const timeline = Array.isArray(prev.followupTimeline) ? [...prev.followupTimeline] : [];
  const tlId = await allocateGlobalReference('TL', { entityType: 'ANNAPURNA_TIMELINE' });
  timeline.push({
    id: tlId,
    date: getTodayDate(),
    timestamp: nowIso,
    activity: `Problem Updated: ${targetProb.title}`,
    previousStatus: oldProbStatus,
    updatedStatus: newProblemStatus,
    actionTaken: `Problem "${targetProb.title}" moved ${oldProbStatus} -> ${newProblemStatus} (Other problems untouched)`,
    remarks: notes || '-',
    nextFollowupDate: prev.nextFollowupDate || '',
    attachments: [],
    completed: newProblemStatus === 'Resolved',
    recordedBy: actor
  });

  apps[idx] = {
    ...prev,
    problems,
    followupTimeline: timeline,
    updatedAt: nowIso
  };
  setItem(KEYS.ANNAPURNA_APPLICATIONS, apps);
  pushAnnapurnaAppToServer(apps[idx]);
  return { success: true, app: apps[idx] };
}

/* =========================================================================
   5. CLAIM & GRIEVANCE / COMPLAINT MANAGEMENT (MULTIPLE PER APPLICATION)
   ========================================================================= */

export async function addComplaintToApp(appId, complaintData) {
  const apps = getAllAnnapurnaApps();
  const idx = apps.findIndex(a => a.id === appId);
  if (idx === -1) return { success: false, message: 'Application not found' };

  const user = getCurrentUser();
  const actor = user?.name || user?.uid || 'Staff';
  const nowIso = new Date().toISOString();
  const prev = apps[idx];

  const cmpId = await allocateGlobalReference('CMP', { entityType: 'ANNAPURNA_COMPLAINT' });
  const tlId = await allocateGlobalReference('TL', { entityType: 'ANNAPURNA_TIMELINE' });
  const complaint = {
    id: cmpId,
    complaintType: complaintData.complaintType || 'Annapurna Yojana Claim',
    submissionDate: complaintData.submissionDate || getTodayDate(),
    referenceNumber: (complaintData.referenceNumber || '').trim(),
    submittedTo: (complaintData.submittedTo || '').trim(),
    description: (complaintData.description || '').trim(),
    status: complaintData.status || 'Submitted',
    actionTaken: (complaintData.actionTaken || '').trim(),
    replyDetails: (complaintData.replyDetails || '').trim(),
    attachments: Array.isArray(complaintData.attachments) ? complaintData.attachments : [],
    nextFollowupDate: complaintData.nextFollowupDate || '',
    createdBy: actor,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const complaints = Array.isArray(prev.complaints) ? [...prev.complaints, complaint] : [complaint];
  const timeline = Array.isArray(prev.followupTimeline) ? [...prev.followupTimeline] : [];

  timeline.push({
    id: tlId,
    date: complaint.submissionDate,
    timestamp: nowIso,
    activity: `${complaint.complaintType} Logged`,
    previousStatus: prev.currentStatus,
    updatedStatus: prev.currentStatus,
    actionTaken: complaint.actionTaken || `${complaint.complaintType} (${complaint.status})`,
    remarks: complaint.description || complaint.actionTaken || 'Claim / complaint registered.',
    nextFollowupDate: complaint.nextFollowupDate || prev.nextFollowupDate || '',
    attachments: complaint.attachments,
    completed: ['Resolved', 'Closed'].includes(complaint.status),
    recordedBy: actor
  });

  apps[idx] = {
    ...prev,
    complaints,
    nextFollowupDate: complaint.nextFollowupDate || prev.nextFollowupDate,
    followupTimeline: timeline,
    updatedAt: nowIso
  };

  setItem(KEYS.ANNAPURNA_APPLICATIONS, apps);
  pushAnnapurnaAppToServer(apps[idx]);
  logAuditAction('ANNAPURNA_COMPLAINT_ADD', `Added ${complaint.complaintType} (${complaint.status}) to ${prev.applicationId}`, actor);
  return { success: true, complaint, app: apps[idx] };
}

export async function updateComplaintInApp(appId, complaintId, updates) {
  const apps = getAllAnnapurnaApps();
  const idx = apps.findIndex(a => a.id === appId);
  if (idx === -1) return { success: false, message: 'Application not found' };

  const user = getCurrentUser();
  const actor = user?.name || user?.uid || 'Staff';
  const nowIso = new Date().toISOString();
  const prev = apps[idx];
  const complaints = Array.isArray(prev.complaints) ? [...prev.complaints] : [];
  const cIdx = complaints.findIndex(c => c.id === complaintId);
  if (cIdx === -1) return { success: false, message: 'Complaint not found' };

  const oldCmp = complaints[cIdx];
  const newStatus = updates.status || oldCmp.status;

  complaints[cIdx] = {
    ...oldCmp,
    ...updates,
    updatedAt: nowIso
  };

  const timeline = Array.isArray(prev.followupTimeline) ? [...prev.followupTimeline] : [];
  const tlId = await allocateGlobalReference('TL', { entityType: 'ANNAPURNA_TIMELINE' });
  timeline.push({
    id: tlId,
    date: getTodayDate(),
    timestamp: nowIso,
    activity: `Complaint Update (${oldCmp.complaintType})`,
    previousStatus: oldCmp.status,
    updatedStatus: newStatus,
    actionTaken: updates.actionTaken || `${oldCmp.complaintType} status updated to ${newStatus}`,
    remarks: updates.replyDetails || updates.description || 'Department response/status updated.',
    nextFollowupDate: updates.nextFollowupDate || oldCmp.nextFollowupDate || '',
    attachments: updates.attachments || [],
    completed: ['Resolved', 'Closed'].includes(newStatus),
    recordedBy: actor
  });

  apps[idx] = {
    ...prev,
    complaints,
    nextFollowupDate: updates.nextFollowupDate || prev.nextFollowupDate,
    followupTimeline: timeline,
    updatedAt: nowIso
  };
  setItem(KEYS.ANNAPURNA_APPLICATIONS, apps);
  pushAnnapurnaAppToServer(apps[idx]);
  return { success: true, complaint: complaints[cIdx], app: apps[idx] };
}

/* =========================================================================
   6. NON-OVERWRITING CHRONOLOGICAL FOLLOW-UP TIMELINE & REMINDERS
   ========================================================================= */

export async function addFollowupEntry(appId, entryData) {
  const apps = getAllAnnapurnaApps();
  const idx = apps.findIndex(a => a.id === appId);
  if (idx === -1) return { success: false, message: 'Application not found' };

  const user = getCurrentUser();
  const actor = user?.name || user?.uid || 'Staff';
  const nowIso = new Date().toISOString();
  const prev = apps[idx];

  const prevStatus = entryData.previousStatus || prev.currentStatus;
  const updatedStatus = entryData.updatedStatus || prev.currentStatus;

  const tlId = await allocateGlobalReference('TL', { entityType: 'ANNAPURNA_TIMELINE' });
  const entry = {
    id: tlId,
    date: entryData.date || getTodayDate(),
    timestamp: nowIso,
    activity: entryData.activity || 'Follow-up Action',
    followupType: (entryData.followupType || '').trim(),
    office: (entryData.office || '').trim(),
    previousStatus: prevStatus,
    updatedStatus: updatedStatus,
    actionTaken: entryData.actionTaken || '',
    remarks: entryData.remarks || '',
    nextFollowupDate: entryData.nextFollowupDate || '',
    attachments: Array.isArray(entryData.attachments) ? entryData.attachments : [],
    completed: !!entryData.completed,
    recordedBy: actor
  };

  const timeline = Array.isArray(prev.followupTimeline) ? [...prev.followupTimeline, entry] : [entry];
  const statusAudit = Array.isArray(prev.statusAudit) ? [...prev.statusAudit] : [];
  if (updatedStatus && updatedStatus !== prev.currentStatus) {
    const audstId = await allocateGlobalReference('AUDST', { entityType: 'ANNAPURNA_STATUS_AUDIT' });
    statusAudit.unshift({
      id: audstId,
      previousStatus: prev.currentStatus,
      newStatus: updatedStatus,
      changedAt: nowIso,
      changedBy: actor
    });
  }

  apps[idx] = {
    ...prev,
    currentStatus: updatedStatus || prev.currentStatus,
    nextFollowupDate: entryData.nextFollowupDate || prev.nextFollowupDate,
    followupTimeline: timeline,
    statusAudit,
    updatedAt: nowIso,
    updatedBy: actor
  };

  setItem(KEYS.ANNAPURNA_APPLICATIONS, apps);
  pushAnnapurnaAppToServer(apps[idx]);
  logAuditAction('ANNAPURNA_FOLLOWUP_ADD', `Follow-up recorded for ${prev.applicationId}: ${entry.activity}`, actor);
  return { success: true, entry, app: apps[idx] };
}

export function toggleFollowupCompleted(appId, timelineId) {
  const apps = getAllAnnapurnaApps();
  const idx = apps.findIndex(a => a.id === appId);
  if (idx === -1) return;
  const timeline = Array.isArray(apps[idx].followupTimeline) ? [...apps[idx].followupTimeline] : [];
  const tIdx = timeline.findIndex(t => t.id === timelineId);
  if (tIdx === -1) return;
  timeline[tIdx] = { ...timeline[tIdx], completed: !timeline[tIdx].completed };
  apps[idx].followupTimeline = timeline;
  apps[idx].updatedAt = new Date().toISOString();
  setItem(KEYS.ANNAPURNA_APPLICATIONS, apps);
  pushAnnapurnaAppToServer(apps[idx]);
}

const FINAL_CLOSED_STATUSES = new Set([
  'Approved',
  'Sanctioned',
  'Beneficiary Selected',
  'Rejected',
  'Cancelled',
  'Not Eligible',
  'Discontinued',
  'Resolved',
  'Closed'
]);

export function isAppFinalClosed(app) {
  return FINAL_CLOSED_STATUSES.has(app.currentStatus);
}

function getTomorrowDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getAnnapurnaReminders() {
  const apps = getAllAnnapurnaApps();
  const today = getTodayDate();
  const tomorrow = getTomorrowDateStr();

  const todayFollowups = [];
  const tomorrowFollowups = [];
  const upcoming = [];
  const overdue = [];
  const officeVisits = [];
  const rtiPending = [];
  const callbacks = [];
  const pendingComplaints = [];

  apps.forEach(app => {
    const isClosed = isAppFinalClosed(app);
    const nextDate = (app.nextFollowupDate || '').slice(0, 10);
    const latestTl = Array.isArray(app.followupTimeline) && app.followupTimeline.length > 0
      ? app.followupTimeline[app.followupTimeline.length - 1]
      : null;

    if (!isClosed && nextDate) {
      if (nextDate === today) {
        todayFollowups.push(app);
      } else if (nextDate === tomorrow) {
        tomorrowFollowups.push(app);
      } else if (nextDate > tomorrow) {
        upcoming.push(app);
      } else {
        overdue.push(app);
      }

      const tlType = `${latestTl?.followupType || ''} ${latestTl?.activity || ''} ${latestTl?.office || ''} ${latestTl?.actionTaken || ''}`.toLowerCase();
      if (nextDate >= today && /office|visit|bdo|sdo|dm|camp/.test(tlType)) {
        officeVisits.push({ app, tl: latestTl, visitDate: nextDate });
      }
      if (/callback|phone|call/.test(tlType)) {
        callbacks.push({
          id: app.id,
          appId: app.id,
          applicationId: app.applicationId,
          customerName: app.applicantName,
          phone: app.customerPhone,
          dueDate: nextDate,
          note: latestTl?.actionTaken || app.currentStatus
        });
      }
    }

    (app.complaints || []).forEach(cmp => {
      if (!['Resolved', 'Closed', 'Rejected'].includes(cmp.status)) {
        const cmpObj = {
          ...cmp,
          appId: app.id,
          applicationId: app.applicationId,
          applicantName: app.applicantName,
          customerPhone: app.customerPhone
        };
        pendingComplaints.push(cmpObj);
        if (/rti/i.test(cmp.complaintType || '')) {
          rtiPending.push(cmpObj);
        }
      }
    });
  });

  // Also include customer callbacks from Smart Reminders storage
  const smartRems = getItem(KEYS.SMART_REMINDERS, []);
  (Array.isArray(smartRems) ? smartRems : []).forEach(rem => {
    if (rem.status !== 'completed' && /callback|follow|annapurna/i.test(`${rem.type || ''} ${rem.title || ''}`)) {
      callbacks.push({
        id: rem.id,
        appId: '',
        applicationId: rem.linkedRef || rem.type || 'Reminder',
        customerName: rem.customerName || 'Customer',
        phone: rem.customerPhone || '',
        dueDate: rem.dueDate || today,
        note: rem.title || rem.notes || 'Customer Callback'
      });
    }
  });

  upcoming.sort((a, b) => a.nextFollowupDate.localeCompare(b.nextFollowupDate));
  overdue.sort((a, b) => a.nextFollowupDate.localeCompare(b.nextFollowupDate));
  officeVisits.sort((a, b) => (a.visitDate || '').localeCompare(b.visitDate || ''));
  callbacks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  return {
    today: todayFollowups,
    tomorrow: tomorrowFollowups,
    upcoming,
    overdue,
    officeVisits,
    rtiPending,
    callbacks,
    pendingComplaints
  };
}

/* =========================================================================
   7. LIVE DYNAMIC DASHBOARD ANALYTICS (REAL-TIME COUNTERS FROM SAVED RECORDS)
   ========================================================================= */

export function computeAnnapurnaDashboardStats() {
  const customers = getAllCustomers();
  const apps = getAllAnnapurnaApps();
  const reminders = getAnnapurnaReminders();

  let totalClaimsSubmitted = 0;
  let totalPendingApplications = 0;
  let underProcess = 0;
  let forFurtherVerification = 0;
  let underEnquiry = 0;
  let holdUp = 0;
  let totalCmoComplaints = 0;
  let totalMlaComplaints = 0;
  let totalCpgramsComplaints = 0;
  let totalNpciIssues = 0;
  let totalAadhaarIssues = 0;
  let totalHousingIssues = 0;
  let govtServiceIssues = 0;
  let incomeTaxIssues = 0;
  let moreThan3RoomsIssues = 0;
  let approvedApplications = 0;
  let rejectedApplications = 0;
  let resolvedCases = 0;
  let totalDisbursement = 0;
  let monthlyDisbursement = 0;
  const currentMonth = getTodayDate().slice(0, 7);

  apps.forEach(app => {
    const st = app.currentStatus || '';
    const stLower = st.toLowerCase();
    const disb = Math.max(0, Number(app.disbursementAmount) || 0);
    totalDisbursement += disb;
    if (String(app.applicationDate || '').startsWith(currentMonth)) {
      monthlyDisbursement += disb;
    }

    if (stLower === 'under process') underProcess++;
    if (stLower === 'for further verification') forFurtherVerification++;
    if (stLower === 'under enquiry') underEnquiry++;
    if (stLower === 'hold up' || stLower === 'application hold') holdUp++;

    if (['Approved', 'Sanctioned', 'Beneficiary Selected', 'Payment Started'].includes(st)) {
      approvedApplications++;
    } else if (['Rejected', 'Cancelled', 'Not Eligible', 'Discontinued'].includes(st)) {
      rejectedApplications++;
    }

    if (['Resolved', 'Closed', 'Approved', 'Sanctioned', 'Beneficiary Selected', 'Payment Started'].includes(st)) {
      resolvedCases++;
    } else if (!['Rejected', 'Cancelled', 'Not Eligible', 'Discontinued'].includes(st)) {
      totalPendingApplications++;
    }

    const cmps = Array.isArray(app.complaints) ? app.complaints : [];
    totalClaimsSubmitted += cmps.length;
    cmps.forEach(c => {
      const t = (c.complaintType || '').toLowerCase();
      if (t.includes('cmo')) totalCmoComplaints++;
      if (t.includes('mla')) totalMlaComplaints++;
      if (t.includes('cpgrams')) totalCpgramsComplaints++;
    });

    const probs = Array.isArray(app.problems) ? app.problems : [];
    if (probs.some(p => p.categoryKey === 'B' || /npci|dbt|bank account/i.test(p.title))) {
      totalNpciIssues++;
    }
    if (probs.some(p => p.categoryKey === 'A' || /aadhaar|ekyc|e-kyc/i.test(p.title))) {
      totalAadhaarIssues++;
    }
    if (probs.some(p => p.categoryKey === 'C' || /housing|room/i.test(p.title))) {
      totalHousingIssues++;
    }
    if (probs.some(p => /government service|govt/i.test(p.title))) {
      govtServiceIssues++;
    }
    if (probs.some(p => /income tax/i.test(p.title))) {
      incomeTaxIssues++;
    }
    if (probs.some(p => /more than 3 rooms|3 pucca rooms/i.test(p.title))) {
      moreThan3RoomsIssues++;
    }
  });

  return {
    totalRegisteredCustomers: customers.length,
    totalAnnapurnaApplications: apps.length,
    underProcess,
    forFurtherVerification,
    underEnquiry,
    holdUp,
    pendingClaims: reminders.pendingComplaints.length,
    totalClaimsSubmitted,
    totalPendingApplications,
    totalCmoComplaints,
    totalMlaComplaints,
    totalCpgramsComplaints,
    totalNpciIssues,
    totalAadhaarIssues,
    totalHousingIssues,
    govtServiceIssues,
    incomeTaxIssues,
    moreThan3RoomsIssues,
    rtiPending: reminders.rtiPending.length,
    approvedApplications,
    rejectedApplications,
    resolvedCases,
    totalDisbursement,
    monthlyDisbursement,
    upcomingFollowups: reminders.upcoming.length + reminders.tomorrow.length + reminders.today.length,
    overdueFollowups: reminders.overdue.length
  };
}

export function buildAnnapurnaMonthlyPayoutAnalytics(appsList = null, yearOverride = '') {
  const apps = Array.isArray(appsList) ? appsList : getAllAnnapurnaApps();
  const targetYear = yearOverride || String(new Date().getFullYear());
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const bucketMap = new Map();

  for (let m = 1; m <= 12; m++) {
    const ym = `${targetYear}-${String(m).padStart(2, '0')}`;
    bucketMap.set(ym, {
      label: `${monthNames[m - 1]} ${targetYear}`,
      registered: 0,
      approved: 0,
      pending: 0,
      disbursement: 0
    });
  }

  apps.forEach(a => {
    const dt = String(a.applicationDate || a.createdAt || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(dt)) return;
    if (yearOverride && !dt.startsWith(yearOverride)) return;
    if (!bucketMap.has(dt)) {
      const [yr, mo] = dt.split('-');
      const mIdx = (Number(mo) || 1) - 1;
      bucketMap.set(dt, {
        label: `${monthNames[mIdx] || mo} ${yr}`,
        registered: 0,
        approved: 0,
        pending: 0,
        disbursement: 0
      });
    }
    const b = bucketMap.get(dt);
    b.registered += 1;
    const st = String(a.currentStatus || '');
    if (['Approved', 'Sanctioned', 'Beneficiary Selected', 'Payment Started', 'Resolved'].includes(st)) {
      b.approved += 1;
    } else if (!['Rejected', 'Cancelled', 'Not Eligible', 'Discontinued'].includes(st)) {
      b.pending += 1;
    }
    b.disbursement += Math.max(0, Number(a.disbursementAmount) || 0);
  });

  const keys = Array.from(bucketMap.keys()).sort();
  return {
    labels: keys.map(k => bucketMap.get(k).label),
    registered: keys.map(k => bucketMap.get(k).registered),
    approved: keys.map(k => bucketMap.get(k).approved),
    pending: keys.map(k => bucketMap.get(k).pending),
    disbursement: keys.map(k => bucketMap.get(k).disbursement)
  };
}

/* =========================================================================
   8. ADVANCED MULTI-FILTER SEARCH ENGINE
   ========================================================================= */

export function filterAnnapurnaApplications(filters = {}) {
  const apps = getAllAnnapurnaApps();
  const q = (filters.query || '').trim().toLowerCase();
  const cat = filters.problemCategory || 'all';
  const status = filters.currentStatus || 'all';
  const cmpType = filters.complaintType || 'all';
  const subFrom = filters.submissionFrom || '';
  const subTo = filters.submissionTo || '';
  const followDate = filters.followupDate || '';
  const caseState = filters.caseState || 'all'; // all | pending | resolved
  const wardIdFilter = (filters.wardId || 'all').trim();
  const villageFilter = (filters.village || 'all').trim().toLowerCase();
  const gpFilter = (filters.gpOrWard || 'all').trim().toLowerCase();
  const blockFilter = (filters.blockOrMunicipality || 'all').trim().toLowerCase();

  return apps.filter(app => {
    const resolvedWard = resolveWardForApp(app);
    const appWardLabel = app.wardNumber || app.wardName || resolvedWard?.wardNumber || app.gpOrWard || '';

    if (q) {
      const hay = [
        app.customerName,
        app.applicantName,
        app.customerPhone,
        app.applicationId,
        app.aadhaarRef,
        app.id,
        app.headOfFamily,
        app.voterIdEpic,
        app.village,
        appWardLabel,
        app.wardNumber,
        app.wardName,
        app.gpOrWard,
        app.blockOrMunicipality,
        app.assemblyConstituency
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (cat !== 'all') {
      const probs = app.problems || [];
      if (!probs.some(p => p.categoryKey === cat)) return false;
    }

    if (status !== 'all') {
      if (app.currentStatus !== status) return false;
    }

    if (cmpType !== 'all') {
      const cmps = app.complaints || [];
      if (!cmps.some(c => c.complaintType === cmpType)) return false;
    }

    if (subFrom && (app.applicationDate || '') < subFrom) return false;
    if (subTo && (app.applicationDate || '') > subTo) return false;
    if (followDate && (app.nextFollowupDate || '').slice(0, 10) !== followDate) return false;

    if (wardIdFilter !== 'all' && wardIdFilter) {
      const appWardId = app.wardId || resolvedWard?.wardId || '';
      if (appWardId !== wardIdFilter && String(appWardLabel).toLowerCase() !== wardIdFilter.toLowerCase()) {
        return false;
      }
    }

    if (villageFilter !== 'all' && villageFilter && (app.village || '').trim().toLowerCase() !== villageFilter) return false;
    if (gpFilter !== 'all' && gpFilter && String(app.gpOrWard || appWardLabel).trim().toLowerCase() !== gpFilter) return false;
    if (blockFilter !== 'all' && blockFilter && (app.blockOrMunicipality || '').trim().toLowerCase() !== blockFilter) return false;

    if (caseState === 'pending' && isAppFinalClosed(app)) return false;
    if (caseState === 'resolved' && !isAppFinalClosed(app)) return false;

    return true;
  });
}

/* =========================================================================
   9. WORKING REPORTS & EXPORTS (PDF, EXCEL .XLSX, CSV, IN-APP PRINT)
   ========================================================================= */

function sanitizeAscii(val) {
  return String(val ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/–|—/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ')
    .trim();
}

export function showInAppPrintModal(title, bodyHtml, pdfConfig = null) {
  showA4PrintPdfPopup({
    title,
    subtitle: 'MUN COMPUTER BUSINESS MANAGER • A4 Single-Side Print & PDF',
    bodyHtml,
    pdfConfig
  });
}

function buildReportDataset(reportType, filters = {}) {
  const today = getTodayDate();

  if (reportType === 'customer') {
    const customers = getAllCustomers();
    const apps = getAllAnnapurnaApps();
    const headers = [
      'Customer ID', 'Customer Name', 'Mobile', 'Alt Mobile', 'Address / Village',
      'Reg Date', 'First Visit', 'Last Visit', 'Total Visits', 'Total Services',
      'Selected Services', 'Annapurna Apps'
    ];
    const rows = customers.map(c => {
      const analytics = getCustomerVisitAnalytics(c.id);
      const cApps = apps.filter(a => a.customerId === c.id);
      const addr = c.address || `${c.village || ''}, ${c.postOffice || ''}, ${c.district || ''} - ${c.pinCode || ''}`;
      return [
        c.id,
        c.name,
        c.phone,
        c.altPhone || '-',
        addr,
        formatDate(c.regDate),
        analytics.firstVisitDate ? formatDate(analytics.firstVisitDate) : '-',
        analytics.lastVisitDate ? formatDate(analytics.lastVisitDate) : '-',
        analytics.totalVisitCount,
        analytics.totalServicesProvided,
        (c.services || []).join('; ') || '-',
        cApps.length
      ];
    });
    return {
      title: 'Customer-wise Service & Visit Report',
      filename: `MUN_Customer_Wise_Report_${today}`,
      headers,
      rows
    };
  }

  if (['application', 'pending', 'verification', 'enquiry', 'holdup', 'payment_stopped', 'name_correction'].includes(reportType)) {
    let apps = filterAnnapurnaApplications(filters);
    let reportTitle = 'Annapurna Yojana Application Status Report';
    let reportSlug = 'Applications';

    if (reportType === 'pending') {
      apps = apps.filter(a => !isAppFinalClosed(a));
      reportTitle = 'Pending Applications Report';
      reportSlug = 'Pending_Applications';
    } else if (reportType === 'verification') {
      apps = apps.filter(a => (a.currentStatus || '').toLowerCase() === 'for further verification');
      reportTitle = 'For Further Verification Report';
      reportSlug = 'Further_Verification';
    } else if (reportType === 'enquiry') {
      apps = apps.filter(a => (a.currentStatus || '').toLowerCase() === 'under enquiry');
      reportTitle = 'Under Enquiry Applications Report';
      reportSlug = 'Under_Enquiry';
    } else if (reportType === 'holdup') {
      apps = apps.filter(a => ['hold up', 'application hold'].includes((a.currentStatus || '').toLowerCase()));
      reportTitle = 'Hold Up Applications Report';
      reportSlug = 'Hold_Up_Applications';
    } else if (reportType === 'payment_stopped') {
      apps = apps.filter(a =>
        (a.currentStatus || '').toLowerCase() === 'payment stopped' ||
        (a.problems || []).some(p => /payment stopped|payment failed|bank account/i.test(p.title || ''))
      );
      reportTitle = 'Payment Stopped & Bank Issue Report';
      reportSlug = 'Payment_Stopped';
    } else if (reportType === 'name_correction') {
      apps = apps.filter(a =>
        (a.problems || []).some(p => /name correction|name mismatch|data entry/i.test(p.title || '')) ||
        (a.complaints || []).some(c => /name correction/i.test(c.complaintType || ''))
      );
      reportTitle = 'Name Correction & Data Error Report';
      reportSlug = 'Name_Correction';
    }

    const headers = [
      'Application ID', 'Applicant Name', 'Mobile', 'Head of Family',
      'Ward No.', 'Village / Para', 'Block / Municipality',
      'EPIC / AC / Part / Sl', 'App Date',
      'Current Status', 'Tagged Problems (A-I)', 'Claims Count', 'Next Follow-up'
    ];
    const rows = apps.map(a => {
      const rw = resolveWardForApp(a);
      const wardDisplay = a.wardName || a.wardNumber || (rw ? formatWardLabel(rw) : a.gpOrWard) || '-';
      return [
        a.applicationId || '-',
        a.applicantName,
        a.customerPhone || '-',
        a.headOfFamily || '-',
        wardDisplay,
        a.village || '-',
        a.blockOrMunicipality || '-',
        `${a.voterIdEpic || '-'} (${a.assemblyConstituency || '-'} / P:${a.partNumber || '-'} / S:${a.serialNumber || '-'})`,
        formatDate(a.applicationDate),
        a.currentStatus,
        (a.problems || []).map(p => `[${p.categoryKey}] ${p.title} (${p.problemStatus})`).join('; ') || 'None',
        (a.complaints || []).length,
        a.nextFollowupDate ? formatDate(a.nextFollowupDate) : '-'
      ];
    });
    return {
      title: reportTitle,
      filename: `MUN_Annapurna_${reportSlug}_${today}`,
      headers,
      rows
    };
  }

  if (reportType === 'ward_wise') {
    const apps = filterAnnapurnaApplications(filters);
    const wardMap = new Map();
    apps.forEach(a => {
      const rw = resolveWardForApp(a);
      const wardLabel = a.wardNumber || a.wardName || (rw ? formatWardLabel(rw) : a.gpOrWard) || 'Unassigned Ward';
      if (!wardMap.has(wardLabel)) {
        wardMap.set(wardLabel, { total: 0, pending: 0, resolved: 0, rejected: 0, claims: 0, villages: new Set() });
      }
      const bucket = wardMap.get(wardLabel);
      bucket.total++;
      const st = (a.currentStatus || '').toLowerCase();
      if (['rejected', 'cancelled', 'not eligible', 'discontinued'].includes(st)) bucket.rejected++;
      else if (isAppFinalClosed(a)) bucket.resolved++;
      else bucket.pending++;
      bucket.claims += (a.complaints || []).length;
      if (a.village) bucket.villages.add(a.village);
    });
    const headers = ['Ward No.', 'Total Applications', 'Pending / In-Process', 'Approved / Resolved', 'Rejected', 'Total Claims', 'Villages / Paras Covered'];
    const rows = Array.from(wardMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([w, d]) => [w, d.total, d.pending, d.resolved, d.rejected, d.claims, Array.from(d.villages).join(', ') || '-']);
    return {
      title: 'Ward-wise Annapurna Applications Summary Report',
      filename: `MUN_Ward_Wise_Report_${today}`,
      headers,
      rows
    };
  }

  if (reportType === 'village_wise') {
    const apps = filterAnnapurnaApplications(filters);
    const vilMap = new Map();
    apps.forEach(a => {
      const rw = resolveWardForApp(a);
      const wardLabel = a.wardNumber || a.wardName || (rw ? formatWardLabel(rw) : a.gpOrWard) || 'Unassigned';
      const vilLabel = a.village || 'Unspecified Village / Para';
      const key = `${wardLabel}:::${vilLabel}`;
      if (!vilMap.has(key)) {
        vilMap.set(key, { wardLabel, vilLabel, total: 0, pending: 0, resolved: 0, rejected: 0, applicants: [] });
      }
      const b = vilMap.get(key);
      b.total++;
      const st = (a.currentStatus || '').toLowerCase();
      if (['rejected', 'cancelled', 'not eligible', 'discontinued'].includes(st)) b.rejected++;
      else if (isAppFinalClosed(a)) b.resolved++;
      else b.pending++;
      if (b.applicants.length < 8 && a.applicantName) b.applicants.push(a.applicantName);
    });
    const headers = ['Ward No.', 'Village / Locality / Para', 'Total Applications', 'Pending', 'Approved / Resolved', 'Rejected', 'Applicants (Sample)'];
    const rows = Array.from(vilMap.values())
      .sort((a, b) => a.wardLabel.localeCompare(b.wardLabel, undefined, { numeric: true }) || a.vilLabel.localeCompare(b.vilLabel))
      .map(d => [d.wardLabel, d.vilLabel, d.total, d.pending, d.resolved, d.rejected, d.applicants.join(', ') || '-']);
    return {
      title: 'Village / Locality-wise Annapurna Applications Report',
      filename: `MUN_Village_Wise_Report_${today}`,
      headers,
      rows
    };
  }

  if (reportType === 'complaint' || reportType === 'rti') {
    const apps = filterAnnapurnaApplications(filters);
    const isRtiOnly = reportType === 'rti';
    const headers = [
      'Claim ID', 'Application ID', 'Applicant Name', 'Mobile', 'Village / Block',
      'Claim Type', 'Submission Date', 'Status', 'Action Taken', 'Reply / Response', 'Next Follow-up'
    ];
    const rows = [];
    apps.forEach(a => {
      (a.complaints || []).forEach(cmp => {
        if (isRtiOnly && !/rti/i.test(cmp.complaintType || '')) return;
        rows.push([
          cmp.id,
          a.applicationId || a.id,
          a.applicantName,
          a.customerPhone || '-',
          [a.village, a.blockOrMunicipality].filter(Boolean).join(', ') || '-',
          cmp.complaintType,
          formatDate(cmp.submissionDate),
          cmp.status,
          cmp.actionTaken || '-',
          cmp.replyDetails || '-',
          cmp.nextFollowupDate ? formatDate(cmp.nextFollowupDate) : '-'
        ]);
      });
    });
    return {
      title: isRtiOnly ? 'RTI File & First Appeal Tracking Report' : 'Claim & Complaint Register Report',
      filename: isRtiOnly ? `MUN_RTI_File_Report_${today}` : `MUN_Complaint_History_Report_${today}`,
      headers,
      rows
    };
  }

  if (reportType === 'office') {
    const apps = filterAnnapurnaApplications(filters);
    const headers = [
      'Office / Block / Authority', 'Total Cases / Entries', 'Pending', 'Resolved / Approved', 'Applicant Names'
    ];
    const officeMap = {};
    apps.forEach(a => {
      const officeKeys = new Set();
      if (a.blockOrMunicipality) officeKeys.add(a.blockOrMunicipality);
      (a.followupTimeline || []).forEach(tl => {
        if (tl.office) officeKeys.add(tl.office);
      });
      (a.complaints || []).forEach(c => {
        if (/bdo/i.test(c.complaintType || '')) officeKeys.add('BDO Office');
        if (/sdo/i.test(c.complaintType || '')) officeKeys.add('SDO Office');
        if (/dm/i.test(c.complaintType || '')) officeKeys.add('DM Office');
        if (/cmo/i.test(c.complaintType || '')) officeKeys.add('CMO Grievance');
        if (/camp/i.test(c.complaintType || '')) officeKeys.add('Janakalyan Camp');
      });
      if (officeKeys.size === 0) officeKeys.add('Unassigned / General');
      officeKeys.forEach(off => {
        if (!officeMap[off]) officeMap[off] = { total: 0, pending: 0, resolved: 0, names: [] };
        officeMap[off].total++;
        if (isAppFinalClosed(a)) officeMap[off].resolved++;
        else officeMap[off].pending++;
        if (officeMap[off].names.length < 8) officeMap[off].names.push(a.applicantName);
      });
    });
    const rows = Object.entries(officeMap).map(([off, data]) => [
      off,
      data.total,
      data.pending,
      data.resolved,
      data.names.join(', ')
    ]);
    return {
      title: 'BDO / SDO / Office-wise Case Summary Report',
      filename: `MUN_Office_Wise_Report_${today}`,
      headers,
      rows
    };
  }

  if (reportType === 'monthly') {
    const apps = filterAnnapurnaApplications(filters);
    const monthMap = {};
    apps.forEach(a => {
      const m = (a.applicationDate || '').slice(0, 7) || 'Unknown';
      if (!monthMap[m]) monthMap[m] = { total: 0, approved: 0, rejected: 0, pending: 0, claims: 0 };
      monthMap[m].total++;
      const st = (a.currentStatus || '').toLowerCase();
      if (['approved', 'sanctioned', 'beneficiary selected', 'payment started', 'resolved'].includes(st)) monthMap[m].approved++;
      else if (['rejected', 'cancelled', 'not eligible', 'discontinued'].includes(st)) monthMap[m].rejected++;
      else monthMap[m].pending++;
      monthMap[m].claims += (a.complaints || []).length;
    });
    const headers = ['Month (YYYY-MM)', 'Total Applications', 'Approved / Resolved', 'Pending / In-Process', 'Rejected', 'Claims Logged'];
    const rows = Object.entries(monthMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([m, d]) => [m, d.total, d.approved, d.pending, d.rejected, d.claims]);
    return {
      title: 'Monthly Annapurna Application Summary Report',
      filename: `MUN_Monthly_Summary_Report_${today}`,
      headers,
      rows
    };
  }

  if (reportType === 'npci') {
    const apps = filterAnnapurnaApplications(filters);
    const headers = [
      'Application ID', 'Applicant Name', 'Mobile', 'Current App Status',
      'NPCI / DBT / Bank Problems', 'Problem Status', 'Remarks', 'Next Follow-up'
    ];
    const rows = [];
    apps.forEach(a => {
      const npciProbs = (a.problems || []).filter(
        p => p.categoryKey === 'B' || p.categoryKey === 'G' || /npci|dbt|bank|aadhaar/i.test(p.title)
      );
      if (npciProbs.length > 0) {
        npciProbs.forEach(p => {
          rows.push([
            a.applicationId || a.id,
            a.applicantName,
            a.customerPhone || '-',
            a.currentStatus,
            `[${p.categoryKey}] ${p.title}`,
            p.problemStatus,
            p.remarks || a.remarks || '-',
            a.nextFollowupDate ? formatDate(a.nextFollowupDate) : '-'
          ]);
        });
      }
    });
    return {
      title: 'NPCI / Bank DBT & Aadhaar Seeding Problem Report',
      filename: `MUN_NPCI_Problem_Report_${today}`,
      headers,
      rows
    };
  }

  // followup report
  const apps = filterAnnapurnaApplications(filters);
  const headers = [
    'Application ID', 'Applicant Name', 'Mobile', 'Current Status',
    'Follow-up Date', 'Activity', 'Office / Channel', 'Previous -> Updated Status',
    'Action Taken', 'Remarks', 'Next Target Date', 'State'
  ];
  const rows = [];
  apps.forEach(a => {
    const timeline = a.followupTimeline || [];
    timeline.forEach(tl => {
      rows.push([
        a.applicationId || a.id,
        a.applicantName,
        a.customerPhone || '-',
        a.currentStatus,
        formatDate(tl.date),
        tl.activity,
        [tl.office, tl.followupType].filter(Boolean).join(' · ') || '-',
        `${tl.previousStatus || '-'} -> ${tl.updatedStatus || '-'}`,
        tl.actionTaken || '-',
        tl.remarks || '-',
        tl.nextFollowupDate ? formatDate(tl.nextFollowupDate) : '-',
        tl.completed ? 'Completed' : 'Pending'
      ]);
    });
  });
  return {
    title: 'Chronological Follow-up & Reminder Report',
    filename: `MUN_Followup_Timeline_Report_${today}`,
    headers,
    rows
  };
}

export function exportAnnapurnaReport(reportType, format, filters = {}) {
  const dataset = buildReportDataset(reportType, filters);
  const { title, filename, headers, rows } = dataset;

  if (format === 'csv') {
    exportUniversalCSV({
      filename,
      title,
      subtitle: `Total Records: ${rows.length}`,
      headers,
      rows,
      totalsRow: ['TOTAL', `${rows.length} Records`, ...headers.slice(2).map(() => '')]
    });
    return { success: true, message: `${title} downloaded as CSV (UTF-8 BOM)` };
  }

  if (format === 'excel') {
    exportUniversalExcel({
      filename,
      sheetName: 'Annapurna_Report',
      title,
      subtitle: `Total Records: ${rows.length}`,
      headers,
      rows,
      totalsRow: ['TOTAL', `${rows.length} Records`, ...headers.slice(2).map(() => '')]
    });
    return { success: true, message: `${title} downloaded as Excel (.xlsx)` };
  }

  if (format === 'pdf') {
    exportUniversalPDF({
      filename,
      title,
      subtitle: `Total Rows: ${rows.length}`,
      orientation: 'landscape',
      headers,
      rows,
      totalsRow: ['TOTAL', `${rows.length} Records`, ...headers.slice(2).map(() => '-')]
    });
    return { success: true, message: `${title} downloaded as PDF` };
  }

  printUniversalReport({
    title,
    subtitle: `Total Rows: ${rows.length}`,
    filename,
    orientation: 'landscape',
    headers,
    rows,
    totalsRow: ['TOTAL', `${rows.length} Records`, ...headers.slice(2).map(() => '-')]
  });
  return { success: true, message: 'Opened in-app Print Preview' };
}
