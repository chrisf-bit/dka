import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import { useSessionStore } from '../stores/sessionStore';
import gsap from 'gsap';

export default function SessionSetup() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [scenarioId] = useState('default-dka-scenario');
  const session = useSessionStore((s) => s.session);
  const error = useSessionStore((s) => s.error);
  const setError = useSessionStore((s) => s.setError);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session) {
      navigate('/lobby');
    }
  }, [session, navigate]);

  useEffect(() => {
    if (formRef.current) {
      gsap.fromTo(
        formRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' },
      );
    }
  }, []);

  const handleCreate = () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.');
      return;
    }
    setError(null);
    socket.emit('facilitator:create', { scenarioId, pin });
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <button
        onClick={() => navigate('/')}
        className="absolute top-12 left-4 text-nhs-lightBlue text-sm hover:text-white"
      >
        ← Back
      </button>

      <div ref={formRef} className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2 text-white">Create Session</h1>
        <p className="text-white/70 text-sm text-center mb-6">
          Set a facilitator PIN to control the simulation
        </p>

        <div className="flex flex-col gap-4">
          <div className="bg-nhs-blue/20 border-2 border-nhs-blue rounded-xl p-4">
            <h3 className="font-semibold text-sm text-nhs-lightBlue mb-1">Scenario</h3>
            <p className="font-medium text-white">Tuesday Afternoon on Delivery Suite</p>
            <p className="text-white/70 text-xs mt-1">
              3 patients · 30 min · DKA hidden among competing presentations
            </p>
          </div>

          <label className="text-sm text-white font-medium">Facilitator PIN (numbers only)</label>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="1234"
            className="w-full px-4 py-3 bg-sim-surface border-2 border-nhs-lightBlue rounded-lg text-white placeholder-white/30 text-center text-2xl tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-nhs-lightBlue focus:border-nhs-lightBlue"
            maxLength={8}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />

          <button
            onClick={handleCreate}
            disabled={pin.length < 4}
            className="btn-primary text-lg py-4"
          >
            Create Session
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-nhs-emergency/20 border border-nhs-emergency/40 rounded-lg text-sm text-red-300 text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
