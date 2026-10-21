// Geometry for the graph editor. Pure, so it can be tested without React Flow.

const GRID_COLUMNS = 4
const GRID_X = 220
const GRID_Y = 140

// Where a room with no saved position goes: the nth slot of a grid.
export function gridPosition(index) {
  return { x: (index % GRID_COLUMNS) * GRID_X, y: Math.floor(index / GRID_COLUMNS) * GRID_Y }
}

// Gives every room without a graphPos one, so rooms don't jump around when an
// earlier room is deleted. Returns the dungeon unchanged when nothing is missing.
export function withGraphLayout(dungeon) {
  if (dungeon.rooms.every((r) => r.graphPos)) return dungeon
  return {
    ...dungeon,
    rooms: dungeon.rooms.map((r, i) => (r.graphPos ? r : { ...r, graphPos: gridPosition(i) })),
  }
}

// Nudges `pos` down and right until no room sits exactly there, so rooms added
// one after another don't stack.
export function freePosition(pos, rooms, step = 24) {
  const taken = new Set(rooms.map((r) => r.graphPos && `${r.graphPos.x},${r.graphPos.y}`))
  let { x, y } = pos
  while (taken.has(`${x},${y}`)) {
    x += step
    y += step
  }
  return { x, y }
}

export const center = (rect) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 })

// The point where a line from the middle of `rect` toward `target` leaves it.
export function borderPoint(rect, target) {
  const c = center(rect)
  const dx = target.x - c.x
  const dy = target.y - c.y
  if (dx === 0 && dy === 0) return c
  // Scale the direction so it just reaches the nearer of the two walls it heads for.
  const scale = Math.min(dx === 0 ? Infinity : rect.w / 2 / Math.abs(dx), dy === 0 ? Infinity : rect.h / 2 / Math.abs(dy))
  return { x: c.x + dx * scale, y: c.y + dy * scale }
}
