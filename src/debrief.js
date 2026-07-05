/**
 * EcoSurvey v0.8 field debrief report helpers.
 * Generates a compact, print-ready mission synopsis from the same local records
 * used by the QA/QC and GeoJSON workflows. No network or PDF library required.
 */
import { buildMapModel, renderMapSvg } from './map.js';

const esc = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[ch]));
const txt = (value = '') => String(value ?? '').trim();
const finite = (value) => Number.isFinite(Number(value));
const number = (value) => finite(value) ? Number(value) : null;
const limit = (value = '', n = 220) => { const s = txt(value); return s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s; };

function fmt(value, digits = 1) {
  const n = number(value);
  return n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
function fmtRange(values, unit = '', digits = 1) {
  const clean = values.map(number).filter((value) => value !== null);
  if (!clean.length) return '—';
  const min = Math.min(...clean); const max = Math.max(...clean);
  const body = Math.abs(max - min) < 1e-9 ? fmt(min, digits) : `${fmt(min, digits)}–${fmt(max, digits)}`;
  return `${body}${unit ? ` ${unit}` : ''}`;
}
function fmtDate(value = '') {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return txt(value);
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function compactDate(value = '') {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return txt(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function metricRange(records, field, unit, digits = 1) { return fmtRange(records.map((row) => row[field]), unit, digits); }
function durationMinutes(rows) {
  return rows.reduce((sum, row) => sum + Math.max(0, Number(row.duration_seconds) || 0), 0) / 60;
}
function labelObservation(row) { return txt(row.common_name) || txt(row.taxon_scientific_name) || 'Unidentified observation'; }
function qaState(qaqcRun, isCurrent) {
  if (!qaqcRun) return { label: 'Not run', detail: 'No saved in-app QA/QC run.', tone: 'pending', errors: 0, warnings: 0, checkedAt: '' };
  if (!isCurrent) return { label: 'Stale', detail: 'Records changed after the last QA/QC run.', tone: 'warning', errors: Number(qaqcRun.summary?.errors) || 0, warnings: Number(qaqcRun.summary?.warnings) || 0, checkedAt: qaqcRun.created_at || '' };
  const errors = Number(qaqcRun.summary?.errors) || 0; const warnings = Number(qaqcRun.summary?.warnings) || 0;
  if (errors) return { label: 'Review required', detail: `${errors} blocking QA/QC error${errors === 1 ? '' : 's'} remain.`, tone: 'error', errors, warnings, checkedAt: qaqcRun.created_at || '' };
  return { label: warnings ? 'Passed with warnings' : 'Passed', detail: warnings ? `${warnings} QA/QC warning${warnings === 1 ? '' : 's'} should be reviewed.` : 'No blocking QA/QC findings in the current run.', tone: warnings ? 'warning' : 'good', errors, warnings, checkedAt: qaqcRun.created_at || '' };
}

export function buildFieldDebrief(survey = {}, recordsByTable = {}, qaqcRun = null, isCurrent = false) {
  const mission = survey.mission || {}; const site = survey.site || {};
  const records = {
    equipment: recordsByTable.equipment || [], stations: recordsByTable.stations || [], tracks: recordsByTable.tracks || [], transects: recordsByTable.transects || [], environment: recordsByTable.environment || [], observations: recordsByTable.observations || [], media: recordsByTable.media || []
  };
  const observationGroups = new Map();
  records.observations.forEach((row) => {
    const label = labelObservation(row); const key = `${label.toLowerCase()}|${txt(row.taxon_scientific_name).toLowerCase()}`;
    const current = observationGroups.get(key) || { label, records: 0, individuals: 0, unknownCount: 0, confidence: new Set(), notes: [] };
    current.records += 1;
    const count = number(row.count);
    if (count === null) current.unknownCount += 1; else current.individuals += count;
    if (txt(row.identification_confidence)) current.confidence.add(txt(row.identification_confidence));
    if (txt(row.notes)) current.notes.push(limit(row.notes, 90));
    observationGroups.set(key, current);
  });
  const keyObservations = [...observationGroups.values()].sort((a, b) => b.individuals - a.individuals || b.records - a.records || a.label.localeCompare(b.label)).slice(0, 5);
  const model = buildMapModel(survey, records);
  const mapped = model.features.length;
  const missingGeometry = Object.values(model.notLocated || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const mapHtml = renderMapSvg(model.features, null, null, null, null);
  const totalTransectLength = records.transects.reduce((sum, row) => sum + Math.max(0, Number(row.length_m) || 0), 0);
  const totalTrackDistance = records.tracks.reduce((sum, row) => sum + Math.max(0, Number(row.distance_m) || 0), 0);
  const totalObservationCount = records.observations.reduce((sum, row) => sum + Math.max(0, Number(row.count) || 0), 0);
  const env = [
    ['Water temperature', metricRange(records.environment, 'temperature_c', '°C'), records.environment.some((row) => finite(row.temperature_c))],
    ['Salinity', metricRange(records.environment, 'salinity_psu', 'PSU'), records.environment.some((row) => finite(row.salinity_psu))],
    ['Dissolved oxygen', metricRange(records.environment, 'dissolved_oxygen_mg_l', 'mg/L'), records.environment.some((row) => finite(row.dissolved_oxygen_mg_l))],
    ['pH', metricRange(records.environment, 'ph', '', 2), records.environment.some((row) => finite(row.ph))],
    ['Turbidity', metricRange(records.environment, 'turbidity_ntu', 'NTU'), records.environment.some((row) => finite(row.turbidity_ntu))],
    ['Depth', metricRange(records.environment, 'depth_m', 'm'), records.environment.some((row) => finite(row.depth_m))],
    ['Water visibility', metricRange(records.environment, 'water_visibility_m', 'm'), records.environment.some((row) => finite(row.water_visibility_m))]
  ].filter(([, , has]) => has).slice(0, 6).map(([label, value]) => ({ label, value }));

  return {
    generatedAt: new Date().toISOString(),
    mission: {
      id: txt(mission.mission_id) || 'UNASSIGNED', name: txt(mission.mission_name) || 'Untitled mission', date: compactDate(mission.mission_date), lead: txt(mission.mission_lead) || 'Not recorded', team: txt(mission.team_members), objective: limit(mission.objective, 280) || 'No objective recorded.', platform: txt(mission.platform) || 'Not recorded', weather: txt(mission.weather_summary) || txt(records.environment.find((row) => txt(row.weather_condition))?.weather_condition) || 'Not recorded'
    },
    site: { id: txt(site.site_id) || 'UNASSIGNED', name: txt(site.site_name) || 'Unnamed site', waterbody: txt(site.waterbody), region: [txt(site.region_state), txt(site.country)].filter(Boolean).join(', '), habitat: txt(site.dominant_habitat) || 'Not recorded', access: limit(site.access_notes, 150) },
    qa: qaState(qaqcRun, isCurrent),
    counts: { stations: records.stations.length, tracks: records.tracks.length, transects: records.transects.length, environmental: records.environment.length, observations: records.observations.length, media: records.media.length, equipment: records.equipment.length },
    effort: { transectLengthM: totalTransectLength, trackDistanceM: totalTrackDistance, trackMinutes: durationMinutes(records.tracks), observedIndividuals: totalObservationCount, uniqueTaxa: observationGroups.size, mapped, missingGeometry },
    environment: env,
    keyObservations,
    mapHtml,
    mediaCount: records.media.length
  };
}

function qaBadge(qa) { return `<span class="debrief-qa ${esc(qa.tone)}">${esc(qa.label)}</span>`; }
function recordMetric(label, value, detail = '') { return `<div class="debrief-metric"><strong>${esc(value)}</strong><span>${esc(label)}</span>${detail ? `<em>${esc(detail)}</em>` : ''}</div>`; }
function observationRows(rows) {
  if (!rows.length) return '<div class="debrief-empty">No observations recorded.</div>';
  return `<ol class="debrief-observations">${rows.map((item) => `<li><strong>${esc(item.label)}</strong><span>${item.individuals ? `${esc(fmt(item.individuals, 0))} individuals` : item.unknownCount ? 'Count not recorded' : `${item.records} record${item.records === 1 ? '' : 's'}`}${item.records > 1 ? ` · ${item.records} records` : ''}</span></li>`).join('')}</ol>`;
}
function environmentRows(rows) { return rows.length ? `<div class="debrief-env-grid">${rows.map((item) => `<div><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`).join('')}</div>` : '<div class="debrief-empty">No environmental values recorded.</div>'; }
function photoTiles(photos = []) {
  if (!photos.length) return '<div class="debrief-empty">No locally stored photos are available for this report. External ROV/GoPro/video references remain in the media log.</div>';
  return `<div class="debrief-photos">${photos.slice(0, 3).map((photo) => `<figure><img src="${esc(photo.src)}" alt="${esc(photo.alt || photo.filename || 'Field photo')}"/><figcaption>${esc(limit(photo.caption || photo.filename || 'Field photo', 72))}</figcaption></figure>`).join('')}</div>`;
}

export function renderFieldDebriefBody(debrief, photos = [], { preview = false } = {}) {
  const d = debrief;
  const effortDetails = [
    `${fmt(d.effort.transectLengthM, 1)} m transect length`,
    `${fmt(d.effort.trackDistanceM, 1)} m GPS track distance`,
    `${fmt(d.effort.trackMinutes, 1)} min tracked`,
    `${fmt(d.effort.observedIndividuals, 0)} counted individuals`,
    `${fmt(d.effort.uniqueTaxa, 0)} taxa`
  ];
  return `<article class="debrief-report ${preview ? 'debrief-preview-report' : ''}">
    <header class="debrief-header"><div><p class="debrief-kicker">EcoSurvey field debrief</p><h1>${esc(d.mission.name)}</h1><p class="debrief-subtitle">${esc(d.mission.id)} · ${esc(d.site.name)} · ${esc(d.mission.date)}</p></div><div class="debrief-status"><span>QA/QC</span>${qaBadge(d.qa)}<small>${esc(d.qa.detail)}</small></div></header>
    <section class="debrief-strip">
      ${recordMetric('Stations', d.counts.stations)}${recordMetric('Transects', d.counts.transects)}${recordMetric('Observations', d.counts.observations)}${recordMetric('Environmental records', d.counts.environmental)}${recordMetric('Media records', d.counts.media)}
    </section>
    <section class="debrief-layout">
      <div class="debrief-column">
        <section class="debrief-section"><h2>Mission snapshot</h2><dl class="debrief-kv"><div><dt>Objective</dt><dd>${esc(d.mission.objective)}</dd></div><div><dt>Field lead / team</dt><dd>${esc(d.mission.lead)}${d.mission.team ? ` · ${esc(d.mission.team)}` : ''}</dd></div><div><dt>Platform / weather</dt><dd>${esc(d.mission.platform)} · ${esc(d.mission.weather)}</dd></div><div><dt>Site</dt><dd>${esc(d.site.waterbody || d.site.name)}${d.site.region ? ` · ${esc(d.site.region)}` : ''}</dd></div><div><dt>Dominant habitat</dt><dd>${esc(d.site.habitat)}</dd></div></dl></section>
        <section class="debrief-section"><h2>Effort & coverage</h2><div class="debrief-effort">${effortDetails.map((item) => `<span>${esc(item)}</span>`).join('')}</div><p class="debrief-footnote">${d.effort.mapped} mapped feature${d.effort.mapped === 1 ? '' : 's'}${d.effort.missingGeometry ? ` · ${d.effort.missingGeometry} record${d.effort.missingGeometry === 1 ? '' : 's'} without usable geometry` : ''}</p></section>
        <section class="debrief-section"><h2>Environmental range</h2>${environmentRows(d.environment)}</section>
        <section class="debrief-section"><h2>Key observations</h2>${observationRows(d.keyObservations)}</section>
      </div>
      <div class="debrief-column debrief-map-column"><section class="debrief-section debrief-map-section"><h2>Field geometry</h2>${d.mapHtml}<p class="debrief-footnote">Vector mission geometry only · WGS 84 latitude/longitude · no basemap included in the debrief.</p></section>
      <section class="debrief-section"><h2>Field photos</h2>${photoTiles(photos)}<p class="debrief-footnote">Showing up to three locally stored photos. Larger/external media remain referenced in the mission archive.</p></section></div>
    </section>
    <footer class="debrief-footer"><span>Generated ${esc(fmtDate(d.generatedAt))} · EcoSurvey Field App</span><span>QA/QC errors: ${esc(d.qa.errors)} · warnings: ${esc(d.qa.warnings)}${d.qa.checkedAt ? ` · checked ${esc(fmtDate(d.qa.checkedAt))}` : ''}</span></footer>
  </article>`;
}

export function debriefPrintStyles() {
  return `
  :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#eef4f4;color:#132a2d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.print-actions{padding:14px;text-align:center;background:#123f45}.print-actions button{border:0;border-radius:8px;padding:10px 15px;font-weight:800;cursor:pointer;background:#d7f3ef;color:#123f45}.print-actions span{display:inline-block;margin-left:12px;color:#d9eeee;font-size:12px}.debrief-report{width:11in;min-height:8.1in;margin:0 auto;background:#fff;padding:.27in .32in;overflow:hidden}.debrief-header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #0b6e75;padding-bottom:10px}.debrief-kicker{margin:0 0 3px;text-transform:uppercase;letter-spacing:.12em;font-size:8px;font-weight:900;color:#43747a}.debrief-header h1{font-size:21px;line-height:1.08;margin:0;color:#123f45}.debrief-subtitle{font-size:10px;color:#527075;margin:5px 0 0}.debrief-status{min-width:180px;text-align:right;font-size:9px;color:#527075;display:grid;justify-items:end;gap:3px}.debrief-status small{max-width:205px;line-height:1.22}.debrief-qa{display:inline-block;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:900}.debrief-qa.good{background:#dcefe4;color:#175c2b}.debrief-qa.warning,.debrief-qa.pending{background:#fff0cc;color:#765100}.debrief-qa.error{background:#ffe4df;color:#9a2b20}.debrief-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:10px 0}.debrief-metric{padding:7px;border:1px solid #d8e6e5;border-radius:7px;background:#fbfdfd;display:grid;gap:1px}.debrief-metric strong{font-size:16px;color:#0b5f67}.debrief-metric span{font-size:8px;text-transform:uppercase;letter-spacing:.04em;color:#587276;font-weight:850}.debrief-metric em{font-style:normal;font-size:8px;color:#789}.debrief-layout{display:grid;grid-template-columns:39% 61%;gap:10px}.debrief-column{min-width:0}.debrief-section{break-inside:avoid;border:1px solid #dce8e7;border-radius:7px;padding:7px 8px;margin-bottom:7px;background:#fff}.debrief-section h2{font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:#0b5f67;margin:0 0 5px}.debrief-kv{display:grid;gap:4px;margin:0}.debrief-kv div{display:grid;grid-template-columns:92px 1fr;gap:6px}.debrief-kv dt{font-size:8px;font-weight:850;color:#587276}.debrief-kv dd{font-size:9px;line-height:1.2;margin:0}.debrief-effort{display:flex;gap:4px;flex-wrap:wrap}.debrief-effort span{font-size:8px;font-weight:750;border-radius:999px;background:#e8f4f2;color:#185962;padding:3px 6px}.debrief-footnote{font-size:8px;line-height:1.25;margin:5px 0 0;color:#6a8588}.debrief-env-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.debrief-env-grid div{background:#f4f9f8;border-radius:5px;padding:5px}.debrief-env-grid span{display:block;font-size:7px;color:#587276;text-transform:uppercase;letter-spacing:.025em}.debrief-env-grid strong{display:block;font-size:10px;color:#163e43;margin-top:2px}.debrief-observations{margin:0;padding-left:16px}.debrief-observations li{font-size:9px;line-height:1.24;margin:3px 0}.debrief-observations span{color:#587276;margin-left:3px}.debrief-empty{font-size:9px;color:#718b8d;font-style:italic}.debrief-map-section{padding-bottom:5px}.debrief-map-section .map-frame{border:0;border-radius:5px;overflow:hidden}.debrief-map-section .mission-map{width:100%;height:auto;display:block;min-height:0}.debrief-map-section .map-attribution{font-size:7px;padding:3px 5px}.map-water{fill:#edf7f7}.map-grid-line{stroke:#c8dddd;stroke-width:1}.map-grid-label{fill:#6d888b;font-size:10px}.map-line{fill:none;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}.map-point{stroke:#fff;stroke-width:2}.map-scale line{stroke:#294b50;stroke-width:2}.map-scale text,.map-north{fill:#294b50;font-size:11px;font-weight:800}.map-north-arrow{fill:#294b50}.debrief-photos{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.debrief-photos figure{margin:0}.debrief-photos img{display:block;width:100%;height:62px;object-fit:cover;border:1px solid #d6e6e5;border-radius:4px;background:#f1f6f6}.debrief-photos figcaption{font-size:7px;line-height:1.2;color:#547276;margin-top:2px;overflow-wrap:anywhere}.debrief-footer{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #dce8e7;padding-top:5px;margin-top:1px;font-size:7.5px;color:#587276}.debrief-preview-report{width:100%;min-height:0;padding:14px;margin:0;border:0;background:#fff}.debrief-preview-report .debrief-header h1{font-size:20px}@media(max-width:760px){.debrief-report{width:100%;padding:14px}.debrief-layout{grid-template-columns:1fr}.debrief-strip{grid-template-columns:repeat(3,1fr)}.debrief-header{display:block}.debrief-status{text-align:left;justify-items:start;margin-top:8px}.debrief-map-column{display:flex;flex-direction:column}.debrief-map-section{order:-1}.debrief-footer{display:block}.debrief-footer span{display:block;margin:3px 0}}@media print{@page{size:letter landscape;margin:.2in}body{background:#fff}.print-actions{display:none}.debrief-report{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.debrief-preview-report{padding:0}.debrief-section,.debrief-strip,.debrief-header,.debrief-footer{break-inside:avoid;page-break-inside:avoid}.debrief-map-section .mission-map{max-height:3.0in}.debrief-photos img{height:55px}}
  `;
}

export function renderFieldDebriefDocument(debrief, photos = []) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>EcoSurvey Field Debrief — ${esc(debrief.mission.id)}</title><style>${debriefPrintStyles()}</style></head><body><div class="print-actions"><button onclick="window.print()">Print / Save as PDF</button><span>Use landscape orientation and keep browser headers/footers off for a one-page field debrief.</span></div>${renderFieldDebriefBody(debrief, photos)}</body></html>`;
}
