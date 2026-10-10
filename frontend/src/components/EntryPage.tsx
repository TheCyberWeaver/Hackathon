import type { IdentityState } from '../App'

export default function EntryPage({
  identity,
  onEnter,
}: {
  identity: IdentityState
  onEnter: (space: 'student' | 'professor') => void
}) {
  const loading = identity.status === 'loading'
  return (
    <main className="entry-page" aria-busy={loading}>
      <div className="entry-content">
        <h1>AskPool</h1>
        <div className="entry-actions">
          <button
            className="entry-button student-button"
            disabled={loading}
            onClick={() => onEnter('student')}
          >
            Student
          </button>
          <button
            className="entry-button professor-button"
            disabled={loading}
            onClick={() => onEnter('professor')}
          >
            Professor
          </button>
        </div>
        <span className="sr-only" role="status">
          {loading
            ? 'Checking sign-in…'
            : identity.status === 'error'
              ? 'Connection failed. Choose an entry button to retry.'
              : identity.status === 'signed-out'
                ? 'Choose an entry button to sign in.'
                : `Signed in as ${identity.user.name}. Choose your space.`}
        </span>
      </div>
    </main>
  )
}
