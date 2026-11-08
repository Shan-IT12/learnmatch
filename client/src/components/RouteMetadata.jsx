import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getMetadata, SITE_URL, WEBSITE_SCHEMA } from '../seo'

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

export default function RouteMetadata() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    const metadata = getMetadata(pathname)
    document.title = metadata.title
    setMeta('name', 'description', metadata.description)
    setMeta('name', 'robots', metadata.robots)
    setMeta('property', 'og:title', metadata.title)
    setMeta('property', 'og:description', metadata.description)
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:url', metadata.canonical || SITE_URL + '/')
    setMeta('name', 'twitter:card', 'summary')
    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (metadata.canonical) {
      if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical) }
      canonical.href = metadata.canonical
    } else canonical?.remove()
    document.getElementById('website-schema')?.remove()
    if (pathname === '/') {
      const schema = document.createElement('script')
      schema.id = 'website-schema'
      schema.type = 'application/ld+json'
      schema.textContent = JSON.stringify(WEBSITE_SCHEMA)
      document.head.append(schema)
    }
  }, [pathname])
  return null
}
