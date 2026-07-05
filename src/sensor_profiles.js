/**
 * Offline sensor-profile and video/sensor synchronization helpers.
 * Charts are SVG-based and dependency-free so they remain usable when the
 * field device has no connection. Raw imported readings are never modified.
 */

export const SENSOR_PROFILE_METRICS = [
  { key: 'depth_m', label: 'Depth', unit: 'm', invertY: true },
  { key: 'temperature_c', label: 'Temperature', unit: '°C' },
  { key: 'salinity_psu', label: 'Salinity', unit: 'PSU' },
  { key: 'conductivity_us_cm', label: 'Conductivity', unit: 'µS/cm' },
  { key: 'dissolved_oxygen_mg_l', label: 'Dissolved oxygen', unit: 'mg/L' },
  { key: 'ph', label: 'pH', unit: '' },
  { key: 'turbidity_ntu', label: 'Turbidity', unit: 'NTU' },
  { key: 'heading_deg', label: 'Heading', unit: '°' },
  { key: 'pressure_dbar', label: 'Pressure', unit: 'dbar' }
];

const text = (value) => value === undefined || value === null ? '' : String(value).trim();
const number = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const validTime = (value) => {
  const ms = new Date(value || '').getTime();
  return Number.isFinite(ms) ? ms : null;
};

export function sensorMetric(metricKey = '') {
  return SENSOR_PROFILE_METRICS.find((metric) => metric.key === metricKey) || null;
}

export function sensorMetricLabel(metricKey = '') {
  const metric = sensorMetric(metricKey);
  return metric ? `${metric.label}${metric.unit ? ` (${metric.unit})` : ''}` : text(metricKey) || 'Sensor value';
}

export function readingTimeMs(row = {}, basis = 'mission_time') {
  const preferred = basis === 'sensor_clock'
    ? row.normalized_sensor_datetime_utc
    : (row.estimated_mission_datetime_utc || row.normalized_sensor_datetime_utc);
  return validTime(preferred);
}

export function readingTimeIso(row = {}, basis = 'mission_time') {
  const ms = readingTimeMs(row, basis);
  return ms === null ? '' : new Date(ms).toISOString();
}

export function readingsForStream(readings = [], streamId = '') {
  return (readings || []).filter((row) => String(row.sensor_stream_id || '') === String(streamId || ''));
}

export function availableSensorMetrics(readings = []) {
  return SENSOR_PROFILE_METRICS.filter((metric) => (readings || []).some((row) => number(row?.[metric.key]) !== null));
}

function evenlySample(rows = [], maxPoints = 900) {
  if (rows.length <= maxPoints) return rows;
  const out = [rows[0]];
  const stride = (rows.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i += 1) out.push(rows[Math.round(i * stride)]);
  out.push(rows[rows.length - 1]);
  return out;
}

export function buildSensorProfile(readings = [], metricKey = 'depth_m', options = {}) {
  const basis = options.timeBasis === 'sensor_clock' ? 'sensor_clock' : 'mission_time';
  const maxPoints = Math.max(20, Math.floor(Number(options.maxPoints) || 900));
  const metric = sensorMetric(metricKey) || sensorMetric('depth_m');
  const all = (readings || []).map((row) => ({ row, timeMs: readingTimeMs(row, basis), value: number(row?.[metric.key]) }))
    .filter((item) => item.timeMs !== null && item.value !== null)
    .sort((a, b) => a.timeMs - b.timeMs);
  const sampled = evenlySample(all, maxPoints);
  if (!all.length) return { basis, metric, points: [], allPoints: [], count: 0, sampledCount: 0, min: null, max: null, firstTime: '', lastTime: '', durationSeconds: null };
  const values = all.map((item) => item.value);
  const firstTime = all[0].timeMs;
  const lastTime = all[all.length - 1].timeMs;
  return {
    basis,
    metric,
    points: sampled,
    allPoints: all,
    count: all.length,
    sampledCount: sampled.length,
    min: Math.min(...values),
    max: Math.max(...values),
    firstTime: new Date(firstTime).toISOString(),
    lastTime: new Date(lastTime).toISOString(),
    durationSeconds: Math.max(0, Math.round((lastTime - firstTime) / 1000))
  };
}

export function profileChartGeometry(profile = {}, options = {}) {
  const width = Math.max(320, Number(options.width) || 920);
  const height = Math.max(180, Number(options.height) || 310);
  const pad = { left: 58, right: 22, top: 22, bottom: 43, ...(options.pad || {}) };
  const points = profile.points || [];
  if (!points.length) return { width, height, pad, path: '', points: [], yTicks: [], xTicks: [], empty: true, yMin: null, yMax: null };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const xMin = points[0].timeMs;
  const xMax = points[points.length - 1].timeMs;
  const rawMin = Number(profile.min);
  const rawMax = Number(profile.max);
  const spread = rawMax - rawMin;
  const extra = spread > 0 ? spread * 0.05 : Math.max(Math.abs(rawMin || 1) * 0.08, 1);
  const yMin = rawMin - extra;
  const yMax = rawMax + extra;
  const x = (timeMs) => xMax === xMin ? pad.left + plotWidth / 2 : pad.left + ((timeMs - xMin) / (xMax - xMin)) * plotWidth;
  const yNormal = (value) => pad.top + ((yMax - value) / (yMax - yMin)) * plotHeight;
  const yDepth = (value) => pad.top + ((value - yMin) / (yMax - yMin)) * plotHeight;
  const y = profile.metric?.invertY ? yDepth : yNormal;
  const chartPoints = points.map((item) => ({ ...item, x: x(item.timeMs), y: y(item.value) }));
  const path = chartPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const fraction = index / 4;
    const value = profile.metric?.invertY ? yMin + (yMax - yMin) * fraction : yMax - (yMax - yMin) * fraction;
    const yy = pad.top + plotHeight * fraction;
    return { value, y: yy };
  });
  const xTicks = Array.from({ length: 4 }, (_, index) => {
    const fraction = index / 3;
    const timeMs = xMin + (xMax - xMin) * fraction;
    return { timeMs, x: pad.left + plotWidth * fraction };
  });
  return { width, height, pad, plotWidth, plotHeight, path, points: chartPoints, yTicks, xTicks, empty: false, xMin, xMax, yMin, yMax };
}

export function nearestSensorReading(readings = [], targetTime = '', options = {}) {
  const basis = options.timeBasis === 'sensor_clock' ? 'sensor_clock' : 'mission_time';
  const toleranceSeconds = Math.max(0, Number(options.toleranceSeconds ?? 90));
  const targetMs = validTime(targetTime);
  if (targetMs === null) return { reading: null, deltaSeconds: null, withinTolerance: false };
  let best = null;
  (readings || []).forEach((row) => {
    const rowMs = readingTimeMs(row, basis);
    if (rowMs === null) return;
    const deltaSeconds = Math.abs(rowMs - targetMs) / 1000;
    if (!best || deltaSeconds < best.deltaSeconds) best = { reading: row, deltaSeconds, rowMs };
  });
  if (!best) return { reading: null, deltaSeconds: null, withinTolerance: false };
  return { ...best, deltaSeconds: Number(best.deltaSeconds.toFixed(3)), withinTolerance: best.deltaSeconds <= toleranceSeconds };
}

export function linkedVideoLogsForStream(videoLogs = [], stream = {}) {
  const operationId = text(stream.rov_operation_id);
  if (!operationId) return [];
  return (videoLogs || []).filter((log) => text(log.rov_operation_id) === operationId);
}

export function linkVideoLogsToSensorStream(videoLogs = [], stream = {}, readings = [], options = {}) {
  const logs = linkedVideoLogsForStream(videoLogs, stream);
  return logs.map((videoLog) => {
    const targetTime = videoLog.estimated_mission_datetime_utc || videoLog.video_log_datetime_utc || '';
    const nearest = nearestSensorReading(readings, targetTime, { timeBasis: 'mission_time', toleranceSeconds: options.toleranceSeconds ?? 90 });
    return {
      video_log: videoLog,
      target_mission_datetime_utc: targetTime,
      sensor_reading: nearest.reading,
      sensor_datetime_utc: readingTimeIso(nearest.reading || {}, 'mission_time'),
      delta_seconds: nearest.deltaSeconds,
      within_tolerance: nearest.withinTolerance,
      stream_id: stream.sensor_stream_id || ''
    };
  }).sort((a, b) => String(a.target_mission_datetime_utc).localeCompare(String(b.target_mission_datetime_utc)));
}

export function sensorSnapshot(reading = {}) {
  const fields = ['depth_m', 'temperature_c', 'salinity_psu', 'dissolved_oxygen_mg_l', 'turbidity_ntu', 'ph'];
  return Object.fromEntries(fields.map((field) => [field, number(reading?.[field])]));
}

export function profileSummary(profile = {}) {
  if (!profile?.count) return { reading_count: 0, metric: profile?.metric?.key || '', minimum: '', maximum: '', first_datetime_utc: '', last_datetime_utc: '', duration_seconds: '' };
  return {
    reading_count: profile.count,
    metric: profile.metric.key,
    minimum: profile.min,
    maximum: profile.max,
    first_datetime_utc: profile.firstTime,
    last_datetime_utc: profile.lastTime,
    duration_seconds: profile.durationSeconds
  };
}

export function videoSensorJoinRows(links = []) {
  return (links || []).map((link) => ({
    video_log_id: link.video_log?.video_log_id || '',
    rov_operation_id: link.video_log?.rov_operation_id || '',
    video_timecode: link.video_log?.video_timecode || '',
    video_elapsed_seconds: link.video_log?.video_elapsed_seconds || '',
    video_event_type: link.video_log?.event_type || '',
    video_event_description: link.video_log?.event_description || '',
    video_event_mission_datetime_utc: link.target_mission_datetime_utc || '',
    sensor_stream_id: link.stream_id || '',
    matched_sensor_reading_id: link.sensor_reading?.sensor_reading_id || '',
    matched_sensor_mission_datetime_utc: link.sensor_datetime_utc || '',
    time_delta_seconds: link.delta_seconds ?? '',
    within_tolerance: link.within_tolerance ? 'yes' : 'no',
    ...sensorSnapshot(link.sensor_reading || {})
  }));
}
