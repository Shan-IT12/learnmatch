// Build-only entry: render the actual public components without sessions or private data.
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import Landing from './pages/Landing'
import About from './pages/About'
import Help from './pages/Help'
import PrivacyNotice from './pages/PrivacyNotice'
import Terms from './pages/Terms'

const pages = { '/': Landing, '/about': About, '/help': Help, '/privacy': PrivacyNotice, '/terms': Terms }
export function renderPublicPage(path) {
  return renderToString(createElement(MemoryRouter, { initialEntries: [path] }, createElement(pages[path])))
}
