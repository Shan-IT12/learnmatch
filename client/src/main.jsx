import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import StudentSessionBoundary from './components/StudentSessionBoundary.jsx'
import 'leaflet/dist/leaflet.css'
import './index.css'
import { publicPages } from './utils/routeLoading'

function mount() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <StudentSessionBoundary><App /></StudentSessionBoundary>
      </BrowserRouter>
    </StrictMode>,
  )
}

// Keep real prerendered public content visible on a cold/direct URL until its
// route module is ready, rather than replacing it with temporary route chrome.
const root = document.getElementById('root')
const initialPage = publicPages[window.location.pathname]
if (root.hasChildNodes() && initialPage) initialPage.preload().then(mount, mount)
else mount()
