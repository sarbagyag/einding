import { useEffect, useRef } from 'react'

const AUTO_HIDE_MS = 90_000

export default function SidePanel({ title, onClose, children }) {
  const panelRef = useRef(null)

  // Hidden by default, revealed on click — and self-closes after a stretch
  // of inactivity so a distraction panel can't accidentally stay open
  // through an entire focus session.
  useEffect(() => {
    const node = panelRef.current
    let timeoutId
    const reset = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(onClose, AUTO_HIDE_MS)
    }
    reset()
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']
    events.forEach((e) => node.addEventListener(e, reset))
    node.addEventListener('scroll', reset, { capture: true, passive: true })
    return () => {
      clearTimeout(timeoutId)
      events.forEach((e) => node.removeEventListener(e, reset))
      node.removeEventListener('scroll', reset, { capture: true })
    }
  }, [onClose])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 animate-[einding-fade-in_0.15s_ease-out] bg-black/60 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={title}
        aria-modal="true"
        className="relative flex h-full w-full animate-[einding-slide-in_0.2s_ease-out] flex-col border-l border-white/10 bg-surface shadow-2xl sm:w-[420px]"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="font-medium text-primary">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted transition hover:bg-white/5 hover:text-primary"
          >
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
