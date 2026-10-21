// Editing operations on a Dungeon. Pure, like the rest of the model: each one
// takes a dungeon and returns a new one, leaving its input unchanged. The
// editors call these instead of changing the dungeon themselves.

// The first `${prefix}${n}` that isn't taken, counting from 1.
export function nextId(prefix, items) {
  const taken = new Set(items.map((item) => item.id))
  let n = 1
  while (taken.has(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

/**
 * Adds a room on the first floor, or on `floor` if given.
 * @returns {{ dungeon: import('./dungeon.js').Dungeon, id: string }}
 */
export function addRoom(dungeon, { graphPos, floor } = {}) {
  const id = nextId('r', dungeon.rooms)
  const room = {
    id,
    floor: floor ?? dungeon.floors[0]?.id ?? '1F',
    label: `Room ${id.slice(1)}`,
    contents: [],
  }
  if (graphPos) room.graphPos = { x: graphPos.x, y: graphPos.y }
  return { dungeon: { ...dungeon, rooms: [...dungeon.rooms, room] }, id }
}

export function updateRoom(dungeon, id, patch) {
  return { ...dungeon, rooms: dungeon.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }
}

// Removes a room along with its connections, and unsets it as start or goal.
export function removeRoom(dungeon, id) {
  return {
    ...dungeon,
    rooms: dungeon.rooms.filter((r) => r.id !== id),
    edges: dungeon.edges.filter((e) => e.from !== id && e.to !== id),
    start: dungeon.start === id ? null : dungeon.start,
    goal: dungeon.goal === id ? null : dungeon.goal,
  }
}

const connects = (edge, a, b) => (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a)

/**
 * Connects two rooms with an open, two-way door. Returns a null id, and the
 * dungeon unchanged, when the rooms are the same, either one doesn't exist, or
 * they're already connected.
 * @returns {{ dungeon: import('./dungeon.js').Dungeon, id: string | null }}
 */
export function addEdge(dungeon, from, to) {
  const roomIds = new Set(dungeon.rooms.map((r) => r.id))
  if (from === to || !roomIds.has(from) || !roomIds.has(to) || dungeon.edges.some((e) => connects(e, from, to))) {
    return { dungeon, id: null }
  }
  const id = nextId('e', dungeon.edges)
  const edge = { id, from, to, kind: 'door', gate: { type: 'open' }, oneWay: false }
  return { dungeon: { ...dungeon, edges: [...dungeon.edges, edge] }, id }
}

export function updateEdge(dungeon, id, patch) {
  return { ...dungeon, edges: dungeon.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) }
}

// Swaps an edge's ends, which flips the direction of a one-way edge.
export function reverseEdge(dungeon, id) {
  return { ...dungeon, edges: dungeon.edges.map((e) => (e.id === id ? { ...e, from: e.to, to: e.from } : e)) }
}

export function removeEdge(dungeon, id) {
  return { ...dungeon, edges: dungeon.edges.filter((e) => e.id !== id) }
}

// Every item name used in the dungeon, in rooms or on gates, sorted.
export function itemNames(dungeon) {
  const names = new Set()
  for (const room of dungeon.rooms) {
    for (const c of room.contents) if (c.type === 'item' && c.name) names.add(c.name)
  }
  for (const edge of dungeon.edges) if (edge.gate.type === 'item' && edge.gate.name) names.add(edge.gate.name)
  return [...names].sort()
}

// Sets the start or goal room (`which` is 'start' or 'goal'), or clears it with
// null. A room can't be both, so making the start room the goal clears the start.
export function setEndpoint(dungeon, which, id) {
  const other = which === 'start' ? 'goal' : 'start'
  return { ...dungeon, [which]: id, [other]: id != null && dungeon[other] === id ? null : dungeon[other] }
}

/**
 * Adds a floor at the end of the list.
 * @returns {{ dungeon: import('./dungeon.js').Dungeon, id: string }}
 */
export function addFloor(dungeon, name) {
  const id = nextId('f', dungeon.floors)
  const floor = { id, name: name ?? `Floor ${dungeon.floors.length + 1}` }
  return { dungeon: { ...dungeon, floors: [...dungeon.floors, floor] }, id }
}

export function renameFloor(dungeon, id, name) {
  return { ...dungeon, floors: dungeon.floors.map((f) => (f.id === id ? { ...f, name } : f)) }
}

// Moves a floor one place up (-1) or down (+1) the list.
export function moveFloor(dungeon, id, by) {
  const i = dungeon.floors.findIndex((f) => f.id === id)
  const j = i + by
  if (i < 0 || j < 0 || j >= dungeon.floors.length) return dungeon
  const floors = [...dungeon.floors]
  ;[floors[i], floors[j]] = [floors[j], floors[i]]
  return { ...dungeon, floors }
}

// Removes a floor and moves its rooms to the floor listed before it (or after
// it, for the first floor). The last floor can't be removed.
export function removeFloor(dungeon, id) {
  const i = dungeon.floors.findIndex((f) => f.id === id)
  if (i < 0 || dungeon.floors.length === 1) return dungeon
  const floors = dungeon.floors.toSpliced(i, 1)
  const fallback = floors[Math.max(0, i - 1)].id
  return {
    ...dungeon,
    floors,
    rooms: dungeon.rooms.map((r) => (r.floor === id ? { ...r, floor: fallback } : r)),
  }
}

export const renameDungeon = (dungeon, name) => ({ ...dungeon, name })
