import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import { useSessionStore } from '../stores/sessionStore';
import gsap from 'gsap';

export default function JoinSession() {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(urlCode?.toUpperCase() ?? '');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'code' | 'name'>(urlCode ? 'name' : 'code');
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
  }, [step]);

  const handleCodeSubmit = () => {
    if (code.length !== 6) {
      setError('Please enter a 6-character session code.');
      return;
    }
    setError(null);
    setStep('name');
  };

  const handleJoin = () => {
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setError(null);
    socket.emit('join:session', { code: code.toUpperCase(), name: name.trim() });
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <button
        onClick={() => navigate('/')}
        className="absolute top-12 left-4 text-nhs-lightBlue text-sm hover:text-white"
      >
        ← Back
      </button>

      <div ref={formRef} className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6 text-white">Join Simulation</h1>

        {step === 'code' && (
          <div className="flex flex-col gap-4">
            <label className="text-sm text-white font-medium">Session Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABCD23"
              className="w-full px-4 py-3 bg-sim-surface border-2 border-nhs-lightBlue rounded-lg text-white placeholder-white/30 text-center text-3xl tracking-[0.3em] font-mono uppercase focus:outline-none focus:ring-2 focus:ring-nhs-lightBlue focus:border-nhs-lightBlue"
              maxLength={6}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
            />
            <button
              onClick={handleCodeSubmit}
              disabled={code.length !== 6}
              className="btn-primary text-lg py-4"
            >
              Next
            </button>
          </div>
        )}

        {step === 'name' && (
          <div className="flex flex-col gap-4">
            <div className="bg-nhs-blue/20 border-2 border-nhs-blue rounded-xl p-3 text-center">
              <span className="text-white/70 text-sm">Session</span>
              <span className="ml-2 font-mono font-bold text-nhs-lightBlue">{code}</span>
            </div>
            <label className="text-sm text-white font-medium">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah"
              className="w-full px-4 py-3 bg-sim-surface border-2 border-nhs-lightBlue rounded-lg text-white placeholder-white/30 text-xl focus:outline-none focus:ring-2 focus:ring-nhs-lightBlue focus:border-nhs-lightBlue"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button
              onClick={handleJoin}
              disabled={!name.trim()}
              className="btn-primary text-lg py-4"
            >
              Join
            </button>
            <button
              onClick={() => setStep('code')}
              className="text-nhs-lightBlue text-sm text-center hover:text-white"
            >
              Change code
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-nhs-emergency/20 border border-nhs-emergency/40 rounded-lg text-sm text-red-300 text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
