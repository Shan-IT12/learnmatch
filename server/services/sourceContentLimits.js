const MiB = 1024 * 1024
export const HTML_MAX_BYTES = 2 * MiB
export const DEFAULT_PDF_MAX_BYTES = 6 * MiB
export const PDF_HARD_MAX_BYTES = 16 * MiB

// Shared by the downloader and parser. Read at request time, after dotenv loads.
export function sourceContentLimits(env = process.env) {
  const raw = env.SOURCE_PDF_MAX_BYTES
  const pdfBytes = raw === undefined ? DEFAULT_PDF_MAX_BYTES : Number(raw)
  if ((raw !== undefined && !/^\d+$/.test(raw)) || !Number.isSafeInteger(pdfBytes) || pdfBytes < 1 || pdfBytes > PDF_HARD_MAX_BYTES) {
    throw new Error('SOURCE_PDF_MAX_BYTES must be a positive integer no greater than 16777216.')
  }
  return { bytes: HTML_MAX_BYTES, pdfBytes }
}

export function sourceByteLimit(type, limits = sourceContentLimits()) {
  return type === 'application/pdf' ? (limits.pdfBytes ?? limits.bytes) : limits.bytes
}
