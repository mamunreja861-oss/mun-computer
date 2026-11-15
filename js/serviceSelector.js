/**
 * serviceSelector.js - Reusable Searchable Multi-Select Service Bar
 * Connects live to Rate Chart & Unified Service Directory (English + Bengali search)
 * Automatically fetches Shop Charge, Govt Fee, and calculates Total Payable Amount.
 */

import { formatINR } from './storage.js';
import { getUnifiedServiceList } from './services.js';
import { getAllRateChartItems } from './rateChart.js';

function esc(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const selectorInstances = new Map();

export function getSearchableRateServices() {
  const rateItems = getAllRateChartItems().filter(x => x.isActive !== false);
  const unified = getUnifiedServiceList() || [];

  const bnByName = new Map();
  unified.forEach(u => {
    const key = String(u.name || '').trim().toLowerCase();
    if (key && u.nameBn) bnByName.set(key, u.nameBn);
  });

  const mergedMap = new Map();

  rateItems.forEach(r => {
    const name = String(r.serviceName || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    const shop = Math.max(0, Number(r.serviceCharge) || 0);
    const gov = Math.max(0, Number(r.govFee) || 0);
    mergedMap.set(key, {
      id: r.id,
      name,
      nameBn: String(r.nameBn || bnByName.get(key) || '').trim(),
      category: String(r.category || 'General Services').trim(),
      serviceCharge: shop,
      govFee: gov,
      total: shop + gov,
      unit: r.unit || 'Per Application'
    });
  });

  unified.forEach(u => {
    const name = String(u.name || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (mergedMap.has(key)) return;
    const shop = Math.max(0, Number(u.defaultCharge) || 0);
    const gov = Math.max(0, Number(u.defaultGovFee) || 0);
    mergedMap.set(key, {
      id: u.rateId || `UNI-${key.replace(/[^a-z0-9]+/g, '-')}`,
      name,
      nameBn: String(u.nameBn || '').trim(),
      category: String(u.category || u.group || 'General Services').trim(),
      serviceCharge: shop,
      govFee: gov,
      total: shop + gov,
      unit: u.unit || 'Per Application'
    });
  });

  return Array.from(mergedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function renderSearchableServiceSelectorHtml(mountId, options = {}) {
  const {
    label = 'Select Services / Schemes (Search English or Bengali)',
    placeholder = 'Search services in English or Bengali (e.g. PAN, Ration, লক্ষ্মীর ভাণ্ডার)...',
    required = false,
    showBilling = true,
    singleSelect = false,
    headerRightHtml = ''
  } = options;

  const reqMark = required ? '<span class="req">*</span>' : '';

  return `
    <div id="${esc(mountId)}-wrap" class="srv-multiselect-box" style="background:var(--surface-alt); padding:0.9rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle); margin-bottom:0.85rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.45rem; margin-bottom:0.5rem;">
        <label class="form-label" style="margin:0; font-size:0.78rem; font-weight:800; color:var(--text-main); text-transform:uppercase;">
          ${esc(label)} ${reqMark}
        </label>
        ${headerRightHtml || `<span id="${esc(mountId)}-count" class="tabular-nums" style="font-size:0.74rem; font-weight:700; color:var(--blue-600);">0 selected</span>`}
      </div>

      <div style="position:relative;">
        <input
          type="text"
          id="${esc(mountId)}-search"
          class="form-control"
          autocomplete="off"
          placeholder="${esc(placeholder)}"
          style="background:var(--surface); padding-right:2.2rem;"
        >
        <div
          id="${esc(mountId)}-dropdown"
          style="display:none; position:absolute; left:0; right:0; top:100%; z-index:45; max-height:240px; overflow-y:auto; background:var(--surface); border:1px solid var(--border-subtle); border-top:none; border-radius:0 0 var(--radius-md) var(--radius-md); box-shadow:0 8px 24px rgba(15,23,42,0.12);"
        ></div>
      </div>

      <div id="${esc(mountId)}-chips" style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.55rem;"></div>

      ${showBilling && !singleSelect ? `
        <div id="${esc(mountId)}-billing" style="display:none; margin-top:0.65rem; background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:0.65rem 0.75rem;">
          <div id="${esc(mountId)}-breakdown" style="display:flex; flex-direction:column; gap:0.25rem; font-size:0.78rem; margin-bottom:0.5rem;"></div>
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding-top:0.45rem; border-top:1px dashed var(--border-subtle); font-size:0.82rem;">
            <div class="tabular-nums" style="color:var(--text-muted);">
              Shop Charge: <strong id="${esc(mountId)}-sum-shop" style="color:var(--text-main);">₹0</strong> ·
              Govt Fee: <strong id="${esc(mountId)}-sum-gov" style="color:var(--text-main);">₹0</strong>
            </div>
            <div class="tabular-nums font-mono" style="font-weight:800; color:var(--blue-600); font-size:0.95rem;">
              Total Payable: <span id="${esc(mountId)}-sum-total">₹0</span>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

export function initSearchableServiceSelector(mountId, config = {}) {
  const {
    initialServices = [],
    singleSelect = false,
    showBilling = true,
    onSelectItem = null,
    onChange = null
  } = config;

  const searchEl = document.getElementById(`${mountId}-search`);
  const dropdownEl = document.getElementById(`${mountId}-dropdown`);
  const chipsEl = document.getElementById(`${mountId}-chips`);
  const countEl = document.getElementById(`${mountId}-count`);
  const billingEl = document.getElementById(`${mountId}-billing`);
  const breakdownEl = document.getElementById(`${mountId}-breakdown`);
  const sumShopEl = document.getElementById(`${mountId}-sum-shop`);
  const sumGovEl = document.getElementById(`${mountId}-sum-gov`);
  const sumTotalEl = document.getElementById(`${mountId}-sum-total`);

  if (!searchEl || !dropdownEl || !chipsEl) return;

  const catalog = getSearchableRateServices();
  const findCatalogMatch = (nameOrId) => {
    const q = String(nameOrId || '').trim().toLowerCase();
    return catalog.find(item => item.id.toLowerCase() === q || item.name.toLowerCase() === q) || null;
  };

  let selected = [];
  (Array.isArray(initialServices) ? initialServices : [initialServices]).filter(Boolean).forEach(entry => {
    if (typeof entry === 'string') {
      const m = findCatalogMatch(entry);
      selected.push(m ? { ...m } : { id: `CUSTOM-${entry}`, name: entry, nameBn: '', category: 'Service', serviceCharge: 0, govFee: 0, total: 0 });
    } else if (entry && entry.name) {
      const m = findCatalogMatch(entry.name);
      const shop = m ? m.serviceCharge : (Number(entry.serviceCharge) || 0);
      const gov = m ? m.govFee : (Number(entry.govFee) || 0);
      selected.push({ ...(m || {}), ...entry, serviceCharge: shop, govFee: gov, total: shop + gov });
    }
  });

  if (singleSelect && selected.length > 1) selected = [selected[0]];

  const refreshLiveRates = () => {
    const latest = getSearchableRateServices();
    selected = selected.map(sel => {
      const m = latest.find(x => x.id === sel.id || x.name.toLowerCase() === sel.name.toLowerCase());
      return m ? { ...m } : sel;
    });
  };

  const renderState = () => {
    if (countEl) {
      countEl.textContent = `${selected.length} ${selected.length === 1 ? 'service' : 'services'} selected`;
    }
    if (selected.length === 0) {
      chipsEl.innerHTML = `<span style="font-size:0.75rem; color:var(--text-muted);">No services selected yet. Search above to select one or more services.</span>`;
    } else {
      chipsEl.innerHTML = selected.map((item, idx) => `
        <span style="display:inline-flex; align-items:center; gap:0.35rem; background:var(--surface); border:1px solid var(--border-subtle); border-radius:999px; padding:0.25rem 0.6rem; font-size:0.78rem; font-weight:600;">
          <span>${esc(item.name)}</span>
          <span class="font-mono tabular-nums" style="color:var(--blue-600); font-weight:700;">₹${item.total}</span>
          <button type="button" data-remove-idx="${idx}" style="border:0; background:transparent; color:var(--danger); cursor:pointer; font-weight:800; line-height:1; padding:0 2px;" title="Remove">×</button>
        </span>
      `).join('');

      chipsEl.querySelectorAll('button[data-remove-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = Number(btn.getAttribute('data-remove-idx'));
          selected.splice(i, 1);
          renderState();
          if (typeof onChange === 'function') onChange(getSummary());
        });
      });
    }

    if (billingEl && showBilling && !singleSelect) {
      if (selected.length === 0) {
        billingEl.style.display = 'none';
      } else {
        billingEl.style.display = 'block';
        let shopSum = 0;
        let govSum = 0;
        breakdownEl.innerHTML = selected.map(it => {
          shopSum += Number(it.serviceCharge) || 0;
          govSum += Number(it.govFee) || 0;
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
              <span>${esc(it.name)}${it.nameBn ? ` <span style="color:var(--text-muted); font-size:0.72rem;">(${esc(it.nameBn)})</span>` : ''}</span>
              <span class="font-mono tabular-nums" style="white-space:nowrap;">Shop ${formatINR(it.serviceCharge)}${it.govFee > 0 ? ` + Govt ${formatINR(it.govFee)}` : ''} = <strong>${formatINR(it.total)}</strong></span>
            </div>
          `;
        }).join('');
        if (sumShopEl) sumShopEl.textContent = formatINR(shopSum);
        if (sumGovEl) sumGovEl.textContent = formatINR(govSum);
        if (sumTotalEl) sumTotalEl.textContent = formatINR(shopSum + govSum);
      }
    }
  };

  const renderDropdown = (query = '') => {
    const q = String(query || '').trim().toLowerCase();
    const list = getSearchableRateServices();
    const matched = list.filter(it => {
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        it.nameBn.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q)
      );
    }).slice(0, 40);

    if (matched.length === 0) {
      dropdownEl.innerHTML = `<div style="padding:0.65rem 0.75rem; font-size:0.78rem; color:var(--text-muted);">No matching services found for "${esc(query)}".</div>`;
      dropdownEl.style.display = 'block';
      return;
    }

    const selectedNames = new Set(selected.map(s => s.name.toLowerCase()));
    dropdownEl.innerHTML = matched.map((it, idx) => {
      const isChosen = selectedNames.has(it.name.toLowerCase());
      return `
        <button
          type="button"
          data-opt-idx="${idx}"
          style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; width:100%; text-align:left; border:0; border-bottom:1px solid var(--border-subtle); background:${isChosen ? 'var(--blue-50, #eff6ff)' : 'transparent'}; padding:0.5rem 0.75rem; cursor:pointer; font-size:0.8rem;"
        >
          <div>
            <div style="font-weight:700; color:var(--text-main);">
              ${isChosen ? '✓ ' : ''}${esc(it.name)}${it.nameBn ? ` <span style="font-weight:500; color:var(--text-muted);">(${esc(it.nameBn)})</span>` : ''}
            </div>
            <div style="font-size:0.71rem; color:var(--text-muted);">${esc(it.category)} · ${esc(it.unit)}</div>
          </div>
          <div class="font-mono tabular-nums" style="text-align:right; white-space:nowrap; font-weight:700; color:var(--blue-600);">
            ${formatINR(it.total)}
            ${it.govFee > 0 ? `<div style="font-size:0.67rem; font-weight:500; color:var(--text-muted);">Shop ₹${it.serviceCharge} + Govt ₹${it.govFee}</div>` : ''}
          </div>
        </button>
      `;
    }).join('');
    dropdownEl.style.display = 'block';

    dropdownEl.querySelectorAll('button[data-opt-idx]').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const picked = matched[Number(btn.getAttribute('data-opt-idx'))];
        if (!picked) return;
        if (typeof onSelectItem === 'function') {
          onSelectItem(picked);
          searchEl.value = '';
          dropdownEl.style.display = 'none';
          return;
        }
        if (singleSelect) {
          selected = [{ ...picked }];
        } else {
          const existsIdx = selected.findIndex(s => s.name.toLowerCase() === picked.name.toLowerCase());
          if (existsIdx === -1) {
            selected.push({ ...picked });
          } else {
            selected.splice(existsIdx, 1);
          }
        }
        searchEl.value = '';
        renderState();
        renderDropdown('');
        if (typeof onChange === 'function') onChange(getSummary());
      });
    });
  };

  const getSummary = () => {
    const shopChargeTotal = selected.reduce((s, it) => s + (Number(it.serviceCharge) || 0), 0);
    const govFeeTotal = selected.reduce((s, it) => s + (Number(it.govFee) || 0), 0);
    return {
      services: selected.map(s => ({ ...s })),
      serviceNames: selected.map(s => s.name),
      shopChargeTotal,
      govFeeTotal,
      totalPayable: shopChargeTotal + govFeeTotal
    };
  };

  searchEl.addEventListener('focus', () => renderDropdown(searchEl.value));
  searchEl.addEventListener('input', () => renderDropdown(searchEl.value));
  searchEl.addEventListener('blur', () => {
    setTimeout(() => {
      dropdownEl.style.display = 'none';
    }, 160);
  });

  const onRateUpdated = () => {
    if (!document.getElementById(`${mountId}-wrap`)) {
      window.removeEventListener('mun-rate-chart-updated', onRateUpdated);
      return;
    }
    refreshLiveRates();
    renderState();
    if (typeof onChange === 'function') onChange(getSummary());
  };
  window.addEventListener('mun-rate-chart-updated', onRateUpdated);

  selectorInstances.set(mountId, {
    getSummary,
    setServices: (items = []) => {
      selected = [];
      (Array.isArray(items) ? items : [items]).filter(Boolean).forEach(entry => {
        const name = typeof entry === 'string' ? entry : entry.name;
        const m = findCatalogMatch(name);
        if (m) selected.push({ ...m });
        else if (name) selected.push({ id: `CUSTOM-${name}`, name, nameBn: '', category: 'Service', serviceCharge: 0, govFee: 0, total: 0 });
      });
      renderState();
      if (typeof onChange === 'function') onChange(getSummary());
    }
  });

  renderState();
  return selectorInstances.get(mountId);
}

export function getSelectedServicesState(mountId) {
  const inst = selectorInstances.get(mountId);
  if (!inst) {
    return { services: [], serviceNames: [], shopChargeTotal: 0, govFeeTotal: 0, totalPayable: 0 };
  }
  return inst.getSummary();
}

export function setSelectedServicesState(mountId, items = []) {
  const inst = selectorInstances.get(mountId);
  if (inst && typeof inst.setServices === 'function') {
    inst.setServices(items);
  }
}
