// Simulation tick interval in milliseconds
export const SIM_TICK_INTERVAL_MS = 1000;

// Session code length
export const SESSION_CODE_LENGTH = 6;

// Session expiry (4 hours)
export const SESSION_EXPIRY_MS = 4 * 60 * 60 * 1000;

// Default speed factor (1.0 = real time)
export const DEFAULT_SPEED_FACTOR = 1.0;

// Sim minutes → milliseconds
export const simMinutesToMs = (minutes: number): number => minutes * 60 * 1000;

// Patient status severity ordering
export const STATUS_SEVERITY: Record<string, number> = {
  stable: 0,
  concerning: 1,
  critical: 2,
  collapsed: 3,
  resolved: -1,
};

// Action key labels (used for display categorisation)
export const ACTION_KEYS = [
  'check_glucose',
  'check_ketones',
  'request_abg',
  'check_potassium',
  'escalate_registrar',
  'escalate_consultant',
  'start_iv_fluids',
  'start_insulin',
  'start_potassium_replacement',
  'continuous_ctg',
  'check_lactate',
  'maternal_observations',
  'speculum_exam',
  'group_and_save',
  'crossmatch',
  'fbc',
  'request_ultrasound',
] as const;

// Disclaimer text
export const DISCLAIMER =
  'Training simulation only. Not clinical advice. Always follow your local Trust policy and guidelines.';

// Format sim time as MM:SS
export const formatSimTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Generate random session code
export const generateSessionCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 (ambiguous)
  let code = '';
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};
