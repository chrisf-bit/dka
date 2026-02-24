import { useNavigate } from 'react-router-dom';
import { useRef, useEffect } from 'react';
import { Hospital, Smartphone, Monitor } from 'lucide-react';
import gsap from 'gsap';

export default function Home() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        titleRef.current,
        { y: -30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' },
      );
      gsap.fromTo(
        cardsRef.current!.children,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.15, ease: 'power2.out', delay: 0.3 },
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="h-full flex flex-col items-center justify-center p-6">
      <div ref={titleRef} className="text-center mb-8">
        <Hospital className="w-16 h-16 mx-auto mb-3 text-nhs-lightBlue" strokeWidth={1.25} />
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          DKA Sim
        </h1>
        <p className="text-sim-textMuted mt-2 text-sm md:text-base max-w-md">
          Delivery Suite DKA Recognition Training
        </p>
      </div>

      <div ref={cardsRef} className="flex flex-col gap-4 w-full max-w-sm mb-6">
        <button
          onClick={() => navigate('/join')}
          className="btn-primary text-lg py-5 w-full rounded-xl flex items-center justify-center gap-3"
        >
          <Smartphone className="w-6 h-6" />
          Join Simulation
        </button>

        <button
          onClick={() => navigate('/facilitator/setup')}
          className="btn-secondary text-lg py-5 w-full rounded-xl flex items-center justify-center gap-3 border-2 border-nhs-blue/40 bg-nhs-darkBlue/30 text-white"
        >
          <Monitor className="w-6 h-6" />
          Facilitator Setup
        </button>
      </div>

      <p className="text-nhs-midGrey text-xs text-center max-w-xs">
        South Tyneside &amp; Sunderland NHS Foundation Trust
      </p>
    </div>
  );
}
