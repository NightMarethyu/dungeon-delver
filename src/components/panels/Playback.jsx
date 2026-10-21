import { useEffect } from 'react'
import { describeChoice, holdingText } from '../results.js'

const TYPING = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

/**
 * Steps through one softlock, above the canvas. The canvas shows the matching
 * highlights; this says what happened at each step.
 * @param {{
 *   dungeon: import('../../model/dungeon.js').Dungeon,
 *   steps: ReturnType<typeof import('../../solver/replay.js').replay>,
 *   at: number,
 *   label: string,
 *   onStep: (at: number) => void,
 *   onClose: () => void,
 * }} props
 */
export default function Playback({ dungeon, steps, at, label, onStep, onClose }) {
  const step = steps[at]
  const last = steps.length - 1
  const what = step.choice ? `${describeChoice(dungeon, step.choice)}.` : 'The player starts here.'

  // Arrow keys step and Escape stops, wherever focus is, unless the user is
  // typing in a field.
  useEffect(() => {
    function onKeyDown(e) {
      if (TYPING.has(e.target.tagName)) return
      if (e.key === 'ArrowLeft' && at > 0) onStep(at - 1)
      else if (e.key === 'ArrowRight' && at < last) onStep(at + 1)
      else if (e.key === 'Escape') onClose()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [at, last, onStep, onClose])

  return (
    <section className={`playback${at === last ? ' at-end' : ''}`} aria-label="Softlock playback">
      <div className="playback-step">
        <span className="muted">
          {label} · {at === 0 ? 'Start' : `Step ${at} of ${last}`} · ← → to step, Esc to stop
        </span>
        <span aria-live="polite">
          {at === last ? <strong>{what} Now the goal can&apos;t be reached.</strong> : what}{' '}
          <span className="muted">Holding: {holdingText(step)}.</span>
        </span>
      </div>
      <div className="playback-controls">
        <button type="button" onClick={() => onStep(0)} disabled={at === 0} aria-label="First step" title="First step">
          ⏮
        </button>
        <button type="button" onClick={() => onStep(at - 1)} disabled={at === 0}>
          ◀ Back
        </button>
        <button type="button" className="primary" onClick={() => onStep(at + 1)} disabled={at === last} autoFocus>
          Next ▶
        </button>
        <button type="button" onClick={onClose} aria-label="Stop playback" title="Stop playback (Esc)">
          ✕
        </button>
      </div>
    </section>
  )
}
