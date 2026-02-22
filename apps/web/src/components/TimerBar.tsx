import { useSessionStore } from '../stores/sessionStore';
import { formatSimTime } from '@dka-sim/shared';
import { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface Props {
  showControls?: boolean;
}

export default function TimerBar({ showControls }: Props) {
  const simClockMs = useSessionStore((s) => s.simClockMs);
  const session = useSessionStore((s) => s.session);
  const timerRef = useRef<HTMLSpanElement>(null);
  const prevClockRef = useRef(0);

  useEffect(() => {
    if (timerRef.current && simClockMs !== prevClockRef.current) {
      gsap.fromTo(
        timerRef.current,
        { opacity: 0.6 },
        { opacity: 1, duration: 0.3, ease: 'power1.out' },
      );
      prevClockRef.current = simClockMs;
    }
  }, [simClockMs]);

  const isRunning = session?.status === 'running';
  const isPaused = session?.status === 'paused';

  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-2 h-2 rounded-full ${
          isRunning ? 'bg-sim-stable animate-pulse' : isPaused ? 'bg-sim-concerning' : 'bg-sim-textMuted'
        }`}
      />
      <span
        ref={timerRef}
        className="font-mono text-2xl font-bold tabular-nums text-white"
      >
        {formatSimTime(simClockMs)}
      </span>
      {isPaused && (
        <span className="text-xs text-sim-concerning font-medium uppercase tracking-wider">
          Paused
        </span>
      )}
    </div>
  );
}
