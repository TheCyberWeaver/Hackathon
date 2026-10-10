import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const vite = fileURLToPath(
  new URL('../node_modules/vite/bin/vite.js', import.meta.url),
)
const preview = process.argv.includes('--preview')
const children = [
  spawn(
    process.execPath,
    [
      vite,
      ...(preview ? ['preview'] : []),
      ...process.argv.slice(2).filter((arg) => arg !== '--preview'),
    ],
    {
      cwd: root,
      stdio: 'inherit',
    },
  ),
]

let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill()
  process.exitCode = code
}
for (const child of children) {
  child.on('error', (error) => {
    console.error(error)
    stop(1)
  })
  child.on('exit', (code) => stop(code || 0))
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
