import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addRoom, removeRoom, updateRoom } from '../../model/edit.js'
import { belowAll, freePosition } from '../graph/layout.js'
import { thingText } from '../labels.js'
import { bounds, CELL, fits, freeSpot, moveRect, resizeRect, ROOM_SIZE, withMapLayout } from './grid.js'

const HANDLES = ['nw', 'ne', 'sw', 'se']
const HANDLE_SIZE = 10
const ROLE_TAGS = { start: '▶ Start', goal: '★ Goal' }
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
// Cells of empty space kept around the rooms when the view fits them.
const FIT_MARGIN = 2

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

function MapRoom({ room, rect, role, selected, invalid, onPointerDown }) {
  const w = rect.w * CELL
  const h = rect.h * CELL
  const classes = ['map-room', selected && 'selected', role && `role-${role}`, invalid && 'invalid'].filter(Boolean).join(' ')
  return (
    <g className={classes} transform={`translate(${rect.x * CELL} ${rect.y * CELL})`}>
      <rect className="map-room-box" width={w} height={h} rx={4} onPointerDown={(e) => onPointerDown(e, 'move')} />
      <foreignObject width={w} height={h} pointerEvents="none">
        <div className="map-room-body">
          {role && <span className={`tag tag-${role}`}>{ROLE_TAGS[role]}</span>}
          <span className="map-room-label">{room.label}</span>
          {room.contents.length > 0 && (
            <ul className="room-contents">
              {room.contents.map((c, i) => (
                <li key={i} className={`chip chip-${c.type}`}>{thingText(c)}</li>
              ))}
            </ul>
          )}
        </div>
      </foreignObject>
      {selected &&
        HANDLES.map((handle) => (
          <rect
            key={handle}
            className={`map-handle handle-${handle}`}
            x={(handle.includes('w') ? 0 : w) - HANDLE_SIZE / 2}
            y={(handle.includes('n') ? 0 : h) - HANDLE_SIZE / 2}
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            onPointerDown={(e) => onPointerDown(e, handle)}
          />
        ))}
    </g>
  )
}

/**
 * The map view: one floor at a time, rooms as rectangles on a snap grid.
 * Drag a room to move it, drag a corner of the selected room to resize it,
 * drag empty space to pan, and scroll to zoom.
 *
 * Rooms with no rect are placed automatically (grid.js). The placement is only
 * shown until something on the map changes; then it's saved with that change,
 * so opening the map alone never changes a dungeon.
 *
 * Takes the same props as GraphEditor.
 */
export default function MapEditor({ dungeon, onChange, selection, onSelect }) {
  const svg = useRef(null)
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
  const floor = tabs.some((f) => f.id === floorChoice) ? floorChoice : tabs[0]?.id

  const rooms = laidOut.rooms.filter((r) => r.floor === floor)
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

  // The rects of this floor's rooms, other than room `id`.
  const others = (id) => rooms.filter((r) => r.id !== id).map((r) => r.rect)

  // The drag in progress: moving or resizing a room (with its rect so far), or panning.
  const [drag, setDrag] = useState(null)

  function startRoomDrag(event, room, mode) {
    if (event.button !== 0) return
    event.stopPropagation()
    svg.current.focus({ preventScroll: true })
    onSelect({ kind: 'room', id: room.id })
    setDrag({ mode, id: room.id, origin: toCanvas(event), rect: room.rect, draft: room.rect })
  }

  function startPan(event) {
    if (event.button !== 0) return
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
    // A room can't be dropped on top of another; it goes back where it was.
    if (!sameRect(drag.draft, drag.rect) && fits(drag.draft, others(drag.id))) {
      edit((d) => updateRoom(d, drag.id, { rect: drag.draft }))
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

  function addRoomAt(point) {
    const want = { x: Math.round(point.x / CELL - ROOM_SIZE.w / 2), y: Math.round(point.y / CELL - ROOM_SIZE.h / 2) }
    const rect = { ...freeSpot(want, ROOM_SIZE, others(null), 0), ...ROOM_SIZE }
    // Give it a spot in the graph too, so it doesn't land on another room there.
    const graphPos = freePosition(belowAll(dungeon.rooms), dungeon.rooms)
    const { dungeon: next, id } = addRoom(laidOut, { floor, rect, graphPos })
    onChange(() => next)
    onSelect({ kind: 'room', id })
  }

  function addRoomInView() {
    addRoomAt({ x: view.x + size.w / view.zoom / 2, y: view.y + size.h / view.zoom / 2 })
  }

  function onKeyDown(event) {
    if (!selectedRoom) return
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      onChange((d) => removeRoom(d, selectedRoom.id))
      onSelect(null)
    } else if (event.key === 'Escape') {
      onSelect(null)
    }
  }

  const center = () => ({ x: size.w / 2, y: size.h / 2 })

  return (
    <div className="map-view">
      <div className="floor-tabs" role="tablist" aria-label="Floors">
        {tabs.map((f) => {
          const count = dungeon.rooms.filter((r) => r.floor === f.id).length
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={f.id === floor}
              className={f.id === floor ? 'active' : undefined}
              onClick={() => setFloorChoice(f.id)}
            >
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
          onKeyDown={onKeyDown}
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
                onDoubleClick={(e) => addRoomAt(toCanvas(e))}
              />
              {rooms.map((room) => {
                const dragging = drag?.id === room.id
                const rect = dragging ? drag.draft : room.rect
                return (
                  <MapRoom
                    key={room.id}
                    room={room}
                    rect={rect}
                    role={room.id === dungeon.start ? 'start' : room.id === dungeon.goal ? 'goal' : null}
                    selected={selectedRoom?.id === room.id}
                    invalid={dragging && !fits(rect, others(room.id))}
                    onPointerDown={(e, mode) => startRoomDrag(e, room, mode)}
                  />
                )
              })}
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
        {view && rooms.length === 0 && (
          <p className="canvas-hint map-hint">
            {dungeon.rooms.length === 0 ? 'Add a room, or double-click the grid, to start your dungeon.' : 'No rooms on this floor yet. Double-click the grid to add one.'}
          </p>
        )}
      </div>
    </div>
  )
}
