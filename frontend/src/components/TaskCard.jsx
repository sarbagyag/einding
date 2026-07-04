import { useEffect, useRef, useState } from 'react'
import TaskStats from './TaskStats'
import { formatHours } from '../format'

function Chevron({ up }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`h-3 w-3 ${up ? '' : 'rotate-180'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 7.5 6 4l3.5 3.5" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M11.9 1.6a1.9 1.9 0 0 1 2.7 2.7l-8.6 8.6-3.6 1 1-3.6 8.5-8.7Zm1.6 1a.9.9 0 0 0-1.3 0l-.7.7 1.3 1.3.7-.7a.9.9 0 0 0 0-1.3ZM11.4 5.7l-1.3-1.3-6 6.1-.5 1.8 1.8-.5 6-6.1Z" />
    </svg>
  )
}

export default function TaskCard({ task, isActive, isFirst, isLast, onDoNow, onDelete, onRename, onMove }) {
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(task.name)
  const inputRef = useRef(null)

  // A stray tap shouldn't erase a task and its logged hours — the first tap
  // arms the delete and it disarms itself if not confirmed within 3s.
  useEffect(() => {
    if (!confirming) return
    const id = setTimeout(() => setConfirming(false), 3000)
    return () => clearTimeout(id)
  }, [confirming])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const startEditing = () => {
    setDraft(task.name)
    setEditing(true)
  }

  const commitRename = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== task.name) onRename(task.id, trimmed)
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-colors ${
        isActive
          ? 'border-accent/40 bg-accent/[0.07]'
          : 'border-white/[0.06] bg-surface hover:border-white/[0.12]'
      }`}
    >
      <div className="flex items-center gap-2 py-2.5 pl-2 pr-3 sm:pr-4">
        <div className="flex shrink-0 flex-col">
          <button
            onClick={() => onMove(task.id, -1)}
            disabled={isFirst}
            aria-label={`Move ${task.name} up`}
            className="rounded p-1 text-muted transition hover:text-primary disabled:opacity-25 disabled:hover:text-muted"
          >
            <Chevron up />
          </button>
          <button
            onClick={() => onMove(task.id, 1)}
            disabled={isLast}
            aria-label={`Move ${task.name} down`}
            className="rounded p-1 text-muted transition hover:text-primary disabled:opacity-25 disabled:hover:text-muted"
          >
            <Chevron up={false} />
          </button>
        </div>

        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setEditing(false)
            }}
            maxLength={200}
            className="min-w-0 flex-1 rounded-md border border-accent/60 bg-bg px-2 py-1 font-medium text-primary outline-none"
          />
        ) : (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="min-w-0 flex-1 text-left"
            aria-expanded={expanded}
            aria-label={`Show history for ${task.name}`}
          >
            <p className="truncate font-medium text-primary">{task.name}</p>
            <p className="font-mono text-xs text-muted">{formatHours(task.totalSeconds)}</p>
          </button>
        )}

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!editing && (
            <button
              onClick={startEditing}
              aria-label={`Rename ${task.name}`}
              className="rounded-md p-2 text-muted transition hover:bg-white/5 hover:text-primary"
            >
              <PencilIcon />
            </button>
          )}
          <button
            onClick={() => onDoNow(task.id)}
            disabled={isActive}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-default disabled:bg-accent/20 disabled:text-accent"
          >
            {isActive ? 'Active' : 'Do Now'}
          </button>
          {confirming ? (
            <button
              onClick={() => onDelete(task.id)}
              aria-label={`Confirm delete ${task.name}`}
              className="rounded-md bg-red-500/15 px-2 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-500/25"
            >
              Sure?
            </button>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${task.name}`}
              className="rounded-md px-2 py-1.5 text-sm text-muted transition hover:bg-red-500/10 hover:text-red-400"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.06] bg-bg/50 px-4 py-3">
          <TaskStats taskId={task.id} />
        </div>
      )}
    </div>
  )
}
