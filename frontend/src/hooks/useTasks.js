import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

const CACHE_KEY = 'einding:tasks-cache'

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveCache(tasks) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(tasks))
}

export function useTasks() {
  const [tasks, setTasks] = useState(loadCache)
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .listTasks()
      .then((fresh) => {
        if (cancelled) return
        setTasks(fresh)
        saveCache(fresh)
        setIsOffline(false)
      })
      .catch(() => {
        if (!cancelled) setIsOffline(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const createTask = useCallback(async (name) => {
    const created = await api.createTask(name)
    setTasks((prev) => {
      const next = [...prev, created]
      saveCache(next)
      return next
    })
    return created
  }, [])

  const deleteTask = useCallback(async (id) => {
    await api.deleteTask(id)
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== id)
      saveCache(next)
      return next
    })
  }, [])

  const logSession = useCallback(async (taskId, sessionPayload) => {
    const { task: updatedTask } = await api.logSession(taskId, sessionPayload)
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      saveCache(next)
      return next
    })
    return updatedTask
  }, [])

  return { tasks, isOffline, createTask, deleteTask, logSession }
}
