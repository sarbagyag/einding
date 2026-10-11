import { useEffect, useRef, useState } from 'react'
import TaskStats from './TaskStats'
import { formatHours } from '../format'

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <path d="M8 .8 10.9 4H5.1L8 .8Z" />
      <rect x="2" y="5.6" width="12" height="1.5" rx=".75" />
      <rect x="2" y="7.75" width="12" height="1.5" rx=".75" />
      <rect x="2" y="9.9" width="12" height="1.5" rx=".75" />
      <path d="M8 15.2 5.1 12h5.8L8 15.2Z" />
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
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const cardRef = useRef(null)
  // Window-level drag listeners outlive renders, so they read the latest props
  // through a ref instead of closing over stale ones.
  const live = useRef({})
  live.current = { isFirst, isLast, onMove, id: task.id }

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

  // Press the grip and drag: whenever the pointer leaves the card past its top
  // or bottom edge, the task swaps one slot that way and follows the pointer.
  const startDrag = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.preventDefault()
    setDragging(true)
    const onPointerMove = (ev) => {
      const rect = cardRef.current?.getBoundingClientRect()
      if (!rect) return
      const { isFirst: first, isLast: last, onMove: move, id } = live.current
      if (ev.clientY < rect.top && !first) move(id, -1)
      else if (ev.clientY > rect.bottom && !last) move(id, 1)
    }
    const stop = () => {
      setDragging(false)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  // Keyboard fallback: arrow keys on the focused grip shift the task.
  const handleGripKey = (e) => {
    if (e.key === 'ArrowUp' && !isFirst) {
      e.preventDefault()
      onMove(task.id, -1)
    } else if (e.key === 'ArrowDown' && !isLast) {
      e.preventDefault()
      onMove(task.id, 1)
    }
  }

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
      ref={cardRef}
      className={`overflow-hidden rounded-xl border transition-colors ${
        dragging ? 'ring-1 ring-accent/60 ' : ''
      }${
        isActive
          ? 'border-accent/40 bg-accent/[0.07]'
          : 'border-white/[0.06] bg-surface hover:border-white/[0.12]'
      }`}
    >
      <div className="flex items-center gap-2 py-2.5 pl-2 pr-3 sm:pr-4">
        <button
          onPointerDown={startDrag}
          onKeyDown={handleGripKey}
          aria-label={`Reorder ${task.name} — drag, or use the up and down arrow keys`}
          className={`shrink-0 touch-none rounded p-1.5 transition hover:text-primary ${
            dragging ? 'cursor-grabbing text-accent' : 'cursor-grab text-muted'
          }`}
        >
          <GripIcon />
        </button>

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
