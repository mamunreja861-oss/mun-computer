/**
 * exportUtility.js - Universal Print, PDF, Excel (.xlsx), and CSV Export Utility
 * MUN COMPUTER Business Manager
 *
 * Single reusable export engine guaranteeing:
 * - Centralized MUN COMPUTER company header on every Print, PDF, Excel, and CSV output
 * - UTF-8 BOM (\uFEFF) CSV encoding for full Bengali + English Excel compatibility
 * - Auto-fitted columns & merged corporate letterhead headers in Excel (.xlsx)
 * - Corporate Blue & White A4/A5 PDF generation with repeating headers, Totals, Signature & Page X of Y
 * - Pure print-safe isolation via showA4PrintPdfPopup
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import {
  formatDate,
  formatINR,
  getTodayDate,
  getNowISTString
} from './storage.js';
import { getCompanyProfileConfig } from './companyConfig.js';
import {
  escDoc,
  pdfPlain,
  drawBwPdfHeader,
  getBwAutoTableStyles,
  finalizeBwPdfPagination,
  preloadOfficialLogoPdfAsset,
  renderBwDocumentHeader,
  renderAcknowledgementSection,
  renderOnlinePaymentUpiSection,
  renderLegalTermsSection,
  appendPdfUpiAndLegalBlocks
} from './documentEngine.js';
import { showA4PrintPdfPopup } from './a4PrintPopup.js';

function applyAutoTableSafe(doc, options) {
  if (typeof autoTable === 'function') {
    autoTable(doc, options);
  } else if (typeof doc?.autoTable === 'function') {
    doc.autoTable(options);
  }
}

let _ephemeralExportSeq = 0;

export function generateReportId(prefix = 'MUN-RPT') {
  const cleanPrefix = String(prefix || 'MUN-RPT')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  _ephemeralExportSeq += 1;
  const seq = String(_ephemeralExportSeq).padStart(4, '0');
  return `${cleanPrefix}-${y}${m}${d}-${seq}`;
}

export function sanitizeFilename(filename = 'MUN_COMPUTER_Export', ext = '') {
  const base = String(filename || 'MUN_COMPUTER_Export')
    .trim()
    .replace(new RegExp(`\\.${ext}$`, 'i'), '')
    .replace(/[^a-zA-Z0-9_\- ]+/g, '_')
    .replace(/\s+/g, '_');
  const today = getTodayDate();
  const withDate = base.includes(today) ? base : `${base}_${today}`;
  return ext ? `${withDate}.${ext}` : withDate;
}

function triggerBrowserBlobDownload(blob, downloadName) {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', downloadName);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1200);
  return true;
}

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '0';
  }
  let s = String(val);
  // Protect against spreadsheet formula injection while preserving plain numbers/negatives
  if (/^[=+@]/.test(s) || (/^-/.test(s) && !/^-\d+(\.\d+)?$/.test(s))) {
    s = `'${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Normalize flexible header/row formats into { keys, labels, matrix }
 */
export function normalizeTabularDataset(headers = [], rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  let resolvedHeaders = [];

  if (Array.isArray(headers) && headers.length > 0) {
    resolvedHeaders = headers.map((h, idx) => {
      if (typeof h === 'object' && h !== null) {
        return {
          key: h.key ?? idx,
          label: String(h.label ?? h.key ?? `Column ${idx + 1}`),
          align: h.align || ''
        };
      }
      return {
        key: idx,
        label: String(h),
        align: ''
      };
    });
  } else if (list.length > 0 && typeof list[0] === 'object' && list[0] !== null && !Array.isArray(list[0])) {
    resolvedHeaders = Object.keys(list[0]).map((k) => ({
      key: k,
      label: String(k).replace(/_/g, ' '),
      align: ''
    }));
  }

  const matrix = list.map((row) => {
    if (Array.isArray(row)) {
      return resolvedHeaders.map((_, i) => (row[i] === undefined || row[i] === null ? '' : row[i]));
    }
    if (row && typeof row === 'object') {
      return resolvedHeaders.map((h) => {
        const val = row[h.key] !== undefined ? row[h.key] : row[h.label];
        return val === undefined || val === null ? '' : val;
      });
    }
    return [row ?? ''];
  });

  return {
    headers: resolvedHeaders,
    labels: resolvedHeaders.map((h) => h.label),
    matrix
  };
}

function inferColumnAlignments(labels = [], matrix = [], explicitHeaders = []) {
  const styles = {};
  labels.forEach((lbl, idx) => {
    const explicitAlign = explicitHeaders[idx]?.align;
    if (explicitAlign) {
      styles[idx] = { halign: explicitAlign };
      return;
    }
    const lower = String(lbl || '').toLowerCase();
    if (lower === '#' || lower === 'sl' || lower === 's.no' || lower === 'sl.' || lower.includes('qty') || lower.includes('count')) {
      styles[idx] = { halign: 'center' };
      return;
    }
    const isNumericHeader = /(amount|total|price|rate|cost|fee|charge|paid|due|balance|cash|upi|bank|gst|tax|commission|salary|net|value|stock|profit|loss|income|expense|inr|₹)/i.test(lower);
    if (isNumericHeader) {
      styles[idx] = { halign: 'right' };
      return;
    }
    const sample = matrix.slice(0, 10).map((r) => r[idx]).filter((v) => v !== '' && v !== null && v !== undefined);
    if (sample.length > 0 && sample.every((v) => typeof v === 'number' || /^[-+]?\s*(?:₹|Rs\.?)?\s*[\d,]+(?:\.\d+)?$/.test(String(v).trim()))) {
      styles[idx] = { halign: 'right' };
    }
  });
  return styles;
}

/* =========================================================================
   1. UNIVERSAL CSV EXPORT (WITH UTF-8 BOM & COMPANY HEADER + TOTALS)
   ========================================================================= */

export function buildUniversalCsvContent({
  title = '',
  reportTitle = '',
  reportId = '',
  statusLabel = '',
  status = '',
  subtitle = '',
  generatedAt = '',
  headers = [],
  rows = [],
  totalsRow = null,
  emptyNote = '',
  emptyMessage = ''
} = {}) {
  const cfg = getCompanyProfileConfig();
  const rptTitle = title || reportTitle || 'OFFICIAL REPORT';
  const rptStatus = statusLabel || status || 'VERIFIED';
  const rptEmpty = emptyNote || emptyMessage || 'No records available for the selected criteria.';
  const rptId = reportId || generateReportId('MUN-CSV');
  const genTime = generatedAt || getNowISTString();
  const { labels, matrix } = normalizeTabularDataset(headers, rows);

  const lines = [];
  lines.push([cfg.companyName, cfg.tagline].map(escapeCsvCell).join(','));
  lines.push(['Address', cfg.address].map(escapeCsvCell).join(','));
  lines.push(['Contact', `Phone: ${cfg.phone} | Email: ${cfg.email}`].map(escapeCsvCell).join(','));
  lines.push(['Document Title', String(rptTitle).toUpperCase(), 'Report / Document ID', rptId].map(escapeCsvCell).join(','));
  lines.push(['Generated On', genTime, 'Status', String(rptStatus).toUpperCase()].map(escapeCsvCell).join(','));
  if (subtitle) {
    lines.push(['Report Scope / Filter', subtitle].map(escapeCsvCell).join(','));
  }
  lines.push('');

  if (labels.length > 0) {
    lines.push(labels.map(escapeCsvCell).join(','));
  }

  if (matrix.length > 0) {
    matrix.forEach((rowArr) => {
      lines.push(rowArr.map(escapeCsvCell).join(','));
    });
  } else {
    const emptyArr = labels.length > 0
      ? [rptEmpty, ...labels.slice(1).map(() => '')]
      : [rptEmpty];
    lines.push(emptyArr.map(escapeCsvCell).join(','));
  }

  if (Array.isArray(totalsRow) && totalsRow.length > 0) {
    lines.push(totalsRow.map(escapeCsvCell).join(','));
  }

  lines.push('');
  lines.push([cfg.footerNotice, `Total Records: ${matrix.length}`, cfg.authorizedSignatory].map(escapeCsvCell).join(','));

  return {
    csvText: '\uFEFF' + lines.join('\r\n'),
    reportId: rptId,
    recordCount: matrix.length
  };
}

export function exportUniversalCSV(options = {}) {
  const { csvText, reportId, recordCount } = buildUniversalCsvContent(options);
  const downloadName = sanitizeFilename(options.filename || 'MUN_COMPUTER_Report', 'csv');

  if (typeof Blob !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    triggerBrowserBlobDownload(blob, downloadName);
  }
  return { success: true, filename: downloadName, reportId, recordCount, csvText };
}

/* =========================================================================
   2. UNIVERSAL EXCEL (.XLSX) EXPORT (CORPORATE HEADER, AUTO WIDTHS, TOTALS)
   ========================================================================= */

function buildCorporateWorksheet({
  title = '',
  reportTitle = '',
  reportId = '',
  statusLabel = '',
  status = '',
  subtitle = '',
  generatedAt = '',
  headers = [],
  rows = [],
  totalsRow = null,
  emptyNote = '',
  emptyMessage = ''
}) {
  const cfg = getCompanyProfileConfig();
  const rptTitle = title || reportTitle || 'OFFICIAL REPORT';
  const rptStatus = statusLabel || status || 'VERIFIED';
  const rptEmpty = emptyNote || emptyMessage || 'No records available.';
  const { labels, matrix } = normalizeTabularDataset(headers, rows);
  const colCount = Math.max(4, labels.length);
  const rptId = reportId || generateReportId('MUN-XLS');
  const genTime = generatedAt || getNowISTString();

  const aoa = [
    [cfg.companyName],
    [cfg.tagline],
    [`Address: ${cfg.address}`],
    [`Phone: ${cfg.phone}  |  WhatsApp: ${cfg.whatsapp}  |  Email: ${cfg.email}`],
    [`Document: ${String(rptTitle).toUpperCase()}  |  Report ID: ${rptId}`],
    [`Generated On: ${genTime}  |  Status: ${String(rptStatus).toUpperCase()}${subtitle ? `  |  Scope: ${subtitle}` : ''}`],
    [],
    labels.length > 0 ? labels : ['Particulars']
  ];

  if (matrix.length > 0) {
    matrix.forEach((r) => aoa.push(r));
  } else {
    const emptyArr = labels.length > 0
      ? [rptEmpty, ...labels.slice(1).map(() => '')]
      : [rptEmpty];
    aoa.push(emptyArr);
  }

  if (Array.isArray(totalsRow) && totalsRow.length > 0) {
    aoa.push(totalsRow);
  }

  aoa.push([]);
  aoa.push([`${cfg.footerNotice}  |  Total Records: ${matrix.length}  |  ${cfg.authorizedSignatory}`]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merge top letterhead rows cleanly across table width
  const lastCol = colCount - 1;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: lastCol } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: lastCol } },
    { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: lastCol } }
  ];

  // Auto-size columns based on header + data length (ignore wide header banner rows 0..5)
  const colWidths = [];
  for (let c = 0; c < colCount; c++) {
    let maxLen = String(labels[c] || '').length;
    for (let r = 8; r < aoa.length - 2; r++) {
      const cellStr = String(aoa[r]?.[c] ?? '');
      if (cellStr.length > maxLen) maxLen = cellStr.length;
    }
    colWidths.push({ wch: Math.min(46, Math.max(12, maxLen + 4)) });
  }
  ws['!cols'] = colWidths;

  return { ws, reportId: rptId, recordCount: matrix.length };
}

export function buildUniversalExcelWorkbook({
  sheetName = 'Report',
  title = '',
  reportTitle = '',
  reportId = '',
  statusLabel = '',
  status = '',
  subtitle = '',
  generatedAt = '',
  headers = [],
  rows = [],
  totalsRow = null,
  emptyNote = '',
  emptyMessage = '',
  extraSheets = []
} = {}) {
  const wb = XLSX.utils.book_new();
  const rptTitle = title || reportTitle || 'OFFICIAL REPORT';
  const rptStatus = statusLabel || status || 'VERIFIED';
  const rptEmpty = emptyNote || emptyMessage || 'No records available.';
  const rptId = reportId || generateReportId('MUN-XLS');
  const genTime = generatedAt || getNowISTString();

  const primary = buildCorporateWorksheet({
    title: rptTitle,
    reportId: rptId,
    statusLabel: rptStatus,
    subtitle,
    generatedAt: genTime,
    headers,
    rows,
    totalsRow,
    emptyNote: rptEmpty
  });

  const safePrimaryName = String(sheetName || 'Report').slice(0, 31).replace(/[\\/?*[\]:]/g, '_');
  XLSX.utils.book_append_sheet(wb, primary.ws, safePrimaryName);

  if (Array.isArray(extraSheets)) {
    extraSheets.forEach((sheetSpec, idx) => {
      if (!sheetSpec) return;
      const built = buildCorporateWorksheet({
        title: sheetSpec.title || sheetSpec.reportTitle || rptTitle,
        reportId: rptId,
        statusLabel: sheetSpec.statusLabel || sheetSpec.status || rptStatus,
        subtitle: sheetSpec.subtitle || subtitle,
        generatedAt: genTime,
        headers: sheetSpec.headers || [],
        rows: sheetSpec.rows || [],
        totalsRow: sheetSpec.totalsRow || null,
        emptyNote: sheetSpec.emptyNote || sheetSpec.emptyMessage || rptEmpty
      });
      const safeExtraName = String(sheetSpec.sheetName || `Sheet_${idx + 2}`)
        .slice(0, 31)
        .replace(/[\\/?*[\]:]/g, '_');
      XLSX.utils.book_append_sheet(wb, built.ws, safeExtraName);
    });
  }

  return { wb, reportId: rptId, recordCount: primary.recordCount };
}

export function exportUniversalExcel(options = {}) {
  const { wb, reportId, recordCount } = buildUniversalExcelWorkbook(options);
  const downloadName = sanitizeFilename(options.filename || 'MUN_COMPUTER_Report', 'xlsx');
  if (typeof document !== 'undefined') {
    XLSX.writeFile(wb, downloadName);
  }
  return { success: true, filename: downloadName, reportId, recordCount, workbook: wb };
}

/* =========================================================================
   3. UNIVERSAL CORPORATE BLUE & WHITE PDF EXPORT
   ========================================================================= */

export async function buildUniversalPdfDoc({
  title = '',
  reportTitle = '',
  reportId = '',
  statusLabel = '',
  status = '',
  subtitle = '',
  generatedAt = '',
  headers = [],
  rows = [],
  totalsRow = null,
  summaryCards = [],
  orientation = 'auto',
  format = 'a4',
  includeUpiBlock = false,
  includeLegalTerms = false,
  includeAcknowledgement = true,
  emptyNote = '',
  emptyMessage = ''
} = {}) {
  await preloadOfficialLogoPdfAsset();
  const cfg = getCompanyProfileConfig();
  const rptTitle = title || reportTitle || 'OFFICIAL REPORT';
  const rptStatus = statusLabel || status || 'VERIFIED';
  const rptEmpty = emptyNote || emptyMessage || 'No records available for the selected criteria.';
  const rptId = reportId || generateReportId('MUN-PDF');
  const genTime = generatedAt || getNowISTString();
  const { headers: normHeaders, labels, matrix } = normalizeTabularDataset(headers, rows);

  const resolvedOrientation = orientation === 'portrait' || orientation === 'landscape'
    ? orientation
    : (labels.length > 6 ? 'landscape' : 'portrait');
  const resolvedFormat = format === 'a5' ? 'a5' : 'a4';

  const doc = new jsPDF({
    orientation: resolvedOrientation,
    unit: 'mm',
    format: resolvedFormat
  });

  const metaParts = [
    subtitle ? subtitle : '',
    `Status: ${String(rptStatus).toUpperCase()}`,
    `Records: ${matrix.length}`
  ].filter(Boolean).join('  |  ');

  let currentY = drawBwPdfHeader(doc, {
    docTitle: String(rptTitle).toUpperCase(),
    docNumber: rptId,
    docDateTime: genTime,
    metaLine: metaParts
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Optional Summary Strip Cards
  if (Array.isArray(summaryCards) && summaryCards.length > 0) {
    const cards = summaryCards.slice(0, 5);
    const gap = 3;
    const cardW = (pageW - margin * 2 - gap * (cards.length - 1)) / cards.length;
    const cardH = 13.5;

    cards.forEach((card, idx) => {
      const cx = margin + idx * (cardW + gap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(11, 59, 140);
      doc.setLineWidth(0.35);
      doc.rect(cx, currentY, cardW, cardH, 'FD');

      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.4);
      doc.text(pdfPlain(String(card.label || '')).toUpperCase().slice(0, 32), cx + 2.2, currentY + 4.4);

      doc.setTextColor(11, 59, 140);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.text(pdfPlain(String(card.value ?? '-')).slice(0, 28), cx + 2.2, currentY + 10.6);
    });
    doc.setTextColor(0, 0, 0);
    currentY += cardH + 4;
  }

  const bwTheme = getBwAutoTableStyles();
  const colCount = Math.max(1, labels.length);
  const dynamicFontSize = colCount >= 10 ? 6.6 : (colCount >= 8 ? 7.2 : 7.8);
  const colStyles = inferColumnAlignments(labels, matrix, normHeaders);

  const safeHead = labels.length > 0 ? [labels.map(pdfPlain)] : [['Particulars']];
  const safeBody = matrix.length > 0
    ? matrix.map((r) => r.map(pdfPlain))
    : [[pdfPlain(rptEmpty), ...labels.slice(1).map(() => '')]];

  const safeFoot = Array.isArray(totalsRow) && totalsRow.length > 0
    ? [totalsRow.map(pdfPlain)]
    : undefined;

  applyAutoTableSafe(doc, {
    startY: currentY,
    head: safeHead,
    body: safeBody,
    foot: safeFoot,
    showHead: 'everyPage',
    showFoot: 'lastPage',
    margin: { left: margin, right: margin, bottom: 15 },
    ...bwTheme,
    styles: {
      ...bwTheme.styles,
      fontSize: dynamicFontSize,
      cellPadding: colCount >= 9 ? 1.5 : 2.0,
      overflow: 'linebreak'
    },
    headStyles: {
      ...bwTheme.headStyles,
      fontSize: dynamicFontSize + 0.3
    },
    footStyles: {
      ...bwTheme.footStyles,
      fontSize: dynamicFontSize + 0.2
    },
    columnStyles: colStyles
  });

  let afterY = (doc.lastAutoTable?.finalY || currentY + 20) + 6;

  if (includeUpiBlock || includeLegalTerms) {
    afterY = await appendPdfUpiAndLegalBlocks(doc, {
      startY: afterY,
      includeUpiBlock,
      includeLegalTerms,
      margin,
      pageW,
      pageH
    });
  }

  if (includeAcknowledgement) {
    if (afterY + 22 > pageH - 14) {
      doc.addPage();
      afterY = 14;
    }
    doc.setDrawColor(11, 59, 140);
    doc.setLineWidth(0.35);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.text(`${cfg.footerNotice} · Report ID: ${rptId}`, margin, afterY + 5);
    doc.text(`Printed / Exported on: ${pdfPlain(genTime)}`, margin, afterY + 9.5);

    doc.line(pageW - margin - 58, afterY + 13, pageW - margin, afterY + 13);
    doc.setFont('helvetica', 'bold');
    doc.text(pdfPlain(cfg.authorizedSignatory), pageW - margin, afterY + 17, { align: 'right' });
  }

  finalizeBwPdfPagination(doc, `${cfg.companyName} · ${pdfPlain(rptTitle)} · ${rptId}`);

  return {
    doc,
    reportId: rptId,
    orientation: resolvedOrientation,
    pageCount: doc.getNumberOfPages(),
    recordCount: matrix.length
  };
}

export async function exportUniversalPDF(options = {}) {
  const result = await buildUniversalPdfDoc(options);
  const downloadName = sanitizeFilename(options.filename || 'MUN_COMPUTER_Report', 'pdf');
  if (typeof document !== 'undefined') {
    result.doc.save(downloadName);
  }
  return {
    success: true,
    filename: downloadName,
    reportId: result.reportId,
    orientation: result.orientation,
    pageCount: result.pageCount,
    recordCount: result.recordCount,
    doc: result.doc
  };
}

/* =========================================================================
   4. UNIVERSAL CORPORATE PRINT PREVIEW & ISOLATED A4 PRINT POPUP
   ========================================================================= */

export function printUniversalReport({
  title = '',
  reportTitle = '',
  reportId = '',
  statusLabel = '',
  status = '',
  subtitle = '',
  headers = [],
  rows = [],
  totalsRow = null,
  summaryCards = [],
  orientation = 'auto',
  defaultFormat = '',
  filename = 'MUN_COMPUTER_Report',
  customBodyHtml = '',
  includeUpiBlock = false,
  includeLegalTerms = false,
  includeAcknowledgement = true,
  emptyNote = '',
  emptyMessage = ''
} = {}) {
  const rptTitle = title || reportTitle || 'OFFICIAL REPORT';
  const rptStatus = statusLabel || status || 'VERIFIED';
  const rptEmpty = emptyNote || emptyMessage || 'No records available for the selected criteria.';
  const rptId = reportId || generateReportId('MUN-PRT');
  const genTime = getNowISTString();
  const { headers: normHeaders, labels, matrix } = normalizeTabularDataset(headers, rows);
  const colStyles = inferColumnAlignments(labels, matrix, normHeaders);

  const autoOrientation = orientation === 'portrait' || orientation === 'landscape'
    ? orientation
    : (labels.length > 6 ? 'landscape' : 'portrait');
  const resolvedDefaultFormat = defaultFormat || (autoOrientation === 'landscape' ? 'a4-landscape' : 'a4-portrait');

  const summaryHtml = Array.isArray(summaryCards) && summaryCards.length > 0
    ? `
      <div class="a4-avoid-break" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(135px, 1fr)); gap:8px; margin-bottom:11px;">
        ${summaryCards.map((c) => `
          <div style="border:1px solid #0b3b8c; background:#f8fafc !important; padding:6px 8px;">
            <div style="font-size:7pt; font-weight:700; text-transform:uppercase; color:#475569 !important;">${escDoc(c.label || '')}</div>
            <div style="font-size:10.5pt; font-weight:800; color:#0b3b8c !important; margin-top:2px;" class="font-mono tabular-nums">${escDoc(c.value ?? '-')}</div>
          </div>
        `).join('')}
      </div>
    `
    : '';

  const tableHtml = customBodyHtml || `
    <table class="mun-corp-table">
      <thead>
        <tr>
          ${labels.map((lbl, idx) => {
            const align = colStyles[idx]?.halign || 'left';
            return `<th style="text-align:${align}; background:#0b3b8c !important; color:#ffffff !important;">${escDoc(lbl)}</th>`;
          }).join('')}
        </tr>
      </thead>
      <tbody>
        ${matrix.length > 0
          ? matrix.map((rowArr) => `
              <tr>
                ${rowArr.map((cell, idx) => {
                  const align = colStyles[idx]?.halign || 'left';
                  const cls = align === 'right' ? 'text-right font-mono tabular-nums' : (align === 'center' ? 'text-center tabular-nums' : '');
                  return `<td class="${cls}">${escDoc(cell)}</td>`;
                }).join('')}
              </tr>
            `).join('')
          : `<tr><td colspan="${Math.max(1, labels.length)}" class="text-center" style="padding:14px;">${escDoc(rptEmpty)}</td></tr>`}
      </tbody>
      ${Array.isArray(totalsRow) && totalsRow.length > 0 ? `
        <tfoot>
          <tr>
            ${totalsRow.map((cell, idx) => {
              const align = colStyles[idx]?.halign || 'left';
              return `<td style="text-align:${align}; font-weight:800; background:#eff6ff !important; border-top:2px solid #0b3b8c !important;">${escDoc(cell)}</td>`;
            }).join('')}
          </tr>
        </tfoot>
      ` : ''}
    </table>
  `;

  const bodyHtml = `
    <div class="mun-bw-doc mun-corp-doc">
      ${renderBwDocumentHeader({
        docTitle: String(rptTitle).toUpperCase(),
        docNumber: rptId,
        docDateTime: genTime,
        statusText: rptStatus,
        extraRightLines: [subtitle ? subtitle : `Total Records: ${matrix.length}`].filter(Boolean)
      })}
      ${summaryHtml}
      ${tableHtml}
      ${includeUpiBlock ? renderOnlinePaymentUpiSection() : ''}
      ${includeLegalTerms ? renderLegalTermsSection() : ''}
      ${includeAcknowledgement ? renderAcknowledgementSection({ includeCustomerSignature: false, dateStr: formatDate(getTodayDate()) }) : ''}
    </div>
  `;

  showA4PrintPdfPopup({
    title: `${rptTitle} — Print & PDF Preview`,
    subtitle: `MUN COMPUTER · Report ID: ${rptId}`,
    defaultFormat: resolvedDefaultFormat,
    bodyHtml,
    pdfConfig: customBodyHtml ? null : {
      onDownload: async (layoutOpts = {}) => {
        await exportUniversalPDF({
          filename,
          title: rptTitle,
          reportId: rptId,
          statusLabel: rptStatus,
          subtitle,
          generatedAt: genTime,
          headers,
          rows,
          totalsRow,
          summaryCards,
          orientation: layoutOpts.orientation || autoOrientation,
          format: layoutOpts.format || 'a4',
          includeUpiBlock,
          includeLegalTerms,
          includeAcknowledgement,
          emptyNote: rptEmpty
        });
      }
    }
  });

  return { success: true, reportId: rptId };
}

/**
 * Convenience helper for building a standard MUN COMPUTER Totals row
 */
export function buildSumTotalsRow(labelsOrRows = [], rowsOrColCount = [], sumKeysOrIndices = [], firstColLabelOrIdx = 'GRAND TOTAL', optionalLabel = 'GRAND TOTAL') {
  if (typeof rowsOrColCount === 'number') {
    const dataRows = Array.isArray(labelsOrRows) ? labelsOrRows : [];
    const colCount = Math.max(1, rowsOrColCount);
    const labelIdx = typeof firstColLabelOrIdx === 'number' ? firstColLabelOrIdx : 0;
    const labelText = typeof optionalLabel === 'string' ? optionalLabel : 'GRAND TOTAL';
    const result = Array.from({ length: colCount }, (_, idx) => (idx === labelIdx ? labelText : ''));
    const targetSet = new Set(Array.isArray(sumKeysOrIndices) ? sumKeysOrIndices : []);
    for (let c = 0; c < colCount; c++) {
      if (targetSet.has(c)) {
        const total = dataRows.reduce((sum, r) => {
          const raw = String(r?.[c] ?? '').replace(/[₹,\s]/g, '').replace(/^Rs\.?\s*/i, '');
          const n = Number(raw);
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
        result[c] = formatINR(total, false);
      }
    }
    return result;
  }

  const firstColLabel = typeof firstColLabelOrIdx === 'string' ? firstColLabelOrIdx : 'GRAND TOTAL';
  const { headers: normHeaders, matrix } = normalizeTabularDataset(labelsOrRows, rowsOrColCount);
  const result = normHeaders.map((_, idx) => (idx === 0 ? firstColLabel : ''));
  const targetSet = new Set(sumKeysOrIndices);

  normHeaders.forEach((h, idx) => {
    if (targetSet.has(idx) || targetSet.has(h.key) || targetSet.has(h.label)) {
      const total = matrix.reduce((sum, r) => {
        const raw = String(r[idx] ?? '').replace(/[₹,\s]/g, '').replace(/^Rs\.?\s*/i, '');
        const n = Number(raw);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);
      const isCountCol = /\b(leads?|converted|logs?|handled|count|qty|quantity|visits?|days?|records?|items?)\b/i.test(String(h.label || ''));
      result[idx] = isCountCol ? String(total) : formatINR(total, false);
    }
  });
  return result;
}
