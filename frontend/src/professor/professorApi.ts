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
}
export function listProfessorQuestions(lectureId: string) {
  return request<Question[]>(
    `/lectures/${encodeURIComponent(lectureId)}/professor/questions`,
  )
}
export function changeQuestionStatus(id: string, status: QuestionStatus) {
  return request<Question>(`/questions/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
export function clearOpenQuestions(lectureId: string, questionIds: string[]) {
  return request<{ deletedIds: string[] }>(
    `/lectures/${encodeURIComponent(lectureId)}/questions/clear-open`,
    {
      method: 'POST',
      body: JSON.stringify({ questionIds }),
    },
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
