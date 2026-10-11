import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadSource } from './load-source.mjs'

const { formatElapsedTime } = await loadSource(
  '../src/professor/sessionTime.ts',
)
const start = '2026-10-11T10:00:00Z'
const now = Date.parse(start)

test('elapsed time formats seconds, minutes, hours, and durations beyond a day', () => {
  for (const [seconds, expected] of [
    [0, '00:00'],
    [9, '00:09'],
    [60, '01:00'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3661, '1:01:01'],
    [90061, '25:01:01'],
  ])
    assert.equal(formatElapsedTime(start, now + seconds * 1000), expected)
})

test('elapsed time uses persisted timestamp and handles timezones, clock skew, and invalid input', () => {
  assert.equal(
    formatElapsedTime('2026-10-11T12:00:00+02:00', now + 65_900),
    '01:05',
  )
  assert.equal(formatElapsedTime(start, now - 3000), '00:00')
  assert.equal(formatElapsedTime('invalid', now), '—')
  assert.equal(formatElapsedTime(start, NaN), '—')
})
