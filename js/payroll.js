/**
 * payroll.js - Staff Attendance, Time Management Register, GPS + Photo Attendance & Reports
 * MUN COMPUTER - Centralized Business ERP
 */

import { getItem, setItem, KEYS, allocateGlobalReference, markGlobalReferenceDeleted, getTodayDate, logAuditAction, getAuthHeaders } from './storage.js';

export const DEFAULT_SHIFT_CONFIG = {
  morningInTime: '09:00',
  eveningOutTime: '19:00',
  graceMinutes: 15,
  standardHours: 10
};

export function getShiftConfig() {
  const cfg = getItem(KEYS.SHIFT_CONFIG, null);
  return { ...DEFAULT_SHIFT_CONFIG, ...(cfg || {}) };
}

export function saveShiftConfig(cfg = {}) {
  const next = {
    morningInTime: String(cfg.morningInTime || DEFAULT_SHIFT_CONFIG.morningInTime),
    eveningOutTime: String(cfg.eveningOutTime || DEFAULT_SHIFT_CONFIG.eveningOutTime),
    graceMinutes: Math.max(0, Number(cfg.graceMinutes ?? DEFAULT_SHIFT_CONFIG.graceMinutes) || 0),
    standardHours: Math.max(1, Number(cfg.standardHours ?? DEFAULT_SHIFT_CONFIG.standardHours) || 10)
  };
  setItem(KEYS.SHIFT_CONFIG, next);
  logAuditAction('SHIFT_CONFIG_UPDATE', `Updated shift timings: In ${next.morningInTime}, Out ${next.eveningOutTime}, Grace ${next.graceMinutes}m`);
  return { success: true, config: next };
}

/**
 * Convert time string ("09:15", "09:15 AM", "07:30 PM") to minutes from midnight
 */
export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const s = String(timeStr).trim().toUpperCase();
  const ampmMatch = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3];
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const h24Match = s.match(/^(\d{1,2}):(\d{2})/);
  if (h24Match) {
    const h = parseInt(h24Match[1], 10);
    const m = parseInt(h24Match[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 60 + m;
  }
  return null;
}

export function to24HourTime(timeStr, fallback = '09:00') {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return fallback;
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatMinutesAsDuration(totalMins) {
  const m = Math.max(0, Math.round(Number(totalMins) || 0));
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return `${hrs}h ${String(rem).padStart(2, '0')}m`;
}

export function formatTime12Hour(timeStr) {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return timeStr || '-';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Compute working minutes, late entry, early leave, and overtime against shift configuration
 */
export function calculateTimeMetrics(inTime, outTime, status = 'Present', shiftCfg = getShiftConfig()) {
  if (status === 'Absent' || status === 'Leave') {
    return {
      inTime24: '',
      outTime24: '',
      workingMinutes: 0,
      workingHoursLabel: '0h 00m',
      lateMinutes: 0,
      lateLabel: '-',
      earlyLeaveMinutes: 0,
      earlyLeaveLabel: '-',
      overtimeMinutes: 0,
      overtimeLabel: '0h 00m'
    };
  }

  const inMins = parseTimeToMinutes(inTime);
  const outMins = parseTimeToMinutes(outTime);
  const shiftStartMins = parseTimeToMinutes(shiftCfg.morningInTime) ?? (9 * 60);
  const shiftEndMins = parseTimeToMinutes(shiftCfg.eveningOutTime) ?? (19 * 60);
  const grace = Number(shiftCfg.graceMinutes) || 0;
  const standardMins = Math.max(60, (Number(shiftCfg.standardHours) || 10) * 60);

  const lateMinutes = inMins !== null && inMins > (shiftStartMins + grace) ? (inMins - shiftStartMins) : 0;
  const earlyLeaveMinutes = outMins !== null && outMins < shiftEndMins ? (shiftEndMins - outMins) : 0;

  let workingMinutes = 0;
  if (inMins !== null && outMins !== null && outMins > inMins) {
    workingMinutes = outMins - inMins;
  }

  const overtimeMinutes = workingMinutes > standardMins ? (workingMinutes - standardMins) : 0;

  return {
    inTime24: inMins !== null ? to24HourTime(inTime) : '',
    outTime24: outMins !== null ? to24HourTime(outTime) : '',
    workingMinutes,
    workingHoursLabel: formatMinutesAsDuration(workingMinutes),
    lateMinutes,
    lateLabel: lateMinutes > 0 ? `Late (+${lateMinutes}m)` : (inMins !== null ? 'On Time' : '-'),
    earlyLeaveMinutes,
    earlyLeaveLabel: earlyLeaveMinutes > 0 ? `Early (-${earlyLeaveMinutes}m)` : (outMins !== null ? 'Full Shift' : '-'),
    overtimeMinutes,
    overtimeLabel: overtimeMinutes > 0 ? formatMinutesAsDuration(overtimeMinutes) : '0h 00m'
  };
}

export function getAllAttendance() {
  return getItem(KEYS.PAYROLL, []);
}

export function deleteAttendanceRecord(id) {
  const records = getAllAttendance().filter(r => r.id !== id);
  setItem(KEYS.PAYROLL, records);
  markGlobalReferenceDeleted(id, 'DELETED');
  logAuditAction('ATTENDANCE_DELETE', `Deleted attendance entry ${id}`);
  return { success: true };
}

export async function recordAttendance(attData) {
  const records = getAllAttendance();
  const users = getItem(KEYS.USERS, []);
  const staff = users.find(u => (u.uid || u.id) === attData.staffId) || users[0];
  const date = attData.date || getTodayDate();
  const staffId = attData.staffId || (staff ? (staff.uid || staff.id) : 'UNASSIGNED');
  const staffName = attData.staffName || (staff ? staff.name : 'Staff Member');
  const status = attData.status || 'Present';

  const shiftCfg = getShiftConfig();
  const rawIn = status === 'Absent' || status === 'Leave' ? '' : (attData.inTime24 || attData.clockIn || shiftCfg.morningInTime);
  const rawOut = status === 'Absent' || status === 'Leave' ? '' : (attData.outTime24 || attData.clockOut || '');

  const metrics = calculateTimeMetrics(rawIn, rawOut, status, shiftCfg);

  const existingIdx = records.findIndex(r => (attData.id && r.id === attData.id) || (r.date === date && r.staffId === staffId));
  const prev = existingIdx !== -1 ? records[existingIdx] : {};

  const baseDailySalary = attData.baseDailySalary !== undefined
    ? Number(attData.baseDailySalary)
    : (status === 'Absent' ? 0 : status === 'Half Day' ? 200 : 350);
  const commissionEarned = Number(attData.commissionEarned ?? prev.commissionEarned) || 0;

  const attId = attData.id || prev.id || await allocateGlobalReference('ATT', { entityType: 'ATTENDANCE' });
  const entry = {
    ...prev,
    id: attId,
    date,
    staffId,
    staffName,
    role: attData.role || prev.role || (staff ? staff.designation || staff.role : 'Counter Staff'),
    status,
    inTime24: metrics.inTime24,
    outTime24: metrics.outTime24,
    clockIn: metrics.inTime24 ? formatTime12Hour(metrics.inTime24) : '-',
    clockOut: metrics.outTime24 ? formatTime12Hour(metrics.outTime24) : '-',
    workingMinutes: metrics.workingMinutes,
    workingHoursLabel: metrics.workingHoursLabel,
    lateMinutes: metrics.lateMinutes,
    lateEntry: metrics.lateMinutes > 0,
    lateLabel: metrics.lateLabel,
    earlyLeaveMinutes: metrics.earlyLeaveMinutes,
    earlyLeave: metrics.earlyLeaveMinutes > 0,
    earlyLeaveLabel: metrics.earlyLeaveLabel,
    overtimeMinutes: metrics.overtimeMinutes,
    overtimeLabel: metrics.overtimeLabel,
    inGpsLat: attData.inGpsLat ?? prev.inGpsLat ?? null,
    inGpsLng: attData.inGpsLng ?? prev.inGpsLng ?? null,
    outGpsLat: attData.outGpsLat ?? prev.outGpsLat ?? null,
    outGpsLng: attData.outGpsLng ?? prev.outGpsLng ?? null,
    servicesHandled: Number(attData.servicesHandled ?? prev.servicesHandled) || 0,
    commissionEarned,
    baseDailySalary,
    totalDailyPay: baseDailySalary + commissionEarned,
    notes: attData.notes ?? prev.notes ?? '',
    businessUnitId: 'mun-computer',
    updatedAt: new Date().toISOString()
  };

  if (existingIdx !== -1) {
    records[existingIdx] = entry;
  } else {
    records.unshift(entry);
  }

  setItem(KEYS.PAYROLL, records);
  logAuditAction('ATTENDANCE_LOG', `Recorded attendance for ${entry.staffName} on ${date}: ${entry.status} (${entry.workingHoursLabel})`);
  return { success: true, entry };
}

/* --- GPS + Photo Location Attendance Logs --- */
export function getAllGpsAttendanceLogs() {
  return getItem(KEYS.GPS_ATTENDANCE, []);
}

export function deleteGpsAttendanceLog(id) {
  const logs = getAllGpsAttendanceLogs().filter(l => l.id !== id);
  setItem(KEYS.GPS_ATTENDANCE, logs);
  markGlobalReferenceDeleted(id, 'DELETED');
  logAuditAction('GPS_ATTENDANCE_DELETE', `Deleted GPS attendance punch ${id}`);
  return { success: true };
}

export async function saveGpsAttendancePunch(punchData) {
  if (!punchData.consentAccepted) {
    return { success: false, message: 'Employee consent for GPS & Live Camera capture is required.' };
  }
  if (punchData.captureMethod !== 'LIVE_CAMERA') {
    return { success: false, message: 'Manual/gallery upload is disabled. Live Camera capture is mandatory.' };
  }
  const lat = Number(punchData.latitude);
  const lng = Number(punchData.longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (lat === 0 && lng === 0)
  ) {
    return { success: false, message: 'Valid live GPS Latitude & Longitude required.' };
  }
  if (!String(punchData.photoDataUrl || '').startsWith('data:image/')) {
    return { success: false, message: 'Valid live camera photo is required.' };
  }

  const users = getItem(KEYS.USERS, []);
  const staff = users.find(u => (u.uid || u.id) === punchData.staffId) || users[0];
  const staffId = punchData.staffId || (staff ? (staff.uid || staff.id) : 'UNASSIGNED');
  const staffName = punchData.staffName || (staff ? staff.name : 'Staff Member');
  const now = new Date();
  const date = punchData.date || now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const time24 = punchData.time24 || now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
  const istTimestamp = punchData.istTimestamp || now.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const eventType = punchData.eventType === 'OUT' ? 'OUT' : 'IN';
  const logs = getAllGpsAttendanceLogs();
  const gpsId = punchData.id || await allocateGlobalReference('ATT', { entityType: 'GPS_ATTENDANCE' });
  const entry = {
    id: gpsId,
    staffId,
    staffName,
    role: staff?.designation || staff?.role || 'Staff',
    eventType,
    date,
    time24,
    time12: punchData.time12 || formatTime12Hour(time24),
    timestampIso: now.toISOString(),
    istTimestamp,
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    accuracy: Number(punchData.accuracy) || 0,
    mapsUrl: `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`,
    photoDataUrl: punchData.photoDataUrl || '',
    captureMethod: 'LIVE_CAMERA',
    gpsVerifiedLive: Boolean(punchData.gpsVerifiedLive !== false),
    gpsMatchDistanceMeters: Number(punchData.gpsMatchDistanceMeters) || 0,
    consentAccepted: true,
    notes: String(punchData.notes || '').trim(),
    createdAt: now.toISOString()
  };

  logs.unshift(entry);
  // Keep latest 350 photo-enabled punches to prevent localStorage bloat
  if (logs.length > 350) logs.length = 350;
  setItem(KEYS.GPS_ATTENDANCE, logs);

  // Sync automatically with daily Staff Attendance & Time Register
  const existingAtt = getAllAttendance().find(r => r.date === date && r.staffId === staffId);
  const attPayload = {
    staffId,
    staffName,
    date,
    status: existingAtt?.status && existingAtt.status !== 'Absent' && existingAtt.status !== 'Leave' ? existingAtt.status : 'Present',
    inTime24: eventType === 'IN' ? time24 : (existingAtt?.inTime24 || to24HourTime(existingAtt?.clockIn, time24)),
    outTime24: eventType === 'OUT' ? time24 : (existingAtt?.outTime24 || to24HourTime(existingAtt?.clockOut, '')),
    inGpsLat: eventType === 'IN' ? entry.latitude : existingAtt?.inGpsLat,
    inGpsLng: eventType === 'IN' ? entry.longitude : existingAtt?.inGpsLng,
    outGpsLat: eventType === 'OUT' ? entry.latitude : existingAtt?.outGpsLat,
    outGpsLng: eventType === 'OUT' ? entry.longitude : existingAtt?.outGpsLng,
    notes: existingAtt?.notes || entry.notes || `GPS ${eventType} verified`
  };
  await recordAttendance(attPayload);

  logAuditAction('GPS_ATTENDANCE_PUNCH', `${staffName} punched ${eventType} at ${entry.latitude},${entry.longitude} (${istTimestamp})`);
  return { success: true, entry };
}

export function getMonthlyAttendanceReport(monthStr = getTodayDate().slice(0, 7), staffFilter = 'all') {
  const records = getAllAttendance().filter(r => {
    const matchMonth = !monthStr || (r.date && r.date.startsWith(monthStr));
    const matchStaff = staffFilter === 'all' || r.staffId === staffFilter;
    return matchMonth && matchStaff;
  });
  const gpsLogs = getAllGpsAttendanceLogs().filter(g => {
    const matchMonth = !monthStr || (g.date && g.date.startsWith(monthStr));
    const matchStaff = staffFilter === 'all' || g.staffId === staffFilter;
    return matchMonth && matchStaff;
  });

  const users = getItem(KEYS.USERS, []).filter(u => u.status === 'ACTIVE' || u.active);
  const map = {};

  if (staffFilter === 'all') {
    users.forEach(u => {
      const uid = u.uid || u.id;
      map[uid] = {
        staffId: uid,
        staffName: u.name,
        role: u.designation || u.role || 'Staff',
        presentDays: 0,
        halfDays: 0,
        absentDays: 0,
        leaveDays: 0,
        lateDays: 0,
        earlyLeaveDays: 0,
        totalWorkingMinutes: 0,
        totalOvertimeMinutes: 0,
        gpsPunches: 0,
        totalPay: 0
      };
    });
  }

  records.forEach(r => {
    if (!map[r.staffId]) {
      map[r.staffId] = {
        staffId: r.staffId,
        staffName: r.staffName,
        role: r.role || 'Staff',
        presentDays: 0,
        halfDays: 0,
        absentDays: 0,
        leaveDays: 0,
        lateDays: 0,
        earlyLeaveDays: 0,
        totalWorkingMinutes: 0,
        totalOvertimeMinutes: 0,
        gpsPunches: 0,
        totalPay: 0
      };
    }
    const row = map[r.staffId];
    if (r.status === 'Present') row.presentDays++;
    else if (r.status === 'Half Day') row.halfDays++;
    else if (r.status === 'Absent') row.absentDays++;
    else if (r.status === 'Leave') row.leaveDays++;

    if (r.lateMinutes > 0 || r.lateEntry) row.lateDays++;
    if (r.earlyLeaveMinutes > 0 || r.earlyLeave) row.earlyLeaveDays++;
    row.totalWorkingMinutes += Number(r.workingMinutes) || 0;
    row.totalOvertimeMinutes += Number(r.overtimeMinutes) || 0;
    row.totalPay += Number(r.totalDailyPay) || 0;
  });

  gpsLogs.forEach(g => {
    if (map[g.staffId]) map[g.staffId].gpsPunches++;
  });

  const staffRows = Object.values(map).map(row => {
    const loggedDays = row.presentDays + row.halfDays + row.absentDays + row.leaveDays;
    const onTimeDays = Math.max(0, (row.presentDays + row.halfDays) - row.lateDays);
    const activeWorkDays = row.presentDays + row.halfDays;
    const onTimePct = activeWorkDays > 0 ? Math.round((onTimeDays / activeWorkDays) * 100) : 100;
    return {
      ...row,
      loggedDays,
      onTimePct,
      totalWorkingLabel: formatMinutesAsDuration(row.totalWorkingMinutes),
      totalOvertimeLabel: formatMinutesAsDuration(row.totalOvertimeMinutes)
    };
  });

  return { month: monthStr, records, gpsLogs, staffRows };
}

export function getPayrollSummary() {
  const records = getAllAttendance();
  const staffSummary = {};

  records.forEach(r => {
    if (!staffSummary[r.staffId]) {
      staffSummary[r.staffId] = {
        staffId: r.staffId,
        staffName: r.staffName,
        role: r.role,
        daysPresent: 0,
        daysHalfDay: 0,
        daysLeave: 0,
        daysAbsent: 0,
        totalServicesHandled: 0,
        totalCommission: 0,
        totalBaseSalary: 0,
        grandTotalPayout: 0
      };
    }

    const s = staffSummary[r.staffId];
    if (r.status === 'Present') s.daysPresent++;
    else if (r.status === 'Half Day') s.daysHalfDay++;
    else if (r.status === 'Leave') s.daysLeave++;
    else if (r.status === 'Absent') s.daysAbsent++;

    s.totalServicesHandled += Number(r.servicesHandled) || 0;
    s.totalCommission += Number(r.commissionEarned) || 0;
    s.totalBaseSalary += Number(r.baseDailySalary) || 0;
    s.grandTotalPayout += Number(r.totalDailyPay) || 0;
  });

  return Object.values(staffSummary);
}

/* --- Server Sync Helpers for Attendance Records & Mandatory Photo Gallery --- */

export function getAttendancePhotoImageUrl(photo, download = false) {
  if (!photo) return '';
  if (photo.hasPhotoFile && photo.id) {
    const token = localStorage.getItem('MUN_COMPUTER_SESSION_TOKEN') || '';
    const dl = download ? '&download=1' : '';
    return `/api/attendance/photos/${encodeURIComponent(photo.id)}/image?token=${encodeURIComponent(token)}${dl}`;
  }
  return photo.photoDataUrl || '';
}

export async function syncAttendanceRecordsFromServer() {
  try {
    const resp = await fetch('/api/attendance/records', { headers: getAuthHeaders() });
    if (!resp.ok) return getAllAttendance();
    const data = await resp.json();
    if (data.success && Array.isArray(data.records)) {
      if (data.records.length > 0) {
        const local = getAllAttendance();
        const map = new Map();
        data.records.forEach(r => map.set(r.id, r));
        local.forEach(r => { if (!map.has(r.id)) map.set(r.id, r); });
        const merged = Array.from(map.values());
        setItem(KEYS.PAYROLL, merged);
        return merged;
      }
      return data.records;
    }
  } catch {
    // offline fallback
  }
  return getAllAttendance();
}

export async function syncAttendanceRecordToServer(entry) {
  try {
    const resp = await fetch('/api/attendance/records', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(entry)
    });
    const data = await resp.json();
    if (resp.ok && data.success) return { success: true, record: data.record };
    return { success: false, message: data.message || 'Server denied attendance record.' };
  } catch {
    return { success: true, offline: true, record: entry };
  }
}

export async function fetchAttendancePhotosFromServer() {
  try {
    const resp = await fetch('/api/attendance/photos', { headers: getAuthHeaders() });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (data.success && Array.isArray(data.photos)) {
      window._munServerAttendancePhotos = data.photos;
      return data.photos;
    }
  } catch {
    // ignore
  }
  return window._munServerAttendancePhotos || [];
}

export async function saveAttendancePhotoToServer(punchData) {
  try {
    const resp = await fetch('/api/attendance/photos', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(punchData)
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      return { success: true, photo: data.photo };
    }
    return { success: false, message: data.message || 'Server failed to save attendance photo.' };
  } catch {
    return { success: false, message: 'Server unreachable while saving attendance photo.' };
  }
}

export async function verifyAttendancePhotoOnServer(photoId, status = 'VERIFIED', notes = '') {
  try {
    const resp = await fetch(`/api/attendance/photos/${encodeURIComponent(photoId)}/verify`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, notes })
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      return { success: true, photo: data.photo };
    }
    return { success: false, message: data.message || 'Verification failed.' };
  } catch {
    return { success: false, message: 'Server error verifying attendance photo.' };
  }
}

export async function deleteAttendancePhotoOnServer(photoId, reason) {
  try {
    const resp = await fetch(`/api/attendance/photos/${encodeURIComponent(photoId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      return { success: true, message: data.message };
    }
    return { success: false, message: data.message || 'Photo delete denied.' };
  } catch {
    return { success: false, message: 'Server error deleting attendance photo.' };
  }
}
