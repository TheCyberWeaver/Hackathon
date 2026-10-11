import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'
const baseURL = 'http://127.0.0.1:5186'
async function actor(browser: Browser, identity: string, mobile = false) {
  const context = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { 'X-User-Id': identity, 'X-User-Name': identity },
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1280, height: 900 },
    hasTouch: mobile,
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
async function nav(page: Page, name: string) {
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name, exact: true }).click()
}
async function submit(page: Page, text: string) {
  await page.locator('textarea').fill(text)
  await page.getByRole('button', { name: 'Send question', exact: true }).click()
  await expect(
    page.locator('.question-card:visible').filter({ hasText: text }),
  ).toBeVisible()
  await expect(page.locator('textarea')).toHaveValue('')
}

for (const mobile of [false, true]) {
  test(`combined lecture workflow and persistence (${mobile ? 'mobile' : 'desktop'})`, async ({
    browser,
  }, info) => {
    const identity = `professor-${Date.now()}-${mobile}`
    const professor = await actor(browser, identity, mobile)
    const student = await actor(browser, `student-${identity}`, mobile)
    const peer = await actor(browser, `peer-${identity}`, mobile)
    const contexts = [professor.context, student.context, peer.context]
    const p = professor.page
    try {
      await p.goto('/')
      await p.getByRole('button', { name: 'Professor', exact: true }).click()
      await expect(
        p.getByRole('heading', { name: 'What courses do you teach?' }),
      ).toBeVisible()
      await p.getByLabel('Add new course').fill('Unfinished draft')
      await p.getByRole('button', { name: 'Skip for now' }).click()
      await expect(
        p.getByRole('button', { name: 'Start lecture', exact: true }),
      ).toBeVisible()
      expect(
        (await api(professor.context, 'GET', '/professor/profile')).courses,
      ).toEqual([])
      await p
        .getByRole('button', { name: 'Start lecture', exact: true })
        .click()
      await expect(
        p.getByRole('button', { name: 'Start session', exact: true }),
      ).toBeDisabled()
      await p.getByRole('button', { name: 'Add course', exact: true }).click()
      const course = 'HS26 Linear Algebra'
      await p.getByLabel('Course title', { exact: true }).fill(course)
      await p.route(
        '**/api/professor/profile',
        (route) =>
          route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: '{"error":"Temporary save failure"}',
          }),
        { times: 1 },
      )
      await p.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(p.getByRole('alert')).toHaveText('Temporary save failure')
      await expect(p.getByLabel('Course title', { exact: true })).toHaveValue(
        course,
      )
      await p.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(p.getByLabel('Course', { exact: true })).toHaveValue(/.+/)
      const persisted = await api(
        professor.context,
        'GET',
        '/professor/profile',
      )
      expect(persisted.courses.map((c: { title: string }) => c.title)).toEqual([
        course,
      ])
      // Independent storage and browser context, same account.
      const device = await actor(browser, identity, mobile)
      contexts.push(device.context)
      await device.page.goto('/professor/settings')
      await expect(device.page.getByText(course, { exact: true })).toBeVisible()
      await expect(
        device.page.getByText('What courses do you teach?'),
      ).toHaveCount(0)
      await p
        .getByRole('button', { name: 'Start session', exact: true })
        .click()
      await expect(
        p.getByRole('heading', { name: `Invite students to ${course}` }),
      ).toBeVisible()
      const code = (await p.locator('code').innerText()).trim()
      await p.getByRole('button', { name: 'Go to questions' }).click()
      await expect(
        p.getByRole('heading', { name: course, exact: true }),
      ).toBeVisible()
      await expect(p.getByText('Pool open', { exact: true })).toBeVisible()
      for (const person of [student, peer]) {
        await person.page.goto('/')
        await expect(
          person.page.getByRole('button', { name: 'Student', exact: true }),
        ).toBeEnabled()
        await person.page
          .getByRole('button', { name: 'Student', exact: true })
          .focus()
        await person.page.keyboard.press('Enter')
        await person.page.getByLabel('Lecture code').fill(code)
        await person.page
          .getByRole('button', { name: 'Join lecture', exact: true })
          .click()
        await expect(person.page.locator('textarea')).toBeEnabled()
      }
      await student.page
        .getByRole('button', { name: 'Need a quick tutorial?' })
        .click()
      await student.page
        .getByRole('button', {
          name: 'Go to step 4: More upvotes, more visibility',
        })
        .click()
      await expect(
        student.page.locator('.student-tutorial-queue-preview'),
      ).toBeVisible()
      await student.page
        .getByRole('button', { name: 'Close tutorial', exact: true })
        .click()
      await student.page.route(`**/api/lectures/${code}/questions`, (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: '{"error":"Submission failed"}',
            })
          : route.continue(),
      )
      await student.page.locator('textarea').fill('  Keep this draft exactly  ')
      await student.page
        .getByRole('button', { name: 'Send question', exact: true })
        .click()
      await expect(
        student.page.getByText('Submission failed', { exact: true }),
      ).toBeVisible()
      await expect(student.page.locator('textarea')).toHaveValue(
        '  Keep this draft exactly  ',
      )
      await expect(student.page.locator('.question-card:visible')).toHaveCount(
        0,
      )
      await student.page.unroute(`**/api/lectures/${code}/questions`)
      await submit(student.page, 'How does induction work?')
      const own = student.page
        .locator('.question-card:visible')
        .filter({ hasText: 'How does induction work?' })
      await expect(own).toHaveClass(/question-card--new/)
      if (mobile)
        await expect(
          student.page.getByRole('tab', {
            name: 'Your questions',
            exact: true,
          }),
        ).toHaveAttribute('aria-selected', 'true')
      else
        await expect(
          student.page.locator('.desktop-other .question-card'),
        ).toHaveCount(0)
      const ownVote = own.getByRole('button', {
        name: /upvotes on your question/,
      })
      if (!mobile) await ownVote.hover()
      await ownVote.focus()
      await expect(own.getByRole('tooltip')).toHaveText(
        'You are not allowed to upvote your own question',
      )
      if (mobile) await ownVote.tap()
      else await ownVote.click()
      expect(
        (await api(student.context, 'GET', `/lectures/${code}/questions`))[0]
          .votes,
      ).toBe(0)
      await submit(peer.page, 'What is the base case?')
      const initial = await api(
        professor.context,
        'GET',
        `/lectures/${code}/professor/questions`,
      )
      const firstId = initial.find(
        (q: { text: string }) => q.text === 'How does induction work?',
      ).id
      if (mobile)
        await peer.page
          .getByRole('tab', { name: 'Other questions', exact: true })
          .click()
      const peerCard = peer.page
        .locator('.question-card:visible')
        .filter({ hasText: 'How does induction work?' })
      await peerCard
        .getByRole('button', {
          name: 'Upvote: How does induction work?',
          exact: true,
        })
        .click()
      await expect(
        peerCard.getByRole('button', {
          name: 'Remove upvote from: How does induction work?',
          exact: true,
        }),
      ).toHaveText('1')
      await peerCard
        .getByRole('button', {
          name: 'Remove upvote from: How does induction work?',
          exact: true,
        })
        .click()
      await expect(
        peerCard.getByRole('button', {
          name: 'Upvote: How does induction work?',
          exact: true,
        }),
      ).toHaveText('0')
      await peerCard
        .getByRole('button', {
          name: 'Upvote: How does induction work?',
          exact: true,
        })
        .click()
      await expect(ownVote).toHaveText('1')
      const refused = await student.context.request.post(
        `/api/questions/${firstId}/vote`,
        { data: { voted: true } },
      )
      expect(refused.status()).toBe(403)
      await expect(
        p.getByRole('tab', { name: 'Open 2', exact: true }),
      ).toBeVisible()
      const firstCard = p
        .locator('article')
        .filter({ hasText: 'How does induction work?' })
      await firstCard
        .getByRole('button', { name: 'Mark answered', exact: true })
        .click()
      await expect(own.getByText('Answered', { exact: true })).toBeVisible()
      for (let i = 0; i < 10; i++) {
        const q = await api(
          i < 8 ? professor.context : student.context,
          'POST',
          `/lectures/${code}/questions`,
          { text: `Additional question ${i}` },
        )
        if (i >= 8)
          await api(professor.context, 'PATCH', `/questions/${q.id}/status`, {
            status: 'answered',
          })
      }
      await expect(
        p.getByRole('tab', { name: 'Open 9', exact: true }),
      ).toBeVisible()
      await p.getByLabel('Time filter').selectOption('5')
      await p.clock.install()
      await p.clock.fastForward(6 * 60_000)
      await expect(
        p.getByRole('tab', { name: 'Open 0', exact: true }),
      ).toBeVisible()
      await expect(
        p.getByRole('button', { name: 'Clear your questions', exact: true }),
      ).toBeEnabled()
      await p.getByRole('tab', { name: 'Answered 3', exact: true }).click()
      await expect(p.getByLabel('Time filter')).toHaveCount(0)
      await p.getByRole('tab', { name: 'Open 0', exact: true }).click()
      await expect(p.getByLabel('Time filter')).toHaveValue('5')
      await p
        .getByRole('button', { name: 'Pause questions', exact: true })
        .click()
      await p
        .getByRole('button', { name: 'Clear your questions', exact: true })
        .click()
      await expect(p.getByRole('dialog')).toContainText(
        `your 8 open questions from ${course}`,
      )
      await expect(p.getByRole('dialog')).toContainText(
        'outside the selected time range',
      )
      await p
        .getByRole('dialog')
        .getByRole('button', { name: 'Cancel', exact: true })
        .click()
      expect(
        await api(student.context, 'GET', `/lectures/${code}/questions`),
      ).toHaveLength(12)
      await p
        .getByRole('button', { name: 'Clear your questions', exact: true })
        .click()
      await p
        .getByRole('dialog')
        .getByRole('button', { name: 'Clear your questions', exact: true })
        .click()
      await expect(p.getByRole('dialog')).toHaveCount(0)
      expect(
        await api(student.context, 'GET', `/lectures/${code}/questions`),
      ).toHaveLength(4)
      await expect(p.getByText('Pool paused', { exact: true })).toBeVisible()
      await p
        .getByRole('button', { name: 'Show all questions', exact: true })
        .click()
      await expect(
        p.getByRole('button', { name: 'Clear your questions', exact: true }),
      ).toBeDisabled()
      // Course edits do not change the active session name.
      await device.page
        .getByRole('button', { name: 'Rename', exact: true })
        .click()
      await device.page
        .getByLabel('Rename course', { exact: true })
        .fill('Future course name')
      await device.page
        .getByRole('button', { name: 'Save name', exact: true })
        .click()
      await expect(
        device.page.getByText('Courses saved.', { exact: true }),
      ).toBeVisible()
      await device.page
        .getByRole('button', { name: 'Remove Future course name' })
        .click()
      await expect(
        device.page.getByText('No courses yet. Add your first course above.'),
      ).toBeVisible()
      await expect(
        p.getByRole('heading', { name: course, exact: true }),
      ).toBeVisible()
      await p.getByRole('button', { name: 'End lecture', exact: true }).click()
      await p
        .getByRole('dialog')
        .getByRole('button', { name: 'End lecture', exact: true })
        .click()
      await expect(
        p.getByRole('heading', { name: 'Past Lectures', exact: true }),
      ).toBeVisible()
      const history = p.locator('details').filter({ hasText: course }).first()
      await expect(history).not.toHaveAttribute('open')
      await history.locator('summary').click()
      await expect(history.locator('article')).toHaveCount(4)
      await expect(history).toContainText('3 answered')
      await p.screenshot({
        path: info.outputPath('history.png'),
        fullPage: true,
      })
      await nav(student.page, 'Past Lectures')
      const studentHistory = student.page
        .locator('.student-history-entry')
        .filter({ hasText: course })
        .first()
      await expect(studentHistory).toContainText('4 questions')
      await studentHistory.locator('.student-history-summary').click()
      await expect(
        student.page.locator('.student-history-question'),
      ).toHaveCount(4)
      await expect(
        student.page.locator('.student-history-status.is-answered'),
      ).toHaveCount(3)
      await device.page.reload()
      await expect(
        device.page.getByText('No courses yet. Add your first course above.'),
      ).toBeVisible()
      expect(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
    } finally {
      await Promise.all(contexts.map((context) => context.close()))
    }
  })
}

test('skip retention, account separation, profile retry and reordering', async ({
  browser,
}) => {
  const id = `profile-${Date.now()}`
  const first = await actor(browser, id)
  const other = await actor(browser, `other-${id}`)
  try {
    await first.page.route('**/api/professor/profile/initialize', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"error":"Profile unavailable"}',
      }),
    )
    await first.page.goto('/professor')
    await expect(first.page.getByRole('alert')).toContainText(
      'Profile unavailable',
    )
    await expect(
      first.page.getByText('What courses do you teach?'),
    ).toHaveCount(0)
    await first.page.unroute('**/api/professor/profile/initialize')
    await first.page.getByRole('button', { name: 'Retry', exact: true }).click()
    for (const course of ['Algebra', 'Algorithms']) {
      await first.page.getByLabel('Add new course').fill(course)
      await first.page
        .getByRole('button', { name: 'Add course', exact: true })
        .click()
    }
    await first.page.route(
      '**/api/professor/profile',
      (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"Setup save failed"}',
        }),
      { times: 1 },
    )
    await first.page.getByRole('button', { name: 'Skip for now' }).click()
    await expect(first.page.getByRole('alert')).toContainText(
      'Setup save failed',
    )
    await expect(
      first.page.locator('.professor-onboarding__course-title'),
    ).toHaveCount(2)
    await first.page.getByRole('button', { name: 'Skip for now' }).click()
    await nav(first.page, 'Settings')
    await first.page.getByRole('button', { name: 'Move Algorithms up' }).click()
    await expect(first.page.locator('.course-title').first()).toHaveText(
      'Algorithms',
    )
    await other.page.goto('/professor')
    await expect(
      other.page.getByRole('heading', { name: 'What courses do you teach?' }),
    ).toBeVisible()
    const device = await actor(browser, id)
    try {
      await device.page.goto('/professor/settings')
      await expect(device.page.locator('.course-title').first()).toHaveText(
        'Algorithms',
      )
      await first.page
        .getByRole('button', { name: 'Remove Algebra', exact: true })
        .click()
      await expect(first.page.locator('.course-title')).toHaveCount(1)
      // Saving from the stale second browser fails with a reloadable authoritative list.
      await device.page
        .getByRole('button', { name: 'Remove Algorithms', exact: true })
        .click()
      await expect(device.page.getByRole('alert')).toContainText(
        'another browser',
      )
      await expect(device.page.locator('.course-title')).toHaveCount(1)
    } finally {
      await device.context.close()
    }
  } finally {
    await first.context.close()
    await other.context.close()
  }
})

test('legacy browser profiles import once and never resurrect removed courses', async ({
  browser,
}) => {
  const id = `legacy-${Date.now()}`
  const legacy = {
    schemaVersion: 1,
    professorId: id,
    onboardingCompleted: true,
    courses: [{ id: 'old', title: 'Imported Algebra' }],
  }
  for (let i = 0; i < 2; i++) {
    const device = await actor(browser, id)
    try {
      await device.context.addInitScript(
        (profile) =>
          localStorage.setItem(
            `askpool:professor-onboarding:v1:${encodeURIComponent(profile.professorId)}`,
            JSON.stringify(profile),
          ),
        legacy,
      )
      await device.page.goto('/professor/settings')
      if (i === 0) {
        await expect(device.page.locator('.course-title')).toHaveText(
          'Imported Algebra',
        )
        await device.page
          .getByRole('button', { name: 'Remove Imported Algebra', exact: true })
          .click()
      }
      await expect(
        device.page.getByText('No courses yet. Add your first course above.'),
      ).toBeVisible()
    } finally {
      await device.context.close()
    }
  }
})

test('permanent deletion cancellation, failure, retry and post-confirmation submissions', async ({
  browser,
}, info) => {
  const id = `deletion-${Date.now()}`
  const professor = await actor(browser, id, true)
  const student = await actor(browser, `student-${id}`, true)
  const p = professor.page
  try {
    await api(professor.context, 'POST', '/professor/profile/initialize', {
      onboardingCompleted: true,
      courses: [],
    })
    const name = 'Long lecture name '.repeat(6).trim()
    const lecture = await api(professor.context, 'POST', '/lectures', {
      title: name,
      course: name,
      lectureTime: new Date().toISOString(),
    })
    await api(professor.context, 'PATCH', `/lectures/${lecture.id}/session`, {
      action: 'start',
    })
    const question = await api(
      professor.context,
      'POST',
      `/lectures/${lecture.id}/questions`,
      { text: 'A long question '.repeat(12).trim() },
    )
    await api(professor.context, 'PATCH', `/questions/${question.id}/status`, {
      status: 'answered',
    })
    await p.goto(`/professor?lecture=${lecture.id}`)
    await expect(p.getByRole('heading', { name, exact: true })).toBeVisible()
    expect(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await p.getByRole('tab', { name: 'Answered 1', exact: true }).click()
    await p.screenshot({
      path: info.outputPath('long-name-and-question.png'),
      fullPage: true,
    })
    await p
      .getByRole('button', { name: 'Delete question', exact: true })
      .click()
    await expect(p.getByRole('dialog')).toContainText(question.text)
    await p
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click()
    expect(
      await api(student.context, 'GET', `/lectures/${lecture.id}/questions`),
    ).toHaveLength(1)
    await p.route(
      `**/api/questions/${question.id}`,
      (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"Deletion failed"}',
        }),
      { times: 1 },
    )
    await p
      .getByRole('button', { name: 'Delete question', exact: true })
      .click()
    await p
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete permanently', exact: true })
      .click()
    await expect(p.getByRole('dialog').getByRole('alert')).toContainText(
      'Deletion failed',
    )
    expect(
      await api(student.context, 'GET', `/lectures/${lecture.id}/questions`),
    ).toHaveLength(1)
    await p
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete permanently', exact: true })
      .click()
    await expect(p.getByRole('dialog')).toHaveCount(0)
    await p.reload()
    await expect(
      p.getByRole('tab', { name: 'Answered 0', exact: true }),
    ).toBeVisible()
    await api(professor.context, 'POST', `/lectures/${lecture.id}/questions`, {
      text: 'Before confirmation',
    })
    await expect(
      p.getByRole('tab', { name: 'Open 1', exact: true }),
    ).toBeVisible()
    await p
      .getByRole('button', { name: 'Clear your questions', exact: true })
      .click()
    // Submit while the confirmed HTTP mutation is held: its snapshot must exclude this question.
    await p.route(
      `**/api/lectures/${lecture.id}/questions/clear-open`,
      async (route) => {
        await api(
          professor.context,
          'POST',
          `/lectures/${lecture.id}/questions`,
          { text: 'After confirmation' },
        )
        await route.continue()
      },
      { times: 1 },
    )
    await p
      .getByRole('dialog')
      .getByRole('button', { name: 'Clear your questions', exact: true })
      .click()
    await expect(p.getByRole('dialog')).toHaveCount(0)
    await expect(p.locator('article')).toContainText('After confirmation')
    expect(
      (
        await api(student.context, 'GET', `/lectures/${lecture.id}/questions`)
      ).map((q: { text: string }) => q.text),
    ).toEqual(['After confirmation'])
    await expect(p.getByText('Pool open', { exact: true })).toBeVisible()
  } finally {
    await professor.context.close()
    await student.context.close()
  }
})

test('student deletion waits for confirmation and cancellation preserves the question', async ({
  browser,
}) => {
  const id = `student-delete-${Date.now()}`
  const professor = await actor(browser, `professor-${id}`)
  const student = await actor(browser, id)
  try {
    const lecture = await api(professor.context, 'POST', '/lectures', {
      title: 'Student deletion confirmation',
      lectureTime: new Date().toISOString(),
    })
    await api(professor.context, 'PATCH', `/lectures/${lecture.id}/session`, {
      action: 'start',
    })
    await api(student.context, 'POST', '/sessions/join', { code: lecture.id })
    const question = await api(
      student.context,
      'POST',
      `/lectures/${lecture.id}/questions`,
      {
        text: 'Please keep this until I confirm',
      },
    )
    const page = student.page
    await page.goto(`/student?lecture=${lecture.id}`)
    const card = page
      .locator('.question-card:visible')
      .filter({ hasText: question.text })
    await expect(card).toBeVisible()
    await card
      .getByRole('button', { name: `More options for: ${question.text}` })
      .click()
    await card.getByRole('button', { name: 'Delete question' }).click()
    const dialog = page.getByRole('dialog', {
      name: 'Are you sure you want to delete this question?',
    })
    await expect(dialog).toBeVisible()
    expect(
      await api(student.context, 'GET', `/lectures/${lecture.id}/questions`),
    ).toHaveLength(1)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    expect(
      await api(student.context, 'GET', `/lectures/${lecture.id}/questions`),
    ).toHaveLength(1)
    await card
      .getByRole('button', { name: `More options for: ${question.text}` })
      .click()
    await card.getByRole('button', { name: 'Delete question' }).click()
    await dialog.getByRole('button', { name: 'Delete question' }).click()
    await expect(dialog).toHaveCount(0)
    expect(
      await api(student.context, 'GET', `/lectures/${lecture.id}/questions`),
    ).toHaveLength(0)
  } finally {
    await professor.context.close()
    await student.context.close()
  }
})
