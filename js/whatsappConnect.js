/**
 * whatsappConnect.js - Customer Mobile Number to Automatic WhatsApp Connect System
 * Compliant with WhatsApp click-to-chat policy (https://wa.me/91XXXXXXXXXX?text=...)
 * Uses anchor target="_blank" links (never window.open / window.alert).
 */

import { formatINR } from './storage.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escJs(value) {
  return esc(String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' '));
}

/**
 * Normalize Indian mobile number and auto-add +91 country code when 10 digits.
 * Example: "9876543210" -> waDigits: "919876543210", display: "+91 98765 43210"
 */
export function normalizeWhatsAppPhone(rawPhone) {
  const digitsOnly = String(rawPhone || '').replace(/[^0-9]/g, '');
  let clean10 = digitsOnly;
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    clean10 = digitsOnly.slice(1);
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    clean10 = digitsOnly.slice(2);
  } else if (digitsOnly.length > 10) {
    clean10 = digitsOnly.slice(-10);
  }

  let waDigits = '';
  if (clean10.length === 10) {
    waDigits = `91${clean10}`;
  } else if (digitsOnly.length >= 10) {
    waDigits = digitsOnly;
  }

  const valid = waDigits.length >= 12;
  const display = clean10.length === 10
    ? `+91 ${clean10.slice(0, 5)} ${clean10.slice(5)}`
    : (waDigits ? `+${waDigits}` : '');

  return {
    raw: String(rawPhone || ''),
    clean10,
    waDigits,
    display,
    valid,
    baseUrl: waDigits ? `https://wa.me/${waDigits}` : ''
  };
}

export function buildWhatsAppUrl(rawPhone, message = '') {
  const info = normalizeWhatsAppPhone(rawPhone);
  if (!info.waDigits) return '';
  const trimmed = String(message || '').trim();
  return trimmed
    ? `https://wa.me/${info.waDigits}?text=${encodeURIComponent(trimmed)}`
    : `https://wa.me/${info.waDigits}`;
}

export function buildTemplateMessage(templateKey, ctx = {}) {
  const name = ctx.customerName || 'সম্মানিত গ্রাহক';
  const service = ctx.serviceName || 'ডিজিটাল সার্ভিস';
  const ref = ctx.refNumber ? ` (Ref: ${ctx.refNumber})` : '';
  const status = ctx.status || 'In Progress';
  const totalAmt = Number(ctx.totalAmount) || 0;
  const paidAmt = Number(ctx.paidAmount) || 0;
  const dueAmt = Number(ctx.dueAmount) || 0;

  switch (templateKey) {
    case 'SERVICE_BOOKING':
      return `নমস্কার ${name},\nMUN COMPUTER-এ আপনার "${service}"${ref} সার্ভিসটি বুক করা হয়েছে।\n${totalAmt > 0 ? `মোট চার্জ: ${formatINR(totalAmt)} | জমা: ${formatINR(paidAmt)} | বাকি: ${formatINR(dueAmt)}\n` : ''}বর্তমান স্ট্যাটাস: ${status}\nযে কোনো সাহায্যের জন্য যোগাযোগ করুন: +91 8101352105।`;

    case 'ORDER_READY':
      return `নমস্কার ${name},\nMUN COMPUTER থেকে শুভেচ্ছা! আপনার "${service}"${ref} কাজটি (${status}) সম্পন্ন হয়েছে। অনুগ্রহ করে দোকানে এসে সংগ্রহ করুন।\n${dueAmt > 0 ? `বাকি প্রদেয়: ${formatINR(dueAmt)}।\n` : ''}ঠিকানা: মামুদপুর, ডোমকল, মুর্শিদাবাদ।`;

    case 'PAYMENT_REMINDER':
      return `নমস্কার ${name},\nMUN COMPUTER থেকে জানানো হচ্ছে যে আপনার "${service}"${ref} বাবদ ${dueAmt > 0 ? formatINR(dueAmt) : 'বকেয়া বিল'} প্রদেয় রয়েছে।\nঅনুগ্রহ করে সুবিধামতো সময়ে পেমেন্ট সম্পন্ন করুন। ধন্যবাদ!`;

    case 'BILL_INVOICE':
      return `নমস্কার ${name},\nMUN COMPUTER-এ আপনার বিল/ইনভয়েস${ref} প্রস্তুত হয়েছে।\nপরিষেবা: ${service}\nমোট বিল: ${formatINR(totalAmt)} | জমা: ${formatINR(paidAmt)} | বাকি: ${formatINR(dueAmt)}\nধন্যবাদান্তে, MUN COMPUTER (+91 8101352105)`;

    case 'DIRECT_CHAT':
    default:
      return `নমস্কার ${name},\nMUN COMPUTER (Domkal, Murshidabad) থেকে যোগাযোগ করা হচ্ছে${ctx.serviceName ? ` (${service}${ref})` : ''}।`;
  }
}

/**
 * Render an inline WhatsApp Connect button suitable for tables & profile headers
 */
export function renderWhatsAppQuickButton(ctx = {}, compact = true) {
  const info = normalizeWhatsAppPhone(ctx.phone);
  const label = compact ? '💬 WA' : '💬 WhatsApp Connect';
  if (!info.valid) {
    return `<button type="button" class="btn btn-outline btn-sm" style="color:#64748b; border-color:#cbd5e1;" onclick="window.MJK.openWhatsAppConnectModal({ customerName: '${escJs(ctx.customerName || '')}', serviceName: '${escJs(ctx.serviceName || '')}', refNumber: '${escJs(ctx.refNumber || '')}', status: '${escJs(ctx.status || '')}', totalAmount: ${Number(ctx.totalAmount) || 0}, paidAmount: ${Number(ctx.paidAmount) || 0}, dueAmount: ${Number(ctx.dueAmount) || 0}, context: '${escJs(ctx.context || 'GENERAL')}' })" title="Enter mobile number to connect via WhatsApp">${label}</button>`;
  }

  return `
    <button
      type="button"
      class="btn btn-sm"
      style="background:#16a34a; color:#ffffff; border:1px solid #15803d; font-weight:700;"
      onclick="window.MJK.openWhatsAppConnectModal({
        phone: '${escJs(ctx.phone || '')}',
        customerName: '${escJs(ctx.customerName || '')}',
        serviceName: '${escJs(ctx.serviceName || '')}',
        refNumber: '${escJs(ctx.refNumber || '')}',
        status: '${escJs(ctx.status || '')}',
        totalAmount: ${Number(ctx.totalAmount) || 0},
        paidAmount: ${Number(ctx.paidAmount) || 0},
        dueAmount: ${Number(ctx.dueAmount) || 0},
        context: '${escJs(ctx.context || 'GENERAL')}'
      })"
      title="WhatsApp Connect (${esc(info.display)})"
    >${label}</button>
  `;
}

export function createWhatsAppHandlers({ openModal, closeModal, showToast }) {
  let activeCtx = {};

  function getDefaultTemplateForContext(ctx) {
    if (ctx.context === 'BILLING' && (Number(ctx.dueAmount) || 0) > 0) return 'PAYMENT_REMINDER';
    if (ctx.context === 'BILLING') return 'BILL_INVOICE';
    if (ctx.context === 'SERVICE') return 'SERVICE_BOOKING';
    return 'DIRECT_CHAT';
  }

  function updateModalPreview() {
    const phoneInput = document.getElementById('wa-connect-phone');
    const nameInput = document.getElementById('wa-connect-name');
    const serviceInput = document.getElementById('wa-connect-service');
    const msgInput = document.getElementById('wa-connect-message');
    const badgeEl = document.getElementById('wa-connect-url-badge');
    const directBtn = document.getElementById('wa-connect-launch-btn');
    const emptyChatBtn = document.getElementById('wa-connect-empty-btn');

    if (!phoneInput || !msgInput || !directBtn) return;

    const info = normalizeWhatsAppPhone(phoneInput.value);
    const fullUrl = buildWhatsAppUrl(phoneInput.value, msgInput.value);
    const baseUrl = info.baseUrl;

    if (badgeEl) {
      badgeEl.innerHTML = info.valid
        ? `<span style="color:#15803d; font-weight:700;">✓ Country Code (+91) Added:</span> <span class="font-mono" style="color:#1e40af;">${esc(baseUrl)}</span>`
        : `<span style="color:#b91c1c; font-weight:600;">⚠ Enter a valid 10-digit Indian mobile number (e.g. 9876543210)</span>`;
    }

    if (info.valid) {
      directBtn.href = fullUrl;
      directBtn.style.pointerEvents = 'auto';
      directBtn.style.opacity = '1';
      if (emptyChatBtn) {
        emptyChatBtn.href = baseUrl;
        emptyChatBtn.style.pointerEvents = 'auto';
        emptyChatBtn.style.opacity = '1';
      }
    } else {
      directBtn.href = '#';
      directBtn.style.pointerEvents = 'none';
      directBtn.style.opacity = '0.5';
      if (emptyChatBtn) {
        emptyChatBtn.href = '#';
        emptyChatBtn.style.pointerEvents = 'none';
        emptyChatBtn.style.opacity = '0.5';
      }
    }

    if (nameInput) activeCtx.customerName = nameInput.value;
    if (serviceInput) activeCtx.serviceName = serviceInput.value;
  }

  function openWhatsAppConnectModal(ctx = {}) {
    activeCtx = {
      phone: ctx.phone || '',
      customerName: ctx.customerName || '',
      serviceName: ctx.serviceName || '',
      refNumber: ctx.refNumber || '',
      status: ctx.status || '',
      totalAmount: Number(ctx.totalAmount) || 0,
      paidAmount: Number(ctx.paidAmount) || 0,
      dueAmount: Number(ctx.dueAmount) || 0,
      context: ctx.context || 'GENERAL'
    };

    const defaultTpl = getDefaultTemplateForContext(activeCtx);
    const initialMsg = ctx.customMessage || buildTemplateMessage(defaultTpl, activeCtx);
    const phoneInfo = normalizeWhatsAppPhone(activeCtx.phone);

    const content = `
      <div style="display:flex; flex-direction:column; gap:0.85rem;">
        <div style="background:linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border:1.5px solid #22c55e; border-radius:8px; padding:0.75rem 0.9rem;">
          <div style="font-weight:800; color:#166534; font-size:0.92rem; display:flex; align-items:center; gap:0.4rem;">
            <span>💬 Customer WhatsApp Auto Connect</span>
            <span class="badge badge-success" style="font-size:0.68rem;">+91 AUTO</span>
          </div>
          <div style="font-size:0.76rem; color:#14532d; margin-top:0.2rem;">
            গ্রাহকের মোবাইল নম্বর দিলেই স্বয়ংক্রিয়ভাবে +91 যুক্ত হয়ে সরাসরি WhatsApp Chat ওপেন হবে।
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Customer Mobile Number <span class="req">*</span></label>
            <input
              type="tel"
              id="wa-connect-phone"
              class="form-control font-mono"
              value="${esc(phoneInfo.clean10 || activeCtx.phone)}"
              placeholder="e.g. 9876543210"
              oninput="window.MJK.updateWhatsAppConnectPreview()"
            >
          </div>
          <div class="form-group">
            <label class="form-label">Customer Name</label>
            <input
              type="text"
              id="wa-connect-name"
              class="form-control"
              value="${esc(activeCtx.customerName)}"
              placeholder="Customer Name"
              oninput="window.MJK.updateWhatsAppConnectPreview()"
            >
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Service / Billing Details (Auto-Fill)</label>
            <input
              type="text"
              id="wa-connect-service"
              class="form-control"
              value="${esc(activeCtx.serviceName)}"
              placeholder="e.g. PAN Card / Income Certificate / Invoice"
              oninput="window.MJK.updateWhatsAppConnectPreview()"
            >
          </div>
          <div class="form-group">
            <label class="form-label">Ready-Made Message Template</label>
            <select id="wa-connect-template" class="form-control" onchange="window.MJK.applyWhatsAppTemplate(this.value)">
              <option value="DIRECT_CHAT" ${defaultTpl === 'DIRECT_CHAT' ? 'selected' : ''}>Direct Greeting (সাধারণ মেসেজ)</option>
              <option value="SERVICE_BOOKING" ${defaultTpl === 'SERVICE_BOOKING' ? 'selected' : ''}>Service Booking Confirmation</option>
              <option value="ORDER_READY" ${defaultTpl === 'ORDER_READY' ? 'selected' : ''}>Service Ready / Delivery Notice</option>
              <option value="PAYMENT_REMINDER" ${defaultTpl === 'PAYMENT_REMINDER' ? 'selected' : ''}>Payment / Due Reminder</option>
              <option value="BILL_INVOICE" ${defaultTpl === 'BILL_INVOICE' ? 'selected' : ''}>Bill & Invoice Summary</option>
            </select>
          </div>
        </div>

        <div id="wa-connect-url-badge" style="padding:0.5rem 0.75rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:6px; font-size:0.78rem; word-break:break-all;"></div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Message Auto-Fill Preview (Editable)</label>
          <textarea id="wa-connect-message" class="form-control" rows="4" oninput="window.MJK.updateWhatsAppConnectPreview()">${esc(initialMsg)}</textarea>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">
            ℹ️ WhatsApp Connect বাটনে ক্লিক করলে অফিসিয়াল WhatsApp চ্যাট খুলবে — মেসেজ পাঠাতে WhatsApp-এ Send চাপুন।
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem;">
          <a
            id="wa-connect-empty-btn"
            href="${esc(phoneInfo.baseUrl || '#')}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-secondary btn-sm"
          >💬 Direct Chat Only (No Text)</a>

          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Close</button>
            <a
              id="wa-connect-launch-btn"
              href="${esc(buildWhatsAppUrl(activeCtx.phone, initialMsg) || '#')}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-success"
              style="background:#16a34a; border-color:#15803d; font-weight:800;"
              onclick="window.MJK.onWhatsAppAnchorClick(event)"
            >💬 WhatsApp Connect</a>
          </div>
        </div>
      </div>
    `;

    openModal('WhatsApp Auto Connect (MUN COMPUTER)', content, null);
    setTimeout(updateModalPreview, 30);
  }

  function applyWhatsAppTemplate(tplKey) {
    const nameEl = document.getElementById('wa-connect-name');
    const srvEl = document.getElementById('wa-connect-service');
    const msgEl = document.getElementById('wa-connect-message');
    if (!msgEl) return;
    const updatedCtx = {
      ...activeCtx,
      customerName: nameEl ? nameEl.value : activeCtx.customerName,
      serviceName: srvEl ? srvEl.value : activeCtx.serviceName
    };
    msgEl.value = buildTemplateMessage(tplKey, updatedCtx);
    updateModalPreview();
  }

  function launchDirectWhatsApp(phone, message = '') {
    const url = buildWhatsAppUrl(phone, message);
    if (!url) {
      showToast('Please enter a valid 10-digit customer mobile number.', 'warning');
      return false;
    }
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  function onWhatsAppAnchorClick(e) {
    const phoneInput = document.getElementById('wa-connect-phone');
    const info = normalizeWhatsAppPhone(phoneInput?.value || '');
    if (!info.valid) {
      e.preventDefault();
      showToast('Please enter a valid 10-digit Indian mobile number.', 'warning');
      return;
    }
    showToast(`Opening WhatsApp Chat for ${info.display}...`, 'success');
    setTimeout(() => {
      if (typeof closeModal === 'function') closeModal();
    }, 350);
  }

  return {
    openWhatsAppConnectModal,
    updateWhatsAppConnectPreview: updateModalPreview,
    applyWhatsAppTemplate,
    launchDirectWhatsApp,
    onWhatsAppAnchorClick
  };
}
