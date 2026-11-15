/**
 * marketing.js - Marketing Campaign Management & ROI Analytics
 * MUN COMPUTER BUSINESS MANAGER
 */

import { getItem, setItem, KEYS, allocateGlobalReference, markGlobalReferenceDeleted, getTodayDate, logAuditAction } from './storage.js';

export const CAMPAIGN_TYPES = [
  'Facebook',
  'WhatsApp',
  'Local Advertisement',
  'Banner',
  'Poster',
  'Village Marketing',
  'Referral',
  'Customer Awareness'
];

export function getAllCampaigns() {
  return getItem(KEYS.MARKETING, []);
}

export async function saveCampaign(data) {
  const campaigns = getAllCampaigns();
  const budget = Number(data.budget) || 0;
  const spent = Number(data.spent !== undefined ? data.spent : data.expenses) || 0;
  const leads = Number(data.leads) || 0;
  const converted = Number(data.converted !== undefined ? data.converted : data.convertedCustomers) || 0;

  // Conversion rate percentage
  const convRate = leads > 0 ? Math.round((converted / leads) * 100) : 0;
  // Estimated direct revenue from conversion (average ₹200 per client)
  const estRev = converted * 200;
  const roi = spent > 0 ? Math.round(((estRev - spent) / spent) * 100) : 0;

  if (data.id) {
    const index = campaigns.findIndex(c => c.id === data.id);
    if (index !== -1) {
      campaigns[index] = {
        ...campaigns[index],
        ...data,
        budget,
        spent,
        expenses: spent,
        leads,
        converted,
        convertedCustomers: converted,
        convRate,
        roi,
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.MARKETING, campaigns);
      logAuditAction('MARKETING_UPDATE', `Updated marketing campaign: ${campaigns[index].name}`);
      return { success: true, campaign: campaigns[index] };
    }
  }

  const campaignId = await allocateGlobalReference('MKT', { entityType: 'MARKETING' });
  const newCampaign = {
    id: campaignId,
    name: data.name || 'MUN COMPUTER Promotion',
    type: data.type || 'WhatsApp',
    startDate: data.startDate || getTodayDate(),
    endDate: data.endDate || getTodayDate(),
    budget,
    spent,
    expenses: spent,
    targetCustomers: Number(data.targetCustomers) || 500,
    leads,
    converted,
    convertedCustomers: converted,
    convRate,
    roi,
    results: data.results || `${converted} walk-in conversions recorded at MUN COMPUTER.`,
    notes: data.notes || '',
    createdAt: new Date().toISOString()
  };

  campaigns.unshift(newCampaign);
  setItem(KEYS.MARKETING, campaigns);
  logAuditAction('MARKETING_CREATE', `Launched marketing campaign: ${newCampaign.name} (${newCampaign.type})`);
  return { success: true, campaign: newCampaign };
}

export function deleteCampaign(id) {
  const campaigns = getAllCampaigns();
  const updated = campaigns.filter(c => c.id !== id);
  setItem(KEYS.MARKETING, updated);
  markGlobalReferenceDeleted(id, 'DELETED');
  logAuditAction('MARKETING_DELETE', `Deleted marketing campaign: ${id}`);
  return { success: true };
}
