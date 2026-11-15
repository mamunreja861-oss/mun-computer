/**
 * locationCascade.js
 * All-India Cascading Location Dropdown Component (Backend + Official India Post API)
 * Hierarchy: State -> District -> Village / Location -> Post Office (P.O.) -> Police Station (P.S.) -> PIN Code
 * Supports Quick 6-digit PIN Auto-Fill & Custom Location Persistence
 */

import {
  getMasterWards,
  getMasterVillagesByWard,
  getAllMasterVillages,
  resolveWardForApp,
  resolveMasterLocationByWard,
  resolveMasterLocationByVillage,
  resolveMasterLocationsByPin
} from './wardVillageMaster.js';
import { getAuthHeaders } from './storage.js';

const apiCache = new Map();
const CUSTOM_SENTINEL = '__CUSTOM__';
const cascadeRegistry = new Map();

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('mun-location-master-updated', () => {
    apiCache.clear();
  });
}

async function fetchJsonCached(url) {
  if (apiCache.has(url)) {
    return apiCache.get(url);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  apiCache.set(url, data);
  return data;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function findMatchingOption(options, target) {
  if (!target) return '';
  const t = String(target).trim().toLowerCase();
  const exact = options.find(o => o.toLowerCase() === t);
  if (exact) return exact;
  const partial = options.find(o => o.toLowerCase().includes(t) || t.includes(o.toLowerCase()));
  return partial || '';
}

function populateSelect(selectEl, options, { placeholder = '-- Select --', selectedValue = '', allowCustom = false, customLabel = '+ Enter Custom...' } = {}) {
  if (!selectEl) return '';
  const uniqueOpts = Array.from(new Set((options || []).filter(Boolean)));
  const matched = findMatchingOption(uniqueOpts, selectedValue);

  let html = `<option value="">${esc(placeholder)}</option>`;
  for (const opt of uniqueOpts) {
    html += `<option value="${esc(opt)}" ${matched === opt ? 'selected' : ''}>${esc(opt)}</option>`;
  }

  let usedCustom = false;
  if (selectedValue && !matched) {
    if (allowCustom) {
      usedCustom = true;
    } else {
      html += `<option value="${esc(selectedValue)}" selected>${esc(selectedValue)}</option>`;
    }
  }

  if (allowCustom) {
    html += `<option value="${CUSTOM_SENTINEL}" ${usedCustom ? 'selected' : ''}>${esc(customLabel)}</option>`;
  }

  selectEl.innerHTML = html;
  return matched || (usedCustom ? CUSTOM_SENTINEL : selectedValue || '');
}

function toggleCustomInput(prefix, fieldKey, show, val = '') {
  const customInput = document.getElementById(`${prefix}-${fieldKey}-custom`);
  if (!customInput) return;
  customInput.style.display = show ? 'block' : 'none';
  if (show && val !== undefined && val !== null) {
    customInput.value = val;
  }
  if (!show) {
    customInput.value = '';
  }
}

function readFieldValue(prefix, fieldKey) {
  const sel = document.getElementById(`${prefix}-${fieldKey}`);
  const custom = document.getElementById(`${prefix}-${fieldKey}-custom`);
  if (!sel) return '';
  if (sel.value === CUSTOM_SENTINEL) {
    return custom ? custom.value.trim() : '';
  }
  return sel.value.trim();
}

export function getLocationCascadeValues(prefix) {
  const areaToggle = document.querySelector(`input[name="${prefix}-areatype"]:checked`);
  const areaType = areaToggle ? areaToggle.value : 'RURAL';
  const state = readFieldValue(prefix, 'state');
  const district = readFieldValue(prefix, 'district');
  const subdivision = readFieldValue(prefix, 'subdivision');
  const blockOrMunicipality = readFieldValue(prefix, 'blockmun');
  const gpOrWard = readFieldValue(prefix, 'gpward');
  const village = readFieldValue(prefix, 'village');
  const postOffice = readFieldValue(prefix, 'post');
  const policeStation = readFieldValue(prefix, 'police');
  const pinCode = readFieldValue(prefix, 'pin');
  const resolvedWard = areaType === 'URBAN' ? resolveWardForApp({ gpOrWard, wardNumber: gpOrWard }) : null;

  const parts = [];
  if (village) parts.push(`${areaType === 'URBAN' ? 'Locality' : 'Vill'}: ${village}`);
  if (areaType === 'URBAN' && gpOrWard) parts.push(gpOrWard);
  if (areaType === 'URBAN' && blockOrMunicipality) parts.push(blockOrMunicipality);
  if (areaType === 'RURAL' && gpOrWard) parts.push(`GP: ${gpOrWard}`);
  if (areaType === 'RURAL' && blockOrMunicipality) parts.push(`Block: ${blockOrMunicipality}`);
  if (postOffice) parts.push(`P.O.: ${postOffice}`);
  if (policeStation) parts.push(`P.S.: ${policeStation}`);
  if (district) parts.push(`Dist: ${district}`);
  if (state) parts.push(state);
  const formattedAddress = parts.join(', ') + (pinCode ? ` - ${pinCode}` : '');

  return {
    areaType,
    state,
    district,
    subdivision,
    blockOrMunicipality,
    gpOrWard,
    wardId: resolvedWard?.wardId || '',
    wardNo: resolvedWard?.wardNo || '',
    wardNumber: resolvedWard?.wardNumber || (areaType === 'URBAN' ? gpOrWard : ''),
    village,
    postOffice,
    policeStation,
    pinCode,
    formattedAddress
  };
}

export async function syncLocationCascadeSelection(prefix, patch = {}) {
  const instance = cascadeRegistry.get(prefix);
  if (instance && typeof instance.applySelection === 'function') {
    await instance.applySelection(patch);
    return getLocationCascadeValues(prefix);
  }
  await initLocationCascade(prefix, patch);
  return getLocationCascadeValues(prefix);
}

export async function saveCustomLocationIfNeeded(values) {
  if (!values || !values.state || !values.district || !values.village) return;
  try {
    await fetch('/api/locations/custom', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        state: values.state,
        district: values.district,
        village: values.village,
        postOffice: values.postOffice,
        policeStation: values.policeStation,
        pincode: values.pinCode
      })
    });
    apiCache.clear();
  } catch {
    // Non-blocking
  }
}

export function renderLocationCascadeHtml(prefix, options = {}) {
  const {
    title = '📍 Location Details (Village / P.O. / P.S. / District / PIN)',
    required = true,
    compact = false,
    showPinQuickFill = true,
    checkoutMode = false,
    checkoutSlotHtml = ''
  } = options;

  const reqMark = required ? '<span class="req">*</span>' : '';
  const reqAttr = required ? 'required' : '';

  if (checkoutMode) {
    return `
      <div id="${prefix}-container" style="display:flex; flex-direction:column; gap:0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div style="display:inline-flex; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:2px; font-size:0.72rem; font-weight:700;">
            <label style="padding:0.2rem 0.55rem; cursor:pointer; display:flex; align-items:center; gap:0.25rem;">
              <input type="radio" name="${prefix}-areatype" value="RURAL" checked> Rural (Block/GP)
            </label>
            <label style="padding:0.2rem 0.55rem; cursor:pointer; display:flex; align-items:center; gap:0.25rem;">
              <input type="radio" name="${prefix}-areatype" value="URBAN"> Urban (Municipality/Ward)
            </label>
          </div>
          <span id="${prefix}-pin-readout" class="tabular-nums font-mono" style="font-size:0.74rem; font-weight:700; color:var(--success);"></span>
        </div>

        <div id="${prefix}-status-bar" style="display:none; font-size:0.74rem; color:var(--blue-700); padding:0.4rem 0.65rem; background:var(--blue-50); border-radius:var(--radius-sm);"></div>

        <!-- Primary Quick Info Row: PIN / Village Auto-Fill + Quick Info Slot (Aadhaar Last 4) -->
        <div class="checkout-grid-2">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">PIN Code / Village Auto-Fill ${reqMark}</label>
            <div style="display:flex; gap:0.4rem; align-items:center; position:relative;">
              <input type="text" id="${prefix}-pin-quick" class="form-control font-mono tabular-nums"
                placeholder="Enter 6-digit PIN or Village (e.g. 742406, Mamudpur)" style="flex:1;">
              <button type="button" id="${prefix}-pin-btn" class="btn btn-secondary btn-sm" style="height:38px; white-space:nowrap;">
                Auto-Fill
              </button>
            </div>
            <div id="${prefix}-quick-suggestions" style="display:none; margin-top:0.25rem; max-height:160px; overflow-y:auto; background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); box-shadow:0 4px 12px rgba(15,23,42,0.08);"></div>
          </div>
          ${checkoutSlotHtml || ''}
        </div>

        <div class="checkout-grid-2">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" id="${prefix}-village-label">Village / Locality ${reqMark}</label>
            <select id="${prefix}-village" class="form-control" ${reqAttr}>
              <option value="">-- Select District / Enter PIN --</option>
            </select>
            <input type="text" id="${prefix}-village-custom" class="form-control" style="display:none; margin-top:0.35rem;" placeholder="Enter custom Village / Locality">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Post Office (P.O.) ${reqMark}</label>
            <select id="${prefix}-post" class="form-control" ${reqAttr}>
              <option value="">-- Select Village / PIN --</option>
            </select>
            <input type="text" id="${prefix}-post-custom" class="form-control" style="display:none; margin-top:0.35rem;" placeholder="Enter custom Post Office name">
          </div>
        </div>

        <!-- Murshidabad Subdivision / Block / GP Tier -->
        <div id="${prefix}-murshidabad-tier" class="form-row" style="display:none; margin-bottom:0;">
          <div class="form-group" id="${prefix}-subdivision-wrap" style="margin-bottom:0;">
            <label class="form-label">Subdivision</label>
            <select id="${prefix}-subdivision" class="form-control">
              <option value="">All Subdivisions</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" id="${prefix}-blockmun-label">Block</label>
            <select id="${prefix}-blockmun" class="form-control">
              <option value="">-- Select --</option>
            </select>
            <input type="text" id="${prefix}-blockmun-custom" class="form-control" style="display:none; margin-top:0.35rem;" placeholder="Enter Block / Municipality">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" id="${prefix}-gpward-label">Gram Panchayat</label>
            <select id="${prefix}-gpward" class="form-control">
              <option value="">-- Select --</option>
            </select>
            <input type="text" id="${prefix}-gpward-custom" class="form-control" style="display:none; margin-top:0.35rem;" placeholder="Enter GP / Ward">
          </div>
        </div>

        <div class="form-row" style="margin-bottom:0;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">State ${reqMark}</label>
            <select id="${prefix}-state" class="form-control" ${reqAttr}>
              <option value="">Loading States...</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">District ${reqMark}</label>
            <select id="${prefix}-district" class="form-control" ${reqAttr}>
              <option value="">-- Select State First --</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Police Station (P.S.)</label>
            <select id="${prefix}-police" class="form-control">
              <option value="">-- Select P.O. / District --</option>
            </select>
            <input type="text" id="${prefix}-police-custom" class="form-control" style="display:none; margin-top:0.35rem;" placeholder="Enter custom Police Station">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Confirm PIN Code ${reqMark}</label>
            <select id="${prefix}-pin" class="form-control font-mono" ${reqAttr}>
              <option value="">-- Select PIN Code --</option>
            </select>
            <input type="text" id="${prefix}-pin-custom" class="form-control font-mono" maxlength="6" pattern="[0-9]{6}" style="display:none; margin-top:0.35rem;" placeholder="Enter 6-digit PIN Code">
          </div>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.74rem; color:var(--text-muted);">Full Address (Auto-Compiled)</label>
          <input type="text" id="${prefix}-full-address-preview" class="form-control" readonly
            placeholder="Select State, District, Village, P.O., P.S., and PIN to auto-compile full address"
            style="background:var(--surface-alt); font-weight:600; color:var(--text-main);">
        </div>
      </div>
    `;
  }

  return `
    <div id="${prefix}-container" style="background:var(--surface-alt); padding:${compact ? '0.7rem' : '0.85rem'}; border-radius:var(--radius-md); border:1px solid var(--border-subtle); margin-bottom:0.75rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.6rem;">
        <div style="font-size:0.75rem; font-weight:800; color:var(--blue-700); text-transform:uppercase;">
          ${title}
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <div style="display:inline-flex; background:var(--surface); border:1px solid var(--border-subtle); border-radius:6px; padding:2px; font-size:0.7rem; font-weight:700;">
            <label style="padding:0.15rem 0.45rem; cursor:pointer; display:flex; align-items:center; gap:0.2rem;">
              <input type="radio" name="${prefix}-areatype" value="RURAL" checked> Rural (Block/GP)
            </label>
            <label style="padding:0.15rem 0.45rem; cursor:pointer; display:flex; align-items:center; gap:0.2rem;">
              <input type="radio" name="${prefix}-areatype" value="URBAN"> Urban (Municipality/Ward)
            </label>
          </div>
          ${showPinQuickFill ? `
            <div style="display:flex; align-items:center; gap:0.35rem; position:relative;">
              <input type="text" id="${prefix}-pin-quick" class="form-control font-mono"
                placeholder="PIN or Village Auto-Fill (742406 / Mamudpur)"
                style="height:28px; width:245px; font-size:0.74rem; padding:0.2rem 0.5rem;">
              <button type="button" id="${prefix}-pin-btn" class="btn btn-outline btn-sm" style="height:28px; padding:0 0.55rem; font-size:0.72rem;">
                Auto-Fill
              </button>
            </div>
          ` : ''}
        </div>
      </div>

      <div id="${prefix}-quick-suggestions" style="display:none; margin-bottom:0.45rem; max-height:150px; overflow-y:auto; background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-sm);"></div>
      <div id="${prefix}-status-bar" style="display:none; font-size:0.72rem; color:var(--blue-700); margin-bottom:0.45rem;"></div>

      <!-- Step 1 & 2: State -> District -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">1. State ${reqMark}</label>
          <select id="${prefix}-state" class="form-control" ${reqAttr}>
            <option value="">Loading States...</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">2. District ${reqMark}</label>
          <select id="${prefix}-district" class="form-control" ${reqAttr}>
            <option value="">-- Select State First --</option>
          </select>
        </div>
      </div>

      <!-- Murshidabad Subdivision / Block or Municipality / GP or Ward -->
      <div id="${prefix}-murshidabad-tier" class="form-row" style="display:none;">
        <div class="form-group" id="${prefix}-subdivision-wrap">
          <label class="form-label">Subdivision</label>
          <select id="${prefix}-subdivision" class="form-control">
            <option value="">All Subdivisions</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" id="${prefix}-blockmun-label">Block</label>
          <select id="${prefix}-blockmun" class="form-control">
            <option value="">-- Select --</option>
          </select>
          <input type="text" id="${prefix}-blockmun-custom" class="form-control" style="display:none; margin-top:0.35rem;" placeholder="Enter Block / Municipality">
        </div>
        <div class="form-group">
          <label class="form-label" id="${prefix}-gpward-label">Gram Panchayat</label>
          <select id="${prefix}-gpward" class="form-control">
            <option value="">-- Select --</option>
          </select>
          <input type="text" id="${prefix}-gpward-custom" class="form-control" style="display:none; margin-top:0.35rem;" placeholder="Enter GP / Ward">
        </div>
      </div>

      <!-- Step 3 & 4: Village / Locality -> Post Office (P.O.) -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" id="${prefix}-village-label">3. Village / Locality ${reqMark}</label>
          <select id="${prefix}-village" class="form-control" ${reqAttr}>
            <option value="">-- Select District First --</option>
          </select>
          <input type="text" id="${prefix}-village-custom" class="form-control" style="display:none; margin-top:0.35rem;" placeholder="Enter custom Village / Locality">
        </div>
        <div class="form-group">
          <label class="form-label">4. Post Office (P.O.) ${reqMark}</label>
          <select id="${prefix}-post" class="form-control" ${reqAttr}>
            <option value="">-- Select Village First --</option>
          </select>
          <input type="text" id="${prefix}-post-custom" class="form-control" style="display:none; margin-top:0.35rem;" placeholder="Enter custom Post Office name">
        </div>
      </div>

      <!-- Step 5 & 6: Police Station (P.S.) -> PIN Code -->
      <div class="form-row" style="margin-bottom:0.65rem;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">5. Police Station (P.S.)</label>
          <select id="${prefix}-police" class="form-control">
            <option value="">-- Select P.O. / District --</option>
          </select>
          <input type="text" id="${prefix}-police-custom" class="form-control" style="display:none; margin-top:0.35rem;" placeholder="Enter custom Police Station">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
            <span>6. PIN Code ${reqMark}</span>
            <span id="${prefix}-pin-readout" class="tabular-nums font-mono" style="font-size:0.74rem; font-weight:800; color:var(--success);"></span>
          </label>
          <select id="${prefix}-pin" class="form-control font-mono" ${reqAttr}>
            <option value="">-- Select PIN Code --</option>
          </select>
          <input type="text" id="${prefix}-pin-custom" class="form-control font-mono" maxlength="6" pattern="[0-9]{6}" style="display:none; margin-top:0.35rem;" placeholder="Enter 6-digit PIN Code">
        </div>
      </div>

      <!-- Live Compiled Read-Only Full Address Preview -->
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-size:0.74rem; color:var(--text-muted);">Full Address (Auto-Compiled Preview)</label>
        <input type="text" id="${prefix}-full-address-preview" class="form-control" readonly
          placeholder="Select State, District, Village, P.O., P.S., and PIN to auto-compile full address"
          style="background:var(--surface); font-weight:600; color:var(--text-main);">
      </div>
    </div>
  `;
}

export async function initLocationCascade(prefix, initial = {}, options = {}) {
  const { onChange = null } = options;

  const stateEl = document.getElementById(`${prefix}-state`);
  const distEl = document.getElementById(`${prefix}-district`);
  const vilEl = document.getElementById(`${prefix}-village`);
  const postEl = document.getElementById(`${prefix}-post`);
  const psEl = document.getElementById(`${prefix}-police`);
  const pinEl = document.getElementById(`${prefix}-pin`);
  const statusEl = document.getElementById(`${prefix}-status-bar`);
  const quickPinInput = document.getElementById(`${prefix}-pin-quick`);
  const quickPinBtn = document.getElementById(`${prefix}-pin-btn`);
  const pinReadoutEl = document.getElementById(`${prefix}-pin-readout`);

  if (!stateEl || !distEl || !vilEl || !postEl || !psEl || !pinEl) return;

  // Map village/locality name (lowercase) -> { pinCode, postOffice, policeStation, gpOrWard, blockOrMunicipality }
  const msdRecordMap = new Map();

  const updatePinReadout = (pin) => {
    if (!pinReadoutEl) return;
    const clean = String(pin || '').replace(/[^0-9]/g, '').slice(0, 6);
    pinReadoutEl.textContent = clean.length === 6 ? `Auto-PIN: ${clean}` : '';
  };

  const setStatus = (msg, isError = false) => {
    if (!statusEl) return;
    if (!msg) {
      statusEl.style.display = 'none';
      statusEl.textContent = '';
    } else {
      statusEl.style.display = 'block';
      statusEl.style.color = isError ? 'var(--danger)' : 'var(--blue-700)';
      statusEl.textContent = msg;
    }
  };

  const fullAddrPreviewEl = document.getElementById(`${prefix}-full-address-preview`);
  const quickSuggestionsEl = document.getElementById(`${prefix}-quick-suggestions`);

  const updateFullAddressPreview = () => {
    if (!fullAddrPreviewEl) return;
    const vals = getLocationCascadeValues(prefix);
    fullAddrPreviewEl.value = vals.formattedAddress || '';
  };

  const emitChange = () => {
    updateFullAddressPreview();
    if (typeof onChange === 'function') {
      onChange(getLocationCascadeValues(prefix));
    }
  };

  async function loadPincodes(presetPin = '') {
    const st = readFieldValue(prefix, 'state');
    const dist = readFieldValue(prefix, 'district');
    const vil = readFieldValue(prefix, 'village');
    const po = readFieldValue(prefix, 'post');
    const ps = readFieldValue(prefix, 'police');

    if (!dist) {
      populateSelect(pinEl, [], { placeholder: '-- Select PIN Code --', allowCustom: true, customLabel: '+ Enter Custom 6-digit PIN' });
      toggleCustomInput(prefix, 'pin', false);
      return;
    }

    const qs = new URLSearchParams({ state: st, district: dist, village: vil, postOffice: po, policeStation: ps });
    const data = await fetchJsonCached(`/api/locations/pincodes?${qs.toString()}`);
    const pins = data.pincodes || [];
    const targetPin = presetPin || (pins.length === 1 ? pins[0] : '');
    const selected = populateSelect(pinEl, pins, {
      placeholder: pins.length ? '-- Select PIN Code --' : '-- Enter Custom PIN --',
      selectedValue: targetPin,
      allowCustom: true,
      customLabel: '+ Enter Custom 6-digit PIN'
    });
    toggleCustomInput(prefix, 'pin', selected === CUSTOM_SENTINEL, selected === CUSTOM_SENTINEL ? targetPin : '');
    updatePinReadout(targetPin);
    if (quickPinInput && targetPin && selected !== CUSTOM_SENTINEL) {
      quickPinInput.value = targetPin;
    }
  }

  async function loadPoliceStations(presetPs = '', presetPin = '') {
    const st = readFieldValue(prefix, 'state');
    const dist = readFieldValue(prefix, 'district');
    const vil = readFieldValue(prefix, 'village');
    const po = readFieldValue(prefix, 'post');

    if (!dist) {
      populateSelect(psEl, [], { placeholder: '-- Select Police Station --', allowCustom: true, customLabel: '+ Custom Police Station' });
      toggleCustomInput(prefix, 'police', false);
      await loadPincodes(presetPin);
      return;
    }

    const qs = new URLSearchParams({ state: st, district: dist, village: vil, postOffice: po });
    const data = await fetchJsonCached(`/api/locations/police-stations?${qs.toString()}`);
    const stations = data.policeStations || [];
    const targetPs = presetPs || (stations.length === 1 ? stations[0] : '');
    const selected = populateSelect(psEl, stations, {
      placeholder: '-- Select Police Station (P.S.) --',
      selectedValue: targetPs,
      allowCustom: true,
      customLabel: '+ Other / Custom Police Station'
    });
    toggleCustomInput(prefix, 'police', selected === CUSTOM_SENTINEL, selected === CUSTOM_SENTINEL ? targetPs : '');
    await loadPincodes(presetPin);
  }

  async function loadPostOffices(presetPo = '', presetPs = '', presetPin = '') {
    const st = readFieldValue(prefix, 'state');
    const dist = readFieldValue(prefix, 'district');
    const vil = readFieldValue(prefix, 'village');

    if (!dist) {
      populateSelect(postEl, [], { placeholder: '-- Select Post Office --', allowCustom: true, customLabel: '+ Custom Post Office' });
      toggleCustomInput(prefix, 'post', false);
      await loadPoliceStations(presetPs, presetPin);
      return;
    }

    const qs = new URLSearchParams({ state: st, district: dist, village: vil });
    const data = await fetchJsonCached(`/api/locations/post-offices?${qs.toString()}`);
    const pos = data.postOffices || [];
    const targetPo = presetPo || (pos.length === 1 ? pos[0] : '');
    const selected = populateSelect(postEl, pos, {
      placeholder: '-- Select Post Office (P.O.) --',
      selectedValue: targetPo,
      allowCustom: true,
      customLabel: '+ Other / Custom Post Office'
    });
    toggleCustomInput(prefix, 'post', selected === CUSTOM_SENTINEL, selected === CUSTOM_SENTINEL ? targetPo : '');
    await loadPoliceStations(presetPs, presetPin);
  }

  async function loadVillages(presetVil = '', presetPo = '', presetPs = '', presetPin = '') {
    const st = readFieldValue(prefix, 'state');
    const dist = readFieldValue(prefix, 'district');

    if (!dist) {
      populateSelect(vilEl, [], { placeholder: '-- Select District First --', allowCustom: true, customLabel: '+ Custom Village / Location' });
      toggleCustomInput(prefix, 'village', false);
      await loadPostOffices(presetPo, presetPs, presetPin);
      return;
    }

    setStatus(`Loading villages & India Post directory for ${dist}, ${st}...`);
    const qs = new URLSearchParams({ state: st, district: dist });
    const data = await fetchJsonCached(`/api/locations/villages?${qs.toString()}`);
    const villages = data.villages || [];
    setStatus('');

    const selected = populateSelect(vilEl, villages, {
      placeholder: villages.length ? `-- Select Village / Location (${villages.length}) --` : '-- Select or Add Custom Village --',
      selectedValue: presetVil,
      allowCustom: true,
      customLabel: '+ Other / Custom Village / Location'
    });
    toggleCustomInput(prefix, 'village', selected === CUSTOM_SENTINEL, selected === CUSTOM_SENTINEL ? presetVil : '');
    await loadPostOffices(presetPo, presetPs, presetPin);
  }

  async function loadDistricts(presetDist = '', presetVil = '', presetPo = '', presetPs = '', presetPin = '') {
    const st = readFieldValue(prefix, 'state');
    if (!st) {
      populateSelect(distEl, [], { placeholder: '-- Select State First --' });
      await loadVillages(presetVil, presetPo, presetPs, presetPin);
      return;
    }

    const qs = new URLSearchParams({ state: st });
    const data = await fetchJsonCached(`/api/locations/districts?${qs.toString()}`);
    const districts = data.districts || [];
    populateSelect(distEl, districts, {
      placeholder: `-- Select District (${districts.length}) --`,
      selectedValue: presetDist,
      allowCustom: false
    });
    await loadVillages(presetVil, presetPo, presetPs, presetPin);
  }

  async function loadStates(preset = {}) {
    try {
      const data = await fetchJsonCached('/api/locations/states');
      const states = data.states || [];
      const defaultState = preset.state || 'West Bengal';
      const defaultDistrict = preset.district || (defaultState === 'West Bengal' ? 'Murshidabad' : '');
      populateSelect(stateEl, states, {
        placeholder: '-- Select State / UT (36) --',
        selectedValue: defaultState,
        allowCustom: false
      });
      await loadDistricts(
        defaultDistrict,
        preset.village || '',
        preset.postOffice || '',
        preset.policeStation || '',
        preset.pinCode || ''
      );
      updateFullAddressPreview();
    } catch (err) {
      setStatus('Location API unreachable. Please check connection.', true);
    }
  }

  // Event listeners for cascading flow
  stateEl.addEventListener('change', async () => {
    await loadDistricts();
    await syncMurshidabadTier();
    emitChange();
  });

  distEl.addEventListener('change', async () => {
    await loadVillages();
    await syncMurshidabadTier();
    emitChange();
  });

  vilEl.addEventListener('change', async () => {
    const isCustom = vilEl.value === CUSTOM_SENTINEL;
    toggleCustomInput(prefix, 'village', isCustom);
    if (!isCustom && vilEl.value) {
      const msdMatch = msdRecordMap.get(vilEl.value.trim().toLowerCase());
      if (msdMatch) {
        if (msdMatch.gpOrWard && gpWardEl && !gpWardEl.value) {
          populateSelect(gpWardEl, Array.from(gpWardEl.options).map(o => o.value).filter(v => v && v !== CUSTOM_SENTINEL), {
            placeholder: '-- Select --',
            selectedValue: msdMatch.gpOrWard,
            allowCustom: true
          });
        }
        await loadPostOffices(msdMatch.postOffice || '', msdMatch.policeStation || '', msdMatch.pinCode || '');
        updatePinReadout(msdMatch.pinCode || '');
        emitChange();
        return;
      }
    }
    await loadPostOffices();
    emitChange();
  });

  postEl.addEventListener('change', async () => {
    const isCustom = postEl.value === CUSTOM_SENTINEL;
    toggleCustomInput(prefix, 'post', isCustom);
    await loadPoliceStations();
    emitChange();
  });

  psEl.addEventListener('change', async () => {
    const isCustom = psEl.value === CUSTOM_SENTINEL;
    toggleCustomInput(prefix, 'police', isCustom);
    await loadPincodes();
    emitChange();
  });

  pinEl.addEventListener('change', () => {
    const isCustom = pinEl.value === CUSTOM_SENTINEL;
    toggleCustomInput(prefix, 'pin', isCustom);
    const activePin = isCustom ? (document.getElementById(`${prefix}-pin-custom`)?.value || '') : pinEl.value;
    updatePinReadout(activePin);
    if (quickPinInput && !isCustom) quickPinInput.value = pinEl.value;
    emitChange();
  });

  // Sync custom inputs to emitChange & auto-add verified missing village if Murshidabad + 6-digit PIN
  const tryAutoAddVerifiedMissingVillage = async () => {
    const vals = getLocationCascadeValues(prefix);
    if (
      vals.district.toLowerCase() === 'murshidabad' &&
      vilEl.value === CUSTOM_SENTINEL &&
      vals.village &&
      /^\d{6}$/.test(vals.pinCode)
    ) {
      try {
        const res = await fetch('/api/locations/villages/auto-add', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            areaType: vals.areaType,
            blockOrMunicipality: vals.blockOrMunicipality || 'Domkal',
            gpOrWard: vals.gpOrWard,
            name: vals.village,
            pinCode: vals.pinCode,
            postOffice: vals.postOffice,
            policeStation: vals.policeStation
          })
        });
        const data = await res.json();
        if (data.success) {
          apiCache.clear();
          setStatus(`✓ Verified & auto-added missing village "${vals.village}" (${vals.pinCode}) to Murshidabad database.`);
        }
      } catch {
        // Non-blocking
      }
    }
  };

  ['village-custom', 'post-custom', 'police-custom', 'pin-custom'].forEach(suffix => {
    const el = document.getElementById(`${prefix}-${suffix}`);
    if (el) {
      el.addEventListener('input', () => {
        if (suffix === 'pin-custom') updatePinReadout(el.value);
        emitChange();
      });
      if (suffix === 'village-custom' || suffix === 'pin-custom') {
        el.addEventListener('blur', tryAutoAddVerifiedMissingVillage);
      }
    }
  });

  const subEl = document.getElementById(`${prefix}-subdivision`);
  const blockMunEl = document.getElementById(`${prefix}-blockmun`);
  const gpWardEl = document.getElementById(`${prefix}-gpward`);
  const tierEl = document.getElementById(`${prefix}-murshidabad-tier`);
  const subWrap = document.getElementById(`${prefix}-subdivision-wrap`);
  const blockMunLabel = document.getElementById(`${prefix}-blockmun-label`);
  const gpWardLabel = document.getElementById(`${prefix}-gpward-label`);
  const villageLabel = document.getElementById(`${prefix}-village-label`);

  const detectAreaTypeFromData = (data = {}, fallback = 'RURAL') => {
    if (data.areaType === 'URBAN' || data.areaType === 'RURAL') return data.areaType;
    const text = `${data.blockOrMunicipality || ''} ${data.gpOrWard || ''} ${data.wardNumber || ''}`.toLowerCase();
    if (data.wardId || /ward\s*\d+|domkal\s+municipality|municipality/i.test(text)) return 'URBAN';
    return fallback;
  };

  const setAreaTypeRadio = (mode) => {
    const val = mode === 'URBAN' ? 'URBAN' : 'RURAL';
    document.querySelectorAll(`input[name="${prefix}-areatype"]`).forEach(radio => {
      radio.checked = (radio.value === val);
    });
  };

  let pendingTierValues = {
    subdivision: initial.subdivision || '',
    blockOrMunicipality: initial.blockOrMunicipality || '',
    gpOrWard: initial.gpOrWard || initial.wardNumber || ''
  };

  const initialArea = detectAreaTypeFromData(initial, 'RURAL');
  setAreaTypeRadio(initialArea);

  const applyMasterFallbackPin = (pin) => {
    const localPin = resolveMasterLocationsByPin(pin);
    if (!localPin) return null;
    return {
      found: true,
      state: localPin.state,
      district: localPin.district,
      areaType: localPin.areaType,
      blockOrMunicipality: localPin.blockOrMunicipality,
      wards: localPin.wards.map(w => w.wardNumber),
      villages: localPin.villages.map(v => v.name),
      postOffices: localPin.postOffices,
      policeStations: localPin.policeStations
    };
  };

  // Quick PIN Code or Village / Block Reverse Auto-Fill
  const hideSuggestions = () => {
    if (quickSuggestionsEl) {
      quickSuggestionsEl.style.display = 'none';
      quickSuggestionsEl.innerHTML = '';
    }
  };

  const applyVillageLookupMatch = async (match) => {
    if (!match) return;
    hideSuggestions();
    setAreaTypeRadio(match.areaType === 'URBAN' ? 'URBAN' : 'RURAL');
    pendingTierValues = {
      subdivision: '',
      blockOrMunicipality: match.blockOrMunicipality || (match.areaType === 'URBAN' ? 'Domkal Municipality' : ''),
      gpOrWard: match.gpOrWard || ''
    };
    setStatus(`Auto-filled from ${match.village}: ${match.postOffice ? `P.O. ${match.postOffice}, ` : ''}${match.district} (${match.pincode || '-'})`);
    await loadStates({
      state: match.state || 'West Bengal',
      district: match.district || 'Murshidabad',
      village: match.village || '',
      postOffice: match.postOffice || '',
      policeStation: match.policeStation || '',
      pinCode: match.pincode || ''
    });
    await syncMurshidabadTier();
    emitChange();
  };

  const runQuickLocationLookup = async () => {
    if (!quickPinInput) return;
    const raw = String(quickPinInput.value || '').trim();
    if (!raw) {
      hideSuggestions();
      return;
    }
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    // Pure 6-digit numeric PIN Code lookup
    if (/^\d{6}$/.test(raw) || (digitsOnly.length === 6 && digitsOnly.length === raw.length)) {
      const pin = digitsOnly;
      quickPinInput.value = pin;
      hideSuggestions();
      setStatus(`Looking up PIN ${pin}...`);
      try {
        let res = null;
        try {
          res = await fetchJsonCached(`/api/locations/pincode/${pin}`);
        } catch {
          res = null;
        }
        const localMasterPin = applyMasterFallbackPin(pin);
        if ((!res || !res.found) && localMasterPin) {
          res = localMasterPin;
        }
        if (!res || !res.found) {
          setStatus(`PIN ${pin} not found in directory. You can select State/District manually.`, true);
          return;
        }

        const masterWardsForPin = localMasterPin?.wards || [];
        const curWard = readFieldValue(prefix, 'gpward');
        const curVil = readFieldValue(prefix, 'village');
        const matchedWardFromPin = curWard
          ? (masterWardsForPin.find(w => w.wardNumber.toLowerCase() === curWard.toLowerCase()) || masterWardsForPin[0])
          : (masterWardsForPin.length === 1 ? masterWardsForPin[0] : null);

        const mergedVillages = Array.from(new Set([
          ...(localMasterPin?.villages || []),
          ...(res.villages || [])
        ])).filter(Boolean);
        const mergedPos = Array.from(new Set([
          ...(localMasterPin?.postOffices || []),
          ...(res.postOffices || [])
        ])).filter(Boolean);
        const mergedPs = Array.from(new Set([
          ...(localMasterPin?.policeStations || []),
          ...(res.policeStations || [])
        ])).filter(Boolean);

        const currentArea = getAreaType();
        const chosenArea = (localMasterPin && (currentArea === 'URBAN' || masterWardsForPin.length > 0))
          ? (res.blocks?.length && currentArea === 'RURAL' ? 'RURAL' : 'URBAN')
          : (res.blocks?.length ? 'RURAL' : currentArea);

        setAreaTypeRadio(chosenArea);
        if (chosenArea === 'URBAN') {
          pendingTierValues = {
            subdivision: '',
            blockOrMunicipality: 'Domkal Municipality',
            gpOrWard: matchedWardFromPin?.wardNumber || (curWard && masterWardsForPin.some(w => w.wardNumber === curWard) ? curWard : '')
          };
        } else if (res.blocks?.length) {
          pendingTierValues = {
            subdivision: '',
            blockOrMunicipality: res.blocks[0] || '',
            gpOrWard: ''
          };
        }

        const targetVil = (curVil && mergedVillages.some(v => v.toLowerCase() === curVil.toLowerCase()))
          ? curVil
          : (mergedVillages[0] || '');

        setStatus(`Auto-filled PIN ${pin}: ${res.district}, ${res.state}${masterWardsForPin.length ? ` · ${masterWardsForPin.length} Ward(s)` : ''} · ${mergedPos.length} P.O.`);
        await loadStates({
          state: res.state,
          district: res.district,
          village: targetVil,
          postOffice: mergedPos[0] || '',
          policeStation: mergedPs[0] || '',
          pinCode: pin
        });
        await syncMurshidabadTier();
        emitChange();
      } catch {
        setStatus('Failed to lookup PIN Code from server.', true);
      }
      return;
    }

    // Reverse Village / Block lookup
    if (raw.length < 2) {
      hideSuggestions();
      return;
    }
    try {
      const localVil = resolveMasterLocationByVillage(raw);
      let apiRes = null;
      try {
        const qs = new URLSearchParams({
          q: raw,
          district: readFieldValue(prefix, 'district') || '',
          state: readFieldValue(prefix, 'state') || ''
        });
        apiRes = await fetchJsonCached(`/api/locations/lookup-village?${qs.toString()}`);
      } catch {
        apiRes = null;
      }

      const matches = Array.isArray(apiRes?.matches) ? [...apiRes.matches] : [];
      if (localVil && !matches.some(m => m.village.toLowerCase() === localVil.village.toLowerCase())) {
        matches.unshift({
          state: 'West Bengal',
          district: 'Murshidabad',
          village: localVil.village,
          postOffice: localVil.postOffice || '',
          policeStation: localVil.policeStation || 'Domkal',
          pincode: localVil.pinCode || '',
          areaType: localVil.areaType,
          blockOrMunicipality: localVil.blockOrMunicipality || '',
          gpOrWard: localVil.wardNumber || ''
        });
      }

      if (!matches.length) {
        setStatus(`No exact village match for "${raw}". Select manually below.`, false);
        hideSuggestions();
        return;
      }
      if (matches.length === 1) {
        await applyVillageLookupMatch(matches[0]);
      } else if (quickSuggestionsEl) {
        quickSuggestionsEl.innerHTML = matches.slice(0, 8).map((m, i) => `
          <button type="button" data-idx="${i}" style="display:flex; justify-content:space-between; width:100%; text-align:left; border:0; border-bottom:1px solid var(--border-subtle); background:transparent; padding:0.4rem 0.6rem; cursor:pointer; font-size:0.78rem;">
            <span><strong>${esc(m.village)}</strong>${m.postOffice ? ` · P.O. ${esc(m.postOffice)}` : ''}${m.policeStation ? ` · P.S. ${esc(m.policeStation)}` : ''}</span>
            <span class="font-mono" style="color:var(--blue-600); font-weight:700;">${esc(m.pincode || m.district)}</span>
          </button>
        `).join('');
        quickSuggestionsEl.style.display = 'block';
        quickSuggestionsEl.querySelectorAll('button[data-idx]').forEach(btn => {
          btn.addEventListener('click', () => {
            const m = matches[Number(btn.getAttribute('data-idx'))];
            if (m) applyVillageLookupMatch(m);
          });
        });
      }
    } catch {
      hideSuggestions();
    }
  };

  let lastAutoLookedUpPin = initial.pinCode || '';
  let _villageLookupTimer = null;
  if (quickPinBtn) quickPinBtn.addEventListener('click', runQuickLocationLookup);
  if (quickPinInput) {
    quickPinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        lastAutoLookedUpPin = '';
        runQuickLocationLookup();
      }
    });
    quickPinInput.addEventListener('input', () => {
      const raw = String(quickPinInput.value || '').trim();
      if (/^\d+$/.test(raw)) {
        const clean = raw.slice(0, 6);
        if (clean.length === 6 && clean !== lastAutoLookedUpPin) {
          lastAutoLookedUpPin = clean;
          runQuickLocationLookup();
        }
        return;
      }
      if (_villageLookupTimer) clearTimeout(_villageLookupTimer);
      if (raw.length >= 3) {
        _villageLookupTimer = setTimeout(runQuickLocationLookup, 220);
      } else {
        hideSuggestions();
      }
    });
    if (initial.pinCode) quickPinInput.value = initial.pinCode;
  }

  const getAreaType = () => {
    const r = document.querySelector(`input[name="${prefix}-areatype"]:checked`);
    return r ? r.value : 'RURAL';
  };

  async function syncMurshidabadTier(overrideTier = null) {
    const dist = readFieldValue(prefix, 'district');
    if (!tierEl) return;
    if (!dist || dist.trim().toLowerCase() !== 'murshidabad') {
      tierEl.style.display = 'none';
      return;
    }
    tierEl.style.display = 'grid';
    const areaType = getAreaType();

    if (areaType === 'URBAN') {
      if (subWrap) subWrap.style.display = 'none';
      if (blockMunLabel) blockMunLabel.textContent = 'Municipality';
      if (gpWardLabel) gpWardLabel.textContent = 'Ward (01-21)';
      if (villageLabel) villageLabel.textContent = '3. Locality / Para';
    } else {
      if (subWrap) subWrap.style.display = 'block';
      if (blockMunLabel) blockMunLabel.textContent = 'Block (CD Block)';
      if (gpWardLabel) gpWardLabel.textContent = 'Gram Panchayat';
      if (villageLabel) villageLabel.textContent = '3. Village / Mouza';
    }

    const sub = overrideTier?.subdivision ?? ((subEl ? subEl.value : '') || pendingTierValues.subdivision || '');
    const blk = overrideTier?.blockOrMunicipality ?? ((blockMunEl ? blockMunEl.value : '') || pendingTierValues.blockOrMunicipality || '');
    const gp = overrideTier?.gpOrWard ?? ((gpWardEl ? gpWardEl.value : '') || pendingTierValues.gpOrWard || '');

    if (areaType === 'URBAN') {
      // Live Single Source of Truth from Ward Master + Localities API
      const activeWards = getMasterWards({ includeInactive: false });
      const resolvedWard = gp ? resolveWardForApp({ wardId: gp, wardNumber: gp, gpOrWard: gp }) : null;
      const selectedWardLabel = resolvedWard ? resolvedWard.wardNumber : gp;

      let apiLocalities = [];
      let apiMunicipalities = ['Domkal Municipality'];
      try {
        const qs = new URLSearchParams({ areaType: 'URBAN', municipalityLgd: '273007' });
        if (selectedWardLabel) qs.set('wardCode', selectedWardLabel);
        const data = await fetchJsonCached(`/api/locations/murshidabad/hierarchy?${qs.toString()}`);
        if (data?.success) {
          if (Array.isArray(data.municipalities) && data.municipalities.length > 0) {
            apiMunicipalities = data.municipalities.map(m => m.name);
          }
          if (Array.isArray(data.localities)) {
            apiLocalities = data.localities;
          }
        }
      } catch {
        // Non-blocking: local Ward Master still populates 100%
      }

      if (blockMunEl) {
        populateSelect(blockMunEl, apiMunicipalities, {
          placeholder: '-- Select Municipality --',
          selectedValue: blk || 'Domkal Municipality',
          allowCustom: true
        });
      }

      const wardOptions = activeWards.length > 0
        ? activeWards.map(w => w.wardNumber)
        : Array.from({ length: 21 }, (_, idx) => `Ward ${String(idx + 1).padStart(2, '0')}`);

      if (gpWardEl) {
        populateSelect(gpWardEl, wardOptions, {
          placeholder: `-- Select Ward (${wardOptions.length}) --`,
          selectedValue: selectedWardLabel,
          allowCustom: true
        });
      }

      const masterVillages = resolvedWard
        ? getMasterVillagesByWard(resolvedWard.wardId, { includeInactive: false })
        : getAllMasterVillages({ includeInactive: false });

      const mergedLocalityMap = new Map();
      const wardById = new Map(activeWards.map(w => [w.wardId, w]));

      masterVillages.forEach(mv => {
        const pw = wardById.get(mv.wardId);
        const wNum = pw?.wardNumber || resolvedWard?.wardNumber || '';
        mergedLocalityMap.set(`${mv.name.trim().toLowerCase()}|${wNum.toLowerCase()}`, {
          name: mv.name,
          postOffice: mv.postOffice || 'Domkal',
          policeStation: mv.policeStation || pw?.policeStation || 'Domkal',
          pinCode: mv.pinCode || '742303',
          gpOrWard: wNum,
          blockOrMunicipality: pw?.municipalityName || 'Domkal Municipality'
        });
      });

      apiLocalities.forEach(l => {
        const locName = String(l.correctedEnglishName || l.originalSpelling || '').trim();
        if (!locName) return;
        const wCode = String(l.wardCode || selectedWardLabel || '').trim();
        const wObj = wCode ? resolveWardForApp({ gpOrWard: wCode }) : null;
        const normWard = wObj?.wardNumber || wCode;
        if (resolvedWard && normWard && normWard.toLowerCase() !== resolvedWard.wardNumber.toLowerCase()) return;
        const k = `${locName.toLowerCase()}|${normWard.toLowerCase()}`;
        if (!mergedLocalityMap.has(k)) {
          mergedLocalityMap.set(k, {
            name: locName,
            postOffice: l.postOffice || 'Domkal',
            policeStation: 'Domkal',
            pinCode: l.pinCode || '',
            gpOrWard: normWard,
            blockOrMunicipality: 'Domkal Municipality'
          });
        }
      });

      const localityEntries = Array.from(mergedLocalityMap.values());
      localityEntries.forEach(item => {
        msdRecordMap.set(item.name.trim().toLowerCase(), {
          pinCode: item.pinCode || '',
          postOffice: item.postOffice || 'Domkal',
          policeStation: item.policeStation || 'Domkal',
          gpOrWard: item.gpOrWard || selectedWardLabel,
          blockOrMunicipality: item.blockOrMunicipality || 'Domkal Municipality'
        });
      });

      const localityNames = Array.from(new Set(localityEntries.map(x => x.name))).sort((a, b) => a.localeCompare(b));
      const curLoc = overrideTier?.village ?? readFieldValue(prefix, 'village');
      const matchedLoc = populateSelect(vilEl, localityNames, {
        placeholder: `-- Select Locality (${localityNames.length}) --`,
        selectedValue: curLoc,
        allowCustom: true,
        customLabel: '+ Other / Custom Locality / Para'
      });
      toggleCustomInput(prefix, 'village', matchedLoc === CUSTOM_SENTINEL, matchedLoc === CUSTOM_SENTINEL ? curLoc : '');

      const lInfo = matchedLoc && matchedLoc !== CUSTOM_SENTINEL
        ? (localityEntries.find(x => x.name.toLowerCase() === matchedLoc.toLowerCase()) || msdRecordMap.get(matchedLoc.toLowerCase()))
        : null;
      const wardDefaults = resolvedWard ? resolveMasterLocationByWard(resolvedWard.wardId) : null;

      if (lInfo) {
        await loadPostOffices(
          overrideTier?.postOffice || lInfo.postOffice,
          overrideTier?.policeStation || lInfo.policeStation || 'Domkal',
          overrideTier?.pinCode || lInfo.pinCode
        );
      } else if (wardDefaults) {
        await loadPostOffices(
          overrideTier?.postOffice || wardDefaults.defaultPostOffice,
          overrideTier?.policeStation || wardDefaults.policeStation,
          overrideTier?.pinCode || wardDefaults.defaultPinCode
        );
      }
      pendingTierValues = { subdivision: '', blockOrMunicipality: '', gpOrWard: '' };
      return;
    }

    try {
      const qs = new URLSearchParams({ areaType: 'RURAL' });
      if (sub) qs.set('subdivision', sub);
      if (blk) qs.set('block', blk);
      if (gp) qs.set('gp', gp);

      const data = await fetchJsonCached(`/api/locations/murshidabad/hierarchy?${qs.toString()}`);
      if (!data.success) return;

      if (subEl) {
        populateSelect(subEl, (data.subdivisions || []).map(s => s.name), {
          placeholder: 'All Subdivisions',
          selectedValue: sub
        });
      }
      if (blockMunEl) {
        populateSelect(blockMunEl, (data.blocks || []).map(b => b.name), {
          placeholder: '-- Select Block (26) --',
          selectedValue: blk,
          allowCustom: true
        });
      }
      if (gpWardEl) {
        populateSelect(gpWardEl, (data.gramPanchayats || []).map(g => g.name), {
          placeholder: `-- Select Gram Panchayat (${(data.gramPanchayats || []).length}) --`,
          selectedValue: gp,
          allowCustom: true
        });
      }
      if (Array.isArray(data.villages) && data.villages.length > 0) {
        data.villages.forEach(v => {
          if (v?.name) {
            msdRecordMap.set(v.name.trim().toLowerCase(), {
              pinCode: v.pinCode || '',
              postOffice: v.postOffice || '',
              policeStation: v.policeStation || '',
              gpOrWard: v.gpName || '',
              blockOrMunicipality: v.blockName || ''
            });
          }
        });
        if (blk || gp) {
          const curVil = overrideTier?.village ?? readFieldValue(prefix, 'village');
          const matchedVil = populateSelect(vilEl, data.villages.map(v => v.name), {
            placeholder: `-- Select Village (${data.villages.length}) --`,
            selectedValue: curVil,
            allowCustom: true,
            customLabel: '+ Other / Custom Village / Location'
          });
          toggleCustomInput(prefix, 'village', matchedVil === CUSTOM_SENTINEL, matchedVil === CUSTOM_SENTINEL ? curVil : '');
          const mInfo = matchedVil && matchedVil !== CUSTOM_SENTINEL ? msdRecordMap.get(matchedVil.toLowerCase()) : null;
          if (mInfo) {
            await loadPostOffices(
              overrideTier?.postOffice || mInfo.postOffice,
              overrideTier?.policeStation || mInfo.policeStation,
              overrideTier?.pinCode || mInfo.pinCode
            );
          }
        }
      }
      pendingTierValues = { subdivision: '', blockOrMunicipality: '', gpOrWard: '' };
    } catch {
      // non-blocking
    }
  }

  document.querySelectorAll(`input[name="${prefix}-areatype"]`).forEach(radio => {
    radio.addEventListener('change', async () => {
      if (gpWardEl) gpWardEl.value = '';
      if (blockMunEl) blockMunEl.value = '';
      await syncMurshidabadTier();
      emitChange();
    });
  });

  if (subEl) subEl.addEventListener('change', async () => { await syncMurshidabadTier(); emitChange(); });
  if (blockMunEl) blockMunEl.addEventListener('change', async () => { await syncMurshidabadTier(); emitChange(); });
  if (gpWardEl) gpWardEl.addEventListener('change', async () => {
    if (getAreaType() === 'URBAN' && gpWardEl.value) {
      const wardMeta = resolveMasterLocationByWard(gpWardEl.value);
      if (wardMeta) {
        await syncMurshidabadTier({
          blockOrMunicipality: wardMeta.blockOrMunicipality,
          gpOrWard: wardMeta.wardNumber,
          village: wardMeta.villages.some(v => v.name.toLowerCase() === readFieldValue(prefix, 'village').toLowerCase())
            ? readFieldValue(prefix, 'village')
            : '',
          postOffice: wardMeta.defaultPostOffice,
          policeStation: wardMeta.policeStation,
          pinCode: wardMeta.defaultPinCode
        });
        emitChange();
        return;
      }
    }
    await syncMurshidabadTier();
    emitChange();
  });

  const applySelection = async (patch = {}) => {
    const nextArea = detectAreaTypeFromData(patch, getAreaType());
    setAreaTypeRadio(nextArea);
    pendingTierValues = {
      subdivision: patch.subdivision || '',
      blockOrMunicipality: patch.blockOrMunicipality || (nextArea === 'URBAN' ? 'Domkal Municipality' : ''),
      gpOrWard: patch.gpOrWard || patch.wardNumber || ''
    };
    const nextState = patch.state || readFieldValue(prefix, 'state') || 'West Bengal';
    const nextDist = patch.district || readFieldValue(prefix, 'district') || 'Murshidabad';
    if (quickPinInput && patch.pinCode) {
      lastAutoLookedUpPin = String(patch.pinCode).replace(/[^0-9]/g, '').slice(0, 6);
      quickPinInput.value = lastAutoLookedUpPin;
    }
    await loadStates({
      state: nextState,
      district: nextDist,
      village: patch.village !== undefined ? patch.village : readFieldValue(prefix, 'village'),
      postOffice: patch.postOffice !== undefined ? patch.postOffice : readFieldValue(prefix, 'post'),
      policeStation: patch.policeStation !== undefined ? patch.policeStation : readFieldValue(prefix, 'police'),
      pinCode: patch.pinCode !== undefined ? patch.pinCode : readFieldValue(prefix, 'pin')
    });
    await syncMurshidabadTier({
      subdivision: pendingTierValues.subdivision,
      blockOrMunicipality: pendingTierValues.blockOrMunicipality,
      gpOrWard: pendingTierValues.gpOrWard,
      village: patch.village,
      postOffice: patch.postOffice,
      policeStation: patch.policeStation,
      pinCode: patch.pinCode
    });
    emitChange();
  };

  cascadeRegistry.set(prefix, { applySelection });

  await loadStates(initial);
  await syncMurshidabadTier();
  updateFullAddressPreview();
}
