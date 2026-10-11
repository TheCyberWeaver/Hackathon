import { test, expect, type BrowserContext } from '@playwright/test'

async function api(
  context: BrowserContext,
  method: string,
  path: string,
  data?: unknown,
) {
  const response = await context.request.fetch(`/api${path}`, { method, data })
  expect(response.ok(), await response.text()).toBeTruthy()
  return response.status() === 204 ? undefined : response.json()
}

for (const mobile of [false, true]) {
  test(`live student count and persisted lecture timer (${mobile ? 'mobile' : 'desktop'})`, async ({
    browser,
  }, info) => {
    const identity = `session-stats-${Date.now()}-${mobile}`
    const owner = await browser.newContext({
      baseURL: 'http://127.0.0.1:5186',
      extraHTTPHeaders: { 'X-User-Id': identity },
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    })
    const student = await browser.newContext({
      baseURL: 'http://127.0.0.1:5186',
      extraHTTPHeaders: { 'X-User-Id': `${identity}-student` },
    })
    try {
      await api(owner, 'POST', '/professor/profile/initialize', {
        onboardingCompleted: true,
        courses: [],
      })
      const created = await api(owner, 'POST', '/lectures', {
        title: 'Algorithms and data structures',
        course: 'Algorithms',
        lectureTime: new Date().toISOString(),
      })
      const lecture = await api(
        owner,
        'PATCH',
        `/lectures/${created.id}/session`,
        { action: 'start' },
      )
      const page = await owner.newPage()
      const initialTime = Date.parse(lecture.startedAt) + 65_000
      await page.clock.install({ time: new Date(initialTime) })
      // Fix Date without freezing the timers React needs to finish lazy loading.
      let lectureNow = initialTime + 1000
      await page.clock.setFixedTime(new Date(lectureNow))
      async function advance(milliseconds: number) {
        lectureNow += milliseconds
        await page.clock.setFixedTime(new Date(lectureNow))
        await page.clock.fastForward(milliseconds)
      }
      await page.goto(`/professor?lecture=${lecture.id}`)
      const stats = page.getByLabel('Live lecture statistics')
      const count = stats.locator('dd').first()
      const timer = page.getByRole('timer', { name: 'Lecture elapsed time' })
      await expect(count).toHaveText('0')
      await expect(timer).toHaveText('01:06')
      await advance(1000)
      await expect(timer).toHaveText('01:07')

      await api(student, 'POST', '/sessions/join', {
        code: lecture.joinCode ?? lecture.id,
      })
      await advance(5000)
      await expect(count).toHaveText('1')
      await expect(timer).toHaveText('01:12')
      await page.reload()
      await expect(count).toHaveText('1')
      await expect(timer).toHaveText('01:12')

      await page
        .getByRole('button', { name: 'Pause questions', exact: true })
        .click()
      await expect(
        page.getByRole('button', { name: 'Resume questions', exact: true }),
      ).toBeVisible()
      await advance(3_600_000)
      await expect(timer).toHaveText('1:01:12')
      await expect(count).toHaveText('1')
      await page
        .getByRole('button', { name: 'Resume questions', exact: true })
        .click()
      await expect(
        page.getByRole('button', { name: 'Pause questions', exact: true }),
      ).toBeVisible()
      await expect(timer).toHaveText('1:01:12')

      const statsUrl = `**/api/lectures/${lecture.id}/professor/session-stats`
      await page.route(statsUrl, (route) =>
        route.fulfill({
          status: 503,
          json: { error: 'Temporarily unavailable' },
        }),
      )
      await advance(5000)
      await expect(count).toHaveText('Unavailable')
      await expect(timer).toHaveText('1:01:17')
      await page.unroute(statsUrl)
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await expect(count).toHaveText('1')

      await page.screenshot({
        path: info.outputPath('live-session-stats.png'),
        fullPage: true,
      })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      await api(student, 'DELETE', '/sessions/mine')
      await advance(5000)
      await expect(count).toHaveText('0')
      await page
        .getByRole('button', { name: 'End lecture', exact: true })
        .click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'End lecture', exact: true })
        .click()
      await expect(stats).toHaveCount(0)
      await page.reload()
      await expect(
        page.getByRole('heading', { name: 'Past Lectures', exact: true }),
      ).toBeVisible()
      await expect(stats).toHaveCount(0)
      await page.goto(`/professor?lecture=${lecture.id}`)
      await expect(
        page.getByRole('button', { name: 'Start lecture', exact: true }),
      ).toBeVisible()
      await expect(stats).toHaveCount(0)
    } finally {
      await owner.close()
      await student.close()
    }
  })
}
