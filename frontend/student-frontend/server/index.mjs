import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { readState, saveState } from './store.mjs'

const port = Number(process.env.PORT || 3001)

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

function rank(question) {
  const ageMinutes = Math.max(
    0,
    (Date.now() - Date.parse(question.createdAt)) / 60_000,
  )
  return question.votes + Math.min(ageMinutes, 60) / 10
}

function ranked(questions) {
  return [...questions].sort((a, b) => {
    if (a.status === 'answered' && b.status !== 'answered') return 1
    if (b.status === 'answered' && a.status !== 'answered') return -1
    return (
      rank(b) - rank(a) || Date.parse(a.createdAt) - Date.parse(b.createdAt)
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
    // Integrated app: identity comes from the managed proxy, not the browser.
    // Standalone demo retains its per-browser identity for independent development.
    const userId =
      process.env.ASKPOOL_REQUIRE_USER_ID === 'true'
        ? request.headers['x-user-id']
        : request.headers['x-user-id'] || request.headers['x-student-id']
    if (typeof userId !== 'string' || !userId.trim()) {
      send(response, 401, { error: 'Missing student identity' })
      return
    }
    const studentId = userId.trim()

    const state = readState()
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
