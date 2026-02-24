import { describe, it, expect, beforeEach } from 'vitest';
import { tickDeterioration, applyIntervention } from '../DeteriorationEngine.js';
import * as db from '../../data/db.js';
import type { Patient, ClinicalRulesConfig } from '@dka-sim/shared';

// Minimal clinical config for testing
const testConfig: ClinicalRulesConfig = {
  version: 1,
  dkaTriggers: {
    glucoseThreshold: 11.0,
    ketoneThreshold: 3.0,
    phThreshold: 7.3,
    bicarbThreshold: 15,
  },
  investigations: [],
  escalation: { newsScoreThreshold: 5, autoEscalateAt: 'critical' },
  treatment: {
    fluidProtocol: { firstBagVolume: 1000, firstBagDurationMinutes: 60, sbpShockedThreshold: 90, subsequentRate: 250 },
    insulinProtocol: { startAfterFluids: true, rateUnitsPerKgPerHr: 0.1, maxRateMlPerHr: 15.0 },
    potassiumProtocol: { checkBeforeInsulin: true, lowThreshold: 3.5, highThreshold: 5.5 },
  },
  deteriorationCurves: {
    dka: {
      stages: [
        {
          name: 'stable',
          durationMs: 300000, // 5 min
          vitals: { hr: 95, bpSystolic: 118, bpDiastolic: 72, rr: 20, spo2: 97, temp: 37.1, gcs: 15, glucose: 14.2, ketones: 4.1, pH: 7.28, bicarb: 14 },
          ctgSummary: 'Normal baseline',
          fetalStatus: 'reassuring',
        },
        {
          name: 'concerning',
          durationMs: 300000,
          vitals: { hr: 110, bpSystolic: 110, bpDiastolic: 68, rr: 26, spo2: 96, temp: 37.0, gcs: 15, glucose: 18.5, ketones: 5.2, pH: 7.22, bicarb: 10 },
          ctgSummary: 'Reduced variability',
          fetalStatus: 'non_reassuring',
        },
        {
          name: 'critical',
          durationMs: 300000,
          vitals: { hr: 130, bpSystolic: 95, bpDiastolic: 55, rr: 34, spo2: 93, temp: 36.5, gcs: 13, glucose: 25.0, ketones: 6.5, pH: 7.10, bicarb: 6 },
          ctgSummary: 'Late decelerations',
          fetalStatus: 'pathological',
        },
      ],
    },
    rfm: {
      stages: [
        {
          name: 'stable',
          durationMs: 120000,
          vitals: { hr: 78, bpSystolic: 115, bpDiastolic: 70, rr: 16, spo2: 99, temp: 36.6, gcs: 15 },
          ctgSummary: 'Reactive trace',
          fetalStatus: 'reassuring',
        },
        {
          name: 'resolved',
          durationMs: 120000,
          vitals: { hr: 75, bpSystolic: 115, bpDiastolic: 70, rr: 16, spo2: 99, temp: 36.6, gcs: 15 },
          ctgSummary: 'Normal reactive trace',
          fetalStatus: 'reassuring',
        },
      ],
    },
  },
  scoring: {
    recognitionTargetMs: 300000,
    escalationTargetMs: 480000,
    treatmentTargetMs: 600000,
    recognitionMaxScore: 20,
    escalationMaxScore: 15,
    treatmentMaxScore: 15,
    outcomeMaxScore: 40,
    actionsMaxScore: 10,
  },
  resources: {
    ketometerAvailable: true,
    ketometerUnavailableProbability: 0,
    labDelayMs: 180000,
    staffBusyProbability: 0,
  },
};

function createTestPatient(overrides: Partial<Patient> = {}): Patient {
  return db.createPatient({
    sessionId: 'test-session',
    scenarioPatientKey: 'dka_patient',
    name: 'Test Patient',
    age: 28,
    height: 165,
    weight: 84,
    gestation: '32+4',
    parity: 'G1P0',
    presentingComplaint: 'Test',
    history: 'Test',
    pmh: 'None',
    allergies: 'NKDA',
    status: 'stable',
    currentVitals: { hr: 95, bpSystolic: 118, bpDiastolic: 72, rr: 20, spo2: 97, temp: 37.1, gcs: 15 },
    ctgSummary: 'Normal baseline',
    isAlive: true,
    fetalStatus: 'reassuring',
    isDKA: true,
    deteriorationType: 'dka',
    currentStageIndex: 0,
    stageEnteredAtMs: 0,
    availableActions: [],
    completedActions: [],
    pendingActions: [],
    interventionEffects: [],
    arrivedAtMs: 0,
    hasArrived: true,
    ...overrides,
  });
}

describe('DeteriorationEngine', () => {
  it('should return no changes when patient has not arrived', () => {
    const patient = createTestPatient({ hasArrived: false });
    const result = tickDeterioration(patient, 1000, testConfig);
    expect(result.vitalsChanged).toBe(false);
    expect(result.statusChanged).toBe(false);
  });

  it('should update vitals during stable stage', () => {
    const patient = createTestPatient();
    const result = tickDeterioration(patient, 150000, testConfig); // 2.5 min into 5 min stage
    expect(result.vitalsChanged).toBe(true);
  });

  it('should advance to next stage after stage duration', () => {
    const patient = createTestPatient({ stageEnteredAtMs: 0 });
    const result = tickDeterioration(patient, 310000, testConfig); // Past 5 min
    // Check patient was updated
    const updated = db.getPatient(patient.id);
    expect(updated!.currentStageIndex).toBe(1);
  });

  it('should change status when advancing stages', () => {
    const patient = createTestPatient({ stageEnteredAtMs: 0 });
    const result = tickDeterioration(patient, 310000, testConfig);
    expect(result.statusChanged).toBe(true);
    expect(result.newStatus).toBe('concerning');
  });

  it('should halt deterioration when halt intervention applied', () => {
    const patient = createTestPatient({ stageEnteredAtMs: 0 });
    applyIntervention(patient.id, 'halt', 100000);

    const updated = db.getPatient(patient.id)!;
    const result = tickDeterioration(updated, 400000, testConfig); // Well past stage duration

    const final = db.getPatient(patient.id)!;
    // Should NOT advance to next stage
    expect(final.currentStageIndex).toBe(0);
  });

  it('should slow deterioration when slow intervention applied', () => {
    const patient = createTestPatient({ stageEnteredAtMs: 0 });
    applyIntervention(patient.id, 'slow', 0, 2.0); // Double the duration

    const updated = db.getPatient(patient.id)!;
    // At 310000ms, without slow it would advance (300000ms stage)
    // With 2x slow, stage is 600000ms, so should NOT advance
    tickDeterioration(updated, 310000, testConfig);
    const afterTick = db.getPatient(patient.id)!;
    expect(afterTick.currentStageIndex).toBe(0);

    // At 610000ms it should advance
    tickDeterioration(db.getPatient(patient.id)!, 610000, testConfig);
    const afterLaterTick = db.getPatient(patient.id)!;
    expect(afterLaterTick.currentStageIndex).toBe(1);
  });

  it('should handle benign patient (rfm) that resolves', () => {
    const patient = createTestPatient({
      deteriorationType: 'rfm',
      isDKA: false,
      currentVitals: { hr: 78, bpSystolic: 115, bpDiastolic: 70, rr: 16, spo2: 99, temp: 36.6, gcs: 15 },
    });

    // At 130000ms, should advance from stable to resolved
    tickDeterioration(patient, 130000, testConfig);
    const updated = db.getPatient(patient.id)!;
    expect(updated.currentStageIndex).toBe(1);
  });

  it('should reverse stage when reverse intervention applied', () => {
    // Start at stage 1
    const patient = createTestPatient({
      currentStageIndex: 1,
      stageEnteredAtMs: 300000,
      status: 'concerning',
    });

    applyIntervention(patient.id, 'reverse', 400000);
    const updated = db.getPatient(patient.id)!;
    expect(updated.currentStageIndex).toBe(0);
  });
});
