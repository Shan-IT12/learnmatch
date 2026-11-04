import { writeFile, rename, rm } from 'node:fs/promises'
import { domainToASCII } from 'node:url'

const sources = []
const lines = []
for (const { repository, branch, file } of [
  { repository: 'disposable-email-domains/disposable-email-domains', branch: 'main', file: 'disposable_email_blocklist.conf' },
  { repository: 'disposable/disposable-email-domains', branch: 'master', file: 'domains.txt' },
]) {
const response = await fetch(`https://api.github.com/repos/${repository}/commits/${branch}`, { signal: AbortSignal.timeout(30000) })
if (!response.ok) throw new Error(`Unable to resolve upstream revision: ${response.status}`)
const { sha } = await response.json()
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid upstream revision')
const source = `https://raw.githubusercontent.com/${repository}/${sha}/${file}`
const listResponse = await fetch(source, { signal: AbortSignal.timeout(30000) })
if (!listResponse.ok) throw new Error(`Unable to download domains: ${listResponse.status}`)
const downloaded = (await listResponse.text()).split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'))
if (downloaded.length < 1000) throw new Error(`Incomplete upstream list: ${repository}`)
lines.push(...downloaded)
sources.push({ source, revision: sha })
}
const domains = [...new Set(lines.map(line => {
  const domain = domainToASCII(line).toLowerCase()
  if (!domain.includes('.') || !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw new Error(`Invalid upstream domain: ${line}`)
  return domain
}))].sort()
if (domains.length < 1000 || !domains.includes('mailinator.com') || !domains.includes('10minutemail.com')) throw new Error('Incomplete upstream list')
for (const domain of ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com', 'proton.me', 'protonmail.com']) {
  if (domains.includes(domain)) throw new Error(`Review required: legitimate provider ${domain} appears in upstream list`)
}
const destination = new URL('../data/disposable-email/domains.json', import.meta.url)
const temporary = new URL('../data/disposable-email/domains.json.tmp', import.meta.url)
try {
  await writeFile(temporary, `${JSON.stringify({ sources, domains }, null, 2)}\n`)
  await rename(temporary, destination)
} finally {
  await rm(temporary, { force: true })
}
console.log(`Updated ${domains.length} disposable domains from ${sources.length} sources. Review the diff, run tests, then redeploy/restart.`)
