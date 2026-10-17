import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'
import vm from 'node:vm'
import { validateCourseSource } from '../../../shared/courseSourceFields.js'
import { emptyDraftFields } from './courseDraftForm.js'

test('saved course view is read-only and explains saving versus the final publish action', async () => {
  // Compile actual JSX without the intermittently crashing native Vite SSR worker on Windows.
  const compile = async (file, name, bindings = {}) => {
    const source = await readFile(new URL(file, import.meta.url), 'utf8')
    const { code } = await transformWithOxc(source.replace(/^import [^\r\n]*\r?\n/gm, ''), `${name}.jsx`, { jsx: { runtime: 'classic' } })
    return vm.runInNewContext(code.replace(/export (?:default )?function/g, 'function') + `\n${name}`, { React, useState: React.useState, useEffect: React.useEffect, useRef: React.useRef, useId: React.useId, ...bindings })
  }
  const DraftDisclosure = await compile('../components/admin/DraftDisclosure.jsx', 'DraftDisclosure')
  const View = await compile('../components/admin/SavedDraftCourseView.jsx', 'SavedDraftCourseView', { DraftDisclosure, validateCourseSource })
  const form = { ...emptyDraftFields, course_name: 'Keep saved course', cluster_category: 'BUSINESS CLUSTER', description: 'Keep description', obtainable_skills: 'Keep skills', career_opportunities: [{ opportunity_id: 4, job_title: 'Synthetic saved role', salary_range: '', description: 'Keep career reference' }] }
  const before = structuredClone(form)
  let edits = 0, reviews = 0
  const onEdit = () => { edits++ }, onReview = () => { reviews++ }
  const tree = View({ form, courseCode: 'CRS428', onEdit, onReview })
  const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []
  const edit = nodes(tree).find(node => node.type === 'button' && node.props.onClick === onEdit)
  edit.props.onClick()
  assert.equal(edits, 1); assert.equal(reviews, 0)
  assert.deepEqual(form, before)
  const html = renderToStaticMarkup(createElement(View, { form, courseCode: 'CRS428', onEdit: () => {}, onReview: () => {} }))
  assert.match(html, /Saved draft/); assert.match(html, /Inactive/)
  assert.match(html, /Edit Draft/)
  assert.match(html, /Continue to Review &amp; Publish/)
  assert.match(html, /final action that makes the reviewed course available to students/)
  assert.match(html, /Synthetic saved role/)
  assert.doesNotMatch(html, /<input|<textarea|<select|type="submit"/)
  assert.deepEqual(form, before)
  const published = renderToStaticMarkup(createElement(View, { form, courseCode: 'CRS428', publication: { publisher_label: 'test admin', published_at: '2026-10-17T00:00:00Z' } }))
  assert.doesNotMatch(published, /Edit Draft|Continue to Review/)
  assert.doesNotMatch(published, /Edit Course/)
  const catalogProps = { form, courseCode: 'CRS001', catalog: true, active: true, canonicalCareers: [{ career_id: 'synthetic', career_title: 'Canonical synthetic role', philippines_description: 'Preserved canonical description', estimated_monthly_salary_php: { display: 'Recorded range' } }], onEdit }
  const catalogTree = View(catalogProps)
  nodes(catalogTree).find(node => node.type === 'button' && node.props.onClick === onEdit).props.onClick()
  assert.equal(edits, 2)
  const catalog = renderToStaticMarkup(createElement(View, catalogProps))
  assert.match(catalog, /Catalog course - Active/)
  assert.match(catalog, /Edit Course/)
  assert.match(catalog, /Canonical synthetic role/)
  assert.match(catalog, /Preserved canonical description/)
  assert.doesNotMatch(catalog, /<input|<textarea|<select|type="submit"|Publish course|Saved draft/)
  assert.deepEqual(form, before)
  const inactive = renderToStaticMarkup(createElement(View, { ...catalogProps, active: false }))
  assert.match(inactive, /Catalog course - Inactive/)
  const archived = renderToStaticMarkup(createElement(View, { ...catalogProps, identityNotice: 'Duplicate - see CRS021' }))
  assert.match(archived, /Archived catalog identity/)
  assert.match(archived, /Duplicate - see CRS021/)
  assert.match(archived, /retained to preserve linked history/)
  assert.doesNotMatch(archived, /<input|<textarea|<select|type="submit"/)

})

test('post-save reload normalizes server state, edits are explicit, and careers precede sources', async () => {
  const page = await readFile(new URL('../pages/admin/ManageCourses.jsx', import.meta.url), 'utf8')
  assert.match(page, /await openEditCourseForm\(data.courseId \|\| editingCourseId\)/)
  assert.match(page, /setCourseForm\(loadedForm\)[\s\S]*setInitialCourseForm\(loadedForm\)/)
  assert.match(page, /onEdit=\{\(\) => setSavedDraftEditing\(true\)\}/)
  assert.match(page, /if \(editingCourseId && !savedDraftEditing\)/)
  assert.match(page, /Save Draft Changes/)
  assert.match(page, /!draftOptions\?\.career_opportunities_supported/)
  assert.match(page, /Your inputs are kept/)
  assert.match(page, /if \(sourceEditorOpen\)/)
  assert.match(page, /onEditorChange=\{setSourceEditorOpen\}/)
  assert.ok(page.indexOf('<DraftCareerFields') < page.indexOf('<SourceFirstDraftSources sources='))
  const sources = await readFile(new URL('../components/admin/DraftCourseSources.jsx', import.meta.url), 'utf8')
  const readOnly = sources.slice(sources.indexOf('if (readOnly)'), sources.indexOf('return <section'))
  assert.doesNotMatch(readOnly, /onChange=|request\(|setEditor\(|setConfirmation\(/)
  const panel = await readFile(new URL('../components/admin/CoursePublicationPanel.jsx', import.meta.url), 'utf8')
  assert.match(panel, /Publish Course — Make available to students/)
  assert.match(panel, /!review.ready \|\| !publishConfirmed/)
})


test('all course rows open the same saved view; legacy editing is explicit and published editing stays locked', async () => {
  const page = await readFile(new URL('../pages/admin/ManageCourses.jsx', import.meta.url), 'utf8')
  const actions = page.slice(page.indexOf('function CourseActions'), page.indexOf('function CourseTable'))
  assert.match(actions, /aria-label=\{`View \$\{course.course_name\}`\}/)
  assert.match(actions, /IconEye/)
  assert.doesNotMatch(actions, /IconEdit|viewOnly|>Edit</)
  assert.match(page, /catalog=\{!editingDraft && !publication\}/)
  assert.match(page, /editingDraft && !publication && <DraftCourseSources readOnly/)
  assert.match(page, /editingDraft && !publication && <div id="saved-publication">/)
  assert.match(page, /onClick=\{editingCourseId \? backToSavedCourse : backToList\}/)
  assert.match(page, /initialCourseForm\) && !window.confirm/)
  assert.match(page, /savedDraftEditing && editingDraft \? 'Save Draft Changes'/)
  const fields = await readFile(new URL('../components/admin/CourseDraftFields.jsx', import.meta.url), 'utf8')
  assert.match(fields, /enabled=\{collapsible\}/)
})
