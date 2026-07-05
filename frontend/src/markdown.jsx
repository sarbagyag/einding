import { Fragment } from 'react'

// Renders just the Telegram-Markdown subset our n8n digests use
// (*bold*, _italic_, [text](url)) — intentionally not a general markdown
// parser, so there's no new dependency to add.
const TOKEN = /\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(([^)]+)\)/g

export function renderInline(line, keyPrefix) {
  const nodes = []
  let lastIndex = 0
  let match
  let i = 0
  TOKEN.lastIndex = 0
  while ((match = TOKEN.exec(line))) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index))
    }
    const key = `${keyPrefix}-${i++}`
    if (match[1] !== undefined) {
      nodes.push(<strong key={key}>{match[1]}</strong>)
    } else if (match[2] !== undefined) {
      nodes.push(<em key={key}>{match[2]}</em>)
    } else {
      nodes.push(
        <a
          key={key}
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
        >
          {match[3]}
        </a>,
      )
    }
    lastIndex = TOKEN.lastIndex
  }
  if (lastIndex < line.length) nodes.push(line.slice(lastIndex))
  return <Fragment key={keyPrefix}>{nodes}</Fragment>
}

// Our digests are always: one title line ("Morning Digest — ..."), then a
// run of "<category header>" lines each followed by their numbered
// "<n> headline — [Read](url)" items. A blank line usually separates
// sections but isn't load-bearing here — a line only counts as an item if
// it ends in a markdown link, so this holds regardless of spacing and
// regardless of the link text's language (English "Read", Nepali
// "पढ्नुस्", ...).
const ENDS_WITH_LINK = /\]\([^)]+\)\s*$/

export function parseDigestSections(text) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return { title: '', sections: [] }

  const [title, ...rest] = lines
  const sections = []
  for (const line of rest) {
    if (ENDS_WITH_LINK.test(line) && sections.length > 0) {
      sections[sections.length - 1].items.push(line)
    } else {
      sections.push({ header: line, items: [] })
    }
  }
  return { title, sections }
}
