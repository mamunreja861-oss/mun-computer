/**
 * documentEngine.js - Unified Black & White Print, PDF, Billing & Custom UPI System
 * Official Shop: MUN COMPUTER
 *
 * Strictly enforces:
 * - Pure White (#FFFFFF) background & Pure Black (#000000) text/borders/rules
 * - Official MUN COMPUTER brand header & monochrome logo on every document
 * - Admin-controlled Original UPI QR & UPI ID (never generated or invented)
 * - Verbatim 12 Legal Terms & Conditions + IMPORTANT NOTICE
 * - Customer Acknowledgement & Signatories
 * - Automatic Page X of Y pagination & paper size support (A4 Portrait / A4 Landscape / A5 Receipt)
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  KEYS,
  getItem,
  setItem,
  formatDate,
  formatDateTime,
  getTodayDate,
  getNowISTString,
  numberToWords,
  getAuthHeaders,
  logAuditAction
} from './storage.js';
import { getBusinessProfile } from './business.js';
import { getCompanyProfileConfig, OFFICIAL_COMPANY_LOGO_PATH } from './companyConfig.js';

export const LEGAL_TERMS_CLAUSES = [
  '1. MUN COMPUTER is an independent private digital service and customer assistance centre, not a Government Office or Government Department.',
  '2. MUN COMPUTER provides digital services, online application assistance, documentation, printing, scanning, data entry and other customer facilitation services.',
  '3. No guarantee is provided regarding Government Scheme approval, financial assistance, subsidy, pension, benefits or application acceptance.',
  '4. Final approval, verification, processing and payment decisions belong entirely to the concerned Government Department or competent authority.',
  '5. Customers must provide correct, genuine and valid information and supporting documents. Customers are responsible for verifying their information before submission.',
  '6. Service charges collected are for the services provided by MUN COMPUTER. Government fees and third-party charges, if any, must be separately identified.',
  '7. Customers should verify the service details and applicable charges before making payment.',
  '8. Refund requests will be considered according to the service status and applicable refund policy. Charges for completed services and properly incurred non-refundable expenses may not be refundable.',
  '9. MUN COMPUTER is not responsible for delays, server failures, portal downtime or decisions made by external websites, banks or Government authorities.',
  '10. Customer documents and information will be handled for the requested services and related purposes, subject to applicable privacy and data protection laws.',
  '11. Customers may contact MUN COMPUTER for service-related queries, corrections and complaints.',
  '12. By accepting the service, the customer acknowledges the applicable charges and service conditions.'
];

export const LEGAL_IMPORTANT_NOTICE =
  'IMPORTANT NOTICE: MUN COMPUTER provides private digital assistance and facilitation services only. No Government benefit, approval or financial assistance is guaranteed.';

export function escDoc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatINRDoc(amount, showDecimals = false) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0
  }).format(num);
}

export function pdfCurrency(amount) {
  const num = Number(amount) || 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(num);
  return `Rs. ${formatted}`;
}

export function pdfPlain(v) {
  const raw = String(v ?? '')
    .replace(/₹/g, 'Rs.')
    .replace(/–|—/g, '-');
  const ascii = raw
    .replace(/[^\x20-\x7E\n\r]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  if (!ascii && raw.trim()) {
    return '[Regional Script - See Excel/Print]';
  }
  return ascii;
}

/* =========================================================================
   CENTRALIZED MUN COMPUTER BRAND PROFILE & OFFICIAL LOGO
   ========================================================================= */

export function getOfficialHeaderMeta() {
  const cfg = getCompanyProfileConfig();
  return {
    name: cfg.companyName,
    storeName: cfg.companyName,
    tagline: cfg.tagline,
    subBrand: '',
    addressLine1: cfg.addressLine1,
    addressLine2: cfg.addressLine2,
    address: cfg.address,
    phone: cfg.phone,
    whatsapp: cfg.whatsapp,
    email: cfg.email,
    tradeLicense: cfg.tradeLicense || '',
    gstin: cfg.gstin || '',
    authorizedSignatory: cfg.authorizedSignatory
  };
}

export const OFFICIAL_LOGO_URL = OFFICIAL_COMPANY_LOGO_PATH;

let _cachedPdfLogoAsset = null;
let _pdfLogoLoadPromise = null;

export function preloadOfficialLogoPdfAsset() {
  if (_cachedPdfLogoAsset) return Promise.resolve(_cachedPdfLogoAsset);
  if (_pdfLogoLoadPromise) return _pdfLogoLoadPromise;
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(null);
  }
  _pdfLogoLoadPromise = new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = img.naturalWidth || 640;
          const h = img.naturalHeight || 200;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          _cachedPdfLogoAsset = {
            dataUrl: canvas.toDataURL('image/png'),
            aspectRatio: w / h
          };
          resolve(_cachedPdfLogoAsset);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = OFFICIAL_LOGO_URL;
    } catch {
      resolve(null);
    }
  });
  return _pdfLogoLoadPromise;
}

if (typeof window !== 'undefined') {
  preloadOfficialLogoPdfAsset();
}

export function getMonochromeLogoSvg(width = 148) {
  return `
    <img
      src="${OFFICIAL_LOGO_URL}"
      alt="MUN COMPUTER"
      style="width:${width}px; max-width:100%; height:auto; display:block; object-fit:contain; background:#ffffff; flex-shrink:0;"
    />
  `.trim();
}

/* =========================================================================
   ADMIN-CONTROLLED CUSTOM UPI QR CODE SETTINGS (NEVER INVENTED/GENERATED)
   ========================================================================= */

export function getEmptyUpiSettings() {
  return {
    upiId: '',
    upiDisplayName: '',
    paymentInstructions: '',
    qrImageDataUrl: '',
    qrImageMime: '',
    qrFileName: '',
    updatedAt: '',
    updatedByUid: '',
    updatedByName: ''
  };
}

export function getUpiPaymentSettings() {
  const stored = getItem(KEYS.UPI_PAYMENT_SETTINGS, null);
  if (!stored || typeof stored !== 'object') return getEmptyUpiSettings();
  return {
    ...getEmptyUpiSettings(),
    upiId: String(stored.upiId || ''),
    upiDisplayName: String(stored.upiDisplayName || ''),
    paymentInstructions: String(stored.paymentInstructions || ''),
    qrImageDataUrl: String(stored.qrImageDataUrl || ''),
    qrImageMime: String(stored.qrImageMime || ''),
    qrFileName: String(stored.qrFileName || ''),
    updatedAt: String(stored.updatedAt || ''),
    updatedByUid: String(stored.updatedByUid || ''),
    updatedByName: String(stored.updatedByName || '')
  };
}

export async function syncUpiSettingsFromServer() {
  try {
    const res = await fetch('/api/settings/upi', {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) return getUpiPaymentSettings();
    const data = await res.json();
    if (data?.success && data.settings) {
      setItem(KEYS.UPI_PAYMENT_SETTINGS, data.settings);
      return data.settings;
    }
  } catch {
    // offline/fallback cleanly to localStorage
  }
  return getUpiPaymentSettings();
}

export async function saveUpiPaymentSettings({ upiId, upiDisplayName, paymentInstructions, qrImageDataUrl, qrFileName, clearQr = false }) {
  const payload = {
    upiId: String(upiId || '').trim(),
    upiDisplayName: String(upiDisplayName || '').trim(),
    paymentInstructions: String(paymentInstructions || '').trim(),
    clearQr: Boolean(clearQr)
  };
  if (typeof qrImageDataUrl === 'string' && qrImageDataUrl.length > 0) {
    payload.qrImageDataUrl = qrImageDataUrl;
    payload.qrFileName = String(qrFileName || 'upi-qr-code');
  }

  const res = await fetch('/api/settings/upi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || 'Failed to save UPI Payment Settings (Admin authentication required).');
  }
  setItem(KEYS.UPI_PAYMENT_SETTINGS, data.settings);
  logAuditAction('UPI_SETTINGS_UPDATE', `Updated Admin UPI Settings (UPI ID: ${data.settings.upiId || 'Not Set'})`);
  return data.settings;
}

export async function removeUpiQrImage() {
  const res = await fetch('/api/settings/upi/qr', {
    method: 'DELETE',
    headers: { ...getAuthHeaders() }
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || 'Failed to remove UPI QR image.');
  }
  setItem(KEYS.UPI_PAYMENT_SETTINGS, data.settings);
  logAuditAction('UPI_QR_REMOVED', 'Admin removed uploaded UPI QR Code image.');
  return data.settings;
}

/* =========================================================================
   STRICT BLACK & WHITE DOCUMENT CSS & HTML RENDERERS
   ========================================================================= */

export function getBwDocumentCssBlock() {
  return `
    .mun-bw-doc,
    .mun-bw-doc * {
      box-sizing: border-box;
      color: #000000 !important;
      border-color: #000000 !important;
    }
    .mun-bw-doc {
      background: #ffffff !important;
      color: #000000 !important;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9.5pt;
      line-height: 1.4;
      width: 100%;
    }
    .mun-bw-doc div,
    .mun-bw-doc span,
    .mun-bw-doc p,
    .mun-bw-doc td,
    .mun-bw-doc th,
    .mun-bw-doc section,
    .mun-bw-doc header,
    .mun-bw-doc footer {
      background-color: #ffffff !important;
      background-image: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
    .mun-bw-doc .mun-bw-invert {
      background-color: #000000 !important;
      color: #ffffff !important;
    }
    .mun-bw-doc .mun-bw-invert * {
      background-color: #000000 !important;
      color: #ffffff !important;
    }
    .mun-bw-doc table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    .mun-bw-doc thead {
      display: table-header-group;
    }
    .mun-bw-doc tr,
    .mun-bw-doc .a4-avoid-break {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .mun-bw-doc th,
    .mun-bw-doc td {
      border: 1px solid #000000 !important;
      padding: 5px 7px;
      vertical-align: top;
      text-align: left;
      font-size: 8.8pt;
    }
    .mun-bw-doc th {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8pt;
      border-bottom: 2px solid #000000 !important;
    }
    .mun-bw-doc .text-right { text-align: right !important; }
    .mun-bw-doc .text-center { text-align: center !important; }
    .mun-bw-doc .font-mono { font-family: 'Courier New', Courier, monospace; }
    .mun-bw-doc .tabular-nums { font-variant-numeric: tabular-nums; }
  `;
}

export function renderBwDocumentHeader({
  docTitle = 'DOCUMENT',
  docNumber = '',
  docDateTime = '',
  statusText = '',
  serviceRefNumber = '',
  extraRightLines = []
}) {
  const brand = getOfficialHeaderMeta();
  return `
    <div class="a4-avoid-break" style="margin-bottom:10px;">
      <!-- Official MUN COMPUTER Letterhead Frame matching uploaded HEADER_12a7d62f.png -->
      <div class="mun-letterhead-frame" style="border:1.5px solid #0b3b8c; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; background:#ffffff;">
        <div style="flex:0 0 auto; display:flex; align-items:center; justify-content:center;">
          ${getMonochromeLogoSvg(156)}
        </div>
        <div style="flex:1 1 280px; text-align:center; font-family:Georgia, 'Times New Roman', serif; line-height:1.55;">
          <div style="font-size:12pt; font-weight:800; letter-spacing:0.35px; color:#0b3b8c !important; margin-bottom:1px;">
            ${escDoc(brand.storeName)}${brand.subBrand ? ` &middot; ${escDoc(brand.subBrand)}` : ''}
          </div>
          ${brand.tagline ? `
            <div style="font-size:7.6pt; font-family:Arial, Helvetica, sans-serif; color:#334155 !important; letter-spacing:0.15px; margin-bottom:2px;">
              ${escDoc(brand.tagline)}
            </div>
          ` : ''}
          <div style="font-size:9pt;">
            <strong>Address:</strong> ${escDoc(brand.addressLine1)}
          </div>
          <div style="font-size:9pt;">
            ${escDoc(brand.addressLine2)}
          </div>
          <div style="font-size:9pt;">
            <strong>Phone / WhatsApp:</strong> ${escDoc(brand.phone)} &nbsp;|&nbsp; <strong>Email:</strong> ${escDoc(brand.email)}
          </div>
          ${(brand.tradeLicense || brand.gstin) ? `
            <div style="font-size:7.6pt; font-family:Arial, Helvetica, sans-serif; margin-top:2px;">
              ${brand.tradeLicense ? `<strong>Trade Lic.:</strong> ${escDoc(brand.tradeLicense)}` : ''}
              ${brand.tradeLicense && brand.gstin ? ' &middot; ' : ''}
              ${brand.gstin ? `<strong>GSTIN:</strong> ${escDoc(brand.gstin)}` : ''}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Dashed horizontal letterhead separator -->
      <div style="border-bottom:1.5px dashed #0b3b8c; margin:7px 0;"></div>

      <!-- Document Title & Reference Strip -->
      <div style="border-bottom:2px solid #0b3b8c; padding:5px 6px 7px 6px; background:#f8fafc !important; display:flex; justify-content:space-between; align-items:flex-end; gap:10px; flex-wrap:wrap;">
        <div>
          <div style="font-size:11.5pt; font-weight:900; text-transform:uppercase; letter-spacing:0.35px; color:#0b3b8c !important;">${escDoc(docTitle)}</div>
          ${serviceRefNumber ? `<div style="font-size:8pt; margin-top:1px;"><strong>Service Ref:</strong> <span class="font-mono">${escDoc(serviceRefNumber)}</span></div>` : ''}
          ${extraRightLines.map(line => `<div style="font-size:8pt; margin-top:1px;">${escDoc(line)}</div>`).join('')}
        </div>
        <div style="text-align:right; font-size:8.4pt; line-height:1.4;">
          ${docNumber ? `<div><strong>Report / Doc ID:</strong> <span class="font-mono">${escDoc(docNumber)}</span></div>` : ''}
          <div><strong>Generated:</strong> ${escDoc(docDateTime || getNowISTString())}</div>
          ${statusText ? `<div><strong>Status:</strong> <strong>${escDoc(statusText).toUpperCase()}</strong></div>` : ''}
        </div>
      </div>
    </div>
  `;
}

export function renderCustomerMetaBlock({
  customerName = 'Walk-in Customer',
  customerAddress = '',
  mobileNumber = '',
  customerId = '',
  serviceRefNumber = '',
  extraPairs = []
}) {
  const rightRows = [
    customerId ? `<div><strong>Customer ID:</strong> <span class="font-mono">${escDoc(customerId)}</span></div>` : '',
    serviceRefNumber ? `<div><strong>Service Ref #:</strong> <span class="font-mono">${escDoc(serviceRefNumber)}</span></div>` : '',
    ...extraPairs.filter(p => p && p.label && p.value).map(p => `<div><strong>${escDoc(p.label)}:</strong> ${escDoc(p.value)}</div>`)
  ].filter(Boolean);

  return `
    <div class="a4-avoid-break" style="border:1px solid #000000; padding:8px 10px; margin-bottom:12px; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; font-size:8.6pt;">
      <div style="flex:1 1 240px;">
        <div style="font-size:7.5pt; font-weight:700; text-transform:uppercase; border-bottom:1px solid #000000; padding-bottom:2px; margin-bottom:4px;">Customer / Party Details</div>
        <div><strong>Name:</strong> ${escDoc(customerName || 'Walk-in Customer')}</div>
        <div><strong>Mobile:</strong> <span class="font-mono">${escDoc(mobileNumber || '-')}</span></div>
        <div><strong>Address:</strong> ${escDoc(customerAddress || 'Local / Counter Customer')}</div>
      </div>
      ${rightRows.length > 0 ? `
        <div style="flex:0 1 220px; border-left:1px solid #000000; padding-left:10px;">
          <div style="font-size:7.5pt; font-weight:700; text-transform:uppercase; border-bottom:1px solid #000000; padding-bottom:2px; margin-bottom:4px;">Reference Details</div>
          ${rightRows.join('')}
        </div>
      ` : ''}
    </div>
  `;
}

export function renderOnlinePaymentUpiSection({ showAcceptedModes = true } = {}) {
  const upi = getUpiPaymentSettings();
  const hasQr = Boolean(upi.qrImageDataUrl);
  const hasUpi = Boolean(upi.upiId);

  return `
    <div class="a4-avoid-break" style="border:1.5px solid #000000; padding:10px 12px; margin:12px 0;">
      <div style="font-size:9.5pt; font-weight:900; text-transform:uppercase; border-bottom:1px solid #000000; padding-bottom:4px; margin-bottom:8px;">
        ONLINE PAYMENT – UPI
      </div>
      <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
        <div style="flex:0 0 auto; text-align:center;">
          ${hasQr ? `
            <div style="border:1px solid #000000; padding:4px; background:#ffffff; display:inline-block;">
              <img src="${upi.qrImageDataUrl}" alt="Admin UPI QR Code" style="width:110px; height:110px; object-fit:contain; display:block;" />
            </div>
          ` : `
            <div style="width:110px; height:110px; border:1px dashed #000000; display:flex; align-items:center; justify-content:center; text-align:center; padding:6px; font-size:7.5pt; font-weight:700;">
              OFFICIAL QR NOT UPLOADED BY ADMIN
            </div>
          `}
        </div>
        <div style="flex:1 1 220px; font-size:8.6pt; line-height:1.55;">
          <div style="font-weight:700; margin-bottom:3px;">Scan &amp; Pay Using Any UPI Application.</div>
          <div><strong>UPI ID:</strong> <span class="font-mono">${escDoc(upi.upiId || 'Not Configured (Set in Admin UPI Settings)')}</span></div>
          <div><strong>Payment Name:</strong> ${escDoc(upi.upiDisplayName || 'Not Configured')}</div>
          ${upi.paymentInstructions ? `<div style="margin-top:3px;"><strong>Instructions:</strong> ${escDoc(upi.paymentInstructions)}</div>` : ''}
          ${showAcceptedModes ? `
            <div style="margin-top:5px; border-top:1px dashed #000000; padding-top:4px; font-size:7.8pt;">
              <strong>Supported Payment Modes:</strong> Cash Payment · UPI Payment · Bank Transfer · Card Payment
            </div>
          ` : ''}
          <div style="margin-top:3px; font-size:7.4pt; font-style:italic;">
            ${hasUpi || hasQr
              ? 'Note: Payment status is updated only after verified UTR/transaction confirmation by MUN COMPUTER.'
              : 'Admin must upload the original UPI QR Code & UPI ID from Admin Control → UPI Payment Settings.'}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderLegalTermsSection() {
  return `
    <div class="a4-avoid-break" style="border:1px solid #000000; padding:9px 11px; margin:12px 0; font-size:7.5pt; line-height:1.42;">
      <div style="font-size:8.5pt; font-weight:900; text-transform:uppercase; border-bottom:1px solid #000000; padding-bottom:3px; margin-bottom:6px;">
        LEGAL TERMS &amp; CONDITIONS
      </div>
      <div style="display:flex; flex-direction:column; gap:2.5px;">
        ${LEGAL_TERMS_CLAUSES.map(clause => `<div>${escDoc(clause)}</div>`).join('')}
      </div>
      <div style="margin-top:7px; border:1.5px solid #000000; padding:5px 8px; font-weight:900; font-size:7.8pt;">
        ${escDoc(LEGAL_IMPORTANT_NOTICE)}
      </div>
    </div>
  `;
}

export function renderAcknowledgementSection({ includeCustomerSignature = true, dateStr = '' } = {}) {
  const brand = getOfficialHeaderMeta();
  return `
    <div class="a4-avoid-break" style="border-top:2px solid #000000; margin-top:14px; padding-top:9px; font-size:8.2pt;">
      <div style="border:1px solid #000000; padding:6px 8px; margin-bottom:14px; font-size:7.8pt;">
        <strong>CUSTOMER ACKNOWLEDGEMENT:</strong> I confirm that the details, service description, and charges stated in this document are verified by me, and I acknowledge the applicable Terms &amp; Conditions of ${escDoc(brand.name)}.
      </div>
      <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; margin-top:16px;">
        ${includeCustomerSignature ? `
          <div style="min-width:170px;">
            <div style="height:26px;"></div>
            <div style="border-top:1px solid #000000; padding-top:3px; font-weight:700;">Customer Signature</div>
            <div style="font-size:7.4pt;">Date: ${escDoc(dateStr || formatDate(getTodayDate()))}</div>
          </div>
        ` : ''}
        <div style="text-align:center; flex:1 1 180px; font-size:7.4pt;">
          <div><strong>Support &amp; Corrections:</strong> ${escDoc(brand.phone)}</div>
          <div>WhatsApp: ${escDoc(brand.whatsapp)} · ${escDoc(brand.email)}</div>
        </div>
        <div style="min-width:190px; text-align:right;">
          <div style="height:26px;"></div>
          <div style="border-top:1px solid #000000; padding-top:3px; font-weight:700;">Authorized Signature (${escDoc(brand.name)})</div>
          <div style="font-size:7.4pt;">Date: ${escDoc(dateStr || formatDate(getTodayDate()))}</div>
        </div>
      </div>
    </div>
  `;
}

/* =========================================================================
   TAILORED PRINTABLE DOCUMENT BUILDERS (ALL PURE BLACK & WHITE)
   ========================================================================= */

export function buildInvoiceDocumentHtml(inv) {
  const items = Array.isArray(inv.items) ? inv.items : [];
  const docTitle = String(inv.documentType || (Number(inv.taxAmount) > 0 ? 'Tax Invoice' : (Number(inv.balanceDue) > 0 ? 'Due Invoice' : 'Service Invoice'))).toUpperCase();
  const subtotal = Number(inv.subtotal) || items.reduce((s, it) => s + ((Number(it.qty) || 1) * (Number(it.unitPrice ?? it.rate) || 0)), 0);
  const discount = Number(inv.discount) || 0;
  const taxPercent = Number(inv.taxPercent) || 0;
  const taxAmount = Number(inv.taxAmount) || 0;
  const grandTotal = Number(inv.totalAmount) || Math.max(0, subtotal - discount + taxAmount);
  const paidAmount = Number(inv.paidAmount) || 0;
  const balanceDue = Math.max(0, grandTotal - paidAmount);
  const dateTimeStr = inv.createdAt ? formatDateTime(inv.createdAt) : `${formatDate(inv.date)} ${getNowISTString().split(',').pop() || ''}`;
  const split = inv.paymentSplit && typeof inv.paymentSplit === 'object' ? inv.paymentSplit : null;
  const splitParts = [];
  if (split) {
    if (Number(split.cash) > 0) splitParts.push(`Cash: ${formatINRDoc(split.cash)}`);
    if (Number(split.digital) > 0) splitParts.push(`${split.digitalMode || 'UPI'}: ${formatINRDoc(split.digital)}${split.verifiedDigital === false ? ' (Pending Verify)' : ''}`);
    if (balanceDue > 0) splitParts.push(`Due: ${formatINRDoc(balanceDue)}`);
  }

  return `
    <div class="mun-bw-doc">
      ${renderBwDocumentHeader({
        docTitle,
        docNumber: inv.id,
        docDateTime: dateTimeStr,
        statusText: inv.status || (balanceDue > 0 ? (paidAmount > 0 ? 'Partially Paid' : 'Unpaid') : 'Paid'),
        serviceRefNumber: inv.serviceRefNumber || '',
        extraRightLines: inv.paymentMode ? [`Payment Mode: ${inv.paymentMode}`] : []
      })}

      ${renderCustomerMetaBlock({
        customerName: inv.customerName,
        customerAddress: inv.address,
        mobileNumber: inv.phone,
        customerId: inv.customerId,
        serviceRefNumber: inv.serviceRefNumber,
        extraPairs: [
          ...(inv.transactionId ? [{ label: 'Txn / UTR', value: inv.transactionId }] : []),
          ...(splitParts.length > 0 ? [{ label: 'Payment Split', value: splitParts.join(' · ') }] : [])
        ]
      })}

      <table>
        <thead>
          <tr>
            <th style="width:36px;" class="text-center">#</th>
            <th>Service Name</th>
            <th>Service Description</th>
            <th style="width:52px;" class="text-center">Qty</th>
            <th style="width:85px;" class="text-right">Rate</th>
            <th style="width:95px;" class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => {
            const qty = Number(item.qty) || 1;
            const rate = Number(item.unitPrice ?? item.rate) || 0;
            const amt = Number(item.amount) || (qty * rate);
            const name = item.serviceName || item.title || item.desc || item.description || 'Service Item';
            const desc = item.description && item.serviceName ? item.description : (item.notes || item.category || '-');
            return `
              <tr>
                <td class="text-center tabular-nums">${idx + 1}</td>
                <td><strong>${escDoc(name)}</strong></td>
                <td>${escDoc(desc)}</td>
                <td class="text-center tabular-nums">${qty}</td>
                <td class="text-right font-mono tabular-nums">${formatINRDoc(rate)}</td>
                <td class="text-right font-mono tabular-nums"><strong>${formatINRDoc(amt)}</strong></td>
              </tr>
            `;
          }).join('') || '<tr><td colspan="6" class="text-center">No line items</td></tr>'}
        </tbody>
      </table>

      <div class="a4-avoid-break" style="display:flex; justify-content:space-between; align-items:flex-start; gap:14px; flex-wrap:wrap; margin-bottom:10px;">
        <div style="flex:1 1 260px; border:1px solid #000000; padding:8px 10px; font-size:8.4pt; line-height:1.55;">
          <div><strong>Grand Total in Words:</strong> ${escDoc(numberToWords(grandTotal))}</div>
          <div><strong>Amount Paid in Words:</strong> ${escDoc(numberToWords(paidAmount))}</div>
          ${balanceDue > 0 ? `<div><strong>Balance Due in Words:</strong> ${escDoc(numberToWords(balanceDue))}</div>` : ''}
          ${splitParts.length > 0 ? `<div style="margin-top:4px; border-top:1px dashed #000000; padding-top:4px;"><strong>Split Settlement:</strong> ${escDoc(splitParts.join(' | '))}</div>` : ''}
          ${inv.notes ? `<div style="margin-top:4px; border-top:1px dashed #000000; padding-top:4px;"><strong>Notes:</strong> ${escDoc(inv.notes)}</div>` : ''}
        </div>
        <table style="width:255px; margin-bottom:0;">
          <tbody>
            <tr><td><strong>Subtotal</strong></td><td class="text-right font-mono tabular-nums">${formatINRDoc(subtotal)}</td></tr>
            ${discount > 0 ? `<tr><td><strong>Discount</strong></td><td class="text-right font-mono tabular-nums">-${formatINRDoc(discount)}</td></tr>` : ''}
            ${taxPercent > 0 || taxAmount > 0 ? `<tr><td><strong>GST / Tax (${taxPercent}%)</strong></td><td class="text-right font-mono tabular-nums">${formatINRDoc(taxAmount)}</td></tr>` : ''}
            <tr><td style="border-top:2px solid #000000;"><strong>GRAND TOTAL</strong></td><td class="text-right font-mono tabular-nums" style="border-top:2px solid #000000;"><strong>${formatINRDoc(grandTotal)}</strong></td></tr>
            ${split && Number(split.cash) > 0 ? `<tr><td>Cash Paid</td><td class="text-right font-mono tabular-nums">${formatINRDoc(split.cash)}</td></tr>` : ''}
            ${split && Number(split.digital) > 0 ? `<tr><td>${escDoc(split.digitalMode || 'UPI')} Paid</td><td class="text-right font-mono tabular-nums">${formatINRDoc(split.digital)}</td></tr>` : ''}
            <tr><td><strong>Amount Paid</strong></td><td class="text-right font-mono tabular-nums">${formatINRDoc(paidAmount)}</td></tr>
            <tr><td><strong>Balance Due</strong></td><td class="text-right font-mono tabular-nums"><strong>${formatINRDoc(balanceDue)}</strong></td></tr>
          </tbody>
        </table>
      </div>

      ${renderOnlinePaymentUpiSection()}
      ${renderLegalTermsSection()}
      ${renderAcknowledgementSection({ includeCustomerSignature: true, dateStr: formatDate(inv.date) })}
    </div>
  `;
}

export function buildThermalInvoiceReceiptHtml(inv) {
  const brand = getOfficialHeaderMeta();
  const upi = getUpiPaymentSettings();
  const items = Array.isArray(inv.items) ? inv.items : [];
  const subtotal = Number(inv.subtotal) || items.reduce((s, it) => s + ((Number(it.qty) || 1) * (Number(it.unitPrice ?? it.rate) || 0)), 0);
  const discount = Number(inv.discount) || 0;
  const taxPercent = Number(inv.taxPercent ?? inv.taxRate) || 0;
  const taxAmount = Number(inv.taxAmount ?? inv.gstAmount) || 0;
  const grandTotal = Number(inv.totalAmount ?? inv.grandTotal) || Math.max(0, subtotal - discount + taxAmount);
  const paidAmount = Number(inv.paidAmount) || 0;
  const balanceDue = Math.max(0, grandTotal - paidAmount);
  const dateTimeStr = inv.createdAt ? formatDateTime(inv.createdAt) : `${formatDate(inv.date)}`;
  const split = inv.paymentSplit && typeof inv.paymentSplit === 'object' ? inv.paymentSplit : null;

  return `
    <div class="mun-bw-doc" style="width:100%; max-width:74mm; margin:0 auto; font-family:'JetBrains Mono', 'Courier New', monospace; font-size:8.2pt; line-height:1.35; color:#000000;">
      <div style="text-align:center; border-bottom:1.5px dashed #000000; padding-bottom:6px; margin-bottom:6px;">
        <div style="font-size:11.5pt; font-weight:900; letter-spacing:0.04em;">${escDoc(brand.name)}</div>
        <div style="font-size:7.2pt; font-weight:700;">${escDoc(brand.tagline || 'Digital Solutions & Utility Hub')}</div>
        <div style="font-size:7pt; margin-top:2px;">${escDoc(brand.addressLine1 || 'Domkal, Murshidabad, WB - 742303')}</div>
        <div style="font-size:7pt;">Mob: ${escDoc(brand.phone || '+91 8101352105')}</div>
        ${brand.gstin ? `<div style="font-size:7pt;">GSTIN: ${escDoc(brand.gstin)}</div>` : ''}
      </div>

      <div style="font-size:7.6pt; border-bottom:1px dashed #000000; padding-bottom:5px; margin-bottom:5px;">
        <div style="display:flex; justify-content:space-between;"><span><strong>BILL NO:</strong> ${escDoc(inv.id)}</span><span><strong>${escDoc(inv.status || 'FINAL')}</strong></span></div>
        <div><strong>DATE:</strong> ${escDoc(dateTimeStr)}</div>
        <div><strong>CUST:</strong> ${escDoc(inv.customerName || 'Walk-in Customer')}</div>
        ${inv.phone ? `<div><strong>MOB:</strong> ${escDoc(inv.phone)}</div>` : ''}
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:7.5pt; margin-bottom:6px;">
        <thead>
          <tr style="border-bottom:1px solid #000000;">
            <th style="text-align:left; padding:2px 0;">ITEM</th>
            <th style="text-align:center; padding:2px 2px;">QTY</th>
            <th style="text-align:right; padding:2px 2px;">RATE</th>
            <th style="text-align:right; padding:2px 0;">AMT</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it) => {
            const qty = Number(it.qty) || 1;
            const rate = Number(it.unitPrice ?? it.rate) || 0;
            const amt = Number(it.amount) || (qty * rate);
            const title = it.serviceName || it.title || it.desc || 'Item';
            return `
              <tr style="border-bottom:1px dotted #000000;">
                <td style="padding:3px 2px 3px 0; font-weight:700; word-break:break-word;">${escDoc(title)}</td>
                <td style="text-align:center; padding:3px 2px;">${qty}</td>
                <td style="text-align:right; padding:3px 2px;">${rate}</td>
                <td style="text-align:right; padding:3px 0; font-weight:700;">${amt.toFixed(0)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="border-top:1px dashed #000000; padding-top:4px; font-size:7.8pt;">
        <div style="display:flex; justify-content:space-between;"><span>Subtotal</span><span>${formatINRDoc(subtotal)}</span></div>
        ${discount > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Discount</span><span>-${formatINRDoc(discount)}</span></div>` : ''}
        ${taxAmount > 0 ? `<div style="display:flex; justify-content:space-between;"><span>GST (${taxPercent}%)</span><span>${formatINRDoc(taxAmount)}</span></div>` : ''}
        <div style="display:flex; justify-content:space-between; font-size:9.8pt; font-weight:900; border-top:1.5px solid #000000; border-bottom:1.5px solid #000000; padding:3px 0; margin:4px 0;">
          <span>GRAND TOTAL</span><span>${formatINRDoc(grandTotal)}</span>
        </div>
        ${split && Number(split.cash) > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Cash Paid</span><span>${formatINRDoc(split.cash)}</span></div>` : ''}
        ${split && Number(split.digital) > 0 ? `<div style="display:flex; justify-content:space-between;"><span>${escDoc(split.digitalMode || 'UPI')} Paid</span><span>${formatINRDoc(split.digital)}</span></div>` : ''}
        <div style="display:flex; justify-content:space-between; font-weight:700;"><span>Total Paid (${escDoc(inv.paymentMode || 'Cash')})</span><span>${formatINRDoc(paidAmount)}</span></div>
        <div style="display:flex; justify-content:space-between; font-weight:800;"><span>Balance Due</span><span>${formatINRDoc(balanceDue)}</span></div>
        ${inv.transactionId ? `<div style="font-size:7pt; margin-top:2px;">UTR/Ref: ${escDoc(inv.transactionId)}</div>` : ''}
      </div>

      ${upi.upiId ? `
        <div style="border-top:1px dashed #000000; margin-top:6px; padding-top:4px; text-align:center; font-size:7pt;">
          <strong>UPI ID:</strong> ${escDoc(upi.upiId)}
        </div>
      ` : ''}

      <div style="border-top:1.5px dashed #000000; margin-top:6px; padding-top:5px; text-align:center; font-size:7pt;">
        <div style="font-weight:800;">THANK YOU FOR VISITING MUN COMPUTER</div>
        <div>Private Digital Assistance &amp; Retail Receipt</div>
        <div>Support: ${escDoc(brand.whatsapp || brand.phone)}</div>
      </div>
    </div>
  `;
}

export function buildServiceReceiptDocumentHtml(receiptServices, displayReceiptId, primary, customerObj = null) {
  const totalShop = receiptServices.reduce((s, item) => s + (Number(item.serviceCharge) || 0), 0);
  const totalGov = receiptServices.reduce((s, item) => s + (Number(item.govFee) || 0), 0);
  const totalOther = receiptServices.reduce((s, item) => s + (Number(item.otherCharges) || 0), 0);
  const grandTotal = receiptServices.reduce((s, item) => s + (Number(item.totalAmount) || 0), 0);
  const totalPaid = receiptServices.reduce((s, item) => s + (Number(item.paidAmount) || 0), 0);
  const totalDue = Math.max(0, grandTotal - totalPaid);
  const statusText = totalDue === 0 && grandTotal > 0 ? 'Paid' : (totalPaid > 0 ? 'Partially Paid' : 'Unpaid');

  return `
    <div class="mun-bw-doc">
      ${renderBwDocumentHeader({
        docTitle: receiptServices.length > 1 ? 'CONSOLIDATED SERVICE RECEIPT' : 'SERVICE RECEIPT & ACKNOWLEDGEMENT',
        docNumber: displayReceiptId,
        docDateTime: primary.createdAt ? formatDateTime(primary.createdAt) : formatDate(primary.appDate),
        statusText,
        serviceRefNumber: primary.refNumber || '',
        extraRightLines: primary.paymentMode ? [`Payment Mode: ${primary.paymentMode}`] : []
      })}

      ${renderCustomerMetaBlock({
        customerName: primary.customerName,
        customerAddress: customerObj?.address || primary.address || '',
        mobileNumber: primary.phone || customerObj?.phone || '',
        customerId: primary.customerId || '',
        serviceRefNumber: primary.refNumber || '',
        extraPairs: [{ label: 'Total Items', value: String(receiptServices.length) }]
      })}

      <table>
        <thead>
          <tr>
            <th style="width:32px;" class="text-center">#</th>
            <th>Service Name</th>
            <th>Description / Ref &amp; Delivery</th>
            <th style="width:45px;" class="text-center">Qty</th>
            <th style="width:82px;" class="text-right">Rate</th>
            <th style="width:88px;" class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${receiptServices.map((item, idx) => {
            const govPart = (Number(item.govFee) || 0) + (Number(item.otherCharges) || 0);
            const descParts = [
              item.category,
              item.subcategory,
              item.refNumber ? `Ref: ${item.refNumber}` : '',
              `Shop: ${formatINRDoc(item.serviceCharge || 0)}`,
              govPart > 0 ? `Govt/3rd Party: ${formatINRDoc(govPart)}` : '',
              item.deliveryDate ? `Delivery: ${formatDate(item.deliveryDate)}` : '',
              item.status ? `Status: ${item.status}` : ''
            ].filter(Boolean);
            return `
              <tr>
                <td class="text-center tabular-nums">${idx + 1}</td>
                <td><strong>${escDoc(item.serviceName)}</strong></td>
                <td style="font-size:8pt;">${escDoc(descParts.join(' · '))}</td>
                <td class="text-center tabular-nums">1</td>
                <td class="text-right font-mono tabular-nums">${formatINRDoc(item.totalAmount || 0)}</td>
                <td class="text-right font-mono tabular-nums"><strong>${formatINRDoc(item.totalAmount || 0)}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="a4-avoid-break" style="display:flex; justify-content:space-between; align-items:flex-start; gap:14px; flex-wrap:wrap; margin-bottom:10px;">
        <div style="flex:1 1 260px; border:1px solid #000000; padding:8px 10px; font-size:8.4pt; line-height:1.55;">
          <div><strong>Fee Bifurcation:</strong> Shop Charge ${formatINRDoc(totalShop)} · Govt/Third-Party Fee ${formatINRDoc(totalGov + totalOther)}</div>
          <div><strong>Grand Total in Words:</strong> ${escDoc(numberToWords(grandTotal))}</div>
          <div><strong>Amount Paid in Words:</strong> ${escDoc(numberToWords(totalPaid))}</div>
          ${totalDue > 0 ? `<div><strong>Balance Due in Words:</strong> ${escDoc(numberToWords(totalDue))}</div>` : ''}
        </div>
        <table style="width:255px; margin-bottom:0;">
          <tbody>
            <tr><td><strong>Subtotal</strong></td><td class="text-right font-mono tabular-nums">${formatINRDoc(grandTotal)}</td></tr>
            <tr><td><strong>Discount</strong></td><td class="text-right font-mono tabular-nums">${formatINRDoc(0)}</td></tr>
            <tr><td style="border-top:2px solid #000000;"><strong>GRAND TOTAL</strong></td><td class="text-right font-mono tabular-nums" style="border-top:2px solid #000000;"><strong>${formatINRDoc(grandTotal)}</strong></td></tr>
            <tr><td><strong>Amount Paid</strong></td><td class="text-right font-mono tabular-nums">${formatINRDoc(totalPaid)}</td></tr>
            <tr><td><strong>Balance Due</strong></td><td class="text-right font-mono tabular-nums"><strong>${formatINRDoc(totalDue)}</strong></td></tr>
          </tbody>
        </table>
      </div>

      ${renderOnlinePaymentUpiSection()}
      ${renderLegalTermsSection()}
      ${renderAcknowledgementSection({ includeCustomerSignature: true, dateStr: formatDate(primary.appDate) })}
    </div>
  `;
}

export function buildPaymentReceiptDocumentHtml(p, customerObj = null) {
  const isRefund = p.paymentStatus === 'Refunded';
  const docTitle = isRefund ? 'REFUND RECEIPT' : (p.collectionType === 'Instant Cash Collection' ? 'MONEY RECEIPT' : 'PAYMENT RECEIPT');
  const statusText = p.paymentStatus || (p.verificationStatus === 'PENDING_VERIFICATION' ? 'Unpaid (Pending Verification)' : (Number(p.remainingDue) > 0 ? 'Partially Paid' : 'Paid'));
  const dateTimeStr = p.paymentDateTime ? formatDateTime(p.paymentDateTime) : (p.createdAt ? formatDateTime(p.createdAt) : formatDate(p.paymentDate));

  return `
    <div class="mun-bw-doc">
      ${renderBwDocumentHeader({
        docTitle,
        docNumber: isRefund ? (p.refundId || p.id) : p.id,
        docDateTime: dateTimeStr,
        statusText,
        serviceRefNumber: p.receiptId || p.invoiceNumber || ''
      })}

      ${renderCustomerMetaBlock({
        customerName: p.customerName,
        customerAddress: customerObj?.address || '',
        mobileNumber: p.customerPhone || customerObj?.phone || '',
        customerId: p.customerId || '',
        serviceRefNumber: p.receiptId || p.invoiceNumber || '',
        extraPairs: [
          { label: 'Payment Mode', value: p.paymentMethod || 'Cash' },
          { label: 'Transaction ID / UTR', value: p.transactionId || '-' }
        ]
      })}

      <table class="a4-avoid-break">
        <thead>
          <tr>
            <th>Receipt / Payment Particulars</th>
            <th style="width:160px;">Reference / Mode</th>
            <th style="width:120px;" class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${escDoc(p.collectionType || 'Service / Bill Payment')}</strong>
              <div style="font-size:8pt; margin-top:2px;">${escDoc(p.remarks || 'Payment received towards services at MUN COMPUTER')}</div>
              ${p.verifiedBy ? `<div style="font-size:7.6pt; margin-top:2px;">Verified By: ${escDoc(p.verifiedBy)} (${p.verifiedAt ? escDoc(formatDateTime(p.verifiedAt)) : ''})</div>` : ''}
            </td>
            <td style="font-size:8.2pt;">
              <div><strong>Mode:</strong> ${escDoc(p.paymentMethod || 'Cash')}</div>
              <div><strong>Txn/UTR:</strong> <span class="font-mono">${escDoc(p.transactionId || '-')}</span></div>
            </td>
            <td class="text-right font-mono tabular-nums"><strong>${formatINRDoc(p.paymentAmount)}</strong></td>
          </tr>
          ${isRefund ? `
            <tr>
              <td><strong>Refund Issued</strong> — ${escDoc(p.refundReason || 'Refund processed')}</td>
              <td style="font-size:8.2pt;">Refund ID: <span class="font-mono">${escDoc(p.refundId || '-')}</span></td>
              <td class="text-right font-mono tabular-nums"><strong>-${formatINRDoc(p.refundAmount || p.paymentAmount)}</strong></td>
            </tr>
          ` : ''}
          <tr>
            <td colspan="2"><strong>Payment Status</strong></td>
            <td class="text-right"><strong>${escDoc(statusText)}</strong></td>
          </tr>
          <tr>
            <td colspan="2"><strong>Outstanding Balance Due</strong></td>
            <td class="text-right font-mono tabular-nums"><strong>${formatINRDoc(p.remainingDue || 0)}</strong></td>
          </tr>
        </tbody>
      </table>

      <div class="a4-avoid-break" style="border:1px solid #000000; padding:8px 10px; margin-bottom:10px; font-size:8.5pt;">
        <div><strong>${isRefund ? 'Refund Amount in Words' : 'Received Amount in Words'}:</strong> ${escDoc(numberToWords(isRefund ? (p.refundAmount || p.paymentAmount) : p.paymentAmount))}</div>
        ${Number(p.remainingDue) > 0 ? `<div style="margin-top:2px;"><strong>Outstanding Balance in Words:</strong> ${escDoc(numberToWords(p.remainingDue))}</div>` : ''}
      </div>

      ${Number(p.remainingDue) > 0 || p.verificationStatus === 'PENDING_VERIFICATION' ? renderOnlinePaymentUpiSection() : ''}
      ${renderLegalTermsSection()}
      ${renderAcknowledgementSection({ includeCustomerSignature: true, dateStr: formatDate(p.paymentDate) })}
    </div>
  `;
}

export function buildPaymentVoucherDocumentHtml(exp) {
  const voucherNo = exp.voucherNumber || exp.id;
  return `
    <div class="mun-bw-doc">
      ${renderBwDocumentHeader({
        docTitle: 'PAYMENT VOUCHER',
        docNumber: voucherNo,
        docDateTime: exp.createdAt ? formatDateTime(exp.createdAt) : formatDate(exp.date),
        statusText: 'PAID / DISBURSED',
        serviceRefNumber: exp.billNumber || exp.id
      })}

      ${renderCustomerMetaBlock({
        customerName: exp.vendorName || 'Payee / Vendor',
        customerAddress: 'Vendor / Expense Counter Payee',
        mobileNumber: '-',
        customerId: exp.id,
        serviceRefNumber: exp.billNumber || '',
        extraPairs: [
          { label: 'Payment Mode', value: exp.paymentMethod || 'Cash' },
          { label: 'Paid By', value: exp.paidBy || 'MUN COMPUTER' }
        ]
      })}

      <table class="a4-avoid-break">
        <thead>
          <tr>
            <th style="width:40px;" class="text-center">#</th>
            <th>Expense Head / Category</th>
            <th>Particulars &amp; Remarks</th>
            <th style="width:120px;" class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="text-center">1</td>
            <td><strong>${escDoc(exp.category || 'General Expense')}</strong></td>
            <td>
              <strong>${escDoc(exp.title || 'Business Expense')}</strong>
              ${exp.remarks ? `<div style="font-size:8pt; margin-top:2px;">${escDoc(exp.remarks)}</div>` : ''}
            </td>
            <td class="text-right font-mono tabular-nums"><strong>${formatINRDoc(exp.amount)}</strong></td>
          </tr>
          <tr>
            <td colspan="3" class="text-right"><strong>TOTAL VOUCHER AMOUNT</strong></td>
            <td class="text-right font-mono tabular-nums"><strong>${formatINRDoc(exp.amount)}</strong></td>
          </tr>
        </tbody>
      </table>

      <div class="a4-avoid-break" style="border:1px solid #000000; padding:8px 10px; margin-bottom:14px; font-size:8.6pt;">
        <strong>Amount in Words:</strong> ${escDoc(numberToWords(exp.amount || 0))}
      </div>

      ${renderAcknowledgementSection({ includeCustomerSignature: true, dateStr: formatDate(exp.date) })}
    </div>
  `;
}

export function buildCustomerStatementDocumentHtml(customer, { services = [], payments = [], invoices = [], refunds = [] }) {
  const totalBilled = services.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0)
    + invoices.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
  const totalPaid = payments
    .filter(p => p.paymentStatus !== 'Refunded' && p.verificationStatus !== 'PENDING_VERIFICATION')
    .reduce((s, p) => s + (Number(p.paymentAmount) || 0), 0);
  const serviceDue = services.reduce((s, r) => s + Math.max(0, (Number(r.totalAmount) || 0) - (Number(r.paidAmount) || 0)), 0);
  const invDue = invoices.reduce((s, i) => s + Math.max(0, (Number(i.totalAmount) || 0) - (Number(i.paidAmount) || 0)), 0);
  const totalOutstanding = serviceDue + invDue;

  const entries = [];
  services.forEach(s => {
    entries.push({
      date: s.appDate || s.createdAt || '',
      ref: s.receiptId || s.id,
      type: 'Service Charge',
      particulars: `${s.serviceName} (${s.category || 'Service'}) · Status: ${s.status}`,
      debit: Number(s.totalAmount) || 0,
      credit: 0
    });
  });
  invoices.forEach(i => {
    entries.push({
      date: i.date || i.createdAt || '',
      ref: i.id,
      type: i.documentType || 'Invoice',
      particulars: `${(i.items || []).map(x => x.desc || x.description).filter(Boolean).join(', ') || 'Invoice Billing'} (${i.status})`,
      debit: Number(i.totalAmount) || 0,
      credit: 0
    });
  });
  payments.forEach(p => {
    const isApplied = p.paymentStatus !== 'Refunded' && p.verificationStatus !== 'PENDING_VERIFICATION';
    entries.push({
      date: p.paymentDate || p.createdAt || '',
      ref: p.id,
      type: `Payment (${p.paymentMethod})`,
      particulars: `${p.remarks || 'Payment received'} · Status: ${p.paymentStatus || 'Paid'} · Txn: ${p.transactionId || '-'}`,
      debit: 0,
      credit: isApplied ? (Number(p.paymentAmount) || 0) : 0
    });
  });
  refunds.forEach(r => {
    entries.push({
      date: r.refundDate || r.createdAt || '',
      ref: r.id,
      type: `Refund (${r.refundMode})`,
      particulars: `Refund against ${r.paymentId} · ${r.reason}`,
      debit: Number(r.refundAmount) || 0,
      credit: 0
    });
  });
  entries.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return `
    <div class="mun-bw-doc">
      ${renderBwDocumentHeader({
        docTitle: 'CUSTOMER ACCOUNT STATEMENT',
        docNumber: customer.id,
        docDateTime: getNowISTString(),
        statusText: totalOutstanding > 0 ? 'BALANCE DUE' : 'SETTLED'
      })}

      ${renderCustomerMetaBlock({
        customerName: customer.name,
        customerAddress: customer.address || `${customer.village || ''}, ${customer.district || ''}`,
        mobileNumber: customer.phone,
        customerId: customer.id,
        extraPairs: [
          { label: 'Services', value: String(services.length) },
          { label: 'Invoices', value: String(invoices.length) },
          { label: 'Payments', value: String(payments.length) }
        ]
      })}

      <table class="a4-avoid-break">
        <thead>
          <tr>
            <th>Total Billed Value</th>
            <th>Total Verified Payments</th>
            <th>Current Outstanding Due</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-mono tabular-nums"><strong>${formatINRDoc(totalBilled)}</strong></td>
            <td class="font-mono tabular-nums"><strong>${formatINRDoc(totalPaid)}</strong></td>
            <td class="font-mono tabular-nums"><strong>${formatINRDoc(totalOutstanding)}</strong> (${escDoc(numberToWords(totalOutstanding))})</td>
          </tr>
        </tbody>
      </table>

      <table>
        <thead>
          <tr>
            <th style="width:76px;">Date</th>
            <th style="width:105px;">Ref #</th>
            <th style="width:105px;">Type</th>
            <th>Particulars</th>
            <th style="width:82px;" class="text-right">Billed (Dr)</th>
            <th style="width:82px;" class="text-right">Paid (Cr)</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(e => `
            <tr>
              <td class="tabular-nums">${formatDate(e.date)}</td>
              <td class="font-mono" style="font-size:7.8pt;">${escDoc(e.ref)}</td>
              <td>${escDoc(e.type)}</td>
              <td>${escDoc(e.particulars)}</td>
              <td class="text-right font-mono tabular-nums">${e.debit > 0 ? formatINRDoc(e.debit) : '-'}</td>
              <td class="text-right font-mono tabular-nums">${e.credit > 0 ? formatINRDoc(e.credit) : '-'}</td>
            </tr>
          `).join('') || '<tr><td colspan="6" class="text-center">No ledger entries recorded for this customer.</td></tr>'}
        </tbody>
      </table>

      ${totalOutstanding > 0 ? renderOnlinePaymentUpiSection() : ''}
      ${renderAcknowledgementSection({ includeCustomerSignature: false })}
    </div>
  `;
}

/* =========================================================================
   PURE BLACK & WHITE jsPDF HELPERS (AUTO PAGE X OF Y + QR EMBEDDING)
   ========================================================================= */

async function resolveImageForPdf(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,/i);
  if (!match) return null;
  const rawType = match[1].toLowerCase();
  if (rawType === 'png') return { dataUrl, format: 'PNG' };
  if (rawType === 'jpeg' || rawType === 'jpg') return { dataUrl, format: 'JPEG' };
  // Convert WebP to PNG offscreen so jsPDF renders cleanly without modifying saved original
  try {
    const converted = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 300;
        canvas.height = img.naturalHeight || 300;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
    if (converted) return { dataUrl: converted, format: 'PNG' };
  } catch {
    return null;
  }
  return null;
}

function drawMunLogoVectorPdf(doc, x, y, scale = 1) {
  const s = (v) => v * scale;
  // Draw crisp MUN COMPUTER emblem & wordmark (~30mm x 20mm at scale=1)
  // Royal-blue M pillar
  doc.setFillColor(0, 43, 127);
  doc.rect(x + s(6), y + s(1), s(4.5), s(13), 'F');
  doc.rect(x + s(20), y + s(1), s(4.5), s(13), 'F');
  doc.triangle(x + s(8.5), y + s(1), x + s(15.2), y + s(9.5), x + s(11.2), y + s(9.5), 'F');
  doc.triangle(x + s(22), y + s(1), x + s(15.2), y + s(9.5), x + s(19.2), y + s(9.5), 'F');

  // Red diagonal orbit swoosh
  doc.setFillColor(225, 29, 29);
  doc.triangle(x + s(2.5), y + s(13.5), x + s(26.5), y + s(1.5), x + s(23.5), y + s(5), 'F');
  doc.triangle(x + s(2.5), y + s(13.5), x + s(7), y + s(14.2), x + s(23.5), y + s(5), 'F');

  // White laptop cutout at lower center
  doc.setFillColor(255, 255, 255);
  doc.rect(x + s(11), y + s(8), s(8.5), s(6.2), 'F');
  doc.setFillColor(0, 43, 127);
  doc.rect(x + s(12), y + s(8.6), s(6.5), s(4.2), 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(x + s(12.6), y + s(9.2), s(5.3), s(3), 'F');
  doc.setFillColor(0, 43, 127);
  doc.rect(x + s(10.6), y + s(13.3), s(9.3), s(1.1), 'F');

  // Pixel squares top-right
  doc.setFillColor(0, 43, 127);
  doc.rect(x + s(25.5), y + s(2), s(1.4), s(1.4), 'F');
  doc.rect(x + s(27.3), y + s(3.4), s(1.4), s(1.4), 'F');
  doc.setFillColor(225, 29, 29);
  doc.rect(x + s(27.3), y + s(1.3), s(1.4), s(1.4), 'F');

  // Condensed Bold MUN COMPUTER wordmark directly beneath
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5 * scale);
  doc.setTextColor(0, 43, 127);
  doc.text('MUN', x + s(5.2), y + s(19.8));
  doc.setTextColor(225, 29, 29);
  doc.text('COMPUTER', x + s(13.0), y + s(19.8));
  doc.setTextColor(0, 0, 0);
}

export function drawBwPdfHeader(doc, {
  docTitle = 'OFFICIAL REPORT',
  docNumber = '',
  docDateTime = '',
  metaLine = ''
}) {
  const brand = getOfficialHeaderMeta();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  const frameW = pageW - margin * 2;
  const isCompactWidth = pageW < 180;
  const logoScale = isCompactWidth ? 0.78 : 1;
  const hasRasterLogo = Boolean(_cachedPdfLogoAsset?.dataUrl);
  const logoColW = isCompactWidth
    ? (hasRasterLogo ? 38 : 29)
    : (hasRasterLogo ? 48 : 37);

  const textAreaLeft = margin + logoColW;
  const textAreaW = frameW - logoColW - 3;
  const textCenterX = textAreaLeft + textAreaW / 2;

  const titleFontSize = isCompactWidth ? 8.6 : 10.5;
  const taglineFontSize = isCompactWidth ? 6.2 : 7.0;
  const bodyFontSize = isCompactWidth ? 6.8 : 8.0;
  const lineStep = isCompactWidth ? 3.4 : 4.0;

  doc.setFont('times', 'bold');
  doc.setFontSize(titleFontSize);
  const headingText = brand.subBrand ? `${brand.storeName} · ${brand.subBrand}` : brand.storeName;
  const storeHeadingLines = doc.splitTextToSize(pdfPlain(headingText), textAreaW);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(taglineFontSize);
  const taglineLines = brand.tagline ? doc.splitTextToSize(pdfPlain(brand.tagline), textAreaW) : [];

  doc.setFont('times', 'normal');
  doc.setFontSize(bodyFontSize);
  const addr1Lines = doc.splitTextToSize(pdfPlain(`Address: ${brand.addressLine1}`), textAreaW);
  const addr2Lines = doc.splitTextToSize(pdfPlain(brand.addressLine2), textAreaW);
  const contactLines = doc.splitTextToSize(pdfPlain(`Phone / WhatsApp: ${brand.phone}  |  Email: ${brand.email}`), textAreaW);

  const totalTextHeight =
    storeHeadingLines.length * (lineStep + 0.5) +
    taglineLines.length * (lineStep - 0.5) +
    (addr1Lines.length + addr2Lines.length + contactLines.length) * lineStep;
  const rasterW = isCompactWidth ? 34 : 43;
  const rasterH = hasRasterLogo ? (rasterW / (_cachedPdfLogoAsset.aspectRatio || 3.1)) : 0;
  const logoHeight = hasRasterLogo ? rasterH : 20.5 * logoScale;
  const boxTop = 7;
  const boxH = Math.max(logoHeight + 6, totalTextHeight + 6.5);

  // Corporate Blue & White framed letterhead matching HEADER_12a7d62f.png
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(11, 59, 140);
  doc.setLineWidth(0.45);
  doc.rect(margin, boxTop, frameW, boxH, 'FD');

  // Left: Official MUN COMPUTER PNG logo (or crisp vector fallback) vertically centered
  const logoTop = boxTop + (boxH - logoHeight) / 2;
  if (hasRasterLogo) {
    try {
      doc.addImage(_cachedPdfLogoAsset.dataUrl, 'PNG', margin + (isCompactWidth ? 2.0 : 3.0), logoTop, rasterW, rasterH);
    } catch {
      drawMunLogoVectorPdf(doc, margin + (isCompactWidth ? 2.2 : 3.5), logoTop, logoScale);
    }
  } else {
    drawMunLogoVectorPdf(doc, margin + (isCompactWidth ? 2.2 : 3.5), logoTop, logoScale);
  }

  // Center/Right: Corporate Blue Company Name + Tagline + Address / Contact / Email
  let curY = boxTop + 4.8;
  doc.setTextColor(11, 59, 140);
  doc.setFont('times', 'bold');
  doc.setFontSize(titleFontSize);
  storeHeadingLines.forEach((ln) => {
    doc.text(ln, textCenterX, curY, { align: 'center' });
    curY += lineStep + 0.4;
  });

  if (taglineLines.length > 0) {
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(taglineFontSize);
    taglineLines.forEach((ln) => {
      doc.text(ln, textCenterX, curY, { align: 'center' });
      curY += lineStep - 0.5;
    });
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont('times', 'normal');
  doc.setFontSize(bodyFontSize);
  [addr1Lines, addr2Lines, contactLines].forEach((group) => {
    group.forEach((ln) => {
      doc.text(ln, textCenterX, curY, { align: 'center' });
      curY += lineStep;
    });
  });

  // Dashed horizontal separator
  const dashY = boxTop + boxH + 2.4;
  doc.setDrawColor(11, 59, 140);
  doc.setLineWidth(0.28);
  for (let dx = margin; dx < pageW - margin; dx += 2.6) {
    doc.line(dx, dashY, Math.min(dx + 1.5, pageW - margin), dashY);
  }

  // Document Title & Reference Strip
  let stripY = dashY + 5.0;
  doc.setTextColor(11, 59, 140);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isCompactWidth ? 8.8 : 10);
  const cleanTitle = pdfPlain(docTitle).toUpperCase();

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isCompactWidth ? 7.0 : 7.6);
  const rightMeta = pdfPlain([
    docNumber ? `ID: ${docNumber}` : '',
    `Generated: ${docDateTime || getNowISTString()}`
  ].filter(Boolean).join('  |  '));
  const rightMetaW = doc.getTextWidth(rightMeta);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isCompactWidth ? 8.8 : 10);
  const titleW = doc.getTextWidth(cleanTitle);

  if (titleW + rightMetaW + 8 > frameW) {
    doc.setTextColor(11, 59, 140);
    const titleLines = doc.splitTextToSize(cleanTitle, frameW);
    titleLines.forEach((ln) => {
      doc.text(ln, margin, stripY);
      stripY += 4.0;
    });
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isCompactWidth ? 7.0 : 7.6);
    doc.text(rightMeta, margin, stripY);
    stripY += 2.2;
  } else {
    doc.setTextColor(11, 59, 140);
    doc.text(cleanTitle, margin, stripY);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isCompactWidth ? 7.0 : 7.6);
    doc.text(rightMeta, pageW - margin, stripY, { align: 'right' });
    stripY += 2.2;
  }

  doc.setDrawColor(11, 59, 140);
  doc.setLineWidth(0.55);
  doc.line(margin, stripY, pageW - margin, stripY);
  doc.setTextColor(0, 0, 0);

  let nextY = stripY + 4.0;
  if (metaLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isCompactWidth ? 7.2 : 7.8);
    const lines = doc.splitTextToSize(pdfPlain(metaLine), frameW);
    doc.text(lines, margin, nextY);
    nextY += lines.length * 3.8 + 1.5;
  }
  return nextY;
}

export function getBwAutoTableStyles() {
  return {
    theme: 'grid',
    showHead: 'everyPage',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.1,
      textColor: [15, 23, 42],
      fillColor: [255, 255, 255],
      lineColor: [148, 163, 184],
      lineWidth: 0.25
    },
    headStyles: {
      fillColor: [11, 59, 140],
      textColor: [255, 255, 255],
      lineColor: [11, 59, 140],
      lineWidth: 0.35,
      fontStyle: 'bold',
      fontSize: 8.2
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [15, 23, 42],
      lineColor: [148, 163, 184]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    footStyles: {
      fillColor: [239, 246, 255],
      textColor: [11, 59, 140],
      lineColor: [11, 59, 140],
      lineWidth: 0.4,
      fontStyle: 'bold'
    }
  };
}

export function finalizeBwPdfPagination(doc, footerText = 'MUN COMPUTER — Official Black & White Document') {
  const totalPages = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(pdfPlain(footerText), margin, pageH - 6);
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
  }
}

export async function appendPdfUpiAndLegalBlocks(doc, {
  startY = 20,
  includeUpiBlock = false,
  includeLegalTerms = false,
  margin = 10,
  pageW = doc.internal.pageSize.getWidth(),
  pageH = doc.internal.pageSize.getHeight()
} = {}) {
  let y = startY;

  if (includeUpiBlock) {
    const upi = getUpiPaymentSettings();
    const boxH = 34;
    if (y + boxH > pageH - 16) {
      doc.addPage();
      y = 14;
    }
    doc.setDrawColor(11, 59, 140);
    doc.setLineWidth(0.45);
    doc.rect(margin, y, pageW - margin * 2, boxH, 'S');
    doc.setTextColor(11, 59, 140);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('ONLINE PAYMENT - UPI', margin + 3, y + 5);
    doc.line(margin, y + 6.5, pageW - margin, y + 6.5);
    doc.setTextColor(0, 0, 0);

    const qrImg = await resolveImageForPdf(upi.qrImageDataUrl);
    if (qrImg) {
      doc.addImage(qrImg.dataUrl, qrImg.format, margin + 3, y + 8, 24, 24);
    } else {
      doc.setLineWidth(0.2);
      doc.rect(margin + 3, y + 8, 24, 24, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('QR NOT SET', margin + 15, y + 20, { align: 'center' });
    }

    const tx = margin + 31;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Scan & Pay Using Any UPI Application.', tx, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(pdfPlain(`UPI ID: ${upi.upiId || 'Not Configured'}`), tx, y + 16.5);
    doc.text(pdfPlain(`Payment Name: ${upi.upiDisplayName || 'Not Configured'}`), tx, y + 20.5);
    if (upi.paymentInstructions) {
      doc.text(pdfPlain(`Instructions: ${upi.paymentInstructions}`).slice(0, 85), tx, y + 24.5);
    }
    doc.setFontSize(6.8);
    doc.text('Accepted: Cash Payment | UPI Payment | Bank Transfer | Card Payment', tx, y + 29);
    y += boxH + 4;
  }

  if (includeLegalTerms) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    const wrappedTerms = LEGAL_TERMS_CLAUSES.flatMap(c => doc.splitTextToSize(pdfPlain(c), pageW - margin * 2 - 4));
    const noticeLines = doc.splitTextToSize(pdfPlain(LEGAL_IMPORTANT_NOTICE), pageW - margin * 2 - 4);
    const neededH = 10 + (wrappedTerms.length + noticeLines.length) * 3.1;
    if (y + neededH > pageH - 16) {
      doc.addPage();
      y = 14;
    }
    doc.setDrawColor(11, 59, 140);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, pageW - margin * 2, neededH, 'S');
    doc.setTextColor(11, 59, 140);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('LEGAL TERMS & CONDITIONS', margin + 2.5, y + 4.5);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    let ty = y + 8;
    wrappedTerms.forEach(line => {
      doc.text(line, margin + 2.5, ty);
      ty += 3;
    });
    doc.setFont('helvetica', 'bold');
    noticeLines.forEach(line => {
      doc.text(line, margin + 2.5, ty + 1);
      ty += 3.2;
    });
    y += neededH + 4;
  }

  return y;
}

export async function generateBwTablePdf({
  filename = 'MUN_COMPUTER_Document',
  reportTitle = 'OFFICIAL REPORT',
  docNumber = '',
  metaLine = '',
  headers = [],
  rows = [],
  includeUpiBlock = false,
  includeLegalTerms = false,
  includeAcknowledgement = false,
  format = 'a4',
  orientation = 'portrait',
  footerNote = 'MUN COMPUTER · Digital Service & Customer Management'
}) {
  await preloadOfficialLogoPdfAsset();
  const doc = new jsPDF({
    orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: format === 'a5' ? 'a5' : 'a4'
  });

  const startY = drawBwPdfHeader(doc, {
    docTitle: reportTitle,
    docNumber,
    metaLine
  });

  const bwTheme = getBwAutoTableStyles();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  autoTable(doc, {
    head: [headers.map(pdfPlain)],
    body: rows.map(r => r.map(pdfPlain)),
    startY,
    margin: { left: margin, right: margin, bottom: 14 },
    ...bwTheme
  });

  let y = (doc.lastAutoTable?.finalY || startY + 20) + 5;
  y = await appendPdfUpiAndLegalBlocks(doc, {
    startY: y,
    includeUpiBlock,
    includeLegalTerms,
    margin,
    pageW,
    pageH
  });

  if (includeAcknowledgement) {
    if (y + 22 > pageH - 14) {
      doc.addPage();
      y = 14;
    }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text('Customer Acknowledgement: Verified service details, charges, and terms.', margin, y + 4);
    doc.line(margin, y + 16, margin + 45, y + 16);
    doc.text('Customer Signature', margin, y + 19.5);
    doc.line(pageW - margin - 52, y + 16, pageW - margin, y + 16);
    doc.text('Authorized Signature (MUN COMPUTER)', pageW - margin, y + 19.5, { align: 'right' });
  }

  finalizeBwPdfPagination(doc, footerNote);
  doc.save(`${filename}.pdf`);
}
