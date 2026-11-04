import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBell, IconX } from '@tabler/icons-react'

export default function CheckinNotifications() {
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has('notifications'))
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const container = useRef(null)
  const bell = useRef(null)
  const navigate = useNavigate()
  const request = useCallback(async (path = '', options = {}) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/college/notifications${path}`, {
      ...options, headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
    })
    if (!response.ok) throw new Error('Could not update reminders. Please try again.')
    return response.json()
  }, [])
  const refresh = useCallback(async () => {
    try { setData(await request()); setError('') } catch { setError('Reminders are temporarily unavailable.') }
  }, [request])
  useEffect(() => {
    let active = true
    request().then(value => { if (active) setData(value) }).catch(() => { if (active) setError('Reminders are temporarily unavailable.') })
    window.addEventListener('focus', refresh)
    return () => { active = false; window.removeEventListener('focus', refresh) }
  }, [request, refresh])
  useEffect(() => {
    if (!open) return
    const close = event => {
      if (event.type === 'keydown' && event.key === 'Escape') { setOpen(false); bell.current?.focus() }
      if (event.type === 'pointerdown' && !container.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close) }
  }, [open])
  async function update(path, options) {
    setBusy(true)
    try { await request(path, options); await refresh() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const unread = data?.notifications.filter(item => !item.read).length || 0
  return <div ref={container} className="relative">
    <button ref={bell} type="button" className="relative rounded-xl p-3 text-gray-700 hover:bg-orange-50 focus-visible:ring-2 focus-visible:ring-orange-500" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} aria-controls="checkin-notifications" onClick={() => { setOpen(!open); if (!open) refresh() }}>
      <IconBell size={21} />{unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-600" />}
    </button>
    {open && <section id="checkin-notifications" aria-label="Check-in notifications" className="fixed left-3 right-3 top-20 z-50 max-h-[75vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-96">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-gray-900">Notifications</h2><button type="button" aria-label="Close notifications" className="rounded p-2" onClick={() => { setOpen(false); bell.current?.focus() }}><IconX size={18} /></button></div>
      {error && <div role="alert" className="mb-3 text-sm text-amber-800">{error} <button type="button" className="underline" onClick={refresh}>Retry</button></div>}
      {!data && !error && <p role="status" className="text-sm text-gray-500">Loading reminders…</p>}
      {data?.notifications.length === 0 && <p className="text-sm text-gray-500">No pending reminders. Check-ins with confirmed dates will appear here.</p>}
      {data?.notifications.map(item => <article key={item.id} className={`rounded-xl border p-4 ${item.read ? 'border-gray-100' : 'border-orange-200 bg-orange-50'}`}>
        <p className="text-xs font-semibold capitalize text-orange-700">{item.days > 0 ? 'Overdue' : item.stage}</p><h3 className="mt-1 text-sm font-bold">{item.title}</h3>
        <p className="mt-2 text-sm leading-6 text-gray-600">{item.message}</p><p className="mt-2 text-xs text-gray-500">{item.semester} · {item.phase}</p>
        <p className="mt-1 text-xs text-gray-500">Target: {new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' }).format(new Date(`${item.dueDate}T00:00:00+08:00`))}</p>
        <button type="button" className="mt-3 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => navigate(item.href)}>Complete Check-in</button>
        {!item.read && <button type="button" disabled={busy} className="ml-3 mt-3 text-xs underline" onClick={() => update(`/${item.id}/read`, { method: 'PATCH' })}>Mark as read</button>}
      </article>)}
      {data && <label className="mt-5 flex items-start gap-3 border-t border-gray-100 pt-4 text-sm text-gray-600"><input type="checkbox" className="mt-1 accent-orange-600" checked={data.emailEnabled} disabled={busy} onChange={event => update('/preferences', { method: 'PUT', body: JSON.stringify({ emailEnabled: event.target.checked }) })} />Email me semester check-in reminders</label>}
    </section>}
  </div>
}
