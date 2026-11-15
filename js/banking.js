/**
 * banking.js - PNB CSP (Bank Mitra) Kiosk Operations & Transaction Management
 * MUN COMPUTER - Centralized Business ERP
 * Location: Mamudpur, Juginda, Domkal, Murshidabad
 */

import { getItem, setItem, KEYS, allocateGlobalReference, markGlobalReferenceDeleted, getTodayDate, logAuditAction, formatINR, formatDate, formatDateTime } from './storage.js';

export const BANKING_TYPES = [
  'AePS Cash Withdrawal',
  'AePS Cash Deposit',
  'Money Transfer (DMT / IMPS)',
  'Jan Dhan (PMJDY) Account Opening',
  'Regular Savings Account Opening',
  'Balance Enquiry',
  'Mini Statement',
  'KCC / Loan Installment',
  'Social Security Schemes (PMSBY / PMJJBY)'
];

export const BANK_PARTNERS = [
  'Punjab National Bank (PNB CSP)',
  'IndusInd Bank Mitra',
  'State Bank of India (Inter-Bank AePS)',
  'Bank of India',
  'Bangiya Gramin Vikash Bank (BGVB)',
  'Central Bank of India',
  'Airtel Payments Bank'
];

export function getCustomBankingServices() {
  return getItem(KEYS.CUSTOM_BANKING_SERVICES, []);
}

export function getAllBankingTypes() {
  const custom = getCustomBankingServices().map(s => s.name).filter(Boolean);
  return Array.from(new Set([...BANKING_TYPES, ...custom]));
}

export async function saveCustomBankingService(data) {
  const cleanName = String(data?.name || '').trim();
  if (!cleanName) {
    return { success: false, message: 'Banking service name is required.' };
  }
  const list = getCustomBankingServices();
  const cbkId = data.id || await allocateGlobalReference('CBK', { entityType: 'CUSTOM_BANKING_SERVICE' });
  const payload = {
    id: cbkId,
    name: cleanName,
    nameBn: String(data.nameBn || '').trim(),
    defaultBank: String(data.defaultBank || 'Punjab National Bank (PNB CSP)').trim(),
    commissionType: data.commissionType === 'percent' ? 'percent' : 'flat',
    commissionValue: Math.max(0, Number(data.commissionValue) || 0),
    minCommission: Math.max(0, Number(data.minCommission) || 0),
    maxCommission: Number(data.maxCommission) > 0 ? Number(data.maxCommission) : 0,
    defaultFee: Math.max(0, Number(data.defaultFee) || 0),
    cashFlowDirection: ['in', 'out', 'neutral'].includes(data.cashFlowDirection) ? data.cashFlowDirection : 'neutral',
    remarks: String(data.remarks || '').trim(),
    isCustom: true,
    updatedAt: new Date().toISOString(),
    createdAt: data.createdAt || new Date().toISOString()
  };

  const idx = list.findIndex(x => x.id === payload.id || x.name.toLowerCase() === cleanName.toLowerCase());
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...payload, id: list[idx].id };
  } else {
    list.unshift(payload);
  }
  setItem(KEYS.CUSTOM_BANKING_SERVICES, list);
  logAuditAction('CUSTOM_BANKING_SERVICE', `Saved custom PNB CSP/Banking service: ${cleanName}`);
  return { success: true, service: payload, isNew: idx === -1 };
}

export function deleteCustomBankingService(id) {
  const list = getCustomBankingServices();
  const target = list.find(x => x.id === id);
  if (!target) return { success: false };
  setItem(KEYS.CUSTOM_BANKING_SERVICES, list.filter(x => x.id !== id));
  markGlobalReferenceDeleted(id, 'DELETED');
  logAuditAction('CUSTOM_BANKING_DELETE', `Deleted custom banking service: ${target.name}`);
  return { success: true };
}

export function getCustomBankPartners() {
  return getItem(KEYS.CUSTOM_BANK_PARTNERS, []);
}

export function getAllBankPartners() {
  return Array.from(new Set([...BANK_PARTNERS, ...getCustomBankPartners()]));
}

export function addCustomBankPartner(bankName) {
  const clean = String(bankName || '').trim();
  if (!clean) return { success: false, message: 'Bank partner name is required.' };
  const existing = getCustomBankPartners();
  if (!BANK_PARTNERS.some(b => b.toLowerCase() === clean.toLowerCase()) &&
      !existing.some(b => b.toLowerCase() === clean.toLowerCase())) {
    existing.push(clean);
    setItem(KEYS.CUSTOM_BANK_PARTNERS, existing);
    logAuditAction('CUSTOM_BANK_PARTNER', `Added custom bank partner: ${clean}`);
  }
  return { success: true, bank: clean };
}

export function getCustomBankingServiceByName(typeName) {
  if (!typeName) return null;
  const q = String(typeName).trim().toLowerCase();
  return getCustomBankingServices().find(s => s.name.toLowerCase() === q) || null;
}

/**
 * Standard & Custom Bank Mitra Commission Structure
 */
export function calculateCommission(type, amount) {
  const amt = Number(amount) || 0;
  const customRule = getCustomBankingServiceByName(type);
  if (customRule) {
    if (customRule.commissionType === 'percent') {
      let val = Math.round(amt * (customRule.commissionValue / 100));
      if (customRule.minCommission > 0) val = Math.max(customRule.minCommission, val);
      if (customRule.maxCommission > 0) val = Math.min(customRule.maxCommission, val);
      return val;
    }
    return Number(customRule.commissionValue) || 0;
  }

  switch (type) {
    case 'AePS Cash Withdrawal':
      if (amt < 500) return 3;
      if (amt <= 1000) return 5;
      if (amt <= 2000) return 10;
      if (amt <= 3000) return 15;
      if (amt <= 5000) return 20;
      return 25; // max ₹25 on ₹5000+
    case 'AePS Cash Deposit':
      return Math.min(25, Math.max(5, Math.round(amt * 0.004))); // 0.4%
    case 'Money Transfer (DMT / IMPS)':
      return Math.max(10, Math.round(amt * 0.005)); // 0.5%
    case 'Jan Dhan (PMJDY) Account Opening':
      return 35; // Flat per kit
    case 'Regular Savings Account Opening':
      return 50; // Flat per kit
    case 'KCC / Loan Installment':
      return 15;
    case 'Social Security Schemes (PMSBY / PMJJBY)':
      return 5;
    default:
      return 0;
  }
}

export function getAllBankingTransactions() {
  return getItem(KEYS.BANKING, []);
}

export async function saveBankingTransaction(txnData) {
  const list = getAllBankingTransactions();
  const amount = Number(txnData.amount) || 0;
  const commission = txnData.commission !== undefined ? Number(txnData.commission) : calculateCommission(txnData.type, amount);

  if (txnData.id) {
    const idx = list.findIndex(t => t.id === txnData.id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...txnData,
        amount,
        commission,
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.BANKING, list);
      logAuditAction('BANKING_UPDATE', `Updated PNB CSP transaction ${txnData.id} for ${txnData.customerName}`);
      return { success: true, txn: list[idx] };
    }
  }

  const bankTxnId = await allocateGlobalReference('BANK', { entityType: 'BANKING_TXN' });
  const newTxn = {
    id: bankTxnId,
    date: txnData.date || getTodayDate(),
    time: txnData.time || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    type: txnData.type || 'AePS Cash Withdrawal',
    bank: txnData.bank || 'Punjab National Bank (PNB CSP)',
    customerId: txnData.customerId || '',
    customerName: txnData.customerName || 'Walk-in Customer',
    customerPhone: txnData.customerPhone || '',
    accountNumber: txnData.accountNumber || '',
    aadhaarLast4: txnData.aadhaarLast4 ? String(txnData.aadhaarLast4).slice(-4) : '',
    amount,
    commission,
    feeCharged: Number(txnData.feeCharged) || 0,
    rrn: String(txnData.rrn || '').trim() || bankTxnId,
    status: txnData.status || 'Success',
    operatorId: txnData.operatorId || 'USR-01',
    operatorName: txnData.operatorName || 'MUN (Operator)',
    remarks: txnData.remarks || 'PNB CSP Counter Transaction',
    businessUnitId: 'mun-computer',
    createdAt: new Date().toISOString()
  };

  list.unshift(newTxn);
  setItem(KEYS.BANKING, list);
  logAuditAction('BANKING_TRANSACTION', `Recorded ${newTxn.type} of ₹${newTxn.amount} for ${newTxn.customerName} (RRN: ${newTxn.rrn})`);
  return { success: true, txn: newTxn };
}

export function deleteBankingTransaction(id) {
  const list = getAllBankingTransactions();
  const filtered = list.filter(t => t.id !== id);
  if (filtered.length !== list.length) {
    setItem(KEYS.BANKING, filtered);
    markGlobalReferenceDeleted(id, 'DELETED');
    logAuditAction('BANKING_DELETE', `Deleted PNB CSP transaction ${id}`);
    return { success: true };
  }
  return { success: false, message: 'Transaction not found' };
}

export function getBankingSummary() {
  const list = getAllBankingTransactions();
  let totalVolume = 0;
  let totalWithdrawals = 0;
  let totalDeposits = 0;
  let totalTransfers = 0;
  let totalCommission = 0;
  let successCount = 0;

  list.forEach(t => {
    if (t.status === 'Success') {
      successCount++;
      const amt = Number(t.amount) || 0;
      totalVolume += amt;
      totalCommission += Number(t.commission) || 0;

      const customRule = getCustomBankingServiceByName(t.type);
      if (customRule?.cashFlowDirection === 'out') {
        totalWithdrawals += amt;
      } else if (customRule?.cashFlowDirection === 'in') {
        totalDeposits += amt;
      } else if (t.type.includes('Withdrawal')) {
        totalWithdrawals += amt;
      } else if (t.type.includes('Deposit')) {
        totalDeposits += amt;
      } else if (t.type.includes('Transfer')) {
        totalTransfers += amt;
      }
    }
  });

  return {
    totalTransactions: list.length,
    successCount,
    totalVolume,
    totalWithdrawals,
    totalDeposits,
    totalTransfers,
    totalCommission,
    netCashOutflow: totalWithdrawals - totalDeposits
  };
}
