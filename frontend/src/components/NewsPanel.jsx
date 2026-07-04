import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { renderDigest } from '../markdown'
import { formatDay, formatTime } from '../format'

const TABS = [
  { key: 'global', label: 'Global' },
  { key: 'nepali', label: 'Nepali' },
]

const POLL_INTERVAL_MS = 15_000
const POLL_MAX_MS = 6 * 60_000

export default function NewsPanel() {
  const [category, setCategory] = useState('global')
  const [items, setItems] = useState(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(null)
  const pollRef = useRef(null)

  const stopPolling = useCallback(() => {
    clearInterval(pollRef.current)
    pollRef.current = null
    setRefreshing(false)
  }, [])

  useEffect(() => {
    stopPolling()
    setItems(null)
    setFailed(false)
    setRefreshError(null)
    api
      .listNews(category)
      .then(setItems)
      .catch(() => setFailed(true))
    return stopPolling
  }, [category, stopPolling])

  const handleRefresh = useCallback(async () => {
    setRefreshError(null)
    try {
      // The n8n workflow can take several minutes (RSS reads + an LLM
      // summarization) before it writes the digest to Postgres itself, so
      // we only wait for the trigger to be accepted, then poll for the
      // fresh item to show up rather than holding this request open.
      await api.refreshNews(category)
    } catch (err) {
      setRefreshError(err.message || 'Could not trigger a refresh — check your connection.')
      return
    }

    const knownNewestId = items?.[0]?.id ?? null
    const startedAt = Date.now()
    setRefreshing(true)
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_MAX_MS) {
        stopPolling()
        return
      }
      try {
        const fresh = await api.listNews(category)
        if (fresh[0]?.id !== knownNewestId) {
          setItems(fresh)
          stopPolling()
        }
      } catch {
        // transient — keep polling until POLL_MAX_MS gives up above
      }
    }, POLL_INTERVAL_MS)
  }, [category, items, stopPolling])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1 rounded-lg bg-bg p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCategory(tab.key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm transition ${
                category === tab.key ? 'bg-accent text-white' : 'text-muted hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Fetch fresh news now"
          title="Fetch fresh news now"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted transition hover:border-accent/50 hover:text-primary disabled:cursor-wait disabled:opacity-50"
        >
          {refreshing ? '…' : '↻'}
        </button>
      </div>

      {refreshing && (
        <p className="text-xs text-muted">
          Triggered — this can take a few minutes. We&rsquo;ll show it here the moment it&rsquo;s ready.
        </p>
      )}
      {refreshError && <p className="text-sm text-red-300">{refreshError}</p>}

      {failed && <p className="text-sm text-muted">Couldn&rsquo;t load news — check your connection.</p>}
      {!failed && !items && <p className="text-sm text-muted">Loading&hellip;</p>}
      {!failed && items && items.length === 0 && <p className="text-sm text-muted">No digests yet.</p>}

      {!failed && items && items.length > 0 && (
        <div className="flex flex-col gap-4">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`rounded-xl border border-white/[0.06] p-4 text-sm leading-relaxed ${
                idx === 0 ? 'bg-bg' : 'bg-bg/40'
              }`}
            >
              <p className="mb-2 font-mono text-xs text-muted">
                {formatDay(item.createdAt)} &middot; {formatTime(item.createdAt)}
              </p>
              <div className="whitespace-pre-wrap text-primary/90">{renderDigest(item.message)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
