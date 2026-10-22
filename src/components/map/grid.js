// Geometry for the map view. Pure, so it can be tested without the DOM.
// Room rects are in grid cells; CELL is how many pixels a cell is drawn at.

export const CELL = 32
export const ROOM_SIZE = { w: 4, h: 3 }
// Rooms placed automatically keep at least this many cells apart, so they
// don't share a wall by accident.
const GAP = 1
// The graph editor's grid spacing in pixels (see graph/layout.js), mapped to
// one room plus a gap, so a room's place on the map starts out roughly where
// it sits in the graph.
const GRAPH_STEP = { x: 220, y: 140 }
const MAP_STEP = { x: ROOM_SIZE.w + GAP, y: ROOM_SIZE.h + GAP }
const COLUMNS = 4

export const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const grow = (r, by) => ({ x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by })

export const isValidRect = (r) => !!r && ['x', 'y', 'w', 'h'].every((k) => Number.isInteger(r[k])) && r.w > 0 && r.h > 0

// Whether `rect` can go on a floor without overlapping any of `others`.
export const fits = (rect, others) => !others.some((o) => overlaps(rect, o))

/**
 * The nearest top-left corner to `want` where a room of `size` sits clear of
 * every rect in `taken`, with `gap` cells to spare. Searches outward from
 * `want` in rings, closest first.
 */
export function freeSpot(want, size, taken, gap = GAP) {
  const clear = (x, y) => !taken.some((t) => overlaps(grow(t, gap), { x, y, ...size }))
  for (let ring = 0; ; ring++) {
    const ringSpots = []
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === ring) ringSpots.push({ dx, dy })
      }
    }
    ringSpots.sort((a, b) => a.dx ** 2 + a.dy ** 2 - (b.dx ** 2 + b.dy ** 2) || a.dy - b.dy || a.dx - b.dx)
    for (const { dx, dy } of ringSpots) {
      if (clear(want.x + dx, want.y + dy)) return { x: want.x + dx, y: want.y + dy }
    }
  }
}

// Where a room with no rect would like to go: under its graph position if it
// has one, otherwise the nth slot of a grid.
function preferredSpot(room, index) {
  if (room.graphPos) {
    return {
      x: Math.round((room.graphPos.x / GRAPH_STEP.x) * MAP_STEP.x),
      y: Math.round((room.graphPos.y / GRAPH_STEP.y) * MAP_STEP.y),
    }
  }
  return { x: (index % COLUMNS) * MAP_STEP.x, y: Math.floor(index / COLUMNS) * MAP_STEP.y }
}

/**
 * Gives every room without a usable rect one, on its own floor, clear of the
 * rooms already placed there. Returns the dungeon unchanged when nothing is
 * missing. Rooms that already have a rect never move.
 */
export function withMapLayout(dungeon) {
  if (dungeon.rooms.every((r) => isValidRect(r.rect))) return dungeon
  const taken = new Map()
  for (const room of dungeon.rooms) {
    if (!taken.has(room.floor)) taken.set(room.floor, [])
    if (isValidRect(room.rect)) taken.get(room.floor).push(room.rect)
  }
  const seen = new Map()
  const rooms = dungeon.rooms.map((room) => {
    const index = seen.get(room.floor) ?? 0
    seen.set(room.floor, index + 1)
    if (isValidRect(room.rect)) return room
    const onFloor = taken.get(room.floor)
    const rect = { ...freeSpot(preferredSpot(room, index), ROOM_SIZE, onFloor), ...ROOM_SIZE }
    onFloor.push(rect)
    return { ...room, rect }
  })
  return { ...dungeon, rooms }
}

/** `rect` moved by whole cells. */
export const moveRect = (rect, dx, dy) => ({ ...rect, x: rect.x + dx, y: rect.y + dy })

/**
 * `rect` resized by dragging one corner (`handle` is 'nw', 'ne', 'sw', or
 * 'se') by whole cells. The opposite corner stays put, and the room never
 * shrinks below one cell.
 */
export function resizeRect(rect, handle, dx, dy) {
  let { x, y, w, h } = rect
  if (handle.includes('w')) {
    const shift = Math.min(dx, w - 1)
    x += shift
    w -= shift
  } else {
    w = Math.max(1, w + dx)
  }
  if (handle.includes('n')) {
    const shift = Math.min(dy, h - 1)
    y += shift
    h -= shift
  } else {
    h = Math.max(1, h + dy)
  }
  return { x, y, w, h }
}

/** The smallest rect around all of `rects`, or null when there are none. */
export function bounds(rects) {
  if (rects.length === 0) return null
  const x = Math.min(...rects.map((r) => r.x))
  const y = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.w))
  const bottom = Math.max(...rects.map((r) => r.y + r.h))
  return { x, y, w: right - x, h: bottom - y }
}
