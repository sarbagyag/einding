const API_TOKEN = import.meta.env.VITE_API_TOKEN

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `request failed: ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  listTasks: () => request('/tasks'),
  createTask: (name) => request('/tasks', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  logSession: (taskId, session) =>
    request(`/tasks/${taskId}/sessions`, { method: 'POST', body: JSON.stringify(session) }),
}
