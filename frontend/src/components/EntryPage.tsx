import { useRef, useState } from 'react'
import type { IdentityState } from '../App'
type Space = 'student' | 'professor'

export default function EntryPage({
  identity,
  onEnter,
}: {
  identity: IdentityState
  onEnter: (space: Space) => Promise<void>
}) {
  const pending = useRef(false)
  const [entering, setEntering] = useState(false)
  const loading = identity.status === 'loading' || entering
  async function enter(space: Space) {
    if (pending.current || loading) return
    pending.current = true
    setEntering(true)
    try {
      await onEnter(space)
    } finally {
      pending.current = false
      setEntering(false)
    }
  }
  return (
    <main className="entry-page">
      <section className="entry-simple" aria-labelledby="entry-choose-title">
        <span className="entry-brand">ASKPOOL</span>
        <h1 id="entry-choose-title">Choose your space</h1>
        <div
          className={`entry-identity entry-identity-${identity.status}`}
          role={identity.status === 'error' ? 'alert' : 'status'}
        >
          {loading
            ? 'Checking sign-in…'
            : identity.status === 'ready'
              ? identity.user.name
              : identity.status === 'error'
                ? 'Could not verify sign-in. Choose a space to retry.'
                : 'Sign in to continue.'}
        </div>
        <div className="entry-roles" role="group" aria-label="Choose a space">
          {(['student', 'professor'] as const).map((space) => (
            <button
              key={space}
              type="button"
              className="entry-role"
              disabled={loading}
              onClick={() => void enter(space)}
            >
              <strong>{space === 'student' ? 'Student' : 'Professor'}</strong>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
