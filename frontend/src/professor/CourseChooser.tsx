import { useState } from 'react'
import type { ProfessorCourse } from './professorProfile'

export default function CourseChooser({
  courses,
  busy,
  error,
  onChoose,
  onCancel,
}: {
  courses: ProfessorCourse[]
  busy: boolean
  error: string
  onChoose: (course: ProfessorCourse) => void
  onCancel: () => void
}) {
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const course = courses.find((option) => option.id === selectedCourseId)

  return (
    <form
      className="mt-6 text-left"
      onSubmit={(event) => {
        event.preventDefault()
        if (course && !busy) onChoose(course)
      }}
    >
      <label
        htmlFor="lecture-course"
        className="block text-sm font-semibold text-slate-800"
      >
        Course
      </label>
      <p
        id="lecture-course-help"
        className="mt-1 text-xs leading-5 text-slate-500"
      >
        Choose from the courses you added during setup.
      </p>
      <select
        id="lecture-course"
        aria-describedby="lecture-course-help"
        autoFocus
        required
        disabled={busy || courses.length === 0}
        value={selectedCourseId}
        onChange={(event) => setSelectedCourseId(event.target.value)}
        className="mt-3 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <option value="">Select a course</option>
        {courses.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </select>
      {courses.length === 0 && (
        <p role="alert" className="mt-4 text-sm text-slate-600">
          Complete course setup before starting a session.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!course || busy}
          className="min-h-11 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          {busy ? 'Please wait…' : 'Start session'}
        </button>
      </div>
    </form>
  )
}
