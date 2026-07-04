import { useState } from 'react'
import TaskCard from './TaskCard'

export default function TaskList({
  tasks,
  activeTaskId,
  onDoNow,
  onDelete,
  onCreate,
  onRename,
  onMove,
}) {
  const [name, setName] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
    setName('')
  }

  return (
    <section className="mt-10 lg:mt-0">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted">Tasks</h2>
        {tasks.length > 0 && (
          <span className="font-mono text-xs text-muted">{tasks.length}</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mb-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New task"
          maxLength={200}
          className="min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-surface px-4 py-2.5 text-primary placeholder-muted outline-none transition focus:border-accent/60"
        />
        <button
          type="submit"
          className="rounded-xl bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110"
        >
          Add
        </button>
      </form>

      {/* Capped height on desktop so ~5-6 tasks are visible at once without
          growing the whole page — the list scrolls internally past that. */}
      <div className="flex flex-col gap-2 lg:max-h-[34rem] lg:overflow-y-auto lg:pr-1">
        {tasks.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">No tasks yet — add one above.</p>
        )}
        {tasks.map((task, i) => (
          <TaskCard
            key={task.id}
            task={task}
            isActive={task.id === activeTaskId}
            isFirst={i === 0}
            isLast={i === tasks.length - 1}
            onDoNow={onDoNow}
            onDelete={onDelete}
            onRename={onRename}
            onMove={onMove}
          />
        ))}
      </div>
    </section>
  )
}
