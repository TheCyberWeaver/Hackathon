const storagePrefix = 'askpool:active-lecture:'

export type LectureSession = {
  startedAt: string
  course: string | null
  code: string | null
  id: string | null
}

function storageKey(userId: string) {
  return `${storagePrefix}${encodeURIComponent(userId)}`
}

export function readLectureSession(userId: string): LectureSession | null {
  try {
    const stored = window.localStorage.getItem(storageKey(userId))
    if (!stored) return null

    try {
      const parsed: unknown = JSON.parse(stored)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'startedAt' in parsed &&
        typeof parsed.startedAt === 'string' &&
        Number.isFinite(Date.parse(parsed.startedAt)) &&
        'course' in parsed &&
        (parsed.course === null ||
          (typeof parsed.course === 'string' && parsed.course.trim()))
      ) {
        const course = parsed.course
        return {
          startedAt: parsed.startedAt,
          course: typeof course === 'string' ? course.trim() : null,
          code:
            'code' in parsed && typeof parsed.code === 'string'
              ? parsed.code
              : null,
          id:
            'id' in parsed && typeof parsed.id === 'string' ? parsed.id : null,
        }
      }
    } catch {
      // Older demo sessions stored only an ISO timestamp.
    }

    if (Number.isFinite(Date.parse(stored))) {
      return { startedAt: stored, course: null, code: null, id: null }
    }
    return null
  } catch {
    return null
  }
}

export function saveLectureSession(
  userId: string,
  session: LectureSession,
): boolean {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(session))
    return true
  } catch {
    return false
  }
}

export function clearLectureSession(userId: string): boolean {
  try {
    window.localStorage.removeItem(storageKey(userId))
    return true
  } catch {
    return false
  }
}
