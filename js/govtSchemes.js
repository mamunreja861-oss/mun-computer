/**
 * govtSchemes.js - Government Schemes & Public Grievance Management Division
 * MUN COMPUTER BUSINESS MANAGER
 * 
 * Centralized Department Structure adhering strictly to:
 * 1. Main Department Configuration
 * 2. Government Scheme Directory (20 West Bengal + 22 Central Schemes)
 * 3. Application & Claim Management (15 Action Types)
 * 4. Public Grievance & Complaint Management (10 Channels)
 * 5. Annapurna Yojana - Dedicated Specialized Management (18 Sub-actions)
 * 6. Unified Applicant & Complaint Master Register (25 Core Fields)
 * 7. Standard Case Status (16 Statuses)
 * 8. 8 Main Software Modules
 * 9. 12 Duplicate Prevention Rules
 */

import { getItem, setItem, KEYS, formatDate, formatDateTime, getTodayDate, allocateGlobalReference, markGlobalReferenceDeleted } from './storage.js';
import { getAllCustomers, saveCustomer } from './customers.js';
import { getCurrentUser } from './auth.js';

/* =========================================================================
   ১. MAIN DEPARTMENT DEFINITION
   ========================================================================= */

export const GOVT_DEPARTMENT_INFO = {
  name: 'Government Schemes & Public Grievance Management Division',
  nameBn: 'সরকারি প্রকল্প ও গণঅভিযোগ প্রতিকার ব্যবস্থাপনা বিভাগ',
  organization: 'MUN COMPUTER',
  description: `MUN COMPUTER provides integrated citizen facilitation services for Central Government and West Bengal Government welfare schemes, public benefit programmes, new applications, existing beneficiary claims and public grievance redressal.

The division manages application assistance, claim documentation, beneficiary verification support, payment-related complaints, application corrections, grievance submissions, reference number tracking and administrative follow-ups through a centralized case management system.

All government scheme applications and grievances are maintained under a unified applicant database to prevent duplicate records and ensure transparent case monitoring.`,
  tagline: 'Centralized Citizen Facilitation & Grievance Redressal ERP',
  codePrefix: 'MUN-GOV'
};

/* =========================================================================
   ২. GOVERNMENT SCHEME DIRECTORY
   A. West Bengal Government Schemes (20)
   B. Central Government Schemes (22)
   ========================================================================= */

export const WB_STATE_SCHEMES = [
  { id: 'WB-01', name: 'Annapurna Yojana', nameBn: 'অন্নপূর্ণা যোজনা', level: 'State Government', dept: 'Food & Supplies / Women & Child', category: 'Food & Social Welfare', hasDedicatedModule: true },
  { id: 'WB-02', name: 'Lakshmir Bhandar', nameBn: 'লক্ষ্মীর ভাণ্ডার', level: 'State Government', dept: 'Women and Child Development & Social Welfare', category: 'Direct Financial Assistance' },
  { id: 'WB-03', name: 'Kanyashree Prakalpa', nameBn: 'কন্যাশ্রী প্রকল্প', level: 'State Government', dept: 'Women and Child Development', category: 'Girl Child Welfare & Education' },
  { id: 'WB-04', name: 'Rupashree Prakalpa', nameBn: 'রূপশ্রী প্রকল্প', level: 'State Government', dept: 'Women and Child Development', category: 'Marriage Grant' },
  { id: 'WB-05', name: 'Swasthya Sathi', nameBn: 'স্বাস্থ্য সাথী', level: 'State Government', dept: 'Health and Family Welfare', category: 'Health Insurance' },
  { id: 'WB-06', name: 'Krishak Bandhu', nameBn: 'কৃষক বন্ধু', level: 'State Government', dept: 'Agriculture Department', category: 'Farmer Financial & Death Benefit' },
  { id: 'WB-07', name: 'Bangla Shasya Bima', nameBn: 'বাংলা শস্য বীমা', level: 'State Government', dept: 'Agriculture Department', category: 'Crop Insurance' },
  { id: 'WB-08', name: 'Manabik Pension Scheme', nameBn: 'মানবিক পেনশন প্রকল্প', level: 'State Government', dept: 'Women and Child Development & Social Welfare', category: 'Disability Pension' },
  { id: 'WB-09', name: 'Jai Johar', nameBn: 'জয় জোহার', level: 'State Government', dept: 'Tribal Development Department', category: 'ST Old Age Pension' },
  { id: 'WB-10', name: 'Taposili Bandhu', nameBn: 'তফসিলী বন্ধু', level: 'State Government', dept: 'Backward Classes Welfare Department', category: 'SC Old Age Pension' },
  { id: 'WB-11', name: 'Yuvashree', nameBn: 'যুবশ্রী', level: 'State Government', dept: 'Labour Department', category: 'Youth Employment Assistance' },
  { id: 'WB-12', name: 'Aikyashree Scholarship', nameBn: 'ঐক্যশ্রী স্কলারশিপ', level: 'State Government', dept: 'Minority Affairs & Madrasah Education', category: 'Minority Student Scholarship' },
  { id: 'WB-13', name: 'Swami Vivekananda Scholarship', nameBn: 'স্বামী বিবেকানন্দ স্কলারশিপ (SVMCM)', level: 'State Government', dept: 'Higher Education Department', category: 'Merit-cum-Means Scholarship' },
  { id: 'WB-14', name: 'Sikshashree', nameBn: 'শিক্ষাশ্রী', level: 'State Government', dept: 'Backward Classes Welfare Department', category: 'SC/ST Day Scholar Assistance' },
  { id: 'WB-15', name: 'Medhashree', nameBn: 'মেধাশ্রী', level: 'State Government', dept: 'Backward Classes Welfare Department', category: 'OBC Student Scholarship' },
  { id: 'WB-16', name: 'West Bengal Student Credit Card', nameBn: 'স্টুডেন্ট ক্রেডিট কার্ড', level: 'State Government', dept: 'Higher Education Department', category: 'Education Loan' },
  { id: 'WB-17', name: 'Banglar Awas Yojana', nameBn: 'বাংলার আবাস যোজনা', level: 'State Government', dept: 'Panchayat & Rural Development', category: 'Rural Housing' },
  { id: 'WB-18', name: 'Khadya Sathi', nameBn: 'খাদ্য সাথী', level: 'State Government', dept: 'Food & Supplies Department', category: 'Subsidized Food Grain' },
  { id: 'WB-19', name: 'Bina Mulya Samajik Suraksha Yojana', nameBn: 'বিনা মূল্যে সামাজিক সুরক্ষা যোজনা (BM-SSY)', level: 'State Government', dept: 'Labour Department', category: 'Unorganized Sector Security' },
  { id: 'WB-20', name: 'Other State Welfare Schemes', nameBn: 'অন্যান্য রাজ্য সরকারি প্রকল্প', level: 'State Government', dept: 'Concerned State Departments', category: 'General State Welfare' }
];

export const CENTRAL_GOVT_SCHEMES = [
  { id: 'CG-01', name: 'PM-KISAN', nameBn: 'পিএম কিষাণ সম্মান নিধি', level: 'Central Government', dept: 'Ministry of Agriculture & Farmers Welfare', category: 'Farmer Income Support' },
  { id: 'CG-02', name: 'Ayushman Bharat – PM-JAY', nameBn: 'আয়ুষ্মান ভারত – পিএম-জেএওয়াই', level: 'Central Government', dept: 'National Health Authority / MoHFW', category: 'Health Assurance' },
  { id: 'CG-03', name: 'ABHA', nameBn: 'আভা কার্ড (ABHA Card)', level: 'Central Government', dept: 'National Health Authority', category: 'Digital Health Account' },
  { id: 'CG-04', name: 'PMAY – Gramin', nameBn: 'পিএমএওয়াই – গ্রামীণ', level: 'Central Government', dept: 'Ministry of Rural Development', category: 'Rural Housing' },
  { id: 'CG-05', name: 'PMAY – Urban', nameBn: 'পিএমএওয়াই – আরবান', level: 'Central Government', dept: 'Ministry of Housing and Urban Affairs', category: 'Urban Housing' },
  { id: 'CG-06', name: 'PM Ujjwala Yojana', nameBn: 'প্রধানমন্ত্রী উজ্জ্বলা যোজনা', level: 'Central Government', dept: 'Ministry of Petroleum and Natural Gas', category: 'Clean Cooking LPG' },
  { id: 'CG-07', name: 'PM Surya Ghar', nameBn: 'প্রধানমন্ত্রী সূর্য ঘর মুফত বিজলী যোজনা', level: 'Central Government', dept: 'Ministry of New and Renewable Energy', category: 'Rooftop Solar Subsidy' },
  { id: 'CG-08', name: 'PM Fasal Bima Yojana', nameBn: 'প্রধানমন্ত্রী ফসল বীমা যোজনা', level: 'Central Government', dept: 'Ministry of Agriculture & Farmers Welfare', category: 'Crop Risk Insurance' },
  { id: 'CG-09', name: 'PM Jan Dhan Yojana', nameBn: 'প্রধানমন্ত্রী জন ধন যোজনা', level: 'Central Government', dept: 'Department of Financial Services (DFS)', category: 'Financial Inclusion Banking' },
  { id: 'CG-10', name: 'PMJJBY', nameBn: 'প্রধানমন্ত্রী জীবন জ্যোতি বীমা যোজনা', level: 'Central Government', dept: 'Department of Financial Services', category: 'Life Insurance' },
  { id: 'CG-11', name: 'PMSBY', nameBn: 'প্রধানমন্ত্রী সুরক্ষা বীমা যোজনা', level: 'Central Government', dept: 'Department of Financial Services', category: 'Accidental Insurance' },
  { id: 'CG-12', name: 'Atal Pension Yojana', nameBn: 'অটল পেনশন যোজনা (APY)', level: 'Central Government', dept: 'PFRDA / DFS', category: 'Retirement Pension' },
  { id: 'CG-13', name: 'PM Shram Yogi Maandhan', nameBn: 'পিএম শ্রম যোগী মানধন (PM-SYM)', level: 'Central Government', dept: 'Ministry of Labour and Employment', category: 'Unorganized Worker Pension' },
  { id: 'CG-14', name: 'PM SVANidhi', nameBn: 'পিএম স্বনিধি (PM SVANidhi)', level: 'Central Government', dept: 'Ministry of Housing and Urban Affairs', category: 'Street Vendor Micro-Credit' },
  { id: 'CG-15', name: 'PM Vishwakarma', nameBn: 'পিএম বিশ্বকর্মা যোজনা', level: 'Central Government', dept: 'Ministry of MSME', category: 'Traditional Artisans Support' },
  { id: 'CG-16', name: 'PM Mudra Yojana', nameBn: 'প্রধানমন্ত্রী মুদ্রা যোজনা (PMMY)', level: 'Central Government', dept: 'Department of Financial Services', category: 'Micro Enterprise Business Loan' },
  { id: 'CG-17', name: 'PMEGP', nameBn: 'পিএমইজিপি (PMEGP)', level: 'Central Government', dept: 'KVIC / Ministry of MSME', category: 'Employment Generation Subsidy' },
  { id: 'CG-18', name: 'e-Shram', nameBn: 'ই-শ্রম কার্ড (e-Shram)', level: 'Central Government', dept: 'Ministry of Labour and Employment', category: 'Unorganized Workers National Database' },
  { id: 'CG-19', name: 'National Scholarship Portal', nameBn: 'ন্যাশনাল স্কলারশিপ পোর্টাল (NSP)', level: 'Central Government', dept: 'Ministry of Electronics & IT / UGC', category: 'Central Scholarships' },
  { id: 'CG-20', name: 'Sukanya Samriddhi Yojana', nameBn: 'সুকন্যা সমৃদ্ধি যোজনা (SSY)', level: 'Central Government', dept: 'Department of Posts / DFS', category: 'Girl Child Savings' },
  { id: 'CG-21', name: 'National Social Assistance Programme', nameBn: 'জাতীয় সামাজিক সহায়তা প্রকল্প (NSAP)', level: 'Central Government', dept: 'Ministry of Rural Development', category: 'National Social Pension' },
  { id: 'CG-22', name: 'Other Central Welfare Schemes', nameBn: 'অন্যান্য কেন্দ্রীয় সরকারি প্রকল্প', level: 'Central Government', dept: 'Concerned Central Ministries', category: 'General Central Welfare' }
];

export const ALL_SCHEMES = [...WB_STATE_SCHEMES, ...CENTRAL_GOVT_SCHEMES];

/* =========================================================================
   ৩. APPLICATION & CLAIM MANAGEMENT (15 WORK TYPES)
   ========================================================================= */

export const APPLICATION_WORK_TYPES = [
  'New Scheme Application',
  'Existing Application Claim',
  'First Payment Not Received',
  'Payment Stopped / Discontinued',
  'Pending Application Follow-up',
  'Further Verification / Re-verification',
  'Rejected Application Review',
  'Application Correction',
  'Beneficiary Details Correction',
  'Bank Account / DBT / NPCI Issue',
  'Missing Installment Claim',
  'Eligibility & Document Verification',
  'Duplicate / Incorrect Beneficiary Record',
  'Benefit Restoration Request',
  'Application Status Tracking'
];

/* =========================================================================
   ৪. PUBLIC GRIEVANCE & COMPLAINT MANAGEMENT (10 CHANNELS)
   ========================================================================= */

export const PUBLIC_GRIEVANCE_CHANNELS = [
  'CMO Citizen Portal Complaint',
  'Apnar Sarkar Apnar Pashe Grievance',
  'CPGRAMS – Central Government Complaint',
  'MLA Public Representation',
  'MP Public Representation',
  'BDO Office Complaint',
  'SDO Office Complaint',
  'District Magistrate (DM) Complaint',
  'Departmental Grievance',
  'Other Authorized Grievance Channels'
];

/* =========================================================================
   ৫. ANNAPURNA YOJANA - DEDICATED MANAGEMENT (18 SUB-ACTIONS)
   ========================================================================= */

export const ANNAPURNA_SUB_ACTIONS = [
  'New Application',
  'Existing Application Claim',
  'First Payment Not Received',
  'Payment Stopped After Initial Payment',
  'For Further Verification',
  'Under Process',
  'Under Enquiry',
  'Rejected Application',
  'Family Head (HOF) Correction',
  'Applicant Name / DOB Correction',
  'Bank / DBT / NPCI Issue',
  'CMO Citizen Portal Claim',
  'CPGRAMS Complaint',
  'MLA Representation',
  'BDO / SDO / DM Complaint',
  'Application Status Monitoring',
  '90-Day Follow-up Management',
  'Final Resolution Tracking'
];

/* =========================================================================
   ৭. STANDARD CASE STATUS (16 STATUSES)
   ========================================================================= */

export const STANDARD_CASE_STATUSES = [
  'New',
  'Documents Pending',
  'Ready for Submission',
  'Submitted',
  'Claim Submitted',
  'Under Process',
  'Pending Verification',
  'Further Verification Required',
  'Under Enquiry',
  'Forwarded to Department',
  'Awaiting Response',
  'Reminder Submitted',
  'Appeal Submitted',
  'Resolved',
  'Rejected',
  'Closed'
];

/* =========================================================================
   ৯. 12 DUPLICATE PREVENTION RULES
   ========================================================================= */

export const DUPLICATE_PREVENTION_RULES = [
  { ruleNo: 1, title: 'Unique Scheme ID', description: 'Every government scheme must have one unique Scheme ID (e.g. WB-01 to WB-20, CG-01 to CG-22).' },
  { ruleNo: 2, title: 'Centralized Customer ID', description: 'Every applicant must have one centralized Customer ID in MUN COMPUTER customer records.' },
  { ruleNo: 3, title: 'Unique Application Record', description: 'One application must have one unique Application Record in the system.' },
  { ruleNo: 4, title: 'Linked Multiple Complaints', description: 'Multiple complaints related to the same application must be linked to the original Case ID, never creating duplicate cases.' },
  { ruleNo: 5, title: 'Multi-Channel Grievance References', description: 'CMO, CPGRAMS, MLA, BDO, SDO and DM submissions must be recorded as separate grievance references under the same case.' },
  { ruleNo: 6, title: 'Centralized Scheme Directory Selection', description: 'Scheme names must be selected strictly from one centralized Scheme Directory.' },
  { ruleNo: 7, title: 'Separate State & Central Categories', description: 'State Government and Central Government schemes must remain in strictly separate categories.' },
  { ruleNo: 8, title: 'Annapurna Yojana Dedicated Module', description: 'Annapurna Yojana has a specialized dedicated module linked seamlessly to the unified applicant database.' },
  { ruleNo: 9, title: 'Chronological Follow-up History', description: 'All follow-up activities, reminders, and notices must be recorded in one chronological history per Case ID.' },
  { ruleNo: 10, title: 'Automated Duplicate Detection', description: 'Duplicate records are detected in real-time using Application ID, Scheme ID, and Applicant/Mobile ID.' },
  { ruleNo: 11, title: 'Linked Financial & Operational Records', description: 'Financial ledger transactions and complaint records remain linked by Case ID but separately maintained.' },
  { ruleNo: 12, title: 'Historical Preservation of Closed Cases', description: 'Closed and resolved cases are never purged; they remain permanently preserved in historical archives.' }
];

/* =========================================================================
   WEST BENGAL DISTRICTS (For standardized master register)
   ========================================================================= */

export const WB_DISTRICTS = [
  'Murshidabad',
  'Birbhum',
  'Malda',
  'Nadia',
  'Purba Bardhaman',
  'Paschim Bardhaman',
  'North 24 Parganas',
  'South 24 Parganas',
  'Hooghly',
  'Howrah',
  'Kolkata',
  'Bankura',
  'Purulia',
  'Purba Medinipur',
  'Paschim Medinipur',
  'Jhargram',
  'Uttar Dinajpur',
  'Dakshin Dinajpur',
  'Jalpaiguri',
  'Alipurduar',
  'Cooch Behar',
  'Darjeeling',
  'Kalimpong'
];

/* =========================================================================
   STANDARD SUPPORTING DOCUMENTS
   ========================================================================= */

export const STANDARD_DOCUMENTS = [
  'Aadhaar Card (Self-Attested)',
  'Ration Card / Khadya Sathi Card',
  'Bank Passbook (First Page with IFSC & Account No)',
  'NPCI / DBT Seeding Confirmation Slip',
  'Voter ID Card (EPIC)',
  'Passport Size Photograph',
  'Income Certificate / Self Declaration',
  'Caste Certificate (SC/ST/OBC)',
  'Disability Certificate (For Manabik/Divyangjan)',
  'Land Record / Khatian / Parcha (For Krishak Bandhu/PM-KISAN)',
  'Electricity Bill (For PM Surya Ghar)',
  'Existing Scheme Sanction Order / Old Receipt'
];

/* =========================================================================
   STORAGE HELPERS & DATA ACCESS
   ========================================================================= */

export function getAllGovtCases() {
  const cases = getItem(KEYS.GOVT_CASES, null);
  if (cases === null) {
    setItem(KEYS.GOVT_CASES, []);
    return [];
  }
  return cases || [];
}

export async function saveGovtCase(caseData) {
  const cases = getAllGovtCases();
  const existingIndex = cases.findIndex(c => c.caseId === caseData.caseId);

  // Auto-sync applicant into Centralized Customer Directory (Rule 2)
  await syncApplicantToCustomerDirectory(caseData);

  if (existingIndex >= 0) {
    cases[existingIndex] = {
      ...cases[existingIndex],
      ...caseData,
      updatedAt: new Date().toISOString()
    };
  } else {
    // Allocate authoritative Universal Global Reference No for new Govt Scheme Case
    if (!caseData.caseId) {
      caseData.caseId = await allocateGlobalReference('GOV', { entityType: 'GOVT_SCHEME' });
    }
    caseData.createdAt = new Date().toISOString();
    caseData.updatedAt = new Date().toISOString();
    cases.unshift(caseData);
  }

  setItem(KEYS.GOVT_CASES, cases);
  return caseData;
}

export function deleteGovtCase(caseId) {
  const cases = getAllGovtCases().filter(c => c.caseId !== caseId);
  setItem(KEYS.GOVT_CASES, cases);
  markGlobalReferenceDeleted(caseId);
}

export function getGovtCaseById(caseId) {
  return getAllGovtCases().find(c => c.caseId === caseId) || null;
}

/**
 * Duplicate Detection Engine (Rule 10 & Rule 3)
 * Checks whether an application with same Scheme ID + Application ID
 * or same Scheme ID + Mobile Number already exists.
 */
export function detectDuplicateCase({ schemeName, applicationId, mobileNumber, applicantName, excludeCaseId = null }) {
  const cases = getAllGovtCases();
  const matches = [];

  for (const c of cases) {
    if (excludeCaseId && c.caseId === excludeCaseId) continue;

    // Check exact Application ID match under same or different scheme
    if (applicationId && applicationId.trim() !== '' && c.applicationId) {
      if (c.applicationId.trim().toLowerCase() === applicationId.trim().toLowerCase() && c.schemeName === schemeName) {
        matches.push({
          caseId: c.caseId,
          type: 'EXACT_APPLICATION_ID',
          message: `Application ID '${applicationId}' is already registered under Case #${c.caseId} for '${c.applicantName}'.`
        });
      }
    }

    // Check same mobile + same scheme
    if (mobileNumber && mobileNumber.trim() !== '' && c.mobileNumber) {
      if (c.mobileNumber.trim() === mobileNumber.trim() && c.schemeName === schemeName) {
        matches.push({
          caseId: c.caseId,
          type: 'SAME_SCHEME_AND_MOBILE',
          message: `Mobile ${mobileNumber} already has an active record for '${schemeName}' under Case #${c.caseId} (${c.applicantName}).`
        });
      }
    }
  }

  return {
    isDuplicate: matches.length > 0,
    matches,
    warning: matches.length > 0 ? matches[0].message : null
  };
}

/**
 * Rule 4 & 5: Attach a grievance reference to an existing application case.
 */
export async function addGrievanceReferenceToCase(caseId, grievanceData) {
  const targetCase = getGovtCaseById(caseId);
  if (!targetCase) return null;

  if (!targetCase.grievanceHistory) targetCase.grievanceHistory = [];

  const grvRefId = await allocateGlobalReference('GRV', { entityType: 'GRIEVANCE', entityId: caseId });
  const newGrievance = {
    refId: grvRefId,
    channel: grievanceData.channel,
    refNumber: grievanceData.refNumber || grvRefId,
    submissionDate: grievanceData.submissionDate || getTodayDate(),
    assignedAuthority: grievanceData.assignedAuthority || 'BDO / SDO Office',
    subject: grievanceData.subject || 'Scheme Grievance Submission',
    notes: grievanceData.notes || '',
    recordedAt: new Date().toISOString()
  };

  targetCase.grievanceHistory.push(newGrievance);
  targetCase.complaintChannel = grievanceData.channel;
  targetCase.complaintRefNumber = newGrievance.refNumber;
  targetCase.complaintSubmissionDate = newGrievance.submissionDate;
  targetCase.assignedAuthority = newGrievance.assignedAuthority;

  // Add chronological follow-up log automatically (Rule 9)
  await addFollowupLogToCase(targetCase, {
    actionType: 'Grievance Submitted',
    notes: `Submitted grievance via ${grievanceData.channel}. Ref No: ${newGrievance.refNumber}. Assigned Authority: ${newGrievance.assignedAuthority}.`,
    date: grievanceData.submissionDate || getTodayDate(),
    nextFollowupDate: calculateNext90Days(grievanceData.submissionDate || getTodayDate())
  });

  await saveGovtCase(targetCase);
  return targetCase;
}

/**
 * Rule 9: Record chronological follow-up activity
 */
export async function addFollowupLogToCase(caseObj, followupEntry) {
  if (!caseObj.followupHistory) caseObj.followupHistory = [];

  const flwId = await allocateGlobalReference('FLW', { entityType: 'FOLLOWUP', entityId: caseObj.caseId });
  const entry = {
    id: flwId,
    date: followupEntry.date || getTodayDate(),
    actionType: followupEntry.actionType || 'Administrative Follow-up',
    notes: followupEntry.notes || '',
    statusBefore: caseObj.currentStatus,
    statusAfter: followupEntry.newStatus || caseObj.currentStatus,
    recordedBy: getCurrentUser() ? getCurrentUser().name : 'MUN COMPUTER Staff',
    timestamp: new Date().toISOString()
  };

  caseObj.followupHistory.unshift(entry);
  caseObj.lastFollowupDate = entry.date;
  if (followupEntry.nextFollowupDate) {
    caseObj.nextFollowupDate = followupEntry.nextFollowupDate;
  }
  if (followupEntry.newStatus) {
    caseObj.currentStatus = followupEntry.newStatus;
  }
}

/**
 * Rule 2: Synchronize applicant to Central Customer Directory
 */
async function syncApplicantToCustomerDirectory(caseData) {
  try {
    const customers = getAllCustomers();
    const existing = customers.find(c => 
      (caseData.mobileNumber && c.phone === caseData.mobileNumber) ||
      (caseData.customerId && c.id === caseData.customerId)
    );

    if (existing) {
      caseData.customerId = existing.id;
    } else if (caseData.applicantName && caseData.mobileNumber) {
      const newCustomer = {
        name: caseData.applicantName,
        phone: caseData.mobileNumber,
        address: `${caseData.address || ''}, ${caseData.blockMunicipality || ''}, ${caseData.district || 'Murshidabad'}`.trim(),
        category: 'Citizen / Scheme Beneficiary',
        notes: `Registered via Govt Scheme: ${caseData.schemeName || 'Citizen Service'}`
      };
      const saved = await saveCustomer(newCustomer);
      if (saved) {
        caseData.customerId = saved.id;
      }
    }
  } catch (err) {
    console.warn('Customer sync note:', err);
  }
}

/**
 * Helper to calculate 90-day target date for follow-up
 */
export function calculateNext90Days(fromDateStr) {
  try {
    const d = fromDateStr ? new Date(fromDateStr) : new Date();
    d.setDate(d.getDate() + 90);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return getTodayDate();
  }
}

/**
 * Calculate days remaining or overdue from a target date
 */
export function getDaysRemaining(targetDateStr) {
  if (!targetDateStr) return null;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - today;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}
