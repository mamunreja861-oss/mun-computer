/**
 * customers.js - Customer Management Module
 * MUN COMPUTER Business Manager
 */

import { getItem, setItem, KEYS, allocateGlobalReference, markGlobalReferenceDeleted, getTodayDate, logAuditAction } from './storage.js';
import { resolveWardForApp } from './wardVillageMaster.js';

export const DEFAULT_CUSTOMER_LOCATION = {
  village: 'Mamudpur',
  postOffice: 'Juginda',
  policeStation: 'Domkal',
  district: 'Murshidabad',
  state: 'West Bengal',
  pinCode: '742406',
  country: 'India'
};

export function getAllCustomers() {
  return getItem(KEYS.CUSTOMERS, []);
}

export function getCustomerById(id) {
  const customers = getAllCustomers();
  return customers.find(c => c.id === id) || null;
}

/**
 * Universal Customer Directory Search Engine
 * Searches across Name, Village, Post Office, Police Station, District, State,
 * PIN Code, Mobile Number (normalized +91 / dashes / spaces), Customer ID,
 * Aadhaar reference, Job Card number, and linked Service IDs.
 */
export function searchCustomers(query, customList = null) {
  const customers = customList || getAllCustomers();
  if (!query || !query.trim()) return customers;

  const rawQ = query.trim().toLowerCase();
  const cleanDigits = rawQ.replace(/[^0-9]/g, '');
  const digits10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;

  const allServices = getItem(KEYS.SERVICES, []);

  return customers.filter(c => {
    // 1. Name & Guardian
    if (c.name && c.name.toLowerCase().includes(rawQ)) return true;
    if (c.fatherName && c.fatherName.toLowerCase().includes(rawQ)) return true;

    // 2. Customer ID & Application ID & Scheme
    if (c.id && c.id.toLowerCase().includes(rawQ)) return true;
    if (c.applicationId && c.applicationId.toLowerCase().includes(rawQ)) return true;
    if (c.schemeName && c.schemeName.toLowerCase().includes(rawQ)) return true;
    if (c.currentStatus && c.currentStatus.toLowerCase().includes(rawQ)) return true;

    // 3. Location fields (Mamudpur, Juginda, Domkal, Murshidabad, West Bengal, 742406)
    if (c.village && c.village.toLowerCase().includes(rawQ)) return true;
    if (c.villageOrWard && c.villageOrWard.toLowerCase().includes(rawQ)) return true;
    if (c.postOffice && c.postOffice.toLowerCase().includes(rawQ)) return true;
    if (c.policeStation && c.policeStation.toLowerCase().includes(rawQ)) return true;
    if (c.district && c.district.toLowerCase().includes(rawQ)) return true;
    if (c.state && c.state.toLowerCase().includes(rawQ)) return true;
    if (c.pinCode && c.pinCode.includes(rawQ)) return true;
    if (c.address && c.address.toLowerCase().includes(rawQ)) return true;

    // 4. Mobile number search (+91, spaces, hyphens normalized)
    if (cleanDigits.length >= 3) {
      const p1Clean = (c.phone || '').replace(/[^0-9]/g, '');
      const p2Clean = (c.altPhone || '').replace(/[^0-9]/g, '');

      if (p1Clean.includes(digits10) || p1Clean.includes(cleanDigits)) return true;
      if (p2Clean.includes(digits10) || p2Clean.includes(cleanDigits)) return true;
    }
    if (c.phone && c.phone.toLowerCase().includes(rawQ)) return true;
    if (c.altPhone && c.altPhone.toLowerCase().includes(rawQ)) return true;

    // 5. Aadhaar Reference (masked or last 4 digits only)
    if (c.aadhaarLast4 && c.aadhaarLast4.includes(rawQ)) return true;
    if (c.aadhaar && c.aadhaar.slice(-4).includes(rawQ)) return true;

    // 6. Job Card Number
    if (c.jobCardNo && c.jobCardNo.toLowerCase().includes(rawQ)) return true;

    // 7. Linked Service IDs / Ref Numbers / Profile Services
    if (Array.isArray(c.services) && c.services.some(s => String(s).toLowerCase().includes(rawQ))) return true;
    const custServices = allServices.filter(s => s.customerId === c.id);
    const matchesService = custServices.some(s => 
      (s.id && s.id.toLowerCase().includes(rawQ)) ||
      (s.refNumber && s.refNumber.toLowerCase().includes(rawQ)) ||
      (s.serviceName && s.serviceName.toLowerCase().includes(rawQ))
    );
    if (matchesService) return true;

    return false;
  });
}

export function checkDuplicatePhone(phone, excludeCustomerId = null) {
  if (!phone) return null;
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone) return null;

  const customers = getAllCustomers();
  return customers.find(c => {
    if (excludeCustomerId && c.id === excludeCustomerId) return false;
    const p1 = (c.phone || '').replace(/[^0-9]/g, '');
    const p2 = (c.altPhone || '').replace(/[^0-9]/g, '');
    return p1 === cleanPhone || p2 === cleanPhone;
  });
}

export async function saveCustomer(customerData) {
  const customers = getAllCustomers();
  const resolvedWard = resolveWardForApp(customerData);
  const wardMeta = {
    areaType: customerData.areaType || (resolvedWard ? 'URBAN' : ''),
    subdivision: customerData.subdivision || '',
    blockOrMunicipality: customerData.blockOrMunicipality || (resolvedWard ? (resolvedWard.municipalityName || 'Domkal Municipality') : ''),
    gpOrWard: customerData.gpOrWard || customerData.wardNumber || resolvedWard?.wardNumber || '',
    wardId: customerData.wardId || resolvedWard?.wardId || '',
    wardNo: customerData.wardNo || resolvedWard?.wardNo || '',
    wardNumber: customerData.wardNumber || resolvedWard?.wardNumber || customerData.gpOrWard || ''
  };
  
  if (customerData.id && customers.some(c => c.id === customerData.id)) {
    // Update existing
    const index = customers.findIndex(c => c.id === customerData.id);
    if (index !== -1) {
      const existing = customers[index];
      const mergedServices = Array.isArray(customerData.services) ? customerData.services : (existing.services || []);
      const resolvedVillageOrWard =
        customerData.villageOrWard ||
        wardMeta.gpOrWard ||
        existing.villageOrWard ||
        customerData.village ||
        existing.village ||
        '';
      const resolvedAppId = customerData.applicationId || existing.applicationId || await allocateGlobalReference('CASE', { entityType: 'CASE' });
      customers[index] = {
        ...existing,
        ...customerData,
        areaType: wardMeta.areaType || existing.areaType || '',
        subdivision: wardMeta.subdivision || existing.subdivision || '',
        blockOrMunicipality: wardMeta.blockOrMunicipality || existing.blockOrMunicipality || '',
        gpOrWard: wardMeta.gpOrWard || existing.gpOrWard || '',
        wardId: wardMeta.wardId || existing.wardId || '',
        wardNo: wardMeta.wardNo || existing.wardNo || '',
        wardNumber: wardMeta.wardNumber || existing.wardNumber || '',
        applicationId: resolvedAppId,
        schemeName: customerData.schemeName || existing.schemeName || mergedServices[0] || 'General Digital Service',
        villageOrWard: resolvedVillageOrWard,
        currentStatus: customerData.currentStatus || existing.currentStatus || 'Submitted',
        assignedStaff: customerData.assignedStaff || customerData.assignedStaffUid || existing.assignedStaff || existing.assignedStaffUid || 'MC-ADM-14012025',
        assignedStaffUid: customerData.assignedStaffUid || customerData.assignedStaff || existing.assignedStaffUid || existing.assignedStaff || 'MC-ADM-14012025',
        services: mergedServices,
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.CUSTOMERS, customers);
      logAuditAction('CUSTOMER_UPDATE', `Updated profile of customer: ${customers[index].name} (${customers[index].id})`);
      return { success: true, customer: customers[index], isNew: false };
    }
  }

  // Create new customer with unique Application ID and default profile metadata
  const currentUser = getItem(KEYS.CURRENT_USER, null);
  const defaultStaffUid = customerData.assignedStaffUid || customerData.assignedStaff || currentUser?.uid || 'MC-ADM-14012025';
  const initialServices = Array.isArray(customerData.services) ? customerData.services : [];
  const custId = customerData.id || await allocateGlobalReference('CUST', { entityType: 'CUSTOMER' });
  const appId = customerData.applicationId || await allocateGlobalReference('CASE', { entityType: 'CASE' });
  const newCustomer = {
    id: custId,
    applicationId: appId,
    schemeName: customerData.schemeName || initialServices[0] || 'General Digital Service',
    villageOrWard: customerData.villageOrWard || wardMeta.gpOrWard || customerData.village || '',
    currentStatus: customerData.currentStatus || 'Submitted',
    name: customerData.name || '',
    fatherName: customerData.fatherName || '',
    phone: customerData.phone || '',
    altPhone: customerData.altPhone || '',
    email: customerData.email || '',
    address: customerData.address || '',
    areaType: wardMeta.areaType,
    subdivision: wardMeta.subdivision,
    blockOrMunicipality: wardMeta.blockOrMunicipality,
    gpOrWard: wardMeta.gpOrWard,
    wardId: wardMeta.wardId,
    wardNo: wardMeta.wardNo,
    wardNumber: wardMeta.wardNumber,
    village: customerData.village || '',
    postOffice: customerData.postOffice || '',
    policeStation: customerData.policeStation || '',
    district: customerData.district || '',
    state: customerData.state || '',
    pinCode: customerData.pinCode || '',
    country: DEFAULT_CUSTOMER_LOCATION.country,
    aadhaarLast4: customerData.aadhaarLast4 ? customerData.aadhaarLast4.slice(-4) : '',
    jobCardNo: customerData.jobCardNo || '',
    regDate: customerData.regDate || getTodayDate(),
    category: customerData.category || 'General Public',
    services: initialServices,
    remarks: customerData.remarks || '',
    assignedStaff: defaultStaffUid,
    assignedStaffUid: defaultStaffUid,
    businessUnitId: customerData.businessUnitId || 'mun-computer',
    createdAt: new Date().toISOString()
  };

  customers.unshift(newCustomer);
  setItem(KEYS.CUSTOMERS, customers);
  logAuditAction('CUSTOMER_CREATE', `Registered new customer: ${newCustomer.name} (${newCustomer.id} · App: ${newCustomer.applicationId})`);
  return { success: true, customer: newCustomer, isNew: true };
}

export function deleteCustomer(id) {
  const customers = getAllCustomers();
  const target = customers.find(c => c.id === id);
  if (!target) return { success: false, message: 'Customer not found' };

  const updated = customers.filter(c => c.id !== id);
  setItem(KEYS.CUSTOMERS, updated);
  markGlobalReferenceDeleted(id, 'DELETED');
  logAuditAction('CUSTOMER_DELETE', `Deleted customer: ${target.name} (${target.id})`);
  return { success: true };
}

export function getCustomerFullHistory(customerId) {
  const customer = getCustomerById(customerId);
  if (!customer) return null;

  const services = getItem(KEYS.SERVICES, []).filter(s => s.customerId === customerId);
  const payments = getItem(KEYS.PAYMENTS, []).filter(p => p.customerId === customerId);
  const followups = getItem(KEYS.FOLLOWUPS, []).filter(f => f.customerId === customerId);
  const followupCases = getItem(KEYS.FOLLOWUP_CASES, []).filter(c => c.customerId === customerId);
  const statusHistory = getItem(KEYS.STATUS_HISTORY, []).filter(
    h => h.customerId === customerId || followupCases.some(fc => fc.id === h.caseId || fc.applicationId === h.applicationId)
  );
  const followupLedger = getItem(KEYS.FOLLOWUP_LEDGER, []).filter(
    fl => fl.customerId === customerId || followupCases.some(fc => fc.id === fl.caseId || fc.applicationId === fl.applicationId)
  );
  const reminders = getItem(KEYS.REMINDERS, []).filter(
    r => r.customerId === customerId || followupCases.some(fc => fc.id === r.caseId || fc.applicationId === r.applicationId)
  );
  const invoices = getItem(KEYS.INVOICES, []).filter(i => i.customerId === customerId);
  const annapurnaApps = getItem(KEYS.ANNAPURNA_APPLICATIONS, []).filter(a => a.customerId === customerId || (customer.phone && a.customerPhone === customer.phone));
  const govtCases = getItem(KEYS.GOVT_CASES, []).filter(g => g.customerId === customerId || (customer.phone && g.phone === customer.phone));
  const documents = getItem(KEYS.DOCUMENTS, []).filter(d =>
    d.customerId === customerId ||
    (customer.applicationId && d.applicationId === customer.applicationId) ||
    followupCases.some(fc => fc.applicationId === d.applicationId || fc.applicationId === d.linkedApplicationId || fc.id === d.caseId)
  );

  // Consolidate grievances across 90-day grievance ledger, 90-day cases, Annapurna apps, and Govt cases
  const grievanceMap = new Map();
  const pushGrievance = (g) => {
    const key = g.id || `${g.applicationId}_${g.referenceNumber}_${g.date}`;
    if (!grievanceMap.has(key)) grievanceMap.set(key, g);
  };
  getItem(KEYS.GRIEVANCES, [])
    .filter(g => g.customerId === customerId || followupCases.some(fc => fc.id === g.caseId || fc.applicationId === g.applicationId))
    .forEach(g => pushGrievance({ ...g, source: '90-Day Case' }));

  followupCases.forEach(fc => {
    (fc.grievances || []).forEach(g => pushGrievance({ ...g, source: '90-Day Case', applicationId: fc.applicationId, caseId: fc.id }));
  });
  annapurnaApps.forEach(a => {
    (a.complaints || []).forEach(cmp => pushGrievance({
      id: cmp.id,
      portal: cmp.complaintType,
      type: cmp.complaintType,
      referenceNumber: cmp.referenceNumber,
      submittedTo: cmp.submittedTo,
      date: cmp.submissionDate,
      status: cmp.status,
      remarks: cmp.description,
      description: cmp.description,
      reply: cmp.replyDetails || cmp.actionTaken,
      applicationId: a.applicationId,
      source: 'Annapurna Yojana'
    }));
  });
  govtCases.forEach(g => {
    if (g.grievanceChannel || g.grievanceRefNo) {
      pushGrievance({
        id: g.id,
        portal: g.grievanceChannel || 'Other',
        type: g.grievanceChannel || g.schemeName || 'Public Grievance',
        referenceNumber: g.grievanceRefNo || g.applicationId || g.id,
        submittedTo: g.department || 'Govt Department',
        date: g.submissionDate || g.createdAt?.slice(0, 10),
        status: g.status || 'Submitted',
        remarks: g.problemDescription || g.remarks || '',
        description: g.problemDescription || g.remarks || '',
        reply: g.remarks || '',
        applicationId: g.applicationId || g.id,
        source: 'Govt Schemes'
      });
    }
  });
  const grievances = Array.from(grievanceMap.values()).sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));

  const verifiedPayments = payments.filter(
    p => p.verificationStatus !== 'PENDING_VERIFICATION' && p.paymentStatus !== 'Refunded'
  );
  const totalSpent = verifiedPayments.reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0);
  const totalDue = services
    .filter(s => s.status !== 'Cancelled' && s.status !== 'Rejected')
    .reduce((sum, s) => sum + Math.max(0, (Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0)), 0);

  return {
    customer,
    services,
    payments,
    followups,
    followupCases,
    statusHistory,
    followupLedger,
    reminders,
    annapurnaApps,
    govtCases,
    grievances,
    documents,
    invoices,
    stats: {
      servicesCount: services.length,
      applicationsCount: followupCases.length,
      totalSpent,
      totalDue,
      activeServices: services.filter(s => s.status !== 'Completed' && s.status !== 'Delivered' && s.status !== 'Cancelled').length
    }
  };
}
