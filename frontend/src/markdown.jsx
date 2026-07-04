import { Fragment } from 'react'

// Renders just the Telegram-Markdown subset our n8n digests use
// (*bold*, _italic_, [text](url)) — intentionally not a general markdown
// parser, so there's no new dependency to add.
const TOKEN = /\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(([^)]+)\)/g

function renderLine(line, keyPrefix) {
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
  return nodes
}

export function renderDigest(text) {
  return text.split('\n').map((line, idx) => (
    <Fragment key={idx}>
      {idx > 0 && <br />}
      {renderLine(line, idx)}
    </Fragment>
  ))
}
