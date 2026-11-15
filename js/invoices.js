/**
 * invoices.js - Professional Invoice & Billing Engine
 * Official Shop: MUN COMPUTER
 */

import { getItem, setItem, KEYS, allocateGlobalReference, markGlobalReferenceDeleted, getTodayDate, logAuditAction } from './storage.js';

export const INVOICE_STATUSES = [
  'Paid',
  'Partially Paid',
  'Unpaid',
  'Refunded',
  'Overdue',
  'Cancelled'
];

export const INVOICE_DOCUMENT_TYPES = [
  'Service Invoice',
  'Sales Invoice',
  'Purchase Invoice',
  'Customer Bill',
  'Tax Invoice',
  'Cash Memo',
  'Due Invoice'
];

export function getAllInvoices() {
  return getItem(KEYS.INVOICES, []);
}

export function getInvoiceById(id) {
  const invoices = getAllInvoices();
  return invoices.find(i => i.id === id) || null;
}

function normalizeInvPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  if (digits.length >= 6) return digits;
  return '';
}

export function findOpenInvoiceForCustomerDate(customerId = '', phone = '', targetDate = '') {
  const cleanCustId = String(customerId || '').trim();
  const normPhone = normalizeInvPhone(phone);
  if (!cleanCustId && !normPhone) return null;

  const resolvedDate = String(targetDate || getTodayDate()).trim();
  const invoices = getAllInvoices();

  return invoices.find(inv => {
    const invDate = String(inv.date || '').trim() || getTodayDate();
    if (invDate !== resolvedDate) return false;
    if (inv.status === 'Cancelled') return false;

    const custMatch = (cleanCustId && inv.customerId && inv.customerId === cleanCustId) ||
      (normPhone && normalizeInvPhone(inv.phone) === normPhone);
    if (!custMatch) return false;

    const due = Number(inv.balanceDue) || 0;
    return inv.status !== 'Paid' || due > 0;
  }) || null;
}

export async function saveInvoice(data) {
  const invoices = getAllInvoices();
  const items = Array.isArray(data.items) ? data.items : [];
  
  const subtotal = items.reduce((sum, item) => sum + (Number(item.qty || 1) * Number(item.unitPrice || item.rate || 0)), 0);
  const discount = Number(data.discount) || 0;
  const taxable = Math.max(0, subtotal - discount);
  const taxPercent = Number(data.taxPercent ?? data.taxRate) || 0;
  const taxAmount = Math.round(((taxable * taxPercent) / 100) * 100) / 100;
  const totalAmount = Math.round((taxable + taxAmount) * 100) / 100;
  
  const paidAmount = Number(data.paidAmount) || 0;
  const balanceDue = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);

  let status = 'Unpaid';
  if (balanceDue === 0 && totalAmount > 0) status = 'Paid';
  else if (paidAmount > 0 && balanceDue > 0) status = 'Partially Paid';
  else if (data.status) status = data.status;

  if (data.id) {
    const index = invoices.findIndex(i => i.id === data.id);
    if (index !== -1) {
      invoices[index] = {
        ...invoices[index],
        ...data,
        shopName: 'MUN COMPUTER',
        items,
        subtotal,
        discount,
        taxPercent,
        taxAmount,
        totalAmount,
        paidAmount,
        balanceDue,
        status,
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.INVOICES, invoices);
      logAuditAction('INVOICE_UPDATE', `Updated MUN COMPUTER invoice ${invoices[index].id} for ${invoices[index].customerName}`);
      return { success: true, invoice: invoices[index] };
    }
  }

  const targetDate = data.date || getTodayDate();
  const openExisting = !data.disableAutoMerge
    ? findOpenInvoiceForCustomerDate(data.customerId || '', data.phone || '', targetDate)
    : null;

  if (openExisting) {
    const existingIdx = invoices.findIndex(i => i.id === openExisting.id);
    if (existingIdx !== -1) {
      const existing = invoices[existingIdx];
      const mergedItems = [...(Array.isArray(existing.items) ? existing.items : []), ...items];
      const mergedSubtotal = mergedItems.reduce((sum, it) => sum + (Number(it.qty || 1) * Number(it.unitPrice || it.rate || 0)), 0);
      const mergedDiscount = (Number(existing.discount) || 0) + discount;
      const mergedTaxable = Math.max(0, mergedSubtotal - mergedDiscount);
      const hasNewTaxPct = data.taxPercent !== undefined || data.taxRate !== undefined;
      const mergedTaxPct = hasNewTaxPct ? taxPercent : (Number(existing.taxPercent ?? existing.taxRate) || 0);
      const mergedTaxAmt = Math.round(((mergedTaxable * mergedTaxPct) / 100) * 100) / 100;
      const mergedTotal = Math.round((mergedTaxable + mergedTaxAmt) * 100) / 100;
      const mergedPaid = (Number(existing.paidAmount) || 0) + paidAmount;
      const mergedDue = Math.max(0, Math.round((mergedTotal - mergedPaid) * 100) / 100);

      let mergedStatus = 'Unpaid';
      if (mergedDue === 0 && mergedTotal > 0) mergedStatus = 'Paid';
      else if (mergedPaid > 0 && mergedDue > 0) mergedStatus = 'Partially Paid';

      const prevSplit = existing.paymentSplit || {
        cash: String(existing.paymentMode || '').toLowerCase() === 'cash' ? (Number(existing.paidAmount) || 0) : 0,
        digital: /upi|qr|bank|card/i.test(String(existing.paymentMode || '')) ? (Number(existing.paidAmount) || 0) : 0,
        digitalMode: /upi|qr|bank|card/i.test(String(existing.paymentMode || '')) ? existing.paymentMode : 'UPI'
      };
      const newSplit = data.paymentSplit || {
        cash: String(data.paymentMode || '').toLowerCase() === 'cash' ? paidAmount : 0,
        digital: /upi|qr|bank|card/i.test(String(data.paymentMode || '')) ? paidAmount : 0,
        digitalMode: /upi|qr|bank|card/i.test(String(data.paymentMode || '')) ? data.paymentMode : 'UPI'
      };
      const mergedSplit = {
        cash: Math.round(((Number(prevSplit.cash) || 0) + (Number(newSplit.cash) || 0)) * 100) / 100,
        digital: Math.round(((Number(prevSplit.digital) || 0) + (Number(newSplit.digital) || 0)) * 100) / 100,
        digitalMode: newSplit.digitalMode || prevSplit.digitalMode || 'UPI',
        utr: data.transactionId || newSplit.utr || existing.transactionId || '',
        due: mergedDue,
        verifiedDigital: newSplit.verifiedDigital !== false && prevSplit.verifiedDigital !== false
      };

      invoices[existingIdx] = {
        ...existing,
        customerId: existing.customerId || data.customerId || '',
        customerName: existing.customerName || data.customerName || 'Walk-in Customer',
        phone: existing.phone || data.phone || '',
        address: existing.address || data.address || '',
        areaType: existing.areaType || data.areaType || '',
        blockOrMunicipality: existing.blockOrMunicipality || data.blockOrMunicipality || '',
        gpOrWard: existing.gpOrWard || data.gpOrWard || '',
        wardId: existing.wardId || data.wardId || '',
        wardNo: existing.wardNo || data.wardNo || '',
        wardNumber: existing.wardNumber || data.wardNumber || '',
        village: existing.village || data.village || '',
        postOffice: existing.postOffice || data.postOffice || '',
        policeStation: existing.policeStation || data.policeStation || '',
        district: existing.district || data.district || '',
        state: existing.state || data.state || '',
        pinCode: existing.pinCode || data.pinCode || '',
        documentType: data.documentType || existing.documentType || (mergedDue > 0 ? 'Due Invoice' : 'Service Invoice'),
        serviceRefNumber: data.serviceRefNumber || existing.serviceRefNumber || '',
        paymentMode: (mergedSplit.cash > 0 && mergedSplit.digital > 0) ? `Split (Cash + ${mergedSplit.digitalMode})` : (data.paymentMode || existing.paymentMode || ''),
        transactionId: data.transactionId || existing.transactionId || '',
        paymentSplit: mergedSplit,
        items: mergedItems,
        subtotal: mergedSubtotal,
        discount: mergedDiscount,
        taxPercent: mergedTaxPct,
        taxAmount: mergedTaxAmt,
        totalAmount: mergedTotal,
        paidAmount: mergedPaid,
        balanceDue: mergedDue,
        status: mergedStatus,
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.INVOICES, invoices);
      logAuditAction(
        'INVOICE_MERGED',
        `Merged ${items.length} item(s) into existing Invoice ${existing.id} for ${invoices[existingIdx].customerName} · Consolidated Total ₹${mergedTotal} (Due ₹${mergedDue})`
      );
      return {
        success: true,
        merged: true,
        previousTotal: existing.totalAmount || 0,
        previousPaid: existing.paidAmount || 0,
        invoice: invoices[existingIdx]
      };
    }
  }

  const invoiceId = await allocateGlobalReference('INV', { entityType: 'INVOICE' });
  const newInvoice = {
    id: invoiceId,
    date: targetDate,
    shopName: 'MUN COMPUTER',
    documentType: data.documentType || (taxAmount > 0 ? 'Tax Invoice' : (balanceDue > 0 ? 'Due Invoice' : 'Service Invoice')),
    serviceRefNumber: data.serviceRefNumber || '',
    paymentMode: data.paymentMode || '',
    transactionId: data.transactionId || '',
    paymentSplit: data.paymentSplit || null,
    customerId: data.customerId || '',
    customerName: data.customerName || 'Walk-in Customer',
    phone: data.phone || '',
    address: data.address || '',
    areaType: data.areaType || '',
    blockOrMunicipality: data.blockOrMunicipality || '',
    gpOrWard: data.gpOrWard || '',
    wardId: data.wardId || '',
    wardNo: data.wardNo || '',
    wardNumber: data.wardNumber || '',
    village: data.village || '',
    postOffice: data.postOffice || '',
    policeStation: data.policeStation || '',
    district: data.district || '',
    state: data.state || '',
    pinCode: data.pinCode || '',
    businessUnitId: data.businessUnitId || 'mun-computer',
    items,
    subtotal,
    discount,
    taxPercent,
    taxAmount,
    totalAmount,
    paidAmount,
    balanceDue,
    status,
    notes: data.notes || 'Thank you for choosing MUN COMPUTER! Private Digital Service & Customer Management Centre.',
    createdAt: new Date().toISOString()
  };

  invoices.unshift(newInvoice);
  setItem(KEYS.INVOICES, invoices);
  logAuditAction('INVOICE_CREATE', `Generated MUN COMPUTER invoice ${newInvoice.id} for ${newInvoice.customerName} (Total: ${newInvoice.totalAmount})`);
  return { success: true, merged: false, invoice: newInvoice };
}

export function deleteInvoice(id) {
  const invoices = getAllInvoices();
  const updated = invoices.filter(i => i.id !== id);
  setItem(KEYS.INVOICES, updated);
  markGlobalReferenceDeleted(id, 'DELETED');
  logAuditAction('INVOICE_DELETE', `Deleted invoice ${id}`);
  return { success: true };
}
