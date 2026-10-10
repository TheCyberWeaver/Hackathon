import { createServer } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import { readState, saveState } from './store.mjs'

const port = Number(process.env.PORT || 3001)
const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function makeJoinCode(sessions) {
  let code
  do {
    const bytes = randomBytes(8)
    const characters = [...bytes].map((byte) => codeAlphabet[byte % 32])
    code = `${characters.slice(0, 4).join('')}-${characters.slice(4).join('')}`
  } while (sessions.some((session) => session.code === code))
  return code
}

function normalizeJoinCode(value) {
  return typeof value === 'string'
    ? value.toUpperCase().replace(/[\s-]/g, '')
    : ''
}

function publicSession(session) {
  return {
    id: session.id,
    code: session.code,
    course: session.course,
    startedAt: session.startedAt,
  }
}

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(body === undefined ? '' : JSON.stringify(body))
}

function publicQuestion(question, studentId) {
  return {
    id: question.id,
    text: question.text,
    votes: question.votes,
    createdAt: question.createdAt,
    status: question.status,
    mine: question.ownerId === studentId,
    votedByMe: question.voterIds.includes(studentId),
  }
}

function ranked(questions) {
  return [...questions].sort((a, b) => {
    if (a.status === 'answered' && b.status !== 'answered') return 1
    if (b.status === 'answered' && a.status !== 'answered') return -1
    return (
      b.votes - a.votes ||
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      a.id.localeCompare(b.id)
    )
  })
}

async function jsonBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 10_000) throw new Error('Request too large')
  }
  return body ? JSON.parse(body) : {}
}

createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname
    // The trusted proxy supplies identity; browser headers never identify a student.
    const userId = request.headers['x-user-id']
    if (typeof userId !== 'string' || !userId.trim()) {
      send(response, 401, { error: 'Missing student identity' })
      return
    }
    const studentId = userId.trim()

    const state = readState()
    const activeOwnedSession = () =>
      state.sessions.find(
        (session) => session.ownerId === studentId && !session.endedAt,
      )

    if (request.method === 'GET' && path === '/api/sessions/active') {
      send(
        response,
        200,
        activeOwnedSession() ? publicSession(activeOwnedSession()) : null,
      )
      return
    }

    if (request.method === 'POST' && path === '/api/sessions') {
      if (activeOwnedSession()) {
        send(response, 409, {
          error: 'End your current lecture before starting another.',
        })
        return
      }
      const body = await jsonBody(request)
      const course = typeof body.course === 'string' ? body.course.trim() : ''
      if (!course || course.length > 80) {
        send(response, 400, { error: 'Course must be 1 to 80 characters.' })
        return
      }
      const session = {
        id: randomUUID(),
        code: makeJoinCode(state.sessions),
        course,
        startedAt: new Date().toISOString(),
        endedAt: null,
        ownerId: studentId,
        studentIds: [],
      }
      state.sessions.push(session)
      saveState(state)
      send(response, 201, publicSession(session))
      return
    }

    if (request.method === 'DELETE' && path === '/api/sessions/active') {
      const session = activeOwnedSession()
      if (!session) {
        send(response, 404, { error: 'No active lecture was found.' })
        return
      }
      session.endedAt = new Date().toISOString()
      saveState(state)
      send(response, 204)
      return
    }

    if (request.method === 'GET' && path === '/api/sessions/mine') {
      const session = [...state.sessions]
        .reverse()
        .find((item) => !item.endedAt && item.studentIds.includes(studentId))
      send(response, 200, session ? publicSession(session) : null)
      return
    }

    if (request.method === 'DELETE' && path === '/api/sessions/mine') {
      for (const session of state.sessions) {
        session.studentIds = session.studentIds.filter((id) => id !== studentId)
      }
      saveState(state)
      send(response, 204)
      return
    }

    if (request.method === 'POST' && path === '/api/sessions/join') {
      const body = await jsonBody(request)
      const code = normalizeJoinCode(body.code)
      const session = state.sessions.find(
        (item) => !item.endedAt && normalizeJoinCode(item.code) === code,
      )
      if (!session) {
        send(response, 404, {
          error: 'This code is invalid or the lecture has ended.',
        })
        return
      }
      for (const item of state.sessions) {
        item.studentIds = item.studentIds.filter((id) => id !== studentId)
      }
      session.studentIds.push(studentId)
      saveState(state)
      send(response, 200, publicSession(session))
      return
    }

    if (request.method === 'GET' && path === '/api/questions') {
      send(
        response,
        200,
        ranked(state.questions).map((question) =>
          publicQuestion(question, studentId),
        ),
      )
      return
    }

    if (request.method === 'POST' && path === '/api/questions') {
      const body = await jsonBody(request)
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (!text || text.length > 200) {
        send(response, 400, { error: 'Question must be 1 to 200 characters.' })
        return
      }
      const question = {
        id: randomUUID(),
        text,
        votes: 0,
        createdAt: new Date().toISOString(),
        status: 'open',
        ownerId: studentId,
        voterIds: [],
      }
      state.questions.push(question)
      saveState(state)
      send(response, 201, publicQuestion(question, studentId))
      return
    }

    const match = /^\/api\/questions\/([^/]+)\/(vote|report)$/.exec(path)
    if (request.method === 'POST' && match) {
      const question = state.questions.find((item) => item.id === match[1])
      if (!question) {
        send(response, 404, { error: 'Question not found.' })
        return
      }
      if (match[2] === 'report') {
        state.reports.push({
          questionId: question.id,
          studentId,
          at: new Date().toISOString(),
        })
        saveState(state)
        send(response, 204)
        return
      }
      if (question.ownerId === studentId) {
        send(response, 403, { error: 'You cannot vote on your own question.' })
        return
      }
      const body = await jsonBody(request)
      if (typeof body.voted !== 'boolean') {
        send(response, 400, { error: 'Expected a voted boolean.' })
        return
      }
      const alreadyVoted = question.voterIds.includes(studentId)
      if (body.voted && !alreadyVoted) {
        question.voterIds.push(studentId)
        question.votes += 1
      } else if (!body.voted && alreadyVoted) {
        question.voterIds = question.voterIds.filter((id) => id !== studentId)
        question.votes -= 1
      }
      saveState(state)
      send(response, 200, publicQuestion(question, studentId))
      return
    }

    send(response, 404, { error: 'Not found.' })
  } catch (error) {
    if (error instanceof SyntaxError || error.message === 'Request too large') {
      send(response, 400, { error: 'Invalid request body.' })
      return
    }
    console.error(error)
    send(response, 500, { error: 'Demo server error.' })
  }
}).listen(port, '0.0.0.0', () => {
  readState()
  console.log(`AskPool demo API listening on http://localhost:${port}`)
})
