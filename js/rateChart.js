/**
 * rateChart.js - Service List & Rate Chart Management + First-Time Manual Setup
 * MUN COMPUTER BUSINESS MANAGER
 */

import { getItem, setItem, getTodayDate, allocateGlobalReference, markGlobalReferenceDeleted, formatINR, syncAmountWords, logAuditAction } from './storage.js';
import { canMenu } from './auth.js';
import {
  getBaseServiceCatalog,
  getServiceCategories,
  getBaseUnifiedServiceList,
  getCustomSubServices,
  addCustomServiceEntry,
  updateCustomServiceEntry,
  removeCatalogService,
  restoreCatalogService,
  getRemovedCatalogServices,
  restoreAllRemovedCatalogServices,
  registerRateChartInitializer,
  emitRateChartUpdated
} from './services.js';
import { showA4PrintPdfPopup } from './a4PrintPopup.js';
import { renderBwDocumentHeader, renderAcknowledgementSection } from './documentEngine.js';
import { exportUniversalCSV, exportUniversalExcel, exportUniversalPDF } from './exportUtility.js';

export const RATE_CHART_KEY = 'mun_service_rate_chart_v1';
export const RATE_CHART_META_KEY = 'mun_service_rate_chart_meta_v1';

export const SERVICE_UNITS = [
  'Per Application',
  'Per Page',
  'Per Card',
  'Per Copy',
  'Per Document',
  'Per Transaction',
  'Per Set',
  'Fixed Charge'
];

// Recommended baseline fees across all 25 categories (user can edit/clear/customize manually anytime)
const DEFAULT_CATEGORY_RATES = {
  'Online Form Fill-up': { charge: 50, govFee: 0, unit: 'Per Application' },
  'Job Application': { charge: 100, govFee: 0, unit: 'Per Application' },
  'Exam Services': { charge: 40, govFee: 0, unit: 'Per Application' },
  'Education': { charge: 60, govFee: 0, unit: 'Per Application' },
  'PAN Card': { charge: 150, govFee: 107, unit: 'Per Application' },
  'Aadhaar Assistance': { charge: 50, govFee: 0, unit: 'Per Application' },
  'Voter Card': { charge: 50, govFee: 0, unit: 'Per Application' },
  'Passport': { charge: 300, govFee: 1500, unit: 'Per Application' },
  'Certificates': { charge: 60, govFee: 0, unit: 'Per Application' },
  'Ration Card': { charge: 50, govFee: 0, unit: 'Per Application' },
  'Land Services': { charge: 80, govFee: 20, unit: 'Per Application' },
  'Printing': { charge: 5, govFee: 0, unit: 'Per Page' },
  'Xerox': { charge: 2, govFee: 0, unit: 'Per Page' },
  'Scanning': { charge: 10, govFee: 0, unit: 'Per Page' },
  'Photo Editing': { charge: 50, govFee: 0, unit: 'Per Set' },
  'PVC Card': { charge: 50, govFee: 0, unit: 'Per Card' },
  'PDF Services': { charge: 20, govFee: 0, unit: 'Per Document' },
  'Typing': { charge: 30, govFee: 0, unit: 'Per Page' },
  'Computer Services': { charge: 30, govFee: 0, unit: 'Per Document' },
  'Internet Services': { charge: 30, govFee: 0, unit: 'Per Application' },
  'Recharge': { charge: 0, govFee: 0, unit: 'Per Transaction' },
  'Bill Payment': { charge: 10, govFee: 0, unit: 'Per Transaction' },
  'Travel': { charge: 50, govFee: 0, unit: 'Per Application' },
  'Business Services': { charge: 250, govFee: 0, unit: 'Per Application' },
  'PNB CSP / Banking': { charge: 0, govFee: 0, unit: 'Per Transaction' },
  'Banglar Yuva Siksha Barasa Card': { charge: 50, govFee: 0, unit: 'Per Application' },
  'Student Welfare Schemes': { charge: 60, govFee: 0, unit: 'Per Application' },
  'Education Loan': { charge: 80, govFee: 0, unit: 'Per Application' },
  'Student Financial Assistance': { charge: 60, govFee: 0, unit: 'Per Application' },
  'Youth Welfare Schemes': { charge: 50, govFee: 0, unit: 'Per Application' },
  'Educational Services': { charge: 50, govFee: 0, unit: 'Per Application' },
  'Skill Development & Training': { charge: 60, govFee: 0, unit: 'Per Application' },
  'Other Student & Youth-Related Services': { charge: 50, govFee: 0, unit: 'Per Application' },
  'Other Services': { charge: 20, govFee: 0, unit: 'Per Copy' }
};

const SPECIFIC_RATE_OVERRIDES = {
  'Black & White Print': { charge: 5, govFee: 0, unit: 'Per Page' },
  'Colour Print': { charge: 15, govFee: 0, unit: 'Per Page' },
  'Photo Print': { charge: 40, govFee: 0, unit: 'Per Set' },
  'Black & White Xerox': { charge: 2, govFee: 0, unit: 'Per Page' },
  'Colour Xerox': { charge: 10, govFee: 0, unit: 'Per Page' },
  'Bulk Xerox': { charge: 1, govFee: 0, unit: 'Per Page' },
  'Passport Photo': { charge: 50, govFee: 0, unit: 'Per Set' },
  'Stamp Size Photo': { charge: 40, govFee: 0, unit: 'Per Set' },
  'Lamination': { charge: 20, govFee: 0, unit: 'Per Copy' },
  'Binding': { charge: 40, govFee: 0, unit: 'Per Copy' },
  'Aadhaar PVC': { charge: 50, govFee: 0, unit: 'Per Card' },
  'PAN PVC': { charge: 50, govFee: 0, unit: 'Per Card' },
  'Voter PVC': { charge: 50, govFee: 0, unit: 'Per Card' },
  'ID Card': { charge: 60, govFee: 0, unit: 'Per Card' },
  'Custom PVC': { charge: 60, govFee: 0, unit: 'Per Card' },
  'New PAN': { charge: 150, govFee: 107, unit: 'Per Application' },
  'Correction': { charge: 150, govFee: 107, unit: 'Per Application' },
  'e-PAN': { charge: 50, govFee: 0, unit: 'Per Application' },
  'Aadhaar Download': { charge: 30, govFee: 0, unit: 'Per Copy' },
  'PVC Order Assistance': { charge: 50, govFee: 50, unit: 'Per Card' },
  'GST Application Assistance': { charge: 500, govFee: 0, unit: 'Per Application' },
  'Udyam Registration': { charge: 200, govFee: 0, unit: 'Per Application' },
  'FSSAI Application': { charge: 300, govFee: 100, unit: 'Per Application' }
};

function buildInitialRateChart(applySuggestedRates = false) {
  const items = [];
  const seen = new Set();

  const addEntry = (entry) => {
    const key = `${entry.category}::${entry.serviceName}`.toLowerCase().trim();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      id: entry.id || `RATE-${String(items.length + 1).padStart(4, '0')}`,
      category: entry.category,
      serviceName: entry.serviceName,
      nameBn: entry.nameBn || '',
      unit: entry.unit || 'Per Application',
      serviceCharge: Number(entry.serviceCharge) || 0,
      govFee: Number(entry.govFee) || 0,
      isActive: entry.isActive !== false,
      isCustom: Boolean(entry.isCustom),
      configured: Boolean(entry.configured),
      remarks: entry.remarks || ''
    });
  };

  // 1. Add all Unified Service Directory services (Govt schemes, CSC, Grievances, Cyber services, Custom)
  (getBaseUnifiedServiceList() || []).forEach((s, idx) => {
    const def = DEFAULT_CATEGORY_RATES[s.category] || { charge: 0, govFee: 0, unit: 'Per Application' };
    const useRate = applySuggestedRates || Boolean(s.isCustom);
    addEntry({
      id: `RATE-UNI-${String(idx + 1).padStart(3, '0')}`,
      category: s.category || 'Online Form Fill-up',
      serviceName: s.name,
      nameBn: s.nameBn || '',
      unit: s.unit || def.unit,
      serviceCharge: useRate ? (s.defaultCharge !== undefined ? s.defaultCharge : def.charge) : 0,
      govFee: useRate ? (s.defaultGovFee !== undefined ? s.defaultGovFee : def.govFee) : 0,
      isActive: true,
      isCustom: Boolean(s.isCustom),
      configured: Boolean(s.isCustom),
      remarks: s.remarks || (s.isGovtScheme ? 'Govt Scheme' : s.isGrievance ? 'Grievance Portal' : '')
    });
  });

  // 2. Add all SERVICE_CATALOG + custom categories & subcategories
  let catIdx = 1;
  Object.entries(getBaseServiceCatalog()).forEach(([cat, subcats]) => {
    const def = DEFAULT_CATEGORY_RATES[cat] || { charge: 0, govFee: 0, unit: 'Per Application' };
    (subcats || []).forEach(sub => {
      const spec = SPECIFIC_RATE_OVERRIDES[sub] || {};
      addEntry({
        id: `RATE-CAT-${String(catIdx++).padStart(3, '0')}`,
        category: cat,
        serviceName: sub,
        nameBn: '',
        unit: spec.unit || def.unit,
        serviceCharge: applySuggestedRates ? (spec.charge !== undefined ? spec.charge : def.charge) : 0,
        govFee: applySuggestedRates ? (spec.govFee !== undefined ? spec.govFee : def.govFee) : 0,
        isActive: true,
        configured: false,
        remarks: ''
      });
    });
  });

  return items;
}

export function getRateChartMeta() {
  return getItem(RATE_CHART_META_KEY, {
    manualSetupCompleted: false,
    seeded: false,
    lastUpdatedAt: null
  });
}

export function setRateChartMeta(meta) {
  const existing = getRateChartMeta();
  const updated = { ...existing, ...meta, lastUpdatedAt: new Date().toISOString() };
  setItem(RATE_CHART_META_KEY, updated);
  return updated;
}

export function getAllRateChartItems() {
  let list = getItem(RATE_CHART_KEY, null);
  const meta = getRateChartMeta();
  if (!Array.isArray(list) || (list.length === 0 && !meta?.seeded)) {
    list = buildInitialRateChart();
    setItem(RATE_CHART_KEY, list);
    setRateChartMeta({ seeded: true });
  }
  return list;
}

export function getRateChartItemById(id) {
  if (!id) return null;
  return getAllRateChartItems().find(x => x.id === id) || null;
}

export function saveRateChartItems(items, markSetupComplete = false, reason = 'save') {
  setItem(RATE_CHART_KEY, items);
  if (markSetupComplete) {
    setRateChartMeta({ manualSetupCompleted: true, seeded: true });
  } else {
    setRateChartMeta({ seeded: true });
  }
  logAuditAction('RATE_CHART_UPDATE', `Updated Service Rate Chart (${items.length} services)`);
  emitRateChartUpdated(reason);
  return items;
}

export async function upsertRateChartItem(itemData) {
  const list = getAllRateChartItems();
  const charge = Math.max(0, Number(itemData.serviceCharge) || 0);
  const govFee = Math.max(0, Number(itemData.govFee) || 0);
  const cleanCat = String(itemData.category || 'Other Services').trim();
  const cleanName = String(itemData.serviceName || '').trim();

  const cleanTags = Array.isArray(itemData.tags)
    ? itemData.tags.map(t => String(t || '').trim()).filter(Boolean)
    : String(itemData.tags || '').split(/[,;|]+/).map(t => t.trim()).filter(Boolean);

  if (itemData.id) {
    const idx = list.findIndex(x => x.id === itemData.id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...itemData,
        category: cleanCat,
        subcategory: itemData.subcategory !== undefined ? String(itemData.subcategory || '').trim() : (list[idx].subcategory || cleanName || list[idx].serviceName),
        tags: itemData.tags !== undefined ? cleanTags : (list[idx].tags || []),
        serviceName: cleanName || list[idx].serviceName,
        serviceCharge: charge,
        govFee,
        configured: true,
        updatedAt: new Date().toISOString()
      };
      saveRateChartItems(list, false, 'upsert');
      return { success: true, item: list[idx], isNew: false };
    }
  }

  // Update existing entry if exact category + serviceName already exists
  const dupIdx = list.findIndex(
    x => x.category.toLowerCase() === cleanCat.toLowerCase() && x.serviceName.toLowerCase() === cleanName.toLowerCase()
  );
  if (dupIdx !== -1) {
    list[dupIdx] = {
      ...list[dupIdx],
      ...itemData,
      category: cleanCat,
      subcategory: itemData.subcategory !== undefined ? String(itemData.subcategory || '').trim() : (list[dupIdx].subcategory || cleanName),
      tags: itemData.tags !== undefined ? cleanTags : (list[dupIdx].tags || []),
      serviceName: cleanName,
      serviceCharge: charge,
      govFee,
      isActive: itemData.isActive !== false,
      configured: true,
      updatedAt: new Date().toISOString()
    };
    saveRateChartItems(list, false, 'upsert');
    return { success: true, item: list[dupIdx], isNew: false };
  }

  const newRateId = await allocateGlobalReference('SITEM', { entityType: 'RATE_CHART_ITEM' });
  const newItem = {
    id: newRateId,
    category: cleanCat,
    subcategory: String(itemData.subcategory || cleanName).trim(),
    serviceName: cleanName,
    nameBn: (itemData.nameBn || '').trim(),
    unit: itemData.unit || 'Per Application',
    serviceCharge: charge,
    govFee,
    tags: cleanTags,
    isActive: itemData.isActive !== false,
    isCustom: Boolean(itemData.isCustom),
    configured: true,
    remarks: (itemData.remarks || '').trim(),
    createdAt: new Date().toISOString()
  };

  list.unshift(newItem);
  saveRateChartItems(list, false, 'upsert');
  return { success: true, item: newItem, isNew: true };
}

export function deleteRateChartItem(id) {
  const list = getAllRateChartItems();
  const target = list.find(x => x.id === id);
  if (!target) return { success: false };
  const updated = list.filter(x => x.id !== id);
  saveRateChartItems(updated, false, 'delete');
  markGlobalReferenceDeleted(id, 'DELETED');
  removeCatalogService(target.category, target.serviceName);
  return { success: true, deleted: target };
}

export function deleteMultipleRateChartItems(ids = []) {
  const idSet = new Set((ids || []).map(String));
  if (idSet.size === 0) return { success: false, count: 0 };
  const list = getAllRateChartItems();
  const removedItems = list.filter(x => idSet.has(x.id));
  const updated = list.filter(x => !idSet.has(x.id));
  saveRateChartItems(updated, false, 'bulk_delete');
  removedItems.forEach(item => removeCatalogService(item.category, item.serviceName));
  return { success: true, count: removedItems.length };
}

export async function restoreRateChartServiceEntry(category, serviceName) {
  const cleanCat = String(category || 'Other Services').trim();
  const cleanName = String(serviceName || '').trim();
  if (!cleanName) return { success: false };
  restoreCatalogService(cleanCat, cleanName);

  const list = getAllRateChartItems();
  const existingIdx = list.findIndex(
    x => x.category.toLowerCase() === cleanCat.toLowerCase() && x.serviceName.toLowerCase() === cleanName.toLowerCase()
  );
  if (existingIdx !== -1) {
    list[existingIdx] = { ...list[existingIdx], isActive: true, updatedAt: new Date().toISOString() };
    saveRateChartItems(list, false, 'restore');
    return { success: true, item: list[existingIdx] };
  }

  const uniMatch = getBaseUnifiedServiceList().find(
    u => u.category.toLowerCase() === cleanCat.toLowerCase() && u.name.toLowerCase() === cleanName.toLowerCase()
  );
  const spec = SPECIFIC_RATE_OVERRIDES[cleanName] || {};
  const def = DEFAULT_CATEGORY_RATES[cleanCat] || { charge: 50, govFee: 0, unit: 'Per Application' };
  const restoredId = await allocateGlobalReference('SITEM', { entityType: 'RATE_CHART_ITEM' });
  const restoredItem = {
    id: restoredId,
    category: cleanCat,
    serviceName: cleanName,
    nameBn: uniMatch?.nameBn || '',
    unit: uniMatch?.unit || spec.unit || def.unit,
    serviceCharge: uniMatch ? (Number(uniMatch.defaultCharge) || 0) : (spec.charge !== undefined ? spec.charge : def.charge),
    govFee: uniMatch ? (Number(uniMatch.defaultGovFee) || 0) : (spec.govFee !== undefined ? spec.govFee : def.govFee),
    isActive: true,
    configured: false,
    remarks: uniMatch?.remarks || '',
    createdAt: new Date().toISOString()
  };
  list.unshift(restoredItem);
  saveRateChartItems(list, false, 'restore');
  return { success: true, item: restoredItem };
}

export async function restoreAllRateChartServiceEntries() {
  const removed = getRemovedCatalogServices();
  const res = restoreAllRemovedCatalogServices();
  const list = getAllRateChartItems();
  const seen = new Set(list.map(x => `${x.category}::${x.serviceName}`.toLowerCase()));
  const baseUni = getBaseUnifiedServiceList();

  let added = 0;
  for (const r of removed) {
    const key = `${r.category}::${r.serviceName}`.toLowerCase();
    const existingIdx = list.findIndex(x => `${x.category}::${x.serviceName}`.toLowerCase() === key);
    if (existingIdx !== -1) {
      if (list[existingIdx].isActive === false) {
        list[existingIdx].isActive = true;
        added++;
      }
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const uniMatch = baseUni.find(u => `${u.category}::${u.name}`.toLowerCase() === key);
    const spec = SPECIFIC_RATE_OVERRIDES[r.serviceName] || {};
    const def = DEFAULT_CATEGORY_RATES[r.category] || { charge: 50, govFee: 0, unit: 'Per Application' };
    const restoredId = await allocateGlobalReference('SITEM', { entityType: 'RATE_CHART_ITEM' });
    list.unshift({
      id: restoredId,
      category: r.category,
      serviceName: r.serviceName,
      nameBn: uniMatch?.nameBn || '',
      unit: uniMatch?.unit || spec.unit || def.unit,
      serviceCharge: uniMatch ? (Number(uniMatch.defaultCharge) || 0) : (spec.charge !== undefined ? spec.charge : def.charge),
      govFee: uniMatch ? (Number(uniMatch.defaultGovFee) || 0) : (spec.govFee !== undefined ? spec.govFee : def.govFee),
      isActive: true,
      configured: false,
      remarks: uniMatch?.remarks || '',
      createdAt: new Date().toISOString()
    });
    added++;
  }

  if (added > 0) {
    saveRateChartItems(list, false, 'restore_all');
  }
  return { success: true, count: Math.max(res.count || 0, added) };
}

export function clearAllRatesToZero() {
  const list = getAllRateChartItems().map(item => ({
    ...item,
    serviceCharge: 0,
    govFee: 0,
    configured: false
  }));
  saveRateChartItems(list, false, 'clear_zero');
  setRateChartMeta({ manualSetupCompleted: false, seeded: true });
  return list;
}

export function resetRateChartToDefaults() {
  restoreAllRemovedCatalogServices();
  const fresh = buildInitialRateChart(true);
  saveRateChartItems(fresh, false, 'reset_defaults');
  return fresh;
}

export function getRateForService(serviceName, category = '', subcategory = '') {
  const list = getAllRateChartItems().filter(x => x.isActive !== false);
  const qName = String(serviceName || '').trim().toLowerCase();
  const qSub = String(subcategory || '').trim().toLowerCase();
  const qCat = String(category || '').trim().toLowerCase();

  if (qName) {
    const exact = list.find(x => x.serviceName.toLowerCase() === qName && (!qCat || x.category.toLowerCase() === qCat));
    if (exact) return exact;
    const anyCat = list.find(x => x.serviceName.toLowerCase() === qName);
    if (anyCat) return anyCat;
  }
  if (qSub) {
    const subMatch = list.find(x => x.serviceName.toLowerCase() === qSub && (!qCat || x.category.toLowerCase() === qCat));
    if (subMatch) return subMatch;
  }
  return null;
}

registerRateChartInitializer(getAllRateChartItems);

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderRateChartView() {
  const items = getAllRateChartItems();
  const meta = getRateChartMeta();
  const searchQ = (window._rateChartSearch || '').toLowerCase().trim();
  const catFilter = window._rateChartCat || 'all';
  const modeFilter = window._rateChartFilterMode || 'all';

  const categories = Array.from(new Set([
    ...getServiceCategories(),
    ...items.map(i => i.category)
  ])).filter(Boolean);

  const filtered = items.filter(item => {
    if (catFilter !== 'all' && item.category !== catFilter) return false;
    if (modeFilter === 'active' && !item.isActive) return false;
    if (modeFilter === 'zero' && (Number(item.serviceCharge) + Number(item.govFee)) > 0) return false;
    if (modeFilter === 'configured' && !item.configured) return false;
    if (modeFilter === 'unconfigured' && item.configured) return false;
    if (searchQ) {
      const hit =
        item.serviceName.toLowerCase().includes(searchQ) ||
        (item.nameBn || '').toLowerCase().includes(searchQ) ||
        item.category.toLowerCase().includes(searchQ) ||
        (item.remarks || '').toLowerCase().includes(searchQ);
      if (!hit) return false;
    }
    return true;
  });

  const configuredCount = items.filter(i => i.configured).length;
  const activeCount = items.filter(i => i.isActive).length;
  const canAdd = canMenu('rate-chart', 'add');
  const canEdit = canMenu('rate-chart', 'edit');
  const canDelete = canMenu('rate-chart', 'delete');
  const canPrint = canMenu('rate-chart', 'print');

  return `
    <div class="page-header" style="margin-bottom:1rem;">
      <div>
        <h2 class="page-title" style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <span>💰 Service List & Rate Chart (সার্ভিস ও রেট চার্ট)</span>
          <span class="badge ${meta.manualSetupCompleted ? 'badge-success' : 'badge-warning'}" style="font-size:0.72rem;">
            ${meta.manualSetupCompleted ? '✓ Custom Rates Active' : 'Manual Rate Setup Pending'}
          </span>
          ${!canEdit ? `<span class="badge badge-info" style="font-size:0.72rem;">👁️ View-Only Rate Chart</span>` : ''}
        </h2>
        <p class="page-subtitle">
          ${canEdit
            ? 'প্রথমবার আপনার দোকানের সঠিক সার্ভিস চার্জ ও সরকারি ফি নিজে সেট করে সেভ করুন — এই রেট অটোমেটিক সার্ভিস এন্ট্রি, বিলিং এবং A4 রেট চার্ট প্রিন্ট/PDF-এ ব্যবহৃত হবে।'
            : 'অফিসিয়াল সার্ভিস ও রেট চার্ট তালিকা (শুধুমাত্র দেখার ও প্রিন্টের অনুমতি)। রেট পরিবর্তনের জন্য Administrator-এর সাথে যোগাযোগ করুন।'}
        </p>
      </div>
      <div class="page-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openCategoryCatalogModal()">
          📋 Official Directory (${activeCount})
        </button>
        ${canAdd ? `
          <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddRateItemModal()">
            + Add Custom Service
          </button>
        ` : ''}
        ${canEdit ? `
          <button type="button" class="btn btn-success btn-sm" onclick="window.MJK.saveAllInlineRates(true)">
            💾 Save All Edited Rates
          </button>
        ` : ''}
        ${canPrint ? `
          <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openRateChartA4Popup('customer')">
            📄 PDF / A4 Customer Chart
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openRateChartA4Popup('detailed')">
            🖨 Print A4 Detailed Chart
          </button>
          <button type="button" class="btn btn-success btn-sm" onclick="window.MJK.exportRateChartExcel()">
            📊 Excel
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.exportRateChartCSV()">
            ⬇ CSV
          </button>
        ` : ''}
      </div>
    </div>

    ${(!meta.manualSetupCompleted && canEdit) ? `
      <div style="background:linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border:1.5px solid #f59e0b; border-radius:var(--radius-lg); padding:1rem 1.2rem; margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.85rem;">
        <div style="max-width:740px;">
          <div style="font-weight:800; color:#92400e; font-size:0.92rem; margin-bottom:0.25rem;">
            🛠 First-Time Manual Rate Setup (প্রথমবার ম্যানুয়ালি আপনার নিজের রেট সেট করুন)
          </div>
          <div style="font-size:0.8rem; color:#78350f; line-height:1.45;">
            ডিফল্ট তালিকায় কিছু সার্ভিসের রেট কম বা বেশি থাকতে পারে। নিচের টেবিলে প্রতিটি সার্ভিসের <strong>Shop Charge (₹)</strong> ও <strong>Govt Fee (₹)</strong> আপনার মতো করে পরিবর্তন করুন, অথবা চাইলে সব রেট ₹0 করে নতুন করে বসান, তারপর <strong>"💾 Save All Edited Rates"</strong> ক্লিক করুন।
          </div>
        </div>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-outline btn-sm" style="background:#ffffff; border-color:#d97706; color:#92400e;" onclick="window.MJK.confirmClearRatesToZero()">
            🧹 Clear All to ₹0 (Manual Start)
          </button>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.saveAllInlineRates(true)">
            ✓ Save & Complete Setup
          </button>
        </div>
      </div>
    ` : ''}

    <!-- Summary Bar -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:0.75rem; margin-bottom:1rem;">
      <div class="stat-card" style="padding:0.85rem 1rem;">
        <span class="stat-label">Total Services</span>
        <div class="stat-value tabular-nums" style="font-size:1.45rem;">${items.length}</div>
      </div>
      <div class="stat-card" style="padding:0.85rem 1rem;">
        <span class="stat-label">Active on Rate Chart</span>
        <div class="stat-value tabular-nums" style="font-size:1.45rem; color:var(--blue-600);">${activeCount}</div>
      </div>
      <div class="stat-card" style="padding:0.85rem 1rem;">
        <span class="stat-label">Manually Configured</span>
        <div class="stat-value tabular-nums" style="font-size:1.45rem; color:var(--success);">${configuredCount}</div>
      </div>
      <div class="stat-card" style="padding:0.85rem 1rem;">
        <span class="stat-label">Categories Covered</span>
        <div class="stat-value tabular-nums" style="font-size:1.45rem;">${categories.length}</div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-toolbar" style="flex-wrap:wrap; gap:0.5rem;">
        <div class="table-toolbar-left" style="flex-wrap:wrap; gap:0.5rem;">
          <input
            type="text"
            class="form-control toolbar-search"
            placeholder="Search service, Bengali name, category..."
            value="${escapeHtml(window._rateChartSearch || '')}"
            oninput="window.MJK.setRateChartFilter('search', this.value)"
          >
          <select class="form-control toolbar-select" onchange="window.MJK.setRateChartFilter('cat', this.value)">
            <option value="all">All Categories (${categories.length})</option>
            ${categories.map(c => `<option value="${escapeHtml(c)}" ${catFilter === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          </select>
          <select class="form-control toolbar-select" onchange="window.MJK.setRateChartFilter('mode', this.value)">
            <option value="all" ${modeFilter === 'all' ? 'selected' : ''}>All Services</option>
            <option value="active" ${modeFilter === 'active' ? 'selected' : ''}>Active Only</option>
            <option value="configured" ${modeFilter === 'configured' ? 'selected' : ''}>Manually Edited Only</option>
            <option value="unconfigured" ${modeFilter === 'unconfigured' ? 'selected' : ''}>Not Yet Edited</option>
            <option value="zero" ${modeFilter === 'zero' ? 'selected' : ''}>₹0 Rate Only</option>
          </select>
        </div>
        <div class="table-toolbar-right" style="display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap;">
          <span style="font-size:0.78rem; color:var(--text-muted);">Showing <strong>${filtered.length}</strong> services</span>
          ${canDelete ? `
            <button type="button" id="rc-bulk-delete-btn" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.promptBulkDeleteRateItems()" title="Delete all ticked services from Rate Chart & Service Dropdowns">
              🗑 Delete Selected
            </button>
          ` : ''}
          ${(canEdit && getRemovedCatalogServices().length > 0) ? `
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openRemovedCatalogServicesModal ? window.MJK.openRemovedCatalogServicesModal() : window.MJK.restoreAllRemovedRateItems()" title="Restore ${getRemovedCatalogServices().length} removed service(s)">
              ↺ Restore (${getRemovedCatalogServices().length})
            </button>
          ` : ''}
          ${canEdit ? `
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.confirmResetRateChart()" title="Restore default recommended rates">
              ↺ Reset Defaults
            </button>
          ` : ''}
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              ${canDelete ? `
                <th style="width:36px; text-align:center;">
                  <input type="checkbox" title="Select all visible rows" onchange="document.querySelectorAll('.rate-select-row').forEach(cb => cb.checked = this.checked)">
                </th>
              ` : ''}
              <th style="width:42px; text-align:center;">#</th>
              <th>Category</th>
              <th>Service Name / Description</th>
              <th style="width:135px;">Unit</th>
              <th style="width:115px;">Shop Charge (₹)</th>
              <th style="width:115px;">Govt Fee (₹)</th>
              <th style="width:105px; text-align:right;">Total Rate</th>
              <th style="width:85px; text-align:center;">Show</th>
              ${(canEdit || canDelete) ? `<th style="width:110px; text-align:right;">Actions</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${filtered.map((item, idx) => {
              const total = (Number(item.serviceCharge) || 0) + (Number(item.govFee) || 0);
              return `
                <tr data-rate-row-id="${escapeHtml(item.id)}">
                  ${canDelete ? `
                    <td style="text-align:center;">
                      <input type="checkbox" class="rate-select-row" value="${escapeHtml(item.id)}" style="width:15px; height:15px; cursor:pointer;">
                    </td>
                  ` : ''}
                  <td style="text-align:center; font-family:monospace; font-size:0.75rem; color:var(--text-muted);">${idx + 1}</td>
                  <td>
                    <span class="badge badge-neutral" style="font-size:0.7rem;">${escapeHtml(item.category)}</span>
                    ${item.configured ? '<div style="font-size:0.65rem; color:var(--success); font-weight:700; margin-top:2px;">✓ Manual</div>' : ''}
                  </td>
                  <td>
                    <div style="font-weight:700; font-size:0.84rem; color:var(--text-main);">${escapeHtml(item.serviceName)}</div>
                    ${item.nameBn ? `<div style="font-size:0.74rem; color:var(--text-muted);">${escapeHtml(item.nameBn)}</div>` : ''}
                    ${item.remarks ? `<div style="font-size:0.7rem; color:var(--blue-600);">${escapeHtml(item.remarks)}</div>` : ''}
                  </td>
                  <td>
                    <select class="form-control rate-input-unit" data-id="${escapeHtml(item.id)}" style="height:32px; font-size:0.74rem; padding:0.2rem 0.4rem;" ${canEdit ? '' : 'disabled'}>
                      ${SERVICE_UNITS.map(u => `<option value="${u}" ${item.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      class="form-control font-mono rate-input-charge"
                      data-id="${escapeHtml(item.id)}"
                      value="${Number(item.serviceCharge) || 0}"
                      style="height:32px; font-size:0.82rem; font-weight:700;"
                      ${canEdit ? `oninput="window.MJK.recalcRateRowTotal('${escapeHtml(item.id)}')"` : 'readonly disabled'}
                    >
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      class="form-control font-mono rate-input-gov"
                      data-id="${escapeHtml(item.id)}"
                      value="${Number(item.govFee) || 0}"
                      style="height:32px; font-size:0.82rem;"
                      ${canEdit ? `oninput="window.MJK.recalcRateRowTotal('${escapeHtml(item.id)}')"` : 'readonly disabled'}
                    >
                  </td>
                  <td style="text-align:right;">
                    <strong id="rate-row-total-${escapeHtml(item.id)}" class="tabular-nums font-mono" style="font-size:0.9rem; color:var(--blue-700);">
                      ${formatINR(total)}
                    </strong>
                  </td>
                  <td style="text-align:center;">
                    <input
                      type="checkbox"
                      class="rate-input-active"
                      data-id="${escapeHtml(item.id)}"
                      ${item.isActive ? 'checked' : ''}
                      ${canEdit ? `onchange="window.MJK.toggleRateItemActive('${escapeHtml(item.id)}', this.checked)"` : 'disabled'}
                      title="Include in Official Service Directory, Dropdowns & A4 Rate Chart"
                      style="width:16px; height:16px; cursor:${canEdit ? 'pointer' : 'not-allowed'};"
                    >
                  </td>
                  ${(canEdit || canDelete) ? `
                    <td style="text-align:right; white-space:nowrap;">
                      <div style="display:inline-flex; gap:0.3rem; flex-wrap:nowrap;">
                        ${canEdit ? `<button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openAddRateItemModal('${escapeHtml(item.id)}')" title="Edit rate, unit & details">✎ Rate</button>` : ''}
                        ${canDelete ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.promptDeleteRateItem('${escapeHtml(item.id)}')" title="Delete service from rate chart">🗑 Delete</button>` : ''}
                      </div>
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join('') || `
              <tr>
                <td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted);">
                  No services match your search or filter.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function openRateChartA4Popup(variant = 'customer') {
  const allItems = getAllRateChartItems().filter(x => x.isActive);
  const catFilter = window._rateChartCat || 'all';
  const items = catFilter === 'all' ? allItems : allItems.filter(x => x.category === catFilter);
  const isDetailed = variant === 'detailed';
  const today = getTodayDate();

  // Group by category for super clean A4 single-side layout
  const grouped = new Map();
  items.forEach(item => {
    if (!grouped.has(item.category)) grouped.set(item.category, []);
    grouped.get(item.category).push(item);
  });

  const rowsHtml = [];
  let sl = 1;
  grouped.forEach((catItems, catName) => {
    rowsHtml.push(`
      <tr>
        <td colspan="${isDetailed ? 6 : 4}" style="padding:4px 7px; font-weight:900; font-size:9pt; border:1px solid #000000; text-transform:uppercase;">
          ${escapeHtml(catName)}
        </td>
      </tr>
    `);
    catItems.forEach(item => {
      const total = (Number(item.serviceCharge) || 0) + (Number(item.govFee) || 0);
      rowsHtml.push(`
        <tr>
          <td style="padding:3.5px 6px; border:1px solid #000000; text-align:center; font-size:8.5pt;" class="tabular-nums">${sl++}</td>
          <td style="padding:3.5px 6px; border:1px solid #000000; font-size:8.5pt;">
            <strong>${escapeHtml(item.serviceName)}</strong>
            ${item.nameBn ? `<span style="font-size:8pt;"> (${escapeHtml(item.nameBn)})</span>` : ''}
          </td>
          <td style="padding:3.5px 6px; border:1px solid #000000; text-align:center; font-size:8pt;">${escapeHtml(item.unit)}</td>
          ${isDetailed ? `
            <td style="padding:3.5px 6px; border:1px solid #000000; text-align:right; font-family:monospace; font-size:8.5pt;" class="tabular-nums">₹${Number(item.serviceCharge) || 0}</td>
            <td style="padding:3.5px 6px; border:1px solid #000000; text-align:right; font-family:monospace; font-size:8.5pt;" class="tabular-nums">₹${Number(item.govFee) || 0}</td>
          ` : ''}
          <td style="padding:3.5px 6px; border:1px solid #000000; text-align:right; font-family:monospace; font-weight:800; font-size:9pt;" class="tabular-nums">₹${total}</td>
        </tr>
      `);
    });
  });

  const bodyHtml = `
    <div class="mun-bw-doc">
      ${renderBwDocumentHeader({
        docTitle: isDetailed ? 'DETAILED SERVICE RATE CHART' : 'OFFICIAL SERVICE RATE CHART',
        docDateTime: today,
        extraRightLines: [`Total Listed Services: ${items.length}`, `Filter: ${catFilter === 'all' ? 'All Categories' : catFilter}`]
      })}

      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="width:34px; text-align:center;">#</th>
            <th>Service Name / Description</th>
            <th style="width:95px; text-align:center;">Unit</th>
            ${isDetailed ? `
              <th style="width:75px; text-align:right;">Shop Fee</th>
              <th style="width:75px; text-align:right;">Govt Fee</th>
            ` : ''}
            <th style="width:85px; text-align:right;">Total Rate</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml.join('')}
        </tbody>
      </table>

      <div class="a4-avoid-break" style="margin-top:10px; border:1px solid #000000; padding:6px 8px; font-size:8pt;">
        * Government / third-party portal fees are separately identified and subject to official department revisions. Original documents required.
      </div>
      ${renderAcknowledgementSection({ includeCustomerSignature: false, dateStr: today })}
    </div>
  `;

  const pdfHeaders = isDetailed
    ? ['#', 'Category', 'Service Name', 'Unit', 'Shop Fee', 'Govt Fee', 'Total']
    : ['#', 'Category', 'Service Name', 'Unit', 'Total Rate'];

  const pdfRows = items.map((item, idx) => {
    const total = (Number(item.serviceCharge) || 0) + (Number(item.govFee) || 0);
    const label = item.nameBn ? `${item.serviceName} (${item.nameBn})` : item.serviceName;
    return isDetailed
      ? [idx + 1, item.category, label, item.unit, `Rs.${Number(item.serviceCharge) || 0}`, `Rs.${Number(item.govFee) || 0}`, `Rs.${total}`]
      : [idx + 1, item.category, label, item.unit, `Rs.${total}`];
  });

  showA4PrintPdfPopup({
    title: isDetailed ? 'Detailed Service Rate Chart (Print / PDF)' : 'Official Customer Rate Chart (Print / PDF)',
    subtitle: 'MUN COMPUTER · Official Corporate Rate Chart',
    bodyHtml,
    pdfConfig: {
      onDownload: async (layoutOpts = {}) => {
        await exportUniversalPDF({
          filename: `MUN_COMPUTER_Rate_Chart_${today}`,
          title: isDetailed ? 'OFFICIAL SERVICE LIST & DETAILED RATE CHART' : 'OFFICIAL CUSTOMER SERVICE RATE CHART',
          statusLabel: 'ACTIVE RATES',
          subtitle: `Date: ${today} | Category Filter: ${catFilter === 'all' ? 'All Categories' : catFilter} | Total Services: ${items.length}`,
          headers: pdfHeaders,
          rows: pdfRows,
          orientation: layoutOpts.orientation || 'portrait',
          format: layoutOpts.format || 'a4',
          includeAcknowledgement: true
        });
      }
    }
  });
}

export function setupRateChartHandlers(MJK, showToast, openModal, closeModal, showConfirmDialog, render) {
  const buildRateExportSpec = () => {
    const items = getAllRateChartItems().filter(x => x.isActive);
    const catFilter = window._rateChartCat || 'all';
    const filtered = catFilter === 'all' ? items : items.filter(x => x.category === catFilter);
    const headers = ['#', 'Category', 'Service Name (English)', 'Service Name (Bengali)', 'Unit', 'Shop Charge (INR)', 'Govt Fee (INR)', 'Total Rate (INR)'];
    const rows = filtered.map((item, idx) => {
      const shop = Number(item.serviceCharge) || 0;
      const gov = Number(item.govFee) || 0;
      return [idx + 1, item.category, item.serviceName, item.nameBn || '', item.unit, shop, gov, shop + gov];
    });
    return { filtered, headers, rows, catFilter };
  };

  MJK.exportRateChartExcel = () => {
    const { filtered, headers, rows, catFilter } = buildRateExportSpec();
    exportUniversalExcel({
      filename: 'MUN_COMPUTER_Service_Rate_Chart',
      sheetName: 'Service_Rate_Chart',
      title: 'OFFICIAL SERVICE LIST & RATE CHART',
      statusLabel: 'ACTIVE RATES',
      subtitle: `Category: ${catFilter === 'all' ? 'All Categories' : catFilter} | ${filtered.length} Services`,
      headers,
      rows,
      totalsRow: ['TOTAL SERVICES', filtered.length, '', '', '', '', '', 'ACTIVE']
    });
    showToast('Service Rate Chart Excel (.xlsx) downloaded!', 'success');
  };

  MJK.exportRateChartCSV = () => {
    const { filtered, headers, rows, catFilter } = buildRateExportSpec();
    exportUniversalCSV({
      filename: 'MUN_COMPUTER_Service_Rate_Chart',
      title: 'OFFICIAL SERVICE LIST & RATE CHART',
      statusLabel: 'ACTIVE RATES',
      subtitle: `Category: ${catFilter === 'all' ? 'All Categories' : catFilter} | ${filtered.length} Services`,
      headers,
      rows,
      totalsRow: ['TOTAL SERVICES', filtered.length, '', '', '', '', '', 'ACTIVE']
    });
    showToast('Service Rate Chart CSV downloaded (UTF-8 BOM)!', 'success');
  };
  MJK.setRateChartFilter = (key, val) => {
    if (key === 'search') window._rateChartSearch = val;
    if (key === 'cat') window._rateChartCat = val;
    if (key === 'mode') window._rateChartFilterMode = val;
    render();
  };

  MJK.recalcRateRowTotal = (id) => {
    const chargeEl = document.querySelector(`.rate-input-charge[data-id="${id}"]`);
    const govEl = document.querySelector(`.rate-input-gov[data-id="${id}"]`);
    const totalEl = document.getElementById(`rate-row-total-${id}`);
    if (!totalEl) return;
    const total = (Number(chargeEl?.value) || 0) + (Number(govEl?.value) || 0);
    totalEl.textContent = formatINR(total);
  };

  MJK.toggleRateItemActive = (id, isActive) => {
    if (!canMenu('rate-chart', 'edit')) {
      showToast('Permission Denied: Rate Chart is View-Only for your role.', 'danger');
      render();
      return;
    }
    const list = getAllRateChartItems();
    const idx = list.findIndex(x => x.id === id);
    if (idx === -1) return;
    list[idx] = {
      ...list[idx],
      isActive: Boolean(isActive),
      updatedAt: new Date().toISOString()
    };
    saveRateChartItems(list, false, 'toggle_active');
    showToast(
      list[idx].isActive
        ? `"${list[idx].serviceName}" enabled across Directory, Quick Entry & Search.`
        : `"${list[idx].serviceName}" hidden from Official Directory & active menus.`,
      'info'
    );
    render();
  };

  MJK.saveAllInlineRates = (markSetupComplete = true) => {
    if (!canMenu('rate-chart', 'edit')) {
      showToast('Permission Denied: Rate Chart is View-Only for your role.', 'danger');
      return;
    }
    const list = getAllRateChartItems();
    const map = new Map(list.map(x => [x.id, x]));
    const customList = getCustomSubServices();
    const customByKey = new Map(customList.map(cs => [`${cs.category}::${cs.name}`.toLowerCase(), cs]));
    let editedCount = 0;

    document.querySelectorAll('[data-rate-row-id]').forEach(row => {
      const id = row.getAttribute('data-rate-row-id');
      const existing = map.get(id);
      if (!existing) return;

      const chargeEl = row.querySelector('.rate-input-charge');
      const govEl = row.querySelector('.rate-input-gov');
      const unitEl = row.querySelector('.rate-input-unit');
      const activeEl = row.querySelector('.rate-input-active');

      const nextCharge = Math.max(0, Number(chargeEl?.value) || 0);
      const nextGov = Math.max(0, Number(govEl?.value) || 0);
      const nextUnit = unitEl?.value || existing.unit;
      const nextActive = activeEl ? Boolean(activeEl.checked) : existing.isActive;

      const changed =
        nextCharge !== existing.serviceCharge ||
        nextGov !== existing.govFee ||
        nextUnit !== existing.unit ||
        nextActive !== existing.isActive;

      if (changed) {
        editedCount++;
        const customMatch = customByKey.get(`${existing.category}::${existing.serviceName}`.toLowerCase());
        if (customMatch) {
          updateCustomServiceEntry(customMatch.id, {
            unit: nextUnit,
            defaultCharge: nextCharge,
            defaultGovFee: nextGov
          });
        }
      }

      map.set(id, {
        ...existing,
        serviceCharge: nextCharge,
        govFee: nextGov,
        unit: nextUnit,
        isActive: nextActive,
        configured: existing.configured || changed || markSetupComplete,
        updatedAt: new Date().toISOString()
      });
    });

    saveRateChartItems(Array.from(map.values()), markSetupComplete, 'inline_save');
    showToast(
      editedCount > 0
        ? `Saved ${editedCount} updated rate(s) & synchronized Directory, Quick Entry, Billing & Search!`
        : 'All service rates saved & synchronized!',
      'success'
    );
    render();
  };

  MJK.confirmClearRatesToZero = () => {
    if (!canMenu('rate-chart', 'edit')) {
      showToast('Permission Denied: Rate Chart editing not permitted.', 'danger');
      return;
    }
    showConfirmDialog(
      'Set All Service Rates to ₹0?',
      'This will reset all Shop Charge and Govt Fee amounts to ₹0 so you can manually enter your own exact rates from scratch.',
      () => {
        clearAllRatesToZero();
        showToast('All rates set to ₹0. Enter your manual rates and click Save All Edited Rates.', 'info');
        render();
      }
    );
  };

  MJK.restoreAllRemovedRateItems = async () => {
    if (!canMenu('rate-chart', 'edit')) {
      showToast('Permission Denied: Rate Chart editing not permitted.', 'danger');
      return;
    }
    try {
      const res = await restoreAllRateChartServiceEntries();
      showToast(`Restored ${res.count || 0} removed service(s) to Rate Chart & Official Directory.`, 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to restore removed services.', 'danger');
    }
  };

  MJK.confirmResetRateChart = () => {
    if (!canMenu('rate-chart', 'edit')) {
      showToast('Permission Denied: Rate Chart editing not permitted.', 'danger');
      return;
    }
    showConfirmDialog(
      'Restore Standard Recommended Rates?',
      'All service charges & govt fees will be restored to default standard values (custom added items will be replaced).',
      () => {
        resetRateChartToDefaults();
        showToast('Rate chart restored to default baseline.', 'info');
        render();
      }
    );
  };

  MJK.openAddRateItemModal = (editId = null, options = {}) => {
    if (editId && !canMenu('rate-chart', 'edit')) {
      showToast('Permission Denied: You do not have permission to edit Rate Chart prices.', 'danger');
      return;
    }
    if (!editId && !canMenu('rate-chart', 'add')) {
      showToast('Permission Denied: You do not have permission to add Rate Chart items.', 'danger');
      return;
    }
    window._reopenDirectoryAfterRateModal = Boolean(options?.fromDirectory);
    const items = getAllRateChartItems();
    const existing = editId ? items.find(x => x.id === editId) : null;
    const categories = Array.from(new Set([...getServiceCategories(), ...items.map(i => i.category)]));

    const content = `
      <form onsubmit="window.MJK.handleSaveRateItem(event, '${editId || ''}')">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Service Category <span class="req">*</span></label>
            <select id="rc-cat" class="form-control" required onchange="const nw=document.getElementById('rc-new-cat-wrap'); if(nw){ nw.style.display = this.value === '__NEW_CATEGORY__' ? 'block' : 'none'; }">
              ${categories.map(c => `<option value="${escapeHtml(c)}" ${(existing?.category || 'Online Form Fill-up') === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
              <option value="__NEW_CATEGORY__">+ Add New Custom Category...</option>
            </select>
            <div id="rc-new-cat-wrap" style="display:none; margin-top:0.45rem;">
              <input type="text" id="rc-new-cat" class="form-control" placeholder="Enter new custom category name...">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Billing Unit <span class="req">*</span></label>
            <select id="rc-unit" class="form-control" required>
              ${SERVICE_UNITS.map(u => `<option value="${u}" ${(existing?.unit || 'Per Application') === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Service Name <span class="req">*</span></label>
            <input type="text" id="rc-name" class="form-control" required value="${escapeHtml(existing?.serviceName || '')}" placeholder="e.g. New PAN Card / B&W Printout / Ration Card">
          </div>
          <div class="form-group">
            <label class="form-label">Bengali Name (Optional)</label>
            <input type="text" id="rc-name-bn" class="form-control" value="${escapeHtml(existing?.nameBn || '')}" placeholder="e.g. নতুন প্যান কার্ড">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Shop Service Charge (₹) <span class="req">*</span></label>
            <input type="number" id="rc-charge" class="form-control font-mono" min="0" required value="${existing ? existing.serviceCharge : 0}" oninput="window.MJK.updateRateItemModalWords()">
            <div id="rc-charge-words" class="amount-words-hint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Govt / Portal Fee (₹)</label>
            <input type="number" id="rc-gov" class="form-control font-mono" min="0" value="${existing ? existing.govFee : 0}" oninput="window.MJK.updateRateItemModalWords()">
            <div id="rc-gov-words" class="amount-words-hint"></div>
          </div>
        </div>
        <div id="rc-total-preview-words" class="amount-words-hint" style="margin-bottom:0.85rem; padding:0.45rem 0.65rem; background:var(--surface-alt); border-radius:var(--radius-sm);"></div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Service Tags (Comma-separated, Auto-Sync)</label>
            <input type="text" id="rc-tags" class="form-control" value="${escapeHtml(Array.isArray(existing?.tags) ? existing.tags.join(', ') : (existing?.tags || ''))}" placeholder="e.g. Student Welfare Schemes, Education Loan, Scholarship">
          </div>
          <div class="form-group">
            <label class="form-label">Notes / Required Documents</label>
            <input type="text" id="rc-remarks" class="form-control" value="${escapeHtml(existing?.remarks || '')}" placeholder="e.g. Aadhaar + 2 Photos required">
          </div>
        </div>

        <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.82rem; margin-bottom:1rem; cursor:pointer;">
          <input type="checkbox" id="rc-active" ${!existing || existing.isActive ? 'checked' : ''}>
          <span>Active in Official Service Directory, Quick Entry &amp; Printable Rate Chart</span>
        </label>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.cancelRateItemModal()">${window._reopenDirectoryAfterRateModal ? '← Back to Directory' : 'Cancel'}</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Update Service Rate' : 'Save New Service'}</button>
        </div>
      </form>
    `;

    openModal(existing ? `Edit Rate: ${existing.serviceName}` : 'Add Custom Service to Rate Chart', content, null);
    setTimeout(() => MJK.updateRateItemModalWords(), 10);
  };

  MJK.cancelRateItemModal = () => {
    const reopen = Boolean(window._reopenDirectoryAfterRateModal);
    window._reopenDirectoryAfterRateModal = false;
    closeModal();
    if (reopen && typeof MJK.openCategoryCatalogModal === 'function') {
      setTimeout(() => MJK.openCategoryCatalogModal(), 60);
    }
  };

  MJK.updateRateItemModalWords = () => {
    const chEl = document.getElementById('rc-charge');
    const gvEl = document.getElementById('rc-gov');
    const cRes = syncAmountWords(chEl, 'rc-charge-words');
    const gRes = syncAmountWords(gvEl, 'rc-gov-words');
    const totEl = document.getElementById('rc-total-preview-words');
    if (!totEl) return;
    if ((cRes && cRes.state === 'invalid') || (gRes && gRes.state === 'invalid')) {
      totEl.textContent = 'Invalid amount — please enter valid non-negative fees';
      totEl.style.color = 'var(--danger)';
      totEl.style.display = 'block';
    } else if ((!cRes || cRes.state === 'empty') && (!gRes || gRes.state === 'empty')) {
      totEl.textContent = '';
      totEl.style.display = 'none';
    } else {
      const total = (cRes?.numericValue || 0) + (gRes?.numericValue || 0);
      syncAmountWords(total, 'rc-total-preview-words', { prefix: `Total Customer Rate (${formatINR(total)}): ` });
    }
  };

  MJK.handleSaveRateItem = async (e, editId) => {
    e.preventDefault();
    if ((editId && !canMenu('rate-chart', 'edit')) || (!editId && !canMenu('rate-chart', 'add'))) {
      showToast('Permission Denied: Rate Chart modification not allowed.', 'danger');
      return;
    }
    const existing = editId ? getRateChartItemById(editId) : null;
    const rawCat = document.getElementById('rc-cat')?.value;
    const newCat = document.getElementById('rc-new-cat')?.value?.trim() || '';
    const finalCat = rawCat === '__NEW_CATEGORY__' ? (newCat || 'Other Services') : rawCat;
    const serviceName = (document.getElementById('rc-name')?.value || '').trim();
    const nameBn = (document.getElementById('rc-name-bn')?.value || '').trim();
    const unit = document.getElementById('rc-unit')?.value || 'Per Application';
    const serviceCharge = Math.max(0, Number(document.getElementById('rc-charge')?.value) || 0);
    const govFee = Math.max(0, Number(document.getElementById('rc-gov')?.value) || 0);
    const remarks = (document.getElementById('rc-remarks')?.value || '').trim();
    const rawTags = (document.getElementById('rc-tags')?.value || '').trim();
    const tags = rawTags ? rawTags.split(/[,;|]+/).map(t => t.trim()).filter(Boolean) : [];

    if (!serviceName) {
      showToast('Please enter a service name.', 'warning');
      return;
    }

    let res;
    try {
      res = await upsertRateChartItem({
        id: editId || undefined,
        category: finalCat,
        subcategory: serviceName,
        unit,
        serviceName,
        nameBn,
        serviceCharge,
        govFee,
        tags,
        remarks,
        isCustom: !editId ? true : Boolean(existing?.isCustom),
        isActive: document.getElementById('rc-active')?.checked
      });

      // Synchronize custom service registry too
      if (!editId || rawCat === '__NEW_CATEGORY__') {
        await addCustomServiceEntry({
          category: finalCat,
          subcategory: serviceName,
          serviceName,
          nameBn,
          unit,
          defaultCharge: serviceCharge,
          defaultGovFee: govFee,
          tags,
          remarks
        });
      } else if (existing) {
      const customMatch = getCustomSubServices().find(
        cs => cs.category.toLowerCase() === existing.category.toLowerCase() && cs.name.toLowerCase() === existing.serviceName.toLowerCase()
      );
      if (customMatch) {
        updateCustomServiceEntry(customMatch.id, {
          category: finalCat,
          subcategory: serviceName,
          serviceName,
          nameBn,
          unit,
          defaultCharge: serviceCharge,
          defaultGovFee: govFee,
          tags,
          remarks
        });
      }
    }
    } catch (err) {
      showToast(err?.message || 'Failed to save Rate Chart item.', 'danger');
      return;
    }

    const reopenDirectory = Boolean(window._reopenDirectoryAfterRateModal);
    window._reopenDirectoryAfterRateModal = false;
    closeModal();
    showToast(res.isNew ? `Added "${res.item.serviceName}" to Rate Chart & Official Directory` : `Updated rate for "${res.item.serviceName}" everywhere`, 'success');
    render();
    if (reopenDirectory && typeof MJK.openCategoryCatalogModal === 'function') {
      setTimeout(() => MJK.openCategoryCatalogModal(), 60);
    }
  };

  MJK.promptDeleteRateItem = (id) => {
    if (!canMenu('rate-chart', 'delete')) {
      showToast('Permission Denied: You do not have permission to delete Rate Chart items.', 'danger');
      return;
    }
    showConfirmDialog('Remove Service?', 'This service will be removed from your Rate Chart and service selection list.', () => {
      deleteRateChartItem(id);
      showToast('Service removed from Rate Chart & Catalog.', 'info');
      render();
    });
  };

  MJK.promptBulkDeleteRateItems = () => {
    if (!canMenu('rate-chart', 'delete')) {
      showToast('Permission Denied: You do not have permission to delete Rate Chart items.', 'danger');
      return;
    }
    const selectedIds = Array.from(document.querySelectorAll('.rate-select-row:checked')).map(el => el.value);
    if (selectedIds.length === 0) {
      showToast('Please tick one or more service checkboxes to delete.', 'warning');
      return;
    }
    showConfirmDialog(
      `Remove ${selectedIds.length} Selected Service(s)?`,
      `Are you sure you want to remove ${selectedIds.length} selected service(s) from the Rate Chart and Service Catalog?`,
      () => {
        const res = deleteMultipleRateChartItems(selectedIds);
        showToast(`Removed ${res.count} service(s).`, 'info');
        render();
      }
    );
  };

  MJK.openRateChartA4Popup = (variant = 'customer') => {
    openRateChartA4Popup(variant);
  };
}
