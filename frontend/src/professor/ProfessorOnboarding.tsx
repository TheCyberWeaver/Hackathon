import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, FormEvent, PointerEvent } from 'react'
import type { CurrentUser } from '../lib/api'
import {
  normalizedCourseTitle,
  saveProfessorProfile,
  type ProfessorCourse,
} from './professorProfile'
import './professorOnboarding.css'

type Stage = 'welcome' | 'courses' | 'finishing' | 'success'

type CourseDrag = {
  course: ProfessorCourse
  x: number
  y: number
  width: number
  height: number
  dropping: boolean
}

function CourseGrip() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 20" fill="currentColor">
      <circle cx="5" cy="4" r="1.5" />
      <circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="10" r="1.5" />
      <circle cx="11" cy="10" r="1.5" />
      <circle cx="5" cy="16" r="1.5" />
      <circle cx="11" cy="16" r="1.5" />
    </svg>
  )
}

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
  const [courseDrag, setCourseDrag] = useState<CourseDrag | null>(null)
  const [courseRise, setCourseRise] = useState(0)
  const setupRef = useRef<HTMLElement>(null)
  const dragSessionRef = useRef<{
    courseId: string
    pointerId: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)
  const successTitleRef = useRef<HTMLHeadingElement>(null)
  const setupVisible = stage === 'courses' || stage === 'finishing'
  const hasCourses = courses.length > 0
  const dragVisible = courseDrag !== null
  const dropping = courseDrag?.dropping ?? false

  useEffect(() => {
    if (!dropping) return
    // Also finish when no transition fires (e.g. releasing in the same slot).
    const timeout = window.setTimeout(() => setCourseDrag(null), 280)
    return () => window.clearTimeout(timeout)
  }, [dropping])

  useEffect(() => {
    if (!dragVisible) return
    const stopOnBlur = () => {
      const session = dragSessionRef.current
      dragSessionRef.current = null
      if (session && setupRef.current?.hasPointerCapture(session.pointerId)) {
        setupRef.current.releasePointerCapture(session.pointerId)
      }
      setCourseDrag(null)
    }
    window.addEventListener('blur', stopOnBlur)
    return () => window.removeEventListener('blur', stopOnBlur)
  }, [dragVisible])

  useLayoutEffect(() => {
    const setup = setupRef.current
    if (!setupVisible || !setup) return
    const measurePosition = () => {
      const main = setup.parentElement!
      const footer = main.nextElementSibling as HTMLElement
      const mainStyle = getComputedStyle(main)
      const heading = setup.querySelector<HTMLElement>(
        '.professor-onboarding__setup-heading',
      )!
      const panel = setup.querySelector<HTMLElement>(
        '.professor-onboarding__course-panel',
      )!
      const listSection = setup.querySelector<HTMLElement>(
        '.professor-onboarding__list-section',
      )
      const list = setup.querySelector<HTMLElement>(
        '.professor-onboarding__list',
      )
      const listHeight = listSection
        ? listSection.offsetHeight +
          parseFloat(getComputedStyle(listSection).marginTop)
        : 0
      const headingHeight =
        heading.offsetHeight +
        parseFloat(getComputedStyle(heading).marginBottom)
      const panelBaseHeight = panel.offsetHeight - listHeight
      const besideHeading = getComputedStyle(setup).display === 'grid'
      // Only the empty form establishes the desktop anchor. The list gets
      // the remaining viewport space, including on compact landscape screens.
      const emptyHeight = besideHeading
        ? Math.max(headingHeight, panelBaseHeight)
        : headingHeight + panelBaseHeight
      const availableHeight =
        window.innerHeight -
        (main.getBoundingClientRect().top + window.scrollY) -
        footer.offsetHeight -
        parseFloat(mainStyle.paddingTop) -
        parseFloat(mainStyle.paddingBottom)
      setup.style.setProperty(
        '--setup-start-offset',
        `${Math.max(0, (availableHeight - emptyHeight) / 2)}px`,
      )
      setup.style.setProperty(
        '--course-list-space',
        `${availableHeight - (besideHeading ? panelBaseHeight : emptyHeight) - (listHeight - (list?.offsetHeight ?? 0))}px`,
      )
    }
    measurePosition()
    const frame = window.requestAnimationFrame(() => {
      setup.dataset.positioned = 'true'
    })
    const observer = new ResizeObserver(measurePosition)
    setup
      .querySelectorAll(
        '.professor-onboarding__setup-heading, form, .professor-onboarding__panel-footer',
      )
      .forEach((element) => observer.observe(element))
    window.addEventListener('resize', measurePosition)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', measurePosition)
    }
  }, [setupVisible, hasCourses])

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
    // Keep the highest reached position, including after courses are removed.
    setCourseRise((current) =>
      Math.max(current, Math.min(courses.length + 1, 5) / 5),
    )
    setDraft('')
    setAddError('')
    setSaveError('')
    addInputRef.current?.focus({ preventScroll: true })
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
    if (!event.isPrimary || event.button !== 0 || courseDrag || editingId)
      return
    const course = courses.find((item) => item.id === courseId)
    const row = event.currentTarget.closest('li')
    const setup = setupRef.current
    if (!course || !row || !setup) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    const rect = row.getBoundingClientRect()
    dragSessionRef.current = {
      courseId,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    }
    // This section never moves in the DOM when React reorders course rows.
    setup.setPointerCapture(event.pointerId)
    setCourseDrag({
      course,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      dropping: false,
    })
  }

  function dragOverCourse(event: PointerEvent<HTMLElement>) {
    const session = dragSessionRef.current
    if (!session || event.pointerId !== session.pointerId) return
    setCourseDrag(
      (current) =>
        current && {
          ...current,
          x: event.clientX - session.offsetX,
          y: event.clientY - session.offsetY,
        },
    )
    // Vertical slots still work when the pointer is beside/outside the panel.
    const rows = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[data-course-id]'),
    ).filter((row) => row.dataset.courseId !== session.courseId)
    const insertionIndex = rows.filter((row) => {
      const rect = row.getBoundingClientRect()
      return event.clientY > rect.top + rect.height / 2
    }).length
    setCourses((current) => {
      const from = current.findIndex((course) => course.id === session.courseId)
      if (from < 0 || from === insertionIndex) return current
      const reordered = [...current]
      const [course] = reordered.splice(from, 1)
      reordered.splice(insertionIndex, 0, course)
      return reordered
    })
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    const session = dragSessionRef.current
    if (!session || event.pointerId !== session.pointerId) return
    dragSessionRef.current = null
    const setup = setupRef.current
    if (setup?.hasPointerCapture(session.pointerId)) {
      setup.releasePointerCapture(session.pointerId)
    }
    const row = setup?.querySelector<HTMLElement>(
      `[data-course-id="${session.courseId}"]`,
    )
    if (!row || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCourseDrag(null)
      return
    }
    const rect = row.getBoundingClientRect()
    setCourseDrag(
      (current) =>
        current && { ...current, x: rect.left, y: rect.top, dropping: true },
    )
  }

  function finishSetup() {
    if (
      stage !== 'courses' ||
      courseDrag ||
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

  const canFinish =
    courses.length > 0 && !editingId && !draft.trim() && !courseDrag

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

        {setupVisible && (
          <section
            ref={setupRef}
            className="professor-onboarding__setup"
            style={{ '--course-rise': courseRise } as CSSProperties}
            aria-labelledby="course-setup-title"
            inert={stage === 'finishing'}
            onPointerMove={dragOverCourse}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={(event) => {
              if (event.target === event.currentTarget) endDrag(event)
            }}
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
              <p>You can change them later in Settings.</p>
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
                  </div>
                  <ul
                    className="professor-onboarding__list"
                    aria-label="Your courses"
                  >
                    {courses.map((course) => (
                      <li
                        key={course.id}
                        data-course-id={course.id}
                        className={
                          courseDrag?.course.id === course.id
                            ? 'is-dragging'
                            : ''
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
                        >
                          <CourseGrip />
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
      {courseDrag &&
        createPortal(
          <div className="professor-onboarding__drag-layer" aria-hidden="true">
            <div
              className={`professor-onboarding__drag-position${courseDrag.dropping ? ' is-dropping' : ''}`}
              style={{
                width: courseDrag.width,
                height: courseDrag.height,
                transform: `translate3d(${courseDrag.x}px, ${courseDrag.y}px, 0)`,
              }}
            >
              <div className="professor-onboarding__drag-card">
                <span className="professor-onboarding__drag">
                  <CourseGrip />
                </span>
                <span className="professor-onboarding__course-title">
                  {courseDrag.course.title}
                </span>
                <span className="professor-onboarding__drag-remove">×</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
