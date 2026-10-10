import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(
  new URL('../src/professor/professorProfile.ts', import.meta.url),
  'utf8',
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
})
const {
  readProfessorProfile,
  resetProfessorProfile,
  saveProfessorProfile,
  serializeProfessorProfile,
  professorProfileStorageKey,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)

test('professor profile persistence contract', async (t) => {
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
      removeItem: (key) => values.delete(key),
    },
  }
  const courses = [
    { id: 'b', title: ' Algorithms ' },
    { id: 'a', title: 'Algebra' },
  ]

  await t.test(
    'save completion with stable IDs and visible order; isolate identities',
    () => {
      assert.equal(readProfessorProfile('professor-a'), null)
      assert.equal(saveProfessorProfile('professor-a', courses), true)
      assert.deepEqual(readProfessorProfile('professor-a'), {
        schemaVersion: 1,
        professorId: 'professor-a',
        onboardingCompleted: true,
        courses: [
          { id: 'b', title: 'Algorithms' },
          { id: 'a', title: 'Algebra' },
        ],
      })
      assert.equal(readProfessorProfile('professor-b'), null)
      assert.equal(courses[0].title, ' Algorithms ')
    },
  )

  await t.test(
    'invalid changes never overwrite a valid completed profile',
    () => {
      const previous = values.get(professorProfileStorageKey('professor-a'))
      for (const invalid of [
        [],
        [{ id: 'a', title: ' ' }],
        [
          { id: 'a', title: 'A' },
          { id: 'b', title: ' a ' },
        ],
        [
          { id: 'a', title: 'A' },
          { id: 'a', title: 'B' },
        ],
        [{ id: 'a', title: 'X'.repeat(121) }],
      ]) {
        assert.equal(saveProfessorProfile('professor-a', invalid), false)
        assert.equal(
          values.get(professorProfileStorageKey('professor-a')),
          previous,
        )
      }
      assert.equal(saveProfessorProfile('', courses), false)
    },
  )

  await t.test(
    'corrupt, incomplete, future-schema and wrong-account data do not bypass onboarding',
    () => {
      const valid = JSON.parse(
        serializeProfessorProfile('professor-a', courses),
      )
      for (const invalid of [
        'not json',
        JSON.stringify({ ...valid, onboardingCompleted: false }),
        JSON.stringify({ ...valid, schemaVersion: 2 }),
        JSON.stringify({ ...valid, professorId: 'another-account' }),
        JSON.stringify({ ...valid, courses: [null] }),
      ]) {
        values.set(professorProfileStorageKey('professor-a'), invalid)
        assert.equal(readProfessorProfile('professor-a'), null)
      }
    },
  )

  await t.test(
    'example file and profile serializer share the storage contract',
    async () => {
      const example = JSON.parse(
        await readFile(
          new URL(
            '../../docs/professor-onboarding-profile.example.json',
            import.meta.url,
          ),
          'utf8',
        ),
      )
      assert.deepEqual(
        JSON.parse(
          serializeProfessorProfile(example.professorId, example.courses),
        ),
        example,
      )
      assert.equal(
        saveProfessorProfile(example.professorId, example.courses),
        true,
      )
      assert.deepEqual(readProfessorProfile(example.professorId), example)
    },
  )

  await t.test(
    'reset clears only the active professor courses and completion',
    () => {
      saveProfessorProfile('professor-a', courses)
      saveProfessorProfile('professor-b', courses)
      values.set('unrelated-preference', 'keep')
      assert.equal(resetProfessorProfile('professor-a'), true)
      assert.equal(readProfessorProfile('professor-a'), null)
      assert.equal(readProfessorProfile('professor-b').courses.length, 2)
      assert.equal(values.get('unrelated-preference'), 'keep')
    },
  )

  await t.test('unavailable storage fails safely', () => {
    t.mock.method(window.localStorage, 'getItem', () => {
      throw new Error('blocked')
    })
    t.mock.method(window.localStorage, 'setItem', () => {
      throw new Error('full')
    })
    t.mock.method(window.localStorage, 'removeItem', () => {
      throw new Error('blocked')
    })
    assert.equal(readProfessorProfile('professor-a'), null)
    assert.equal(saveProfessorProfile('professor-a', courses), false)
    assert.equal(resetProfessorProfile('professor-a'), false)
  })
})
