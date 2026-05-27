/**
 * PrivacyNoticeTooltip.tsx
 *
 * One-time tooltip shown the first time a user saves a label.
 * Dismisses on click, Escape key, or after 8 seconds.
 *
 * The notice text is intentionally plain and short — users are in the middle
 * of a task; we give them just enough to understand the storage model and let
 * them get back to labelling.
 */

import { useEffect, useRef } from 'react';

interface Props {
  onDismiss: () => void;
}

export function PrivacyNoticeTooltip({ onDismiss }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 8_000);

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('keydown', onKey);
    };
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed bottom-6 right-6 z-50 max-w-xs',
        'bg-[#1a1a1a] border border-[#333333] p-4 shadow-lg',
        'animate-in fade-in slide-in-from-bottom-2 duration-200',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-[#e6e1e5] leading-tight">
          Labels stored locally
        </p>
        <button
          onClick={onDismiss}
          className="text-[#555555] hover:text-[#c4c7c5] transition-colors shrink-0 -mt-0.5"
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            aria-hidden="true">
            <line x1="1" y1="1" x2="11" y2="11"/>
            <line x1="11" y1="1" x2="1" y2="11"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <p className="mt-1.5 text-[11px] text-[#767575] leading-relaxed">
        Labels are stored only in this browser. Clear browser data = lose labels.
        Wraith never sees them.
      </p>

      {/* Auto-dismiss progress bar */}
      <div className="mt-3 h-px bg-[#222222] overflow-hidden">
        <div
          className="h-full bg-[#444444] origin-left"
          style={{ animation: 'shrink 8s linear forwards' }}
        />
      </div>

      <style>{`
        @keyframes shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}