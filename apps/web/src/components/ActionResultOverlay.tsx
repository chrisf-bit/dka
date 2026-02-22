import { useRef, useEffect } from 'react';
import { AlertTriangle, CheckCircle, ClipboardList } from 'lucide-react';
import gsap from 'gsap';

interface Props {
  result: Record<string, unknown>;
  onDismiss: () => void;
}

export default function ActionResultOverlay({ result, onDismiss }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (overlayRef.current && cardRef.current) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      gsap.fromTo(
        cardRef.current,
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out', delay: 0.1 },
      );

      // Shake if flagged
      if (result.flag) {
        gsap.to(cardRef.current, {
          keyframes: [
            { x: -4, duration: 0.08 },
            { x: 4, duration: 0.08 },
            { x: -4, duration: 0.08 },
            { x: 4, duration: 0.08 },
            { x: 0, duration: 0.08 },
          ],
          delay: 0.5,
        });
      }
    }
  }, [result]);

  const isNormal = result.normal as boolean;
  const flag = result.flag as string | undefined;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={onDismiss}
    >
      <div
        ref={cardRef}
        className={`w-full max-w-md rounded-2xl p-5 border-2 ${
          flag
            ? 'bg-red-950 border-nhs-emergency'
            : isNormal
              ? 'bg-sim-surface border-sim-stable'
              : 'bg-sim-surface border-sim-concerning'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-lg">{result.label as string}</h3>
          {flag ? <AlertTriangle className="w-6 h-6 text-nhs-emergency" /> : isNormal ? <CheckCircle className="w-6 h-6 text-sim-stable" /> : <ClipboardList className="w-6 h-6 text-sim-concerning" />}
        </div>

        <div
          className={`text-xl font-mono font-bold mb-3 ${
            flag ? 'text-nhs-emergency' : isNormal ? 'text-sim-stable' : 'text-sim-concerning'
          }`}
        >
          {result.value as string}
        </div>

        {flag && (
          <div className="bg-nhs-emergency/20 border border-nhs-emergency/40 rounded-lg p-3 mb-3">
            <p className="text-sm text-red-200 font-medium">{flag}</p>
          </div>
        )}

        <button
          onClick={onDismiss}
          className="btn-primary w-full mt-2"
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
}
