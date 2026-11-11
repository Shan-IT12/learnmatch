import { useCallback, useRef, useState } from 'react'
import { getAssessmentAttemptId, readAssessmentSession, saveActiveAttemptDraft, writeAssessmentSession } from '../utils/assessmentSession'

// UI around the existing serialized save queue. Drafts still use the existing
// session record and authenticated assessment-attempt endpoint.
export default function useAssessmentDraftSave(storage, sessionKey) {
  const token = localStorage.getItem('token')
  const latest = useRef(null)
  const pending = useRef(null)
  const revision = useRef(0)
  const lastSave = useRef(null)
  const [status, setStatus] = useState('idle')
  const save = useCallback((draft) => {
    const signature = JSON.stringify([token, getAssessmentAttemptId(storage), draft])
    if (lastSave.current?.signature === signature && lastSave.current.state !== 'error') return lastSave.current.promise
    const version = ++revision.current
    const attemptId = getAssessmentAttemptId(storage)
    const pendingSaveId = crypto.randomUUID()
    latest.current = draft
    writeAssessmentSession(storage, sessionKey, { ...readAssessmentSession(storage, sessionKey, {}), pending: true, pendingSaveId })
    setStatus('saving')
    const promise = saveActiveAttemptDraft(import.meta.env.VITE_API_URL, token, storage, draft).then(() => {
      if (lastSave.current?.signature === signature) lastSave.current.state = 'saved'
      if (version === revision.current && getAssessmentAttemptId(storage) === attemptId && localStorage.getItem('token') === token) {
        const local = readAssessmentSession(storage, sessionKey, {})
        if (local.pendingSaveId === pendingSaveId) writeAssessmentSession(storage, sessionKey, { ...local, pending: false })
        setStatus('saved')
      }
    }).catch(error => {
      if (lastSave.current?.signature === signature) lastSave.current.state = 'error'
      if (version === revision.current) setStatus('error')
      throw error
    })
    pending.current = promise
    lastSave.current = { signature, state: 'saving', promise }
    // Changes autosave immediately. This handler also marks rejection as handled
    // while flush/retry can still await and report the original failure.
    promise.catch(() => {})
    return promise
  }, [storage, sessionKey, token])
  const flush = useCallback(async () => {
    if (lastSave.current?.state === 'error') await save(latest.current)
    else await pending.current
  }, [save])
  const retry = () => latest.current && save(latest.current)
  return { status, save, flush, retry }
}
