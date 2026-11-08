import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { PRERENDER_PATHS, PUBLIC_PAGES, getMetadata } from '../src/seo.js'

const read = path => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8')

test('public build contains readable content, one H1/main and route-specific canonical metadata', async () => {
  for (const path of PRERENDER_PATHS) {
    const html = await read(path === '/' ? 'index.html' : `${path.slice(1)}/index.html`)
    assert.equal((html.match(/<h1\b/g) || []).length, 1, path)
    assert.equal((html.match(/<main\b/g) || []).length, 1, path)
    assert.ok(html.includes(`<title>${getMetadata(path).title.replaceAll('&', '&amp;')}</title>`), path)
    assert.ok(html.includes(`href="${getMetadata(path).canonical}"`), path)
    assert.ok(html.includes('name="description"'), path)
    assert.ok(html.includes('Skip to content'), path)
    assert.ok(html.includes('href="/privacy"'), path)
    assert.ok(!html.includes('/src/assets/'), path)
    for (const [, asset] of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) {
      await access(new URL(`../dist${asset}`, import.meta.url))
    }
  }
})

test('SPA fallback and nonpublic navigation stay noindex without public-page content', async () => {
  const html = await read('app.html')
  assert.ok(html.includes('content="noindex, follow"'))
  assert.ok(html.includes('<div id="root"></div>'))
  for (const path of ['/admin/courses', '/results', '/profile', '/college', '/not-found']) {
    assert.equal(getMetadata(path).robots, 'noindex, follow')
    assert.equal(getMetadata(path).canonical, undefined)
  }
})

test('public data-driven course shells do not inherit private noindex metadata', async () => {
  for (const file of ['course.html', 'courses/search/index.html']) {
    const html = await read(file)
    assert.ok(html.includes('content="index, follow"'), file)
    assert.ok(html.includes('name="description"'), file)
    assert.ok(!html.includes('noindex'), file)
  }
})

test('crawl files advertise only curated public routes and a truthful Website schema', async () => {
  const sitemap = await read('sitemap.xml')
  assert.equal((sitemap.match(/<loc>/g) || []).length, Object.keys(PUBLIC_PAGES).length)
  assert.ok(!/admin|onboarding|results|profile|schools\//.test(sitemap))
  assert.ok((await read('robots.txt')).startsWith('User-agent: *'))
  const home = await read('index.html')
  const schema = JSON.parse(home.match(/type="application\/ld\+json">([^<]+)<\/script>/)[1])
  assert.equal(schema['@type'], 'WebSite')
  assert.equal(schema.name, 'LearnMatch')
  assert.ok(!('aggregateRating' in schema))
})
