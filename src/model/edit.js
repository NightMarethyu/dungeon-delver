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
