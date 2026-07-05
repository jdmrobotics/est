import { SCHEMAS, RECORD_TABLES, makeIds, isoNowLocalInput, toIso } from './schema.js';
import { getAllSurveys, getSurvey, saveSurvey, deleteSurvey, getRecords, saveRecord, saveRecordsBatch, deleteRecord, getAttachments, getAttachment, saveAttachment, deleteAttachment, getSetting, setSetting, saveQaqcRun, getLatestQaqcRun, getBasemapPacks, saveBasemapPack, deleteBasemapPack, getSpeciesLists, getTaxa, saveSpeciesList, replaceTaxaForList, saveTaxon, deleteSpeciesList } from './db.js';
import { validateForm, validateSurvey, withCalculatedFields } from './validation.js';
import { exportRawCsvPackage, exportBackup, demoSurvey, exportMissionQaqcZip, exportQaqcReport, exportQaqcFindings, exportCombinedGeoJson, exportGeoJsonLayer, exportGeoJsonQgisZip, toCsv } from './export.js';
import { runFullQaqc, dataFingerprint } from './qaqc.js';
import { MAP_LAYERS, buildMapModel, renderMapSvg, selectedFeatureSummary, mapScene, loadWorldReference, WORLD_REFERENCE_META } from './map.js';
import { validateBasemapInput, aspectRatioWarning, publicBasemapMetadata, MAX_BASEMAP_BYTES } from './basemap.js';
import { formatBytes, makeCaptureDraft, parseCaptureTarget, parentPromotionPlan, targetLabel, validateLocalMedia } from './media_capture.js';
import { appendTrackPoint, summarizeTrack, transectFromEndpoints } from './tracking.js';
import { parseCsv, validateTaxonRows, normalizeTaxon, taxonLabel, matchTaxa, taxaForRefs, updateRecentTaxa, buildQuickObservationDraft, taxaToCsv, sampleTaxonCsv, searchINaturalistTaxa, fromINaturalistTaxon } from './species.js';
import { validateTaxonPack, speciesListFromTaxonPack, taxonPackFromSpeciesList, taxonPackToJson, packAppliesToPoint, packStatusLabel } from './taxon_packs.js';
import { buildFieldDebrief, renderFieldDebriefBody, renderFieldDebriefDocument } from './debrief.js';
import { barcodeDetectorSupported, defaultSampleLabel, normalizeSampleLabel, sampleLabelCsv } from './samples.js';
import { PROTOCOLS, DEFAULT_PROTOCOL_ID, getProtocol, protocolForMission, protocolMissionFields, tableRole, tableRoleLabel, fieldPriority, protocolDefaultFor, protocolChecklistState } from './protocols.js';
import { estimateVideoLogMissionTime, formatTimecode, normalizeVideoLogTime, summarizeRovOperation } from './rov.js';
import { SENSOR_FIELDS, SENSOR_IMPORT_MAX_ROWS, autoDetectSensorMapping, sensorMappingSummary, normalizeSensorRows, summarizeSensorReadings, sensorClockOffsetSeconds, makeSensorStreamRecord } from './sensor_streams.js';
import { SENSOR_PROFILE_METRICS, availableSensorMetrics, buildSensorProfile, profileChartGeometry, sensorMetricLabel, linkedVideoLogsForStream, linkVideoLogsToSensorStream, videoSensorJoinRows, profileSummary } from './sensor_profiles.js';

const app = document.querySelector('#app');
let activeSurvey = null;
let recordsByTable = Object.fromEntries(RECORD_TABLES.map((table) => [table, []]));
let view = 'home';
let selectedTable = 'stations';
let pendingFiles = new Map();
let pendingCaptureFile = null; let pendingCaptureSource = 'device_camera'; let pendingCaptureLocation = null;
let latestQaqcRun = null;
let basemapPacks = []; let activeBasemap = null; let activeBasemapId = ''; let basemapObjectUrl = null;
let mapState = { visibleLayers: new Set(MAP_LAYERS.map((layer) => layer.key)), selectedKey: null, currentLocation: null, basemapVisible: true, basemapOpacity: 0.72, worldReferenceVisible: true, worldView: false };
let worldReference = null; let worldReferenceError = ''; 
let activeTrackId = null; let trackWatchId = null; let transectBuilder = null;
let speciesLists = []; let activeSpeciesListId = ''; let activeSpeciesList = null; let activeTaxa = []; let favoriteTaxonIds = []; let recentTaxonIds = [];
let debriefPhotos = []; let debriefPhotoOmitted = 0;
let barcodeScanStream = null; let barcodeScanTimer = null; let barcodeScanTarget = ''; let barcodeDetector = null;
let pendingSensorImport = null;
let sensorProfileState = { streamId: '', metricKey: 'depth_m', timeBasis: 'mission_time', toleranceSeconds: 90 };

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;' }[ch]));
const short = (value = '', n = 54) => String(value).length > n ? `${String(value).slice(0,n-1)}…` : String(value);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const nextSequence = (table, field) => Math.max(0, ...recordsByTable[table].map((record) => Number(record[field]) || 0)) + 1;

async function init() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  const activeId = await getSetting('activeSurveyId');
  if (activeId) activeSurvey = await getSurvey(activeId);
  if (activeSurvey) { await loadRecords(); latestQaqcRun = await getLatestQaqcRun(activeSurvey.id); await loadBasemapPacks(); await loadSpeciesCatalog(); }
  try { worldReference = await loadWorldReference(); } catch (error) { worldReferenceError = error.message || 'World reference unavailable.'; }
  render();
}

async function loadRecords() {
  recordsByTable = Object.fromEntries(await Promise.all(RECORD_TABLES.map(async (table) => [table, await getRecords(activeSurvey.id, table)])));
}

function currentProjectId() { return String(activeSurvey?.mission?.project_id || '').trim(); }
function speciesSettingKey(kind) { return `${kind}:${currentProjectId()}`; }

async function loadSpeciesCatalog() {
  const projectId = currentProjectId();
  if (!projectId) { speciesLists = []; activeSpeciesListId = ''; activeSpeciesList = null; activeTaxa = []; favoriteTaxonIds = []; recentTaxonIds = []; return; }
  speciesLists = await getSpeciesLists(projectId);
  activeSpeciesListId = await getSetting(speciesSettingKey('activeSpeciesListId')) || '';
  if (!speciesLists.some((item) => item.id === activeSpeciesListId)) activeSpeciesListId = speciesLists[0]?.id || '';
  activeSpeciesList = speciesLists.find((item) => item.id === activeSpeciesListId) || null;
  activeTaxa = activeSpeciesList ? await getTaxa(activeSpeciesList.id) : [];
  favoriteTaxonIds = (await getSetting(speciesSettingKey('favoriteTaxonIds'))) || [];
  recentTaxonIds = (await getSetting(speciesSettingKey('recentTaxonIds'))) || [];
  if (activeSpeciesListId) await setSetting(speciesSettingKey('activeSpeciesListId'), activeSpeciesListId);
}

async function setActiveSpeciesList(listId) {
  activeSpeciesListId = listId || '';
  await setSetting(speciesSettingKey('activeSpeciesListId'), activeSpeciesListId);
  await loadSpeciesCatalog();
  render();
}

function activeFavoriteTaxa() { return taxaForRefs(activeTaxa, favoriteTaxonIds); }
function activeRecentTaxa() { return taxaForRefs(activeTaxa, recentTaxonIds); }
function taxonChip(taxon, context = 'species') {
  const favorite = favoriteTaxonIds.includes(taxon.id);
  const sub = [taxon.group, taxon.default_habitat, taxon.taxon_source === 'iNaturalist' ? 'iNaturalist cached' : ''].filter(Boolean).join(' · ');
  const choose = context === 'quick' ? `<button type="button" class="button ghost small" data-action="quick-select-taxon" data-taxon-id="${escapeHtml(taxon.id)}">Use</button>` : '';
  return `<article class="taxon-row"><div><div class="title"><em>${escapeHtml(taxon.scientific_name || '')}</em>${taxon.common_name ? ` <span class="muted">— ${escapeHtml(taxon.common_name)}</span>` : ''}</div><div class="meta">${escapeHtml(taxon.taxon_key)}${sub ? ` · ${escapeHtml(sub)}` : ''}</div></div><div class="buttons">${choose}<button type="button" class="button ghost small" data-action="toggle-taxon-favorite" data-taxon-id="${escapeHtml(taxon.id)}" aria-label="${favorite ? 'Remove favorite' : 'Add favorite'}">${favorite ? '★' : '☆'}</button></div></article>`;
}

function isRegionalTaxonPack(list = {}) { return list.list_kind === 'regional_pack'; }
function activeSitePoint() {
  const lat = Number(activeSurvey?.site?.latitude_dd); const lon = Number(activeSurvey?.site?.longitude_dd);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}
function packCoverageSummary(list = {}) {
  if (!isRegionalTaxonPack(list)) return '';
  const point = activeSitePoint(); const applies = point ? packAppliesToPoint(list, point.lat, point.lon) : null;
  if (applies === true) return ' · current site is within recorded pack bounds';
  if (applies === false) return ' · current site is outside recorded pack bounds';
  return ' · no usable current-site / pack bounds comparison';
}
function speciesListRow(list) {
  const active = list.id === activeSpeciesListId;
  const kind = isRegionalTaxonPack(list) ? `${packStatusLabel(list)} · ${list.taxon_pack_version || 'no version'}${packCoverageSummary(list)}` : `Project list${list.source_kind === 'iNaturalist_cache' ? ' · iNaturalist cache' : ''}`;
  return `<article class="record-row species-list-row"><div><div class="title">${escapeHtml(list.name)} ${active ? '<span class="badge">Active</span>' : ''}${isRegionalTaxonPack(list) ? ' <span class="badge">Regional pack</span>' : ''}</div><div class="meta">${plural(Number(list.taxon_count) || 0, 'taxon')} · ${escapeHtml(kind)}${list.source_filename ? ` · ${escapeHtml(list.source_filename)}` : ''}</div></div><div class="buttons">${active ? '' : `<button class="button secondary small" data-action="set-active-species-list" data-list-id="${escapeHtml(list.id)}">Use</button>`}${isRegionalTaxonPack(list) ? `<button class="button ghost small" data-action="export-taxon-pack" data-list-id="${escapeHtml(list.id)}">Export pack</button>` : ''}<button class="button ghost small" data-action="delete-species-list" data-list-id="${escapeHtml(list.id)}">Delete</button></div></article>`;
}

function speciesContent() {
  const projectId = currentProjectId();
  if (!projectId) return `<section class="hero"><h1>Species lists</h1><p>Save a Project ID in Mission & site before creating a controlled species list.</p><div class="actions"><button class="button" data-view="mission">Open Mission & site</button></div></section>`;
  const favorites = activeFavoriteTaxa(); const taxaPreview = activeTaxa.slice(0, 80); const regionalPacks = speciesLists.filter(isRegionalTaxonPack); const sitePoint = activeSitePoint();
  const activeSummary = activeSpeciesList ? `<div class="notice good"><strong>Active list:</strong> ${escapeHtml(activeSpeciesList.name)} · ${plural(activeTaxa.length, 'taxon')}. ${isRegionalTaxonPack(activeSpeciesList) ? `Regional-pack provenance: <strong>${escapeHtml(activeSpeciesList.taxon_pack_id || '')}</strong> v${escapeHtml(activeSpeciesList.taxon_pack_version || '')} · ${escapeHtml(activeSpeciesList.taxon_pack_review_status || 'draft')}${packCoverageSummary(activeSpeciesList)}.` : 'Quick observation will standardize names from this list.'}</div>` : `<div class="notice">No active list. You can still make a manual observation, but importing an approved project list or regional pack is recommended before a field mission.</div>`;
  const regionalPackNotice = `<section class="card"><div class="section-head"><div><h3>Regional taxon packs</h3><p>A taxon pack is a versioned, geographically scoped controlled list. EcoSurvey stores its pack ID, version, region, and review status on every quick-entry observation.</p></div><div class="actions"><button class="button" data-action="install-bundled-taxon-pack">Install Mid-Atlantic starter</button><button class="button secondary" data-action="open-taxon-pack-import">Import regional pack</button><button class="button ghost" data-action="download-taxon-pack-template">Pack template</button></div></div><div class="notice">The bundled Mid-Atlantic pack is a <strong>draft demonstration starter</strong>, not a complete regional checklist. Install a documented, reviewed regional pack before scientific analysis. ${sitePoint ? `Current site: ${sitePoint.lat.toFixed(4)}, ${sitePoint.lon.toFixed(4)}.` : 'Save site GPS to test pack coverage against the current mission.'}</div>${regionalPacks.length ? `<div class="record-list">${regionalPacks.map(speciesListRow).join('')}</div>` : '<div class="empty">No regional taxon pack installed for this project.</div>'}</section>`;
  return `<section class="section-head"><div><h2>Project species lists & taxon packs</h2><p>Controlled taxon names are stored on this device by Project ID <strong>${escapeHtml(projectId)}</strong>. They are not copied to a cloud service.</p></div><div class="actions"><button class="button" data-action="open-inaturalist-search">Search global iNaturalist taxa</button><button class="button secondary" data-action="open-species-import">Import CSV list</button><button class="button secondary" data-action="download-species-template">CSV template</button>${activeSpeciesList ? '<button class="button secondary" data-action="open-manual-taxon">Add taxon</button><button class="button ghost" data-action="export-active-species-list">Export active CSV</button>' : ''}</div></section>${activeSummary}<div class="grid cards"><article class="card"><div class="metric">${speciesLists.length}</div><div class="label">Controlled lists</div></article><article class="card"><div class="metric">${regionalPacks.length}</div><div class="label">Regional packs</div></article><article class="card"><div class="metric">${activeTaxa.length}</div><div class="label">Taxa in active list</div></article><article class="card"><div class="metric">${favorites.length}</div><div class="label">Favorite taxa</div></article></div>${regionalPackNotice}<section class="card"><h3>Available controlled lists</h3>${speciesLists.length ? `<div class="record-list">${speciesLists.map(speciesListRow).join('')}</div>` : '<div class="empty">Import a CSV list or regional taxon pack to create the first controlled list.</div>'}</section>${activeSpeciesList ? `<section class="card"><div class="section-head"><div><h3>${escapeHtml(activeSpeciesList.name)}</h3><p>${escapeHtml(activeSpeciesList.notes || 'Controlled list for field observation entry.')}</p></div><div class="actions"><button class="button" data-action="open-quick-observation">Quick observation</button>${isRegionalTaxonPack(activeSpeciesList) ? '<button class="button ghost" data-action="export-active-taxon-pack">Export active pack</button>' : ''}</div></section>${favorites.length ? `<h4>Favorites</h4><div class="record-list compact-list">${favorites.map((taxon) => taxonChip(taxon)).join('')}</div>` : ''}<h4>Taxa preview</h4><div class="record-list compact-list">${taxaPreview.map((taxon) => taxonChip(taxon)).join('')}</div>${activeTaxa.length > taxaPreview.length ? `<p class="footer-note">Showing the first ${taxaPreview.length} of ${activeTaxa.length} taxa. Quick observation searches the entire active list.</p>` : ''}</section>` : ''}<section class="card"><h3>Controlled-list columns</h3><p><code>${escapeHtml('taxon_key, scientific_name, common_name, taxonomic_level, group, native_status, default_habitat, taxon_source, inaturalist_taxon_id, source_url, notes')}</code></p><p class="footer-note">CSV lists are appropriate for project-specific checklists. Regional pack JSON adds a stable pack ID, version, geographic scope, source record, and review status. Global iNaturalist search still requires a connection and remains a cache-first lookup rather than a bulk taxonomy download.</p></section>`;
}

function quickTaxonOptions() {
  return activeTaxa.map((taxon) => `<option value="${escapeHtml(taxonLabel(taxon))}"></option>`).join('');
}
function quickTaxonFromText(value) {
  const needle = String(value || '').trim().toLowerCase();
  if (!needle) return null;
  return activeTaxa.find((taxon) => [taxon.id, taxon.taxon_key, taxonLabel(taxon), taxon.scientific_name, taxon.common_name].filter(Boolean).some((candidate) => String(candidate).trim().toLowerCase() === needle)) || null;
}
function quickTaxonButtons(taxa) {
  return taxa.length ? `<div class="taxon-choice-row">${taxa.map((taxon) => `<button type="button" class="button ghost small" data-action="quick-select-taxon" data-taxon-id="${escapeHtml(taxon.id)}">${escapeHtml(short(taxon.common_name || taxon.scientific_name || taxon.taxon_key, 28))}</button>`).join('')}</div>` : '<span class="muted">None yet.</span>';
}
function quickStationOptions() {
  return `<option value="">Select station…</option>${(recordsByTable.stations || []).map((row) => `<option value="${escapeHtml(row.station_sequence)}">Station ${String(row.station_sequence).padStart(2,'0')} · ${escapeHtml(row.station_id)}</option>`).join('')}`;
}
function quickTransectOptions() {
  return `<option value="">Station-only observation</option>${(recordsByTable.transects || []).map((row) => `<option value="${escapeHtml(row.transect_sequence)}">Station ${String(row.parent_station_sequence).padStart(2,'0')} · Transect ${String(row.transect_sequence).padStart(2,'0')}</option>`).join('')}`;
}
function openQuickObservation(selectedTaxonId = '') {
  if (!(recordsByTable.stations || []).length) { alert('Add and save at least one Station before entering an observation.'); view = 'records'; selectedTable = 'stations'; render(); return; }
  const selected = activeTaxa.find((taxon) => taxon.id === selectedTaxonId) || null;
  const recent = activeRecentTaxa(); const favorites = activeFavoriteTaxa(); const lead = activeSurvey?.mission?.mission_lead || '';
  const selectedText = selected ? taxonLabel(selected) : ''; const quickProtocol = activeProtocol(); const isDebrisQuick = quickProtocol.id === 'shoreline_debris';
  const listNotice = isDebrisQuick ? '<div class="notice good">Shoreline debris protocol active. Use the name fields for a concise debris type, such as “plastic bottle”, “foam fragment”, or “fishing line”. This record is saved as the Debris category.</div>' : (activeSpeciesList ? `<div class="notice good">Using active project list: <strong>${escapeHtml(activeSpeciesList.name)}</strong>. Search the list, choose a favorite/recent taxon, or enter a manual taxon below.</div>` : '<div class="notice">No active species list. This will be saved as a manual field entry. Import a project list from the Species lists tab to standardize taxa.</div>');
  const body = `<form id="quick-observation-form"><p class="modal-intro">${isDebrisQuick ? 'Fast debris entry for measured shoreline transects. This uses the standard Observation record with the Debris category.' : 'Fast organism entry for active station/transect surveys. Required scientific-data fields are retained; this interface removes repeated typing during a transect.'}</p>${listNotice}<div class="form-grid"><div class="field full"><label for="quick_taxon_text">${isDebrisQuick ? 'Debris type from a saved list (optional)' : 'Taxon from active list'}</label><input id="quick_taxon_text" name="quick_taxon_text" list="quick-taxon-list" value="${escapeHtml(selectedText)}" placeholder="${isDebrisQuick ? 'Optional controlled debris type' : 'Search common or scientific name'}" autocomplete="off"/><datalist id="quick-taxon-list">${quickTaxonOptions()}</datalist><div id="quick-taxon-match" class="help">${selected ? `Selected: ${escapeHtml(taxonLabel(selected))} · key ${escapeHtml(selected.taxon_key)}` : 'Choose a matching list taxon or use the manual fields below.'}</div></div><div class="field full"><label>Favorites</label>${quickTaxonButtons(favorites)}</div><div class="field full"><label>Recent taxa</label>${quickTaxonButtons(recent)}</div><div class="field"><label for="quick_station_sequence">Station *</label><select id="quick_station_sequence" name="quick_station_sequence" required>${quickStationOptions()}</select></div><div class="field"><label for="quick_transect_sequence">Transect</label><select id="quick_transect_sequence" name="quick_transect_sequence">${quickTransectOptions()}</select><div class="help">Leave blank for a station-only record.</div></div><div class="field"><label for="quick_count">Count</label><div class="quick-count"><input id="quick_count" name="quick_count" type="number" min="0" step="1" value="1"/><div class="taxon-choice-row"><button type="button" class="button ghost small" data-action="quick-count" data-count="1">1</button><button type="button" class="button ghost small" data-action="quick-count" data-count="5">5</button><button type="button" class="button ghost small" data-action="quick-count" data-count="10">10</button><button type="button" class="button ghost small" data-action="quick-count" data-count="">Unknown</button></div></div></div><div class="field"><label for="quick_percent_cover">Percent cover</label><input id="quick_percent_cover" name="quick_percent_cover" type="number" min="0" max="100" step="any" placeholder="Optional"/></div><div class="field"><label for="quick_habitat_context">Habitat context</label><select id="quick_habitat_context" name="quick_habitat_context"><option value="">Use list/default or leave blank</option>${SCHEMAS.observations.fields.find((field) => field.name === 'habitat_context').options.map(([value,label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join('')}</select></div><div class="field"><label for="quick_method">Observation method *</label><select id="quick_method" name="quick_method">${SCHEMAS.observations.fields.find((field) => field.name === 'observation_method').options.map(([value,label]) => `<option value="${value}" ${value === 'visual' ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></div><div class="field"><label for="quick_confidence">Identification confidence *</label><select id="quick_confidence" name="quick_confidence">${SCHEMAS.observations.fields.find((field) => field.name === 'identification_confidence').options.map(([value,label]) => `<option value="${value}" ${value === 'medium' ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></div><div class="field"><label for="quick_observer">Observer *</label><input id="quick_observer" name="quick_observer" required value="${escapeHtml(lead)}"/></div><div class="field full"><details><summary>${isDebrisQuick ? 'Manual debris description' : 'Manual or uncertain taxon entry'}</summary><div class="form-grid nested-fields"><div class="field"><label for="quick_manual_scientific">${isDebrisQuick ? 'Material or class (optional)' : 'Scientific name'}</label><input id="quick_manual_scientific" name="quick_manual_scientific" placeholder="${isDebrisQuick ? 'e.g., plastic, metal, fishing gear' : 'Optional if common name is entered'}"/></div><div class="field"><label for="quick_manual_common">${isDebrisQuick ? 'Debris type *' : 'Common name'}</label><input id="quick_manual_common" name="quick_manual_common" placeholder="${isDebrisQuick ? 'e.g., plastic bottle, foam fragment' : 'Optional if scientific name is entered'}"/></div></div></details></div><div class="field full"><label for="quick_notes">Notes</label><textarea id="quick_notes" name="quick_notes" placeholder="Behavior, size, location along transect, certainty note, or other context."></textarea></div></div><div id="quick-observation-errors" class="notice error" hidden></div><div class="field-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button type="submit" class="button" name="submit_mode" value="close">Save observation</button><button type="submit" class="button ghost" name="submit_mode" value="next">Add & next</button></div></form>`;
  renderModal('Quick observation', body);
  document.querySelector('#quick-observation-form')?.addEventListener('submit', handleQuickObservationSubmit);
  document.querySelector('#quick_taxon_text')?.addEventListener('input', updateQuickTaxonMatch);
}
function selectQuickTaxon(taxonId) {
  const taxon = activeTaxa.find((item) => item.id === taxonId);
  const input = document.querySelector('#quick_taxon_text');
  if (!taxon || !input) return;
  input.value = taxonLabel(taxon);
  updateQuickTaxonMatch();
}

function updateQuickTaxonMatch() {
  const input = document.querySelector('#quick_taxon_text'); const output = document.querySelector('#quick-taxon-match'); if (!input || !output) return;
  const taxon = quickTaxonFromText(input.value);
  const matches = taxon ? [taxon] : matchTaxa(activeTaxa, input.value, 3);
  output.textContent = taxon ? `Selected: ${taxonLabel(taxon)} · key ${taxon.taxon_key}` : matches.length ? `Matches: ${matches.map(taxonLabel).join(' | ')}` : 'No project-list match selected. Enter a manual taxon below if needed.';
}
function displayQuickErrors(errors) { const box = document.querySelector('#quick-observation-errors'); if (!box) return; box.hidden = false; box.innerHTML = `<strong>Fix before saving:</strong><ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>`; box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
async function handleQuickObservationSubmit(event) {
  event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form).entries()); const taxon = quickTaxonFromText(data.quick_taxon_text); const manualScientific = data.quick_manual_scientific || ''; const manualCommon = data.quick_manual_common || '';
  const errors = [];
  if (!taxon && !manualScientific.trim() && !manualCommon.trim()) errors.push(activeProtocol().id === 'shoreline_debris' ? 'Choose a saved debris type or enter a manual debris description.' : 'Choose a project-list taxon or enter a manual scientific or common name.');
  const station = (recordsByTable.stations || []).find((row) => String(row.station_sequence) === String(data.quick_station_sequence));
  if (!station) errors.push('Choose a valid Station.');
  const transect = data.quick_transect_sequence ? (recordsByTable.transects || []).find((row) => String(row.transect_sequence) === String(data.quick_transect_sequence)) : null;
  if (data.quick_transect_sequence && !transect) errors.push('Choose a valid Transect or leave the transect blank.');
  if (station && transect && String(transect.parent_station_sequence) !== String(station.station_sequence)) errors.push('The selected transect belongs to a different Station.');
  if (errors.length) return displayQuickErrors(errors);
  let draft = buildQuickObservationDraft({ taxon, manualScientificName: manualScientific, manualCommonName: manualCommon, stationSequence: station.station_sequence, transectSequence: transect?.transect_sequence || '', observationSequence: nextSequence('observations', 'observation_sequence'), count: data.quick_count, percentCover: data.quick_percent_cover, habitatContext: data.quick_habitat_context, observationMethod: data.quick_method, identificationConfidence: data.quick_confidence, observer: data.quick_observer, notes: data.quick_notes });
  if (activeProtocol().id === 'shoreline_debris') { draft.observation_category = 'debris'; draft.taxon_name_basis = 'common'; draft.taxon_scientific_name = ''; draft.common_name = draft.common_name || manualCommon || 'Unspecified debris'; }
  draft = withCalculatedFields('observations', draft, activeSurvey.mission, activeSurvey.site);
  const fieldErrors = validateForm('observations', draft, activeSurvey.mission, activeSurvey.site, recordsByTable);
  if (fieldErrors.length) return displayQuickErrors(fieldErrors);
  draft._createdAt = new Date().toISOString(); draft._updatedAt = draft._createdAt;
  await saveRecord(activeSurvey.id, 'observations', draft.observation_id, draft); await loadRecords();
  if (taxon) { recentTaxonIds = updateRecentTaxa(recentTaxonIds, taxon.id); await setSetting(speciesSettingKey('recentTaxonIds'), recentTaxonIds); }
  const submitMode = event.submitter?.value || 'close'; closeModal(); selectedTable = 'observations'; view = 'records'; render();
  if (submitMode === 'next') openQuickObservation(taxon?.id || '');
}

function inatResultHtml(result) {
  const scientific = result.name || 'Unnamed taxon'; const common = result.preferred_common_name || result.matched_term || '';
  const rank = result.rank || 'rank not supplied'; const group = result.iconic_taxon_name || 'Other';
  return `<article class="record-row inat-result"><div><div class="title"><em>${escapeHtml(scientific)}</em>${common ? ` <span class="muted">— ${escapeHtml(common)}</span>` : ''}</div><div class="meta">iNaturalist taxon ${escapeHtml(String(result.id || ''))} · ${escapeHtml(rank)} · ${escapeHtml(group)}</div></div><div class="buttons"><button class="button small" data-action="save-inaturalist-taxon" data-inat-id="${escapeHtml(String(result.id || ''))}">Save offline</button></div></article>`;
}
let inaturalistResults = [];
function openINaturalistSearch() {
  const projectId = currentProjectId();
  if (!projectId) return alert('Save a Project ID in Mission & site before searching and caching taxa.');
  const body = `<form id="inat-search-form"><p class="modal-intro"><strong>Global iNaturalist taxonomy search.</strong> This uses iNaturalist only while the device has a connection. Select individual taxa to save a project-local offline cache for quick observation menus. EcoSurvey does not download the entire iNaturalist taxonomy.</p><div class="form-grid"><div class="field full"><label for="inat_query">Scientific or common name *</label><input id="inat_query" name="inat_query" minlength="2" required placeholder="e.g., striped bass, Crassostrea virginica" autocomplete="off"/></div><div class="field"><label for="inat_rank">Rank filter</label><select id="inat_rank" name="inat_rank"><option value="">Any rank</option><option value="species">Species</option><option value="genus">Genus</option><option value="family">Family</option><option value="order">Order</option><option value="class">Class</option><option value="phylum">Phylum</option></select></div></div><div id="inat-search-status" class="notice" hidden></div><div id="inat-search-results" class="record-list compact-list"></div><div class="field-actions"><button type="button" class="button secondary" data-action="close-modal">Close</button><button type="submit" class="button">Search taxonomy</button></div></form>`;
  inaturalistResults = []; renderModal('Search global iNaturalist taxa', body); document.querySelector('#inat-search-form')?.addEventListener('submit', handleINaturalistSearch);
}
function setInatStatus(message = '', tone = '') {
  const box = document.querySelector('#inat-search-status'); if (!box) return;
  box.hidden = !message; box.className = `notice ${tone}`.trim(); box.textContent = message;
}
async function handleINaturalistSearch(event) {
  event.preventDefault(); const form = event.currentTarget; const query = form.inat_query.value.trim(); const rank = form.inat_rank.value;
  const submit = form.querySelector('button[type="submit"]'); if (submit) { submit.disabled = true; submit.textContent = 'Searching…'; }
  setInatStatus('Searching iNaturalist taxonomy…');
  try {
    inaturalistResults = await searchINaturalistTaxa(query, { rank, perPage: 20 });
    const target = document.querySelector('#inat-search-results'); if (target) target.innerHTML = inaturalistResults.length ? inaturalistResults.map(inatResultHtml).join('') : '<div class="empty">No matching taxa returned. Try a shorter scientific or common name.</div>';
    setInatStatus(inaturalistResults.length ? `${inaturalistResults.length} results returned. Save only taxa relevant to this project for offline field use.` : 'No results returned.');
    document.querySelectorAll('#inat-search-results [data-action]').forEach((button) => button.addEventListener('click', handleAction));
  } catch (error) { setInatStatus(error.message || 'Taxonomy search failed.', 'error'); }
  finally { if (submit) { submit.disabled = false; submit.textContent = 'Search taxonomy'; } }
}
async function ensureINaturalistCacheList() {
  const projectId = currentProjectId();
  let list = speciesLists.find((item) => item.source_kind === 'iNaturalist_cache');
  if (!list) {
    list = { id: crypto.randomUUID(), project_id: projectId, name: 'iNaturalist saved taxa', notes: 'Taxa individually selected from the iNaturalist global taxonomy and cached for offline EcoSurvey entry.', source_filename: 'iNaturalist API', source_kind: 'iNaturalist_cache', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), taxon_count: 0 };
    await saveSpeciesList(list); speciesLists = await getSpeciesLists(projectId);
  }
  return list;
}
async function saveINaturalistTaxon(inatId) {
  const result = inaturalistResults.find((item) => String(item.id) === String(inatId));
  if (!result) return alert('That iNaturalist search result is no longer available. Search again and retry.');
  const list = await ensureINaturalistCacheList(); const taxon = fromINaturalistTaxon(result);
  const existing = await getTaxa(list.id);
  if (existing.some((row) => String(row.inaturalist_taxon_id) === String(taxon.inaturalist_taxon_id) || row.taxon_key === taxon.taxon_key)) { setInatStatus(`${taxonLabel(taxon)} is already stored in the offline iNaturalist cache.`, 'good'); return; }
  const stored = { ...taxon, id: `${list.id}|${taxon.taxon_key}`, list_id: list.id, list_name: list.name, project_id: list.project_id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  await saveTaxon(stored); await saveSpeciesList({ ...list, taxon_count: existing.length + 1, updated_at: new Date().toISOString() });
  await setActiveSpeciesList(list.id); setInatStatus(`${taxonLabel(taxon)} saved to “${list.name}” and set as the active offline list.`, 'good');
}

function openSpeciesImport() {
  const projectId = currentProjectId();
  if (!projectId) return alert('Save a Project ID in Mission & site before importing a species list.');
  const body = `<form id="species-import-form"><p class="modal-intro">Import an approved project-specific CSV. EcoSurvey stores the list locally under Project ID <strong>${escapeHtml(projectId)}</strong>. Import creates a new list; it does not overwrite prior field records.</p><div class="form-grid"><div class="field full"><label for="species_csv">CSV file *</label><input id="species_csv" name="species_csv" type="file" accept=".csv,text/csv" required/><div class="help">Required values per row: a scientific name or common name. Use a stable taxon_key when possible.</div></div><div class="field"><label for="species_list_name">List name *</label><input id="species_list_name" name="species_list_name" required placeholder="Project pilot taxa — approved July 2026"/></div><div class="field"><label for="species_list_notes">Notes</label><input id="species_list_notes" name="species_list_notes" placeholder="Authority, version, or taxonomic scope"/></div></div><div id="species-import-errors" class="notice error" hidden></div><div id="species-import-warnings" class="notice" hidden></div><div class="field-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button type="submit" class="button">Import list</button></div></form>`;
  renderModal('Import project species list', body); document.querySelector('#species-import-form')?.addEventListener('submit', handleSpeciesImport);
}
function displaySpeciesImportMessages(errors = [], warnings = []) {
  const errorBox = document.querySelector('#species-import-errors'); const warningBox = document.querySelector('#species-import-warnings');
  if (errorBox) { errorBox.hidden = !errors.length; errorBox.innerHTML = errors.length ? `<strong>Import not saved:</strong><ul>${errors.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul>` : ''; }
  if (warningBox) { warningBox.hidden = !warnings.length; warningBox.innerHTML = warnings.length ? `<strong>Import warnings:</strong><ul>${warnings.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul>` : ''; }
}
async function handleSpeciesImport(event) {
  event.preventDefault(); const form = event.currentTarget; const file = form.species_csv.files?.[0]; const name = form.species_list_name.value.trim();
  if (!file || !name) return displaySpeciesImportMessages(['Choose a CSV file and provide a list name.']);
  let parsed; try { parsed = parseCsv(await file.text()); } catch (error) { return displaySpeciesImportMessages([`Could not read CSV: ${error.message}`]); }
  const result = validateTaxonRows(parsed);
  if (!parsed.length) result.errors.push('The CSV has no data rows.');
  if (result.errors.length) return displaySpeciesImportMessages(result.errors, result.warnings);
  const list = { id: crypto.randomUUID(), project_id: currentProjectId(), name, notes: form.species_list_notes.value.trim(), source_filename: file.name, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), taxon_count: result.rows.length };
  await saveSpeciesList(list); await replaceTaxaForList(list, result.rows); await setSetting(speciesSettingKey('activeSpeciesListId'), list.id); await loadSpeciesCatalog(); closeModal(); view = 'species'; render();
}
function taxonPackMessage(errors = [], warnings = []) {
  const errorBox = document.querySelector('#taxon-pack-import-errors'); const warningBox = document.querySelector('#taxon-pack-import-warnings');
  if (errorBox) { errorBox.hidden = !errors.length; errorBox.innerHTML = errors.length ? `<strong>Pack was not installed:</strong><ul>${errors.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul>` : ''; }
  if (warningBox) { warningBox.hidden = !warnings.length; warningBox.innerHTML = warnings.length ? `<strong>Review before field use:</strong><ul>${warnings.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul>` : ''; }
}
async function installTaxonPack(rawPack, sourceFilename = '') {
  const result = validateTaxonPack(rawPack);
  if (result.errors.length) return { ...result, installed: false };
  const { list, taxa } = speciesListFromTaxonPack(result.pack, currentProjectId(), sourceFilename);
  const existing = speciesLists.find((item) => item.id === list.id);
  if (existing) { await setActiveSpeciesList(existing.id); return { ...result, list: existing, installed: false, alreadyInstalled: true }; }
  await saveSpeciesList(list); await replaceTaxaForList(list, taxa); await setSetting(speciesSettingKey('activeSpeciesListId'), list.id); await loadSpeciesCatalog();
  return { ...result, list, installed: true, alreadyInstalled: false };
}
function openTaxonPackImport() {
  const projectId = currentProjectId();
  if (!projectId) return alert('Save a Project ID in Mission & site before importing a regional taxon pack.');
  const body = `<form id="taxon-pack-import-form"><p class="modal-intro">Import an EcoSurvey regional taxon-pack JSON file. The pack keeps its identity, version, geographic scope, source details, and review status with the controlled list stored for Project ID <strong>${escapeHtml(projectId)}</strong>.</p><div class="form-grid"><div class="field full"><label for="taxon_pack_file">Regional taxon pack JSON *</label><input id="taxon_pack_file" name="taxon_pack_file" type="file" accept=".json,application/json" required/><div class="help">Use the EcoSurvey pack template or a reviewed pack prepared from a documented authority. A pack does not overwrite older pack versions.</div></div></div><div id="taxon-pack-import-errors" class="notice error" hidden></div><div id="taxon-pack-import-warnings" class="notice" hidden></div><div class="field-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button type="submit" class="button">Validate & install pack</button></div></form>`;
  renderModal('Import regional taxon pack', body); document.querySelector('#taxon-pack-import-form')?.addEventListener('submit', handleTaxonPackImport);
}
async function handleTaxonPackImport(event) {
  event.preventDefault(); const form = event.currentTarget; const file = form.taxon_pack_file.files?.[0];
  if (!file) return taxonPackMessage(['Choose a regional taxon-pack JSON file.']);
  let raw; try { raw = JSON.parse(await file.text()); } catch (error) { return taxonPackMessage([`Could not read JSON: ${error.message}`]); }
  const outcome = await installTaxonPack(raw, file.name); taxonPackMessage(outcome.errors, outcome.warnings);
  if (outcome.errors.length) return;
  closeModal(); view = 'species'; render();
  alert(outcome.alreadyInstalled ? `This exact pack version is already installed and is now active: ${outcome.list.name}.` : `Installed ${outcome.list.name} with ${outcome.list.taxon_count} taxa. Review its status before field use.`);
}
async function installBundledTaxonPack() {
  const url = './examples/taxon_packs/Mid_Atlantic_Estuary_Starter_Pack_v1.0.0.json';
  try {
    const response = await fetch(url); if (!response.ok) throw new Error(`Bundled pack unavailable (${response.status}).`);
    const outcome = await installTaxonPack(JSON.parse(await response.text()), 'Mid_Atlantic_Estuary_Starter_Pack_v1.0.0.json');
    if (outcome.errors.length) return alert(`The bundled starter pack did not validate:\n${outcome.errors.join('\n')}`);
    view = 'species'; render(); alert(outcome.alreadyInstalled ? 'The bundled Mid-Atlantic starter pack is already installed and is now active.' : `Installed the bundled Mid-Atlantic starter pack (${outcome.list.taxon_count} taxa). It is intentionally marked DRAFT / demonstration.`);
  } catch (error) { alert(`Could not install bundled taxon pack: ${error.message}`); }
}
async function downloadTaxonPackTemplate() {
  try { const response = await fetch('./examples/taxon_packs/EcoSurvey_Taxon_Pack_Template.json'); if (!response.ok) throw new Error(`Template unavailable (${response.status}).`); downloadBlobFile(await response.text(), 'EcoSurvey_Taxon_Pack_Template.json', 'application/json;charset=utf-8'); }
  catch (error) { alert(`Could not download the pack template: ${error.message}`); }
}
async function exportTaxonPack(listId) {
  const list = speciesLists.find((item) => item.id === listId) || activeSpeciesList;
  if (!list || !isRegionalTaxonPack(list)) return alert('Select a regional taxon pack before exporting.');
  const taxa = list.id === activeSpeciesListId ? activeTaxa : await getTaxa(list.id);
  const pack = taxonPackFromSpeciesList(list, taxa);
  const filename = `${String(list.taxon_pack_id || list.name || 'EcoSurvey_taxon_pack').replaceAll(/[^a-z0-9]+/gi, '_')}_v${String(list.taxon_pack_version || '0_0_0').replaceAll(/[^a-z0-9]+/gi, '_')}.json`;
  downloadBlobFile(taxonPackToJson(pack), filename, 'application/json;charset=utf-8');
}
function openManualTaxon() {
  if (!activeSpeciesList) return alert('Import or select a project species list before adding a taxon.');
  const body = `<form id="manual-taxon-form"><p class="modal-intro">Add one controlled taxon to <strong>${escapeHtml(activeSpeciesList.name)}</strong>. The taxon is available immediately to Quick observation.</p><div class="form-grid"><div class="field"><label for="manual_taxon_key">Taxon key</label><input id="manual_taxon_key" name="taxon_key" placeholder="stable_project_key"/></div><div class="field"><label for="manual_taxon_scientific">Scientific name</label><input id="manual_taxon_scientific" name="scientific_name"/></div><div class="field"><label for="manual_taxon_common">Common name</label><input id="manual_taxon_common" name="common_name"/></div><div class="field"><label for="manual_taxon_level">Taxonomic level</label><select id="manual_taxon_level" name="taxonomic_level">${SCHEMAS.observations.fields.find((field) => field.name === 'taxonomic_level').options.map(([value,label]) => `<option value="${value}" ${value === 'species' ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></div><div class="field"><label for="manual_taxon_group">Group</label><input id="manual_taxon_group" name="group" placeholder="Fish, crustacean, macroalgae..."/></div><div class="field"><label for="manual_taxon_habitat">Default habitat</label><select id="manual_taxon_habitat" name="default_habitat"><option value="">None</option>${SCHEMAS.observations.fields.find((field) => field.name === 'habitat_context').options.map(([value,label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join('')}</select></div><div class="field full"><label for="manual_taxon_notes">Notes</label><textarea id="manual_taxon_notes" name="notes"></textarea></div></div><div id="manual-taxon-errors" class="notice error" hidden></div><div class="field-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button type="submit" class="button">Save taxon</button></div></form>`;
  renderModal('Add taxon', body); document.querySelector('#manual-taxon-form')?.addEventListener('submit', handleManualTaxonSubmit);
}
async function handleManualTaxonSubmit(event) {
  event.preventDefault(); const form = event.currentTarget; const input = Object.fromEntries(new FormData(form).entries()); const result = validateTaxonRows([input]);
  const box = document.querySelector('#manual-taxon-errors');
  if (result.errors.length) { box.hidden = false; box.innerHTML = `<strong>Fix before saving:</strong><ul>${result.errors.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul>`; return; }
  const taxon = result.rows[0]; if (activeTaxa.some((row) => row.taxon_key === taxon.taxon_key)) { box.hidden = false; box.textContent = `Taxon key “${taxon.taxon_key}” already exists in the active list.`; return; }
  const packFields = isRegionalTaxonPack(activeSpeciesList) ? { taxon_source: 'regional_pack', taxon_pack_id: activeSpeciesList.taxon_pack_id || '', taxon_pack_name: activeSpeciesList.taxon_pack_name || activeSpeciesList.name || '', taxon_pack_version: activeSpeciesList.taxon_pack_version || '', taxon_pack_region: activeSpeciesList.taxon_pack_region || '', taxon_pack_review_status: activeSpeciesList.taxon_pack_review_status || '' } : {};
  const stored = { ...taxon, ...packFields, id: `${activeSpeciesList.id}|${taxon.taxon_key}`, list_id: activeSpeciesList.id, list_name: activeSpeciesList.name, project_id: activeSpeciesList.project_id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  await saveTaxon(stored); await saveSpeciesList({ ...activeSpeciesList, taxon_count: activeTaxa.length + 1, updated_at: new Date().toISOString() }); await loadSpeciesCatalog(); closeModal(); render();
}

function activeProtocol() { return protocolForMission(activeSurvey?.mission || {}); }
function protocolCardHtml(item, { active = false } = {}) {
  const core = item.requiredTables.map((table) => SCHEMAS[table]?.title || table).join(' · ') || 'No enforced child-record minimums';
  return `<article class="protocol-card ${active ? 'active' : ''}"><div class="eyebrow">${active ? 'Active template' : `Protocol v${escapeHtml(item.version)}`}</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><div class="protocol-meta"><strong>Core records:</strong> ${escapeHtml(core)}</div><div class="actions">${active ? '<span class="badge">Selected</span>' : `<button class="button secondary small" data-action="activate-protocol" data-protocol-id="${escapeHtml(item.id)}">Use this protocol</button>`}</div></article>`;
}
function protocolProgressHtml(item) {
  const states = protocolChecklistState(item, recordsByTable);
  const done = states.filter((row) => row.complete).length;
  return `<section class="card protocol-progress"><div class="section-head"><div><h2>Protocol: ${escapeHtml(item.name)}</h2><p>${escapeHtml(item.description)}</p></div><div class="metric">${done}/${states.length}</div></div><ol class="protocol-checklist">${states.map((row) => `<li class="${row.complete ? 'complete' : ''}"><span>${row.complete ? '✓' : '○'}</span><div><strong>${escapeHtml(row.label)}</strong>${row.table !== 'review' ? `<small>${row.count ? `${row.count} saved` : 'Not recorded yet'}</small>` : '<small>Use the QA/QC screen before export.</small>'}</div></li>`).join('')}</ol><div class="actions"><button class="button secondary" data-view="protocol">Change / review protocol</button><button class="button" data-view="records">Open field records</button></div></section>`;
}
function protocolContent() {
  const selected = activeProtocol();
  const roleRows = RECORD_TABLES.map((table) => `<tr><th>${escapeHtml(SCHEMAS[table].title)}</th><td><span class="badge protocol-role ${tableRole(selected, table)}">${escapeHtml(tableRoleLabel(tableRole(selected, table)))}</span></td><td>${recordsByTable[table]?.length || 0}</td></tr>`).join('');
  return `<section class="section-head"><div><h2>Survey protocol</h2><p>Select a template before the field day. It guides the record screens, presets relevant field values, and adds protocol-specific QA/QC rules. It does not delete optional EcoSurvey records.</p></div></section><div class="notice ${selected.id === 'custom_general' ? '' : 'good'}"><strong>Active:</strong> ${escapeHtml(selected.name)} · template v${escapeHtml(selected.version)}. ${escapeHtml(selected.description)}</div><section class="card"><h3>Current record plan</h3><table class="table"><thead><tr><th>Record type</th><th>Template role</th><th>Saved</th></tr></thead><tbody>${roleRows}</tbody></table><p class="footer-note">Core means the protocol checks for at least one record of that type. Recommended remains available but does not block completion. Optional records remain accessible for defensible context.</p></section><section class="grid protocol-grid">${PROTOCOLS.map((item) => protocolCardHtml(item, { active: item.id === selected.id })).join('')}</section><div class="notice">Changing a template after records exist does not change historical data, but it makes the saved QA/QC run stale. Review the new completion rules and rerun QA/QC before export.</div>`;
}


function sensorProfileTimeLabel(value = '') {
  const ms = new Date(value || '').getTime();
  return Number.isFinite(ms) ? `${new Date(ms).toISOString().slice(11, 19)}Z` : '—';
}
function sensorProfileNumber(value, digits = 2) {
  const n = Number(value); return Number.isFinite(n) ? n.toFixed(digits).replace(/\.00$/, '') : '—';
}
function currentSensorProfileSelection() {
  const streams = recordsByTable.sensor_streams || [];
  if (!streams.length) return { streams, stream: null, readings: [], metrics: [], profile: null, links: [] };
  if (!streams.some((item) => item.sensor_stream_id === sensorProfileState.streamId)) sensorProfileState.streamId = streams[0].sensor_stream_id;
  const stream = streams.find((item) => item.sensor_stream_id === sensorProfileState.streamId) || streams[0];
  const readings = (recordsByTable.sensor_readings || []).filter((row) => String(row.sensor_stream_id || '') === String(stream.sensor_stream_id || ''));
  const metrics = availableSensorMetrics(readings);
  if (!metrics.some((item) => item.key === sensorProfileState.metricKey)) sensorProfileState.metricKey = metrics[0]?.key || 'depth_m';
  const profile = buildSensorProfile(readings, sensorProfileState.metricKey, { timeBasis: sensorProfileState.timeBasis, maxPoints: 900 });
  const links = linkVideoLogsToSensorStream(recordsByTable.video_logs || [], stream, readings, { toleranceSeconds: sensorProfileState.toleranceSeconds });
  return { streams, stream, readings, metrics, profile, links };
}
function renderSensorProfileChart(profile) {
  if (!profile?.count) return `<div class="sensor-profile-empty"><strong>No usable ${escapeHtml(sensorMetricLabel(profile?.metric?.key || sensorProfileState.metricKey))} values.</strong><br>Choose another metric or confirm the imported CSV column mapping.</div>`;
  const chart = profileChartGeometry(profile, { width: 960, height: 330 });
  const yGrid = chart.yTicks.map((tick) => `<g><line class="sensor-chart-grid" x1="${chart.pad.left}" y1="${tick.y.toFixed(2)}" x2="${(chart.width-chart.pad.right).toFixed(2)}" y2="${tick.y.toFixed(2)}"/><text class="sensor-chart-label" x="${(chart.pad.left-8).toFixed(2)}" y="${(tick.y+4).toFixed(2)}" text-anchor="end">${escapeHtml(sensorProfileNumber(tick.value, 2))}</text></g>`).join('');
  const xGrid = chart.xTicks.map((tick) => `<g><line class="sensor-chart-grid vertical" x1="${tick.x.toFixed(2)}" y1="${chart.pad.top}" x2="${tick.x.toFixed(2)}" y2="${(chart.height-chart.pad.bottom).toFixed(2)}"/><text class="sensor-chart-label" x="${tick.x.toFixed(2)}" y="${(chart.height-16).toFixed(2)}" text-anchor="middle">${escapeHtml(sensorProfileTimeLabel(new Date(tick.timeMs).toISOString()))}</text></g>`).join('');
  const dots = chart.points.length <= 180 ? chart.points.map((point) => `<circle class="sensor-chart-point" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="2.2"><title>${escapeHtml(`${sensorProfileTimeLabel(new Date(point.timeMs).toISOString())} · ${sensorProfileNumber(point.value, 3)} ${profile.metric.unit || ''}`)}</title></circle>`).join('') : '';
  const note = profile.sampledCount < profile.count ? `Display uses ${profile.sampledCount.toLocaleString()} evenly sampled points from ${profile.count.toLocaleString()} valid readings; exports retain every imported reading.` : `${profile.count.toLocaleString()} valid reading${profile.count === 1 ? '' : 's'} displayed.`;
  return `<div class="sensor-chart-wrap"><svg class="sensor-chart" viewBox="0 0 ${chart.width} ${chart.height}" role="img" aria-label="${escapeHtml(sensorMetricLabel(profile.metric.key))} over time"><rect class="sensor-chart-background" width="${chart.width}" height="${chart.height}" rx="14"/>${yGrid}${xGrid}<path class="sensor-chart-line" d="${chart.path}"/>${dots}<text class="sensor-chart-axis-title" x="${chart.pad.left}" y="15">${escapeHtml(sensorMetricLabel(profile.metric.key))}${profile.metric.invertY ? ' · increasing downward' : ''}</text><text class="sensor-chart-axis-title" x="${chart.width-chart.pad.right}" y="15" text-anchor="end">${profile.basis === 'sensor_clock' ? 'Sensor clock' : 'Estimated mission time'}</text></svg><p class="footer-note">${escapeHtml(note)} The chart is for field review; it does not smooth or alter the stored sensor values.</p></div>`;
}
function sensorSnapshotInline(reading = {}) {
  if (!reading?.sensor_reading_id) return '<span class="muted">No reading within tolerance</span>';
  const values = [
    ['Depth', reading.depth_m, 'm'], ['Temp', reading.temperature_c, '°C'], ['Sal.', reading.salinity_psu, 'PSU'], ['DO', reading.dissolved_oxygen_mg_l, 'mg/L'], ['Turb.', reading.turbidity_ntu, 'NTU']
  ].filter(([, value]) => Number.isFinite(Number(value))).map(([label, value, unit]) => `<span>${escapeHtml(label)} ${escapeHtml(sensorProfileNumber(value, 2))} ${escapeHtml(unit)}</span>`).join(' · ');
  return values || '<span class="muted">Matched reading has no displayed environmental variables</span>';
}
function sensorProfilesContent() {
  const selection = currentSensorProfileSelection();
  if (!selection.streams.length) return `<section class="section-head"><div><h2>Sensor profiles</h2><p>Review synchronized CTD, depth, temperature, salinity, turbidity, dissolved-oxygen, and custom sensor streams against ROV video-event time.</p></div><div class="actions"><button class="button" data-action="open-sensor-import">Import sensor CSV</button></div></section><div class="empty"><strong>No sensor streams are available yet.</strong><br>Import a logger CSV, optionally link it to an ROV operation, and record the logger timestamp at physical launch. EcoSurvey will retain the raw readings offline, produce a sensor profile, and link video events to the nearest synchronized reading.</div>`;
  const { streams, stream, readings, metrics, profile, links } = selection;
  const summary = profileSummary(profile);
  const streamOptions = streams.map((row) => `<option value="${escapeHtml(row.sensor_stream_id)}" ${row.sensor_stream_id === stream.sensor_stream_id ? 'selected' : ''}>${escapeHtml(row.stream_name || row.sensor_stream_id)} · ${Number(row.imported_row_count || 0).toLocaleString()} readings</option>`).join('');
  const metricOptions = metrics.length ? metrics.map((metric) => `<option value="${metric.key}" ${metric.key === sensorProfileState.metricKey ? 'selected' : ''}>${escapeHtml(sensorMetricLabel(metric.key))}</option>`).join('') : `<option value="">No numeric metrics</option>`;
  const linkedCount = linkedVideoLogsForStream(recordsByTable.video_logs || [], stream).length;
  const matched = links.filter((row) => row.within_tolerance).length;
  const summaryCards = `<div class="grid sensor-profile-metrics"><article class="card"><div class="metric">${summary.reading_count.toLocaleString()}</div><div class="label">Valid profile readings</div></article><article class="card"><div class="metric">${summary.minimum === '' ? '—' : escapeHtml(sensorProfileNumber(summary.minimum, 2))}</div><div class="label">Minimum ${escapeHtml(profile.metric?.unit || '')}</div></article><article class="card"><div class="metric">${summary.maximum === '' ? '—' : escapeHtml(sensorProfileNumber(summary.maximum, 2))}</div><div class="label">Maximum ${escapeHtml(profile.metric?.unit || '')}</div></article><article class="card"><div class="metric">${matched}/${linkedCount}</div><div class="label">Video logs matched</div></article></div>`;
  const videoRows = links.length ? `<table class="table sensor-link-table"><thead><tr><th>Video event</th><th>Mission time</th><th>Nearest sensor reading</th><th>Δt</th><th>Snapshot</th><th></th></tr></thead><tbody>${links.map((link) => `<tr class="${link.within_tolerance ? '' : 'unmatched'}"><td><strong>${escapeHtml(link.video_log.video_timecode || '—')}</strong><br><span class="muted">${escapeHtml(link.video_log.event_type || 'video event')}</span></td><td>${escapeHtml(sensorProfileTimeLabel(link.target_mission_datetime_utc))}</td><td>${link.sensor_reading ? `<code>${escapeHtml(link.sensor_reading.sensor_reading_id)}</code><br><span class="muted">${escapeHtml(sensorProfileTimeLabel(link.sensor_datetime_utc))}</span>` : '<span class="muted">No match</span>'}</td><td>${link.delta_seconds === null ? '—' : `${escapeHtml(sensorProfileNumber(link.delta_seconds, 1))} s`}${link.within_tolerance ? '' : '<br><span class="warning">outside tolerance</span>'}</td><td>${sensorSnapshotInline(link.sensor_reading)}</td><td><button class="button ghost small" data-action="profile-open-video-log" data-id="${escapeHtml(link.video_log.video_log_id)}">Open</button></td></tr>`).join('')}</tbody></table>` : `<div class="empty">This stream is not linked to an ROV operation with saved video-log events. It can still be charted and exported.</div>`;
  return `<section class="section-head"><div><h2>Sensor profiles & video sync</h2><p>Review raw logger values over time and link each ROV video event to its nearest synchronized sensor reading. This screen is offline-first and uses the time anchors recorded during sensor import.</p></div><div class="actions"><button class="button secondary" data-action="open-sensor-import">Import sensor CSV</button><button class="button secondary" data-action="download-sensor-profile-csv">Download selected-stream CSV</button><button class="button secondary" data-action="download-video-sensor-join-csv">Download video–sensor CSV</button></div></section><section class="card sensor-profile-controls"><div class="form-grid"><div class="field full"><label for="sensor_profile_stream">Sensor stream</label><select id="sensor_profile_stream" data-sensor-profile-control="streamId">${streamOptions}</select><div class="help">${escapeHtml(stream.instrument_id || 'Instrument not recorded')} · ${escapeHtml(stream.stream_type || 'custom')} · source: ${escapeHtml(stream.source_filename || 'not recorded')}</div></div><div class="field"><label for="sensor_profile_metric">Profile variable</label><select id="sensor_profile_metric" data-sensor-profile-control="metricKey">${metricOptions}</select></div><div class="field"><label for="sensor_profile_time">X axis</label><select id="sensor_profile_time" data-sensor-profile-control="timeBasis"><option value="mission_time" ${sensorProfileState.timeBasis === 'mission_time' ? 'selected' : ''}>Estimated mission time</option><option value="sensor_clock" ${sensorProfileState.timeBasis === 'sensor_clock' ? 'selected' : ''}>Raw sensor clock</option></select></div><div class="field"><label for="sensor_profile_tolerance">Video-match tolerance</label><select id="sensor_profile_tolerance" data-sensor-profile-control="toleranceSeconds">${[15,30,60,90,120,300].map((seconds) => `<option value="${seconds}" ${Number(sensorProfileState.toleranceSeconds) === seconds ? 'selected' : ''}>± ${seconds} seconds</option>`).join('')}</select></div></div><div class="notice ${stream.rov_operation_id ? 'good' : ''}">${stream.rov_operation_id ? `<strong>ROV linked:</strong> ${escapeHtml(stream.rov_operation_id)}. The chart uses ${sensorProfileState.timeBasis === 'mission_time' ? 'sensor-clock offset plus mission time' : 'raw sensor-clock time'}.` : '<strong>Not ROV linked:</strong> chart review is available, but video-event synchronization requires linking the stream to an ROV operation during import.'}</div></section>${summaryCards}<section class="card sensor-profile-chart-card"><div class="section-head"><div><h3>${escapeHtml(sensorMetricLabel(profile.metric?.key || sensorProfileState.metricKey))}</h3><p>${escapeHtml(profile.firstTime ? `${profile.firstTime} to ${profile.lastTime}` : 'No valid timestamps')} · ${profile.durationSeconds === null ? 'duration unavailable' : `${Math.floor(profile.durationSeconds / 60)} min ${profile.durationSeconds % 60} sec`}</p></div><span class="badge">Raw readings retained</span></div>${renderSensorProfileChart(profile)}</section><section class="card"><div class="section-head"><div><h3>ROV video-event environmental snapshots</h3><p>Each event is matched to the nearest reading in this stream using estimated mission time. Review events outside the selected tolerance before treating the snapshot as synchronized evidence.</p></div><span class="badge">${matched}/${linkedCount} matched</span></div>${videoRows}</section><p class="footer-note">The selected-stream CSV contains every imported reading for this stream. The video–sensor CSV is a reproducible nearest-reading join and includes the match tolerance and time delta. The original logger file remains the archival source.</p>`;
}
function handleSensorProfileControl(event) {
  const field = event.currentTarget.dataset.sensorProfileControl;
  if (!field) return;
  sensorProfileState[field] = field === 'toleranceSeconds' ? Number(event.currentTarget.value) : event.currentTarget.value;
  render();
}
function downloadSelectedSensorProfileCsv() {
  const { stream, readings } = currentSensorProfileSelection();
  if (!stream) return alert('Select or import a sensor stream first.');
  downloadBlobFile(toCsv(readings), `EcoSurvey_${String(activeSurvey?.mission?.mission_id || 'mission')}_${String(stream.sensor_stream_id || 'sensor_stream')}_readings.csv`, 'text/csv;charset=utf-8');
}
function downloadVideoSensorJoinCsv() {
  const { stream, links } = currentSensorProfileSelection();
  if (!stream) return alert('Select or import a sensor stream first.');
  const rows = videoSensorJoinRows(links);
  downloadBlobFile(toCsv(rows), `EcoSurvey_${String(activeSurvey?.mission?.mission_id || 'mission')}_${String(stream.sensor_stream_id || 'sensor_stream')}_video_sensor_join.csv`, 'text/csv;charset=utf-8');
}

function nav() {
  return `<nav class="nav">${[['home','Home'],['mission','Mission & site'],['protocol','Protocol'],['records','Records'],['species','Species lists'],['profiles','Sensor profiles'],['map','Map & GeoJSON'],['debrief','Field debrief'],['review','QA/QC & export']].map(([key,label]) => `<button data-view="${key}" class="${view===key?'active':''}">${label}</button>`).join('')}</nav>`;
}

function header() {
  const title = activeSurvey?.mission?.mission_id || 'No active mission';
  return `<header class="topbar"><div class="brand"><span class="brand-mark">⌖</span><span>EcoSurvey Field App</span></div><div class="mission-chip">${escapeHtml(title)} · offline-first field records</div><div class="install-tip">PWA v0.15 · protocol-guided field records, ROV/video-linked sensor profiles, sample custody, taxon packs, maps, QA/QC, and mission data stay on this device until exported</div></header>`;
}

function counts() { return Object.fromEntries(RECORD_TABLES.map((table) => [table, recordsByTable[table]?.length || 0])); }

function render() {
  app.innerHTML = `${header()}${nav()}<main class="main">${activeSurvey ? activeContent() : startContent()}</main>`;
  bindGlobal();
}

function startContent() {
  return `<section class="hero"><h1>Build a defensible field record—offline.</h1><p>Start a mission and site, then collect equipment checks, stations, transects, environmental measurements, observations, and media records. The export matches your existing EcoSurvey QA/QC workflow.</p><div class="actions"><button class="button" data-action="new-survey">Create mission & site</button><button class="button secondary" data-action="load-demo">Load demo mission</button></div></section><section class="section-head"><div><h2>Why this is the next EcoSurvey layer</h2><p>It makes your mobile form, data model, and QA/QC process into one extendable application.</p></div></section><div class="grid cards"><article class="card"><div class="metric">Offline</div><div class="label">IndexedDB field storage</div></article><article class="card"><div class="metric">GPS</div><div class="label">Device coordinate capture</div></article><article class="card"><div class="metric">CSV</div><div class="label">QA/QC-ready export tables</div></article><article class="card"><div class="metric">PWA</div><div class="label">Installable on HTTPS hosting</div></article></div><div class="notice">Field-readiness note: v0.2 runs the full EcoSurvey QA/QC gate inside the app and saves each QA/QC run locally. Keep the Python importer for ODK/Kobo exports or independent cross-checks.</div>`;
}

function activeContent() {
  if (view === 'mission') return missionContent();
  if (view === 'protocol') return protocolContent();
  if (view === 'records') return recordsContent();
  if (view === 'species') return speciesContent();
  if (view === 'profiles') return sensorProfilesContent();
  if (view === 'map') return mapContent();
  if (view === 'debrief') return debriefContent();
  if (view === 'review') return reviewContent();
  return homeContent();
}

function homeContent() {
  const c = counts(); const findings = validateSurvey(activeSurvey, recordsByTable); const errors = findings.filter((x)=>x.severity==='error').length; const item = activeProtocol();
  return `<section class="hero"><h1>${escapeHtml(activeSurvey.mission.mission_name || 'Untitled mission')}</h1><p>${escapeHtml(activeSurvey.site.site_name || 'No site details saved yet')} · ${escapeHtml(activeSurvey.mission.objective || 'Add an objective in Mission & site.')}</p><div class="actions"><button class="button" data-action="open-quick-observation">Quick observation</button><button class="button" data-action="add-sample-record">Add sample</button><button class="button secondary" data-action="open-rov-operation">Start ROV operation</button><button class="button secondary" data-action="open-rov-video-log">Log ROV video event</button><button class="button secondary" data-action="open-sensor-import">Import sensor CSV</button><button class="button secondary" data-view="profiles">Sensor profiles</button><button class="button secondary" data-view="records">Add field record</button><button class="button secondary" data-action="open-media-capture">Capture field media</button><button class="button secondary" data-action="open-track-form">Start GPS track</button><button class="button secondary" data-view="map">Open mission map</button><button class="button secondary" data-view="debrief">Field debrief</button><button class="button ghost" data-view="review">Review & export</button></div></section><div class="grid cards"><article class="card"><div class="metric">${c.stations}</div><div class="label">Stations</div></article><article class="card"><div class="metric">${c.transects}</div><div class="label">Transects</div></article><article class="card"><div class="metric">${c.observations}</div><div class="label">Observations</div></article><article class="card"><div class="metric">${c.samples || 0}</div><div class="label">Samples</div></article><article class="card"><div class="metric">${c.custody || 0}</div><div class="label">Custody events</div></article><article class="card"><div class="metric">${c.rov_operations || 0}</div><div class="label">ROV operations</div></article><article class="card"><div class="metric">${c.video_logs || 0}</div><div class="label">ROV video logs</div></article><article class="card"><div class="metric">${c.sensor_streams || 0}</div><div class="label">Sensor streams</div></article><article class="card"><div class="metric">${c.sensor_readings || 0}</div><div class="label">Sensor readings</div></article><article class="card"><div class="metric">${c.media}</div><div class="label">Media records</div></article><article class="card"><div class="metric" style="color:${errors?'var(--danger)':'var(--brand)'}">${errors}</div><div class="label">Local review errors</div></article></div>${protocolProgressHtml(item)}<p class="footer-note">The browser stores this active mission locally. Export a backup after every field day, then archive it with the QA/QC output and original media.</p>`;
}

function missionContent() {
  const mission = activeSurvey.mission || {}; const site = activeSurvey.site || {}; const protocolItem = activeProtocol();
  return `<section class="section-head"><div><h2>Mission & site</h2><p>These two records anchor every child record in the app.</p></div><div class="actions"><button class="button secondary" data-view="protocol">Protocol: ${escapeHtml(protocolItem.name)}</button><button class="button secondary" data-action="open-survey-picker">Switch mission</button><button class="button danger" data-action="delete-survey">Delete active mission</button></div></section><div class="split"><section class="card"><h3>Mission</h3>${summaryList('mission', mission)}<button class="button" data-action="edit-singleton" data-table="mission">Edit mission</button></section><section class="card"><h3>Site</h3>${summaryList('site', site)}<button class="button" data-action="edit-singleton" data-table="site">Edit site</button></section></div><div class="notice"><strong>Protocol metadata is saved with the mission:</strong> ${escapeHtml(protocolItem.name)} v${escapeHtml(mission.protocol_version || protocolItem.version)}. This app follows the same “one mission + one site per submission” model as the XLSForm. To add another site, create a new mission-site record and reuse the Mission ID.</div>`;
}

function summaryList(table, record) {
  const schema = SCHEMAS[table];
  if (!record || !Object.keys(record).length) return '<p class="empty">Not saved yet.</p>';
  return `<table class="table">${schema.fields.filter((field) => !['computed','file','location','textarea'].includes(field.type)).slice(0,10).map((field) => `<tr><th>${escapeHtml(field.label)}</th><td>${escapeHtml(record[field.name] || '—')}</td></tr>`).join('')}</table>`;
}

function recordsContent() {
  const schema = SCHEMAS[selectedTable]; const rows = recordsByTable[selectedTable] || []; const idField = schema.idField; const item = activeProtocol();
  const role = tableRole(item, selectedTable); const isSensorReadings = selectedTable === 'sensor_readings'; const displayRows = isSensorReadings && rows.length > 200 ? rows.slice(0, 200) : rows;
  const sensorActions = selectedTable === 'sensor_streams' || selectedTable === 'sensor_readings' ? '<button class="button" data-action="open-sensor-import">Import sensor CSV</button>' : '';
  const manualAdd = (isSensorReadings || selectedTable === 'sensor_streams') ? '' : `<button class="button" data-action="add-record" data-table="${selectedTable}">Add ${schema.title}</button>`;
  return `<section class="section-head"><div><h2>Field records <span class="badge protocol-role ${role}">${escapeHtml(tableRoleLabel(role))}</span></h2><p>${role === 'core' ? 'This protocol checks for this record type before mission completion.' : role === 'recommended' ? 'Recommended by the active protocol; save it when it supports defensible field interpretation.' : 'Optional for the active protocol; the full EcoSurvey record model remains available.'} IDs and parent links are generated automatically.</p></div><div class="actions field-record-actions"><button class="button secondary" data-action="open-media-capture">Capture field media</button><button class="button secondary" data-action="open-track-form">Start GPS track</button>${selectedTable==='rov_operations' ? '<button class="button" data-action="open-rov-operation">Add ROV operation</button>' : ''}${selectedTable==='video_logs' ? '<button class="button" data-action="open-rov-video-log">Quick video log</button>' : ''}${selectedTable==='observations' ? '<button class="button" data-action="open-quick-observation">Quick observation</button>' : ''}${selectedTable==='samples' ? '<button class="button secondary" data-action="export-sample-labels">Export label CSV</button>' : ''}${sensorActions}${manualAdd}</div></section><div class="record-tabs">${RECORD_TABLES.map((table) => { const tableRoleName = tableRole(item, table); return `<button class="${selectedTable===table?'active':''}" data-action="select-table" data-table="${table}">${SCHEMAS[table].icon} ${SCHEMAS[table].title} <span class="badge protocol-role ${tableRoleName}">${tableRoleLabel(tableRoleName)}</span> <span class="badge">${recordsByTable[table].length}</span></button>`; }).join('')}</div>${isSensorReadings && rows.length > displayRows.length ? `<div class="notice">Showing the first ${displayRows.length} of ${rows.length.toLocaleString()} readings in the app record list to keep the phone responsive. QGIS/CSV exports include every imported reading.</div>` : ''}${rows.length ? `<div class="record-list">${displayRows.map((record) => recordRow(selectedTable, record, idField)).join('')}</div>` : `<div class="empty">No ${schema.title.toLowerCase()} records yet. Add the first one when you are ready.</div>`}<p class="footer-note">Adaptive forms show the active protocol’s core fields first. Open “Additional optional fields” when your protocol or local SOP needs more detail.</p>`;
}

function captureTargetForRecord(table, record) {
  if (table === 'stations') return `station:${record.station_sequence}`;
  if (table === 'transects') return `transect:${record.parent_station_sequence}:${record.transect_sequence}`;
  if (table === 'observations') return `observation:${record.observation_sequence}`;
  return 'site';
}

function recordRow(table, record, idField) {
  const title = record[idField] || 'Draft record';
  const subtitle = table==='rov_operations' ? `${record.vehicle_id || 'ROV'} · ${record.operation_status || 'planned'} · ${record.video_media_id || 'video not linked'}` : table==='video_logs' ? `${record.video_timecode || formatTimecode(record.video_elapsed_seconds) || '00:00:00'} · ${record.event_type || 'video event'} · ${record.candidate_taxon || record.event_description || 'No description'}` : table==='tracks' ? `${record.track_type || 'GPS'} · ${record.distance_m || '—'} m · ${record.point_count || 0} points` : table==='stations' ? `${record.primary_habitat || '—'} · ${record.depth_m || '—'} m` : table==='transects' ? `${record.length_m || '—'} m · ${record.bearing_deg || '—'}°` : table==='observations' ? (record.common_name || record.taxon_scientific_name || 'Unidentified observation') : table==='samples' ? `${record.sample_type || 'sample'} · ${record.storage_condition || 'storage not recorded'} · ${record.label_status || 'label not recorded'}` : table==='custody' ? `${record.custody_event || 'custody event'} · ${record.from_custodian || '—'} → ${record.to_custodian || '—'}` : table==='media' ? (record.file_name || record.file_name_manual || 'No filename') : table==='environment' ? `${record.temperature_c || '—'} °C · ${record.salinity_psu || '—'} PSU` : record.equipment_id || 'Equipment record';
  const capture = ['stations','transects','observations'].includes(table) ? `<button class="button ghost small" data-action="quick-capture-target" data-capture-target="${escapeHtml(captureTargetForRecord(table, record))}">Capture</button>` : '';
  const attachment = table === 'media' && record.attachment_id ? `<button class="button ghost small" data-action="download-attachment" data-attachment-id="${escapeHtml(record.attachment_id)}">File</button>` : '';
  const localTag = table === 'media' && record.attachment_id ? ` · local ${formatBytes(record.attachment_size_bytes || 0)}` : '';
  return `<article class="record-row"><div><div class="title">${escapeHtml(title)}</div><div class="meta">${escapeHtml(short(subtitle, 80))}${escapeHtml(localTag)}</div></div><div class="buttons">${capture}${attachment}<button class="button secondary small" data-action="edit-record" data-table="${table}" data-id="${escapeHtml(title)}">Edit</button><button class="button danger small" data-action="delete-record" data-table="${table}" data-id="${escapeHtml(title)}">Delete</button></div></article>`;
}


function mapLayerCheckbox(definition, model) {
  const checked = mapState.visibleLayers.has(definition.key) ? 'checked' : '';
  const total = model.shown[definition.key] || 0; const missing = model.notLocated[definition.key] || 0;
  return `<label class="map-layer-toggle"><input type="checkbox" data-action="toggle-map-layer" data-layer="${definition.key}" ${checked}/><span class="map-legend-dot" style="--map-layer:${definition.color}"></span><span>${escapeHtml(definition.label)}</span><span class="map-layer-count">${total}${missing ? ` · ${missing} unmapped` : ''}</span></label>`;
}

function activeBasemapForMap() {
  return activeBasemap && mapState.basemapVisible ? { ...activeBasemap, image_url: activeBasemap.image_url, opacity: mapState.basemapOpacity } : null;
}
function basemapSummary() {
  if (!activeBasemap) return '<div class="basemap-status empty-mini"><strong>No offline map pack selected.</strong><br>Use a locally saved PNG, JPEG, or WebP map image with WGS 84 bounds. The grid still works without one.</div>';
  return `<div class="basemap-status"><span class="badge">Stored offline</span><strong>${escapeHtml(activeBasemap.name)}</strong><span>${escapeHtml(activeBasemap.source_name)} · ${escapeHtml(activeBasemap.source_date)}</span><span>${Math.round((Number(activeBasemap.image_bytes) || 0) / 1024 / 1024 * 10) / 10} MB · ${escapeHtml(activeBasemap.original_filename || 'image')}</span></div>`;
}
function packRow(pack) {
  const active = pack.id === activeBasemapId;
  const fileSize = Math.round((Number(pack.image_bytes) || 0) / 1024 / 1024 * 10) / 10;
  return `<article class="record-row basemap-row"><div><div class="title">${escapeHtml(pack.name)} ${active ? '<span class="badge">Active</span>' : ''}</div><div class="meta">${escapeHtml(pack.source_name)} · ${escapeHtml(pack.source_date)} · ${fileSize} MB · bounds ${escapeHtml(pack.min_lon)}, ${escapeHtml(pack.min_lat)} to ${escapeHtml(pack.max_lon)}, ${escapeHtml(pack.max_lat)}</div></div><div class="buttons">${active ? '<button class="button ghost small" data-action="clear-active-basemap">Hide pack</button>' : `<button class="button secondary small" data-action="set-active-basemap" data-basemap-id="${escapeHtml(pack.id)}">Use on map</button>`}<button class="button ghost small" data-action="download-basemap-image" data-basemap-id="${escapeHtml(pack.id)}">Image</button><button class="button ghost small" data-action="download-basemap-metadata" data-basemap-id="${escapeHtml(pack.id)}">Metadata</button><button class="button danger small" data-action="delete-basemap" data-basemap-id="${escapeHtml(pack.id)}">Delete</button></div></article>`;
}
function mapContent() {
  const model = buildMapModel(activeSurvey, recordsByTable);
  const visible = model.features.filter((feature) => mapState.visibleLayers.has(feature.layer));
  const selected = model.features.find((feature) => feature.key === mapState.selectedKey && mapState.visibleLayers.has(feature.layer)) || null;
  const selectedInfo = selectedFeatureSummary(selected);
  const packForMap = activeBasemapForMap();
  const totalMapped = visible.length; const totalUnmapped = Object.values(model.notLocated).reduce((sum, value) => sum + value, 0);
  const listButtons = MAP_LAYERS.map((definition) => `<button class="button ghost small" data-action="download-geojson-layer" data-layer-file="${definition.filename}">${escapeHtml(definition.label)} GeoJSON</button>`).join('');
  const selectionCard = selectedInfo ? `<section class="map-selection"><div><div class="eyebrow">${escapeHtml(selectedInfo.layer)}</div><h3>${escapeHtml(selectedInfo.title)}</h3><p class="map-selection-id">${escapeHtml(selectedInfo.id)}</p><dl class="map-details"><div><dt>Map position</dt><dd>${escapeHtml(selectedInfo.coordinates)}</dd></div><div><dt>Coordinate source</dt><dd>${escapeHtml(selectedInfo.coordinateSource)}</dd></div><div><dt>Field summary</dt><dd>${escapeHtml(selectedInfo.extra)}</dd></div></dl></div><div class="actions">${selectedInfo.table === 'site' ? '<button class="button secondary small" data-action="map-open-site">Open mission & site</button>' : `<button class="button secondary small" data-action="map-open-record" data-table="${escapeHtml(selectedInfo.table)}" data-id="${escapeHtml(selectedInfo.id)}">Open record</button>`}${['site','stations','transects','observations'].includes(selectedInfo.table) ? `<button class="button ghost small" data-action="quick-capture-target" data-capture-target="${escapeHtml(captureTargetForRecord(selectedInfo.table, selected.properties || {}))}">Capture media</button>` : ''}<button class="button ghost small" data-action="clear-map-selection">Clear selection</button></div></section>` : `<section class="map-selection muted"><strong>Tap a point or transect.</strong><br>Its linked record, coordinate source, and field summary will appear here.</section>`;
  const mapStatus = totalMapped ? `<span class="badge">${totalMapped} visible feature${totalMapped === 1 ? '' : 's'}</span>${activeTrackId ? ' <span class="recording-badge">GPS track recording</span>' : ''}` : '<span class="badge">No mapped features</span>';
  const packNotice = activeBasemap ? `Using “${escapeHtml(activeBasemap.name)}” as a locally stored image overlay. Its source, date, and geographic bounds are shown below and preserved in metadata export.` : 'No map pack is selected. This screen remains a GPS/grid map until you import a locally prepared image overlay.';
  return `<section class="section-head"><div><h2>Mission map & GeoJSON</h2><p>Confirm station placement, transect coverage, observations, environmental readings, and media references before leaving the site. Basemap packs are optional and remain on this device.</p></div><div class="actions"><button class="button" data-action="open-basemap-form">Import offline map pack</button><button class="button secondary" data-action="open-basemap-manager">Manage packs</button><button class="button secondary" data-action="capture-map-location">Show my device location</button>${activeTrackId ? `<button class="button danger" data-action="stop-gps-track">Stop GPS track</button>` : '<button class="button secondary" data-action="open-track-form">Start GPS track</button>'}<button class="button secondary" data-action="start-transect-builder" ${recordsByTable.stations?.length ? '' : 'disabled'}>Build transect</button>${mapState.currentLocation ? '<button class="button ghost" data-action="clear-map-location">Clear device location</button>' : ''}</div></section>
  <div class="notice">${packNotice} EcoSurvey includes a bundled, low-detail global Earth reference for orientation and retains project-specific map packs for detailed field context. It does not download third-party tiles or silently cache imagery. Import only maps you are allowed to store, record their date/source, and verify geographic bounds before field navigation.</div>
${transectBuilderPanel()}
  <section class="card map-card"><div class="map-toolbar"><div><h3>Field geometry</h3><p>${mapStatus}${totalUnmapped ? ` <span class="map-unmapped">${totalUnmapped} record${totalUnmapped === 1 ? '' : 's'} cannot yet be shown</span>` : ''}</p></div><div class="actions"><button class="button ghost small" data-action="map-fit">Fit field records</button><button class="button ghost small" data-action="show-world-view">Full Earth view</button></div></div><div class="map-layout"><div class="map-canvas">${renderMapSvg(visible, mapState.currentLocation, mapState.selectedKey, packForMap, mapState.worldView ? null : transectBuilder, { worldReference, worldReferenceVisible: mapState.worldReferenceVisible, worldView: mapState.worldView })}</div><aside class="map-sidebar"><h3>Visible layers</h3>${MAP_LAYERS.map((definition) => mapLayerCheckbox(definition, model)).join('')}<div class="map-basemap-controls"><h3>Default Earth reference</h3><div class="basemap-status"><span class="badge">Bundled offline</span><strong>${escapeHtml(WORLD_REFERENCE_META.name)}</strong><span>${escapeHtml(WORLD_REFERENCE_META.source)} · ${escapeHtml(WORLD_REFERENCE_META.crs)}</span><span>${worldReference ? 'Ready on this device.' : escapeHtml(worldReferenceError || 'Loading…')}</span></div><label class="map-layer-toggle"><input type="checkbox" data-action="toggle-world-reference" ${mapState.worldReferenceVisible ? 'checked' : ''}/><span class="map-legend-dot map-world-dot"></span><span>Show Earth reference</span></label><div class="map-legend-note">Use <strong>Full Earth view</strong> for global orientation, then <strong>Fit field records</strong> for survey work. It is a low-detail world reference, not a navigation chart or imagery.</div></div><div class="map-basemap-controls"><h3>Project-specific offline maps</h3>${basemapSummary()}${activeBasemap ? `<label class="map-layer-toggle"><input type="checkbox" data-action="toggle-basemap" ${mapState.basemapVisible ? 'checked' : ''}/><span class="map-legend-dot map-basemap-dot"></span><span>Show image overlay</span></label><label class="map-opacity-label">Overlay opacity <input type="range" min="20" max="100" value="${Math.round(mapState.basemapOpacity * 100)}" data-action="set-basemap-opacity"/> <span>${Math.round(mapState.basemapOpacity * 100)}%</span></label>` : '<button class="button ghost small" data-action="open-basemap-form">Import image pack</button>'}</div><div class="map-legend-note">Lines use measured transect start/end coordinates. Point layers may use independent GPS or linked station, transect-start, or site GPS.</div></aside></div>${selectionCard}</section>
  <section class="card"><div class="section-head"><div><h3>Direct GeoJSON / QGIS export</h3><p>These files reflect the mission as it is currently stored. Run Full QA/QC before treating any export as the final archived dataset.</p></div></div><div class="actions"><button class="button" data-action="download-geojson-qgis-zip">Download QGIS GeoJSON ZIP</button><button class="button secondary" data-action="download-combined-geojson">Download combined GeoJSON</button>${listButtons}</div><p class="footer-note">QGIS opens these vectors in EPSG:4326 (WGS 84). The QGIS ZIP now includes a bundled global Earth reference in <code>reference_layers/</code>; unzip the package before adding the individual <code>.geojson</code> files to QGIS. Project image basemaps remain separate from the scientific data archive.</p></section>`;
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read local image.'));
    reader.readAsDataURL(blob);
  });
}
async function loadDebriefPhotos() {
  debriefPhotos = []; debriefPhotoOmitted = 0;
  if (!activeSurvey) return;
  const records = recordsByTable.media || []; const recordByMediaId = new Map(records.map((row) => [row.media_id, row]));
  const attachments = await getAttachments(activeSurvey.id);
  const imageAttachments = attachments.filter((attachment) => String(attachment.type || attachment.blob?.type || '').startsWith('image/') && attachment.blob);
  const eligible = imageAttachments.filter((attachment) => Number(attachment.byte_size || attachment.blob?.size || 0) <= 12 * 1024 * 1024).slice(0, 3);
  debriefPhotoOmitted = Math.max(0, imageAttachments.length - eligible.length);
  debriefPhotos = await Promise.all(eligible.map(async (attachment) => {
    const media = recordByMediaId.get(attachment.mediaId) || {};
    return {
      src: await blobToDataUrl(attachment.blob),
      filename: attachment.filename || media.file_name || media.file_name_manual || 'Field photo',
      alt: media.description || attachment.filename || 'Field photo',
      caption: media.description || attachment.filename || 'Field photo'
    };
  }));
}
function debriefContent() {
  const current = latestRunIsCurrent();
  const debrief = buildFieldDebrief(activeSurvey, recordsByTable, latestQaqcRun, current);
  const photoNote = debriefPhotoOmitted ? ` ${debriefPhotoOmitted} locally stored photo${debriefPhotoOmitted === 1 ? '' : 's'} was omitted from this report because only the first three images at or below 12 MB are embedded.` : '';
  return `<section class="section-head"><div><h2>One-page field debrief</h2><p>Create a compact, print-ready end-of-mission summary before leaving the site. This report is a communication aid; the QA/QC mission ZIP remains the authoritative archive.</p></div><div class="actions"><button class="button" data-action="print-field-debrief">Print / Save as PDF</button><button class="button secondary" data-action="refresh-field-debrief">Refresh local photos</button><button class="button ghost" data-view="review">Open QA/QC</button></div></section><div class="notice ${debrief.qa.tone === 'good' ? 'good' : debrief.qa.tone === 'error' ? 'error' : ''}"><strong>QA/QC status: ${escapeHtml(debrief.qa.label)}.</strong> ${escapeHtml(debrief.qa.detail)} Run or rerun QA/QC after any record edit before sharing the report as a reviewed field summary.</div>${debriefPhotos.length ? '<div class="notice good">Up to three local photo attachments are embedded in the printed debrief.' + escapeHtml(photoNote) + '</div>' : '<div class="notice">No eligible local photos are embedded yet. The debrief will still list mission media records; external ROV, GoPro, sonar, and large video files remain in the media log.</div>'}<section class="debrief-app-preview">${renderFieldDebriefBody(debrief, debriefPhotos, { preview: true })}</section><p class="footer-note">The print window targets US Letter landscape. Keep browser headers/footers off for the compact one-page layout. The map is vector mission geometry only and intentionally does not embed your offline basemap image.</p>`;
}
async function printFieldDebrief() {
  await loadDebriefPhotos();
  const debrief = buildFieldDebrief(activeSurvey, recordsByTable, latestQaqcRun, latestRunIsCurrent());
  const popup = window.open('', '_blank');
  if (!popup) return alert('The browser blocked the report window. Allow pop-ups for EcoSurvey, then select Print / Save as PDF again.');
  popup.document.open(); popup.document.write(renderFieldDebriefDocument(debrief, debriefPhotos)); popup.document.close();
}

function latestRunIsCurrent() {
  return Boolean(latestQaqcRun && activeSurvey && latestQaqcRun.data_fingerprint === dataFingerprint(activeSurvey, recordsByTable));
}
function qaStatusLabel() {
  if (!latestQaqcRun) return 'Not run';
  if (!latestRunIsCurrent()) return 'Stale — records changed';
  return latestQaqcRun.summary?.status || 'Completed';
}
function findingsHtml(findings) {
  if (!findings?.length) return '<div class="notice good">No findings. This mission passed the in-app QA/QC checks.</div>';
  return `<div class="review-list">${findings.map((finding) => `<div class="finding ${escapeHtml(String(finding.severity || '').toLowerCase())}"><span class="where">${escapeHtml(finding.severity)} · ${escapeHtml(finding.table)}${finding.record_id ? ` · ${escapeHtml(finding.record_id)}` : ''}</span><br><strong>${escapeHtml(finding.rule)}</strong> — ${escapeHtml(finding.message)}${finding.field ? `<div class="meta">Field: ${escapeHtml(finding.field)}</div>` : ''}</div>`).join('')}</div>`;
}
function reviewContent() {
  const options = activeSurvey.qaqc_options || { require_environment_per_station: true, bbox: {} };
  const current = latestRunIsCurrent(); const run = latestQaqcRun;
  const errors = run?.summary?.errors ?? 0; const warnings = run?.summary?.warnings ?? 0;
  const statusColor = !run || !current ? 'var(--warning)' : errors ? 'var(--danger)' : 'var(--brand)';
  const runNotice = !run ? '<div class="notice">No full QA/QC run has been saved for this mission. Run it before export.</div>' : !current ? '<div class="notice">The last QA/QC run is stale because mission, site, or record data changed. Run QA/QC again before exporting.</div>' : errors ? '<div class="notice error">Correct every blocking error before treating this mission as QA/QC-cleared.</div>' : '<div class="notice good">Current QA/QC run has no blocking errors. Review any warnings, then export the mission archive.</div>';
  const disabled = (!run || !current) ? 'disabled' : '';
  return `<section class="section-head"><div><h2>QA/QC & export</h2><p>The full QA/QC gate now runs inside EcoSurvey and is stored with the mission on this device.</p></div></section>
  <div class="grid cards"><article class="card"><div class="metric" style="color:${statusColor}">${errors}</div><div class="label">Blocking errors</div></article><article class="card"><div class="metric" style="color:${warnings ? 'var(--warning)' : 'var(--brand)'}">${warnings}</div><div class="label">Warnings</div></article><article class="card"><div class="metric" style="color:${statusColor}">${escapeHtml(qaStatusLabel())}</div><div class="label">QA/QC status</div></article><article class="card"><div class="metric">${RECORD_TABLES.reduce((n, table)=>n+recordsByTable[table].length,0)}</div><div class="label">Saved child records</div></article></div>
  ${runNotice}
  <section class="notice"><strong>Active protocol:</strong> ${escapeHtml(activeProtocol().name)} v${escapeHtml(activeSurvey.mission?.protocol_version || activeProtocol().version)}. Template-specific record and completion checks are included in this QA/QC run.</section>
  <section class="card"><div class="section-head"><div><h3>QA/QC settings</h3><p>These settings are saved with this mission and applied each time you run the full checks.</p></div></div><div class="form-grid"><div class="field full"><label><input id="qaqc-require-environment" type="checkbox" ${options.require_environment_per_station !== false ? 'checked' : ''}/> Require at least one linked environmental record per station</label><div class="help">Recommended for the core station-and-transect workflow.</div></div><div class="field"><label for="qaqc-min-lon">Study area min longitude</label><input id="qaqc-min-lon" type="number" step="any" value="${escapeHtml(options.bbox?.min_lon || '')}" placeholder="-76.0000"/></div><div class="field"><label for="qaqc-min-lat">Study area min latitude</label><input id="qaqc-min-lat" type="number" step="any" value="${escapeHtml(options.bbox?.min_lat || '')}" placeholder="38.0000"/></div><div class="field"><label for="qaqc-max-lon">Study area max longitude</label><input id="qaqc-max-lon" type="number" step="any" value="${escapeHtml(options.bbox?.max_lon || '')}" placeholder="-75.0000"/></div><div class="field"><label for="qaqc-max-lat">Study area max latitude</label><input id="qaqc-max-lat" type="number" step="any" value="${escapeHtml(options.bbox?.max_lat || '')}" placeholder="39.0000"/></div></div><div class="actions"><button class="button secondary" data-action="save-qaqc-options">Save QA/QC settings</button><button class="button" data-action="run-full-qaqc">${run ? 'Run QA/QC again' : 'Run Full QA/QC'}</button></div></section>
  <section class="card"><div class="section-head"><div><h3>Full QA/QC findings</h3><p>${run ? `Saved ${escapeHtml(new Date(run.created_at).toLocaleString())} · ruleset v${escapeHtml(run.tool_version || '')}` : 'Run QA/QC to create a report and a reviewable findings log.'}</p></div></div>${run ? findingsHtml(run.findings) : '<div class="empty">No QA/QC run saved yet.</div>'}</section>
  <section class="card"><h3>Mission archive</h3><p>Download one ZIP containing validated CSV tables, the QA/QC report, findings CSVs, a mission backup, and QGIS-ready GeoJSON layers. Locally attached media files are intentionally kept separate because they can be very large.</p><div class="actions"><button class="button" data-action="export-mission-qaqc-zip" ${disabled}>Download mission QA/QC ZIP</button><button class="button secondary" data-view="debrief">Open field debrief</button><button class="button secondary" data-action="download-qaqc-report" ${disabled}>Download report</button><button class="button secondary" data-action="download-qaqc-findings" ${disabled}>Download findings CSV</button><button class="button ghost" data-action="download-media">Download saved attachments</button><button class="button ghost" data-action="export-backup">Download full JSON backup</button><button class="button ghost" data-action="export-raw-csv">Raw CSV files only</button></div><p class="footer-note">Archive the ZIP and original media together under the Mission ID. The standalone Python importer remains available for ODK/Kobo exports and as an independent validation cross-check.</p></section>`;
}

function makeSurvey() {
  const id = crypto.randomUUID();
  const today = new Date().toISOString().slice(0,10);
  const initialProtocol = getProtocol(DEFAULT_PROTOCOL_ID);
  activeSurvey = { id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), mission: { mission_date: today, data_status: 'in_progress', ...protocolMissionFields(initialProtocol.id) }, site: { site_sequence: 1, country: 'United States', sensitive_site_flag: 'no' }, qaqc_options: { require_environment_per_station: initialProtocol.requireEnvironmentPerStation, bbox: {} } };
  recordsByTable = Object.fromEntries(RECORD_TABLES.map((table) => [table, []]));
  latestQaqcRun = null;
  stopTrackWatch(false); activeTrackId = null; transectBuilder = null;
  mapState = { visibleLayers: new Set(MAP_LAYERS.map((layer) => layer.key)), selectedKey: null, currentLocation: null, basemapVisible: true, basemapOpacity: 0.72 };
  basemapPacks = []; activeBasemap = null; activeBasemapId = ''; speciesLists = []; activeSpeciesListId = ''; activeSpeciesList = null; activeTaxa = []; favoriteTaxonIds = []; recentTaxonIds = []; if (basemapObjectUrl) { URL.revokeObjectURL(basemapObjectUrl); basemapObjectUrl = null; }
  return persistSurvey();
}

async function persistSurvey() { activeSurvey.updatedAt = new Date().toISOString(); await saveSurvey(activeSurvey); await setSetting('activeSurveyId', activeSurvey.id); }

function renderModal(title, body) { document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="modal"><section class="dialog"><div class="dialog-head"><h2>${escapeHtml(title)}</h2><button class="close" data-action="close-modal" aria-label="Close">×</button></div>${body}</section></div>`); bindModal(); }
function closeModal() { stopBarcodeScanner(); document.querySelector('#modal')?.remove(); pendingFiles.clear(); pendingCaptureFile = null; pendingCaptureLocation = null; pendingCaptureSource = 'device_camera'; pendingSensorImport = null; }

function stopBarcodeScanner() {
  if (barcodeScanTimer !== null) { clearInterval(barcodeScanTimer); barcodeScanTimer = null; }
  if (barcodeScanStream) { barcodeScanStream.getTracks().forEach((track) => track.stop()); barcodeScanStream = null; }
  barcodeDetector = null; barcodeScanTarget = '';
  const panel = document.querySelector('#barcode-scan-panel'); if (panel) panel.hidden = true;
}
function barcodeFormatToChoice(format = '') { const value = String(format || '').toLowerCase(); const map = { qr_code: 'qr', qr: 'qr', code_128: 'code_128', code_39: 'code_39', data_matrix: 'data_matrix', ean_13: 'ean_13', upc_a: 'upc_a' }; return map[value] || 'unknown'; }
async function startBarcodeScanner(targetField) {
  const input = document.querySelector(`#${targetField}`); const panel = document.querySelector('#barcode-scan-panel'); const video = document.querySelector('#barcode-scan-video'); const status = document.querySelector('#barcode-scan-status');
  if (!input || !panel || !video) return;
  if (!barcodeDetectorSupported() || !navigator.mediaDevices?.getUserMedia) { alert('Native camera label scanning is not available in this browser. Type or paste the QR/barcode value instead; this remains valid field data when the label format is recorded.'); return; }
  stopBarcodeScanner(); barcodeScanTarget = targetField; panel.hidden = false; if (status) status.textContent = 'Opening rear camera…';
  try {
    try { barcodeDetector = new BarcodeDetector({ formats: ['qr_code','code_128','code_39','data_matrix','ean_13','upc_a'] }); } catch { barcodeDetector = new BarcodeDetector(); }
    barcodeScanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = barcodeScanStream; await video.play(); if (status) status.textContent = 'Point the camera at the sample label.';
    barcodeScanTimer = setInterval(async () => {
      if (!barcodeDetector || !video.videoWidth) return;
      try { const results = await barcodeDetector.detect(video); const hit = results?.[0]; if (!hit?.rawValue) return; const target = document.querySelector(`#${barcodeScanTarget}`); if (target) target.value = normalizeSampleLabel(hit.rawValue); const format = document.querySelector('#barcode_format'); if (format) format.value = barcodeFormatToChoice(hit.format); const scannedAt = document.querySelector('#barcode_scanned_at'); if (scannedAt) scannedAt.value = isoNowLocalInput(); const labelStatus = document.querySelector('#label_status'); if (labelStatus && labelStatus.value === 'generated') labelStatus.value = 'applied'; if (status) status.textContent = `Scanned: ${normalizeSampleLabel(hit.rawValue)}`; stopBarcodeScanner(); } catch { /* retry next video frame */ }
    }, 380);
  } catch (error) { stopBarcodeScanner(); alert(`Camera scanner could not start: ${error.message || 'permission or HTTPS issue'}. Type the label value instead.`); }
}

async function imageDimensions(file) {
  if (typeof createImageBitmap === 'function') { const bitmap = await createImageBitmap(file); const result = { width: bitmap.width, height: bitmap.height }; bitmap.close?.(); return result; }
  return new Promise((resolve, reject) => { const url = URL.createObjectURL(file); const image = new Image(); image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }); }; image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image dimensions.')); }; image.src = url; });
}
async function loadBasemapPacks() {
  if (!activeSurvey) return;
  basemapPacks = await getBasemapPacks(activeSurvey.id);
  activeBasemapId = await getSetting(`activeBasemapPackId:${activeSurvey.id}`) || '';
  if (activeBasemapId && !basemapPacks.some((pack) => pack.id === activeBasemapId)) { activeBasemapId = ''; await setSetting(`activeBasemapPackId:${activeSurvey.id}`, ''); }
  await refreshActiveBasemap();
}
async function refreshActiveBasemap() {
  if (basemapObjectUrl) { URL.revokeObjectURL(basemapObjectUrl); basemapObjectUrl = null; }
  const pack = basemapPacks.find((item) => item.id === activeBasemapId) || null;
  if (!pack?.image_blob) { activeBasemap = null; return; }
  basemapObjectUrl = URL.createObjectURL(pack.image_blob);
  activeBasemap = { ...pack, image_url: basemapObjectUrl };
}
async function setActiveBasemap(id) {
  activeBasemapId = id || '';
  await setSetting(`activeBasemapPackId:${activeSurvey.id}`, activeBasemapId);
  await refreshActiveBasemap();
  render();
}
function suggestedBasemapBounds() {
  const model = buildMapModel(activeSurvey, recordsByTable);
  const scene = mapScene(model.features, null, null);
  if (scene.empty) return { minLon: '', minLat: '', maxLon: '', maxLat: '' };
  return { minLon: scene.minLon.toFixed(6), minLat: scene.minLat.toFixed(6), maxLon: scene.maxLon.toFixed(6), maxLat: scene.maxLat.toFixed(6) };
}
function openBasemapForm() {
  const bounds = suggestedBasemapBounds();
  const sizeLimit = Math.round(MAX_BASEMAP_BYTES / 1024 / 1024);
  const body = `<form id="basemap-form"><p class="modal-intro">Create a device-local map pack from a PNG, JPEG, or WebP image that you already have permission to use. Enter the WGS 84 extent represented by the image. EcoSurvey stores the image and metadata in this device’s IndexedDB; it does not contact or cache third-party map servers.</p><div class="form-grid"><div class="field full"><label for="basemap_image">Map image *</label><input id="basemap_image" name="basemap_image" type="file" accept="image/png,image/jpeg,image/webp" required/><div class="help">PNG, JPEG, or WebP. Keep the image at or below ${sizeLimit} MB for dependable offline use.</div></div><div class="field"><label for="basemap_name">Pack name *</label><input id="basemap_name" name="name" required placeholder="Pilot shoreline aerial — July 2026"/></div><div class="field"><label for="basemap_source">Source *</label><input id="basemap_source" name="source_name" required placeholder="QGIS project export / agency chart / authorized imagery"/></div><div class="field"><label for="basemap_date">Source/capture date *</label><input id="basemap_date" name="source_date" type="date" required/></div><div class="field"><label for="basemap_attribution">License / attribution</label><input id="basemap_attribution" name="attribution_or_license" placeholder="Required credit, data license, or internal source"/></div><div class="field"><label for="basemap_min_lon">Min longitude *</label><input id="basemap_min_lon" name="min_lon" required type="number" step="any" value="${escapeHtml(bounds.minLon)}"/></div><div class="field"><label for="basemap_min_lat">Min latitude *</label><input id="basemap_min_lat" name="min_lat" required type="number" step="any" value="${escapeHtml(bounds.minLat)}"/></div><div class="field"><label for="basemap_max_lon">Max longitude *</label><input id="basemap_max_lon" name="max_lon" required type="number" step="any" value="${escapeHtml(bounds.maxLon)}"/></div><div class="field"><label for="basemap_max_lat">Max latitude *</label><input id="basemap_max_lat" name="max_lat" required type="number" step="any" value="${escapeHtml(bounds.maxLat)}"/></div><div class="field full"><label for="basemap_notes">Notes</label><textarea id="basemap_notes" name="notes" placeholder="Purpose, preparation method, intended field use, or known limitations."></textarea></div></div><div id="basemap-errors" class="notice error" hidden></div><div id="basemap-warning" class="notice" hidden></div><div class="field-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button type="submit" class="button">Save offline map pack</button></div></form>`;
  renderModal('Import offline basemap pack', body);
}
function showBasemapErrors(errors) { const box = document.querySelector('#basemap-errors'); if (!box) return; box.hidden = false; box.innerHTML = `<strong>Cannot save map pack:</strong><ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>`; box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
async function handleBasemapSubmit(event) {
  event.preventDefault(); const form = event.currentTarget; const raw = Object.fromEntries(new FormData(form).entries()); const file = form.querySelector('[name="basemap_image"]')?.files?.[0] || null;
  const errors = validateBasemapInput(raw, file); if (errors.length) return showBasemapErrors(errors);
  let dims; try { dims = await imageDimensions(file); } catch (error) { return showBasemapErrors([error.message]); }
  const warning = aspectRatioWarning(raw, dims.width, dims.height); const warningBox = document.querySelector('#basemap-warning'); if (warning && warningBox) { warningBox.hidden = false; warningBox.textContent = warning; }
  const now = new Date().toISOString();
  const pack = { id: crypto.randomUUID(), surveyId: activeSurvey.id, name: raw.name.trim(), source_name: raw.source_name.trim(), source_date: raw.source_date, attribution_or_license: raw.attribution_or_license.trim(), min_lon: Number(raw.min_lon), min_lat: Number(raw.min_lat), max_lon: Number(raw.max_lon), max_lat: Number(raw.max_lat), notes: raw.notes.trim(), original_filename: file.name, image_mime: file.type, image_bytes: file.size, image_width: dims.width, image_height: dims.height, image_blob: file, createdAt: now, updatedAt: now };
  await saveBasemapPack(pack); basemapPacks = await getBasemapPacks(activeSurvey.id); await setActiveBasemap(pack.id); closeModal(); render();
}
function openBasemapManager() {
  const body = `<p class="modal-intro">Each pack is saved only on this device and tied to the active mission/site. Download the image and metadata if you need to preserve or reproduce the field map elsewhere.</p>${basemapPacks.length ? `<div class="record-list">${basemapPacks.map(packRow).join('')}</div>` : '<div class="empty">No map packs have been imported for this mission yet.</div>'}<div class="actions"><button class="button" data-action="open-basemap-form">Import offline map pack</button></div>`;
  renderModal('Offline map packs', body);
}
function downloadBlobFile(blob, filename, type = 'application/octet-stream') { const url = URL.createObjectURL(new Blob([blob], { type })); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
function getBasemapById(id) { return basemapPacks.find((pack) => pack.id === id) || null; }


function captureTargetOptions(preferred = 'site') {
  const options = [{ value: 'site', label: `Site only · ${activeSurvey.site?.site_id || 'site'}` }];
  (recordsByTable.stations || []).forEach((row) => options.push({ value: `station:${row.station_sequence}`, label: `Station ${String(row.station_sequence).padStart(2,'0')} · ${row.station_id || ''}` }));
  (recordsByTable.transects || []).forEach((row) => options.push({ value: `transect:${row.parent_station_sequence}:${row.transect_sequence}`, label: `Transect ${String(row.transect_sequence).padStart(2,'0')} · ${row.transect_id || ''}` }));
  (recordsByTable.observations || []).forEach((row) => options.push({ value: `observation:${row.observation_sequence}`, label: `Observation ${String(row.observation_sequence).padStart(3,'0')} · ${row.observation_id || row.common_name || ''}` }));
  return options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === preferred ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
}

function openMediaCapture(targetValue = 'site') {
  pendingCaptureFile = null; pendingCaptureLocation = null; pendingCaptureSource = 'device_camera';
  const target = parseCaptureTarget(targetValue);
  const targetText = targetLabel(target, recordsByTable);
  const lead = activeSurvey.mission?.mission_lead || '';
  const body = `<form id="media-capture-form"><p class="modal-intro">Capture a photo or short video with this device, then EcoSurvey saves the original file locally and creates a linked Media record. Long ROV, GoPro, sonar, and drone files should remain external media references in the standard Media record form.</p><div class="capture-target-card"><div class="eyebrow">Link this capture to</div><strong id="capture-target-summary">${escapeHtml(targetText)}</strong><select id="capture_target" name="capture_target" aria-label="Record to link this capture to">${captureTargetOptions(targetValue)}</select><label class="capture-promote"><input type="checkbox" name="promote" checked/> Set as primary linked media only when that target’s media field is blank</label></div><div class="capture-actions"><button type="button" class="button" data-action="trigger-media-capture" data-capture-kind="photo">Take photo</button><button type="button" class="button secondary" data-action="trigger-media-capture" data-capture-kind="video">Record short video</button><button type="button" class="button ghost" data-action="trigger-media-capture" data-capture-kind="picker">Choose existing file</button></div><input id="capture-photo-input" type="file" accept="image/*" capture="environment" hidden/><input id="capture-video-input" type="file" accept="video/*" capture="environment" hidden/><input id="capture-picker-input" type="file" accept="image/*,video/*,audio/*" hidden/><div id="capture-file-status" class="capture-file-status"><strong>No media selected yet.</strong><br>Use the camera buttons above, or choose an existing photo, video, or audio file.</div><div class="form-grid"><div class="field"><label for="capture_operator">Operator</label><input id="capture_operator" name="operator" value="${escapeHtml(lead)}" placeholder="Field recorder"/></div><div class="field"><label for="capture_quality">Quality rating</label><select id="capture_quality" name="quality_rating"><option value="excellent">Excellent</option><option value="good">Good</option><option value="usable" selected>Usable</option><option value="poor">Poor</option></select></div><div class="field full"><label for="capture_description">Description / field note</label><textarea id="capture_description" name="description" placeholder="What does this capture show? Include scale, behavior, habitat, or target notes."></textarea></div></div><div class="capture-gps"><div><strong>Capture GPS</strong><br><span id="capture-gps-status">EcoSurvey will request device location automatically after media is selected. GPS is optional; the media point will inherit its linked record location when unavailable.</span></div><button type="button" class="button ghost small" data-action="capture-media-gps">Refresh GPS</button></div><div id="capture-errors" class="notice error" hidden></div><div class="field-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button id="capture-save" type="submit" class="button" disabled>Save linked capture</button></div></form>`;
  renderModal('Capture field media', body);
}

function showCaptureErrors(errors) {
  const box = document.querySelector('#capture-errors'); if (!box) return;
  box.hidden = false; box.innerHTML = `<strong>Cannot save capture:</strong><ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function setCaptureStatus(message, tone = '') {
  const box = document.querySelector('#capture-file-status'); if (!box) return;
  box.className = `capture-file-status ${tone}`; box.innerHTML = message;
}
function setCaptureGpsStatus(message, tone = '') {
  const node = document.querySelector('#capture-gps-status'); if (!node) return;
  node.textContent = message; node.className = tone;
}
function triggerMediaCapture(kind) {
  const inputId = kind === 'photo' ? 'capture-photo-input' : kind === 'video' ? 'capture-video-input' : 'capture-picker-input';
  pendingCaptureSource = kind === 'picker' ? 'file_picker' : 'device_camera';
  document.querySelector(`#${inputId}`)?.click();
}
async function handleCaptureFileSelect(event) {
  const file = event.currentTarget.files?.[0] || null; if (!file) return;
  pendingCaptureFile = file;
  if (event.currentTarget.id === 'capture-picker-input') pendingCaptureSource = 'file_picker';
  const errors = validateLocalMedia(file);
  if (errors.length) { setCaptureStatus(`<strong>Selected: ${escapeHtml(file.name)}</strong><br>${escapeHtml(errors.join(' '))}`, 'bad'); document.querySelector('#capture-save').disabled = true; return; }
  setCaptureStatus(`<strong>Ready: ${escapeHtml(file.name)}</strong><br>${escapeHtml(mediaTypeLabel(file))} · ${escapeHtml(formatBytes(file.size))} · stored locally on this device until exported.`, 'good');
  document.querySelector('#capture-save').disabled = false;
  await captureMediaGps(true);
}
function mediaTypeLabel(file) { const type = file?.type || 'unknown type'; return type.startsWith('image/') ? 'Photo' : type.startsWith('video/') ? 'Video' : type.startsWith('audio/') ? 'Audio' : 'Media'; }
async function captureMediaGps(silent = false) {
  if (!navigator.geolocation) { if (!silent) setCaptureGpsStatus('This browser does not provide device location. The capture can still use its linked record location.', 'warning'); return null; }
  if (!silent) setCaptureGpsStatus('Getting device location…');
  return new Promise((resolve) => navigator.geolocation.getCurrentPosition((position) => {
    pendingCaptureLocation = { lat: position.coords.latitude, lon: position.coords.longitude, accuracy: position.coords.accuracy };
    setCaptureGpsStatus(`Captured ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)} · ±${Math.round(position.coords.accuracy)} m`, 'good'); resolve(pendingCaptureLocation);
  }, (error) => {
    if (!silent) setCaptureGpsStatus(`GPS unavailable: ${error.message}. The capture will inherit its linked record location where available.`, 'warning');
    else setCaptureGpsStatus('Device GPS unavailable; the media point will inherit its linked record location where available.', 'warning');
    resolve(null);
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }));
}
async function promoteCaptureLink(target, mediaId) {
  const plan = parentPromotionPlan(target, mediaId); if (!plan) return false;
  const parent = (recordsByTable[plan.table] || []).find(plan.match); if (!parent || parent[plan.field]) return false;
  const idField = SCHEMAS[plan.table].idField;
  const updated = { ...parent, [plan.field]: plan.value, _updatedAt: new Date().toISOString() };
  await saveRecord(activeSurvey.id, plan.table, updated[idField], updated); return true;
}
async function handleMediaCaptureSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget; const file = pendingCaptureFile;
  const fileErrors = validateLocalMedia(file); if (fileErrors.length) return showCaptureErrors(fileErrors);
  const raw = Object.fromEntries(new FormData(form).entries()); const target = parseCaptureTarget(raw.capture_target);
  const draft = makeCaptureDraft({ mission: activeSurvey.mission, recordsByTable, target, file, operator: raw.operator, description: raw.description, qualityRating: raw.quality_rating, location: pendingCaptureLocation, promote: raw.promote === 'on', source: pendingCaptureSource });
  let data = withCalculatedFields('media', draft, activeSurvey.mission, activeSurvey.site, recordsByTable);
  const errors = validateForm('media', data, activeSurvey.mission, activeSurvey.site, recordsByTable); if (errors.length) return showCaptureErrors(errors);
  const attachmentId = crypto.randomUUID(); const now = new Date().toISOString();
  data.attachment_id = attachmentId; data._createdAt = now; data._updatedAt = now;
  const saveButton = document.querySelector('#capture-save'); if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Saving capture…'; }
  try {
    await saveAttachment({ id: attachmentId, surveyId: activeSurvey.id, mediaId: data.media_id, filename: file.name, type: file.type || 'application/octet-stream', byte_size: Number(file.size) || 0, capture_source: pendingCaptureSource, createdAt: now, blob: file });
    await saveRecord(activeSurvey.id, 'media', data.media_id, data);
    if (raw.promote === 'on') await promoteCaptureLink(target, data.media_id);
    await loadRecords(); closeModal(); view = 'records'; selectedTable = 'media'; render();
  } catch (error) {
    if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Save linked capture'; }
    showCaptureErrors([`The capture could not be stored on this device: ${error.message || error}. Check free device storage, then try a shorter clip or export existing data.`]);
  }
}
async function downloadAttachment(id) {
  const attachment = await getAttachment(id); if (!attachment?.blob) return alert('This local media attachment is no longer available on this device. Keep the Media record and restore the file from your mission archive if needed.');
  downloadBlobFile(attachment.blob, attachment.filename || 'ecosurvey_media', attachment.type || 'application/octet-stream');
}

function fieldOptions(field, draft) {
  if (!field.dynamic) return field.options || [];
  if (field.dynamic === 'stationSequences') return recordsByTable.stations.map((row) => [String(row.station_sequence), `Station ${String(row.station_sequence).padStart(2,'0')} · ${row.station_id}`]);
  if (field.dynamic === 'transectSequences') {
    const selectedStation = draft.environment_station_sequence || draft.observation_station_sequence || draft.media_station_sequence || draft.sample_station_sequence || draft.video_log_station_sequence;
    return recordsByTable.transects.filter((row) => !selectedStation || String(row.parent_station_sequence) === String(selectedStation)).map((row) => [String(row.transect_sequence), `Transect ${String(row.transect_sequence).padStart(2,'0')} · ${row.transect_id}`]);
  }
  if (field.dynamic === 'rovEquipmentLogs') return recordsByTable.equipment.filter((row) => String(row.equipment_category || '').toLowerCase() === 'rov').map((row) => [String(row.equipment_log_id), `${row.equipment_id || 'ROV'} · ${row.equipment_log_id}`]);
  if (field.dynamic === 'sensorEquipmentLogs') return recordsByTable.equipment.filter((row) => String(row.equipment_category || '').toLowerCase() === 'sensor').map((row) => [String(row.equipment_log_id), `${row.equipment_id || 'Sensor'} · ${row.equipment_log_id}`]);
  if (field.dynamic === 'sensorStreamSequences') return recordsByTable.sensor_streams.map((row) => [String(row.sensor_stream_sequence), `Sensor ${String(row.sensor_stream_sequence).padStart(2,'0')} · ${row.stream_name || row.sensor_stream_id}`]);
  if (field.dynamic === 'rovOperationSequences') return recordsByTable.rov_operations.map((row) => [String(row.operation_sequence), `ROV ${String(row.operation_sequence).padStart(2,'0')} · ${row.vehicle_id || row.rov_operation_id} · ${row.operation_status || 'planned'}`]);
  if (field.dynamic === 'videoMediaSequences') return recordsByTable.media.filter((row) => ['video','sonar_image'].includes(String(row.media_type || '').toLowerCase())).map((row) => [String(row.media_sequence), `Media ${String(row.media_sequence).padStart(3,'0')} · ${row.file_name || row.file_name_manual || row.media_id}`]);
  if (field.dynamic === 'observationSequences') return recordsByTable.observations.map((row) => [String(row.observation_sequence), `Observation ${String(row.observation_sequence).padStart(3,'0')} · ${row.observation_id}`]);
  if (field.dynamic === 'sampleSequences') return recordsByTable.samples.map((row) => [String(row.sample_sequence), `Sample ${String(row.sample_sequence).padStart(3,'0')} · ${row.sample_id} · ${row.sample_label || 'no label'}`]);
  return [];
}

function defaultFor(table, existing = {}) {
  const raw = { ...existing }; const schema = SCHEMAS[table];
  for (const field of schema.fields) {
    if (raw[field.name] !== undefined) continue;
    if (field.autoNow) raw[field.name] = isoNowLocalInput();
    if (field.default !== undefined) raw[field.name] = field.default;
  }
  const protocolItem = activeProtocol();
  for (const field of schema.fields) {
    if (raw[field.name] !== undefined && raw[field.name] !== '') continue;
    const protocolDefault = protocolDefaultFor(protocolItem, table, field.name);
    if (protocolDefault !== undefined) raw[field.name] = protocolDefault;
  }
  const seq = table==='equipment'?'equipment_sequence':table==='stations'?'station_sequence':table==='transects'?'transect_sequence':table==='rov_operations'?'operation_sequence':table==='video_logs'?'video_log_sequence':table==='sensor_streams'?'sensor_stream_sequence':table==='sensor_readings'?'sensor_reading_sequence':table==='environment'?'environment_sequence':table==='observations'?'observation_sequence':table==='samples'?'sample_sequence':table==='custody'?'custody_sequence':table==='media'?'media_sequence':null;
  if (seq && !raw[seq]) raw[seq] = nextSequence(table, seq);
  return raw;
}

function computedPreview(table, data) { const ids = makeIds(activeSurvey.mission, activeSurvey.site, table, data); const preview = { ...data, ...ids }; if (table === 'video_logs') { const time = normalizeVideoLogTime(preview); if (time.valid) { preview.video_elapsed_seconds = time.seconds; preview.video_timecode = time.timecode; } const operation = (recordsByTable.rov_operations || []).find((row) => String(row.operation_sequence) === String(preview.rov_operation_sequence)); preview.media_id = operation?.video_media_id || ''; preview.estimated_mission_datetime_utc = estimateVideoLogMissionTime(operation || {}, preview); } return preview; }

function renderField(field, draft, table) {
  let value = field.type==='computed' ? (computedPreview(table,draft)[field.name] || '') : (draft[field.name] ?? '');
  if (field.type === 'barcode' && table === 'samples' && !value) value = defaultSampleLabel(computedPreview(table, draft).sample_id || '');
  const required = field.required ? 'required' : ''; const full = field.type==='textarea'||field.type==='location'||field.type==='file'||field.type==='computed'||field.type==='barcode' ? 'full' : '';
  if (field.type === 'computed') return `<div class="field full"><label>${escapeHtml(field.label)}</label><input readonly value="${escapeHtml(value)}" /><div class="computed-note">Generated from Mission ID, Site number, and the linked parent sequence.</div></div>`;
  if (field.type === 'textarea') return `<div class="field ${full}"><label for="${field.name}">${escapeHtml(field.label)} ${field.required?'<span aria-hidden="true">*</span>':''}</label><textarea id="${field.name}" name="${field.name}" ${required} placeholder="${escapeHtml(field.placeholder||'')}">${escapeHtml(value)}</textarea>${field.help?`<div class="help">${escapeHtml(field.help)}</div>`:''}</div>`;
  if (field.type === 'select') { const opts=fieldOptions(field,draft); return `<div class="field"><label for="${field.name}">${escapeHtml(field.label)} ${field.required?'<span aria-hidden="true">*</span>':''}</label><select id="${field.name}" name="${field.name}" ${required}><option value="">Select…</option>${opts.map(([v,l])=>`<option value="${escapeHtml(v)}" ${String(value)===String(v)?'selected':''}>${escapeHtml(l)}</option>`).join('')}</select>${field.dynamic&&opts.length===0?'<div class="help">Create the linked parent record first.</div>':''}${field.help?`<div class="help">${escapeHtml(field.help)}</div>`:''}</div>`; }
  if (field.type === 'location') { const lat=draft[field.lat]??''; const lon=draft[field.lon]??''; const acc=draft[field.accuracy]??''; return `<div class="field full"><label>${escapeHtml(field.label)} ${field.required?'<span aria-hidden="true">*</span>':''}</label><div class="location-box"><div class="location-row"><input name="${field.lat}" type="number" step="any" value="${escapeHtml(lat)}" placeholder="Latitude" ${field.required?'required':''}/><input name="${field.lon}" type="number" step="any" value="${escapeHtml(lon)}" placeholder="Longitude" ${field.required?'required':''}/><button type="button" class="button ghost small" data-action="capture-location" data-lat="${field.lat}" data-lon="${field.lon}" data-accuracy="${field.accuracy}">Use GPS</button></div><input class="location-accuracy" name="${field.accuracy}" type="number" step="any" value="${escapeHtml(acc)}" placeholder="GPS accuracy (m; optional)" style="margin-top:8px"/>${field.help?`<div class="help">${escapeHtml(field.help)}</div>`:''}</div></div>`; }
  if (field.type === 'barcode') return `<div class="field full"><label for="${field.name}">${escapeHtml(field.label)} ${field.required?'<span aria-hidden="true">*</span>':''}</label><div class="location-row"><input id="${field.name}" name="${field.name}" type="text" value="${escapeHtml(value)}" ${required} placeholder="Scan or type sample label"/><button type="button" class="button ghost small" data-action="scan-sample-label" data-target-field="${field.name}">Scan QR / barcode</button><button type="button" class="button ghost small" data-action="use-generated-sample-label" data-target-field="${field.name}">Use generated ID</button></div><div id="barcode-scan-panel" class="barcode-scan-panel" hidden><video id="barcode-scan-video" autoplay playsinline muted></video><div class="scanner-status" id="barcode-scan-status">Camera scan is ready.</div><button type="button" class="button secondary small" data-action="stop-barcode-scan">Stop scanner</button></div><div class="help">Camera scanning uses the browser’s native BarcodeDetector where supported. On unsupported browsers, type or paste the physical label value, then choose its format below.</div>${field.help?`<div class="help">${escapeHtml(field.help)}</div>`:''}</div>`;
  if (field.type === 'file') return `<div class="field full"><label for="${field.name}">${escapeHtml(field.label)}</label><input id="${field.name}" name="${field.name}" type="file" accept="${field.accept || ''}"/><div class="help">A selected file stays on this device until you export/download it. For ROV, GoPro, sonar, or drone media already stored elsewhere, leave this blank and enter an external file name below.</div></div>`;
  const attrs = [required, field.min!==undefined?`min="${field.min}"`:'', field.max!==undefined?`max="${field.max}"`:'', field.step?`step="${field.step}"`:'', field.pattern?`pattern="${field.pattern}"`:'', field.placeholder?`placeholder="${escapeHtml(field.placeholder)}"`:''].filter(Boolean).join(' ');
  return `<div class="field"><label for="${field.name}">${escapeHtml(field.label)} ${field.required?'<span aria-hidden="true">*</span>':''}</label><input id="${field.name}" name="${field.name}" type="${field.type}" value="${escapeHtml(value)}" ${attrs}/>${field.help?`<div class="help">${escapeHtml(field.help)}</div>`:''}</div>`;
}

function openRecordForm(table, existing = null) {
  const schema = SCHEMAS[table]; const draft = defaultFor(table, existing || {}); const protocolItem = activeProtocol();
  const coreFields = schema.fields.filter((field) => fieldPriority(protocolItem, table, field.name, field) === 'core');
  const additionalFields = schema.fields.filter((field) => !coreFields.includes(field));
  const protocolNote = `<div class="notice"><strong>${escapeHtml(protocolItem.name)}:</strong> Core fields for this protocol appear first. Existing universal required fields are never hidden; additional detail remains available below.</div>`;
  const additional = additionalFields.length ? `<details class="protocol-optional-fields"><summary>Additional optional fields (${additionalFields.length})</summary><div class="form-grid nested-fields">${additionalFields.map((field)=>renderField(field,draft,table)).join('')}</div></details>` : '';
  const body = `<form id="record-form" data-table="${table}"><input type="hidden" name="__previous_id" value="${escapeHtml(existing ? (existing[SCHEMAS[table].idField] || '') : '')}"/>${protocolNote}<div class="form-grid">${coreFields.map((field)=>renderField(field,draft,table)).join('')}</div>${additional}<div id="form-errors" class="notice error" hidden></div><div class="field-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button type="submit" class="button">Save ${escapeHtml(schema.title)}</button></div></form>`;
  renderModal(existing ? `Edit ${schema.title}` : `Add ${schema.title}`, body);
}

function openSurveyForm(singleton) { openRecordForm(singleton, activeSurvey[singleton] || {}); }

function formDataToObject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input[type="file"]').forEach((input) => { if (input.files?.[0]) pendingFiles.set(input.name, input.files[0]); });
  return data;
}

async function handleFormSubmit(event) {
  event.preventDefault(); const form=event.currentTarget; const table=form.dataset.table; const raw=formDataToObject(form); const previousId=raw.__previous_id || null;
  if (table==='mission' || table==='site') {
    const childCount = RECORD_TABLES.reduce((total, name) => total + (recordsByTable[name]?.length || 0), 0);
    if (table === 'mission' && activeSurvey.mission?.mission_id && raw.mission_id !== activeSurvey.mission.mission_id && childCount) return displayErrors(['Mission ID cannot be changed after child records exist; create a new mission instead.']);
    if (table === 'site' && String(activeSurvey.site?.site_sequence || '') !== String(raw.site_sequence || '') && childCount) return displayErrors(['Site number cannot be changed after child records exist; create a new mission-site record instead.']);
    const previousProjectId = activeSurvey.mission?.project_id || '';
    let candidate = { ...activeSurvey[table], ...raw };
    if (table==='site') candidate = withCalculatedFields('site', candidate, table==='mission'?candidate:activeSurvey.mission, candidate);
    if (table==='mission') { candidate.actual_start_utc = toIso(candidate.actual_start_utc); Object.assign(candidate, protocolMissionFields(candidate.protocol_id || DEFAULT_PROTOCOL_ID)); }
    const trial={...activeSurvey, [table]:candidate}; if (table==='mission') { trial.site = withCalculatedFields('site', activeSurvey.site, candidate, activeSurvey.site); }
    const errors=validateForm(table,candidate,trial.mission,trial.site,recordsByTable); if(errors.length) return displayErrors(errors);
    activeSurvey=trial; await persistSurvey(); if (table === 'mission' && previousProjectId !== activeSurvey.mission?.project_id) await loadSpeciesCatalog(); closeModal(); render(); return;
  }
  const idField=SCHEMAS[table].idField;
  const prior = recordsByTable[table].find((row)=>row[idField]===raw.__previous_id) || null;
  const mergeSource = { ...(prior || {}), ...raw }; delete mergeSource.__previous_id;
  let data = withCalculatedFields(table, mergeSource, activeSurvey.mission, activeSurvey.site, recordsByTable);
  for (const field of SCHEMAS[table].fields) if (field.type==='datetime-local' && data[field.name]) data[field.name]=toIso(data[field.name]);
  if (table === 'video_logs') { const operation = (recordsByTable.rov_operations || []).find((row) => String(row.operation_sequence) === String(data.rov_operation_sequence)); data.media_id = operation?.video_media_id || ''; data.estimated_mission_datetime_utc = estimateVideoLogMissionTime(operation || {}, data); }
  if (table === 'sensor_streams') { const operation = (recordsByTable.rov_operations || []).find((row) => String(row.operation_sequence) === String(data.rov_operation_sequence)); data.rov_operation_id = operation?.rov_operation_id || ''; if (operation && data.sensor_time_at_launch) data.time_offset_seconds = sensorClockOffsetSeconds(operation, data.sensor_time_at_launch); }
  const errors=validateForm(table,data,activeSurvey.mission,activeSurvey.site,recordsByTable); if(errors.length) return displayErrors(errors);
  const id=data[idField]; const old = prior || recordsByTable[table].find((row)=>row[idField]===id);
  if (pendingFiles.has('media_file') && table==='media') { const file=pendingFiles.get('media_file'); const attachmentId=crypto.randomUUID(); if (old?.attachment_id) await deleteAttachment(old.attachment_id); await saveAttachment({id:attachmentId,surveyId:activeSurvey.id,mediaId:id,filename:file.name,type:file.type,byte_size:Number(file.size)||0,capture_source:'file_picker',createdAt:new Date().toISOString(),blob:file}); data.attachment_id=attachmentId; data.attachment_filename=file.name; data.attachment_mime_type=file.type||'application/octet-stream'; data.attachment_size_bytes=Number(file.size)||0; data.capture_source='file_picker'; data.file_name=file.name; data.file_extension=file.name.split('.').pop().toLowerCase(); data.file_name_manual=data.file_name_manual||file.name; }
  if (old && old[idField]!==id) await deleteRecord(activeSurvey.id,table,old[idField]);
  data._createdAt=old?old._createdAt:new Date().toISOString(); data._updatedAt=new Date().toISOString(); await saveRecord(activeSurvey.id,table,id,data); await loadRecords(); closeModal(); render();
}

function displayErrors(errors) { const box=document.querySelector('#form-errors'); box.hidden=false; box.innerHTML=`<strong>Fix before saving:</strong><ul>${errors.map((error)=>`<li>${escapeHtml(error)}</li>`).join('')}</ul>`; box.scrollIntoView({behavior:'smooth',block:'center'}); }

async function captureLocation(button) {
  if (!navigator.geolocation) return displayErrors(['This browser does not provide device location. Enter coordinates manually.']);
  button.textContent='Getting GPS…'; button.disabled=true;
  navigator.geolocation.getCurrentPosition((position)=>{ const lat=document.querySelector(`[name="${button.dataset.lat}"]`); const lon=document.querySelector(`[name="${button.dataset.lon}"]`); const acc=document.querySelector(`[name="${button.dataset.accuracy}"]`); if(lat)lat.value=position.coords.latitude.toFixed(6); if(lon)lon.value=position.coords.longitude.toFixed(6); if(acc)acc.value=Math.round(position.coords.accuracy); button.textContent='GPS captured'; setTimeout(()=>{button.textContent='Use GPS';button.disabled=false},1200); }, (error)=>{ button.textContent='Use GPS';button.disabled=false; displayErrors([`GPS unavailable: ${error.message}. Check permission, location services, and HTTPS.`]); }, {enableHighAccuracy:true,timeout:15000,maximumAge:0});
}

async function loadDemo() {
  debriefPhotos=[]; debriefPhotoOmitted=0;
  const demo = demoSurvey(); await makeSurvey(); latestQaqcRun = null; mapState.selectedKey = null; mapState.currentLocation = null; activeSurvey.mission=demo.mission; activeSurvey.site=demo.site; await persistSurvey(); for (const [table,rows] of Object.entries(demo.records)) for (const row of rows) await saveRecord(activeSurvey.id,table,row[SCHEMAS[table].idField],row); await loadRecords(); await loadSpeciesCatalog(); view='home'; render();
}

async function openSurveyPicker() {
  const surveys=await getAllSurveys(); const list=surveys.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  renderModal('Switch mission', `<div class="record-list">${list.map((survey)=>`<article class="record-row"><div><div class="title">${escapeHtml(survey.mission?.mission_id || 'Untitled mission')}</div><div class="meta">${escapeHtml(survey.mission?.mission_name || 'Untitled')} · ${escapeHtml(survey.site?.site_name || 'No site')}</div></div><div class="buttons"><button class="button secondary small" data-action="switch-survey" data-survey-id="${survey.id}">Open</button></div></article>`).join('')}</div><div class="actions"><button class="button" data-action="new-survey-from-picker">Create mission & site</button></div>`);
}

async function downloadMedia() { const attachments=await getAttachments(activeSurvey.id); if(!attachments.length) return alert('No locally attached media files are stored for this mission. External media is referenced by filename only.'); attachments.forEach((attachment)=>{ const blobUrl=URL.createObjectURL(attachment.blob); const link=document.createElement('a'); link.href=blobUrl; link.download=attachment.filename; document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(blobUrl),1000); }); }

async function captureMapLocation() {
  if (!navigator.geolocation) return alert('This browser does not provide device location. Enable location services or use a field record GPS capture instead.');
  navigator.geolocation.getCurrentPosition((position) => {
    mapState.currentLocation = { lat: position.coords.latitude, lon: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date().toISOString() };
    view = 'map'; render();
  }, (error) => alert(`GPS unavailable: ${error.message}. Check permissions, location services, and HTTPS.`), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

async function activateProtocol(protocolId) {
  const item = getProtocol(protocolId);
  const current = activeProtocol();
  const childCount = RECORD_TABLES.reduce((total, table) => total + (recordsByTable[table]?.length || 0), 0);
  if (current.id === item.id) { view = 'protocol'; render(); return; }
  if (childCount && !confirm(`Change this mission from “${current.name}” to “${item.name}”? Existing records stay unchanged, but the new protocol changes completion rules and makes the last QA/QC run stale.`)) return;
  activeSurvey.mission = { ...activeSurvey.mission, ...protocolMissionFields(item.id) };
  activeSurvey.qaqc_options = { ...(activeSurvey.qaqc_options || {}), require_environment_per_station: item.requireEnvironmentPerStation, bbox: activeSurvey.qaqc_options?.bbox || {} };
  await persistSurvey(); view = 'protocol'; render();
}

async function saveQaqcOptions() {
  activeSurvey.qaqc_options = { require_environment_per_station: Boolean(document.querySelector('#qaqc-require-environment')?.checked), bbox: { min_lon: document.querySelector('#qaqc-min-lon')?.value || '', min_lat: document.querySelector('#qaqc-min-lat')?.value || '', max_lon: document.querySelector('#qaqc-max-lon')?.value || '', max_lat: document.querySelector('#qaqc-max-lat')?.value || '' } };
  await persistSurvey(); render();
}
async function runMissionQaqc() {
  await saveQaqcOptions();
  latestQaqcRun = runFullQaqc(activeSurvey, recordsByTable, activeSurvey.qaqc_options || {});
  await saveQaqcRun(activeSurvey.id, latestQaqcRun);
  activeSurvey.last_qaqc_run_id = latestQaqcRun.id; activeSurvey.last_qaqc_run_at = latestQaqcRun.created_at;
  await persistSurvey(); render();
}


function sensorOperationOptions(selected = '') {
  const options = [['', 'Not linked to an ROV operation']].concat((recordsByTable.rov_operations || []).map((row) => [String(row.operation_sequence), `ROV ${String(row.operation_sequence).padStart(2,'0')} · ${row.vehicle_id || row.rov_operation_id}`]));
  return options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}
function sensorEquipmentOptions(selected = '') {
  const options = [['', 'No linked equipment record']].concat((recordsByTable.equipment || []).filter((row) => String(row.equipment_category || '').toLowerCase() === 'sensor').map((row) => [row.equipment_log_id, `${row.equipment_id || 'Sensor'} · ${row.equipment_log_id}`]));
  return options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}
function sensorMappingControls(headers = [], mapping = {}) {
  if (!headers.length) return '<div class="notice">Choose a CSV to inspect headers and confirm the automatic mapping.</div>';
  const headerOptions = [['', '— do not import —'], ...headers.map((header) => [header, header])];
  return `<div class="sensor-mapping"><h3>Column mapping</h3><p class="footer-note">EcoSurvey detected common logger names automatically. Confirm the timestamp and any variables you need. Unmapped columns stay in the original CSV and are not imported as individual readings.</p><div class="form-grid">${SENSOR_FIELDS.map(([key, label, required]) => `<div class="field"><label for="sensor_map_${key}">${escapeHtml(label)}${required ? ' *' : ''}</label><select id="sensor_map_${key}" name="sensor_map_${key}" data-sensor-map="${key}">${headerOptions.map(([value, title]) => `<option value="${escapeHtml(value)}" ${String(mapping[key] || '') === String(value) ? 'selected' : ''}>${escapeHtml(title)}</option>`).join('')}</select></div>`).join('')}</div></div>`;
}
function sensorImportStatus(message = '', tone = '') {
  const node = document.querySelector('#sensor-import-status'); if (!node) return;
  node.hidden = !message; node.className = `notice ${tone}`.trim(); node.innerHTML = message;
}
function openSensorImport() {
  if (!activeSurvey) return;
  pendingSensorImport = null;
  const streamOptions = SCHEMAS.sensor_streams.fields.find((field) => field.name === 'stream_type')?.options || [];
  const body = `<form id="sensor-import-form"><p class="modal-intro"><strong>Import a logger CSV into the active mission.</strong> EcoSurvey stores a structured sensor-stream record plus individual readings locally on this device. Link it to an ROV operation and set the sensor clock timestamp at physical launch to align readings with ROV video logs.</p><div class="notice">For reliable phone performance, import at most <strong>${SENSOR_IMPORT_MAX_ROWS.toLocaleString()}</strong> readings. Use “Import every Nth row” to downsample dense logs; the original file remains your archival source.</div><div class="form-grid"><div class="field full"><label for="sensor_csv">Logger CSV *</label><input id="sensor_csv" name="sensor_csv" type="file" accept=".csv,text/csv" required/><div class="help">Supported: CTD, depth, temperature, water-quality, navigation, sonar, and custom comma-separated logs. Use a header row.</div></div><div class="field"><label for="sensor_stream_name">Stream name *</label><input id="sensor_stream_name" name="sensor_stream_name" required placeholder="ROV CTD — north reef pass"/></div><div class="field"><label for="sensor_stream_type">Stream type *</label><select id="sensor_stream_type" name="sensor_stream_type">${streamOptions.map(([value,label])=>`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('')}</select></div><div class="field"><label for="sensor_instrument_id">Instrument / sensor ID *</label><input id="sensor_instrument_id" name="sensor_instrument_id" required placeholder="CTD-01"/></div><div class="field"><label for="sensor_equipment_log_id">Equipment check record</label><select id="sensor_equipment_log_id" name="sensor_equipment_log_id">${sensorEquipmentOptions()}</select></div><div class="field"><label for="sensor_rov_operation_sequence">Linked ROV operation</label><select id="sensor_rov_operation_sequence" name="sensor_rov_operation_sequence">${sensorOperationOptions()}</select></div><div class="field"><label for="sensor_time_at_launch">Sensor clock at physical launch</label><input id="sensor_time_at_launch" name="sensor_time_at_launch" type="datetime-local"/><div class="help">Required when linking to an ROV operation. This is the logger’s own timestamp at launch, not the phone time.</div></div><div class="field"><label for="sensor_downsample_every">Import every Nth row</label><input id="sensor_downsample_every" name="sensor_downsample_every" type="number" min="1" step="1" value="1" required/></div><div class="field full"><label for="sensor_timezone_note">Timestamp timezone / clock note</label><input id="sensor_timezone_note" name="sensor_timezone_note" placeholder="UTC; logger clock synchronized before launch"/></div><div class="field full"><label for="sensor_notes">Notes</label><textarea id="sensor_notes" name="sensor_notes" placeholder="Deployment, calibration, or import notes"></textarea></div></div><div id="sensor-import-status" class="notice" hidden></div><div id="sensor-mapping-controls">${sensorMappingControls()}</div><div class="field-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button id="sensor-import-save" type="submit" class="button" disabled>Import sensor stream</button></div></form>`;
  renderModal('Import sensor CSV', body);
}
async function handleSensorCsvSelected(event) {
  const file = event.currentTarget.files?.[0];
  const submit = document.querySelector('#sensor-import-save');
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new Error('No data rows were found. Confirm that the CSV has a header row and at least one reading.');
    const headers = Object.keys(rows[0] || {});
    const mapping = autoDetectSensorMapping(headers);
    pendingSensorImport = { file, rows, headers, mapping };
    const warnings = [];
    if (!mapping.timestamp) warnings.push('No timestamp column was detected automatically. Select it below.');
    if (rows.length > SENSOR_IMPORT_MAX_ROWS) warnings.push(`This file has ${rows.length.toLocaleString()} rows. Increase “Import every Nth row” to at least ${Math.ceil(rows.length / SENSOR_IMPORT_MAX_ROWS)} before saving.`);
    document.querySelector('#sensor-mapping-controls').innerHTML = sensorMappingControls(headers, mapping);
    sensorImportStatus(`<strong>Ready:</strong> ${escapeHtml(file.name)} · ${rows.length.toLocaleString()} source rows · detected ${sensorMappingSummary(mapping).length} mapped field${sensorMappingSummary(mapping).length === 1 ? '' : 's'}.${warnings.length ? `<br><span class="warning">${escapeHtml(warnings.join(' '))}</span>` : ''}`, warnings.length ? '' : 'good');
    if (submit) submit.disabled = false;
  } catch (error) {
    pendingSensorImport = null; if (submit) submit.disabled = true;
    sensorImportStatus(`<strong>Could not read this CSV:</strong> ${escapeHtml(error.message || error)}`, 'error');
  }
}
async function handleSensorImportSubmit(event) {
  event.preventDefault();
  if (!pendingSensorImport?.rows?.length) return sensorImportStatus('Choose and read a logger CSV before importing.', 'error');
  const form = event.currentTarget; const raw = Object.fromEntries(new FormData(form).entries());
  const mapping = Object.fromEntries(SENSOR_FIELDS.map(([key]) => [key, String(raw[`sensor_map_${key}`] || '')]));
  const errors = [];
  if (!mapping.timestamp) errors.push('Map a timestamp column before importing.');
  const downsample = Math.max(1, Math.floor(Number(raw.sensor_downsample_every) || 1));
  const projected = Math.ceil(pendingSensorImport.rows.length / downsample);
  if (projected > SENSOR_IMPORT_MAX_ROWS) errors.push(`This selection would import ${projected.toLocaleString()} readings. Increase Import every Nth row to at least ${Math.ceil(pendingSensorImport.rows.length / SENSOR_IMPORT_MAX_ROWS)}.`);
  const operation = (recordsByTable.rov_operations || []).find((row) => String(row.operation_sequence) === String(raw.sensor_rov_operation_sequence));
  if (raw.sensor_rov_operation_sequence && !operation) errors.push('The selected ROV operation no longer exists.');
  if (operation && !raw.sensor_time_at_launch) errors.push('Enter the sensor logger timestamp at physical launch to synchronize this stream with the ROV operation and video logs.');
  if (errors.length) return sensorImportStatus(`<strong>Cannot import yet:</strong><ul>${errors.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul>`, 'error');
  const sequence = nextSequence('sensor_streams', 'sensor_stream_sequence');
  const ids = makeIds(activeSurvey.mission, activeSurvey.site, 'sensor_streams', { sensor_stream_sequence: sequence, rov_operation_sequence: raw.sensor_rov_operation_sequence });
  const sensorLaunch = raw.sensor_time_at_launch ? toIso(raw.sensor_time_at_launch) : '';
  const offset = operation ? sensorClockOffsetSeconds(operation, sensorLaunch) : null;
  const normalized = normalizeSensorRows(pendingSensorImport.rows, mapping, { sensor_stream_id: ids.sensor_stream_id, mission_id: activeSurvey.mission.mission_id, site_id: activeSurvey.site.site_id, rov_operation_sequence: raw.sensor_rov_operation_sequence, rov_operation_id: operation?.rov_operation_id || '', time_offset_seconds: offset, downsample_every: downsample });
  if (!normalized.readings.length) return sensorImportStatus('No usable sensor readings were created. Confirm the timestamp mapping and source file format.', 'error');
  const summary = summarizeSensorReadings(normalized.readings);
  const stream = makeSensorStreamRecord({ sequence, sensor_stream_id: ids.sensor_stream_id, mission_id: activeSurvey.mission.mission_id, site_id: activeSurvey.site.site_id, stream_name: raw.sensor_stream_name, stream_type: raw.sensor_stream_type, instrument_id: raw.sensor_instrument_id, equipment_log_id: raw.sensor_equipment_log_id, rov_operation_sequence: raw.sensor_rov_operation_sequence, rov_operation_id: operation?.rov_operation_id || '', source_filename: pendingSensorImport.file.name, source_row_count: pendingSensorImport.rows.length, downsample_every: downsample, mapping, sensor_time_at_launch: sensorLaunch, time_offset_seconds: offset, timezone_note: raw.sensor_timezone_note, notes: raw.sensor_notes, summary });
  const submit = document.querySelector('#sensor-import-save'); if (submit) { submit.disabled = true; submit.textContent = `Importing ${normalized.readings.length.toLocaleString()} readings…`; }
  try {
    await saveRecordsBatch(activeSurvey.id, [{ table: 'sensor_streams', id: stream.sensor_stream_id, data: stream }, ...normalized.readings.map((row) => ({ table: 'sensor_readings', id: row.sensor_reading_id, data: row }))]);
    await loadRecords(); closeModal(); selectedTable = 'sensor_streams'; view = 'records'; render();
    if (normalized.warnings.length) setTimeout(() => alert(`Sensor stream imported with notes:\n\n${normalized.warnings.join('\n')}`), 50);
  } catch (error) {
    if (submit) { submit.disabled = false; submit.textContent = 'Import sensor stream'; }
    sensorImportStatus(`<strong>Import failed:</strong> ${escapeHtml(error.message || error)}. No partial stream should be saved; retry after checking device storage.`, 'error');
  }
}

function bindGlobal() {
  app.querySelectorAll('[data-view]').forEach((button)=>button.addEventListener('click',async()=>{view=button.dataset.view;if(view==='debrief') await loadDebriefPhotos();render();}));
  app.querySelectorAll('[data-action]').forEach((button)=>button.addEventListener('click',handleAction));
  app.querySelectorAll('[data-action="set-basemap-opacity"]').forEach((input)=>input.addEventListener('input',(event)=>{ mapState.basemapOpacity = Number(event.currentTarget.value) / 100; render(); }));
  app.querySelectorAll('[data-builder-field]').forEach((input) => input.addEventListener('input', handleTransectBuilderField));
  app.querySelectorAll('[data-sensor-profile-control]').forEach((input) => input.addEventListener('change', handleSensorProfileControl));
  app.querySelector('#mission-map')?.addEventListener('click', handleMapTap);
}
function bindModal() {
  document.querySelector('#modal [data-action="close-modal"]')?.addEventListener('click',closeModal);
  document.querySelector('#record-form')?.addEventListener('submit',handleFormSubmit);
  document.querySelector('#basemap-form')?.addEventListener('submit', handleBasemapSubmit);
  document.querySelector('#media-capture-form')?.addEventListener('submit', handleMediaCaptureSubmit);
  document.querySelector('#sensor-import-form')?.addEventListener('submit', handleSensorImportSubmit);
  document.querySelector('#sensor_csv')?.addEventListener('change', handleSensorCsvSelected);
  document.querySelectorAll('#media-capture-form input[type="file"]').forEach((input) => input.addEventListener('change', handleCaptureFileSelect));
  document.querySelector('#capture_target')?.addEventListener('change', (event) => { const summary = document.querySelector('#capture-target-summary'); if (summary) summary.textContent = targetLabel(parseCaptureTarget(event.currentTarget.value), recordsByTable); });
  document.querySelectorAll('#modal [data-action]').forEach((button)=>button.addEventListener('click',handleAction));
}
async function handleAction(event) {
  const button=event.currentTarget; const action=button.dataset.action; const table=button.dataset.table;
  if(action==='new-survey'){await makeSurvey();view='mission';render();openSurveyForm('mission');}
  if(action==='activate-protocol') await activateProtocol(button.dataset.protocolId || 'custom_general');
  if(action==='add-sample-record'){ selectedTable='samples'; view='records'; render(); openRecordForm('samples'); }
  if(action==='open-rov-operation'){ selectedTable='rov_operations'; view='records'; render(); openRecordForm('rov_operations'); }
  if(action==='open-sensor-import') openSensorImport();
  if(action==='open-sensor-profiles') { view='profiles'; render(); }
  if(action==='download-sensor-profile-csv') downloadSelectedSensorProfileCsv();
  if(action==='download-video-sensor-join-csv') downloadVideoSensorJoinCsv();
  if(action==='profile-open-video-log'){ const id=button.dataset.id; const row=recordsByTable.video_logs?.find((record)=>record.video_log_id===id); if(row){selectedTable='video_logs';view='records';render();openRecordForm('video_logs',{...row,__previous_id:id});} }
  if(action==='open-rov-video-log'){ selectedTable='video_logs'; view='records'; render(); if (!(recordsByTable.rov_operations || []).length) return alert('Create and save an ROV operation first so every video event has a deployment and primary video reference.'); openRecordForm('video_logs'); }
  if(action==='export-sample-labels'){ downloadBlobFile(sampleLabelCsv(recordsByTable.samples || []), `EcoSurvey_${String(activeSurvey.mission?.mission_id || 'mission')}_sample_labels.csv`, 'text/csv;charset=utf-8'); }
  if(action==='scan-sample-label') await startBarcodeScanner(button.dataset.targetField || 'sample_label');
  if(action==='stop-barcode-scan') stopBarcodeScanner();
  if(action==='use-generated-sample-label'){ const target = document.querySelector(`#${button.dataset.targetField || 'sample_label'}`); const preview = computedPreview('samples', Object.fromEntries(new FormData(document.querySelector('#record-form') || document.createElement('form')).entries())); if (target) target.value = defaultSampleLabel(preview.sample_id || ''); const format = document.querySelector('#barcode_format'); if (format && !format.value) format.value = 'manual_text'; }
  if(action==='open-track-form') openTrackForm();
  if(action==='open-quick-observation') openQuickObservation();
  if(action==='quick-select-taxon') selectQuickTaxon(button.dataset.taxonId || '');
  if(action==='quick-count') { const input = document.querySelector('#quick_count'); if (input) input.value = button.dataset.count ?? ''; }
  if(action==='open-inaturalist-search') openINaturalistSearch();
  if(action==='save-inaturalist-taxon') await saveINaturalistTaxon(button.dataset.inatId || '');
  if(action==='open-species-import') openSpeciesImport();
  if(action==='open-taxon-pack-import') openTaxonPackImport();
  if(action==='install-bundled-taxon-pack') await installBundledTaxonPack();
  if(action==='download-taxon-pack-template') await downloadTaxonPackTemplate();
  if(action==='download-species-template') downloadBlobFile(sampleTaxonCsv(), 'EcoSurvey_species_list_template.csv', 'text/csv;charset=utf-8');
  if(action==='open-manual-taxon') openManualTaxon();
  if(action==='set-active-species-list') await setActiveSpeciesList(button.dataset.listId || '');
  if(action==='delete-species-list') { const list = speciesLists.find((item) => item.id === button.dataset.listId); if (list && confirm(`Delete project species list “${list.name}” from this device? Existing observations retain their recorded taxon fields.`)) { await deleteSpeciesList(list.id); if (activeSpeciesListId === list.id) await setSetting(speciesSettingKey('activeSpeciesListId'), ''); await loadSpeciesCatalog(); render(); } }
  if(action==='export-active-species-list') { if (activeSpeciesList) downloadBlobFile(taxaToCsv(activeTaxa), `${String(activeSpeciesList.name || 'EcoSurvey_species_list').replaceAll(/[^a-z0-9]+/gi, '_')}.csv`, 'text/csv;charset=utf-8'); }
  if(action==='export-active-taxon-pack') await exportTaxonPack(activeSpeciesListId);
  if(action==='export-taxon-pack') await exportTaxonPack(button.dataset.listId || '');
  if(action==='toggle-taxon-favorite') { const id = button.dataset.taxonId || ''; favoriteTaxonIds = favoriteTaxonIds.includes(id) ? favoriteTaxonIds.filter((value) => value !== id) : [id, ...favoriteTaxonIds]; await setSetting(speciesSettingKey('favoriteTaxonIds'), favoriteTaxonIds); render(); }
  if(action==='start-gps-track') await startGpsTrack();
  if(action==='stop-gps-track') await stopGpsTrack('complete');
  if(action==='cancel-transect-builder') { transectBuilder = null; render(); }
  if(action==='start-transect-builder') { if (mapState.worldView) { mapState.worldView=false; } startTransectBuilder(); render(); }
  if(action==='builder-use-station-start') { useStationAsTransectStart(); render(); }
  if(action==='builder-use-device-point') await useDeviceForTransectPoint(button.dataset.builderPoint || 'start');
  if(action==='builder-clear-point') { if (transectBuilder) { transectBuilder[button.dataset.builderPoint || 'start'] = null; transectBuilder.step = button.dataset.builderPoint || 'start'; render(); } }
  if(action==='builder-save-transect') await saveBuiltTransect();
  if(action==='open-media-capture') openMediaCapture(button.dataset.captureTarget || 'site');
  if(action==='quick-capture-target') openMediaCapture(button.dataset.captureTarget || 'site');
  if(action==='trigger-media-capture') triggerMediaCapture(button.dataset.captureKind || 'picker');
  if(action==='capture-media-gps') await captureMediaGps(false);
  if(action==='download-attachment') await downloadAttachment(button.dataset.attachmentId);
  if(action==='load-demo') await loadDemo();
  if(action==='open-survey-picker') await openSurveyPicker();
  if(action==='switch-survey'){activeSurvey=await getSurvey(button.dataset.surveyId);await setSetting('activeSurveyId',activeSurvey.id);await loadRecords();latestQaqcRun=await getLatestQaqcRun(activeSurvey.id);stopTrackWatch(false); activeTrackId=null; transectBuilder=null; mapState={visibleLayers:new Set(MAP_LAYERS.map((layer)=>layer.key)),selectedKey:null,currentLocation:null,basemapVisible:true,basemapOpacity:0.72,worldReferenceVisible:true,worldView:false};sensorProfileState={streamId:'',metricKey:'depth_m',timeBasis:'mission_time',toleranceSeconds:90};await loadBasemapPacks();await loadSpeciesCatalog();debriefPhotos=[];debriefPhotoOmitted=0;closeModal();view='home';render();}
  if(action==='new-survey-from-picker'){closeModal();await makeSurvey();view='mission';render();openSurveyForm('mission');}
  if(action==='delete-survey'){stopTrackWatch(false);if(confirm('Delete the active mission and all of its records and QA/QC runs from this device? Export first if you need a copy.')){await deleteSurvey(activeSurvey.id);activeSurvey=null;latestQaqcRun=null;recordsByTable=Object.fromEntries(RECORD_TABLES.map((t)=>[t,[]]));basemapPacks=[];activeBasemap=null;activeBasemapId='';speciesLists=[];activeSpeciesList=null;activeSpeciesListId='';activeTaxa=[];favoriteTaxonIds=[];recentTaxonIds=[];debriefPhotos=[];debriefPhotoOmitted=0;sensorProfileState={streamId:'',metricKey:'depth_m',timeBasis:'mission_time',toleranceSeconds:90};if(basemapObjectUrl){URL.revokeObjectURL(basemapObjectUrl);basemapObjectUrl=null;}await setSetting('activeSurveyId',null);view='home';render();}}
  if(action==='edit-singleton') openSurveyForm(table);
  if(action==='select-table'){selectedTable=table;render();}
  if(action==='add-record') openRecordForm(table);
  if(action==='edit-record'){const id=button.dataset.id;const row=recordsByTable[table].find((record)=>record[SCHEMAS[table].idField]===id);if(row)openRecordForm(table,{...row,__previous_id:id});}
  if(action==='delete-record'){const id=button.dataset.id;if(confirm(`Delete ${id}?`)){const row = recordsByTable[table]?.find((record) => record[SCHEMAS[table].idField] === id); if (table === 'media' && row?.attachment_id) await deleteAttachment(row.attachment_id); await deleteRecord(activeSurvey.id,table,id);await loadRecords();render();}}
  if(action==='capture-location') captureLocation(button);
  if(action==='close-modal') closeModal();
  if(action==='toggle-map-layer'){const layer=button.dataset.layer;if(mapState.visibleLayers.has(layer)) mapState.visibleLayers.delete(layer); else mapState.visibleLayers.add(layer); const selectedLayer=(mapState.selectedKey || '').split(':')[0]; if(selectedLayer && !mapState.visibleLayers.has(selectedLayer)) mapState.selectedKey=null; render();}
  if(action==='select-map-feature'){event.stopPropagation(); mapState.selectedKey=button.dataset.mapKey;view='map';render();}
  if(action==='clear-map-selection'){mapState.selectedKey=null;render();}
  if(action==='map-fit'){mapState.selectedKey=null;mapState.worldView=false;render();}
  if(action==='show-world-view'){mapState.selectedKey=null;mapState.worldView=true;transectBuilder=null;render();}
  if(action==='toggle-world-reference'){mapState.worldReferenceVisible=Boolean(button.checked);render();}
  if(action==='capture-map-location') await captureMapLocation();
  if(action==='clear-map-location'){mapState.currentLocation=null;render();}
  if(action==='map-open-site'){view='mission';render();}
  if(action==='map-open-record'){const id=button.dataset.id;const mapTable=button.dataset.table;const row=recordsByTable[mapTable]?.find((record)=>record[SCHEMAS[mapTable].idField]===id);if(row)openRecordForm(mapTable,{...row,__previous_id:id});}
  if(action==='download-geojson-qgis-zip') await exportGeoJsonQgisZip(activeSurvey,recordsByTable);
  if(action==='download-combined-geojson') exportCombinedGeoJson(activeSurvey,recordsByTable);
  if(action==='download-geojson-layer') exportGeoJsonLayer(activeSurvey,recordsByTable,button.dataset.layerFile);
  if(action==='open-basemap-form') openBasemapForm();
  if(action==='open-basemap-manager') openBasemapManager();
  if(action==='set-active-basemap') { await setActiveBasemap(button.dataset.basemapId); closeModal(); }
  if(action==='clear-active-basemap') { await setActiveBasemap(''); closeModal(); }
  if(action==='toggle-basemap') { mapState.basemapVisible = Boolean(button.checked); render(); }
  if(action==='delete-basemap') { const pack = getBasemapById(button.dataset.basemapId); if (pack && confirm(`Delete offline basemap “${pack.name}” from this device?`)) { await deleteBasemapPack(pack.id); if (activeBasemapId === pack.id) await setActiveBasemap(''); basemapPacks = await getBasemapPacks(activeSurvey.id); await refreshActiveBasemap(); closeModal(); render(); } }
  if(action==='download-basemap-image') { const pack = getBasemapById(button.dataset.basemapId); if (pack?.image_blob) downloadBlobFile(pack.image_blob, pack.original_filename || `${pack.name}.png`, pack.image_mime || 'image/png'); }
  if(action==='download-basemap-metadata') { const pack = getBasemapById(button.dataset.basemapId); if (pack) downloadBlobFile(JSON.stringify(publicBasemapMetadata(pack), null, 2), `${(pack.name || 'EcoSurvey_basemap').replaceAll(/[^a-z0-9]+/gi, '_')}_metadata.json`, 'application/json;charset=utf-8'); }
  if(action==='print-field-debrief') await printFieldDebrief();
  if(action==='refresh-field-debrief') { await loadDebriefPhotos(); render(); }
  if(action==='save-qaqc-options') await saveQaqcOptions();
  if(action==='run-full-qaqc') await runMissionQaqc();
  if(action==='export-mission-qaqc-zip'){if(!latestQaqcRun || !latestRunIsCurrent()) return alert('Run Full QA/QC again before exporting the mission ZIP.'); const attachments = await getAttachments(activeSurvey.id); exportMissionQaqcZip(activeSurvey,recordsByTable,latestQaqcRun,attachments);}
  if(action==='download-qaqc-report'){if(latestQaqcRun && latestRunIsCurrent()) exportQaqcReport(latestQaqcRun);}
  if(action==='download-qaqc-findings'){if(latestQaqcRun && latestRunIsCurrent()) exportQaqcFindings(latestQaqcRun);}
  if(action==='export-raw-csv') exportRawCsvPackage(activeSurvey,recordsByTable);
  if(action==='export-backup') exportBackup(activeSurvey,recordsByTable,latestQaqcRun);
  if(action==='download-media') await downloadMedia();
}


function localInputFromIso(iso) {
  if (!iso) return isoNowLocalInput();
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return isoNowLocalInput();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16);
}
function trackStationOptions(selected = '') {
  return `<option value="">No station link</option>${(recordsByTable.stations || []).map((row) => `<option value="${escapeHtml(row.station_sequence)}" ${String(row.station_sequence) === String(selected) ? 'selected' : ''}>Station ${String(row.station_sequence).padStart(2,'0')} · ${escapeHtml(row.station_id || '')}</option>`).join('')}`;
}
function openTrackForm() {
  if (activeTrackId) return alert('A GPS track is already recording. Stop it before starting another track.');
  if (!navigator.geolocation) return alert('This browser does not provide GPS tracking. Use an HTTPS host, enable location services, or add a manual track record.');
  const lead = activeSurvey?.mission?.mission_lead || '';
  const body = `<form id="track-form"><p class="modal-intro">EcoSurvey will record GPS points locally while the app stays open. It saves the track after every accepted point, so a browser interruption still preserves the prior path. Keep the screen awake, use HTTPS, and test the device’s location permissions before a real survey.</p><div class="form-grid"><div class="field"><label for="track_type">Track type *</label><select id="track_type" name="track_type" required>${SCHEMAS.tracks.fields.find((field) => field.name === 'track_type').options.map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></div><div class="field"><label for="track_station">Linked station</label><select id="track_station" name="linked_station_sequence">${trackStationOptions()}</select></div><div class="field"><label for="track_operator">Operator / recorder *</label><input id="track_operator" name="operator" required value="${escapeHtml(lead)}"/></div><div class="field"><label for="track_note">Start note</label><input id="track_note" name="notes" placeholder="Coverage purpose, weather change, route name..."/></div></div><div class="notice">Sampling guard: points are accepted at least 3 seconds apart or after at least 2 m of movement. This limits duplicate points and GPS jitter without hiding the original timestamp/accuracy values.</div><div class="field-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button type="submit" class="button">Start recording</button></div></form>`;
  renderModal('Start live GPS track', body);
  document.querySelector('#track-form')?.addEventListener('submit', async (event) => { event.preventDefault(); await startGpsTrack(); });
}
function stopTrackWatch(renderAfter = true) { if (trackWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(trackWatchId); trackWatchId = null; if (renderAfter) render(); }
async function startGpsTrack() {
  if (activeTrackId) return alert('A GPS track is already recording.');
  const form = document.querySelector('#track-form'); const values = form ? Object.fromEntries(new FormData(form).entries()) : {};
  const record = { track_sequence: nextSequence('tracks', 'track_sequence'), track_type: values.track_type || 'walking', linked_station_sequence: values.linked_station_sequence || '', operator: values.operator || activeSurvey?.mission?.mission_lead || '', notes: values.notes || '', track_status: 'recording', start_datetime_utc: '', end_datetime_utc: '', point_count: 0, distance_m: 0, duration_seconds: 0, average_accuracy_m: '', track_points: [] };
  Object.assign(record, makeIds(activeSurvey.mission, activeSurvey.site, 'tracks', record));
  record._createdAt = new Date().toISOString(); record._updatedAt = record._createdAt;
  await saveRecord(activeSurvey.id, 'tracks', record.track_id, record); await loadRecords(); activeTrackId = record.track_id; closeModal(); view = 'map'; render();
  trackWatchId = navigator.geolocation.watchPosition(async (position) => {
    await appendCurrentTrackPoint({ lat: position.coords.latitude, lon: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: new Date(position.timestamp || Date.now()).toISOString() });
  }, async (error) => {
    const row = (recordsByTable.tracks || []).find((item) => item.track_id === activeTrackId); if (row) { row.track_status = 'stopped_with_issue'; row.notes = `${row.notes ? row.notes + '\n' : ''}GPS watch stopped: ${error.message}`; row._updatedAt = new Date().toISOString(); await saveRecord(activeSurvey.id, 'tracks', row.track_id, row); await loadRecords(); }
    stopTrackWatch(false); activeTrackId = null; render(); alert(`GPS tracking stopped: ${error.message}`);
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
}
async function appendCurrentTrackPoint(point) {
  const row = (recordsByTable.tracks || []).find((item) => item.track_id === activeTrackId); if (!row) return;
  const appended = appendTrackPoint(row.track_points || [], point, { minSeconds: 3, minMeters: 2 }); if (!appended.added) return;
  row.track_points = appended.points; const summary = summarizeTrack(row.track_points); row.point_count = summary.point_count; row.distance_m = Number(summary.distance_m.toFixed(2)); row.duration_seconds = summary.duration_seconds; row.average_accuracy_m = summary.average_accuracy_m === null ? '' : Number(summary.average_accuracy_m.toFixed(1)); row.start_datetime_utc = localInputFromIso(summary.first?.timestamp); row.end_datetime_utc = localInputFromIso(summary.last?.timestamp); row._updatedAt = new Date().toISOString();
  await saveRecord(activeSurvey.id, 'tracks', row.track_id, row); await loadRecords(); if (view === 'map') render();
}
async function stopGpsTrack(status = 'complete') {
  const row = (recordsByTable.tracks || []).find((item) => item.track_id === activeTrackId); stopTrackWatch(false); activeTrackId = null;
  if (!row) return render(); const summary = summarizeTrack(row.track_points || []); row.track_status = status; row.point_count = summary.point_count; row.distance_m = Number(summary.distance_m.toFixed(2)); row.duration_seconds = summary.duration_seconds; row.average_accuracy_m = summary.average_accuracy_m === null ? '' : Number(summary.average_accuracy_m.toFixed(1)); row.end_datetime_utc = localInputFromIso(summary.last?.timestamp || new Date().toISOString()); row._updatedAt = new Date().toISOString(); await saveRecord(activeSurvey.id, 'tracks', row.track_id, row); await loadRecords(); render();
}
function startTransectBuilder() {
  if (!recordsByTable.stations?.length) return alert('Add at least one station before building a transect.');
  if (transectBuilder) return;
  const first = recordsByTable.stations[0]; transectBuilder = { parent_station_sequence: String(first.station_sequence), transect_type: 'transect', width_m: 2, platform: activeSurvey?.mission?.platform || 'shore', observer: activeSurvey?.mission?.mission_lead || '', start: null, end: null, step: 'start' };
}
function builderStation() { return (recordsByTable.stations || []).find((row) => String(row.station_sequence) === String(transectBuilder?.parent_station_sequence)); }
function pointFromStation(row) { const lat = Number(row?.latitude_dd); const lon = Number(row?.longitude_dd); return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, accuracy: Number(row?.gps_accuracy_m) || null, timestamp: new Date().toISOString() } : null; }
function useStationAsTransectStart() { const point = pointFromStation(builderStation()); if (!point) return alert('The selected station has no valid saved GPS point. Capture or enter it before using it as a transect start.'); transectBuilder.start = point; transectBuilder.step = transectBuilder.end ? 'ready' : 'end'; }
async function useDeviceForTransectPoint(which) {
  if (!navigator.geolocation) return alert('This browser does not provide device location.');
  navigator.geolocation.getCurrentPosition((position) => { transectBuilder[which] = { lat: position.coords.latitude, lon: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: new Date(position.timestamp || Date.now()).toISOString() }; transectBuilder.step = which === 'start' ? 'end' : 'ready'; render(); }, (error) => alert(`GPS unavailable: ${error.message}`), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}
function handleTransectBuilderField(event) { if (!transectBuilder) return; const input = event.currentTarget; transectBuilder[input.dataset.builderField] = input.value; if (input.dataset.builderField === 'parent_station_sequence') { transectBuilder.start = null; transectBuilder.end = null; transectBuilder.step = 'start'; } render(); }
function transectBuilderPanel() {
  if (!transectBuilder) return '';
  const built = transectFromEndpoints(transectBuilder.start, transectBuilder.end); const station = builderStation(); const pointText = (point) => point ? `${Number(point.lat).toFixed(6)}, ${Number(point.lon).toFixed(6)}` : 'Not set';
  return `<section class="card transect-builder"><div class="section-head"><div><h3>On-map transect builder</h3><p>Set a station, then tap the map once for the start and once for the end. You can use the station GPS or live device GPS instead of tapping. The app calculates bearing and geodesic length before creating the standard Transect record.</p></div><button class="button ghost small" data-action="cancel-transect-builder">Cancel</button></div><div class="form-grid"><div class="field"><label>Associated station *</label><select data-builder-field="parent_station_sequence">${trackStationOptions(transectBuilder.parent_station_sequence)}</select></div><div class="field"><label>Transect type *</label><select data-builder-field="transect_type">${SCHEMAS.transects.fields.find((field) => field.name === 'transect_type').options.map(([value,label]) => `<option value="${value}" ${transectBuilder.transect_type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="field"><label>Survey width (m) *</label><input data-builder-field="width_m" type="number" min="0.01" step="any" value="${escapeHtml(transectBuilder.width_m)}"/></div><div class="field"><label>Platform *</label><select data-builder-field="platform">${SCHEMAS.transects.fields.find((field) => field.name === 'platform').options.map(([value,label]) => `<option value="${value}" ${transectBuilder.platform === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="field full"><label>Observer / pilot *</label><input data-builder-field="observer" value="${escapeHtml(transectBuilder.observer)}"/></div></div><div class="builder-points"><div><strong>Start</strong><span>${pointText(transectBuilder.start)}</span><div class="actions"><button class="button ghost small" data-action="builder-use-station-start" ${station ? '' : 'disabled'}>Use station GPS</button><button class="button ghost small" data-action="builder-use-device-point" data-builder-point="start">Use device GPS</button>${transectBuilder.start ? '<button class="button ghost small" data-action="builder-clear-point" data-builder-point="start">Clear</button>' : ''}</div></div><div><strong>End</strong><span>${pointText(transectBuilder.end)}</span><div class="actions"><button class="button ghost small" data-action="builder-use-device-point" data-builder-point="end">Use device GPS</button>${transectBuilder.end ? '<button class="button ghost small" data-action="builder-clear-point" data-builder-point="end">Clear</button>' : ''}</div></div></div><div class="notice ${built ? 'good' : ''}">${built ? `<strong>Calculated:</strong> ${built.length_m.toFixed(1)} m · bearing ${built.bearing_deg.toFixed(1)}° true. Save creates Transect ${String(nextSequence('transects','transect_sequence')).padStart(2,'0')} at Station ${String(transectBuilder.parent_station_sequence).padStart(2,'0')}.` : `<strong>Next map tap:</strong> ${transectBuilder.step === 'end' ? 'set the transect end point.' : 'set the transect start point.'}`}</div><div class="actions"><button class="button" data-action="builder-save-transect" ${built && transectBuilder.observer && Number(transectBuilder.width_m) > 0 ? '' : 'disabled'}>Save calculated transect</button></div></section>`;
}
function handleMapTap(event) {
  if (!transectBuilder) return; const svg = event.currentTarget; const rect = svg.getBoundingClientRect(); const x = ((event.clientX - rect.left) / rect.width) * 980; const y = ((event.clientY - rect.top) / rect.height) * 560; const model = buildMapModel(activeSurvey, recordsByTable); const visible = model.features.filter((feature) => mapState.visibleLayers.has(feature.layer)); const scene = mapScene(visible, mapState.currentLocation, activeBasemapForMap(), { worldView: false }); if (scene.empty) return; const point = scene.unproject(x, y); const key = transectBuilder.step === 'end' ? 'end' : 'start'; transectBuilder[key] = { lat: point.lat, lon: point.lon, accuracy: null, timestamp: new Date().toISOString() }; transectBuilder.step = key === 'start' ? 'end' : 'ready'; render();
}
async function saveBuiltTransect() {
  if (!transectBuilder) return; const built = transectFromEndpoints(transectBuilder.start, transectBuilder.end); if (!built) return alert('Set two distinct valid points before saving a transect.'); const parentStationSequence = Number(transectBuilder.parent_station_sequence); const record = { transect_sequence: nextSequence('transects','transect_sequence'), parent_station_sequence: parentStationSequence, transect_type: transectBuilder.transect_type || 'transect', start_datetime_utc: localInputFromIso(built.start.timestamp), end_datetime_utc: localInputFromIso(built.end.timestamp), mark_transect_complete: 'yes', start_latitude_dd: built.start.lat.toFixed(7), start_longitude_dd: built.start.lon.toFixed(7), start_gps_accuracy_m: built.start.accuracy ?? '', end_latitude_dd: built.end.lat.toFixed(7), end_longitude_dd: built.end.lon.toFixed(7), end_gps_accuracy_m: built.end.accuracy ?? '', bearing_deg: Number(built.bearing_deg.toFixed(1)), length_m: Number(built.length_m.toFixed(2)), width_m: Number(transectBuilder.width_m), start_depth_m: '', end_depth_m: '', platform: transectBuilder.platform || activeSurvey?.mission?.platform || 'shore', observer: transectBuilder.observer, media_id_primary: '', notes: 'Created with EcoSurvey on-map transect builder.' };
  Object.assign(record, makeIds(activeSurvey.mission, activeSurvey.site, 'transects', record)); record.start_location = `${record.start_latitude_dd} ${record.start_longitude_dd}`; record.end_location = `${record.end_latitude_dd} ${record.end_longitude_dd}`; record._createdAt = new Date().toISOString(); record._updatedAt = record._createdAt; await saveRecord(activeSurvey.id, 'transects', record.transect_id, record); await loadRecords(); transectBuilder = null; view = 'map'; render();
}

init().catch((error)=>{app.innerHTML=`<main class="main"><div class="notice error"><strong>EcoSurvey could not start.</strong><br>${escapeHtml(error.message)}</div></main>`;});
