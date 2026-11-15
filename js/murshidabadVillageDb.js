/**
 * murshidabadVillageDb.js - Murshidabad District Village Database Module
 * Structured schema: District, Block/Municipality, GP/Ward, Village/Locality, PIN Code
 * Provides unified CRUD operations backed by /api/locations/villages* and optional Firestore sync.
 */

import { getAuthHeaders } from './storage.js';
import {
  db,
  auth,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  handleFirestoreError,
  OperationType
} from '../src/firebase';

const COLLECTION_NAME = 'murshidabad_villages';

function sanitizeId(rawId) {
  return String(rawId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
}

export function normalizeVillageRecord(raw = {}) {
  return {
    id: String(raw.id || ''),
    areaType: raw.areaType === 'URBAN' ? 'URBAN' : 'RURAL',
    district: String(raw.district || 'Murshidabad').trim() || 'Murshidabad',
    blockOrMunicipality: String(raw.blockOrMunicipality || raw.blockName || 'Domkal').trim(),
    gpOrWard: String(raw.gpOrWard || raw.gpName || raw.wardCode || '').trim(),
    mouzaName: String(raw.mouzaName || '').trim(),
    villageOrLocality: String(raw.villageOrLocality || raw.name || raw.correctedEnglishName || '').trim(),
    name: String(raw.name || raw.villageOrLocality || raw.correctedEnglishName || '').trim(),
    originalSpelling: String(raw.originalSpelling || raw.name || '').trim(),
    postOffice: String(raw.postOffice || '').trim(),
    policeStation: String(raw.policeStation || '').trim(),
    pinCode: String(raw.pinCode || '').replace(/[^0-9]/g, '').slice(0, 6),
    verificationStatus: raw.verificationStatus || 'VERIFIED',
    sourceName: String(raw.sourceName || 'Admin Verified Entry').trim()
  };
}

export function validateVillageInput(input = {}) {
  const district = String(input.district || 'Murshidabad').trim();
  const blockOrMunicipality = String(input.blockOrMunicipality || '').trim();
  const villageOrLocality = String(input.villageOrLocality || input.name || '').trim();
  const pinCode = String(input.pinCode || '').replace(/[^0-9]/g, '').slice(0, 6);

  if (district.length < 2 || district.length > 80) {
    return { valid: false, message: 'District must be between 2 and 80 characters.' };
  }
  if (blockOrMunicipality.length < 2 || blockOrMunicipality.length > 100) {
    return { valid: false, message: 'Block / Municipality must be between 2 and 100 characters.' };
  }
  if (villageOrLocality.length < 1 || villageOrLocality.length > 160) {
    return { valid: false, message: 'Village / Locality name is required (max 160 characters).' };
  }
  if (!/^[0-9]{6}$/.test(pinCode)) {
    return { valid: false, message: 'A valid 6-digit Indian PIN Code is required.' };
  }
  return {
    valid: true,
    clean: {
      district,
      blockOrMunicipality,
      villageOrLocality,
      pinCode
    }
  };
}

async function mirrorCreateToFirestore(record) {
  const user = auth?.currentUser;
  if (!user || !user.emailVerified || !record?.id) return;
  const docId = sanitizeId(record.id);
  const path = `${COLLECTION_NAME}/${docId}`;
  try {
    await setDoc(doc(db, COLLECTION_NAME, docId), {
      villageId: docId,
      district: record.district.slice(0, 80),
      blockOrMunicipality: record.blockOrMunicipality.slice(0, 100),
      ...(record.gpOrWard ? { gpOrWard: record.gpOrWard.slice(0, 100) } : {}),
      villageOrLocality: record.villageOrLocality.slice(0, 160),
      pinCode: record.pinCode,
      ...(record.postOffice ? { postOffice: record.postOffice.slice(0, 100) } : {}),
      ...(record.policeStation ? { policeStation: record.policeStation.slice(0, 100) } : {}),
      areaType: record.areaType === 'URBAN' ? 'URBAN' : 'RURAL',
      verificationStatus: record.verificationStatus || 'VERIFIED',
      ownerId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

async function mirrorUpdateToFirestore(id, record) {
  const user = auth?.currentUser;
  if (!user || !user.emailVerified || !id) return;
  const docId = sanitizeId(id);
  const path = `${COLLECTION_NAME}/${docId}`;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, docId), {
      district: record.district.slice(0, 80),
      blockOrMunicipality: record.blockOrMunicipality.slice(0, 100),
      ...(record.gpOrWard ? { gpOrWard: record.gpOrWard.slice(0, 100) } : {}),
      villageOrLocality: record.villageOrLocality.slice(0, 160),
      pinCode: record.pinCode,
      ...(record.postOffice ? { postOffice: record.postOffice.slice(0, 100) } : {}),
      ...(record.policeStation ? { policeStation: record.policeStation.slice(0, 100) } : {}),
      areaType: record.areaType === 'URBAN' ? 'URBAN' : 'RURAL',
      verificationStatus: record.verificationStatus || 'VERIFIED',
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    if (String(err?.code || '').includes('not-found')) return;
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

async function mirrorDeleteFromFirestore(id) {
  const user = auth?.currentUser;
  if (!user || !user.emailVerified || !id) return;
  const docId = sanitizeId(id);
  const path = `${COLLECTION_NAME}/${docId}`;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, docId));
  } catch (err) {
    if (String(err?.code || '').includes('not-found')) return;
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function getMurshidabadOverview() {
  const resp = await fetch('/api/locations/murshidabad/overview');
  return resp.json();
}

export async function getDomkalWardBreakdown() {
  const resp = await fetch('/api/locations/domkal-wards');
  return resp.json();
}

export async function listMurshidabadVillages(filters = {}) {
  const qs = new URLSearchParams();
  if (filters.areaType) qs.set('areaType', filters.areaType);
  if (filters.blockOrMunicipality) qs.set('blockOrMunicipality', filters.blockOrMunicipality);
  if (filters.gpOrWard) qs.set('gpOrWard', filters.gpOrWard);
  if (filters.pinCode) qs.set('pinCode', filters.pinCode);
  if (filters.q) qs.set('q', filters.q);
  if (filters.status) qs.set('status', filters.status);

  const queryStr = qs.toString();
  const resp = await fetch(`/api/locations/villages/master${queryStr ? `?${queryStr}` : ''}`);
  const data = await resp.json();
  const entries = Array.isArray(data.entries) ? data.entries.map(normalizeVillageRecord) : [];
  return { ...data, entries };
}

export async function createMurshidabadVillage(input = {}) {
  const check = validateVillageInput(input);
  if (!check.valid) {
    return { ok: false, success: false, message: check.message };
  }

  const blockVal = check.clean.blockOrMunicipality;
  const areaType = input.areaType || (blockVal.toLowerCase().includes('municipality') ? 'URBAN' : 'RURAL');
  const payload = {
    areaType,
    district: check.clean.district,
    blockOrMunicipality: blockVal,
    gpOrWard: String(input.gpOrWard || (areaType === 'URBAN' ? 'WARD 01' : blockVal)).trim(),
    name: check.clean.villageOrLocality,
    postOffice: String(input.postOffice || '').trim(),
    policeStation: String(input.policeStation || '').trim(),
    pinCode: check.clean.pinCode,
    verificationStatus: input.verificationStatus || 'VERIFIED'
  };

  const resp = await fetch('/api/locations/villages', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  if (resp.ok && data.success && data.record) {
    const normalized = normalizeVillageRecord({ ...payload, id: data.record.id });
    try {
      await mirrorCreateToFirestore(normalized);
    } catch {
      // Firestore sync errors are logged in handleFirestoreError when Firebase user is active
    }
  }
  return { ok: resp.ok, ...data };
}

export async function autoVerifyMurshidabadVillage(input = {}) {
  const check = validateVillageInput({ ...input, district: input.district || 'Murshidabad' });
  if (!check.valid) {
    return { ok: false, success: false, message: check.message };
  }
  const blockVal = check.clean.blockOrMunicipality;
  const payload = {
    areaType: blockVal.toLowerCase().includes('municipality') ? 'URBAN' : 'RURAL',
    blockOrMunicipality: blockVal,
    gpOrWard: String(input.gpOrWard || '').trim(),
    name: check.clean.villageOrLocality,
    pinCode: check.clean.pinCode
  };
  const resp = await fetch('/api/locations/villages/auto-add', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  if (resp.ok && data.success && data.record) {
    const normalized = normalizeVillageRecord({ ...payload, district: 'Murshidabad', id: data.record.id });
    try {
      await mirrorCreateToFirestore(normalized);
    } catch {
      // logged if active
    }
  }
  return { ok: resp.ok, ...data };
}

export async function updateMurshidabadVillage(id, updates = {}) {
  const check = validateVillageInput({
    district: updates.district || 'Murshidabad',
    blockOrMunicipality: updates.blockOrMunicipality || 'Domkal',
    villageOrLocality: updates.villageOrLocality ?? updates.name,
    pinCode: updates.pinCode
  });
  if (!check.valid) {
    return { ok: false, success: false, message: check.message };
  }

  const payload = {
    district: check.clean.district,
    blockOrMunicipality: check.clean.blockOrMunicipality,
    gpOrWard: String(updates.gpOrWard || '').trim(),
    name: check.clean.villageOrLocality,
    postOffice: String(updates.postOffice || '').trim(),
    policeStation: String(updates.policeStation || '').trim(),
    pinCode: check.clean.pinCode,
    verificationStatus: updates.verificationStatus || 'VERIFIED'
  };

  const resp = await fetch(`/api/locations/villages/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  if (resp.ok && data.success) {
    const normalized = normalizeVillageRecord({ ...payload, id, areaType: updates.areaType });
    try {
      await mirrorUpdateToFirestore(id, normalized);
    } catch {
      // logged if active
    }
  }
  return { ok: resp.ok, ...data };
}

export async function deleteMurshidabadVillage(id) {
  const resp = await fetch(`/api/locations/villages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  const data = await resp.json();
  if (resp.ok && data.success) {
    try {
      await mirrorDeleteFromFirestore(id);
    } catch {
      // logged if active
    }
  }
  return { ok: resp.ok, ...data };
}

export async function verifyMurshidabadVillage(id, areaType, decision = 'APPROVE') {
  const targetType = areaType === 'URBAN' ? 'LOCALITY' : 'RURAL_VILLAGE';
  const resp = await fetch('/api/locations/verify', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ targetType, targetId: id, decision })
  });
  const data = await resp.json();
  return { ok: resp.ok, ...data };
}
