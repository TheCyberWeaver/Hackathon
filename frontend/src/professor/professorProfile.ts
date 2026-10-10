export type ProfessorCourse = { id: string; title: string }

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
    courses: [...courses, { id: crypto.randomUUID(), title }],
  }
}

export function resetProfessorProfile(professorId: string): boolean {
  if (!professorId.trim()) return false
  try {
    window.localStorage.removeItem(professorProfileStorageKey(professorId))
    return true
  } catch {
    return false
  }
}

function isValidCourses(value: unknown): value is ProfessorCourse[] {
  if (!Array.isArray(value) || value.length === 0) return false
  const ids = new Set<string>()
  const titles = new Set<string>()
  for (const course of value) {
    if (
      typeof course !== 'object' ||
      course === null ||
      typeof course.id !== 'string' ||
      !course.id ||
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

export function serializeProfessorProfile(
  professorId: string,
  courses: ProfessorCourse[],
): string | null {
  if (!professorId.trim() || !isValidCourses(courses)) return null
  const profile: ProfessorProfile = {
    schemaVersion: 1,
    professorId,
    onboardingCompleted: true,
    courses: courses.map((course) => ({
      id: course.id,
      title: course.title.trim(),
    })),
  }
  return JSON.stringify(profile, null, 2)
}

export function saveProfessorProfile(
  professorId: string,
  courses: ProfessorCourse[],
): boolean {
  const json = serializeProfessorProfile(professorId, courses)
  if (!json) return false
  try {
    window.localStorage.setItem(professorProfileStorageKey(professorId), json)
    return true
  } catch {
    return false
  }
}
