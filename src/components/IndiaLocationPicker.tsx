import React, { useEffect, useState } from 'react';
import { MapPin, Search } from 'lucide-react';

export interface LocationValue {
  areaType: 'RURAL' | 'URBAN';
  state: string;
  district: string;
  subdivision?: string;
  blockOrMunicipality: string;
  gpOrWard: string;
  mouza?: string;
  village: string;
  postOffice: string;
  policeStation: string;
  pinCode: string;
  formattedAddress: string;
}

interface IndiaLocationPickerProps {
  onChange: (value: LocationValue) => void;
  required?: boolean;
  defaultState?: string;
  defaultDistrict?: string;
}

const CUSTOM_SENTINEL = '__CUSTOM__';

export const IndiaLocationPicker: React.FC<IndiaLocationPickerProps> = ({
  onChange,
  required = false,
  defaultState = 'West Bengal',
  defaultDistrict = 'Murshidabad'
}) => {
  const [areaType, setAreaType] = useState<'RURAL' | 'URBAN'>('RURAL');
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [subdivisions, setSubdivisions] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [gramPanchayats, setGramPanchayats] = useState<string[]>([]);
  const [municipalities, setMunicipalities] = useState<Array<{ lgdCode: string; name: string }>>([]);
  const [wards, setWards] = useState<Array<{ wardCode: string; wardName: string; pinCodes?: string[] }>>([]);
  const [mouzas, setMouzas] = useState<string[]>([]);
  const [localities, setLocalities] = useState<Array<{ label: string; value: string; pinCode?: string; postOffice?: string }>>([]);
  const [ruralVillageMeta, setRuralVillageMeta] = useState<Record<string, { pinCode: string; postOffice: string; policeStation: string; gpName: string }>>({});

  const [villages, setVillages] = useState<string[]>([]);
  const [postOffices, setPostOffices] = useState<string[]>([]);
  const [policeStations, setPoliceStations] = useState<string[]>([]);
  const [pincodes, setPincodes] = useState<string[]>([]);

  const [stateVal, setStateVal] = useState(defaultState);
  const [districtVal, setDistrictVal] = useState(defaultDistrict);
  const [subdivisionVal, setSubdivisionVal] = useState('');
  const [blockVal, setBlockVal] = useState('');
  const [gpVal, setGpVal] = useState('');
  const [municipalityLgd, setMunicipalityLgd] = useState('273007');
  const [municipalityName, setMunicipalityName] = useState('Domkal Municipality');
  const [wardVal, setWardVal] = useState('');
  const [mouzaVal, setMouzaVal] = useState('');

  const [villageSel, setVillageSel] = useState('');
  const [villageCustom, setVillageCustom] = useState('');
  const [poSel, setPoSel] = useState('');
  const [poCustom, setPoCustom] = useState('');
  const [psSel, setPsSel] = useState('');
  const [psCustom, setPsCustom] = useState('');
  const [pinSel, setPinSel] = useState('');
  const [pinCustom, setPinCustom] = useState('');

  const [quickPin, setQuickPin] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const isMurshidabad = districtVal.trim().toLowerCase() === 'murshidabad';

  const resolvedVillage = villageSel === CUSTOM_SENTINEL ? villageCustom.trim() : villageSel;
  const resolvedPo = poSel === CUSTOM_SENTINEL ? poCustom.trim() : poSel;
  const resolvedPs = psSel === CUSTOM_SENTINEL ? psCustom.trim() : psSel;
  const resolvedPin = pinSel === CUSTOM_SENTINEL ? pinCustom.trim() : pinSel;

  const blockOrMunicipality =
    isMurshidabad && areaType === 'URBAN'
      ? municipalityName
      : blockVal || resolvedPs || districtVal;

  const gpOrWard = isMurshidabad ? (areaType === 'URBAN' ? wardVal : gpVal) : '';

  useEffect(() => {
    const parts: string[] = [];
    if (resolvedVillage) parts.push(`${areaType === 'URBAN' ? 'Locality' : 'Vill'}: ${resolvedVillage}`);
    if (areaType === 'URBAN' && wardVal) parts.push(wardVal);
    if (areaType === 'URBAN' && municipalityName) parts.push(municipalityName);
    if (areaType === 'RURAL' && gpVal) parts.push(`GP: ${gpVal}`);
    if (areaType === 'RURAL' && blockVal) parts.push(`Block: ${blockVal}`);
    if (resolvedPo) parts.push(`P.O.: ${resolvedPo}`);
    if (resolvedPs) parts.push(`P.S.: ${resolvedPs}`);
    if (districtVal) parts.push(`Dist: ${districtVal}`);
    if (stateVal) parts.push(stateVal);
    const formattedAddress = parts.join(', ') + (resolvedPin ? ` - ${resolvedPin}` : '');

    onChange({
      areaType,
      state: stateVal,
      district: districtVal,
      subdivision: subdivisionVal,
      blockOrMunicipality,
      gpOrWard,
      mouza: mouzaVal,
      village: resolvedVillage,
      postOffice: resolvedPo,
      policeStation: resolvedPs,
      pinCode: resolvedPin,
      formattedAddress
    });
  }, [
    areaType,
    stateVal,
    districtVal,
    subdivisionVal,
    blockOrMunicipality,
    gpOrWard,
    mouzaVal,
    resolvedVillage,
    resolvedPo,
    resolvedPs,
    resolvedPin
  ]);

  useEffect(() => {
    fetch('/api/locations/states')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.states)) setStates(d.states);
      })
      .catch(() => {});

    if (defaultState) {
      fetch(`/api/locations/districts?state=${encodeURIComponent(defaultState)}`)
        .then(r => r.json())
        .then(d => setDistricts(d.districts || []))
        .catch(() => {});
    }
  }, [defaultState]);

  const loadMurshidabadHierarchy = async (
    nextArea: 'RURAL' | 'URBAN',
    sub?: string,
    blk?: string,
    gp?: string,
    mLgd?: string,
    ward?: string
  ) => {
    try {
      const qs = new URLSearchParams({ areaType: nextArea });
      if (sub) qs.set('subdivision', sub);
      if (blk) qs.set('block', blk);
      if (gp) qs.set('gp', gp);
      if (mLgd) qs.set('municipalityLgd', mLgd);
      if (ward) qs.set('wardCode', ward);

      const res = await fetch(`/api/locations/murshidabad/hierarchy?${qs.toString()}`);
      const d = await res.json();
      if (!d.success) return;

      if (nextArea === 'RURAL') {
        setSubdivisions((d.subdivisions || []).map((x: any) => x.name));
        setBlocks((d.blocks || []).map((x: any) => x.name));
        setGramPanchayats((d.gramPanchayats || []).map((x: any) => x.name));
        if (Array.isArray(d.villages) && d.villages.length > 0) {
          const metaMap: Record<string, { pinCode: string; postOffice: string; policeStation: string; gpName: string }> = {};
          d.villages.forEach((v: any) => {
            if (v?.name) {
              metaMap[v.name] = {
                pinCode: v.pinCode || '',
                postOffice: v.postOffice || '',
                policeStation: v.policeStation || '',
                gpName: v.gpName || ''
              };
            }
          });
          setRuralVillageMeta(metaMap);
          setVillages(Array.from(new Set(d.villages.map((v: any) => v.name))));
          setPostOffices(Array.from(new Set(d.villages.map((v: any) => v.postOffice).filter(Boolean))));
          setPincodes(Array.from(new Set(d.villages.map((v: any) => v.pinCode).filter(Boolean))));
        }
      } else {
        // Strict URBAN: clear Gram Panchayat
        setGramPanchayats([]);
        setGpVal('');
        setMunicipalities(d.municipalities || []);
        setWards(d.wards || []);
        setMouzas((d.mouzas || []).map((m: any) => m.name));
        const locs = (d.localities || []).map((l: any) => ({
          label:
            l.originalSpelling && l.originalSpelling !== l.correctedEnglishName
              ? `${l.correctedEnglishName} (${l.originalSpelling})`
              : l.correctedEnglishName || l.originalSpelling,
          value: l.correctedEnglishName || l.originalSpelling,
          pinCode: l.pinCode,
          postOffice: l.postOffice
        }));
        setLocalities(locs);
        setVillages(locs.map((l: any) => l.value));
        const wardPins = (d.wards || []).flatMap((w: any) => w.pinCodes || []);
        const wardPos = (d.wards || []).flatMap((w: any) => w.postOffices || []);
        if (wardPins.length > 0) setPincodes(Array.from(new Set(wardPins)));
        if (wardPos.length > 0) setPostOffices(Array.from(new Set(wardPos)));
      }
    } catch {
      // non-blocking
    }
  };

  useEffect(() => {
    if (isMurshidabad) {
      loadMurshidabadHierarchy(areaType, subdivisionVal, blockVal, gpVal, municipalityLgd, wardVal);
    }
  }, [isMurshidabad, areaType, subdivisionVal, blockVal, gpVal, municipalityLgd, wardVal]);

  useEffect(() => {
    if (!stateVal || !districtVal) return;
    fetch(`/api/locations/post-offices?state=${encodeURIComponent(stateVal)}&district=${encodeURIComponent(districtVal)}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.postOffices) && d.postOffices.length > 0) {
          setPostOffices(prev => Array.from(new Set([...prev, ...d.postOffices])));
        }
      })
      .catch(() => {});
    fetch(`/api/locations/police-stations?state=${encodeURIComponent(stateVal)}&district=${encodeURIComponent(districtVal)}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.policeStations)) setPoliceStations(d.policeStations);
      })
      .catch(() => {});
    fetch(`/api/locations/pincodes?state=${encodeURIComponent(stateVal)}&district=${encodeURIComponent(districtVal)}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.pincodes)) setPincodes(prev => Array.from(new Set([...prev, ...d.pincodes])));
      })
      .catch(() => {});
  }, [stateVal, districtVal]);

  const handleStateChange = async (nextState: string) => {
    setStateVal(nextState);
    setDistrictVal('');
    setSubdivisionVal('');
    setBlockVal('');
    setGpVal('');
    setWardVal('');
    setVillageSel('');
    setPoSel('');
    setPsSel('');
    setPinSel('');
    if (!nextState) {
      setDistricts([]);
      return;
    }
    try {
      const res = await fetch(`/api/locations/districts?state=${encodeURIComponent(nextState)}`);
      const data = await res.json();
      setDistricts(data.districts || []);
    } catch {
      setDistricts([]);
    }
  };

  const handleDistrictChange = async (nextDistrict: string) => {
    setDistrictVal(nextDistrict);
    setSubdivisionVal('');
    setBlockVal('');
    setGpVal('');
    setWardVal('');
    setVillageSel('');
    setPoSel('');
    setPsSel('');
    setPinSel('');
    if (!nextDistrict) return;
    setStatusMsg(`Loading locations for ${nextDistrict}...`);
    try {
      const res = await fetch(
        `/api/locations/villages?state=${encodeURIComponent(stateVal)}&district=${encodeURIComponent(nextDistrict)}`
      );
      const data = await res.json();
      setVillages(data.villages || []);
      setStatusMsg('');
    } catch {
      setStatusMsg('');
    }
  };

  const handleQuickPinLookup = async () => {
    const clean = quickPin.replace(/[^0-9]/g, '').slice(0, 6);
    setQuickPin(clean);
    if (clean.length !== 6) {
      setStatusMsg('Enter a 6-digit Indian PIN code.');
      return;
    }
    setStatusMsg(`Searching India Post for PIN ${clean}...`);
    try {
      const res = await fetch(`/api/locations/pincode/${clean}`);
      const data = await res.json();
      if (!data.found) {
        setStatusMsg(`PIN ${clean} not found.`);
        return;
      }
      setStateVal(data.state);
      const distRes = await fetch(`/api/locations/districts?state=${encodeURIComponent(data.state)}`).then(r => r.json());
      setDistricts(distRes.districts || [data.district]);
      setDistrictVal(data.district);
      setPostOffices(data.postOffices || []);
      setPoSel(data.postOffices?.[0] || '');
      setPoliceStations(data.policeStations || []);
      setPsSel(data.policeStations?.[0] || '');
      setPincodes([clean]);
      setPinSel(clean);
      setStatusMsg(`Auto-filled: ${data.district}, ${data.state}`);
    } catch {
      setStatusMsg('Failed to lookup PIN.');
    }
  };

  return (
    <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-700/80 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          Location Cascade ({areaType === 'URBAN' ? 'Urban Municipality' : 'Rural Panchayat'})
        </span>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded bg-slate-950 p-0.5 border border-slate-700 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => {
                setAreaType('RURAL');
                setWardVal('');
                setVillageSel('');
              }}
              className={`px-2 py-0.5 rounded cursor-pointer ${areaType === 'RURAL' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
            >
              RURAL
            </button>
            <button
              type="button"
              onClick={() => {
                setAreaType('URBAN');
                setGpVal('');
                setBlockVal('');
                setVillageSel('');
              }}
              className={`px-2 py-0.5 rounded cursor-pointer ${areaType === 'URBAN' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
            >
              URBAN
            </button>
          </div>

          <div className="flex items-center gap-1">
            <input
              type="text"
              value={quickPin}
              onChange={(e) => setQuickPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="PIN Auto-Fill"
              maxLength={6}
              className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white font-mono"
            />
            <button
              type="button"
              onClick={handleQuickPinLookup}
              className="px-2 py-1 bg-blue-600/80 hover:bg-blue-600 text-white rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Search className="w-3 h-3" /> Lookup
            </button>
          </div>
        </div>
      </div>

      {statusMsg && <div className="text-[11px] text-blue-300">{statusMsg}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-slate-300">1. State {required && '*'}</label>
          <select
            value={stateVal}
            onChange={(e) => handleStateChange(e.target.value)}
            required={required}
            className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
          >
            <option value="">-- Select State --</option>
            {states.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-300">2. District {required && '*'}</label>
          <select
            value={districtVal}
            onChange={(e) => handleDistrictChange(e.target.value)}
            required={required}
            className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
          >
            <option value="">-- Select District --</option>
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Strict Rural vs Urban Hierarchy */}
      {isMurshidabad && areaType === 'RURAL' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="text-[11px] text-slate-300">Subdivision</label>
            <select
              value={subdivisionVal}
              onChange={(e) => {
                setSubdivisionVal(e.target.value);
                setBlockVal('');
                setGpVal('');
              }}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
            >
              <option value="">All Subdivisions</option>
              {subdivisions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-300">Block (CD Block) {required && '*'}</label>
            <select
              value={blockVal}
              onChange={(e) => {
                setBlockVal(e.target.value);
                setGpVal('');
              }}
              required={required}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
            >
              <option value="">-- Select Block --</option>
              {blocks.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-300">Gram Panchayat {required && '*'}</label>
            <select
              value={gpVal}
              onChange={(e) => setGpVal(e.target.value)}
              required={required && gramPanchayats.length > 0}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
            >
              <option value="">-- Select Gram Panchayat --</option>
              {gramPanchayats.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {isMurshidabad && areaType === 'URBAN' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="text-[11px] text-slate-300">Municipality {required && '*'}</label>
            <select
              value={municipalityLgd}
              onChange={(e) => {
                const lgd = e.target.value;
                setMunicipalityLgd(lgd);
                const found = municipalities.find(m => m.lgdCode === lgd);
                setMunicipalityName(found?.name || 'Domkal Municipality');
                setWardVal('');
              }}
              required={required}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
            >
              {municipalities.map(m => (
                <option key={m.lgdCode} value={m.lgdCode}>
                  {m.name} (LGD {m.lgdCode})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-300">Ward (01–21) {required && '*'}</label>
            <select
              value={wardVal}
              onChange={(e) => {
                const nextWard = e.target.value;
                setWardVal(nextWard);
                const wObj = wards.find(w => w.wardCode === nextWard);
                if (wObj?.pinCodes?.length) {
                  setPinSel(wObj.pinCodes[0]);
                }
              }}
              required={required}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
            >
              <option value="">-- Select Ward --</option>
              {wards.map(w => (
                <option key={w.wardCode} value={w.wardCode}>{w.wardName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-300">Mouza (Municipality)</label>
            <select
              value={mouzaVal}
              onChange={(e) => setMouzaVal(e.target.value)}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
            >
              <option value="">-- Optional Mouza --</option>
              {mouzas.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!isMurshidabad && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-slate-300">
              {areaType === 'URBAN' ? 'Municipality / Town' : 'Block / Taluka'} {required && '*'}
            </label>
            <input
              type="text"
              value={blockVal}
              onChange={(e) => setBlockVal(e.target.value)}
              placeholder={areaType === 'URBAN' ? 'Enter Municipality name' : 'Enter Block name'}
              required={required}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-300">
              {areaType === 'URBAN' ? 'Ward No / Zone' : 'Gram Panchayat'}
            </label>
            <input
              type="text"
              value={areaType === 'URBAN' ? wardVal : gpVal}
              onChange={(e) => (areaType === 'URBAN' ? setWardVal(e.target.value) : setGpVal(e.target.value))}
              placeholder={areaType === 'URBAN' ? 'e.g. WARD 03' : 'Enter GP name'}
              className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-slate-300">
            {areaType === 'URBAN' ? 'Locality / Para' : 'Village / Mouza'} {required && '*'}
          </label>
          <select
            value={villageSel}
            onChange={(e) => {
              const v = e.target.value;
              setVillageSel(v);
              const locMatch = localities.find(l => l.value === v);
              const ruralMatch = ruralVillageMeta[v];
              const resolvedMatchPin = locMatch?.pinCode || ruralMatch?.pinCode || '';
              const resolvedMatchPo = locMatch?.postOffice || ruralMatch?.postOffice || '';
              const resolvedMatchPs = ruralMatch?.policeStation || '';
              if (ruralMatch?.gpName && !gpVal) setGpVal(ruralMatch.gpName);
              if (resolvedMatchPo) {
                setPostOffices(prev => (prev.includes(resolvedMatchPo) ? prev : [resolvedMatchPo, ...prev]));
                setPoSel(resolvedMatchPo);
              }
              if (resolvedMatchPs) {
                setPoliceStations(prev => (prev.includes(resolvedMatchPs) ? prev : [resolvedMatchPs, ...prev]));
                setPsSel(resolvedMatchPs);
              }
              if (resolvedMatchPin) {
                setPincodes(prev => (prev.includes(resolvedMatchPin) ? prev : [resolvedMatchPin, ...prev]));
                setPinSel(resolvedMatchPin);
              }
            }}
            required={required && villageSel !== CUSTOM_SENTINEL}
            className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
          >
            <option value="">-- Select {areaType === 'URBAN' ? 'Locality' : 'Village'} --</option>
            {areaType === 'URBAN' && localities.length > 0
              ? localities.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))
              : villages.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
            <option value={CUSTOM_SENTINEL}>+ Other / Custom</option>
          </select>
          {villageSel === CUSTOM_SENTINEL && (
            <input
              type="text"
              value={villageCustom}
              onChange={(e) => setVillageCustom(e.target.value)}
              placeholder={`Enter ${areaType === 'URBAN' ? 'Locality' : 'Village'} name`}
              required={required}
              className="w-full mt-1 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-white text-xs"
            />
          )}
        </div>

        <div>
          <label className="text-[11px] text-slate-300">Post Office (P.O.) {required && '*'}</label>
          <select
            value={poSel}
            onChange={(e) => setPoSel(e.target.value)}
            required={required && poSel !== CUSTOM_SENTINEL}
            className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
          >
            <option value="">-- Select Post Office --</option>
            {postOffices.map(po => (
              <option key={po} value={po}>{po}</option>
            ))}
            <option value={CUSTOM_SENTINEL}>+ Other / Custom P.O.</option>
          </select>
          {poSel === CUSTOM_SENTINEL && (
            <input
              type="text"
              value={poCustom}
              onChange={(e) => setPoCustom(e.target.value)}
              placeholder="Enter Post Office name"
              required={required}
              className="w-full mt-1 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-white text-xs"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-slate-300">Police Station (P.S.)</label>
          <select
            value={psSel}
            onChange={(e) => setPsSel(e.target.value)}
            className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
          >
            <option value="">-- Select Police Station --</option>
            {policeStations.map(ps => (
              <option key={ps} value={ps}>{ps}</option>
            ))}
            <option value={CUSTOM_SENTINEL}>+ Other / Custom P.S.</option>
          </select>
          {psSel === CUSTOM_SENTINEL && (
            <input
              type="text"
              value={psCustom}
              onChange={(e) => setPsCustom(e.target.value)}
              placeholder="Enter Police Station"
              className="w-full mt-1 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-white text-xs"
            />
          )}
        </div>

        <div>
          <label className="text-[11px] text-slate-300">PIN Code {required && '*'}</label>
          <select
            value={pinSel}
            onChange={(e) => setPinSel(e.target.value)}
            required={required && pinSel !== CUSTOM_SENTINEL}
            className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs font-mono"
          >
            <option value="">-- Select PIN Code --</option>
            {pincodes.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
            <option value={CUSTOM_SENTINEL}>+ Enter Custom PIN</option>
          </select>
          {pinSel === CUSTOM_SENTINEL && (
            <input
              type="text"
              value={pinCustom}
              onChange={(e) => setPinCustom(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="6-digit PIN"
              maxLength={6}
              required={required}
              className="w-full mt-1 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-white text-xs font-mono"
            />
          )}
        </div>
      </div>
    </div>
  );
};
