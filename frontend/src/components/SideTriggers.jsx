export default function SideTriggers({ onOpen }) {
  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-2">
      <button
        onClick={() => onOpen('vocab')}
        aria-label="Open German vocab review"
        title="German vocab"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-surface text-lg shadow-lg shadow-black/30 transition hover:border-accent/50"
      >
        🇩🇪
      </button>
      <button
        onClick={() => onOpen('news')}
        aria-label="Open news digest"
        title="News"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-surface text-lg shadow-lg shadow-black/30 transition hover:border-accent/50"
      >
        📰
      </button>
    </div>
  )
}
