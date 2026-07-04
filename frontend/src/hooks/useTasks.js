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

  const renameTask = useCallback(async (id, name) => {
    const updated = await api.renameTask(id, name)
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === updated.id ? updated : t))
      saveCache(next)
      return next
    })
  }, [])

  // Swaps the task with its neighbor; the new order is applied locally first
  // and synced to the server in the background.
  const moveTask = useCallback(
    (id, direction) => {
      const idx = tasks.findIndex((t) => t.id === id)
      const target = idx + direction
      if (idx < 0 || target < 0 || target >= tasks.length) return Promise.resolve()
      const next = [...tasks]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      setTasks(next)
      saveCache(next)
      return api.reorderTasks(next.map((t) => t.id))
    },
    [tasks],
  )

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

  return { tasks, isOffline, createTask, renameTask, moveTask, deleteTask, logSession }
}
