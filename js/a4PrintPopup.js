/**
 * a4PrintPopup.js - Unified In-App Print & PDF Popup Engine (Pure Black & White)
 * Supports A4 Portrait (210mm x 297mm), A4 Landscape (297mm x 210mm), and A5 Receipt (148mm x 210mm)
 * Enforces pure White (#FFFFFF) sheet, pure Black (#000000) ink, and dynamic @page print rules.
 */

import { generateBwTablePdf, getBwDocumentCssBlock } from './documentEngine.js';

const PAPER_FORMATS = {
  'a4-portrait': {
    label: 'A4 Portrait (210×297mm)',
    widthCss: '210mm',
    pageCss: 'A4 portrait',
    marginCss: '10mm',
    paddingCss: 'clamp(12px, 3vw, 11mm)',
    pdfFormat: 'a4',
    pdfOrientation: 'portrait'
  },
  'a4-landscape': {
    label: 'A4 Landscape (297×210mm)',
    widthCss: '297mm',
    pageCss: 'A4 landscape',
    marginCss: '10mm',
    paddingCss: 'clamp(12px, 3vw, 11mm)',
    pdfFormat: 'a4',
    pdfOrientation: 'landscape'
  },
  'a5-receipt': {
    label: 'A5 Receipt (148×210mm)',
    widthCss: '148mm',
    pageCss: 'A5 portrait',
    marginCss: '8mm',
    paddingCss: 'clamp(10px, 2.5vw, 9mm)',
    pdfFormat: 'a5',
    pdfOrientation: 'portrait'
  },
  'thermal-80mm': {
    label: 'POS Thermal (80mm / 3-inch)',
    widthCss: '80mm',
    pageCss: '80mm auto',
    marginCss: '3mm',
    paddingCss: '4mm',
    pdfFormat: [80, 220],
    pdfOrientation: 'portrait'
  }
};

function applyDynamicPrintPageRule(pageCss, marginCss = '10mm') {
  let styleEl = document.getElementById('mun-dynamic-print-page');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'mun-dynamic-print-page';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    ${getBwDocumentCssBlock()}
    .mun-bw-doc tfoot { display: table-footer-group; }
    @media print {
      @page {
        size: ${pageCss};
        margin: ${marginCss};
      }
      .mun-bw-doc thead { display: table-header-group; }
      .mun-bw-doc tfoot { display: table-footer-group; }
    }
  `;
}

export function showA4PrintPdfPopup({
  title = 'Print & PDF Preview',
  subtitle = 'MUN COMPUTER · Official Corporate Print & PDF Layout',
  bodyHtml = '',
  alternateBodies = null,
  extraToolbarHtml = '',
  pdfConfig = null,
  defaultFormat = 'a4-portrait',
  autoDownloadPdf = false
}) {
  let activeFormatKey = PAPER_FORMATS[defaultFormat] ? defaultFormat : 'a4-portrait';
  const getBodyForFormat = (fmtKey) => {
    if (alternateBodies && typeof alternateBodies === 'object') {
      if (alternateBodies[fmtKey]) return alternateBodies[fmtKey];
      if (fmtKey !== 'thermal-80mm' && alternateBodies.standard) return alternateBodies.standard;
    }
    return bodyHtml;
  };

  let overlay = document.getElementById('a4-print-popup-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'a4-print-popup-overlay';
    document.body.appendChild(overlay);
  }

  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:rgba(15, 23, 42, 0.78)',
    'backdrop-filter:blur(3px)',
    'z-index:10050',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'padding:clamp(0.45rem, 2vw, 1rem)',
    'box-sizing:border-box',
    'overflow-y:auto'
  ].join(';');

  const activeSpec = PAPER_FORMATS[activeFormatKey];
  applyDynamicPrintPageRule(activeSpec.pageCss, activeSpec.marginCss);
  const toolbarMaxWidth = activeFormatKey === 'thermal-80mm' ? 'min(100%, 480px)' : activeSpec.widthCss;

  overlay.innerHTML = `
    <div id="a4-popup-toolbar" class="no-print" style="width:100%; max-width:${toolbarMaxWidth}; box-sizing:border-box; background:#0b3b8c; color:#ffffff; border:1px solid #1e40af; border-radius:8px 8px 0 0; padding:0.75rem 1rem; display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap; box-shadow:0 10px 25px rgba(0,0,0,0.35); position:sticky; top:0; z-index:10;">
      <div style="min-width:0; flex:1 1 200px;">
        <div style="font-weight:800; font-size:0.95rem; color:#ffffff;">${title}</div>
        <div id="a4-popup-format-sub" style="font-size:0.72rem; color:#dbeafe;">${subtitle} • ${activeSpec.label}</div>
      </div>
      <div style="display:flex; gap:0.45rem; flex-wrap:wrap; align-items:center;">
        <select id="a4-paper-size-select" class="form-control" style="width:auto; min-width:170px; height:32px; padding:0.2rem 0.5rem; font-size:0.78rem; background:#ffffff; color:#0f172a; border:1px solid #1e40af; font-weight:700;">
          ${Object.entries(PAPER_FORMATS).map(([k, cfg]) => `<option value="${k}" ${k === activeFormatKey ? 'selected' : ''}>${cfg.label}</option>`).join('')}
        </select>
        ${extraToolbarHtml || ''}
        <button type="button" id="a4-btn-print" class="btn btn-primary btn-sm" style="background:#ffffff; border:1px solid #ffffff; color:#0b3b8c; font-weight:800;">
          🖨 Print Document
        </button>
        ${pdfConfig ? `
          <button type="button" id="a4-btn-download-pdf" class="btn btn-success btn-sm" style="background:#1e293b; border:1px solid #93c5fd; color:#ffffff; font-weight:700;">
            ⬇ Download PDF
          </button>
        ` : ''}
        <button type="button" id="a4-btn-close" class="btn btn-secondary btn-sm" style="background:#334155; color:#ffffff; border-color:#475569;">
          ✕ Close
        </button>
      </div>
    </div>

    <div id="a4-sheet-outer" style="width:100%; max-width:${activeSpec.widthCss}; overflow-x:auto; -webkit-overflow-scrolling:touch; border-radius:0 0 8px 8px; box-shadow:0 20px 50px rgba(0,0,0,0.45); background:#ffffff;">
      <div id="a4-sheet-wrapper" class="mun-bw-doc" style="width:100%; max-width:${activeSpec.widthCss}; background:#ffffff; color:#000000; min-height:auto; padding:${activeSpec.paddingCss}; box-sizing:border-box; font-family:Arial, Helvetica, sans-serif;">
        <div id="a4-sheet-content" class="mun-bw-doc">
          ${getBodyForFormat(activeFormatKey)}
        </div>
      </div>
    </div>
  `;

  document.body.classList.add('printing-a4-popup');
  document.body.classList.toggle('printing-thermal-80mm', activeFormatKey === 'thermal-80mm');

  const formatSelect = document.getElementById('a4-paper-size-select');
  formatSelect?.addEventListener('change', (e) => {
    const nextKey = e.target.value;
    if (!PAPER_FORMATS[nextKey]) return;
    activeFormatKey = nextKey;
    const spec = PAPER_FORMATS[activeFormatKey];
    applyDynamicPrintPageRule(spec.pageCss, spec.marginCss);
    document.body.classList.toggle('printing-thermal-80mm', activeFormatKey === 'thermal-80mm');
    const toolbar = document.getElementById('a4-popup-toolbar');
    const outer = document.getElementById('a4-sheet-outer');
    const wrapper = document.getElementById('a4-sheet-wrapper');
    const content = document.getElementById('a4-sheet-content');
    const subEl = document.getElementById('a4-popup-format-sub');
    if (toolbar) toolbar.style.maxWidth = activeFormatKey === 'thermal-80mm' ? 'min(100%, 480px)' : spec.widthCss;
    if (outer) outer.style.maxWidth = spec.widthCss;
    if (wrapper) {
      wrapper.style.maxWidth = spec.widthCss;
      wrapper.style.padding = spec.paddingCss;
    }
    if (content && alternateBodies) content.innerHTML = getBodyForFormat(activeFormatKey);
    if (subEl) subEl.textContent = `${subtitle} • ${spec.label}`;
  });

  const onEscKey = (ev) => {
    if (ev.key === 'Escape') {
      closePopup();
    }
  };

  const closePopup = () => {
    document.removeEventListener('keydown', onEscKey);
    document.body.classList.remove('printing-a4-popup');
    document.body.classList.remove('printing-thermal-80mm');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };

  document.addEventListener('keydown', onEscKey);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePopup();
  });

  document.getElementById('a4-btn-close')?.addEventListener('click', closePopup);
  document.getElementById('a4-btn-print')?.addEventListener('click', () => {
    const spec = PAPER_FORMATS[activeFormatKey] || PAPER_FORMATS['a4-portrait'];
    applyDynamicPrintPageRule(spec.pageCss, spec.marginCss);
    document.body.classList.toggle('printing-thermal-80mm', activeFormatKey === 'thermal-80mm');
    window.print();
  });

  const downloadPdf = async () => {
    if (!pdfConfig) return;
    const spec = PAPER_FORMATS[activeFormatKey] || PAPER_FORMATS['a4-portrait'];
    if (typeof pdfConfig.onDownload === 'function') {
      await pdfConfig.onDownload({
        format: spec.pdfFormat,
        orientation: spec.pdfOrientation,
        formatKey: activeFormatKey
      });
      return;
    }
    await generateA4TablePdf({
      ...pdfConfig,
      format: pdfConfig.format || spec.pdfFormat,
      orientation: pdfConfig.orientation || spec.pdfOrientation
    });
  };

  document.getElementById('a4-btn-download-pdf')?.addEventListener('click', downloadPdf);

  if (autoDownloadPdf && pdfConfig) {
    setTimeout(downloadPdf, 150);
  }
}

export async function generateA4TablePdf(options = {}) {
  return generateBwTablePdf(options);
}
