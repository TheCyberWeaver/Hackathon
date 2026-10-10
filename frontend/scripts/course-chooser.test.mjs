import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

async function loadModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  })
  const resolved = outputText.replace(
    /(['"])(react(?:\/jsx-runtime)?)\1/g,
    (_, _quote, name) => JSON.stringify(import.meta.resolve(name)),
  )
  return import(
    `data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`
  )
}

const { default: CourseChooser } = await loadModule(
  '../src/professor/CourseChooser.tsx',
)
const { readProfessorProfile, saveProfessorProfile } = await loadModule(
  '../src/professor/professorProfile.ts',
)

function render(courses, overrides = {}) {
  return renderToStaticMarkup(
    createElement(CourseChooser, {
      courses,
      busy: false,
      error: '',
      onChoose() {},
      onCancel() {},
      ...overrides,
    }),
  )
}

function options(markup) {
  return Array.from(
    markup.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g),
    ([, id, title]) => ({ id, title }),
  )
}

test('course dropdown uses the signed-in professor onboarding output, IDs and order', (t) => {
  const values = new Map()
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  t.after(() => {
    if (previousWindow)
      Object.defineProperty(globalThis, 'window', previousWindow)
    else delete globalThis.window
  })
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  }
  saveProfessorProfile('professor-a', [
    { id: 'stats', title: ' HS26 Statistics ' },
    { id: 'algebra', title: 'HS26 Algebra' },
  ])
  saveProfessorProfile('professor-b', [
    { id: 'other', title: 'Another professor course' },
  ])
  const saved = readProfessorProfile('professor-a')
  const markup = render(saved.courses)
  assert.deepEqual(options(markup), saved.courses)
  assert.doesNotMatch(
    markup,
    /Applied Statistics|Machine Learning Foundations|Another professor course|Another course…/,
  )
  // Renaming and reordering retain the IDs; a reload supplies the updated list.
  const updated = [
    { id: 'algebra', title: 'HS26 Linear Algebra' },
    { id: 'stats', title: 'HS26 Statistics' },
  ]
  saveProfessorProfile('professor-a', updated)
  assert.deepEqual(
    options(render(readProfessorProfile('professor-a').courses)),
    updated,
  )
  assert.deepEqual(
    options(render(readProfessorProfile('professor-b').courses)),
    [{ id: 'other', title: 'Another professor course' }],
  )
})

test('selection is required; empty and busy states cannot start a lecture', () => {
  const courses = [{ id: 'algebra', title: 'HS26 Algebra' }]
  assert.match(render(courses), /<button type="submit" disabled=""/)
  const empty = render([])
  assert.deepEqual(options(empty), [])
  assert.match(empty, /<select[^>]+disabled=""/)
  assert.match(empty, /Complete course setup before starting a session/)
  const busy = render(courses, { busy: true })
  assert.match(busy, /<select[^>]+disabled=""/)
  assert.match(busy, /<button type="submit" disabled=""/)
  assert.match(busy, /Please wait…/)
  assert.match(
    render(courses, { error: 'Could not start this lecture.' }),
    /role="alert"[^>]*>Could not start this lecture\./,
  )
})
