// Coordinate evidence lives with the reviewed locator snapshot, keyed by exact SCHOOL.uii.
import verified from './schoolLocatorVerifiedOfferings.json' with { type: 'json' }

export default Object.freeze(Object.fromEntries(verified.schools
  .filter(school => Number.isFinite(school.latitude) && Number.isFinite(school.longitude))
  .map(school => [school.uii, Object.freeze({ latitude: school.latitude, longitude: school.longitude })])))
