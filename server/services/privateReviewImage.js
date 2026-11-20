import { inflateSync } from 'node:zlib'
import { WorkflowError } from './workflowSupport.js'

export const MAX_REVIEW_IMAGE_BYTES = 1024 * 1024
const magic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0)
  return value >>> 0
})
function crc(bytes) {
  let result = 0xffffffff
  for (const byte of bytes) result = (result >>> 8) ^ crcTable[(result ^ byte) & 255]
  return (result ^ 0xffffffff) >>> 0
}

export function reviewImage(value) {
  const fail = () => { throw new WorkflowError('Upload a valid PNG image up to 1 MB. Export or scan it as a standard PNG and try again.') }
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_REVIEW_IMAGE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) fail()
  const file = Buffer.from(value, 'base64')
  if (file.length > MAX_REVIEW_IMAGE_BYTES || !file.subarray(0, 8).equals(magic)) fail()
  const retained = [magic]
  const idat = []
  let stride, height, color, depth, palette, transparency, ended = false, dataEnded = false
  for (let offset = 8; offset < file.length;) {
    if (offset + 12 > file.length) fail()
    const length = file.readUInt32BE(offset)
    const end = offset + length + 12
    if (end > file.length) fail()
    const bytes = file.subarray(offset + 4, end - 4)
    const kind = bytes.subarray(0, 4).toString('latin1')
    const data = bytes.subarray(4)
    if (!/^[A-Za-z]{4}$/.test(kind) || crc(bytes) !== file.readUInt32BE(end - 4)) fail()
    if (!stride && kind !== 'IHDR') fail()
    if (idat.length && kind !== 'IDAT') dataEnded = true
    if (kind === 'IHDR') {
      if (offset !== 8 || length !== 13) fail()
      const width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      depth = data[8]
      color = data[9]
      const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color]
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }[color]
      if (!width || !height || width * height > 4000000 || !depths?.includes(depth) || data[10] || data[11] || data[12]) fail()
      stride = Math.ceil(width * depth * channels / 8) + 1
    } else if (kind === 'PLTE') {
      if (idat.length || palette || !length || length % 3 || length > 768 || [0, 4].includes(color) || (color === 3 && length / 3 > 2 ** depth)) fail()
      palette = length / 3
    } else if (kind === 'tRNS') {
      const valid = color === 0 ? length === 2 : color === 2 ? length === 6 : color === 3 && palette && length > 0 && length <= palette
      if (transparency || idat.length || !valid) fail()
      transparency = true
    } else if (kind === 'IDAT') {
      if (dataEnded || (color === 3 && !palette)) fail()
      idat.push(data)
    } else if (kind === 'IEND') {
      if (length || end !== file.length || !idat.length) fail()
      ended = true
    } else if (kind[0] === kind[0].toUpperCase()) fail()
    if (['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND'].includes(kind)) retained.push(file.subarray(offset, end))
    offset = end
  }
  if (!ended) fail()
  const expected = stride * height
  let pixels
  try {
    const compressed = Buffer.concat(idat)
    const decoded = inflateSync(compressed, { maxOutputLength: expected, info: true })
    if (decoded.engine.bytesWritten !== compressed.length) fail()
    pixels = decoded.buffer
  } catch { fail() }
  if (pixels.length !== expected) fail()
  for (let offset = 0; offset < pixels.length; offset += stride) if (pixels[offset] > 4) fail()
  return Buffer.concat(retained)
}

export function sendPrivateImage(res, contents, name) {
  res.set({ 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="${name}.png"`,
    'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; sandbox" })
  res.send(contents)
}
