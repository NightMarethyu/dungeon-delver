// Explores every situation a player can get into. Pure, like the rest of the
// solver.
//
// A state is where the player is and what they've done: the region they can
// walk around freely, the small-key doors they've opened, and the rooms
// they've emptied. Within a region every move can be undone, so walking
// around involves no choices and the region's contents are simply collected.
// That's the free closure.
//
// The only real choices are the ones that can't be undone:
// - spending a small key on a door ('openDoor'), and
// - taking a one-way edge ('oneWay'), which moves the player to its far end.
//   It also costs a key if the edge is a locked door not opened yet.
//
// Exploring with BFS from the start gives the graph of states and the choices
// between them. States are deduplicated by region, opened doors, and emptied
// rooms. Emptied rooms are part of the key because after a one-way drop the
// player holds keys from rooms they can no longer reach.

import { inventory, isPassable, needsKey, otherEnd } from './graph.js'

const sortedKey = (set) => [...set].sort().join(',')

// Grows the region around `anchor` until nothing changes: walk every passable
// two-way edge, empty every room reached, and repeat, since new items can open
// new gates.
export function freeClosure(graph, anchor, opened, collected) {
  const emptied = new Set(collected)
  for (;;) {
    const inv = inventory(graph, emptied, opened)
    const region = new Set([anchor])
    const stack = [anchor]
    while (stack.length > 0) {
      const room = stack.pop()
      for (const edge of graph.twoWay.get(room)) {
        const next = otherEnd(edge, room)
        if (!region.has(next) && isPassable(edge, inv, opened)) {
          region.add(next)
          stack.push(next)
        }
      }
    }
    const before = emptied.size
    for (const room of region) emptied.add(room)
    if (emptied.size === before) return { region, collected: emptied, inv }
  }
}

function makeState(graph, anchor, opened, collected) {
  const { region, collected: emptied, inv } = freeClosure(graph, anchor, opened, collected)
  return {
    key: `${sortedKey(region)}|${sortedKey(opened)}|${sortedKey(emptied)}`,
    region,
    opened,
    collected: emptied,
    keys: inv.keys,
    inv,
    win: region.has(graph.goal),
    // { choice, to } for each choice out of this state, `to` being a state index.
    children: [],
  }
}

function* choices(graph, state) {
  const { region, opened, keys, inv } = state
  if (keys > 0) {
    // Includes doors whose two sides are already reachable: opening one wastes
    // a key, which a real player can do.
    for (const edge of graph.keyDoors) {
      if (!opened.has(edge.id) && (region.has(edge.from) || region.has(edge.to))) {
        yield { type: 'openDoor', edge: edge.id }
      }
    }
  }
  for (const edge of graph.oneWayEdges) {
    if (!region.has(edge.from)) continue
    const costsKey = needsKey(edge, opened)
    if (costsKey ? keys > 0 : isPassable(edge, inv, opened)) {
      // Dropping back into the same region for free changes nothing.
      if (!costsKey && region.has(edge.to)) continue
      yield { type: 'oneWay', edge: edge.id }
    }
  }
}

function applyChoice(graph, state, choice, edgesById) {
  const edge = edgesById.get(choice.edge)
  const opened = needsKey(edge, state.opened) ? new Set([...state.opened, edge.id]) : state.opened
  const anchor = choice.type === 'oneWay' ? edge.to : [...state.region][0]
  return makeState(graph, anchor, opened, state.collected)
}

/**
 * @returns {{ states: object[], complete: boolean }} states[0] is the start.
 *   With stopAtWin, exploration ends at the first winning state.
 */
export function explore(graph, { maxStates, stopAtWin = false }) {
  const edgesById = new Map([...graph.keyDoors, ...graph.oneWayEdges].map((e) => [e.id, e]))
  const root = makeState(graph, graph.start, new Set(), new Set())
  const states = [root]
  const index = new Map([[root.key, 0]])
  let complete = true

  for (let i = 0; i < states.length; i++) {
    const state = states[i]
    if (stopAtWin && state.win) return { states, complete }
    for (const choice of choices(graph, state)) {
      const next = applyChoice(graph, state, choice, edgesById)
      let to = index.get(next.key)
      if (to === undefined) {
        if (states.length >= maxStates) {
          complete = false
          continue
        }
        to = states.length
        states.push(next)
        index.set(next.key, to)
      }
      state.children.push({ choice, to })
    }
  }
  return { states, complete }
}
