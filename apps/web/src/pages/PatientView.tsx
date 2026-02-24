import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { socket } from '../lib/socket';
import VitalsPanel from '../components/VitalsPanel';
import ActionButtons from '../components/ActionButtons';
import TimerBar from '../components/TimerBar';
import ActionResultOverlay from '../components/ActionResultOverlay';
import PatientInfoOverlay from '../components/PatientInfoOverlay';
import ResultsLogOverlay from '../components/ResultsLogOverlay';
import PrescriptionInputOverlay from '../components/PrescriptionInputOverlay';
import { Loader, FileText, ClipboardList } from 'lucide-react';
import gsap from 'gsap';
import type { PrescriptionType, Prescription } from '@dka-sim/shared';

export default function PatientView() {
  const navigate = useNavigate();
  const myPatient = useSessionStore((s) => s.myPatient);
  const actionDefinitions = useSessionStore((s) => s.actionDefinitions);
  const debrief = useSessionStore((s) => s.debrief);
  const actionResults = useSessionStore((s) => s.actionResults);
  const clearActionResult = useSessionStore((s) => s.clearActionResult);
  const completedResults = useSessionStore((s) => s.completedResults);
  const [showInfo, setShowInfo] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [prescriptionAction, setPrescriptionAction] = useState<{
    actionKey: string;
    prescriptionType: PrescriptionType;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const patient = myPatient();

  useEffect(() => {
    if (debrief) {
      navigate('/debrief');
    }
  }, [debrief, navigate]);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'power2.out' },
      );
    }
  }, []);

  const handlePrescriptionRequired = useCallback(
    (actionKey: string, prescriptionType: PrescriptionType) => {
      setPrescriptionAction({ actionKey, prescriptionType });
    },
    [],
  );

  const handlePrescriptionConfirm = useCallback(
    (prescription: Prescription) => {
      if (!prescriptionAction || !patient) return;
      socket.emit('action:submit', {
        patientId: patient.id,
        actionKey: prescriptionAction.actionKey,
        prescription,
      });
      setPrescriptionAction(null);
    },
    [prescriptionAction, patient],
  );

  if (!patient) {
    return (
      <div className="h-full flex items-center justify-center text-sim-textMuted">
        <div className="text-center">
          <Loader className="w-10 h-10 mx-auto mb-3 animate-spin text-nhs-lightBlue" />
          <p>No patient assigned yet</p>
        </div>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    stable: 'Stable',
    concerning: 'Concerning',
    critical: 'CRITICAL',
    collapsed: 'COLLAPSED',
    resolved: 'Resolved',
  };

  const latestResult = Array.from(actionResults.entries()).pop();
  const totalActions = patient.availableActions.length;
  const doneActions = patient.completedActions.length;

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      {/* Header: patient name + status + info button + timer */}
      <div className="bg-sim-surface border-b border-sim-border px-3 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{patient.name}</div>
            <div className="text-[11px] text-sim-textMuted">
              {patient.age}y &middot; {patient.gestation} &middot; {patient.weight}kg
            </div>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="shrink-0 p-1.5 rounded-lg bg-sim-surfaceLight hover:bg-nhs-blue/20 transition-colors"
            title="Patient info"
          >
            <FileText className="w-4 h-4 text-nhs-lightBlue" />
          </button>
          <button
            onClick={() => setShowResults(true)}
            className="shrink-0 p-1.5 rounded-lg bg-sim-surfaceLight hover:bg-nhs-blue/20 transition-colors relative"
            title="Results log"
          >
            <ClipboardList className="w-4 h-4 text-nhs-lightBlue" />
            {completedResults.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-nhs-blue text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {completedResults.length}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded status-${patient.status}`}
          >
            {statusLabel[patient.status]}
          </span>
          <TimerBar />
        </div>
      </div>

      {/* Vitals strip — compact */}
      <div className="bg-sim-surface/50 border-b border-sim-border px-3 py-2 shrink-0">
        <VitalsPanel vitals={patient.currentVitals} status={patient.status} compact />
      </div>

      {/* Progress bar */}
      <div className="bg-sim-surface border-b border-sim-border px-3 py-1.5 flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-sim-textMuted uppercase tracking-wider">Progress</span>
        <div className="flex-1 h-1.5 bg-sim-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-nhs-lightBlue rounded-full transition-all duration-500"
            style={{ width: totalActions > 0 ? `${(doneActions / totalActions) * 100}%` : '0%' }}
          />
        </div>
        <span className="text-[10px] text-sim-textMuted font-mono">{doneActions}/{totalActions}</span>
      </div>

      {/* Actions — flat categorised list */}
      <div className="flex-1 overflow-auto scrollable p-3">
        <ActionButtons
          patientId={patient.id}
          isDKA={patient.isDKA}
          availableActions={patient.availableActions}
          completedActions={patient.completedActions}
          actionDefinitions={actionDefinitions}
          onPrescriptionRequired={handlePrescriptionRequired}
        />
      </div>

      {/* Action result overlay */}
      {latestResult && (
        <ActionResultOverlay
          result={latestResult[1] as Record<string, unknown>}
          onDismiss={() => clearActionResult(latestResult[0])}
        />
      )}

      {/* Patient info bottom sheet */}
      {showInfo && (
        <PatientInfoOverlay patient={patient} onClose={() => setShowInfo(false)} />
      )}

      {/* Results log bottom sheet */}
      {showResults && (
        <ResultsLogOverlay onClose={() => setShowResults(false)} />
      )}

      {/* Prescription input overlay */}
      {prescriptionAction && (
        <PrescriptionInputOverlay
          prescriptionType={prescriptionAction.prescriptionType}
          patientWeight={patient.weight}
          patientSBP={patient.currentVitals.bpSystolic}
          lastKnownPotassium={patient.lastKnownPotassium}
          onConfirm={handlePrescriptionConfirm}
          onCancel={() => setPrescriptionAction(null)}
        />
      )}
    </div>
  );
}
