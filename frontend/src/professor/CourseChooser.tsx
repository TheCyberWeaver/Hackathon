import { useRef, useState } from 'react'
import { courseTitleError, type ProfessorCourse } from './professorProfile'

export default function CourseChooser({
  courses,
  busy,
  error,
  onChoose,
  onCancel,
  onSaveCourses,
}: {
  courses: ProfessorCourse[]
  busy: boolean
  error: string
  onChoose: (course: ProfessorCourse) => void
  onCancel: () => void
  onSaveCourses: (courses: ProfessorCourse[]) => Promise<void>
}) {
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const course = courses.find((c) => c.id === selectedCourseId)
  const disabled = busy || saving
  async function addCourse() {
    if (pending.current || busy) return
    const validation = courseTitleError(courses, draft)
    if (validation) {
      setSaveError(validation)
      return
    }
    const added = { id: crypto.randomUUID(), title: draft.trim() }
    pending.current = true
    setSaving(true)
    setSaveError('')
    try {
      await onSaveCourses([...courses, added])
      setSelectedCourseId(added.id)
      setDraft('')
      setAdding(false)
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : 'Could not save this course.',
      )
    } finally {
      pending.current = false
      setSaving(false)
    }
  }
  return (
    <div className="course-manager">
      <label htmlFor="lecture-course">Course</label>
      <select
        id="lecture-course"
        autoFocus
        disabled={disabled || courses.length === 0}
        value={selectedCourseId}
        onChange={(e) => setSelectedCourseId(e.target.value)}
      >
        <option value="">Select a course</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      {courses.length === 0 && (
        <p>No courses yet. Add your first course below.</p>
      )}
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void addCourse()
          }}
        >
          <label htmlFor="chooser-course-title">Course title</label>
          <input
            id="chooser-course-title"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={120}
            disabled={disabled}
          />
          <div className="course-actions">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setAdding(false)
                setDraft('')
                setSaveError('')
              }}
            >
              Cancel course
            </button>
            <button type="submit" disabled={disabled}>
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAdding(true)}
        >
          Add course
        </button>
      )}
      {(saveError || error) && (
        <p role="alert" className="text-red-700">
          {saveError || error}
        </p>
      )}
      <div className="course-actions">
        <button type="button" onClick={onCancel} disabled={disabled}>
          Cancel
        </button>
        <button
          type="button"
          className="course-primary"
          disabled={!course || disabled || adding}
          onClick={() => {
            if (course && !disabled) onChoose(course)
          }}
        >
          {busy ? 'Please wait…' : 'Start session'}
        </button>
      </div>
    </div>
  )
}
