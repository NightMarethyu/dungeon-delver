import { useState } from 'react'
import GraphEditor from './components/graph/GraphEditor.jsx'
import SidePanel from './components/panels/SidePanel.jsx'
import { emptyDungeon } from './model/dungeon.js'

export default function App() {
  const [dungeon, setDungeon] = useState(emptyDungeon)
  // What's selected on the canvas: { kind: 'room' | 'edge', id } or null.
  const [selection, setSelection] = useState(null)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Dungeon Delver</h1>
        <p className="muted">Sketch how your dungeon&apos;s rooms connect and what locks each door.</p>
      </header>
      <main className="workspace">
        <GraphEditor dungeon={dungeon} onChange={setDungeon} selection={selection} onSelect={setSelection} />
        <SidePanel dungeon={dungeon} selection={selection} onChange={setDungeon} onSelect={setSelection} />
      </main>
    </div>
  )
}
