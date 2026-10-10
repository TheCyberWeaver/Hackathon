import { request } from '../../lib/poolApi'

export type QuestionStatus = 'open' | 'selected' | 'answered'

export type Question = {
  id: string
  text: string
  votes: number
  createdAt: string
  status: QuestionStatus
  mine: boolean
  votedByMe: boolean
  answer?: string | null
}

export function listQuestions(lectureId: string): Promise<Question[]> {
  return request<Question[]>(
    `/lectures/${encodeURIComponent(lectureId)}/questions`,
  )
}

export function submitQuestion(
  lectureId: string,
  text: string,
): Promise<Question> {
  return request<Question>(
    `/lectures/${encodeURIComponent(lectureId)}/questions`,
    {
      method: 'POST',
      body: JSON.stringify({ text }),
    },
  )
}

export function setVote(id: string, voted: boolean): Promise<Question> {
  return request<Question>(`/questions/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ voted }),
  })
}

export function reportQuestion(id: string): Promise<void> {
  return request<void>(`/questions/${encodeURIComponent(id)}/report`, {
    method: 'POST',
  })
}

export function deleteQuestion(id: string): Promise<void> {
  return request<void>(`/questions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
