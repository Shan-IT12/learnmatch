import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { courseMatchingRubric as rubric } from './courseMatchingRubric.js'
import { draftCourseExample as example } from './draftCourseExample.js'

test('example matches the actual bundled profile and catalog without inventing assignment/review records', async () => {
  const load = async path => JSON.parse(await readFile(new URL(`../../../${path}`,import.meta.url),'utf8'))
  const profiles=await load(example.profileFile),catalog=await load(example.catalogFile)
  const profile=profiles.courses.find(row=>row.course_id===example.courseCode)
  const course=catalog.courses.find(row=>row.course_id===example.courseCode)
  assert.equal(example.profileName,profile.course_name)
  assert.equal(example.catalogName,course.course_name)
  assert.notEqual(example.profileName,example.catalogName)
  assert.equal(example.cluster,profile.parent_cluster)
  assert.equal(example.source.url,profile.sources[0].url)
  assert.equal(example.source.url,course.sources[0].url)
  assert.equal(example.rows.length,example.tutorials.length)
  assert.ok(!example.rows.some(row => ['R - Realistic','A - Artistic'].includes(row.dimension)))
  for(const row of example.rows) {
    const stored=row.group==='Skill'?profile.skills_profile.find(item=>item.skill===row.dimension):profile.riasec_profile[row.dimension[0]]
    assert.equal(row.weight,stored.weight)
    assert.equal(row.evidence,stored.evidence || 'Not documented.')
  }
  assert.ok(profile.data_quality.interpretations_inferences.includes('RIASEC-R'))
  assert.match(example.historicalNote,/does not prove how each historical weight/);assert.match(example.historicalNote,/reviewer\/date and expert approval remain Not documented/)
})


test('documented relevance scale and tutorial steps are explicit without claiming historical approval',async()=>{
  assert.deepEqual(rubric.levels.map(level=>[level.label,level.value]),[['High',3],['Medium',2],['Low',1],['Not relevant',0]])
  assert.equal(rubric.source.pages,'2-3')
  const reference=await readFile(new URL('../../public'+rubric.source.url,import.meta.url),'utf8')
  assert.ok(reference.includes(rubric.source.title) && reference.includes(rubric.source.sha256))
  assert.match(reference,/HIGH = 3; MEDIUM = 2; LOW = 1; NOT_RELEVANT = 0/)
  assert.match(reference,/leave unsupported skill domains unselected/)
  for(const tutorial of example.tutorials){
    const recorded=example.rows.find(row=>row.group===tutorial.group&&row.dimension===tutorial.dimension)
    assert.ok(recorded)
    assert.ok(tutorial.page && tutorial.section && (tutorial.passage || tutorial.sourceSummary))
    assert.ok(tutorial.relationship && tutorial.application.startsWith('Illustratively,'))
    assert.ok(rubric.levels.some(level=>level.value===tutorial.rubricValue))
    assert.equal(recorded.weight,tutorial.rubricValue)
  }
})
