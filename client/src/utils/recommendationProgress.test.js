import test from 'node:test'
import assert from 'node:assert/strict'
import { readRecommendationResponse } from './recommendationProgress.js'

function streamResponse(chunks) {
  return new Response(new ReadableStream({ start(controller) {
    for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
    controller.close()
  } }), { headers: { 'Content-Type': 'text/event-stream' } })
}

test('reads real milestones across split network chunks before the final result', async () => {
  const progress = []
  const result = await readRecommendationResponse(streamResponse([
    'event: pro', 'gress\ndata: {"completed":1,"label":"Finding courses"}\n',
    '\nevent: progress\ndata: {"completed":4,"label":"Overview"}\n\n',
    'event: result\ndata: {"recommendations":[{"course_id":1}]}\n\n',
  ]), item => progress.push(item.completed))
  assert.deepEqual(progress, [1, 4])
  assert.deepEqual(result, { status: 200, data: { recommendations: [{ course_id: 1 }] } })
})

test('reports server errors and rejects interrupted streams instead of declaring completion', async () => {
  const error = await readRecommendationResponse(streamResponse(['event: error\ndata: {"status":400,"message":"Complete your assessment"}\n\n']), () => {})
  assert.equal(error.status, 400)
  assert.equal(error.data.message, 'Complete your assessment')
  await assert.rejects(readRecommendationResponse(streamResponse(['event: progress\ndata: {"completed":2}\n\n']), () => {}), /before results were ready/)
})

test('keeps ordinary JSON responses and authentication failures compatible', async () => {
  const result = await readRecommendationResponse(Response.json({ message: 'Sign in' }, { status: 401 }), () => assert.fail('No progress in JSON response'))
  assert.deepEqual(result, { status: 401, data: { message: 'Sign in' } })
})
