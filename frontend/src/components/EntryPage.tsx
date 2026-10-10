import type { IdentityState } from '../App'
import Brand from './Brand'

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SpaceIcon({ professor = false }: { professor?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {professor ? (
        <path
          d="M4 4h16v11H4zM9 20l3-5 3 5M8 8h8M8 11h5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="m2 9 10-5 10 5-10 5L2 9ZM6 11v6c4 3 8 3 12 0v-6M22 9v7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

export default function EntryPage({
  identity,
  onRetry,
}: {
  identity: IdentityState
  onRetry: () => void
}) {
  const ready = identity.status === 'ready'
  return (
    <div className="entry-page">
      <header className="site-header page-width">
        <Brand />
        <div className="header-links">
          {import.meta.env.DEV && (
            <span className="preview-badge">Local demo</span>
          )}
          <a href="#how-it-works">
            How it works <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>
      <main className="entry-layout page-width">
        <section className="hero" aria-labelledby="welcome-title">
          <div className="eyebrow">
            <span className="live-dot" /> A little curiosity. A better
            classroom.
          </div>
          <h1 id="welcome-title">
            Big ideas start with a <em>small question.</em>
          </h1>
          <p className="hero-description">
            Ask what’s on your mind. Find the questions you share. Make every
            lecture a conversation.
          </p>
          <div className="conversation-art" aria-hidden="true">
            <span className="art-orbit" />
            <div className="question-note">
              <div className="note-header">
                <span className="note-avatar">?</span>
                <span>
                  A curious mind
                  <span className="note-subtitle">
                    One question can open a conversation
                  </span>
                </span>
                <span className="note-spark">✦</span>
              </div>
              <p>
                “Could we look at that
                <br />
                from another perspective?”
              </p>
              <div className="note-bottom">
                <span className="vote-pill">
                  ↑ &nbsp; I was wondering that too
                </span>
                <span className="note-dots">•••</span>
              </div>
            </div>
            <div className="reply-note">
              <span className="reply-check">✓</span> You’re probably not the
              only one.
            </div>
          </div>
          <div className="how-it-works" id="how-it-works">
            <p className="small-label">A SIMPLE WAY TO SPEAK UP</p>
            <ol>
              <li>
                <span>01</span> Join your lecture
              </li>
              <li>
                <span>02</span> Ask &amp; upvote
              </li>
              <li>
                <span>03</span> Learn together
              </li>
            </ol>
          </div>
        </section>
        <section className="entry-panel" aria-labelledby="entry-title">
          <span className="panel-kicker">YOUR SEAT AT THE TABLE</span>
          <h2 id="entry-title">Welcome to AskPool</h2>
          <p className="panel-description">
            Different perspectives. One conversation.
            <br />
            Choose your space to get started.
          </p>
          <div
            className="identity-slot"
            aria-live="polite"
            aria-busy={identity.status === 'loading'}
          >
            {ready && (
              <div className="identity-card">
                <span className="identity-avatar" aria-hidden="true">
                  {identity.user.name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="identity-details">
                  <span className="identity-label">YOU’RE SIGNED IN AS</span>
                  <strong>{identity.user.name}</strong>
                  <span className="identity-email">{identity.user.id}</span>
                </div>
                <span className="identity-check" aria-label="Signed in">
                  ✓
                </span>
              </div>
            )}
            {identity.status === 'loading' && (
              <div className="identity-message">
                <span className="loading-spinner" /> Finding your seat…
              </div>
            )}
            {identity.status === 'signed-out' && (
              <div className="identity-message signed-out-message">
                <strong>Sign in to join the conversation.</strong>
                <span>Use your campus account to continue.</span>
                <a
                  className="sign-in-link"
                  href="https://08.hackathon.ethz.ch/"
                >
                  Continue to sign in <Arrow />
                </a>
              </div>
            )}
            {identity.status === 'error' && (
              <div className="identity-message error-message" role="alert">
                <strong>We couldn’t load your profile.</strong>
                <span>Check your connection and try again.</span>
                <button className="retry-button" onClick={onRetry}>
                  Try again <Arrow />
                </button>
              </div>
            )}
          </div>
          <div className="space-options">
            <a
              className={`space-choice student-choice${ready ? '' : ' unavailable'}`}
              href={ready ? '/student' : undefined}
              aria-disabled={!ready}
            >
              <span className="space-icon">
                <SpaceIcon />
              </span>
              <span className="space-copy">
                <strong>I’m a student</strong>
                <span>Ask, upvote, and learn together.</span>
              </span>
              <span className="choice-arrow">
                <Arrow />
              </span>
            </a>
            <a
              className={`space-choice professor-choice${ready ? '' : ' unavailable'}`}
              href={ready ? '/professor' : undefined}
              aria-disabled={!ready}
            >
              <span className="space-icon">
                <SpaceIcon professor />
              </span>
              <span className="space-copy">
                <strong>I’m a professor</strong>
                <span>Lead the lecture. Hear every voice.</span>
              </span>
              <span className="choice-arrow">
                <Arrow />
              </span>
            </a>
          </div>
          <div className="privacy-note">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M10 2 3 5v5c0 4 7 7 7 7s7-3 7-7V5l-7-3Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="m7 9 2 2 4-4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p>
              A safe space for curiosity.
              <br />
              <span>Your identity stays private to classmates.</span>
            </p>
          </div>
        </section>
      </main>
      <footer className="site-footer page-width">
        <span>Made for the moments when you almost raised your hand.</span>
        <span>
          Every student has a voice{' '}
          <span className="footer-spark" aria-hidden="true">
            ✦
          </span>
        </span>
      </footer>
    </div>
  )
}
