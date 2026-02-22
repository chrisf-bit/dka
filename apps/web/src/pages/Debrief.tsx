import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { formatSimTime } from '@dka-sim/shared';
import { Play, ClipboardList, TrendingDown } from 'lucide-react';
import gsap from 'gsap';

export default function Debrief() {
  const navigate = useNavigate();
  const debrief = useSessionStore((s) => s.debrief);
  const reset = useSessionStore((s) => s.reset);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Staggered reveal of debrief sections
      gsap.fromTo(
        containerRef.current.children,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.15, ease: 'power3.out' },
      );
    }
  }, []);

  if (!debrief) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-sim-textMuted">No debrief data available</p>
          <button
            onClick={() => {
              reset();
              navigate('/');
            }}
            className="btn-primary mt-4"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const handleNewSession = () => {
    reset();
    navigate('/');
  };

  const maxPossible = 100;

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div ref={containerRef} className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold">Simulation Debrief</h1>
          <p className="text-sim-textMuted mt-1">
            Duration: {formatSimTime(debrief.session.simClockMs)}
          </p>
        </div>

        {/* Team Score */}
        <div className="card text-center">
          <h2 className="text-sm text-sim-textMuted uppercase tracking-wider">Team Score</h2>
          <div className="text-5xl font-extrabold mt-2">
            <span
              className={
                debrief.teamScore >= 70
                  ? 'text-sim-stable'
                  : debrief.teamScore >= 40
                    ? 'text-sim-concerning'
                    : 'text-sim-critical'
              }
            >
              {debrief.teamScore}
            </span>
            <span className="text-xl text-sim-textMuted"> / {maxPossible}</span>
          </div>
        </div>

        {/* Individual Scores */}
        <div>
          <h2 className="text-lg font-bold mb-3">Individual Performance</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {debrief.scores.map((score) => (
              <div key={score.userId} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold">{score.userName}</div>
                    <div className="text-xs text-sim-textMuted">{score.patientName}</div>
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      score.total >= 70
                        ? 'text-sim-stable'
                        : score.total >= 40
                          ? 'text-sim-concerning'
                          : 'text-sim-critical'
                    }`}
                  >
                    {score.total}
                  </div>
                </div>

                {/* Score breakdown */}
                <div className="space-y-1.5">
                  <ScoreBar label="Patient Outcome" value={score.patientOutcome} max={40} />
                  <ScoreBar label="Time to Recognition" value={score.timeToRecognition} max={20} />
                  <ScoreBar label="Time to Escalation" value={score.timeToEscalation} max={15} />
                  <ScoreBar label="Time to Treatment" value={score.timeToTreatment} max={15} />
                  <ScoreBar label="Appropriate Actions" value={score.appropriateActions} max={10} />
                </div>

                {/* Actions timeline */}
                {score.actions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-sim-border">
                    <h4 className="text-xs text-sim-textMuted uppercase mb-1">Actions</h4>
                    <div className="space-y-0.5">
                      {score.actions.map((action, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className={action.wasAppropriate ? 'text-sim-stable' : 'text-sim-textMuted'}>
                            {action.wasAppropriate ? '✓' : '○'}
                          </span>
                          <span className="font-mono text-sim-textMuted w-10">
                            {formatSimTime(action.simTimeMs)}
                          </span>
                          <span>{action.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Patient Outcomes */}
        <div>
          <h2 className="text-lg font-bold mb-3">Patient Outcomes</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {debrief.patients.map((patient) => (
              <div key={patient.id} className="card">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm">{patient.name}</div>
                  <span
                    className={`text-xs font-bold uppercase px-2 py-0.5 rounded status-${patient.status}`}
                  >
                    {patient.status}
                  </span>
                </div>
                <div className="text-xs text-sim-textMuted mt-1">
                  {patient.gestation} • {patient.presentingComplaint.slice(0, 60)}...
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-sim-textMuted">Fetal:</span>
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
            ))}
          </div>
        </div>

        {/* Decision Timeline */}
        <div>
          <h2 className="text-lg font-bold mb-3">Decision Timeline</h2>
          <div className="card overflow-auto scrollable max-h-60">
            <div className="space-y-1">
              {debrief.events
                .filter((e) => e.type === 'action' || e.type === 'result' || e.type === 'deterioration')
                .map((event) => {
                  const icon =
                    event.type === 'action'
                      ? <Play className="w-3 h-3 inline" />
                      : event.type === 'result'
                        ? <ClipboardList className="w-3 h-3 inline" />
                        : <TrendingDown className="w-3 h-3 inline" />;
                  const color =
                    event.type === 'deterioration'
                      ? 'text-sim-critical'
                      : event.type === 'result'
                        ? 'text-white'
                        : 'text-nhs-lightBlue';
                  return (
                    <div key={event.id} className={`flex gap-2 text-xs py-0.5 ${color}`}>
                      <span>{icon}</span>
                      <span className="font-mono text-sim-textMuted w-10 shrink-0">
                        {formatSimTime(event.simTimeMs)}
                      </span>
                      <span>{(event.detail?.message as string) ?? event.type}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* New session button */}
        <div className="text-center pb-8">
          <button onClick={handleNewSession} className="btn-primary text-lg px-8 py-4">
            New Session
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const barRef = useRef<HTMLDivElement>(null);
  const pct = Math.round((value / max) * 100);

  useEffect(() => {
    if (barRef.current) {
      gsap.fromTo(
        barRef.current,
        { width: 0 },
        { width: `${pct}%`, duration: 0.8, delay: 0.3, ease: 'power2.out' },
      );
    }
  }, []);

  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-sim-textMuted">{label}</span>
        <span className="font-mono">
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 bg-sim-bg rounded-full overflow-hidden">
        <div
          ref={barRef}
          className={`h-full rounded-full ${
            pct >= 70 ? 'bg-sim-stable' : pct >= 40 ? 'bg-sim-concerning' : 'bg-sim-critical'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
