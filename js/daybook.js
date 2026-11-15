/**
 * daybook.js - Counter Day Book, Opening/Closing Cash & Cash Transaction Ledger
 * MUN COMPUTER - Centralized Business ERP
 */

import { getItem, setItem, KEYS, allocateGlobalReference, markGlobalReferenceDeleted, getTodayDate, logAuditAction, getAuthHeaders } from './storage.js';
import { getAllPayments } from './payments.js';
import { getAllExpenses } from './expenses.js';

export const COUNTER_TXN_TYPES = {
  CASH_RECEIVED: 'Cash Received',
  CASH_PAYMENT: 'Cash Payment',
  CASH_DEPOSIT: 'Cash Deposit',
  CASH_WITHDRAWAL: 'Cash Withdrawal'
};

export const DENOMINATION_SPEC = [
  { key: 'd500', label: '₹500', pdfLabel: 'Rs. 500', value: 500, kind: 'note' },
  { key: 'd200', label: '₹200', pdfLabel: 'Rs. 200', value: 200, kind: 'note' },
  { key: 'd100', label: '₹100', pdfLabel: 'Rs. 100', value: 100, kind: 'note' },
  { key: 'd50', label: '₹50', pdfLabel: 'Rs. 50', value: 50, kind: 'note' },
  { key: 'd20', label: '₹20', pdfLabel: 'Rs. 20', value: 20, kind: 'note' },
  { key: 'd10_note', label: '₹10 (Notes)', pdfLabel: 'Rs. 10 (Notes)', value: 10, kind: 'note' },
  { key: 'd10_coin', label: '₹10 (Coins)', pdfLabel: 'Rs. 10 (Coins)', value: 10, kind: 'coin' },
  { key: 'c5', label: '₹5 (Coins)', pdfLabel: 'Rs. 5 (Coins)', value: 5, kind: 'coin' },
  { key: 'c2', label: '₹2 (Coins)', pdfLabel: 'Rs. 2 (Coins)', value: 2, kind: 'coin' },
  { key: 'c1', label: '₹1 (Coins)', pdfLabel: 'Rs. 1 (Coins)', value: 1, kind: 'coin' }
];

export function emptyDenominations() {
  return {
    d500: 0,
    d200: 0,
    d100: 0,
    d50: 0,
    d20: 0,
    d10_note: 0,
    d10_coin: 0,
    c5: 0,
    c2: 0,
    c1: 0
  };
}

export function normalizeDenominations(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const toQty = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const hasNewCoins = src.c5 !== undefined || src.c2 !== undefined || src.c1 !== undefined;
  const legacyCoinsAmt = !hasNewCoins ? Math.max(0, Math.floor(Number(src.coins) || 0)) : 0;

  return {
    d500: toQty(src.d500),
    d200: toQty(src.d200),
    d100: toQty(src.d100),
    d50: toQty(src.d50),
    d20: toQty(src.d20),
    d10_note: src.d10_note !== undefined ? toQty(src.d10_note) : toQty(src.d10),
    d10_coin: toQty(src.d10_coin),
    c5: toQty(src.c5),
    c2: toQty(src.c2),
    c1: src.c1 !== undefined ? toQty(src.c1) : legacyCoinsAmt
  };
}

export function calculateDenominationTotal(raw = {}) {
  const norm = normalizeDenominations(raw);
  return DENOMINATION_SPEC.reduce((sum, spec) => sum + (norm[spec.key] || 0) * spec.value, 0);
}

export function getAllDaybookEntries() {
  return getItem(KEYS.DAYBOOK, []);
}

export function getDaybookForDate(date = getTodayDate()) {
  const entries = getAllDaybookEntries();
  return entries.find(e => e.date === date) || null;
}

export function getAllCounterCashTxns() {
  return getItem(KEYS.COUNTER_CASH_TXNS, []);
}

export function getCounterCashTxnsForDate(date = getTodayDate()) {
  return getAllCounterCashTxns().filter(t => t.date === date);
}

export async function addCounterCashTxn(txnData) {
  const list = getAllCounterCashTxns();
  const modeRaw = String(txnData.paymentMode || 'Cash').trim();
  const paymentMode = ['Cash', 'UPI', 'QR', 'Due', 'Bank'].includes(modeRaw) ? modeRaw : 'Cash';
  const txnId = txnData.id || await allocateGlobalReference('TXN', { entityType: 'COUNTER_CASH_TXN' });
  const entry = {
    id: txnId,
    date: txnData.date || getTodayDate(),
    time: txnData.time || new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }),
    type: txnData.type || 'CASH_RECEIVED',
    category: String(txnData.category || '').trim() || (COUNTER_TXN_TYPES[txnData.type] || 'Counter Entry'),
    paymentMode,
    partyName: String(txnData.partyName || '').trim() || 'Counter Entry',
    amount: Math.max(0, Number(txnData.amount) || 0),
    reference: String(txnData.reference || '').trim(),
    notes: String(txnData.notes || '').trim(),
    createdBy: String(txnData.createdBy || 'Staff').trim(),
    actorUid: String(txnData.actorUid || '').trim(),
    createdAt: new Date().toISOString()
  };

  if (txnData.id) {
    const idx = list.findIndex(t => t.id === txnData.id);
    if (idx !== -1) list[idx] = { ...list[idx], ...entry };
    else list.unshift(entry);
  } else {
    list.unshift(entry);
  }
  setItem(KEYS.COUNTER_CASH_TXNS, list);
  logAuditAction('COUNTER_CASH_TXN', `${entry.type} ₹${entry.amount} on ${entry.date} (${entry.partyName})`);
  return { success: true, entry };
}

export function deleteCounterCashTxn(id) {
  const list = getAllCounterCashTxns().filter(t => t.id !== id);
  setItem(KEYS.COUNTER_CASH_TXNS, list);
  markGlobalReferenceDeleted(id, 'DELETED');
  logAuditAction('COUNTER_CASH_TXN_DELETE', `Deleted counter cash transaction ${id}`);
  return { success: true };
}

export async function syncDaybookFromServer() {
  try {
    const resp = await fetch('/api/daybook', { headers: getAuthHeaders() });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.success) return null;

    if (Array.isArray(data.txns) && data.txns.length > 0) {
      const localTxns = getAllCounterCashTxns();
      const map = new Map();
      data.txns.forEach(t => map.set(t.id, t));
      localTxns.forEach(t => { if (!map.has(t.id)) map.set(t.id, t); });
      const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setItem(KEYS.COUNTER_CASH_TXNS, merged);
    }
    if (Array.isArray(data.snapshots) && data.snapshots.length > 0) {
      const localSnaps = getAllDaybookEntries();
      const map = new Map();
      localSnaps.forEach(s => map.set(s.date, s));
      data.snapshots.forEach(s => map.set(s.date, s));
      setItem(KEYS.DAYBOOK, Array.from(map.values()).sort((a, b) => (b.date > a.date ? 1 : -1)));
    }
    return data;
  } catch {
    return null;
  }
}

export async function syncAddCounterCashTxnToServer(entry) {
  try {
    const resp = await fetch('/api/daybook/txn', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(entry)
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      return { success: true, entry: data.entry };
    }
    return { success: false, message: data.message || 'Server denied counter cash entry.' };
  } catch {
    return { success: true, offline: true, entry };
  }
}

export async function syncDeleteCounterCashTxnToServer(id, reason) {
  try {
    const resp = await fetch(`/api/daybook/txn/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    const data = await resp.json();
    if (resp.ok && data.success) return { success: true };
    return { success: false, message: data.message || 'Delete denied by server.' };
  } catch {
    return { success: true, offline: true };
  }
}

export async function syncDaybookSnapshotToServer(snapshot) {
  try {
    const resp = await fetch('/api/daybook/snapshot', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(snapshot)
    });
    const data = await resp.json();
    return resp.ok && data.success ? { success: true, entry: data.entry } : { success: false, message: data.message };
  } catch {
    return { success: true, offline: true };
  }
}

/**
 * Find the most recent saved closing cash strictly before `date`
 */
export function getPreviousDayClosingInfo(date = getTodayDate()) {
  const entries = getAllDaybookEntries()
    .filter(e => e.date && e.date < date)
    .sort((a, b) => (b.date > a.date ? 1 : -1));
  if (entries.length === 0) {
    return { prevDate: null, prevClosingCash: 0, prevStatus: null };
  }
  const latest = entries[0];
  const closingVal = Number(latest.closingCash ?? latest.countedPhysicalCash ?? latest.expectedClosing) || 0;
  return {
    prevDate: latest.date,
    prevClosingCash: closingVal,
    prevStatus: latest.status || 'Saved'
  };
}

function normalizePaymentMode(raw) {
  const m = String(raw || 'Cash').trim().toLowerCase();
  if (!m || m === 'cash') return 'Cash';
  if (m === 'upi') return 'UPI';
  if (m === 'qr' || m === 'qr payment') return 'QR';
  if (m === 'due' || m === 'credit') return 'Due';
  return 'Bank';
}

/**
 * Automatically compute real-time Counter Day Book tallies for a given date.
 * Physical Drawer Balance equation:
 * Opening Cash + Cash Received + Cash Withdrawal (to drawer) - Cash Payment - Cash Deposit (banked out of drawer)
 * UPI, QR, Bank, and unpaid Due transactions are tracked separately and never mixed into physical cash in hand.
 */
export function calculateDayTally(date = getTodayDate()) {
  const payments = getAllPayments();
  const expenses = getAllExpenses();
  const manualTxns = getCounterCashTxnsForDate(date);
  const services = getItem(KEYS.SERVICES, []);
  const invoices = getItem(KEYS.INVOICES, []);
  const existing = getDaybookForDate(date);
  const prevInfo = getPreviousDayClosingInfo(date);

  let serviceCashIn = 0;
  let upiIn = 0;
  let qrIn = 0;
  let bankIn = 0;

  payments.forEach(p => {
    if (p.paymentDate !== date) return;
    const amt = Number(p.paymentAmount) || 0;
    const mode = normalizePaymentMode(p.paymentMethod);
    if (mode === 'Cash') serviceCashIn += amt;
    else if (mode === 'UPI') upiIn += amt;
    else if (mode === 'QR') qrIn += amt;
    else if (mode !== 'Due') bankIn += amt;
  });

  let cashExpenses = 0;
  let upiOut = 0;
  let qrOut = 0;
  let bankOut = 0;

  expenses.forEach(e => {
    if (e.date !== date) return;
    const amt = Number(e.amount) || 0;
    const mode = normalizePaymentMode(e.paymentMethod);
    if (mode === 'Cash') cashExpenses += amt;
    else if (mode === 'UPI') upiOut += amt;
    else if (mode === 'QR') qrOut += amt;
    else if (mode !== 'Due') bankOut += amt;
  });

  let manualCashReceived = 0;
  let manualCashPayment = 0;
  let cashDeposit = 0;
  let cashWithdrawal = 0;
  let manualDueTotal = 0;

  manualTxns.forEach(t => {
    const amt = Number(t.amount) || 0;
    const mode = normalizePaymentMode(t.paymentMode);
    if (mode === 'Due') {
      manualDueTotal += amt;
      return;
    }
    if (mode !== 'Cash') {
      if (t.type === 'CASH_RECEIVED' || t.type === 'CASH_WITHDRAWAL') {
        if (mode === 'UPI') upiIn += amt;
        else if (mode === 'QR') qrIn += amt;
        else bankIn += amt;
      } else {
        if (mode === 'UPI') upiOut += amt;
        else if (mode === 'QR') qrOut += amt;
        else bankOut += amt;
      }
      return;
    }
    if (t.type === 'CASH_RECEIVED') manualCashReceived += amt;
    else if (t.type === 'CASH_PAYMENT') manualCashPayment += amt;
    else if (t.type === 'CASH_DEPOSIT') cashDeposit += amt;
    else if (t.type === 'CASH_WITHDRAWAL') cashWithdrawal += amt;
  });

  let duePendingTotal = manualDueTotal;
  (Array.isArray(services) ? services : []).forEach(s => {
    if (s.appDate === date && !['Cancelled', 'Rejected'].includes(s.status)) {
      const due = Math.max(0, (Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0));
      if (due > 0) duePendingTotal += due;
    }
  });
  (Array.isArray(invoices) ? invoices : []).forEach(inv => {
    if (inv.date === date) {
      const due = Math.max(0, (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0));
      if (due > 0) duePendingTotal += due;
    }
  });

  const cashReceived = serviceCashIn + manualCashReceived;
  const cashPayment = cashExpenses + manualCashPayment;
  const totalCashIn = cashReceived + cashWithdrawal;
  const totalCashOut = cashPayment + cashDeposit;

  const previousDayBalance = existing && existing.previousDayBalance !== undefined
    ? Number(existing.previousDayBalance) || 0
    : prevInfo.prevClosingCash;

  const hasSavedOpening = Boolean(existing && existing.openingSaved);
  const openingCash = existing ? (Number(existing.openingCash) || 0) : prevInfo.prevClosingCash;

  const netCashInflow = totalCashIn - totalCashOut;
  const expectedClosing = openingCash + netCashInflow;
  const countedPhysicalCash = existing && existing.closingSaved
    ? Number(existing.countedPhysicalCash) || 0
    : (existing && existing.countedPhysicalCash !== undefined && existing.status !== 'Open'
      ? Number(existing.countedPhysicalCash) || 0
      : expectedClosing);
  const difference = countedPhysicalCash - expectedClosing;

  const openingDenominations = normalizeDenominations(existing?.openingDenominations);
  const denominations = normalizeDenominations(existing?.denominations);
  const openingDenomTotal = calculateDenominationTotal(openingDenominations);
  const closingDenomTotal = calculateDenominationTotal(denominations);

  return {
    date,
    prevDate: prevInfo.prevDate,
    previousDayBalance,
    openingCash,
    openingSaved: hasSavedOpening,
    openingNotes: existing?.openingNotes || '',
    openingDenominations,
    openingDenomTotal,
    serviceCashIn,
    manualCashReceived,
    cashReceived,
    totalCashIn,
    cashExpenses,
    manualCashPayment,
    cashPayment,
    cashDeposit,
    cashWithdrawal,
    totalCashOut,
    upiIn,
    qrIn,
    bankIn,
    upiOut,
    qrOut,
    bankOut,
    duePendingTotal,
    cspCashIn: 0,
    cspCashOut: 0,
    cspCommission: 0,
    netCashInflow,
    expectedClosing,
    countedPhysicalCash,
    closingCash: countedPhysicalCash,
    closingSaved: Boolean(existing?.closingSaved),
    difference,
    status: existing ? existing.status : 'Open',
    denominations,
    closingDenomTotal,
    verifiedBy: existing?.verifiedBy || 'MUN (Admin)',
    notes: existing?.notes || '',
    txns: manualTxns
  };
}

function formatTimeFromIso(isoStr, fallbackTime = '') {
  if (fallbackTime && fallbackTime !== '-') return fallbackTime;
  if (!isoStr) return 'Counter';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return 'Counter';
  return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Builds the complete chronological 8-column Day Book ledger for a single date
 * with accurate physical Running Balance starting from `openingCash`.
 */
export function buildCounterLedgerRows(date = getTodayDate(), query = '') {
  const tally = calculateDayTally(date);
  const payments = getAllPayments();
  const expenses = getAllExpenses();
  const manualTxns = getCounterCashTxnsForDate(date);
  const services = getItem(KEYS.SERVICES, []);
  const invoices = getItem(KEYS.INVOICES, []);

  const rawRows = [];

  payments.forEach(p => {
    if (p.paymentDate !== date) return;
    const mode = normalizePaymentMode(p.paymentMethod);
    const amt = Number(p.paymentAmount) || 0;
    const isCash = mode === 'Cash';
    rawRows.push({
      id: p.id,
      voucherId: p.receiptId || p.invoiceNumber || p.id,
      date: p.paymentDate,
      time: formatTimeFromIso(p.createdAt),
      sortTs: p.createdAt || `${date}T09:00:00`,
      partyName: p.customerName || 'Customer',
      categoryLabel: p.collectionType || (p.remarks ? `Service / Due Collection (${p.remarks})` : 'Service / Due Collection'),
      paymentMode: mode,
      cashIn: isCash ? amt : 0,
      cashOut: 0,
      nonCashAmount: isCash ? 0 : amt,
      notes: p.remarks || p.reference || '',
      createdBy: p.receivedBy || 'Staff',
      actorUid: '',
      type: 'CASH_RECEIVED',
      source: 'PAYMENT'
    });
  });

  expenses.forEach(e => {
    if (e.date !== date) return;
    const mode = normalizePaymentMode(e.paymentMethod);
    const amt = Number(e.amount) || 0;
    const isCash = mode === 'Cash';
    rawRows.push({
      id: e.id,
      voucherId: e.billNumber || e.id,
      date: e.date,
      time: formatTimeFromIso(e.createdAt),
      sortTs: e.createdAt || `${date}T12:00:00`,
      partyName: e.vendorName || e.title || 'Shop Expense',
      categoryLabel: e.category || 'Shop Expense',
      paymentMode: mode,
      cashIn: 0,
      cashOut: isCash ? amt : 0,
      nonCashAmount: isCash ? 0 : amt,
      notes: e.title || e.remarks || '',
      createdBy: e.addedBy || 'Staff',
      actorUid: '',
      type: 'CASH_PAYMENT',
      source: 'EXPENSE'
    });
  });

  manualTxns.forEach(t => {
    const mode = normalizePaymentMode(t.paymentMode);
    const amt = Number(t.amount) || 0;
    const isIn = t.type === 'CASH_RECEIVED' || t.type === 'CASH_WITHDRAWAL';
    const isCash = mode === 'Cash';
    rawRows.push({
      id: t.id,
      voucherId: t.reference || t.id,
      date: t.date,
      time: formatTimeFromIso(t.createdAt, t.time),
      sortTs: t.createdAt || `${date}T13:00:00`,
      partyName: t.partyName || 'Counter Entry',
      categoryLabel: t.category || COUNTER_TXN_TYPES[t.type] || t.type,
      paymentMode: mode,
      cashIn: isCash && isIn ? amt : 0,
      cashOut: isCash && !isIn ? amt : 0,
      nonCashAmount: isCash ? 0 : amt,
      notes: t.notes || t.reference || '',
      createdBy: t.createdBy || 'Staff',
      actorUid: t.actorUid || '',
      type: t.type,
      source: 'COUNTER'
    });
  });

  // Track unpaid credit / Due items created today without adding them to Cash In
  const seenReceiptDue = new Set();
  (Array.isArray(services) ? services : []).forEach(s => {
    if (s.appDate !== date || ['Cancelled', 'Rejected'].includes(s.status)) return;
    const due = Math.max(0, (Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0));
    if (due <= 0) return;
    const rId = s.receiptId || s.id;
    if (seenReceiptDue.has(rId)) return;
    seenReceiptDue.add(rId);
    const groupDue = services
      .filter(it => (it.receiptId || it.id) === rId && !['Cancelled', 'Rejected'].includes(it.status))
      .reduce((sum, it) => sum + Math.max(0, (Number(it.totalAmount) || 0) - (Number(it.paidAmount) || 0)), 0);
    rawRows.push({
      id: `DUE-${rId}`,
      voucherId: rId,
      date,
      time: formatTimeFromIso(s.createdAt),
      sortTs: s.createdAt || `${date}T18:00:00`,
      partyName: s.customerName || 'Customer',
      categoryLabel: `${s.serviceName || 'Service Receipt'} (Credit / Due)`,
      paymentMode: 'Due',
      cashIn: 0,
      cashOut: 0,
      nonCashAmount: groupDue,
      notes: 'Pending credit due — excluded from Cash In until collected',
      createdBy: s.staff || 'Staff',
      actorUid: '',
      type: 'DUE',
      source: 'DUE_SERVICE'
    });
  });

  (Array.isArray(invoices) ? invoices : []).forEach(inv => {
    if (inv.date !== date) return;
    const due = Math.max(0, (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0));
    if (due <= 0) return;
    rawRows.push({
      id: `DUE-${inv.id}`,
      voucherId: inv.id,
      date,
      time: formatTimeFromIso(inv.createdAt),
      sortTs: inv.createdAt || `${date}T18:30:00`,
      partyName: inv.customerName || 'Customer',
      categoryLabel: `Invoice Billing (Credit / Due)`,
      paymentMode: 'Due',
      cashIn: 0,
      cashOut: 0,
      nonCashAmount: due,
      notes: 'Pending invoice due — excluded from Cash In until collected',
      createdBy: 'Staff',
      actorUid: '',
      type: 'DUE',
      source: 'DUE_INVOICE'
    });
  });

  // Sort chronologically to compute accurate row-by-row Running Balance from Opening Cash
  rawRows.sort((a, b) => String(a.sortTs || '').localeCompare(String(b.sortTs || '')));
  let running = Number(tally.openingCash) || 0;
  const withRunning = rawRows.map(r => {
    running = running + (Number(r.cashIn) || 0) - (Number(r.cashOut) || 0);
    return {
      ...r,
      runningBalance: running
    };
  });

  const q = String(query || '').trim().toLowerCase();
  if (!q) return withRunning;
  return withRunning.filter(r =>
    [r.id, r.voucherId, r.partyName, r.categoryLabel, r.paymentMode, r.notes, r.createdBy, r.actorUid]
      .some(v => String(v || '').toLowerCase().includes(q))
  );
}

export async function saveOpeningCashEntry({ date = getTodayDate(), openingCash = 0, previousDayBalance = 0, openingDenominations = {}, openingNotes = '', verifiedBy = 'Counter Staff' }) {
  const entries = getAllDaybookEntries();
  const idx = entries.findIndex(e => e.date === date);
  const tally = calculateDayTally(date);
  const openAmt = Number(openingCash) || 0;
  const newExpected = openAmt + tally.netCashInflow;

  const existing = idx !== -1 ? entries[idx] : {};
  const normalizedOpeningDenom = normalizeDenominations(openingDenominations);
  const dybId = existing.id || await allocateGlobalReference('DYB', { entityType: 'DAYBOOK' });
  const entry = {
    ...existing,
    id: dybId,
    date,
    previousDayBalance: Number(previousDayBalance) || tally.previousDayBalance || 0,
    openingCash: openAmt,
    openingSaved: true,
    openingDenominations: normalizedOpeningDenom,
    openingNotes,
    serviceCashIn: tally.serviceCashIn,
    manualCashReceived: tally.manualCashReceived,
    cashReceived: tally.cashReceived,
    cashExpenses: tally.cashExpenses,
    manualCashPayment: tally.manualCashPayment,
    cashPayment: tally.cashPayment,
    cashDeposit: tally.cashDeposit,
    cashWithdrawal: tally.cashWithdrawal,
    expectedClosing: newExpected,
    countedPhysicalCash: existing.closingSaved ? (Number(existing.countedPhysicalCash) || 0) : newExpected,
    closingCash: existing.closingSaved ? (Number(existing.closingCash) || 0) : newExpected,
    difference: existing.closingSaved ? ((Number(existing.countedPhysicalCash) || 0) - newExpected) : 0,
    status: existing.closingSaved ? existing.status : 'Counter Opened',
    verifiedBy: verifiedBy || existing.verifiedBy || 'MUN (Admin)',
    businessUnitId: 'mun-computer',
    updatedAt: new Date().toISOString()
  };

  if (idx !== -1) entries[idx] = entry;
  else entries.unshift(entry);

  setItem(KEYS.DAYBOOK, entries);
  logAuditAction('DAILY_OPENING_CASH', `Saved Opening Cash ₹${openAmt} for ${date} (Prev Bal ₹${entry.previousDayBalance})`);
  return { success: true, entry };
}

export async function saveDaybookEntry(entryData) {
  const entries = getAllDaybookEntries();
  const date = entryData.date || getTodayDate();
  const existingIdx = entries.findIndex(e => e.date === date);
  const existing = existingIdx !== -1 ? entries[existingIdx] : {};
  const tally = calculateDayTally(date);

  const openingCash = entryData.openingCash !== undefined ? (Number(entryData.openingCash) || 0) : tally.openingCash;
  const expectedClosing = entryData.expectedClosing !== undefined ? (Number(entryData.expectedClosing) || 0) : (openingCash + tally.netCashInflow);
  const countedPhysicalCash = Number(entryData.countedPhysicalCash ?? entryData.closingCash ?? expectedClosing) || 0;
  const difference = countedPhysicalCash - expectedClosing;

  let status = 'Balanced';
  if (difference > 0) status = 'Excess Cash';
  if (difference < 0) status = 'Cash Shortage';

  const dybId = entryData.id || existing.id || await allocateGlobalReference('DYB', { entityType: 'DAYBOOK' });
  const entry = {
    ...existing,
    id: dybId,
    date,
    previousDayBalance: Number(entryData.previousDayBalance ?? tally.previousDayBalance) || 0,
    openingCash,
    openingSaved: Boolean(entryData.openingSaved ?? existing.openingSaved),
    serviceCashIn: Number(entryData.serviceCashIn ?? tally.serviceCashIn) || 0,
    manualCashReceived: Number(entryData.manualCashReceived ?? tally.manualCashReceived) || 0,
    cashReceived: Number(entryData.cashReceived ?? tally.cashReceived) || 0,
    cashExpenses: Number(entryData.cashExpenses ?? tally.cashExpenses) || 0,
    manualCashPayment: Number(entryData.manualCashPayment ?? tally.manualCashPayment) || 0,
    cashPayment: Number(entryData.cashPayment ?? tally.cashPayment) || 0,
    cashDeposit: Number(entryData.cashDeposit ?? tally.cashDeposit) || 0,
    cashWithdrawal: Number(entryData.cashWithdrawal ?? tally.cashWithdrawal) || 0,
    cspCashIn: 0,
    cspCashOut: 0,
    expectedClosing,
    countedPhysicalCash,
    closingCash: countedPhysicalCash,
    closingSaved: true,
    difference,
    status,
    denominations: normalizeDenominations(entryData.denominations || existing.denominations || {}),
    verifiedBy: entryData.verifiedBy || existing.verifiedBy || 'MUN (Admin)',
    notes: entryData.notes ?? existing.notes ?? '',
    businessUnitId: 'mun-computer',
    updatedAt: new Date().toISOString()
  };

  if (existingIdx !== -1) {
    entries[existingIdx] = entry;
  } else {
    entries.unshift(entry);
  }

  setItem(KEYS.DAYBOOK, entries);
  logAuditAction('DAILY_CLOSING_CASH', `Reconciled Counter Day Book for ${date}: Expected ₹${expectedClosing}, Closing ₹${countedPhysicalCash} (${status})`);
  return { success: true, entry };
}
