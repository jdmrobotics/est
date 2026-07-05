/**
 * Offline GPS utilities for EcoSurvey v0.6.
 * Points are kept in WGS 84 [lon, lat] order for GeoJSON, with optional time and accuracy.
 */
const R = 6371008.8;
const toRad = (value) => Number(value) * Math.PI / 180;
const toDeg = (value) => Number(value) * 180 / Math.PI;
const n = (value) => Number(value);

export function validTrackPoint(point) {
  return Number.isFinite(n(point?.lat)) && Number.isFinite(n(point?.lon)) && n(point.lat) >= -90 && n(point.lat) <= 90 && n(point.lon) >= -180 && n(point.lon) <= 180;
}

export function normalizeTrackPoint(point = {}) {
  if (!validTrackPoint(point)) return null;
  const accuracy = Number.isFinite(n(point.accuracy)) ? Math.max(0, n(point.accuracy)) : null;
  const timestamp = point.timestamp || new Date().toISOString();
  return { lat: n(point.lat), lon: n(point.lon), accuracy, timestamp };
}

export function metersBetween(a, b) {
  if (!validTrackPoint(a) || !validTrackPoint(b)) return 0;
  const dLat = toRad(n(b.lat) - n(a.lat));
  const dLon = toRad(n(b.lon) - n(a.lon));
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(n(a.lat))) * Math.cos(toRad(n(b.lat))) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

/** Initial compass bearing, degrees true, normalized 0–360. */
export function bearingDegrees(a, b) {
  if (!validTrackPoint(a) || !validTrackPoint(b)) return null;
  const y = Math.sin(toRad(n(b.lon) - n(a.lon))) * Math.cos(toRad(n(b.lat)));
  const x = Math.cos(toRad(n(a.lat))) * Math.sin(toRad(n(b.lat))) - Math.sin(toRad(n(a.lat))) * Math.cos(toRad(n(b.lat))) * Math.cos(toRad(n(b.lon) - n(a.lon)));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function trackDistance(points = []) {
  return points.reduce((total, point, index) => index ? total + metersBetween(points[index - 1], point) : total, 0);
}

export function summarizeTrack(points = []) {
  const valid = points.map(normalizeTrackPoint).filter(Boolean);
  const distance_m = trackDistance(valid);
  const first = valid[0] || null; const last = valid.at(-1) || null;
  const start = first?.timestamp ? new Date(first.timestamp) : null;
  const end = last?.timestamp ? new Date(last.timestamp) : null;
  const duration_seconds = start && end && !Number.isNaN(start) && !Number.isNaN(end) ? Math.max(0, Math.round((end - start) / 1000)) : 0;
  const accuracies = valid.map((point) => point.accuracy).filter(Number.isFinite);
  const average_accuracy_m = accuracies.length ? accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length : null;
  return { point_count: valid.length, distance_m, duration_seconds, average_accuracy_m, first, last };
}

/**
 * Adds a location only when it is not a likely duplicate. Short recordings can be noisy;
 * use both a time gate and a movement gate to avoid an oversized, jitter-heavy track.
 */
export function appendTrackPoint(points = [], candidate, { minSeconds = 3, minMeters = 2 } = {}) {
  const point = normalizeTrackPoint(candidate);
  if (!point) return { points: [...points], added: false, reason: 'invalid_coordinate' };
  const prior = points.at(-1);
  if (!prior) return { points: [point], added: true, reason: 'first_point' };
  const priorPoint = normalizeTrackPoint(prior);
  const seconds = priorPoint?.timestamp ? Math.max(0, (new Date(point.timestamp) - new Date(priorPoint.timestamp)) / 1000) : Infinity;
  const meters = metersBetween(priorPoint, point);
  if (seconds < minSeconds && meters < minMeters) return { points: [...points], added: false, reason: 'too_soon_and_near', seconds, meters };
  return { points: [...points, point], added: true, reason: 'accepted', seconds, meters };
}

export function geoJsonLine(points = []) {
  const normalized = points.map(normalizeTrackPoint).filter(Boolean);
  return normalized.length >= 2 ? { type: 'LineString', coordinates: normalized.map((point) => [point.lon, point.lat]) } : null;
}

export function transectFromEndpoints(start, end) {
  const a = normalizeTrackPoint(start); const b = normalizeTrackPoint(end);
  if (!a || !b) return null;
  const length_m = metersBetween(a, b);
  if (length_m < 0.01) return null;
  return { start: a, end: b, length_m, bearing_deg: bearingDegrees(a, b) };
}
