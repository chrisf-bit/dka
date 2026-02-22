import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { formatSimTime } from '@dka-sim/shared';
import type { ParticipantScore } from '@dka-sim/shared';
import { Play, ClipboardList, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';
import gsap from 'gsap';

export default function Debrief() {
  const navigate = useNavigate();
  const debrief = useSessionStore((s) => s.debrief);
  const reset = useSessionStore((s) => s.reset);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTeamIdx, setActiveTeamIdx] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current.children,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power3.out' },
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
  const scores = debrief.scores;
  const activeScore = scores[activeTeamIdx];

  const timelineEvents = debrief.events
    .filter((e) => e.type === 'action' || e.type === 'result' || e.type === 'deterioration');

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="bg-sim-surface border-b border-sim-border px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-extrabold">Simulation Debrief</h1>
          <p className="text-xs text-sim-textMuted">
            Duration: {formatSimTime(debrief.session.simClockMs)}
          </p>
        </div>
        <button onClick={handleNewSession} className="btn-primary py-2 px-4 text-sm">
          New Session
        </button>
      </div>

      {/* Main content — desktop: two columns, mobile: stacked */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT: Scores */}
        <div className="flex-1 flex flex-col overflow-hidden p-3 lg:p-4">
          {/* Department Score */}
          <div className="bg-sim-surface rounded-xl border border-sim-border p-4 mb-3 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[11px] text-sim-textMuted uppercase tracking-wider">
                  Department Score
                </h2>
                <div className="text-4xl font-extrabold mt-1">
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
                  <span className="text-lg text-sim-textMuted"> / {maxPossible}</span>
                </div>
              </div>
              {/* Patient outcomes mini */}
              <div className="flex gap-2">
                {debrief.patients.map((patient) => (
                  <div key={patient.id} className="text-center">
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded block status-${patient.status}`}
                    >
                      {patient.status}
                    </span>
                    <span className="text-[10px] text-sim-textMuted mt-0.5 block truncate max-w-[60px]">
                      {patient.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Team score navigator */}
          {scores.length > 0 && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Team selector */}
              <div className="flex items-center justify-between mb-2 shrink-0">
                <button
                  onClick={() => setActiveTeamIdx(Math.max(0, activeTeamIdx - 1))}
                  disabled={activeTeamIdx === 0}
                  className="p-1 text-sim-textMuted disabled:opacity-30"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex gap-1.5">
                  {scores.map((s, i) => (
                    <button
                      key={s.userId}
                      onClick={() => setActiveTeamIdx(i)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        i === activeTeamIdx
                          ? 'bg-nhs-blue text-white'
                          : 'bg-sim-bg text-sim-textMuted hover:text-white'
                      }`}
                    >
                      {s.userName}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setActiveTeamIdx(Math.min(scores.length - 1, activeTeamIdx + 1))}
                  disabled={activeTeamIdx === scores.length - 1}
                  className="p-1 text-sim-textMuted disabled:opacity-30"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Active team score card */}
              {activeScore && (
                <TeamScoreCard score={activeScore} />
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Decision Audit Trail — desktop only sidebar, mobile hidden by default */}
        <div className="w-full lg:w-80 xl:w-96 bg-sim-surface border-t lg:border-t-0 lg:border-l border-sim-border flex flex-col overflow-hidden shrink-0">
          <h3 className="text-xs text-sim-textMuted uppercase tracking-wider font-semibold p-3 pb-1 shrink-0">
            Decision Audit Trail
          </h3>
          <div className="flex-1 overflow-auto scrollable px-3 pb-3">
            <div className="space-y-0.5">
              {timelineEvents.map((event) => {
                const icon =
                  event.type === 'action'
                    ? <Play className="w-3 h-3" />
                    : event.type === 'result'
                      ? <ClipboardList className="w-3 h-3" />
                      : <TrendingDown className="w-3 h-3" />;
                const color =
                  event.type === 'deterioration'
                    ? 'text-sim-critical'
                    : event.type === 'result'
                      ? 'text-white'
                      : 'text-nhs-lightBlue';
                return (
                  <div key={event.id} className={`flex gap-2 text-xs py-0.5 ${color}`}>
                    <span className="shrink-0 mt-0.5">{icon}</span>
                    <span className="font-mono text-sim-textMuted w-10 shrink-0">
                      {formatSimTime(event.simTimeMs)}
                    </span>
                    <span className="min-w-0">
                      {event.userName && (
                        <span className="text-sim-textMuted">{event.userName}: </span>
                      )}
                      {(event.detail?.message as string) ?? event.type}
                    </span>
                  </div>
                );
              })}
              {timelineEvents.length === 0 && (
                <p className="text-sim-textMuted text-xs py-4 text-center">No events recorded</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamScoreCard({ score }: { score: ParticipantScore }) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, x: 15 },
        { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' },
      );
    }
  }, [score.userId]);

  return (
    <div ref={cardRef} className="bg-sim-surface rounded-xl border border-sim-border p-4 flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <div className="font-bold">{score.userName}</div>
          <div className="text-xs text-sim-textMuted">{score.patientName}</div>
        </div>
        <div
          className={`text-3xl font-bold ${
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
      <div className="space-y-2 shrink-0">
        <ScoreBar label="Patient Outcome" value={score.patientOutcome} max={40} />
        <ScoreBar label="Recognition" value={score.timeToRecognition} max={20} />
        <ScoreBar label="Escalation" value={score.timeToEscalation} max={15} />
        <ScoreBar label="Treatment" value={score.timeToTreatment} max={15} />
        <ScoreBar label="Actions" value={score.appropriateActions} max={10} />
      </div>

      {/* Actions list */}
      {score.actions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-sim-border flex-1 overflow-auto scrollable">
          <h4 className="text-[10px] text-sim-textMuted uppercase tracking-wider mb-1">Actions Taken</h4>
          <div className="space-y-0.5">
            {score.actions.map((action, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={action.wasAppropriate ? 'text-sim-stable' : 'text-sim-textMuted'}>
                  {action.wasAppropriate ? (
                    <span className="text-sim-stable font-bold">+</span>
                  ) : (
                    <span className="text-sim-textMuted">-</span>
                  )}
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
  }, [pct]);

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
