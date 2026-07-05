export const BASEMAP_VERSION = '0.1.0';
export const MAX_BASEMAP_BYTES = 35 * 1024 * 1024;

const num = (value) => Number(value);
const finite = (value) => Number.isFinite(num(value));
const text = (value) => String(value ?? '').trim();

export function validBbox(bounds = {}) {
  const minLon = num(bounds.min_lon ?? bounds.minLon);
  const minLat = num(bounds.min_lat ?? bounds.minLat);
  const maxLon = num(bounds.max_lon ?? bounds.maxLon);
  const maxLat = num(bounds.max_lat ?? bounds.maxLat);
  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) return false;
  return minLon >= -180 && minLon <= 180 && maxLon >= -180 && maxLon <= 180 && minLat >= -90 && minLat <= 90 && maxLat >= -90 && maxLat <= 90 && minLon < maxLon && minLat < maxLat;
}

export function bboxFromPack(pack = {}) {
  if (!validBbox(pack)) return null;
  return {
    minLon: num(pack.min_lon ?? pack.minLon),
    minLat: num(pack.min_lat ?? pack.minLat),
    maxLon: num(pack.max_lon ?? pack.maxLon),
    maxLat: num(pack.max_lat ?? pack.maxLat)
  };
}

export function validateBasemapInput(input = {}, file = null) {
  const errors = [];
  if (!text(input.name)) errors.push('Basemap pack name is required.');
  if (!text(input.source_name)) errors.push('Basemap source is required.');
  if (!text(input.source_date)) errors.push('Basemap source/capture date is required.');
  if (!validBbox(input)) errors.push('Map bounds must be valid WGS 84 coordinates with min longitude/latitude smaller than max longitude/latitude.');
  if (!file) errors.push('Choose a PNG, JPEG, or WebP map image to store offline.');
  if (file && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) errors.push('Basemap image must be PNG, JPEG, or WebP.');
  if (file && file.size > MAX_BASEMAP_BYTES) errors.push(`Basemap image is too large (${Math.round(file.size / 1024 / 1024)} MB). Keep a pack under ${Math.round(MAX_BASEMAP_BYTES / 1024 / 1024)} MB for reliable field storage.`);
  return errors;
}

export function aspectRatioWarning(bounds, imageWidth, imageHeight) {
  if (!validBbox(bounds) || !finite(imageWidth) || !finite(imageHeight) || num(imageWidth) <= 0 || num(imageHeight) <= 0) return '';
  const box = bboxFromPack(bounds);
  const midLat = (box.minLat + box.maxLat) / 2;
  const geographicRatio = ((box.maxLon - box.minLon) * Math.max(0.2, Math.cos(midLat * Math.PI / 180))) / (box.maxLat - box.minLat);
  const imageRatio = num(imageWidth) / num(imageHeight);
  const relativeDifference = Math.abs(imageRatio - geographicRatio) / Math.max(geographicRatio, 0.0001);
  if (relativeDifference > 0.18) return 'Image proportions differ noticeably from the entered geographic bounds. Recheck the bounds before relying on this map for navigation.';
  return '';
}

export function publicBasemapMetadata(pack = {}) {
  return {
    app_module: 'EcoSurvey offline basemap pack',
    basemap_version: BASEMAP_VERSION,
    id: pack.id || '', survey_id: pack.surveyId || '', name: pack.name || '', source_name: pack.source_name || '',
    source_date: pack.source_date || '', attribution_or_license: pack.attribution_or_license || '',
    original_filename: pack.original_filename || '', image_mime: pack.image_mime || '', image_bytes: pack.image_bytes || 0,
    image_width: pack.image_width || '', image_height: pack.image_height || '', min_lon: pack.min_lon, min_lat: pack.min_lat,
    max_lon: pack.max_lon, max_lat: pack.max_lat, notes: pack.notes || '', created_at: pack.createdAt || '', updated_at: pack.updatedAt || ''
  };
}
