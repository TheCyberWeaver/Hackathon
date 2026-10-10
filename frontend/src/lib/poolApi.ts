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
  course: string
  startedAt: string | null
  endedAt: string | null
  questionsPaused: boolean
}
export function listLectures() {
  return request<Lecture[]>('/lectures')
}
// Both dashboards need fresh lecture options even when initially opened empty.
export function watchLectures(
  onLectures: (lectures: Lecture[]) => void,
  onError: (error: unknown) => void,
  currentVersion: () => number = () => 0,
) {
  let active = true
  let pending = false
  const refresh = async () => {
    if (!active || pending) return
    pending = true
    const version = currentVersion()
    try {
      const lectures = await listLectures()
      if (active && version === currentVersion()) onLectures(lectures)
    } catch (error) {
      if (active) onError(error)
    } finally {
      pending = false
    }
  }
  void refresh()
  const timer = globalThis.setInterval(() => {
    void refresh()
  }, 5000)
  if (typeof window !== 'undefined') window.addEventListener('focus', refresh)
  return () => {
    active = false
    globalThis.clearInterval(timer)
    if (typeof window !== 'undefined')
      window.removeEventListener('focus', refresh)
  }
}
export function createLecture(title: string, lectureTime: string, course = '') {
  return request<Lecture>('/lectures', {
    method: 'POST',
    body: JSON.stringify({ title, lectureTime, course }),
  })
}
export function changeLectureSession(
  id: string,
  action: 'start' | 'pause' | 'resume' | 'end',
) {
  return request<Lecture>(`/lectures/${encodeURIComponent(id)}/session`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
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
