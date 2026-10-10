// Playwright global setup: fresh local PostgreSQL, Java and Vite, with explicit teardown.
import { spawn, spawnSync } from 'node:child_process'
import { readFile, mkdir, mkdtemp } from 'node:fs/promises'
import { openSync, closeSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import path from 'node:path'
const frontend = fileURLToPath(new URL('..', import.meta.url))
const backend = path.resolve(frontend, '../backend')
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function requireFreePort(port) {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, () => server.close(resolve))
  })
}
export default async function setup() {
  await requireFreePort(5186)
  await requireFreePort(8086)
  const classpath = await readFile(
    path.join(backend, 'build/local/classpath.txt'),
    'utf8',
  )
  await mkdir(path.join(backend, 'build/e2e'), { recursive: true })
  const data = await mkdtemp(path.join(backend, 'build/e2e/run-'))
  const java = process.env.JAVA_HOME
    ? path.join(
        process.env.JAVA_HOME,
        'bin',
        process.platform === 'win32' ? 'java.exe' : 'java',
      )
    : 'java'
  const log = openSync(path.join(data, 'backend.log'), 'a')
  const backendProcess = spawn(
    java,
    [
      '-cp',
      classpath,
      'com.example.backend.dev.E2eApplication',
      path.join(data, 'postgres'),
    ],
    { cwd: backend, windowsHide: true, stdio: ['pipe', log, log] },
  )
  let vite
  let processError
  backendProcess.on('error', (error) => {
    processError = error
  })
  async function stop() {
    // Closing this pipe also cleans up when the parent exits unexpectedly on Windows.
    backendProcess.stdin.end()
    for (
      let attempt = 0;
      attempt < 100 && backendProcess.exitCode === null && !processError;
      attempt++
    )
      await delay(100)
    if (vite && vite.exitCode === null) {
      if (process.platform === 'win32')
        spawnSync('taskkill', ['/PID', String(vite.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        })
      else vite.kill('SIGTERM')
    }
    closeSync(log)
    if (backendProcess.exitCode === null && !processError)
      throw new Error(`Test backend did not shut down: ${data}/backend.log`)
  }
  async function waitFor(url) {
    for (let attempt = 0; attempt < 160; attempt++) {
      if (processError) throw processError
      if (backendProcess.exitCode !== null)
        throw new Error(`Test backend exited: ${data}/backend.log`)
      try {
        if ((await fetch(url, { headers: { 'X-User-Id': 'e2e-health' } })).ok)
          return
      } catch {
        /* startup */
      }
      await delay(500)
    }
    throw new Error(`Test server did not start: ${data}/backend.log`)
  }
  try {
    await waitFor('http://127.0.0.1:8086/api/me')
    vite = spawn(
      process.execPath,
      [
        'node_modules/vite/bin/vite.js',
        '--host',
        '127.0.0.1',
        '--port',
        '5186',
        '--strictPort',
      ],
      {
        cwd: frontend,
        windowsHide: true,
        env: {
          ...process.env,
          ASKPOOL_DEMO_AUTH: 'false',
          ASKPOOL_BACKEND_URL: 'http://127.0.0.1:8086',
          VITE_API_BASE_URL: '/',
        },
        stdio: 'ignore',
      },
    )
    vite.on('error', (error) => {
      processError = error
    })
    await waitFor('http://127.0.0.1:5186/api/me')
    return stop
  } catch (error) {
    await stop()
    throw error
  }
}
