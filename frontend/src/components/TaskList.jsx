import { useState } from 'react'
import TaskCard from './TaskCard'

export default function TaskList({ tasks, activeTaskId, onDoNow, onDelete, onCreate }) {
  const [name, setName] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
    setName('')
  }

  return (
    <div className="mt-8">
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New task"
          className="flex-1 rounded-lg border border-muted/20 bg-surface px-4 py-2 text-primary placeholder-muted outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:brightness-110"
        >
          Add
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {tasks.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">No tasks yet — add one above.</p>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isActive={task.id === activeTaskId}
            onDoNow={onDoNow}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}
