import { test, expect, type Page } from '@playwright/test'
import type { Lecture } from '../src/lib/poolApi'
import type { Question } from '../src/student/lib/studentApi'

const lecture = (
  id: string,
  title: string,
  start: string | null,
  ended = true,
): Lecture => ({
  id,
  title,
  startedAt: start,
  lectureTime: '2026-10-10T07:00:00Z',
  endedAt: ended ? '2026-10-11T12:00:00Z' : null,
  questionsPaused: ended,
  course: title,
  canManage: false,
})
const longTitle =
  'Linear Algebra — Vector spaces, linear transformations and applications to high-dimensional data'
const archived = [
  lecture('12', 'Morning lecture', '2026-10-11T07:15:00Z'),
  lecture('11', 'Earlier lecture', null),
  lecture('13', longTitle, '2026-10-11T09:15:00Z'),
  lecture('14', 'Same start time', '2026-10-11T09:15:00Z'),
]
const live = lecture(
  '90',
  'Currently joined lecture',
  '2026-10-11T12:15:00Z',
  false,
)
const question = (
  id: string,
  mine = false,
  status: Question['status'] = 'open',
): Question => ({
  id,
  mine,
  status,
  text: `Question ${id}: how does this proof work?`,
  votes: 0,
  votedByMe: false,
  createdAt: '2026-10-11T12:30:00Z',
})
async function fixture(
  page: Page,
  lectures = [
    ...archived,
    live,
    lecture('91', 'Scheduled lecture', null, false),
  ],
) {
  let items = [question('own', true), question('peer')]
  const reads: Record<string, number> = {}
  const mutations: string[] = []
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (method !== 'GET') mutations.push(path)
    reads[path] = (reads[path] || 0) + 1
    let data: unknown
    if (path === '/api/me') data = { id: 'student-design', name: 'Student' }
    else if (path === '/api/lectures') data = lectures
    else if (path === '/api/sessions/mine')
      data = {
        session: {
          id: live.id,
          code: live.id,
          course: live.title,
          startedAt: live.startedAt,
        },
      }
    else if (path === '/api/lectures/90/questions') {
      if (method === 'POST') {
        const created = {
          ...question('new', true),
          text: route.request().postDataJSON().text,
          createdAt: '2026-10-11T12:45:00Z',
        }
        items = [created, ...items]
        data = created
      } else data = items
    } else if (path === '/api/lectures/13/questions')
      data = [question('answered', false, 'answered'), question('unanswered')]
    else if (path === '/api/lectures/12/questions') data = [question('single')]
    else if (/\/api\/lectures\/\d+\/questions/.test(path)) data = []
    else throw new Error(`Unexpected API request: ${method} ${path}`)
    await route.fulfill({ json: data })
  })
  return {
    reads,
    mutations,
    clear: () => {
      items = []
    },
  }
}
async function navigate(page: Page, name: string) {
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name, exact: true }).click()
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
}

for (const width of [320, 390, 768, 1280]) {
  test(`history sorting, expansion, counts and live continuity at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const data = await fixture(page)
    await page.goto('/student')
    await expect(page.locator('textarea')).toBeEnabled()
    if (width === 1280) {
      await expect(page.getByRole('tablist')).toHaveCount(0)
      await expect(page.locator('.desktop-your')).toContainText('Question own:')
      await expect(page.locator('.desktop-other')).toContainText(
        'Question peer:',
      )
    }
    await page.locator('textarea').fill('Keep this unsent draft')
    await navigate(page, 'Past Lectures')
    const summaries = page.locator('.student-history-summary')
    const titles = page.locator('.student-history-title')
    await expect(summaries).toHaveCount(4)
    await expect(titles).toHaveText([
      longTitle,
      'Same start time',
      'Morning lecture',
      'Earlier lecture',
    ])
    await expect(
      page.locator('.student-history-summary[aria-expanded=true]'),
    ).toHaveCount(0)
    const row = page
      .locator('.student-history-entry')
      .filter({ hasText: longTitle })
    await expect(row).toContainText('2 questions')
    await expect(row.locator('time')).toHaveAttribute(
      'datetime',
      '2026-10-11T09:15:00.000Z',
    )
    await expect(
      page
        .locator('.student-history-entry')
        .filter({ hasText: 'Morning lecture' }),
    ).toContainText('1 question')
    await row.getByRole('button').click()
    await expect(row.locator('.student-history-question')).toHaveCount(2)
    await expect(row.getByText('Answered', { exact: true })).toBeVisible()
    await expect(row.getByText('Unanswered', { exact: true })).toBeVisible()
    const readsBefore = { ...data.reads }
    await page.getByLabel('Sort lectures by date').selectOption('oldest')
    await expect(titles).toHaveText([
      'Earlier lecture',
      'Morning lecture',
      longTitle,
      'Same start time',
    ])
    await expect(row.getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await row.getByRole('button').press('Enter')
    await expect(row.getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await row.getByRole('button').press('Space')
    await expect(row.getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    for (const id of ['11', '12', '13', '14'])
      expect(data.reads[`/api/lectures/${id}/questions`]).toBe(
        readsBefore[`/api/lectures/${id}/questions`],
      )
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect
      .poll(() => data.reads['/api/lectures'])
      .toBeGreaterThan(readsBefore['/api/lectures'])
    await expect(page.getByLabel('Sort lectures by date')).toHaveValue('oldest')
    await expect(row.getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    const empty = page
      .locator('.student-history-entry')
      .filter({ hasText: 'Earlier lecture' })
    await expect(empty).toContainText('0 questions')
    await empty.getByRole('button').click()
    await expect(empty.getByText('No questions in this lecture.')).toBeVisible()
    await page.getByLabel('Sort lectures by date').selectOption('newest')
    await expect(titles).toHaveText([
      longTitle,
      'Same start time',
      'Morning lecture',
      'Earlier lecture',
    ])
    await noOverflow(page)
    await page.screenshot({
      path: info.outputPath(`student-history-${width}.png`),
      fullPage: true,
    })
    await navigate(page, 'Current Lecture')
    await expect(page.locator('.student-session-course')).toHaveText(live.title)
    await expect(page.locator('textarea')).toHaveValue('Keep this unsent draft')
    expect(new URL(page.url()).searchParams.get('lecture')).toBe(live.id)
    expect(data.mutations).toEqual([])
  })
}

for (const width of [320, 390, 768]) {
  test(`mobile direct tabs, keyboard, empty state and successful submission at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({
      reducedMotion: width === 390 ? 'no-preference' : 'reduce',
    })
    const data = await fixture(page)
    await page.goto('/student')
    const mine = page.getByRole('tab', { name: 'Your questions', exact: true })
    const other = page.getByRole('tab', {
      name: 'Other questions',
      exact: true,
    })
    await expect(other).toHaveAttribute('aria-selected', 'true')
    await expect(mine).toBeVisible()
    await expect(page.locator('.view-switch')).toHaveCount(0)
    await expect(page.getByRole('tabpanel')).toContainText('Question peer:')
    await expect(page.getByRole('tabpanel')).not.toContainText('Question own:')
    await mine.click()
    await expect(mine).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel')).toContainText('Question own:')
    await expect(page.getByRole('tabpanel')).not.toContainText('Question peer:')
    const reads = data.reads['/api/lectures/90/questions']
    const scroll = await page.evaluate(() => scrollY)
    await mine.click()
    expect(await page.evaluate(() => scrollY)).toBe(scroll)
    expect(data.reads['/api/lectures/90/questions']).toBe(reads)
    await mine.press('ArrowRight')
    await expect(other).toBeFocused()
    await expect(other).toHaveAttribute('aria-selected', 'true')
    await other.press('Home')
    await expect(mine).toBeFocused()
    await mine.press('End')
    await expect(other).toBeFocused()
    await page.locator('textarea').fill('A newly submitted question')
    await page
      .getByRole('button', { name: 'Send question', exact: true })
      .click()
    await expect(mine).toHaveAttribute('aria-selected', 'true')
    const newQuestion = page
      .getByRole('tabpanel')
      .locator('.question-card')
      .filter({ hasText: 'A newly submitted question' })
    await expect(newQuestion).toBeInViewport()
    await expect(newQuestion).toHaveClass(/question-card--new/)
    await newQuestion
      .getByRole('button', { name: /upvotes on your question/ })
      .click()
    await expect(newQuestion.getByRole('tooltip')).toBeVisible()
    await noOverflow(page)
    await page.screenshot({
      path: info.outputPath(`student-tabs-${width}.png`),
      fullPage: true,
    })
    await page.evaluate(() =>
      document
        .querySelector('.mobile-question-tabs')
        ?.scrollIntoView({ block: 'start', behavior: 'instant' }),
    )
    data.clear()
    await other.click()
    await expect(page.getByRole('tabpanel')).toHaveText(
      'No questions from other students yet.',
    )
    await mine.click()
    await expect(page.getByRole('tabpanel')).toHaveText(
      'Questions you send will appear here.',
    )
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0)
    await noOverflow(page)
  })
}

test('history loading, failure, retry, stale data retention and empty history', async ({
  page,
}) => {
  await fixture(page)
  let release!: () => void
  const delayed = new Promise<void>((resolve) => {
    release = resolve
  })
  let failed = true
  await page.route('**/api/lectures/13/questions', async (route) => {
    await delayed
    await route.fulfill(
      failed
        ? { status: 503, json: { error: 'Unavailable' } }
        : { json: [question('recovered')] },
    )
  })
  await page.goto('/student/past-lectures')
  const row = page
    .locator('.student-history-entry')
    .filter({ hasText: longTitle })
  await expect(row).toContainText('Loading count…')
  await row.getByRole('button').click()
  await expect(row).toContainText('Loading questions…')
  await expect(row).not.toContainText('0 questions')
  release()
  await expect(row).toContainText('Count unavailable')
  await expect(row).toContainText('Could not load questions.')
  await expect(
    page
      .locator('.student-history-entry')
      .filter({ hasText: 'Morning lecture' }),
  ).toContainText('1 question')
  failed = false
  await row.getByRole('button', { name: 'Try again' }).click()
  await expect(row).toContainText('1 question')
  await expect(row).toContainText('Question recovered:')
  failed = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(row).toContainText('Showing the last loaded questions.')
  await expect(row).toContainText('1 question')
  await expect(row).toContainText('Question recovered:')
  await page.route('**/api/lectures', (route) =>
    route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
  )
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText(/Could not refresh past lectures/)).toBeVisible()
  await expect(page.locator('.student-history-summary')).toHaveCount(4)
  await page.unroute('**/api/lectures')
  await page
    .getByRole('button', { name: 'Try again', exact: true })
    .first()
    .click()
  await expect(page.getByText(/Could not refresh past lectures/)).toHaveCount(0)
  await page.route('**/api/lectures', (route) =>
    route.fulfill({ json: [live] }),
  )
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText('No past lectures yet.')).toBeVisible()
})
