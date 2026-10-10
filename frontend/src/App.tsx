import { lazy, Suspense, useEffect, useState } from 'react'
import EntryPage from './components/EntryPage'
import { getCurrentUser, IdentityError } from './lib/api'
import type { CurrentUser } from './lib/api'
import { readProfessorProfile } from './professor/professorProfile'

const StudentDashboard = lazy(() => import('./student/StudentDashboard'))
const ProfessorDashboard = lazy(() => import('./professor/ProfessorDashboard'))
const ProfessorOnboarding = lazy(
  () => import('./professor/ProfessorOnboarding'),
)

function ProfessorSpace({
  user,
  onContinue,
}: {
  user: CurrentUser
  onContinue: () => void
}) {
  const [courses, setCourses] = useState(
    () => readProfessorProfile(user.id)?.courses ?? null,
  )

  if (courses) return <ProfessorDashboard user={user} courses={courses} />
  return (
    <ProfessorOnboarding
      user={user}
      onContinue={(savedCourses) => {
        setCourses(savedCourses)
        onContinue()
      }}
    />
  )
}

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
    if (path.startsWith('/professor')) document.title = 'AskPool — Professor'
  }, [path])

  function navigate(nextPath: string) {
    window.history.pushState(null, '', `${nextPath}${window.location.search}`)
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
      window.location.assign(
        `https://08.hackathon.ethz.ch/${space}${window.location.search}`,
      )
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
        window.location.assign(
          `https://08.hackathon.ethz.ch/${space}${window.location.search}`,
        )
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
          <StudentDashboard user={identity.user} />
        </Suspense>
      )
    }
    if (
      normalizedPath === '/professor' ||
      normalizedPath.startsWith('/professor/')
    ) {
      return (
        <Suspense
          fallback={
            <main className="entry-page" role="status">
              Loading your dashboard…
            </main>
          }
        >
          <ProfessorSpace
            key={identity.user.id}
            user={identity.user}
            onContinue={() => navigate('/professor')}
          />
        </Suspense>
      )
    }
  }
  return <EntryPage identity={identity} onEnter={enterSpace} />
}
