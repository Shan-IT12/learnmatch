function escapeCsvCell(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`
  }
  return str
}

export function buildCsvContent(rows) {
  return '\uFEFF' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
}

export function downloadCsv(filename, rows) {
  const csv = buildCsvContent(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
