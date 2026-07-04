import { useCallback, useEffect, useRef, useState } from 'react'

export const PRESETS = {
  '90/15': { work: 90 * 60, break: 15 * 60 },
  '60/10': { work: 60 * 60, break: 10 * 60 },
  '30/5': { work: 30 * 60, break: 5 * 60 },
}

const ACTIVE_TASK_KEY = 'einding:activeTaskId'
// v2: v1 states could carry a pomodoro countdown into stopwatch mode,
// inflating logged time — discard them rather than migrate.
const TIMER_STATE_KEY = 'einding:timerState:v2'

function freshTimerState({ mode = 'pomodoro', preset = '90/15' } = {}) {
  return {
    mode,
    preset,
    phase: 'work',
    startedAt: null,
    // Stopwatch counts up from zero; pomodoro counts down from the preset.
    secondsAtStart: mode === 'normal' ? 0 : PRESETS[preset].work,
    isRunning: false,
  }
}

function loadActiveTaskId() {
  return localStorage.getItem(ACTIVE_TASK_KEY) || null
}

function loadTimerState() {
  try {
    const raw = localStorage.getItem(TIMER_STATE_KEY)
    const state = raw ? JSON.parse(raw) : null
    if (!state || !PRESETS[state.preset] || !['pomodoro', 'normal'].includes(state.mode)) {
      return freshTimerState()
    }
    return state
  } catch {
    return freshTimerState()
  }
}

// Computes the live value (seconds remaining for pomodoro, seconds elapsed for
// normal) from startedAt/secondsAtStart without any interval-driven counter,
// so it can't drift or stall in a throttled background tab.
export function computeValue(state, now = Date.now()) {
  const elapsedSinceStart = state.startedAt ? (now - state.startedAt) / 1000 : 0
  if (state.mode === 'normal') {
    return state.secondsAtStart + elapsedSinceStart
  }
  return state.secondsAtStart - elapsedSinceStart
}

export function closeoutSession(state, now = Date.now()) {
  if (state.mode === 'normal') {
    const elapsed = Math.floor(computeValue(state, now))
    if (elapsed <= 0) return null
    return {
      startedAt: new Date(now - elapsed * 1000).toISOString(),
      endedAt: new Date(now).toISOString(),
      durationSeconds: elapsed,
    }
  }
  if (state.phase === 'work') {
    const workTotal = PRESETS[state.preset].work
    const remaining = computeValue(state, now)
    // Clamp to the preset length: if the tab was closed and reopened long
    // after the phase ended, only the pomodoro itself counts as work — and it
    // ended when the countdown hit zero, not when the tab came back.
    const worked = Math.floor(Math.min(workTotal, workTotal - remaining))
    if (worked <= 0) return null
    const endMs = remaining < 0 ? now + remaining * 1000 : now
    return {
      startedAt: new Date(endMs - worked * 1000).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      durationSeconds: worked,
    }
  }
  return null
}

export function useTimer({ onWorkSessionComplete, onPhaseComplete }) {
  const [activeTaskId, setActiveTaskIdState] = useState(loadActiveTaskId)
  const [timerState, setTimerState] = useState(loadTimerState)
  const [tick, forceTick] = useState(0)
  const completingRef = useRef(false)

  useEffect(() => {
    if (activeTaskId) localStorage.setItem(ACTIVE_TASK_KEY, activeTaskId)
    else localStorage.removeItem(ACTIVE_TASK_KEY)
  }, [activeTaskId])

  useEffect(() => {
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(timerState))
  }, [timerState])

  // Re-render on an interval purely to refresh the displayed value; the value
  // itself is always recomputed from wall-clock time, never accumulated here.
  useEffect(() => {
    if (!timerState.isRunning) return
    const id = setInterval(() => forceTick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [timerState.isRunning])

  // Handle pomodoro phase completion (work -> break -> work ...).
  useEffect(() => {
    if (timerState.mode !== 'pomodoro' || !timerState.isRunning) return
    const remaining = computeValue(timerState)
    if (remaining > 0 || completingRef.current) return

    completingRef.current = true
    const now = Date.now()
    onPhaseComplete?.(timerState.phase)

    if (timerState.phase === 'work') {
      const session = closeoutSession(timerState, now)
      if (session && activeTaskId && onWorkSessionComplete) {
        onWorkSessionComplete(activeTaskId, session)
      }
      setTimerState((prev) => ({
        ...prev,
        phase: 'break',
        startedAt: now,
        secondsAtStart: PRESETS[prev.preset].break,
      }))
    } else {
      setTimerState((prev) => ({
        ...prev,
        phase: 'work',
        startedAt: now,
        secondsAtStart: PRESETS[prev.preset].work,
      }))
    }
    completingRef.current = false
  }, [timerState, tick, activeTaskId, onWorkSessionComplete])

  const start = useCallback(() => {
    setTimerState((prev) => ({ ...prev, isRunning: true, startedAt: Date.now() }))
  }, [])

  const pause = useCallback(() => {
    setTimerState((prev) => {
      if (!prev.isRunning) return prev
      return {
        ...prev,
        isRunning: false,
        secondsAtStart: computeValue(prev),
        startedAt: null,
      }
    })
  }, [])

  const setMode = useCallback((mode) => {
    setTimerState((prev) =>
      freshTimerState({ mode, preset: prev.preset }),
    )
  }, [])

  const setPreset = useCallback((preset) => {
    setTimerState((prev) => freshTimerState({ mode: prev.mode, preset }))
  }, [])

  // Manually ends the current run (e.g. stopwatch "finish"), logging whatever
  // has accumulated, then resets to a fresh paused state in the same mode.
  const finishAndReset = useCallback(() => {
    const session = closeoutSession(timerState)
    if (session && activeTaskId && onWorkSessionComplete) {
      onWorkSessionComplete(activeTaskId, session)
    }
    setTimerState((prev) => freshTimerState({ mode: prev.mode, preset: prev.preset }))
    return session
  }, [timerState, activeTaskId, onWorkSessionComplete])

  // Skips the rest of a pomodoro break, arming the next work session (paused).
  const skipBreak = useCallback(() => {
    setTimerState((prev) => {
      if (prev.mode !== 'pomodoro' || prev.phase !== 'break') return prev
      return freshTimerState({ mode: prev.mode, preset: prev.preset })
    })
  }, [])

  const switchActiveTask = useCallback(
    (newTaskId) => {
      // Close out any accrued (running or paused) time on the old task so it
      // isn't silently lost; closeoutSession returns null if nothing accrued.
      if (activeTaskId && activeTaskId !== newTaskId) {
        const session = closeoutSession(timerState)
        if (session && onWorkSessionComplete) {
          onWorkSessionComplete(activeTaskId, session)
        }
      }
      setActiveTaskIdState(newTaskId)
      setTimerState((prev) => freshTimerState({ mode: prev.mode, preset: prev.preset }))
    },
    [activeTaskId, timerState, onWorkSessionComplete],
  )

  const clearActiveTask = useCallback(() => {
    setActiveTaskIdState(null)
    setTimerState((prev) => freshTimerState({ mode: prev.mode, preset: prev.preset }))
  }, [])

  const value = computeValue(timerState)

  // Work seconds accrued in the current run (what a closeout would log now).
  const workTotal = PRESETS[timerState.preset].work
  const accruedSeconds =
    timerState.mode === 'normal'
      ? Math.max(0, Math.floor(value))
      : timerState.phase === 'work'
        ? Math.min(workTotal, Math.max(0, Math.floor(workTotal - value)))
        : 0

  return {
    activeTaskId,
    timerState,
    value: Math.max(0, value),
    accruedSeconds,
    start,
    pause,
    setMode,
    setPreset,
    finishAndReset,
    skipBreak,
    switchActiveTask,
    clearActiveTask,
  }
}
