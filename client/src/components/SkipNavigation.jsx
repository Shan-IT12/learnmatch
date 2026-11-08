import { useLocation } from 'react-router-dom'
import { useLayoutEffect, useRef } from 'react'
import { PRERENDER_PATHS } from '../seo'

export default function SkipNavigation() {
  const { pathname } = useLocation()
  const link = useRef(null)
  useLayoutEffect(() => {
    if (PRERENDER_PATHS.includes(pathname)) return
    const connect = () => {
      const main = document.querySelector('main')
      if (!main || main.closest('[aria-busy="true"]')) return false
      main.id ||= 'main-content'
      if (!main.hasAttribute('tabindex')) main.tabIndex = -1
      if (link.current) link.current.href = `#${main.id}`
      return true
    }
    if (connect()) return
    // Suspended routes mount after this layout effect; connect once they are ready.
    const observer = new MutationObserver(() => { if (connect()) observer.disconnect() })
    observer.observe(document.getElementById('root'), { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname])
  // Static public pages include their own working skip link in the raw HTML.
  if (PRERENDER_PATHS.includes(pathname)) return null
  return <nav aria-label="Skip navigation"><a ref={link} href="#main-content" className="skip-navigation" onClick={(event) => {
    const main = document.querySelector('main')
    if (!main) return
    event.preventDefault()
    main.id ||= 'main-content'
    main.tabIndex = -1
    main.focus()
    main.scrollIntoView()
  }}>Skip to content</a></nav>
}
