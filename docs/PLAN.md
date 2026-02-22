# DKA in Pregnancy — Delivery Suite Simulation

## Phase 0: Planning Document

> **Training simulation only. Follow local Trust policy.**
> Clinical thresholds are placeholder defaults until Trust guidelines are provided.

---

## 1. Product Overview

A browser-based, mobile-first, team-based business simulation for NHS Delivery Suite midwives. Participants use smartphones; the facilitator uses a laptop (optionally connected to a display). The simulation teaches recognition and management of suspected DKA in pregnancy among women who may not have a prior diabetes diagnosis, presenting with ambiguous symptoms on a busy Delivery Suite.

---

## 2. User Stories

### Facilitator (Diabetes Specialist Midwife)

| ID | Story |
|----|-------|
| F1 | As a facilitator, I can create a new session and receive a join code + QR code so participants can join on their phones. |
| F2 | As a facilitator, I can select a scenario (pre-built patient mix) before starting the session. |
| F3 | As a facilitator, I can see all joined participants and assign each one a patient (or auto-assign). |
| F4 | As a facilitator, I can start, pause, and resume the simulation clock. |
| F5 | As a facilitator, I can view a live dashboard showing every patient's current vitals, alert state, and assigned participant. |
| F6 | As a facilitator, I can inject real-time events (e.g., "ketone meter now unavailable", "lab results delayed", "new patient arrives"). |
| F7 | As a facilitator, I can toggle resource availability (ketone meter, staff, beds). |
| F8 | As a facilitator, I can view a live event log of all participant actions with timestamps. |
| F9 | As a facilitator, I can end the simulation and trigger the debrief view. |
| F10 | As a facilitator, I can review a decision timeline, missed opportunities, and outcome scores in debrief. |
| F11 | As a facilitator, I can edit clinical rules config and scenario definitions (Phase 2). |
| F12 | As a facilitator, I can export session reports as JSON/CSV (Phase 3). |

### Participant (Midwife on Phone)

| ID | Story |
|----|-------|
| P1 | As a participant, I can join a session by scanning a QR code or entering a short code on my phone. |
| P2 | As a participant, I can enter my name and see a waiting lobby until the facilitator starts. |
| P3 | As a participant, I can see only my assigned patient's presenting complaint, history, and evolving vitals. |
| P4 | As a participant, I can see a CTG summary for my patient (text-based interpretation, not a live trace). |
| P5 | As a participant, I can choose from context-appropriate actions (e.g., "Check blood glucose", "Request ketones", "Escalate to registrar", "Start IV fluids"). |
| P6 | As a participant, I see the result of my action after a realistic delay (configurable). |
| P7 | As a participant, I receive alerts when my patient's condition changes. |
| P8 | As a participant, I can see a running timer showing simulation elapsed time. |
| P9 | As a participant, I can view a debrief summary at the end showing my decisions and timeline. |

---

## 3. Core Screens + Navigation Map

### Participant (Mobile)

```
[Join Screen]          Enter code / scan QR → name entry
       │
       ▼
[Lobby]                Waiting for facilitator to start
       │
       ▼
[Patient View]         Main sim screen (single patient)
  ├── Vitals Panel     HR, BP, RR, SpO2, Temp, GCS — live updating
  ├── CTG Summary      Text-based CTG interpretation
  ├── History Tab      Presenting complaint + PMH + obs summary
  ├── Actions Panel    Big touch-friendly action buttons (stepped)
  │     └── Action Result overlay (appears after delay)
  └── Alert Banner     Flashes on deterioration
       │
       ▼
[Debrief]              Decision timeline + outcome + score
```

### Facilitator (Laptop/Tablet)

```
[Home]                 Create session / resume session
       │
       ▼
[Session Setup]        Select scenario, view join code + QR
       │
       ▼
[Lobby Manager]        See joined participants, assign patients
       │
       ▼
[Dashboard]            Main facilitator view
  ├── Patient Cards    Grid of all patients (colour-coded alert state)
  │     └── Expand → full vitals + event log for that patient
  ├── Timeline Bar     Sim clock + start/pause/end controls
  ├── Event Injector   Inject events / toggle resources
  ├── Staff Panel      Who is assigned where, availability
  └── Live Log         Scrolling event feed
       │
       ▼
[Debrief Overview]     All patients, all decisions, scoring breakdown
  └── Export button    JSON / CSV
```

### Admin (Phase 2)

```
[Config Editor]        Edit clinical rules JSON (form-based)
[Scenario Editor]      Edit/create scenario definitions
[Version History]      View + restore config versions
```

---

## 4. Data Model

### Core Entities

```
Session
  id            UUID
  code          string (6-char join code)
  scenarioId    FK → Scenario
  configId      FK → ConfigVersion
  status        enum: lobby | running | paused | ended
  simClockMs    number (elapsed sim time)
  speedFactor   number (default 1.0 — real-time)
  createdAt     timestamp
  endedAt       timestamp?

User
  id            UUID
  sessionId     FK → Session
  name          string
  role          enum: facilitator | participant
  socketId      string?
  assignedPatientId  FK → Patient?
  joinedAt      timestamp

Patient
  id            UUID
  sessionId     FK → Session
  scenarioPatientKey  string (e.g. "dka_patient", "pvb_patient")
  name          string (fictional)
  gestation     string (e.g. "34+2")
  presentingComplaint  text
  pmh           text
  status        enum: stable | concerning | critical | collapsed | resolved
  currentVitals JSON (VitalsSnapshot)
  ctgSummary    text
  isAlive       boolean
  fetalStatus   enum: reassuring | non_reassuring | pathological | iud
  updatedAt     timestamp

EventLog
  id            UUID
  sessionId     FK → Session
  patientId     FK → Patient?
  userId        FK → User?
  simTimeMs     number
  type          enum: action | result | deterioration | injection | system
  category      string (e.g. "investigation", "escalation", "treatment")
  detail        JSON
  createdAt     timestamp

Action (definition — from config)
  key           string (e.g. "check_glucose")
  label         string
  category      string
  delayMs       number (sim time to result)
  prerequisites string[] (required prior actions)
  available     boolean (can be toggled by facilitator)

StateSnapshot (periodic)
  id            UUID
  sessionId     FK → Session
  patientId     FK → Patient
  simTimeMs     number
  vitals        JSON
  status        string
  fetalStatus   string

ConfigVersion
  id            UUID
  version       number
  label         string
  config        JSON (ClinicalRulesConfig)
  createdAt     timestamp
  createdBy     string

Scenario
  id            UUID
  name          string
  description   text
  patients      JSON (ScenarioPatientDef[])
  events        JSON (ScenarioEvent[] — timed injections)
  configId      FK → ConfigVersion?
```

### VitalsSnapshot Shape

```typescript
interface VitalsSnapshot {
  hr: number;          // Heart rate (bpm)
  bpSystolic: number;  // mmHg
  bpDiastolic: number;
  rr: number;          // Respiratory rate
  spo2: number;        // %
  temp: number;        // °C
  gcs: number;         // 3–15
  glucose?: number;    // mmol/L (only if tested)
  ketones?: number;    // mmol/L (only if tested)
  pH?: number;         // only if ABG done
  bicarb?: number;     // only if ABG done
}
```

---

## 5. Real-Time Event Schema (Socket.IO)

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join:session` | `{ code, name }` | Participant joins |
| `action:submit` | `{ patientId, actionKey }` | Participant submits action |
| `facilitator:start` | `{ sessionId }` | Start sim clock |
| `facilitator:pause` | `{ sessionId }` | Pause sim clock |
| `facilitator:resume` | `{ sessionId }` | Resume sim clock |
| `facilitator:end` | `{ sessionId }` | End simulation |
| `facilitator:inject` | `{ sessionId, event }` | Inject event |
| `facilitator:toggleResource` | `{ sessionId, resource, available }` | Toggle resource |
| `facilitator:assignPatient` | `{ userId, patientId }` | Assign patient |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `session:state` | `SessionState` | Full state sync on join |
| `session:started` | `{ simClockMs }` | Sim started |
| `session:paused` | `{ simClockMs }` | Sim paused |
| `session:ended` | `{ summary }` | Sim ended |
| `patient:vitalsUpdate` | `{ patientId, vitals, status }` | Vitals tick |
| `patient:ctgUpdate` | `{ patientId, ctgSummary }` | CTG change |
| `patient:statusChange` | `{ patientId, oldStatus, newStatus }` | Status change |
| `action:result` | `{ patientId, actionKey, result }` | Action outcome |
| `action:pending` | `{ patientId, actionKey, delayMs }` | Action acknowledged |
| `event:injected` | `{ event }` | Facilitator injected event |
| `resource:changed` | `{ resource, available }` | Resource toggled |
| `user:joined` | `{ user }` | New participant |
| `user:assigned` | `{ userId, patientId }` | Patient assigned |
| `clock:tick` | `{ simClockMs }` | Clock sync (every 1s) |
| `alert:fire` | `{ patientId, message, severity }` | Alert pushed |

---

## 6. Patient Deterioration State Machine

### DKA Patient Progression (if untreated)

```
                    ┌──────────────────────────────────────┐
                    │          TIMELINE (sim minutes)       │
                    └──────────────────────────────────────┘

  0 min          5 min         15 min        25 min        35 min
    │              │              │              │              │
    ▼              ▼              ▼              ▼              ▼
 STABLE ──────► CONCERNING ──► CRITICAL ──► COLLAPSED ──► CRASH CALL
 (ambiguous)    (subtle signs)  (obvious)    (emergency)    (outcome)

 Vitals:
 HR:  90→95     95→110        110→130       130→145        145+
 BP: 120/75    115/70        105/65         90/55          80/45
 RR:  18→20     20→26         26→34          34→40          40+
 SpO2: 98       97→96         96→94          94→90          <90
 GCS:  15        15            14→13          12→10          <8
 Temp: 37.2     37.0          36.8           36.5           36.0

 CTG:
 Normal ──► Reduced variability ──► Late decels ──► Prolonged decel ──► Bradycardia

 Fetal:
 Reassuring ──► Non-reassuring ──► Pathological ──► IUD risk
```

### Intervention Effects

| Intervention | Effect |
|-------------|--------|
| Check glucose (early) | Reveals hyperglycaemia → triggers suspicion |
| Check ketones (early) | Confirms DKA → enables correct pathway |
| Escalate to registrar | Reduces time-to-treatment |
| Start IV fluids | Slows deterioration (buys ~10 min) |
| Start insulin infusion | Begins reversal (after fluids) |
| Check K+ / start replacement | Prevents arrhythmia complication |
| ABG | Confirms metabolic acidosis |
| Continuous CTG | No direct effect but scores monitoring |

### State Transitions

Each patient has a **deterioration curve** defined in config. The engine:

1. Runs a tick every simulated second (batched to 1-second intervals).
2. Reads the patient's current `stage` and `stageEnteredAt`.
3. If `simClock - stageEnteredAt > stage.durationMs` and no intervention halts progression → advance to next stage.
4. Interventions can: **halt** progression, **reverse** one stage, or **slow** the rate (multiply durationMs).
5. Each stage defines target vitals; the engine interpolates linearly between stages for smooth vital changes.

---

## 7. Scoring Model

### Per-Participant Score

```typescript
interface ParticipantScore {
  patientOutcome: number;       // 0–40 pts (alive + stable = 40, IUD = 0)
  timeToRecognition: number;    // 0–20 pts (earlier = more points)
  timeToEscalation: number;     // 0–15 pts
  timeToTreatment: number;      // 0–15 pts
  appropriateActions: number;   // 0–10 pts (correct actions / total correct possible)
  total: number;                // 0–100
}
```

### Time-Based Scoring

| Metric | Target (sim mins) | Full marks | Zero marks |
|--------|-------------------|------------|------------|
| Recognition (glucose/ketone check) | ≤ 5 min | 20 | > 25 min |
| Escalation | ≤ 8 min | 15 | > 30 min |
| IV fluids started | ≤ 10 min | 15 | > 35 min |

All thresholds are in the `ClinicalRulesConfig` and can be edited.

### Team Score

Average of participant scores + bonus for coordination (e.g., correct prioritisation of competing emergency).

---

## 8. Clinical Rules Config (Calibration Layer)

```typescript
interface ClinicalRulesConfig {
  version: number;

  // DKA suspicion triggers
  dkaTriggers: {
    glucoseThreshold: number;    // mmol/L — default 11.0 (TODO: Trust guideline)
    ketoneThreshold: number;     // mmol/L — default 3.0 (TODO: Trust guideline)
    phThreshold: number;         // default 7.3
    bicarbThreshold: number;     // mmol/L — default 15
  };

  // Investigation options
  investigations: {
    key: string;
    label: string;
    delayMs: number;             // sim-time delay
    category: string;
    resultGenerator: string;     // function key for generating result
  }[];

  // Escalation thresholds
  escalation: {
    newsScoreThreshold: number;  // TODO: Trust guideline
    autoEscalateAt: string;      // stage name (e.g. "critical")
  };

  // Treatment rules
  treatment: {
    fluidProtocol: {
      firstBagVolume: number;    // mL — default 1000
      firstBagRateMinutes: number; // default 60
      subsequentRate: number;
    };
    insulinProtocol: {
      startAfterFluids: boolean; // default true
      rate: number;              // units/hr — default 0.1 units/kg/hr
      // TODO: Trust-specific sliding scale
    };
    potassiumProtocol: {
      checkBeforeInsulin: boolean; // default true
      replaceIfBelow: number;      // mmol/L — default 5.5
      // TODO: Trust-specific replacement protocol
    };
  };

  // Deterioration curves (per patient type)
  deteriorationCurves: {
    [patientType: string]: {
      stages: {
        name: string;
        durationMs: number;
        vitals: VitalsSnapshot;
        ctgSummary: string;
        fetalStatus: string;
      }[];
    };
  };

  // Scoring
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

  // Resource defaults
  resources: {
    ketometerAvailable: boolean;
    ketometerUnavailableProbability: number; // 0–1
    labDelayMs: number;
    staffBusyProbability: number;
  };
}
```

### Versioning Approach

- Every config edit creates a new `ConfigVersion` row.
- Sessions are linked to a specific `configId` at creation time.
- The admin UI shows a version history with diff view (Phase 2).
- A "default" config is seeded on first run.

---

## 9. Scenario Definition Shape

```typescript
interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  briefing: string;              // Read aloud by facilitator
  durationMinutes: number;       // Max sim length
  patients: ScenarioPatientDef[];
  timedEvents: ScenarioTimedEvent[];
}

interface ScenarioPatientDef {
  key: string;                   // e.g. "dka_patient"
  name: string;                  // Fictional name
  age: number;
  gestation: string;             // e.g. "34+2"
  parity: string;                // e.g. "G2P1"
  presentingComplaint: string;
  history: string;
  pmh: string;
  allergies: string;
  initialVitals: VitalsSnapshot;
  initialCtg: string;
  deteriorationType: string;     // key into deteriorationCurves
  isDKA: boolean;                // hidden flag
  availableActions: string[];    // keys from investigations
  arrivalDelayMs: number;        // sim time before this patient "arrives"
}

interface ScenarioTimedEvent {
  triggerAtMs: number;           // sim time
  type: string;                  // "resource_change" | "new_patient" | "staff_change" | "message"
  payload: Record<string, unknown>;
}
```

---

## 10. Security Basics

| Concern | Approach |
|---------|----------|
| Session access | 6-character alphanumeric code; sessions expire after 4 hours |
| Facilitator auth | Simple PIN set at session creation (no user accounts in MVP) |
| Data privacy | No real patient data; fictional names only; session data auto-purged after 24h |
| HTTPS | Enforced in production (Render/Vercel) |
| Socket auth | Session code + userId sent on connection; validated server-side |
| Rate limiting | Basic rate limiting on join endpoint (prevent brute-force) |
| Input validation | Zod schemas in `packages/shared` validated on both client and server |

---

## 11. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Animations | GSAP (GreenSock) for transitions, alerts, vitals animations |
| Backend | Node.js + Express + TypeScript |
| Realtime | Socket.IO |
| Database | SQLite (better-sqlite3) dev; Postgres-ready via Kysely |
| Validation | Zod (shared schemas) |
| QR Code | `qrcode.react` |
| Testing | Vitest |
| Monorepo | pnpm workspaces |
| Linting | ESLint + Prettier |
| Deploy | Vercel (web) + Render (api) |

---

## 12. Monorepo Structure

```
dka-sim/
├── pnpm-workspace.yaml
├── package.json              (root scripts)
├── .eslintrc.cjs
├── .prettierrc
├── tsconfig.base.json
├── docs/
│   └── PLAN.md
├── apps/
│   ├── web/                  (React frontend)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── pages/
│   │       │   ├── Home.tsx
│   │       │   ├── JoinSession.tsx
│   │       │   ├── Lobby.tsx
│   │       │   ├── PatientView.tsx
│   │       │   ├── FacilitatorDashboard.tsx
│   │       │   ├── SessionSetup.tsx
│   │       │   └── Debrief.tsx
│   │       ├── components/
│   │       │   ├── VitalsPanel.tsx
│   │       │   ├── CTGSummary.tsx
│   │       │   ├── ActionButtons.tsx
│   │       │   ├── PatientCard.tsx
│   │       │   ├── EventLog.tsx
│   │       │   ├── TimerBar.tsx
│   │       │   ├── QRCodeDisplay.tsx
│   │       │   ├── AlertBanner.tsx
│   │       │   └── ResourcePanel.tsx
│   │       ├── hooks/
│   │       │   ├── useSocket.ts
│   │       │   ├── useSession.ts
│   │       │   └── useTimer.ts
│   │       ├── stores/
│   │       │   └── sessionStore.ts  (zustand)
│   │       └── lib/
│   │           ├── socket.ts
│   │           └── api.ts
│   └── api/                  (Express backend)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── server.ts
│           ├── routes/
│           │   ├── sessions.ts
│           │   └── config.ts
│           ├── socket/
│           │   ├── handler.ts
│           │   └── events.ts
│           ├── engine/
│           │   ├── SimulationEngine.ts
│           │   ├── DeteriorationEngine.ts
│           │   ├── ScoringEngine.ts
│           │   └── ActionProcessor.ts
│           ├── data/
│           │   ├── db.ts
│           │   ├── seed.ts
│           │   └── scenarios/
│           │       └── default-dka.json
│           └── config/
│               └── default-clinical-rules.json
└── packages/
    └── shared/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts
            ├── schemas.ts       (Zod schemas)
            ├── types.ts         (TypeScript types)
            └── constants.ts
```

---

## 13. Local Dev Instructions

```bash
# Clone and install
git clone <repo>
cd dka-sim
pnpm install

# Start dev (both apps concurrently)
pnpm dev
# → web: http://localhost:5173
# → api: http://localhost:3001

# Run tests
pnpm test

# Lint
pnpm lint

# Build
pnpm build
```

---

## 14. MVP Scope (Phase 1)

### Included

- [x] Create session with code + QR
- [x] Join session on phone
- [x] Lobby with participant list
- [x] Facilitator selects default scenario (3 patients)
- [x] Auto-assign or manual assign patients
- [x] Start/pause/resume simulation
- [x] Live vitals updates (1-second ticks)
- [x] CTG summary updates
- [x] Participant action submission with delays
- [x] DKA deterioration engine
- [x] Competing emergency patient (stable but attention-grabbing)
- [x] Resource toggling (ketone meter)
- [x] Event injection (facilitator)
- [x] Live event log
- [x] End simulation → debrief summary
- [x] Basic scoring
- [x] GSAP animations (vitals changes, alerts, transitions)
- [x] Mobile-first responsive design
- [x] Disclaimer banners

### Default Scenario: "Tuesday Afternoon on Delivery Suite"

**Patient 1 — Sarah Mitchell (DKA hidden)**
- 28 years, G1P0, 32+4 weeks
- Presents: "Vomiting for 2 days, abdominal pain, feels unwell"
- No known diabetes
- Initial vitals: HR 95, BP 118/72, RR 20, SpO2 97, Temp 37.1, GCS 15
- CTG: Normal baseline, moderate variability
- Hidden: glucose 14.2, ketones 4.1, pH 7.28

**Patient 2 — Lisa Thompson (PV Bleeding — competing emergency)**
- 34 years, G3P2, 36+1 weeks
- Presents: "PV bleeding, 'gush' 20 minutes ago"
- Previous C-section
- Initial vitals: HR 105, BP 110/65, RR 18, SpO2 98, Temp 36.8, GCS 15
- CTG: Baseline 145, reduced variability
- Actual: marginal abruption — stabilises with conservative management

**Patient 3 — Emma Williams (Reduced fetal movements — benign)**
- 22 years, G1P0, 38+0 weeks
- Presents: "Hasn't felt baby move since yesterday morning"
- Anxious, otherwise well
- Initial vitals: HR 78, BP 115/70, RR 16, SpO2 99, Temp 36.6, GCS 15
- CTG: Normal, reactive
- Actual: normal — reassurance after monitoring

---

## 15. Phase 2 Scope (Calibration + Admin)

- Clinical Rules Config editor (form-based)
- Scenario editor (create/edit/duplicate)
- Config version history + restore
- Link session to specific config version
- Validation on all config fields

## 16. Phase 3 Scope (Polish)

- Enhanced phone UX (haptic patterns, larger targets)
- GSAP-animated debrief timeline
- Session report export (JSON/CSV)
- Facilitator session history
- Improved alert sounds/vibration
- Accessibility audit (WCAG 2.1 AA)

---

## 17. GSAP Animation Plan

| Element | Animation | Trigger |
|---------|-----------|---------|
| Vitals values | Counter tween + colour flash | Each vitals update |
| Alert banner | Slide-down + pulse glow | Patient status change |
| Patient cards (facilitator) | Border colour tween | Status change |
| Action buttons | Scale spring on press | User tap |
| Action result | Fade-in + slide-up overlay | Result arrives |
| Clock | Continuous tick animation | Every second |
| Page transitions | Fade + slide | Route change |
| Debrief timeline | Staggered reveal | On mount |
| QR code | Scale-in spring | On generate |
| Deterioration warning | Shake + red pulse | Critical threshold |

---

*Plan complete. Ready to implement Phase 1.*
