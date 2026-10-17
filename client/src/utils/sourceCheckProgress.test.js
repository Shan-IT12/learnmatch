import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { createElement } from 'react'
import { transformWithOxc } from 'vite'

test('indeterminate checking UI shows actual elapsed time and cleans up its timer', async () => {
  const source = await readFile(new URL('../components/admin/SourceCheckProgress.jsx', import.meta.url), 'utf8')
  const { code } = await transformWithOxc(source.replace("import { useEffect, useState } from 'react'", ''), 'SourceCheckProgress.jsx', { jsx: { runtime: 'classic' } })
  let time = 100000, index = 0, tick, cleanup, cleared = 0
  const states = []
  const context = vm.createContext({
    React: { createElement }, Date: { now: () => time },
    useState: initial => {
      const slot = index++
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial
      return [states[slot], value => { states[slot] = value }]
    },
    useEffect: effect => { if (!cleanup) cleanup = effect() },
    setInterval: (callback, ms) => { assert.equal(ms, 1000); tick = callback; return 17 },
    clearInterval: id => { assert.equal(id, 17); cleared++ },
    fetch: () => { throw Error('Loading UI must not make requests') },
  })
  const Component = vm.runInContext(code.replace('export default function', 'function') + '\nSourceCheckProgress', context)
  const render = () => { index = 0; return Component({ sourceCount: 2 }) }
  let tree = render()
  const progress = tree.props.children[1]
  assert.equal(progress.type, 'progress')
  assert.equal(Object.hasOwn(progress.props, 'value'), false)
  assert.equal(progress.props['aria-label'], 'Source checking in progress')
  assert.equal(tree.props.children[0].props.role, 'status')
  assert.equal(tree.props.children[0].props['aria-live'], 'polite')
  assert.equal(tree.props.children[4], false)
  time += 65000; tick(); tree = render()
  assert.equal(tree.props.children[2].props.children.join(''), 'Elapsed: 1m 5s')
  assert.match(tree.props.children[4].props.children, /Still waiting for the server/)
  assert.match(tree.props.children[3].props.children, /Completion percentage is unavailable/)
  cleanup()
  assert.equal(cleared, 1)
})

test('progress is limited to source checks and ends through the existing completion/error/cancellation path', async () => {
  const editor = await readFile(new URL('../components/admin/SourceFirstDraftSources.jsx', import.meta.url), 'utf8')
  assert.equal((editor.match(/<SourceCheckProgress sourceCount=\{enteredSources.length\}/g) || []).length, 2)
  assert.match(editor, /setChecking\(isCheck\)/)
  assert.match(editor, /finally .*setChecking\(false\)/)
  assert.match(editor, /applyCurrentSourceResults[\s\S]*?\}, true\)/)
  assert.match(editor, /checking && <button[^\n]+abort.current.abort\(\)/)
})
