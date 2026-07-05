/**
 * EcoSurvey v0.12 protocol templates.
 *
 * Templates guide field collection and add protocol-specific QA/QC without
 * changing or deleting the underlying, reusable EcoSurvey record model.
 */
export const PROTOCOL_VERSION = '1.0.0';

const protocol = (id, name, description, config = {}) => ({
  id, name, version: PROTOCOL_VERSION, description,
  requiredTables: [], recommendedTables: [], optionalTables: [],
  requireEnvironmentPerStation: false,
  recommendedPlatforms: [],
  checklist: [],
  fieldFocus: {},
  fieldDefaults: {},
  ...config
});

export const PROTOCOLS = [
  protocol('benthic_transect', 'Benthic transect survey', 'Document habitat and biological observations along measured transects.', {
    requiredTables: ['stations', 'transects', 'environment', 'observations'],
    recommendedTables: ['equipment', 'tracks', 'media'], optionalTables: ['samples', 'custody'],
    requireEnvironmentPerStation: true,
    checklist: [
      ['equipment', 'Confirm essential survey equipment and calibration status.'],
      ['stations', 'Capture at least one station and its GPS point.'],
      ['transects', 'Create at least one completed transect linked to a station.'],
      ['environment', 'Record environmental conditions for every station.'],
      ['observations', 'Enter habitat/organism observations along transects.'],
      ['media', 'Attach or reference representative imagery when available.']
    ],
    fieldFocus: {
      stations: ['station_sequence','station_type','collection_datetime_utc','station_location','depth_m','primary_habitat','primary_substrate','sampling_design','observer'],
      transects: ['transect_sequence','parent_station_sequence','transect_type','start_datetime_utc','mark_transect_complete','start_location','end_location','bearing_deg','length_m','width_m','platform','observer'],
      environment: ['environment_sequence','environment_link_context','environment_station_sequence','datetime_utc','temperature_c','salinity_psu','depth_m','water_visibility_m','weather_condition','recorder'],
      observations: ['observation_sequence','observation_link_context','observation_station_sequence','observation_transect_sequence','observation_datetime_utc','taxon_name_basis','taxon_scientific_name','common_name','observation_category','count','percent_cover','habitat_context','observation_method','identification_confidence','observer']
    },
    fieldDefaults: { transects: { transect_type: 'transect' }, observations: { observation_category: 'organism', observation_method: 'visual' } }
  }),
  protocol('water_quality_visit', 'Water-quality monitoring visit', 'Capture repeatable station-based environmental measurements and supporting site context.', {
    requiredTables: ['stations', 'environment'], recommendedTables: ['equipment', 'media'], optionalTables: ['tracks', 'transects', 'observations', 'samples', 'custody'],
    requireEnvironmentPerStation: true,
    checklist: [
      ['equipment', 'Confirm probe/sensor calibration and pre-mission checks.'],
      ['stations', 'Capture each monitoring station and GPS point.'],
      ['environment', 'Save one or more environmental records for every station.'],
      ['media', 'Capture a station-condition photo when useful.']
    ],
    fieldFocus: {
      equipment: ['equipment_sequence','equipment_id','equipment_category','make_model','calibration_status','last_calibration_date','calibration_due_date','pre_mission_check','operational_status','custodian'],
      stations: ['station_sequence','station_type','collection_datetime_utc','station_location','depth_m','primary_habitat','primary_substrate','sampling_design','observer'],
      environment: ['environment_sequence','environment_link_context','environment_station_sequence','datetime_utc','temperature_c','salinity_psu','conductivity_us_cm','dissolved_oxygen_mg_l','ph','turbidity_ntu','depth_m','water_visibility_m','weather_condition','recorder'],
      media: ['media_sequence','media_link_context','media_station_sequence','media_type','media_capture_mode','media_file','file_name_manual','capture_datetime_utc','media_location','camera_or_sensor_id','operator','storage_path','description']
    },
    fieldDefaults: { equipment: { equipment_category: 'sensor' }, environment: { environment_link_context: 'station' } }
  }),
  protocol('rov_reconnaissance', 'ROV habitat reconnaissance', 'Document an ROV field mission with a vehicle deployment record, synchronized imagery/video events, navigation, and linked observations.', {
    requiredTables: ['equipment', 'stations', 'rov_operations', 'media'], recommendedTables: ['video_logs', 'sensor_streams', 'tracks', 'transects', 'environment', 'observations'], optionalTables: ['sensor_readings', 'samples', 'custody'],
    requireEnvironmentPerStation: false,
    recommendedPlatforms: ['rov'],
    checklist: [
      ['equipment', 'Log the ROV and camera/sensor readiness checks.'],
      ['stations', 'Record launch, target, or survey stations.'],
      ['tracks', 'Record a topside or vehicle navigation track when available.'],
      ['transects', 'Build a video transect when coverage is structured.'],
      ['media', 'Link ROV video or imagery using a traceable filename.'],
      ['video_logs', 'Add synchronized elapsed-video events for targets, habitat changes, and sightings.'],
      ['sensor_streams', 'Import CTD, depth, water-quality, navigation, sonar, or other sensor logs and document clock synchronization when used.'],
      ['observations', 'Log targets, habitat changes, and taxa with video evidence.']
    ],
    fieldFocus: {
      equipment: ['equipment_sequence','equipment_id','equipment_category','make_model','serial_number','battery_or_power_id','pre_mission_check','post_mission_check','operational_status','issue_description','custodian'],
      rov_operations: ['operation_sequence','rov_equipment_log_id','vehicle_id','operation_name','pilot','tether_tender','launch_datetime_utc','recovery_datetime_utc','operation_status','launch_location','recovery_location','max_depth_m','tether_length_m','navigation_track_sequence','video_media_sequence','camera_or_sensor_id','incident_summary'],
      video_logs: ['video_log_sequence','rov_operation_sequence','video_log_datetime_utc','video_elapsed_seconds','event_type','video_log_link_context','video_log_station_sequence','video_log_transect_sequence','candidate_taxon','confidence','logger','event_description'],
      sensor_streams: ['sensor_stream_sequence','stream_name','stream_type','instrument_id','equipment_log_id','rov_operation_sequence','source_filename','downsample_every','sensor_time_at_launch','timezone_note'],
      tracks: ['track_sequence','track_type','linked_station_sequence','operator','notes'],
      transects: ['transect_sequence','parent_station_sequence','transect_type','start_datetime_utc','mark_transect_complete','start_location','end_location','bearing_deg','length_m','width_m','platform','observer','media_id_primary'],
      observations: ['observation_sequence','observation_link_context','observation_station_sequence','observation_transect_sequence','observation_datetime_utc','taxon_name_basis','taxon_scientific_name','common_name','observation_category','observation_method','identification_confidence','media_id','observer','notes'],
      media: ['media_sequence','media_link_context','media_station_sequence','media_transect_sequence','media_type','media_capture_mode','media_file','file_name_manual','capture_datetime_utc','media_location','camera_or_sensor_id','operator','storage_path','quality_rating','annotation_status','description']
    },
    fieldDefaults: { equipment: { equipment_category: 'rov' }, rov_operations: { operation_status: 'planned' }, video_logs: { event_type: 'video_marker', video_log_link_context: 'site' }, tracks: { track_type: 'rov_navigation' }, transects: { transect_type: 'video_transect', platform: 'rov' }, observations: { observation_method: 'rov_video' }, media: { media_type: 'video', media_capture_mode: 'external_reference' } }
  }),
  protocol('edna_collection', 'eDNA water-sample collection', 'Collect eDNA water samples with labels, storage metadata, and an auditable chain of custody.', {
    requiredTables: ['stations', 'environment', 'samples', 'custody'], recommendedTables: ['equipment', 'media'], optionalTables: ['tracks', 'transects', 'observations'],
    requireEnvironmentPerStation: true,
    checklist: [
      ['equipment', 'Log filtration/sampling equipment and calibration checks.'],
      ['stations', 'Capture collection stations and GPS points.'],
      ['environment', 'Record environmental context at every sampled station.'],
      ['samples', 'Create each eDNA sample, apply/verify its label, and record storage.'],
      ['custody', 'Record at least one custody event for every eDNA sample.'],
      ['media', 'Capture a station or label verification image when permitted.']
    ],
    fieldFocus: {
      stations: ['station_sequence','station_type','collection_datetime_utc','station_location','depth_m','primary_habitat','primary_substrate','sampling_design','observer'],
      environment: ['environment_sequence','environment_link_context','environment_station_sequence','datetime_utc','temperature_c','salinity_psu','conductivity_us_cm','dissolved_oxygen_mg_l','ph','turbidity_ntu','depth_m','weather_condition','recorder'],
      samples: ['sample_sequence','sample_link_context','sample_station_sequence','collection_datetime_utc','sample_location','sample_type','sample_subtype','container_type','volume_ml','preservative','storage_condition','storage_location','sample_label','barcode_format','label_status','collector','initial_custodian','sample_status','analysis_requested'],
      custody: ['custody_sequence','sample_sequence','custody_datetime_utc','custody_event','from_custodian','to_custodian','handoff_location','storage_condition','seal_status','receiving_signature_name','notes']
    },
    fieldDefaults: { equipment: { equipment_category: 'sample_gear' }, samples: { sample_type: 'edna_water', container_type: 'bottle', sample_link_context: 'station', analysis_requested: 'eDNA analysis' }, custody: { custody_event: 'collection' } }
  }),
  protocol('shoreline_debris', 'Shoreline debris survey', 'Record debris observations along measured shoreline transects with minimal unrelated biological prompts.', {
    requiredTables: ['stations', 'transects', 'observations'], recommendedTables: ['tracks', 'media'], optionalTables: ['equipment', 'environment', 'samples', 'custody'],
    requireEnvironmentPerStation: false,
    recommendedPlatforms: ['shore', 'wading'],
    checklist: [
      ['stations', 'Capture the access/start station and GPS point.'],
      ['tracks', 'Record coverage route when practical.'],
      ['transects', 'Create one or more completed shoreline transects.'],
      ['observations', 'Enter debris records linked to each surveyed transect.'],
      ['media', 'Capture representative debris or shoreline-condition photos.']
    ],
    fieldFocus: {
      stations: ['station_sequence','station_type','collection_datetime_utc','station_location','primary_habitat','primary_substrate','sampling_design','observer'],
      transects: ['transect_sequence','parent_station_sequence','transect_type','start_datetime_utc','mark_transect_complete','start_location','end_location','bearing_deg','length_m','width_m','platform','observer'],
      observations: ['observation_sequence','observation_link_context','observation_station_sequence','observation_transect_sequence','observation_datetime_utc','observation_category','common_name','count','abundance_code','size_class_cm','habitat_context','observation_method','media_id','observer','notes'],
      media: ['media_sequence','media_link_context','media_station_sequence','media_transect_sequence','media_observation_sequence','media_type','media_capture_mode','media_file','file_name_manual','capture_datetime_utc','media_location','camera_or_sensor_id','operator','storage_path','description']
    },
    fieldDefaults: { transects: { transect_type: 'transect', platform: 'shore' }, observations: { observation_category: 'debris', taxon_name_basis: 'common', observation_method: 'visual', identification_confidence: 'high' } }
  }),
  protocol('custom_general', 'General / custom field survey', 'Use the complete EcoSurvey record model without template-specific completion rules.', {
    requiredTables: [], recommendedTables: ['equipment', 'stations', 'environment', 'observations', 'media'], optionalTables: ['tracks', 'transects', 'samples', 'custody'],
    requireEnvironmentPerStation: true,
    checklist: [
      ['stations', 'Capture a station and GPS point for every location-based survey effort.'],
      ['environment', 'Record environmental conditions when they are material to the objective.'],
      ['observations', 'Record standardized observations and evidence.'],
      ['media', 'Link representative media when available.'],
      ['review', 'Run QA/QC and export the mission archive.']
    ],
    fieldFocus: {}
  })
];

export const PROTOCOL_CHOICES = PROTOCOLS.map((item) => [item.id, item.name]);
export const DEFAULT_PROTOCOL_ID = 'benthic_transect';

export function getProtocol(id = '') {
  return PROTOCOLS.find((item) => item.id === id) || PROTOCOLS.find((item) => item.id === 'custom_general');
}
export function protocolForMission(mission = {}) { return getProtocol(mission.protocol_id || 'custom_general'); }
export function protocolMissionFields(id = DEFAULT_PROTOCOL_ID) {
  const item = getProtocol(id);
  return { protocol_id: item.id, protocol_name: item.name, protocol_version: item.version, protocol_template_status: 'active' };
}
export function tableRole(item, table) {
  const protocolItem = item || getProtocol();
  if (protocolItem.requiredTables.includes(table)) return 'core';
  if (protocolItem.recommendedTables.includes(table)) return 'recommended';
  return 'optional';
}
export function tableRoleLabel(role) {
  return { core: 'Core', recommended: 'Recommended', optional: 'Optional' }[role] || 'Optional';
}
export function fieldPriority(item, table, fieldName, field = {}) {
  const focus = item?.fieldFocus?.[table] || [];
  if (field.required || field.type === 'computed' || field.type === 'location') return 'core';
  if (focus.includes(fieldName)) return 'core';
  return 'additional';
}
export function protocolDefaultFor(item, table, fieldName) {
  return item?.fieldDefaults?.[table]?.[fieldName];
}
export function protocolChecklistState(item, records = {}) {
  const count = (table) => (records[table] || []).length;
  return (item?.checklist || []).map(([table, label]) => ({ table, label, count: count(table), complete: table === 'review' ? false : count(table) > 0 }));
}

export function protocolFindings(tables = {}) {
  const root = (tables.root || [])[0] || {};
  const item = getProtocol(root.protocol_id || 'custom_general');
  const findings = [];
  const count = (table) => (tables[table] || []).length;
  const add = (severity, rule, table, field, message, row = root) => findings.push({ severity, rule, table, field, message, row });

  if (!root.protocol_id) add('WARNING', 'protocol_not_selected', 'root', 'protocol_id', 'No survey protocol is selected. Generic EcoSurvey QA/QC checks were applied, but protocol-specific completion rules were not.');
  if (root.protocol_id && root.protocol_id !== item.id) add('ERROR', 'protocol_unknown', 'root', 'protocol_id', 'Mission protocol ID is not recognized by this app version. Select a supported protocol or use General / custom.');
  if (root.protocol_id && root.protocol_version && String(root.protocol_version) !== String(item.version)) add('WARNING', 'protocol_version', 'root', 'protocol_version', `Mission records protocol version ${root.protocol_version}; this app currently applies version ${item.version}. Review template changes before finalizing.`);
  for (const table of item.requiredTables) {
    if (!count(table)) add('ERROR', 'protocol_required_record', table, '', `${item.name} requires at least one ${table.slice(0, -1) || table} record.`);
  }
  if (item.recommendedPlatforms?.length && root.platform && !item.recommendedPlatforms.includes(String(root.platform))) add('WARNING', 'protocol_platform', 'root', 'platform', `${item.name} is normally run using ${item.recommendedPlatforms.join(' or ')}. Confirm that the selected platform is intentional.`);

  if (item.id === 'rov_reconnaissance') {
    if (!(tables.equipment || []).some((row) => String(row.equipment_category || '').toLowerCase() === 'rov')) add('ERROR', 'protocol_rov_equipment', 'equipment', 'equipment_category', 'ROV reconnaissance requires at least one equipment record categorized as ROV.');
    if (!count('rov_operations')) add('ERROR', 'protocol_rov_operation', 'rov_operations', '', 'ROV reconnaissance requires at least one ROV deployment / operation record.');
    if (!count('tracks') && !count('transects')) add('ERROR', 'protocol_coverage', 'tracks', '', 'ROV reconnaissance requires a GPS/vehicle track or a structured transect to document coverage.');
    if (!(tables.media || []).some((row) => ['video', 'sonar_image'].includes(String(row.media_type || '').toLowerCase()))) add('ERROR', 'protocol_rov_media', 'media', 'media_type', 'ROV reconnaissance requires at least one video or sonar-image media record.');
    (tables.rov_operations || []).forEach((row) => { if (!String(row.video_media_id || '').trim()) add('ERROR', 'protocol_rov_operation_video', 'rov_operations', 'video_media_id', 'Every ROV operation needs a linked primary video or sonar Media record.', row); });
  }
  if (item.id === 'edna_collection') {
    const edna = (tables.samples || []).filter((row) => String(row.sample_type || '').toLowerCase() === 'edna_water');
    if (!edna.length) add('ERROR', 'protocol_edna_sample', 'samples', 'sample_type', 'eDNA collection requires at least one sample with sample type “eDNA water”.');
    const custodyBySample = new Set((tables.custody || []).map((row) => String(row.sample_id || '')).filter(Boolean));
    edna.forEach((row) => {
      if (!['applied','verified','replaced'].includes(String(row.label_status || '').toLowerCase())) add('ERROR', 'protocol_edna_label', 'samples', 'label_status', 'eDNA samples require a physically applied or verified label before final QA/QC.', row);
      if (!custodyBySample.has(String(row.sample_id || ''))) add('ERROR', 'protocol_edna_custody', 'samples', 'sample_id', 'Every eDNA sample requires at least one linked custody event.', row);
    });
  }
  if (item.id === 'shoreline_debris') {
    const debris = (tables.observations || []).filter((row) => String(row.observation_category || '').toLowerCase() === 'debris');
    if (!debris.length) add('ERROR', 'protocol_debris_observation', 'observations', 'observation_category', 'Shoreline debris survey requires at least one observation categorized as debris.');
  }
  return { protocol: item, findings };
}
