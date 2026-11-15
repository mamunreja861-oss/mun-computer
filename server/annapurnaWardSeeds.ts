/**
 * annapurnaWardSeeds.ts
 * Exact Preloaded Domkal Municipality Ward (Ward 01 - Ward 21) & Locality/Para Master
 * Preserves exact spellings (including * markers) and cross-Ward duplicate village names.
 */

export interface WardMasterRecord {
  wardId: string;
  wardNo: number;
  wardNumber: string; // e.g. 'Ward 01'
  wardName: string;   // e.g. 'Ward 01'
  wardCode: string;   // e.g. 'WARD 01'
  areaType?: 'URBAN' | 'RURAL';
  municipalityName: string;
  policeStation?: string;
  district?: string;
  state?: string;
  isActive: boolean;
  isDeleted: boolean;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface WardVillageMasterRecord {
  id: string;
  wardId: string;
  name: string;
  areaType?: 'URBAN' | 'RURAL';
  postOffice?: string;
  policeStation?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  isActive: boolean;
  isDeleted: boolean;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export const INITIAL_DOMKAL_WARD_VILLAGES: Array<{
  wardNo: number;
  wardNumber: string;
  postOffice: string;
  pinCode: string;
  villages: string[];
}> = [
  {
    wardNo: 1,
    wardNumber: 'Ward 01',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Abu Bakkar Para',
      'Bartamanabad',
      'Bartamanabad Purbapara',
      'Chowdhury Para',
      'Fakirabad Paschimpara',
      'Fakirabad Purbapara',
      'Jitpur Paschimpara',
      'Jitpur Purbapara',
      'Sarkar Para'
    ]
  },
  {
    wardNo: 2,
    wardNumber: 'Ward 02',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Madhya Para',
      'Majhi Para',
      'Natun Para',
      'Paschim Para',
      'Purba Para',
      'Siro Para',
      'Tiktiki Para'
    ]
  },
  {
    wardNo: 3,
    wardNumber: 'Ward 03',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Baghajhara',
      'Gangadas Para',
      'Islam Tulu*',
      'Mondal Para',
      'Nude Nagar*',
      'Sahaji Para',
      'Sarkar Para'
    ]
  },
  {
    wardNo: 4,
    wardNumber: 'Ward 04',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Bajitpur Bhim Para',
      'Bajitpur Maher Para',
      'Bajitpur Sanyal Para',
      'Mahabub Nagar',
      'Ramna Sekh Para',
      'Shambhunagar'
    ]
  },
  {
    wardNo: 5,
    wardNumber: 'Ward 05',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Bartamanabad Masjid Para',
      'Bartamanabad Biswas Para',
      'Bartamanabad Hai Para',
      'Bartamanabad Madhya Para',
      'Bartamanabad Mondal Para',
      'Bartamanabad',
      'Jhabir Para',
      'Maula Para'
    ]
  },
  {
    wardNo: 6,
    wardNumber: 'Ward 06',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Biswas Para',
      'Daki Para',
      'Jarip Para',
      'Jali Para',
      'Molla Para',
      'Putatan Para*',
      'Resma Bibi',
      'Sowa Para'
    ]
  },
  {
    wardNo: 7,
    wardNumber: 'Ward 07',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Kalibari',
      'Kulbon Jar*',
      'Kulbona',
      'Manik Nagar',
      'Ramnagar',
      'Shambhunagar'
    ]
  },
  {
    wardNo: 8,
    wardNumber: 'Ward 08',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Babu Para',
      'Captain Para',
      'Dari Para',
      'Das Para',
      'Gangadas Para',
      'Malitha*',
      'Maitha Para*'
    ]
  },
  {
    wardNo: 9,
    wardNumber: 'Ward 09',
    postOffice: 'Garabaria',
    pinCode: '742303',
    villages: [
      'Ramnagar Satbariya',
      'Hetanpur',
      'Masimpur',
      'Velurchak'
    ]
  },
  {
    wardNo: 10,
    wardNumber: 'Ward 10',
    postOffice: 'Azimganjgola',
    pinCode: '742303',
    villages: [
      'Domkal Kuthi Sabaria',
      'Domkal Kuthi',
      'Domkal Mahisha Para',
      'Domkal Muslim Para',
      'Khutistabaria'
    ]
  },
  {
    wardNo: 11,
    wardNumber: 'Ward 11',
    postOffice: 'Azimganjgola',
    pinCode: '742303',
    villages: [
      'Dafadar Para',
      'Jayrampur*',
      'Khan Saheb Para',
      'Natun Para'
    ]
  },
  {
    wardNo: 12,
    wardNumber: 'Ward 12',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Azimganjgola',
      'Bajar Para',
      'Kamalat Barnagar*',
      'Kamnath Barnagar*',
      'Karigar Para',
      'Mutta Para',
      'Power House Para',
      'Ramnayat Barnagar'
    ]
  },
  {
    wardNo: 13,
    wardNumber: 'Ward 13',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Bablabona Sahi Para',
      'Farka Para',
      'Ghat Para',
      'Macher Para',
      'Masjid Para',
      'Mechef Para*',
      'Mola Para',
      'Saha Para'
    ]
  },
  {
    wardNo: 14,
    wardNumber: 'Ward 14',
    postOffice: 'Basantpur (Murshidabad)',
    pinCode: '742406',
    villages: [
      'Bhatsala',
      'Gobindapur'
    ]
  },
  {
    wardNo: 15,
    wardNumber: 'Ward 15',
    postOffice: 'Juginda',
    pinCode: '742406',
    villages: [
      'Paschim Shikal Para',
      'Paschim Para'
    ]
  },
  {
    wardNo: 16,
    wardNumber: 'Ward 16',
    postOffice: 'Juginda',
    pinCode: '742406',
    villages: [
      'Chak Bhikhari',
      'Dakshin Para',
      'Dakshin Nagar',
      'Mamud Para',
      'Mamudpur',
      'Uttar Para'
    ]
  },
  {
    wardNo: 17,
    wardNumber: 'Ward 17',
    postOffice: 'Juginda',
    pinCode: '742406',
    villages: [
      'Basantapur Sekhpara',
      'Basgudutt Para*',
      'Bhatsala Duttapur Para*',
      'Bhatsala Dutta Para',
      'Bhatsala Rathi Para',
      'Biswas Para',
      'Dutta Para',
      'Ramna Etbarnagar*',
      'Sekh Para'
    ]
  },
  {
    wardNo: 18,
    wardNumber: 'Ward 18',
    postOffice: 'Juginda',
    pinCode: '742406',
    villages: [
      'Jhaubaria',
      'Juginda Kamarpara',
      'Juginda Malopara',
      'Mahidhupur*'
    ]
  },
  {
    wardNo: 19,
    wardNumber: 'Ward 19',
    postOffice: 'Basantpur (Murshidabad)',
    pinCode: '742406',
    villages: [
      'Biswas Para',
      'Hasanpur',
      'Kalupur',
      'Malitya Para',
      'Rahta Para*'
    ]
  },
  {
    wardNo: 20,
    wardNumber: 'Ward 20',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Aminabad',
      'Biswas Para',
      'Dakshin Sekh Para',
      'Purba Para'
    ]
  },
  {
    wardNo: 21,
    wardNumber: 'Ward 21',
    postOffice: 'Domkal',
    pinCode: '742303',
    villages: [
      'Ambarpur',
      'Chak Ambarpur',
      'Piplapuri'
    ]
  }
];

export function buildInitialWardVillageMasterSeeds(nowIso = new Date().toISOString()): {
  wards: WardMasterRecord[];
  villages: WardVillageMasterRecord[];
} {
  const wards: WardMasterRecord[] = [];
  const villages: WardVillageMasterRecord[] = [];

  for (const group of INITIAL_DOMKAL_WARD_VILLAGES) {
    const pad2 = String(group.wardNo).padStart(2, '0');
    const wardId = `WRD-${pad2}`;
    wards.push({
      wardId,
      wardNo: group.wardNo,
      wardNumber: group.wardNumber,
      wardName: group.wardNumber,
      wardCode: `WARD ${pad2}`,
      areaType: 'URBAN',
      municipalityName: 'Domkal Municipality',
      policeStation: 'Domkal',
      district: 'Murshidabad',
      state: 'West Bengal',
      isActive: true,
      isDeleted: false,
      isDefault: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: 'SYSTEM_SEED'
    });

    group.villages.forEach((vName, idx) => {
      villages.push({
        id: `WRDVIL-${pad2}-${String(idx + 1).padStart(2, '0')}`,
        wardId,
        name: vName,
        areaType: 'URBAN',
        postOffice: group.postOffice,
        policeStation: 'Domkal',
        district: 'Murshidabad',
        state: 'West Bengal',
        pinCode: group.pinCode,
        isActive: true,
        isDeleted: false,
        isDefault: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: 'SYSTEM_SEED'
      });
    });
  }

  return { wards, villages };
}
