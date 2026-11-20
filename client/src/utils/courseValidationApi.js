const api = import.meta.env.VITE_API_URL || ''

export const validationLabels = {
  pending: 'Pending Validation',
  under_review: 'Under Review',
  needs_changes: 'Needs Changes',
  validated: 'Validated',
  approved: 'Validated',
  superseded: 'Earlier version',
}

export const accountLabels = {
  unverified: 'Awaiting Email Verification',
  pending: 'Pending Approval',
  correction: 'Correction Requested',
  rejected: 'Rejected',
  approved: 'Approved',
  deactivated: 'Deactivated',
}

async function request(path, { token, body, signal } = {}) {
  return fetch(`${api}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal,
  })
}

export async function workflowApi(path, options) {
  const response = await request(path, options)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw Object.assign(new Error(data?.message || 'Could not complete this request.'), { status: response.status, details: data })
  if (!data || typeof data !== 'object') throw new Error('The server returned an invalid response.')
  return data
}

export async function downloadReviewImage(path, token, name) {
  const response = await request(path, { token })
  if (!response.ok) throw new Error('This private image is unavailable.')
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = `${name}.png`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function reviewFile(file) {
  if (!file || file.size > 1048576 || (file.type && file.type !== 'image/png')) throw new Error('Select a PNG image up to 1 MB.')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Could not read this image.'))
    reader.readAsDataURL(file)
  })
}

export const reviewDate = value => value ? new Date(value).toLocaleString() : ''
