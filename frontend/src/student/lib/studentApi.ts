import { request, watchLectures, type Lecture } from '../../lib/poolApi'

export function listLectureHistory(): Promise<Lecture[]> {
  return request<Lecture[]>('/student/lectures/history')
}

export type StudentSummary = {
  submittedCount: number
  answeredCount: number
}

export function getStudentSummary(): Promise<StudentSummary> {
  return request<StudentSummary>('/student/summary')
}

export function watchLectureHistory(
  onLectures: (lectures: Lecture[]) => void,
  onError: (error: unknown) => void,
  currentVersion: () => number = () => 0,
) {
  return watchLectures(onLectures, onError, currentVersion, listLectureHistory)
}

export function visitLecture(id: string): Promise<Lecture> {
  return request<Lecture>(`/lectures/${encodeURIComponent(id)}/visits`, {
    method: 'POST',
  })
}

export function removeLectureFromHistory(id: string): Promise<void> {
  return request<void>(`/student/lectures/history/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export type QuestionStatus = 'open' | 'selected' | 'answered'

export type Question = {
  id: string
  text: string
  votes: number
  createdAt: string
  status: QuestionStatus
  mine: boolean
  votedByMe: boolean
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
