import assert from 'node:assert/strict';
import { demoSurvey } from '../src/export.js';
import { buildMapModel, mapScene, renderMapSvg } from '../src/map.js';
import { transectFromEndpoints } from '../src/tracking.js';

const demo = demoSurvey();
const model = buildMapModel({ mission: demo.mission, site: demo.site }, demo.records);
const scene = mapScene(model.features);
const p = scene.project(-75.0898, 38.7802);
const inverted = scene.unproject(p.x, p.y);
assert.ok(Math.abs(inverted.lon + 75.0898) < 0.000001);
assert.ok(Math.abs(inverted.lat - 38.7802) < 0.000001);
const draft = transectFromEndpoints({ lat: 38.7802, lon: -75.0898, timestamp: '2026-07-03T12:00:00Z' }, { lat: 38.7803, lon: -75.0895, timestamp: '2026-07-03T12:00:10Z' });
assert.ok(draft);
const svg = renderMapSvg(model.features, null, null, null, draft);
assert.match(svg, /map-transect-draft/);
console.log('On-map transect builder smoke test passed.');
