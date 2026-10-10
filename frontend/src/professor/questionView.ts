import type { Question } from './professorApi'
export type TimeFilter = 0 | 5 | 10 | 15 | 30
export const timeFilters = [0, 5, 10, 15, 30] as const
export function sortQuestions(questions: Question[]) {
  return [...questions].sort(
    (a, b) =>
      b.upvoteCount - a.upvoteCount ||
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      a.id.localeCompare(b.id, 'en', { numeric: true }),
  )
}
export function filterOpenQuestions(
  questions: Question[],
  minutes: TimeFilter,
  now: number,
) {
  return sortQuestions(
    questions.filter(
      (q) =>
        !q.answered &&
        (!minutes || Date.parse(q.createdAt) >= now - minutes * 60_000),
    ),
  )
}
