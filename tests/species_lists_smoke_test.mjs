import assert from 'node:assert/strict';
import { parseCsv, validateTaxonRows, matchTaxa, buildQuickObservationDraft, sampleTaxonCsv } from '../src/species.js';

const rows = parseCsv('taxon_key,scientific_name,common_name,taxonomic_level,group,default_habitat\nmenidia_menidia,Menidia menidia,Atlantic silverside,species,Fish,sand\ncrab,\"Callinectes, sapidus\",Blue crab,species,Crustacean,mud\n');
assert.equal(rows.length, 2, 'CSV parser should retain quoted commas');
const checked = validateTaxonRows(rows);
assert.equal(checked.errors.length, 0, `expected valid taxa: ${checked.errors.join('; ')}`);
assert.equal(checked.rows[1].scientific_name, 'Callinectes, sapidus');
assert.equal(matchTaxa(checked.rows, 'silver')[0].taxon_key, 'menidia_menidia');
assert.equal(matchTaxa(checked.rows, 'menidia')[0].common_name, 'Atlantic silverside');
assert.equal(validateTaxonRows(parseCsv('taxon_key,common_name\nduplicate,One\nduplicate,Two\n')).errors.length, 1, 'duplicate keys should be rejected');
assert.ok(sampleTaxonCsv().includes('taxon_key'), 'template should expose headers');

const taxon = { ...checked.rows[0], id: 'list-1|menidia_menidia', list_id: 'list-1', list_name: 'Pilot taxa' };
const observation = buildQuickObservationDraft({ taxon, stationSequence: 1, transectSequence: 2, observationSequence: 4, count: 5, observer: 'Tester', observedAt: '2026-07-03T12:00:00.000Z' });
assert.equal(observation.observation_link_context, 'transect');
assert.equal(observation.taxon_source, 'project_list');
assert.equal(observation.taxon_key, 'menidia_menidia');
assert.equal(observation.taxon_name_basis, 'both');
assert.equal(observation.quick_entry_mode, 'yes');
console.log('Species-list utility smoke test passed.');
