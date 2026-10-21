import { useMemo, useState } from 'react'
import GraphEditor from './components/graph/GraphEditor.jsx'
import ResultsBanner from './components/panels/ResultsBanner.jsx'
import SidePanel from './components/panels/SidePanel.jsx'
import { pathEdges, roomMarks } from './components/results.js'
import { useDebounced } from './components/useDebounced.js'
import { emptyDungeon } from './model/dungeon.js'
import { solve } from './solver/index.js'

export default function App() {
  const [dungeon, setDungeon] = useState(emptyDungeon)
  // What's selected on the canvas: { kind: 'room' | 'edge', id } or null.
  const [selection, setSelection] = useState(null)

  // Solve again once edits pause. The results can trail the dungeon by a
  // moment, so the highlights only ever name rooms and edges by id.
  const checked = useDebounced(dungeon, 250)
  const result = useMemo(() => solve(checked), [checked])
  const highlights = useMemo(
    () => ({ rooms: roomMarks(result), edges: pathEdges(checked, result.criticalPath) }),
    [result, checked],
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>Dungeon Delver</h1>
        <p className="muted">Sketch how your dungeon&apos;s rooms connect and what locks each door.</p>
      </header>
      <main className="workspace">
        <div className="canvas-column">
          <ResultsBanner dungeon={checked} result={result} />
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
