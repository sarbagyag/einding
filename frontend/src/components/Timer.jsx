import { useState } from 'react'
import { PRESETS } from '../hooks/useTimer'
import { formatClock } from '../format'
import { unlockAudio } from '../beep'
import { requestNotificationPermission } from '../notify'

const CUSTOM_DURATION_PRESETS = [5, 10, 15, 25, 45, 60]

export default function Timer({ timer }) {
  const {
    timerState,
    value,
    accruedSeconds,
    start,
    pause,
    setMode,
    setPreset,
    setCustomDuration,
    finishAndReset,
    skipBreak,
  } = timer

  const [customInput, setCustomInput] = useState('')

  const isPomodoro = timerState.mode === 'pomodoro'
  const isCountdown = timerState.mode === 'countdown'
  const isBreak = isPomodoro && timerState.phase === 'break'
  const phaseTotal = isPomodoro
    ? PRESETS[timerState.preset][timerState.phase]
    : isCountdown
      ? timerState.customSeconds
      : 0
  const progress = phaseTotal > 0 ? 1 - value / phaseTotal : 0

  const handleStart = () => {
    unlockAudio()
    requestNotificationPermission()
    start()
  }

  const handleCustomSubmit = (e) => {
    e.preventDefault()
    const minutes = parseInt(customInput, 10)
    if (Number.isFinite(minutes) && minutes > 0) {
      setCustomDuration(minutes)
      setCustomInput('')
    }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-1 rounded-lg bg-bg p-1">
        {['pomodoro', 'countdown', 'normal'].map((mode) => (
          <button
            key={mode}
            onClick={() => setMode(mode)}
            className={`rounded-md px-3.5 py-1 text-sm capitalize transition ${
              timerState.mode === mode
                ? 'bg-accent text-white'
                : 'text-muted hover:text-primary'
            }`}
          >
            {mode === 'normal' ? 'stopwatch' : mode === 'countdown' ? 'timer' : mode}
          </button>
        ))}
      </div>

      {isPomodoro && (
        <div className="flex gap-2">
          {Object.keys(PRESETS).map((preset) => (
            <button
              key={preset}
              onClick={() => setPreset(preset)}
              className={`rounded-md px-2.5 py-1 font-mono text-xs transition ${
                timerState.preset === preset
                  ? 'border border-accent/70 bg-accent/15 text-accent'
                  : 'border border-transparent text-muted hover:text-primary'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      )}

      {isCountdown && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-2">
            {CUSTOM_DURATION_PRESETS.map((minutes) => (
              <button
                key={minutes}
                onClick={() => setCustomDuration(minutes)}
                className={`rounded-md px-2.5 py-1 font-mono text-xs transition ${
                  timerState.customSeconds === minutes * 60
                    ? 'border border-accent/70 bg-accent/15 text-accent'
                    : 'border border-transparent text-muted hover:text-primary'
                }`}
              >
                {minutes}m
              </button>
            ))}
          </div>
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              placeholder="Custom"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="w-20 rounded-md border border-white/10 bg-bg px-2 py-1 text-center font-mono text-xs text-primary placeholder:text-muted/60 focus:border-accent/70 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-muted transition hover:border-white/25 hover:text-primary"
            >
              Set
            </button>
          </form>
        </div>
      )}

      <div className="flex flex-col items-center gap-1">
        <span
          className={`text-xs font-medium uppercase tracking-widest ${
            isBreak ? 'text-success' : 'text-muted'
          }`}
        >
          {isPomodoro ? (isBreak ? 'Break' : 'Focus') : isCountdown ? 'Timer' : 'Elapsed'}
        </span>
        <div
          className={`font-mono text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl lg:text-6xl ${
            isBreak ? 'text-success' : 'text-primary'
          }`}
        >
          {formatClock(value)}
        </div>
      </div>

      {(isPomodoro || isCountdown) && (
        <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-bg">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              isBreak ? 'bg-success' : 'bg-accent'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
      )}

      <div className="flex gap-3">
        {!timerState.isRunning ? (
          <button
            onClick={handleStart}
            className="min-w-28 rounded-xl bg-accent px-7 py-2.5 font-medium text-white transition hover:brightness-110"
          >
            {accruedSeconds > 0 || isBreak ? 'Resume' : 'Start'}
          </button>
        ) : (
          <button
            onClick={pause}
            className="min-w-28 rounded-xl bg-bg px-7 py-2.5 font-medium text-primary transition hover:brightness-150"
          >
            Pause
          </button>
        )}

        {isBreak ? (
          <button
            onClick={skipBreak}
            className="rounded-xl border border-white/10 px-6 py-2.5 font-medium text-muted transition hover:border-white/25 hover:text-primary"
          >
            Skip break
          </button>
        ) : (
          accruedSeconds > 0 && (
            <button
              onClick={finishAndReset}
              className="rounded-xl border border-white/10 px-6 py-2.5 font-medium text-muted transition hover:border-white/25 hover:text-primary"
            >
              End &amp; log
            </button>
          )
        )}
      </div>
    </div>
  )
}
