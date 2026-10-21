// Checks whether a dungeon can be beaten and how a player could get stuck.
// Pure: a loaded Dungeon in, plain objects out, no React.
//
// Results:
// - status: 'ok'; 'invalid' when the data has an error (no start or goal);
//   'tooComplex' when there were more states than the guard allows, so only
//   `beatable` (if true) and `criticalPath` can be trusted.
// - beatable: some sequence of choices reaches the goal.
// - softlocks: the choices that leave the goal unreachable, each as
//   { choices, stuckIn }. `choices` is the shortest sequence of choices
//   leading there, as { type: 'openDoor' | 'oneWay', edge }; only the last
//   one is the mistake. `stuckIn` is the rooms the player can still walk.
//   Only the first dead state on each branch counts, not every state after it.
// - unreachableRooms: rooms no sequence of choices reaches.
// - optionalRooms: rooms that can be left out entirely (contents and all) with
//   the dungeon still beatable. Start, goal, and unreachable rooms aren't
//   listed.
// - criticalPath: the rooms walked on one shortest winning route, in order:
//   fewest choices, then fewest rooms. null when the dungeon can't be beaten.
// - warnings: data problems from validateDungeon.
// - stateCount: how many states were explored.

import { validateDungeon } from '../model/validate.js'
import { explore } from './explore.js'
import { buildGraph } from './graph.js'
import { criticalPath } from './route.js'

export const DEFAULT_MAX_STATES = 50_000

// Which states can still reach a winning state.
function findAlive(states) {
  const parents = states.map(() => [])
  states.forEach((state, i) => state.children.forEach(({ to }) => parents[to].push(i)))
  const alive = states.map((s) => s.win)
  const stack = states.flatMap((s, i) => (s.win ? [i] : []))
  while (stack.length > 0) {
    for (const parent of parents[stack.pop()]) {
      if (!alive[parent]) {
        alive[parent] = true
        stack.push(parent)
      }
    }
  }
  return alive
}

function findSoftlocks(states, alive) {
  if (!alive[0]) return []
  // BFS through living states gives the shortest way to each one. Every
  // ancestor of a living state is alive too, so this reaches all of them.
  const path = new Map([[0, []]])
  const softlocks = []
  const reported = new Set()
  for (const [i, choices] of path) {
    for (const { choice, to } of states[i].children) {
      if (alive[to]) {
        if (!path.has(to)) path.set(to, [...choices, choice])
      } else if (!reported.has(to)) {
        reported.add(to)
        softlocks.push({ choices: [...choices, choice], stuckIn: [...states[to].region] })
      }
    }
  }
  return softlocks
}

/** @param {import('../model/dungeon.js').Dungeon} dungeon */
export function solve(dungeon, { maxStates = DEFAULT_MAX_STATES } = {}) {
  const warnings = validateDungeon(dungeon)
  const result = {
    status: 'ok',
    beatable: false,
    softlocks: [],
    unreachableRooms: [],
    optionalRooms: [],
    criticalPath: null,
    warnings,
    stateCount: 0,
  }
  if (warnings.some((w) => w.severity === 'error')) return { ...result, status: 'invalid' }

  const graph = buildGraph(dungeon)
  const { states, complete } = explore(graph, { maxStates })
  const alive = findAlive(states)
  result.stateCount = states.length
  result.beatable = alive[0]
  if (result.beatable) result.criticalPath = criticalPath(graph, { maxSteps: maxStates })
  if (!complete) return { ...result, status: 'tooComplex' }

  result.softlocks = findSoftlocks(states, alive)

  const reached = new Set(states.flatMap((s) => [...s.collected]))
  const roomIds = [...graph.contents.keys()]
  result.unreachableRooms = roomIds.filter((id) => !reached.has(id))

  if (result.beatable) {
    result.optionalRooms = roomIds.filter((id) => {
      if (id === dungeon.start || id === dungeon.goal || !reached.has(id)) return false
      const without = explore(buildGraph(dungeon, id), { maxStates, stopAtWin: true })
      return without.states.some((s) => s.win)
    })
  }
  return result
}
