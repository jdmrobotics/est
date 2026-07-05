# EcoSurvey Field App v0.15

Offline-first ecological survey records for phones and tablets: protocol-guided collection, maps, media, taxon packs, QA/QC, QGIS exports, ROV deployment/video logs, sensor imports, and field-ready sensor-profile review.

## New in v0.15 — sensor profiles and video-linked environmental snapshots

### What it adds

- A new **Sensor profiles** screen for reviewing one selected imported stream at a time.
- Offline SVG plots for depth, temperature, salinity, conductivity, dissolved oxygen, pH, turbidity, heading, and pressure when those variables are present in the imported CSV.
- Two time bases: **estimated mission time** (recommended for ROV/video comparisons) and the preserved **raw sensor clock**.
- Depth plots increase downward so a deeper reading appears lower on the profile, matching field interpretation.
- Video-event environmental snapshots: each ROV video log is joined to the nearest reading in its linked stream using estimated mission time.
- A selectable match tolerance from ±15 to ±300 seconds. Events outside that window are clearly marked rather than silently treated as synchronized.
- Two reproducible exports from the Sensor profiles screen:
  - every stored reading from the selected stream as CSV;
  - a video–sensor nearest-reading join CSV with the selected time tolerance and calculated time delta.

The original CSV and full GeoJSON/QA/QC exports remain the archive of record. The profile chart is a field-review tool: it never smooths, modifies, or overwrites raw readings.

### Using Sensor profiles in the field

1. Import a sensor CSV through **Home → Import sensor CSV**.
2. For ROV work, link it to the correct ROV operation and enter the logger timestamp displayed at physical launch.
3. Open **Sensor profiles** from the navigation bar or Home.
4. Choose a stream, variable, time basis, and video-match tolerance.
5. Review the trace and inspect the event table. Investigate any event that is marked **outside tolerance**.
6. Download the selected-stream and video–sensor CSVs before clearing local data.
7. Run **Full QA/QC** again after correcting any source records or time anchors.

### GitHub Pages update

Upload the **contents of this folder** to the root of the existing Pages repository. Do not upload the release ZIP as the site and do not put the app inside another version-named folder.

The new source file required for v0.15 is:

```text
src/sensor_profiles.js
```

The updated app shell files are also required:

```text
index.html
manifest.webmanifest
sw.js
src/main.js
src/schema.js
src/styles.css
package.json
```

After the push deploys, open the GitHub Pages URL while online once on each phone. The service-worker cache is versioned as **v0.15.0**; close an installed older app, refresh the web page, then reopen or reinstall the home-screen shortcut if it still shows an earlier version.

### v0.15 phone test

1. Open the deployed app while online; confirm the header reads **PWA v0.15**.
2. Load a mission with a linked ROV operation, video logs, and an imported sensor stream. The bundled CTD-style example can be used for a controlled test.
3. Open **Sensor profiles** and confirm the stream and numeric variables are listed.
4. Select **Depth (m)** and confirm later/deeper values appear lower on the chart.
5. Switch between **Estimated mission time** and **Raw sensor clock**. Confirm the chart changes only when a time offset exists.
6. Select a 90-second tolerance and verify a nearby video event is matched while a far-away event is marked outside tolerance.
7. Download both new CSV files and open them in a spreadsheet. Confirm the video–sensor join contains event ID, selected reading ID, time delta, and environmental values.
8. Turn on airplane mode, reopen Sensor profiles, and confirm the imported stream and chart remain available.
9. Run QA/QC, generate the mission archive, and retain the original logger CSV with the export package.

---

## Legacy reference: v0.14 sensor-stream workflow

The app remains an offline-first progressive web app for repeatable marine, freshwater, shoreline, sampling, and ROV ecological surveys.

```text
Mission + protocol → site → equipment → stations → tracks / transects → environment
→ taxa / observations → samples / custody → media → map → QA/QC → QGIS + field debrief
```

## Previous release — v0.14 sensor-stream import and synchronized instrument data

EcoSurvey can now import structured logger CSV files—such as CTD, depth, temperature, salinity, dissolved-oxygen, turbidity, navigation, or custom sensor exports—into the active mission. It creates one immutable **Sensor Stream** record plus individually mapped **Sensor Readings** stored locally in the app.

```text
Raw logger CSV → column mapping → Sensor Stream → timestamped readings
→ optional ROV launch-time sync → map + QA/QC → QGIS GeoJSON + mission archive
```

### Supported CSV workflow

1. Open **Home** or **Records → Sensor Streams**, then choose **Import sensor CSV**.
2. Select a comma-separated file with a header row. A small example is included at `examples/ROV_CTD_Sensor_Stream_Example.csv`.
3. Confirm the automatically detected column mapping. A timestamp is required; latitude, longitude, depth, temperature, salinity, conductivity, dissolved oxygen, pH, turbidity, heading, and pressure are optional.
4. Enter a stream name, stream type, instrument ID, optional equipment record, and any calibration/import notes.
5. When linking to an ROV operation, enter the logger’s own timestamp at the physical launch moment. EcoSurvey calculates the clock offset and estimates a mission time for each reading.
6. Run QA/QC, inspect the readings on the map, and export the QGIS package.

The app accepts up to **25,000 imported readings** in one stream after downsampling. Use **Import every Nth row** for dense logs. Keep the original raw instrument CSV, manufacturer metadata, and calibration records in your project archive; the app preserves the original filename, import mapping, row counts, and synchronization assumptions but does not replace the raw source file.

### ROV/video synchronization

When a sensor stream is linked to an ROV operation, the app needs two values:

- the ROV operation’s phone/mission launch time; and
- the sensor/logger time displayed at that same physical launch moment.

This creates a documented time offset. Sensor readings retain their raw timestamp and normalized timestamp, while the app calculates an estimated mission timestamp for alignment with video-event logs. QA/QC warns when synchronization data are incomplete or implausibly offset. This is a field-aid workflow—not a high-precision replacement for hardware PPS, NTP, or vendor time-synchronization procedures.

### Sensor output and QGIS

The QGIS GeoJSON package now includes:

```text
geojson/sensor_readings.geojson
```

Each feature contains the raw/normalized/estimated timestamps, stream ID, instrument metadata, imported measurement fields, and `coordinate_source`. Readings with their own GPS use that GPS. Readings without independent GPS fall back to the linked ROV launch point or mission site only for visual context; check `coordinate_source` before treating a point as an independent sensor position.

The field debrief combines manual environmental records and imported sensor values when reporting environmental ranges and lists sensor-stream/reading totals in the effort summary.

### v0.14 sensor-import phone test

1. Deploy the current release, open it online once, and confirm the header shows the current PWA version.
2. Load the demo mission and select the ROV reconnaissance protocol.
3. Add or choose an ROV operation, then import `examples/ROV_CTD_Sensor_Stream_Example.csv`.
4. Confirm timestamp, GPS, depth, temperature, salinity, turbidity, dissolved-oxygen, and heading mappings.
5. Link the stream to the operation and enter the sensor timestamp at physical launch.
6. Check **Map & GeoJSON** for the Sensor Readings layer.
7. Run **Full QA/QC**, then download the mission archive and QGIS GeoJSON ZIP.
8. In QGIS, extract the package and load `geojson/sensor_readings.geojson`.
9. Switch to airplane mode and confirm the imported readings, map layer, and completed QA/QC run remain available.

## New in v0.13 — ROV mission mode and synchronized video logging

EcoSurvey now supports a field-to-video workflow for tethered ROV reconnaissance without requiring a live telemetry system.

```text
ROV equipment check → ROV operation / deployment → primary video reference
→ elapsed-video event logs → linked station, transect, or observation
→ QA/QC → map + GeoJSON/QGIS + field debrief
```

### ROV operation record

Use **Start ROV operation** on Home or open **Records → ROV Operation**. Record the vehicle/equipment check, vehicle ID, pilot and tether tender, deployment/recovery times, launch/recovery GPS, maximum depth, tether paid out, navigation track, primary video reference, camera/sensor, power, and any incident.

Before the ROV enters the water, add the ROV as an **Equipment** record with category **ROV**. Add an external **Media** record for the primary ROV video file, then select that media record in the operation. Long ROV footage remains on its original SD card or recording computer; EcoSurvey stores the traceable filename and links it to field events.

### Video synchronization and rapid logging

Use **Log ROV video event** after the deployment record exists. Each video event stores:

- elapsed video seconds and a normalized `HH:MM:SS` timecode;
- an event type such as organism sighting, habitat change, target, sample, sonar marker, or issue;
- optional station, transect, or observation context;
- candidate taxon, confidence, logger, and an event description;
- the operation’s primary Media ID.

For reliable time matching, enter **Video time at launch (s)** in the ROV operation: the time shown by the primary recording at the physical launch moment. For example, use `0` when recording begins exactly at launch; use `34` when the video had been recording for 34 seconds at launch. The app then calculates an **Estimated mission time from video sync** for each event.

The logger's own field timestamp is preserved separately. QA/QC warns when it differs from the launch-anchor estimate by more than five minutes, which helps identify a wrong video offset, incorrect device clock, or data-entry mistake.

### ROV reconnaissance phone test

1. Load the app online once after deployment, then switch the phone to airplane mode.
2. Create a mission with **ROV habitat reconnaissance** as the protocol.
3. Add a vehicle equipment record with category **ROV** and complete its pre-mission check.
4. Add a station at the launch or target area.
5. Add a video Media record as an external reference, including its filename and storage path.
6. Create an ROV operation and link that equipment and Media record. Set a launch location and the video time at launch.
7. Add one short GPS track or one video transect to document coverage.
8. Add three video events: one launch/descent marker, one habitat/organism observation, and one recovery marker.
9. Open **Map & GeoJSON** and confirm the ROV operation and video-log layers appear.
10. Run **Full QA/QC**. Correct any operation, media, timecode, or synchronization finding.
11. Export the Mission QA/QC ZIP and QGIS GeoJSON ZIP. In QGIS, load `rov_operations.geojson` and `video_logs.geojson` along with stations/transects/tracks.

### Important limitations

- v0.13 is a structured field log and video-annotation workflow. It does not control the ROV, ingest live telemetry, or replace the vehicle manufacturer’s safety procedures.
- The app does not copy large external ROV video files into the mission ZIP. Archive the original recordings beside the EcoSurvey mission ZIP, using the media filename and storage path as the link.
- For high-precision sensor/video synchronization, set device clocks before the mission and record a visible or audible synchronization cue in the video.

## New in v0.12 — Protocol templates and adaptive field workflow

Each mission now has an active **survey protocol template**. The template makes the most relevant record types and fields easier to reach, applies practical defaults, and adds protocol-specific QA/QC checks without deleting or hiding your underlying EcoSurvey data model.

Included templates:

| Protocol | Best for | Core records / checks |
|---|---|---|
| **Benthic transect survey** | habitat, benthic organisms, reef, oyster, seagrass, hard-bottom work | stations, transects, environmental readings, observations |
| **Water-quality monitoring visit** | repeated water-quality stations | stations and environmental readings |
| **ROV reconnaissance** | tethered ROV inspections and habitat reconnaissance | ROV equipment, station, transect or track, ROV media |
| **eDNA collection** | water filtration and molecular sample collection | station, environmental reading, eDNA sample, label, custody |
| **Shoreline debris survey** | litter and debris transects | station, transect, debris-category observation |
| **Custom / general survey** | pilot work or a method not yet templated | project-defined workflow with standard EcoSurvey QA/QC |

A template is not a substitute for a written SOP, permit conditions, or formal survey design. It is a field-workflow aid and a transparent QA/QC profile.

## How to use protocol templates

1. Create or open a mission.
2. Open **Protocol** in the navigation, or use **Mission & site**.
3. Read the template description, checklist, and core/recommended/optional record types.
4. Select **Activate this protocol**.
5. Enter records as usual. The **Records** tabs show each table as **Core**, **Recommended**, or **Optional** for the selected template.
6. Open a record form: essential fields appear first; less frequently used fields remain available under **Additional optional fields**.
7. Run **Full QA/QC** before export.

Changing protocols does not delete records or silently rewrite scientific observations. It updates mission protocol metadata and marks the previous QA/QC run stale, requiring a fresh validation before export.

## Protocol-specific QA/QC

In addition to the existing record, ID, GPS, media, sample, custody, and relationship checks, v0.12 verifies the selected protocol:

- **Benthic transect:** expects station, transect, environmental, and observation records.
- **Water quality:** expects stations with environmental coverage.
- **ROV:** expects an ROV equipment record, navigation coverage through at least one track or transect, and ROV/video/sonar media.
- **eDNA:** expects at least one `eDNA water` sample, a label marked Applied / Verified / Replaced, and at least one linked custody event for each eDNA sample.
- **Shoreline debris:** expects debris-category observations.

The QA/QC report records the active protocol ID, name, and version. Mission exports retain that provenance in the mission table and generated report.

## First test on a phone

1. Load the app while online so the v0.12 application shell caches.
2. Choose **Load demo mission**.
3. Open **Protocol** and activate **Water-quality monitoring visit**.
4. Confirm the Records screen highlights Station and Environmental records as core.
5. Run QA/QC; the adapted demo should pass.
6. Switch to **ROV reconnaissance**, run QA/QC, and observe the expected missing-ROV-equipment finding.
7. Change a demo equipment record to `ROV`, then run QA/QC again.
8. Repeat with **eDNA collection** and **Shoreline debris survey** to confirm the QA/QC findings clearly explain incomplete protocol requirements.
9. Turn on airplane mode, reopen the app, and confirm the Protocol screen and saved mission remain available.

Record field issues using:

```text
Protocol:
Step:
What I expected:
What happened:
Severity: blocker / inconvenient / cosmetic
Suggested fix:
```

## Existing major features

- Bundled low-detail global Earth reference for offline orientation.
- Optional detailed project-specific image basemap packs.
- GPS stations, live tracks, on-map transect builder, media capture, samples, custody events, and map review.
- Global iNaturalist taxon search with project-local offline caching.
- Versioned regional taxon packs and fast species observation entry.
- In-app QA/QC, GeoJSON/QGIS export, mission archive ZIP, and one-page field debrief report.

## Install / host on GitHub Pages

Upload the **contents** of this folder—not the ZIP file and not the enclosing `EcoSurvey_Field_App_v0_12` folder—to the repository root. The root must contain:

```text
index.html
manifest.webmanifest
sw.js
.nojekyll
assets/
icons/
src/
examples/
tests/
README.md
CHANGELOG.md
TEST_RESULTS.md
DATA_SOURCES.md
package.json
```

The new source files required for v0.14 are:

```text
src/protocols.js
src/rov.js
src/sensor_streams.js
```

In **Repository → Settings → Pages**, choose:

```text
Source: Deploy from a branch
Branch: main
Folder: /(root)
```

Open the published HTTPS site online once after deployment so the v0.14 service worker can cache the application shell. If a phone shows an earlier version, close the installed app, reload the GitHub Pages site in Safari or Chrome, then reopen or reinstall from the browser menu.

## Run locally for desktop testing

```bat
py -3 -m http.server 8080
```

or:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. GPS, camera, service-worker, iNaturalist, and install testing require HTTPS on a phone.

## Automated tests

With Node.js installed:

```bash
npm test
```

v0.14 runs all earlier regression tests plus protocol, ROV video-log, and sensor-stream tests. The sensor test checks column mapping, timestamp parsing, launch-anchor synchronization, stream/reading links, QA/QC findings, map placement, and QGIS-ready GeoJSON output.

## Field limitations

- Protocol templates are operational guidance, not a substitute for a written sampling SOP, QA plan, permit, safety plan, or laboratory LIMS.
- eDNA, specimen, and regulatory sampling should use approved labels, preservation procedures, chain-of-custody documentation, and contamination-control practices.
- The Mission QA/QC ZIP remains the authoritative EcoSurvey field archive. Retain original raw media, sensor files, laboratory forms, permits, and debrief PDF separately.
