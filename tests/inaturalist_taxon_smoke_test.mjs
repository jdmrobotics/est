import assert from 'node:assert/strict';
import { fromINaturalistTaxon, taxaToCsv } from '../src/species.js';

const saved = fromINaturalistTaxon({ id: 48871, name: 'Crassostrea virginica', preferred_common_name: 'Eastern Oyster', rank: 'species', iconic_taxon_name: 'Mollusca' });
assert.equal(saved.taxon_key, 'inat_48871');
assert.equal(saved.inaturalist_taxon_id, '48871');
assert.equal(saved.taxon_source, 'iNaturalist');
assert.equal(saved.taxonomic_level, 'species');
assert.match(saved.source_url, /48871$/);
assert.match(taxaToCsv([saved]), /inaturalist_taxon_id/);
console.log('iNaturalist taxon conversion smoke test passed.');
