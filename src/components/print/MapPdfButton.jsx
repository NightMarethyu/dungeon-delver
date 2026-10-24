import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { downloadText } from '../../storage/transfer.js'
import { GRIDS, mapFileName, mapPdf, PAPERS, pageCount, SCALES } from './battleMap.js'

const OPTIONS_KEY = 'dungeon-delver:map-pdf'

// Letter where it's the usual paper, A4 everywhere else.
const LETTER_REGIONS = /-(US|CA|MX|PH|CL|CO|VE|GT|CR|PA|DO|PR)\b/i
const defaultPaper = () => (typeof navigator !== 'undefined' && LETTER_REGIONS.test(navigator.language ?? '') ? 'letter' : 'a4')

function loadOptions() {
  const fallback = { grid: 'square', scale: 1, paper: defaultPaper() }
  try {
    const saved = JSON.parse(window.localStorage.getItem(OPTIONS_KEY) ?? 'null')
    if (!saved) return fallback
    return {
      grid: GRIDS[saved.grid] ? saved.grid : fallback.grid,
      scale: SCALES.includes(saved.scale) ? saved.scale : fallback.scale,
      paper: PAPERS[saved.paper] ? saved.paper : fallback.paper,
    }
  } catch {
    return fallback
  }
}

function saveOptions(options) {
  try {
    window.localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
  } catch {
    // Storage can be off limits; the choices just aren't remembered.
  }
}

// The choices for the map PDF, in a modal dialog.
function MapPdfDialog({ dungeon, audience, onClose }) {
  const dialog = useRef(null)
  const [options, setOptions] = useState(loadOptions)
  const pages = useMemo(() => pageCount(dungeon, { audience, ...options }), [dungeon, audience, options])

  useEffect(() => {
    dialog.current.showModal()
  }, [])

  const set = (change) => {
    const next = { ...options, ...change }
    setOptions(next)
    saveOptions(next)
  }

  function download() {
    downloadText(mapFileName(dungeon), mapPdf(dungeon, { audience, ...options }), 'application/pdf')
    dialog.current.close()
  }

  return (
    <dialog
      ref={dialog}
      className="shortcuts-dialog map-pdf-dialog"
      aria-labelledby="map-pdf-title"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <div className="shortcuts-head">
        <h2 id="map-pdf-title">Printable map</h2>
        <button type="button" className="icon" onClick={() => dialog.current.close()} aria-label="Close">
          ✕
        </button>
      </div>
      <p className="muted">
        {audience === 'players'
          ? 'A battle map of the rooms on the players’ handout, at true size for miniatures: one grid square or hex to an inch.'
          : 'A battle map of every room, at true size for miniatures: one grid square or hex to an inch. Rooms are numbered as on the notes sheet.'}
      </p>
      <fieldset className="map-pdf-choice">
        <legend>Grid in the rooms</legend>
        {Object.entries(GRIDS).map(([id, label]) => (
          <label key={id}>
            <input type="radio" name="map-pdf-grid" checked={options.grid === id} onChange={() => set({ grid: id })} autoFocus={options.grid === id} />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="map-pdf-field">
        <span>Each square of the map prints as</span>
        <select value={options.scale} onChange={(e) => set({ scale: Number(e.target.value) })}>
          {SCALES.map((n) => (
            <option key={n} value={n}>
              {n === 1 ? '1 inch (1 grid square)' : `${n} inches (${n} × ${n} grid squares)`}
            </option>
          ))}
        </select>
      </label>
      <label className="map-pdf-field">
        <span>Paper</span>
        <select value={options.paper} onChange={(e) => set({ paper: e.target.value })}>
          {Object.entries(PAPERS).map(([id, paper]) => (
            <option key={id} value={id}>
              {paper.label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted map-pdf-note">
        {pages === 1 ? 'Fits on 1 page.' : `${pages} pages, with an overview of how they tape together.`} Print at actual size (100%), not “fit to page”, to keep the
        inch true.
      </p>
      <div className="map-pdf-actions">
        <button type="button" onClick={() => dialog.current.close()}>
          Cancel
        </button>
        <button type="button" className="primary" onClick={download} disabled={pages === 0}>
          Download PDF
        </button>
      </div>
    </dialog>
  )
}

/**
 * A button that opens the choices for a printable battle map of `dungeon`,
 * and downloads it as a PDF. For 'players', only what their handout shows.
 */
export default function MapPdfButton({ dungeon, audience = 'gm', className, children = 'Map PDF' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        disabled={dungeon.rooms.length === 0}
        title="Download a printable map with a 1-inch grid for miniatures"
      >
        {children}
      </button>
      {/* On the body, so a menu that folds this button away doesn't hide the dialog too. */}
      {open && createPortal(<MapPdfDialog dungeon={dungeon} audience={audience} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}
