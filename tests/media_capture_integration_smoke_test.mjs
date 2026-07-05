import assert from 'node:assert/strict';
import { demoSurvey } from '../src/export.js';
import { withCalculatedFields } from '../src/validation.js';
import { makeCaptureDraft } from '../src/media_capture.js';
import { runFullQaqc } from '../src/qaqc.js';

const sample = demoSurvey();
const file = { name: 'field_observation_001.jpg', type: 'image/jpeg', size: 1_500_000 };
const draft = makeCaptureDraft({
  mission: sample.mission,
  recordsByTable: sample.records,
  target: { context: 'observation', observationSequence: 1 },
  file,
  location: { lat: 38.78023, lon: -75.08982, accuracy: 6 },
  operator: 'Demo Observer',
  description: 'Device-captured evidence for the demo observation.'
});
const media = withCalculatedFields('media', draft, sample.mission, sample.site);
media.attachment_id = 'test-attachment-1';
sample.records.media.push(media);
// The actual app only fills this when blank; keep the existing demo evidence in place.
const run = runFullQaqc({ mission: sample.mission, site: sample.site }, sample.records, { require_environment_per_station: true });
assert.equal(run.summary.errors, 0, JSON.stringify(run.findings, null, 2));
assert.equal(run.summary.warnings, 0, JSON.stringify(run.findings, null, 2));
assert.equal(media.media_link_context, 'observation');
assert.ok(media.station_id, 'Observation-targeted capture inherits linked station ID.');
assert.ok(media.transect_id, 'Observation-targeted capture inherits linked transect ID.');
assert.equal(media.observation_id, sample.records.observations[0].observation_id);
console.log('Media capture integration smoke test passed.');
