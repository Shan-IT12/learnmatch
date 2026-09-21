import { useEffect, useMemo, useRef } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'

const isValidCoordinate = (school) => Number.isFinite(school.latitude)
  && school.latitude >= -90
  && school.latitude <= 90
  && Number.isFinite(school.longitude)
  && school.longitude >= -180
  && school.longitude <= 180

function MapController({ schools, selectedSchoolId, markerRefs }) {
  const map = useMap()

  useEffect(() => {
    const bounds = schools.map((school) => [school.latitude, school.longitude])
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 })
  }, [map, schools])

  useEffect(() => {
    if (selectedSchoolId == null) return
    const selectedSchool = schools.find((school) => school.school_id === selectedSchoolId)
    if (!selectedSchool) return

    map.flyTo([selectedSchool.latitude, selectedSchool.longitude], Math.max(map.getZoom(), 15), {
      duration: 0.6,
    })
    markerRefs.current.get(selectedSchoolId)?.openPopup()
  }, [map, markerRefs, schools, selectedSchoolId])

  return null
}

function SchoolLocatorMap({ schools, selectedSchoolId = null }) {
  const markerRefs = useRef(new Map())
  const plottedSchools = useMemo(() => schools.filter(isValidCoordinate), [schools])

  if (plottedSchools.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50/70 px-5 py-4 text-sm text-amber-900">
        Map locations are not yet available for these schools. Their reviewed addresses are listed below.
      </div>
    )
  }

  return (
    <section className="mt-7" aria-labelledby="school-map-heading">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">School map</p>
        <h2 id="school-map-heading" className="text-xl sm:text-2xl font-bold mt-1">Reviewed school locations</h2>
        <p className="text-sm text-gray-500 mt-1">Only schools with reviewed coordinates appear on the map. All matching schools remain listed below.</p>
      </div>
      <div className="school-locator-map overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm">
        <MapContainer center={[14.82, 121.06]} zoom={13} scrollWheelZoom className="h-full w-full">
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapController
            schools={plottedSchools}
            selectedSchoolId={selectedSchoolId}
            markerRefs={markerRefs}
          />
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
