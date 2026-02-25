import { useRef, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, ClipboardList } from 'lucide-react';
import gsap from 'gsap';
import { useSessionStore } from '../stores/sessionStore';
import { useSheetDrag } from '../hooks/useSheetDrag';

interface Props {
  onClose: () => void;
}

export default function ResultsLogOverlay({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const completedResults = useSessionStore((s) => s.completedResults);
  const { handleProps } = useSheetDrag(sheetRef, onClose);

  useEffect(() => {
    if (overlayRef.current && sheetRef.current) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      gsap.fromTo(
        sheetRef.current,
        { y: '100%' },
        { y: 0, duration: 0.4, ease: 'power3.out' },
      );
    }
  }, []);

  const handleClose = () => {
    if (overlayRef.current && sheetRef.current) {
      gsap.to(sheetRef.current, { y: '100%', duration: 0.3, ease: 'power2.in' });
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.2,
        delay: 0.1,
        onComplete: onClose,
      });
    } else {
      onClose();
    }
  };

  // Show most recent first
  const results = [...completedResults].reverse();

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-40 bg-black/50 flex items-end justify-center"
      onClick={handleClose}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-lg bg-sim-surface rounded-t-2xl border-t border-sim-border max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar — drag to dismiss */}
        <div {...handleProps} className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-sim-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-sim-border shrink-0">
          <div>
            <h2 className="font-bold text-base">Results Log</h2>
            <p className="text-xs text-sim-textMuted">
              {results.length} result{results.length !== 1 ? 's' : ''} received
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-sim-surfaceLight transition-colors"
          >
            <X className="w-5 h-5 text-sim-textMuted" />
          </button>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-auto scrollable p-4 space-y-2">
          {results.length === 0 ? (
            <div className="text-center text-sim-textMuted py-8 text-sm">
              No results yet. Submit actions and acknowledge results to see them here.
            </div>
          ) : (
            results.map((entry, i) => {
              const r = entry.result;
              const flag = r.flag as string | undefined;
              const isNormal = r.normal as boolean;

              return (
                <div
                  key={`${entry.key}-${i}`}
                  className={`rounded-lg p-3 border ${
                    flag
                      ? 'bg-red-950/40 border-nhs-emergency/40'
                      : isNormal
                        ? 'bg-sim-stable/10 border-sim-stable/30'
                        : 'bg-sim-concerning/10 border-sim-concerning/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 mt-0.5">
                      {flag ? (
                        <AlertTriangle className="w-4 h-4 text-nhs-emergency" />
                      ) : isNormal ? (
                        <CheckCircle className="w-4 h-4 text-sim-stable" />
                      ) : (
                        <ClipboardList className="w-4 h-4 text-sim-concerning" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{r.label as string}</div>
                      <div
                        className={`text-sm font-mono font-bold mt-0.5 break-words ${
                          flag ? 'text-nhs-emergency' : isNormal ? 'text-sim-stable' : 'text-sim-concerning'
                        }`}
                      >
                        {r.value as string}
                      </div>
                      {flag && (
                        <p className="text-xs text-red-300 mt-1">{flag}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
