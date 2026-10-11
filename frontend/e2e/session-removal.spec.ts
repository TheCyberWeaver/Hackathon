import { test, expect, type BrowserContext } from '@playwright/test'

async function api(
  context: BrowserContext,
  method: string,
  path: string,
  data?: unknown,
) {
  const response = await context.request.fetch(`/api${path}`, { method, data })
  expect(response.ok(), await response.text()).toBeTruthy()
  return response.status() === 204 ? null : response.json()
}

for (const width of [430, 1280]) {
  test(`session removal confirmations and course-wide deletion at ${width}px`, async ({
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
        viewport: { width, height: 932 },
        reducedMotion: 'reduce',
      })
      return { context, page: await context.newPage() }
    }
    const owner = await actor('Professor'),
      learner = await actor('Student'),
      peer = await actor('Peer')
    try {
      await api(owner.context, 'POST', '/professor/profile/initialize', {
        onboardingCompleted: true,
        courses: [{ id: 'a', title: 'Algebra' }],
      })
      const create = async (title: string) => {
        const session = await api(owner.context, 'POST', '/lectures', {
          title,
          courseId: 'a',
          lectureTime: new Date().toISOString(),
        })
        await api(owner.context, 'PATCH', `/lectures/${session.id}/session`, {
          action: 'start',
        })
        for (const student of [learner, peer])
          await api(student.context, 'POST', '/sessions/join', {
            code: session.joinCode,
          })
        return session
      }
      const past = await create('Limits and continuity')
      await api(learner.context, 'POST', `/lectures/${past.id}/questions`, {
        text: 'Why does this limit exist?',
      })
      await api(owner.context, 'PATCH', `/lectures/${past.id}/session`, {
        action: 'end',
      })
      const kept = await create('Sequences')
      await api(owner.context, 'PATCH', `/lectures/${kept.id}/session`, {
        action: 'end',
      })
      const live = await create('Live algebra')
      const path = `/past-lectures?course=${encodeURIComponent(past.courseKey)}&name=Algebra`
      const p = owner.page,
        s = learner.page,
        q = peer.page
      await p.goto(`/professor${path}`)
      await s.goto(`/student${path}`)
      await q.goto(`/student?lecture=${past.id}`)
      await expect(q.getByText('Why does this limit exist?')).toBeVisible()
      await expect(s.locator('.student-history-entry')).toHaveCount(2)
      const studentRemove = s.getByRole('button', {
        name: 'Remove Sequences from history',
        exact: true,
      })
      await studentRemove.click()
      const studentDialog = s.getByRole('dialog')
      await expect(studentDialog).toContainText('your history only')
      await expect(
        studentDialog.getByRole('button', { name: 'Cancel', exact: true }),
      ).toBeFocused()
      await s.screenshot({
        path: info.outputPath('student-confirmation.png'),
        fullPage: true,
      })
      await studentDialog
        .getByRole('button', { name: 'Cancel', exact: true })
        .click()
      await expect(studentRemove).toBeFocused()
      await expect(s.locator('.student-history-entry')).toHaveCount(2)
      await studentRemove.click()
      await s.keyboard.press('Escape')
      await expect(studentDialog).toHaveCount(0)
      await studentRemove.click()
      await s.route(
        `**/api/student/lectures/history/${kept.id}`,
        async (route) => {
          if (route.request().method() === 'DELETE')
            await route.fulfill({
              status: 503,
              json: { error: 'Could not remove session. Try again.' },
            })
          else await route.continue()
        },
      )
      await studentDialog
        .getByRole('button', { name: 'Remove from history', exact: true })
        .click()
      await expect(studentDialog.getByRole('alert')).toContainText('Try again')
      await expect(s.locator('.student-history-entry')).toHaveCount(2)
      await s.unroute(`**/api/student/lectures/history/${kept.id}`)
      await studentDialog
        .getByRole('button', { name: 'Remove from history', exact: true })
        .click()
      await expect(studentDialog).toHaveCount(0)
      await expect(s.locator('.student-history-entry')).toHaveCount(1)
      expect(
        (await api(peer.context, 'GET', '/student/lectures/history')).map(
          (l: { id: string }) => l.id,
        ),
      ).toContain(kept.id)

      const professorRemove = p.getByRole('button', {
        name: 'Remove Limits and continuity session for everyone',
        exact: true,
      })
      await expect(p.locator('.professor-history-entry')).toHaveCount(2)
      await p.screenshot({
        path: info.outputPath('professor-sessions.png'),
        fullPage: true,
      })
      await professorRemove.click()
      const professorDialog = p.getByRole('dialog')
      await expect(professorDialog).toContainText(
        'all its questions for everyone',
      )
      await p.screenshot({
        path: info.outputPath('professor-confirmation.png'),
        fullPage: true,
      })
      await professorDialog
        .getByRole('button', { name: 'Cancel', exact: true })
        .click()
      await expect(professorRemove).toBeFocused()
      await expect(p.locator('.professor-history-entry')).toHaveCount(2)
      await professorRemove.click()
      await p.route(`**/api/lectures/${past.id}`, async (route) => {
        if (route.request().method() === 'DELETE')
          await route.fulfill({
            status: 503,
            json: { error: 'Could not delete session. Try again.' },
          })
        else await route.continue()
      })
      await professorDialog
        .getByRole('button', { name: 'Delete session', exact: true })
        .click()
      await expect(professorDialog.getByRole('alert')).toContainText(
        'Try again',
      )
      await expect(q.getByText('Why does this limit exist?')).toBeVisible()
      await p.unroute(`**/api/lectures/${past.id}`)
      // A delayed response keeps confirmation disabled and prevents duplicate requests.
      let deletes = 0
      await p.route(`**/api/lectures/${past.id}`, async (route) => {
        if (route.request().method() === 'DELETE') {
          deletes++
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
        await route.continue()
      })
      await professorDialog
        .getByRole('button', { name: 'Delete session', exact: true })
        .click()
      await expect(
        professorDialog.getByRole('button', { name: 'Deleting…', exact: true }),
      ).toBeDisabled()
      await expect(professorDialog).toHaveCount(0)
      expect(deletes).toBe(1)
      await expect(p.locator('.professor-history-entry')).toHaveCount(1)
      // No navigation or manual refresh in either student tab.
      await expect(s.locator('.student-history-entry')).toHaveCount(0)
      await expect(
        q.getByRole('heading', { name: 'Session unavailable', exact: true }),
      ).toBeVisible()
      await expect(q.getByText('Why does this limit exist?')).toHaveCount(0)
      for (const student of [learner, peer]) {
        expect(
          (
            await student.context.request.get(`/api/lectures/${past.id}`)
          ).status(),
        ).toBe(404)
        expect(
          (
            await student.context.request.get(
              `/api/lectures/${past.id}/questions`,
            )
          ).status(),
        ).toBe(404)
        expect(
          (await api(student.context, 'GET', '/sessions/mine')).session.id,
        ).toBe(live.id)
      }
      expect(
        (await api(owner.context, 'GET', '/professor/profile')).courses,
      ).toHaveLength(1)
      await q.reload()
      await expect(q.getByText('Why does this limit exist?')).toHaveCount(0)
      await expect(
        q.getByRole('heading', { name: 'Lecture unavailable', exact: true }),
      ).toBeVisible()
      // A student can still be on the live screen when the professor ends and
      // immediately deletes it, before the next poll observes the end.
      await api(learner.context, 'POST', `/lectures/${live.id}/questions`, {
        text: 'Question visible on the live screen',
      })
      await q.goto(`/student?lecture=${live.id}`)
      await expect(
        q
          .locator('.question-card:visible')
          .filter({ hasText: 'Question visible on the live screen' }),
      ).toBeVisible()
      await api(owner.context, 'PATCH', `/lectures/${live.id}/session`, {
        action: 'end',
      })
      await api(owner.context, 'DELETE', `/lectures/${live.id}`)
      await expect(
        q.getByText('Question visible on the live screen', { exact: true }),
      ).toHaveCount(0)
      await expect(
        q.getByRole('heading', { name: /unavailable/ }),
      ).toBeVisible()
    } finally {
      await owner.context.close()
      await learner.context.close()
      await peer.context.close()
    }
  })
}
