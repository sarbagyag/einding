import { useEffect, useState } from 'react'
import { formatHours } from '../format'

export default function TaskCard({ task, isActive, onDoNow, onDelete }) {
  const [confirming, setConfirming] = useState(false)

  // A stray tap shouldn't erase a task and its logged hours — the first tap
  // arms the delete and it disarms itself if not confirmed within 3s.
  useEffect(() => {
    if (!confirming) return
    const id = setTimeout(() => setConfirming(false), 3000)
    return () => clearTimeout(id)
  }, [confirming])

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition ${
        isActive
          ? 'border-accent/50 bg-accent/10'
          : 'border-muted/15 bg-surface hover:border-muted/30'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-primary">{task.name}</p>
        <p className="font-mono text-sm text-muted">{formatHours(task.totalSeconds)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => onDoNow(task.id)}
          disabled={isActive}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isActive ? 'Active' : 'Do Now'}
        </button>
        {confirming ? (
          <button
            onClick={() => onDelete(task.id)}
            aria-label={`Confirm delete ${task.name}`}
            className="rounded-md bg-red-500/15 px-2.5 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-500/25"
          >
            Sure?
          </button>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${task.name}`}
            className="rounded-md px-2.5 py-1.5 text-sm text-muted transition hover:bg-red-500/10 hover:text-red-400"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  )
}
