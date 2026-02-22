import type {
  Patient,
  User,
  EventLogEntry,
  ClinicalRulesConfig,
  ParticipantScore,
  ScoredAction,
} from '@dka-sim/shared';

/**
 * Calculate time-based score: earlier action = more points.
 * Returns 0 if action was never taken, maxScore if taken at or before target.
 * Linear interpolation between target and 3x target (grace period).
 */
function timeScore(actionTimeMs: number | null, targetMs: number, maxScore: number): number {
  if (actionTimeMs === null) return 0;
  if (actionTimeMs <= targetMs) return maxScore;
  const gracePeriod = targetMs * 3;
  if (actionTimeMs >= gracePeriod) return 0;
  const ratio = 1 - (actionTimeMs - targetMs) / (gracePeriod - targetMs);
  return Math.round(ratio * maxScore);
}

/**
 * Calculate outcome score based on final patient status.
 */
function outcomeScore(patient: Patient, maxScore: number): number {
  switch (patient.status) {
    case 'stable':
    case 'resolved':
      return maxScore;
    case 'concerning':
      return Math.round(maxScore * 0.7);
    case 'critical':
      return Math.round(maxScore * 0.3);
    case 'collapsed':
      return patient.fetalStatus === 'iud' ? 0 : Math.round(maxScore * 0.1);
    default:
      return 0;
  }
}

/**
 * Find the sim time of the first event matching criteria.
 */
function findFirstEventTime(
  events: EventLogEntry[],
  patientId: string,
  predicate: (e: EventLogEntry) => boolean,
): number | null {
  const match = events.find((e) => e.patientId === patientId && predicate(e));
  return match ? match.simTimeMs : null;
}

/**
 * Score a single participant.
 */
export function scoreParticipant(
  user: User,
  patient: Patient,
  events: EventLogEntry[],
  config: ClinicalRulesConfig,
): ParticipantScore {
  const scoring = config.scoring;
  const patientEvents = events.filter((e) => e.patientId === patient.id);

  // Time to recognition: first glucose or ketone check
  const recognitionTime = findFirstEventTime(patientEvents, patient.id, (e) =>
    e.type === 'result' &&
    (e.detail?.actionKey === 'check_glucose' || e.detail?.actionKey === 'check_ketones'),
  );

  // Time to escalation: first escalation action
  const escalationTime = findFirstEventTime(patientEvents, patient.id, (e) =>
    e.type === 'result' && (e.detail as Record<string, unknown>)?.isEscalationEvent === true,
  );

  // Time to treatment: first treatment action (IV fluids or insulin)
  const treatmentTime = findFirstEventTime(patientEvents, patient.id, (e) =>
    e.type === 'result' && (e.detail as Record<string, unknown>)?.isTreatmentEvent === true,
  );

  // Score individual actions
  const scoredActions: ScoredAction[] = [];
  const appropriateActionsForDKA = [
    'check_glucose',
    'check_ketones',
    'request_abg',
    'escalate_registrar',
    'start_iv_fluids',
    'start_insulin',
    'continuous_ctg',
    'maternal_observations',
    'check_potassium',
  ];

  const appropriateActionsForPVB = [
    'fbc',
    'group_and_save',
    'continuous_ctg',
    'maternal_observations',
    'escalate_registrar',
  ];

  const appropriateActionsForRFM = ['continuous_ctg', 'maternal_observations'];

  let appropriateSet: string[];
  if (patient.isDKA) {
    appropriateSet = appropriateActionsForDKA;
  } else if (patient.scenarioPatientKey === 'pvb_patient') {
    appropriateSet = appropriateActionsForPVB;
  } else {
    appropriateSet = appropriateActionsForRFM;
  }

  for (const action of patient.completedActions) {
    const wasAppropriate = appropriateSet.includes(action);
    const actionDef = config.investigations.find((a) => a.key === action);
    const actionEvent = patientEvents.find(
      (e) => e.type === 'action' && e.detail?.actionKey === action,
    );

    scoredActions.push({
      actionKey: action,
      label: actionDef?.label ?? action,
      simTimeMs: actionEvent?.simTimeMs ?? 0,
      wasAppropriate,
      points: wasAppropriate ? 1 : 0,
    });
  }

  const appropriateCount = scoredActions.filter((a) => a.wasAppropriate).length;
  const appropriateTotal = appropriateSet.length;
  const appropriateScore = Math.round(
    (appropriateCount / Math.max(appropriateTotal, 1)) * scoring.actionsMaxScore,
  );

  // Only score DKA-specific timing for DKA patient
  const timeToRecognitionScore = patient.isDKA
    ? timeScore(recognitionTime, scoring.recognitionTargetMs, scoring.recognitionMaxScore)
    : scoring.recognitionMaxScore; // Full marks for non-DKA

  const timeToEscalationScore = patient.isDKA
    ? timeScore(escalationTime, scoring.escalationTargetMs, scoring.escalationMaxScore)
    : scoring.escalationMaxScore;

  const timeToTreatmentScore = patient.isDKA
    ? timeScore(treatmentTime, scoring.treatmentTargetMs, scoring.treatmentMaxScore)
    : scoring.treatmentMaxScore;

  const patientOutcomeScore = outcomeScore(patient, scoring.outcomeMaxScore);

  const total =
    patientOutcomeScore +
    timeToRecognitionScore +
    timeToEscalationScore +
    timeToTreatmentScore +
    appropriateScore;

  return {
    userId: user.id,
    userName: user.name,
    patientId: patient.id,
    patientName: patient.name,
    patientOutcome: patientOutcomeScore,
    timeToRecognition: timeToRecognitionScore,
    timeToEscalation: timeToEscalationScore,
    timeToTreatment: timeToTreatmentScore,
    appropriateActions: appropriateScore,
    total,
    actions: scoredActions,
  };
}

/**
 * Score all participants in a session.
 */
export function scoreSession(
  users: User[],
  patients: Patient[],
  events: EventLogEntry[],
  config: ClinicalRulesConfig,
): { scores: ParticipantScore[]; teamScore: number } {
  const participants = users.filter((u) => u.role === 'participant');
  const scores: ParticipantScore[] = [];

  for (const user of participants) {
    const patient = patients.find((p) => p.id === user.assignedPatientId);
    if (!patient) continue;
    scores.push(scoreParticipant(user, patient, events, config));
  }

  const teamScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s.total, 0) / scores.length) : 0;

  return { scores, teamScore };
}
