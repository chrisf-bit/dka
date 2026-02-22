import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import VitalsPanel from '../components/VitalsPanel';
import ActionButtons from '../components/ActionButtons';
import TimerBar from '../components/TimerBar';
import ActionResultOverlay from '../components/ActionResultOverlay';
import { Activity, ClipboardList, Zap, Loader } from 'lucide-react';
import gsap from 'gsap';

type Tab = 'vitals' | 'history' | 'actions';

export default function PatientView() {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const myPatient = useSessionStore((s) => s.myPatient);
  const actionDefinitions = useSessionStore((s) => s.actionDefinitions);
  const debrief = useSessionStore((s) => s.debrief);
  const actionResults = useSessionStore((s) => s.actionResults);
  const clearActionResult = useSessionStore((s) => s.clearActionResult);
  const [activeTab, setActiveTab] = useState<Tab>('vitals');
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

  // Animate tab change
  useEffect(() => {
    const panel = document.getElementById('tab-content');
    if (panel) {
      gsap.fromTo(
        panel,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' },
      );
    }
  }, [activeTab]);

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

  // Get latest action result to show overlay
  const latestResult = Array.from(actionResults.entries()).pop();

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      {/* Header: timer + patient name + status */}
      <div className="bg-sim-surface border-b border-sim-border px-4 py-2 flex items-center justify-between shrink-0">
        <div>
          <div className="font-bold text-base">{patient.name}</div>
          <div className="text-xs text-sim-textMuted">
            {patient.age}y • {patient.parity} • {patient.gestation} weeks
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-bold uppercase px-2 py-1 rounded status-${patient.status}`}
          >
            {statusLabel[patient.status]}
          </span>
          <TimerBar />
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex bg-sim-surface border-b border-sim-border shrink-0">
        {(['vitals', 'history', 'actions'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-white border-b-2 border-nhs-blue'
                : 'text-sim-textMuted'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab === 'vitals' ? <><Activity className="w-4 h-4" /> Vitals</> : tab === 'history' ? <><ClipboardList className="w-4 h-4" /> Info</> : <><Zap className="w-4 h-4" /> Actions</>}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div id="tab-content" className="flex-1 overflow-auto p-4">
        {activeTab === 'vitals' && (
          <div className="space-y-4">
            <VitalsPanel vitals={patient.currentVitals} status={patient.status} />

            {/* CTG Summary */}
            <div className="card">
              <h3 className="text-xs text-sim-textMuted uppercase tracking-wider mb-1">
                CTG Summary
              </h3>
              <p className="text-sm">{patient.ctgSummary}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-sim-textMuted">Fetal status:</span>
                <span
                  className={`text-xs font-medium ${
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
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="card">
              <h3 className="text-xs text-sim-textMuted uppercase tracking-wider mb-1">
                Presenting Complaint
              </h3>
              <p className="text-sm">{patient.presentingComplaint}</p>
            </div>
            <div className="card">
              <h3 className="text-xs text-sim-textMuted uppercase tracking-wider mb-1">
                History
              </h3>
              <p className="text-sm">{patient.history}</p>
            </div>
            <div className="card">
              <h3 className="text-xs text-sim-textMuted uppercase tracking-wider mb-1">
                Past Medical History
              </h3>
              <p className="text-sm">{patient.pmh}</p>
            </div>
            <div className="card">
              <h3 className="text-xs text-sim-textMuted uppercase tracking-wider mb-1">
                Allergies
              </h3>
              <p className="text-sm">{patient.allergies}</p>
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <ActionButtons
            patientId={patient.id}
            availableActions={patient.availableActions}
            completedActions={patient.completedActions}
            actionDefinitions={actionDefinitions}
          />
        )}
      </div>

      {/* Action result overlay */}
      {latestResult && (
        <ActionResultOverlay
          result={latestResult[1] as Record<string, unknown>}
          onDismiss={() => clearActionResult(latestResult[0])}
        />
      )}
    </div>
  );
}
