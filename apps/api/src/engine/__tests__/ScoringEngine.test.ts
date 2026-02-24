import { describe, it, expect } from 'vitest';
import { scoreParticipant } from '../ScoringEngine.js';
import type { Patient, User, EventLogEntry, ClinicalRulesConfig } from '@dka-sim/shared';

const testConfig: ClinicalRulesConfig = {
  version: 1,
  dkaTriggers: { glucoseThreshold: 11, ketoneThreshold: 3, phThreshold: 7.3, bicarbThreshold: 15 },
  investigations: [
    { key: 'check_glucose', label: 'Blood Glucose', description: '', category: 'investigation', delayMs: 30000, prerequisites: [], icon: '🩸' },
    { key: 'check_ketones', label: 'Blood Ketones', description: '', category: 'investigation', delayMs: 45000, prerequisites: [], icon: '🧪' },
    { key: 'escalate_registrar', label: 'Escalate Registrar', description: '', category: 'escalation', delayMs: 60000, prerequisites: [], icon: '📞' },
    { key: 'start_iv_fluids', label: 'IV Fluids', description: '', category: 'treatment', delayMs: 120000, prerequisites: [], icon: '💧' },
  ],
  escalation: { newsScoreThreshold: 5, autoEscalateAt: 'critical' },
  treatment: {
    fluidProtocol: { firstBagVolume: 1000, firstBagDurationMinutes: 60, sbpShockedThreshold: 90, subsequentRate: 250 },
    insulinProtocol: { startAfterFluids: true, rateUnitsPerKgPerHr: 0.1, maxRateMlPerHr: 15.0 },
    potassiumProtocol: { checkBeforeInsulin: true, lowThreshold: 3.5, highThreshold: 5.5 },
  },
  deteriorationCurves: {},
  scoring: {
    recognitionTargetMs: 300000,     // 5 min
    escalationTargetMs: 480000,      // 8 min
    treatmentTargetMs: 600000,       // 10 min
    recognitionMaxScore: 20,
    escalationMaxScore: 15,
    treatmentMaxScore: 15,
    outcomeMaxScore: 40,
    actionsMaxScore: 10,
  },
  resources: { ketometerAvailable: true, ketometerUnavailableProbability: 0, labDelayMs: 180000, staffBusyProbability: 0 },
};

const testUser: User = {
  id: 'user-1',
  sessionId: 'session-1',
  name: 'Test Midwife',
  role: 'participant',
  assignedPatientId: 'patient-1',
  joinedAt: 0,
};

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 'patient-1',
    sessionId: 'session-1',
    scenarioPatientKey: 'dka_patient',
    name: 'Sarah Mitchell',
    age: 28,
    height: 165,
    weight: 84,
    gestation: '32+4',
    parity: 'G1P0',
    presentingComplaint: 'Vomiting',
    history: '',
    pmh: '',
    allergies: 'NKDA',
    status: 'stable',
    currentVitals: { hr: 95, bpSystolic: 118, bpDiastolic: 72, rr: 20, spo2: 97, temp: 37.1, gcs: 15 },
    ctgSummary: 'Normal',
    isAlive: true,
    fetalStatus: 'reassuring',
    isDKA: true,
    deteriorationType: 'dka',
    currentStageIndex: 0,
    stageEnteredAtMs: 0,
    availableActions: [],
    completedActions: ['check_glucose', 'check_ketones', 'escalate_registrar', 'start_iv_fluids'],
    pendingActions: [],
    interventionEffects: [],
    arrivedAtMs: 0,
    hasArrived: true,
    ...overrides,
  };
}

describe('ScoringEngine', () => {
  it('should give max score for early recognition on stable DKA patient', () => {
    const events: EventLogEntry[] = [
      {
        id: 'e1', sessionId: 'session-1', patientId: 'patient-1', userId: 'user-1',
        simTimeMs: 120000, // 2 min — well within 5 min target
        type: 'result', category: 'action_result',
        detail: { actionKey: 'check_glucose', isRecognitionEvent: true },
        createdAt: 0,
      },
      {
        id: 'e2', sessionId: 'session-1', patientId: 'patient-1', userId: 'user-1',
        simTimeMs: 240000, // 4 min
        type: 'result', category: 'action_result',
        detail: { actionKey: 'escalate_registrar', isEscalationEvent: true },
        createdAt: 0,
      },
      {
        id: 'e3', sessionId: 'session-1', patientId: 'patient-1', userId: 'user-1',
        simTimeMs: 360000, // 6 min
        type: 'result', category: 'action_result',
        detail: { actionKey: 'start_iv_fluids', isTreatmentEvent: true },
        createdAt: 0,
      },
    ];

    const patient = makePatient();
    const score = scoreParticipant(testUser, patient, events, testConfig);

    expect(score.timeToRecognition).toBe(20); // Max (within target)
    expect(score.timeToEscalation).toBe(15); // Max (within target)
    expect(score.timeToTreatment).toBe(15); // Max (within target)
    expect(score.patientOutcome).toBe(40); // Stable = max
    expect(score.total).toBeGreaterThan(80);
  });

  it('should give zero recognition score when no investigation done', () => {
    const events: EventLogEntry[] = [];
    const patient = makePatient({ completedActions: [] });
    const score = scoreParticipant(testUser, patient, events, testConfig);

    expect(score.timeToRecognition).toBe(0);
    expect(score.timeToEscalation).toBe(0);
    expect(score.timeToTreatment).toBe(0);
  });

  it('should reduce outcome score for critical patient', () => {
    const events: EventLogEntry[] = [];
    const patient = makePatient({ status: 'critical', completedActions: [] });
    const score = scoreParticipant(testUser, patient, events, testConfig);

    expect(score.patientOutcome).toBe(12); // 30% of 40
  });

  it('should give zero outcome score for collapsed patient with IUD', () => {
    const events: EventLogEntry[] = [];
    const patient = makePatient({
      status: 'collapsed',
      fetalStatus: 'iud',
      completedActions: [],
    });
    const score = scoreParticipant(testUser, patient, events, testConfig);

    expect(score.patientOutcome).toBe(0);
  });

  it('should give full timing scores to non-DKA patients', () => {
    const events: EventLogEntry[] = [];
    const patient = makePatient({
      isDKA: false,
      scenarioPatientKey: 'rfm_patient',
      completedActions: ['continuous_ctg', 'maternal_observations'],
    });
    const score = scoreParticipant(testUser, patient, events, testConfig);

    // Non-DKA patients get full timing scores
    expect(score.timeToRecognition).toBe(20);
    expect(score.timeToEscalation).toBe(15);
    expect(score.timeToTreatment).toBe(15);
  });
});
