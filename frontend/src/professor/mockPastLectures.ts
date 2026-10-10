export type PastLecture = {
  id: string
  title: string
  date: string
  questions: {
    id: string
    text: string
    answer: string
  }[]
}

// Fictional archive content for the frontend demo; no lecture history is saved yet.
export const mockPastLectures: PastLecture[] = [
  {
    id: 'statistics-inference',
    title: 'Introduction to Statistical Inference',
    date: '2026-10-03',
    questions: [
      {
        id: 'statistics-q1',
        text: 'Why does a smaller sample make a confidence interval wider?',
        answer:
          'With fewer observations, the estimate has a larger standard error. At the same confidence level, that makes the interval wider.',
      },
      {
        id: 'statistics-q2',
        text: 'What does a 95% confidence interval mean?',
        answer:
          'If we repeated the sampling process many times, about 95% of intervals built this way would contain the true parameter.',
      },
      {
        id: 'statistics-q3',
        text: 'When should we use a t distribution instead of a normal distribution?',
        answer:
          'When estimating a population mean with an unknown population standard deviation, the t distribution accounts for the extra uncertainty, especially with a small sample.',
      },
    ],
  },
  {
    id: 'gradient-descent',
    title: 'Gradient Descent and Regularization',
    date: '2026-09-26',
    questions: [
      {
        id: 'gradient-q1',
        text: 'Why do we move opposite the gradient?',
        answer:
          'The gradient points toward the steepest local increase. A sufficiently small step in the opposite direction reduces the objective.',
      },
      {
        id: 'gradient-q2',
        text: 'What does the learning rate control?',
        answer:
          'It sets the size of each update. Too large can overshoot a minimum; too small can make training very slow.',
      },
      {
        id: 'gradient-q3',
        text: 'How does regularization help with overfitting?',
        answer:
          'It adds a penalty for model complexity, encouraging a simpler model that may generalize better to unseen data.',
      },
    ],
  },
]
