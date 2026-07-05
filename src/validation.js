import { SCHEMAS, makeIds } from './schema.js';

const blank = (value) => value === undefined || value === null || String(value).trim() === '';
const numeric = (value) => !blank(value) && Number.isFinite(Number(value));

export function validateForm(table, data, mission, site, recordsByTable = {}) {
  const errors = [];
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
    if (['scientific', 'both'].includes(data.taxon_name_basis) && blank(data.taxon_scientific_name)) errors.push('Scientific name is required for the selected name basis.');
    if (['common', 'both'].includes(data.taxon_name_basis) && blank(data.common_name)) errors.push('Common name is required for the selected name basis.');
  }
  if (table === 'environment' && ['station', 'transect'].includes(data.environment_link_context) && blank(data.environment_station_sequence)) errors.push('A station number is required for station or transect-linked environmental data.');
  if (table === 'environment' && data.environment_link_context === 'transect' && blank(data.environment_transect_sequence)) errors.push('A transect number is required for transect-linked environmental data.');
  if (table === 'observations' && ['station', 'transect'].includes(data.observation_link_context) && blank(data.observation_station_sequence)) errors.push('A station number is required for station or transect-linked observations.');
  if (table === 'observations' && data.observation_link_context === 'transect' && blank(data.observation_transect_sequence)) errors.push('A transect number is required for transect-linked observations.');
  if (table === 'media' && ['station', 'transect'].includes(data.media_link_context) && blank(data.media_station_sequence)) errors.push('A station number is required for station or transect-linked media.');
  if (table === 'media' && data.media_link_context === 'transect' && blank(data.media_transect_sequence)) errors.push('A transect number is required for transect-linked media.');
  if (table === 'media' && data.media_link_context === 'observation' && blank(data.media_observation_sequence)) errors.push('An observation number is required for observation-linked media.');
  if (table === 'media' && blank(data.file_name_manual) && blank(data.file_name)) errors.push('A media filename is required; attach a file or enter an external filename.');
  if (table === 'tracks' && data.track_status !== 'recording' && (!Array.isArray(data.track_points) || data.track_points.length < 2)) errors.push('A completed GPS track needs at least two recorded points. Start tracks from the live GPS control.');
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
  const duplicateCheck = (table, idField) => {
    const seen = new Set();
    for (const row of recordsByTable[table] || []) {
      const id = row[idField]; if (!id) continue;
      if (seen.has(id)) findings.push({ severity: 'error', table, recordId: id, message: `Duplicate ${idField}.` }); else seen.add(id);
    }
  };
  duplicateCheck('equipment', 'equipment_log_id'); duplicateCheck('stations', 'station_id'); duplicateCheck('tracks', 'track_id'); duplicateCheck('transects', 'transect_id'); duplicateCheck('environment', 'env_record_id'); duplicateCheck('observations', 'observation_id'); duplicateCheck('media', 'media_id');

  for (const row of recordsByTable.transects || []) if (row.station_id && !stationIds.has(row.station_id)) findings.push({ severity: 'error', table: 'transects', recordId: row.transect_id, message: 'Linked station does not exist.' });
  for (const row of recordsByTable.tracks || []) if (row.linked_station_id && !stationIds.has(row.linked_station_id)) findings.push({ severity: 'error', table: 'tracks', recordId: row.track_id, message: 'Linked station does not exist.' });
  for (const table of ['environment', 'observations', 'media']) for (const row of recordsByTable[table] || []) {
    if (row.station_id && !stationIds.has(row.station_id)) findings.push({ severity: 'error', table, recordId: row[SCHEMAS[table].idField], message: 'Linked station does not exist.' });
    if (row.transect_id && !transectIds.has(row.transect_id)) findings.push({ severity: 'error', table, recordId: row[SCHEMAS[table].idField], message: 'Linked transect does not exist.' });
  }
  for (const row of recordsByTable.media || []) if (row.observation_id && !observationIds.has(row.observation_id)) findings.push({ severity: 'error', table: 'media', recordId: row.media_id, message: 'Linked observation does not exist.' });
  for (const row of recordsByTable.observations || []) if (row.media_id && !mediaIds.has(row.media_id)) findings.push({ severity: 'error', table: 'observations', recordId: row.observation_id, message: 'Linked media does not exist.' });
  for (const row of recordsByTable.transects || []) if (row.media_id_primary && !mediaIds.has(row.media_id_primary)) findings.push({ severity: 'error', table: 'transects', recordId: row.transect_id, message: 'Primary media ID does not exist.' });
  const coveredStations = new Set((recordsByTable.environment || []).map((row) => row.station_id).filter(Boolean));
  for (const row of recordsByTable.stations || []) if (row.station_id && !coveredStations.has(row.station_id)) findings.push({ severity: 'warning', table: 'stations', recordId: row.station_id, message: 'No environmental record is linked to this station.' });
  return findings;
}

export function withCalculatedFields(table, raw, mission, site) {
  const data = { ...raw };
  const ids = makeIds(mission, site, table, data);
  Object.assign(data, ids);
  for (const field of SCHEMAS[table].fields.filter((item) => item.type === 'location')) {
    if (!blank(data[field.lat]) && !blank(data[field.lon])) data[field.name] = `${data[field.lat]} ${data[field.lon]} ${data[field.accuracy] || ''}`.trim();
  }
  if (table === 'media') {
    data.file_name = data.file_name || data.file_name_manual || '';
    if (!data.file_extension && data.file_name) data.file_extension = String(data.file_name).split('.').pop().toLowerCase();
  }
  data.record_status = 'Complete';
  return data;
}
