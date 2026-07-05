/**
 * ROV mission and synchronized-video helpers.
 * The app stores video time as elapsed seconds plus a human-readable timecode.
 * These helpers are intentionally dependency-free so the workflow remains usable offline.
 */

export function parseTimecode(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  const parts = raw.split(':').map((item) => item.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((item) => !/^\d+(?:\.\d+)?$/.test(item))) return null;
  const numbers = parts.map(Number);
  const [hours, minutes, seconds] = parts.length === 3 ? numbers : [0, numbers[0], numbers[1]];
  if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60 || hours < 0) return null;
  return (hours * 3600) + (minutes * 60) + seconds;
}

export function formatTimecode(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function normalizeVideoLogTime(input = {}) {
  const seconds = input.video_elapsed_seconds !== undefined && input.video_elapsed_seconds !== ''
    ? Number(input.video_elapsed_seconds)
    : parseTimecode(input.video_timecode);
  if (!Number.isFinite(seconds) || seconds < 0) return { valid: false, seconds: null, timecode: '' };
  return { valid: true, seconds, timecode: formatTimecode(seconds) };
}


/**
 * Estimate mission-clock time from a video timestamp using the operation's launch anchor.
 * `video_time_at_launch_seconds` is the timecode visible in the primary video at physical launch.
 */
export function estimateVideoLogMissionTime(operation = {}, videoLog = {}) {
  const launch = new Date(operation.launch_datetime_utc || '').getTime();
  const normalized = normalizeVideoLogTime(videoLog);
  const anchor = Number(operation.video_time_at_launch_seconds || 0);
  if (!Number.isFinite(launch) || !normalized.valid || !Number.isFinite(anchor) || anchor < 0) return '';
  return new Date(launch + ((normalized.seconds - anchor) * 1000)).toISOString();
}

export function operationDurationSeconds(operation = {}) {
  const launch = new Date(operation.launch_datetime_utc || '').getTime();
  const recovery = new Date(operation.recovery_datetime_utc || '').getTime();
  if (!Number.isFinite(launch) || !Number.isFinite(recovery) || recovery < launch) return null;
  return Math.round((recovery - launch) / 1000);
}

export function operationVideoMedia(operation = {}, media = []) {
  const id = String(operation.video_media_id || '').trim();
  if (!id) return null;
  return media.find((row) => String(row.media_id || '') === id) || null;
}

export function buildRovVideoLogDraft({ operation = {}, sequence = 1, missionLead = '', now = '' } = {}) {
  return {
    video_log_sequence: sequence,
    rov_operation_sequence: operation.operation_sequence || '',
    video_log_datetime_utc: now || new Date().toISOString(),
    video_elapsed_seconds: '',
    video_timecode: '',
    event_type: 'video_marker',
    video_log_link_context: 'site',
    video_log_station_sequence: '',
    video_log_transect_sequence: '',
    video_log_observation_sequence: '',
    logger: missionLead || operation.pilot || '',
    candidate_taxon: '',
    event_description: '',
    confidence: 'medium',
    notes: ''
  };
}

export function summarizeRovOperation(operation = {}, videoLogs = []) {
  const ownLogs = videoLogs.filter((row) => String(row.rov_operation_id || '') === String(operation.rov_operation_id || ''));
  const eventCounts = ownLogs.reduce((out, row) => {
    const key = String(row.event_type || 'other'); out[key] = (out[key] || 0) + 1; return out;
  }, {});
  return {
    video_log_count: ownLogs.length,
    event_counts: eventCounts,
    duration_seconds: operationDurationSeconds(operation),
    max_elapsed_seconds: ownLogs.reduce((max, row) => Math.max(max, Number(row.video_elapsed_seconds) || 0), 0)
  };
}
