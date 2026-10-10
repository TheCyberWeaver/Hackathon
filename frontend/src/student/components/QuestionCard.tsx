import { useState } from 'react'
import type { Question } from '../lib/studentApi'
import { CheckIcon, MoreIcon, ThumbsUpIcon } from './Icons'

type Props = {
  question: Question
  highlighted: boolean
  onVote: (question: Question) => void
  onReport: (question: Question) => void
  onDelete: (question: Question) => void
  deleting: boolean
  readOnly?: boolean
}

export function QuestionCard({
  question,
  highlighted,
  onVote,
  onReport,
  onDelete,
  deleting,
  readOnly = false,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [voteHelpOpen, setVoteHelpOpen] = useState(false)

  return (
    <article
      data-question-id={question.id}
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
        {readOnly ? (
          <span
            className="upvote-button upvote-button--readonly"
            aria-label={`${question.votes} upvotes`}
          >
            <ThumbsUpIcon width="16" height="16" />
            <span>{question.votes}</span>
          </span>
        ) : question.mine ? (
          <div
            className="self-vote-help"
            onMouseEnter={() => setVoteHelpOpen(true)}
            onMouseLeave={() => setVoteHelpOpen(false)}
          >
            <button
              type="button"
              className="upvote-button upvote-button--readonly"
              aria-label={`${question.votes} upvotes on your question`}
              aria-describedby={`self-vote-${question.id}`}
              onFocus={() => setVoteHelpOpen(true)}
              onBlur={() => setVoteHelpOpen(false)}
              onClick={() => setVoteHelpOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setVoteHelpOpen(false)
              }}
            >
              <ThumbsUpIcon width="16" height="16" />
              <span>{question.votes}</span>
            </button>
            <span
              id={`self-vote-${question.id}`}
              role="tooltip"
              className={`self-vote-tooltip ${voteHelpOpen ? 'is-visible' : ''}`}
            >
              You are not allowed to upvote your own question
            </span>
          </div>
        ) : (
          <button
            type="button"
            className={`upvote-button ${question.votedByMe ? 'upvote-button--voted' : ''}`}
            aria-label={`${question.votedByMe ? 'Remove upvote from' : 'Upvote'}: ${question.text}`}
            aria-pressed={question.votedByMe}
            onClick={() => onVote(question)}
          >
            <ThumbsUpIcon width="16" height="16" filled={question.votedByMe} />
            <span>{question.votes}</span>
          </button>
        )}
        {!readOnly && (
          <div className="menu-wrap">
            <button
              type="button"
              className="more-button"
              aria-label={`More options for: ${question.text}`}
              aria-expanded={menuOpen}
              disabled={deleting || question.id.startsWith('pending-')}
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
                    if (question.mine) onDelete(question)
                    else onReport(question)
                  }}
                >
                  {question.mine ? 'Delete question' : 'Report question'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
