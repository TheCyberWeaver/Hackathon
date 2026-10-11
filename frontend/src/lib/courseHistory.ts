import type { Lecture } from './poolApi'
import type { ProfessorCourse } from '../professor/professorProfile'

export type HistoryCourse = {
  key: string
  title: string
  archived: boolean
  legacy: boolean
  context?: string
  lectures: Lecture[]
}
export type HistoryFilters = {
  order: 'newest' | 'oldest'
  dates: string
  from: string
  to: string
}
export function lectureCourseKey(lecture: Lecture) {
  return lecture.courseKey || `legacy:${lecture.id}`
}
export function historyCourses(
  lectures: Lecture[],
  configured?: ProfessorCourse[],
): HistoryCourse[] {
  const groups = new Map<string, HistoryCourse>()
  for (const course of configured ?? []) {
    groups.set(course.historyKey || course.id, {
      key: course.historyKey || course.id,
      title: course.title,
      archived: false,
      legacy: false,
      lectures: [],
    })
  }
  for (const lecture of lectures.filter((item) => item.endedAt)) {
    const key = lectureCourseKey(lecture)
    if (!groups.has(key))
      groups.set(key, {
        key,
        title: lecture.courseName || lecture.course || lecture.title,
        archived: configured ? !!lecture.courseKey : !!lecture.courseArchived,
        legacy: !lecture.courseKey,
        lectures: [],
      })
    groups.get(key)!.lectures.push(lecture)
  }
  const result = [...groups.values()]
  const compare = (a: HistoryCourse, b: HistoryCourse) =>
    a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }) ||
    a.key.localeCompare(b.key)
  const ordered = configured
    ? [
        ...result.slice(0, configured.length),
        ...result.slice(configured.length).sort(compare),
      ]
    : result.sort(compare)
  for (const course of ordered) {
    if (course.legacy)
      course.context = `Legacy session · ${course.lectures[0].id}`
    else if (
      ordered.some(
        (other) =>
          other.key !== course.key &&
          other.title.toLowerCase() === course.title.toLowerCase(),
      )
    ) {
      // A stable reference distinguishes both different professors and reused names,
      // without exposing account identities in the student navigation.
      course.context = `Course reference ${course.key}`
    }
  }
  return ordered
}
export function sessionStart(lecture: Lecture) {
  return new Date(lecture.startedAt || lecture.lectureTime)
}
export function localDate(date: Date) {
  if (!Number.isFinite(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function filterSessions(
  lectures: Lecture[],
  filters: HistoryFilters,
  today = new Date(),
) {
  let from = filters.dates === 'custom' ? filters.from : ''
  const to =
    filters.dates === 'custom'
      ? filters.to
      : filters.dates === 'all'
        ? ''
        : localDate(today)
  if (filters.dates === '7' || filters.dates === '30') {
    const first = new Date(today)
    first.setDate(first.getDate() - (Number(filters.dates) - 1))
    from = localDate(first)
  }
  if (from && to && from > to) return []
  return lectures
    .filter((lecture) => {
      if (!lecture.endedAt) return false
      const day = localDate(sessionStart(lecture))
      return (
        (!from && !to) ||
        (!!day && (!from || day >= from) && (!to || day <= to))
      )
    })
    .sort((a, b) => {
      const difference =
        (sessionStart(a).getTime() || 0) - (sessionStart(b).getTime() || 0)
      return (
        (filters.order === 'newest' ? -difference : difference) ||
        a.id.localeCompare(b.id)
      )
    })
}
export function courseUrl(
  role: 'student' | 'professor',
  course?: HistoryCourse,
) {
  const path = `/${role}/past-lectures`
  if (!course) return path
  return `${path}?${new URLSearchParams({ course: course.key, name: course.title })}`
}
export function historyFilters(search: string): HistoryFilters {
  const params = new URLSearchParams(search)
  return {
    order: params.get('order') === 'oldest' ? 'oldest' : 'newest',
    dates: ['7', '30', 'custom'].includes(params.get('dates') || '')
      ? params.get('dates')!
      : 'all',
    from: /^\d{4}-\d{2}-\d{2}$/.test(params.get('from') || '')
      ? params.get('from')!
      : '',
    to: /^\d{4}-\d{2}-\d{2}$/.test(params.get('to') || '')
      ? params.get('to')!
      : '',
  }
}
