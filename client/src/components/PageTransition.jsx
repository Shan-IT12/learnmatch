import { useLocation } from 'react-router-dom'

function PageTransition({ children }) {
  const location = useLocation()
  return <div key={location.key} className="motion-page">{children}</div>
}

export default PageTransition
