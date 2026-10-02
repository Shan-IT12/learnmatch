# San Jose del Monte coverage boundary

The local feature in `sjdmBoundaryGeoJson.js` is the unmodified medium-resolution
municipal geometry for **City of San Jose Del Monte** from
[`faeldon/philippines-json-maps`](https://github.com/faeldon/philippines-json-maps/blob/master/2023/geojson/provdists/medres/municities-provdist-301400000.0.01.json).

That repository converts the PSA/NAMRIA Philippine administrative-boundary
shapefiles dated 2023-11-06 to GeoJSON. Its feature has correspondence code
`031420000`; the Philippine Statistics Authority's current PSGC page identifies
City of San Jose Del Monte as 10-digit code `0301420000` and correspondence code
`031420000`.

The geometry is stored locally so School Locator coverage does not depend on a
runtime boundary service. It is a coverage visualization, not a resolution of
survey or boundary disputes.
