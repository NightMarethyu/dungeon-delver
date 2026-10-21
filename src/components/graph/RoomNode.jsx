import { Handle, Position } from '@xyflow/react'
import { useState } from 'react'
import { thingText } from '../labels.js'

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left]

// A room on the graph canvas. Double-click the name to rename it. The dots on
// each side start a connection; with connectionMode "loose" any dot can end one.
export default function RoomNode({ data, selected }) {
  const { room, onRename } = data
  const [editing, setEditing] = useState(false)

  function commit(event) {
    const label = event.target.value.trim()
    if (label && label !== room.label) onRename(label)
    setEditing(false)
  }

  return (
    <div className={`room-node${selected ? ' selected' : ''}`}>
      {SIDES.map((side) => (
        <Handle key={side} id={side} type="source" position={side} className="room-handle" />
      ))}
      {editing ? (
        <input
          className="room-rename nodrag"
          aria-label="Room name"
          defaultValue={room.label}
          autoFocus
          onFocus={(e) => e.target.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <div className="room-label" title="Double-click to rename" onDoubleClick={() => setEditing(true)}>
          {room.label}
        </div>
      )}
      {room.contents.length > 0 && (
        <ul className="room-contents">
          {room.contents.map((c, i) => (
            <li key={i} className={`chip chip-${c.type}`}>{thingText(c)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
