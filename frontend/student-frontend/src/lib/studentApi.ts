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

const identityKey = 'askpool-student-id'

function newStudentId(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

function studentId(): string {
  let id = localStorage.getItem(identityKey)
  if (!id) {
    id = newStudentId()
    localStorage.setItem(identityKey, id)
  }
  return id
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'X-Student-Id': studentId(),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || 'Something went wrong. Please try again.')
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T)
}

export function listQuestions(): Promise<Question[]> {
  return request<Question[]>('/questions')
}

export function submitQuestion(text: string): Promise<Question> {
  return request<Question>('/questions', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
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
