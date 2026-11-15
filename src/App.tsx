import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  KeyRound,
  RefreshCw,
  X,
  ShieldCheck,
  Crown,
  Briefcase,
  UserCheck,
  Lock,
  Check,
  Shield,
  User,
  ChevronDown,
  Printer,
  Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { OfflineIndicator, PWAInstallModalHost } from './components/PWAInstallButton';
import { SessionTimeoutNotice } from './components/SessionTimeoutNotice';
import '../js/app.js';
import {
  installAuthFetchInterceptor,
  getOrCreateDeviceIdentity,
  commitAuthTokens,
  commitAuthenticatedUserCache,
  clearLocalAuthStorageOnly,
  broadcastLocalLogout,
  getSharedLastActivityAt,
  touchSharedActivity,
  resetSharedActivity,
  isTerminalAuthErrorCode
} from '../js/authCoordinator.js';

declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : '1.0.0';

if (typeof window !== 'undefined') {
  installAuthFetchInterceptor();
}

declare global {
  interface Window {
    MJK?: {
      render?: (preserveRoute?: boolean, explicitMount?: HTMLElement | null) => void;
      navigateTo?: (route: string) => void;
      closeModal?: () => void;
      [key: string]: any;
    };
    _munUserStats?: Record<string, number>;
    _munRecentLogins?: any[];
  }
}

type RequestedRole = 'STAFF' | 'MANAGER' | 'ADMIN';
type LoginPanel = 'ADMIN' | 'MANAGER' | 'STAFF';

interface AuthUser {
  requestId?: string;
  uid: string;
  userId?: string;
  username?: string;
  name: string;
  fullName?: string;
  role: RequestedRole;
  isMainAdmin?: boolean;
  isSuperAdmin?: boolean;
  mfaEnabled?: boolean;
  designation: string;
  phone?: string;
  phoneMasked?: string;
  email?: string;
  address?: string;
  mustChangePassword?: boolean;
  approvalStatus?: string;
  status: string;
  isLoggedOut?: boolean;
  dailyPasswordChangesUsed?: number;
  dailyPasswordChangesRemaining?: number;
  dailyPasswordChangeLimit?: number;
}

const ERP_USER_KEY = 'MUN_COMPUTER_ERP_v1_current_user';
const ERP_SESSION_KEY = 'MUN_COMPUTER_SESSION_TOKEN';
const ERP_CSRF_KEY = 'MUN_COMPUTER_CSRF_TOKEN';
const ERP_USERS_KEY = 'MUN_COMPUTER_ERP_v1_users';
const ERP_AUDIT_KEY = 'MUN_COMPUTER_ERP_v1_audit_logs';
const ERP_MENU_CONFIG_KEY = 'MUN_COMPUTER_ERP_v1_menu_config';
const REMEMBER_UID_KEY = 'mun_remembered_uid';
const DEFAULT_ADMIN_UID = 'MC-ADM-14012025';
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const INACTIVITY_WARNING_MS = 2 * 60 * 1000; // Show countdown notice in final 2 minutes

function getPasswordChecks(pwd: string) {
  return {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    digit: /[0-9]/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd)
  };
}

function isStrongPasswordClient(pwd: string): boolean {
  const c = getPasswordChecks(pwd);
  return c.length && c.upper && c.lower && c.digit && c.special;
}

function getInitialUid(): string {
  try {
    const remembered = localStorage.getItem(REMEMBER_UID_KEY);
    if (
      !remembered ||
      remembered === 'MC2600000' ||
      remembered === 'MUNCM-2026' ||
      remembered === 'MUNCOMPUTER-2019'
    ) {
      if (remembered) {
        localStorage.setItem(REMEMBER_UID_KEY, DEFAULT_ADMIN_UID);
      }
      return DEFAULT_ADMIN_UID;
    }
    return remembered;
  } catch {
    return DEFAULT_ADMIN_UID;
  }
}

function readStoredUser(): AuthUser | null {
  try {
    const raw =
      localStorage.getItem(ERP_USER_KEY) ||
      localStorage.getItem('mun_computer_v3_user') ||
      localStorage.getItem('mun_current_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.isLoggedOut || !parsed.uid) return null;
    if (parsed.status && parsed.status !== 'ACTIVE') return null;
    if (parsed.uid === 'MC2600000' || parsed.uid === 'MUNCOMPUTER-2019' || parsed.uid === 'MUNCM-2026') {
      parsed.uid = DEFAULT_ADMIN_UID;
      parsed.userId = DEFAULT_ADMIN_UID;
      parsed.isMainAdmin = true;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getAuthRequestHeaders(user: AuthUser | null): Record<string, string> {
  const token = localStorage.getItem(ERP_SESSION_KEY) || '';
  const csrf = localStorage.getItem(ERP_CSRF_KEY) || '';
  const { deviceId, deviceName } = getOrCreateDeviceIdentity();
  const headers: Record<string, string> = {};
  if (token) headers['x-session-token'] = token;
  if (csrf) headers['x-csrf-token'] = csrf;
  if (deviceId) headers['x-device-id'] = deviceId;
  if (deviceName) headers['x-device-name'] = deviceName;
  if (user?.uid) headers['x-actor-uid'] = user.uid;
  return headers;
}

async function loadLogoPngDataUrl(): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Logo load failed'));
      img.src = '/assets/aistudio/MUN_Computer_Tech_Logo_35ee99e8.png';
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 320;
    canvas.height = img.naturalHeight || 160;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function MunComputerLogo() {
  return (
    <div className="flex flex-col items-center justify-center select-none w-full">
      <div className="mun-logo-3d-badge w-full rounded-[22px] px-6 py-4 sm:py-5 flex items-center justify-center">
        <img
          src="/assets/aistudio/MUN_Computer_Tech_Logo_35ee99e8.png"
          alt="MUN COMPUTER"
          className="h-[74px] sm:h-[86px] w-auto max-w-full object-contain mx-auto block relative z-10 drop-shadow-[0_2px_6px_rgba(13,42,108,0.12)]"
        />
      </div>
    </div>
  );
}

function LoginWaveBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden select-none" aria-hidden="true">
      {/* Subtle Studio Horizon Ambient Wash */}
      <div
        className="absolute inset-x-0 bottom-0 h-[44vh]"
        style={{
          background:
            'radial-gradient(ellipse 75% 85% at 50% 100%, rgba(255, 255, 255, 0.14) 0%, rgba(13, 42, 108, 0.18) 45%, transparent 80%)'
        }}
      />

      {/* 3D Floating Navy Orb (Top Left) */}
      <div className="mun-3d-orb-navy absolute -top-20 -left-16 sm:top-8 sm:left-[7%] w-52 h-52 sm:w-72 sm:h-72 rounded-full opacity-80" />

      {/* 3D Floating Crimson Red Orb (Bottom Right) */}
      <div className="mun-3d-orb-red absolute -bottom-20 -right-14 sm:bottom-10 sm:right-[8%] w-48 h-48 sm:w-64 sm:h-64 rounded-full opacity-75" />

      {/* 3D Floating Accent Orb (Center-Right Top) */}
      <div className="mun-3d-orb-navy absolute top-[14%] right-[12%] hidden md:block w-24 h-24 rounded-full opacity-70" />

      {/* 3D Floating Crimson Accent Orb (Bottom Left) */}
      <div className="mun-3d-orb-red absolute bottom-[18%] left-[12%] hidden md:block w-20 h-20 rounded-full opacity-65" />

      {/* 3D Perspective Orbiting Geometric Rings */}
      <div className="mun-3d-ring-navy absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] sm:w-[760px] sm:h-[760px] rounded-full opacity-55" />
      <div className="mun-3d-ring-red absolute top-[20%] left-[16%] hidden lg:block w-44 h-44 rounded-full opacity-55" />
    </div>
  );
}

function PasswordInstructionsCard({ pwd }: { pwd: string }) {
  const checks = getPasswordChecks(pwd);
  const items = [
    { ok: checks.length, label: 'Minimum 8 Characters' },
    { ok: checks.upper, label: '1 Capital Letter (A–Z)' },
    { ok: checks.lower, label: '1 Small Letter (a–z)' },
    { ok: checks.digit, label: '1 Number (0–9)' },
    { ok: checks.special, label: '1 Special Symbol (@#$%&*!)' }
  ];

  return (
    <div className="p-3.5 rounded-xl bg-[#EAF1FF]/70 border border-[#2456C7]/25 space-y-2.5 shadow-xs">
      <div className="flex items-start gap-2">
        <Shield className="w-4 h-4 text-[#2456C7] shrink-0 mt-0.5" />
        <div>
          <div className="text-[11px] font-bold tracking-wide text-[#0B1530] uppercase">
            Password Instructions (Required for All Users)
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
            Minimum 8 characters (12+ recommended) with Capital letter, Small letter, Number, and Special Symbol. Cannot match your last 5 passwords or personal info (User ID, Name, Mobile, Aadhaar, DOB). Administrator enjoys unlimited resets.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-[#2456C7]/15 text-[11px]">
        {items.map((item, idx) => (
          <div
            key={item.label}
            className={`flex items-center gap-1.5 ${idx === items.length - 1 ? 'col-span-2' : ''} ${
              item.ok ? 'text-emerald-700 font-semibold' : 'text-slate-600'
            }`}
          >
            {item.ok ? <Check className="w-3.5 h-3.5 shrink-0 text-[#10B981]" /> : <span className="w-3.5 text-center">○</span>}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const currentYearStr = todayDateStr.slice(0, 4) || '2026';
  const managerUidPrefix = `MC-MGR-${currentYearStr}-000000`;
  const staffUidPrefix = `MC-STF-${currentYearStr}-000000`;
  const getPrefilledUidForPanel = useCallback(
    (panel: LoginPanel) => {
      if (panel === 'ADMIN') return DEFAULT_ADMIN_UID;
      if (panel === 'MANAGER') return managerUidPrefix;
      return staffUidPrefix;
    },
    [managerUidPrefix, staffUidPrefix]
  );

  // Authentication State (3 Main Login Panels)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => readStoredUser());
  const [activePanel, setActivePanel] = useState<LoginPanel>('ADMIN');
  const [uid, setUid] = useState<string>(() => getInitialUid());
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState<boolean>(false);
  const roleMenuRef = useRef<HTMLDivElement | null>(null);
  const loginCardRef = useRef<HTMLDivElement | null>(null);
  const [loginCaptchaSvg, setLoginCaptchaSvg] = useState<string>('');
  const [loginCaptchaToken, setLoginCaptchaToken] = useState<string>('');
  const [loginCaptchaInput, setLoginCaptchaInput] = useState<string>('');
  const [captchaLoading, setCaptchaLoading] = useState<boolean>(false);
  const [captchaError, setCaptchaError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginAlert, setLoginAlert] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);

  // TOTP MFA Challenge State (when MC-ADM-14012025 MFA is enabled)
  const [mfaChallenge, setMfaChallenge] = useState<{ uid: string; pendingToken: string } | null>(null);
  const [mfaTotpInput, setMfaTotpInput] = useState<string>('');

  // Mandatory Password Change
  const [isMandatoryModalOpen, setIsMandatoryModalOpen] = useState<boolean>(() => Boolean(readStoredUser()?.mustChangePassword));
  const [changeCurrentPwd, setChangeCurrentPwd] = useState<string>('');
  const [changeNewPwd, setChangeNewPwd] = useState<string>('');
  const [changeConfirmPwd, setChangeConfirmPwd] = useState<string>('');
  const [showChangeCurrentPwd, setShowChangeCurrentPwd] = useState<boolean>(false);
  const [showChangeNewPwd, setShowChangeNewPwd] = useState<boolean>(false);
  const [showChangeConfirmPwd, setShowChangeConfirmPwd] = useState<boolean>(false);
  const [changeAlert, setChangeAlert] = useState<string | null>(null);
  const [isChangingPwd, setIsChangingPwd] = useState<boolean>(false);

  // Forgot Password & Official Receipt State (Sections 7, 8, 9, 10)
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);
  const [forgotStage, setForgotStage] = useState<'VERIFY' | 'OTP' | 'RESET' | 'SUCCESS'>('VERIFY');
  const [forgotUid, setForgotUid] = useState<string>('');
  const [forgotFullName, setForgotFullName] = useState<string>('');
  const [forgotMobile, setForgotMobile] = useState<string>('');
  const [forgotAadhaar, setForgotAadhaar] = useState<string>('');
  const [showForgotAadhaar, setShowForgotAadhaar] = useState<boolean>(false);
  const [forgotCaptchaSvg, setForgotCaptchaSvg] = useState<string>('');
  const [forgotCaptchaToken, setForgotCaptchaToken] = useState<string>('');
  const [forgotCaptchaInput, setForgotCaptchaInput] = useState<string>('');
  const [forgotCaptchaLoading, setForgotCaptchaLoading] = useState<boolean>(false);
  const [forgotCaptchaError, setForgotCaptchaError] = useState<boolean>(false);
  const [forgotStepToken, setForgotStepToken] = useState<string>('');
  const [forgotOtpInput, setForgotOtpInput] = useState<string>('');
  const [forgotResetToken, setForgotResetToken] = useState<string>('');
  const [forgotNewPwd, setForgotNewPwd] = useState<string>('');
  const [forgotConfirmPwd, setForgotConfirmPwd] = useState<string>('');
  const [showForgotNewPwd, setShowForgotNewPwd] = useState<boolean>(false);
  const [showForgotConfirmPwd, setShowForgotConfirmPwd] = useState<boolean>(false);
  // Transient password held strictly in memory during Success Screen display only
  const [transientResetPwd, setTransientResetPwd] = useState<string>('');
  const [showTransientResetPwd, setShowTransientResetPwd] = useState<boolean>(false);
  const [forgotReceiptData, setForgotReceiptData] = useState<{
    organization: string;
    userId: string;
    userName: string;
    userRole: string;
    mobileMasked: string;
    resetStatus: 'SUCCESSFUL';
    resetDate: string;
    resetTime: string;
    resetTime12: string;
    referenceNumber: string;
    heading: string;
    receiptHeader: string;
    verificationNotice: string;
  } | null>(null);
  const [isReceiptSheetOpen, setIsReceiptSheetOpen] = useState<boolean>(false);
  const [forgotAlert, setForgotAlert] = useState<{ type: 'error' | 'info' | 'success'; text: string } | null>(null);
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);

  // Subtle 15-minute inactivity warning countdown
  const [isSessionWarningVisible, setIsSessionWarningVisible] = useState<boolean>(false);
  const [sessionRemainingMs, setSessionRemainingMs] = useState<number>(INACTIVITY_WARNING_MS);
  const [isExtendingSession, setIsExtendingSession] = useState<boolean>(false);
  const [isGmpQuotaExceeded, setIsGmpQuotaExceeded] = useState<boolean>(false);

  useEffect(() => {
    const onQuota = () => setIsGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  const gmpQuotaBanner = isGmpQuotaExceeded ? (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-amber-900 text-sm flex items-center justify-between gap-4 sticky top-0 z-50">
      <div className="flex items-center gap-2.5">
        <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <span>
          <strong>Google Maps demo quota reached.</strong> Mapping features are temporarily unavailable because the shared API key hit its usage limit. To use your own key,{' '}
          <a
            href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium hover:text-amber-950"
          >
            see the guide on resolving quota limits
          </a>
          .
        </span>
      </div>
    </div>
  ) : null;

  const erpRootRef = useRef<HTMLDivElement | null>(null);
  const currentUserRef = useRef<AuthUser | null>(currentUser);
  currentUserRef.current = currentUser;
  const uidRef = useRef<string>(uid);
  uidRef.current = uid;
  const activePanelRef = useRef<LoginPanel>(activePanel);
  activePanelRef.current = activePanel;
  const rememberMeRef = useRef<boolean>(rememberMe);
  rememberMeRef.current = rememberMe;
  const justLoggedInRef = useRef<boolean>(false);
  const idleLogoutReasonRef = useRef<string | null>(null);
  const extendSessionActivityRef = useRef<(() => void) | null>(null);

  const clearAuthStorage = useCallback(() => {
    clearLocalAuthStorageOnly();
  }, []);

  const loadLoginCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaError(false);
    setLoginCaptchaInput('');
    try {
      const res = await fetch('/api/auth/captcha', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.success && data.svg && data.captchaToken) {
        setLoginCaptchaSvg(data.svg);
        setLoginCaptchaToken(data.captchaToken);
        setCaptchaError(false);
      } else {
        setLoginCaptchaSvg('');
        setLoginCaptchaToken('');
        setCaptchaError(true);
      }
    } catch {
      setLoginCaptchaSvg('');
      setLoginCaptchaToken('');
      setCaptchaError(true);
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  const loadForgotCaptcha = useCallback(async () => {
    setForgotCaptchaLoading(true);
    setForgotCaptchaError(false);
    setForgotCaptchaInput('');
    try {
      const res = await fetch('/api/auth/captcha', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.success && data.svg && data.captchaToken) {
        setForgotCaptchaSvg(data.svg);
        setForgotCaptchaToken(data.captchaToken);
        setForgotCaptchaError(false);
      } else {
        setForgotCaptchaSvg('');
        setForgotCaptchaToken('');
        setForgotCaptchaError(true);
      }
    } catch {
      setForgotCaptchaSvg('');
      setForgotCaptchaToken('');
      setForgotCaptchaError(true);
    } finally {
      setForgotCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      loadLoginCaptcha();
    }
  }, [currentUser, loadLoginCaptcha]);

  const resetToLoginScreen = useCallback(
    (alertInfo: { type: 'error' | 'success' | 'info'; text: string } | null = null) => {
      clearAuthStorage();
      document.body.classList.remove('mobile-drawer-open', 'printing-inapp-sheet', 'printing-a4-popup', 'printing-pwd-reset-receipt');
      document.querySelector('.main-wrapper')?.scrollTo(0, 0);
      window.scrollTo(0, 0);
      justLoggedInRef.current = false;
      setCurrentUser(null);
      setMfaChallenge(null);
      setMfaTotpInput('');
      setIsMandatoryModalOpen(false);
      setIsForgotModalOpen(false);
      setIsReceiptSheetOpen(false);
      setTransientResetPwd('');
      setShowTransientResetPwd(false);
      setIsLoading(false);
      setPassword('');
      setShowPassword(false);
      setLoginCaptchaInput('');
      setLoginCaptchaToken('');
      setLoginCaptchaSvg('');
      setCaptchaError(false);
      if (!rememberMeRef.current) {
        setUid(getPrefilledUidForPanel(activePanelRef.current));
      } else if (!uidRef.current.trim()) {
        setUid(getPrefilledUidForPanel(activePanelRef.current));
      }
      setLoginAlert(alertInfo);
    },
    [clearAuthStorage, getPrefilledUidForPanel]
  );

  const syncAndRenderErp = useCallback(
    async (user: AuthUser, signal?: { cancelled: boolean }, skipSessionCheck = false) => {
      const cleanUser: AuthUser = { ...user, isLoggedOut: false };
      localStorage.setItem(ERP_USER_KEY, JSON.stringify(cleanUser));
      localStorage.setItem('mun_computer_v3_user', JSON.stringify(cleanUser));
      localStorage.setItem('mun_current_user', JSON.stringify(cleanUser));
      document.body.classList.remove('mobile-drawer-open', 'printing-inapp-sheet', 'printing-a4-popup', 'printing-pwd-reset-receipt');

      // Render ERP shell immediately so Dashboard appears right away without blocking on network checks
      const mountEl = erpRootRef.current || document.getElementById('erp-root');
      const activeHash = window.location.hash;
      const preserveExistingRoute =
        !skipSessionCheck &&
        Boolean(activeHash && activeHash !== '#' && activeHash !== '#login' && activeHash !== '#access-denied');
      if (mountEl && window.MJK?.render) {
        window.MJK.render(preserveExistingRoute, mountEl);
        window.scrollTo(0, 0);
        mountEl.querySelector('.main-wrapper')?.scrollTo(0, 0);
      }

      // Verify central session version token in background for restored sessions
      // Interceptor transparently handles single-flight refresh on ACCESS_TOKEN_EXPIRED
      if (!skipSessionCheck) {
        try {
          const sessResp = await fetch('/api/auth/session', {
            headers: getAuthRequestHeaders(cleanUser)
          });
          if (signal?.cancelled) return;
          if (sessResp.status === 401 || sessResp.status === 403) {
            const errData = await sessResp.json().catch(() => ({}));
            const errCode = String(errData?.errorCode || '').toUpperCase();
            if (isTerminalAuthErrorCode(errCode)) {
              resetToLoginScreen({
                type: 'info',
                text: errData?.message || 'Your session expired or was revoked. Please sign in again.'
              });
              return;
            }
          }
        } catch {
          // continue with local render if offline or temporary network hiccup
        }
      }

      try {
        const headers = getAuthRequestHeaders(cleanUser);
        const isAdmin = cleanUser.role === 'ADMIN' || cleanUser.isMainAdmin || cleanUser.isSuperAdmin || cleanUser.uid === DEFAULT_ADMIN_UID;
        const canViewUsers = isAdmin || cleanUser.role === 'MANAGER';

        const [usersResp, logsResp, menuResp] = await Promise.all([
          canViewUsers ? fetch('/api/users', { headers }) : Promise.resolve(null),
          isAdmin ? fetch('/api/audit-logs', { headers }) : Promise.resolve(null),
          fetch('/api/erp/menu-config', { headers })
        ]);
        if (signal?.cancelled) return;

        let updatedCache = false;
        if (usersResp && usersResp.ok) {
          const usersData = await usersResp.json();
          if (usersData.success && Array.isArray(usersData.users)) {
            const nextUsersJson = JSON.stringify(usersData.users);
            if (localStorage.getItem(ERP_USERS_KEY) !== nextUsersJson) {
              localStorage.setItem(ERP_USERS_KEY, nextUsersJson);
              updatedCache = true;
            }
            if (usersData.stats) window._munUserStats = usersData.stats;
            if (Array.isArray(usersData.recentLogins)) window._munRecentLogins = usersData.recentLogins;
          }
        }
        if (logsResp && logsResp.ok) {
          const logsData = await logsResp.json();
          if (logsData.success && Array.isArray(logsData.logs)) {
            const nextLogsJson = JSON.stringify(logsData.logs);
            if (localStorage.getItem(ERP_AUDIT_KEY) !== nextLogsJson) {
              localStorage.setItem(ERP_AUDIT_KEY, nextLogsJson);
              updatedCache = true;
            }
          }
        }
        if (menuResp.ok) {
          const menuData = await menuResp.json();
          if (menuData.success && menuData.menuConfig) {
            const nextMenuJson = JSON.stringify(menuData.menuConfig);
            if (localStorage.getItem(ERP_MENU_CONFIG_KEY) !== nextMenuJson) {
              localStorage.setItem(ERP_MENU_CONFIG_KEY, nextMenuJson);
              updatedCache = true;
            }
          }
        }

        if (!signal?.cancelled && updatedCache) {
          const hasOpenModal = Boolean(
            document.getElementById('global-modal-overlay')?.classList.contains('open') ||
              document.getElementById('a4-print-popup-overlay') ||
              document.getElementById('inapp-print-overlay')
          );
          const activeTag = document.activeElement?.tagName || '';
          const isEditingInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag);
          if (hasOpenModal || isEditingInput) {
            return;
          }
          const activeMount = erpRootRef.current || document.getElementById('erp-root');
          if (activeMount && window.MJK?.render) {
            window.MJK.render(true, activeMount);
          }
        }
      } catch {
        // keep local cache if offline
      }
    },
    [resetToLoginScreen]
  );

  useEffect(() => {
    const onErpLogout = (ev: Event) => {
      const customEv = ev as CustomEvent<{ reason?: string }>;
      const reason =
        idleLogoutReasonRef.current ||
        customEv?.detail?.reason ||
        'Signed out successfully. Enter your credentials to sign in again.';
      idleLogoutReasonRef.current = null;
      resetToLoginScreen({
        type: 'info',
        text: reason
      });
    };
    window.addEventListener('mun-auth-logout', onErpLogout);
    return () => window.removeEventListener('mun-auth-logout', onErpLogout);
  }, [resetToLoginScreen]);

  const activeUid = currentUser?.uid || '';
  const mustChangePwd = Boolean(currentUser?.mustChangePassword);

  const triggerInactivityLogout = useCallback(() => {
    if (!currentUserRef.current) return;
    setIsSessionWarningVisible(false);
    const message =
      'Session timed out after 15 minutes of inactivity to protect this workstation. Please sign in again.';
    idleLogoutReasonRef.current = message;
    if (typeof window.MJK?.handleLogout === 'function') {
      window.MJK.handleLogout();
    }
    if (idleLogoutReasonRef.current !== null) {
      idleLogoutReasonRef.current = null;
      resetToLoginScreen({ type: 'info', text: message });
    }
  }, [resetToLoginScreen]);

  const handleExtendSession = useCallback(async () => {
    if (!currentUserRef.current) return;
    setIsExtendingSession(true);
    try {
      const resp = await fetch('/api/auth/session', {
        headers: getAuthRequestHeaders(currentUserRef.current)
      });
      if (resp.status === 401 || resp.status === 403) {
        const errData = await resp.json().catch(() => ({}));
        if (isTerminalAuthErrorCode(errData?.errorCode)) {
          setIsSessionWarningVisible(false);
          resetToLoginScreen({
            type: 'info',
            text: errData?.message || 'Your session expired or was invalidated. Please sign in again.'
          });
          return;
        }
      }
    } catch {
      // Allow local session extension when offline
    } finally {
      setIsExtendingSession(false);
    }
    resetSharedActivity();
    extendSessionActivityRef.current?.();
  }, [resetToLoginScreen]);

  const handleManualWarningSignOut = useCallback(() => {
    setIsSessionWarningVisible(false);
    if (typeof window.MJK?.handleLogout === 'function') {
      window.MJK.handleLogout();
      return;
    }
    broadcastLocalLogout('Signed out successfully. Enter your credentials to sign in again.');
  }, []);

  // Client-side 15-minute cross-tab shared inactivity timer with 2-minute countdown warning
  useEffect(() => {
    if (!activeUid) {
      setIsSessionWarningVisible(false);
      extendSessionActivityRef.current = null;
      return;
    }

    let lastActivityAt = Math.max(Date.now(), getSharedLastActivityAt());
    let timeoutId: number | null = null;
    let countdownIntervalId: number | null = null;
    let lastThrottleResetAt = Date.now();
    let warningShown = false;

    const clearTimers = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (countdownIntervalId !== null) {
        window.clearInterval(countdownIntervalId);
        countdownIntervalId = null;
      }
    };

    const getEffectiveLastActivity = () => {
      lastActivityAt = Math.max(lastActivityAt, getSharedLastActivityAt());
      return lastActivityAt;
    };

    const startCountdownTicker = () => {
      if (countdownIntervalId !== null) return;
      const updateTick = () => {
        const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - getEffectiveLastActivity());
        if (remaining <= 0) {
          clearTimers();
          triggerInactivityLogout();
          return;
        }
        if (remaining > INACTIVITY_WARNING_MS) {
          warningShown = false;
          setIsSessionWarningVisible(false);
          scheduleCheck();
          return;
        }
        setSessionRemainingMs(remaining);
      };
      updateTick();
      countdownIntervalId = window.setInterval(updateTick, 500);
    };

    const scheduleCheck = () => {
      clearTimers();
      const elapsed = Date.now() - getEffectiveLastActivity();
      const remaining = INACTIVITY_TIMEOUT_MS - elapsed;

      if (remaining <= 0) {
        triggerInactivityLogout();
        return;
      }

      if (remaining <= INACTIVITY_WARNING_MS) {
        warningShown = true;
        setIsSessionWarningVisible(true);
        setSessionRemainingMs(remaining);
        startCountdownTicker();
        return;
      }

      if (warningShown) {
        warningShown = false;
        setIsSessionWarningVisible(false);
      }

      const msUntilWarning = remaining - INACTIVITY_WARNING_MS;
      timeoutId = window.setTimeout(() => {
        scheduleCheck();
      }, msUntilWarning);
    };

    const resetActivity = () => {
      lastActivityAt = resetSharedActivity();
      lastThrottleResetAt = lastActivityAt;
      warningShown = false;
      setIsSessionWarningVisible(false);
      setSessionRemainingMs(INACTIVITY_WARNING_MS);
      scheduleCheck();
    };

    extendSessionActivityRef.current = resetActivity;

    const handleUserActivity = () => {
      const now = Date.now();
      const effectiveLast = getEffectiveLastActivity();
      if (now - effectiveLast >= INACTIVITY_TIMEOUT_MS) {
        clearTimers();
        triggerInactivityLogout();
        return;
      }
      // Once the warning notice is visible, require explicit "Extend Session" click
      // so passive mouse movement doesn't dismiss the timer before the user sees it.
      if (warningShown) return;

      lastActivityAt = touchSharedActivity();
      if (now - lastThrottleResetAt >= 1500) {
        lastThrottleResetAt = now;
        scheduleCheck();
      }
    };

    // Never trigger logout directly from visibilitychange/focus; only re-sync shared multi-tab clock & reschedule
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'hidden') return;
      getEffectiveLastActivity();
      if (Date.now() - lastActivityAt < INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS && warningShown) {
        warningShown = false;
        setIsSessionWarningVisible(false);
      }
      if (Date.now() - lastActivityAt < INACTIVITY_TIMEOUT_MS) {
        scheduleCheck();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'pointerdown',
      'wheel'
    ];

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true, capture: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    scheduleCheck();

    return () => {
      clearTimers();
      extendSessionActivityRef.current = null;
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity, { capture: true });
      });
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [activeUid, triggerInactivityLogout]);

  useLayoutEffect(() => {
    const activeUser = currentUserRef.current;
    if (!activeUser || mustChangePwd || isMandatoryModalOpen) {
      return;
    }
    const skipCheck = justLoggedInRef.current;
    justLoggedInRef.current = false;
    const signal = { cancelled: false };
    syncAndRenderErp(activeUser, signal, skipCheck);

    return () => {
      signal.cancelled = true;
      if (erpRootRef.current) {
        erpRootRef.current.innerHTML = '';
      }
    };
  }, [activeUid, mustChangePwd, isMandatoryModalOpen, syncAndRenderErp]);

  const closeForgotModal = useCallback(() => {
    setIsForgotModalOpen(false);
    setIsReceiptSheetOpen(false);
    setTransientResetPwd('');
    setShowTransientResetPwd(false);
    setForgotNewPwd('');
    setForgotConfirmPwd('');
    setForgotAadhaar('');
    setShowForgotAadhaar(false);
    setForgotStepToken('');
    setForgotResetToken('');
    setForgotOtpInput('');
    document.body.classList.remove('printing-pwd-reset-receipt');
  }, []);

  useEffect(() => {
    if (!isForgotModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeForgotModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isForgotModalOpen, closeForgotModal]);

  useEffect(() => {
    const onAfterPrint = () => {
      document.body.classList.remove('printing-pwd-reset-receipt');
    };
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('afterprint', onAfterPrint);
      document.body.classList.remove('printing-pwd-reset-receipt');
      setTransientResetPwd('');
    };
  }, []);

  useEffect(() => {
    if (!isRoleMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setIsRoleMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsRoleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRoleMenuOpen]);

  const handleCardMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const card = loginCardRef.current;
      if (!card || isRoleMenuOpen) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!window.matchMedia('(pointer: fine)').matches) return;

      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * 8; // max ±4deg
      const rotateX = (0.5 - py) * 8; // max ±4deg

      card.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
      card.style.setProperty('--glare-x', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--glare-y', `${(py * 100).toFixed(1)}%`);
    },
    [isRoleMenuOpen]
  );

  const handleCardMouseLeave = useCallback(() => {
    const card = loginCardRef.current;
    if (!card) return;
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
    card.style.setProperty('--glare-x', '50%');
    card.style.setProperty('--glare-y', '20%');
  }, []);

  const handlePanelSelect = (panel: LoginPanel) => {
    setActivePanel(panel);
    setIsRoleMenuOpen(false);
    setLoginAlert(null);
    setMfaChallenge(null);
    setMfaTotpInput('');
    setPassword('');
    loadLoginCaptcha();
    setUid(getPrefilledUidForPanel(panel));
  };

  const completeAuthenticatedSession = useCallback(
    (data: any) => {
      const user: AuthUser = { ...data.user, isLoggedOut: false };
      commitAuthTokens({
        sessionToken: data.sessionToken,
        csrfToken: data.csrfToken,
        sessionId: data.sessionId || '',
        deviceId: data.deviceId || getOrCreateDeviceIdentity().deviceId,
        generation: data.generation || 1,
        expiresAt: data.expiresAt || '',
        sessionExpiresAt: data.sessionExpiresAt || ''
      });
      commitAuthenticatedUserCache(user);
      resetSharedActivity();

      const requireChange = Boolean(data.mustChangePassword || user.mustChangePassword);
      if (requireChange) {
        setChangeCurrentPwd(password);
        setIsMandatoryModalOpen(true);
      } else {
        setIsMandatoryModalOpen(false);
      }
      justLoggedInRef.current = true;
      setMfaChallenge(null);
      setMfaTotpInput('');
      setPassword('');
      setShowPassword(false);
      setLoginCaptchaInput('');
      setLoginCaptchaToken('');
      setCurrentUser(user);
    },
    [password]
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginAlert(null);

    const cleanUid = uid.trim().toUpperCase();
    if (!cleanUid || cleanUid === managerUidPrefix || cleanUid === staffUidPrefix) {
      setLoginAlert({
        type: 'error',
        text:
          cleanUid === managerUidPrefix || cleanUid === staffUidPrefix
            ? `Please complete your 8-digit Official User ID (e.g., ${cleanUid}01).`
            : 'Please enter your assigned User ID.'
      });
      return;
    }
    if (!password) {
      setLoginAlert({ type: 'error', text: 'Please enter your account password.' });
      return;
    }
    if (!loginCaptchaToken) {
      setLoginAlert({ type: 'error', text: 'Security CAPTCHA is still loading. Please refresh CAPTCHA and try again.' });
      loadLoginCaptcha();
      return;
    }
    if (!loginCaptchaInput.trim()) {
      setLoginAlert({ type: 'error', text: 'Please enter the security CAPTCHA characters.' });
      return;
    }

    if (rememberMe) {
      localStorage.setItem(REMEMBER_UID_KEY, cleanUid);
    } else {
      localStorage.removeItem(REMEMBER_UID_KEY);
    }

    setIsLoading(true);
    try {
      const { deviceId, deviceName, platform } = getOrCreateDeviceIdentity();
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
          'x-device-name': deviceName
        },
        body: JSON.stringify({
          uid: cleanUid,
          password,
          panelRole: activePanel,
          captchaToken: loginCaptchaToken,
          captchaInput: loginCaptchaInput.trim(),
          deviceId,
          deviceName,
          platform
        })
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success && data.mfaRequired && data.mfaPendingToken) {
        setMfaChallenge({ uid: data.uid || cleanUid, pendingToken: data.mfaPendingToken });
        setMfaTotpInput('');
        setLoginAlert({ type: 'info', text: data.message || 'Enter your 6-digit TOTP authenticator code.' });
      } else if (response.ok && data.success && data.user) {
        completeAuthenticatedSession(data);
      } else {
        const errCode = String(data?.errorCode || '');
        const isDevicePending = errCode === 'DEVICE_PENDING_APPROVAL';
        setLoginAlert({
          type: isDevicePending ? 'info' : 'error',
          text: data.message || 'Authentication failed. Check your User ID, password, or CAPTCHA.'
        });
        loadLoginCaptcha();
      }
    } catch {
      setLoginAlert({
        type: 'error',
        text: 'Unable to reach central authentication server. Please verify connection.'
      });
      loadLoginCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerifyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge) return;
    setLoginAlert(null);
    const code = mfaTotpInput.replace(/\s+/g, '');
    if (code.length !== 6) {
      setLoginAlert({ type: 'error', text: 'Enter the 6-digit code from your authenticator app.' });
      return;
    }
    setIsLoading(true);
    try {
      const { deviceId, deviceName, platform } = getOrCreateDeviceIdentity();
      const response = await fetch('/api/auth/mfa/verify-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
          'x-device-name': deviceName
        },
        body: JSON.stringify({
          mfaPendingToken: mfaChallenge.pendingToken,
          totpCode: code,
          deviceId,
          deviceName,
          platform
        })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success && data.user) {
        completeAuthenticatedSession(data);
      } else {
        const errCode = String(data?.errorCode || '');
        setLoginAlert({
          type: errCode === 'DEVICE_PENDING_APPROVAL' ? 'info' : 'error',
          text: data.message || 'Invalid 6-digit authenticator code.'
        });
      }
    } catch {
      setLoginAlert({ type: 'error', text: 'Network error during MFA verification.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeAlert(null);

    if (!isStrongPasswordClient(changeNewPwd)) {
      setChangeAlert(
        'Password must be at least 8 characters and include 1 Capital letter (A-Z), 1 Small letter (a-z), 1 Number (0-9), and 1 Special Symbol (@#$%&*!).'
      );
      return;
    }
    if (changeNewPwd === changeCurrentPwd) {
      setChangeAlert('New password cannot be the same as your current password.');
      return;
    }
    if (changeNewPwd !== changeConfirmPwd) {
      setChangeAlert('New password and confirmation do not match.');
      return;
    }

    setIsChangingPwd(true);
    try {
      const { deviceId, deviceName, platform } = getOrCreateDeviceIdentity();
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthRequestHeaders(currentUser)
        },
        body: JSON.stringify({
          uid: currentUser?.uid || uid,
          currentPassword: changeCurrentPwd,
          newPassword: changeNewPwd,
          confirmPassword: changeConfirmPwd,
          deviceId,
          deviceName,
          platform
        })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        if (data.sessionToken) {
          commitAuthTokens({
            sessionToken: data.sessionToken,
            csrfToken: data.csrfToken,
            sessionId: data.sessionId || '',
            deviceId: data.deviceId || deviceId,
            generation: data.generation || 1,
            expiresAt: data.expiresAt || '',
            sessionExpiresAt: data.sessionExpiresAt || ''
          });
        }
        const updated: AuthUser = {
          ...(data.user || currentUser!),
          mustChangePassword: false,
          isLoggedOut: false
        };
        commitAuthenticatedUserCache(updated);
        justLoggedInRef.current = true;
        setCurrentUser(updated);
        setIsMandatoryModalOpen(false);
        setChangeCurrentPwd('');
        setChangeNewPwd('');
        setChangeConfirmPwd('');
      } else {
        setChangeAlert(data.message || 'Password update failed.');
      }
    } catch {
      setChangeAlert('Network error while updating password.');
    } finally {
      setIsChangingPwd(false);
    }
  };

  const handleLogout = () => {
    if (typeof window.MJK?.handleLogout === 'function') {
      window.MJK.handleLogout();
      return;
    }
    broadcastLocalLogout('Signed out successfully. Enter your credentials to sign in again.');
  };

  // --- Forgot Password & Official Receipt System (Sections 7, 8, 9, 10) ---
  const openForgotModal = () => {
    setIsForgotModalOpen(true);
    setForgotStage('VERIFY');
    setForgotAlert(null);
    const trimmedUid = uid.trim().toUpperCase();
    setForgotUid(trimmedUid || getPrefilledUidForPanel(activePanel));
    setForgotFullName('');
    setForgotMobile('');
    setForgotAadhaar('');
    setShowForgotAadhaar(false);
    setForgotStepToken('');
    setForgotOtpInput('');
    setForgotResetToken('');
    setForgotNewPwd('');
    setForgotConfirmPwd('');
    setShowForgotNewPwd(false);
    setShowForgotConfirmPwd(false);
    setTransientResetPwd('');
    setShowTransientResetPwd(false);
    setForgotReceiptData(null);
    setIsReceiptSheetOpen(false);
    loadForgotCaptcha();
  };

  const handleForgotVerifyInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotAlert(null);
    const cleanUid = forgotUid.trim().toUpperCase();
    const cleanName = forgotFullName.trim().replace(/\s+/g, ' ');
    const cleanMobile = forgotMobile.replace(/\D/g, '');
    const cleanAadhaar = forgotAadhaar.replace(/\D/g, '');
    if (!cleanUid || cleanUid === managerUidPrefix || cleanUid === staffUidPrefix) {
      setForgotAlert({
        type: 'error',
        text:
          cleanUid === managerUidPrefix || cleanUid === staffUidPrefix
            ? `Please complete your full Official User ID (e.g., ${cleanUid}01).`
            : 'Please enter your Official User ID.'
      });
      return;
    }
    if (!cleanName || cleanName.length < 2) {
      setForgotAlert({ type: 'error', text: 'Please enter your Registered Full Name.' });
      return;
    }
    if (cleanMobile.length !== 10) {
      setForgotAlert({ type: 'error', text: 'Please enter your registered 10-digit Mobile Number.' });
      return;
    }
    if (cleanAadhaar.length !== 12) {
      setForgotAlert({ type: 'error', text: 'Please enter your registered 12-digit Aadhaar Number.' });
      return;
    }
    if (!forgotCaptchaToken || !forgotCaptchaInput.trim()) {
      setForgotAlert({ type: 'error', text: 'Please enter the security CAPTCHA characters.' });
      return;
    }

    setForgotLoading(true);
    try {
      const resp = await fetch('/api/auth/forgot/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: cleanUid,
          fullName: cleanName,
          mobileNumber: cleanMobile,
          aadhaarNumber: cleanAadhaar,
          captchaToken: forgotCaptchaToken,
          captchaInput: forgotCaptchaInput.trim()
        })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setForgotUid(data.uid || cleanUid);
        setForgotAadhaar('');
        setShowForgotAadhaar(false);
        if (data.otpRequired && data.stepToken) {
          setForgotStepToken(data.stepToken);
          setForgotStage('OTP');
        } else if (data.resetToken) {
          setForgotResetToken(data.resetToken);
          setForgotStage('RESET');
        } else {
          setForgotAlert({ type: 'error', text: 'Verification failed. Please check the details entered and try again.' });
          loadForgotCaptcha();
        }
      } else {
        setForgotAlert({ type: 'error', text: data.message || 'Verification failed. Please check the details entered and try again.' });
        loadForgotCaptcha();
      }
    } catch {
      setForgotAlert({ type: 'error', text: 'Unable to reach recovery verification service.' });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotAlert(null);
    if (forgotOtpInput.trim().length < 4) {
      setForgotAlert({ type: 'error', text: 'Enter the verification OTP sent to your mobile.' });
      return;
    }
    setForgotLoading(true);
    try {
      const resp = await fetch('/api/auth/forgot/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepToken: forgotStepToken,
          otp: forgotOtpInput.trim()
        })
      });
      const data = await resp.json();
      if (resp.ok && data.success && data.resetToken) {
        setForgotResetToken(data.resetToken);
        setForgotStage('RESET');
      } else {
        setForgotAlert({ type: 'error', text: data.message || 'OTP verification failed.' });
      }
    } catch {
      setForgotAlert({ type: 'error', text: 'Network error verifying OTP.' });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotAlert(null);
    if (!forgotResetToken) {
      setForgotAlert({ type: 'error', text: 'Verification session expired. Please restart.' });
      return;
    }
    if (!isStrongPasswordClient(forgotNewPwd)) {
      setForgotAlert({
        type: 'error',
        text: 'Password must be at least 8 characters and include 1 Capital letter (A-Z), 1 Small letter (a-z), 1 Number (0-9), and 1 Special Symbol (@#$%&*!).'
      });
      return;
    }
    if (forgotNewPwd !== forgotConfirmPwd) {
      setForgotAlert({ type: 'error', text: 'New Password and Confirm Password do not match.' });
      return;
    }

    setForgotLoading(true);
    try {
      const resp = await fetch('/api/auth/forgot/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetToken: forgotResetToken,
          newPassword: forgotNewPwd,
          confirmPassword: forgotConfirmPwd
        })
      });
      const data = await resp.json();
      if (resp.ok && data.success && data.referenceNumber) {
        clearAuthStorage();
        // Hold newly entered password ONLY in transient React component state for immediate Show/Hide on Success Screen
        setTransientResetPwd(forgotNewPwd);
        setShowTransientResetPwd(false);
        setForgotNewPwd('');
        setForgotConfirmPwd('');
        setForgotReceiptData({
          organization: 'MUN COMPUTER',
          userId: data.userId || forgotUid,
          userName: data.userName || forgotFullName || '',
          userRole: data.userRole || '',
          mobileMasked: data.mobileMasked || '',
          resetStatus: 'SUCCESSFUL',
          resetDate: data.resetDate,
          resetTime: data.resetTime,
          resetTime12: data.resetTime12 || data.resetTime,
          referenceNumber: data.referenceNumber,
          heading: data.heading || 'Congratulations! Your MUN COMPUTER account password has been successfully updated.',
          receiptHeader: data.receiptHeader || 'MUN COMPUTER — OFFICIAL PASSWORD RESET RECEIPT',
          verificationNotice:
            data.verificationNotice ||
            'Computer-generated verification confirmation. Password reset verified against registered account credentials; all active sessions invalidated immediately.'
        });
        setForgotStage('SUCCESS');
      } else {
        setForgotAlert({ type: 'error', text: data.message || 'Password reset failed.' });
      }
    } catch {
      setForgotAlert({ type: 'error', text: 'Network error during password update.' });
    } finally {
      setForgotLoading(false);
    }
  };

  const handlePrintPasswordResetReceipt = () => {
    if (!forgotReceiptData) return;
    setIsReceiptSheetOpen(true);
    window.setTimeout(() => {
      document.body.classList.add('printing-pwd-reset-receipt');
      window.print();
    }, 120);
  };

  const handleDownloadPasswordResetPdf = async () => {
    if (!forgotReceiptData) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Top White Brand Area + Original Logo
    const logoDataUrl = await loadLogoPngDataUrl();
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.rect(14, 14, pageW - 28, 212);

    let y = 24;
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', (pageW - 56) / 2, y, 56, 22);
      y += 27;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(11, 21, 48);
    doc.text('MUN COMPUTER — OFFICIAL PASSWORD RESET RECEIPT', pageW / 2, y, { align: 'center' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text('CORPORATE ERP SYSTEM • AUTHORIZED IDENTITY VERIFICATION RECORD', pageW / 2, y, { align: 'center' });
    y += 6;

    doc.setDrawColor(203, 213, 225);
    doc.line(22, y, pageW - 22, y);
    y += 10;

    const rows: Array<[string, string]> = [
      ['Organization', forgotReceiptData.organization || 'MUN COMPUTER'],
      ['User Role', forgotReceiptData.userRole || '—'],
      ['User Name', forgotReceiptData.userName || '—'],
      ['Official User ID', forgotReceiptData.userId],
      ['Registered Mobile', forgotReceiptData.mobileMasked || '—'],
      ['Reset Reference Number', forgotReceiptData.referenceNumber],
      ['Reset Date', forgotReceiptData.resetDate],
      ['Reset Time', `${forgotReceiptData.resetTime12} (${forgotReceiptData.resetTime} IST)`],
      ['Reset Status', forgotReceiptData.resetStatus]
    ];

    doc.setFontSize(10.5);
    for (const [label, val] of rows) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text(`${label}:`, 24, y);
      doc.setFont('courier', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(val), 82, y);
      doc.setDrawColor(226, 232, 240);
      doc.line(24, y + 3, pageW - 24, y + 3);
      y += 11;
    }

    y += 4;
    doc.setFillColor(248, 250, 252);
    doc.rect(22, y, pageW - 44, 28, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('OFFICIAL VERIFICATION NOTICE', 26, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const wrapped = doc.splitTextToSize(
      `${forgotReceiptData.verificationNotice} For security protection, passwords, Aadhaar, and reset tokens are never printed or stored on receipts.`,
      pageW - 52
    );
    doc.text(wrapped, 26, y + 13);

    y += 38;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Generated on ${forgotReceiptData.resetDate} at ${forgotReceiptData.resetTime} IST • MUN COMPUTER Corporate ERP`,
      pageW / 2,
      y,
      { align: 'center' }
    );

    doc.save(`MUN_COMPUTER_Password_Reset_${forgotReceiptData.referenceNumber}.pdf`);
  };

  if (!currentUser) {
    const panelCtaLabel =
      activePanel === 'ADMIN'
        ? 'Sign In to Administration'
        : activePanel === 'MANAGER'
          ? 'Sign In to Manager'
          : 'Sign In to Staff';

    const uidFieldLabel =
      activePanel === 'ADMIN'
        ? 'Official User ID'
        : activePanel === 'MANAGER'
          ? 'Manager User ID'
          : 'Staff User ID';

    const uidPlaceholder =
      activePanel === 'ADMIN'
        ? DEFAULT_ADMIN_UID
        : activePanel === 'MANAGER'
          ? `MC-MGR-${currentYearStr}-00000001`
          : `MC-STF-${currentYearStr}-00000002`;

    const roleOptions: Array<{
      id: LoginPanel;
      label: string;
      Icon: typeof Crown;
    }> = [
      { id: 'ADMIN', label: 'Administration', Icon: Crown },
      { id: 'MANAGER', label: 'Manager', Icon: Briefcase },
      { id: 'STAFF', label: 'Staff', Icon: UserCheck }
    ];

    const selectedRole = roleOptions.find((item) => item.id === activePanel) || roleOptions[0];
    const SelectedRoleIcon = selectedRole.Icon;

    return (
      <MotionConfig reducedMotion="user">
        {gmpQuotaBanner}
        <div className="min-h-screen mun-login-bg text-[#0F172A] flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-[#0D2A6C] selection:text-white relative overflow-hidden">
          <LoginWaveBackdrop />

          <div className="mun-login-3d-stage relative z-10 w-full max-w-[490px]">
            <motion.div
              ref={loginCardRef}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              className="mun-login-3d-card w-full rounded-[28px] p-6 sm:p-7 flex flex-col"
            >
              {/* Clipped Specular Glass Glare Overlay */}
              <div className="pointer-events-none absolute inset-0 rounded-[28px] overflow-hidden" aria-hidden="true">
                <div className="mun-login-specular-glare" />
              </div>

              {/* Centered Prominent Glossy 3D Brand Header */}
              <div className="mun-3d-layer-logo relative z-10 mb-5">
                <MunComputerLogo />
              </div>

              {/* Elevated "Authorized Portal Access" Bar + Custom Floating 3D Dropbox-Style Role Selector */}
              <div
                ref={roleMenuRef}
                className="mun-3d-layer-bar relative z-40 mun-access-glass-bar rounded-2xl px-3.5 py-2.5 mb-5 flex items-center justify-between gap-2.5"
              >
                <div className="inline-flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.75)]" />
                  </span>
                  <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" aria-hidden="true" />
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#0F172A] whitespace-nowrap truncate">
                    Authorized Portal Access
                  </span>
                </div>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoleMenuOpen((prev) => !prev);
                      if (loginCardRef.current) {
                        loginCardRef.current.style.setProperty('--tilt-x', '0deg');
                        loginCardRef.current.style.setProperty('--tilt-y', '0deg');
                      }
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={isRoleMenuOpen}
                    aria-label="Select portal access role"
                    className="mun-role-trigger-3d min-h-[36px] px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-[#0D2A6C] whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D2A6C]/40"
                  >
                    <span className="w-5 h-5 rounded-md bg-[#0D2A6C]/10 text-[#0D2A6C] flex items-center justify-center shrink-0">
                      <SelectedRoleIcon className="w-3.5 h-3.5" />
                    </span>
                    <span>{selectedRole.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${
                        isRoleMenuOpen ? 'rotate-180 text-[#0D2A6C]' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isRoleMenuOpen && (
                      <motion.div
                        role="listbox"
                        aria-label="Portal Roles"
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.975 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="mun-role-dropdown-menu absolute right-0 top-[calc(100%+8px)] w-52 rounded-2xl p-1.5 z-50 origin-top-right"
                      >
                        {roleOptions.map(({ id, label, Icon }) => {
                          const isSelected = id === activePanel;
                          return (
                            <button
                              key={id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => handlePanelSelect(id)}
                              className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between gap-2.5 transition cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D2A6C]/40 ${
                                isSelected
                                  ? 'bg-[#0D2A6C] text-white shadow-[0_6px_14px_-4px_rgba(13,42,108,0.45)]'
                                  : 'text-[#0F172A] hover:bg-[#0D2A6C]/8 hover:text-[#0D2A6C]'
                              }`}
                            >
                              <span className="flex items-center gap-2.5">
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                    isSelected ? 'bg-white/15 text-white' : 'bg-[#0D2A6C]/10 text-[#0D2A6C]'
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                </span>
                                <span>{label}</span>
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {loginAlert && (
                  <motion.div
                    key={`${loginAlert.type}-${loginAlert.text}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className={`relative z-10 mb-4 p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2.5 box-border ${
                      loginAlert.type === 'error'
                        ? 'bg-red-50/95 border-[#E61C24]/35 text-[#B91C1C]'
                        : loginAlert.type === 'success'
                          ? 'bg-emerald-50/95 border-emerald-200 text-emerald-700'
                          : 'bg-blue-50/95 border-[#0D2A6C]/25 text-[#0D2A6C]'
                    }`}
                  >
                    {loginAlert.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 shrink-0 text-[#E61C24]" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-[#10B981]" />
                    )}
                    <span className="min-w-0 break-words">{loginAlert.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Login Form or MFA TOTP Challenge */}
              {mfaChallenge ? (
                <form onSubmit={handleMfaVerifyLogin} className="mun-3d-layer-form relative z-10 flex flex-col gap-4 w-full box-border">
                  <div className="p-3.5 rounded-2xl bg-[#EAF1FF]/80 border border-[#2456C7]/25 text-xs text-[#0B1530] flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#2456C7] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold uppercase tracking-wide text-[11px]">Two-Factor Authentication (TOTP MFA)</div>
                      <p className="text-slate-600 mt-0.5">
                        Account <strong className="font-mono text-[#0D2A6C]">{mfaChallenge.uid}</strong> requires your 6-digit authenticator verification code.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[13px] font-bold text-[#0F172A] pl-0.5">
                      6-Digit Authenticator Code <span className="text-[#E61C24]">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={mfaTotpInput}
                      onChange={(e) => setMfaTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full box-border min-h-[46px] px-4 py-2.5 mun-input-recessed-3d rounded-2xl font-mono text-center tracking-[0.35em] text-base font-bold text-[#0F172A] focus:outline-none"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMfaChallenge(null);
                        setMfaTotpInput('');
                        setLoginAlert(null);
                        loadLoginCaptcha();
                      }}
                      className="px-4 min-h-[48px] bg-white border border-slate-300 text-[#0F172A] rounded-2xl text-xs font-bold cursor-pointer hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 mun-signin-3d-btn min-h-[48px] px-5 text-white rounded-2xl font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      <span>{isLoading ? 'Verifying...' : 'Verify & Enter ERP'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="mun-3d-layer-form relative z-10 flex flex-col gap-4 w-full box-border">
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[13px] font-bold text-[#0F172A] pl-0.5">
                      {uidFieldLabel} <span className="text-[#E61C24]">*</span>
                    </label>
                    <input
                      type="text"
                      value={uid}
                      onChange={(e) => setUid(e.target.value.toUpperCase())}
                      placeholder={uidPlaceholder}
                      autoComplete="username"
                      className="w-full box-border min-h-[46px] px-4 py-2.5 mun-input-recessed-3d rounded-2xl font-mono text-[14px] font-semibold tabular-nums text-[#0F172A] placeholder:text-slate-400 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex items-center justify-between gap-2 px-0.5">
                      <label className="text-[13px] font-bold text-[#0F172A]">
                        Password <span className="text-[#E61C24]">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="px-2 py-0.5 rounded-lg text-xs text-[#0D2A6C] hover:text-[#E61C24] hover:bg-[#0D2A6C]/5 transition flex items-center gap-1 cursor-pointer font-bold shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D2A6C]/40"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{showPassword ? 'Hide' : 'Show'}</span>
                      </button>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your account password"
                      autoComplete="current-password"
                      className="w-full box-border min-h-[46px] px-4 py-2.5 mun-input-recessed-3d rounded-2xl text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none"
                      required
                    />
                  </div>

                  {/* Security CAPTCHA */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[13px] font-bold text-[#0F172A] pl-0.5">
                      CAPTCHA Verification <span className="text-[#E61C24]">*</span>
                    </label>
                    <div className="flex items-center gap-2 sm:gap-2.5 w-full box-border">
                      {loginCaptchaSvg ? (
                        <div
                          className="w-[144px] sm:w-[162px] h-[46px] rounded-2xl overflow-hidden shrink-0 flex items-center justify-center mun-captcha-box"
                          dangerouslySetInnerHTML={{ __html: loginCaptchaSvg }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={loadLoginCaptcha}
                          className="w-[144px] sm:w-[162px] h-[46px] rounded-2xl mun-captcha-box text-xs font-semibold text-[#0D2A6C] flex items-center justify-center gap-1.5 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D2A6C]/40"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${captchaLoading ? 'animate-spin' : ''}`} />
                          <span>{captchaError ? 'Retry' : 'Loading...'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={loadLoginCaptcha}
                        disabled={captchaLoading}
                        aria-label="Refresh CAPTCHA"
                        className="mun-captcha-refresh-3d h-[46px] w-[46px] flex items-center justify-center rounded-2xl cursor-pointer shrink-0 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D2A6C]/40"
                        title="Refresh CAPTCHA"
                      >
                        <RefreshCw className={`w-4 h-4 ${captchaLoading ? 'animate-spin' : ''}`} />
                      </button>

                      <input
                        type="text"
                        value={loginCaptchaInput}
                        onChange={(e) => setLoginCaptchaInput(e.target.value.toUpperCase())}
                        placeholder="6-char"
                        maxLength={6}
                        autoComplete="off"
                        className="flex-1 min-w-0 box-border h-[46px] px-3 py-2 mun-input-recessed-3d rounded-2xl font-mono uppercase tracking-wider text-center text-sm font-semibold text-[#0F172A] placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-sans placeholder:normal-case focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs pt-0.5 px-0.5 w-full">
                    <label className="flex items-center gap-2 text-[#0F172A] font-semibold cursor-pointer select-none py-0.5">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded accent-[#0D2A6C] border-slate-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D2A6C]/40 focus-visible:ring-offset-1"
                      />
                      <span>Remember</span>
                    </label>

                    <button
                      type="button"
                      onClick={openForgotModal}
                      className="px-2 py-0.5 rounded-lg text-[#0D2A6C] hover:text-[#E61C24] hover:bg-[#0D2A6C]/5 transition font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D2A6C]/40"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <div className="mun-3d-layer-cta pt-1 w-full">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="group mun-signin-3d-btn w-full box-border min-h-[52px] px-6 text-white rounded-2xl font-display font-bold text-[15px] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-center whitespace-nowrap"
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                          <span>Verifying Credentials...</span>
                        </>
                      ) : (
                        <>
                          <User className="w-4 h-4 shrink-0 text-white/90" />
                          <span className="h-4 w-[1.5px] bg-white/40 shrink-0" aria-hidden="true" />
                          <span>{panelCtaLabel}</span>
                          <ArrowRight className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              <div className="relative z-10 mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-center">
                <span
                  data-testid="app-version-badge"
                  className="text-[11px] font-mono font-semibold tracking-wide text-slate-500/90 tabular-nums"
                >
                  v{APP_VERSION}
                </span>
              </div>
            </motion.div>
          </div>

          {/* FORGOT PASSWORD RECOVERY MODAL + OFFICIAL RECEIPT (SECTIONS F, G, H, I, J) */}
          <AnimatePresence>
            {isForgotModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) closeForgotModal();
                }}
                className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
              >
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.975 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Password Recovery & Reset"
                  className={`w-full ${isReceiptSheetOpen ? 'max-w-[680px]' : 'max-w-[520px]'} box-border overflow-hidden mun-login-card-glass backdrop-blur-xl bg-white/95 rounded-[24px] p-6 sm:p-7 shadow-[0_24px_60px_rgba(11,21,48,0.32)] relative my-auto text-[#0B1530]`}
                >
                  <div className="mun-no-print flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                    <h3 className="text-sm font-display font-bold text-[#0B1530] flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-[#2456C7]" />
                      <span>MUN COMPUTER — Account Password Recovery</span>
                    </h3>
                    <button
                      type="button"
                      onClick={closeForgotModal}
                      aria-label="Close password recovery dialog"
                      className="p-1.5 rounded-full text-slate-500 hover:text-[#0B1530] hover:bg-slate-100 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Step Indicator */}
                  {!isReceiptSheetOpen && (
                    <div className="mun-no-print mb-4">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1.5 font-mono font-semibold tabular-nums">
                        <span>
                          {forgotStage === 'VERIFY' && 'STEP 1: IDENTITY & CAPTCHA'}
                          {forgotStage === 'OTP' && 'STEP 2: OTP VERIFICATION'}
                          {forgotStage === 'RESET' && 'STEP 2: NEW PASSWORD'}
                          {forgotStage === 'SUCCESS' && 'RESET COMPLETED'}
                        </span>
                        <span className="text-[#2456C7]">{forgotUid || 'ACCOUNT RECOVERY'}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className={`h-1.5 rounded-full ${['VERIFY', 'OTP', 'RESET', 'SUCCESS'].includes(forgotStage) ? 'bg-[#2456C7]' : 'bg-slate-200'}`} />
                        <div className={`h-1.5 rounded-full ${['OTP', 'RESET', 'SUCCESS'].includes(forgotStage) ? 'bg-[#2456C7]' : 'bg-slate-200'}`} />
                        <div className={`h-1.5 rounded-full ${forgotStage === 'SUCCESS' ? 'bg-[#10B981]' : 'bg-slate-200'}`} />
                      </div>
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {forgotAlert && (
                      <motion.div
                        key={`${forgotAlert.type}-${forgotAlert.text}`}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16 }}
                        className={`mun-no-print mb-3 p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                          forgotAlert.type === 'error'
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : forgotAlert.type === 'success'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-[#EAF1FF] border-[#2456C7]/25 text-[#2456C7]'
                        }`}
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{forgotAlert.text}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* STAGE 1: Official User ID + Full Name + Registered Mobile + Aadhaar + CAPTCHA */}
                  {forgotStage === 'VERIFY' && (
                    <form onSubmit={handleForgotVerifyInitiate} className="space-y-3">
                      <div className="p-2.5 rounded-xl bg-[#EAF1FF]/70 border border-[#2456C7]/20 text-[11px] text-[#0B1530] leading-relaxed">
                        Verify your registered <strong>Official User ID</strong>, <strong>Full Name</strong>, <strong>10-Digit Mobile Number</strong>, <strong>12-Digit Aadhaar Number</strong>, and <strong>CAPTCHA</strong> to reset your password securely.
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                          <label className="text-xs font-bold text-[#0F172A]">
                            Official User ID <span className="text-[#E61C24]">*</span>
                          </label>
                          <div className="flex items-center gap-1 flex-wrap">
                            {[
                              { label: 'Admin', val: DEFAULT_ADMIN_UID },
                              { label: 'Manager', val: managerUidPrefix },
                              { label: 'Staff', val: staffUidPrefix }
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => setForgotUid(preset.val)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition cursor-pointer ${
                                  forgotUid.startsWith(preset.val)
                                    ? 'bg-[#0D2A6C] text-white border-[#0D2A6C]'
                                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                }`}
                              >
                                {preset.val}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          type="text"
                          value={forgotUid}
                          onChange={(e) => setForgotUid(e.target.value.toUpperCase())}
                          placeholder={`${DEFAULT_ADMIN_UID} or MC-MGR-${currentYearStr}-00000001`}
                          className="w-full min-h-[40px] px-3.5 py-2 mun-input-recessed-3d rounded-xl font-mono text-sm font-semibold focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#0F172A] mb-1">
                          Registered Full Name <span className="text-[#E61C24]">*</span>
                        </label>
                        <input
                          type="text"
                          value={forgotFullName}
                          onChange={(e) => setForgotFullName(e.target.value)}
                          placeholder="Enter exact registered full name"
                          className="w-full min-h-[40px] px-3.5 py-2 mun-input-recessed-3d rounded-xl text-sm font-medium focus:outline-none"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">
                            Registered 10-Digit Mobile <span className="text-[#E61C24]">*</span>
                          </label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={forgotMobile}
                            onChange={(e) => setForgotMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            placeholder="10-digit mobile"
                            maxLength={10}
                            className="w-full min-h-[40px] px-3.5 py-2 mun-input-recessed-3d rounded-xl font-mono text-sm font-semibold focus:outline-none"
                            required
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-[#0F172A]">
                              12-Digit Aadhaar No <span className="text-[#E61C24]">*</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowForgotAadhaar((v) => !v)}
                              className="text-[11px] font-bold text-[#2456C7] flex items-center gap-1 cursor-pointer"
                            >
                              {showForgotAadhaar ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              <span>{showForgotAadhaar ? 'Hide' : 'Show'}</span>
                            </button>
                          </div>
                          <input
                            type={showForgotAadhaar ? 'text' : 'password'}
                            inputMode="numeric"
                            autoComplete="off"
                            value={forgotAadhaar}
                            onChange={(e) => setForgotAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                            placeholder="12-digit Aadhaar"
                            maxLength={12}
                            className="w-full min-h-[40px] px-3.5 py-2 mun-input-recessed-3d rounded-xl font-mono text-sm font-semibold focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#0F172A] mb-1">
                          CAPTCHA Verification <span className="text-[#E61C24]">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          {forgotCaptchaSvg ? (
                            <div
                              className="w-[155px] h-[44px] rounded-xl overflow-hidden shrink-0 flex items-center justify-center mun-captcha-box"
                              dangerouslySetInnerHTML={{ __html: forgotCaptchaSvg }}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={loadForgotCaptcha}
                              className="w-[155px] h-[44px] rounded-xl mun-captcha-box text-xs font-semibold text-[#0D2A6C] flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${forgotCaptchaLoading ? 'animate-spin' : ''}`} />
                              <span>{forgotCaptchaError ? 'Retry' : 'Loading...'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={loadForgotCaptcha}
                            disabled={forgotCaptchaLoading}
                            aria-label="Refresh CAPTCHA"
                            className="mun-captcha-refresh-3d h-[44px] w-[44px] flex items-center justify-center rounded-xl cursor-pointer shrink-0"
                          >
                            <RefreshCw className={`w-4 h-4 ${forgotCaptchaLoading ? 'animate-spin' : ''}`} />
                          </button>
                          <input
                            type="text"
                            value={forgotCaptchaInput}
                            onChange={(e) => setForgotCaptchaInput(e.target.value.toUpperCase())}
                            placeholder="6-char"
                            maxLength={6}
                            className="flex-1 min-w-0 h-[44px] px-3 py-2 mun-input-recessed-3d rounded-xl font-mono uppercase text-center text-sm font-bold focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="w-full min-h-[46px] py-2.5 text-white rounded-xl text-xs font-bold disabled:opacity-60 cursor-pointer mun-signin-3d-btn"
                      >
                        {forgotLoading ? 'Verifying Identity...' : 'Verify Identity & Continue →'}
                      </button>
                    </form>
                  )}

                  {/* STAGE 2 (Optional when SMS Gateway active): OTP Verification */}
                  {forgotStage === 'OTP' && (
                    <form onSubmit={handleForgotVerifyOtp} className="space-y-3.5">
                      <div className="p-3 rounded-xl bg-[#EAF1FF] border border-[#2456C7]/25 text-xs text-[#0B1530]">
                        Enter the 6-digit SMS OTP dispatched to your registered mobile number.
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#0F172A] mb-1">6-Digit OTP *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={forgotOtpInput}
                          onChange={(e) => setForgotOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Enter 6-digit OTP"
                          className="w-full min-h-[44px] px-3.5 py-2 mun-input-recessed-3d rounded-xl font-mono text-center tracking-widest text-base font-bold focus:outline-none"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="w-full min-h-[46px] py-2.5 text-white rounded-xl text-xs font-bold disabled:opacity-60 cursor-pointer mun-signin-3d-btn"
                      >
                        {forgotLoading ? 'Verifying OTP...' : 'Verify OTP & Continue →'}
                      </button>
                    </form>
                  )}

                  {/* STAGE 3: New Password & Confirm Password */}
                  {forgotStage === 'RESET' && (
                    <form onSubmit={handleForgotResetSubmit} className="space-y-3.5">
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>Identity verified for <strong className="font-mono">{forgotUid}</strong>. Set your new password below.</span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-[#0F172A]">New Password *</label>
                          <button
                            type="button"
                            onClick={() => setShowForgotNewPwd(!showForgotNewPwd)}
                            className="text-xs font-bold text-[#2456C7] flex items-center gap-1 cursor-pointer"
                          >
                            {showForgotNewPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{showForgotNewPwd ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <input
                          type={showForgotNewPwd ? 'text' : 'password'}
                          value={forgotNewPwd}
                          onChange={(e) => setForgotNewPwd(e.target.value)}
                          placeholder="Enter new strong password"
                          className="w-full min-h-[42px] px-3.5 py-2 mun-input-recessed-3d rounded-xl text-sm focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-[#0F172A]">Confirm Password *</label>
                          <button
                            type="button"
                            onClick={() => setShowForgotConfirmPwd(!showForgotConfirmPwd)}
                            className="text-xs font-bold text-[#2456C7] flex items-center gap-1 cursor-pointer"
                          >
                            {showForgotConfirmPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{showForgotConfirmPwd ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <input
                          type={showForgotConfirmPwd ? 'text' : 'password'}
                          value={forgotConfirmPwd}
                          onChange={(e) => setForgotConfirmPwd(e.target.value)}
                          placeholder="Confirm new password"
                          className="w-full min-h-[42px] px-3.5 py-2 mun-input-recessed-3d rounded-xl text-sm focus:outline-none"
                          required
                        />
                      </div>

                      <PasswordInstructionsCard pwd={forgotNewPwd} />

                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="w-full min-h-[46px] py-2.5 text-white rounded-xl text-xs font-bold disabled:opacity-60 cursor-pointer mun-signin-3d-btn"
                      >
                        {forgotLoading ? 'Updating Password...' : 'Update Password Securely'}
                      </button>
                    </form>
                  )}

                  {/* STAGE 4: Success Confirmation & Official Receipt (Sections 9 & 10) */}
                  {forgotStage === 'SUCCESS' && forgotReceiptData && (
                    <div className="space-y-4">
                      {!isReceiptSheetOpen ? (
                        <>
                          <div className="text-center space-y-2">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#10B981] inline-flex items-center justify-center">
                              <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <h4 className="text-[15px] font-display font-extrabold text-[#0B1530] leading-snug">
                              {forgotReceiptData.heading}
                            </h4>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3.5 space-y-2 text-xs">
                            <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
                              <span className="text-slate-600 font-semibold">Official User ID</span>
                              <span className="font-mono font-bold text-[#0B1530]">{forgotReceiptData.userId}</span>
                            </div>
                            {forgotReceiptData.userName && (
                              <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
                                <span className="text-slate-600 font-semibold">User Name</span>
                                <span className="font-semibold text-[#0F172A]">{forgotReceiptData.userName}</span>
                              </div>
                            )}
                            {forgotReceiptData.userRole && (
                              <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
                                <span className="text-slate-600 font-semibold">User Role</span>
                                <span className="font-mono font-bold text-[#0D2A6C]">{forgotReceiptData.userRole}</span>
                              </div>
                            )}
                            {forgotReceiptData.mobileMasked && (
                              <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
                                <span className="text-slate-600 font-semibold">Registered Mobile</span>
                                <span className="font-mono font-semibold text-[#0F172A]">{forgotReceiptData.mobileMasked}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
                              <span className="text-slate-600 font-semibold">Reset Status</span>
                              <span className="font-mono font-bold text-[#10B981]">{forgotReceiptData.resetStatus}</span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
                              <span className="text-slate-600 font-semibold">Reset Date</span>
                              <span className="font-mono font-semibold text-[#0F172A]">{forgotReceiptData.resetDate}</span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
                              <span className="text-slate-600 font-semibold">Reset Time</span>
                              <span className="font-mono font-semibold text-[#0F172A]">
                                {forgotReceiptData.resetTime12} ({forgotReceiptData.resetTime} IST)
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
                              <span className="text-slate-600 font-semibold">Reference Number</span>
                              <span className="font-mono font-bold text-[#2456C7]">{forgotReceiptData.referenceNumber}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-1">
                              <span className="text-slate-600 font-semibold">Newly Set Password</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#0F172A] bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                                  {showTransientResetPwd ? transientResetPwd : '••••••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowTransientResetPwd((v) => !v)}
                                  className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-[#2456C7] hover:bg-[#EAF1FF] flex items-center gap-1 cursor-pointer"
                                >
                                  {showTransientResetPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  <span>{showTransientResetPwd ? 'Hide' : 'Show'}</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setIsReceiptSheetOpen(true)}
                              className="min-h-[42px] px-4 py-2 rounded-xl border border-[#2456C7] bg-[#EAF1FF] text-[#2456C7] hover:bg-[#dce8ff] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Printer className="w-4 h-4" />
                              <span>PRINT RECEIPT</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleDownloadPasswordResetPdf}
                              className="min-h-[42px] px-4 py-2 rounded-xl border border-[#0B1530] bg-[#0B1530] text-white hover:bg-[#13224a] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                              <span>DOWNLOAD RECEIPT</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const nextUid = forgotReceiptData.userId;
                              closeForgotModal();
                              setUid(nextUid);
                              setPassword('');
                              loadLoginCaptcha();
                            }}
                            className="w-full min-h-[44px] py-2.5 text-white rounded-xl text-xs font-bold cursor-pointer mun-signin-3d-btn"
                          >
                            Return to Login
                          </button>
                        </>
                      ) : (
                        /* Official Monochrome Printable A4 Receipt View (NEVER includes plaintext password, Aadhaar, OTP, or token) */
                        <div className="space-y-4">
                          <div className="mun-no-print flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                            <button
                              type="button"
                              onClick={() => {
                                document.body.classList.remove('printing-pwd-reset-receipt');
                                setIsReceiptSheetOpen(false);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              ← Back to Confirmation
                            </button>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleDownloadPasswordResetPdf}
                                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-[#0B1530] hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>DOWNLOAD PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={handlePrintPasswordResetReceipt}
                                className="px-3.5 py-1.5 rounded-lg bg-[#0B1530] text-white text-xs font-bold hover:bg-[#162958] flex items-center gap-1.5 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>PRINT NOW</span>
                              </button>
                            </div>
                          </div>

                          <div
                            id="mun-password-reset-print-sheet"
                            className="bg-white text-black border border-slate-900 rounded-xl p-6 sm:p-7 space-y-5"
                          >
                            <div className="text-center border-b border-slate-800 pb-4">
                              <div className="inline-block bg-white px-4 py-1.5 rounded-lg mb-2">
                                <img
                                  src="/assets/aistudio/MUN_Computer_Tech_Logo_35ee99e8.png"
                                  alt="MUN COMPUTER"
                                  className="h-14 w-auto object-contain mx-auto"
                                />
                              </div>
                              <h4 className="text-sm sm:text-base font-extrabold tracking-wide text-black uppercase">
                                MUN COMPUTER — OFFICIAL PASSWORD RESET RECEIPT
                              </h4>
                              <p className="text-[11px] text-slate-700 mt-0.5 uppercase tracking-wider">
                                Corporate ERP System • Verified Identity & Audit Confirmation
                              </p>
                            </div>

                            <div className="divide-y divide-slate-300 border border-slate-400 rounded-lg text-xs">
                              <div className="flex items-center justify-between px-4 py-2">
                                <span className="font-bold text-slate-700 uppercase">Organization</span>
                                <span className="font-bold text-black">{forgotReceiptData.organization || 'MUN COMPUTER'}</span>
                              </div>
                              <div className="flex items-center justify-between px-4 py-2">
                                <span className="font-bold text-slate-700 uppercase">User Role</span>
                                <span className="font-mono font-bold text-black">{forgotReceiptData.userRole || '—'}</span>
                              </div>
                              <div className="flex items-center justify-between px-4 py-2">
                                <span className="font-bold text-slate-700 uppercase">User Name</span>
                                <span className="font-semibold text-black">{forgotReceiptData.userName || '—'}</span>
                              </div>
                              <div className="flex items-center justify-between px-4 py-2">
                                <span className="font-bold text-slate-700 uppercase">Official User ID</span>
                                <span className="font-mono font-bold text-black">{forgotReceiptData.userId}</span>
                              </div>
                              <div className="flex items-center justify-between px-4 py-2">
                                <span className="font-bold text-slate-700 uppercase">Registered Mobile</span>
                                <span className="font-mono font-semibold text-black">{forgotReceiptData.mobileMasked || '—'}</span>
                              </div>
                              <div className="flex items-center justify-between px-4 py-2">
                                <span className="font-bold text-slate-700 uppercase">Reset Reference Number</span>
                                <span className="font-mono font-bold text-black">{forgotReceiptData.referenceNumber}</span>
                              </div>
                              <div className="flex items-center justify-between px-4 py-2">
                                <span className="font-bold text-slate-700 uppercase">Reset Date</span>
                                <span className="font-mono font-semibold text-black">{forgotReceiptData.resetDate}</span>
                              </div>
                              <div className="flex items-center justify-between px-4 py-2">
                                <span className="font-bold text-slate-700 uppercase">Reset Time</span>
                                <span className="font-mono font-semibold text-black">
                                  {forgotReceiptData.resetTime12} ({forgotReceiptData.resetTime} IST)
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-4 py-2">
                                <span className="font-bold text-slate-700 uppercase">Reset Status</span>
                                <span className="font-mono font-extrabold text-black">{forgotReceiptData.resetStatus}</span>
                              </div>
                            </div>

                            <div className="border border-slate-400 bg-slate-50 rounded-lg p-3.5 text-[11px] text-slate-800 leading-relaxed">
                              <strong className="uppercase block mb-1 text-black">Official Verification Notice</strong>
                              {forgotReceiptData.verificationNotice} For account security, passwords, full Aadhaar numbers, OTPs, and reset tokens are never printed or stored on official receipts.
                            </div>

                            <div className="text-center text-[10px] text-slate-600 pt-1">
                              MUN COMPUTER • Computer-Generated Verification Receipt • No Signature Required
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          <OfflineIndicator />
          <PWAInstallModalHost />
        </div>
      </MotionConfig>
    );
  }

  // Mandatory First-Login / Temporary Password Change View
  if (isMandatoryModalOpen) {
    return (
      <MotionConfig reducedMotion="user">
        {gmpQuotaBanner}
        <div className="min-h-screen mun-login-bg flex items-center justify-center p-4 relative overflow-hidden">
          <LoginWaveBackdrop />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.975 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-[500px] box-border overflow-hidden mun-login-card-glass backdrop-blur-xl bg-white/85 rounded-[26px] p-6 sm:p-8 shadow-[0_20px_50px_rgba(8,112,184,0.15)] text-[#0b2447]"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-blue-200/80 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[#0b2447]">Mandatory Password Change</h2>
                <p className="text-xs text-slate-600">
                  User: <span className="font-mono text-[#0044aa] font-bold">{currentUser.uid}</span>
                </p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {changeAlert && (
                <motion.div
                  key={changeAlert}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                  className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700"
                >
                  {changeAlert}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#0b2447]">Current / Temporary Password *</label>
                  <button
                    type="button"
                    onClick={() => setShowChangeCurrentPwd(!showChangeCurrentPwd)}
                    className="text-xs font-bold text-[#0057d9] flex items-center gap-1 cursor-pointer"
                  >
                    {showChangeCurrentPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showChangeCurrentPwd ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showChangeCurrentPwd ? 'text' : 'password'}
                  value={changeCurrentPwd}
                  onChange={(e) => setChangeCurrentPwd(e.target.value)}
                  placeholder="Enter issued one-time temporary password"
                  className="w-full min-h-[42px] px-4 py-2 mun-login-input-pill rounded-full text-sm focus:outline-none"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#0b2447]">New Strong Password *</label>
                  <button
                    type="button"
                    onClick={() => setShowChangeNewPwd(!showChangeNewPwd)}
                    className="text-xs font-bold text-[#0057d9] flex items-center gap-1 cursor-pointer"
                  >
                    {showChangeNewPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showChangeNewPwd ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showChangeNewPwd ? 'text' : 'password'}
                  value={changeNewPwd}
                  onChange={(e) => setChangeNewPwd(e.target.value)}
                  placeholder="Enter custom strong password"
                  className="w-full min-h-[42px] px-4 py-2 mun-login-input-pill rounded-full text-sm focus:outline-none"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#0b2447]">Confirm New Password *</label>
                  <button
                    type="button"
                    onClick={() => setShowChangeConfirmPwd(!showChangeConfirmPwd)}
                    className="text-xs font-bold text-[#0057d9] flex items-center gap-1 cursor-pointer"
                  >
                    {showChangeConfirmPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showChangeConfirmPwd ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showChangeConfirmPwd ? 'text' : 'password'}
                  value={changeConfirmPwd}
                  onChange={(e) => setChangeConfirmPwd(e.target.value)}
                  placeholder="Re-enter custom password"
                  className="w-full min-h-[42px] px-4 py-2 mun-login-input-pill rounded-full text-sm focus:outline-none"
                  required
                />
              </div>

              <PasswordInstructionsCard pwd={changeNewPwd} />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-2.5 bg-white border border-blue-200 text-[#0b2447] rounded-full text-xs font-semibold cursor-pointer hover:bg-blue-50"
                >
                  Sign Out
                </button>
                <button
                  type="submit"
                  disabled={isChangingPwd}
                  className="flex-1 py-2.5 text-white rounded-full text-xs font-bold disabled:opacity-60 cursor-pointer mun-login-cta-gloss"
                >
                  {isChangingPwd ? 'Updating Password...' : 'Update Password & Enter Dashboard →'}
                </button>
              </div>
            </form>
          </motion.div>
          <SessionTimeoutNotice
            visible={isSessionWarningVisible}
            remainingMs={sessionRemainingMs}
            warningWindowMs={INACTIVITY_WARNING_MS}
            isExtending={isExtendingSession}
            onExtend={handleExtendSession}
            onSignOut={handleManualWarningSignOut}
          />
          <OfflineIndicator />
          <PWAInstallModalHost />
        </div>
      </MotionConfig>
    );
  }

  return (
    <>
      {gmpQuotaBanner}
      <div id="erp-root" ref={erpRootRef} className="min-h-screen w-full" />
      <SessionTimeoutNotice
        visible={isSessionWarningVisible}
        remainingMs={sessionRemainingMs}
        warningWindowMs={INACTIVITY_WARNING_MS}
        isExtending={isExtendingSession}
        onExtend={handleExtendSession}
        onSignOut={handleManualWarningSignOut}
      />
      <OfflineIndicator />
      <PWAInstallModalHost />
    </>
  );
}
