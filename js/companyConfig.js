/**
 * companyConfig.js - Centralized Company Profile Configuration for MUN COMPUTER
 * Single source of truth for Print, PDF, Excel (.xlsx), and CSV headers across all modules.
 */

import { KEYS, getItem } from './storage.js';

export const OFFICIAL_COMPANY_LOGO_PATH = '/assets/aistudio/MUN_Computer_Tech_Logo_35ee99e8.png';

export const DEFAULT_COMPANY_CONFIG = Object.freeze({
  companyName: 'MUN COMPUTER',
  tagline: 'Smart Business Manager · Digital Facilitation & IT Solutions Enterprise',
  address: 'Village – Mamudpur, P.O. – Juginda, P.S. – Domkal, District – Murshidabad, West Bengal – 742406, India.',
  addressLine1: 'Village – Mamudpur (Chomatha More), P.O. – Juginda, P.S. – Domkal',
  addressLine2: 'District – Murshidabad, West Bengal – 742406, India.',
  phone: '+91 8101352105',
  whatsapp: '+91 8101352105',
  email: 'muncomputer2019@gmail.com',
  logoPath: OFFICIAL_COMPANY_LOGO_PATH,
  authorizedSignatory: 'Authorized Signatory (MUN COMPUTER)',
  footerNotice: 'Computer Generated Official Document · MUN COMPUTER'
});

function formatIndianPhone(raw) {
  const cleaned = String(raw || '').trim();
  if (!cleaned) return DEFAULT_COMPANY_CONFIG.phone;
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2)}`;
  return cleaned;
}

/**
 * Returns the live centralized company configuration.
 * Automatically reflects any updates saved in Business Profile without code changes.
 */
export function getCompanyProfileConfig() {
  const saved = getItem(KEYS.BUSINESS_PROFILE, null) || {};
  const rawEmail = String(saved.email || '').trim();
  const safeEmail = (!rawEmail || rawEmail === 'muncomputer786@gmail.com')
    ? DEFAULT_COMPANY_CONFIG.email
    : rawEmail;

  const phone = formatIndianPhone(saved.phone || DEFAULT_COMPANY_CONFIG.phone);
  const whatsapp = formatIndianPhone(saved.whatsapp || saved.phone || DEFAULT_COMPANY_CONFIG.whatsapp);

  const area = String(saved.area || '').trim();
  const village = String(saved.village || 'Mamudpur').trim();
  const po = String(saved.postOffice || 'Juginda').trim();
  const ps = String(saved.policeStation || 'Domkal').trim();
  const dist = String(saved.district || 'Murshidabad').trim();
  const state = String(saved.state || 'West Bengal').trim();
  const pin = String(saved.pinCode || '742406').trim();
  const country = String(saved.country || 'India').trim();

  const addressLine1 = area
    ? `Village – ${area.includes(village) ? area : `${village} (${area})`}, P.O. – ${po}, P.S. – ${ps}`
    : `Village – ${village}, P.O. – ${po}, P.S. – ${ps}`;
  const addressLine2 = `District – ${dist}, ${state} – ${pin}, ${country}.`;

  const resolvedAddress = (saved.village || saved.postOffice || saved.district)
    ? `${addressLine1}, ${addressLine2}`
    : (String(saved.address || '').trim() || DEFAULT_COMPANY_CONFIG.address);

  return {
    companyName: String(saved.name || DEFAULT_COMPANY_CONFIG.companyName).trim() || DEFAULT_COMPANY_CONFIG.companyName,
    tagline: String(saved.tagline || DEFAULT_COMPANY_CONFIG.tagline).trim() || DEFAULT_COMPANY_CONFIG.tagline,
    address: resolvedAddress,
    addressLine1,
    addressLine2,
    phone,
    whatsapp,
    email: safeEmail,
    tradeLicense: String(saved.tradeLicense || '').trim(),
    gstin: String(saved.gstin || '').trim(),
    pan: String(saved.pan || '').trim(),
    logoPath: OFFICIAL_COMPANY_LOGO_PATH,
    authorizedSignatory: `Authorized Signature (${String(saved.name || DEFAULT_COMPANY_CONFIG.companyName).trim() || 'MUN COMPUTER'})`,
    footerNotice: DEFAULT_COMPANY_CONFIG.footerNotice
  };
}
