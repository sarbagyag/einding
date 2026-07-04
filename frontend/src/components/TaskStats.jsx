import { useEffect, useState } from 'react'
import { api } from '../api'
import { formatDay, formatHours, formatTime } from '../format'

// Groups sessions (already sorted newest-first) into consecutive day buckets.
function groupByDay(sessions) {
  const groups = []
  for (const s of sessions) {
    const day = formatDay(s.startedAt)
    const last = groups[groups.length - 1]
    if (last && last.day === day) {
      last.sessions.push(s)
      last.total += s.durationSeconds
    } else {
      groups.push({ day, sessions: [s], total: s.durationSeconds })
    }
  }
  return groups
}

export default function TaskStats({ taskId }) {
  const [sessions, setSessions] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .listSessions(taskId)
      .then((data) => {
        if (!cancelled) setSessions(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [taskId])

  if (failed) {
    return <p className="text-sm text-muted">Couldn&rsquo;t load history — are you offline?</p>
  }
  if (!sessions) {
    return <p className="text-sm text-muted">Loading&hellip;</p>
  }
  if (sessions.length === 0) {
    return <p className="text-sm text-muted">No sessions logged yet.</p>
  }

  const groups = groupByDay(sessions)

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.day}>
          <div className="mb-1 flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">{group.day}</p>
            <p className="font-mono text-xs text-success">{formatHours(group.total)}</p>
          </div>
          <div className="flex flex-col gap-0.5">
            {group.sessions.map((s) => (
              <div key={s.id} className="flex items-baseline justify-between font-mono text-sm">
                <span className="text-primary/80">
                  {formatTime(s.startedAt)}
                  <span className="text-muted"> &rarr; </span>
                  {formatTime(s.endedAt)}
                </span>
                <span className="text-muted">{formatHours(s.durationSeconds)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
