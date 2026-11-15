/**
 * wardVillageMaster.js
 * Dynamic Ward & Village / Locality Master Service & Layered Quick-Action UI
 * MUN COMPUTER – ANNAPURNA YOJANA MANAGEMENT SYSTEM
 */

import { KEYS, getItem, setItem, getAuthHeaders } from './storage.js';
import { getCurrentUser, handleSessionInvalidationResponse } from './auth.js';

export const INITIAL_DOMKAL_WARD_VILLAGES = [
  {
    wardNo: 1,
    wardNumber: 'Ward 01',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Abu Bakkar Para',
      'Bartamanabad',
      'Bartamanabad Purbapara',
      'Chowdhury Para',
      'Fakirabad Paschimpara',
      'Fakirabad Purbapara',
      'Jitpur Paschimpara',
      'Jitpur Purbapara',
      'Sarkar Para'
    ]
  },
  {
    wardNo: 2,
    wardNumber: 'Ward 02',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Madhya Para',
      'Majhi Para',
      'Natun Para',
      'Paschim Para',
      'Purba Para',
      'Siro Para',
      'Tiktiki Para'
    ]
  },
  {
    wardNo: 3,
    wardNumber: 'Ward 03',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Baghajhara',
      'Gangadas Para',
      'Islam Tulu*',
      'Mondal Para',
      'Nude Nagar*',
      'Sahaji Para',
      'Sarkar Para'
    ]
  },
  {
    wardNo: 4,
    wardNumber: 'Ward 04',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Bajitpur Bhim Para',
      'Bajitpur Maher Para',
      'Bajitpur Sanyal Para',
      'Mahabub Nagar',
      'Ramna Sekh Para',
      'Shambhunagar'
    ]
  },
  {
    wardNo: 5,
    wardNumber: 'Ward 05',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Bartamanabad Masjid Para',
      'Bartamanabad Biswas Para',
      'Bartamanabad Hai Para',
      'Bartamanabad Madhya Para',
      'Bartamanabad Mondal Para',
      'Bartamanabad',
      'Jhabir Para',
      'Maula Para'
    ]
  },
  {
    wardNo: 6,
    wardNumber: 'Ward 06',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Biswas Para',
      'Daki Para',
      'Jarip Para',
      'Jali Para',
      'Molla Para',
      'Putatan Para*',
      'Resma Bibi',
      'Sowa Para'
    ]
  },
  {
    wardNo: 7,
    wardNumber: 'Ward 07',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Kalibari',
      'Kulbon Jar*',
      'Kulbona',
      'Manik Nagar',
      'Ramnagar',
      'Shambhunagar'
    ]
  },
  {
    wardNo: 8,
    wardNumber: 'Ward 08',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Babu Para',
      'Captain Para',
      'Dari Para',
      'Das Para',
      'Gangadas Para',
      'Malitha*',
      'Maitha Para*'
    ]
  },
  {
    wardNo: 9,
    wardNumber: 'Ward 09',
    postOffice: 'Garabaria',
    pinCode: '742303',
    villages: [
      'Ramnagar Satbariya',
      'Hetanpur',
      'Masimpur',
      'Velurchak'
    ]
  },
  {
    wardNo: 10,
    wardNumber: 'Ward 10',
    postOffice: 'Azimganjgola',
    pinCode: '742303',
    villages: [
      'Domkal Kuthi Sabaria',
      'Domkal Kuthi',
      'Domkal Mahisha Para',
      'Domkal Muslim Para',
      'Khutistabaria'
    ]
  },
  {
    wardNo: 11,
    wardNumber: 'Ward 11',
    postOffice: 'Azimganjgola',
    pinCode: '742303',
    villages: [
      'Dafadar Para',
      'Jayrampur*',
      'Khan Saheb Para',
      'Natun Para'
    ]
  },
  {
    wardNo: 12,
    wardNumber: 'Ward 12',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Azimganjgola',
      'Bajar Para',
      'Kamalat Barnagar*',
      'Kamnath Barnagar*',
      'Karigar Para',
      'Mutta Para',
      'Power House Para',
      'Ramnayat Barnagar'
    ]
  },
  {
    wardNo: 13,
    wardNumber: 'Ward 13',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Bablabona Sahi Para',
      'Farka Para',
      'Ghat Para',
      'Macher Para',
      'Masjid Para',
      'Mechef Para*',
      'Mola Para',
      'Saha Para'
    ]
  },
  {
    wardNo: 14,
    wardNumber: 'Ward 14',
    postOffice: 'Basantpur (Murshidabad)',
    pinCode: '742406',
    villages: [
      'Bhatsala',
      'Gobindapur'
    ]
  },
  {
    wardNo: 15,
    wardNumber: 'Ward 15',
    postOffice: 'Juginda',
    pinCode: '742406',
    villages: [
      'Paschim Shikal Para',
      'Paschim Para'
    ]
  },
  {
    wardNo: 16,
    wardNumber: 'Ward 16',
    postOffice: 'Juginda',
    pinCode: '742406',
    villages: [
      'Chak Bhikhari',
      'Dakshin Para',
      'Dakshin Nagar',
      'Mamud Para',
      'Mamudpur',
      'Uttar Para'
    ]
  },
  {
    wardNo: 17,
    wardNumber: 'Ward 17',
    postOffice: 'Juginda',
    pinCode: '742406',
    villages: [
      'Basantapur Sekhpara',
      'Basgudutt Para*',
      'Bhatsala Duttapur Para*',
      'Bhatsala Dutta Para',
      'Bhatsala Rathi Para',
      'Biswas Para',
      'Dutta Para',
      'Ramna Etbarnagar*',
      'Sekh Para'
    ]
  },
  {
    wardNo: 18,
    wardNumber: 'Ward 18',
    postOffice: 'Juginda',
    pinCode: '742406',
    villages: [
      'Jhaubaria',
      'Juginda Kamarpara',
      'Juginda Malopara',
      'Mahidhupur*'
    ]
  },
  {
    wardNo: 19,
    wardNumber: 'Ward 19',
    postOffice: 'Basantpur (Murshidabad)',
    pinCode: '742406',
    villages: [
      'Biswas Para',
      'Hasanpur',
      'Kalupur',
      'Malitya Para',
      'Rahta Para*'
    ]
  },
  {
    wardNo: 20,
    wardNumber: 'Ward 20',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Aminabad',
      'Biswas Para',
      'Dakshin Sekh Para',
      'Purba Para'
    ]
  },
  {
    wardNo: 21,
    wardNumber: 'Ward 21',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Ambarpur',
      'Chak Ambarpur',
      'Piplapuri'
    ]
  }
];

function escapeHtmlSafe(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildLocalWardMasterSeeds() {
  const nowIso = new Date().toISOString();
  const wards = [];
  const villages = [];
  for (const g of INITIAL_DOMKAL_WARD_VILLAGES) {
    const pad2 = String(g.wardNo).padStart(2, '0');
    const wardId = `WRD-${pad2}`;
    wards.push({
      wardId,
      wardNo: g.wardNo,
      wardNumber: g.wardNumber,
      wardName: g.wardNumber,
      wardCode: `WARD ${pad2}`,
      areaType: 'URBAN',
      municipalityName: 'Domkal Municipality',
      policeStation: 'Domkal',
      district: 'Murshidabad',
      state: 'West Bengal',
      isActive: true,
      isDeleted: false,
      isDefault: true,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    g.villages.forEach((vName, idx) => {
      villages.push({
        id: `WRDVIL-${pad2}-${String(idx + 1).padStart(2, '0')}`,
        wardId,
        name: vName,
        areaType: 'URBAN',
        postOffice: g.postOffice,
        policeStation: 'Domkal',
        district: 'Murshidabad',
        state: 'West Bengal',
        pinCode: g.pinCode,
        isActive: true,
        isDeleted: false,
        isDefault: true,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    });
  }
  return { wards, villages };
}

export function isWardMasterAdmin(user = null) {
  const cur = user || getCurrentUser();
  if (!cur) return false;
  return String(cur.role || '').toUpperCase() === 'ADMIN' || cur.isSuperAdmin === true;
}

export function getWardMasterStore() {
  const raw = getItem(KEYS.WARD_VILLAGE_MASTER, null);
  if (raw && Array.isArray(raw.wards) && raw.wards.length > 0 && Array.isArray(raw.villages)) {
    return raw;
  }
  const seeded = buildLocalWardMasterSeeds();
  setItem(KEYS.WARD_VILLAGE_MASTER, seeded);
  return seeded;
}

export function setWardMasterStore(master) {
  if (!master || !Array.isArray(master.wards) || !Array.isArray(master.villages)) return;
  setItem(KEYS.WARD_VILLAGE_MASTER, {
    wards: master.wards,
    villages: master.villages,
    syncedAt: new Date().toISOString()
  });
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('mun-location-master-updated'));
    }
  } catch {
    // Non-blocking
  }
}

export function getMasterWards({ includeInactive = false } = {}) {
  const store = getWardMasterStore();
  return (store.wards || [])
    .filter(w => !w.isDeleted && (includeInactive || w.isActive !== false))
    .slice()
    .sort((a, b) => (Number(a.wardNo) || 0) - (Number(b.wardNo) || 0) || String(a.wardNumber || '').localeCompare(String(b.wardNumber || '')));
}

export function getMasterWardById(wardId) {
  if (!wardId) return null;
  const store = getWardMasterStore();
  return (store.wards || []).find(w => w.wardId === wardId && !w.isDeleted) || null;
}

export function getMasterVillagesByWard(wardId, { includeInactive = false } = {}) {
  if (!wardId) return [];
  const store = getWardMasterStore();
  return (store.villages || [])
    .filter(v => !v.isDeleted && v.wardId === wardId && (includeInactive || v.isActive !== false))
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

export function getAllMasterVillages({ includeInactive = false } = {}) {
  const store = getWardMasterStore();
  const activeWardIds = new Set(getMasterWards({ includeInactive }).map(w => w.wardId));
  return (store.villages || [])
    .filter(v => !v.isDeleted && activeWardIds.has(v.wardId) && (includeInactive || v.isActive !== false))
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

export function resolveWardForApp(app) {
  if (!app) return null;
  const store = getWardMasterStore();
  const wards = (store.wards || []).filter(w => !w.isDeleted);
  if (app.wardId) {
    const byId = wards.find(w => w.wardId === app.wardId);
    if (byId) return byId;
  }
  const candidates = [app.wardNumber, app.wardName, app.gpOrWard]
    .map(v => String(v || '').trim())
    .filter(Boolean);
  for (const cand of candidates) {
    const low = cand.toLowerCase();
    const exact = wards.find(
      w => String(w.wardNumber || '').toLowerCase() === low ||
        String(w.wardName || '').toLowerCase() === low ||
        String(w.wardCode || '').toLowerCase() === low
    );
    if (exact) return exact;
    const m = cand.match(/\d+/);
    if (m && /ward/i.test(cand)) {
      const n = parseInt(m[0], 10);
      const byNum = wards.find(w => Number(w.wardNo) === n);
      if (byNum) return byNum;
    }
  }
  return null;
}

export function formatWardLabel(ward) {
  if (!ward) return '';
  if (!ward.wardName || String(ward.wardName).trim().toLowerCase() === String(ward.wardNumber || '').trim().toLowerCase()) {
    return ward.wardNumber || ward.wardName || '';
  }
  return `${ward.wardNumber} — ${ward.wardName}`;
}

export function resolveMasterLocationByWard(wardIdOrNumber, { includeInactive = true } = {}) {
  if (!wardIdOrNumber) return null;
  const ward = resolveWardForApp({ wardId: wardIdOrNumber, wardNumber: wardIdOrNumber, gpOrWard: wardIdOrNumber });
  if (!ward) return null;
  const villages = getMasterVillagesByWard(ward.wardId, { includeInactive });
  const postOffices = Array.from(new Set(villages.map(v => String(v.postOffice || '').trim()).filter(Boolean)));
  const pinCodes = Array.from(new Set(villages.map(v => String(v.pinCode || '').replace(/[^0-9]/g, '')).filter(p => p.length === 6)));
  const fallbackPo = Number(ward.wardNo) >= 14 && Number(ward.wardNo) <= 19
    ? (Number(ward.wardNo) === 14 || Number(ward.wardNo) === 19 ? 'Basantpur (Murshidabad)' : 'Juginda')
    : 'Domkal';
  const fallbackPin = Number(ward.wardNo) >= 14 && Number(ward.wardNo) <= 19 ? '742406' : '742303';
  const defaultPostOffice = postOffices[0] || fallbackPo;
  const defaultPinCode = pinCodes[0] || fallbackPin;
  return {
    wardId: ward.wardId,
    wardNo: ward.wardNo,
    wardNumber: ward.wardNumber,
    wardName: ward.wardName || ward.wardNumber,
    wardCode: ward.wardCode || `WARD ${String(ward.wardNo).padStart(2, '0')}`,
    areaType: ward.areaType || 'URBAN',
    municipalityName: ward.municipalityName || 'Domkal Municipality',
    blockOrMunicipality: ward.municipalityName || 'Domkal Municipality',
    gpOrWard: ward.wardNumber,
    policeStation: ward.policeStation || 'Domkal',
    district: ward.district || 'Murshidabad',
    state: ward.state || 'West Bengal',
    postOffices: postOffices.length ? postOffices : [defaultPostOffice],
    pinCodes: pinCodes.length ? pinCodes : [defaultPinCode],
    defaultPostOffice,
    defaultPinCode,
    defaultVillage: villages[0]?.name || '',
    villages
  };
}

export function resolveMasterLocationByVillage(villageName, wardHint = '', { includeInactive = true } = {}) {
  const cleanName = String(villageName || '').trim().toLowerCase();
  if (!cleanName) return null;
  const store = getWardMasterStore();
  const wards = (store.wards || []).filter(w => !w.isDeleted && (includeInactive || w.isActive !== false));
  const wardById = new Map(wards.map(w => [w.wardId, w]));
  const hintWard = wardHint ? resolveWardForApp({ wardId: wardHint, wardNumber: wardHint, gpOrWard: wardHint }) : null;

  const candidates = (store.villages || []).filter(v =>
    !v.isDeleted &&
    (includeInactive || v.isActive !== false) &&
    wardById.has(v.wardId) &&
    String(v.name || '').trim().toLowerCase() === cleanName
  );
  if (candidates.length === 0) return null;

  const chosen = (hintWard && candidates.find(c => c.wardId === hintWard.wardId)) || candidates[0];
  const ward = wardById.get(chosen.wardId);
  const wardMeta = resolveMasterLocationByWard(ward.wardId, { includeInactive });
  return {
    wardId: ward.wardId,
    wardNo: ward.wardNo,
    wardNumber: ward.wardNumber,
    wardName: ward.wardName || ward.wardNumber,
    wardCode: ward.wardCode || wardMeta?.wardCode || '',
    areaType: chosen.areaType || ward.areaType || 'URBAN',
    municipalityName: ward.municipalityName || 'Domkal Municipality',
    blockOrMunicipality: ward.municipalityName || 'Domkal Municipality',
    gpOrWard: ward.wardNumber,
    villageId: chosen.id,
    village: chosen.name,
    postOffice: chosen.postOffice || wardMeta?.defaultPostOffice || 'Domkal',
    policeStation: chosen.policeStation || ward.policeStation || 'Domkal',
    district: chosen.district || ward.district || 'Murshidabad',
    state: chosen.state || ward.state || 'West Bengal',
    pinCode: chosen.pinCode || wardMeta?.defaultPinCode || '742303'
  };
}

export function resolveMasterLocationsByPin(pinCode, { includeInactive = false } = {}) {
  const cleanPin = String(pinCode || '').replace(/[^0-9]/g, '').slice(0, 6);
  if (cleanPin.length !== 6) return null;
  const store = getWardMasterStore();
  const wards = getMasterWards({ includeInactive });
  const wardById = new Map(wards.map(w => [w.wardId, w]));
  const matchedVillages = (store.villages || []).filter(v =>
    !v.isDeleted &&
    (includeInactive || v.isActive !== false) &&
    wardById.has(v.wardId) &&
    String(v.pinCode || '').replace(/[^0-9]/g, '') === cleanPin
  );
  if (matchedVillages.length === 0) return null;

  const wardIds = Array.from(new Set(matchedVillages.map(v => v.wardId)));
  const matchedWards = wardIds.map(id => wardById.get(id)).filter(Boolean);
  const postOffices = Array.from(new Set(matchedVillages.map(v => String(v.postOffice || '').trim()).filter(Boolean)));
  const policeStations = Array.from(new Set(matchedVillages.map(v => String(v.policeStation || 'Domkal').trim()).filter(Boolean)));

  return {
    pinCode: cleanPin,
    areaType: 'URBAN',
    state: 'West Bengal',
    district: 'Murshidabad',
    blockOrMunicipality: 'Domkal Municipality',
    wards: matchedWards,
    villages: matchedVillages,
    postOffices,
    policeStations
  };
}

export function getUnifiedMasterFilterLists() {
  const activeWards = getMasterWards({ includeInactive: false });
  const activeVillages = getAllMasterVillages({ includeInactive: false });
  const customers = getItem(KEYS.CUSTOMERS, []);
  const annapurnaApps = getItem(KEYS.ANNAPURNA_APPLICATIONS, []);

  const wardNumbers = activeWards.map(w => w.wardNumber).filter(Boolean);
  const villageSet = new Set(['Mamudpur', ...activeVillages.map(v => v.name).filter(Boolean)]);
  const poSet = new Set(['Juginda', 'Domkal', 'Basantpur (Murshidabad)', ...activeVillages.map(v => v.postOffice).filter(Boolean)]);
  const psSet = new Set(['Domkal', ...activeWards.map(w => w.policeStation).filter(Boolean)]);
  const pinSet = new Set(['742406', '742303', ...activeVillages.map(v => v.pinCode).filter(p => /^\d{6}$/.test(String(p || '')))]);

  [...(Array.isArray(customers) ? customers : []), ...(Array.isArray(annapurnaApps) ? annapurnaApps : [])].forEach(rec => {
    if (rec?.village) villageSet.add(String(rec.village).trim());
    if (rec?.postOffice) poSet.add(String(rec.postOffice).trim());
    if (rec?.policeStation) psSet.add(String(rec.policeStation).trim());
    if (/^\d{6}$/.test(String(rec?.pinCode || '').trim())) pinSet.add(String(rec.pinCode).trim());
  });

  return {
    wards: activeWards,
    wardNumbers,
    villages: Array.from(villageSet).sort((a, b) => a.localeCompare(b)),
    postOffices: Array.from(poSet).sort((a, b) => a.localeCompare(b)),
    policeStations: Array.from(psSet).sort((a, b) => a.localeCompare(b)),
    pinCodes: Array.from(pinSet).sort()
  };
}

export async function syncWardVillageMasterFromServer() {
  try {
    const res = await fetch('/api/locations/ward-master?includeInactive=true', {
      headers: getAuthHeaders()
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.success && Array.isArray(data.wards) && Array.isArray(data.villages)) {
      setWardMasterStore({ wards: data.wards, villages: data.villages });
      return data;
    }
  } catch {
    // Non-blocking fallback to local cache
  }
  return null;
}

async function callWardApi(url, method, body = null) {
  try {
    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401) {
      handleSessionInvalidationResponse(res);
    }
    const data = await res.json().catch(() => ({}));
    if (data?.master) {
      setWardMasterStore(data.master);
    } else if (res.ok && data?.success) {
      await syncWardVillageMasterFromServer();
    }
    return { status: res.status, ok: res.ok, ...data };
  } catch (err) {
    return { status: 0, ok: false, success: false, message: err?.message || 'Network error while updating master.' };
  }
}

export const addMasterWardApi = (payload) => callWardApi('/api/locations/ward-master/wards', 'POST', payload);
export const editMasterWardApi = (wardId, payload) => callWardApi(`/api/locations/ward-master/wards/${encodeURIComponent(wardId)}`, 'PUT', payload);
export const deleteMasterWardApi = (wardId, payload = {}) => callWardApi(`/api/locations/ward-master/wards/${encodeURIComponent(wardId)}`, 'DELETE', payload);

export const addMasterVillageApi = (payload) => callWardApi('/api/locations/ward-master/villages', 'POST', payload);
export const editMasterVillageApi = (id, payload) => callWardApi(`/api/locations/ward-master/villages/${encodeURIComponent(id)}`, 'PUT', payload);
export const deleteMasterVillageApi = (id) => callWardApi(`/api/locations/ward-master/villages/${encodeURIComponent(id)}`, 'DELETE');

/* =========================================================================
   DEPENDENT DROPDOWN HELPERS (FIELD 1: WARD NO -> FIELD 2: VILLAGE / PARA)
   ========================================================================= */

export function populateAnnapurnaWardDropdown(selectId = 'anp-ward-select', selectedWardId = '', historicalWardLabel = '') {
  const sel = document.getElementById(selectId);
  if (!sel) return '';
  const activeWards = getMasterWards({ includeInactive: false });
  const allWards = getMasterWards({ includeInactive: true });

  let html = `<option value="">--- Select Ward No. ---</option>`;
  const listedIds = new Set();
  activeWards.forEach(w => {
    listedIds.add(w.wardId);
    html += `<option value="${escapeHtmlSafe(w.wardId)}" ${selectedWardId === w.wardId ? 'selected' : ''}>${escapeHtmlSafe(formatWardLabel(w))}</option>`;
  });

  // Historical preservation if existing application references an inactive/legacy Ward
  let resolvedValue = selectedWardId && listedIds.has(selectedWardId) ? selectedWardId : '';
  if (selectedWardId && !listedIds.has(selectedWardId)) {
    const inactiveMatch = allWards.find(w => w.wardId === selectedWardId);
    if (inactiveMatch) {
      html += `<option value="${escapeHtmlSafe(inactiveMatch.wardId)}" selected>${escapeHtmlSafe(formatWardLabel(inactiveMatch))} (Inactive / Historical)</option>`;
      resolvedValue = inactiveMatch.wardId;
    } else if (historicalWardLabel) {
      html += `<option value="__HIST_WARD__" selected>${escapeHtmlSafe(historicalWardLabel)} (Historical Snapshot)</option>`;
      resolvedValue = '__HIST_WARD__';
    }
  } else if (!selectedWardId && historicalWardLabel) {
    html += `<option value="__HIST_WARD__" selected>${escapeHtmlSafe(historicalWardLabel)} (Historical Snapshot)</option>`;
    resolvedValue = '__HIST_WARD__';
  }

  sel.innerHTML = html;
  sel.value = resolvedValue;
  return resolvedValue;
}

export function populateAnnapurnaVillageDropdown(
  selectId = 'anp-ward-village-select',
  wardId = '',
  selectedVillageName = '',
  historicalVillageName = ''
) {
  const sel = document.getElementById(selectId);
  if (!sel) return '';

  if (!wardId) {
    if (historicalVillageName) {
      sel.innerHTML = `<option value="">--- Select Village / Para ---</option><option value="${escapeHtmlSafe(historicalVillageName)}" selected>${escapeHtmlSafe(historicalVillageName)} (Historical Snapshot)</option>`;
      sel.disabled = false;
      return historicalVillageName;
    }
    sel.innerHTML = `<option value="">--- Select Village / Para ---</option>`;
    sel.value = '';
    sel.disabled = true;
    return '';
  }

  if (wardId === '__HIST_WARD__') {
    const val = selectedVillageName || historicalVillageName || '';
    sel.innerHTML = `<option value="">--- Select Village / Para ---</option>${val ? `<option value="${escapeHtmlSafe(val)}" selected>${escapeHtmlSafe(val)} (Historical Snapshot)</option>` : ''}`;
    sel.disabled = !val;
    return val;
  }

  const activeVillages = getMasterVillagesByWard(wardId, { includeInactive: false });
  let html = `<option value="">--- Select Village / Para ---</option>`;
  let matchedValue = '';
  const targetLower = String(selectedVillageName || '').trim().toLowerCase();

  activeVillages.forEach(v => {
    const isSel = targetLower && String(v.name || '').trim().toLowerCase() === targetLower;
    if (isSel) matchedValue = v.name;
    html += `<option value="${escapeHtmlSafe(v.name)}" data-village-id="${escapeHtmlSafe(v.id)}" ${isSel ? 'selected' : ''}>${escapeHtmlSafe(v.name)}</option>`;
  });

  // Preserve historical value on edit if village was deactivated or deleted later
  const fallbackName = selectedVillageName || historicalVillageName;
  if (fallbackName && !matchedValue) {
    html += `<option value="${escapeHtmlSafe(fallbackName)}" selected>${escapeHtmlSafe(fallbackName)} (Historical / Inactive)</option>`;
    matchedValue = fallbackName;
  }

  sel.innerHTML = html;
  sel.disabled = false;
  sel.value = matchedValue;
  return matchedValue;
}

/* =========================================================================
   LAYERED QUICK-ACTION SUB-MODAL (DOES NOT WIPE OPEN APPLICATION FORM!)
   ========================================================================= */

export function closeQuickLocationSubModal() {
  const el = document.getElementById('anp-location-quick-modal');
  if (el) el.remove();
}

function renderSubModalShell(title, bodyHtml) {
  closeQuickLocationSubModal();
  const overlay = document.createElement('div');
  overlay.id = 'anp-location-quick-modal';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:12000; background:rgba(15,23,42,0.58); display:flex; align-items:center; justify-content:center; padding:1rem;';
  overlay.innerHTML = `
    <div style="background:var(--surface, #ffffff); color:var(--text-main, #0f172a); width:100%; max-width:460px; border-radius:var(--radius-lg, 10px); border:1px solid var(--border-subtle, #e2e8f0); box-shadow:0 20px 50px rgba(0,0,0,0.32); overflow:hidden;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:0.85rem 1rem; border-bottom:1px solid var(--border-subtle, #e2e8f0); background:var(--surface-alt, #f8fafc);">
        <strong style="font-size:0.95rem;">${escapeHtmlSafe(title)}</strong>
        <button type="button" id="anp-qm-close" class="btn btn-secondary btn-sm" style="padding:0.15rem 0.45rem;">✕</button>
      </div>
      <div style="padding:1rem;">
        ${bodyHtml}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) closeQuickLocationSubModal();
  });
  document.getElementById('anp-qm-close')?.addEventListener('click', closeQuickLocationSubModal);
}

export function openQuickWardActionModal({
  mode = 'add',
  wardId = '',
  onCompleted = null,
  showToast = null
} = {}) {
  if (!isWardMasterAdmin()) {
    showToast?.('Only authorized Administration users can manage Wards.', 'warning');
    return;
  }

  const ward = wardId ? getMasterWardById(wardId) : null;
  if (mode !== 'add' && !ward) {
    showToast?.('Select a valid Ward first.', 'warning');
    return;
  }

  if (mode === 'delete') {
    const otherWards = getMasterWards({ includeInactive: true }).filter(w => w.wardId !== ward.wardId);
    const linked = getMasterVillagesByWard(ward.wardId, { includeInactive: true });
    renderSubModalShell(`Delete ${ward.wardNumber}`, `
      <div style="font-size:0.82rem; margin-bottom:0.85rem;">
        <strong>${escapeHtmlSafe(formatWardLabel(ward))}</strong> has <strong>${linked.length}</strong> linked village / locality record(s).
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem;">
          Existing historical Annapurna applications retain their saved Ward &amp; Village snapshot values.
        </div>
      </div>
      ${linked.length > 0 ? `
        <div class="form-group">
          <label class="form-label">Handling Linked Villages</label>
          <select id="anp-qm-del-strategy" class="form-control">
            <option value="block">Block if active villages exist (recommended check)</option>
            <option value="reassign">Reassign all villages to another Ward</option>
            <option value="cascade">Deactivate / remove linked villages too</option>
          </select>
        </div>
        <div id="anp-qm-reassign-wrap" class="form-group" style="display:none;">
          <label class="form-label">Target Ward for Reassignment</label>
          <select id="anp-qm-reassign-ward" class="form-control">
            ${otherWards.map(w => `<option value="${escapeHtmlSafe(w.wardId)}">${escapeHtmlSafe(formatWardLabel(w))}</option>`).join('')}
          </select>
        </div>
      ` : ''}
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
        <button type="button" id="anp-qm-cancel" class="btn btn-secondary">Cancel</button>
        <button type="button" id="anp-qm-confirm-del" class="btn btn-danger">Confirm Delete Ward</button>
      </div>
    `);
    document.getElementById('anp-qm-cancel')?.addEventListener('click', closeQuickLocationSubModal);
    const stratEl = document.getElementById('anp-qm-del-strategy');
    const reassignWrap = document.getElementById('anp-qm-reassign-wrap');
    stratEl?.addEventListener('change', () => {
      if (reassignWrap) reassignWrap.style.display = stratEl.value === 'reassign' ? 'block' : 'none';
    });
    document.getElementById('anp-qm-confirm-del')?.addEventListener('click', async () => {
      const strat = stratEl ? stratEl.value : 'block';
      const payload = strat === 'reassign'
        ? { reassignToWardId: document.getElementById('anp-qm-reassign-ward')?.value }
        : strat === 'cascade'
          ? { forceCascadeDeactivate: true }
          : {};
      const res = await deleteMasterWardApi(ward.wardId, payload);
      if (!res.success) {
        showToast?.(res.message || 'Could not delete Ward.', 'warning');
        return;
      }
      closeQuickLocationSubModal();
      showToast?.(res.message, 'success');
      onCompleted?.({ action: 'delete', wardId: '' });
    });
    return;
  }

  const nextNum = (() => {
    const maxNo = getMasterWards({ includeInactive: true }).reduce((mx, w) => Math.max(mx, Number(w.wardNo) || 0), 0);
    return maxNo + 1;
  })();

  renderSubModalShell(mode === 'edit' ? `Edit ${ward.wardNumber}` : 'Add New Ward', `
    <form id="anp-qm-ward-form">
      <div class="form-group">
        <label class="form-label">Ward Number <span class="req">*</span></label>
        <input type="text" id="anp-qm-ward-num" class="form-control" required value="${escapeHtmlSafe(ward ? ward.wardNumber : `Ward ${String(nextNum).padStart(2, '0')}`)}" placeholder="e.g. Ward 22">
      </div>
      <div class="form-group">
        <label class="form-label">Ward Name / Label <span class="req">*</span></label>
        <input type="text" id="anp-qm-ward-name" class="form-control" required value="${escapeHtmlSafe(ward ? ward.wardName : `Ward ${String(nextNum).padStart(2, '0')}`)}" placeholder="e.g. Ward 22 or Station Para Ward">
      </div>
      ${mode === 'edit' ? `
        <div class="form-group">
          <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; cursor:pointer;">
            <input type="checkbox" id="anp-qm-ward-active" ${ward.isActive !== false ? 'checked' : ''}> Active in Application Form Dropdowns
          </label>
        </div>
      ` : ''}
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
        <button type="button" id="anp-qm-cancel" class="btn btn-secondary">Cancel</button>
        <button type="submit" class="btn btn-primary">${mode === 'edit' ? 'Save Ward Changes' : 'Add Ward'}</button>
      </div>
    </form>
  `);
  document.getElementById('anp-qm-cancel')?.addEventListener('click', closeQuickLocationSubModal);
  document.getElementById('anp-qm-ward-form')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const wardNumber = document.getElementById('anp-qm-ward-num')?.value?.trim();
    const wardName = document.getElementById('anp-qm-ward-name')?.value?.trim();
    const isActive = mode === 'edit' ? Boolean(document.getElementById('anp-qm-ward-active')?.checked) : true;
    const res = mode === 'edit'
      ? await editMasterWardApi(ward.wardId, { wardNumber, wardName, isActive })
      : await addMasterWardApi({ wardNumber, wardName });
    if (!res.success) {
      showToast?.(res.message || 'Failed to save Ward.', 'warning');
      return;
    }
    closeQuickLocationSubModal();
    showToast?.(res.message, 'success');
    onCompleted?.({ action: mode, wardId: res.ward?.wardId || ward?.wardId || '', ward: res.ward });
  });
}

export function openQuickVillageActionModal({
  mode = 'add',
  wardId = '',
  villageId = '',
  villageName = '',
  onCompleted = null,
  showToast = null
} = {}) {
  if (!isWardMasterAdmin()) {
    showToast?.('Only authorized Administration users can manage Villages / Localities.', 'warning');
    return;
  }

  const ward = wardId ? getMasterWardById(wardId) : null;
  if (!ward && mode !== 'edit') {
    showToast?.('Please select a Ward first.', 'warning');
    return;
  }

  const store = getWardMasterStore();
  let village = villageId
    ? (store.villages || []).find(v => v.id === villageId && !v.isDeleted)
    : null;
  if (!village && villageName && wardId) {
    village = (store.villages || []).find(
      v => !v.isDeleted && v.wardId === wardId && String(v.name || '').trim().toLowerCase() === String(villageName).trim().toLowerCase()
    );
  }

  if (mode !== 'add' && !village) {
    showToast?.('Select a valid Village / Para first.', 'warning');
    return;
  }

  if (mode === 'delete') {
    const parentWard = getMasterWardById(village.wardId);
    renderSubModalShell('Delete Village / Locality', `
      <div style="font-size:0.83rem; margin-bottom:1rem;">
        Are you sure you want to remove <strong>${escapeHtmlSafe(village.name)}</strong> from <strong>${escapeHtmlSafe(parentWard?.wardNumber || village.wardId)}</strong>?
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem;">
          Old saved Annapurna applications using "${escapeHtmlSafe(village.name)}" will remain untouched.
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
        <button type="button" id="anp-qm-cancel" class="btn btn-secondary">Cancel</button>
        <button type="button" id="anp-qm-confirm-del" class="btn btn-danger">Confirm Delete Village</button>
      </div>
    `);
    document.getElementById('anp-qm-cancel')?.addEventListener('click', closeQuickLocationSubModal);
    document.getElementById('anp-qm-confirm-del')?.addEventListener('click', async () => {
      const res = await deleteMasterVillageApi(village.id);
      if (!res.success) {
        showToast?.(res.message || 'Unable to delete village.', 'warning');
        return;
      }
      closeQuickLocationSubModal();
      showToast?.(res.message, 'success');
      onCompleted?.({ action: 'delete', wardId: village.wardId, villageName: '' });
    });
    return;
  }

  const allWards = getMasterWards({ includeInactive: true });
  const targetWard = ward || getMasterWardById(village.wardId);

  renderSubModalShell(mode === 'edit' ? `Edit Village — ${village.name}` : `Add Village to ${targetWard.wardNumber}`, `
    <form id="anp-qm-vil-form">
      <div class="form-group">
        <label class="form-label">Assigned Ward <span class="req">*</span></label>
        <select id="anp-qm-vil-ward" class="form-control" required ${mode === 'add' ? '' : ''}>
          ${allWards.map(w => `<option value="${escapeHtmlSafe(w.wardId)}" ${(village ? village.wardId : targetWard.wardId) === w.wardId ? 'selected' : ''}>${escapeHtmlSafe(formatWardLabel(w))}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Village / Locality / Para Name <span class="req">*</span></label>
        <input type="text" id="anp-qm-vil-name" class="form-control" required value="${escapeHtmlSafe(village ? village.name : '')}" placeholder="e.g. Mamudpur / Sarkar Para">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Post Office (Optional)</label>
          <input type="text" id="anp-qm-vil-po" class="form-control" value="${escapeHtmlSafe(village ? (village.postOffice || 'Domkal') : 'Domkal')}" placeholder="Domkal / Juginda">
        </div>
        <div class="form-group">
          <label class="form-label">PIN Code (Optional)</label>
          <input type="text" id="anp-qm-vil-pin" class="form-control font-mono" maxlength="6" value="${escapeHtmlSafe(village ? (village.pinCode || '742303') : '742303')}" placeholder="742303">
        </div>
      </div>
      ${mode === 'edit' ? `
        <div class="form-group">
          <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; cursor:pointer;">
            <input type="checkbox" id="anp-qm-vil-active" ${village.isActive !== false ? 'checked' : ''}> Active in Application Form Dropdowns
          </label>
        </div>
      ` : ''}
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
        <button type="button" id="anp-qm-cancel" class="btn btn-secondary">Cancel</button>
        <button type="submit" class="btn btn-primary">${mode === 'edit' ? 'Save Village Changes' : 'Add Village / Para'}</button>
      </div>
    </form>
  `);
  document.getElementById('anp-qm-cancel')?.addEventListener('click', closeQuickLocationSubModal);
  document.getElementById('anp-qm-vil-form')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const chosenWardId = document.getElementById('anp-qm-vil-ward')?.value;
    const name = document.getElementById('anp-qm-vil-name')?.value?.trim();
    const postOffice = document.getElementById('anp-qm-vil-po')?.value?.trim();
    const pinCode = document.getElementById('anp-qm-vil-pin')?.value?.replace(/[^0-9]/g, '').slice(0, 6);
    const isActive = mode === 'edit' ? Boolean(document.getElementById('anp-qm-vil-active')?.checked) : true;

    const res = mode === 'edit'
      ? await editMasterVillageApi(village.id, { name, targetWardId: chosenWardId, postOffice, pinCode, isActive })
      : await addMasterVillageApi({ wardId: chosenWardId, name, postOffice, pinCode });

    if (!res.success) {
      showToast?.(res.message || 'Unable to save Village / Para.', 'warning');
      return;
    }
    closeQuickLocationSubModal();
    showToast?.(res.message, 'success');
    onCompleted?.({
      action: mode,
      wardId: chosenWardId,
      villageName: res.village?.name || name,
      village: res.village
    });
  });
}
