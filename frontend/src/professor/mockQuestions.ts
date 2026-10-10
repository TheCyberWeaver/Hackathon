export type Question = {
  id: string
  text: string
  upvoteCount: number
  createdAt: string
  answered: boolean
}

// Fixed demo content without student identity fields.
export const mockQuestions: Question[] = [
  {
    id: 'q01',
    text: 'Could you explain the difference between a correlation and a causal relationship one more time?',
    upvoteCount: 24,
    createdAt: '2026-10-10T08:05:00Z',
    answered: false,
  },
  {
    id: 'q02',
    text: 'Why does the gradient point in the direction of steepest increase?',
    upvoteCount: 18,
    createdAt: '2026-10-10T08:12:00Z',
    answered: false,
  },
  {
    id: 'q03',
    text: 'When we use a smaller sample, how does that affect the confidence interval, and is there a point where the normal approximation is no longer appropriate?',
    upvoteCount: 18,
    createdAt: '2026-10-10T08:17:00Z',
    answered: false,
  },
  {
    id: 'q04',
    text: 'Can you walk through the second step of the proof on the last slide?',
    upvoteCount: 12,
    createdAt: '2026-10-10T08:24:00Z',
    answered: false,
  },
  {
    id: 'q05',
    text: 'What is the intuition behind regularization?',
    upvoteCount: 9,
    createdAt: '2026-10-10T08:30:00Z',
    answered: false,
  },
  {
    id: 'q06',
    text: 'Does the theorem still hold if the observations are dependent?',
    upvoteCount: 9,
    createdAt: '2026-10-10T08:30:00Z',
    answered: false,
  },
  {
    id: 'q07',
    text: 'Could we see a practical example of choosing a learning rate?',
    upvoteCount: 5,
    createdAt: '2026-10-10T08:38:00Z',
    answered: false,
  },
  {
    id: 'q08',
    text: 'Will the lecture notes include the derivation of the variance formula?',
    upvoteCount: 2,
    createdAt: '2026-10-10T08:45:00Z',
    answered: false,
  },
  {
    id: 'q09',
    text: 'Which chapter should we read before next week?',
    upvoteCount: 0,
    createdAt: '2026-10-10T08:52:00Z',
    answered: false,
  },
  {
    id: 'q10',
    text: 'Is the midterm cumulative?',
    upvoteCount: 15,
    createdAt: '2026-10-10T07:55:00Z',
    answered: true,
  },
  {
    id: 'q11',
    text: 'Can we use a calculator for the problem set?',
    upvoteCount: 7,
    createdAt: '2026-10-10T08:02:00Z',
    answered: true,
  },
  {
    id: 'q12',
    text: 'Where can we find the dataset used in today’s example?',
    upvoteCount: 3,
    createdAt: '2026-10-10T08:10:00Z',
    answered: true,
  },
]
