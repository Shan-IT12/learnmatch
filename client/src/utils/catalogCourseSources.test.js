import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'
import vm from 'node:vm'
import { catalogReferenceHref } from '../../../shared/catalogReferenceFields.js'
import { getCatalogCourseReferences } from '../../../server/services/catalogCourseReferenceService.js'

test('catalog Sources renders actual links, purpose and provenance without confirmation or fetching', async () => {
  // Render the actual JSX components without a Vite dev server or native SSR worker.
  const compile = async (file, name, bindings = {}) => {
    const source = await readFile(new URL(file, import.meta.url), 'utf8')
    const { code } = await transformWithOxc(source.replace(/^import [^\r\n]*\r?\n/gm, ''), `${name}.jsx`, { jsx: { runtime: 'classic' } })
    return vm.runInNewContext(code.replace(/export (?:default )?function/g, 'function') + `\n${name}`, { React, useState: React.useState, useEffect: React.useEffect, useRef: React.useRef, useId: React.useId, ...bindings })
  }
  const DraftDisclosure = await compile('../components/admin/DraftDisclosure.jsx', 'DraftDisclosure')
  const Sources = await compile('../components/admin/CatalogCourseSources.jsx', 'CatalogCourseSources', { DraftDisclosure, catalogReferenceHref })
  const render = value => renderToStaticMarkup(createElement(Sources, { catalogReferences: value }))
  const html = render(getCatalogCourseReferences('CRS121'))
  assert.match(html, /CMO No. 34, series of 1996/)
  assert.match(html, /CMO-No\.-34-Series-of-1996/)
  assert.match(html, /Recorded use/)
  assert.match(html, /courses\[120\].sources\[0\]/)
  assert.match(html, /No source has been manually confirmed/)
  assert.match(html, /rel="noopener noreferrer"/)
  assert.doesNotMatch(html, /<input|<form|type="submit"|Record Admin Confirmation/)
  const missing = render(getCatalogCourseReferences('CRS051'))
  assert.match(missing, /No usable URL is recorded/)
  assert.doesNotMatch(missing, /<a /)
  assert.match(render(getCatalogCourseReferences('CRS244')), /Showing up to 3 of/)
  assert.match(html, /not establish that BAT and BS Agriculture are the same program/)
  assert.match(html, /transition/)
  assert.match(html, /latest official references identified during our lookup/)
  assert.match(html, /No applicable 2026 replacement was identified/)
  assert.doesNotMatch(html, /may be available|not yet confirmed/)
  assert.match(render(getCatalogCourseReferences('CRS001')), /recorded references found for this course/)
  assert.doesNotMatch(html, /View lookup limitations|legacy CHED 2026 index|e.gov page was not text-readable/)
  assert.match(render(getCatalogCourseReferences('CRS001')), /Latest references found/)
  assert.match(render(getCatalogCourseReferences('CRS070')), /HTTP 403/)
  assert.match(render(getCatalogCourseReferences('CRS243')), /parent framework/)
  assert.match(render(null), /Refresh after updating the backend/)
  const unsafe = getCatalogCourseReferences('CRS121')
  unsafe.references[0].title = '<script>unsafe()</script>'
  unsafe.references[0].url = 'javascript:alert(1)'
  const escaped = render(unsafe)
  assert.doesNotMatch(escaped, /<script>|href="javascript/)
  assert.match(escaped, /&lt;script&gt;/)
  const component = await readFile(new URL('../components/admin/CatalogCourseSources.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(component, /fetch\(|onChange=|dangerouslySetInnerHTML|POST|PUT|DELETE/)
})
