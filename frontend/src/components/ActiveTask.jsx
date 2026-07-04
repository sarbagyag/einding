import Timer from './Timer'
import { formatHours } from '../format'

export default function ActiveTask({ task, timer }) {
  if (!task) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-surface/40 px-6 py-10 text-center">
        <p className="font-medium text-primary/80">Nothing in focus</p>
        <p className="mt-1.5 text-sm text-muted">
          Pick a task below and hit &ldquo;Do Now&rdquo; to begin.
        </p>
      </div>
    )
  }

  const liveTotalSeconds = task.totalSeconds + timer.accruedSeconds

  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-surface p-6 sm:p-8">
      {/* soft accent glow bleeding in from the top edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 -top-20 h-40 rounded-full bg-accent/15 blur-3xl"
      />

      <div className="relative mb-7 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest text-accent/80">Now doing</p>
          <h2 className="mt-1.5 truncate text-2xl font-semibold text-primary">{task.name}</h2>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">Invested</p>
          <p className="mt-1.5 font-mono text-xl text-success">{formatHours(liveTotalSeconds)}</p>
        </div>
      </div>

      <div className="relative">
        <Timer timer={timer} />
      </div>
    </div>
  )
}
