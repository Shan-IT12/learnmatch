import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { PRIVACY_NOTICE_VERSION, LEGAL_REVISION_DATE } from '../../../shared/legalDocuments.js'

test('public notice, links and results copy render without changing access or forms', async t => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  const oldLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const oldSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  const render = component => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/privacy'] }, component))
  try {
    const { default: PrivacyNotice } = await vite.ssrLoadModule('/src/pages/PrivacyNotice.jsx')
    await t.test('notice is public and provides a dated version, contact and explicit historical/current distinction', async () => {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Public notice must not require account storage') } })
      const markup = render(React.createElement(PrivacyNotice))
      assert.match(markup, /<main/)
      assert.match(markup, /<h1[^>]*>LearnMatch Privacy Notice/)
      assert.ok(markup.includes(`Notice version ${PRIVACY_NOTICE_VERSION}`))
      assert.ok(markup.includes(`dateTime="${LEGAL_REVISION_DATE}"`))
      assert.match(markup, /href="mailto:learnmatch1@gmail.com"/)
      assert.match(markup, /Back to LearnMatch/)
      assert.match(markup, /Each of the five Personal Factors requires a Yes or No answer/)
      assert.doesNotMatch(markup, /Prefer not to|Personal Factor is optional/)
      assert.match(markup, /current form does not collect an Others free-text response/)
      assert.match(markup, /Older records may still contain retired Others text/)
      assert.match(markup, /Sending an email does not automatically delete or change saved information/)
      assert.match(markup, /removed from the active LearnMatch database/)
      assert.match(markup, /does not automatically erase backup copies, previously exported records/)
      assert.match(markup, /cannot promise immediate removal or a fixed deletion deadline/)
      assert.match(markup, /retention schedules have not been verified/)
      assert.match(markup, /requests authorized before deletion cannot be recalled remotely/)
      assert.match(markup, /do not assume that deletion succeeded or failed/)
      assert.match(markup, /Automatic inactivity deletion is not enabled/)
      assert.doesNotMatch(markup, /Vercel|Railway|legally approved|fully compliant|Publication decisions|guardian verification|guaranteed anonymity/i)
      const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8')
      assert.match(app, /<Route path="\/privacy" element=\{<PrivacyNotice \/>\} \/>/)
      assert.doesNotMatch(markup, /<input|<form/)
    })
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } })
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => null } })
    await t.test('registration opens the notice in a new tab with an unchecked required agreement checkbox', async () => {
      const { default: Register } = await vite.ssrLoadModule('/src/pages/Register.jsx')
      const markup = render(React.createElement(Register))
      const link = markup.match(/<a[^>]*href="\/privacy"[^>]*>[\s\S]*?<\/a>/)?.[0]
      assert.ok(link)
      assert.match(link, /target="_blank"/)
      assert.match(link, /rel="noopener noreferrer"/)
      assert.match(link, /focus-visible:ring-2/)
      assert.match(markup, /type="checkbox"/)
      assert.match(markup, /I agree to the /)
      assert.match(markup, /href="\/terms"/)
      assert.doesNotMatch(markup.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0] || '', /checked=""/)

      const { default: PublicFooter } = await vite.ssrLoadModule('/src/components/PublicFooter.jsx')
      assert.match(render(React.createElement(PublicFooter)), /href="\/privacy"/)
      const landing = await readFile(new URL('./Landing.jsx', import.meta.url), 'utf8')
      assert.match(landing, /<PublicFooter \/>/)
    })
    await t.test('public information links open separate tabs without requiring registration state', async () => {
      const markup = render(React.createElement(PrivacyNotice))
      assert.match(markup, /Back to LearnMatch/)
      for (const anchor of markup.matchAll(/<a\b[^>]*href="\/(?:about|help|privacy|terms)(?:#[^"]*)?"[^>]*>/g)) {
        assert.match(anchor[0], /target="_blank"/)
        assert.match(anchor[0], /rel="noopener noreferrer"/)
      }
    })
    await t.test('assessment steps retain their controls without added privacy notice panels', async () => {
      const { default: OnboardingLayout } = await vite.ssrLoadModule('/src/components/OnboardingLayout.jsx')
      for (const completed of [[], [1, 2, 3, 4]]) {
        globalThis.sessionStorage.getItem = key => key === 'learnmatch:assessment:completed-steps' ? JSON.stringify(completed) : null
        for (const currentStep of [1, 2, 3, 4]) {
          const markup = render(React.createElement(OnboardingLayout, { currentStep, isComplete: false, showFooterNavigation: false }, React.createElement('input', { name: 'synthetic-answer' })))
          assert.match(markup, /name="synthetic-answer"/)
          assert.doesNotMatch(markup, /Before you answer|href="\/privacy"|<details/)
          assert.doesNotMatch(markup, /type="checkbox"|I agree|I consent/)
        }
      }
    })
    await t.test('one shared disclaimer covers all three result surfaces', async () => {
      const { default: Disclaimer } = await vite.ssrLoadModule('/src/components/CompatibilityDisclaimer.jsx')
      const markup = renderToStaticMarkup(React.createElement(Disclaimer))
      assert.match(markup, /not probabilities or guarantees of academic or career success/)
      assert.match(markup, /do not determine admission or eligibility/)
      assert.match(markup, /predefined criteria/)
      for (const name of ['Results', 'SummaryDashboard', 'AssessmentHistoryResult']) {
        const source = await readFile(new URL(`./${name}.jsx`, import.meta.url), 'utf8')
        assert.equal((source.match(/<CompatibilityDisclaimer \/>/g) || []).length, 1)
      }
    })
  } finally {
    if (oldLocal) Object.defineProperty(globalThis, 'localStorage', oldLocal)
    else delete globalThis.localStorage
    if (oldSession) Object.defineProperty(globalThis, 'sessionStorage', oldSession)
    else delete globalThis.sessionStorage
    await vite.close()
  }
})
