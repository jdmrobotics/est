import { normalizeTaxon, validateTaxonRows, taxaToCsv } from './species.js';

export const TAXON_PACK_FORMAT = 'ecosurvey-taxon-pack';
export const TAXON_PACK_VERSION = '1.0';
export const PACK_REVIEW_STATUSES = new Set(['draft', 'reviewed', 'approved', 'deprecated']);

const clean = (value) => String(value ?? '').trim();
const blank = (value) => clean(value) === '';
const slug = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const finite = (value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));

function normalizeSource(source = {}) {
  return {
    name: clean(source.name),
    url: clean(source.url),
    version: clean(source.version),
    retrieved_date: clean(source.retrieved_date),
    license: clean(source.license),
    notes: clean(source.notes)
  };
}

function normalizeBounds(raw = {}) {
  const out = {
    min_lat: clean(raw.min_lat), min_lon: clean(raw.min_lon),
    max_lat: clean(raw.max_lat), max_lon: clean(raw.max_lon)
  };
  return out;
}

function boundsAreValid(bounds) {
  return finite(bounds.min_lat) && finite(bounds.max_lat) && finite(bounds.min_lon) && finite(bounds.max_lon)
    && Number(bounds.min_lat) >= -90 && Number(bounds.max_lat) <= 90
    && Number(bounds.min_lon) >= -180 && Number(bounds.max_lon) <= 180
    && Number(bounds.min_lat) < Number(bounds.max_lat)
    && Number(bounds.min_lon) < Number(bounds.max_lon);
}

export function normalizeTaxonPack(raw = {}) {
  const manifest = raw.manifest || raw.metadata || {};
  const geographic = manifest.geographic_scope || manifest.geography || {};
  const review = clean(manifest.review_status).toLowerCase() || 'draft';
  const sources = Array.isArray(manifest.sources) ? manifest.sources.map(normalizeSource).filter((source) => source.name || source.url) : [];
  return {
    format: clean(raw.format) || TAXON_PACK_FORMAT,
    format_version: clean(raw.format_version || raw.schema_version) || TAXON_PACK_VERSION,
    manifest: {
      pack_id: clean(manifest.pack_id) || slug(manifest.name) || 'ecosurvey_taxon_pack',
      name: clean(manifest.name) || 'Untitled regional taxon pack',
      version: clean(manifest.version) || '0.0.0',
      description: clean(manifest.description),
      region_name: clean(geographic.region_name || manifest.region_name),
      country_or_waterbody: clean(geographic.country_or_waterbody || manifest.country_or_waterbody),
      bounds: normalizeBounds(geographic.bounds || manifest.bounds || {}),
      habitat_scope: clean(manifest.habitat_scope),
      taxonomic_scope: clean(manifest.taxonomic_scope),
      review_status: PACK_REVIEW_STATUSES.has(review) ? review : 'draft',
      reviewed_by: clean(manifest.reviewed_by),
      curator: clean(manifest.curator),
      published_date: clean(manifest.published_date),
      license: clean(manifest.license),
      source_summary: clean(manifest.source_summary),
      sources,
      notes: clean(manifest.notes),
      starter_pack: Boolean(manifest.starter_pack)
    },
    taxa: Array.isArray(raw.taxa) ? raw.taxa : []
  };
}

export function validateTaxonPack(raw = {}) {
  const pack = normalizeTaxonPack(raw);
  const errors = []; const warnings = [];
  if (pack.format !== TAXON_PACK_FORMAT) errors.push(`This file is not an EcoSurvey regional taxon pack (expected format “${TAXON_PACK_FORMAT}”).`);
  if (pack.format_version !== TAXON_PACK_VERSION) warnings.push(`Pack format version “${pack.format_version}” is newer or older than the app’s supported ${TAXON_PACK_VERSION}; review the manifest before field use.`);
  if (blank(pack.manifest.pack_id)) errors.push('Pack manifest needs pack_id.');
  if (blank(pack.manifest.name)) errors.push('Pack manifest needs name.');
  if (blank(pack.manifest.version)) errors.push('Pack manifest needs version.');
  if (!pack.taxa.length) errors.push('Pack contains no taxa.');
  if (Object.values(pack.manifest.bounds).some((value) => !blank(value)) && !boundsAreValid(pack.manifest.bounds)) errors.push('Geographic bounds are incomplete or invalid. Use WGS 84 decimal degrees with min values lower than max values.');
  if (!pack.manifest.region_name) warnings.push('No region_name is recorded. This pack can still be used, but its geographic scope will be unclear in exports.');
  if (!pack.manifest.sources.length && !pack.manifest.source_summary) warnings.push('No source authority is recorded. Treat the pack as draft until a source is documented.');
  if (pack.manifest.review_status === 'draft') warnings.push('This pack is marked draft. It is appropriate for trial entry but should not be treated as a reviewed scientific checklist.');
  const taxonResult = validateTaxonRows(pack.taxa);
  errors.push(...taxonResult.errors); warnings.push(...taxonResult.warnings);
  return { pack: { ...pack, taxa: taxonResult.rows }, errors, warnings };
}

export function speciesListFromTaxonPack(packInput, projectId, sourceFilename = '') {
  const pack = normalizeTaxonPack(packInput);
  const manifest = pack.manifest;
  const now = new Date().toISOString();
  const id = `pack:${manifest.pack_id}:${manifest.version}:${projectId}`;
  const list = {
    id,
    project_id: clean(projectId),
    name: manifest.name,
    notes: manifest.description || manifest.notes,
    source_filename: sourceFilename,
    created_at: now,
    updated_at: now,
    taxon_count: pack.taxa.length,
    list_kind: 'regional_pack',
    taxon_pack_id: manifest.pack_id,
    taxon_pack_name: manifest.name,
    taxon_pack_version: manifest.version,
    taxon_pack_region: manifest.region_name,
    taxon_pack_review_status: manifest.review_status,
    taxon_pack_bounds: manifest.bounds,
    taxon_pack_manifest: manifest
  };
  const taxa = pack.taxa.map((row, index) => ({
    ...normalizeTaxon(row, index),
    taxon_source: 'regional_pack',
    taxon_pack_id: manifest.pack_id,
    taxon_pack_name: manifest.name,
    taxon_pack_version: manifest.version,
    taxon_pack_region: manifest.region_name,
    taxon_pack_review_status: manifest.review_status
  }));
  return { list, taxa, manifest };
}

export function taxonPackFromSpeciesList(list = {}, taxa = []) {
  const manifest = list.taxon_pack_manifest || {
    pack_id: list.taxon_pack_id || slug(list.name) || 'ecosurvey_taxon_pack',
    name: list.taxon_pack_name || list.name || 'EcoSurvey regional taxon pack',
    version: list.taxon_pack_version || '0.0.0',
    description: list.notes || '',
    region_name: list.taxon_pack_region || '',
    bounds: list.taxon_pack_bounds || {},
    review_status: list.taxon_pack_review_status || 'draft',
    source_summary: list.source_filename ? `Imported from ${list.source_filename}` : '',
    starter_pack: false
  };
  return {
    format: TAXON_PACK_FORMAT,
    format_version: TAXON_PACK_VERSION,
    manifest: normalizeTaxonPack({ manifest }).manifest,
    taxa: taxa.map((row) => {
      const copy = { ...row };
      ['id', 'list_id', 'list_name', 'project_id', 'created_at', 'updated_at', 'taxon_pack_id', 'taxon_pack_name', 'taxon_pack_version', 'taxon_pack_region', 'taxon_pack_review_status'].forEach((key) => delete copy[key]);
      return copy;
    })
  };
}

export function taxonPackToJson(pack) {
  return `${JSON.stringify(pack, null, 2)}\n`;
}

export function taxonPackCsv(pack) {
  return taxaToCsv(pack.taxa || []);
}

export function packAppliesToPoint(packOrList = {}, lat, lon) {
  const raw = packOrList.manifest?.bounds || packOrList.taxon_pack_bounds || packOrList.bounds || {};
  const bounds = normalizeBounds(raw);
  if (!boundsAreValid(bounds) || !finite(lat) || !finite(lon)) return null;
  return Number(lat) >= Number(bounds.min_lat) && Number(lat) <= Number(bounds.max_lat)
    && Number(lon) >= Number(bounds.min_lon) && Number(lon) <= Number(bounds.max_lon);
}

export function packStatusLabel(list = {}) {
  if (list.list_kind !== 'regional_pack') return 'Project list';
  const review = clean(list.taxon_pack_review_status || 'draft');
  return `${review[0].toUpperCase()}${review.slice(1)} regional pack`;
}
