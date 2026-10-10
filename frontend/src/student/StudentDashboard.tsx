import StudentApp from '../../student-frontend/src/App'
import '../../student-frontend/src/styles.css'
import type { CurrentUser } from '../lib/api'

export default function StudentDashboard({
  user,
  onSwitchSpace,
}: {
  user: CurrentUser
  onSwitchSpace: () => void
}) {
  return (
    <StudentApp basePath="/student" user={user} onSwitchSpace={onSwitchSpace} />
  )
}
