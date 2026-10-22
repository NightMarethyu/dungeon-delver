import { describeChoice, summarize } from '../results.js'

const ICONS = { good: '✓', warn: '!', bad: '✕', info: 'i' }
const lowerFirst = (text) => text[0].toLowerCase() + text.slice(1)

function Legend({ result }) {
  const items = [
    result.criticalPath && ['path', 'Critical path'],
    result.optionalRooms.length > 0 && ['optional', 'Optional'],
    result.unreachableRooms.length > 0 && ['unreachable', 'Unreachable'],
  ].filter(Boolean)
  if (items.length === 0) return null
  return (
    <ul className="legend" aria-label="Highlights">
      {items.map(([mark, label]) => (
        <li key={mark}>
          <span className={`swatch swatch-${mark}`} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  )
}

function Softlocks({ dungeon, softlocks, playing, onPlay }) {
  if (softlocks.length === 0) return null
  return (
    <details className="banner-details">
      <summary>How the player gets stuck</summary>
      <ol className="softlocks">
        {softlocks.map((softlock, i) => {
          // Only the last choice is the mistake; the ones before it set it up.
          const steps = softlock.choices.map((c, j) => (j === 0 ? describeChoice(dungeon, c) : lowerFirst(describeChoice(dungeon, c))))
          return (
            <li key={i} className={playing === i ? 'playing' : undefined}>
              <button type="button" className="play" onClick={() => onPlay(i)} aria-label={`Play softlock ${i + 1}`} title="Step through it on the canvas">
                ▶ Play
              </button>{' '}
              {steps.length > 1 && <span className="muted">{steps.slice(0, -1).join(', then ')}, then </span>}
              <strong>{steps.at(-1)}</strong>
            </li>
          )
        })}
      </ol>
    </details>
  )
}

function Warnings({ warnings }) {
  const list = warnings.filter((w) => w.severity === 'warning')
  if (list.length === 0) return null
  return (
    <details className="banner-details">
      <summary>
        {list.length} data {list.length === 1 ? 'problem' : 'problems'}
      </summary>
      <ul className="warnings">
        {list.map((w, i) => (
          <li key={i}>{w.message}</li>
        ))}
      </ul>
    </details>
  )
}

/**
 * The solver's verdict on the dungeon, above the canvas.
 * `playing` is the index of the softlock being played back, if any.
 * @param {{
 *   dungeon: import('../../model/dungeon.js').Dungeon,
 *   result: ReturnType<typeof import('../../solver/solve.js').solve>,
 *   playing: number | null,
 *   onPlay: (index: number) => void,
 * }} props
 */
export default function ResultsBanner({ dungeon, result, playing, onPlay }) {
  const { tone, title, detail } = summarize(result)
  return (
    <section className={`results-banner tone-${tone}`} aria-live="polite">
      <div className="banner-main">
        <span className="banner-icon" aria-hidden="true">{ICONS[tone]}</span>
        <div className="banner-text">
          <strong>{title}</strong> <span className="muted">{detail}</span>
        </div>
        {playing === null && <Legend result={result} />}
      </div>
      <Softlocks dungeon={dungeon} softlocks={result.softlocks} playing={playing} onPlay={onPlay} />
      <Warnings warnings={result.warnings} />
    </section>
  )
}
