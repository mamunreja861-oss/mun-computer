/**
 * followups.js - Advanced 90 Days Customer Follow-up & Application Management System
 * MUN COMPUTER BUSINESS MANAGER - Enterprise ERP
 *
 * Database-driven Dynamic Admin Control, Multi-Application Support per Customer,
 * Independent Day 0 Current Status History, Portal-Specific Grievances,
 * Smart 90-Day Scheduling & Reminders, and 11 Exportable Reports (PDF / Excel / Print).
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import {
  getItem,
  setItem,
  KEYS,
  allocateGlobalReference,
  markGlobalReferenceDeleted,
  getTodayDate,
  formatDate,
  formatDateTime,
  logAuditAction,
  getAuthHeaders
} from './storage.js';
import { getCustomerById, getAllCustomers } from './customers.js';
import { showA4PrintPdfPopup } from './a4PrintPopup.js';
import {
  renderBwDocumentHeader,
  renderAcknowledgementSection,
  drawBwPdfHeader,
  getBwAutoTableStyles,
  finalizeBwPdfPagination
} from './documentEngine.js';
import { exportUniversalCSV, exportUniversalExcel, exportUniversalPDF, printUniversalReport } from './exportUtility.js';

/* =========================================================================
   FALLBACK & METADATA CONSTANTS (Synced Dynamically From Backend Database)
   ========================================================================= */

export const ADMIN_OPTION_CATEGORIES = [
  { key: 'customer_type', label: 'Customer Types', description: 'Dynamic customer categories shown during Customer Registration' },
  { key: 'service_scheme', label: 'Services / Schemes', description: 'Dynamic multi-select services & schemes for applications' },
  { key: 'application_status', label: 'Application Statuses', description: 'Day 0 & live Current Status dropdown options' },
  { key: 'contact_method', label: 'Contact Methods', description: 'Follow-up contact channels (Phone Call, WhatsApp, Visit, etc.)' },
  { key: 'customer_response', label: 'Customer Responses', description: 'Standardized customer response options during follow-ups' },
  { key: 'action_taken', label: 'Actions Taken', description: 'Follow-up actions logged by staff' },
  { key: 'followup_result', label: 'Follow-up Results', description: 'Outcome result of a follow-up entry' },
  { key: 'pending_reason', label: 'Pending Reasons', description: 'Categorized pending / bottleneck reasons' },
  { key: 'case_priority', label: 'Case Priorities', description: 'Priority levels (Normal, Medium, High, Urgent, etc.)' },
  { key: 'grievance_portal', label: 'Grievance Portals', description: 'Portal channels (CMO, MLA, CPGRAMS, NPCI, Other, etc.)' },
  { key: 'customer_feedback', label: 'Customer Feedback', description: 'Feedback options collected from citizens' },
  { key: 'other_dropdown', label: 'Other Dropdowns', description: 'Additional configurable dropdown options for office workflows' }
];

const DEFAULT_ADMIN_OPTION_SEEDS = [
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
  { category: 'service_scheme', label: 'Gas Connection & LPG Service' },
  { category: 'service_scheme', label: 'Gas Accessories & Safety Kit' },
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

  // Pending Reasons
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

  // Case Priorities
  { category: 'case_priority', label: 'Normal', meta: { badge: 'neutral', weight: 1 } },
  { category: 'case_priority', label: 'Medium', meta: { badge: 'info', weight: 2 } },
  { category: 'case_priority', label: 'High', meta: { badge: 'warning', weight: 3 } },
  { category: 'case_priority', label: 'Urgent', meta: { badge: 'danger', weight: 4 } },

  // Grievance Portals
  { category: 'grievance_portal', label: 'CMO', meta: { fields: ['referenceNumber', 'date', 'status', 'remarks'] } },
  { category: 'grievance_portal', label: 'MLA', meta: { fields: ['referenceNumber', 'date', 'remarks'] } },
  { category: 'grievance_portal', label: 'CPGRAMS', meta: { fields: ['referenceNumber', 'department', 'atr', 'status'] } },
  { category: 'grievance_portal', label: 'NPCI', meta: { fields: ['aadhaarSeedingStatus', 'bankMapping', 'remarks'] } },
  { category: 'grievance_portal', label: 'Other', meta: { fields: ['customPortalName', 'referenceNumber', 'date', 'status', 'remarks'] } },

  // Customer Feedback
  { category: 'customer_feedback', label: 'Satisfied' },
  { category: 'customer_feedback', label: 'Partially Satisfied' },
  { category: 'customer_feedback', label: 'Not Satisfied' },
  { category: 'customer_feedback', label: 'No Response' }
];

const DEFAULT_FOLLOWUP_SCHEDULE_SEEDS = [
  { day: 0, title: 'Customer Registration', description: 'Initial application registration & Day 0 current status setup' },
  { day: 7, title: 'First Call', description: 'Verify receipt acknowledgement & check any missing documents' },
  { day: 15, title: 'Status Check', description: 'Portal status check & customer progress call' },
  { day: 30, title: 'Application Review', description: '30-day review of department processing & verification' },
  { day: 45, title: 'Department Follow-up', description: 'Follow up with concerned officer/portal if still pending' },
  { day: 60, title: 'Grievance Follow-up', description: 'Check grievance escalation or portal ATR response' },
  { day: 75, title: 'Final Review', description: 'Pre-90-day resolution check & benefit readiness check' },
  { day: 90, title: 'Final Case Review', description: '90-Day cycle review & closure / reopen assessment' }
];

// Backward-compatible exported constants / defaults
export const FOLLOWUP_REASONS = [
  'Application Status Check',
  'Document Reminder',
  'Verification Follow-up',
  'Payment Reminder',
  'Grievance / Escalation Check',
  'Customer Callback',
  'Service Delivery',
  '90-Day Cycle Review',
  'Other'
];

export const FOLLOWUP_STATUSES = [
  'Pending',
  'Today',
  'Overdue',
  'Contacted',
  'Waiting for Customer',
  'Rescheduled',
  'Completed',
  'Cancelled'
];

export const FOLLOWUP_CYCLE_DAYS = [0, 7, 15, 30, 45, 60, 75, 90];

export const FOLLOWUP_MILESTONE_LABELS = {
  0: 'Day 0 — Customer Registration',
  7: 'Day 7 — First Call',
  15: 'Day 15 — Status Check',
  30: 'Day 30 — Application Review',
  45: 'Day 45 — Department Follow-up',
  60: 'Day 60 — Grievance Follow-up',
  75: 'Day 75 — Final Review',
  90: 'Day 90 — Final Case Review'
};

export const FOLLOWUP_CASE_STATUSES = DEFAULT_ADMIN_OPTION_SEEDS
  .filter(o => o.category === 'application_status')
  .map(o => o.label);

export const FOLLOWUP_MODES = DEFAULT_ADMIN_OPTION_SEEDS
  .filter(o => o.category === 'contact_method')
  .map(o => o.label);

export const FINAL_CASE_STATUSES = new Set(['Closed']);

export function isFinalCaseStatus(status) {
  const st = String(status || '').trim();
  if (!st) return false;
  if (st.toLowerCase() === 'closed') return true;
  const opts = getAdminOptions('application_status', { activeOnly: false });
  const match = opts.find(o => String(o.label || '').toLowerCase() === st.toLowerCase());
  if (match && match.meta && typeof match.meta.isFinal === 'boolean') {
    return match.meta.isFinal;
  }
  return false;
}

/* =========================================================================
   DYNAMIC ADMIN OPTIONS & SCHEDULE STORE + SERVER SYNC
   ========================================================================= */

function ensureLocalSeedsPopulated() {
  let opts = getItem(KEYS.ADMIN_OPTIONS, []);
  if (!Array.isArray(opts) || opts.length === 0) {
    const nowIso = new Date().toISOString();
    const counters = {};
    opts = DEFAULT_ADMIN_OPTION_SEEDS.map((s, idx) => {
      counters[s.category] = (counters[s.category] || 0) + 1;
      return {
        id: `OPT-${s.category.toUpperCase()}-${String(counters[s.category]).padStart(3, '0')}`,
        category: s.category,
        label: s.label,
        sortOrder: idx + 1,
        isActive: true,
        isDeleted: false,
        isDefault: true,
        meta: s.meta || {},
        createdAt: nowIso,
        updatedAt: nowIso
      };
    });
    setItem(KEYS.ADMIN_OPTIONS, opts);
  }

  let sched = getItem(KEYS.FOLLOWUP_SCHEDULE, []);
  if (!Array.isArray(sched) || sched.length === 0) {
    const nowIso = new Date().toISOString();
    sched = DEFAULT_FOLLOWUP_SCHEDULE_SEEDS.map((m, idx) => ({
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
    }));
    setItem(KEYS.FOLLOWUP_SCHEDULE, sched);
  }
}

export function getAdminOptionCategories() {
  return ADMIN_OPTION_CATEGORIES;
}

export function getAdminOptions(category = '', { activeOnly = true } = {}) {
  ensureLocalSeedsPopulated();
  const list = getItem(KEYS.ADMIN_OPTIONS, []);
  return (Array.isArray(list) ? list : [])
    .filter(o => o && !o.isDeleted)
    .filter(o => !category || o.category === category)
    .filter(o => !activeOnly || o.isActive !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.label || '').localeCompare(String(b.label || '')));
}

/**
 * Returns array of option labels from dynamic DB.
 * Automatically preserves any `includeValues` (from historical deactivated/archived records)
 * so existing historical entries remain visible while remaining hidden from brand-new picks.
 */
export function getAdminOptionLabels(category, { activeOnly = true, includeValues = [] } = {}) {
  const labels = getAdminOptions(category, { activeOnly }).map(o => o.label);
  const set = new Set(labels);
  (Array.isArray(includeValues) ? includeValues : [includeValues]).forEach(v => {
    const clean = String(v || '').trim();
    if (clean && !set.has(clean)) {
      labels.push(clean);
      set.add(clean);
    }
  });
  return labels;
}

export function getFollowupScheduleTemplate({ activeOnly = true } = {}) {
  ensureLocalSeedsPopulated();
  const list = getItem(KEYS.FOLLOWUP_SCHEDULE, []);
  return (Array.isArray(list) ? list : [])
    .filter(s => s && !s.isDeleted)
    .filter(s => !activeOnly || s.isActive !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || Number(a.day) - Number(b.day));
}

export async function sync90DayBootstrapFromServer() {
  ensureLocalSeedsPopulated();
  try {
    const resp = await fetch('/api/90day/bootstrap', { headers: getAuthHeaders() });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.success) return null;

    if (Array.isArray(data.adminOptions) && data.adminOptions.length > 0) {
      const localOpts = getItem(KEYS.ADMIN_OPTIONS, []);
      const mergedMap = new Map();
      data.adminOptions.forEach(o => { if (o && o.id) mergedMap.set(o.id, o); });
      // Preserve any locally created custom entries & newly added categories so reload never loses them
      (Array.isArray(localOpts) ? localOpts : []).forEach(o => {
        if (!o || o.isDeleted) return;
        const exists = Array.from(mergedMap.values()).some(
          m => m.id === o.id || (m.category === o.category && String(m.label || '').toLowerCase() === String(o.label || '').toLowerCase())
        );
        if (!exists && (!o.isDefault || o.isLocalCustom)) {
          mergedMap.set(o.id, o);
        }
      });
      setItem(KEYS.ADMIN_OPTIONS, Array.from(mergedMap.values()));
    }
    if (Array.isArray(data.followupSchedules) && data.followupSchedules.length > 0) {
      setItem(KEYS.FOLLOWUP_SCHEDULE, data.followupSchedules);
    }
    if (Array.isArray(data.followupCases)) {
      const local = getAllFollowupCases();
      const map = new Map();
      data.followupCases.forEach(c => { if (c && c.id) map.set(c.id, c); });
      local.forEach(c => { if (c && c.id && !map.has(c.id)) map.set(c.id, c); });
      setItem(
        KEYS.FOLLOWUP_CASES,
        Array.from(map.values()).sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
      );
    }
    if (Array.isArray(data.statusHistory)) {
      setItem(KEYS.STATUS_HISTORY, data.statusHistory);
    }
    if (Array.isArray(data.followups)) {
      setItem(KEYS.FOLLOWUP_LEDGER, data.followups);
    }
    if (Array.isArray(data.grievances)) {
      setItem(KEYS.GRIEVANCES, data.grievances);
    }
    if (Array.isArray(data.reminders)) {
      const localRems = getAllReminders();
      const remMap = new Map();
      data.reminders.forEach(r => { if (r && r.id) remMap.set(r.id, r); });
      localRems.forEach(r => { if (r && r.id && !remMap.has(r.id)) remMap.set(r.id, r); });
      setItem(KEYS.REMINDERS, Array.from(remMap.values()));
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Local-first Dynamic Custom Status & Category Management (permanently persisted in localStorage
 * and optionally synced to backend without failing if offline or non-admin).
 */
export async function saveCustomAdminOptionLocal(category, label, meta = {}) {
  ensureLocalSeedsPopulated();
  const cleanCat = String(category || '').trim();
  const cleanLabel = String(label || '').trim();
  if (!cleanCat || !cleanLabel) {
    return { success: false, message: 'Category and label are required.' };
  }

  const list = getItem(KEYS.ADMIN_OPTIONS, []);
  const dup = list.find(
    o => !o.isDeleted && o.category === cleanCat && String(o.label || '').toLowerCase() === cleanLabel.toLowerCase()
  );
  if (dup) {
    return { success: false, message: `"${cleanLabel}" already exists.` };
  }

  const nowIso = new Date().toISOString();
  const entryId = await allocateGlobalReference('FLW', { entityType: 'ADMIN_OPTION' });
  const entry = {
    id: entryId,
    category: cleanCat,
    label: cleanLabel,
    sortOrder: list.filter(o => o.category === cleanCat).length + 1,
    isActive: true,
    isDeleted: false,
    isDefault: false,
    isLocalCustom: true,
    meta: meta || {},
    createdAt: nowIso,
    updatedAt: nowIso
  };

  list.push(entry);
  setItem(KEYS.ADMIN_OPTIONS, list);
  logAuditAction('DYNAMIC_OPTION_ADD', `Added custom ${cleanCat}: "${cleanLabel}" (${entry.id})`);

  // Best-effort background sync
  fetch('/api/admin-options', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id: entry.id, category: cleanCat, label: cleanLabel, meta })
  }).catch(() => {});

  return { success: true, option: entry };
}

export function deleteCustomAdminOptionLocal(idOrLabel, category = '') {
  ensureLocalSeedsPopulated();
  const list = getItem(KEYS.ADMIN_OPTIONS, []);
  const key = String(idOrLabel || '').trim();
  const target = list.find(o =>
    !o.isDeleted &&
    (o.id === key || (!category || o.category === category) && String(o.label || '').toLowerCase() === key.toLowerCase())
  );
  if (!target) {
    return { success: false, message: 'Custom entry not found.' };
  }
  if (target.isDefault) {
    return { success: false, message: `Default system entry "${target.label}" cannot be deleted.` };
  }

  const next = list.filter(o => o.id !== target.id);
  setItem(KEYS.ADMIN_OPTIONS, next);
  markGlobalReferenceDeleted(target.id);
  logAuditAction('DYNAMIC_OPTION_DELETE', `Deleted custom ${target.category}: "${target.label}"`);

  fetch(`/api/admin-options/${encodeURIComponent(target.id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  }).catch(() => {});

  return { success: true, deleted: target };
}

export async function saveAdminOptionApi(input = {}) {
  try {
    const resp = await fetch('/api/admin-options', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input)
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return { success: false, message: data.message || 'Failed to save option.' };
    }
    await sync90DayBootstrapFromServer();
    return data;
  } catch (err) {
    return { success: false, message: err?.message || 'Network error saving option.' };
  }
}

export async function toggleAdminOptionApi(id) {
  try {
    const resp = await fetch(`/api/admin-options/${encodeURIComponent(id)}/toggle`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return { success: false, message: data.message || 'Failed to update status.' };
    }
    await sync90DayBootstrapFromServer();
    return data;
  } catch (err) {
    return { success: false, message: err?.message || 'Network error toggling option.' };
  }
}

export async function deleteAdminOptionApi(id) {
  try {
    const resp = await fetch(`/api/admin-options/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return { success: false, message: data.message || 'Failed to delete option.' };
    }
    await sync90DayBootstrapFromServer();
    return data;
  } catch (err) {
    return { success: false, message: err?.message || 'Network error deleting option.' };
  }
}

export async function restoreDefaultAdminOptionsApi(category = '') {
  try {
    const resp = await fetch('/api/admin-options/restore-defaults', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(category ? { category } : {})
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return { success: false, message: data.message || 'Failed to restore defaults.' };
    }
    await sync90DayBootstrapFromServer();
    return data;
  } catch (err) {
    return { success: false, message: err?.message || 'Network error restoring defaults.' };
  }
}

/**
 * Authorized staff / manager / admin can add a new Current Status directly from status dropdowns.
 */
export async function addInlineApplicationStatusApi(label) {
  const clean = String(label || '').trim();
  if (!clean) return { success: false, message: 'Status label is required.' };
  try {
    const resp = await fetch('/api/admin-options/inline-status', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ label: clean })
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return { success: false, message: data.message || 'Could not add status.' };
    }
    if (data.option) {
      const list = getItem(KEYS.ADMIN_OPTIONS, []);
      const idx = list.findIndex(o => o.id === data.option.id || (o.category === 'application_status' && o.label.toLowerCase() === clean.toLowerCase()));
      if (idx !== -1) list[idx] = data.option;
      else list.push(data.option);
      setItem(KEYS.ADMIN_OPTIONS, list);
    }
    return { success: true, option: data.option, label: clean };
  } catch (err) {
    return { success: false, message: err?.message || 'Network error adding status.' };
  }
}

export async function saveScheduleMilestoneApi(input = {}) {
  try {
    const resp = await fetch('/api/followup-schedule', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input)
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return { success: false, message: data.message || 'Failed to save milestone.' };
    }
    await sync90DayBootstrapFromServer();
    return data;
  } catch (err) {
    return { success: false, message: err?.message || 'Network error saving milestone.' };
  }
}

export async function toggleScheduleMilestoneApi(id) {
  try {
    const resp = await fetch(`/api/followup-schedule/${encodeURIComponent(id)}/toggle`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return { success: false, message: data.message || 'Failed to toggle milestone.' };
    }
    await sync90DayBootstrapFromServer();
    return data;
  } catch (err) {
    return { success: false, message: err?.message || 'Network error toggling milestone.' };
  }
}

export async function reorderScheduleApi(orderedIds = []) {
  try {
    const resp = await fetch('/api/followup-schedule/reorder', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ orderedIds })
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return { success: false, message: data.message || 'Failed to reorder schedule.' };
    }
    await sync90DayBootstrapFromServer();
    return data;
  } catch (err) {
    return { success: false, message: err?.message || 'Network error reordering schedule.' };
  }
}

export async function deleteScheduleMilestoneApi(id) {
  try {
    const resp = await fetch(`/api/followup-schedule/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return { success: false, message: data.message || 'Failed to delete milestone.' };
    }
    await sync90DayBootstrapFromServer();
    return data;
  } catch (err) {
    return { success: false, message: err?.message || 'Network error deleting milestone.' };
  }
}

export async function restoreDefaultScheduleApi() {
  try {
    const resp = await fetch('/api/followup-schedule/restore-defaults', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return { success: false, message: data.message || 'Failed to restore schedule.' };
    }
    await sync90DayBootstrapFromServer();
    return data;
  } catch (err) {
    return { success: false, message: err?.message || 'Network error restoring schedule.' };
  }
}

/* =========================================================================
   DATE & 90-DAY CYCLE HELPERS (DB-Driven Schedule Calculation)
   ========================================================================= */

export function addDaysToIsoDate(isoDate, days) {
  const base = (isoDate || getTodayDate()).slice(0, 10);
  const parts = base.split('-').map(n => parseInt(n, 10));
  const dt = (parts.length === 3 && !parts.some(isNaN))
    ? new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
    : new Date();
  dt.setUTCDate(dt.getUTCDate() + (Number(days) || 0));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysBetweenDates(startIso, endIso) {
  const s = (startIso || getTodayDate()).slice(0, 10).split('-').map(Number);
  const e = (endIso || getTodayDate()).slice(0, 10).split('-').map(Number);
  if (s.length !== 3 || e.length !== 3 || s.some(isNaN) || e.some(isNaN)) return 0;
  const t1 = Date.UTC(s[0], s[1] - 1, s[2]);
  const t2 = Date.UTC(e[0], e[1] - 1, e[2]);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

export function buildDefault90DaySchedule(startDate = getTodayDate(), markDay0Completed = true) {
  const start = (startDate || getTodayDate()).slice(0, 10);
  const template = getFollowupScheduleTemplate({ activeOnly: true });
  return template.map(m => {
    const day = Number(m.day) || 0;
    const isDay0 = day === 0;
    return {
      id: m.id,
      day,
      title: m.title,
      label: `Day ${day} — ${m.title}`,
      description: m.description || '',
      scheduledDate: addDaysToIsoDate(start, day),
      completed: isDay0 ? Boolean(markDay0Completed) : false,
      completedDate: isDay0 && markDay0Completed ? start : '',
      completedNote: isDay0 && markDay0Completed ? 'Application registered & status initialized.' : '',
      reminderEnabled: true
    };
  });
}

function resolveNextPendingMilestone(schedule = [], explicitNextDate = '') {
  const pending = (schedule || [])
    .filter(m => !m.completed && Number(m.day) > 0)
    .sort((a, b) => Number(a.day) - Number(b.day));
  if (explicitNextDate) {
    return {
      nextDate: explicitNextDate.slice(0, 10),
      nextDay: pending[0]?.day ?? (schedule[schedule.length - 1]?.day ?? 90)
    };
  }
  if (pending.length > 0) {
    return {
      nextDate: pending[0].scheduledDate,
      nextDay: pending[0].day
    };
  }
  return {
    nextDate: '',
    nextDay: schedule[schedule.length - 1]?.day ?? 90
  };
}

/* =========================================================================
   90-DAY APPLICATION CASES: MULTI-APPLICATION & SERVER SYNC
   ========================================================================= */

export function getAllFollowupCases() {
  const list = getItem(KEYS.FOLLOWUP_CASES, []);
  return Array.isArray(list) ? list : [];
}

export function getFollowupCaseById(caseId) {
  if (!caseId) return null;
  return getAllFollowupCases().find(c => c.id === caseId || c.applicationId === caseId) || null;
}

export function getFollowupCaseByCustomerId(customerId) {
  if (!customerId) return null;
  return getAllFollowupCases().find(c => c.customerId === customerId) || null;
}

export function getFollowupCasesByCustomerId(customerId) {
  if (!customerId) return [];
  return getAllFollowupCases()
    .filter(c => c.customerId === customerId)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

export function getAllStatusHistory() {
  const list = getItem(KEYS.STATUS_HISTORY, []);
  return Array.isArray(list) ? list : [];
}

export function getStatusHistoryForCase(caseIdOrAppId) {
  if (!caseIdOrAppId) return [];
  return getAllStatusHistory()
    .filter(h => h.caseId === caseIdOrAppId || h.applicationId === caseIdOrAppId)
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
}

export function getAllFollowupLedger() {
  const list = getItem(KEYS.FOLLOWUP_LEDGER, []);
  return Array.isArray(list) ? list : [];
}

export function getAllGrievances() {
  const list = getItem(KEYS.GRIEVANCES, []);
  return Array.isArray(list) ? list : [];
}

export const REMINDER_TYPES = [
  'Product Seminar',
  'Gas Delivery',
  'Promotional Check-in',
  'Customer Follow-up'
];

export function getAllReminders() {
  const list = getItem(KEYS.REMINDERS, []);
  return Array.isArray(list) ? list : [];
}

function getLocalNowParts() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}`, ts: now.getTime() };
}

export function getSmartReminders({ filter = 'all', customerId = '', type = 'all', query = '' } = {}) {
  const now = getLocalNowParts();
  const nowKey = `${now.date} ${now.time}`;
  const cleanCust = String(customerId || '').trim();
  const q = String(query || '').trim().toLowerCase();

  const enriched = getAllReminders()
    .filter(r => r && r.enabled !== false)
    .map(r => {
      const rDate = String(r.reminderDate || getTodayDate()).slice(0, 10);
      const rTime = String(r.reminderTime || '10:00').slice(0, 5);
      const isCompleted = r.status === 'Completed' || r.status === 'COMPLETED';
      const dueKey = `${rDate} ${rTime}`;
      const isOverdue = !isCompleted && dueKey < nowKey;
      const isDueNowOrToday = !isCompleted && rDate === now.date && dueKey >= nowKey;
      const isUpcoming = !isCompleted && dueKey > nowKey;
      const bucket = isCompleted ? 'completed' : isOverdue ? 'overdue' : isUpcoming ? 'upcoming' : 'pending';
      return {
        ...r,
        reminderType: r.reminderType || (r.caseId ? 'Customer Follow-up' : 'Promotional Check-in'),
        reminderDate: rDate,
        reminderTime: rTime,
        title: r.title || r.seminarTag || r.note || r.reminderType || 'Reminder',
        isCompleted,
        isOverdue,
        isDueNowOrToday,
        isUpcoming,
        bucket,
        dueKey
      };
    });

  return enriched
    .filter(r => !cleanCust || r.customerId === cleanCust)
    .filter(r => type === 'all' || r.reminderType === type)
    .filter(r => {
      if (filter === 'all') return true;
      if (filter === 'pending') return !r.isCompleted;
      if (filter === 'overdue') return r.isOverdue;
      if (filter === 'upcoming') return r.isUpcoming;
      if (filter === 'completed') return r.isCompleted;
      return true;
    })
    .filter(r => {
      if (!q) return true;
      return [r.customerName, r.phone, r.title, r.seminarTag, r.reminderType, r.note, r.applicationId]
        .some(v => String(v || '').toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return a.dueKey.localeCompare(b.dueKey);
    });
}

export function getRemindersForCustomer(customerId) {
  if (!customerId) return [];
  return getSmartReminders({ customerId });
}

export async function saveSmartReminder(input = {}) {
  const list = getAllReminders();
  const nowIso = new Date().toISOString();
  const user = getItem(KEYS.CURRENT_USER, null);
  const cust = input.customerId ? getCustomerById(input.customerId) : null;

  const rDate = String(input.reminderDate || getTodayDate()).slice(0, 10);
  const rTime = String(input.reminderTime || '10:00').slice(0, 5);
  const rType = REMINDER_TYPES.includes(input.reminderType) ? input.reminderType : (input.reminderType || 'Product Seminar');
  const title = String(input.title || input.seminarTag || '').trim() || `${rType} Reminder`;

  const existingIdx = input.id ? list.findIndex(r => r.id === input.id) : -1;
  const reminderId = existingIdx !== -1
    ? list[existingIdx].id
    : await allocateGlobalReference('REM', { entityType: 'REMINDER' });
  const payload = {
    ...(existingIdx !== -1 ? list[existingIdx] : {}),
    id: reminderId,
    reminderType: rType,
    title,
    seminarTag: String(input.seminarTag || (rType === 'Product Seminar' ? title : '')).trim(),
    customerId: input.customerId || cust?.id || '',
    customerName: String(input.customerName || cust?.name || 'Customer').trim(),
    phone: String(input.phone || cust?.phone || '').trim(),
    caseId: input.caseId || '',
    applicationId: input.applicationId || cust?.applicationId || '',
    reminderDate: rDate,
    reminderTime: rTime,
    note: String(input.note || input.notes || title).trim(),
    status: input.status === 'Completed' ? 'Completed' : 'Pending',
    enabled: input.enabled !== false,
    notifiedAt: existingIdx !== -1 && input.reminderDate === list[existingIdx].reminderDate && input.reminderTime === list[existingIdx].reminderTime
      ? list[existingIdx].notifiedAt
      : '',
    assignedStaff: input.assignedStaff || user?.uid || 'MC-ADM-14012025',
    createdBy: existingIdx !== -1 ? (list[existingIdx].createdBy || user?.name || 'Staff') : (user?.name || 'Staff'),
    createdAt: existingIdx !== -1 ? (list[existingIdx].createdAt || nowIso) : nowIso,
    updatedAt: nowIso
  };

  if (existingIdx !== -1) list[existingIdx] = payload;
  else list.unshift(payload);
  setItem(KEYS.REMINDERS, list);
  logAuditAction('SMART_REMINDER_SAVE', `${rType} reminder (${payload.id}) for ${payload.customerName} on ${rDate} ${rTime}`);
  return { success: true, reminder: payload };
}

export function toggleCompleteSmartReminder(id, markCompleted = true) {
  const list = getAllReminders();
  const idx = list.findIndex(r => r.id === id);
  if (idx === -1) return { success: false, message: 'Reminder not found.' };
  const nowIso = new Date().toISOString();
  list[idx] = {
    ...list[idx],
    status: markCompleted ? 'Completed' : 'Pending',
    completedAt: markCompleted ? nowIso : '',
    updatedAt: nowIso
  };
  setItem(KEYS.REMINDERS, list);
  logAuditAction('SMART_REMINDER_STATUS', `Marked reminder ${id} as ${list[idx].status}`);
  return { success: true, reminder: list[idx] };
}

export function deleteSmartReminder(id) {
  const list = getAllReminders();
  const next = list.filter(r => r.id !== id);
  setItem(KEYS.REMINDERS, next);
  markGlobalReferenceDeleted(id);
  logAuditAction('SMART_REMINDER_DELETE', `Deleted reminder ${id}`);
  return { success: true };
}

function pushCaseToServer(caseRecord) {
  fetch('/api/followup-cases', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(caseRecord)
  }).catch(() => {});
}

export async function syncFollowupCasesFromServer() {
  await sync90DayBootstrapFromServer();
  return getAllFollowupCases();
}

/**
 * Create or update a 90-Day Application Case Profile.
 * Supports Multiple Applications per Customer when `forceNew: true` or distinct `applicationId` is passed.
 */
export async function createOrSyncFollowupCase(input = {}) {
  const cases = getAllFollowupCases();
  const user = getItem(KEYS.CURRENT_USER, null);
  const actorName = user?.name || user?.uid || 'Staff';
  const actorUid = user?.uid || user?.id || 'MC-ADM-14012025';
  const today = getTodayDate();
  const nowIso = new Date().toISOString();

  const linkedCustomer = input.customerId ? getCustomerById(input.customerId) : null;
  const startDate = (input.startDate || linkedCustomer?.regDate || today).slice(0, 10);

  if (input.forceNew && input.applicationId) {
    const dupApp = cases.find(c =>
      String(c.applicationId || '').trim().toLowerCase() === String(input.applicationId || '').trim().toLowerCase()
    );
    if (dupApp) {
      return {
        success: false,
        duplicateApplicationId: true,
        message: `Application ID "${input.applicationId}" already exists for ${dupApp.customerName}.`
      };
    }
  }

  let existingIdx = -1;
  if (input.id) {
    existingIdx = cases.findIndex(c => c.id === input.id);
  } else if (!input.forceNew && input.applicationId) {
    existingIdx = cases.findIndex(c => c.applicationId === input.applicationId);
  } else if (!input.forceNew && input.customerId) {
    existingIdx = cases.findIndex(c => c.customerId === input.customerId);
  }

  if (existingIdx !== -1) {
    const prev = cases[existingIdx];
    const schedule = Array.isArray(input.schedule) && input.schedule.length
      ? input.schedule
      : (Array.isArray(prev.schedule) && prev.schedule.length ? prev.schedule : buildDefault90DaySchedule(prev.startDate || startDate));
    const nextStatus = input.currentStatus || prev.currentStatus || 'Submitted';
    const nextMeta = resolveNextPendingMilestone(schedule, input.nextFollowupDate || prev.nextFollowupDate);
    const isNowClosed = isFinalCaseStatus(nextStatus);
    const resolvedAppId = input.applicationId || prev.applicationId || linkedCustomer?.applicationId || (await allocateGlobalReference('CASE', { entityType: 'CASE' }));

    const updated = {
      ...prev,
      customerId: input.customerId || prev.customerId || '',
      customerName: input.customerName || linkedCustomer?.name || prev.customerName || '',
      phone: input.phone || linkedCustomer?.phone || prev.phone || '',
      altPhone: input.altPhone !== undefined ? input.altPhone : (linkedCustomer?.altPhone || prev.altPhone || ''),
      address: input.address !== undefined ? input.address : (linkedCustomer?.address || prev.address || ''),
      customerType: input.customerType || prev.customerType || linkedCustomer?.category || 'General Public',
      applicationId: resolvedAppId,
      schemeName: input.schemeName || prev.schemeName || linkedCustomer?.schemeName || 'General Digital Service',
      services: Array.isArray(input.services) && input.services.length ? input.services : (prev.services || [input.schemeName || prev.schemeName].filter(Boolean)),
      priority: input.priority || prev.priority || 'Normal',
      pendingReason: input.pendingReason !== undefined ? input.pendingReason : (prev.pendingReason || ''),
      villageOrWard: input.villageOrWard || prev.villageOrWard || linkedCustomer?.villageOrWard || linkedCustomer?.village || '',
      currentStatus: nextStatus,
      assignedStaff: input.assignedStaff || prev.assignedStaff || linkedCustomer?.assignedStaff || actorUid,
      assignedStaffName: input.assignedStaffName || prev.assignedStaffName || '',
      startDate: prev.startDate || startDate,
      endDate: addDaysToIsoDate(prev.startDate || startDate, 90),
      schedule,
      nextFollowupDate: isNowClosed ? '' : nextMeta.nextDate,
      nextMilestoneDay: nextMeta.nextDay,
      remarks: input.remarks !== undefined ? input.remarks : prev.remarks,
      cycleCompleted: isNowClosed,
      updatedAt: nowIso,
      updatedBy: actorName
    };

    cases[existingIdx] = updated;
    setItem(KEYS.FOLLOWUP_CASES, cases);
    pushCaseToServer(updated);
    return { success: true, caseRecord: updated, isNew: false };
  }

  const schedule = Array.isArray(input.schedule) && input.schedule.length
    ? input.schedule
    : buildDefault90DaySchedule(startDate, true);

  const initialStatus = String(input.currentStatus || linkedCustomer?.currentStatus || 'Submitted').trim() || 'Submitted';
  const caseId = input.id || (await allocateGlobalReference('CASE', { entityType: 'CASE' }));
  const applicationId = String(input.applicationId || caseId).trim();
  const nextMeta = resolveNextPendingMilestone(schedule, input.nextFollowupDate);
  const schemeName = input.schemeName || (Array.isArray(input.services) && input.services[0]) || linkedCustomer?.schemeName || 'General Digital Service';
  const servicesList = Array.isArray(input.services) && input.services.length ? input.services : [schemeName].filter(Boolean);
  const isInitClosed = isFinalCaseStatus(initialStatus);
  const initialTlId = await allocateGlobalReference('TL', { entityType: 'TIMELINE', entityId: caseId });

  const initialTimelineEntry = {
    id: initialTlId,
    entryNo: 1,
    date: startDate,
    timestamp: nowIso,
    cycleDay: 0,
    milestoneLabel: schedule[0]?.label || 'Day 0 — Customer Registration',
    followupMode: input.followupMode || 'Counter Visit',
    previousStatus: 'New / Registered',
    newStatus: initialStatus,
    note: input.initialNote || input.remarks || `Application ${applicationId} registered (${schemeName}). Current Status: ${initialStatus}.`,
    nextAction: nextMeta.nextDate ? `Day ${nextMeta.nextDay} Follow-up on ${formatDate(nextMeta.nextDate)}` : '',
    nextFollowupDate: nextMeta.nextDate,
    assignedStaff: input.assignedStaff || linkedCustomer?.assignedStaff || actorUid,
    recordedBy: actorName
  };

  const newCase = {
    id: caseId,
    applicationId,
    customerId: input.customerId || linkedCustomer?.id || '',
    customerName: input.customerName || linkedCustomer?.name || 'Customer',
    phone: input.phone || linkedCustomer?.phone || '',
    altPhone: input.altPhone || linkedCustomer?.altPhone || '',
    address: input.address || linkedCustomer?.address || '',
    customerType: input.customerType || linkedCustomer?.category || 'General Public',
    schemeName,
    services: servicesList,
    priority: input.priority || 'Normal',
    pendingReason: input.pendingReason || '',
    villageOrWard: input.villageOrWard || linkedCustomer?.villageOrWard || linkedCustomer?.village || '',
    currentStatus: initialStatus,
    assignedStaff: input.assignedStaff || linkedCustomer?.assignedStaff || actorUid,
    assignedStaffName: input.assignedStaffName || '',
    startDate,
    endDate: addDaysToIsoDate(startDate, 90),
    schedule,
    nextFollowupDate: isInitClosed ? '' : nextMeta.nextDate,
    nextMilestoneDay: nextMeta.nextDay,
    timeline: [initialTimelineEntry],
    grievances: Array.isArray(input.grievances) ? input.grievances : [],
    cycleCompleted: isInitClosed,
    completedAt: isInitClosed ? nowIso : '',
    remarks: input.remarks || '',
    createdBy: actorName,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  cases.unshift(newCase);
  setItem(KEYS.FOLLOWUP_CASES, cases);

  // Record initial registration entry in Status History
  const hist = getAllStatusHistory();
  const timeStr = new Date().toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit' });
  const sthId = await allocateGlobalReference('TL', { entityType: 'STATUS_HISTORY', entityId: newCase.id });
  hist.unshift({
    id: sthId,
    applicationId: newCase.applicationId,
    caseId: newCase.id,
    customerId: newCase.customerId,
    customerName: newCase.customerName,
    previousStatus: 'New / Registered',
    newStatus: initialStatus,
    date: startDate,
    time: timeStr,
    updatedBy: actorName,
    updatedByUid: actorUid,
    remarks: input.remarks || `Initial registration status set to ${initialStatus}`,
    timestamp: nowIso
  });
  setItem(KEYS.STATUS_HISTORY, hist);

  pushCaseToServer(newCase);
  logAuditAction('CASE_90D_CREATE', `Initialized 90-Day Case ${newCase.applicationId} for ${newCase.customerName} (${newCase.schemeName})`);
  return { success: true, caseRecord: newCase, isNew: true };
}

export async function ensureFollowupCaseForCustomer(customer) {
  if (!customer || !customer.id) return null;
  const existing = getFollowupCaseByCustomerId(customer.id);
  if (existing) {
    return existing;
  }
  const appId = customer.applicationId || (await allocateGlobalReference('CASE', { entityType: 'CASE', entityId: customer.id }));
  const res = await createOrSyncFollowupCase({
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    altPhone: customer.altPhone || '',
    address: customer.address || '',
    customerType: customer.category || 'General Public',
    applicationId: appId,
    schemeName: customer.schemeName || (customer.services?.[0]) || 'General Digital Service',
    services: Array.isArray(customer.services) && customer.services.length ? customer.services : [customer.schemeName].filter(Boolean),
    villageOrWard: customer.villageOrWard || customer.village || '',
    currentStatus: customer.currentStatus || 'Submitted',
    assignedStaff: customer.assignedStaff || customer.assignedStaffUid || 'MC-ADM-14012025',
    startDate: customer.regDate || getTodayDate()
  });
  return res.caseRecord || null;
}

/* =========================================================================
   INDEPENDENT DAY 0+ CURRENT STATUS MANAGEMENT, REOPEN & RESCHEDULE
   ========================================================================= */

/**
 * Updates Application Current Status INDEPENDENTLY of the 90-day schedule milestones.
 * Every update records Previous Status, New Status, Date, Time, Updated By & Remarks.
 */
export async function updateCaseCurrentStatus(caseId, { newStatus, remarks = '', addNewStatusIfMissing = false } = {}) {
  const cleanStatus = String(newStatus || '').trim();
  if (!cleanStatus) return { success: false, message: 'New status cannot be empty.' };

  const cases = getAllFollowupCases();
  const idx = cases.findIndex(c => c.id === caseId || c.applicationId === caseId);
  if (idx === -1) return { success: false, message: 'Application case not found.' };

  if (addNewStatusIfMissing) {
    const existingOpts = getAdminOptions('application_status', { activeOnly: false });
    if (!existingOpts.some(o => o.label.toLowerCase() === cleanStatus.toLowerCase())) {
      await addInlineApplicationStatusApi(cleanStatus);
    }
  }

  const prev = cases[idx];
  const user = getItem(KEYS.CURRENT_USER, null);
  const actorName = user?.name || user?.uid || 'Staff';
  const actorUid = user?.uid || user?.id || 'MC-ADM-14012025';
  const today = getTodayDate();
  const now = new Date();
  const nowIso = now.toISOString();
  const timeStr = now.toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit' });
  const prevStatus = prev.currentStatus || 'Submitted';

  const statusEntryId = await allocateGlobalReference('TL', { entityType: 'STATUS_HISTORY', entityId: prev.id });
  const statusEntry = {
    id: statusEntryId,
    applicationId: prev.applicationId,
    caseId: prev.id,
    customerId: prev.customerId || '',
    customerName: prev.customerName || '',
    previousStatus: prevStatus,
    newStatus: cleanStatus,
    date: today,
    time: timeStr,
    updatedBy: actorName,
    updatedByUid: actorUid,
    remarks: String(remarks || '').trim() || `Status updated from "${prevStatus}" to "${cleanStatus}"`,
    timestamp: nowIso
  };

  const hist = getAllStatusHistory();
  hist.unshift(statusEntry);
  setItem(KEYS.STATUS_HISTORY, hist);

  const tlId = await allocateGlobalReference('TL', { entityType: 'TIMELINE', entityId: prev.id });
  const tl = Array.isArray(prev.timeline) ? [...prev.timeline] : [];
  tl.push({
    id: tlId,
    entryNo: tl.length + 1,
    date: today,
    timestamp: nowIso,
    cycleDay: Math.max(0, daysBetweenDates(prev.startDate || today, today)),
    milestoneLabel: 'Status Update (Independent)',
    followupMode: 'System Update',
    previousStatus: prevStatus,
    newStatus: cleanStatus,
    note: statusEntry.remarks,
    nextAction: '',
    nextFollowupDate: prev.nextFollowupDate || '',
    assignedStaff: prev.assignedStaff,
    recordedBy: actorName
  });

  const isClosed = isFinalCaseStatus(cleanStatus);
  const updatedCase = {
    ...prev,
    currentStatus: cleanStatus,
    cycleCompleted: isClosed ? true : prev.cycleCompleted,
    completedAt: isClosed ? (prev.completedAt || nowIso) : prev.completedAt,
    timeline: tl,
    updatedAt: nowIso,
    updatedBy: actorName
  };
  cases[idx] = updatedCase;
  setItem(KEYS.FOLLOWUP_CASES, cases);

  // Sync linked Customer Profile currentStatus
  if (prev.customerId) {
    const customers = getAllCustomers();
    const cIdx = customers.findIndex(c => c.id === prev.customerId);
    if (cIdx !== -1) {
      customers[cIdx] = { ...customers[cIdx], currentStatus: cleanStatus, updatedAt: nowIso };
      setItem(KEYS.CUSTOMERS, customers);
    }
  }

  try {
    await fetch(`/api/followup-cases/${encodeURIComponent(prev.id)}/status`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ newStatus: cleanStatus, remarks: statusEntry.remarks, addNewStatusIfMissing })
    });
  } catch { /* fallback synced */ }

  logAuditAction('CASE_STATUS_UPDATE', `${prev.applicationId} status: ${prevStatus} -> ${cleanStatus}`);
  return { success: true, caseRecord: updatedCase, statusEntry };
}

export async function reopenFollowupCase(caseId, reason = '') {
  const cases = getAllFollowupCases();
  const idx = cases.findIndex(c => c.id === caseId || c.applicationId === caseId);
  if (idx === -1) return { success: false, message: 'Case not found.' };

  const prev = cases[idx];
  const user = getItem(KEYS.CURRENT_USER, null);
  const actorName = user?.name || user?.uid || 'Staff';
  const today = getTodayDate();
  const nowIso = new Date().toISOString();
  const nextMeta = resolveNextPendingMilestone(prev.schedule || [], '');
  const nextFollowupDate = nextMeta.nextDate || addDaysToIsoDate(today, 7);

  const tlId = await allocateGlobalReference('TL', { entityType: 'TIMELINE', entityId: prev.id });
  const tl = Array.isArray(prev.timeline) ? [...prev.timeline] : [];
  tl.push({
    id: tlId,
    entryNo: tl.length + 1,
    date: today,
    timestamp: nowIso,
    cycleDay: Math.max(0, daysBetweenDates(prev.startDate || today, today)),
    milestoneLabel: 'Case Reopened',
    followupMode: 'Counter Review',
    previousStatus: prev.currentStatus,
    newStatus: 'Under Verification',
    note: String(reason || '').trim() || 'Application case reopened for active follow-up.',
    nextAction: 'Resume follow-up checks',
    nextFollowupDate,
    assignedStaff: prev.assignedStaff,
    recordedBy: actorName
  });

  const reopened = {
    ...prev,
    currentStatus: prev.currentStatus === 'Closed' ? 'Under Verification' : prev.currentStatus,
    cycleCompleted: false,
    completedAt: '',
    reopenedAt: nowIso,
    reopenReason: String(reason || '').trim(),
    nextFollowupDate,
    timeline: tl,
    updatedAt: nowIso,
    updatedBy: actorName
  };
  cases[idx] = reopened;
  setItem(KEYS.FOLLOWUP_CASES, cases);

  try {
    await fetch(`/api/followup-cases/${encodeURIComponent(prev.id)}/reopen`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
  } catch { /* offline fallback */ }

  logAuditAction('CASE_REOPEN', `Reopened application ${prev.applicationId}`);
  return { success: true, caseRecord: reopened };
}

export async function rescheduleFollowupCase(caseId, { nextFollowupDate, milestoneDay = null, reason = '', reminderEnabled = true } = {}) {
  const cleanDate = String(nextFollowupDate || '').slice(0, 10);
  if (!cleanDate) return { success: false, message: 'Next follow-up date is required.' };

  const cases = getAllFollowupCases();
  const idx = cases.findIndex(c => c.id === caseId || c.applicationId === caseId);
  if (idx === -1) return { success: false, message: 'Case not found.' };

  const prev = cases[idx];
  const user = getItem(KEYS.CURRENT_USER, null);
  const actorName = user?.name || user?.uid || 'Staff';
  const today = getTodayDate();
  const nowIso = new Date().toISOString();

  const schedule = (prev.schedule || []).map(m => ({ ...m }));
  const targetM = milestoneDay !== null && milestoneDay !== ''
    ? schedule.find(m => Number(m.day) === Number(milestoneDay))
    : schedule.find(m => !m.completed && Number(m.day) > 0);
  if (targetM) {
    targetM.scheduledDate = cleanDate;
  }

  const tlId = await allocateGlobalReference('TL', { entityType: 'TIMELINE', entityId: prev.id });
  const tl = Array.isArray(prev.timeline) ? [...prev.timeline] : [];
  tl.push({
    id: tlId,
    entryNo: tl.length + 1,
    date: today,
    timestamp: nowIso,
    cycleDay: targetM ? targetM.day : Math.max(0, daysBetweenDates(prev.startDate || today, today)),
    milestoneLabel: 'Manual Reschedule',
    followupMode: 'Rescheduled',
    previousStatus: prev.currentStatus,
    newStatus: prev.currentStatus,
    note: `Follow-up rescheduled to ${formatDate(cleanDate)}${reason ? `: ${reason}` : ''}`,
    nextAction: `Contact customer on ${formatDate(cleanDate)}`,
    nextFollowupDate: cleanDate,
    assignedStaff: prev.assignedStaff,
    recordedBy: actorName
  });

  const updated = {
    ...prev,
    schedule,
    nextFollowupDate: cleanDate,
    nextMilestoneDay: targetM ? targetM.day : prev.nextMilestoneDay,
    timeline: tl,
    updatedAt: nowIso,
    updatedBy: actorName
  };
  cases[idx] = updated;
  setItem(KEYS.FOLLOWUP_CASES, cases);

  // Sync non-duplicating Reminder record
  const reminders = getAllReminders();
  const existingRemIdx = reminders.findIndex(r => r.caseId === prev.id && r.status === 'ACTIVE');
  const remId = existingRemIdx !== -1
    ? reminders[existingRemIdx].id
    : await allocateGlobalReference('REM', { entityType: 'REMINDER', entityId: prev.id });
  const remObj = {
    id: remId,
    applicationId: prev.applicationId,
    caseId: prev.id,
    customerId: prev.customerId || '',
    customerName: prev.customerName,
    phone: prev.phone || '',
    milestoneDay: Number(updated.nextMilestoneDay || 0),
    reminderDate: cleanDate,
    enabled: reminderEnabled !== false,
    status: 'ACTIVE',
    note: reason || `Rescheduled Day ${updated.nextMilestoneDay} follow-up`,
    assignedStaff: prev.assignedStaff,
    createdAt: existingRemIdx !== -1 ? reminders[existingRemIdx].createdAt : nowIso,
    updatedAt: nowIso
  };
  if (existingRemIdx !== -1) reminders[existingRemIdx] = remObj;
  else reminders.unshift(remObj);
  setItem(KEYS.REMINDERS, reminders);

  try {
    await fetch(`/api/followup-cases/${encodeURIComponent(prev.id)}/reschedule`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ nextFollowupDate: cleanDate, milestoneDay, reason, reminderEnabled })
    });
  } catch { /* fallback */ }

  logAuditAction('CASE_RESCHEDULE', `Rescheduled ${prev.applicationId} to ${cleanDate}`);
  return { success: true, caseRecord: updated };
}

/* =========================================================================
   NON-OVERWRITING FOLLOW-UP ENTRY & GREIVANCE TRACKING
   ========================================================================= */

/**
 * NON-OVERWRITING TIMELINE ENTRY:
 * Appends a full follow-up entry without overwriting past notes.
 * IMPORTANT: Never automatically alters Application Current Status when completing milestones;
 * only updates Current Status if the user explicitly picks a different status!
 */
export async function addTimelineFollowupEntry(caseId, entryData = {}) {
  const cases = getAllFollowupCases();
  const idx = cases.findIndex(c => c.id === caseId || c.applicationId === caseId);
  if (idx === -1) return { success: false, message: 'Case record not found.' };

  const prev = cases[idx];
  const user = getItem(KEYS.CURRENT_USER, null);
  const actorName = user?.name || user?.uid || 'Staff';
  const actorUid = user?.uid || user?.id || 'MC-ADM-14012025';
  const today = getTodayDate();
  const now = new Date();
  const nowIso = now.toISOString();

  const noteText = String(entryData.note || entryData.notes || '').trim();
  if (!noteText) {
    return { success: false, message: 'Follow-up note / remarks cannot be empty.' };
  }

  const prevStatus = prev.currentStatus || 'Submitted';
  // Only update status if explicitly provided and changed by authorized user (never auto-changed by schedule completion!)
  const newStatus = (entryData.newStatus && String(entryData.newStatus).trim()) ? String(entryData.newStatus).trim() : prevStatus;
  const statusExplicitlyChanged = newStatus !== prevStatus;

  const entryDate = (entryData.date || entryData.followupDate || today).slice(0, 10);
  const elapsed = Math.max(0, daysBetweenDates(prev.startDate || entryDate, entryDate));
  const milestoneDay = entryData.milestoneDay !== undefined && entryData.milestoneDay !== '' && entryData.milestoneDay !== null
    ? Number(entryData.milestoneDay)
    : null;

  const schedule = Array.isArray(prev.schedule) && prev.schedule.length
    ? prev.schedule.map(m => ({ ...m }))
    : buildDefault90DaySchedule(prev.startDate || today, true);

  let matchedMilestone = null;
  if (milestoneDay !== null && !isNaN(milestoneDay)) {
    const mIdx = schedule.findIndex(m => Number(m.day) === milestoneDay);
    if (mIdx !== -1) {
      if (!schedule[mIdx].completed) {
        schedule[mIdx].completed = true;
        schedule[mIdx].completedDate = entryDate;
        schedule[mIdx].completedNote = noteText;
      }
      matchedMilestone = schedule[mIdx];
    }
  } else if (entryData.completeCurrentDue !== false) {
    const duePending = schedule.find(m => !m.completed && Number(m.day) > 0 && m.scheduledDate <= entryDate);
    if (duePending) {
      duePending.completed = true;
      duePending.completedDate = entryDate;
      duePending.completedNote = noteText;
      matchedMilestone = duePending;
    }
  }

  const nextMeta = resolveNextPendingMilestone(schedule, entryData.nextFollowupDate || '');
  const isNowClosed = isFinalCaseStatus(newStatus) || Boolean(entryData.markCycleCompleted);
  const effectiveNextDate = isNowClosed ? '' : (entryData.nextFollowupDate || nextMeta.nextDate || '');

  const prevTimeline = Array.isArray(prev.timeline) ? [...prev.timeline] : [];
  const nextEntryNo = prevTimeline.length + 1;
  const resolvedCycleDay = milestoneDay !== null && !isNaN(milestoneDay)
    ? milestoneDay
    : (matchedMilestone ? Number(matchedMilestone.day) : elapsed);

  const scheduleLabels = {};
  getFollowupScheduleTemplate({ activeOnly: false }).forEach(m => { scheduleLabels[Number(m.day)] = `Day ${m.day} — ${m.title}`; });

  const tlEntryId = await allocateGlobalReference('TL', { entityType: 'TIMELINE', entityId: prev.id });
  const newEntry = {
    id: tlEntryId,
    entryNo: nextEntryNo,
    date: entryDate,
    followupDate: entryDate,
    timestamp: nowIso,
    cycleDay: resolvedCycleDay,
    milestoneLabel: matchedMilestone?.label || scheduleLabels[resolvedCycleDay] || `Day ${resolvedCycleDay} Follow-up`,
    followupMode: entryData.followupMode || entryData.contactMethod || 'Phone Call',
    contactMethod: entryData.followupMode || entryData.contactMethod || 'Phone Call',
    customerResponse: entryData.customerResponse || '',
    actionTaken: entryData.actionTaken || '',
    followupResult: entryData.followupResult || '',
    pendingReason: entryData.pendingReason !== undefined ? entryData.pendingReason : (prev.pendingReason || ''),
    priority: entryData.priority || prev.priority || 'Normal',
    customerFeedback: entryData.customerFeedback || '',
    attachmentName: entryData.attachmentName || '',
    attachmentDocId: entryData.attachmentDocId || '',
    reminderEnabled: entryData.reminderEnabled !== false,
    previousStatus: prevStatus,
    newStatus,
    note: noteText,
    nextAction: String(entryData.nextAction || entryData.actionTaken || '').trim(),
    nextFollowupDate: effectiveNextDate,
    assignedStaff: entryData.assignedStaff || prev.assignedStaff || actorUid,
    recordedBy: actorName
  };

  const updatedTimeline = [...prevTimeline, newEntry];

  const updatedCase = {
    ...prev,
    currentStatus: newStatus,
    assignedStaff: entryData.assignedStaff || prev.assignedStaff,
    priority: entryData.priority || prev.priority || 'Normal',
    pendingReason: entryData.pendingReason !== undefined ? entryData.pendingReason : (prev.pendingReason || ''),
    schedule,
    timeline: updatedTimeline,
    nextFollowupDate: effectiveNextDate,
    nextMilestoneDay: nextMeta.nextDay,
    cycleCompleted: isNowClosed,
    completedAt: isNowClosed ? (prev.completedAt || nowIso) : prev.completedAt || '',
    updatedAt: nowIso,
    updatedBy: actorName
  };

  cases[idx] = updatedCase;
  setItem(KEYS.FOLLOWUP_CASES, cases);

  // Append to local Follow-up Ledger
  const ledger = getAllFollowupLedger();
  ledger.unshift({
    id: newEntry.id,
    applicationId: updatedCase.applicationId,
    caseId: updatedCase.id,
    customerId: updatedCase.customerId || '',
    customerName: updatedCase.customerName || '',
    entryNo: nextEntryNo,
    followupDate: entryDate,
    cycleDay: resolvedCycleDay,
    milestoneLabel: newEntry.milestoneLabel,
    contactMethod: newEntry.contactMethod,
    customerResponse: newEntry.customerResponse,
    currentStatusSnapshot: newStatus,
    actionTaken: newEntry.actionTaken,
    nextFollowupDate: effectiveNextDate,
    note: noteText,
    staffName: actorName,
    staffUid: updatedCase.assignedStaff,
    followupResult: newEntry.followupResult,
    pendingReason: newEntry.pendingReason,
    casePriority: updatedCase.priority,
    customerFeedback: newEntry.customerFeedback,
    attachmentName: newEntry.attachmentName,
    attachmentDocId: newEntry.attachmentDocId,
    reminderEnabled: newEntry.reminderEnabled,
    timestamp: nowIso
  });
  setItem(KEYS.FOLLOWUP_LEDGER, ledger);

  // Log explicit manual status change in Status History if status actually changed
  if (statusExplicitlyChanged) {
    const hist = getAllStatusHistory();
    const sthId = await allocateGlobalReference('TL', { entityType: 'STATUS_HISTORY', entityId: updatedCase.id });
    hist.unshift({
      id: sthId,
      applicationId: updatedCase.applicationId,
      caseId: updatedCase.id,
      customerId: updatedCase.customerId || '',
      customerName: updatedCase.customerName || '',
      previousStatus: prevStatus,
      newStatus,
      date: entryDate,
      time: now.toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit' }),
      updatedBy: actorName,
      updatedByUid: actorUid,
      remarks: `Updated during follow-up entry #${nextEntryNo}: ${noteText}`,
      timestamp: nowIso
    });
    setItem(KEYS.STATUS_HISTORY, hist);
  }

  // Upsert / Update next reminder without duplicating
  if (effectiveNextDate && !isNowClosed) {
    const reminders = getAllReminders();
    const remIdx = reminders.findIndex(r => r.caseId === updatedCase.id && r.status === 'ACTIVE');
    const remId = remIdx !== -1
      ? reminders[remIdx].id
      : await allocateGlobalReference('REM', { entityType: 'REMINDER', entityId: updatedCase.id });
    const remPayload = {
      id: remId,
      applicationId: updatedCase.applicationId,
      caseId: updatedCase.id,
      customerId: updatedCase.customerId || '',
      customerName: updatedCase.customerName,
      phone: updatedCase.phone || '',
      milestoneDay: Number(nextMeta.nextDay || 0),
      reminderDate: effectiveNextDate,
      enabled: entryData.reminderEnabled !== false,
      status: 'ACTIVE',
      note: newEntry.nextAction || `Next follow-up: Day ${nextMeta.nextDay}`,
      assignedStaff: updatedCase.assignedStaff,
      createdAt: remIdx !== -1 ? reminders[remIdx].createdAt : nowIso,
      updatedAt: nowIso
    };
    if (remIdx !== -1) reminders[remIdx] = remPayload;
    else reminders.unshift(remPayload);
    setItem(KEYS.REMINDERS, reminders);
  }

  // Sync linked Customer Profile record currentStatus if explicitly updated
  if (statusExplicitlyChanged && prev.customerId) {
    const customers = getAllCustomers();
    const cIdx = customers.findIndex(c => c.id === prev.customerId);
    if (cIdx !== -1) {
      customers[cIdx] = {
        ...customers[cIdx],
        currentStatus: newStatus,
        assignedStaff: updatedCase.assignedStaff,
        updatedAt: nowIso
      };
      setItem(KEYS.CUSTOMERS, customers);
    }
  }

  pushCaseToServer(updatedCase);
  fetch(`/api/followup-cases/${encodeURIComponent(updatedCase.id)}/timeline`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(newEntry)
  }).catch(() => {});

  logAuditAction('CASE_FOLLOWUP_APPEND', `Appended Entry #${nextEntryNo} (${newEntry.milestoneLabel}) to ${updatedCase.applicationId}`);
  return { success: true, entry: newEntry, caseRecord: updatedCase };
}

/**
 * Portal-specific Grievance Entry (CMO, MLA, CPGRAMS, NPCI, Other, + Admin portals)
 */
export async function saveGrievanceEntry(grievanceData = {}) {
  const cases = getAllFollowupCases();
  const caseRec = cases.find(c =>
    (grievanceData.caseId && c.id === grievanceData.caseId) ||
    (grievanceData.applicationId && c.applicationId === grievanceData.applicationId) ||
    (grievanceData.customerId && c.customerId === grievanceData.customerId)
  );
  const cust = grievanceData.customerId
    ? getCustomerById(grievanceData.customerId)
    : (caseRec?.customerId ? getCustomerById(caseRec.customerId) : null);

  const user = getItem(KEYS.CURRENT_USER, null);
  const actorName = user?.name || user?.uid || 'Staff';
  const actorUid = user?.uid || user?.id || 'MC-ADM-14012025';
  const nowIso = new Date().toISOString();
  const gDate = (grievanceData.date || getTodayDate()).slice(0, 10);
  const portal = String(grievanceData.portal || grievanceData.type || 'CMO').trim();

  const grvId = grievanceData.id || (await allocateGlobalReference('GRV', { entityType: 'GRIEVANCE' }));
  const payload = {
    id: grvId,
    caseId: caseRec?.id || grievanceData.caseId || '',
    applicationId: grievanceData.applicationId || caseRec?.applicationId || cust?.applicationId || '',
    customerId: grievanceData.customerId || caseRec?.customerId || cust?.id || '',
    customerName: grievanceData.customerName || caseRec?.customerName || cust?.name || '',
    phone: String(grievanceData.phone || caseRec?.phone || cust?.phone || '').trim(),
    portal,
    type: portal,
    referenceNumber: String(grievanceData.referenceNumber || '').trim() || grvId,
    date: gDate,
    status: String(grievanceData.status || 'Pending').trim(),
    remarks: String(grievanceData.remarks || grievanceData.description || '').trim(),
    description: String(grievanceData.remarks || grievanceData.description || '').trim(),
    submittedTo: String(grievanceData.submittedTo || (portal === 'Other' ? grievanceData.customPortalName : portal) || 'Concerned Department').trim(),
    department: String(grievanceData.department || '').trim(),
    atr: String(grievanceData.atr || '').trim(),
    aadhaarSeedingStatus: String(grievanceData.aadhaarSeedingStatus || '').trim(),
    bankMapping: String(grievanceData.bankMapping || '').trim(),
    customPortalName: String(grievanceData.customPortalName || '').trim(),
    portalFields: grievanceData.portalFields || {},
    recordedBy: actorName,
    recordedByUid: actorUid,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  // Update local KEYS.GRIEVANCES
  const list = getAllGrievances();
  const existingIdx = list.findIndex(g => g.id === payload.id);
  if (existingIdx !== -1) {
    list[existingIdx] = { ...list[existingIdx], ...payload, createdAt: list[existingIdx].createdAt || nowIso };
  } else {
    list.unshift(payload);
  }
  setItem(KEYS.GRIEVANCES, list);

  // Sync onto linked Case record & timeline
  if (caseRec) {
    const cIdx = cases.findIndex(c => c.id === caseRec.id);
    if (cIdx !== -1) {
      const prev = cases[cIdx];
      const grvs = Array.isArray(prev.grievances) ? [...prev.grievances] : [];
      const gSubIdx = grvs.findIndex(x => x.id === payload.id);
      if (gSubIdx !== -1) grvs[gSubIdx] = payload;
      else grvs.unshift(payload);

      const timeline = Array.isArray(prev.timeline) ? [...prev.timeline] : [];
      if (existingIdx === -1) {
        const portalDisplay = portal === 'Other' && payload.customPortalName ? `${portal} (${payload.customPortalName})` : portal;
        const tlId = await allocateGlobalReference('TL', { entityType: 'TIMELINE', entityId: prev.id });
        timeline.push({
          id: tlId,
          entryNo: timeline.length + 1,
          date: gDate,
          timestamp: nowIso,
          cycleDay: Math.max(0, daysBetweenDates(prev.startDate || gDate, gDate)),
          milestoneLabel: `Grievance Logged (${portalDisplay})`,
          followupMode: 'Grievance Portal',
          previousStatus: prev.currentStatus,
          newStatus: prev.currentStatus,
          note: `Portal: ${portalDisplay} · Ref: ${payload.referenceNumber} — ${payload.remarks || payload.status}`,
          nextAction: 'Track grievance portal response / ATR',
          nextFollowupDate: prev.nextFollowupDate || '',
          assignedStaff: prev.assignedStaff,
          recordedBy: actorName
        });
      }

      cases[cIdx] = {
        ...prev,
        grievances: grvs,
        timeline,
        updatedAt: nowIso,
        updatedBy: actorName
      };
      setItem(KEYS.FOLLOWUP_CASES, cases);
    }
  }

  try {
    await fetch('/api/grievances', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
  } catch { /* fallback */ }

  logAuditAction('CASE_GRIEVANCE_SAVE', `Saved ${payload.portal} grievance ${payload.referenceNumber} for ${payload.applicationId}`);
  return { success: true, grievance: payload, caseRecord: caseRec };
}

export async function addGrievanceToCase(caseId, grievanceData = {}) {
  const caseRec = getFollowupCaseById(caseId);
  return await saveGrievanceEntry({
    ...grievanceData,
    caseId: caseRec?.id || caseId,
    applicationId: grievanceData.applicationId || caseRec?.applicationId || '',
    customerId: grievanceData.customerId || caseRec?.customerId || '',
    customerName: grievanceData.customerName || caseRec?.customerName || '',
    portal: grievanceData.portal || grievanceData.type || 'CMO',
    remarks: grievanceData.remarks || grievanceData.description || ''
  });
}

export function deleteFollowupCase(caseId) {
  const cases = getAllFollowupCases();
  const target = cases.find(c => c.id === caseId);
  const updated = cases.filter(c => c.id !== caseId);
  setItem(KEYS.FOLLOWUP_CASES, updated);
  markGlobalReferenceDeleted(caseId);
  fetch(`/api/followup-cases/${encodeURIComponent(caseId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  }).catch(() => {});
  if (target) {
    logAuditAction('CASE_90D_DELETE', `Deleted 90-day case ${target.applicationId} (${target.customerName})`);
  }
  return { success: true };
}

/* =========================================================================
   90-DAY METRICS, OVERDUE DETECTION & 6 SMART DASHBOARD BUCKETS
   ========================================================================= */

export function compute90DayCaseMetrics(caseRec, today = getTodayDate()) {
  const startDate = (caseRec.startDate || caseRec.createdAt?.slice(0, 10) || today).slice(0, 10);
  const schedule = Array.isArray(caseRec.schedule) && caseRec.schedule.length
    ? caseRec.schedule
    : buildDefault90DaySchedule(startDate, true);
  const elapsedRaw = daysBetweenDates(startDate, today);
  const elapsedDays = Math.max(0, Math.min(90, elapsedRaw));
  const remainingDays = Math.max(0, 90 - elapsedDays);
  const completedMilestonesCount = schedule.filter(m => m.completed).length;

  const isCompleted = Boolean(caseRec.cycleCompleted) || isFinalCaseStatus(caseRec.currentStatus);

  const pendingMilestones = schedule
    .filter(m => !m.completed && Number(m.day) > 0)
    .sort((a, b) => Number(a.day) - Number(b.day));

  const overdueMilestones = isCompleted
    ? []
    : pendingMilestones.filter(m => m.scheduledDate < today);

  const todayMilestones = isCompleted
    ? []
    : pendingMilestones.filter(m => m.scheduledDate === today);

  const upcomingMilestones = isCompleted
    ? []
    : pendingMilestones.filter(m => m.scheduledDate > today);

  const nextMilestone = pendingMilestones[0] || schedule[schedule.length - 1];
  const effectiveNextDate = isCompleted
    ? ''
    : ((caseRec.nextFollowupDate || nextMilestone?.scheduledDate || '').slice(0, 10));

  const isOverdue = !isCompleted && (overdueMilestones.length > 0 || (Boolean(effectiveNextDate) && effectiveNextDate < today));
  const isToday = !isCompleted && !isOverdue && (todayMilestones.length > 0 || effectiveNextDate === today);
  const isUpcoming = !isCompleted && !isOverdue && !isToday && Boolean(effectiveNextDate) && effectiveNextDate > today;
  const isReview90 = !isCompleted && (elapsedDays >= 75 || (nextMilestone && Number(nextMilestone.day) >= 90));

  let bucket = 'pending';
  if (isCompleted) bucket = 'completed';
  else if (isOverdue) bucket = 'overdue';
  else if (isToday) bucket = 'today';
  else if (isUpcoming) bucket = 'upcoming';

  const overdueDays = isOverdue && effectiveNextDate ? Math.max(1, daysBetweenDates(effectiveNextDate, today)) : 0;
  const progressPct = isCompleted
    ? 100
    : Math.min(100, Math.round((completedMilestonesCount / Math.max(1, schedule.length)) * 100));

  return {
    startDate,
    endDate: caseRec.endDate || addDaysToIsoDate(startDate, 90),
    elapsedDays,
    remainingDays,
    progressPct,
    completedMilestonesCount,
    totalMilestones: schedule.length,
    nextMilestone,
    effectiveNextDate,
    overdueMilestones,
    overdueDays,
    isCompleted,
    isOverdue,
    isToday,
    isUpcoming,
    isReview90,
    bucket
  };
}

export function get90DayDashboardData() {
  const today = getTodayDate();
  const cases = getAllFollowupCases().map(c => ({
    ...c,
    _metrics: compute90DayCaseMetrics(c, today)
  }));

  const todayList = cases.filter(c => c._metrics.isToday);
  const overdueList = cases
    .filter(c => c._metrics.isOverdue)
    .sort((a, b) => (b._metrics.overdueDays || 0) - (a._metrics.overdueDays || 0));
  const upcomingList = cases
    .filter(c => c._metrics.isUpcoming)
    .sort((a, b) => (a._metrics.effectiveNextDate || '').localeCompare(b._metrics.effectiveNextDate || ''));
  const pendingList = cases.filter(c => !c._metrics.isCompleted);
  const completedList = cases.filter(c => c._metrics.isCompleted);
  const review90List = cases
    .filter(c => c._metrics.isReview90)
    .sort((a, b) => (b._metrics.elapsedDays || 0) - (a._metrics.elapsedDays || 0));

  return {
    cases,
    stats: {
      totalCases: cases.length,
      todayCount: todayList.length,
      upcomingCount: upcomingList.length,
      overdueCount: overdueList.length,
      pendingCount: pendingList.length,
      completedCount: completedList.length,
      review90Count: review90List.length
    },
    buckets: {
      today: todayList,
      upcoming: upcomingList,
      overdue: overdueList,
      pending: pendingList,
      completed: completedList,
      review90: review90List
    }
  };
}

/* =========================================================================
   ALL 11 REPORTS & EXPORTS (PDF, EXCEL, PRINT WITH MULTI-FILTERS)
   ========================================================================= */

export const NINE_DAY_REPORT_CATALOG = [
  { id: 'daily', label: 'Daily Follow-up Report', desc: 'Follow-ups scheduled or logged today' },
  { id: 'weekly', label: 'Weekly Follow-up Report', desc: 'Last 7 days follow-up & application activity' },
  { id: 'monthly', label: 'Monthly Follow-up Report', desc: 'Current month follow-ups & progress summary' },
  { id: 'pending', label: 'Pending Application Report', desc: 'All active open applications with pending reasons' },
  { id: 'overdue', label: 'Overdue Follow-up Report', desc: 'Missed milestones & overdue follow-up alerts' },
  { id: 'completed-90', label: '90 Days Completed Report', desc: 'Closed/completed applications & cycle duration' },
  { id: 'customer-history', label: 'Customer-wise History Report', desc: 'Customers, multi-application totals & follow-ups' },
  { id: 'staff-performance', label: 'Staff-wise Performance Report', desc: 'Assigned cases, follow-ups logged & resolution rate' },
  { id: 'grievance', label: 'Grievance Report', desc: 'CMO, MLA, CPGRAMS, NPCI & portal grievance register' },
  { id: 'service-wise', label: 'Service-wise Report', desc: 'Volume, status split & overdue count per service/scheme' },
  { id: 'application-status', label: 'Application Status Report', desc: 'Breakdown across Day 0–90 current application statuses' }
];

function sanitizeAscii(val) {
  return String(val ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/–|—/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ')
    .trim();
}

function applyCaseReportFilters(cases, filters = {}) {
  const { dateFrom = '', dateTo = '', staff = 'all', service = 'all', status = 'all', priority = 'all' } = filters || {};
  return cases.filter(c => {
    const startD = (c.startDate || c.createdAt?.slice(0, 10) || '').slice(0, 10);
    if (dateFrom && startD && startD < dateFrom) return false;
    if (dateTo && startD && startD > dateTo) return false;
    if (staff && staff !== 'all' && String(c.assignedStaff || '') !== String(staff)) return false;
    if (service && service !== 'all') {
      const svMatch = String(c.schemeName || '') === service || (Array.isArray(c.services) && c.services.includes(service));
      if (!svMatch) return false;
    }
    if (status && status !== 'all' && String(c.currentStatus || '') !== String(status)) return false;
    if (priority && priority !== 'all' && String(c.priority || 'Normal') !== String(priority)) return false;
    return true;
  });
}

export function build90DayReportDataset(periodType = 'daily', filters = {}) {
  const today = getTodayDate();
  const dashboard = get90DayDashboardData();
  const filteredCases = applyCaseReportFilters(dashboard.cases, filters);

  const weekStart = addDaysToIsoDate(today, -6);
  const monthStart = `${today.slice(0, 7)}-01`;
  const rangeFrom = filters?.dateFrom || '';
  const rangeTo = filters?.dateTo || '';

  if (periodType === 'completed-90') {
    const completedCases = filteredCases.filter(c => c._metrics.isCompleted);
    return {
      title: '90 Days Completed Applications Report',
      filename: `MUN_90Days_Completed_Report_${today}`,
      headers: ['Application ID', 'Customer ID', 'Customer Name', 'Mobile', 'Service / Scheme', 'Priority', 'Staff', 'Start Date', 'Completed Date', 'Days Taken', 'Milestones', 'Final Status'],
      rows: completedCases.map(c => {
        const compDate = (c.completedAt || c.updatedAt || today).slice(0, 10);
        return [
          c.applicationId,
          c.customerId || '-',
          c.customerName,
          c.phone || '-',
          c.schemeName,
          c.priority || 'Normal',
          c.assignedStaff || '-',
          formatDate(c._metrics.startDate),
          formatDate(compDate),
          `${Math.max(0, daysBetweenDates(c._metrics.startDate, compDate))} / 90`,
          `${c._metrics.completedMilestonesCount}/${c._metrics.totalMilestones}`,
          c.currentStatus
        ];
      })
    };
  }

  if (periodType === 'pending') {
    const pendingCases = filteredCases.filter(c => !c._metrics.isCompleted);
    return {
      title: 'Pending Application Report',
      filename: `MUN_Pending_Applications_${today}`,
      headers: ['Application ID', 'Customer Name', 'Mobile', 'Service / Scheme', 'Current Status', 'Pending Reason', 'Priority', 'Staff', 'Cycle Day', 'Next Follow-up'],
      rows: pendingCases.map(c => [
        c.applicationId,
        c.customerName,
        c.phone || '-',
        c.schemeName,
        c.currentStatus,
        c.pendingReason || '-',
        c.priority || 'Normal',
        c.assignedStaff || '-',
        `Day ${c._metrics.elapsedDays} / 90`,
        c._metrics.effectiveNextDate ? formatDate(c._metrics.effectiveNextDate) : '-'
      ])
    };
  }

  if (periodType === 'overdue') {
    const overdueCases = filteredCases
      .filter(c => c._metrics.isOverdue)
      .sort((a, b) => (b._metrics.overdueDays || 0) - (a._metrics.overdueDays || 0));
    return {
      title: 'Overdue Follow-up Report',
      filename: `MUN_Overdue_Followups_${today}`,
      headers: ['Application ID', 'Customer Name', 'Mobile', 'Service / Scheme', 'Current Status', 'Priority', 'Due Date', 'Overdue By', 'Assigned Staff', 'Last Note'],
      rows: overdueCases.map(c => {
        const latest = (c.timeline || [])[c.timeline.length - 1];
        return [
          c.applicationId,
          c.customerName,
          c.phone || '-',
          c.schemeName,
          c.currentStatus,
          c.priority || 'Normal',
          c._metrics.effectiveNextDate ? formatDate(c._metrics.effectiveNextDate) : '-',
          `${c._metrics.overdueDays} day(s)`,
          c.assignedStaff || '-',
          latest ? latest.note : '-'
        ];
      })
    };
  }

  if (periodType === 'customer-history') {
    const customers = getAllCustomers();
    return {
      title: 'Customer-wise Application & Follow-up History Report',
      filename: `MUN_Customer_Wise_History_${today}`,
      headers: ['Customer ID', 'Customer Name', 'Mobile', 'Type', 'Reg Date', 'Total Applications', 'Application IDs', 'Services', 'Total Follow-ups', 'Latest Status'],
      rows: customers.map(cust => {
        const custCases = filteredCases.filter(cs => cs.customerId === cust.id);
        const totalFlw = custCases.reduce((acc, cs) => acc + (cs.timeline || []).length, 0);
        return [
          cust.id,
          cust.name,
          cust.phone || '-',
          cust.category || 'General Public',
          formatDate(cust.regDate),
          custCases.length,
          custCases.map(cs => cs.applicationId).join(', ') || cust.applicationId || '-',
          Array.from(new Set(custCases.map(cs => cs.schemeName))).join(', ') || cust.schemeName || '-',
          totalFlw,
          custCases[0]?.currentStatus || cust.currentStatus || '-'
        ];
      })
    };
  }

  if (periodType === 'staff-performance') {
    const staffMap = new Map();
    filteredCases.forEach(c => {
      const uid = c.assignedStaff || 'Unassigned';
      if (!staffMap.has(uid)) {
        staffMap.set(uid, { uid, cases: 0, followups: 0, grievances: 0, overdue: 0, completed: 0 });
      }
      const row = staffMap.get(uid);
      row.cases++;
      row.followups += (c.timeline || []).length;
      row.grievances += (c.grievances || []).length;
      if (c._metrics.isOverdue) row.overdue++;
      if (c._metrics.isCompleted) row.completed++;
    });
    const rows = Array.from(staffMap.values()).map(r => [
      r.uid,
      r.cases,
      r.cases - r.completed,
      r.completed,
      r.overdue,
      r.followups,
      r.grievances,
      r.cases > 0 ? `${Math.round((r.completed / r.cases) * 100)}%` : '0%'
    ]);
    return {
      title: 'Staff-wise Performance Report',
      filename: `MUN_Staff_Performance_${today}`,
      headers: ['Staff UID', 'Total Cases', 'Active Cases', 'Completed', 'Overdue', 'Follow-up Entries', 'Grievances Logged', 'Completion Rate'],
      rows
    };
  }

  if (periodType === 'grievance') {
    const allGrv = getAllGrievances();
    const caseGrvIds = new Set(allGrv.map(g => g.id));
    const combined = [...allGrv];
    filteredCases.forEach(c => {
      (c.grievances || []).forEach(g => {
        if (!caseGrvIds.has(g.id)) {
          combined.push({ ...g, applicationId: g.applicationId || c.applicationId, customerName: g.customerName || c.customerName });
        }
      });
    });
    const filteredGrv = combined.filter(g => {
      const d = (g.date || '').slice(0, 10);
      if (rangeFrom && d && d < rangeFrom) return false;
      if (rangeTo && d && d > rangeTo) return false;
      return true;
    });
    return {
      title: 'Grievance Tracking & Portal Escalation Report',
      filename: `MUN_Grievance_Report_${today}`,
      headers: ['Grievance ID', 'Application ID', 'Customer Name', 'Portal', 'Reference No', 'Date', 'Department / Authority', 'ATR / Bank Mapping', 'Status', 'Remarks'],
      rows: filteredGrv.map(g => [
        g.id,
        g.applicationId || '-',
        g.customerName || '-',
        g.portal === 'Other' && g.customPortalName ? `Other (${g.customPortalName})` : (g.portal || g.type || '-'),
        g.referenceNumber || '-',
        formatDate(g.date),
        g.department || g.submittedTo || '-',
        g.atr || g.bankMapping || g.aadhaarSeedingStatus || '-',
        g.status || '-',
        g.remarks || g.description || '-'
      ])
    };
  }

  if (periodType === 'service-wise') {
    const srvMap = new Map();
    filteredCases.forEach(c => {
      const key = c.schemeName || 'General Digital Service';
      if (!srvMap.has(key)) {
        srvMap.set(key, { name: key, total: 0, active: 0, overdue: 0, completed: 0, followups: 0 });
      }
      const s = srvMap.get(key);
      s.total++;
      s.followups += (c.timeline || []).length;
      if (c._metrics.isCompleted) s.completed++;
      else s.active++;
      if (c._metrics.isOverdue) s.overdue++;
    });
    return {
      title: 'Service / Scheme-wise Application Report',
      filename: `MUN_Service_Wise_Report_${today}`,
      headers: ['Service / Scheme', 'Total Applications', 'Active Cases', 'Overdue Cases', 'Completed Cases', 'Total Follow-up Entries'],
      rows: Array.from(srvMap.values()).map(s => [s.name, s.total, s.active, s.overdue, s.completed, s.followups])
    };
  }

  if (periodType === 'application-status') {
    const stMap = new Map();
    filteredCases.forEach(c => {
      const key = c.currentStatus || 'Submitted';
      if (!stMap.has(key)) stMap.set(key, { status: key, count: 0, urgent: 0, overdue: 0 });
      const row = stMap.get(key);
      row.count++;
      if (['High', 'Urgent'].includes(c.priority)) row.urgent++;
      if (c._metrics.isOverdue) row.overdue++;
    });
    return {
      title: 'Application Status Distribution Report',
      filename: `MUN_Application_Status_Report_${today}`,
      headers: ['Current Status', 'Total Applications', 'Share (%)', 'High/Urgent Priority', 'Overdue Count'],
      rows: Array.from(stMap.values()).map(r => [
        r.status,
        r.count,
        filteredCases.length ? `${Math.round((r.count / filteredCases.length) * 100)}%` : '0%',
        r.urgent,
        r.overdue
      ])
    };
  }

  // Daily / Weekly / Monthly reports
  let rangeStart = rangeFrom || today;
  let rangeEnd = rangeTo || today;
  let title = `Daily Customer Follow-up Report (${formatDate(today)})`;
  let filename = `MUN_Followup_Daily_Report_${today}`;

  if (periodType === 'weekly') {
    rangeStart = rangeFrom || weekStart;
    title = `Weekly Customer Follow-up Report (${formatDate(rangeStart)} to ${formatDate(rangeEnd)})`;
    filename = `MUN_Followup_Weekly_Report_${today}`;
  } else if (periodType === 'monthly') {
    rangeStart = rangeFrom || monthStart;
    title = `Monthly Customer Follow-up Report (${formatDate(rangeStart)} to ${formatDate(rangeEnd)})`;
    filename = `MUN_Followup_Monthly_Report_${today}`;
  }

  const headers = [
    'Application ID',
    'Customer Name',
    'Mobile',
    'Service / Scheme',
    'Priority',
    'Assigned Staff',
    'Current Status',
    'Cycle Day',
    'Bucket / Alert',
    'Next Follow-up',
    'Entries in Period',
    'Latest Note'
  ];

  const matchingCases = filteredCases.filter(c => {
    const hasActivityInRange = (c.timeline || []).some(tl => (tl.date || '') >= rangeStart && (tl.date || '') <= rangeEnd);
    const hasDueInRange = c._metrics.effectiveNextDate && c._metrics.effectiveNextDate >= rangeStart && c._metrics.effectiveNextDate <= rangeEnd;
    const isDueTodayOrOverdue = periodType === 'daily' && (c._metrics.isToday || c._metrics.isOverdue);
    const startedInRange = c._metrics.startDate >= rangeStart && c._metrics.startDate <= rangeEnd;
    return hasActivityInRange || hasDueInRange || isDueTodayOrOverdue || startedInRange;
  });

  const rows = matchingCases.map(c => {
    const periodNotes = (c.timeline || []).filter(tl => (tl.date || '') >= rangeStart && (tl.date || '') <= rangeEnd);
    const latest = (c.timeline || [])[c.timeline.length - 1];
    const bucketLabel = c._metrics.isOverdue
      ? `OVERDUE (${c._metrics.overdueDays}d)`
      : c._metrics.isToday
        ? 'TODAY DUE'
        : c._metrics.isCompleted
          ? 'COMPLETED'
          : 'PENDING / UPCOMING';

    return [
      c.applicationId,
      c.customerName,
      c.phone || '-',
      c.schemeName,
      c.priority || 'Normal',
      c.assignedStaff || '-',
      c.currentStatus,
      `Day ${c._metrics.elapsedDays} / 90`,
      bucketLabel,
      c._metrics.effectiveNextDate ? formatDate(c._metrics.effectiveNextDate) : '-',
      periodNotes.length,
      latest ? `[Day ${latest.cycleDay}] ${latest.note}` : '-'
    ];
  });

  return { title, filename, headers, rows };
}

export function export90DayFollowupReport(periodType = 'daily', format = 'pdf', filters = {}) {
  const dataset = build90DayReportDataset(periodType, filters);
  const { title, filename, headers, rows } = dataset;

  if (format === 'csv') {
    exportUniversalCSV({
      filename,
      title: `90-DAY FOLLOW-UP REPORT — ${title}`,
      subtitle: `Records: ${rows.length}`,
      headers,
      rows,
      totalsRow: ['TOTAL', `${rows.length} Cases`, ...headers.slice(2).map(() => '')]
    });
    return { success: true, message: `${title} downloaded as CSV (UTF-8 BOM)` };
  }

  if (format === 'excel') {
    const statusHist = getAllStatusHistory();
    const allCases = getAllFollowupCases();
    const timelineRows = [];
    allCases.forEach(c => {
      (c.timeline || []).forEach(tl => {
        timelineRows.push([
          c.applicationId,
          c.customerName,
          c.schemeName,
          tl.entryNo || '-',
          formatDate(tl.date),
          `Day ${tl.cycleDay ?? 0}`,
          tl.contactMethod || tl.followupMode || '-',
          tl.customerResponse || '-',
          tl.actionTaken || tl.nextAction || '-',
          tl.followupResult || '-',
          `${tl.previousStatus || '-'} -> ${tl.newStatus || '-'}`,
          tl.note || '-',
          tl.nextFollowupDate ? formatDate(tl.nextFollowupDate) : '-',
          tl.recordedBy || '-'
        ]);
      });
    });

    const extraSheets = [];
    if (statusHist.length > 0) {
      extraSheets.push({
        sheetName: 'Status History',
        title: '90-DAY FOLLOW-UP STATUS AUDIT HISTORY',
        headers: ['Application ID', 'Customer', 'Previous Status', 'New Status', 'Date', 'Time', 'Updated By', 'Remarks'],
        rows: statusHist.map(h => [h.applicationId, h.customerName || '-', h.previousStatus, h.newStatus, formatDate(h.date), h.time, h.updatedBy, h.remarks || '-'])
      });
    }
    if (timelineRows.length > 0) {
      extraSheets.push({
        sheetName: 'Complete Timeline',
        title: 'COMPLETE FOLLOW-UP TIMELINE LOGS',
        headers: ['Application ID', 'Customer Name', 'Service / Scheme', 'Entry #', 'Date', 'Cycle Day', 'Contact Method', 'Customer Response', 'Action Taken', 'Result', 'Status Snapshot', 'Follow-up Note', 'Next Follow-up', 'Staff'],
        rows: timelineRows
      });
    }

    exportUniversalExcel({
      filename,
      sheetName: 'Report Summary',
      title: `90-DAY FOLLOW-UP REPORT — ${title}`,
      subtitle: `Total Cases: ${rows.length}`,
      headers,
      rows,
      totalsRow: ['TOTAL', `${rows.length} Cases`, ...headers.slice(2).map(() => '')],
      extraSheets
    });
    return { success: true, message: `${title} downloaded as Excel (.xlsx)` };
  }

  if (format === 'pdf') {
    exportUniversalPDF({
      filename,
      title: 'APPLICATION TRACKING & 90-DAY FOLLOW-UP REPORT',
      subtitle: `${title} | Records: ${rows.length}`,
      orientation: 'landscape',
      headers,
      rows,
      totalsRow: ['TOTAL', `${rows.length} Cases`, ...headers.slice(2).map(() => '-')]
    });
    return { success: true, message: `${title} downloaded as PDF` };
  }

  printUniversalReport({
    title: 'APPLICATION TRACKING & 90-DAY FOLLOW-UP REPORT',
    subtitle: `${title} · Records: ${rows.length}`,
    filename,
    orientation: 'landscape',
    headers,
    rows,
    totalsRow: ['TOTAL', `${rows.length} Cases`, ...headers.slice(2).map(() => '-')]
  });
  return { success: true, message: 'Opened Print Preview' };
}

/* =========================================================================
   LEGACY FOLLOW-UP API (PRESERVED FOR BACKWARD COMPATIBILITY)
   ========================================================================= */

export function getAllFollowups() {
  const followups = getItem(KEYS.FOLLOWUPS, []);
  const today = getTodayDate();

  return followups.map(f => {
    if (f.status !== 'Completed' && f.status !== 'Cancelled' && f.followDate) {
      if (f.followDate < today) {
        return { ...f, status: 'Overdue' };
      } else if (f.followDate === today) {
        return { ...f, status: 'Today' };
      }
    }
    return f;
  });
}

export async function saveFollowup(data) {
  const followups = getItem(KEYS.FOLLOWUPS, []);

  if (data.id) {
    const index = followups.findIndex(f => f.id === data.id);
    if (index !== -1) {
      followups[index] = {
        ...followups[index],
        ...data,
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.FOLLOWUPS, followups);
      logAuditAction('FOLLOWUP_UPDATE', `Updated follow-up ${followups[index].id} for ${followups[index].customerName}`);
      return { success: true, followup: followups[index] };
    }
  }

  const today = getTodayDate();
  const effectiveFollowDate = data.followDate || today;
  let initialStatus = data.status || 'Pending';
  if (effectiveFollowDate === today) initialStatus = 'Today';
  else if (effectiveFollowDate < today) initialStatus = 'Overdue';

  const currentUser = getItem(KEYS.CURRENT_USER, null);
  const flwId = await allocateGlobalReference('FLW', { entityType: 'FOLLOWUP' });

  const newFollowup = {
    id: flwId,
    customerId: data.customerId || '',
    customerName: data.customerName || '',
    phone: data.phone || '',
    serviceId: data.serviceId || '',
    followDate: effectiveFollowDate,
    followTime: data.followTime || '11:00 AM',
    reason: data.reason || 'Application Status Check',
    notes: data.notes || '',
    nextAction: data.nextAction || '',
    assignedStaff: data.assignedStaff || currentUser?.uid || 'MC-ADM-14012025',
    status: initialStatus,
    createdAt: new Date().toISOString()
  };

  followups.unshift(newFollowup);
  setItem(KEYS.FOLLOWUPS, followups);
  logAuditAction('FOLLOWUP_CREATE', `Created follow-up ${newFollowup.id} for ${newFollowup.customerName} regarding ${newFollowup.reason}`);
  return { success: true, followup: newFollowup };
}

export function updateFollowupStatus(id, newStatus, outcomeNotes = '') {
  const followups = getItem(KEYS.FOLLOWUPS, []);
  const index = followups.findIndex(f => f.id === id);
  if (index !== -1) {
    followups[index].status = newStatus;
    if (outcomeNotes) {
      followups[index].notes = `${followups[index].notes} [${newStatus}: ${outcomeNotes}]`;
    }
    followups[index].updatedAt = new Date().toISOString();
    setItem(KEYS.FOLLOWUPS, followups);
    logAuditAction('FOLLOWUP_STATUS', `Follow-up ${id} marked as ${newStatus}`);
    return { success: true, followup: followups[index] };
  }
  return { success: false, message: 'Follow-up not found' };
}

export function rescheduleFollowup(id, newDate, newTime, reason = '') {
  const followups = getItem(KEYS.FOLLOWUPS, []);
  const index = followups.findIndex(f => f.id === id);
  if (index !== -1) {
    followups[index].followDate = newDate;
    if (newTime) followups[index].followTime = newTime;
    followups[index].status = 'Rescheduled';
    if (reason) {
      followups[index].notes = `${followups[index].notes} (Rescheduled to ${newDate}: ${reason})`;
    }
    followups[index].updatedAt = new Date().toISOString();
    setItem(KEYS.FOLLOWUPS, followups);
    logAuditAction('FOLLOWUP_RESCHEDULE', `Rescheduled follow-up ${id} to ${newDate}`);
    return { success: true, followup: followups[index] };
  }
  return { success: false, message: 'Follow-up not found' };
}

export function deleteFollowup(id) {
  const followups = getItem(KEYS.FOLLOWUPS, []);
  const updated = followups.filter(f => f.id !== id);
  setItem(KEYS.FOLLOWUPS, updated);
  markGlobalReferenceDeleted(id);
  logAuditAction('FOLLOWUP_DELETE', `Deleted follow-up record: ${id}`);
  return { success: true };
}
