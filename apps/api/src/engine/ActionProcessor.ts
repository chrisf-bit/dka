import type {
  Patient,
  ClinicalRulesConfig,
  ActionDefinition,
  ResourceState,
  PendingAction,
} from '@dka-sim/shared';
import * as db from '../data/db.js';
import { applyIntervention } from './DeteriorationEngine.js';

/**
 * Get an action definition from the config.
 */
export function getActionDef(
  config: ClinicalRulesConfig,
  actionKey: string,
): ActionDefinition | undefined {
  return config.investigations.find((a) => a.key === actionKey);
}

/**
 * Check if a participant can perform an action.
 */
export function canPerformAction(
  patient: Patient,
  actionKey: string,
  config: ClinicalRulesConfig,
  resources: ResourceState,
): { allowed: boolean; reason?: string } {
  const actionDef = getActionDef(config, actionKey);
  if (!actionDef) return { allowed: false, reason: 'Unknown action.' };

  // Check if action already completed
  if (patient.completedActions.includes(actionKey)) {
    return { allowed: false, reason: 'Already completed.' };
  }

  // Check if action already pending
  if (patient.pendingActions.some((pa) => pa.actionKey === actionKey)) {
    return { allowed: false, reason: 'Already in progress.' };
  }

  // Check prerequisites
  for (const prereq of actionDef.prerequisites) {
    if (!patient.completedActions.includes(prereq)) {
      const prereqDef = getActionDef(config, prereq);
      return {
        allowed: false,
        reason: `Requires ${prereqDef?.label ?? prereq} first.`,
      };
    }
  }

  // Check if action is available for this patient
  if (!patient.availableActions.includes(actionKey)) {
    return { allowed: false, reason: 'Not available for this patient.' };
  }

  // Check resource availability
  if (actionKey === 'check_ketones' && !resources.ketometerAvailable) {
    return {
      allowed: false,
      reason: 'Ketone meter not available on the unit.',
    };
  }

  if (
    ['fbc', 'group_and_save', 'crossmatch', 'check_potassium', 'check_lactate'].includes(
      actionKey,
    ) &&
    !resources.labsAvailable
  ) {
    return { allowed: false, reason: 'Lab services currently delayed.' };
  }

  return { allowed: true };
}

/**
 * Submit an action for a patient. Returns the pending action with delay.
 */
export function submitAction(
  patient: Patient,
  actionKey: string,
  userId: string,
  simClockMs: number,
  config: ClinicalRulesConfig,
  resources: ResourceState,
): { pending: PendingAction; delayMs: number } | { error: string } {
  const check = canPerformAction(patient, actionKey, config, resources);
  if (!check.allowed) return { error: check.reason! };

  const actionDef = getActionDef(config, actionKey)!;

  // Calculate delay (may be extended by lab delays)
  let delayMs = actionDef.delayMs;
  if (actionDef.category === 'investigation' && actionDef.key !== 'check_glucose' && actionDef.key !== 'check_ketones') {
    delayMs = Math.round(delayMs * resources.labDelayMultiplier);
  }

  const pending: PendingAction = {
    actionKey,
    submittedAtMs: simClockMs,
    completesAtMs: simClockMs + delayMs,
    userId,
  };

  const pendingActions = [...patient.pendingActions, pending];
  db.updatePatient(patient.id, { pendingActions });

  return { pending, delayMs };
}

/**
 * Process completed pending actions for a patient.
 * Returns results for completed actions.
 */
export function processCompletedActions(
  patient: Patient,
  simClockMs: number,
  config: ClinicalRulesConfig,
): { actionKey: string; result: Record<string, unknown> }[] {
  const completed: { actionKey: string; result: Record<string, unknown> }[] = [];
  const stillPending: PendingAction[] = [];

  for (const pa of patient.pendingActions) {
    if (simClockMs >= pa.completesAtMs) {
      // Action completed — generate result
      const result = generateActionResult(patient, pa.actionKey, config, simClockMs);
      completed.push({ actionKey: pa.actionKey, result });

      // Mark action as completed
      const updatedCompleted = [...patient.completedActions, pa.actionKey];
      db.updatePatient(patient.id, { completedActions: updatedCompleted });

      // Refresh patient reference after update
      const refreshed = db.getPatient(patient.id);
      if (refreshed) Object.assign(patient, refreshed);
    } else {
      stillPending.push(pa);
    }
  }

  if (completed.length > 0) {
    db.updatePatient(patient.id, { pendingActions: stillPending });
  }

  return completed;
}

/**
 * Generate a result for a completed action based on patient type and state.
 */
function generateActionResult(
  patient: Patient,
  actionKey: string,
  config: ClinicalRulesConfig,
  simClockMs: number,
): Record<string, unknown> {
  const curve = config.deteriorationCurves[patient.deteriorationType];
  const currentStage = curve?.stages[patient.currentStageIndex];

  switch (actionKey) {
    case 'check_glucose': {
      // For DKA patient, reveal high glucose; for others, normal
      const glucose = patient.isDKA
        ? currentStage?.vitals.glucose ?? 14.2
        : 4.5 + Math.random() * 1.5;
      const rounded = Math.round(glucose * 10) / 10;
      db.updatePatient(patient.id, {
        currentVitals: { ...patient.currentVitals, glucose: rounded },
      });
      return {
        label: 'Blood Glucose',
        value: `${rounded} mmol/L`,
        normal: rounded < config.dkaTriggers.glucoseThreshold,
        flag:
          rounded >= config.dkaTriggers.glucoseThreshold
            ? 'HIGH — Consider DKA. Check ketones urgently.'
            : undefined,
      };
    }

    case 'check_ketones': {
      const ketones = patient.isDKA
        ? currentStage?.vitals.ketones ?? 4.1
        : 0.1 + Math.random() * 0.3;
      const rounded = Math.round(ketones * 10) / 10;
      db.updatePatient(patient.id, {
        currentVitals: { ...patient.currentVitals, ketones: rounded },
      });

      if (patient.isDKA && rounded >= config.dkaTriggers.ketoneThreshold) {
        // DKA confirmed — this is the key recognition moment
        return {
          label: 'Blood Ketones',
          value: `${rounded} mmol/L`,
          normal: false,
          flag: 'CRITICAL — Ketones significantly raised. DKA suspected. Escalate immediately and commence DKA pathway.',
          isRecognitionEvent: true,
        };
      }
      return {
        label: 'Blood Ketones',
        value: `${rounded} mmol/L`,
        normal: rounded < config.dkaTriggers.ketoneThreshold,
      };
    }

    case 'request_abg': {
      const pH = patient.isDKA ? currentStage?.vitals.pH ?? 7.28 : 7.38 + Math.random() * 0.04;
      const bicarb = patient.isDKA
        ? currentStage?.vitals.bicarb ?? 12
        : 22 + Math.random() * 4;
      const roundedPH = Math.round(pH * 100) / 100;
      const roundedBicarb = Math.round(bicarb * 10) / 10;
      db.updatePatient(patient.id, {
        currentVitals: { ...patient.currentVitals, pH: roundedPH, bicarb: roundedBicarb },
      });
      return {
        label: 'Arterial Blood Gas',
        value: `pH ${roundedPH}, HCO₃⁻ ${roundedBicarb} mmol/L`,
        normal: roundedPH >= config.dkaTriggers.phThreshold,
        flag:
          roundedPH < config.dkaTriggers.phThreshold
            ? 'Metabolic acidosis — consistent with DKA.'
            : undefined,
      };
    }

    case 'check_potassium': {
      // K+ can be normal or high in DKA (despite total body depletion)
      const k = patient.isDKA ? 4.8 + Math.random() * 1.5 : 3.8 + Math.random() * 0.8;
      const rounded = Math.round(k * 10) / 10;
      return {
        label: 'Serum Potassium',
        value: `${rounded} mmol/L`,
        normal: rounded >= 3.5 && rounded <= 5.5,
        flag:
          rounded > 5.5
            ? 'Elevated — monitor closely. May drop rapidly with insulin.'
            : rounded < 3.5
              ? 'Low — replace before starting insulin.'
              : undefined,
      };
    }

    case 'check_lactate': {
      const lactate = patient.isDKA ? 2.5 + Math.random() * 2 : 0.5 + Math.random() * 1;
      const rounded = Math.round(lactate * 10) / 10;
      return {
        label: 'Lactate',
        value: `${rounded} mmol/L`,
        normal: rounded < 2.0,
        flag: rounded >= 2.0 ? 'Elevated lactate — consider cause.' : undefined,
      };
    }

    case 'fbc': {
      const wbc = patient.isDKA ? 14 + Math.random() * 6 : 6 + Math.random() * 4;
      const hb = patient.scenarioPatientKey === 'pvb_patient' ? 95 + Math.random() * 15 : 115 + Math.random() * 20;
      return {
        label: 'Full Blood Count',
        value: `WBC ${Math.round(wbc * 10) / 10}, Hb ${Math.round(hb)}, Plt 220`,
        normal: wbc < 11 && hb > 110,
        flag: wbc >= 11 ? 'Raised WCC — may be stress response or infection.' : undefined,
      };
    }

    case 'group_and_save': {
      return {
        label: 'Group & Save',
        value: 'O Rhesus Positive. Antibody screen negative.',
        normal: true,
      };
    }

    case 'crossmatch': {
      return {
        label: 'Crossmatch',
        value: '2 units crossmatched and available.',
        normal: true,
      };
    }

    case 'maternal_observations': {
      const vitals = patient.currentVitals;
      return {
        label: 'Maternal Observations',
        value: `HR ${vitals.hr}, BP ${vitals.bpSystolic}/${vitals.bpDiastolic}, RR ${vitals.rr}, SpO₂ ${vitals.spo2}%, Temp ${vitals.temp}°C`,
        normal: vitals.hr < 100 && vitals.rr < 22 && vitals.spo2 > 95,
      };
    }

    case 'continuous_ctg': {
      return {
        label: 'Continuous CTG',
        value: patient.ctgSummary,
        normal: patient.fetalStatus === 'reassuring',
        flag:
          patient.fetalStatus !== 'reassuring'
            ? `CTG classification: ${patient.fetalStatus.replace('_', '-')}`
            : undefined,
      };
    }

    case 'speculum_exam': {
      if (patient.scenarioPatientKey === 'pvb_patient') {
        return {
          label: 'Speculum Examination',
          value: 'Os closed. Small amount of blood in vagina. No active bleeding seen. Cervix appears normal.',
          normal: true,
        };
      }
      return {
        label: 'Speculum Examination',
        value: 'Os closed. No bleeding. Cervix appears normal.',
        normal: true,
      };
    }

    case 'request_ultrasound': {
      if (patient.scenarioPatientKey === 'pvb_patient') {
        return {
          label: 'Ultrasound',
          value: 'Placenta posterior, upper segment. Small retroplacental collection (2cm). No previa. Fetal biometry appropriate. Liquor volume normal.',
          normal: false,
          flag: 'Small retroplacental collection — consistent with marginal abruption. Advise ongoing monitoring.',
        };
      }
      return {
        label: 'Ultrasound',
        value: 'Normal fetal biometry. Placenta not low-lying. Liquor volume normal.',
        normal: true,
      };
    }

    case 'escalate_registrar': {
      if (patient.isDKA) {
        // Slows deterioration
        applyIntervention(patient.id, 'slow', simClockMs, 1.5);
      }
      return {
        label: 'Escalation — Registrar',
        value: 'Registrar notified and reviewing. Will attend within 10 minutes.',
        normal: true,
        isEscalationEvent: true,
      };
    }

    case 'escalate_consultant': {
      if (patient.isDKA) {
        applyIntervention(patient.id, 'slow', simClockMs, 2.0);
      }
      return {
        label: 'Escalation — Consultant',
        value: 'Consultant contacted. Attending urgently.',
        normal: true,
        isEscalationEvent: true,
      };
    }

    case 'start_iv_fluids': {
      if (patient.isDKA) {
        // Significant slowing of deterioration
        applyIntervention(patient.id, 'slow', simClockMs, 3.0);
      }
      return {
        label: 'IV Fluids',
        value: `IV access obtained. ${config.treatment.fluidProtocol.firstBagVolume}mL 0.9% NaCl commenced over ${config.treatment.fluidProtocol.firstBagRateMinutes} minutes.`,
        normal: true,
        isTreatmentEvent: true,
      };
    }

    case 'start_insulin': {
      if (patient.isDKA) {
        // Halts and begins reversal
        applyIntervention(patient.id, 'halt', simClockMs);
      }
      return {
        label: 'Insulin Infusion',
        value: `Fixed-rate insulin infusion commenced at ${config.treatment.insulinProtocol.rate} units/kg/hr.`,
        normal: true,
        isTreatmentEvent: true,
      };
    }

    case 'start_potassium_replacement': {
      return {
        label: 'Potassium Replacement',
        value: 'Potassium replacement commenced as per protocol.',
        normal: true,
        isTreatmentEvent: true,
      };
    }

    default:
      return { label: actionKey, value: 'Completed.', normal: true };
  }
}
