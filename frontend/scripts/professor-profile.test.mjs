import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadSource } from './load-source.mjs'
const {
  readProfessorProfile,
  prepareProfessorCourses,
  courseTitleError,
  professorProfileStorageKey,
} = await loadSource('../src/professor/professorProfile.ts')
const { loadProfessorProfile, saveProfessorProfile } = await loadSource(
  '../src/professor/profileApi.ts',
)

test('legacy import is account scoped and validated; persistent API is authoritative', async (t) => {
  const values = new Map()
  globalThis.window = {
    localStorage: { getItem: (key) => values.get(key) ?? null },
  }
  t.after(() => {
    delete globalThis.window
  })
  const legacy = {
    schemaVersion: 1,
    professorId: 'alice',
    onboardingCompleted: true,
    courses: [{ id: 'a', title: 'Algebra' }],
  }
  values.set(professorProfileStorageKey('alice'), JSON.stringify(legacy))
  assert.deepEqual(readProfessorProfile('alice'), legacy)
  assert.equal(readProfessorProfile('bob'), null)
  const persisted = { revision: 3, onboardingCompleted: true, courses: [] }
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests.push([url, JSON.parse(init.body)])
    return new Response(JSON.stringify(persisted))
  })
  assert.deepEqual(await loadProfessorProfile('alice'), persisted)
  assert.deepEqual(requests[0][1].courses, legacy.courses)
  await saveProfessorProfile(persisted, [], true)
  assert.deepEqual(requests[1], ['/api/professor/profile', persisted])
  values.set(
    professorProfileStorageKey('alice'),
    JSON.stringify({ ...legacy, courses: [{ id: 'x', title: ' ' }] }),
  )
  assert.equal(readProfessorProfile('alice'), null)
})

test('course rules and pending Done draft preserve titles, IDs and order', () => {
  const courses = [{ id: 'a', title: 'Algebra' }]
  assert.equal(
    courseTitleError(courses, ' ALGEBRA '),
    'This course is already on your list.',
  )
  assert.equal(courseTitleError(courses, ' algebra ', 'a'), '')
  assert.ok(courseTitleError(courses, ' '))
  assert.ok(courseTitleError(courses, 'x'.repeat(121)))
  assert.equal(courseTitleError(courses, 'x'.repeat(120)), '')
  const result = prepareProfessorCourses(courses, ' Algorithms ')
  assert.equal(result.ok, true)
  assert.deepEqual(result.courses[0], courses[0])
  assert.equal(result.courses[1].title, 'Algorithms')
  assert.deepEqual(courses, [{ id: 'a', title: 'Algebra' }])
  assert.equal(prepareProfessorCourses([], '').ok, false)
})

test('profile API errors stay errors instead of appearing as new/empty accounts', async (t) => {
  globalThis.window = { localStorage: { getItem: () => null } }
  t.after(() => {
    delete globalThis.window
  })
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify({ error: 'Database unavailable' }), {
        status: 503,
      }),
  )
  await assert.rejects(loadProfessorProfile('alice'), /Database unavailable/)
  await assert.rejects(
    saveProfessorProfile(
      { revision: 1, onboardingCompleted: true, courses: [] },
      [],
    ),
    /Database unavailable/,
  )
})
