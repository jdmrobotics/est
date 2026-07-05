import { APP_VERSION, makeIds } from './schema.js';

export const QAQC_VERSION = '0.6.0';

const ID_PATTERNS = {
  mission_id: /^ES-\d{8}-\d{2}$/,
  site_id: /^ES-\d{8}-\d{2}-S\d{2}$/,
  equipment_log_id: /^ES-\d{8}-\d{2}-Q.+$/,
  station_id: /^ES-\d{8}-\d{2}-S\d{2}-ST\d{2}$/,
  transect_id: /^ES-\d{8}-\d{2}-S\d{2}-ST\d{2}-T\d{2}$/,
  env_record_id: /^ES-\d{8}-\d{2}-E.+$/,
  observation_id: /^ES-\d{8}-\d{2}-O.+$/,
  media_id: /^ES-\d{8}-\d{2}-M.+$/,
  track_id: /^ES-\d{8}-\d{2}-TRK\d{2}$/
};

const ALLOWED = {
  platform: new Set(['shore', 'wading', 'snorkel', 'scuba', 'kayak', 'boat', 'rov', 'drone', 'mixed']),
  data_status: new Set(['in_progress', 'complete', 'reviewed', 'archived']),
  yes_no: new Set(['yes', 'no']),
  link_context: new Set(['site', 'station', 'transect']),
  link_context_media: new Set(['site', 'station', 'transect', 'observation']),
  taxon_name_basis: new Set(['scientific', 'common', 'both']),
  taxon_source: new Set(['project_list', 'manual', 'unknown']),
  taxonomic_level: new Set(['species', 'genus', 'family', 'order', 'class', 'phylum', 'other']),
  observation_category: new Set(['organism', 'habitat', 'behavior', 'impact', 'debris', 'other']),
  qa_status: new Set(['unreviewed', 'provisional', 'verified', 'rejected']),
  media_capture_mode: new Set(['capture_photo', 'capture_video', 'capture_audio', 'external_reference']),
  track_type: new Set(['walking', 'vessel', 'rov_topsides', 'rov_navigation', 'dive', 'drone', 'other']),
  track_status: new Set(['recording', 'complete', 'stopped_with_issue'])
};

const REQUIRED_FIELDS = {
  root: ['mission_id', 'project_id', 'mission_date', 'mission_lead', 'objective', 'platform', 'data_status', 'site_sequence', 'site_id', 'site_name', 'site_location', 'dominant_habitat'],
  equipment: ['equipment_sequence', 'equipment_log_id', 'mission_id', 'equipment_id', 'equipment_category', 'calibration_status', 'pre_mission_check', 'operational_status', 'custodian'],
  stations: ['station_sequence', 'station_id', 'mission_id', 'site_id', 'station_type', 'collection_datetime_utc', 'station_location', 'depth_m', 'primary_habitat', 'primary_substrate', 'sampling_design', 'observer'],
  transects: ['transect_sequence', 'parent_station_sequence', 'transect_id', 'mission_id', 'site_id', 'station_id', 'transect_type', 'start_datetime_utc', 'mark_transect_complete', 'start_location', 'bearing_deg', 'length_m', 'width_m', 'platform', 'observer'],
  tracks: ['track_sequence', 'track_id', 'mission_id', 'site_id', 'track_type', 'start_datetime_utc', 'track_status', 'point_count', 'operator'],
  environment: ['environment_sequence', 'env_record_id', 'mission_id', 'site_id', 'environment_link_context', 'datetime_utc'],
  observations: ['observation_sequence', 'observation_id', 'mission_id', 'site_id', 'observation_link_context', 'observation_datetime_utc', 'taxon_name_basis', 'taxonomic_level', 'observation_category', 'observation_method', 'identification_confidence', 'observer', 'review_status'],
  media: ['media_sequence', 'media_id', 'mission_id', 'site_id', 'media_link_context', 'media_type', 'media_capture_mode', 'capture_datetime_utc', 'camera_or_sensor_id', 'operator', 'storage_path']
};

const ID_FIELDS = {
  root: ['mission_id', 'site_id'], equipment: ['equipment_log_id'], stations: ['station_id'], transects: ['transect_id'], tracks: ['track_id'],
  environment: ['env_record_id'], observations: ['observation_id'], media: ['media_id']
};

const blank = (value) => value === undefined || value === null || String(value).trim() === '';
const text = (value) => blank(value) ? '' : String(value).trim();
const number = (value) => blank(value) ? null : Number(value);
const finite = (value) => Number.isFinite(number(value));
const lower = (value) => text(value).toLowerCase();

function recordId(table, row) {
  const field = { root: 'site_id', equipment: 'equipment_log_id', stations: 'station_id', transects: 'transect_id', tracks: 'track_id', environment: 'env_record_id', observations: 'observation_id', media: 'media_id' }[table];
  return text(row?.[field]) || text(row?.mission_id) || 'mission/site record';
}
function add(findings, severity, rule, table, row, field, message, value = '') {
  findings.push({
    severity: String(severity).toUpperCase(), rule, table, source_file: 'EcoSurvey_Field_App', row_number: 0,
    record_id: recordId(table, row), field, message, value: value === undefined || value === null ? '' : String(value)
  });
}
function idSet(rows, field) { return new Set((rows || []).map((row) => text(row[field])).filter(Boolean)); }
function pointFrom(row, latField, lonField, rawField) {
  const lat = number(row?.[latField]); const lon = number(row?.[lonField]);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  const raw = text(row?.[rawField]);
  if (!raw) return null;
  const values = raw.split(/[ ,;]+/).filter(Boolean).map(Number);
  if (values.length >= 2 && Number.isFinite(values[0]) && Number.isFinite(values[1])) return { lat: values[0], lon: values[1] };
  return null;
}
function validPoint(point) { return !!point && point.lat >= -90 && point.lat <= 90 && point.lon >= -180 && point.lon <= 180; }
function parseBbox(options) {
  const values = ['min_lon', 'min_lat', 'max_lon', 'max_lat'].map((key) => number(options?.bbox?.[key]));
  if (!values.every(Number.isFinite)) return null;
  const [minLon, minLat, maxLon, maxLat] = values;
  if (minLon > maxLon || minLat > maxLat) return null;
  return { minLon, minLat, maxLon, maxLat };
}
function withinBbox(point, bbox) { return !bbox || (point.lon >= bbox.minLon && point.lon <= bbox.maxLon && point.lat >= bbox.minLat && point.lat <= bbox.maxLat); }
function isDateLike(value) {
  if (blank(value)) return true;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}
function statusFrom(findings) {
  const errors = findings.filter((finding) => finding.severity === 'ERROR').length;
  const warnings = findings.filter((finding) => finding.severity === 'WARNING').length;
  return { errors, warnings, info: findings.filter((finding) => finding.severity === 'INFO').length, status: errors ? 'REVIEW REQUIRED' : 'PASS' };
}
function snapshot(survey, recordsByTable) {
  const rows = Object.fromEntries(Object.entries(recordsByTable).map(([key, values]) => [key, [...values].sort((a,b) => recordId(key,a).localeCompare(recordId(key,b)))]));
  return { mission: survey.mission || {}, site: survey.site || {}, records: rows };
}
export function dataFingerprint(survey, recordsByTable) {
  const source = JSON.stringify(snapshot(survey, recordsByTable));
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) hash = ((hash << 5) + hash) ^ source.charCodeAt(i);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function checkRequired(tables, findings) {
  Object.entries(REQUIRED_FIELDS).forEach(([table, fields]) => {
    (tables[table] || []).forEach((row) => fields.forEach((field) => {
      if (blank(row[field])) add(findings, 'ERROR', 'required_field', table, row, field, 'Required field is blank.');
    }));
  });
}
function checkIds(tables, findings) {
  Object.entries(ID_FIELDS).forEach(([table, fields]) => fields.forEach((field) => {
    const seen = new Map();
    (tables[table] || []).forEach((row) => {
      const value = text(row[field]);
      if (!value) return;
      const pattern = ID_PATTERNS[field];
      if (pattern && !pattern.test(value)) add(findings, 'ERROR', 'id_format', table, row, field, `Does not match the EcoSurvey ${field} format.`, value);
      if (seen.has(value)) add(findings, 'ERROR', 'duplicate_id', table, row, field, `Duplicate ID; first appears in this app run as ${seen.get(value)}.`, value);
      else seen.set(value, recordId(table, row));
    });
  }));
}
function checkChoice(tables, findings, table, field, set) {
  (tables[table] || []).forEach((row) => { const value = lower(row[field]); if (value && !set.has(value)) add(findings, 'ERROR', 'choice_value', table, row, field, 'Value is not one of the EcoSurvey form choices.', value); });
}
function checkTimestamps(tables, findings) {
  [['root','mission_date'],['root','planned_start_local'],['stations','collection_datetime_utc'],['transects','start_datetime_utc'],['transects','end_datetime_utc'],['tracks','start_datetime_utc'],['tracks','end_datetime_utc'],['environment','datetime_utc'],['observations','observation_datetime_utc'],['media','capture_datetime_utc']].forEach(([table, field]) => {
    (tables[table] || []).forEach((row) => { if (!isDateLike(row[field])) add(findings, 'WARNING', 'datetime_format', table, row, field, 'Timestamp could not be parsed as ISO-8601.', row[field]); });
  });
}
function checkPoint(tables, findings, table, row, lat, lon, raw, field, bbox, required = false) {
  const hasRaw = !blank(row?.[lat]) || !blank(row?.[lon]) || !blank(row?.[raw]);
  if (!required && !hasRaw) return;
  const point = pointFrom(row, lat, lon, raw);
  if (!validPoint(point)) { add(findings, 'ERROR', 'invalid_coordinate', table, row, field, 'Coordinate is missing or cannot be parsed.'); return; }
  if (!withinBbox(point, bbox)) add(findings, 'ERROR', 'outside_study_area', table, row, field, 'Point falls outside the supplied study-area bounding box.', `${point.lat}, ${point.lon}`);
}
function checkTracks(tables, findings, bbox) {
  (tables.tracks || []).forEach((row) => {
    const points = Array.isArray(row.track_points) ? row.track_points : [];
    const expected = Number(row.point_count || 0);
    if (points.length < 2) add(findings, 'ERROR', 'track_minimum_points', 'tracks', row, 'track_points', 'A completed GPS track needs at least two valid points.');
    if (expected && expected !== points.length) add(findings, 'WARNING', 'track_point_count', 'tracks', row, 'point_count', 'Stored point_count does not match the track geometry point count.', `${expected} vs ${points.length}`);
    points.forEach((point, index) => {
      const valid = point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)) && Number(point.lat) >= -90 && Number(point.lat) <= 90 && Number(point.lon) >= -180 && Number(point.lon) <= 180;
      if (!valid) add(findings, 'ERROR', 'invalid_track_coordinate', 'tracks', row, 'track_points', `Track point ${index + 1} is missing or invalid.`);
      else if (!withinBbox({ lat: Number(point.lat), lon: Number(point.lon) }, bbox)) add(findings, 'ERROR', 'outside_study_area', 'tracks', row, 'track_points', `Track point ${index + 1} falls outside the supplied study-area bounding box.`);
    });
  });
}
function checkCoordinates(tables, findings, bbox) {
  (tables.root || []).forEach((row) => checkPoint(tables, findings, 'root', row, 'latitude_dd', 'longitude_dd', 'site_location', 'site_location', bbox, true));
  (tables.stations || []).forEach((row) => checkPoint(tables, findings, 'stations', row, 'latitude_dd', 'longitude_dd', 'station_location', 'station_location', bbox, true));
  (tables.transects || []).forEach((row) => checkPoint(tables, findings, 'transects', row, 'start_latitude_dd', 'start_longitude_dd', 'start_location', 'start_location', bbox, true));
  (tables.observations || []).forEach((row) => checkPoint(tables, findings, 'observations', row, 'latitude_dd', 'longitude_dd', 'observation_location', 'observation_location', bbox, false));
  (tables.media || []).forEach((row) => checkPoint(tables, findings, 'media', row, 'latitude_dd', 'longitude_dd', 'media_location', 'media_location', bbox, false));
}
function checkRange(tables, findings, table, field, min, max, severity = 'ERROR', integer = false) {
  (tables[table] || []).forEach((row) => {
    if (blank(row[field])) return;
    const value = number(row[field]);
    if (!Number.isFinite(value)) { add(findings, 'ERROR', 'invalid_number', table, row, field, 'Value is not numeric.', row[field]); return; }
    if (integer && !Number.isInteger(value)) add(findings, 'ERROR', 'integer_required', table, row, field, 'Value must be a whole number.', value);
    if (min !== null && value < min) add(findings, severity, 'numeric_range', table, row, field, `Value is below the expected minimum (${min}).`, value);
    if (max !== null && value > max) add(findings, severity, 'numeric_range', table, row, field, `Value is above the expected maximum (${max}).`, value);
  });
}
function checkNumeric(tables, findings) {
  [
    ['stations','depth_m',0,null,'ERROR'],['stations','visibility_m',0,null,'ERROR'],['stations','gps_accuracy_m',0,null,'ERROR'],
    ['transects','bearing_deg',0,360,'ERROR'],['transects','length_m',0.01,null,'ERROR'],['transects','width_m',0.01,null,'ERROR'],['transects','start_depth_m',0,null,'ERROR'],['transects','end_depth_m',0,null,'ERROR'],
    ['tracks','point_count',2,null,'ERROR',true],['tracks','distance_m',0,null,'ERROR'],['tracks','duration_seconds',0,null,'ERROR'],['tracks','average_accuracy_m',0,null,'WARNING'],
    ['environment','temperature_c',-2,45,'WARNING'],['environment','salinity_psu',0,50,'WARNING'],['environment','conductivity_us_cm',0,null,'ERROR'],['environment','dissolved_oxygen_mg_l',0,null,'ERROR'],['environment','ph',0,14,'ERROR'],['environment','turbidity_ntu',0,null,'ERROR'],['environment','depth_m',0,null,'ERROR'],['environment','secchi_depth_m',0,null,'ERROR'],['environment','current_velocity_m_s',0,null,'ERROR'],['environment','current_direction_deg',0,360,'ERROR'],['environment','wind_speed_m_s',0,null,'ERROR'],['environment','cloud_cover_pct',0,100,'ERROR'],['environment','water_visibility_m',0,null,'ERROR'],
    ['observations','count',0,null,'ERROR',true],['observations','percent_cover',0,100,'ERROR']
  ].forEach(([table, field, min, max, severity, integer]) => checkRange(tables, findings, table, field, min, max, severity, Boolean(integer)));
}
function checkLinks(tables, findings) {
  const missionIds = idSet(tables.root, 'mission_id'); const siteIds = idSet(tables.root, 'site_id');
  const stationIds = idSet(tables.stations, 'station_id'); const transectIds = idSet(tables.transects, 'transect_id'); const observationIds = idSet(tables.observations, 'observation_id'); const mediaIds = idSet(tables.media, 'media_id');
  ['equipment','stations','tracks','transects','environment','observations','media'].forEach((table) => (tables[table] || []).forEach((row) => {
    if (text(row.mission_id) && !missionIds.has(text(row.mission_id))) add(findings, 'ERROR', 'orphan_link', table, row, 'mission_id', 'mission_id does not exist in the root mission/site record.', row.mission_id);
    if (text(row.site_id) && !siteIds.has(text(row.site_id))) add(findings, 'ERROR', 'orphan_link', table, row, 'site_id', 'site_id does not exist in the root mission/site record.', row.site_id);
    if (['transects','environment','observations','media'].includes(table) && text(row.station_id) && !stationIds.has(text(row.station_id))) add(findings, 'ERROR', 'orphan_link', table, row, 'station_id', 'station_id does not exist in the Stations table.', row.station_id);
    if (['environment','observations','media'].includes(table) && text(row.transect_id) && !transectIds.has(text(row.transect_id))) add(findings, 'ERROR', 'orphan_link', table, row, 'transect_id', 'transect_id does not exist in the Transects table.', row.transect_id);
  }));
  (tables.observations || []).forEach((row) => { if (text(row.media_id) && !mediaIds.has(text(row.media_id))) add(findings, 'ERROR', 'missing_media_reference', 'observations', row, 'media_id', 'Linked Media ID does not exist in the Media table.', row.media_id); });
  (tables.transects || []).forEach((row) => { if (text(row.media_id_primary) && !mediaIds.has(text(row.media_id_primary))) add(findings, 'ERROR', 'missing_media_reference', 'transects', row, 'media_id_primary', 'Primary Media ID does not exist in the Media table.', row.media_id_primary); });
  (tables.media || []).forEach((row) => { if (text(row.observation_id) && !observationIds.has(text(row.observation_id))) add(findings, 'ERROR', 'orphan_link', 'media', row, 'observation_id', 'observation_id does not exist in the Observations table.', row.observation_id); });
  (tables.tracks || []).forEach((row) => { if (text(row.linked_station_id) && !stationIds.has(text(row.linked_station_id))) add(findings, 'ERROR', 'orphan_link', 'tracks', row, 'linked_station_id', 'linked_station_id does not exist in the Stations table.', row.linked_station_id); });
}
function checkContext(tables, findings) {
  [['environment','environment_link_context'],['observations','observation_link_context'],['media','media_link_context']].forEach(([table, contextField]) => (tables[table] || []).forEach((row) => {
    const context = lower(row[contextField]);
    if (['station','transect'].includes(context) && blank(row.station_id)) add(findings, 'ERROR', 'context_link', table, row, 'station_id', 'Context requires a linked station_id.');
    if (context === 'transect' && blank(row.transect_id)) add(findings, 'ERROR', 'context_link', table, row, 'transect_id', 'Transect context requires a linked transect_id.');
    if (context === 'observation' && blank(row.observation_id)) add(findings, 'ERROR', 'context_link', table, row, 'observation_id', 'Observation context requires a linked observation_id.');
    if (context === 'site' && (!blank(row.station_id) || !blank(row.transect_id))) add(findings, 'WARNING', 'context_link', table, row, contextField, 'Site-level context has a station or transect link; verify intended attachment.');
  }));
}
function checkObservationNames(tables, findings) {
  (tables.observations || []).forEach((row) => {
    const basis = lower(row.taxon_name_basis);
    const source = lower(row.taxon_source);
    if (['scientific','both'].includes(basis) && blank(row.taxon_scientific_name)) add(findings, 'ERROR', 'required_field', 'observations', row, 'taxon_scientific_name', 'Scientific name is required by the selected name basis.');
    if (['common','both'].includes(basis) && blank(row.common_name)) add(findings, 'ERROR', 'required_field', 'observations', row, 'common_name', 'Common name is required by the selected name basis.');
    if (source === 'project_list' && blank(row.taxon_list_id)) add(findings, 'ERROR', 'taxon_list_reference', 'observations', row, 'taxon_list_id', 'Project-list observation is missing its local species-list ID.');
    if (source === 'project_list' && blank(row.taxon_key)) add(findings, 'ERROR', 'taxon_list_reference', 'observations', row, 'taxon_key', 'Project-list observation is missing its controlled taxon key.');
    if (source === 'project_list' && blank(row.taxon_list_name)) add(findings, 'WARNING', 'taxon_list_reference', 'observations', row, 'taxon_list_name', 'Project-list observation has no species-list name; the ID and taxon key remain the authoritative link.');
  });
}
function checkMediaFiles(tables, findings) {
  (tables.media || []).forEach((row) => {
    const mode = lower(row.media_capture_mode); const filename = text(row.file_name) || text(row.file_name_manual);
    if (!filename) add(findings, 'ERROR', 'missing_media_file', 'media', row, 'file_name', 'Media record has no recorded filename.');
    if (mode === 'external_reference' && blank(row.file_name_manual)) add(findings, 'ERROR', 'missing_media_file', 'media', row, 'file_name_manual', 'External-reference media requires an external file name.');
    if (['capture_photo','capture_video','capture_audio'].includes(mode) && !filename) add(findings, 'ERROR', 'missing_media_file', 'media', row, 'file_name', 'Captured media has no attached or recorded file name.');
    if (['capture_photo','capture_video','capture_audio'].includes(mode) && !text(row.attachment_id)) add(findings, 'WARNING', 'local_attachment_reference', 'media', row, 'attachment_id', 'Captured media has no local attachment reference in this app record. Confirm the original file is preserved in the mission archive.');
  });
}
function checkCoverage(tables, findings, requireEnvironment) {
  if (!requireEnvironment) return;
  const covered = new Set((tables.environment || []).map((row) => text(row.station_id)).filter(Boolean));
  (tables.stations || []).forEach((row) => { const id = text(row.station_id); if (id && !covered.has(id)) add(findings, 'ERROR', 'missing_environment_record', 'stations', row, 'station_id', 'No environmental record is linked to this station. EcoSurvey expects at least one environmental record per station.'); });
}
function checkMissionDate(tables, findings) {
  (tables.root || []).forEach((row) => {
    const missionId = text(row.mission_id); const date = text(row.mission_date);
    if (!ID_PATTERNS.mission_id.test(missionId) || !date) return;
    const expected = missionId.split('-')[1]; const observed = date.replace(/[^0-9]/g, '').slice(0, 8);
    if (observed && expected !== observed) add(findings, 'WARNING', 'mission_date_mismatch', 'root', row, 'mission_date', 'Mission ID date does not match mission_date; check local-date and naming convention.', date);
  });
}
function outputProperties(row) {
  const copy = { ...row };
  delete copy._createdAt; delete copy._updatedAt; delete copy.attachment_id;
  if (Array.isArray(copy.track_points)) { copy.track_points_json = JSON.stringify(copy.track_points); delete copy.track_points; }
  return copy;
}
function feature(geometry, row, coordinateSource) { return { type: 'Feature', geometry, properties: { ...outputProperties(row), coordinate_source: coordinateSource } }; }
export function buildQgisLayers(tables) {
  const sitePoints = []; const stationPoints = []; const transectLines = []; const transectStarts = []; const trackLines = []; const trackPoints = []; const observationPoints = []; const environmentPoints = []; const mediaPoints = [];
  const sites = new Map(); const stations = new Map(); const transects = new Map();
  (tables.root || []).forEach((row) => { const p = pointFrom(row, 'latitude_dd', 'longitude_dd', 'site_location'); if (validPoint(p)) { sites.set(text(row.site_id), p); sitePoints.push(feature({ type: 'Point', coordinates: [p.lon, p.lat] }, row, 'site_gps')); } });
  (tables.stations || []).forEach((row) => { const p = pointFrom(row, 'latitude_dd', 'longitude_dd', 'station_location'); if (validPoint(p)) { stations.set(text(row.station_id), p); stationPoints.push(feature({ type: 'Point', coordinates: [p.lon, p.lat] }, row, 'station_gps')); } });
  (tables.transects || []).forEach((row) => { const start = pointFrom(row, 'start_latitude_dd', 'start_longitude_dd', 'start_location'); const end = pointFrom(row, 'end_latitude_dd', 'end_longitude_dd', 'end_location'); if (validPoint(start)) { transects.set(text(row.transect_id), start); transectStarts.push(feature({ type: 'Point', coordinates: [start.lon, start.lat] }, row, 'transect_start_gps')); } if (validPoint(start) && validPoint(end)) transectLines.push(feature({ type: 'LineString', coordinates: [[start.lon, start.lat], [end.lon, end.lat]] }, row, 'transect_start_end_gps')); });
  (tables.tracks || []).forEach((row) => { const points = (Array.isArray(row.track_points) ? row.track_points : []).filter((point) => validPoint(point)); if (points.length >= 2) trackLines.push(feature({ type: 'LineString', coordinates: points.map((point) => [Number(point.lon), Number(point.lat)]) }, row, 'device_gps_track')); const pointBase = { ...row }; delete pointBase.track_points; points.forEach((point, index) => trackPoints.push(feature({ type: 'Point', coordinates: [Number(point.lon), Number(point.lat)] }, { ...pointBase, track_point_index: index + 1, track_point_timestamp: point.timestamp || '', track_point_accuracy_m: point.accuracy ?? '' }, 'device_gps_track'))); });
  const resolved = (row, rawField) => { const own = pointFrom(row, 'latitude_dd', 'longitude_dd', rawField); if (validPoint(own)) return [own, 'independent_gps']; if (stations.has(text(row.station_id))) return [stations.get(text(row.station_id)), 'station_gps']; if (transects.has(text(row.transect_id))) return [transects.get(text(row.transect_id)), 'transect_start_gps']; if (sites.has(text(row.site_id))) return [sites.get(text(row.site_id)), 'site_gps']; return [null, 'unresolved']; };
  [['observations','observation_location',observationPoints],['environment','',environmentPoints],['media','media_location',mediaPoints]].forEach(([table, rawField, target]) => (tables[table] || []).forEach((row) => { const [p, source] = resolved(row, rawField); if (p) target.push(feature({ type: 'Point', coordinates: [p.lon, p.lat] }, row, source)); }));
  const collection = (features) => ({ type: 'FeatureCollection', features });
  return { 'sites.geojson': collection(sitePoints), 'stations.geojson': collection(stationPoints), 'tracks.geojson': collection(trackLines), 'track_points.geojson': collection(trackPoints), 'transects.geojson': collection(transectLines), 'transect_start_points.geojson': collection(transectStarts), 'observations.geojson': collection(observationPoints), 'environment.geojson': collection(environmentPoints), 'media.geojson': collection(mediaPoints) };
}
function reportMarkdown(tables, findings, summary, qgisLayers, options, runAt) {
  const layerRows = Object.entries(qgisLayers).map(([name, data]) => `| \`${name}\` | ${data.features.length} |`).join('\n');
  const ruleCounts = new Map(); findings.forEach((finding) => ruleCounts.set(finding.rule, (ruleCounts.get(finding.rule) || 0) + 1));
  const rules = ruleCounts.size ? [...ruleCounts.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([rule,count]) => `| ${rule} | ${count} |`).join('\n') : '| No findings | 0 |';
  const countRows = Object.entries(tables).map(([table, rows]) => `| ${table} | ${rows.length} |`).join('\n');
  return `# EcoSurvey In-App QA/QC Report v${QAQC_VERSION}\n\n**Validation status:** ${summary.status}${summary.errors ? ' — errors present' : ' — no blocking errors'}\n\n**Run at:** ${runAt}\n\n## Input tables\n\n| Table | Records |\n|---|---:|\n${countRows}\n\n## Findings\n\n- Errors: **${summary.errors}**\n- Warnings: **${summary.warnings}**\n- Information: **${summary.info}**\n\n| Rule | Count |\n|---|---:|\n${rules}\n\n## QGIS-ready outputs\n\n| Layer | Features written |\n|---|---:|\n${layerRows}\n\n## Validation settings\n\n- Environmental coverage per station: **${options.require_environment_per_station ? 'required' : 'not required'}**.\n- Study-area bounding box: **${options.bbox && Object.values(options.bbox).some((value) => !blank(value)) ? 'applied when all four values are valid' : 'not applied'}**.\n- Points use independent GPS first, then linked station, transect-start, or site GPS as a fallback. See \`coordinate_source\` in QGIS.\n\n## Next actions\n\n1. Correct every error before considering the mission QA/QC-cleared.\n2. Review warnings and add notes where needed.\n3. Download the mission QA/QC ZIP and archive it alongside original media.\n4. Open \`qgis_layers/*.geojson\` in QGIS.\n`;
}

export function makeTables(survey, recordsByTable) {
  const mission = survey.mission || {}; const site = survey.site || {};
  const resolvedSite = { ...site, site_id: site.site_id || makeIds(mission, site, 'site', site).site_id };
  return { root: [{ ...mission, ...resolvedSite }], equipment: [...(recordsByTable.equipment || [])], stations: [...(recordsByTable.stations || [])], tracks: [...(recordsByTable.tracks || [])], transects: [...(recordsByTable.transects || [])], environment: [...(recordsByTable.environment || [])], observations: [...(recordsByTable.observations || [])], media: [...(recordsByTable.media || [])] };
}

export function runFullQaqc(survey, recordsByTable, rawOptions = {}) {
  const options = { require_environment_per_station: rawOptions.require_environment_per_station !== false, bbox: { min_lon: rawOptions?.bbox?.min_lon || '', min_lat: rawOptions?.bbox?.min_lat || '', max_lon: rawOptions?.bbox?.max_lon || '', max_lat: rawOptions?.bbox?.max_lat || '' } };
  const tables = makeTables(survey, recordsByTable); const findings = []; const bbox = parseBbox(options);
  const bboxValues = Object.values(options.bbox || {});
  if (bboxValues.some((value) => !blank(value)) && !bbox) add(findings, 'WARNING', 'study_area_bbox', 'root', tables.root[0] || {}, 'bbox', 'Study-area bounding box is incomplete or invalid; study-area checks were not applied.');
  checkRequired(tables, findings); checkIds(tables, findings);
  [['root','platform','platform'],['root','data_status','data_status'],['tracks','track_type','track_type'],['tracks','track_status','track_status'],['transects','platform','platform'],['transects','mark_transect_complete','yes_no'],['environment','environment_link_context','link_context'],['observations','observation_link_context','link_context'],['observations','taxon_name_basis','taxon_name_basis'],['observations','taxon_source','taxon_source'],['observations','taxonomic_level','taxonomic_level'],['observations','observation_category','observation_category'],['observations','review_status','qa_status'],['media','media_link_context','link_context_media'],['media','media_capture_mode','media_capture_mode']].forEach(([table, field, allowed]) => checkChoice(tables, findings, table, field, ALLOWED[allowed]));
  checkTimestamps(tables, findings); checkCoordinates(tables, findings, bbox); checkTracks(tables, findings, bbox); checkNumeric(tables, findings); checkLinks(tables, findings); checkContext(tables, findings); checkObservationNames(tables, findings); checkMediaFiles(tables, findings); checkCoverage(tables, findings, options.require_environment_per_station); checkMissionDate(tables, findings);
  (tables.root || []).forEach((row) => { if (['complete','reviewed'].includes(lower(row.data_status)) && lower(row.qaqc_checked) !== 'yes') add(findings, 'WARNING', 'final_qaqc', 'root', row, 'qaqc_checked', "Mission is marked complete/reviewed but final Field QA/QC Check is not 'yes'."); });
  findings.sort((a,b) => `${a.severity}|${a.table}|${a.record_id}|${a.field}`.localeCompare(`${b.severity}|${b.table}|${b.record_id}|${b.field}`));
  const summary = statusFrom(findings); const qgis_layers = buildQgisLayers(tables); const created_at = new Date().toISOString();
  return { id: crypto.randomUUID(), tool: 'EcoSurvey In-App QA/QC', tool_version: QAQC_VERSION, app_version: APP_VERSION, created_at, mission_id: survey.mission?.mission_id || '', site_id: tables.root?.[0]?.site_id || '', options, data_fingerprint: dataFingerprint(survey, recordsByTable), record_counts: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])), summary, findings, tables, qgis_layers, report_markdown: reportMarkdown(tables, findings, summary, qgis_layers, options, created_at) };
}
