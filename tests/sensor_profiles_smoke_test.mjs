import assert from 'node:assert/strict';
import {
  availableSensorMetrics,
  buildSensorProfile,
  profileChartGeometry,
  nearestSensorReading,
  linkedVideoLogsForStream,
  linkVideoLogsToSensorStream,
  videoSensorJoinRows
} from '../src/sensor_profiles.js';

const stream = {
  sensor_stream_id: 'ES-20260705-01-SEN01',
  rov_operation_id: 'ES-20260705-01-ROV01',
  stream_name: 'Demo CTD'
};
const readings = [
  { sensor_reading_id: 'R001', sensor_stream_id: stream.sensor_stream_id, rov_operation_id: stream.rov_operation_id, normalized_sensor_datetime_utc: '2026-07-05T12:00:00.000Z', estimated_mission_datetime_utc: '2026-07-05T12:00:02.000Z', depth_m: 1.1, temperature_c: 22.1, salinity_psu: 17.2, turbidity_ntu: 3.2 },
  { sensor_reading_id: 'R002', sensor_stream_id: stream.sensor_stream_id, rov_operation_id: stream.rov_operation_id, normalized_sensor_datetime_utc: '2026-07-05T12:00:10.000Z', estimated_mission_datetime_utc: '2026-07-05T12:00:12.000Z', depth_m: 2.4, temperature_c: 22.3, salinity_psu: 17.4, turbidity_ntu: 4.0 },
  { sensor_reading_id: 'R003', sensor_stream_id: stream.sensor_stream_id, rov_operation_id: stream.rov_operation_id, normalized_sensor_datetime_utc: '2026-07-05T12:00:20.000Z', estimated_mission_datetime_utc: '2026-07-05T12:00:22.000Z', depth_m: 3.1, temperature_c: 22.6, salinity_psu: 17.8, turbidity_ntu: 5.1 }
];
const videoLogs = [
  { video_log_id: 'VLOG001', rov_operation_id: stream.rov_operation_id, video_timecode: '00:00:11', event_type: 'organism_sighting', estimated_mission_datetime_utc: '2026-07-05T12:00:11.000Z', event_description: 'Fish on structure.' },
  { video_log_id: 'VLOG002', rov_operation_id: stream.rov_operation_id, video_timecode: '00:02:30', event_type: 'target', estimated_mission_datetime_utc: '2026-07-05T12:02:30.000Z', event_description: 'Outside logger coverage.' },
  { video_log_id: 'OTHER', rov_operation_id: 'OTHER-ROV', video_timecode: '00:00:10', estimated_mission_datetime_utc: '2026-07-05T12:00:10.000Z' }
];

const metrics = availableSensorMetrics(readings);
assert.ok(metrics.some((metric) => metric.key === 'depth_m'));
assert.ok(metrics.some((metric) => metric.key === 'temperature_c'));

const profile = buildSensorProfile(readings, 'depth_m', { timeBasis: 'mission_time' });
assert.equal(profile.count, 3);
assert.equal(profile.min, 1.1);
assert.equal(profile.max, 3.1);
assert.equal(profile.firstTime, '2026-07-05T12:00:02.000Z');
const chart = profileChartGeometry(profile);
assert.equal(chart.empty, false);
assert.ok(chart.path.startsWith('M '));
assert.ok(chart.points[2].y > chart.points[0].y, 'Depth profile should render deeper values downward.');

const nearest = nearestSensorReading(readings, '2026-07-05T12:00:11.000Z', { toleranceSeconds: 15 });
assert.equal(nearest.reading.sensor_reading_id, 'R002');
assert.equal(nearest.withinTolerance, true);
assert.equal(nearest.deltaSeconds, 1);
const outside = nearestSensorReading(readings, '2026-07-05T12:02:30.000Z', { toleranceSeconds: 30 });
assert.equal(outside.withinTolerance, false);

assert.equal(linkedVideoLogsForStream(videoLogs, stream).length, 2);
const links = linkVideoLogsToSensorStream(videoLogs, stream, readings, { toleranceSeconds: 30 });
assert.equal(links.length, 2);
assert.equal(links[0].sensor_reading.sensor_reading_id, 'R002');
assert.equal(links[0].within_tolerance, true);
assert.equal(links[1].within_tolerance, false);
const rows = videoSensorJoinRows(links);
assert.equal(rows.length, 2);
assert.equal(rows[0].matched_sensor_reading_id, 'R002');
assert.equal(rows[1].within_tolerance, 'no');
console.log('Sensor-profile and video-link smoke test passed.');
