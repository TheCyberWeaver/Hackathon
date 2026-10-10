const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/[/]$/, '')

// Keep transport and contract changes here, away from dashboard rendering.
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || `Request failed (${response.status}).`)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export type Lecture = {
  id: string
  title: string
  lectureTime: string
  canManage: boolean
}
export function listLectures() {
  return request<Lecture[]>('/lectures')
}
export function createLecture(title: string, lectureTime: string) {
  return request<Lecture>('/lectures', {
    method: 'POST',
    body: JSON.stringify({ title, lectureTime }),
  })
}
export function initialLectureId(): string {
  return new URLSearchParams(window.location.search).get('lecture') ?? ''
}
export function rememberLecture(id: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('lecture', id)
  window.history.replaceState(null, '', url)
}
