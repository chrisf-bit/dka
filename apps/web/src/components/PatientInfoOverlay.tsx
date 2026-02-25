import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import gsap from 'gsap';
import { useSheetDrag } from '../hooks/useSheetDrag';
import type { Patient } from '@dka-sim/shared';

interface Props {
  patient: Patient;
  onClose: () => void;
}

export default function PatientInfoOverlay({ patient, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
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
            <h2 className="font-bold text-base">{patient.name}</h2>
            <p className="text-xs text-sim-textMuted">
              {patient.age}y &middot; {patient.parity} &middot; {patient.gestation} &middot; {patient.height}cm / {patient.weight}kg
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-sim-surfaceLight transition-colors"
          >
            <X className="w-5 h-5 text-sim-textMuted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto scrollable p-4 space-y-3">
          <InfoSection title="Presenting Complaint" text={patient.presentingComplaint} />
          <InfoSection title="History" text={patient.history} />
          <InfoSection title="Past Medical History" text={patient.pmh} />
          <InfoSection title="Allergies" text={patient.allergies} />
          <InfoSection title="CTG Summary" text={patient.ctgSummary} />
          <div className="bg-sim-bg rounded-lg p-3">
            <h4 className="text-[10px] text-sim-textMuted uppercase tracking-wider mb-1">Fetal Status</h4>
            <span
              className={`text-sm font-medium ${
                patient.fetalStatus === 'reassuring'
                  ? 'text-sim-stable'
                  : patient.fetalStatus === 'non_reassuring'
                    ? 'text-sim-concerning'
                    : 'text-sim-critical'
              }`}
            >
              {patient.fetalStatus.replace('_', '-')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoSection({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-sim-bg rounded-lg p-3">
      <h4 className="text-[10px] text-sim-textMuted uppercase tracking-wider mb-1">{title}</h4>
      <p className="text-sm text-white leading-relaxed">{text}</p>
    </div>
  );
}
