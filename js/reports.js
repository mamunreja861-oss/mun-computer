/**
 * reports.js - Centralized Financial Analytics, P&L, PDF, Excel & CSV Export
 * MUN COMPUTER BUSINESS MANAGER - Enterprise ERP
 * Location: Mamudpur, Juginda, Domkal, Murshidabad
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { getItem, KEYS, formatINR, numberToWords, formatDate, getTodayDate, getNowISTString } from './storage.js';
import { getCompanyProfileConfig } from './companyConfig.js';
import { drawBwPdfHeader, getBwAutoTableStyles, finalizeBwPdfPagination, preloadOfficialLogoPdfAsset } from './documentEngine.js';
import {
  exportUniversalCSV,
  exportUniversalExcel,
  exportUniversalPDF,
  buildUniversalExcelWorkbook,
  generateReportId,
  sanitizeFilename
} from './exportUtility.js';

function toLocalIsoDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getFilteredDateRange(preset = 'month', customStart = null, customEnd = null) {
  const now = new Date();
  const todayStr = getTodayDate();

  if (preset === 'custom' && customStart && customEnd) {
    return { start: customStart, end: customEnd };
  }

  if (preset === 'today') {
    return { start: todayStr, end: todayStr };
  }

  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yStr = toLocalIsoDate(y);
    return { start: yStr, end: yStr };
  }

  if (preset === 'week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff);
    return { start: toLocalIsoDate(startOfWeek), end: todayStr };
  }

  if (preset === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toLocalIsoDate(s), end: todayStr };
  }

  if (preset === 'last_month') {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: toLocalIsoDate(s), end: toLocalIsoDate(e) };
  }

  if (preset === 'quarter') {
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    const s = new Date(now.getFullYear(), qMonth, 1);
    return { start: toLocalIsoDate(s), end: todayStr };
  }

  if (preset === 'year') {
    const s = new Date(now.getFullYear(), 0, 1);
    return { start: toLocalIsoDate(s), end: todayStr };
  }

  // fallback all
  return { start: '2020-01-01', end: '2099-12-31' };
}

function classifyModeBucket(rawMethod) {
  const m = String(rawMethod || 'Cash').trim().toLowerCase();
  if (!m || m === 'cash') return 'CASH';
  if (m === 'upi' || m.includes('qr') || m.includes('phonepe') || m.includes('gpay') || m.includes('paytm')) return 'UPI';
  if (m === 'due' || m === 'credit') return 'DUE';
  return 'BANK';
}

export function generateFinancialSummary(unitId = 'all', dateFilter = 'month', customStart = null, customEnd = null) {
  const { start, end } = getFilteredDateRange(dateFilter, customStart, customEnd);
  const unitMatch = () => true;

  const allServices = getItem(KEYS.SERVICES, []);
  const allPayments = getItem(KEYS.PAYMENTS, []);
  const allExpenses = getItem(KEYS.EXPENSES, []);
  const allCustomers = getItem(KEYS.CUSTOMERS, []);
  const allInvoices = getItem(KEYS.INVOICES, []);
  const allBanking = getItem(KEYS.BANKING, []);
  const allInvestments = getItem(KEYS.INVESTMENTS, []);
  const allDaybook = getItem(KEYS.DAYBOOK, []);
  const allCounterTxns = getItem(KEYS.COUNTER_CASH_TXNS, []);

  const services = allServices.filter(s => s.appDate >= start && s.appDate <= end && unitMatch(s));
  const payments = allPayments.filter(p => p.paymentDate >= start && p.paymentDate <= end && unitMatch(p));
  const expenses = allExpenses.filter(e => e.date >= start && e.date <= end && unitMatch(e));
  const customers = allCustomers.filter(c => c.regDate >= start && c.regDate <= end && unitMatch(c));
  const invoices = allInvoices.filter(i => i.date >= start && i.date <= end && unitMatch(i));
  const banking = allBanking.filter(b => b.date >= start && b.date <= end && unitMatch(b));
  const investments = allInvestments.filter(inv => (inv.investmentDate || inv.date || '') >= start && (inv.investmentDate || inv.date || '') <= end);

  // 1. Gross billed amount (service requests + standalone invoices not linked to services)
  const serviceBilled = services.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
  const standaloneInvoiceBilled = invoices
    .filter(inv => !inv.serviceId)
    .reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
  const grossBilled = serviceBilled + standaloneInvoiceBilled;

  // 2. Real collected cash/UPI/Bank revenue (never counting banking principal or capital)
  const collectedRevenue = payments.reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0);

  // 3. Outstanding customer dues
  const serviceDues = services.reduce((sum, s) => sum + Math.max(0, Number(s.dueAmount) || 0), 0);
  const standaloneInvoiceDues = invoices
    .filter(inv => !inv.serviceId)
    .reduce((sum, inv) => sum + Math.max(0, Number(inv.balanceDue) || 0), 0);
  const totalDues = serviceDues + standaloneInvoiceDues;

  // 4. Total actual business expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // 5. PNB CSP / AePS Banking Commission (Rule 6 & 7: Principal excluded from income, ONLY earned commission counted)
  let bankingVolume = 0;
  let bankingWithdrawals = 0;
  let bankingDeposits = 0;
  let bankingTransfers = 0;
  let bankingCommission = 0;
  let bankingSuccessCount = 0;
  let bankingFailedCount = 0;
  let bankingPendingCount = 0;

  banking.forEach(b => {
    const amt = Number(b.amount) || 0;
    const comm = Number(b.commission) || 0;
    if (b.status === 'Success') {
      bankingSuccessCount++;
      bankingVolume += amt;
      bankingCommission += comm;
      if ((b.type || '').includes('Withdrawal')) bankingWithdrawals += amt;
      else if ((b.type || '').includes('Deposit')) bankingDeposits += amt;
      else if ((b.type || '').includes('Transfer')) bankingTransfers += amt;
    } else if (b.status === 'Failed') {
      bankingFailedCount++;
    } else {
      bankingPendingCount++;
    }
  });

  // 6. Operating Income & Net Profit (Rule 8 & 9: Operating Income = Service/Sales Collections + Earned Banking Commission)
  const totalOperatingIncome = collectedRevenue + bankingCommission;
  const netCashFlow = totalOperatingIncome - totalExpenses;
  const estimatedNetProfit = (grossBilled + bankingCommission) - totalExpenses;

  // 7. Separate Cash, UPI & Bank Balances (Rule 5)
  const sortedDaybook = [...allDaybook].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const latestSnapshot = sortedDaybook[0] || null;
  let cashInHand = 0;
  let upiBalance = 0;
  let bankBalance = 0;

  // Compute cumulative or period-accurate separate Cash / UPI / Bank balances
  let cashPayIn = 0;
  let upiPayIn = 0;
  let bankPayIn = 0;
  allPayments.forEach(p => {
    const amt = Number(p.paymentAmount) || 0;
    const bucket = classifyModeBucket(p.paymentMethod);
    if (bucket === 'CASH') cashPayIn += amt;
    else if (bucket === 'UPI') upiPayIn += amt;
    else if (bucket === 'BANK') bankPayIn += amt;
  });

  let cashExpOut = 0;
  let upiExpOut = 0;
  let bankExpOut = 0;
  allExpenses.forEach(e => {
    const amt = Number(e.amount) || 0;
    const bucket = classifyModeBucket(e.paymentMethod);
    if (bucket === 'CASH') cashExpOut += amt;
    else if (bucket === 'UPI') upiExpOut += amt;
    else if (bucket === 'BANK') bankExpOut += amt;
  });

  let counterCashNet = 0;
  let counterUpiNet = 0;
  let counterBankNet = 0;
  allCounterTxns.forEach(t => {
    const amt = Number(t.amount) || 0;
    const bucket = classifyModeBucket(t.paymentMode);
    if (bucket === 'DUE') return;
    const isIn = t.type === 'CASH_RECEIVED' || t.type === 'CASH_WITHDRAWAL';
    const signed = isIn ? amt : -amt;
    if (bucket === 'CASH') counterCashNet += signed;
    else if (bucket === 'UPI') counterUpiNet += signed;
    else if (bucket === 'BANK') counterBankNet += signed;
  });

  if (latestSnapshot && (latestSnapshot.countedPhysicalCash !== undefined || latestSnapshot.closingCash !== undefined || latestSnapshot.expectedClosing !== undefined)) {
    cashInHand = Number(latestSnapshot.closingCash ?? latestSnapshot.countedPhysicalCash ?? latestSnapshot.expectedClosing) || 0;
  } else {
    cashInHand = cashPayIn - cashExpOut + counterCashNet;
  }
  upiBalance = upiPayIn - upiExpOut + counterUpiNet;
  bankBalance = bankPayIn - bankExpOut + counterBankNet;

  // 8. Capital & Investments (Rule 8: Never counted as operating income)
  let ownerCapitalAdded = 0;
  let ownerWithdrawals = 0;
  let totalInvestments = 0;
  allInvestments.forEach(inv => {
    const amt = Number(inv.amount) || 0;
    const cat = String(inv.category || '').toLowerCase();
    const src = String(inv.fundingType || inv.source || '').toLowerCase();
    if (cat.includes('withdrawal') || src.includes('withdrawal')) {
      ownerWithdrawals += amt;
    } else if (src.includes('capital') || cat.includes('capital')) {
      ownerCapitalAdded += amt;
      totalInvestments += amt;
    } else {
      totalInvestments += amt;
    }
  });
  const totalCapital = Math.max(0, ownerCapitalAdded - ownerWithdrawals);

  const periodInvestmentsTotal = investments.reduce((s, inv) => s + (Number(inv.amount) || 0), 0);

  return {
    dateRange: { start, end, preset: dateFilter },
    unitId,
    grossBilled,
    collectedRevenue,
    totalDues,
    totalExpenses,
    bankingCommission,
    bankingVolume,
    bankingWithdrawals,
    bankingDeposits,
    bankingTransfers,
    bankingSuccessCount,
    bankingFailedCount,
    bankingPendingCount,
    totalOperatingIncome,
    netCashFlow,
    estimatedNetProfit,
    cashInHand,
    upiBalance,
    bankBalance,
    totalCapital,
    totalInvestments,
    ownerWithdrawals,
    periodInvestmentsTotal,
    customersCount: customers.length,
    servicesCount: services.length,
    invoicesCount: invoices.length,
    paymentsCount: payments.length,
    expensesCount: expenses.length,
    bankingCount: banking.length
  };
}

/**
 * Universal autoTable wrapper to support both direct function and prototype calls
 */
function applyAutoTable(doc, options) {
  if (typeof autoTable === 'function') {
    autoTable(doc, options);
  } else if (typeof doc.autoTable === 'function') {
    doc.autoTable(options);
  }
}

export function pdfSafeText(val) {
  return String(val ?? '')
    .replace(/₹/g, 'Rs.')
    .replace(/–|—/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ')
    .trim();
}

export function pdfINR(amount, showDecimals = false) {
  return formatINR(amount, showDecimals).replace(/₹/g, 'Rs.');
}

/**
 * Export arbitrary dataset to CSV with Universal MUN COMPUTER Header, UTF-8 BOM & Totals
 */
export function downloadCSV(filename, rows, headers, options = {}) {
  const cleanName = String(filename || 'MUN_COMPUTER_Export').replace(/\.csv$/i, '');
  const title = options.title || cleanName.replace(/MUN_COMPUTER_/i, '').replace(/_/g, ' ').toUpperCase();
  const res = exportUniversalCSV({
    filename: cleanName,
    title,
    reportId: options.reportId || generateReportId('MUN-CSV'),
    statusLabel: options.statusLabel || 'VERIFIED',
    subtitle: options.subtitle || '',
    headers,
    rows,
    totalsRow: options.totalsRow || null,
    emptyNote: options.emptyNote || 'No records available.'
  });
  return res.success;
}

/**
 * Export arbitrary dataset to Microsoft Excel (.xlsx) with Universal MUN COMPUTER Header & auto-fit columns
 */
export function downloadExcelSheet(filename, sheetName = 'Data', jsonRows = [], emptyNote = 'No records available', options = {}) {
  const cleanName = String(filename || 'MUN_COMPUTER_Export').replace(/\.xlsx$/i, '');
  const title = options.title || cleanName.replace(/MUN_COMPUTER_/i, '').replace(/_/g, ' ').toUpperCase();
  const list = Array.isArray(jsonRows) ? jsonRows : [];
  const headers = Array.isArray(options.headers) && options.headers.length
    ? options.headers
    : (list.length > 0 && typeof list[0] === 'object' && list[0] !== null
        ? Object.keys(list[0]).map((k) => ({ key: k, label: k }))
        : [{ key: 'Note', label: 'Details' }]);

  const res = exportUniversalExcel({
    filename: cleanName,
    sheetName,
    title,
    reportId: options.reportId || generateReportId('MUN-XLS'),
    statusLabel: options.statusLabel || 'VERIFIED',
    subtitle: options.subtitle || '',
    headers,
    rows: list,
    totalsRow: options.totalsRow || null,
    emptyNote
  });
  return res.success;
}

/**
 * Export tabular report to formatted Corporate Blue & White PDF (A4/A5)
 */
export function exportTablePDF({
  filename = 'MUN_COMPUTER_Report',
  title = 'MUN COMPUTER REPORT',
  subtitle = '',
  statusLabel = 'VERIFIED',
  reportId = '',
  headers = [],
  rows = [],
  totalsRow = null,
  summaryCards = [],
  orientation = 'auto',
  format = 'a4'
}) {
  exportUniversalPDF({
    filename,
    title,
    reportId: reportId || generateReportId('MUN-PDF'),
    statusLabel,
    subtitle,
    headers,
    rows,
    totalsRow,
    summaryCards,
    orientation,
    format,
    includeAcknowledgement: true
  });
  return true;
}

/* =========================================================================
   1. REPORT EXPORT (PDF, EXCEL, CSV)
   ========================================================================= */

/**
 * Export Financial & P&L Statement as a professional Corporate Blue & White PDF document
 */
export async function exportReportPDF(summary, periodLabel = 'This Month', layoutOpts = {}) {
  await preloadOfficialLogoPdfAsset();
  const cfg = getCompanyProfileConfig();
  const rptId = generateReportId('MUN-PNL');
  const orientation = layoutOpts?.orientation === 'landscape' ? 'landscape' : 'portrait';
  const format = layoutOpts?.format === 'a5' ? 'a5' : 'a4';
  const doc = new jsPDF({ orientation, unit: 'mm', format });
  const bw = getBwAutoTableStyles();
  const margin = 10;

  const startY = drawBwPdfHeader(doc, {
    docTitle: 'FINANCIAL & INCOME P&L STATEMENT',
    docNumber: rptId,
    docDateTime: getNowISTString(),
    metaLine: `Period: ${formatDate(summary.dateRange.start)} to ${formatDate(summary.dateRange.end)} (${periodLabel})  |  Status: ${summary.netCashFlow >= 0 ? 'OPERATING SURPLUS' : 'OPERATING DEFICIT'}`
  });

  const pnlRows = [
    ['Total Billed Amount', pdfINR(summary.grossBilled, true), pdfSafeText(numberToWords(summary.grossBilled)), 'Total value of billed services & invoices'],
    ['Total Collected Amount', pdfINR(summary.collectedRevenue, true), pdfSafeText(numberToWords(summary.collectedRevenue)), 'Verified cash, UPI & bank collections'],
    ['Total Outstanding Due', pdfINR(summary.totalDues, true), pdfSafeText(numberToWords(summary.totalDues)), 'Pending receivable dues'],
    ['Banking Commission (CSP/AePS)', pdfINR(summary.bankingCommission || 0, true), pdfSafeText(numberToWords(summary.bankingCommission || 0)), 'Earned commission only (principal excluded)'],
    ['Total Operating Income', pdfINR(summary.totalOperatingIncome ?? summary.collectedRevenue, true), pdfSafeText(numberToWords(summary.totalOperatingIncome ?? summary.collectedRevenue)), 'Collected revenue + earned banking commission'],
    ['Total Expenses', pdfINR(summary.totalExpenses, true), pdfSafeText(numberToWords(summary.totalExpenses)), 'Shop rent, electricity, internet, salary & operational costs'],
    ['Net Profit / Loss', pdfINR(summary.netCashFlow, true), pdfSafeText(numberToWords(summary.netCashFlow)), summary.netCashFlow >= 0 ? 'Operating Surplus' : 'Operating Deficit'],
    ['Cash in Hand', pdfINR(summary.cashInHand || 0, true), pdfSafeText(numberToWords(summary.cashInHand || 0)), 'Physical drawer cash balance'],
    ['UPI Balance', pdfINR(summary.upiBalance || 0, true), pdfSafeText(numberToWords(summary.upiBalance || 0)), 'Net UPI / QR balance'],
    ['Bank Balance', pdfINR(summary.bankBalance || 0, true), pdfSafeText(numberToWords(summary.bankBalance || 0)), 'Net bank account balance'],
    ['Total Capital', pdfINR(summary.totalCapital || 0, true), pdfSafeText(numberToWords(summary.totalCapital || 0)), 'Owner capital minus withdrawals (non-income)'],
    ['Total Investments', pdfINR(summary.totalInvestments || 0, true), pdfSafeText(numberToWords(summary.totalInvestments || 0)), 'Assets & expansion investments']
  ];

  applyAutoTable(doc, {
    startY,
    head: [['Master Financial Summary (Particulars)', 'Amount (INR)', 'Amount in Words', 'Verification & Audit Notes']],
    body: pnlRows,
    foot: [['NET PROFIT / LOSS POSITION', pdfINR(summary.netCashFlow, true), pdfSafeText(numberToWords(summary.netCashFlow)), summary.netCashFlow >= 0 ? 'SURPLUS' : 'DEFICIT']],
    showFoot: 'lastPage',
    ...bw,
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { fontStyle: 'bold', halign: 'right' }
    },
    margin: { left: margin, right: margin, bottom: 14 }
  });

  let currentY = (doc.lastAutoTable?.finalY || 80) + 7;
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();

  const payments = getItem(KEYS.PAYMENTS, []).filter(p => p.paymentDate >= summary.dateRange.start && p.paymentDate <= summary.dateRange.end);
  if (currentY > pageH - 45) {
    doc.addPage();
    currentY = 14;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 59, 140);
  doc.text(`Collections & Payment Ledger (${payments.length} Records)`, margin, currentY);
  doc.setTextColor(0, 0, 0);
  currentY += 3.5;

  const payTotal = payments.reduce((s, p) => s + (Number(p.paymentAmount) || 0), 0);
  const paymentRows = payments.length > 0
    ? payments.slice(0, 40).map(p => [
        pdfSafeText(p.id),
        formatDate(p.paymentDate),
        pdfSafeText(p.customerName || '-'),
        pdfSafeText(p.paymentMethod || 'Cash'),
        pdfINR(p.paymentAmount),
        pdfSafeText(p.paymentStatus || 'Paid')
      ])
    : [['-', '-', 'No payment transactions recorded for this period', '-', pdfINR(0), '-']];

  applyAutoTable(doc, {
    startY: currentY,
    head: [['Txn ID', 'Date', 'Customer Name', 'Method', 'Amount (INR)', 'Status']],
    body: paymentRows,
    foot: [['TOTAL COLLECTIONS', `${payments.length} Txns`, '', '', pdfINR(payTotal), 'VERIFIED']],
    showFoot: 'lastPage',
    ...bw,
    columnStyles: {
      4: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin, bottom: 14 }
  });

  currentY = (doc.lastAutoTable?.finalY || currentY + 30) + 7;

  const expenses = getItem(KEYS.EXPENSES, []).filter(e => e.date >= summary.dateRange.start && e.date <= summary.dateRange.end);
  if (currentY > pageH - 45) {
    doc.addPage();
    currentY = 14;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 59, 140);
  doc.text(`Business Expenses Breakdown (${expenses.length} Entries)`, margin, currentY);
  doc.setTextColor(0, 0, 0);
  currentY += 3.5;

  const expTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const expenseRows = expenses.length > 0
    ? expenses.slice(0, 40).map(e => [
        pdfSafeText(e.id),
        formatDate(e.date),
        pdfSafeText(e.category || 'General'),
        pdfSafeText(e.title || '-'),
        pdfSafeText(e.vendorName || '-'),
        pdfINR(e.amount)
      ])
    : [['-', '-', 'No business expenses logged for this period', '-', '-', pdfINR(0)]];

  applyAutoTable(doc, {
    startY: currentY,
    head: [['Expense ID', 'Date', 'Category', 'Description', 'Vendor', 'Amount (INR)']],
    body: expenseRows,
    foot: [['TOTAL EXPENSES', `${expenses.length} Entries`, '', '', '', pdfINR(expTotal)]],
    showFoot: 'lastPage',
    ...bw,
    columnStyles: {
      5: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin, bottom: 14 }
  });

  let sigY = (doc.lastAutoTable?.finalY || currentY + 25) + 8;
  if (sigY + 18 > pageH - 14) {
    doc.addPage();
    sigY = 16;
  }
  doc.setDrawColor(11, 59, 140);
  doc.line(pageW - margin - 58, sigY + 10, pageW - margin, sigY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(pdfSafeText(cfg.authorizedSignatory), pageW - margin, sigY + 14, { align: 'right' });

  finalizeBwPdfPagination(doc, `${cfg.companyName} · Official Financial P&L Statement · ${rptId}`);
  if (typeof document !== 'undefined') {
    doc.save(`MUN_COMPUTER_Financial_Report_${getTodayDate()}.pdf`);
  }
  return true;
}

/**
 * Export Financial & P&L Statement as a Corporate Microsoft Excel (.xlsx) workbook
 */
export function exportReportExcel(summary) {
  const rptId = generateReportId('MUN-FIN-XLS');
  const periodSub = `${formatDate(summary.dateRange.start)} to ${formatDate(summary.dateRange.end)}`;
  const statusLbl = summary.netCashFlow >= 0 ? 'OPERATING SURPLUS' : 'OPERATING DEFICIT';

  const summaryRows = [
    ['Total Billed Amount', Number(summary.grossBilled) || 0, 'Total value of services & invoices rendered'],
    ['Total Collected Amount', Number(summary.collectedRevenue) || 0, 'Actual payments received at counter (Cash/UPI/Bank)'],
    ['Total Outstanding Due', Number(summary.totalDues) || 0, 'Uncollected balances pending recovery'],
    ['Earned Banking Commission (CSP/AePS)', Number(summary.bankingCommission) || 0, 'Commission earned only (customer principal excluded)'],
    ['Total Operating Income', Number(summary.totalOperatingIncome ?? summary.collectedRevenue) || 0, 'Collections + Earned Banking Commission'],
    ['Total Expenses', Number(summary.totalExpenses) || 0, 'Shop rent, electricity, internet, paper, salaries'],
    ['Net Profit / Loss', Number(summary.netCashFlow) || 0, statusLbl],
    ['Cash in Hand', Number(summary.cashInHand) || 0, 'Physical drawer cash balance'],
    ['UPI Balance', Number(summary.upiBalance) || 0, 'Net UPI / QR balance'],
    ['Bank Balance', Number(summary.bankBalance) || 0, 'Net bank account balance'],
    ['Total Capital', Number(summary.totalCapital) || 0, 'Owner capital minus withdrawals (excluded from income)'],
    ['Total Investments', Number(summary.totalInvestments) || 0, 'Business capital & asset investments'],
    ['Registered Customers in Period', Number(summary.customersCount) || 0, 'Directory records'],
    ['Service Requests Processed', Number(summary.servicesCount) || 0, 'Counter services'],
    ['Payment Transactions Recorded', Number(summary.paymentsCount) || 0, 'Ledger receipts'],
    ['PNB CSP / AePS Transactions', Number(summary.bankingCount) || 0, 'Principal volume excluded from income'],
    ['Expense Vouchers Logged', Number(summary.expensesCount) || 0, 'Operating vouchers']
  ];

  const payments = getItem(KEYS.PAYMENTS, []).filter(p => p.paymentDate >= summary.dateRange.start && p.paymentDate <= summary.dateRange.end);
  const payRows = payments.map(p => [
    p.id,
    p.paymentDate,
    p.customerName || '',
    p.paymentMethod || 'Cash',
    Number(p.paymentAmount) || 0,
    Number(p.remainingDue) || 0,
    p.transactionId || '',
    p.remarks || ''
  ]);
  const paySum = payments.reduce((s, p) => s + (Number(p.paymentAmount) || 0), 0);

  const expenses = getItem(KEYS.EXPENSES, []).filter(e => e.date >= summary.dateRange.start && e.date <= summary.dateRange.end);
  const expRows = expenses.map(e => [
    e.id,
    e.date,
    e.category || 'General',
    e.title || '',
    Number(e.amount) || 0,
    e.vendorName || '',
    e.paymentMethod || '',
    e.paidBy || '',
    e.billNumber || '',
    e.remarks || ''
  ]);
  const expSum = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const services = getItem(KEYS.SERVICES, []).filter(s => s.appDate >= summary.dateRange.start && s.appDate <= summary.dateRange.end);
  const srvRows = services.map(s => [
    s.id,
    s.appDate,
    s.customerName || '',
    s.serviceName || '',
    s.category || '',
    Number(s.totalAmount) || 0,
    Number(s.paidAmount) || 0,
    Number(s.dueAmount) || 0,
    s.status || '',
    s.deliveryDate || ''
  ]);
  const srvTotal = services.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
  const srvPaid = services.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const srvDue = services.reduce((s, r) => s + (Number(r.dueAmount) || 0), 0);

  const { wb } = buildUniversalExcelWorkbook({
    sheetName: 'Final_Master_Summary',
    title: 'OFFICIAL FINANCIAL & P&L REPORT',
    reportId: rptId,
    statusLabel: statusLbl,
    subtitle: periodSub,
    headers: ['METRIC / PARTICULARS', 'AMOUNT / COUNT', 'DETAILS / STATUS'],
    rows: summaryRows,
    totalsRow: ['NET OPERATING PROFIT / LOSS', Number(summary.netCashFlow) || 0, statusLbl],
    extraSheets: [
      {
        sheetName: 'Collections_Ledger',
        title: 'COLLECTIONS & PAYMENT LEDGER',
        subtitle: periodSub,
        headers: ['Payment ID', 'Date', 'Customer Name', 'Payment Method', 'Amount (INR)', 'Remaining Due', 'Transaction / UPI Ref', 'Remarks'],
        rows: payRows,
        totalsRow: ['GRAND TOTAL', '', `${payments.length} Records`, '', paySum, '', '', ''],
        emptyNote: 'No payments recorded for this period'
      },
      {
        sheetName: 'Expenses_Register',
        title: 'BUSINESS EXPENSES REGISTER',
        subtitle: periodSub,
        headers: ['Expense ID', 'Date', 'Category', 'Title / Description', 'Amount (INR)', 'Vendor / Payee', 'Payment Method', 'Paid By', 'Bill / Voucher No.', 'Remarks'],
        rows: expRows,
        totalsRow: ['GRAND TOTAL', '', `${expenses.length} Entries`, '', expSum, '', '', '', '', ''],
        emptyNote: 'No expenses recorded for this period'
      },
      {
        sheetName: 'Services_Track',
        title: 'SERVICES & APPLICATION REGISTER',
        subtitle: periodSub,
        headers: ['Service ID', 'Booking Date', 'Customer Name', 'Service Name', 'Category', 'Total Fee (INR)', 'Paid Amount', 'Due Amount', 'Status', 'Delivery Date'],
        rows: srvRows,
        totalsRow: ['GRAND TOTAL', '', `${services.length} Services`, '', '', srvTotal, srvPaid, srvDue, '', ''],
        emptyNote: 'No services recorded for this period'
      }
    ]
  });

  if (typeof document !== 'undefined') {
    XLSX.writeFile(wb, sanitizeFilename('MUN_COMPUTER_Financial_Report', 'xlsx'));
  }
  return true;
}

/**
 * Export Financial & P&L Statement as a Corporate CSV file (UTF-8 BOM + Header)
 */
export function exportReportCSV(summary) {
  const rows = [
    { Section: 'Final Master Summary', Metric: 'Total Billed Amount', 'Amount (INR)': summary.grossBilled, Notes: 'Total value of billed services & invoices' },
    { Section: 'Final Master Summary', Metric: 'Total Collected Amount', 'Amount (INR)': summary.collectedRevenue, Notes: 'Actual verified payments received' },
    { Section: 'Final Master Summary', Metric: 'Total Outstanding Due', 'Amount (INR)': summary.totalDues, Notes: 'Unpaid client balances' },
    { Section: 'Final Master Summary', Metric: 'Banking Commission (CSP/AePS)', 'Amount (INR)': summary.bankingCommission || 0, Notes: 'Earned commission only' },
    { Section: 'Final Master Summary', Metric: 'Total Operating Income', 'Amount (INR)': summary.totalOperatingIncome ?? summary.collectedRevenue, Notes: 'Collections + Banking Commission' },
    { Section: 'Final Master Summary', Metric: 'Total Expenses', 'Amount (INR)': summary.totalExpenses, Notes: 'Operational expenses' },
    { Section: 'Final Master Summary', Metric: 'Net Profit / Loss', 'Amount (INR)': summary.netCashFlow, Notes: 'Operating Income - Expenses' },
    { Section: 'Final Master Summary', Metric: 'Cash in Hand', 'Amount (INR)': summary.cashInHand || 0, Notes: 'Physical counter drawer balance' },
    { Section: 'Final Master Summary', Metric: 'UPI Balance', 'Amount (INR)': summary.upiBalance || 0, Notes: 'Separate UPI / QR balance' },
    { Section: 'Final Master Summary', Metric: 'Bank Balance', 'Amount (INR)': summary.bankBalance || 0, Notes: 'Separate Bank account balance' },
    { Section: 'Final Master Summary', Metric: 'Total Capital', 'Amount (INR)': summary.totalCapital || 0, Notes: 'Owner capital minus withdrawals' },
    { Section: 'Final Master Summary', Metric: 'Total Investments', 'Amount (INR)': summary.totalInvestments || 0, Notes: 'Business assets & investments' },
    { Section: 'Operational Counts', Metric: 'Registered Customers', 'Amount (INR)': summary.customersCount, Notes: 'In selected period' },
    { Section: 'Operational Counts', Metric: 'Services Registered', 'Amount (INR)': summary.servicesCount, Notes: 'In selected period' },
    { Section: 'Operational Counts', Metric: 'Payments Recorded', 'Amount (INR)': summary.paymentsCount, Notes: 'In selected period' },
    { Section: 'Operational Counts', Metric: 'Expenses Recorded', 'Amount (INR)': summary.expensesCount, Notes: 'In selected period' }
  ];

  return downloadCSV('MUN_COMPUTER_Financial_Summary', rows, [
    { key: 'Section', label: 'Report Section' },
    { key: 'Metric', label: 'Financial Metric' },
    { key: 'Amount (INR)', label: 'Amount / Count' },
    { key: 'Notes', label: 'Description & Notes' }
  ], {
    title: 'FINANCIAL & INCOME P&L STATEMENT',
    subtitle: `Period: ${formatDate(summary.dateRange.start)} to ${formatDate(summary.dateRange.end)}`,
    statusLabel: summary.netCashFlow >= 0 ? 'OPERATING SURPLUS' : 'OPERATING DEFICIT',
    totalsRow: ['GRAND TOTAL', 'Net Profit / Loss', summary.netCashFlow, summary.netCashFlow >= 0 ? 'Surplus' : 'Deficit']
  });
}

/* =========================================================================
   2. ALL DATA MASTER EXPORTS (EXCEL, PDF, CSV)
   ========================================================================= */

/**
 * Export ALL application tables in a Master Corporate Excel Workbook (.xlsx)
 */
export function exportAllDataExcel() {
  const cfg = getCompanyProfileConfig();
  const profile = getItem(KEYS.BUSINESS_PROFILE, {});
  const rptId = generateReportId('MUN-MASTER-XLS');

  const profileRows = [
    ['Business Name', cfg.companyName],
    ['Tagline', cfg.tagline],
    ['Owner / In-Charge', profile.ownerName || 'Mamun Reja'],
    ['Helpline Phone', cfg.phone],
    ['Email Address', cfg.email],
    ['Address', cfg.address],
    ['Trade License', cfg.tradeLicense || ''],
    ['GSTIN', cfg.gstin || ''],
    ['Bank Account', profile.bankAccount || ''],
    ['Backup Date', getNowISTString()]
  ];

  const customers = getItem(KEYS.CUSTOMERS, []);
  const custRows = customers.map(c => [
    c.id, c.name, c.fatherName || '', c.phone, c.altPhone || '', c.village || '',
    c.postOffice || '', c.policeStation || '', c.district || 'Murshidabad', c.pinCode || '',
    c.category || 'General', c.regDate || '', c.remarks || ''
  ]);

  const services = getItem(KEYS.SERVICES, []);
  const srvRows = services.map(s => [
    s.id, s.appDate, s.customerName, s.phone || '', s.serviceName, s.category,
    s.subcategory || '', s.refNumber || '', Number(s.serviceCharge) || 0, Number(s.govFee) || 0,
    Number(s.totalAmount) || 0, Number(s.paidAmount) || 0, Number(s.dueAmount) || 0,
    s.status, s.deliveryDate || '', s.remarks || ''
  ]);

  const payments = getItem(KEYS.PAYMENTS, []);
  const payRows = payments.map(p => [
    p.id, p.paymentDate, p.customerName, p.serviceId || '', p.invoiceNumber || '',
    Number(p.paymentAmount) || 0, p.paymentMethod || 'Cash', p.transactionId || '', p.remarks || ''
  ]);

  const invoices = getItem(KEYS.INVOICES, []);
  const invRows = invoices.map(i => [
    i.id, i.date, i.customerName, i.phone || '', Number(i.totalAmount) || 0,
    Number(i.paidAmount) || 0, Number(i.balanceDue) || 0, i.status || ''
  ]);

  const expenses = getItem(KEYS.EXPENSES, []);
  const expRows = expenses.map(e => [
    e.id, e.date, e.category, e.title, Number(e.amount) || 0,
    e.vendorName || '', e.paymentMethod || '', e.paidBy || '', e.billNumber || '', e.remarks || ''
  ]);

  const banking = getItem(KEYS.BANKING, []);
  const bankRows = banking.map(b => [
    b.id, b.date, b.time || '', b.type, b.bank, b.customerName,
    b.customerPhone || '', Number(b.amount) || 0, Number(b.commission) || 0, b.rrn || '', b.status
  ]);

  const inventory = getItem(KEYS.INVENTORY, []);
  const invItems = inventory.map(item => [
    item.id, item.sku || '', item.name, item.category, Number(item.stockQuantity) || 0,
    Number(item.minStockLevel) || 5, Number(item.costPrice) || 0, Number(item.sellingPrice) || 0,
    item.supplier || '', item.shelfLocation || ''
  ]);

  const daybook = getItem(KEYS.DAYBOOK, []);
  const dayRows = daybook.map(d => [
    d.id, d.date, Number(d.openingCash) || 0, Number(d.serviceCashIn) || 0,
    Number(d.cspCashIn) || 0, Number(d.cspCashOut) || 0, Number(d.cashExpenses) || 0,
    Number(d.expectedClosing) || 0, Number(d.countedPhysicalCash) || 0, Number(d.difference) || 0,
    d.status, d.verifiedBy || ''
  ]);

  const { wb } = buildUniversalExcelWorkbook({
    sheetName: 'Business_Profile',
    title: 'MASTER BUSINESS DATABASE WORKBOOK',
    reportId: rptId,
    statusLabel: 'MASTER BACKUP',
    headers: ['Profile Field', 'Details'],
    rows: profileRows,
    extraSheets: [
      {
        sheetName: 'Customers',
        title: 'CUSTOMER DIRECTORY',
        headers: ['Customer ID', 'Name', 'Father / Guardian', 'Mobile', 'Alt Phone', 'Village', 'Post Office', 'Police Station', 'District', 'PIN Code', 'Category', 'Registration Date', 'Remarks'],
        rows: custRows,
        totalsRow: ['TOTAL CUSTOMERS', customers.length, '', '', '', '', '', '', '', '', '', '', ''],
        emptyNote: 'No customers registered yet'
      },
      {
        sheetName: 'Services',
        title: 'SERVICES & APPLICATION REGISTRY',
        headers: ['Service ID', 'Booking Date', 'Customer Name', 'Mobile', 'Service Name', 'Category', 'Subcategory', 'Ref / App No.', 'Service Charge', 'Govt Fee', 'Total Amount', 'Paid Amount', 'Due Amount', 'Status', 'Delivery Date', 'Remarks'],
        rows: srvRows,
        totalsRow: ['GRAND TOTAL', '', `${services.length} Services`, '', '', '', '', '', services.reduce((s, r) => s + (Number(r.serviceCharge) || 0), 0), services.reduce((s, r) => s + (Number(r.govFee) || 0), 0), services.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0), services.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0), services.reduce((s, r) => s + (Number(r.dueAmount) || 0), 0), '', '', ''],
        emptyNote: 'No services registered yet'
      },
      {
        sheetName: 'Payments',
        title: 'PAYMENTS & COLLECTIONS LEDGER',
        headers: ['Payment ID', 'Date', 'Customer Name', 'Service ID', 'Invoice Number', 'Amount (INR)', 'Payment Method', 'Txn / UPI ID', 'Remarks'],
        rows: payRows,
        totalsRow: ['GRAND TOTAL', '', `${payments.length} Payments`, '', '', payments.reduce((s, p) => s + (Number(p.paymentAmount) || 0), 0), '', '', ''],
        emptyNote: 'No payments recorded yet'
      },
      {
        sheetName: 'Invoices',
        title: 'INVOICES & BILLS REGISTER',
        headers: ['Invoice ID', 'Date', 'Customer Name', 'Phone', 'Total Amount', 'Paid Amount', 'Balance Due', 'Status'],
        rows: invRows,
        totalsRow: ['GRAND TOTAL', '', `${invoices.length} Invoices`, '', invoices.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0), invoices.reduce((s, i) => s + (Number(i.paidAmount) || 0), 0), invoices.reduce((s, i) => s + (Number(i.balanceDue) || 0), 0), ''],
        emptyNote: 'No invoices issued yet'
      },
      {
        sheetName: 'Expenses',
        title: 'BUSINESS EXPENSES REGISTER',
        headers: ['Expense ID', 'Date', 'Category', 'Title', 'Amount (INR)', 'Vendor', 'Payment Method', 'Paid By', 'Bill No.', 'Remarks'],
        rows: expRows,
        totalsRow: ['GRAND TOTAL', '', `${expenses.length} Entries`, '', expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), '', '', '', '', ''],
        emptyNote: 'No expenses recorded yet'
      },
      {
        sheetName: 'Banking_CSP',
        title: 'PNB CSP / AEPS BANKING REGISTER',
        headers: ['Txn ID', 'Date', 'Time', 'Transaction Type', 'Bank', 'Customer', 'Phone', 'Amount (INR)', 'Commission Earned', 'RRN', 'Status'],
        rows: bankRows,
        totalsRow: ['GRAND TOTAL', '', '', `${banking.length} Txns`, '', '', '', banking.reduce((s, b) => s + (Number(b.amount) || 0), 0), banking.reduce((s, b) => s + (Number(b.commission) || 0), 0), '', ''],
        emptyNote: 'No banking transactions yet'
      },
      {
        sheetName: 'Inventory',
        title: 'INVENTORY & STOCK REGISTER',
        headers: ['Product ID', 'SKU', 'Item Name', 'Category', 'Stock Quantity', 'Min Stock Level', 'Cost Price (INR)', 'Selling Price (INR)', 'Supplier', 'Location'],
        rows: invItems,
        totalsRow: ['TOTAL STOCK QTY', '', `${invItems.length} SKUs`, '', inventory.reduce((s, i) => s + (Number(i.stockQuantity) || 0), 0), '', '', '', '', ''],
        emptyNote: 'No inventory items yet'
      },
      {
        sheetName: 'Daybook',
        title: 'COUNTER DAYBOOK CASH RECORDS',
        headers: ['Daybook ID', 'Date', 'Opening Cash', 'Service Cash In', 'CSP Cash In', 'CSP Cash Out', 'Cash Expenses', 'Expected Closing', 'Physical Counted', 'Difference', 'Status', 'Verified By'],
        rows: dayRows,
        totalsRow: ['TOTAL ENTRIES', dayRows.length, '', '', '', '', '', '', '', '', '', ''],
        emptyNote: 'No daybook entries yet'
      }
    ]
  });

  if (typeof document !== 'undefined') {
    XLSX.writeFile(wb, sanitizeFilename('MUN_COMPUTER_All_Data_Master_Workbook', 'xlsx'));
  }
  return true;
}

/**
 * Export Master Operations & Complete Business Audit Report in PDF
 */
export async function exportAllDataPDF() {
  await preloadOfficialLogoPdfAsset();
  const cfg = getCompanyProfileConfig();
  const rptId = generateReportId('MUN-MASTER-PDF');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const bw = getBwAutoTableStyles();
  const margin = 10;

  const startY = drawBwPdfHeader(doc, {
    docTitle: 'MASTER BUSINESS DATABASE REPORT',
    docNumber: rptId,
    docDateTime: getNowISTString(),
    metaLine: 'Complete Operations, Customers, Services, Payments, Expenses & Banking Register'
  });

  const customers = getItem(KEYS.CUSTOMERS, []);
  const services = getItem(KEYS.SERVICES, []);
  const payments = getItem(KEYS.PAYMENTS, []);
  const expenses = getItem(KEYS.EXPENSES, []);
  const banking = getItem(KEYS.BANKING, []);

  const totalPaymentsAmt = payments.reduce((s, p) => s + (Number(p.paymentAmount) || 0), 0);
  const totalExpensesAmt = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const summaryRows = [
    ['Total Registered Customers', customers.length.toString(), 'Citizen & merchant directory'],
    ['Total Service Requests Logged', services.length.toString(), 'Active & delivered services'],
    ['Total Payments Collected', payments.length.toString(), `Gross Inflow: ${pdfINR(totalPaymentsAmt)} (${pdfSafeText(numberToWords(totalPaymentsAmt))})`],
    ['Total Expenses Logged', expenses.length.toString(), `Total Outflow: ${pdfINR(totalExpensesAmt)} (${pdfSafeText(numberToWords(totalExpensesAmt))})`],
    ['PNB CSP Banking Transactions', banking.length.toString(), 'AePS cash withdrawals & deposits']
  ];

  applyAutoTable(doc, {
    startY,
    head: [['Business Registry Table', 'Total Records', 'Financial Overview']],
    body: summaryRows,
    ...bw,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 62 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 30 }
    },
    margin: { left: margin, right: margin, bottom: 14 }
  });

  let currentY = (doc.lastAutoTable?.finalY || 80) + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 59, 140);
  doc.text(`1. Customer Directory (${customers.length} Records)`, margin, currentY);
  doc.setTextColor(0, 0, 0);
  currentY += 3.5;

  const custRows = customers.length > 0
    ? customers.slice(0, 40).map(c => [
        pdfSafeText(c.id),
        pdfSafeText(c.name),
        pdfSafeText(c.phone),
        pdfSafeText(c.village || '-'),
        pdfSafeText(c.category || 'General'),
        formatDate(c.regDate)
      ])
    : [['-', 'No customers registered yet.', '-', '-', '-', '-']];

  applyAutoTable(doc, {
    startY: currentY,
    head: [['Customer ID', 'Full Name', 'Mobile', 'Village', 'Category', 'Reg. Date']],
    body: custRows,
    ...bw,
    margin: { left: margin, right: margin, bottom: 14 }
  });

  currentY = (doc.lastAutoTable?.finalY || currentY + 30) + 8;
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  if (currentY > pageH - 45) {
    doc.addPage();
    currentY = 14;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 59, 140);
  doc.text(`2. Services Registry (${services.length} Records)`, margin, currentY);
  doc.setTextColor(0, 0, 0);
  currentY += 3.5;

  const srvTotal = services.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
  const srvPaid = services.reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
  const srvDue = services.reduce((s, r) => s + (Number(r.dueAmount) || 0), 0);

  const srvRows = services.length > 0
    ? services.slice(0, 40).map(s => [
        pdfSafeText(s.id),
        pdfSafeText(s.customerName),
        pdfSafeText(s.serviceName),
        pdfINR(s.totalAmount),
        pdfINR(s.paidAmount),
        pdfINR(s.dueAmount),
        pdfSafeText(s.status)
      ])
    : [['-', 'No services booked yet.', '-', pdfINR(0), pdfINR(0), pdfINR(0), '-']];

  applyAutoTable(doc, {
    startY: currentY,
    head: [['Service ID', 'Customer', 'Service Name', 'Total', 'Paid', 'Due', 'Status']],
    body: srvRows,
    foot: [['GRAND TOTAL', `${services.length} Services`, '', pdfINR(srvTotal), pdfINR(srvPaid), pdfINR(srvDue), '']],
    showFoot: 'lastPage',
    ...bw,
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin, bottom: 14 }
  });

  let sigY = (doc.lastAutoTable?.finalY || currentY + 25) + 8;
  if (sigY + 18 > pageH - 14) {
    doc.addPage();
    sigY = 16;
  }
  doc.setDrawColor(11, 59, 140);
  doc.line(pageW - margin - 58, sigY + 10, pageW - margin, sigY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(pdfSafeText(cfg.authorizedSignatory), pageW - margin, sigY + 14, { align: 'right' });

  finalizeBwPdfPagination(doc, `${cfg.companyName} · Master Database Export Report · ${rptId}`);
  if (typeof document !== 'undefined') {
    doc.save(`MUN_COMPUTER_All_Data_Master_Report_${getTodayDate()}.pdf`);
  }
  return true;
}

/**
 * Export Master Consolidated CSV of All Operational Records
 */
export function exportAllDataCSV() {
  const customers = getItem(KEYS.CUSTOMERS, []);
  const services = getItem(KEYS.SERVICES, []);
  const payments = getItem(KEYS.PAYMENTS, []);
  const expenses = getItem(KEYS.EXPENSES, []);
  const banking = getItem(KEYS.BANKING, []);

  const masterRows = [];
  let grandTotalAmount = 0;

  customers.forEach(c => {
    masterRows.push({
      Module: 'Customer',
      'Record ID': c.id,
      Date: c.regDate || '',
      Title: c.name,
      'Contact / Phone': c.phone,
      'Category / Type': c.category || 'General',
      'Amount (INR)': '',
      Status: 'Active',
      Notes: `${c.village || ''}, ${c.district || ''}`
    });
  });

  services.forEach(s => {
    const amt = Number(s.totalAmount) || 0;
    grandTotalAmount += amt;
    masterRows.push({
      Module: 'Service',
      'Record ID': s.id,
      Date: s.appDate || '',
      Title: s.serviceName,
      'Contact / Phone': s.phone || '',
      'Category / Type': s.category || '',
      'Amount (INR)': amt,
      Status: s.status || '',
      Notes: `Paid: Rs.${s.paidAmount || 0}, Due: Rs.${s.dueAmount || 0} (Customer: ${s.customerName})`
    });
  });

  payments.forEach(p => {
    const amt = Number(p.paymentAmount) || 0;
    grandTotalAmount += amt;
    masterRows.push({
      Module: 'Payment',
      'Record ID': p.id,
      Date: p.paymentDate || '',
      Title: `Payment from ${p.customerName}`,
      'Contact / Phone': '',
      'Category / Type': p.paymentMethod || 'Cash',
      'Amount (INR)': amt,
      Status: 'Received',
      Notes: p.remarks || ''
    });
  });

  expenses.forEach(e => {
    const amt = Number(e.amount) || 0;
    grandTotalAmount += amt;
    masterRows.push({
      Module: 'Expense',
      'Record ID': e.id,
      Date: e.date || '',
      Title: e.title,
      'Contact / Phone': e.vendorName || '',
      'Category / Type': e.category || 'Expense',
      'Amount (INR)': amt,
      Status: 'Paid',
      Notes: e.remarks || ''
    });
  });

  banking.forEach(b => {
    const amt = Number(b.amount) || 0;
    grandTotalAmount += amt;
    masterRows.push({
      Module: 'Banking_CSP',
      'Record ID': b.id,
      Date: b.date || '',
      Title: b.type,
      'Contact / Phone': b.customerPhone || '',
      'Category / Type': b.bank,
      'Amount (INR)': amt,
      Status: b.status || '',
      Notes: `RRN: ${b.rrn || ''}, Commission: Rs.${b.commission || 0} (${b.customerName})`
    });
  });

  return downloadCSV('MUN_COMPUTER_All_Data_Master', masterRows, [
    { key: 'Module', label: 'Module / Table' },
    { key: 'Record ID', label: 'Record ID' },
    { key: 'Date', label: 'Date' },
    { key: 'Title', label: 'Title / Name' },
    { key: 'Contact / Phone', label: 'Mobile / Phone' },
    { key: 'Category / Type', label: 'Category / Bank' },
    { key: 'Amount (INR)', label: 'Amount (INR)' },
    { key: 'Status', label: 'Status' },
    { key: 'Notes', label: 'Details & Remarks' }
  ], {
    title: 'MASTER BUSINESS DATABASE EXPORT',
    statusLabel: 'MASTER EXPORT',
    totalsRow: ['GRAND TOTAL', `${masterRows.length} Records`, '', '', '', '', grandTotalAmount, 'VERIFIED', 'Consolidated across all modules'],
    emptyNote: 'Database is clean — no operational records logged yet.'
  });
}
