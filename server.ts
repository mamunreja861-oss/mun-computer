import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDataDir, isVercelRuntime } from './server/dataDir.js';
import { locationService } from './server/locationService.js';
import { murshidabadMaster } from './server/murshidabadMaster.js';
import {
  centralDb,
  maskPhone,
  issueAccessToken,
  issueSessionToken,
  verifyAccessTokenDetailed,
  verifySessionToken,
  DEFAULT_ACCESS_TOKEN_TTL_MS,
  generateCaptchaChallenge,
  verifyCaptchaChallenge,
  issueForgotStepToken,
  verifyForgotStepToken,
  issueMfaPendingToken,
  verifyMfaPendingToken,
  getKolkataDateParts,
  generateSecureTempPassword,
  validatePasswordStrength,
  hashSensitive
} from './server/centralDb.js';
import {
  relationalDb,
  MAIN_ADMIN_UID,
  CoreRole,
  CoreAccountStatus,
  ApiUserRecord,
  normalizeCoreRole,
  verifyPasswordHash,
  getKolkataNow
} from './server/relationalDb.js';
import {
  MENU_DEFINITIONS,
  PERMISSION_ACTIONS,
  PermissionAction,
  getDefaultRolePermissions,
  resolveEffectivePermissions,
  hasMenuPermission
} from './server/permissions.js';
import {
  globalReferenceEngine,
  PREFIX_REGISTRY,
  resolveCanonicalPrefix,
  LegacyMigrationInputItem
} from './server/globalReferenceEngine.js';

const __filename = typeof import.meta?.url === 'string' ? fileURLToPath(import.meta.url) : process.cwd();
const __dirname = typeof import.meta?.url === 'string' ? path.dirname(__filename) : process.cwd();

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

const APP_VERSION: string = (() => {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return String(pkg?.version || '1.0.0');
  } catch {
    return '1.0.0';
  }
})();

const REFRESH_COOKIE_NAME = 'mun_refresh_token';

function parseCookies(req: Request): Record<string, string> {
  const raw = String(req.headers.cookie || '');
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const fwd = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return fwd.includes('https');
}

function setRefreshCookie(res: Response, req: Request, token: string, expiresAtIso: string): void {
  const maxAgeSec = Math.max(60, Math.floor((Date.parse(expiresAtIso) - Date.now()) / 1000));
  const attrs = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/api/auth',
    `Max-Age=${maxAgeSec}`,
    isHttpsRequest(req) ? 'SameSite=None; Secure' : 'SameSite=Lax'
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearRefreshCookie(res: Response, req: Request): void {
  const attrs = [
    `${REFRESH_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/api/auth',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    isHttpsRequest(req) ? 'SameSite=None; Secure' : 'SameSite=Lax'
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function extractDeviceMeta(req: Request): { deviceId: string; deviceName: string; platform: string } {
  const deviceId = String(req.headers['x-device-id'] || req.body?.deviceId || '').trim().slice(0, 128);
  const deviceName = String(req.headers['x-device-name'] || req.body?.deviceName || '').trim().slice(0, 120);
  const platform = String(req.body?.platform || req.headers['sec-ch-ua-platform'] || '').replace(/"/g, '').trim().slice(0, 64);
  return { deviceId, deviceName, platform };
}

// Security Headers (compatible with AI Studio iframe preview)
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// 10mb JSON limit for up to 5MB base64 Document Vault uploads
app.use(express.json({ limit: '10mb' }));

// CSRF Validation Middleware on authenticated mutating requests
const CSRF_EXEMPT_PATHS = new Set<string>([
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/mfa/verify-login',
  '/api/auth/logout',
  '/api/auth/forgot/initiate',
  '/api/auth/forgot/verify-otp',
  '/api/auth/forgot/reset-password',
  '/api/locations/custom'
]);

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith('/api/')) return next();
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) return next();
  if (CSRF_EXEMPT_PATHS.has(req.path)) return next();

  const sessionToken = String(req.headers['x-session-token'] || '').trim();
  if (sessionToken) {
    const tokenCheck = verifyAccessTokenDetailed(sessionToken);
    if (!tokenCheck.valid && tokenCheck.expired) {
      return res.status(401).json({
        success: false,
        errorCode: 'ACCESS_TOKEN_EXPIRED',
        message: 'Access token expired. Refreshing session...'
      });
    }
    if (!tokenCheck.valid || !tokenCheck.payload) {
      return res.status(401).json({
        success: false,
        errorCode: 'TOKEN_INVALID',
        message: 'Invalid authentication token.'
      });
    }
    const csrfToken = String(req.headers['x-csrf-token'] || '').trim();
    if (!relationalDb.verifySessionCsrfToken(sessionToken, csrfToken, tokenCheck.payload.sid, tokenCheck.payload.did)) {
      return res.status(403).json({
        success: false,
        csrfError: true,
        errorCode: 'CSRF_INVALID',
        message: 'Security validation failed: Missing or invalid CSRF token. Please refresh or sign in again.'
      });
    }
  }
  next();
});

const DATA_DIR = getDataDir();
const SMS_CONFIG_FILE = path.join(DATA_DIR, 'sms-config.json');
const UPI_SETTINGS_FILE = path.join(DATA_DIR, 'upi-settings.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// IN-MEMORY OTP & RATE LIMITER
// ---------------------------------------------------------------------------
interface OtpRecord {
  phone: string;
  otpHash: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
  maxAttempts: number;
  type: 'REGISTRATION' | 'FORGOT_PASSWORD';
  uid?: string;
  verified?: boolean;
}

const activeOtps = new Map<string, OtpRecord>();
const rateLimiter = new Map<string, { attempts: number; resetAt: number }>();

function checkRateLimit(key: string, maxAttempts = 10, windowMs = 15 * 60 * 1000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimiter.get(key);
  if (!record || now > record.resetAt) {
    rateLimiter.set(key, { attempts: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  if (record.attempts >= maxAttempts) {
    return { allowed: false, remaining: 0 };
  }
  record.attempts += 1;
  return { allowed: true, remaining: maxAttempts - record.attempts };
}

export type UserRecord = ApiUserRecord;

function sanitizeUserForResponse(user: ApiUserRecord, includeAdminFields = true) {
  const effectivePermissions = relationalDb.resolveUserEffectivePermissions(user);
  const isMain = Boolean(user.isMainAdmin || user.uid === MAIN_ADMIN_UID);
  const dailyLimit = isMain ? 0 : Math.max(1, Number(relationalDb.getSetting('daily_password_change_limit') || 5));
  const usedToday = user.dailyPasswordChangeDate === getKolkataDateParts().isoDate ? Number(user.dailyPasswordChangeCount || 0) : 0;

  const base = {
    requestId: user.uid,
    uid: user.uid,
    userId: user.uid,
    username: user.username,
    name: user.fullName,
    fullName: user.fullName,
    role: user.role,
    isMainAdmin: isMain,
    isSuperAdmin: isMain,
    designation: user.designation,
    phoneMasked: user.phoneMasked || maskPhone(user.phone),
    aadhaarMasked: user.aadhaarMasked || '',
    status: user.status,
    approvalStatus: 'APPROVED' as const,
    verificationStatus: 'VERIFIED' as const,
    mustChangePassword: Boolean(user.mustChangePassword),
    mfaEnabled: Boolean(user.mfaEnabled),
    createdBy: user.createdBy || 'SYSTEM',
    registrationDate: user.registrationDate,
    registrationTime: user.registrationTime,
    dailyPasswordChangesUsed: usedToday,
    dailyPasswordChangesRemaining: isMain ? 999999 : Math.max(0, dailyLimit - usedToday),
    dailyPasswordChangeLimit: dailyLimit,
    unlimitedPasswordChanges: isMain,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
    lastLoginPanel: user.lastLoginPanel,
    permissionOverrides: user.permissionOverrides || {},
    extraPermissions: user.extraPermissions || {},
    effectivePermissions
  };

  if (!includeAdminFields) {
    return base;
  }

  return {
    ...base,
    phone: user.phone,
    mobileNumber: user.mobileNumber,
    email: user.email,
    address: user.address,
    fatherName: user.fatherName || '',
    motherName: user.motherName || '',
    dob: user.dob || '',
    district: user.district || '',
    areaType: user.areaType || 'RURAL',
    blockOrMunicipality: user.blockOrMunicipality || '',
    gpOrWard: user.gpOrWard || '',
    villageOrWard: user.villageOrWard || '',
    postOffice: user.postOffice || '',
    policeStation: user.policeStation || '',
    pinCode: user.pinCode || '',
    passwordChangedAt: user.passwordChangedAt || '',
    passwordChangeCount: user.passwordChangeCount || 0,
    passwordHistory: user.passwordHistory || [],
    failedLoginAttempts: user.failedLoginAttempts || 0,
    lockedUntil: user.lockedUntil || null,
    loginCount: user.loginCount || 0,
    approvalHistory: user.approvalHistory || []
  };
}

function loadUsers(): ApiUserRecord[] {
  return relationalDb.listUsers();
}

// ---------------------------------------------------------------------------
// ACTOR VERIFICATION (Session Token against SQLite user_sessions + User Status)
// ---------------------------------------------------------------------------
function resolveActor(
  req: Request,
  requireSignedToken = false
): { ok: boolean; actor?: UserRecord; error?: string; errorCode?: string; code?: number; sessionId?: string; deviceId?: string } {
  const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
  const token = String(req.headers['x-session-token'] || queryToken || '').trim();
  const headerUid = String(req.headers['x-actor-uid'] || req.body?.actorUid || '').trim().toUpperCase();
  const headerDeviceId = String(req.headers['x-device-id'] || '').trim();

  if (requireSignedToken && !token) {
    return { ok: false, code: 401, errorCode: 'AUTH_REQUIRED', error: 'Authentication session token required. Please sign in again.' };
  }

  let targetUid = headerUid;
  let tokenSv: number | undefined;
  let resolvedSid: string | undefined;
  let resolvedDid: string | undefined;
  if (token) {
    const detailed = verifyAccessTokenDetailed(token);
    if (!detailed.valid || !detailed.payload) {
      if (detailed.expired) {
        return { ok: false, code: 401, errorCode: 'ACCESS_TOKEN_EXPIRED', error: 'Access token expired. Please refresh session.' };
      }
      return { ok: false, code: 401, errorCode: 'TOKEN_INVALID', error: 'Session token invalid. Please sign in again.' };
    }
    const verified = detailed.payload;
    if (headerDeviceId && verified.did && headerDeviceId !== verified.did) {
      return { ok: false, code: 403, errorCode: 'DEVICE_REVOKED', error: 'Device mismatch detected. Please sign in again.' };
    }
    const dbSess = relationalDb.validateActiveSessionToken(token, verified.sid, verified.did);
    if (!dbSess.valid) {
      const code = dbSess.errorCode === 'DEVICE_REVOKED' ? 403 : 401;
      return {
        ok: false,
        code,
        errorCode: dbSess.errorCode || 'SESSION_REVOKED',
        error: dbSess.reason || 'Session has been revoked. Please sign in again.'
      };
    }
    targetUid = verified.uid.toUpperCase();
    tokenSv = verified.sv;
    resolvedSid = dbSess.sessionId;
    resolvedDid = dbSess.deviceId || verified.did;
  }

  if (!targetUid) {
    return { ok: false, code: 401, errorCode: 'AUTH_REQUIRED', error: 'Authentication required: Actor User ID missing.' };
  }

  const actor = relationalDb.getUserByUid(targetUid);
  if (!actor) {
    return { ok: false, code: 401, errorCode: 'SESSION_REVOKED', error: 'Invalid actor account.' };
  }
  if (actor.status !== 'ACTIVE') {
    return { ok: false, code: 403, errorCode: 'ACCOUNT_INACTIVE', error: `Account is currently ${actor.status}. Access denied.` };
  }
  if (token && tokenSv !== undefined && tokenSv !== (actor.sessionVersion || 1)) {
    return {
      ok: false,
      code: 401,
      errorCode: 'SESSION_REVOKED',
      error: 'Session invalidated due to password change or administrative action. Please sign in again.'
    };
  }
  if (actor.lockedUntil && Date.parse(actor.lockedUntil) > Date.now()) {
    return { ok: false, code: 429, errorCode: 'ACCOUNT_LOCKED', error: 'Account is temporarily locked due to suspicious attempts.' };
  }
  return { ok: true, actor, sessionId: resolvedSid, deviceId: resolvedDid };
}

function verifyMainAdminActor(req: Request): { ok: boolean; actor?: UserRecord; error?: string; errorCode?: string; code?: number } {
  const resolved = resolveActor(req, true);
  if (!resolved.ok || !resolved.actor) return resolved;
  const actor = resolved.actor;
  if (actor.uid !== MAIN_ADMIN_UID || actor.isMainAdmin !== true) {
    return {
      ok: false,
      code: 403,
      errorCode: 'PERMISSION_DENIED',
      error: `ACCESS DENIED: Exclusive Main Administration (${MAIN_ADMIN_UID}) master control required.`
    };
  }
  return { ok: true, actor };
}

function verifyAdminActor(req: Request): { ok: boolean; actor?: UserRecord; error?: string; errorCode?: string; code?: number } {
  const resolved = resolveActor(req, true);
  if (!resolved.ok || !resolved.actor) return resolved;
  const actor = resolved.actor;
  if (actor.role !== 'ADMIN' && actor.uid !== MAIN_ADMIN_UID && !actor.isMainAdmin) {
    return { ok: false, code: 403, errorCode: 'PERMISSION_DENIED', error: `ACCESS DENIED: Administration role required.` };
  }
  return { ok: true, actor };
}

function verifyManagerOrAdminActor(req: Request): { ok: boolean; actor?: UserRecord; error?: string; errorCode?: string; code?: number } {
  const resolved = resolveActor(req, true);
  if (!resolved.ok || !resolved.actor) return resolved;
  const actor = resolved.actor;
  if (!['ADMIN', 'MANAGER'].includes(actor.role) && actor.uid !== MAIN_ADMIN_UID && !actor.isMainAdmin) {
    return { ok: false, code: 403, errorCode: 'PERMISSION_DENIED', error: `ACCESS DENIED: Manager or Administration role required.` };
  }
  return { ok: true, actor };
}

function verifyMenuPermission(
  req: Request,
  menuId: string,
  action: PermissionAction = 'view'
): { ok: boolean; actor?: UserRecord; error?: string; code?: number } {
  const resolved = resolveActor(req);
  if (!resolved.ok || !resolved.actor) return resolved;
  const actor = resolved.actor;
  if (!hasMenuPermission(actor, menuId, action)) {
    relationalDb.logAudit(
      'PERMISSION_DENIED',
      `Blocked ${actor.uid} (${actor.role}) from '${menuId}.${action}' on ${req.method} ${req.path}`,
      actor.uid,
      undefined,
      { menuId, action, path: req.path },
      req.ip
    );
    return {
      ok: false,
      code: 403,
      error: `ACCESS DENIED: Your account lacks '${action}' permission for '${menuId}'.`
    };
  }
  return { ok: true, actor };
}

// ---------------------------------------------------------------------------
// SMS GATEWAY CONFIGURATION
// ---------------------------------------------------------------------------
interface SmsConfig {
  provider: 'fast2sms' | 'twilio' | 'msg91' | 'generic';
  apiKey?: string;
  senderId?: string;
  apiUrl?: string;
  accountSid?: string;
  authToken?: string;
  fromPhone?: string;
  enabled: boolean;
}

function loadSmsConfig(): SmsConfig {
  if (fs.existsSync(SMS_CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SMS_CONFIG_FILE, 'utf-8'));
    } catch {
      // fallback
    }
  }
  return {
    provider: 'fast2sms',
    apiKey: process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY || '',
    senderId: 'MUNCMP',
    enabled: !!(process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY || process.env.TWILIO_ACCOUNT_SID)
  };
}

function saveSmsConfig(config: SmsConfig): void {
  fs.writeFileSync(SMS_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

interface UpiPaymentSettings {
  upiId: string;
  upiDisplayName: string;
  paymentInstructions: string;
  qrImageDataUrl: string;
  qrImageMime: string;
  qrFileName: string;
  updatedAt: string;
  updatedByUid: string;
  updatedByName: string;
}

function loadUpiSettings(): UpiPaymentSettings {
  if (fs.existsSync(UPI_SETTINGS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(UPI_SETTINGS_FILE, 'utf-8'));
      return {
        upiId: String(parsed?.upiId || ''),
        upiDisplayName: String(parsed?.upiDisplayName || ''),
        paymentInstructions: String(parsed?.paymentInstructions || ''),
        qrImageDataUrl: String(parsed?.qrImageDataUrl || ''),
        qrImageMime: String(parsed?.qrImageMime || ''),
        qrFileName: String(parsed?.qrFileName || ''),
        updatedAt: String(parsed?.updatedAt || ''),
        updatedByUid: String(parsed?.updatedByUid || ''),
        updatedByName: String(parsed?.updatedByName || '')
      };
    } catch {
      // fallback
    }
  }
  return {
    upiId: '',
    upiDisplayName: '',
    paymentInstructions: '',
    qrImageDataUrl: '',
    qrImageMime: '',
    qrFileName: '',
    updatedAt: '',
    updatedByUid: '',
    updatedByName: ''
  };
}

function saveUpiSettings(settings: UpiPaymentSettings): void {
  fs.writeFileSync(UPI_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

function isSmsGatewayConfigured(): boolean {
  const config = loadSmsConfig();
  return !!(
    (config.provider === 'fast2sms' && config.apiKey) ||
    (config.provider === 'twilio' && config.accountSid && config.authToken && config.fromPhone) ||
    (config.provider === 'msg91' && config.apiKey) ||
    (config.provider === 'generic' && config.apiUrl && config.apiKey)
  );
}

async function dispatchSms(phone: string, message: string, otp: string): Promise<{ success: boolean; message: string; provider?: string }> {
  const config = loadSmsConfig();
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const target10 = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;

  if (target10.length !== 10) {
    return { success: false, message: 'Invalid 10-digit mobile number for SMS dispatch.' };
  }

  if (config.provider === 'fast2sms' && config.apiKey) {
    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { authorization: config.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: 'otp', variables_values: otp, numbers: target10 })
      });
      const data = await response.json();
      if (data && (data.return === true || data.status_code === 200)) {
        return { success: true, message: `OTP delivered via Fast2SMS to +91 XXXXXX${target10.slice(-4)}`, provider: 'Fast2SMS' };
      }
      return { success: false, message: `Fast2SMS Gateway Error: ${data.message || JSON.stringify(data)}` };
    } catch (err: any) {
      return { success: false, message: `Fast2SMS Gateway Network Failure: ${err.message}` };
    }
  }

  if (config.provider === 'twilio' && config.accountSid && config.authToken && config.fromPhone) {
    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
      const authHeader = 'Basic ' + Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
      const bodyParams = new URLSearchParams({ To: `+91${target10}`, From: config.fromPhone, Body: message });
      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString()
      });
      const data = await response.json();
      if (response.ok && data.sid) {
        return { success: true, message: `OTP delivered via Twilio SMS to +91 XXXXXX${target10.slice(-4)}`, provider: 'Twilio' };
      }
      return { success: false, message: `Twilio SMS Gateway Error: ${data.message || JSON.stringify(data)}` };
    } catch (err: any) {
      return { success: false, message: `Twilio SMS Gateway Network Failure: ${err.message}` };
    }
  }

  if (config.provider === 'msg91' && config.apiKey) {
    try {
      const response = await fetch(
        `https://control.msg91.com/api/v5/otp?template_id=${config.senderId || 'default'}&mobile=91${target10}&authkey=${config.apiKey}&otp=${otp}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      const data = await response.json();
      if (data && data.type === 'success') {
        return { success: true, message: `OTP delivered via MSG91 to +91 XXXXXX${target10.slice(-4)}`, provider: 'MSG91' };
      }
      return { success: false, message: `MSG91 Gateway Error: ${data.message || JSON.stringify(data)}` };
    } catch (err: any) {
      return { success: false, message: `MSG91 Gateway Network Failure: ${err.message}` };
    }
  }

  if (config.provider === 'generic' && config.apiUrl && config.apiKey) {
    try {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `91${target10}`, otp, message })
      });
      const data = await response.json();
      if (response.ok) {
        return { success: true, message: `OTP dispatched via Custom SMS Gateway to +91 XXXXXX${target10.slice(-4)}`, provider: 'Custom Webhook' };
      }
      return { success: false, message: `Custom SMS Gateway Error: ${JSON.stringify(data)}` };
    } catch (err: any) {
      return { success: false, message: `Custom SMS Gateway Error: ${err.message}` };
    }
  }

  return {
    success: false,
    message: 'Live SMS Gateway is not yet configured with an active provider (Fast2SMS / Twilio / MSG91).'
  };
}

// ---------------------------------------------------------------------------
// CORE HEALTH & COUNTERS API
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  const idPreview = relationalDb.getNextManagedUidPreview();
  res.json({
    status: 'ONLINE',
    app: 'MUN COMPUTER — CORPORATE ERP SYSTEM',
    version: APP_VERSION,
    mainAdminUid: MAIN_ADMIN_UID,
    smsConfigured: isSmsGatewayConfigured(),
    year: new Date().getFullYear(),
    nextIdPreview: idPreview.previewUid,
    counters: centralDb.getCurrentCounters(),
    time: new Date().toISOString()
  });
});

app.get('/api/counters', (_req, res) => {
  res.json({
    success: true,
    nextManagedUid: relationalDb.getNextManagedUidPreview(),
    counters: centralDb.getCurrentCounters(),
    year: new Date().getFullYear()
  });
});

// ---------------------------------------------------------------------------
// 3-ROLE AUTHENTICATION, ARGON2ID, TOTP MFA & SECURE PASSWORD RECOVERY
// ---------------------------------------------------------------------------
app.get('/api/auth/id-preview', (req, res) => {
  const role = String(req.query.role || 'STAFF').trim().toUpperCase();
  if (role === 'ADMIN' || role === 'ADMINISTRATION') {
    return res.json({
      success: true,
      role: 'ADMIN',
      permanent: true,
      previewUid: MAIN_ADMIN_UID,
      formatPreview: MAIN_ADMIN_UID,
      timezone: 'Asia/Kolkata'
    });
  }
  const resolvedRole = role === 'MANAGER' ? 'MANAGER' : 'STAFF';
  const preview = relationalDb.getNextManagedUidPreview(resolvedRole);
  res.json({
    success: true,
    role: resolvedRole,
    yy: preview.yy,
    year: preview.year,
    nextSerial: preview.nextSerial,
    nextGlobalSl: preview.nextGlobalSl,
    previewUid: preview.previewUid,
    formatPreview: `MC-${resolvedRole === 'MANAGER' ? 'MGR' : 'STF'}-${preview.year}-XXXXXXXX (Next: ${preview.previewUid})`,
    timezone: 'Asia/Kolkata'
  });
});

app.get('/api/auth/captcha', (_req, res) => {
  const { svg, captchaToken } = generateCaptchaChallenge();
  res.json({ success: true, svg, captchaToken });
});

app.get('/api/auth/session', (req, res) => {
  const resolved = resolveActor(req, true);
  if (!resolved.ok || !resolved.actor) {
    return res.status(resolved.code || 401).json({
      success: false,
      errorCode: resolved.errorCode || 'SESSION_INVALID',
      message: resolved.error || 'Session invalid.'
    });
  }
  res.json({
    success: true,
    sessionId: resolved.sessionId,
    deviceId: resolved.deviceId,
    user: sanitizeUserForResponse(resolved.actor, true)
  });
});

app.post('/api/auth/refresh', (req, res) => {
  const cookies = parseCookies(req);
  const rawRefreshToken = String(cookies[REFRESH_COOKIE_NAME] || req.body?.refreshToken || '').trim();
  const { deviceId } = extractDeviceMeta(req);

  const result = relationalDb.rotateRefreshTokenAtomic({
    rawRefreshToken,
    deviceId,
    ipAddress: req.ip,
    userAgent: String(req.headers['user-agent'] || ''),
    issueAccessTokenFn: (args) => {
      const expiresAt = new Date(Date.now() + DEFAULT_ACCESS_TOKEN_TTL_MS).toISOString();
      const token = issueAccessToken({
        uid: args.uid,
        role: args.role,
        isSuperAdmin: args.isSuperAdmin,
        sessionVersion: args.sessionVersion,
        sessionId: args.sessionId,
        deviceId: args.deviceId,
        ttlMs: DEFAULT_ACCESS_TOKEN_TTL_MS
      });
      return { token, expiresAt };
    }
  });

  if (!result.success || !result.user || !result.sessionToken) {
    if (result.errorCode === 'SESSION_REVOKED' || result.errorCode === 'SESSION_EXPIRED' || result.errorCode === 'DEVICE_REVOKED' || result.errorCode === 'REFRESH_INVALID') {
      clearRefreshCookie(res, req);
    }
    return res.status(result.code || 401).json({
      success: false,
      errorCode: result.errorCode || 'REFRESH_INVALID',
      message: result.message || 'Unable to refresh session.'
    });
  }

  // Only emit Set-Cookie on fresh rotation so concurrent grace-window responses never overwrite a newer cookie
  if (!result.alreadyRotatedInGrace && result.refreshToken && result.refreshExpiresAt) {
    setRefreshCookie(res, req, result.refreshToken, result.refreshExpiresAt);
  }

  res.json({
    success: true,
    sessionToken: result.sessionToken,
    csrfToken: result.csrfToken,
    expiresAt: result.expiresAt,
    sessionExpiresAt: result.refreshExpiresAt,
    sessionId: result.sessionId,
    deviceId: result.deviceId,
    generation: result.generation,
    alreadyRotatedInGrace: Boolean(result.alreadyRotatedInGrace),
    user: sanitizeUserForResponse(result.user, true)
  });
});

app.post('/api/auth/logout', (req, res) => {
  const token = String(req.headers['x-session-token'] || req.body?.sessionToken || '').trim();
  const cookies = parseCookies(req);
  const rawRefresh = String(cookies[REFRESH_COOKIE_NAME] || '').trim();
  const detailed = token ? verifyAccessTokenDetailed(token) : null;
  const sid = detailed?.payload?.sid;
  relationalDb.revokeSessionByToken(token, sid, rawRefresh);
  clearRefreshCookie(res, req);
  if (detailed?.payload?.uid) {
    relationalDb.logAudit(
      'AUTH_LOGOUT',
      `User ${detailed.payload.uid} signed out safely from device ${detailed.payload.did || 'browser'}.`,
      detailed.payload.uid,
      detailed.payload.uid,
      { deviceId: detailed.payload.did, sessionId: sid },
      req.ip
    );
  }
  res.json({ success: true, message: 'Signed out cleanly.' });
});

app.post('/api/auth/login', async (req, res) => {
  const { uid, password, panelRole, captchaToken, captchaInput, totpCode } = req.body || {};

  if (!uid || !password) {
    return res.status(400).json({ success: false, message: 'Please provide both User ID (or Username) and Password.' });
  }

  const ipRate = checkRateLimit(`login_ip_${req.ip}`, 30, 15 * 60 * 1000);
  if (!ipRate.allowed) {
    return res.status(429).json({
      success: false,
      message: 'Too many login requests from this device. Please wait 15 minutes.'
    });
  }

  if (!captchaToken || !captchaInput) {
    return res.status(400).json({ success: false, message: 'CAPTCHA verification is required.' });
  }

  if (!verifyCaptchaChallenge(String(captchaToken), String(captchaInput))) {
    return res.status(400).json({
      success: false,
      captchaError: true,
      message: 'Incorrect or expired CAPTCHA code. Please refresh and try again.'
    });
  }

  const row = relationalDb.findUserRowByUidOrUsername(String(uid).trim());
  if (!row) {
    relationalDb.logAudit(
      'AUTH_LOGIN_FAILED',
      `Failed login attempt for unknown identifier: ${String(uid).trim().toUpperCase()} via ${panelRole || 'CENTRAL'} panel.`,
      'ANON',
      String(uid).trim().toUpperCase(),
      { panel: panelRole || 'CENTRAL', ip: req.ip },
      req.ip
    );
    return res.status(401).json({
      success: false,
      message: 'Invalid User ID or Password.'
    });
  }

  if (row.locked_until && Date.parse(row.locked_until) > Date.now()) {
    const minsLeft = Math.max(1, Math.ceil((Date.parse(row.locked_until) - Date.now()) / 60000));
    relationalDb.logAudit('AUTH_LOGIN_LOCKED', `Blocked login attempt on locked account ${row.user_id}.`, row.user_id, row.user_id, undefined, req.ip);
    return res.status(429).json({
      success: false,
      lockedUntil: row.locked_until,
      message: `Account temporarily locked due to multiple failed login attempts. Try again in ${minsLeft} minute(s).`
    });
  }

  if (row.status === 'SUSPENDED') {
    return res.status(403).json({
      success: false,
      message: 'This account has been SUSPENDED by Administration. Login is disabled.'
    });
  }

  if (row.status === 'INACTIVE') {
    return res.status(403).json({
      success: false,
      message: 'This account is currently INACTIVE. Contact Administration to activate.'
    });
  }

  // Enforce strict 3-role panel boundary (ADMINISTRATION / MANAGER / STAFF)
  if (panelRole) {
    const panel = String(panelRole).trim().toUpperCase();
    const displayRole = row.role_id === 'ADMIN' ? 'ADMINISTRATION' : row.role_id;
    if ((panel === 'ADMIN' || panel === 'ADMINISTRATION') && row.role_id !== 'ADMIN' && row.is_main_admin !== 1) {
      return res.status(403).json({
        success: false,
        message: `Access Denied for ADMINISTRATION: Account ${row.user_id} holds role '${displayRole}'. Use ${row.role_id === 'MANAGER' ? 'MANAGER LOGIN' : 'STAFF LOGIN'}.`
      });
    }
    if (panel === 'MANAGER' && row.role_id !== 'MANAGER' && row.role_id !== 'ADMIN' && row.is_main_admin !== 1) {
      return res.status(403).json({
        success: false,
        message: `Access Denied for MANAGER LOGIN: Account ${row.user_id} holds role '${displayRole}'. Use STAFF LOGIN.`
      });
    }
    if (panel === 'STAFF' && row.role_id !== 'STAFF') {
      return res.status(403).json({
        success: false,
        message: `Access Denied for STAFF LOGIN: Account ${row.user_id} holds role '${displayRole}'. Use ${row.role_id === 'ADMIN' ? 'ADMINISTRATION' : 'MANAGER LOGIN'}.`
      });
    }
  }

  const pwdCheck = await verifyPasswordHash(String(password).trim(), row.password_hash);
  if (!pwdCheck.valid) {
    const failState = relationalDb.recordFailedLoginAttempt(row.user_id, req.ip);
    if (failState.locked) {
      return res.status(429).json({
        success: false,
        lockedUntil: failState.lockedUntil,
        message: 'Account temporarily locked after multiple failed login attempts.'
      });
    }
    relationalDb.logAudit(
      'AUTH_LOGIN_FAILED',
      `Invalid password attempt for ${row.user_id} via ${panelRole || 'CENTRAL'} panel.`,
      row.user_id,
      row.user_id,
      { panel: panelRole || 'CENTRAL', ip: req.ip },
      req.ip
    );
    return res.status(401).json({
      success: false,
      remainingAttempts: failState.remainingAttempts,
      message: `Invalid password for User ID ${row.user_id}. ${failState.remainingAttempts} attempt(s) remaining before temporary lockout.`
    });
  }

  // Transparently upgrade legacy bcrypt hashes to Argon2id on verified login
  if (pwdCheck.needsUpgrade) {
    await relationalDb.upgradeLegacyPasswordHashIfNeeded(row.user_id, String(password).trim());
  }

  const panelNormalized = String(panelRole || 'CENTRAL').trim().toUpperCase();

  // TOTP MFA Enforcement for MC-ADM-14012025 when enabled
  if (row.mfa_enabled === 1) {
    const codeClean = String(totpCode || '').replace(/\s+/g, '');
    if (!codeClean) {
      return res.json({
        success: true,
        mfaRequired: true,
        uid: row.user_id,
        mfaPendingToken: issueMfaPendingToken(row.user_id, panelNormalized),
        message: 'Two-Factor Authentication (TOTP) required. Enter the 6-digit code from your authenticator app.'
      });
    }
    if (!relationalDb.verifyUserTotp(row.user_id, codeClean)) {
      relationalDb.logAudit('AUTH_MFA_FAILED', `Invalid TOTP MFA code entered for ${row.user_id}.`, row.user_id, row.user_id, undefined, req.ip);
      return res.status(401).json({
        success: false,
        mfaRequired: true,
        message: 'Invalid 6-digit authenticator verification code.'
      });
    }
  }

  // Global 3-Device Registration Policy check (Admin + Manager + Staff combined)
  const devMeta = extractDeviceMeta(req);
  const deviceId = devMeta.deviceId || `DEV-HDR-${hashSensitive(String(req.headers['user-agent'] || req.ip || 'unknown')).slice(0, 16)}`;
  const devEval = relationalDb.evaluateAndRegisterLoginDevice({
    deviceId,
    deviceName: devMeta.deviceName || 'Browser Workstation',
    userAgent: String(req.headers['user-agent'] || ''),
    platform: devMeta.platform,
    userId: row.user_id,
    role: row.role_id,
    isMainAdmin: row.is_main_admin === 1
  });
  if (!devEval.allowed) {
    return res.status(devEval.code || 403).json({
      success: false,
      errorCode: devEval.errorCode,
      deviceId,
      approvedCount: devEval.approvedCount,
      maxDevices: devEval.maxDevices,
      message: devEval.message
    });
  }

  const sessionId = `SES-${crypto.randomBytes(12).toString('hex')}`;
  const accessExpiresAt = new Date(Date.now() + DEFAULT_ACCESS_TOKEN_TTL_MS).toISOString();
  const sessionToken = issueAccessToken({
    uid: row.user_id,
    role: row.role_id,
    isSuperAdmin: row.is_main_admin === 1,
    sessionVersion: row.session_version || 1,
    sessionId,
    deviceId,
    ttlMs: DEFAULT_ACCESS_TOKEN_TTL_MS
  });

  const sess = relationalDb.createSessionRecord({
    userId: row.user_id,
    sessionToken,
    panelRole: panelNormalized,
    deviceId,
    sessionId,
    ipAddress: req.ip,
    userAgent: String(req.headers['user-agent'] || '')
  });

  setRefreshCookie(res, req, sess.refreshToken, sess.refreshExpiresAt);

  const hydratedUser = relationalDb.getUserByUid(row.user_id)!;

  relationalDb.logAudit(
    'AUTH_LOGIN',
    `User ${hydratedUser.fullName} (${hydratedUser.uid} - ${hydratedUser.role}) signed in via ${panelNormalized} panel on device ${deviceId}.`,
    hydratedUser.uid,
    hydratedUser.uid,
    { panel: panelNormalized, role: hydratedUser.role, userName: hydratedUser.fullName, deviceId },
    req.ip
  );

  res.json({
    success: true,
    message: hydratedUser.mustChangePassword
      ? 'Login successful. Temporary password detected — password update required.'
      : `Welcome back, ${hydratedUser.fullName}!`,
    user: sanitizeUserForResponse(hydratedUser, true),
    sessionToken,
    csrfToken: sess.csrfToken,
    expiresAt: accessExpiresAt,
    sessionExpiresAt: sess.expiresAt,
    sessionId: sess.sessionId,
    deviceId,
    generation: sess.generation,
    mustChangePassword: hydratedUser.mustChangePassword
  });
});

app.post('/api/auth/mfa/verify-login', (req, res) => {
  const { mfaPendingToken, totpCode } = req.body || {};
  const pending = verifyMfaPendingToken(String(mfaPendingToken || ''));
  if (!pending) {
    return res.status(403).json({
      success: false,
      message: 'MFA verification challenge expired. Please sign in again.'
    });
  }
  const user = relationalDb.getUserByUid(pending.uid);
  if (!user || user.status !== 'ACTIVE') {
    return res.status(403).json({ success: false, message: 'Account unavailable.' });
  }
  if (!relationalDb.verifyUserTotp(user.uid, String(totpCode || ''))) {
    relationalDb.logAudit('AUTH_MFA_FAILED', `Invalid TOTP MFA code during login for ${user.uid}.`, user.uid, user.uid, undefined, req.ip);
    return res.status(401).json({ success: false, message: 'Invalid 6-digit authenticator code.' });
  }

  const devMeta = extractDeviceMeta(req);
  const deviceId = devMeta.deviceId || `DEV-HDR-${hashSensitive(String(req.headers['user-agent'] || req.ip || 'unknown')).slice(0, 16)}`;
  const devEval = relationalDb.evaluateAndRegisterLoginDevice({
    deviceId,
    deviceName: devMeta.deviceName || 'Browser Workstation',
    userAgent: String(req.headers['user-agent'] || ''),
    platform: devMeta.platform,
    userId: user.uid,
    role: user.role,
    isMainAdmin: user.isMainAdmin
  });
  if (!devEval.allowed) {
    return res.status(devEval.code || 403).json({
      success: false,
      errorCode: devEval.errorCode,
      deviceId,
      approvedCount: devEval.approvedCount,
      maxDevices: devEval.maxDevices,
      message: devEval.message
    });
  }

  const sessionId = `SES-${crypto.randomBytes(12).toString('hex')}`;
  const accessExpiresAt = new Date(Date.now() + DEFAULT_ACCESS_TOKEN_TTL_MS).toISOString();
  const sessionToken = issueAccessToken({
    uid: user.uid,
    role: user.role,
    isSuperAdmin: user.isMainAdmin,
    sessionVersion: user.sessionVersion || 1,
    sessionId,
    deviceId,
    ttlMs: DEFAULT_ACCESS_TOKEN_TTL_MS
  });
  const sess = relationalDb.createSessionRecord({
    userId: user.uid,
    sessionToken,
    panelRole: pending.panelRole,
    deviceId,
    sessionId,
    ipAddress: req.ip,
    userAgent: String(req.headers['user-agent'] || '')
  });

  setRefreshCookie(res, req, sess.refreshToken, sess.refreshExpiresAt);

  relationalDb.logAudit(
    'AUTH_LOGIN',
    `Main Administration ${user.uid} completed TOTP MFA login via ${pending.panelRole} panel on device ${deviceId}.`,
    user.uid,
    user.uid,
    { mfa: true, panel: pending.panelRole, deviceId },
    req.ip
  );

  res.json({
    success: true,
    message: `MFA verified. Welcome back, ${user.fullName}!`,
    user: sanitizeUserForResponse(user, true),
    sessionToken,
    csrfToken: sess.csrfToken,
    expiresAt: accessExpiresAt,
    sessionExpiresAt: sess.expiresAt,
    sessionId: sess.sessionId,
    deviceId,
    generation: sess.generation,
    mustChangePassword: user.mustChangePassword
  });
});

app.post('/api/auth/mfa/setup', (req, res) => {
  const auth = verifyMainAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const setup = relationalDb.beginMainAdminMfaSetup();
  res.json({
    success: true,
    uid: MAIN_ADMIN_UID,
    secret: setup.secret,
    otpAuthUri: setup.otpAuthUri,
    alreadyEnabled: setup.alreadyEnabled,
    message: 'Scan the setup key in your Authenticator app and enter a 6-digit code to activate MFA.'
  });
});

app.post('/api/auth/mfa/enable', (req, res) => {
  const auth = verifyMainAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = relationalDb.confirmEnableMainAdminMfa(String(req.body?.totpCode || ''));
  if (!result.success) return res.status(400).json(result);
  res.json({ ...result, user: sanitizeUserForResponse(relationalDb.getUserByUid(MAIN_ADMIN_UID)!, true) });
});

app.post('/api/auth/mfa/disable', (req, res) => {
  const auth = verifyMainAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = relationalDb.disableMainAdminMfa();
  res.json({ ...result, user: sanitizeUserForResponse(relationalDb.getUserByUid(MAIN_ADMIN_UID)!, true) });
});

app.post('/api/auth/change-password', async (req, res) => {
  const { uid, currentPassword, newPassword, confirmPassword } = req.body || {};

  if (!uid || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'All password fields are required.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
  }

  const row = relationalDb.findUserRowByUidOrUsername(String(uid).trim());
  if (!row) return res.status(404).json({ success: false, message: 'User account not found.' });
  if (row.status !== 'ACTIVE') {
    return res.status(403).json({ success: false, message: 'Only active accounts can update passwords.' });
  }

  const isMainAdminAccount = row.is_main_admin === 1 || row.user_id === MAIN_ADMIN_UID;
  const MAX_DAILY_PASSWORD_CHANGES = isMainAdminAccount
    ? 0
    : Math.max(1, Number(relationalDb.getSetting('daily_password_change_limit') || 5));
  const todayIst = getKolkataDateParts().isoDate;
  const usedToday = row.daily_password_change_date === todayIst ? Number(row.daily_password_change_count || 0) : 0;
  if (!isMainAdminAccount && usedToday >= MAX_DAILY_PASSWORD_CHANGES) {
    return res.status(429).json({
      success: false,
      dailyLimit: MAX_DAILY_PASSWORD_CHANGES,
      dailyChangesUsed: usedToday,
      remainingChangesToday: 0,
      message: `Daily password change limit reached (${MAX_DAILY_PASSWORD_CHANGES}/${MAX_DAILY_PASSWORD_CHANGES} changes used today). Please try again tomorrow.`
    });
  }

  const strength = validatePasswordStrength(String(newPassword), {
    uid: row.user_id,
    name: row.full_name,
    phone: row.mobile_number,
    aadhaarClean: relationalDb.getUserAadhaarForValidation(row),
    dob: row.dob || ''
  });
  if (!strength.valid) {
    return res.status(400).json({ success: false, message: strength.reason });
  }

  const currentCheck = await verifyPasswordHash(String(currentPassword).trim(), row.password_hash);
  if (!currentCheck.valid) {
    return res.status(401).json({ success: false, message: 'Current password verification failed.' });
  }
  const inLast5 = await relationalDb.isPasswordInLast5History(row, String(newPassword));
  if (inLast5) {
    return res.status(400).json({
      success: false,
      message: 'New password cannot match your current password or any of your last 5 passwords.'
    });
  }

  const updated = await relationalDb.changeOwnPassword(row.user_id, String(newPassword), todayIst, 'USER_PASSWORD_CHANGE');
  const devMeta = extractDeviceMeta(req);
  const deviceId = devMeta.deviceId || `DEV-HDR-${hashSensitive(String(req.headers['user-agent'] || req.ip || 'unknown')).slice(0, 16)}`;
  const sessionId = `SES-${crypto.randomBytes(12).toString('hex')}`;
  const accessExpiresAt = new Date(Date.now() + DEFAULT_ACCESS_TOKEN_TTL_MS).toISOString();
  const sessionToken = issueAccessToken({
    uid: updated.user.uid,
    role: updated.user.role,
    isSuperAdmin: updated.user.isMainAdmin,
    sessionVersion: updated.user.sessionVersion || 1,
    sessionId,
    deviceId,
    ttlMs: DEFAULT_ACCESS_TOKEN_TTL_MS
  });
  const sess = relationalDb.createSessionRecord({
    userId: updated.user.uid,
    sessionToken,
    panelRole: row.role_id,
    deviceId,
    sessionId,
    ipAddress: req.ip,
    userAgent: String(req.headers['user-agent'] || '')
  });
  setRefreshCookie(res, req, sess.refreshToken, sess.refreshExpiresAt);

  const remainingToday = isMainAdminAccount ? 999999 : Math.max(0, updated.dailyLimit - updated.dailyChangesUsed);
  res.json({
    success: true,
    message: isMainAdminAccount
      ? 'Password updated successfully! (Unlimited Administrator password changes enabled.)'
      : `Password updated successfully! (${remainingToday} of ${updated.dailyLimit} daily changes remaining today.)`,
    user: sanitizeUserForResponse(updated.user, true),
    sessionToken,
    csrfToken: sess.csrfToken,
    expiresAt: accessExpiresAt,
    sessionExpiresAt: sess.expiresAt,
    sessionId: sess.sessionId,
    deviceId,
    generation: sess.generation,
    dailyLimit: updated.dailyLimit,
    dailyChangesUsed: updated.dailyChangesUsed,
    remainingChangesToday: remainingToday,
    unlimitedPasswordChanges: isMainAdminAccount
  });
});

// ---------------------------------------------------------------------------
// FORGOT PASSWORD & RECOVERY SYSTEM (SECTION 7, 8, 9, 10 + USER IDENTITY CHECK)
// ---------------------------------------------------------------------------
const UNIFORM_RECOVERY_ERROR = 'Identity verification failed. Check your Official User ID, Full Name, Registered Mobile Number, and Aadhaar Number.';

function normalizeIdentityName(val: string): string {
  return String(val || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

app.post('/api/auth/forgot/initiate', async (req, res) => {
  const { uid, fullName, name, mobileNumber, phone, aadhaarNumber, aadhaar, captchaToken, captchaInput } = req.body || {};
  const cleanUid = String(uid || '').trim().toUpperCase();
  const cleanName = String(fullName || name || '').trim().replace(/\s+/g, ' ');
  const cleanMobile10 = String(mobileNumber || phone || '').replace(/[^0-9]/g, '');
  const cleanAadhaar12 = String(aadhaarNumber || aadhaar || '').replace(/[^0-9]/g, '');

  const rl = checkRateLimit(`forgot_init_${req.ip}`, 15, 15 * 60 * 1000);
  if (!rl.allowed) {
    return res.status(429).json({
      success: false,
      message: 'Too many password recovery attempts. Please wait 15 minutes before trying again.'
    });
  }

  if (!cleanUid || !cleanName || !/^\d{10}$/.test(cleanMobile10) || !/^\d{12}$/.test(cleanAadhaar12)) {
    return res.status(400).json({
      success: false,
      message: 'Enter Official User ID, Full Name, Registered 10-digit Mobile Number, and Registered 12-digit Aadhaar Number.'
    });
  }

  if (!captchaToken || !captchaInput || !verifyCaptchaChallenge(String(captchaToken), String(captchaInput))) {
    return res.status(400).json({
      success: false,
      captchaError: true,
      message: 'Incorrect or expired CAPTCHA code. Please refresh and try again.'
    });
  }

  const row = relationalDb.findUserRowByUidOrUsername(cleanUid);
  if (!row || row.user_id.toUpperCase() !== cleanUid || row.status !== 'ACTIVE') {
    relationalDb.logAudit('FORGOT_RECOVERY_FAILED', `Password recovery denied for identifier ${cleanUid}`, 'ANON', cleanUid, undefined, req.ip);
    return res.status(403).json({ success: false, message: UNIFORM_RECOVERY_ERROR });
  }

  if (row.locked_until && Date.parse(row.locked_until) > Date.now()) {
    const minsLeft = Math.max(1, Math.ceil((Date.parse(row.locked_until) - Date.now()) / 60000));
    return res.status(429).json({
      success: false,
      lockedUntil: row.locked_until,
      message: `Account is temporarily locked for ${minsLeft} minute(s) due to repeated verification failures.`
    });
  }

  const stored10 = String(row.mobile_number || '').replace(/[^0-9]/g, '').slice(-10);
  const nameMatches = normalizeIdentityName(row.full_name) === normalizeIdentityName(cleanName);
  const mobileMatches = stored10 === cleanMobile10;
  const aadhaarMatches = relationalDb.verifyUserAadhaar(row, cleanAadhaar12);

  if (!nameMatches || !mobileMatches || !aadhaarMatches) {
    const lockRes = relationalDb.recordFailedResetAttempt(row.user_id, req.ip);
    relationalDb.logAudit(
      'FORGOT_RECOVERY_FAILED',
      `Identity verification mismatch during password recovery for ${row.user_id}`,
      row.user_id,
      row.user_id,
      { nameMatches, mobileMatches, aadhaarMatches },
      req.ip
    );
    if (lockRes.locked) {
      return res.status(429).json({
        success: false,
        lockedUntil: lockRes.lockedUntil,
        message: 'Account temporarily locked after repeated verification failures.'
      });
    }
    return res.status(403).json({ success: false, message: UNIFORM_RECOVERY_ERROR });
  }

  const smsConfigured = isSmsGatewayConfigured();
  if (smsConfigured) {
    const reqRec = relationalDb.createPasswordResetRequest({
      userId: row.user_id,
      mobileVerified: true,
      captchaVerified: true,
      otpVerified: false,
      status: 'INITIATED',
      ipAddress: req.ip
    });

    const otp = String(crypto.randomInt(100000, 999999));
    const smsRes = await dispatchSms(stored10, `MUN COMPUTER OTP for password reset (${row.user_id}): ${otp}. Valid for 10 mins.`, otp);
    if (!smsRes.success) {
      return res.status(502).json({
        success: false,
        message: smsRes.message || 'Unable to send OTP SMS right now.'
      });
    }
    activeOtps.set(reqRec.requestId, {
      phone: stored10,
      otpHash: crypto.createHash('sha256').update(otp).digest('hex'),
      expiresAt: Date.now() + 10 * 60 * 1000,
      lastSentAt: Date.now(),
      attempts: 0,
      maxAttempts: 5,
      type: 'FORGOT_PASSWORD',
      uid: row.user_id
    });

    relationalDb.logAudit('PASSWORD_RESET_OTP_SENT', `Recovery OTP sent via ${smsRes.provider} for ${row.user_id}`, row.user_id, row.user_id, undefined, req.ip);
    return res.json({
      success: true,
      otpRequired: true,
      requestId: reqRec.requestId,
      stepToken: issueForgotStepToken(`${row.user_id}|${reqRec.requestId}`, 'STEP1'),
      uid: row.user_id,
      userName: row.full_name,
      userRole: row.role_id,
      mobileMasked: maskPhone(stored10),
      message: smsRes.message
    });
  }

  // Verified Official User ID + Full Name + Registered Mobile + Registered Aadhaar + CAPTCHA -> Issue single-use hashed reset token
  const reqRec = relationalDb.createPasswordResetRequest({
    userId: row.user_id,
    mobileVerified: true,
    captchaVerified: true,
    otpVerified: true,
    status: 'VERIFIED',
    ipAddress: req.ip
  });
  const resetToken = issueForgotStepToken(`${row.user_id}|${reqRec.requestId}`, 'IDENTITY_VERIFIED');
  relationalDb.setPasswordResetTokenHash(reqRec.requestId, resetToken);

  relationalDb.logAudit(
    'FORGOT_RECOVERY_VERIFIED',
    `Recovery identity checks verified (User ID + Full Name + Registered Mobile + Aadhaar + CAPTCHA) for ${row.user_id}.`,
    row.user_id,
    row.user_id,
    undefined,
    req.ip
  );

  res.json({
    success: true,
    otpRequired: false,
    requestId: reqRec.requestId,
    resetToken,
    uid: row.user_id,
    userName: row.full_name,
    userRole: row.role_id,
    mobileMasked: maskPhone(stored10),
    message: 'Identity verified. Set and confirm your new strong password.'
  });
});

app.post('/api/auth/forgot/verify-otp', (req, res) => {
  const { stepToken, otp } = req.body || {};
  const parsed = verifyForgotStepToken(String(stepToken || ''), 'STEP1');
  if (!parsed) {
    return res.status(403).json({ success: false, message: 'Recovery session expired or invalid. Please restart recovery.' });
  }
  const [userId, requestId] = String(parsed.uid || '').split('|');
  const otpEntry = activeOtps.get(requestId);
  if (!otpEntry || otpEntry.uid !== userId || Date.now() > otpEntry.expiresAt) {
    return res.status(403).json({ success: false, message: 'OTP expired or not found. Please restart recovery.' });
  }
  otpEntry.attempts = (otpEntry.attempts || 0) + 1;
  if (otpEntry.attempts > (otpEntry.maxAttempts || 5)) {
    activeOtps.delete(requestId);
    return res.status(429).json({ success: false, message: 'Maximum OTP attempts exceeded. Please restart password recovery.' });
  }
  const inputHash = crypto.createHash('sha256').update(String(otp || '').trim()).digest('hex');
  if (inputHash !== otpEntry.otpHash) {
    return res.status(403).json({ success: false, message: 'Invalid OTP entered. Please check and try again.' });
  }
  activeOtps.delete(requestId);
  const resetToken = issueForgotStepToken(`${userId}|${requestId}`, 'IDENTITY_VERIFIED');
  relationalDb.markPasswordResetRequestOtpVerified(requestId, resetToken);
  const row = relationalDb.findUserRowByUidOrUsername(userId);

  res.json({
    success: true,
    resetToken,
    uid: userId,
    requestId,
    userName: row?.full_name || '',
    userRole: row?.role_id || '',
    mobileMasked: row ? maskPhone(row.mobile_number) : '',
    message: 'OTP verified. Enter and confirm your new password.'
  });
});

app.post('/api/auth/forgot/reset-password', async (req, res) => {
  const { resetToken, newPassword, confirmPassword } = req.body || {};
  const verified = verifyForgotStepToken(String(resetToken || ''), 'IDENTITY_VERIFIED');
  if (!verified) {
    return res.status(403).json({
      success: false,
      message: 'Verification expired or incomplete. Please restart Forgot Password verification.'
    });
  }

  const [userId, requestId] = String(verified.uid || '').split('|');
  if (!userId || !requestId) {
    return res.status(403).json({ success: false, message: 'Invalid recovery token payload.' });
  }

  const reqRec = relationalDb.getPasswordResetRequest(requestId);
  if (!reqRec || reqRec.user_id !== userId || reqRec.status !== 'VERIFIED' || reqRec.reset_token_used_at || Date.parse(reqRec.expires_at) <= Date.now()) {
    return res.status(403).json({
      success: false,
      message: 'Recovery request expired or already used. Start a fresh password recovery request.'
    });
  }

  if (!newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'New Password and Confirm Password are required.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'New Password and Confirm Password do not match.' });
  }

  const row = relationalDb.findUserRowByUidOrUsername(userId);
  if (!row || row.status !== 'ACTIVE') {
    return res.status(403).json({ success: false, message: 'Account is not active.' });
  }

  const strength = validatePasswordStrength(String(newPassword), {
    uid: row.user_id,
    name: row.full_name,
    phone: row.mobile_number,
    aadhaarClean: relationalDb.getUserAadhaarForValidation(row),
    dob: row.dob || ''
  });
  if (!strength.valid) {
    return res.status(400).json({ success: false, message: strength.reason });
  }

  const inLast5 = await relationalDb.isPasswordInLast5History(row, String(newPassword));
  if (inLast5) {
    return res.status(400).json({
      success: false,
      message: 'New password cannot match your current password or any of your last 5 passwords.'
    });
  }

  const completed = await relationalDb.completePasswordResetAtomic({
    userId: row.user_id,
    requestId,
    resetTokenHash: hashSensitive(String(resetToken)),
    newPassword: String(newPassword),
    ipAddress: req.ip
  });

  // Never include plaintext password, OTP, reset token, or full Aadhaar in JSON response or receipt storage
  res.json({
    success: true,
    userId: completed.userId,
    uid: completed.userId,
    userName: completed.userName,
    userRole: completed.userRole,
    mobileMasked: completed.mobileMasked,
    resetStatus: completed.resetStatus,
    resetDate: completed.resetDate,
    resetTime: completed.resetTime,
    resetTime12: completed.resetTime12,
    referenceNumber: completed.referenceNumber,
    heading: 'Congratulations! Your MUN COMPUTER account password has been successfully updated.',
    receiptHeader: 'MUN COMPUTER — OFFICIAL PASSWORD RESET RECEIPT',
    verificationNotice:
      'Computer-generated verification confirmation. Password reset verified against registered account credentials; all active sessions invalidated immediately.'
  });
});

app.get('/api/auth/forgot/references', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const requestedUid = req.query.uid ? String(req.query.uid).trim().toUpperCase() : undefined;
  let refs = relationalDb.listPasswordResetReferences({
    userId: requestedUid,
    limit: Number(req.query.limit || 100)
  });
  if (auth.actor.role === 'MANAGER' && !auth.actor.isMainAdmin) {
    const staffSet = new Set(
      relationalDb
        .listUsers({ role: 'STAFF' })
        .map(u => u.uid.toUpperCase())
    );
    refs = refs.filter(r => staffSet.has(r.userId.toUpperCase()));
  }
  res.json({ success: true, references: refs });
});

// Self-registration is disabled — all Manager and Staff accounts are provisioned via ADMINISTRATION -> MANAGER / STAFF
app.post('/api/auth/register', (_req, res) => {
  res.status(403).json({
    success: false,
    message: 'Public self-registration is disabled. Authorized accounts are created exclusively from ADMINISTRATION.'
  });
});

app.post('/api/auth/register-staff', (_req, res) => {
  res.status(403).json({
    success: false,
    message: 'Public self-registration is disabled. Staff accounts are provisioned exclusively via ADMINISTRATION -> STAFF.'
  });
});

// ---------------------------------------------------------------------------
// ADMINISTRATION -> MANAGER & STAFF USER MANAGEMENT (STRICT RBAC)
// ---------------------------------------------------------------------------
app.get('/api/users', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 401).json({ success: false, message: auth.error });
  }

  const actor = auth.actor;
  const isAdmin = actor.role === 'ADMIN' || actor.isMainAdmin || actor.uid === MAIN_ADMIN_UID;
  const isManager = actor.role === 'MANAGER';

  if (!isAdmin && !isManager) {
    return res.status(403).json({
      success: false,
      message: 'ACCESS DENIED: Staff accounts cannot access User Management.'
    });
  }

  const roleFilter = req.query.role ? String(req.query.role).trim().toUpperCase() : undefined;
  const statusFilter = req.query.status ? String(req.query.status).trim().toUpperCase() : undefined;
  const q = req.query.q ? String(req.query.q).trim() : undefined;

  // Strict RBAC: Manager can ONLY view/manage STAFF accounts
  if (isManager && !isAdmin && roleFilter && roleFilter !== 'STAFF' && roleFilter !== 'ALL') {
    return res.status(403).json({
      success: false,
      message: 'ACCESS DENIED: Managers can access STAFF accounts only.'
    });
  }

  const effectiveRoleFilter = isAdmin ? roleFilter : 'STAFF';
  const visibleUsers = relationalDb.listUsers({
    role: effectiveRoleFilter,
    status: statusFilter,
    q
  });

  const stats = relationalDb.computeUserStats();
  const recentLogins = isAdmin
    ? relationalDb
        .listAuditLogs(200)
        .filter(l => ['AUTH_LOGIN', 'AUTH_LOGIN_FAILED', 'ACCOUNT_LOCKED', 'PASSWORD_RESET', 'PASSWORD_CHANGE', 'MFA_ENABLED', 'MFA_DISABLED'].includes(l.action))
        .slice(0, 25)
    : [];

  res.json({
    success: true,
    users: visibleUsers.map(u => sanitizeUserForResponse(u, true)),
    stats: isAdmin
      ? stats
      : {
          ...stats,
          adminCount: 0,
          managerCount: 0,
          totalUsers: stats.staffCount
        },
    recentLogins,
    idPreview: relationalDb.getNextManagedUidPreview()
  });
});

app.get('/api/users/id-preview', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  res.json({ success: true, ...relationalDb.getNextManagedUidPreview() });
});

app.get('/api/users/dashboard-stats', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({ success: false, message: auth.error });
  }
  const isAdmin = auth.actor.role === 'ADMIN' || auth.actor.isMainAdmin;
  const stats = relationalDb.computeUserStats();
  const recentLogins = isAdmin
    ? relationalDb
        .listAuditLogs(150)
        .filter(l => ['AUTH_LOGIN', 'AUTH_LOGIN_FAILED', 'ACCOUNT_LOCKED', 'PASSWORD_RESET', 'PASSWORD_CHANGE'].includes(l.action))
        .slice(0, 25)
    : [];
  const mgrPreview = relationalDb.getNextManagedUidPreview('MANAGER');
  const stfPreview = relationalDb.getNextManagedUidPreview('STAFF');
  res.json({
    success: true,
    stats,
    recentLogins,
    idPreviews: {
      ADMIN: { formatPreview: MAIN_ADMIN_UID, permanent: true },
      MANAGER: { formatPreview: mgrPreview.previewUid, yy: mgrPreview.yy, year: mgrPreview.year, nextSerial: mgrPreview.nextSerial, nextGlobalSl: mgrPreview.nextGlobalSl },
      STAFF: { formatPreview: stfPreview.previewUid, yy: stfPreview.yy, year: stfPreview.year, nextSerial: stfPreview.nextSerial, nextGlobalSl: stfPreview.nextGlobalSl }
    }
  });
});

app.post('/api/users/create', async (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({ success: false, message: auth.error || 'Authorized Manager or Administration login required.' });
  }
  const actor = auth.actor;
  const isAdmin = actor.role === 'ADMIN' || actor.isMainAdmin || actor.uid === MAIN_ADMIN_UID;
  const body = req.body || {};

  const requestedRole = String(body.role || 'STAFF').trim().toUpperCase();
  if (requestedRole !== 'MANAGER' && requestedRole !== 'STAFF') {
    return res.status(403).json({
      success: false,
      message: `Cannot create '${requestedRole}' accounts. Only MANAGER or STAFF roles can be provisioned.`
    });
  }

  // Strict RBAC: Manager may ONLY create STAFF accounts
  if (!isAdmin && requestedRole !== 'STAFF') {
    return res.status(403).json({
      success: false,
      message: 'ACCESS DENIED: Managers can create and manage STAFF accounts only.'
    });
  }

  const tempPassword = generateSecureTempPassword(12);
  const fullName = String(body.fullName || body.name || '').trim();
  const username = String(body.username || '').trim();
  const mobileNumber = String(body.mobileNumber || body.phone || '').trim();
  const aadhaarNumber = String(body.aadhaarNumber || body.aadhaar || '').trim();
  const dob = String(body.dob || '').trim();
  const email = String(body.email || '').trim();
  const address = String(body.address || '').trim();
  const status: CoreAccountStatus = 'ACTIVE';

  const result = await relationalDb.createManagedUserAtomic(
    {
      fullName,
      username,
      mobileNumber,
      aadhaarNumber,
      email,
      role: requestedRole as 'MANAGER' | 'STAFF',
      address,
      status,
      designation: body.designation,
      fatherName: body.fatherName,
      motherName: body.motherName,
      dob,
      district: body.district,
      areaType: body.areaType === 'URBAN' ? 'URBAN' : 'RURAL',
      blockOrMunicipality: body.blockOrMunicipality,
      gpOrWard: body.gpOrWard,
      villageOrWard: body.villageOrLocality || body.villageOrWard,
      postOffice: body.postOffice,
      policeStation: body.policeStation,
      pinCode: body.pinCode,
      allowDuplicateException: isAdmin && Boolean(body.allowDuplicateException),
      duplicateExceptionReason: body.duplicateExceptionReason ? String(body.duplicateExceptionReason).trim() : '',
      tempPassword
    },
    actor.uid
  );

  if (!result.success || !result.user) {
    return res.status(result.code || 400).json({ success: false, message: result.message });
  }

  // Return one-time temporaryPassword strictly in this single response; never stored or logged plaintext
  res.json({
    success: true,
    message: result.message,
    uid: result.user.uid,
    temporaryPassword: tempPassword,
    user: sanitizeUserForResponse(result.user, true),
    nextIdPreview: relationalDb.getNextManagedUidPreview().previewUid
  });
});

app.post('/api/users/edit', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });

  const actor = auth.actor;
  const isAdmin = actor.role === 'ADMIN' || actor.isMainAdmin || actor.uid === MAIN_ADMIN_UID;
  const body = req.body || {};
  const targetUid = String(body.uid || body.userId || body.requestId || '').trim().toUpperCase();
  if (!targetUid) return res.status(400).json({ success: false, message: 'Target User ID is required.' });

  const target = relationalDb.getUserByUid(targetUid);
  if (!target) return res.status(404).json({ success: false, message: 'User account not found.' });

  if (target.uid === MAIN_ADMIN_UID || target.isMainAdmin) {
    return res.status(403).json({
      success: false,
      message: `ACCESS DENIED: Permanent Master Administrator account ${MAIN_ADMIN_UID} profile cannot be modified, renamed, or deleted via User Management.`
    });
  }

  // Prevent Managers from touching Admin/Manager accounts
  if (!isAdmin) {
    if (target.role !== 'STAFF') {
      return res.status(403).json({
        success: false,
        message: 'ACCESS DENIED: Managers can edit STAFF accounts only.'
      });
    }
    if (body.role && String(body.role).trim().toUpperCase() !== 'STAFF') {
      return res.status(403).json({
        success: false,
        message: 'ACCESS DENIED: Managers cannot promote accounts to MANAGER or ADMIN.'
      });
    }
  }

  const result = relationalDb.editManagedUser(
    targetUid,
    {
      fullName: body.fullName !== undefined ? body.fullName : body.name,
      username: body.username,
      mobileNumber: body.mobileNumber !== undefined ? body.mobileNumber : body.phone,
      email: body.email,
      role: body.role,
      address: body.address,
      status: body.status,
      designation: body.designation,
      fatherName: body.fatherName,
      motherName: body.motherName,
      dob: body.dob,
      district: body.district,
      areaType: body.areaType,
      blockOrMunicipality: body.blockOrMunicipality,
      gpOrWard: body.gpOrWard,
      villageOrWard: body.villageOrWard,
      postOffice: body.postOffice,
      policeStation: body.policeStation,
      pinCode: body.pinCode
    },
    actor.uid
  );

  if (!result.success || !result.user) {
    return res.status(result.code || 400).json({ success: false, message: result.message });
  }

  res.json({
    success: true,
    message: result.message,
    user: sanitizeUserForResponse(result.user, true)
  });
});

app.post('/api/users/toggle-status', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });

  const actor = auth.actor;
  const isAdmin = actor.role === 'ADMIN' || actor.isMainAdmin || actor.uid === MAIN_ADMIN_UID;
  const targetUid = String(req.body?.uid || req.body?.userId || req.body?.requestId || '').trim().toUpperCase();
  if (!targetUid) return res.status(400).json({ success: false, message: 'User ID is required.' });
  if (targetUid === MAIN_ADMIN_UID) {
    return res.status(403).json({ success: false, message: `Permanent Master Administrator account ${MAIN_ADMIN_UID} cannot be deactivated or suspended.` });
  }

  const target = relationalDb.getUserByUid(targetUid);
  if (!target) return res.status(404).json({ success: false, message: 'User account not found.' });

  if (!isAdmin && target.role !== 'STAFF') {
    return res.status(403).json({
      success: false,
      message: 'ACCESS DENIED: Managers can activate, deactivate, or suspend STAFF accounts only.'
    });
  }

  const nextStatus = req.body?.status ? (String(req.body.status).trim().toUpperCase() as CoreAccountStatus) : undefined;
  const result = relationalDb.setManagedUserStatus(targetUid, nextStatus, actor.uid);
  if (!result.success) {
    return res.status(result.code || 400).json({ success: false, message: result.message });
  }

  res.json({
    success: true,
    message: result.message,
    status: result.status,
    user: result.user ? sanitizeUserForResponse(result.user, true) : undefined
  });
});

app.post('/api/users/reset-password', async (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });

  const actor = auth.actor;
  const isAdmin = actor.role === 'ADMIN' || actor.isMainAdmin || actor.uid === MAIN_ADMIN_UID;
  const targetUid = String(req.body?.uid || '').trim().toUpperCase();
  if (!targetUid) return res.status(400).json({ success: false, message: 'User ID is required.' });

  const target = relationalDb.getUserByUid(targetUid);
  if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
  if ((target.uid === MAIN_ADMIN_UID || target.isMainAdmin) && actor.uid !== MAIN_ADMIN_UID) {
    return res.status(403).json({ success: false, message: 'ACCESS DENIED: Cannot reset Main Administration password.' });
  }
  if (!isAdmin && target.role !== 'STAFF') {
    return res.status(403).json({ success: false, message: 'ACCESS DENIED: Managers can issue temporary passwords for STAFF accounts only.' });
  }

  const tempPassword = generateSecureTempPassword(12);
  const result = await relationalDb.adminSetTemporaryPassword(target.uid, tempPassword, actor.uid);
  if (!result.success) {
    return res.status(result.code || 400).json({ success: false, message: result.message });
  }

  res.json({
    success: true,
    uid: target.uid,
    temporaryPassword: tempPassword,
    message: result.message
  });
});

app.post('/api/users/permissions', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({
      success: false,
      message: auth.error || 'ACCESS DENIED: Only Main Administration can modify User Role & Individual Permissions.'
    });
  }

  const { uid, requestId, permissionOverrides, extraPermissions, resetToDefaults } = req.body || {};
  const lookup = String(uid || requestId || '').trim().toUpperCase();
  if (!lookup) return res.status(400).json({ success: false, message: 'Target User ID is required.' });

  const result = relationalDb.updateUserPermissions(
    lookup,
    { permissionOverrides, extraPermissions, resetToDefaults },
    auth.actor.uid
  );
  if (!result.success || !result.user) {
    return res.status(result.code || 400).json({ success: false, message: result.message });
  }

  res.json({
    success: true,
    message: result.message,
    user: sanitizeUserForResponse(result.user, true)
  });
});

app.post('/api/users/delete', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({
      success: false,
      message: auth.error || 'ACCESS DENIED: Only Administration can permanently delete Manager or Staff accounts.'
    });
  }

  const { uid, userId, requestId, reason } = req.body || {};
  const lookup = String(uid || userId || requestId || '').trim().toUpperCase();
  const cleanReason = String(reason || '').trim();
  if (!lookup) return res.status(400).json({ success: false, message: 'User ID is required.' });
  if (cleanReason.length < 3) {
    return res.status(400).json({ success: false, message: 'Delete Reason (minimum 3 characters) is required.' });
  }

  const result = relationalDb.deleteManagedUser(lookup, auth.actor.uid, cleanReason);
  if (!result.success || !result.deletedUser) {
    return res.status(result.code || 400).json({ success: false, message: result.message });
  }

  centralDb.recordDeleteHistory({
    targetType: 'USER_ACCOUNT',
    targetId: result.deletedUser.uid,
    targetSummary: `${result.deletedUser.fullName} (${result.deletedUser.role}) · Phone ${result.deletedUser.phoneMasked}`,
    reason: cleanReason,
    deletedByUid: auth.actor.uid,
    deletedByName: auth.actor.fullName
  });

  res.json({ success: true, message: result.message });
});

app.delete('/api/users/:id', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({
      success: false,
      message: auth.error || 'ACCESS DENIED: Only Administration can delete accounts.'
    });
  }
  const targetUid = String(req.params.id || '').trim().toUpperCase();
  const reason = String(req.body?.reason || req.query?.reason || 'Deleted by Administration').trim();
  const result = relationalDb.deleteManagedUser(targetUid, auth.actor.uid, reason);
  if (!result.success || !result.deletedUser) {
    return res.status(result.code || 400).json({ success: false, message: result.message });
  }
  res.json({ success: true, message: result.message });
});

// ---------------------------------------------------------------------------
// GLOBAL 3-DEVICE APPROVAL & REVOCATION POLICY API (ADMINISTRATION ONLY)
// ---------------------------------------------------------------------------
app.get('/api/devices', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({
      success: false,
      errorCode: auth.errorCode,
      message: auth.error || 'ACCESS DENIED: Administration access required.'
    });
  }
  const devices = relationalDb.listDevices();
  const approvedCount = devices.filter(d => d.status === 'APPROVED').length;
  res.json({ success: true, devices, approvedCount, maxDevices: 3 });
});

app.post('/api/devices/:deviceId/approve', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({
      success: false,
      errorCode: auth.errorCode,
      message: auth.error || 'ACCESS DENIED: Administration access required.'
    });
  }
  const result = relationalDb.approveDevice(String(req.params.deviceId || ''), auth.actor.uid);
  if (!result.success) return res.status(result.code || 400).json(result);
  res.json({ ...result, devices: relationalDb.listDevices(), maxDevices: 3 });
});

app.post('/api/devices/:deviceId/reject', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({
      success: false,
      errorCode: auth.errorCode,
      message: auth.error || 'ACCESS DENIED: Administration access required.'
    });
  }
  const result = relationalDb.rejectDevice(String(req.params.deviceId || ''), auth.actor.uid);
  if (!result.success) return res.status(result.code || 400).json(result);
  res.json({ ...result, devices: relationalDb.listDevices(), approvedCount: relationalDb.countApprovedDevices(), maxDevices: 3 });
});

app.post('/api/devices/:deviceId/revoke', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({
      success: false,
      errorCode: auth.errorCode,
      message: auth.error || 'ACCESS DENIED: Administration access required.'
    });
  }
  const result = relationalDb.revokeDevice(String(req.params.deviceId || ''), auth.actor.uid);
  if (!result.success) return res.status(result.code || 400).json(result);
  res.json({ ...result, devices: relationalDb.listDevices(), approvedCount: relationalDb.countApprovedDevices(), maxDevices: 3 });
});

app.delete('/api/devices/:deviceId', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({
      success: false,
      errorCode: auth.errorCode,
      message: auth.error || 'ACCESS DENIED: Administration access required.'
    });
  }
  const result = relationalDb.deleteDevice(String(req.params.deviceId || ''), auth.actor.uid);
  if (!result.success) return res.status(result.code || 400).json(result);
  res.json({ ...result, devices: relationalDb.listDevices(), approvedCount: relationalDb.countApprovedDevices(), maxDevices: 3 });
});

app.get('/api/permissions/schema', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  res.json({
    success: true,
    menus: MENU_DEFINITIONS,
    actions: PERMISSION_ACTIONS,
    roleDefaults: {
      ADMIN: getDefaultRolePermissions('ADMIN'),
      MANAGER: getDefaultRolePermissions('MANAGER'),
      STAFF: getDefaultRolePermissions('STAFF')
    },
    currentEffective: resolveEffectivePermissions(auth.actor)
  });
});

app.post('/api/permissions/verify', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const menuId = String(req.body?.menuId || '');
  const action = String(req.body?.action || 'view') as PermissionAction;
  const amount = req.body?.amount !== undefined ? Number(req.body.amount) : undefined;
  const eff = resolveEffectivePermissions(auth.actor);

  const allowed = menuId ? hasMenuPermission(auth.actor, menuId, action) : true;
  if (!allowed) {
    return res.status(403).json({
      success: false,
      allowed: false,
      message: `Permission denied: '${menuId}.${action}' is disabled for ${auth.actor.fullName} (${auth.actor.uid}).`
    });
  }
  if (amount !== undefined && eff.extra.cashOperationLimit > 0 && amount > eff.extra.cashOperationLimit) {
    return res.status(403).json({
      success: false,
      allowed: false,
      limitExceeded: true,
      limit: eff.extra.cashOperationLimit,
      message: `Cash Operation Limit Exceeded: Your limit is ₹${eff.extra.cashOperationLimit}. Contact Administration for approval.`
    });
  }
  res.json({ success: true, allowed: true, effectivePermissions: eff });
});

// ---------------------------------------------------------------------------
// SERVICE CATALOG MANAGEMENT API (ADD, EDIT, SOFT DELETE, RESTORE, TOGGLE)
// ---------------------------------------------------------------------------
app.get('/api/services', (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  const activeOnly = req.query.activeOnly === 'true';
  const category = req.query.category ? String(req.query.category) : undefined;
  const q = req.query.q ? String(req.query.q) : undefined;
  const services = centralDb.listServices({ includeDeleted, activeOnly, category, q });
  res.json({ success: true, services, total: services.length });
});

app.post('/api/services', (req, res) => {
  const auth = verifyMenuPermission(req, 'rate-chart', 'add');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = centralDb.upsertService(req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.put('/api/services/:id', (req, res) => {
  const auth = verifyMenuPermission(req, 'rate-chart', 'edit');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = centralDb.upsertService({ ...(req.body || {}), id: String(req.params.id) }, auth.actor.uid);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.delete('/api/services/:id', (req, res) => {
  const auth = verifyMenuPermission(req, 'rate-chart', 'delete');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = centralDb.softDeleteService(String(req.params.id), auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

app.post('/api/services/:id/restore', (req, res) => {
  const auth = verifyMenuPermission(req, 'rate-chart', 'edit');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = centralDb.restoreService(String(req.params.id), auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

app.post('/api/services/:id/toggle', (req, res) => {
  const auth = verifyMenuPermission(req, 'rate-chart', 'edit');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = centralDb.toggleServiceActive(String(req.params.id), auth.actor.uid);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.delete('/api/services/:id/permanent', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = centralDb.permanentDeleteService(String(req.params.id), auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

// ---------------------------------------------------------------------------
// INVENTORY PRODUCT CATEGORIES API (GAS DEFAULTS + CUSTOM ADD / DELETE)
// ---------------------------------------------------------------------------
app.get('/api/inventory/categories', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const categories = centralDb.getInventoryCategories();
  res.json({ success: true, categories });
});

app.post('/api/inventory/categories', (req, res) => {
  const auth = verifyMenuPermission(req, 'inventory', 'add');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const name = String(req.body?.name || '');
  const id = req.body?.id ? String(req.body.id) : undefined;
  const result = centralDb.addInventoryCategory(name, auth.actor.uid, id);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.delete('/api/inventory/categories/:id', (req, res) => {
  const auth = verifyMenuPermission(req, 'inventory', 'delete');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = centralDb.deleteInventoryCategory(String(req.params.id), auth.actor.uid);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/inventory/categories/restore-defaults', (req, res) => {
  const auth = verifyMenuPermission(req, 'inventory', 'add');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = centralDb.restoreDefaultGasCategories(auth.actor.uid);
  res.json(result);
});

app.post('/api/inventory/categories/sync', (req, res) => {
  const auth = verifyMenuPermission(req, 'inventory', 'add');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const categories = Array.isArray(req.body?.categories) ? req.body.categories : [];
  const result = centralDb.syncInventoryCategories(categories, auth.actor.uid);
  res.json(result);
});

// ---------------------------------------------------------------------------
// LPG & GAS SERVICES MODULE STATE PERSISTENCE API
// ---------------------------------------------------------------------------
app.get('/api/gas/state', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  res.json({ success: true, gasState: centralDb.getGasState() });
});

app.post('/api/gas/state', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const result = centralDb.syncGasState(req.body || {}, auth.actor.uid);
  res.json(result);
});

// ---------------------------------------------------------------------------
// GOOGLE MAPS PLATFORM PROXY ROUTES (Geocoding v4 + Routes API v2 + JS Config)
// ---------------------------------------------------------------------------
function resolveGoogleMapsServerKey(): string {
  return String(
    process.env.GOOGLE_MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.MAPS_API_KEY ||
      ''
  ).trim();
}

function isQuotaExceededUpstream(httpStatus: number, payload: any): boolean {
  if (httpStatus === 429) return true;
  const errStatus = String(payload?.error?.status || payload?.status || '').toUpperCase();
  const errMsg = String(payload?.error?.message || payload?.message || '').toLowerCase();
  return (
    errStatus === 'RESOURCE_EXHAUSTED' ||
    errStatus === 'OVER_QUERY_LIMIT' ||
    errMsg.includes('quota') ||
    errMsg.includes('resource_exhausted')
  );
}

app.get('/api/maps/config', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const apiKey = resolveGoogleMapsServerKey();
  res.json({
    success: true,
    available: Boolean(apiKey),
    apiKey
  });
});

app.post('/api/maps/geocode', async (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const apiKey = resolveGoogleMapsServerKey();
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      unavailable: true,
      message: 'Google Maps API key is not configured on the server.'
    });
  }

  const address = String(req.body?.address || '').trim();
  if (!address) {
    return res.status(400).json({ success: false, message: 'Address string is required for geocoding.' });
  }

  try {
    const encodedAddr = encodeURIComponent(address);
    const url = new URL(`https://geocode.googleapis.com/v4/geocode/address/${encodedAddr}`);
    url.searchParams.set('regionCode', 'IN');
    url.searchParams.set('languageCode', 'en');

    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'results.placeId,results.location,results.formattedAddress,results.addressComponents',
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
      }
    });

    const data: any = await upstream.json().catch(() => ({}));
    if (isQuotaExceededUpstream(upstream.status, data)) {
      return res.status(429).json({
        success: false,
        quotaExceeded: true,
        status: 'RESOURCE_EXHAUSTED',
        message: 'Google Maps Geocoding quota reached.'
      });
    }
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        message: data?.error?.message || `Geocoding failed (HTTP ${upstream.status}).`
      });
    }

    const results = Array.isArray(data?.results) ? data.results : [];
    const first = results[0] || null;
    const lat = Number(first?.location?.latitude);
    const lng = Number(first?.location?.longitude);
    res.json({
      success: true,
      result:
        first && Number.isFinite(lat) && Number.isFinite(lng)
          ? {
              lat,
              lng,
              placeId: first.placeId || '',
              formattedAddress: first.formattedAddress || address,
              addressComponents: Array.isArray(first.addressComponents) ? first.addressComponents : []
            }
          : null,
      results
    });
  } catch (err: any) {
    res.status(502).json({
      success: false,
      message: err?.message || 'Network error calling Geocoding API.'
    });
  }
});

app.post('/api/maps/reverse-geocode', async (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const apiKey = resolveGoogleMapsServerKey();
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      unavailable: true,
      message: 'Google Maps API key is not configured on the server.'
    });
  }

  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ success: false, message: 'Valid lat and lng numbers are required.' });
  }

  try {
    const url = new URL('https://geocode.googleapis.com/v4/geocode/location');
    url.searchParams.set('location.latitude', String(lat));
    url.searchParams.set('location.longitude', String(lng));
    url.searchParams.set('regionCode', 'IN');
    url.searchParams.set('languageCode', 'en');

    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'results.placeId,results.location,results.formattedAddress,results.addressComponents',
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
      }
    });

    const data: any = await upstream.json().catch(() => ({}));
    if (isQuotaExceededUpstream(upstream.status, data)) {
      return res.status(429).json({
        success: false,
        quotaExceeded: true,
        status: 'RESOURCE_EXHAUSTED',
        message: 'Google Maps Reverse Geocoding quota reached.'
      });
    }
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        message: data?.error?.message || `Reverse geocoding failed (HTTP ${upstream.status}).`
      });
    }

    const results = Array.isArray(data?.results) ? data.results : [];
    const first = results[0] || null;
    res.json({
      success: true,
      result: first
        ? {
            lat,
            lng,
            placeId: first.placeId || '',
            formattedAddress: first.formattedAddress || '',
            addressComponents: Array.isArray(first.addressComponents) ? first.addressComponents : []
          }
        : null,
      results
    });
  } catch (err: any) {
    res.status(502).json({
      success: false,
      message: err?.message || 'Network error calling Reverse Geocoding API.'
    });
  }
});

app.post('/api/maps/compute-route', async (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const apiKey = resolveGoogleMapsServerKey();
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      unavailable: true,
      message: 'Google Maps API key is not configured on the server.'
    });
  }

  const originLat = Number(req.body?.origin?.lat);
  const originLng = Number(req.body?.origin?.lng);
  const destLat = Number(req.body?.destination?.lat);
  const destLng = Number(req.body?.destination?.lng);
  if (![originLat, originLng, destLat, destLng].every(Number.isFinite)) {
    return res.status(400).json({ success: false, message: 'Valid origin and destination lat/lng coordinates are required.' });
  }

  try {
    const upstream = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: { latitude: originLat, longitude: originLng }
          }
        },
        destination: {
          location: {
            latLng: { latitude: destLat, longitude: destLng }
          }
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        units: 'METRIC',
        languageCode: 'en-IN'
      })
    });

    const data: any = await upstream.json().catch(() => ({}));
    if (isQuotaExceededUpstream(upstream.status, data)) {
      return res.status(429).json({
        success: false,
        quotaExceeded: true,
        status: 'RESOURCE_EXHAUSTED',
        message: 'Google Maps Routes API quota reached.'
      });
    }
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        message: data?.error?.message || `Route calculation failed (HTTP ${upstream.status}).`
      });
    }

    const route = Array.isArray(data?.routes) ? data.routes[0] : null;
    if (!route) {
      return res.json({
        success: false,
        noRoute: true,
        message: 'No driving route found between the specified coordinates.'
      });
    }

    const distanceMeters = Number(route.distanceMeters) || 0;
    const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;
    const durMatch = String(route.duration || '').match(/^(\d+(?:\.\d+)?)s$/);
    const durationSeconds = durMatch ? Math.round(Number(durMatch[1])) : 0;
    const mins = Math.max(1, Math.round(durationSeconds / 60));
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    const durationText = hrs > 0 ? `${hrs} hr ${remMins} min` : `${mins} min`;

    res.json({
      success: true,
      distanceMeters,
      distanceKm,
      durationSeconds,
      durationText,
      encodedPolyline: route?.polyline?.encodedPolyline || ''
    });
  } catch (err: any) {
    res.status(502).json({
      success: false,
      message: err?.message || 'Network error calling Routes API.'
    });
  }
});

// ---------------------------------------------------------------------------
// TEAM MANAGEMENT STATE PERSISTENCE API (TASKS, TIME LOGS, SHIFT CONFIG)
// ---------------------------------------------------------------------------
app.get('/api/team/state', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const rawState = centralDb.getTeamState();
  const isPrivileged = auth.actor.isMainAdmin || auth.actor.role === 'ADMIN' || auth.actor.role === 'MANAGER';
  if (!isPrivileged) {
    const selfUid = String(auth.actor.uid || '').trim().toUpperCase();
    return res.json({
      success: true,
      scopedToSelf: true,
      teamState: {
        ...rawState,
        tasks: (rawState.tasks || []).filter((t: any) => String(t?.assignedTo || t?.staffId || '').trim().toUpperCase() === selfUid),
        timeLogs: (rawState.timeLogs || []).filter((l: any) => String(l?.staffId || l?.employeeId || '').trim().toUpperCase() === selfUid)
      }
    });
  }
  res.json({ success: true, teamState: rawState });
});

app.post('/api/team/state', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const eff = resolveEffectivePermissions(auth.actor);
  const allowShiftEdit = Boolean(
    auth.actor.isMainAdmin || auth.actor.role === 'ADMIN' || eff.menus['time-register']?.edit
  );
  const result = centralDb.syncTeamState(req.body || {}, auth.actor.uid, allowShiftEdit);
  res.json(result);
});

// ---------------------------------------------------------------------------
// CENTRALIZED EMPLOYEE ID HR INTEGRATION API (LEAVES, PAYROLL, PAYSLIPS, KPI)
// ---------------------------------------------------------------------------
app.get('/api/hr/state', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const isPrivileged = auth.actor.isMainAdmin || auth.actor.role === 'ADMIN' || auth.actor.role === 'MANAGER';
  const hrState = centralDb.getHrState(isPrivileged ? undefined : auth.actor.uid);
  res.json({ success: true, scopedToSelf: !isPrivileged, hrState });
});

app.post('/api/hr/state', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const isPrivileged = auth.actor.isMainAdmin || auth.actor.role === 'ADMIN' || auth.actor.role === 'MANAGER';
  const result = centralDb.syncHrState(req.body || {}, auth.actor.uid, isPrivileged);
  res.json(result);
});

app.post('/api/hr/leaves', (req, res) => {
  const auth = verifyMenuPermission(req, 'leave-management', 'add');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const isPrivileged = auth.actor.isMainAdmin || auth.actor.role === 'ADMIN' || auth.actor.role === 'MANAGER';
  const body = req.body || {};
  const targetEmployeeId = isPrivileged && body.employeeId
    ? String(body.employeeId).trim().toUpperCase()
    : auth.actor.uid;
  const result = centralDb.applyLeave(
    { ...body, employeeId: targetEmployeeId },
    auth.actor.uid,
    body.employeeName || auth.actor.name
  );
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/hr/leaves/:id/decision', (req, res) => {
  const auth = verifyMenuPermission(req, 'leave-management', 'approve');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const isPrivileged = auth.actor.isMainAdmin || auth.actor.role === 'ADMIN' || auth.actor.role === 'MANAGER';
  if (!isPrivileged) {
    return res.status(403).json({
      success: false,
      message: 'ACCESS DENIED: Only Manager or Administrator can approve or reject leave applications.'
    });
  }
  const decisionRaw = String(req.body?.decision || '').trim();
  const decision: 'Approved' | 'Rejected' = decisionRaw.toLowerCase() === 'approved' ? 'Approved' : 'Rejected';
  const result = centralDb.decideLeave(
    String(req.params.id),
    decision,
    auth.actor.uid,
    auth.actor.name,
    String(req.body?.remarks || '')
  );
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

app.post('/api/hr/payroll/run', (req, res) => {
  const auth = verifyMenuPermission(req, 'salary-payroll', 'add');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const isPrivileged = auth.actor.isMainAdmin || auth.actor.role === 'ADMIN' || auth.actor.role === 'MANAGER';
  if (!isPrivileged) {
    return res.status(403).json({
      success: false,
      message: 'ACCESS DENIED: Only Administrator or authorized Manager can process monthly payroll.'
    });
  }
  const result = centralDb.runEmployeePayroll(req.body || {}, auth.actor.uid);
  if (!result.success) {
    return res.status(result.duplicate ? 409 : 400).json(result);
  }
  res.json(result);
});

// ---------------------------------------------------------------------------
// EXTENDED ERP DEPARTMENT PERSISTENCE (SALES, INVENTORY, FINANCE, GROWTH)
// ---------------------------------------------------------------------------
app.get('/api/erp/extended', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  res.json({ success: true, extendedErp: centralDb.getExtendedErpState() });
});

app.post('/api/erp/extended', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const isAdmin = Boolean(auth.actor.isMainAdmin || auth.actor.role === 'ADMIN');
  const result = centralDb.syncExtendedErpState(req.body || {}, auth.actor.uid, isAdmin);
  res.json(result);
});

// ---------------------------------------------------------------------------
// AUTHORIZED MENU & SUBMENU CUSTOMIZATION API (11 FIXED DEPARTMENTS)
// ---------------------------------------------------------------------------
app.get('/api/erp/menu-config', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  res.json({ success: true, menuConfig: centralDb.getMenuConfig() });
});

app.post('/api/erp/menu-config', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const isAuthorized = Boolean(
    auth.actor.isMainAdmin ||
    auth.actor.role === 'ADMIN' ||
    hasMenuPermission(auth.actor, 'menu-management', 'edit')
  );
  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'ACCESS DENIED: Only authorized Administration users can customize ERP menus.'
    });
  }
  const result = centralDb.saveMenuConfig(req.body || {}, auth.actor.uid);
  res.json(result);
});

app.put('/api/erp/menu-config', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const isAuthorized = Boolean(
    auth.actor.isMainAdmin ||
    auth.actor.role === 'ADMIN' ||
    hasMenuPermission(auth.actor, 'menu-management', 'edit')
  );
  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'ACCESS DENIED: Only authorized Administration users can customize ERP menus.'
    });
  }
  const result = centralDb.saveMenuConfig(req.body || {}, auth.actor.uid);
  res.json(result);
});

app.post('/api/erp/menu-config/reset', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const isAuthorized = Boolean(
    auth.actor.isMainAdmin ||
    auth.actor.role === 'ADMIN' ||
    hasMenuPermission(auth.actor, 'menu-management', 'edit')
  );
  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'ACCESS DENIED: Only authorized Administration users can restore default menus.'
    });
  }
  const result = centralDb.resetMenuConfig(auth.actor.uid);
  res.json(result);
});

// ---------------------------------------------------------------------------
// TEAM COUNTER CHAT API (LIST, SEND, EDIT, DELETE)
// ---------------------------------------------------------------------------
app.get('/api/chats', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const channel = req.query.channel ? String(req.query.channel) : 'all';
  const chats = centralDb.listChats(channel);
  res.json({ success: true, chats, total: chats.length });
});

app.post('/api/chats', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const result = centralDb.createChatMessage(req.body || {}, auth.actor);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.put('/api/chats/:id', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const messageText = String(req.body?.message || '');
  const result = centralDb.editChatMessage(String(req.params.id), messageText, auth.actor);
  if (!result.success) return res.status(result.message.includes('only edit') ? 403 : 400).json(result);
  res.json(result);
});

app.delete('/api/chats/:id', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const result = centralDb.deleteChatMessage(String(req.params.id), auth.actor);
  if (!result.success) return res.status(result.message.includes('only delete') ? 403 : 404).json(result);
  res.json(result);
});

// ---------------------------------------------------------------------------
// CUSTOMER MASTER, AUTO-FETCH & ADMIN DUPLICATE MERGE
// ---------------------------------------------------------------------------
app.get('/api/customers', (req, res) => {
  const q = String(req.query.q || '');
  const customers = centralDb.listCustomers(q);
  res.json({ success: true, customers, total: customers.length });
});

app.get('/api/customers/autofetch', (req, res) => {
  const lookup = String(req.query.q || req.query.uid || '');
  if (!lookup) return res.status(400).json({ success: false, message: 'Provide UID, Customer ID, or Mobile.' });
  const match = centralDb.getCustomerAutoFetch(lookup);
  if (!match) return res.status(404).json({ success: false, message: 'Customer not found.' });
  res.json({ success: true, ...match });
});

app.post('/api/customers', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const result = centralDb.upsertCustomer(req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/customers/merge', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const { sourceId, targetId } = req.body;
  const result = centralDb.mergeCustomers(String(sourceId || ''), String(targetId || ''), auth.actor.uid);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.delete('/api/customers/:id', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = centralDb.deleteCustomer(String(req.params.id), auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

// ---------------------------------------------------------------------------
// APPLICATION WORKFLOW & TIMELINE
// ---------------------------------------------------------------------------
app.get('/api/applications', (req, res) => {
  const apps = centralDb.listApplications({
    status: req.query.status ? String(req.query.status) : undefined,
    staffUid: req.query.staffUid ? String(req.query.staffUid) : undefined,
    customerId: req.query.customerId ? String(req.query.customerId) : undefined,
    q: req.query.q ? String(req.query.q) : undefined
  });
  res.json({ success: true, applications: apps, total: apps.length });
});

app.post('/api/applications', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const result = centralDb.createApplication(req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.patch('/api/applications/:id', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const result = centralDb.updateApplication(String(req.params.id), req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

// ---------------------------------------------------------------------------
// PROTECTED DOCUMENT VAULT
// ---------------------------------------------------------------------------
app.get('/api/documents', (req, res) => {
  const auth = resolveActor(req);
  const allDocs = centralDb.listDocuments();
  if (auth.ok && auth.actor) {
    const isPrivileged = auth.actor.isMainAdmin || auth.actor.role === 'ADMIN' || auth.actor.role === 'MANAGER';
    if (!isPrivileged) {
      const selfUid = String(auth.actor.uid || '').trim().toUpperCase();
      const filtered = allDocs.filter((d: any) => {
        // Customer/application docs remain accessible to counter staff; personal employee docs are scoped to owner
        const ownerUid = String(d?.userId || '').trim().toUpperCase();
        if (ownerUid) return ownerUid === selfUid;
        return true;
      });
      return res.json({ success: true, documents: filtered, scopedToSelf: true });
    }
  }
  res.json({ success: true, documents: allDocs });
});

app.post('/api/documents/upload', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const result = centralDb.saveUploadedDocument({ ...(req.body || {}), actorUid: auth.actor.uid });
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.get('/api/documents/:id/download', (req, res) => {
  const doc = centralDb.getDocumentById(String(req.params.id));
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });
  const filePath = centralDb.getDocumentFilePath(doc);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Stored file missing on disk.' });
  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
  res.sendFile(filePath);
});

app.delete('/api/documents/:id', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = centralDb.deleteDocument(String(req.params.id), auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

// ---------------------------------------------------------------------------
// UNIVERSAL SERVER-SIDE SEARCH & PAGINATION
// ---------------------------------------------------------------------------
app.get('/api/search', (req, res) => {
  const result = centralDb.universalSearch({
    q: req.query.q ? String(req.query.q) : '',
    type: req.query.type ? String(req.query.type) : 'all',
    district: req.query.district ? String(req.query.district) : undefined,
    blockOrMunicipality: req.query.blockOrMunicipality ? String(req.query.blockOrMunicipality) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
    dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
    dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined,
    sort: (req.query.sort as any) || 'relevance',
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
    actorRole: req.headers['x-actor-role'] ? String(req.headers['x-actor-role']) : 'STAFF'
  });
  res.json({ success: true, ...result });
});

// ---------------------------------------------------------------------------
// MANDATORY ATTENDANCE PHOTO GALLERY, GPS MONITORING & TIME REGISTER APIs
// ---------------------------------------------------------------------------
function canViewAllStaffPhotos(actor: UserRecord): boolean {
  if (actor.uid === MAIN_ADMIN_UID || actor.isMainAdmin || actor.role === 'ADMIN') return true;
  if (actor.role === 'MANAGER') {
    const eff = resolveEffectivePermissions(actor);
    return Boolean(eff.extra.canViewAllAttendancePhotos);
  }
  return false; // Staff NEVER sees another staff member's attendance photos or GPS history
}

app.get('/api/attendance/records', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const actor = auth.actor;
  const isStaffScoped = actor.role !== 'ADMIN' && !actor.isMainAdmin && actor.role !== 'MANAGER';
  const requestedStaff = req.query.staffId ? String(req.query.staffId) : undefined;
  const eff = resolveEffectivePermissions(actor);
  const canViewAll = actor.role === 'ADMIN' || actor.isMainAdmin || (actor.role === 'MANAGER' && eff.menus['staff-attendance']?.view);

  const records = centralDb.listAttendanceRecords({
    date: req.query.date ? String(req.query.date) : undefined,
    month: req.query.month ? String(req.query.month) : undefined,
    staffId: canViewAll && !isStaffScoped ? requestedStaff : actor.uid
  });
  res.json({ success: true, records, total: records.length, scopedToSelf: !canViewAll || isStaffScoped });
});

app.post('/api/attendance/records', (req, res) => {
  const auth = verifyMenuPermission(req, 'staff-attendance', 'add');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const actor = auth.actor;
  const body = req.body || {};
  const targetStaffId = String(body.staffId || actor.uid).trim().toUpperCase();
  const isAdminOrMgr = actor.role === 'ADMIN' || actor.isMainAdmin || actor.role === 'MANAGER';
  if (!isAdminOrMgr && targetStaffId !== actor.uid.toUpperCase()) {
    return res.status(403).json({ success: false, message: 'Staff can only record their own attendance.' });
  }
  const saved = centralDb.upsertAttendanceRecord({ ...body, staffId: targetStaffId }, actor.uid);
  res.json({ success: true, record: saved });
});

app.get('/api/attendance/photos', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const actor = auth.actor;
  const allowAll = canViewAllStaffPhotos(actor);

  const requestedStaffId = req.query.staffId ? String(req.query.staffId) : 'all';
  const effectiveStaffFilter = allowAll ? requestedStaffId : actor.uid;

  const photos = centralDb.listAttendancePhotos({
    date: req.query.date ? String(req.query.date) : undefined,
    fromDate: req.query.fromDate ? String(req.query.fromDate) : undefined,
    toDate: req.query.toDate ? String(req.query.toDate) : undefined,
    staffId: effectiveStaffFilter,
    eventType: req.query.eventType ? String(req.query.eventType) : 'ALL',
    q: req.query.q ? String(req.query.q) : undefined
  });

  res.json({
    success: true,
    photos,
    total: photos.length,
    canViewAllStaffPhotos: allowAll,
    canDeletePhotos: actor.role === 'ADMIN' || actor.isMainAdmin || actor.uid === MAIN_ADMIN_UID
  });
});

app.get('/api/attendance/photos/:id/image', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const actor = auth.actor;
  const record = centralDb.getAttendancePhotoById(String(req.params.id));
  if (!record) return res.status(404).json({ success: false, message: 'Attendance photo not found.' });

  const allowAll = canViewAllStaffPhotos(actor);
  if (!allowAll && record.staffId.toUpperCase() !== actor.uid.toUpperCase()) {
    centralDb.logAudit(
      'UNAUTHORIZED_PHOTO_ACCESS',
      `Blocked ${actor.uid} (${actor.role}) from viewing Attendance Photo ${record.id} belonging to ${record.staffId}`,
      actor.uid
    );
    return res.status(403).json({
      success: false,
      message: 'ACCESS DENIED: You are only authorized to view your own attendance photos.'
    });
  }

  const filePath = centralDb.getAttendancePhotoFilePath(record);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Stored photo file missing.' });

  const isDownload = req.query.download === '1' || req.query.download === 'true';
  const safeName = `MUN_Attendance_${record.staffId}_${record.date}_${record.eventType}_${record.id}.jpg`;
  res.setHeader('Content-Type', record.mimeType || 'image/jpeg');
  res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${safeName}"`);
  res.sendFile(filePath);
});

app.post('/api/attendance/photos', (req, res) => {
  const auth = verifyMenuPermission(req, 'gps-attendance', 'add');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const actor = auth.actor;
  const body = req.body || {};

  const isAdminOrMgr = actor.role === 'ADMIN' || actor.isMainAdmin || actor.role === 'MANAGER';
  const targetStaffId = isAdminOrMgr && body.staffId ? String(body.staffId).trim().toUpperCase() : actor.uid;
  const users = loadUsers();
  const targetUser = users.find(u => u.uid && u.uid.toUpperCase() === targetStaffId);

  const result = centralDb.saveAttendancePhoto({
    staffId: targetStaffId,
    staffName: targetUser?.name || body.staffName || actor.name,
    staffRole: targetUser?.designation || targetUser?.role || actor.role,
    eventType: body.eventType === 'OUT' ? 'OUT' : 'IN',
    date: body.date,
    time24: body.time24,
    time12: body.time12,
    istTimestamp: body.istTimestamp,
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    accuracy: Number(body.accuracy || 0),
    photoDataUrl: String(body.photoDataUrl || ''),
    captureMethod: String(body.captureMethod || ''),
    gpsVerifiedLive: body.gpsVerifiedLive === true,
    gpsMatchDistanceMeters: Number(body.gpsMatchDistanceMeters || 0),
    photoCapturedAt: body.photoCapturedAt ? String(body.photoCapturedAt) : undefined,
    gpsCapturedAt: body.gpsCapturedAt ? String(body.gpsCapturedAt) : undefined,
    consentAccepted: Boolean(body.consentAccepted),
    notes: body.notes,
    actorUid: actor.uid
  });

  if (!result.success || !result.photo) return res.status(400).json(result);

  // Sync Attendance Record cleanly on server
  const p = result.photo;
  const existing = centralDb.listAttendanceRecords({ date: p.date, staffId: p.staffId })[0];
  centralDb.upsertAttendanceRecord(
    {
      date: p.date,
      staffId: p.staffId,
      staffName: p.staffName,
      role: p.staffRole,
      status: existing?.status && existing.status !== 'Absent' && existing.status !== 'Leave' ? existing.status : 'Present',
      inTime24: p.eventType === 'IN' ? p.time24 : (existing?.inTime24 || p.time24),
      outTime24: p.eventType === 'OUT' ? p.time24 : (existing?.outTime24 || ''),
      clockIn: p.eventType === 'IN' ? p.time12 : (existing?.clockIn || p.time12),
      clockOut: p.eventType === 'OUT' ? p.time12 : (existing?.clockOut || '-'),
      inGpsLat: p.eventType === 'IN' ? p.latitude : existing?.inGpsLat,
      inGpsLng: p.eventType === 'IN' ? p.longitude : existing?.inGpsLng,
      outGpsLat: p.eventType === 'OUT' ? p.latitude : existing?.outGpsLat,
      outGpsLng: p.eventType === 'OUT' ? p.longitude : existing?.outGpsLng,
      inPhotoId: p.eventType === 'IN' ? p.id : existing?.inPhotoId,
      outPhotoId: p.eventType === 'OUT' ? p.id : existing?.outPhotoId,
      notes: p.notes || existing?.notes || `GPS ${p.eventType} Verified`
    },
    actor.uid
  );

  res.json(result);
});

app.post('/api/attendance/photos/:id/verify', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  if (!canViewAllStaffPhotos(auth.actor)) {
    return res.status(403).json({
      success: false,
      message: 'ACCESS DENIED: Only Administrator or permitted Manager can verify Staff Attendance Photos.'
    });
  }
  const statusRaw = String(req.body?.verifiedStatus || 'VERIFIED').toUpperCase();
  const verifiedStatus: 'VERIFIED' | 'FLAGGED' | 'PENDING' =
    statusRaw === 'FLAGGED' ? 'FLAGGED' : statusRaw === 'PENDING' ? 'PENDING' : 'VERIFIED';
  const result = centralDb.verifyAttendancePhoto(String(req.params.id), auth.actor.uid, verifiedStatus, req.body?.notes);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

app.delete('/api/attendance/photos/:id', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({
      success: false,
      message: 'ACCESS DENIED: Only Administrator has permission to delete Attendance Photos.'
    });
  }
  const reason = String(req.body?.reason || req.query?.reason || '').trim();
  const result = centralDb.deleteAttendancePhoto(String(req.params.id), auth.actor.uid, auth.actor.name, reason);
  if (!result.success) return res.status(result.message.includes('Reason') ? 400 : 404).json(result);
  res.json(result);
});

// ---------------------------------------------------------------------------
// COUNTER DAY BOOK SERVER LEDGER (CASH LIMIT + ACTOR AUDIT + DELETE REASON)
// ---------------------------------------------------------------------------
app.get('/api/daybook', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const allowed =
    hasMenuPermission(auth.actor, 'counter-daybook', 'view') ||
    hasMenuPermission(auth.actor, 'daily-opening-cash', 'view') ||
    hasMenuPermission(auth.actor, 'daily-closing-cash', 'view') ||
    hasMenuPermission(auth.actor, 'cash-reports', 'view');
  if (!allowed) {
    return res.status(403).json({ success: false, message: 'ACCESS DENIED: Counter Day Book & Cash Records are restricted.' });
  }
  const filters = {
    date: req.query.date ? String(req.query.date) : undefined,
    fromDate: req.query.fromDate ? String(req.query.fromDate) : undefined,
    toDate: req.query.toDate ? String(req.query.toDate) : undefined
  };
  res.json({
    success: true,
    txns: centralDb.listCounterCashTxns(filters),
    snapshots: centralDb.listCounterDaybookSnapshots(filters)
  });
});

app.post('/api/daybook/txn', (req, res) => {
  const auth = verifyMenuPermission(req, 'counter-daybook', 'add');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const amount = Math.max(0, Number(req.body?.amount) || 0);
  if (amount <= 0) return res.status(400).json({ success: false, message: 'Valid cash amount (> ₹0) is required.' });
  const eff = resolveEffectivePermissions(auth.actor);
  if (eff.extra.cashOperationLimit > 0 && amount > eff.extra.cashOperationLimit) {
    return res.status(403).json({
      success: false,
      limitExceeded: true,
      message: `Cash Operation Limit Exceeded: Your single-entry limit is ₹${eff.extra.cashOperationLimit}. Contact Administrator.`
    });
  }
  const txn = centralDb.addCounterCashTxn(req.body || {}, { uid: auth.actor.uid, name: auth.actor.name });
  res.json({ success: true, txn });
});

app.delete('/api/daybook/txn/:id', (req, res) => {
  const auth = verifyMenuPermission(req, 'counter-daybook', 'delete');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const reason = String(req.body?.reason || req.query?.reason || '').trim();
  const result = centralDb.deleteCounterCashTxn(String(req.params.id), auth.actor.uid, auth.actor.name, reason);
  if (!result.success) return res.status(result.message.includes('Reason') ? 400 : 404).json(result);
  res.json(result);
});

app.post('/api/daybook/snapshot', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const isClosing = Boolean(req.body?.closingSaved);
  const menu = isClosing ? 'daily-closing-cash' : 'daily-opening-cash';
  if (!hasMenuPermission(auth.actor, menu, 'add') && !hasMenuPermission(auth.actor, 'counter-daybook', 'add')) {
    return res.status(403).json({ success: false, message: `ACCESS DENIED: No permission for ${menu}.` });
  }
  const snapshot = centralDb.saveCounterDaybookSnapshot(req.body || {}, { uid: auth.actor.uid, name: auth.actor.name });
  res.json({ success: true, snapshot });
});

// ---------------------------------------------------------------------------
// 90-DAY FOLLOW-UP & CASE MANAGEMENT SERVER LEDGER
// ---------------------------------------------------------------------------
app.get('/api/followup-cases', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  if (!hasMenuPermission(auth.actor, 'followups', 'view') && !hasMenuPermission(auth.actor, 'customers', 'view')) {
    return res.status(403).json({ success: false, message: 'ACCESS DENIED: Follow-up case access is restricted.' });
  }
  res.json({ success: true, cases: centralDb.listFollowupCases() });
});

app.post('/api/followup-cases', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  if (!hasMenuPermission(auth.actor, 'followups', 'add') && !hasMenuPermission(auth.actor, 'customers', 'add')) {
    return res.status(403).json({ success: false, message: 'ACCESS DENIED: Follow-up case creation is restricted.' });
  }
  const caseRecord = centralDb.upsertFollowupCase(req.body || {}, auth.actor.uid);
  res.json({ success: true, caseRecord });
});

app.post('/api/followup-cases/:id/timeline', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  if (!hasMenuPermission(auth.actor, 'followups', 'edit') && !hasMenuPermission(auth.actor, 'followups', 'add')) {
    return res.status(403).json({ success: false, message: 'ACCESS DENIED: Adding follow-up entries is restricted.' });
  }
  const result = centralDb.appendFollowupCaseTimeline(String(req.params.id), req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

app.delete('/api/followup-cases/:id', (req, res) => {
  const auth = verifyMenuPermission(req, 'followups', 'delete');
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = centralDb.deleteFollowupCase(String(req.params.id), auth.actor.uid);
  res.json(result);
});

app.post('/api/followup-cases/:id/status', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  if (!hasMenuPermission(auth.actor, 'followups', 'edit') && !hasMenuPermission(auth.actor, 'customers', 'edit')) {
    return res.status(403).json({ success: false, message: 'ACCESS DENIED: Updating case status is restricted.' });
  }
  const result = centralDb.updateCaseStatusOnly(String(req.params.id), req.body || {}, auth.actor.uid, auth.actor.name || auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

app.post('/api/followup-cases/:id/reopen', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  if (!hasMenuPermission(auth.actor, 'followups', 'edit')) {
    return res.status(403).json({ success: false, message: 'ACCESS DENIED: Reopening cases is restricted.' });
  }
  const result = centralDb.reopenFollowupCase(String(req.params.id), String(req.body?.reason || ''), auth.actor.uid, auth.actor.name || auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

app.post('/api/followup-cases/:id/reschedule', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  if (!hasMenuPermission(auth.actor, 'followups', 'edit')) {
    return res.status(403).json({ success: false, message: 'ACCESS DENIED: Rescheduling cases is restricted.' });
  }
  const result = centralDb.rescheduleFollowupCase(String(req.params.id), req.body || {}, auth.actor.uid, auth.actor.name || auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

app.get('/api/90day/bootstrap', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  res.json({ success: true, ...centralDb.get90DayBootstrap() });
});

app.post('/api/admin-options', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const result = centralDb.upsertAdminOption(req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/admin-options/inline-status', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const label = String(req.body?.label || '').trim();
  const result = centralDb.upsertAdminOption({ category: 'application_status', label, isActive: true }, auth.actor.uid);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.put('/api/admin-options/:id/toggle', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = centralDb.toggleAdminOptionActive(String(req.params.id), auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

app.delete('/api/admin-options/:id', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const result = centralDb.deleteAdminOption(String(req.params.id), auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

app.post('/api/admin-options/restore-defaults', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = centralDb.restoreDefaultAdminOptions(req.body?.category ? String(req.body.category) : undefined, auth.actor.uid);
  res.json(result);
});

app.post('/api/followup-schedule', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = centralDb.upsertFollowupScheduleMilestone(req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.put('/api/followup-schedule/:id/toggle', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = centralDb.toggleFollowupScheduleMilestone(String(req.params.id), auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

app.put('/api/followup-schedule/reorder', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(String) : [];
  const result = centralDb.reorderFollowupSchedule(orderedIds, auth.actor.uid);
  res.json(result);
});

app.delete('/api/followup-schedule/:id', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = centralDb.deleteFollowupScheduleMilestone(String(req.params.id), auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

app.post('/api/followup-schedule/restore-defaults', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = centralDb.restoreDefaultFollowupSchedule(auth.actor.uid);
  res.json(result);
});

app.get('/api/grievances', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const ref = req.query.caseId ? String(req.query.caseId) : (req.query.applicationId ? String(req.query.applicationId) : undefined);
  res.json({ success: true, grievances: centralDb.listGrievances(ref) });
});

app.post('/api/grievances', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const result = centralDb.upsertGrievance(req.body || {}, auth.actor.uid, auth.actor.name || auth.actor.uid);
  res.json(result);
});

app.get('/api/reminders', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const ref = req.query.caseId ? String(req.query.caseId) : undefined;
  res.json({ success: true, reminders: centralDb.listReminders(ref) });
});

app.post('/api/reminders', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const result = centralDb.upsertReminder(req.body || {}, auth.actor.uid);
  res.json(result);
});

// ---------------------------------------------------------------------------
// BACKUP EXPORT / AUTO-SNAPSHOT / RESTORE, DELETE HISTORY & AUDIT LOGS
// ---------------------------------------------------------------------------
function hasBackupOrSettingsPermission(actor: UserRecord): boolean {
  if (actor.uid === MAIN_ADMIN_UID || actor.isMainAdmin || actor.role === 'ADMIN') return true;
  const eff = resolveEffectivePermissions(actor);
  return Boolean(eff.extra.canManageBackupSettings);
}

app.get('/api/backup/export', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  if (!hasBackupOrSettingsPermission(auth.actor)) {
    return res.status(403).json({
      success: false,
      message: 'ACCESS DENIED: Administration permission is required to export or change Backups/Settings.'
    });
  }
  res.json({ success: true, snapshot: centralDb.exportFullBackup(auth.actor.uid) });
});

app.get('/api/backup/snapshots', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  if (!hasBackupOrSettingsPermission(auth.actor)) {
    return res.status(403).json({ success: false, message: 'ACCESS DENIED: Administration permission required for Backup Snapshots.' });
  }
  res.json({ success: true, snapshots: centralDb.listBackupSnapshots() });
});

app.post('/api/backup/auto-snapshot', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  if (!hasBackupOrSettingsPermission(auth.actor)) {
    return res.status(403).json({ success: false, message: 'ACCESS DENIED: Administration permission required to run Backups.' });
  }
  const meta = centralDb.createAutoBackupSnapshot(auth.actor.uid, 'MANUAL');
  res.json({ success: true, snapshot: meta, message: `Backup snapshot ${meta.id} saved securely.` });
});

app.get('/api/backup/snapshots/:id/download', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  if (!hasBackupOrSettingsPermission(auth.actor)) {
    return res.status(403).json({ success: false, message: 'ACCESS DENIED.' });
  }
  const filePath = centralDb.getBackupSnapshotFilePath(String(req.params.id));
  if (!filePath) return res.status(404).json({ success: false, message: 'Snapshot not found.' });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
  res.sendFile(filePath);
});

app.post('/api/backup/restore', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const eff = resolveEffectivePermissions(auth.actor);
  if (auth.actor.uid !== MAIN_ADMIN_UID && !auth.actor.isMainAdmin && auth.actor.role !== 'ADMIN' && !eff.extra.canManageBackupSettings) {
    return res.status(403).json({
      success: false,
      message: 'ACCESS DENIED: Only Administration can restore backups.'
    });
  }
  const result = centralDb.restoreBackup(req.body, auth.actor.uid);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/admin/clear-operational-data', (req, res) => {
  const auth = verifyMainAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = centralDb.clearOperationalData(auth.actor.uid);
  res.json(result);
});

// Relational SQLite Database Health, Backup & Restore + System Security Settings
app.get('/api/system-settings', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  res.json({ success: true, settings: relationalDb.getAllSettings() });
});

app.post('/api/system-settings', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const settings = relationalDb.updateSettings(req.body || {}, auth.actor.uid);
  res.json({ success: true, settings, message: 'System security configuration saved.' });
});

app.get('/api/admin/db-health', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  res.json({ success: true, health: relationalDb.getRelationalDbHealth() });
});

app.post('/api/admin/db-backup', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const backup = relationalDb.createSqliteBackup(auth.actor.uid);
  res.json({
    success: true,
    backup: { fileName: backup.fileName, sizeBytes: backup.sizeBytes },
    message: `SQLite relational backup ${backup.fileName} created.`
  });
});

app.get('/api/admin/db-backup/:fileName/download', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const filePath = relationalDb.getSqliteBackupFilePath(String(req.params.fileName));
  if (!filePath) return res.status(404).json({ success: false, message: 'SQLite backup file not found.' });
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
  res.sendFile(filePath);
});

app.post('/api/admin/db-restore', (req, res) => {
  const auth = verifyMainAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = relationalDb.restoreSqliteBackupFile(String(req.body?.fileName || ''), auth.actor.uid);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.get('/api/security/delete-history', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const isAdmin = auth.actor.role === 'ADMIN' || auth.actor.isMainAdmin || hasBackupOrSettingsPermission(auth.actor);
  if (!isAdmin) {
    return res.status(403).json({ success: false, message: 'ACCESS DENIED: Security Delete History is restricted to Administration.' });
  }
  const targetType = req.query.targetType ? String(req.query.targetType) : 'ALL';
  const records = centralDb.listDeleteHistory(targetType);
  res.json({ success: true, records, total: records.length });
});

app.post('/api/security/delete-history', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const { targetType, targetId, targetSummary, reason, metadata } = req.body || {};
  const cleanReason = String(reason || '').trim();
  if (cleanReason.length < 3) {
    return res.status(400).json({ success: false, message: 'Delete Reason (minimum 3 characters) is required.' });
  }
  const rec = centralDb.recordDeleteHistory({
    targetType: targetType || 'OTHER',
    targetId: String(targetId || 'UNKNOWN'),
    targetSummary: String(targetSummary || 'Record Deleted'),
    reason: cleanReason,
    deletedByUid: auth.actor.uid,
    deletedByName: auth.actor.fullName,
    metadata
  });
  res.json({ success: true, record: rec });
});

app.get('/api/audit-logs', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({ success: false, message: auth.error || 'ACCESS DENIED: Audit Logs restricted to Administration.' });
  }
  const limit = Number(req.query.limit || 300);
  const action = req.query.action ? String(req.query.action) : undefined;
  res.json({ success: true, logs: relationalDb.listAuditLogs(limit, action) });
});

// SMS Gateway Settings
app.get('/api/sms/config', (req, res) => {
  const config = loadSmsConfig();
  res.json({
    success: true,
    config: {
      provider: config.provider,
      apiKey: config.apiKey ? '••••••••' + config.apiKey.slice(-4) : '',
      senderId: config.senderId,
      apiUrl: config.apiUrl,
      fromPhone: config.fromPhone,
      enabled: config.enabled,
      isConfigured: isSmsGatewayConfigured()
    }
  });
});

app.post('/api/sms/config', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const { provider, apiKey, senderId, apiUrl, accountSid, authToken, fromPhone, enabled } = req.body;
  const existing = loadSmsConfig();
  const updated: SmsConfig = {
    provider: provider || existing.provider || 'fast2sms',
    apiKey: apiKey && !apiKey.includes('••••') ? apiKey : existing.apiKey,
    senderId: senderId !== undefined ? senderId : existing.senderId,
    apiUrl: apiUrl !== undefined ? apiUrl : existing.apiUrl,
    accountSid: accountSid && !accountSid.includes('••••') ? accountSid : existing.accountSid,
    authToken: authToken && !authToken.includes('••••') ? authToken : existing.authToken,
    fromPhone: fromPhone !== undefined ? fromPhone : existing.fromPhone,
    enabled: enabled !== undefined ? enabled : true
  };
  saveSmsConfig(updated);
  centralDb.logAudit('SMS_CONFIG_UPDATE', `SMS Gateway updated for provider: ${updated.provider}`, auth.actor.uid);
  res.json({ success: true, message: 'SMS Gateway configuration updated successfully.' });
});

app.post('/api/sms/test', async (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const targetPhone = req.body?.phone || '8101352105';
  const testOtp = String(Math.floor(100000 + Math.random() * 900000));
  const result = await dispatchSms(targetPhone, `MUN COMPUTER SMS Gateway Test: Your code is ${testOtp}.`, testOtp);
  if (result.success) return res.json({ success: true, message: result.message });
  return res.status(502).json({ success: false, message: result.message });
});

// ---------------------------------------------------------------------------
// ADMIN-CONTROLLED CUSTOM UPI QR CODE & PAYMENT SETTINGS
// ---------------------------------------------------------------------------
app.get('/api/settings/upi', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const settings = loadUpiSettings();
  res.json({ success: true, settings });
});

app.post('/api/settings/upi', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });

  const body = req.body || {};
  const existing = loadUpiSettings();
  const upiId = body.upiId !== undefined ? String(body.upiId).trim() : existing.upiId;
  const upiDisplayName = body.upiDisplayName !== undefined ? String(body.upiDisplayName).trim() : existing.upiDisplayName;
  const paymentInstructions = body.paymentInstructions !== undefined ? String(body.paymentInstructions).trim() : existing.paymentInstructions;
  const clearQr = body.clearQr === true;

  let qrImageDataUrl = existing.qrImageDataUrl;
  let qrImageMime = existing.qrImageMime;
  let qrFileName = existing.qrFileName;

  if (clearQr) {
    qrImageDataUrl = '';
    qrImageMime = '';
    qrFileName = '';
  } else if (typeof body.qrImageDataUrl === 'string' && body.qrImageDataUrl.length > 0) {
    const match = body.qrImageDataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR image format. Only JPG, JPEG, PNG, and WebP images are supported.'
      });
    }
    const approxBytes = Math.ceil((match[2].length * 3) / 4);
    if (approxBytes > 4 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'QR image file exceeds 4 MB limit.'
      });
    }
    qrImageMime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
    qrImageDataUrl = body.qrImageDataUrl;
    qrFileName = String(body.qrFileName || 'upi-qr-code').trim().slice(0, 140);
  }

  const updated: UpiPaymentSettings = {
    upiId,
    upiDisplayName,
    paymentInstructions,
    qrImageDataUrl,
    qrImageMime,
    qrFileName,
    updatedAt: new Date().toISOString(),
    updatedByUid: auth.actor.uid,
    updatedByName: auth.actor.name
  };

  saveUpiSettings(updated);
  centralDb.logAudit(
    'UPI_SETTINGS_UPDATE',
    `Admin ${auth.actor.name} updated UPI Payment Settings (UPI ID: ${upiId || 'Not Set'}, QR: ${qrImageDataUrl ? 'Uploaded' : 'Cleared/Empty'})`,
    auth.actor.uid
  );
  res.json({ success: true, settings: updated, message: 'UPI Payment Settings saved successfully.' });
});

app.delete('/api/settings/upi/qr', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const existing = loadUpiSettings();
  const updated: UpiPaymentSettings = {
    ...existing,
    qrImageDataUrl: '',
    qrImageMime: '',
    qrFileName: '',
    updatedAt: new Date().toISOString(),
    updatedByUid: auth.actor.uid,
    updatedByName: auth.actor.name
  };
  saveUpiSettings(updated);
  centralDb.logAudit('UPI_QR_REMOVED', `Admin ${auth.actor.name} removed uploaded UPI QR Code image.`, auth.actor.uid);
  res.json({ success: true, settings: updated, message: 'UPI QR Code removed.' });
});

// ---------------------------------------------------------------------------
// ALL-INDIA LOCATION + MURSHIDABAD MASTER & DOMKAL MUNICIPALITY 21-WARD APIs
// ---------------------------------------------------------------------------
app.get('/api/locations/states', (req, res) => {
  const states = locationService.getStates();
  res.json({ success: true, states, count: states.length });
});

app.get('/api/locations/districts', (req, res) => {
  const state = String(req.query.state || '');
  if (!state) return res.json({ success: true, districts: [], count: 0 });
  const districts = locationService.getDistricts(state);
  res.json({ success: true, state, districts, count: districts.length });
});

app.get('/api/locations/villages', async (req, res) => {
  const state = String(req.query.state || '');
  const district = String(req.query.district || '');
  const q = String(req.query.q || '');
  if (!district) return res.json({ success: true, villages: [], entries: [] });
  const result = await locationService.getVillages(state, district, q);
  res.json({ success: true, ...result });
});

app.get('/api/locations/post-offices', (req, res) => {
  const result = locationService.getPostOffices(
    String(req.query.state || ''),
    String(req.query.district || ''),
    String(req.query.village || '')
  );
  res.json({ success: true, ...result });
});

app.get('/api/locations/police-stations', (req, res) => {
  const result = locationService.getPoliceStations(
    String(req.query.state || ''),
    String(req.query.district || ''),
    String(req.query.village || ''),
    String(req.query.postOffice || '')
  );
  res.json({ success: true, ...result });
});

app.get('/api/locations/pincodes', (req, res) => {
  const result = locationService.getPincodes(
    String(req.query.state || ''),
    String(req.query.district || ''),
    String(req.query.village || ''),
    String(req.query.postOffice || ''),
    String(req.query.policeStation || '')
  );
  res.json({ success: true, ...result });
});

app.get('/api/locations/pincode/:pin', async (req, res) => {
  const result = await locationService.lookupByPincode(String(req.params.pin || ''));
  res.json({ success: true, ...result });
});

app.get('/api/locations/lookup-village', (req, res) => {
  const q = String(req.query.q || '');
  const district = String(req.query.district || '');
  const state = String(req.query.state || '');
  const result = locationService.lookupByVillage(q, district, state);
  res.json({ success: true, ...result });
});

app.post('/api/locations/custom', (req, res) => {
  const result = locationService.addCustomLocation(req.body || {});
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

// Murshidabad Master & Domkal Municipality (LGD 273007) Routes
app.get('/api/locations/murshidabad/overview', (req, res) => {
  res.json({ success: true, ...murshidabadMaster.getOverview() });
});

app.get('/api/locations/murshidabad/hierarchy', (req, res) => {
  const data = murshidabadMaster.getHierarchy({
    areaType: req.query.areaType === 'URBAN' ? 'URBAN' : 'RURAL',
    subdivision: req.query.subdivision ? String(req.query.subdivision) : undefined,
    block: req.query.block ? String(req.query.block) : undefined,
    gp: req.query.gp ? String(req.query.gp) : undefined,
    municipality: req.query.municipality
      ? String(req.query.municipality)
      : (req.query.municipalityLgd ? String(req.query.municipalityLgd) : 'Domkal Municipality'),
    ward: req.query.wardCode
      ? String(req.query.wardCode)
      : (req.query.ward ? String(req.query.ward) : undefined),
    mouza: req.query.mouza ? String(req.query.mouza) : undefined
  });
  res.json({ success: true, ...data });
});

app.get('/api/locations/domkal-wards', (req, res) => {
  const wardCode = req.query.wardCode ? String(req.query.wardCode) : undefined;
  const hierarchy = murshidabadMaster.getHierarchy({
    areaType: 'URBAN',
    municipality: 'Domkal Municipality',
    ward: wardCode
  });
  const wards = murshidabadMaster.getDomkalWardsFull(wardCode);
  res.json({
    success: true,
    wards,
    mouzas: hierarchy.mouzas,
    localities: hierarchy.localities,
    pollingStations: hierarchy.pollingStations
  });
});

app.get('/api/locations/search', (req, res) => {
  const q = String(req.query.q || '');
  const results = murshidabadMaster.searchLocations(q);
  res.json({ success: true, total: results.length, results });
});

app.post('/api/locations/import/preview', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const preview = murshidabadMaster.previewImportRows(rows);
  res.json({ success: true, preview });
});

app.post('/api/locations/import/commit', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const batch = murshidabadMaster.commitImportBatch({
    fileName: String(req.body?.fileName || 'manual-import.csv'),
    sourceName: String(req.body?.sourceName || 'Admin Import'),
    sourceUrlOrDocument: String(req.body?.sourceUrlOrDocument || 'Official Upload'),
    sourceDate: String(req.body?.sourceDate || new Date().toISOString().split('T')[0]),
    importedBy: auth.actor.uid,
    rows: Array.isArray(req.body?.rows) ? req.body.rows : []
  });
  centralDb.logAudit('LOCATION_IMPORT_COMMITTED', `Location batch ${batch.importId} staged (${batch.totalRows} rows) by ${auth.actor.uid}`, auth.actor.uid);
  res.json({ success: true, batch });
});

app.get('/api/locations/import/batches', (req, res) => {
  res.json({ success: true, batches: murshidabadMaster.getImportBatches() });
});

app.post('/api/locations/verify', (req, res) => {
  const auth = verifyMainAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const { targetType, targetId, localityId, action, decision, correctedEnglishName, pinCode, mouzaName, postOffice } = req.body || {};
  const resolvedId = String(targetId || localityId || '');
  const resolvedType: 'LOCALITY' | 'RURAL_VILLAGE' | 'IMPORT_BATCH' =
    targetType === 'IMPORT_BATCH' || targetType === 'RURAL_VILLAGE' ? targetType : 'LOCALITY';
  const rawDecision = String(decision || action || 'APPROVE').toUpperCase();
  const resolvedDecision: 'APPROVE' | 'REJECT' | 'EDIT' =
    rawDecision === 'REJECT' ? 'REJECT' : (rawDecision === 'EDIT' ? 'EDIT' : 'APPROVE');
  const result = murshidabadMaster.verifyLocalityOrImport({
    targetType: resolvedType,
    targetId: resolvedId,
    decision: resolvedDecision,
    correctedEnglishName,
    pinCode,
    mouzaName,
    postOffice,
    actorUid: auth.actor.uid
  });
  if (!result.success) return res.status(404).json(result);
  centralDb.logAudit('LOCATION_VERIFICATION', `${resolvedDecision} ${resolvedType} ${resolvedId} by ${auth.actor.uid}`, auth.actor.uid);
  res.json({ ...result, message: `Location record ${resolvedId} ${resolvedDecision.toLowerCase()}d.` });
});

app.post('/api/locations/polling-station', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const station = murshidabadMaster.addPollingStation({
    wardCode: String(req.body?.wardCode || 'WARD 01'),
    psNumber: String(req.body?.psNumber || ''),
    psName: String(req.body?.psName || ''),
    buildingOrLocality: String(req.body?.buildingOrLocality || ''),
    sourceName: String(req.body?.sourceName || 'CP_01.pdf (Verified Upload)'),
    sourceDate: String(req.body?.sourceDate || new Date().toISOString().split('T')[0]),
    actorUid: auth.actor.uid
  });
  centralDb.logAudit('POLLING_STATION_ADDED', `Added Polling Station ${station.psNumber} (${station.wardCode}) by ${auth.actor.uid}`, auth.actor.uid);
  res.json({ success: true, station });
});

// Unified Murshidabad Village & Municipality Locality CRUD, Auto-Verify Add & Export
app.get('/api/locations/villages/master', (req, res) => {
  const entries = murshidabadMaster.listAllEntries({
    areaType: req.query.areaType ? String(req.query.areaType) : 'ALL',
    blockOrMunicipality: req.query.blockOrMunicipality ? String(req.query.blockOrMunicipality) : '',
    gpOrWard: req.query.gpOrWard ? String(req.query.gpOrWard) : '',
    pinCode: req.query.pinCode ? String(req.query.pinCode) : '',
    q: req.query.q ? String(req.query.q) : '',
    verificationStatus: req.query.verificationStatus ? String(req.query.verificationStatus) : 'ALL'
  });
  res.json({ success: true, total: entries.length, entries });
});

app.post('/api/locations/villages', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.addVillageOrLocality(req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(result.duplicate ? 409 : 400).json(result);
  centralDb.logAudit('LOCATION_ADDED', result.message, auth.actor.uid);
  res.json(result);
});

app.post('/api/locations/villages/auto-add', async (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const body = req.body || {};
  const cleanPin = String(body.pinCode || '').replace(/[^0-9]/g, '').slice(0, 6);
  if (cleanPin.length !== 6) {
    return res.status(400).json({ success: false, message: 'Valid 6-digit Indian PIN Code is required for verification.' });
  }
  const lookup = await locationService.lookupByPincode(cleanPin);
  const result = murshidabadMaster.verifyAndAutoAddMissingVillage(
    {
      areaType: body.areaType === 'URBAN' ? 'URBAN' : 'RURAL',
      blockOrMunicipality: String(body.blockOrMunicipality || 'Domkal'),
      gpOrWard: body.gpOrWard ? String(body.gpOrWard) : undefined,
      name: String(body.name || ''),
      pinCode: cleanPin,
      postOffice: body.postOffice ? String(body.postOffice) : undefined,
      policeStation: body.policeStation ? String(body.policeStation) : undefined
    },
    { found: lookup.found, records: lookup.entries },
    auth.actor.uid
  );
  if (!result.success) return res.status(result.duplicate ? 409 : 400).json(result);
  centralDb.logAudit('LOCATION_AUTO_VERIFIED', result.message, auth.actor.uid);
  res.json(result);
});

app.put('/api/locations/villages/:id', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.editVillageOrLocality(String(req.params.id), req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(result.duplicate ? 409 : 404).json(result);
  centralDb.logAudit('LOCATION_UPDATED', result.message, auth.actor.uid);
  res.json(result);
});

app.delete('/api/locations/villages/:id', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.deleteVillageOrLocality(String(req.params.id));
  if (!result.success) return res.status(404).json(result);
  centralDb.logAudit('LOCATION_DELETED', result.message, auth.actor.uid);
  res.json(result);
});

app.get('/api/locations/villages/export', (req, res) => {
  const rows = murshidabadMaster.getExportRows({
    areaType: req.query.areaType ? String(req.query.areaType) : 'ALL',
    blockOrMunicipality: req.query.blockOrMunicipality ? String(req.query.blockOrMunicipality) : '',
    gpOrWard: req.query.gpOrWard ? String(req.query.gpOrWard) : '',
    pinCode: req.query.pinCode ? String(req.query.pinCode) : '',
    q: req.query.q ? String(req.query.q) : '',
    verificationStatus: req.query.verificationStatus ? String(req.query.verificationStatus) : 'ALL'
  });

  if (String(req.query.format || '').toLowerCase() === 'csv') {
    const headers = ['areaType', 'district', 'subdivisionOrMunicipality', 'blockOrWard', 'gpOrMouza', 'villageOrLocality', 'originalSpelling', 'postOffice', 'policeStation', 'pinCode', 'verificationStatus', 'sourceName'];
    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csvLines = [headers.join(','), ...rows.map(r => headers.map(h => escapeCsv((r as any)[h])).join(','))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="murshidabad-villages-pincodes.csv"');
    return res.send(csvLines.join('\r\n'));
  }

  res.json({ success: true, total: rows.length, rows });
});

// ---------------------------------------------------------------------------
// UNIVERSAL GLOBAL SERIAL NUMBER (SL) v2.0 FINAL ENGINE APIs (Section 7 & 10)
// ---------------------------------------------------------------------------
app.post('/api/references/generate', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 401).json({ success: false, message: auth.error || 'Authentication required.' });
  }

  const rawPrefix = String(req.body?.prefix || req.body?.module_prefix || '').trim();
  const meta = resolveCanonicalPrefix(rawPrefix);
  if (!meta) {
    return res.status(400).json({
      success: false,
      message: `Invalid or unregistered module prefix '${rawPrefix}'. Check Prefix Registry.`
    });
  }

  const entityType = req.body?.entity_type || req.body?.entityType || meta.entityType;
  const entityId = req.body?.entity_id || req.body?.entityId || undefined;
  const idempotencyKey = req.body?.idempotency_key || req.body?.idempotencyKey || undefined;
  const legacyReferenceNo = req.body?.legacy_reference_no || req.body?.legacyReferenceNo || undefined;

  try {
    const result = globalReferenceEngine.generateGlobalReference({
      prefix: meta.prefix,
      entityType: String(entityType),
      entityId: entityId ? String(entityId) : undefined,
      idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
      legacyReferenceNo: legacyReferenceNo ? String(legacyReferenceNo) : undefined,
      createdBy: auth.actor.uid
    });
    res.json({
      success: true,
      reference_no: result.reference_no,
      global_sl: result.global_sl,
      serial_num: result.serial_num,
      organization_code: result.organization_code,
      module_prefix: result.module_prefix,
      creation_year: result.creation_year,
      entity_type: result.entity_type,
      entity_id: result.entity_id,
      created_by: result.created_by,
      created_at: result.created_at,
      status: result.status,
      reusedIdempotency: Boolean(result.reusedIdempotency)
    });
  } catch (err: any) {
    res.status(err?.statusCode || 400).json({
      success: false,
      message: err?.message || 'Failed to generate global reference number.'
    });
  }
});

app.get('/api/references/counter', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 401).json({ success: false, message: auth.error || 'Authentication required.' });
  }
  const prefix = req.query.prefix ? String(req.query.prefix) : 'CUST';
  const status = globalReferenceEngine.getCounterStatus(prefix);
  res.json({ success: true, ...status });
});

app.get('/api/references/search', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 401).json({ success: false, message: auth.error || 'Authentication required.' });
  }
  const q = req.query.q ? String(req.query.q) : '';
  const prefix = req.query.prefix ? String(req.query.prefix) : 'ALL';
  const status = req.query.status ? String(req.query.status) : 'ALL';
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const records = globalReferenceEngine.searchReferences(q, { prefix, status, limit });
  res.json({ success: true, total: records.length, records });
});

app.get('/api/references/verify', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({ success: false, message: auth.error || 'Manager or Administration access required.' });
  }
  const check = globalReferenceEngine.verifyConsistency(false);
  const counter = globalReferenceEngine.getCounterStatus('CUST');
  res.json({ success: true, consistency: check, counter });
});

app.post('/api/references/mark-deleted', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 401).json({ success: false, message: auth.error || 'Authentication required.' });
  }
  const refNo = String(req.body?.reference_no || req.body?.referenceNo || req.body?.entity_id || req.body?.id || '').trim();
  const status = String(req.body?.status || 'DELETED').trim().toUpperCase();
  if (!refNo) {
    return res.status(400).json({ success: false, message: 'reference_no is required.' });
  }
  const targetStatus = status === 'ARCHIVED' ? 'ARCHIVED' : 'DELETED';
  const result = globalReferenceEngine.markReferenceStatus(refNo, targetStatus, auth.actor.uid);
  res.json({ ...result, status: targetStatus, reference_no: refNo });
});

app.post('/api/references/migrate', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 403).json({ success: false, message: auth.error || 'Administration access required for migration.' });
  }

  const items: LegacyMigrationInputItem[] = [];
  const pushItem = (item: LegacyMigrationInputItem) => {
    if (item.entityId && resolveCanonicalPrefix(item.prefix)) {
      items.push(item);
    }
  };

  // 1. Collect SQLite non-admin Users & Password Reset References
  const users = relationalDb.listUsers().filter(u => !u.isMainAdmin && u.uid !== MAIN_ADMIN_UID);
  for (const u of users) {
    pushItem({
      prefix: u.role === 'MANAGER' ? 'MGR' : 'STF',
      entityType: u.role === 'MANAGER' ? 'USER_MANAGER' : 'USER_STAFF',
      entityId: u.uid,
      legacyReferenceNo: u.uid,
      createdBy: u.createdBy || MAIN_ADMIN_UID,
      createdAt: u.createdAt
    });
  }
  for (const pr of relationalDb.listPasswordResetReferences({ limit: 500 })) {
    pushItem({
      prefix: 'PWD',
      entityType: 'PASSWORD_RESET_RECEIPT',
      entityId: pr.referenceNumber,
      legacyReferenceNo: pr.referenceNumber,
      createdBy: pr.userId,
      createdAt: pr.createdAt
    });
  }

  // 2. Collect centralDb records
  const snap = centralDb.exportFullBackup(auth.actor.uid).database || {};
  const collectList = (arr: any[] | undefined, prefix: string, entityType: string) => {
    if (!Array.isArray(arr)) return;
    for (const row of arr) {
      if (!row?.id) continue;
      pushItem({
        prefix,
        entityType,
        entityId: String(row.id),
        legacyReferenceNo: String(row.refNumber || row.id),
        createdBy: String(row.createdBy || row.createdByUid || row.uploadedByUid || auth.actor!.uid),
        createdAt: String(row.createdAt || row.updatedAt || row.date || '2026-01-01T00:00:00.000Z'),
        status: row.isDeleted ? 'DELETED' : 'ACTIVE'
      });
    }
  };

  collectList(snap.customers, 'CUST', 'CUSTOMER');
  collectList(snap.services, 'SRV', 'SERVICE');
  collectList(snap.applications, 'CASE', 'CASE');
  collectList(snap.documents, 'DOC', 'DOCUMENT');
  collectList(snap.chats, 'CHT', 'CHAT_MESSAGE');
  collectList(snap.attendanceRecords, 'ATT', 'ATTENDANCE');
  collectList(snap.attendancePhotos, 'PH', 'ATTENDANCE_PHOTO');
  collectList(snap.counterCashTxns, 'TXN', 'CASH_TRANSACTION');
  collectList(snap.counterDaybook, 'DYB', 'DAYBOOK');
  collectList(snap.followupCases, 'CASE', 'CASE');
  collectList(snap.grievances, 'GRV', 'GRIEVANCE');
  collectList(snap.reminders, 'REM', 'REMINDER');
  collectList(snap.deleteHistory, 'DEL', 'DELETE_HISTORY');
  collectList(snap.annapurnaApplications, 'ANP', 'ANNAPURNA_APP');

  // 3. Collect optional client-submitted local collections if sent in body
  const clientCollections = Array.isArray(req.body?.items) ? req.body.items : [];
  for (const ci of clientCollections) {
    if (ci?.prefix && ci?.entityId) {
      pushItem({
        prefix: String(ci.prefix),
        entityType: String(ci.entityType || ci.prefix),
        entityId: String(ci.entityId),
        legacyReferenceNo: String(ci.legacyReferenceNo || ci.entityId),
        createdBy: String(ci.createdBy || auth.actor.uid),
        createdAt: String(ci.createdAt || '2026-01-01T00:00:00.000Z'),
        status: ci.status === 'DELETED' ? 'DELETED' : 'ACTIVE'
      });
    }
  }

  const report = globalReferenceEngine.migrateExistingRecords(items, auth.actor.uid);
  res.json({ success: true, ...report });
});

app.get('/api/references/:referenceNo', (req, res) => {
  const auth = resolveActor(req, true);
  if (!auth.ok || !auth.actor) {
    return res.status(auth.code || 401).json({ success: false, message: auth.error || 'Authentication required.' });
  }
  const ref = String(req.params.referenceNo || '').trim();
  const record = globalReferenceEngine.getReferenceDetails(ref);
  if (!record) {
    return res.status(404).json({ success: false, message: `Reference '${ref}' not found in global registry.` });
  }
  res.json({ success: true, record, prefixMeta: PREFIX_REGISTRY[record.module_prefix] || null });
});

// Legacy serial endpoint aliases -> cleanly delegated to Universal Global SL v2.0
app.get('/api/serial/current', (req, res) => {
  const previewPrefix = req.query.prefix ? String(req.query.prefix) : 'CUST';
  const status = centralDb.getGlobalSerialStatus(previewPrefix);
  res.json({ success: true, ...status });
});

app.post('/api/serial/next', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const prefix = String(req.body?.prefix || 'CUST').trim().toUpperCase();
  const allocated = centralDb.allocateGlobalSerial(prefix, { createdBy: auth.actor.uid });
  res.json({ success: true, ...allocated });
});

app.get('/api/applications/next-id', (req, res) => {
  const dateParam = req.query.date ? String(req.query.date) : undefined;
  const preview = centralDb.getNextApplicationIdPreview(dateParam);
  res.json({ success: true, ...preview });
});

app.post('/api/applications/next-id', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const dateParam = req.body?.date ? String(req.body.date) : undefined;
  const allocated = centralDb.allocateApplicationId(dateParam, auth.actor.uid);
  res.json({ success: true, ...allocated });
});

app.post('/api/serial/sync', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(401).json({ success: false, message: auth.error });
  const { serial, id, year2 } = req.body || {};
  const status = centralDb.syncGlobalSerialFloor(id || serial || 0, year2 ? String(year2) : undefined);
  res.json({ success: true, ...status });
});

// ---------------------------------------------------------------------------
// ADMIN LOCATION MASTER CRUD: BLOCKS, GPs, POST OFFICES, POLICE STATIONS, PIN CODES
// ---------------------------------------------------------------------------
app.get('/api/locations/blocks', (req, res) => {
  const subdivision = req.query.subdivision ? String(req.query.subdivision) : undefined;
  const blocks = murshidabadMaster.listBlocks(subdivision);
  res.json({ success: true, total: blocks.length, blocks });
});

app.post('/api/locations/blocks', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.addBlock(req.body || {});
  if (!result.success) return res.status(400).json(result);
  centralDb.logAudit('LOCATION_BLOCK_ADDED', result.message, auth.actor.uid);
  res.json(result);
});

app.put('/api/locations/blocks/:id', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.editBlock(String(req.params.id), req.body || {});
  if (!result.success) return res.status(404).json(result);
  centralDb.logAudit('LOCATION_BLOCK_UPDATED', result.message, auth.actor.uid);
  res.json(result);
});

app.get('/api/locations/gram-panchayats', (req, res) => {
  const blockName = req.query.blockName ? String(req.query.blockName) : undefined;
  const gramPanchayats = murshidabadMaster.listGramPanchayats(blockName);
  res.json({ success: true, total: gramPanchayats.length, gramPanchayats });
});

app.post('/api/locations/gram-panchayats', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.addGramPanchayat(req.body || {});
  if (!result.success) return res.status(400).json(result);
  centralDb.logAudit('LOCATION_GP_ADDED', result.message, auth.actor.uid);
  res.json(result);
});

app.put('/api/locations/gram-panchayats/:id', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.editGramPanchayat(String(req.params.id), req.body || {});
  if (!result.success) return res.status(404).json(result);
  centralDb.logAudit('LOCATION_GP_UPDATED', result.message, auth.actor.uid);
  res.json(result);
});

app.get('/api/locations/post-offices-master', (req, res) => {
  const postOffices = murshidabadMaster.listPostOfficesMaster();
  res.json({ success: true, total: postOffices.length, postOffices });
});

app.post('/api/locations/post-offices-master', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.addPostOffice(req.body || {});
  if (!result.success) return res.status(400).json(result);
  centralDb.logAudit('LOCATION_PO_ADDED', result.message, auth.actor.uid);
  res.json(result);
});

app.put('/api/locations/post-offices-master/:id', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.editPostOffice(String(req.params.id), req.body || {});
  if (!result.success) return res.status(404).json(result);
  centralDb.logAudit('LOCATION_PO_UPDATED', result.message, auth.actor.uid);
  res.json(result);
});

app.get('/api/locations/police-stations-master', (req, res) => {
  const policeStations = murshidabadMaster.listPoliceStationsMaster();
  res.json({ success: true, total: policeStations.length, policeStations });
});

app.post('/api/locations/police-stations-master', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.addPoliceStation(req.body || {});
  if (!result.success) return res.status(400).json(result);
  centralDb.logAudit('LOCATION_PS_ADDED', result.message, auth.actor.uid);
  res.json(result);
});

app.put('/api/locations/police-stations-master/:id', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.editPoliceStation(String(req.params.id), req.body || {});
  if (!result.success) return res.status(404).json(result);
  centralDb.logAudit('LOCATION_PS_UPDATED', result.message, auth.actor.uid);
  res.json(result);
});

app.get('/api/locations/pincodes-master', (req, res) => {
  const pinCodes = murshidabadMaster.listPinCodesMaster();
  res.json({ success: true, total: pinCodes.length, pinCodes });
});

app.post('/api/locations/pincodes-master', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.addPinCode(req.body || {});
  if (!result.success) return res.status(400).json(result);
  centralDb.logAudit('LOCATION_PIN_ADDED', result.message, auth.actor.uid);
  res.json(result);
});

app.put('/api/locations/pincodes-master/:id', (req, res) => {
  const auth = verifyManagerOrAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.editPinCode(String(req.params.id), req.body || {});
  if (!result.success) return res.status(404).json(result);
  centralDb.logAudit('LOCATION_PIN_UPDATED', result.message, auth.actor.uid);
  res.json(result);
});

// ---------------------------------------------------------------------------
// ANNAPURNA YOJANA – DYNAMIC WARD & VILLAGE MASTER API (ADMIN PROTECTED MUTATIONS)
// ---------------------------------------------------------------------------
app.get('/api/locations/ward-master', (req, res) => {
  const includeInactive = req.query.includeInactive !== 'false';
  const includeDeleted = req.query.includeDeleted === 'true';
  const wardId = req.query.wardId ? String(req.query.wardId) : undefined;
  const q = req.query.q ? String(req.query.q) : undefined;
  const data = murshidabadMaster.getWardVillageMaster({ includeInactive, includeDeleted, wardId, q });
  res.json({ success: true, ...data });
});

app.post('/api/locations/ward-master/wards', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.addMasterWard(req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(result.duplicate ? 409 : 400).json(result);
  centralDb.logAudit('WARD_MASTER_ADD', result.message, auth.actor.uid);
  res.json({ ...result, master: murshidabadMaster.getWardVillageMaster({ includeInactive: true }) });
});

app.put('/api/locations/ward-master/wards/:wardId', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.editMasterWard(String(req.params.wardId), req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(result.duplicate ? 409 : 404).json(result);
  centralDb.logAudit('WARD_MASTER_UPDATE', result.message, auth.actor.uid);
  res.json({ ...result, master: murshidabadMaster.getWardVillageMaster({ includeInactive: true }) });
});

app.delete('/api/locations/ward-master/wards/:wardId', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const mode = (req.body?.mode || req.query?.mode) === 'soft' ? 'soft' : 'permanent';
  const reassignToWardId = req.body?.reassignToWardId || req.query?.reassignToWardId;
  const forceCascadeDeactivate = Boolean(req.body?.forceCascadeDeactivate === true || req.query?.forceCascadeDeactivate === 'true');
  const result = murshidabadMaster.deleteMasterWard(
    String(req.params.wardId),
    {
      mode,
      reassignToWardId: reassignToWardId ? String(reassignToWardId) : undefined,
      forceCascadeDeactivate
    },
    auth.actor.uid
  );
  if (!result.success) return res.status(result.blocked ? 409 : 400).json(result);
  centralDb.logAudit('WARD_MASTER_DELETE', result.message, auth.actor.uid);
  res.json({ ...result, master: murshidabadMaster.getWardVillageMaster({ includeInactive: true }) });
});

app.post('/api/locations/ward-master/villages', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.addMasterWardVillage(req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(result.duplicate ? 409 : 400).json(result);
  centralDb.logAudit('WARD_VILLAGE_ADD', result.message, auth.actor.uid);
  res.json({ ...result, master: murshidabadMaster.getWardVillageMaster({ includeInactive: true }) });
});

app.put('/api/locations/ward-master/villages/:id', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.editMasterWardVillage(String(req.params.id), req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(result.duplicate ? 409 : 400).json(result);
  centralDb.logAudit('WARD_VILLAGE_UPDATE', result.message, auth.actor.uid);
  res.json({ ...result, master: murshidabadMaster.getWardVillageMaster({ includeInactive: true }) });
});

app.delete('/api/locations/ward-master/villages/:id', (req, res) => {
  const auth = verifyAdminActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 403).json({ success: false, message: auth.error });
  const result = murshidabadMaster.deleteMasterWardVillage(String(req.params.id), auth.actor.uid);
  if (!result.success) return res.status(404).json(result);
  centralDb.logAudit('WARD_VILLAGE_DELETE', result.message, auth.actor.uid);
  res.json({ ...result, master: murshidabadMaster.getWardVillageMaster({ includeInactive: true }) });
});

// ---------------------------------------------------------------------------
// ANNAPURNA YOJANA APPLICATIONS MULTI-USER PERSISTENCE API
// ---------------------------------------------------------------------------
app.get('/api/annapurna/applications', (_req, res) => {
  const applications = centralDb.listAnnapurnaApplications();
  res.json({ success: true, total: applications.length, applications });
});

app.post('/api/annapurna/applications', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const result = centralDb.upsertAnnapurnaApplication(req.body || {}, auth.actor.uid);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/annapurna/sync', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const incoming = Array.isArray(req.body?.applications) ? req.body.applications : [];
  const result = centralDb.syncAnnapurnaApplications(incoming, auth.actor.uid);
  res.json(result);
});

app.delete('/api/annapurna/applications/:id', (req, res) => {
  const auth = resolveActor(req);
  if (!auth.ok || !auth.actor) return res.status(auth.code || 401).json({ success: false, message: auth.error });
  const result = centralDb.deleteAnnapurnaApplication(String(req.params.id), auth.actor.uid);
  res.json(result);
});

// ---------------------------------------------------------------------------
// API 404 FALLBACK & INITIALIZATION
// ---------------------------------------------------------------------------
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

let _initServicesPromise: Promise<void> | null = null;

export async function initServerServices(): Promise<void> {
  if (!_initServicesPromise) {
    _initServicesPromise = (async () => {
      await relationalDb.init();
      locationService.init();
      murshidabadMaster.init();
      centralDb.init();
      // Verify Global Reference SL consistency on startup (auto-heals counter floor upward if needed, never resets)
      globalReferenceEngine.verifyConsistency(true);
    })();
  }
  return _initServicesPromise;
}

// ---------------------------------------------------------------------------
// VITE OR STATIC FRONTEND MOUNT (Standalone / Local / Cloud Run only)
// ---------------------------------------------------------------------------
async function startServer() {
  await initServerServices();

  // Automatic Daily Data Backup Scheduler (runs every 6 hours when operational records exist so fresh DB starts at SL = 0)
  try {
    const hasOperationalRecords =
      centralDb.listCustomers().length > 0 ||
      centralDb.listApplications().length > 0 ||
      centralDb.listServices().length > 0 ||
      centralDb.listFollowupCases().length > 0;
    const todayIso = getKolkataDateParts().isoDate;
    const existingSnapshots = centralDb.listBackupSnapshots();
    const hasTodaySnapshot = existingSnapshots.some(s => String(s.createdAt || '').slice(0, 10) === todayIso);
    if (hasOperationalRecords && !hasTodaySnapshot) {
      centralDb.createAutoBackupSnapshot(MAIN_ADMIN_UID, 'AUTO');
    }
    setInterval(() => {
      try {
        const hasOps =
          centralDb.listCustomers().length > 0 ||
          centralDb.listApplications().length > 0 ||
          centralDb.listServices().length > 0;
        if (hasOps) {
          centralDb.createAutoBackupSnapshot(MAIN_ADMIN_UID, 'AUTO');
        }
      } catch {
        // non-blocking
      }
    }, 6 * 60 * 60 * 1000);
  } catch {
    // non-blocking
  }

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[MUN COMPUTER — CENTRAL AUTHORITY] Full-Stack Server listening on port ${PORT}`);
  });
}

if (!isVercelRuntime()) {
  startServer();
}

export { app };
export default app;
