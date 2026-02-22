import { useRef, useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { formatSimTime } from '@dka-sim/shared';
import { Play, ClipboardList, TrendingDown, Syringe, Settings } from 'lucide-react';
import gsap from 'gsap';

export default function EventLog() {
  const events = useSessionStore((s) => s.events);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  useEffect(() => {
    if (events.length > lastCountRef.current) {
      // Animate new events
      const container = bottomRef.current?.parentElement;
      if (container) {
        const rows = container.querySelectorAll('.event-row');
        if (rows.length > 0) {
          gsap.fromTo(
            rows[rows.length - 1],
            { x: -20, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.3, ease: 'power2.out' },
          );
        }
      }
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      lastCountRef.current = events.length;
    }
  }, [events.length]);

  const typeIcons: Record<string, React.ReactNode> = {
    action: <Play className="w-3 h-3" />,
    result: <ClipboardList className="w-3 h-3" />,
    deterioration: <TrendingDown className="w-3 h-3" />,
    injection: <Syringe className="w-3 h-3" />,
    system: <Settings className="w-3 h-3" />,
  };

  const typeColors: Record<string, string> = {
    action: 'text-nhs-lightBlue',
    result: 'text-white',
    deterioration: 'text-sim-critical',
    injection: 'text-nhs-warmYellow',
    system: 'text-sim-textMuted',
  };

  // Show last 50 events
  const displayEvents = events.slice(-50);

  return (
    <div className="h-full overflow-auto scrollable text-xs space-y-0.5 p-2">
      {displayEvents.length === 0 && (
        <div className="text-sim-textMuted text-center py-4">No events yet</div>
      )}
      {displayEvents.map((event) => (
        <div
          key={event.id}
          className={`event-row flex gap-2 py-1 px-1 rounded hover:bg-sim-bg ${typeColors[event.type] ?? ''}`}
        >
          <span className="shrink-0 flex items-center">
            {typeIcons[event.type] ?? <span className="w-3 h-3 inline-block text-center">·</span>}
          </span>
          <span className="font-mono text-sim-textMuted shrink-0 w-12">
            {formatSimTime(event.simTimeMs)}
          </span>
          <span className="flex-1 break-words">
            {(event.detail?.message as string) ?? event.type}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
