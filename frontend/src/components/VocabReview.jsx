import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

const RATINGS = [
  { value: 1, label: 'Again', className: 'bg-red-500/15 text-red-300 hover:bg-red-500/25' },
  { value: 2, label: 'Hard', className: 'bg-orange-500/15 text-orange-300 hover:bg-orange-500/25' },
  { value: 3, label: 'Good', className: 'bg-accent/20 text-accent hover:bg-accent/30' },
  { value: 4, label: 'Easy', className: 'bg-success/15 text-success hover:bg-success/25' },
]

export default function VocabReview() {
  const [queue, setQueue] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)

  useEffect(() => {
    api
      .listDueVocab()
      .then(setQueue)
      .catch(() => setFailed(true))
  }, [])

  const rate = useCallback(
    (rating) => {
      const [current, ...rest] = queue
      setQueue(rest)
      setRevealed(false)
      setReviewedCount((n) => n + 1)
      api.reviewVocab(current.id, rating).catch(() => setFailed(true))
    },
    [queue],
  )

  if (failed) {
    return <p className="text-sm text-muted">Couldn&rsquo;t reach the vocab deck — check your connection.</p>
  }
  if (!queue) {
    return <p className="text-sm text-muted">Loading&hellip;</p>
  }
  if (queue.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-medium text-primary/80">All caught up</p>
        <p className="mt-1 text-sm text-muted">
          {reviewedCount > 0 ? `${reviewedCount} reviewed. ` : ''}Nothing due right now.
        </p>
      </div>
    )
  }

  const card = queue[0]

  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono text-xs text-muted">{queue.length} due</p>

      <div className="rounded-xl border border-white/[0.06] bg-bg p-5 text-center">
        <p className="text-2xl font-semibold text-primary">{card.word}</p>
        {card.type && <p className="mt-1 text-xs uppercase tracking-widest text-muted">{card.type}</p>}

        {revealed ? (
          <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.06] pt-4 text-left">
            <p className="text-primary/90">{card.english}</p>
            {card.exampleDe && <p className="text-sm italic text-muted">{card.exampleDe}</p>}
            {card.exampleEn && <p className="text-sm text-muted">{card.exampleEn}</p>}
          </div>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
          >
            Show answer
          </button>
        )}
      </div>

      {revealed && (
        <div className="grid grid-cols-4 gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              onClick={() => rate(r.value)}
              className={`rounded-lg py-2 text-xs font-medium transition ${r.className}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
