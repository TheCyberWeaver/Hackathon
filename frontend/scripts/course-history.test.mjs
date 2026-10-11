import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadSource } from './load-source.mjs'
const { historyCourses, filterSessions, localDate } = await loadSource(
  '../src/lib/courseHistory.ts',
)
const session = (id, date, extra = {}) => ({
  id,
  title: 'Snapshot',
  course: 'Snapshot',
  courseKey: '1:a',
  courseName: 'Algebra',
  startedAt: date,
  lectureTime: date,
  endedAt: '2026-10-11T18:00:00Z',
  ...extra,
})
test('group by identity, preserve order, exclude live sessions, and distinguish legacy and repeated labels', () => {
  const lectures = [
    session('1', '', {}),
    session('2', '', { courseKey: '2:a' }),
    session('3', '', { courseKey: null }),
    session('4', '', { courseKey: null }),
    session('5', '', { endedAt: null }),
  ]
  const student = historyCourses(lectures)
  assert.equal(student.length, 4)
  assert.equal(student[0].lectures.length, 1)
  assert.ok(student[0].context)
  const configured = [
    { id: 'empty', historyKey: '1:empty', title: 'Zero' },
    { id: 'a', historyKey: '1:a', title: 'Renamed' },
  ]
  const professor = historyCourses(lectures.slice(0, 1), configured)
  assert.deepEqual(
    professor.map((c) => [c.title, c.lectures.length]),
    [
      ['Zero', 0],
      ['Renamed', 1],
    ],
  )
  assert.equal(historyCourses([]).length, 0)
})
test('local calendar windows include both boundaries, exclude tomorrow, combine sort, and use timestamp fallback', () => {
  const today = new Date(2026, 9, 11, 12)
  const stamp = (day, hour = 10) => new Date(2026, 9, day, hour).toISOString()
  const lectures = [
    session('today', stamp(11)),
    session('first', stamp(5)),
    session('outside', stamp(4)),
    session('tomorrow', stamp(12)),
    session('fallback', null, { lectureTime: stamp(5, 8) }),
  ]
  const filters = { order: 'newest', dates: '7', from: '', to: '' }
  assert.deepEqual(
    filterSessions(lectures, filters, today).map((l) => l.id),
    ['today', 'first', 'fallback'],
  )
  assert.deepEqual(
    filterSessions(lectures, { ...filters, order: 'oldest' }, today).map(
      (l) => l.id,
    ),
    ['fallback', 'first', 'today'],
  )
  assert.deepEqual(
    filterSessions(
      lectures,
      { ...filters, dates: 'custom', from: '2026-10-05', to: '2026-10-05' },
      today,
    ).map((l) => l.id),
    ['first', 'fallback'],
  )
  assert.equal(
    filterSessions(
      lectures,
      { ...filters, dates: 'custom', from: '2026-10-12', to: '2026-10-05' },
      today,
    ).length,
    0,
  )
  assert.equal(
    filterSessions(lectures, { ...filters, dates: '30' }, today).length,
    4,
  )
  assert.equal(localDate(today), '2026-10-11')
})
test('equal timestamps remain stable and sorting never mutates the source', () => {
  const lectures = [
    session('b', '2026-10-11T10:00:00Z'),
    session('a', '2026-10-11T10:00:00Z'),
  ]
  for (const order of ['newest', 'oldest'])
    assert.deepEqual(
      filterSessions(lectures, { order, dates: 'all', from: '', to: '' }).map(
        (l) => l.id,
      ),
      ['a', 'b'],
    )
  assert.equal(lectures[0].id, 'b')
})
