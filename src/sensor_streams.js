/**
 * Sensor-stream import, normalization, and mission/video synchronization helpers.
 * The app stores imported readings as normal field records so they are available offline,
 * validated with the mission, and exported as CSV/GeoJSON without a cloud service.
 */

export const SENSOR_IMPORT_MAX_ROWS = 25000;

export const SENSOR_FIELDS = [
  ['timestamp', 'Sensor timestamp', true],
  ['latitude_dd', 'Latitude (decimal degrees)', false],
  ['longitude_dd', 'Longitude (decimal degrees)', false],
  ['depth_m', 'Depth (m)', false],
  ['temperature_c', 'Temperature (°C)', false],
  ['salinity_psu', 'Salinity (PSU)', false],
  ['conductivity_us_cm', 'Conductivity (µS/cm)', false],
  ['dissolved_oxygen_mg_l', 'Dissolved oxygen (mg/L)', false],
  ['ph', 'pH', false],
  ['turbidity_ntu', 'Turbidity (NTU)', false],
  ['heading_deg', 'Heading (degrees)', false],
  ['pressure_dbar', 'Pressure (dbar)', false]
];

const HEADER_ALIASES = {
  timestamp: ['timestamp','datetime','date_time','date_time_utc','datetime_utc','timestamp_utc','utc_time','time_utc','date_time_local','local_time','time','date'],
  latitude_dd: ['latitude_dd','latitude','lat','gps_lat','gps_latitude','latitude_deg'],
  longitude_dd: ['longitude_dd','longitude','lon','lng','gps_lon','gps_longitude','longitude_deg'],
  depth_m: ['depth_m','depth','depthmeters','depth_meter','water_depth_m'],
  temperature_c: ['temperature_c','temperature','temp_c','temp','water_temperature_c','water_temp_c'],
  salinity_psu: ['salinity_psu','salinity','psu'],
  conductivity_us_cm: ['conductivity_us_cm','conductivity','conductivity_us','ec_us_cm','specific_conductance'],
  dissolved_oxygen_mg_l: ['dissolved_oxygen_mg_l','dissolved_oxygen','do_mg_l','do','oxygen_mg_l'],
  ph: ['ph','p_h'],
  turbidity_ntu: ['turbidity_ntu','turbidity','ntu'],
  heading_deg: ['heading_deg','heading','course_deg','course'],
  pressure_dbar: ['pressure_dbar','pressure','dbar']
};

const clean = (value) => value === undefined || value === null ? '' : String(value).trim();
const number = (value) => {
  const n = Number(clean(value));
  return Number.isFinite(n) ? n : '';
};
const slug = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function autoDetectSensorMapping(headers = []) {
  const available = headers.map((header) => slug(header));
  const mapping = {};
  Object.entries(HEADER_ALIASES).forEach(([target, aliases]) => {
    mapping[target] = aliases.find((candidate) => available.includes(candidate)) || '';
  });
  return mapping;
}

export function sensorMappingSummary(mapping = {}) {
  return SENSOR_FIELDS.filter(([key]) => clean(mapping[key])).map(([key, label]) => ({ key, label, source: mapping[key] }));
}

export function parseSensorTimestamp(value) {
  const raw = clean(value);
  if (!raw) return null;
  // Supports ISO-8601 text, browser-recognized local time strings, and Unix timestamps.
  if (/^\d{10}(?:\.\d+)?$/.test(raw)) return new Date(Number(raw) * 1000).toISOString();
  if (/^\d{13}(?:\.\d+)?$/.test(raw)) return new Date(Number(raw)).toISOString();
  const millis = new Date(raw).getTime();
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

export function sensorClockOffsetSeconds(operation = {}, sensorTimeAtLaunch = '') {
  const launchMs = new Date(operation.launch_datetime_utc || '').getTime();
  const sensorMs = new Date(sensorTimeAtLaunch || '').getTime();
  if (!Number.isFinite(launchMs) || !Number.isFinite(sensorMs)) return null;
  return Math.round((launchMs - sensorMs) / 1000);
}

export function estimateSensorMissionTime(rawTimestamp = '', offsetSeconds = null) {
  const raw = parseSensorTimestamp(rawTimestamp);
  const millis = new Date(raw || '').getTime();
  const offset = Number(offsetSeconds);
  if (!Number.isFinite(millis) || !Number.isFinite(offset)) return '';
  return new Date(millis + offset * 1000).toISOString();
}

export function normalizeSensorRows(rows = [], mapping = {}, options = {}) {
  const streamId = clean(options.sensor_stream_id);
  const missionId = clean(options.mission_id);
  const siteId = clean(options.site_id);
  const operationId = clean(options.rov_operation_id);
  const operationSequence = clean(options.rov_operation_sequence);
  const offset = Number.isFinite(Number(options.time_offset_seconds)) ? Number(options.time_offset_seconds) : null;
  const downsample = Math.max(1, Math.floor(Number(options.downsample_every) || 1));
  const readings = [];
  const warnings = [];
  let skipped = 0;

  rows.forEach((source, index) => {
    if (index % downsample !== 0) return;
    const rawTimestamp = clean(source[mapping.timestamp]);
    const timestamp = parseSensorTimestamp(rawTimestamp);
    if (!timestamp) { skipped += 1; return; }
    const lat = number(source[mapping.latitude_dd]);
    const lon = number(source[mapping.longitude_dd]);
    const sequence = readings.length + 1;
    const record = {
      sensor_reading_sequence: sequence,
      sensor_reading_id: streamId ? `${streamId}-R${String(sequence).padStart(6, '0')}` : '',
      sensor_stream_id: streamId,
      mission_id: missionId,
      site_id: siteId,
      rov_operation_sequence: operationSequence,
      rov_operation_id: operationId,
      raw_sensor_timestamp: rawTimestamp,
      normalized_sensor_datetime_utc: timestamp,
      estimated_mission_datetime_utc: estimateSensorMissionTime(timestamp, offset),
      time_offset_seconds: offset === null ? '' : offset,
      latitude_dd: lat,
      longitude_dd: lon,
      depth_m: number(source[mapping.depth_m]),
      temperature_c: number(source[mapping.temperature_c]),
      salinity_psu: number(source[mapping.salinity_psu]),
      conductivity_us_cm: number(source[mapping.conductivity_us_cm]),
      dissolved_oxygen_mg_l: number(source[mapping.dissolved_oxygen_mg_l]),
      ph: number(source[mapping.ph]),
      turbidity_ntu: number(source[mapping.turbidity_ntu]),
      heading_deg: number(source[mapping.heading_deg]),
      pressure_dbar: number(source[mapping.pressure_dbar]),
      record_status: 'Complete',
      _createdAt: new Date().toISOString(),
      _updatedAt: new Date().toISOString()
    };
    readings.push(record);
  });

  if (skipped) warnings.push(`${skipped} row${skipped === 1 ? '' : 's'} were skipped because the mapped timestamp could not be parsed.`);
  if (rows.length > SENSOR_IMPORT_MAX_ROWS) warnings.push(`The source has ${rows.length.toLocaleString()} rows. Only the first ${SENSOR_IMPORT_MAX_ROWS.toLocaleString()} should be imported after any downsampling to keep the device responsive.`);
  return { readings, warnings, skipped };
}

export function summarizeSensorReadings(readings = []) {
  const valid = readings.filter((row) => clean(row.normalized_sensor_datetime_utc));
  const numericRange = (field) => {
    const values = valid.map((row) => Number(row[field])).filter(Number.isFinite);
    return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
  };
  const first = [...valid].sort((a, b) => String(a.normalized_sensor_datetime_utc).localeCompare(String(b.normalized_sensor_datetime_utc)))[0] || null;
  const last = [...valid].sort((a, b) => String(b.normalized_sensor_datetime_utc).localeCompare(String(a.normalized_sensor_datetime_utc)))[0] || null;
  const coordinateCount = valid.filter((row) => Number.isFinite(Number(row.latitude_dd)) && Number.isFinite(Number(row.longitude_dd))).length;
  return {
    reading_count: valid.length,
    first_sensor_datetime_utc: first?.normalized_sensor_datetime_utc || '',
    last_sensor_datetime_utc: last?.normalized_sensor_datetime_utc || '',
    first_estimated_mission_datetime_utc: first?.estimated_mission_datetime_utc || '',
    last_estimated_mission_datetime_utc: last?.estimated_mission_datetime_utc || '',
    coordinate_count: coordinateCount,
    ranges: {
      depth_m: numericRange('depth_m'),
      temperature_c: numericRange('temperature_c'),
      salinity_psu: numericRange('salinity_psu'),
      dissolved_oxygen_mg_l: numericRange('dissolved_oxygen_mg_l'),
      turbidity_ntu: numericRange('turbidity_ntu')
    }
  };
}

export function makeSensorStreamRecord(input = {}) {
  const summary = input.summary || {};
  return {
    sensor_stream_sequence: input.sequence,
    sensor_stream_id: input.sensor_stream_id,
    mission_id: input.mission_id,
    site_id: input.site_id,
    stream_name: clean(input.stream_name),
    stream_type: clean(input.stream_type || 'custom'),
    instrument_id: clean(input.instrument_id),
    equipment_log_id: clean(input.equipment_log_id),
    rov_operation_sequence: clean(input.rov_operation_sequence),
    rov_operation_id: clean(input.rov_operation_id),
    source_filename: clean(input.source_filename),
    source_row_count: Number(input.source_row_count) || 0,
    imported_row_count: Number(summary.reading_count) || 0,
    downsample_every: Math.max(1, Math.floor(Number(input.downsample_every) || 1)),
    timestamp_column: clean(input.mapping?.timestamp),
    column_mapping_json: JSON.stringify(input.mapping || {}),
    sensor_time_at_launch: clean(input.sensor_time_at_launch),
    time_offset_seconds: input.time_offset_seconds === null || input.time_offset_seconds === undefined ? '' : Number(input.time_offset_seconds),
    timezone_note: clean(input.timezone_note),
    first_sensor_datetime_utc: summary.first_sensor_datetime_utc || '',
    last_sensor_datetime_utc: summary.last_sensor_datetime_utc || '',
    first_estimated_mission_datetime_utc: summary.first_estimated_mission_datetime_utc || '',
    last_estimated_mission_datetime_utc: summary.last_estimated_mission_datetime_utc || '',
    coordinate_count: Number(summary.coordinate_count) || 0,
    import_status: 'complete',
    notes: clean(input.notes),
    record_status: 'Complete',
    _createdAt: new Date().toISOString(),
    _updatedAt: new Date().toISOString()
  };
}

export function streamOperationalWindow(stream = {}) {
  const start = new Date(stream.first_estimated_mission_datetime_utc || stream.first_sensor_datetime_utc || '').getTime();
  const end = new Date(stream.last_estimated_mission_datetime_utc || stream.last_sensor_datetime_utc || '').getTime();
  return { start: Number.isFinite(start) ? start : null, end: Number.isFinite(end) ? end : null };
}
