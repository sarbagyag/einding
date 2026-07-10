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

function StatTile({ label, value, accent = false }) {
  return (
    <div className="flex-1 rounded-xl border border-white/[0.06] bg-surface px-4 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-semibold ${accent ? 'text-accent' : 'text-primary'}`}>
        {value}
      </p>
    </div>
  )
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
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(null)
  const [submitFailed, setSubmitFailed] = useState(false)

  const wrongTimeoutRef = useRef(null)
  const resultsRef = useRef([]) // {cardId, rating} accumulated across every batch this round
  const roundActiveRef = useRef(true)
  const batchFinalizedRef = useRef(false)

  useEffect(() => {
    api
      .vocabHighScore()
      .then(({ highScore: hs }) => setHighScore(hs))
      .catch(() => {})
  }, [])

  const recordBatchResults = useCallback((pairsBatch, finalMatched, finalMissed) => {
    for (const p of pairsBatch) {
      resultsRef.current.push({
        cardId: p.id,
        rating: !finalMatched.has(p.id) ? 1 : finalMissed.has(p.id) ? 2 : 3,
      })
    }
  }, [])

  const loadBatch = useCallback(() => {
    return api.poolVocab(PAIR_COUNT).then((cards) => {
      if (!roundActiveRef.current) return true
      if (cards.length < 2) {
        setPhase('empty')
        return false
      }
      setPairs(cards)
      setTiles(buildTiles(cards))
      setMatchedIds(new Set())
      setMissedIds(new Set())
      setSelection(null)
      setWrongPair(null)
      batchFinalizedRef.current = false
      return true
    })
  }, [])

  const startRound = useCallback(() => {
    setPhase('loading')
    setSubmitFailed(false)
    setScore(0)
    resultsRef.current = []
    roundActiveRef.current = true
    loadBatch()
      .then((ok) => {
        if (ok) {
          setSecondsLeft(ROUND_SECONDS)
          setPhase('playing')
        }
      })
      .catch(() => setPhase('error'))
  }, [loadBatch])

  useEffect(() => {
    startRound()
    return () => clearTimeout(wrongTimeoutRef.current)
  }, [startRound])

  const endRound = useCallback(() => {
    roundActiveRef.current = false
    if (!batchFinalizedRef.current) {
      recordBatchResults(pairs, matchedIds, missedIds)
    }
    setPhase('summary')
    const finalScore = score
    Promise.all([api.reviewVocabBatch(resultsRef.current), api.recordVocabGameRound(finalScore)])
      .then(([, roundResult]) => setHighScore(roundResult.highScore))
      .catch(() => setSubmitFailed(true))
  }, [pairs, matchedIds, missedIds, score, recordBatchResults])

  // Countdown — keeps running across batch refills, stops the round at 0.
  useEffect(() => {
    if (phase !== 'playing') return
    if (secondsLeft <= 0) {
      endRound()
      return
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [phase, secondsLeft, endRound])

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
      setScore((s) => s + 1)

      if (nextMatched.size === pairs.length) {
        recordBatchResults(pairs, nextMatched, missedIds)
        batchFinalizedRef.current = true
        loadBatch().catch(() => endRound())
      }
    } else {
      setMissedIds((prev) => new Set(prev).add(left).add(right))
      setWrongPair({ leftId: left, rightId: right })
      setSelection(null)
      wrongTimeoutRef.current = setTimeout(() => setWrongPair(null), WRONG_FLASH_MS)
    }
  }

  const tileClass = (side, cardId) => {
    const base =
      'w-full rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-all duration-200'
    if (matchedIds.has(cardId)) {
      return `${base} border-success/20 bg-success/10 text-success/60 scale-[0.97] cursor-default`
    }
    if (
      wrongPair &&
      ((side === 'left' && wrongPair.leftId === cardId) || (side === 'right' && wrongPair.rightId === cardId))
    ) {
      return `${base} animate-[einding-shake_0.3s_ease-in-out] border-red-400/40 bg-red-500/15 text-red-300`
    }
    if (selection?.side === side && selection.cardId === cardId) {
      return `${base} border-accent/60 bg-accent/10 text-primary`
    }
    return `${base} border-white/[0.06] bg-surface text-primary hover:border-white/20 hover:bg-white/[0.04]`
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
    const isNewHighScore = highScore !== null && score >= highScore && score > 0
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-1 text-center">
        <p className="text-lg font-medium text-primary/80">
          {isNewHighScore ? 'New high score!' : "Time's up"}
        </p>
        <p className="font-mono text-4xl font-semibold text-primary">{score}</p>
        <p className="text-sm text-muted">pairs matched{highScore !== null ? ` · best ${highScore}` : ''}</p>
        {submitFailed && (
          <p className="mt-2 text-xs text-red-300">Couldn&rsquo;t save this round&rsquo;s progress.</p>
        )}
        <button
          onClick={startRound}
          className="mt-6 rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110"
        >
          Play again
        </button>
      </div>
    )
  }

  const timeClass = secondsLeft <= 5 ? 'text-red-300' : secondsLeft <= 15 ? 'text-orange-300' : 'text-primary'
  const barClass = secondsLeft <= 5 ? 'bg-red-400' : secondsLeft <= 15 ? 'bg-orange-400' : 'bg-accent'

  return (
    <div className="flex min-h-[65vh] flex-col justify-center gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <StatTile label="Score" value={score} accent />
          <StatTile label="Time" value={<span className={timeClass}>{formatClock(secondsLeft)}</span>} />
          <StatTile label="Best" value={highScore ?? '—'} />
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full transition-[width] duration-1000 ease-linear ${barClass}`}
            style={{ width: `${(secondsLeft / ROUND_SECONDS) * 100}%` }}
          />
        </div>
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
