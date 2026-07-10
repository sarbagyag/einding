import { useState } from 'react'
import MatchGame from './MatchGame'

export default function VocabReview() {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="flex flex-col gap-6">
        <button
          onClick={() => setPlaying(false)}
          className="self-start text-sm text-muted transition hover:text-primary"
        >
          ← Menu
        </button>
        <MatchGame />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center sm:flex-row sm:items-stretch sm:justify-center">
      <div className="rounded-2xl border border-white/[0.06] bg-bg px-6 py-14 sm:px-10">
        <p className="text-3xl">🎯</p>
        <p className="mt-4 text-lg font-medium text-primary/80">Quick Match</p>
        <p className="mt-1.5 text-sm text-muted">60-second matching game. Updates your FSRS schedule.</p>
        <button
          onClick={() => setPlaying(true)}
          className="mt-6 rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110"
        >
          Play
        </button>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-bg px-6 py-14 sm:px-10">
        <p className="text-3xl">🇩🇪</p>
        <p className="mt-4 text-lg font-medium text-primary/80">Practice on AnkiWeb</p>
        <p className="mt-1.5 text-sm text-muted">Your decks and review history live there.</p>
        <a
          href="https://ankiweb.net/decks"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110"
        >
          Open AnkiWeb ↗
        </a>
      </div>
    </div>
  )
}
