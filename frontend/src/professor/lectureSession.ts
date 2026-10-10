const storagePrefix = 'askpool:active-lecture:'

function storageKey(userId: string) {
  return `${storagePrefix}${encodeURIComponent(userId)}`
}

export function readLectureStart(userId: string): string | null {
  try {
    const startedAt = window.localStorage.getItem(storageKey(userId))
    if (!startedAt || !Number.isFinite(Date.parse(startedAt))) return null
    return startedAt
  } catch {
    return null
  }
}

export function saveLectureStart(userId: string, startedAt: string): boolean {
  try {
    window.localStorage.setItem(storageKey(userId), startedAt)
    return true
  } catch {
    return false
  }
}

export function clearLectureStart(userId: string): boolean {
  try {
    window.localStorage.removeItem(storageKey(userId))
    return true
  } catch {
    return false
  }
}
