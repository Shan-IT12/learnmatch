import test from 'node:test'
import assert from 'node:assert/strict'
import { lastStudentPath, readStudentPosition, readStudentQuestionPosition, readStudentView, resumableStudentPath, saveStudentPosition, saveStudentQuestionPosition, saveStudentView } from '../src/utils/studentPosition.js'
import { clearUserAuth, storeUserAuth } from '../src/utils/userAuth.js'

function storage() {
  const values = new Map()
  return { get length() { return values.size }, key: index => [...values.keys()][index], getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }
}

test('last page, scroll and College view survive logout/login only for the same account', () => {
  const local = storage(), session = storage()
  storeUserAuth(local, { userId: 1, token: 'A', username: 'studentA' }, session)
  saveStudentPosition(local, 1, '/college', { x: 0, y: 640 })
  saveStudentView(local, 1, 'college-tab', 'history')
  clearUserAuth(local, session)
  storeUserAuth(local, { userId: 2, token: 'B', username: 'studentB' }, session)
  assert.equal(lastStudentPath(local, 2), null)
  assert.equal(readStudentView(local, 2, 'college-tab', 'overview'), 'overview')
  clearUserAuth(local, session)
  storeUserAuth(local, { userId: 1, token: 'new-A', username: 'renamed_A' }, session)
  assert.equal(lastStudentPath(local, 1), '/college')
  assert.deepEqual(readStudentPosition(local, 1, '/college'), { x: 0, y: 640, assessmentY: 0 })
  assert.equal(readStudentView(local, 1, 'college-tab', 'overview'), 'history')
})

test('restoration allows local student routes and never replays transient actions or generates results', () => {
  for (const path of ['https://example.test', '//example.test', '/\\example.test', '/admin', '/login', '/logout', '/college/setup/review', '/api/profile', '/unknown', '/college\n']) assert.equal(resumableStudentPath(path), null, path)
  assert.equal(resumableStudentPath('/college/checkin?reminder=123'), '/college/checkin')
  assert.equal(resumableStudentPath('/college?notifications=1'), '/college')
  assert.equal(resumableStudentPath('/results?returnTo=summary'), '/results?returnTo=summary&saved=1')
  assert.equal(resumableStudentPath('/results/career-path/BSCS?returnTo=summary&token=private'), '/results/career-path/BSCS?returnTo=summary')
  assert.equal(resumableStudentPath('/results/career-path/BSCS?via=chooser&returnTo=summary'), '/results/career-path/BSCS?via=chooser&returnTo=summary')
  const local = storage()
  saveStudentPosition(local, 1, '//example.test', { y: 999 })
  assert.equal(lastStudentPath(local, 1), null)
})

test('assessment restoration stores only question position and requires the same account and attempt', () => {
  const local = storage()
  saveStudentQuestionPosition(local, 1, 'skills', 12, 6)
  saveStudentQuestionPosition(local, 1, 'personality', 12, 9)
  assert.equal(readStudentQuestionPosition(local, 1, 'skills', 12), 6)
  assert.equal(readStudentQuestionPosition(local, 1, 'personality', 12), 9)
  assert.equal(readStudentQuestionPosition(local, 1, 'skills', 13), null)
  assert.equal(readStudentQuestionPosition(local, 2, 'skills', 12), null)
  assert.deepEqual(JSON.parse(local.getItem(local.key(0))).questions.skills, { attemptId: 12, currentIndex: 6 })
})

test('invalid or unavailable storage does not block navigation; page records stay bounded', () => {
  const unavailable = { getItem() { throw Error() }, setItem() { throw Error() } }
  assert.equal(lastStudentPath(unavailable, 1), null)
  assert.doesNotThrow(() => saveStudentPosition(unavailable, 1, '/college', { y: 2 }))
  const local = storage()
  for (let index = 1; index <= 30; index++) saveStudentPosition(local, 1, `/assessment-history/${index}`, { x: -1, y: index, assessmentY: Infinity })
  assert.equal(Object.keys(JSON.parse(local.getItem(local.key(0))).pages).length, 20)
  assert.deepEqual(readStudentPosition(local, 1, '/assessment-history/30'), { x: 0, y: 30, assessmentY: 0 })
})
