import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

test('representative Profile and Registration controls render required and inline-error semantics', async () => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  try {
    const { ApplicabilityQuestion, ImpactOptions, UsernameField } = await vite.ssrLoadModule('/src/pages/Profile.jsx')
    const usernameMarkup = renderToStaticMarkup(React.createElement(UsernameField, {
      value: 'current_student',
      onChange: () => {},
      error: 'Username is already taken.',
    }))
    assert.match(usernameMarkup, /Username/)
    assert.match(usernameMarkup, /value="current_student"/)
    assert.match(usernameMarkup, /required=""/)
    assert.match(usernameMarkup, /minLength="3"/)
    assert.match(usernameMarkup, /maxLength="30"/)
    assert.match(usernameMarkup, /aria-invalid="true"/)
    assert.match(usernameMarkup, /Username is already taken\./)

    const applicabilityMarkup = renderToStaticMarkup(React.createElement(ApplicabilityQuestion, {
      factor: 'health',
      question: 'Do you have an ongoing health condition?',
      value: '',
      onChange: () => {},
      error: 'Please choose Yes or No.',
    }))
    assert.deepEqual([...applicabilityMarkup.matchAll(/value="(no|yes)"/g)].map((match) => match[1]), ['no', 'yes'])
    assert.ok((applicabilityMarkup.match(/required=""/g) || []).length === 2)
    assert.match(applicabilityMarkup, /aria-invalid="true"/)
    assert.match(applicabilityMarkup, /Please choose Yes or No\./)

    const profileMarkup = renderToStaticMarkup(React.createElement(ImpactOptions, {
      name: 'factor_health_impact',
      value: '',
      onChange: () => {},
      error: 'Please select an impact level.',
    }))
    assert.deepEqual([...profileMarkup.matchAll(/value="([1-4])"/g)].map((match) => Number(match[1])), [1, 2, 3, 4])
    assert.match(profileMarkup, /No impact/)
    assert.match(profileMarkup, /High impact/)
    assert.match(profileMarkup, /aria-invalid="true"/)
    assert.match(profileMarkup, /Please select an impact level\./)

    const { default: Register } = await vite.ssrLoadModule('/src/pages/Register.jsx')
    const registerMarkup = renderToStaticMarkup(
      React.createElement(MemoryRouter, null, React.createElement(Register))
    )
    for (const field of ['email', 'username', 'password', 'confirmPassword']) {
      assert.match(registerMarkup, new RegExp(`data-validation-field="${field}"`))
    }
    assert.ok((registerMarkup.match(/text-red-500/g) || []).length >= 4)
  } finally {
    await vite.close()
  }
})

test('Profile source excludes retired body measurements and Other Context controls', async () => {
  const source = await readFile(new URL('./Profile.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /height_cm|weight_kg|factor_others|full_name|Full name/)
  assert.doesNotMatch(source, /\bBMI\b|Other Context|No current difficulty|No difficulty/)
  for (const label of ['Seeing', 'Hearing', 'Walking or climbing steps', 'Self-care', 'Other physical or accessibility difficulty']) {
    assert.ok(source.includes(label))
  }
  for (const label of ['Some difficulty', 'A lot of difficulty', 'Cannot do it at all']) {
    assert.match(source, new RegExp(label))
  }
})

test('Admin course form keeps optional textareas unmarked and required fields wired for inline errors', async () => {
  const source = await readFile(new URL('./admin/ManageCourses.jsx', import.meta.url), 'utf8')
  assert.match(source, /data-validation-field="course_name"/)
  assert.match(source, /data-validation-field="cluster_category"/)
  assert.match(source, /course-name-error/)
  assert.match(source, /cluster-category-error/)
  assert.doesNotMatch(source, /Description <RequiredMark/)
  assert.doesNotMatch(source, /Obtainable Skills <RequiredMark/)
})
