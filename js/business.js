/**
 * business.js - Business Profile & Multi-Unit Organization Service
 * Official Business: MUN COMPUTER
 */

import { getItem, setItem, KEYS, logAuditAction } from './storage.js';

export function getBusinessProfile() {
  const profile = getItem(KEYS.BUSINESS_PROFILE);
  if (!profile || profile.name !== 'MUN COMPUTER' || !profile.brandDescriptor) {
    // Enforce official corporate profile
    const updated = {
      ...(profile || {}),
      name: 'MUN COMPUTER',
      tagline: 'Your Trusted Partner in Digital Transformation',
      brandDescriptor: 'DIGITAL SERVICES | BANKING SOLUTIONS | TECHNOLOGY EXCELLENCE',
      subDescriptor: 'A Unified Digital Service, Financial Facilitation & IT Solutions Enterprise.',
      slogan: 'Empowering Digital Access. Connecting People. Simplifying Services.',
      ownership: 'Sole Proprietorship',
      operatingModel: 'Single Business Unit',
      administrator: 'Mamun Reja',
      administratorTitle: 'Proprietor & Chief Administrator',
      founderName: 'Mamun Reja',
      ownerName: 'Mamun Reja',
      headOffice: 'Domkal, Murshidabad',
      category: 'Digital Services & Technology Solutions Enterprise',
      businessType: 'Sole Proprietorship – Integrated Digital Services, Banking Facilitation, E-Governance and Information Technology Solutions.',
      registrationStructure: 'Single Proprietorship Establishment – Single Consolidated Operating Unit.',
      brandPositioning: 'A Customer-Centric, Technology-Driven and Service-Oriented Digital Enterprise.',
      phone: '+91 8101352105',
      whatsapp: (profile && profile.whatsapp) ? profile.whatsapp : '+91 8101352105',
      email: 'muncomputer2019@gmail.com',
      address: 'MUN COMPUTER, Mamudpur (Chowmatha More), Ward No. 16, Domkal Municipality, P.O. – Juginda, P.S. – Domkal, District – Murshidabad, West Bengal – 742406, India.',
      shortAddress: 'Mamudpur (Chowmatha More), Ward 16, Domkal, Murshidabad, WB - 742406',
      area: 'Mamudpur (Chowmatha More)',
      ward: 'Ward No. 16, Domkal Municipality',
      village: 'Mamudpur',
      postOffice: 'Juginda',
      policeStation: 'Domkal',
      district: 'Murshidabad',
      state: 'West Bengal',
      pinCode: '742406',
      country: 'India',
      tradeLicense: (profile && profile.tradeLicense && profile.tradeLicense !== '0917P91426550008') ? profile.tradeLicense : '',
      gstin: (profile && profile.gstin && profile.gstin !== '19ABCDE1234F1Z5') ? profile.gstin : '',
      pan: (profile && profile.pan && profile.pan !== 'ABCDE1234F') ? profile.pan : '',
      bankAccount: (profile && profile.bankAccount && !String(profile.bankAccount).includes('0451002100089761')) ? profile.bankAccount : '',
      openingHours: '08:00 AM – 09:30 PM',
      operatingSchedule: 'Seven Days a Week – Subject to Applicable Holidays and Operational Availability.',
      overview: 'MUN COMPUTER is an integrated digital services and technology solutions enterprise headquartered in Mamudpur, Domkal, Murshidabad, West Bengal, India. The organization operates through a centralized business management structure, delivering a comprehensive portfolio of digital facilitation, banking correspondent services, e-Governance assistance, smart card printing, computer solutions and professional documentation services. Its operational framework integrates customer relationship management, financial administration, transaction monitoring, inventory management and service delivery under a unified business identity. MUN COMPUTER is committed to operational transparency, service accessibility, customer confidentiality, technological efficiency and sustainable business development.',
      description: 'MUN COMPUTER is an integrated digital services and technology solutions enterprise headquartered in Mamudpur, Domkal, Murshidabad, delivering digital facilitation, banking correspondent services, e-Governance assistance, PVC smart card printing, computer solutions and professional documentation.',
      status: 'ACTIVE BUSINESS',
      divisionsCount: 8
    };
    setItem(KEYS.BUSINESS_PROFILE, updated);
    return updated;
  }
  return profile;
}

export function updateBusinessProfile(profileData) {
  const current = getBusinessProfile() || {};
  // Always guarantee MUN COMPUTER is the shop name
  const updated = {
    ...current,
    ...profileData,
    name: 'MUN COMPUTER',
    updatedAt: new Date().toISOString()
  };
  setItem(KEYS.BUSINESS_PROFILE, updated);
  logAuditAction('BUSINESS_PROFILE_UPDATE', `Updated business profile for MUN COMPUTER`);
  return updated;
}

export function getBusinessUnits() {
  const units = getItem(KEYS.BUSINESS_UNITS, []);
  if (!units || units.length !== 1 || units[0].id !== 'mun-computer') {
    const single = [{
      id: 'mun-computer',
      name: 'MUN COMPUTER – Corporate Central Operations',
      shortCode: 'MUN',
      icon: 'cpu',
      model: 'CENTRALIZED SINGLE-UNIT BUSINESS STRUCTURE',
      classification: 'Single Ownership | Single Establishment | Integrated Operations',
      desc: 'Centralized single-unit operations delivering 8 core service divisions under direct executive administration.'
    }];
    setItem(KEYS.BUSINESS_UNITS, single);
    return single;
  }
  return units;
}

export function getActiveUnitId() {
  return 'mun-computer';
}

export function setActiveUnitId(unitId) {
  setItem(KEYS.CURRENT_UNIT_ID, 'mun-computer');
  return 'mun-computer';
}

export function getActiveUnit() {
  return { id: 'mun-computer', name: 'MUN COMPUTER', shortCode: 'MUN', icon: 'cpu', desc: 'Official Business Unit' };
}

export function addBusinessUnit(unitData) {
  // Single business unit architecture: MUN COMPUTER is the sole enterprise unit
  logAuditAction('BUSINESS_UNIT_INFO', `Verified single official business unit: MUN COMPUTER`);
  return getActiveUnit();
}

export function updateBusinessUnit(id, unitData) {
  const profile = getBusinessProfile();
  return { id: 'mun-computer', name: 'MUN COMPUTER', shortCode: 'MUN', icon: 'cpu', desc: profile.description || 'Official Business Unit' };
}
