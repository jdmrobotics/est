import assert from 'node:assert/strict';
import { demoSurvey } from '../src/export.js';
import { makeTables, buildQgisLayers } from '../src/qaqc.js';
import { validateGeoJsonLayers } from '../src/export.js';

const demo = demoSurvey();
const layers = buildQgisLayers(makeTables({ mission: demo.mission, site: demo.site }, demo.records));
const check = validateGeoJsonLayers(layers);
assert.equal(check.valid, true, JSON.stringify(check.findings));
assert.equal(check.standard, 'RFC 7946 GeoJSON / EPSG:4326 WGS 84');
assert.ok(check.layer_feature_counts['stations.geojson'] > 0);
const broken = validateGeoJsonLayers({ 'broken.geojson': { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [250, 95] }, properties: {} }] } });
assert.equal(broken.valid, false);
console.log('QGIS GeoJSON compatibility smoke test passed.');
