import { useEffect, useRef, useState } from 'react'
import type { FormEvent, PointerEvent } from 'react'
import type { CurrentUser } from '../lib/api'
import {
  normalizedCourseTitle,
  saveProfessorProfile,
  type ProfessorCourse,
} from './professorProfile'
import './professorOnboarding.css'

type Stage = 'welcome' | 'courses' | 'finishing' | 'success'

function moveCourse(
  courses: ProfessorCourse[],
  sourceId: string,
  targetId: string,
) {
  const from = courses.findIndex((course) => course.id === sourceId)
  const to = courses.findIndex((course) => course.id === targetId)
  if (from < 0 || to < 0 || from === to) return courses
  const reordered = [...courses]
  const [course] = reordered.splice(from, 1)
  reordered.splice(to, 0, course)
  return reordered
}

export default function ProfessorOnboarding({
  user,
  onContinue,
}: {
  user: CurrentUser
  onContinue: () => void
}) {
  const [stage, setStage] = useState<Stage>('welcome')
  const [courses, setCourses] = useState<ProfessorCourse[]>([])
  const [draft, setDraft] = useState('')
  const [addError, setAddError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)
  const successTitleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (stage === 'success')
      successTitleRef.current?.focus({ preventScroll: true })
  }, [stage])

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame: number | undefined
    const skipMotion = () => {
      if (!motion.matches) return
      frame = window.requestAnimationFrame(() => {
        setStage((current) =>
          current === 'welcome'
            ? 'courses'
            : current === 'finishing'
              ? 'success'
              : current,
        )
      })
    }
    skipMotion()
    motion.addEventListener('change', skipMotion)
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      motion.removeEventListener('change', skipMotion)
    }
  }, [])

  function addCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = draft.trim()
    if (!title) {
      setAddError('Enter a course title first.')
      return
    }
    if (
      courses.some(
        (course) =>
          normalizedCourseTitle(course.title) === normalizedCourseTitle(title),
      )
    ) {
      setAddError('This course is already on your list.')
      return
    }
    setCourses((current) => [...current, { id: crypto.randomUUID(), title }])
    setDraft('')
    setAddError('')
    setSaveError('')
    addInputRef.current?.focus()
  }

  function beginRename(course: ProfessorCourse) {
    setEditingId(course.id)
    setEditValue(course.title)
    setEditError('')
    setSaveError('')
  }

  function finishRename(courseId: string) {
    if (editingId !== courseId) return
    const title = editValue.trim()
    if (!title) {
      setEditError('A course title cannot be empty.')
      return
    }
    if (
      courses.some(
        (course) =>
          course.id !== courseId &&
          normalizedCourseTitle(course.title) === normalizedCourseTitle(title),
      )
    ) {
      setEditError('This course is already on your list.')
      return
    }
    setCourses((current) =>
      current.map((course) =>
        course.id === courseId ? { ...course, title } : course,
      ),
    )
    setEditingId(null)
    setEditError('')
  }

  function removeCourse(courseId: string) {
    setCourses((current) => current.filter((course) => course.id !== courseId))
    if (editingId === courseId) {
      setEditingId(null)
      setEditError('')
    }
    setSaveError('')
  }

  function moveByOne(courseId: string, offset: number) {
    setCourses((current) => {
      const index = current.findIndex((course) => course.id === courseId)
      const target = current[index + offset]
      return target ? moveCourse(current, courseId, target.id) : current
    })
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, courseId: string) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragIdRef.current = courseId
    setDraggingId(courseId)
  }

  function dragOverCourse(event: PointerEvent<HTMLButtonElement>) {
    const sourceId = dragIdRef.current
    if (!sourceId) return
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-course-id]')
    const targetId = target?.dataset.courseId
    if (targetId && targetId !== sourceId) {
      setCourses((current) => moveCourse(current, sourceId, targetId))
    }
  }

  function endDrag() {
    dragIdRef.current = null
    setDraggingId(null)
  }

  function finishSetup() {
    if (
      stage !== 'courses' ||
      editingId ||
      draft.trim() ||
      courses.length === 0
    )
      return
    if (!saveProfessorProfile(user.id, courses)) {
      setSaveError('We could not save your courses in this browser. Try again.')
      return
    }
    setSaveError('')
    setStage(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'success'
        : 'finishing',
    )
  }

  const canFinish = courses.length > 0 && !editingId && !draft.trim()

  return (
    <div className={`professor-onboarding professor-onboarding--${stage}`}>
      <header className="professor-onboarding__header">
        <div className="professor-onboarding__brand" aria-label="AskPool">
          ASKPOOL
        </div>
      </header>

      <main className="professor-onboarding__main">
        {stage === 'welcome' && (
          <section
            className="professor-onboarding__intro"
            aria-live="polite"
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget) setStage('courses')
            }}
          >
            <h1>
              Welcome, <span>{user.name}.</span>
            </h1>
          </section>
        )}

        {(stage === 'courses' || stage === 'finishing') && (
          <section
            className="professor-onboarding__setup"
            aria-labelledby="course-setup-title"
            inert={stage === 'finishing'}
            onAnimationEnd={(event) => {
              if (stage === 'finishing' && event.target === event.currentTarget)
                setStage('success')
            }}
          >
            <div className="professor-onboarding__setup-heading">
              <h1 id="course-setup-title">What courses do you teach?</h1>
              <span
                className="professor-onboarding__underline"
                aria-hidden="true"
              />
              <p>
                Add the courses you want to use with AskPool. You can change
                them later in Settings.
              </p>
            </div>

            <div className="professor-onboarding__course-panel">
              <form onSubmit={addCourse} noValidate>
                <label htmlFor="new-professor-course">Add new course</label>
                <div className="professor-onboarding__composer">
                  <input
                    id="new-professor-course"
                    ref={addInputRef}
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value)
                      setAddError('')
                    }}
                    placeholder="e.g. HS26 Linear Algebra"
                    autoComplete="off"
                    aria-invalid={Boolean(addError)}
                    aria-describedby={addError ? 'course-add-error' : undefined}
                    maxLength={120}
                  />
                  <button
                    type="submit"
                    aria-label="Add course"
                    disabled={!draft.trim()}
                  >
                    <span aria-hidden="true">+</span>
                  </button>
                </div>
                {addError && (
                  <p
                    className="professor-onboarding__error"
                    id="course-add-error"
                    role="alert"
                  >
                    {addError}
                  </p>
                )}
              </form>

              {courses.length > 0 && (
                <div className="professor-onboarding__list-section">
                  <div className="professor-onboarding__list-heading">
                    <h2>Your courses</h2>
                    <span>{courses.length} added</span>
                  </div>
                  <p className="professor-onboarding__list-help">
                    Drag to change the order. Select a name to edit it.
                  </p>
                  <ul
                    className="professor-onboarding__list"
                    aria-label="Your courses"
                  >
                    {courses.map((course) => (
                      <li
                        key={course.id}
                        data-course-id={course.id}
                        className={
                          draggingId === course.id ? 'is-dragging' : ''
                        }
                      >
                        <button
                          type="button"
                          className="professor-onboarding__drag"
                          aria-label={`Drag ${course.title} to reorder`}
                          title="Drag to reorder, or use the up and down arrow keys"
                          aria-describedby="course-reorder-help"
                          onKeyDown={(event) => {
                            if (
                              event.key === 'ArrowUp' ||
                              event.key === 'ArrowDown'
                            ) {
                              event.preventDefault()
                              moveByOne(
                                course.id,
                                event.key === 'ArrowUp' ? -1 : 1,
                              )
                            }
                          }}
                          onPointerDown={(event) => startDrag(event, course.id)}
                          onPointerMove={dragOverCourse}
                          onPointerUp={endDrag}
                          onPointerCancel={endDrag}
                          onLostPointerCapture={endDrag}
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 16 20"
                            fill="currentColor"
                          >
                            <circle cx="5" cy="4" r="1.5" />
                            <circle cx="11" cy="4" r="1.5" />
                            <circle cx="5" cy="10" r="1.5" />
                            <circle cx="11" cy="10" r="1.5" />
                            <circle cx="5" cy="16" r="1.5" />
                            <circle cx="11" cy="16" r="1.5" />
                          </svg>
                        </button>
                        {editingId === course.id ? (
                          <div className="professor-onboarding__edit-wrap">
                            <input
                              autoFocus
                              aria-label={`Rename ${course.title}`}
                              aria-invalid={Boolean(editError)}
                              value={editValue}
                              onChange={(event) => {
                                setEditValue(event.target.value)
                                setEditError('')
                              }}
                              onBlur={() => finishRename(course.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter')
                                  finishRename(course.id)
                                if (event.key === 'Escape') {
                                  setEditingId(null)
                                  setEditError('')
                                }
                              }}
                              maxLength={120}
                            />
                            {editError && (
                              <span
                                role="alert"
                                className="professor-onboarding__error"
                              >
                                {editError}
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="professor-onboarding__course-title"
                            onClick={() => beginRename(course)}
                            title="Rename course"
                          >
                            {course.title}
                          </button>
                        )}
                        <div className="professor-onboarding__row-actions">
                          <button
                            type="button"
                            className="professor-onboarding__remove"
                            aria-label={`Remove ${course.title}`}
                            onClick={() => removeCourse(course.id)}
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <span id="course-reorder-help" className="sr-only">
                    Use the up and down arrow keys on a drag handle to change
                    the course order.
                  </span>
                </div>
              )}

              <div className="professor-onboarding__panel-footer">
                <button
                  type="button"
                  onClick={finishSetup}
                  disabled={!canFinish}
                >
                  Done <span aria-hidden="true">→</span>
                </button>
              </div>
              {saveError && (
                <p className="professor-onboarding__error" role="alert">
                  {saveError}
                </p>
              )}
            </div>
          </section>
        )}

        {stage === 'success' && (
          <section
            className="professor-onboarding__success"
            aria-labelledby="setup-success-title"
          >
            <span
              className="professor-onboarding__success-icon"
              aria-hidden="true"
            >
              ✓
            </span>
            <h1 id="setup-success-title" ref={successTitleRef} tabIndex={-1}>
              You’re all set.
            </h1>
            <p>
              {courses.length === 1
                ? 'Your course is ready in AskPool.'
                : `Your ${courses.length} courses are ready in AskPool.`}{' '}
              You can always make changes in the Settings.
            </p>
            <button type="button" onClick={onContinue}>
              Continue to dashboard <span aria-hidden="true">→</span>
            </button>
          </section>
        )}
      </main>

      <footer className="professor-onboarding__footer">
        <span>ASKPOOL / PROFESSOR</span>
      </footer>
    </div>
  )
}
