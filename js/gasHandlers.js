/**
 * gasHandlers.js - UI Modal, Form, Export & Action Handlers for LPG & Gas Services
 * MUN COMPUTER Business Manager
 */

import {
  formatINR,
  formatDate,
  getTodayDate
} from './storage.js';
import { getAllInventory, getInventoryCategories, saveInventoryItem } from './inventory.js';
import {
  renderSearchableServiceSelectorHtml,
  initSearchableServiceSelector,
  getSelectedServicesState
} from './serviceSelector.js';
import {
  GAS_SERVICE_TYPES,
  GAS_COLLECTION_CATEGORIES,
  GAS_PAYMENT_MODES,
  GAS_SUBSIDY_STATUSES,
  GAS_DELIVERY_PIPELINE_STAGES,
  GAS_EXCEPTION_STATUSES,
  GAS_BOOKING_STATUSES,
  GAS_DELIVERY_PRICING_METHODS,
  NON_TAKER_ACCOUNTING_NOTICE,
  SUBSIDY_SECURITY_NOTICE,
  normalizeGasBookingStatus,
  isBookingCancelledStatus,
  isBookingDeliveredStatus,
  canPerformGasAction,
  getGasSettings,
  saveGasSettings,
  getGasAgencies,
  saveGasAgency,
  deleteGasAgency,
  getGasCylinderTypes,
  saveGasCylinderType,
  deleteGasCylinderType,
  getGasDeliveryAreas,
  saveGasDeliveryArea,
  deleteGasDeliveryArea,
  calculateSuggestedDeliveryCharge,
  getAllGasDeliveryPersons,
  getGasDeliveryPersonById,
  saveGasDeliveryPerson,
  toggleGasDeliveryPersonStatus,
  deleteGasDeliveryPerson,
  getAllGasCustomers,
  getGasCustomerById,
  getGasCustomerFullHistory,
  buildCustomerStructuredAddress,
  normalizeBankSeedStatus,
  computeAutoSubsidyFields,
  saveGasCustomer,
  updateGasCustomerCoordinates,
  deleteGasCustomer,
  getAllGasBookings,
  getGasBookingById,
  saveGasBooking,
  updateGasBookingStatus,
  assignDeliveryPersonToBooking,
  updateBookingLiveTracking,
  saveGasEligibilityRule,
  getAllGasSubsidies,
  saveGasSubsidy,
  getAllNonTakerLedgers,
  getNonTakerLedgerById,
  createNonTakerLedger,
  recordNonTakerRecovery,
  reverseNonTakerRecovery,
  getAllGasCollections,
  recordGasCollection,
  reverseGasCollection,
  getAllGasWarehouses,
  saveGasWarehouse,
  recordGasStockMovement,
  saveAccessoriesSale,
  getAllGasSuppliers,
  saveGasSupplier,
  saveGasPurchase,
  getGasServiceEntryById,
  calculateServiceFinancials,
  saveGasServiceEntry,
  reverseGasServiceEntry,
  buildGasReportDataset
} from './gasServiceEngine.js';
import {
  MAIN_CENTRE_DEFAULT,
  geocodeGasAddress,
  reverseGeocodeGasCoords,
  computeRoadRoute,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsPlaceUrl,
  requestBrowserCurrentLocation,
  renderGasInteractiveMap
} from './gasMapsService.js';
import {
  renderLocationCascadeHtml,
  initLocationCascade,
  getLocationCascadeValues
} from './locationCascade.js';
import {
  buildGasCollectionReceiptHtml,
  buildGasServiceReceiptHtml,
  buildGasBookingReceiptHtml
} from './gasViews.js';
import { showA4PrintPdfPopup } from './a4PrintPopup.js';
import {
  printUniversalReport,
  exportUniversalPDF,
  exportUniversalExcel,
  exportUniversalCSV
} from './exportUtility.js';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createGasHandlers({ AppState, showToast, openModal, closeModal, showConfirmDialog, render, scheduleSearchRender }) {
  const _purchaseLines = [];
  let _customerMapController = null;

  function setGasFilter(key, val) {
    AppState[key] = val;
    render();
  }

  function setGasSearch(key, val, inputId) {
    AppState[key] = val;
    if (typeof scheduleSearchRender === 'function') {
      scheduleSearchRender(inputId);
    } else {
      render();
    }
  }

  function resetGasDashDates() {
    AppState.gasDashDateFrom = '';
    AppState.gasDashDateTo = '';
    render();
  }

  function resetGasReportFilters() {
    AppState.gasReportDateFrom = '';
    AppState.gasReportDateTo = '';
    AppState.gasReportSearch = '';
    render();
  }

  function resetGasBookingFilters() {
    AppState.gasBookSearch = '';
    AppState.gasBookStatusFilter = 'all';
    AppState.gasBookAgencyFilter = 'all';
    AppState.gasBookDateFrom = '';
    AppState.gasBookDateTo = '';
    AppState.gasBookDeliveryDateFilter = '';
    AppState.gasBookPayStatusFilter = 'all';
    AppState.gasBookDeliveryPersonFilter = 'all';
    AppState.gasBookAreaFilter = '';
    render();
  }

  function navigateGasBookingsByStatus(status = 'all') {
    AppState.gasBookStatusFilter = status || 'all';
    if (typeof window !== 'undefined' && window.MJK?.navigateTo) {
      window.MJK.navigateTo('gas-bookings');
    } else {
      AppState.currentView = 'gas-bookings';
      render();
    }
  }

  function openGasSettingsTab(tab = 'general') {
    AppState.gasSettingsTab = tab || 'general';
    if (typeof window !== 'undefined' && window.MJK?.navigateTo) {
      window.MJK.navigateTo('gas-settings');
    } else {
      AppState.currentView = 'gas-settings';
      render();
    }
  }

  async function ensureMainCentreCoords() {
    const settings = getGasSettings();
    const mc = settings.mainCentre || { ...MAIN_CENTRE_DEFAULT };
    if (Number.isFinite(Number(mc.lat)) && Number.isFinite(Number(mc.lng))) {
      return {
        name: mc.name || MAIN_CENTRE_DEFAULT.name,
        fullAddress: mc.fullAddress || MAIN_CENTRE_DEFAULT.fullAddress,
        lat: Number(mc.lat),
        lng: Number(mc.lng)
      };
    }
    const query = mc.fullAddress || MAIN_CENTRE_DEFAULT.geocodeQuery;
    const geo = await geocodeGasAddress(query);
    if (geo.success && geo.result) {
      saveGasSettings(
        {
          mainCentre: {
            ...mc,
            lat: geo.result.lat,
            lng: geo.result.lng,
            placeId: geo.result.placeId || mc.placeId || ''
          }
        },
        { allowMainCentreGeoSave: true }
      );
      return {
        name: mc.name || MAIN_CENTRE_DEFAULT.name,
        fullAddress: mc.fullAddress || geo.result.formattedAddress,
        lat: geo.result.lat,
        lng: geo.result.lng
      };
    }
    return {
      name: mc.name || MAIN_CENTRE_DEFAULT.name,
      fullAddress: mc.fullAddress || MAIN_CENTRE_DEFAULT.fullAddress,
      lat: null,
      lng: null
    };
  }

  /* =====================================================================
     CUSTOMER REGISTER, INLINE AGENCY & MAP PIN MODAL
     ===================================================================== */

  function renderCustomerAgencyOptions(selectedId = '', selectedName = '') {
    const agencies = getGasAgencies();
    const opts = ['<option value="">-- Select Agency / Distributor --</option>'];
    for (const a of agencies) {
      if (a.isActive === false && a.id !== selectedId && a.name !== selectedName) continue;
      const isSel = (selectedId && a.id === selectedId) || (selectedName && a.name.toUpperCase() === String(selectedName).toUpperCase());
      opts.push(`<option value="${esc(a.id)}" data-name="${esc(a.name)}" data-company="${esc(a.company || '')}" ${isSel ? 'selected' : ''}>${esc(a.name)}${a.company ? ` (${esc(a.company)})` : ''}</option>`);
    }
    return opts.join('');
  }

  function updateCustomerModalMapPreviewLink() {
    const linkEl = document.getElementById('gcust-maps-preview-link');
    if (!linkEl) return;
    const latRaw = document.getElementById('gcust-lat')?.value;
    const lngRaw = document.getElementById('gcust-lng')?.value;
    const addr = document.getElementById('gcust-addr')?.value?.trim() || '';
    const hasCoords = latRaw !== '' && lngRaw !== '' && Number.isFinite(Number(latRaw)) && Number.isFinite(Number(lngRaw));
    linkEl.href = buildGoogleMapsPlaceUrl(
      hasCoords ? { lat: Number(latRaw), lng: Number(lngRaw), address: addr } : { address: addr }
    );
    linkEl.style.opacity = hasCoords || addr ? '1' : '0.6';
  }

  function syncGasCustomerAddressPreview() {
    const addrEl = document.getElementById('gcust-addr');
    if (!addrEl) return;
    const landmarkLine = String(document.getElementById('gcust-landmark-line')?.value || '').trim();
    const loc = getLocationCascadeValues('gcust-loc');
    const combined = [landmarkLine, loc.formattedAddress].filter(Boolean).join(', ');
    addrEl.value = combined;
    updateCustomerModalMapPreviewLink();
  }

  function toggleGasCustomerWhatsappInline() {
    const chk = document.getElementById('gcust-same-wa');
    const row = document.getElementById('gcust-wa-row');
    const waInput = document.getElementById('gcust-wa');
    if (!chk || !row) return;
    row.style.display = chk.checked ? 'none' : 'block';
    if (chk.checked && waInput) {
      waInput.value = document.getElementById('gcust-mobile')?.value || '';
    }
  }

  function syncCustomerModalPinFromInputs() {
    const latRaw = document.getElementById('gcust-lat')?.value;
    const lngRaw = document.getElementById('gcust-lng')?.value;
    if (latRaw !== '' && lngRaw !== '') {
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      if (Number.isFinite(lat) && Number.isFinite(lng) && _customerMapController?.updateCustomerPin) {
        _customerMapController.updateCustomerPin({ lat, lng });
      }
    }
    updateCustomerModalMapPreviewLink();
  }

  function openGasCustomerModal(editId = '') {
    const c = editId ? getGasCustomerById(editId) : null;
    const settings = getGasSettings();
    const cylList = getGasCylinderTypes({ activeOnly: true });
    const hasLatLng = Number.isFinite(Number(c?.lat)) && Number.isFinite(Number(c?.lng));
    const combinedAddr = c?.savedDeliveryAddress || c?.villageAddress || '';
    const primaryMob = String(c?.mobile || '').replace(/[^0-9]/g, '').slice(-10);
    const secondaryWa = String(c?.whatsapp || c?.altMobile || '').replace(/[^0-9]/g, '').slice(-10);
    const isSameWa = !c ? true : (c.sameAsWhatsapp !== undefined ? Boolean(c.sameAsWhatsapp) : (!secondaryWa || secondaryWa === primaryMob));
    const bankSeedNorm = normalizeBankSeedStatus(c?.bankLinkStatus);
    const bankLast4Init = c?.bankAccountLast4 || String(c?.maskedAccount || '').replace(/\D/g, '').slice(-4);
    const landmarkInit = c
      ? [c.houseNo ? `House ${c.houseNo}` : '', c.street, c.paraLocality, c.landmark].filter(Boolean).join(', ')
      : '';
    const initialMapsHref = buildGoogleMapsPlaceUrl(
      hasLatLng ? { lat: Number(c.lat), lng: Number(c.lng), address: combinedAddr } : { address: combinedAddr }
    );

    const html = `
      <form onsubmit="window.MJK.submitGasCustomerForm(event)">
        <input type="hidden" id="gcust-id" value="${esc(c?.id || '')}">
        <input type="hidden" id="gcust-place-id" value="${esc(c?.placeId || '')}">
        <input type="hidden" id="gcust-pin-label" value="${esc(c?.mapPinLabel || '')}">

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:0.7rem;margin-bottom:0.85rem;">
          <div>
            <label class="form-label">Full Name <span class="req">*</span></label>
            <input id="gcust-name" type="text" required class="form-control" value="${esc(c?.fullName || '')}">
          </div>
          <div>
            <label class="form-label">Father / Guardian Name <span class="req">*</span></label>
            <input id="gcust-guardian" type="text" required class="form-control" placeholder="Mandatory Father / Guardian Name" value="${esc(c?.guardianName || '')}">
          </div>
          <div>
            <label class="form-label" style="display:flex;justify-content:space-between;align-items:center;gap:0.35rem;">
              <span>Mobile Number / WhatsApp (10 digits) <span class="req">*</span></span>
            </label>
            <input id="gcust-mobile" type="tel" required maxlength="10" pattern="[0-9]{10}" inputmode="numeric" placeholder="10-digit Mobile / WhatsApp" class="form-control font-mono" value="${esc(primaryMob)}" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,10); if(document.getElementById('gcust-same-wa')?.checked){ const w=document.getElementById('gcust-wa'); if(w) w.value=this.value; }">
            <label style="display:inline-flex;align-items:center;gap:0.35rem;margin-top:0.35rem;font-size:0.74rem;font-weight:600;color:#1e3a8a;cursor:pointer;">
              <input id="gcust-same-wa" type="checkbox" ${isSameWa ? 'checked' : ''} onchange="window.MJK.toggleGasCustomerWhatsappInline()">
              <span>Same as WhatsApp</span>
            </label>
            <div id="gcust-wa-row" style="display:${isSameWa ? 'none' : 'block'};margin-top:0.35rem;">
              <input id="gcust-wa" type="tel" maxlength="10" inputmode="numeric" class="form-control font-mono" placeholder="Secondary WhatsApp (10 digits)" value="${esc(secondaryWa)}" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,10)">
            </div>
          </div>
          <div>
            <label class="form-label">Consumer ID (Optional)</label>
            <input id="gcust-cid" type="text" class="form-control font-mono" placeholder="Optional Consumer No (leave blank if N/A)" value="${esc(c?.consumerId || '')}">
          </div>
          <div>
            <label class="form-label">17-Digit LPG ID (Optional)</label>
            <input id="gcust-lpg17" type="text" maxlength="17" class="form-control font-mono" placeholder="Optional 17 digits" value="${esc(c?.lpgId17 || '')}">
          </div>
          <div>
            <label class="form-label">Gas Company</label>
            <select id="gcust-comp" class="form-control">
              ${(settings.gasCompanies || ['Indane', 'HP Gas', 'Bharatgas']).map(co => `<option value="${esc(co)}" ${(c?.gasCompany || '') === co ? 'selected' : ''}>${esc(co)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label" style="display:flex;justify-content:space-between;align-items:center;">
              <span>Agency / Distributor</span>
              <button type="button" style="background:none;border:none;color:#1d4ed8;font-size:0.72rem;font-weight:700;cursor:pointer;padding:0;" onclick="window.MJK.toggleGasCustomerAgencyInline()">+ Quick Add/Edit</button>
            </label>
            <select id="gcust-agency" class="form-control" onchange="const opt=this.options[this.selectedIndex]; if(opt?.dataset?.company){const co=document.getElementById('gcust-comp'); if(co && [...co.options].some(o=>o.value===opt.dataset.company)) co.value=opt.dataset.company;}">
              ${renderCustomerAgencyOptions(c?.agencyId || '', c?.agencyName || '')}
            </select>
          </div>
          <div>
            <label class="form-label">Connection Category</label>
            <select id="gcust-cat" class="form-control">
              ${(settings.connectionCategories || ['Domestic', 'Commercial', 'Ujjwala', 'PMUY']).map(cat => `<option value="${esc(cat)}" ${(c?.connectionCategory || 'Domestic') === cat ? 'selected' : ''}>${esc(cat)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Cylinder Type</label>
            <select id="gcust-cyl" class="form-control">
              ${cylList.map(cy => `<option value="${esc(cy.name)}" ${(c?.cylinderType || '14.2 Kg') === cy.name ? 'selected' : ''}>${esc(cy.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Single / DBC</label>
            <select id="gcust-dbc" class="form-control">
              ${['Single', 'DBC'].map(d => `<option value="${d}" ${(c?.dbcStatus || 'Single') === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">eKYC Status</label>
            <select id="gcust-ekyc" class="form-control">
              ${['Done', 'Pending', 'Rejected'].map(st => `<option value="${st}" ${(c?.ekycStatus || 'Pending') === st ? 'selected' : ''}>${st}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Subsidy Eligible</label>
            <select id="gcust-sub-elig" class="form-control">
              <option value="Yes" ${(c?.subsidyEligible || 'Yes') === 'Yes' ? 'selected' : ''}>Yes</option>
              <option value="No" ${c?.subsidyEligible === 'No' ? 'selected' : ''}>No</option>
            </select>
          </div>
          <div>
            <label class="form-label">Non-Taker Flag</label>
            <select id="gcust-nontaker" class="form-control">
              <option value="No" ${(c?.nonTakerFlag || 'No') === 'No' ? 'selected' : ''}>No</option>
              <option value="Yes" ${c?.nonTakerFlag === 'Yes' ? 'selected' : ''}>Yes</option>
            </select>
          </div>
          <div><label class="form-label">Custom Eligibility Interval (Days)</label><input id="gcust-interval" type="number" min="1" max="365" placeholder="Default (${settings.defaultEligibilityDays}d)" class="form-control" value="${c?.customIntervalDays ? esc(c.customIntervalDays) : ''}"></div>
          <div>
            <label class="form-label">Status</label>
            <select id="gcust-status" class="form-control">
              ${['Active', 'Inactive', 'Suspended'].map(st => `<option value="${st}" ${(c?.status || 'Active') === st ? 'selected' : ''}>${st}</option>`).join('')}
            </select>
          </div>
        </div>

        <div id="gcust-inline-agency-box" style="display:none;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:0.75rem;margin-bottom:0.85rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
            <strong style="font-size:0.82rem;color:#0b3b8c;">Quick Agency / Distributor Manager</strong>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.toggleGasCustomerAgencyInline(false)">Close</button>
          </div>
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:0.5rem;align-items:end;">
            <div><label class="form-label" style="font-size:0.72rem;">Agency Name *</label><input id="gcust-inag-name" type="text" class="form-control" placeholder="e.g., MAMENPUR INDANE GRAMIN VITRAK"></div>
            <div><label class="form-label" style="font-size:0.72rem;">Company</label><input id="gcust-inag-comp" type="text" class="form-control" placeholder="Indane"></div>
            <div><label class="form-label" style="font-size:0.72rem;">Phone</label><input id="gcust-inag-phone" type="text" class="form-control" placeholder="Optional"></div>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.saveGasCustomerInlineAgency()">Add & Select</button>
          </div>
        </div>

        <div style="background:#f8fafc;border:1px solid var(--border-subtle);border-radius:8px;padding:0.85rem;margin-bottom:0.85rem;">
          <div style="font-size:0.76rem;font-weight:800;color:#0f172a;text-transform:uppercase;margin-bottom:0.55rem;">
            Bank Seed / NPCI Link &amp; Bank Account (Last 4 Digits Only)
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.65rem;">
            <div>
              <label class="form-label">NPCI / Bank Seeded Status</label>
              <select id="gcust-bank" class="form-control">
                ${['Yes - Active', 'Pending', 'Not Linked'].map(st => `<option value="${st}" ${bankSeedNorm === st ? 'selected' : ''}>${st}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label">Bank Name (Optional)</label>
              <input id="gcust-bank-name" type="text" class="form-control" placeholder="e.g., State Bank of India, PNB" value="${esc(c?.bankName || '')}">
            </div>
            <div>
              <label class="form-label">Bank Account Number (Last 4 Digits Only)</label>
              <input id="gcust-mask-ac" type="text" maxlength="4" pattern="[0-9]{4}" inputmode="numeric" placeholder="4 numeric digits (e.g. 1234)" class="form-control font-mono" value="${esc(bankLast4Init)}" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)">
            </div>
          </div>
        </div>

        <div style="margin-bottom:0.85rem;">
          ${renderLocationCascadeHtml('gcust-loc', {
            title: '📍 Structured Home Delivery Address (Smart Location Auto-Fill)',
            required: true
          })}
          <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:0.65rem;background:#f8fafc;border:1px solid var(--border-subtle);border-radius:8px;padding:0.75rem;">
            <div>
              <label class="form-label" style="font-size:0.74rem;">House / Para / Landmark (Optional)</label>
              <input id="gcust-landmark-line" type="text" class="form-control" placeholder="e.g., Near Chomatha More / Para name" value="${esc(landmarkInit)}" oninput="window.MJK.syncGasCustomerAddressPreview()">
            </div>
            <div>
              <label class="form-label" style="font-size:0.74rem;">Full Address (Compiled Read-Only)</label>
              <input id="gcust-addr" type="text" class="form-control" readonly style="background:var(--surface-alt);font-weight:600;color:var(--text-main);" placeholder="Auto-compiled from Village, P.O., P.S., District, State & PIN" value="${esc(combinedAddr)}">
            </div>
          </div>
        </div>

        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:0.85rem;margin-bottom:0.85rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.55rem;flex-wrap:wrap;gap:0.45rem;">
            <div>
              <strong style="font-size:0.84rem;color:#0b3b8c;">Google Maps Delivery Pin</strong>
              <div style="font-size:0.73rem;color:#1e3a8a;">Locate address, capture device GPS, or click/drag marker (auto-switches to OpenStreetMap if quota is limited)</div>
            </div>
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">
              <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.geocodeGasCustomerModalAddress()">Locate Address</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.captureCustomerModalGps()">Capture Current Device GPS</button>
              <a id="gcust-maps-preview-link" href="${esc(initialMapsHref)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="text-decoration:none;">Open in Google Maps ↗</a>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.clearCustomerModalCoords()">Clear Pin</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.55rem;margin-bottom:0.6rem;">
            <div><label class="form-label" style="font-size:0.72rem;">Latitude</label><input id="gcust-lat" type="number" step="0.000001" class="form-control font-mono" value="${hasLatLng ? Number(c.lat) : ''}" placeholder="Not pinned" oninput="window.MJK.syncCustomerModalPinFromInputs()"></div>
            <div><label class="form-label" style="font-size:0.72rem;">Longitude</label><input id="gcust-lng" type="number" step="0.000001" class="form-control font-mono" value="${hasLatLng ? Number(c.lng) : ''}" placeholder="Not pinned" oninput="window.MJK.syncCustomerModalPinFromInputs()"></div>
          </div>
          <div id="gcust-map-canvas" style="width:100%;height:240px;border-radius:8px;overflow:hidden;border:1px solid #bfdbfe;background:#fff;"></div>
        </div>

        <div style="margin-bottom:1rem;">
          <label class="form-label">Remarks</label>
          <input id="gcust-remarks" type="text" class="form-control" value="${esc(c?.remarks || '')}">
        </div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${c ? 'Update Gas Customer' : 'Save Gas Customer'}</button>
        </div>
      </form>
    `;
    openModal(c ? `Edit Gas Customer (${c.id})` : 'Register New Gas Customer', html, null, 'modal-lg');

    setTimeout(async () => {
      await initLocationCascade(
        'gcust-loc',
        {
          areaType: c?.areaType || 'RURAL',
          state: c?.state || 'West Bengal',
          district: c?.district || 'Murshidabad',
          subdivision: c?.subdivision || '',
          blockOrMunicipality: c?.blockOrMunicipality || '',
          gpOrWard: c?.gpOrWard || c?.wardNumber || '',
          village: c?.village || '',
          postOffice: c?.postOffice || '',
          policeStation: c?.policeStation || '',
          pinCode: c?.pinCode || ''
        },
        {
          onChange: () => {
            syncGasCustomerAddressPreview();
          }
        }
      );
      if (combinedAddr && !document.getElementById('gcust-addr')?.value) {
        const addrEl = document.getElementById('gcust-addr');
        if (addrEl) addrEl.value = combinedAddr;
      } else {
        syncGasCustomerAddressPreview();
      }

      const container = document.getElementById('gcust-map-canvas');
      if (!container) return;
      const origin = await ensureMainCentreCoords();
      _customerMapController = await renderGasInteractiveMap(container, {
        origin,
        customer: hasLatLng
          ? { name: c?.fullName || 'Customer Delivery Pin', address: combinedAddr, lat: Number(c.lat), lng: Number(c.lng) }
          : null,
        editableCustomerPin: true,
        heightPx: 240,
        onCustomerPinMoved: ({ lat, lng }) => {
          const latEl = document.getElementById('gcust-lat');
          const lngEl = document.getElementById('gcust-lng');
          const lblEl = document.getElementById('gcust-pin-label');
          if (latEl) latEl.value = lat;
          if (lngEl) lngEl.value = lng;
          if (lblEl) lblEl.value = 'Pinned on Map';
          updateCustomerModalMapPreviewLink();
        }
      });
    }, 45);
  }

  function autoBuildGasCustomerAddress() {
    syncGasCustomerAddressPreview();
  }

  function toggleGasCustomerAgencyInline(forceState) {
    const box = document.getElementById('gcust-inline-agency-box');
    if (!box) return;
    const next = forceState !== undefined ? forceState : box.style.display === 'none';
    box.style.display = next ? 'block' : 'none';
  }

  async function saveGasCustomerInlineAgency() {
    const name = document.getElementById('gcust-inag-name')?.value?.trim();
    const company = document.getElementById('gcust-inag-comp')?.value?.trim();
    const phone = document.getElementById('gcust-inag-phone')?.value?.trim();
    try {
      const res = await saveGasAgency({ name, company, phone, isActive: true });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      const sel = document.getElementById('gcust-agency');
      if (sel) {
        sel.innerHTML = renderCustomerAgencyOptions(res.agency.id, res.agency.name);
        sel.value = res.agency.id;
      }
      const compSel = document.getElementById('gcust-comp');
      if (compSel && res.agency.company && [...compSel.options].some(o => o.value === res.agency.company)) {
        compSel.value = res.agency.company;
      }
      document.getElementById('gcust-inag-name').value = '';
      toggleGasCustomerAgencyInline(false);
      showToast(`Added & selected agency: ${res.agency.name}`, 'success');
    } catch (err) {
      showToast(err?.message || 'Failed to save agency.', 'danger');
    }
  }

  async function geocodeGasCustomerModalAddress() {
    const loc = getLocationCascadeValues('gcust-loc');
    const addrText = document.getElementById('gcust-addr')?.value?.trim() || loc.formattedAddress;
    const query =
      [loc.village, loc.postOffice, loc.policeStation, loc.district, loc.state, loc.pinCode].filter(Boolean).join(', ') ||
      addrText;
    if (!query) {
      showToast('Select Village / PIN Code or enter delivery address first.', 'warning');
      return;
    }
    showToast('Locating address on interactive map...', 'info');
    const res = await geocodeGasAddress(query);
    if (!res.success || !res.result) {
      showToast(res.message || 'Address not found. Click directly on the map or capture device GPS.', 'warning');
      return;
    }
    const latEl = document.getElementById('gcust-lat');
    const lngEl = document.getElementById('gcust-lng');
    const pidEl = document.getElementById('gcust-place-id');
    const lblEl = document.getElementById('gcust-pin-label');
    if (latEl) latEl.value = res.result.lat;
    if (lngEl) lngEl.value = res.result.lng;
    if (pidEl) pidEl.value = res.result.placeId || '';
    if (lblEl) lblEl.value = res.result.formattedAddress || query;
    if (_customerMapController?.updateCustomerPin) {
      _customerMapController.updateCustomerPin({ lat: res.result.lat, lng: res.result.lng });
    }
    updateCustomerModalMapPreviewLink();
    const viaLabel = res.result.source === 'local_centroid' ? ' (Approximate Area Pin)' : (res.result.source === 'osm_nominatim' ? ' (OpenStreetMap)' : '');
    showToast(`Pinned${viaLabel}: ${res.result.formattedAddress || `${res.result.lat}, ${res.result.lng}`}`, 'success');
  }

  async function captureCustomerModalGps() {
    showToast('Requesting device GPS location...', 'info');
    const loc = await requestBrowserCurrentLocation();
    if (!loc.success) {
      showToast(loc.message, 'danger');
      return;
    }
    const latEl = document.getElementById('gcust-lat');
    const lngEl = document.getElementById('gcust-lng');
    if (latEl) latEl.value = loc.lat;
    if (lngEl) lngEl.value = loc.lng;
    if (_customerMapController?.updateCustomerPin) {
      _customerMapController.updateCustomerPin({ lat: loc.lat, lng: loc.lng });
    }
    updateCustomerModalMapPreviewLink();
    const rev = await reverseGeocodeGasCoords(loc.lat, loc.lng);
    if (rev.success && rev.result?.formattedAddress) {
      const lblEl = document.getElementById('gcust-pin-label');
      const pidEl = document.getElementById('gcust-place-id');
      if (lblEl) lblEl.value = rev.result.formattedAddress;
      if (pidEl) pidEl.value = rev.result.placeId || '';
    }
    showToast(`Captured device GPS (±${loc.accuracyMeters}m)`, 'success');
  }

  function clearCustomerModalCoords() {
    const latEl = document.getElementById('gcust-lat');
    const lngEl = document.getElementById('gcust-lng');
    const pidEl = document.getElementById('gcust-place-id');
    const lblEl = document.getElementById('gcust-pin-label');
    if (latEl) latEl.value = '';
    if (lngEl) lngEl.value = '';
    if (pidEl) pidEl.value = '';
    if (lblEl) lblEl.value = '';
    updateCustomerModalMapPreviewLink();
  }

  async function submitGasCustomerForm(e) {
    e.preventDefault();
    const agencySel = document.getElementById('gcust-agency');
    const agencyId = agencySel?.value || '';
    const agencyName = agencySel?.options?.[agencySel.selectedIndex]?.dataset?.name || '';
    const latRaw = document.getElementById('gcust-lat')?.value;
    const lngRaw = document.getElementById('gcust-lng')?.value;
    const sameAsWhatsapp = Boolean(document.getElementById('gcust-same-wa')?.checked);
    const mobileVal = document.getElementById('gcust-mobile')?.value;
    const secondaryWaVal = document.getElementById('gcust-wa')?.value;
    const loc = getLocationCascadeValues('gcust-loc');
    const landmarkLine = String(document.getElementById('gcust-landmark-line')?.value || '').trim();
    const compiledFullAddr =
      document.getElementById('gcust-addr')?.value?.trim() ||
      [landmarkLine, loc.formattedAddress].filter(Boolean).join(', ');

    try {
      const res = await saveGasCustomer({
        id: document.getElementById('gcust-id')?.value || '',
        fullName: document.getElementById('gcust-name')?.value,
        guardianName: document.getElementById('gcust-guardian')?.value,
        mobile: mobileVal,
        sameAsWhatsapp,
        whatsapp: sameAsWhatsapp ? mobileVal : secondaryWaVal,
        altMobile: sameAsWhatsapp ? mobileVal : secondaryWaVal,
        consumerId: document.getElementById('gcust-cid')?.value,
        lpgId17: document.getElementById('gcust-lpg17')?.value,
        gasCompany: document.getElementById('gcust-comp')?.value,
        agencyId,
        agencyName,
        connectionCategory: document.getElementById('gcust-cat')?.value,
        cylinderType: document.getElementById('gcust-cyl')?.value,
        dbcStatus: document.getElementById('gcust-dbc')?.value,
        ekycStatus: document.getElementById('gcust-ekyc')?.value,
        bankLinkStatus: document.getElementById('gcust-bank')?.value,
        bankName: document.getElementById('gcust-bank-name')?.value,
        bankAccountLast4: document.getElementById('gcust-mask-ac')?.value,
        maskedAccount: document.getElementById('gcust-mask-ac')?.value,
        subsidyEligible: document.getElementById('gcust-sub-elig')?.value,
        nonTakerFlag: document.getElementById('gcust-nontaker')?.value,
        customIntervalDays: document.getElementById('gcust-interval')?.value,
        status: document.getElementById('gcust-status')?.value,
        areaType: loc.areaType,
        subdivision: loc.subdivision,
        blockOrMunicipality: loc.blockOrMunicipality,
        gpOrWard: loc.gpOrWard,
        wardId: loc.wardId,
        wardNo: loc.wardNo,
        wardNumber: loc.wardNumber,
        landmark: landmarkLine,
        village: loc.village,
        postOffice: loc.postOffice,
        policeStation: loc.policeStation,
        district: loc.district,
        state: loc.state,
        pinCode: loc.pinCode,
        villageAddress: compiledFullAddr,
        savedDeliveryAddress: compiledFullAddr,
        lat: latRaw !== '' ? Number(latRaw) : null,
        lng: lngRaw !== '' ? Number(lngRaw) : null,
        clearCoords: latRaw === '' && lngRaw === '',
        placeId: document.getElementById('gcust-place-id')?.value,
        mapPinLabel: document.getElementById('gcust-pin-label')?.value,
        remarks: document.getElementById('gcust-remarks')?.value
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Saved Gas Customer: ${res.customer.fullName}`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save gas customer.', 'danger');
    }
  }

  function deleteGasCustomerConfirm(id) {
    const cust = getGasCustomerById(id);
    if (!cust) return;
    showConfirmDialog(
      'Delete Gas Customer?',
      `Permanently remove ${cust.fullName} (${cust.consumerId || cust.id})? Customers with active bookings or open advance ledgers cannot be deleted.`,
      () => {
        const res = deleteGasCustomer(id);
        if (!res.success) {
          showToast(res.message, 'danger');
          return;
        }
        showToast('Gas Customer removed.', 'success');
        render();
      }
    );
  }

  function openGasCustomerHistoryModal(gasCustomerId, activeTab = 'bookings') {
    const h = getGasCustomerFullHistory(gasCustomerId);
    if (!h) {
      showToast('Customer profile not found.', 'danger');
      return;
    }
    const tabs = [
      { id: 'bookings', label: `Bookings (${h.bookings.length})` },
      { id: 'payments', label: `Payments (${h.collections.length})` },
      { id: 'subsidies', label: `Subsidy (${h.subsidies.length})` },
      { id: 'services', label: `Service & Replacement (${h.serviceEntries.length})` }
    ];

    let tabBody = '';
    if (activeTab === 'bookings') {
      tabBody = h.bookings.length === 0
        ? '<p style="color:var(--text-muted);font-size:0.84rem;">No bookings recorded yet.</p>'
        : `<table class="data-table"><thead><tr><th>Booking No</th><th>Date</th><th>Cylinder</th><th style="text-align:right;">Total</th><th style="text-align:right;">Due</th><th>Stage</th></tr></thead><tbody>${h.bookings.map(b => `<tr><td class="font-mono">${esc(b.bookingNo)}</td><td>${esc(formatDate(b.bookingDate))}</td><td>${esc(b.cylinderType)} x${b.quantity}</td><td style="text-align:right;">${formatINR(b.totalAmount)}</td><td style="text-align:right;">${formatINR(b.dueAmount)}</td><td>${esc(normalizeGasBookingStatus(b.deliveryStatus))}</td></tr>`).join('')}</tbody></table>`;
    } else if (activeTab === 'payments') {
      tabBody = h.collections.length === 0
        ? '<p style="color:var(--text-muted);font-size:0.84rem;">No collection receipts yet.</p>'
        : `<table class="data-table"><thead><tr><th>Receipt No</th><th>Date</th><th>Category</th><th>Mode</th><th style="text-align:right;">Amount</th><th>Status</th></tr></thead><tbody>${h.collections.map(c => `<tr><td class="font-mono">${esc(c.receiptNo)}</td><td>${esc(formatDate(c.collectionDate))}</td><td>${esc(c.category)}</td><td>${esc(c.paymentMode)}</td><td style="text-align:right;">${formatINR(c.amount)}</td><td>${esc(c.status)}</td></tr>`).join('')}</tbody></table>`;
    } else if (activeTab === 'subsidies') {
      tabBody = h.subsidies.length === 0
        ? '<p style="color:var(--text-muted);font-size:0.84rem;">No subsidy DBT records logged yet.</p>'
        : `<table class="data-table"><thead><tr><th>ID</th><th>Booking</th><th style="text-align:right;">Expected</th><th style="text-align:right;">Credited</th><th>Credit Date</th><th>Status</th></tr></thead><tbody>${h.subsidies.map(s => `<tr><td class="font-mono">${esc(s.id)}</td><td>${esc(s.bookingNo || '-')}</td><td style="text-align:right;">${formatINR(s.expectedSubsidy)}</td><td style="text-align:right;">${formatINR(s.actualCredited)}</td><td>${s.dbtCreditDate ? esc(formatDate(s.dbtCreditDate)) : '-'}</td><td>${esc(s.dbtStatus)}</td></tr>`).join('')}</tbody></table>`;
    } else {
      tabBody = h.serviceEntries.length === 0
        ? '<p style="color:var(--text-muted);font-size:0.84rem;">No regulator or pipe replacement service entries yet.</p>'
        : `<table class="data-table"><thead><tr><th>Service ID</th><th>Date</th><th>Type</th><th>Hardware</th><th style="text-align:right;">Total</th><th>Status</th></tr></thead><tbody>${h.serviceEntries.map(e => `<tr><td class="font-mono">${esc(e.serviceId)}</td><td>${esc(formatDate(e.serviceDate))}</td><td>${esc(e.serviceType)}</td><td>${esc([e.newRegulatorDetails, e.newPipeDetails].filter(Boolean).join(' + ') || '-')}</td><td style="text-align:right;">${formatINR(e.totalAmount)}</td><td>${esc(e.status)}</td></tr>`).join('')}</tbody></table>`;
    }

    const html = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.65rem;margin-bottom:0.85rem;">
        <div style="border:1px solid var(--border-subtle);padding:0.65rem;border-radius:var(--radius-md);"><div style="font-size:0.72rem;color:var(--text-muted);">Consumer / LPG ID</div><div class="font-mono" style="font-weight:700;">${esc(h.customer.consumerId || h.customer.lpgId17 || 'Optional')}</div></div>
        <div style="border:1px solid var(--border-subtle);padding:0.65rem;border-radius:var(--radius-md);"><div style="font-size:0.72rem;color:var(--text-muted);">Total Collected</div><div style="font-weight:800;color:#047857;">${formatINR(h.totals.totalCollected)}</div></div>
        <div style="border:1px solid var(--border-subtle);padding:0.65rem;border-radius:var(--radius-md);"><div style="font-size:0.72rem;color:var(--text-muted);">Total Outstanding Due</div><div style="font-weight:800;color:#b91c1c;">${formatINR(h.totals.totalOutstandingDue)}</div></div>
        <div style="border:1px solid var(--border-subtle);padding:0.65rem;border-radius:var(--radius-md);"><div style="font-size:0.72rem;color:var(--text-muted);">Next Eligibility</div><div style="font-weight:700;">${esc(formatDate(h.eligibility.nextEligibleDate))}</div></div>
      </div>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.85rem;">
        ${tabs.map(t => `<button type="button" class="btn btn-sm ${activeTab === t.id ? 'btn-primary' : 'btn-secondary'}" onclick="window.MJK.openGasCustomerHistoryModal('${esc(gasCustomerId)}', '${t.id}')">${esc(t.label)}</button>`).join('')}
      </div>
      <div style="overflow-x:auto;">${tabBody}</div>
    `;
    openModal(`Customer History: ${h.customer.fullName}`, html, null, 'modal-lg');
  }

  /* =====================================================================
     BOOKING MODAL (LIVE SEARCH, ROUTES DISTANCE, DELIVERY FEE, PIPELINE)
     ===================================================================== */

  function openGasBookingModal(editId = '', prefillCustId = '') {
    const b = editId ? getGasBookingById(editId) : null;
    const settings = getGasSettings();
    const customers = getAllGasCustomers();
    const agencies = getGasAgencies();
    const cylinders = getGasCylinderTypes({ activeOnly: true });
    const areas = getGasDeliveryAreas({ activeOnly: true });
    const riders = getAllGasDeliveryPersons({ activeOnly: true });
    const payModes = settings.paymentMethods || GAS_PAYMENT_MODES;
    const selCustId = b?.gasCustomerId || prefillCustId || '';
    const selCust = selCustId ? getGasCustomerById(selCustId) : null;

    const initCyl = b?.cylinderType || selCust?.cylinderType || cylinders[0]?.name || '14.2 Kg';
    const cylMatch = cylinders.find(c => c.name === initCyl);
    const initRefillPrice = b ? (b.refillPrice ?? 900) : (cylMatch?.defaultPrice ?? 900);
    const initMethod = b?.deliveryPricingMethod || settings.deliveryPricingConfig?.defaultMethod || 'Distance-Based Tiers';
    const initAddr = b?.deliveryAddressSnapshot || selCust?.savedDeliveryAddress || selCust?.villageAddress || '';
    const initLat = b?.deliveryLat ?? selCust?.lat ?? '';
    const initLng = b?.deliveryLng ?? selCust?.lng ?? '';
    const initStatus = b ? normalizeGasBookingStatus(b.deliveryStatus) : 'Booking Received';
    const initTaking = b?.customerTakingGas || 'Yes';
    const presets = settings.nonTakerReferencePresets || [120, 130];

    const html = `
      <form onsubmit="window.MJK.submitGasBookingForm(event)">
        <input type="hidden" id="gbk-id" value="${esc(b?.id || '')}">
        <input type="hidden" id="gbk-lat" value="${initLat !== null && initLat !== undefined ? esc(initLat) : ''}">
        <input type="hidden" id="gbk-lng" value="${initLng !== null && initLng !== undefined ? esc(initLng) : ''}">
        <input type="hidden" id="gbk-polyline" value="${esc(b?.routePolyline || '')}">
        <input type="hidden" id="gbk-eta" value="${esc(b?.estimatedTravelTime || '')}">

        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:0.75rem;margin-bottom:0.85rem;">
          <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:0.65rem;align-items:end;">
            <div>
              <label class="form-label" style="font-size:0.74rem;">Live Search Customer</label>
              <input id="gbk-cust-search" type="text" class="form-control" placeholder="Type Name, Mobile, Consumer/LPG ID..." oninput="window.MJK.filterGasBookingCustomerDropdown(this.value)">
            </div>
            <div>
              <label class="form-label" style="font-size:0.74rem;">Select Registered Gas Customer *</label>
              <select id="gbk-cust" class="form-control" required onchange="window.MJK.handleGasBookingCustChange(this.value)">
                <option value="">-- Select Customer --</option>
                ${customers.map(c => `<option value="${esc(c.id)}" ${selCustId === c.id ? 'selected' : ''}>${esc(c.fullName)} · ${esc(c.mobile)}${c.consumerId ? ` (${esc(c.consumerId)})` : ''}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:2fr 1fr auto;gap:0.6rem;margin-top:0.6rem;align-items:end;">
            <div>
              <label class="form-label" style="font-size:0.72rem;">Delivery Address Snapshot</label>
              <input id="gbk-addr" type="text" class="form-control" placeholder="Auto-filled from Customer profile (or enter delivery address)" value="${esc(initAddr)}">
            </div>
            <div>
              <label class="form-label" style="font-size:0.72rem;">Village / Delivery Area</label>
              <input id="gbk-area" type="text" class="form-control" value="${esc(b?.deliveryArea || selCust?.village || '')}" placeholder="e.g., Mamudpur">
            </div>
            <div id="gbk-pin-badge" style="padding:0.42rem 0.6rem;border-radius:6px;font-size:0.74rem;font-weight:700;background:#ffffff;border:1px solid #bfdbfe;color:#1e3a8a;white-space:nowrap;">
              ${Number.isFinite(Number(initLat)) && Number.isFinite(Number(initLng)) ? `Pinned: ${Number(initLat).toFixed(4)}, ${Number(initLng).toFixed(4)}` : 'Address / No Pin'}
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.7rem;margin-bottom:0.85rem;">
          <div>
            <label class="form-label">Agency / Distributor</label>
            <select id="gbk-agency" class="form-control">
              <option value="">-- Optional / Default --</option>
              ${agencies.map(a => `<option value="${esc(a.id)}" data-name="${esc(a.name)}" ${((b?.agencyId || selCust?.agencyId) === a.id || (b?.agencyName || selCust?.agencyName) === a.name) ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Gas Company</label>
            <select id="gbk-comp" class="form-control">
              ${(settings.gasCompanies || ['Indane', 'HP Gas', 'Bharatgas']).map(co => `<option value="${esc(co)}" ${(b?.gasCompany || selCust?.gasCompany || 'Indane') === co ? 'selected' : ''}>${esc(co)}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Booking Date *</label><input id="gbk-date" type="date" required class="form-control" value="${esc(b?.bookingDate || getTodayDate())}"></div>
          <div>
            <label class="form-label">Booking Mode</label>
            <select id="gbk-mode" class="form-control">
              ${['Counter', 'Online', 'IVRS', 'WhatsApp', 'Mobile App', 'Phone Call'].map(m => `<option value="${esc(m)}" ${(b?.bookingMode || 'Counter') === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Booking Reference No</label><input id="gbk-ref" type="text" class="form-control font-mono" value="${esc(b?.bookingRefNo || '')}"></div>
          <div>
            <label class="form-label">Cylinder Type</label>
            <select id="gbk-cyl" class="form-control" onchange="const o=this.options[this.selectedIndex]; if(o?.dataset?.price) document.getElementById('gbk-price').value=o.dataset.price; window.MJK.recalcGasBookingModal();">
              ${cylinders.map(cy => `<option value="${esc(cy.name)}" data-price="${Number(cy.defaultPrice) || 0}" ${initCyl === cy.name ? 'selected' : ''}>${esc(cy.name)} (₹${cy.defaultPrice})</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Quantity</label><input id="gbk-qty" type="number" min="1" value="${b?.quantity || 1}" class="form-control" oninput="window.MJK.recalcGasBookingModal()"></div>
          <div><label class="form-label">Refill Price (₹)</label><input id="gbk-price" type="number" min="0" step="0.01" value="${initRefillPrice}" class="form-control" oninput="window.MJK.recalcGasBookingModal()"></div>
        </div>

        <div style="background:#f8fafc;border:1px solid var(--border-subtle);border-radius:8px;padding:0.8rem;margin-bottom:0.85rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.55rem;flex-wrap:wrap;gap:0.4rem;">
            <strong style="font-size:0.82rem;color:#0f172a;">Delivery Distance (Google Routes API) & Smart Delivery Fee</strong>
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">
              <span id="gbk-route-status" style="font-size:0.74rem;color:#1d4ed8;font-weight:600;">${b?.estimatedTravelTime ? `ETA: ${esc(b.estimatedTravelTime)}` : ''}</span>
              <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.computeGasBookingRoadDistance()">Compute Road Distance (Google Maps)</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.65rem;">
            <div>
              <label class="form-label" style="font-size:0.72rem;">Pricing Method</label>
              <select id="gbk-pricing-method" class="form-control" onchange="window.MJK.applyGasSuggestedDeliveryFee()">
                ${GAS_DELIVERY_PRICING_METHODS.map(m => `<option value="${esc(m)}" ${initMethod === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size:0.72rem;">Area Tariff (If Area-Based)</label>
              <select id="gbk-area-tariff" class="form-control" onchange="const o=this.options[this.selectedIndex]; if(o?.dataset?.km) document.getElementById('gbk-dist').value=o.dataset.km; window.MJK.applyGasSuggestedDeliveryFee();">
                <option value="">-- Select Village/Area --</option>
                ${areas.map(ar => `<option value="${esc(ar.id)}" data-km="${Number(ar.distanceKm || 0)}" ${b?.deliveryArea === ar.name ? 'selected' : ''}>${esc(ar.name)} (₹${ar.charge})</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size:0.72rem;">Delivery Distance (KM)</label>
              <input id="gbk-dist" type="number" min="0" step="0.1" value="${Number(b?.deliveryDistanceKm ?? 0)}" class="form-control font-mono" oninput="window.MJK.applyGasSuggestedDeliveryFee()">
            </div>
            <div>
              <label class="form-label" style="font-size:0.72rem;">Delivery Charge (₹)</label>
              <input id="gbk-delchg" type="number" min="0" step="0.01" value="${b?.deliveryCharge ?? calculateSuggestedDeliveryCharge({ method: initMethod, distanceKm: b?.deliveryDistanceKm ?? 0 }).charge}" class="form-control" oninput="window.MJK.recalcGasBookingModal()">
            </div>
            <div>
              <label class="form-label" style="font-size:0.72rem;">Additional Service Charge (₹)</label>
              <input id="gbk-addl" type="number" min="0" step="0.01" value="${b?.additionalServiceCharge ?? 0}" class="form-control" oninput="window.MJK.recalcGasBookingModal()">
            </div>
            <div>
              <label class="form-label" style="font-size:0.72rem;">Discount (₹)</label>
              <input id="gbk-disc" type="number" min="0" step="0.01" value="${b?.discount ?? 0}" class="form-control" oninput="window.MJK.recalcGasBookingModal()">
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:0.7rem;margin-bottom:0.85rem;">
          <div><label class="form-label">Paid Amount (₹)</label><input id="gbk-paid" type="number" min="0" step="0.01" value="${b?.paidAmount ?? 0}" class="form-control" oninput="window.MJK.recalcGasBookingModal()"></div>
          <div>
            <label class="form-label">Payment Mode</label>
            <select id="gbk-pmode" class="form-control">
              ${payModes.map(m => `<option value="${esc(m)}" ${(b?.paymentMode || 'Cash') === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Transaction Ref / UTR</label><input id="gbk-txnref" type="text" class="form-control font-mono" value=""></div>
          <div>
            <label class="form-label">Delivery Pipeline Stage</label>
            <select id="gbk-status" class="form-control">
              <optgroup label="7-Stage Delivery Pipeline">
                ${GAS_DELIVERY_PIPELINE_STAGES.map(st => `<option value="${esc(st)}" ${initStatus === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
              </optgroup>
              <optgroup label="Exceptions & Holds">
                ${GAS_EXCEPTION_STATUSES.map(st => `<option value="${esc(st)}" ${initStatus === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
              </optgroup>
            </select>
          </div>
          <div><label class="form-label">Scheduled / Delivery Date</label><input id="gbk-deldate" type="date" class="form-control" value="${esc(b?.deliveryDate || '')}"></div>
          <div>
            <label class="form-label">Assigned Delivery Person</label>
            <select id="gbk-rider" class="form-control">
              <option value="">-- Unassigned --</option>
              ${riders.map(p => `<option value="${esc(p.id)}" ${b?.deliveryPersonId === p.id ? 'selected' : ''}>${esc(p.name)} (${esc(p.mobile)})</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Customer Taking Gas?</label>
            <select id="gbk-taking-gas" class="form-control" onchange="document.getElementById('gbk-nontaker-box').style.display = this.value === 'No' ? 'block' : 'none';">
              <option value="Yes" ${initTaking === 'Yes' ? 'selected' : ''}>Yes — Standard Delivery</option>
              <option value="No" ${initTaking === 'No' ? 'selected' : ''}>No — Non-Taker / Declined</option>
            </select>
          </div>
          <div>
            <label class="form-label">Computed Total / Due</label>
            <div id="gbk-summary-lbl" style="padding:0.45rem 0.65rem;background:#eff6ff;border:1px solid #bfdbfe;color:#0b3b8c;border-radius:var(--radius-sm);font-weight:800;font-variant-numeric:tabular-nums;">Total: ${formatINR(b?.totalAmount ?? initRefillPrice)} | Due: ${formatINR(b?.dueAmount ?? initRefillPrice)}</div>
          </div>
        </div>

        <div id="gbk-nontaker-box" style="display:${initTaking === 'No' && !b ? 'block' : 'none'};background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:0.75rem;margin-bottom:0.85rem;">
          <div style="font-size:0.8rem;font-weight:700;color:#78350f;margin-bottom:0.45rem;">Optional Non-Taker Advance Integration (Requires Explicit Consent)</div>
          <div style="display:grid;grid-template-columns:auto 1fr 2fr;gap:0.65rem;align-items:center;">
            <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.8rem;"><input id="gbk-nt-rec" type="checkbox"> Record Advance</label>
            <div>
              <input id="gbk-nt-amt" type="number" min="0" step="1" class="form-control" value="${presets[0] || 120}" placeholder="₹120 / ₹130">
            </div>
            <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.78rem;"><input id="gbk-nt-consent" type="checkbox"> Customer explicitly consented to authorized non-taker advance</label>
          </div>
        </div>

        <div style="margin-bottom:0.85rem;">
          ${renderSearchableServiceSelectorHtml('gbk-rate-services', {
            label: 'Service / Product / Accessory Interest * (Rate Chart English & Bengali Search)',
            placeholder: 'Search LPG accessories, Suraksha pipe, regulator, KYC or digital services...',
            showBilling: true
          })}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.65rem;margin-bottom:1rem;">
          <div><label class="form-label">Delivery Instructions</label><input id="gbk-instr" type="text" class="form-control" placeholder="Call on arrival / Gate side" value="${esc(b?.deliveryInstructions || '')}"></div>
          <div><label class="form-label">Special Notes</label><input id="gbk-notes" type="text" class="form-control" value="${esc(b?.specialNotes || '')}"></div>
          <div><label class="form-label">Remarks</label><input id="gbk-remarks" type="text" class="form-control" value="${esc(b?.remarks || '')}"></div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${b ? 'Update Gas Booking' : 'Save New Gas Booking'}</button>
        </div>
      </form>
    `;
    openModal(b ? `Edit Booking (${b.bookingNo})` : 'New Gas Cylinder Booking & Delivery', html, null, 'modal-lg');
    setTimeout(() => {
      initSearchableServiceSelector('gbk-rate-services', {
        initialServices: Array.isArray(b?.selectedServices) ? b.selectedServices : [],
        showBilling: true,
        onChange: (state) => {
          const addlEl = document.getElementById('gbk-addl');
          if (addlEl) {
            addlEl.value = state.services.length > 0 ? String(state.totalPayable || 0) : (b ? String(b.additionalServiceCharge ?? 0) : '0');
          }
          recalcGasBookingModal();
        }
      });
    }, 30);
    recalcGasBookingModal();
  }

  function filterGasBookingCustomerDropdown(query) {
    const sel = document.getElementById('gbk-cust');
    if (!sel) return;
    const currentVal = sel.value;
    const q = String(query || '').trim().toLowerCase();
    const customers = getAllGasCustomers().filter(c => {
      if (!q) return true;
      return [c.fullName, c.mobile, c.altMobile, c.consumerId, c.lpgId17, c.village, c.agencyName]
        .some(f => String(f || '').toLowerCase().includes(q));
    });
    const opts = ['<option value="">-- Select Customer (' + customers.length + ' match) --</option>'];
    for (const c of customers) {
      opts.push(`<option value="${esc(c.id)}" ${c.id === currentVal ? 'selected' : ''}>${esc(c.fullName)} · ${esc(c.mobile)}${c.consumerId ? ` (${esc(c.consumerId)})` : ''}</option>`);
    }
    sel.innerHTML = opts.join('');
    if (currentVal && customers.some(c => c.id === currentVal)) {
      sel.value = currentVal;
    }
  }

  function handleGasBookingCustChange(custId) {
    const c = getGasCustomerById(custId);
    if (!c) return;
    const addrEl = document.getElementById('gbk-addr');
    const areaEl = document.getElementById('gbk-area');
    const agencyEl = document.getElementById('gbk-agency');
    const compEl = document.getElementById('gbk-comp');
    const cylEl = document.getElementById('gbk-cyl');
    const latEl = document.getElementById('gbk-lat');
    const lngEl = document.getElementById('gbk-lng');
    const pinBadge = document.getElementById('gbk-pin-badge');

    if (addrEl) addrEl.value = c.savedDeliveryAddress || c.villageAddress || '';
    if (areaEl) areaEl.value = c.village || '';
    if (agencyEl && c.agencyId && [...agencyEl.options].some(o => o.value === c.agencyId)) {
      agencyEl.value = c.agencyId;
    }
    if (compEl && c.gasCompany && [...compEl.options].some(o => o.value === c.gasCompany)) {
      compEl.value = c.gasCompany;
    }
    if (cylEl && c.cylinderType && [...cylEl.options].some(o => o.value === c.cylinderType)) {
      cylEl.value = c.cylinderType;
      const opt = cylEl.options[cylEl.selectedIndex];
      if (opt?.dataset?.price) {
        const priceEl = document.getElementById('gbk-price');
        if (priceEl) priceEl.value = opt.dataset.price;
      }
    }
    const hasPin = Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng));
    if (latEl) latEl.value = hasPin ? Number(c.lat) : '';
    if (lngEl) lngEl.value = hasPin ? Number(c.lng) : '';
    if (pinBadge) {
      pinBadge.textContent = hasPin ? `Pinned: ${Number(c.lat).toFixed(4)}, ${Number(c.lng).toFixed(4)}` : 'Address / No Pin';
    }
    recalcGasBookingModal();
  }

  function applyGasSuggestedDeliveryFee() {
    const method = document.getElementById('gbk-pricing-method')?.value || 'Distance-Based Tiers';
    const distKm = Number(document.getElementById('gbk-dist')?.value) || 0;
    const areaSel = document.getElementById('gbk-area-tariff');
    const areaId = areaSel?.value || '';
    const areaName = document.getElementById('gbk-area')?.value || '';
    const currentManual = Number(document.getElementById('gbk-delchg')?.value) || 0;

    const calc = calculateSuggestedDeliveryCharge({
      method,
      distanceKm: distKm,
      areaId,
      areaName,
      customCharge: currentManual
    });
    const delChgEl = document.getElementById('gbk-delchg');
    if (delChgEl && method !== 'Custom Manual Charge') {
      delChgEl.value = calc.charge;
    }
    recalcGasBookingModal();
  }

  async function computeGasBookingRoadDistance() {
    const statusEl = document.getElementById('gbk-route-status');
    if (statusEl) statusEl.textContent = 'Computing Google Road Route...';

    const origin = await ensureMainCentreCoords();
    if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
      if (statusEl) statusEl.textContent = 'Main Centre coords unavailable — enter KM manually.';
      showToast('Could not locate Main Centre. Set Main Centre coords in Gas Settings or enter KM manually.', 'warning');
      return;
    }

    let dLat = Number(document.getElementById('gbk-lat')?.value);
    let dLng = Number(document.getElementById('gbk-lng')?.value);
    const addrText = document.getElementById('gbk-addr')?.value?.trim();

    if (!Number.isFinite(dLat) || !Number.isFinite(dLng) || (dLat === 0 && dLng === 0)) {
      if (!addrText) {
        if (statusEl) statusEl.textContent = 'Enter Customer Address or Pin.';
        showToast('Enter delivery address or select a pinned customer first.', 'warning');
        return;
      }
      const geo = await geocodeGasAddress(addrText);
      if (!geo.success || !geo.result) {
        if (statusEl) statusEl.textContent = 'Address geocode unavailable — enter KM manually.';
        showToast(geo.message || 'Could not locate customer address. Enter KM manually.', 'warning');
        return;
      }
      dLat = geo.result.lat;
      dLng = geo.result.lng;
      const latEl = document.getElementById('gbk-lat');
      const lngEl = document.getElementById('gbk-lng');
      const pinBadge = document.getElementById('gbk-pin-badge');
      if (latEl) latEl.value = dLat;
      if (lngEl) lngEl.value = dLng;
      if (pinBadge) pinBadge.textContent = `Pinned: ${dLat.toFixed(4)}, ${dLng.toFixed(4)}`;
    }

    const routeRes = await computeRoadRoute({ lat: origin.lat, lng: origin.lng }, { lat: dLat, lng: dLng });
    if (!routeRes.success) {
      if (statusEl) statusEl.textContent = 'Route unreachable — enter KM manually.';
      showToast(routeRes.message || 'Google Routes API failed. Enter delivery distance/charge manually.', 'warning');
      return;
    }

    const distEl = document.getElementById('gbk-dist');
    const polyEl = document.getElementById('gbk-polyline');
    const etaEl = document.getElementById('gbk-eta');
    if (distEl) distEl.value = routeRes.distanceKm;
    if (polyEl) polyEl.value = routeRes.encodedPolyline || '';
    if (etaEl) etaEl.value = routeRes.durationText || '';
    if (statusEl) statusEl.textContent = `Road: ${routeRes.distanceKm} KM (${routeRes.durationText || 'Driving'})`;

    applyGasSuggestedDeliveryFee();
    showToast(`Google Road Distance: ${routeRes.distanceKm} KM (${routeRes.durationText || ''})`, 'success');
  }

  function recalcGasBookingModal() {
    const qty = Math.max(1, Number(document.getElementById('gbk-qty')?.value) || 1);
    const price = Math.max(0, Number(document.getElementById('gbk-price')?.value) || 0);
    const delChg = Math.max(0, Number(document.getElementById('gbk-delchg')?.value) || 0);
    const addlChg = Math.max(0, Number(document.getElementById('gbk-addl')?.value) || 0);
    const disc = Math.max(0, Number(document.getElementById('gbk-disc')?.value) || 0);
    const paid = Math.max(0, Number(document.getElementById('gbk-paid')?.value) || 0);
    const tot = Math.max(0, price * qty + delChg + addlChg - disc);
    const due = Math.max(0, tot - paid);
    const el = document.getElementById('gbk-summary-lbl');
    if (el) el.textContent = `Total: ${formatINR(tot)} | Due: ${formatINR(due)}`;
  }

  async function submitGasBookingForm(e) {
    e.preventDefault();
    const agencySel = document.getElementById('gbk-agency');
    const agencyId = agencySel?.value || '';
    const agencyName = agencySel?.options?.[agencySel.selectedIndex]?.dataset?.name || '';
    const latVal = document.getElementById('gbk-lat')?.value;
    const lngVal = document.getElementById('gbk-lng')?.value;

    try {
      const res = await saveGasBooking({
        id: document.getElementById('gbk-id')?.value || '',
        gasCustomerId: document.getElementById('gbk-cust')?.value,
        agencyId,
        agencyName,
        gasCompany: document.getElementById('gbk-comp')?.value,
        bookingDate: document.getElementById('gbk-date')?.value,
        bookingMode: document.getElementById('gbk-mode')?.value,
        bookingRefNo: document.getElementById('gbk-ref')?.value,
        cylinderType: document.getElementById('gbk-cyl')?.value,
        quantity: document.getElementById('gbk-qty')?.value,
        refillPrice: document.getElementById('gbk-price')?.value,
        deliveryPricingMethod: document.getElementById('gbk-pricing-method')?.value,
        deliveryDistanceKm: document.getElementById('gbk-dist')?.value,
        deliveryCharge: document.getElementById('gbk-delchg')?.value,
        additionalServiceCharge: document.getElementById('gbk-addl')?.value,
        selectedServices: getSelectedServicesState('gbk-rate-services').services,
        discount: document.getElementById('gbk-disc')?.value,
        paidAmount: document.getElementById('gbk-paid')?.value,
        paymentMode: document.getElementById('gbk-pmode')?.value,
        transactionRef: document.getElementById('gbk-txnref')?.value,
        deliveryStatus: document.getElementById('gbk-status')?.value,
        deliveryDate: document.getElementById('gbk-deldate')?.value,
        deliveryPersonId: document.getElementById('gbk-rider')?.value,
        deliveryArea: document.getElementById('gbk-area')?.value,
        deliveryAddressSnapshot: document.getElementById('gbk-addr')?.value,
        deliveryLat: latVal !== '' ? Number(latVal) : null,
        deliveryLng: lngVal !== '' ? Number(lngVal) : null,
        routePolyline: document.getElementById('gbk-polyline')?.value,
        estimatedTravelTime: document.getElementById('gbk-eta')?.value,
        customerTakingGas: document.getElementById('gbk-taking-gas')?.value,
        recordNonTakerAdvance: Boolean(document.getElementById('gbk-nt-rec')?.checked),
        nonTakerAdvanceAmount: document.getElementById('gbk-nt-amt')?.value,
        nonTakerConsentConfirmed: Boolean(document.getElementById('gbk-nt-consent')?.checked),
        deliveryInstructions: document.getElementById('gbk-instr')?.value,
        specialNotes: document.getElementById('gbk-notes')?.value,
        remarks: document.getElementById('gbk-remarks')?.value
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Saved Booking ${res.booking.bookingNo} (Total: ${formatINR(res.booking.totalAmount)})`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save booking.', 'danger');
    }
  }

  async function markGasBookingDelivered(id) {
    try {
      const res = await updateGasBookingStatus(id, 'Delivered Successfully', { deliveryDate: getTodayDate() });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Booking ${res.booking.bookingNo} marked Delivered Successfully.`, 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to mark booking delivered.', 'danger');
    }
  }

  /* =====================================================================
     7-STAGE ORDER TRACKING STEPPER, LIVE MAP & RIDER ASSIGNMENT MODALS
     ===================================================================== */

  function openGasAssignRiderModal(bookingId) {
    const b = getGasBookingById(bookingId);
    if (!b) return;
    const riders = getAllGasDeliveryPersons({ activeOnly: true });
    const html = `
      <form onsubmit="window.MJK.submitGasAssignRiderModal(event)">
        <input type="hidden" id="grider-bkid" value="${esc(b.id)}">
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:0.65rem 0.8rem;margin-bottom:0.85rem;font-size:0.82rem;">
          <strong>${esc(b.bookingNo)}</strong> · ${esc(b.customerName)} (${esc(b.mobile)})<br>
          <span style="color:#475569;">${esc(b.deliveryAddressSnapshot || 'Address not entered')}</span>
        </div>
        <div style="margin-bottom:0.75rem;">
          <label class="form-label">Select Delivery Person *</label>
          <select id="grider-person" class="form-control" required>
            <option value="">-- Choose Rider --</option>
            ${riders.map(p => `<option value="${esc(p.id)}" ${b.deliveryPersonId === p.id ? 'selected' : ''}>${esc(p.name)} · ${esc(p.mobile)} (${esc(p.assignedArea || 'All Areas')})</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom:0.75rem;">
          <label class="form-label">Assignment Note</label>
          <input id="grider-note" type="text" class="form-control" placeholder="e.g., Afternoon dispatch batch">
        </div>
        <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.8rem;margin-bottom:1rem;">
          <input id="grider-advance" type="checkbox" checked> Automatically advance early stage to "Delivery Assigned"
        </label>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Assign Rider</button>
        </div>
      </form>
    `;
    openModal(`Assign Delivery Person (${b.bookingNo})`, html, null);
  }

  async function submitGasAssignRiderModal(e) {
    e.preventDefault();
    const bookingId = document.getElementById('grider-bkid')?.value;
    const riderId = document.getElementById('grider-person')?.value;
    const note = document.getElementById('grider-note')?.value;
    const autoAdvanceStage = Boolean(document.getElementById('grider-advance')?.checked);
    try {
      const res = await assignDeliveryPersonToBooking(bookingId, riderId, { autoAdvanceStage, note });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Assigned ${res.booking.deliveryPersonName} to ${res.booking.bookingNo}`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to assign rider.', 'danger');
    }
  }

  function openGasOrderTrackingModal(bookingId) {
    const b = getGasBookingById(bookingId);
    if (!b) return;
    const settings = getGasSettings();
    const mc = settings.mainCentre || MAIN_CENTRE_DEFAULT;
    const riders = getAllGasDeliveryPersons({ activeOnly: true });
    const currentStage = normalizeGasBookingStatus(b.deliveryStatus);
    const currentIdx = GAS_DELIVERY_PIPELINE_STAGES.indexOf(currentStage);
    const isException = GAS_EXCEPTION_STATUSES.includes(currentStage);
    const timeline = [...(b.deliveryTimeline || [])].reverse();
    const navUrl = buildGoogleMapsDirectionsUrl(
      mc,
      Number.isFinite(Number(b.deliveryLat)) && Number.isFinite(Number(b.deliveryLng))
        ? { lat: b.deliveryLat, lng: b.deliveryLng }
        : { address: b.deliveryAddressSnapshot || '' }
    );

    const html = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:0.6rem;margin-bottom:0.9rem;">
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:0.65rem;">
          <div style="font-size:0.7rem;color:#1e3a8a;font-weight:700;">ORDER & CUSTOMER</div>
          <div style="font-weight:800;font-size:0.92rem;color:#0b3b8c;">${esc(b.bookingNo)} · ${esc(b.customerName)}</div>
          <div style="font-size:0.74rem;color:#334155;">${esc(b.mobile)} · ${esc(b.cylinderType)} × ${b.quantity}</div>
        </div>
        <div style="background:#f8fafc;border:1px solid var(--border-subtle);border-radius:8px;padding:0.65rem;">
          <div style="font-size:0.7rem;color:var(--text-muted);font-weight:700;">ASSIGNED RIDER</div>
          <div style="font-weight:800;font-size:0.9rem;">${esc(b.deliveryPersonName || b.deliveryStaff || 'Unassigned')}</div>
          <div style="font-size:0.74rem;color:var(--text-muted);">${esc(b.deliveryPersonMobile || 'Assign rider below')}</div>
        </div>
        <div style="background:#f8fafc;border:1px solid var(--border-subtle);border-radius:8px;padding:0.65rem;">
          <div style="font-size:0.7rem;color:var(--text-muted);font-weight:700;">DISTANCE & ETA</div>
          <div style="font-weight:800;font-size:0.9rem;">${Number(b.deliveryDistanceKm || 0)} KM · Rem: ${Number(b.distanceRemainingKm ?? b.deliveryDistanceKm ?? 0)} KM</div>
          <div style="font-size:0.74rem;color:var(--text-muted);">${esc(b.estimatedTravelTime || 'ETA not computed')}</div>
        </div>
        <div style="background:#f8fafc;border:1px solid var(--border-subtle);border-radius:8px;padding:0.65rem;">
          <div style="font-size:0.7rem;color:var(--text-muted);font-weight:700;">CURRENT STAGE</div>
          <div style="font-weight:800;font-size:0.9rem;color:${isException ? '#b91c1c' : '#1d4ed8'};">${esc(currentStage)}</div>
          <div style="font-size:0.74rem;color:var(--text-muted);">Due: ${formatINR(b.dueAmount)} (${esc(b.paymentStatus)})</div>
        </div>
      </div>

      <div style="background:#ffffff;border:1px solid var(--border-subtle);border-radius:8px;padding:0.8rem;margin-bottom:0.9rem;">
        <div style="font-size:0.78rem;font-weight:800;color:#0f172a;margin-bottom:0.55rem;">7-STAGE DELIVERY TRACKING PROGRESS</div>
        <div style="display:grid;grid-template-columns:repeat(7,minmax(90px,1fr));gap:0.4rem;overflow-x:auto;">
          ${GAS_DELIVERY_PIPELINE_STAGES.map((st, idx) => {
            const done = currentIdx >= 0 && idx < currentIdx;
            const active = currentIdx === idx;
            const bg = active ? '#1d4ed8' : (done ? '#ecfdf5' : '#f8fafc');
            const bd = active ? '#1d4ed8' : (done ? '#10b981' : '#e2e8f0');
            const fg = active ? '#ffffff' : (done ? '#047857' : '#64748b');
            const entry = (b.deliveryTimeline || []).find(t => t.stage === st);
            return `
              <div style="background:${bg};border:1px solid ${bd};color:${fg};border-radius:6px;padding:0.45rem;text-align:center;">
                <div style="font-size:0.68rem;font-weight:800;">${done ? '✓ ' : ''}${idx + 1}.</div>
                <div style="font-size:0.71rem;font-weight:700;line-height:1.2;margin-top:2px;">${esc(st)}</div>
                ${entry ? `<div style="font-size:0.63rem;opacity:0.85;margin-top:2px;">${esc(String(entry.timestamp).slice(11, 16))}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
        ${isException ? `<div style="margin-top:0.55rem;padding:0.45rem 0.65rem;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:6px;font-size:0.78rem;font-weight:700;">Exception / Hold Status: ${esc(currentStage)}</div>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:0.85rem;margin-bottom:0.9rem;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;flex-wrap:wrap;gap:0.35rem;">
            <strong style="font-size:0.82rem;color:#0b3b8c;">Live Route &amp; Pin Map</strong>
            <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.captureGasDriverGpsForBooking('${esc(b.id)}')">Capture My Device GPS</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.saveCurrentGpsToCustomerProfile('${esc(b.gasCustomerId)}', '${esc(b.id)}')">📍 Save Current GPS to Customer Profile</button>
              <a href="${esc(navUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="text-decoration:none;">🧭 Navigate to Doorstep ↗</a>
            </div>
          </div>
          <div id="gtrack-map-canvas" style="width:100%;height:265px;border-radius:8px;overflow:hidden;border:1px solid #bfdbfe;"></div>
          <div style="font-size:0.73rem;color:#475569;margin-top:0.4rem;">
            <strong>From:</strong> ${esc(mc.fullAddress || MAIN_CENTRE_DEFAULT.fullAddress)}<br>
            <strong>To:</strong> ${esc(b.deliveryAddressSnapshot || 'Customer address not specified')}
            ${b.liveDriverGps ? `<br><strong>Rider GPS:</strong> ${b.liveDriverGps.lat}, ${b.liveDriverGps.lng} (±${b.liveDriverGps.accuracyMeters || 0}m)` : ''}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:0.7rem;">
          <form onsubmit="window.MJK.submitGasTrackingStageUpdate(event)" style="background:#f8fafc;border:1px solid var(--border-subtle);border-radius:8px;padding:0.75rem;">
            <input type="hidden" id="gtrack-bkid" value="${esc(b.id)}">
            <strong style="display:block;font-size:0.8rem;margin-bottom:0.45rem;">Update Pipeline Stage & Remaining ETA</strong>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">
              <div>
                <label class="form-label" style="font-size:0.7rem;">Next Stage / Exception</label>
                <select id="gtrack-stage" class="form-control">
                  <optgroup label="Pipeline Stages">
                    ${GAS_DELIVERY_PIPELINE_STAGES.map(st => `<option value="${esc(st)}" ${currentStage === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
                  </optgroup>
                  <optgroup label="Exceptions">
                    ${GAS_EXCEPTION_STATUSES.map(st => `<option value="${esc(st)}" ${currentStage === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
                  </optgroup>
                </select>
              </div>
              <div>
                <label class="form-label" style="font-size:0.7rem;">Assign Rider</label>
                <select id="gtrack-rider" class="form-control">
                  <option value="">-- Keep / Unassigned --</option>
                  ${riders.map(p => `<option value="${esc(p.id)}" ${b.deliveryPersonId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                </select>
              </div>
              <div><label class="form-label" style="font-size:0.7rem;">Remaining KM</label><input id="gtrack-remkm" type="number" min="0" step="0.1" class="form-control" value="${Number(b.distanceRemainingKm ?? b.deliveryDistanceKm ?? 0)}"></div>
              <div><label class="form-label" style="font-size:0.7rem;">ETA Text</label><input id="gtrack-eta" type="text" class="form-control" placeholder="e.g., 15 mins" value="${esc(b.estimatedTravelTime || '')}"></div>
            </div>
            <div style="margin-bottom:0.5rem;"><input id="gtrack-note" type="text" class="form-control" placeholder="Stage update note (optional)"></div>
            <div style="display:flex;justify-content:space-between;gap:0.4rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.printGasBookingReceipt('${esc(b.id)}')">Print Receipt</button>
              <button type="submit" class="btn btn-primary btn-sm">Save Stage Update</button>
            </div>
          </form>

          <div style="background:#ffffff;border:1px solid var(--border-subtle);border-radius:8px;padding:0.7rem;max-height:145px;overflow-y:auto;">
            <strong style="display:block;font-size:0.78rem;margin-bottom:0.4rem;">Timeline Audit History (${timeline.length})</strong>
            ${timeline.length === 0 ? '<div style="font-size:0.75rem;color:var(--text-muted);">No timeline updates yet.</div>' : timeline.map(t => `
              <div style="font-size:0.74rem;padding:0.3rem 0;border-bottom:1px solid #f1f5f9;">
                <strong>${esc(t.stage)}</strong> <span style="color:var(--text-muted);">· ${esc(String(t.timestamp).replace('T', ' ').slice(0, 16))} · ${esc(t.actor || '')}</span>
                ${t.note ? `<div style="color:#475569;">${esc(t.note)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    openModal(`Live Order Tracking — ${b.bookingNo}`, html, null, 'modal-lg');

    setTimeout(async () => {
      const container = document.getElementById('gtrack-map-canvas');
      if (!container) return;
      const origin = await ensureMainCentreCoords();
      let encodedPolyline = b.routePolyline || '';
      const hasOrigin = Number.isFinite(Number(origin?.lat)) && Number.isFinite(Number(origin?.lng));
      const hasCust = Number.isFinite(Number(b.deliveryLat)) && Number.isFinite(Number(b.deliveryLng));

      if (!encodedPolyline && hasOrigin && hasCust) {
        const routeRes = await computeRoadRoute(
          { lat: origin.lat, lng: origin.lng },
          { lat: Number(b.deliveryLat), lng: Number(b.deliveryLng) }
        );
        if (routeRes.success) {
          encodedPolyline = routeRes.encodedPolyline || '';
          updateBookingLiveTracking(b.id, {
            routePolyline: encodedPolyline,
            estimatedTravelTime: b.estimatedTravelTime || routeRes.durationText,
            deliveryDistanceKm: b.deliveryDistanceKm || routeRes.distanceKm
          });
        }
      }

      await renderGasInteractiveMap(container, {
        origin: hasOrigin ? origin : null,
        customer: hasCust
          ? { name: b.customerName, address: b.deliveryAddressSnapshot, lat: Number(b.deliveryLat), lng: Number(b.deliveryLng) }
          : null,
        driver: b.liveDriverGps
          ? {
              name: b.deliveryPersonName || b.deliveryStaff || 'Delivery Rider',
              lat: b.liveDriverGps.lat,
              lng: b.liveDriverGps.lng,
              updatedAt: String(b.liveDriverGps.updatedAt || '').slice(11, 16)
            }
          : null,
        encodedPolyline,
        editableCustomerPin: false,
        heightPx: 265
      });
    }, 50);
  }

  async function submitGasTrackingStageUpdate(e) {
    e.preventDefault();
    const bookingId = document.getElementById('gtrack-bkid')?.value;
    const stage = document.getElementById('gtrack-stage')?.value;
    const riderId = document.getElementById('gtrack-rider')?.value;
    const remKm = document.getElementById('gtrack-remkm')?.value;
    const eta = document.getElementById('gtrack-eta')?.value;
    const note = document.getElementById('gtrack-note')?.value;

    try {
      const res = await updateGasBookingStatus(bookingId, stage, {
        deliveryPersonId: riderId || undefined,
        distanceRemainingKm: remKm,
        estimatedTravelTime: eta,
        note
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Order ${res.booking.bookingNo} updated to "${res.booking.deliveryStatus}"`, 'success');
      render();
      openGasOrderTrackingModal(bookingId);
    } catch (err) {
      showToast(err?.message || 'Failed to update order stage.', 'danger');
    }
  }

  async function captureGasDriverGpsForBooking(bookingId) {
    showToast('Capturing real device GPS location...', 'info');
    const loc = await requestBrowserCurrentLocation();
    if (!loc.success) {
      showToast(loc.message, 'danger');
      return;
    }
    const b = getGasBookingById(bookingId);
    const hasCust = b && Number.isFinite(Number(b.deliveryLat)) && Number.isFinite(Number(b.deliveryLng));
    let remKm;
    let eta;
    let poly;

    if (hasCust) {
      const routeRes = await computeRoadRoute(
        { lat: loc.lat, lng: loc.lng },
        { lat: Number(b.deliveryLat), lng: Number(b.deliveryLng) }
      );
      if (routeRes.success) {
        remKm = routeRes.distanceKm;
        eta = routeRes.durationText;
        poly = routeRes.encodedPolyline;
      }
    }

    const res = updateBookingLiveTracking(bookingId, {
      driverLat: loc.lat,
      driverLng: loc.lng,
      accuracyMeters: loc.accuracyMeters,
      ...(remKm !== undefined ? { distanceRemainingKm: remKm } : {}),
      ...(eta ? { estimatedTravelTime: eta } : {}),
      ...(poly ? { routePolyline: poly } : {})
    });
    if (!res.success) {
      showToast(res.message, 'danger');
      return;
    }
    showToast(`Rider GPS updated (${loc.lat}, ${loc.lng})`, 'success');
    render();
    openGasOrderTrackingModal(bookingId);
  }

  async function saveCurrentGpsToCustomerProfile(gasCustomerId, bookingId = '') {
    const cust = getGasCustomerById(gasCustomerId);
    if (!cust) {
      showToast('Customer profile not found for this order.', 'danger');
      return;
    }
    showToast(`Capturing doorstep GPS for ${cust.fullName}...`, 'info');
    const loc = await requestBrowserCurrentLocation();
    if (!loc.success) {
      showToast(loc.message, 'danger');
      return;
    }
    let label = `Doorstep GPS (${loc.lat}, ${loc.lng})`;
    let placeId = '';
    const rev = await reverseGeocodeGasCoords(loc.lat, loc.lng);
    if (rev.success && rev.result?.formattedAddress) {
      label = rev.result.formattedAddress;
      placeId = rev.result.placeId || '';
    }
    const res = updateGasCustomerCoordinates(gasCustomerId, {
      lat: loc.lat,
      lng: loc.lng,
      label,
      placeId,
      source: 'agent_doorstep_gps'
    });
    if (!res.success) {
      showToast(res.message, 'danger');
      return;
    }
    showToast(`Saved Doorstep GPS (${loc.lat}, ${loc.lng}) to ${cust.fullName}'s profile (±${loc.accuracyMeters}m)`, 'success');
    render();
    if (bookingId && document.getElementById('gtrack-map-canvas')) {
      openGasOrderTrackingModal(bookingId);
    }
  }

  function printGasBookingReceipt(bookingId) {
    const b = getGasBookingById(bookingId);
    if (!b) return;
    showA4PrintPdfPopup({
      title: `LPG Delivery Receipt — ${b.bookingNo}`,
      subtitle: `MUN COMPUTER · ${b.customerName}`,
      defaultFormat: 'a4-portrait',
      bodyHtml: buildGasBookingReceiptHtml(b)
    });
  }

  /* =====================================================================
     ELIGIBILITY RULE & SUBSIDY MODALS
     ===================================================================== */

  function openGasEligibilityRuleModal() {
    const settings = getGasSettings();
    const html = `
      <form onsubmit="window.MJK.submitGasEligibilityRuleForm(event)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.85rem;">
          <div><label class="form-label">Rule Name *</label><input id="gelig-name" type="text" required class="form-control" placeholder="e.g., Domestic 45-Day Reminder"></div>
          <div>
            <label class="form-label">Gas Company</label>
            <select id="gelig-comp" class="form-control">
              <option value="All">All Companies</option>
              ${(settings.gasCompanies || []).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Connection Category</label>
            <select id="gelig-cat" class="form-control">
              <option value="All">All Categories</option>
              ${(settings.connectionCategories || []).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Reminder Interval Days *</label><input id="gelig-days" type="number" min="1" max="365" value="30" required class="form-control"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Tracking Rule</button>
        </div>
      </form>
    `;
    openModal('Add Administrative Booking Reminder Rule', html, null);
  }

  async function submitGasEligibilityRuleForm(e) {
    e.preventDefault();
    try {
      const res = await saveGasEligibilityRule({
        ruleName: document.getElementById('gelig-name')?.value,
        gasCompany: document.getElementById('gelig-comp')?.value,
        connectionCategory: document.getElementById('gelig-cat')?.value,
        intervalDays: document.getElementById('gelig-days')?.value
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Saved tracking rule (${res.rule.intervalDays} days).`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save tracking rule.', 'danger');
    }
  }

  function handleGasSubsidyAutoPreview(custChanged = false) {
    const custId = document.getElementById('gsub-cust')?.value || '';
    const bkId = document.getElementById('gsub-bk')?.value || '';
    const actVal = Number(document.getElementById('gsub-act')?.value) || 0;
    const brefVal = document.getElementById('gsub-bref')?.value || '';
    const cust = custId ? getGasCustomerById(custId) : null;
    const bk = bkId ? getGasBookingById(bkId) : null;

    if (custChanged && cust) {
      const maskEl = document.getElementById('gsub-mask');
      if (maskEl && !maskEl.value && cust.maskedAccount) {
        maskEl.value = cust.maskedAccount;
      }
    }

    const baseDate = bk?.bookingDate || document.getElementById('gsub-bk-date')?.value || getTodayDate();
    const auto = computeAutoSubsidyFields({
      bookingDate: baseDate,
      actualCredited: actVal,
      bankReference: brefVal,
      subsidyEligible: cust?.subsidyEligible || 'Yes'
    });

    const previewEl = document.getElementById('gsub-auto-preview');
    if (previewEl) {
      const toneBg = auto.dbtStatus === 'Credited' ? '#ecfdf5' : (auto.dbtStatus === 'Failed' || auto.dbtStatus === 'Not Applicable' ? '#fef2f2' : '#fffbeb');
      const toneFg = auto.dbtStatus === 'Credited' ? '#047857' : (auto.dbtStatus === 'Failed' || auto.dbtStatus === 'Not Applicable' ? '#b91c1c' : '#b45309');
      const toneBd = auto.dbtStatus === 'Credited' ? '#a7f3d0' : (auto.dbtStatus === 'Failed' || auto.dbtStatus === 'Not Applicable' ? '#fecaca' : '#fde68a');
      previewEl.style.background = toneBg;
      previewEl.style.borderColor = toneBd;
      previewEl.style.color = toneFg;
      previewEl.innerHTML = `
        <div><strong>Auto DBT Credit Date (Booking + 7 Days):</strong> <span class="font-mono">${esc(formatDate(auto.dbtCreditDate))}</span> <span style="opacity:0.8;">(Base Booking Date: ${esc(formatDate(auto.bookingDate))})</span></div>
        <div style="margin-top:0.25rem;"><strong>Auto-Determined DBT Status:</strong> <span style="font-weight:800;text-decoration:underline;">${esc(auto.dbtStatus)}</span></div>
      `;
    }
  }

  function openGasSubsidyModal(editId = '') {
    const s = editId ? getAllGasSubsidies().find(x => x.id === editId) : null;
    const customers = getAllGasCustomers();
    const bookings = getAllGasBookings().filter(b => !isBookingCancelledStatus(b.deliveryStatus));
    const selCust = s?.gasCustomerId ? getGasCustomerById(s.gasCustomerId) : null;
    const selBk = s?.bookingId ? getGasBookingById(s.bookingId) : null;
    const initBaseDate = selBk?.bookingDate || s?.bookingDate || getTodayDate();
    const initAuto = computeAutoSubsidyFields({
      bookingDate: initBaseDate,
      actualCredited: s?.actualCredited ?? 0,
      bankReference: s?.bankReference || '',
      subsidyEligible: selCust?.subsidyEligible || 'Yes'
    });

    const html = `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;padding:0.6rem 0.75rem;border-radius:var(--radius-md);font-size:0.78rem;margin-bottom:0.85rem;">
        ${esc(SUBSIDY_SECURITY_NOTICE)}
      </div>
      <form onsubmit="window.MJK.submitGasSubsidyForm(event)">
        <input type="hidden" id="gsub-id" value="${esc(s?.id || '')}">
        <input type="hidden" id="gsub-bk-date" value="${esc(initBaseDate)}">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.75rem;margin-bottom:0.85rem;">
          <div>
            <label class="form-label">Gas Customer <span class="req">*</span></label>
            <select id="gsub-cust" class="form-control" required onchange="window.MJK.handleGasSubsidyAutoPreview(true)">
              <option value="">-- Select Customer --</option>
              ${customers.map(c => `<option value="${esc(c.id)}" ${s?.gasCustomerId === c.id ? 'selected' : ''}>${esc(c.fullName)} (${esc(c.consumerId || c.mobile)})</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Linked Booking (Optional)</label>
            <select id="gsub-bk" class="form-control" onchange="window.MJK.handleGasSubsidyAutoPreview()">
              <option value="">-- Standalone (Uses Today) --</option>
              ${bookings.map(b => `<option value="${esc(b.id)}" ${s?.bookingId === b.id ? 'selected' : ''}>${esc(b.bookingNo)} · ${esc(b.customerName)} (${esc(b.bookingDate)})</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Expected Subsidy (₹)</label><input id="gsub-exp" type="number" min="0" step="0.01" value="${s?.expectedSubsidy ?? 0}" class="form-control"></div>
          <div><label class="form-label">Actual Verified Credited (₹)</label><input id="gsub-act" type="number" min="0" step="0.01" value="${s?.actualCredited ?? 0}" class="form-control" oninput="window.MJK.handleGasSubsidyAutoPreview()"></div>
          <div><label class="form-label">Bank Reference / UTR</label><input id="gsub-bref" type="text" value="${esc(s?.bankReference || '')}" class="form-control font-mono" oninput="window.MJK.handleGasSubsidyAutoPreview()"></div>
          <div><label class="form-label">Masked Account Last 4</label><input id="gsub-mask" type="text" maxlength="8" placeholder="XXXX1234" value="${esc(s?.maskedBankLast4 || selCust?.maskedAccount || '')}" class="form-control font-mono"></div>
        </div>
        <div id="gsub-auto-preview" style="background:#fffbeb;border:1px solid #fde68a;color:#b45309;border-radius:var(--radius-md);padding:0.65rem 0.85rem;font-size:0.8rem;margin-bottom:0.85rem;">
          <div><strong>Auto DBT Credit Date (Booking + 7 Days):</strong> <span class="font-mono">${esc(formatDate(initAuto.dbtCreditDate))}</span> <span style="opacity:0.8;">(Base Booking Date: ${esc(formatDate(initAuto.bookingDate))})</span></div>
          <div style="margin-top:0.25rem;"><strong>Auto-Determined DBT Status:</strong> <span style="font-weight:800;text-decoration:underline;">${esc(initAuto.dbtStatus)}</span></div>
        </div>
        <div style="margin-bottom:1rem;"><label class="form-label">Remarks</label><input id="gsub-remarks" type="text" class="form-control" value="${esc(s?.remarks || '')}"></div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${s ? 'Update DBT Record' : 'Save DBT Record'}</button>
        </div>
      </form>
    `;
    openModal(s ? `Update Subsidy / DBT (${s.id})` : 'Log Subsidy / DBT Tracking', html, null, 'modal-lg');
    handleGasSubsidyAutoPreview(false);
  }

  async function submitGasSubsidyForm(e) {
    e.preventDefault();
    try {
      const res = await saveGasSubsidy({
        id: document.getElementById('gsub-id')?.value || '',
        gasCustomerId: document.getElementById('gsub-cust')?.value,
        bookingId: document.getElementById('gsub-bk')?.value,
        bookingDate: document.getElementById('gsub-bk-date')?.value,
        expectedSubsidy: document.getElementById('gsub-exp')?.value,
        actualCredited: document.getElementById('gsub-act')?.value,
        bankReference: document.getElementById('gsub-bref')?.value,
        maskedBankLast4: document.getElementById('gsub-mask')?.value,
        remarks: document.getElementById('gsub-remarks')?.value
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Saved DBT Subsidy ${res.subsidy.id} · Status: ${res.subsidy.dbtStatus} · Credit Date: ${formatDate(res.subsidy.dbtCreditDate)}`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save subsidy record.', 'danger');
    }
  }

  /* =====================================================================
     NON-TAKER SUBSIDY DUE LEDGER MODALS
     ===================================================================== */

  function openGasNonTakerModal() {
    const customers = getAllGasCustomers();
    const settings = getGasSettings();
    const presets = settings.nonTakerReferencePresets || [120, 130];
    const html = `
      <div style="background:#fffbeb;border:1px solid #fde68a;color:#78350f;padding:0.65rem 0.75rem;border-radius:var(--radius-md);font-size:0.78rem;margin-bottom:0.85rem;">
        ${esc(NON_TAKER_ACCOUNTING_NOTICE)}
      </div>
      <form onsubmit="window.MJK.submitGasNonTakerForm(event)">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.75rem;margin-bottom:0.85rem;">
          <div>
            <label class="form-label">Gas Customer *</label>
            <select id="gnt-cust" class="form-control" required>
              <option value="">-- Select Customer --</option>
              ${customers.map(c => `<option value="${esc(c.id)}">${esc(c.fullName)} (${esc(c.consumerId)})</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Entry Date *</label><input id="gnt-date" type="date" value="${esc(getTodayDate())}" required class="form-control"></div>
          <div>
            <label class="form-label">Reference Preset</label>
            <select id="gnt-preset" class="form-control" onchange="if(this.value !== 'Custom') document.getElementById('gnt-adv').value = this.value;">
              ${presets.map(p => `<option value="${p}">₹${p} Preset</option>`).join('')}
              <option value="Custom">Custom Amount</option>
            </select>
          </div>
          <div><label class="form-label">Actual Authorized Advance (₹) *</label><input id="gnt-adv" type="number" min="1" step="0.01" value="${presets[0] || 120}" required class="form-control"></div>
          <div><label class="form-label">Initial Recovery Now (₹)</label><input id="gnt-initrec" type="number" min="0" step="0.01" value="0" class="form-control"></div>
          <div>
            <label class="form-label">Payment Mode (if Initial Rec)</label>
            <select id="gnt-pmode" class="form-control">${GAS_PAYMENT_MODES.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select>
          </div>
        </div>
        <div style="margin-bottom:0.75rem;"><label class="form-label">Authorization / Consent Note *</label><input id="gnt-authnote" type="text" required class="form-control" value="Customer requested authorized counter advance"></div>
        <label style="display:flex;align-items:center;gap:0.45rem;font-size:0.82rem;margin-bottom:1rem;">
          <input id="gnt-consent" type="checkbox" required> I confirm this is an actual authorized advance given with explicit customer consent.
        </label>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Ledger Entry</button>
        </div>
      </form>
    `;
    openModal('New Authorized Advance Ledger (Non-Taker)', html, null, 'modal-lg');
  }

  async function submitGasNonTakerForm(e) {
    e.preventDefault();
    try {
      const res = await createNonTakerLedger({
        gasCustomerId: document.getElementById('gnt-cust')?.value,
        entryDate: document.getElementById('gnt-date')?.value,
        referencePreset: document.getElementById('gnt-preset')?.value,
        actualAuthorizedAdvance: document.getElementById('gnt-adv')?.value,
        initialRecovery: document.getElementById('gnt-initrec')?.value,
        paymentMode: document.getElementById('gnt-pmode')?.value,
        authorizationNote: document.getElementById('gnt-authnote')?.value,
        consentConfirmed: Boolean(document.getElementById('gnt-consent')?.checked)
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Created Advance Ledger ${res.ledger.id} (Outstanding: ${formatINR(res.ledger.outstandingAmount)})`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to create advance ledger.', 'danger');
    }
  }

  function openGasNonTakerRecoveryModal(ledgerId) {
    const l = getNonTakerLedgerById(ledgerId);
    if (!l) return;
    const html = `
      <form onsubmit="window.MJK.submitGasNonTakerRecoveryForm(event)">
        <input type="hidden" id="gntr-id" value="${esc(l.id)}">
        <div style="margin-bottom:0.85rem;padding:0.7rem;background:var(--surface-alt);border-radius:var(--radius-md);font-size:0.84rem;">
          <strong>${esc(l.customerName)}</strong> (${esc(l.consumerId)}) · Advance: ${formatINR(l.actualAuthorizedAdvance)} · Recovered: ${formatINR(l.totalRecovery)} · <strong>Outstanding: ${formatINR(l.outstandingAmount)}</strong>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.85rem;">
          <div><label class="form-label">Recovery Amount (₹) *</label><input id="gntr-amt" type="number" min="1" max="${l.outstandingAmount}" step="0.01" value="${l.outstandingAmount}" required class="form-control"></div>
          <div><label class="form-label">Date *</label><input id="gntr-date" type="date" value="${esc(getTodayDate())}" required class="form-control"></div>
          <div><label class="form-label">Payment Mode</label><select id="gntr-mode" class="form-control">${GAS_PAYMENT_MODES.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select></div>
          <div><label class="form-label">Transaction Ref / UTR</label><input id="gntr-ref" type="text" class="form-control font-mono"></div>
        </div>
        <div style="margin-bottom:1rem;"><label class="form-label">Remarks</label><input id="gntr-rem" type="text" class="form-control"></div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Record Recovery</button>
        </div>
      </form>
    `;
    openModal(`Recover Advance (${l.id})`, html, null);
  }

  async function submitGasNonTakerRecoveryForm(e) {
    e.preventDefault();
    try {
      const res = await recordNonTakerRecovery({
        ledgerId: document.getElementById('gntr-id')?.value,
        amount: document.getElementById('gntr-amt')?.value,
        collectionDate: document.getElementById('gntr-date')?.value,
        paymentMode: document.getElementById('gntr-mode')?.value,
        transactionRef: document.getElementById('gntr-ref')?.value,
        remarks: document.getElementById('gntr-rem')?.value
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Recorded Recovery. New Outstanding: ${formatINR(res.ledger.outstandingAmount)}`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to record recovery.', 'danger');
    }
  }

  function openGasNonTakerHistoryModal(ledgerId) {
    const l = getNonTakerLedgerById(ledgerId);
    if (!l) return;
    const canRev = canPerformGasAction('reverse', 'gas-non-taker');
    const html = `
      <div style="margin-bottom:0.85rem;font-size:0.84rem;">
        <strong>${esc(l.customerName)}</strong> · Advance: ${formatINR(l.actualAuthorizedAdvance)} · Recovered: ${formatINR(l.totalRecovery)} · Outstanding: <strong>${formatINR(l.outstandingAmount)}</strong>
      </div>
      ${(l.recoveries || []).length === 0 ? '<p style="color:var(--text-muted);font-size:0.84rem;">No recoveries recorded yet.</p>' : `
        <table class="data-table">
          <thead><tr><th>ID</th><th>Date</th><th>Mode / Ref</th><th style="text-align:right;">Amount</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${l.recoveries.map(r => `
              <tr>
                <td class="font-mono">${esc(r.id)}</td>
                <td>${esc(formatDate(r.date))}</td>
                <td>${esc(r.paymentMode)} ${r.transactionRef ? `· ${esc(r.transactionRef)}` : ''}</td>
                <td style="text-align:right;">${formatINR(r.amount)}</td>
                <td>${r.reversed ? 'Reversed' : 'Active'}</td>
                <td>${(!r.reversed && canRev) ? `<button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.reverseGasNonTakerRecoveryConfirm('${esc(l.id)}', '${esc(r.id)}')">Reverse</button>` : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    `;
    openModal(`Recovery History (${l.id})`, html, null, 'modal-lg');
  }

  function reverseGasNonTakerRecoveryConfirm(ledgerId, recoveryId) {
    showConfirmDialog(
      'Reverse Recovery Entry?',
      'Admin reversal will restore Outstanding Due on the ledger and mark the linked collection receipt as Reversed.',
      () => {
        const res = reverseNonTakerRecovery(ledgerId, recoveryId, 'Admin-approved recovery reversal');
        if (!res.success) {
          showToast(res.message, 'danger');
          return;
        }
        showToast('Recovery entry reversed with audit log.', 'success');
        closeModal();
        render();
      }
    );
  }

  /* =====================================================================
     GAS COLLECTIONS & PRINT RECEIPT
     ===================================================================== */

  function openGasCollectionModal(_editId = '', prefill = {}) {
    const customers = getAllGasCustomers();
    const html = `
      <form onsubmit="window.MJK.submitGasCollectionForm(event)">
        <input type="hidden" id="gcol-bk" value="${esc(prefill.bookingId || '')}">
        <input type="hidden" id="gcol-srv" value="${esc(prefill.serviceEntryId || '')}">
        <input type="hidden" id="gcol-nt" value="${esc(prefill.nonTakerLedgerId || '')}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.85rem;">
          <div>
            <label class="form-label">Gas Customer (Optional for Walk-In)</label>
            <select id="gcol-cust" class="form-control">
              <option value="">-- Walk-In / Select Customer --</option>
              ${customers.map(c => `<option value="${esc(c.id)}" ${prefill.gasCustomerId === c.id ? 'selected' : ''}>${esc(c.fullName)} (${esc(c.consumerId)})</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Walk-In Customer Name (if blank above)</label><input id="gcol-cname" type="text" class="form-control"></div>
          <div>
            <label class="form-label">Collection Category *</label>
            <select id="gcol-cat" class="form-control" required>
              ${GAS_COLLECTION_CATEGORIES.map(c => `<option value="${esc(c)}" ${(prefill.category || 'Gas Booking Payment') === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Collection Date *</label><input id="gcol-date" type="date" value="${esc(getTodayDate())}" required class="form-control"></div>
          <div><label class="form-label">Amount (₹) *</label><input id="gcol-amt" type="number" min="1" step="0.01" value="${prefill.amount || ''}" required class="form-control"></div>
          <div>
            <label class="form-label">Payment Mode</label>
            <select id="gcol-mode" class="form-control">${GAS_PAYMENT_MODES.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select>
          </div>
          <div><label class="form-label">Transaction Reference / UTR</label><input id="gcol-ref" type="text" class="form-control font-mono" placeholder="Duplicate check enforced"></div>
          <div><label class="form-label">Remarks</label><input id="gcol-rem" type="text" class="form-control"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Record Collection</button>
        </div>
      </form>
    `;
    openModal('Record Gas Collection & Payment', html, null);
  }

  async function submitGasCollectionForm(e) {
    e.preventDefault();
    try {
      const res = await recordGasCollection({
        gasCustomerId: document.getElementById('gcol-cust')?.value,
        customerName: document.getElementById('gcol-cname')?.value,
        category: document.getElementById('gcol-cat')?.value,
        collectionDate: document.getElementById('gcol-date')?.value,
        amount: document.getElementById('gcol-amt')?.value,
        paymentMode: document.getElementById('gcol-mode')?.value,
        transactionRef: document.getElementById('gcol-ref')?.value,
        remarks: document.getElementById('gcol-rem')?.value,
        bookingId: document.getElementById('gcol-bk')?.value,
        serviceEntryId: document.getElementById('gcol-srv')?.value,
        nonTakerLedgerId: document.getElementById('gcol-nt')?.value
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      const rcpt = res.collection?.receiptNo || res.ledger?.id || 'Receipt';
      showToast(`Recorded ${rcpt} successfully.`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to record collection.', 'danger');
    }
  }

  function reverseGasCollectionPrompt(id) {
    showConfirmDialog(
      'Admin Approval: Reverse Collection?',
      'This will mark the receipt Reversed, roll back linked Booking/Service due balances, and write an audit log entry.',
      () => {
        const res = reverseGasCollection(id, 'Admin-approved reversal');
        if (!res.success) {
          showToast(res.message, 'danger');
          return;
        }
        showToast(`Collection ${res.collection.receiptNo} reversed.`, 'success');
        render();
      }
    );
  }

  function printGasCollectionReceipt(id) {
    const col = getAllGasCollections().find(c => c.id === id || c.receiptNo === id);
    if (!col) return;
    showA4PrintPdfPopup({
      title: `Gas Receipt — ${col.receiptNo}`,
      subtitle: `MUN COMPUTER · ${col.customerName}`,
      defaultFormat: 'a5-portrait',
      bodyHtml: buildGasCollectionReceiptHtml(col)
    });
  }

  /* =====================================================================
     ACCESSORIES, HARDWARE STORAGE & SUPPLIERS MODALS
     ===================================================================== */

  function openGasInventoryItemModal(editId = '') {
    const item = editId ? getAllInventory().find(i => i.id === editId) : null;
    const cats = getInventoryCategories(item?.category || '');
    const warehouses = getAllGasWarehouses();
    const html = `
      <form onsubmit="window.MJK.submitGasInventoryItemForm(event)">
        <input type="hidden" id="ginv-id" value="${esc(item?.id || '')}">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.75rem;margin-bottom:0.85rem;">
          <div><label class="form-label">SKU Code (Auto Global SL if blank)</label><input id="ginv-sku" type="text" class="form-control font-mono" value="${esc(item?.sku || '')}" placeholder="Auto-assigned on save"></div>
          <div><label class="form-label">Product Name *</label><input id="ginv-name" type="text" required class="form-control" value="${esc(item?.name || '')}"></div>
          <div>
            <label class="form-label">Category *</label>
            <select id="ginv-cat" class="form-control">
              ${cats.map(c => `<option value="${esc(c)}" ${(item?.category || cats[0]) === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Brand</label><input id="ginv-brand" type="text" class="form-control" value="${esc(item?.brand || '')}"></div>
          <div><label class="form-label">Unit (Pcs / Meter / Set)</label><input id="ginv-unit" type="text" class="form-control" value="${esc(item?.unit || 'Pcs')}"></div>
          <div><label class="form-label">Stock Quantity</label><input id="ginv-qty" type="number" min="0" value="${item?.stockQuantity ?? 0}" class="form-control"></div>
          <div><label class="form-label">Min Reorder Alert</label><input id="ginv-min" type="number" min="0" value="${item?.minStockLevel ?? 5}" class="form-control"></div>
          <div><label class="form-label">Cost Price (₹)</label><input id="ginv-cost" type="number" min="0" step="0.01" value="${item?.costPrice ?? 0}" class="form-control"></div>
          <div><label class="form-label">Selling Price (₹)</label><input id="ginv-sell" type="number" min="0" step="0.01" value="${item?.sellingPrice ?? 0}" class="form-control"></div>
          <div>
            <label class="form-label">Warehouse / Storage</label>
            <select id="ginv-wh" class="form-control">
              <option value="Main Counter" ${(item?.warehouseName || 'Main Counter') === 'Main Counter' ? 'selected' : ''}>Main Counter</option>
              <option value="Gas Godown / Store Room" ${item?.warehouseName === 'Gas Godown / Store Room' ? 'selected' : ''}>Gas Godown / Store Room</option>
              ${warehouses.map(w => `<option value="${esc(w.name)}" ${item?.warehouseName === w.name ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Rack / Shelf</label><input id="ginv-rack" type="text" class="form-control" value="${esc(item?.rackShelf || item?.shelfLocation || 'Gas Rack A1')}"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${item ? 'Update SKU' : 'Add Accessory SKU'}</button>
        </div>
      </form>
    `;
    openModal(item ? `Edit SKU (${item.sku})` : 'Add Gas Hardware / Accessory SKU', html, null, 'modal-lg');
  }

  async function submitGasInventoryItemForm(e) {
    e.preventDefault();
    try {
      const res = await saveInventoryItem({
        id: document.getElementById('ginv-id')?.value || '',
        sku: document.getElementById('ginv-sku')?.value,
        name: document.getElementById('ginv-name')?.value,
        category: document.getElementById('ginv-cat')?.value,
        brand: document.getElementById('ginv-brand')?.value,
        unit: document.getElementById('ginv-unit')?.value,
        stockQuantity: document.getElementById('ginv-qty')?.value,
        minStockLevel: document.getElementById('ginv-min')?.value,
        costPrice: document.getElementById('ginv-cost')?.value,
        sellingPrice: document.getElementById('ginv-sell')?.value,
        warehouseName: document.getElementById('ginv-wh')?.value,
        rackShelf: document.getElementById('ginv-rack')?.value,
        shelfLocation: document.getElementById('ginv-rack')?.value
      });
      if (!res.success) {
        showToast('Failed to save SKU.', 'danger');
        return;
      }
      showToast(`Saved ${res.item.name} (Stock: ${res.item.stockQuantity})`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save SKU.', 'danger');
    }
  }

  function openGasAccessorySaleModal(productId = '') {
    const inv = getAllInventory();
    const customers = getAllGasCustomers();
    const selected = productId ? inv.find(i => i.id === productId) : inv[0];
    const html = `
      <form onsubmit="window.MJK.submitGasAccessorySaleForm(event)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.85rem;">
          <div>
            <label class="form-label">Accessory / Product *</label>
            <select id="gsale-prd" class="form-control" required onchange="const o=this.options[this.selectedIndex]; document.getElementById('gsale-price').value=o.dataset.price||0;">
              <option value="">-- Select Product --</option>
              ${inv.map(i => `<option value="${esc(i.id)}" data-price="${Number(i.sellingPrice) || 0}" ${(selected?.id === i.id) ? 'selected' : ''}>${esc(i.name)} (Stock: ${i.stockQuantity} · ₹${i.sellingPrice})</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Quantity *</label><input id="gsale-qty" type="number" min="1" value="1" required class="form-control"></div>
          <div><label class="form-label">Unit Selling Price (₹)</label><input id="gsale-price" type="number" min="0" step="0.01" value="${selected?.sellingPrice || 0}" class="form-control"></div>
          <div><label class="form-label">Discount (₹)</label><input id="gsale-disc" type="number" min="0" step="0.01" value="0" class="form-control"></div>
          <div>
            <label class="form-label">Customer (Optional)</label>
            <select id="gsale-cust" class="form-control">
              <option value="">-- Walk-In Customer --</option>
              ${customers.map(c => `<option value="${esc(c.id)}">${esc(c.fullName)} (${esc(c.consumerId)})</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Walk-In Name (if blank above)</label><input id="gsale-cname" type="text" class="form-control" placeholder="Walk-In Retail Customer"></div>
          <div><label class="form-label">Payment Mode</label><select id="gsale-pmode" class="form-control">${GAS_PAYMENT_MODES.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select></div>
          <div><label class="form-label">Transaction Ref / UTR</label><input id="gsale-ref" type="text" class="form-control font-mono"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Complete Sale & Deduct Stock</button>
        </div>
      </form>
    `;
    openModal('Accessories & Retail Quick Sale', html, null);
  }

  async function submitGasAccessorySaleForm(e) {
    e.preventDefault();
    try {
      const res = await saveAccessoriesSale({
        productId: document.getElementById('gsale-prd')?.value,
        quantity: document.getElementById('gsale-qty')?.value,
        unitPrice: document.getElementById('gsale-price')?.value,
        discount: document.getElementById('gsale-disc')?.value,
        gasCustomerId: document.getElementById('gsale-cust')?.value,
        customerName: document.getElementById('gsale-cname')?.value,
        paymentMode: document.getElementById('gsale-pmode')?.value,
        transactionRef: document.getElementById('gsale-ref')?.value
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Sold ${res.quantity} x ${res.productName} (${formatINR(res.totalAmount)})`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to complete accessory sale.', 'danger');
    }
  }

  function openGasWarehouseModal() {
    const html = `
      <form onsubmit="window.MJK.submitGasWarehouseForm(event)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.85rem;">
          <div><label class="form-label">Location Name *</label><input id="gwh-name" type="text" required class="form-control" placeholder="e.g., Mamudpur Back Godown"></div>
          <div><label class="form-label">Location Type</label><input id="gwh-type" type="text" class="form-control" value="Store Room / Godown"></div>
          <div><label class="form-label">Rack Count</label><input id="gwh-racks" type="number" min="1" value="2" class="form-control"></div>
          <div><label class="form-label">Incharge Staff</label><input id="gwh-inc" type="text" class="form-control"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Location</button>
        </div>
      </form>
    `;
    openModal('Add Storage / Warehouse Location', html, null);
  }

  async function submitGasWarehouseForm(e) {
    e.preventDefault();
    try {
      const res = await saveGasWarehouse({
        name: document.getElementById('gwh-name')?.value,
        locationType: document.getElementById('gwh-type')?.value,
        rackCount: document.getElementById('gwh-racks')?.value,
        inchargeName: document.getElementById('gwh-inc')?.value
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Saved storage location "${res.warehouse.name}".`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save storage location.', 'danger');
    }
  }

  function openGasStockMovementModal() {
    const inv = getAllInventory();
    const warehouses = getAllGasWarehouses();
    const html = `
      <form onsubmit="window.MJK.submitGasStockMovementForm(event)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.85rem;">
          <div>
            <label class="form-label">Product SKU *</label>
            <select id="gmov-prd" class="form-control" required>
              ${inv.map(i => `<option value="${esc(i.id)}">${esc(i.name)} (${esc(i.sku)} · Stock: ${i.stockQuantity})</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Movement Type *</label>
            <select id="gmov-type" class="form-control" required>
              <option value="STOCK_IN">Stock In (+)</option>
              <option value="STOCK_OUT">Stock Out (-)</option>
              <option value="TRANSFER">Warehouse Transfer</option>
              <option value="DAMAGE">Damaged / Defective Write-off (-)</option>
            </select>
          </div>
          <div><label class="form-label">Quantity *</label><input id="gmov-qty" type="number" min="1" value="1" required class="form-control"></div>
          <div>
            <label class="form-label">Target Location (for Transfer / In)</label>
            <select id="gmov-to" class="form-control">
              <option value="Main Counter">Main Counter</option>
              <option value="Gas Godown / Store Room">Gas Godown / Store Room</option>
              ${warehouses.map(w => `<option value="${esc(w.name)}">${esc(w.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="margin-bottom:1rem;"><label class="form-label">Reason / Reference *</label><input id="gmov-reason" type="text" required class="form-control" placeholder="Manual verification / Transfer note / Damaged valve"></div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Record Movement</button>
        </div>
      </form>
    `;
    openModal('Record Hardware Stock Movement / Damage', html, null);
  }

  async function submitGasStockMovementForm(e) {
    e.preventDefault();
    try {
      const res = await recordGasStockMovement({
        productId: document.getElementById('gmov-prd')?.value,
        movementType: document.getElementById('gmov-type')?.value,
        quantity: document.getElementById('gmov-qty')?.value,
        toWarehouse: document.getElementById('gmov-to')?.value,
        reason: document.getElementById('gmov-reason')?.value
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Stock movement ${res.movement.id} recorded (New balance: ${res.movement.balanceAfter}).`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to record stock movement.', 'danger');
    }
  }

  function openGasSupplierModal(editId = '') {
    const s = editId ? getAllGasSuppliers().find(x => x.id === editId) : null;
    const html = `
      <form onsubmit="window.MJK.submitGasSupplierForm(event)">
        <input type="hidden" id="gsup-id" value="${esc(s?.id || '')}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.85rem;">
          <div><label class="form-label">Supplier Name *</label><input id="gsup-name" type="text" required class="form-control" value="${esc(s?.name || '')}"></div>
          <div><label class="form-label">Contact Person</label><input id="gsup-cp" type="text" class="form-control" value="${esc(s?.contactPerson || '')}"></div>
          <div><label class="form-label">Mobile Number</label><input id="gsup-mob" type="tel" class="form-control" value="${esc(s?.mobile || '')}"></div>
          <div><label class="form-label">GSTIN (Optional)</label><input id="gsup-gst" type="text" class="form-control font-mono" value="${esc(s?.gstin || '')}"></div>
        </div>
        <div style="margin-bottom:1rem;"><label class="form-label">Address</label><input id="gsup-addr" type="text" class="form-control" value="${esc(s?.address || '')}"></div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${s ? 'Update Supplier' : 'Add Supplier'}</button>
        </div>
      </form>
    `;
    openModal(s ? `Edit Supplier (${s.id})` : 'Add Hardware Supplier', html, null);
  }

  async function submitGasSupplierForm(e) {
    e.preventDefault();
    try {
      const res = await saveGasSupplier({
        id: document.getElementById('gsup-id')?.value || '',
        name: document.getElementById('gsup-name')?.value,
        contactPerson: document.getElementById('gsup-cp')?.value,
        mobile: document.getElementById('gsup-mob')?.value,
        gstin: document.getElementById('gsup-gst')?.value,
        address: document.getElementById('gsup-addr')?.value
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Saved Supplier ${res.supplier.name}.`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save supplier.', 'danger');
    }
  }

  function openGasPurchaseModal() {
    const suppliers = getAllGasSuppliers();
    const inv = getAllInventory();
    _purchaseLines.length = 0;
    if (inv.length > 0) {
      _purchaseLines.push({ productId: inv[0].id, quantity: 10, unitCost: Number(inv[0].costPrice) || 0 });
    }
    const html = `
      <form onsubmit="window.MJK.submitGasPurchaseForm(event)">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.75rem;margin-bottom:0.85rem;">
          <div>
            <label class="form-label">Supplier *</label>
            <select id="gpur-sup" class="form-control">
              <option value="">-- Enter Supplier Name Below --</option>
              ${suppliers.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Or Supplier Name</label><input id="gpur-supname" type="text" class="form-control" placeholder="If not in dropdown"></div>
          <div><label class="form-label">Supplier Bill No</label><input id="gpur-bill" type="text" class="form-control font-mono" placeholder="INV-001"></div>
          <div><label class="form-label">Purchase Date *</label><input id="gpur-date" type="date" value="${esc(getTodayDate())}" required class="form-control"></div>
        </div>
        <div style="border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:0.75rem;margin-bottom:0.85rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
            <strong style="font-size:0.84rem;">Purchase Items (Auto-adds to Stock)</strong>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.addGasPurchaseLineRow()">+ Add Line</button>
          </div>
          <div id="gpur-lines-box"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.75rem;margin-bottom:1rem;">
          <div><label class="form-label">GST Amount (₹)</label><input id="gpur-gst" type="number" min="0" step="0.01" value="0" class="form-control"></div>
          <div><label class="form-label">Other Charges (₹)</label><input id="gpur-other" type="number" min="0" step="0.01" value="0" class="form-control"></div>
          <div><label class="form-label">Amount Paid Now (₹)</label><input id="gpur-paid" type="number" min="0" step="0.01" value="0" class="form-control"></div>
          <div><label class="form-label">Payment Mode</label><select id="gpur-pmode" class="form-control">${GAS_PAYMENT_MODES.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Purchase & Add Stock</button>
        </div>
      </form>
    `;
    openModal('Record Hardware Supplier Purchase', html, null, 'modal-lg');
    renderPurchaseLinesDom();
  }

  function renderPurchaseLinesDom() {
    const box = document.getElementById('gpur-lines-box');
    if (!box) return;
    const inv = getAllInventory();
    if (inv.length === 0) {
      box.innerHTML = '<div style="font-size:0.82rem;color:#b91c1c;">No Inventory SKUs exist yet. Add at least one Accessory/Hardware SKU first.</div>';
      return;
    }
    box.innerHTML = _purchaseLines.map((ln, idx) => `
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:0.5rem;margin-bottom:0.45rem;align-items:center;">
        <select class="form-control" onchange="window.MJK.updateGasPurchaseLine(${idx}, 'productId', this.value)">
          ${inv.map(i => `<option value="${esc(i.id)}" ${ln.productId === i.id ? 'selected' : ''}>${esc(i.name)} (${esc(i.sku)})</option>`).join('')}
        </select>
        <input type="number" min="1" class="form-control" value="${ln.quantity}" placeholder="Qty" oninput="window.MJK.updateGasPurchaseLine(${idx}, 'quantity', this.value)">
        <input type="number" min="0" step="0.01" class="form-control" value="${ln.unitCost}" placeholder="Unit Cost ₹" oninput="window.MJK.updateGasPurchaseLine(${idx}, 'unitCost', this.value)">
        <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.removeGasPurchaseLine(${idx})">✕</button>
      </div>
    `).join('');
  }

  function addGasPurchaseLineRow() {
    const inv = getAllInventory();
    if (inv.length === 0) return;
    _purchaseLines.push({ productId: inv[0].id, quantity: 1, unitCost: Number(inv[0].costPrice) || 0 });
    renderPurchaseLinesDom();
  }

  function updateGasPurchaseLine(idx, field, val) {
    if (!_purchaseLines[idx]) return;
    _purchaseLines[idx][field] = field === 'productId' ? val : Number(val) || 0;
  }

  function removeGasPurchaseLine(idx) {
    _purchaseLines.splice(idx, 1);
    renderPurchaseLinesDom();
  }

  async function submitGasPurchaseForm(e) {
    e.preventDefault();
    try {
      const res = await saveGasPurchase({
        supplierId: document.getElementById('gpur-sup')?.value,
        supplierName: document.getElementById('gpur-supname')?.value,
        billNumber: document.getElementById('gpur-bill')?.value,
        purchaseDate: document.getElementById('gpur-date')?.value,
        items: [..._purchaseLines],
        gstAmount: document.getElementById('gpur-gst')?.value,
        otherCharges: document.getElementById('gpur-other')?.value,
        paidAmount: document.getElementById('gpur-paid')?.value,
        paymentMode: document.getElementById('gpur-pmode')?.value
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Purchase ${res.purchase.purchaseNo} saved & inventory incremented!`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save purchase.', 'danger');
    }
  }

  /* =====================================================================
     CUSTOMER SERVICE & REPLACEMENT ENTRY HANDLERS
     ===================================================================== */

  function handleGasServiceCustChange(custId) {
    const c = getGasCustomerById(custId);
    if (!c) return;
    const oldReg = document.getElementById('gsrv-old-reg');
    if (oldReg && !oldReg.value) {
      oldReg.placeholder = `Current ${c.gasCompany} regulator`;
    }
  }

  function handleGasServiceTypeChange(type) {
    const regBox = document.getElementById('gsrv-regulator-box');
    const pipeBox = document.getElementById('gsrv-pipe-box');
    const feeInput = document.getElementById('gsrv-chg-fee');
    const settings = getGasSettings();
    const charges = settings.defaultServiceCharges || {};

    if (regBox) regBox.style.display = (type === 'Regulator Change' || type === 'Both Regulator and Pipe Change') ? 'block' : 'none';
    if (pipeBox) pipeBox.style.display = (type === 'Gas Pipe Change' || type === 'Both Regulator and Pipe Change') ? 'block' : 'none';

    if (feeInput) {
      if (type === 'Regulator Change') feeInput.value = Number(charges.regulatorChange ?? 150);
      else if (type === 'Gas Pipe Change') feeInput.value = Number(charges.pipeChange ?? 100);
      else if (type === 'Both Regulator and Pipe Change') feeInput.value = Number(charges.bothChange ?? 200);
      else feeInput.value = Number(charges.otherService ?? 100);
    }
    recalcGasServiceTotals();
  }

  function handleGasServiceSkuPick(kind, selectEl) {
    const opt = selectEl?.options?.[selectEl.selectedIndex];
    const price = Number(opt?.dataset?.price) || 0;
    const brand = opt?.dataset?.brand || '';
    if (kind === 'reg') {
      const chg = document.getElementById('gsrv-chg-reg');
      const qty = Number(document.getElementById('gsrv-reg-qty')?.value) || 1;
      const newReg = document.getElementById('gsrv-new-reg');
      if (chg) chg.value = price * qty;
      if (newReg && opt?.value && !newReg.value) newReg.value = brand ? `${opt.text.split(' (')[0]} (${brand})` : opt.text.split(' (')[0];
    } else if (kind === 'pipe') {
      const chg = document.getElementById('gsrv-chg-pipe');
      const qty = Number(document.getElementById('gsrv-pipe-qty')?.value) || 1;
      const newPipe = document.getElementById('gsrv-new-pipe');
      if (chg) chg.value = price * qty;
      if (newPipe && opt?.value && !newPipe.value) newPipe.value = brand ? `${opt.text.split(' (')[0]} (${brand})` : opt.text.split(' (')[0];
    }
    recalcGasServiceTotals();
  }

  function recalcGasServiceTotals() {
    const calc = calculateServiceFinancials({
      regulatorCharge: document.getElementById('gsrv-chg-reg')?.value,
      pipeCharge: document.getElementById('gsrv-chg-pipe')?.value,
      otherCharge: document.getElementById('gsrv-chg-other')?.value,
      serviceFee: document.getElementById('gsrv-chg-fee')?.value,
      discount: document.getElementById('gsrv-discount')?.value,
      amountReceived: document.getElementById('gsrv-received')?.value
    });
    const totEl = document.getElementById('gsrv-total');
    const dueEl = document.getElementById('gsrv-due');
    if (totEl) totEl.value = calc.totalAmount;
    if (dueEl) dueEl.value = calc.dueAmount;
  }

  async function submitGasServiceEntry(e) {
    e.preventDefault();
    try {
      const res = await saveGasServiceEntry({
        gasCustomerId: document.getElementById('gsrv-cust')?.value,
        serviceDate: document.getElementById('gsrv-date')?.value,
        serviceType: document.getElementById('gsrv-type')?.value,
        technicianName: document.getElementById('gsrv-tech')?.value,
        complaintIssue: document.getElementById('gsrv-complaint')?.value,
        nextServiceDueDate: document.getElementById('gsrv-next-due')?.value,
        remarks: document.getElementById('gsrv-remarks')?.value,
        regulatorProductId: document.getElementById('gsrv-reg-sku')?.value,
        regulatorQty: document.getElementById('gsrv-reg-qty')?.value,
        previousRegulatorDetails: document.getElementById('gsrv-old-reg')?.value,
        newRegulatorDetails: document.getElementById('gsrv-new-reg')?.value,
        pipeProductId: document.getElementById('gsrv-pipe-sku')?.value,
        pipeQty: document.getElementById('gsrv-pipe-qty')?.value,
        previousPipeDetails: document.getElementById('gsrv-old-pipe')?.value,
        newPipeDetails: document.getElementById('gsrv-new-pipe')?.value,
        regulatorCharge: document.getElementById('gsrv-chg-reg')?.value,
        pipeCharge: document.getElementById('gsrv-chg-pipe')?.value,
        otherCharge: document.getElementById('gsrv-chg-other')?.value,
        serviceFee: document.getElementById('gsrv-chg-fee')?.value,
        discount: document.getElementById('gsrv-discount')?.value,
        amountReceived: document.getElementById('gsrv-received')?.value,
        paymentMode: document.getElementById('gsrv-pay-mode')?.value,
        transactionRef: document.getElementById('gsrv-txn-ref')?.value,
        allowNegativeOverride: Boolean(document.getElementById('gsrv-neg-override')?.checked)
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Saved Service ${res.entry.serviceId} & deducted linked inventory stock.`, 'success');
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save service entry.', 'danger');
    }
  }

  function reverseGasServicePrompt(serviceId) {
    showConfirmDialog(
      'Cancel Service Entry & Restore Stock?',
      `Admin cancellation of ${serviceId} will restore all deducted Regulator/Pipe inventory quantities and reverse linked service collections.`,
      async () => {
        try {
          const res = await reverseGasServiceEntry(serviceId, 'Admin cancellation with stock restoration');
          if (!res.success) {
            showToast(res.message, 'danger');
            return;
          }
          showToast(`Service ${serviceId} cancelled and inventory restored.`, 'success');
          render();
        } catch (err) {
          showToast(err?.message || 'Failed to reverse service entry.', 'danger');
        }
      }
    );
  }

  function printGasServiceReceipt(serviceId) {
    const entry = getGasServiceEntryById(serviceId);
    if (!entry) return;
    showA4PrintPdfPopup({
      title: `Service Receipt — ${entry.serviceId}`,
      subtitle: `MUN COMPUTER · ${entry.customerName}`,
      defaultFormat: 'a4-portrait',
      bodyHtml: buildGasServiceReceiptHtml(entry)
    });
  }

  async function exportGasServicePdf(serviceId) {
    const entry = getGasServiceEntryById(serviceId);
    if (!entry) return;
    await exportUniversalPDF({
      filename: `MUN_COMPUTER_Gas_Service_${entry.serviceId}`,
      title: `LPG SERVICE & REPLACEMENT REPORT (${entry.serviceId})`,
      subtitle: `${entry.customerName} | Consumer ID: ${entry.consumerId} | Date: ${formatDate(entry.serviceDate)} | Type: ${entry.serviceType}`,
      headers: ['Item / Component', 'Details / Brand', 'Qty', 'Amount (INR)'],
      rows: [
        ['Regulator', entry.newRegulatorDetails || entry.previousRegulatorDetails || '-', entry.regulatorQty || 0, entry.regulatorCharge],
        ['Gas Pipe / Hose', entry.newPipeDetails || entry.previousPipeDetails || '-', entry.pipeQty || 0, entry.pipeCharge],
        ['Other Charges', entry.complaintIssue || '-', 1, entry.otherCharge],
        ['Service Fee', `${entry.serviceType} (${entry.technicianName})`, 1, entry.serviceFee],
        ['Discount (-)', '-', 0, -Number(entry.discount || 0)],
        ['Amount Received', entry.paymentMode || 'Cash', 1, entry.amountReceived],
        ['Balance Due', entry.paymentStatus, 1, entry.dueAmount]
      ],
      totalsRow: ['NET TOTAL AMOUNT', '', '', entry.totalAmount],
      includeLegalTerms: true,
      includeAcknowledgement: true
    });
    showToast(`Downloaded PDF Service Report for ${entry.serviceId}`, 'success');
  }

  /* =====================================================================
     GAS REPORTS & SETTINGS HANDLERS
     ===================================================================== */

  async function exportGasReportDirect(reportKey, format = 'pdf', filters = {}) {
    const ds = buildGasReportDataset(reportKey, filters);
    if (format === 'print') {
      printUniversalReport({
        title: ds.title,
        subtitle: ds.subtitle,
        filename: ds.filename,
        headers: ds.headers,
        rows: ds.rows,
        totalsRow: ds.totalsRow
      });
    } else if (format === 'pdf') {
      await exportUniversalPDF({
        title: ds.title,
        subtitle: ds.subtitle,
        filename: ds.filename,
        headers: ds.headers,
        rows: ds.rows,
        totalsRow: ds.totalsRow
      });
      showToast(`Exported PDF: ${ds.title}`, 'success');
    } else if (format === 'excel') {
      exportUniversalExcel({
        title: ds.title,
        subtitle: ds.subtitle,
        filename: ds.filename,
        headers: ds.headers,
        rows: ds.rows,
        totalsRow: ds.totalsRow
      });
      showToast(`Exported Excel: ${ds.title}`, 'success');
    } else if (format === 'csv') {
      exportUniversalCSV({
        title: ds.title,
        subtitle: ds.subtitle,
        filename: ds.filename,
        headers: ds.headers,
        rows: ds.rows,
        totalsRow: ds.totalsRow
      });
      showToast(`Exported CSV: ${ds.title}`, 'success');
    }
  }

  function exportActiveGasReport(format = 'pdf') {
    const reportKey = AppState.gasReportKey || 'customer_master';
    exportGasReportDirect(reportKey, format, {
      dateFrom: AppState.gasReportDateFrom || '',
      dateTo: AppState.gasReportDateTo || '',
      search: AppState.gasReportSearch || ''
    });
  }

  function submitGasSettings(e) {
    e.preventDefault();
    if (!canPerformGasAction('settings', 'gas-settings')) {
      showToast('Permission Denied: Only Administration can update Gas Settings.', 'danger');
      return;
    }
    const splitCsv = (id) => String(document.getElementById(id)?.value || '').split(',').map(x => x.trim()).filter(Boolean);
    const numPresets = splitCsv('gset-nt-presets').map(x => Number(x)).filter(n => Number.isFinite(n) && n > 0);
    const customDays = Number(document.getElementById('gset-elig-custom')?.value) || Number(document.getElementById('gset-elig-days')?.value) || 30;
    const mcLatRaw = document.getElementById('gset-mc-lat')?.value;
    const mcLngRaw = document.getElementById('gset-mc-lng')?.value;
    const curMc = getGasSettings().mainCentre || MAIN_CENTRE_DEFAULT;

    const res = saveGasSettings({
      defaultEligibilityDays: customDays,
      nonTakerReferencePresets: numPresets.length > 0 ? numPresets : [120, 130],
      gasCompanies: splitCsv('gset-companies'),
      paymentMethods: splitCsv('gset-paymethods'),
      defaultPipeServiceCycleDays: Number(document.getElementById('gset-pipe-cycle')?.value) || 730,
      defaultServiceCharges: {
        regulatorChange: Number(document.getElementById('gset-fee-reg')?.value) || 0,
        pipeChange: Number(document.getElementById('gset-fee-pipe')?.value) || 0,
        bothChange: Number(document.getElementById('gset-fee-both')?.value) || 0,
        otherService: Number(document.getElementById('gset-fee-other')?.value) || 0
      },
      mainCentre: {
        ...curMc,
        name: document.getElementById('gset-mc-name')?.value?.trim() || 'MUN COMPUTER',
        fullAddress: document.getElementById('gset-mc-addr')?.value?.trim() || MAIN_CENTRE_DEFAULT.fullAddress,
        lat: mcLatRaw !== '' && Number.isFinite(Number(mcLatRaw)) ? Number(mcLatRaw) : null,
        lng: mcLngRaw !== '' && Number.isFinite(Number(mcLngRaw)) ? Number(mcLngRaw) : null
      },
      allowNegativeStockAdminOverride: Boolean(document.getElementById('gset-neg-override')?.checked),
      autoSyncCustomerDirectory: Boolean(document.getElementById('gset-sync-cust')?.checked)
    });
    if (!res.success) {
      showToast(res.message, 'danger');
      return;
    }
    showToast('Gas Settings & Main Centre saved successfully.', 'success');
    render();
  }

  async function geocodeGasMainCentre() {
    const addr = document.getElementById('gset-mc-addr')?.value?.trim() || MAIN_CENTRE_DEFAULT.geocodeQuery;
    showToast('Locating Main Centre on Google Maps...', 'info');
    const res = await geocodeGasAddress(addr);
    if (!res.success || !res.result) {
      showToast(res.message || 'Could not locate Main Centre address.', 'warning');
      return;
    }
    const latEl = document.getElementById('gset-mc-lat');
    const lngEl = document.getElementById('gset-mc-lng');
    if (latEl) latEl.value = res.result.lat;
    if (lngEl) lngEl.value = res.result.lng;
    const curMc = getGasSettings().mainCentre || MAIN_CENTRE_DEFAULT;
    saveGasSettings(
      {
        mainCentre: {
          ...curMc,
          name: document.getElementById('gset-mc-name')?.value?.trim() || curMc.name,
          fullAddress: addr,
          lat: res.result.lat,
          lng: res.result.lng,
          placeId: res.result.placeId || ''
        }
      },
      { allowMainCentreGeoSave: true }
    );
    showToast(`Main Centre Coordinates Saved: ${res.result.lat}, ${res.result.lng}`, 'success');
  }

  /* =====================================================================
     AGENCY, CYLINDER TYPE, PRICING RULES, DELIVERY AREA & RIDER CRUD
     ===================================================================== */

  function openGasAgencyQuickModal() {
    const agencies = getGasAgencies();
    const html = `
      <div style="margin-bottom:0.85rem;">
        <form onsubmit="window.MJK.submitGasAgencyForm(event)" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:0.75rem;">
          <input type="hidden" id="gag-id" value="">
          <input type="hidden" id="gag-quick-mode" value="1">
          <div style="display:grid;grid-template-columns:1.8fr 1fr 1fr auto;gap:0.5rem;align-items:end;">
            <div><label class="form-label" style="font-size:0.72rem;">Agency / Distributor Name *</label><input id="gag-name" type="text" required class="form-control" placeholder="e.g., MAMENPUR INDANE GRAMIN VITRAK"></div>
            <div><label class="form-label" style="font-size:0.72rem;">Company</label><input id="gag-comp" type="text" class="form-control" placeholder="Indane"></div>
            <div><label class="form-label" style="font-size:0.72rem;">Phone</label><input id="gag-phone" type="text" class="form-control"></div>
            <button type="submit" class="btn btn-primary btn-sm">+ Add Agency</button>
          </div>
          <input type="hidden" id="gag-code" value="">
          <input type="hidden" id="gag-addr" value="">
          <input type="checkbox" id="gag-active" checked style="display:none;">
        </form>
      </div>
      <div style="max-height:280px;overflow-y:auto;">
        <table class="data-table">
          <thead><tr><th>Agency Name</th><th>Company</th><th>Phone</th><th>Actions</th></tr></thead>
          <tbody>
            ${agencies.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No agencies yet.</td></tr>' : agencies.map(a => `
              <tr>
                <td><strong>${esc(a.name)}</strong></td>
                <td>${esc(a.company || '-')}</td>
                <td>${esc(a.phone || '-')}</td>
                <td>
                  <div style="display:flex;gap:0.3rem;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.openGasAgencyEditModal('${esc(a.id)}')">Edit</button>
                    <button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.MJK.deleteGasAgencyConfirm('${esc(a.id)}', true)">Delete</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    openModal('Manage LPG Agencies & Distributors', html, null, 'modal-lg');
  }

  function openGasAgencyEditModal(editId = '') {
    const a = editId ? getGasAgencies().find(x => x.id === editId) : null;
    const settings = getGasSettings();
    const html = `
      <form onsubmit="window.MJK.submitGasAgencyForm(event)">
        <input type="hidden" id="gag-id" value="${esc(a?.id || '')}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.85rem;">
          <div style="grid-column:span 2;"><label class="form-label">Agency / Distributor Name *</label><input id="gag-name" type="text" required class="form-control" placeholder="e.g., MAMENPUR INDANE GRAMIN VITRAK" value="${esc(a?.name || '')}"></div>
          <div>
            <label class="form-label">Gas Company</label>
            <select id="gag-comp" class="form-control">
              <option value="">-- Optional --</option>
              ${(settings.gasCompanies || ['Indane', 'HP Gas', 'Bharatgas']).map(co => `<option value="${esc(co)}" ${a?.company === co ? 'selected' : ''}>${esc(co)}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Distributor Code</label><input id="gag-code" type="text" class="form-control font-mono" value="${esc(a?.code || '')}"></div>
          <div><label class="form-label">Contact Phone</label><input id="gag-phone" type="text" class="form-control" value="${esc(a?.phone || '')}"></div>
          <div style="display:flex;align-items:center;padding-top:1.3rem;">
            <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.84rem;"><input id="gag-active" type="checkbox" ${a?.isActive !== false ? 'checked' : ''}> Active Agency</label>
          </div>
          <div style="grid-column:span 2;"><label class="form-label">Agency Office Address</label><input id="gag-addr" type="text" class="form-control" value="${esc(a?.address || '')}"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${a ? 'Update Agency' : 'Save Agency'}</button>
        </div>
      </form>
    `;
    openModal(a ? `Edit Agency (${a.name})` : 'Add LPG Agency / Distributor', html, null);
  }

  async function submitGasAgencyForm(e) {
    e.preventDefault();
    const isQuick = Boolean(document.getElementById('gag-quick-mode')?.value);
    try {
      const res = await saveGasAgency({
        id: document.getElementById('gag-id')?.value || '',
        name: document.getElementById('gag-name')?.value,
        company: document.getElementById('gag-comp')?.value,
        code: document.getElementById('gag-code')?.value,
        phone: document.getElementById('gag-phone')?.value,
        address: document.getElementById('gag-addr')?.value,
        isActive: document.getElementById('gag-active')?.checked !== false
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Saved Agency: ${res.agency.name}`, 'success');
      if (isQuick) {
        openGasAgencyQuickModal();
      } else {
        closeModal();
      }
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save agency.', 'danger');
    }
  }

  function deleteGasAgencyConfirm(id, reopenQuick = false) {
    showConfirmDialog(
      'Delete LPG Agency?',
      'Remove this agency from the master dropdown? Existing historical bookings keep their saved agency name.',
      () => {
        const res = deleteGasAgency(id);
        if (!res.success) {
          showToast(res.message, 'danger');
          return;
        }
        showToast('Agency deleted.', 'success');
        if (reopenQuick) openGasAgencyQuickModal();
        render();
      }
    );
  }

  function openGasCylinderTypeModal(editId = '') {
    const cy = editId ? getGasCylinderTypes().find(x => x.id === editId) : null;
    const html = `
      <form onsubmit="window.MJK.submitGasCylinderTypeForm(event)">
        <input type="hidden" id="gcyl-id" value="${esc(cy?.id || '')}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.85rem;">
          <div><label class="form-label">Cylinder Type Name *</label><input id="gcyl-name" type="text" required class="form-control" placeholder="e.g., 14.2 Kg / 5 Kg / 19 Kg" value="${esc(cy?.name || '')}"></div>
          <div><label class="form-label">Default Refill Price (₹) *</label><input id="gcyl-price" type="number" min="0" step="0.01" required class="form-control" value="${cy?.defaultPrice ?? 900}"></div>
        </div>
        <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.84rem;margin-bottom:1rem;"><input id="gcyl-active" type="checkbox" ${cy?.isActive !== false ? 'checked' : ''}> Active</label>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${cy ? 'Update Cylinder Type' : 'Save Cylinder Type'}</button>
        </div>
      </form>
    `;
    openModal(cy ? `Edit Cylinder Type (${cy.name})` : 'Add Cylinder Type', html, null);
  }

  async function submitGasCylinderTypeForm(e) {
    e.preventDefault();
    try {
      const res = await saveGasCylinderType({
        id: document.getElementById('gcyl-id')?.value || '',
        name: document.getElementById('gcyl-name')?.value,
        defaultPrice: document.getElementById('gcyl-price')?.value,
        isActive: Boolean(document.getElementById('gcyl-active')?.checked)
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Saved Cylinder Type: ${res.cylinderType.name}`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save cylinder type.', 'danger');
    }
  }

  function deleteGasCylinderTypeConfirm(id) {
    showConfirmDialog('Delete Cylinder Type?', 'Remove this cylinder type from Settings?', () => {
      const res = deleteGasCylinderType(id);
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast('Cylinder type removed.', 'success');
      render();
    });
  }

  function addGasPricingTierRow() {
    const tbody = document.getElementById('gpric-tiers-body');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.setAttribute('data-tier-row', '');
    tr.innerHTML = `
      <td><input type="text" class="form-control" data-tier-field="label" value="Custom Range"></td>
      <td><input type="number" min="0" step="0.1" class="form-control" data-tier-field="minKm" value="0"></td>
      <td><input type="number" min="0" step="0.1" class="form-control" data-tier-field="maxKm" value="5"></td>
      <td><input type="number" min="0" step="1" class="form-control" data-tier-field="charge" value="30"></td>
      <td><button type="button" class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">Remove</button></td>
    `;
    tbody.appendChild(tr);
  }

  function submitGasDeliveryPricingConfig(e) {
    e.preventDefault();
    if (!canPerformGasAction('settings', 'gas-settings')) {
      showToast('Permission Denied.', 'danger');
      return;
    }
    const rows = [...document.querySelectorAll('#gpric-tiers-body tr[data-tier-row]')];
    const distanceTiers = rows.map((tr, i) => ({
      id: `tier_${i + 1}`,
      label: tr.querySelector('[data-tier-field="label"]')?.value?.trim() || `Tier ${i + 1}`,
      minKm: Math.max(0, Number(tr.querySelector('[data-tier-field="minKm"]')?.value) || 0),
      maxKm: Math.max(0, Number(tr.querySelector('[data-tier-field="maxKm"]')?.value) || 0),
      charge: Math.max(0, Number(tr.querySelector('[data-tier-field="charge"]')?.value) || 0)
    }));

    const res = saveGasSettings({
      deliveryPricingConfig: {
        defaultMethod: document.getElementById('gpric-method')?.value || 'Distance-Based Tiers',
        fixedCharge: Math.max(0, Number(document.getElementById('gpric-fixed')?.value) || 0),
        perKmRate: Math.max(0, Number(document.getElementById('gpric-perkm')?.value) || 0),
        aboveMaxTierDefaultCharge: Math.max(0, Number(document.getElementById('gpric-above')?.value) || 0),
        distanceTiers
      }
    });
    if (!res.success) {
      showToast(res.message, 'danger');
      return;
    }
    showToast('Delivery pricing rules saved.', 'success');
    render();
  }

  function openGasDeliveryAreaModal(editId = '') {
    const ar = editId ? getGasDeliveryAreas().find(x => x.id === editId) : null;
    const html = `
      <form onsubmit="window.MJK.submitGasDeliveryAreaForm(event)">
        <input type="hidden" id="garea-id" value="${esc(ar?.id || '')}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.85rem;">
          <div style="grid-column:span 2;"><label class="form-label">Village / Delivery Area Name *</label><input id="garea-name" type="text" required class="form-control" placeholder="e.g., Mamudpur / Juginda / Domkal" value="${esc(ar?.name || '')}"></div>
          <div><label class="form-label">Estimated Distance (KM)</label><input id="garea-km" type="number" min="0" step="0.1" class="form-control" value="${ar?.distanceKm ?? 0}"></div>
          <div><label class="form-label">Standard Delivery Charge (₹) *</label><input id="garea-chg" type="number" min="0" step="1" required class="form-control" value="${ar?.charge ?? 30}"></div>
        </div>
        <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.84rem;margin-bottom:1rem;"><input id="garea-active" type="checkbox" ${ar?.isActive !== false ? 'checked' : ''}> Active Area Tariff</label>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${ar ? 'Update Area' : 'Save Area'}</button>
        </div>
      </form>
    `;
    openModal(ar ? `Edit Area (${ar.name})` : 'Add Delivery Area / Village Tariff', html, null);
  }

  async function submitGasDeliveryAreaForm(e) {
    e.preventDefault();
    try {
      const res = await saveGasDeliveryArea({
        id: document.getElementById('garea-id')?.value || '',
        name: document.getElementById('garea-name')?.value,
        distanceKm: document.getElementById('garea-km')?.value,
        charge: document.getElementById('garea-chg')?.value,
        isActive: Boolean(document.getElementById('garea-active')?.checked)
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Saved Delivery Area: ${res.area.name}`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save delivery area.', 'danger');
    }
  }

  function deleteGasDeliveryAreaConfirm(id) {
    showConfirmDialog('Delete Delivery Area?', 'Remove this area tariff from Settings?', () => {
      const res = deleteGasDeliveryArea(id);
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast('Delivery Area removed.', 'success');
      render();
    });
  }

  function openGasDeliveryPersonModal(editId = '') {
    const p = editId ? getGasDeliveryPersonById(editId) : null;
    const html = `
      <form onsubmit="window.MJK.submitGasDeliveryPersonForm(event)">
        <input type="hidden" id="gdper-id" value="${esc(p?.id || '')}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.85rem;">
          <div><label class="form-label">Delivery Person Name *</label><input id="gdper-name" type="text" required class="form-control" value="${esc(p?.name || '')}"></div>
          <div><label class="form-label">Mobile Number (10 digits) *</label><input id="gdper-mob" type="tel" required class="form-control" value="${esc(p?.mobile || '')}"></div>
          <div><label class="form-label">Assigned Area / Route</label><input id="gdper-area" type="text" class="form-control" placeholder="e.g., Mamudpur & Juginda" value="${esc(p?.assignedArea || '')}"></div>
          <div><label class="form-label">Vehicle / Van Details</label><input id="gdper-veh" type="text" class="form-control" placeholder="e.g., Toto / Van WB-58..." value="${esc(p?.vehicleInfo || '')}"></div>
          <div>
            <label class="form-label">Availability Status</label>
            <select id="gdper-avail" class="form-control">
              ${['Available', 'On Delivery', 'Off Duty'].map(st => `<option value="${st}" ${(p?.availabilityStatus || 'Available') === st ? 'selected' : ''}>${st}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;align-items:center;padding-top:1.3rem;">
            <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.84rem;"><input id="gdper-active" type="checkbox" ${p?.isActive !== false ? 'checked' : ''}> Active Rider</label>
          </div>
          <div style="grid-column:span 2;"><label class="form-label">Address</label><input id="gdper-addr" type="text" class="form-control" value="${esc(p?.address || '')}"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${p ? 'Update Delivery Person' : 'Save Delivery Person'}</button>
        </div>
      </form>
    `;
    openModal(p ? `Edit Delivery Person (${p.id})` : 'Add Delivery Person', html, null);
  }

  async function submitGasDeliveryPersonForm(e) {
    e.preventDefault();
    try {
      const res = await saveGasDeliveryPerson({
        id: document.getElementById('gdper-id')?.value || '',
        name: document.getElementById('gdper-name')?.value,
        mobile: document.getElementById('gdper-mob')?.value,
        assignedArea: document.getElementById('gdper-area')?.value,
        vehicleInfo: document.getElementById('gdper-veh')?.value,
        availabilityStatus: document.getElementById('gdper-avail')?.value,
        isActive: Boolean(document.getElementById('gdper-active')?.checked),
        address: document.getElementById('gdper-addr')?.value
      });
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast(`Saved Delivery Person: ${res.person.name}`, 'success');
      closeModal();
      render();
    } catch (err) {
      showToast(err?.message || 'Failed to save delivery person.', 'danger');
    }
  }

  function toggleGasDeliveryPerson(id) {
    const res = toggleGasDeliveryPersonStatus(id);
    if (!res.success) {
      showToast(res.message, 'danger');
      return;
    }
    showToast(`${res.person.name} is now ${res.person.isActive ? 'Active' : 'Inactive'}.`, 'success');
    render();
  }

  function deleteGasDeliveryPersonConfirm(id) {
    showConfirmDialog('Delete Delivery Person?', 'Remove this rider? Riders with active pending bookings cannot be deleted.', () => {
      const res = deleteGasDeliveryPerson(id);
      if (!res.success) {
        showToast(res.message, 'danger');
        return;
      }
      showToast('Delivery Person removed.', 'success');
      render();
    });
  }

  return {
    setGasFilter,
    setGasSearch,
    resetGasDashDates,
    resetGasReportFilters,
    resetGasBookingFilters,
    navigateGasBookingsByStatus,
    openGasSettingsTab,
    openGasCustomerModal,
    autoBuildGasCustomerAddress,
    syncGasCustomerAddressPreview,
    toggleGasCustomerWhatsappInline,
    syncCustomerModalPinFromInputs,
    toggleGasCustomerAgencyInline,
    saveGasCustomerInlineAgency,
    geocodeGasCustomerModalAddress,
    captureCustomerModalGps,
    clearCustomerModalCoords,
    submitGasCustomerForm,
    deleteGasCustomerConfirm,
    openGasCustomerHistoryModal,
    openGasBookingModal,
    filterGasBookingCustomerDropdown,
    handleGasBookingCustChange,
    applyGasSuggestedDeliveryFee,
    computeGasBookingRoadDistance,
    recalcGasBookingModal,
    submitGasBookingForm,
    markGasBookingDelivered,
    openGasAssignRiderModal,
    submitGasAssignRiderModal,
    openGasOrderTrackingModal,
    submitGasTrackingStageUpdate,
    captureGasDriverGpsForBooking,
    saveCurrentGpsToCustomerProfile,
    printGasBookingReceipt,
    openGasEligibilityRuleModal,
    submitGasEligibilityRuleForm,
    handleGasSubsidyAutoPreview,
    openGasSubsidyModal,
    submitGasSubsidyForm,
    openGasNonTakerModal,
    submitGasNonTakerForm,
    openGasNonTakerRecoveryModal,
    submitGasNonTakerRecoveryForm,
    openGasNonTakerHistoryModal,
    reverseGasNonTakerRecoveryConfirm,
    openGasCollectionModal,
    submitGasCollectionForm,
    reverseGasCollectionPrompt,
    printGasCollectionReceipt,
    openGasInventoryItemModal,
    submitGasInventoryItemForm,
    openGasAccessorySaleModal,
    submitGasAccessorySaleForm,
    openGasWarehouseModal,
    submitGasWarehouseForm,
    openGasStockMovementModal,
    submitGasStockMovementForm,
    openGasSupplierModal,
    submitGasSupplierForm,
    openGasPurchaseModal,
    addGasPurchaseLineRow,
    updateGasPurchaseLine,
    removeGasPurchaseLine,
    submitGasPurchaseForm,
    handleGasServiceCustChange,
    handleGasServiceTypeChange,
    handleGasServiceSkuPick,
    recalcGasServiceTotals,
    submitGasServiceEntry,
    reverseGasServicePrompt,
    printGasServiceReceipt,
    exportGasServicePdf,
    exportGasReportDirect,
    exportActiveGasReport,
    submitGasSettings,
    geocodeGasMainCentre,
    openGasAgencyQuickModal,
    openGasAgencyEditModal,
    submitGasAgencyForm,
    deleteGasAgencyConfirm,
    openGasCylinderTypeModal,
    submitGasCylinderTypeForm,
    deleteGasCylinderTypeConfirm,
    addGasPricingTierRow,
    submitGasDeliveryPricingConfig,
    openGasDeliveryAreaModal,
    submitGasDeliveryAreaForm,
    deleteGasDeliveryAreaConfirm,
    openGasDeliveryPersonModal,
    submitGasDeliveryPersonForm,
    toggleGasDeliveryPerson,
    deleteGasDeliveryPersonConfirm
  };
}
