export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function animateScrollTo(
  destination: number,
  requestedDuration: number,
): Promise<void> {
  const duration = prefersReducedMotion() ? 25 : requestedDuration
  const start = window.scrollY
  const distance = Math.max(0, destination) - start
  if (Math.abs(distance) < 2) return Promise.resolve()

  const block = (event: Event) => event.preventDefault()
  const blockKeys = (event: KeyboardEvent) => {
    if (
      [
        'ArrowDown',
        'ArrowUp',
        'PageDown',
        'PageUp',
        'Home',
        'End',
        ' ',
      ].includes(event.key)
    ) {
      event.preventDefault()
    }
  }
  window.addEventListener('wheel', block, { passive: false, capture: true })
  window.addEventListener('touchmove', block, { passive: false, capture: true })
  window.addEventListener('keydown', blockKeys, { capture: true })

  return new Promise((resolve) => {
    const started = performance.now()
    function frame(now: number) {
      const progress = Math.min(1, (now - started) / duration)
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - (-2 * progress + 2) ** 2 / 2
      window.scrollTo(0, start + distance * eased)
      if (progress < 1) {
        requestAnimationFrame(frame)
      } else {
        window.removeEventListener('wheel', block, true)
        window.removeEventListener('touchmove', block, true)
        window.removeEventListener('keydown', blockKeys, true)
        resolve()
      }
    }
    requestAnimationFrame(frame)
  })
}

export function scrollToSection(element: HTMLElement): Promise<void> {
  return animateScrollTo(
    window.scrollY + element.getBoundingClientRect().top - 16,
    1000,
  )
}
