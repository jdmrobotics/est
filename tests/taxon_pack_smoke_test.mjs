import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { demoSurvey } from '../src/export.js';
import { withCalculatedFields } from '../src/validation.js';
import { buildQuickObservationDraft } from '../src/species.js';
import { runFullQaqc } from '../src/qaqc.js';
import { validateTaxonPack, speciesListFromTaxonPack, taxonPackFromSpeciesList, packAppliesToPoint } from '../src/taxon_packs.js';

const raw = JSON.parse(await readFile(new URL('../examples/taxon_packs/Mid_Atlantic_Estuary_Starter_Pack_v1.0.0.json', import.meta.url), 'utf8'));
const checked = validateTaxonPack(raw);
assert.equal(checked.errors.length, 0, `Bundled pack must validate: ${checked.errors.join('; ')}`);
assert.ok(checked.warnings.some((warning) => warning.includes('draft')), 'Demo pack must remain clearly marked draft.');
assert.equal(checked.pack.taxa.length, 21, 'Bundled starter pack taxon count should remain stable.');

const converted = speciesListFromTaxonPack(checked.pack, 'ES-2026', 'Mid_Atlantic_Estuary_Starter_Pack_v1.0.0.json');
assert.equal(converted.list.list_kind, 'regional_pack');
assert.equal(converted.list.taxon_pack_id, 'mid_atlantic_estuary_starter');
assert.equal(converted.taxa[0].taxon_source, 'regional_pack');
assert.equal(converted.taxa[0].taxon_pack_version, '1.0.0');
assert.equal(packAppliesToPoint(converted.list, 39.0, -75.3), true);
assert.equal(packAppliesToPoint(converted.list, 25.8, -80.2), false);

const exported = taxonPackFromSpeciesList(converted.list, converted.taxa);
assert.equal(exported.format, 'ecosurvey-taxon-pack');
assert.equal(exported.manifest.pack_id, 'mid_atlantic_estuary_starter');
assert.equal(exported.taxa[0].taxon_pack_id, undefined, 'Exported rows should not contain device-only pack fields.');

const demo = demoSurvey();
const survey = { id: 'regional-pack-test', mission: demo.mission, site: demo.site };
const controlled = { ...converted.taxa[0], id: `${converted.list.id}|${converted.taxa[0].taxon_key}`, list_id: converted.list.id, list_name: converted.list.name, project_id: converted.list.project_id };
const draft = buildQuickObservationDraft({ taxon: controlled, stationSequence: 1, transectSequence: 1, observationSequence: 2, count: 2, observer: 'Demo Observer', observedAt: new Date().toISOString() });
assert.equal(draft.taxon_source, 'regional_pack');
assert.equal(draft.taxon_pack_id, 'mid_atlantic_estuary_starter');
assert.equal(draft.taxon_pack_version, '1.0.0');
const record = withCalculatedFields('observations', draft, demo.mission, demo.site);
demo.records.observations.push(record);
const qaqc = runFullQaqc(survey, demo.records, { require_environment_per_station: true, bbox: {} });
assert.equal(qaqc.summary.errors, 0, JSON.stringify(qaqc.findings, null, 2));
const broken = { ...record, taxon_pack_id: '' };
demo.records.observations = [broken];
const brokenQaqc = runFullQaqc(survey, demo.records, { require_environment_per_station: true, bbox: {} });
assert.ok(brokenQaqc.findings.some((finding) => finding.rule === 'taxon_pack_reference'), 'Missing regional pack provenance must be flagged.');
console.log('Regional taxon-pack smoke test passed.');
