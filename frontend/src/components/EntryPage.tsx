import { useState } from 'react'
import type { IdentityState } from '../App'

type Space = 'student' | 'professor'

const spaces: { id: Space; title: string; description: string }[] = [
  {
    id: 'student',
    title: 'Student',
    description:
      'Join a lecture, ask questions, and vote for the ones you share.',
  },
  {
    id: 'professor',
    title: 'Professor',
    description:
      'See what your class is asking and keep the discussion moving.',
  },
]

export default function EntryPage({
  identity,
  onEnter,
}: {
  identity: IdentityState
  onEnter: (space: Space) => void
}) {
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null)
  const loading = identity.status === 'loading'
  const selectedLabel = selectedSpace === 'student' ? 'Student' : 'Professor'
  const actionLabel = loading
    ? 'Checking sign-in…'
    : !selectedSpace
      ? 'Choose a space to continue'
      : identity.status === 'ready'
        ? `Enter ${selectedLabel} space`
        : identity.status === 'error'
          ? 'Retry and continue'
          : 'Continue with school sign-in'

  return (
    <main className="entry-page">
      <div className="entry-shell">
        <section className="entry-intro" aria-labelledby="entry-title">
          <span className="entry-brand">ASKPOOL</span>
          <div>
            <p className="entry-eyebrow">CLASSROOM Q&amp;A</p>
            <h1 id="entry-title">Every question has a place.</h1>
            <p className="entry-intro-copy">
              Ask without interrupting. Vote for what matters. Make every
              lecture more useful for everyone.
            </p>
          </div>
          <p className="entry-footnote">
            A shared space for students and professors.
          </p>
        </section>

        <section className="entry-content" aria-labelledby="entry-choose-title">
          <p className="entry-step">GET STARTED</p>
          <h2 id="entry-choose-title">Choose your space</h2>
          <p className="entry-guidance">
            Select how you’re using AskPool today. You can switch spaces later.
          </p>

          <div
            className={`entry-identity entry-identity-${identity.status}`}
            role={identity.status === 'error' ? 'alert' : 'status'}
          >
            <span className="entry-identity-dot" aria-hidden="true" />
            <span>
              {loading
                ? 'Checking your sign-in…'
                : identity.status === 'ready'
                  ? `Signed in as ${identity.user.name}`
                  : identity.status === 'signed-out'
                    ? 'School sign-in is required to continue.'
                    : 'Could not verify your sign-in. You can retry below.'}
            </span>
          </div>

          <div className="entry-roles" role="group" aria-label="Choose a space">
            {spaces.map((space) => (
              <button
                key={space.id}
                type="button"
                aria-pressed={selectedSpace === space.id}
                onClick={() => setSelectedSpace(space.id)}
                className={`entry-role ${selectedSpace === space.id ? 'entry-role-selected' : ''}`}
              >
                <span
                  className={`entry-role-icon entry-role-icon-${space.id}`}
                  aria-hidden="true"
                >
                  {space.id === 'student' ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 5.5h6.5a3 3 0 0 1 3 3V20H7a3 3 0 0 0-3 1V5.5Z" />
                      <path d="M20 5.5h-3.5a3 3 0 0 0-3 3V20H17a3 3 0 0 1 3 1V5.5Z" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="13" rx="2" />
                      <path d="M8 21h8M12 17v4M7 9h5M7 12h8" />
                    </svg>
                  )}
                </span>
                <span className="entry-role-copy">
                  <strong>{space.title}</strong>
                  <span>{space.description}</span>
                </span>
                <span className="entry-role-check" aria-hidden="true">
                  {selectedSpace === space.id ? '✓' : ''}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="entry-continue"
            disabled={loading || !selectedSpace}
            onClick={() => selectedSpace && onEnter(selectedSpace)}
          >
            <span>{actionLabel}</span>
            <span aria-hidden="true">→</span>
          </button>
          <p className="entry-disclaimer">
            This prototype does not verify professor permissions yet. Your
            selection only opens a dashboard.
          </p>
        </section>
      </div>
    </main>
  )
}
