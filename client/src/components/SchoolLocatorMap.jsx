import { useEffect, useMemo, useRef } from 'react'
import { geoJSON } from 'leaflet'
import { CircleMarker, GeoJSON, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import sjdmBoundary from '../data/sjdmBoundaryGeoJson'
import { hasValidCoordinates } from '../utils/schoolDirections'

const routeLatLngs = (route) => route?.geometry?.type === 'LineString'
  ? route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude])
  : []

function MapController({ schools, selectedSchoolId, markerRefs, route, coverageResetKey }) {
  const map = useMap()
  const routePoints = useMemo(() => routeLatLngs(route), [route])

  useEffect(() => {
    map.fitBounds(geoJSON(sjdmBoundary).getBounds(), { padding: [32, 32], maxZoom: 13 })
  }, [coverageResetKey, map])

  useEffect(() => {
    if (routePoints.length > 1) {
      map.fitBounds(routePoints, { padding: [42, 42], maxZoom: 15 })
    }
  }, [map, routePoints])

  useEffect(() => {
    if (selectedSchoolId == null || routePoints.length > 1) return
    const selectedSchool = schools.find((school) => school.school_id === selectedSchoolId)
    if (!selectedSchool) return

    map.flyTo([selectedSchool.latitude, selectedSchool.longitude], Math.max(map.getZoom(), 15), {
      duration: 0.6,
    })
    markerRefs.current.get(selectedSchoolId)?.openPopup()
  }, [map, markerRefs, routePoints.length, schools, selectedSchoolId])

  return null
}

function SchoolLocatorMap({
  schools,
  selectedSchoolId = null,
  route = null,
  userLocation = null,
  coverageResetKey = 0,
  onRecenterCoverage,
}) {
  const markerRefs = useRef(new Map())
  const plottedSchools = useMemo(() => schools.filter(hasValidCoordinates), [schools])
  const plottedRoute = useMemo(() => routeLatLngs(route), [route])

  return (
    <section className="mt-7" aria-labelledby="school-map-heading">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">School map</p>
          <h2 id="school-map-heading" className="text-xl sm:text-2xl font-bold mt-1">Reviewed school locations</h2>
          <p className="text-sm text-gray-500 mt-1">The outlined area shows LearnMatch school coverage. Routes may begin outside the city.</p>
        </div>
        <button type="button" onClick={onRecenterCoverage} className="self-start rounded-xl border border-orange-200 bg-white px-4 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-50 transition sm:self-auto">
          Recenter SJDM coverage
        </button>
      </div>
      {plottedSchools.length === 0 && (
        <div className="mb-4 rounded-2xl border border-orange-100 bg-orange-50/70 px-5 py-4 text-sm text-amber-900">
          Map locations are not yet available for these schools. The SJDM coverage area remains shown below, and reviewed addresses remain listed.
        </div>
      )}
      <div className="school-locator-map relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm">
        <div className="pointer-events-none absolute bottom-4 left-3 z-[500] max-w-[calc(100%_-_1.5rem)] rounded-xl border border-orange-200 bg-white/95 px-3 py-2 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-orange-600">LearnMatch School Coverage</p>
          <p className="text-xs font-semibold text-gray-800">San Jose del Monte City</p>
        </div>
        <MapContainer center={[14.82, 121.06]} zoom={13} scrollWheelZoom className="h-full w-full">
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <GeoJSON
            data={sjdmBoundary}
            style={{
              color: '#ea580c',
              fillColor: '#fb923c',
              fillOpacity: 0.08,
              weight: 2.5,
              dashArray: '7 5',
            }}
          />
          <MapController
            schools={plottedSchools}
            selectedSchoolId={selectedSchoolId}
            markerRefs={markerRefs}
            route={route}
            coverageResetKey={coverageResetKey}
          />
          {plottedRoute.length > 1 && (
            <Polyline positions={plottedRoute} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.85 }} />
          )}
          {hasValidCoordinates(userLocation) && plottedRoute.length > 1 && (
            <CircleMarker
              center={[userLocation.latitude, userLocation.longitude]}
              radius={8}
              pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.95, weight: 3 }}
            >
              <Popup><strong>Your current location</strong></Popup>
            </CircleMarker>
          )}
          {plottedSchools.map((school) => (
            <CircleMarker
              key={school.school_id}
              center={[school.latitude, school.longitude]}
              radius={selectedSchoolId === school.school_id ? 11 : 8}
              pathOptions={{
                color: '#c2410c',
                fillColor: '#f97316',
                fillOpacity: 0.88,
                weight: selectedSchoolId === school.school_id ? 4 : 3,
              }}
              ref={(marker) => {
                if (marker) markerRefs.current.set(school.school_id, marker)
                else markerRefs.current.delete(school.school_id)
              }}
            >
              <Popup>
                <strong>{school.school_name}</strong>
                {school.address && <><br />{school.address}</>}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </section>
  )
}

export default SchoolLocatorMap
