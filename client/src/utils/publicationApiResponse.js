const endpointLabel = (value) => {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch { return 'publication endpoint' }
}

export async function readPublicationJson(response, { url, method }) {
  const contentType = response.headers.get('content-type') || 'no Content-Type'
  const details = `${method} ${endpointLabel(url)}; HTTP ${response.status}${response.redirected ? `; redirected to ${endpointLabel(response.url)}` : ''}`
  if (!/^application\/(?:[\w.-]+\+)?json(?:\s*;|\s*$)/i.test(contentType)) {
    throw new Error(`Publication API returned ${contentType} instead of JSON (${details}). Check the API URL and whether the backend is running the current routes.`)
  }
  try { return await response.json() } catch {
    throw new Error(`Publication API returned invalid JSON (${details}). Reload and check the backend response.`)
  }
}
