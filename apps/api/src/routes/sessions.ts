import { Router } from 'express';
import * as db from '../data/db.js';

const router = Router();

// GET /api/sessions/:id — get session info (public, no auth)
router.get('/:id', (req, res) => {
  const session = db.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  // Don't expose facilitator PIN
  const { facilitatorPin, ...safe } = session;
  res.json(safe);
});

// GET /api/sessions/code/:code — lookup session by code
router.get('/code/:code', (req, res) => {
  const session = db.getSessionByCode(req.params.code.toUpperCase());
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const { facilitatorPin, ...safe } = session;
  res.json(safe);
});

// GET /api/scenarios — list available scenarios
router.get('/', (_req, res) => {
  const scenarios = db.getAllScenarios();
  res.json(
    scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      patientCount: s.patients.length,
    })),
  );
});

export default router;
