import { request } from '../lib/poolApi'
import type { QuestionStatus } from '../student/lib/studentApi'

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
export function deleteQuestion(id: string) {
  return request<void>(`/questions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
