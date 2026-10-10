import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

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
        new URL('../student-frontend/server/index.mjs', import.meta.url),
      ),
    ],
    {
      env: {
        ...process.env,
        PORT: String(port),
        ASKPOOL_REQUIRE_USER_ID: 'true',
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
  } finally {
    server.kill()
    await exited
    // Remove only this test's fresh temporary directory.
    assert.ok(dataDirectory.startsWith(join(tmpdir(), 'askpool-api-test-')))
    await rm(dataDirectory, { recursive: true, force: true })
  }
})
