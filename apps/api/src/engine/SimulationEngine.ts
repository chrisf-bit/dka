import type {
  Session,
  Patient,
  ClinicalRulesConfig,
  EventLogEntry,
  ResourceState,
  ScenarioDefinition,
  DebriefData,
  VitalsSnapshot,
  PatientStatus,
  FetalStatus,
} from '@dka-sim/shared';
import { SIM_TICK_INTERVAL_MS } from '@dka-sim/shared';
import * as db from '../data/db.js';
import { tickDeterioration } from './DeteriorationEngine.js';
import { processCompletedActions } from './ActionProcessor.js';
import { scoreSession } from './ScoringEngine.js';

type EmitFn = (event: string, data: unknown) => void;

interface RunningSimulation {
  sessionId: string;
  interval: ReturnType<typeof setInterval>;
  lastTickTime: number;
}

const runningSimulations = new Map<string, RunningSimulation>();

/**
 * Initialize a session: create patients from scenario, set resources.
 */
export function initializeSession(
  session: Session,
  scenario: ScenarioDefinition,
  config: ClinicalRulesConfig,
): Patient[] {
  const patients: Patient[] = [];

  for (const patientDef of scenario.patients) {
    const patient = db.createPatient({
      sessionId: session.id,
      scenarioPatientKey: patientDef.key,
      name: patientDef.name,
      age: patientDef.age,
      gestation: patientDef.gestation,
      parity: patientDef.parity,
      presentingComplaint: patientDef.presentingComplaint,
      history: patientDef.history,
      pmh: patientDef.pmh,
      allergies: patientDef.allergies,
      status: 'stable',
      currentVitals: patientDef.initialVitals,
      ctgSummary: patientDef.initialCtg,
      isAlive: true,
      fetalStatus: 'reassuring',
      isDKA: patientDef.isDKA,
      deteriorationType: patientDef.deteriorationType,
      currentStageIndex: 0,
      stageEnteredAtMs: 0,
      availableActions: patientDef.availableActions,
      completedActions: [],
      pendingActions: [],
      interventionEffects: [],
      arrivedAtMs: patientDef.arrivalDelayMs,
      hasArrived: patientDef.arrivalDelayMs === 0,
    });
    patients.push(patient);
  }

  // Initialize resources
  const resourceState: ResourceState = {
    ketometerAvailable: config.resources.ketometerAvailable,
    labsAvailable: true,
    staffAvailable: true,
    labDelayMultiplier: 1.0,
  };

  // Apply random ketometer unavailability
  if (
    config.resources.ketometerAvailable &&
    Math.random() < config.resources.ketometerUnavailableProbability
  ) {
    // Ketometer starts unavailable in some sessions
    // (Actually we'll let the timed events handle this for consistency)
  }

  db.setResources(session.id, resourceState);

  return patients;
}

/**
 * Start the simulation clock.
 */
export function startSimulation(
  sessionId: string,
  emit: EmitFn,
): void {
  const session = db.getSession(sessionId);
  if (!session) return;

  // Don't restart if already running
  if (runningSimulations.has(sessionId)) return;

  db.updateSession(sessionId, { status: 'running' });

  const sim: RunningSimulation = {
    sessionId,
    lastTickTime: Date.now(),
    interval: setInterval(() => {
      simulationTick(sessionId, emit);
    }, SIM_TICK_INTERVAL_MS),
  };

  runningSimulations.set(sessionId, sim);
}

/**
 * Pause the simulation.
 */
export function pauseSimulation(sessionId: string): void {
  const sim = runningSimulations.get(sessionId);
  if (sim) {
    clearInterval(sim.interval);
    runningSimulations.delete(sessionId);
  }
  db.updateSession(sessionId, { status: 'paused' });
}

/**
 * Resume the simulation.
 */
export function resumeSimulation(sessionId: string, emit: EmitFn): void {
  startSimulation(sessionId, emit);
}

/**
 * End the simulation and generate debrief.
 */
export function endSimulation(sessionId: string): DebriefData | undefined {
  // Stop the tick
  const sim = runningSimulations.get(sessionId);
  if (sim) {
    clearInterval(sim.interval);
    runningSimulations.delete(sessionId);
  }

  const session = db.getSession(sessionId);
  if (!session) return undefined;

  db.updateSession(sessionId, { status: 'ended', endedAt: Date.now() });

  const updatedSession = db.getSession(sessionId)!;
  const users = db.getUsersBySession(sessionId);
  const patients = db.getPatientsBySession(sessionId);
  const events = db.getEventsBySession(sessionId);
  const configVersion = db.getConfig(session.configId);
  if (!configVersion) return undefined;

  const { scores, teamScore } = scoreSession(users, patients, events, configVersion.config);

  return {
    session: updatedSession,
    scores,
    events,
    patients,
    teamScore,
  };
}

/**
 * Main simulation tick — called every SIM_TICK_INTERVAL_MS.
 */
function simulationTick(sessionId: string, emit: EmitFn): void {
  const session = db.getSession(sessionId);
  if (!session || session.status !== 'running') return;

  const configVersion = db.getConfig(session.configId);
  if (!configVersion) return;
  const config = configVersion.config;

  // Advance sim clock
  const newClockMs = session.simClockMs + SIM_TICK_INTERVAL_MS * session.speedFactor;
  db.updateSession(sessionId, { simClockMs: newClockMs });

  // Emit clock tick
  emit('clock:tick', { simClockMs: newClockMs });

  const patients = db.getPatientsBySession(sessionId);
  const resources = db.getResources(sessionId);
  if (!resources) return;

  // Check for patient arrivals
  for (const patient of patients) {
    if (!patient.hasArrived && newClockMs >= patient.arrivedAtMs) {
      db.updatePatient(patient.id, {
        hasArrived: true,
        stageEnteredAtMs: newClockMs,
      });
      const arrived = db.getPatient(patient.id)!;
      emit('patient:arrived', { patient: arrived });

      db.addEvent({
        sessionId,
        patientId: patient.id,
        simTimeMs: newClockMs,
        type: 'system',
        category: 'arrival',
        detail: { message: `${patient.name} has arrived on Delivery Suite.` },
      });
    }
  }

  // Process each patient
  for (const patient of patients) {
    if (!patient.hasArrived) continue;

    // Get fresh reference
    const current = db.getPatient(patient.id);
    if (!current) continue;

    // Run deterioration
    const detResult = tickDeterioration(current, newClockMs, config);

    // Process completed actions
    const actionResults = processCompletedActions(
      db.getPatient(patient.id)!,
      newClockMs,
      config,
    );

    // Emit vitals update
    if (detResult.vitalsChanged) {
      const updated = db.getPatient(patient.id)!;
      emit('patient:vitalsUpdate', {
        patientId: patient.id,
        vitals: updated.currentVitals,
        status: updated.status,
        fetalStatus: updated.fetalStatus,
        ctgSummary: updated.ctgSummary,
      });
    }

    // Emit status change
    if (detResult.statusChanged) {
      emit('patient:statusChange', {
        patientId: patient.id,
        oldStatus: detResult.oldStatus,
        newStatus: detResult.newStatus,
      });

      // Log event
      const logEntry = db.addEvent({
        sessionId,
        patientId: patient.id,
        simTimeMs: newClockMs,
        type: 'deterioration',
        category: 'status_change',
        detail: {
          message: `${patient.name}: ${detResult.oldStatus} → ${detResult.newStatus}`,
          oldStatus: detResult.oldStatus,
          newStatus: detResult.newStatus,
        },
      });
      emit('event:logged', { event: logEntry });

      // Fire alert for concerning and above
      const severity =
        detResult.newStatus === 'collapsed'
          ? 'critical'
          : detResult.newStatus === 'critical'
            ? 'high'
            : detResult.newStatus === 'concerning'
              ? 'medium'
              : 'low';

      emit('alert:fire', {
        patientId: patient.id,
        message: `${patient.name} is now ${detResult.newStatus}`,
        severity,
      });
    }

    // Emit action results
    for (const ar of actionResults) {
      emit('action:result', {
        patientId: patient.id,
        actionKey: ar.actionKey,
        result: ar.result,
      });

      // Log result event
      const logEntry = db.addEvent({
        sessionId,
        patientId: patient.id,
        simTimeMs: newClockMs,
        type: 'result',
        category: 'action_result',
        detail: { actionKey: ar.actionKey, ...ar.result },
      });
      emit('event:logged', { event: logEntry });
    }
  }

  // Check timed events from scenario
  const scenario = db.getScenario(session.scenarioId);
  if (scenario) {
    for (const timedEvent of scenario.timedEvents) {
      // Check if we've just crossed the trigger time
      const prevClock = newClockMs - SIM_TICK_INTERVAL_MS * session.speedFactor;
      if (prevClock < timedEvent.triggerAtMs && newClockMs >= timedEvent.triggerAtMs) {
        handleTimedEvent(sessionId, timedEvent, newClockMs, emit);
      }
    }
  }

  // Auto-end if duration exceeded
  if (scenario && newClockMs >= scenario.durationMinutes * 60 * 1000) {
    const debrief = endSimulation(sessionId);
    if (debrief) {
      emit('session:ended', { debrief });
    }
  }
}

/**
 * Handle a timed scenario event.
 */
function handleTimedEvent(
  sessionId: string,
  timedEvent: { type: string; payload: Record<string, unknown> },
  simClockMs: number,
  emit: EmitFn,
): void {
  const payload = timedEvent.payload;

  switch (timedEvent.type) {
    case 'resource_change': {
      const resource = payload.resource as string;
      const available = payload.available as boolean;
      const message = payload.message as string;

      const updates: Partial<ResourceState> = {};
      if (resource === 'ketometer') updates.ketometerAvailable = available;
      if (resource === 'labs') updates.labsAvailable = available;
      if (resource === 'staff') updates.staffAvailable = available;

      db.updateResources(sessionId, updates);
      emit('resource:changed', { resource, available });

      const logEntry = db.addEvent({
        sessionId,
        simTimeMs: simClockMs,
        type: 'injection',
        category: 'resource_change',
        detail: { resource, available, message },
      });
      emit('event:logged', { event: logEntry });

      if (message) {
        emit('alert:fire', {
          patientId: '',
          message,
          severity: 'info',
        });
      }
      break;
    }

    case 'message': {
      const message = payload.message as string;
      const logEntry = db.addEvent({
        sessionId,
        simTimeMs: simClockMs,
        type: 'injection',
        category: 'message',
        detail: { message },
      });
      emit('event:logged', { event: logEntry });
      emit('alert:fire', {
        patientId: '',
        message,
        severity: 'info',
      });
      break;
    }

    case 'staff_change': {
      const available = payload.available as boolean;
      db.updateResources(sessionId, { staffAvailable: available });
      emit('resource:changed', { resource: 'staff', available });

      const logEntry = db.addEvent({
        sessionId,
        simTimeMs: simClockMs,
        type: 'injection',
        category: 'staff_change',
        detail: payload,
      });
      emit('event:logged', { event: logEntry });
      break;
    }
  }
}
