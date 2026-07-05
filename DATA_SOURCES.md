# EcoSurvey data-source and taxonomy notes

## Built-in world reference

The bundled low-detail world reference is derived from Natural Earth 1:110m country/land reference data. It is included only for offline orientation. It is not a chart, satellite image, navigation product, boundary authority, or habitat dataset.

## iNaturalist lookup

EcoSurvey's global taxon search uses the live iNaturalist taxonomy endpoint only when a device has connectivity. Individual saved taxa are converted into a project-local offline cache. The app does not bulk-download or redistribute the full iNaturalist taxonomy.

An iNaturalist taxon search is a useful lookup aid, but it does not itself establish that a taxon belongs in a study-area checklist. Field identification, protocol restrictions, and regional authority still apply.

## Regional taxon packs (v0.10)

A regional pack is a user-controlled, versioned controlled list. The app preserves the pack's stated metadata but does not independently verify accuracy, completeness, licensing, review status, source authority, or geographic claims.

For an authoritative pack, record:

- pack ID and semantic version;
- geographic and habitat scope;
- taxonomic scope and exclusions;
- authority/dataset name, URL, source version, and retrieval date;
- license or reuse terms;
- curator/reviewer and review status;
- publication date and notes on taxonomic decisions.

The bundled **Mid-Atlantic Estuary Starter Pack** is demonstration content for app testing. It is explicitly draft and non-authoritative.

## Survey record principle

The app stores controlled-list and pack provenance on the observation at the time of entry. This protects interpretation of a historical field record if a taxon list changes later. Retain exported Mission QA/QC ZIPs, raw media, sensor outputs, and the source taxon-pack JSON as part of the project archive.

## Instrument sensor streams and profile review (v0.14–v0.15)

Sensor-stream data are supplied by the user’s own instrument, logger, ROV, CTD, or other acquisition system. EcoSurvey does not alter the raw source CSV; it creates a structured, mapped local copy for field review and export.

Retain with each mission archive:

- the original instrument CSV or vendor-native log;
- logger/instrument serial or asset ID;
- calibration and maintenance information;
- timestamp timezone and clock-synchronization notes;
- any vendor processing settings, corrections, and units;
- the EcoSurvey export that records the column mapping, source filename, and imported-row count.

Imported values are not automatically unit-converted or scientifically calibrated by the app. Confirm instrument units, sensor specifications, correction procedures, and data-quality criteria in the project SOP before analysis.

### Sensor-profile interpretation (v0.15)

Sensor-profile plots, nearest-reading video-event joins, and CSV exports are derived only from the sensor readings already imported into the mission. This release introduces no new external ecological, taxonomic, or basemap data source. The logger file and the source instrument remain the authoritative measurement source; EcoSurvey records the selected time basis and the video-match tolerance for reproducibility.
