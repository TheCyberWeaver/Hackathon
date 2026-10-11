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

test('chooser starts with one course field and no separate add form', () => {
  const html = render([
    { id: 'b', title: 'Algorithms' },
    { id: 'a', title: 'Algebra' },
  ])
  assert.match(html, /aria-haspopup="menu"/)
  assert.match(html, /Select a course/)
  assert.doesNotMatch(html, /Add course|Course title|<select/)
  assert.match(html, /<button[^>]+disabled=""[^>]*>Start session/)
  assert.match(render([]), /Select a course/)
  assert.match(render([], { error: 'Failed to save' }), /role="alert"/)
})
