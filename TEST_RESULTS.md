# EcoSurvey Field App v0.15 — Sensor Profiles & Video-Sync Test Results

## Automated validation

The full regression suite passed on v0.15, including all existing field records, mapping, QGIS, taxon, sample/custody, protocol, ROV, and sensor-import tests.

The new **sensor-profile and video-link smoke test** verifies:

- available numeric sensor variables are detected correctly;
- mission-time sensor profiles sort and summarize readings accurately;
- depth values render deeper readings lower in the chart geometry;
- nearest-reading matching selects the correct synchronized reading;
- an out-of-window video event is marked outside the configured tolerance;
- video–sensor CSV join rows include IDs, event time, matched reading, time delta, tolerance status, and environmental values.

Run the full suite from the unzipped app directory:

```text
npm test
```

## Manual phone test — v0.15

### Set up

- [ ] Deploy the v0.15 contents to GitHub Pages and open the site online once.
- [ ] Confirm the header shows **PWA v0.15**.
- [ ] Confirm the app opens again in airplane mode.
- [ ] Load the demo mission or a controlled ROV test mission.
- [ ] Import `examples/ROV_CTD_Sensor_Stream_Example.csv` and link it to an ROV operation.
- [ ] Enter the sensor clock shown at physical launch so mission-time synchronization is calculated.

### Sensor profile review

- [ ] Open **Sensor profiles**.
- [ ] Confirm the selected stream name, instrument ID, source filename, and reading count are correct.
- [ ] Confirm at least one numeric profile variable is available.
- [ ] Select **Depth**; verify increasing depth plots downward.
- [ ] Select Temperature, Salinity, Turbidity, and any other available variables; verify the values match the imported CSV.
- [ ] Toggle between **Estimated mission time** and **Raw sensor clock**. Record any expected shift due to the launch anchor.
- [ ] Confirm each video event listed belongs to the selected stream's ROV operation.
- [ ] Test two tolerance settings. A near event should match; an event outside tolerance should remain visibly flagged.

### Export and archival check

- [ ] Download the selected-stream CSV and verify all imported readings are present.
- [ ] Download the video–sensor join CSV and verify event IDs, matched reading IDs, delta seconds, tolerance status, and snapshots.
- [ ] Run Full QA/QC and export the mission ZIP.
- [ ] Extract the QGIS ZIP and verify `sensor_readings.geojson` still contains the full reading count.
- [ ] Archive the original logger file, the two profile exports, the Mission QA/QC ZIP, and the QGIS ZIP together.

## Issue log

```text
Step:
Expected behavior:
Observed behavior:
Sensor stream / ROV operation ID:
Video timecode / event ID:
Match tolerance used:
Offline state: online / airplane mode
Device and browser:
Severity: blocker / inconvenient / cosmetic
Suggested fix:
```

---

# Previous release notes — v0.14 sensor-stream import

## v0.14 sensor-stream automated test

**Status: passed.**

The sensor-stream smoke test validates CSV header mapping, raw and normalized timestamp handling, sensor-clock-to-ROV-launch offsets, generated stream/reading IDs, valid readings in the map model, `sensor_readings.geojson` output, and QA/QC rejection of a reading linked to a nonexistent stream. The complete existing regression suite also passed.

## Manual sensor-stream phone test

Use the included `examples/ROV_CTD_Sensor_Stream_Example.csv` for the first dry run.

### Before import

- [ ] Deploy v0.14 to GitHub Pages and open the site online once.
- [ ] Confirm the app header reads **PWA v0.14**.
- [ ] Load the demo mission and create or select an ROV operation.
- [ ] Verify the phone time and the logger time are set and note any intentional offset.

### Import and review

- [ ] Open **Import sensor CSV** from Home or Sensor Streams.
- [ ] Select the sample CSV and verify the timestamp mapping.
- [ ] Verify the app identifies depth, temperature, salinity, turbidity, dissolved oxygen, GPS, and heading columns.
- [ ] Give the stream a clear name and instrument ID.
- [ ] Link the ROV operation and enter the logger timestamp shown at physical launch.
- [ ] Import the stream; confirm the stream count and reading count.
- [ ] Open **Map & GeoJSON** and turn on Sensor Readings.
- [ ] Run **Full QA/QC**. Correct blocking errors and review clock-offset warnings.
- [ ] Export the QGIS ZIP, extract it, and load `geojson/sensor_readings.geojson` in QGIS.
- [ ] Turn on airplane mode, reopen the app, and confirm imported readings remain visible.

### Expected results

- The sensor stream has a source filename, mapping, source row count, and stable `SEN` ID.
- Each reading has a stable reading ID, raw timestamp, normalized timestamp, and measurement values.
- ROV-linked readings show an estimated mission timestamp.
- The map shows a sampled preview without freezing on dense streams.
- The QGIS layer opens as WGS 84 / EPSG:4326 and includes `coordinate_source`.

## Automated regression status

**Status: passed.**

`npm test` completed successfully for the full EcoSurvey suite:

- field-record and in-app QA/QC validation;
- offline-map, GPS track, transect-builder, media-capture, taxon-list, regional-pack, sample/custody, and protocol workflows;
- QGIS GeoJSON structural compatibility;
- ROV mission operations and synchronized video logging.

The ROV test verifies:

- timecode parsing (`MM:SS` and `HH:MM:SS`) and formatting;
- operation duration calculations;
- launch-anchor conversion from video elapsed time to estimated mission time;
- ROV equipment, navigation-track, and primary-video links;
- ROV operation and video-event map features;
- `rov_operations.geojson` and `video_logs.geojson` output;
- QA/QC rejection of invalid negative elapsed-video time.

## Manual ROV field test

Run this first in a shallow, low-risk location with a tethered or simulated ROV deployment.

### Before deployment

- [ ] Deploy the v0.14 app to GitHub Pages and open it on the phone while online once.
- [ ] Confirm the version in the app header reads **PWA v0.14**.
- [ ] Load the app again in airplane mode.
- [ ] Create or open an **ROV habitat reconnaissance** mission.
- [ ] Confirm device time, ROV recording-computer time, camera time, and any GPS/sensor clock are as closely synchronized as practical.
- [ ] Add an ROV Equipment record and complete the pre-mission check.
- [ ] Add a Station at the launch or survey target.
- [ ] Add an external-reference Media record for the primary video file. Record its exact original filename and storage location.

### During deployment

- [ ] Start a GPS track or prepare a video transect.
- [ ] Create the ROV Operation before launch. Link the ROV Equipment record and primary Video Media record.
- [ ] Capture the launch time and launch GPS. Enter the **video time at launch** value visible in the recording.
- [ ] Add a video event for launch or descent.
- [ ] Add at least one habitat/organism/target video event with elapsed time, event type, description, and station or transect context.
- [ ] Add an issue or recovery event if applicable.
- [ ] Complete the operation with recovery time, maximum depth, tether paid out, and incident notes.

### Before leaving site

- [ ] Stop and save GPS track(s), if used.
- [ ] Open **Map & GeoJSON** and confirm ROV Operations and ROV Video Logs appear in the expected location.
- [ ] Open each video event and confirm it shows a normalized timecode and expected mission-time estimate.
- [ ] Run **Full QA/QC**.
- [ ] Correct all errors. Review any `video_time_sync_difference` warning against the source video, launch anchor, and device clock.
- [ ] Save the field debrief as a PDF.
- [ ] Export the Mission QA/QC ZIP and QGIS GeoJSON ZIP.
- [ ] Copy original ROV video, sensor logs, and the EcoSurvey ZIP to at least one second storage location before clearing device or SD-card storage.

## Expected QGIS layers

After extracting the QGIS ZIP, load these layers through **Layer → Add Layer → Add Vector Layer**:

```text
geojson/rov_operations.geojson
geojson/video_logs.geojson
geojson/tracks.geojson
geojson/transects.geojson
geojson/stations.geojson
geojson/observations.geojson
geojson/media.geojson
```

The ROV-operation layer uses launch GPS when present, falling back to the linked site location. Video logs use independent GPS when recorded, otherwise their linked station, transect start, or site location. Review `coordinate_source` in QGIS before interpreting a feature as an independently measured ROV position.

## Log issues

```text
ROV / video step:
Expected behavior:
Observed behavior:
Video file / elapsed time used:
Offline state: online / airplane mode
Device and browser:
Severity: blocker / inconvenient / cosmetic
Suggested fix:
```
