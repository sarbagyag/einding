// One quiet line at the foot of the page. Rotates daily, not per render —
// the same thought accompanies the whole day. The translation sits right
// underneath instead of hiding in a hover tooltip, so it reads on touch too.
const QUOTES = [
  { text: 'Arbeit in jeder wachen Stunde', translation: 'Work in every waking hour', lang: 'German' },
  { text: 'Ein Ding zur Zeit', translation: 'One thing at a time', lang: 'German' },
  { text: 'एक पटकमा एउटै काम', translation: 'One thing at a time', lang: 'Nepali' },
  { text: 'Age quod agis', translation: 'Do what you are doing', lang: 'Latin' },
  { text: 'Festina lente', translation: 'Make haste slowly', lang: 'Latin' },
  { text: '継続は力なり', translation: 'Persistence is power', lang: 'Japanese' },
  { text: '千里之行，始於足下', translation: 'A journey of a thousand miles begins with a single step', lang: 'Chinese' },
  { text: 'उद्यमेन हि सिध्यन्ति कार्याणि', translation: 'Deeds succeed through effort, not wishes', lang: 'Sanskrit' },
  { text: 'Doucement mais sûrement', translation: 'Slowly but surely', lang: 'French' },
  { text: 'Poco a poco se llega lejos', translation: 'Little by little, one goes far', lang: 'Spanish' },
]

export default function Quote() {
  const now = new Date()
  const dayOfYear = Math.floor(
    (now - new Date(now.getFullYear(), 0, 0)) / 86400000,
  )
  const quote = QUOTES[dayOfYear % QUOTES.length]

  return (
    <footer className="mt-20 pb-10 text-center">
      <div aria-hidden className="mx-auto mb-5 h-px w-10 bg-white/10" />
      <p className="select-none text-base italic tracking-wide text-primary/70 sm:text-lg">
        {quote.text}
      </p>
      <p className="mt-2 select-none text-xs text-muted/70">
        {quote.translation} <span className="text-muted/40">&middot; {quote.lang}</span>
      </p>
    </footer>
  )
}
