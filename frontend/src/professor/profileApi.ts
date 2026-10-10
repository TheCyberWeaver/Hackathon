import { request } from '../lib/poolApi'
import { readProfessorProfile, type ProfessorCourse } from './professorProfile'

export type SavedProfessorProfile = {
  onboardingCompleted: boolean
  revision: number
  courses: ProfessorCourse[]
}

export function loadProfessorProfile(professorId: string) {
  const legacy = readProfessorProfile(professorId)
  return request<SavedProfessorProfile>('/professor/profile/initialize', {
    method: 'POST',
    body: JSON.stringify({
      onboardingCompleted: legacy?.onboardingCompleted ?? false,
      courses: legacy?.courses ?? [],
    }),
  })
}
export function saveProfessorProfile(
  profile: SavedProfessorProfile,
  courses: ProfessorCourse[],
  completed = profile.onboardingCompleted,
) {
  return request<SavedProfessorProfile>('/professor/profile', {
    method: 'PUT',
    body: JSON.stringify({
      revision: profile.revision,
      onboardingCompleted: completed,
      courses,
    }),
  })
}
