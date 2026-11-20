import { useEffect, useRef, useState } from 'react'
import { workflowApi } from '../utils/courseValidationApi'

export function useWorkflowData(path, token, { interval = 5000, read = workflowApi } = {}) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    let timer
    let reading = false
    const sameRequest = previous => previous?.path === path && previous.token === token
    const visible = () => document.visibilityState === 'visible'
    const load = async () => {
      if (reading || controller.signal.aborted) return
      clearTimeout(timer)
      reading = true
      try {
        const data = await read(path, {
          token, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        })
        if (controller.signal.aborted) return
        const fingerprint = JSON.stringify(data)
        setResult(previous => sameRequest(previous) && previous.fingerprint === fingerprint && !previous.error
          ? previous : { path, token, data, fingerprint })
      } catch (error) {
        if (controller.signal.aborted) return
        const unavailable = [401, 403, 404].includes(error.status)
        setResult(previous => ({
          path, token, error, data: !unavailable && sameRequest(previous) ? previous.data : undefined,
        }))
      } finally {
        reading = false
        if (interval && visible() && !controller.signal.aborted) timer = setTimeout(load, interval)
      }
    }
    const resume = () => {
      if (visible()) load()
      else clearTimeout(timer)
    }
    load()
    if (interval) {
      document.addEventListener('visibilitychange', resume)
      window.addEventListener('focus', resume)
    }
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('focus', resume)
    }
  }, [path, token, revision, interval, read])
  const current = path && result?.path === path && result.token === token ? result : {}
  return { data: current.data, error: current.error, loading: Boolean(path && !current.data && !current.error), refresh: () => setRevision(value => value + 1) }
}

export function useWorkflowAction() {
  const pending = useRef(false)
  const [status, setStatus] = useState({})
  const run = async (action) => {
    if (pending.current) return
    pending.current = true
    setStatus({ busy: true })
    try {
      const result = await action()
      setStatus({ message: result?.message })
      return result
    } catch (error) {
      setStatus({ error: error.message })
    } finally {
      pending.current = false
    }
  }
  return { ...status, run }
}
