// Turns solver results into what the editor shows: the status banner's text,
// and which rooms and connections to highlight. Pure, so it can be tested
// without React.

import { GATE_LABELS, KIND_LABELS } from './labels.js'

const roomName = (dungeon, id) => dungeon.rooms.find((r) => r.id === id)?.label ?? id

// Data problems that stop the solver, as things to do.
const TODO = {
  missingStart: 'Pick a start room.',
  missingGoal: 'Pick a goal room.',
  unknownStart: "The start room doesn't exist. Pick another.",
  unknownGoal: "The goal room doesn't exist. Pick another.",
}

/**
 * The status banner: a tone ('good', 'warn', 'bad', or 'info') and a headline.
 * @param {ReturnType<typeof import('../solver/solve.js').solve>} result
 */
export function summarize(result) {
  if (result.status === 'invalid') {
    const todo = result.warnings.filter((w) => w.severity === 'error').map((w) => TODO[w.code] ?? w.message)
    return { tone: 'info', title: 'Not checked yet', detail: todo.join(' ') }
  }
  if (result.status === 'tooComplex') {
    return result.beatable
      ? { tone: 'warn', title: 'Beatable, but too complex to check fully', detail: `Stopped after ${result.stateCount.toLocaleString()} situations, so softlocks may be missing.` }
      : { tone: 'warn', title: 'Too complex to check', detail: `Stopped after ${result.stateCount.toLocaleString()} situations without finding a way to win.` }
  }
  if (!result.beatable) return { tone: 'bad', title: 'Not beatable', detail: 'No sequence of choices reaches the goal.' }
  const n = result.softlocks.length
  if (n > 0) {
    return { tone: 'warn', title: 'Beatable, but softlock possible', detail: `${n} ${n === 1 ? 'choice leaves' : 'choices leave'} the player stuck.` }
  }
  return { tone: 'good', title: 'Beatable, no softlocks', detail: 'Every choice still leaves a way to the goal.' }
}

/**
 * What to highlight on each room: on the critical path, optional, or never
 * reached. Results that aren't trustworthy highlight nothing beyond the path.
 * @returns {Map<string, 'path' | 'optional' | 'unreachable'>}
 */
export function roomMarks(result) {
  const marks = new Map()
  if (result.status === 'ok') {
    for (const id of result.unreachableRooms) marks.set(id, 'unreachable')
    for (const id of result.optionalRooms) marks.set(id, 'optional')
  }
  for (const id of result.criticalPath ?? []) marks.set(id, 'path')
  return marks
}

// Whether a player can walk along `edge` from room `a` to room `b`.
const leadsFrom = (edge, a, b) => (edge.from === a && edge.to === b) || (!edge.oneWay && edge.from === b && edge.to === a)

// The connections walked along the critical path.
export function pathEdges(dungeon, path) {
  const ids = new Set()
  for (let i = 1; i < (path?.length ?? 0); i++) {
    const edge = dungeon.edges.find((e) => leadsFrom(e, path[i - 1], path[i]))
    if (edge) ids.add(edge.id)
  }
  return ids
}

/**
 * One choice in a softlock's sequence, in words, like "Open the small key door
 * between Hall and Dead End" or "Take the drop from Ledge to Pit".
 * @param {{ type: 'openDoor' | 'oneWay', edge: string }} choice
 */
export function describeChoice(dungeon, choice) {
  const edge = dungeon.edges.find((e) => e.id === choice.edge)
  if (!edge) return `Use connection ${choice.edge}`
  const from = roomName(dungeon, edge.from)
  const to = roomName(dungeon, edge.to)
  if (choice.type === 'openDoor') {
    return `Open the ${GATE_LABELS.smallKey.toLowerCase()} ${KIND_LABELS[edge.kind]?.toLowerCase() ?? 'door'} between ${from} and ${to}`
  }
  return `Take the one-way ${KIND_LABELS[edge.kind]?.toLowerCase() ?? 'connection'} from ${from} to ${to}`
}
