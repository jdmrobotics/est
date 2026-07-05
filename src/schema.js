import { PROTOCOL_CHOICES } from './protocols.js';

export const APP_VERSION = '0.15.0';

export const OPTIONS = {
  surveyProtocol: PROTOCOL_CHOICES,
  platform: [
    ['shore', 'Shore'], ['wading', 'Wading'], ['snorkel', 'Snorkel'], ['scuba', 'SCUBA'],
    ['kayak', 'Kayak'], ['boat', 'Boat'], ['rov', 'ROV'], ['drone', 'Drone'], ['mixed', 'Mixed']
  ],
  yesNo: [['yes', 'Yes'], ['no', 'No']],
  yesNoNa: [['yes', 'Yes'], ['no', 'No'], ['na', 'Not applicable']],
  habitat: [
    ['sand', 'Sand'], ['mud', 'Mud'], ['gravel', 'Gravel'], ['rock', 'Rock'],
    ['oyster_reef', 'Oyster reef'], ['seagrass', 'Seagrass'], ['macroalgae', 'Macroalgae'],
    ['coral_reef', 'Coral reef'], ['artificial_structure', 'Artificial structure'],
    ['open_water', 'Open water'], ['mixed', 'Mixed']
  ],
  substrate: [
    ['fine_sand', 'Fine sand'], ['coarse_sand', 'Coarse sand'], ['silt', 'Silt'], ['mud', 'Mud'],
    ['gravel', 'Gravel'], ['cobble', 'Cobble'], ['bedrock', 'Bedrock'], ['shell_hash', 'Shell hash'],
    ['concrete', 'Concrete'], ['mixed', 'Mixed']
  ],
  stationType: [['fixed', 'Fixed'], ['random', 'Random'], ['stratified_random', 'Stratified random'], ['reference', 'Reference'], ['impact', 'Impact'], ['calibration', 'Calibration'], ['photo_point', 'Photo point']],
  tideStage: [['low', 'Low'], ['ebb', 'Ebb'], ['mid', 'Mid'], ['flood', 'Flood'], ['high', 'High'], ['unknown', 'Unknown']],
  transectType: [['reconnaissance', 'Reconnaissance'], ['station', 'Station'], ['transect', 'Transect'], ['quadrat', 'Quadrat'], ['point_count', 'Point count'], ['tow', 'Tow'], ['video_transect', 'Video transect'], ['photo_quadrat', 'Photo quadrat'], ['opportunistic', 'Opportunistic']],
  context: [['site', 'Site only'], ['station', 'Station'], ['transect', 'Transect']],
  mediaContext: [['site', 'Site only'], ['station', 'Station'], ['transect', 'Transect'], ['observation', 'Observation']],
  weather: [['clear', 'Clear'], ['partly_cloudy', 'Partly cloudy'], ['overcast', 'Overcast'], ['light_rain', 'Light rain'], ['rain', 'Rain'], ['storm_risk', 'Storm risk'], ['fog', 'Fog'], ['unknown', 'Unknown']],
  dataStatus: [['in_progress', 'In progress'], ['complete', 'Complete'], ['reviewed', 'Reviewed'], ['archived', 'Archived']],
  equipmentCategory: [['navigation', 'Navigation'], ['camera', 'Camera'], ['rov', 'ROV'], ['sensor', 'Sensor'], ['sample_gear', 'Sample gear'], ['safety', 'Safety'], ['computing', 'Computing'], ['power', 'Power'], ['communications', 'Communications']],
  calibrationStatus: [['current', 'Current'], ['due_soon', 'Due soon'], ['overdue', 'Overdue'], ['not_required', 'Not required'], ['unknown', 'Unknown']],
  operationalStatus: [['operational', 'Operational'], ['limited', 'Limited'], ['out_of_service', 'Out of service'], ['repaired', 'Repaired'], ['retired', 'Retired']],
  taxonNameBasis: [['scientific', 'Scientific name'], ['common', 'Common name'], ['both', 'Scientific and common name']],
  taxonSource: [['project_list', 'Project species list'], ['regional_pack', 'Regional taxon pack'], ['manual', 'Manual field entry'], ['unknown', 'Unknown / unresolved']],
  taxonomicLevel: [['species', 'Species'], ['genus', 'Genus'], ['family', 'Family'], ['order', 'Order'], ['class', 'Class'], ['phylum', 'Phylum'], ['other', 'Other']],
  observationCategory: [['organism', 'Organism'], ['habitat', 'Habitat'], ['behavior', 'Behavior'], ['impact', 'Impact'], ['debris', 'Debris'], ['other', 'Other']],
  observationMethod: [['visual', 'Visual'], ['photo', 'Photo'], ['video', 'Video'], ['audio', 'Audio'], ['rov_video', 'ROV video'], ['sonar', 'Sonar'], ['drone', 'Drone'], ['net_trap', 'Net / trap'], ['acoustic', 'Acoustic'], ['water_sample', 'Water sample'], ['other', 'Other']],
  confidence: [['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['uncertain', 'Uncertain']],
  reviewStatus: [['unreviewed', 'Unreviewed'], ['provisional', 'Provisional'], ['verified', 'Verified'], ['rejected', 'Rejected']],
  mediaType: [['photo', 'Photo'], ['video', 'Video'], ['audio', 'Audio'], ['sonar_image', 'Sonar image'], ['drone_image', 'Drone image'], ['document', 'Document'], ['other', 'Other']],
  mediaCaptureMode: [['capture_photo', 'Capture photo'], ['capture_video', 'Capture video'], ['capture_audio', 'Capture audio'], ['external_reference', 'Reference external file']],
  qualityRating: [['excellent', 'Excellent'], ['good', 'Good'], ['usable', 'Usable'], ['poor', 'Poor'], ['unusable', 'Unusable']],
  annotationStatus: [['not_started', 'Not started'], ['in_progress', 'In progress'], ['complete', 'Complete'], ['not_required', 'Not required']],
  trackType: [['walking', 'Walking / shore'], ['vessel', 'Boat / kayak'], ['rov_topsides', 'ROV topside operator'], ['rov_navigation', 'ROV navigation'], ['dive', 'Diver / snorkeler'], ['drone', 'Drone'], ['other', 'Other']],
  trackStatus: [['recording', 'Recording'], ['complete', 'Complete'], ['stopped_with_issue', 'Stopped with issue']],
  rovOperationStatus: [['planned', 'Planned'], ['deployed', 'Deployed / active'], ['complete', 'Recovered / complete'], ['aborted', 'Aborted'], ['incident', 'Incident / recovery issue']],
  rovEventType: [['launch', 'Launch'], ['descent', 'Descent'], ['transect_start', 'Transect / pass start'], ['transect_end', 'Transect / pass end'], ['organism_sighting', 'Organism sighting'], ['habitat_change', 'Habitat change'], ['target', 'Target / feature of interest'], ['sample', 'Sample / collection event'], ['video_marker', 'Video marker'], ['sonar_marker', 'Sonar marker'], ['issue', 'Equipment / operational issue'], ['ascent', 'Ascent'], ['recovery', 'Recovery'], ['note', 'General note']],
  sensorStreamType: [['ctd', 'CTD / multiparameter probe'], ['depth_logger', 'Depth logger'], ['temperature_logger', 'Temperature logger'], ['water_quality', 'Water-quality logger'], ['navigation', 'Navigation / position logger'], ['sonar', 'Sonar / acoustic log'], ['custom', 'Custom CSV sensor stream']],
  sampleContext: [['site', 'Site only'], ['station', 'Station'], ['transect', 'Transect'], ['observation', 'Observation']],
  sampleType: [['water', 'Water'], ['sediment', 'Sediment'], ['edna_water', 'eDNA water'], ['tissue', 'Tissue'], ['plankton', 'Plankton'], ['specimen', 'Specimen'], ['swab', 'Swab'], ['filter', 'Filter'], ['other', 'Other']],
  containerType: [['bottle', 'Bottle'], ['tube', 'Tube'], ['bag', 'Bag'], ['jar', 'Jar'], ['filter_cartridge', 'Filter cartridge'], ['vial', 'Vial'], ['other', 'Other']],
  preservative: [['none', 'None / immediate processing'], ['ice', 'On ice'], ['frozen', 'Frozen'], ['ethanol_95', '95% ethanol'], ['rnAlater', 'RNAlater'], ['formalin', 'Formalin'], ['other', 'Other']],
  storageCondition: [['ambient', 'Ambient'], ['on_ice', 'On ice'], ['refrigerated', 'Refrigerated'], ['frozen_minus20', 'Frozen −20°C'], ['frozen_minus80', 'Frozen −80°C'], ['liquid_nitrogen', 'Liquid nitrogen'], ['other', 'Other']],
  labelStatus: [['generated', 'Generated / not yet applied'], ['applied', 'Applied in field'], ['verified', 'Applied and verified'], ['missing', 'Missing / unreadable'], ['replaced', 'Replaced label']],
  sampleStatus: [['collected', 'Collected'], ['preserved', 'Preserved'], ['transferred', 'Transferred'], ['received_by_lab', 'Received by lab'], ['analyzed', 'Analyzed'], ['disposed', 'Disposed']],
  barcodeFormat: [['qr', 'QR code'], ['code_128', 'Code 128'], ['code_39', 'Code 39'], ['data_matrix', 'Data Matrix'], ['ean_13', 'EAN-13'], ['upc_a', 'UPC-A'], ['manual_text', 'Manual text / no camera scan'], ['unknown', 'Unknown']],
  custodyEvent: [['collection', 'Collection'], ['preservation', 'Preservation'], ['storage_change', 'Storage change'], ['handoff', 'Custody handoff'], ['lab_receipt', 'Lab receipt'], ['return', 'Return'], ['disposal', 'Disposal']],
  sealStatus: [['not_applicable', 'Not applicable'], ['intact', 'Intact'], ['broken', 'Broken / opened'], ['not_recorded', 'Not recorded']]
};

const f = (name, label, type = 'text', extra = {}) => ({ name, label, type, ...extra });
const select = (name, label, options, extra = {}) => f(name, label, 'select', { options, ...extra });
const num = (name, label, extra = {}) => f(name, label, 'number', { step: 'any', ...extra });
const textArea = (name, label, extra = {}) => f(name, label, 'textarea', extra);
const location = (name, label, extra = {}) => f(name, label, 'location', extra);

export const SCHEMAS = {
  mission: {
    title: 'Mission setup', icon: '◈', singleton: true,
    fields: [
      f('mission_id', 'Mission ID', 'text', { required: true, placeholder: 'ES-YYYYMMDD-01', pattern: '^ES-[0-9]{8}-[0-9]{2}$', help: 'Use the fixed EcoSurvey format: ES-20260703-01.' }),
      f('project_id', 'Project ID', 'text', { required: true, placeholder: 'ES-2026' }),
      f('mission_name', 'Mission name', 'text', { required: true, placeholder: 'Pilot shoreline habitat survey' }),
      f('mission_date', 'Mission date', 'date', { required: true }),
      f('mission_lead', 'Mission lead', 'text', { required: true }),
      f('team_members', 'Team members', 'text', { placeholder: 'Name; name; name' }),
      textArea('objective', 'Primary objective', { required: true, placeholder: 'Document habitat and biological observations along two pilot transects.' }),
      select('protocol_id', 'Survey protocol template', OPTIONS.surveyProtocol, { required: true, default: 'benthic_transect', help: 'Controls the guided workflow and adds protocol-specific QA/QC rules. Select General / custom when no template applies.' }),
      select('platform', 'Primary platform', OPTIONS.platform, { required: true }),
      f('planned_start_local', 'Planned start (local time)', 'datetime-local'),
      f('actual_start_utc', 'Actual start timestamp', 'datetime-local', { autoNow: true, help: 'Stored with your device local offset; exports as ISO 8601.' }),
      textArea('weather_summary', 'Weather summary'),
      f('permit_reference', 'Permit / authorization'),
      select('data_status', 'Mission data status', OPTIONS.dataStatus, { required: true, default: 'in_progress' }),
      select('qaqc_checked', 'Field QA/QC check completed?', OPTIONS.yesNo, { default: 'no', help: 'Set to Yes only after checking IDs, GPS points, links, media files, and required field records.' }),
      textArea('qaqc_notes', 'QA/QC notes'),
      textArea('notes', 'Mission notes')
    ]
  },
  site: {
    title: 'Site register', icon: '⌖', singleton: true,
    fields: [
      f('site_sequence', 'Site number', 'number', { required: true, min: 1, max: 50, step: 1, default: 1, help: '01–50. A site ID is generated automatically.' }),
      f('site_id', 'Generated site ID', 'computed'),
      f('site_name', 'Site name', 'text', { required: true, placeholder: 'Example: Lewes Breakwater North' }),
      f('region_state', 'Region / state'), f('country', 'Country', 'text', { default: 'United States' }), f('waterbody', 'Waterbody'),
      location('site_location', 'Site GPS point', { required: true, lat: 'latitude_dd', lon: 'longitude_dd', accuracy: 'gps_accuracy_m' }),
      textArea('location_description', 'Location description'), textArea('access_notes', 'Access notes'),
      select('dominant_habitat', 'Dominant habitat', OPTIONS.habitat, { required: true }),
      f('management_or_permit_zone', 'Management / permit zone'), select('sensitive_site_flag', 'Sensitive site?', OPTIONS.yesNoNa, { default: 'no' }), textArea('notes', 'Site notes')
    ]
  },
  equipment: {
    title: 'Equipment check', icon: '▣', idField: 'equipment_log_id',
    fields: [
      f('equipment_sequence', 'Equipment check number', 'number', { required: true, min: 1, step: 1, help: 'Use the next available number.' }), f('equipment_log_id', 'Generated equipment log ID', 'computed'),
      f('equipment_id', 'Equipment ID', 'text', { required: true, placeholder: 'CAM-01, ROV-01, CTD-01' }), select('equipment_category', 'Equipment category', OPTIONS.equipmentCategory, { required: true }),
      f('make_model', 'Make / model'), f('serial_number', 'Serial number'), select('calibration_status', 'Calibration status', OPTIONS.calibrationStatus, { required: true }),
      f('last_calibration_date', 'Last calibration date', 'date'), f('calibration_due_date', 'Calibration due date', 'date'), f('battery_or_power_id', 'Battery / power ID'),
      select('pre_mission_check', 'Pre-mission check', OPTIONS.yesNoNa, { required: true, default: 'yes' }), select('post_mission_check', 'Post-mission check', OPTIONS.yesNoNa, { default: 'na' }),
      select('operational_status', 'Operational status', OPTIONS.operationalStatus, { required: true, default: 'operational' }), textArea('issue_description', 'Issue description'), f('custodian', 'Custodian', 'text', { required: true }), textArea('notes', 'Equipment notes')
    ]
  },
  stations: {
    title: 'Station', icon: '●', idField: 'station_id',
    fields: [
      f('station_sequence', 'Station number', 'number', { required: true, min: 1, max: 50, step: 1 }), f('station_id', 'Generated station ID', 'computed'),
      select('station_type', 'Station type', OPTIONS.stationType, { required: true, default: 'fixed' }), f('collection_datetime_utc', 'Collection timestamp', 'datetime-local', { required: true, autoNow: true }),
      location('station_location', 'Station GPS point', { required: true, lat: 'latitude_dd', lon: 'longitude_dd', accuracy: 'gps_accuracy_m' }),
      num('depth_m', 'Depth (m)', { required: true, min: 0 }), select('tide_stage', 'Tide stage', OPTIONS.tideStage, { default: 'unknown' }),
      select('primary_habitat', 'Primary habitat', OPTIONS.habitat, { required: true }), select('primary_substrate', 'Primary substrate', OPTIONS.substrate, { required: true }),
      num('visibility_m', 'Water visibility (m)', { min: 0 }), f('sampling_design', 'Sampling design', 'text', { required: true, placeholder: '25 m belt transect; 2 m width' }), f('observer', 'Observer', 'text', { required: true }), textArea('notes', 'Station notes')
    ]
  },
  transects: {
    title: 'Transect', icon: '↔', idField: 'transect_id',
    fields: [
      f('transect_sequence', 'Transect number', 'number', { required: true, min: 1, max: 50, step: 1 }), select('parent_station_sequence', 'Associated station number', [], { required: true, dynamic: 'stationSequences' }),
      f('station_id', 'Generated station ID', 'computed'), f('transect_id', 'Generated transect ID', 'computed'), select('transect_type', 'Transect type', OPTIONS.transectType, { required: true, default: 'transect' }),
      f('start_datetime_utc', 'Start timestamp', 'datetime-local', { required: true, autoNow: true }), select('mark_transect_complete', 'Mark transect complete', OPTIONS.yesNo, { required: true, default: 'yes' }), f('end_datetime_utc', 'End timestamp', 'datetime-local'),
      location('start_location', 'Start GPS point', { required: true, lat: 'start_latitude_dd', lon: 'start_longitude_dd', accuracy: 'start_gps_accuracy_m' }), location('end_location', 'End GPS point', { lat: 'end_latitude_dd', lon: 'end_longitude_dd', accuracy: 'end_gps_accuracy_m' }),
      num('bearing_deg', 'Bearing (degrees)', { required: true, min: 0, max: 360 }), num('length_m', 'Length (m)', { required: true, min: 0.01 }), num('width_m', 'Survey width (m)', { required: true, min: 0.01 }),
      num('start_depth_m', 'Start depth (m)', { min: 0 }), num('end_depth_m', 'End depth (m)', { min: 0 }), select('platform', 'Platform', OPTIONS.platform, { required: true }), f('observer', 'Observer / pilot', 'text', { required: true }), f('media_id_primary', 'Primary media ID', 'text', { help: 'Optional; choose from media records after saving them.' }), textArea('notes', 'Transect notes')
    ]
  },
  tracks: {
    title: 'GPS track', icon: '⌁', idField: 'track_id',
    fields: [
      f('track_sequence', 'Track number', 'number', { required: true, min: 1, step: 1 }), f('track_id', 'Generated track ID', 'computed'),
      select('track_type', 'Track type', OPTIONS.trackType, { required: true, default: 'walking' }),
      f('start_datetime_utc', 'Track start timestamp', 'datetime-local', { required: true, autoNow: true }), f('end_datetime_utc', 'Track end timestamp', 'datetime-local'),
      select('track_status', 'Track status', OPTIONS.trackStatus, { required: true, default: 'complete' }),
      f('point_count', 'Recorded GPS points', 'computed'), f('distance_m', 'Track distance (m)', 'computed'), f('duration_seconds', 'Track duration (s)', 'computed'), f('average_accuracy_m', 'Average GPS accuracy (m)', 'computed'),
      f('operator', 'Operator / recorder', 'text', { required: true }), f('linked_station_sequence', 'Linked station number', 'number', { min: 1, step: 1, help: 'Optional. Use when the track represents a station approach or perimeter.' }),
      f('linked_station_id', 'Generated linked station ID', 'computed'), textArea('notes', 'Track notes')
    ]
  },
  rov_operations: {
    title: 'ROV operation', icon: '▾', idField: 'rov_operation_id',
    fields: [
      f('operation_sequence', 'ROV operation number', 'number', { required: true, min: 1, step: 1 }), f('rov_operation_id', 'Generated ROV operation ID', 'computed'),
      select('rov_equipment_log_id', 'ROV equipment record', [], { required: true, dynamic: 'rovEquipmentLogs', help: 'Select the Equipment check record for the vehicle used in this deployment.' }), f('vehicle_id', 'Vehicle / ROV ID', 'text', { required: true, placeholder: 'ROV-01' }),
      f('operation_name', 'Operation name / objective', 'text', { required: true, placeholder: 'North reef reconnaissance pass' }), f('pilot', 'Pilot', 'text', { required: true }), f('tether_tender', 'Tether tender / safety observer', 'text'),
      f('launch_datetime_utc', 'Launch timestamp', 'datetime-local', { required: true, autoNow: true }), f('recovery_datetime_utc', 'Recovery timestamp', 'datetime-local'), select('operation_status', 'Operation status', OPTIONS.rovOperationStatus, { required: true, default: 'planned' }),
      location('launch_location', 'Launch GPS point', { lat: 'launch_latitude_dd', lon: 'launch_longitude_dd', accuracy: 'launch_gps_accuracy_m', optional: true }), location('recovery_location', 'Recovery GPS point', { lat: 'recovery_latitude_dd', lon: 'recovery_longitude_dd', accuracy: 'recovery_gps_accuracy_m', optional: true }),
      num('max_depth_m', 'Maximum depth reached (m)', { min: 0 }), num('tether_length_m', 'Maximum tether paid out (m)', { min: 0 }), f('navigation_track_sequence', 'Navigation track number', 'number', { min: 1, step: 1 }), f('navigation_track_id', 'Generated navigation track ID', 'computed'),
      select('video_media_sequence', 'Primary video media number', [], { dynamic: 'videoMediaSequences', help: 'Link the external ROV video Media record before or after this operation.' }), f('video_media_id', 'Generated primary video Media ID', 'computed'), num('video_time_at_launch_seconds', 'Video time at launch (s)', { min: 0, help: 'Enter the timecode shown in the linked video at the physical launch moment. Use 0 when recording begins exactly at launch.' }), textArea('video_time_sync_note', 'Video time-sync note'),
      f('camera_or_sensor_id', 'Primary camera / sensor ID', 'text'), f('battery_or_power_id', 'Battery / power ID', 'text'), textArea('incident_summary', 'Incident / issue summary'), textArea('notes', 'Operation notes')
    ]
  },
  video_logs: {
    title: 'ROV video log', icon: '▶', idField: 'video_log_id',
    fields: [
      f('video_log_sequence', 'Video-log event number', 'number', { required: true, min: 1, step: 1 }), f('video_log_id', 'Generated video-log ID', 'computed'), select('rov_operation_sequence', 'ROV operation number', [], { required: true, dynamic: 'rovOperationSequences' }), f('rov_operation_id', 'Generated ROV operation ID', 'computed'),
      f('video_log_datetime_utc', 'Field timestamp', 'datetime-local', { required: true, autoNow: true }), f('video_elapsed_seconds', 'Video elapsed time (seconds)', 'number', { required: true, min: 0, step: 'any', help: 'Elapsed time from the beginning of the linked operation video.' }), f('video_timecode', 'Normalized video timecode', 'computed'), f('estimated_mission_datetime_utc', 'Estimated mission time from video sync', 'computed'), select('event_type', 'Event type', OPTIONS.rovEventType, { required: true, default: 'video_marker' }),
      select('video_log_link_context', 'Link event to', OPTIONS.mediaContext, { required: true, default: 'site' }), select('video_log_station_sequence', 'Station number', [], { dynamic: 'stationSequences' }), select('video_log_transect_sequence', 'Transect number', [], { dynamic: 'transectSequences' }), select('video_log_observation_sequence', 'Observation number', [], { dynamic: 'observationSequences' }),
      f('station_id', 'Generated station ID', 'computed'), f('transect_id', 'Generated transect ID', 'computed'), f('observation_id', 'Generated observation ID', 'computed'), f('media_id', 'Operation video Media ID', 'computed'),
      f('candidate_taxon', 'Candidate taxon / target', 'text', { placeholder: 'Optional preliminary identification' }), select('confidence', 'Event confidence', OPTIONS.confidence, { required: true, default: 'medium' }), f('logger', 'Logger / annotator', 'text', { required: true }), textArea('event_description', 'Event description', { required: true }), textArea('notes', 'Annotation notes')
    ]
  },
  sensor_streams: {
    title: 'Sensor stream', icon: '≋', idField: 'sensor_stream_id',
    fields: [
      f('sensor_stream_sequence', 'Sensor stream number', 'number', { required: true, min: 1, step: 1 }), f('sensor_stream_id', 'Generated sensor-stream ID', 'computed'),
      f('stream_name', 'Stream name', 'text', { required: true, placeholder: 'ROV CTD logger — pass 01' }), select('stream_type', 'Stream type', OPTIONS.sensorStreamType, { required: true, default: 'ctd' }),
      f('instrument_id', 'Instrument / sensor ID', 'text', { required: true, placeholder: 'CTD-01' }), select('equipment_log_id', 'Equipment check record', [], { dynamic: 'sensorEquipmentLogs', help: 'Optional but recommended; link the Sensor equipment check that was used.' }),
      select('rov_operation_sequence', 'Linked ROV operation number', [], { dynamic: 'rovOperationSequences', help: 'Optional. Link an operation to synchronize the stream with video/event logs.' }), f('rov_operation_id', 'Generated ROV operation ID', 'computed'),
      f('source_filename', 'Source CSV filename', 'text', { required: true, placeholder: 'ctd_dive_001.csv' }), f('source_row_count', 'Source rows', 'number', { min: 1 }), f('imported_row_count', 'Imported readings', 'computed'), f('downsample_every', 'Import every Nth row', 'number', { min: 1, step: 1, default: 1 }),
      f('timestamp_column', 'Mapped timestamp column', 'text', { required: true }), f('column_mapping_json', 'Column mapping JSON', 'textarea'),
      f('sensor_time_at_launch', 'Sensor clock timestamp at physical launch', 'datetime-local', { help: 'Required for synchronized ROV/video timing. Enter the sensor logger’s own timestamp at the physical launch moment.' }), f('time_offset_seconds', 'Calculated sensor-clock offset (s)', 'computed'), f('timezone_note', 'Sensor timestamp timezone / clock note', 'text', { placeholder: 'UTC / device local / logger clock set 90 s slow' }),
      f('first_sensor_datetime_utc', 'First sensor timestamp', 'computed'), f('last_sensor_datetime_utc', 'Last sensor timestamp', 'computed'), f('first_estimated_mission_datetime_utc', 'First synchronized mission timestamp', 'computed'), f('last_estimated_mission_datetime_utc', 'Last synchronized mission timestamp', 'computed'), f('coordinate_count', 'Readings with GPS', 'computed'), select('import_status', 'Import status', [['complete','Complete'], ['partial','Partial'], ['failed','Failed']], { required: true, default: 'complete' }), textArea('notes', 'Sensor-stream notes')
    ]
  },
  sensor_readings: {
    title: 'Sensor reading', icon: '∙', idField: 'sensor_reading_id',
    fields: [
      f('sensor_reading_sequence', 'Reading number', 'number', { required: true, min: 1, step: 1 }), f('sensor_reading_id', 'Generated sensor-reading ID', 'computed'), select('sensor_stream_sequence', 'Sensor stream number', [], { required: true, dynamic: 'sensorStreamSequences' }), f('sensor_stream_id', 'Generated sensor-stream ID', 'computed'),
      f('raw_sensor_timestamp', 'Raw sensor timestamp', 'text', { required: true }), f('normalized_sensor_datetime_utc', 'Normalized sensor timestamp', 'computed', { required: true }), f('estimated_mission_datetime_utc', 'Estimated mission timestamp', 'computed'), f('time_offset_seconds', 'Time offset (s)', 'computed'),
      location('sensor_location', 'Sensor GPS point', { lat: 'latitude_dd', lon: 'longitude_dd', accuracy: 'gps_accuracy_m', optional: true }), num('depth_m', 'Depth (m)', { min: 0 }), num('temperature_c', 'Temperature (°C)', { min: -2, max: 45 }), num('salinity_psu', 'Salinity (PSU)', { min: 0, max: 50 }), num('conductivity_us_cm', 'Conductivity (µS/cm)', { min: 0 }), num('dissolved_oxygen_mg_l', 'Dissolved oxygen (mg/L)', { min: 0 }), num('ph', 'pH', { min: 0, max: 14 }), num('turbidity_ntu', 'Turbidity (NTU)', { min: 0 }), num('heading_deg', 'Heading (degrees)', { min: 0, max: 360 }), num('pressure_dbar', 'Pressure (dbar)', { min: 0 }), textArea('notes', 'Reading notes')
    ]
  },
  environment: {
    title: 'Environmental measurement', icon: '≈', idField: 'env_record_id',
    fields: [
      f('environment_sequence', 'Environmental record number', 'number', { required: true, min: 1, step: 1 }), f('env_record_id', 'Generated environmental record ID', 'computed'),
      select('environment_link_context', 'Link measurement to', OPTIONS.context, { required: true, default: 'station' }), select('environment_station_sequence', 'Station number', [], { dynamic: 'stationSequences' }), select('environment_transect_sequence', 'Transect number', [], { dynamic: 'transectSequences' }),
      f('station_id', 'Generated station ID', 'computed'), f('transect_id', 'Generated transect ID', 'computed'), f('datetime_utc', 'Measurement timestamp', 'datetime-local', { required: true, autoNow: true }),
      f('instrument_id', 'Instrument ID'), f('calibration_record_id', 'Calibration record ID'), num('temperature_c', 'Water temperature (°C)', { min: -2, max: 45 }), num('salinity_psu', 'Salinity (PSU)', { min: 0, max: 50 }), num('conductivity_us_cm', 'Conductivity (µS/cm)', { min: 0 }), num('dissolved_oxygen_mg_l', 'Dissolved oxygen (mg/L)', { min: 0 }), num('ph', 'pH', { min: 0, max: 14 }), num('turbidity_ntu', 'Turbidity (NTU)', { min: 0 }), num('depth_m', 'Depth (m)', { min: 0 }), num('secchi_depth_m', 'Secchi depth (m)', { min: 0 }), num('current_velocity_m_s', 'Current velocity (m/s)', { min: 0 }), num('current_direction_deg', 'Current direction (degrees)', { min: 0, max: 360 }), num('air_temperature_c', 'Air temperature (°C)'), num('wind_speed_m_s', 'Wind speed (m/s)', { min: 0 }), select('weather_condition', 'Weather', OPTIONS.weather), num('cloud_cover_pct', 'Cloud cover (%)', { min: 0, max: 100 }), select('tide_stage', 'Tide stage', OPTIONS.tideStage), num('water_visibility_m', 'Water visibility (m)', { min: 0 }), textArea('notes', 'Environmental notes')
    ]
  },
  observations: {
    title: 'Observation', icon: '◌', idField: 'observation_id',
    fields: [
      f('observation_sequence', 'Observation number', 'number', { required: true, min: 1, step: 1 }), f('observation_id', 'Generated observation ID', 'computed'), select('observation_link_context', 'Link observation to', OPTIONS.context, { required: true, default: 'transect' }), select('observation_station_sequence', 'Station number', [], { dynamic: 'stationSequences' }), select('observation_transect_sequence', 'Transect number', [], { dynamic: 'transectSequences' }), f('station_id', 'Generated station ID', 'computed'), f('transect_id', 'Generated transect ID', 'computed'),
      f('observation_datetime_utc', 'Observation timestamp', 'datetime-local', { required: true, autoNow: true }), location('observation_location', 'Independent observation GPS point', { lat: 'latitude_dd', lon: 'longitude_dd', accuracy: 'gps_accuracy_m', optional: true }),
      select('taxon_name_basis', 'Name field recorded', OPTIONS.taxonNameBasis, { required: true, default: 'common' }), f('taxon_scientific_name', 'Scientific name', 'text', { conditional: 'taxonName' }), f('common_name', 'Common name', 'text', { conditional: 'taxonName' }), select('taxonomic_level', 'Taxonomic level', OPTIONS.taxonomicLevel, { required: true, default: 'species' }), select('taxon_source', 'Taxon source', OPTIONS.taxonSource, { default: 'manual', help: 'Quick entry records project-list or regional-pack provenance when a controlled taxon is selected.' }), f('taxon_list_id', 'Controlled species list ID', 'text'), f('taxon_list_name', 'Controlled species list', 'text'), f('taxon_key', 'Controlled taxon key', 'text'), f('taxon_group', 'Taxon group', 'text'), f('taxon_pack_id', 'Regional taxon pack ID', 'text'), f('taxon_pack_name', 'Regional taxon pack', 'text'), f('taxon_pack_version', 'Taxon pack version', 'text'), f('taxon_pack_region', 'Taxon pack region', 'text'), f('taxon_pack_review_status', 'Taxon pack review status', 'text'), select('quick_entry_mode', 'Quick-entry record?', OPTIONS.yesNo, { default: 'no' }), select('observation_category', 'Observation category', OPTIONS.observationCategory, { required: true, default: 'organism' }),
      f('count', 'Count (individuals)', 'number', { min: 0, step: 1 }), f('abundance_code', 'Abundance code'), num('percent_cover', 'Percent cover (%)', { min: 0, max: 100 }), f('size_class_cm', 'Size class (cm)'), f('life_stage', 'Life stage'), f('behavior', 'Behavior / condition'), select('habitat_context', 'Habitat context', OPTIONS.habitat), select('observation_method', 'Observation method', OPTIONS.observationMethod, { required: true, default: 'visual' }), select('identification_confidence', 'Identification confidence', OPTIONS.confidence, { required: true, default: 'medium' }), f('media_id', 'Linked media ID'), f('observer', 'Observer / annotator', 'text', { required: true }), select('review_status', 'Review status', OPTIONS.reviewStatus, { required: true, default: 'unreviewed' }), textArea('notes', 'Observation notes')
    ]
  },
  samples: {
    title: 'Sample register', icon: '▧', idField: 'sample_id',
    fields: [
      f('sample_sequence', 'Sample number', 'number', { required: true, min: 1, step: 1 }), f('sample_id', 'Generated sample ID', 'computed'),
      select('sample_link_context', 'Link sample to', OPTIONS.sampleContext, { required: true, default: 'station' }), select('sample_station_sequence', 'Station number', [], { dynamic: 'stationSequences' }), select('sample_transect_sequence', 'Transect number', [], { dynamic: 'transectSequences' }), select('sample_observation_sequence', 'Observation number', [], { dynamic: 'observationSequences' }),
      f('station_id', 'Generated station ID', 'computed'), f('transect_id', 'Generated transect ID', 'computed'), f('observation_id', 'Generated observation ID', 'computed'),
      f('collection_datetime_utc', 'Collection timestamp', 'datetime-local', { required: true, autoNow: true }), location('sample_location', 'Independent sample GPS point', { lat: 'latitude_dd', lon: 'longitude_dd', accuracy: 'gps_accuracy_m', optional: true }),
      select('sample_type', 'Sample type', OPTIONS.sampleType, { required: true, default: 'water' }), f('sample_subtype', 'Sample subtype / target', 'text', { placeholder: 'e.g., surface water, 0–2 cm sediment, gill tissue' }),
      select('container_type', 'Container type', OPTIONS.containerType, { required: true, default: 'bottle' }), num('volume_ml', 'Volume (mL)', { min: 0 }), num('mass_g', 'Mass (g)', { min: 0 }),
      select('preservative', 'Preservative / immediate treatment', OPTIONS.preservative, { required: true, default: 'none' }), select('storage_condition', 'Current storage condition', OPTIONS.storageCondition, { required: true, default: 'ambient' }), f('storage_location', 'Current storage location', 'text', { required: true, placeholder: 'Cooler A / Rack 2 / Freezer 1' }),
      f('sample_label', 'Sample label / barcode value', 'barcode', { required: true, help: 'Scan an existing QR/barcode when supported, or keep the generated sample ID as the label value.' }), select('barcode_format', 'Label / barcode format', OPTIONS.barcodeFormat, { required: true, default: 'manual_text' }), f('barcode_scanned_at', 'Label scan timestamp', 'datetime-local'), select('label_status', 'Label status', OPTIONS.labelStatus, { required: true, default: 'generated' }),
      f('collector', 'Collector', 'text', { required: true }), f('initial_custodian', 'Initial custodian', 'text', { required: true }), select('sample_status', 'Sample status', OPTIONS.sampleStatus, { required: true, default: 'collected' }), f('analysis_requested', 'Requested analysis'), textArea('notes', 'Sample notes')
    ]
  },
  custody: {
    title: 'Custody event', icon: '⇄', idField: 'custody_id',
    fields: [
      f('custody_sequence', 'Custody event number', 'number', { required: true, min: 1, step: 1 }), f('custody_id', 'Generated custody event ID', 'computed'), select('sample_sequence', 'Sample number', [], { required: true, dynamic: 'sampleSequences' }), f('sample_id', 'Generated sample ID', 'computed'),
      f('custody_datetime_utc', 'Event timestamp', 'datetime-local', { required: true, autoNow: true }), select('custody_event', 'Custody event', OPTIONS.custodyEvent, { required: true, default: 'handoff' }),
      f('from_custodian', 'From custodian', 'text', { required: true }), f('to_custodian', 'To custodian', 'text', { required: true }), f('handoff_location', 'Handoff / storage location', 'text', { required: true, placeholder: 'Dock cooler / lab receiving / freezer rack' }),
      select('storage_condition', 'Storage condition after event', OPTIONS.storageCondition, { required: true, default: 'ambient' }), select('seal_status', 'Seal / container status', OPTIONS.sealStatus, { required: true, default: 'not_applicable' }), f('receiving_signature_name', 'Receiving signature / typed name'), textArea('notes', 'Custody notes')
    ]
  },
  media: {
    title: 'Media record', icon: '▤', idField: 'media_id',
    fields: [
      f('media_sequence', 'Media number', 'number', { required: true, min: 1, step: 1 }), f('media_id', 'Generated media ID', 'computed'), select('media_link_context', 'Link media to', OPTIONS.mediaContext, { required: true, default: 'transect' }), select('media_station_sequence', 'Station number', [], { dynamic: 'stationSequences' }), select('media_transect_sequence', 'Transect number', [], { dynamic: 'transectSequences' }), select('media_observation_sequence', 'Observation number', [], { dynamic: 'observationSequences' }), f('station_id', 'Generated station ID', 'computed'), f('transect_id', 'Generated transect ID', 'computed'), f('observation_id', 'Generated observation ID', 'computed'),
      select('media_type', 'Media type', OPTIONS.mediaType, { required: true, default: 'photo' }), select('media_capture_mode', 'Capture / reference method', OPTIONS.mediaCaptureMode, { required: true, default: 'external_reference' }), f('media_file', 'Attach/import field media', 'file', { accept: 'image/*,video/*,audio/*' }), f('file_name_manual', 'External file name', 'text', { placeholder: 'ROV_20260703_001.mp4', help: 'Required for external files and recommended for every record.' }), f('file_name', 'Recorded file name', 'computed'),
      f('file_extension', 'File extension', 'text', { placeholder: 'jpg, mp4, csv...' }), f('capture_datetime_utc', 'Capture timestamp', 'datetime-local', { required: true, autoNow: true }), location('media_location', 'Media GPS point', { lat: 'latitude_dd', lon: 'longitude_dd', accuracy: 'gps_accuracy_m', optional: true }), f('camera_or_sensor_id', 'Camera / sensor ID', 'text', { required: true }), f('operator', 'Operator', 'text', { required: true }), f('storage_path', 'Storage path', 'text', { required: true, placeholder: 'Media/ES-20260703-01/' }), f('sha256_checksum', 'SHA-256 checksum'), select('quality_rating', 'Quality rating', OPTIONS.qualityRating, { default: 'usable' }), select('annotation_status', 'Annotation status', OPTIONS.annotationStatus, { default: 'not_started' }), textArea('description', 'Description')
    ]
  }
};

export const RECORD_TABLES = ['equipment', 'rov_operations', 'video_logs', 'sensor_streams', 'sensor_readings', 'stations', 'tracks', 'transects', 'environment', 'observations', 'samples', 'custody', 'media'];

export function pad(value, width = 2) {
  return String(value ?? '').padStart(width, '0');
}

export function makeIds(mission = {}, site = {}, table, record = {}) {
  const missionId = mission.mission_id || '';
  const siteId = site.site_id || (missionId && site.site_sequence ? `${missionId}-S${pad(site.site_sequence)}` : '');
  const stationId = siteId && record.parent_station_sequence ? `${siteId}-ST${pad(record.parent_station_sequence)}` : siteId && record.station_sequence ? `${siteId}-ST${pad(record.station_sequence)}` : '';
  const contextStationSequence = record.environment_station_sequence || record.observation_station_sequence || record.media_station_sequence || record.sample_station_sequence || record.video_log_station_sequence || '';
  const contextTransectSequence = record.environment_transect_sequence || record.observation_transect_sequence || record.media_transect_sequence || record.sample_transect_sequence || record.video_log_transect_sequence || '';
  const contextStation = siteId && contextStationSequence ? `${siteId}-ST${pad(contextStationSequence)}` : '';
  const contextTransect = contextStation && contextTransectSequence ? `${contextStation}-T${pad(contextTransectSequence)}` : '';
  const ids = { mission_id: missionId, site_id: siteId };
  if (table === 'site') ids.site_id = siteId;
  if (table === 'equipment') ids.equipment_log_id = missionId && record.equipment_sequence ? `${missionId}-Q${pad(record.equipment_sequence, 3)}` : '';
  if (table === 'stations') ids.station_id = stationId;
  if (table === 'tracks') { ids.track_id = missionId && record.track_sequence ? `${missionId}-TRK${pad(record.track_sequence)}` : ''; ids.linked_station_id = siteId && record.linked_station_sequence ? `${siteId}-ST${pad(record.linked_station_sequence)}` : ''; }
  if (table === 'transects') { ids.station_id = stationId; ids.transect_id = stationId && record.transect_sequence ? `${stationId}-T${pad(record.transect_sequence)}` : ''; }
  if (table === 'rov_operations') { ids.rov_operation_id = missionId && record.operation_sequence ? `${missionId}-ROV${pad(record.operation_sequence)}` : ''; ids.navigation_track_id = missionId && record.navigation_track_sequence ? `${missionId}-TRK${pad(record.navigation_track_sequence)}` : ''; ids.video_media_id = missionId && record.video_media_sequence ? `${missionId}-M${pad(record.video_media_sequence, 3)}` : ''; }
  if (table === 'video_logs') { ids.video_log_id = missionId && record.video_log_sequence ? `${missionId}-VLOG${pad(record.video_log_sequence, 3)}` : ''; ids.rov_operation_id = missionId && record.rov_operation_sequence ? `${missionId}-ROV${pad(record.rov_operation_sequence)}` : ''; ids.station_id = contextStation; ids.transect_id = contextTransect; ids.observation_id = missionId && record.video_log_observation_sequence ? `${missionId}-O${pad(record.video_log_observation_sequence, 3)}` : ''; }
  if (table === 'sensor_streams') { ids.sensor_stream_id = missionId && record.sensor_stream_sequence ? `${missionId}-SEN${pad(record.sensor_stream_sequence)}` : ''; ids.rov_operation_id = missionId && record.rov_operation_sequence ? `${missionId}-ROV${pad(record.rov_operation_sequence)}` : ''; }
  if (table === 'sensor_readings') { ids.sensor_stream_id = missionId && record.sensor_stream_sequence ? `${missionId}-SEN${pad(record.sensor_stream_sequence)}` : ''; ids.sensor_reading_id = ids.sensor_stream_id && record.sensor_reading_sequence ? `${ids.sensor_stream_id}-R${pad(record.sensor_reading_sequence, 6)}` : ''; }
  if (table === 'environment') { ids.env_record_id = missionId && record.environment_sequence ? `${missionId}-E${pad(record.environment_sequence, 3)}` : ''; ids.station_id = contextStation; ids.transect_id = contextTransect; }
  if (table === 'observations') { ids.observation_id = missionId && record.observation_sequence ? `${missionId}-O${pad(record.observation_sequence, 3)}` : ''; ids.station_id = contextStation; ids.transect_id = contextTransect; }
  if (table === 'samples') { ids.sample_id = missionId && record.sample_sequence ? `${missionId}-SMP${pad(record.sample_sequence, 3)}` : ''; ids.station_id = contextStation; ids.transect_id = contextTransect; ids.observation_id = missionId && record.sample_observation_sequence ? `${missionId}-O${pad(record.sample_observation_sequence, 3)}` : ''; }
  if (table === 'custody') { ids.custody_id = missionId && record.custody_sequence ? `${missionId}-CUST${pad(record.custody_sequence, 3)}` : ''; ids.sample_id = missionId && record.sample_sequence ? `${missionId}-SMP${pad(record.sample_sequence, 3)}` : ''; }
  if (table === 'media') { ids.media_id = missionId && record.media_sequence ? `${missionId}-M${pad(record.media_sequence, 3)}` : ''; ids.station_id = contextStation; ids.transect_id = contextTransect; ids.observation_id = missionId && record.media_observation_sequence ? `${missionId}-O${pad(record.media_observation_sequence, 3)}` : ''; }
  return ids;
}

export function isoNowLocalInput() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function toIso(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
