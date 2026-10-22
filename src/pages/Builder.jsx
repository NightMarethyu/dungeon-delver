import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GraphEditor from '../components/graph/GraphEditor.jsx'
import Playback from '../components/panels/Playback.jsx'
import ResultsBanner from '../components/panels/ResultsBanner.jsx'
import SidePanel from '../components/panels/SidePanel.jsx'
import { pathEdges, playbackMarks, roomMarks } from '../components/results.js'
import { useDebounced } from '../components/useDebounced.js'
import { EXAMPLES } from '../examples/index.js'
import { emptyDungeon } from '../model/dungeon.js'
import { loadDungeon } from '../model/load.js'
import { HOME_HREF, editHref, navigate, parseHash, shareHref } from '../routing.js'
import { browserStorage, createSave, readSave, writeSave } from '../storage/saves.js'
import { decodeShare, encodeShare } from '../storage/share.js'
import { downloadText, exportFileName, exportJson } from '../storage/transfer.js'
import { replay, solve } from '../solver/index.js'

const SAVE_DELAY = 400
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

function Editor({ id, initial, shared = false, example = false }) {
  const [dungeon, setDungeon] = useState(initial)
  // What's selected on the canvas: { kind: 'room' | 'edge', id } or null.
  const [selection, setSelection] = useState(null)
  const saveStatus = useAutosave(id, dungeon, shared ? 'shared' : example ? 'example' : 'off')

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

  return (
    <div className="app">
      <header className="app-header">
        <a className="home-link" href={HOME_HREF} title="All your dungeons">
          ← Dungeon Delver
        </a>
        <h1>{dungeon.name || 'Untitled Dungeon'}</h1>
        <span className={`save-status save-${saveStatus}`}>{SAVE_STATUS[saveStatus]}</span>
        <div className="header-actions">
          {shared && (
            <button type="button" className="primary" onClick={saveCopy}>
              Save a copy
            </button>
          )}
          <ShareButton dungeon={dungeon} />
          <button type="button" onClick={() => downloadText(exportFileName(dungeon), exportJson(dungeon))} title="Download this dungeon as a JSON file">
            Export JSON
          </button>
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
          <GraphEditor
            dungeon={dungeon}
            onChange={setDungeon}
            selection={selection}
            onSelect={setSelection}
            highlights={highlights}
          />
        </div>
        <SidePanel dungeon={dungeon} selection={selection} onChange={setDungeon} onSelect={setSelection} />
      </main>
    </div>
  )
}
