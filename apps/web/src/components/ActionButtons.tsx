import { useRef, useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import { useSessionStore } from '../stores/sessionStore';
import { Search, BarChart3, Phone, Syringe, CheckCircle, Loader, Play } from 'lucide-react';
import gsap from 'gsap';
import type { ActionDefinition } from '@dka-sim/shared';

interface Props {
  patientId: string;
  availableActions: string[];
  completedActions: string[];
  actionDefinitions: ActionDefinition[];
}

type TabCategory = 'investigation' | 'escalation' | 'treatment' | 'monitoring';

const TAB_ICONS: Record<TabCategory, React.ReactNode> = {
  investigation: <Search className="w-4 h-4" />,
  monitoring: <BarChart3 className="w-4 h-4" />,
  escalation: <Phone className="w-4 h-4" />,
  treatment: <Syringe className="w-4 h-4" />,
};

const TABS: { key: TabCategory; label: string }[] = [
  { key: 'investigation', label: 'Investigate' },
  { key: 'monitoring', label: 'Monitor' },
  { key: 'escalation', label: 'Escalate' },
  { key: 'treatment', label: 'Treat' },
];

export default function ActionButtons({
  patientId,
  availableActions,
  completedActions,
  actionDefinitions,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabCategory>('investigation');
  const pendingActions = useSessionStore((s) => s.pendingActions);
  const resources = useSessionStore((s) => s.resources);
  const buttonsRef = useRef<HTMLDivElement>(null);

  const allActions: ActionDefinition[] = actionDefinitions;

  const filteredActions = allActions.filter(
    (a) => a.category === activeTab && availableActions.includes(a.key),
  );

  useEffect(() => {
    if (buttonsRef.current) {
      gsap.fromTo(
        buttonsRef.current.children,
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, stagger: 0.05, ease: 'power2.out' },
      );
    }
  }, [activeTab]);

  const handleAction = (actionKey: string) => {
    // Animate button press
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
        const prereqAction = allActions.find((a) => a.key === prereq);
        return `Requires: ${prereqAction?.label ?? prereq}`;
      }
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Category tabs */}
      <div className="flex gap-1 bg-sim-bg rounded-lg p-1">
        {TABS.map((tab) => {
          const count = allActions.filter(
            (a) => a.category === tab.key && availableActions.includes(a.key),
          ).length;
          if (count === 0) return null;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-nhs-blue text-white'
                  : 'text-sim-textMuted hover:text-white'
              }`}
            >
              <span className="inline-flex">{TAB_ICONS[tab.key]}</span>
              <span className="hidden sm:inline ml-1">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div ref={buttonsRef} className="grid grid-cols-1 gap-2">
        {filteredActions.map((action) => {
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
              className={`relative flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                completed
                  ? 'bg-sim-stable/20 border border-sim-stable/40 text-sim-stable'
                  : pending
                    ? 'bg-nhs-blue/20 border border-nhs-blue/40 text-nhs-lightBlue animate-pulse'
                    : unavailable
                      ? 'bg-sim-bg border border-sim-border text-sim-textMuted opacity-50'
                      : prereqMsg
                        ? 'bg-sim-bg border border-sim-border text-sim-textMuted opacity-60'
                        : 'bg-sim-bg border border-sim-border text-white hover:border-nhs-blue hover:bg-nhs-blue/10 active:scale-[0.98]'
              }`}
            >
              <span className="w-8 flex items-center justify-center shrink-0">
                {completed ? <CheckCircle className="w-5 h-5 text-sim-stable" /> : pending ? <Loader className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{action.label}</div>
                {pending && (
                  <div className="text-xs text-nhs-lightBlue">Processing...</div>
                )}
                {unavailable && (
                  <div className="text-xs text-sim-concerning">Not available</div>
                )}
                {prereqMsg && !completed && !pending && (
                  <div className="text-xs text-sim-textMuted">{prereqMsg}</div>
                )}
                {completed && (
                  <div className="text-xs text-sim-stable">Done</div>
                )}
              </div>
            </button>
          );
        })}
        {filteredActions.length === 0 && (
          <div className="text-center text-sim-textMuted py-4 text-sm">
            No actions available in this category
          </div>
        )}
      </div>
    </div>
  );
}
