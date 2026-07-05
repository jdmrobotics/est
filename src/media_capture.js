/**
 * EcoSurvey v0.5 device-capture helpers.
 * Keeps camera/audio/video logic separate from the form renderer so it can be
 * smoke-tested in Node and extended later for EXIF, hashing, and timeline work.
 */

export const MAX_LOCAL_MEDIA_BYTES = 180 * 1024 * 1024;

const asText = (value) => String(value ?? '').trim();
const basename = (name = '') => asText(name).split(/[\\/]/).pop() || '';

export function extensionFromName(name = '') {
  const file = basename(name);
  const index = file.lastIndexOf('.');
  return index > 0 && index < file.length - 1 ? file.slice(index + 1).toLowerCase() : '';
}

export function mediaTypeFromFile(file = {}) {
  const type = asText(file.type).toLowerCase();
  const extension = extensionFromName(file.name);
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'].includes(extension)) return 'photo';
  if (type.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm', 'avi'].includes(extension)) return 'video';
  if (type.startsWith('audio/') || ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'flac'].includes(extension)) return 'audio';
  return 'other';
}

export function captureModeFromMediaType(mediaType) {
  if (mediaType === 'photo') return 'capture_photo';
  if (mediaType === 'video') return 'capture_video';
  if (mediaType === 'audio') return 'capture_audio';
  return 'external_reference';
}

export function parseCaptureTarget(value = '') {
  const source = asText(value);
  if (source === 'site' || !source) return { context: 'site' };
  const [context, stationSequence, childSequence] = source.split(':');
  if (!['station', 'transect', 'observation'].includes(context)) return { context: 'site' };
  const parsed = { context };
  if (stationSequence) parsed.stationSequence = Number(stationSequence);
  if (context === 'transect' && childSequence) parsed.transectSequence = Number(childSequence);
  if (context === 'observation' && childSequence) parsed.observationSequence = Number(childSequence);
  return parsed;
}

export function captureTargetValue(target = {}) {
  if (target.context === 'station' && target.stationSequence) return `station:${target.stationSequence}`;
  if (target.context === 'transect' && target.stationSequence && target.transectSequence) return `transect:${target.stationSequence}:${target.transectSequence}`;
  if (target.context === 'observation' && target.stationSequence && target.observationSequence) return `observation:${target.stationSequence}:${target.observationSequence}`;
  return 'site';
}

export function targetLabel(target = {}, recordsByTable = {}) {
  if (target.context === 'station') {
    const station = (recordsByTable.stations || []).find((row) => Number(row.station_sequence) === Number(target.stationSequence));
    return station ? `Station ${String(target.stationSequence).padStart(2, '0')} · ${station.station_id || ''}` : `Station ${target.stationSequence || ''}`;
  }
  if (target.context === 'transect') {
    const transect = (recordsByTable.transects || []).find((row) => Number(row.parent_station_sequence) === Number(target.stationSequence) && Number(row.transect_sequence) === Number(target.transectSequence));
    return transect ? `Transect ${String(target.transectSequence).padStart(2, '0')} · ${transect.transect_id || ''}` : `Transect ${target.transectSequence || ''}`;
  }
  if (target.context === 'observation') {
    const observation = (recordsByTable.observations || []).find((row) => Number(row.observation_sequence) === Number(target.observationSequence));
    return observation ? `Observation ${String(target.observationSequence).padStart(3, '0')} · ${observation.observation_id || ''}` : `Observation ${target.observationSequence || ''}`;
  }
  return 'Site only';
}

export function validateLocalMedia(file, { maxBytes = MAX_LOCAL_MEDIA_BYTES } = {}) {
  const errors = [];
  if (!file) errors.push('Capture or select one photo, video, or audio file before saving.');
  if (file && !Number.isFinite(Number(file.size))) errors.push('The selected file has no readable size. Try capturing or selecting it again.');
  if (file && Number(file.size) <= 0) errors.push('The selected media file is empty.');
  if (file && Number(file.size) > maxBytes) errors.push(`This local attachment is ${formatBytes(file.size)}. Keep device-stored captures at or below ${formatBytes(maxBytes)}; record larger ROV/GoPro files as external references instead.`);
  const mediaType = file ? mediaTypeFromFile(file) : '';
  if (file && !['photo', 'video', 'audio'].includes(mediaType)) errors.push('EcoSurvey quick capture accepts photos, videos, and audio. Use the full Media record form to reference sonar, documents, or other external assets.');
  return errors;
}

export function formatBytes(value = 0) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function sequenceForCapture(recordsByTable = {}) {
  return Math.max(0, ...(recordsByTable.media || []).map((row) => Number(row.media_sequence) || 0)) + 1;
}

/**
 * Create the raw media form data. The caller calculates IDs using schema helpers,
 * writes the attachment Blob, and then saves the resulting record.
 */
export function makeCaptureDraft({ mission = {}, recordsByTable = {}, target = { context: 'site' }, file, operator = '', description = '', qualityRating = 'usable', location = null, promote = true, source = 'device_camera' } = {}) {
  const mediaType = mediaTypeFromFile(file);
  const filename = basename(file?.name || '');
  const linkedObservation = target.context === 'observation'
    ? (recordsByTable.observations || []).find((row) => Number(row.observation_sequence) === Number(target.observationSequence))
    : null;
  const linkedStationSequence = target.stationSequence || linkedObservation?.observation_station_sequence || '';
  const linkedTransectSequence = target.transectSequence || linkedObservation?.observation_transect_sequence || '';
  const draft = {
    media_sequence: sequenceForCapture(recordsByTable),
    media_link_context: target.context || 'site',
    media_station_sequence: linkedStationSequence,
    media_transect_sequence: linkedTransectSequence,
    media_observation_sequence: target.observationSequence || '',
    media_type: mediaType,
    media_capture_mode: captureModeFromMediaType(mediaType),
    file_name_manual: filename,
    file_name: filename,
    file_extension: extensionFromName(filename),
    capture_datetime_utc: new Date().toISOString(),
    latitude_dd: location?.lat !== undefined && location?.lat !== null ? Number(location.lat).toFixed(6) : '',
    longitude_dd: location?.lon !== undefined && location?.lon !== null ? Number(location.lon).toFixed(6) : '',
    gps_accuracy_m: location?.accuracy !== undefined && location?.accuracy !== null ? Math.round(Number(location.accuracy)) : '',
    camera_or_sensor_id: 'DEVICE-CAMERA',
    operator: asText(operator) || asText(mission.mission_lead) || 'Field recorder',
    storage_path: `Media/${asText(mission.mission_id) || 'UNASSIGNED'}/`,
    sha256_checksum: '',
    quality_rating: qualityRating || 'usable',
    annotation_status: 'not_started',
    description: asText(description),
    attachment_filename: filename,
    attachment_mime_type: asText(file?.type) || 'application/octet-stream',
    attachment_size_bytes: Number(file?.size) || 0,
    capture_source: source,
    promote_as_primary: promote ? 'yes' : 'no'
  };
  return draft;
}

/**
 * Returns the linked parent table/ID field that should be populated only when
 * the corresponding target field is blank. Never overwrites an existing link.
 */
export function parentPromotionPlan(target = {}, mediaId = '') {
  if (!mediaId) return null;
  if (target.context === 'transect') return { table: 'transects', match: (row) => Number(row.parent_station_sequence) === Number(target.stationSequence) && Number(row.transect_sequence) === Number(target.transectSequence), field: 'media_id_primary', value: mediaId };
  if (target.context === 'observation') return { table: 'observations', match: (row) => Number(row.observation_sequence) === Number(target.observationSequence), field: 'media_id', value: mediaId };
  return null;
}
