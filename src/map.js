import { makeTables, buildQgisLayers } from './qaqc.js';
import { bboxFromPack } from './basemap.js';

export const WORLD_REFERENCE_META = {
  name: 'Natural Earth global reference',
  source: 'Natural Earth 1:110m Admin 0 countries',
  license: 'Public domain',
  crs: 'EPSG:4326 / WGS 84',
  asset: './assets/world-reference-ne110.geojson'
};

/** Load the bundled global reference layer. It is cached by the service worker for offline use. */
export async function loadWorldReference() {
  const response = await fetch(new URL('../assets/world-reference-ne110.geojson', import.meta.url));
  if (!response.ok) throw new Error(`World reference unavailable (${response.status}).`);
  const json = await response.json();
  if (json?.type !== 'FeatureCollection' || !Array.isArray(json.features)) throw new Error('World reference asset is not a GeoJSON FeatureCollection.');
  return json;
}

export const MAP_LAYERS = [
  { key: 'sites', filename: 'sites.geojson', label: 'Site', kind: 'point', color: '#6941c6' },
  { key: 'stations', filename: 'stations.geojson', label: 'Stations', kind: 'point', color: '#0b6e75' },
  { key: 'tracks', filename: 'tracks.geojson', label: 'GPS tracks', kind: 'line', color: '#2463a6' },
  { key: 'rov_operations', filename: 'rov_operations.geojson', label: 'ROV operations', kind: 'point', color: '#6b4f1d' },
  { key: 'video_logs', filename: 'video_logs.geojson', label: 'ROV video logs', kind: 'point', color: '#c2410c' },
  { key: 'sensor_readings', filename: 'sensor_readings.geojson', label: 'Sensor readings', kind: 'point', color: '#2563eb' },
  { key: 'transects', filename: 'transects.geojson', label: 'Transects', kind: 'line', color: '#b54708' },
  { key: 'observations', filename: 'observations.geojson', label: 'Observations', kind: 'point', color: '#1a7f37' },
  { key: 'environment', filename: 'environment.geojson', label: 'Environment', kind: 'point', color: '#126f9a' },
  { key: 'samples', filename: 'samples.geojson', label: 'Samples', kind: 'point', color: '#7a4f01' },
  { key: 'media', filename: 'media.geojson', label: 'Media', kind: 'point', color: '#b42375' }
];

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;' }[ch]));
const text = (value) => value === undefined || value === null ? '' : String(value).trim();
const n = (value) => Number(value);
const usablePoint = (geometry) => geometry?.type === 'Point' && Array.isArray(geometry.coordinates) && Number.isFinite(n(geometry.coordinates[0])) && Number.isFinite(n(geometry.coordinates[1]));
const usableLine = (geometry) => geometry?.type === 'LineString' && Array.isArray(geometry.coordinates) && geometry.coordinates.every((point) => Array.isArray(point) && Number.isFinite(n(point[0])) && Number.isFinite(n(point[1])));
const featureId = (layer, properties = {}, index = 0) => {
  const fields = { sites: 'site_id', stations: 'station_id', tracks: 'track_id', rov_operations: 'rov_operation_id', video_logs: 'video_log_id', sensor_readings: 'sensor_reading_id', transects: 'transect_id', observations: 'observation_id', environment: 'env_record_id', samples: 'sample_id', media: 'media_id' };
  return text(properties[fields[layer]]) || `${layer}-${index + 1}`;
};

function labelFor(layer, properties = {}) {
  if (layer === 'sites') return text(properties.site_name) || text(properties.site_id) || 'Site';
  if (layer === 'stations') return text(properties.station_id) || 'Station';
  if (layer === 'tracks') return text(properties.track_id) || 'GPS track';
  if (layer === 'rov_operations') return text(properties.operation_name) || text(properties.rov_operation_id) || 'ROV operation';
  if (layer === 'video_logs') return `${text(properties.video_timecode) || 'Video event'} · ${text(properties.event_type) || text(properties.video_log_id) || 'ROV video log'}`;
  if (layer === 'sensor_readings') return `${text(properties.sensor_stream_id) || 'Sensor'} · ${text(properties.normalized_sensor_datetime_utc) || text(properties.sensor_reading_id) || 'reading'}`;
  if (layer === 'transects') return text(properties.transect_id) || 'Transect';
  if (layer === 'observations') return text(properties.common_name) || text(properties.taxon_scientific_name) || text(properties.observation_id) || 'Observation';
  if (layer === 'environment') return text(properties.env_record_id) || 'Environmental record';
  if (layer === 'samples') return text(properties.sample_label) || text(properties.sample_id) || 'Sample';
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
    const source = collection.features || [];
    // Rendering tens of thousands of logger points in SVG can freeze a field phone.
    // The on-device map uses an evenly sampled preview; QGIS export still includes every reading.
    const maxPreview = definition.key === 'sensor_readings' ? 1000 : Infinity;
    const stride = source.length > maxPreview ? Math.ceil(source.length / maxPreview) : 1;
    source.filter((_, index) => index % stride === 0).forEach((feature, index) => {
      const id = featureId(definition.key, feature.properties, index);
      features.push({
        ...feature,
        properties: stride > 1 ? { ...feature.properties, map_preview_sampled: true, map_preview_stride: stride } : feature.properties,
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
    rov_operations: tables.rov_operations?.length || 0,
    video_logs: tables.video_logs?.length || 0,
    sensor_readings: tables.sensor_readings?.length || 0,
    transects: tables.transects?.length || 0,
    observations: tables.observations?.length || 0,
    environment: tables.environment?.length || 0,
    samples: tables.samples?.length || 0,
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

export function mapScene(features, currentLocation = null, basemap = null, options = {}) {
  const width = 980; const height = 560; const pad = 66;
  const worldView = options?.worldView === true;
  const coords = worldView ? [{ lon: -180, lat: -60 }, { lon: 180, lat: 85 }] : getCoords(features, currentLocation, basemap);
  if (!coords.length) return { width, height, pad, empty: true, minLon: 0, maxLon: 1, minLat: 0, maxLat: 1, project: () => ({ x: width / 2, y: height / 2 }), unproject: () => ({ lon: 0, lat: 0 }), grid: [], worldView };
  const latCenter = worldView ? 0 : coords.reduce((sum, point) => sum + point.lat, 0) / coords.length;
  const cosLat = worldView ? 1 : Math.max(0.2, Math.cos(latCenter * Math.PI / 180));
  const xs = coords.map((point) => point.lon * cosLat); const ys = coords.map((point) => point.lat);
  let minX = Math.min(...xs); let maxX = Math.max(...xs); let minY = Math.min(...ys); let maxY = Math.max(...ys);
  let xSpan = maxX - minX; let ySpan = maxY - minY;
  if (xSpan < 0.00008) { minX -= 0.00004; maxX += 0.00004; xSpan = maxX - minX; }
  if (ySpan < 0.00008) { minY -= 0.00004; maxY += 0.00004; ySpan = maxY - minY; }
  const margin = worldView ? 0.025 : 0.14;
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
  return { width, height, pad, empty: false, minLon, maxLon, minLat, maxLat, project, unproject, grid, cosLat, mapWidthMeters, scaleMeters, scalePixel: (scaleMeters / 111320) * scale, worldView };
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
  const offset = feature.layer === 'observations' ? ((index % 3) - 1) * 4 : feature.layer === 'video_logs' ? ((index % 3) - 1) * 7 : feature.layer === 'environment' ? ((index % 2) ? 4 : -4) : feature.layer === 'samples' ? ((index % 3) - 1) * 5 : feature.layer === 'media' ? ((index % 3) - 1) * 6 : 0;
  const shape = feature.layer === 'sites' ? `<rect x="${(p.x - 7).toFixed(2)}" y="${(p.y - 7).toFixed(2)}" width="14" height="14" rx="3"/>` : feature.layer === 'stations' ? `<path d="M ${p.x} ${p.y-8} L ${p.x+8} ${p.y} L ${p.x} ${p.y+8} L ${p.x-8} ${p.y} Z"/>` : `<circle cx="${p.x.toFixed(2)}" cy="${(p.y + offset).toFixed(2)}" r="${selected ? 7 : 5.4}"/>`;
  return `<g ${attrs} class="map-feature map-point ${feature.layer} ${selected ? 'selected' : ''}" fill="${feature.color}">${shape}</g>`;
}

function geometryRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates || [];
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat();
  return [];
}
function ringIntersectsScene(ring, scene) {
  const xs = ring.map((point) => Number(point?.[0])); const ys = ring.map((point) => Number(point?.[1]));
  if (!xs.length || !xs.every(Number.isFinite) || !ys.every(Number.isFinite)) return false;
  return !(Math.max(...xs) < scene.minLon || Math.min(...xs) > scene.maxLon || Math.max(...ys) < scene.minLat || Math.min(...ys) > scene.maxLat);
}
function referencePath(ring, scene) {
  if (!ringIntersectsScene(ring, scene)) return '';
  // Avoid obvious world-spanning lines across the antimeridian in this lightweight renderer.
  if (ring.some((point, index) => index && Math.abs(Number(point[0]) - Number(ring[index - 1][0])) > 180)) return '';
  const points = ring.map(([lon, lat]) => scene.project(Number(lon), Number(lat)));
  if (!points.length) return '';
  return `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')} Z`;
}
function worldReferenceSvg(worldReference, scene) {
  if (!worldReference?.features?.length) return '';
  const paths = worldReference.features.flatMap((feature) => geometryRings(feature.geometry).map((ring) => referencePath(ring, scene)).filter(Boolean));
  return paths.length ? `<g class="map-world-reference" aria-label="Global Earth reference layer">${paths.map((d) => `<path d="${d}"/>`).join('')}</g>` : '';
}

export function renderMapSvg(features, currentLocation, selectedKey, basemap = null, transectDraft = null, options = {}) {
  const scene = mapScene(features, currentLocation, basemap, options);
  if (scene.empty) return `<div class="map-empty"><strong>No mapped geometry yet.</strong><br>Capture site or station GPS coordinates, or add a transect start/end, then return here.</div>`;
  const grid = scene.grid.map((line) => `<line class="map-grid-line" x1="${line.a.x.toFixed(2)}" y1="${line.a.y.toFixed(2)}" x2="${line.b.x.toFixed(2)}" y2="${line.b.y.toFixed(2)}"/>`).join('');
  const labelDigits = scene.worldView ? 0 : 5;
  const labels = scene.grid.map((line) => line.type === 'lon' ? `<text class="map-grid-label" x="${line.a.x.toFixed(2)}" y="${(scene.height-16).toFixed(2)}">${line.value.toFixed(labelDigits)}°</text>` : `<text class="map-grid-label" x="10" y="${line.a.y.toFixed(2)}">${line.value.toFixed(labelDigits)}°</text>`).join('');
  const basemapBounds = bboxFromPack(basemap || {});
  let basemapImage = '';
  if (basemapBounds && basemap?.image_url) {
    const nw = scene.project(basemapBounds.minLon, basemapBounds.maxLat); const se = scene.project(basemapBounds.maxLon, basemapBounds.minLat);
    const x = Math.min(nw.x, se.x); const y = Math.min(nw.y, se.y); const width = Math.abs(se.x - nw.x); const height = Math.abs(se.y - nw.y);
    basemapImage = `<image class="map-basemap-image" href="${esc(basemap.image_url)}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" preserveAspectRatio="none" opacity="${Number.isFinite(Number(basemap.opacity)) ? Number(basemap.opacity) : 0.72}"/>`;
  }
  const worldLayer = options?.worldReferenceVisible !== false ? worldReferenceSvg(options?.worldReference, scene) : '';
  const geometries = features.map((feature, index) => featureMarker(feature, scene, index, selectedKey)).join('');
  let draftOverlay = '';
  if (transectDraft?.start) { const a = scene.project(Number(transectDraft.start.lon), Number(transectDraft.start.lat)); const b = transectDraft?.end ? scene.project(Number(transectDraft.end.lon), Number(transectDraft.end.lat)) : null; draftOverlay = `<g class="map-transect-draft"><circle cx="${a.x.toFixed(2)}" cy="${a.y.toFixed(2)}" r="8"/>${b ? `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}"/><circle cx="${b.x.toFixed(2)}" cy="${b.y.toFixed(2)}" r="8"/>` : ''}</g>`; }
  let deviceMarker = '';
  if (currentLocation && Number.isFinite(n(currentLocation.lon)) && Number.isFinite(n(currentLocation.lat))) {
    const p = scene.project(n(currentLocation.lon), n(currentLocation.lat));
    deviceMarker = `<g class="map-device-location" aria-label="Current device location"><circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="11"/><circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="5"/></g>`;
  }
  const scaleText = scene.scaleMeters >= 1000 ? `${(scene.scaleMeters / 1000).toFixed(scene.scaleMeters % 1000 ? 1 : 0)} km` : `${scene.scaleMeters} m`;
  const attribution = `${options?.worldReferenceVisible !== false && options?.worldReference ? 'Global Earth reference: Natural Earth 1:110m countries (public domain) · ' : ''}${basemapBounds ? `Offline basemap: ${esc(basemap?.name || 'unnamed pack')} · ${esc(basemap?.source_name || 'source not recorded')} · ${esc(basemap?.source_date || 'date not recorded')}` : 'Offline mission geometry · WGS 84 latitude/longitude'}`;
  return `<div class="map-frame"><svg id="mission-map" class="mission-map" viewBox="0 0 ${scene.width} ${scene.height}" aria-label="EcoSurvey mission map" role="img"><rect class="map-water" x="0" y="0" width="${scene.width}" height="${scene.height}" rx="16"/>${worldLayer}${basemapImage}${grid}${labels}<g class="map-features">${geometries}${draftOverlay}${deviceMarker}</g><g class="map-scale"><line x1="${scene.pad}" y1="${scene.height - 34}" x2="${scene.pad + scene.scalePixel}" y2="${scene.height - 34}"/><line x1="${scene.pad}" y1="${scene.height - 39}" x2="${scene.pad}" y2="${scene.height - 29}"/><line x1="${scene.pad + scene.scalePixel}" y1="${scene.height - 39}" x2="${scene.pad + scene.scalePixel}" y2="${scene.height - 29}"/><text x="${scene.pad}" y="${scene.height - 43}">${scaleText}</text></g><text class="map-north" x="${scene.width - 38}" y="50">N</text><path class="map-north-arrow" d="M ${scene.width-38} 58 L ${scene.width-44} 76 L ${scene.width-38} 70 L ${scene.width-32} 76 Z"/></svg><div class="map-attribution">${attribution}</div></div>`;
}

export function selectedFeatureSummary(feature) {
  if (!feature) return null;
  const p = feature.properties || {};
  const coordinates = usablePoint(feature.geometry) ? `${Number(feature.geometry.coordinates[1]).toFixed(6)}, ${Number(feature.geometry.coordinates[0]).toFixed(6)}` : usableLine(feature.geometry) ? `${feature.geometry.coordinates.length} vertices` : 'No geometry';
  const extra = feature.layer === 'tracks' ? `${text(p.track_type) || 'GPS'} · ${text(p.distance_m) || '—'} m · ${text(p.point_count) || '—'} points` : feature.layer === 'stations' ? `${text(p.primary_habitat) || 'Habitat not recorded'} · ${text(p.depth_m) || '—'} m depth` : feature.layer === 'transects' ? `${text(p.length_m) || '—'} m · ${text(p.bearing_deg) || '—'}°` : feature.layer === 'observations' ? `${text(p.count) || '—'} observed · ${text(p.identification_confidence) || 'confidence not recorded'}` : feature.layer === 'environment' ? `${text(p.temperature_c) || '—'} °C · ${text(p.salinity_psu) || '—'} PSU` : feature.layer === 'samples' ? `${text(p.sample_type) || 'sample'} · ${text(p.sample_status) || 'status not recorded'} · ${text(p.label_status) || 'label not recorded'}` : feature.layer === 'media' ? `${text(p.media_type) || 'media'} · ${text(p.camera_or_sensor_id) || 'sensor not recorded'}` : text(p.dominant_habitat) || 'Site';
  return { title: feature.label, id: feature.id, table: feature.table, layer: feature.layer, coordinates, coordinateSource: text(p.coordinate_source) || 'unknown', extra, properties: p };
}
