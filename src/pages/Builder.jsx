import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GraphEditor from '../components/graph/GraphEditor.jsx'
import MapEditor from '../components/map/MapEditor.jsx'
import Playback from '../components/panels/Playback.jsx'
import ResultsBanner from '../components/panels/ResultsBanner.jsx'
import ShortcutsDialog from '../components/panels/ShortcutsDialog.jsx'
import SidePanel from '../components/panels/SidePanel.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { pathEdges, playbackMarks, roomMarks } from '../components/results.js'
import { keyBelongsTo, shortcutFor } from '../components/shortcuts.js'
import { useDebounced } from '../components/useDebounced.js'
import { EXAMPLES } from '../examples/index.js'
import { emptyDungeon } from '../model/dungeon.js'
import { removeEdge, removeRoom, setEndpoint } from '../model/edit.js'
import { record, redo, sameParts, startHistory, undo } from '../model/history.js'
import { loadDungeon } from '../model/load.js'
import { HOME_HREF, editHref, navigate, parseHash, shareHref } from '../routing.js'
import { browserStorage, createSave, readSave, writeSave } from '../storage/saves.js'
import { decodeShare, encodeShare } from '../storage/share.js'
import { downloadText, exportFileName, exportJson } from '../storage/transfer.js'
import { replay, solve } from '../solver/index.js'

const SAVE_DELAY = 400
// Renamed when the map became the default, so the old saved default doesn't stick.
const VIEW_KEY = 'dungeon-delver:editor-view'
const VIEWS = { map: 'Map', graph: 'Graph' }
const SAVE_STATUS = {
  saved: 'Saved in this browser',
  saving: 'Saving…',
  failed: "Couldn't save. This browser may be blocking storage, or it's full.",
  off: "Not saved: this browser won't let the site store anything.",
  shared: 'Shared with you. Not saved until you save a copy.',
  example: 'An example. Change anything and it joins your dungeons.',
}

/**
 * Keeps a saved dungeon up to date: writes it once edits pause, and right away
 * when the page is left. With no `savedId` there's nowhere to save, and
 * `unsaved` says why, except for an example: its first change saves it as a
 * new dungeon, and the URL moves to that save without reloading the editor.
 */
function useAutosave(savedId, dungeon, unsaved = 'off') {
  const [status, setStatus] = useState(savedId ? 'saved' : unsaved)
  const id = useRef(savedId)
  const written = useRef(dungeon)
  const pending = useRef(null)
  const canSave = savedId !== null || unsaved === 'example'

  const flush = useCallback(() => {
    if (!pending.current) return null
    const storage = browserStorage()
    let ok
    if (id.current) {
      ok = writeSave(storage, id.current, pending.current)
    } else {
      id.current = createSave(storage, pending.current)
      ok = id.current !== null
      // Only while the example is still on screen, not when this runs on the way out.
      if (ok && parseHash(window.location.hash).page === 'example') window.history.replaceState(null, '', editHref(id.current))
    }
    written.current = pending.current
    pending.current = null
    return ok
  }, [])

  useEffect(() => {
    if (!canSave || dungeon === written.current) return
    pending.current = dungeon
    setStatus('saving')
    const timer = setTimeout(() => setStatus(flush() ? 'saved' : 'failed'), SAVE_DELAY)
    return () => clearTimeout(timer)
  }, [canSave, dungeon, flush])

  // Don't lose the last edit when the tab closes or the page changes.
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  return status
}

function Missing({ title, children }) {
  return (
    <div className="app">
      <header className="app-header">
        <a className="home-link" href={HOME_HREF}>
          ← Dungeon Delver
        </a>
      </header>
      <main className="not-found">
        <h1>{title}</h1>
        <p className="muted">{children}</p>
        <a className="button primary" href={HOME_HREF}>
          Back to your dungeons
        </a>
      </main>
    </div>
  )
}

/**
 * Which editor is showing, 'map' or 'graph'. Both edit the same dungeon. The
 * map is the default, as it needs no graph theory; picking the other one is
 * remembered in this browser.
 */
function useEditorView() {
  const [view, setView] = useState(() => {
    try {
      return window.localStorage.getItem(VIEW_KEY) === 'graph' ? 'graph' : 'map'
    } catch {
      return 'map'
    }
  })
  function choose(next) {
    setView(next)
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Storage can be off limits; the view just isn't remembered.
    }
  }
  return [view, choose]
}

function ViewSwitch({ view, onChange }) {
  return (
    <div className="view-switch" role="group" aria-label="Editor view">
      {Object.entries(VIEWS).map(([id, label]) => (
        <button key={id} type="button" aria-pressed={view === id} className={view === id ? 'active' : undefined} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  )
}

// The full link to `dungeon`, for pasting anywhere.
const shareUrl = (dungeon) => `${window.location.origin}${window.location.pathname}${shareHref(encodeShare(dungeon))}`

/** Copies the share link, falling back to a prompt where the clipboard is off limits. */
function ShareButton({ dungeon }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function share() {
    const url = shareUrl(dungeon)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt('Copy this link to share the dungeon:', url)
    }
  }

  return (
    <button type="button" onClick={share} title="Copy a link that opens this dungeon for anyone">
      {copied ? 'Link copied ✓' : 'Share link'}
    </button>
  )
}

/**
 * The dungeon builder: the graph canvas, the side panel, and the solver's
 * results, for one saved dungeon (or an unsaved one when `id` is null).
 */
export default function Builder({ id }) {
  const [initial] = useState(() => (id ? readSave(browserStorage(), id)?.dungeon ?? null : emptyDungeon()))
  if (!initial) {
    return <Missing title="Dungeon not found">It isn&apos;t saved in this browser. Saves stay in the browser they were made in.</Missing>
  }
  return <Editor id={id} initial={initial} />
}

/**
 * The builder on a dungeon carried in a share link. Edits stay in the page
 * until the visitor saves a copy to their own dungeons.
 */
export function SharedBuilder({ data }) {
  const [initial] = useState(() => decodeShare(data).dungeon)
  if (!initial) {
    return <Missing title="This link doesn't open a dungeon">It may have been cut short when it was copied. Ask for the link again.</Missing>
  }
  return <Editor id={null} initial={initial} shared />
}

/**
 * The builder on one of the example dungeons. It's only saved, as a new
 * dungeon of the visitor's own, once they change something.
 */
export function ExampleBuilder({ exampleId }) {
  const [initial] = useState(() => {
    const example = EXAMPLES.find((e) => e.id === exampleId)
    return example ? loadDungeon(example.dungeon).dungeon : null
  })
  if (!initial) return <Missing title="Example not found">There&apos;s no example by that name.</Missing>
  return <Editor id={null} initial={initial} example />
}

// What the panel toggle says on a phone, where the panel is a sheet under the canvas.
function sheetTitle(dungeon, selection) {
  if (selection?.kind === 'room') return `Edit ${dungeon.rooms.find((r) => r.id === selection.id).label || 'room'}`
  if (selection?.kind === 'edge') return 'Edit connection'
  return 'Dungeon settings'
}

// The canvas commands each shortcut runs, by the editor's action name.
const CANVAS_ACTIONS = {
  addRoom: (c) => c.addRoom(),
  prevFloor: (c) => c.floor(-1),
  nextFloor: (c) => c.floor(1),
  zoomIn: (c) => c.zoomIn(),
  zoomOut: (c) => c.zoomOut(),
  fit: (c) => c.fit(),
}

/**
 * The header buttons that fold into a "⋯" menu on a phone. On wider screens
 * they sit in the header as usual.
 */
function MoreMenu({ children }) {
  const [open, setOpen] = useState(false)
  const menu = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => menu.current && !menu.current.contains(e.target) && setOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="more-menu" ref={menu}>
      <button type="button" className="more-toggle icon" aria-expanded={open} aria-label="More actions" title="More actions" onClick={() => setOpen(!open)}>
        ⋯
      </button>
      <div className={`more-items${open ? ' open' : ''}`}>{children}</div>
    </div>
  )
}

function Editor({ id, initial, shared = false, example = false }) {
  // The dungeon, with the edits before and after it for undo and redo.
  const [history, setHistory] = useState(() => startHistory(initial))
  const dungeon = history.present
  const setDungeon = useCallback(
    (update) => setHistory((h) => record(h, typeof update === 'function' ? update(h.present) : update, Date.now(), sameParts)),
    [],
  )
  // What's selected on the canvas: { kind: 'room' | 'edge', id } or null.
  // An undo can take away what was selected, and then nothing is.
  const [selection, setSelection] = useState(null)
  const selected =
    selection && (selection.kind === 'room' ? dungeon.rooms : dungeon.edges).some((x) => x.id === selection.id) ? selection : null
  const saveStatus = useAutosave(id, dungeon, shared ? 'shared' : example ? 'example' : 'off')
  const [view, setView] = useEditorView()
  const Canvas = view === 'map' ? MapEditor : GraphEditor
  // Commands the canvas offers the keyboard shortcuts (see CANVAS_ACTIONS).
  const canvas = useRef(null)
  const [helpOpen, setHelpOpen] = useState(false)
  // Whether the side panel is open, on a phone.
  const [sheetOpen, setSheetOpen] = useState(false)

  function saveCopy() {
    const copyId = createSave(browserStorage(), dungeon)
    if (copyId) navigate(editHref(copyId))
    else window.alert("Couldn't save. This browser may be blocking storage, or it's full. Export the JSON to keep it instead.")
  }

  // Solve again once edits pause. The results can trail the dungeon by a
  // moment, so the highlights only ever name rooms and edges by id.
  const checked = useDebounced(dungeon, 250)
  const result = useMemo(() => solve(checked), [checked])

  // The softlock being played back, as { result, index, at }. It belongs to
  // the result it came from, so any edit that changes the results ends it.
  const [playback, setPlayback] = useState(null)
  const playing = playback?.result === result ? playback : null
  const softlock = playing && result.softlocks[playing.index]
  const steps = useMemo(() => (softlock ? replay(checked, softlock.choices) : null), [softlock, checked])

  const at = playing?.at ?? 0
  const highlights = useMemo(() => {
    if (steps) return playbackMarks(checked, steps, at)
    const path = pathEdges(checked, result.criticalPath)
    return { rooms: roomMarks(result), edges: new Map([...path].map((edgeId) => [edgeId, 'on-path'])) }
  }, [steps, at, result, checked])

  useEffect(() => {
    document.title = `${dungeon.name || 'Untitled Dungeon'} · Dungeon Delver`
  }, [dungeon.name])

  // Runs a keyboard shortcut. Returns false when it has nothing to do, so the
  // key keeps its usual meaning.
  function runShortcut({ action, dx, dy, shift }) {
    const room = selected?.kind === 'room' ? selected.id : null
    switch (action) {
      case 'undo':
        setHistory(undo)
        return true
      case 'redo':
        setHistory(redo)
        return true
      case 'delete':
        if (!selected) return false
        setDungeon((d) => (selected.kind === 'room' ? removeRoom(d, selected.id) : removeEdge(d, selected.id)))
        setSelection(null)
        return true
      case 'escape':
        if (playing) setPlayback(null)
        else if (selected) setSelection(null)
        else return false
        return true
      case 'rename':
        if (!room) return false
        setSheetOpen(true)
        requestAnimationFrame(() => document.getElementById('room-name')?.select())
        return true
      case 'setStart':
      case 'setGoal':
        if (!room) return false
        setDungeon((d) => setEndpoint(d, action === 'setStart' ? 'start' : 'goal', room))
        return true
      case 'toggleView':
        setView(view === 'map' ? 'graph' : 'map')
        return true
      case 'help':
        setHelpOpen(true)
        return true
      case 'arrow':
        if (room) return canvas.current?.nudge(room, dx, dy, shift) ?? false
        // With nothing selected, left and right step through playback.
        if (steps && dy === 0) {
          const next = at + dx
          if (next >= 0 && next < steps.length) setPlayback({ ...playing, at: next })
          return true
        }
        return false
      default:
        if (!CANVAS_ACTIONS[action] || !canvas.current) return false
        CANVAS_ACTIONS[action](canvas.current)
        return true
    }
  }

  // Shortcuts work wherever focus is, except in a field or the shortcuts list.
  const shortcutHandler = useRef(runShortcut)
  useEffect(() => {
    shortcutHandler.current = helpOpen ? () => false : runShortcut
  })
  useEffect(() => {
    function onKeyDown(event) {
      const shortcut = shortcutFor(event)
      if (!shortcut || event.defaultPrevented || keyBelongsTo(event.target, shortcut)) return
      // The graph moves a focused room with the arrow keys itself.
      if (shortcut.action === 'arrow' && event.target.closest?.('.react-flow__node')) return
      if (shortcutHandler.current(shortcut)) event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <a className="home-link" href={HOME_HREF} title="All your dungeons" aria-label="All your dungeons">
          ← <span className="home-text">Dungeon Delver</span>
        </a>
        <h1>{dungeon.name || 'Untitled Dungeon'}</h1>
        <span className={`save-status save-${saveStatus}`}>{SAVE_STATUS[saveStatus]}</span>
        <div className="header-actions">
          <ViewSwitch view={view} onChange={setView} />
          <div className="undo-redo">
            <button type="button" className="icon" onClick={() => setHistory(undo)} disabled={history.past.length === 0} aria-label="Undo" title="Undo (Ctrl+Z)">
              ↶
            </button>
            <button type="button" className="icon" onClick={() => setHistory(redo)} disabled={history.future.length === 0} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
              ↷
            </button>
          </div>
          {shared && (
            <button type="button" className="primary" onClick={saveCopy}>
              Save a copy
            </button>
          )}
          <MoreMenu>
            <ShareButton dungeon={dungeon} />
            <button type="button" onClick={() => downloadText(exportFileName(dungeon), exportJson(dungeon))} title="Download this dungeon as a JSON file">
              Export JSON
            </button>
            <button type="button" className="icon shortcuts-button" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
              ?
            </button>
            <ThemeToggle />
          </MoreMenu>
        </div>
      </header>
      <main className="workspace">
        <div className="canvas-column">
          <ResultsBanner
            dungeon={checked}
            result={result}
            playing={playing?.index ?? null}
            onPlay={(index) => setPlayback({ result, index, at: 0 })}
          />
          {steps && (
            <Playback
              dungeon={checked}
              steps={steps}
              at={at}
              label={result.softlocks.length > 1 ? `Softlock ${playing.index + 1} of ${result.softlocks.length}` : 'Softlock'}
              onStep={(at) => setPlayback({ ...playing, at })}
              onClose={() => setPlayback(null)}
            />
          )}
          <Canvas
            commands={canvas}
            dungeon={dungeon}
            onChange={setDungeon}
            selection={selected}
            onSelect={setSelection}
            highlights={highlights}
          />
        </div>
        <div className={`panel-sheet${sheetOpen ? ' open' : ''}`}>
          <button type="button" className="sheet-toggle" aria-expanded={sheetOpen} onClick={() => setSheetOpen(!sheetOpen)}>
            <span>{sheetTitle(dungeon, selected)}</span>
            <span aria-hidden="true">{sheetOpen ? '▾' : '▴'}</span>
          </button>
          <SidePanel dungeon={dungeon} selection={selected} onChange={setDungeon} onSelect={setSelection} view={view} />
        </div>
      </main>
      {helpOpen && <ShortcutsDialog onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
