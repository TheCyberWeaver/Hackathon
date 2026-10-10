import { useCallback, useEffect, useRef, useState } from 'react'
import { listQuestions, type Question } from './studentApi'
import type { Lecture } from '../../lib/poolApi'

export type HistoryQuestions = {
  questions?: Question[]
  loading: boolean
  error: boolean
}

// Archive reads never touch the joined session or the live question pool.
export function useStudentHistory(lectures: Lecture[], enabled: boolean) {
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
    } catch {
      setEntries((current) => ({
        ...current,
        [id]: { ...current[id], loading: false, error: true },
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
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [archiveIds, enabled, load])

  return { entries, retry: load }
}
