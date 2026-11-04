import { readFileSync } from 'node:fs'
import { domainToASCII } from 'node:url'

const domains = new Set(JSON.parse(readFileSync(new URL('../data/disposable-email/domains.json', import.meta.url), 'utf8')).domains)
const supplementalDomains = JSON.parse(readFileSync(new URL('../data/disposable-email/supplemental.json', import.meta.url), 'utf8'))
for (const { domain } of supplementalDomains) domains.add(domain)

export const DISPOSABLE_EMAIL_MESSAGE = 'Temporary or disposable email addresses are not supported. Please use your personal, work, or school email address.'

export function normalizeRegistrationEmail(value) {
  if (typeof value !== 'string') return null
  const email = value.trim()
  if (!/^[^\s@\x00-\x1f\x7f]+@[^\s@]+$/u.test(email)) return null
  const [local, rawDomain] = email.split('@')
  // Preserve local-part case, dots and plus tags; only canonicalize the domain.
  if (Buffer.byteLength(local) > 64 || /[<>(),;:\\"\[\]]/.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null
  if (/[/%\\?#:\[\]]/.test(rawDomain)) return null
  const domain = domainToASCII(rawDomain).toLowerCase()
  if (!domain || domain.length > 253 || !domain.includes('.') || !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null
  const normalized = `${local}@${domain}`
  return Buffer.byteLength(normalized) <= 254 ? normalized : null
}

export function isDisposableEmail(email) {
  const normalized = normalizeRegistrationEmail(email)
  if (!normalized) return false
  const labels = normalized.split('@')[1].split('.')
  // Match on label boundaries, including subdomains, never substrings or a TLD.
  for (let i = 0; i < labels.length - 1; i++) {
    if (domains.has(labels.slice(i).join('.'))) return true
  }
  return false
}
