import { useLocation } from 'react-router-dom'

function PageTransition({ children }) {
  const location = useLocation()
  // Course filters and saved-draft navigation stay inside the same screen.
  // Remounting it for query changes clears state and flashes the loading view.
  const transitionKey = location.pathname === '/admin/courses' ? location.pathname : location.key
  return <div key={transitionKey} className="motion-page">{children}</div>
}

export default PageTransition
