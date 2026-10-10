import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'

async function actor(browser: Browser, identity: string, mobile = false) {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5186',
    extraHTTPHeaders: { 'X-User-Id': identity, 'X-User-Name': identity },
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  })
  return { context, page: await context.newPage() }
}

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

async function lecture(context: BrowserContext, title: string) {
  const created = await api(context, 'POST', '/lectures', {
    title,
    course: title,
    lectureTime: new Date().toISOString(),
  })
  return api(context, 'PATCH', `/lectures/${created.id}/session`, {
    action: 'start',
  })
}

async function nav(page: Page, name: string) {
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name, exact: true }).click()
}

for (const mobile of [false, true]) {
  test(`personal history, ended review, and equal modes (${mobile ? 'mobile' : 'desktop'})`, async ({
    browser,
  }, info) => {
    const id = `history-${Date.now()}-${mobile}`
    const owner = await actor(browser, `owner-${id}`)
    const learner = await actor(browser, `learner-${id}`, mobile)
    const peer = await actor(browser, `peer-${id}`)
    const p = learner.page
    try {
      const past = await lecture(owner.context, 'Visited past lecture')
      for (const person of [learner, peer])
        await api(person.context, 'POST', '/sessions/join', { code: past.id })
      await api(learner.context, 'POST', `/lectures/${past.id}/questions`, {
        text: 'My saved question',
      })
      const question = await api(
        peer.context,
        'POST',
        `/lectures/${past.id}/questions`,
        { text: 'Shared saved question' },
      )
      await api(owner.context, 'PATCH', `/questions/${question.id}/status`, {
        status: 'answered',
      })
      await api(owner.context, 'PATCH', `/lectures/${past.id}/session`, {
        action: 'end',
      })
      const unseen = await lecture(owner.context, 'Unvisited lecture')
      await api(owner.context, 'PATCH', `/lectures/${unseen.id}/session`, {
        action: 'end',
      })
      const current = await lecture(owner.context, 'Current joined lecture')
      await api(learner.context, 'POST', '/sessions/join', { code: current.id })

      // The same authenticated learner can also teach, with a separate archive.
      await api(learner.context, 'POST', '/professor/profile/initialize', {
        onboardingCompleted: true,
        courses: [],
      })
      const taught = await lecture(learner.context, 'My teaching lecture')
      await api(learner.context, 'PATCH', `/lectures/${taught.id}/session`, {
        action: 'end',
      })

      await p.clock.install()
      await p.goto('/student/past-lectures')
      await expect(p.locator('.student-history-item')).toHaveCount(2)
      await expect(p.getByText(unseen.title)).toHaveCount(0)
      await expect(p.getByText(taught.title)).toHaveCount(0)
      await p
        .getByRole('button', { name: new RegExp(`^${past.title} —`) })
        .click()
      await expect(
        p.getByRole('heading', { name: 'This lecture has ended' }),
      ).toBeVisible()
      await expect(p.locator('.student-session-course')).toHaveText(past.title)
      await expect(p.locator('.question-card:visible')).toHaveCount(
        mobile ? 1 : 2,
      )
      await expect(p.locator('textarea')).toHaveCount(0)
      await expect(
        p.getByRole('button', { name: /^Upvote:|^More options for:/ }),
      ).toHaveCount(0)
      const sessionPoll = p.waitForResponse((response) =>
        response.url().endsWith('/api/sessions/mine'),
      )
      await p.clock.fastForward(11_000)
      await sessionPoll
      await expect(p.locator('.student-session-course')).toHaveText(past.title)
      expect(
        (await api(learner.context, 'GET', '/sessions/mine')).session.id,
      ).toBe(current.id)
      await p.screenshot({
        path: info.outputPath('personal-ended-review.png'),
        fullPage: true,
      })
      expect(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)

      await p.getByRole('button', { name: 'Return to current lecture' }).click()
      await expect(p.locator('.student-session-course')).toHaveText(
        current.title,
      )
      await expect(p.locator('textarea')).toBeEnabled()
      await nav(p, 'Past Lectures')
      await p
        .getByRole('button', {
          name: `Remove ${current.title} from history`,
          exact: true,
        })
        .click()
      await expect(p.locator('.student-history-item')).toHaveCount(1)
      expect(
        (await api(learner.context, 'GET', '/sessions/mine')).session.id,
      ).toBe(current.id)
      await nav(p, 'Current Lecture')
      await expect(p.locator('textarea')).toBeEnabled()
      await nav(p, 'Past Lectures')
      await p.clock.fastForward(6_000)
      await expect(p.locator('.student-history-item')).toHaveCount(1)
      expect(
        (await api(learner.context, 'GET', '/student/lectures/history')).map(
          (item: { id: string }) => item.id,
        ),
      ).toEqual([past.id])

      await p
        .getByRole('button', {
          name: `Remove ${past.title} from history`,
          exact: true,
        })
        .click()
      await expect(p.locator('.student-history-item')).toHaveCount(0)
      expect(
        (await api(peer.context, 'GET', '/student/lectures/history')).map(
          (item: { id: string }) => item.id,
        ),
      ).toEqual([past.id])
      expect(
        await api(peer.context, 'GET', `/lectures/${past.id}/questions`),
      ).toHaveLength(2)
      await p.reload()
      await expect(
        p.getByText(
          'You haven’t visited any lectures yet. Join a lecture to save it here.',
        ),
      ).toBeVisible()

      // Both shared-link formats open ended pools without replacing active membership.
      await p.goto(`/student?lecture=${past.id}`)
      await expect(
        p.getByRole('heading', { name: 'This lecture has ended' }),
      ).toBeVisible()
      expect(
        (await api(learner.context, 'GET', '/student/lectures/history')).map(
          (item: { id: string }) => item.id,
        ),
      ).toEqual([past.id])
      expect(
        (await api(learner.context, 'GET', '/sessions/mine')).session.id,
      ).toBe(current.id)
      await peer.page.goto(`/student/join?code=${past.id}`)
      await expect(
        peer.page.getByRole('heading', { name: 'This lecture has ended' }),
      ).toBeVisible()
      expect(
        (await api(peer.context, 'GET', '/sessions/mine')).session,
      ).toBeNull()

      // A visited lecture passed in the URL must not become a professor selection.
      await p.goto(`/professor?lecture=${past.id}`)
      await expect(
        p.getByRole('heading', { name: 'No session running' }),
      ).toBeVisible()
      await nav(p, 'Past Lectures')
      await expect(p.locator('details')).toHaveCount(1)
      await expect(p.locator('details')).toContainText(taught.title)
      await expect(p.locator('details')).not.toContainText(past.title)
    } finally {
      await Promise.all([
        owner.context.close(),
        learner.context.close(),
        peer.context.close(),
      ])
    }
  })
}

test('switching accounts clears student review and active-session state in the same browser', async ({
  browser,
}) => {
  const id = `switch-${Date.now()}`
  const first = await actor(browser, `first-${id}`)
  const other = await actor(browser, `second-${id}`)
  try {
    const room = await lecture(first.context, 'First account lecture')
    await first.page.goto(`/student/join?code=${room.id}`)
    await expect(first.page.locator('textarea')).toBeEnabled()
    await first.page.locator('textarea').fill('Private unsent draft')
    await first.context.setExtraHTTPHeaders({
      'X-User-Id': `second-${id}`,
      'X-User-Name': `second-${id}`,
    })
    await first.page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(
      first.page.getByRole('heading', { name: 'Join your class' }),
    ).toBeVisible()
    await expect(first.page.locator('textarea')).toHaveCount(0)
    await expect(first.page).not.toHaveURL(/lecture=|code=/)
    await nav(first.page, 'Past Lectures')
    await expect(
      first.page.getByText(
        'You haven’t visited any lectures yet. Join a lecture to save it here.',
      ),
    ).toBeVisible()
    expect(
      await api(other.context, 'GET', '/student/lectures/history'),
    ).toEqual([])
    expect(
      (await api(other.context, 'GET', '/sessions/mine')).session,
    ).toBeNull()
  } finally {
    await Promise.all([first.context.close(), other.context.close()])
  }
})
