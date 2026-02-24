import { useState, useRef, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import gsap from 'gsap';
import type { Prescription, PrescriptionType } from '@dka-sim/shared';

interface Props {
  prescriptionType: PrescriptionType;
  patientWeight: number;
  patientSBP: number;
  lastKnownPotassium?: number;
  onConfirm: (prescription: Prescription) => void;
  onCancel: () => void;
}

export default function PrescriptionInputOverlay({
  prescriptionType,
  patientWeight,
  patientSBP,
  lastKnownPotassium,
  onConfirm,
  onCancel,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

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
        onComplete: onCancel,
      });
    } else {
      onCancel();
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"
      onClick={handleClose}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-lg bg-sim-surface rounded-t-2xl border-t border-sim-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-sim-border rounded-full" />
        </div>

        <div className="px-5 pb-6">
          {prescriptionType === 'iv_fluids' && (
            <FluidInput patientSBP={patientSBP} onConfirm={onConfirm} />
          )}
          {prescriptionType === 'insulin' && (
            <InsulinInput patientWeight={patientWeight} onConfirm={onConfirm} />
          )}
          {prescriptionType === 'potassium' && (
            <PotassiumInput lastKnownPotassium={lastKnownPotassium} onConfirm={onConfirm} />
          )}

          <button
            onClick={handleClose}
            className="w-full mt-3 py-2.5 text-sm text-sim-textMuted hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── IV Fluids ──────────────────────────────────────────────────────────────

function FluidInput({
  patientSBP,
  onConfirm,
}: {
  patientSBP: number;
  onConfirm: (rx: Prescription) => void;
}) {
  const [duration, setDuration] = useState(60);

  return (
    <div>
      <h3 className="font-bold text-base mb-1">Prescribe IV Fluids</h3>
      <p className="text-xs text-sim-textMuted mb-4">
        1000ml 0.9% Sodium Chloride (Bag 1)
      </p>

      <div className="bg-sim-bg rounded-lg p-3 mb-4">
        <div className="text-xs text-sim-textMuted mb-1">Patient context</div>
        <div className="text-sm">
          SBP: <span className="font-mono font-bold text-white">{patientSBP} mmHg</span>
          {patientSBP > 90 ? (
            <span className="text-sim-stable text-xs ml-2">Non-shocked</span>
          ) : (
            <span className="text-nhs-emergency text-xs ml-2">Shocked</span>
          )}
        </div>
      </div>

      <label className="block text-sm font-medium mb-2">
        Infuse over: <span className="text-nhs-lightBlue font-mono font-bold">{duration} minutes</span>
      </label>
      <input
        type="range"
        min={15}
        max={240}
        step={5}
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value))}
        className="w-full accent-nhs-blue"
      />
      <div className="flex justify-between text-[10px] text-sim-textMuted mt-1 mb-4">
        <span>15 min</span>
        <span>240 min</span>
      </div>

      <button
        onClick={() => onConfirm({ type: 'iv_fluids', durationMinutes: duration })}
        className="btn-primary w-full"
      >
        Prescribe — {duration} min
      </button>
    </div>
  );
}

// ─── Insulin ────────────────────────────────────────────────────────────────

function InsulinInput({
  patientWeight,
  onConfirm,
}: {
  patientWeight: number;
  onConfirm: (rx: Prescription) => void;
}) {
  const [rate, setRate] = useState(5.0);

  const adjust = (delta: number) => {
    setRate((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      return Math.max(1.0, Math.min(15.0, next));
    });
  };

  return (
    <div>
      <h3 className="font-bold text-base mb-1">Prescribe Insulin Infusion</h3>
      <p className="text-xs text-sim-textMuted mb-4">
        50 units Actrapid in 50ml 0.9% NaCl (1 unit/ml)
      </p>

      <div className="bg-sim-bg rounded-lg p-3 mb-4 space-y-1">
        <div className="text-xs text-sim-textMuted">Patient context</div>
        <div className="text-sm">
          Weight: <span className="font-mono font-bold text-white">{patientWeight} kg</span>
        </div>
        <div className="text-sm">
          Protocol: <span className="font-mono font-bold text-nhs-lightBlue">0.1 units/kg/hour</span>
        </div>
      </div>

      <label className="block text-sm font-medium mb-2">
        Infusion rate: <span className="text-nhs-lightBlue font-mono font-bold">{rate.toFixed(1)} ml/hr</span>
      </label>
      <input
        type="range"
        min={1.0}
        max={15.0}
        step={0.1}
        value={rate}
        onChange={(e) => setRate(Number(e.target.value))}
        className="w-full accent-nhs-blue"
      />
      <div className="flex justify-between text-[10px] text-sim-textMuted mt-1">
        <span>1.0</span>
        <span>15.0 ml/hr</span>
      </div>

      {/* Fine adjustment buttons */}
      <div className="flex items-center justify-center gap-4 mt-3 mb-4">
        <button
          onClick={() => adjust(-1.0)}
          className="w-10 h-10 rounded-lg bg-sim-bg border border-sim-border flex items-center justify-center hover:border-nhs-blue transition-colors"
        >
          <span className="text-xs font-bold text-sim-textMuted">-1</span>
        </button>
        <button
          onClick={() => adjust(-0.1)}
          className="w-10 h-10 rounded-lg bg-sim-bg border border-sim-border flex items-center justify-center hover:border-nhs-blue transition-colors"
        >
          <Minus className="w-4 h-4 text-sim-textMuted" />
        </button>
        <div className="text-xl font-mono font-bold text-white px-3">
          {rate.toFixed(1)}
        </div>
        <button
          onClick={() => adjust(0.1)}
          className="w-10 h-10 rounded-lg bg-sim-bg border border-sim-border flex items-center justify-center hover:border-nhs-blue transition-colors"
        >
          <Plus className="w-4 h-4 text-sim-textMuted" />
        </button>
        <button
          onClick={() => adjust(1.0)}
          className="w-10 h-10 rounded-lg bg-sim-bg border border-sim-border flex items-center justify-center hover:border-nhs-blue transition-colors"
        >
          <span className="text-xs font-bold text-sim-textMuted">+1</span>
        </button>
      </div>

      <button
        onClick={() => onConfirm({ type: 'insulin', rateMlPerHr: Math.round(rate * 10) / 10 })}
        className="btn-primary w-full"
      >
        Prescribe — {rate.toFixed(1)} ml/hr
      </button>
    </div>
  );
}

// ─── Potassium ──────────────────────────────────────────────────────────────

const K_STEPS = [0, 10, 20, 30, 40];

const K_DESCRIPTIONS: Record<number, string> = {
  0: 'No potassium replacement',
  10: '10 mmol/L KCl — low-dose replacement',
  20: '20 mmol/L KCl — standard replacement (K+ 3.5–5.5)',
  30: '30 mmol/L KCl — moderate replacement',
  40: '40 mmol/L KCl — urgent replacement (K+ < 3.5, senior review)',
};

function PotassiumInput({
  lastKnownPotassium,
  onConfirm,
}: {
  lastKnownPotassium?: number;
  onConfirm: (rx: Prescription) => void;
}) {
  const [concentration, setConcentration] = useState(20);

  const stepUp = () => {
    const idx = K_STEPS.indexOf(concentration);
    if (idx < K_STEPS.length - 1) setConcentration(K_STEPS[idx + 1]);
  };

  const stepDown = () => {
    const idx = K_STEPS.indexOf(concentration);
    if (idx > 0) setConcentration(K_STEPS[idx - 1]);
  };

  return (
    <div>
      <h3 className="font-bold text-base mb-1">Prescribe Potassium Replacement</h3>
      <p className="text-xs text-sim-textMuted mb-4">
        IV Potassium Chloride (KCl) in replacement fluids
      </p>

      <div className="bg-sim-bg rounded-lg p-3 mb-4">
        <div className="text-xs text-sim-textMuted mb-1">Last serum K+ result</div>
        {lastKnownPotassium !== undefined ? (
          <div className="text-sm">
            K+: <span className={`font-mono font-bold ${
              lastKnownPotassium < 3.5
                ? 'text-nhs-emergency'
                : lastKnownPotassium > 5.5
                  ? 'text-sim-concerning'
                  : 'text-sim-stable'
            }`}>
              {lastKnownPotassium} mmol/L
            </span>
            {lastKnownPotassium < 3.5 && (
              <span className="text-nhs-emergency text-xs ml-2">Low — replace urgently</span>
            )}
            {lastKnownPotassium >= 3.5 && lastKnownPotassium <= 5.5 && (
              <span className="text-sim-stable text-xs ml-2">Normal range</span>
            )}
            {lastKnownPotassium > 5.5 && (
              <span className="text-sim-concerning text-xs ml-2">Elevated — do not replace</span>
            )}
          </div>
        ) : (
          <div className="text-sm text-sim-concerning">K+ not yet checked</div>
        )}
      </div>

      <label className="block text-sm font-medium mb-3">
        KCl concentration:{' '}
        <span className="text-nhs-lightBlue font-mono font-bold">{concentration} mmol/L</span>
      </label>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-4 mb-2">
        <button
          onClick={stepDown}
          disabled={concentration === 0}
          className="w-12 h-12 rounded-lg bg-sim-bg border border-sim-border flex items-center justify-center hover:border-nhs-blue transition-colors disabled:opacity-30 disabled:hover:border-sim-border"
        >
          <Minus className="w-5 h-5 text-sim-textMuted" />
        </button>
        <div className="text-3xl font-mono font-bold text-white w-20 text-center">
          {concentration}
        </div>
        <button
          onClick={stepUp}
          disabled={concentration === 40}
          className="w-12 h-12 rounded-lg bg-sim-bg border border-sim-border flex items-center justify-center hover:border-nhs-blue transition-colors disabled:opacity-30 disabled:hover:border-sim-border"
        >
          <Plus className="w-5 h-5 text-sim-textMuted" />
        </button>
      </div>

      <p className="text-xs text-sim-textMuted text-center mb-4">
        {K_DESCRIPTIONS[concentration]}
      </p>

      <button
        onClick={() => onConfirm({ type: 'potassium', concentrationMmol: concentration })}
        className="btn-primary w-full"
      >
        Prescribe — {concentration} mmol/L KCl
      </button>
    </div>
  );
}
