/**
 * extraHandlers.js - Enterprise Interactive Controllers & Modals for MUN COMPUTER ERP
 * Handles PNB CSP Banking, Inventory, Smart PVC Card Studio, Daybook, Payroll, and WhatsApp
 */

import {
  formatINR,
  formatDate,
  formatDateTime,
  getTodayDate,
  getItem,
  KEYS,
  numberToWords,
  syncAmountWords
} from './storage.js';

import {
  getAllBankingTransactions,
  saveBankingTransaction,
  deleteBankingTransaction,
  getAllBankingTypes,
  getCustomBankingServices,
  saveCustomBankingService,
  deleteCustomBankingService,
  getAllBankPartners,
  addCustomBankPartner,
  getCustomBankingServiceByName,
  calculateCommission
} from './banking.js';
import { showA4PrintPdfPopup } from './a4PrintPopup.js';
import { renderBwDocumentHeader } from './documentEngine.js';

import {
  getAllInventory,
  saveInventoryItem,
  deleteInventoryItem,
  adjustStock,
  getInventoryCategories,
  getInventoryCategoryRecords,
  addInventoryCategory,
  deleteInventoryCategory,
  restoreDefaultGasCategories,
  syncInventoryCategoriesFromBackend
} from './inventory.js';

import {
  DENOMINATION_SPEC,
  calculateDayTally,
  getAllDaybookEntries,
  saveDaybookEntry
} from './daybook.js';

import {
  getAllAttendance,
  getPayrollSummary,
  recordAttendance
} from './payroll.js';
import {
  exportUniversalCSV,
  exportUniversalExcel,
  exportUniversalPDF,
  printUniversalReport
} from './exportUtility.js';

import { getAllCustomers, saveCustomer } from './customers.js';
import {
  saveService,
  saveServiceBatch,
  findOpenReceiptForCustomerDate,
  getReceiptSummary
} from './services.js';
import { recordPayment } from './payments.js';

export function setupExtraHandlers(MJK, showToast, openModal, render, closeModal, showConfirmDialog) {
  const safeConfirm = (title, message, onConfirm) => {
    if (typeof showConfirmDialog === 'function') {
      showConfirmDialog(title, message, onConfirm);
    } else {
      onConfirm();
    }
  };

  /* --- 1. WhatsApp Click-to-Chat Helper --- */
  MJK.openWhatsApp = (phone, text) => {
    if (!phone) {
      showToast('Customer phone number not available.', 'warning');
      return;
    }
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* --- 2. PNB CSP Banking Handlers (Including Custom Banking Services & Partners) --- */
  MJK.openBankingTxnModal = (id = null) => {
    const existing = id ? getAllBankingTransactions().find(t => t.id === id) : null;
    const allTypes = getAllBankingTypes();
    const allBanks = getAllBankPartners();
    const initialType = existing ? existing.type : (allTypes[0] || 'AePS Cash Withdrawal');
    const customRule = getCustomBankingServiceByName(initialType);
    const initialAmount = existing ? existing.amount : 1000;
    const initialComm = existing ? existing.commission : calculateCommission(initialType, initialAmount);
    const initialFee = existing ? (existing.feeCharged || 0) : (customRule?.defaultFee || 0);

    const content = `
      <form id="banking-txn-form" onsubmit="window.MJK.handleSaveBankingTxn(event)">
        <input type="hidden" id="bank-txn-id" value="${existing ? existing.id : ''}">
        
        <div class="form-row">
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem; margin-bottom:0.35rem;">
              <label class="form-label" style="margin:0;">Transaction Type *</label>
              <button type="button" class="btn btn-outline btn-sm" style="padding:0.15rem 0.45rem; font-size:0.7rem;" onclick="window.MJK.openCustomBankingServiceModal(null, true)">+ Custom Service</button>
            </div>
            <select id="bank-txn-type" class="form-control" required onchange="window.MJK.onBankTxnTypeChange()">
              ${allTypes.map(t => `
                <option value="${t}" ${initialType === t ? 'selected' : ''}>${t}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem; margin-bottom:0.35rem;">
              <label class="form-label" style="margin:0;">Bank Partner *</label>
              <button type="button" class="btn btn-outline btn-sm" style="padding:0.15rem 0.45rem; font-size:0.7rem;" onclick="window.MJK.openCustomBankPartnerModal(true)">+ Bank</button>
            </div>
            <select id="bank-partner" class="form-control" required>
              ${allBanks.map(b => `
                <option value="${b}" ${(existing?.bank || customRule?.defaultBank || 'Punjab National Bank (PNB CSP)') === b ? 'selected' : ''}>${b}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Customer Name *</label>
            <input type="text" id="bank-cust-name" class="form-control" required value="${existing ? existing.customerName : ''}" placeholder="e.g. Subrata Mukherjee">
          </div>
          <div class="form-group">
            <label class="form-label">Customer Mobile</label>
            <input type="tel" id="bank-cust-phone" class="form-control" value="${existing ? existing.customerPhone : ''}" placeholder="10-digit mobile number">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Transaction Amount (₹) *</label>
            <input type="number" id="bank-amount" class="form-control font-mono" required min="0" step="1" value="${initialAmount}" oninput="window.MJK.onBankAmountChange()">
            <div id="bank-amount-words" class="amount-words-hint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">BC Commission (₹)</label>
            <input type="number" id="bank-commission" class="form-control font-mono" min="0" step="1" value="${initialComm}" oninput="window.MJK.syncAmountWords(this, 'bank-commission-words')">
            <div id="bank-commission-words" class="amount-words-hint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Customer Service Fee (₹)</label>
            <input type="number" id="bank-fee" class="form-control font-mono" min="0" step="1" value="${initialFee}" oninput="window.MJK.syncAmountWords(this, 'bank-fee-words')">
            <div id="bank-fee-words" class="amount-words-hint"></div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Aadhaar (Last 4 Digits) / A/c No.</label>
            <input type="text" id="bank-aadhaar-last4" class="form-control" maxlength="16" value="${existing ? existing.aadhaarLast4 || existing.accountNumber : ''}" placeholder="e.g. 3819">
          </div>
          <div class="form-group">
            <label class="form-label">RRN / Reference No.</label>
            <input type="text" id="bank-rrn" class="form-control font-mono" value="${existing ? (existing.rrn || '') : ''}" placeholder="Bank RRN / UPI Ref (Optional)">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Remarks / Purpose</label>
          <input type="text" id="bank-remarks" class="form-control" value="${existing ? existing.remarks : 'PNB CSP Counter Transaction'}" placeholder="e.g. Pension withdrawal, KCC deposit, PM-Kisan">
        </div>

        <div style="margin-top:1.25rem; display:flex; justify-content:flex-end; gap:0.75rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save & Record Transaction</button>
        </div>
      </form>
    `;

    openModal(existing ? 'Edit PNB Transaction' : '+ Record PNB CSP Transaction', content, null);
    setTimeout(() => {
      syncAmountWords(document.getElementById('bank-amount'), 'bank-amount-words');
      syncAmountWords(document.getElementById('bank-commission'), 'bank-commission-words');
      syncAmountWords(document.getElementById('bank-fee'), 'bank-fee-words');
    }, 10);
  };

  MJK.onBankAmountChange = () => {
    const type = document.getElementById('bank-txn-type')?.value;
    const amtInput = document.getElementById('bank-amount');
    const amt = amtInput?.value;
    const commInput = document.getElementById('bank-commission');
    if (commInput && type) {
      commInput.value = calculateCommission(type, amt);
      syncAmountWords(commInput, 'bank-commission-words');
    }
    syncAmountWords(amtInput, 'bank-amount-words');
  };

  MJK.onBankTxnTypeChange = () => {
    const type = document.getElementById('bank-txn-type')?.value;
    const rule = getCustomBankingServiceByName(type);
    if (rule) {
      const bankSel = document.getElementById('bank-partner');
      const feeInput = document.getElementById('bank-fee');
      if (bankSel && rule.defaultBank) bankSel.value = rule.defaultBank;
      if (feeInput) {
        feeInput.value = rule.defaultFee || 0;
        syncAmountWords(feeInput, 'bank-fee-words');
      }
    }
    MJK.onBankAmountChange();
  };

  MJK.handleSaveBankingTxn = async (e) => {
    e.preventDefault();
    try {
      const id = document.getElementById('bank-txn-id')?.value;
      const type = document.getElementById('bank-txn-type')?.value;
      const bank = document.getElementById('bank-partner')?.value;
      const customerName = document.getElementById('bank-cust-name')?.value;
      const customerPhone = document.getElementById('bank-cust-phone')?.value;
      const amount = Number(document.getElementById('bank-amount')?.value) || 0;
      const commission = Number(document.getElementById('bank-commission')?.value) || 0;
      const feeCharged = Number(document.getElementById('bank-fee')?.value) || 0;
      const aadhaarLast4 = document.getElementById('bank-aadhaar-last4')?.value;
      const rrn = document.getElementById('bank-rrn')?.value;
      const remarks = document.getElementById('bank-remarks')?.value;

      const res = await saveBankingTransaction({
        id: id || undefined,
        type,
        bank,
        customerName,
        customerPhone,
        amount,
        commission,
        feeCharged,
        aadhaarLast4,
        rrn,
        remarks,
        date: getTodayDate()
      });

      if (res?.success) {
        showToast(`PNB CSP transaction of ₹${amount} saved successfully!`, 'success');
        if (typeof closeModal === 'function') closeModal(); else MJK.closeModal();
        render();
      } else {
        showToast(res?.message || 'Could not save banking transaction.', 'danger');
      }
    } catch (err) {
      showToast(err?.message || 'Failed to save banking transaction.', 'danger');
    }
  };

  MJK.deleteBankingTxn = (id) => {
    safeConfirm(
      'Delete Banking Transaction?',
      'Are you sure you want to delete this PNB CSP transaction record?',
      () => {
        deleteBankingTransaction(id);
        showToast('Banking record deleted', 'info');
        render();
      }
    );
  };

  MJK.openCustomBankingServiceModal = (editId = null, returnToTxn = false) => {
    const existing = editId ? getCustomBankingServices().find(s => s.id === editId) : null;
    const banks = getAllBankPartners();
    const isPercent = existing?.commissionType === 'percent';

    const content = `
      <form onsubmit="window.MJK.handleSaveCustomBankingService(event, '${editId || ''}', ${Boolean(returnToTxn)})">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Custom Banking Service Name *</label>
            <input type="text" id="cbk-name" class="form-control" required value="${existing ? existing.name : ''}" placeholder="e.g. Aadhaar Pay, Loan EMI Collection, Fastag Recharge">
          </div>
          <div class="form-group">
            <label class="form-label">Bengali Name (Optional)</label>
            <input type="text" id="cbk-name-bn" class="form-control" value="${existing ? (existing.nameBn || '') : ''}" placeholder="e.g. আধার পে / লোন কিস্তি">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Default Bank Partner</label>
            <select id="cbk-bank" class="form-control">
              ${banks.map(b => `<option value="${b}" ${(existing?.defaultBank || banks[0]) === b ? 'selected' : ''}>${b}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Counter Cash Flow Direction *</label>
            <select id="cbk-flow" class="form-control" required>
              <option value="neutral" ${(!existing || existing.cashFlowDirection === 'neutral') ? 'selected' : ''}>Neutral (Transfer / Enquiry / Policy)</option>
              <option value="in" ${existing?.cashFlowDirection === 'in' ? 'selected' : ''}>Cash In (+) Deposit / Collection</option>
              <option value="out" ${existing?.cashFlowDirection === 'out' ? 'selected' : ''}>Cash Out (-) Cash Paid to Customer</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Commission Rule Type</label>
            <select id="cbk-comm-type" class="form-control" onchange="window.MJK.onCustomBankCommTypeChange()">
              <option value="flat" ${!isPercent ? 'selected' : ''}>Flat Fixed Amount (₹)</option>
              <option value="percent" ${isPercent ? 'selected' : ''}>Percentage of Txn Amount (%)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" id="cbk-comm-val-label">${isPercent ? 'Commission Percentage (%)' : 'Commission Amount (₹)'}</label>
            <input type="number" id="cbk-comm-val" class="form-control font-mono" min="0" step="0.01" value="${existing ? existing.commissionValue : 10}" oninput="window.MJK.syncCustomBankingWords()">
            <div id="cbk-comm-val-words" class="amount-words-hint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Default Customer Fee (₹)</label>
            <input type="number" id="cbk-fee" class="form-control font-mono" min="0" step="1" value="${existing ? (existing.defaultFee || 0) : 0}" oninput="window.MJK.syncAmountWords(this, 'cbk-fee-words')">
            <div id="cbk-fee-words" class="amount-words-hint"></div>
          </div>
        </div>

        <div id="cbk-cap-row" class="form-row" style="display:${isPercent ? 'grid' : 'none'};">
          <div class="form-group">
            <label class="form-label">Min Commission Cap (₹)</label>
            <input type="number" id="cbk-min-comm" class="form-control font-mono" min="0" value="${existing ? (existing.minCommission || 0) : 5}" oninput="window.MJK.syncAmountWords(this, 'cbk-min-comm-words')">
            <div id="cbk-min-comm-words" class="amount-words-hint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Max Commission Cap (₹, 0 = no limit)</label>
            <input type="number" id="cbk-max-comm" class="form-control font-mono" min="0" value="${existing ? (existing.maxCommission || 0) : 25}" oninput="window.MJK.syncAmountWords(this, 'cbk-max-comm-words')">
            <div id="cbk-max-comm-words" class="amount-words-hint"></div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Remarks / Rule Notes</label>
          <input type="text" id="cbk-remarks" class="form-control" value="${existing ? (existing.remarks || '') : ''}" placeholder="Optional terms or guidelines">
        </div>

        <div style="margin-top:1.25rem; display:flex; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Update Banking Service' : 'Save Custom Banking Service'}</button>
        </div>
      </form>
    `;

    openModal(existing ? `Edit Custom Banking Service: ${existing.name}` : '+ Add Custom Banking Service', content, null);
    setTimeout(() => MJK.syncCustomBankingWords(), 10);
  };

  MJK.syncCustomBankingWords = () => {
    const type = document.getElementById('cbk-comm-type')?.value;
    const commValWords = document.getElementById('cbk-comm-val-words');
    if (type === 'percent') {
      if (commValWords) {
        commValWords.textContent = '';
        commValWords.style.display = 'none';
      }
    } else {
      syncAmountWords(document.getElementById('cbk-comm-val'), 'cbk-comm-val-words');
    }
    syncAmountWords(document.getElementById('cbk-fee'), 'cbk-fee-words');
    syncAmountWords(document.getElementById('cbk-min-comm'), 'cbk-min-comm-words');
    syncAmountWords(document.getElementById('cbk-max-comm'), 'cbk-max-comm-words');
  };

  MJK.onCustomBankCommTypeChange = () => {
    const type = document.getElementById('cbk-comm-type')?.value;
    const lbl = document.getElementById('cbk-comm-val-label');
    const capRow = document.getElementById('cbk-cap-row');
    if (lbl) lbl.textContent = type === 'percent' ? 'Commission Percentage (%)' : 'Commission Amount (₹)';
    if (capRow) capRow.style.display = type === 'percent' ? 'grid' : 'none';
    MJK.syncCustomBankingWords();
  };

  MJK.handleSaveCustomBankingService = async (e, editId = '', returnToTxn = false) => {
    e.preventDefault();
    try {
      const res = await saveCustomBankingService({
        id: editId || undefined,
        name: document.getElementById('cbk-name')?.value,
        nameBn: document.getElementById('cbk-name-bn')?.value,
        defaultBank: document.getElementById('cbk-bank')?.value,
        cashFlowDirection: document.getElementById('cbk-flow')?.value,
        commissionType: document.getElementById('cbk-comm-type')?.value,
        commissionValue: document.getElementById('cbk-comm-val')?.value,
        minCommission: document.getElementById('cbk-min-comm')?.value,
        maxCommission: document.getElementById('cbk-max-comm')?.value,
        defaultFee: document.getElementById('cbk-fee')?.value,
        remarks: document.getElementById('cbk-remarks')?.value
      });

      if (!res?.success) {
        showToast(res?.message || 'Could not save custom banking service.', 'warning');
        return;
      }

      if (typeof closeModal === 'function') closeModal(); else MJK.closeModal();
      showToast(`Saved custom banking service "${res.service.name}"!`, 'success');
      if (returnToTxn) {
        setTimeout(() => MJK.openBankingTxnModal(), 120);
      } else {
        render();
      }
    } catch (err) {
      showToast(err?.message || 'Failed to save custom banking service.', 'danger');
    }
  };

  MJK.promptDeleteCustomBankingService = (id) => {
    safeConfirm(
      'Remove Custom Banking Service?',
      'Existing recorded transactions will remain safe in your history. Remove this custom service template?',
      () => {
        deleteCustomBankingService(id);
        showToast('Custom banking service removed.', 'info');
        render();
      }
    );
  };

  MJK.openCustomBankPartnerModal = (returnToTxn = false) => {
    const content = `
      <form onsubmit="window.MJK.handleSaveCustomBankPartner(event, ${Boolean(returnToTxn)})">
        <div class="form-group">
          <label class="form-label">New Bank / CSP Partner Name *</label>
          <input type="text" id="cbp-name" class="form-control" required placeholder="e.g. HDFC Bank CSP / UCO Bank / India Post Payments Bank">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Bank Partner</button>
        </div>
      </form>
    `;
    openModal('+ Add Custom Bank Partner', content, null);
  };

  MJK.handleSaveCustomBankPartner = (e, returnToTxn = false) => {
    e.preventDefault();
    const bankName = document.getElementById('cbp-name')?.value;
    const res = addCustomBankPartner(bankName);
    if (!res.success) {
      showToast(res.message || 'Enter bank name.', 'warning');
      return;
    }
    if (typeof closeModal === 'function') closeModal(); else MJK.closeModal();
    showToast(`Added bank partner "${res.bank}"!`, 'success');
    if (returnToTxn) {
      setTimeout(() => MJK.openBankingTxnModal(), 120);
    } else {
      render();
    }
  };

  MJK.filterBankingTable = (q) => {
    const val = (q || '').toLowerCase();
    const rows = document.querySelectorAll('#banking-data-table tbody tr');
    rows.forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(val) ? '' : 'none';
    });
  };

  MJK.printBankingSlip = (id) => {
    const t = getAllBankingTransactions().find(item => item.id === id);
    if (!t) return;

    const slipHtml = `
      <div class="mun-bw-doc" style="max-width:560px; margin:0 auto; padding:1rem; border:1.5px solid #000000;">
        ${renderBwDocumentHeader({
          docTitle: 'PUNJAB NATIONAL BANK — CSP TRANSACTION RECEIPT',
          docNumber: t.id,
          docDateTime: `${formatDate(t.date)} ${t.time || ''}`.trim(),
          statusText: 'SUCCESS',
          serviceRefNumber: t.rrn || '',
          extraRightLines: ['BC Agent ID: PNB-742406-01']
        })}

        <div style="font-size:0.82rem; line-height:1.6; margin-bottom:12px;">
          <div><strong>Receipt ID:</strong> ${escInv(t.id)}</div>
          <div><strong>RRN / UTR:</strong> ${escInv(t.rrn)}</div>
          <div><strong>Date &amp; Time:</strong> ${formatDate(t.date)} ${escInv(t.time || '')}</div>
          <div><strong>Bank:</strong> ${escInv(t.bank)}</div>
          <div><strong>Customer Name:</strong> ${escInv(t.customerName)}</div>
          ${t.customerPhone ? `<div><strong>Mobile:</strong> ${escInv(t.customerPhone)}</div>` : ''}
          ${t.aadhaarLast4 ? `<div><strong>Aadhaar / A/c:</strong> **** ${escInv(t.aadhaarLast4)}</div>` : ''}
          <div class="a4-avoid-break" style="margin-top:8px; padding:6px 0; border-top:1px dashed #000000; border-bottom:1px dashed #000000;">
            <div><strong>Transaction Type:</strong> ${escInv(t.type)}</div>
            <div style="font-size:1.15rem; font-weight:900;">Amount: ${formatINR(t.amount)}</div>
            <div style="font-size:0.74rem; font-weight:700;">In Words: ${escInv(numberToWords(t.amount))}</div>
            <div><strong>Status:</strong> <span style="font-weight:700;">SUCCESS</span></div>
          </div>
          <div><strong>Remarks:</strong> ${escInv(t.remarks || 'Customer transaction verified')}</div>
        </div>

        <div style="margin-top:20px; display:flex; justify-content:space-between; font-size:0.75rem;">
          <div>Customer Signature<br><br>___________________</div>
          <div style="text-align:right;">BC Seal &amp; Signature<br><br><strong>MUN COMPUTER</strong></div>
        </div>

        <div style="text-align:center; margin-top:14px; font-size:0.68rem; border-top:1px solid #000000; padding-top:6px;">
          Thank you for banking with Punjab National Bank &amp; MUN COMPUTER
        </div>
      </div>
    `;

    showA4PrintPdfPopup({
      title: `Official PNB CSP Customer Slip - ${t.id}`,
      subtitle: `${t.customerName} · ${t.type} · ${formatINR(t.amount)}`,
      bodyHtml: slipHtml,
      defaultFormat: 'a5-receipt',
      pdfConfig: {
        filename: `MUN_Banking_Slip_${t.id}`,
        reportTitle: 'PUNJAB NATIONAL BANK - CSP TRANSACTION RECEIPT',
        metaLine: `Receipt: ${t.id} | RRN: ${t.rrn} | Date: ${formatDate(t.date)}`,
        headers: ['Field', 'Value'],
        rows: [
          ['Customer Name', t.customerName],
          ['Mobile', t.customerPhone || '-'],
          ['Bank Partner', t.bank],
          ['Transaction Type', t.type],
          ['Amount', `Rs.${t.amount}`],
          ['Amount in Words', numberToWords(t.amount)],
          ['Status', 'SUCCESS'],
          ['Remarks', t.remarks || 'Customer transaction verified']
        ]
      }
    });
  };

  const buildBankingReportSpec = () => {
    const txns = getAllBankingTransactions();
    const totalAmt = txns.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalComm = txns.reduce((s, t) => s + (Number(t.commission) || 0), 0);
    const headers = ['Date', 'Time', 'Txn / RRN', 'Customer Name', 'Mobile', 'Transaction Type', 'Bank Partner', 'Amount (INR)', 'Commission (INR)', 'Status'];
    const rows = txns.map(t => [
      formatDate(t.date),
      t.time || '-',
      t.rrn || t.id,
      t.customerName || '-',
      t.customerPhone || (t.aadhaarLast4 ? `**** ${t.aadhaarLast4}` : '-'),
      t.type || '-',
      t.bank || '-',
      Number(t.amount) || 0,
      Number(t.commission) || 0,
      t.status || 'Success'
    ]);
    const totalsRow = ['GRAND TOTAL', '', `${txns.length} Txns`, '', '', '', '', totalAmt, totalComm, 'VERIFIED'];
    return { txns, totalAmt, totalComm, headers, rows, totalsRow };
  };

  MJK.printBankingRegister = () => {
    const { txns, totalAmt, totalComm, headers, rows, totalsRow } = buildBankingReportSpec();
    printUniversalReport({
      title: 'PNB CSP BANKING & AEPS TRANSACTION REGISTER',
      filename: 'MUN_COMPUTER_Banking_CSP_Report',
      statusLabel: 'VERIFIED REGISTER',
      subtitle: `Total Transactions: ${txns.length} | Gross Volume: ${formatINR(totalAmt)} | Commission Earned: ${formatINR(totalComm)}`,
      headers,
      rows: rows.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[6], formatINR(r[7]), formatINR(r[8]), r[9]]),
      totalsRow: ['GRAND TOTAL', '', `${txns.length} Txns`, '', '', '', '', formatINR(totalAmt), formatINR(totalComm), 'VERIFIED'],
      summaryCards: [
        { label: 'Total Transactions', value: String(txns.length) },
        { label: 'Gross Volume', value: formatINR(totalAmt) },
        { label: 'CSP Commission', value: formatINR(totalComm) }
      ],
      orientation: 'landscape'
    });
  };

  MJK.exportBankingPDF = () => {
    const { txns, totalAmt, totalComm, headers, rows } = buildBankingReportSpec();
    exportUniversalPDF({
      filename: 'MUN_COMPUTER_Banking_CSP_Report',
      title: 'PNB CSP BANKING & AEPS TRANSACTION REGISTER',
      statusLabel: 'VERIFIED REGISTER',
      subtitle: `Total Transactions: ${txns.length}`,
      headers,
      rows: rows.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[6], `Rs.${r[7]}`, `Rs.${r[8]}`, r[9]]),
      totalsRow: ['GRAND TOTAL', '', `${txns.length} Txns`, '', '', '', '', `Rs.${totalAmt}`, `Rs.${totalComm}`, 'VERIFIED'],
      summaryCards: [
        { label: 'Total Transactions', value: String(txns.length) },
        { label: 'Gross Volume', value: `Rs.${totalAmt}` },
        { label: 'CSP Commission', value: `Rs.${totalComm}` }
      ],
      orientation: 'landscape'
    });
    showToast('Banking CSP Report PDF downloaded!', 'success');
  };

  MJK.exportBankingExcel = () => {
    const { headers, rows, totalsRow } = buildBankingReportSpec();
    exportUniversalExcel({
      filename: 'MUN_COMPUTER_Banking_CSP_Report',
      sheetName: 'Banking_CSP_Register',
      title: 'PNB CSP BANKING & AEPS TRANSACTION REGISTER',
      statusLabel: 'VERIFIED REGISTER',
      headers,
      rows,
      totalsRow
    });
    showToast('Banking CSP Excel (.xlsx) downloaded!', 'success');
  };

  MJK.exportBankingCSV = () => {
    const { headers, rows, totalsRow } = buildBankingReportSpec();
    exportUniversalCSV({
      filename: 'MUN_COMPUTER_Banking_CSP_Report',
      title: 'PNB CSP BANKING & AEPS TRANSACTION REGISTER',
      statusLabel: 'VERIFIED REGISTER',
      headers,
      rows,
      totalsRow
    });
    showToast('Banking CSP CSV downloaded (UTF-8 BOM)!', 'success');
  };

  const buildInventoryReportSpec = () => {
    const items = getAllInventory();
    const totalQty = items.reduce((s, i) => s + (Number(i.stockQuantity) || 0), 0);
    const totalCostVal = items.reduce((s, i) => s + ((Number(i.stockQuantity) || 0) * (Number(i.costPrice) || 0)), 0);
    const totalRetailVal = items.reduce((s, i) => s + ((Number(i.stockQuantity) || 0) * (Number(i.sellingPrice) || 0)), 0);
    const headers = ['SKU / Code', 'Product Name', 'Category', 'Supplier', 'Stock Qty', 'Min Stock', 'Cost Price (INR)', 'Selling Price (INR)', 'Stock Value (Cost)', 'Status'];
    const rows = items.map(i => {
      const qty = Number(i.stockQuantity) || 0;
      const cost = Number(i.costPrice) || 0;
      const min = Number(i.minStockLevel) || 5;
      return [
        i.sku || i.id,
        i.name || '-',
        i.category || '-',
        i.supplier || 'Counter Stock',
        qty,
        min,
        cost,
        Number(i.sellingPrice) || 0,
        qty * cost,
        qty <= min ? 'Low Stock' : 'In Stock'
      ];
    });
    const totalsRow = ['GRAND TOTAL', `${items.length} SKUs`, '', '', totalQty, '', '', totalRetailVal, totalCostVal, 'STOCK REPORT'];
    return { items, totalQty, totalCostVal, totalRetailVal, headers, rows, totalsRow };
  };

  MJK.printInventoryReport = () => {
    const { items, totalQty, totalCostVal, totalRetailVal, headers, rows } = buildInventoryReportSpec();
    printUniversalReport({
      title: 'INVENTORY & STOCK VALUATION REPORT',
      filename: 'MUN_COMPUTER_Inventory_Stock_Report',
      statusLabel: 'STOCK AUDIT',
      subtitle: `Total SKUs: ${items.length} | Total Units: ${totalQty}`,
      headers,
      rows: rows.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], formatINR(r[6]), formatINR(r[7]), formatINR(r[8]), r[9]]),
      totalsRow: ['GRAND TOTAL', `${items.length} SKUs`, '', '', totalQty, '', '', formatINR(totalRetailVal), formatINR(totalCostVal), 'VERIFIED'],
      summaryCards: [
        { label: 'Total SKUs', value: String(items.length) },
        { label: 'Total Units', value: String(totalQty) },
        { label: 'Cost Valuation', value: formatINR(totalCostVal) },
        { label: 'Retail Valuation', value: formatINR(totalRetailVal) }
      ],
      orientation: 'landscape'
    });
  };

  MJK.exportInventoryPDF = () => {
    const { items, totalQty, totalCostVal, totalRetailVal, headers, rows } = buildInventoryReportSpec();
    exportUniversalPDF({
      filename: 'MUN_COMPUTER_Inventory_Stock_Report',
      title: 'INVENTORY & STOCK VALUATION REPORT',
      statusLabel: 'STOCK AUDIT',
      subtitle: `Total SKUs: ${items.length} | Total Units: ${totalQty}`,
      headers,
      rows: rows.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], `Rs.${r[6]}`, `Rs.${r[7]}`, `Rs.${r[8]}`, r[9]]),
      totalsRow: ['GRAND TOTAL', `${items.length} SKUs`, '', '', totalQty, '', '', `Rs.${totalRetailVal}`, `Rs.${totalCostVal}`, 'VERIFIED'],
      summaryCards: [
        { label: 'Total SKUs', value: String(items.length) },
        { label: 'Total Units', value: String(totalQty) },
        { label: 'Cost Valuation', value: `Rs.${totalCostVal}` },
        { label: 'Retail Valuation', value: `Rs.${totalRetailVal}` }
      ],
      orientation: 'landscape'
    });
    showToast('Inventory & Stock PDF downloaded!', 'success');
  };

  MJK.exportInventoryExcel = () => {
    const { headers, rows, totalsRow } = buildInventoryReportSpec();
    exportUniversalExcel({
      filename: 'MUN_COMPUTER_Inventory_Stock_Report',
      sheetName: 'Inventory_Stock',
      title: 'INVENTORY & STOCK VALUATION REPORT',
      statusLabel: 'STOCK AUDIT',
      headers,
      rows,
      totalsRow
    });
    showToast('Inventory Stock Excel (.xlsx) downloaded!', 'success');
  };

  MJK.exportInventoryCSV = () => {
    const { headers, rows, totalsRow } = buildInventoryReportSpec();
    exportUniversalCSV({
      filename: 'MUN_COMPUTER_Inventory_Stock_Report',
      title: 'INVENTORY & STOCK VALUATION REPORT',
      statusLabel: 'STOCK AUDIT',
      headers,
      rows,
      totalsRow
    });
    showToast('Inventory Stock CSV downloaded (UTF-8 BOM)!', 'success');
  };

  const buildSupplierReportSpec = () => {
    const items = getAllInventory();
    const expenses = getItem(KEYS.EXPENSES, []).filter(e => String(e.vendorName || '').trim());
    const map = new Map();
    items.forEach(i => {
      const sup = String(i.supplier || 'Counter / Direct Purchase').trim();
      if (!map.has(sup)) map.set(sup, { supplier: sup, skuCount: 0, stockUnits: 0, stockCost: 0, expenseBills: 0, expensePaid: 0 });
      const rec = map.get(sup);
      rec.skuCount += 1;
      rec.stockUnits += Number(i.stockQuantity) || 0;
      rec.stockCost += (Number(i.stockQuantity) || 0) * (Number(i.costPrice) || 0);
    });
    expenses.forEach(e => {
      const sup = String(e.vendorName || '').trim();
      if (!map.has(sup)) map.set(sup, { supplier: sup, skuCount: 0, stockUnits: 0, stockCost: 0, expenseBills: 0, expensePaid: 0 });
      const rec = map.get(sup);
      rec.expenseBills += 1;
      rec.expensePaid += Number(e.amount) || 0;
    });
    const list = Array.from(map.values());
    const totalStockCost = list.reduce((s, r) => s + r.stockCost, 0);
    const totalPaid = list.reduce((s, r) => s + r.expensePaid, 0);
    const headers = ['Supplier / Vendor Name', 'Products Supplied', 'Current Stock Units', 'Inventory Cost Value (INR)', 'Purchase Vouchers', 'Total Paid (INR)'];
    const rows = list.map(r => [r.supplier, r.skuCount, r.stockUnits, r.stockCost, r.expenseBills, r.expensePaid]);
    const totalsRow = ['GRAND TOTAL', list.reduce((s, r) => s + r.skuCount, 0), list.reduce((s, r) => s + r.stockUnits, 0), totalStockCost, list.reduce((s, r) => s + r.expenseBills, 0), totalPaid];
    return { list, headers, rows, totalsRow, totalStockCost, totalPaid };
  };

  MJK.exportSupplierReportPDF = () => {
    const { list, headers, rows, totalStockCost, totalPaid } = buildSupplierReportSpec();
    exportUniversalPDF({
      filename: 'MUN_COMPUTER_Suppliers_Report',
      title: 'SUPPLIER & VENDOR PROCUREMENT REPORT',
      statusLabel: 'VERIFIED SUPPLIERS',
      subtitle: `Total Suppliers / Vendors: ${list.length}`,
      headers,
      rows: rows.map(r => [r[0], r[1], r[2], `Rs.${r[3]}`, r[4], `Rs.${r[5]}`]),
      totalsRow: ['GRAND TOTAL', list.reduce((s, r) => s + r.skuCount, 0), list.reduce((s, r) => s + r.stockUnits, 0), `Rs.${totalStockCost}`, list.reduce((s, r) => s + r.expenseBills, 0), `Rs.${totalPaid}`],
      orientation: 'portrait'
    });
    showToast('Suppliers Report PDF downloaded!', 'success');
  };

  MJK.exportSupplierReportExcel = () => {
    const { headers, rows, totalsRow } = buildSupplierReportSpec();
    exportUniversalExcel({
      filename: 'MUN_COMPUTER_Suppliers_Report',
      sheetName: 'Suppliers_Vendors',
      title: 'SUPPLIER & VENDOR PROCUREMENT REPORT',
      statusLabel: 'VERIFIED SUPPLIERS',
      headers,
      rows,
      totalsRow
    });
    showToast('Suppliers Report Excel (.xlsx) downloaded!', 'success');
  };

  /* --- 3. Retail & Gas Accessories Inventory Handlers --- */
  const escInv = (v) => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const renderInlineCategoryManageList = () => {
    const records = getInventoryCategoryRecords();
    const items = getAllInventory();
    const customCats = records.filter(r => !r.isDefault);
    const defaultCats = records.filter(r => r.isDefault);

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
        <span style="font-size:0.78rem; font-weight:700; color:var(--text-main);">Manage Saved Categories (${records.length})</span>
        <button type="button" class="btn btn-outline btn-sm" style="padding:0.2rem 0.55rem; font-size:0.72rem;" onclick="window.MJK.openInventoryCategoryManagerModal()">Open Full Category Manager</button>
      </div>
      ${customCats.length === 0 ? `
        <div style="font-size:0.75rem; color:var(--text-muted); padding:0.45rem 0; border-top:1px solid var(--border-subtle);">
          No custom categories yet. Default gas categories (${defaultCats.length}) are active.
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:0.3rem; max-height:150px; overflow-y:auto; border-top:1px solid var(--border-subtle); padding-top:0.45rem;">
          ${customCats.map(cat => {
            const usageCount = items.filter(p => String(p.category || '').toLowerCase() === cat.name.toLowerCase()).length;
            return `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; padding:0.35rem 0.55rem; background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); font-size:0.78rem;">
                <div style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  <strong>${escInv(cat.name)}</strong>
                  <span style="font-size:0.7rem; color:var(--text-muted); margin-left:0.35rem;">· Custom · ${usageCount} product${usageCount === 1 ? '' : 's'}</span>
                </div>
                <button type="button" class="btn btn-outline btn-sm" style="padding:0.18rem 0.45rem; font-size:0.74rem; color:var(--danger); border-color:var(--danger); flex-shrink:0;" onclick="window.MJK.deleteCategoryFromProductModal('${escInv(cat.id)}')" title="Delete custom category">🗑️</button>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  };

  MJK.refreshInventoryCategoryFilterOptions = () => {
    const filterSel = document.getElementById('inventory-category-filter');
    if (filterSel) {
      const prevVal = filterSel.value;
      const cats = getInventoryCategories();
      filterSel.innerHTML = `<option value="">All Categories (${cats.length})</option>` +
        cats.map(c => `<option value="${escInv(c)}" ${prevVal === c ? 'selected' : ''}>${escInv(c)}</option>`).join('');
    }
  };

  MJK.refreshProductModalCategoryOptions = (selectedCategory = '') => {
    const sel = document.getElementById('inv-category');
    if (sel) {
      const cats = getInventoryCategories(selectedCategory && selectedCategory !== '__ADD_CUSTOM__' ? selectedCategory : '');
      const targetVal = selectedCategory && selectedCategory !== '__ADD_CUSTOM__'
        ? selectedCategory
        : (sel.value && sel.value !== '__ADD_CUSTOM__' ? sel.value : (cats[0] || ''));
      sel.innerHTML = cats.map(c => `
        <option value="${escInv(c)}" ${targetVal.toLowerCase() === c.toLowerCase() ? 'selected' : ''}>${escInv(c)}</option>
      `).join('') + `<option value="__ADD_CUSTOM__">+ Add Custom Category...</option>`;
    }
    const managePanel = document.getElementById('inv-inline-cat-manage');
    if (managePanel) {
      managePanel.innerHTML = renderInlineCategoryManageList();
    }
    MJK.refreshInventoryCategoryFilterOptions();
  };

  MJK.onInventoryCategorySelectChange = (sel) => {
    if (sel && sel.value === '__ADD_CUSTOM__') {
      MJK.toggleInlineCustomCategoryBox(true);
    }
  };

  MJK.toggleInlineCustomCategoryBox = (show) => {
    const box = document.getElementById('inv-custom-cat-box');
    const input = document.getElementById('inv-new-category-input');
    const sel = document.getElementById('inv-category');
    if (!box) return;
    box.style.display = show ? 'block' : 'none';
    if (show && input) {
      input.value = '';
      setTimeout(() => input.focus(), 30);
    } else if (!show && sel && sel.value === '__ADD_CUSTOM__') {
      const firstReal = getInventoryCategories()[0] || 'Gas Hose Pipe';
      sel.value = firstReal;
    }
  };

  MJK.saveInlineCustomCategory = async () => {
    try {
      const input = document.getElementById('inv-new-category-input');
      const rawName = input?.value || '';
      const res = await addInventoryCategory(rawName);
      if (!res?.success) {
        if (res?.category) {
          MJK.refreshProductModalCategoryOptions(res.category.name);
          MJK.toggleInlineCustomCategoryBox(false);
          showToast(`Selected existing category "${res.category.name}".`, 'info');
        } else {
          showToast(res?.message || 'Please enter a valid category name.', 'warning');
        }
        return;
      }
      MJK.refreshProductModalCategoryOptions(res.category.name);
      MJK.toggleInlineCustomCategoryBox(false);
      showToast(`Category "${res.category.name}" saved & selected!`, 'success');
    } catch (err) {
      showToast(err?.message || 'Failed to save custom category.', 'danger');
    }
  };

  MJK.toggleInlineCategoryManagePanel = (forceOpen = null) => {
    const panel = document.getElementById('inv-inline-cat-manage');
    if (!panel) return;
    const isVisible = panel.style.display !== 'none';
    const nextVisible = forceOpen !== null ? Boolean(forceOpen) : !isVisible;
    if (nextVisible) {
      panel.innerHTML = renderInlineCategoryManageList();
    }
    panel.style.display = nextVisible ? 'block' : 'none';
  };

  MJK.deleteCategoryFromProductModal = (catId) => {
    const rec = getInventoryCategoryRecords().find(r => r.id === catId);
    if (!rec) return;
    const res = deleteInventoryCategory(catId);
    if (!res.success) {
      showToast(res.message || 'Could not delete category.', 'warning');
      return;
    }
    const sel = document.getElementById('inv-category');
    const nextSelected = sel && sel.value.toLowerCase() === rec.name.toLowerCase()
      ? (res.categories[0] || '')
      : (sel?.value || '');
    MJK.refreshProductModalCategoryOptions(nextSelected);
    showToast(`Deleted custom category "${rec.name}".`, 'info');
  };

  MJK.openInventoryCategoryManagerModal = () => {
    const records = getInventoryCategoryRecords();
    const items = getAllInventory();
    const customCats = records.filter(r => !r.isDefault);
    const defaultCats = records.filter(r => r.isDefault);

    const content = `
      <div>
        <form id="cat-manager-add-form" onsubmit="window.MJK.handleAddInventoryCategoryFromManager(event)" style="display:flex; gap:0.5rem; align-items:flex-end; flex-wrap:wrap; margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--border-subtle);">
          <div style="flex:1; min-width:210px;">
            <label class="form-label" style="margin-bottom:0.35rem;">Add New Custom Product Category *</label>
            <input type="text" id="cat-mgr-new-name" class="form-control" required maxlength="80" placeholder="e.g. Gas Cylinder Trolley, Copper Burner Ring...">
          </div>
          <button type="submit" class="btn btn-primary" style="white-space:nowrap;">+ Add Custom Category</button>
        </form>

        <div style="margin-bottom:1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <div style="font-weight:700; font-size:0.88rem; color:var(--text-main);">Custom Categories (${customCats.length})</div>
            <span style="font-size:0.74rem; color:var(--text-muted);">Click 🗑️ to remove unwanted categories</span>
          </div>
          ${customCats.length === 0 ? `
            <div style="padding:0.85rem 1rem; border:1px dashed var(--border-subtle); border-radius:var(--radius-md); font-size:0.8rem; color:var(--text-muted); text-align:center;">
              No custom product categories added yet. Use the field above to add your own category.
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:200px; overflow-y:auto;">
              ${customCats.map(cat => {
                const count = items.filter(i => String(i.category || '').toLowerCase() === cat.name.toLowerCase()).length;
                return `
                  <div style="display:flex; align-items:center; justify-content:space-between; gap:0.75rem; padding:0.55rem 0.75rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface-alt);">
                    <div style="min-width:0;">
                      <div style="font-weight:700; font-size:0.86rem; color:var(--text-main);">${escInv(cat.name)}</div>
                      <div style="font-size:0.72rem; color:var(--text-muted);">Custom · ${count} product${count === 1 ? '' : 's'} linked</div>
                    </div>
                    <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger); white-space:nowrap;" onclick="window.MJK.handleDeleteInventoryCategory('${escInv(cat.id)}')" title="Delete category">🗑️ Delete</button>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; gap:0.5rem; flex-wrap:wrap;">
            <div style="font-weight:700; font-size:0.88rem; color:var(--text-main);">Preset Gas Accessories Categories (${defaultCats.length})</div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.handleRestoreDefaultGasCategories()">↺ Restore Gas Defaults</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.35rem; max-height:220px; overflow-y:auto;">
            ${defaultCats.map(cat => {
              const count = items.filter(i => String(i.category || '').toLowerCase() === cat.name.toLowerCase()).length;
              return `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.75rem; padding:0.5rem 0.75rem; border:1px solid var(--border-subtle); border-radius:var(--radius-md); background:var(--surface);">
                  <div style="min-width:0;">
                    <div style="font-weight:600; font-size:0.84rem; color:var(--text-main);">${escInv(cat.name)}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">Default Gas Preset · ${count} product${count === 1 ? '' : 's'} linked</div>
                  </div>
                  <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--border-subtle); white-space:nowrap;" onclick="window.MJK.handleDeleteInventoryCategory('${escInv(cat.id)}')" title="Remove preset category">🗑️</button>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="margin-top:1.25rem; display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Done</button>
        </div>
      </div>
    `;

    openModal('🏷️ Manage Product Categories (Gas Accessories)', content, null);
  };

  MJK.handleAddInventoryCategoryFromManager = async (e) => {
    e.preventDefault();
    try {
      const input = document.getElementById('cat-mgr-new-name');
      const res = await addInventoryCategory(input?.value || '');
      if (!res?.success) {
        showToast(res?.message || 'Unable to add category.', 'warning');
        return;
      }
      showToast(`Category "${res.category.name}" added!`, 'success');
      MJK.openInventoryCategoryManagerModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to add category.', 'danger');
    }
  };

  MJK.handleDeleteInventoryCategory = (catId) => {
    const rec = getInventoryCategoryRecords().find(r => r.id === catId);
    if (!rec) return;
    const res = deleteInventoryCategory(catId);
    if (!res.success) {
      showToast(res.message || 'Cannot delete category.', 'warning');
      return;
    }
    showToast(`Deleted category "${rec.name}".`, 'info');
    MJK.openInventoryCategoryManagerModal();
    render();
  };

  MJK.handleRestoreDefaultGasCategories = () => {
    const res = restoreDefaultGasCategories();
    showToast(res.addedCount > 0 ? `Restored ${res.addedCount} default gas categories.` : 'All 6 default gas categories are already active.', 'success');
    MJK.openInventoryCategoryManagerModal();
    render();
  };

  MJK.openInventoryItemModal = (id = null) => {
    const existing = id ? getAllInventory().find(i => i.id === id) : null;
    const categories = getInventoryCategories(existing?.category || '');
    syncInventoryCategoriesFromBackend().then(synced => {
      if (Array.isArray(synced) && synced.length > 0 && document.getElementById('inv-category')) {
        MJK.refreshProductModalCategoryOptions();
      }
    }).catch(() => {});

    const content = `
      <form id="inventory-item-form" onsubmit="window.MJK.handleSaveInventoryItem(event)">
        <input type="hidden" id="inv-item-id" value="${existing ? escInv(existing.id) : ''}">

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Product Name *</label>
            <input type="text" id="inv-name" class="form-control" required value="${existing ? escInv(existing.name) : ''}" placeholder="e.g. Suraksha LPG Gas Hose Pipe 1.5m">
          </div>
          <div class="form-group">
            <label class="form-label" style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
              <span>Category *</span>
              <span style="display:inline-flex; gap:0.35rem;">
                <button type="button" class="btn btn-secondary btn-sm" style="padding:0.15rem 0.5rem; font-size:0.72rem;" onclick="window.MJK.toggleInlineCustomCategoryBox(true)">+ Add Custom Category</button>
                <button type="button" class="btn btn-outline btn-sm" style="padding:0.15rem 0.45rem; font-size:0.72rem;" onclick="window.MJK.toggleInlineCategoryManagePanel()" title="Manage / Delete Custom Categories">🗑️</button>
              </span>
            </label>
            <select id="inv-category" class="form-control" required onchange="window.MJK.onInventoryCategorySelectChange(this)">
              ${categories.map(c => `
                <option value="${escInv(c)}" ${existing && existing.category === c ? 'selected' : ''}>${escInv(c)}</option>
              `).join('')}
              <option value="__ADD_CUSTOM__">+ Add Custom Category...</option>
            </select>
          </div>
        </div>

        <!-- Inline Custom Category Creator -->
        <div id="inv-custom-cat-box" style="display:none; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.75rem; margin-bottom:0.85rem;">
          <label class="form-label" style="font-size:0.78rem; margin-bottom:0.35rem;">New Custom Product Category Name *</label>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
            <input type="text" id="inv-new-category-input" class="form-control" style="flex:1; min-width:180px;" maxlength="80" placeholder="e.g. Gas Cylinder Trolley, Double Burner Valve" onkeydown="if(event.key==='Enter'){event.preventDefault();window.MJK.saveInlineCustomCategory();}">
            <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.saveInlineCustomCategory()">Save Category</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.toggleInlineCustomCategoryBox(false)">Cancel</button>
          </div>
        </div>

        <!-- Inline Custom Category Manager (Delete Custom Categories) -->
        <div id="inv-inline-cat-manage" style="display:none; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.75rem; margin-bottom:0.85rem;">
          ${renderInlineCategoryManageList()}
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">SKU / Barcode Code</label>
            <input type="text" id="inv-sku" class="form-control font-mono" value="${existing ? escInv(existing.sku || '') : ''}" placeholder="Auto-assigned Global SL if blank">
          </div>
          <div class="form-group">
            <label class="form-label">Unit of Measure</label>
            <select id="inv-unit" class="form-control">
              <option value="Pcs" ${!existing || existing.unit === 'Pcs' ? 'selected' : ''}>Pcs (Pieces)</option>
              <option value="Meter" ${existing && existing.unit === 'Meter' ? 'selected' : ''}>Meter (Hose / Pipe)</option>
              <option value="Set" ${existing && existing.unit === 'Set' ? 'selected' : ''}>Set</option>
              <option value="Box" ${existing && existing.unit === 'Box' ? 'selected' : ''}>Box</option>
              <option value="Pkt" ${existing && existing.unit === 'Pkt' ? 'selected' : ''}>Packet</option>
              <option value="Bottle" ${existing && existing.unit === 'Bottle' ? 'selected' : ''}>Bottle</option>
              <option value="Ream" ${existing && existing.unit === 'Ream' ? 'selected' : ''}>Ream</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Cost Price (₹) *</label>
            <input type="number" id="inv-cost" class="form-control" required min="0" step="1" value="${existing ? existing.costPrice : '150'}" oninput="window.MJK.syncAmountWords(this, 'inv-cost-words')">
            <div id="inv-cost-words" class="amount-words-hint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Retail Selling Price (₹) *</label>
            <input type="number" id="inv-price" class="form-control" required min="0" step="1" value="${existing ? existing.sellingPrice : '250'}" oninput="window.MJK.syncAmountWords(this, 'inv-price-words')">
            <div id="inv-price-words" class="amount-words-hint"></div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Current Stock Quantity *</label>
            <input type="number" id="inv-stock" class="form-control" required min="0" value="${existing ? existing.stockQuantity : '10'}">
          </div>
          <div class="form-group">
            <label class="form-label">Reorder Alert Level</label>
            <input type="number" id="inv-min-stock" class="form-control" required min="1" value="${existing ? existing.minStockLevel : '4'}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Shelf / Rack Location</label>
            <input type="text" id="inv-shelf" class="form-control" value="${existing ? escInv(existing.shelfLocation) : 'Gas Rack A1'}" placeholder="e.g. Gas Counter Display 1">
          </div>
          <div class="form-group">
            <label class="form-label">Supplier / Wholesaler</label>
            <input type="text" id="inv-supplier" class="form-control" value="${existing ? escInv(existing.supplier) : 'Local Gas & Hardware Distributor'}" placeholder="e.g. Murshidabad Gas Spares Hub">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Notes</label>
          <input type="text" id="inv-notes" class="form-control" value="${existing ? escInv(existing.notes) : ''}" placeholder="ISI standard, warranty info, size / compatibility notes">
        </div>

        <div style="margin-top:1.5rem; display:flex; justify-content:flex-end; gap:0.75rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Update Product' : 'Add to Inventory'}</button>
        </div>
      </form>
    `;

    openModal(existing ? 'Edit Inventory Item' : '+ Add New Product', content, null);
    setTimeout(() => {
      syncAmountWords(document.getElementById('inv-cost'), 'inv-cost-words');
      syncAmountWords(document.getElementById('inv-price'), 'inv-price-words');
    }, 10);
  };

  MJK.handleSaveInventoryItem = async (e) => {
    e.preventDefault();
    try {
      const id = document.getElementById('inv-item-id')?.value;
      const name = document.getElementById('inv-name')?.value;
      const category = document.getElementById('inv-category')?.value;
      if (!category || category === '__ADD_CUSTOM__') {
        showToast('Please select a category or save your new custom category first.', 'warning');
        MJK.toggleInlineCustomCategoryBox(true);
        return;
      }
      const sku = document.getElementById('inv-sku')?.value;
      const unit = document.getElementById('inv-unit')?.value;
      const costPrice = Number(document.getElementById('inv-cost')?.value) || 0;
      const sellingPrice = Number(document.getElementById('inv-price')?.value) || 0;
      const stockQuantity = Number(document.getElementById('inv-stock')?.value) || 0;
      const minStockLevel = Number(document.getElementById('inv-min-stock')?.value) || 4;
      const shelfLocation = document.getElementById('inv-shelf')?.value;
      const supplier = document.getElementById('inv-supplier')?.value;
      const notes = document.getElementById('inv-notes')?.value;

      const res = await saveInventoryItem({
        id: id || undefined,
        name,
        category,
        sku,
        unit,
        costPrice,
        sellingPrice,
        stockQuantity,
        minStockLevel,
        shelfLocation,
        supplier,
        notes
      });

      if (res?.success) {
        showToast(`Product "${name}" saved in inventory!`, 'success');
        MJK.closeModal();
        render();
      } else {
        showToast(res?.message || 'Could not save product.', 'danger');
      }
    } catch (err) {
      showToast(err?.message || 'Failed to save inventory product.', 'danger');
    }
  };

  MJK.promptStockAdjust = (id) => {
    const item = getAllInventory().find(i => i.id === id);
    if (!item) return;

    const content = `
      <form onsubmit="window.MJK.handleStockAdjustSubmit(event, '${escInv(id)}')">
        <div style="background:var(--surface-alt); padding:0.75rem; border-radius:var(--radius-md); margin-bottom:1rem; font-size:0.84rem;">
          <strong>${escInv(item.name)}</strong><br>
          Current Stock: <strong>${item.stockQuantity} ${escInv(item.unit)}</strong>
        </div>
        <div class="form-group">
          <label class="form-label">Adjustment Quantity (use + to add, - to reduce) *</label>
          <input type="number" id="inv-adjust-delta" class="form-control font-mono" value="5" required>
        </div>
        <div class="form-group">
          <label class="form-label">Reason / Note</label>
          <input type="text" id="inv-adjust-reason" class="form-control" value="Manual counter stock adjustment" placeholder="Restock / Damaged / Audit">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Update Stock</button>
        </div>
      </form>
    `;
    openModal(`Adjust Stock: ${item.name}`, content, null);
  };

  MJK.handleStockAdjustSubmit = (e, id) => {
    e.preventDefault();
    const num = parseInt(document.getElementById('inv-adjust-delta')?.value || '0', 10);
    const reason = document.getElementById('inv-adjust-reason')?.value || 'Manual counter adjustment';
    if (!isNaN(num) && num !== 0) {
      adjustStock(id, num, reason);
      showToast('Stock updated successfully!', 'success');
      if (typeof closeModal === 'function') closeModal(); else MJK.closeModal();
      render();
    } else {
      showToast('Enter a non-zero quantity.', 'warning');
    }
  };

  MJK.deleteInventoryItem = (id) => {
    safeConfirm(
      'Delete Product from Inventory?',
      'Are you sure you want to remove this product from stock inventory?',
      () => {
        deleteInventoryItem(id);
        showToast('Product deleted from inventory', 'info');
        render();
      }
    );
  };

  MJK.filterInventoryTable = (qOverride = null) => {
    const searchInput = document.getElementById('inventory-search-input');
    const catSelect = document.getElementById('inventory-category-filter');
    const val = ((qOverride !== null ? qOverride : searchInput?.value) || '').toLowerCase().trim();
    const catVal = (catSelect?.value || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#inventory-data-table tbody tr');
    rows.forEach(r => {
      const rowCat = (r.getAttribute('data-category') || '').toLowerCase().trim();
      const matchesCat = !catVal || rowCat === catVal;
      const matchesText = !val || r.textContent.toLowerCase().includes(val);
      r.style.display = matchesCat && matchesText ? '' : 'none';
    });
  };

  MJK.openQuickSaleModal = () => {
    const items = getAllInventory().filter(i => i.stockQuantity > 0);
    if (items.length === 0) {
      showToast('No in-stock products available yet. Add a product to inventory first.', 'warning');
      return;
    }

    const esc = (v) => String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const customers = getAllCustomers();

    const content = `
      <form id="quick-sale-form" onsubmit="window.MJK.handleRecordQuickSale(event)">
        <div class="form-group">
          <label class="form-label">Select Product / Gas Accessory *</label>
          <select id="sale-product-id" class="form-control" required onchange="window.MJK.onQuickSaleProductChange()">
            ${items.map(i => `
              <option value="${esc(i.id)}" data-price="${Number(i.sellingPrice) || 0}" data-stock="${Number(i.stockQuantity) || 0}" data-category="${esc(i.category || 'Gas Accessories')}" data-unit="${esc(i.unit || 'Pcs')}">
                ${esc(i.name)} [${esc(i.category || 'Gas Accessories')}] (Stock: ${i.stockQuantity} ${esc(i.unit)}) — ${formatINR(i.sellingPrice)}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Quantity to Sell *</label>
            <input type="number" id="sale-qty" class="form-control font-mono tabular-nums" value="1" min="1" max="500" required oninput="window.MJK.onQuickSaleQtyChange()">
          </div>
          <div class="form-group">
            <label class="form-label">Unit Price (₹)</label>
            <input type="number" id="sale-unit-price" class="form-control font-mono tabular-nums" readonly style="background:var(--surface-alt);">
            <div id="sale-unit-price-words" class="amount-words-hint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Item Total</label>
            <input type="text" id="sale-total" class="form-control font-mono tabular-nums" style="font-weight:700; color:var(--blue-600); background:var(--surface-alt);" readonly>
            <div id="sale-total-words" class="amount-words-hint"></div>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:0.75rem;">
          <label class="form-label">Link Existing Customer (Auto-Merges with Same-Day Open Bill)</label>
          <select id="sale-cust-id" class="form-control" onchange="window.MJK.onQuickSaleCustomerSelect(this.value)">
            <option value="">-- Walk-in Customer / Enter Name & Mobile Below --</option>
            ${customers.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.phone || 'No Phone')})</option>`).join('')}
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Customer Name</label>
            <input type="text" id="sale-cust-name" class="form-control" value="Walk-in Customer" placeholder="Customer name">
          </div>
          <div class="form-group">
            <label class="form-label">Customer Mobile</label>
            <input type="tel" id="sale-cust-phone" class="form-control font-mono tabular-nums" placeholder="10-digit mobile number" oninput="window.MJK.checkQuickSaleMergeBanner()">
          </div>
        </div>

        <div id="sale-merge-banner" style="display:none; margin-bottom:0.85rem; padding:0.7rem 0.85rem; background:var(--blue-50, #eff6ff); border:1px solid var(--blue-200, #bfdbfe); border-radius:var(--radius-md); font-size:0.8rem;"></div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Amount Paid Now (₹)</label>
            <div style="display:flex; gap:0.35rem; align-items:center;">
              <input type="number" id="sale-paid" class="form-control font-mono tabular-nums" min="0" value="0" oninput="window.MJK.updateQuickSalePaymentSummary()">
              <button type="button" class="btn btn-outline btn-sm" style="white-space:nowrap;" onclick="window.MJK.setQuickSaleFullPaid()">Full</button>
            </div>
            <div id="sale-paid-words" class="amount-words-hint"></div>
            <div id="sale-due-display" style="font-size:0.74rem; color:var(--text-muted); margin-top:0.2rem;"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Payment Mode *</label>
            <select id="sale-payment-mode" class="form-control">
              <option value="Cash" selected>Cash (Counter Drawer)</option>
              <option value="UPI">PhonePe / GPay QR (UPI)</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>

        <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.78rem; margin-top:0.25rem; cursor:pointer;">
          <input type="checkbox" id="sale-print-receipt" checked>
          <span>Open consolidated printable receipt right after sale</span>
        </label>

        <div style="margin-top:1.25rem; display:flex; justify-content:flex-end; gap:0.75rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" id="sale-submit-btn" class="btn btn-primary">Complete Sale &amp; Print Cash Memo</button>
        </div>
      </form>
    `;

    openModal('⚡ Quick Counter Product Sale', content, null);
    setTimeout(() => {
      MJK.onQuickSaleProductChange();
      MJK.checkQuickSaleMergeBanner();
    }, 50);
  };

  MJK.onQuickSaleCustomerSelect = (custId) => {
    const cust = custId ? getAllCustomers().find(c => c.id === custId) : null;
    const nameEl = document.getElementById('sale-cust-name');
    const phoneEl = document.getElementById('sale-cust-phone');
    if (cust) {
      if (nameEl) nameEl.value = cust.name || 'Customer';
      if (phoneEl) phoneEl.value = cust.phone || '';
    } else {
      if (nameEl && (!nameEl.value || nameEl.value === '')) nameEl.value = 'Walk-in Customer';
    }
    MJK.checkQuickSaleMergeBanner();
  };

  MJK.checkQuickSaleMergeBanner = () => {
    const custId = document.getElementById('sale-cust-id')?.value || '';
    const phone = document.getElementById('sale-cust-phone')?.value?.trim() || '';
    const banner = document.getElementById('sale-merge-banner');
    const submitBtn = document.getElementById('sale-submit-btn');

    const openReceipt = findOpenReceiptForCustomerDate(custId, phone, getTodayDate());
    const qty = Math.max(1, Number(document.getElementById('sale-qty')?.value) || 1);
    const price = Number(document.getElementById('sale-unit-price')?.value) || 0;
    const itemTotal = qty * price;
    const paidNow = Math.max(0, Number(document.getElementById('sale-paid')?.value) || 0);

    if (openReceipt && banner) {
      const nextGrand = openReceipt.grandTotal + itemTotal;
      const nextPaid = openReceipt.totalPaid + paidNow;
      const nextDue = Math.max(0, nextGrand - nextPaid);
      banner.style.display = 'block';
      banner.innerHTML = `
        <div style="font-weight:700; color:var(--blue-700, #1d4ed8); margin-bottom:0.25rem;">
          Existing Open Receipt Found Today · <span class="font-mono">${openReceipt.receiptId}</span>
        </div>
        <div style="color:var(--text-main); line-height:1.45;">
          Previous Bill (${openReceipt.itemCount} item${openReceipt.itemCount > 1 ? 's' : ''}): <strong class="font-mono tabular-nums">${formatINR(openReceipt.grandTotal)}</strong> ·
          Paid: <strong class="font-mono tabular-nums" style="color:var(--success);">${formatINR(openReceipt.totalPaid)}</strong> ·
          Prev Due: <strong class="font-mono tabular-nums" style="color:${openReceipt.totalDue > 0 ? 'var(--danger)' : 'var(--success)'};">${formatINR(openReceipt.totalDue)}</strong>
        </div>
        <div style="margin-top:0.25rem; font-weight:700; color:var(--text-main);">
          Consolidated Bill After Sale: <span class="font-mono tabular-nums" style="color:var(--blue-600);">${formatINR(nextGrand)}</span> ·
          Consolidated Due: <span class="font-mono tabular-nums" style="color:${nextDue > 0 ? 'var(--danger)' : 'var(--success)'};">${formatINR(nextDue)}</span>
        </div>
      `;
      if (submitBtn) submitBtn.textContent = `Add & Merge into ${openReceipt.receiptId}`;
    } else {
      if (banner) {
        banner.style.display = 'none';
        banner.innerHTML = '';
      }
      if (submitBtn) submitBtn.textContent = 'Complete Sale & Print Cash Memo';
    }
    MJK.updateQuickSalePaymentSummary();
  };

  MJK.updateQuickSalePaymentSummary = () => {
    const qty = Math.max(1, Number(document.getElementById('sale-qty')?.value) || 1);
    const priceInput = document.getElementById('sale-unit-price');
    const paidInput = document.getElementById('sale-paid');
    const price = Number(priceInput?.value) || 0;
    const itemTotal = qty * price;
    const paidNow = Math.max(0, Number(paidInput?.value) || 0);
    syncAmountWords(priceInput, 'sale-unit-price-words');
    syncAmountWords(itemTotal, 'sale-total-words');
    syncAmountWords(paidInput, 'sale-paid-words');
    const custId = document.getElementById('sale-cust-id')?.value || '';
    const phone = document.getElementById('sale-cust-phone')?.value?.trim() || '';
    const openReceipt = findOpenReceiptForCustomerDate(custId, phone, getTodayDate());
    const dueEl = document.getElementById('sale-due-display');

    if (dueEl) {
      if (openReceipt) {
        const consolidatedTotal = openReceipt.grandTotal + itemTotal;
        const consolidatedPaid = openReceipt.totalPaid + paidNow;
        const consolidatedDue = Math.max(0, consolidatedTotal - consolidatedPaid);
        dueEl.innerHTML = `
          <div>Consolidated Due: <strong class="font-mono tabular-nums" style="color:${consolidatedDue > 0 ? 'var(--danger)' : 'var(--success)'};">${formatINR(consolidatedDue)}</strong></div>
          <div style="font-size:0.7rem; color:var(--blue-600); font-weight:600; margin-top:2px;">Total: ${numberToWords(consolidatedTotal)} · Paid: ${numberToWords(consolidatedPaid)} · Due: ${numberToWords(consolidatedDue)}</div>
        `;
      } else {
        const itemDue = Math.max(0, itemTotal - paidNow);
        dueEl.innerHTML = `
          <div>Item Due: <strong class="font-mono tabular-nums" style="color:${itemDue > 0 ? 'var(--danger)' : 'var(--success)'};">${formatINR(itemDue)}</strong></div>
          <div style="font-size:0.7rem; color:var(--blue-600); font-weight:600; margin-top:2px;">Total: ${numberToWords(itemTotal)} · Paid: ${numberToWords(paidNow)} · Due: ${numberToWords(itemDue)}</div>
        `;
      }
    }
  };

  MJK.setQuickSaleFullPaid = () => {
    const qty = Math.max(1, Number(document.getElementById('sale-qty')?.value) || 1);
    const price = Number(document.getElementById('sale-unit-price')?.value) || 0;
    const itemTotal = qty * price;
    const custId = document.getElementById('sale-cust-id')?.value || '';
    const phone = document.getElementById('sale-cust-phone')?.value?.trim() || '';
    const openReceipt = findOpenReceiptForCustomerDate(custId, phone, getTodayDate());
    const fullTarget = openReceipt ? (openReceipt.totalDue + itemTotal) : itemTotal;
    const paidEl = document.getElementById('sale-paid');
    if (paidEl) {
      paidEl.value = fullTarget;
      syncAmountWords(paidEl, 'sale-paid-words');
    }
    MJK.checkQuickSaleMergeBanner();
  };

  MJK.onQuickSaleProductChange = () => {
    const sel = document.getElementById('sale-product-id');
    if (!sel) return;
    const opt = sel.options[sel.selectedIndex];
    const price = opt?.getAttribute('data-price') || 0;
    const stock = Number(opt?.getAttribute('data-stock')) || 1;
    const unitPriceInput = document.getElementById('sale-unit-price');
    const qtyInput = document.getElementById('sale-qty');
    if (unitPriceInput) {
      unitPriceInput.value = price;
      syncAmountWords(unitPriceInput, 'sale-unit-price-words');
    }
    if (qtyInput) qtyInput.max = String(Math.max(1, stock));
    MJK.onQuickSaleQtyChange();
  };

  MJK.onQuickSaleQtyChange = () => {
    const price = Number(document.getElementById('sale-unit-price')?.value) || 0;
    const qty = Math.max(1, Number(document.getElementById('sale-qty')?.value) || 1);
    const total = price * qty;
    const totalInput = document.getElementById('sale-total');
    const paidInput = document.getElementById('sale-paid');
    if (totalInput) totalInput.value = formatINR(total);
    if (paidInput) paidInput.value = total;
    syncAmountWords(total, 'sale-total-words');
    syncAmountWords(paidInput, 'sale-paid-words');
    MJK.checkQuickSaleMergeBanner();
  };

  MJK.handleRecordQuickSale = async (e) => {
    e.preventDefault();
    try {
      const sel = document.getElementById('sale-product-id');
      const productId = sel?.value;
      const opt = sel?.options[sel.selectedIndex];
      const prodName = opt?.text.split('[')[0].trim() || opt?.text.split('(')[0].trim() || 'Product';
      const prodCategory = opt?.getAttribute('data-category') || 'Other Gas Accessories';
      const prodUnit = opt?.getAttribute('data-unit') || 'Pcs';
      const availStock = Number(opt?.getAttribute('data-stock')) || 0;
      const qty = Math.max(1, Number(document.getElementById('sale-qty')?.value) || 1);
      if (availStock > 0 && qty > availStock) {
        showToast(`Only ${availStock} ${prodUnit} in stock.`, 'warning');
        return;
      }

      const price = Number(document.getElementById('sale-unit-price')?.value) || 0;
      const total = price * qty;
      const paidNow = Math.max(0, Number(document.getElementById('sale-paid')?.value) || 0);
      const paymentMode = document.getElementById('sale-payment-mode')?.value || 'Cash';
      const custId = document.getElementById('sale-cust-id')?.value || '';
      const custName = document.getElementById('sale-cust-name')?.value?.trim() || 'Walk-in Customer';
      const custPhone = document.getElementById('sale-cust-phone')?.value?.trim() || '';
      const shouldPrint = !!document.getElementById('sale-print-receipt')?.checked;

      // 1. Deduct Inventory
      adjustStock(productId, -qty, `Counter sale to ${custName}`);

      // 2. Save / Auto-Merge Accessory Line Item into Customer's Same-Day Receipt
      const batchRes = await saveServiceBatch({
        customerId: custId,
        customerName: custName,
        phone: custPhone,
        appDate: getTodayDate(),
        paymentMode,
        collectiveStatus: paidNow >= total ? 'Delivered' : 'Pending',
        totalAdvancePaid: paidNow,
        items: [
          {
            serviceName: qty > 1 ? `${prodName} (x${qty} ${prodUnit})` : prodName,
            category: prodCategory,
            subcategory: prodName,
            refNumber: '',
            deliveryDate: getTodayDate(),
            serviceCharge: total,
            govFee: 0,
            otherCharges: 0,
            status: paidNow >= total ? 'Delivered' : 'Pending',
            requiredDocs: `Retail Sale · Qty: ${qty} ${prodUnit} @ ${formatINR(price)}`
          }
        ]
      });

      if (!batchRes?.success) {
        showToast(batchRes?.message || 'Could not complete quick sale.', 'danger');
        return;
      }

      // 3. Record Payment & Cash/UPI Inflow (without double-crediting service item paidAmount)
      if (paidNow > 0) {
        await recordPayment({
          customerId: custId,
          customerName: custName,
          receiptId: batchRes?.receiptId || '',
          invoiceNumber: batchRes?.receiptId || '',
          paymentAmount: paidNow,
          totalCharge: batchRes?.grandTotal || total,
          remainingDue: batchRes?.totalDue ?? Math.max(0, total - paidNow),
          paymentMethod: paymentMode,
          paymentDate: getTodayDate(),
          skipServiceSync: true,
          remarks: `Retail accessory sale: ${qty}x ${prodName}${batchRes?.merged ? ` (Merged into ${batchRes.receiptId})` : ''}`
        });
      }

      const msg = batchRes?.merged
        ? `Added "${prodName}" into existing Receipt ${batchRes.receiptId}! Consolidated Total: ${formatINR(batchRes.grandTotal)}${batchRes.totalDue > 0 ? ` (Due: ${formatINR(batchRes.totalDue)})` : ''}`
        : `Sale completed under Receipt ${batchRes?.receiptId || ''}: ${formatINR(paidNow)} received! Stock updated.`;
      showToast(msg, 'success');
      MJK.closeModal();
      render();

      if (shouldPrint && batchRes?.services?.[0] && typeof MJK.printServiceReceipt === 'function') {
        setTimeout(() => {
          MJK.printServiceReceipt(batchRes.services[0].id, batchRes.receiptId);
        }, 80);
      }
    } catch (err) {
      showToast(err?.message || 'Failed to record quick sale.', 'danger');
    }
  };

  /* --- 4. Smart PVC Card Studio Handlers --- */
  let currentCardTemplate = 'aadhaar';

  MJK.setCardTemplate = (templateType, btnEl = null) => {
    currentCardTemplate = templateType;
    
    // Update active button state cleanly without bare event global
    document.querySelectorAll('#card-template-selectors button').forEach(b => {
      b.className = 'btn btn-secondary btn-sm';
    });
    const activeBtn = btnEl || document.querySelector(`#card-template-selectors button[data-card-tpl="${templateType}"]`);
    if (activeBtn) activeBtn.className = 'btn btn-primary btn-sm';

    const editorTitle = document.getElementById('card-editor-title');
    const orgLabel = document.getElementById('preview-org-name');
    const typeLabel = document.getElementById('preview-card-type-label');
    const numInput = document.getElementById('card-number');

    if (templateType === 'aadhaar') {
      if (editorTitle) editorTitle.textContent = 'Card Data Editor (Aadhaar Format)';
      if (orgLabel) orgLabel.textContent = 'GOVERNMENT OF INDIA';
      if (typeLabel) typeLabel.textContent = 'UNIQUE IDENTIFICATION AUTHORITY OF INDIA';
      if (numInput && (!numInput.value || numInput.value === 'ABCDE1234F')) numInput.value = '';
    } else if (templateType === 'pan') {
      if (editorTitle) editorTitle.textContent = 'Card Data Editor (NSDL PAN Format)';
      if (orgLabel) orgLabel.textContent = 'INCOME TAX DEPARTMENT';
      if (typeLabel) typeLabel.textContent = 'GOVT. OF INDIA - PERMANENT ACCOUNT NUMBER';
      if (numInput && (!numInput.value || numInput.value === 'ABCDE1234F')) numInput.value = '';
    } else if (templateType === 'voter') {
      if (editorTitle) editorTitle.textContent = 'Card Data Editor (Election Commission EPIC)';
      if (orgLabel) orgLabel.textContent = 'ELECTION COMMISSION OF INDIA';
      if (typeLabel) typeLabel.textContent = 'ELECTOR PHOTO IDENTITY CARD - EPIC';
      if (numInput && (!numInput.value || numInput.value === 'ABCDE1234F')) numInput.value = '';
    } else if (templateType === 'student') {
      if (editorTitle) editorTitle.textContent = 'Card Data Editor (Student / College ID)';
      if (orgLabel) orgLabel.textContent = 'EDUCATIONAL INSTITUTION';
      if (typeLabel) typeLabel.textContent = 'STUDENT IDENTITY & LIBRARY CARD';
      if (numInput && (!numInput.value || numInput.value === 'ABCDE1234F')) numInput.value = '';
    } else if (templateType === 'employee') {
      if (editorTitle) editorTitle.textContent = 'Card Data Editor (MUN COMPUTER Merchant Staff)';
      if (orgLabel) orgLabel.textContent = 'MUN COMPUTER';
      if (typeLabel) typeLabel.textContent = 'OFFICIAL BUSINESS MANAGER & CSC STAFF';
      if (numInput && (!numInput.value || numInput.value === 'ABCDE1234F')) numInput.value = '';
    }

    MJK.updateLiveCardPreview();
  };

  MJK.updateLiveCardPreview = () => {
    const name = document.getElementById('card-cust-name')?.value || 'Cardholder Name';
    const father = document.getElementById('card-father-name')?.value || '';
    const dob = document.getElementById('card-dob')?.value || '';
    const gender = document.getElementById('card-gender')?.value || 'Male';
    const number = document.getElementById('card-number')?.value || 'XXXX XXXX XXXX';
    const address = document.getElementById('card-address')?.value || '';

    const pName = document.getElementById('prev-name');
    const pFather = document.getElementById('prev-father');
    const pDob = document.getElementById('prev-dob');
    const pGender = document.getElementById('prev-gender');
    const pNumber = document.getElementById('prev-number');
    const pAddress = document.getElementById('prev-address');

    if (pName) pName.textContent = name;
    if (pFather) pFather.textContent = father ? `C/O ${father}` : '';
    if (pDob) pDob.textContent = dob;
    if (pGender) pGender.textContent = gender;
    if (pNumber) pNumber.textContent = number;
    if (pAddress) pAddress.textContent = address;
  };

  MJK.printCurrentCard = () => {
    const cleanup = () => document.body.classList.remove('printing-pvc-card');
    document.body.classList.add('printing-pvc-card');
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 1500);
    }, 50);
  };

  MJK.sendCardDetailsToWhatsApp = () => {
    const name = document.getElementById('card-cust-name')?.value || 'Customer';
    const mobile = document.getElementById('card-mobile')?.value;
    const cardNum = document.getElementById('card-number')?.value || '';

    const message = `নমস্কার ${name} মহাশয়/মহাশয়া,

আপনার Smart PVC Card (কার্ড নং: ${cardNum}) MUN COMPUTER-এ সফলভাবে প্রিন্ট সম্পন্ন হয়েছে।

দয়া করে আমাদের সেন্টার থেকে কার্ডটি সংগ্রহ করুন।
📍 ঠিকানা: MUN COMPUTER, Mamudpur, Juginda, Domkal, Murshidabad – 742406
📞 হেল্পলাইন: 8101352105`;

    MJK.openWhatsApp(mobile, message);
  };

  MJK.saveCardAsServiceRecord = async () => {
    try {
      const name = document.getElementById('card-cust-name')?.value || 'Customer';
      const phone = document.getElementById('card-mobile')?.value || '';
      const cardNum = document.getElementById('card-number')?.value || '';

      const subLabelMap = {
        aadhaar: 'Aadhaar PVC',
        pan: 'PAN PVC',
        voter: 'Voter PVC',
        student: 'ID Card',
        employee: 'Custom PVC'
      };

      const res = await saveService({
        customerName: name,
        phone,
        category: 'PVC Card',
        subcategory: subLabelMap[currentCardTemplate] || 'Custom PVC',
        serviceName: `Smart PVC Card Printing (${currentCardTemplate.toUpperCase()})`,
        serviceCharge: 60,
        govFee: 0,
        otherCharges: 0,
        advancePayment: 60,
        paidAmount: 60,
        status: 'Completed',
        remarks: `Card identification: ${cardNum}`
      });

      if (res?.success) {
        showToast(`PVC card saved as completed service for ${name}!`, 'success');
        render();
      } else {
        showToast(res?.message || 'Could not save PVC card service.', 'danger');
      }
    } catch (err) {
      showToast(err?.message || 'Failed to save PVC card service.', 'danger');
    }
  };

  /* --- 5. Counter Cash Daybook Handlers --- */
  MJK.recalculateDenominations = () => {
    let grandTotal = 0;

    DENOMINATION_SPEC.forEach(spec => {
      const input = document.querySelector(`.denom-input[data-key="${spec.key}"]`);
      const count = Math.max(0, parseInt(input?.value || '0', 10) || 0);
      const subtotal = count * spec.value;
      grandTotal += subtotal;

      const subElem = document.querySelector(`.subtotal-denom[data-key="${spec.key}"]`);
      if (subElem) subElem.textContent = subtotal > 0 ? formatINR(subtotal) : '—';
    });

    const totalElem = document.getElementById('denom-grand-total');
    if (totalElem) totalElem.textContent = formatINR(grandTotal);

    const totalWordsElem = document.getElementById('denom-grand-total-words');
    if (totalWordsElem) totalWordsElem.textContent = numberToWords(grandTotal);

    const liveCounted = document.getElementById('live-counted-cash');
    if (liveCounted) liveCounted.textContent = formatINR(grandTotal);

    const liveCountedWords = document.getElementById('live-counted-cash-words');
    if (liveCountedWords) liveCountedWords.textContent = numberToWords(grandTotal);
  };

  MJK.saveDaybookRecord = async () => {
    try {
      const tally = calculateDayTally();
      let countedTotal = 0;
      const denominations = {};

      DENOMINATION_SPEC.forEach(spec => {
        const input = document.querySelector(`.denom-input[data-key="${spec.key}"]`);
        const count = Math.max(0, parseInt(input?.value || '0', 10) || 0);
        countedTotal += count * spec.value;
        denominations[spec.key] = count;
      });

      const res = await saveDaybookEntry({
        date: tally.date,
        openingCash: tally.openingCash,
        serviceCashIn: tally.serviceCashIn,
        cspCashIn: tally.cspCashIn,
        cspCashOut: tally.cspCashOut,
        cashExpenses: tally.cashExpenses,
        expectedClosing: tally.expectedClosing,
        countedPhysicalCash: countedTotal,
        denominations,
        verifiedBy: 'MUN COMPUTER (Admin)'
      });

      if (res?.success) {
        showToast(`Daybook locked and verified for ${formatDate(tally.date)}!`, 'success');
        render();
      } else {
        showToast(res?.message || 'Could not save daybook record.', 'danger');
      }
    } catch (err) {
      showToast(err?.message || 'Failed to save daybook record.', 'danger');
    }
  };

  /* --- 6. Staff Attendance & Payroll Handlers --- */
  MJK.openAttendanceModal = () => {
    const users = getItem(KEYS.USERS, []);
    const activeStaff = users.filter(u => u.status !== 'SUSPENDED');
    const optionsHtml = activeStaff.length > 0
      ? activeStaff.map(u => `<option value="${u.uid || u.id}" data-name="${u.name}" data-role="${u.designation || u.role}" data-salary="350">${u.name} (${u.uid || u.id} - ${u.designation || u.role})</option>`).join('')
      : `<option value="UNASSIGNED" data-name="No Approved Staff Yet" data-role="Staff" data-salary="350">No Approved Staff Available</option>`;

    const content = `
      <form id="attendance-log-form" onsubmit="window.MJK.handleSaveAttendance(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Select Staff Member *</label>
            <select id="att-staff-id" class="form-control" required onchange="window.MJK.onAttendanceStaffChange()">
              ${optionsHtml}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Attendance Status *</label>
            <select id="att-status" class="form-control">
              <option value="Present" selected>Present (Full Day)</option>
              <option value="Half Day">Half Day</option>
              <option value="Leave">On Leave</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Clock In Time</label>
            <input type="text" id="att-clock-in" class="form-control" value="08:30 AM">
          </div>
          <div class="form-group">
            <label class="form-label">Clock Out Time</label>
            <input type="text" id="att-clock-out" class="form-control" value="08:00 PM">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Services / Jobs Handled Today</label>
            <input type="number" id="att-jobs-count" class="form-control" value="12" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Today's Performance Commission (₹)</label>
            <input type="number" id="att-commission" class="form-control" value="110" min="0" oninput="window.MJK.syncAmountWords(this, 'att-commission-words')">
            <div id="att-commission-words" class="amount-words-hint"></div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Notes / Remarks</label>
          <input type="text" id="att-notes" class="form-control" placeholder="Special tasks, overtime remarks">
        </div>

        <div style="margin-top:1.5rem; display:flex; justify-content:flex-end; gap:0.75rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Attendance Entry</button>
        </div>
      </form>
    `;

    openModal('+ Record Today\'s Staff Attendance', content, null);
    setTimeout(() => syncAmountWords(document.getElementById('att-commission'), 'att-commission-words'), 10);
  };

  MJK.onAttendanceStaffChange = () => {
    // optional dynamic adjustment
  };

  MJK.handleSaveAttendance = async (e) => {
    e.preventDefault();
    try {
      const sel = document.getElementById('att-staff-id');
      const opt = sel?.options[sel.selectedIndex];
      const staffId = sel?.value;
      const staffName = opt?.getAttribute('data-name') || 'Staff';
      const role = opt?.getAttribute('data-role') || 'Operator';
      const baseDailySalary = Number(opt?.getAttribute('data-salary')) || 350;

      const status = document.getElementById('att-status')?.value || 'Present';
      const clockIn = document.getElementById('att-clock-in')?.value || '08:30 AM';
      const clockOut = document.getElementById('att-clock-out')?.value || '08:00 PM';
      const servicesHandled = Number(document.getElementById('att-jobs-count')?.value) || 0;
      const commissionEarned = Number(document.getElementById('att-commission')?.value) || 0;
      const notes = document.getElementById('att-notes')?.value || '';

      const res = await recordAttendance({
        staffId,
        staffName,
        role,
        status,
        clockIn,
        clockOut,
        servicesHandled,
        commissionEarned,
        baseDailySalary: status === 'Leave' ? 0 : (status === 'Half Day' ? baseDailySalary / 2 : baseDailySalary),
        notes,
        date: getTodayDate()
      });

      if (res?.success) {
        showToast(`Attendance recorded for ${staffName}!`, 'success');
        MJK.closeModal();
        render();
      } else {
        showToast(res?.message || 'Could not record attendance.', 'danger');
      }
    } catch (err) {
      showToast(err?.message || 'Failed to record attendance.', 'danger');
    }
  };

  /* --- 7. Counter Daybook & Staff Payroll Export Handlers --- */
  const buildDaybookReportSpec = () => {
    const tally = calculateDayTally();
    const pastEntries = getAllDaybookEntries();
    const headers = ['Date', 'Opening Float', 'Cash Inflow', 'Cash Outflow', 'Expected Closing', 'Counted Cash', 'Difference', 'Status', 'Verified By'];
    const rows = pastEntries.map(e => [
      formatDate(e.date),
      Number(e.openingCash) || 0,
      (Number(e.serviceCashIn) || 0) + (Number(e.cspCashIn) || 0),
      (Number(e.cspCashOut) || 0) + (Number(e.cashExpenses) || 0),
      Number(e.expectedClosing) || 0,
      Number(e.countedPhysicalCash) || 0,
      Number(e.difference) || 0,
      e.status || 'Closed',
      e.verifiedBy || '-'
    ]);
    if (rows.length === 0) {
      rows.push([
        formatDate(tally.date),
        Number(tally.openingCash) || 0,
        (Number(tally.serviceCashIn) || 0) + (Number(tally.cspCashIn) || 0),
        (Number(tally.cspCashOut) || 0) + (Number(tally.cashExpenses) || 0),
        Number(tally.expectedClosing) || 0,
        Number(tally.countedPhysicalCash) || 0,
        Number(tally.difference) || 0,
        tally.difference === 0 ? 'Balanced (Live)' : 'Open Tally',
        'Live Counter'
      ]);
    }
    const totIn = rows.reduce((s, r) => s + r[2], 0);
    const totOut = rows.reduce((s, r) => s + r[3], 0);
    const totalsRow = ['GRAND TOTAL', `${rows.length} Days`, totIn, totOut, '', '', '', 'CASHBOOK', ''];
    return { tally, rows, headers, totalsRow, totIn, totOut };
  };

  MJK.printDaybookReport = () => {
    const { tally, rows, headers, totIn, totOut } = buildDaybookReportSpec();
    printUniversalReport({
      title: 'COUNTER CASH DRAWER & DAILY DAYBOOK REPORT',
      filename: 'MUN_COMPUTER_Daybook_Report',
      statusLabel: tally.difference === 0 ? 'BALANCED' : 'OPEN / VARIANCE',
      subtitle: `Today (${formatDate(tally.date)}) Expected Closing: ${formatINR(tally.expectedClosing)}`,
      headers,
      rows: rows.map(r => [r[0], formatINR(r[1]), formatINR(r[2]), formatINR(r[3]), formatINR(r[4]), formatINR(r[5]), formatINR(r[6]), r[7], r[8]]),
      totalsRow: ['GRAND TOTAL', `${rows.length} Days`, formatINR(totIn), formatINR(totOut), '', '', '', 'CASHBOOK', ''],
      summaryCards: [
        { label: 'Today Opening', value: formatINR(tally.openingCash) },
        { label: 'Expected Closing', value: formatINR(tally.expectedClosing) },
        { label: 'Counted Physical', value: formatINR(tally.countedPhysicalCash) }
      ],
      orientation: 'landscape'
    });
  };

  MJK.exportDaybookPDF = () => {
    const { tally, rows, headers, totIn, totOut } = buildDaybookReportSpec();
    exportUniversalPDF({
      filename: 'MUN_COMPUTER_Daybook_Report',
      title: 'COUNTER CASH DRAWER & DAILY DAYBOOK REPORT',
      statusLabel: tally.difference === 0 ? 'BALANCED' : 'OPEN / VARIANCE',
      subtitle: `Today (${formatDate(tally.date)}) Expected Closing: Rs.${tally.expectedClosing}`,
      headers,
      rows: rows.map(r => [r[0], `Rs.${r[1]}`, `Rs.${r[2]}`, `Rs.${r[3]}`, `Rs.${r[4]}`, `Rs.${r[5]}`, `Rs.${r[6]}`, r[7], r[8]]),
      totalsRow: ['GRAND TOTAL', `${rows.length} Days`, `Rs.${totIn}`, `Rs.${totOut}`, '', '', '', 'CASHBOOK', ''],
      orientation: 'landscape'
    });
    showToast('Counter Daybook PDF downloaded!', 'success');
  };

  MJK.exportDaybookExcel = () => {
    const { rows, headers, totalsRow } = buildDaybookReportSpec();
    exportUniversalExcel({
      filename: 'MUN_COMPUTER_Daybook_Report',
      sheetName: 'Counter_Daybook',
      title: 'COUNTER CASH DRAWER & DAILY DAYBOOK REPORT',
      statusLabel: 'VERIFIED',
      headers,
      rows,
      totalsRow
    });
    showToast('Counter Daybook Excel (.xlsx) downloaded!', 'success');
  };

  MJK.exportDaybookCSV = () => {
    const { rows, headers, totalsRow } = buildDaybookReportSpec();
    exportUniversalCSV({
      filename: 'MUN_COMPUTER_Daybook_Report',
      title: 'COUNTER CASH DRAWER & DAILY DAYBOOK REPORT',
      statusLabel: 'VERIFIED',
      headers,
      rows,
      totalsRow
    });
    showToast('Counter Daybook CSV downloaded (UTF-8 BOM)!', 'success');
  };

  const buildPayrollReportSpec = () => {
    const records = getAllAttendance();
    const summary = getPayrollSummary();
    const totalPayout = records.reduce((s, r) => s + (Number(r.totalDailyPay) || 0), 0);
    const totalComm = records.reduce((s, r) => s + (Number(r.commissionEarned) || 0), 0);
    const totalJobs = records.reduce((s, r) => s + (Number(r.servicesHandled) || 0), 0);
    const headers = ['Date', 'Staff Name', 'Role', 'Clock In / Out', 'Status', 'Jobs Handled', 'Commission (INR)', 'Daily Pay (INR)', 'Notes'];
    const rows = records.map(r => [
      formatDate(r.date),
      r.staffName || '-',
      r.role || '-',
      `${r.clockIn || '-'} - ${r.clockOut || '-'}`,
      r.status || '-',
      Number(r.servicesHandled) || 0,
      Number(r.commissionEarned) || 0,
      Number(r.totalDailyPay) || 0,
      r.notes || '-'
    ]);
    const totalsRow = ['GRAND TOTAL', `${summary.length} Staff`, '', '', `${records.length} Logs`, totalJobs, totalComm, totalPayout, 'PAYROLL'];
    return { records, summary, totalPayout, totalComm, totalJobs, headers, rows, totalsRow };
  };

  MJK.printPayrollReport = () => {
    const { records, summary, totalPayout, totalComm, totalJobs, headers, rows } = buildPayrollReportSpec();
    printUniversalReport({
      title: 'EMPLOYEE ATTENDANCE & PAYROLL COMMISSION REPORT',
      filename: 'MUN_COMPUTER_Employee_Payroll_Report',
      statusLabel: 'VERIFIED PAYROLL',
      subtitle: `Staff Active: ${summary.length} | Attendance Logs: ${records.length}`,
      headers,
      rows: rows.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], formatINR(r[6]), formatINR(r[7]), r[8]]),
      totalsRow: ['GRAND TOTAL', `${summary.length} Staff`, '', '', `${records.length} Logs`, totalJobs, formatINR(totalComm), formatINR(totalPayout), 'PAYROLL'],
      summaryCards: [
        { label: 'Total Logs', value: String(records.length) },
        { label: 'Jobs Handled', value: String(totalJobs) },
        { label: 'Total Commission', value: formatINR(totalComm) },
        { label: 'Total Payout', value: formatINR(totalPayout) }
      ],
      orientation: 'landscape'
    });
  };

  MJK.exportPayrollPDF = () => {
    const { records, summary, totalPayout, totalComm, totalJobs, headers, rows } = buildPayrollReportSpec();
    exportUniversalPDF({
      filename: 'MUN_COMPUTER_Employee_Payroll_Report',
      title: 'EMPLOYEE ATTENDANCE & PAYROLL COMMISSION REPORT',
      statusLabel: 'VERIFIED PAYROLL',
      subtitle: `Staff Active: ${summary.length} | Attendance Logs: ${records.length}`,
      headers,
      rows: rows.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], `Rs.${r[6]}`, `Rs.${r[7]}`, r[8]]),
      totalsRow: ['GRAND TOTAL', `${summary.length} Staff`, '', '', `${records.length} Logs`, totalJobs, `Rs.${totalComm}`, `Rs.${totalPayout}`, 'PAYROLL'],
      orientation: 'landscape'
    });
    showToast('Employee & Payroll PDF downloaded!', 'success');
  };

  MJK.exportPayrollExcel = () => {
    const { headers, rows, totalsRow } = buildPayrollReportSpec();
    exportUniversalExcel({
      filename: 'MUN_COMPUTER_Employee_Payroll_Report',
      sheetName: 'Employee_Payroll',
      title: 'EMPLOYEE ATTENDANCE & PAYROLL COMMISSION REPORT',
      statusLabel: 'VERIFIED PAYROLL',
      headers,
      rows,
      totalsRow
    });
    showToast('Employee & Payroll Excel (.xlsx) downloaded!', 'success');
  };

  MJK.exportPayrollCSV = () => {
    const { headers, rows, totalsRow } = buildPayrollReportSpec();
    exportUniversalCSV({
      filename: 'MUN_COMPUTER_Employee_Payroll_Report',
      title: 'EMPLOYEE ATTENDANCE & PAYROLL COMMISSION REPORT',
      statusLabel: 'VERIFIED PAYROLL',
      headers,
      rows,
      totalsRow
    });
    showToast('Employee & Payroll CSV downloaded (UTF-8 BOM)!', 'success');
  };
}
