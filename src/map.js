import { makeTables, buildQgisLayers } from './qaqc.js';
import { bboxFromPack } from './basemap.js';

export const MAP_LAYERS = [
  { key: 'sites', filename: 'sites.geojson', label: 'Site', kind: 'point', color: '#6941c6' },
  { key: 'stations', filename: 'stations.geojson', label: 'Stations', kind: 'point', color: '#0b6e75' },
  { key: 'tracks', filename: 'tracks.geojson', label: 'GPS tracks', kind: 'line', color: '#2463a6' },
  { key: 'transects', filename: 'transects.geojson', label: 'Transects', kind: 'line', color: '#b54708' },
  { key: 'observations', filename: 'observations.geojson', label: 'Observations', kind: 'point', color: '#1a7f37' },
  { key: 'environment', filename: 'environment.geojson', label: 'Environment', kind: 'point', color: '#126f9a' },
  { key: 'media', filename: 'media.geojson', label: 'Media', kind: 'point', color: '#b42375' }
];

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;' }[ch]));
const text = (value) => value === undefined || value === null ? '' : String(value).trim();
const n = (value) => Number(value);
const usablePoint = (geometry) => geometry?.type === 'Point' && Array.isArray(geometry.coordinates) && Number.isFinite(n(geometry.coordinates[0])) && Number.isFinite(n(geometry.coordinates[1]));
const usableLine = (geometry) => geometry?.type === 'LineString' && Array.isArray(geometry.coordinates) && geometry.coordinates.every((point) => Array.isArray(point) && Number.isFinite(n(point[0])) && Number.isFinite(n(point[1])));
const featureId = (layer, properties = {}, index = 0) => {
  const fields = { sites: 'site_id', stations: 'station_id', tracks: 'track_id', transects: 'transect_id', observations: 'observation_id', environment: 'env_record_id', media: 'media_id' };
  return text(properties[fields[layer]]) || `${layer}-${index + 1}`;
};

function labelFor(layer, properties = {}) {
  if (layer === 'sites') return text(properties.site_name) || text(properties.site_id) || 'Site';
  if (layer === 'stations') return text(properties.station_id) || 'Station';
  if (layer === 'tracks') return text(properties.track_id) || 'GPS track';
  if (layer === 'transects') return text(properties.transect_id) || 'Transect';
  if (layer === 'observations') return text(properties.common_name) || text(properties.taxon_scientific_name) || text(properties.observation_id) || 'Observation';
  if (layer === 'environment') return text(properties.env_record_id) || 'Environmental record';
  if (layer === 'media') return text(properties.file_name) || text(properties.file_name_manual) || text(properties.media_id) || 'Media record';
  return 'Map record';
}

function tableForLayer(layer) {
  return layer === 'sites' ? 'site' : layer;
}

export function mapLayersForSurvey(survey, recordsByTable) {
  const tables = makeTables(survey, recordsByTable);
  return { tables, layers: buildQgisLayers(tables) };
}

export function buildMapModel(survey, recordsByTable) {
  const { tables, layers } = mapLayersForSurvey(survey, recordsByTable);
  const features = [];
  MAP_LAYERS.forEach((definition) => {
    const collection = layers[definition.filename] || { features: [] };
    (collection.features || []).forEach((feature, index) => {
      const id = featureId(definition.key, feature.properties, index);
      features.push({
        ...feature,
        key: `${definition.key}:${id}:${index}`,
        id,
        layer: definition.key,
        table: tableForLayer(definition.key),
        label: labelFor(definition.key, feature.properties),
        color: definition.color,
        kind: definition.kind
      });
    });
  });
  const expected = {
    sites: tables.root?.length || 0,
    stations: tables.stations?.length || 0,
    tracks: tables.tracks?.length || 0,
    transects: tables.transects?.length || 0,
    observations: tables.observations?.length || 0,
    environment: tables.environment?.length || 0,
    media: tables.media?.length || 0
  };
  const shown = Object.fromEntries(MAP_LAYERS.map((definition) => [definition.key, features.filter((feature) => feature.layer === definition.key).length]));
  const notLocated = Object.fromEntries(MAP_LAYERS.map((definition) => [definition.key, Math.max(0, (expected[definition.key] || 0) - (shown[definition.key] || 0))]));
  return { layers, tables, features, expected, shown, notLocated };
}

function degreeStep(span) {
  const raw = Math.max(span / 5, 0.000001);
  const power = 10 ** Math.floor(Math.log10(raw));
  const scaled = raw / power;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * power;
}

function getCoords(features, currentLocation, basemap = null) {
  const coords = [];
  features.forEach((feature) => {
    if (usablePoint(feature.geometry)) coords.push({ lon: n(feature.geometry.coordinates[0]), lat: n(feature.geometry.coordinates[1]) });
    if (usableLine(feature.geometry)) feature.geometry.coordinates.forEach((point) => coords.push({ lon: n(point[0]), lat: n(point[1]) }));
  });
  if (currentLocation && Number.isFinite(n(currentLocation.lon)) && Number.isFinite(n(currentLocation.lat))) coords.push({ lon: n(currentLocation.lon), lat: n(currentLocation.lat) });
  const bounds = bboxFromPack(basemap || {});
  if (bounds) { coords.push({ lon: bounds.minLon, lat: bounds.minLat }, { lon: bounds.maxLon, lat: bounds.maxLat }); }
  return coords;
}

export function mapScene(features, currentLocation = null, basemap = null) {
  const width = 980; const height = 560; const pad = 66;
  const coords = getCoords(features, currentLocation, basemap);
  if (!coords.length) return { width, height, pad, empty: true, minLon: 0, maxLon: 1, minLat: 0, maxLat: 1, project: () => ({ x: width / 2, y: height / 2 }), unproject: () => ({ lon: 0, lat: 0 }), grid: [] };
  const latCenter = coords.reduce((sum, point) => sum + point.lat, 0) / coords.length;
  const cosLat = Math.max(0.2, Math.cos(latCenter * Math.PI / 180));
  const xs = coords.map((point) => point.lon * cosLat); const ys = coords.map((point) => point.lat);
  let minX = Math.min(...xs); let maxX = Math.max(...xs); let minY = Math.min(...ys); let maxY = Math.max(...ys);
  let xSpan = maxX - minX; let ySpan = maxY - minY;
  if (xSpan < 0.00008) { minX -= 0.00004; maxX += 0.00004; xSpan = maxX - minX; }
  if (ySpan < 0.00008) { minY -= 0.00004; maxY += 0.00004; ySpan = maxY - minY; }
  const margin = 0.14;
  minX -= xSpan * margin; maxX += xSpan * margin; minY -= ySpan * margin; maxY += ySpan * margin;
  xSpan = maxX - minX; ySpan = maxY - minY;
  const availableWidth = width - (pad * 2); const availableHeight = height - (pad * 2);
  const scale = Math.min(availableWidth / xSpan, availableHeight / ySpan);
  const usedWidth = xSpan * scale; const usedHeight = ySpan * scale;
  const xOffset = pad + (availableWidth - usedWidth) / 2; const yOffset = pad + (availableHeight - usedHeight) / 2;
  const project = (lon, lat) => ({ x: xOffset + ((lon * cosLat) - minX) * scale, y: height - (yOffset + (lat - minY) * scale) });
  const unproject = (x, y) => ({ lon: (((x - xOffset) / scale) + minX) / cosLat, lat: ((height - y - yOffset) / scale) + minY });
  const minLon = minX / cosLat; const maxLon = maxX / cosLat; const minLat = minY; const maxLat = maxY;
  const lonStep = degreeStep(maxLon - minLon); const latStep = degreeStep(maxLat - minLat);
  const grid = [];
  let firstLon = Math.ceil(minLon / lonStep) * lonStep;
  for (let lon = firstLon; lon <= maxLon + lonStep * 0.01; lon += lonStep) grid.push({ type: 'lon', value: lon, a: project(lon, minLat), b: project(lon, maxLat) });
  let firstLat = Math.ceil(minLat / latStep) * latStep;
  for (let lat = firstLat; lat <= maxLat + latStep * 0.01; lat += latStep) grid.push({ type: 'lat', value: lat, a: project(minLon, lat), b: project(maxLon, lat) });
  const mapWidthMeters = xSpan * 111320;
  const scaleTarget = mapWidthMeters / 4;
  const scaleChoices = [1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,20000,50000];
  const scaleMeters = scaleChoices.reduce((best, candidate) => Math.abs(candidate - scaleTarget) < Math.abs(best - scaleTarget) ? candidate : best, scaleChoices[0]);
  return { width, height, pad, empty: false, minLon, maxLon, minLat, maxLat, project, unproject, grid, cosLat, mapWidthMeters, scaleMeters, scalePixel: (scaleMeters / 111320) * scale };
}

function featureMarker(feature, scene, index, selectedKey) {
  const selected = feature.key === selectedKey;
  const attrs = `data-action="select-map-feature" data-map-key="${esc(feature.key)}" role="button" tabindex="0" aria-label="Open ${esc(feature.label)}"`;
  if (feature.kind === 'line' && usableLine(feature.geometry)) {
    const points = feature.geometry.coordinates.map(([lon, lat]) => { const p = scene.project(n(lon), n(lat)); return `${p.x.toFixed(2)},${p.y.toFixed(2)}`; }).join(' ');
    return `<polyline ${attrs} class="map-feature map-line ${selected ? 'selected' : ''}" points="${points}" stroke="${feature.color}"/>`;
  }
  if (!usablePoint(feature.geometry)) return '';
  const [lon, lat] = feature.geometry.coordinates; const p = scene.project(n(lon), n(lat));
  const offset = feature.layer === 'observations' ? ((index % 3) - 1) * 4 : feature.layer === 'environment' ? ((index % 2) ? 4 : -4) : feature.layer === 'media' ? ((index % 3) - 1) * 6 : 0;
  const shape = feature.layer === 'sites' ? `<rect x="${(p.x - 7).toFixed(2)}" y="${(p.y - 7).toFixed(2)}" width="14" height="14" rx="3"/>` : feature.layer === 'stations' ? `<path d="M ${p.x} ${p.y-8} L ${p.x+8} ${p.y} L ${p.x} ${p.y+8} L ${p.x-8} ${p.y} Z"/>` : `<circle cx="${p.x.toFixed(2)}" cy="${(p.y + offset).toFixed(2)}" r="${selected ? 7 : 5.4}"/>`;
  return `<g ${attrs} class="map-feature map-point ${feature.layer} ${selected ? 'selected' : ''}" fill="${feature.color}">${shape}</g>`;
}

export function renderMapSvg(features, currentLocation, selectedKey, basemap = null, transectDraft = null) {
  const scene = mapScene(features, currentLocation, basemap);
  if (scene.empty) return `<div class="map-empty"><strong>No mapped geometry yet.</strong><br>Capture site or station GPS coordinates, or add a transect start/end, then return here.</div>`;
  const grid = scene.grid.map((line) => `<line class="map-grid-line" x1="${line.a.x.toFixed(2)}" y1="${line.a.y.toFixed(2)}" x2="${line.b.x.toFixed(2)}" y2="${line.b.y.toFixed(2)}"/>`).join('');
  const labels = scene.grid.map((line) => line.type === 'lon' ? `<text class="map-grid-label" x="${line.a.x.toFixed(2)}" y="${(scene.height-16).toFixed(2)}">${line.value.toFixed(5)}°</text>` : `<text class="map-grid-label" x="10" y="${line.a.y.toFixed(2)}">${line.value.toFixed(5)}°</text>`).join('');
  const basemapBounds = bboxFromPack(basemap || {});
  let basemapImage = '';
  if (basemapBounds && basemap?.image_url) {
    const nw = scene.project(basemapBounds.minLon, basemapBounds.maxLat); const se = scene.project(basemapBounds.maxLon, basemapBounds.minLat);
    const x = Math.min(nw.x, se.x); const y = Math.min(nw.y, se.y); const width = Math.abs(se.x - nw.x); const height = Math.abs(se.y - nw.y);
    basemapImage = `<image class="map-basemap-image" href="${esc(basemap.image_url)}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" preserveAspectRatio="none" opacity="${Number.isFinite(Number(basemap.opacity)) ? Number(basemap.opacity) : 0.72}"/>`;
  }
  const geometries = features.map((feature, index) => featureMarker(feature, scene, index, selectedKey)).join('');
  let draftOverlay = '';
  if (transectDraft?.start) { const a = scene.project(Number(transectDraft.start.lon), Number(transectDraft.start.lat)); const b = transectDraft?.end ? scene.project(Number(transectDraft.end.lon), Number(transectDraft.end.lat)) : null; draftOverlay = `<g class="map-transect-draft"><circle cx="${a.x.toFixed(2)}" cy="${a.y.toFixed(2)}" r="8"/>${b ? `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}"/><circle cx="${b.x.toFixed(2)}" cy="${b.y.toFixed(2)}" r="8"/>` : ''}</g>`; }
  let deviceMarker = '';
  if (currentLocation && Number.isFinite(n(currentLocation.lon)) && Number.isFinite(n(currentLocation.lat))) {
    const p = scene.project(n(currentLocation.lon), n(currentLocation.lat));
    deviceMarker = `<g class="map-device-location" aria-label="Current device location"><circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="11"/><circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="5"/></g>`;
  }
  const scaleText = scene.scaleMeters >= 1000 ? `${(scene.scaleMeters / 1000).toFixed(scene.scaleMeters % 1000 ? 1 : 0)} km` : `${scene.scaleMeters} m`;
  return `<div class="map-frame"><svg id="mission-map" class="mission-map" viewBox="0 0 ${scene.width} ${scene.height}" aria-label="EcoSurvey mission map" role="img"><rect class="map-water" x="0" y="0" width="${scene.width}" height="${scene.height}" rx="16"/>${basemapImage}${grid}${labels}<g class="map-features">${geometries}${draftOverlay}${deviceMarker}</g><g class="map-scale"><line x1="${scene.pad}" y1="${scene.height - 34}" x2="${scene.pad + scene.scalePixel}" y2="${scene.height - 34}"/><line x1="${scene.pad}" y1="${scene.height - 39}" x2="${scene.pad}" y2="${scene.height - 29}"/><line x1="${scene.pad + scene.scalePixel}" y1="${scene.height - 39}" x2="${scene.pad + scene.scalePixel}" y2="${scene.height - 29}"/><text x="${scene.pad}" y="${scene.height - 43}">${scaleText}</text></g><text class="map-north" x="${scene.width - 38}" y="50">N</text><path class="map-north-arrow" d="M ${scene.width-38} 58 L ${scene.width-44} 76 L ${scene.width-38} 70 L ${scene.width-32} 76 Z"/></svg><div class="map-attribution">${basemapBounds ? `Offline basemap: ${esc(basemap?.name || 'unnamed pack')} · ${esc(basemap?.source_name || 'source not recorded')} · ${esc(basemap?.source_date || 'date not recorded')}` : 'Offline mission geometry · WGS 84 latitude/longitude · no basemap'}</div></div>`;
}

export function selectedFeatureSummary(feature) {
  if (!feature) return null;
  const p = feature.properties || {};
  const coordinates = usablePoint(feature.geometry) ? `${Number(feature.geometry.coordinates[1]).toFixed(6)}, ${Number(feature.geometry.coordinates[0]).toFixed(6)}` : usableLine(feature.geometry) ? `${feature.geometry.coordinates.length} vertices` : 'No geometry';
  const extra = feature.layer === 'tracks' ? `${text(p.track_type) || 'GPS'} · ${text(p.distance_m) || '—'} m · ${text(p.point_count) || '—'} points` : feature.layer === 'stations' ? `${text(p.primary_habitat) || 'Habitat not recorded'} · ${text(p.depth_m) || '—'} m depth` : feature.layer === 'transects' ? `${text(p.length_m) || '—'} m · ${text(p.bearing_deg) || '—'}°` : feature.layer === 'observations' ? `${text(p.count) || '—'} observed · ${text(p.identification_confidence) || 'confidence not recorded'}` : feature.layer === 'environment' ? `${text(p.temperature_c) || '—'} °C · ${text(p.salinity_psu) || '—'} PSU` : feature.layer === 'media' ? `${text(p.media_type) || 'media'} · ${text(p.camera_or_sensor_id) || 'sensor not recorded'}` : text(p.dominant_habitat) || 'Site';
  return { title: feature.label, id: feature.id, table: feature.table, layer: feature.layer, coordinates, coordinateSource: text(p.coordinate_source) || 'unknown', extra, properties: p };
}
