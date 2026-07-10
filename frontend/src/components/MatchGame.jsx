import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'

const PAIR_COUNT = 5
const ROUND_SECONDS = 60
const WRONG_FLASH_MS = 450

function shuffle(items) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function buildTiles(pairs) {
  return {
    left: shuffle(pairs.map((p) => ({ cardId: p.id, text: p.word }))),
    right: shuffle(pairs.map((p) => ({ cardId: p.id, text: p.english }))),
  }
}

function formatClock(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function MatchGame() {
  const [phase, setPhase] = useState('loading') // loading | error | empty | playing | summary
  const [pairs, setPairs] = useState([])
  const [tiles, setTiles] = useState({ left: [], right: [] })
  const [matchedIds, setMatchedIds] = useState(() => new Set())
  const [missedIds, setMissedIds] = useState(() => new Set())
  const [selection, setSelection] = useState(null) // { side, cardId }
  const [wrongPair, setWrongPair] = useState(null) // { leftId, rightId }
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS)
  const [submitFailed, setSubmitFailed] = useState(false)
  const wrongTimeoutRef = useRef(null)

  const loadRound = useCallback(() => {
    setPhase('loading')
    setSubmitFailed(false)
    api
      .poolVocab(PAIR_COUNT)
      .then((cards) => {
        if (cards.length < 2) {
          setPhase('empty')
          return
        }
        setPairs(cards)
        setTiles(buildTiles(cards))
        setMatchedIds(new Set())
        setMissedIds(new Set())
        setSelection(null)
        setWrongPair(null)
        setSecondsLeft(ROUND_SECONDS)
        setPhase('playing')
      })
      .catch(() => setPhase('error'))
  }, [])

  useEffect(() => {
    loadRound()
    return () => clearTimeout(wrongTimeoutRef.current)
  }, [loadRound])

  const finishRound = useCallback(
    (finalMatched, finalMissed) => {
      const results = pairs.map((p) => ({
        cardId: p.id,
        rating: !finalMatched.has(p.id) ? 1 : finalMissed.has(p.id) ? 2 : 3,
      }))
      setPhase('summary')
      api.reviewVocabBatch(results).catch(() => setSubmitFailed(true))
    },
    [pairs],
  )

  // Countdown — stops the round at 0.
  useEffect(() => {
    if (phase !== 'playing') return
    if (secondsLeft <= 0) {
      finishRound(matchedIds, missedIds)
      return
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [phase, secondsLeft, matchedIds, missedIds, finishRound])

  const handleTap = (side, cardId) => {
    if (phase !== 'playing' || wrongPair) return

    if (!selection) {
      setSelection({ side, cardId })
      return
    }
    if (selection.side === side) {
      setSelection({ side, cardId })
      return
    }

    const left = side === 'left' ? cardId : selection.cardId
    const right = side === 'right' ? cardId : selection.cardId

    if (left === right) {
      const nextMatched = new Set(matchedIds)
      nextMatched.add(left)
      setMatchedIds(nextMatched)
      setSelection(null)
      if (nextMatched.size === pairs.length) {
        finishRound(nextMatched, missedIds)
      }
    } else {
      setMissedIds((prev) => new Set(prev).add(left).add(right))
      setWrongPair({ leftId: left, rightId: right })
      setSelection(null)
      wrongTimeoutRef.current = setTimeout(() => setWrongPair(null), WRONG_FLASH_MS)
    }
  }

  const tileClass = (side, cardId) => {
    const base = 'w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition'
    if (matchedIds.has(cardId)) {
      return `${base} border-success/20 bg-success/10 text-success/70 cursor-default`
    }
    if (wrongPair && ((side === 'left' && wrongPair.leftId === cardId) || (side === 'right' && wrongPair.rightId === cardId))) {
      return `${base} border-red-400/40 bg-red-500/15 text-red-300`
    }
    if (selection?.side === side && selection.cardId === cardId) {
      return `${base} border-accent/60 bg-accent/10 text-primary`
    }
    return `${base} border-white/[0.06] bg-bg text-primary hover:border-white/20`
  }

  if (phase === 'loading') {
    return <p className="text-sm text-muted">Loading&hellip;</p>
  }
  if (phase === 'error') {
    return <p className="text-sm text-muted">Couldn&rsquo;t load the word pool — check your connection.</p>
  }
  if (phase === 'empty') {
    return <p className="text-sm text-muted">Add a few more words before playing Quick Match.</p>
  }

  if (phase === 'summary') {
    const matchedCount = matchedIds.size
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-medium text-primary/80">
          {matchedCount === pairs.length ? 'All matched!' : "Time's up"}
        </p>
        <p className="mt-1.5 text-sm text-muted">
          {matchedCount}/{pairs.length} matched
        </p>
        {submitFailed && (
          <p className="mt-2 text-xs text-red-300">Couldn&rsquo;t save this round&rsquo;s progress.</p>
        )}
        <button
          onClick={loadRound}
          className="mt-6 rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110"
        >
          Play again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Tap the matching pairs</p>
        <p className="font-mono text-sm text-primary/80">{formatClock(secondsLeft)}</p>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full bg-accent transition-[width] duration-1000 ease-linear"
          style={{ width: `${(secondsLeft / ROUND_SECONDS) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2.5">
          {tiles.left.map((tile) => (
            <button
              key={tile.cardId}
              disabled={matchedIds.has(tile.cardId)}
              onClick={() => handleTap('left', tile.cardId)}
              className={tileClass('left', tile.cardId)}
            >
              {tile.text}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          {tiles.right.map((tile) => (
            <button
              key={tile.cardId}
              disabled={matchedIds.has(tile.cardId)}
              onClick={() => handleTap('right', tile.cardId)}
              className={tileClass('right', tile.cardId)}
            >
              {tile.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
