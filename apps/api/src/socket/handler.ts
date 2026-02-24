import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SessionState,
  User,
} from '@dka-sim/shared';
import { generateSessionCode } from '@dka-sim/shared';
import {
  JoinSessionSchema,
  CreateSessionSchema,
  AssignPatientSchema,
  SubmitActionSchema,
  ToggleResourceSchema,
  InjectEventSchema,
} from '@dka-sim/shared';
import * as db from '../data/db.js';
import {
  initializeSession,
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  endSimulation,
} from '../engine/SimulationEngine.js';
import { submitAction, canPerformAction, getActionDef } from '../engine/ActionProcessor.js';

// Track socket → userId mapping
const socketUserMap = new Map<string, string>();

export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
): void {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ─── Create Session (Facilitator) ─────────────────────────────────
    socket.on('facilitator:create', (data) => {
      try {
        const parsed = CreateSessionSchema.parse(data);
        const scenario = db.getScenario(parsed.scenarioId);
        if (!scenario) {
          socket.emit('session:error', { message: 'Scenario not found.' });
          return;
        }

        const latestConfig = db.getLatestConfig();
        if (!latestConfig) {
          socket.emit('session:error', { message: 'No clinical config found.' });
          return;
        }

        const code = generateSessionCode();

        const session = db.createSession({
          code,
          scenarioId: parsed.scenarioId,
          configId: latestConfig.id,
          status: 'lobby',
          simClockMs: 0,
          speedFactor: 1.0,
          facilitatorPin: parsed.pin,
        });

        // Initialize patients from scenario
        initializeSession(session, scenario, latestConfig.config);

        // Create facilitator user
        const user = db.createUser({
          sessionId: session.id,
          name: 'Facilitator',
          role: 'facilitator',
          socketId: socket.id,
        });

        socketUserMap.set(socket.id, user.id);
        socket.join(session.id);

        socket.emit('session:created', { session, userId: user.id });

        // Send full state
        emitSessionState(socket, session.id, user.id);
      } catch (err) {
        socket.emit('session:error', {
          message: err instanceof Error ? err.message : 'Invalid request.',
        });
      }
    });

    // ─── Join Session (Participant) ───────────────────────────────────
    socket.on('join:session', (data) => {
      try {
        const parsed = JoinSessionSchema.parse(data);
        const session = db.getSessionByCode(parsed.code.toUpperCase());
        if (!session) {
          socket.emit('session:error', { message: 'Session not found. Check your code.' });
          return;
        }

        if (session.status === 'ended') {
          socket.emit('session:error', { message: 'This session has ended.' });
          return;
        }

        // Create participant user
        const user = db.createUser({
          sessionId: session.id,
          name: parsed.name,
          role: 'participant',
          socketId: socket.id,
        });

        socketUserMap.set(socket.id, user.id);
        socket.join(session.id);

        // Notify all in session
        io.to(session.id).emit('user:joined', { user });

        // Send state to the new user
        emitSessionState(socket, session.id, user.id);
      } catch (err) {
        socket.emit('session:error', {
          message: err instanceof Error ? err.message : 'Invalid request.',
        });
      }
    });

    // ─── Facilitator Auth (rejoin) ────────────────────────────────────
    socket.on('facilitator:auth', (data) => {
      try {
        const session = db.getSession(data.sessionId);
        if (!session) {
          socket.emit('session:error', { message: 'Session not found.' });
          return;
        }
        if (session.facilitatorPin !== data.pin) {
          socket.emit('session:error', { message: 'Incorrect PIN.' });
          return;
        }

        // Find or create facilitator user
        const users = db.getUsersBySession(session.id);
        let facilitator = users.find((u) => u.role === 'facilitator');
        if (!facilitator) {
          facilitator = db.createUser({
            sessionId: session.id,
            name: 'Facilitator',
            role: 'facilitator',
            socketId: socket.id,
          });
        } else {
          db.updateUser(facilitator.id, { socketId: socket.id });
        }

        socketUserMap.set(socket.id, facilitator.id);
        socket.join(session.id);

        emitSessionState(socket, session.id, facilitator.id);
      } catch (err) {
        socket.emit('session:error', {
          message: err instanceof Error ? err.message : 'Invalid request.',
        });
      }
    });

    // ─── Assign Patient ───────────────────────────────────────────────
    socket.on('facilitator:assignPatient', (data) => {
      try {
        const parsed = AssignPatientSchema.parse(data);
        db.updateUser(parsed.userId, { assignedPatientId: parsed.patientId });
        const user = db.getUser(parsed.userId);
        if (user) {
          io.to(user.sessionId).emit('user:assigned', {
            userId: parsed.userId,
            patientId: parsed.patientId,
          });
        }
      } catch (err) {
        socket.emit('session:error', { message: 'Failed to assign patient.' });
      }
    });

    // ─── Auto Assign ──────────────────────────────────────────────────
    socket.on('facilitator:autoAssign', (data) => {
      try {
        const session = db.getSession(data.sessionId);
        if (!session) return;

        const users = db.getUsersBySession(session.id).filter((u) => u.role === 'participant');
        const patients = db.getPatientsBySession(session.id);

        // Round-robin assign
        users.forEach((user, i) => {
          const patient = patients[i % patients.length];
          db.updateUser(user.id, { assignedPatientId: patient.id });
          io.to(session.id).emit('user:assigned', {
            userId: user.id,
            patientId: patient.id,
          });
        });
      } catch (err) {
        socket.emit('session:error', { message: 'Failed to auto-assign.' });
      }
    });

    // ─── Start Simulation ─────────────────────────────────────────────
    socket.on('facilitator:start', (data) => {
      const session = db.getSession(data.sessionId);
      if (!session) return;

      const emitToSession = (event: string, eventData: unknown) => {
        io.to(session.id).emit(event as keyof ServerToClientEvents, eventData as never);
      };

      startSimulation(session.id, emitToSession);
      io.to(session.id).emit('session:started', { simClockMs: 0 });
    });

    // ─── Pause Simulation ─────────────────────────────────────────────
    socket.on('facilitator:pause', (data) => {
      const session = db.getSession(data.sessionId);
      if (!session) return;
      pauseSimulation(session.id);
      io.to(session.id).emit('session:paused', { simClockMs: session.simClockMs });
    });

    // ─── Resume Simulation ────────────────────────────────────────────
    socket.on('facilitator:resume', (data) => {
      const session = db.getSession(data.sessionId);
      if (!session) return;

      const emitToSession = (event: string, eventData: unknown) => {
        io.to(session.id).emit(event as keyof ServerToClientEvents, eventData as never);
      };

      resumeSimulation(session.id, emitToSession);
      const updated = db.getSession(session.id);
      io.to(session.id).emit('session:started', { simClockMs: updated?.simClockMs ?? 0 });
    });

    // ─── End Simulation ───────────────────────────────────────────────
    socket.on('facilitator:end', (data) => {
      const debrief = endSimulation(data.sessionId);
      if (debrief) {
        io.to(data.sessionId).emit('session:ended', { debrief });
      }
    });

    // ─── Submit Action (Participant) ──────────────────────────────────
    socket.on('action:submit', (data) => {
      try {
        const parsed = SubmitActionSchema.parse(data);
        const userId = socketUserMap.get(socket.id);
        if (!userId) {
          socket.emit('session:error', { message: 'Not authenticated.' });
          return;
        }

        const user = db.getUser(userId);
        if (!user) return;

        const patient = db.getPatient(parsed.patientId);
        if (!patient) {
          socket.emit('session:error', { message: 'Patient not found.' });
          return;
        }

        const session = db.getSession(patient.sessionId);
        if (!session || session.status !== 'running') {
          socket.emit('session:error', { message: 'Simulation is not running.' });
          return;
        }

        const configVersion = db.getConfig(session.configId);
        if (!configVersion) return;

        const resources = db.getResources(session.id);
        if (!resources) return;

        const result = submitAction(
          patient,
          parsed.actionKey,
          userId,
          session.simClockMs,
          configVersion.config,
          resources,
          parsed.prescription,
        );

        if ('error' in result) {
          socket.emit('session:error', { message: result.error });
          return;
        }

        // Notify about pending action
        io.to(session.id).emit('action:pending', {
          patientId: parsed.patientId,
          actionKey: parsed.actionKey,
          delayMs: result.delayMs,
        });

        // Log the action event
        const actionDef = getActionDef(configVersion.config, parsed.actionKey);
        const logEntry = db.addEvent({
          sessionId: session.id,
          patientId: parsed.patientId,
          userId,
          userName: user.name,
          simTimeMs: session.simClockMs,
          type: 'action',
          category: actionDef?.category ?? 'unknown',
          detail: {
            actionKey: parsed.actionKey,
            label: actionDef?.label ?? parsed.actionKey,
            message: `${user.name} ordered: ${actionDef?.label ?? parsed.actionKey}`,
          },
        });
        io.to(session.id).emit('event:logged', { event: logEntry });
      } catch (err) {
        socket.emit('session:error', {
          message: err instanceof Error ? err.message : 'Invalid action.',
        });
      }
    });

    // ─── Toggle Resource ──────────────────────────────────────────────
    socket.on('facilitator:toggleResource', (data) => {
      try {
        const session = db.getSession(data.sessionId);
        if (!session) return;

        const updates: Record<string, boolean> = {};
        if (data.resource === 'ketometer') updates.ketometerAvailable = data.available;
        if (data.resource === 'labs') updates.labsAvailable = data.available;
        if (data.resource === 'staff') updates.staffAvailable = data.available;

        db.updateResources(session.id, updates as never);
        io.to(session.id).emit('resource:changed', {
          resource: data.resource,
          available: data.available,
        });

        const logEntry = db.addEvent({
          sessionId: session.id,
          simTimeMs: session.simClockMs,
          type: 'injection',
          category: 'resource_change',
          detail: {
            resource: data.resource,
            available: data.available,
            message: `Facilitator ${data.available ? 'enabled' : 'disabled'} ${data.resource}`,
          },
        });
        io.to(session.id).emit('event:logged', { event: logEntry });
      } catch (err) {
        socket.emit('session:error', { message: 'Failed to toggle resource.' });
      }
    });

    // ─── Inject Event ─────────────────────────────────────────────────
    socket.on('facilitator:inject', (data) => {
      try {
        const session = db.getSession(data.sessionId);
        if (!session) return;

        const logEntry = db.addEvent({
          sessionId: session.id,
          simTimeMs: session.simClockMs,
          type: 'injection',
          category: data.event.type as string ?? 'message',
          detail: data.event,
        });

        io.to(session.id).emit('event:logged', { event: logEntry });

        if (data.event.message) {
          io.to(session.id).emit('alert:fire', {
            patientId: '',
            message: data.event.message as string,
            severity: 'info',
          });
        }
      } catch (err) {
        socket.emit('session:error', { message: 'Failed to inject event.' });
      }
    });

    // ─── Disconnect ───────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const userId = socketUserMap.get(socket.id);
      if (userId) {
        db.updateUser(userId, { socketId: undefined });
        socketUserMap.delete(socket.id);
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

/**
 * Send full session state to a socket.
 */
function emitSessionState(socket: Socket, sessionId: string, userId: string): void {
  const session = db.getSession(sessionId);
  if (!session) return;

  const users = db.getUsersBySession(sessionId);
  const patients = db.getPatientsBySession(sessionId);
  const events = db.getEventsBySession(sessionId);
  const resources = db.getResources(sessionId) ?? {
    ketometerAvailable: true,
    labsAvailable: true,
    staffAvailable: true,
    labDelayMultiplier: 1.0,
  };
  const scenario = db.getScenario(session.scenarioId);
  if (!scenario) return;

  const configVersion = db.getConfig(session.configId);
  const actionDefinitions = configVersion?.config.investigations ?? [];

  const state: SessionState & { userId: string } = {
    session,
    users,
    patients,
    events,
    resources,
    scenario,
    actionDefinitions,
    userId,
  };

  socket.emit('session:state', state);
}
