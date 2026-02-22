import { useRef, useEffect } from 'react';
import { socket } from '../lib/socket';
import { useSessionStore } from '../stores/sessionStore';
import { Search, BarChart3, Phone, Syringe, CheckCircle, Loader, Play } from 'lucide-react';
import gsap from 'gsap';
import type { ActionDefinition, ActionCategory } from '@dka-sim/shared';

interface Props {
  patientId: string;
  availableActions: string[];
  completedActions: string[];
  actionDefinitions: ActionDefinition[];
}

const CATEGORY_META: Record<ActionCategory, { label: string; icon: React.ReactNode }> = {
  investigation: { label: 'Investigate', icon: <Search className="w-3.5 h-3.5" /> },
  monitoring: { label: 'Monitor', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  escalation: { label: 'Escalate', icon: <Phone className="w-3.5 h-3.5" /> },
  treatment: { label: 'Treat', icon: <Syringe className="w-3.5 h-3.5" /> },
};

const CATEGORY_ORDER: ActionCategory[] = ['investigation', 'monitoring', 'escalation', 'treatment'];

export default function ActionButtons({
  patientId,
  availableActions,
  completedActions,
  actionDefinitions,
}: Props) {
  const pendingActions = useSessionStore((s) => s.pendingActions);
  const resources = useSessionStore((s) => s.resources);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      gsap.fromTo(
        listRef.current.children,
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.25, stagger: 0.03, ease: 'power2.out' },
      );
    }
  }, []);

  const handleAction = (actionKey: string) => {
    const btn = document.querySelector(`[data-action="${actionKey}"]`);
    if (btn) {
      gsap.fromTo(
        btn,
        { scale: 0.95 },
        { scale: 1, duration: 0.3, ease: 'elastic.out(1, 0.5)' },
      );
    }
    socket.emit('action:submit', { patientId, actionKey });
  };

  const isCompleted = (key: string) => completedActions.includes(key);
  const isPending = (key: string) => pendingActions.has(`${patientId}:${key}`);

  const isUnavailable = (key: string) => {
    if (key === 'check_ketones' && !resources.ketometerAvailable) return true;
    return false;
  };

  const getPrereqLabel = (action: ActionDefinition): string | null => {
    for (const prereq of action.prerequisites) {
      if (!completedActions.includes(prereq)) {
        const prereqAction = actionDefinitions.find((a) => a.key === prereq);
        return `Requires: ${prereqAction?.label ?? prereq}`;
      }
    }
    return null;
  };

  // Group actions by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    actions: actionDefinitions.filter(
      (a) => a.category === cat && availableActions.includes(a.key),
    ),
  })).filter((g) => g.actions.length > 0);

  return (
    <div ref={listRef} className="space-y-3">
      {grouped.map(({ category, actions }) => {
        const meta = CATEGORY_META[category];
        const completedCount = actions.filter((a) => isCompleted(a.key)).length;
        return (
          <div key={category}>
            {/* Category header */}
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className="text-nhs-lightBlue">{meta.icon}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sim-textMuted">
                {meta.label}
              </span>
              <span className="text-[10px] text-sim-textMuted ml-auto">
                {completedCount}/{actions.length}
              </span>
            </div>

            {/* Actions in this category */}
            <div className="space-y-1.5">
              {actions.map((action) => {
                const completed = isCompleted(action.key);
                const pending = isPending(action.key);
                const unavailable = isUnavailable(action.key);
                const prereqMsg = getPrereqLabel(action);
                const disabled = completed || pending || unavailable || !!prereqMsg;

                return (
                  <button
                    key={action.key}
                    data-action={action.key}
                    onClick={() => !disabled && handleAction(action.key)}
                    disabled={disabled}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${
                      completed
                        ? 'bg-sim-stable/15 border border-sim-stable/30 text-sim-stable'
                        : pending
                          ? 'bg-nhs-blue/15 border border-nhs-blue/30 text-nhs-lightBlue animate-pulse'
                          : unavailable
                            ? 'bg-sim-bg border border-sim-border text-sim-textMuted opacity-50'
                            : prereqMsg
                              ? 'bg-sim-bg border border-sim-border text-sim-textMuted opacity-60'
                              : 'bg-sim-bg border border-sim-border text-white hover:border-nhs-blue hover:bg-nhs-blue/10 active:scale-[0.98]'
                    }`}
                  >
                    <span className="w-6 flex items-center justify-center shrink-0">
                      {completed ? (
                        <CheckCircle className="w-4 h-4 text-sim-stable" />
                      ) : pending ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{action.label}</div>
                      {pending && (
                        <div className="text-[11px] text-nhs-lightBlue">Processing...</div>
                      )}
                      {unavailable && (
                        <div className="text-[11px] text-sim-concerning">Not available</div>
                      )}
                      {prereqMsg && !completed && !pending && (
                        <div className="text-[11px] text-sim-textMuted">{prereqMsg}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {grouped.length === 0 && (
        <div className="text-center text-sim-textMuted py-4 text-sm">
          No actions available yet
        </div>
      )}
    </div>
  );
}
