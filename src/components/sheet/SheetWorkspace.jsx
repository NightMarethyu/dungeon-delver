import { useEffect, useState } from 'react'
import MapPdfButton from '../print/MapPdfButton.jsx'
import { setSheet } from '../../model/edit.js'
import { handoutHref } from '../../routing.js'
import { encodeShare } from '../../storage/share.js'
import { AUDIENCES } from '../labels.js'
import Sheet from './Sheet.jsx'
import { playerHandout } from './sheet.js'

const KEY_CHOICES = { numbers: '1, 2, 3', letters: 'A, B, C' }

// The full link to a read-only handout of what the players may see.
const handoutUrl = (dungeon) => `${window.location.origin}${window.location.pathname}${handoutHref(encodeShare(playerHandout(dungeon)))}`

function HandoutLinkButton({ dungeon }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    const url = handoutUrl(dungeon)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt("Copy this link to give the players their handout:", url)
    }
  }

  return (
    <button type="button" onClick={copy} title="Copy a link to the players' handout. It holds only what they may see.">
      {copied ? 'Link copied ✓' : "Copy players' link"}
    </button>
  )
}

/**
 * The builder's Sheet view: the notes sheet to edit and print, with a toolbar
 * to switch between the game master's sheet and the players' handout, pick
 * the room labels, and print or share the handout.
 */
export default function SheetWorkspace({ dungeon, onChange }) {
  const [audience, setAudience] = useState('gm')
  return (
    <div className="sheet-workspace">
      <div className="sheet-toolbar">
        <div className="view-switch" role="group" aria-label="Whose sheet">
          {Object.entries(AUDIENCES).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={audience === id} className={audience === id ? 'active' : undefined} onClick={() => setAudience(id)}>
              {label}
            </button>
          ))}
        </div>
        <label className="sheet-keys-choice">
          <span>Labels</span>
          <select value={dungeon.sheet?.keys ?? 'numbers'} onChange={(e) => onChange((d) => setSheet(d, { keys: e.target.value === 'numbers' ? undefined : e.target.value }))}>
            {Object.entries(KEY_CHOICES).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {dungeon.sheet?.order && (
          <button type="button" onClick={() => onChange((d) => setSheet(d, { order: undefined }))} title="Put the rooms back in order from the entrance">
            Reset order
          </button>
        )}
        <span className="sheet-toolbar-gap" />
        <HandoutLinkButton dungeon={dungeon} />
        <MapPdfButton dungeon={dungeon} audience={audience} />
        <button type="button" className="primary" onClick={() => window.print()} title="Print this sheet, or save it as a PDF">
          Print
        </button>
      </div>
      <p className="sheet-hint muted">
        {audience === 'gm'
          ? 'Type right on the page. The eye on each room and note picks what the players’ handout shows.'
          : 'This is what the players get. Switch back to Game master to choose what’s on it.'}
      </p>
      <Sheet dungeon={dungeon} audience={audience} onChange={onChange} />
    </div>
  )
}
