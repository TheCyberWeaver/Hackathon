const storagePrefix = 'askpool:student-tutorial-completed:'
const dismissedStoragePrefix = 'askpool:student-tutorial-dismissed:'

function storageKey(userId: string) {
  return `${storagePrefix}${encodeURIComponent(userId)}`
}

export function readTutorialCompleted(userId: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(userId)) === 'true'
  } catch {
    return false
  }
}

export function saveTutorialCompleted(userId: string) {
  try {
    window.localStorage.setItem(storageKey(userId), 'true')
  } catch {
    // The prompt still disappears for this visit when storage is unavailable.
  }
}

export function readTutorialDismissed(userId: string): boolean {
  try {
    return (
      window.localStorage.getItem(
        `${dismissedStoragePrefix}${encodeURIComponent(userId)}`,
      ) === 'true'
    )
  } catch {
    return false
  }
}

export function saveTutorialDismissed(userId: string) {
  try {
    window.localStorage.setItem(
      `${dismissedStoragePrefix}${encodeURIComponent(userId)}`,
      'true',
    )
  } catch {
    // The prompt still disappears for this visit when storage is unavailable.
  }
}
