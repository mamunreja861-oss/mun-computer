import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';
import { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_ADMIN_PASSWORD,
  encryptSensitive,
  decryptSensitive,
  hashSensitive,
  maskPhone,
  maskAadhaar
} from './centralDb.js';
import {
  MENU_DEFINITIONS,
  PERMISSION_ACTIONS,
  getDefaultRolePermissions,
  resolveEffectivePermissions,
  MenuPermissionSet,
  ExtraPermissionControls
} from './permissions.js';
import { globalReferenceEngine } from './globalReferenceEngine.js';
import { getDataDir } from './dataDir.js';

export const MAIN_ADMIN_UID = 'MC-ADM-14012025';
export const MAIN_ADMIN_NAME = 'Sarmina Khatun';
export const MAIN_ADMIN_MOBILE = '9735407045';
const MAIN_ADMIN_AADHAAR_MASKED = 'XXXX XXXX 9364';
const MAIN_ADMIN_AADHAAR_HASH = 'e8f988e40a366f105a24f8730dc984be16390ac57378512e53cc48c979eeb3c5';
export type CoreRole = 'ADMIN' | 'MANAGER' | 'STAFF';
export type CoreAccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

const DATA_DIR = getDataDir();
const SQLITE_DB_PATH = path.join(DATA_DIR, 'mun-computer.db');
const USERS_JSON_FILE = path.join(DATA_DIR, 'users.json');
const AUDIT_LOGS_JSON_FILE = path.join(DATA_DIR, 'audit-logs.json');
const DB_BACKUPS_DIR = path.join(DATA_DIR, 'auto-backups');

export function normalizeCoreRole(rawRole?: string): CoreRole {
  const r = String(rawRole || 'STAFF').trim().toUpperCase();
  if (r === 'ADMIN' || r === 'ADMINISTRATION') return 'ADMIN';
  if (r === 'MANAGER') return 'MANAGER';
  // Legacy MAKER / CHECKER map cleanly into STAFF to preserve strict 3-level RBAC
  return 'STAFF';
}

export function normalizeCoreStatus(rawStatus?: string): CoreAccountStatus {
  const s = String(rawStatus || 'ACTIVE').trim().toUpperCase();
  if (s === 'SUSPENDED') return 'SUSPENDED';
  if (s === 'INACTIVE' || s === 'PENDING_APPROVAL' || s === 'REJECTED' || s === 'CORRECTION_REQUIRED') return 'INACTIVE';
  return 'ACTIVE';
}

export function getKolkataNow(date = new Date()): {
  year: number;
  yearStr: string;
  yy: string;
  monthStr: string;
  dayStr: string;
  yymmdd: string;
  isoDate: string;
  time24: string;
  time12: string;
  isoTimestamp: string;
} {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  const yearStr = get('year');
  const monthStr = get('month');
  const dayStr = get('day');
  let hour = get('hour');
  if (hour === '24') hour = '00';
  const minute = get('minute');
  const second = get('second');
  const yy = yearStr.slice(-2);

  const time12 = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(date);

  return {
    year: parseInt(yearStr, 10),
    yearStr,
    yy,
    monthStr,
    dayStr,
    yymmdd: `${yy}${monthStr}${dayStr}`,
    isoDate: `${yearStr}-${monthStr}-${dayStr}`,
    time24: `${hour}:${minute}:${second}`,
    time12,
    isoTimestamp: date.toISOString()
  };
}

// ---------------------------------------------------------------------------
// PASSWORD HASHING (ARGON2ID PRIMARY + LEGACY BCRYPT AUTO-UPGRADE)
// ---------------------------------------------------------------------------
export async function hashPasswordArgon2id(plainPassword: string): Promise<string> {
  return argon2.hash(String(plainPassword), {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1
  });
}

export async function verifyPasswordHash(plainPassword: string, storedHash: string): Promise<{
  valid: boolean;
  needsUpgrade: boolean;
}> {
  const pwd = String(plainPassword || '');
  const hash = String(storedHash || '');
  if (!pwd || !hash) return { valid: false, needsUpgrade: false };
  if (hash.startsWith('$argon2id$')) {
    try {
      const ok = await argon2.verify(hash, pwd);
      return { valid: ok, needsUpgrade: false };
    } catch {
      return { valid: false, needsUpgrade: false };
    }
  }
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$') || hash.startsWith('$argon2')) {
    try {
      const ok = hash.startsWith('$argon2') ? await argon2.verify(hash, pwd) : bcrypt.compareSync(pwd, hash);
      return { valid: ok, needsUpgrade: ok };
    } catch {
      return { valid: false, needsUpgrade: false };
    }
  }
  return { valid: false, needsUpgrade: false };
}

// ---------------------------------------------------------------------------
// RFC 6238 TOTP MFA (BUILT-IN CRYPTO — NO EXTERNAL DEPENDENCIES)
// ---------------------------------------------------------------------------
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(base32: string): Buffer {
  const clean = String(base32 || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return encodeBase32(crypto.randomBytes(20));
}

export function buildOtpAuthUri(userId: string, secret: string, issuer = 'MUN COMPUTER ERP'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(userId)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function verifyTotpCode(secretBase32: string, codeInput: string, windowSteps = 1): boolean {
  const cleanCode = String(codeInput || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) return false;
  const key = decodeBase32(secretBase32);
  if (!key.length) return false;

  const counter = Math.floor(Date.now() / 1000 / 30);
  const inputBuf = Buffer.from(cleanCode, 'utf8');

  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    const step = counter + offset;
    const msg = Buffer.alloc(8);
    msg.writeUInt32BE(Math.floor(step / 0x100000000), 0);
    msg.writeUInt32BE(step >>> 0, 4);
    const hmac = crypto.createHmac('sha1', key).update(msg).digest();
    const pos = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[pos] & 0x7f) << 24) |
      ((hmac[pos + 1] & 0xff) << 16) |
      ((hmac[pos + 2] & 0xff) << 8) |
      (hmac[pos + 3] & 0xff);
    const otp = String(binary % 1000000).padStart(6, '0');
    const otpBuf = Buffer.from(otp, 'utf8');
    if (otpBuf.length === inputBuf.length && crypto.timingSafeEqual(otpBuf, inputBuf)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
export interface RelationalUserRow {
  id: number;
  user_id: string;
  username: string;
  full_name: string;
  mobile_number: string;
  email: string;
  role_id: CoreRole;
  address: string;
  status: CoreAccountStatus;
  is_main_admin: number;
  password_hash: string;
  must_change_password: number;
  session_version: number;
  failed_login_attempts: number;
  failed_reset_attempts: number;
  locked_until: string | null;
  mfa_enabled: number;
  mfa_secret_enc: string | null;
  created_by: string | null;
  registration_date: string;
  registration_time: string;
  designation: string | null;
  father_name: string | null;
  mother_name: string | null;
  dob: string | null;
  aadhaar_enc: string | null;
  aadhaar_hash: string | null;
  aadhaar_masked: string | null;
  district: string | null;
  area_type: string | null;
  block_or_municipality: string | null;
  gp_or_ward: string | null;
  village_or_ward: string | null;
  post_office: string | null;
  police_station: string | null;
  pin_code: string | null;
  extra_permissions_json: string | null;
  daily_password_change_date: string | null;
  daily_password_change_count: number;
  password_change_count: number;
  password_history_json: string | null;
  approval_history_json: string | null;
  login_count: number;
  last_login_at: string | null;
  last_login_panel: string | null;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiUserRecord {
  uid: string;
  userId: string;
  requestId: string;
  username: string;
  name: string;
  fullName: string;
  role: CoreRole;
  isMainAdmin: boolean;
  isSuperAdmin: boolean; // backward compat alias strictly tied to isMainAdmin (MC-ADM-14012025)
  designation: string;
  phone: string;
  mobileNumber: string;
  phoneMasked: string;
  aadhaarMasked: string;
  email: string;
  address: string;
  status: CoreAccountStatus;
  approvalStatus: 'APPROVED';
  verificationStatus: 'VERIFIED';
  mustChangePassword: boolean;
  sessionVersion: number;
  failedLoginAttempts: number;
  failedResetAttempts: number;
  lockedUntil: string | null;
  mfaEnabled: boolean;
  createdBy: string;
  registrationDate: string;
  registrationTime: string;
  fatherName: string;
  motherName: string;
  dob: string;
  district: string;
  areaType: 'RURAL' | 'URBAN';
  blockOrMunicipality: string;
  gpOrWard: string;
  villageOrWard: string;
  postOffice: string;
  policeStation: string;
  pinCode: string;
  dailyPasswordChangeDate: string;
  dailyPasswordChangeCount: number;
  passwordChangeCount: number;
  passwordHistory: Array<{ changedAt: string; method: string }>;
  approvalHistory: Array<{ timestamp: string; action: string; actorUid: string; notes?: string }>;
  loginCount: number;
  lastLoginAt: string;
  lastLoginPanel: string;
  passwordChangedAt: string;
  createdAt: string;
  updatedAt: string;
  permissionOverrides: Record<string, Partial<MenuPermissionSet>>;
  extraPermissions: Partial<ExtraPermissionControls>;
}

const DEFAULT_SYSTEM_SETTINGS: Record<string, string> = {
  session_timeout_minutes: '720',
  max_failed_login_attempts: '5',
  max_failed_reset_attempts: '5',
  lockout_duration_minutes: '15',
  daily_password_change_limit: '5',
  password_min_length: '8',
  require_captcha_login: 'true',
  require_captcha_recovery: 'true',
  main_admin_uid: MAIN_ADMIN_UID
};

class RelationalDatabaseService {
  private sqlite!: DatabaseSync;
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DB_BACKUPS_DIR)) fs.mkdirSync(DB_BACKUPS_DIR, { recursive: true });

    this.sqlite = new DatabaseSync(SQLITE_DB_PATH);
    this.sqlite.exec('PRAGMA journal_mode = WAL;');
    this.sqlite.exec('PRAGMA foreign_keys = ON;');
    this.sqlite.exec('PRAGMA busy_timeout = 5000;');

    this.runSchemaAndMigrations();
    this.migrateLegacyMainAdminUidIfNeeded();
    globalReferenceEngine.attachDatabase(this.sqlite);
    this.seedRolesAndPermissions();
    this.seedDefaultSettings();
    this.migrateLegacyUsersIfNeeded();
    this.migrateLegacyAuditLogsIfNeeded();
    this.ensureMainAdminAccountSync();
    globalReferenceEngine.verifyConsistency(true);

    this.initialized = true;
  }

  private getDb(): DatabaseSync {
    if (!this.initialized) this.init();
    return this.sqlite;
  }

  private runImmediateTransaction<T>(fn: () => T): T {
    const db = this.getDb();
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // SCHEMA CREATION & MIGRATIONS (ALL 12 TABLES + TRIGGERS + INDEXES)
  // -------------------------------------------------------------------------
  private runSchemaAndMigrations(): void {
    const db = this.sqlite;

    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      -- 1. roles
      CREATE TABLE IF NOT EXISTS roles (
        role_id TEXT PRIMARY KEY CHECK(role_id IN ('ADMIN', 'MANAGER', 'STAFF')),
        role_name TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- 2. users
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        full_name TEXT NOT NULL,
        mobile_number TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        role_id TEXT NOT NULL REFERENCES roles(role_id),
        address TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
        is_main_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_main_admin IN (0, 1)),
        password_hash TEXT NOT NULL,
        must_change_password INTEGER NOT NULL DEFAULT 1 CHECK(must_change_password IN (0, 1)),
        session_version INTEGER NOT NULL DEFAULT 1,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        failed_reset_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        mfa_enabled INTEGER NOT NULL DEFAULT 0 CHECK(mfa_enabled IN (0, 1)),
        mfa_secret_enc TEXT,
        created_by TEXT,
        registration_date TEXT NOT NULL,
        registration_time TEXT NOT NULL,
        designation TEXT,
        father_name TEXT,
        mother_name TEXT,
        dob TEXT,
        district TEXT,
        area_type TEXT,
        block_or_municipality TEXT,
        gp_or_ward TEXT,
        village_or_ward TEXT,
        post_office TEXT,
        police_station TEXT,
        pin_code TEXT,
        extra_permissions_json TEXT,
        daily_password_change_date TEXT,
        daily_password_change_count INTEGER NOT NULL DEFAULT 0,
        password_change_count INTEGER NOT NULL DEFAULT 0,
        password_history_json TEXT,
        approval_history_json TEXT,
        login_count INTEGER NOT NULL DEFAULT 0,
        last_login_at TEXT,
        last_login_panel TEXT,
        password_changed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Safe additive schema migrations for Aadhaar encryption & single-use hashed reset tokens
    const userCols = new Set(
      (db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>).map(c => c.name)
    );
    if (!userCols.has('aadhaar_enc')) db.exec(`ALTER TABLE users ADD COLUMN aadhaar_enc TEXT;`);
    if (!userCols.has('aadhaar_hash')) db.exec(`ALTER TABLE users ADD COLUMN aadhaar_hash TEXT;`);
    if (!userCols.has('aadhaar_masked')) db.exec(`ALTER TABLE users ADD COLUMN aadhaar_masked TEXT;`);

    // Migration v3: Drop legacy inline UNIQUE constraint on users.mobile_number so Administrator Duplicate Exception works
    const usersTableSqlRow = db
      .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
      .get() as { sql?: string } | undefined;
    if (usersTableSqlRow?.sql && /mobile_number\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(usersTableSqlRow.sql)) {
      db.exec(`PRAGMA foreign_keys = OFF;`);
      try {
        db.exec(`BEGIN IMMEDIATE`);
        db.exec(`
          CREATE TABLE users_rebuild (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            full_name TEXT NOT NULL,
            mobile_number TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            role_id TEXT NOT NULL REFERENCES roles(role_id),
            address TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
            is_main_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_main_admin IN (0, 1)),
            password_hash TEXT NOT NULL,
            must_change_password INTEGER NOT NULL DEFAULT 1 CHECK(must_change_password IN (0, 1)),
            session_version INTEGER NOT NULL DEFAULT 1,
            failed_login_attempts INTEGER NOT NULL DEFAULT 0,
            failed_reset_attempts INTEGER NOT NULL DEFAULT 0,
            locked_until TEXT,
            mfa_enabled INTEGER NOT NULL DEFAULT 0 CHECK(mfa_enabled IN (0, 1)),
            mfa_secret_enc TEXT,
            created_by TEXT,
            registration_date TEXT NOT NULL,
            registration_time TEXT NOT NULL,
            designation TEXT,
            father_name TEXT,
            mother_name TEXT,
            dob TEXT,
            district TEXT,
            area_type TEXT,
            block_or_municipality TEXT,
            gp_or_ward TEXT,
            village_or_ward TEXT,
            post_office TEXT,
            police_station TEXT,
            pin_code TEXT,
            extra_permissions_json TEXT,
            daily_password_change_date TEXT,
            daily_password_change_count INTEGER NOT NULL DEFAULT 0,
            password_change_count INTEGER NOT NULL DEFAULT 0,
            password_history_json TEXT,
            approval_history_json TEXT,
            login_count INTEGER NOT NULL DEFAULT 0,
            last_login_at TEXT,
            last_login_panel TEXT,
            password_changed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            aadhaar_enc TEXT,
            aadhaar_hash TEXT,
            aadhaar_masked TEXT
          );
          INSERT INTO users_rebuild (
            id, user_id, username, full_name, mobile_number, email, role_id, address, status, is_main_admin,
            password_hash, must_change_password, session_version, failed_login_attempts, failed_reset_attempts,
            locked_until, mfa_enabled, mfa_secret_enc, created_by, registration_date, registration_time,
            designation, father_name, mother_name, dob, district, area_type, block_or_municipality,
            gp_or_ward, village_or_ward, post_office, police_station, pin_code, extra_permissions_json,
            daily_password_change_date, daily_password_change_count, password_change_count,
            password_history_json, approval_history_json, login_count, last_login_at, last_login_panel,
            password_changed_at, created_at, updated_at, aadhaar_enc, aadhaar_hash, aadhaar_masked
          )
          SELECT
            id, user_id, username, full_name, mobile_number, email, role_id, address, status, is_main_admin,
            password_hash, must_change_password, session_version, failed_login_attempts, failed_reset_attempts,
            locked_until, mfa_enabled, mfa_secret_enc, created_by, registration_date, registration_time,
            designation, father_name, mother_name, dob, district, area_type, block_or_municipality,
            gp_or_ward, village_or_ward, post_office, police_station, pin_code, extra_permissions_json,
            daily_password_change_date, daily_password_change_count, password_change_count,
            password_history_json, approval_history_json, login_count, last_login_at, last_login_panel,
            password_changed_at, created_at, updated_at, aadhaar_enc, aadhaar_hash, aadhaar_masked
          FROM users;
          DROP TABLE users;
          ALTER TABLE users_rebuild RENAME TO users;
        `);
        db.exec(`COMMIT`);
      } catch (err) {
        try { db.exec(`ROLLBACK`); } catch { /* ignore */ }
        throw err;
      } finally {
        db.exec(`PRAGMA foreign_keys = ON;`);
      }
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role_id, status);
      CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile_number);
      CREATE INDEX IF NOT EXISTS idx_users_main_admin ON users(is_main_admin);
      CREATE INDEX IF NOT EXISTS idx_users_aadhaar_hash ON users(aadhaar_hash);

      -- Database-level Triggers permanently protecting MC-ADM-14012025 and User ID immutability
      DROP TRIGGER IF EXISTS trg_protect_main_admin_delete;
      CREATE TRIGGER trg_protect_main_admin_delete
      BEFORE DELETE ON users
      WHEN OLD.is_main_admin = 1 OR OLD.user_id = '${MAIN_ADMIN_UID}'
      BEGIN
        SELECT RAISE(ABORT, 'Permanent Master Administrator account MC-ADM-14012025 cannot be deleted.');
      END;

      DROP TRIGGER IF EXISTS trg_protect_main_admin_identity;
      CREATE TRIGGER trg_protect_main_admin_identity
      BEFORE UPDATE ON users
      WHEN (OLD.is_main_admin = 1 OR OLD.user_id = '${MAIN_ADMIN_UID}')
        AND (
          NEW.user_id <> '${MAIN_ADMIN_UID}'
          OR NEW.role_id <> 'ADMIN'
          OR NEW.status <> 'ACTIVE'
          OR NEW.is_main_admin <> 1
          OR (OLD.full_name = '${MAIN_ADMIN_NAME}' AND NEW.full_name <> '${MAIN_ADMIN_NAME}')
          OR (OLD.mobile_number = '${MAIN_ADMIN_MOBILE}' AND NEW.mobile_number <> '${MAIN_ADMIN_MOBILE}')
          OR (OLD.aadhaar_hash = '${MAIN_ADMIN_AADHAAR_HASH}' AND COALESCE(NEW.aadhaar_hash, '') <> '${MAIN_ADMIN_AADHAAR_HASH}')
        )
      BEGIN
        SELECT RAISE(ABORT, 'Permanent Master Administrator profile MC-ADM-14012025 cannot be renamed, altered, reassigned, or deactivated.');
      END;

      DROP TRIGGER IF EXISTS trg_immutable_user_id;
      CREATE TRIGGER trg_immutable_user_id
      BEFORE UPDATE ON users
      WHEN NEW.user_id <> OLD.user_id
      BEGIN
        SELECT RAISE(ABORT, 'User ID is permanent and cannot be altered.');
      END;

      DROP TRIGGER IF EXISTS trg_single_main_admin_insert;
      CREATE TRIGGER trg_single_main_admin_insert
      BEFORE INSERT ON users
      WHEN NEW.is_main_admin = 1 AND NEW.user_id <> '${MAIN_ADMIN_UID}'
      BEGIN
        SELECT RAISE(ABORT, 'Master Administrator privilege is exclusive to MC-ADM-14012025.');
      END;

      DROP TRIGGER IF EXISTS trg_single_main_admin_update;
      CREATE TRIGGER trg_single_main_admin_update
      BEFORE UPDATE ON users
      WHEN NEW.is_main_admin = 1 AND NEW.user_id <> '${MAIN_ADMIN_UID}'
      BEGIN
        SELECT RAISE(ABORT, 'Master Administrator privilege is exclusive to MC-ADM-14012025.');
      END;

      -- 3. permissions
      CREATE TABLE IF NOT EXISTS permissions (
        permission_id TEXT PRIMARY KEY,
        menu_id TEXT NOT NULL,
        action TEXT NOT NULL,
        description TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_permissions_menu ON permissions(menu_id);

      -- 4. role_permissions
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id TEXT NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
        permission_id TEXT NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
        allowed INTEGER NOT NULL DEFAULT 0 CHECK(allowed IN (0, 1)),
        PRIMARY KEY (role_id, permission_id)
      );

      -- 5. user_permissions
      CREATE TABLE IF NOT EXISTS user_permissions (
        user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        menu_id TEXT NOT NULL,
        actions_json TEXT NOT NULL,
        extra_json TEXT,
        updated_at TEXT NOT NULL,
        updated_by TEXT,
        PRIMARY KEY (user_id, menu_id)
      );

      -- 6. user_sessions
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        csrf_token_hash TEXT NOT NULL,
        panel_role TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

      -- 7. password_reset_requests
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        request_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        mobile_verified INTEGER NOT NULL DEFAULT 0 CHECK(mobile_verified IN (0, 1)),
        captcha_verified INTEGER NOT NULL DEFAULT 0 CHECK(captcha_verified IN (0, 1)),
        otp_verified INTEGER NOT NULL DEFAULT 0 CHECK(otp_verified IN (0, 1)),
        status TEXT NOT NULL CHECK(status IN ('INITIATED', 'VERIFIED', 'COMPLETED', 'EXPIRED', 'FAILED')),
        ip_address TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_reset_req_user ON password_reset_requests(user_id, status);

      -- 8. password_reset_references
      CREATE TABLE IF NOT EXISTS password_reset_references (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference_number TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        reset_request_id TEXT REFERENCES password_reset_requests(request_id) ON DELETE SET NULL,
        reset_date TEXT NOT NULL,
        reset_time TEXT NOT NULL,
        reset_status TEXT NOT NULL CHECK(reset_status = 'SUCCESSFUL'),
        ip_address TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reset_ref_user ON password_reset_references(user_id, created_at DESC);

      -- 9. global_serial_counters
      CREATE TABLE IF NOT EXISTS global_serial_counters (
        yy TEXT PRIMARY KEY,
        last_serial INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      -- 10. daily_reference_counters
      CREATE TABLE IF NOT EXISTS daily_reference_counters (
        yymmdd TEXT PRIMARY KEY,
        last_serial INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      -- 11. audit_logs
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        audit_uid TEXT NOT NULL UNIQUE,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_user_id TEXT,
        target_user_id TEXT,
        details TEXT NOT NULL,
        ip_address TEXT,
        meta_json TEXT,
        prev_hash TEXT NOT NULL,
        entry_hash TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id);

      -- 12. system_settings
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT
      );
    `);

    const resetReqCols = new Set(
      (db.prepare(`PRAGMA table_info(password_reset_requests)`).all() as Array<{ name: string }>).map(c => c.name)
    );
    if (!resetReqCols.has('reset_token_hash')) db.exec(`ALTER TABLE password_reset_requests ADD COLUMN reset_token_hash TEXT;`);
    if (!resetReqCols.has('reset_token_used_at')) db.exec(`ALTER TABLE password_reset_requests ADD COLUMN reset_token_used_at TEXT;`);

    // Migration v4: Global Device Registration Policy (Max 3 Approved Devices) & Atomic Refresh Token Rotation
    db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        device_id TEXT PRIMARY KEY,
        device_name TEXT,
        user_agent TEXT,
        platform TEXT,
        requested_by_uid TEXT,
        requested_role TEXT,
        status TEXT NOT NULL CHECK(status IN ('PENDING', 'APPROVED', 'REVOKED', 'REJECTED')),
        approved_by_uid TEXT,
        approved_at TEXT,
        revoked_by_uid TEXT,
        revoked_at TEXT,
        last_seen_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        token_id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL,
        session_id TEXT NOT NULL REFERENCES user_sessions(session_id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        device_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        generation INTEGER NOT NULL,
        replaced_by_hash TEXT,
        rotated_at TEXT,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_family ON refresh_tokens(family_id, generation);
      CREATE INDEX IF NOT EXISTS idx_refresh_session ON refresh_tokens(session_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_device ON refresh_tokens(device_id);
    `);

    const sessionCols = new Set(
      (db.prepare(`PRAGMA table_info(user_sessions)`).all() as Array<{ name: string }>).map(c => c.name)
    );
    if (!sessionCols.has('device_id')) db.exec(`ALTER TABLE user_sessions ADD COLUMN device_id TEXT;`);
    if (!sessionCols.has('csrf_token_enc')) db.exec(`ALTER TABLE user_sessions ADD COLUMN csrf_token_enc TEXT;`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_device ON user_sessions(user_id, device_id);`);

    const applied = db.prepare(`SELECT 1 FROM schema_migrations WHERE version = 1`).get();
    if (!applied) {
      db.prepare(`INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)`)
        .run(1, 'initial_12_table_enterprise_admin_schema', new Date().toISOString());
    }
    const v2Applied = db.prepare(`SELECT 1 FROM schema_migrations WHERE version = 2`).get();
    if (!v2Applied) {
      db.prepare(`INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)`)
        .run(2, 'user_aadhaar_encryption_and_single_use_reset_tokens', new Date().toISOString());
    }
    const v3Applied = db.prepare(`SELECT 1 FROM schema_migrations WHERE version = 3`).get();
    if (!v3Applied) {
      db.prepare(`INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)`)
        .run(3, 'allow_admin_duplicate_mobile_aadhaar_exception', new Date().toISOString());
    }
    const v4Applied = db.prepare(`SELECT 1 FROM schema_migrations WHERE version = 4`).get();
    if (!v4Applied) {
      db.prepare(`INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)`)
        .run(4, 'global_device_registration_and_atomic_refresh_rotation', new Date().toISOString());
    }
  }

  private migrateLegacyMainAdminUidIfNeeded(): void {
    const db = this.sqlite;
    const oldAdmin = db.prepare(`SELECT * FROM users WHERE user_id = 'MC2600000' OR is_main_admin = 1 LIMIT 1`).get() as RelationalUserRow | undefined;
    if (!oldAdmin) return;
    if (
      oldAdmin.user_id === MAIN_ADMIN_UID &&
      oldAdmin.full_name === MAIN_ADMIN_NAME &&
      oldAdmin.mobile_number === MAIN_ADMIN_MOBILE &&
      oldAdmin.aadhaar_hash === MAIN_ADMIN_AADHAAR_HASH
    ) {
      return;
    }

    const oldUid = oldAdmin.user_id;
    const nowIso = new Date().toISOString();
    const envAadhaar = String(process.env.MAIN_ADMIN_AADHAAR || '').replace(/[^0-9]/g, '');
    const aadhaarEnc = envAadhaar.length === 12 ? encryptSensitive(envAadhaar) : (oldAdmin.aadhaar_enc || '');

    db.exec(`
      DROP TRIGGER IF EXISTS trg_protect_main_admin_delete;
      DROP TRIGGER IF EXISTS trg_protect_main_admin_identity;
      DROP TRIGGER IF EXISTS trg_immutable_user_id;
      DROP TRIGGER IF EXISTS trg_single_main_admin_insert;
      DROP TRIGGER IF EXISTS trg_single_main_admin_update;
      PRAGMA foreign_keys = OFF;
    `);
    try {
      db.exec('BEGIN IMMEDIATE');
      db.prepare(`
        UPDATE users SET
          user_id = ?,
          username = 'mc-adm-14012025',
          full_name = ?,
          mobile_number = ?,
          aadhaar_hash = ?,
          aadhaar_masked = ?,
          aadhaar_enc = COALESCE(NULLIF(?, ''), aadhaar_enc),
          designation = 'Administrator',
          role_id = 'ADMIN',
          status = 'ACTIVE',
          is_main_admin = 1,
          updated_at = ?
        WHERE user_id = ?
      `).run(MAIN_ADMIN_UID, MAIN_ADMIN_NAME, MAIN_ADMIN_MOBILE, MAIN_ADMIN_AADHAAR_HASH, MAIN_ADMIN_AADHAAR_MASKED, aadhaarEnc, nowIso, oldUid);

      if (oldUid !== MAIN_ADMIN_UID) {
        db.prepare(`UPDATE user_permissions SET user_id = ? WHERE user_id = ?`).run(MAIN_ADMIN_UID, oldUid);
        db.prepare(`UPDATE user_sessions SET user_id = ? WHERE user_id = ?`).run(MAIN_ADMIN_UID, oldUid);
        db.prepare(`UPDATE password_reset_requests SET user_id = ? WHERE user_id = ?`).run(MAIN_ADMIN_UID, oldUid);
        db.prepare(`UPDATE password_reset_references SET user_id = ? WHERE user_id = ?`).run(MAIN_ADMIN_UID, oldUid);
        db.prepare(`UPDATE audit_logs SET actor_user_id = ? WHERE actor_user_id = ?`).run(MAIN_ADMIN_UID, oldUid);
        db.prepare(`UPDATE audit_logs SET target_user_id = ? WHERE target_user_id = ?`).run(MAIN_ADMIN_UID, oldUid);
      }
      db.prepare(`INSERT OR REPLACE INTO system_settings (setting_key, setting_value, updated_at, updated_by) VALUES ('main_admin_uid', ?, ?, 'SYSTEM_MIGRATION')`)
        .run(MAIN_ADMIN_UID, nowIso);
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    } finally {
      db.exec(`PRAGMA foreign_keys = ON;`);
      this.runSchemaAndMigrations();
    }
  }

  private seedRolesAndPermissions(): void {
    const db = this.sqlite;
    const now = new Date().toISOString();

    const insertRole = db.prepare(`
      INSERT OR IGNORE INTO roles (role_id, role_name, description, created_at)
      VALUES (?, ?, ?, ?)
    `);
    insertRole.run('ADMIN', 'ADMINISTRATION', 'Full Master Control over MUN COMPUTER ERP System', now);
    insertRole.run('MANAGER', 'MANAGER', 'Operational Management & Staff Account Control', now);
    insertRole.run('STAFF', 'STAFF', 'Counter & Field Operations Access', now);

    const insertPerm = db.prepare(`
      INSERT OR IGNORE INTO permissions (permission_id, menu_id, action, description)
      VALUES (?, ?, ?, ?)
    `);
    const insertRolePerm = db.prepare(`
      INSERT OR REPLACE INTO role_permissions (role_id, permission_id, allowed)
      VALUES (?, ?, ?)
    `);

    const roleDefaults = {
      ADMIN: getDefaultRolePermissions('ADMIN'),
      MANAGER: getDefaultRolePermissions('MANAGER'),
      STAFF: getDefaultRolePermissions('STAFF')
    };

    db.exec('BEGIN IMMEDIATE');
    try {
      for (const def of MENU_DEFINITIONS) {
        for (const act of PERMISSION_ACTIONS) {
          const permId = `${def.id}.${act}`;
          insertPerm.run(permId, def.id, act, `${def.label} — ${act}`);
          for (const roleId of ['ADMIN', 'MANAGER', 'STAFF'] as const) {
            const allowed = roleDefaults[roleId].menus[def.id]?.[act] ? 1 : 0;
            insertRolePerm.run(roleId, permId, allowed);
          }
        }
      }
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
  }

  private seedDefaultSettings(): void {
    const db = this.sqlite;
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO system_settings (setting_key, setting_value, updated_at, updated_by)
      VALUES (?, ?, ?, ?)
    `);
    for (const [k, v] of Object.entries(DEFAULT_SYSTEM_SETTINGS)) {
      stmt.run(k, v, now, 'SYSTEM_BOOTSTRAP');
    }
  }

  private migrateLegacyUsersIfNeeded(): void {
    const db = this.sqlite;
    const countRow = db.prepare(`SELECT COUNT(*) AS cnt FROM users`).get() as { cnt: number };
    if (countRow && countRow.cnt > 0) return;

    if (!fs.existsSync(USERS_JSON_FILE)) return;
    let parsed: any[] = [];
    try {
      const raw = JSON.parse(fs.readFileSync(USERS_JSON_FILE, 'utf-8'));
      if (Array.isArray(raw)) parsed = raw;
    } catch {
      return;
    }
    if (parsed.length === 0) return;

    const ist = getKolkataNow();
    const usedUsernames = new Set<string>();
    const usedMobiles = new Set<string>();
    const usedEmails = new Set<string>();

    db.exec('BEGIN IMMEDIATE');
    try {
      for (let i = 0; i < parsed.length; i++) {
        const u = parsed[i] || {};
        const isLegacyRoot =
          u.uid === MAIN_ADMIN_UID ||
          u.uid === 'MUNCOMPUTER-2019' ||
          u.uid === 'MUNCM-2026' ||
          u.isSuperAdmin === true ||
          u.isMainAdmin === true;

        let targetUid = String(u.uid || '').trim().toUpperCase();
        if (isLegacyRoot) {
          targetUid = MAIN_ADMIN_UID;
        } else if (!/^MC\d{7,}$/.test(targetUid)) {
          // Allocate clean MCYYSSSSS for any non-root legacy account
          const rowCounter = db.prepare(`SELECT last_serial FROM global_serial_counters WHERE yy = ?`).get(ist.yy) as { last_serial: number } | undefined;
          const nextSerial = (rowCounter?.last_serial || 0) + 1;
          db.prepare(`
            INSERT INTO global_serial_counters (yy, last_serial, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(yy) DO UPDATE SET last_serial = excluded.last_serial, updated_at = excluded.updated_at
          `).run(ist.yy, nextSerial, ist.isoTimestamp);
          targetUid = `MC${ist.yy}${String(nextSerial).padStart(5, '0')}`;
        } else {
          // Sync counter floor if an MCYYSSSSS account already existed
          const m = targetUid.match(/^MC(\d{2})(\d{5,})$/);
          if (m && targetUid !== MAIN_ADMIN_UID) {
            const yy = m[1];
            const sl = parseInt(m[2], 10);
            const cur = db.prepare(`SELECT last_serial FROM global_serial_counters WHERE yy = ?`).get(yy) as { last_serial: number } | undefined;
            if (sl > (cur?.last_serial || 0)) {
              db.prepare(`
                INSERT INTO global_serial_counters (yy, last_serial, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(yy) DO UPDATE SET last_serial = excluded.last_serial, updated_at = excluded.updated_at
              `).run(yy, sl, ist.isoTimestamp);
            }
          }
        }

        let username = String(u.username || targetUid).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
        if (!username || usedUsernames.has(username)) username = targetUid.toLowerCase();
        usedUsernames.add(username);

        let mobile10 = String(u.phone || u.mobileNumber || '').replace(/[^0-9]/g, '').slice(-10);
        if (mobile10.length !== 10 || usedMobiles.has(mobile10)) {
          mobile10 = isLegacyRoot ? '8101352105' : `90000${String(10000 + i).slice(-5)}`;
        }
        usedMobiles.add(mobile10);

        let email = String(u.email || '').trim().toLowerCase();
        if (!email || usedEmails.has(email)) {
          email = `${targetUid.toLowerCase()}@muncomputer.local`;
        }
        usedEmails.add(email);

        const roleId: CoreRole = isLegacyRoot ? 'ADMIN' : normalizeCoreRole(u.role);
        const status: CoreAccountStatus = isLegacyRoot ? 'ACTIVE' : normalizeCoreStatus(u.status);
        const regDate = String(u.registrationDate || (u.createdAt ? String(u.createdAt).split('T')[0] : ist.isoDate));
        const regTime = String(u.registrationTime || ist.time24);
        const nowIso = new Date().toISOString();

        db.prepare(`
          INSERT OR IGNORE INTO users (
            user_id, username, full_name, mobile_number, email, role_id, address, status, is_main_admin,
            password_hash, must_change_password, session_version, failed_login_attempts, failed_reset_attempts,
            locked_until, mfa_enabled, mfa_secret_enc, created_by, registration_date, registration_time,
            designation, father_name, mother_name, dob, district, area_type, block_or_municipality,
            gp_or_ward, village_or_ward, post_office, police_station, pin_code,
            extra_permissions_json, daily_password_change_date, daily_password_change_count,
            password_change_count, password_history_json, approval_history_json,
            login_count, last_login_at, last_login_panel, password_changed_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          targetUid,
          username,
          String(u.name || u.fullName || (isLegacyRoot ? 'Mamun Reja (Administration)' : 'User')).trim(),
          mobile10,
          email,
          roleId,
          String(u.address || 'MUN COMPUTER, Mamudpur, Juginda, Domkal, Murshidabad - 742406').trim(),
          status,
          isLegacyRoot ? 1 : 0,
          String(u.passwordHash || bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10)),
          isLegacyRoot ? 0 : (u.mustChangePassword ? 1 : 0),
          Number(u.sessionVersion || 1),
          Number(u.failedLoginAttempts || 0),
          Number(u.failedResetAttempts || 0),
          u.lockedUntil || null,
          0,
          null,
          String(u.approvedByUid || 'SYSTEM_MIGRATION'),
          regDate,
          regTime,
          String(u.designation || (isLegacyRoot ? 'Proprietor & Chief Administrator' : roleId)),
          String(u.fatherName || ''),
          String(u.motherName || ''),
          String(u.dob || ''),
          String(u.district || 'Murshidabad'),
          u.areaType === 'URBAN' ? 'URBAN' : 'RURAL',
          String(u.blockOrMunicipality || ''),
          String(u.gpOrWard || ''),
          String(u.villageOrWard || ''),
          String(u.postOffice || ''),
          String(u.policeStation || ''),
          String(u.pinCode || ''),
          JSON.stringify(u.extraPermissions || {}),
          String(u.dailyPasswordChangeDate || ''),
          Number(u.dailyPasswordChangeCount || 0),
          Number(u.passwordChangeCount || 0),
          JSON.stringify(Array.isArray(u.passwordHistory) ? u.passwordHistory : []),
          JSON.stringify(Array.isArray(u.approvalHistory) ? u.approvalHistory : []),
          Number(u.loginCount || 0),
          u.lastLoginAt || null,
          u.lastLoginPanel || null,
          u.passwordChangedAt || null,
          String(u.createdAt || nowIso),
          String(u.updatedAt || nowIso)
        );

        if (u.permissionOverrides && typeof u.permissionOverrides === 'object') {
          for (const [menuId, actions] of Object.entries(u.permissionOverrides)) {
            db.prepare(`
              INSERT OR REPLACE INTO user_permissions (user_id, menu_id, actions_json, extra_json, updated_at, updated_by)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(targetUid, menuId, JSON.stringify(actions || {}), JSON.stringify(u.extraPermissions || {}), nowIso, 'SYSTEM_MIGRATION');
          }
        }
      }
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
  }

  private migrateLegacyAuditLogsIfNeeded(): void {
    const db = this.sqlite;
    const countRow = db.prepare(`SELECT COUNT(*) AS cnt FROM audit_logs`).get() as { cnt: number };
    if (countRow && countRow.cnt > 0) return;

    if (!fs.existsSync(AUDIT_LOGS_JSON_FILE)) return;
    let logs: any[] = [];
    try {
      const raw = JSON.parse(fs.readFileSync(AUDIT_LOGS_JSON_FILE, 'utf-8'));
      if (Array.isArray(raw)) logs = raw;
    } catch {
      return;
    }
    if (logs.length === 0) return;

    const ordered = [...logs].reverse();
    db.exec('BEGIN IMMEDIATE');
    try {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO audit_logs (
          audit_uid, timestamp, action, actor_user_id, target_user_id, details, ip_address, meta_json, prev_hash, entry_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < ordered.length; i++) {
        const l = ordered[i] || {};
        const auditUid = String(l.id || `AUD-MIG-${String(i + 1).padStart(6, '0')}`);
        const ts = String(l.timestamp || new Date().toISOString());
        const action = String(l.action || 'SYSTEM_EVENT');
        const actor = l.uid ? String(l.uid) : 'SYSTEM';
        const target = l.targetUid ? String(l.targetUid) : null;
        const details = String(l.details || action);
        const ip = l.ip ? String(l.ip) : null;
        const prevHash = String(l.prevHash || 'GENESIS');
        const entryHash = String(
          l.entryHash ||
          crypto.createHash('sha256').update(JSON.stringify({ auditUid, ts, action, details, actor, prevHash })).digest('hex')
        );
        stmt.run(auditUid, ts, action, actor, target, details, ip, JSON.stringify(l), prevHash, entryHash);
      }
      db.exec('COMMIT');
    } catch {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    }
  }

  private ensureMainAdminAccountSync(): void {
    const db = this.sqlite;
    const existing = db.prepare(`SELECT * FROM users WHERE user_id = ?`).get(MAIN_ADMIN_UID) as RelationalUserRow | undefined;
    if (existing) return;

    const ist = getKolkataNow();
    const nowIso = new Date().toISOString();
    const defaultHash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10);
    const envAadhaar = String(process.env.MAIN_ADMIN_AADHAAR || '').replace(/[^0-9]/g, '');
    const aadhaarEnc = envAadhaar.length === 12 ? encryptSensitive(envAadhaar) : '';

    db.prepare(`
      INSERT INTO users (
        user_id, username, full_name, mobile_number, email, role_id, address, status, is_main_admin,
        password_hash, must_change_password, session_version, failed_login_attempts, failed_reset_attempts,
        mfa_enabled, created_by, registration_date, registration_time, designation,
        aadhaar_enc, aadhaar_hash, aadhaar_masked,
        district, area_type, block_or_municipality, gp_or_ward, village_or_ward, post_office, pin_code,
        extra_permissions_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'ADMIN', ?, 'ACTIVE', 1, ?, 0, 1, 0, 0, 0, 'SYSTEM_BOOTSTRAP', ?, ?, ?, ?, ?, ?, 'Murshidabad', 'URBAN', 'Domkal Municipality', 'WARD 16', 'Mamudpur (Ward 16)', 'Juginda', '742406', '{}', ?, ?)
    `).run(
      MAIN_ADMIN_UID,
      'mc-adm-14012025',
      MAIN_ADMIN_NAME,
      MAIN_ADMIN_MOBILE,
      'muncomputer2019@gmail.com',
      'MUN COMPUTER, Mamudpur, Juginda, Domkal, Murshidabad - 742406',
      defaultHash,
      ist.isoDate,
      ist.time24,
      'Administrator',
      aadhaarEnc,
      MAIN_ADMIN_AADHAAR_HASH,
      MAIN_ADMIN_AADHAAR_MASKED,
      nowIso,
      nowIso
    );

    this.logAudit('SYSTEM_INIT', `Permanent Master Administrator account provisioned: ${MAIN_ADMIN_UID} (${MAIN_ADMIN_NAME})`, 'SYSTEM', MAIN_ADMIN_UID);
  }

  // -------------------------------------------------------------------------
  // ROW HYDRATION HELPERS
  // -------------------------------------------------------------------------
  private getPermissionOverridesForUser(userId: string): Record<string, Partial<MenuPermissionSet>> {
    const rows = this.getDb()
      .prepare(`SELECT menu_id, actions_json FROM user_permissions WHERE user_id = ?`)
      .all(userId) as Array<{ menu_id: string; actions_json: string }>;
    const out: Record<string, Partial<MenuPermissionSet>> = {};
    for (const r of rows) {
      try {
        out[r.menu_id] = JSON.parse(r.actions_json);
      } catch {
        // ignore invalid json
      }
    }
    return out;
  }

  private hydrateUser(row: RelationalUserRow): ApiUserRecord {
    let extraPerms: Partial<ExtraPermissionControls> = {};
    try {
      if (row.extra_permissions_json) extraPerms = JSON.parse(row.extra_permissions_json);
    } catch { /* ignore */ }

    let passwordHistory: Array<{ changedAt: string; method: string }> = [];
    try {
      if (row.password_history_json) {
        const rawHist = JSON.parse(row.password_history_json);
        if (Array.isArray(rawHist)) {
          passwordHistory = rawHist.map((item: any) => ({
            changedAt: String(item?.changedAt || ''),
            method: String(item?.method || '')
          }));
        }
      }
    } catch { /* ignore */ }

    let approvalHistory: Array<{ timestamp: string; action: string; actorUid: string; notes?: string }> = [];
    try {
      if (row.approval_history_json) approvalHistory = JSON.parse(row.approval_history_json);
    } catch { /* ignore */ }

    const isMain = Boolean(row.is_main_admin === 1 || row.user_id === MAIN_ADMIN_UID);
    const permissionOverrides = isMain ? {} : this.getPermissionOverridesForUser(row.user_id);

    return {
      uid: row.user_id,
      userId: row.user_id,
      requestId: row.user_id,
      username: row.username,
      name: row.full_name,
      fullName: row.full_name,
      role: isMain ? 'ADMIN' : normalizeCoreRole(row.role_id),
      isMainAdmin: isMain,
      isSuperAdmin: isMain,
      designation: row.designation || (isMain ? 'Administrator' : row.role_id),
      phone: row.mobile_number,
      mobileNumber: row.mobile_number,
      phoneMasked: maskPhone(row.mobile_number),
      aadhaarMasked: row.aadhaar_masked || (isMain ? MAIN_ADMIN_AADHAAR_MASKED : ''),
      email: row.email,
      address: row.address,
      status: isMain ? 'ACTIVE' : normalizeCoreStatus(row.status),
      approvalStatus: 'APPROVED',
      verificationStatus: 'VERIFIED',
      mustChangePassword: Boolean(row.must_change_password),
      sessionVersion: Number(row.session_version || 1),
      failedLoginAttempts: Number(row.failed_login_attempts || 0),
      failedResetAttempts: Number(row.failed_reset_attempts || 0),
      lockedUntil: row.locked_until || null,
      mfaEnabled: Boolean(row.mfa_enabled),
      createdBy: row.created_by || 'SYSTEM',
      registrationDate: row.registration_date,
      registrationTime: row.registration_time,
      fatherName: row.father_name || '',
      motherName: row.mother_name || '',
      dob: row.dob || '',
      district: row.district || 'Murshidabad',
      areaType: row.area_type === 'URBAN' ? 'URBAN' : 'RURAL',
      blockOrMunicipality: row.block_or_municipality || '',
      gpOrWard: row.gp_or_ward || '',
      villageOrWard: row.village_or_ward || '',
      postOffice: row.post_office || '',
      policeStation: row.police_station || '',
      pinCode: row.pin_code || '',
      dailyPasswordChangeDate: row.daily_password_change_date || '',
      dailyPasswordChangeCount: Number(row.daily_password_change_count || 0),
      passwordChangeCount: Number(row.password_change_count || 0),
      passwordHistory,
      approvalHistory,
      loginCount: Number(row.login_count || 0),
      lastLoginAt: row.last_login_at || '',
      lastLoginPanel: row.last_login_panel || '',
      passwordChangedAt: row.password_changed_at || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      permissionOverrides,
      extraPermissions: extraPerms
    };
  }

  // -------------------------------------------------------------------------
  // USER QUERIES
  // -------------------------------------------------------------------------
  findUserRowByUidOrUsername(identifier: string): RelationalUserRow | null {
    const clean = String(identifier || '').trim();
    if (!clean) return null;
    const row = this.getDb()
      .prepare(`SELECT * FROM users WHERE UPPER(user_id) = UPPER(?) OR LOWER(username) = LOWER(?) LIMIT 1`)
      .get(clean, clean) as RelationalUserRow | undefined;
    return row || null;
  }

  getUserByUid(userId: string): ApiUserRecord | null {
    const clean = String(userId || '').trim().toUpperCase();
    if (!clean) return null;
    const row = this.getDb().prepare(`SELECT * FROM users WHERE UPPER(user_id) = ? LIMIT 1`).get(clean) as RelationalUserRow | undefined;
    return row ? this.hydrateUser(row) : null;
  }

  listUsers(filter?: { role?: string; status?: string; q?: string }): ApiUserRecord[] {
    let rows = this.getDb()
      .prepare(`SELECT * FROM users ORDER BY is_main_admin DESC, created_at DESC, id DESC`)
      .all() as unknown as RelationalUserRow[];

    if (filter?.role && filter.role !== 'ALL') {
      const targetRole = normalizeCoreRole(filter.role);
      rows = rows.filter(r => r.role_id === targetRole);
    }
    if (filter?.status && filter.status !== 'ALL') {
      const st = normalizeCoreStatus(filter.status);
      rows = rows.filter(r => r.status === st);
    }
    if (filter?.q && filter.q.trim()) {
      const q = filter.q.trim().toLowerCase();
      rows = rows.filter(r =>
        [r.user_id, r.username, r.full_name, r.mobile_number, r.email, r.role_id, r.status, r.address]
          .some(v => String(v || '').toLowerCase().includes(q))
      );
    }
    return rows.map(r => this.hydrateUser(r));
  }

  computeUserStats(): {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    suspendedUsers: number;
    adminCount: number;
    managerCount: number;
    staffCount: number;
    pendingRegistrations: number;
    approvedUsers: number;
    rejectedRegistrations: number;
  } {
    const rows = this.getDb().prepare(`SELECT role_id, status FROM users`).all() as Array<{ role_id: string; status: string }>;
    return {
      totalUsers: rows.length,
      activeUsers: rows.filter(u => u.status === 'ACTIVE').length,
      inactiveUsers: rows.filter(u => u.status === 'INACTIVE').length,
      suspendedUsers: rows.filter(u => u.status === 'SUSPENDED').length,
      adminCount: rows.filter(u => u.role_id === 'ADMIN').length,
      managerCount: rows.filter(u => u.role_id === 'MANAGER').length,
      staffCount: rows.filter(u => u.role_id === 'STAFF').length,
      pendingRegistrations: 0,
      approvedUsers: rows.length,
      rejectedRegistrations: 0
    };
  }

  getNextManagedUidPreview(role: 'MANAGER' | 'STAFF' = 'STAFF'): { yy: string; year: string; nextSerial: number; nextGlobalSl: string; previewUid: string } {
    const ist = getKolkataNow();
    const status = globalReferenceEngine.getCounterStatus(role === 'MANAGER' ? 'MGR' : 'STF');
    return {
      yy: ist.yy,
      year: String(status.creation_year),
      nextSerial: status.next_serial,
      nextGlobalSl: status.next_global_sl,
      previewUid: status.preview_reference_no
    };
  }

  // -------------------------------------------------------------------------
  // ATOMIC USER CREATION (MC-MGR-YYYY-XXXXXXXX / MC-STF-YYYY-XXXXXXXX)
  // -------------------------------------------------------------------------
  async createManagedUserAtomic(
    input: {
      fullName: string;
      username?: string;
      mobileNumber: string;
      aadhaarNumber: string;
      email?: string;
      role: 'MANAGER' | 'STAFF';
      address: string;
      status?: CoreAccountStatus;
      designation?: string;
      fatherName?: string;
      motherName?: string;
      dob: string;
      district?: string;
      areaType?: 'RURAL' | 'URBAN';
      blockOrMunicipality?: string;
      gpOrWard?: string;
      villageOrWard?: string;
      postOffice?: string;
      policeStation?: string;
      pinCode?: string;
      allowDuplicateException?: boolean;
      duplicateExceptionReason?: string;
      tempPassword: string;
    },
    actorUid: string
  ): Promise<{ success: boolean; user?: ApiUserRecord; message: string; code?: number }> {
    const fullName = String(input.fullName || '').trim();
    const rawUsername = String(input.username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const mobileRaw = String(input.mobileNumber || '').trim();
    const mobile10 = mobileRaw.replace(/[^0-9]/g, '');
    const aadhaarRaw = String(input.aadhaarNumber || '').trim();
    const aadhaar12 = aadhaarRaw.replace(/[^0-9]/g, '');
    const dob = String(input.dob || '').trim();
    const rawEmail = String(input.email || '').trim().toLowerCase();
    const roleUpper = String(input.role || '').trim().toUpperCase();
    const address = String(input.address || '').trim();
    const status: CoreAccountStatus = 'ACTIVE';

    if (!fullName || fullName.length < 2) {
      return { success: false, code: 400, message: 'Full Name is required (minimum 2 characters).' };
    }
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob))) {
      return { success: false, code: 400, message: 'Valid Date of Birth is required.' };
    }
    if (!/^\d{12}$/.test(aadhaar12)) {
      return { success: false, code: 400, message: 'Valid 12-digit Aadhaar Number (0-9 only) is required.' };
    }
    if (!/^\d{10}$/.test(mobile10)) {
      return { success: false, code: 400, message: 'Valid 10-digit Mobile Number (0-9 only) is required.' };
    }
    if (rawUsername && (rawUsername.length < 3 || rawUsername.length > 40)) {
      return { success: false, code: 400, message: 'Username must be 3-40 characters (letters/numbers/._- only).' };
    }
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return { success: false, code: 400, message: 'Valid Email Address is required.' };
    }
    if (roleUpper !== 'MANAGER' && roleUpper !== 'STAFF') {
      return {
        success: false,
        code: 400,
        message: 'Managed accounts can only be created with role MANAGER or STAFF. MC-ADM-14012025 is the exclusive Master Administrator account.'
      };
    }
    if (!address || address.length < 5) {
      return { success: false, code: 400, message: 'Complete Full Address is required.' };
    }

    const canOverrideDup =
      actorUid.toUpperCase() === MAIN_ADMIN_UID &&
      Boolean(input.allowDuplicateException) &&
      String(input.duplicateExceptionReason || '').trim().length >= 5;

    // Hash password with Argon2id & encrypt Aadhaar before opening SQLite write transaction lock
    const passwordHash = await hashPasswordArgon2id(input.tempPassword);
    const aadhaarEnc = encryptSensitive(aadhaar12);
    const aadhaarHash = hashSensitive(aadhaar12);
    const aadhaarMasked = maskAadhaar(aadhaar12);
    const ist = getKolkataNow();

    try {
      const createdUid = this.runImmediateTransaction(() => {
        const db = this.getDb();

        if (rawUsername) {
          const dupU = db.prepare(`SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`).get(rawUsername);
          if (dupU) throw Object.assign(new Error(`Username '${rawUsername}' is already taken.`), { statusCode: 409 });
        }
        if (rawEmail) {
          const dupE = db.prepare(`SELECT user_id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`).get(rawEmail);
          if (dupE) throw Object.assign(new Error(`Email '${rawEmail}' is already registered to another account.`), { statusCode: 409 });
        }

        if (!canOverrideDup) {
          const dupMobile = db.prepare(`SELECT user_id FROM users WHERE mobile_number = ? LIMIT 1`).get(mobile10);
          if (dupMobile) {
            throw Object.assign(new Error(`Mobile number '${mobile10}' is already registered to another account.`), { statusCode: 409 });
          }
          const dupAadhaar = db.prepare(`SELECT user_id FROM users WHERE aadhaar_hash = ? LIMIT 1`).get(aadhaarHash);
          if (dupAadhaar) {
            throw Object.assign(new Error(`Aadhaar number (${aadhaarMasked}) is already registered to another account.`), { statusCode: 409 });
          }
        }

        // Allocate authoritative 8-digit Global Reference UID (MC-MGR-YYYY-XXXXXXXX / MC-STF-YYYY-XXXXXXXX) inside the SAME BEGIN IMMEDIATE transaction
        const refPrefix = roleUpper === 'MANAGER' ? 'MGR' : 'STF';
        const refAlloc = globalReferenceEngine.generateGlobalReferenceInTx(db, {
          prefix: refPrefix,
          entityType: roleUpper === 'MANAGER' ? 'USER_MANAGER' : 'USER_STAFF',
          createdBy: actorUid
        });
        const candidateUid = refAlloc.reference_no;
        const username = rawUsername || candidateUid.toLowerCase();
        const email = rawEmail || `${candidateUid.toLowerCase()}@muncomputer.local`;

        const initialApprovalHistory = [
          {
            timestamp: ist.isoTimestamp,
            action: 'ACCOUNT_CREATED',
            actorUid,
            notes: `${roleUpper} account ${candidateUid} provisioned by ${actorUid} (${ist.isoDate} ${ist.time24} IST)${canOverrideDup ? ` [Dup Exception: ${String(input.duplicateExceptionReason).trim()}]` : ''}.`
          }
        ];

        const initialPasswordHistory = [
          {
            changedAt: ist.isoTimestamp,
            method: 'INITIAL_TEMP_PASSWORD',
            hash: passwordHash
          }
        ];

        db.prepare(`
          INSERT INTO users (
            user_id, username, full_name, mobile_number, email, role_id, address, status, is_main_admin,
            password_hash, must_change_password, session_version, failed_login_attempts, failed_reset_attempts,
            mfa_enabled, created_by, registration_date, registration_time,
            designation, father_name, mother_name, dob, aadhaar_enc, aadhaar_hash, aadhaar_masked,
            district, area_type, block_or_municipality,
            gp_or_ward, village_or_ward, post_office, police_station, pin_code,
            extra_permissions_json, password_history_json, approval_history_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, 1, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)
        `).run(
          candidateUid,
          username,
          fullName,
          mobile10,
          email,
          roleUpper,
          address,
          status,
          passwordHash,
          actorUid,
          ist.isoDate,
          ist.time24,
          String(input.designation || (roleUpper === 'MANAGER' ? 'Operations Manager' : 'Front Desk Operator')).trim(),
          String(input.fatherName || '').trim(),
          String(input.motherName || '').trim(),
          dob,
          aadhaarEnc,
          aadhaarHash,
          aadhaarMasked,
          String(input.district || 'Murshidabad').trim(),
          input.areaType === 'URBAN' ? 'URBAN' : 'RURAL',
          String(input.blockOrMunicipality || '').trim(),
          String(input.gpOrWard || '').trim(),
          String(input.villageOrWard || '').trim(),
          String(input.postOffice || '').trim(),
          String(input.policeStation || '').trim(),
          String(input.pinCode || '').replace(/[^0-9]/g, '').slice(0, 6),
          JSON.stringify(initialPasswordHistory),
          JSON.stringify(initialApprovalHistory),
          ist.isoTimestamp,
          ist.isoTimestamp
        );

        return candidateUid;
      });

      this.logAudit(
        'USER_CREATED',
        `${actorUid} created ${roleUpper} account ${createdUid} (${fullName}, Aadhaar: ${aadhaarMasked})${canOverrideDup ? ' [Authorized Duplicate Exception]' : ''}.`,
        actorUid,
        createdUid,
        { role: roleUpper, status }
      );

      const user = this.getUserByUid(createdUid)!;
      return {
        success: true,
        user,
        message: `${roleUpper} account created successfully with permanent User ID ${createdUid}.`
      };
    } catch (err: any) {
      return {
        success: false,
        code: err?.statusCode || 400,
        message: err?.message || 'Unable to create user account.'
      };
    }
  }

  // -------------------------------------------------------------------------
  // EDIT, STATUS TOGGLE, PASSWORD CHANGE, DELETE (STRICTLY PROTECTING MC2600000)
  // -------------------------------------------------------------------------
  editManagedUser(
    targetUid: string,
    updates: {
      fullName?: string;
      username?: string;
      mobileNumber?: string;
      email?: string;
      role?: string;
      address?: string;
      status?: CoreAccountStatus;
      designation?: string;
      fatherName?: string;
      motherName?: string;
      dob?: string;
      district?: string;
      areaType?: 'RURAL' | 'URBAN';
      blockOrMunicipality?: string;
      gpOrWard?: string;
      villageOrWard?: string;
      postOffice?: string;
      policeStation?: string;
      pinCode?: string;
    },
    actorUid: string
  ): { success: boolean; user?: ApiUserRecord; message: string; code?: number } {
    const cleanUid = String(targetUid || '').trim().toUpperCase();
    const row = this.getDb().prepare(`SELECT * FROM users WHERE UPPER(user_id) = ?`).get(cleanUid) as RelationalUserRow | undefined;
    if (!row) return { success: false, code: 404, message: 'User account not found.' };

    const isMainTarget = row.is_main_admin === 1 || row.user_id === MAIN_ADMIN_UID;
    if (isMainTarget) {
      return { success: false, code: 403, message: 'ACCESS DENIED: Permanent Master Administrator account MC-ADM-14012025 profile cannot be modified, renamed, or deleted via User Management.' };
    }

    const nextFullName = updates.fullName !== undefined && String(updates.fullName).trim()
      ? String(updates.fullName).trim()
      : row.full_name;
    const nextUsername = updates.username !== undefined && String(updates.username).trim()
      ? String(updates.username).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
      : row.username;
    const nextEmail = updates.email !== undefined && String(updates.email).trim()
      ? String(updates.email).trim().toLowerCase()
      : row.email;
    const nextAddress = updates.address !== undefined && String(updates.address).trim()
      ? String(updates.address).trim()
      : row.address;

    let nextMobile = row.mobile_number;
    if (updates.mobileNumber !== undefined && String(updates.mobileNumber).trim()) {
      const m10 = String(updates.mobileNumber).replace(/[^0-9]/g, '').slice(-10);
      if (!/^\d{10}$/.test(m10)) {
        return { success: false, code: 400, message: 'Mobile Number must be a valid 10-digit number.' };
      }
      nextMobile = m10;
    }

    if (!nextUsername || nextUsername.length < 3) {
      return { success: false, code: 400, message: 'Username must be at least 3 characters.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return { success: false, code: 400, message: 'Valid Email Address is required.' };
    }

    let nextRole: CoreRole = row.role_id;
    let nextStatus: CoreAccountStatus = row.status;
    if (!isMainTarget) {
      if (updates.role !== undefined) {
        const requestedRole = String(updates.role).trim().toUpperCase();
        if (requestedRole === 'MANAGER' || requestedRole === 'STAFF') {
          nextRole = requestedRole;
        }
      }
      if (updates.status !== undefined) {
        nextStatus = normalizeCoreStatus(updates.status);
      }
    }

    const nowIso = new Date().toISOString();
    let approvalHist: any[] = [];
    try {
      approvalHist = row.approval_history_json ? JSON.parse(row.approval_history_json) : [];
    } catch { approvalHist = []; }
    approvalHist.unshift({
      timestamp: nowIso,
      action: 'PROFILE_EDITED',
      actorUid,
      notes: `Profile updated by ${actorUid}; permanent User ID ${row.user_id} preserved.`
    });
    if (approvalHist.length > 30) approvalHist.length = 30;

    try {
      this.runImmediateTransaction(() => {
        const db = this.getDb();
        const dup = db
          .prepare(`SELECT user_id, username, mobile_number, email FROM users WHERE user_id <> ? AND (LOWER(username) = LOWER(?) OR mobile_number = ? OR LOWER(email) = LOWER(?)) LIMIT 1`)
          .get(row.user_id, nextUsername, nextMobile, nextEmail) as { user_id: string; username: string; mobile_number: string; email: string } | undefined;

        if (dup) {
          if (dup.username.toLowerCase() === nextUsername) throw Object.assign(new Error(`Username '${nextUsername}' is already in use.`), { statusCode: 409 });
          if (dup.mobile_number === nextMobile) throw Object.assign(new Error(`Mobile number '${nextMobile}' is already registered.`), { statusCode: 409 });
          throw Object.assign(new Error(`Email '${nextEmail}' is already registered.`), { statusCode: 409 });
        }

        const sessionBump = nextStatus !== 'ACTIVE' || nextRole !== row.role_id ? 1 : 0;

        db.prepare(`
          UPDATE users SET
            username = ?,
            full_name = ?,
            mobile_number = ?,
            email = ?,
            role_id = ?,
            address = ?,
            status = ?,
            session_version = session_version + ?,
            designation = ?,
            father_name = ?,
            mother_name = ?,
            dob = ?,
            district = ?,
            area_type = ?,
            block_or_municipality = ?,
            gp_or_ward = ?,
            village_or_ward = ?,
            post_office = ?,
            police_station = ?,
            pin_code = ?,
            approval_history_json = ?,
            updated_at = ?
          WHERE user_id = ?
        `).run(
          nextUsername,
          nextFullName,
          nextMobile,
          nextEmail,
          nextRole,
          nextAddress,
          nextStatus,
          sessionBump,
          updates.designation !== undefined ? String(updates.designation).trim() : (row.designation || nextRole),
          updates.fatherName !== undefined ? String(updates.fatherName).trim() : (row.father_name || ''),
          updates.motherName !== undefined ? String(updates.motherName).trim() : (row.mother_name || ''),
          updates.dob !== undefined ? String(updates.dob).trim() : (row.dob || ''),
          updates.district !== undefined ? String(updates.district).trim() : (row.district || 'Murshidabad'),
          updates.areaType !== undefined ? (updates.areaType === 'URBAN' ? 'URBAN' : 'RURAL') : (row.area_type || 'RURAL'),
          updates.blockOrMunicipality !== undefined ? String(updates.blockOrMunicipality).trim() : (row.block_or_municipality || ''),
          updates.gpOrWard !== undefined ? String(updates.gpOrWard).trim() : (row.gp_or_ward || ''),
          updates.villageOrWard !== undefined ? String(updates.villageOrWard).trim() : (row.village_or_ward || ''),
          updates.postOffice !== undefined ? String(updates.postOffice).trim() : (row.post_office || ''),
          updates.policeStation !== undefined ? String(updates.policeStation).trim() : (row.police_station || ''),
          updates.pinCode !== undefined ? String(updates.pinCode).replace(/[^0-9]/g, '').slice(0, 6) : (row.pin_code || ''),
          JSON.stringify(approvalHist),
          nowIso,
          row.user_id
        );

        if (sessionBump > 0) {
          db.prepare(`UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(nowIso, row.user_id);
        }
      });

      this.logAudit('USER_UPDATED', `${actorUid} updated profile for ${row.user_id} (${nextFullName}).`, actorUid, row.user_id);
      return {
        success: true,
        user: this.getUserByUid(row.user_id)!,
        message: `User profile updated for ${row.user_id}.`
      };
    } catch (err: any) {
      return { success: false, code: err?.statusCode || 400, message: err?.message || 'Failed to update user.' };
    }
  }

  setManagedUserStatus(
    targetUid: string,
    targetStatusInput: CoreAccountStatus | undefined,
    actorUid: string
  ): { success: boolean; status?: CoreAccountStatus; user?: ApiUserRecord; message: string; code?: number } {
    const cleanUid = String(targetUid || '').trim().toUpperCase();
    if (cleanUid === MAIN_ADMIN_UID) {
      return { success: false, code: 403, message: `Permanent Master Administrator account ${MAIN_ADMIN_UID} cannot be deactivated or suspended.` };
    }
    const row = this.getDb().prepare(`SELECT * FROM users WHERE UPPER(user_id) = ?`).get(cleanUid) as RelationalUserRow | undefined;
    if (!row) return { success: false, code: 404, message: 'User account not found.' };
    if (row.is_main_admin === 1) {
      return { success: false, code: 403, message: 'Permanent Main Administration account cannot be deactivated or suspended.' };
    }

    const nextStatus: CoreAccountStatus = targetStatusInput
      ? normalizeCoreStatus(targetStatusInput)
      : (row.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE');

    const nowIso = new Date().toISOString();
    let hist: any[] = [];
    try { hist = row.approval_history_json ? JSON.parse(row.approval_history_json) : []; } catch { hist = []; }
    hist.unshift({
      timestamp: nowIso,
      action: nextStatus === 'ACTIVE' ? 'ACTIVATED' : nextStatus,
      actorUid,
      notes: `Status changed from ${row.status} to ${nextStatus} by ${actorUid}`
    });
    if (hist.length > 30) hist.length = 30;

    this.runImmediateTransaction(() => {
      const db = this.getDb();
      db.prepare(`
        UPDATE users SET
          status = ?,
          session_version = session_version + 1,
          failed_login_attempts = CASE WHEN ? = 'ACTIVE' THEN 0 ELSE failed_login_attempts END,
          failed_reset_attempts = CASE WHEN ? = 'ACTIVE' THEN 0 ELSE failed_reset_attempts END,
          locked_until = CASE WHEN ? = 'ACTIVE' THEN NULL ELSE locked_until END,
          approval_history_json = ?,
          updated_at = ?
        WHERE user_id = ?
      `).run(nextStatus, nextStatus, nextStatus, nextStatus, JSON.stringify(hist), nowIso, row.user_id);

      if (nextStatus !== 'ACTIVE') {
        db.prepare(`UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(nowIso, row.user_id);
      }
    });

    this.logAudit('USER_STATUS_CHANGE', `${actorUid} changed ${row.user_id} status -> ${nextStatus}`, actorUid, row.user_id, { status: nextStatus });
    return {
      success: true,
      status: nextStatus,
      user: this.getUserByUid(row.user_id)!,
      message: `Account ${row.user_id} status updated to ${nextStatus}.`
    };
  }

  async adminSetTemporaryPassword(
    targetUid: string,
    tempPassword: string,
    actorUid: string
  ): Promise<{ success: boolean; message: string; code?: number }> {
    const cleanUid = String(targetUid || '').trim().toUpperCase();
    const row = this.getDb().prepare(`SELECT * FROM users WHERE UPPER(user_id) = ?`).get(cleanUid) as RelationalUserRow | undefined;
    if (!row) return { success: false, code: 404, message: 'User account not found.' };
    if ((row.is_main_admin === 1 || row.user_id === MAIN_ADMIN_UID) && actorUid.toUpperCase() !== MAIN_ADMIN_UID) {
      return { success: false, code: 403, message: `Only Permanent Master Administrator ${MAIN_ADMIN_UID} can reset its own credentials via emergency recovery.` };
    }

    const hash = await hashPasswordArgon2id(tempPassword);
    const nowIso = new Date().toISOString();
    let pwdHist: any[] = [];
    try { pwdHist = row.password_history_json ? JSON.parse(row.password_history_json) : []; } catch { pwdHist = []; }
    pwdHist.unshift({ changedAt: nowIso, method: `ADMIN_TEMP_RESET (${actorUid})`, hash });
    if (pwdHist.length > 5) pwdHist.length = 5;

    this.runImmediateTransaction(() => {
      const db = this.getDb();
      db.prepare(`
        UPDATE users SET
          password_hash = ?,
          must_change_password = 1,
          password_changed_at = ?,
          password_change_count = password_change_count + 1,
          password_history_json = ?,
          session_version = session_version + 1,
          failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = ?
        WHERE user_id = ?
      `).run(hash, nowIso, JSON.stringify(pwdHist), nowIso, row.user_id);

      db.prepare(`UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(nowIso, row.user_id);
    });

    this.logAudit('ADMIN_PASSWORD_RESET', `${actorUid} issued temporary password for ${row.user_id}. Active sessions invalidated.`, actorUid, row.user_id);
    return { success: true, message: `Temporary password generated for ${row.user_id}.` };
  }

  deleteManagedUser(
    targetUid: string,
    actorUid: string,
    reason: string
  ): { success: boolean; deletedUser?: ApiUserRecord; message: string; code?: number } {
    const cleanUid = String(targetUid || '').trim().toUpperCase();
    if (cleanUid === MAIN_ADMIN_UID) {
      return { success: false, code: 403, message: `Permanent Master Administrator account ${MAIN_ADMIN_UID} cannot be deleted.` };
    }
    const row = this.getDb().prepare(`SELECT * FROM users WHERE UPPER(user_id) = ?`).get(cleanUid) as RelationalUserRow | undefined;
    if (!row) return { success: false, code: 404, message: 'User account not found.' };
    if (row.is_main_admin === 1) {
      return { success: false, code: 403, message: 'Permanent Main Administration account cannot be deleted.' };
    }
    if (row.user_id === actorUid.toUpperCase()) {
      return { success: false, code: 400, message: 'You cannot delete your own currently active account.' };
    }

    const snapshot = this.hydrateUser(row);
    try {
      this.runImmediateTransaction(() => {
        this.getDb().prepare(`DELETE FROM users WHERE user_id = ?`).run(row.user_id);
        globalReferenceEngine.markReferenceStatus(row.user_id, 'DELETED', actorUid);
      });
    } catch (err: any) {
      return { success: false, code: 403, message: err?.message || 'Account deletion blocked.' };
    }

    this.logAudit(
      'USER_DELETED',
      `${actorUid} deleted account ${row.user_id} (${row.full_name} - ${row.role_id}). Reason: ${reason}`,
      actorUid,
      row.user_id,
      { role: row.role_id, reason }
    );
    return {
      success: true,
      deletedUser: snapshot,
      message: `User ${snapshot.fullName} (${snapshot.uid}) deleted cleanly. Serial ID ${snapshot.uid} remains permanently retired.`
    };
  }

  // -------------------------------------------------------------------------
  // PERMISSIONS & EXTRA CONTROLS
  // -------------------------------------------------------------------------
  updateUserPermissions(
    targetUid: string,
    payload: {
      permissionOverrides?: Record<string, Partial<MenuPermissionSet>>;
      extraPermissions?: Partial<ExtraPermissionControls>;
      resetToDefaults?: boolean;
    },
    actorUid: string
  ): { success: boolean; user?: ApiUserRecord; message: string; code?: number } {
    const cleanUid = String(targetUid || '').trim().toUpperCase();
    if (cleanUid === MAIN_ADMIN_UID) {
      return { success: false, code: 403, message: `Master Administrator account ${MAIN_ADMIN_UID} permissions cannot be modified or restricted.` };
    }
    const row = this.getDb().prepare(`SELECT * FROM users WHERE UPPER(user_id) = ?`).get(cleanUid) as RelationalUserRow | undefined;
    if (!row) return { success: false, code: 404, message: 'User account not found.' };
    if (row.is_main_admin === 1) {
      return { success: false, code: 403, message: 'Main Administration account permissions cannot be modified.' };
    }

    const nowIso = new Date().toISOString();
    let hist: any[] = [];
    try { hist = row.approval_history_json ? JSON.parse(row.approval_history_json) : []; } catch { hist = []; }
    hist.unshift({
      timestamp: nowIso,
      action: payload.resetToDefaults ? 'PERMISSIONS_RESET' : 'PERMISSIONS_UPDATED',
      actorUid,
      notes: payload.resetToDefaults
        ? `Permissions reset to ${row.role_id} defaults by ${actorUid}`
        : `Individual permissions updated by ${actorUid}`
    });
    if (hist.length > 30) hist.length = 30;

    this.runImmediateTransaction(() => {
      const db = this.getDb();
      if (payload.resetToDefaults) {
        db.prepare(`DELETE FROM user_permissions WHERE user_id = ?`).run(row.user_id);
        db.prepare(`UPDATE users SET extra_permissions_json = '{}', approval_history_json = ?, updated_at = ? WHERE user_id = ?`)
          .run(JSON.stringify(hist), nowIso, row.user_id);
        return;
      }

      if (payload.permissionOverrides && typeof payload.permissionOverrides === 'object') {
        db.prepare(`DELETE FROM user_permissions WHERE user_id = ?`).run(row.user_id);
        const ins = db.prepare(`
          INSERT INTO user_permissions (user_id, menu_id, actions_json, extra_json, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const def of MENU_DEFINITIONS) {
          const ov = payload.permissionOverrides[def.id];
          if (ov && typeof ov === 'object') {
            const cleaned: Record<string, boolean> = {};
            for (const act of PERMISSION_ACTIONS) {
              if (typeof ov[act] === 'boolean') cleaned[act] = ov[act] as boolean;
            }
            if (Object.keys(cleaned).length > 0) {
              ins.run(row.user_id, def.id, JSON.stringify(cleaned), '{}', nowIso, actorUid);
            }
          }
        }
      }

      if (payload.extraPermissions && typeof payload.extraPermissions === 'object') {
        const extOv = payload.extraPermissions;
        const ext: Record<string, any> = {};
        if (extOv.cashOperationLimit !== undefined) ext.cashOperationLimit = Math.max(0, Number(extOv.cashOperationLimit) || 0);
        if (extOv.customerAccessScope === 'ALL' || extOv.customerAccessScope === 'ASSIGNED') ext.customerAccessScope = extOv.customerAccessScope;
        if (extOv.customerAccessLimit !== undefined) ext.customerAccessLimit = Math.max(0, Number(extOv.customerAccessLimit) || 0);
        if (typeof extOv.canApproveTransactions === 'boolean') ext.canApproveTransactions = extOv.canApproveTransactions;
        if (typeof extOv.canViewAllAttendancePhotos === 'boolean') {
          ext.canViewAllAttendancePhotos = row.role_id === 'ADMIN' || row.role_id === 'MANAGER' ? extOv.canViewAllAttendancePhotos : false;
        }
        if (typeof extOv.canManageBackupSettings === 'boolean') ext.canManageBackupSettings = extOv.canManageBackupSettings;
        if (typeof extOv.canManageUserPermissions === 'boolean') {
          ext.canManageUserPermissions = row.role_id === 'ADMIN' || row.role_id === 'MANAGER' ? extOv.canManageUserPermissions : false;
        }
        db.prepare(`UPDATE users SET extra_permissions_json = ?, approval_history_json = ?, updated_at = ? WHERE user_id = ?`)
          .run(JSON.stringify(ext), JSON.stringify(hist), nowIso, row.user_id);
      } else {
        db.prepare(`UPDATE users SET approval_history_json = ?, updated_at = ? WHERE user_id = ?`)
          .run(JSON.stringify(hist), nowIso, row.user_id);
      }
    });

    this.logAudit(
      'USER_PERMISSIONS_UPDATED',
      `${actorUid} updated permissions for ${row.full_name} (${row.user_id})`,
      actorUid,
      row.user_id,
      { resetToDefaults: Boolean(payload.resetToDefaults) }
    );

    return {
      success: true,
      user: this.getUserByUid(row.user_id)!,
      message: `Permissions updated for ${row.full_name} (${row.user_id}).`
    };
  }

  // -------------------------------------------------------------------------
  // LOGIN, SESSIONS, CSRF & MFA
  // -------------------------------------------------------------------------
  recordFailedLoginAttempt(userId: string, ipAddress?: string): {
    locked: boolean;
    lockedUntil?: string;
    remainingAttempts: number;
  } {
    const cleanUid = String(userId || '').trim().toUpperCase();
    const row = this.getDb().prepare(`SELECT failed_login_attempts FROM users WHERE user_id = ?`).get(cleanUid) as { failed_login_attempts: number } | undefined;
    if (!row) return { locked: false, remainingAttempts: 5 };

    const maxAttempts = Number(this.getSetting('max_failed_login_attempts') || 5);
    const lockMins = Number(this.getSetting('lockout_duration_minutes') || 15);
    const nextFails = (row.failed_login_attempts || 0) + 1;

    if (nextFails >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockMins * 60 * 1000).toISOString();
      this.getDb()
        .prepare(`UPDATE users SET failed_login_attempts = 0, locked_until = ?, updated_at = ? WHERE user_id = ?`)
        .run(lockedUntil, new Date().toISOString(), cleanUid);
      this.logAudit('ACCOUNT_LOCKED', `Account ${cleanUid} temporarily locked for ${lockMins} minutes after ${maxAttempts} failed login attempts.`, cleanUid, cleanUid, { ip: ipAddress });
      return { locked: true, lockedUntil, remainingAttempts: 0 };
    }

    this.getDb()
      .prepare(`UPDATE users SET failed_login_attempts = ?, updated_at = ? WHERE user_id = ?`)
      .run(nextFails, new Date().toISOString(), cleanUid);
    return { locked: false, remainingAttempts: maxAttempts - nextFails };
  }

  async upgradeLegacyPasswordHashIfNeeded(userId: string, plainPassword: string): Promise<void> {
    const hash = await hashPasswordArgon2id(plainPassword);
    this.getDb()
      .prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE user_id = ?`)
      .run(hash, new Date().toISOString(), userId);
  }

  // -------------------------------------------------------------------------
  // GLOBAL 3-DEVICE REGISTRATION POLICY & ATOMIC REFRESH TOKEN ROTATION
  // -------------------------------------------------------------------------
  countApprovedDevices(): number {
    const row = this.getDb()
      .prepare(`SELECT COUNT(*) AS cnt FROM devices WHERE status = 'APPROVED'`)
      .get() as { cnt: number };
    return Number(row?.cnt || 0);
  }

  getDevice(deviceId: string): {
    deviceId: string;
    deviceName: string;
    userAgent: string;
    platform: string;
    requestedByUid: string;
    requestedRole: string;
    status: 'PENDING' | 'APPROVED' | 'REVOKED' | 'REJECTED';
    approvedByUid: string | null;
    approvedAt: string | null;
    revokedByUid: string | null;
    revokedAt: string | null;
    lastSeenAt: string | null;
    createdAt: string;
  } | null {
    const cleanId = String(deviceId || '').trim();
    if (!cleanId) return null;
    const row = this.getDb()
      .prepare(`SELECT * FROM devices WHERE device_id = ? LIMIT 1`)
      .get(cleanId) as any;
    if (!row) return null;
    return {
      deviceId: row.device_id,
      deviceName: row.device_name || 'Browser Workstation',
      userAgent: row.user_agent || '',
      platform: row.platform || '',
      requestedByUid: row.requested_by_uid || '',
      requestedRole: row.requested_role || 'STAFF',
      status: row.status,
      approvedByUid: row.approved_by_uid || null,
      approvedAt: row.approved_at || null,
      revokedByUid: row.revoked_by_uid || null,
      revokedAt: row.revoked_at || null,
      lastSeenAt: row.last_seen_at || null,
      createdAt: row.created_at
    };
  }

  listDevices() {
    const rows = this.getDb()
      .prepare(`
        SELECT d.*,
          (SELECT COUNT(*) FROM user_sessions s WHERE s.device_id = d.device_id AND s.revoked_at IS NULL AND s.expires_at > ?) AS active_sessions
        FROM devices d
        ORDER BY
          CASE d.status WHEN 'PENDING' THEN 0 WHEN 'APPROVED' THEN 1 WHEN 'REVOKED' THEN 2 ELSE 3 END,
          COALESCE(d.last_seen_at, d.created_at) DESC
      `)
      .all(new Date().toISOString()) as any[];
    return rows.map((row) => ({
      deviceId: row.device_id,
      deviceName: row.device_name || 'Browser Workstation',
      userAgent: row.user_agent || '',
      platform: row.platform || '',
      requestedByUid: row.requested_by_uid || '',
      requestedRole: row.requested_role || 'STAFF',
      status: row.status as 'PENDING' | 'APPROVED' | 'REVOKED' | 'REJECTED',
      approvedByUid: row.approved_by_uid || null,
      approvedAt: row.approved_at || null,
      revokedByUid: row.revoked_by_uid || null,
      revokedAt: row.revoked_at || null,
      lastSeenAt: row.last_seen_at || null,
      createdAt: row.created_at,
      activeSessions: Number(row.active_sessions || 0)
    }));
  }

  evaluateAndRegisterLoginDevice(params: {
    deviceId: string;
    deviceName?: string;
    userAgent?: string;
    platform?: string;
    userId: string;
    role: string;
    isMainAdmin?: boolean;
  }): {
    allowed: boolean;
    autoBootstrapped?: boolean;
    code?: number;
    errorCode?: 'DEVICE_ID_REQUIRED' | 'DEVICE_PENDING_APPROVAL' | 'DEVICE_LIMIT_REACHED' | 'DEVICE_REVOKED';
    message?: string;
    approvedCount?: number;
    maxDevices: number;
  } {
    const MAX_APPROVED = 3;
    const cleanId = String(params.deviceId || '').trim().slice(0, 128);
    if (!cleanId) {
      return {
        allowed: false,
        code: 400,
        errorCode: 'DEVICE_ID_REQUIRED',
        message: 'Device identifier is required to sign in.',
        maxDevices: MAX_APPROVED
      };
    }

    const cleanName = String(params.deviceName || 'Browser Workstation').trim().slice(0, 120) || 'Browser Workstation';
    const cleanUa = String(params.userAgent || '').slice(0, 240);
    const cleanPlat = String(params.platform || '').slice(0, 64);
    const nowIso = new Date().toISOString();

    type DeviceEvalResult = {
      allowed: boolean;
      autoBootstrapped?: boolean;
      code?: number;
      errorCode?: 'DEVICE_ID_REQUIRED' | 'DEVICE_PENDING_APPROVAL' | 'DEVICE_LIMIT_REACHED' | 'DEVICE_REVOKED';
      message?: string;
      approvedCount?: number;
      maxDevices: number;
    };
    const txOutcome = this.runImmediateTransaction<{
      result: DeviceEvalResult;
      audit?: { eventType: string; description: string; actorUid: string; targetUid?: string };
    }>(() => {
      const db = this.getDb();
      const existing = db.prepare(`SELECT * FROM devices WHERE device_id = ? LIMIT 1`).get(cleanId) as any;
      const approvedCount = Number(
        (db.prepare(`SELECT COUNT(*) AS cnt FROM devices WHERE status = 'APPROVED'`).get() as { cnt: number })?.cnt || 0
      );

      if (existing) {
        if (existing.status === 'APPROVED') {
          db.prepare(`
            UPDATE devices SET
              device_name = COALESCE(NULLIF(?, ''), device_name),
              user_agent = ?,
              platform = COALESCE(NULLIF(?, ''), platform),
              last_seen_at = ?
            WHERE device_id = ?
          `).run(cleanName, cleanUa, cleanPlat, nowIso, cleanId);
          return { result: { allowed: true, approvedCount, maxDevices: MAX_APPROVED } };
        }
        if (existing.status === 'REVOKED' || existing.status === 'REJECTED') {
          return {
            result: {
              allowed: false,
              code: 403,
              errorCode: 'DEVICE_REVOKED',
              message: 'This device has been revoked or rejected by Administration. Contact Main Admin to re-register or remove this device.',
              approvedCount,
              maxDevices: MAX_APPROVED
            }
          };
        }
        // PENDING device
        if (approvedCount >= MAX_APPROVED) {
          return {
            result: {
              allowed: false,
              code: 403,
              errorCode: 'DEVICE_LIMIT_REACHED',
              message: `Global device limit reached (${approvedCount}/${MAX_APPROVED} approved devices active across Admin, Manager & Staff combined). Revoke or remove an existing device first.`,
              approvedCount,
              maxDevices: MAX_APPROVED
            }
          };
        }
        db.prepare(`
          UPDATE devices SET
            device_name = ?,
            user_agent = ?,
            platform = ?,
            requested_by_uid = ?,
            requested_role = ?,
            last_seen_at = ?
          WHERE device_id = ?
        `).run(cleanName, cleanUa, cleanPlat, params.userId, params.role, nowIso, cleanId);
        return {
          result: {
            allowed: false,
            code: 403,
            errorCode: 'DEVICE_PENDING_APPROVAL',
            message: `Device registration (${cleanName}) is pending Administration approval (${approvedCount}/${MAX_APPROVED} slots used). Ask Admin to approve this device in Security Settings.`,
            approvedCount,
            maxDevices: MAX_APPROVED
          }
        };
      }

      // Brand-new device
      if (approvedCount === 0 && (params.isMainAdmin || params.userId === MAIN_ADMIN_UID)) {
        // Bootstrap initial Main Admin workstation cleanly so Admin can log in and approve up to 2 more devices
        db.prepare(`
          INSERT INTO devices (
            device_id, device_name, user_agent, platform, requested_by_uid, requested_role,
            status, approved_by_uid, approved_at, last_seen_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?, ?)
        `).run(cleanId, cleanName, cleanUa, cleanPlat, params.userId, params.role, params.userId, nowIso, nowIso, nowIso);
        return {
          result: { allowed: true, autoBootstrapped: true, approvedCount: 1, maxDevices: MAX_APPROVED },
          audit: {
            eventType: 'DEVICE_AUTO_BOOTSTRAP',
            description: `Bootstrapped initial approved Admin device ${cleanId} (${cleanName}) [1/${MAX_APPROVED}].`,
            actorUid: params.userId,
            targetUid: params.userId
          }
        };
      }

      // Record PENDING request so Admin can view it (or reject if limit full)
      db.prepare(`
        INSERT INTO devices (
          device_id, device_name, user_agent, platform, requested_by_uid, requested_role,
          status, last_seen_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
      `).run(cleanId, cleanName, cleanUa, cleanPlat, params.userId, params.role, nowIso, nowIso);

      if (approvedCount >= MAX_APPROVED) {
        return {
          result: {
            allowed: false,
            code: 403,
            errorCode: 'DEVICE_LIMIT_REACHED',
            message: `Global device limit reached (${approvedCount}/${MAX_APPROVED} approved devices active across Admin, Manager & Staff combined). New device registration is blocked until Admin removes or revokes an existing device.`,
            approvedCount,
            maxDevices: MAX_APPROVED
          },
          audit: {
            eventType: 'DEVICE_BLOCKED_LIMIT',
            description: `Blocked 4th device ${cleanId} (${cleanName}) for ${params.userId}: global limit ${MAX_APPROVED}/${MAX_APPROVED} reached.`,
            actorUid: params.userId,
            targetUid: params.userId
          }
        };
      }

      return {
        result: {
          allowed: false,
          code: 403,
          errorCode: 'DEVICE_PENDING_APPROVAL',
          message: `New device detected (${cleanName}). Admin approval is required before signing in (${approvedCount}/${MAX_APPROVED} approved devices active).`,
          approvedCount,
          maxDevices: MAX_APPROVED
        },
        audit: {
          eventType: 'DEVICE_REQUESTED',
          description: `Device ${cleanId} (${cleanName}) queued for Admin approval by ${params.userId} (${params.role}).`,
          actorUid: params.userId,
          targetUid: params.userId
        }
      };
    });

    if (txOutcome.audit) {
      this.logAudit(txOutcome.audit.eventType, txOutcome.audit.description, txOutcome.audit.actorUid, txOutcome.audit.targetUid);
    }
    return txOutcome.result;
  }

  approveDevice(deviceId: string, actorUid: string): {
    success: boolean;
    code?: number;
    errorCode?: string;
    message: string;
    approvedCount?: number;
  } {
    const MAX_APPROVED = 3;
    const cleanId = String(deviceId || '').trim();
    if (!cleanId) return { success: false, code: 400, message: 'Device ID is required.' };
    const nowIso = new Date().toISOString();

    const txOutcome = this.runImmediateTransaction(() => {
      const db = this.getDb();
      const target = db.prepare(`SELECT * FROM devices WHERE device_id = ? LIMIT 1`).get(cleanId) as any;
      if (!target) return { result: { success: false, code: 404, message: 'Device record not found.' } };
      if (target.status === 'APPROVED') {
        return { result: { success: true, message: 'Device is already approved.', approvedCount: this.countApprovedDevices() } };
      }

      const approvedCount = Number(
        (db.prepare(`SELECT COUNT(*) AS cnt FROM devices WHERE status = 'APPROVED'`).get() as { cnt: number })?.cnt || 0
      );
      if (approvedCount >= MAX_APPROVED) {
        return {
          result: {
            success: false,
            code: 403,
            errorCode: 'DEVICE_LIMIT_REACHED',
            approvedCount,
            message: `Cannot approve device: Global limit of ${MAX_APPROVED} approved devices reached across Admin, Manager & Staff combined. Revoke or remove another device first.`
          }
        };
      }

      db.prepare(`
        UPDATE devices SET
          status = 'APPROVED',
          approved_by_uid = ?,
          approved_at = ?,
          revoked_by_uid = NULL,
          revoked_at = NULL
        WHERE device_id = ?
      `).run(actorUid, nowIso, cleanId);

      return {
        result: {
          success: true,
          message: `Device approved (${approvedCount + 1}/${MAX_APPROVED} global slots used).`,
          approvedCount: approvedCount + 1
        },
        audit: {
          eventType: 'DEVICE_APPROVED',
          description: `Approved device ${cleanId} (${target.device_name || ''}) by ${actorUid} [${approvedCount + 1}/${MAX_APPROVED}].`,
          actorUid,
          targetUid: target.requested_by_uid || undefined
        }
      };
    });

    if (txOutcome.audit) {
      this.logAudit(txOutcome.audit.eventType, txOutcome.audit.description, txOutcome.audit.actorUid, txOutcome.audit.targetUid);
    }
    return txOutcome.result;
  }

  rejectDevice(deviceId: string, actorUid: string): { success: boolean; code?: number; message: string } {
    const cleanId = String(deviceId || '').trim();
    if (!cleanId) return { success: false, code: 400, message: 'Device ID is required.' };
    const nowIso = new Date().toISOString();

    const txOutcome = this.runImmediateTransaction(() => {
      const db = this.getDb();
      const target = db.prepare(`SELECT * FROM devices WHERE device_id = ? LIMIT 1`).get(cleanId) as any;
      if (!target) return { result: { success: false, code: 404, message: 'Device record not found.' } };

      db.prepare(`
        UPDATE devices SET status = 'REJECTED', revoked_by_uid = ?, revoked_at = ? WHERE device_id = ?
      `).run(actorUid, nowIso, cleanId);
      db.prepare(`UPDATE user_sessions SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL`).run(nowIso, cleanId);
      db.prepare(`UPDATE refresh_tokens SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL`).run(nowIso, cleanId);

      return {
        result: { success: true, message: 'Device registration rejected.' },
        audit: {
          eventType: 'DEVICE_REJECTED',
          description: `Rejected device ${cleanId} (${target.device_name || ''}) by ${actorUid}.`,
          actorUid,
          targetUid: target.requested_by_uid || undefined
        }
      };
    });

    if (txOutcome.audit) {
      this.logAudit(txOutcome.audit.eventType, txOutcome.audit.description, txOutcome.audit.actorUid, txOutcome.audit.targetUid);
    }
    return txOutcome.result;
  }

  revokeDevice(deviceId: string, actorUid: string): { success: boolean; code?: number; message: string } {
    const cleanId = String(deviceId || '').trim();
    if (!cleanId) return { success: false, code: 400, message: 'Device ID is required.' };
    const nowIso = new Date().toISOString();

    const txOutcome = this.runImmediateTransaction(() => {
      const db = this.getDb();
      const target = db.prepare(`SELECT * FROM devices WHERE device_id = ? LIMIT 1`).get(cleanId) as any;
      if (!target) return { result: { success: false, code: 404, message: 'Device record not found.' } };

      db.prepare(`
        UPDATE devices SET status = 'REVOKED', revoked_by_uid = ?, revoked_at = ? WHERE device_id = ?
      `).run(actorUid, nowIso, cleanId);
      // Strictly revoke ONLY sessions & refresh tokens bound to this specific device_id
      db.prepare(`UPDATE user_sessions SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL`).run(nowIso, cleanId);
      db.prepare(`UPDATE refresh_tokens SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL`).run(nowIso, cleanId);

      return {
        result: { success: true, message: 'Device revoked. All active sessions on this device were signed out without affecting other devices.' },
        audit: {
          eventType: 'DEVICE_REVOKED',
          description: `Revoked device ${cleanId} (${target.device_name || ''}) by ${actorUid}. Only this device's sessions were invalidated.`,
          actorUid,
          targetUid: target.requested_by_uid || undefined
        }
      };
    });

    if (txOutcome.audit) {
      this.logAudit(txOutcome.audit.eventType, txOutcome.audit.description, txOutcome.audit.actorUid, txOutcome.audit.targetUid);
    }
    return txOutcome.result;
  }

  deleteDevice(deviceId: string, actorUid: string): { success: boolean; code?: number; message: string } {
    const cleanId = String(deviceId || '').trim();
    if (!cleanId) return { success: false, code: 400, message: 'Device ID is required.' };
    const nowIso = new Date().toISOString();

    const txOutcome = this.runImmediateTransaction(() => {
      const db = this.getDb();
      const target = db.prepare(`SELECT * FROM devices WHERE device_id = ? LIMIT 1`).get(cleanId) as any;
      if (!target) return { result: { success: false, code: 404, message: 'Device record not found.' } };

      db.prepare(`UPDATE user_sessions SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL`).run(nowIso, cleanId);
      db.prepare(`DELETE FROM refresh_tokens WHERE device_id = ?`).run(cleanId);
      db.prepare(`DELETE FROM devices WHERE device_id = ?`).run(cleanId);

      return {
        result: { success: true, message: 'Device removed and global approval slot freed.' },
        audit: {
          eventType: 'DEVICE_REMOVED',
          description: `Removed device ${cleanId} (${target.device_name || ''}) by ${actorUid}. Slot freed.`,
          actorUid,
          targetUid: target.requested_by_uid || undefined
        }
      };
    });

    if (txOutcome.audit) {
      this.logAudit(txOutcome.audit.eventType, txOutcome.audit.description, txOutcome.audit.actorUid, txOutcome.audit.targetUid);
    }
    return txOutcome.result;
  }

  createSessionRecord(params: {
    userId: string;
    sessionToken: string;
    panelRole: string;
    deviceId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): {
    sessionId: string;
    csrfToken: string;
    expiresAt: string;
    refreshToken: string;
    refreshExpiresAt: string;
    familyId: string;
    generation: number;
  } {
    const db = this.getDb();
    const now = new Date();
    const nowIso = now.toISOString();
    const timeoutMins = Math.max(15, Number(this.getSetting('session_timeout_minutes') || 720));
    // Session horizon spans at least 30 days (or configured timeout) so short-lived 15m access tokens rotate cleanly
    const refreshTtlMs = Math.max(timeoutMins * 60 * 1000, 30 * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(now.getTime() + refreshTtlMs).toISOString();
    const refreshExpiresAt = expiresAt;

    const sessionId = params.sessionId || `SES-${crypto.randomBytes(12).toString('hex')}`;
    const familyId = `FAM-${crypto.randomBytes(10).toString('hex')}`;
    const csrfToken = crypto.randomBytes(24).toString('base64url');
    const tokenHash = hashSensitive(params.sessionToken);
    const csrfTokenHash = hashSensitive(csrfToken);
    const csrfTokenEnc = encryptSensitive(csrfToken);
    const cleanDeviceId = String(params.deviceId || '').trim() || `LEGACY-${crypto.randomBytes(6).toString('hex')}`;

    const refreshToken = `MUNR_${crypto.randomBytes(40).toString('base64url')}`;
    const refreshHash = hashSensitive(refreshToken);
    const refreshTokenId = `RT-${crypto.randomBytes(10).toString('hex')}`;

    this.runImmediateTransaction(() => {
      db.prepare(`
        UPDATE users SET
          failed_login_attempts = 0,
          locked_until = NULL,
          last_login_at = ?,
          last_login_panel = ?,
          login_count = login_count + 1,
          updated_at = ?
        WHERE user_id = ?
      `).run(nowIso, params.panelRole, nowIso, params.userId);

      db.prepare(`
        INSERT INTO user_sessions (
          session_id, user_id, token_hash, csrf_token_hash, csrf_token_enc, device_id, panel_role, ip_address, user_agent, created_at, expires_at, revoked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `).run(
        sessionId,
        params.userId,
        tokenHash,
        csrfTokenHash,
        csrfTokenEnc,
        cleanDeviceId,
        params.panelRole,
        params.ipAddress || '',
        String(params.userAgent || '').slice(0, 240),
        nowIso,
        expiresAt
      );

      db.prepare(`
        INSERT INTO refresh_tokens (
          token_id, family_id, session_id, user_id, device_id, token_hash, generation, replaced_by_hash, rotated_at, expires_at, revoked_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, NULL, NULL, ?, NULL, ?)
      `).run(
        refreshTokenId,
        familyId,
        sessionId,
        params.userId,
        cleanDeviceId,
        refreshHash,
        refreshExpiresAt,
        nowIso
      );
    });

    return { sessionId, csrfToken, expiresAt, refreshToken, refreshExpiresAt, familyId, generation: 1 };
  }

  validateActiveSessionToken(
    rawSessionToken: string,
    sessionIdFromToken?: string,
    deviceIdFromToken?: string
  ): {
    valid: boolean;
    errorCode?: 'SESSION_REVOKED' | 'SESSION_EXPIRED' | 'DEVICE_REVOKED';
    sessionId?: string;
    userId?: string;
    deviceId?: string;
    csrfTokenHash?: string;
    reason?: string;
  } {
    const db = this.getDb();
    let row:
      | {
          session_id: string;
          user_id: string;
          csrf_token_hash: string;
          device_id: string | null;
          expires_at: string;
          revoked_at: string | null;
        }
      | undefined;

    if (sessionIdFromToken) {
      row = db
        .prepare(`SELECT session_id, user_id, csrf_token_hash, device_id, expires_at, revoked_at FROM user_sessions WHERE session_id = ? LIMIT 1`)
        .get(sessionIdFromToken) as any;
    }
    if (!row && rawSessionToken) {
      const tokenHash = hashSensitive(rawSessionToken);
      row = db
        .prepare(`SELECT session_id, user_id, csrf_token_hash, device_id, expires_at, revoked_at FROM user_sessions WHERE token_hash = ? LIMIT 1`)
        .get(tokenHash) as any;
    }

    if (!row) {
      return { valid: false, errorCode: 'SESSION_REVOKED', reason: 'Session record not found or signed out.' };
    }

    const boundDeviceId = row.device_id || deviceIdFromToken || '';
    if (boundDeviceId && !boundDeviceId.startsWith('LEGACY-')) {
      const dev = db.prepare(`SELECT status FROM devices WHERE device_id = ? LIMIT 1`).get(boundDeviceId) as { status: string } | undefined;
      if (!dev || dev.status !== 'APPROVED') {
        return {
          valid: false,
          errorCode: 'DEVICE_REVOKED',
          reason: 'This device is no longer approved or has been revoked by Administration.'
        };
      }
      if (deviceIdFromToken && row.device_id && deviceIdFromToken !== row.device_id) {
        return {
          valid: false,
          errorCode: 'DEVICE_REVOKED',
          reason: 'Session token does not match current device identity.'
        };
      }
    }

    if (row.revoked_at) {
      return { valid: false, errorCode: 'SESSION_REVOKED', reason: 'Session has been revoked.' };
    }
    if (Date.parse(row.expires_at) <= Date.now()) {
      return { valid: false, errorCode: 'SESSION_EXPIRED', reason: 'Session expired.' };
    }

    return {
      valid: true,
      sessionId: row.session_id,
      userId: row.user_id,
      deviceId: row.device_id || undefined,
      csrfTokenHash: row.csrf_token_hash
    };
  }

  verifySessionCsrfToken(sessionToken: string, providedCsrfToken: string, sessionIdFromToken?: string, deviceIdFromToken?: string): boolean {
    if (!sessionToken || !providedCsrfToken) return false;
    const sess = this.validateActiveSessionToken(sessionToken, sessionIdFromToken, deviceIdFromToken);
    if (!sess.valid || !sess.csrfTokenHash) return false;
    const providedHash = hashSensitive(providedCsrfToken);
    const a = Buffer.from(providedHash);
    const b = Buffer.from(sess.csrfTokenHash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  rotateRefreshTokenAtomic(params: {
    rawRefreshToken: string;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
    issueAccessTokenFn: (args: {
      uid: string;
      role: string;
      isSuperAdmin: boolean;
      sessionVersion: number;
      sessionId: string;
      deviceId: string;
    }) => { token: string; expiresAt: string };
  }): {
    success: boolean;
    code?: number;
    errorCode?: 'REFRESH_INVALID' | 'SESSION_REVOKED' | 'SESSION_EXPIRED' | 'DEVICE_REVOKED' | 'ACCOUNT_INACTIVE';
    message?: string;
    user?: ApiUserRecord;
    sessionToken?: string;
    refreshToken?: string;
    alreadyRotatedInGrace?: boolean;
    csrfToken?: string;
    expiresAt?: string;
    refreshExpiresAt?: string;
    sessionId?: string;
    deviceId?: string;
    generation?: number;
  } {
    const raw = String(params.rawRefreshToken || '').trim();
    if (!raw) {
      return { success: false, code: 401, errorCode: 'REFRESH_INVALID', message: 'Refresh token missing.' };
    }
    const tokenHash = hashSensitive(raw);
    const now = new Date();
    const nowIso = now.toISOString();
    const clientDeviceId = String(params.deviceId || '').trim();

    type RotateResult = {
      success: boolean;
      code?: number;
      errorCode?: 'REFRESH_INVALID' | 'SESSION_REVOKED' | 'SESSION_EXPIRED' | 'DEVICE_REVOKED' | 'ACCOUNT_INACTIVE';
      message?: string;
      user?: ApiUserRecord;
      sessionToken?: string;
      refreshToken?: string;
      alreadyRotatedInGrace?: boolean;
      csrfToken?: string;
      expiresAt?: string;
      refreshExpiresAt?: string;
      sessionId?: string;
      deviceId?: string;
      generation?: number;
    };
    const txOutcome = this.runImmediateTransaction<{
      result: RotateResult;
      audit?: {
        eventType: string;
        description: string;
        actorUid: string;
        targetUid?: string;
        metadata?: Record<string, unknown>;
        ipAddress?: string;
      };
    }>(() => {
      const db = this.getDb();
      const rt = db.prepare(`SELECT * FROM refresh_tokens WHERE token_hash = ? LIMIT 1`).get(tokenHash) as any;
      if (!rt) {
        return { result: { success: false, code: 401, errorCode: 'REFRESH_INVALID', message: 'Invalid refresh token.' } };
      }

      if (clientDeviceId && rt.device_id && clientDeviceId !== rt.device_id) {
        return { result: { success: false, code: 403, errorCode: 'DEVICE_REVOKED', message: 'Device mismatch on refresh token.' } };
      }

      const sess = db.prepare(`SELECT * FROM user_sessions WHERE session_id = ? LIMIT 1`).get(rt.session_id) as any;
      if (!sess || sess.revoked_at) {
        return { result: { success: false, code: 401, errorCode: 'SESSION_REVOKED', message: 'Session has been signed out or revoked.' } };
      }
      if (Date.parse(sess.expires_at) <= Date.now()) {
        return { result: { success: false, code: 401, errorCode: 'SESSION_EXPIRED', message: 'Session expired. Please sign in again.' } };
      }

      if (rt.device_id && !String(rt.device_id).startsWith('LEGACY-')) {
        const dev = db.prepare(`SELECT status FROM devices WHERE device_id = ? LIMIT 1`).get(rt.device_id) as { status: string } | undefined;
        if (!dev || dev.status !== 'APPROVED') {
          return {
            result: {
              success: false,
              code: 403,
              errorCode: 'DEVICE_REVOKED',
              message: 'This device is no longer approved or has been revoked.'
            }
          };
        }
      }

      const user = this.getUserByUid(rt.user_id);
      if (!user || user.status !== 'ACTIVE') {
        return { result: { success: false, code: 403, errorCode: 'ACCOUNT_INACTIVE', message: 'User account is unavailable.' } };
      }
      if (user.lockedUntil && Date.parse(user.lockedUntil) > Date.now()) {
        return { result: { success: false, code: 429, errorCode: 'ACCOUNT_INACTIVE', message: 'Account is temporarily locked.' } };
      }

      if (rt.revoked_at) {
        return { result: { success: false, code: 401, errorCode: 'SESSION_REVOKED', message: 'Refresh token revoked.' } };
      }
      if (Date.parse(rt.expires_at) <= Date.now()) {
        return { result: { success: false, code: 401, errorCode: 'SESSION_EXPIRED', message: 'Refresh token expired. Please sign in again.' } };
      }

      let csrfToken = '';
      if (sess.csrf_token_enc) {
        try {
          csrfToken = decryptSensitive(sess.csrf_token_enc);
        } catch {
          csrfToken = '';
        }
      }
      if (!csrfToken) {
        csrfToken = crypto.randomBytes(24).toString('base64url');
        db.prepare(`UPDATE user_sessions SET csrf_token_hash = ?, csrf_token_enc = ? WHERE session_id = ?`)
          .run(hashSensitive(csrfToken), encryptSensitive(csrfToken), sess.session_id);
      }

      // Concurrent multi-tab race handling: if already rotated inside 15-second grace window,
      // do NOT revoke session and do NOT overwrite newer refresh cookie with an older token!
      if (rt.replaced_by_hash) {
        const rotatedAtMs = rt.rotated_at ? Date.parse(rt.rotated_at) : 0;
        const elapsedMs = Date.now() - rotatedAtMs;
        const latestActive = db
          .prepare(`
            SELECT generation, expires_at FROM refresh_tokens
            WHERE family_id = ? AND session_id = ? AND replaced_by_hash IS NULL AND revoked_at IS NULL
            ORDER BY generation DESC LIMIT 1
          `)
          .get(rt.family_id, rt.session_id) as { generation: number; expires_at: string } | undefined;

        if (elapsedMs >= 0 && elapsedMs <= 15000 && latestActive && Date.parse(latestActive.expires_at) > Date.now()) {
          const issued = params.issueAccessTokenFn({
            uid: user.uid,
            role: user.role,
            isSuperAdmin: user.isMainAdmin,
            sessionVersion: user.sessionVersion || 1,
            sessionId: sess.session_id,
            deviceId: rt.device_id
          });
          db.prepare(`UPDATE devices SET last_seen_at = ? WHERE device_id = ?`).run(nowIso, rt.device_id);
          return {
            result: {
              success: true,
              alreadyRotatedInGrace: true,
              user,
              sessionToken: issued.token,
              csrfToken,
              expiresAt: issued.expiresAt,
              refreshExpiresAt: latestActive.expires_at,
              sessionId: sess.session_id,
              deviceId: rt.device_id,
              generation: Number(latestActive.generation)
            }
          };
        }

        // Reuse outside grace window: revoke ONLY this family & session (keep user's other devices active)
        db.prepare(`UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL`).run(nowIso, rt.family_id);
        db.prepare(`UPDATE user_sessions SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL`).run(nowIso, sess.session_id);
        return {
          result: {
            success: false,
            code: 401,
            errorCode: 'SESSION_REVOKED',
            message: 'Session refresh token already rotated or revoked. Please sign in again.'
          },
          audit: {
            eventType: 'AUTH_REFRESH_REUSE_DETECTED',
            description: `Detected stale refresh token reuse on family ${rt.family_id} (device ${rt.device_id}). Revoked only that session.`,
            actorUid: user.uid,
            targetUid: user.uid,
            metadata: { deviceId: rt.device_id, familyId: rt.family_id },
            ipAddress: params.ipAddress
          }
        };
      }

      // Normal atomic rotation
      const newRefreshToken = `MUNR_${crypto.randomBytes(40).toString('base64url')}`;
      const newRefreshHash = hashSensitive(newRefreshToken);
      const newTokenId = `RT-${crypto.randomBytes(10).toString('hex')}`;
      const newGeneration = Number(rt.generation || 1) + 1;

      const upd = db
        .prepare(`UPDATE refresh_tokens SET replaced_by_hash = ?, rotated_at = ? WHERE token_id = ? AND replaced_by_hash IS NULL`)
        .run(newRefreshHash, nowIso, rt.token_id);

      if (Number(upd.changes) !== 1) {
        return { result: { success: false, code: 401, errorCode: 'SESSION_REVOKED', message: 'Concurrent refresh conflict.' } };
      }

      db.prepare(`
        INSERT INTO refresh_tokens (
          token_id, family_id, session_id, user_id, device_id, token_hash, generation, replaced_by_hash, rotated_at, expires_at, revoked_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?)
      `).run(
        newTokenId,
        rt.family_id,
        sess.session_id,
        user.uid,
        rt.device_id,
        newRefreshHash,
        newGeneration,
        sess.expires_at,
        nowIso
      );

      const issued = params.issueAccessTokenFn({
        uid: user.uid,
        role: user.role,
        isSuperAdmin: user.isMainAdmin,
        sessionVersion: user.sessionVersion || 1,
        sessionId: sess.session_id,
        deviceId: rt.device_id
      });

      db.prepare(`UPDATE user_sessions SET ip_address = COALESCE(NULLIF(?, ''), ip_address), user_agent = COALESCE(NULLIF(?, ''), user_agent) WHERE session_id = ?`)
        .run(params.ipAddress || '', String(params.userAgent || '').slice(0, 240), sess.session_id);
      db.prepare(`UPDATE devices SET last_seen_at = ? WHERE device_id = ?`).run(nowIso, rt.device_id);

      return {
        result: {
          success: true,
          alreadyRotatedInGrace: false,
          user,
          sessionToken: issued.token,
          refreshToken: newRefreshToken,
          csrfToken,
          expiresAt: issued.expiresAt,
          refreshExpiresAt: sess.expires_at,
          sessionId: sess.session_id,
          deviceId: rt.device_id,
          generation: newGeneration
        }
      };
    });

    if (txOutcome.audit) {
      this.logAudit(
        txOutcome.audit.eventType,
        txOutcome.audit.description,
        txOutcome.audit.actorUid,
        txOutcome.audit.targetUid,
        txOutcome.audit.metadata,
        txOutcome.audit.ipAddress
      );
    }
    return txOutcome.result;
  }

  revokeSessionByToken(rawSessionToken: string, sessionIdFromToken?: string, rawRefreshToken?: string): void {
    const nowIso = new Date().toISOString();
    const db = this.getDb();
    this.runImmediateTransaction(() => {
      let targetSessionId = sessionIdFromToken || '';
      if (!targetSessionId && rawSessionToken) {
        const tokenHash = hashSensitive(rawSessionToken);
        const r = db.prepare(`SELECT session_id FROM user_sessions WHERE token_hash = ? LIMIT 1`).get(tokenHash) as { session_id: string } | undefined;
        if (r?.session_id) targetSessionId = r.session_id;
      }
      if (!targetSessionId && rawRefreshToken) {
        const rtHash = hashSensitive(rawRefreshToken);
        const r = db.prepare(`SELECT session_id FROM refresh_tokens WHERE token_hash = ? LIMIT 1`).get(rtHash) as { session_id: string } | undefined;
        if (r?.session_id) targetSessionId = r.session_id;
      }
      if (targetSessionId) {
        db.prepare(`UPDATE user_sessions SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL`).run(nowIso, targetSessionId);
        db.prepare(`UPDATE refresh_tokens SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL`).run(nowIso, targetSessionId);
      }
    });
  }

  revokeAllSessionsForUser(userId: string): void {
    const nowIso = new Date().toISOString();
    this.runImmediateTransaction(() => {
      this.getDb().prepare(`UPDATE users SET session_version = session_version + 1, updated_at = ? WHERE user_id = ?`).run(nowIso, userId);
      this.getDb().prepare(`UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(nowIso, userId);
      this.getDb().prepare(`UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(nowIso, userId);
    });
  }

  // MFA management exclusively for MC2600000
  beginMainAdminMfaSetup(): { secret: string; otpAuthUri: string; alreadyEnabled: boolean } {
    const row = this.getDb().prepare(`SELECT mfa_enabled FROM users WHERE user_id = ?`).get(MAIN_ADMIN_UID) as { mfa_enabled: number } | undefined;
    const secret = generateTotpSecret();
    const enc = encryptSensitive(secret);
    this.getDb()
      .prepare(`UPDATE users SET mfa_secret_enc = ?, updated_at = ? WHERE user_id = ?`)
      .run(enc, new Date().toISOString(), MAIN_ADMIN_UID);
    return {
      secret,
      otpAuthUri: buildOtpAuthUri(MAIN_ADMIN_UID, secret),
      alreadyEnabled: Boolean(row?.mfa_enabled)
    };
  }

  confirmEnableMainAdminMfa(totpCode: string): { success: boolean; message: string } {
    const row = this.getDb().prepare(`SELECT mfa_secret_enc FROM users WHERE user_id = ?`).get(MAIN_ADMIN_UID) as { mfa_secret_enc: string | null } | undefined;
    if (!row?.mfa_secret_enc) {
      return { success: false, message: 'MFA setup has not been initiated. Click Generate MFA Key first.' };
    }
    const secret = decryptSensitive(row.mfa_secret_enc);
    if (!verifyTotpCode(secret, totpCode)) {
      return { success: false, message: 'Invalid 6-digit authenticator code. Check your device clock and try again.' };
    }
    this.getDb().prepare(`UPDATE users SET mfa_enabled = 1, updated_at = ? WHERE user_id = ?`).run(new Date().toISOString(), MAIN_ADMIN_UID);
    this.logAudit('MFA_ENABLED', `TOTP Two-Factor Authentication enabled for Main Administration account ${MAIN_ADMIN_UID}.`, MAIN_ADMIN_UID, MAIN_ADMIN_UID);
    return { success: true, message: `Two-Factor Authentication (TOTP MFA) is now active for ${MAIN_ADMIN_UID}.` };
  }

  disableMainAdminMfa(): { success: boolean; message: string } {
    this.getDb().prepare(`UPDATE users SET mfa_enabled = 0, mfa_secret_enc = NULL, updated_at = ? WHERE user_id = ?`).run(new Date().toISOString(), MAIN_ADMIN_UID);
    this.logAudit('MFA_DISABLED', `TOTP Two-Factor Authentication disabled for ${MAIN_ADMIN_UID}.`, MAIN_ADMIN_UID, MAIN_ADMIN_UID);
    return { success: true, message: `Two-Factor Authentication disabled for ${MAIN_ADMIN_UID}.` };
  }

  verifyUserTotp(userId: string, totpCode: string): boolean {
    const row = this.getDb().prepare(`SELECT mfa_enabled, mfa_secret_enc FROM users WHERE user_id = ?`).get(userId) as { mfa_enabled: number; mfa_secret_enc: string | null } | undefined;
    if (!row || row.mfa_enabled !== 1 || !row.mfa_secret_enc) return false;
    const secret = decryptSensitive(row.mfa_secret_enc);
    return verifyTotpCode(secret, totpCode);
  }

  // -------------------------------------------------------------------------
  // AADHAAR VERIFICATION & LAST-5 PASSWORD HISTORY HELPERS
  // -------------------------------------------------------------------------
  verifyUserAadhaar(row: RelationalUserRow, rawAadhaar: string): boolean {
    const clean12 = String(rawAadhaar || '').replace(/[^0-9]/g, '');
    if (!/^\d{12}$/.test(clean12)) return false;

    const inputHash = hashSensitive(clean12);
    const storedHash = String(row.aadhaar_hash || '').trim().toLowerCase();
    if (storedHash && storedHash.length === 64) {
      const a = Buffer.from(inputHash, 'hex');
      const b = Buffer.from(storedHash, 'hex');
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    }

    if (row.aadhaar_enc) {
      const dec = decryptSensitive(row.aadhaar_enc).replace(/[^0-9]/g, '');
      if (dec.length === 12) {
        const a = Buffer.from(clean12, 'utf8');
        const b = Buffer.from(dec, 'utf8');
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
      }
    }
    return false;
  }

  getUserAadhaarForValidation(row: RelationalUserRow): string {
    if (row.aadhaar_enc) {
      const dec = decryptSensitive(row.aadhaar_enc).replace(/[^0-9]/g, '');
      if (dec.length === 12) return dec;
    }
    return '';
  }

  async isPasswordInLast5History(row: RelationalUserRow, candidatePassword: string): Promise<boolean> {
    const currentMatch = await verifyPasswordHash(candidatePassword, row.password_hash);
    if (currentMatch.valid) return true;

    let pwdHist: Array<{ changedAt?: string; method?: string; hash?: string }> = [];
    try {
      pwdHist = row.password_history_json ? JSON.parse(row.password_history_json) : [];
    } catch {
      pwdHist = [];
    }
    if (!Array.isArray(pwdHist)) return false;

    const recentWithHash = pwdHist.filter(item => item && typeof item.hash === 'string' && item.hash.length > 10).slice(0, 5);
    for (const item of recentWithHash) {
      const chk = await verifyPasswordHash(candidatePassword, String(item.hash));
      if (chk.valid) return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // SELF-SERVICE PASSWORD CHANGE
  // -------------------------------------------------------------------------
  async changeOwnPassword(
    userId: string,
    newPassword: string,
    todayIst: string,
    method = 'USER_PASSWORD_CHANGE'
  ): Promise<{ user: ApiUserRecord; dailyChangesUsed: number; dailyLimit: number }> {
    const row = this.getDb().prepare(`SELECT * FROM users WHERE user_id = ?`).get(userId) as unknown as RelationalUserRow;
    const isAdminAccount = row.is_main_admin === 1 || row.user_id === MAIN_ADMIN_UID;
    const maxDaily = isAdminAccount ? 0 : Number(this.getSetting('daily_password_change_limit') || 5);
    const usedToday = row.daily_password_change_date === todayIst ? Number(row.daily_password_change_count || 0) : 0;
    const nextDailyCount = usedToday + 1;
    const hash = await hashPasswordArgon2id(newPassword);
    const nowIso = new Date().toISOString();

    let pwdHist: any[] = [];
    try { pwdHist = row.password_history_json ? JSON.parse(row.password_history_json) : []; } catch { pwdHist = []; }
    pwdHist.unshift({ changedAt: nowIso, method, hash });
    if (pwdHist.length > 5) pwdHist.length = 5;

    this.runImmediateTransaction(() => {
      const db = this.getDb();
      db.prepare(`
        UPDATE users SET
          password_hash = ?,
          must_change_password = 0,
          password_changed_at = ?,
          password_change_count = password_change_count + 1,
          daily_password_change_date = ?,
          daily_password_change_count = ?,
          password_history_json = ?,
          session_version = session_version + 1,
          updated_at = ?
        WHERE user_id = ?
      `).run(hash, nowIso, todayIst, nextDailyCount, JSON.stringify(pwdHist), nowIso, userId);

      db.prepare(`UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(nowIso, userId);
      db.prepare(`UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(nowIso, userId);
    });

    this.logAudit('PASSWORD_CHANGE', `User ${row.full_name} (${userId}) updated password securely.`, userId, userId);

    return {
      user: this.getUserByUid(userId)!,
      dailyChangesUsed: nextDailyCount,
      dailyLimit: maxDaily
    };
  }

  // -------------------------------------------------------------------------
  // FORGOT PASSWORD RECOVERY & REFERENCE GENERATION (MUN-PWD-YYYY-XXXXXXXX)
  // -------------------------------------------------------------------------
  createPasswordResetRequest(params: {
    userId: string;
    mobileVerified: boolean;
    captchaVerified: boolean;
    otpVerified: boolean;
    status: 'INITIATED' | 'VERIFIED';
    ipAddress?: string;
    resetTokenHash?: string;
  }): { requestId: string; expiresAt: string } {
    const requestId = `PRR-${crypto.randomBytes(10).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

    this.getDb().prepare(`
      INSERT INTO password_reset_requests (
        request_id, user_id, mobile_verified, captcha_verified, otp_verified, status, ip_address, reset_token_hash, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      requestId,
      params.userId,
      params.mobileVerified ? 1 : 0,
      params.captchaVerified ? 1 : 0,
      params.otpVerified ? 1 : 0,
      params.status,
      params.ipAddress || '',
      params.resetTokenHash || null,
      now.toISOString(),
      expiresAt
    );

    return { requestId, expiresAt };
  }

  getPasswordResetRequest(requestId: string): {
    request_id: string;
    user_id: string;
    mobile_verified: number;
    captcha_verified: number;
    otp_verified: number;
    status: string;
    reset_token_hash: string | null;
    reset_token_used_at: string | null;
    expires_at: string;
  } | null {
    const row = this.getDb()
      .prepare(`SELECT request_id, user_id, mobile_verified, captcha_verified, otp_verified, status, reset_token_hash, reset_token_used_at, expires_at FROM password_reset_requests WHERE request_id = ? LIMIT 1`)
      .get(requestId) as any;
    return row || null;
  }

  setPasswordResetTokenHash(requestId: string, rawResetToken: string): void {
    const tokenHash = hashSensitive(rawResetToken);
    this.getDb()
      .prepare(`UPDATE password_reset_requests SET reset_token_hash = ? WHERE request_id = ?`)
      .run(tokenHash, requestId);
  }

  markPasswordResetRequestOtpVerified(requestId: string, rawResetToken?: string): void {
    const tokenHash = rawResetToken ? hashSensitive(rawResetToken) : null;
    this.getDb()
      .prepare(`UPDATE password_reset_requests SET otp_verified = 1, status = 'VERIFIED', reset_token_hash = COALESCE(?, reset_token_hash) WHERE request_id = ?`)
      .run(tokenHash, requestId);
  }

  recordFailedResetAttempt(userId: string, ipAddress?: string): { locked: boolean; lockedUntil?: string } {
    const maxAttempts = Number(this.getSetting('max_failed_reset_attempts') || 5);
    const lockMins = Number(this.getSetting('lockout_duration_minutes') || 15);
    const row = this.getDb().prepare(`SELECT failed_reset_attempts FROM users WHERE user_id = ?`).get(userId) as { failed_reset_attempts: number } | undefined;
    if (!row) return { locked: false };

    const nextFails = (row.failed_reset_attempts || 0) + 1;
    if (nextFails >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockMins * 60 * 1000).toISOString();
      this.getDb()
        .prepare(`UPDATE users SET failed_reset_attempts = 0, locked_until = ?, updated_at = ? WHERE user_id = ?`)
        .run(lockedUntil, new Date().toISOString(), userId);
      this.logAudit('FORGOT_PASSWORD_LOCKOUT', `Account ${userId} temporarily locked after ${maxAttempts} failed password recovery attempts.`, userId, userId, { ip: ipAddress });
      return { locked: true, lockedUntil };
    }

    this.getDb()
      .prepare(`UPDATE users SET failed_reset_attempts = ?, updated_at = ? WHERE user_id = ?`)
      .run(nextFails, new Date().toISOString(), userId);
    return { locked: false };
  }

  async completePasswordResetAtomic(params: {
    userId: string;
    requestId: string;
    resetTokenHash?: string;
    newPassword: string;
    ipAddress?: string;
  }): Promise<{
    userId: string;
    userName: string;
    userRole: CoreRole;
    mobileMasked: string;
    referenceNumber: string;
    resetDate: string;
    resetTime: string;
    resetTime12: string;
    resetStatus: 'SUCCESSFUL';
  }> {
    const newHash = await hashPasswordArgon2id(params.newPassword);
    const ist = getKolkataNow();

    const result = this.runImmediateTransaction(() => {
      const db = this.getDb();
      const row = db.prepare(`SELECT * FROM users WHERE user_id = ?`).get(params.userId) as RelationalUserRow | undefined;
      if (!row) throw new Error('Account not found.');

      const reqRow = db
        .prepare(`SELECT status, expires_at, reset_token_hash, reset_token_used_at FROM password_reset_requests WHERE request_id = ?`)
        .get(params.requestId) as { status: string; expires_at: string; reset_token_hash: string | null; reset_token_used_at: string | null } | undefined;

      if (
        !reqRow ||
        reqRow.status !== 'VERIFIED' ||
        reqRow.reset_token_used_at ||
        Date.parse(reqRow.expires_at) <= Date.now()
      ) {
        throw Object.assign(new Error('Recovery verification session expired or already used. Please restart verification.'), { statusCode: 403 });
      }

      if (params.resetTokenHash && reqRow.reset_token_hash) {
        const a = Buffer.from(params.resetTokenHash, 'utf8');
        const b = Buffer.from(reqRow.reset_token_hash, 'utf8');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          throw Object.assign(new Error('Invalid or already used single-use reset token.'), { statusCode: 403 });
        }
      }

      // Generate Universal Global Reference MUN-PWD-YYYY-XXXXXXXX atomically ONLY after password reset succeeds
      const pwdRef = globalReferenceEngine.generateGlobalReferenceInTx(db, {
        prefix: 'PWD',
        entityType: 'PASSWORD_RESET_RECEIPT',
        entityId: params.requestId,
        createdBy: params.userId
      });
      const referenceNumber = pwdRef.reference_no;

      let pwdHist: any[] = [];
      try { pwdHist = row.password_history_json ? JSON.parse(row.password_history_json) : []; } catch { pwdHist = []; }
      pwdHist.unshift({ changedAt: ist.isoTimestamp, method: `SELF_PASSWORD_RESET (${referenceNumber})`, hash: newHash });
      if (pwdHist.length > 5) pwdHist.length = 5;

      // 1. Update password, reset counters, clear temp flags, bump session version
      db.prepare(`
        UPDATE users SET
          password_hash = ?,
          must_change_password = 0,
          password_changed_at = ?,
          password_change_count = password_change_count + 1,
          password_history_json = ?,
          session_version = session_version + 1,
          failed_reset_attempts = 0,
          failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = ?
        WHERE user_id = ?
      `).run(newHash, ist.isoTimestamp, JSON.stringify(pwdHist), ist.isoTimestamp, params.userId);

      // 2. Revoke ALL existing active sessions immediately
      db.prepare(`UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
        .run(ist.isoTimestamp, params.userId);

      // 3. Mark reset request completed & single-use token consumed
      db.prepare(`UPDATE password_reset_requests SET status = 'COMPLETED', reset_token_used_at = ?, completed_at = ? WHERE request_id = ?`)
        .run(ist.isoTimestamp, ist.isoTimestamp, params.requestId);

      // 4. Persist immutable Password Reset Reference Record (NO password/OTP/token/Aadhaar ever stored)
      db.prepare(`
        INSERT INTO password_reset_references (
          reference_number, user_id, reset_request_id, reset_date, reset_time, reset_status, ip_address, created_at
        ) VALUES (?, ?, ?, ?, ?, 'SUCCESSFUL', ?, ?)
      `).run(
        referenceNumber,
        params.userId,
        params.requestId,
        ist.isoDate,
        ist.time24,
        params.ipAddress || '',
        ist.isoTimestamp
      );

      return {
        userId: params.userId,
        userName: row.full_name,
        userRole: normalizeCoreRole(row.role_id),
        mobileMasked: maskPhone(row.mobile_number),
        referenceNumber,
        resetDate: ist.isoDate,
        resetTime: ist.time24,
        resetTime12: ist.time12,
        resetStatus: 'SUCCESSFUL' as const
      };
    });

    this.logAudit(
      'PASSWORD_RESET',
      `Password reset completed for ${params.userId} (${result.userName}). Reference: ${result.referenceNumber}. All prior sessions revoked.`,
      params.userId,
      params.userId,
      { referenceNumber: result.referenceNumber, ip: params.ipAddress }
    );

    return result;
  }

  listPasswordResetReferences(opts?: { userId?: string; limit?: number }): Array<{
    id: number;
    referenceNumber: string;
    userId: string;
    resetDate: string;
    resetTime: string;
    resetStatus: string;
    ipAddress: string;
    createdAt: string;
  }> {
    const limit = Math.min(200, Math.max(1, Number(opts?.limit || 50)));
    const rows = opts?.userId
      ? (this.getDb()
          .prepare(`SELECT * FROM password_reset_references WHERE UPPER(user_id) = UPPER(?) ORDER BY id DESC LIMIT ?`)
          .all(opts.userId, limit) as any[])
      : (this.getDb()
          .prepare(`SELECT * FROM password_reset_references ORDER BY id DESC LIMIT ?`)
          .all(limit) as any[]);

    return rows.map(r => ({
      id: r.id,
      referenceNumber: r.reference_number,
      userId: r.user_id,
      resetDate: r.reset_date,
      resetTime: r.reset_time,
      resetStatus: r.reset_status,
      ipAddress: r.ip_address || '',
      createdAt: r.created_at
    }));
  }

  // -------------------------------------------------------------------------
  // AUDIT LOGS & SYSTEM SETTINGS
  // -------------------------------------------------------------------------
  logAudit(
    action: string,
    details: string,
    actorUserId = 'SYSTEM',
    targetUserId?: string,
    meta?: Record<string, any>,
    ipAddress?: string
  ): void {
    const db = this.getDb();
    const nowIso = new Date().toISOString();
    const last = db.prepare(`SELECT entry_hash FROM audit_logs ORDER BY id DESC LIMIT 1`).get() as { entry_hash: string } | undefined;
    const prevHash = last?.entry_hash || 'GENESIS';
    const auditUid = globalReferenceEngine.generateGlobalReference({
      prefix: 'AUD',
      entityType: 'AUDIT_LOG',
      createdBy: actorUserId || 'SYSTEM'
    }).reference_no;

    // Strip any accidental password keys from audit metadata
    const cleanMeta: Record<string, any> = {};
    if (meta && typeof meta === 'object') {
      for (const [k, v] of Object.entries(meta)) {
        if (/password|secret|token|hash/i.test(k)) continue;
        cleanMeta[k] = v;
      }
    }

    const entryHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ auditUid, nowIso, action, details, actorUserId, prevHash }))
      .digest('hex');

    db.prepare(`
      INSERT INTO audit_logs (
        audit_uid, timestamp, action, actor_user_id, target_user_id, details, ip_address, meta_json, prev_hash, entry_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditUid,
      nowIso,
      action,
      actorUserId || 'SYSTEM',
      targetUserId || null,
      details,
      ipAddress || cleanMeta.ip || null,
      JSON.stringify(cleanMeta),
      prevHash,
      entryHash
    );
  }

  listAuditLogs(limit = 300, filterAction?: string): any[] {
    const safeLimit = Math.min(1000, Math.max(1, limit));
    const rows = filterAction
      ? (this.getDb()
          .prepare(`SELECT * FROM audit_logs WHERE action = ? ORDER BY id DESC LIMIT ?`)
          .all(filterAction, safeLimit) as any[])
      : (this.getDb().prepare(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?`).all(safeLimit) as any[]);

    return rows.map(r => {
      let extra: Record<string, any> = {};
      try { if (r.meta_json) extra = JSON.parse(r.meta_json); } catch { /* ignore */ }
      return {
        ...extra,
        id: r.audit_uid,
        timestamp: r.timestamp,
        action: r.action,
        uid: r.actor_user_id || 'SYSTEM',
        actorUserId: r.actor_user_id || 'SYSTEM',
        targetUid: r.target_user_id || extra.targetUid || '',
        details: r.details,
        ipAddress: r.ip_address || '',
        prevHash: r.prev_hash,
        entryHash: r.entry_hash
      };
    });
  }

  getSetting(key: string): string {
    const row = this.getDb().prepare(`SELECT setting_value FROM system_settings WHERE setting_key = ?`).get(key) as { setting_value: string } | undefined;
    return row ? row.setting_value : (DEFAULT_SYSTEM_SETTINGS[key] || '');
  }

  getAllSettings(): Record<string, string> {
    const rows = this.getDb().prepare(`SELECT setting_key, setting_value FROM system_settings`).all() as Array<{ setting_key: string; setting_value: string }>;
    const out: Record<string, string> = { ...DEFAULT_SYSTEM_SETTINGS };
    for (const r of rows) out[r.setting_key] = r.setting_value;
    return out;
  }

  updateSettings(updates: Record<string, string | number | boolean>, actorUid: string): Record<string, string> {
    const db = this.getDb();
    const nowIso = new Date().toISOString();
    const allowed = new Set(Object.keys(DEFAULT_SYSTEM_SETTINGS).filter(k => k !== 'main_admin_uid'));
    const stmt = db.prepare(`
      INSERT INTO system_settings (setting_key, setting_value, updated_at, updated_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
    `);

    this.runImmediateTransaction(() => {
      for (const [k, v] of Object.entries(updates || {})) {
        if (!allowed.has(k)) continue;
        stmt.run(k, String(v), nowIso, actorUid);
      }
    });

    this.logAudit('SYSTEM_SETTINGS_UPDATED', `System security policies updated by ${actorUid}`, actorUid, undefined, { keys: Object.keys(updates || {}) });
    return this.getAllSettings();
  }

  // -------------------------------------------------------------------------
  // DATABASE HEALTH, 12-TABLE STATS & HOT SQLITE BACKUP/RESTORE
  // -------------------------------------------------------------------------
  getRelationalDbHealth(): {
    engine: string;
    dbPath: string;
    sizeBytes: number;
    integrityCheck: string;
    walMode: string;
    foreignKeys: number;
    tables: Array<{ name: string; rows: number }>;
    recentResetReferences: any[];
    sqliteBackups: Array<{ fileName: string; sizeBytes: number; createdAt: string }>;
  } {
    const db = this.getDb();
    const tableNames = [
      'users',
      'roles',
      'permissions',
      'role_permissions',
      'user_permissions',
      'user_sessions',
      'password_reset_requests',
      'password_reset_references',
      'global_serial_counters',
      'daily_reference_counters',
      'audit_logs',
      'system_settings'
    ];

    const tables = tableNames.map(name => {
      const r = db.prepare(`SELECT COUNT(*) AS cnt FROM ${name}`).get() as { cnt: number };
      return { name, rows: r?.cnt || 0 };
    });

    const integrityRow = db.prepare(`PRAGMA integrity_check;`).get() as { integrity_check: string };
    const walRow = db.prepare(`PRAGMA journal_mode;`).get() as { journal_mode: string };
    const fkRow = db.prepare(`PRAGMA foreign_keys;`).get() as { foreign_keys: number };
    const stat = fs.existsSync(SQLITE_DB_PATH) ? fs.statSync(SQLITE_DB_PATH) : { size: 0 };

    const sqliteBackups = fs.existsSync(DB_BACKUPS_DIR)
      ? fs
          .readdirSync(DB_BACKUPS_DIR)
          .filter(f => f.endsWith('.db'))
          .sort()
          .reverse()
          .slice(0, 20)
          .map(f => {
            const full = path.join(DB_BACKUPS_DIR, f);
            const st = fs.statSync(full);
            return { fileName: f, sizeBytes: st.size, createdAt: st.mtime.toISOString() };
          })
      : [];

    return {
      engine: 'SQLite (WAL + Foreign Keys + Argon2id)',
      dbPath: 'data/mun-computer.db',
      sizeBytes: stat.size,
      integrityCheck: integrityRow?.integrity_check || 'ok',
      walMode: walRow?.journal_mode || 'wal',
      foreignKeys: fkRow?.foreign_keys || 1,
      tables,
      recentResetReferences: this.listPasswordResetReferences({ limit: 15 }),
      sqliteBackups
    };
  }

  createSqliteBackup(actorUid: string, prefix = 'SQLITE-BKP'): { fileName: string; filePath: string; sizeBytes: number } {
    const db = this.getDb();
    const ist = getKolkataNow();
    const stamp = `${ist.isoDate}-${ist.time24.replace(/:/g, '')}`;
    let fileName = `${prefix}-${stamp}.db`;
    let filePath = path.join(DB_BACKUPS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      fileName = `${prefix}-${stamp}-${Date.now()}.db`;
      filePath = path.join(DB_BACKUPS_DIR, fileName);
    }
    try {
      db.exec(`VACUUM INTO '${filePath.replace(/'/g, "''")}'`);
    } catch {
      db.exec(`PRAGMA wal_checkpoint(TRUNCATE);`);
      fs.copyFileSync(SQLITE_DB_PATH, filePath);
    }
    const sizeBytes = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
    this.logAudit('SQLITE_BACKUP_CREATED', `Relational database snapshot ${fileName} created by ${actorUid}`, actorUid);
    return { fileName, filePath, sizeBytes };
  }

  getSqliteBackupFilePath(fileName: string): string | null {
    const safeName = path.basename(String(fileName || ''));
    if (!safeName.endsWith('.db')) return null;
    const p = path.join(DB_BACKUPS_DIR, safeName);
    return fs.existsSync(p) ? p : null;
  }

  restoreSqliteBackupFile(fileName: string, actorUid: string): { success: boolean; message: string } {
    const sourcePath = this.getSqliteBackupFilePath(fileName);
    if (!sourcePath) return { success: false, message: 'SQLite backup file not found.' };

    // Verify integrity of backup before replacing active DB
    const testDb = new DatabaseSync(sourcePath);
    try {
      const chk = testDb.prepare(`PRAGMA integrity_check;`).get() as { integrity_check: string };
      if (chk?.integrity_check !== 'ok') {
        return { success: false, message: 'Backup file failed SQLite integrity verification.' };
      }
    } finally {
      testDb.close();
    }

    // Take safety snapshot before restore
    this.createSqliteBackup(actorUid, 'PRE-RESTORE');

    this.sqlite.close();
    fs.copyFileSync(sourcePath, SQLITE_DB_PATH);
    this.initialized = false;
    this.init();
    const check = globalReferenceEngine.verifyConsistency(true);
    this.logAudit(
      'SQLITE_BACKUP_RESTORED',
      `Relational database restored from ${fileName} by ${actorUid} (Global SL verified: last_serial=${check.lastSerial})`,
      actorUid
    );
    return { success: true, message: `Database restored cleanly from ${fileName}.` };
  }

  /**
   * Synchronizes existing non-sensitive metadata mirror to users.json only for legacy tools,
   * without storing plaintext passwords or secrets. Never treats users.json as primary authority.
   */
  resolveUserEffectivePermissions(user: ApiUserRecord | RelationalUserRow) {
    const hydrated = 'uid' in user ? user : this.hydrateUser(user);
    return resolveEffectivePermissions({
      uid: hydrated.uid,
      role: hydrated.role,
      isMainAdmin: hydrated.isMainAdmin,
      isSuperAdmin: hydrated.isMainAdmin,
      status: hydrated.status,
      permissionOverrides: hydrated.permissionOverrides,
      extraPermissions: hydrated.extraPermissions
    });
  }
}

export const relationalDb = new RelationalDatabaseService();
export { maskPhone, maskAadhaar };
