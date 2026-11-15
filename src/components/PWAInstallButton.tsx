import React from 'react';
import {
  Smartphone,
  Download,
  Share,
  X,
  CheckCircle2,
  WifiOff,
  ExternalLink,
  Chrome
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const { isOnline } = usePWAInstall();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-[90] flex items-center gap-2 rounded-xl border border-amber-500/40 bg-[#0F1D32] px-3.5 py-2 text-xs font-semibold text-amber-300 shadow-xl"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-amber-400" />
      <span>Offline mode — local directory &amp; cached screens active</span>
    </div>
  );
};

interface PWAInstallButtonProps {
  variant?: 'compact' | 'login';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'login' }) => {
  const { isInstalled, canNativeInstall, triggerInstall, setIsModalOpen } = usePWAInstall();

  if (isInstalled) return null;

  const handleClick = async () => {
    if (canNativeInstall) {
      await triggerInstall();
    } else {
      setIsModalOpen(true);
    }
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-blue-500/45 bg-blue-600/20 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:text-white cursor-pointer mun-btn-3d mun-btn-3d-blue"
        title="Install Android / Mobile App"
      >
        <Smartphone className="h-3.5 w-3.5 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-blue-300/80 bg-white/85 px-3.5 py-2 text-xs font-semibold text-[#0044aa] shadow-sm backdrop-blur-sm transition hover:bg-white hover:border-blue-400 cursor-pointer whitespace-nowrap"
    >
      <Download className="h-3.5 w-3.5 shrink-0 text-[#0057d9]" />
      <span>{canNativeInstall ? 'Install App' : 'Mobile App & APK'}</span>
    </button>
  );
};

export const PWAInstallModalHost: React.FC = () => {
  const {
    canNativeInstall,
    isInstalled,
    isIOS,
    isModalOpen,
    setIsModalOpen,
    triggerInstall
  } = usePWAInstall();

  if (!isModalOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 overflow-y-auto">
      <div className="my-auto w-full max-w-lg rounded-2xl border border-slate-700/80 bg-[#0F1D32] p-6 text-slate-100 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/20 text-blue-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-white">
                MUN COMPUTER — Mobile App &amp; Android APK
              </h3>
              <p className="text-[11px] text-slate-400">
                Install as a standalone fullscreen app on Android, Windows, or iOS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            aria-label="Close Install Guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          {isInstalled && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Running in installed standalone app mode.</span>
            </div>
          )}

          {canNativeInstall && (
            <div className="rounded-xl border border-blue-500/40 bg-blue-600/15 p-4">
              <div className="font-bold text-white">
                Direct One-Tap Android / Desktop Install Ready
              </div>
              <p className="mt-1 text-slate-300">
                Chrome installs MUN ERP directly onto your device as a signed WebAPK with its own app icon, splash screen, and fullscreen navigation — no browser bar.
              </p>
              <button
                type="button"
                onClick={triggerInstall}
                className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white cursor-pointer mun-btn-3d mun-btn-3d-blue"
              >
                <Download className="h-4 w-4" />
                <span>Install App Now</span>
              </button>
            </div>
          )}

          {isIOS ? (
            <div className="rounded-xl border border-slate-800 bg-[#091221] p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-white">
                <Share className="h-4 w-4 text-blue-400" />
                <span>Install on iPhone / iPad (Safari)</span>
              </div>
              <ol className="list-decimal space-y-1 pl-4 text-slate-300">
                <li>Open this portal in <strong>Safari</strong>.</li>
                <li>Tap the <strong>Share</strong> icon in Safari&apos;s bottom toolbar.</li>
                <li>Select <strong>Add to Home Screen</strong> and tap <strong>Add</strong>.</li>
              </ol>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-[#091221] p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-white">
                <Chrome className="h-4 w-4 text-blue-400" />
                <span>Android Phone One-Tap App Install (WebAPK)</span>
              </div>
              <ol className="list-decimal space-y-1 pl-4 text-slate-300">
                <li>Open the deployed HTTPS link on Android in <strong>Google Chrome</strong>.</li>
                <li>Tap Chrome&apos;s <strong>⋮ menu</strong> (top-right) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                <li>Android automatically generates and installs an authentic home-screen WebAPK for MUN COMPUTER ERP.</li>
              </ol>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-[#091221] p-4 space-y-2">
            <div className="font-bold text-white">
              Need a downloadable <span className="font-mono text-blue-400">.apk</span> file for USB / WhatsApp sharing?
            </div>
            <p className="text-slate-400">
              This portal includes a verified PWA Manifest &amp; Service Worker configured for Android Trusted Web Activity (TWA). Once hosted at your HTTPS domain, paste the URL below into <strong>PWABuilder</strong> to generate a signed <code className="text-blue-300">.apk</code> or Google Play <code className="text-blue-300">.aab</code> package in under 60 seconds:
            </p>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#070D17] px-3 py-2 font-mono text-[11px] text-blue-300">
              <span className="truncate">{currentOrigin || 'https://your-deployed-app-url'}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="min-h-[40px] rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 cursor-pointer mun-btn-3d mun-btn-3d-dark"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
