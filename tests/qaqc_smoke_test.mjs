import { demoSurvey } from '../src/export.js';
import { runFullQaqc } from '../src/qaqc.js';

const demo = demoSurvey();
const survey = { id: 'test-mission', mission: demo.mission, site: demo.site };
const clean = runFullQaqc(survey, demo.records, { require_environment_per_station: true, bbox: {} });
if (clean.summary.errors !== 0 || clean.summary.warnings !== 0) {
  throw new Error(`Expected clean demo to pass; received ${JSON.stringify(clean.summary)}`);
}

const flawed = demoSurvey();
flawed.records.stations[0].depth_m = '-1';
flawed.records.environment = [];
flawed.records.media[0].file_name = '';
flawed.records.media[0].file_name_manual = '';
const reviewed = runFullQaqc({ id: 'test-flawed', mission: flawed.mission, site: flawed.site }, flawed.records, { require_environment_per_station: true, bbox: {} });
const rules = new Set(reviewed.findings.map((finding) => finding.rule));
for (const expected of ['numeric_range', 'missing_environment_record', 'missing_media_file']) {
  if (!rules.has(expected)) throw new Error(`Expected ${expected} in flawed mission findings.`);
}
console.log('EcoSurvey QA/QC smoke test passed.');
