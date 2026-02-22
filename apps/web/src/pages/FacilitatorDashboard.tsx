import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { socket } from '../lib/socket';
import PatientCard from '../components/PatientCard';
import EventLog from '../components/EventLog';
import ResourcePanel from '../components/ResourcePanel';
import TimerBar from '../components/TimerBar';
import { Pause, Play, Square } from 'lucide-react';
import gsap from 'gsap';

export default function FacilitatorDashboard() {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const patients = useSessionStore((s) => s.patients);
  const users = useSessionStore((s) => s.users);
  const debrief = useSessionStore((s) => s.debrief);
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
  const [injectMessage, setInjectMessage] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debrief) {
      navigate('/debrief');
    }
  }, [debrief, navigate]);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current.children,
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: 'power2.out' },
      );
    }
  }, []);

  const handlePause = () => {
    if (session) socket.emit('facilitator:pause', { sessionId: session.id });
  };

  const handleResume = () => {
    if (session) socket.emit('facilitator:resume', { sessionId: session.id });
  };

  const handleEnd = () => {
    if (session && confirm('End the simulation? This cannot be undone.')) {
      socket.emit('facilitator:end', { sessionId: session.id });
    }
  };

  const handleInject = () => {
    if (session && injectMessage.trim()) {
      socket.emit('facilitator:inject', {
        sessionId: session.id,
        event: { type: 'message', message: injectMessage.trim() },
      });
      setInjectMessage('');
    }
  };

  const participants = users.filter((u) => u.role === 'participant');
  const arrivedPatients = patients.filter((p) => p.hasArrived);

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      {/* Top bar: controls */}
      <div className="bg-sim-surface border-b border-sim-border px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold hidden md:block">Delivery Suite Dashboard</h1>
          <TimerBar />
        </div>
        <div className="flex items-center gap-2">
          {session?.status === 'running' && (
            <button onClick={handlePause} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5">
              <Pause className="w-4 h-4" /> Pause
            </button>
          )}
          {session?.status === 'paused' && (
            <button onClick={handleResume} className="btn-primary py-1.5 px-3 text-sm flex items-center gap-1.5">
              <Play className="w-4 h-4" /> Resume
            </button>
          )}
          <button onClick={handleEnd} className="btn-danger py-1.5 px-3 text-sm flex items-center gap-1.5">
            <Square className="w-4 h-4" /> End
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Patient cards */}
        <div className="flex-1 p-3 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {arrivedPatients.map((patient) => {
              const assignedUser = participants.find(
                (u) => u.assignedPatientId === patient.id,
              );
              return (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  assignedUser={assignedUser}
                  expanded={expandedPatient === patient.id}
                  onClick={() =>
                    setExpandedPatient(
                      expandedPatient === patient.id ? null : patient.id,
                    )
                  }
                />
              );
            })}
          </div>
        </div>

        {/* Right sidebar: event log + resources + inject */}
        <div className="w-72 xl:w-80 bg-sim-surface border-l border-sim-border flex flex-col overflow-hidden shrink-0 hidden md:flex">
          {/* Resources */}
          <div className="p-3 border-b border-sim-border shrink-0">
            <ResourcePanel />
          </div>

          {/* Event injector */}
          <div className="p-3 border-b border-sim-border shrink-0">
            <h3 className="text-xs text-sim-textMuted uppercase tracking-wider font-semibold mb-2">
              Inject Event
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={injectMessage}
                onChange={(e) => setInjectMessage(e.target.value)}
                placeholder="Message to all..."
                className="input-field text-sm py-1.5"
                onKeyDown={(e) => e.key === 'Enter' && handleInject()}
              />
              <button
                onClick={handleInject}
                disabled={!injectMessage.trim()}
                className="btn-secondary py-1.5 px-3 text-sm shrink-0"
              >
                Send
              </button>
            </div>
          </div>

          {/* Event log */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <h3 className="text-xs text-sim-textMuted uppercase tracking-wider font-semibold p-3 pb-1">
              Event Log
            </h3>
            <div className="flex-1 overflow-hidden">
              <EventLog />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
