import { test, expect, type BrowserContext, type Page } from '@playwright/test'
async function api(
  c: BrowserContext,
  method: string,
  path: string,
  data?: unknown,
) {
  const response = await c.request.fetch(`/api${path}`, { method, data })
  expect(response.ok(), await response.text()).toBeTruthy()
  return response.status() === 204 ? null : response.json()
}
async function nav(p: Page, name: string) {
  await p.getByRole('button', { name: 'Open navigation' }).click()
  await p.getByRole('button', { name, exact: true }).click()
}
for (const width of [390, 1280])
  test(`course history lifecycle and navigation at ${width}px`, async ({
    browser,
  }, info) => {
    const suffix = `${Date.now()}-${width}`
    const actor = async (name: string) => {
      const context = await browser.newContext({
        baseURL: 'http://127.0.0.1:5186',
        extraHTTPHeaders: {
          'X-User-Id': `${name}-${suffix}`,
          'X-User-Name': name,
        },
        viewport: { width, height: 900 },
        reducedMotion: 'reduce',
      })
      return { context, page: await context.newPage() }
    }
    const owner = await actor('Professor'),
      learner = await actor('Student'),
      other = await actor('Other')
    try {
      let profile = await api(
        owner.context,
        'POST',
        '/professor/profile/initialize',
        {
          onboardingCompleted: true,
          courses: [
            { id: 'a', title: 'Algebra' },
            { id: 'b', title: 'Biology' },
            { id: 'c', title: 'Computer Science' },
          ],
        },
      )
      const sessions = []
      for (let i = 0; i < 5; i++) {
        const session = await api(owner.context, 'POST', '/lectures', {
          title: `Algebra session ${i + 1}`,
          courseId: 'a',
          lectureTime: new Date().toISOString(),
        })
        await api(owner.context, 'PATCH', `/lectures/${session.id}/session`, {
          action: 'start',
        })
        if (i < 2) {
          await api(learner.context, 'POST', '/sessions/join', {
            code: session.id,
          })
          await api(
            learner.context,
            'POST',
            `/lectures/${session.id}/questions`,
            { text: `Question from session ${i + 1}` },
          )
        }
        await api(owner.context, 'PATCH', `/lectures/${session.id}/session`, {
          action: 'end',
        })
        sessions.push(session)
      }
      const p = owner.page,
        s = learner.page
      await p.goto('/professor/past-lectures')
      await expect(p.locator('.course-card')).toHaveCount(3)
      await expect(
        p.locator('.course-card').filter({ hasText: 'Algebra' }),
      ).toContainText('5 sessions')
      await expect(
        p.locator('.course-card').filter({ hasText: 'Biology' }),
      ).toContainText('0 sessions')
      await expect(p.getByLabel('Date filter')).toHaveCount(0)
      await p.screenshot({
        path: info.outputPath('professor-overview.png'),
        fullPage: true,
      })
      await p.locator('.course-card').filter({ hasText: 'Biology' }).click()
      await expect(
        p.getByText(
          'No past sessions yet. Completed sessions will appear here.',
        ),
      ).toBeVisible()
      await p.getByRole('button', { name: 'Open navigation' }).click()
      await expect(
        p.getByRole('button', { name: 'Collapse courses' }),
      ).toHaveAttribute('aria-expanded', 'true')
      const before = p.url()
      await p.getByRole('button', { name: 'Collapse courses' }).click()
      expect(p.url()).toBe(before)
      await p.getByRole('button', { name: 'Expand courses' }).press('Enter')
      await p.getByRole('link', { name: 'Algebra', exact: true }).click()
      await expect(p.locator('details')).toHaveCount(5)
      await p.getByLabel('Sort sessions').selectOption('oldest')
      for (const dates of ['7', '30', 'custom']) {
        await p.getByLabel('Date filter').selectOption(dates)
        await expect(p.locator('details')).toHaveCount(5)
      }
      await p.getByLabel('From', { exact: true }).fill('2099-01-02')
      await p.getByLabel('To', { exact: true }).fill('2099-01-01')
      await expect(p.getByRole('alert')).toContainText('end date')
      await p.getByLabel('To', { exact: true }).fill('2099-01-03')
      await expect(p.getByText('No sessions match these dates.')).toBeVisible()
      await p.getByRole('button', { name: 'Clear date filter' }).first().click()
      await p.reload()
      await expect(p.getByLabel('Sort sessions')).toHaveValue('oldest')
      await expect(p.getByLabel('Date filter')).toHaveValue('all')
      await p.locator('summary').first().click()
      await expect(p.locator('details[open]')).toContainText(
        'Question from session 1',
      )
      await p.screenshot({
        path: info.outputPath('professor-sessions.png'),
        fullPage: true,
      })
      await s.goto('/student/past-lectures')
      await expect(s.locator('.course-card')).toHaveCount(1)
      await expect(s.locator('.course-card')).toContainText('2 sessions')
      await s.locator('.course-card').click()
      await expect(s.locator('.student-history-entry')).toHaveCount(2)
      await s.getByLabel('Sort sessions').selectOption('oldest')
      await s.getByLabel('Date filter').selectOption('30')
      await s.locator('.student-history-summary').first().click()
      await expect(s.locator('.student-history-question')).toHaveCount(1)
      await s.getByRole('button', { name: 'Open navigation' }).click()
      await expect(
        s.locator('.side-panel-course[aria-current="page"]'),
      ).toHaveText('Algebra')
      await s.screenshot({
        path: info.outputPath('student-sidebar.png'),
        fullPage: true,
      })
      await s.getByRole('button', { name: 'Close navigation' }).click()
      await s.getByRole('link', { name: '← Algebra' }).click()
      await expect(s.getByLabel('Sort sessions')).toHaveValue('oldest')
      await expect(s.getByLabel('Date filter')).toHaveValue('30')
      await s.goBack()
      await expect(s.locator('.student-history-question')).toHaveCount(1)
      await s.goForward()
      await expect(s.locator('.student-history-entry')).toHaveCount(2)
      // A running session remains attached even if its course is removed.
      const running = await api(owner.context, 'POST', '/lectures', {
        title: 'Final Algebra session',
        courseId: 'a',
        lectureTime: new Date().toISOString(),
      })
      await api(owner.context, 'PATCH', `/lectures/${running.id}/session`, {
        action: 'start',
      })
      await api(learner.context, 'POST', '/sessions/join', { code: running.id })
      profile = await api(owner.context, 'PUT', '/professor/profile', {
        ...profile,
        courses: [
          profile.courses[1],
          { ...profile.courses[0], title: 'Advanced Algebra' },
          profile.courses[2],
        ],
      })
      await s.evaluate(() => window.dispatchEvent(new Event('focus')))
      await expect(s.getByRole('heading', { level: 1 })).toHaveText(
        'Advanced Algebra',
      )
      await expect(s.locator('.student-history-title').first()).toHaveText(
        'Algebra session 1',
      )
      await api(owner.context, 'PUT', '/professor/profile', {
        ...profile,
        courses: [
          profile.courses[0],
          profile.courses[2],
          { id: 'new-a', title: 'Advanced Algebra' },
        ],
      })
      await api(owner.context, 'PATCH', `/lectures/${running.id}/session`, {
        action: 'end',
      })
      await s.evaluate(() => window.dispatchEvent(new Event('focus')))
      await expect(s.locator('.student-history-entry')).toHaveCount(3)
      await expect(s.locator('.course-badge')).toHaveText('Archived')
      await nav(p, 'Past Lectures')
      await expect(p.locator('.course-card')).toHaveCount(4)
      await expect(
        p.locator('.course-card').filter({ hasText: 'Archived' }),
      ).toContainText('6 sessions')
      // Another professor uses the same ID and display name; the student's groups remain separate.
      await api(other.context, 'POST', '/professor/profile/initialize', {
        onboardingCompleted: true,
        courses: [{ id: 'a', title: 'Advanced Algebra' }],
      })
      const foreign = await api(other.context, 'POST', '/lectures', {
        title: 'Other session',
        courseId: 'a',
        lectureTime: new Date().toISOString(),
      })
      await api(other.context, 'PATCH', `/lectures/${foreign.id}/session`, {
        action: 'start',
      })
      await api(learner.context, 'POST', '/sessions/join', { code: foreign.id })
      await api(other.context, 'PATCH', `/lectures/${foreign.id}/session`, {
        action: 'end',
      })
      await nav(s, 'Past Lectures')
      await expect(s.locator('.course-card')).toHaveCount(2)
      await expect(s.locator('.course-context')).toHaveCount(2)
      await s.screenshot({
        path: info.outputPath('student-overview.png'),
        fullPage: true,
      })
      await s.locator('.course-card').filter({ hasText: 'Archived' }).click()
      await expect(s.getByLabel('Sort sessions')).toHaveValue('newest')
      await expect(s.getByLabel('Date filter')).toHaveValue('all')
      await s.screenshot({
        path: info.outputPath('student-sessions.png'),
        fullPage: true,
      })
      for (let i = 0; i < 3; i++)
        await s
          .getByRole('button', { name: /^Remove .* from history$/ })
          .first()
          .click()
      await expect(
        s.getByText(
          'No saved sessions are available for this course in your history.',
        ),
      ).toBeVisible()
      await s.evaluate(() => window.dispatchEvent(new Event('focus')))
      await expect(s.locator('.student-history-entry')).toHaveCount(0)
      await nav(s, 'Past Lectures')
      await expect(s.locator('.course-card')).toHaveCount(1)
      expect(
        (await api(learner.context, 'GET', '/student/lectures/history')).map(
          (l: { id: string }) => l.id,
        ),
      ).toEqual([foreign.id])
      for (const page of [p, s])
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true)
    } finally {
      await Promise.all([
        owner.context.close(),
        learner.context.close(),
        other.context.close(),
      ])
    }
  })
