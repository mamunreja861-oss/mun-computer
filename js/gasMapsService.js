/**
 * gasMapsService.js - Google Maps Platform + Quota-Safe Leaflet/OSM Integration for LPG Delivery & Customer Pinning
 * MUN COMPUTER Business Manager
 *
 * Strictly complies with Google Maps Platform policies:
 * - Dynamic loading via @googlemaps/js-api-loader (setOptions + importLibrary)
 * - AdvancedMarkerElement + PinElement with mapId: 'DEMO_MAP_ID'
 * - Server-side proxied Geocoding v4 & Routes API v2 (/api/maps/*)
 * - Attribution ID: gmp_mcp_codeassist_v1_aistudio
 * - Tier 2 Demo Key Quota Defense ('gmp-quota-exceeded' event dispatch on 429/RESOURCE_EXHAUSTED)
 * - Interactive Leaflet + OpenStreetMap fallback if Maps API quota is exceeded or key unavailable
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { getAuthHeaders } from './storage.js';

export const GMP_SOLUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

export const MAIN_CENTRE_FALLBACK_COORDS = { lat: 24.1328, lng: 88.5456 };

export const MAIN_CENTRE_DEFAULT = {
  name: 'MUN COMPUTER (Main Centre)',
  fullAddress:
    'Vill: Mamudpur (Chomatha More), P.O.: Juginda, P.S.: Domkal, Dist.: Murshidabad, West Bengal - 742406, India',
  geocodeQuery:
    'Mamudpur, Juginda, Domkal, Murshidabad, West Bengal 742406, India',
  lat: null,
  lng: null
};

// Viewport center for Domkal, Murshidabad
const DOMKAL_VIEWPORT_CENTER = { lat: 24.142, lng: 88.532 };

// Approximate village/PIN centroids in Domkal, Murshidabad for final offline fallback
const MURSHIDABAD_FALLBACK_CENTROIDS = [
  { keys: ['mamudpur', 'mamenpur', 'chomatha'], lat: 24.1328, lng: 88.5456, label: 'Mamudpur, Domkal, Murshidabad 742406' },
  { keys: ['juginda', '742406'], lat: 24.1292, lng: 88.5419, label: 'Juginda, Domkal, Murshidabad 742406' },
  { keys: ['domkal', '742303'], lat: 24.1419, lng: 88.5303, label: 'Domkal, Murshidabad 742303' },
  { keys: ['bhagirathpur'], lat: 24.1495, lng: 88.5562, label: 'Bhagirathpur, Domkal, Murshidabad' },
  { keys: ['goribpur', 'garibpur'], lat: 24.1185, lng: 88.5515, label: 'Garibpur, Domkal, Murshidabad' },
  { keys: ['jalangi', '742305'], lat: 24.1355, lng: 88.7042, label: 'Jalangi, Murshidabad 742305' },
  { keys: ['azimganj', 'ramna', 'etbarnagar'], lat: 24.156, lng: 88.515, label: 'Azimganj / Domkal, Murshidabad' },
  { keys: ['murshidabad'], lat: 24.142, lng: 88.532, label: 'Domkal, Murshidabad, West Bengal' }
];

let _cachedMapsKey = null;
let _optionsConfigured = false;
let _mapsLibsPromise = null;
let _quotaFallbackActive = false;

if (typeof window !== 'undefined') {
  window.addEventListener('gmp-quota-exceeded', () => {
    _quotaFallbackActive = true;
  });
}

function notifyQuotaExceededIfApplicable(status, payload) {
  const errStatus = String(payload?.status || payload?.error?.status || '').toUpperCase();
  if (
    status === 429 ||
    payload?.quotaExceeded === true ||
    errStatus === 'RESOURCE_EXHAUSTED' ||
    errStatus === 'OVER_QUERY_LIMIT'
  ) {
    _quotaFallbackActive = true;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
    return true;
  }
  return false;
}

function cleanAddressForOsm(address) {
  return String(address || '')
    .replace(/\b(?:House|Vill|Village|Locality|P\.O\.|PO|P\.S\.|PS|GP|Block|Dist\.?|District|PIN)\s*[:.]?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchLocalCentroid(address) {
  const hay = String(address || '').toLowerCase();
  if (!hay) return null;
  for (const entry of MURSHIDABAD_FALLBACK_CENTROIDS) {
    if (entry.keys.some((k) => hay.includes(k))) {
      return {
        lat: entry.lat,
        lng: entry.lng,
        formattedAddress: entry.label,
        placeId: '',
        source: 'local_centroid'
      };
    }
  }
  return null;
}

async function geocodeWithNominatim(address) {
  const cleaned = cleanAddressForOsm(address);
  if (!cleaned) return null;
  const queries = [cleaned];
  const commaParts = cleaned.split(',').map((s) => s.trim()).filter(Boolean);
  if (commaParts.length > 3) {
    queries.push(commaParts.slice(-3).join(', '));
  }
  const pinMatch = cleaned.match(/\b\d{6}\b/);
  if (pinMatch && !queries.includes(pinMatch[0])) {
    queries.push(`${pinMatch[0]}, West Bengal, India`);
  }

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`;
      const resp = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!resp.ok) continue;
      const rows = await resp.json().catch(() => []);
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.lat && rows[0]?.lon) {
        return {
          lat: Number(Number(rows[0].lat).toFixed(6)),
          lng: Number(Number(rows[0].lon).toFixed(6)),
          formattedAddress: rows[0].display_name || cleaned,
          placeId: '',
          source: 'osm_nominatim'
        };
      }
    } catch {
      // try next fallback query
    }
  }
  return null;
}

async function reverseGeocodeWithNominatim(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    if (data?.display_name) {
      return {
        formattedAddress: data.display_name,
        placeId: '',
        source: 'osm_nominatim'
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export async function resolveMapsApiKey() {
  if (_cachedMapsKey) return _cachedMapsKey;
  const viteKey =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_MAPS_API_KEY) || '';
  if (viteKey && String(viteKey).trim()) {
    _cachedMapsKey = String(viteKey).trim();
    return _cachedMapsKey;
  }
  try {
    const resp = await fetch('/api/maps/config', { headers: getAuthHeaders() });
    if (!resp.ok) return '';
    const data = await resp.json();
    if (data?.available && data?.apiKey) {
      _cachedMapsKey = String(data.apiKey).trim();
      return _cachedMapsKey;
    }
  } catch {
    // ignore offline/unauthenticated lookup failure
  }
  return '';
}

export async function loadGoogleMapsLibraries() {
  if (_quotaFallbackActive) {
    throw new Error('Google Maps quota limit reached. Using interactive OpenStreetMap fallback.');
  }
  const apiKey = await resolveMapsApiKey();
  if (!apiKey) {
    throw new Error('Google Maps API key is currently unavailable.');
  }
  if (!_optionsConfigured) {
    setOptions({
      key: apiKey,
      v: 'weekly',
      language: 'en',
      region: 'IN'
    });
    _optionsConfigured = true;
  }
  if (!_mapsLibsPromise) {
    _mapsLibsPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
      importLibrary('core')
    ]).then(([mapsLib, markerLib, coreLib]) => ({
      ...mapsLib,
      ...markerLib,
      ...coreLib
    }));
  }
  return _mapsLibsPromise;
}

export async function geocodeGasAddress(address) {
  const clean = String(address || '').trim();
  if (!clean) {
    return { success: false, message: 'Enter an address or PIN code to locate on map.' };
  }

  let quotaHit = _quotaFallbackActive;

  if (!_quotaFallbackActive) {
    try {
      const resp = await fetch('/api/maps/geocode', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ address: clean })
      });
      const data = await resp.json().catch(() => ({}));
      if (notifyQuotaExceededIfApplicable(resp.status, data)) {
        quotaHit = true;
      } else if (resp.ok && data?.success && data.result) {
        return { success: true, result: { ...data.result, source: 'google' } };
      }
    } catch {
      // fall through to OSM fallback
    }
  }

  // Fallback 1: OpenStreetMap Nominatim
  const osmMatch = await geocodeWithNominatim(clean);
  if (osmMatch) {
    return { success: true, quotaExceeded: quotaHit, result: osmMatch };
  }

  // Fallback 2: Local Domkal / Murshidabad centroid so rural villages still pin cleanly
  const centroid = matchLocalCentroid(clean);
  if (centroid) {
    return {
      success: true,
      quotaExceeded: quotaHit,
      approximate: true,
      result: centroid
    };
  }

  return {
    success: false,
    quotaExceeded: quotaHit,
    noResults: true,
    message: 'Could not pinpoint exact address. Drag the pin on the map or use Device GPS.'
  };
}

export async function reverseGeocodeGasCoords(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
    return { success: false, message: 'Valid coordinates required.' };
  }

  if (!_quotaFallbackActive) {
    try {
      const resp = await fetch('/api/maps/reverse-geocode', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ lat: nLat, lng: nLng })
      });
      const data = await resp.json().catch(() => ({}));
      if (!notifyQuotaExceededIfApplicable(resp.status, data) && resp.ok && data?.success && data.result) {
        return { success: true, result: data.result };
      }
    } catch {
      // fall through to OSM reverse geocode
    }
  }

  const osmRev = await reverseGeocodeWithNominatim(nLat, nLng);
  if (osmRev) {
    return { success: true, result: osmRev };
  }
  return { success: false, message: 'Reverse geocode unavailable; GPS coordinates still saved.' };
}

export async function computeRoadRoute(origin, destination) {
  const oLat = Number(origin?.lat);
  const oLng = Number(origin?.lng);
  const dLat = Number(destination?.lat);
  const dLng = Number(destination?.lng);
  if (![oLat, oLng, dLat, dLng].every(Number.isFinite)) {
    return { success: false, message: 'Both Main Centre and Customer coordinates are required to compute road distance.' };
  }
  try {
    const resp = await fetch('/api/maps/compute-route', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        origin: { lat: oLat, lng: oLng },
        destination: { lat: dLat, lng: dLng }
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (notifyQuotaExceededIfApplicable(resp.status, data)) {
      return { success: false, quotaExceeded: true, message: 'Google Maps demo quota reached.' };
    }
    if (!resp.ok || !data?.success) {
      return {
        success: false,
        unavailable: Boolean(data?.unavailable),
        message: data?.message || 'Could not compute driving route.'
      };
    }
    return {
      success: true,
      distanceMeters: data.distanceMeters,
      distanceKm: data.distanceKm,
      durationSeconds: data.durationSeconds,
      durationText: data.durationText,
      encodedPolyline: data.encodedPolyline || ''
    };
  } catch (err) {
    return { success: false, message: err?.message || 'Network error calculating road distance.' };
  }
}

export function decodeEncodedPolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  const poly = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return poly;
}

export function buildGoogleMapsDirectionsUrl(origin, destination) {
  const destStr =
    Number.isFinite(Number(destination?.lat)) && Number.isFinite(Number(destination?.lng))
      ? `${Number(destination.lat)},${Number(destination.lng)}`
      : String(destination?.address || '').trim();
  if (!destStr) return 'https://www.google.com/maps';

  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  if (Number.isFinite(Number(origin?.lat)) && Number.isFinite(Number(origin?.lng))) {
    url.searchParams.set('origin', `${Number(origin.lat)},${Number(origin.lng)}`);
  } else if (origin?.address) {
    url.searchParams.set('origin', String(origin.address).trim());
  }
  url.searchParams.set('destination', destStr);
  url.searchParams.set('travelmode', 'driving');
  return url.toString();
}

export function buildGoogleMapsPlaceUrl({ lat, lng, address = '' } = {}) {
  const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const query = hasCoords ? `${Number(lat)},${Number(lng)}` : String(address || '').trim();
  if (!query) return 'https://www.google.com/maps';
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', query);
  return url.toString();
}

export function requestBrowserCurrentLocation() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ success: false, message: 'Geolocation is not supported on this device/browser.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          success: true,
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracyMeters: Math.round(pos.coords.accuracy || 0)
        });
      },
      (err) => {
        const msg =
          err?.code === 1
            ? 'Location permission was denied. Allow browser location access to capture GPS.'
            : 'Unable to determine current GPS coordinates.';
        resolve({ success: false, message: msg });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

function createPinContent({ glyphText = '•', background = '#1d4ed8', borderColor = '#1e3a8a', glyphColor = '#ffffff', PinElement }) {
  try {
    if (PinElement) {
      return new PinElement({
        glyphText,
        background,
        borderColor,
        glyphColor,
        scale: 1.1
      });
    }
  } catch {
    // Fallback to clean HTML marker badge
  }
  const el = document.createElement('div');
  el.style.cssText = `background:${background};border:2px solid ${borderColor};color:${glyphColor};font-weight:800;font-size:12px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);`;
  el.textContent = glyphText;
  return el;
}

function createLeafletBadgeIcon(glyphText, background, borderColor = '#ffffff') {
  return L.divIcon({
    className: 'mun-gas-leaflet-pin',
    html: `<div style="background:${background};border:2px solid ${borderColor};color:#ffffff;font-weight:800;font-size:12px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.35);cursor:pointer;">${glyphText}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function renderLeafletFallbackMap(
  containerEl,
  {
    origin = null,
    customer = null,
    driver = null,
    encodedPolyline = '',
    editableCustomerPin = false,
    onCustomerPinMoved = null,
    heightPx = 310,
    badgeLabel = 'OpenStreetMap Interactive Fallback'
  } = {}
) {
  if (!containerEl) return null;
  containerEl.style.height = `${heightPx}px`;
  containerEl.style.width = '100%';
  containerEl.style.position = 'relative';
  containerEl.innerHTML = '';

  const mapDiv = document.createElement('div');
  mapDiv.style.cssText = 'width:100%;height:100%;border-radius:8px;z-index:1;';
  containerEl.appendChild(mapDiv);

  const badge = document.createElement('div');
  badge.style.cssText =
    'position:absolute;top:8px;right:8px;z-index:400;background:rgba(255,255,255,0.92);color:#1e3a8a;border:1px solid #bfdbfe;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;pointer-events:none;box-shadow:0 1px 4px rgba(15,23,42,0.12);';
  badge.textContent = badgeLabel;
  containerEl.appendChild(badge);

  const hasOrigin = Number.isFinite(Number(origin?.lat)) && Number.isFinite(Number(origin?.lng));
  const hasCust = Number.isFinite(Number(customer?.lat)) && Number.isFinite(Number(customer?.lng));
  const hasDriver = Number.isFinite(Number(driver?.lat)) && Number.isFinite(Number(driver?.lng));

  const center = hasCust
    ? [Number(customer.lat), Number(customer.lng)]
    : hasOrigin
      ? [Number(origin.lat), Number(origin.lng)]
      : [DOMKAL_VIEWPORT_CENTER.lat, DOMKAL_VIEWPORT_CENTER.lng];

  const map = L.map(mapDiv, {
    center,
    zoom: hasCust || hasOrigin ? 14 : 12,
    zoomControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const boundsPts = [];

  if (hasOrigin) {
    const pos = [Number(origin.lat), Number(origin.lng)];
    L.marker(pos, { icon: createLeafletBadgeIcon('M', '#0b3b8c') })
      .addTo(map)
      .bindPopup(`<strong>${origin.name || 'MUN COMPUTER'}</strong><br>${origin.fullAddress || MAIN_CENTRE_DEFAULT.fullAddress}`);
    boundsPts.push(pos);
  }

  let custMarker = null;
  const placeOrMoveCustomerMarker = ({ lat, lng }) => {
    const pos = [Number(lat), Number(lng)];
    if (!custMarker) {
      custMarker = L.marker(pos, {
        icon: createLeafletBadgeIcon('C', '#dc2626'),
        draggable: Boolean(editableCustomerPin)
      }).addTo(map);
      custMarker.bindPopup(
        `<strong>${customer?.name || 'Customer Delivery Pin'}</strong>${customer?.address ? `<br>${customer.address}` : ''}`
      );
      if (editableCustomerPin) {
        custMarker.on('dragend', () => {
          const p = custMarker.getLatLng();
          if (Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && typeof onCustomerPinMoved === 'function') {
            onCustomerPinMoved({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) });
          }
        });
      }
    } else {
      custMarker.setLatLng(pos);
    }
  };

  if (hasCust) {
    const pos = [Number(customer.lat), Number(customer.lng)];
    placeOrMoveCustomerMarker({ lat: pos[0], lng: pos[1] });
    boundsPts.push(pos);
  }

  if (hasDriver) {
    const pos = [Number(driver.lat), Number(driver.lng)];
    L.marker(pos, { icon: createLeafletBadgeIcon('D', '#059669') })
      .addTo(map)
      .bindPopup(`<strong>Delivery Rider: ${driver.name || 'Assigned Rider'}</strong><br>Updated: ${driver.updatedAt || 'Live GPS'}`);
    boundsPts.push(pos);
  }

  if (encodedPolyline) {
    const decoded = decodeEncodedPolyline(encodedPolyline);
    if (decoded.length > 0) {
      const latLngs = decoded.map((pt) => [pt.lat, pt.lng]);
      L.polyline(latLngs, { color: '#1d4ed8', weight: 5, opacity: 0.88 }).addTo(map);
      latLngs.forEach((p) => boundsPts.push(p));
    }
  }

  if (boundsPts.length > 1) {
    map.fitBounds(boundsPts, { padding: [36, 36] });
  }

  if (editableCustomerPin) {
    map.on('click', (ev) => {
      const lat = ev?.latlng?.lat;
      const lng = ev?.latlng?.lng;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const rounded = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
        placeOrMoveCustomerMarker(rounded);
        if (typeof onCustomerPinMoved === 'function') {
          onCustomerPinMoved(rounded);
        }
      }
    });
  }

  // Ensure Leaflet computes exact viewport bounds once modal finishes opening
  setTimeout(() => {
    try {
      map.invalidateSize();
    } catch {
      // ignore if unmounted
    }
  }, 120);

  return {
    provider: 'leaflet',
    map,
    updateCustomerPin(pos) {
      if (Number.isFinite(Number(pos?.lat)) && Number.isFinite(Number(pos?.lng))) {
        const cleanPos = { lat: Number(pos.lat), lng: Number(pos.lng) };
        placeOrMoveCustomerMarker(cleanPos);
        map.setView([cleanPos.lat, cleanPos.lng], 15);
      }
    }
  };
}

/**
 * Renders an interactive Map inside a sized container element.
 * Uses Google Maps JS API (AdvancedMarkerElement + PinElement) when available,
 * and seamlessly falls back to interactive OpenStreetMap/Leaflet on quota limits or missing keys.
 */
export async function renderGasInteractiveMap(
  containerEl,
  {
    origin = null,
    customer = null,
    driver = null,
    encodedPolyline = '',
    editableCustomerPin = false,
    onCustomerPinMoved = null,
    heightPx = 310
  } = {}
) {
  if (!containerEl) return null;
  containerEl.style.height = `${heightPx}px`;
  containerEl.style.width = '100%';
  containerEl.innerHTML =
    '<div style="height:100%;display:flex;align-items:center;justify-content:center;background:#eff6ff;color:#1e3a8a;font-size:0.84rem;font-weight:600;border-radius:8px;border:1px solid #bfdbfe;">Loading Interactive Map...</div>';

  const mapArgs = {
    origin,
    customer,
    driver,
    encodedPolyline,
    editableCustomerPin,
    onCustomerPinMoved,
    heightPx
  };

  let activeDelegate = null;
  const controller = {
    updateCustomerPin(pos) {
      if (activeDelegate && typeof activeDelegate.updateCustomerPin === 'function') {
        activeDelegate.updateCustomerPin(pos);
      }
    }
  };

  const switchToLeaflet = (reason = 'OpenStreetMap Interactive Mode') => {
    if (!document.body.contains(containerEl)) return;
    activeDelegate = renderLeafletFallbackMap(containerEl, {
      ...mapArgs,
      badgeLabel: reason
    });
  };

  if (_quotaFallbackActive) {
    switchToLeaflet('OpenStreetMap Mode (Maps Quota Fallback)');
    return controller;
  }

  try {
    const libs = await loadGoogleMapsLibraries();
    const { Map, InfoWindow, Polyline, AdvancedMarkerElement, PinElement, LatLngBounds } = libs;

    const hasOrigin = Number.isFinite(Number(origin?.lat)) && Number.isFinite(Number(origin?.lng));
    const hasCust = Number.isFinite(Number(customer?.lat)) && Number.isFinite(Number(customer?.lng));
    const hasDriver = Number.isFinite(Number(driver?.lat)) && Number.isFinite(Number(driver?.lng));

    const initialCenter = hasCust
      ? { lat: Number(customer.lat), lng: Number(customer.lng) }
      : hasOrigin
        ? { lat: Number(origin.lat), lng: Number(origin.lng) }
        : DOMKAL_VIEWPORT_CENTER;

    containerEl.innerHTML = '';
    const map = new Map(containerEl, {
      center: initialCenter,
      zoom: hasCust || hasOrigin ? 14 : 12,
      mapId: 'DEMO_MAP_ID',
      internalUsageAttributionIds: [GMP_SOLUTION_ID],
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true
    });

    const infoWindow = new InfoWindow();
    const bounds = new LatLngBounds();
    let pointCount = 0;

    if (hasOrigin) {
      const pos = { lat: Number(origin.lat), lng: Number(origin.lng) };
      const originMarker = new AdvancedMarkerElement({
        map,
        position: pos,
        title: origin.name || MAIN_CENTRE_DEFAULT.name,
        content: createPinContent({
          glyphText: 'M',
          background: '#0b3b8c',
          borderColor: '#ffffff',
          glyphColor: '#ffffff',
          PinElement
        }),
        gmpClickable: true
      });
      originMarker.addListener('click', () => {
        infoWindow.setContent(
          `<div style="font-size:12px;color:#0f172a;max-width:240px;"><strong>${origin.name || 'MUN COMPUTER'}</strong><div style="margin-top:2px;color:#475569;">${origin.fullAddress || MAIN_CENTRE_DEFAULT.fullAddress}</div></div>`
        );
        infoWindow.open({ anchor: originMarker, map });
      });
      bounds.extend(pos);
      pointCount += 1;
    }

    let custMarker = null;
    const placeOrMoveCustomerMarker = (pos) => {
      if (!custMarker) {
        custMarker = new AdvancedMarkerElement({
          map,
          position: pos,
          title: customer?.name || 'Customer Delivery Location',
          content: createPinContent({
            glyphText: 'C',
            background: '#dc2626',
            borderColor: '#ffffff',
            glyphColor: '#ffffff',
            PinElement
          }),
          gmpClickable: true,
          gmpDraggable: Boolean(editableCustomerPin)
        });
        custMarker.addListener('click', () => {
          infoWindow.setContent(
            `<div style="font-size:12px;color:#0f172a;max-width:240px;"><strong>${customer?.name || 'Customer Delivery Pin'}</strong><div style="margin-top:2px;color:#475569;">${customer?.address || ''}</div></div>`
          );
          infoWindow.open({ anchor: custMarker, map });
        });
        if (editableCustomerPin) {
          custMarker.addListener('dragend', () => {
            const p = custMarker.position;
            const lat = typeof p?.lat === 'function' ? p.lat() : Number(p?.lat);
            const lng = typeof p?.lng === 'function' ? p.lng() : Number(p?.lng);
            if (Number.isFinite(lat) && Number.isFinite(lng) && typeof onCustomerPinMoved === 'function') {
              onCustomerPinMoved({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
            }
          });
        }
      } else {
        custMarker.position = pos;
      }
    };

    if (hasCust) {
      const pos = { lat: Number(customer.lat), lng: Number(customer.lng) };
      placeOrMoveCustomerMarker(pos);
      bounds.extend(pos);
      pointCount += 1;
    }

    if (hasDriver) {
      const pos = { lat: Number(driver.lat), lng: Number(driver.lng) };
      const drvMarker = new AdvancedMarkerElement({
        map,
        position: pos,
        title: driver.name ? `Rider: ${driver.name}` : 'Delivery Rider GPS',
        content: createPinContent({
          glyphText: 'D',
          background: '#059669',
          borderColor: '#ffffff',
          glyphColor: '#ffffff',
          PinElement
        }),
        gmpClickable: true
      });
      drvMarker.addListener('click', () => {
        infoWindow.setContent(
          `<div style="font-size:12px;color:#0f172a;max-width:240px;"><strong>Delivery Rider: ${driver.name || 'Assigned Rider'}</strong><div style="margin-top:2px;color:#475569;">Updated: ${driver.updatedAt || 'Live Device GPS'}</div></div>`
        );
        infoWindow.open({ anchor: drvMarker, map });
      });
      bounds.extend(pos);
      pointCount += 1;
    }

    if (encodedPolyline) {
      const decodedPath = decodeEncodedPolyline(encodedPolyline);
      if (decodedPath.length > 0 && Polyline) {
        new Polyline({
          path: decodedPath,
          geodesic: true,
          strokeColor: '#1d4ed8',
          strokeOpacity: 0.9,
          strokeWeight: 5,
          map
        });
        decodedPath.forEach((pt) => bounds.extend(pt));
      }
    }

    if (pointCount > 1) {
      map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    }

    if (editableCustomerPin) {
      map.addListener('click', (ev) => {
        const lat = ev?.latLng?.lat?.();
        const lng = ev?.latLng?.lng?.();
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const rounded = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
          placeOrMoveCustomerMarker(rounded);
          if (typeof onCustomerPinMoved === 'function') {
            onCustomerPinMoved(rounded);
          }
        }
      });
    }

    activeDelegate = {
      provider: 'google',
      map,
      updateCustomerPin(pos) {
        if (Number.isFinite(Number(pos?.lat)) && Number.isFinite(Number(pos?.lng))) {
          const cleanPos = { lat: Number(pos.lat), lng: Number(pos.lng) };
          placeOrMoveCustomerMarker(cleanPos);
          map.panTo(cleanPos);
          map.setZoom(15);
        }
      }
    };

    // If Google Maps triggers quota/auth failure dynamically after load, swap cleanly to Leaflet
    if (typeof window !== 'undefined') {
      const quotaHandler = () => {
        window.removeEventListener('gmp-quota-exceeded', quotaHandler);
        switchToLeaflet('OpenStreetMap Mode (Maps Quota Fallback)');
      };
      window.addEventListener('gmp-quota-exceeded', quotaHandler, { once: true });
    }

    return controller;
  } catch {
    switchToLeaflet('OpenStreetMap Interactive Mode');
    return controller;
  }
}
