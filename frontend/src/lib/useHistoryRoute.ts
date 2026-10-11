import { useEffect, useState } from 'react'
import { historyFilters } from './courseHistory'

export function useHistoryRoute() {
  const [search, setSearch] = useState(() => window.location.search)
  useEffect(() => {
    const sync = () => setSearch(window.location.search)
    window.addEventListener('popstate', sync)
    window.addEventListener('askpool:navigate', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('askpool:navigate', sync)
    }
  }, [])
  const params = new URLSearchParams(search)
  return {
    courseKey: params.get('course') || '',
    courseName: params.get('name') || '',
    filters: historyFilters(search),
  }
}
export function notifyHistoryRoute() {
  window.dispatchEvent(new Event('askpool:navigate'))
}
export function saveHistoryPosition() {
  window.history.replaceState(
    { ...window.history.state, historyScroll: window.scrollY },
    '',
  )
}
