import { test, expect, type Page } from '@playwright/test'

async function fixture(page: Page, withPastLecture = false) {
  const lecture = {
    id: '41',
    joinCode: 'A1B2C3',
    title: 'Algorithms',
    course: 'Algorithms',
    lectureTime: '2026-10-11T09:00:00Z',
    startedAt: '2026-10-11T09:00:00Z',
    endedAt: null,
    canManage: false,
    questionsPaused: false,
  }
  const state = {
    historyEnded: false,
    detailEnded: false,
    membershipCleared: false,
    failHistory: false,
  }
  const snapshot = (ended: boolean) => ({
    ...lecture,
    endedAt: ended ? '2026-10-11T10:00:00Z' : null,
  })
  const past = { ...snapshot(true), id: '40', title: 'Earlier Algorithms' }
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let data: unknown
    if (path === '/api/me') data = { id: 'lecture-ended-test', name: 'Student' }
    else if (path === '/api/student/lectures/history') {
      if (state.failHistory)
        return route.fulfill({ status: 503, json: { error: 'Offline' } })
      data = withPastLecture
        ? [snapshot(state.historyEnded), past]
        : [snapshot(state.historyEnded)]
    } else if (path === '/api/sessions/mine')
      data = {
        session: state.membershipCleared
          ? null
          : {
              id: '41',
              code: lecture.joinCode,
              course: lecture.course,
              startedAt: lecture.startedAt,
            },
      }
    else if (path === '/api/sessions/join')
      data = {
        id: '41',
        code: lecture.joinCode,
        course: lecture.course,
        startedAt: lecture.startedAt,
      }
    else if (path === '/api/lectures/41' || path === '/api/lectures/41/visits')
      data = snapshot(state.detailEnded)
    else if (path === '/api/lectures/40' || path === '/api/lectures/40/visits')
      data = past
    else if (path === '/api/lectures/40/questions') data = []
    else if (path === '/api/lectures/41/questions')
      data = [
        {
          id: '1',
          text: 'Why is this algorithm linear?',
          votes: 2,
          mine: false,
          votedByMe: false,
          status: 'answered',
          createdAt: lecture.startedAt,
        },
      ]
    else data = {}
    await route.fulfill({ json: data })
  })
  return state
}

for (const first of ['history', 'detail', 'membership'] as const) {
  test(`lecture-ended screen survives ${first}-first polling and stale snapshots`, async ({
    page,
  }, info) => {
    await page.setViewportSize({
      width: first === 'history' ? 390 : 1280,
      height: 900,
    })
    const state = await fixture(page)
    await page.clock.install()
    await page.goto('/student?lecture=41')
    await expect(page.locator('textarea')).toBeEnabled()
    const displayedCode = await page
      .locator('.student-session-code')
      .innerText()
    if (first === 'membership') {
      state.membershipCleared = true
      await page.clock.fastForward(11_000)
      await expect(page.getByLabel('Lecture code')).toHaveCount(0)
      state.detailEnded = true
    } else if (first === 'detail') {
      state.detailEnded = true
      state.failHistory = true
    } else state.historyEnded = true
    await page.clock.fastForward(6_000)
    await expect(
      page.getByRole('heading', {
        name: 'This lecture has ended',
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.locator('textarea')).toHaveCount(0)
    // The other polling source is still stale; it must not dismiss this screen.
    await page.clock.fastForward(11_000)
    await expect(
      page.getByRole('heading', {
        name: 'This lecture has ended',
        exact: true,
      }),
    ).toBeVisible()
    state.historyEnded = true
    state.detailEnded = true
    state.membershipCleared = true
    state.failHistory = false
    await page.clock.fastForward(11_000)
    await expect(
      page.getByRole('heading', {
        name: 'This lecture has ended',
        exact: true,
      }),
    ).toBeVisible()
    if (first === 'history') {
      await page.reload()
      await expect(
        page.getByRole('heading', {
          name: 'This lecture has ended',
          exact: true,
        }),
      ).toBeVisible()
    }
    await page.screenshot({
      path: info.outputPath('lecture-ended.png'),
      fullPage: true,
    })
    await expect(page.locator('.student-session-kicker')).toHaveText(
      'Past lecture',
    )
    await expect(page.locator('.student-session-course')).toHaveText(
      'Algorithms',
    )
    await expect(page.locator('.student-session-code')).toHaveText(
      displayedCode,
    )
    await expect(page.locator('.question-card:visible')).toContainText(
      'Why is this algorithm linear?',
    )
    await expect(
      page.getByRole('button', { name: /^Upvote:|^More options for:/ }),
    ).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Back to past lectures', exact: true })
      .click()
    await page.getByRole('link', { name: /Algorithms/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Algorithms',
    )
    await expect(page.locator('.student-history-question')).toHaveCount(1)
    await page.clock.fastForward(11_000)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Algorithms',
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}

test('ending a lecture leaves Settings alone and offers a working join-page exit', async ({
  page,
}) => {
  const state = await fixture(page)
  await page.clock.install()
  await page.goto('/student?lecture=41')
  await expect(page.locator('textarea')).toBeEnabled()
  async function navigate(name: string) {
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.getByRole('button', { name, exact: true }).click()
  }
  await navigate('Settings')
  state.detailEnded = true
  state.historyEnded = true
  state.membershipCleared = true
  await page.clock.fastForward(11_000)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')
  await navigate('Current Lecture')
  await expect(
    page.getByRole('heading', { name: 'This lecture has ended', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Join another lecture', exact: true })
    .click()
  await expect(page).toHaveURL(/\/student\/join$/)
  await expect(page.getByLabel('Lecture code')).toBeEnabled()
  await page.clock.fastForward(11_000)
  await expect(page.getByLabel('Lecture code')).toBeVisible()
})

test('returning to the tab detects an ended lecture even if history refresh fails', async ({
  page,
}) => {
  const state = await fixture(page)
  await page.clock.install()
  await page.goto('/student?lecture=41')
  await expect(page.locator('textarea')).toBeEnabled()
  state.detailEnded = true
  state.failHistory = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(
    page.getByRole('heading', { name: 'This lecture has ended', exact: true }),
  ).toBeVisible()
})

test('reviewing a past lecture then returning to the live pool does not skip the end screen', async ({
  page,
}) => {
  const state = await fixture(page, true)
  await page.clock.install()
  await page.goto('/student?lecture=41')
  await expect(page.locator('textarea')).toBeEnabled()
  async function navigate(name: string) {
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.getByRole('button', { name, exact: true }).click()
  }
  await navigate('Past Lectures')
  await page.getByRole('link', { name: /Earlier Algorithms/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Earlier Algorithms',
  )
  await navigate('Current Lecture')
  await expect(page.locator('textarea')).toBeEnabled()
  state.detailEnded = true
  state.historyEnded = true
  state.membershipCleared = true
  await page.clock.fastForward(11_000)
  await expect(
    page.getByRole('heading', { name: 'This lecture has ended', exact: true }),
  ).toBeVisible()
})
