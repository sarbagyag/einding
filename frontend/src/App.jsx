import { useCallback, useEffect, useRef, useState } from 'react'
import ActiveTask from './components/ActiveTask'
import TaskList from './components/TaskList'
import Quote from './components/Quote'
import SideTriggers from './components/SideTriggers'
import SidePanel from './components/SidePanel'
import VocabReview from './components/VocabReview'
import NewsPanel from './components/NewsPanel'
import { useTasks } from './hooks/useTasks'
import { useTimer } from './hooks/useTimer'
import { playBeep } from './beep'
import { formatClock, formatHours } from './format'

export default function App() {
  const { tasks, isOffline, createTask, renameTask, moveTask, deleteTask, logSession } = useTasks()
  const [notice, setNotice] = useState(null)
  const noticeTimeoutRef = useRef(null)
  // Which distraction panel is open — hidden by default, shown on click,
  // auto-hidden again by SidePanel after a stretch of inactivity.
  const [openPanel, setOpenPanel] = useState(null)

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
  const totalInvested = tasks.reduce((sum, t) => sum + t.totalSeconds, 0)

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

  const handleRename = async (taskId, name) => {
    try {
      await renameTask(taskId, name)
    } catch {
      showNotice("Couldn't rename the task — check your connection.")
    }
  }

  const handleMove = (taskId, direction) => {
    moveTask(taskId, direction).catch(() =>
      showNotice("Couldn't save the new order — check your connection."),
    )
  }

  return (
    <div className="mx-auto min-h-full max-w-[1400px] px-4 py-8 sm:py-12 lg:px-10">
      <header className="mb-8 flex items-baseline justify-between px-1 lg:mb-10">
        <h1 className="text-xl font-semibold tracking-tight text-primary">
          Einding<span className="text-accent">.</span>
        </h1>
        <div className="flex items-baseline gap-3">
          {totalInvested > 0 && (
            <span className="font-mono text-sm text-muted">{formatHours(totalInvested)} total</span>
          )}
          {isOffline && (
            <span className="rounded-full border border-white/[0.08] bg-surface px-3 py-1 text-xs text-muted">
              Offline
            </span>
          )}
        </div>
      </header>

      {notice && (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {notice}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[420px_1fr] lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-10">
          <ActiveTask task={activeTask} timer={timer} />
        </div>

        <TaskList
          tasks={tasks}
          activeTaskId={timer.activeTaskId}
          onDoNow={handleDoNow}
          onDelete={handleDelete}
          onCreate={handleCreate}
          onRename={handleRename}
          onMove={handleMove}
        />
      </div>

      <Quote />

      <SideTriggers onOpen={setOpenPanel} />

      {openPanel === 'vocab' && (
        <SidePanel title="German Vocab" onClose={() => setOpenPanel(null)}>
          <VocabReview />
        </SidePanel>
      )}
      {openPanel === 'news' && (
        <SidePanel title="News Digest" onClose={() => setOpenPanel(null)}>
          <NewsPanel />
        </SidePanel>
      )}
    </div>
  )
}
