import { validateCourseSource } from './courseSourceFields.js'

export const EMPTY_SOURCE_HOSTS = 'Approved source hosts are not configured. Ask an administrator to configure SOURCE_APPROVED_PUBLISHER_HOSTS.'
export function parseApprovedSourceHosts(raw = '') {
  const hosts = [...new Set(raw.split(',').map(host => host.trim().toLowerCase()).filter(Boolean))]
  if (hosts.length > 100 || hosts.some(host => host.length > 253 || !/^[a-z0-9.-]+$/.test(host) || !/^[a-z][a-z0-9-]*$/.test(host.split('.').at(-1)) || host.split('.').length < 2 || host.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))) {
    throw new Error('SOURCE_APPROVED_PUBLISHER_HOSTS must contain exact hostnames, without URLs, wildcards or ports.')
  }
  return hosts
}
export function sourceUrlError(value, policy) {
  const text = String(value || '').trim()
  if (!text) return '' // Optional unused slots are ignored; source metadata validation handles required URLs.
  if (policy?.error) return policy.error
  if (!Array.isArray(policy?.hosts)) return 'Approved source-host configuration could not be loaded. Reload the form.'
  if (!policy.hosts.length) return EMPTY_SOURCE_HOSTS
  try {
    if (text.length > 2048 || !/^https?:\/\//i.test(text) || /[\u0000-\u0020\u007f\\]/u.test(text)) throw new Error()
    const url = new URL(text)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || text.split('/')[2]?.includes('@') || url.port) throw new Error()
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
    if (!policy.hosts.includes(hostname)) return 'Use a source URL from an explicitly approved official publisher host. This host is not approved.'
    return ''
  } catch { return 'Enter a full approved HTTP or HTTPS URL without credentials, spaces or a nonstandard port.' }
}
export function validateApprovedCourseSource(input, policy) {
  const validation = validateCourseSource(input)
  const error = sourceUrlError(input?.url, policy)
  if (error) validation.errors.url = error
  return validation
}
export const hasInvalidSourceUrls = (sources, policy) => sources.some(source => source.url?.trim() && Boolean(sourceUrlError(source.url, policy)))
