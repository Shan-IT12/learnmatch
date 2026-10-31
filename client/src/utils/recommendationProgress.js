// The server completes the first four steps. Loading the results overview is
// the fifth step. This measures completed work, not estimated time remaining.
export async function readRecommendationResponse(response, onProgress) {
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    return { status: response.status, data: await response.json().catch(() => ({})) }
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result
  const consume = frame => {
    const lines = frame.split('\n')
    const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim()
    const raw = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    if (!raw) return
    const data = JSON.parse(raw)
    if (event === 'progress' && Number.isInteger(data.completed) && data.completed >= 0 && data.completed <= 4) onProgress(data)
    if (event === 'result') result = { status: 200, data }
    if (event === 'error') result = { status: data.status || 500, data }
  }
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let end
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        consume(buffer.slice(0, end))
        buffer = buffer.slice(end + 2)
      }
      if (done) break
    }
    if (buffer.trim()) consume(buffer)
    if (!result) throw new Error('The recommendations connection ended before results were ready.')
    return result
  } finally {
    reader.releaseLock()
  }
}
