import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import React from 'react'
import { transformWithOxc } from 'vite'

test('Manage Courses keeps the same page identity across search, clear, filters and draft query navigation', async () => {
  const source = await readFile(new URL('../components/PageTransition.jsx', import.meta.url), 'utf8')
  const { code } = await transformWithOxc(source.replace(/^import [^\r\n]*\r?\n/gm, ''), 'PageTransition.jsx', { jsx: { runtime: 'classic' } })
  let location
  const context = { React, useLocation: () => location }
  vm.runInNewContext(code.replace('export default PageTransition;', 'globalThis.PageTransition = PageTransition;'), context)
  const children = React.createElement('input', { defaultValue: 'Preserved draft input' })
  const queries = ['', '?search=a', '?search=ac', '?search=acc', '', '?status=draft', '?course=428', '?add=1']
  const keys = queries.map((search, index) => {
    location = { pathname: '/admin/courses', search, key: `navigation-${index}` }
    const element = context.PageTransition({ children })
    assert.equal(element.props.children, children)
    return element.key
  })
  assert.equal(new Set(keys).size, 1, 'query navigation must not remount the page or restart its animation')
  location = { pathname: '/admin/users', key: 'users-navigation' }
  assert.equal(context.PageTransition({ children }).key, 'users-navigation', 'other page transitions retain their existing behavior')
})
