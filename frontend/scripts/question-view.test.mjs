import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadSource } from './load-source.mjs'
const { filterOpenQuestions, sortQuestions } = await loadSource(
  '../src/professor/questionView.ts',
)
const now = Date.parse('2026-10-10T12:00:00Z')
const question = (id, minutes, upvoteCount, answered = false) => ({
  id,
  createdAt: new Date(now - minutes * 60_000).toISOString(),
  upvoteCount,
  answered,
})

test('time windows age by submission time independently of votes and status changes', () => {
  const old = question('1', 6, 50)
  const fresh = question('2', 4, 1)
  const answered = question('3', 1, 100, true)
  assert.deepEqual(
    filterOpenQuestions([old, fresh, answered], 5, now).map((q) => q.id),
    ['2'],
  )
  assert.deepEqual(
    filterOpenQuestions([old, fresh], 0, now).map((q) => q.id),
    ['1', '2'],
  )
  assert.equal(filterOpenQuestions([fresh], 5, now + 61_000).length, 0)
  assert.equal(
    filterOpenQuestions([{ ...old, upvoteCount: 1000 }], 5, now).length,
    0,
  )
  assert.equal(
    filterOpenQuestions([{ ...old, answered: false }], 5, now).length,
    0,
  )
})
test('votes rank highest first, then oldest and stable ID for exact ties', () => {
  const questions = [
    question('10', 3, 2),
    question('2', 3, 2),
    question('3', 4, 2),
    question('4', 1, 3),
  ]
  assert.deepEqual(
    sortQuestions(questions).map((q) => q.id),
    ['4', '3', '2', '10'],
  )
  assert.deepEqual(
    questions.map((q) => q.id),
    ['10', '2', '3', '4'],
  )
})
