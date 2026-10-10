import { useEffect, useRef, useState } from 'react'
import type { CurrentUser } from '../lib/api'
import { GearIcon, PanelIcon, ProfileIcon } from './Icons'
import './side-panel.css'

export type SidePanelPage =
  'questions' | 'pastLectures' | 'profile' | 'settings'

type SidePanelProps = {
  user: CurrentUser
  role: 'student' | 'professor'
  page: SidePanelPage | null
  onNavigate: (page: SidePanelPage) => void
  launcherClassName?: string
}

export default function SidePanel({
  user,
  role,
  page,
  onNavigate,
  launcherClassName = '',
}: SidePanelProps) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const dialogId = `${role}-side-panel`

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [open])

  useEffect(() => {
    const handlePopstate = () => {
      if (closeTimerRef.current !== null)
        window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
      setOpen(false)
      setClosing(false)
    }
    window.addEventListener('popstate', handlePopstate)
    return () => {
      window.removeEventListener('popstate', handlePopstate)
      if (closeTimerRef.current !== null)
        window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  function close(nextPage?: SidePanelPage) {
    if (closeTimerRef.current !== null) return
    setClosing(true)
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 180
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      setOpen(false)
      setClosing(false)
      if (nextPage) onNavigate(nextPage)
      else window.requestAnimationFrame(() => triggerRef.current?.focus())
    }, delay)
  }

  return (
    <>
      <div className={`side-panel-launcher ${launcherClassName}`}>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls={dialogId}
          onClick={() => setOpen(true)}
          className="side-panel-toggle"
        >
          <PanelIcon className="size-5" />
        </button>
        <span className="side-panel-brand">ASKPOOL</span>
      </div>

      {open && (
        <dialog
          ref={dialogRef}
          id={dialogId}
          aria-label="Navigation"
          data-closing={closing}
          onCancel={(event) => {
            event.preventDefault()
            close()
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return
            const bounds = event.currentTarget.getBoundingClientRect()
            if (event.clientX > bounds.right) close()
          }}
          className="side-panel"
        >
          <div className="side-panel-heading">
            <button
              type="button"
              autoFocus
              aria-label="Close navigation"
              onClick={() => close()}
              className="side-panel-toggle"
            >
              <PanelIcon className="size-5" />
            </button>
            <span className="side-panel-brand">ASKPOOL</span>
          </div>

          <nav
            aria-label={`${role === 'student' ? 'Student' : 'Professor'} navigation`}
            className="side-panel-nav"
          >
            <button
              type="button"
              onClick={() => close('questions')}
              aria-current={page === 'questions' ? 'page' : undefined}
              className="side-panel-link"
            >
              Current Lecture
            </button>
            <button
              type="button"
              onClick={() => close('pastLectures')}
              aria-current={page === 'pastLectures' ? 'page' : undefined}
              className="side-panel-link"
            >
              Past Lectures
            </button>
          </nav>

          <div className="side-panel-footer">
            <div className="side-panel-account">
              <button
                type="button"
                onClick={() => close('profile')}
                aria-current={page === 'profile' ? 'page' : undefined}
                className="side-panel-profile"
              >
                <span className="side-panel-avatar">
                  <ProfileIcon className="size-5" />
                </span>
                <span className="side-panel-person">
                  <span className="side-panel-name">{user.name}</span>
                  <span className="side-panel-email">{user.id}</span>
                </span>
              </button>
              <button
                type="button"
                aria-label="Settings"
                aria-current={page === 'settings' ? 'page' : undefined}
                onClick={() => close('settings')}
                className="side-panel-settings"
              >
                <GearIcon className="size-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="side-panel-logout"
            >
              Log out
            </button>
          </div>
        </dialog>
      )}
    </>
  )
}
