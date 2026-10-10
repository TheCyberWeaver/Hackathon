import { useState } from 'react'
import type { Question } from '../lib/studentApi'
import { CheckIcon, LikeIcon, MoreIcon } from './Icons'

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
      className={`question-card ${question.mine ? 'question-card--mine' : ''} ${highlighted ? 'question-card--new' : ''} ${menuOpen ? 'question-card--menu-open' : ''}`}
      style={{
        viewTransitionName: `question-${question.id.replace(/[^a-zA-Z0-9]/g, '-')}`,
      }}
    >
      <div className="question-card__content">
        {question.mine && (
          <span className="question-card__owner">Your Question</span>
        )}
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
            className="like-button like-button--readonly"
            aria-label={`${question.votes} likes on your question`}
          >
            <LikeIcon width="19" height="19" />
            <span>{question.votes}</span>
          </div>
        ) : (
          <button
            type="button"
            className={`like-button ${question.votedByMe ? 'like-button--voted' : ''}`}
            aria-label={`${question.votedByMe ? 'Unlike' : 'Like'}: ${question.text}`}
            aria-pressed={question.votedByMe}
            onClick={() => onVote(question)}
          >
            <LikeIcon width="19" height="19" filled={question.votedByMe} />
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
