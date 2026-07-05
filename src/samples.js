export const SAMPLE_LABEL_PREFIX = 'EcoSurvey sample:';

export function normalizeSampleLabel(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 180);
}

export function barcodeDetectorSupported() {
  return typeof BarcodeDetector !== 'undefined';
}

export function defaultSampleLabel(sampleId = '') {
  return normalizeSampleLabel(sampleId);
}

export function sampleLabelText(sample = {}) {
  const label = normalizeSampleLabel(sample.sample_label || sample.sample_id);
  return `${SAMPLE_LABEL_PREFIX} ${label}`.trim();
}

export function custodySummary(sample = {}, events = []) {
  const related = (events || []).filter((event) => String(event.sample_id) === String(sample.sample_id)).sort((a, b) => String(a.custody_datetime_utc || '').localeCompare(String(b.custody_datetime_utc || '')));
  return { sample_id: sample.sample_id || '', event_count: related.length, latest_event: related.at(-1) || null };
}

export function sampleLabelCsv(samples = []) {
  const header = ['sample_id', 'sample_label', 'sample_type', 'container_type', 'preservative', 'storage_condition', 'storage_location'];
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [header.join(','), ...samples.map((sample) => header.map((field) => quote(sample[field] || (field === 'sample_label' ? sample.sample_id : ''))).join(','))].join('\n');
}
