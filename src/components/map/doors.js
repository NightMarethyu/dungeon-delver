// Where connections go on the map. Pure, like grid.js.
//
// The map only draws the connections the dungeon has. A connection between two
// rooms on the same floor is a door, and a door sits on the wall the two rooms
// share. Rooms that are connected but don't share a wall yet get a dashed line
// between them instead, until they're moved side by side.

import { sharedWall, touches } from './grid.js'

const connects = (edge, a, b) => (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a)

/**
 * The connections to draw on one floor's map. Each edge between two of
 * `rooms` (which must all have rects) is either a door on their shared wall,
 * at its middle, or, when they don't share one, a line between their centers.
 * Edges to other floors aren't drawn.
 * @returns {{ edge: object, door: { x: number, y: number, vertical: boolean } | null,
 *   line: { x1: number, y1: number, x2: number, y2: number } | null }[]} in cells
 */
export function mapConnections(rooms, edges) {
  const byId = new Map(rooms.map((r) => [r.id, r]))
  const out = []
  for (const edge of edges) {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    if (!from || !to || from === to) continue
    const wall = sharedWall(from.rect, to.rect)
    if (wall) {
      out.push({ edge, door: { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2, vertical: wall.x1 === wall.x2 }, line: null })
    } else {
      const c = (r) => ({ x: r.rect.x + r.rect.w / 2, y: r.rect.y + r.rect.h / 2 })
      const a = c(from)
      const b = c(to)
      out.push({ edge, door: null, line: { x1: a.x, y1: a.y, x2: b.x, y2: b.y } })
    }
  }
  return out
}

/**
 * The rooms among `rooms` that share a wall with room `id` but have no
 * connection to it: places a door could go.
 * @returns {string[]} their ids
 */
export function doorlessNeighbors(rooms, edges, id) {
  const room = rooms.find((r) => r.id === id)
  if (!room) return []
  return rooms
    .filter((r) => r.id !== id && touches(room.rect, r.rect) && !edges.some((e) => connects(e, id, r.id)))
    .map((r) => r.id)
}
