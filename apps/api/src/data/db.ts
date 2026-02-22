import { v4 as uuid } from 'uuid';
import type {
  Session,
  User,
  Patient,
  EventLogEntry,
  ResourceState,
  ScenarioDefinition,
  ClinicalRulesConfig,
  ConfigVersion,
} from '@dka-sim/shared';

// ─── In-Memory Store ─────────────────────────────────────────────────────────

const sessions = new Map<string, Session>();
const users = new Map<string, User>();
const patients = new Map<string, Patient>();
const events: EventLogEntry[] = [];
const resources = new Map<string, ResourceState>();
const scenarios = new Map<string, ScenarioDefinition>();
const configs = new Map<string, ConfigVersion>();

// ─── Session ─────────────────────────────────────────────────────────────────

export function createSession(data: Omit<Session, 'id' | 'createdAt'>): Session {
  const session: Session = { ...data, id: uuid(), createdAt: Date.now() };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function getSessionByCode(code: string): Session | undefined {
  for (const s of sessions.values()) {
    if (s.code === code) return s;
  }
  return undefined;
}

export function updateSession(id: string, updates: Partial<Session>): Session | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  const updated = { ...session, ...updates };
  sessions.set(id, updated);
  return updated;
}

// ─── User ────────────────────────────────────────────────────────────────────

export function createUser(data: Omit<User, 'id' | 'joinedAt'>): User {
  const user: User = { ...data, id: uuid(), joinedAt: Date.now() };
  users.set(user.id, user);
  return user;
}

export function getUser(id: string): User | undefined {
  return users.get(id);
}

export function getUsersBySession(sessionId: string): User[] {
  return Array.from(users.values()).filter((u) => u.sessionId === sessionId);
}

export function updateUser(id: string, updates: Partial<User>): User | undefined {
  const user = users.get(id);
  if (!user) return undefined;
  const updated = { ...user, ...updates };
  users.set(id, updated);
  return updated;
}

// ─── Patient ─────────────────────────────────────────────────────────────────

export function createPatient(data: Omit<Patient, 'id'>): Patient {
  const patient: Patient = { ...data, id: uuid() };
  patients.set(patient.id, patient);
  return patient;
}

export function getPatient(id: string): Patient | undefined {
  return patients.get(id);
}

export function getPatientsBySession(sessionId: string): Patient[] {
  return Array.from(patients.values()).filter((p) => p.sessionId === sessionId);
}

export function updatePatient(id: string, updates: Partial<Patient>): Patient | undefined {
  const patient = patients.get(id);
  if (!patient) return undefined;
  const updated = { ...patient, ...updates };
  patients.set(id, updated);
  return updated;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export function addEvent(data: Omit<EventLogEntry, 'id' | 'createdAt'>): EventLogEntry {
  const entry: EventLogEntry = { ...data, id: uuid(), createdAt: Date.now() };
  events.push(entry);
  return entry;
}

export function getEventsBySession(sessionId: string): EventLogEntry[] {
  return events.filter((e) => e.sessionId === sessionId);
}

// ─── Resources ───────────────────────────────────────────────────────────────

export function setResources(sessionId: string, state: ResourceState): void {
  resources.set(sessionId, state);
}

export function getResources(sessionId: string): ResourceState | undefined {
  return resources.get(sessionId);
}

export function updateResources(
  sessionId: string,
  updates: Partial<ResourceState>,
): ResourceState | undefined {
  const current = resources.get(sessionId);
  if (!current) return undefined;
  const updated = { ...current, ...updates };
  resources.set(sessionId, updated);
  return updated;
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

export function addScenario(scenario: ScenarioDefinition): void {
  scenarios.set(scenario.id, scenario);
}

export function getScenario(id: string): ScenarioDefinition | undefined {
  return scenarios.get(id);
}

export function getAllScenarios(): ScenarioDefinition[] {
  return Array.from(scenarios.values());
}

// ─── Config Versions ─────────────────────────────────────────────────────────

export function addConfig(config: ConfigVersion): void {
  configs.set(config.id, config);
}

export function getConfig(id: string): ConfigVersion | undefined {
  return configs.get(id);
}

export function getLatestConfig(): ConfigVersion | undefined {
  let latest: ConfigVersion | undefined;
  for (const c of configs.values()) {
    if (!latest || c.version > latest.version) latest = c;
  }
  return latest;
}

export function getAllConfigs(): ConfigVersion[] {
  return Array.from(configs.values()).sort((a, b) => b.version - a.version);
}
