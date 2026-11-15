/**
 * authCoordinator.js - Multi-Tab Authentication, Single-Flight Refresh & Device Identity Coordinator
 * MUN COMPUTER CORPORATE ERP SYSTEM
 *
 * Responsibilities:
 * 1. Persistent per-browser Device Identity (DEV-<uuid>) for Global 3-Device Registration Policy
 * 2. Cross-tab Single-Flight Access Token Refresh via Web Locks API + localStorage lease fallback
 * 3. Monotonic token versioning so older responses never clobber newer valid tokens
 * 4. Transparent window.fetch interceptor for same-origin /api/* calls (retries once after refresh on 401)
 * 5. Same-device multi-tab logout synchronization & shared activity timestamp (BroadcastChannel + storage)
 */

export const AUTH_STORAGE_KEYS = {
  SESSION_TOKEN: 'MUN_COMPUTER_SESSION_TOKEN',
  CSRF_TOKEN: 'MUN_COMPUTER_CSRF_TOKEN',
  AUTH_META: 'MUN_COMPUTER_AUTH_META',
  DEVICE_ID: 'MUN_COMPUTER_DEVICE_ID',
  LAST_ACTIVITY: 'MUN_LAST_ACTIVITY_AT',
  LOGOUT_EVENT: 'MUN_LOGOUT_EVENT',
  REFRESH_LEASE: 'MUN_REFRESH_LOCK_LEASE',
  USER_PRIMARY: 'MUN_COMPUTER_ERP_v1_current_user',
  USER_V3: 'mun_computer_v3_user',
  USER_LEGACY: 'mun_current_user'
};

const TERMINAL_AUTH_ERROR_CODES = new Set([
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'DEVICE_REVOKED',
  'DEVICE_PENDING_APPROVAL',
  'REFRESH_INVALID',
  'ACCOUNT_INACTIVE'
]);

const TAB_INSTANCE_ID = `TAB-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
const AUTH_CHANNEL_NAME = 'mun_erp_auth_channel';

let _rawFetch = typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
let _fetchIntercepted = false;
let _inFlightRefreshPromise = null;
let _authChannel = null;
let _lastSharedActivityWriteAt = 0;
let _lastKnownActivityAt = Date.now();
let _lastHandledLogoutNonce = '';
let _listenersInstalled = false;

function generateUuidV4() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function detectFriendlyDeviceInfo() {
  if (typeof navigator === 'undefined') {
    return { deviceName: 'Web Workstation', platform: 'Web' };
  }
  const ua = navigator.userAgent || '';
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  let os = navigator.platform || 'Workstation';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return {
    deviceName: `${browser} on ${os}`,
    platform: os
  };
}

export function getOrCreateDeviceIdentity() {
  const info = detectFriendlyDeviceInfo();
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { deviceId: 'DEV-SERVER', deviceName: info.deviceName, platform: info.platform };
  }
  let deviceId = '';
  try {
    deviceId = String(localStorage.getItem(AUTH_STORAGE_KEYS.DEVICE_ID) || '').trim();
    if (!deviceId || deviceId.length < 8) {
      deviceId = `DEV-${generateUuidV4()}`;
      localStorage.setItem(AUTH_STORAGE_KEYS.DEVICE_ID, deviceId);
    }
  } catch {
    deviceId = `DEV-${generateUuidV4()}`;
  }
  return {
    deviceId,
    deviceName: info.deviceName,
    platform: info.platform
  };
}

export function getAuthMeta() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.AUTH_META);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function hasStoredUserSession() {
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw =
      localStorage.getItem(AUTH_STORAGE_KEYS.USER_PRIMARY) ||
      localStorage.getItem(AUTH_STORAGE_KEYS.USER_V3) ||
      localStorage.getItem(AUTH_STORAGE_KEYS.USER_LEGACY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && !parsed.isLoggedOut && parsed.uid && (!parsed.status || parsed.status === 'ACTIVE'));
  } catch {
    return false;
  }
}

function getAuthChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel !== 'function') return null;
  if (!_authChannel) {
    try {
      _authChannel = new BroadcastChannel(AUTH_CHANNEL_NAME);
    } catch {
      _authChannel = null;
    }
  }
  return _authChannel;
}

function postAuthChannelMessage(payload) {
  const ch = getAuthChannel();
  if (ch) {
    try {
      ch.postMessage({ ...payload, senderId: TAB_INSTANCE_ID, sentAt: Date.now() });
    } catch {
      // ignore closed channel errors
    }
  }
}

export function commitAuthTokens({
  sessionToken = '',
  csrfToken = '',
  sessionId = '',
  deviceId = '',
  generation = 1,
  expiresAt = '',
  sessionExpiresAt = ''
} = {}) {
  if (typeof localStorage === 'undefined') return false;
  const cur = getAuthMeta();
  const nextGen = Number(generation) || 1;
  const curGen = Number(cur?.generation) || 0;

  // Monotonic token version guard: never overwrite newer generation with older one for the same session
  if (cur && cur.sessionId && sessionId && cur.sessionId === sessionId && nextGen < curGen) {
    return false;
  }

  try {
    if (sessionToken) localStorage.setItem(AUTH_STORAGE_KEYS.SESSION_TOKEN, String(sessionToken));
    if (csrfToken) localStorage.setItem(AUTH_STORAGE_KEYS.CSRF_TOKEN, String(csrfToken));
    const resolvedDeviceId = deviceId || cur?.deviceId || getOrCreateDeviceIdentity().deviceId;
    const metaPayload = {
      sessionId: sessionId || cur?.sessionId || '',
      deviceId: resolvedDeviceId,
      generation: sessionId && cur?.sessionId && cur.sessionId !== sessionId ? nextGen : Math.max(nextGen, curGen || 1),
      expiresAt: expiresAt || cur?.expiresAt || '',
      sessionExpiresAt: sessionExpiresAt || cur?.sessionExpiresAt || '',
      updatedAt: Date.now()
    };
    localStorage.setItem(AUTH_STORAGE_KEYS.AUTH_META, JSON.stringify(metaPayload));

    postAuthChannelMessage({
      type: 'AUTH_TOKEN_UPDATED',
      sessionId: metaPayload.sessionId,
      generation: metaPayload.generation,
      expiresAt: metaPayload.expiresAt
    });
    return true;
  } catch {
    return false;
  }
}

export function commitAuthenticatedUserCache(user) {
  if (!user || typeof localStorage === 'undefined') return;
  const cleanUser = { ...user, isLoggedOut: false };
  const serialized = JSON.stringify(cleanUser);
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.USER_PRIMARY, serialized);
    localStorage.setItem(AUTH_STORAGE_KEYS.USER_V3, serialized);
    localStorage.setItem(AUTH_STORAGE_KEYS.USER_LEGACY, serialized);
  } catch {
    // ignore storage quota errors
  }
}

export function clearLocalAuthStorageOnly() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEYS.SESSION_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.CSRF_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.AUTH_META);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER_PRIMARY);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER_V3);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER_LEGACY);
  } catch {
    // ignore
  }
}

export function broadcastLocalLogout(reason = '') {
  const nonce = `${TAB_INSTANCE_ID}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  _lastHandledLogoutNonce = nonce;
  clearLocalAuthStorageOnly();

  const detail = {
    reason: reason || 'Signed out successfully. Enter your credentials to sign in again.',
    nonce,
    fromSiblingTab: false
  };

  postAuthChannelMessage({ type: 'AUTH_LOGOUT', ...detail });

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEYS.LOGOUT_EVENT, JSON.stringify({ ...detail, at: Date.now() }));
    }
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mun-auth-logout', { detail }));
  }
}

function handleIncomingSiblingLogout(payload) {
  if (!payload || (payload.nonce && payload.nonce === _lastHandledLogoutNonce)) return;
  if (payload.senderId === TAB_INSTANCE_ID) return;
  _lastHandledLogoutNonce = payload.nonce || `EXT-${Date.now()}`;
  clearLocalAuthStorageOnly();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('mun-auth-logout', {
        detail: {
          reason: payload.reason || 'Signed out from another open tab on this device.',
          nonce: _lastHandledLogoutNonce,
          fromSiblingTab: true
        }
      })
    );
  }
}

export function resetSharedActivity() {
  const now = Date.now();
  _lastKnownActivityAt = now;
  _lastSharedActivityWriteAt = now;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEYS.LAST_ACTIVITY, String(now));
    }
  } catch {
    // ignore
  }
  postAuthChannelMessage({ type: 'USER_ACTIVITY', at: now });
  return now;
}

export function touchSharedActivity() {
  const now = Date.now();
  _lastKnownActivityAt = now;
  if (now - _lastSharedActivityWriteAt < 1500) return now;
  _lastSharedActivityWriteAt = now;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEYS.LAST_ACTIVITY, String(now));
    }
  } catch {
    // ignore
  }
  postAuthChannelMessage({ type: 'USER_ACTIVITY', at: now });
  return now;
}

export function getSharedLastActivityAt() {
  let stored = 0;
  try {
    if (typeof localStorage !== 'undefined') {
      stored = Number(localStorage.getItem(AUTH_STORAGE_KEYS.LAST_ACTIVITY) || 0) || 0;
    }
  } catch {
    stored = 0;
  }
  _lastKnownActivityAt = Math.max(_lastKnownActivityAt, stored);
  return _lastKnownActivityAt;
}

export function ensureCrossTabSyncListeners() {
  if (_listenersInstalled || typeof window === 'undefined') return;
  _listenersInstalled = true;

  const ch = getAuthChannel();
  if (ch) {
    ch.addEventListener('message', (ev) => {
      const msg = ev?.data;
      if (!msg || msg.senderId === TAB_INSTANCE_ID) return;
      if (msg.type === 'AUTH_LOGOUT') {
        handleIncomingSiblingLogout(msg);
      } else if (msg.type === 'USER_ACTIVITY' && Number(msg.at)) {
        _lastKnownActivityAt = Math.max(_lastKnownActivityAt, Number(msg.at));
      } else if (msg.type === 'AUTH_TOKEN_UPDATED') {
        touchSharedActivity();
      }
    });
  }

  window.addEventListener('storage', (e) => {
    if (!e || !e.key) return;
    if (e.key === AUTH_STORAGE_KEYS.LOGOUT_EVENT && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        handleIncomingSiblingLogout(parsed);
      } catch {
        handleIncomingSiblingLogout({ nonce: `ST-${Date.now()}` });
      }
    } else if (e.key === AUTH_STORAGE_KEYS.LAST_ACTIVITY && e.newValue) {
      const val = Number(e.newValue) || 0;
      if (val > _lastKnownActivityAt) _lastKnownActivityAt = val;
    }
  });
}

async function runWithCrossTabRefreshLock(deviceId, taskFn) {
  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    return navigator.locks.request(`mun_erp_refresh_lock_${deviceId}`, { mode: 'exclusive' }, taskFn);
  }

  // Fallback cross-tab lease lock via localStorage for browsers without Web Locks API
  const owner = `${TAB_INSTANCE_ID}-${Math.random().toString(36).slice(2, 7)}`;
  const LEASE_MS = 8000;
  const deadline = Date.now() + 10000;
  let acquired = false;

  while (Date.now() < deadline) {
    const now = Date.now();
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_LEASE);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || !parsed.owner || Number(parsed.expiresAt || 0) <= now) {
        localStorage.setItem(
          AUTH_STORAGE_KEYS.REFRESH_LEASE,
          JSON.stringify({ owner, expiresAt: now + LEASE_MS })
        );
        // Re-check immediately after write to minimize contention window
        const verify = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_LEASE) || '{}');
        if (verify.owner === owner) {
          acquired = true;
          break;
        }
      }
    } catch {
      acquired = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 40 + Math.floor(Math.random() * 35)));
  }

  try {
    return await taskFn();
  } finally {
    if (acquired) {
      try {
        const current = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_LEASE) || '{}');
        if (current.owner === owner) {
          localStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_LEASE);
        }
      } catch {
        // ignore
      }
    }
  }
}

export async function refreshAccessTokenSingleFlight({ force = false, failedToken = '' } = {}) {
  if (typeof window === 'undefined') return { ok: false, transient: true };
  if (!_rawFetch && typeof window.fetch === 'function') {
    _rawFetch = window.fetch.bind(window);
  }
  if (!_rawFetch) return { ok: false, transient: true };

  if (_inFlightRefreshPromise) {
    return _inFlightRefreshPromise;
  }

  const { deviceId, deviceName } = getOrCreateDeviceIdentity();
  const genAtStart = Number(getAuthMeta()?.generation || 0);

  _inFlightRefreshPromise = runWithCrossTabRefreshLock(deviceId, async () => {
    const latestMeta = getAuthMeta();
    const latestToken = localStorage.getItem(AUTH_STORAGE_KEYS.SESSION_TOKEN) || '';
    const latestCsrf = localStorage.getItem(AUTH_STORAGE_KEYS.CSRF_TOKEN) || '';
    const expiresAtMs = latestMeta?.expiresAt ? Date.parse(latestMeta.expiresAt) : 0;
    const remainingMs = expiresAtMs ? expiresAtMs - Date.now() : 0;

    // Another tab already rotated the token while we waited on the lock!
    if (latestToken) {
      if (failedToken && latestToken !== failedToken && (!expiresAtMs || remainingMs > 15_000)) {
        return {
          ok: true,
          token: latestToken,
          csrfToken: latestCsrf,
          reusedSiblingRefresh: true
        };
      }
      if (Number(latestMeta?.generation || 0) > genAtStart && (!expiresAtMs || remainingMs > 15_000)) {
        return {
          ok: true,
          token: latestToken,
          csrfToken: latestCsrf,
          reusedSiblingRefresh: true
        };
      }
      if (!force && expiresAtMs && remainingMs > 90_000) {
        return {
          ok: true,
          token: latestToken,
          csrfToken: latestCsrf,
          reusedSiblingRefresh: true
        };
      }
      if (
        force &&
        !failedToken &&
        latestMeta?.updatedAt &&
        Date.now() - Number(latestMeta.updatedAt) < 5000 &&
        remainingMs > 60_000
      ) {
        return {
          ok: true,
          token: latestToken,
          csrfToken: latestCsrf,
          reusedSiblingRefresh: true
        };
      }
    }

    try {
      const resp = await _rawFetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
          'x-device-name': deviceName
        },
        body: JSON.stringify({ deviceId })
      });

      const data = await resp.json().catch(() => ({}));

      if (resp.ok && data?.success && data?.sessionToken) {
        commitAuthTokens({
          sessionToken: data.sessionToken,
          csrfToken: data.csrfToken || latestCsrf,
          sessionId: data.sessionId || latestMeta?.sessionId || '',
          deviceId: data.deviceId || deviceId,
          generation: data.generation || (Number(latestMeta?.generation || 0) + 1),
          expiresAt: data.expiresAt || '',
          sessionExpiresAt: data.sessionExpiresAt || ''
        });
        if (data.user) {
          commitAuthenticatedUserCache(data.user);
        }
        return {
          ok: true,
          token: data.sessionToken,
          csrfToken: data.csrfToken || latestCsrf,
          data
        };
      }

      if (resp.status >= 500 || resp.status === 429) {
        return { ok: false, transient: true, status: resp.status, data };
      }

      const errCode = String(data?.errorCode || '').toUpperCase();
      if (
        resp.status === 401 ||
        resp.status === 403 ||
        TERMINAL_AUTH_ERROR_CODES.has(errCode)
      ) {
        // Double-check if a sibling tab updated the session in the last 3 seconds before terminating
        const postCheckMeta = getAuthMeta();
        const postToken = localStorage.getItem(AUTH_STORAGE_KEYS.SESSION_TOKEN) || '';
        if (
          postToken &&
          postToken !== latestToken &&
          postCheckMeta?.updatedAt &&
          Date.now() - Number(postCheckMeta.updatedAt) < 4000
        ) {
          return {
            ok: true,
            token: postToken,
            csrfToken: localStorage.getItem(AUTH_STORAGE_KEYS.CSRF_TOKEN) || '',
            reusedSiblingRefresh: true
          };
        }

        if (TERMINAL_AUTH_ERROR_CODES.has(errCode) || resp.status === 401) {
          broadcastLocalLogout(
            data?.message || 'Your session expired or was revoked. Please sign in again.'
          );
          return {
            ok: false,
            terminal: true,
            errorCode: errCode || 'REFRESH_INVALID',
            message: data?.message || 'Session expired.'
          };
        }
      }

      return { ok: false, transient: true, status: resp.status, data };
    } catch {
      // Network offline or transient fetch failure: MUST NOT delete valid auth state
      return { ok: false, transient: true };
    }
  }).finally(() => {
    _inFlightRefreshPromise = null;
  });

  return _inFlightRefreshPromise;
}

function resolveSameOriginApiPath(input) {
  if (typeof window === 'undefined') return null;
  try {
    const rawUrl = typeof input === 'string' ? input : input?.url || '';
    if (!rawUrl) return null;
    const parsed = new URL(rawUrl, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    if (!parsed.pathname.startsWith('/api/')) return null;
    return parsed.pathname;
  } catch {
    return null;
  }
}

function isPublicAuthPath(pathname) {
  if (!pathname) return false;
  if (
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/refresh' ||
    pathname === '/api/auth/mfa/verify-login' ||
    pathname === '/api/auth/captcha' ||
    pathname === '/api/auth/id-preview' ||
    pathname === '/api/health'
  ) {
    return true;
  }
  return pathname.startsWith('/api/auth/forgot/');
}

function mergeRequestHeaders(input, initHeaders, extraHeaders) {
  const merged = new Headers();
  if (typeof Request !== 'undefined' && input instanceof Request) {
    input.headers.forEach((v, k) => merged.set(k, v));
  }
  if (initHeaders) {
    new Headers(initHeaders).forEach((v, k) => merged.set(k, v));
  }
  for (const [k, v] of Object.entries(extraHeaders || {})) {
    if (v !== undefined && v !== null && v !== '') {
      merged.set(k, String(v));
    }
  }
  return merged;
}

export function isTerminalAuthErrorCode(errorCode) {
  return TERMINAL_AUTH_ERROR_CODES.has(String(errorCode || '').trim().toUpperCase());
}

export function installAuthFetchInterceptor() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  ensureCrossTabSyncListeners();
  getOrCreateDeviceIdentity();

  if (_fetchIntercepted || window.__munAuthFetchIntercepted) return;
  _rawFetch = window.fetch.bind(window);
  _fetchIntercepted = true;
  window.__munAuthFetchIntercepted = true;

  const interceptedFetch = async function interceptedFetch(input, init = undefined) {
    const pathname = resolveSameOriginApiPath(input);
    if (!pathname) {
      return _rawFetch(input, init);
    }

    const { deviceId, deviceName } = getOrCreateDeviceIdentity();
    const isPublic = isPublicAuthPath(pathname);

    if (isPublic) {
      const publicHeaders = mergeRequestHeaders(input, init?.headers, {
        'x-device-id': deviceId,
        'x-device-name': deviceName
      });
      const nextInit = {
        ...(init || {}),
        credentials: init?.credentials || 'include',
        headers: publicHeaders
      };
      return _rawFetch(input, nextInit);
    }

    // Proactive single-flight refresh if logged in and token missing or expiring within 90s
    const hasUser = hasStoredUserSession();
    const currentTokenBefore = localStorage.getItem(AUTH_STORAGE_KEYS.SESSION_TOKEN) || '';
    const metaBefore = getAuthMeta();
    const expiresAtMs = metaBefore?.expiresAt ? Date.parse(metaBefore.expiresAt) : 0;
    const needsProactiveRefresh =
      hasUser &&
      (!currentTokenBefore || (expiresAtMs > 0 && expiresAtMs - Date.now() < 90_000));

    if (needsProactiveRefresh) {
      await refreshAccessTokenSingleFlight({ force: false });
    }

    const sendWithLatestAuth = () => {
      const latestToken = localStorage.getItem(AUTH_STORAGE_KEYS.SESSION_TOKEN) || '';
      const latestCsrf = localStorage.getItem(AUTH_STORAGE_KEYS.CSRF_TOKEN) || '';
      const authExtras = {
        'x-device-id': deviceId,
        'x-device-name': deviceName
      };
      if (latestToken) authExtras['x-session-token'] = latestToken;
      if (latestCsrf) authExtras['x-csrf-token'] = latestCsrf;

      const mergedHeaders = mergeRequestHeaders(input, init?.headers, authExtras);
      const nextInit = {
        ...(init || {}),
        credentials: init?.credentials || 'include',
        headers: mergedHeaders
      };
      return {
        sentToken: latestToken,
        sentCsrf: latestCsrf,
        promise: _rawFetch(input, nextInit)
      };
    };

    const firstAttempt = sendWithLatestAuth();
    const res = await firstAttempt.promise;

    if (res.status === 401 && pathname !== '/api/auth/logout') {
      const cloned = res.clone();
      const errBody = await cloned.json().catch(() => ({}));
      const errCode = String(errBody?.errorCode || '').toUpperCase();

      if (isTerminalAuthErrorCode(errCode)) {
        broadcastLocalLogout(
          errBody?.message || 'Your session expired or this device was revoked. Please sign in again.'
        );
        return res;
      }

      if (hasStoredUserSession() || firstAttempt.sentToken) {
        const refreshRes = await refreshAccessTokenSingleFlight({
          force: true,
          failedToken: firstAttempt.sentToken
        });
        if (refreshRes.ok && refreshRes.token) {
          const retryAttempt = sendWithLatestAuth();
          return retryAttempt.promise;
        }
      }
      return res;
    }

    if (res.status === 403 && pathname !== '/api/auth/logout') {
      const cloned = res.clone();
      const errBody = await cloned.json().catch(() => ({}));
      const errCode = String(errBody?.errorCode || '').toUpperCase();
      if (errCode === 'DEVICE_REVOKED' || errCode === 'DEVICE_PENDING_APPROVAL') {
        broadcastLocalLogout(
          errBody?.message || 'Access from this device has been revoked by Administration.'
        );
        return res;
      }
      if (errBody?.csrfError === true && (hasStoredUserSession() || firstAttempt.sentToken)) {
        const latestCsrfNow = localStorage.getItem(AUTH_STORAGE_KEYS.CSRF_TOKEN) || '';
        if (latestCsrfNow && latestCsrfNow !== firstAttempt.sentCsrf) {
          return sendWithLatestAuth().promise;
        }
        const refreshRes = await refreshAccessTokenSingleFlight({
          force: true,
          failedToken: firstAttempt.sentToken
        });
        if (refreshRes.ok && refreshRes.token) {
          return sendWithLatestAuth().promise;
        }
      }
    }

    return res;
  };

  let installed = false;
  const ownDesc = Object.getOwnPropertyDescriptor(window, 'fetch');
  const protoDesc = typeof Window !== 'undefined' && Window.prototype ? Object.getOwnPropertyDescriptor(Window.prototype, 'fetch') : null;
  const hasOwnGetterOnly = Boolean(ownDesc && ownDesc.get && !ownDesc.set);
  const hasProtoGetterOnly = Boolean(!ownDesc && protoDesc && protoDesc.get && !protoDesc.set);

  if (!hasOwnGetterOnly && !hasProtoGetterOnly && (!ownDesc || ownDesc.writable)) {
    try {
      window.fetch = interceptedFetch;
      installed = window.fetch === interceptedFetch;
    } catch {
      installed = false;
    }
  }

  if (!installed && (!ownDesc || ownDesc.configurable)) {
    try {
      Object.defineProperty(window, 'fetch', {
        value: interceptedFetch,
        writable: true,
        configurable: true,
        enumerable: true
      });
      installed = window.fetch === interceptedFetch;
    } catch {
      installed = false;
    }
  }

  if (!installed && typeof globalThis !== 'undefined') {
    const gtDesc = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    if (!gtDesc || gtDesc.configurable) {
      try {
        Object.defineProperty(globalThis, 'fetch', {
          value: interceptedFetch,
          writable: true,
          configurable: true,
          enumerable: true
        });
        installed = globalThis.fetch === interceptedFetch;
      } catch {
        installed = false;
      }
    }
  }

  if (!installed) {
    _fetchIntercepted = false;
    window.__munAuthFetchIntercepted = false;
  }
}

if (typeof window !== 'undefined') {
  installAuthFetchInterceptor();
  window.__MUN_AUTH_COORDINATOR__ = {
    getOrCreateDeviceIdentity,
    getAuthMeta,
    commitAuthTokens,
    commitAuthenticatedUserCache,
    clearLocalAuthStorageOnly,
    broadcastLocalLogout,
    refreshAccessTokenSingleFlight,
    installAuthFetchInterceptor,
    resetSharedActivity,
    touchSharedActivity,
    getSharedLastActivityAt,
    isTerminalAuthErrorCode
  };
}
