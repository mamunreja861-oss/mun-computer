/**
 * govtHandlers.js - Event Handlers & Controller Logic for Government Schemes
 * MUN COMPUTER BUSINESS MANAGER
 */

import {
  getAllGovtCases,
  saveGovtCase,
  deleteGovtCase,
  getGovtCaseById,
  detectDuplicateCase,
  addGrievanceReferenceToCase,
  addFollowupLogToCase,
  calculateNext90Days
} from './govtSchemes.js';

import {
  openGovtCaseModal,
  openAddGrievanceModal,
  openAddFollowupModal,
  openCaseDetailsModal,
  openDuplicateRulesModal,
  printCitizenReceipt,
  exportGovtRegisterCSV,
  exportGovtRegisterExcel,
  exportGovtRegisterPDF
} from './govtViews.js';

import { allocateGlobalReference } from './storage.js';
import { setupAnnapurnaHandlers } from './annapurnaCaseViews.js';

export function setupGovtHandlers(MJK, showToast, openModal, closeModal, showConfirmDialog, render) {
  setupAnnapurnaHandlers(MJK, showToast, openModal, closeModal, showConfirmDialog, render);

  // Modal openers
  MJK.openNewGovtCaseModal = (editCaseId = null, presetScheme = '', presetCategory = '', isAnnapurna = false) => {
    openGovtCaseModal(editCaseId, presetScheme, presetCategory, isAnnapurna);
  };

  MJK.openGovtCaseModal = (editCaseId = null, presetScheme = '', presetCategory = '', isAnnapurna = false) => {
    openGovtCaseModal(editCaseId, presetScheme, presetCategory, isAnnapurna);
  };

  MJK.openAddGrievanceModal = (caseId) => {
    openAddGrievanceModal(caseId);
  };

  MJK.openAddFollowupModal = (caseId) => {
    openAddFollowupModal(caseId);
  };

  MJK.openCaseDetailsModal = (caseId) => {
    openCaseDetailsModal(caseId);
  };

  MJK.openDuplicateRulesModal = () => {
    openDuplicateRulesModal();
  };

  MJK.printCitizenReceipt = (caseId) => {
    printCitizenReceipt(caseId);
  };

  MJK.exportGovtRegisterCSV = () => {
    exportGovtRegisterCSV();
  };

  MJK.exportGovtRegisterExcel = () => {
    exportGovtRegisterExcel();
  };

  MJK.exportGovtRegisterPDF = () => {
    exportGovtRegisterPDF();
  };

  // Real-time duplicate check inside form (Rule 10)
  MJK.checkFormDuplicate = () => {
    const schemeName = document.getElementById('gc-scheme-name')?.value;
    const applicationId = document.getElementById('gc-application-id')?.value;
    const mobileNumber = document.getElementById('gc-mobile-number')?.value;
    const applicantName = document.getElementById('gc-applicant-name')?.value;
    const editId = document.getElementById('gc-edit-id')?.value;

    const warnBox = document.getElementById('duplicate-warning-box');
    const warnText = document.getElementById('duplicate-warning-text');

    if (!warnBox || !warnText) return;

    const res = detectDuplicateCase({
      schemeName,
      applicationId,
      mobileNumber,
      applicantName,
      excludeCaseId: editId || null
    });

    if (res.isDuplicate) {
      warnBox.style.display = 'block';
      warnText.textContent = res.warning || 'A matching case or application ID already exists.';
    } else {
      warnBox.style.display = 'none';
      warnText.textContent = '';
    }
  };

  // Switch between State & Central schemes dropdown (Rule 7)
  MJK.handleGovtLevelChange = (level) => {
    const schemeSelect = document.getElementById('gc-scheme-name');
    if (!schemeSelect) return;

    if (level === 'State Government') {
      schemeSelect.value = 'Annapurna Yojana';
    } else {
      schemeSelect.value = 'PM-KISAN';
    }
    MJK.checkFormDuplicate();
  };

  // Save / Update Master Case Form
  MJK.saveGovtCaseForm = async (e) => {
    e.preventDefault();

    const editId = document.getElementById('gc-edit-id')?.value;
    const govtLevel = document.getElementById('gc-govt-level')?.value;
    const schemeName = document.getElementById('gc-scheme-name')?.value;
    const caseCategory = document.getElementById('gc-case-category')?.value;
    const applicationId = document.getElementById('gc-application-id')?.value?.trim();
    const applicantName = document.getElementById('gc-applicant-name')?.value?.trim();
    const relativeName = document.getElementById('gc-relative-name')?.value?.trim();
    const hofName = document.getElementById('gc-hof-name')?.value?.trim() || applicantName;
    const mobileNumber = document.getElementById('gc-mobile-number')?.value?.trim();
    const district = document.getElementById('gc-district')?.value;
    const blockMunicipality = document.getElementById('gc-block')?.value?.trim();
    const address = document.getElementById('gc-address')?.value?.trim();
    const currentStatus = document.getElementById('gc-current-status')?.value;
    const previousPaymentStatus = document.getElementById('gc-payment-status')?.value;
    const submissionDate = document.getElementById('gc-submission-date')?.value || new Date().toISOString().slice(0, 10);
    const nextFollowupDate = document.getElementById('gc-next-followup')?.value || calculateNext90Days(submissionDate);
    const assignedAuthority = document.getElementById('gc-assigned-authority')?.value?.trim() || 'BDO Office';
    const resolutionStatus = document.getElementById('gc-resolution-status')?.value;
    const complaintChannel = document.getElementById('gc-complaint-channel')?.value;
    const complaintRefNumber = document.getElementById('gc-complaint-ref')?.value?.trim() || '-';
    const remarks = document.getElementById('gc-remarks')?.value?.trim() || '';

    // Checked documents
    const docEls = document.querySelectorAll('input[name="gc-docs"]:checked');
    const supportingDocuments = Array.from(docEls).map(el => el.value);

    // Rule 10: Duplicate Check Before Saving
    const dupCheck = detectDuplicateCase({
      schemeName,
      applicationId,
      mobileNumber,
      applicantName,
      excludeCaseId: editId || null
    });

    if (dupCheck.isDuplicate && !editId) {
      const isExactAppId = dupCheck.matches.some(m => m.type === 'EXACT_APPLICATION_ID');
      if (isExactAppId) {
        showToast(`Cannot save duplicate Application ID: ${dupCheck.warning}`, 'danger', 5000);
        return;
      }
    }

    const existing = editId ? getGovtCaseById(editId) : null;

    const caseData = {
      caseId: editId || undefined,
      applicantName,
      relativeName,
      hofName,
      mobileNumber,
      address,
      district,
      blockMunicipality,
      govtLevel,
      schemeName,
      caseCategory,
      applicationId,
      submissionDate,
      previousPaymentStatus,
      currentStatus,
      complaintChannel,
      complaintRefNumber,
      complaintSubmissionDate: (complaintChannel !== 'None' && complaintRefNumber !== '-') ? submissionDate : '',
      supportingDocuments,
      assignedAuthority,
      lastFollowupDate: existing ? existing.lastFollowupDate : submissionDate,
      nextFollowupDate,
      remarks,
      resolutionStatus,
      caseClosingDate: ['Resolved', 'Closed'].includes(currentStatus) ? (existing?.caseClosingDate || new Date().toISOString().slice(0, 10)) : '',
      isAnnapurna: schemeName === 'Annapurna Yojana',
      rationCardCategory: existing?.rationCardCategory || 'AAY',
      grievanceHistory: existing?.grievanceHistory || [],
      followupHistory: existing?.followupHistory || []
    };

    try {
      // If new case and initial grievance set
      if (!editId && complaintChannel !== 'None' && complaintRefNumber && complaintRefNumber !== '-') {
        const grvRefId = await allocateGlobalReference('GRV', { entityType: 'GRIEVANCE' });
        caseData.grievanceHistory.push({
          refId: grvRefId,
          channel: complaintChannel,
          refNumber: complaintRefNumber,
          submissionDate,
          assignedAuthority,
          subject: `Initial Grievance: ${caseCategory}`,
          notes: remarks
        });
      }

      // If new case, add initial creation log to chronological history (Rule 9)
      if (!editId) {
        const flwId = await allocateGlobalReference('FLW', { entityType: 'FOLLOWUP' });
        caseData.followupHistory.push({
          id: flwId,
          date: submissionDate,
          actionType: 'Master Case Registered',
          notes: `Registered under ${schemeName} (${caseCategory}). Next review set to ${nextFollowupDate}.`,
          statusBefore: 'New',
          statusAfter: currentStatus,
          recordedBy: 'MUN COMPUTER Staff'
        });
      }

      const saved = await saveGovtCase(caseData);
      closeModal();
      showToast(`Master Case ${saved.caseId} recorded successfully!`, 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save Govt Master Case.', 'danger');
    }
  };

  // Save Attached Grievance (Rule 4 & 5)
  MJK.saveGrievanceForm = async (e, caseId) => {
    e.preventDefault();
    const channel = document.getElementById('grv-channel')?.value;
    const refNumber = document.getElementById('grv-ref-number')?.value?.trim();
    const submissionDate = document.getElementById('grv-date')?.value;
    const assignedAuthority = document.getElementById('grv-authority')?.value?.trim();
    const subject = document.getElementById('grv-subject')?.value?.trim();
    const notes = document.getElementById('grv-notes')?.value?.trim();

    if (!refNumber) {
      showToast('Grievance reference / docket number is required', 'warning');
      return;
    }

    try {
      const updated = await addGrievanceReferenceToCase(caseId, {
        channel,
        refNumber,
        submissionDate,
        assignedAuthority,
        subject,
        notes
      });

      if (updated) {
        closeModal();
        showToast(`Grievance Ref #${refNumber} attached to Case #${caseId}`, 'success');
        render();
      } else {
        showToast('Failed to attach grievance', 'danger');
      }
    } catch (err) {
      showToast(err?.message || 'Failed to attach grievance.', 'danger');
    }
  };

  // Save Chronological Follow-up (Rule 9)
  MJK.saveFollowupForm = async (e, caseId) => {
    e.preventDefault();
    const actionType = document.getElementById('flp-action-type')?.value;
    const date = document.getElementById('flp-date')?.value;
    const newStatus = document.getElementById('flp-new-status')?.value;
    const nextFollowupDate = document.getElementById('flp-next-target')?.value;
    const notes = document.getElementById('flp-notes')?.value?.trim();

    const targetCase = getGovtCaseById(caseId);
    if (!targetCase) {
      showToast('Case not found', 'danger');
      return;
    }

    try {
      await addFollowupLogToCase(targetCase, {
        actionType,
        date,
        newStatus,
        nextFollowupDate,
        notes
      });

      await saveGovtCase(targetCase);
      closeModal();
      showToast(`Follow-up activity recorded for Case #${caseId}`, 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to record follow-up activity.', 'danger');
    }
  };

  // Delete Case with confirmation
  MJK.deleteGovtCase = (caseId) => {
    showConfirmDialog(
      'Delete Master Case Record?',
      `Are you sure you want to delete Case #${caseId}? Per Rule 12, resolved or closed cases should normally be retained for historical compliance.`,
      () => {
        deleteGovtCase(caseId);
        showToast(`Case #${caseId} deleted.`, 'info');
        render();
      }
    );
  };

  // Filter setters
  MJK.setSchemeTabFilter = (tab) => {
    window._schemeTabFilter = tab;
    render();
  };

  MJK.setSchemeSearch = (q) => {
    window._schemeSearch = q;
    const input = document.getElementById('scheme-search-input');
    if (input) input.value = q;
    render();
  };

  MJK.setAppWorkTypeFilter = (w) => {
    window._appWorkTypeFilter = w;
    render();
  };

  MJK.setAppGovtLevelFilter = (l) => {
    window._appGovtLevelFilter = l;
    render();
  };

  MJK.setGrievanceChannelFilter = (ch) => {
    window._grievanceChannelFilter = ch;
    render();
  };

  MJK.setAnnapurnaActionFilter = (act) => {
    window._annapurnaActionFilter = act;
    render();
  };

  MJK.setMasterSearch = (q) => {
    window._masterSearch = q;
    render();
  };

  MJK.setMasterGovtLevel = (l) => {
    window._masterGovtLevel = l;
    render();
  };

  MJK.setMasterStatus = (st) => {
    window._masterStatus = st;
    render();
  };

  MJK.setMasterDistrict = (d) => {
    window._masterDistrict = d;
    render();
  };

  MJK.setMasterScheme = (s) => {
    window._masterScheme = s;
    render();
  };

  MJK.setFollowupFilter = (f) => {
    window._followupFilter = f;
    render();
  };
}
