// The parts of a dungeon the solver needs, indexed for fast lookup. Pure, like
// the rest of the solver. Geometry, labels, floors, and edge kinds are dropped.

/**
 * @param {import('../model/dungeon.js').Dungeon} dungeon
 * @param {string} [without] a room to leave out, with its edges, for the
 *   optional-room check
 */
export function buildGraph(dungeon, without) {
  const contents = new Map()
  for (const room of dungeon.rooms) {
    if (room.id !== without) contents.set(room.id, room.contents)
  }

  // Edges by the rooms they can be walked from. Two-way edges appear under
  // both ends, one-way edges only under `from`.
  const twoWay = new Map([...contents.keys()].map((id) => [id, []]))
  const oneWay = new Map([...contents.keys()].map((id) => [id, []]))
  const keyDoors = []
  const oneWayEdges = []
  // Rooms holding a puzzle that opens a connection. Visiting one solves it.
  const puzzleRooms = new Set()
  for (const edge of dungeon.edges) {
    if (!contents.has(edge.from) || !contents.has(edge.to) || edge.from === edge.to) continue
    if (puzzleRoom(edge)) puzzleRooms.add(puzzleRoom(edge))
    if (edge.oneWay) {
      oneWay.get(edge.from).push(edge)
      oneWayEdges.push(edge)
    } else {
      twoWay.get(edge.from).push(edge)
      twoWay.get(edge.to).push(edge)
      if (edge.gate.type === 'smallKey') keyDoors.push(edge)
    }
  }

  return { contents, twoWay, oneWay, keyDoors, oneWayEdges, puzzleRooms, start: dungeon.start, goal: dungeon.goal }
}

// The room a puzzle gate is solved from, or null when it can be solved from
// either side (or the gate isn't a puzzle).
export function puzzleRoom(edge) {
  const { gate } = edge
  return gate.type === 'puzzle' && (gate.at === edge.from || gate.at === edge.to) ? gate.at : null
}

export const otherEnd = (edge, room) => (edge.from === room ? edge.to : edge.from)

// What the player holds, given the rooms they've emptied and the key doors
// they've opened. `visited` is the emptied rooms too: a puzzle in one of them
// is solved.
export function inventory(graph, collected, opened) {
  let keys = -opened.size
  let bigKey = false
  const items = new Set()
  for (const room of collected) {
    for (const content of graph.contents.get(room) ?? []) {
      if (content.type === 'smallKey') keys++
      else if (content.type === 'bigKey') bigKey = true
      else if (content.type === 'item') items.add(content.name)
    }
  }
  return { keys, bigKey, items, visited: collected }
}

// Whether a gate lets the player through without spending anything.
export function isPassable(edge, inv, opened) {
  const { gate } = edge
  switch (gate.type) {
    case 'open':
      return true
    case 'smallKey':
      return opened.has(edge.id)
    case 'bigKey':
      return inv.bigKey
    case 'item':
      return inv.items.has(gate.name)
    case 'puzzle': {
      // Solving a puzzle costs nothing and only ever opens a way, so the
      // player solves it whenever they reach its room. It then stays open
      // from both sides. One that can be solved from either side is as good
      // as open.
      const room = puzzleRoom(edge)
      return room === null || inv.visited.has(room)
    }
    default:
      return false
  }
}

// Whether passing this edge costs a key the player hasn't spent on it yet.
export const needsKey = (edge, opened) => edge.gate.type === 'smallKey' && !opened.has(edge.id)
