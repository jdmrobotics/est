import assert from 'node:assert/strict';
import { demoSurvey } from '../src/export.js';
import { runFullQaqc } from '../src/qaqc.js';
import { getProtocol, protocolMissionFields, fieldPriority, protocolDefaultFor } from '../src/protocols.js';

const surveyFor = (demo) => ({ id: 'protocol-test', mission: demo.mission, site: demo.site });
const rules = (result) => new Set(result.findings.map((finding) => finding.rule));

const benthic = demoSurvey();
const benthicResult = runFullQaqc(surveyFor(benthic), benthic.records, { require_environment_per_station: true, bbox: {} });
assert.equal(benthicResult.summary.errors, 0, JSON.stringify(benthicResult.findings));
assert.equal(benthicResult.options.protocol.id, 'benthic_transect');

const water = demoSurvey();
Object.assign(water.mission, protocolMissionFields('water_quality_visit'));
water.records = { equipment: water.records.equipment, stations: water.records.stations, tracks: [], transects: [], environment: water.records.environment, observations: [], samples: [], custody: [], media: [] };
const waterResult = runFullQaqc(surveyFor(water), water.records, { bbox: {} });
assert.equal(waterResult.summary.errors, 0, JSON.stringify(waterResult.findings));
assert.equal(waterResult.options.require_environment_per_station, true);
water.records.environment = [];
assert.ok(rules(runFullQaqc(surveyFor(water), water.records, { bbox: {} })).has('protocol_required_record'));

const rov = demoSurvey();
Object.assign(rov.mission, protocolMissionFields('rov_reconnaissance'), { platform: 'rov' });
let rovResult = runFullQaqc(surveyFor(rov), rov.records, { bbox: {} });
assert.ok(rules(rovResult).has('protocol_rov_equipment'));
rov.records.equipment[0].equipment_category = 'rov';
rov.records.rov_operations = [{
  operation_sequence: 1, rov_operation_id: `${rov.mission.mission_id}-ROV01`, mission_id: rov.mission.mission_id, site_id: rov.site.site_id, rov_equipment_log_id: rov.records.equipment[0].equipment_log_id,
  vehicle_id: rov.records.equipment[0].equipment_id, operation_name: 'Demo ROV deployment', pilot: 'Demo Field Lead', tether_tender: 'Demo Observer',
  launch_datetime_utc: rov.mission.actual_start_utc, recovery_datetime_utc: rov.mission.actual_start_utc, operation_status: 'complete',
  max_depth_m: '1.5', tether_length_m: '25', video_media_id: rov.records.media[0].media_id, camera_or_sensor_id: 'DEMO-CAM-01'
}];
rovResult = runFullQaqc(surveyFor(rov), rov.records, { bbox: {} });
assert.equal(rovResult.summary.errors, 0, JSON.stringify(rovResult.findings));

const edna = demoSurvey();
Object.assign(edna.mission, protocolMissionFields('edna_collection'));
let ednaResult = runFullQaqc(surveyFor(edna), edna.records, { bbox: {} });
assert.ok(rules(ednaResult).has('protocol_edna_sample'));
edna.records.samples[0].sample_type = 'edna_water';
ednaResult = runFullQaqc(surveyFor(edna), edna.records, { bbox: {} });
assert.equal(ednaResult.summary.errors, 0, JSON.stringify(ednaResult.findings));

const debris = demoSurvey();
Object.assign(debris.mission, protocolMissionFields('shoreline_debris'));
let debrisResult = runFullQaqc(surveyFor(debris), debris.records, { bbox: {} });
assert.ok(rules(debrisResult).has('protocol_debris_observation'));
debris.records.observations[0].observation_category = 'debris';
debris.records.observations[0].taxon_name_basis = 'common';
debris.records.observations[0].common_name = 'Plastic bottle';
debrisResult = runFullQaqc(surveyFor(debris), debris.records, { bbox: {} });
assert.equal(debrisResult.summary.errors, 0, JSON.stringify(debrisResult.findings));

const template = getProtocol('rov_reconnaissance');
assert.equal(protocolDefaultFor(template, 'tracks', 'track_type'), 'rov_navigation');
assert.equal(fieldPriority(template, 'media', 'media_type', { required: true }), 'core');
assert.equal(getProtocol('missing-template').id, 'custom_general');
console.log('Survey protocol templates smoke test passed.');
