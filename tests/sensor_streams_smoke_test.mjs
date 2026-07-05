import assert from 'node:assert/strict';
import { demoSurvey } from '../src/export.js';
import { makeIds } from '../src/schema.js';
import { autoDetectSensorMapping, normalizeSensorRows, summarizeSensorReadings, sensorClockOffsetSeconds, makeSensorStreamRecord } from '../src/sensor_streams.js';
import { buildQgisLayers, runFullQaqc } from '../src/qaqc.js';

const demo = demoSurvey();
const operation = demo.records.rov_operations?.[0] || {
  operation_sequence: 1,
  rov_operation_id: `${demo.mission.mission_id}-ROV01`,
  mission_id: demo.mission.mission_id,
  site_id: demo.site.site_id,
  rov_equipment_log_id: demo.records.equipment[0]?.equipment_log_id || '',
  vehicle_id: 'ROV-DEMO-01',
  operation_name: 'Sensor synchronization test',
  pilot: 'Demo pilot',
  operation_status: 'complete',
  recovery_datetime_utc: '2026-07-03T12:01:00.000Z',
  launch_datetime_utc: '2026-07-03T12:00:00.000Z',
  launch_latitude_dd: demo.site.latitude_dd,
  launch_longitude_dd: demo.site.longitude_dd
};
if (!demo.records.rov_operations?.length) demo.records.rov_operations = [operation];
const equipment = demo.records.equipment[0];
const streamIds = makeIds(demo.mission, demo.site, 'sensor_streams', { sensor_stream_sequence: 1, rov_operation_sequence: 1 });
const rows = [
  { timestamp: '2026-07-03T12:00:00Z', lat: '38.7802', lon: '-75.0896', depth: '1.2', temp_c: '23.4', salinity: '15.2', turbidity: '4.1' },
  { timestamp: '2026-07-03T12:00:10Z', lat: '38.78025', lon: '-75.0895', depth: '1.4', temp_c: '23.5', salinity: '15.3', turbidity: '4.4' }
];
const mapping = autoDetectSensorMapping(Object.keys(rows[0]));
assert.equal(mapping.timestamp, 'timestamp');
assert.equal(mapping.temperature_c, 'temp_c');
assert.equal(mapping.salinity_psu, 'salinity');
const offset = sensorClockOffsetSeconds(operation, '2026-07-03T12:00:00Z');
assert.equal(offset, 0);
const normalized = normalizeSensorRows(rows, mapping, { sensor_stream_id: streamIds.sensor_stream_id, mission_id: demo.mission.mission_id, site_id: demo.site.site_id, rov_operation_sequence: 1, rov_operation_id: operation.rov_operation_id, time_offset_seconds: offset });
assert.equal(normalized.readings.length, 2);
assert.equal(normalized.readings[1].estimated_mission_datetime_utc, '2026-07-03T12:00:10.000Z');
const summary = summarizeSensorReadings(normalized.readings);
const stream = makeSensorStreamRecord({ sequence: 1, sensor_stream_id: streamIds.sensor_stream_id, mission_id: demo.mission.mission_id, site_id: demo.site.site_id, stream_name: 'Demo CTD', stream_type: 'ctd', instrument_id: 'CTD-01', equipment_log_id: equipment?.equipment_log_id || '', rov_operation_sequence: 1, rov_operation_id: operation.rov_operation_id, source_filename: 'demo_ctd.csv', source_row_count: rows.length, downsample_every: 1, mapping, sensor_time_at_launch: '2026-07-03T12:00:00Z', time_offset_seconds: offset, timezone_note: 'UTC', summary });
demo.records.sensor_streams = [stream];
demo.records.sensor_readings = normalized.readings;
const qgis = buildQgisLayers({ root: [{ ...demo.mission, ...demo.site }], ...demo.records });
assert.equal(qgis['sensor_readings.geojson'].features.length, 2);
const result = runFullQaqc({ mission: demo.mission, site: demo.site }, demo.records);
assert.equal(result.summary.errors, 0, `Expected no sensor errors, got ${result.findings.map((f) => `${f.rule}:${f.message}`).join(' | ')}`);
const broken = structuredClone(demo.records);
broken.sensor_readings[0].sensor_stream_id = 'ES-20260703-01-SEN99';
const brokenResult = runFullQaqc({ mission: demo.mission, site: demo.site }, broken);
assert.ok(brokenResult.findings.some((finding) => finding.rule === 'orphan_link' && finding.table === 'sensor_readings'));
console.log('Sensor-stream import and QA/QC smoke test passed.');
