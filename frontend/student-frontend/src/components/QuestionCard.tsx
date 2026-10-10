import { useState } from 'react'
import type { Question } from '../lib/studentApi'
import { CheckIcon, MoreIcon, UpIcon } from './Icons'

type Props = {
  question: Question
  highlighted: boolean
  onVote: (question: Question) => void
  onReport: (question: Question) => void
}

export function QuestionCard({
  question,
  highlighted,
  onVote,
  onReport,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <article
      className={`question-card ${highlighted ? 'question-card--new' : ''}`}
      style={{
        viewTransitionName: `question-${question.id.replace(/[^a-zA-Z0-9]/g, '-')}`,
      }}
    >
      <div className="question-card__content">
        <p>{question.text}</p>
        {question.status === 'selected' && (
          <span className="status status--selected">Being answered</span>
        )}
        {question.status === 'answered' && (
          <span className="status status--answered">
            <CheckIcon width="13" height="13" /> Answered
          </span>
        )}
      </div>
      <div className="question-card__actions">
        {question.mine ? (
          <div
            className="vote-count-only"
            aria-label={`${question.votes} votes`}
          >
            <span>{question.votes}</span>
            <small>{question.votes === 1 ? 'vote' : 'votes'}</small>
          </div>
        ) : (
          <button
            type="button"
            className={`vote-button ${question.votedByMe ? 'vote-button--voted' : ''}`}
            aria-label={`${question.votedByMe ? 'Remove vote from' : 'Upvote'}: ${question.text}`}
            aria-pressed={question.votedByMe}
            onClick={() => onVote(question)}
          >
            <UpIcon width="22" height="22" filled={question.votedByMe} />
            <span>{question.votes}</span>
          </button>
        )}
        {!question.mine && (
          <div className="menu-wrap">
            <button
              type="button"
              className="more-button"
              aria-label={`More options for: ${question.text}`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreIcon width="18" height="18" />
            </button>
            {menuOpen && (
              <div className="card-menu">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onReport(question)
                  }}
                >
                  Report question
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
