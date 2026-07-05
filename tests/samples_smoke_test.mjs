import assert from 'node:assert/strict';
import { demoSurvey } from '../src/export.js';
import { runFullQaqc, makeTables, buildQgisLayers } from '../src/qaqc.js';
import { defaultSampleLabel, normalizeSampleLabel, sampleLabelCsv, custodySummary } from '../src/samples.js';

const demo = demoSurvey();
const sample = demo.records.samples[0];
const custody = demo.records.custody[0];
assert.match(sample.sample_id, /^ES-\d{8}-\d{2}-SMP001$/);
assert.equal(sample.sample_label, sample.sample_id);
assert.equal(custody.sample_id, sample.sample_id);
assert.equal(defaultSampleLabel(sample.sample_id), sample.sample_id);
assert.equal(normalizeSampleLabel('  LAB\n  001  '), 'LAB 001');
assert.match(sampleLabelCsv([sample]), /sample_id,sample_label/);
assert.equal(custodySummary(sample, demo.records.custody).event_count, 1);

const result = runFullQaqc({ id: 'sample-test', mission: demo.mission, site: demo.site }, demo.records, { require_environment_per_station: true, bbox: {} });
assert.equal(result.summary.errors, 0, JSON.stringify(result.findings));
assert.equal(result.summary.warnings, 0, JSON.stringify(result.findings));
assert.equal(result.qgis_layers['samples.geojson'].features.length, 1);
assert.equal(buildQgisLayers(makeTables({ mission: demo.mission, site: demo.site }, demo.records))['samples.geojson'].features.length, 1);

const flawed = demoSurvey();
flawed.records.samples[0].label_status = 'missing';
flawed.records.custody[0].sample_id = 'ES-20260705-01-SMP999';
const checked = runFullQaqc({ id: 'sample-test-bad', mission: flawed.mission, site: flawed.site }, flawed.records, { require_environment_per_station: true, bbox: {} });
const rules = new Set(checked.findings.map((finding) => finding.rule));
assert.ok(rules.has('sample_label'));
assert.ok(rules.has('orphan_link'));
console.log('Sample chain-of-custody smoke test passed.');
