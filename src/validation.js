import { SCHEMAS, makeIds } from './schema.js';
import { getProtocol } from './protocols.js';
import { normalizeVideoLogTime } from './rov.js';
import { parseSensorTimestamp, estimateSensorMissionTime } from './sensor_streams.js';

const blank = (value) => value === undefined || value === null || String(value).trim() === '';
const numeric = (value) => !blank(value) && Number.isFinite(Number(value));

export function validateForm(table, data, mission, site, recordsByTable = {}) {
  const errors = [];
  const protocol = getProtocol(mission?.protocol_id || 'custom_general');
  const schema = SCHEMAS[table];
  if (!schema) return errors;
  for (const field of schema.fields) {
    if (field.type === 'computed' || field.type === 'file' || field.type === 'location') continue;
    const value = data[field.name];
    if (field.required && blank(value)) errors.push(`${field.label} is required.`);
    if (!blank(value) && field.pattern && !(new RegExp(field.pattern).test(value))) errors.push(`${field.label} does not use the expected ID format.`);
    if (!blank(value) && field.type === 'number' && !numeric(value)) errors.push(`${field.label} must be a valid number.`);
    if (numeric(value) && field.min !== undefined && Number(value) < Number(field.min)) errors.push(`${field.label} cannot be less than ${field.min}.`);
    if (numeric(value) && field.max !== undefined && Number(value) > Number(field.max)) errors.push(`${field.label} cannot be greater than ${field.max}.`);
  }
  for (const field of schema.fields.filter((field) => field.type === 'location')) {
    const lat = data[field.lat]; const lon = data[field.lon];
    const present = !blank(lat) || !blank(lon) || !blank(data[field.name]);
    if ((field.required || present) && (blank(lat) || blank(lon) || !numeric(lat) || !numeric(lon))) errors.push(`${field.label} needs a usable latitude and longitude.`);
    if (numeric(lat) && (Number(lat) < -90 || Number(lat) > 90)) errors.push(`${field.label} latitude must be between -90 and 90.`);
    if (numeric(lon) && (Number(lon) < -180 || Number(lon) > 180)) errors.push(`${field.label} longitude must be between -180 and 180.`);
  }
  if (table === 'observations') {
    const needsTaxonName = String(data.observation_category || 'organism').toLowerCase() === 'organism';
    if (needsTaxonName && ['scientific', 'both'].includes(data.taxon_name_basis) && blank(data.taxon_scientific_name)) errors.push('Scientific name is required for the selected name basis when recording an organism.');
    if (needsTaxonName && ['common', 'both'].includes(data.taxon_name_basis) && blank(data.common_name)) errors.push('Common name is required for the selected name basis when recording an organism.');
    if (protocol.id === 'shoreline_debris' && data.observation_category && String(data.observation_category).toLowerCase() !== 'debris') errors.push('Shoreline debris protocol observations must use the Debris category. Use a separate General / custom mission for non-debris records.');
  }
  if (table === 'samples' && protocol.id === 'edna_collection' && data.sample_type && String(data.sample_type).toLowerCase() !== 'edna_water') errors.push('eDNA collection protocol samples must use the eDNA water sample type.');
  if (table === 'environment' && ['station', 'transect'].includes(data.environment_link_context) && blank(data.environment_station_sequence)) errors.push('A station number is required for station or transect-linked environmental data.');
  if (table === 'environment' && data.environment_link_context === 'transect' && blank(data.environment_transect_sequence)) errors.push('A transect number is required for transect-linked environmental data.');
  if (table === 'observations' && ['station', 'transect'].includes(data.observation_link_context) && blank(data.observation_station_sequence)) errors.push('A station number is required for station or transect-linked observations.');
  if (table === 'observations' && data.observation_link_context === 'transect' && blank(data.observation_transect_sequence)) errors.push('A transect number is required for transect-linked observations.');
  if (table === 'media' && ['station', 'transect'].includes(data.media_link_context) && blank(data.media_station_sequence)) errors.push('A station number is required for station or transect-linked media.');
  if (table === 'media' && data.media_link_context === 'transect' && blank(data.media_transect_sequence)) errors.push('A transect number is required for transect-linked media.');
  if (table === 'media' && data.media_link_context === 'observation' && blank(data.media_observation_sequence)) errors.push('An observation number is required for observation-linked media.');
  if (table === 'media' && blank(data.file_name_manual) && blank(data.file_name)) errors.push('A media filename is required; attach a file or enter an external filename.');
  if (table === 'samples' && ['station', 'transect', 'observation'].includes(data.sample_link_context) && blank(data.sample_station_sequence)) errors.push('A station number is required for station-, transect-, or observation-linked samples.');
  if (table === 'samples' && data.sample_link_context === 'transect' && blank(data.sample_transect_sequence)) errors.push('A transect number is required for transect-linked samples.');
  if (table === 'samples' && data.sample_link_context === 'observation' && blank(data.sample_observation_sequence)) errors.push('An observation number is required for observation-linked samples.');
  if (table === 'custody' && blank(data.sample_sequence)) errors.push('Choose the sample for this custody event.');
  if (table === 'tracks' && data.track_status !== 'recording' && (!Array.isArray(data.track_points) || data.track_points.length < 2)) errors.push('A completed GPS track needs at least two recorded points. Start tracks from the live GPS control.');
  if (table === 'rov_operations') {
    const equipment = (recordsByTable.equipment || []).find((row) => String(row.equipment_log_id) === String(data.rov_equipment_log_id));
    if (data.rov_equipment_log_id && !equipment) errors.push('Selected ROV equipment record does not exist.');
    if (equipment && String(equipment.equipment_category || '').toLowerCase() !== 'rov') errors.push('Selected ROV equipment record must be categorized as ROV.');
    const launch = new Date(data.launch_datetime_utc || '').getTime(); const recovery = new Date(data.recovery_datetime_utc || '').getTime();
    if (data.recovery_datetime_utc && Number.isFinite(launch) && Number.isFinite(recovery) && recovery < launch) errors.push('Recovery timestamp cannot be earlier than launch timestamp.');
    if (data.operation_status === 'complete' && !data.recovery_datetime_utc) errors.push('A completed ROV operation requires a recovery timestamp.');
  }
  if (table === 'video_logs') {
    const operation = (recordsByTable.rov_operations || []).find((row) => String(row.operation_sequence) === String(data.rov_operation_sequence));
    if (data.rov_operation_sequence && !operation) errors.push('Selected ROV operation does not exist.');
    const time = normalizeVideoLogTime(data);
    if (!time.valid) errors.push('Video elapsed time must be a non-negative number of seconds or a valid HH:MM:SS timecode.');
    if (['station','transect'].includes(data.video_log_link_context) && blank(data.video_log_station_sequence)) errors.push('A station number is required for station- or transect-linked video-log events.');
    if (data.video_log_link_context === 'transect' && blank(data.video_log_transect_sequence)) errors.push('A transect number is required for transect-linked video-log events.');
    if (data.video_log_link_context === 'observation' && blank(data.video_log_observation_sequence)) errors.push('An observation number is required for observation-linked video-log events.');
  }
  if (table === 'sensor_streams') {
    const operation = (recordsByTable.rov_operations || []).find((row) => String(row.operation_sequence) === String(data.rov_operation_sequence));
    if (data.rov_operation_sequence && !operation) errors.push('Selected ROV operation does not exist.');
    if (data.rov_operation_sequence && blank(data.sensor_time_at_launch)) errors.push('A sensor clock timestamp at physical launch is required when linking a sensor stream to an ROV operation.');
    if (data.sensor_time_at_launch && !parseSensorTimestamp(data.sensor_time_at_launch)) errors.push('Sensor clock timestamp at launch could not be parsed. Use an ISO-compatible date/time value.');
  }
  if (table === 'sensor_readings') {
    const stream = (recordsByTable.sensor_streams || []).find((row) => String(row.sensor_stream_sequence) === String(data.sensor_stream_sequence));
    if (data.sensor_stream_sequence && !stream) errors.push('Selected sensor stream does not exist.');
    if (!parseSensorTimestamp(data.raw_sensor_timestamp || data.normalized_sensor_datetime_utc)) errors.push('Sensor reading needs a parseable raw or normalized sensor timestamp.');
  }
  return errors;
}

export function validateSurvey(survey, recordsByTable) {
  const findings = [];
  const mission = survey.mission || {}; const site = survey.site || {};
  const missionErrors = validateForm('mission', mission, mission, site, recordsByTable);
  const siteErrors = validateForm('site', site, mission, site, recordsByTable);
  missionErrors.forEach((message) => findings.push({ severity: 'error', table: 'mission', message }));
  siteErrors.forEach((message) => findings.push({ severity: 'error', table: 'site', message }));

  for (const [table, records] of Object.entries(recordsByTable)) {
    for (const record of records) {
      validateForm(table, record, mission, site, recordsByTable).forEach((message) => findings.push({ severity: 'error', table, recordId: record[SCHEMAS[table].idField], message }));
    }
  }

  const stationIds = new Set((recordsByTable.stations || []).map((row) => row.station_id));
  const transectIds = new Set((recordsByTable.transects || []).map((row) => row.transect_id));
  const observationIds = new Set((recordsByTable.observations || []).map((row) => row.observation_id));
  const mediaIds = new Set((recordsByTable.media || []).map((row) => row.media_id));
  const sampleIds = new Set((recordsByTable.samples || []).map((row) => row.sample_id));
  const duplicateCheck = (table, idField) => {
    const seen = new Set();
    for (const row of recordsByTable[table] || []) {
      const id = row[idField]; if (!id) continue;
      if (seen.has(id)) findings.push({ severity: 'error', table, recordId: id, message: `Duplicate ${idField}.` }); else seen.add(id);
    }
  };
  duplicateCheck('equipment', 'equipment_log_id'); duplicateCheck('rov_operations', 'rov_operation_id'); duplicateCheck('video_logs', 'video_log_id'); duplicateCheck('sensor_streams', 'sensor_stream_id'); duplicateCheck('sensor_readings', 'sensor_reading_id'); duplicateCheck('stations', 'station_id'); duplicateCheck('tracks', 'track_id'); duplicateCheck('transects', 'transect_id'); duplicateCheck('environment', 'env_record_id'); duplicateCheck('observations', 'observation_id'); duplicateCheck('samples', 'sample_id'); duplicateCheck('custody', 'custody_id'); duplicateCheck('media', 'media_id');

  const rovOperationIds = new Set((recordsByTable.rov_operations || []).map((row) => row.rov_operation_id));
  const sensorStreamIds = new Set((recordsByTable.sensor_streams || []).map((row) => row.sensor_stream_id));
  const trackIds = new Set((recordsByTable.tracks || []).map((row) => row.track_id));
  for (const row of recordsByTable.rov_operations || []) {
    if (row.navigation_track_id && !trackIds.has(row.navigation_track_id)) findings.push({ severity: 'error', table: 'rov_operations', recordId: row.rov_operation_id, message: 'Linked navigation track does not exist.' });
    if (row.video_media_id && !mediaIds.has(row.video_media_id)) findings.push({ severity: 'error', table: 'rov_operations', recordId: row.rov_operation_id, message: 'Primary ROV video Media ID does not exist.' });
  }
  for (const row of recordsByTable.sensor_streams || []) if (row.rov_operation_id && !rovOperationIds.has(row.rov_operation_id)) findings.push({ severity: 'error', table: 'sensor_streams', recordId: row.sensor_stream_id, message: 'Linked ROV operation does not exist.' });
  for (const row of recordsByTable.sensor_readings || []) if (row.sensor_stream_id && !sensorStreamIds.has(row.sensor_stream_id)) findings.push({ severity: 'error', table: 'sensor_readings', recordId: row.sensor_reading_id, message: 'Linked sensor stream does not exist.' });
  for (const row of recordsByTable.video_logs || []) {
    if (row.rov_operation_id && !rovOperationIds.has(row.rov_operation_id)) findings.push({ severity: 'error', table: 'video_logs', recordId: row.video_log_id, message: 'Linked ROV operation does not exist.' });
    if (row.station_id && !stationIds.has(row.station_id)) findings.push({ severity: 'error', table: 'video_logs', recordId: row.video_log_id, message: 'Linked station does not exist.' });
    if (row.transect_id && !transectIds.has(row.transect_id)) findings.push({ severity: 'error', table: 'video_logs', recordId: row.video_log_id, message: 'Linked transect does not exist.' });
    if (row.observation_id && !observationIds.has(row.observation_id)) findings.push({ severity: 'error', table: 'video_logs', recordId: row.video_log_id, message: 'Linked observation does not exist.' });
  }
  for (const row of recordsByTable.transects || []) if (row.station_id && !stationIds.has(row.station_id)) findings.push({ severity: 'error', table: 'transects', recordId: row.transect_id, message: 'Linked station does not exist.' });
  for (const row of recordsByTable.tracks || []) if (row.linked_station_id && !stationIds.has(row.linked_station_id)) findings.push({ severity: 'error', table: 'tracks', recordId: row.track_id, message: 'Linked station does not exist.' });
  for (const table of ['environment', 'observations', 'samples', 'media']) for (const row of recordsByTable[table] || []) {
    if (row.station_id && !stationIds.has(row.station_id)) findings.push({ severity: 'error', table, recordId: row[SCHEMAS[table].idField], message: 'Linked station does not exist.' });
    if (row.transect_id && !transectIds.has(row.transect_id)) findings.push({ severity: 'error', table, recordId: row[SCHEMAS[table].idField], message: 'Linked transect does not exist.' });
  }
  for (const row of recordsByTable.media || []) if (row.observation_id && !observationIds.has(row.observation_id)) findings.push({ severity: 'error', table: 'media', recordId: row.media_id, message: 'Linked observation does not exist.' });
  for (const row of recordsByTable.samples || []) if (row.observation_id && !observationIds.has(row.observation_id)) findings.push({ severity: 'error', table: 'samples', recordId: row.sample_id, message: 'Linked observation does not exist.' });
  for (const row of recordsByTable.custody || []) if (row.sample_id && !sampleIds.has(row.sample_id)) findings.push({ severity: 'error', table: 'custody', recordId: row.custody_id, message: 'Linked sample does not exist.' });
  for (const row of recordsByTable.observations || []) if (row.media_id && !mediaIds.has(row.media_id)) findings.push({ severity: 'error', table: 'observations', recordId: row.observation_id, message: 'Linked media does not exist.' });
  for (const row of recordsByTable.transects || []) if (row.media_id_primary && !mediaIds.has(row.media_id_primary)) findings.push({ severity: 'error', table: 'transects', recordId: row.transect_id, message: 'Primary media ID does not exist.' });
  const coveredStations = new Set((recordsByTable.environment || []).map((row) => row.station_id).filter(Boolean));
  for (const row of recordsByTable.stations || []) if (row.station_id && !coveredStations.has(row.station_id)) findings.push({ severity: 'warning', table: 'stations', recordId: row.station_id, message: 'No environmental record is linked to this station.' });
  return findings;
}

export function withCalculatedFields(table, raw, mission, site, recordsByTable = {}) {
  const data = { ...raw };
  const ids = makeIds(mission, site, table, data);
  Object.assign(data, ids);
  for (const field of SCHEMAS[table].fields.filter((item) => item.type === 'location')) {
    if (!blank(data[field.lat]) && !blank(data[field.lon])) data[field.name] = `${data[field.lat]} ${data[field.lon]} ${data[field.accuracy] || ''}`.trim();
  }
  if (table === 'samples') {
    data.sample_label = data.sample_label || data.sample_id || '';
    data.barcode_format = data.barcode_format || 'manual_text';
  }
  if (table === 'media') {
    data.file_name = data.file_name || data.file_name_manual || '';
    if (!data.file_extension && data.file_name) data.file_extension = String(data.file_name).split('.').pop().toLowerCase();
  }
  if (table === 'video_logs') {
    const time = normalizeVideoLogTime(data);
    if (time.valid) { data.video_elapsed_seconds = time.seconds; data.video_timecode = time.timecode; }
  }
  if (table === 'sensor_readings') {
    const normalized = parseSensorTimestamp(data.raw_sensor_timestamp || data.normalized_sensor_datetime_utc);
    if (normalized) data.normalized_sensor_datetime_utc = normalized;
    const stream = (recordsByTable.sensor_streams || []).find((row) => String(row.sensor_stream_sequence) === String(data.sensor_stream_sequence));
    if (stream) {
      data.sensor_stream_id = stream.sensor_stream_id;
      data.time_offset_seconds = stream.time_offset_seconds ?? '';
      data.estimated_mission_datetime_utc = estimateSensorMissionTime(data.normalized_sensor_datetime_utc, stream.time_offset_seconds);
    }
  }
  data.record_status = 'Complete';
  return data;
}
