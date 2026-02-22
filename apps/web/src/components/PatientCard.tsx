import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import type { Patient, User } from '@dka-sim/shared';
import VitalsPanel from './VitalsPanel';

interface Props {
  patient: Patient;
  assignedUser?: User;
  expanded?: boolean;
  onClick?: () => void;
}

export default function PatientCard({ patient, assignedUser, expanded, onClick }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = useRef(patient.status);

  useEffect(() => {
    if (patient.status !== prevStatusRef.current && cardRef.current) {
      const borderColor =
        patient.status === 'collapsed'
          ? '#dc2626'
          : patient.status === 'critical'
            ? '#ef4444'
            : patient.status === 'concerning'
              ? '#f59e0b'
              : '#22c55e';

      gsap.to(cardRef.current, {
        borderColor,
        duration: 0.5,
        ease: 'power2.out',
      });

      if (patient.status === 'critical' || patient.status === 'collapsed') {
        gsap.to(cardRef.current, {
          keyframes: [
            { x: -3, duration: 0.06 },
            { x: 3, duration: 0.06 },
            { x: -3, duration: 0.06 },
            { x: 3, duration: 0.06 },
            { x: 0, duration: 0.06 },
          ],
        });
      }

      prevStatusRef.current = patient.status;
    }
  }, [patient.status]);

  const statusColors: Record<string, string> = {
    stable: 'border-sim-stable bg-green-950/20',
    concerning: 'border-sim-concerning bg-yellow-950/20',
    critical: 'border-sim-critical bg-red-950/30',
    collapsed: 'border-red-500 bg-red-950/40',
    resolved: 'border-nhs-lightBlue bg-blue-950/20',
  };

  const statusBadge: Record<string, string> = {
    stable: 'bg-sim-stable/20 text-sim-stable',
    concerning: 'bg-sim-concerning/20 text-sim-concerning',
    critical: 'bg-sim-critical/20 text-sim-critical',
    collapsed: 'bg-red-500/20 text-red-300 animate-pulse-alert',
    resolved: 'bg-nhs-lightBlue/20 text-nhs-lightBlue',
  };

  const totalActions = patient.availableActions.length;
  const doneActions = patient.completedActions.length;
  const pendingCount = patient.pendingActions.length;
  const progressPct = totalActions > 0 ? (doneActions / totalActions) * 100 : 0;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={`rounded-xl border-2 p-3 transition-all cursor-pointer hover:shadow-lg ${
        statusColors[patient.status] ?? 'border-sim-border bg-sim-surface'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-bold text-sm">{patient.name}</div>
          <div className="text-xs text-sim-textMuted">
            {patient.age}y &middot; {patient.parity} &middot; {patient.gestation}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {assignedUser && (
            <span className="text-xs bg-nhs-blue/30 text-nhs-lightBlue px-2 py-0.5 rounded">
              {assignedUser.name}
            </span>
          )}
          <span
            className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
              statusBadge[patient.status] ?? ''
            }`}
          >
            {patient.status}
          </span>
        </div>
      </div>

      {/* Brief complaint */}
      {!expanded && (
        <p className="text-xs text-sim-textMuted line-clamp-1 mb-2">
          {patient.presentingComplaint}
        </p>
      )}

      {/* Vitals mini or full */}
      <VitalsPanel vitals={patient.currentVitals} status={patient.status} compact={!expanded} />

      {/* Action progress bar */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-sim-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-nhs-lightBlue rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-[10px] text-sim-textMuted font-mono shrink-0">
          {doneActions}/{totalActions}
        </span>
        {pendingCount > 0 && (
          <span className="text-[10px] text-nhs-lightBlue animate-pulse">
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Expanded: CTG + actions detail */}
      {expanded && (
        <div className="mt-3 space-y-2">
          <div className="bg-sim-bg rounded-lg p-2">
            <span className="text-xs text-sim-textMuted">CTG: </span>
            <span className="text-xs">{patient.ctgSummary}</span>
          </div>
          <div className="bg-sim-bg rounded-lg p-2">
            <span className="text-xs text-sim-textMuted">Fetal: </span>
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
          {patient.completedActions.length > 0 && (
            <div className="bg-sim-bg rounded-lg p-2">
              <span className="text-xs text-sim-textMuted">Completed: </span>
              <span className="text-xs text-sim-stable">
                {patient.completedActions.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
