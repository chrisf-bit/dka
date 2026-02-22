import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import type { VitalsSnapshot, PatientStatus } from '@dka-sim/shared';

interface Props {
  vitals: VitalsSnapshot;
  status: PatientStatus;
  compact?: boolean;
}

interface VitalItem {
  label: string;
  value: string;
  unit: string;
  alert: boolean;
  key: string;
}

function getVitalItems(vitals: VitalsSnapshot): VitalItem[] {
  const items: VitalItem[] = [
    {
      key: 'hr',
      label: 'HR',
      value: String(vitals.hr),
      unit: 'bpm',
      alert: vitals.hr > 110 || vitals.hr < 60,
    },
    {
      key: 'bp',
      label: 'BP',
      value: `${vitals.bpSystolic}/${vitals.bpDiastolic}`,
      unit: 'mmHg',
      alert: vitals.bpSystolic < 100 || vitals.bpSystolic > 160,
    },
    {
      key: 'rr',
      label: 'RR',
      value: String(vitals.rr),
      unit: '/min',
      alert: vitals.rr > 24 || vitals.rr < 10,
    },
    {
      key: 'spo2',
      label: 'SpO₂',
      value: String(vitals.spo2),
      unit: '%',
      alert: vitals.spo2 < 95,
    },
    {
      key: 'temp',
      label: 'Temp',
      value: vitals.temp.toFixed(1),
      unit: '°C',
      alert: vitals.temp > 38.0 || vitals.temp < 36.0,
    },
    {
      key: 'gcs',
      label: 'GCS',
      value: String(vitals.gcs),
      unit: '/15',
      alert: vitals.gcs < 15,
    },
  ];

  // Add revealed lab values
  if (vitals.glucose !== undefined) {
    items.push({
      key: 'glucose',
      label: 'Glucose',
      value: vitals.glucose.toFixed(1),
      unit: 'mmol/L',
      alert: vitals.glucose > 11.0,
    });
  }
  if (vitals.ketones !== undefined) {
    items.push({
      key: 'ketones',
      label: 'Ketones',
      value: vitals.ketones.toFixed(1),
      unit: 'mmol/L',
      alert: vitals.ketones > 3.0,
    });
  }

  return items;
}

export default function VitalsPanel({ vitals, status, compact }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const prevVitalsRef = useRef<VitalsSnapshot>(vitals);

  useEffect(() => {
    if (!gridRef.current) return;

    // Animate changed values
    const prev = prevVitalsRef.current;
    const cells = gridRef.current.querySelectorAll('.vital-value');

    cells.forEach((cell) => {
      const key = cell.getAttribute('data-key');
      if (!key) return;

      const prevVal = (prev as unknown as Record<string, unknown>)[key];
      const newVal = (vitals as unknown as Record<string, unknown>)[key];

      if (prevVal !== newVal) {
        gsap.fromTo(
          cell,
          { scale: 1.15, color: '#FFB81C' },
          { scale: 1, color: '', duration: 0.8, ease: 'power2.out' },
        );
      }
    });

    prevVitalsRef.current = vitals;
  }, [vitals]);

  const items = getVitalItems(vitals);
  const statusColor: Record<string, string> = {
    stable: 'border-sim-stable',
    concerning: 'border-sim-concerning',
    critical: 'border-sim-critical',
    collapsed: 'border-red-500',
    resolved: 'border-nhs-lightBlue',
  };

  return (
    <div
      ref={gridRef}
      className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-6'}`}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className={`bg-sim-bg rounded-lg p-2 text-center border-l-2 ${
            item.alert ? 'border-nhs-emergency bg-red-950/30' : statusColor[status] ?? 'border-sim-border'
          }`}
        >
          <div className="text-[10px] text-sim-textMuted uppercase tracking-wider">
            {item.label}
          </div>
          <div
            className={`vital-value text-lg font-bold font-mono ${
              item.alert ? 'text-nhs-emergency' : 'text-white'
            }`}
            data-key={item.key}
          >
            {item.value}
          </div>
          <div className="text-[9px] text-sim-textMuted">{item.unit}</div>
        </div>
      ))}
    </div>
  );
}
