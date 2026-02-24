import { useSessionStore } from '../stores/sessionStore';
import { useRef, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, Zap, Info, X } from 'lucide-react';
import gsap from 'gsap';

export default function AlertBanner() {
  const alerts = useSessionStore((s) => s.alerts);
  const dismissAlert = useSessionStore((s) => s.dismissAlert);
  const hasCompletedTutorial = useSessionStore((s) => s.hasCompletedTutorial);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    // Only animate when a new alert is ADDED, not when one is dismissed
    if (containerRef.current && alerts.length > prevLengthRef.current) {
      const latest = containerRef.current.firstElementChild;
      if (latest) {
        gsap.fromTo(
          latest,
          { y: -40, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' },
        );
        // Pulse effect for critical
        const alert = alerts[0];
        if (alert.severity === 'critical' || alert.severity === 'high') {
          gsap.to(latest, {
            boxShadow: '0 0 20px rgba(220, 38, 38, 0.5)',
            duration: 0.5,
            yoyo: true,
            repeat: 2,
            ease: 'power1.inOut',
          });
        }
      }
    }
    prevLengthRef.current = alerts.length;
  }, [alerts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (alerts.length === 0 || !hasCompletedTutorial) return null;

  const severityClasses: Record<string, string> = {
    critical: 'bg-nhs-emergency/95 border-red-400',
    high: 'bg-nhs-emergency/80 border-red-400',
    medium: 'bg-nhs-orange/80 border-nhs-warmYellow',
    info: 'bg-nhs-blue/80 border-nhs-lightBlue',
    low: 'bg-sim-surfaceLight border-sim-border',
  };

  return (
    <div
      ref={containerRef}
      className="fixed top-8 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[90vw] max-w-lg pointer-events-none"
    >
      {alerts.slice(0, 3).map((alert) => (
        <div
          key={alert.id}
          className={`pointer-events-auto rounded-lg border px-4 py-3 flex items-center gap-3 text-white text-sm font-medium shadow-lg ${severityClasses[alert.severity] ?? severityClasses.low}`}
        >
          <span className="shrink-0">
            {alert.severity === 'critical'
              ? <ShieldAlert className="w-5 h-5" />
              : alert.severity === 'high'
                ? <AlertTriangle className="w-5 h-5" />
                : alert.severity === 'medium'
                  ? <Zap className="w-5 h-5" />
                  : <Info className="w-5 h-5" />}
          </span>
          <span className="flex-1">{alert.message}</span>
          <button
            onClick={() => dismissAlert(alert.id)}
            className="text-white/70 hover:text-white text-lg leading-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
