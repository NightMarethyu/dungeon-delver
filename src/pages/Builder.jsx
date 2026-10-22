import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GraphEditor from '../components/graph/GraphEditor.jsx'
import Playback from '../components/panels/Playback.jsx'
import ResultsBanner from '../components/panels/ResultsBanner.jsx'
import SidePanel from '../components/panels/SidePanel.jsx'
import { pathEdges, playbackMarks, roomMarks } from '../components/results.js'
import { useDebounced } from '../components/useDebounced.js'
import { emptyDungeon } from '../model/dungeon.js'
import { HOME_HREF } from '../routing.js'
import { browserStorage, readSave, writeSave } from '../storage/saves.js'
import { replay, solve } from '../solver/index.js'

const SAVE_DELAY = 400
const SAVE_STATUS = {
  saved: 'Saved in this browser',
  saving: 'Saving…',
  failed: "Couldn't save. This browser may be blocking storage, or it's full.",
  off: "Not saved: this browser won't let the site store anything.",
}

/**
 * Keeps a saved dungeon up to date: writes it once edits pause, and right away
 * when the page is left. `id` null means there's nowhere to save.
 */
function useAutosave(id, dungeon) {
  const [status, setStatus] = useState(id ? 'saved' : 'off')
  const written = useRef(dungeon)
  const pending = useRef(null)

  const flush = useCallback(() => {
    if (!pending.current) return null
    const ok = writeSave(browserStorage(), id, pending.current)
    written.current = pending.current
    pending.current = null
    return ok
  }, [id])

  useEffect(() => {
    if (!id || dungeon === written.current) return
    pending.current = dungeon
    setStatus('saving')
    const timer = setTimeout(() => setStatus(flush() ? 'saved' : 'failed'), SAVE_DELAY)
    return () => clearTimeout(timer)
  }, [id, dungeon, flush])

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

function NotFound() {
  return (
    <div className="app">
      <header className="app-header">
        <a className="home-link" href={HOME_HREF}>
          ← Dungeon Delver
        </a>
      </header>
      <main className="not-found">
        <h1>Dungeon not found</h1>
        <p className="muted">It isn&apos;t saved in this browser. Saves stay in the browser they were made in.</p>
        <a className="button primary" href={HOME_HREF}>
          Back to your dungeons
        </a>
      </main>
    </div>
  )
}

/**
 * The dungeon builder: the graph canvas, the side panel, and the solver's
 * results, for one saved dungeon (or an unsaved one when `id` is null).
 */
export default function Builder({ id }) {
  const [initial] = useState(() => (id ? readSave(browserStorage(), id)?.dungeon ?? null : emptyDungeon()))
  if (!initial) return <NotFound />
  return <Editor id={id} initial={initial} />
}

function Editor({ id, initial }) {
  const [dungeon, setDungeon] = useState(initial)
  // What's selected on the canvas: { kind: 'room' | 'edge', id } or null.
  const [selection, setSelection] = useState(null)
  const saveStatus = useAutosave(id, dungeon)

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
