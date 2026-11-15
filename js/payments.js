/**
 * payments.js - Payment Collections, Verification, Refunds, Dues Tracking & Auditable Ledger
 * Official Shop: MUN COMPUTER
 */

import { getItem, setItem, KEYS, allocateGlobalReference, markGlobalReferenceDeleted, getTodayDate, logAuditAction } from './storage.js';

export const PAYMENT_METHODS = [
  'Cash',
  'UPI',
  'Bank Transfer',
  'Card Payment',
  'QR Payment',
  'Other'
];

export const PAYMENT_STATUSES = [
  'Paid',
  'Partially Paid',
  'Unpaid',
  'Refunded'
];

export function getAllPayments() {
  return getItem(KEYS.PAYMENTS, []);
}

export function getAllRefunds() {
  return getItem(KEYS.REFUNDS, []);
}

function normalizeTxnId(val) {
  return String(val || '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Apply verified payment amount onto linked service receipt(s) and/or invoice
 */
function applyPaymentAmountToTargets(paymentData, paymentAmount) {
  const services = getItem(KEYS.SERVICES, []);
  const invoices = getItem(KEYS.INVOICES, []);
  let serviceRef = null;
  let invoiceRef = null;
  let remainingAfter = paymentData.remainingDue !== undefined ? Number(paymentData.remainingDue) : undefined;

  if (!paymentData.skipServiceSync && (paymentData.serviceId || paymentData.receiptId)) {
    let sIndex = paymentData.serviceId ? services.findIndex(s => s.id === paymentData.serviceId) : -1;
    if (sIndex === -1 && paymentData.receiptId) {
      sIndex = services.findIndex(s => (s.receiptId || s.id) === paymentData.receiptId && ((Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0)) > 0);
      if (sIndex === -1) {
        sIndex = services.findIndex(s => (s.receiptId || s.id) === paymentData.receiptId);
      }
    }
    if (sIndex !== -1) {
      serviceRef = services[sIndex];
      const itemTotal = Number(serviceRef.totalAmount) || 0;
      const prevPaid = Number(serviceRef.paidAmount) || 0;
      const itemDue = Math.max(0, itemTotal - prevPaid);
      const receiptGroupId = serviceRef.receiptId || paymentData.receiptId || '';
      const applyHere = receiptGroupId && paymentAmount > itemDue ? itemDue : paymentAmount;
      const newPaid = prevPaid + applyHere;
      const newDue = Math.max(0, itemTotal - newPaid);

      services[sIndex].paidAmount = newPaid;
      services[sIndex].dueAmount = newDue;
      services[sIndex].updatedAt = new Date().toISOString();

      let excess = Math.max(0, paymentAmount - applyHere);
      if (excess > 0 && receiptGroupId) {
        services.forEach((sib, sibIdx) => {
          if (excess <= 0 || sibIdx === sIndex || (sib.receiptId || sib.id) !== receiptGroupId) return;
          const sibDue = Math.max(0, (Number(sib.totalAmount) || 0) - (Number(sib.paidAmount) || 0));
          if (sibDue > 0) {
            const sibApplied = Math.min(sibDue, excess);
            sib.paidAmount = (Number(sib.paidAmount) || 0) + sibApplied;
            sib.dueAmount = Math.max(0, (Number(sib.totalAmount) || 0) - sib.paidAmount);
            sib.updatedAt = new Date().toISOString();
            excess = Math.max(0, excess - sibApplied);
          }
        });
      }

      if (remainingAfter === undefined) {
        const groupId = serviceRef.receiptId || serviceRef.id;
        remainingAfter = services
          .filter(s => (s.receiptId || s.id) === groupId)
          .reduce((sum, s) => sum + Math.max(0, (Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0)), 0);
      }
      setItem(KEYS.SERVICES, services);
    }
  }

  if (!paymentData.skipInvoiceSync && paymentData.invoiceId) {
    const invIndex = invoices.findIndex(inv => inv.id === paymentData.invoiceId);
    if (invIndex !== -1) {
      invoiceRef = invoices[invIndex];
      const invTotal = Number(invoiceRef.totalAmount) || 0;
      const prevPaid = Number(invoiceRef.paidAmount) || 0;
      const newPaid = prevPaid + paymentAmount;
      const newBalanceDue = Math.max(0, invTotal - newPaid);
      invoices[invIndex] = {
        ...invoiceRef,
        paidAmount: newPaid,
        balanceDue: newBalanceDue,
        status: newBalanceDue <= 0 ? 'Paid' : (newPaid > 0 ? 'Partially Paid' : 'Unpaid'),
        updatedAt: new Date().toISOString()
      };
      invoiceRef = invoices[invIndex];
      if (remainingAfter === undefined) {
        remainingAfter = newBalanceDue;
      }
      setItem(KEYS.INVOICES, invoices);
    }
  }

  return { serviceRef, invoiceRef, remainingAfter };
}

export async function recordPayment(paymentData) {
  const payments = getAllPayments();
  const paymentAmount = Number(paymentData.paymentAmount) || 0;
  if (paymentAmount <= 0) {
    return { success: false, message: 'Payment amount must be greater than zero.' };
  }

  const rawRef = String(paymentData.transactionId || paymentData.reference || '').trim();
  const normRef = normalizeTxnId(rawRef);

  // Prevent duplicate Transaction ID / UTR entries on active (non-refunded) payments
  if (normRef && !normRef.startsWith('TXN-')) {
    const dupUtr = payments.find(p => p.paymentStatus !== 'Refunded' && normalizeTxnId(p.transactionId) === normRef);
    if (dupUtr) {
      return {
        success: false,
        message: `Duplicate Transaction ID / UTR detected: "${rawRef}" is already recorded on Payment ${dupUtr.id} (${dupUtr.customerName}).`
      };
    }
  }

  // Prevent accidental double-click duplicate payment within 12 seconds
  const nowMs = Date.now();
  const rapidDup = payments.find(p => {
    if (p.paymentStatus === 'Refunded') return false;
    const createdMs = p.createdAt ? new Date(p.createdAt).getTime() : 0;
    if (!createdMs || nowMs - createdMs > 12000) return false;
    return (
      String(p.customerId || '') === String(paymentData.customerId || '') &&
      String(p.customerName || '').trim() === String(paymentData.customerName || '').trim() &&
      Number(p.paymentAmount) === paymentAmount &&
      String(p.paymentMethod || '') === String(paymentData.paymentMethod || 'Cash') &&
      String(p.receiptId || '') === String(paymentData.receiptId || '') &&
      String(p.invoiceId || '') === String(paymentData.invoiceId || '')
    );
  });
  if (rapidDup && !paymentData.allowDuplicate) {
    return {
      success: false,
      message: `Duplicate payment entry blocked: identical payment (${rapidDup.id}) was just recorded seconds ago.`
    };
  }

  const isDigitalUpi = /upi|qr|bank|card/i.test(String(paymentData.paymentMethod || ''));
  // Never automatically mark UPI/QR payment Paid just because QR was shown/scanned; require explicit verification
  const isVerified = paymentData.verified === false
    ? false
    : (paymentData.verified === true || !isDigitalUpi || Boolean(paymentData.operatorConfirmed));

  const verificationStatus = isVerified ? 'VERIFIED' : 'PENDING_VERIFICATION';

  let serviceRef = null;
  let invoiceRef = null;
  let remainingAfter = paymentData.remainingDue !== undefined ? Number(paymentData.remainingDue) : undefined;

  if (isVerified) {
    const applied = applyPaymentAmountToTargets(paymentData, paymentAmount);
    serviceRef = applied.serviceRef;
    invoiceRef = applied.invoiceRef;
    remainingAfter = applied.remainingAfter;
  } else {
    // Pending verification: look up target details without reducing due balances yet
    const services = getItem(KEYS.SERVICES, []);
    const invoices = getItem(KEYS.INVOICES, []);
    if (paymentData.serviceId || paymentData.receiptId) {
      serviceRef = services.find(s => s.id === paymentData.serviceId || (s.receiptId || s.id) === paymentData.receiptId) || null;
    }
    if (paymentData.invoiceId) {
      invoiceRef = invoices.find(i => i.id === paymentData.invoiceId) || null;
    }
    if (remainingAfter === undefined) {
      if (invoiceRef) remainingAfter = Math.max(0, (Number(invoiceRef.totalAmount) || 0) - (Number(invoiceRef.paidAmount) || 0));
      else if (serviceRef) remainingAfter = Math.max(0, (Number(serviceRef.totalAmount) || 0) - (Number(serviceRef.paidAmount) || 0));
      else remainingAfter = paymentAmount;
    }
  }

  const finalRemaining = remainingAfter !== undefined ? Math.max(0, Number(remainingAfter) || 0) : 0;
  let paymentStatus = 'Unpaid';
  if (isVerified) {
    paymentStatus = finalRemaining > 0 ? 'Partially Paid' : 'Paid';
  }

  const paymentId = paymentData.id || await allocateGlobalReference('PAY', { entityType: 'PAYMENT' });
  const resolvedTxnId = rawRef || await allocateGlobalReference('TXN', { entityType: isVerified ? 'PAYMENT_TXN' : 'PAYMENT_PENDING_TXN' });

  const newPayment = {
    id: paymentId,
    customerId: paymentData.customerId || (serviceRef ? serviceRef.customerId : (invoiceRef ? invoiceRef.customerId : '')),
    customerName: paymentData.customerName || (serviceRef ? serviceRef.customerName : (invoiceRef ? invoiceRef.customerName : 'Walk-in Customer')),
    customerPhone: paymentData.customerPhone || (serviceRef ? serviceRef.phone : (invoiceRef ? invoiceRef.phone : '')),
    serviceId: paymentData.serviceId || (serviceRef ? serviceRef.id : ''),
    invoiceId: paymentData.invoiceId || '',
    receiptId: paymentData.receiptId || (serviceRef ? (serviceRef.receiptId || serviceRef.id) : (invoiceRef ? invoiceRef.id : '')),
    invoiceNumber: paymentData.invoiceNumber || paymentData.invoiceId || paymentData.receiptId || (serviceRef ? (serviceRef.receiptId || serviceRef.id) : ''),
    collectionType: paymentData.collectionType || (paymentData.serviceId || paymentData.receiptId || paymentData.invoiceId ? 'Due Collection' : 'Instant Cash Collection'),
    totalCharge: Number(paymentData.totalCharge) || (serviceRef ? serviceRef.totalAmount : (invoiceRef ? invoiceRef.totalAmount : paymentAmount)),
    advanceAmount: Number(paymentData.advanceAmount) || 0,
    paymentAmount,
    receivedAmount: isVerified ? paymentAmount : 0,
    remainingDue: finalRemaining,
    paymentDate: paymentData.paymentDate || getTodayDate(),
    paymentDateTime: new Date().toISOString(),
    paymentMethod: paymentData.paymentMethod || 'Cash',
    transactionId: resolvedTxnId,
    reference: paymentData.reference || rawRef || '',
    remarks: paymentData.remarks || '',
    receivedBy: paymentData.receivedBy || 'Staff',
    verificationStatus,
    verifiedBy: isVerified ? (paymentData.verifiedBy || paymentData.receivedBy || 'Admin/Staff') : '',
    verifiedAt: isVerified ? new Date().toISOString() : '',
    paymentStatus,
    skipServiceSync: Boolean(paymentData.skipServiceSync),
    skipInvoiceSync: Boolean(paymentData.skipInvoiceSync),
    businessUnitId: paymentData.businessUnitId || (serviceRef ? serviceRef.businessUnitId : 'mun-computer'),
    createdAt: new Date().toISOString()
  };

  payments.unshift(newPayment);
  setItem(KEYS.PAYMENTS, payments);
  logAuditAction(
    isVerified ? 'PAYMENT_COLLECTED' : 'PAYMENT_PENDING_VERIFICATION',
    `${isVerified ? 'Verified & collected' : 'Logged pending verification'} ₹${newPayment.paymentAmount} via ${newPayment.paymentMethod} from ${newPayment.customerName} (${newPayment.id}) · Ref: ${newPayment.transactionId}`
  );
  return { success: true, payment: newPayment };
}

/**
 * Confirm & verify a pending UPI / QR / Bank payment (never auto-marked Paid on QR scan)
 */
export function verifyPendingPayment(paymentId, { utrNumber = '', verifiedBy = 'Admin' } = {}) {
  const payments = getAllPayments();
  const idx = payments.findIndex(p => p.id === paymentId);
  if (idx === -1) return { success: false, message: 'Payment record not found.' };

  const target = payments[idx];
  if (target.paymentStatus === 'Refunded') {
    return { success: false, message: 'Cannot verify a refunded payment.' };
  }
  if (target.verificationStatus === 'VERIFIED' && target.paymentStatus !== 'Unpaid') {
    return { success: false, message: 'Payment is already verified.' };
  }

  const cleanUtr = String(utrNumber || target.transactionId || '').trim();
  if (!cleanUtr || cleanUtr.startsWith('PEND-')) {
    return { success: false, message: 'Valid UTR / Transaction ID is required to verify this payment.' };
  }

  const normUtr = normalizeTxnId(cleanUtr);
  const dup = payments.find(p => p.id !== paymentId && p.paymentStatus !== 'Refunded' && normalizeTxnId(p.transactionId) === normUtr);
  if (dup) {
    return { success: false, message: `Duplicate UTR / Transaction ID: "${cleanUtr}" already belongs to ${dup.id}.` };
  }

  const applied = applyPaymentAmountToTargets({
    serviceId: target.serviceId,
    receiptId: target.receiptId,
    invoiceId: target.invoiceId,
    skipServiceSync: target.skipServiceSync,
    skipInvoiceSync: target.skipInvoiceSync
  }, Number(target.paymentAmount) || 0);

  const remainingDue = applied.remainingAfter !== undefined
    ? Math.max(0, Number(applied.remainingAfter) || 0)
    : 0;

  const nextStatus = remainingDue > 0 ? 'Partially Paid' : 'Paid';
  payments[idx] = {
    ...target,
    transactionId: cleanUtr,
    reference: cleanUtr,
    receivedAmount: Number(target.paymentAmount) || 0,
    remainingDue,
    paymentStatus: nextStatus,
    verificationStatus: 'VERIFIED',
    verifiedBy,
    verifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  setItem(KEYS.PAYMENTS, payments);
  logAuditAction('PAYMENT_VERIFIED', `Verified payment ${paymentId} (UTR: ${cleanUtr}, ₹${target.paymentAmount}) by ${verifiedBy}`);
  return { success: true, payment: payments[idx] };
}

/**
 * Record refund for a payment, mark status Refunded, restore linked due if applicable, and issue Refund Receipt ID
 */
export async function refundPayment(paymentId, { refundAmount, refundMode = 'Cash', refundRef = '', reason = '', refundedBy = 'Admin' } = {}) {
  const payments = getAllPayments();
  const idx = payments.findIndex(p => p.id === paymentId);
  if (idx === -1) return { success: false, message: 'Payment record not found.' };

  const target = payments[idx];
  if (target.paymentStatus === 'Refunded') {
    return { success: false, message: 'This payment has already been refunded.' };
  }

  const amt = Math.min(Number(target.paymentAmount) || 0, Number(refundAmount) || Number(target.paymentAmount) || 0);
  if (amt <= 0) {
    return { success: false, message: 'Refund amount must be greater than zero.' };
  }

  const wasApplied = target.verificationStatus !== 'PENDING_VERIFICATION' && target.paymentStatus !== 'Unpaid';

  // Restore due balance on linked service/invoice if payment had been applied
  if (wasApplied && target.serviceId) {
    const services = getItem(KEYS.SERVICES, []);
    const sIdx = services.findIndex(s => s.id === target.serviceId);
    if (sIdx !== -1) {
      const srv = services[sIdx];
      const newPaid = Math.max(0, (Number(srv.paidAmount) || 0) - amt);
      services[sIdx] = {
        ...srv,
        paidAmount: newPaid,
        dueAmount: Math.max(0, (Number(srv.totalAmount) || 0) - newPaid),
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.SERVICES, services);
    }
  }

  if (wasApplied && target.invoiceId) {
    const invoices = getItem(KEYS.INVOICES, []);
    const iIdx = invoices.findIndex(inv => inv.id === target.invoiceId);
    if (iIdx !== -1) {
      const inv = invoices[iIdx];
      const newPaid = Math.max(0, (Number(inv.paidAmount) || 0) - amt);
      const newDue = Math.max(0, (Number(inv.totalAmount) || 0) - newPaid);
      invoices[iIdx] = {
        ...inv,
        paidAmount: newPaid,
        balanceDue: newDue,
        status: amt >= (Number(inv.paidAmount) || 0) && newPaid === 0 ? 'Refunded' : (newDue <= 0 ? 'Paid' : 'Partially Paid'),
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.INVOICES, invoices);
    }
  }

  const refundId = await allocateGlobalReference('RFD', { entityType: 'REFUND' });
  const refundRecord = {
    id: refundId,
    paymentId: target.id,
    customerId: target.customerId || '',
    customerName: target.customerName || 'Customer',
    customerPhone: target.customerPhone || '',
    serviceId: target.serviceId || '',
    invoiceId: target.invoiceId || '',
    receiptId: target.receiptId || '',
    originalAmount: Number(target.paymentAmount) || 0,
    refundAmount: amt,
    refundMode,
    refundRef: String(refundRef || '').trim() || refundId,
    reason: String(reason || 'Service cancellation / customer refund request').trim(),
    refundedBy,
    refundDate: getTodayDate(),
    createdAt: new Date().toISOString()
  };

  const refunds = getAllRefunds();
  refunds.unshift(refundRecord);
  setItem(KEYS.REFUNDS, refunds);

  payments[idx] = {
    ...target,
    paymentStatus: 'Refunded',
    refundId: refundRecord.id,
    refundAmount: amt,
    refundDate: refundRecord.refundDate,
    refundReason: refundRecord.reason,
    refundedBy,
    updatedAt: new Date().toISOString()
  };
  setItem(KEYS.PAYMENTS, payments);

  logAuditAction('PAYMENT_REFUNDED', `Issued Refund ${refundRecord.id} for ₹${amt} on Payment ${target.id} (${target.customerName}) · Reason: ${refundRecord.reason}`);
  return { success: true, payment: payments[idx], refund: refundRecord };
}

export function getCustomerOutstandingReceivables(customerId) {
  const services = getItem(KEYS.SERVICES, []);
  const invoices = getItem(KEYS.INVOICES, []);
  const cleanId = String(customerId || '').trim();
  const items = [];

  const receiptGroups = new Map();
  services.forEach(srv => {
    if (cleanId && srv.customerId !== cleanId) return;
    if (srv.status === 'Cancelled' || srv.status === 'Rejected') return;
    const due = Math.max(0, (Number(srv.totalAmount) || 0) - (Number(srv.paidAmount) || 0));
    if (due <= 0) return;
    const rId = srv.receiptId || srv.id;
    if (!receiptGroups.has(rId)) {
      receiptGroups.set(rId, {
        refType: 'service',
        refId: rId,
        serviceId: srv.id,
        receiptId: rId,
        customerId: srv.customerId || '',
        customerName: srv.customerName || 'Customer',
        phone: srv.phone || '',
        label: srv.serviceName || 'Service Receipt',
        itemCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        dueAmount: 0,
        date: srv.appDate || getTodayDate(),
        status: srv.status || 'Pending'
      });
    }
    const g = receiptGroups.get(rId);
    g.itemCount += 1;
    g.totalAmount += Number(srv.totalAmount) || 0;
    g.paidAmount += Number(srv.paidAmount) || 0;
    g.dueAmount += due;
    if (g.itemCount > 1 && !g.label.includes('items)')) {
      g.label = `${g.label} (+${g.itemCount - 1} more)`;
    } else if (g.itemCount > 2) {
      g.label = `${g.label.split(' (+')[0]} (+${g.itemCount - 1} more)`;
    }
  });
  receiptGroups.forEach(g => items.push(g));

  invoices.forEach(inv => {
    if (cleanId && inv.customerId !== cleanId) return;
    if (inv.status === 'Cancelled' || inv.status === 'Refunded') return;
    const balanceDue = Math.max(0, (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0));
    if (balanceDue <= 0) return;
    items.push({
      refType: 'invoice',
      refId: inv.id,
      invoiceId: inv.id,
      receiptId: inv.id,
      customerId: inv.customerId || '',
      customerName: inv.customerName || 'Customer',
      phone: inv.phone || '',
      label: `Invoice ${inv.id} (${(inv.items || []).map(i => i.desc || i.description).filter(Boolean).slice(0, 2).join(', ') || 'Sales / Billing'})`,
      itemCount: (inv.items || []).length || 1,
      totalAmount: Number(inv.totalAmount) || 0,
      paidAmount: Number(inv.paidAmount) || 0,
      dueAmount: balanceDue,
      date: inv.date || getTodayDate(),
      status: inv.status || 'Unpaid'
    });
  });

  return items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export function getCustomerDuesReport() {
  const services = getItem(KEYS.SERVICES, []);
  const invoices = getItem(KEYS.INVOICES, []);
  const dueMap = {};

  services.forEach(srv => {
    if (srv.status === 'Cancelled' || srv.status === 'Rejected') return;
    const due = Math.max(0, (Number(srv.totalAmount) || 0) - (Number(srv.paidAmount) || 0));
    if (due > 0) {
      const cid = srv.customerId || `WALKIN-${srv.customerName || srv.id}`;
      if (!dueMap[cid]) {
        dueMap[cid] = {
          customerId: srv.customerId || cid,
          customerName: srv.customerName || 'Walk-in Customer',
          phone: srv.phone || '',
          businessUnitId: srv.businessUnitId || 'mun-computer',
          totalDue: 0,
          pendingServices: []
        };
      }
      dueMap[cid].totalDue += due;
      dueMap[cid].pendingServices.push({
        refType: 'service',
        serviceId: srv.id,
        receiptId: srv.receiptId || srv.id,
        serviceName: srv.serviceName,
        due,
        deliveryDate: srv.deliveryDate,
        status: srv.status
      });
    }
  });

  invoices.forEach(inv => {
    if (inv.status === 'Cancelled' || inv.status === 'Refunded') return;
    const due = Math.max(0, (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0));
    if (due > 0) {
      const cid = inv.customerId || `WALKIN-${inv.customerName || inv.id}`;
      if (!dueMap[cid]) {
        dueMap[cid] = {
          customerId: inv.customerId || cid,
          customerName: inv.customerName || 'Customer',
          phone: inv.phone || '',
          businessUnitId: inv.businessUnitId || 'mun-computer',
          totalDue: 0,
          pendingServices: []
        };
      }
      dueMap[cid].totalDue += due;
      dueMap[cid].pendingServices.push({
        refType: 'invoice',
        invoiceId: inv.id,
        receiptId: inv.id,
        serviceName: `Invoice ${inv.id}`,
        due,
        deliveryDate: inv.date,
        status: inv.status
      });
    }
  });

  return Object.values(dueMap).sort((a, b) => b.totalDue - a.totalDue);
}

export function deletePayment(id) {
  const payments = getAllPayments();
  const target = payments.find(p => p.id === id);
  if (!target) return { success: false, message: 'Payment record not found' };

  const updated = payments.filter(p => p.id !== id);
  setItem(KEYS.PAYMENTS, updated);

  const wasApplied = target.verificationStatus !== 'PENDING_VERIFICATION' && target.paymentStatus !== 'Unpaid' && target.paymentStatus !== 'Refunded';

  if (wasApplied && target.serviceId) {
    const services = getItem(KEYS.SERVICES, []);
    const sIndex = services.findIndex(s => s.id === target.serviceId);
    if (sIndex !== -1) {
      const srv = services[sIndex];
      const delta = Number(target.paymentAmount) || 0;
      const newPaid = Math.max(0, (Number(srv.paidAmount) || 0) - delta);
      const newDue = Math.max(0, (Number(srv.totalAmount) || 0) - newPaid);
      services[sIndex] = {
        ...srv,
        paidAmount: newPaid,
        dueAmount: newDue,
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.SERVICES, services);
    }
  }

  if (wasApplied && target.invoiceId) {
    const invoices = getItem(KEYS.INVOICES, []);
    const invIndex = invoices.findIndex(inv => inv.id === target.invoiceId);
    if (invIndex !== -1) {
      const inv = invoices[invIndex];
      const delta = Number(target.paymentAmount) || 0;
      const newPaid = Math.max(0, (Number(inv.paidAmount) || 0) - delta);
      const newBalanceDue = Math.max(0, (Number(inv.totalAmount) || 0) - newPaid);
      invoices[invIndex] = {
        ...inv,
        paidAmount: newPaid,
        balanceDue: newBalanceDue,
        status: newBalanceDue <= 0 ? 'Paid' : (newPaid > 0 ? 'Partially Paid' : 'Unpaid'),
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.INVOICES, invoices);
    }
  }

  markGlobalReferenceDeleted(id, 'DELETED');
  logAuditAction('PAYMENT_DELETE', `Deleted payment record: ${id} for amount ${target.paymentAmount}`);
  return { success: true };
}
