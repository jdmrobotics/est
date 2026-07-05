const blank = (value) => value === undefined || value === null || String(value).trim() === '';
const clean = (value) => String(value ?? '').trim();
const slug = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const TAXON_CSV_COLUMNS = [
  'taxon_key', 'scientific_name', 'common_name', 'taxonomic_level', 'group',
  'native_status', 'default_habitat', 'taxon_source', 'inaturalist_taxon_id', 'source_url', 'notes'
];

export const TAXON_LEVELS = new Set(['species', 'genus', 'family', 'order', 'class', 'phylum', 'other']);

export function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = []; let row = []; let value = ''; let inQuotes = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]; const next = source[i + 1];
    if (char === '"' && inQuotes && next === '"') { value += '"'; i += 1; continue; }
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === ',' && !inQuotes) { row.push(value); value = ''; continue; }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value); value = '';
      if (row.some((cell) => clean(cell) !== '')) rows.push(row);
      row = []; continue;
    }
    value += char;
  }
  row.push(value);
  if (row.some((cell) => clean(cell) !== '')) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map((header) => slug(header));
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, clean(cells[index] || '')])));
}

export function taxonKey(input = {}) {
  return slug(input.taxon_key || input.scientific_name || input.common_name || 'taxon');
}

export function normalizeTaxon(input = {}, index = 0) {
  const taxonomicLevel = clean(input.taxonomic_level).toLowerCase() || 'species';
  return {
    taxon_key: taxonKey(input) || `taxon_${index + 1}`,
    scientific_name: clean(input.scientific_name),
    common_name: clean(input.common_name),
    taxonomic_level: TAXON_LEVELS.has(taxonomicLevel) ? taxonomicLevel : 'other',
    group: clean(input.group),
    native_status: clean(input.native_status),
    default_habitat: clean(input.default_habitat),
    taxon_source: clean(input.taxon_source || input.source || 'project_list'),
    inaturalist_taxon_id: clean(input.inaturalist_taxon_id || input.inat_id),
    source_url: clean(input.source_url),
    notes: clean(input.notes)
  };
}

export function validateTaxonRows(rows = []) {
  const errors = []; const warnings = []; const normalized = []; const seen = new Set();
  rows.forEach((row, index) => {
    const taxon = normalizeTaxon(row, index);
    const label = `Row ${index + 2}`;
    if (blank(taxon.scientific_name) && blank(taxon.common_name)) errors.push(`${label}: scientific_name or common_name is required.`);
    if (seen.has(taxon.taxon_key)) errors.push(`${label}: duplicate taxon_key “${taxon.taxon_key}”.`);
    seen.add(taxon.taxon_key);
    if (!blank(row.taxonomic_level) && taxon.taxonomic_level === 'other' && clean(row.taxonomic_level).toLowerCase() !== 'other') warnings.push(`${label}: taxonomic_level “${row.taxonomic_level}” is not in the standard list and will be stored as “other”.`);
    normalized.push(taxon);
  });
  return { rows: normalized, errors, warnings };
}

export function taxonLabel(taxon = {}) {
  const scientific = clean(taxon.scientific_name); const common = clean(taxon.common_name);
  if (scientific && common) return `${scientific} — ${common}`;
  return scientific || common || taxon.taxon_key || 'Unnamed taxon';
}

export function matchTaxa(taxa = [], query = '', limit = 24) {
  const needle = slug(query);
  const scored = taxa.map((taxon) => {
    const key = slug(taxon.taxon_key); const scientific = slug(taxon.scientific_name); const common = slug(taxon.common_name); const group = slug(taxon.group);
    let score = 0;
    if (!needle) score = 1;
    else if (key === needle || scientific === needle || common === needle) score = 100;
    else if (key.startsWith(needle) || scientific.startsWith(needle) || common.startsWith(needle)) score = 80;
    else if (`${key} ${scientific} ${common} ${group}`.includes(needle)) score = 40;
    return { taxon, score };
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || taxonLabel(a.taxon).localeCompare(taxonLabel(b.taxon)));
  return scored.slice(0, limit).map((row) => row.taxon);
}

export function taxaForRefs(taxa = [], refs = []) {
  const byId = new Map(taxa.map((taxon) => [taxon.id, taxon]));
  return refs.map((id) => byId.get(id)).filter(Boolean);
}

export function updateRecentTaxa(refs = [], taxonId, limit = 12) {
  return [taxonId, ...refs.filter((value) => value !== taxonId)].slice(0, limit);
}

export function nameBasis(taxon = {}) {
  if (!blank(taxon.scientific_name) && !blank(taxon.common_name)) return 'both';
  if (!blank(taxon.scientific_name)) return 'scientific';
  return 'common';
}

export function buildQuickObservationDraft({
  taxon = null,
  manualScientificName = '',
  manualCommonName = '',
  stationSequence = '',
  transectSequence = '',
  observationSequence,
  count = '',
  percentCover = '',
  habitatContext = '',
  observationMethod = 'visual',
  identificationConfidence = 'medium',
  observer = '',
  notes = '',
  observedAt = new Date().toISOString()
} = {}) {
  const source = taxon ? (clean(taxon.taxon_source) === 'regional_pack' || clean(taxon.taxon_pack_id) ? 'regional_pack' : 'project_list') : 'manual';
  const resolved = taxon || normalizeTaxon({ scientific_name: manualScientificName, common_name: manualCommonName });
  const hasTransect = !blank(transectSequence);
  const station = clean(stationSequence);
  const transect = hasTransect ? clean(transectSequence) : '';
  return {
    observation_sequence: observationSequence,
    observation_link_context: hasTransect ? 'transect' : 'station',
    observation_station_sequence: station,
    observation_transect_sequence: transect,
    observation_datetime_utc: observedAt,
    taxon_name_basis: nameBasis(resolved),
    taxon_scientific_name: clean(resolved.scientific_name),
    common_name: clean(resolved.common_name),
    taxonomic_level: clean(resolved.taxonomic_level) || 'species',
    observation_category: 'organism',
    count: clean(count),
    abundance_code: '',
    percent_cover: clean(percentCover),
    size_class_cm: '',
    life_stage: '',
    behavior: '',
    habitat_context: clean(habitatContext) || clean(resolved.default_habitat),
    observation_method: clean(observationMethod) || 'visual',
    identification_confidence: clean(identificationConfidence) || 'medium',
    media_id: '',
    observer: clean(observer),
    review_status: source === 'project_list' ? 'unreviewed' : 'provisional',
    notes: clean(notes),
    taxon_source: source,
    taxon_list_id: taxon?.list_id || '',
    taxon_list_name: taxon?.list_name || '',
    taxon_key: taxon?.taxon_key || '',
    taxon_group: taxon?.group || '',
    taxon_pack_id: taxon?.taxon_pack_id || '',
    taxon_pack_name: taxon?.taxon_pack_name || '',
    taxon_pack_version: taxon?.taxon_pack_version || '',
    taxon_pack_region: taxon?.taxon_pack_region || '',
    taxon_pack_review_status: taxon?.taxon_pack_review_status || '',
    quick_entry_mode: 'yes'
  };
}

function escapeCsv(value) {
  const string = String(value ?? '');
  return /[",\n\r]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

export function taxaToCsv(taxa = []) {
  const lines = [TAXON_CSV_COLUMNS.join(',')];
  taxa.forEach((taxon) => lines.push(TAXON_CSV_COLUMNS.map((column) => escapeCsv(taxon[column] || '')).join(',')));
  return `${lines.join('\r\n')}\r\n`;
}

export function sampleTaxonCsv() {
  return [
    TAXON_CSV_COLUMNS.join(','),
    'demo_taxon_001,Example species,Example common name,species,Demo group,unknown,sand,project_list,,,Replace these rows with your approved project list.',
    'demo_taxon_002,,Unidentified small fish,other,Demo group,unknown,open_water,project_list,,,Use a project-specific key for repeated field entries.'
  ].join('\r\n') + '\r\n';
}


const INATURALIST_API = 'https://api.inaturalist.org/v1/taxa/autocomplete';

/** Search the global iNaturalist taxonomy. Requires a live internet connection. */
export async function searchINaturalistTaxa(query, { rank = '', perPage = 20 } = {}) {
  const q = clean(query);
  if (q.length < 2) throw new Error('Enter at least two characters to search the global iNaturalist taxonomy.');
  const params = new URLSearchParams({ q, per_page: String(Math.max(1, Math.min(30, Number(perPage) || 20))) });
  if (rank) params.set('rank', rank);
  const response = await fetch(`${INATURALIST_API}?${params.toString()}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`iNaturalist lookup failed (${response.status}). Check connectivity and try again.`);
  const json = await response.json();
  return Array.isArray(json?.results) ? json.results : [];
}

/** Convert an iNaturalist taxon result into the EcoSurvey controlled-list record shape. */
export function fromINaturalistTaxon(result = {}) {
  const rank = clean(result.rank).toLowerCase();
  const level = TAXON_LEVELS.has(rank) ? rank : 'other';
  const id = clean(result.id);
  const scientific = clean(result.name);
  const common = clean(result.preferred_common_name || result.matched_term);
  return normalizeTaxon({
    taxon_key: id ? `inat_${id}` : scientific || common,
    scientific_name: scientific,
    common_name: common,
    taxonomic_level: level,
    group: clean(result.iconic_taxon_name || ''),
    native_status: '',
    default_habitat: '',
    taxon_source: 'iNaturalist',
    inaturalist_taxon_id: id,
    source_url: id ? `https://www.inaturalist.org/taxa/${id}` : '',
    notes: `Saved from iNaturalist taxonomy${result.rank ? ` (${result.rank})` : ''}.`
  });
}
