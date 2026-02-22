import { create } from 'zustand';
import type {
  Session,
  User,
  Patient,
  EventLogEntry,
  ResourceState,
  ScenarioDefinition,
  ActionDefinition,
  DebriefData,
  VitalsSnapshot,
  PatientStatus,
  FetalStatus,
} from '@dka-sim/shared';

interface Alert {
  id: string;
  patientId: string;
  message: string;
  severity: string;
  timestamp: number;
}

interface SessionStore {
  // Connection state
  connected: boolean;
  error: string | null;
  userId: string | null;

  // Session data
  session: Session | null;
  users: User[];
  patients: Patient[];
  events: EventLogEntry[];
  resources: ResourceState;
  scenario: ScenarioDefinition | null;
  actionDefinitions: ActionDefinition[];

  // Simulation state
  simClockMs: number;

  // Alerts
  alerts: Alert[];

  // Debrief
  debrief: DebriefData | null;

  // UI state
  hasDismissedBriefing: boolean;

  // Pending action results
  pendingActions: Map<string, { actionKey: string; delayMs: number; submittedAt: number }>;
  actionResults: Map<string, Record<string, unknown>>;

  // Actions
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  setUserId: (userId: string) => void;
  setSessionState: (state: {
    session: Session;
    users: User[];
    patients: Patient[];
    events: EventLogEntry[];
    resources: ResourceState;
    scenario: ScenarioDefinition;
    actionDefinitions: ActionDefinition[];
    userId: string;
  }) => void;
  updateSession: (updates: Partial<Session>) => void;
  setSimClock: (ms: number) => void;
  addUser: (user: User) => void;
  assignPatient: (userId: string, patientId: string) => void;
  updatePatientVitals: (
    patientId: string,
    vitals: VitalsSnapshot,
    status: PatientStatus,
    fetalStatus: FetalStatus,
    ctgSummary: string,
  ) => void;
  addPatient: (patient: Patient) => void;
  addEvent: (event: EventLogEntry) => void;
  setResources: (resources: Partial<ResourceState>) => void;
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp'>) => void;
  dismissAlert: (id: string) => void;
  setDebrief: (debrief: DebriefData) => void;
  dismissBriefing: () => void;
  addPendingAction: (patientId: string, actionKey: string, delayMs: number) => void;
  setActionResult: (patientId: string, actionKey: string, result: Record<string, unknown>) => void;
  clearActionResult: (key: string) => void;
  reset: () => void;

  // Computed
  myPatient: () => Patient | undefined;
  myUser: () => User | undefined;
}

const initialResources: ResourceState = {
  ketometerAvailable: true,
  labsAvailable: true,
  staffAvailable: true,
  labDelayMultiplier: 1.0,
};

let alertCounter = 0;

export const useSessionStore = create<SessionStore>((set, get) => ({
  connected: false,
  error: null,
  userId: null,
  session: null,
  users: [],
  patients: [],
  events: [],
  resources: initialResources,
  scenario: null,
  actionDefinitions: [],
  simClockMs: 0,
  alerts: [],
  debrief: null,
  hasDismissedBriefing: false,
  pendingActions: new Map(),
  actionResults: new Map(),

  setConnected: (connected) => set({ connected }),
  setError: (error) => set({ error }),
  setUserId: (userId) => set({ userId }),

  setSessionState: (state) =>
    set({
      session: state.session,
      users: state.users,
      patients: state.patients,
      events: state.events,
      resources: state.resources,
      scenario: state.scenario,
      actionDefinitions: state.actionDefinitions,
      userId: state.userId,
      simClockMs: state.session.simClockMs,
    }),

  updateSession: (updates) =>
    set((s) => ({
      session: s.session ? { ...s.session, ...updates } : null,
    })),

  setSimClock: (ms) => set({ simClockMs: ms }),

  addUser: (user) =>
    set((s) => ({
      users: s.users.some((u) => u.id === user.id) ? s.users : [...s.users, user],
    })),

  assignPatient: (userId, patientId) =>
    set((s) => ({
      users: s.users.map((u) => (u.id === userId ? { ...u, assignedPatientId: patientId } : u)),
    })),

  updatePatientVitals: (patientId, vitals, status, fetalStatus, ctgSummary) =>
    set((s) => ({
      patients: s.patients.map((p) =>
        p.id === patientId
          ? { ...p, currentVitals: vitals, status, fetalStatus, ctgSummary }
          : p,
      ),
    })),

  addPatient: (patient) =>
    set((s) => ({
      patients: s.patients.some((p) => p.id === patient.id)
        ? s.patients.map((p) => (p.id === patient.id ? patient : p))
        : [...s.patients, patient],
    })),

  addEvent: (event) =>
    set((s) => ({
      events: [...s.events, event],
    })),

  setResources: (updates) =>
    set((s) => ({
      resources: { ...s.resources, ...updates },
    })),

  addAlert: (alert) => {
    const id = `alert-${++alertCounter}`;
    set((s) => ({
      alerts: [{ ...alert, id, timestamp: Date.now() }, ...s.alerts].slice(0, 10),
    }));
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      set((s) => ({
        alerts: s.alerts.filter((a) => a.id !== id),
      }));
    }, 8000);
  },

  dismissAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.filter((a) => a.id !== id),
    })),

  setDebrief: (debrief) => set({ debrief }),
  dismissBriefing: () => set({ hasDismissedBriefing: true }),

  addPendingAction: (patientId, actionKey, delayMs) => {
    const key = `${patientId}:${actionKey}`;
    set((s) => {
      const map = new Map(s.pendingActions);
      map.set(key, { actionKey, delayMs, submittedAt: Date.now() });
      return { pendingActions: map };
    });
  },

  setActionResult: (patientId, actionKey, result) => {
    const pendingKey = `${patientId}:${actionKey}`;
    const resultKey = `${patientId}:${actionKey}:${Date.now()}`;
    set((s) => {
      const pendingMap = new Map(s.pendingActions);
      pendingMap.delete(pendingKey);
      const resultMap = new Map(s.actionResults);
      resultMap.set(resultKey, result);
      return { pendingActions: pendingMap, actionResults: resultMap };
    });
  },

  clearActionResult: (key) => {
    set((s) => {
      const map = new Map(s.actionResults);
      map.delete(key);
      return { actionResults: map };
    });
  },

  reset: () =>
    set({
      session: null,
      users: [],
      patients: [],
      events: [],
      resources: initialResources,
      scenario: null,
      actionDefinitions: [],
      simClockMs: 0,
      alerts: [],
      debrief: null,
      hasDismissedBriefing: false,
      userId: null,
      error: null,
      pendingActions: new Map(),
      actionResults: new Map(),
    }),

  myPatient: () => {
    const { userId, users, patients } = get();
    const user = users.find((u) => u.id === userId);
    if (!user?.assignedPatientId) return undefined;
    return patients.find((p) => p.id === user.assignedPatientId);
  },

  myUser: () => {
    const { userId, users } = get();
    return users.find((u) => u.id === userId);
  },
}));
