const storageKey = 'askpool:demo-question-intake-paused'
const changeEvent = 'askpool:question-intake-changed'

export function readQuestionIntakePaused(): boolean {
  try {
    return window.localStorage.getItem(storageKey) === 'true'
  } catch {
    return false
  }
}

export function saveQuestionIntakePaused(paused: boolean): boolean {
  try {
    if (paused) window.localStorage.setItem(storageKey, 'true')
    else window.localStorage.removeItem(storageKey)
    window.dispatchEvent(new Event(changeEvent))
    return true
  } catch {
    return false
  }
}

export function subscribeQuestionIntakePaused(
  onChange: (paused: boolean) => void,
) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      onChange(readQuestionIntakePaused())
    }
  }
  const handleChange = () => onChange(readQuestionIntakePaused())
  window.addEventListener('storage', handleStorage)
  window.addEventListener(changeEvent, handleChange)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(changeEvent, handleChange)
  }
}
