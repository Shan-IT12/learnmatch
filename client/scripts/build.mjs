import { build, createServer } from 'vite'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { PUBLIC_PAGES, PRERENDER_PATHS, getMetadata, WEBSITE_SCHEMA, SITE_URL } from '../src/seo.js'

await build({ build: { manifest: true } })
const template = await readFile('dist/index.html', 'utf8')
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))
// Private and data-driven routes retain the SPA shell, never the home page's indexable content.
await writeFile('dist/app.html', template.replace('<title>LearnMatch</title>', '<title>LearnMatch</title><meta name="robots" content="noindex, follow" />'))
// Data-driven course pages must remain renderable by crawlers. Do not put the
// private shell's noindex directive on these public routes before their API loads.
await writeFile('dist/course.html', template.replace('<title>LearnMatch</title>', '<title>College Course Details | LearnMatch</title><meta name="description" content="Explore college course information, skills, careers, and schools on LearnMatch." /><meta name="robots" content="index, follow" />'))
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
// Prerendering must not replace the optimized dependencies of a running dev server.
const server = await createServer({ cacheDir: 'node_modules/.vite-prerender', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
try {
  const { renderPublicPage } = await server.ssrLoadModule('/src/PublicStatic.jsx')
  for (const path of Object.keys(PUBLIC_PAGES)) {
    const metadata = getMetadata(path)
    const head = `<title>${escape(metadata.title)}</title>
    <meta name="description" content="${escape(metadata.description)}" />
    <meta name="robots" content="${metadata.robots}" />
    <link rel="canonical" href="${metadata.canonical}" />
    <meta property="og:title" content="${escape(metadata.title)}" />
    <meta property="og:description" content="${escape(metadata.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${metadata.canonical}" />
    <meta name="twitter:card" content="summary" />
    ${path === '/' ? `<script id="website-schema" type="application/ld+json">${JSON.stringify(WEBSITE_SCHEMA).replaceAll('<', '\\u003c')}</script>` : ''}`
    let content = PRERENDER_PATHS.includes(path) ? renderPublicPage(path) : ''
    for (const [source, asset] of Object.entries(manifest)) {
      if (asset.file && !source.endsWith('.html')) content = content.replaceAll(`/${source}`, `/${asset.file}`)
    }
    const html = template.replace(/<title>.*?<\/title>/, head).replace('<div id="root"></div>', `<div id="root">${content}</div>`)
    const directory = path === '/' ? 'dist' : `dist${path}`
    await mkdir(directory, { recursive: true })
    await writeFile(`${directory}/index.html`, html)
  }
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(PUBLIC_PAGES).map(path => `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n')}\n</urlset>\n`)
} finally { await server.close() }
