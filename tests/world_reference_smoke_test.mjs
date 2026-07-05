import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { demoSurvey } from '../src/export.js';
import { buildMapModel, mapScene, renderMapSvg } from '../src/map.js';

const world = JSON.parse(await readFile(new URL('../assets/world-reference-ne110.geojson', import.meta.url), 'utf8'));
assert.equal(world.type, 'FeatureCollection');
assert.ok(world.features.length > 150, 'bundled Earth reference should contain world-country geometry');
const demo = demoSurvey();
const model = buildMapModel({ mission: demo.mission, site: demo.site }, demo.records);
const scene = mapScene(model.features, null, null, { worldView: true });
assert.equal(scene.worldView, true);
assert.ok(scene.minLon <= -180 && scene.maxLon >= 180, 'world view should span the Earth longitude range');
const markup = renderMapSvg(model.features, null, null, null, null, { worldReference: world, worldReferenceVisible: true, worldView: true });
assert.match(markup, /map-world-reference/);
assert.match(markup, /Global Earth reference/);
console.log('World-reference smoke test passed.');
