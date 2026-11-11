import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { readStudentPosition, resumableStudentPath, saveStudentPosition } from '../utils/studentPosition'

export default function StudentPosition() {
  const location = useLocation()
  const token = localStorage.getItem('token')
  const userId = localStorage.getItem('userId')

  useEffect(() => {
    const path = resumableStudentPath(location.pathname + location.search)
    if (!token || !userId || !path) return undefined
    const saved = readStudentPosition(localStorage, userId, path)
    let restoring = true, stopped = false, frame = 0, saveTimer = 0, readyFrames = 0
    const previousRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const sameAccount = () => localStorage.getItem('token') === token && localStorage.getItem('userId') === userId
    const effectivePath = () => {
      const declared = resumableStudentPath(document.querySelector('[data-session-path]')?.getAttribute('data-session-path'))
      return declared?.split('?')[0] === location.pathname ? declared : path
    }
    const pane = () => document.querySelector('[data-session-scroll="assessment"]')
    const busy = () => document.querySelector('[aria-busy="true"], .layout-skeleton')
    const save = () => {
      if (!sameAccount() || restoring || busy()) return
      saveStudentPosition(localStorage, userId, effectivePath(), { x: window.scrollX, y: window.scrollY, assessmentY: pane()?.scrollTop || 0 })
    }
    const finish = () => {
      restoring = false
      observer.disconnect()
      resize.disconnect()
      save()
    }
    const restore = () => {
      frame = 0
      if (stopped || !sameAccount() || !restoring) return
      if (busy()) { readyFrames = 0; return }
      // Wait for loaded content and the selected dashboard tab to reach layout.
      if (++readyFrames < 3) { frame = requestAnimationFrame(restore); return }
      const target = readStudentPosition(localStorage, userId, effectivePath()) || saved || { x: 0, y: 0, assessmentY: 0 }
      window.scrollTo({ left: target.x, top: target.y, behavior: 'instant' })
      const assessment = pane()
      if (assessment) assessment.scrollTo({ top: target.assessmentY, behavior: 'instant' })
      if (Math.abs(window.scrollY - target.y) < 2 && (!assessment || Math.abs(assessment.scrollTop - target.assessmentY) < 2)) finish()
    }
    const schedule = () => { if (!frame && restoring) frame = requestAnimationFrame(restore) }
    const observer = new MutationObserver(schedule)
    const resize = new ResizeObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-busy', 'data-session-path'] })
    resize.observe(document.body)
    const timeout = window.setTimeout(() => { if (!stopped && restoring && !busy()) finish() }, 15000)
    const onScroll = () => {
      if (restoring) return
      clearTimeout(saveTimer)
      saveTimer = window.setTimeout(save, 100)
    }
    const onIntent = event => {
      if (event.type === 'keydown' && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) return
      if (restoring && !busy()) finish()
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') save() }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('wheel', onIntent, { passive: true })
    window.addEventListener('pointerdown', onIntent, { passive: true })
    window.addEventListener('touchstart', onIntent, { passive: true })
    window.addEventListener('keydown', onIntent)
    window.addEventListener('click', save, true)
    window.addEventListener('pagehide', save)
    window.addEventListener('learnmatch:save-position', save)
    document.addEventListener('visibilitychange', onVisibility)
    schedule()
    return () => {
      stopped = true
      clearTimeout(saveTimer); clearTimeout(timeout); cancelAnimationFrame(frame)
      observer.disconnect(); resize.disconnect()
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('wheel', onIntent)
      window.removeEventListener('pointerdown', onIntent)
      window.removeEventListener('touchstart', onIntent)
      window.removeEventListener('keydown', onIntent)
      window.removeEventListener('click', save, true)
      window.removeEventListener('pagehide', save)
      window.removeEventListener('learnmatch:save-position', save)
      document.removeEventListener('visibilitychange', onVisibility)
      history.scrollRestoration = previousRestoration
    }
  }, [location.key, location.pathname, location.search, token, userId])
  return null
}
