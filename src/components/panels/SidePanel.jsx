import { CONTENT_TYPES, EDGE_KINDS, GATE_TYPES } from '../../model/dungeon.js'
import { itemNames, removeEdge, removeRoom, reverseEdge, updateEdge, updateRoom } from '../../model/edit.js'
import { CONTENT_LABELS, GATE_LABELS, KIND_LABELS } from '../labels.js'

const ITEM_LIST_ID = 'known-items'

// An item gate or content keeps its name; other types have none.
function withType(thing, type) {
  return type === 'item' ? { type, name: thing.name ?? '' } : { type }
}

function Select({ label, value, options, labels, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>{labels[o]}</option>
        ))}
      </select>
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
        <input value={room.label} onChange={(e) => update({ label: e.target.value })} />
      </label>
      <label className="field">
        <span>Floor</span>
        <select value={room.floor} onChange={(e) => update({ floor: e.target.value })}>
          {floors.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </label>

      <fieldset className="contents">
        <legend>Contents</legend>
        {room.contents.length === 0 && <p className="muted">Nothing here.</p>}
        {room.contents.map((c, i) => (
          <div className="content-row" key={i}>
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
            <button key={t} type="button" onClick={() => setContents([...room.contents, withType({}, t)])}>
              + {CONTENT_LABELS[t]}
            </button>
          ))}
        </div>
      </fieldset>

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
        // Drops are one-way almost always, so default them to it.
        onChange={(kind) => update(kind === 'drop' ? { kind, oneWay: true } : { kind })}
      />
      <Select
        label="Locked by"
        value={edge.gate.type}
        options={GATE_TYPES}
        labels={GATE_LABELS}
        onChange={(type) => update({ gate: withType(edge.gate, type) })}
      />
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

function Help() {
  return (
    <>
      <h2>Build your dungeon</h2>
      <ul className="help">
        <li><strong>Add a room</strong> with the button, or double-click empty space.</li>
        <li><strong>Connect rooms</strong> by dragging from the dot on a room&apos;s edge to another room.</li>
        <li><strong>Select</strong> a room or connection to edit it here.</li>
        <li><strong>Rename</strong> a room by double-clicking its name.</li>
        <li><strong>Delete</strong> the selected room or connection with Delete or Backspace.</li>
      </ul>
    </>
  )
}

/**
 * Edits whatever is selected on the canvas.
 * @param {{
 *   dungeon: import('../../model/dungeon.js').Dungeon,
 *   selection: { kind: 'room' | 'edge', id: string } | null,
 *   onChange: Function,
 *   onSelect: Function,
 * }} props
 */
export default function SidePanel({ dungeon, selection, onChange, onSelect }) {
  const room = selection?.kind === 'room' && dungeon.rooms.find((r) => r.id === selection.id)
  const edge = selection?.kind === 'edge' && dungeon.edges.find((e) => e.id === selection.id)
  const props = { dungeon, onChange, onSelect }

  return (
    <aside className="side-panel">
      {room ? <RoomPanel key={room.id} room={room} {...props} /> : edge ? <EdgePanel key={edge.id} edge={edge} {...props} /> : <Help />}
      <datalist id={ITEM_LIST_ID}>
        {itemNames(dungeon).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </aside>
  )
}
