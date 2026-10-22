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
 * The stretch of wall that rects `a` and `b` share, or null when they don't
 * share at least one cell of wall. Rects that only meet at a corner don't.
 * @returns {{ x1: number, y1: number, x2: number, y2: number, side: 'left' | 'right' | 'top' | 'bottom' } | null}
 *   in cells; `side` is the side of `a` the wall is on.
 */
export function sharedWall(a, b) {
  const vertical = (x, side) => {
    const y1 = Math.max(a.y, b.y)
    const y2 = Math.min(a.y + a.h, b.y + b.h)
    return y2 - y1 >= 1 ? { x1: x, y1, x2: x, y2, side } : null
  }
  const horizontal = (y, side) => {
    const x1 = Math.max(a.x, b.x)
    const x2 = Math.min(a.x + a.w, b.x + b.w)
    return x2 - x1 >= 1 ? { x1, y1: y, x2, y2: y, side } : null
  }
  if (a.x + a.w === b.x) return vertical(b.x, 'right')
  if (b.x + b.w === a.x) return vertical(a.x, 'left')
  if (a.y + a.h === b.y) return horizontal(b.y, 'bottom')
  if (b.y + b.h === a.y) return horizontal(a.y, 'top')
  return null
}

export const touches = (a, b) => sharedWall(a, b) !== null

/**
 * Where to put a room of `size` so it shares a wall with as many of
 * `connected` as it can, starting from a wall of one of `anchors`. It never
 * overlaps anything in `taken`, tries not to touch the rest of `taken` (no
 * room wants a wall it has no door in), and among equal spots takes the one
 * closest to `want` (a point in cells), if given.
 * @returns {{ x: number, y: number } | null} its top-left corner, or null when
 *   no wall of any anchor has room
 */
export function spotBeside(size, anchors, connected, taken, want = null) {
  let best = null
  let bestScore = -Infinity
  const consider = (x, y, anchor) => {
    const rect = { x, y, ...size }
    if (!fits(rect, taken)) return
    const doors = connected.filter((c) => touches(rect, c)).length
    const strangers = taken.filter((t) => !connected.includes(t) && touches(rect, t)).length
    const cx = x + size.w / 2
    const cy = y + size.h / 2
    const target = want ?? { x: anchor.x + anchor.w / 2, y: anchor.y + anchor.h / 2 }
    // Doors matter most, then avoiding strangers, then being close to where
    // the room is wanted, then lining up with the anchor.
    const offset = Math.abs(cx - (anchor.x + anchor.w / 2)) + Math.abs(cy - (anchor.y + anchor.h / 2))
    const score = doors * 1000 - strangers * 100 - Math.hypot(cx - target.x, cy - target.y) - offset / 100
    if (score > bestScore) {
      bestScore = score
      best = { x, y }
    }
  }
  for (const a of anchors) {
    for (let y = a.y - size.h + 1; y <= a.y + a.h - 1; y++) {
      consider(a.x + a.w, y, a)
      consider(a.x - size.w, y, a)
    }
    for (let x = a.x - size.w + 1; x <= a.x + a.w - 1; x++) {
      consider(x, a.y + a.h, a)
      consider(x, a.y - size.h, a)
    }
  }
  return best
}

// Where room `room` would like its center, going by where it sits in the graph
// compared to `anchor`, a room already on the map.
function wantedCenter(room, anchor) {
  if (!room.graphPos || !anchor.graphPos) return null
  return {
    x: anchor.rect.x + anchor.rect.w / 2 + ((room.graphPos.x - anchor.graphPos.x) / GRAPH_STEP.x) * MAP_STEP.x,
    y: anchor.rect.y + anchor.rect.h / 2 + ((room.graphPos.y - anchor.graphPos.y) / GRAPH_STEP.y) * MAP_STEP.y,
  }
}

// Rects for the rooms of one floor that have none. Rooms connected to a room
// already placed go beside it, so their door has a wall; the rest start a new
// cluster near where they sit in the graph.
function layoutFloor(rooms, edges) {
  const placed = new Map(rooms.filter((r) => isValidRect(r.rect)).map((r) => [r.id, r]))
  const neighbors = new Map(rooms.map((r) => [r.id, new Set()]))
  for (const e of edges) {
    if (e.from !== e.to && neighbors.has(e.from) && neighbors.has(e.to)) {
      neighbors.get(e.from).add(e.to)
      neighbors.get(e.to).add(e.from)
    }
  }
  const placedNeighbors = (room) => [...neighbors.get(room.id)].filter((id) => placed.has(id)).map((id) => placed.get(id))
  let pending = rooms.filter((r) => !placed.has(r.id))
  while (pending.length > 0) {
    const room = pending.find((r) => placedNeighbors(r).length > 0) ?? pending[0]
    pending = pending.filter((r) => r !== room)
    const taken = [...placed.values()].map((r) => r.rect)
    const near = placedNeighbors(room)
    let spot = null
    if (near.length > 0) {
      const rects = near.map((r) => r.rect)
      spot = spotBeside(ROOM_SIZE, rects, rects, taken, wantedCenter(room, near[0]))
    }
    spot ??= freeSpot(preferredSpot(room, rooms.indexOf(room)), ROOM_SIZE, taken)
    placed.set(room.id, { ...room, rect: { ...spot, ...ROOM_SIZE } })
  }
  return placed
}

/**
 * Gives every room without a usable rect one, on its own floor, clear of the
 * rooms already placed there and beside the rooms it connects to where it can
 * be. Returns the dungeon unchanged when nothing is missing. Rooms that already
 * have a rect never move.
 */
export function withMapLayout(dungeon) {
  if (dungeon.rooms.every((r) => isValidRect(r.rect))) return dungeon
  const laid = new Map()
  const floors = new Set(dungeon.rooms.map((r) => r.floor))
  for (const floor of floors) {
    const onFloor = dungeon.rooms.filter((r) => r.floor === floor)
    if (onFloor.some((r) => !isValidRect(r.rect))) {
      for (const [id, room] of layoutFloor(onFloor, dungeon.edges)) laid.set(id, room)
    }
  }
  const rooms = dungeon.rooms.map((room) => (isValidRect(room.rect) ? room : laid.get(room.id)))
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
