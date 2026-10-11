import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  courseTitleError,
  newCourseId,
  type ProfessorCourse,
} from './professorProfile'

const saveDelay = 500

export default function CourseChooser({
  courses,
  busy,
  error,
  onChoose,
  onSaveCourses,
}: {
  courses: ProfessorCourse[]
  busy: boolean
  error: string
  onChoose: (course: ProfessorCourse) => void
  onSaveCourses: (courses: ProfessorCourse[]) => Promise<void>
}) {
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveImmediately, setSaveImmediately] = useState(false)
  const [editorId, setEditorId] = useState<string | null>(null)
  const lastSavedTitle = useRef('')
  const failedTitle = useRef('')
  const inFlight = useRef(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const focusOption = useRef(0)
  const course = courses.find((item) => item.id === selectedCourseId)
  const editedCourse = courses.find((item) => item.id === editorId)
  const title = draft.trim()
  const validation =
    adding && title
      ? courseTitleError(courses, title, editorId ?? undefined)
      : ''
  const draftSaved = !!editedCourse && editedCourse.title === title
  const canStart =
    !!course && !busy && (!adding || (draftSaved && !saving && !validation))

  useEffect(() => {
    if (!menuOpen) return
    optionRefs.current[focusOption.current]?.focus()
    const closeOutside = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [menuOpen])

  useEffect(() => {
    const id = editorId
    if (!adding || !id || busy || inFlight.current || !title || validation)
      return
    if (editedCourse?.title === title || failedTitle.current === title) return
    // Wait for the parent's updated profile before saving another edit.
    if (lastSavedTitle.current && !editedCourse) return

    const timer = window.setTimeout(
      () => {
        inFlight.current = true
        setSaving(true)
        setSaveImmediately(false)
        setSaveError('')
        const nextCourses = editedCourse
          ? courses.map((item) => (item.id === id ? { ...item, title } : item))
          : [...courses, { id, title }]
        void onSaveCourses(nextCourses)
          .then(() => {
            lastSavedTitle.current = title
            setSelectedCourseId(id)
            setSaveError('')
          })
          .catch((cause: unknown) => {
            failedTitle.current = title
            setSaveError(
              cause instanceof Error
                ? cause.message
                : 'Could not save this course.',
            )
          })
          .finally(() => {
            inFlight.current = false
            setSaving(false)
          })
      },
      saveImmediately ? 0 : saveDelay,
    )
    return () => window.clearTimeout(timer)
  }, [
    adding,
    busy,
    courses,
    editedCourse,
    editorId,
    onSaveCourses,
    saveImmediately,
    title,
    validation,
    saving,
  ])

  function startAdding() {
    setEditorId(newCourseId())
    lastSavedTitle.current = ''
    failedTitle.current = ''
    setDraft('')
    setSaveError('')
    setAdding(true)
    setMenuOpen(false)
  }

  function stopAdding() {
    if (saving) return
    setEditorId(null)
    lastSavedTitle.current = ''
    failedTitle.current = ''
    setDraft('')
    setSaveError('')
    setAdding(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const last = courses.length
    let next = index
    if (event.key === 'ArrowDown') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowUp') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else if (event.key === 'Escape') {
      event.preventDefault()
      setMenuOpen(false)
      triggerRef.current?.focus()
      return
    } else return
    event.preventDefault()
    optionRefs.current[next]?.focus()
  }

  return (
    <div className="course-manager course-chooser">
      <div ref={pickerRef} className="course-picker">
        <span id="course-picker-label" className="course-picker-label">
          Course
        </span>
        {adding ? (
          <div
            className={`course-picker-field course-picker-field--editing${validation || saveError ? ' course-picker-field--invalid' : ''}`}
          >
            <input
              id="lecture-course-input"
              autoFocus
              aria-labelledby="course-picker-label"
              aria-invalid={!!validation || !!saveError}
              aria-describedby="course-picker-status"
              className="course-picker-input"
              placeholder="Name your new course"
              value={draft}
              maxLength={120}
              onChange={(event) => {
                setDraft(event.target.value)
                setSaveError('')
                setSaveImmediately(false)
                failedTitle.current = ''
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') stopAdding()
                if (event.key === 'Enter') {
                  event.preventDefault()
                  failedTitle.current = ''
                  setSaveImmediately(true)
                }
              }}
            />
            <button
              type="button"
              className="course-picker-clear"
              aria-label="Close course entry"
              disabled={saving}
              onClick={stopAdding}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M5 5 19 19M19 5 5 19" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            ref={triggerRef}
            id="lecture-course"
            type="button"
            className="course-picker-field course-picker-trigger"
            aria-labelledby="course-picker-label lecture-course"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls="course-picker-options"
            disabled={busy}
            onClick={() => {
              focusOption.current = Math.max(
                0,
                courses.findIndex((item) => item.id === selectedCourseId),
              )
              setMenuOpen((open) => !open)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                focusOption.current =
                  event.key === 'ArrowUp' ? courses.length : 0
                setMenuOpen(true)
              }
              if (event.key === 'Escape') setMenuOpen(false)
            }}
          >
            <span
              className={
                course ? 'course-picker-value' : 'course-picker-placeholder'
              }
            >
              {course?.title ?? 'Select a course'}
            </span>
            <svg
              aria-hidden="true"
              className="course-picker-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}
        {menuOpen && !adding && (
          <div
            id="course-picker-options"
            className="course-picker-menu"
            role="menu"
            aria-labelledby="course-picker-label"
            onBlur={(event) => {
              if (!pickerRef.current?.contains(event.relatedTarget as Node))
                setMenuOpen(false)
            }}
          >
            {courses.map((item, index) => (
              <button
                key={item.id}
                ref={(element) => {
                  optionRefs.current[index] = element
                }}
                type="button"
                role="menuitemradio"
                aria-checked={item.id === selectedCourseId}
                className="course-picker-option"
                onClick={() => {
                  setSelectedCourseId(item.id)
                  setMenuOpen(false)
                  triggerRef.current?.focus()
                }}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                <span>{item.title}</span>
                {item.id === selectedCourseId && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                )}
              </button>
            ))}
            <button
              ref={(element) => {
                optionRefs.current[courses.length] = element
              }}
              type="button"
              role="menuitem"
              className="course-picker-option course-picker-add"
              onClick={startAdding}
              onKeyDown={(event) => handleOptionKeyDown(event, courses.length)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Add course</span>
            </button>
          </div>
        )}
        {adding && (
          <p
            id="course-picker-status"
            className="course-picker-status"
            role={validation || saveError ? 'alert' : 'status'}
          >
            {validation ||
              (saveError
                ? `${saveError} Press Enter to retry.`
                : saving
                  ? 'Saving…'
                  : draftSaved
                    ? 'Saved automatically'
                    : 'Saves automatically as you type')}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <div className="course-actions">
        <button
          type="button"
          className="course-primary"
          disabled={!canStart}
          onClick={() => {
            if (course && canStart) onChoose(course)
          }}
        >
          {busy ? 'Please wait…' : 'Start session'}
        </button>
      </div>
    </div>
  )
}
