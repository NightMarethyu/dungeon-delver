import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { NOTE_FIELDS, playerParts } from '../../model/dungeon.js'
import { renameDungeon, setPlayerHidden, setPlayerPart, setRoomNote, setSheet, updateRoom } from '../../model/edit.js'
import RoomChips from '../icons/RoomChips.jsx'
import { NOTE_LABELS, ROLE_TAGS } from '../labels.js'
import { movedOrder, playerKeys, sheetSections } from './sheet.js'
import SheetMap from './SheetMap.jsx'

const entryId = (id) => `sheet-room-${id}`

/**
 * A text box that grows with its text, so the sheet reads like a page. When
 * printed, plain text takes its place, as a box would cut its text off.
 */
function SheetText({ value, onChange, placeholder, label, className = '', inputRef }) {
  const own = useRef(null)
  const box = inputRef ?? own
  useLayoutEffect(() => {
    const node = box.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }, [value, box])
  return (
    <>
      <textarea
        ref={box}
        className={`sheet-text ${className}`}
        rows={1}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className={`sheet-print-text ${className}`}>{value}</p>
    </>
  )
}

// The eye on a note or a room: whether the players' handout shows it.
function PlayerToggle({ shown, onToggle, what }) {
  const title = shown ? `Players see ${what}. Click to hide it from them.` : `Hidden from players. Click to show them ${what}.`
  return (
    <button type="button" className={`sheet-eye no-print${shown ? ' shown' : ''}`} aria-pressed={shown} title={title} aria-label={title} onClick={onToggle}>
      {shown ? '👁 Players' : '🔒 GM only'}
    </button>
  )
}

function SheetEntry({ room, entryKey, playerKey, dungeon, audience, onChange, active, onActive, isFirst, isLast }) {
  const editable = !!onChange
  const gm = audience === 'gm'
  const parts = playerParts(room)
  const hidden = !!room.player?.hidden
  // Notes opened from "Add a note" stay while still empty, so they can be typed in.
  const [opened, setOpened] = useState([])
  const [focusField, setFocusField] = useState(null)
  const focusBox = useRef(null)
  useLayoutEffect(() => {
    if (focusField && focusBox.current) {
      focusBox.current.focus()
      setFocusField(null)
    }
  }, [focusField])

  const has = (field) => !!room.notes?.[field]
  const visible = (field) => (gm ? has(field) || opened.includes(field) : has(field) && parts.includes(field))
  const fields = NOTE_FIELDS.filter(visible)
  const addable = gm && editable ? NOTE_FIELDS.filter((f) => !visible(f)) : []
  const showContents = room.contents.length > 0 && (gm || parts.includes('contents'))
  const role = room.id === dungeon.start ? 'start' : gm && room.id === dungeon.goal ? 'goal' : null
  const edit = (change) => onChange?.(change)

  const classes = ['sheet-entry', gm && hidden && 'hidden-from-players', active && 'active'].filter(Boolean).join(' ')
  return (
    <li id={entryId(room.id)} className={classes} onMouseEnter={() => onActive(room.id)} onFocus={() => onActive(room.id)}>
      <div className="sheet-entry-head">
        <span className="sheet-key-badge" aria-hidden="true">
          {entryKey}
        </span>
        {editable ? (
          <input
            className="sheet-room-name"
            value={room.label}
            aria-label={`Room ${entryKey} name`}
            placeholder="Room name"
            onChange={(e) => edit((d) => updateRoom(d, room.id, { label: e.target.value }))}
          />
        ) : (
          <h3 className="sheet-room-name">{room.label}</h3>
        )}
        {role && <span className={`tag tag-${role}`}>{role === 'start' ? 'Entrance' : ROLE_TAGS.goal}</span>}
        {gm && editable && (
          <span className="sheet-entry-tools no-print">
            <span className="sheet-player-key muted">{hidden ? 'Not on the handout' : `Handout: ${playerKey}`}</span>
            <PlayerToggle shown={!hidden} what="this room" onToggle={() => edit((d) => setPlayerHidden(d, room.id, !hidden))} />
            <button type="button" className="icon" disabled={isFirst} aria-label="Move up the list" title="Move up the list" onClick={() => edit((d) => setSheet(d, { order: movedOrder(d, room.id, -1) }))}>
              ↑
            </button>
            <button type="button" className="icon" disabled={isLast} aria-label="Move down the list" title="Move down the list" onClick={() => edit((d) => setSheet(d, { order: movedOrder(d, room.id, 1) }))}>
              ↓
            </button>
          </span>
        )}
      </div>
      {showContents && (
        <div className={`sheet-note sheet-contents${gm && !parts.includes('contents') ? ' gm-only' : ''}`}>
          <div className="sheet-note-label">
            <span>In this room</span>
            {gm && editable && !hidden && (
              <PlayerToggle shown={parts.includes('contents')} what="what's in this room" onToggle={() => edit((d) => setPlayerPart(d, room.id, 'contents', !parts.includes('contents')))} />
            )}
          </div>
          <RoomChips room={room} />
        </div>
      )}
      {fields.map((field) => {
        const shown = parts.includes(field)
        const label = NOTE_LABELS[field].label
        return (
          <div key={field} className={`sheet-note${gm && (!shown || hidden) ? ' gm-only' : ''}`}>
            <div className="sheet-note-label">
              <span>{label}</span>
              {gm && editable && !hidden && (
                <PlayerToggle shown={shown} what={`the ${label.toLowerCase()}`} onToggle={() => edit((d) => setPlayerPart(d, room.id, field, !shown))} />
              )}
            </div>
            {editable ? (
              <SheetText
                value={room.notes?.[field] ?? ''}
                label={`${label} for ${room.label}`}
                placeholder={NOTE_LABELS[field].hint}
                inputRef={focusField === field ? focusBox : undefined}
                onChange={(text) => edit((d) => setRoomNote(d, room.id, field, text))}
              />
            ) : (
              <p className="sheet-read-text">{room.notes[field]}</p>
            )}
          </div>
        )
      })}
      {addable.length > 0 && (
        <div className="sheet-add no-print">
          <span className="muted">Add:</span>
          {addable.map((field) => (
            <button
              key={field}
              type="button"
              className="link-button"
              onClick={() => {
                setOpened([...opened, field])
                setFocusField(field)
              }}
            >
              {NOTE_LABELS[field].label}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

/**
 * The notes sheet: a page with the dungeon's name, then each floor as a small
 * map with its rooms keyed 1, 2, 3 (or A, B, C) and those rooms' notes listed
 * beside the keys, in order. What's on screen is what prints.
 *
 * For the game master (`audience` 'gm') it shows every room and note, with an
 * eye on each to pick what the players' handout shows, and arrows to reorder
 * the rooms. For 'players' it's the handout itself. Given `onChange`, the
 * names and notes are edited right on the page; without it, the sheet is
 * read only, as for a handout opened from a link.
 */
export default function Sheet({ dungeon, audience, onChange }) {
  const sections = useMemo(() => sheetSections(dungeon, audience), [dungeon, audience])
  const handoutKeys = useMemo(() => (audience === 'gm' ? playerKeys(dungeon) : null), [dungeon, audience])
  const keys = useMemo(() => new Map(sections.flatMap((s) => s.entries.map((e) => [e.room.id, e.key]))), [sections])
  const [active, setActive] = useState(null)
  const gm = audience === 'gm'

  function pick(id) {
    const entry = document.getElementById(entryId(id))
    entry?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    entry?.querySelector('input, textarea')?.focus({ preventScroll: true })
    setActive(id)
  }

  return (
    <article className={`sheet-paper audience-${audience}`}>
      <header className="sheet-title">
        {onChange ? (
          <input
            className="sheet-name"
            value={dungeon.name}
            aria-label="Dungeon name"
            placeholder="Untitled Dungeon"
            onChange={(e) => onChange((d) => renameDungeon(d, e.target.value))}
          />
        ) : (
          <h1 className="sheet-name">{dungeon.name || 'Untitled Dungeon'}</h1>
        )}
        <p className="sheet-subtitle">{gm ? "Game master's notes" : 'Player handout'}</p>
      </header>
      {sections.length === 0 && (
        <p className="muted sheet-empty">{dungeon.rooms.length === 0 ? 'No rooms yet. Add some on the map.' : 'Every room is hidden from the players.'}</p>
      )}
      {sections.map((section) => (
        <section key={section.floor.id} className="sheet-floor">
          {(sections.length > 1 || dungeon.floors.length > 1) && <h2 className="sheet-floor-name">{section.floor.name}</h2>}
          <div className="sheet-floor-body">
            <SheetMap
              rooms={section.entries.map((e) => e.room)}
              edges={dungeon.edges}
              dungeon={dungeon}
              keys={keys}
              active={active}
              start={dungeon.start}
              onPick={pick}
            />
            <ol className="sheet-key">
              {section.entries.map((entry, i) => (
                <SheetEntry
                  key={entry.room.id}
                  room={entry.room}
                  entryKey={entry.key}
                  playerKey={handoutKeys?.get(entry.room.id)}
                  dungeon={dungeon}
                  audience={audience}
                  onChange={onChange}
                  active={active === entry.room.id}
                  onActive={setActive}
                  isFirst={i === 0}
                  isLast={i === section.entries.length - 1}
                />
              ))}
            </ol>
          </div>
        </section>
      ))}
    </article>
  )
}
