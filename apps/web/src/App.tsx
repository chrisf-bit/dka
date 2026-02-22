import { Routes, Route, Navigate } from 'react-router-dom';
import { useSocket } from './hooks/useSocket';
import { useSessionStore } from './stores/sessionStore';
import Home from './pages/Home';
import JoinSession from './pages/JoinSession';
import Lobby from './pages/Lobby';
import PatientView from './pages/PatientView';
import FacilitatorDashboard from './pages/FacilitatorDashboard';
import SessionSetup from './pages/SessionSetup';
import Debrief from './pages/Debrief';
import AlertBanner from './components/AlertBanner';
import { DISCLAIMER } from '@dka-sim/shared';

export default function App() {
  useSocket();
  const session = useSessionStore((s) => s.session);
  const userId = useSessionStore((s) => s.userId);
  const users = useSessionStore((s) => s.users);

  const currentUser = users.find((u) => u.id === userId);
  const isFacilitator = currentUser?.role === 'facilitator';

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Disclaimer bar */}
      <div className="bg-nhs-orange/20 border-b border-nhs-orange/40 px-3 py-1 text-center text-xs text-nhs-warmYellow shrink-0">
        {DISCLAIMER}
      </div>

      {/* Alert overlay */}
      <AlertBanner />

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join" element={<JoinSession />} />
          <Route path="/join/:code" element={<JoinSession />} />
          <Route path="/facilitator/setup" element={<SessionSetup />} />
          <Route
            path="/lobby"
            element={session ? <Lobby /> : <Navigate to="/" replace />}
          />
          <Route
            path="/sim"
            element={
              session ? (
                isFacilitator ? (
                  <FacilitatorDashboard />
                ) : (
                  <PatientView />
                )
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/debrief"
            element={session ? <Debrief /> : <Navigate to="/" replace />}
          />
        </Routes>
      </div>
    </div>
  );
}
