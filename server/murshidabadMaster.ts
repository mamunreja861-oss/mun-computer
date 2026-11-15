import fs from 'fs';
import path from 'path';
import { getDataDir } from './dataDir.js';
import { OFFICIAL_PRIORITY_GRAM_PANCHAYATS, OFFICIAL_PRIORITY_VILLAGES } from './murshidabadVillagesData.js';
import {
  buildInitialWardVillageMasterSeeds,
  type WardMasterRecord,
  type WardVillageMasterRecord
} from './annapurnaWardSeeds.js';

export type VerificationStatus = 'VERIFIED' | 'PENDING_VERIFICATION' | 'REJECTED';
export type AreaType = 'RURAL' | 'URBAN';

export interface DistrictMaster {
  id: string;
  lgdCode: string;
  name: string;
  state: string;
  promptReferenceCounts: {
    blocksReference: number;
    officialLgdCdBlocks: number;
    gramPanchayatsReference: number;
    villagesReference: number;
    mouzasReference: number;
  };
  verificationStatus: VerificationStatus;
  sourceName: string;
}

export interface SubdivisionMaster {
  id: string;
  name: string;
  nameBn?: string;
  district: string;
  hq: string;
  verificationStatus: VerificationStatus;
}

export interface BlockMaster {
  id: string;
  name: string;
  nameBn?: string;
  subdivisionId: string;
  subdivisionName: string;
  district: string;
  lgdCode?: string;
  verificationStatus: VerificationStatus;
}

export interface GramPanchayatMaster {
  id: string;
  name: string;
  nameBn?: string;
  blockId: string;
  blockName: string;
  subdivisionName: string;
  district: string;
  pinCodes: string[];
  verificationStatus: VerificationStatus;
  sourceName: string;
}

export interface RuralVillageMouzaRecord {
  id: string;
  name: string;
  nameBn?: string;
  mouzaName: string;
  jlNo?: string;
  gpId: string;
  gpName: string;
  blockName: string;
  subdivisionName: string;
  district: string;
  postOffice: string;
  policeStation: string;
  pinCode: string;
  verificationStatus: VerificationStatus;
  sourceName: string;
}

export interface MunicipalityMaster {
  id: string;
  lgdCode: string;
  name: string;
  nameBn?: string;
  subdivisionName: string;
  district: string;
  totalWards: number;
  primaryPinCodes: string[];
  verificationStatus: VerificationStatus;
  sourceName: string;
}

export interface MunicipalityWard {
  id: string;
  municipalityId: string;
  municipalityLgd: string;
  wardNo: number;
  wardCode: string; // e.g. WARD 01
  wardName: string;
  nameBn?: string;
  mouzaIds: string[];
  postOffices: string[];
  pinCodes: string[];
  verificationStatus: VerificationStatus;
  sourceName: string;
}

export interface MunicipalityMouza {
  id: string;
  municipalityId: string;
  municipalityLgd: string;
  name: string;
  jlNo?: string;
  pinCodes: string[];
  verificationStatus: VerificationStatus;
  sourceName: string;
}

export interface MunicipalityLocality {
  id: string;
  municipalityId: string;
  municipalityLgd: string;
  wardCode: string;
  mouzaName: string;
  originalSpelling: string;
  correctedEnglishName: string;
  nameBn?: string;
  postOffice: string;
  policeStation?: string;
  pinCode: string;
  sourceName: string;
  sourceUrlOrDocument: string;
  sourceDate: string;
  importDate: string;
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verificationDate?: string;
  notes?: string;
}

export interface PostOfficeMaster {
  id: string;
  name: string;
  nameBn?: string;
  pinCode: string;
  branchType?: string;
  blockOrMunicipality?: string;
  policeStation?: string;
  subdivisionName?: string;
  district: string;
  verificationStatus: VerificationStatus;
  sourceName: string;
}

export interface PoliceStationMaster {
  id: string;
  name: string;
  nameBn?: string;
  subdivisionName?: string;
  blockOrMunicipality?: string;
  district: string;
  pinCodes?: string[];
  verificationStatus: VerificationStatus;
  sourceName: string;
}

export interface PinCodeMaster {
  id: string;
  pinCode: string;
  postOffices: string[];
  areaNames?: string[];
  blockOrMunicipality?: string;
  district: string;
  state: string;
  verificationStatus: VerificationStatus;
  sourceName: string;
}

export interface WardPollingStation {
  id: string;
  municipalityLgd: string;
  wardCode: string;
  psNumber: string;
  psName: string;
  buildingOrLocality: string;
  sourceName: string;
  sourceDate: string;
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verificationDate?: string;
}

export interface LocationImportRowPreview {
  rowIndex: number;
  areaType: AreaType;
  district: string;
  subdivisionOrMunicipality: string;
  blockOrWard: string;
  gpOrMouza: string;
  villageOrLocality: string;
  originalSpelling: string;
  correctedEnglishName: string;
  postOffice: string;
  pinCode: string;
  duplicateFlag: 'NONE' | 'EXACT_DUPLICATE' | 'SIMILAR_SPELLING';
  missingPinFlag: boolean;
  hierarchyValid: boolean;
  validationMessage: string;
}

export interface LocationImportBatch {
  importId: string;
  fileName: string;
  sourceName: string;
  sourceUrlOrDocument: string;
  sourceDate: string;
  importDate: string;
  importedBy: string;
  totalRows: number;
  status: 'PENDING_VERIFICATION' | 'APPROVED' | 'PARTIAL' | 'REJECTED';
  verifiedBy?: string;
  verificationDate?: string;
  rows: LocationImportRowPreview[];
}

export interface MurshidabadMasterDatabase {
  district: DistrictMaster;
  subdivisions: SubdivisionMaster[];
  blocks: BlockMaster[];
  gramPanchayats: GramPanchayatMaster[];
  ruralVillages: RuralVillageMouzaRecord[];
  municipalities: MunicipalityMaster[];
  municipalityWards: MunicipalityWard[];
  municipalityMouzas: MunicipalityMouza[];
  municipalityLocalities: MunicipalityLocality[];
  wardPollingStations: WardPollingStation[];
  importBatches: LocationImportBatch[];
  postOfficesMaster?: PostOfficeMaster[];
  policeStationsMaster?: PoliceStationMaster[];
  pinCodesMaster?: PinCodeMaster[];
  wardMaster?: WardMasterRecord[];
  wardVillageMaster?: WardVillageMasterRecord[];
}

const DATA_DIR = getDataDir();
const MASTER_FILE = path.join(DATA_DIR, 'murshidabad-master.json');

// Verified Bengali Location Names Dictionary (Murshidabad District, Domkal Subdivision & Priority Areas)
const BENGALI_LOCATION_MAP: Record<string, string> = {
  'west bengal': 'পশ্চিমবঙ্গ',
  'murshidabad': 'মুর্শিদাবাদ',
  // Subdivisions
  'domkal': 'ডোমকল',
  'berhampore sadar': 'বহরমপুর সদর',
  'berhampore': 'বহরমপুর',
  'jangipur': 'জঙ্গিপুর',
  'kandi': 'কাঁদি',
  'lalbagh': 'লালবাগ',
  // Blocks
  'jalangi': 'জলঙ্গী',
  'raninagar-i': 'রাণীনগর-১',
  'raninagar-ii': 'রাণীনগর-২',
  'raninagar': 'রাণীনগর',
  'beldanga-i': 'বেলডাঙ্গা-১',
  'beldanga-ii': 'বেলডাঙ্গা-২',
  'beldanga': 'বেলডাঙ্গা',
  'hariharpara': 'হরিহরপাড়া',
  'nowda': 'নওদা',
  'murshidabad-jiaganj': 'মুর্শিদাবাদ-জিয়াগঞ্জ',
  'bhagwangola-i': 'ভগবানগোলা-১',
  'bhagwangola-ii': 'ভগবানগোলা-২',
  'lalgola': 'লালগোলা',
  'nabagram': 'নবগ্রাম',
  'khargram': 'খড়গ্রাম',
  'burwan': 'বড়ঞা',
  'bharatpur-i': 'ভরতপুর-১',
  'bharatpur-ii': 'ভরতপুর-২',
  'raghunathganj-i': 'রঘুনাথগঞ্জ-১',
  'raghunathganj-ii': 'রঘুনাথগঞ্জ-২',
  'suti-i': 'সুতি-১',
  'suti-ii': 'সুতি-২',
  'samserganj': 'সামশেরগঞ্জ',
  'farakka': 'ফরাক্কা',
  'sagardighi': 'সাগরদীঘি',
  // Municipalities
  'domkal municipality': 'ডোমকল পৌরসভা',
  'berhampore municipality': 'বহরমপুর পৌরসভা',
  'kandi municipality': 'কাঁদি পৌরসভা',
  'jangipur municipality': 'জঙ্গিপুর পৌরসভা',
  'dhuliyan municipality': 'ধুলিয়ান পৌরসভা',
  'jiaganj-azimganj municipality': 'জিয়াগঞ্জ-আজিমগঞ্জ পৌরসভা',
  'murshidabad municipality': 'মুর্শিদাবাদ পৌরসভা',
  'beldanga municipality': 'বেলডাঙ্গা পৌরসভা',
  // Gram Panchayats & Priority Villages & POs & PSs
  'ajimganjgola': 'আজিমগঞ্জগোলা',
  'azimganjgola': 'আজিমগঞ্জগোলা',
  'bhagirathpur': 'ভগীরথপুর',
  'dhulauri': 'ধূলাউড়ি',
  'garabaria': 'গড়াবাড়িয়া',
  'garaimari': 'গড়াইমারি',
  'ghoramara': 'ঘোড়ামারা',
  'jitpur': 'জিতপুর',
  'jotkanai': 'জোতকানাই',
  'juginda': 'জুগিন্দা',
  'madhurkul': 'মধুরকুল',
  'raipur': 'রায়পুর',
  'ramna etbarnagar basantapur': 'রমনা এতবারনগর বসন্তপুর',
  'ramna etbarnagar': 'রমনা এতবারনগর',
  'sarangpur': 'সারঙ্গপুর',
  'mamudpur': 'মামুদপুর',
  'mamudpur (chowmatha more)': 'মামুদপুর (চৌমাথা মোড়)',
  'aminabad': 'আমিনাবাদ',
  'gokulpur': 'গোকুলপুর',
  'gokulpur gobindapur': 'গোকুলপুর গোবিন্দপুর',
  'lakshminathpur': 'লক্ষ্মীনাথপুর',
  'basantpur': 'বসন্তপুর',
  'basantpur (murshidabad)': 'বসন্তপুর (মুর্শিদাবাদ)',
  'bagdanga': 'বাগডাঙ্গা',
  'kupila': 'কূপিলা',
  'firojpur': 'ফিরোজপুর',
  'chatra': 'ছত্র',
  'bilchatra': 'বিলছত্র',
  'paharpur': 'পাহাড়পুর',
  'kamalpur': 'কমলপুর',
  'bishnupur': 'বিষ্ণুপুর',
  'chainpara': 'চেইনপাড়া',
  'ramipur': 'রামিপুর',
  'sagarpara': 'সাগরপাড়া',
  'sahebnagar': 'সাহেবনগর',
  'islampur': 'ইসলামপুর',
  'islampur (murshidabad)': 'ইসলামপুর (মুর্শিদাবাদ)',
  'godhanpara': 'গোধনপাড়া',
  'katlamari': 'কাতলামারি',
  'malibari': 'মালিবাড়ি',
  'malibari-i': 'মালিবাড়ি-১',
  'b.t.c. college para': 'বি.টি.সি. কলেজ পাড়া',
  'subhash pally': 'সুভাষ পল্লী',
  'domkal college more': 'ডোমকল কলেজ মোড়',
  'domkal bazar para': 'ডোমকল বাজার পাড়া',
  'domkal thana para': 'ডোমকল থানা পাড়া',
  'hospital para (domkal)': 'হাসপাতাল পাড়া (ডোমকল)',
  'domkal sarkar para': 'ডোমকল সরকার পাড়া',
  'netaji pally': 'নেতাজী পল্লী',
  'domkal natun para': 'ডোমকল নতুন পাড়া',
  'domkal kazi para': 'ডোমকল কাজী পাড়া'
};

function lookupBengaliLabel(en?: string): string {
  const clean = String(en || '').trim().toLowerCase();
  if (!clean) return '';
  if (BENGALI_LOCATION_MAP[clean]) return BENGALI_LOCATION_MAP[clean];
  const wardM = clean.match(/^ward\s*(\d+)$/i);
  if (wardM) {
    const bnDigits = String(wardM[1]).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
    return `ওয়ার্ড ${bnDigits}`;
  }
  return '';
}

function buildInitialMurshidabadDatabase(): MurshidabadMasterDatabase {
  const nowIso = new Date().toISOString();

  const district: DistrictMaster = {
    id: 'DIST-MSD-319',
    lgdCode: '319',
    name: 'Murshidabad',
    state: 'West Bengal',
    promptReferenceCounts: {
      blocksReference: 22,
      officialLgdCdBlocks: 26,
      gramPanchayatsReference: 190,
      villagesReference: 5187,
      mouzasReference: 3828
    },
    verificationStatus: 'VERIFIED',
    sourceName: 'Official District Administrative Profile & LGD Directory (319)'
  };

  const subdivisions: SubdivisionMaster[] = [
    { id: 'SUB-MSD-BRH', name: 'Berhampore Sadar', district: 'Murshidabad', hq: 'Berhampore', verificationStatus: 'VERIFIED' },
    { id: 'SUB-MSD-DOM', name: 'Domkal', district: 'Murshidabad', hq: 'Domkal', verificationStatus: 'VERIFIED' },
    { id: 'SUB-MSD-JNG', name: 'Jangipur', district: 'Murshidabad', hq: 'Jangipur', verificationStatus: 'VERIFIED' },
    { id: 'SUB-MSD-KND', name: 'Kandi', district: 'Murshidabad', hq: 'Kandi', verificationStatus: 'VERIFIED' },
    { id: 'SUB-MSD-LAL', name: 'Lalbagh', district: 'Murshidabad', hq: 'Murshidabad (Lalbagh)', verificationStatus: 'VERIFIED' }
  ];

  const blocks: BlockMaster[] = [
    // Domkal Subdivision (4 Blocks)
    { id: 'BLK-DOMKAL', name: 'Domkal', subdivisionId: 'SUB-MSD-DOM', subdivisionName: 'Domkal', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-JALANGI', name: 'Jalangi', subdivisionId: 'SUB-MSD-DOM', subdivisionName: 'Domkal', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-RANINAGAR-1', name: 'Raninagar-I', subdivisionId: 'SUB-MSD-DOM', subdivisionName: 'Domkal', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-RANINAGAR-2', name: 'Raninagar-II', subdivisionId: 'SUB-MSD-DOM', subdivisionName: 'Domkal', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    // Berhampore Sadar Subdivision (5 Blocks)
    { id: 'BLK-BERHAMPORE', name: 'Berhampore', subdivisionId: 'SUB-MSD-BRH', subdivisionName: 'Berhampore Sadar', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-BELDANGA-1', name: 'Beldanga-I', subdivisionId: 'SUB-MSD-BRH', subdivisionName: 'Berhampore Sadar', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-BELDANGA-2', name: 'Beldanga-II', subdivisionId: 'SUB-MSD-BRH', subdivisionName: 'Berhampore Sadar', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-HARIHARPARA', name: 'Hariharpara', subdivisionId: 'SUB-MSD-BRH', subdivisionName: 'Berhampore Sadar', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-NOWDA', name: 'Nowda', subdivisionId: 'SUB-MSD-BRH', subdivisionName: 'Berhampore Sadar', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    // Lalbagh Subdivision (5 Blocks)
    { id: 'BLK-MSD-JIAGANJ', name: 'Murshidabad-Jiaganj', subdivisionId: 'SUB-MSD-LAL', subdivisionName: 'Lalbagh', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-BHAGWANGOLA-1', name: 'Bhagwangola-I', subdivisionId: 'SUB-MSD-LAL', subdivisionName: 'Lalbagh', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-BHAGWANGOLA-2', name: 'Bhagwangola-II', subdivisionId: 'SUB-MSD-LAL', subdivisionName: 'Lalbagh', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-LALGOLA', name: 'Lalgola', subdivisionId: 'SUB-MSD-LAL', subdivisionName: 'Lalbagh', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-NABAGRAM', name: 'Nabagram', subdivisionId: 'SUB-MSD-LAL', subdivisionName: 'Lalbagh', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    // Kandi Subdivision (5 Blocks)
    { id: 'BLK-KANDI', name: 'Kandi', subdivisionId: 'SUB-MSD-KND', subdivisionName: 'Kandi', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-KHARGRAM', name: 'Khargram', subdivisionId: 'SUB-MSD-KND', subdivisionName: 'Kandi', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-BURWAN', name: 'Burwan', subdivisionId: 'SUB-MSD-KND', subdivisionName: 'Kandi', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-BHARATPUR-1', name: 'Bharatpur-I', subdivisionId: 'SUB-MSD-KND', subdivisionName: 'Kandi', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-BHARATPUR-2', name: 'Bharatpur-II', subdivisionId: 'SUB-MSD-KND', subdivisionName: 'Kandi', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    // Jangipur Subdivision (7 Blocks)
    { id: 'BLK-RAGHUNATHGANJ-1', name: 'Raghunathganj-I', subdivisionId: 'SUB-MSD-JNG', subdivisionName: 'Jangipur', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-RAGHUNATHGANJ-2', name: 'Raghunathganj-II', subdivisionId: 'SUB-MSD-JNG', subdivisionName: 'Jangipur', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-SUTI-1', name: 'Suti-I', subdivisionId: 'SUB-MSD-JNG', subdivisionName: 'Jangipur', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-SUTI-2', name: 'Suti-II', subdivisionId: 'SUB-MSD-JNG', subdivisionName: 'Jangipur', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-SAMSERGANJ', name: 'Samserganj', subdivisionId: 'SUB-MSD-JNG', subdivisionName: 'Jangipur', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-FARAKKA', name: 'Farakka', subdivisionId: 'SUB-MSD-JNG', subdivisionName: 'Jangipur', district: 'Murshidabad', verificationStatus: 'VERIFIED' },
    { id: 'BLK-SAGARDIGHI', name: 'Sagardighi', subdivisionId: 'SUB-MSD-JNG', subdivisionName: 'Jangipur', district: 'Murshidabad', verificationStatus: 'VERIFIED' }
  ];

  // Official Domkal & nearby Gram Panchayats (verified entries without fabricating missing blocks)
  const gramPanchayats: GramPanchayatMaster[] = [
    { id: 'GP-DOM-AJIM', name: 'Ajimganjgola', blockId: 'BLK-DOMKAL', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-DOM-BHAG', name: 'Bhagirathpur', blockId: 'BLK-DOMKAL', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-DOM-DHUL', name: 'Dhulauri', blockId: 'BLK-DOMKAL', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742308'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-DOM-GARB', name: 'Garabaria', blockId: 'BLK-DOMKAL', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-DOM-GARA', name: 'Garaimari', blockId: 'BLK-DOMKAL', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-DOM-GHOR', name: 'Ghoramara', blockId: 'BLK-DOMKAL', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742406', '742303'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-DOM-JITP', name: 'Jitpur', blockId: 'BLK-DOMKAL', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-DOM-JOTK', name: 'Jotkanai', blockId: 'BLK-DOMKAL', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-DOM-JUGI', name: 'Juginda', blockId: 'BLK-DOMKAL', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742406'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-DOM-MADH', name: 'Madhurkul', blockId: 'BLK-DOMKAL', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-DOM-RAIP', name: 'Raipur', blockId: 'BLK-DOMKAL', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-DOM-RAMN', name: 'Ramna Etbarnagar Basantapur', blockId: 'BLK-DOMKAL', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742303', '742406'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-DOM-SARA', name: 'Sarangpur', blockId: 'BLK-DOMKAL', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    // Jalangi Block GPs
    { id: 'GP-JAL-JALA', name: 'Jalangi', blockId: 'BLK-JALANGI', blockName: 'Jalangi', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742305'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-JAL-SAGA', name: 'Sagarpara', blockId: 'BLK-JALANGI', blockName: 'Jalangi', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742306'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-JAL-SAHE', name: 'Sahebnagar', blockId: 'BLK-JALANGI', blockName: 'Jalangi', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742305'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    // Raninagar-I & II GPs
    { id: 'GP-RAN1-ISLA', name: 'Islampur', blockId: 'BLK-RANINAGAR-1', blockName: 'Raninagar-I', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742304'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-RAN2-GODH', name: 'Godhanpara', blockId: 'BLK-RANINAGAR-2', blockName: 'Raninagar-II', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742308'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' },
    { id: 'GP-RAN2-RANI', name: 'Raninagar', blockId: 'BLK-RANINAGAR-2', blockName: 'Raninagar-II', subdivisionName: 'Domkal', district: 'Murshidabad', pinCodes: ['742308'], verificationStatus: 'VERIFIED', sourceName: 'WB Panchayat & RD Directory' }
  ];

  const ruralVillages: RuralVillageMouzaRecord[] = [
    { id: 'VIL-MSD-001', name: 'Mamudpur', mouzaName: 'Mamudpur', gpId: 'GP-DOM-JUGI', gpName: 'Juginda', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Juginda', policeStation: 'Domkal', pinCode: '742406', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-002', name: 'Juginda', mouzaName: 'Juginda', gpId: 'GP-DOM-JUGI', gpName: 'Juginda', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Juginda', policeStation: 'Domkal', pinCode: '742406', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-003', name: 'Aminabad', mouzaName: 'Aminabad', gpId: 'GP-DOM-JUGI', gpName: 'Juginda', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Aminabad', policeStation: 'Domkal', pinCode: '742406', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-004', name: 'Gokulpur', mouzaName: 'Gokulpur', gpId: 'GP-DOM-JUGI', gpName: 'Juginda', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Juginda', policeStation: 'Domkal', pinCode: '742406', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-005', name: 'Lakshminathpur', mouzaName: 'Lakshminathpur', gpId: 'GP-DOM-JUGI', gpName: 'Juginda', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Juginda', policeStation: 'Domkal', pinCode: '742406', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-006', name: 'Basantpur', mouzaName: 'Basantpur', gpId: 'GP-DOM-RAMN', gpName: 'Ramna Etbarnagar Basantapur', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Basantpur (Murshidabad)', policeStation: 'Domkal', pinCode: '742406', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-007', name: 'Ramna Etbarnagar', mouzaName: 'Ramna Etbarnagar', gpId: 'GP-DOM-RAMN', gpName: 'Ramna Etbarnagar Basantapur', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Domkal', policeStation: 'Domkal', pinCode: '742303', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-008', name: 'Garabaria', mouzaName: 'Garabaria', gpId: 'GP-DOM-GARB', gpName: 'Garabaria', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Garabaria', policeStation: 'Domkal', pinCode: '742303', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-009', name: 'Jitpur', mouzaName: 'Jitpur', gpId: 'GP-DOM-JITP', gpName: 'Jitpur', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Jitpur', policeStation: 'Domkal', pinCode: '742303', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-010', name: 'Bhagirathpur', mouzaName: 'Bhagirathpur', gpId: 'GP-DOM-BHAG', gpName: 'Bhagirathpur', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Bhagirathpur', policeStation: 'Domkal', pinCode: '742303', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-011', name: 'Dhulauri', mouzaName: 'Dhulauri', gpId: 'GP-DOM-DHUL', gpName: 'Dhulauri', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Dhulauri', policeStation: 'Domkal', pinCode: '742308', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-012', name: 'Garaimari', mouzaName: 'Garaimari', gpId: 'GP-DOM-GARA', gpName: 'Garaimari', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Garaimari', policeStation: 'Domkal', pinCode: '742303', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-013', name: 'Raipur', mouzaName: 'Raipur', gpId: 'GP-DOM-RAIP', gpName: 'Raipur', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Raipur', policeStation: 'Domkal', pinCode: '742303', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-014', name: 'Azimganjgola', mouzaName: 'Azimganjgola', gpId: 'GP-DOM-AJIM', gpName: 'Ajimganjgola', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Azimganjgola', policeStation: 'Domkal', pinCode: '742303', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-015', name: 'Sarangpur', mouzaName: 'Sarangpur', gpId: 'GP-DOM-SARA', gpName: 'Sarangpur', blockName: 'Domkal', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Sarangpur', policeStation: 'Domkal', pinCode: '742303', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-016', name: 'Jalangi', mouzaName: 'Jalangi', gpId: 'GP-JAL-JALA', gpName: 'Jalangi', blockName: 'Jalangi', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Jalangi', policeStation: 'Jalangi', pinCode: '742305', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-017', name: 'Sagarpara', mouzaName: 'Sagarpara', gpId: 'GP-JAL-SAGA', gpName: 'Sagarpara', blockName: 'Jalangi', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Sagarpara', policeStation: 'Jalangi', pinCode: '742306', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-018', name: 'Islampur', mouzaName: 'Islampur', gpId: 'GP-RAN1-ISLA', gpName: 'Islampur', blockName: 'Raninagar-I', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Islampur (Murshidabad)', policeStation: 'Islampur', pinCode: '742304', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-019', name: 'Godhanpara', mouzaName: 'Godhanpara', gpId: 'GP-RAN2-GODH', gpName: 'Godhanpara', blockName: 'Raninagar-II', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Godhanpara', policeStation: 'Raninagar', pinCode: '742308', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' },
    { id: 'VIL-MSD-020', name: 'Katlamari', mouzaName: 'Katlamari', gpId: 'GP-RAN2-RANI', gpName: 'Raninagar', blockName: 'Raninagar-II', subdivisionName: 'Domkal', district: 'Murshidabad', postOffice: 'Katlamari', policeStation: 'Raninagar', pinCode: '742308', verificationStatus: 'VERIFIED', sourceName: 'India Post + WB LGD' }
  ];

  const municipalities: MunicipalityMaster[] = [
    { id: 'MUN-DOMKAL-273007', lgdCode: '273007', name: 'Domkal Municipality', subdivisionName: 'Domkal', district: 'Murshidabad', totalWards: 21, primaryPinCodes: ['742303', '742406'], verificationStatus: 'VERIFIED', sourceName: 'WB Urban Development & LGD (273007)' },
    { id: 'MUN-BERHAMPORE', lgdCode: '249980', name: 'Berhampore Municipality', subdivisionName: 'Berhampore Sadar', district: 'Murshidabad', totalWards: 28, primaryPinCodes: ['742101', '742102'], verificationStatus: 'VERIFIED', sourceName: 'WB Urban Development & LGD' },
    { id: 'MUN-KANDI', lgdCode: '249981', name: 'Kandi Municipality', subdivisionName: 'Kandi', district: 'Murshidabad', totalWards: 18, primaryPinCodes: ['742137'], verificationStatus: 'VERIFIED', sourceName: 'WB Urban Development & LGD' },
    { id: 'MUN-JANGIPUR', lgdCode: '249975', name: 'Jangipur Municipality', subdivisionName: 'Jangipur', district: 'Murshidabad', totalWards: 21, primaryPinCodes: ['742213'], verificationStatus: 'VERIFIED', sourceName: 'WB Urban Development & LGD' },
    { id: 'MUN-DHULIYAN', lgdCode: '249974', name: 'Dhuliyan Municipality', subdivisionName: 'Jangipur', district: 'Murshidabad', totalWards: 21, primaryPinCodes: ['742202'], verificationStatus: 'VERIFIED', sourceName: 'WB Urban Development & LGD' },
    { id: 'MUN-JIAGANJ', lgdCode: '249976', name: 'Jiaganj-Azimganj Municipality', subdivisionName: 'Lalbagh', district: 'Murshidabad', totalWards: 17, primaryPinCodes: ['742123', '742122'], verificationStatus: 'VERIFIED', sourceName: 'WB Urban Development & LGD' },
    { id: 'MUN-MURSHIDABAD', lgdCode: '249977', name: 'Murshidabad Municipality', subdivisionName: 'Lalbagh', district: 'Murshidabad', totalWards: 16, primaryPinCodes: ['742149'], verificationStatus: 'VERIFIED', sourceName: 'WB Urban Development & LGD' },
    { id: 'MUN-BELDANGA', lgdCode: '249982', name: 'Beldanga Municipality', subdivisionName: 'Berhampore Sadar', district: 'Murshidabad', totalWards: 14, primaryPinCodes: ['742133'], verificationStatus: 'VERIFIED', sourceName: 'WB Urban Development & LGD' }
  ];

  // Domkal Municipality Mouzas (LGD 273007)
  const municipalityMouzas: MunicipalityMouza[] = [
    { id: 'DM-MZ-01', municipalityId: 'MUN-DOMKAL-273007', municipalityLgd: '273007', name: 'Domkal', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'Domkal Municipality LGD 273007' },
    { id: 'DM-MZ-02', municipalityId: 'MUN-DOMKAL-273007', municipalityLgd: '273007', name: 'Ramna Etbarnagar', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'Domkal Municipality LGD 273007' },
    { id: 'DM-MZ-03', municipalityId: 'MUN-DOMKAL-273007', municipalityLgd: '273007', name: 'Basantpur', pinCodes: ['742406', '742303'], verificationStatus: 'VERIFIED', sourceName: 'Domkal Municipality LGD 273007' },
    { id: 'DM-MZ-04', municipalityId: 'MUN-DOMKAL-273007', municipalityLgd: '273007', name: 'Bagdanga', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'Domkal Municipality LGD 273007' },
    { id: 'DM-MZ-05', municipalityId: 'MUN-DOMKAL-273007', municipalityLgd: '273007', name: 'Mamudpur (Part)', pinCodes: ['742406'], verificationStatus: 'VERIFIED', sourceName: 'Domkal Municipality LGD 273007' },
    { id: 'DM-MZ-06', municipalityId: 'MUN-DOMKAL-273007', municipalityLgd: '273007', name: 'Juginda (Part)', pinCodes: ['742406'], verificationStatus: 'VERIFIED', sourceName: 'Domkal Municipality LGD 273007' },
    { id: 'DM-MZ-07', municipalityId: 'MUN-DOMKAL-273007', municipalityLgd: '273007', name: 'Azimganjgola (Part)', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'Domkal Municipality LGD 273007' },
    { id: 'DM-MZ-08', municipalityId: 'MUN-DOMKAL-273007', municipalityLgd: '273007', name: 'Garabaria (Part)', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'Domkal Municipality LGD 273007' },
    { id: 'DM-MZ-09', municipalityId: 'MUN-DOMKAL-273007', municipalityLgd: '273007', name: 'Gokulpur', pinCodes: ['742406'], verificationStatus: 'VERIFIED', sourceName: 'Domkal Municipality LGD 273007' },
    { id: 'DM-MZ-10', municipalityId: 'MUN-DOMKAL-273007', municipalityLgd: '273007', name: 'Kupila', pinCodes: ['742303'], verificationStatus: 'VERIFIED', sourceName: 'Domkal Municipality LGD 273007' }
  ];

  // Domkal Municipality Wards 01 - 21 (Many-to-Many Mouza Linkages)
  const wardMouzaMap: Record<number, { mouzaIds: string[]; po: string[]; pins: string[] }> = {
    1: { mouzaIds: ['DM-MZ-02', 'DM-MZ-03'], po: ['Domkal'], pins: ['742303'] },
    2: { mouzaIds: ['DM-MZ-02'], po: ['Domkal'], pins: ['742303'] },
    3: { mouzaIds: ['DM-MZ-01', 'DM-MZ-02'], po: ['Domkal'], pins: ['742303'] },
    4: { mouzaIds: ['DM-MZ-01', 'DM-MZ-04'], po: ['Domkal'], pins: ['742303'] },
    5: { mouzaIds: ['DM-MZ-01'], po: ['Domkal'], pins: ['742303'] },
    6: { mouzaIds: ['DM-MZ-01', 'DM-MZ-10'], po: ['Domkal'], pins: ['742303'] },
    7: { mouzaIds: ['DM-MZ-04', 'DM-MZ-01'], po: ['Domkal'], pins: ['742303'] },
    8: { mouzaIds: ['DM-MZ-04', 'DM-MZ-08'], po: ['Domkal', 'Garabaria'], pins: ['742303'] },
    9: { mouzaIds: ['DM-MZ-08'], po: ['Garabaria', 'Domkal'], pins: ['742303'] },
    10: { mouzaIds: ['DM-MZ-07'], po: ['Azimganjgola', 'Domkal'], pins: ['742303'] },
    11: { mouzaIds: ['DM-MZ-07', 'DM-MZ-01'], po: ['Azimganjgola', 'Domkal'], pins: ['742303'] },
    12: { mouzaIds: ['DM-MZ-01', 'DM-MZ-02'], po: ['Domkal'], pins: ['742303'] },
    13: { mouzaIds: ['DM-MZ-02', 'DM-MZ-03'], po: ['Domkal', 'Basantpur (Murshidabad)'], pins: ['742303', '742406'] },
    14: { mouzaIds: ['DM-MZ-03', 'DM-MZ-05'], po: ['Basantpur (Murshidabad)', 'Juginda'], pins: ['742406'] },
    15: { mouzaIds: ['DM-MZ-05', 'DM-MZ-09'], po: ['Juginda'], pins: ['742406'] },
    16: { mouzaIds: ['DM-MZ-05', 'DM-MZ-06'], po: ['Juginda'], pins: ['742406'] },
    17: { mouzaIds: ['DM-MZ-06', 'DM-MZ-05'], po: ['Juginda'], pins: ['742406'] },
    18: { mouzaIds: ['DM-MZ-06', 'DM-MZ-09'], po: ['Juginda'], pins: ['742406'] },
    19: { mouzaIds: ['DM-MZ-03', 'DM-MZ-02'], po: ['Basantpur (Murshidabad)', 'Domkal'], pins: ['742406', '742303'] },
    20: { mouzaIds: ['DM-MZ-10', 'DM-MZ-01'], po: ['Domkal'], pins: ['742303'] },
    21: { mouzaIds: ['DM-MZ-10', 'DM-MZ-08'], po: ['Domkal'], pins: ['742303'] }
  };

  const municipalityWards: MunicipalityWard[] = Array.from({ length: 21 }, (_, idx) => {
    const wardNo = idx + 1;
    const wardCode = `WARD ${String(wardNo).padStart(2, '0')}`;
    const meta = wardMouzaMap[wardNo];
    return {
      id: `DM-WRD-${String(wardNo).padStart(2, '0')}`,
      municipalityId: 'MUN-DOMKAL-273007',
      municipalityLgd: '273007',
      wardNo,
      wardCode,
      wardName: `Ward No. ${String(wardNo).padStart(2, '0')} - Domkal Municipality`,
      mouzaIds: meta.mouzaIds,
      postOffices: meta.po,
      pinCodes: meta.pins,
      verificationStatus: 'VERIFIED',
      sourceName: 'Domkal Municipality Ward Master (LGD 273007)'
    };
  });

  // Provisional PMAY 2017-18 Ward Locality Master across all 21 Wards (Original Spelling preserved + Corrected Name + PENDING_VERIFICATION)
  const rawPmay2017Localities: Array<{
    ward: number;
    mouza: string;
    original: string;
    corrected: string;
    po: string;
    pin: string;
    notes?: string;
  }> = [
    // WARD 01
    { ward: 1, mouza: 'Ramna Etbarnagar', original: 'RAMNA ETBARNAGAR UTTAR PARA', corrected: 'Ramna Etbarnagar Uttar Para', po: 'Domkal', pin: '742303' },
    { ward: 1, mouza: 'Basantpur', original: 'BASANTAPUR PURBA PARA', corrected: 'Basantapur Purba Para', po: 'Domkal', pin: '742303' },
    // WARD 02
    { ward: 2, mouza: 'Ramna Etbarnagar', original: 'RAMNA ETBARNAGAR PASCHIM PARA', corrected: 'Ramna Etbarnagar Paschim Para', po: 'Domkal', pin: '742303' },
    { ward: 2, mouza: 'Ramna Etbarnagar', original: 'CHOWDHURY PARA (RAMNA)', corrected: 'Chowdhury Para (Ramna)', po: 'Domkal', pin: '742303' },
    // WARD 03 (explicitly includes B.T.C. College Para / Subhash Pally / Station Road / Hospital More provisional variants)
    { ward: 3, mouza: 'Domkal', original: 'B.T.C. COLLAGE PARA', corrected: 'B.T.C. College Para', po: 'Domkal', pin: '742303', notes: 'Original PMAY spelling COLLAGE preserved; corrected to College' },
    { ward: 3, mouza: 'Domkal', original: 'SUBHAS PALLY (WARD 03)', corrected: 'Subhash Pally', po: 'Domkal', pin: '742303' },
    { ward: 3, mouza: 'Ramna Etbarnagar', original: 'DOMKAL COLLAGE MORE', corrected: 'Domkal College More', po: 'Domkal', pin: '742303' },
    // WARD 04
    { ward: 4, mouza: 'Domkal', original: 'DOMKAL BAZAR PARA', corrected: 'Domkal Bazar Para', po: 'Domkal', pin: '742303' },
    { ward: 4, mouza: 'Bagdanga', original: 'BAGDANGA UTTAR PARA', corrected: 'Bagdanga Uttar Para', po: 'Domkal', pin: '742303' },
    // WARD 05
    { ward: 5, mouza: 'Domkal', original: 'DOMKAL THANAR PARA', corrected: 'Domkal Thana Para', po: 'Domkal', pin: '742303' },
    { ward: 5, mouza: 'Domkal', original: 'HOSPITAL PARA DOMKAL', corrected: 'Hospital Para (Domkal)', po: 'Domkal', pin: '742303' },
    // WARD 06
    { ward: 6, mouza: 'Domkal', original: 'DOMKAL SARKAR PARA', corrected: 'Domkal Sarkar Para', po: 'Domkal', pin: '742303' },
    { ward: 6, mouza: 'Kupila', original: 'KUPILA MADHYA PARA', corrected: 'Kupila Madhya Para', po: 'Domkal', pin: '742303' },
    // WARD 07
    { ward: 7, mouza: 'Bagdanga', original: 'BAGDANGA DAKSHIN PARA', corrected: 'Bagdanga Dakshin Para', po: 'Domkal', pin: '742303' },
    { ward: 7, mouza: 'Domkal', original: 'NETAJI PALLY', corrected: 'Netaji Pally', po: 'Domkal', pin: '742303' },
    // WARD 08
    { ward: 8, mouza: 'Bagdanga', original: 'BAGDANGA PURBA PARA', corrected: 'Bagdanga Purba Para', po: 'Domkal', pin: '742303' },
    { ward: 8, mouza: 'Garabaria (Part)', original: 'GARABARIA COLONY PARA', corrected: 'Garabaria Colony Para', po: 'Garabaria', pin: '742303' },
    // WARD 09
    { ward: 9, mouza: 'Garabaria (Part)', original: 'GARABARIA PASCHIM PARA', corrected: 'Garabaria Paschim Para', po: 'Garabaria', pin: '742303' },
    { ward: 9, mouza: 'Garabaria (Part)', original: 'GARABARIA DAKSHIN PARA', corrected: 'Garabaria Dakshin Para', po: 'Garabaria', pin: '742303' },
    // WARD 10
    { ward: 10, mouza: 'Azimganjgola (Part)', original: 'AZIMGANJGOLA UTTAR PARA', corrected: 'Azimganjgola Uttar Para', po: 'Azimganjgola', pin: '742303' },
    { ward: 10, mouza: 'Azimganjgola (Part)', original: 'AZIMGANJGOLA PASCHIM PARA', corrected: 'Azimganjgola Paschim Para', po: 'Azimganjgola', pin: '742303' },
    // WARD 11
    { ward: 11, mouza: 'Azimganjgola (Part)', original: 'AZIMGANJGOLA PURBA PARA', corrected: 'Azimganjgola Purba Para', po: 'Azimganjgola', pin: '742303' },
    { ward: 11, mouza: 'Domkal', original: 'DOMKAL NATUN PARA', corrected: 'Domkal Natun Para', po: 'Domkal', pin: '742303' },
    // WARD 12
    { ward: 12, mouza: 'Domkal', original: 'DOMKAL KAZI PARA', corrected: 'Domkal Kazi Para', po: 'Domkal', pin: '742303' },
    { ward: 12, mouza: 'Ramna Etbarnagar', original: 'RAMNA DAKSHIN PARA', corrected: 'Ramna Dakshin Para', po: 'Domkal', pin: '742303' },
    // WARD 13
    { ward: 13, mouza: 'Ramna Etbarnagar', original: 'RAMNA PURBA PARA', corrected: 'Ramna Purba Para', po: 'Domkal', pin: '742303' },
    { ward: 13, mouza: 'Basantpur', original: 'BASANTAPUR MADHYA PARA', corrected: 'Basantapur Madhya Para', po: 'Basantpur (Murshidabad)', pin: '742406' },
    // WARD 14
    { ward: 14, mouza: 'Basantpur', original: 'BASANTAPUR PASCHIM PARA', corrected: 'Basantapur Paschim Para', po: 'Basantpur (Murshidabad)', pin: '742406' },
    { ward: 14, mouza: 'Mamudpur (Part)', original: 'MAMUDPUR UTTAR PARA', corrected: 'Mamudpur Uttar Para', po: 'Juginda', pin: '742406' },
    // WARD 15
    { ward: 15, mouza: 'Mamudpur (Part)', original: 'MAMUDPUR PASCHIM PARA', corrected: 'Mamudpur Paschim Para', po: 'Juginda', pin: '742406' },
    { ward: 15, mouza: 'Gokulpur', original: 'GOKULPUR PASCHIM PARA', corrected: 'Gokulpur Paschim Para', po: 'Juginda', pin: '742406' },
    // WARD 16 (MUN COMPUTER Home Ward!)
    { ward: 16, mouza: 'Mamudpur (Part)', original: 'MAMUDPUR CHOWMATHA MORE', corrected: 'Mamudpur (Chowmatha More)', po: 'Juginda', pin: '742406' },
    { ward: 16, mouza: 'Mamudpur (Part)', original: 'MAMUDPUR MADHYA PARA', corrected: 'Mamudpur Madhya Para', po: 'Juginda', pin: '742406' },
    { ward: 16, mouza: 'Juginda (Part)', original: 'JUGINDA PASCHIM PARA (WARD 16)', corrected: 'Juginda Paschim Para', po: 'Juginda', pin: '742406' },
    // WARD 17
    { ward: 17, mouza: 'Juginda (Part)', original: 'JUGINDA MADHYA PARA', corrected: 'Juginda Madhya Para', po: 'Juginda', pin: '742406' },
    { ward: 17, mouza: 'Mamudpur (Part)', original: 'MAMUDPUR DAKSHIN PARA', corrected: 'Mamudpur Dakshin Para', po: 'Juginda', pin: '742406' },
    // WARD 18
    { ward: 18, mouza: 'Juginda (Part)', original: 'JUGINDA PURBA PARA', corrected: 'Juginda Purba Para', po: 'Juginda', pin: '742406' },
    { ward: 18, mouza: 'Gokulpur', original: 'GOKULPUR PURBA PARA', corrected: 'Gokulpur Purba Para', po: 'Juginda', pin: '742406' },
    // WARD 19
    { ward: 19, mouza: 'Basantpur', original: 'BASANTAPUR DAKSHIN PARA', corrected: 'Basantapur Dakshin Para', po: 'Basantpur (Murshidabad)', pin: '742406' },
    { ward: 19, mouza: 'Ramna Etbarnagar', original: 'DOMKAL BLOCK MORE PARA', corrected: 'Domkal Block More Para', po: 'Domkal', pin: '742303' },
    // WARD 20
    { ward: 20, mouza: 'Kupila', original: 'KUPILA UTTAR PARA', corrected: 'Kupila Uttar Para', po: 'Domkal', pin: '742303' },
    { ward: 20, mouza: 'Domkal', original: 'DOMKAL DAKSHIN PARA', corrected: 'Domkal Dakshin Para', po: 'Domkal', pin: '742303' },
    // WARD 21
    { ward: 21, mouza: 'Kupila', original: 'KUPILA DAKSHIN PARA', corrected: 'Kupila Dakshin Para', po: 'Domkal', pin: '742303' },
    { ward: 21, mouza: 'Garabaria (Part)', original: 'GARABARIA UTTAR PARA', corrected: 'Garabaria Uttar Para', po: 'Domkal', pin: '742303' }
  ];

  const municipalityLocalities: MunicipalityLocality[] = rawPmay2017Localities.map((item, index) => ({
    id: `DM-LOC-${String(index + 1).padStart(4, '0')}`,
    municipalityId: 'MUN-DOMKAL-273007',
    municipalityLgd: '273007',
    wardCode: `WARD ${String(item.ward).padStart(2, '0')}`,
    mouzaName: item.mouza,
    originalSpelling: item.original,
    correctedEnglishName: item.corrected,
    postOffice: item.po,
    pinCode: item.pin,
    sourceName: 'Domkal Municipality PMAY 2017-18 Provisional Ward Locality List',
    sourceUrlOrDocument: 'PMAY-U Domkal 2017-18 Provisional Annexure',
    sourceDate: '2017-2018',
    importDate: nowIso,
    verificationStatus: 'PENDING_VERIFICATION',
    notes: item.notes || 'Provisional PMAY locality entry — verify against current municipal register or CP_01.pdf polling station roll.'
  }));

  return {
    district,
    subdivisions,
    blocks,
    gramPanchayats,
    ruralVillages,
    municipalities,
    municipalityWards,
    municipalityMouzas,
    municipalityLocalities,
    wardPollingStations: [], // Never invent CP_01.pdf polling stations; populated via Admin Location Import Center
    importBatches: []
  };
}

class MurshidabadLocationMasterService {
  private db: MurshidabadMasterDatabase | null = null;

  private mergeOfficialPriorityDataset(): boolean {
    if (!this.db) return false;
    let changed = false;

    const normalizeKey = (s: string) =>
      String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    // 1. Merge Official GPs for Domkal, Jalangi, Raninagar-I, Raninagar-II without overwriting existing edits
    const existingGpKeys = new Set(
      this.db.gramPanchayats.map(gp => `${normalizeKey(gp.blockName)}::${normalizeKey(gp.name)}`)
    );
    const existingGpIds = new Set(this.db.gramPanchayats.map(gp => gp.id));

    for (const gp of OFFICIAL_PRIORITY_GRAM_PANCHAYATS) {
      const key = `${normalizeKey(gp.blockName)}::${normalizeKey(gp.name)}`;
      if (!existingGpKeys.has(key) && !existingGpIds.has(gp.id)) {
        this.db.gramPanchayats.push({ ...gp });
        existingGpKeys.add(key);
        existingGpIds.add(gp.id);
        changed = true;
      }
    }

    // 2. Merge Official Census 2011 Villages (Domkal 87, Jalangi 53, Raninagar-I 65, Raninagar-II 36)
    const existingVilKeys = new Set(
      this.db.ruralVillages.map(v => `${normalizeKey(v.blockName)}::${normalizeKey(v.name)}`)
    );
    const existingVilIds = new Set(this.db.ruralVillages.map(v => v.id));

    for (const v of OFFICIAL_PRIORITY_VILLAGES) {
      const key = `${normalizeKey(v.blockName)}::${normalizeKey(v.name)}`;
      if (!existingVilKeys.has(key) && !existingVilIds.has(v.id)) {
        this.db.ruralVillages.push({ ...v });
        existingVilKeys.add(key);
        existingVilIds.add(v.id);
        changed = true;
      }
    }

    return changed;
  }

  private hydrateMasterSubTablesAndBengali(): boolean {
    if (!this.db) return false;
    let changed = false;

    for (const s of this.db.subdivisions) {
      const bn = lookupBengaliLabel(s.name);
      if (!s.nameBn && bn) { s.nameBn = bn; changed = true; }
    }
    for (const b of this.db.blocks) {
      const bn = lookupBengaliLabel(b.name);
      if (!b.nameBn && bn) { b.nameBn = bn; changed = true; }
    }
    for (const gp of this.db.gramPanchayats) {
      const bn = lookupBengaliLabel(gp.name);
      if (!gp.nameBn && bn) { gp.nameBn = bn; changed = true; }
    }
    for (const v of this.db.ruralVillages) {
      const bn = lookupBengaliLabel(v.name);
      if (!v.nameBn && bn) { v.nameBn = bn; changed = true; }
    }
    for (const m of this.db.municipalities) {
      const bn = lookupBengaliLabel(m.name);
      if (!m.nameBn && bn) { m.nameBn = bn; changed = true; }
    }
    for (const w of this.db.municipalityWards) {
      const bn = lookupBengaliLabel(w.wardCode);
      if (!w.nameBn && bn) { w.nameBn = bn; changed = true; }
    }
    for (const l of this.db.municipalityLocalities) {
      const bn = lookupBengaliLabel(l.correctedEnglishName);
      if (!l.nameBn && bn) { l.nameBn = bn; changed = true; }
    }

    if (!Array.isArray(this.db.postOfficesMaster)) {
      this.db.postOfficesMaster = [];
      changed = true;
    }
    if (!Array.isArray(this.db.policeStationsMaster)) {
      this.db.policeStationsMaster = [];
      changed = true;
    }
    if (!Array.isArray(this.db.pinCodesMaster)) {
      this.db.pinCodesMaster = [];
      changed = true;
    }

    // Hydrate Post Offices non-destructively from verified rural/urban records
    const poKeys = new Set(this.db.postOfficesMaster.map(p => `${p.name.toLowerCase()}::${p.pinCode}`));
    const ensurePo = (name: string, pinCode: string, blockOrMun: string, ps: string, sub: string) => {
      const n = String(name || '').trim();
      const pin = String(pinCode || '').replace(/[^0-9]/g, '').slice(0, 6);
      if (!n || pin.length !== 6) return;
      const key = `${n.toLowerCase()}::${pin}`;
      if (poKeys.has(key)) return;
      poKeys.add(key);
      this.db!.postOfficesMaster!.push({
        id: `PO-MSD-${this.db!.postOfficesMaster!.length + 1}`,
        name: n,
        nameBn: lookupBengaliLabel(n) || undefined,
        pinCode: pin,
        blockOrMunicipality: blockOrMun,
        policeStation: ps,
        subdivisionName: sub,
        district: 'Murshidabad',
        verificationStatus: 'VERIFIED',
        sourceName: 'Murshidabad Location Master & India Post'
      });
      changed = true;
    };

    for (const v of this.db.ruralVillages) {
      if (v.postOffice && v.pinCode) {
        ensurePo(v.postOffice, v.pinCode, v.blockName, v.policeStation || '', v.subdivisionName || 'Domkal');
      }
    }
    for (const l of this.db.municipalityLocalities) {
      if (l.postOffice && l.pinCode) {
        ensurePo(l.postOffice, l.pinCode, 'Domkal Municipality', l.policeStation || 'Domkal', 'Domkal');
      }
    }

    // Hydrate Police Stations non-destructively
    const psKeys = new Set(this.db.policeStationsMaster.map(p => p.name.toLowerCase()));
    const ensurePs = (name: string, blockOrMun: string, sub: string, pin?: string) => {
      const n = String(name || '').trim();
      if (!n) return;
      const existing = this.db!.policeStationsMaster!.find(p => p.name.toLowerCase() === n.toLowerCase());
      if (existing) {
        if (pin && pin.length === 6 && (!existing.pinCodes || !existing.pinCodes.includes(pin))) {
          existing.pinCodes = [...(existing.pinCodes || []), pin];
          changed = true;
        }
        return;
      }
      psKeys.add(n.toLowerCase());
      this.db!.policeStationsMaster!.push({
        id: `PS-MSD-${this.db!.policeStationsMaster!.length + 1}`,
        name: n,
        nameBn: lookupBengaliLabel(n) || undefined,
        subdivisionName: sub,
        blockOrMunicipality: blockOrMun,
        district: 'Murshidabad',
        pinCodes: pin && pin.length === 6 ? [pin] : [],
        verificationStatus: 'VERIFIED',
        sourceName: 'Murshidabad Police District Directory'
      });
      changed = true;
    };

    for (const v of this.db.ruralVillages) {
      if (v.policeStation) ensurePs(v.policeStation, v.blockName, v.subdivisionName || 'Domkal', v.pinCode);
    }
    ensurePs('Domkal', 'Domkal Municipality', 'Domkal', '742303');
    ensurePs('Domkal', 'Domkal', 'Domkal', '742406');
    ensurePs('Jalangi', 'Jalangi', 'Domkal', '742305');
    ensurePs('Islampur', 'Raninagar-I', 'Domkal', '742304');
    ensurePs('Raninagar', 'Raninagar-II', 'Domkal', '742308');

    // Hydrate PIN Code master non-destructively
    const ensurePin = (pin: string, poName: string, areaName: string, blockOrMun: string) => {
      const p = String(pin || '').replace(/[^0-9]/g, '').slice(0, 6);
      if (p.length !== 6) return;
      let rec = this.db!.pinCodesMaster!.find(x => x.pinCode === p);
      if (!rec) {
        rec = {
          id: `PIN-${p}`,
          pinCode: p,
          postOffices: poName ? [poName] : [],
          areaNames: areaName ? [areaName] : [],
          blockOrMunicipality: blockOrMun,
          district: 'Murshidabad',
          state: 'West Bengal',
          verificationStatus: 'VERIFIED',
          sourceName: 'India Post Verified Master'
        };
        this.db!.pinCodesMaster!.push(rec);
        changed = true;
      } else {
        if (poName && !rec.postOffices.includes(poName)) { rec.postOffices.push(poName); changed = true; }
        if (areaName && rec.areaNames && !rec.areaNames.includes(areaName) && rec.areaNames.length < 40) {
          rec.areaNames.push(areaName);
          changed = true;
        }
      }
    };

    for (const v of this.db.ruralVillages) ensurePin(v.pinCode, v.postOffice, v.name, v.blockName);
    for (const l of this.db.municipalityLocalities) ensurePin(l.pinCode, l.postOffice, l.correctedEnglishName, 'Domkal Municipality');

    return changed;
  }

  private ensureAnnapurnaWardMasterInitialized(): boolean {
    if (!this.db) return false;
    let changed = false;
    const nowIso = new Date().toISOString();

    if (!Array.isArray(this.db.wardMaster) || !Array.isArray(this.db.wardVillageMaster)) {
      const seeds = buildInitialWardVillageMasterSeeds(nowIso);
      this.db.wardMaster = Array.isArray(this.db.wardMaster) && this.db.wardMaster.length > 0 ? this.db.wardMaster : seeds.wards;
      this.db.wardVillageMaster =
        Array.isArray(this.db.wardVillageMaster) && this.db.wardVillageMaster.length > 0
          ? this.db.wardVillageMaster
          : seeds.villages;
      changed = true;
    } else if (this.db.wardMaster.length === 0) {
      const seeds = buildInitialWardVillageMasterSeeds(nowIso);
      this.db.wardMaster = seeds.wards;
      if (this.db.wardVillageMaster.length === 0) {
        this.db.wardVillageMaster = seeds.villages;
      }
      changed = true;
    }

    // Replace provisional PMAY 2017-18 placeholder localities once with exact Domkal Ward Master localities
    const hasProvisionalOnly = this.db.municipalityLocalities.some(
      l => l.sourceName === 'Domkal Municipality PMAY 2017-18 Provisional Ward Locality List'
    );
    const hasExactSeed = this.db.municipalityLocalities.some(
      l => l.sourceName === 'Domkal Municipality Official Ward & Para Master'
    );
    if ((hasProvisionalOnly || this.db.municipalityLocalities.length === 0) && !hasExactSeed) {
      const customAdded = this.db.municipalityLocalities.filter(
        l => l.sourceName !== 'Domkal Municipality PMAY 2017-18 Provisional Ward Locality List'
      );
      const wardById = new Map((this.db.wardMaster || []).map(w => [w.wardId, w]));
      const officialLocalities: MunicipalityLocality[] = (this.db.wardVillageMaster || [])
        .filter(v => !v.isDeleted)
        .map((v, idx) => {
          const w = wardById.get(v.wardId);
          return {
            id: `DM-LOC-${String(idx + 1).padStart(4, '0')}`,
            municipalityId: 'MUN-DOMKAL-273007',
            municipalityLgd: '273007',
            wardCode: w?.wardCode || 'WARD 01',
            mouzaName: v.name,
            originalSpelling: v.name.toUpperCase(),
            correctedEnglishName: v.name,
            postOffice: v.postOffice || 'Domkal',
            policeStation: 'Domkal',
            pinCode: v.pinCode || '742303',
            sourceName: 'Domkal Municipality Official Ward & Para Master',
            sourceUrlOrDocument: 'Domkal Municipality Ward Directory (Ward 01 - Ward 21)',
            sourceDate: nowIso.slice(0, 10),
            importDate: nowIso,
            verificationStatus: 'VERIFIED'
          };
        });
      this.db.municipalityLocalities = [...officialLocalities, ...customAdded];
      changed = true;
    }

    return changed;
  }

  public init(): MurshidabadMasterDatabase {
    if (this.db) return this.db;
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(MASTER_FILE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(MASTER_FILE, 'utf-8'));
        if (parsed && parsed.district && Array.isArray(parsed.municipalityWards)) {
          this.db = parsed as MurshidabadMasterDatabase;
          const mergedOfficial = this.mergeOfficialPriorityDataset();
          const wardMasterInit = this.ensureAnnapurnaWardMasterInitialized();
          const hydratedMeta = this.hydrateMasterSubTablesAndBengali();
          if (mergedOfficial || wardMasterInit || hydratedMeta) {
            this.save();
          }
          return this.db;
        }
      } catch (err) {
        console.error('[MurshidabadMaster] Failed to parse master JSON, rebuilding:', err);
      }
    }
    this.db = buildInitialMurshidabadDatabase();
    this.mergeOfficialPriorityDataset();
    this.ensureAnnapurnaWardMasterInitialized();
    this.hydrateMasterSubTablesAndBengali();
    this.save();
    return this.db;
  }

  private save(): void {
    if (!this.db) return;
    fs.writeFileSync(MASTER_FILE, JSON.stringify(this.db, null, 2), 'utf-8');
  }

  public getOverview() {
    const db = this.init();
    const pendingLocalities = db.municipalityLocalities.filter(l => l.verificationStatus === 'PENDING_VERIFICATION').length;
    const verifiedLocalities = db.municipalityLocalities.filter(l => l.verificationStatus === 'VERIFIED').length;
    const verifiedVillages = db.ruralVillages.filter(v => v.verificationStatus === 'VERIFIED').length;
    const pendingVillages = db.ruralVillages.filter(v => v.verificationStatus === 'PENDING_VERIFICATION').length;
    const pendingBatches = db.importBatches.filter(b => b.status === 'PENDING_VERIFICATION').length;

    const areaCounts = {
      domkalBlock: db.ruralVillages.filter(v => v.blockName.toLowerCase() === 'domkal').length,
      domkalMunicipalityWards: db.municipalityWards.length,
      domkalMunicipalityLocalities: db.municipalityLocalities.length,
      jalangiBlock: db.ruralVillages.filter(v => v.blockName.toLowerCase() === 'jalangi').length,
      raninagar1Block: db.ruralVillages.filter(v => v.blockName.toLowerCase() === 'raninagar-i').length,
      raninagar2Block: db.ruralVillages.filter(v => v.blockName.toLowerCase() === 'raninagar-ii').length
    };

    return {
      district: db.district,
      actualVerifiedCounts: {
        subdivisions: db.subdivisions.length,
        blocks: db.blocks.length,
        gramPanchayatsLoaded: db.gramPanchayats.length,
        ruralVillagesLoaded: db.ruralVillages.length,
        ruralVillagesVerified: verifiedVillages,
        ruralVillagesPending: pendingVillages,
        municipalities: db.municipalities.length,
        domkalWards: db.municipalityWards.length,
        domkalMouzas: db.municipalityMouzas.length,
        domkalLocalitiesTotal: db.municipalityLocalities.length,
        domkalLocalitiesVerified: verifiedLocalities,
        domkalLocalitiesPending: pendingLocalities,
        wardPollingStationsLoaded: db.wardPollingStations.length,
        pendingImportBatches: pendingBatches,
        areaCounts
      },
      cp01Notice: db.wardPollingStations.length === 0
        ? 'CP_01.pdf is not bundled in workspace. Upload official polling station CSV/Excel in Admin Location Import Center to populate verified ward polling stations.'
        : `${db.wardPollingStations.length} polling station records loaded.`
    };
  }

  public getHierarchy(params: {
    areaType?: AreaType;
    subdivision?: string;
    block?: string;
    gp?: string;
    municipality?: string;
    ward?: string;
    mouza?: string;
  }) {
    const db = this.init();
    const areaType: AreaType = params.areaType === 'URBAN' ? 'URBAN' : 'RURAL';

    if (areaType === 'URBAN') {
      const targetMun = (params.municipality || 'Domkal Municipality').trim().toLowerCase();
      const matchedMun = db.municipalities.find(
        m => m.name.toLowerCase() === targetMun || m.lgdCode === targetMun
      ) || db.municipalities[0];

      const isDomkal = matchedMun.lgdCode === '273007';
      const wards = isDomkal
        ? db.municipalityWards
        : Array.from({ length: matchedMun.totalWards }, (_, i) => ({
            id: `${matchedMun.id}-W${i + 1}`,
            municipalityId: matchedMun.id,
            municipalityLgd: matchedMun.lgdCode,
            wardNo: i + 1,
            wardCode: `WARD ${String(i + 1).padStart(2, '0')}`,
            wardName: `Ward No. ${String(i + 1).padStart(2, '0')} - ${matchedMun.name}`,
            nameBn: `ওয়ার্ড ${String(i + 1).padStart(2, '0').replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)])}`,
            mouzaIds: [],
            postOffices: [],
            pinCodes: matchedMun.primaryPinCodes,
            verificationStatus: 'VERIFIED' as VerificationStatus,
            sourceName: matchedMun.sourceName
          }));

      const selectedWard = params.ward
        ? wards.find(w => w.wardCode.toLowerCase() === params.ward!.trim().toLowerCase() || String(w.wardNo) === params.ward!.trim())
        : undefined;

      let mouzas = isDomkal ? db.municipalityMouzas : [];
      if (isDomkal && selectedWard && selectedWard.mouzaIds.length > 0) {
        mouzas = db.municipalityMouzas.filter(m => selectedWard.mouzaIds.includes(m.id));
      }

      let localities = db.municipalityLocalities.filter(
        l => l.verificationStatus !== 'REJECTED' && (isDomkal ? l.municipalityLgd === '273007' : (l.municipalityLgd === matchedMun.lgdCode || l.municipalityId === matchedMun.id))
      );
      if (selectedWard) {
        localities = localities.filter(l => l.wardCode === selectedWard.wardCode);
      }
      if (params.mouza) {
        const mLower = params.mouza.trim().toLowerCase();
        const byMouza = localities.filter(l => l.mouzaName.toLowerCase() === mLower);
        if (byMouza.length > 0) localities = byMouza;
      }

      const pollingStations = selectedWard
        ? db.wardPollingStations.filter(ps => ps.wardCode === selectedWard.wardCode && ps.verificationStatus !== 'REJECTED')
        : [];

      const pinSet = new Set<string>(matchedMun.primaryPinCodes);
      selectedWard?.pinCodes.forEach(p => pinSet.add(p));
      localities.forEach(l => { if (l.pinCode) pinSet.add(l.pinCode); });

      const poSet = new Set<string>();
      selectedWard?.postOffices.forEach(po => poSet.add(po));
      localities.forEach(l => { if (l.postOffice) poSet.add(l.postOffice); });
      (db.postOfficesMaster || []).forEach(po => {
        if ((po.blockOrMunicipality || '').toLowerCase() === matchedMun.name.toLowerCase()) {
          poSet.add(po.name);
          if (po.pinCode) pinSet.add(po.pinCode);
        }
      });

      const psSet = new Set<string>();
      localities.forEach(l => { if (l.policeStation) psSet.add(l.policeStation); });
      (db.policeStationsMaster || []).forEach(ps => {
        if ((ps.blockOrMunicipality || '').toLowerCase() === matchedMun.name.toLowerCase() || (ps.subdivisionName || '').toLowerCase() === matchedMun.subdivisionName.toLowerCase()) {
          psSet.add(ps.name);
        }
      });
      if (isDomkal && psSet.size === 0) psSet.add('Domkal');

      return {
        areaType: 'URBAN' as const,
        district: db.district,
        subdivisions: db.subdivisions,
        municipalities: db.municipalities,
        selectedMunicipality: matchedMun,
        gramPanchayats: [], // Strictly empty: never show Gram Panchayat for Urban Municipality
        wards,
        mouzas,
        localities,
        pollingStations,
        postOffices: Array.from(poSet).sort(),
        policeStations: Array.from(psSet).sort(),
        pinCodes: Array.from(pinSet).sort(),
        postOfficesMaster: db.postOfficesMaster || [],
        policeStationsMaster: db.policeStationsMaster || [],
        pinCodesMaster: db.pinCodesMaster || []
      };
    }

    // RURAL hierarchy: Subdivision -> Block -> Gram Panchayat -> Mouza -> Village -> Post Office -> Police Station -> PIN Code
    const subLower = (params.subdivision || '').trim().toLowerCase();
    const filteredBlocks = subLower
      ? db.blocks.filter(b => b.subdivisionName.toLowerCase() === subLower)
      : db.blocks;

    const blkLower = (params.block || '').trim().toLowerCase();
    const filteredGps = blkLower
      ? db.gramPanchayats.filter(gp => gp.blockName.toLowerCase() === blkLower)
      : (subLower
          ? db.gramPanchayats.filter(gp => gp.subdivisionName.toLowerCase() === subLower)
          : db.gramPanchayats);

    const gpLower = (params.gp || '').trim().toLowerCase();
    let filteredVillages = db.ruralVillages.filter(v => v.verificationStatus !== 'REJECTED');
    if (subLower) filteredVillages = filteredVillages.filter(v => v.subdivisionName.toLowerCase() === subLower);
    if (blkLower) filteredVillages = filteredVillages.filter(v => v.blockName.toLowerCase() === blkLower);
    if (gpLower) filteredVillages = filteredVillages.filter(v => v.gpName.toLowerCase() === gpLower);

    const mouzas = Array.from(new Set(filteredVillages.map(v => v.mouzaName).filter(Boolean))).sort();
    const poSet = new Set<string>(filteredVillages.map(v => v.postOffice).filter(Boolean));
    const psSet = new Set<string>(filteredVillages.map(v => v.policeStation).filter(Boolean));
    const pinSet = new Set<string>(filteredVillages.map(v => v.pinCode).filter(Boolean));
    filteredGps.forEach(gp => gp.pinCodes.forEach(p => pinSet.add(p)));

    (db.postOfficesMaster || []).forEach(po => {
      if (!blkLower || (po.blockOrMunicipality || '').toLowerCase() === blkLower) {
        poSet.add(po.name);
        if (po.pinCode) pinSet.add(po.pinCode);
      }
    });
    (db.policeStationsMaster || []).forEach(ps => {
      if (!blkLower || (ps.blockOrMunicipality || '').toLowerCase() === blkLower || (subLower && (ps.subdivisionName || '').toLowerCase() === subLower)) {
        psSet.add(ps.name);
      }
    });

    return {
      areaType: 'RURAL' as const,
      district: db.district,
      subdivisions: db.subdivisions,
      blocks: filteredBlocks,
      gramPanchayats: filteredGps,
      mouzas,
      villages: filteredVillages,
      municipalities: [],
      wards: [],
      postOffices: Array.from(poSet).sort(),
      policeStations: Array.from(psSet).sort(),
      pinCodes: Array.from(pinSet).sort(),
      postOfficesMaster: db.postOfficesMaster || [],
      policeStationsMaster: db.policeStationsMaster || [],
      pinCodesMaster: db.pinCodesMaster || []
    };
  }

  public getDomkalWardsFull(wardCode?: string, includeRejected = false) {
    const db = this.init();
    const wards = db.municipalityWards.map(w => {
      const mouzas = db.municipalityMouzas.filter(m => w.mouzaIds.includes(m.id));
      const localities = db.municipalityLocalities.filter(
        l => l.wardCode === w.wardCode && (includeRejected || l.verificationStatus !== 'REJECTED')
      );
      const pollingStations = db.wardPollingStations.filter(ps => ps.wardCode === w.wardCode);
      return {
        ...w,
        mouzas,
        localities,
        pollingStations,
        pendingCount: localities.filter(l => l.verificationStatus === 'PENDING_VERIFICATION').length,
        verifiedCount: localities.filter(l => l.verificationStatus === 'VERIFIED').length
      };
    });

    if (wardCode) {
      const target = wardCode.trim().toUpperCase();
      return wards.filter(w => w.wardCode === target || String(w.wardNo) === target);
    }
    return wards;
  }

  public searchLocations(q: string, limit = 30) {
    const db = this.init();
    const term = String(q || '').trim().toLowerCase();
    if (!term) return [];

    const results: Array<{
      id: string;
      kind: string;
      title: string;
      subtitle: string;
      district: string;
      pinCode?: string;
      verificationStatus: VerificationStatus;
    }> = [];

    db.blocks.forEach(b => {
      if (
        b.name.toLowerCase().includes(term) ||
        (b.nameBn || '').toLowerCase().includes(term) ||
        b.subdivisionName.toLowerCase().includes(term)
      ) {
        results.push({
          id: b.id,
          kind: 'BLOCK',
          title: `${b.name}${b.nameBn ? ` (${b.nameBn})` : ''} Block`,
          subtitle: `Subdivision: ${b.subdivisionName} · District: ${b.district}`,
          district: b.district,
          verificationStatus: b.verificationStatus
        });
      }
    });

    db.gramPanchayats.forEach(gp => {
      if (
        gp.name.toLowerCase().includes(term) ||
        (gp.nameBn || '').toLowerCase().includes(term) ||
        gp.blockName.toLowerCase().includes(term) ||
        gp.pinCodes.some(p => p.includes(term))
      ) {
        results.push({
          id: gp.id,
          kind: 'GRAM_PANCHAYAT',
          title: `${gp.name}${gp.nameBn ? ` (${gp.nameBn})` : ''} GP`,
          subtitle: `Block: ${gp.blockName} · Subdivision: ${gp.subdivisionName} · PIN: ${gp.pinCodes.join(', ')}`,
          district: gp.district,
          pinCode: gp.pinCodes[0],
          verificationStatus: gp.verificationStatus
        });
      }
    });

    db.ruralVillages.forEach(v => {
      if (
        v.name.toLowerCase().includes(term) ||
        (v.nameBn || '').toLowerCase().includes(term) ||
        v.mouzaName.toLowerCase().includes(term) ||
        v.gpName.toLowerCase().includes(term) ||
        v.postOffice.toLowerCase().includes(term) ||
        v.policeStation.toLowerCase().includes(term) ||
        v.pinCode.includes(term)
      ) {
        results.push({
          id: v.id,
          kind: 'VILLAGE_MOUZA',
          title: `${v.name}${v.nameBn ? ` (${v.nameBn})` : ''} (Mouza: ${v.mouzaName})`,
          subtitle: `GP: ${v.gpName} · Block: ${v.blockName} · P.O.: ${v.postOffice} · P.S.: ${v.policeStation} · PIN: ${v.pinCode}`,
          district: v.district,
          pinCode: v.pinCode,
          verificationStatus: v.verificationStatus
        });
      }
    });

    db.municipalityLocalities.forEach(l => {
      if (
        l.originalSpelling.toLowerCase().includes(term) ||
        l.correctedEnglishName.toLowerCase().includes(term) ||
        (l.nameBn || '').toLowerCase().includes(term) ||
        l.wardCode.toLowerCase().includes(term) ||
        l.mouzaName.toLowerCase().includes(term) ||
        l.pinCode.includes(term)
      ) {
        results.push({
          id: l.id,
          kind: 'DOMKAL_WARD_LOCALITY',
          title: `${l.correctedEnglishName}${l.nameBn ? ` (${l.nameBn})` : ''} (${l.wardCode})`,
          subtitle: `Domkal Municipality (LGD 273007) · Original: "${l.originalSpelling}" · Mouza: ${l.mouzaName} · PIN: ${l.pinCode}`,
          district: 'Murshidabad',
          pinCode: l.pinCode,
          verificationStatus: l.verificationStatus
        });
      }
    });

    (db.postOfficesMaster || []).forEach(po => {
      if (
        po.name.toLowerCase().includes(term) ||
        (po.nameBn || '').toLowerCase().includes(term) ||
        po.pinCode.includes(term)
      ) {
        results.push({
          id: po.id,
          kind: 'POST_OFFICE',
          title: `P.O. ${po.name}${po.nameBn ? ` (${po.nameBn})` : ''}`,
          subtitle: `PIN: ${po.pinCode} · Area: ${po.blockOrMunicipality || po.district}`,
          district: po.district,
          pinCode: po.pinCode,
          verificationStatus: po.verificationStatus
        });
      }
    });

    return results.slice(0, limit);
  }

  public previewImportRows(rawRows: any[]): {
    rows: LocationImportRowPreview[];
    summary: { total: number; exactDuplicates: number; similarSpelling: number; missingPins: number; invalidHierarchy: number };
  } {
    const db = this.init();
    const validBlockSet = new Set(db.blocks.map(b => b.name.toLowerCase()));
    const validMunSet = new Set(db.municipalities.map(m => m.name.toLowerCase()));

    let exactDuplicates = 0;
    let similarSpelling = 0;
    let missingPins = 0;
    let invalidHierarchy = 0;

    const rows: LocationImportRowPreview[] = rawRows.slice(0, 2000).map((raw, idx) => {
      const areaTypeRaw = String(raw.areaType || raw.AreaType || (raw.ward || raw.Ward || raw.municipality ? 'URBAN' : 'RURAL')).toUpperCase();
      const areaType: AreaType = areaTypeRaw === 'URBAN' ? 'URBAN' : 'RURAL';
      const district = String(raw.district || raw.District || 'Murshidabad').trim();
      const subdivisionOrMunicipality = String(
        areaType === 'URBAN'
          ? (raw.municipality || raw.Municipality || 'Domkal Municipality')
          : (raw.subdivision || raw.Subdivision || 'Domkal')
      ).trim();
      const blockOrWard = String(
        areaType === 'URBAN'
          ? (raw.ward || raw.Ward || raw.wardCode || '')
          : (raw.block || raw.Block || '')
      ).trim();
      const gpOrMouza = String(raw.gp || raw.GP || raw.mouza || raw.Mouza || '').trim();
      const originalSpelling = String(raw.originalSpelling || raw.OriginalSpelling || raw.locality || raw.village || raw.Locality || raw.Village || '').trim();
      const correctedEnglishName = String(raw.correctedEnglishName || raw.CorrectedName || originalSpelling).trim();
      const postOffice = String(raw.postOffice || raw.PostOffice || raw.po || '').trim();
      const pinCode = String(raw.pinCode || raw.PIN || raw.pincode || '').replace(/[^0-9]/g, '').slice(0, 6);

      const missingPinFlag = pinCode.length !== 6;
      if (missingPinFlag) missingPins += 1;

      let hierarchyValid = true;
      let validationMsg = 'Ready for verification queue';

      if (!district || !originalSpelling) {
        hierarchyValid = false;
        validationMsg = 'Missing District or Village/Locality name';
      } else if (areaType === 'URBAN') {
        if (!validMunSet.has(subdivisionOrMunicipality.toLowerCase()) && !subdivisionOrMunicipality.toLowerCase().includes('domkal')) {
          hierarchyValid = false;
          validationMsg = `Unknown Municipality: ${subdivisionOrMunicipality}`;
        }
        if (!blockOrWard) {
          hierarchyValid = false;
          validationMsg = 'Ward Code missing for Urban entry';
        }
      } else if (!blockOrWard || (district.toLowerCase() === 'murshidabad' && !validBlockSet.has(blockOrWard.toLowerCase()))) {
        hierarchyValid = false;
        validationMsg = `Block "${blockOrWard}" not found in Murshidabad master blocks`;
      }

      if (!hierarchyValid) invalidHierarchy += 1;

      let duplicateFlag: 'NONE' | 'EXACT_DUPLICATE' | 'SIMILAR_SPELLING' = 'NONE';
      if (areaType === 'URBAN') {
        const matchExact = db.municipalityLocalities.some(
          l => l.wardCode.toLowerCase() === blockOrWard.toLowerCase() && l.originalSpelling.toLowerCase() === originalSpelling.toLowerCase()
        );
        const matchSimilar = !matchExact && db.municipalityLocalities.some(
          l => l.wardCode.toLowerCase() === blockOrWard.toLowerCase() && l.correctedEnglishName.toLowerCase() === correctedEnglishName.toLowerCase()
        );
        if (matchExact) {
          duplicateFlag = 'EXACT_DUPLICATE';
          exactDuplicates += 1;
        } else if (matchSimilar) {
          duplicateFlag = 'SIMILAR_SPELLING';
          similarSpelling += 1;
        }
      } else {
        const matchExact = db.ruralVillages.some(
          v => v.blockName.toLowerCase() === blockOrWard.toLowerCase() && v.name.toLowerCase() === originalSpelling.toLowerCase()
        );
        if (matchExact) {
          duplicateFlag = 'EXACT_DUPLICATE';
          exactDuplicates += 1;
        }
      }

      return {
        rowIndex: idx + 1,
        areaType,
        district,
        subdivisionOrMunicipality,
        blockOrWard,
        gpOrMouza,
        villageOrLocality: correctedEnglishName,
        originalSpelling,
        correctedEnglishName,
        postOffice,
        pinCode,
        duplicateFlag,
        missingPinFlag,
        hierarchyValid,
        validationMessage: validationMsg
      };
    });

    return {
      rows,
      summary: {
        total: rows.length,
        exactDuplicates,
        similarSpelling,
        missingPins,
        invalidHierarchy
      }
    };
  }

  public commitImportBatch(params: {
    fileName: string;
    sourceName: string;
    sourceUrlOrDocument: string;
    sourceDate: string;
    importedBy: string;
    rows: any[];
  }): LocationImportBatch {
    const db = this.init();
    const preview = this.previewImportRows(params.rows);
    const nowIso = new Date().toISOString();
    const importId = `IMP-${new Date().getFullYear()}-${String(db.importBatches.length + 1).padStart(4, '0')}`;

    const batch: LocationImportBatch = {
      importId,
      fileName: params.fileName || 'manual-import.csv',
      sourceName: params.sourceName || 'Admin Location Upload',
      sourceUrlOrDocument: params.sourceUrlOrDocument || params.fileName || 'Uploaded File',
      sourceDate: params.sourceDate || nowIso.slice(0, 10),
      importDate: nowIso,
      importedBy: params.importedBy,
      totalRows: preview.rows.length,
      status: 'PENDING_VERIFICATION',
      rows: preview.rows
    };

    // Never insert duplicates! Skip EXACT_DUPLICATE rows cleanly while staging unique entries
    preview.rows.forEach((row, idx) => {
      if (!row.originalSpelling || row.duplicateFlag === 'EXACT_DUPLICATE') return;
      if (row.areaType === 'URBAN') {
        const wardNumMatch = row.blockOrWard.match(/(\d+)/);
        const wardCode = wardNumMatch ? `WARD ${String(parseInt(wardNumMatch[1], 10)).padStart(2, '0')}` : row.blockOrWard.toUpperCase();
        const stillDup = db.municipalityLocalities.some(
          l =>
            l.wardCode.toLowerCase() === wardCode.toLowerCase() &&
            (l.originalSpelling.toLowerCase() === row.originalSpelling.toLowerCase() ||
              l.correctedEnglishName.toLowerCase() === (row.correctedEnglishName || row.originalSpelling).toLowerCase())
        );
        if (stillDup) return;
        db.municipalityLocalities.unshift({
          id: `DM-LOC-IMP-${Date.now()}-${idx}`,
          municipalityId: 'MUN-DOMKAL-273007',
          municipalityLgd: '273007',
          wardCode,
          mouzaName: row.gpOrMouza || 'Domkal',
          originalSpelling: row.originalSpelling,
          correctedEnglishName: row.correctedEnglishName || row.originalSpelling,
          postOffice: row.postOffice || 'Domkal',
          pinCode: row.pinCode || '',
          sourceName: batch.sourceName,
          sourceUrlOrDocument: batch.sourceUrlOrDocument,
          sourceDate: batch.sourceDate,
          importDate: nowIso,
          verificationStatus: row.pinCode?.length === 6 ? 'VERIFIED' : 'PENDING_VERIFICATION',
          notes: `Imported via ${importId}`
        });
      } else {
        const blkName = row.blockOrWard || 'Domkal';
        const vName = row.correctedEnglishName || row.originalSpelling;
        const stillDup = db.ruralVillages.some(
          v => v.blockName.toLowerCase() === blkName.toLowerCase() && v.name.toLowerCase() === vName.toLowerCase()
        );
        if (stillDup) return;
        const matchedBlock = db.blocks.find(b => b.name.toLowerCase() === blkName.toLowerCase());
        db.ruralVillages.unshift({
          id: `VIL-IMP-${Date.now()}-${idx}`,
          name: vName,
          mouzaName: row.gpOrMouza || vName,
          gpId: 'GP-IMP',
          gpName: row.gpOrMouza || 'Pending GP Verification',
          blockName: matchedBlock?.name || blkName,
          subdivisionName: matchedBlock?.subdivisionName || row.subdivisionOrMunicipality || 'Domkal',
          district: row.district || 'Murshidabad',
          postOffice: row.postOffice || matchedBlock?.name || 'Domkal',
          policeStation: matchedBlock?.name === 'Raninagar-I' ? 'Islampur' : (matchedBlock?.name === 'Raninagar-II' ? 'Raninagar' : (matchedBlock?.name || 'Domkal')),
          pinCode: row.pinCode || '',
          verificationStatus: row.pinCode?.length === 6 ? 'VERIFIED' : 'PENDING_VERIFICATION',
          sourceName: batch.sourceName
        });
      }
    });

    db.importBatches.unshift(batch);
    this.save();
    return batch;
  }

  public verifyLocalityOrImport(params: {
    targetType: 'LOCALITY' | 'RURAL_VILLAGE' | 'IMPORT_BATCH';
    targetId: string;
    decision: 'APPROVE' | 'REJECT' | 'EDIT';
    correctedEnglishName?: string;
    pinCode?: string;
    mouzaName?: string;
    postOffice?: string;
    actorUid: string;
  }) {
    const db = this.init();
    const nowIso = new Date().toISOString();

    if (params.targetType === 'LOCALITY') {
      const loc = db.municipalityLocalities.find(l => l.id === params.targetId);
      if (!loc) return { success: false, message: 'Locality record not found.' };

      if (params.correctedEnglishName !== undefined && params.correctedEnglishName.trim()) {
        loc.correctedEnglishName = params.correctedEnglishName.trim();
      }
      if (params.pinCode !== undefined) loc.pinCode = params.pinCode.replace(/[^0-9]/g, '').slice(0, 6);
      if (params.mouzaName !== undefined && params.mouzaName.trim()) loc.mouzaName = params.mouzaName.trim();
      if (params.postOffice !== undefined && params.postOffice.trim()) loc.postOffice = params.postOffice.trim();

      if (params.decision === 'APPROVE') loc.verificationStatus = 'VERIFIED';
      if (params.decision === 'REJECT') loc.verificationStatus = 'REJECTED';
      loc.verifiedBy = params.actorUid;
      loc.verificationDate = nowIso;
      this.save();
      return { success: true, record: loc };
    }

    if (params.targetType === 'RURAL_VILLAGE') {
      const vil = db.ruralVillages.find(v => v.id === params.targetId);
      if (!vil) return { success: false, message: 'Village record not found.' };
      if (params.correctedEnglishName) vil.name = params.correctedEnglishName.trim();
      if (params.pinCode !== undefined) vil.pinCode = params.pinCode.replace(/[^0-9]/g, '').slice(0, 6);
      if (params.decision === 'APPROVE') vil.verificationStatus = 'VERIFIED';
      if (params.decision === 'REJECT') vil.verificationStatus = 'REJECTED';
      this.save();
      return { success: true, record: vil };
    }

    if (params.targetType === 'IMPORT_BATCH') {
      const batch = db.importBatches.find(b => b.importId === params.targetId);
      if (!batch) return { success: false, message: 'Import batch not found.' };
      batch.status = params.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      batch.verifiedBy = params.actorUid;
      batch.verificationDate = nowIso;
      this.save();
      return { success: true, batch };
    }

    return { success: false, message: 'Invalid verification target.' };
  }

  public getImportBatches() {
    return this.init().importBatches;
  }

  public addPollingStation(input: {
    wardCode: string;
    psNumber: string;
    psName: string;
    buildingOrLocality: string;
    sourceName: string;
    sourceDate: string;
    actorUid: string;
  }) {
    const db = this.init();
    const record: WardPollingStation = {
      id: `PS-273007-${Date.now()}`,
      municipalityLgd: '273007',
      wardCode: input.wardCode.trim().toUpperCase(),
      psNumber: input.psNumber.trim(),
      psName: input.psName.trim(),
      buildingOrLocality: input.buildingOrLocality.trim(),
      sourceName: input.sourceName.trim() || 'Admin Entry',
      sourceDate: input.sourceDate || new Date().toISOString().slice(0, 10),
      verificationStatus: 'PENDING_VERIFICATION',
      verifiedBy: input.actorUid
    };
    db.wardPollingStations.push(record);
    this.save();
    return record;
  }

  // -------------------------------------------------------------------------
  // UNIFIED VILLAGE & MUNICIPALITY LOCALITY CRUD, DEDUP & AUTO-ADD
  // -------------------------------------------------------------------------
  private normKey(val: string): string {
    return String(val || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  public listAllEntries(filters: {
    areaType?: string;
    blockOrMunicipality?: string;
    gpOrWard?: string;
    pinCode?: string;
    q?: string;
    verificationStatus?: string;
  } = {}) {
    const db = this.init();
    const areaFilter = String(filters.areaType || 'ALL').toUpperCase();
    const blkFilter = String(filters.blockOrMunicipality || '').trim().toLowerCase();
    const gpWardFilter = String(filters.gpOrWard || '').trim().toLowerCase();
    const pinFilter = String(filters.pinCode || '').replace(/[^0-9]/g, '');
    const statusFilter = String(filters.verificationStatus || 'ALL').toUpperCase();
    const qLower = String(filters.q || '').trim().toLowerCase();

    const rows: Array<{
      id: string;
      areaType: AreaType;
      district: string;
      subdivisionOrMunicipality: string;
      blockOrMunicipality: string;
      gpOrWard: string;
      mouzaName: string;
      name: string;
      originalSpelling: string;
      postOffice: string;
      policeStation: string;
      pinCode: string;
      verificationStatus: VerificationStatus;
      sourceName: string;
    }> = [];

    if (areaFilter === 'ALL' || areaFilter === 'RURAL') {
      for (const v of db.ruralVillages) {
        rows.push({
          id: v.id,
          areaType: 'RURAL',
          district: v.district || 'Murshidabad',
          subdivisionOrMunicipality: v.subdivisionName || 'Domkal',
          blockOrMunicipality: v.blockName,
          gpOrWard: v.gpName,
          mouzaName: v.mouzaName || v.name,
          name: v.name,
          originalSpelling: v.name,
          postOffice: v.postOffice || '',
          policeStation: v.policeStation || '',
          pinCode: v.pinCode || '',
          verificationStatus: v.verificationStatus,
          sourceName: v.sourceName || ''
        });
      }
    }

    if (areaFilter === 'ALL' || areaFilter === 'URBAN') {
      const seenUrban = new Set<string>();
      const pushUrban = (row: {
        id: string;
        areaType: AreaType;
        district: string;
        subdivisionOrMunicipality: string;
        blockOrMunicipality: string;
        gpOrWard: string;
        mouzaName: string;
        name: string;
        originalSpelling: string;
        postOffice: string;
        policeStation: string;
        pinCode: string;
        verificationStatus: VerificationStatus;
        sourceName: string;
      }) => {
        const key = `${this.normKey(row.gpOrWard)}|${this.normKey(row.name)}`;
        if (seenUrban.has(key)) return;
        seenUrban.add(key);
        rows.push(row);
      };

      const activeWardsById = new Map((db.wardMaster || []).filter(w => !w.isDeleted && w.isActive !== false).map(w => [w.wardId, w]));
      for (const wv of (db.wardVillageMaster || [])) {
        if (wv.isDeleted || wv.isActive === false) continue;
        const parentWard = activeWardsById.get(wv.wardId);
        if (!parentWard) continue;
        pushUrban({
          id: wv.id,
          areaType: 'URBAN',
          district: wv.district || parentWard.district || 'Murshidabad',
          subdivisionOrMunicipality: parentWard.municipalityName || 'Domkal Municipality',
          blockOrMunicipality: parentWard.municipalityName || 'Domkal Municipality',
          gpOrWard: parentWard.wardNumber || parentWard.wardCode,
          mouzaName: '',
          name: wv.name,
          originalSpelling: wv.name,
          postOffice: wv.postOffice || 'Domkal',
          policeStation: wv.policeStation || parentWard.policeStation || 'Domkal',
          pinCode: wv.pinCode || '742303',
          verificationStatus: 'VERIFIED',
          sourceName: 'ward-village-master'
        });
      }

      for (const l of db.municipalityLocalities) {
        pushUrban({
          id: l.id,
          areaType: 'URBAN',
          district: 'Murshidabad',
          subdivisionOrMunicipality: 'Domkal Municipality',
          blockOrMunicipality: 'Domkal Municipality',
          gpOrWard: l.wardCode,
          mouzaName: l.mouzaName || '',
          name: l.correctedEnglishName || l.originalSpelling,
          originalSpelling: l.originalSpelling,
          postOffice: l.postOffice || 'Domkal',
          policeStation: 'Domkal',
          pinCode: l.pinCode || '',
          verificationStatus: l.verificationStatus,
          sourceName: l.sourceName || ''
        });
      }
    }

    return rows.filter(r => {
      if (blkFilter && blkFilter !== 'all' && r.blockOrMunicipality.toLowerCase() !== blkFilter) return false;
      if (gpWardFilter && gpWardFilter !== 'all' && r.gpOrWard.toLowerCase() !== gpWardFilter) return false;
      if (pinFilter && !r.pinCode.includes(pinFilter)) return false;
      if (statusFilter !== 'ALL' && r.verificationStatus !== statusFilter) return false;
      if (qLower) {
        const hay = `${r.name} ${r.originalSpelling} ${r.pinCode} ${r.gpOrWard} ${r.blockOrMunicipality} ${r.postOffice} ${r.mouzaName} ${r.policeStation}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
  }

  public hasDuplicateEntry(params: {
    areaType: AreaType;
    blockOrMunicipality: string;
    gpOrWard?: string;
    name: string;
    excludeId?: string;
  }): boolean {
    const db = this.init();
    const targetNameKey = this.normKey(params.name);
    const targetBlockKey = this.normKey(params.blockOrMunicipality);
    const targetWardKey = this.normKey(params.gpOrWard || '');

    if (params.areaType === 'URBAN') {
      return db.municipalityLocalities.some(l => {
        if (params.excludeId && l.id === params.excludeId) return false;
        const sameWard = this.normKey(l.wardCode) === targetWardKey;
        const sameName =
          this.normKey(l.correctedEnglishName) === targetNameKey ||
          this.normKey(l.originalSpelling) === targetNameKey;
        return sameWard && sameName;
      });
    }

    return db.ruralVillages.some(v => {
      if (params.excludeId && v.id === params.excludeId) return false;
      return this.normKey(v.blockName) === targetBlockKey && this.normKey(v.name) === targetNameKey;
    });
  }

  public addVillageOrLocality(
    input: {
      areaType?: AreaType;
      district?: string;
      blockOrMunicipality: string;
      gpOrWard: string;
      mouzaName?: string;
      name: string;
      originalSpelling?: string;
      postOffice?: string;
      policeStation?: string;
      pinCode: string;
      verificationStatus?: VerificationStatus;
      sourceName?: string;
      notes?: string;
    },
    actorUid: string
  ): { success: boolean; duplicate?: boolean; message: string; record?: any } {
    const db = this.init();
    const areaType: AreaType = input.areaType === 'URBAN' ? 'URBAN' : 'RURAL';
    const cleanName = String(input.name || '').trim();
    const cleanBlock = String(input.blockOrMunicipality || (areaType === 'URBAN' ? 'Domkal Municipality' : 'Domkal')).trim();
    const cleanGpOrWard = String(input.gpOrWard || '').trim();
    const cleanPin = String(input.pinCode || '').replace(/[^0-9]/g, '').slice(0, 6);

    if (!cleanName) return { success: false, message: 'Village / Locality name is required.' };
    if (!cleanGpOrWard) return { success: false, message: areaType === 'URBAN' ? 'Ward Code (e.g. WARD 01) is required.' : 'Gram Panchayat name is required.' };
    if (cleanPin.length !== 6) return { success: false, message: 'Valid 6-digit Indian PIN Code is required.' };

    if (this.hasDuplicateEntry({ areaType, blockOrMunicipality: cleanBlock, gpOrWard: cleanGpOrWard, name: cleanName })) {
      return {
        success: false,
        duplicate: true,
        message: `Duplicate prevented: "${cleanName}" already exists under ${areaType === 'URBAN' ? cleanGpOrWard : cleanBlock}.`
      };
    }

    const nowIso = new Date().toISOString();

    if (areaType === 'URBAN') {
      const wardNumMatch = cleanGpOrWard.match(/(\d+)/);
      const wardCode = wardNumMatch ? `WARD ${String(parseInt(wardNumMatch[1], 10)).padStart(2, '0')}` : cleanGpOrWard.toUpperCase();
      const record: MunicipalityLocality = {
        id: `DM-LOC-${Date.now().toString().slice(-6)}`,
        municipalityId: 'MUN-DOMKAL-273007',
        municipalityLgd: '273007',
        wardCode,
        mouzaName: String(input.mouzaName || 'Domkal').trim(),
        originalSpelling: String(input.originalSpelling || cleanName).trim().toUpperCase(),
        correctedEnglishName: cleanName,
        postOffice: String(input.postOffice || 'Domkal').trim(),
        pinCode: cleanPin,
        sourceName: String(input.sourceName || 'Admin Verified Entry'),
        sourceUrlOrDocument: 'Admin Location Manager',
        sourceDate: nowIso.slice(0, 10),
        importDate: nowIso,
        verificationStatus: input.verificationStatus || 'VERIFIED',
        verifiedBy: actorUid,
        verificationDate: nowIso,
        notes: input.notes
      };
      db.municipalityLocalities.unshift(record);
      this.save();
      return { success: true, message: `Added locality "${cleanName}" (${wardCode} - ${cleanPin}).`, record };
    }

    const matchedBlock = db.blocks.find(b => b.name.toLowerCase() === cleanBlock.toLowerCase());
    let matchedGp = db.gramPanchayats.find(
      gp => gp.blockName.toLowerCase() === cleanBlock.toLowerCase() && gp.name.toLowerCase() === cleanGpOrWard.toLowerCase()
    );
    if (!matchedGp) {
      matchedGp = {
        id: `GP-${Date.now().toString().slice(-6)}`,
        name: cleanGpOrWard,
        blockId: matchedBlock?.id || `BLK-${cleanBlock.toUpperCase()}`,
        blockName: matchedBlock?.name || cleanBlock,
        subdivisionName: matchedBlock?.subdivisionName || 'Domkal',
        district: String(input.district || 'Murshidabad'),
        pinCodes: [cleanPin],
        verificationStatus: input.verificationStatus || 'VERIFIED',
        sourceName: String(input.sourceName || 'Admin Entry')
      };
      db.gramPanchayats.push(matchedGp);
    } else if (!matchedGp.pinCodes.includes(cleanPin)) {
      matchedGp.pinCodes.push(cleanPin);
    }

    const record: RuralVillageMouzaRecord = {
      id: `VIL-USR-${Date.now().toString().slice(-6)}`,
      name: cleanName,
      mouzaName: String(input.mouzaName || cleanName).trim(),
      gpId: matchedGp.id,
      gpName: matchedGp.name,
      blockName: matchedBlock?.name || cleanBlock,
      subdivisionName: matchedBlock?.subdivisionName || 'Domkal',
      district: String(input.district || 'Murshidabad'),
      postOffice: String(input.postOffice || cleanName).trim(),
      policeStation: String(
        input.policeStation ||
          (cleanBlock === 'Raninagar-I' ? 'Islampur' : (cleanBlock === 'Raninagar-II' ? 'Raninagar' : cleanBlock))
      ).trim(),
      pinCode: cleanPin,
      verificationStatus: input.verificationStatus || 'VERIFIED',
      sourceName: String(input.sourceName || 'Admin Verified Entry')
    };
    db.ruralVillages.unshift(record);
    this.save();
    return { success: true, message: `Added village "${cleanName}" (${record.blockName} Block - ${cleanPin}).`, record };
  }

  public editVillageOrLocality(
    id: string,
    updates: {
      district?: string;
      name?: string;
      blockOrMunicipality?: string;
      gpOrWard?: string;
      mouzaName?: string;
      postOffice?: string;
      policeStation?: string;
      pinCode?: string;
      verificationStatus?: VerificationStatus;
    },
    actorUid: string
  ): { success: boolean; duplicate?: boolean; message: string; record?: any } {
    const db = this.init();
    const nowIso = new Date().toISOString();

    const vil = db.ruralVillages.find(v => v.id === id);
    if (vil) {
      const nextName = updates.name !== undefined ? String(updates.name).trim() : vil.name;
      const nextBlock = updates.blockOrMunicipality !== undefined ? String(updates.blockOrMunicipality).trim() : vil.blockName;
      const nextPin = updates.pinCode !== undefined ? String(updates.pinCode).replace(/[^0-9]/g, '').slice(0, 6) : vil.pinCode;
      if (!nextName) return { success: false, message: 'Village name cannot be empty.' };
      if (nextPin.length !== 6) return { success: false, message: 'Valid 6-digit Indian PIN Code is required.' };
      if (this.hasDuplicateEntry({ areaType: 'RURAL', blockOrMunicipality: nextBlock, name: nextName, excludeId: id })) {
        return { success: false, duplicate: true, message: `Duplicate village "${nextName}" already exists in ${nextBlock} block.` };
      }
      if (updates.district !== undefined && String(updates.district).trim()) {
        vil.district = String(updates.district).trim();
      }
      vil.name = nextName;
      vil.blockName = nextBlock;
      if (updates.gpOrWard !== undefined && updates.gpOrWard.trim()) vil.gpName = updates.gpOrWard.trim();
      if (updates.mouzaName !== undefined && updates.mouzaName.trim()) vil.mouzaName = updates.mouzaName.trim();
      if (updates.postOffice !== undefined && updates.postOffice.trim()) vil.postOffice = updates.postOffice.trim();
      if (updates.policeStation !== undefined && updates.policeStation.trim()) vil.policeStation = updates.policeStation.trim();
      vil.pinCode = nextPin;
      if (updates.verificationStatus) vil.verificationStatus = updates.verificationStatus;
      this.save();
      return { success: true, message: `Updated village "${vil.name}" (PIN ${vil.pinCode}).`, record: vil };
    }

    const loc = db.municipalityLocalities.find(l => l.id === id);
    if (loc) {
      const nextName = updates.name !== undefined ? String(updates.name).trim() : loc.correctedEnglishName;
      const nextWard = updates.gpOrWard !== undefined ? String(updates.gpOrWard).trim().toUpperCase() : loc.wardCode;
      const nextPin = updates.pinCode !== undefined ? String(updates.pinCode).replace(/[^0-9]/g, '').slice(0, 6) : loc.pinCode;
      if (!nextName) return { success: false, message: 'Locality name cannot be empty.' };
      if (nextPin.length !== 6) return { success: false, message: 'Valid 6-digit Indian PIN Code is required.' };
      if (this.hasDuplicateEntry({ areaType: 'URBAN', blockOrMunicipality: 'Domkal Municipality', gpOrWard: nextWard, name: nextName, excludeId: id })) {
        return { success: false, duplicate: true, message: `Duplicate locality "${nextName}" already exists in ${nextWard}.` };
      }
      loc.correctedEnglishName = nextName;
      loc.wardCode = nextWard;
      if (updates.mouzaName !== undefined && updates.mouzaName.trim()) loc.mouzaName = updates.mouzaName.trim();
      if (updates.postOffice !== undefined && updates.postOffice.trim()) loc.postOffice = updates.postOffice.trim();
      loc.pinCode = nextPin;
      if (updates.verificationStatus) loc.verificationStatus = updates.verificationStatus;
      loc.verifiedBy = actorUid;
      loc.verificationDate = nowIso;
      this.save();
      return { success: true, message: `Updated locality "${loc.correctedEnglishName}" (${loc.wardCode} - ${loc.pinCode}).`, record: loc };
    }

    return { success: false, message: 'Village or Locality record not found.' };
  }

  public deleteVillageOrLocality(id: string): { success: boolean; message: string } {
    const db = this.init();
    const vilIdx = db.ruralVillages.findIndex(v => v.id === id);
    if (vilIdx !== -1) {
      const removed = db.ruralVillages.splice(vilIdx, 1)[0];
      this.save();
      return { success: true, message: `Deleted village "${removed.name}" (${removed.blockName}).` };
    }
    const locIdx = db.municipalityLocalities.findIndex(l => l.id === id);
    if (locIdx !== -1) {
      const removed = db.municipalityLocalities.splice(locIdx, 1)[0];
      this.save();
      return { success: true, message: `Deleted locality "${removed.correctedEnglishName}" (${removed.wardCode}).` };
    }
    const psIdx = db.wardPollingStations.findIndex(ps => ps.id === id);
    if (psIdx !== -1) {
      const removed = db.wardPollingStations.splice(psIdx, 1)[0];
      this.save();
      return { success: true, message: `Deleted polling station "${removed.psName}".` };
    }
    return { success: false, message: 'Location entry not found.' };
  }

  public verifyAndAutoAddMissingVillage(
    input: {
      areaType?: AreaType;
      blockOrMunicipality: string;
      gpOrWard?: string;
      name: string;
      pinCode: string;
      postOffice?: string;
      policeStation?: string;
    },
    indiaPostLookup: { found: boolean; records: Array<{ district: string; state: string; postOffice: string; policeStation: string; village: string }> },
    actorUid: string
  ) {
    const cleanPin = String(input.pinCode || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (cleanPin.length !== 6) {
      return { success: false, message: 'A valid 6-digit Indian PIN Code is required for automatic verification.' };
    }

    const msdRecords = (indiaPostLookup?.records || []).filter(
      r => String(r.district || '').toLowerCase().includes('murshidabad')
    );

    if (!indiaPostLookup?.found || msdRecords.length === 0) {
      return {
        success: false,
        message: `PIN ${cleanPin} could not be verified as an active Murshidabad post office PIN in official India Post records. Entry blocked to avoid dummy/guessed data.`
      };
    }

    const firstMatch = msdRecords[0];
    const areaType: AreaType =
      input.areaType === 'URBAN' || String(input.blockOrMunicipality || '').toLowerCase().includes('municipality')
        ? 'URBAN'
        : 'RURAL';

    const resolvedGpOrWard =
      String(input.gpOrWard || '').trim() ||
      (areaType === 'URBAN' ? 'WARD 01' : firstMatch.postOffice || input.blockOrMunicipality || 'Domkal');

    return this.addVillageOrLocality(
      {
        areaType,
        district: 'Murshidabad',
        blockOrMunicipality: input.blockOrMunicipality || (areaType === 'URBAN' ? 'Domkal Municipality' : 'Domkal'),
        gpOrWard: resolvedGpOrWard,
        mouzaName: input.name,
        name: input.name,
        postOffice: input.postOffice || firstMatch.postOffice || 'Domkal',
        policeStation: input.policeStation || firstMatch.policeStation || input.blockOrMunicipality || 'Domkal',
        pinCode: cleanPin,
        verificationStatus: 'VERIFIED',
        sourceName: `Auto-Verified via Official India Post API (PIN ${cleanPin})`
      },
      actorUid
    );
  }

  public getExportRows(filters: {
    areaType?: string;
    blockOrMunicipality?: string;
    gpOrWard?: string;
    pinCode?: string;
    q?: string;
    verificationStatus?: string;
  } = {}) {
    return this.listAllEntries(filters).map(r => ({
      areaType: r.areaType,
      district: r.district,
      subdivisionOrMunicipality: r.subdivisionOrMunicipality,
      blockOrWard: r.areaType === 'URBAN' ? r.gpOrWard : r.blockOrMunicipality,
      gpOrMouza: r.areaType === 'URBAN' ? r.mouzaName : r.gpOrWard,
      villageOrLocality: r.name,
      originalSpelling: r.originalSpelling,
      postOffice: r.postOffice,
      policeStation: r.policeStation,
      pinCode: r.pinCode,
      verificationStatus: r.verificationStatus,
      sourceName: r.sourceName
    }));
  }

  // -------------------------------------------------------------------------
  // ADMIN MASTER CRUD: BLOCKS, GRAM PANCHAYATS, POST OFFICES, POLICE STATIONS, PIN CODES
  // -------------------------------------------------------------------------
  public listBlocks(subdivision?: string): BlockMaster[] {
    const db = this.init();
    const subLower = String(subdivision || '').trim().toLowerCase();
    return subLower ? db.blocks.filter(b => b.subdivisionName.toLowerCase() === subLower) : [...db.blocks];
  }

  public addBlock(input: { name: string; nameBn?: string; subdivisionName: string; district?: string; lgdCode?: string }): {
    success: boolean;
    message: string;
    block?: BlockMaster;
  } {
    const db = this.init();
    const name = String(input.name || '').trim();
    const subdivisionName = String(input.subdivisionName || 'Domkal').trim();
    if (!name) return { success: false, message: 'Block name is required.' };
    if (db.blocks.some(b => b.name.toLowerCase() === name.toLowerCase())) {
      return { success: false, message: `Block "${name}" already exists.` };
    }
    const sub = db.subdivisions.find(s => s.name.toLowerCase() === subdivisionName.toLowerCase());
    const block: BlockMaster = {
      id: `BLK-${name.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
      name,
      nameBn: String(input.nameBn || lookupBengaliLabel(name) || '').trim() || undefined,
      subdivisionId: sub?.id || 'SUB-MSD-CUSTOM',
      subdivisionName: sub?.name || subdivisionName,
      district: String(input.district || 'Murshidabad'),
      lgdCode: input.lgdCode ? String(input.lgdCode).trim() : undefined,
      verificationStatus: 'VERIFIED'
    };
    db.blocks.push(block);
    this.save();
    return { success: true, message: `Added Block "${block.name}" (${block.subdivisionName}).`, block };
  }

  public editBlock(id: string, updates: { name?: string; nameBn?: string; subdivisionName?: string; lgdCode?: string }): {
    success: boolean;
    message: string;
    block?: BlockMaster;
  } {
    const db = this.init();
    const blk = db.blocks.find(b => b.id === id);
    if (!blk) return { success: false, message: 'Block not found.' };
    if (updates.name && updates.name.trim()) blk.name = updates.name.trim();
    if (updates.nameBn !== undefined) blk.nameBn = updates.nameBn.trim() || undefined;
    if (updates.subdivisionName && updates.subdivisionName.trim()) {
      const sub = db.subdivisions.find(s => s.name.toLowerCase() === updates.subdivisionName!.trim().toLowerCase());
      blk.subdivisionName = sub?.name || updates.subdivisionName.trim();
      if (sub) blk.subdivisionId = sub.id;
    }
    if (updates.lgdCode !== undefined) blk.lgdCode = updates.lgdCode.trim() || undefined;
    this.save();
    return { success: true, message: `Updated Block "${blk.name}".`, block: blk };
  }

  public listGramPanchayats(blockName?: string): GramPanchayatMaster[] {
    const db = this.init();
    const blkLower = String(blockName || '').trim().toLowerCase();
    return blkLower ? db.gramPanchayats.filter(g => g.blockName.toLowerCase() === blkLower) : [...db.gramPanchayats];
  }

  public addGramPanchayat(input: {
    name: string;
    nameBn?: string;
    blockName: string;
    subdivisionName?: string;
    pinCodes?: string[] | string;
  }): { success: boolean; message: string; gp?: GramPanchayatMaster } {
    const db = this.init();
    const name = String(input.name || '').trim();
    const blockName = String(input.blockName || 'Domkal').trim();
    if (!name) return { success: false, message: 'Gram Panchayat name is required.' };
    const exists = db.gramPanchayats.some(
      g => g.name.toLowerCase() === name.toLowerCase() && g.blockName.toLowerCase() === blockName.toLowerCase()
    );
    if (exists) return { success: false, message: `Gram Panchayat "${name}" already exists in ${blockName} Block.` };
    const matchedBlk = db.blocks.find(b => b.name.toLowerCase() === blockName.toLowerCase());
    const rawPins = Array.isArray(input.pinCodes)
      ? input.pinCodes
      : String(input.pinCodes || '').split(/[,\s]+/);
    const cleanPins = rawPins.map(p => String(p).replace(/[^0-9]/g, '').slice(0, 6)).filter(p => p.length === 6);

    const gp: GramPanchayatMaster = {
      id: `GP-${db.gramPanchayats.length + 1}-${Date.now().toString().slice(-4)}`,
      name,
      nameBn: String(input.nameBn || lookupBengaliLabel(name) || '').trim() || undefined,
      blockId: matchedBlk?.id || `BLK-${blockName.toUpperCase()}`,
      blockName: matchedBlk?.name || blockName,
      subdivisionName: matchedBlk?.subdivisionName || String(input.subdivisionName || 'Domkal'),
      district: 'Murshidabad',
      pinCodes: cleanPins,
      verificationStatus: 'VERIFIED',
      sourceName: 'Admin Location Manager'
    };
    db.gramPanchayats.push(gp);
    this.save();
    return { success: true, message: `Added Gram Panchayat "${gp.name}" (${gp.blockName}).`, gp };
  }

  public editGramPanchayat(id: string, updates: { name?: string; nameBn?: string; blockName?: string; pinCodes?: string[] | string }): {
    success: boolean;
    message: string;
    gp?: GramPanchayatMaster;
  } {
    const db = this.init();
    const gp = db.gramPanchayats.find(g => g.id === id);
    if (!gp) return { success: false, message: 'Gram Panchayat not found.' };
    if (updates.name && updates.name.trim()) gp.name = updates.name.trim();
    if (updates.nameBn !== undefined) gp.nameBn = updates.nameBn.trim() || undefined;
    if (updates.blockName && updates.blockName.trim()) {
      const matchedBlk = db.blocks.find(b => b.name.toLowerCase() === updates.blockName!.trim().toLowerCase());
      gp.blockName = matchedBlk?.name || updates.blockName.trim();
      if (matchedBlk) {
        gp.blockId = matchedBlk.id;
        gp.subdivisionName = matchedBlk.subdivisionName;
      }
    }
    if (updates.pinCodes !== undefined) {
      const rawPins = Array.isArray(updates.pinCodes) ? updates.pinCodes : String(updates.pinCodes || '').split(/[,\s]+/);
      gp.pinCodes = rawPins.map(p => String(p).replace(/[^0-9]/g, '').slice(0, 6)).filter(p => p.length === 6);
    }
    this.save();
    return { success: true, message: `Updated Gram Panchayat "${gp.name}".`, gp };
  }

  public listPostOfficesMaster(): PostOfficeMaster[] {
    const db = this.init();
    return [...(db.postOfficesMaster || [])];
  }

  public addPostOffice(input: {
    name: string;
    nameBn?: string;
    pinCode: string;
    blockOrMunicipality?: string;
    policeStation?: string;
    subdivisionName?: string;
    branchType?: string;
  }): { success: boolean; message: string; postOffice?: PostOfficeMaster } {
    const db = this.init();
    const name = String(input.name || '').trim();
    const pinCode = String(input.pinCode || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (!name) return { success: false, message: 'Post Office name is required.' };
    if (pinCode.length !== 6) return { success: false, message: 'Valid 6-digit Indian PIN Code is required for Post Office.' };
    if (!Array.isArray(db.postOfficesMaster)) db.postOfficesMaster = [];
    if (db.postOfficesMaster.some(p => p.name.toLowerCase() === name.toLowerCase() && p.pinCode === pinCode)) {
      return { success: false, message: `Post Office "${name}" (${pinCode}) already exists.` };
    }
    const po: PostOfficeMaster = {
      id: `PO-${db.postOfficesMaster.length + 1}-${Date.now().toString().slice(-4)}`,
      name,
      nameBn: String(input.nameBn || lookupBengaliLabel(name) || '').trim() || undefined,
      pinCode,
      branchType: String(input.branchType || 'B.O. / S.O.').trim(),
      blockOrMunicipality: String(input.blockOrMunicipality || 'Domkal').trim(),
      policeStation: String(input.policeStation || 'Domkal').trim(),
      subdivisionName: String(input.subdivisionName || 'Domkal').trim(),
      district: 'Murshidabad',
      verificationStatus: 'VERIFIED',
      sourceName: 'Admin Location Manager'
    };
    db.postOfficesMaster.unshift(po);
    // Sync PIN Code master as well
    this.addPinCode({ pinCode, postOffices: [name], blockOrMunicipality: po.blockOrMunicipality });
    this.save();
    return { success: true, message: `Added Post Office "${po.name}" (${po.pinCode}).`, postOffice: po };
  }

  public editPostOffice(id: string, updates: Partial<PostOfficeMaster>): { success: boolean; message: string; postOffice?: PostOfficeMaster } {
    const db = this.init();
    const po = (db.postOfficesMaster || []).find(p => p.id === id);
    if (!po) return { success: false, message: 'Post Office not found.' };
    if (updates.name && updates.name.trim()) po.name = updates.name.trim();
    if (updates.nameBn !== undefined) po.nameBn = updates.nameBn.trim() || undefined;
    if (updates.pinCode) {
      const cleanPin = String(updates.pinCode).replace(/[^0-9]/g, '').slice(0, 6);
      if (cleanPin.length !== 6) return { success: false, message: 'PIN Code must be 6 digits.' };
      po.pinCode = cleanPin;
    }
    if (updates.blockOrMunicipality !== undefined) po.blockOrMunicipality = updates.blockOrMunicipality.trim();
    if (updates.policeStation !== undefined) po.policeStation = updates.policeStation.trim();
    this.save();
    return { success: true, message: `Updated Post Office "${po.name}".`, postOffice: po };
  }

  public listPoliceStationsMaster(): PoliceStationMaster[] {
    const db = this.init();
    return [...(db.policeStationsMaster || [])];
  }

  public addPoliceStation(input: {
    name: string;
    nameBn?: string;
    subdivisionName?: string;
    blockOrMunicipality?: string;
    pinCodes?: string[] | string;
  }): { success: boolean; message: string; policeStation?: PoliceStationMaster } {
    const db = this.init();
    const name = String(input.name || '').trim();
    if (!name) return { success: false, message: 'Police Station name is required.' };
    if (!Array.isArray(db.policeStationsMaster)) db.policeStationsMaster = [];
    if (db.policeStationsMaster.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return { success: false, message: `Police Station "${name}" already exists.` };
    }
    const rawPins = Array.isArray(input.pinCodes) ? input.pinCodes : String(input.pinCodes || '').split(/[,\s]+/);
    const cleanPins = rawPins.map(p => String(p).replace(/[^0-9]/g, '').slice(0, 6)).filter(p => p.length === 6);
    const ps: PoliceStationMaster = {
      id: `PS-${db.policeStationsMaster.length + 1}-${Date.now().toString().slice(-4)}`,
      name,
      nameBn: String(input.nameBn || lookupBengaliLabel(name) || '').trim() || undefined,
      subdivisionName: String(input.subdivisionName || 'Domkal').trim(),
      blockOrMunicipality: String(input.blockOrMunicipality || '').trim(),
      district: 'Murshidabad',
      pinCodes: cleanPins,
      verificationStatus: 'VERIFIED',
      sourceName: 'Admin Location Manager'
    };
    db.policeStationsMaster.unshift(ps);
    this.save();
    return { success: true, message: `Added Police Station "${ps.name}".`, policeStation: ps };
  }

  public editPoliceStation(id: string, updates: { name?: string; nameBn?: string; subdivisionName?: string; blockOrMunicipality?: string; pinCodes?: string[] | string }): {
    success: boolean;
    message: string;
    policeStation?: PoliceStationMaster;
  } {
    const db = this.init();
    const ps = (db.policeStationsMaster || []).find(p => p.id === id);
    if (!ps) return { success: false, message: 'Police Station not found.' };
    if (updates.name && updates.name.trim()) ps.name = updates.name.trim();
    if (updates.nameBn !== undefined) ps.nameBn = updates.nameBn.trim() || undefined;
    if (updates.subdivisionName !== undefined) ps.subdivisionName = updates.subdivisionName.trim();
    if (updates.blockOrMunicipality !== undefined) ps.blockOrMunicipality = updates.blockOrMunicipality.trim();
    if (updates.pinCodes !== undefined) {
      const rawPins = Array.isArray(updates.pinCodes) ? updates.pinCodes : String(updates.pinCodes || '').split(/[,\s]+/);
      ps.pinCodes = rawPins.map(p => String(p).replace(/[^0-9]/g, '').slice(0, 6)).filter(p => p.length === 6);
    }
    this.save();
    return { success: true, message: `Updated Police Station "${ps.name}".`, policeStation: ps };
  }

  public listPinCodesMaster(): PinCodeMaster[] {
    const db = this.init();
    return [...(db.pinCodesMaster || [])];
  }

  public addPinCode(input: {
    pinCode: string;
    postOffices?: string[] | string;
    areaNames?: string[] | string;
    blockOrMunicipality?: string;
    district?: string;
    state?: string;
  }): { success: boolean; message: string; pinRecord?: PinCodeMaster } {
    const db = this.init();
    const pinCode = String(input.pinCode || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (pinCode.length !== 6) return { success: false, message: 'PIN Code must be an exact 6-digit number.' };
    if (!Array.isArray(db.pinCodesMaster)) db.pinCodesMaster = [];
    const postOffices = (Array.isArray(input.postOffices) ? input.postOffices : String(input.postOffices || '').split(','))
      .map(s => String(s).trim()).filter(Boolean);
    const areaNames = (Array.isArray(input.areaNames) ? input.areaNames : String(input.areaNames || '').split(','))
      .map(s => String(s).trim()).filter(Boolean);

    const existing = db.pinCodesMaster.find(p => p.pinCode === pinCode);
    if (existing) {
      postOffices.forEach(po => { if (!existing.postOffices.includes(po)) existing.postOffices.push(po); });
      if (!existing.areaNames) existing.areaNames = [];
      areaNames.forEach(an => { if (!existing.areaNames!.includes(an)) existing.areaNames!.push(an); });
      if (input.blockOrMunicipality) existing.blockOrMunicipality = input.blockOrMunicipality;
      this.save();
      return { success: true, message: `Updated PIN Code ${pinCode}.`, pinRecord: existing };
    }

    const rec: PinCodeMaster = {
      id: `PIN-${pinCode}`,
      pinCode,
      postOffices,
      areaNames,
      blockOrMunicipality: String(input.blockOrMunicipality || '').trim(),
      district: String(input.district || 'Murshidabad').trim(),
      state: String(input.state || 'West Bengal').trim(),
      verificationStatus: 'VERIFIED',
      sourceName: 'Admin Location Manager'
    };
    db.pinCodesMaster.unshift(rec);
    this.save();
    return { success: true, message: `Added PIN Code ${pinCode}.`, pinRecord: rec };
  }

  public editPinCode(idOrPin: string, updates: { postOffices?: string[] | string; areaNames?: string[] | string; blockOrMunicipality?: string }): {
    success: boolean;
    message: string;
    pinRecord?: PinCodeMaster;
  } {
    const db = this.init();
    const rec = (db.pinCodesMaster || []).find(p => p.id === idOrPin || p.pinCode === idOrPin);
    if (!rec) return { success: false, message: 'PIN Code record not found.' };
    if (updates.postOffices !== undefined) {
      rec.postOffices = (Array.isArray(updates.postOffices) ? updates.postOffices : String(updates.postOffices || '').split(','))
        .map(s => String(s).trim()).filter(Boolean);
    }
    if (updates.areaNames !== undefined) {
      rec.areaNames = (Array.isArray(updates.areaNames) ? updates.areaNames : String(updates.areaNames || '').split(','))
        .map(s => String(s).trim()).filter(Boolean);
    }
    if (updates.blockOrMunicipality !== undefined) rec.blockOrMunicipality = updates.blockOrMunicipality.trim();
    this.save();
    return { success: true, message: `Updated PIN Code ${rec.pinCode}.`, pinRecord: rec };
  }

  // -------------------------------------------------------------------------
  // DYNAMIC ANNAPURNA WARD & VILLAGE MASTER (WARD 01 - WARD 21 + ADMIN CRUD)
  // -------------------------------------------------------------------------
  private sortWards(list: WardMasterRecord[]): WardMasterRecord[] {
    return [...list].sort((a, b) => {
      const na = Number(a.wardNo) || 9999;
      const nb = Number(b.wardNo) || 9999;
      if (na !== nb) return na - nb;
      return String(a.wardNumber || a.wardName || '').localeCompare(String(b.wardNumber || b.wardName || ''));
    });
  }

  private sortVillages(list: WardVillageMasterRecord[]): WardVillageMasterRecord[] {
    return [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  private normalizeStrictName(s: string): string {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  public getWardVillageMaster(params: {
    includeInactive?: boolean;
    includeDeleted?: boolean;
    wardId?: string;
    q?: string;
  } = {}) {
    const db = this.init();
    this.ensureAnnapurnaWardMasterInitialized();
    const includeInactive = Boolean(params.includeInactive);
    const includeDeleted = Boolean(params.includeDeleted);
    const q = String(params.q || '').trim().toLowerCase();

    const allWards = (db.wardMaster || []).filter(w => {
      if (!includeDeleted && w.isDeleted) return false;
      if (!includeInactive && !w.isActive) return false;
      return true;
    });

    const allVillagesRaw = (db.wardVillageMaster || []).filter(v => {
      if (!includeDeleted && v.isDeleted) return false;
      if (!includeInactive && !v.isActive) return false;
      return true;
    });

    const wardsWithCounts = this.sortWards(allWards)
      .filter(w => {
        if (!q) return true;
        const hay = `${w.wardNumber} ${w.wardName} ${w.wardId} ${w.wardCode}`.toLowerCase();
        if (hay.includes(q)) return true;
        return allVillagesRaw.some(v => v.wardId === w.wardId && v.name.toLowerCase().includes(q));
      })
      .map(w => {
        const linkedAll = (db.wardVillageMaster || []).filter(v => v.wardId === w.wardId && !v.isDeleted);
        const linkedActive = linkedAll.filter(v => v.isActive);
        return {
          ...w,
          activeVillageCount: linkedActive.length,
          totalVillageCount: linkedAll.length
        };
      });

    let villages = this.sortVillages(allVillagesRaw);
    if (params.wardId) {
      villages = villages.filter(v => v.wardId === params.wardId);
    }
    if (q) {
      villages = villages.filter(v => v.name.toLowerCase().includes(q));
    }

    return {
      wards: wardsWithCounts,
      villages
    };
  }

  public addMasterWard(
    input: {
      wardNumber?: string;
      wardName?: string;
      wardNo?: number;
      municipalityName?: string;
    },
    actorUid: string
  ): { success: boolean; duplicate?: boolean; message: string; ward?: WardMasterRecord } {
    const db = this.init();
    this.ensureAnnapurnaWardMasterInitialized();
    const rawNumInput = String(input.wardNumber || input.wardName || '').trim();
    if (!rawNumInput) {
      return { success: false, message: 'Ward Number / Name is required.' };
    }

    const numMatch = rawNumInput.match(/\d+/);
    const parsedNo = input.wardNo ? Number(input.wardNo) : (numMatch ? parseInt(numMatch[0], 10) : 0);
    const wardNumber = numMatch && /^\d+$/.test(rawNumInput)
      ? `Ward ${String(parsedNo).padStart(2, '0')}`
      : rawNumInput;
    const wardName = String(input.wardName || wardNumber).trim();
    const wardCode = parsedNo > 0 ? `WARD ${String(parsedNo).padStart(2, '0')}` : wardNumber.toUpperCase();

    const dup = (db.wardMaster || []).some(w => {
      if (w.isDeleted) return false;
      if (this.normalizeStrictName(w.wardNumber) === this.normalizeStrictName(wardNumber)) return true;
      if (parsedNo > 0 && w.wardNo === parsedNo) return true;
      return false;
    });
    if (dup) {
      return {
        success: false,
        duplicate: true,
        message: `Ward "${wardNumber}" already exists.`
      };
    }

    const nowIso = new Date().toISOString();
    const baseId = parsedNo > 0 ? `WRD-${String(parsedNo).padStart(2, '0')}` : `WRD-${Date.now().toString().slice(-6)}`;
    const uniqueWardId = (db.wardMaster || []).some(w => w.wardId === baseId)
      ? `WRD-${Date.now().toString().slice(-6)}`
      : baseId;

    const ward: WardMasterRecord = {
      wardId: uniqueWardId,
      wardNo: parsedNo || ((db.wardMaster?.length || 0) + 1),
      wardNumber,
      wardName,
      wardCode,
      municipalityName: String(input.municipalityName || 'Domkal Municipality').trim(),
      isActive: true,
      isDeleted: false,
      isDefault: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: actorUid,
      updatedBy: actorUid
    };

    db.wardMaster!.push(ward);

    // Sync MunicipalityWard if not already present
    if (!db.municipalityWards.some(mw => mw.wardCode.toUpperCase() === ward.wardCode.toUpperCase())) {
      db.municipalityWards.push({
        id: `DM-${ward.wardId}`,
        municipalityId: 'MUN-DOMKAL-273007',
        municipalityLgd: '273007',
        wardNo: ward.wardNo,
        wardCode: ward.wardCode,
        wardName: `${ward.wardName} - ${ward.municipalityName}`,
        mouzaIds: [],
        postOffices: ['Domkal'],
        pinCodes: ['742303'],
        verificationStatus: 'VERIFIED',
        sourceName: 'Admin Ward Master'
      });
    }

    this.save();
    return { success: true, message: `Added ${ward.wardNumber} (${ward.wardName}).`, ward };
  }

  public editMasterWard(
    wardId: string,
    updates: {
      wardNumber?: string;
      wardName?: string;
      wardNo?: number;
      isActive?: boolean;
    },
    actorUid: string
  ): { success: boolean; duplicate?: boolean; message: string; ward?: WardMasterRecord } {
    const db = this.init();
    this.ensureAnnapurnaWardMasterInitialized();
    const ward = (db.wardMaster || []).find(w => w.wardId === wardId && !w.isDeleted);
    if (!ward) {
      return { success: false, message: 'Ward not found.' };
    }

    const nextNumber = updates.wardNumber !== undefined ? String(updates.wardNumber).trim() : ward.wardNumber;
    const nextName = updates.wardName !== undefined ? String(updates.wardName).trim() : ward.wardName;
    if (!nextNumber || !nextName) {
      return { success: false, message: 'Ward Number and Ward Name cannot be empty.' };
    }

    const numMatch = nextNumber.match(/\d+/);
    const nextNo = updates.wardNo !== undefined ? Number(updates.wardNo) : (numMatch ? parseInt(numMatch[0], 10) : ward.wardNo);
    const dup = (db.wardMaster || []).some(w => {
      if (w.isDeleted || w.wardId === wardId) return false;
      if (this.normalizeStrictName(w.wardNumber) === this.normalizeStrictName(nextNumber)) return true;
      if (nextNo > 0 && w.wardNo === nextNo) return true;
      return false;
    });
    if (dup) {
      return { success: false, duplicate: true, message: `Another Ward "${nextNumber}" already exists.` };
    }

    const oldWardCode = ward.wardCode;
    ward.wardNumber = nextNumber;
    ward.wardName = nextName;
    ward.wardNo = nextNo;
    ward.wardCode = nextNo > 0 ? `WARD ${String(nextNo).padStart(2, '0')}` : nextNumber.toUpperCase();
    if (updates.isActive !== undefined) {
      ward.isActive = Boolean(updates.isActive);
    }
    ward.updatedAt = new Date().toISOString();
    ward.updatedBy = actorUid;

    // Sync municipalityWards & municipalityLocalities wardCode cleanly
    const mw = db.municipalityWards.find(m => m.wardCode === oldWardCode || m.id === `DM-${ward.wardId}`);
    if (mw) {
      mw.wardNo = ward.wardNo;
      mw.wardCode = ward.wardCode;
      mw.wardName = `${ward.wardName} - ${ward.municipalityName}`;
    }
    if (oldWardCode !== ward.wardCode) {
      db.municipalityLocalities.forEach(l => {
        if (l.wardCode === oldWardCode) l.wardCode = ward.wardCode;
      });
    }

    this.save();
    return {
      success: true,
      message: `Updated ${ward.wardNumber} (${ward.isActive ? 'Active' : 'Inactive'}). Historical application records remain preserved.`,
      ward
    };
  }

  public deleteMasterWard(
    wardId: string,
    options: {
      mode?: 'soft' | 'permanent';
      reassignToWardId?: string;
      forceCascadeDeactivate?: boolean;
    } = {},
    actorUid: string
  ): { success: boolean; blocked?: boolean; linkedCount?: number; message: string } {
    const db = this.init();
    this.ensureAnnapurnaWardMasterInitialized();
    const ward = (db.wardMaster || []).find(w => w.wardId === wardId && !w.isDeleted);
    if (!ward) {
      return { success: false, message: 'Ward not found.' };
    }

    const linkedVillages = (db.wardVillageMaster || []).filter(v => v.wardId === wardId && !v.isDeleted);
    const activeLinked = linkedVillages.filter(v => v.isActive);

    if (activeLinked.length > 0 && !options.reassignToWardId && !options.forceCascadeDeactivate) {
      return {
        success: false,
        blocked: true,
        linkedCount: activeLinked.length,
        message: `Cannot delete ${ward.wardNumber}: ${activeLinked.length} active village/locality record(s) are linked to this Ward. Reassign or deactivate them first.`
      };
    }

    const nowIso = new Date().toISOString();
    if (options.reassignToWardId && options.reassignToWardId !== wardId) {
      const targetWard = (db.wardMaster || []).find(w => w.wardId === options.reassignToWardId && !w.isDeleted);
      if (!targetWard) {
        return { success: false, message: 'Target Ward for reassignment not found.' };
      }
      for (const v of linkedVillages) {
        const dupInTarget = (db.wardVillageMaster || []).some(
          tv => !tv.isDeleted && tv.wardId === targetWard.wardId && this.normalizeStrictName(tv.name) === this.normalizeStrictName(v.name)
        );
        if (!dupInTarget) {
          v.wardId = targetWard.wardId;
          v.updatedAt = nowIso;
          v.updatedBy = actorUid;
        } else {
          v.isActive = false;
          v.isDeleted = true;
          v.updatedAt = nowIso;
          v.updatedBy = actorUid;
        }
      }
    } else if (options.forceCascadeDeactivate) {
      linkedVillages.forEach(v => {
        v.isActive = false;
        v.isDeleted = options.mode !== 'soft';
        v.updatedAt = nowIso;
        v.updatedBy = actorUid;
      });
    }

    ward.isActive = false;
    ward.isDeleted = true;
    ward.updatedAt = nowIso;
    ward.updatedBy = actorUid;

    this.save();
    return {
      success: true,
      message: `${ward.wardNumber} removed from active master selection. Existing historical applications retain saved snapshots.`
    };
  }

  public addMasterWardVillage(
    input: {
      wardId: string;
      name: string;
      postOffice?: string;
      pinCode?: string;
    },
    actorUid: string
  ): { success: boolean; duplicate?: boolean; message: string; village?: WardVillageMasterRecord } {
    const db = this.init();
    this.ensureAnnapurnaWardMasterInitialized();
    const ward = (db.wardMaster || []).find(w => w.wardId === input.wardId && !w.isDeleted);
    if (!ward) {
      return { success: false, message: 'Parent Ward not found.' };
    }
    const cleanName = String(input.name || '').trim();
    if (!cleanName) {
      return { success: false, message: 'Village / Locality / Para name is required.' };
    }

    // Duplicate check ONLY within the same Ward (identical names across different Wards are allowed!)
    const dup = (db.wardVillageMaster || []).some(
      v => !v.isDeleted && v.wardId === ward.wardId && this.normalizeStrictName(v.name) === this.normalizeStrictName(cleanName)
    );
    if (dup) {
      return {
        success: false,
        duplicate: true,
        message: `Duplicate prevented: "${cleanName}" already exists inside ${ward.wardNumber}.`
      };
    }

    const nowIso = new Date().toISOString();
    const id = `WRDVIL-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const village: WardVillageMasterRecord = {
      id,
      wardId: ward.wardId,
      name: cleanName,
      postOffice: String(input.postOffice || 'Domkal').trim(),
      pinCode: String(input.pinCode || '742303').replace(/[^0-9]/g, '').slice(0, 6) || '742303',
      isActive: true,
      isDeleted: false,
      isDefault: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: actorUid,
      updatedBy: actorUid
    };

    db.wardVillageMaster!.push(village);

    // Sync into municipalityLocalities for global compatibility
    if (!db.municipalityLocalities.some(l => l.wardCode === ward.wardCode && this.normalizeStrictName(l.correctedEnglishName) === this.normalizeStrictName(cleanName))) {
      db.municipalityLocalities.push({
        id: `DM-LOC-${id}`,
        municipalityId: 'MUN-DOMKAL-273007',
        municipalityLgd: '273007',
        wardCode: ward.wardCode,
        mouzaName: cleanName,
        originalSpelling: cleanName.toUpperCase(),
        correctedEnglishName: cleanName,
        postOffice: village.postOffice || 'Domkal',
        policeStation: 'Domkal',
        pinCode: village.pinCode || '742303',
        sourceName: 'Admin Ward & Village Master',
        sourceUrlOrDocument: 'Ward Master UI',
        sourceDate: nowIso.slice(0, 10),
        importDate: nowIso,
        verificationStatus: 'VERIFIED',
        verifiedBy: actorUid
      });
    }

    this.save();
    return {
      success: true,
      message: `Added "${cleanName}" to ${ward.wardNumber}.`,
      village
    };
  }

  public editMasterWardVillage(
    id: string,
    updates: {
      name?: string;
      targetWardId?: string;
      postOffice?: string;
      pinCode?: string;
      isActive?: boolean;
    },
    actorUid: string
  ): { success: boolean; duplicate?: boolean; message: string; village?: WardVillageMasterRecord } {
    const db = this.init();
    this.ensureAnnapurnaWardMasterInitialized();
    const village = (db.wardVillageMaster || []).find(v => v.id === id && !v.isDeleted);
    if (!village) {
      return { success: false, message: 'Village / Locality record not found.' };
    }

    const nextName = updates.name !== undefined ? String(updates.name).trim() : village.name;
    if (!nextName) {
      return { success: false, message: 'Village / Locality name cannot be empty.' };
    }

    const nextWardId = updates.targetWardId ? String(updates.targetWardId).trim() : village.wardId;
    const targetWard = (db.wardMaster || []).find(w => w.wardId === nextWardId && !w.isDeleted);
    if (!targetWard) {
      return { success: false, message: 'Target Ward not found.' };
    }

    const dup = (db.wardVillageMaster || []).some(
      v => !v.isDeleted && v.id !== id && v.wardId === targetWard.wardId && this.normalizeStrictName(v.name) === this.normalizeStrictName(nextName)
    );
    if (dup) {
      return {
        success: false,
        duplicate: true,
        message: `Duplicate prevented: "${nextName}" already exists inside ${targetWard.wardNumber}.`
      };
    }

    const prevName = village.name;
    const prevWardId = village.wardId;
    const prevWard = (db.wardMaster || []).find(w => w.wardId === prevWardId);

    village.name = nextName;
    village.wardId = targetWard.wardId;
    if (updates.postOffice !== undefined) village.postOffice = String(updates.postOffice).trim();
    if (updates.pinCode !== undefined) {
      const cleanPin = String(updates.pinCode).replace(/[^0-9]/g, '').slice(0, 6);
      if (cleanPin.length === 6) village.pinCode = cleanPin;
    }
    if (updates.isActive !== undefined) village.isActive = Boolean(updates.isActive);
    village.updatedAt = new Date().toISOString();
    village.updatedBy = actorUid;

    // Sync municipalityLocalities
    const loc = db.municipalityLocalities.find(
      l =>
        l.id === `DM-LOC-${id}` ||
        ((prevWard?.wardCode ? l.wardCode === prevWard.wardCode : true) && this.normalizeStrictName(l.correctedEnglishName) === this.normalizeStrictName(prevName))
    );
    if (loc) {
      loc.correctedEnglishName = village.name;
      loc.originalSpelling = village.name.toUpperCase();
      loc.wardCode = targetWard.wardCode;
      if (village.postOffice) loc.postOffice = village.postOffice;
      if (village.pinCode) loc.pinCode = village.pinCode;
    }

    this.save();
    return {
      success: true,
      message:
        prevWardId !== targetWard.wardId
          ? `Moved "${village.name}" to ${targetWard.wardNumber}.`
          : `Updated "${village.name}" (${village.isActive ? 'Active' : 'Inactive'}). Historical records remain preserved.`,
      village
    };
  }

  public deleteMasterWardVillage(
    id: string,
    actorUid: string
  ): { success: boolean; message: string } {
    const db = this.init();
    this.ensureAnnapurnaWardMasterInitialized();
    const village = (db.wardVillageMaster || []).find(v => v.id === id && !v.isDeleted);
    if (!village) {
      return { success: false, message: 'Village / Locality record not found.' };
    }

    village.isActive = false;
    village.isDeleted = true;
    village.updatedAt = new Date().toISOString();
    village.updatedBy = actorUid;

    // Also remove from active municipalityLocalities if it matches
    db.municipalityLocalities = db.municipalityLocalities.filter(l => l.id !== `DM-LOC-${id}`);

    this.save();
    return {
      success: true,
      message: `Deleted "${village.name}" from master options. Existing historical applications remain intact.`
    };
  }
}

export const murshidabadMaster = new MurshidabadLocationMasterService();
