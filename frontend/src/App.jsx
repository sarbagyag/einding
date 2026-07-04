import { useCallback, useEffect, useRef, useState } from 'react'
import ActiveTask from './components/ActiveTask'
import TaskList from './components/TaskList'
import { useTasks } from './hooks/useTasks'
import { useTimer } from './hooks/useTimer'
import { playBeep } from './beep'
import { formatClock } from './format'

export default function App() {
  const { tasks, isOffline, createTask, deleteTask, logSession } = useTasks()
  const [notice, setNotice] = useState(null)
  const noticeTimeoutRef = useRef(null)

  const showNotice = useCallback((message) => {
    setNotice(message)
    clearTimeout(noticeTimeoutRef.current)
    noticeTimeoutRef.current = setTimeout(() => setNotice(null), 4000)
  }, [])

  const handleWorkSessionComplete = useCallback(
    (taskId, session) => {
      logSession(taskId, session).catch(() =>
        showNotice("Couldn't sync the session — check your connection."),
      )
    },
    [logSession, showNotice],
  )

  const timer = useTimer({
    onWorkSessionComplete: handleWorkSessionComplete,
    onPhaseComplete: () => playBeep(),
  })

  const activeTask = tasks.find((t) => t.id === timer.activeTaskId) || null

  // Keep the countdown visible in the tab title while the timer runs, so a
  // backgrounded tab still tells you where you stand at a glance.
  useEffect(() => {
    if (timer.timerState.isRunning && activeTask) {
      const prefix = timer.timerState.phase === 'break' ? 'Break' : activeTask.name
      document.title = `${formatClock(timer.value)} · ${prefix}`
    } else {
      document.title = 'Einding'
    }
  })

  const handleDoNow = (taskId) => {
    timer.switchActiveTask(taskId)
  }

  const handleDelete = async (taskId) => {
    if (taskId === timer.activeTaskId) {
      timer.clearActiveTask()
    }
    try {
      await deleteTask(taskId)
    } catch {
      showNotice("Couldn't delete the task — check your connection.")
    }
  }

  const handleCreate = async (name) => {
    try {
      await createTask(name)
    } catch {
      showNotice("Couldn't add the task — check your connection.")
    }
  }

  return (
    <div className="mx-auto min-h-full max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-primary">
          Einding<span className="text-accent">.</span>
        </h1>
        {isOffline && (
          <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted">Offline</span>
        )}
      </header>

      {notice && (
        <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {notice}
        </div>
      )}

      <ActiveTask task={activeTask} timer={timer} />

      <TaskList
        tasks={tasks}
        activeTaskId={timer.activeTaskId}
        onDoNow={handleDoNow}
        onDelete={handleDelete}
        onCreate={handleCreate}
      />
    </div>
  )
}
