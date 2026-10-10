import type { CurrentUser } from '../lib/api'
import Brand from './Brand'

// Replace this component with dashboard imports when those branches merge.
// Choosing a space is navigation, not a grant of professor permissions.
export default function DashboardEntry({
  space,
  user,
}: {
  space: 'student' | 'professor'
  user: CurrentUser
}) {
  return (
    <div className="handoff-page">
      <header className="site-header page-width">
        <Brand />
        <a className="back-link" href="/">
          ← Choose another space
        </a>
      </header>
      <main className="handoff-panel">
        <span className="panel-kicker">
          {space === 'student' ? 'STUDENT SPACE' : 'PROFESSOR SPACE'}
        </span>
        <h1>You’re in, {user.name.split(/\s+/)[0]}.</h1>
        <p>
          Your {space} dashboard is coming soon.
          <br />
          This is where your next conversation will begin.
        </p>
        <div className="handoff-identity">
          <span className="identity-check">✓</span> Signed in as{' '}
          <strong>{user.name}</strong>
          <span>{user.id}</span>
        </div>
        <a className="return-link" href="/">
          Back to AskPool <span aria-hidden="true">↗</span>
        </a>
      </main>
    </div>
  )
}
