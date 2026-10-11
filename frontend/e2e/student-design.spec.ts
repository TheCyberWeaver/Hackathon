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
    else if (
      path === '/api/lectures' ||
      path === '/api/student/lectures/history'
    )
      data = lectures
    else if (path === '/api/student/summary')
      data = { submittedCount: 1, answeredCount: 0 }
    else if (/^\/api\/lectures\/\d+\/visits$/.test(path))
      data = lectures.find(
        (lecture) => path === `/api/lectures/${lecture.id}/visits`,
      )
    else if (/^\/api\/lectures\/\d+$/.test(path))
      data = lectures.find((lecture) => path === `/api/lectures/${lecture.id}`)
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
    setItems: (next: Question[]) => {
      items = next
    },
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

for (const width of [320, 430, 768, 1280]) {
  test(`history links, chronological sorting and live continuity at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 932 })
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
    const titles = page.locator('.student-history-title')
    await expect(titles).toHaveText([
      longTitle,
      'Same start time',
      'Morning lecture',
      'Earlier lecture',
    ])
    const row = page
      .locator('.student-history-entry')
      .filter({ hasText: longTitle })
    await expect(row).toContainText('2 questions')
    await expect(row.getByRole('link')).toHaveAttribute(
      'href',
      '/student?lecture=13',
    )
    await expect(row.locator('time')).toHaveAttribute(
      'datetime',
      '2026-10-11T09:15:00.000Z',
    )
    await expect(page.locator('.student-history-question')).toHaveCount(0)
    const readsBefore = { ...data.reads }
    await page.getByLabel('Sort lectures by date').selectOption('oldest')
    await expect(titles).toHaveText([
      'Earlier lecture',
      'Morning lecture',
      longTitle,
      'Same start time',
    ])
    for (const id of ['11', '12', '13', '14'])
      expect(data.reads[`/api/lectures/${id}/questions`]).toBe(
        readsBefore[`/api/lectures/${id}/questions`],
      )
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect
      .poll(() => data.reads['/api/student/lectures/history'])
      .toBeGreaterThan(readsBefore['/api/student/lectures/history'])
    await expect(page.getByLabel('Sort lectures by date')).toHaveValue('oldest')
    await row.getByRole('link').click()
    await page.getByRole('link', { name: '← Past Lectures' }).click()
    await expect(page.getByLabel('Sort lectures by date')).toHaveValue('oldest')
    await expect(titles).toHaveText([
      'Earlier lecture',
      'Morning lecture',
      longTitle,
      'Same start time',
    ])
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
    await row.getByRole('link').press('Enter')
    await expect(page).toHaveURL(/\/student\?lecture=13$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(longTitle)
    await expect(page.locator('.student-history-question')).toHaveCount(2)
    await expect(page.getByText('Answered', { exact: true })).toBeVisible()
    await expect(page.getByText('Unanswered', { exact: true })).toBeVisible()
    await expect(page.locator('textarea')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Leave lecture' }),
    ).toHaveCount(0)
    await page.screenshot({
      path: info.outputPath(`student-lecture-${width}.png`),
      fullPage: true,
    })
    await navigate(page, 'Current Lecture')
    await expect(page.locator('.student-session-course')).toHaveText(live.title)
    await expect(page.locator('textarea')).toHaveValue('Keep this unsent draft')
    expect(new URL(page.url()).searchParams.get('lecture')).toBeNull()
    await page.goBack()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(longTitle)
    await page.goBack()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Past Lectures',
    )
    // Direct and reloaded URLs must also show the archive, never the joined pool.
    await page.goto('/student?lecture=13')
    await expect(page.locator('.student-history-question')).toHaveCount(2)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(longTitle)
    await page.getByRole('link', { name: '← Past Lectures' }).click()
    const empty = page
      .locator('.student-history-entry')
      .filter({ hasText: 'Earlier lecture' })
    await expect(empty).toContainText('0 questions')
    await empty.getByRole('link').click()
    await expect(page).toHaveURL(/lecture=11$/)
    await expect(page.getByText('No questions in this lecture.')).toBeVisible()
    await noOverflow(page)
    expect(data.mutations.every((path) => path.endsWith('/visits'))).toBe(true)
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
  failed = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(row).toContainText('Showing the last loaded questions.')
  await expect(row).toContainText('1 question')
  await page.route('**/api/student/lectures/history', (route) =>
    route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
  )
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText(/Could not refresh past lectures/)).toBeVisible()
  await expect(page.locator('.student-history-summary')).toHaveCount(4)
  await page.unroute('**/api/student/lectures/history')
  await page
    .getByRole('button', { name: 'Try again', exact: true })
    .first()
    .click()
  await expect(page.getByText(/Could not refresh past lectures/)).toHaveCount(0)
  await page.route('**/api/student/lectures/history', (route) =>
    route.fulfill({ json: [live] }),
  )
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText('No past lectures yet.')).toBeVisible()
})

test('switching a long mobile list retains exact scroll depth in both directions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 932 })
  const data = await fixture(page)
  data.setItems(
    Array.from({ length: 18 }, (_, i) => question(`own-${i}`, true)),
  )
  await page.goto('/student')
  const mine = page.getByRole('tab', { name: 'Your questions', exact: true })
  const other = page.getByRole('tab', { name: 'Other questions', exact: true })
  await mine.click()
  await expect(
    page.getByRole('tabpanel').locator('.question-card'),
  ).toHaveCount(18)
  await mine.focus()
  await page.evaluate(() =>
    window.scrollTo({
      top:
        document.querySelector('.mobile-question-tabs')!.getBoundingClientRect()
          .top +
        scrollY +
        500,
      behavior: 'instant',
    }),
  )
  const scroll = await page.evaluate(() => scrollY)
  await mine.press('End')
  await expect(other).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel')).toHaveText(
    'No questions from other students yet.',
  )
  expect(await page.evaluate(() => scrollY)).toBe(scroll)
  expect(
    await page
      .locator('#questions-panel-other')
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom)),
  ).toBeGreaterThanOrEqual(932)
  await other.press('Home')
  await expect(mine).toHaveAttribute('aria-selected', 'true')
  expect(await page.evaluate(() => scrollY)).toBe(scroll)
})

test('a past lecture link works with no joined session and survives live-session polling', async ({
  page,
}) => {
  const data = await fixture(page)
  await page.clock.install()
  await page.goto('/student?lecture=13')
  await expect(page.locator('.student-history-question')).toHaveCount(2)
  await page.route('**/api/sessions/mine', (route) =>
    route.fulfill({ json: { session: null } }),
  )
  await page.clock.fastForward(11_000)
  await expect(page).toHaveURL(/lecture=13$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(longTitle)
  await page.reload()
  await expect(page.locator('.student-history-question')).toHaveCount(2)
  await expect(page.getByLabel('Lecture code')).toHaveCount(0)
  expect(data.mutations.every((path) => path.endsWith('/visits'))).toBe(true)
})

for (const width of [320, 430, 768, 1280]) {
  test(`professor toolbar and ranked card presentation at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 932 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      let data: unknown
      if (path === '/api/me')
        data = { id: 'professor-design', name: 'Professor' }
      else if (path === '/api/professor/profile/initialize')
        data = { onboardingCompleted: true, revision: 1, courses: [] }
      else if (path === '/api/lectures') data = [{ ...live, canManage: true }]
      else if (path === '/api/lectures/90/professor/questions')
        data = [0, 1, 2].map((i) => ({
          id: String(i),
          text: `Question ${i}: why does the dimension of the kernel plus the rank equal the number of columns?`,
          authorId: 'anonymous',
          upvoteCount: 3 - i,
          createdAt: new Date().toISOString(),
          answered: false,
          status: 'open',
          answeredAt: null,
          reportCount: 0,
        }))
      else throw new Error(`Unexpected professor request ${path}`)
      await route.fulfill({ json: data })
    })
    await page.goto('/professor?lecture=90')
    const clear = page.getByRole('button', {
      name: 'Clear all questions',
      exact: true,
    })
    const filter = page.getByLabel('Time filter')
    const card = page.locator('.professor-question-card').first()
    await expect(card).toBeVisible()
    await expect(clear).toBeEnabled()
    if (width < 720) {
      const clearBox = (await clear.boundingBox())!
      const filterBox = (await filter.boundingBox())!
      expect(
        Math.abs(clearBox.y + clearBox.height - filterBox.y - filterBox.height),
      ).toBeLessThanOrEqual(2)
      expect(filterBox.x).toBeGreaterThan(clearBox.x + clearBox.width)
    }
    await expect(page.locator('.professor-rank-decoration')).toHaveCount(0)
    await expect(card.locator('.professor-question-rank')).toHaveText('#1')
    await expect(card).toHaveCSS('background-color', 'rgb(239, 246, 255)')
    await expect(
      card.getByRole('button', { name: 'Mark answered', exact: true }),
    ).toHaveCSS('background-color', 'rgb(29, 78, 216)')
    await noOverflow(page)
    await page.screenshot({
      path: info.outputPath(`professor-cards-${width}.png`),
      fullPage: true,
    })
    await filter.selectOption('5')
    await expect(filter).toHaveValue('5')
    await expect(card).toBeVisible()
    await page.getByRole('tab', { name: 'Answered 0' }).click()
    await expect(filter).toHaveCount(0)
    await expect(clear).toHaveCount(0)
    await noOverflow(page)
  })
}
