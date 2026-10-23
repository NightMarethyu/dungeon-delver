import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { addEdge, addRoom, updateRoom } from '../../model/edit.js'
import { belowAll, freePosition } from '../graph/layout.js'
import Icon from '../icons/Icon.jsx'
import { gateIconName, passageIconName, puzzleRooms } from '../icons/icons.js'
import RoomChips from '../icons/RoomChips.jsx'
import { GATE_LABELS, KIND_LABELS, MARK_TAGS, ROLE_TAGS } from '../labels.js'
import { floorMarks } from '../results.js'
import { useCoarsePointer } from '../useCoarsePointer.js'
import { doorlessNeighbors, floorLinks, mapConnections } from './doors.js'
import { bounds, CELL, fits, freeSpot, moveRect, resizeRect, ROOM_SIZE, sharedWall, spotBeside, withMapLayout } from './grid.js'

const HANDLES = ['nw', 'ne', 'sw', 'se']
// Sizes of the things to grab, in pixels: for a mouse, and for a finger.
const GRAB = {
  fine: { handle: 10, knob: 8, spot: 11, doorPad: 0 },
  coarse: { handle: 22, knob: 14, spot: 16, doorPad: 10 },
}
// Two taps closer together than this, in ms and pixels, are a double tap.
const DOUBLE_TAP = { time: 350, distance: 30 }
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
// Cells of empty space kept around the rooms when the view fits them.
const FIT_MARGIN = 2

// How a door is drawn: its length along the wall, and its thickness, in pixels.
const DOOR = { length: CELL * 0.8, thickness: 10 }
const BADGE_RADIUS = 11
const BADGE_ICON = 16

const clampZoom = (zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
const sameRect = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

// The view that fits `rects` (in cells) into a box of `size` pixels.
function fitView(rects, size) {
  const box = bounds(rects) ?? { x: 0, y: 0, ...ROOM_SIZE }
  const w = (box.w + 2 * FIT_MARGIN) * CELL
  const h = (box.h + 2 * FIT_MARGIN) * CELL
  const zoom = clampZoom(Math.min(size.w / w, size.h / h, 1.25))
  return {
    zoom,
    x: (box.x - FIT_MARGIN) * CELL - (size.w / zoom - w) / 2,
    y: (box.y - FIT_MARGIN) * CELL - (size.h / zoom - h) / 2,
  }
}

// The floors to show as tabs: every floor, plus any a room names that's gone,
// so no room is left without a tab.
function floorTabs(dungeon) {
  const known = new Set(dungeon.floors.map((f) => f.id))
  const missing = [...new Set(dungeon.rooms.map((r) => r.floor).filter((id) => !known.has(id)))]
  return [...dungeon.floors, ...missing.map((id) => ({ id, name: `${id} (missing)` }))]
}

// What a floor tab's dot says, for its tooltip.
const FLOOR_MARK_TITLES = { path: 'The critical path goes through here', here: 'The player is here', stuck: 'The player is stuck here' }

function MapRoom({ room, rect, role, mark, selected, invalid, hasPuzzle, links, grab, onPointerDown }) {
  const w = rect.w * CELL
  const h = rect.h * CELL
  const classes = ['map-room', selected && 'selected', role && `role-${role}`, mark && `mark-${mark}`, invalid && 'invalid'].filter(Boolean).join(' ')
  return (
    <g className={classes} transform={`translate(${rect.x * CELL} ${rect.y * CELL})`}>
      <rect className="map-room-box" width={w} height={h} rx={4} onPointerDown={(e) => onPointerDown(e, 'move')} />
      <foreignObject width={w} height={h} pointerEvents="none">
        <div className="map-room-body">
          {(role || MARK_TAGS[mark]) && (
            <div className="room-tags">
              {role && <span className={`tag tag-${role}`}>{ROLE_TAGS[role]}</span>}
              {MARK_TAGS[mark] && <span className={`tag tag-${mark}`}>{MARK_TAGS[mark]}</span>}
            </div>
          )}
          <span className="map-room-label">{room.label}</span>
          <RoomChips room={room} hasPuzzle={hasPuzzle} compact />
          {links.length > 0 && (
            <div className="map-room-links">
              {links.map((link) => (
                <button
                  key={link.edge.id}
                  type="button"
                  className={['map-floor-link', `gate-${link.edge.gate.type}`, link.mark].filter(Boolean).join(' ')}
                  title={link.title}
                  aria-label={link.title}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={link.onGo}
                >
                  <Icon name={link.icon} size={22} />
                  {link.edge.gate.type !== 'open' && <Icon name={gateIconName(link.edge.gate)} size={14} className="map-floor-link-gate" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </foreignObject>
      {selected &&
        HANDLES.map((handle) => (
          <rect
            key={handle}
            className={`map-handle handle-${handle}`}
            x={(handle.includes('w') ? 0 : w) - grab.handle / 2}
            y={(handle.includes('n') ? 0 : h) - grab.handle / 2}
            width={grab.handle}
            height={grab.handle}
            onPointerDown={(e) => onPointerDown(e, handle)}
          />
        ))}
    </g>
  )
}

// Where a room's center is, in pixels.
const centerOf = (rect) => ({ x: (rect.x + rect.w / 2) * CELL, y: (rect.y + rect.h / 2) * CELL })
const inside = (rect, point) =>
  point.x >= rect.x * CELL && point.x <= (rect.x + rect.w) * CELL && point.y >= rect.y * CELL && point.y <= (rect.y + rect.h) * CELL

function edgeTitle(edge, names) {
  const what = [edge.kind !== 'door' && KIND_LABELS[edge.kind], edge.gate.type !== 'open' && GATE_LABELS[edge.gate.type]].filter(Boolean)
  const between = edge.oneWay ? `${names(edge.from)} → ${names(edge.to)}` : `${names(edge.from)} ↔ ${names(edge.to)}`
  return [what.join(', ') || 'Door', between].join(': ')
}

// An arrow at `at` (pixels) pointing along `dir`, for one-way connections.
function Arrow({ at, dir }) {
  const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI
  return <path className="map-door-arrow" d="M -5 -6 L 6 0 L -5 6 Z" transform={`translate(${at.x} ${at.y}) rotate(${angle})`} />
}

// The lock on a door, as its icon in a circle. Open doors have none.
function GateBadge({ at, gate }) {
  if (gate.type === 'open') return null
  return (
    <g className="map-door-badge" transform={`translate(${at.x} ${at.y})`}>
      <circle r={BADGE_RADIUS} />
      <Icon name={gateIconName(gate)} size={BADGE_ICON} x={-BADGE_ICON / 2} y={-BADGE_ICON / 2} />
    </g>
  )
}

/**
 * One connection on the map: a door on the wall two rooms share, or a dashed
 * line between rooms that are connected but not yet side by side.
 */
function MapConnection({ connection, rects, mark, selected, title, grab, onPointerDown }) {
  const { edge, door, line } = connection
  const classes = ['map-connection', `gate-${edge.gate.type}`, `kind-${edge.kind}`, mark, selected && 'selected', line && 'apart']
    .filter(Boolean)
    .join(' ')
  const to = centerOf(rects.get(edge.to))
  if (door) {
    const at = { x: door.x * CELL, y: door.y * CELL }
    const w = door.vertical ? DOOR.thickness : DOOR.length
    const h = door.vertical ? DOOR.length : DOOR.thickness
    // Arrows point into the room the door leads to.
    const dir = door.vertical ? { x: Math.sign(to.x - at.x), y: 0 } : { x: 0, y: Math.sign(to.y - at.y) }
    return (
      <g className={classes} onPointerDown={onPointerDown}>
        <title>{title}</title>
        {grab.doorPad > 0 && (
          <rect className="map-door-hit" x={at.x - w / 2 - grab.doorPad} y={at.y - h / 2 - grab.doorPad} width={w + 2 * grab.doorPad} height={h + 2 * grab.doorPad} />
        )}
        <rect className="map-door" x={at.x - w / 2} y={at.y - h / 2} width={w} height={h} rx={3} />
        {edge.oneWay && <Arrow at={{ x: at.x + dir.x * CELL * 0.45, y: at.y + dir.y * CELL * 0.45 }} dir={dir} />}
        <GateBadge at={at} gate={edge.gate} />
      </g>
    )
  }
  const a = { x: line.x1 * CELL, y: line.y1 * CELL }
  const b = { x: line.x2 * CELL, y: line.y2 * CELL }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  return (
    <g className={classes} onPointerDown={onPointerDown}>
      <title>{`${title} (not side by side yet)`}</title>
      <line className="map-link-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <line className="map-link" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      {edge.oneWay && <Arrow at={mid} dir={{ x: b.x - a.x, y: b.y - a.y }} />}
      <GateBadge at={edge.oneWay ? { x: (mid.x + b.x) / 2, y: (mid.y + b.y) / 2 } : mid} gate={edge.gate} />
    </g>
  )
}

// A "+" on a shared wall with no door in it yet. Clicking it adds the door.
function DoorSpot({ a, b, suggested, title, radius, onAdd }) {
  const wall = sharedWall(a, b)
  if (!wall) return null
  const at = { x: ((wall.x1 + wall.x2) / 2) * CELL, y: ((wall.y1 + wall.y2) / 2) * CELL }
  return (
    <g
      className={`map-door-spot${suggested ? ' suggested' : ''}`}
      transform={`translate(${at.x} ${at.y})`}
      onPointerDown={(e) => {
        e.stopPropagation()
        onAdd()
      }}
    >
      <title>{title}</title>
      <circle r={radius} />
      <path d="M -4.5 0 H 4.5 M 0 -4.5 V 4.5" />
    </g>
  )
}

/**
 * The map view: one floor at a time, rooms as rectangles on a snap grid.
 * Drag a room to move it, drag a corner of the selected room to resize it,
 * drag empty space to pan, and scroll to zoom. On a touch screen, pinch to
 * zoom and double-tap to add a room, and the things to grab are drawn bigger.
 *
 * Only the dungeon's own connections are drawn. One between rooms on this
 * floor is a door on the wall they share, or a dashed line until they're moved
 * side by side. Drag the arrow in the selected room's corner onto another room to connect
 * them, or click a "+" on a shared wall. When an edit leaves a room sharing a
 * wall with another it has no door to, the map offers to add one.
 *
 * Rooms with no rect are placed automatically (grid.js). The placement is only
 * shown until something on the map changes; then it's saved with that change,
 * so opening the map alone never changes a dungeon.
 *
 * The solver's highlights are drawn on the rooms, doors, and stairs, and each
 * floor's tab gets a dot when the critical path (or, in playback, the player)
 * is on it. Playback switches to the floor where each step happens.
 *
 * Takes the same props as GraphEditor.
 */
export default function MapEditor({ dungeon, onChange, selection, onSelect, highlights, commands }) {
  const svg = useRef(null)
  const grab = GRAB[useCoarsePointer() ? 'coarse' : 'fine']
  const laidOut = useMemo(() => withMapLayout(dungeon), [dungeon])
  const tabs = floorTabs(dungeon)

  const selectedRoom = selection?.kind === 'room' ? dungeon.rooms.find((r) => r.id === selection.id) : null
  const [floorChoice, setFloorChoice] = useState(selectedRoom?.floor ?? null)
  // Follow the selected room when it's picked, or moved, onto another floor.
  const selectedFloor = selectedRoom?.floor
  const [followed, setFollowed] = useState(selectedFloor)
  if (selectedFloor !== followed) {
    setFollowed(selectedFloor)
    if (selectedFloor) setFloorChoice(selectedFloor)
  }
  // Follow softlock playback to the floor each step happens on.
  const [followedStep, setFollowedStep] = useState(null)
  if (highlights.focus && highlights !== followedStep) {
    setFollowedStep(highlights)
    const focusFloor = dungeon.rooms.find((r) => r.id === highlights.focus)?.floor
    if (focusFloor) setFloorChoice(focusFloor)
  }
  // Until a floor is picked, show the one the player starts on.
  const startFloor = dungeon.rooms.find((r) => r.id === dungeon.start)?.floor
  const floor = [floorChoice, startFloor].find((id) => tabs.some((f) => f.id === id)) ?? tabs[0]?.id

  const rooms = laidOut.rooms.filter((r) => r.floor === floor)
  const rects = new Map(rooms.map((r) => [r.id, r.rect]))
  const names = (id) => dungeon.rooms.find((r) => r.id === id)?.label ?? id
  const selectedEdge = selection?.kind === 'edge' ? dungeon.edges.find((e) => e.id === selection.id) : null
  // An edit made on the map saves the automatic placement along with it.
  const edit = useCallback((change) => onChange((d) => change(withMapLayout(d))), [onChange])

  // The canvas size in pixels, and the view onto it: the top-left corner in
  // pixels at zoom 1, and the zoom.
  const [size, setSize] = useState(null)
  const [view, setView] = useState(null)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: Math.max(1, width), h: Math.max(1, height) })
    })
    observer.observe(svg.current)
    return () => observer.disconnect()
  }, [])

  // Fit the floor in view when the map opens and when the floor changes.
  const fittedFloor = useRef(undefined)
  useEffect(() => {
    if (!size || fittedFloor.current === floor) return
    fittedFloor.current = floor
    setView(fitView(rooms.map((r) => r.rect), size))
  }, [size, floor, rooms])

  const toCanvas = useCallback(
    (event) => {
      const box = svg.current.getBoundingClientRect()
      return { x: view.x + (event.clientX - box.left) / view.zoom, y: view.y + (event.clientY - box.top) / view.zoom }
    },
    [view],
  )

  const zoomAt = useCallback((factor, point) => {
    setView((v) => {
      const zoom = clampZoom(v.zoom * factor)
      // Keep the point under `point` (in screen pixels within the canvas) in place.
      return { zoom, x: v.x + point.x / v.zoom - point.x / zoom, y: v.y + point.y / v.zoom - point.y / zoom }
    })
  }, [setView])

  // Wheel zoom needs a listener that can stop the page scrolling.
  useEffect(() => {
    const node = svg.current
    function onWheel(event) {
      event.preventDefault()
      const box = node.getBoundingClientRect()
      zoomAt(Math.exp(-event.deltaY * 0.0015), { x: event.clientX - box.left, y: event.clientY - box.top })
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // Fingers on the map, by pointer id, and the pinch two of them are making:
  // where they started, and the view then.
  const touches = useRef(new Map())
  const pinch = useRef(null)
  // The last tap on empty space, to spot a double tap, and when the map was
  // last touched, so a double tap isn't also taken as a double click.
  const lastTap = useRef(null)
  const touchedAt = useRef(-Infinity)

  function onTouchStart(event) {
    if (event.pointerType !== 'touch') return
    touchedAt.current = event.timeStamp
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (touches.current.size !== 2 || !view) return
    // A second finger turns whatever the first one started into a pinch.
    event.stopPropagation()
    setDrag(null)
    const [a, b] = [...touches.current.values()]
    pinch.current = { a, b, view }
  }

  useEffect(() => {
    function onMove(event) {
      if (!touches.current.has(event.pointerId)) return
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      const start = pinch.current
      if (!start || touches.current.size < 2) return
      const [a, b] = [...touches.current.values()]
      const box = svg.current.getBoundingClientRect()
      const zoom = clampZoom((start.view.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, Math.hypot(start.a.x - start.b.x, start.a.y - start.b.y)))
      // Keep the point that was between the fingers between them.
      const from = { x: (start.a.x + start.b.x) / 2 - box.left, y: (start.a.y + start.b.y) / 2 - box.top }
      const to = { x: (a.x + b.x) / 2 - box.left, y: (a.y + b.y) / 2 - box.top }
      const anchor = { x: start.view.x + from.x / start.view.zoom, y: start.view.y + from.y / start.view.zoom }
      setView({ zoom, x: anchor.x - to.x / zoom, y: anchor.y - to.y / zoom })
    }
    function onEnd(event) {
      touches.current.delete(event.pointerId)
      if (touches.current.size < 2) pinch.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
    }
  }, [])

  // The rects of this floor's rooms, other than room `id`.
  const others = (id) => rooms.filter((r) => r.id !== id).map((r) => r.rect)

  // The drag in progress: moving or resizing a room (with its rect so far),
  // connecting it to another (with the pointer so far), or panning.
  const [drag, setDrag] = useState(null)

  // Doors the map is offering to add, after an edit left room `id` sharing a
  // wall with `others` and no door between them: { id, others } or null.
  const [offer, setOffer] = useState(null)
  // Offer only doors that still make sense, after whatever has changed since.
  const offered = offer && rects.has(offer.id) ? offer.others.filter((o) => doorlessNeighbors(rooms, dungeon.edges, offer.id).includes(o)) : []

  // After room `id` gets `rect`, offer doors to the rooms it newly shares a wall with.
  function offerDoors(id, nextRooms) {
    const before = new Set(doorlessNeighbors(rooms, dungeon.edges, id))
    const others = doorlessNeighbors(nextRooms, dungeon.edges, id).filter((o) => !before.has(o))
    setOffer(others.length > 0 ? { id, others } : null)
  }

  function connect(a, b) {
    const { dungeon: next, id } = addEdge(withMapLayout(dungeon), a, b)
    if (!id) return
    onChange(() => next)
    onSelect({ kind: 'edge', id })
  }

  function startConnect(event, room) {
    if (event.button !== 0) return
    event.stopPropagation()
    setDrag({ mode: 'connect', id: room.id, point: toCanvas(event) })
  }

  function selectEdge(event, edge) {
    if (event.button !== 0) return
    event.stopPropagation()
    svg.current.focus({ preventScroll: true })
    onSelect({ kind: 'edge', id: edge.id })
  }

  function startRoomDrag(event, room, mode) {
    if (event.button !== 0) return
    event.stopPropagation()
    svg.current.focus({ preventScroll: true })
    onSelect({ kind: 'room', id: room.id })
    setDrag({ mode, id: room.id, origin: toCanvas(event), rect: room.rect, draft: room.rect })
  }

  function startPan(event) {
    if (event.button !== 0) return
    if (event.pointerType === 'touch') {
      const tap = { time: event.timeStamp, x: event.clientX, y: event.clientY }
      const last = lastTap.current
      if (last && tap.time - last.time < DOUBLE_TAP.time && Math.hypot(tap.x - last.x, tap.y - last.y) < DOUBLE_TAP.distance) {
        lastTap.current = null
        addRoomAt(toCanvas(event))
        return
      }
      lastTap.current = tap
    }
    setDrag({ mode: 'pan', client: { x: event.clientX, y: event.clientY }, view, moved: false })
  }

  function onPointerMove(event) {
    if (!drag) return
    if (drag.mode === 'pan') {
      const dx = event.clientX - drag.client.x
      const dy = event.clientY - drag.client.y
      setView({ ...drag.view, x: drag.view.x - dx / view.zoom, y: drag.view.y - dy / view.zoom })
      if (!drag.moved && Math.hypot(dx, dy) > 3) setDrag({ ...drag, moved: true })
      return
    }
    const point = toCanvas(event)
    if (drag.mode === 'connect') {
      setDrag({ ...drag, point })
      return
    }
    const dx = Math.round((point.x - drag.origin.x) / CELL)
    const dy = Math.round((point.y - drag.origin.y) / CELL)
    const draft = drag.mode === 'move' ? moveRect(drag.rect, dx, dy) : resizeRect(drag.rect, drag.mode, dx, dy)
    if (!sameRect(draft, drag.draft)) setDrag({ ...drag, draft })
  }

  function onPointerUp() {
    if (!drag) return
    setDrag(null)
    if (drag.mode === 'pan') {
      if (!drag.moved) onSelect(null)
      return
    }
    if (drag.mode === 'connect') {
      const target = rooms.find((r) => r.id !== drag.id && inside(r.rect, drag.point))
      if (target) connect(drag.id, target.id)
      return
    }
    // A room can't be dropped on top of another; it goes back where it was.
    if (!sameRect(drag.draft, drag.rect) && fits(drag.draft, others(drag.id))) {
      edit((d) => updateRoom(d, drag.id, { rect: drag.draft }))
      offerDoors(drag.id, rooms.map((r) => (r.id === drag.id ? { ...r, rect: drag.draft } : r)))
    }
  }

  // Follow the pointer anywhere on the page until the drag ends.
  useEffect(() => {
    if (!drag) return
    const cancel = () => setDrag(null)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', cancel)
    }
  })

  function addRoomWithRect(rect) {
    // Give it a spot in the graph too, so it doesn't land on another room there.
    const graphPos = freePosition(belowAll(dungeon.rooms), dungeon.rooms)
    const { dungeon: next, id } = addRoom(laidOut, { floor, rect, graphPos })
    onChange(() => next)
    onSelect({ kind: 'room', id })
    offerDoors(id, next.rooms.filter((r) => r.floor === floor))
  }

  function addRoomAt(point) {
    const want = { x: Math.round(point.x / CELL - ROOM_SIZE.w / 2), y: Math.round(point.y / CELL - ROOM_SIZE.h / 2) }
    addRoomWithRect({ ...freeSpot(want, ROOM_SIZE, others(null), 0), ...ROOM_SIZE })
  }

  // A new room goes beside the selected room, if there's one on this floor,
  // and otherwise in the middle of the view.
  function addRoomInView() {
    const beside = rects.get(selectedRoom?.id)
    const spot = beside && spotBeside(ROOM_SIZE, [beside], [], others(null))
    if (spot) addRoomWithRect({ ...spot, ...ROOM_SIZE })
    else addRoomAt({ x: view.x + size.w / view.zoom / 2, y: view.y + size.h / view.zoom / 2 })
  }

  // Moves room `id` a cell, or with `resize`, grows or shrinks it from its
  // bottom-right corner. A room can't go on top of another.
  function nudge(id, dx, dy, resize) {
    const rect = rects.get(id)
    if (!rect) return false
    const next = resize ? resizeRect(rect, 'se', dx, dy) : moveRect(rect, dx, dy)
    if (!sameRect(next, rect) && fits(next, others(id))) {
      edit((d) => updateRoom(d, id, { rect: next }))
      offerDoors(id, rooms.map((r) => (r.id === id ? { ...r, rect: next } : r)))
    }
    return true
  }

  const center = () => ({ x: size.w / 2, y: size.h / 2 })
  useImperativeHandle(commands, () => ({
    addRoom: () => view && floor && addRoomInView(),
    nudge,
    floor(step) {
      const next = tabs[tabs.findIndex((f) => f.id === floor) + step]
      if (next) setFloorChoice(next.id)
    },
    zoomIn: () => view && zoomAt(1.25, center()),
    zoomOut: () => view && zoomAt(0.8, center()),
    fit: () => view && setView(fitView(rooms.map((r) => r.rect), size)),
  }))

  const connections = mapConnections(rooms, dungeon.edges)
  const puzzles = puzzleRooms(dungeon)
  // Connections to other floors, shown as stairs or holes inside the room.
  // Clicking one goes to the room at the other end.
  const floorName = (id) => tabs.find((f) => f.id === id)?.name ?? id
  const links = new Map(
    [...floorLinks(dungeon, rooms)].map(([id, list]) => [
      id,
      list.map(({ edge, other }) => ({
        edge,
        icon: passageIconName(dungeon, edge),
        title: `${edgeTitle(edge, names)}. Go to ${names(other)} on ${floorName(dungeon.rooms.find((r) => r.id === other).floor)}.`,
        mark: highlights.edges.get(edge.id),
        onGo: () => onSelect({ kind: 'room', id: other }),
      })),
    ]),
  )
  // While a room is dragged, its doors go with it.
  const shown = drag?.draft ? rooms.map((r) => (r.id === drag.id ? { ...r, rect: drag.draft } : r)) : rooms
  const shownConnections = shown === rooms ? connections : mapConnections(shown, dungeon.edges)
  const shownRects = new Map(shown.map((r) => [r.id, r.rect]))

  // When the selected connection is a dashed line, the room to move so the
  // two sit side by side: whichever has fewer other doors on this floor to
  // keep, and the spot beside the other room that keeps the most of them.
  const apart = connections.find((c) => c.line && c.edge.id === selectedEdge?.id)
  function sideBySide() {
    const doorCount = (id) => connections.filter((c) => c.door && (c.edge.from === id || c.edge.to === id)).length
    const [mover, anchor] = doorCount(apart.edge.from) < doorCount(apart.edge.to) ? [apart.edge.from, apart.edge.to] : [apart.edge.to, apart.edge.from]
    const rect = rects.get(mover)
    const connected = connections
      .filter((c) => c.edge.from === mover || c.edge.to === mover)
      .map((c) => rects.get(c.edge.from === mover ? c.edge.to : c.edge.from))
    const taken = rooms.filter((r) => r.id !== mover).map((r) => r.rect)
    const spot = spotBeside({ w: rect.w, h: rect.h }, [rects.get(anchor)], connected, taken)
    return spot && { mover, anchor, rect: { ...rect, ...spot } }
  }
  const fix = apart ? sideBySide() : null

  // The "+" spots to show: on the selected room's doorless shared walls, and
  // on the walls the map is offering doors in.
  const spots = []
  if (selectedRoom && rects.has(selectedRoom.id)) {
    for (const o of doorlessNeighbors(rooms, dungeon.edges, selectedRoom.id)) spots.push([selectedRoom.id, o])
  }
  for (const o of offered) if (!spots.some(([a, b]) => a === offer.id && b === o)) spots.push([offer.id, o])

  const tabMarks = floorMarks(dungeon, highlights.rooms)

  return (
    <div className="map-view">
      <div className="floor-tabs" role="tablist" aria-label="Floors">
        {tabs.map((f) => {
          const count = dungeon.rooms.filter((r) => r.floor === f.id).length
          const mark = tabMarks.get(f.id)
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={f.id === floor}
              className={f.id === floor ? 'active' : undefined}
              onClick={() => setFloorChoice(f.id)}
            >
              {mark && <span className={`floor-mark floor-mark-${mark}`} title={FLOOR_MARK_TITLES[mark]} aria-label={FLOOR_MARK_TITLES[mark]} />}
              {f.name} <span className="floor-count">{count}</span>
            </button>
          )
        })}
      </div>
      <div className="map-canvas">
        <svg
          ref={svg}
          className={drag?.mode === 'pan' && drag.moved ? 'panning' : undefined}
          viewBox={view && size ? `${view.x} ${view.y} ${size.w / view.zoom} ${size.h / view.zoom}` : '0 0 1 1'}
          tabIndex={0}
          aria-label="Dungeon map"
          onPointerDownCapture={onTouchStart}
        >
          <defs>
            <pattern id="map-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
              <path className="map-grid-line" d={`M ${CELL} 0 L 0 0 0 ${CELL}`} />
            </pattern>
          </defs>
          {view && size && (
            <>
              <rect
                className="map-background"
                x={view.x}
                y={view.y}
                width={size.w / view.zoom}
                height={size.h / view.zoom}
                fill="url(#map-grid)"
                onPointerDown={startPan}
                onDoubleClick={(e) => e.timeStamp - touchedAt.current > 1000 && addRoomAt(toCanvas(e))}
              />
              {rooms.map((room) => {
                const dragging = drag?.id === room.id && drag.mode !== 'connect'
                const rect = dragging ? drag.draft : room.rect
                return (
                  <MapRoom
                    key={room.id}
                    room={room}
                    rect={rect}
                    role={room.id === dungeon.start ? 'start' : room.id === dungeon.goal ? 'goal' : null}
                    mark={highlights.rooms.get(room.id) ?? null}
                    selected={selectedRoom?.id === room.id}
                    invalid={dragging && !fits(rect, others(room.id))}
                    hasPuzzle={puzzles.has(room.id)}
                    links={links.get(room.id) ?? []}
                    grab={grab}
                    onPointerDown={(e, mode) => startRoomDrag(e, room, mode)}
                  />
                )
              })}
              {shownConnections.map((c) => (
                  <MapConnection
                    key={c.edge.id}
                    connection={c}
                    rects={shownRects}
                    mark={highlights.edges.get(c.edge.id)}
                    selected={selectedEdge?.id === c.edge.id}
                    title={edgeTitle(c.edge, names)}
                    grab={grab}
                    onPointerDown={(e) => selectEdge(e, c.edge)}
                  />
                ))}
              {!drag &&
                spots.map(([a, b]) => (
                  <DoorSpot
                    key={`${a}-${b}`}
                    a={rects.get(a)}
                    b={rects.get(b)}
                    suggested={offered.includes(b) && offer.id === a}
                    title={`Add a door between ${names(a)} and ${names(b)}`}
                    radius={grab.spot}
                    onAdd={() => connect(a, b)}
                  />
                ))}
              {selectedRoom && rects.has(selectedRoom.id) && !drag && (
                <g
                  className="map-connect-knob"
                  transform={`translate(${(rects.get(selectedRoom.id).x + rects.get(selectedRoom.id).w) * CELL - 7 - grab.knob} ${rects.get(selectedRoom.id).y * CELL + 7 + grab.knob})`}
                  onPointerDown={(e) => startConnect(e, selectedRoom)}
                >
                  <title>Drag onto another room to connect them</title>
                  <circle r={grab.knob} />
                  <path d="M -3.5 0 H 3.5 M 1 -3 L 4 0 L 1 3" />
                </g>
              )}
              {drag?.mode === 'connect' && (
                <line
                  className="map-connect-line"
                  x1={centerOf(rects.get(drag.id)).x}
                  y1={centerOf(rects.get(drag.id)).y}
                  x2={drag.point.x}
                  y2={drag.point.y}
                />
              )}
            </>
          )}
        </svg>
        <div className="map-toolbar map-toolbar-left">
          <button type="button" className="primary" onClick={addRoomInView} disabled={!view || !floor}>
            + Add room
          </button>
        </div>
        <div className="map-toolbar map-toolbar-right">
          <button type="button" className="icon" onClick={() => zoomAt(1.25, center())} disabled={!view} aria-label="Zoom in" title="Zoom in">
            +
          </button>
          <button type="button" className="icon" onClick={() => zoomAt(0.8, center())} disabled={!view} aria-label="Zoom out" title="Zoom out">
            −
          </button>
          <button
            type="button"
            onClick={() => setView(fitView(rooms.map((r) => r.rect), size))}
            disabled={!view}
            title="Fit this floor in view"
          >
            Fit
          </button>
        </div>
        {(offered.length > 0 || apart) && (
          <div className="map-notices">
            {offered.map((o) => (
              <p key={o} className="map-notice">
                <span>
                  <strong>{names(offer.id)}</strong> now shares a wall with <strong>{names(o)}</strong>. Add a door between them?
                </span>
                <button type="button" className="primary" onClick={() => connect(offer.id, o)}>
                  Add door
                </button>
                <button type="button" onClick={() => setOffer({ ...offer, others: offer.others.filter((x) => x !== o) })}>
                  No door
                </button>
              </p>
            ))}
            {apart && (
              <p className="map-notice">
                <span>
                  <strong>{names(apart.edge.from)}</strong> and <strong>{names(apart.edge.to)}</strong> are connected, but don&apos;t share a wall
                  for the door yet.
                </span>
                {fix && (
                  <button type="button" className="primary" onClick={() => edit((d) => updateRoom(d, fix.mover, { rect: fix.rect }))}>
                    Move {names(fix.mover)} next to {names(fix.anchor)}
                  </button>
                )}
              </p>
            )}
          </div>
        )}
        {view && rooms.length === 0 && (
          <p className="canvas-hint map-hint">
            {dungeon.rooms.length === 0 ? 'Add a room, or double-click the grid, to start your dungeon.' : 'No rooms on this floor yet. Double-click the grid to add one.'}
          </p>
        )}
      </div>
    </div>
  )
}
