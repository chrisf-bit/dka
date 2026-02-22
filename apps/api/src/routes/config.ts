import { Router } from 'express';
import * as db from '../data/db.js';

const router = Router();

// GET /api/config — get latest config
router.get('/', (_req, res) => {
  const config = db.getLatestConfig();
  if (!config) {
    res.status(404).json({ error: 'No config found' });
    return;
  }
  res.json(config);
});

// GET /api/config/versions — list all versions
router.get('/versions', (_req, res) => {
  const configs = db.getAllConfigs();
  res.json(configs.map((c) => ({ id: c.id, version: c.version, label: c.label, createdAt: c.createdAt })));
});

// GET /api/scenarios — list all scenarios
router.get('/scenarios', (_req, res) => {
  const scenarios = db.getAllScenarios();
  res.json(scenarios);
});

export default router;
