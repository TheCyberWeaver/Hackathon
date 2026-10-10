import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

test('student client relies on proxy identity for every request', async (t) => {
  const source = await readFile(
    new URL('../src/student/lib/studentApi.ts', import.meta.url),
    'utf8',
  )
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  })
  const api = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  )
  const storageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  )
  let storageReads = 0
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key) {
        storageReads++
        assert.equal(key, 'askpool-student-id')
        return 'standalone-browser-id'
      },
      setItem() {
        assert.fail('Integrated login must not create a browser identity')
      },
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

  await api.listQuestions()
  await api.submitQuestion('A question')
  await api.setVote('question-1', true)
  await api.reportQuestion('question-1')
  assert.equal(storageReads, 0)
  assert.equal(requests.length, 4)
  for (const { init } of requests) {
    const headers = new Headers(init.headers)
    assert.equal(headers.has('X-Student-Id'), false)
    assert.equal(headers.has('X-User-Id'), false)
    assert.equal(headers.has('X-User-Name'), false)
    assert.equal(init.credentials, 'same-origin')
  }
})

test('join links and typed codes resolve to the same session code', async () => {
  const source = await readFile(
    new URL('../src/lib/sessions.ts', import.meta.url),
    'utf8',
  )
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  })
  const api = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  )
  assert.equal(api.parseJoinCode('abcd2345'), 'ABCD-2345')
  assert.equal(api.parseJoinCode('abcd-2345'), 'ABCD-2345')
  assert.equal(
    api.parseJoinCode('https://example.org/student/join?code=ABCD-2345'),
    'ABCD-2345',
  )
  assert.equal(
    api.parseJoinCode('https://example.org/other?code=ABCD-2345'),
    null,
  )
  assert.equal(api.parseJoinCode('ABCI-2345'), null)
})

test('integrated student API uses proxy identity for ownership and votes', async () => {
  const reservation = createServer()
  reservation.listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise((resolve) => reservation.close(resolve))
  const dataDirectory = await mkdtemp(join(tmpdir(), 'askpool-api-test-'))
  const server = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL('../server/student-api/index.mjs', import.meta.url),
      ),
    ],
    {
      env: {
        ...process.env,
        PORT: String(port),
        ASKPOOL_DATA_DIR: dataDirectory,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const exited = once(server, 'exit')
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Student API failed to start')),
        5000,
      )
      server.once('error', reject)
      server.stdout.once('data', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
    const url = `http://127.0.0.1:${port}/api/questions`
    const spoofed = await fetch(url, {
      headers: { 'X-Student-Id': 'browser-id' },
    })
    assert.equal(spoofed.status, 401)
    const headers = {
      'X-User-Id': 'student-one@ethz.ch',
      'X-Student-Id': 'ignored-browser-id',
      'Content-Type': 'application/json',
    }
    const submitted = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'Integration question' }),
    })
    assert.equal(submitted.status, 201)
    const question = await submitted.json()
    assert.equal(question.mine, true)
    const own = await (await fetch(url, { headers })).json()
    assert.equal(own.find((item) => item.id === question.id).mine, true)
    const otherHeaders = { ...headers, 'X-User-Id': 'student-two@ethz.ch' }
    const other = await (await fetch(url, { headers: otherHeaders })).json()
    assert.equal(other.find((item) => item.id === question.id).mine, false)
    const selfVote = await fetch(`${url}/${question.id}/vote`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ voted: true }),
    })
    assert.equal(selfVote.status, 403)
    for (let i = 0; i < 2; i++) {
      const voted = await fetch(`${url}/${question.id}/vote`, {
        method: 'POST',
        headers: otherHeaders,
        body: JSON.stringify({ voted: true }),
      })
      assert.equal(voted.status, 200)
      assert.equal((await voted.json()).votes, 1)
    }
    const statePath = join(dataDirectory, 'state.json')
    const state = JSON.parse(await readFile(statePath, 'utf8'))
    const older = state.questions.find((item) => item.id === 'q-recording')
    older.status = 'open'
    older.votes = 0
    older.createdAt = new Date(Date.now() - 60 * 60_000).toISOString()
    await writeFile(statePath, JSON.stringify(state))
    const ranked = await (await fetch(url, { headers })).json()
    assert.ok(
      ranked.findIndex((item) => item.id === question.id) <
        ranked.findIndex((item) => item.id === older.id),
      'one upvote must outrank an older question with no upvotes',
    )
  } finally {
    server.kill()
    await exited
    // Remove only this test's fresh temporary directory.
    assert.ok(dataDirectory.startsWith(join(tmpdir(), 'askpool-api-test-')))
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

test('lecture join codes connect students and expire when the lecture ends', async () => {
  const reservation = createServer()
  reservation.listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise((resolve) => reservation.close(resolve))
  const dataDirectory = await mkdtemp(join(tmpdir(), 'askpool-session-test-'))
  const server = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL('../server/student-api/index.mjs', import.meta.url),
      ),
    ],
    {
      env: {
        ...process.env,
        PORT: String(port),
        ASKPOOL_DATA_DIR: dataDirectory,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const exited = once(server, 'exit')
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Session API failed to start')),
        5000,
      )
      server.once('error', reject)
      server.stdout.once('data', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
    const url = `http://127.0.0.1:${port}/api/sessions`
    const professorHeaders = {
      'X-User-Id': 'professor@ethz.ch',
      'Content-Type': 'application/json',
    }
    const studentHeaders = {
      'X-User-Id': 'student@ethz.ch',
      'Content-Type': 'application/json',
    }
    assert.equal((await fetch(url)).status, 401)
    const createdResponse = await fetch(url, {
      method: 'POST',
      headers: professorHeaders,
      body: JSON.stringify({ course: 'Applied Statistics' }),
    })
    assert.equal(createdResponse.status, 201)
    const created = await createdResponse.json()
    assert.match(created.code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    assert.equal(created.course, 'Applied Statistics')
    assert.equal(
      (await fetch(`${url}/active`, { headers: professorHeaders })).status,
      200,
    )
    assert.equal(
      await (await fetch(`${url}/active`, { headers: studentHeaders })).json(),
      null,
    )
    assert.equal(
      (
        await fetch(`${url}/active`, {
          method: 'DELETE',
          headers: studentHeaders,
        })
      ).status,
      404,
    )
    const invalidJoin = await fetch(`${url}/join`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({ code: 'WRONG-999' }),
    })
    assert.equal(invalidJoin.status, 404)
    const joinedResponse = await fetch(`${url}/join`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        code: created.code.toLowerCase().replace('-', ''),
      }),
    })
    assert.equal(joinedResponse.status, 200)
    assert.equal((await joinedResponse.json()).id, created.id)
    const mine = await (
      await fetch(`${url}/mine`, { headers: studentHeaders })
    ).json()
    assert.equal(mine.code, created.code)
    const left = await fetch(`${url}/mine`, {
      method: 'DELETE',
      headers: studentHeaders,
    })
    assert.equal(left.status, 204)
    assert.equal(
      await (await fetch(`${url}/mine`, { headers: studentHeaders })).json(),
      null,
    )
    const rejoined = await fetch(`${url}/join`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({ code: created.code }),
    })
    assert.equal(rejoined.status, 200)
    const ended = await fetch(`${url}/active`, {
      method: 'DELETE',
      headers: professorHeaders,
    })
    assert.equal(ended.status, 204)
    assert.equal(
      await (await fetch(`${url}/mine`, { headers: studentHeaders })).json(),
      null,
    )
    const expired = await fetch(`${url}/join`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({ code: created.code }),
    })
    assert.equal(expired.status, 404)
  } finally {
    server.kill()
    await exited
    assert.ok(dataDirectory.startsWith(join(tmpdir(), 'askpool-session-test-')))
    await rm(dataDirectory, { recursive: true, force: true })
  }
})
