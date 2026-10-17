import { fork } from 'node:child_process'
import { PARSER_LIMITS } from './sourceTextReading.js'
import { sourceByteLimit } from './sourceContentLimits.js'

let active = 0
export async function parseSourceContent(bytes, type, { signal, allowScannedPdf = false, allowPartialPdf = false } = {}) {
  signal?.throwIfAborted()
  if (active >= 2) throw new Error('Parser is busy. Try this source again shortly.')
  if (bytes.length > sourceByteLimit(type) || (type === 'application/pdf' && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-')))) throw new Error('Invalid or oversized content.')
  active++
  try {
    return await new Promise((resolve, reject) => {
      const child = fork(new URL('./sourceParseWorker.mjs', import.meta.url), [], { execArgv: ['--max-old-space-size=192'], serialization: 'advanced', env: { ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
      let settled = false
      const finish = (error, parsed) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); child.kill(); error ? reject(error) : resolve(parsed) }
      const abort = () => finish(Object.assign(new Error('Source checking cancelled.'), { code: 'CANCELLED' }))
      const timer = setTimeout(() => finish(Object.assign(new Error('Source parsing timed out. Review the source manually.'), { code: 'PARSER_TIMEOUT', timeout_ms: PARSER_LIMITS.milliseconds })), PARSER_LIMITS.milliseconds)
      child.once('message', (message) => finish(message.error ? Object.assign(new Error(message.error), { code: message.code || 'PARSER_ERROR' }) : null, message.parsed))
      child.once('error', () => finish(new Error('Source parser could not start.')))
      child.once('exit', () => { if (!settled) finish(new Error('Source parser stopped before completing.')) })
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) abort()
      else child.send({ bytes, type, allowScannedPdf, allowPartialPdf, byteLimit: sourceByteLimit(type) })
    })
  } finally { active-- }
}
