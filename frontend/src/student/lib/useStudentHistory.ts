import { useCallback, useEffect, useRef, useState } from 'react'
import { listQuestions, type Question } from './studentApi'
import { ApiRequestError, type Lecture } from '../../lib/poolApi'

export type HistoryQuestions = {
  questions?: Question[]
  loading: boolean
  error: boolean
  unavailable?: boolean
}

// Archive reads never touch the joined session or the live question pool.
export function useStudentHistory(
  lectures: Lecture[],
  enabled: boolean,
  refreshMs = 30_000,
) {
  const [entries, setEntries] = useState<Record<string, HistoryQuestions>>({})
  const pending = useRef(new Set<string>())
  const archiveIds = JSON.stringify(
    lectures
      .filter((lecture) => lecture.endedAt)
      .map((lecture) => lecture.id)
      .sort(),
  )
  const load = useCallback(async (id: string) => {
    if (pending.current.has(id)) return
    pending.current.add(id)
    setEntries((current) => ({
      ...current,
      [id]: { ...current[id], loading: true, error: false },
    }))
    try {
      const questions = await listQuestions(id)
      setEntries((current) => ({
        ...current,
        [id]: { questions, loading: false, error: false },
      }))
    } catch (error) {
      setEntries((current) => ({
        ...current,
        // A deleted session must not keep displaying cached questions.
        [id]:
          error instanceof ApiRequestError && error.status === 404
            ? { loading: false, error: false, unavailable: true }
            : { ...current[id], loading: false, error: true },
      }))
    } finally {
      pending.current.delete(id)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const ids: string[] = JSON.parse(archiveIds)
    const refresh = () => ids.forEach((id) => void load(id))
    refresh()
    const timer = window.setInterval(refresh, refreshMs)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [archiveIds, enabled, load, refreshMs])

  return { entries, retry: load }
}
