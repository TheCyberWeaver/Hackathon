import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadSource } from './load-source.mjs'
const { default: CourseChooser } = await loadSource(
  '../src/professor/CourseChooser.tsx',
)
const render = (courses, overrides = {}) =>
  renderToStaticMarkup(
    createElement(CourseChooser, {
      courses,
      busy: false,
      error: '',
      onChoose() {},
      onCancel() {},
      onSaveCourses() {},
      ...overrides,
    }),
  )

test('chooser retains persisted order and provides empty-list creation with no automatic session start', () => {
  const html = render([
    { id: 'b', title: 'Algorithms' },
    { id: 'a', title: 'Algebra' },
  ])
  assert.ok(html.indexOf('Algorithms') < html.indexOf('Algebra'))
  assert.match(html, /Add course/)
  assert.match(html, /<button[^>]+disabled=""[^>]*>Start session/)
  assert.doesNotMatch(html, /courses you added during setup/)
  assert.match(render([]), /Add your first course/)
  assert.match(render([], { error: 'Failed to save' }), /role="alert"/)
})
