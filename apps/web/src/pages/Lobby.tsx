import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { socket } from '../lib/socket';
import QRCodeDisplay from '../components/QRCodeDisplay';
import BriefingCards from '../components/BriefingCards';
import { Clock, BookOpen } from 'lucide-react';
import gsap from 'gsap';

export default function Lobby() {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const users = useSessionStore((s) => s.users);
  const patients = useSessionStore((s) => s.patients);
  const scenario = useSessionStore((s) => s.scenario);
  const myUser = useSessionStore((s) => s.myUser);
  const hasDismissedBriefing = useSessionStore((s) => s.hasDismissedBriefing);
  const dismissBriefing = useSessionStore((s) => s.dismissBriefing);
  const containerRef = useRef<HTMLDivElement>(null);

  const isFacilitator = myUser()?.role === 'facilitator';
  const participants = users.filter((u) => u.role === 'participant');

  useEffect(() => {
    if (session?.status === 'running' || session?.status === 'paused') {
      navigate('/sim');
    }
    if (session?.status === 'ended') {
      navigate('/debrief');
    }
  }, [session?.status, navigate]);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current.children,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power2.out' },
      );
    }
  }, []);

  // Animate new participants joining
  useEffect(() => {
    const els = document.querySelectorAll('.participant-row');
    if (els.length > 0) {
      gsap.fromTo(
        els[els.length - 1],
        { x: -20, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, ease: 'power2.out' },
      );
    }
  }, [participants.length]);

  const handleAutoAssign = () => {
    if (session) {
      socket.emit('facilitator:autoAssign', { sessionId: session.id });
    }
  };

  const handleAssign = (userId: string, patientId: string) => {
    socket.emit('facilitator:assignPatient', { userId, patientId });
  };

  const handleStart = () => {
    if (session) {
      socket.emit('facilitator:start', { sessionId: session.id });
    }
  };

  const allAssigned = participants.every((u) => u.assignedPatientId);
  const joinUrl = session
    ? `${window.location.origin}/join/${session.code}`
    : '';

  // Show briefing cards for participants who haven't dismissed them
  if (!isFacilitator && !hasDismissedBriefing && scenario) {
    return (
      <BriefingCards
        briefing={scenario.briefing}
        patientCount={scenario.patients.length}
        durationMinutes={scenario.durationMinutes}
        onDismiss={dismissBriefing}
      />
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col p-4 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold">
          {isFacilitator ? 'Session Lobby' : 'Waiting Room'}
        </h1>
        {session && (
          <div className="font-mono text-2xl font-bold text-nhs-lightBlue tracking-wider">
            {session.code}
          </div>
        )}
      </div>

      {/* Facilitator: QR code + participant management */}
      {isFacilitator && (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
          {/* Left: QR + join info */}
          <div className="card flex flex-col items-center justify-center gap-3 lg:w-1/3">
            <p className="text-sim-textMuted text-sm">Teams scan to join:</p>
            <QRCodeDisplay url={joinUrl} />
            <p className="font-mono text-sm text-sim-textMuted break-all text-center">
              {joinUrl}
            </p>
          </div>

          {/* Right: participant list + assignment */}
          <div className="card flex-1 flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                Teams ({participants.length})
              </h2>
              <button
                onClick={handleAutoAssign}
                disabled={participants.length === 0}
                className="btn-secondary text-sm py-1 px-3"
              >
                Auto-Assign
              </button>
            </div>

            {participants.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sim-textMuted">
                Waiting for teams to join...
              </div>
            ) : (
              <div className="flex-1 overflow-auto scrollable">
                <div className="space-y-2">
                  {participants.map((user) => (
                    <div
                      key={user.id}
                      className="participant-row flex items-center justify-between bg-sim-bg rounded-lg p-3"
                    >
                      <div>
                        <span className="font-medium">{user.name}</span>
                        {user.assignedPatientId && (
                          <span className="ml-2 text-xs text-nhs-lightBlue">
                            → {patients.find((p) => p.id === user.assignedPatientId)?.name}
                          </span>
                        )}
                      </div>
                      <select
                        value={user.assignedPatientId ?? ''}
                        onChange={(e) => handleAssign(user.id, e.target.value)}
                        className="bg-sim-surfaceLight border border-sim-border rounded px-2 py-1 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {patients.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={participants.length === 0 || !allAssigned}
              className="btn-primary text-lg py-4 shrink-0"
            >
              {!allAssigned
                ? 'Assign all patients first'
                : `Start Simulation (${participants.length} teams)`}
            </button>
          </div>
        </div>
      )}

      {/* Participant: waiting view */}
      {!isFacilitator && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <Clock className="w-12 h-12 text-nhs-lightBlue animate-pulse" />
          <div className="text-center">
            <p className="text-xl font-semibold">Waiting for facilitator to start</p>
            <p className="text-sim-textMuted mt-2">
              Team: <span className="text-white font-medium">{myUser()?.name}</span>
            </p>
            {myUser()?.assignedPatientId && (
              <p className="text-nhs-lightBlue mt-2 text-sm">
                Patient assigned — simulation will begin shortly
              </p>
            )}
          </div>
          <button
            onClick={() => useSessionStore.setState({ hasDismissedBriefing: false })}
            className="flex items-center gap-2 text-sm text-sim-textMuted hover:text-nhs-lightBlue transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Review briefing
          </button>
        </div>
      )}
    </div>
  );
}
