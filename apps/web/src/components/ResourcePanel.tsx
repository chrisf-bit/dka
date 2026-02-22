import { socket } from '../lib/socket';
import { useSessionStore } from '../stores/sessionStore';
import { TestTube, Microscope, UserRound } from 'lucide-react';

export default function ResourcePanel() {
  const resources = useSessionStore((s) => s.resources);
  const session = useSessionStore((s) => s.session);

  const toggleResource = (resource: string, available: boolean) => {
    if (session) {
      socket.emit('facilitator:toggleResource', {
        sessionId: session.id,
        resource,
        available,
      });
    }
  };

  const items = [
    {
      key: 'ketometer',
      label: 'Ketone Meter',
      icon: <TestTube className="w-4 h-4" />,
      available: resources.ketometerAvailable,
    },
    {
      key: 'labs',
      label: 'Lab Services',
      icon: <Microscope className="w-4 h-4" />,
      available: resources.labsAvailable,
    },
    {
      key: 'staff',
      label: 'Staff Available',
      icon: <UserRound className="w-4 h-4" />,
      available: resources.staffAvailable,
    },
  ];

  return (
    <div className="space-y-2">
      <h3 className="text-xs text-sim-textMuted uppercase tracking-wider font-semibold">
        Resources
      </h3>
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => toggleResource(item.key, !item.available)}
          className={`w-full flex items-center gap-2 p-2 rounded-lg border text-sm transition-colors ${
            item.available
              ? 'border-sim-stable/40 bg-green-950/20 text-sim-stable'
              : 'border-sim-critical/40 bg-red-950/20 text-sim-critical'
          }`}
        >
          <span>{item.icon}</span>
          <span className="flex-1 text-left font-medium">{item.label}</span>
          <span className="text-xs font-mono">
            {item.available ? 'ON' : 'OFF'}
          </span>
        </button>
      ))}
    </div>
  );
}
