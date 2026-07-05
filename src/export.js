import { APP_VERSION, makeIds } from './schema.js';
import { makeTables } from './qaqc.js';
import { createZip } from './zip.js';

const csvEscape = (value) => {
  const source = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(source) ? `"${source.replaceAll('"', '""')}"` : source;
};
const omitPrivate = (row) => { const clean = Object.fromEntries(Object.entries(row || {}).filter(([key]) => !key.startsWith('_') && key !== 'attachment_id')); if (Array.isArray(clean.track_points)) { clean.track_points_json = JSON.stringify(clean.track_points); delete clean.track_points; } return clean; };
function collectHeaders(rows, preferred = []) {
  const keys = new Set(preferred);
  rows.forEach((row) => Object.keys(omitPrivate(row)).forEach((key) => keys.add(key)));
  return [...preferred.filter((key) => keys.has(key)), ...[...keys].filter((key) => !preferred.includes(key)).sort()];
}
export function toCsv(rows, preferred = []) {
  const headers = collectHeaders(rows, preferred);
  const lines = [headers.map(csvEscape).join(',')];
  rows.forEach((row) => { const clean = omitPrivate(row); lines.push(headers.map((header) => csvEscape(clean[header])).join(',')); });
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function downloadText(content, filename, type = 'text/plain;charset=utf-8') { downloadBlob(new Blob([content], { type }), filename); }

export const PREFERRED = {
  root: ['mission_id', 'project_id', 'mission_name', 'mission_date', 'mission_lead', 'team_members', 'objective', 'platform', 'planned_start_local', 'actual_start_utc', 'weather_summary', 'permit_reference', 'data_status', 'qaqc_checked', 'qaqc_notes', 'notes', 'site_sequence', 'site_id', 'site_name', 'region_state', 'country', 'waterbody', 'site_location', 'latitude_dd', 'longitude_dd', 'gps_accuracy_m', 'location_description', 'access_notes', 'dominant_habitat', 'management_or_permit_zone', 'sensitive_site_flag'],
  equipment: ['equipment_sequence', 'equipment_log_id', 'mission_id', 'site_id', 'equipment_id', 'equipment_category', 'make_model', 'serial_number', 'calibration_status', 'last_calibration_date', 'calibration_due_date', 'battery_or_power_id', 'pre_mission_check', 'post_mission_check', 'operational_status', 'issue_description', 'custodian', 'notes', 'record_status'],
  stations: ['station_sequence', 'station_id', 'mission_id', 'site_id', 'station_type', 'collection_datetime_utc', 'station_location', 'latitude_dd', 'longitude_dd', 'gps_accuracy_m', 'depth_m', 'tide_stage', 'primary_habitat', 'primary_substrate', 'visibility_m', 'sampling_design', 'observer', 'notes', 'record_status'],
  tracks: ['track_sequence', 'track_id', 'mission_id', 'site_id', 'track_type', 'track_status', 'start_datetime_utc', 'end_datetime_utc', 'point_count', 'distance_m', 'duration_seconds', 'average_accuracy_m', 'linked_station_sequence', 'linked_station_id', 'operator', 'notes', 'track_points_json', 'record_status'],
  transects: ['transect_sequence', 'parent_station_sequence', 'station_id', 'transect_id', 'mission_id', 'site_id', 'transect_type', 'start_datetime_utc', 'end_datetime_utc', 'mark_transect_complete', 'start_location', 'start_latitude_dd', 'start_longitude_dd', 'end_location', 'end_latitude_dd', 'end_longitude_dd', 'bearing_deg', 'length_m', 'width_m', 'start_depth_m', 'end_depth_m', 'platform', 'observer', 'media_id_primary', 'notes', 'record_status'],
  environment: ['environment_sequence', 'env_record_id', 'mission_id', 'site_id', 'environment_link_context', 'environment_station_sequence', 'station_id', 'environment_transect_sequence', 'transect_id', 'datetime_utc', 'instrument_id', 'calibration_record_id', 'temperature_c', 'salinity_psu', 'conductivity_us_cm', 'dissolved_oxygen_mg_l', 'ph', 'turbidity_ntu', 'depth_m', 'secchi_depth_m', 'current_velocity_m_s', 'current_direction_deg', 'air_temperature_c', 'wind_speed_m_s', 'weather_condition', 'cloud_cover_pct', 'tide_stage', 'water_visibility_m', 'notes', 'record_status'],
  observations: ['observation_sequence', 'observation_id', 'mission_id', 'site_id', 'observation_link_context', 'observation_station_sequence', 'station_id', 'observation_transect_sequence', 'transect_id', 'observation_datetime_utc', 'observation_location', 'latitude_dd', 'longitude_dd', 'taxon_name_basis', 'taxon_scientific_name', 'common_name', 'taxonomic_level', 'observation_category', 'count', 'abundance_code', 'percent_cover', 'size_class_cm', 'life_stage', 'behavior', 'habitat_context', 'observation_method', 'identification_confidence', 'media_id', 'observer', 'review_status', 'notes', 'record_status'],
  media: ['media_sequence', 'media_id', 'mission_id', 'site_id', 'media_link_context', 'media_station_sequence', 'station_id', 'media_transect_sequence', 'transect_id', 'media_observation_sequence', 'observation_id', 'media_type', 'media_capture_mode', 'capture_source', 'attachment_filename', 'attachment_mime_type', 'attachment_size_bytes', 'media_photo', 'media_video', 'media_audio', 'file_name_manual', 'file_name', 'file_extension', 'capture_datetime_utc', 'media_location', 'latitude_dd', 'longitude_dd', 'gps_accuracy_m', 'camera_or_sensor_id', 'operator', 'storage_path', 'sha256_checksum', 'quality_rating', 'annotation_status', 'description', 'record_status']
};
const findingsColumns = ['severity', 'rule', 'table', 'source_file', 'row_number', 'record_id', 'field', 'message', 'value'];
function missionSlug(survey) { return (survey.mission?.mission_id || survey.id || 'ecosurvey_mission').replace(/[^A-Za-z0-9_-]/g, '_'); }

export function exportRawCsvPackage(survey, recordsByTable) {
  const tables = makeTables(survey, recordsByTable);
  Object.entries(tables).forEach(([table, rows]) => downloadText(toCsv(rows, PREFERRED[table] || []), `${table}.csv`, 'text/csv;charset=utf-8'));
  downloadText(JSON.stringify({ app: 'EcoSurvey Field App', app_version: APP_VERSION, exported_at: new Date().toISOString(), mission_id: survey.mission?.mission_id || '', record_counts: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])) }, null, 2), 'manifest.json', 'application/json');
}

export function exportBackup(survey, recordsByTable, qaqcRun = null) {
  const payload = { app: 'EcoSurvey Field App', app_version: APP_VERSION, exported_at: new Date().toISOString(), survey, records: recordsByTable, latest_qaqc_run: qaqcRun || null };
  downloadText(JSON.stringify(payload, null, 2), `EcoSurvey_backup_${missionSlug(survey)}.json`, 'application/json');
}

export function exportQaqcReport(qaqcRun) { downloadText(qaqcRun.report_markdown || '', `qaqc_report_${qaqcRun.mission_id || 'mission'}.md`, 'text/markdown;charset=utf-8'); }
export function exportQaqcFindings(qaqcRun) { downloadText(toCsv(qaqcRun.findings || [], findingsColumns), `qaqc_findings_${qaqcRun.mission_id || 'mission'}.csv`, 'text/csv;charset=utf-8'); }

export function exportMissionQaqcZip(survey, recordsByTable, qaqcRun, attachments = []) {
  if (!qaqcRun) throw new Error('Run full QA/QC before exporting the mission QA/QC ZIP.');
  const tables = qaqcRun.tables || makeTables(survey, recordsByTable);
  const reviewedRows = (qaqcRun.findings || []).filter((finding) => ['ERROR', 'WARNING'].includes(finding.severity));
  const attachmentManifest = (attachments || []).map((attachment) => ({ attachment_id: attachment.id || '', media_id: attachment.mediaId || '', filename: attachment.filename || '', mime_type: attachment.type || '', byte_size: Number(attachment.byte_size ?? attachment.blob?.size ?? 0) || 0, capture_source: attachment.capture_source || '', stored_on_device: attachment.blob ? 'yes' : 'no', stored_at: attachment.createdAt || '' }));
  const manifest = {
    app: 'EcoSurvey Field App', app_version: APP_VERSION, exported_at: new Date().toISOString(),
    mission_id: survey.mission?.mission_id || '', site_id: tables.root?.[0]?.site_id || '',
    qa_qc: { tool: qaqcRun.tool, tool_version: qaqcRun.tool_version, run_id: qaqcRun.id, created_at: qaqcRun.created_at, summary: qaqcRun.summary, options: qaqcRun.options, data_fingerprint: qaqcRun.data_fingerprint },
    record_counts: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])),
    attachment_summary: { locally_stored_attachment_count: attachmentManifest.length, embedded_in_zip: false, instructions: 'Original attachment files are stored separately on the device. Download them from the app and archive them beside this ZIP before clearing device storage.' }
  };
  const entries = [];
  Object.entries(tables).forEach(([table, rows]) => entries.push({ name: `validated_csv/${table}.csv`, content: toCsv(rows, PREFERRED[table] || []) }));
  entries.push({ name: 'qaqc_findings.csv', content: toCsv(qaqcRun.findings || [], findingsColumns) });
  entries.push({ name: 'review_required.csv', content: toCsv(reviewedRows, findingsColumns) });
  entries.push({ name: 'qaqc_report.md', content: qaqcRun.report_markdown || '' });
  entries.push({ name: 'attachment_manifest.csv', content: toCsv(attachmentManifest, ['attachment_id', 'media_id', 'filename', 'mime_type', 'byte_size', 'capture_source', 'stored_on_device', 'stored_at']) });
  entries.push({ name: 'manifest.json', content: JSON.stringify(manifest, null, 2) });
  entries.push({ name: 'qaqc_run.json', content: JSON.stringify(qaqcRun, null, 2) });
  entries.push({ name: `backups/EcoSurvey_backup_${missionSlug(survey)}.json`, content: JSON.stringify({ app: 'EcoSurvey Field App', app_version: APP_VERSION, survey, records: recordsByTable, latest_qaqc_run: qaqcRun }, null, 2) });
  Object.entries(qaqcRun.qgis_layers || {}).forEach(([filename, layer]) => entries.push({ name: `qgis_layers/${filename}`, content: JSON.stringify(layer, null, 2) }));
  entries.push({ name: 'README.txt', content: 'EcoSurvey Field App QA/QC export\n\nOpen qaqc_report.md first. Correct ERROR findings before treating this mission as QA/QC-cleared. Load qgis_layers/*.geojson in QGIS. attachment_manifest.csv lists device-stored original files, but the original media attachments are not embedded in this ZIP. Download and archive them separately before clearing the device.\n' });
  downloadBlob(createZip(entries), `${missionSlug(survey)}_QAQC.zip`);
}

export function demoSurvey() {
  const date = new Date(); const ymd = date.toISOString().slice(0, 10).replaceAll('-', '');
  const mission = { mission_id: `ES-${ymd}-01`, project_id: 'ES-2026', mission_name: 'EcoSurvey app demonstration mission', mission_date: date.toISOString().slice(0,10), mission_lead: 'Demo Field Lead', team_members: 'Demo Observer', objective: 'Validate the EcoSurvey app export pipeline before a field pilot.', platform: 'shore', planned_start_local: '', actual_start_utc: date.toISOString(), weather_summary: 'Clear and calm', permit_reference: 'TRAINING-DEMO', data_status: 'complete', qaqc_checked: 'yes', qaqc_notes: 'Demo review completed.', notes: 'Synthetic test mission; do not treat as a field record.' };
  const site = { site_sequence: 1, site_name: 'Demo Shoreline Site', region_state: 'Delaware', country: 'United States', waterbody: 'Delaware Bay', latitude_dd: '38.7800', longitude_dd: '-75.0900', gps_accuracy_m: '8', location_description: 'Synthetic test point', access_notes: 'Dry-run only', dominant_habitat: 'sand', management_or_permit_zone: '', sensitive_site_flag: 'no', notes: 'Demo site' };
  site.site_id = makeIds(mission, site, 'site', site).site_id; site.site_location = `${site.latitude_dd} ${site.longitude_dd} ${site.gps_accuracy_m}`;
  const now = date.toISOString();
  const station = { station_sequence: 1, station_type: 'fixed', collection_datetime_utc: now, latitude_dd: '38.7802', longitude_dd: '-75.0898', gps_accuracy_m: '6', depth_m: '1.2', tide_stage: 'mid', primary_habitat: 'sand', primary_substrate: 'fine_sand', visibility_m: '2.1', sampling_design: '25 m belt transect; 2 m width', observer: 'Demo Observer', notes: 'Demo station' };
  Object.assign(station, makeIds(mission, site, 'stations', station)); station.station_location = `${station.latitude_dd} ${station.longitude_dd} ${station.gps_accuracy_m}`; station.record_status = 'Complete';
  const transect = { transect_sequence: 1, parent_station_sequence: 1, transect_type: 'transect', start_datetime_utc: now, end_datetime_utc: now, mark_transect_complete: 'yes', start_latitude_dd: '38.7802', start_longitude_dd: '-75.0898', end_latitude_dd: '38.7803', end_longitude_dd: '-75.0895', bearing_deg: '72', length_m: '25', width_m: '2', start_depth_m: '1.2', end_depth_m: '1.3', platform: 'shore', observer: 'Demo Observer', media_id_primary: '', notes: 'Demo transect' };
  Object.assign(transect, makeIds(mission, site, 'transects', transect)); transect.start_location = `${transect.start_latitude_dd} ${transect.start_longitude_dd}`; transect.end_location = `${transect.end_latitude_dd} ${transect.end_longitude_dd}`; transect.record_status = 'Complete';
  const environment = { environment_sequence: 1, environment_link_context: 'station', environment_station_sequence: 1, datetime_utc: now, instrument_id: 'DEMO-CTD', calibration_record_id: 'DEMO-CAL-01', temperature_c: '22.4', salinity_psu: '28.2', conductivity_us_cm: '43000', dissolved_oxygen_mg_l: '7.9', ph: '8.1', turbidity_ntu: '4.2', depth_m: '1.2', secchi_depth_m: '', current_velocity_m_s: '0.15', current_direction_deg: '65', air_temperature_c: '24.0', wind_speed_m_s: '2.5', weather_condition: 'clear', cloud_cover_pct: '5', tide_stage: 'mid', water_visibility_m: '2.1', notes: 'Demo environmental record' };
  Object.assign(environment, makeIds(mission, site, 'environment', environment)); environment.record_status = 'Complete';
  const observation = { observation_sequence: 1, observation_link_context: 'transect', observation_station_sequence: 1, observation_transect_sequence: 1, observation_datetime_utc: now, taxon_name_basis: 'common', taxon_scientific_name: '', common_name: 'Atlantic silverside', taxonomic_level: 'species', observation_category: 'organism', count: '7', abundance_code: '', percent_cover: '', size_class_cm: '4–6', life_stage: 'juvenile', behavior: 'schooling', habitat_context: 'sand', observation_method: 'visual', identification_confidence: 'medium', media_id: '', observer: 'Demo Observer', review_status: 'unreviewed', notes: 'Demo observation' };
  Object.assign(observation, makeIds(mission, site, 'observations', observation)); observation.record_status = 'Complete';
  const media = { media_sequence: 1, media_link_context: 'transect', media_station_sequence: 1, media_transect_sequence: 1, media_type: 'video', media_capture_mode: 'external_reference', file_name_manual: 'DEMO_ES_video_001.mp4', file_name: 'DEMO_ES_video_001.mp4', file_extension: 'mp4', capture_datetime_utc: now, camera_or_sensor_id: 'DEMO-CAM-01', operator: 'Demo Observer', storage_path: 'Media/DEMO/', sha256_checksum: '', quality_rating: 'usable', annotation_status: 'not_started', description: 'Demo external video' };
  Object.assign(media, makeIds(mission, site, 'media', media)); media.record_status = 'Complete';
  transect.media_id_primary = media.media_id; observation.media_id = media.media_id;
  const equipment = { equipment_sequence: 1, equipment_id: 'DEMO-CAM-01', equipment_category: 'camera', make_model: 'Demo Action Camera', serial_number: 'DEMO-001', calibration_status: 'not_required', last_calibration_date: '', calibration_due_date: '', battery_or_power_id: 'DEMO-BAT-01', pre_mission_check: 'yes', post_mission_check: 'yes', operational_status: 'operational', issue_description: '', custodian: 'Demo Field Lead', notes: 'Demo equipment' };
  Object.assign(equipment, makeIds(mission, site, 'equipment', equipment)); equipment.record_status = 'Complete';
  const track = { track_sequence: 1, track_type: 'walking', linked_station_sequence: 1, track_status: 'complete', start_datetime_utc: now, end_datetime_utc: now, point_count: 3, distance_m: '41.7', duration_seconds: '60', average_accuracy_m: '6.5', operator: 'Demo Observer', notes: 'Synthetic route for app testing.', track_points: [{ lat: 38.78000, lon: -75.09000, accuracy: 7, timestamp: now }, { lat: 38.78010, lon: -75.08990, accuracy: 6, timestamp: now }, { lat: 38.78025, lon: -75.08965, accuracy: 6.5, timestamp: now }] };
  Object.assign(track, makeIds(mission, site, 'tracks', track)); track.record_status = 'Complete';
  return { mission, site, records: { equipment: [equipment], stations: [station], tracks: [track], transects: [transect], environment: [environment], observations: [observation], media: [media] } };
}

export function exportCombinedGeoJson(survey, recordsByTable) {
  const layers = buildQgisLayers(makeTables(survey, recordsByTable));
  const features = Object.entries(layers).flatMap(([filename, collection]) => (collection.features || []).map((feature) => ({
    ...feature,
    properties: { ...feature.properties, ecosurvey_layer: filename.replace(/\.geojson$/i, '') }
  })));
  const collection = { type: 'FeatureCollection', name: `EcoSurvey_${missionSlug(survey)}_combined`, features };
  downloadText(JSON.stringify(collection, null, 2), `EcoSurvey_${missionSlug(survey)}_combined.geojson`, 'application/geo+json;charset=utf-8');
}

export function exportGeoJsonLayer(survey, recordsByTable, filename) {
  const layers = buildQgisLayers(makeTables(survey, recordsByTable));
  const collection = layers[filename];
  if (!collection) throw new Error(`Unknown GeoJSON layer: ${filename}`);
  downloadText(JSON.stringify(collection, null, 2), `EcoSurvey_${missionSlug(survey)}_${filename}`, 'application/geo+json;charset=utf-8');
}

export function exportGeoJsonQgisZip(survey, recordsByTable) {
  const layers = buildQgisLayers(makeTables(survey, recordsByTable));
  const missionId = survey.mission?.mission_id || 'mission';
  const manifest = {
    app: 'EcoSurvey Field App', app_version: APP_VERSION, exported_at: new Date().toISOString(), mission_id: missionId,
    coordinate_reference_system: 'EPSG:4326 (WGS 84)',
    layers: Object.fromEntries(Object.entries(layers).map(([name, collection]) => [name, collection.features?.length || 0]))
  };
  const entries = Object.entries(layers).map(([name, collection]) => ({ name: `geojson/${name}`, content: JSON.stringify(collection, null, 2) }));
  entries.push({ name: 'manifest.json', content: JSON.stringify(manifest, null, 2) });
  entries.push({ name: 'QGIS_IMPORT_NOTES.txt', content: `EcoSurvey GeoJSON / QGIS export\n\nMission: ${missionId}\nCRS: EPSG:4326 — WGS 84 latitude/longitude\n\nIn QGIS: Layer > Add Layer > Add Vector Layer, then select one or more files in geojson/.\n\nLayer meaning:\n- sites.geojson: mission-site point\n- stations.geojson: station GPS points\n- transects.geojson: start/end transect lines\n- transect_start_points.geojson: transect start points\n- observations.geojson, environment.geojson, media.geojson: linked points\n\nThe coordinate_source field identifies whether a point uses independent GPS, linked station GPS, transect-start GPS, or site GPS. This is an operational map export; run Full QA/QC before using it as the archived mission record.\n` });
  const blob = createZip(entries);
  downloadBlob(blob, `EcoSurvey_${missionSlug(survey)}_GeoJSON_QGIS.zip`);
}
