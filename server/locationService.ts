import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { State, City } from 'country-state-city';
import { murshidabadMaster } from './murshidabadMaster.js';

const require = createRequire(import.meta.url);

export interface LocationRecord {
  state: string;
  district: string; // Administrative District (e.g., Murshidabad)
  village: string;  // Village / Town / Branch Locality (e.g., Mamudpur)
  postOffice: string; // Post Office Name (e.g., Juginda)
  policeStation: string; // Police Station / Block / Taluk (e.g., Domkal)
  pincode: string;  // 6-digit PIN Code (e.g., 742406)
  source?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CACHE_FILE = path.join(DATA_DIR, 'location-cache.json');
const CUSTOM_FILE = path.join(DATA_DIR, 'custom-locations.json');

// Canonical state name normalizer so INDIA POST / pincode_db / country-state-city align 100%
const STATE_ALIASES: Record<string, string> = {
  'ANDAMAN & NICOBAR ISLANDS': 'Andaman and Nicobar Islands',
  'ANDAMAN AND NICOBAR ISLANDS': 'Andaman and Nicobar Islands',
  'CHATTISGARH': 'Chhattisgarh',
  'CHHATTISGARH': 'Chhattisgarh',
  'DADRA & NAGAR HAVELI': 'Dadra and Nagar Haveli and Daman and Diu',
  'DAMAN & DIU': 'Dadra and Nagar Haveli and Daman and Diu',
  'DADRA AND NAGAR HAVELI': 'Dadra and Nagar Haveli and Daman and Diu',
  'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': 'Dadra and Nagar Haveli and Daman and Diu',
  'JAMMU & KASHMIR': 'Jammu and Kashmir',
  'JAMMU AND KASHMIR': 'Jammu and Kashmir',
  'ORISSA': 'Odisha',
  'ODISHA': 'Odisha',
  'PONDICHERRY': 'Puducherry',
  'PUDUCHERRY': 'Puducherry',
  'DELHI': 'Delhi',
  'NCT OF DELHI': 'Delhi',
  'UTTARANCHAL': 'Uttarakhand',
  'UTTARAKHAND': 'Uttarakhand',
  'TELANGANA': 'Telangana',
  'WEST BENGAL': 'West Bengal',
  'LADAKH': 'Ladakh'
};

export function toTitleCase(input: string): string {
  const clean = String(input || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return clean
    .toLowerCase()
    .split(' ')
    .map(w => {
      if (!w) return '';
      if (/^\(.*\)$/.test(w)) return `(${w.slice(1, -1).replace(/^\w/, c => c.toUpperCase())})`;
      if (['of', 'and', 'the'].includes(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ')
    .replace(/^./, c => c.toUpperCase());
}

export function normalizeStateName(raw: string): string {
  const upper = String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!upper) return '';
  if (STATE_ALIASES[upper]) return STATE_ALIASES[upper];
  return toTitleCase(raw);
}

function normalizeDistrictName(raw: string): string {
  const clean = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  const upper = clean.toUpperCase();
  const DISTRICT_FIX: Record<string, string> = {
    'NORTH 24 PARGANAS': 'North 24 Parganas',
    'SOUTH 24 PARGANAS': 'South 24 Parganas',
    'PASCHIM BARDHAMAN': 'Paschim Bardhaman',
    'PURBA BARDHAMAN': 'Purba Bardhaman',
    'BARDHAMAN': 'Purba Bardhaman',
    'COOCHBEHAR': 'Cooch Behar',
    'COOCH BEHAR': 'Cooch Behar',
    'DARJILING': 'Darjeeling',
    'HOWRAH': 'Howrah',
    'HAORA': 'Howrah',
    'HOOGHLY': 'Hooghly',
    'HUGLI': 'Hooghly',
    'MEDINIPUR EAST': 'Purba Medinipur',
    'PURBA MEDINIPUR': 'Purba Medinipur',
    'MEDINIPUR WEST': 'Paschim Medinipur',
    'PASCHIM MEDINIPUR': 'Paschim Medinipur',
    'DINAJPUR DAKSHIN': 'Dakshin Dinajpur',
    'DAKSHIN DINAJPUR': 'Dakshin Dinajpur',
    'DINAJPUR UTTAR': 'Uttar Dinajpur',
    'UTTAR DINAJPUR': 'Uttar Dinajpur'
  };
  if (DISTRICT_FIX[upper]) return DISTRICT_FIX[upper];
  return toTitleCase(clean);
}

// Curated Official West Bengal Districts (all 23) + Police Stations + Local Murshidabad/WB Villages
const WB_ALL_DISTRICTS = [
  'Alipurduar', 'Bankura', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur',
  'Darjeeling', 'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram',
  'Kalimpong', 'Kolkata', 'Malda', 'Murshidabad', 'Nadia',
  'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur',
  'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'South 24 Parganas',
  'Uttar Dinajpur'
];

// Enriched verified rural/municipal records (ensuring Murshidabad/Domkal & major WB hubs are complete even offline)
const CURATED_LOCATIONS: LocationRecord[] = [
  // Domkal & Murshidabad (Official Local Center + surrounding villages)
  { state: 'West Bengal', district: 'Murshidabad', village: 'Mamudpur', postOffice: 'Juginda', policeStation: 'Domkal', pincode: '742406', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Chowmatha More (Mamudpur)', postOffice: 'Juginda', policeStation: 'Domkal', pincode: '742406', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Juginda', postOffice: 'Juginda', policeStation: 'Domkal', pincode: '742406', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Aminabad', postOffice: 'Aminabad', policeStation: 'Domkal', pincode: '742406', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Basantpur', postOffice: 'Basantpur (Murshidabad)', policeStation: 'Domkal', pincode: '742406', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Gokulpur', postOffice: 'Juginda', policeStation: 'Domkal', pincode: '742406', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Lakshminathpur', postOffice: 'Juginda', policeStation: 'Domkal', pincode: '742406', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Ramna Etbarnagar', postOffice: 'Domkal', policeStation: 'Domkal', pincode: '742303', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Domkal', postOffice: 'Domkal', policeStation: 'Domkal', pincode: '742303', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Garabaria', postOffice: 'Garabaria', policeStation: 'Domkal', pincode: '742303', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Bagdanga', postOffice: 'Domkal', policeStation: 'Domkal', pincode: '742303', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Jitpur', postOffice: 'Jitpur', policeStation: 'Domkal', pincode: '742303', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Kupila', postOffice: 'Domkal', policeStation: 'Domkal', pincode: '742303', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Bhagirathpur', postOffice: 'Bhagirathpur', policeStation: 'Domkal', pincode: '742303', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Dhulauri', postOffice: 'Dhulauri', policeStation: 'Domkal', pincode: '742308', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Garaimari', postOffice: 'Garaimari', policeStation: 'Domkal', pincode: '742303', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Raipur', postOffice: 'Raipur', policeStation: 'Domkal', pincode: '742303', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Azimganjgola', postOffice: 'Azimganjgola', policeStation: 'Domkal', pincode: '742303', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Sarangpur', postOffice: 'Sarangpur', policeStation: 'Domkal', pincode: '742303', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Jalangi', postOffice: 'Jalangi', policeStation: 'Jalangi', pincode: '742305', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Sagarpara', postOffice: 'Sagarpara', policeStation: 'Jalangi', pincode: '742306', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Sahebnagar', postOffice: 'Sahebnagar', policeStation: 'Jalangi', pincode: '742305', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Islampur', postOffice: 'Islampur (Murshidabad)', policeStation: 'Islampur', pincode: '742304', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Chak Islampur', postOffice: 'Islampur (Murshidabad)', policeStation: 'Islampur', pincode: '742304', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Godhanpara', postOffice: 'Godhanpara', policeStation: 'Raninagar', pincode: '742308', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Raninagar', postOffice: 'Raninagar', policeStation: 'Raninagar', pincode: '742308', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Katlamari', postOffice: 'Katlamari', policeStation: 'Raninagar', pincode: '742308', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Hariharpara', postOffice: 'Hariharpara', policeStation: 'Hariharpara', pincode: '742166', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Choa', postOffice: 'Choa', policeStation: 'Hariharpara', pincode: '742166', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Nawda', postOffice: 'Amtala', policeStation: 'Nowda', pincode: '742121', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Amtala', postOffice: 'Amtala', policeStation: 'Nowda', pincode: '742121', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Berhampore', postOffice: 'Berhampore H.O', policeStation: 'Berhampore', pincode: '742101', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Cossimbazar', postOffice: 'Cossimbazar Raj', policeStation: 'Berhampore', pincode: '742102', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Beldanga', postOffice: 'Beldanga S.O', policeStation: 'Beldanga', pincode: '742133', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Jiaganj', postOffice: 'Jiaganj S.O', policeStation: 'Jiaganj', pincode: '742123', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Lalbagh', postOffice: 'Murshidabad S.O', policeStation: 'Murshidabad', pincode: '742149', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Lalgola', postOffice: 'Lalgola S.O', policeStation: 'Lalgola', pincode: '742148', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Bhagwangola', postOffice: 'Bhagwangola S.O', policeStation: 'Bhagwangola', pincode: '742135', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Kandi', postOffice: 'Kandi S.O', policeStation: 'Kandi', pincode: '742137', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Raghunathganj', postOffice: 'Raghunathganj S.O', policeStation: 'Raghunathganj', pincode: '742225', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Jangipur', postOffice: 'Jangipur S.O', policeStation: 'Raghunathganj', pincode: '742213', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Suti', postOffice: 'Ahiron S.O', policeStation: 'Suti', pincode: '742223', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Dhuliyan', postOffice: 'Dhuliyan S.O', policeStation: 'Samserganj', pincode: '742202', source: 'verified' },
  { state: 'West Bengal', district: 'Murshidabad', village: 'Farakka', postOffice: 'Farakka Barrage S.O', policeStation: 'Farakka', pincode: '742212', source: 'verified' },
  // Kolkata & Major West Bengal
  { state: 'West Bengal', district: 'Kolkata', village: 'BBD Bagh / Esplanade', postOffice: 'Kolkata G.P.O.', policeStation: 'Hare Street', pincode: '700001', source: 'verified' },
  { state: 'West Bengal', district: 'North 24 Parganas', village: 'Barasat', postOffice: 'Barasat H.O', policeStation: 'Barasat', pincode: '700124', source: 'verified' },
  { state: 'West Bengal', district: 'Nadia', village: 'Krishnanagar', postOffice: 'Krishnanagar H.O', policeStation: 'Kotwali (Krishnanagar)', pincode: '741101', source: 'verified' },
  { state: 'West Bengal', district: 'Nadia', village: 'Karimpur', postOffice: 'Karimpur S.O', policeStation: 'Karimpur', pincode: '741152', source: 'verified' },
  { state: 'West Bengal', district: 'Malda', village: 'English Bazar', postOffice: 'Malda H.O', policeStation: 'English Bazar', pincode: '732101', source: 'verified' }
];

// District -> Police Stations supplementary lookup for West Bengal districts
const DISTRICT_POLICE_STATIONS: Record<string, string[]> = {
  'murshidabad': [
    'Domkal', 'Jalangi', 'Raninagar', 'Islampur', 'Hariharpara', 'Nowda',
    'Berhampore', 'Beldanga', 'Rejinagar', 'Shaktipur', 'Daulatabad',
    'Murshidabad', 'Jiaganj', 'Lalgola', 'Bhagwangola', 'Ranitala',
    'Kandi', 'Bharatpur', 'Burwan', 'Khargram', 'Nabagram', 'Sagardighi',
    'Raghunathganj', 'Suti', 'Samserganj', 'Farakka'
  ],
  'nadia': [
    'Krishnanagar Kotwali', 'Karimpur', 'Tehatta', 'Nakashipara', 'Chapra',
    'Nabadwip', 'Santipur', 'Ranaghat', 'Chakdaha', 'Kalyani', 'Haringhata', 'Hogalberia', 'Thanarpara'
  ],
  'kolkata': [
    'Hare Street', 'Park Street', 'New Market', 'Bowbazar', 'Shakespeare Sarani',
    'Ballygunge', 'Gariahat', 'Tollygunge', 'Jadavpur', 'Behala', 'Shyampukur', 'Burtolla'
  ],
  'malda': [
    'English Bazar', 'Old Malda', 'Kaliachak', 'Baishnabnagar', 'Mothabari',
    'Manikchak', 'Ratua', 'Chanchal', 'Harishchandrapur', 'Gazole', 'Habibpur', 'Bamangola'
  ],
  'north 24 parganas': [
    'Barasat', 'Basirhat', 'Bangaon', 'Barrackpore', 'Bidhannagar', 'Rajarhat',
    'Habra', 'Ashokenagar', 'Deganga', 'Baduria', 'Swarupnagar', 'Haroa'
  ],
  'south 24 parganas': [
    'Alipore', 'Baruipur', 'Sonarpur', 'Canning', 'Diamond Harbour', 'Kakdwip',
    'Sagar', 'Bhangar', 'Jayanagar', 'Mathurapur', 'Falta', 'Budge Budge'
  ]
};

class IndiaLocationService {
  private baseRecords: LocationRecord[] = [];
  private cachedRecords: LocationRecord[] = [];
  private customRecords: LocationRecord[] = [];
  private statesList: string[] = [];
  private districtsByState = new Map<string, Set<string>>();
  private stateCodeByName = new Map<string, string>();
  private fetchedDistrictQueries = new Set<string>();
  private initialized = false;

  public init() {
    if (this.initialized) return;
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // 1. Index all 36 States & Union Territories from country-state-city
    const cscStates = State.getStatesOfCountry('IN');
    const stateSet = new Set<string>();

    cscStates.forEach(st => {
      const normalized = normalizeStateName(st.name);
      stateSet.add(normalized);
      this.stateCodeByName.set(normalized.toLowerCase(), st.isoCode);
      if (!this.districtsByState.has(normalized.toLowerCase())) {
        this.districtsByState.set(normalized.toLowerCase(), new Set<string>());
      }
    });

    // Ensure all 23 official West Bengal districts exist
    const wbSet = this.districtsByState.get('west bengal') || new Set<string>();
    WB_ALL_DISTRICTS.forEach(d => wbSet.add(d));
    this.districtsByState.set('west bengal', wbSet);

    // 2. Load 19,019 All-India PIN/Post Office/Village/District records from india-pincode-search
    try {
      const rawPincodes: any[] = require('india-pincode-search/db/pincode_db.json');
      const seenKey = new Set<string>();

      const pushRecord = (rec: LocationRecord) => {
        if (!rec.state || !rec.district) return;
        const key = `${rec.state}|${rec.district}|${rec.village}|${rec.postOffice}|${rec.pincode}`.toLowerCase();
        if (seenKey.has(key)) return;
        seenKey.add(key);
        this.baseRecords.push(rec);

        stateSet.add(rec.state);
        const sKey = rec.state.toLowerCase();
        if (!this.districtsByState.has(sKey)) {
          this.districtsByState.set(sKey, new Set<string>());
        }
        this.districtsByState.get(sKey)!.add(rec.district);
      };

      // Curated verified records first
      CURATED_LOCATIONS.forEach(pushRecord);

      for (const row of rawPincodes) {
        const st = normalizeStateName(row.state || '');
        const dist = normalizeDistrictName(row.city || row.district || '');
        const ps = toTitleCase(row.district || dist);
        const vil = toTitleCase(row.village || row.office || dist);
        const po = toTitleCase(row.office || row.village || '');
        const pin = String(row.pincode || '').trim();
        if (!st || !dist || !pin) continue;

        pushRecord({
          state: st,
          district: dist,
          village: vil,
          postOffice: po,
          policeStation: ps,
          pincode: pin,
          source: 'india-pincode-db'
        });
      }
    } catch (err) {
      console.error('[LocationService] Failed to load india-pincode-search DB:', err);
      CURATED_LOCATIONS.forEach(r => this.baseRecords.push(r));
    }

    // 3. Load persisted India Post cache & Custom saved locations
    this.cachedRecords = this.loadJsonArray(CACHE_FILE);
    this.customRecords = this.loadJsonArray(CUSTOM_FILE);

    // Prioritize West Bengal at top, then alphabetical across all 36 States/UTs
    const allStates = Array.from(stateSet).filter(Boolean).sort((a, b) => a.localeCompare(b));
    this.statesList = ['West Bengal', ...allStates.filter(s => s !== 'West Bengal')];
    this.initialized = true;

    console.log(`[LocationService] Indexed ${this.statesList.length} Indian States/UTs, ${this.baseRecords.length} All-India location records, ${this.cachedRecords.length} cached India Post entries, ${this.customRecords.length} custom entries.`);
  }

  private loadJsonArray(filePath: string): LocationRecord[] {
    if (!fs.existsSync(filePath)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveJsonArray(filePath: string, data: LocationRecord[]): void {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[LocationService] Error saving ${filePath}:`, err);
    }
  }

  private getAllRecords(): LocationRecord[] {
    this.init();
    const msdEntries: LocationRecord[] = murshidabadMaster.listAllEntries({ areaType: 'ALL' })
      .filter(e => e.verificationStatus !== 'REJECTED' && e.pinCode.length === 6)
      .map(e => ({
        state: 'West Bengal',
        district: e.district || 'Murshidabad',
        village: e.name,
        postOffice: e.postOffice || 'Domkal',
        policeStation: e.policeStation || 'Domkal',
        pincode: e.pinCode,
        source: 'murshidabad-master',
        areaType: e.areaType,
        blockOrMunicipality: e.blockOrMunicipality,
        gpOrWard: e.gpOrWard
      }));
    return [...this.customRecords, ...msdEntries, ...this.cachedRecords, ...this.baseRecords];
  }

  public getStates(): string[] {
    this.init();
    return this.statesList;
  }

  public getDistricts(stateName: string): string[] {
    this.init();
    const target = normalizeStateName(stateName).toLowerCase();
    if (!target) return [];

    // Collect districts that actually have postal records + country-state-city cities/districts
    const fromRecords = new Set<string>();
    for (const r of this.getAllRecords()) {
      if (r.state.toLowerCase() === target && r.district) {
        fromRecords.add(r.district);
      }
    }
    if (target === 'west bengal') {
      WB_ALL_DISTRICTS.forEach(d => fromRecords.add(d));
    }
    // Fallback to country-state-city only if a small UT has zero records
    if (fromRecords.size === 0) {
      const isoCode = this.stateCodeByName.get(target);
      if (isoCode) {
        City.getCitiesOfState('IN', isoCode).forEach(c => {
          if (c.name?.trim()) fromRecords.add(normalizeDistrictName(c.name));
        });
      }
    }

    const list = Array.from(fromRecords).filter(Boolean).sort((a, b) => a.localeCompare(b));
    // Put Murshidabad first if West Bengal
    if (target === 'west bengal' && list.includes('Murshidabad')) {
      return ['Murshidabad', ...list.filter(d => d !== 'Murshidabad')];
    }
    return list;
  }

  // Live India Post API query with persistent file caching
  private async fetchFromIndiaPost(url: string): Promise<LocationRecord[]> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3200);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return [];
      const json: any = await res.json();
      const first = Array.isArray(json) ? json[0] : json;
      if (!first || first.Status !== 'Success' || !Array.isArray(first.PostOffice)) return [];

      const mapped: LocationRecord[] = first.PostOffice.map((po: any) => {
        const state = normalizeStateName(po.State || '');
        const district = normalizeDistrictName(po.District || '');
        const name = String(po.Name || '').trim();
        const blockOrTaluk = String(po.Block && po.Block !== 'NA' ? po.Block : (po.Taluk && po.Taluk !== 'NA' ? po.Taluk : district)).trim();
        const pincode = String(po.Pincode || '').trim();

        return {
          state,
          district,
          village: name,
          postOffice: name,
          policeStation: toTitleCase(blockOrTaluk),
          pincode,
          source: 'india-post-api'
        };
      }).filter((r: LocationRecord) => r.state && r.district && r.pincode);

      if (mapped.length > 0) {
        this.mergeIntoCache(mapped);
      }
      return mapped;
    } catch {
      return [];
    }
  }

  private mergeIntoCache(newRecords: LocationRecord[]) {
    const existingKeys = new Set(
      this.cachedRecords.map(r => `${r.state}|${r.district}|${r.village}|${r.postOffice}|${r.pincode}`.toLowerCase())
    );
    let added = false;
    for (const r of newRecords) {
      const key = `${r.state}|${r.district}|${r.village}|${r.postOffice}|${r.pincode}`.toLowerCase();
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        this.cachedRecords.push(r);
        added = true;
      }
    }
    if (added) {
      // Keep cache bounded cleanly
      if (this.cachedRecords.length > 15000) {
        this.cachedRecords = this.cachedRecords.slice(-15000);
      }
      this.saveJsonArray(CACHE_FILE, this.cachedRecords);
    }
  }

  public async getVillages(stateName: string, districtName: string, query = ''): Promise<{ villages: string[]; entries: LocationRecord[] }> {
    this.init();
    const stLower = normalizeStateName(stateName).toLowerCase();
    const distLower = normalizeDistrictName(districtName).toLowerCase();
    const qLower = query.trim().toLowerCase();

    // Enrich district once via India Post official API (fast background/inline fetch if not yet fetched this session)
    const distKey = `${stLower}|${distLower}`;
    if (distLower && !this.fetchedDistrictQueries.has(distKey)) {
      this.fetchedDistrictQueries.add(distKey);
      await this.fetchFromIndiaPost(`https://api.postalpincode.in/postoffice/${encodeURIComponent(districtName.trim())}`);
    }

    let entries = this.getAllRecords().filter(r => {
      if (stLower && r.state.toLowerCase() !== stLower) return false;
      if (distLower && r.district.toLowerCase() !== distLower && !r.district.toLowerCase().includes(distLower)) return false;
      if (qLower && !r.village.toLowerCase().includes(qLower) && !r.postOffice.toLowerCase().includes(qLower)) return false;
      return true;
    });

    const villages = Array.from(new Set(entries.map(e => e.village).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return { villages, entries: entries.slice(0, 500) };
  }

  public getPostOffices(stateName: string, districtName: string, villageName = ''): { postOffices: string[]; entries: LocationRecord[] } {
    this.init();
    const stLower = normalizeStateName(stateName).toLowerCase();
    const distLower = normalizeDistrictName(districtName).toLowerCase();
    const vilLower = villageName.trim().toLowerCase();

    let entries = this.getAllRecords().filter(r => {
      if (stLower && r.state.toLowerCase() !== stLower) return false;
      if (distLower && r.district.toLowerCase() !== distLower && !r.district.toLowerCase().includes(distLower)) return false;
      return true;
    });

    if (vilLower) {
      const exactOrPartial = entries.filter(
        r => r.village.toLowerCase() === vilLower || r.village.toLowerCase().includes(vilLower) || r.postOffice.toLowerCase().includes(vilLower)
      );
      if (exactOrPartial.length > 0) {
        entries = exactOrPartial;
      }
    }

    const postOffices = Array.from(new Set(entries.map(e => e.postOffice).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return { postOffices, entries: entries.slice(0, 250) };
  }

  public getPoliceStations(stateName: string, districtName: string, villageName = '', postOfficeName = ''): { policeStations: string[]; entries: LocationRecord[] } {
    this.init();
    const stLower = normalizeStateName(stateName).toLowerCase();
    const distLower = normalizeDistrictName(districtName).toLowerCase();
    const vilLower = villageName.trim().toLowerCase();
    const poLower = postOfficeName.trim().toLowerCase();

    const distEntries = this.getAllRecords().filter(r => {
      if (stLower && r.state.toLowerCase() !== stLower) return false;
      if (distLower && r.district.toLowerCase() !== distLower && !r.district.toLowerCase().includes(distLower)) return false;
      return true;
    });

    let narrowed = distEntries;
    if (poLower) {
      const byPo = narrowed.filter(r => r.postOffice.toLowerCase() === poLower || r.postOffice.toLowerCase().includes(poLower));
      if (byPo.length > 0) narrowed = byPo;
    }
    if (vilLower) {
      const byVil = narrowed.filter(r => r.village.toLowerCase() === vilLower || r.village.toLowerCase().includes(vilLower));
      if (byVil.length > 0) narrowed = byVil;
    }

    const psSet = new Set<string>();
    const hasSpecificFilter = Boolean((poLower || vilLower) && narrowed.length < distEntries.length);

    // Put exact/narrowed Police Stations first
    narrowed.forEach(r => { if (r.policeStation) psSet.add(r.policeStation); });

    // If a specific village/P.O. uniquely identifies Police Station(s), return those directly;
    // otherwise include district police stations too
    if (!hasSpecificFilter || psSet.size === 0) {
      if (DISTRICT_POLICE_STATIONS[distLower]) {
        DISTRICT_POLICE_STATIONS[distLower].forEach(ps => psSet.add(ps));
      }
      distEntries.forEach(r => { if (r.policeStation) psSet.add(r.policeStation); });
    } else if (DISTRICT_POLICE_STATIONS[distLower]) {
      // Keep matched ones first, append district police stations sorted afterwards
      const extra = [...DISTRICT_POLICE_STATIONS[distLower]].sort((a, b) => a.localeCompare(b));
      extra.forEach(ps => psSet.add(ps));
    }

    const policeStations = Array.from(psSet).filter(Boolean);
    return { policeStations, entries: narrowed.slice(0, 150) };
  }

  public getPincodes(stateName: string, districtName: string, villageName = '', postOfficeName = '', policeStationName = ''): { pincodes: string[]; entries: LocationRecord[] } {
    this.init();
    const stLower = normalizeStateName(stateName).toLowerCase();
    const distLower = normalizeDistrictName(districtName).toLowerCase();
    const vilLower = villageName.trim().toLowerCase();
    const poLower = postOfficeName.trim().toLowerCase();
    const psLower = policeStationName.trim().toLowerCase();

    let entries = this.getAllRecords().filter(r => {
      if (stLower && r.state.toLowerCase() !== stLower) return false;
      if (distLower && r.district.toLowerCase() !== distLower && !r.district.toLowerCase().includes(distLower)) return false;
      return true;
    });

    const filterIfMatch = (list: LocationRecord[], pred: (r: LocationRecord) => boolean) => {
      const matched = list.filter(pred);
      return matched.length > 0 ? matched : list;
    };

    if (poLower) entries = filterIfMatch(entries, r => r.postOffice.toLowerCase() === poLower || r.postOffice.toLowerCase().includes(poLower));
    if (vilLower) entries = filterIfMatch(entries, r => r.village.toLowerCase() === vilLower || r.village.toLowerCase().includes(vilLower));
    if (psLower) entries = filterIfMatch(entries, r => r.policeStation.toLowerCase() === psLower || r.policeStation.toLowerCase().includes(psLower));

    const pincodes = Array.from(new Set(entries.map(e => e.pincode).filter(p => /^\d{6}$/.test(p)))).sort();
    return { pincodes, entries: entries.slice(0, 150) };
  }

  public async lookupByPincode(pin: string): Promise<{
    found: boolean;
    pincode: string;
    state: string;
    district: string;
    villages: string[];
    postOffices: string[];
    policeStations: string[];
    wards: string[];
    blocks: string[];
    entries: LocationRecord[];
  }> {
    this.init();
    const cleanPin = String(pin || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (cleanPin.length !== 6) {
      return { found: false, pincode: cleanPin, state: '', district: '', villages: [], postOffices: [], policeStations: [], wards: [], blocks: [], entries: [] };
    }

    // Fetch live from India Post Official Directory API & cache it
    const liveEntries = await this.fetchFromIndiaPost(`https://api.postalpincode.in/pincode/${cleanPin}`);
    const localEntries = this.getAllRecords().filter(r => r.pincode === cleanPin);

    // Merge deduplicated (curated + live + local)
    const mergedMap = new Map<string, LocationRecord>();
    [...localEntries, ...liveEntries].forEach(r => {
      const key = `${r.state}|${r.district}|${r.village}|${r.postOffice}|${r.pincode}`.toLowerCase();
      if (!mergedMap.has(key)) mergedMap.set(key, r);
    });

    const entries = Array.from(mergedMap.values());
    if (entries.length === 0) {
      return { found: false, pincode: cleanPin, state: '', district: '', villages: [], postOffices: [], policeStations: [], wards: [], blocks: [], entries: [] };
    }

    const primary = entries[0];
    const distLower = primary.district.toLowerCase();
    const psSet = new Set(entries.map(e => e.policeStation).filter(Boolean));
    if (DISTRICT_POLICE_STATIONS[distLower]) {
      // Keep matching police station at front if already curated
      entries.forEach(e => { if (e.policeStation) psSet.add(e.policeStation); });
    }

    const masterMeta = murshidabadMaster.listAllEntries({ pinCode: cleanPin }).filter(e => e.verificationStatus !== 'REJECTED');
    const wards = Array.from(new Set(masterMeta.filter(m => m.areaType === 'URBAN' && m.gpOrWard).map(m => m.gpOrWard)));
    const blocks = Array.from(new Set(masterMeta.filter(m => m.areaType === 'RURAL' && m.blockOrMunicipality).map(m => m.blockOrMunicipality)));

    return {
      found: true,
      pincode: cleanPin,
      state: primary.state,
      district: primary.district,
      villages: Array.from(new Set(entries.map(e => e.village).filter(Boolean))),
      postOffices: Array.from(new Set(entries.map(e => e.postOffice).filter(Boolean))),
      policeStations: Array.from(psSet),
      wards,
      blocks,
      entries
    };
  }

  public lookupByVillage(query: string, districtHint = '', stateHint = ''): {
    found: boolean;
    query: string;
    primary: {
      state: string;
      district: string;
      village: string;
      postOffice: string;
      policeStation: string;
      pincode: string;
      areaType?: 'RURAL' | 'URBAN';
      blockOrMunicipality?: string;
      gpOrWard?: string;
    } | null;
    matches: Array<{
      state: string;
      district: string;
      village: string;
      postOffice: string;
      policeStation: string;
      pincode: string;
      areaType?: 'RURAL' | 'URBAN';
      blockOrMunicipality?: string;
      gpOrWard?: string;
    }>;
  } {
    this.init();
    const q = String(query || '').trim().toLowerCase();
    if (!q || q.length < 2) {
      return { found: false, query, primary: null, matches: [] };
    }
    const distLower = districtHint ? normalizeDistrictName(districtHint).toLowerCase() : '';
    const stLower = stateHint ? normalizeStateName(stateHint).toLowerCase() : '';

    const results: Array<{
      score: number;
      state: string;
      district: string;
      village: string;
      postOffice: string;
      policeStation: string;
      pincode: string;
      areaType?: 'RURAL' | 'URBAN';
      blockOrMunicipality?: string;
      gpOrWard?: string;
    }> = [];

    // 1. Check rich Murshidabad master entries first (exact village, GP, block, or PIN)
    const masterEntries = murshidabadMaster.listAllEntries({}).filter(e => e.verificationStatus !== 'REJECTED');
    for (const m of masterEntries) {
      const nameL = String(m.name || '').toLowerCase();
      const blkL = String(m.blockOrMunicipality || '').toLowerCase();
      const gpL = String(m.gpOrWard || '').toLowerCase();
      let score = 0;
      if (nameL === q) score = 100;
      else if (nameL.startsWith(q)) score = 85;
      else if (blkL === q || gpL === q) score = 75;
      else if (nameL.includes(q) || blkL.includes(q)) score = 60;
      if (score > 0) {
        results.push({
          score,
          state: 'West Bengal',
          district: 'Murshidabad',
          village: m.name,
          postOffice: m.postOffice || '',
          policeStation: m.policeStation || 'Domkal',
          pincode: m.pinCode || '',
          areaType: m.areaType,
          blockOrMunicipality: m.blockOrMunicipality || '',
          gpOrWard: m.gpOrWard || ''
        });
      }
    }

    // 2. Check all national/local records
    for (const r of this.getAllRecords()) {
      if (stLower && r.state.toLowerCase() !== stLower) continue;
      if (distLower && r.district.toLowerCase() !== distLower && !r.district.toLowerCase().includes(distLower)) continue;
      const vL = r.village.toLowerCase();
      const poL = r.postOffice.toLowerCase();
      let score = 0;
      if (vL === q) score = 95;
      else if (vL.startsWith(q)) score = 80;
      else if (vL.includes(q) || poL === q) score = 55;
      if (score > 0) {
        results.push({
          score,
          state: r.state,
          district: r.district,
          village: r.village,
          postOffice: r.postOffice,
          policeStation: r.policeStation,
          pincode: r.pincode
        });
      }
    }

    results.sort((a, b) => b.score - a.score || a.village.localeCompare(b.village));
    const dedup = new Map<string, typeof results[number]>();
    for (const r of results) {
      const k = `${r.state}|${r.district}|${r.village}|${r.postOffice}|${r.pincode}`.toLowerCase();
      if (!dedup.has(k)) dedup.set(k, r);
      if (dedup.size >= 25) break;
    }

    const matches = Array.from(dedup.values()).map(({ score: _s, ...rest }) => rest);
    return {
      found: matches.length > 0,
      query,
      primary: matches[0] || null,
      matches
    };
  }

  public addCustomLocation(input: Partial<LocationRecord>): { success: boolean; record?: LocationRecord; message?: string } {
    this.init();
    const state = normalizeStateName(input.state || '');
    const district = normalizeDistrictName(input.district || '');
    const village = toTitleCase(input.village || '');
    const postOffice = toTitleCase(input.postOffice || '');
    const policeStation = toTitleCase(input.policeStation || '');
    const pincode = String(input.pincode || '').replace(/[^0-9]/g, '').slice(0, 6);

    if (!state || !district || !village) {
      return { success: false, message: 'State, District, and Village / Location are required.' };
    }

    const rec: LocationRecord = {
      state,
      district,
      village,
      postOffice: postOffice || village,
      policeStation: policeStation || district,
      pincode: pincode || '',
      source: 'custom-saved'
    };

    const key = `${rec.state}|${rec.district}|${rec.village}|${rec.postOffice}|${rec.pincode}`.toLowerCase();
    const exists = this.customRecords.some(
      r => `${r.state}|${r.district}|${r.village}|${r.postOffice}|${r.pincode}`.toLowerCase() === key
    );

    if (!exists) {
      this.customRecords.unshift(rec);
      this.saveJsonArray(CUSTOM_FILE, this.customRecords);
      const sKey = state.toLowerCase();
      if (!this.districtsByState.has(sKey)) {
        this.districtsByState.set(sKey, new Set());
      }
      this.districtsByState.get(sKey)!.add(district);
    }

    return { success: true, record: rec };
  }
}

export const locationService = new IndiaLocationService();
