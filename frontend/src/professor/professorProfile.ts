export type ProfessorCourse = { id: string; title: string; historyKey?: string }

export type ProfessorProfile = {
  schemaVersion: 1
  professorId: string
  onboardingCompleted: true
  courses: ProfessorCourse[]
}

export const professorProfileStoragePrefix = 'askpool:professor-onboarding:v1:'

export function professorProfileStorageKey(professorId: string) {
  return `${professorProfileStoragePrefix}${encodeURIComponent(professorId)}`
}

export function normalizedCourseTitle(title: string) {
  return title.trim().toLowerCase()
}

// Course IDs identify records, not secrets. Some mobile browsers and HTTP LAN
// previews do not expose randomUUID, even though getRandomValues is available.
export function newCourseId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues)
    globalThis.crypto.getRandomValues(bytes)
  else
    for (let index = 0; index < bytes.length; index++)
      bytes[index] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// Resolve the unsubmitted input before saving, without changing the existing list.
export function prepareProfessorCourses(
  courses: ProfessorCourse[],
  draft: string,
): { ok: true; courses: ProfessorCourse[] } | { ok: false; error: string } {
  const title = draft.trim()
  if (!title)
    return courses.length > 0
      ? { ok: true, courses }
      : { ok: false, error: 'Enter a course title first.' }
  if (title.length > 120)
    return {
      ok: false,
      error: 'Course titles must be 120 characters or fewer.',
    }
  if (
    courses.some(
      (course) =>
        normalizedCourseTitle(course.title) === normalizedCourseTitle(title),
    )
  )
    return { ok: false, error: 'This course is already on your list.' }
  return {
    ok: true,
    courses: [...courses, { id: newCourseId(), title }],
  }
}

function isValidCourses(value: unknown): value is ProfessorCourse[] {
  if (!Array.isArray(value)) return false
  const ids = new Set<string>()
  const titles = new Set<string>()
  for (const course of value) {
    if (
      typeof course !== 'object' ||
      course === null ||
      typeof course.id !== 'string' ||
      !course.id.trim() ||
      course.id.length > 200 ||
      typeof course.title !== 'string' ||
      !course.title.trim() ||
      course.title.trim().length > 120
    )
      return false
    const title = normalizedCourseTitle(course.title)
    if (ids.has(course.id) || titles.has(title)) return false
    ids.add(course.id)
    titles.add(title)
  }
  return true
}

export function readProfessorProfile(
  professorId: string,
): ProfessorProfile | null {
  try {
    const json = window.localStorage.getItem(
      professorProfileStorageKey(professorId),
    )
    if (!json) return null
    const value: unknown = JSON.parse(json)
    if (
      typeof value !== 'object' ||
      value === null ||
      !('schemaVersion' in value) ||
      value.schemaVersion !== 1 ||
      !('professorId' in value) ||
      value.professorId !== professorId ||
      !('onboardingCompleted' in value) ||
      value.onboardingCompleted !== true ||
      !('courses' in value) ||
      !isValidCourses(value.courses)
    )
      return null
    return value as ProfessorProfile
  } catch {
    return null
  }
}

export function courseTitleError(
  courses: ProfessorCourse[],
  value: string,
  exceptId?: string,
): string {
  const title = value.trim()
  if (!title) return 'Enter a course title first.'
  if (title.length > 120)
    return 'Course titles must be 120 characters or fewer.'
  if (
    courses.some(
      (c) =>
        c.id !== exceptId &&
        normalizedCourseTitle(c.title) === normalizedCourseTitle(title),
    )
  )
    return 'This course is already on your list.'
  return ''
}
