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
  renameTask: (id, name) =>
    request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  reorderTasks: (ids) => request('/tasks/order', { method: 'PUT', body: JSON.stringify({ ids }) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  listSessions: (taskId) => request(`/tasks/${taskId}/sessions`),
  logSession: (taskId, session) =>
    request(`/tasks/${taskId}/sessions`, { method: 'POST', body: JSON.stringify(session) }),
  listDueVocab: () => request('/vocab/due'),
  reviewVocab: (id, rating) =>
    request(`/vocab/cards/${id}/review`, { method: 'POST', body: JSON.stringify({ rating }) }),
  listNews: (category) => request(`/news?category=${category}`),
  refreshNews: (category) =>
    request('/news/refresh', { method: 'POST', body: JSON.stringify({ category }) }),
}
