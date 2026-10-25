# School Locator local audit - 26 October 2026

The locator now reads a versioned verified-offering snapshot instead of trusting all legacy SCHOOL_COURSE rows. Only active schools already in SCHOOL can appear. Implementation and QA made no database writes, migrations, production requests or deployments. The user subsequently authorized the final commit and push after checking. The old CSV and review manifest are historical evidence, not proof of current availability.

## Evidence

- [CHED RO III program registry](https://region3.ched.gov.ph/resources/program-registry); public `/api/rop-programs` response retrieved 26 October 2026. Exact institution name, Bulacan province and SJDM municipality were checked for all 13 schools. Program registration does not guarantee current admissions. Original registry titles, statuses and record IDs are preserved in `schoolLocatorVerifiedOfferings.json`.
- [CHED GeoMap](https://region3.ched.gov.ph/resources/geomap); public institution data in the website bundle `index-3vdeeQR0.js`, retrieved 26 October 2026. Coordinates with high/medium confidence retained. Bestlink now uses independently cross-checked map evidence instead of the low-confidence CHED candidate. Campus points are not independently surveyed entrances.
- [STI SJDM](https://www.sti.edu/campuses/sanjosedelmonte) confirms Computer Science, IT, Computer Engineering, Tourism and Communication. BA Psychology is marked under application and excluded. The official map link resolves to 14.7788219, 121.0744668; this point replaces the generic CHED point.
- [FCPC programs](https://fcpc.edu.ph/programs/) explicitly confirms the Secondary Education Science major, which supplements the registry. Its IT specializations are not separate Cybersecurity degrees.
- [College of Saint Anthony](https://collegeofsaintanthony.com/) explicitly lists Early Childhood Education, supplementing the registry.
- [BulSU Sarmiento](https://bulsu.edu.ph/academics/campus/Sarmiento) identifies University Heights, Kaypian. CHED GeoMap uses UII 03012; this is manually reconciled to repository UII 03012b. The campus-specific CHED point replaces the previously conflicting government point.

## All 13 schools

Codes below are independent canonical courses, not numbers of majors. "Added" and "excluded" compare with the old review manifest, not a production database dump. Shared course and recommendation data are untouched.

| School / UII | Verified codes | Added versus historical review | Excluded versus historical review | Destination |
|---|---:|---|---|---|
| Academia de San Lorenzo Dema-Ala, Inc. / 03196 | 10 | CRS016, CRS114, CRS182, CRS344, CRS345 | CRS002, CRS102 | 14.83274, 121.07625 |
| Bestlink College of the Philippines, Inc. / 03279 | 8 | None | None | 14.84686, 121.08018 |
| Bulacan State University-Sarmiento Campus / 03012b | 11 | CRS061, CRS102, CRS182, CRS344, CRS360 | CRS141 | 14.8137008, 121.0573739 |
| City College of San Jose Del Monte / 03310 | 13 | None | ? | 14.8465071, 121.0781476 |
| Colegio De San Gabriel Arcangel, Inc. / 03180 | 27 | CRS016, CRS095, CRS102, CRS343 | CRS028, CRS076, CRS098 | 14.8477, 121.0487 |
| College of Saint Anthony SJDM Bulacan, Inc. / 03303 | 5 | CRS023, CRS343 | CRS185 | 14.7964089, 121.0728251 |
| First City Providential College, Inc. / 03194 | 25 | CRS112, CRS343, CRS344, CRS345, CRS360 | CRS086, CRS141 | 14.8102634, 121.0615462 |
| La Concepcion College / 03179 | 14 | CRS016, CRS343, CRS344 | None | 14.8129, 121.07172 |
| Siena College of San Jose, Inc. / 03135 | 7 | CRS016, CRS344 | None | 14.8038, 121.0725 |
| SJDM Cornerstone College, Inc. / 03261 | 1 | None | ? | 14.8002447, 121.0385916 |
| STI College San Jose del Monte / 13228 | 6 | CRS345 | CRS095, CRS114 | 14.7788219, 121.0744668 |
| Sto. Rosario Sapang Palay College / 03003 | 7 | CRS016 | CRS062 | 14.86295, 121.0649 |
| Village Montessori School and Colleges, Inc. / 03306 | 4 | CRS111 | None | 14.8108, 121.0646 |

## Mapping decisions

- Accountancy maps only to CRS343; never the combined Applied Economics/Accountancy degree.
- Former Accounting Technology titles now registered as Accounting Information Systems map to CRS114; CRS002 is excluded.
- Academia BS Psychology is phased out and excluded. Siena spelling is corrected in locator presentation.
- Generic business administration or teacher education titles do not establish a specific major. Only explicitly named majors with equivalent existing courses are mapped. English minor in Mandarin is not treated as plain English; Physical Science is not silently converted to Science.
- General Industrial Technology is mapped to the general independent catalog course; specific major equivalences are deferred rather than guessed.
- Associate, diploma and graduate programs without equivalent independent catalog entries are retained in the audit snapshot with a reason and no locator mapping. No courses were created and no scoring or rankings changed.
- All 13 schools retain at least one verified offering. A course without a verified SJDM match displays an explicit empty state.

## Geographic limitations

Bestlink now has a retained campus point at 14.84686, 121.08018: the [official school guide](https://guide.bcp.edu.ph/) identifies IPO Road, Minuyan Proper; [OpenStreetMap via Mapcarta](https://mapcarta.com/W1544355825) identifies the SJDM college feature, and [WorldPlaces](https://philippines.worldplaces.me/college-and-university-in-san-jose-del-monte/37889166-bestlink-college-of-the-philippines-bulacan-inc.html) corroborates the campus location at 14.84692, 121.08038 (about 23 metres away). These are mapped campus points, not surveyed gates. All 13 schools now have a route destination; no other missing coordinates were found. La Concepcion directions explicitly identify the Kaypian main campus; program-to-campus assignment must be confirmed with the school. All other pins use campus-specific cited points. They do not promise the correct gate or building for a particular program. CDSGA address now follows the CHED Fatima I record rather than the conflicting historical Villa Belissa address.

## Directions and tracking

One-time directions request fresh GPS after consent, cancel stale requests and show ORS route geometry and distance. Travel duration is returned by the service but is hidden from the student interface at the user's request. Track Route requires a separate explicit confirmation, retains only the latest fix in React memory, updates the marker, reports accuracy and possible deviation (>100 m and outside reported accuracy), and allows manual recalculation. No turn-by-turn instructions, live traffic, automatic rerouting or continuous location history is claimed or stored. Watches stop on stop, school/map selection, recalculation, course change, hidden document, pagehide and unmount.

## Local QA

Commands and final results are recorded below after execution. Application requests and GPS are mocked for browser tests; no production DB or API was contacted. Public research downloads were read-only. Live ORS credentials/service availability, real-world GPS accuracy and campus entrances remain untested.

Initial results (26 October 2026, before the Bestlink destination follow-up):

- 46/46 targeted Node tests passed: school evidence for all 13 institutions and 138 unique school/course pairs, canonical identities, phased-out/pending offerings, missing coordinates, ORS normalization/failure behavior, simulated GPS/watch disposal, and existing locator back-navigation/ownership behavior.
- 18/18 Playwright tests passed in 51.0 seconds across desktop (1280 x 900) and mobile (390 x 844). Includes all 13 school cards and 12 supported route destinations per viewport, permission denial, GPS timeout, malformed route/service failures, low accuracy, permission revocation, explicit tracking consent, route deviation, recalculation, stop, course change, pagehide, hidden-page cleanup, ignored late callbacks and cancelled route requests.
- Focused ESLint passed for the locator page, directions hook, directions/tracking utilities and map.
- Client build passed. Existing Vite configuration and large-bundle warnings remain.
- Desktop/mobile screenshots were inspected. External tile requests were deliberately blocked, so screenshots show the coverage boundary, simulated route and markers over a blank tile background.
- The expanded suite found and verified a fix for Leaflet zoom callbacks firing after map removal during course navigation.

Reproduce from the repository root:

```powershell
node --test server/tests/schoolLocatorService.test.js server/tests/directionsService.test.js client/src/utils/schoolDirections.test.js client/src/utils/routeTracking.test.js client/src/utils/schoolLocatorNavigation.test.js client/src/utils/schoolOwnership.test.js
```

From `client`:

```powershell
npx.cmd playwright test --config playwright.locator.config.js --reporter=line
npx.cmd eslint src/pages/SchoolLocator.jsx src/hooks/useSchoolDirections.js src/utils/schoolDirections.js src/utils/routeTracking.js src/components/SchoolLocatorMap.jsx
npm.cmd run build
```

No real device/GPS trip, live ORS call, real database integration test or campus entrance survey was performed. The browser tests use local synthetic API responses; the service tests use an injected database fixture. No College Alignment Tracking implementation, assessment scoring or recommendation ranking file was modified.

## Bestlink destination follow-up

The prior missing-coordinate decision is superseded by independent campus-map evidence recorded in `schoolLocatorVerifiedOfferings.json`. The Bestlink map marker and Get Directions action now use 14.84686, 121.08018 through the same ORS flow as other schools. The old CHED low-confidence warning is removed. All 13 schools were checked; no additional missing destinations remain. No course mappings, ranking/scoring logic, College Alignment Tracking implementation or remote database were changed in this follow-up.

Follow-up QA: 47/47 targeted unit/service checks passed; 20/20 desktop/mobile browser tests passed in 52.1 seconds using simulated GPS and local API fixtures. Every one of the 13 schools now exercises Get Directions with its reviewed destination, including Bestlink. A separate synthetic missing-coordinate case still verifies the safe unavailable state. The browser cleanup assertion now waits for route navigation and effect disposal rather than reading the watch counter before cleanup completes. No live ORS request or field GPS trip was performed.

Map tile seam follow-up: reproduced the thin grid in Chromium at 80% page zoom with local solid-color 256px tile fixtures. Added a locator-scoped 2px image overlap and normal tile blending to cover fractional-pixel gaps; tile positions, route geometry and school coordinates are unchanged. Visually checked screenshots at 80%, 100%, 125% zoom and a 390px mobile viewport. Client build passed. Fixtures and before/after screenshots are under `.local-backups/locator/grid-*`; no external map requests were needed for this QA.

## Final pre-commit verification

At the user's request, the completed locator changes were checked before committing and pushing: 58/58 Node unit/service and publication-integration tests passed; 24/24 desktop/mobile Playwright tests passed, including Cancel Route during tracking and a late location fix after cancellation; focused ESLint and the client build passed. Existing Vite config and bundle-size warnings remain non-blocking. `git diff --check` passed. The final change set contains only locator code, its reviewed evidence and QA files; College Alignment Tracking, assessment scoring and course recommendation rankings are unchanged. Build outputs, local research downloads and screenshots remain ignored under `dist` and `.local-backups`.
