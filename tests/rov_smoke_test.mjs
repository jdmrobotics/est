import assert from 'node:assert/strict';
import { demoSurvey } from '../src/export.js';
import { runFullQaqc } from '../src/qaqc.js';
import { validateGeoJsonLayers } from '../src/export.js';
import { buildMapModel } from '../src/map.js';
import { validateSurvey } from '../src/validation.js';
import { protocolMissionFields } from '../src/protocols.js';
import { buildRovVideoLogDraft, estimateVideoLogMissionTime, formatTimecode, normalizeVideoLogTime, operationDurationSeconds, parseTimecode, summarizeRovOperation } from '../src/rov.js';

const demo = demoSurvey();
Object.assign(demo.mission, protocolMissionFields('rov_reconnaissance'), { platform: 'rov' });
const missionId = demo.mission.mission_id;
const station = demo.records.stations[0];
const media = demo.records.media[0];
media.media_type = 'video';
media.camera_or_sensor_id = 'ROV-CAM-01';
media.file_name_manual = 'ROV_Demo_Run_001.mp4';
media.file_name = media.file_name_manual;

const rovEquipment = {
  equipment_sequence: 2, equipment_log_id: `${missionId}-Q002`, mission_id: missionId, site_id: demo.site.site_id,
  equipment_id: 'ES-ROV-01', equipment_category: 'rov', make_model: 'EcoSurvey tethered ROV', serial_number: 'DEMO-ROV-01',
  calibration_status: 'not_required', battery_or_power_id: 'ROV-BAT-01', pre_mission_check: 'yes', post_mission_check: 'yes',
  operational_status: 'operational', custodian: 'Demo Field Lead', record_status: 'Complete'
};
demo.records.equipment.push(rovEquipment);

const launch = new Date(demo.mission.actual_start_utc);
const recovery = new Date(launch.getTime() + 15 * 60 * 1000);
const operation = {
  operation_sequence: 1, rov_operation_id: `${missionId}-ROV01`, mission_id: missionId, site_id: demo.site.site_id,
  rov_equipment_log_id: rovEquipment.equipment_log_id, vehicle_id: 'ES-ROV-01', operation_name: 'Demo ROV habitat pass',
  pilot: 'Demo Field Lead', tether_tender: 'Demo Observer', launch_datetime_utc: launch.toISOString(), recovery_datetime_utc: recovery.toISOString(),
  operation_status: 'complete', launch_latitude_dd: station.latitude_dd, launch_longitude_dd: station.longitude_dd, launch_gps_accuracy_m: '6',
  launch_location: `${station.latitude_dd} ${station.longitude_dd} 6`, max_depth_m: '3.5', tether_length_m: '45', video_time_at_launch_seconds: '12',
  navigation_track_id: demo.records.tracks[0].track_id, video_media_id: media.media_id, camera_or_sensor_id: 'ROV-CAM-01', battery_or_power_id: 'ROV-BAT-01', record_status: 'Complete'
};
demo.records.rov_operations = [operation];

const videoLog = {
  video_log_sequence: 1, video_log_id: `${missionId}-VLOG001`, mission_id: missionId, site_id: demo.site.site_id,
  rov_operation_sequence: 1, rov_operation_id: operation.rov_operation_id, video_log_datetime_utc: new Date(launch.getTime() + 173000).toISOString(),
  video_elapsed_seconds: 185, video_timecode: '00:03:05', estimated_mission_datetime_utc: new Date(launch.getTime() + 173000).toISOString(), event_type: 'organism_sighting', video_log_link_context: 'station',
  video_log_station_sequence: 1, station_id: station.station_id, media_id: media.media_id, candidate_taxon: 'Atlantic silverside',
  confidence: 'medium', logger: 'Demo Observer', event_description: 'Schooling fish observed adjacent to the transect line.', record_status: 'Complete'
};
demo.records.video_logs = [videoLog];

assert.equal(parseTimecode('03:05'), 185);
assert.equal(parseTimecode('01:02:03'), 3723);
assert.equal(parseTimecode('01:80'), null);
assert.equal(formatTimecode(185.7), '00:03:05');
assert.deepEqual(normalizeVideoLogTime({ video_timecode: '03:05' }), { valid: true, seconds: 185, timecode: '00:03:05' });
assert.equal(operationDurationSeconds(operation), 900);
assert.equal(estimateVideoLogMissionTime(operation, { video_elapsed_seconds: 185 }), new Date(launch.getTime() + 173000).toISOString());
const draft = buildRovVideoLogDraft({ operation, sequence: 2, missionLead: demo.mission.mission_lead, now: launch.toISOString() });
assert.equal(draft.rov_operation_sequence, 1);
assert.equal(draft.logger, 'Demo Field Lead');
const summary = summarizeRovOperation(operation, demo.records.video_logs);
assert.equal(summary.video_log_count, 1);
assert.equal(summary.event_counts.organism_sighting, 1);
assert.equal(summary.max_elapsed_seconds, 185);

const localFindings = validateSurvey({ mission: demo.mission, site: demo.site }, demo.records);
assert.equal(localFindings.filter((finding) => finding.severity === 'error').length, 0, JSON.stringify(localFindings));
const result = runFullQaqc({ id: 'rov-smoke', mission: demo.mission, site: demo.site }, demo.records, { bbox: {} });
assert.equal(result.summary.errors, 0, JSON.stringify(result.findings));
assert.equal(result.qgis_layers['rov_operations.geojson'].features.length, 1);
assert.equal(result.qgis_layers['video_logs.geojson'].features.length, 1);
assert.equal(result.qgis_layers['video_logs.geojson'].features[0].properties.coordinate_source, 'station_gps');
assert.equal(validateGeoJsonLayers(result.qgis_layers).valid, true);

const map = buildMapModel({ mission: demo.mission, site: demo.site }, demo.records);
assert.equal(map.shown.rov_operations, 1);
assert.equal(map.shown.video_logs, 1);

const bad = structuredClone(demo);
bad.records.video_logs[0].video_elapsed_seconds = '-2';
const badResult = runFullQaqc({ id: 'rov-smoke-bad', mission: bad.mission, site: bad.site }, bad.records, { bbox: {} });
assert.ok(badResult.findings.some((finding) => finding.rule === 'numeric_range' || finding.rule === 'video_timecode'));
console.log('ROV mission and synchronized video-log smoke test passed.');
