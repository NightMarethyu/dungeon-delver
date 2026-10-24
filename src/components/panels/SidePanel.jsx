import { CONTENT_TYPES, EDGE_KINDS, GATE_TYPES, NOTE_FIELDS } from '../../model/dungeon.js'
import {
  addFloor,
  itemNames,
  moveFloor,
  removeEdge,
  removeFloor,
  removeRoom,
  renameDungeon,
  renameFloor,
  reverseEdge,
  setEndpoint,
  setRoomNote,
  updateEdge,
  updateRoom,
} from '../../model/edit.js'
import Icon from '../icons/Icon.jsx'
import { contentIconName, gateIconName, passageIconName } from '../icons/icons.js'
import { CONTENT_LABELS, GATE_LABELS, KIND_LABELS, NOTE_LABELS } from '../labels.js'

const ITEM_LIST_ID = 'known-items'

// An item gate or content keeps its name; other types have none.
function withType(thing, type) {
  return type === 'item' ? { type, name: thing.name ?? '' } : { type }
}

// A dropdown, with the chosen option's icon beside it when there is one.
function Select({ label, value, options, labels, icon, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="with-icon">
        {icon && <Icon name={icon} size={24} />}
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>{labels[o]}</option>
          ))}
        </select>
      </span>
    </label>
  )
}

function ItemNameInput({ value, onChange, label = 'Item name' }) {
  return (
    <input
      className="item-name"
      aria-label={label}
      placeholder="e.g. hookshot"
      list={ITEM_LIST_ID}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function RoomPanel({ room, dungeon, onChange, onSelect }) {
  const update = (patch) => onChange((d) => updateRoom(d, room.id, patch))
  const setContents = (contents) => update({ contents })
  // A room on a floor that's gone still shows its floor id, so nothing is lost.
  const floors = dungeon.floors.some((f) => f.id === room.floor)
    ? dungeon.floors
    : [...dungeon.floors, { id: room.floor, name: `${room.floor} (missing)` }]

  return (
    <>
      <h2>Room</h2>
      <label className="field">
        <span>Name</span>
        <input id="room-name" value={room.label} onChange={(e) => update({ label: e.target.value })} />
      </label>
      <label className="field">
        <span>Floor</span>
        <select value={room.floor} onChange={(e) => update({ floor: e.target.value })}>
          {floors.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </label>
      <div className="endpoints" role="group" aria-label="Start and goal">
        {[['start', '▶ Start room'], ['goal', '★ Goal room']].map(([which, label]) => (
          <label key={which} className="check">
            <input
              type="checkbox"
              checked={dungeon[which] === room.id}
              onChange={(e) => onChange((d) => setEndpoint(d, which, e.target.checked ? room.id : null))}
            />
            {label}
          </label>
        ))}
      </div>

      <fieldset className="contents">
        <legend>Contents</legend>
        {room.contents.length === 0 && <p className="muted">Nothing here.</p>}
        {room.contents.map((c, i) => (
          <div className="content-row" key={i}>
            <Icon name={contentIconName(c)} size={22} />
            <select
              aria-label="Content type"
              value={c.type}
              onChange={(e) => setContents(room.contents.with(i, withType(c, e.target.value)))}
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>{CONTENT_LABELS[t]}</option>
              ))}
            </select>
            {c.type === 'item' && (
              <ItemNameInput value={c.name} onChange={(name) => setContents(room.contents.with(i, { ...c, name }))} />
            )}
            <button
              type="button"
              className="icon"
              aria-label="Remove"
              title="Remove"
              onClick={() => setContents(room.contents.toSpliced(i, 1))}
            >
              ×
            </button>
          </div>
        ))}
        <div className="add-contents">
          {CONTENT_TYPES.map((t) => (
            <button key={t} type="button" className="with-icon" onClick={() => setContents([...room.contents, withType({}, t)])}>
              + <Icon name={contentIconName({ type: t })} size={16} /> {CONTENT_LABELS[t]}
            </button>
          ))}
        </div>
      </fieldset>
      <PuzzleNote room={room} dungeon={dungeon} onSelect={onSelect} />
      <RoomNotes room={room} onChange={onChange} />

      <button
        type="button"
        className="danger"
        onClick={() => {
          onChange((d) => removeRoom(d, room.id))
          onSelect(null)
        }}
      >
        Delete room
      </button>
    </>
  )
}

// The game master's notes, one box per kind of note. The solver ignores them.
function RoomNotes({ room, onChange }) {
  return (
    <fieldset className="contents notes">
      <legend>Notes for the game master</legend>
      {NOTE_FIELDS.map((field) => (
        <label className="field" key={field}>
          <span>{NOTE_LABELS[field].label}</span>
          <textarea
            rows={2}
            placeholder={NOTE_LABELS[field].hint}
            value={room.notes?.[field] ?? ''}
            onChange={(e) => onChange((d) => setRoomNote(d, room.id, field, e.target.value))}
          />
        </label>
      ))}
    </fieldset>
  )
}

// Which connections a puzzle in this room opens, each a link to select it.
function PuzzleNote({ room, dungeon, onSelect }) {
  const opens = dungeon.edges.filter((e) => e.gate.type === 'puzzle' && e.gate.at === room.id && (e.from === room.id || e.to === room.id))
  if (opens.length === 0) return null
  const name = (id) => dungeon.rooms.find((r) => r.id === id)?.label ?? id
  return (
    <p className="puzzle-note with-icon">
      <Icon name="puzzle" size={20} />
      <span>
        Solving the puzzle here opens the way to{' '}
        {opens.map((e, i) => (
          <span key={e.id}>
            {i > 0 && (i === opens.length - 1 ? ' and ' : ', ')}
            <button type="button" className="link" onClick={() => onSelect({ kind: 'edge', id: e.id })}>
              {name(e.from === room.id ? e.to : e.from)}
            </button>
          </span>
        ))}
        .
      </span>
    </p>
  )
}

function EdgePanel({ edge, dungeon, onChange, onSelect }) {
  const update = (patch) => onChange((d) => updateEdge(d, edge.id, patch))
  const name = (id) => dungeon.rooms.find((r) => r.id === id)?.label ?? id

  return (
    <>
      <h2>Connection</h2>
      <p className="edge-ends">
        {name(edge.from)} <span aria-label={edge.oneWay ? 'to' : 'and'}>{edge.oneWay ? '→' : '↔'}</span> {name(edge.to)}
      </p>
      <Select
        label="Kind"
        value={edge.kind}
        options={EDGE_KINDS}
        labels={KIND_LABELS}
        icon={passageIconName(dungeon, edge) ?? 'door'}
        // Drops are one-way almost always, so default them to it.
        onChange={(kind) => update(kind === 'drop' ? { kind, oneWay: true } : { kind })}
      />
      <Select
        label="Locked by"
        value={edge.gate.type}
        options={GATE_TYPES}
        labels={GATE_LABELS}
        icon={gateIconName(edge.gate)}
        // A new puzzle starts out in the room the connection leads from.
        onChange={(type) => update({ gate: type === 'puzzle' ? { type, at: edge.from } : withType(edge.gate, type) })}
      />
      {edge.gate.type === 'puzzle' && (
        <label className="field">
          <span>Solved from</span>
          <select value={edge.gate.at === edge.from || edge.gate.at === edge.to ? edge.gate.at : ''} onChange={(e) => update({ gate: e.target.value ? { type: 'puzzle', at: e.target.value } : { type: 'puzzle' } })}>
            <option value={edge.from}>Inside {name(edge.from)}</option>
            <option value={edge.to}>Inside {name(edge.to)}</option>
            <option value="">Either side (on the door itself)</option>
          </select>
          <span className="muted hint">
            {edge.gate.at === edge.from || edge.gate.at === edge.to
              ? `Opens once the player reaches ${name(edge.gate.at)}, then stays open both ways.`
              : 'Anyone at the door can solve it, so it never blocks the way.'}
          </span>
        </label>
      )}
      {edge.gate.type === 'item' && (
        <label className="field">
          <span>Item</span>
          <ItemNameInput value={edge.gate.name} onChange={(itemName) => update({ gate: { type: 'item', name: itemName } })} />
        </label>
      )}
      <label className="check">
        <input type="checkbox" checked={edge.oneWay} onChange={(e) => update({ oneWay: e.target.checked })} />
        One-way (only from {name(edge.from)} to {name(edge.to)})
      </label>
      {edge.oneWay && (
        <button type="button" onClick={() => onChange((d) => reverseEdge(d, edge.id))}>
          ⇄ Reverse direction
        </button>
      )}
      <button
        type="button"
        className="danger"
        onClick={() => {
          onChange((d) => removeEdge(d, edge.id))
          onSelect(null)
        }}
      >
        Delete connection
      </button>
    </>
  )
}

function RoomSelect({ label, value, rooms, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Not set</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>{r.label}</option>
        ))}
      </select>
    </label>
  )
}

function FloorList({ dungeon, onChange }) {
  const { floors } = dungeon
  const roomCount = (id) => dungeon.rooms.filter((r) => r.floor === id).length

  return (
    <fieldset className="contents floors">
      <legend>Floors</legend>
      {floors.map((floor, i) => {
        const count = roomCount(floor.id)
        // Rooms on a removed floor move to the one above it in the list.
        const moveTo = floors[i === 0 ? 1 : i - 1]
        return (
          <div className="content-row" key={floor.id}>
            <input
              className="item-name"
              aria-label="Floor name"
              value={floor.name}
              onChange={(e) => onChange((d) => renameFloor(d, floor.id, e.target.value))}
            />
            <span className="muted floor-count" title={`${count} ${count === 1 ? 'room' : 'rooms'}`}>{count}</span>
            <button type="button" className="icon" aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => onChange((d) => moveFloor(d, floor.id, -1))}>
              ↑
            </button>
            <button
              type="button"
              className="icon"
              aria-label="Move down"
              title="Move down"
              disabled={i === floors.length - 1}
              onClick={() => onChange((d) => moveFloor(d, floor.id, 1))}
            >
              ↓
            </button>
            <button
              type="button"
              className="icon"
              aria-label="Remove floor"
              title={floors.length === 1 ? "A dungeon needs at least one floor" : count > 0 ? `Remove (its rooms move to ${moveTo.name})` : 'Remove'}
              disabled={floors.length === 1}
              onClick={() => onChange((d) => removeFloor(d, floor.id))}
            >
              ×
            </button>
          </div>
        )
      })}
      <div className="add-contents">
        <button type="button" onClick={() => onChange((d) => addFloor(d).dungeon)}>
          + Floor
        </button>
      </div>
      <p className="muted hint">List the top floor first, so stairs point the right way. Pick a room&apos;s floor when it&apos;s selected.</p>
    </fieldset>
  )
}

function DungeonPanel({ dungeon, onChange, view }) {
  return (
    <>
      <h2>Dungeon</h2>
      <label className="field">
        <span>Name</span>
        <input value={dungeon.name} onChange={(e) => onChange((d) => renameDungeon(d, e.target.value))} />
      </label>
      <RoomSelect label="▶ Start room" value={dungeon.start} rooms={dungeon.rooms} onChange={(id) => onChange((d) => setEndpoint(d, 'start', id))} />
      <RoomSelect label="★ Goal room" value={dungeon.goal} rooms={dungeon.rooms} onChange={(id) => onChange((d) => setEndpoint(d, 'goal', id))} />
      <FloorList dungeon={dungeon} onChange={onChange} />
      <Help view={view} />
    </>
  )
}

function Help({ view }) {
  return (
    <details className="help-box" open>
      <summary>How to build a dungeon</summary>
      <ul className="help">
        {view === 'map' ? (
          <>
            <li><strong>Add a room</strong> with the button, or double-click the grid. With a room selected, the button adds one beside it.</li>
            <li><strong>Move</strong> a room by dragging it, and <strong>resize</strong> the selected room from its corners.</li>
            <li><strong>Add a door</strong> by clicking a <strong>+</strong> on a wall two rooms share, or by dragging the arrow in the selected room&apos;s corner onto another room.</li>
            <li><strong>Stairs and holes</strong> to other floors show inside their room. Click one to go to the room it leads to. Connect rooms on different floors in the graph, or by moving a room to another floor here.</li>
            <li><strong>Select</strong> a room or door to edit it here, and rename it. Click empty space to come back.</li>
            <li>On a touch screen, <strong>pinch</strong> to zoom and <strong>double-tap</strong> the grid to add a room.</li>
          </>
        ) : (
          <>
            <li><strong>Add a room</strong> with the button, or double-click empty space.</li>
            <li><strong>Connect rooms</strong> by dragging from the dot on a room&apos;s edge to another room.</li>
            <li><strong>Select</strong> a room or connection to edit it here. Click empty space to come back.</li>
            <li><strong>Rename</strong> a room by double-clicking its name.</li>
            <li>On a touch screen, <strong>pinch</strong> to zoom and <strong>double-tap</strong> empty space to add a room.</li>
          </>
        )}
        <li><strong>Delete</strong> the selected room or connection with Delete or Backspace.</li>
        <li><strong>Set a start and goal</strong> and the check above the canvas updates as you edit.</li>
        <li><strong>Undo</strong> with the ↶ button or <kbd>Ctrl</kbd> <kbd>Z</kbd>.</li>
        <li className="key-hint">Press <kbd>?</kbd> for all the keyboard shortcuts.</li>
      </ul>
    </details>
  )
}

/**
 * Edits whatever is selected on the canvas.
 * @param {{
 *   dungeon: import('../../model/dungeon.js').Dungeon,
 *   selection: { kind: 'room' | 'edge', id: string } | null,
 *   onChange: Function,
 *   onSelect: Function,
 *   view: 'map' | 'graph',
 * }} props
 */
export default function SidePanel({ dungeon, selection, onChange, onSelect, view }) {
  const room = selection?.kind === 'room' && dungeon.rooms.find((r) => r.id === selection.id)
  const edge = selection?.kind === 'edge' && dungeon.edges.find((e) => e.id === selection.id)
  const props = { dungeon, onChange, onSelect }

  return (
    <aside className="side-panel">
      {room ? <RoomPanel key={room.id} room={room} {...props} /> : edge ? <EdgePanel key={edge.id} edge={edge} {...props} /> : <DungeonPanel dungeon={dungeon} onChange={onChange} view={view} />}
      <datalist id={ITEM_LIST_ID}>
        {itemNames(dungeon).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </aside>
  )
}
