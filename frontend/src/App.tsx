import { lazy, Suspense, useEffect, useState } from 'react'
import EntryPage from './components/EntryPage'
import { getCurrentUser, IdentityError } from './lib/api'
import type { CurrentUser } from './lib/api'

const StudentDashboard = lazy(() => import('./student/StudentDashboard'))
const ProfessorDashboard = lazy(() => import('./professor/ProfessorDashboard'))

export type IdentityState =
  | { status: 'loading' }
  | { status: 'ready'; user: CurrentUser }
  | { status: 'signed-out' }
  | { status: 'error' }

export default function App() {
  const [identity, setIdentity] = useState<IdentityState>({ status: 'loading' })
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const syncPath = () => setPath(window.location.pathname)
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  useEffect(() => {
    if (path === '/') document.title = 'AskPool'
    if (path === '/professor') document.title = 'AskPool — Professor'
  }, [path])

  function navigate(nextPath: string) {
    window.history.pushState(null, '', nextPath)
    setPath(nextPath)
    window.scrollTo(0, 0)
  }

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
      navigate(`/${space}`)
      return
    }
    setIdentity({ status: 'loading' })
    try {
      const user = await getCurrentUser()
      setIdentity({ status: 'ready', user })
      navigate(`/${space}`)
    } catch (error) {
      if (error instanceof IdentityError && error.status === 401) {
        window.location.assign(`https://08.hackathon.ethz.ch/${space}`)
      } else {
        setIdentity({ status: 'error' })
      }
    }
  }

  const normalizedPath = path.replace(/\/+$/, '') || '/'
  if (identity.status === 'ready') {
    if (
      normalizedPath === '/student' ||
      normalizedPath.startsWith('/student/')
    ) {
      return (
        <Suspense
          fallback={
            <main className="entry-page" role="status">
              Loading your dashboard…
            </main>
          }
        >
          <StudentDashboard
            user={identity.user}
            onSwitchSpace={() => navigate('/')}
          />
        </Suspense>
      )
    }
    if (normalizedPath === '/professor') {
      return (
        <Suspense
          fallback={
            <main className="entry-page" role="status">
              Loading your dashboard…
            </main>
          }
        >
          <ProfessorDashboard
            user={identity.user}
            onSwitchSpace={() => navigate('/')}
          />
        </Suspense>
      )
    }
  }
  return <EntryPage identity={identity} onEnter={enterSpace} />
}
