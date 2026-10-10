import { useRef, useState } from 'react'
import { courseTitleError, type ProfessorCourse } from './professorProfile'

export default function CourseSettings({
  courses,
  onSaveCourses,
}: {
  courses: ProfessorCourse[]
  onSaveCourses: (courses: ProfessorCourse[]) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [rename, setRename] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  async function save(next: ProfessorCourse[], success?: () => void) {
    if (pending.current) return
    pending.current = true
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await onSaveCourses(next)
      success?.()
      setNotice('Courses saved.')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not save courses. Try again.',
      )
    } finally {
      pending.current = false
      setSaving(false)
    }
  }
  function add() {
    const validation = courseTitleError(courses, draft)
    if (validation) {
      setError(validation)
      return
    }
    void save(
      [...courses, { id: crypto.randomUUID(), title: draft.trim() }],
      () => setDraft(''),
    )
  }
  function finishRename(id: string) {
    const validation = courseTitleError(courses, rename, id)
    if (validation) {
      setError(validation)
      return
    }
    void save(
      courses.map((c) => (c.id === id ? { ...c, title: rename.trim() } : c)),
      () => setEditingId(null),
    )
  }
  function move(index: number, direction: number) {
    const next = [...courses]
    ;[next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ]
    void save(next)
  }
  return (
    <section className="course-manager mt-8" aria-labelledby="settings-courses">
      <h2 id="settings-courses" className="text-xl font-semibold">
        Your courses
      </h2>
      <p>
        Changes apply to future sessions. Existing lectures keep their names.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <label htmlFor="settings-new-course">Course title</label>
        <div className="course-input-row">
          <input
            id="settings-new-course"
            value={draft}
            maxLength={120}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" disabled={saving}>
            Add course
          </button>
        </div>
      </form>
      {!courses.length && <p>No courses yet. Add your first course above.</p>}
      <ol className="course-list">
        {courses.map((course, index) => (
          <li key={course.id}>
            {editingId === course.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  finishRename(course.id)
                }}
              >
                <label htmlFor="rename-course">Rename course</label>
                <input
                  id="rename-course"
                  autoFocus
                  value={rename}
                  maxLength={120}
                  disabled={saving}
                  onChange={(e) => setRename(e.target.value)}
                />
                <div className="course-actions">
                  <button type="submit" disabled={saving}>
                    Save name
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setEditingId(null)
                      setError('')
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <span className="course-title">{course.title}</span>
                <div className="course-actions">
                  <button
                    type="button"
                    disabled={saving || index === 0}
                    aria-label={`Move ${course.title} up`}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={saving || index === courses.length - 1}
                    aria-label={`Move ${course.title} down`}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setEditingId(course.id)
                      setRename(course.title)
                      setError('')
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    aria-label={`Remove ${course.title}`}
                    onClick={() =>
                      void save(courses.filter((c) => c.id !== course.id))
                    }
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <p role="status">{saving ? 'Saving…' : notice}</p>
    </section>
  )
}
