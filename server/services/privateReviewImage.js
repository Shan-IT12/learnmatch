import { inflateSync } from 'node:zlib'
import { WorkflowError } from './workflowSupport.js'

export const MAX_REVIEW_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_PIXELS = 25000000
const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const jpegMagic = Buffer.from([0xff, 0xd8, 0xff])
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

function validatePng(file, fail) {
  const retained = [pngMagic]
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
      if (!width || !height || width * height > MAX_IMAGE_PIXELS || !depths?.includes(depth) || data[10] || data[11] || data[12]) fail()
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

function validateJpeg(file, fail) {
  if (file.length < 4 || file[file.length - 2] !== 0xff || file[file.length - 1] !== 0xd9) fail()
  let offset = 2
  let sawSof = false
  let sawSos = false
  while (offset < file.length) {
    if (file[offset] !== 0xff) fail()
    while (offset < file.length && file[offset] === 0xff) offset++
    if (offset >= file.length) fail()
    const marker = file[offset++]
    if (marker === 0xd9) {
      if (offset !== file.length || !sawSof || !sawSos) fail()
      return file
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > file.length) fail()
    const length = file.readUInt16BE(offset)
    if (length < 2 || offset + length > file.length) fail()
    const isSof = (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf)
    if (isSof) {
      if (length < 8) fail()
      const height = file.readUInt16BE(offset + 3)
      const width = file.readUInt16BE(offset + 5)
      if (!width || !height || width * height > MAX_IMAGE_PIXELS) fail()
      sawSof = true
    }
    offset += length
    if (marker === 0xda) {
      sawSos = true
      // Scan entropy-coded data until next non-stuffed, non-restart marker.
      while (offset < file.length - 1) {
        if (file[offset] === 0xff) {
          const next = file[offset + 1]
          if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
            offset += 2
            continue
          }
          if (next === 0xff) {
            offset += 1
            continue
          }
          break
        }
        offset += 1
      }
    }
  }
  fail()
}

export function reviewImage(value) {
  const fail = () => { throw new WorkflowError('Upload a valid PNG or JPG image up to 10 MB and try again.') }
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_REVIEW_IMAGE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) fail()
  const file = Buffer.from(value, 'base64')
  if (!file.length || file.length > MAX_REVIEW_IMAGE_BYTES) fail()
  if (file.length >= 8 && file.subarray(0, 8).equals(pngMagic)) return validatePng(file, fail)
  if (file.length >= 3 && file.subarray(0, 3).equals(jpegMagic)) return validateJpeg(file, fail)
  fail()
}

export function sendPrivateImage(res, contents, name) {
  const isJpeg = Buffer.isBuffer(contents) && contents.length >= 3 && contents.subarray(0, 3).equals(jpegMagic)
  const contentType = isJpeg ? 'image/jpeg' : 'image/png'
  const ext = isJpeg ? 'jpg' : 'png'
  res.set({ 'Content-Type': contentType, 'Content-Disposition': `attachment; filename="${name}.${ext}"`,
    'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; sandbox" })
  res.send(contents)
}
