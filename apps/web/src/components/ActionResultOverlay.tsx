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
  const prescriptionFeedback = result.prescriptionFeedback as
    | { accuracy: string; expectedValue: string; feedback: string }
    | undefined;

  const feedbackColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
    correct: { bg: 'bg-sim-stable/20', border: 'border-sim-stable/40', text: 'text-green-200', label: 'Correct' },
    acceptable: { bg: 'bg-amber-900/30', border: 'border-amber-500/40', text: 'text-amber-200', label: 'Acceptable' },
    incorrect: { bg: 'bg-amber-900/30', border: 'border-amber-500/40', text: 'text-amber-200', label: 'Incorrect' },
    dangerous: { bg: 'bg-nhs-emergency/20', border: 'border-nhs-emergency/40', text: 'text-red-200', label: 'Dangerous' },
  };

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

        {prescriptionFeedback && (() => {
          const style = feedbackColors[prescriptionFeedback.accuracy] ?? feedbackColors.incorrect;
          return (
            <div className={`${style.bg} border ${style.border} rounded-lg p-3 mb-3`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                  {style.label}
                </span>
                <span className="text-xs text-sim-textMuted">
                  Expected: {prescriptionFeedback.expectedValue}
                </span>
              </div>
              <p className={`text-sm ${style.text} font-medium`}>
                {prescriptionFeedback.feedback}
              </p>
            </div>
          );
        })()}

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
