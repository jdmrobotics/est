# Changelog

## v0.15.0 — Sensor profiles and video-linked environmental snapshots

### Added

- New **Sensor profiles** view for offline review of imported sensor streams.
- SVG profile charts for depth, temperature, salinity, conductivity, dissolved oxygen, pH, turbidity, heading, and pressure when present in the source data.
- Mission-time and raw-sensor-clock x-axis options.
- Depth-axis orientation that increases downward.
- ROV video-event to nearest-sensor-reading joins, based on the existing launch-time synchronization anchors.
- Selectable video-match tolerance from ±15 to ±300 seconds, with explicit out-of-tolerance status.
- Selected-stream raw CSV download and reproducible video–sensor join CSV download.
- `src/sensor_profiles.js` module and sensor-profile smoke-test coverage.

### Changed

- Header, manifest, schema version, and service-worker cache are now v0.15.0.
- The built-in field workflow now includes a direct Sensor profiles navigation screen after sensor import.

### Validation

- Full regression suite passed, including profile geometry, nearest-reading matching, tolerance handling, and video–sensor CSV join output.



## v0.14.0 — Sensor-stream import and time synchronization

### Added

- CSV import for CTD, depth, temperature, salinity, conductivity, dissolved oxygen, pH, turbidity, navigation, pressure, and custom logger outputs.
- Automatic header detection with reviewable per-column mappings.
- Sensor Stream and Sensor Reading records with stable `SEN` / `R` IDs, original filename, source row count, downsample setting, instrument/equipment links, and import notes.
- Optional ROV-operation link with a sensor-clock-at-launch anchor, calculated time offset, and estimated mission timestamp per reading.
- Sensor Readings layer in the field map and `sensor_readings.geojson` in QGIS exports.
- Sensor metadata and readings in CSV, JSON, QA/QC archive, and one-page field-debrief summaries.
- Bundled `ROV_CTD_Sensor_Stream_Example.csv` plus automated sensor import/QA/QC tests.

### QA/QC

- Checks sensor-stream IDs, reading IDs, timestamp parseability, missing/invalid parent links, imported row counts, sensor GPS values, and ROV synchronization anchors.
- Warns when a ROV-linked stream lacks an estimated mission time or has a large sensor-clock offset.

### Changed

- Sensor readings are shown as a sampled map preview on phones to avoid slowing down the field map; full reading sets remain in QGIS exports.
- Field debrief environmental ranges may combine manual environmental records and imported sensor values.

### Validation

- Full regression suite passed, including sensor mapping, time offset, QA/QC, map, QGIS GeoJSON, and legacy workflow tests.

## v0.13.0 — ROV mission mode and synchronized video logging

### Added

- Dedicated **ROV operation** records with generated IDs such as `ES-YYYYMMDD-01-ROV01`.
- Deployment metadata for the vehicle/equipment record, pilot, tether tender, launch/recovery timing, launch/recovery GPS, maximum depth, tether paid out, navigation track, primary video media, camera/sensor, battery/power, and incident notes.
- Dedicated **ROV video-log** records with generated IDs such as `ES-YYYYMMDD-01-VLOG001`.
- Rapid event logging for launch, descent, transect start/end, organism sightings, habitat changes, targets, samples, sonar markers, issues, ascent, recovery, and general annotations.
- Video elapsed seconds plus normalized `HH:MM:SS` timecode for every video event.
- A video-time launch anchor: record the primary-video time shown at the physical launch moment, then automatically calculate an estimated mission-clock timestamp for each event.
- ROV-operation and video-log map layers plus `rov_operations.geojson` and `video_logs.geojson` in QGIS exports.
- ROV operation/video-event totals, total ROV operation time, and maximum recorded ROV depth in the field debrief.
- A dedicated ROV/video-log smoke test in the automated regression suite.

### QA/QC

- Checks ROV equipment links, video-media links, navigation-track links, deployment timeline order, completed-operation recovery time, video-log parent links, elapsed-video time, and record IDs.
- ROV-reconnaissance protocol now requires at least one ROV operation and requires each operation to have a primary video or sonar-media reference.
- Adds a review warning when a video event's field timestamp differs from the launch-anchor estimate by more than five minutes.

### Changed

- The ROV protocol's Record tabs now make ROV Operations core and Video Logs recommended.
- The app’s map, QA/QC archive, raw CSV export, mission JSON backup, and QGIS package all include the two new ROV tables.

### Validation

- Full regression suite passed, including existing field, mapping, taxon, sample, protocol, QA/QC, and QGIS tests.
- New ROV test passed for timecode parsing, launch-anchor estimation, linked video media, map output, GeoJSON output, and invalid elapsed-time detection.

## v0.12.0 — Protocol templates and adaptive required fields

### Added

- A mission-level **Protocol** screen and protocol metadata fields:
  - protocol ID
  - protocol name
  - protocol version
  - active template status
- Six built-in workflow templates:
  - Benthic transect survey
  - Water-quality monitoring visit
  - ROV reconnaissance
  - eDNA collection
  - Shoreline debris survey
  - Custom / general survey
- Template checklists and an on-screen progress summary.
- Protocol-aware Records tabs labeled **Core**, **Recommended**, or **Optional**.
- Protocol-aware record forms: required and focused fields are presented first; less frequently used fields remain under **Additional optional fields**.
- Protocol-specific defaults for relevant fields, including ROV track type and debris observation entry.
- Protocol-specific QA/QC findings for required record coverage, ROV equipment/media, eDNA samples/custody/labels, and debris observations.
- Protocol ID/name/version in QA/QC output and field-debrief mission summary.
- `src/protocols.js` module and protocol smoke-test coverage.

### Changed

- The default new mission protocol is now **Benthic transect survey**.
- Mission QA/QC becomes stale whenever the active protocol changes.
- Non-organism records such as shoreline debris can be validated without requiring scientific taxon names.
- The quick-observation workflow creates Debris-category records when the shoreline-debris protocol is active.

### Validation

- Existing full regression suite passed.
- New protocol test passed for clean and incomplete benthic, water-quality, ROV, eDNA, and shoreline-debris cases.
- JavaScript syntax checks and local static-server checks passed for the new protocol module.

## v0.11.0 — Samples and chain of custody

- Added physical sample register, custody-event log, QR/barcode label entry, sample label CSV export, sample mapping, and sample/custody QA/QC.

## v0.10.0 — Regional taxon packs

- Added import/exportable versioned regional taxon packs, active-pack provenance, a bundled Mid-Atlantic starter pack, and pack-aware QA/QC.

## v0.9.0 — Earth reference, taxonomy, and QGIS compatibility

- Added bundled offline Earth reference, iNaturalist online search with local caching, and GeoJSON/QGIS validation artifacts.

## v0.8.0 and earlier

- Added field debrief, rapid observations, GPS tracks, on-map transects, media capture, offline map packs, map exports, QA/QC archive, and core field-data workflows.
