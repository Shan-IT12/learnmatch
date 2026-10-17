import { parseApprovedSourceHosts, sourceUrlError, validateApprovedCourseSource, EMPTY_SOURCE_HOSTS } from '../shared/sourceUrlPolicy.js'

// Exact hostnames only: subdomains require their own explicit configuration entry.
export function approvedPublisherHosts(env = process.env) {
  return new Set(parseApprovedSourceHosts(env.SOURCE_APPROVED_PUBLISHER_HOSTS || ''))
}
export function sourcePublisherConfiguration() {
  try { const hosts = [...approvedPublisherHosts()]; return { hosts, error: hosts.length ? null : EMPTY_SOURCE_HOSTS } }
  catch { return { hosts: [], error: 'Approved source-host configuration is invalid. Ask an administrator to correct SOURCE_APPROVED_PUBLISHER_HOSTS.' } }
}
export const approvedSourceUrlError = value => sourceUrlError(value, sourcePublisherConfiguration())
export const validateAdminCourseSource = input => validateApprovedCourseSource(input, sourcePublisherConfiguration())
export const checkedSourceOriginError = report => report?.error_code === 'UNAPPROVED_SOURCE_HOST'
  ? 'The checked redirect destination is not approved.'
  : report?.final_url ? approvedSourceUrlError(report.final_url) : ''

export function applyPublisherPolicy(report) {
  const hosts = approvedPublisherHosts()
  const host = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.port ? url.hostname.toLowerCase().replace(/\.$/, '') : null } catch { return null } }
  const original = host(report.original_url), final = host(report.final_url)
  const verified = !!original && !!final && hosts.has(original) && hosts.has(final)
  const reason = 'Source origin not verified.'
  const reasons = report.reasons.filter(r => r !== reason)
  if (!verified && report.fetch_status !== 'failed' && report.parse_status !== 'failed') reasons.unshift(reason)
  return { ...report, publisher_origin: { verified, original_host: original, final_host: final, policy: 'configured-exact-hosts-v1' },
    status: !verified ? 'Needs Review' : report.status, reasons }
}
