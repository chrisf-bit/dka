import type {
  Patient,
  VitalsSnapshot,
  ClinicalRulesConfig,
  DeteriorationStage,
  PatientStatus,
  FetalStatus,
} from '@dka-sim/shared';
import * as db from '../data/db.js';

/**
 * Interpolates between two vitals snapshots based on progress (0-1).
 */
function interpolateVitals(
  from: VitalsSnapshot,
  to: VitalsSnapshot,
  progress: number,
): VitalsSnapshot {
  const lerp = (a: number, b: number) => a + (b - a) * progress;
  const lerpOpt = (a: number | undefined, b: number | undefined) => {
    if (a === undefined && b === undefined) return undefined;
    return lerp(a ?? b!, b ?? a!);
  };

  return {
    hr: Math.round(lerp(from.hr, to.hr)),
    bpSystolic: Math.round(lerp(from.bpSystolic, to.bpSystolic)),
    bpDiastolic: Math.round(lerp(from.bpDiastolic, to.bpDiastolic)),
    rr: Math.round(lerp(from.rr, to.rr)),
    spo2: Math.round(lerp(from.spo2, to.spo2) * 10) / 10,
    temp: Math.round(lerp(from.temp, to.temp) * 10) / 10,
    gcs: Math.round(lerp(from.gcs, to.gcs)),
    glucose: lerpOpt(from.glucose, to.glucose),
    ketones: lerpOpt(from.ketones, to.ketones),
    pH: lerpOpt(from.pH, to.pH) !== undefined
      ? Math.round(lerpOpt(from.pH, to.pH)! * 100) / 100
      : undefined,
    bicarb: lerpOpt(from.bicarb, to.bicarb) !== undefined
      ? Math.round(lerpOpt(from.bicarb, to.bicarb)! * 10) / 10
      : undefined,
  };
}

/**
 * Maps stage name to PatientStatus.
 */
function stageToStatus(stageName: string): PatientStatus {
  const map: Record<string, PatientStatus> = {
    stable: 'stable',
    concerning: 'concerning',
    critical: 'critical',
    collapsed: 'collapsed',
    crash_call: 'collapsed',
    resolved: 'resolved',
  };
  return map[stageName] ?? 'stable';
}

/**
 * Get the effective duration of a stage considering intervention slow effects.
 */
function getEffectiveDuration(patient: Patient, baseDuration: number): number {
  let slowFactor = 1.0;
  for (const effect of patient.interventionEffects) {
    if (effect.type === 'slow' && effect.slowFactor) {
      slowFactor *= effect.slowFactor;
    }
  }
  return baseDuration * slowFactor;
}

/**
 * Check if deterioration is halted by interventions.
 */
function isHalted(patient: Patient): boolean {
  return patient.interventionEffects.some((e) => e.type === 'halt');
}

export interface DeteriorationResult {
  vitalsChanged: boolean;
  statusChanged: boolean;
  oldStatus?: PatientStatus;
  newStatus?: PatientStatus;
  fetalStatusChanged: boolean;
  oldFetalStatus?: FetalStatus;
  newFetalStatus?: FetalStatus;
}

/**
 * Runs one tick of deterioration for a patient.
 */
export function tickDeterioration(
  patient: Patient,
  simClockMs: number,
  config: ClinicalRulesConfig,
): DeteriorationResult {
  const result: DeteriorationResult = {
    vitalsChanged: false,
    statusChanged: false,
    fetalStatusChanged: false,
  };

  // Skip if patient hasn't arrived yet
  if (!patient.hasArrived) return result;

  const curve = config.deteriorationCurves[patient.deteriorationType];
  if (!curve || curve.stages.length === 0) return result;

  const stages = curve.stages;
  const currentIndex = patient.currentStageIndex;
  const currentStage = stages[currentIndex];
  if (!currentStage) return result;

  // If halted, just update vitals to current stage target (no progression)
  if (isHalted(patient)) {
    const newVitals = { ...currentStage.vitals };
    // Preserve revealed values
    if (patient.currentVitals.glucose !== undefined) newVitals.glucose = patient.currentVitals.glucose;
    if (patient.currentVitals.ketones !== undefined) newVitals.ketones = patient.currentVitals.ketones;
    if (patient.currentVitals.pH !== undefined) newVitals.pH = patient.currentVitals.pH;
    if (patient.currentVitals.bicarb !== undefined) newVitals.bicarb = patient.currentVitals.bicarb;

    db.updatePatient(patient.id, { currentVitals: newVitals });
    result.vitalsChanged = true;
    return result;
  }

  // Calculate progress within current stage
  const timeInStage = simClockMs - patient.stageEnteredAtMs;
  const effectiveDuration = getEffectiveDuration(patient, currentStage.durationMs);

  // Determine interpolation targets
  const fromVitals = currentIndex > 0 ? stages[currentIndex - 1].vitals : patient.currentVitals;
  const toVitals = currentStage.vitals;
  const progress = Math.min(timeInStage / effectiveDuration, 1.0);

  // Interpolate vitals
  const interpolated = interpolateVitals(fromVitals, toVitals, progress);

  // Preserve revealed lab values (don't overwrite with undefined)
  if (patient.currentVitals.glucose !== undefined && interpolated.glucose === undefined) {
    interpolated.glucose = patient.currentVitals.glucose;
  }
  if (patient.currentVitals.ketones !== undefined && interpolated.ketones === undefined) {
    interpolated.ketones = patient.currentVitals.ketones;
  }
  if (patient.currentVitals.pH !== undefined && interpolated.pH === undefined) {
    interpolated.pH = patient.currentVitals.pH;
  }
  if (patient.currentVitals.bicarb !== undefined && interpolated.bicarb === undefined) {
    interpolated.bicarb = patient.currentVitals.bicarb;
  }

  // Add some random variation (±1-2%)
  const jitter = (val: number, range: number) =>
    Math.round((val + (Math.random() - 0.5) * range) * 10) / 10;

  interpolated.hr = Math.round(jitter(interpolated.hr, 4));
  interpolated.rr = Math.round(jitter(interpolated.rr, 2));
  interpolated.spo2 = Math.min(100, Math.round(jitter(interpolated.spo2, 1)));

  const newStatus = stageToStatus(currentStage.name);
  const oldStatus = patient.status;
  const newFetalStatus = currentStage.fetalStatus;
  const oldFetalStatus = patient.fetalStatus;

  const updates: Partial<Patient> = {
    currentVitals: interpolated,
    ctgSummary: currentStage.ctgSummary,
  };

  // Update status if changed
  if (newStatus !== oldStatus) {
    updates.status = newStatus;
    result.statusChanged = true;
    result.oldStatus = oldStatus;
    result.newStatus = newStatus;
  }

  // Update fetal status if changed
  if (newFetalStatus !== oldFetalStatus) {
    updates.fetalStatus = newFetalStatus;
    result.fetalStatusChanged = true;
    result.oldFetalStatus = oldFetalStatus;
    result.newFetalStatus = newFetalStatus;
  }

  // Check for stage advancement
  if (timeInStage >= effectiveDuration && currentIndex < stages.length - 1) {
    const nextStage = stages[currentIndex + 1];
    updates.currentStageIndex = currentIndex + 1;
    updates.stageEnteredAtMs = simClockMs;

    // Update status from new stage
    const advancedStatus = stageToStatus(nextStage.name);
    if (advancedStatus !== (updates.status ?? patient.status)) {
      updates.status = advancedStatus;
      result.statusChanged = true;
      result.oldStatus = patient.status;
      result.newStatus = advancedStatus;
    }

    // Update fetal status from new stage
    if (nextStage.fetalStatus !== (updates.fetalStatus ?? patient.fetalStatus)) {
      updates.fetalStatus = nextStage.fetalStatus;
      result.fetalStatusChanged = true;
      result.oldFetalStatus = patient.fetalStatus;
      result.newFetalStatus = nextStage.fetalStatus;
    }

    if (nextStage.fetalStatus === 'iud') {
      updates.isAlive = true; // Mother still alive in crash_call
    }
  }

  db.updatePatient(patient.id, updates);
  result.vitalsChanged = true;

  return result;
}

/**
 * Apply intervention effect to a patient.
 */
export function applyIntervention(
  patientId: string,
  type: 'halt' | 'reverse' | 'slow',
  simClockMs: number,
  slowFactor?: number,
): void {
  const patient = db.getPatient(patientId);
  if (!patient) return;

  const effect = {
    type,
    appliedAtMs: simClockMs,
    slowFactor,
  };

  const effects = [...patient.interventionEffects, effect];

  const updates: Partial<Patient> = { interventionEffects: effects };

  if (type === 'reverse' && patient.currentStageIndex > 0) {
    updates.currentStageIndex = patient.currentStageIndex - 1;
    updates.stageEnteredAtMs = simClockMs;
  }

  db.updatePatient(patientId, updates);
}
