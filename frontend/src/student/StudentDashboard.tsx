import StudentApp from '../../student-frontend/src/App'
import '../../student-frontend/src/styles.css'
import type { CurrentUser } from '../lib/api'

export default function StudentDashboard({ user }: { user: CurrentUser }) {
  return <StudentApp basePath="/student" user={user} />
}
