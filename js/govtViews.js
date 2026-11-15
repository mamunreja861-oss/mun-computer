/**
 * govtViews.js - UI View Engine for Government Schemes & Public Grievance Management
 * MUN COMPUTER BUSINESS MANAGER
 * 
 * Provides views and modal interfaces for all 8 software modules:
 * 01. Government Scheme Directory (State & Central)
 * 02. Application & Claim Management
 * 03. Public Grievance Management (CMO, CPGRAMS, MLA, BDO, SDO, DM)
 * 04. Annapurna Yojana - Dedicated Specialized Module
 * 05. Unified Applicant Master Register (25 Fields)
 * 06. Document Management & Citizen Acknowledgement Slips
 * 07. Follow-up Management (90-Day Tracker & Chronological History)
 * 08. Reports & Analytics (Case breakdowns & charts)
 */

import {
  WB_STATE_SCHEMES,
  CENTRAL_GOVT_SCHEMES,
  APPLICATION_WORK_TYPES,
  PUBLIC_GRIEVANCE_CHANNELS,
  STANDARD_CASE_STATUSES,
  DUPLICATE_PREVENTION_RULES,
  WB_DISTRICTS,
  STANDARD_DOCUMENTS,
  getAllGovtCases,
  getGovtCaseById,
  calculateNext90Days
} from './govtSchemes.js';

import { jsPDF } from 'jspdf';
import {
  renderBwDocumentHeader,
  renderLegalTermsSection,
  renderAcknowledgementSection,
  drawBwPdfHeader,
  getBwAutoTableStyles,
  finalizeBwPdfPagination
} from './documentEngine.js';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { renderAnnapurnaCaseSystemView } from './annapurnaCaseViews.js';
import { showInAppPrintModal } from './annapurnaCaseEngine.js';
import { formatDate, getTodayDate } from './storage.js';
import { showToast, openModal } from './app.js';

/* --- Helper for Status Color Coding --- */
export function getStatusBadge(status) {
  const map = {
    'New': { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
    'Documents Pending': { bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
    'Ready for Submission': { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    'Submitted': { bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe' },
    'Claim Submitted': { bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' },
    'Under Process': { bg: '#fef9c3', color: '#854d0e', border: '#fef08a' },
    'Pending Verification': { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' },
    'Further Verification Required': { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' },
    'Under Enquiry': { bg: '#fdf4ff', color: '#86198f', border: '#f5d0fe' },
    'Forwarded to Department': { bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' },
    'Awaiting Response': { bg: '#fff7ed', color: '#9a3412', border: '#ffedd5' },
    'Reminder Submitted': { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    'Appeal Submitted': { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' },
    'Resolved': { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    'Rejected': { bg: '#fee2e2', color: '#991b1b', border: '#f87171' },
    'Closed': { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' }
  };

  const style = map[status] || { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
  return `<span style="display:inline-block; padding:0.2rem 0.55rem; font-size:0.75rem; font-weight:700; border-radius:9999px; background:${style.bg}; color:${style.color}; border:1px solid ${style.border};">${status}</span>`;
}

/* =========================================================================
   ANNAPURNA YOJANA - DEDICATED SPECIALIZED MODULE VIEW
   ========================================================================= */

export function renderGovtAnnapurnaView() {
  return renderAnnapurnaCaseSystemView('');
}

/* =========================================================================
   INTERACTIVE MODALS & OPERATIONS
   ========================================================================= */

/**
 * Open Modal to Add or Edit Unified 25-Field Master Case
 */
export function openGovtCaseModal(editCaseId = null, presetScheme = '', presetCategory = '', isAnnapurna = false) {
  const existingCase = editCaseId ? getGovtCaseById(editCaseId) : null;
  const isEdit = !!existingCase;

  const title = isEdit 
    ? `Edit Master Case Record (#${existingCase.caseId})` 
    : (isAnnapurna ? 'New Annapurna Yojana Case Registration' : '＋ New Government Scheme / Claim Entry');

  const selectedScheme = isEdit ? existingCase.schemeName : (presetScheme || (isAnnapurna ? 'Annapurna Yojana' : ''));
  const selectedCategory = isEdit ? existingCase.caseCategory : (presetCategory || 'New Scheme Application');
  const selectedLevel = isEdit ? existingCase.govtLevel : (WB_STATE_SCHEMES.some(s => s.name === selectedScheme) ? 'State Government' : 'Central Government');

  const content = `
    <form id="govt-case-form" onsubmit="window.MJK.saveGovtCaseForm(event)" style="display:flex; flex-direction:column; gap:1rem;">
      <input type="hidden" id="gc-edit-id" value="${editCaseId || ''}">

      <!-- Duplicate Detection Warning Banner -->
      <div id="duplicate-warning-box" style="display:none; background:#fef2f2; border:1px solid #f87171; border-radius:var(--radius-md); padding:0.75rem 1rem; color:#991b1b; font-size:0.83rem;">
        <div style="font-weight:800; display:flex; align-items:center; gap:0.4rem;">
          <span>⚠ DUPLICATE RECORD DETECTED (Rule 10 Violation)</span>
        </div>
        <div id="duplicate-warning-text" style="margin-top:0.25rem;"></div>
      </div>

      <!-- Section A: Scheme Directory & Work Category (Rules 1, 6, 7) -->
      <div style="background:var(--surface-alt); padding:0.85rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
        <div style="font-size:0.75rem; font-weight:800; color:var(--blue-700); margin-bottom:0.5rem; text-transform:uppercase;">
          SECTION A: SCHEME SELECTION & WORK TYPE (Rule 6 & 7 Compliant)
        </div>
        <div class="erp-grid-2-tight">
          <div>
            <label class="form-label" style="font-weight:700;">Government Level *</label>
            <select id="gc-govt-level" class="form-control" required onchange="window.MJK.handleGovtLevelChange(this.value)">
              <option value="State Government" ${selectedLevel === 'State Government' ? 'selected' : ''}>West Bengal State Government (রাজ্য)</option>
              <option value="Central Government" ${selectedLevel === 'Central Government' ? 'selected' : ''}>Central Government (কেন্দ্রীয়)</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Scheme Name (Selected from Directory) *</label>
            <select id="gc-scheme-name" class="form-control" required onchange="window.MJK.checkFormDuplicate()">
              <optgroup id="gc-state-options" label="West Bengal Government Schemes">
                ${WB_STATE_SCHEMES.map(s => `
                  <option value="${s.name}" ${selectedScheme === s.name ? 'selected' : ''}>${s.id} - ${s.name} (${s.nameBn})</option>
                `).join('')}
              </optgroup>
              <optgroup id="gc-central-options" label="Central Government Schemes">
                ${CENTRAL_GOVT_SCHEMES.map(s => `
                  <option value="${s.name}" ${selectedScheme === s.name ? 'selected' : ''}>${s.id} - ${s.name} (${s.nameBn})</option>
                `).join('')}
              </optgroup>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Work / Action Type (কাজের ধরন) *</label>
            <select id="gc-case-category" class="form-control" required>
              ${APPLICATION_WORK_TYPES.map(w => `
                <option value="${w}" ${selectedCategory === w ? 'selected' : ''}>${w}</option>
              `).join('')}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Application ID / Beneficiary ID</label>
            <input type="text" id="gc-application-id" class="form-control" placeholder="e.g. AY-WB-2026-9012" value="${existingCase ? existingCase.applicationId || '' : ''}" oninput="window.MJK.checkFormDuplicate()">
            <small style="font-size:0.7rem; color:var(--text-muted);">Official portal reference number</small>
          </div>
        </div>
      </div>

      <!-- Section B: Applicant & Family Head Details (Fields 02-08) -->
      <div style="background:var(--surface-alt); padding:0.85rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
        <div style="font-size:0.75rem; font-weight:800; color:var(--blue-700); margin-bottom:0.5rem; text-transform:uppercase;">
          SECTION B: APPLICANT & FAMILY HEAD DETAILS (Rule 2 Linked to Customer ID)
        </div>
        <div class="erp-grid-2-tight">
          <div>
            <label class="form-label" style="font-weight:700;">Applicant Full Name *</label>
            <input type="text" id="gc-applicant-name" class="form-control" required placeholder="Enter citizen name" value="${existingCase ? existingCase.applicantName || '' : ''}" oninput="window.MJK.checkFormDuplicate()">
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Father / Husband Name *</label>
            <input type="text" id="gc-relative-name" class="form-control" required placeholder="Relative name" value="${existingCase ? existingCase.relativeName || '' : ''}">
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Head of Family (HOF Name) *</label>
            <input type="text" id="gc-hof-name" class="form-control" placeholder="HOF name as per Ration Card" value="${existingCase ? existingCase.hofName || '' : ''}">
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Mobile Number (10 digits) *</label>
            <input type="tel" id="gc-mobile-number" class="form-control" required pattern="[0-9]{10}" placeholder="10-digit mobile" value="${existingCase ? existingCase.mobileNumber || '' : ''}" oninput="window.MJK.checkFormDuplicate()">
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">District *</label>
            <select id="gc-district" class="form-control" required>
              ${WB_DISTRICTS.map(d => `
                <option value="${d}" ${(existingCase ? existingCase.district : 'Murshidabad') === d ? 'selected' : ''}>${d}</option>
              `).join('')}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Block / Municipality / Ward *</label>
            <input type="text" id="gc-block" class="form-control" required placeholder="e.g. Beldanga-II / Berhampore" value="${existingCase ? existingCase.blockMunicipality || '' : ''}">
          </div>
          <div style="grid-column:1/-1;">
            <label class="form-label" style="font-weight:700;">Full Village / Residential Address</label>
            <input type="text" id="gc-address" class="form-control" placeholder="Village / Para / Post Office / PIN" value="${existingCase ? existingCase.address || '' : ''}">
          </div>
        </div>
      </div>

      <!-- Section C: Case Status & Financial Benefit Status (Fields 13-15) -->
      <div style="background:var(--surface-alt); padding:0.85rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
        <div style="font-size:0.75rem; font-weight:800; color:var(--blue-700); margin-bottom:0.5rem; text-transform:uppercase;">
          SECTION C: STATUS & TIMELINES (16 Standard Statuses)
        </div>
        <div class="erp-grid-2-tight">
          <div>
            <label class="form-label" style="font-weight:700;">Current Case Status *</label>
            <select id="gc-current-status" class="form-control" required>
              ${STANDARD_CASE_STATUSES.map(st => `
                <option value="${st}" ${(existingCase ? existingCase.currentStatus : 'New') === st ? 'selected' : ''}>${st}</option>
              `).join('')}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Previous Benefit / Payment Status</label>
            <select id="gc-payment-status" class="form-control">
              <option value="Never Received" ${(existingCase ? existingCase.previousPaymentStatus : '') === 'Never Received' ? 'selected' : ''}>Never Received (First Application)</option>
              <option value="First Payment Pending" ${(existingCase ? existingCase.previousPaymentStatus : '') === 'First Payment Pending' ? 'selected' : ''}>First Payment Not Received (প্রথম কিস্তি বাকি)</option>
              <option value="Received Earlier (Now Stopped)" ${(existingCase ? existingCase.previousPaymentStatus : '') === 'Received Earlier (Now Stopped)' ? 'selected' : ''}>Received Earlier (Now Stopped / বন্ধ হয়ে গেছে)</option>
              <option value="Missing Installments" ${(existingCase ? existingCase.previousPaymentStatus : '') === 'Missing Installments' ? 'selected' : ''}>Missing Specific Installment(s)</option>
              <option value="Active Regular" ${(existingCase ? existingCase.previousPaymentStatus : '') === 'Active Regular' ? 'selected' : ''}>Active Regular Disbursement</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Application Submission Date</label>
            <input type="date" id="gc-submission-date" class="form-control" value="${existingCase ? existingCase.submissionDate || getTodayDate() : getTodayDate()}">
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Next 90-Day Follow-up Date</label>
            <input type="date" id="gc-next-followup" class="form-control" value="${existingCase ? existingCase.nextFollowupDate || calculateNext90Days(getTodayDate()) : calculateNext90Days(getTodayDate())}">
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Assigned Authority / Department</label>
            <input type="text" id="gc-assigned-authority" class="form-control" placeholder="e.g. BDO Office / ADA Office / Food Inspector" value="${existingCase ? existingCase.assignedAuthority || 'BDO Office' : 'BDO Office'}">
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Resolution Status</label>
            <select id="gc-resolution-status" class="form-control">
              <option value="Unresolved" ${(existingCase ? existingCase.resolutionStatus : '') === 'Unresolved' ? 'selected' : ''}>Unresolved (Pending Action)</option>
              <option value="Under Enquiry" ${(existingCase ? existingCase.resolutionStatus : '') === 'Under Enquiry' ? 'selected' : ''}>Under Field / Ground Enquiry</option>
              <option value="Action Taken Report Pending" ${(existingCase ? existingCase.resolutionStatus : '') === 'Action Taken Report Pending' ? 'selected' : ''}>Action Taken Report Pending</option>
              <option value="Benefit Sanctioned" ${(existingCase ? existingCase.resolutionStatus : '') === 'Benefit Sanctioned' ? 'selected' : ''}>Benefit Sanctioned / Active</option>
              <option value="Payment Restored" ${(existingCase ? existingCase.resolutionStatus : '') === 'Payment Restored' ? 'selected' : ''}>Payment Successfully Restored</option>
              <option value="Closed" ${(existingCase ? existingCase.resolutionStatus : '') === 'Closed' ? 'selected' : ''}>Closed / Disposed</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Section D: Public Grievance Reference (Fields 16-18) -->
      <div style="background:var(--surface-alt); padding:0.85rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
        <div style="font-size:0.75rem; font-weight:800; color:var(--blue-700); margin-bottom:0.5rem; text-transform:uppercase;">
          SECTION D: PUBLIC GRIEVANCE ESCALATION REFERENCE (Rule 4 & 5)
        </div>
        <div class="erp-grid-2-tight">
          <div>
            <label class="form-label" style="font-weight:700;">Grievance Channel</label>
            <select id="gc-complaint-channel" class="form-control">
              <option value="None" ${(existingCase ? existingCase.complaintChannel : '') === 'None' ? 'selected' : ''}>None (No Grievance Lodged Yet)</option>
              ${PUBLIC_GRIEVANCE_CHANNELS.map(ch => `
                <option value="${ch}" ${(existingCase ? existingCase.complaintChannel : '') === ch ? 'selected' : ''}>${ch}</option>
              `).join('')}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-weight:700;">Grievance / Docket Reference Number</label>
            <input type="text" id="gc-complaint-ref" class="form-control" placeholder="e.g. WB-CMO-2026-44129" value="${existingCase ? existingCase.complaintRefNumber || '' : ''}">
          </div>
        </div>
      </div>

      <!-- Section E: Supporting Documents & Remarks (Fields 19 & 23) -->
      <div style="background:var(--surface-alt); padding:0.85rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
        <div style="font-size:0.75rem; font-weight:800; color:var(--blue-700); margin-bottom:0.5rem; text-transform:uppercase;">
          SECTION E: VERIFIED SUPPORTING DOCUMENTS & OPERATOR REMARKS
        </div>
        <div style="margin-bottom:0.75rem;">
          <label class="form-label" style="font-weight:700; margin-bottom:0.35rem; display:block;">Select Verified Documents Collected from Citizen:</label>
          <div class="erp-grid-2-tight" style="font-size:0.8rem;">
            ${STANDARD_DOCUMENTS.map(doc => {
              const checked = existingCase && existingCase.supportingDocuments && existingCase.supportingDocuments.includes(doc);
              return `
                <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;">
                  <input type="checkbox" name="gc-docs" value="${doc}" ${checked ? 'checked' : ''}>
                  <span>${doc}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>

        <div>
          <label class="form-label" style="font-weight:700;">Operator Remarks / Action History Notes</label>
          <textarea id="gc-remarks" class="form-control" rows="2" placeholder="Enter administrative notes, findings, or specific case issues...">${existingCase ? existingCase.remarks || '' : ''}</textarea>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem;">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
        <button type="submit" id="gc-submit-btn" class="btn btn-primary">
          ${isEdit ? 'Update Master Case Record' : 'Save & Register Master Record'}
        </button>
      </div>
    </form>
  `;

  openModal(title, content, null);
}

/**
 * Open Modal to Escalate / Attach Grievance to an Existing Case (Rule 4 & 5)
 */
export function openAddGrievanceModal(caseId) {
  const c = getGovtCaseById(caseId);
  if (!c) {
    showToast('Case record not found', 'danger');
    return;
  }

  const content = `
    <form onsubmit="window.MJK.saveGrievanceForm(event, '${caseId}')" style="display:flex; flex-direction:column; gap:0.85rem;">
      <div style="background:var(--surface-alt); padding:0.75rem; border-radius:var(--radius-md); border-left:4px solid var(--blue-600); font-size:0.82rem;">
        <strong>Attaching to Case:</strong> ${c.caseId} • <strong>Applicant:</strong> ${c.applicantName} (${c.mobileNumber})<br>
        <strong>Scheme:</strong> ${c.schemeName} • <strong>Work Type:</strong> ${c.caseCategory}
      </div>

      <div>
        <label class="form-label" style="font-weight:700;">Select Grievance / Escalation Channel *</label>
        <select id="grv-channel" class="form-control" required>
          ${PUBLIC_GRIEVANCE_CHANNELS.map(ch => `
            <option value="${ch}">${ch}</option>
          `).join('')}
        </select>
      </div>

      <div class="erp-grid-2-tight">
        <div>
          <label class="form-label" style="font-weight:700;">Grievance / Docket Reference No *</label>
          <input type="text" id="grv-ref-number" class="form-control" required placeholder="e.g. CMO-2026-88192">
        </div>
        <div>
          <label class="form-label" style="font-weight:700;">Submission Date *</label>
          <input type="date" id="grv-date" class="form-control" required value="${getTodayDate()}">
        </div>
      </div>

      <div>
        <label class="form-label" style="font-weight:700;">Assigned Authority / Office *</label>
        <input type="text" id="grv-authority" class="form-control" required placeholder="e.g. BDO Office Beldanga-II / Food Inspector Desk" value="BDO Office">
      </div>

      <div>
        <label class="form-label" style="font-weight:700;">Grievance Subject / Complaint Summary *</label>
        <input type="text" id="grv-subject" class="form-control" required placeholder="e.g. Non-receipt of first installment / payment stopped" value="Non-disbursement of sanctioned welfare benefit">
      </div>

      <div>
        <label class="form-label" style="font-weight:700;">Detailed Ground Notes / Paperwork Submitted</label>
        <textarea id="grv-notes" class="form-control" rows="2" placeholder="Submitted physical copy to BDO reception desk. Receipt acknowledgement stamped."></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem;">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Attach Grievance Reference</button>
      </div>
    </form>
  `;

  openModal(`⚖ Escalate Grievance for Case #${c.caseId}`, content, null);
}

/**
 * Open Modal to Log Chronological Follow-up (Rule 9)
 */
export function openAddFollowupModal(caseId) {
  const c = getGovtCaseById(caseId);
  if (!c) {
    showToast('Case not found', 'danger');
    return;
  }

  const content = `
    <form onsubmit="window.MJK.saveFollowupForm(event, '${caseId}')" style="display:flex; flex-direction:column; gap:0.85rem;">
      <div style="background:var(--surface-alt); padding:0.75rem; border-radius:var(--radius-md); font-size:0.82rem;">
        <strong>Case:</strong> ${c.caseId} • <strong>Applicant:</strong> ${c.applicantName}<br>
        <strong>Current Status:</strong> ${c.currentStatus} • <strong>Scheme:</strong> ${c.schemeName}
      </div>

      <div class="erp-grid-2-tight">
        <div>
          <label class="form-label" style="font-weight:700;">Follow-up Action Type *</label>
          <select id="flp-action-type" class="form-control" required>
            <option value="Departmental Reminder Submitted">Departmental Reminder Submitted</option>
            <option value="Physical BDO Visit">Physical BDO / SDO Visit</option>
            <option value="Food Inspector Ground Verification">Food Inspector Ground Verification</option>
            <option value="Bank NPCI Re-mapping Done">Bank NPCI Re-mapping Done</option>
            <option value="Action Taken Report (ATR) Received">Action Taken Report (ATR) Received</option>
            <option value="Appeal Letter Submitted">Appeal Letter Submitted</option>
            <option value="Benefit Payment Disbursed">Benefit Payment Disbursed</option>
            <option value="Citizen Telephonic Inquiry">Citizen Telephonic Inquiry</option>
          </select>
        </div>
        <div>
          <label class="form-label" style="font-weight:700;">Action Date *</label>
          <input type="date" id="flp-date" class="form-control" required value="${getTodayDate()}">
        </div>
      </div>

      <div class="erp-grid-2-tight">
        <div>
          <label class="form-label" style="font-weight:700;">Update Case Status To</label>
          <select id="flp-new-status" class="form-control">
            ${STANDARD_CASE_STATUSES.map(st => `
              <option value="${st}" ${c.currentStatus === st ? 'selected' : ''}>${st}</option>
            `).join('')}
          </select>
        </div>
        <div>
          <label class="form-label" style="font-weight:700;">Next 90-Day Follow-up Target</label>
          <input type="date" id="flp-next-target" class="form-control" value="${calculateNext90Days(getTodayDate())}">
        </div>
      </div>

      <div>
        <label class="form-label" style="font-weight:700;">Official Response / Follow-up Notes *</label>
        <textarea id="flp-notes" class="form-control" rows="2" required placeholder="Enter remarks, officer name, or ground observation..."></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem;">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Record Follow-up Action</button>
      </div>
    </form>
  `;

  openModal(`⏱ Record Chronological Follow-up (#${c.caseId})`, content, null);
}

/**
 * Open Case Details Full Drawer / Modal with all 25 fields and timelines
 */
export function openCaseDetailsModal(caseId) {
  const c = getGovtCaseById(caseId);
  if (!c) {
    showToast('Case not found', 'danger');
    return;
  }

  const grievances = c.grievanceHistory || [];
  const followups = c.followupHistory || [];

  const content = `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">
      <!-- Header Badge Banner -->
      <div style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
        <div>
          <div style="font-family:monospace; font-size:1.1rem; font-weight:800; color:var(--blue-700);">
            ${c.caseId}
          </div>
          <div style="font-size:1.2rem; font-weight:800; color:var(--text-main); margin-top:0.15rem;">
            ${c.applicantName}
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted);">
            HOF: ${c.hofName || c.relativeName || '-'} • Mobile: ${c.mobileNumber}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="margin-bottom:0.35rem;">${getStatusBadge(c.currentStatus)}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${c.govtLevel} • ${c.schemeName}</div>
        </div>
      </div>

      <!-- 25 Field Grid -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:0.75rem; font-size:0.82rem; background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:1rem;">
        <div><strong style="color:var(--text-muted);">01. Case ID:</strong><br><span style="font-family:monospace; font-weight:700;">${c.caseId}</span></div>
        <div><strong style="color:var(--text-muted);">02. Applicant Name:</strong><br><strong>${c.applicantName}</strong></div>
        <div><strong style="color:var(--text-muted);">03. Father / Husband:</strong><br>${c.relativeName || '-'}</div>
        <div><strong style="color:var(--text-muted);">04. Head of Family (HOF):</strong><br>${c.hofName || '-'}</div>
        <div><strong style="color:var(--text-muted);">05. Mobile Number:</strong><br><span style="font-family:monospace;">${c.mobileNumber}</span></div>
        <div><strong style="color:var(--text-muted);">06. Full Address:</strong><br>${c.address || '-'}</div>
        <div><strong style="color:var(--text-muted);">07. District:</strong><br>${c.district || 'Murshidabad'}</div>
        <div><strong style="color:var(--text-muted);">08. Block / Municipality:</strong><br>${c.blockMunicipality || '-'}</div>
        <div><strong style="color:var(--text-muted);">09. Government Level:</strong><br>${c.govtLevel}</div>
        <div><strong style="color:var(--text-muted);">10. Scheme Name:</strong><br><strong>${c.schemeName}</strong></div>
        <div><strong style="color:var(--text-muted);">11. Case Category:</strong><br>${c.caseCategory}</div>
        <div><strong style="color:var(--text-muted);">12. Application ID:</strong><br><span style="font-family:monospace; font-weight:700;">${c.applicationId || '-'}</span></div>
        <div><strong style="color:var(--text-muted);">13. Submission Date:</strong><br>${formatDate(c.submissionDate)}</div>
        <div><strong style="color:var(--text-muted);">14. Prev Payment Status:</strong><br>${c.previousPaymentStatus || '-'}</div>
        <div><strong style="color:var(--text-muted);">15. Current Status:</strong><br>${c.currentStatus}</div>
        <div><strong style="color:var(--text-muted);">16. Complaint Channel:</strong><br>${c.complaintChannel || 'None'}</div>
        <div><strong style="color:var(--text-muted);">17. Complaint Ref No:</strong><br><span style="font-family:monospace; font-weight:700;">${c.complaintRefNumber || '-'}</span></div>
        <div><strong style="color:var(--text-muted);">18. Complaint Date:</strong><br>${formatDate(c.complaintSubmissionDate)}</div>
        <div><strong style="color:var(--text-muted);">20. Assigned Authority:</strong><br>${c.assignedAuthority || '-'}</div>
        <div><strong style="color:var(--text-muted);">21. Last Follow-up:</strong><br>${formatDate(c.lastFollowupDate)}</div>
        <div><strong style="color:var(--text-muted);">22. Next 90-Day Target:</strong><br><strong>${formatDate(c.nextFollowupDate)}</strong></div>
        <div><strong style="color:var(--text-muted);">24. Resolution Status:</strong><br>${c.resolutionStatus || '-'}</div>
        <div><strong style="color:var(--text-muted);">25. Case Closing Date:</strong><br>${formatDate(c.caseClosingDate) || 'Active / Open'}</div>
      </div>

      <!-- Verified Supporting Documents -->
      <div style="background:var(--surface-alt); padding:0.85rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
        <div style="font-size:0.75rem; font-weight:800; color:var(--text-muted); margin-bottom:0.4rem; text-transform:uppercase;">
          19. Verified Supporting Documents Collected (${c.supportingDocuments ? c.supportingDocuments.length : 0})
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
          ${c.supportingDocuments && c.supportingDocuments.length > 0 ? c.supportingDocuments.map(d => `
            <span style="background:var(--surface); border:1px solid var(--border-subtle); padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600; color:#15803d;">
              ✓ ${d}
            </span>
          `).join('') : '<span style="font-size:0.78rem; color:var(--text-muted);">No documents logged yet</span>'}
        </div>
      </div>

      <!-- Grievance Escalation History (Rule 4 & 5) -->
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <h4 style="font-size:0.9rem; font-weight:800; color:var(--text-main);">
            ⚖ Public Grievance History (${grievances.length})
          </h4>
          <button class="btn btn-secondary btn-sm" onclick="window.MJK.openAddGrievanceModal('${c.caseId}')">
            ＋ Attach Another Grievance
          </button>
        </div>
        ${grievances.length === 0 ? `
          <div style="font-size:0.8rem; color:var(--text-muted); background:var(--surface-alt); padding:0.75rem; border-radius:var(--radius-md);">
            No separate grievance dockets attached to this case.
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            ${grievances.map(g => `
              <div style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.65rem 0.85rem; font-size:0.82rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                  <strong style="color:var(--text-main);">${g.channel}</strong>
                  <span style="font-family:monospace; font-weight:700; color:var(--blue-700);">${g.refNumber}</span>
                </div>
                <div style="color:var(--text-muted); font-size:0.75rem;">
                  Submitted on ${formatDate(g.submissionDate)} • Assigned to ${g.assignedAuthority}
                </div>
                ${g.notes ? `<div style="margin-top:0.35rem; color:var(--text-main); font-size:0.78rem;">${g.notes}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Chronological Follow-up Timeline (Rule 9) -->
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <h4 style="font-size:0.9rem; font-weight:800; color:var(--text-main);">
            ⏱ Chronological Follow-up Timeline (${followups.length})
          </h4>
          <button class="btn btn-primary btn-sm" onclick="window.MJK.openAddFollowupModal('${c.caseId}')">
            ＋ Log Action
          </button>
        </div>
        ${followups.length === 0 ? `
          <div style="font-size:0.8rem; color:var(--text-muted); background:var(--surface-alt); padding:0.75rem; border-radius:var(--radius-md);">
            No follow-up events recorded yet.
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            ${followups.map(f => `
              <div style="background:var(--surface); border:1px solid var(--border-subtle); border-left:3px solid var(--blue-600); border-radius:var(--radius-md); padding:0.65rem 0.85rem; font-size:0.8rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.2rem;">
                  <strong style="color:var(--text-main);">${f.actionType}</strong>
                  <span style="font-size:0.75rem; color:var(--text-muted);">${formatDate(f.date)}</span>
                </div>
                <div style="color:var(--text-muted); font-size:0.75rem; margin-bottom:0.25rem;">
                  Status Transition: <span style="font-weight:600;">${f.statusBefore || '-'}</span> ➔ <span style="font-weight:700; color:var(--blue-700);">${f.statusAfter || '-'}</span> • By ${f.recordedBy || 'Operator'}
                </div>
                <div style="color:var(--text-main); line-height:1.4;">${f.notes}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="window.MJK.closeModal()">Close</button>
    <button class="btn btn-outline" onclick="window.MJK.printCitizenReceipt('${c.caseId}')">🖨 Print Citizen Slip</button>
    <button class="btn btn-primary" onclick="window.MJK.openGovtCaseModal('${c.caseId}')">✏ Edit Master Record</button>
  `;

  openModal(`Case Profile: #${c.caseId} - ${c.applicantName}`, content, footer);
}

/**
 * Open Modal to Display 12 Duplicate Prevention Rules
 */
export function openDuplicateRulesModal() {
  const content = `
    <div style="display:flex; flex-direction:column; gap:0.75rem; max-height:65vh; overflow-y:auto; padding-right:0.35rem;">
      <div style="font-size:0.85rem; color:var(--text-muted); line-height:1.5;">
        MUN COMPUTER strictly enforces the following <strong>12 Duplicate Prevention Rules</strong> to prevent duplicate options, redundant applications, and fragmented citizen records:
      </div>

      ${DUPLICATE_PREVENTION_RULES.map(r => `
        <div style="background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.75rem 0.9rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
            <span style="width:24px; height:24px; border-radius:50%; background:var(--blue-600); color:#fff; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:800;">
              ${r.ruleNo}
            </span>
            <strong style="font-size:0.9rem; color:var(--text-main);">${r.title}</strong>
          </div>
          <p style="font-size:0.82rem; color:var(--text-muted); margin:0; padding-left:2rem; line-height:1.45;">
            ${r.description}
          </p>
        </div>
      `).join('')}
    </div>
  `;

  openModal('🛡 12 Duplicate Prevention Rules (সফটওয়্যার নির্দেশিকা)', content, `
    <button class="btn btn-primary" onclick="window.MJK.closeModal()">I Understand</button>
  `);
}

/**
 * Print Citizen Acknowledgement Receipt (Clean Printable Slip)
 */
export function printCitizenReceipt(caseId) {
  const c = getGovtCaseById(caseId);
  if (!c) {
    showToast('Case not found', 'danger');
    return;
  }

  const html = `
    <div class="mun-bw-doc">
      ${renderBwDocumentHeader({
        docTitle: 'CITIZEN ACKNOWLEDGEMENT',
        docNumber: c.caseId,
        docDateTime: formatDate(c.submissionDate),
        statusText: c.currentStatus || 'REGISTERED',
        serviceRefNumber: c.applicationId || ''
      })}

      <div class="a4-avoid-break" style="border:1px solid #000000; padding:8px 10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <div style="font-size:7.5pt; font-weight:700; text-transform:uppercase;">Scheme &amp; Work Type</div>
          <div style="font-size:10.5pt; font-weight:900;">${c.schemeName} (${c.govtLevel})</div>
          <div style="font-size:8.5pt;">${c.caseCategory}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:7.5pt; font-weight:700; text-transform:uppercase;">Current Status</div>
          <div style="font-weight:900; font-size:10pt;">${c.currentStatus}</div>
        </div>
      </div>

      <table>
        <tbody>
          <tr><td style="width:26%; font-weight:700;">Applicant Full Name</td><td style="width:24%;">${c.applicantName}</td><td style="width:26%; font-weight:700;">Mobile Number</td><td class="font-mono">${c.mobileNumber}</td></tr>
          <tr><td style="font-weight:700;">Father / Husband Name</td><td>${c.relativeName || '-'}</td><td style="font-weight:700;">Head of Family (HOF)</td><td>${c.hofName || '-'}</td></tr>
          <tr><td style="font-weight:700;">Application / Sanction ID</td><td class="font-mono">${c.applicationId || '-'}</td><td style="font-weight:700;">Grievance / Docket Ref</td><td class="font-mono">${c.complaintRefNumber && c.complaintRefNumber !== '-' ? `${c.complaintRefNumber} (${c.complaintChannel})` : 'N/A'}</td></tr>
          <tr><td style="font-weight:700;">Block / Municipality</td><td>${c.blockMunicipality || '-'}, ${c.district || 'Murshidabad'}</td><td style="font-weight:700;">Assigned Authority</td><td>${c.assignedAuthority || 'BDO Office'}</td></tr>
          <tr><td style="font-weight:700;">Submission Date</td><td class="tabular-nums">${formatDate(c.submissionDate)}</td><td style="font-weight:700;">Next 90-Day Review</td><td class="tabular-nums"><strong>${formatDate(c.nextFollowupDate)}</strong></td></tr>
          <tr><td style="font-weight:700;">Supporting Documents</td><td colspan="3">${c.supportingDocuments ? c.supportingDocuments.join(', ') : 'Verified by operator'}</td></tr>
          ${c.remarks ? `<tr><td style="font-weight:700;">Case Remarks</td><td colspan="3">${c.remarks}</td></tr>` : ''}
        </tbody>
      </table>

      ${renderLegalTermsSection()}
      ${renderAcknowledgementSection({ includeCustomerSignature: true, dateStr: formatDate(c.submissionDate) })}
    </div>
  `;

  showInAppPrintModal(`Citizen Acknowledgement Slip - ${c.caseId}`, html);
}

/**
 * Export Master Register to CSV
 */
export function exportGovtRegisterCSV() {
  const cases = getAllGovtCases();
  if (cases.length === 0) {
    showToast('No records to export', 'warning');
    return;
  }

  const headers = [
    'Case ID', 'Applicant Name', 'Father/Husband Name', 'HOF Name', 'Mobile',
    'District', 'Block/Municipality', 'Govt Level', 'Scheme Name', 'Case Category',
    'Application ID', 'Submission Date', 'Payment Status', 'Current Status',
    'Grievance Channel', 'Grievance Ref No', 'Assigned Authority', 'Next Followup Date'
  ];

  const rows = cases.map(c => [
    `"${c.caseId || ''}"`,
    `"${c.applicantName || ''}"`,
    `"${c.relativeName || ''}"`,
    `"${c.hofName || ''}"`,
    `"${c.mobileNumber || ''}"`,
    `"${c.district || ''}"`,
    `"${c.blockMunicipality || ''}"`,
    `"${c.govtLevel || ''}"`,
    `"${c.schemeName || ''}"`,
    `"${c.caseCategory || ''}"`,
    `"${c.applicationId || ''}"`,
    `"${c.submissionDate || ''}"`,
    `"${c.previousPaymentStatus || ''}"`,
    `"${c.currentStatus || ''}"`,
    `"${c.complaintChannel || ''}"`,
    `"${c.complaintRefNumber || ''}"`,
    `"${c.assignedAuthority || ''}"`,
    `"${c.nextFollowupDate || ''}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `MUN_Govt_Schemes_Master_Register_${getTodayDate()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Master Register exported to CSV successfully!', 'success');
}

/**
 * Export Master Register to real Excel (.xlsx)
 */
export function exportGovtRegisterExcel() {
  const cases = getAllGovtCases();
  if (cases.length === 0) {
    showToast('No records to export', 'warning');
    return;
  }

  const rows = cases.map(c => ({
    'Case ID': c.caseId || '',
    'Applicant Name': c.applicantName || '',
    'Father/Husband Name': c.relativeName || '',
    'HOF Name': c.hofName || '',
    'Mobile': c.mobileNumber || '',
    'District': c.district || '',
    'Block/Municipality': c.blockMunicipality || '',
    'Govt Level': c.govtLevel || '',
    'Scheme Name': c.schemeName || '',
    'Case Category': c.caseCategory || '',
    'Application ID': c.applicationId || '',
    'Submission Date': c.submissionDate || '',
    'Payment Status': c.previousPaymentStatus || '',
    'Current Status': c.currentStatus || '',
    'Grievance Channel': c.complaintChannel || '',
    'Grievance Ref No': c.complaintRefNumber || '',
    'Assigned Authority': c.assignedAuthority || '',
    'Next Followup Date': c.nextFollowupDate || ''
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Govt Master Register');
  XLSX.writeFile(wb, `MUN_Govt_Schemes_Master_Register_${getTodayDate()}.xlsx`);
  showToast('Master Register exported to Excel (.xlsx) successfully!', 'success');
}

/**
 * Export Master Register to PDF
 */
export function exportGovtRegisterPDF() {
  const cases = getAllGovtCases();
  if (cases.length === 0) {
    showToast('No records to export', 'warning');
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const startY = drawBwPdfHeader(doc, {
    docTitle: 'GOVERNMENT SCHEME & GRIEVANCE REPORT',
    metaLine: `Total Records: ${cases.length}`
  });

  const opts = {
    startY,
    head: [['Case ID', 'Applicant', 'Mobile', 'Scheme', 'Work Category', 'App ID', 'Status', 'Grievance Ref', 'Next Follow-up']],
    body: cases.map(c => [
      c.caseId || '-',
      c.applicantName || '-',
      c.mobileNumber || '-',
      c.schemeName || '-',
      c.caseCategory || '-',
      c.applicationId || '-',
      c.currentStatus || '-',
      c.complaintRefNumber || '-',
      c.nextFollowupDate || '-'
    ]),
    ...getBwAutoTableStyles(),
    styles: { ...getBwAutoTableStyles().styles, fontSize: 7.4 },
    margin: { left: 10, right: 10, bottom: 14 }
  };

  if (typeof autoTable === 'function') autoTable(doc, opts);
  else if (typeof doc.autoTable === 'function') doc.autoTable(opts);

  finalizeBwPdfPagination(doc, 'MUN COMPUTER · Government Scheme Facilitation Register');
  doc.save(`MUN_Govt_Schemes_Master_Register_${getTodayDate()}.pdf`);
  showToast('Master Register exported to PDF successfully!', 'success');
}
