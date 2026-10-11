// Derive from the persisted start time, never from how long the page was open.
export function formatElapsedTime(startedAt: string, now: number): string {
  const start = Date.parse(startedAt)
  if (!Number.isFinite(start) || !Number.isFinite(now)) return '—'
  const totalSeconds = Math.max(0, Math.floor((now - start) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${String(minutes).padStart(2, '0')}:${seconds}`
}
