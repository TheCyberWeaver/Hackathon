import {
  changeLectureSession,
  createLecture,
  request,
  type Lecture,
} from '../lib/poolApi'
import type { QuestionStatus } from '../student/lib/studentApi'
import type { ProfessorCourse } from './professorProfile'

export async function startCourseSession(course: ProfessorCourse) {
  const created = await createLecture(
    course.title,
    new Date().toISOString(),
    course.title,
  )
  return changeLectureSession(created.id, 'start')
}

export type Question = {
  id: string
  text: string
  authorId: string
  upvoteCount: number
  createdAt: string
  answered: boolean
  status: QuestionStatus
  answeredAt: string | null
  reportCount: number
  deletedAt: string | null
  answer: string | null
}
export function listProfessorQuestions(
  lectureId: string,
  includeDeleted = false,
) {
  return request<Question[]>(
    `/lectures/${encodeURIComponent(lectureId)}/professor/questions${includeDeleted ? '?includeDeleted=true' : ''}`,
  )
}
export function changeQuestionStatus(
  id: string,
  status: QuestionStatus,
  answer?: string,
) {
  return request<Question>(`/questions/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      ...(answer !== undefined ? { answer } : {}),
    }),
  })
}

export function restoreQuestion(id: string) {
  return request<Question>(`/questions/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
  })
}
export function permanentlyDeleteQuestion(id: string) {
  return request<void>(`/questions/${encodeURIComponent(id)}/permanent`, {
    method: 'DELETE',
  })
}
export function emptyTrash(lectureId: string) {
  return request<void>(
    `/lectures/${encodeURIComponent(lectureId)}/questions/trash`,
    { method: 'DELETE' },
  )
}
export type Summary = {
  lectureCount: number
  unansweredCount: number
  answeredCount: number
}
export type ArchivedLecture = { lecture: Lecture; questions: Question[] }
export function getSummary() {
  return request<Summary>('/professor/summary')
}
export function listArchive() {
  return request<ArchivedLecture[]>('/professor/lectures/archive')
}
export function deleteQuestion(id: string) {
  return request<void>(`/questions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
