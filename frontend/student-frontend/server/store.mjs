import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  existsSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'

const seedPath = fileURLToPath(new URL('./seed.json', import.meta.url))
const statePath = fileURLToPath(new URL('./data/state.json', import.meta.url))

export function resetState() {
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'))
  const now = Date.now()
  const state = {
    questions: seed.map(({ ageMinutes, ...question }) => ({
      ...question,
      createdAt: new Date(now - ageMinutes * 60_000).toISOString(),
      voterIds: [],
      ownerId: null,
    })),
    reports: [],
  }
  saveState(state)
  return state
}

export function readState() {
  return existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, 'utf8'))
    : resetState()
}

export function saveState(state) {
  mkdirSync(fileURLToPath(new URL('./data/', import.meta.url)), {
    recursive: true,
  })
  writeFileSync(`${statePath}.tmp`, JSON.stringify(state, null, 2))
  renameSync(`${statePath}.tmp`, statePath)
}
