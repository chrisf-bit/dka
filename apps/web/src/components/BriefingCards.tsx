import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Users, Target, Layout, AlertTriangle, Activity, FileText, Zap, ArrowDown } from 'lucide-react';
import gsap from 'gsap';

interface Props {
  briefing: string;
  patientCount: number;
  durationMinutes: number;
  onDismiss: () => void;
}

interface CardData {
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export default function BriefingCards({ briefing, patientCount, durationMinutes, onDismiss }: Props) {
  const [currentCard, setCurrentCard] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const cards: CardData[] = [
    {
      title: 'Welcome',
      icon: <Users className="w-8 h-8 text-nhs-lightBlue" />,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-sim-textMuted leading-relaxed">
            You are a team of midwives working on the Delivery Suite.
            Work together to assess and manage your patient.
          </p>
          <div className="flex items-center gap-4 mt-2">
            <div className="bg-sim-bg rounded-lg px-3 py-2 text-center">
              <div className="text-lg font-bold text-white">{patientCount}</div>
              <div className="text-[10px] text-sim-textMuted uppercase">Patients</div>
            </div>
            <div className="bg-sim-bg rounded-lg px-3 py-2 text-center">
              <div className="text-lg font-bold text-white">{durationMinutes} min</div>
              <div className="text-[10px] text-sim-textMuted uppercase">Duration</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'The Scenario',
      icon: <Target className="w-8 h-8 text-nhs-lightBlue" />,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-sim-textMuted leading-relaxed">{briefing}</p>
        </div>
      ),
    },
    {
      title: 'Your Screen',
      icon: <Layout className="w-8 h-8 text-nhs-lightBlue" />,
      content: (
        <div className="space-y-2 w-full">
          <ScreenSection
            icon={<Activity className="w-3.5 h-3.5 text-sim-critical" />}
            title="Vitals Strip"
            desc="Live observations across the top — HR, BP, SpO2 and more"
          />
          <ArrowDown className="w-3.5 h-3.5 text-sim-textMuted mx-auto" />
          <ScreenSection
            icon={<FileText className="w-3.5 h-3.5 text-nhs-lightBlue" />}
            title="Patient Info"
            desc="Tap the file icon for full history, PMH, allergies and CTG"
          />
          <ArrowDown className="w-3.5 h-3.5 text-sim-textMuted mx-auto" />
          <ScreenSection
            icon={<Zap className="w-3.5 h-3.5 text-sim-concerning" />}
            title="Actions"
            desc="Investigate, monitor, escalate and treat — grouped by category"
          />
        </div>
      ),
    },
    {
      title: 'How Actions Work',
      icon: <Zap className="w-8 h-8 text-nhs-lightBlue" />,
      content: (
        <div className="space-y-2">
          <Step num={1} text="Discuss with your team, then tap an action to submit it" />
          <Step num={2} text="Some actions take time — watch for the 'processing' state" />
          <Step num={3} text="Results appear as overlays — read them carefully before deciding next steps" />
          <Step num={4} text="Some actions unlock others (e.g. IV access before fluids)" />
        </div>
      ),
    },
    {
      title: 'Key Reminder',
      icon: <AlertTriangle className="w-8 h-8 text-sim-concerning" />,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-sim-textMuted leading-relaxed">
            Not all patients will have the same level of urgency.
            Prioritise based on clinical findings.
          </p>
          <p className="text-sm font-medium text-white">
            Think: Could this be DKA?
          </p>
          <p className="text-xs text-sim-textMuted">
            Vomiting in pregnancy has many causes — but always consider the unexpected.
          </p>
        </div>
      ),
    },
  ];

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { x: 30, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.3, ease: 'power2.out' },
      );
    }
  }, [currentCard]);

  const next = () => {
    if (currentCard < cards.length - 1) {
      setCurrentCard(currentCard + 1);
    } else {
      onDismiss();
    }
  };

  const prev = () => {
    if (currentCard > 0) setCurrentCard(currentCard - 1);
  };

  const card = cards[currentCard];
  const isLast = currentCard === cards.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-sim-bg/95 flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col h-full max-h-[540px] justify-between">
        {/* Card */}
        <div ref={cardRef} className="card flex-1 flex flex-col items-center text-center px-6 py-8">
          <div className="mb-4">{card.icon}</div>
          <h2 className="text-xl font-bold text-white mb-4">{card.title}</h2>
          <div className="flex-1 flex items-start">{card.content}</div>
        </div>

        {/* Progress dots + navigation */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={prev}
            disabled={currentCard === 0}
            className="p-2 text-sim-textMuted disabled:opacity-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex gap-2">
            {cards.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentCard ? 'bg-nhs-lightBlue' : 'bg-sim-border'
                }`}
              />
            ))}
          </div>

          <button
            onClick={next}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              isLast
                ? 'bg-nhs-blue text-white'
                : 'text-nhs-lightBlue hover:text-white'
            }`}
          >
            {isLast ? "I'm Ready" : 'Next'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-start gap-3 text-left">
      <div className="w-6 h-6 rounded-full bg-nhs-blue/30 text-nhs-lightBlue flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
        {num}
      </div>
      <p className="text-sm text-sim-textMuted">{text}</p>
    </div>
  );
}

function ScreenSection({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 text-left bg-sim-bg rounded-lg px-3 py-2">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>
        <div className="text-xs font-semibold text-white">{title}</div>
        <div className="text-[11px] text-sim-textMuted leading-snug">{desc}</div>
      </div>
    </div>
  );
}
