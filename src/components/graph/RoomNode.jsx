import { Handle, Position } from '@xyflow/react'
import { useState } from 'react'
import { thingText } from '../labels.js'

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left]
const ROLE_TAGS = { start: '▶ Start', goal: '★ Goal' }
const MARK_TAGS = { optional: 'Optional', unreachable: 'Unreachable', stuck: 'Stuck' }

// A room on the graph canvas. Double-click the name to rename it. The dots on
// each side start a connection; with connectionMode "loose" any dot can end one.
// `role` marks the start and goal rooms, and `mark` is the solver's highlight.
export default function RoomNode({ data, selected }) {
  const { room, role, mark, floorName, onRename } = data
  const [editing, setEditing] = useState(false)

  function commit(event) {
    const label = event.target.value.trim()
    if (label && label !== room.label) onRename(label)
    setEditing(false)
  }

  return (
    <div className={['room-node', selected && 'selected', role && `role-${role}`, mark && `mark-${mark}`].filter(Boolean).join(' ')}>
      {SIDES.map((side) => (
        <Handle key={side} id={side} type="source" position={side} className="room-handle" />
      ))}
      {(role || MARK_TAGS[mark] || floorName) && (
        <div className="room-tags">
          {role && <span className={`tag tag-${role}`}>{ROLE_TAGS[role]}</span>}
          {MARK_TAGS[mark] && <span className={`tag tag-${mark}`}>{MARK_TAGS[mark]}</span>}
          {floorName && <span className="tag tag-floor">{floorName}</span>}
        </div>
      )}
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
