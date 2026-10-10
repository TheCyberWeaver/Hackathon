import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
}

async function clients(baseUrl = '') {
  const transport = await readFile(
    new URL('../src/lib/poolApi.ts', import.meta.url),
    'utf8',
  )
  const transportUrl = moduleUrl(
    transport.replace(
      'import.meta.env',
      JSON.stringify({ VITE_API_BASE_URL: baseUrl }),
    ),
  )
  const load = async (path, importPath) => {
    const source = await readFile(new URL(path, import.meta.url), 'utf8')
    return import(
      moduleUrl(source.replace(`'${importPath}'`, JSON.stringify(transportUrl)))
    )
  }
  return {
    pool: await import(transportUrl),
    student: await load(
      '../src/student/lib/studentApi.ts',
      '../../lib/poolApi',
    ),
    professor: await load('../src/professor/professorApi.ts', '../lib/poolApi'),
  }
}

test('Java API clients use lecture routes and proxy identity without browser identity', async (t) => {
  const api = await clients()
  const storageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  )
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      assert.fail('API clients must not use browser storage for identity')
    },
  })
  t.after(() => {
    if (storageDescriptor)
      Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
    else delete globalThis.localStorage
  })
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests.push({ url, init })
    return new Response(JSON.stringify({}), { status: 200 })
  })
  await api.pool.listLectures()
  await api.pool.createLecture('Algorithms', '2026-10-10T10:00:00Z')
  await api.student.listQuestions('123')
  await api.student.submitQuestion('123', 'A question')
  await api.student.setVote('42', true)
  await api.student.reportQuestion('42')
  await api.professor.listProfessorQuestions('123')
  await api.professor.changeQuestionStatus('42', 'answered')
  await api.professor.deleteQuestion('42')
  assert.deepEqual(
    requests.map(({ url, init }) => [init.method ?? 'GET', url]),
    [
      ['GET', '/api/lectures'],
      ['POST', '/api/lectures'],
      ['GET', '/api/lectures/123/questions'],
      ['POST', '/api/lectures/123/questions'],
      ['POST', '/api/questions/42/vote'],
      ['POST', '/api/questions/42/report'],
      ['GET', '/api/lectures/123/professor/questions'],
      ['PATCH', '/api/questions/42/status'],
      ['DELETE', '/api/questions/42'],
    ],
  )
  assert.deepEqual(JSON.parse(requests[3].init.body), { text: 'A question' })
  assert.deepEqual(JSON.parse(requests[4].init.body), { voted: true })
  assert.deepEqual(JSON.parse(requests[7].init.body), { status: 'answered' })
  for (const { init } of requests) {
    const headers = new Headers(init.headers)
    for (const header of [
      'X-Student-Id',
      'X-User-Id',
      'X-User-Name',
      'Authorization',
    ]) {
      assert.equal(headers.has(header), false)
    }
    assert.equal(init.credentials, 'same-origin')
    if (init.body) assert.equal(headers.get('Content-Type'), 'application/json')
  }
})

test('shared transport handles no-content responses and useful API errors', async (t) => {
  const api = await clients()
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: 204 }),
  )
  assert.equal(await api.student.reportQuestion('42'), undefined)
  assert.equal(await api.professor.deleteQuestion('42'), undefined)
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({ error: 'You may submit one question per lecture.' }),
        { status: 409 },
      ),
  )
  await assert.rejects(
    api.student.submitQuestion('123', 'Another question'),
    /one question per lecture/,
  )
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('Proxy unavailable', { status: 502 }),
  )
  await assert.rejects(api.pool.listLectures(), /Request failed \(502\)/)
})

test('shared transport honors base URL and encodes route identifiers', async (t) => {
  const api = await clients('https://example.test/')
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(
      url,
      'https://example.test/api/lectures/lecture%2Fid/questions',
    )
    return new Response('[]', { status: 200 })
  })
  assert.deepEqual(await api.student.listQuestions('lecture/id'), [])
})
