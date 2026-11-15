/**
 * investments.js - Investment & Capital Management
 * MUN COMPUTER Business Manager
 */

import { getItem, setItem, KEYS, allocateGlobalReference, markGlobalReferenceDeleted, getTodayDate, logAuditAction } from './storage.js';

export const FUNDING_TYPES = [
  'Owner Capital',
  'Business Savings',
  'Bank Loan',
  'Government Subsidy',
  'Partner Investment',
  'Other'
];

export function getAllInvestments() {
  return getItem(KEYS.INVESTMENTS, []);
}

export async function saveInvestment(data) {
  const investments = getAllInvestments();
  const amount = Number(data.amount) || 0;
  if (amount <= 0) {
    return { success: false, message: 'Investment amount must be greater than zero.' };
  }

  if (data.id) {
    const index = investments.findIndex(i => i.id === data.id);
    if (index !== -1) {
      investments[index] = {
        ...investments[index],
        ...data,
        amount,
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.INVESTMENTS, investments);
      logAuditAction('INVESTMENT_UPDATE', `Updated investment record: ${investments[index].id} (${amount})`);
      return { success: true, investment: investments[index] };
    }
  }

  const invId = await allocateGlobalReference('CAP', { entityType: 'INVESTMENT' });
  const newInv = {
    id: invId,
    projectName: data.projectName || 'General Capital',
    investmentDate: data.investmentDate || getTodayDate(),
    category: data.category || 'Machinery & Equipment',
    source: data.source || 'Owner Capital',
    amount,
    fundingType: data.fundingType || 'Owner Capital',
    paymentMethod: data.paymentMethod || 'Bank Transfer',
    status: data.status || 'Approved',
    remarks: data.remarks || '',
    documents: data.documents || '',
    createdAt: new Date().toISOString()
  };

  investments.unshift(newInv);
  setItem(KEYS.INVESTMENTS, investments);
  logAuditAction('INVESTMENT_CREATE', `Recorded capital investment of ${newInv.amount} into ${newInv.projectName} (${newInv.id})`);
  return { success: true, investment: newInv };
}

export function deleteInvestment(id) {
  const investments = getAllInvestments();
  const updated = investments.filter(i => i.id !== id);
  setItem(KEYS.INVESTMENTS, updated);
  markGlobalReferenceDeleted(id, 'DELETED');
  logAuditAction('INVESTMENT_DELETE', `Deleted investment record ${id}`);
  return { success: true };
}
