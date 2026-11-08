import { Component, Suspense, useSyncExternalStore } from 'react'
import { Link, useLocation } from 'react-router-dom'
import HeaderBrand from './HeaderBrand'
import AdminHeader from './AdminHeader'
import { hasSlowRoute, navigationIdentity, navigationSnapshot, subscribeNavigation } from '../utils/routeLoading'

function NavigationShell({ error = false }) {
  const { pathname } = useLocation()
  const admin = pathname.startsWith('/admin') && Boolean(localStorage.getItem('adminToken'))
  return <>
    <nav aria-label="Skip navigation"><a href="#main-content" className="skip-navigation">Skip to content</a></nav>
    {admin ? <AdminHeader /> : <header className="lm-site-header">
      <div className="lm-header-inner mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
        <Link to="/" aria-label="LearnMatch home"><HeaderBrand /></Link>
        <nav aria-label="LearnMatch navigation" className="flex flex-wrap gap-2">
          <Link to="/courses/search" className="lm-action">Explore Courses</Link>
          <Link to="/help" className="lm-action">Help</Link>
          <Link to="/login" className="lm-action">Log In</Link>
        </nav>
      </div>
    </header>}
    <main id="main-content" tabIndex={-1}>
      {error && <div role="alert" className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-5 py-4 text-sm text-gray-700">
        <p>We couldn't open that page. Reload to retry, or choose another page.</p>
        <button type="button" className="lm-action" onClick={() => window.location.reload()}>Reload and retry</button>
        <Link to="/" className="lm-action">LearnMatch home</Link>
      </div>}
    </main>
  </>
}

class RouteErrorBoundary extends Component {
  state = { failed: false, locationKey: this.props.locationKey }

  static getDerivedStateFromProps(props, state) {
    return props.locationKey !== state.locationKey ? { failed: false, locationKey: props.locationKey } : null
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <NavigationShell error /> : this.props.children
  }
}

export default function RouteNavigation({ children }) {
  const location = useLocation()
  const identity = useSyncExternalStore(subscribeNavigation, navigationIdentity)
  // The existing session boundary can remount a cached student page before its
  // sign-in redirect runs. Do not retain that page while the login chunk loads.
  // Existing authentication guards still decide and perform the redirect.
  const studentPage = /^\/(dashboard|profile|settings|onboarding|college|results|assessment-history|feedback)(\/|$)/.test(location.pathname)
  const clearedStudent = studentPage && (!identity || identity.startsWith(':'))
  return <RouteErrorBoundary key={identity} locationKey={location.key}>
    <Suspense key={clearedStudent ? 'cleared-session' : 'navigation'} fallback={<NavigationShell />}>{children}</Suspense>
  </RouteErrorBoundary>
}

export function SlowNavigationFeedback() {
  useSyncExternalStore(subscribeNavigation, navigationSnapshot)
  const location = useLocation()
  // Browser history can advance before React commits a suspended destination.
  const pathname = typeof window === 'undefined' ? location.pathname : window.location.pathname
  if (!hasSlowRoute(pathname)) return null
  return <aside role="status" aria-live="polite" className="route-network-feedback">
    <p>This page is taking longer than usual. You can keep using the navigation, wait, or reload.</p>
    <button type="button" className="lm-action" onClick={() => window.location.reload()}>Reload page</button>
  </aside>
}
