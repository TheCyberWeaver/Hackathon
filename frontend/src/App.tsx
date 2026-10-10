import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import EntryPage from './components/EntryPage'
import { getCurrentUser, IdentityError } from './lib/api'
import type { CurrentUser } from './lib/api'
import type { ProfessorCourse } from './professor/professorProfile'
import {
  loadProfessorProfile,
  saveProfessorProfile,
  type SavedProfessorProfile,
} from './professor/profileApi'
import { ApiRequestError } from './lib/poolApi'

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
  const [profile, setProfile] = useState<SavedProfessorProfile | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    loadProfessorProfile(user.id)
      .then((saved) => {
        if (active) {
          setProfile(saved)
          setError('')
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load your profile.',
          )
      })
    return () => {
      active = false
    }
  }, [user.id, attempt])

  async function saveCourses(courses: ProfessorCourse[], completed?: boolean) {
    if (!profile) throw new Error('Your profile is still loading.')
    try {
      const saved = await saveProfessorProfile(profile, courses, completed)
      setProfile(saved)
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 409) {
        const latest = await loadProfessorProfile(user.id)
        setProfile(latest)
      }
      throw cause
    }
  }
  if (!profile)
    return (
      <main className="entry-page">
        <div role={error ? 'alert' : 'status'}>
          <p>{error || 'Loading your professor profile…'}</p>
          {error && (
            <button
              type="button"
              className="mt-4 rounded-lg border px-4 py-2"
              onClick={() => {
                setError('')
                setAttempt((n) => n + 1)
              }}
            >
              Retry
            </button>
          )}
        </div>
      </main>
    )
  if (profile.onboardingCompleted)
    return (
      <ProfessorDashboard
        user={user}
        courses={profile.courses}
        onSaveCourses={saveCourses}
      />
    )
  return (
    <ProfessorOnboarding
      user={user}
      initialCourses={profile.courses}
      onContinue={async (courses) => {
        await saveCourses(courses, true)
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
  const signedInUserId = useRef<string | null>(null)

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
    let controller: AbortController | null = null
    function refreshIdentity() {
      controller?.abort()
      const requestController = new AbortController()
      controller = requestController
      getCurrentUser(requestController.signal)
        .then((user) => {
          if (requestController.signal.aborted) return
          if (signedInUserId.current && signedInUserId.current !== user.id) {
            const url = new URL(window.location.href)
            url.searchParams.delete('lecture')
            url.searchParams.delete('code')
            window.history.replaceState(null, '', url)
          }
          signedInUserId.current = user.id
          setIdentity({ status: 'ready', user })
        })
        .catch((error: unknown) => {
          if (requestController.signal.aborted) return
          if (error instanceof IdentityError && error.status === 401) {
            setIdentity({ status: 'signed-out' })
          } else if (!signedInUserId.current) {
            setIdentity({ status: 'error' })
          }
        })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshIdentity()
    }
    refreshIdentity()
    window.addEventListener('focus', refreshIdentity)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      controller?.abort()
      window.removeEventListener('focus', refreshIdentity)
      document.removeEventListener('visibilitychange', onVisibility)
    }
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
          <StudentDashboard key={identity.user.id} user={identity.user} />
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
