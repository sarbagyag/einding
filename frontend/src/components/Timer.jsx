import { PRESETS } from '../hooks/useTimer'
import { formatClock } from '../format'
import { unlockAudio } from '../beep'

export default function Timer({ timer }) {
  const {
    timerState,
    value,
    accruedSeconds,
    start,
    pause,
    setMode,
    setPreset,
    finishAndReset,
    skipBreak,
  } = timer

  const isPomodoro = timerState.mode === 'pomodoro'
  const isBreak = isPomodoro && timerState.phase === 'break'
  const phaseTotal = isPomodoro ? PRESETS[timerState.preset][timerState.phase] : 0
  const progress = isPomodoro && phaseTotal > 0 ? 1 - value / phaseTotal : 0

  const handleStart = () => {
    unlockAudio()
    start()
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-1 rounded-lg bg-bg p-1">
        {['pomodoro', 'normal'].map((mode) => (
          <button
            key={mode}
            onClick={() => setMode(mode)}
            className={`rounded-md px-3.5 py-1 text-sm capitalize transition ${
              timerState.mode === mode
                ? 'bg-accent text-white'
                : 'text-muted hover:text-primary'
            }`}
          >
            {mode === 'normal' ? 'stopwatch' : mode}
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

      <div className="flex flex-col items-center gap-1">
        <span
          className={`text-xs font-medium uppercase tracking-widest ${
            isBreak ? 'text-success' : 'text-muted'
          }`}
        >
          {isPomodoro ? (isBreak ? 'Break' : 'Focus') : 'Elapsed'}
        </span>
        <div
          className={`font-mono text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl lg:text-6xl ${
            isBreak ? 'text-success' : 'text-primary'
          }`}
        >
          {formatClock(value)}
        </div>
      </div>

      {isPomodoro && (
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
