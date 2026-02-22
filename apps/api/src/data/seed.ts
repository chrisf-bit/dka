import { v4 as uuid } from 'uuid';
import * as db from './db.js';
import type { ScenarioDefinition, ClinicalRulesConfig, ConfigVersion } from '@dka-sim/shared';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function seedData(): void {
  console.log('Seeding default data...');

  // Load default clinical rules
  const rulesPath = join(__dirname, '..', 'config', 'default-clinical-rules.json');
  const rulesJson = readFileSync(rulesPath, 'utf-8');
  const clinicalRules: ClinicalRulesConfig = JSON.parse(rulesJson);

  const configVersion: ConfigVersion = {
    id: uuid(),
    version: 1,
    label: 'Default Training Config v1',
    config: clinicalRules,
    createdAt: Date.now(),
    createdBy: 'system',
  };

  db.addConfig(configVersion);
  console.log(`  Config version ${configVersion.version} loaded.`);

  // Load default scenario
  const scenarioPath = join(__dirname, 'scenarios', 'default-dka.json');
  const scenarioJson = readFileSync(scenarioPath, 'utf-8');
  const scenario: ScenarioDefinition = JSON.parse(scenarioJson);

  db.addScenario(scenario);
  console.log(`  Scenario "${scenario.name}" loaded.`);

  console.log('Seed complete.');
}
