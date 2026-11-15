import React from 'react';
import { Clock, RefreshCw } from 'lucide-react';

interface SessionTimeoutNoticeProps {
  visible: boolean;
  remainingMs: number;
  warningWindowMs: number;
  isExtending?: boolean;
  onExtend: () => void;
  onSignOut: () => void;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const SessionTimeoutNotice: React.FC<SessionTimeoutNoticeProps> = ({
  visible,
  remainingMs,
  warningWindowMs,
  isExtending = false,
  onExtend,
  onSignOut
}) => {
  if (!visible) return null;

  const clampedMs = Math.max(0, remainingMs);
  const progressPct = Math.min(100, Math.max(0, (clampedMs / Math.max(1, warningWindowMs)) * 100));
  const isUrgent = clampedMs <= 30 * 1000;

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Session inactivity countdown"
      className="fixed bottom-4 right-4 z-[95] w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden rounded-xl border border-slate-700/80 bg-[#0F1D32] text-slate-100 shadow-2xl"
    >
      {/* Subtle hairline countdown progress bar */}
      <div className="h-0.5 w-full bg-slate-800">
        <div
          className={`h-full transition-[width] duration-500 ease-linear motion-reduce:transition-none ${
            isUrgent ? 'bg-rose-400' : 'bg-amber-400'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                isUrgent
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}
            >
              <Clock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-xs font-semibold text-white leading-snug">
                Session expiring soon
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">
                Inactive workstation will sign out automatically.
              </p>
            </div>
          </div>

          <div
            className={`shrink-0 font-mono text-sm font-bold tabular-nums tracking-tight ${
              isUrgent ? 'text-rose-300' : 'text-amber-300'
            }`}
          >
            {formatCountdown(clampedMs)}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-[36px] rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer mun-btn-3d mun-btn-3d-dark"
          >
            Sign Out
          </button>
          <button
            type="button"
            onClick={onExtend}
            disabled={isExtending}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-60 cursor-pointer mun-btn-3d mun-btn-3d-primary"
          >
            {isExtending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            <span>{isExtending ? 'Extending...' : 'Extend Session'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
