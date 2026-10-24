import { isIP } from 'node:net'
import ipaddr from 'ipaddr.js'

// No numeric hop count and no inferred trust from hosting-provider variables.
// Operators must list the actual controlled ingress peers/ranges. That ingress
// must overwrite XFF or append its observed client address, and block bypasses.
export function createProxyTrust(env = process.env) {
  const configured = (env.TRUSTED_PROXY_CIDRS || '').trim()
  if (!configured) return false
  const ranges = configured.split(',').map(value => {
    const entry = value.trim()
    const [address, prefix] = entry.split('/')
    if (!isIP(address) || entry.split('/').length > 2 || (prefix !== undefined && !/^\d+$/.test(prefix))) {
      throw new Error('TRUSTED_PROXY_CIDRS must contain explicit proxy IP addresses or CIDRs')
    }
    const range = prefix === undefined ? [ipaddr.parse(address), isIP(address) === 4 ? 32 : 128] : ipaddr.parseCIDR(entry)
    if (range[1] === 0 || (range[0].kind() === 'ipv6' && range[0].isIPv4MappedAddress())) {
      throw new Error('TRUSTED_PROXY_CIDRS cannot trust every address or use mapped IPv6 ranges')
    }
    return range
  })
  return address => {
    if (!isIP(address)) return false
    const peer = ipaddr.process(address)
    return ranges.some(([network, prefix]) => peer.kind() === network.kind() && peer.match(network, prefix))
  }
}

export function normalizeClientIp(address) {
  return typeof address === 'string' && isIP(address) ? ipaddr.process(address).toString() : null
}
