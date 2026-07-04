import Timer from './Timer'
import { formatHours } from '../format'

export default function ActiveTask({ task, timer }) {
  if (!task) {
    return (
      <div className="rounded-2xl border border-dashed border-muted/30 bg-surface/40 p-8 text-center">
        <p className="text-muted">Nothing in focus</p>
        <p className="mt-1 text-sm text-muted">
          Pick a task below and hit &ldquo;Do Now&rdquo; to begin.
        </p>
      </div>
    )
  }

  const liveTotalSeconds = task.totalSeconds + timer.accruedSeconds

  return (
    <div className="rounded-2xl border border-accent/40 bg-surface p-6 shadow-lg shadow-accent/5">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted">Now doing</p>
          <h2 className="mt-1 truncate text-2xl font-semibold text-primary">{task.name}</h2>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs uppercase tracking-widest text-muted">Invested</p>
          <p className="mt-1 font-mono text-xl text-success">{formatHours(liveTotalSeconds)}</p>
        </div>
      </div>

      <Timer timer={timer} />
    </div>
  )
}
