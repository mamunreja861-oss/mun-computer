/**
 * yuvaSikshaEngine.js
 * Automatic Service Fetching, Category/Tag Synchronization & Analytics Engine
 * for "Banglar Yuva Siksha Barasa Card Management"
 * MUN COMPUTER BUSINESS MANAGER
 */

import {
  KEYS,
  getItem,
  setItem,
  getTodayDate,
  formatDate,
  logAuditAction
} from './storage.js';
import { getCurrentUser } from './auth.js';
import {
  getAllServices,
  getServiceCatalog,
  getUnifiedServiceList,
  getCustomSubServices
} from './services.js';
import { getAllRateChartItems } from './rateChart.js';
import { getAllCustomers } from './customers.js';
import { WB_STATE_SCHEMES, CENTRAL_GOVT_SCHEMES, getAllGovtCases } from './govtSchemes.js';
import {
  exportUniversalCSV,
  exportUniversalExcel,
  exportUniversalPDF,
  printUniversalReport
} from './exportUtility.js';

export const YUVA_META_STORAGE_KEY = 'mun_yuva_siksha_meta_v1';

export const YUVA_ELIGIBLE_CATEGORIES = [
  'Banglar Yuva Siksha Barasa Card',
  'Student Welfare Schemes',
  'Education Loan',
  'Student Financial Assistance',
  'Youth Welfare Schemes',
  'Educational Services',
  'Skill Development & Training',
  'Other Student & Youth-Related Services'
];

export const YUVA_APPLICATION_STATUSES = [
  'Registered',
  'Under Process',
  'Pending Verification',
  'Active',
  'Completed',
  'Hold / Query',
  'Rejected'
];

export const YUVA_APPROVAL_STATUSES = [
  'Pending',
  'Under Review',
  'Approved',
  'Sanctioned',
  'Rejected'
];

export const YUVA_PAYMENT_STATUSES = [
  'Pending',
  'Partial',
  'Paid',
  'Disbursed',
  'Hold'
];

const CATEGORY_CLASSIFICATION_RULES = [
  {
    category: 'Banglar Yuva Siksha Barasa Card',
    patterns: [
      /banglar\s*yuva\s*siksha/i,
      /yuva\s*siksha\s*barasa/i,
      /siksha\s*barasa/i,
      /barasa\s*card/i,
      /yuva\s*sathi/i,
      /yuva\s*card/i
    ]
  },
  {
    category: 'Education Loan',
    patterns: [
      /education\s*loan/i,
      /student\s*credit\s*card/i,
      /vidyalakshmi/i,
      /study\s*loan/i,
      /wb\s*student\s*credit/i
    ]
  },
  {
    category: 'Student Welfare Schemes',
    patterns: [
      /student\s*welfare/i,
      /kanyashree/i,
      /aikyashree/i,
      /swami\s*vivekananda/i,
      /svmcm/i,
      /sikshashree/i,
      /medhashree/i,
      /oasis\s*scholarship/i,
      /taruner\s*swapna/i,
      /sabooj\s*sathi/i,
      /national\s*scholarship/i,
      /\bnsp\b/i
    ]
  },
  {
    category: 'Student Financial Assistance',
    patterns: [
      /student\s*financial/i,
      /scholarship/i,
      /stipend/i,
      /fellowship/i,
      /merit[\s-]*cum[\s-]*means/i,
      /tuition\s*fee/i,
      /financial\s*assistance.*student/i,
      /day\s*scholar/i
    ]
  },
  {
    category: 'Youth Welfare Schemes',
    patterns: [
      /youth\s*welfare/i,
      /yuvashree/i,
      /yuva\s*shree/i,
      /karma\s*sathi/i,
      /bhabishyat\s*credit/i,
      /employment\s*bank/i,
      /youth\s*empowerment/i
    ]
  },
  {
    category: 'Skill Development & Training',
    patterns: [
      /skill\s*development/i,
      /utkarsh\s*bangla/i,
      /pmkvy/i,
      /kaushal\s*vikas/i,
      /vocational/i,
      /apprenticeship/i,
      /\biti\b/i,
      /polytechnic/i,
      /computer\s*training/i,
      /training\s*program/i
    ]
  },
  {
    category: 'Educational Services',
    patterns: [
      /^education$/i,
      /educational\s*services?/i,
      /school\s*admission/i,
      /college\s*admission/i,
      /university\s*form/i,
      /exam\s*services?/i,
      /admit\s*card/i,
      /exam\s*registration/i,
      /counselling/i,
      /migration/i,
      /marksheet/i,
      /bonafide/i,
      /academic/i
    ]
  },
  {
    category: 'Other Student & Youth-Related Services',
    patterns: [
      /other\s*student/i,
      /youth[\s-]*related/i,
      /student/i,
      /youth/i,
      /yuva/i,
      /siksha/i,
      /hostel/i,
      /career/i
    ]
  }
];

function getMetaOverlayMap() {
  const raw = getItem(YUVA_META_STORAGE_KEY, {});
  return raw && typeof raw === 'object' ? raw : {};
}

function saveMetaOverlayMap(mapObj) {
  setItem(YUVA_META_STORAGE_KEY, mapObj && typeof mapObj === 'object' ? mapObj : {});
}

function normalizeText(val) {
  return String(val || '').trim();
}

function normalizePhone10(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeDateYmd(rawDate) {
  const s = String(rawDate || '').trim();
  if (!s) return getTodayDate();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return getTodayDate();
}

function parseTagsArray(rawTags) {
  if (Array.isArray(rawTags)) {
    return rawTags.map(t => String(t || '').trim()).filter(Boolean);
  }
  if (typeof rawTags === 'string') {
    return rawTags
      .split(/[,;|#]+/)
      .map(t => t.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Automatic Category & Tag Eligibility Classifier
 */
export function classifyEligibleYuvaService({
  serviceName = '',
  category = '',
  subcategory = '',
  tags = [],
  remarks = '',
  group = '',
  dept = ''
} = {}) {
  const tagList = parseTagsArray(tags);
  const cleanCat = normalizeText(category);
  const cleanSub = normalizeText(subcategory);
  const cleanName = normalizeText(serviceName);
  const haystack = [cleanName, cleanCat, cleanSub, ...tagList, normalizeText(remarks), normalizeText(group), normalizeText(dept)]
    .filter(Boolean)
    .join(' | ');

  if (!haystack) {
    return { eligible: false, eligibleCategory: '', matchedTags: [] };
  }

  // Exact match with the 8 eligible category names first
  for (const catName of YUVA_ELIGIBLE_CATEGORIES) {
    const lc = catName.toLowerCase();
    if (
      cleanCat.toLowerCase() === lc ||
      cleanSub.toLowerCase() === lc ||
      tagList.some(t => t.toLowerCase() === lc)
    ) {
      return {
        eligible: true,
        eligibleCategory: catName,
        matchedTags: tagList.length ? tagList : [catName]
      };
    }
  }

  // Rule-based pattern matching across name, category, subcategory, and tags
  for (const rule of CATEGORY_CLASSIFICATION_RULES) {
    if (rule.patterns.some(rx => rx.test(haystack))) {
      return {
        eligible: true,
        eligibleCategory: rule.category,
        matchedTags: tagList.length ? tagList : [cleanCat || rule.category]
      };
    }
  }

  return { eligible: false, eligibleCategory: '', matchedTags: [] };
}

/**
 * Automatically Fetch Eligible Master Services from:
 * 1. Service List & Rate Chart
 * 2. Unified Service Directory & Catalog
 * 3. Govt Scheme Directory (WB + Central + Custom Schemes)
 */
export function getEligibleYuvaServices() {
  const map = new Map();

  const registerCandidate = (entry) => {
    const serviceName = normalizeText(entry.serviceName || entry.name || entry.subcategory);
    if (!serviceName) return;
    const cls = classifyEligibleYuvaService(entry);
    if (!cls.eligible) return;

    const dedupeKey = serviceName.toLowerCase();
    const existing = map.get(dedupeKey);
    const mergedTags = Array.from(new Set([
      ...(existing?.tags || []),
      ...parseTagsArray(entry.tags),
      ...cls.matchedTags
    ])).filter(Boolean);

    if (existing) {
      map.set(dedupeKey, {
        ...existing,
        serviceId: existing.serviceId || entry.id || '',
        rawCategory: existing.rawCategory || entry.category || '',
        subcategory: existing.subcategory || entry.subcategory || serviceName,
        eligibleCategory: existing.eligibleCategory || cls.eligibleCategory,
        tags: mergedTags,
        totalRate: existing.totalRate || (Number(entry.totalRate) || 0),
        sources: Array.from(new Set([...(existing.sources || []), entry.source].filter(Boolean)))
      });
      return;
    }

    map.set(dedupeKey, {
      serviceId: entry.id || `YVS-${map.size + 1}`,
      serviceName,
      nameBn: normalizeText(entry.nameBn),
      rawCategory: normalizeText(entry.category) || cls.eligibleCategory,
      subcategory: normalizeText(entry.subcategory) || serviceName,
      eligibleCategory: cls.eligibleCategory,
      tags: mergedTags,
      serviceCharge: Number(entry.serviceCharge) || 0,
      govFee: Number(entry.govFee) || 0,
      totalRate: (Number(entry.serviceCharge) || 0) + (Number(entry.govFee) || 0),
      isActive: entry.isActive !== false,
      sources: [entry.source].filter(Boolean)
    });
  };

  // 1. Live Service Rate Chart
  (getAllRateChartItems() || []).forEach(item => {
    if (item.isActive === false) return;
    registerCandidate({
      id: item.id,
      serviceName: item.serviceName,
      nameBn: item.nameBn,
      category: item.category,
      subcategory: item.subcategory || item.serviceName,
      tags: item.tags || [],
      remarks: item.remarks,
      serviceCharge: item.serviceCharge,
      govFee: item.govFee,
      isActive: item.isActive,
      source: 'Rate Chart'
    });
  });

  // 2. Unified Service Directory
  (getUnifiedServiceList() || []).forEach((s, idx) => {
    registerCandidate({
      id: s.id || `UNI-${idx + 1}`,
      serviceName: s.name,
      nameBn: s.nameBn,
      category: s.category,
      subcategory: s.subcategory || s.name,
      tags: s.tags || [s.group].filter(Boolean),
      remarks: s.remarks,
      serviceCharge: s.defaultCharge,
      govFee: s.defaultGovFee,
      group: s.group,
      isActive: true,
      source: 'Service Directory'
    });
  });

  // 3. Custom Sub-Services
  (getCustomSubServices() || []).forEach(cs => {
    registerCandidate({
      id: cs.id,
      serviceName: cs.name || cs.serviceName,
      nameBn: cs.nameBn,
      category: cs.category,
      subcategory: cs.subcategory || cs.name,
      tags: cs.tags || [],
      remarks: cs.remarks,
      serviceCharge: cs.defaultCharge,
      govFee: cs.defaultGovFee,
      isActive: true,
      source: 'Custom Catalog'
    });
  });

  // 4. Service Catalog fallback entries
  Object.entries(getServiceCatalog() || {}).forEach(([cat, subs]) => {
    (subs || []).forEach((sub, idx) => {
      registerCandidate({
        id: `CAT-${cat.slice(0, 4).toUpperCase()}-${idx + 1}`,
        serviceName: sub,
        category: cat,
        subcategory: sub,
        tags: [cat],
        source: 'Master Catalog'
      });
    });
  });

  // 5. Govt Schemes (WB + Central + Custom)
  const customSchemes = getItem(KEYS.GOVT_SCHEMES_CUSTOM, []);
  [...WB_STATE_SCHEMES, ...CENTRAL_GOVT_SCHEMES, ...(Array.isArray(customSchemes) ? customSchemes : [])].forEach(sc => {
    registerCandidate({
      id: sc.id,
      serviceName: sc.name,
      nameBn: sc.nameBn,
      category: sc.category,
      subcategory: sc.name,
      tags: [sc.level, sc.dept, sc.category].filter(Boolean),
      dept: sc.dept,
      source: 'Govt Schemes Master'
    });
  });

  return Array.from(map.values()).sort((a, b) => a.eligibleCategory.localeCompare(b.eligibleCategory) || a.serviceName.localeCompare(b.serviceName));
}

function mapApplicationStatus(rawStatus = '') {
  const s = String(rawStatus || '').trim();
  const l = s.toLowerCase();
  if (!s || l === 'new' || l === 'registered' || l === 'submitted') return 'Registered';
  if (/reject|cancel|not eligible/.test(l)) return 'Rejected';
  if (/deliver|complet|approv|sanction|resolv|closed|disburs/.test(l)) return 'Completed';
  if (/active|ongoing|enrolled|approved/.test(l)) return 'Active';
  if (/hold|revert|query/.test(l)) return 'Hold / Query';
  if (/verif|enquir|pending/.test(l)) return 'Pending Verification';
  if (/process|progress/.test(l)) return 'Under Process';
  return s;
}

function deriveApprovalStatus(rawApproval = '', appStatus = '') {
  if (rawApproval) return rawApproval;
  const l = String(appStatus || '').toLowerCase();
  if (/reject|cancel/.test(l)) return 'Rejected';
  if (/sanction/.test(l)) return 'Sanctioned';
  if (/complet|deliver|approv|active|resolv/.test(l)) return 'Approved';
  if (/process|review|verif|enquir/.test(l)) return 'Under Review';
  return 'Pending';
}

function derivePaymentStatus({ explicitStatus = '', totalAmount = 0, paidAmount = 0, disbursementAmount = 0 }) {
  if (explicitStatus) return explicitStatus;
  if (Number(disbursementAmount) > 0) return 'Disbursed';
  const total = Number(totalAmount) || 0;
  const paid = Number(paidAmount) || 0;
  if (total > 0 && paid >= total) return 'Paid';
  if (paid > 0 && paid < total) return 'Partial';
  return 'Pending';
}

/**
 * Automatically Synchronize Eligible Applications across:
 * 1. Service Registrations (KEYS.SERVICES)
 * 2. Govt Cases (KEYS.GOVT_CASES)
 * 3. Customer Follow-up Cases (KEYS.FOLLOWUP_CASES)
 * 4. Lead Registrations (KEYS.LEADS)
 * 5. Customer Registrations (KEYS.CUSTOMERS - only when registered specifically with eligible education/student/yuva service tags and not already in Services/Cases)
 *
 * Strictly deduplicated by Application ID, Service ID & Customer ID so duplicate rows never occur.
 */
export function getSynchronizedYuvaApplications() {
  const eligibleServices = getEligibleYuvaServices();
  const eligibleByName = new Map(eligibleServices.map(s => [s.serviceName.toLowerCase(), s]));
  const customers = getAllCustomers() || [];
  const custById = new Map(customers.map(c => [c.id, c]));
  const custByPhone = new Map();
  customers.forEach(c => {
    const p10 = normalizePhone10(c.phone);
    if (p10) custByPhone.set(p10, c);
  });

  const metaOverlay = getMetaOverlayMap();
  const recordsMap = new Map();
  const seenCustomerServiceKeys = new Set();

  const resolveCustomerInfo = (cid, phone, name) => {
    const p10 = normalizePhone10(phone);
    const c = (cid && custById.get(cid)) || (p10 && custByPhone.get(p10)) || null;
    return {
      customerId: c?.id || cid || '',
      studentName: normalizeText(name) || normalizeText(c?.name) || 'Walk-in Applicant',
      mobile: normalizePhone10(phone || c?.phone) || normalizeText(phone || c?.phone) || '-',
      village: normalizeText(c?.village || c?.address),
      ward: normalizeText(c?.gpOrWard || c?.wardNumber)
    };
  };

  const upsertUnifiedRecord = (candidate) => {
    const cls = classifyEligibleYuvaService({
      serviceName: candidate.serviceName,
      category: candidate.rawCategory,
      subcategory: candidate.subcategory,
      tags: candidate.tags,
      remarks: candidate.remarks
    });
    const matchedCatalog = eligibleByName.get(String(candidate.serviceName || '').trim().toLowerCase());
    if (!cls.eligible && !matchedCatalog) return;

    const finalCategory = cls.eligible ? cls.eligibleCategory : matchedCatalog.eligibleCategory;
    const appId = normalizeText(candidate.applicationId || candidate.sourceId);
    const serviceId = normalizeText(candidate.serviceId || matchedCatalog?.serviceId || candidate.serviceName);
    const customerKey = normalizeText(candidate.customerId || candidate.mobile);
    const dedupeComboKey = `${customerKey.toLowerCase()}::${String(candidate.serviceName || '').toLowerCase()}::${normalizeDateYmd(candidate.applicationDate)}`;

    // Prevent duplicates by unique Application ID or Customer+Service+Date signature
    if (recordsMap.has(appId)) return;
    if (customerKey && candidate.sourceType === 'CUSTOMER_REGISTRATION' && seenCustomerServiceKeys.has(`${customerKey.toLowerCase()}::${String(candidate.serviceName || '').toLowerCase()}`)) {
      return;
    }
    if (customerKey && seenCustomerServiceKeys.has(dedupeComboKey) && candidate.sourceType !== 'SERVICE_REGISTRATION') {
      return;
    }

    const overlayKey = `${candidate.sourceType}:${candidate.sourceId}`;
    const overlay = metaOverlay[overlayKey] || {};

    const appStatus = overlay.applicationStatus || mapApplicationStatus(candidate.applicationStatus);
    const approvalStatus = overlay.approvalStatus || deriveApprovalStatus(candidate.approvalStatus, appStatus);
    const disbursementAmount = overlay.disbursementAmount !== undefined
      ? Math.max(0, Number(overlay.disbursementAmount) || 0)
      : Math.max(0, Number(candidate.disbursementAmount) || 0);
    const paymentStatus = overlay.paymentStatus || derivePaymentStatus({
      explicitStatus: candidate.paymentStatus,
      totalAmount: candidate.totalAmount,
      paidAmount: candidate.paidAmount,
      disbursementAmount
    });

    const unified = {
      recordKey: overlayKey,
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      applicationId: appId,
      serviceId,
      customerId: candidate.customerId || '',
      studentName: candidate.studentName,
      mobile: candidate.mobile || '-',
      serviceName: candidate.serviceName,
      serviceCategory: finalCategory,
      rawCategory: candidate.rawCategory || finalCategory,
      tags: Array.from(new Set([...(candidate.tags || []), ...(matchedCatalog?.tags || []), ...(cls.matchedTags || [])])),
      applicationDate: normalizeDateYmd(candidate.applicationDate),
      applicationStatus: appStatus,
      approvalStatus,
      disbursementAmount,
      paymentStatus,
      serviceFeeTotal: Number(candidate.totalAmount) || 0,
      serviceFeePaid: Number(candidate.paidAmount) || 0,
      remarks: overlay.remarks !== undefined ? overlay.remarks : normalizeText(candidate.remarks),
      village: candidate.village || '',
      ward: candidate.ward || '',
      updatedAt: overlay.updatedAt || candidate.updatedAt || candidate.createdAt || ''
    };

    recordsMap.set(appId, unified);
    if (customerKey) {
      seenCustomerServiceKeys.add(`${customerKey.toLowerCase()}::${String(candidate.serviceName || '').toLowerCase()}`);
      seenCustomerServiceKeys.add(dedupeComboKey);
    }
  };

  // 1. Service Registrations (KEYS.SERVICES)
  (getAllServices() || []).forEach(srv => {
    const cust = resolveCustomerInfo(srv.customerId, srv.phone, srv.customerName);
    upsertUnifiedRecord({
      sourceType: 'SERVICE_REGISTRATION',
      sourceId: srv.id,
      applicationId: srv.refNumber || srv.id,
      serviceId: srv.rateId || srv.serviceId || srv.id,
      customerId: cust.customerId,
      studentName: cust.studentName,
      mobile: cust.mobile,
      serviceName: srv.serviceName || srv.subcategory || srv.category,
      rawCategory: srv.category,
      subcategory: srv.subcategory,
      tags: srv.tags || [],
      applicationDate: srv.appDate || srv.date || srv.createdAt,
      applicationStatus: srv.status,
      approvalStatus: srv.approvalStatus || '',
      disbursementAmount: srv.disbursementAmount || 0,
      paymentStatus: srv.yuvaPaymentStatus || '',
      totalAmount: srv.totalAmount || srv.totalFee || 0,
      paidAmount: srv.paidAmount || srv.advancePayment || 0,
      remarks: srv.remarks,
      village: cust.village,
      ward: cust.ward,
      updatedAt: srv.updatedAt,
      createdAt: srv.createdAt
    });
  });

  // 2. Govt Scheme Cases (KEYS.GOVT_CASES)
  (getAllGovtCases() || []).forEach(gc => {
    const cust = resolveCustomerInfo(gc.customerId, gc.mobile || gc.phone, gc.applicantName || gc.customerName);
    upsertUnifiedRecord({
      sourceType: 'GOVT_CASE',
      sourceId: gc.id,
      applicationId: gc.caseId || gc.referenceNumber || gc.id,
      serviceId: gc.schemeId || gc.schemeName,
      customerId: cust.customerId,
      studentName: cust.studentName,
      mobile: cust.mobile,
      serviceName: gc.schemeName || gc.serviceName || gc.caseCategory,
      rawCategory: gc.caseCategory || gc.govtLevel,
      subcategory: gc.schemeName,
      tags: [gc.govtLevel, gc.caseCategory, gc.schemeName].filter(Boolean),
      applicationDate: gc.applicationDate || gc.createdAt,
      applicationStatus: gc.currentStatus || gc.status,
      approvalStatus: gc.approvalStatus || '',
      disbursementAmount: gc.disbursementAmount || gc.benefitAmount || 0,
      paymentStatus: gc.paymentStatus || '',
      remarks: gc.remarks || gc.description,
      village: gc.village || cust.village,
      ward: gc.gpOrWard || cust.ward,
      updatedAt: gc.updatedAt,
      createdAt: gc.createdAt
    });
  });

  // 3. Follow-up Cases (KEYS.FOLLOWUP_CASES)
  const followupCases = getItem(KEYS.FOLLOWUP_CASES, []);
  (Array.isArray(followupCases) ? followupCases : []).forEach(fc => {
    const cust = resolveCustomerInfo(fc.customerId, fc.phone || fc.mobile, fc.customerName || fc.applicantName);
    upsertUnifiedRecord({
      sourceType: 'FOLLOWUP_CASE',
      sourceId: fc.id,
      applicationId: fc.applicationNumber || fc.caseNumber || fc.id,
      serviceId: fc.serviceId || fc.serviceName,
      customerId: cust.customerId,
      studentName: cust.studentName,
      mobile: cust.mobile,
      serviceName: fc.serviceName || fc.category || fc.subject,
      rawCategory: fc.category,
      subcategory: fc.subcategory || fc.serviceName,
      tags: fc.tags || [fc.caseType].filter(Boolean),
      applicationDate: fc.submissionDate || fc.date || fc.createdAt,
      applicationStatus: fc.currentStatus || fc.status,
      approvalStatus: fc.approvalStatus || '',
      disbursementAmount: fc.disbursementAmount || 0,
      paymentStatus: fc.paymentStatus || '',
      remarks: fc.remarks || fc.notes,
      village: cust.village,
      ward: cust.ward,
      updatedAt: fc.updatedAt,
      createdAt: fc.createdAt
    });
  });

  // 4. Leads Registration (KEYS.LEADS)
  const leads = getItem(KEYS.LEADS, []);
  (Array.isArray(leads) ? leads : []).forEach(ld => {
    const cust = resolveCustomerInfo(ld.customerId, ld.phone || ld.mobile, ld.name || ld.customerName);
    upsertUnifiedRecord({
      sourceType: 'LEAD_REGISTRATION',
      sourceId: ld.id,
      applicationId: ld.leadCode || ld.id,
      serviceId: ld.serviceId || ld.serviceName || ld.interest,
      customerId: cust.customerId,
      studentName: cust.studentName,
      mobile: cust.mobile,
      serviceName: ld.serviceName || ld.interest || ld.service || ld.category,
      rawCategory: ld.category || ld.source || '',
      subcategory: ld.subcategory || ld.serviceName || ld.interest,
      tags: ld.tags || [ld.source, ld.interest].filter(Boolean),
      applicationDate: ld.date || ld.createdAt,
      applicationStatus: ld.status || 'Registered',
      approvalStatus: ld.approvalStatus || '',
      disbursementAmount: ld.disbursementAmount || 0,
      paymentStatus: ld.paymentStatus || '',
      remarks: ld.notes || ld.remarks,
      village: ld.village || cust.village,
      ward: cust.ward,
      updatedAt: ld.updatedAt,
      createdAt: ld.createdAt
    });
  });

  // 5. Customer Registrations with directly tagged eligible education/student services
  customers.forEach(c => {
    const custServices = Array.isArray(c.services) ? c.services : [];
    const custTags = parseTagsArray(c.tags || c.serviceCategory);
    custServices.forEach((svcName, sIdx) => {
      upsertUnifiedRecord({
        sourceType: 'CUSTOMER_REGISTRATION',
        sourceId: `${c.id}__${sIdx}`,
        applicationId: `${c.id}-EDU-${String(sIdx + 1).padStart(2, '0')}`,
        serviceId: `${svcName}`,
        customerId: c.id,
        studentName: c.name,
        mobile: normalizePhone10(c.phone) || c.phone || '-',
        serviceName: svcName,
        rawCategory: c.serviceCategory || '',
        subcategory: svcName,
        tags: custTags,
        applicationDate: c.regDate || c.createdAt,
        applicationStatus: 'Registered',
        approvalStatus: 'Pending',
        disbursementAmount: 0,
        paymentStatus: 'Pending',
        remarks: c.notes || c.remarks || '',
        village: c.village || c.address || '',
        ward: c.gpOrWard || c.wardNumber || '',
        updatedAt: c.updatedAt,
        createdAt: c.createdAt
      });
    });
  });

  return Array.from(recordsMap.values()).sort((a, b) =>
    String(b.applicationDate || '').localeCompare(String(a.applicationDate || '')) ||
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  );
}

/**
 * Update Approval / Application Status / Disbursement / Payment Status
 * Synchronizes directly back into master records (no duplicate database).
 */
export function updateYuvaApplicationProgress(recordKey, updates = {}) {
  const records = getSynchronizedYuvaApplications();
  const target = records.find(r => r.recordKey === recordKey || r.applicationId === recordKey);
  if (!target) {
    return { success: false, message: 'Synchronized application record not found.' };
  }

  const user = getCurrentUser();
  const actor = user?.name || user?.uid || 'Staff';
  const nowIso = new Date().toISOString();

  const nextAppStatus = normalizeText(updates.applicationStatus) || target.applicationStatus;
  const nextApprovalStatus = normalizeText(updates.approvalStatus) || target.approvalStatus;
  const nextDisbursement = updates.disbursementAmount !== undefined
    ? Math.max(0, Number(updates.disbursementAmount) || 0)
    : target.disbursementAmount;
  const nextPaymentStatus = normalizeText(updates.paymentStatus) || target.paymentStatus;
  const nextRemarks = updates.remarks !== undefined ? normalizeText(updates.remarks) : target.remarks;

  // Save overlay metadata for cross-store consistency
  const metaMap = getMetaOverlayMap();
  metaMap[target.recordKey] = {
    applicationStatus: nextAppStatus,
    approvalStatus: nextApprovalStatus,
    disbursementAmount: nextDisbursement,
    paymentStatus: nextPaymentStatus,
    remarks: nextRemarks,
    updatedAt: nowIso,
    updatedBy: actor
  };
  saveMetaOverlayMap(metaMap);

  // Sync directly back to the master store record
  if (target.sourceType === 'SERVICE_REGISTRATION') {
    const services = getAllServices();
    const idx = services.findIndex(s => s.id === target.sourceId);
    if (idx !== -1) {
      services[idx] = {
        ...services[idx],
        status: nextAppStatus,
        approvalStatus: nextApprovalStatus,
        disbursementAmount: nextDisbursement,
        yuvaPaymentStatus: nextPaymentStatus,
        remarks: nextRemarks,
        updatedAt: nowIso
      };
      setItem(KEYS.SERVICES, services);
    }
  } else if (target.sourceType === 'GOVT_CASE') {
    const cases = getAllGovtCases();
    const idx = cases.findIndex(c => c.id === target.sourceId);
    if (idx !== -1) {
      cases[idx] = {
        ...cases[idx],
        currentStatus: nextAppStatus,
        approvalStatus: nextApprovalStatus,
        disbursementAmount: nextDisbursement,
        paymentStatus: nextPaymentStatus,
        remarks: nextRemarks,
        updatedAt: nowIso
      };
      setItem(KEYS.GOVT_CASES, cases);
    }
  } else if (target.sourceType === 'FOLLOWUP_CASE') {
    const fcList = getItem(KEYS.FOLLOWUP_CASES, []);
    const idx = Array.isArray(fcList) ? fcList.findIndex(f => f.id === target.sourceId) : -1;
    if (idx !== -1) {
      fcList[idx] = {
        ...fcList[idx],
        currentStatus: nextAppStatus,
        approvalStatus: nextApprovalStatus,
        disbursementAmount: nextDisbursement,
        paymentStatus: nextPaymentStatus,
        remarks: nextRemarks,
        updatedAt: nowIso
      };
      setItem(KEYS.FOLLOWUP_CASES, fcList);
    }
  } else if (target.sourceType === 'LEAD_REGISTRATION') {
    const leads = getItem(KEYS.LEADS, []);
    const idx = Array.isArray(leads) ? leads.findIndex(l => l.id === target.sourceId) : -1;
    if (idx !== -1) {
      leads[idx] = {
        ...leads[idx],
        status: nextAppStatus,
        approvalStatus: nextApprovalStatus,
        disbursementAmount: nextDisbursement,
        paymentStatus: nextPaymentStatus,
        notes: nextRemarks,
        updatedAt: nowIso
      };
      setItem(KEYS.LEADS, leads);
    }
  }

  logAuditAction(
    'YUVA_SIKSHA_UPDATE',
    `Updated ${target.applicationId} (${target.studentName}): App=${nextAppStatus}, Approval=${nextApprovalStatus}, Disbursement=₹${nextDisbursement}, Payment=${nextPaymentStatus}`,
    actor
  );

  return { success: true };
}

/**
 * Dynamically calculate all 9 KPIs from synchronized records
 */
export function computeYuvaDashboardStats(records = null) {
  const list = Array.isArray(records) ? records : getSynchronizedYuvaApplications();
  const today = getTodayDate();
  const currentMonth = today.slice(0, 7);

  let totalApplications = list.length;
  let todaysApplications = 0;
  let monthlyApplications = 0;
  let pendingApplications = 0;
  let approvedApplications = 0;
  let rejectedApplications = 0;
  let activeApplications = 0;
  let totalDisbursement = 0;
  let monthlyDisbursement = 0;

  list.forEach(r => {
    const dt = String(r.applicationDate || '');
    const appSt = String(r.applicationStatus || '').toLowerCase();
    const apprSt = String(r.approvalStatus || '').toLowerCase();
    const disb = Math.max(0, Number(r.disbursementAmount) || 0);

    if (dt === today) todaysApplications++;
    if (dt.startsWith(currentMonth)) {
      monthlyApplications++;
      monthlyDisbursement += disb;
    }
    totalDisbursement += disb;

    const isRejected = /reject|cancel/.test(appSt) || /reject/.test(apprSt);
    const isApproved = !isRejected && (/approv|sanction/.test(apprSt) || /approv|sanction/.test(appSt));
    const isCompleted = /complet|deliver|closed/.test(appSt);
    const isActive = !isRejected && !isCompleted && (appSt === 'active' || /process|review|approv|sanction|registered/.test(appSt));
    const isPending = !isRejected && !isApproved && !isCompleted;

    if (isRejected) rejectedApplications++;
    if (isApproved) approvedApplications++;
    if (isPending) pendingApplications++;
    if (isActive) activeApplications++;
  });

  return {
    totalApplications,
    todaysApplications,
    monthlyApplications,
    pendingApplications,
    approvedApplications,
    rejectedApplications,
    activeApplications,
    totalDisbursement,
    monthlyDisbursement
  };
}

/**
 * Filter synchronized application records
 */
export function filterYuvaApplications(records, filters = {}) {
  const list = Array.isArray(records) ? records : getSynchronizedYuvaApplications();
  const q = String(filters.query || '').trim().toLowerCase();
  const serviceFilter = String(filters.service || 'all').trim();
  const categoryFilter = String(filters.category || 'all').trim();
  const statusFilter = String(filters.status || 'all').trim();
  const dateFrom = String(filters.dateFrom || '').trim();
  const dateTo = String(filters.dateTo || '').trim();
  const yearFilter = String(filters.year || 'all').trim();
  const monthFilter = String(filters.month || 'all').trim();

  return list.filter(r => {
    if (q) {
      const hay = [
        r.applicationId,
        r.studentName,
        r.mobile,
        r.serviceName,
        r.serviceCategory,
        r.applicationStatus,
        r.approvalStatus,
        r.paymentStatus,
        r.village,
        r.ward,
        ...(r.tags || [])
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (serviceFilter !== 'all' && r.serviceName !== serviceFilter) return false;
    if (categoryFilter !== 'all' && r.serviceCategory !== categoryFilter) return false;
    if (statusFilter !== 'all') {
      if (r.applicationStatus !== statusFilter && r.approvalStatus !== statusFilter) return false;
    }
    if (dateFrom && r.applicationDate < dateFrom) return false;
    if (dateTo && r.applicationDate > dateTo) return false;
    if (yearFilter !== 'all' && !String(r.applicationDate || '').startsWith(yearFilter)) return false;
    if (monthFilter !== 'all' && !String(r.applicationDate || '').startsWith(monthFilter)) return false;
    return true;
  });
}

/**
 * Build interactive monthly Chart.js Bar Chart dataset
 */
export function buildYuvaMonthlyAnalytics(records, filters = {}) {
  const list = Array.isArray(records) ? records : getSynchronizedYuvaApplications();
  const targetYear = filters.year && filters.year !== 'all' ? filters.year : String(new Date().getFullYear());
  const dateFiltered = list.filter(r => {
    if (filters.dateFrom && r.applicationDate < filters.dateFrom) return false;
    if (filters.dateTo && r.applicationDate > filters.dateTo) return false;
    if (filters.month && filters.month !== 'all' && !String(r.applicationDate || '').startsWith(filters.month)) return false;
    if (filters.year && filters.year !== 'all' && !String(r.applicationDate || '').startsWith(filters.year)) return false;
    return true;
  });

  // Determine month buckets (12 months of selected year or dynamically across filtered dates)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const bucketMap = new Map();

  if (filters.month && filters.month !== 'all') {
    const [yr, mo] = filters.month.split('-');
    const lbl = `${monthNames[(Number(mo) || 1) - 1] || mo} ${yr}`;
    bucketMap.set(filters.month, { label: lbl, registered: 0, approved: 0, active: 0, pending: 0, disbursement: 0 });
  } else {
    for (let m = 1; m <= 12; m++) {
      const ym = `${targetYear}-${String(m).padStart(2, '0')}`;
      bucketMap.set(ym, { label: `${monthNames[m - 1]} ${targetYear}`, registered: 0, approved: 0, active: 0, pending: 0, disbursement: 0 });
    }
  }

  dateFiltered.forEach(r => {
    const ym = String(r.applicationDate || '').slice(0, 7);
    if (!ym) return;
    if (!bucketMap.has(ym)) {
      const [yr, mo] = ym.split('-');
      const mIdx = (Number(mo) || 1) - 1;
      bucketMap.set(ym, { label: `${monthNames[mIdx] || mo} ${yr}`, registered: 0, approved: 0, active: 0, pending: 0, disbursement: 0 });
    }
    const b = bucketMap.get(ym);
    b.registered += 1;
    const appSt = String(r.applicationStatus || '').toLowerCase();
    const apprSt = String(r.approvalStatus || '').toLowerCase();
    const isRejected = /reject|cancel/.test(appSt) || /reject/.test(apprSt);
    const isApproved = !isRejected && (/approv|sanction/.test(apprSt) || /approv|sanction/.test(appSt));
    const isCompleted = /complet|deliver|closed/.test(appSt);
    const isActive = !isRejected && !isCompleted && (appSt === 'active' || /process|review|approv|sanction|registered/.test(appSt));
    const isPending = !isRejected && !isApproved && !isCompleted;

    if (isApproved) b.approved += 1;
    if (isActive) b.active += 1;
    if (isPending) b.pending += 1;
    b.disbursement += Math.max(0, Number(r.disbursementAmount) || 0);
  });

  const sortedKeys = Array.from(bucketMap.keys()).sort();
  const labels = sortedKeys.map(k => bucketMap.get(k).label);
  const registered = sortedKeys.map(k => bucketMap.get(k).registered);
  const approved = sortedKeys.map(k => bucketMap.get(k).approved);
  const active = sortedKeys.map(k => bucketMap.get(k).active);
  const pending = sortedKeys.map(k => bucketMap.get(k).pending);
  const disbursement = sortedKeys.map(k => bucketMap.get(k).disbursement);

  return {
    labels,
    registered,
    approved,
    active,
    pending,
    disbursement,
    monthKeys: sortedKeys
  };
}

/**
 * Excel, PDF & Print Exports for Banglar Yuva Siksha Barasa Card Management
 */
export async function exportYuvaApplications(records, format = 'excel') {
  const list = Array.isArray(records) ? records : [];
  const today = getTodayDate();
  const headers = [
    'SL No.',
    'Application ID',
    'Customer / Student Name',
    'Mobile Number',
    'Service Name',
    'Service Category',
    'Application Date',
    'Application Status',
    'Approval Status',
    'Disbursement Amount (INR)',
    'Payment Status'
  ];

  let totalDisb = 0;
  const rows = list.map((r, i) => {
    const disb = Math.max(0, Number(r.disbursementAmount) || 0);
    totalDisb += disb;
    return [
      i + 1,
      r.applicationId,
      r.studentName,
      r.mobile || '-',
      r.serviceName,
      r.serviceCategory,
      formatDate(r.applicationDate),
      r.applicationStatus,
      r.approvalStatus,
      disb,
      r.paymentStatus
    ];
  });

  const totalsRow = ['TOTAL', `${list.length} Apps`, '', '', '', '', '', '', '', totalDisb, ''];
  const filename = `MUN_Banglar_Yuva_Siksha_Barasa_${today}`;
  const title = 'BANGLAR YUVA SIKSHA BARASA CARD MANAGEMENT — APPLICATION REGISTER';
  const subtitle = `Total Synchronized Records: ${list.length} | Total Disbursement: Rs. ${totalDisb.toLocaleString('en-IN')}`;

  if (format === 'csv') {
    exportUniversalCSV({ filename, title, subtitle, headers, rows, totalsRow });
    return { success: true, message: 'Exported CSV file.' };
  }
  if (format === 'excel') {
    exportUniversalExcel({ filename, sheetName: 'Yuva_Siksha_Barasa', title, subtitle, headers, rows, totalsRow });
    return { success: true, message: 'Exported Excel (.xlsx) workbook.' };
  }
  if (format === 'pdf') {
    await exportUniversalPDF({
      filename,
      title,
      subtitle,
      orientation: 'landscape',
      headers,
      rows,
      totalsRow
    });
    return { success: true, message: 'Exported PDF report.' };
  }
  printUniversalReport({
    title,
    subtitle,
    filename,
    orientation: 'landscape',
    headers,
    rows,
    totalsRow
  });
  return { success: true, message: 'Opened Print Preview.' };
}
