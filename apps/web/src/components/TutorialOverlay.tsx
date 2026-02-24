import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, X } from 'lucide-react';
import gsap from 'gsap';

interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  description: string;
  position: 'below' | 'above';
}

const STEPS: TourStep[] = [
  {
    target: 'header',
    title: 'Patient Header',
    description: 'Your patient\'s name, age, gestation and weight. The status badge shows how they\'re doing.',
    position: 'below',
  },
  {
    target: 'info-btn',
    title: 'Patient Info',
    description: 'Tap here to see full history, PMH, allergies and CTG summary.',
    position: 'below',
  },
  {
    target: 'results-btn',
    title: 'Results Log',
    description: 'After you acknowledge a result, it\'s saved here so you can review it later.',
    position: 'below',
  },
  {
    target: 'vitals',
    title: 'Vitals Strip',
    description: 'Live observations — HR, BP, SpO2, RR, Temp and GCS. These update as the patient\'s condition changes.',
    position: 'below',
  },
  {
    target: 'actions',
    title: 'Actions',
    description: 'Investigate, monitor, escalate and treat. Tap an action to submit it — some take time and some unlock others. Discuss with your team before acting.',
    position: 'above',
  },
];

interface Props {
  onComplete: () => void;
}

export default function TutorialOverlay({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const currentStep = STEPS[step];

  const measureTarget = useCallback(() => {
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (el) {
      setRect(el.getBoundingClientRect());
    }
  }, [currentStep.target]);

  useEffect(() => {
    measureTarget();
    window.addEventListener('resize', measureTarget);
    return () => window.removeEventListener('resize', measureTarget);
  }, [measureTarget]);

  // Animate tooltip on step change
  useEffect(() => {
    if (tooltipRef.current) {
      gsap.fromTo(
        tooltipRef.current,
        { opacity: 0, y: currentStep.position === 'below' ? -10 : 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' },
      );
    }
  }, [step, currentStep.position]);

  // Fade in on mount
  useEffect(() => {
    if (overlayRef.current) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    }
  }, []);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const isLast = step === STEPS.length - 1;
  const pad = 6; // padding around highlighted element

  // Compute tooltip position
  let tooltipStyle: React.CSSProperties = {};
  if (rect) {
    if (currentStep.position === 'below') {
      tooltipStyle = {
        top: rect.bottom + 12,
        left: 16,
        right: 16,
      };
    } else {
      tooltipStyle = {
        bottom: window.innerHeight - rect.top + 12,
        left: 16,
        right: 16,
      };
    }
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50">
      {/* SVG mask — dark overlay with cutout for target */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - pad}
                y={rect.top - pad}
                width={rect.width + pad * 2}
                height={rect.height + pad * 2}
                rx={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.75)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Highlight border around target */}
      {rect && (
        <div
          className="absolute border-2 border-nhs-lightBlue rounded-lg pointer-events-none"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
          }}
        />
      )}

      {/* Click blocker (lets clicks pass through to nothing) */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Tooltip */}
      {rect && (
        <div
          ref={tooltipRef}
          className="absolute z-10 bg-sim-surface border border-sim-border rounded-xl p-4 shadow-xl"
          style={tooltipStyle}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-bold text-sm text-white">{currentStep.title}</h3>
            <button
              onClick={onComplete}
              className="shrink-0 p-0.5 text-sim-textMuted hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-sim-textMuted leading-relaxed mb-3">
            {currentStep.description}
          </p>
          <div className="flex items-center justify-between">
            {/* Step dots */}
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === step ? 'bg-nhs-lightBlue' : i < step ? 'bg-nhs-lightBlue/40' : 'bg-sim-border'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isLast
                  ? 'bg-nhs-blue text-white'
                  : 'text-nhs-lightBlue hover:text-white hover:bg-nhs-blue/20'
              }`}
            >
              {isLast ? 'Got it' : 'Next'}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
