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
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      aria-modal="true"
      className="fixed inset-0 z-50 flex animate-[einding-fade-in_0.15s_ease-out] flex-col bg-bg"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5 sm:px-10">
        <h2 className="text-xl font-medium text-primary">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-muted transition hover:bg-white/5 hover:text-primary"
        >
          <span className="hidden rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-muted/70 group-hover:text-muted sm:inline-block">
            Esc
          </span>
          <span className="text-xl leading-none">&times;</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-2xl animate-[einding-rise-in_0.25s_ease-out]">
          {children}
        </div>
      </div>
    </div>
  )
}
