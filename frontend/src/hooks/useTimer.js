import { useCallback, useEffect, useRef, useState } from 'react'

export const PRESETS = {
  '90/15': { work: 90 * 60, break: 15 * 60 },
  '60/10': { work: 60 * 60, break: 10 * 60 },
  '30/5': { work: 30 * 60, break: 5 * 60 },
}

const ACTIVE_TASK_KEY = 'einding:activeTaskId'
// v3: adds the 'countdown' mode and its customSeconds field — older states
// don't carry a valid customSeconds, so discard rather than migrate.
const TIMER_STATE_KEY = 'einding:timerState:v3'

const DEFAULT_CUSTOM_SECONDS = 25 * 60

function freshTimerState({ mode = 'pomodoro', preset = '90/15', customSeconds = DEFAULT_CUSTOM_SECONDS } = {}) {
  return {
    mode,
    preset,
    customSeconds,
    phase: 'work',
    startedAt: null,
    // Stopwatch counts up from zero; pomodoro and countdown count down.
    secondsAtStart: mode === 'normal' ? 0 : mode === 'countdown' ? customSeconds : PRESETS[preset].work,
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
    if (
      !state ||
      !PRESETS[state.preset] ||
      !['pomodoro', 'normal', 'countdown'].includes(state.mode) ||
      !(Number.isFinite(state.customSeconds) && state.customSeconds > 0)
    ) {
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
  if (state.mode === 'countdown' || state.phase === 'work') {
    // Countdown's total is its own configured length; pomodoro's is the
    // preset's work length. Either way it's stable across pause/resume,
    // unlike secondsAtStart which mutates on every pause.
    const total = state.mode === 'countdown' ? state.customSeconds : PRESETS[state.preset].work
    const remaining = computeValue(state, now)
    // Clamp to the total: if the tab was closed and reopened long after the
    // countdown ended, only the timer itself counts as work — and it ended
    // when the countdown hit zero, not when the tab came back.
    const worked = Math.floor(Math.min(total, total - remaining))
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

  // Handle countdown completion — either a pomodoro phase flip
  // (work -> break -> work ...) or a one-shot custom timer ringing out.
  useEffect(() => {
    if ((timerState.mode !== 'pomodoro' && timerState.mode !== 'countdown') || !timerState.isRunning) return
    const remaining = computeValue(timerState)
    if (remaining > 0 || completingRef.current) return

    completingRef.current = true
    const now = Date.now()
    onPhaseComplete?.(timerState.mode === 'countdown' ? 'countdown' : timerState.phase)

    if (timerState.mode === 'countdown') {
      const session = closeoutSession(timerState, now)
      if (session && activeTaskId && onWorkSessionComplete) {
        onWorkSessionComplete(activeTaskId, session)
      }
      setTimerState((prev) => freshTimerState({ mode: prev.mode, preset: prev.preset, customSeconds: prev.customSeconds }))
    } else if (timerState.phase === 'work') {
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
      freshTimerState({ mode, preset: prev.preset, customSeconds: prev.customSeconds }),
    )
  }, [])

  const setPreset = useCallback((preset) => {
    setTimerState((prev) => freshTimerState({ mode: prev.mode, preset, customSeconds: prev.customSeconds }))
  }, [])

  // Sets the custom timer's length in whole minutes and (re)arms it, paused.
  const setCustomDuration = useCallback((minutes) => {
    const customSeconds = Math.max(1, Math.round(minutes)) * 60
    setTimerState((prev) => freshTimerState({ mode: prev.mode, preset: prev.preset, customSeconds }))
  }, [])

  // Manually ends the current run (e.g. stopwatch "finish"), logging whatever
  // has accumulated, then resets to a fresh paused state in the same mode.
  const finishAndReset = useCallback(() => {
    const session = closeoutSession(timerState)
    if (session && activeTaskId && onWorkSessionComplete) {
      onWorkSessionComplete(activeTaskId, session)
    }
    setTimerState((prev) => freshTimerState({ mode: prev.mode, preset: prev.preset, customSeconds: prev.customSeconds }))
    return session
  }, [timerState, activeTaskId, onWorkSessionComplete])

  // Skips the rest of a pomodoro break, arming the next work session (paused).
  const skipBreak = useCallback(() => {
    setTimerState((prev) => {
      if (prev.mode !== 'pomodoro' || prev.phase !== 'break') return prev
      return freshTimerState({ mode: prev.mode, preset: prev.preset, customSeconds: prev.customSeconds })
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
      setTimerState((prev) => freshTimerState({ mode: prev.mode, preset: prev.preset, customSeconds: prev.customSeconds }))
    },
    [activeTaskId, timerState, onWorkSessionComplete],
  )

  const clearActiveTask = useCallback(() => {
    setActiveTaskIdState(null)
    setTimerState((prev) => freshTimerState({ mode: prev.mode, preset: prev.preset, customSeconds: prev.customSeconds }))
  }, [])

  const value = computeValue(timerState)

  // Work seconds accrued in the current run (what a closeout would log now).
  const workTotal = PRESETS[timerState.preset].work
  const accruedSeconds =
    timerState.mode === 'normal'
      ? Math.max(0, Math.floor(value))
      : timerState.mode === 'countdown'
        ? Math.min(timerState.customSeconds, Math.max(0, Math.floor(timerState.customSeconds - value)))
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
    setCustomDuration,
    finishAndReset,
    skipBreak,
    switchActiveTask,
    clearActiveTask,
  }
}
