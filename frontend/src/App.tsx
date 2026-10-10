import { useEffect, useState } from 'react'
import EntryPage from './components/EntryPage'
import DashboardEntry from './components/DashboardEntry'
import { getCurrentUser, IdentityError } from './lib/api'
import type { CurrentUser } from './lib/api'

export type IdentityState =
  | { status: 'loading' }
  | { status: 'ready'; user: CurrentUser }
  | { status: 'signed-out' }
  | { status: 'error' }

export default function App() {
  const [identity, setIdentity] = useState<IdentityState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    getCurrentUser(controller.signal)
      .then((user) => setIdentity({ status: 'ready', user }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setIdentity({
          status:
            error instanceof IdentityError && error.status === 401
              ? 'signed-out'
              : 'error',
        })
      })
    return () => controller.abort()
  }, [])

  async function enterSpace(space: 'student' | 'professor') {
    if (identity.status === 'signed-out') {
      window.location.assign(`https://08.hackathon.ethz.ch/${space}`)
      return
    }
    if (identity.status === 'ready') {
      window.location.assign(`/${space}`)
      return
    }
    setIdentity({ status: 'loading' })
    try {
      const user = await getCurrentUser()
      setIdentity({ status: 'ready', user })
      window.location.assign(`/${space}`)
    } catch (error) {
      if (error instanceof IdentityError && error.status === 401) {
        window.location.assign(`https://08.hackathon.ethz.ch/${space}`)
      } else {
        setIdentity({ status: 'error' })
      }
    }
  }

  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  // Integration points for the independently developed dashboards.
  const space =
    path === '/student' ? 'student' : path === '/professor' ? 'professor' : null
  if (space && identity.status === 'ready')
    return <DashboardEntry space={space} user={identity.user} />
  return <EntryPage identity={identity} onEnter={enterSpace} />
}
