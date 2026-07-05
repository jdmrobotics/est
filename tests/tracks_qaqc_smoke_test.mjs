import assert from 'node:assert/strict';
import { demoSurvey } from '../src/export.js';
import { runFullQaqc, buildQgisLayers } from '../src/qaqc.js';

const demo = demoSurvey();
const survey = { id: 'track-test', mission: demo.mission, site: demo.site };
const run = runFullQaqc(survey, demo.records, { require_environment_per_station: true, bbox: {} });
assert.equal(run.summary.errors, 0, JSON.stringify(run.findings, null, 2));
assert.equal(run.summary.warnings, 0, JSON.stringify(run.findings, null, 2));
assert.equal(run.qgis_layers['tracks.geojson'].features.length, 1, 'one track line should be exported');
assert.equal(run.qgis_layers['track_points.geojson'].features.length, 3, 'all track points should be exported');
const broken = demoSurvey();
broken.records.tracks[0].point_count = 2;
broken.records.tracks[0].track_points = [{ lat: 95, lon: -75, timestamp: '2026-07-03T12:00:00Z' }];
const invalid = runFullQaqc({ id: 'broken-track', mission: broken.mission, site: broken.site }, broken.records, { require_environment_per_station: true, bbox: {} });
const rules = new Set(invalid.findings.map((finding) => finding.rule));
assert.ok(rules.has('track_minimum_points'));
assert.ok(rules.has('invalid_track_coordinate'));
console.log('GPS track QA/QC smoke test passed.');
