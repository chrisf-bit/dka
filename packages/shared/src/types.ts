// ─── Core Types ──────────────────────────────────────────────────────────────

export type SessionStatus = 'lobby' | 'running' | 'paused' | 'ended';
export type UserRole = 'facilitator' | 'participant';
export type PatientStatus = 'stable' | 'concerning' | 'critical' | 'collapsed' | 'resolved';
export type FetalStatus = 'reassuring' | 'non_reassuring' | 'pathological' | 'iud';
export type EventType = 'action' | 'result' | 'deterioration' | 'injection' | 'system';
export type ActionCategory = 'investigation' | 'escalation' | 'treatment' | 'monitoring';

// ─── Vitals ──────────────────────────────────────────────────────────────────

export interface VitalsSnapshot {
  hr: number;
  bpSystolic: number;
  bpDiastolic: number;
  rr: number;
  spo2: number;
  temp: number;
  gcs: number;
  glucose?: number;
  ketones?: number;
  pH?: number;
  bicarb?: number;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  code: string;
  scenarioId: string;
  configId: string;
  status: SessionStatus;
  simClockMs: number;
  speedFactor: number;
  facilitatorPin: string;
  createdAt: number;
  endedAt?: number;
}

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  sessionId: string;
  name: string;
  role: UserRole;
  socketId?: string;
  assignedPatientId?: string;
  joinedAt: number;
}

// ─── Patient ─────────────────────────────────────────────────────────────────

export interface Patient {
  id: string;
  sessionId: string;
  scenarioPatientKey: string;
  name: string;
  age: number;
  height: number;
  weight: number;
  gestation: string;
  parity: string;
  presentingComplaint: string;
  history: string;
  pmh: string;
  allergies: string;
  status: PatientStatus;
  currentVitals: VitalsSnapshot;
  ctgSummary: string;
  isAlive: boolean;
  fetalStatus: FetalStatus;
  isDKA: boolean;
  lastKnownPotassium?: number;
  deteriorationType: string;
  currentStageIndex: number;
  stageEnteredAtMs: number;
  availableActions: string[];
  completedActions: string[];
  pendingActions: PendingAction[];
  interventionEffects: InterventionEffect[];
  arrivedAtMs: number;
  hasArrived: boolean;
}

export interface PendingAction {
  actionKey: string;
  submittedAtMs: number;
  completesAtMs: number;
  userId: string;
  prescription?: Prescription;
}

export interface InterventionEffect {
  type: 'halt' | 'reverse' | 'slow';
  appliedAtMs: number;
  slowFactor?: number;
}

// ─── Event Log ───────────────────────────────────────────────────────────────

export interface EventLogEntry {
  id: string;
  sessionId: string;
  patientId?: string;
  userId?: string;
  userName?: string;
  simTimeMs: number;
  type: EventType;
  category?: string;
  detail: Record<string, unknown>;
  createdAt: number;
}

// ─── Prescriptions ──────────────────────────────────────────────────────────

export type PrescriptionType = 'iv_fluids' | 'insulin' | 'potassium';

export interface FluidPrescription {
  type: 'iv_fluids';
  durationMinutes: number;
}

export interface InsulinPrescription {
  type: 'insulin';
  rateMlPerHr: number;
}

export interface PotassiumPrescription {
  type: 'potassium';
  concentrationMmol: number;
}

export type Prescription = FluidPrescription | InsulinPrescription | PotassiumPrescription;

export type PrescriptionAccuracy = 'correct' | 'acceptable' | 'incorrect' | 'dangerous';

export interface PrescriptionFeedback {
  accuracy: PrescriptionAccuracy;
  expectedValue: string;
  feedback: string;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export interface ActionDefinition {
  key: string;
  label: string;
  description: string;
  category: ActionCategory;
  delayMs: number;
  prerequisites: string[];
  icon: string;
  requiresPrescription?: boolean;
  prescriptionType?: PrescriptionType;
}

// ─── Resources ───────────────────────────────────────────────────────────────

export interface ResourceState {
  ketometerAvailable: boolean;
  labsAvailable: boolean;
  staffAvailable: boolean;
  labDelayMultiplier: number;
}

// ─── Clinical Config ─────────────────────────────────────────────────────────

export interface DeteriorationStage {
  name: string;
  durationMs: number;
  vitals: VitalsSnapshot;
  ctgSummary: string;
  fetalStatus: FetalStatus;
}

export interface ClinicalRulesConfig {
  version: number;

  dkaTriggers: {
    glucoseThreshold: number;
    ketoneThreshold: number;
    phThreshold: number;
    bicarbThreshold: number;
  };

  investigations: ActionDefinition[];

  escalation: {
    newsScoreThreshold: number;
    autoEscalateAt: string;
  };

  treatment: {
    fluidProtocol: {
      firstBagVolume: number;
      firstBagDurationMinutes: number;
      sbpShockedThreshold: number;
      subsequentRate: number;
    };
    insulinProtocol: {
      startAfterFluids: boolean;
      rateUnitsPerKgPerHr: number;
      maxRateMlPerHr: number;
    };
    potassiumProtocol: {
      checkBeforeInsulin: boolean;
      lowThreshold: number;
      highThreshold: number;
    };
  };

  deteriorationCurves: Record<
    string,
    {
      stages: DeteriorationStage[];
    }
  >;

  scoring: {
    recognitionTargetMs: number;
    escalationTargetMs: number;
    treatmentTargetMs: number;
    recognitionMaxScore: number;
    escalationMaxScore: number;
    treatmentMaxScore: number;
    outcomeMaxScore: number;
    actionsMaxScore: number;
  };

  resources: {
    ketometerAvailable: boolean;
    ketometerUnavailableProbability: number;
    labDelayMs: number;
    staffBusyProbability: number;
  };
}

// ─── Scenario ────────────────────────────────────────────────────────────────

export interface ScenarioPatientDef {
  key: string;
  name: string;
  age: number;
  height: number;
  weight: number;
  gestation: string;
  parity: string;
  presentingComplaint: string;
  history: string;
  pmh: string;
  allergies: string;
  initialVitals: VitalsSnapshot;
  initialCtg: string;
  deteriorationType: string;
  isDKA: boolean;
  availableActions: string[];
  arrivalDelayMs: number;
}

export interface ScenarioTimedEvent {
  triggerAtMs: number;
  type: 'resource_change' | 'new_patient' | 'staff_change' | 'message';
  payload: Record<string, unknown>;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  briefing: string;
  durationMinutes: number;
  patients: ScenarioPatientDef[];
  timedEvents: ScenarioTimedEvent[];
}

// ─── Config Version ──────────────────────────────────────────────────────────

export interface ConfigVersion {
  id: string;
  version: number;
  label: string;
  config: ClinicalRulesConfig;
  createdAt: number;
  createdBy: string;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export interface ParticipantScore {
  userId: string;
  userName: string;
  patientId: string;
  patientName: string;
  patientOutcome: number;
  timeToRecognition: number;
  timeToEscalation: number;
  timeToTreatment: number;
  appropriateActions: number;
  total: number;
  actions: ScoredAction[];
}

export interface ScoredAction {
  actionKey: string;
  label: string;
  simTimeMs: number;
  wasAppropriate: boolean;
  points: number;
}

// ─── Session State (full sync) ───────────────────────────────────────────────

export interface SessionState {
  session: Session;
  users: User[];
  patients: Patient[];
  events: EventLogEntry[];
  resources: ResourceState;
  scenario: ScenarioDefinition;
  actionDefinitions: ActionDefinition[];
}

// ─── Debrief ─────────────────────────────────────────────────────────────────

export interface DebriefData {
  session: Session;
  scores: ParticipantScore[];
  events: EventLogEntry[];
  patients: Patient[];
  teamScore: number;
}

// ─── Socket Events ───────────────────────────────────────────────────────────

export interface ClientToServerEvents {
  'join:session': (data: { code: string; name: string }) => void;
  'facilitator:create': (data: { scenarioId: string; pin: string }) => void;
  'facilitator:auth': (data: { sessionId: string; pin: string }) => void;
  'facilitator:assignPatient': (data: { userId: string; patientId: string }) => void;
  'facilitator:autoAssign': (data: { sessionId: string }) => void;
  'facilitator:start': (data: { sessionId: string }) => void;
  'facilitator:pause': (data: { sessionId: string }) => void;
  'facilitator:resume': (data: { sessionId: string }) => void;
  'facilitator:end': (data: { sessionId: string }) => void;
  'facilitator:inject': (data: { sessionId: string; event: Record<string, unknown> }) => void;
  'facilitator:toggleResource': (data: {
    sessionId: string;
    resource: string;
    available: boolean;
  }) => void;
  'action:submit': (data: { patientId: string; actionKey: string; prescription?: Prescription }) => void;
}

export interface ServerToClientEvents {
  'session:created': (data: { session: Session; userId: string }) => void;
  'session:state': (data: SessionState & { userId: string }) => void;
  'session:started': (data: { simClockMs: number }) => void;
  'session:paused': (data: { simClockMs: number }) => void;
  'session:ended': (data: { debrief: DebriefData }) => void;
  'session:error': (data: { message: string }) => void;
  'patient:vitalsUpdate': (data: {
    patientId: string;
    vitals: VitalsSnapshot;
    status: PatientStatus;
    fetalStatus: FetalStatus;
    ctgSummary: string;
  }) => void;
  'patient:arrived': (data: { patient: Patient }) => void;
  'patient:updated': (data: { patient: Patient }) => void;
  'patient:statusChange': (data: {
    patientId: string;
    oldStatus: PatientStatus;
    newStatus: PatientStatus;
  }) => void;
  'action:pending': (data: { patientId: string; actionKey: string; delayMs: number }) => void;
  'action:result': (data: {
    patientId: string;
    actionKey: string;
    result: Record<string, unknown>;
  }) => void;
  'event:injected': (data: { event: EventLogEntry }) => void;
  'event:logged': (data: { event: EventLogEntry }) => void;
  'resource:changed': (data: { resource: string; available: boolean }) => void;
  'user:joined': (data: { user: User }) => void;
  'user:assigned': (data: { userId: string; patientId: string }) => void;
  'clock:tick': (data: { simClockMs: number }) => void;
  'alert:fire': (data: { patientId: string; message: string; severity: string }) => void;
}
