import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { getDataDir } from './dataDir.js';

const DATA_DIR = getDataDir();
const SQLITE_DB_PATH = path.join(DATA_DIR, 'mun-computer.db');

export const ORGANIZATION_CODE = 'MUN';
export const STANDARD_SERIAL_LENGTH = 8;

export type ReferenceStatus = 'ACTIVE' | 'DELETED' | 'ARCHIVED';

export interface PrefixMeta {
  prefix: string;
  organizationCode?: 'MUN' | 'MC';
  department: string;
  moduleName: string;
  entityType: string;
}

/**
 * Official Module-Wise Prefix Registry (Section 8.1 – 8.9)
 * One Organization • One Counter • All Internal Modules • 8-Digit Continuous SL
 * Manager & Staff User IDs strictly use MC prefix (MC-MGR-YYYY-XXXXXXXX / MC-STF-YYYY-XXXXXXXX)
 */
export const PREFIX_REGISTRY: Record<string, PrefixMeta> = {
  // 8.1 User & Security
  MGR: { prefix: 'MGR', organizationCode: 'MC', department: 'User & Security', moduleName: 'Manager', entityType: 'USER_MANAGER' },
  STF: { prefix: 'STF', organizationCode: 'MC', department: 'User & Security', moduleName: 'Staff', entityType: 'USER_STAFF' },
  PWD: { prefix: 'PWD', organizationCode: 'MUN', department: 'User & Security', moduleName: 'Password Reset Receipt', entityType: 'PASSWORD_RESET_RECEIPT' },

  // 8.2 Customer & CRM
  CUST: { prefix: 'CUST', department: 'Customer & CRM', moduleName: 'Customer', entityType: 'CUSTOMER' },
  LEAD: { prefix: 'LEAD', department: 'Customer & CRM', moduleName: 'Lead', entityType: 'LEAD' },
  REF: { prefix: 'REF', department: 'Customer & CRM', moduleName: 'Referral', entityType: 'REFERRAL' },
  GRV: { prefix: 'GRV', department: 'Customer & CRM', moduleName: 'Grievance', entityType: 'GRIEVANCE' },
  FLW: { prefix: 'FLW', department: 'Customer & CRM', moduleName: 'Follow-up', entityType: 'FOLLOWUP' },
  TL: { prefix: 'TL', department: 'Customer & CRM', moduleName: 'Timeline', entityType: 'TIMELINE' },
  REM: { prefix: 'REM', department: 'Customer & CRM', moduleName: 'Reminder', entityType: 'REMINDER' },
  CASE: { prefix: 'CASE', department: 'Customer & CRM', moduleName: 'Case / Application', entityType: 'CASE' },

  // 8.3 Services & Billing
  SRV: { prefix: 'SRV', department: 'Services & Billing', moduleName: 'Service', entityType: 'SERVICE' },
  RCPT: { prefix: 'RCPT', department: 'Services & Billing', moduleName: 'Service Receipt', entityType: 'SERVICE_RECEIPT' },
  SITEM: { prefix: 'SITEM', department: 'Services & Billing', moduleName: 'Service Item', entityType: 'SERVICE_ITEM' },
  INV: { prefix: 'INV', department: 'Services & Billing', moduleName: 'Invoice', entityType: 'INVOICE' },
  PAY: { prefix: 'PAY', department: 'Services & Billing', moduleName: 'Payment', entityType: 'PAYMENT' },
  RFD: { prefix: 'RFD', department: 'Services & Billing', moduleName: 'Refund', entityType: 'REFUND' },
  EXP: { prefix: 'EXP', department: 'Services & Billing', moduleName: 'Expense', entityType: 'EXPENSE' },
  VCH: { prefix: 'VCH', department: 'Services & Billing', moduleName: 'Voucher', entityType: 'VOUCHER' },

  // 8.4 Banking & Daybook
  TXN: { prefix: 'TXN', department: 'Banking & Daybook', moduleName: 'Cash Transaction', entityType: 'CASH_TRANSACTION' },
  DYB: { prefix: 'DYB', department: 'Banking & Daybook', moduleName: 'Daybook', entityType: 'DAYBOOK' },
  CBK: { prefix: 'CBK', department: 'Banking & Daybook', moduleName: 'Cashbook', entityType: 'CASHBOOK' },
  BANK: { prefix: 'BANK', department: 'Banking & Daybook', moduleName: 'Banking', entityType: 'BANKING_TXN' },
  BNK: { prefix: 'BNK', department: 'Banking & Daybook', moduleName: 'Bank Account', entityType: 'BANK_ACCOUNT' },
  JV: { prefix: 'JV', department: 'Banking & Daybook', moduleName: 'Journal Entry', entityType: 'JOURNAL_ENTRY' },
  BREC: { prefix: 'BREC', department: 'Banking & Daybook', moduleName: 'Bank Reconciliation', entityType: 'BANK_RECONCILIATION' },

  // 8.5 Inventory & Purchase
  PRD: { prefix: 'PRD', department: 'Inventory & Purchase', moduleName: 'Product', entityType: 'PRODUCT' },
  CAT: { prefix: 'CAT', department: 'Inventory & Purchase', moduleName: 'Category', entityType: 'CATEGORY' },
  SUP: { prefix: 'SUP', department: 'Inventory & Purchase', moduleName: 'Supplier', entityType: 'SUPPLIER' },
  PO: { prefix: 'PO', department: 'Inventory & Purchase', moduleName: 'Purchase Order', entityType: 'PURCHASE_ORDER' },
  PB: { prefix: 'PB', department: 'Inventory & Purchase', moduleName: 'Purchase Bill', entityType: 'PURCHASE_BILL' },
  ADJ: { prefix: 'ADJ', department: 'Inventory & Purchase', moduleName: 'Stock Adjustment', entityType: 'STOCK_ADJUSTMENT' },
  STR: { prefix: 'STR', department: 'Inventory & Purchase', moduleName: 'Stock Transfer', entityType: 'STOCK_TRANSFER' },
  SRET: { prefix: 'SRET', department: 'Inventory & Purchase', moduleName: 'Sales Return', entityType: 'SALES_RETURN' },
  CN: { prefix: 'CN', department: 'Inventory & Purchase', moduleName: 'Credit Note', entityType: 'CREDIT_NOTE' },

  // 8.6 LPG & Gas
  GASCUST: { prefix: 'GASCUST', department: 'LPG & Gas', moduleName: 'Gas Customer', entityType: 'GAS_CUSTOMER' },
  GASBK: { prefix: 'GASBK', department: 'LPG & Gas', moduleName: 'Gas Booking', entityType: 'GAS_BOOKING' },
  GASRCP: { prefix: 'GASRCP', department: 'LPG & Gas', moduleName: 'Gas Receipt', entityType: 'GAS_RECEIPT' },
  GASDBT: { prefix: 'GASDBT', department: 'LPG & Gas', moduleName: 'Gas DBT', entityType: 'GAS_DBT' },
  GASNT: { prefix: 'GASNT', department: 'LPG & Gas', moduleName: 'Non-Taker Ledger', entityType: 'GAS_NON_TAKER' },
  GASDP: { prefix: 'GASDP', department: 'LPG & Gas', moduleName: 'Delivery Person', entityType: 'GAS_DELIVERY_PERSON' },
  GASWH: { prefix: 'GASWH', department: 'LPG & Gas', moduleName: 'Warehouse', entityType: 'GAS_WAREHOUSE' },
  GASMOV: { prefix: 'GASMOV', department: 'LPG & Gas', moduleName: 'Stock Movement', entityType: 'GAS_STOCK_MOVEMENT' },
  GASSUP: { prefix: 'GASSUP', department: 'LPG & Gas', moduleName: 'Gas Supplier', entityType: 'GAS_SUPPLIER' },
  GASPUR: { prefix: 'GASPUR', department: 'LPG & Gas', moduleName: 'Gas Purchase', entityType: 'GAS_PURCHASE' },
  GASSRV: { prefix: 'GASSRV', department: 'LPG & Gas', moduleName: 'Gas Service', entityType: 'GAS_SERVICE' },

  // 8.7 HR & Payroll
  ATT: { prefix: 'ATT', department: 'HR & Payroll', moduleName: 'Attendance', entityType: 'ATTENDANCE' },
  PH: { prefix: 'PH', department: 'HR & Payroll', moduleName: 'Attendance Photo', entityType: 'ATTENDANCE_PHOTO' },
  PAYRUN: { prefix: 'PAYRUN', department: 'HR & Payroll', moduleName: 'Payroll Run', entityType: 'PAYROLL_RUN' },
  SLIP: { prefix: 'SLIP', department: 'HR & Payroll', moduleName: 'Payslip', entityType: 'PAYSLIP' },
  LV: { prefix: 'LV', department: 'HR & Payroll', moduleName: 'Leave', entityType: 'LEAVE' },
  HOL: { prefix: 'HOL', department: 'HR & Payroll', moduleName: 'Holiday', entityType: 'HOLIDAY' },
  KPI: { prefix: 'KPI', department: 'HR & Payroll', moduleName: 'KPI', entityType: 'KPI_REVIEW' },
  HRDOC: { prefix: 'HRDOC', department: 'HR & Payroll', moduleName: 'HR Document', entityType: 'HR_DOCUMENT' },
  JOB: { prefix: 'JOB', department: 'HR & Payroll', moduleName: 'Job', entityType: 'RECRUITMENT_JOB' },
  TRN: { prefix: 'TRN', department: 'HR & Payroll', moduleName: 'Training', entityType: 'TRAINING' },
  LTR: { prefix: 'LTR', department: 'HR & Payroll', moduleName: 'Offer Letter', entityType: 'OFFER_LETTER' },
  RWD: { prefix: 'RWD', department: 'HR & Payroll', moduleName: 'Rewards', entityType: 'REWARD_DISCIPLINARY' },

  // 8.8 Government & Welfare
  GOV: { prefix: 'GOV', department: 'Government & Welfare', moduleName: 'Government Scheme', entityType: 'GOVT_SCHEME' },
  ANP: { prefix: 'ANP', department: 'Government & Welfare', moduleName: 'Annapurna Application', entityType: 'ANNAPURNA_APP' },
  CMP: { prefix: 'CMP', department: 'Government & Welfare', moduleName: 'Complaint', entityType: 'COMPLAINT' },
  VIS: { prefix: 'VIS', department: 'Government & Welfare', moduleName: 'Visit', entityType: 'VISIT' },
  PRB: { prefix: 'PRB', department: 'Government & Welfare', moduleName: 'Problem', entityType: 'PROBLEM' },
  AUDST: { prefix: 'AUDST', department: 'Government & Welfare', moduleName: 'Audit Status', entityType: 'AUDIT_STATUS' },
  EDU: { prefix: 'EDU', department: 'Government & Welfare', moduleName: 'Yuva Siksha', entityType: 'YUVA_SIKSHA' },

  // 8.9 System & Administration
  DOC: { prefix: 'DOC', department: 'System & Administration', moduleName: 'Document Vault', entityType: 'DOCUMENT' },
  CHT: { prefix: 'CHT', department: 'System & Administration', moduleName: 'Team Chat', entityType: 'CHAT_MESSAGE' },
  AUD: { prefix: 'AUD', department: 'System & Administration', moduleName: 'Audit Log', entityType: 'AUDIT_LOG' },
  DEL: { prefix: 'DEL', department: 'System & Administration', moduleName: 'Delete History', entityType: 'DELETE_HISTORY' },
  BKP: { prefix: 'BKP', department: 'System & Administration', moduleName: 'Auto Backup', entityType: 'BACKUP_SNAPSHOT' },
  PRJ: { prefix: 'PRJ', department: 'System & Administration', moduleName: 'Project', entityType: 'PROJECT' },
  TGT: { prefix: 'TGT', department: 'System & Administration', moduleName: 'Target', entityType: 'TARGET' },
  MKT: { prefix: 'MKT', department: 'System & Administration', moduleName: 'Marketing', entityType: 'MARKETING' },
  PRM: { prefix: 'PRM', department: 'System & Administration', moduleName: 'Promotion', entityType: 'PROMOTION' },
  FB: { prefix: 'FB', department: 'System & Administration', moduleName: 'Feedback', entityType: 'FEEDBACK' },
  CAP: { prefix: 'CAP', department: 'System & Administration', moduleName: 'Investment', entityType: 'INVESTMENT' }
};

/**
 * Legacy Alias Mapping -> Strictly resolves old caller prefixes into Official Prefix Registry codes
 * without creating ambiguous duplicate prefixes.
 */
const LEGACY_PREFIX_ALIASES: Record<string, string> = {
  APP: 'CASE',
  'SRV-MUN': 'SRV',
  'RCPT-MUN': 'RCPT',
  'INV-MUN': 'INV',
  'EXP-MUN': 'EXP',
  'VCH-MUN': 'VCH',
  'RFD-MUN': 'RFD',
  'INV-CAP': 'CAP',
  'GAS-SRV': 'GASSRV',
  GRVREF: 'GRV',
  CSH: 'TXN',
  CSP: 'BANK',
  RATE: 'SRV',
  CSRV: 'SRV',
  SRVST: 'SRV',
  OPT: 'FLW',
  STH: 'TL',
  SCH: 'FLW',
  GAUD: 'AUD',
  AGY: 'GASDP',
  CYL: 'PRD',
  AREA: 'CUST',
  ELIGRULE: 'GASDBT',
  NTREC: 'GASNT',
  GASDMG: 'ADJ',
  GASACC: 'PRD',
  CPRB: 'PRB',
  CST: 'AUDST',
  VSRV: 'SITEM',
  GPS: 'ATT',
  TSK: 'FLW',
  LOC: 'CUST',
  LD: 'LEAD',
  SR: 'SRET',
  REC: 'BREC',
  QT: 'INV',
  EST: 'INV'
};

export function resolveCanonicalPrefix(rawPrefix: string): PrefixMeta | null {
  const clean = String(rawPrefix || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!clean) return null;
  if (PREFIX_REGISTRY[clean]) return PREFIX_REGISTRY[clean];
  const mapped = LEGACY_PREFIX_ALIASES[clean];
  if (mapped && PREFIX_REGISTRY[mapped]) return PREFIX_REGISTRY[mapped];
  return null;
}

export function getKolkataYear(date = new Date()): { year: number; yearStr: string; isoTimestamp: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const yearStr = parts.find(p => p.type === 'year')?.value || String(date.getUTCFullYear());
  return {
    year: parseInt(yearStr, 10) || 2026,
    yearStr,
    isoTimestamp: date.toISOString()
  };
}

/**
 * Formats an integer serial to minimum 8 digits (00000001 .. 99999999).
 * Safely expands to 9+ digits on overflow (> 99,999,999) without truncating or resetting.
 */
export function formatGlobalSl(serialNum: number): string {
  const safe = Math.max(1, Math.floor(Number(serialNum) || 1));
  const raw = String(safe);
  return raw.length >= STANDARD_SERIAL_LENGTH ? raw : raw.padStart(STANDARD_SERIAL_LENGTH, '0');
}

export function formatGlobalReferenceNo(
  prefix: string,
  year: number | string,
  serialNum: number,
  orgCode = ORGANIZATION_CODE
): string {
  return `${orgCode}-${prefix}-${String(year)}-${formatGlobalSl(serialNum)}`;
}

export interface GlobalReferenceRecord {
  id: number;
  global_sl: string;
  serial_num: number;
  reference_no: string;
  organization_code: string;
  module_prefix: string;
  creation_year: number;
  entity_type: string;
  entity_id: string;
  legacy_reference_no: string | null;
  idempotency_key: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: ReferenceStatus;
}

export interface GenerateReferenceInput {
  prefix: string;
  entityType?: string;
  entityId?: string;
  createdBy?: string;
  legacyReferenceNo?: string;
  idempotencyKey?: string;
  creationYear?: number;
}

export interface GenerateReferenceResult {
  success: boolean;
  reference_no: string;
  global_sl: string;
  serial_num: number;
  organization_code: string;
  module_prefix: string;
  creation_year: number;
  entity_type: string;
  entity_id: string;
  created_by: string;
  created_at: string;
  status: ReferenceStatus;
  reusedIdempotency?: boolean;
  record: GlobalReferenceRecord;
}

export interface LegacyMigrationInputItem {
  prefix: string;
  entityType: string;
  entityId: string;
  legacyReferenceNo?: string;
  createdBy?: string;
  createdAt?: string;
  status?: ReferenceStatus;
}

class GlobalReferenceEngine {
  private attachedDb: DatabaseSync | null = null;
  private schemaReady = false;

  attachDatabase(db: DatabaseSync): void {
    this.attachedDb = db;
    this.schemaReady = false;
    this.ensureSchema(db);
  }

  private getDb(): DatabaseSync {
    if (this.attachedDb) {
      if (!this.schemaReady) this.ensureSchema(this.attachedDb);
      return this.attachedDb;
    }
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const db = new DatabaseSync(SQLITE_DB_PATH);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA busy_timeout = 5000;');
    this.attachedDb = db;
    this.ensureSchema(db);
    return db;
  }

  ensureSchema(db: DatabaseSync): void {
    const nowIso = new Date().toISOString();

    db.exec(`
      -- 1. Central Universal Global Reference Counter (SINGLE ROW, NEVER RESETS)
      CREATE TABLE IF NOT EXISTS global_reference_counter (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        organization_code TEXT NOT NULL DEFAULT 'MUN' CHECK (organization_code = 'MUN'),
        last_serial INTEGER NOT NULL DEFAULT 0 CHECK (last_serial >= 0),
        serial_length INTEGER NOT NULL DEFAULT 8 CHECK (serial_length >= 8),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO global_reference_counter (
        id, organization_code, last_serial, serial_length, created_at, updated_at
      ) VALUES (1, 'MUN', 0, 8, '${nowIso}', '${nowIso}');

      CREATE TRIGGER IF NOT EXISTS trg_global_ref_counter_single_row
      BEFORE INSERT ON global_reference_counter
      WHEN NEW.id <> 1
      BEGIN
        SELECT RAISE(ABORT, 'Only one global_reference_counter (id = 1) is permitted.');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_global_ref_counter_no_delete
      BEFORE DELETE ON global_reference_counter
      BEGIN
        SELECT RAISE(ABORT, 'global_reference_counter cannot be deleted.');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_global_ref_counter_monotonic
      BEFORE UPDATE ON global_reference_counter
      WHEN NEW.last_serial < OLD.last_serial OR NEW.last_serial < 0
      BEGIN
        SELECT RAISE(ABORT, 'global_reference_counter.last_serial is strictly monotonic and cannot decrease or become negative.');
      END;

      -- 2. Central Universal Global Reference Registry (PERMANENT HISTORY)
      CREATE TABLE IF NOT EXISTS global_reference_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        global_sl TEXT NOT NULL UNIQUE,
        serial_num INTEGER NOT NULL UNIQUE,
        reference_no TEXT NOT NULL UNIQUE,
        organization_code TEXT NOT NULL DEFAULT 'MUN',
        module_prefix TEXT NOT NULL,
        creation_year INTEGER NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        legacy_reference_no TEXT,
        idempotency_key TEXT UNIQUE,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DELETED', 'ARCHIVED')),
        UNIQUE(module_prefix, entity_type, entity_id)
      );

      CREATE INDEX IF NOT EXISTS idx_global_ref_no ON global_reference_registry(reference_no);
      CREATE INDEX IF NOT EXISTS idx_global_ref_sl ON global_reference_registry(global_sl);
      CREATE INDEX IF NOT EXISTS idx_global_ref_prefix ON global_reference_registry(module_prefix);
      CREATE INDEX IF NOT EXISTS idx_global_ref_entity ON global_reference_registry(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_global_ref_status ON global_reference_registry(status);
      CREATE INDEX IF NOT EXISTS idx_global_ref_created ON global_reference_registry(created_at DESC);

      -- Protect permanent registry entries from accidental deletion (Section 5 & 13)
      CREATE TRIGGER IF NOT EXISTS trg_global_ref_registry_no_delete
      BEFORE DELETE ON global_reference_registry
      BEGIN
        SELECT RAISE(ABORT, 'global_reference_registry entries are permanent history and cannot be deleted. Mark status = DELETED instead.');
      END;

      -- Protect immutable SL and Reference No once assigned
      CREATE TRIGGER IF NOT EXISTS trg_global_ref_registry_immutable_sl
      BEFORE UPDATE ON global_reference_registry
      WHEN NEW.global_sl <> OLD.global_sl OR NEW.serial_num <> OLD.serial_num OR NEW.reference_no <> OLD.reference_no
      BEGIN
        SELECT RAISE(ABORT, 'Assigned global_sl and reference_no are immutable and cannot be changed.');
      END;
    `);

    this.schemaReady = true;
  }

  /**
   * Core atomic generator executing inside an ALREADY ACTIVE SQLite BEGIN IMMEDIATE transaction.
   * Ensures counter read, increment, main record save, and registry insert rollback together on failure.
   */
  generateGlobalReferenceInTx(db: DatabaseSync, input: GenerateReferenceInput): GenerateReferenceResult {
    this.ensureSchema(db);

    const meta = resolveCanonicalPrefix(input.prefix);
    if (!meta) {
      throw Object.assign(
        new Error(`Unregistered module prefix '${String(input.prefix || '')}'. Every internal module must use an official prefix from the Prefix Registry.`),
        { statusCode: 400 }
      );
    }

    const prefix = meta.prefix;
    const entityType = String(input.entityType || meta.entityType).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '') || meta.entityType;
    const rawEntityId = String(input.entityId || '').trim();
    const idempotencyKey = input.idempotencyKey ? String(input.idempotencyKey).trim() : null;
    const createdBy = String(input.createdBy || 'SYSTEM').trim() || 'SYSTEM';
    const legacyReferenceNo = input.legacyReferenceNo ? String(input.legacyReferenceNo).trim() : null;

    // 1. Idempotency check (retry safety — never allocates a duplicate SL)
    if (idempotencyKey) {
      const existingByIdem = db
        .prepare(`SELECT * FROM global_reference_registry WHERE idempotency_key = ? LIMIT 1`)
        .get(idempotencyKey) as GlobalReferenceRecord | undefined;
      if (existingByIdem) {
        return {
          success: true,
          reference_no: existingByIdem.reference_no,
          global_sl: existingByIdem.global_sl,
          serial_num: existingByIdem.serial_num,
          organization_code: existingByIdem.organization_code,
          module_prefix: existingByIdem.module_prefix,
          creation_year: existingByIdem.creation_year,
          entity_type: existingByIdem.entity_type,
          entity_id: existingByIdem.entity_id,
          created_by: existingByIdem.created_by,
          created_at: existingByIdem.created_at,
          status: existingByIdem.status,
          reusedIdempotency: true,
          record: existingByIdem
        };
      }
    }

    // 2. Entity uniqueness check if caller provided an existing entityId
    if (rawEntityId) {
      const existingByEntity = db
        .prepare(`SELECT * FROM global_reference_registry WHERE module_prefix = ? AND entity_type = ? AND entity_id = ? LIMIT 1`)
        .get(prefix, entityType, rawEntityId) as GlobalReferenceRecord | undefined;
      if (existingByEntity) {
        return {
          success: true,
          reference_no: existingByEntity.reference_no,
          global_sl: existingByEntity.global_sl,
          serial_num: existingByEntity.serial_num,
          organization_code: existingByEntity.organization_code,
          module_prefix: existingByEntity.module_prefix,
          creation_year: existingByEntity.creation_year,
          entity_type: existingByEntity.entity_type,
          entity_id: existingByEntity.entity_id,
          created_by: existingByEntity.created_by,
          created_at: existingByEntity.created_at,
          status: existingByEntity.status,
          reusedIdempotency: true,
          record: existingByEntity
        };
      }
    }

    // 3. Read central counter & increment strictly by +1 (no reset ever)
    const counterRow = db
      .prepare(`SELECT last_serial, serial_length FROM global_reference_counter WHERE id = 1`)
      .get() as { last_serial: number; serial_length: number } | undefined;

    const currentLast = counterRow ? Number(counterRow.last_serial) : 0;
    const maxRegRow = db
      .prepare(`SELECT COALESCE(MAX(serial_num), 0) AS max_sl FROM global_reference_registry`)
      .get() as { max_sl: number } | undefined;
    const floor = Math.max(currentLast, Number(maxRegRow?.max_sl || 0));

    const nextSerialNum = floor + 1;
    const globalSl = formatGlobalSl(nextSerialNum);
    const { year: kolkataYear, isoTimestamp } = getKolkataYear();
    const creationYear = input.creationYear && Number.isFinite(input.creationYear)
      ? Math.floor(input.creationYear)
      : kolkataYear;
    const orgCode = meta.organizationCode || ORGANIZATION_CODE;
    const referenceNo = formatGlobalReferenceNo(prefix, creationYear, nextSerialNum, orgCode);
    const effectiveEntityId = rawEntityId || referenceNo;

    // 4. Update global_reference_counter
    db.prepare(`
      UPDATE global_reference_counter
      SET last_serial = ?,
          serial_length = ?,
          updated_at = ?
      WHERE id = 1
    `).run(nextSerialNum, Math.max(STANDARD_SERIAL_LENGTH, globalSl.length), isoTimestamp);

    // 5. Insert permanent record into global_reference_registry
    db.prepare(`
      INSERT INTO global_reference_registry (
        global_sl, serial_num, reference_no, organization_code, module_prefix,
        creation_year, entity_type, entity_id, legacy_reference_no, idempotency_key,
        created_by, created_at, updated_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(
      globalSl,
      nextSerialNum,
      referenceNo,
      orgCode,
      prefix,
      creationYear,
      entityType,
      effectiveEntityId,
      legacyReferenceNo,
      idempotencyKey,
      createdBy,
      isoTimestamp,
      isoTimestamp
    );

    const saved = db
      .prepare(`SELECT * FROM global_reference_registry WHERE reference_no = ?`)
      .get(referenceNo) as unknown as GlobalReferenceRecord;

    return {
      success: true,
      reference_no: saved.reference_no,
      global_sl: saved.global_sl,
      serial_num: saved.serial_num,
      organization_code: saved.organization_code,
      module_prefix: saved.module_prefix,
      creation_year: saved.creation_year,
      entity_type: saved.entity_type,
      entity_id: saved.entity_id,
      created_by: saved.created_by,
      created_at: saved.created_at,
      status: saved.status,
      reusedIdempotency: false,
      record: saved
    };
  }

  /**
   * Public Atomic Reference Generator (starts BEGIN IMMEDIATE SQLite transaction).
   */
  generateGlobalReference(
    prefixOrParams: string | GenerateReferenceInput,
    entityType?: string,
    entityId?: string,
    createdBy?: string
  ): GenerateReferenceResult {
    const input: GenerateReferenceInput = typeof prefixOrParams === 'string'
      ? { prefix: prefixOrParams, entityType, entityId, createdBy }
      : prefixOrParams;

    const db = this.getDb();
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = this.generateGlobalReferenceInTx(db, input);
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

  /**
   * Read-only Counter Status & Next Preview (never increments counter).
   */
  getCounterStatus(previewPrefix?: string): {
    organization_code: string;
    last_serial: number;
    last_global_sl: string;
    next_serial: number;
    next_global_sl: string;
    serial_length: number;
    preview_reference_no: string;
    creation_year: number;
    total_registered: number;
    active_count: number;
    deleted_count: number;
    archived_count: number;
    updated_at: string;
    prefix_registry: PrefixMeta[];
  } {
    const db = this.getDb();
    const row = db
      .prepare(`SELECT * FROM global_reference_counter WHERE id = 1`)
      .get() as { organization_code: string; last_serial: number; serial_length: number; updated_at: string } | undefined;

    const counts = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_cnt,
        SUM(CASE WHEN status = 'DELETED' THEN 1 ELSE 0 END) AS deleted_cnt,
        SUM(CASE WHEN status = 'ARCHIVED' THEN 1 ELSE 0 END) AS archived_cnt
      FROM global_reference_registry
    `).get() as { total: number; active_cnt: number | null; deleted_cnt: number | null; archived_cnt: number | null };

    const lastSerial = Number(row?.last_serial || 0);
    const nextSerial = lastSerial + 1;
    const nextSl = formatGlobalSl(nextSerial);
    const lastSl = lastSerial > 0 ? formatGlobalSl(lastSerial) : '00000000';
    const { year } = getKolkataYear();
    const resolvedMeta = previewPrefix ? resolveCanonicalPrefix(previewPrefix) : null;
    const pfx = resolvedMeta?.prefix || 'CUST';
    const orgCode = resolvedMeta?.organizationCode || ORGANIZATION_CODE;

    return {
      organization_code: orgCode,
      last_serial: lastSerial,
      last_global_sl: lastSl,
      next_serial: nextSerial,
      next_global_sl: nextSl,
      serial_length: Math.max(STANDARD_SERIAL_LENGTH, nextSl.length),
      preview_reference_no: formatGlobalReferenceNo(pfx, year, nextSerial, orgCode),
      creation_year: year,
      total_registered: Number(counts?.total || 0),
      active_count: Number(counts?.active_cnt || 0),
      deleted_count: Number(counts?.deleted_cnt || 0),
      archived_count: Number(counts?.archived_cnt || 0),
      updated_at: row?.updated_at || new Date().toISOString(),
      prefix_registry: Object.values(PREFIX_REGISTRY)
    };
  }

  getReferenceDetails(referenceNoOrSl: string): GlobalReferenceRecord | null {
    const clean = String(referenceNoOrSl || '').trim().toUpperCase();
    if (!clean) return null;
    const db = this.getDb();

    // Match exact reference_no, exact global_sl, or numeric SL padded to 8 digits
    const paddedSl = /^\d+$/.test(clean) ? formatGlobalSl(parseInt(clean, 10)) : clean;
    const row = db
      .prepare(`
        SELECT * FROM global_reference_registry
        WHERE UPPER(reference_no) = ?
           OR global_sl = ?
           OR entity_id = ?
           OR UPPER(COALESCE(legacy_reference_no, '')) = ?
        LIMIT 1
      `)
      .get(clean, paddedSl, clean, clean) as GlobalReferenceRecord | undefined;

    return row || null;
  }

  searchReferences(
    query: string,
    opts?: { prefix?: string; status?: string; limit?: number }
  ): GlobalReferenceRecord[] {
    const db = this.getDb();
    const q = String(query || '').trim();
    const limit = Math.min(200, Math.max(1, Number(opts?.limit || 50)));

    const where: string[] = [];
    const params: any[] = [];

    if (q) {
      const like = `%${q}%`;
      const numericOnly = /^\d+$/.test(q) ? formatGlobalSl(parseInt(q, 10)) : '';
      if (numericOnly) {
        where.push(`(reference_no LIKE ? OR global_sl LIKE ? OR global_sl = ? OR entity_id LIKE ? OR COALESCE(legacy_reference_no, '') LIKE ?)`);
        params.push(like, like, numericOnly, like, like);
      } else {
        where.push(`(reference_no LIKE ? OR global_sl LIKE ? OR module_prefix LIKE ? OR entity_type LIKE ? OR entity_id LIKE ? OR COALESCE(legacy_reference_no, '') LIKE ? OR created_by LIKE ?)`);
        params.push(like, like, like, like, like, like, like);
      }
    }

    if (opts?.prefix && opts.prefix !== 'ALL') {
      const meta = resolveCanonicalPrefix(opts.prefix);
      where.push(`module_prefix = ?`);
      params.push(meta ? meta.prefix : opts.prefix.trim().toUpperCase());
    }

    if (opts?.status && opts.status !== 'ALL') {
      where.push(`status = ?`);
      params.push(opts.status.trim().toUpperCase());
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);

    return db
      .prepare(`SELECT * FROM global_reference_registry ${whereSql} ORDER BY serial_num DESC LIMIT ?`)
      .all(...params) as unknown as GlobalReferenceRecord[];
  }

  /**
   * Marks a registry record as DELETED or ARCHIVED without ever deleting or freeing its Global SL.
   */
  markReferenceStatus(
    referenceNoOrEntityId: string,
    status: 'DELETED' | 'ARCHIVED' | 'ACTIVE',
    actorUid = 'SYSTEM'
  ): { success: boolean; updated: number } {
    const clean = String(referenceNoOrEntityId || '').trim();
    if (!clean) return { success: false, updated: 0 };
    const db = this.getDb();
    const nowIso = new Date().toISOString();
    const res = db
      .prepare(`
        UPDATE global_reference_registry
        SET status = ?, updated_at = ?
        WHERE UPPER(reference_no) = UPPER(?) OR entity_id = ? OR UPPER(COALESCE(legacy_reference_no, '')) = UPPER(?)
      `)
      .run(status, nowIso, clean, clean, clean);
    return { success: true, updated: Number(res.changes || 0) };
  }

  /**
   * Deterministic, idempotent migration for pre-existing records (Section 10).
   * Preserves original Primary Keys & legacy_reference_no; never creates duplicate SLs on re-run.
   */
  migrateExistingRecords(items: LegacyMigrationInputItem[], actorUid = 'MIGRATION'): {
    totalEvaluated: number;
    migratedCount: number;
    alreadyMigratedCount: number;
    skippedInvalidCount: number;
    lastSerialAfter: number;
    mappings: Array<{ entityType: string; entityId: string; legacyReferenceNo: string; referenceNo: string; globalSl: string }>;
  } {
    const db = this.getDb();
    const valid = items
      .map(item => {
        const meta = resolveCanonicalPrefix(item.prefix);
        if (!meta || !item.entityId) return null;
        return {
          ...item,
          prefix: meta.prefix,
          entityType: String(item.entityType || meta.entityType).trim().toUpperCase(),
          entityId: String(item.entityId).trim(),
          createdAt: item.createdAt || '1970-01-01T00:00:00.000Z'
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    // Deterministic order: creation timestamp -> module prefix -> primary key (Section 10)
    valid.sort((a, b) => {
      const tCmp = String(a.createdAt).localeCompare(String(b.createdAt));
      if (tCmp !== 0) return tCmp;
      const pCmp = a.prefix.localeCompare(b.prefix);
      if (pCmp !== 0) return pCmp;
      return a.entityId.localeCompare(b.entityId);
    });

    let migratedCount = 0;
    let alreadyMigratedCount = 0;
    const mappings: Array<{ entityType: string; entityId: string; legacyReferenceNo: string; referenceNo: string; globalSl: string }> = [];

    db.exec('BEGIN IMMEDIATE');
    try {
      for (const item of valid) {
        const existing = db
          .prepare(`SELECT * FROM global_reference_registry WHERE module_prefix = ? AND entity_type = ? AND entity_id = ? LIMIT 1`)
          .get(item.prefix, item.entityType, item.entityId) as GlobalReferenceRecord | undefined;

        if (existing) {
          alreadyMigratedCount += 1;
          mappings.push({
            entityType: item.entityType,
            entityId: item.entityId,
            legacyReferenceNo: item.legacyReferenceNo || item.entityId,
            referenceNo: existing.reference_no,
            globalSl: existing.global_sl
          });
          continue;
        }

        const parsedYear = /^\d{4}/.test(item.createdAt) ? parseInt(item.createdAt.slice(0, 4), 10) : undefined;
        const allocated = this.generateGlobalReferenceInTx(db, {
          prefix: item.prefix,
          entityType: item.entityType,
          entityId: item.entityId,
          legacyReferenceNo: item.legacyReferenceNo || item.entityId,
          createdBy: item.createdBy || actorUid,
          creationYear: parsedYear && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : undefined
        });

        if (item.status && item.status !== 'ACTIVE') {
          db.prepare(`UPDATE global_reference_registry SET status = ? WHERE id = ?`)
            .run(item.status, allocated.record.id);
        }

        migratedCount += 1;
        mappings.push({
          entityType: item.entityType,
          entityId: item.entityId,
          legacyReferenceNo: item.legacyReferenceNo || item.entityId,
          referenceNo: allocated.reference_no,
          globalSl: allocated.global_sl
        });
      }
      db.exec('COMMIT');
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    }

    const status = this.getCounterStatus();
    return {
      totalEvaluated: items.length,
      migratedCount,
      alreadyMigratedCount,
      skippedInvalidCount: items.length - valid.length,
      lastSerialAfter: status.last_serial,
      mappings
    };
  }

  /**
   * Verifies database consistency after startup or backup restore (Section 13 & 15).
   * Heals counter floor upward ONLY if registry has a higher serial (never lowers counter).
   */
  verifyConsistency(autoHealFloor = true): {
    ok: boolean;
    lastSerial: number;
    maxRegistrySerial: number;
    totalRegistryRows: number;
    duplicateSerialCount: number;
    duplicateRefCount: number;
    healedFloor: boolean;
    issues: string[];
  } {
    const db = this.getDb();
    this.ensureSchema(db);

    const counter = db.prepare(`SELECT last_serial FROM global_reference_counter WHERE id = 1`).get() as { last_serial: number } | undefined;
    const agg = db.prepare(`SELECT COUNT(*) AS cnt, COALESCE(MAX(serial_num), 0) AS max_sl FROM global_reference_registry`).get() as { cnt: number; max_sl: number };
    const dupSl = db.prepare(`SELECT COUNT(*) AS cnt FROM (SELECT serial_num FROM global_reference_registry GROUP BY serial_num HAVING COUNT(*) > 1)`).get() as { cnt: number };
    const dupRef = db.prepare(`SELECT COUNT(*) AS cnt FROM (SELECT reference_no FROM global_reference_registry GROUP BY reference_no HAVING COUNT(*) > 1)`).get() as { cnt: number };

    let lastSerial = Number(counter?.last_serial || 0);
    const maxRegistrySerial = Number(agg?.max_sl || 0);
    let healedFloor = false;
    const issues: string[] = [];

    if (lastSerial < 0) issues.push('Negative last_serial detected.');
    if (dupSl.cnt > 0) issues.push(`Found ${dupSl.cnt} duplicate serial_num entries.`);
    if (dupRef.cnt > 0) issues.push(`Found ${dupRef.cnt} duplicate reference_no entries.`);

    if (maxRegistrySerial > lastSerial) {
      if (autoHealFloor) {
        db.prepare(`UPDATE global_reference_counter SET last_serial = ?, updated_at = ? WHERE id = 1`)
          .run(maxRegistrySerial, new Date().toISOString());
        lastSerial = maxRegistrySerial;
        healedFloor = true;
      } else {
        issues.push(`Counter last_serial (${lastSerial}) is behind max registry serial (${maxRegistrySerial}).`);
      }
    }

    return {
      ok: issues.length === 0,
      lastSerial,
      maxRegistrySerial,
      totalRegistryRows: Number(agg?.cnt || 0),
      duplicateSerialCount: Number(dupSl?.cnt || 0),
      duplicateRefCount: Number(dupRef?.cnt || 0),
      healedFloor,
      issues
    };
  }
}

export const globalReferenceEngine = new GlobalReferenceEngine();
