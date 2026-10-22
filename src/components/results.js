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

/**
 * Highlights for one step of softlock playback, from replay(): the rooms the
 * player can walk (marked 'stuck' on the last step), every other room faded,
 * the doors opened so far, and the connection this step's choice used.
 * `focus` is the room where this step happens, so a view that shows one floor
 * at a time can follow along: the start, or where the choice's connection
 * leads (its far end, for a one-way one).
 * @param {import('../model/dungeon.js').Dungeon} dungeon
 * @param {ReturnType<typeof import('../solver/replay.js').replay>} steps
 * @param {number} at the step shown
 * @returns {{ rooms: Map<string, 'here' | 'stuck' | 'out'>, edges: Map<string, 'pb-opened' | 'pb-current'>, focus: string | null }}
 */
export function playbackMarks(dungeon, steps, at) {
  const step = steps[at]
  const region = new Set(step.region)
  const here = at === steps.length - 1 ? 'stuck' : 'here'
  const rooms = new Map(dungeon.rooms.map((r) => [r.id, region.has(r.id) ? here : 'out']))
  const edges = new Map(step.opened.map((id) => [id, 'pb-opened']))
  if (step.choice) edges.set(step.choice.edge, 'pb-current')
  const edge = step.choice && dungeon.edges.find((e) => e.id === step.choice.edge)
  const focus = edge ? (step.choice.type === 'oneWay' ? edge.to : edge.from) : (dungeon.start ?? step.region[0] ?? null)
  return { rooms, edges, focus }
}

// Which room marks a floor tab shows, strongest first.
const FLOOR_MARKS = ['stuck', 'here', 'path']

/**
 * The strongest highlight on each floor, for its tab on the map: where the
 * player is stuck or standing in playback, or the critical path passing
 * through. Floors with none of these are left out.
 * @param {Map<string, string>} rooms room marks, from roomMarks() or playbackMarks()
 * @returns {Map<string, 'stuck' | 'here' | 'path'>} by floor id
 */
export function floorMarks(dungeon, rooms) {
  const marks = new Map()
  for (const room of dungeon.rooms) {
    const mark = rooms.get(room.id)
    if (!FLOOR_MARKS.includes(mark)) continue
    const had = marks.get(room.floor)
    if (!had || FLOOR_MARKS.indexOf(mark) < FLOOR_MARKS.indexOf(had)) marks.set(room.floor, mark)
  }
  return marks
}

/** What the player holds at a playback step, in words, like "1 small key, big key, hookshot". */
export function holdingText(step) {
  const parts = []
  if (step.keys > 0) parts.push(`${step.keys} small ${step.keys === 1 ? 'key' : 'keys'}`)
  if (step.bigKey) parts.push('big key')
  parts.push(...step.items.map((name) => name || 'unnamed item'))
  return parts.length > 0 ? parts.join(', ') : 'nothing'
}
