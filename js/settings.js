/**
 * settings.js - Business Settings, Administration & User Management & SQLite Backup/Restore
 * MUN COMPUTER CORPORATE ERP SYSTEM
 */

import { getItem, setItem, KEYS, exportDatabaseBackup, restoreDatabaseBackup, logAuditAction, getAuthHeaders } from './storage.js';
import { getCurrentUser, isMainAdmin, MAIN_ADMIN_UID, handleSessionInvalidationResponse, setCurrentUser } from './auth.js';

function getActorHeaders() {
  return getAuthHeaders();
}

function isActorAdmin(user = getCurrentUser()) {
  if (!user) return false;
  return isMainAdmin(user) || String(user.role || '').trim().toUpperCase() === 'ADMIN';
}

function isActorManagerOrAdmin(user = getCurrentUser()) {
  if (!user) return false;
  const r = String(user.role || '').trim().toUpperCase();
  return isActorAdmin(user) || r === 'MANAGER';
}

export function getAllUsers() {
  return getItem(KEYS.USERS, []);
}

export function getUserDashboardStats() {
  return window._munUserStats || null;
}

export function getRecentLoginActivity() {
  return window._munRecentLogins || [];
}

export async function fetchIdFormatPreview(role = 'STAFF') {
  try {
    const res = await fetch(`/api/users/id-preview?role=${encodeURIComponent(role)}`, { headers: getActorHeaders() });
    if (res.ok) return await res.json();
  } catch {
    // fallback to public format preview
  }
  try {
    const res = await fetch(`/api/auth/id-preview?role=${encodeURIComponent(role)}`);
    if (res.ok) return await res.json();
  } catch {
    // ignore
  }
  return null;
}

export async function fetchUsersFromBackend(query = '', role = '') {
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (role) params.set('role', role);
    const qs = params.toString();
    const url = qs ? `/api/users?${qs}` : '/api/users';
    const res = await fetch(url, { headers: getActorHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        if (!query && !role) setItem(KEYS.USERS, data.users);
        if (data.stats) window._munUserStats = data.stats;
        if (Array.isArray(data.recentLogins)) window._munRecentLogins = data.recentLogins;
        if (data.idPreview) window._munNextIdPreview = data.idPreview;
        return data.users;
      }
    } else if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      handleSessionInvalidationResponse(res.status, data);
    }
  } catch (err) {
    console.warn('Backend /api/users fetch failed, using local storage:', err);
  }
  return getAllUsers();
}

export async function fetchAuditLogsFromBackend() {
  try {
    const res = await fetch('/api/audit-logs', { headers: getActorHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        return data.logs;
      }
    }
  } catch (err) {
    console.warn('Backend /api/audit-logs fetch failed:', err);
  }
  return getItem(KEYS.AUDIT_LOGS, []);
}

export async function fetchPasswordResetReferences(uid = '') {
  try {
    const url = uid
      ? `/api/auth/forgot/references?uid=${encodeURIComponent(uid)}`
      : '/api/auth/forgot/references';
    const res = await fetch(url, { headers: getActorHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.references)) {
        return data.references;
      }
    }
  } catch (err) {
    console.warn('Backend /api/auth/forgot/references fetch failed:', err);
  }
  return [];
}

export async function saveUser(userData) {
  const actor = getCurrentUser();
  if (!isActorManagerOrAdmin(actor)) {
    return { success: false, message: 'ACCESS DENIED: Only Administration or Manager can create user accounts.' };
  }

  const rawRole = String(userData.role || 'STAFF').trim().toUpperCase();
  const targetRole = rawRole === 'MANAGER' ? 'MANAGER' : 'STAFF';
  if (!isActorAdmin(actor) && targetRole !== 'STAFF') {
    return { success: false, message: 'ACCESS DENIED: Managers can create and manage STAFF accounts only.' };
  }

  try {
    const resp = await fetch('/api/users/create', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify({
        fullName: userData.fullName || userData.name || '',
        name: userData.name || userData.fullName || '',
        username: userData.username || '',
        mobileNumber: userData.mobileNumber || userData.phone || '',
        phone: userData.phone || userData.mobileNumber || '',
        aadhaarNumber: userData.aadhaarNumber || userData.aadhaar || '',
        email: userData.email || '',
        role: targetRole,
        address: userData.address || '',
        status: 'ACTIVE',
        designation: userData.designation || (targetRole === 'MANAGER' ? 'Operations Manager' : 'Front Desk Operator'),
        fatherName: userData.fatherName || '',
        motherName: userData.motherName || '',
        dob: userData.dob || '',
        district: userData.district || 'Murshidabad',
        areaType: userData.areaType || 'RURAL',
        blockOrMunicipality: userData.blockOrMunicipality || '',
        gpOrWard: userData.gpOrWard || '',
        villageOrWard: userData.villageOrWard || '',
        postOffice: userData.postOffice || '',
        policeStation: userData.policeStation || '',
        pinCode: userData.pinCode || '',
        allowDuplicateException: Boolean(userData.allowDuplicateException),
        duplicateExceptionReason: userData.duplicateExceptionReason || ''
      })
    });
    const data = await resp.json();
    handleSessionInvalidationResponse(resp.status, data);
    if (resp.ok && data.success && data.user) {
      await fetchUsersFromBackend();
      logAuditAction('USER_CREATED', `Created ${targetRole} account ${data.uid || data.user.uid} (${data.user.name})`);
      return {
        success: true,
        uid: data.uid || data.user.uid,
        temporaryPassword: data.temporaryPassword,
        user: data.user,
        nextIdPreview: data.nextIdPreview,
        message: data.message
      };
    }
    return { success: false, message: data.message || 'Failed to create user account.' };
  } catch {
    return { success: false, message: 'Server unreachable. User creation requires central backend verification.' };
  }
}

export async function editUser(userData) {
  const actor = getCurrentUser();
  if (!isActorManagerOrAdmin(actor)) {
    return { success: false, message: 'ACCESS DENIED: Only Administration or Manager can edit accounts.' };
  }
  const targetUid = String(userData?.uid || userData?.userId || userData?.requestId || '').trim().toUpperCase();
  if (!isActorAdmin(actor) && targetUid === MAIN_ADMIN_UID) {
    return { success: false, message: `ACCESS DENIED: Main Administration (${MAIN_ADMIN_UID}) is permanently protected.` };
  }

  try {
    const resp = await fetch('/api/users/edit', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify(userData)
    });
    const data = await resp.json();
    handleSessionInvalidationResponse(resp.status, data);
    if (resp.ok && data.success) {
      await fetchUsersFromBackend();
      return { success: true, user: data.user, message: data.message };
    }
    return { success: false, message: data.message || 'Failed to update user.' };
  } catch {
    return { success: false, message: 'Server error while updating user.' };
  }
}

export async function approveUser() {
  return { success: false, message: 'Direct account provisioning is enabled in ADMINISTRATION -> MANAGER / STAFF.' };
}

export async function rejectUser() {
  return { success: false, message: 'Self-registration approval workflow is retired.' };
}

export async function requestUserCorrection() {
  return { success: false, message: 'Self-registration correction workflow is retired.' };
}

export async function toggleUserStatus(uidOrKey, nextStatus = undefined) {
  const actor = getCurrentUser();
  if (!isActorManagerOrAdmin(actor)) {
    return { success: false, message: 'ACCESS DENIED: Only Administration or Manager can update account status.' };
  }

  const targetUid = String(uidOrKey || '').trim().toUpperCase();
  if (targetUid === MAIN_ADMIN_UID) {
    return { success: false, message: `Permanent Main Administration account ${MAIN_ADMIN_UID} cannot be deactivated or suspended.` };
  }

  try {
    const resp = await fetch('/api/users/toggle-status', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify({ uid: targetUid, requestId: targetUid, status: nextStatus })
    });
    const data = await resp.json();
    handleSessionInvalidationResponse(resp.status, data);
    if (resp.ok && data.success) {
      await fetchUsersFromBackend();
      logAuditAction('USER_STATUS_CHANGE', `Changed status for ${targetUid} to ${data.status}`);
      return { success: true, message: data.message, status: data.status, user: data.user };
    }
    return { success: false, message: data.message || 'Status update failed.' };
  } catch {
    return { success: false, message: 'Server error updating status.' };
  }
}

export async function resetUserPassword(uid) {
  const actor = getCurrentUser();
  if (!isActorManagerOrAdmin(actor)) {
    return { success: false, message: 'ACCESS DENIED: Only Administration or Manager can reset passwords.' };
  }

  const targetUid = String(uid || '').trim().toUpperCase();
  if (targetUid === MAIN_ADMIN_UID && !isMainAdmin(actor)) {
    return { success: false, message: `ACCESS DENIED: Cannot reset Main Administration (${MAIN_ADMIN_UID}) password.` };
  }

  try {
    const resp = await fetch('/api/users/reset-password', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify({ uid: targetUid })
    });
    const data = await resp.json();
    handleSessionInvalidationResponse(resp.status, data);
    if (resp.ok && data.success) {
      await fetchUsersFromBackend();
      logAuditAction('ADMIN_PASSWORD_RESET', `Generated a new one-time temporary password for ${targetUid}.`);
      return { success: true, temporaryPassword: data.temporaryPassword, uid: data.uid, message: data.message };
    }
    return { success: false, message: data.message || 'Password reset failed.' };
  } catch {
    return { success: false, message: 'Server error resetting password.' };
  }
}

export function deleteUser(id) {
  if (!isActorAdmin()) {
    return { success: false, message: 'Only Administration can remove accounts.' };
  }
  const clean = String(id || '').trim().toUpperCase();
  if (clean === MAIN_ADMIN_UID) {
    return { success: false, message: `Cannot delete permanent Main Administration account ${MAIN_ADMIN_UID}.` };
  }
  const users = getAllUsers();
  const updated = users.filter(u => String(u.uid || u.id || u.requestId || '').toUpperCase() !== clean);
  setItem(KEYS.USERS, updated);
  logAuditAction('USER_DELETE', `Deleted user account: ${clean}`);
  return { success: true };
}

export async function fetchPermissionsSchema() {
  try {
    const resp = await fetch('/api/permissions/schema', { headers: getActorHeaders() });
    const data = await resp.json();
    if (resp.ok && data.success) return data;
  } catch (err) {
    console.warn('fetchPermissionsSchema error:', err);
  }
  return null;
}

export async function saveUserPermissions(payload) {
  try {
    const resp = await fetch('/api/users/permissions', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    handleSessionInvalidationResponse(resp.status, data);
    if (resp.ok && data.success) {
      await fetchUsersFromBackend();
      const active = getCurrentUser();
      if (active && data.user && (active.uid === data.user.uid || active.id === data.user.uid)) {
        setCurrentUser({ ...active, ...data.user });
      }
      return { success: true, user: data.user, effectivePermissions: data.effectivePermissions, message: data.message };
    }
    return { success: false, message: data.message || 'Failed to update user permissions.' };
  } catch {
    return { success: false, message: 'Server unreachable while saving user permissions.' };
  }
}

export async function deleteUserAccount(uidOrRequestId, reason) {
  try {
    const resp = await fetch('/api/users/delete', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify({ uid: uidOrRequestId, requestId: uidOrRequestId, reason })
    });
    const data = await resp.json();
    handleSessionInvalidationResponse(resp.status, data);
    if (resp.ok && data.success) {
      await fetchUsersFromBackend();
      return { success: true, message: data.message };
    }
    return { success: false, message: data.message || 'Failed to delete user.' };
  } catch {
    return { success: false, message: 'Server unreachable while deleting user.' };
  }
}

export async function fetchDeleteHistory(targetType = '') {
  try {
    const url = targetType
      ? `/api/security/delete-history?targetType=${encodeURIComponent(targetType)}`
      : '/api/security/delete-history';
    const resp = await fetch(url, { headers: getActorHeaders() });
    const data = await resp.json();
    if (resp.ok && data.success) return data.records || data.history || [];
  } catch (err) {
    console.warn('fetchDeleteHistory failed:', err);
  }
  return [];
}

export async function logDeleteHistory(entry) {
  try {
    const resp = await fetch('/api/security/delete-history', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify(entry)
    });
    const data = await resp.json();
    if (resp.ok && data.success) return { success: true, record: data.record };
    return { success: false, message: data.message || 'Delete reason log failed.' };
  } catch {
    return { success: false, message: 'Server unreachable while logging delete reason.' };
  }
}

export async function fetchAutoBackupSnapshots() {
  try {
    const resp = await fetch('/api/backup/snapshots', { headers: getActorHeaders() });
    const data = await resp.json();
    if (resp.ok && data.success) return data.snapshots || [];
  } catch (err) {
    console.warn('fetchAutoBackupSnapshots failed:', err);
  }
  return [];
}

export async function triggerAutoBackupSnapshot() {
  try {
    const resp = await fetch('/api/backup/auto-snapshot', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify({ trigger: 'MANUAL' })
    });
    const data = await resp.json();
    if (resp.ok && data.success) return { success: true, snapshot: data.snapshot, snapshots: data.snapshots || [] };
    return { success: false, message: data.message || 'Snapshot failed.' };
  } catch {
    return { success: false, message: 'Server unreachable while creating backup snapshot.' };
  }
}

export async function fetchSystemSecuritySettings() {
  try {
    const resp = await fetch('/api/system-settings', { headers: getActorHeaders() });
    const data = await resp.json();
    if (resp.ok && data.success) return { success: true, settings: data.settings || {} };
    return { success: false, message: data.message || 'Failed to load system security settings.' };
  } catch {
    return { success: false, message: 'Server unreachable while loading system settings.' };
  }
}

export async function saveSystemSecuritySettings(payload) {
  try {
    const resp = await fetch('/api/system-settings', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify(payload || {})
    });
    const data = await resp.json();
    handleSessionInvalidationResponse(resp.status, data);
    if (resp.ok && data.success) return { success: true, settings: data.settings, message: data.message };
    return { success: false, message: data.message || 'Failed to update security settings.' };
  } catch {
    return { success: false, message: 'Server unreachable while updating security settings.' };
  }
}

export async function fetchDbHealth() {
  try {
    const resp = await fetch('/api/admin/db-health', { headers: getActorHeaders() });
    const data = await resp.json();
    if (resp.ok && data.success) return { success: true, health: data.health };
    return { success: false, message: data.message || 'Failed to load SQLite database health.' };
  } catch {
    return { success: false, message: 'Server unreachable while checking database health.' };
  }
}

export async function createSqliteDbBackup() {
  try {
    const resp = await fetch('/api/admin/db-backup', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify({})
    });
    const data = await resp.json();
    handleSessionInvalidationResponse(resp.status, data);
    if (resp.ok && data.success) return { success: true, backup: data.backup, message: data.message };
    return { success: false, message: data.message || 'SQLite backup failed.' };
  } catch {
    return { success: false, message: 'Server unreachable while creating SQLite backup.' };
  }
}

export async function restoreSqliteDbBackup(fileName) {
  try {
    const resp = await fetch('/api/admin/db-restore', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify({ fileName })
    });
    const data = await resp.json();
    handleSessionInvalidationResponse(resp.status, data);
    if (resp.ok && data.success) return { success: true, message: data.message };
    return { success: false, message: data.message || 'SQLite restore failed.' };
  } catch {
    return { success: false, message: 'Server unreachable while restoring SQLite backup.' };
  }
}

export async function setupMainAdminMfa() {
  try {
    const resp = await fetch('/api/auth/mfa/setup', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify({})
    });
    return await resp.json();
  } catch {
    return { success: false, message: 'Server unreachable while initializing MFA.' };
  }
}

export async function enableMainAdminMfa(totpCode) {
  try {
    const resp = await fetch('/api/auth/mfa/enable', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify({ totpCode })
    });
    const data = await resp.json();
    if (resp.ok && data.success && data.user) {
      const active = getCurrentUser();
      if (active && String(active.uid || '').toUpperCase() === MAIN_ADMIN_UID) {
        setCurrentUser({ ...active, ...data.user });
      }
    }
    return data;
  } catch {
    return { success: false, message: 'Server unreachable while enabling MFA.' };
  }
}

export async function disableMainAdminMfa() {
  try {
    const resp = await fetch('/api/auth/mfa/disable', {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify({})
    });
    const data = await resp.json();
    if (resp.ok && data.success && data.user) {
      const active = getCurrentUser();
      if (active && String(active.uid || '').toUpperCase() === MAIN_ADMIN_UID) {
        setCurrentUser({ ...active, ...data.user });
      }
    }
    return data;
  } catch {
    return { success: false, message: 'Server unreachable while disabling MFA.' };
  }
}

export async function fetchRegisteredDevices() {
  try {
    const resp = await fetch('/api/devices', { headers: getActorHeaders() });
    const data = await resp.json().catch(() => ({}));
    if (resp.status === 401 || resp.status === 403) {
      handleSessionInvalidationResponse(resp.status, data);
    }
    if (resp.ok && data.success) {
      return {
        success: true,
        devices: Array.isArray(data.devices) ? data.devices : [],
        approvedCount: Number(data.approvedCount || 0),
        maxDevices: Number(data.maxDevices || 3)
      };
    }
    return { success: false, message: data.message || 'Failed to load registered devices.', devices: [] };
  } catch {
    return { success: false, message: 'Server unreachable while loading devices.', devices: [] };
  }
}

export async function approveRegisteredDevice(deviceId) {
  try {
    const resp = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/approve`, {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify({})
    });
    const data = await resp.json().catch(() => ({}));
    handleSessionInvalidationResponse(resp.status, data);
    return { ok: resp.ok, ...data };
  } catch {
    return { success: false, message: 'Server unreachable while approving device.' };
  }
}

export async function rejectRegisteredDevice(deviceId) {
  try {
    const resp = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/reject`, {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify({})
    });
    const data = await resp.json().catch(() => ({}));
    handleSessionInvalidationResponse(resp.status, data);
    return { ok: resp.ok, ...data };
  } catch {
    return { success: false, message: 'Server unreachable while rejecting device.' };
  }
}

export async function revokeRegisteredDevice(deviceId) {
  try {
    const resp = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/revoke`, {
      method: 'POST',
      headers: getActorHeaders(),
      body: JSON.stringify({})
    });
    const data = await resp.json().catch(() => ({}));
    handleSessionInvalidationResponse(resp.status, data);
    return { ok: resp.ok, ...data };
  } catch {
    return { success: false, message: 'Server unreachable while revoking device.' };
  }
}

export async function deleteRegisteredDevice(deviceId) {
  try {
    const resp = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
      headers: getActorHeaders()
    });
    const data = await resp.json().catch(() => ({}));
    handleSessionInvalidationResponse(resp.status, data);
    return { ok: resp.ok, ...data };
  } catch {
    return { success: false, message: 'Server unreachable while removing device.' };
  }
}

export function downloadBackupFile() {
  const backupJson = exportDatabaseBackup();
  const blob = new Blob([backupJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MUN_COMPUTER_Business_Manager_Backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

export function restoreFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = restoreDatabaseBackup(e.target.result);
      if (result.success) {
        resolve(result);
      } else {
        reject(new Error(result.error || 'Failed to restore backup'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
