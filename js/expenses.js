/**
 * expenses.js - Expense Tracking & Category Analysis
 * Official Shop: MUN COMPUTER
 */

import { getItem, setItem, KEYS, allocateGlobalReference, markGlobalReferenceDeleted, getTodayDate, logAuditAction } from './storage.js';

export const EXPENSE_CATEGORIES = [
  'Shop Rent',
  'Electricity',
  'Internet',
  'Staff Salary',
  'Printer Maintenance',
  'Computer Maintenance',
  'Stationery',
  'Transport',
  'Marketing',
  'Software',
  'Office Equipment',
  'Bank Charges',
  'Business Investment',
  'Other Expenses'
];

export function getAllExpenses() {
  return getItem(KEYS.EXPENSES, []);
}

export async function saveExpense(data) {
  const expenses = getAllExpenses();
  const amount = Number(data.amount) || 0;
  if (amount <= 0) {
    return { success: false, message: 'Expense amount must be greater than zero.' };
  }

  if (data.id) {
    const index = expenses.findIndex(e => e.id === data.id);
    if (index !== -1) {
      expenses[index] = {
        ...expenses[index],
        ...data,
        amount,
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.EXPENSES, expenses);
      logAuditAction('EXPENSE_UPDATE', `Updated MUN COMPUTER expense ${expenses[index].id}: ${expenses[index].title} (${amount})`);
      return { success: true, expense: expenses[index] };
    }
  }

  const expenseId = await allocateGlobalReference('EXP', { entityType: 'EXPENSE' });
  const voucherNo = data.voucherNumber || await allocateGlobalReference('VCH', { entityType: 'VOUCHER' });
  const newExpense = {
    id: expenseId,
    voucherNumber: voucherNo,
    shopName: 'MUN COMPUTER',
    category: data.category || 'Other Expenses',
    title: data.title || 'General Expense',
    date: data.date || getTodayDate(),
    amount,
    paymentMethod: data.paymentMethod || 'Cash',
    vendorName: data.vendorName || data.vendor || '',
    billNumber: data.billNumber || '',
    paidBy: data.paidBy || 'MUN',
    businessUnitId: data.businessUnitId || 'mun-computer',
    remarks: data.remarks || '',
    attachment: data.attachment || data.receipt || '',
    createdAt: new Date().toISOString()
  };

  expenses.unshift(newExpense);
  setItem(KEYS.EXPENSES, expenses);
  logAuditAction('EXPENSE_CREATE', `Recorded MUN COMPUTER expense ${newExpense.id} (Voucher ${newExpense.voucherNumber}): ${newExpense.title} (${newExpense.amount})`);
  return { success: true, expense: newExpense };
}

export function deleteExpense(id) {
  const expenses = getAllExpenses();
  const target = expenses.find(e => e.id === id);
  if (!target) return { success: false, message: 'Expense not found' };

  const updated = expenses.filter(e => e.id !== id);
  setItem(KEYS.EXPENSES, updated);
  markGlobalReferenceDeleted(id, 'DELETED');
  logAuditAction('EXPENSE_DELETE', `Deleted expense record ${id} for amount ${target.amount}`);
  return { success: true };
}

export function getExpenseCategorySummary(filteredExpenses = null) {
  const list = filteredExpenses || getAllExpenses();
  const map = {};
  EXPENSE_CATEGORIES.forEach(cat => { map[cat] = 0; });
  list.forEach(e => {
    const cat = e.category || 'Other Expenses';
    map[cat] = (map[cat] || 0) + (Number(e.amount) || 0);
  });
  return map;
}
