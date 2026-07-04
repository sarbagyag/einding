// One quiet line at the foot of the page. Rotates daily, not per render —
// the same thought accompanies the whole day. Translation lives in the
// tooltip so the surface stays a single line of type.
const QUOTES = [
  { text: 'Arbeit in jeder wachen Stunde', note: 'Work in every waking hour — German' },
  { text: 'Ein Ding zur Zeit', note: 'One thing at a time — German' },
  { text: 'Age quod agis', note: 'Do what you are doing — Latin' },
  { text: 'Festina lente', note: 'Make haste slowly — Latin' },
  { text: '継続は力なり', note: 'Persistence is power — Japanese' },
  { text: 'उद्यमेन हि सिध्यन्ति कार्याणि', note: 'Deeds succeed through effort, not wishes — Sanskrit' },
]

export default function Quote() {
  const now = new Date()
  const dayOfYear = Math.floor(
    (now - new Date(now.getFullYear(), 0, 0)) / 86400000,
  )
  const quote = QUOTES[dayOfYear % QUOTES.length]

  return (
    <footer className="mt-16 pb-6 text-center">
      <p
        title={quote.note}
        className="cursor-default select-none text-xs italic tracking-wide text-muted/80"
      >
        {quote.text}
      </p>
    </footer>
  )
}
