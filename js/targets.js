/**
 * targets.js - Business Target Tracking & Real-Data Performance Calculation
 * MUN COMPUTER Business Manager
 */

import { getItem, setItem, KEYS, allocateGlobalReference, markGlobalReferenceDeleted, getTodayDate, logAuditAction } from './storage.js';

export const TARGET_CATEGORIES = [
  'Monthly Revenue Target',
  'Daily Revenue Target',
  'Weekly Revenue Target',
  'Quarterly Revenue Target',
  'Yearly Revenue Target',
  'New Customer Target',
  'New Service Target',
  'New Business Target',
  'Profit Target',
  'Marketing Target'
];

export function getAllTargets() {
  const targets = getItem(KEYS.TARGETS, []);
  const payments = getItem(KEYS.PAYMENTS, []);
  const customers = getItem(KEYS.CUSTOMERS, []);
  const services = getItem(KEYS.SERVICES, []);

  // Compute dynamic real-time progress from stored records
  return targets.map(target => {
    let actualValue = 0;
    const start = target.startDate || '2000-01-01';
    const end = target.endDate || '2099-12-31';
    const unitMatch = () => true;

    if (target.category.includes('Revenue')) {
      const filteredPayments = payments.filter(p => p.paymentDate >= start && p.paymentDate <= end && unitMatch(p));
      actualValue = filteredPayments.reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0);
    } else if (target.category.includes('Customer')) {
      const filteredCusts = customers.filter(c => c.regDate >= start && c.regDate <= end && unitMatch(c));
      actualValue = filteredCusts.length;
    } else if (target.category.includes('Service') || target.category.includes('Business')) {
      const filteredServices = services.filter(s => s.appDate >= start && s.appDate <= end && unitMatch(s));
      actualValue = target.targetQuantity ? filteredServices.length : filteredServices.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    } else if (target.category.includes('Profit')) {
      const filteredPayments = payments.filter(p => p.paymentDate >= start && p.paymentDate <= end && unitMatch(p));
      const filteredExpenses = getItem(KEYS.EXPENSES, []).filter(e => e.date >= start && e.date <= end && unitMatch(e));
      const rev = filteredPayments.reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0);
      const exp = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      actualValue = Math.max(0, rev - exp);
    }

    const goal = target.targetAmount || target.targetQuantity || 1;
    const percentage = Math.min(100, Math.round((actualValue / goal) * 100));

    let autoStatus = target.status;
    if (percentage >= 100) autoStatus = 'Achieved';
    else if (getTodayDate() > end && percentage < 100) autoStatus = 'Missed';
    else autoStatus = 'In Progress';

    return {
      ...target,
      actualValue,
      percentage,
      status: autoStatus
    };
  });
}

export async function saveTarget(data) {
  const targets = getItem(KEYS.TARGETS, []);
  
  if (data.id) {
    const index = targets.findIndex(t => t.id === data.id);
    if (index !== -1) {
      targets[index] = {
        ...targets[index],
        ...data,
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.TARGETS, targets);
      logAuditAction('TARGET_UPDATE', `Updated business target: ${targets[index].name}`);
      return { success: true, target: targets[index] };
    }
  }

  const targetId = await allocateGlobalReference('TGT', { entityType: 'TARGET' });
  const newTarget = {
    id: targetId,
    name: data.name || 'Revenue Target',
    businessUnitId: data.businessUnitId || 'all',
    category: data.category || 'Monthly Revenue Target',
    targetPeriod: data.targetPeriod || 'Current Month',
    startDate: data.startDate || getTodayDate(),
    endDate: data.endDate || getTodayDate(),
    targetAmount: Number(data.targetAmount) || 0,
    targetQuantity: Number(data.targetQuantity) || 0,
    responsiblePerson: data.responsiblePerson || 'Admin',
    priority: data.priority || 'Medium',
    description: data.description || '',
    status: 'In Progress',
    createdAt: new Date().toISOString()
  };

  targets.unshift(newTarget);
  setItem(KEYS.TARGETS, targets);
  logAuditAction('TARGET_CREATE', `Created target: ${newTarget.name} (${newTarget.id})`);
  return { success: true, target: newTarget };
}

export function deleteTarget(id) {
  const targets = getItem(KEYS.TARGETS, []);
  const updated = targets.filter(t => t.id !== id);
  setItem(KEYS.TARGETS, updated);
  markGlobalReferenceDeleted(id, 'DELETED');
  logAuditAction('TARGET_DELETE', `Deleted target ${id}`);
  return { success: true };
}
