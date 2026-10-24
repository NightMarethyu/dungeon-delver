// What goes on the notes sheet, and in what order. Pure, so it can be tested
// without the DOM. The sheet lists the rooms floor by floor, each with a short
// key (1, 2, 3 or A, B, C) that labels it on the floor's little map too.
//
// The same sheet comes in two versions: the game master's, with everything,
// and the players' handout, with only what the game master chose to show.
// The handout numbers its own rooms, so a room hidden from the players leaves
// no gap in the keys to give it away.

import { playerParts } from '../../model/dungeon.js'
import { withMapLayout } from '../map/grid.js'

/** The key for the room at `index` on the sheet: 1, 2, 3… or A…Z, AA, AB… */
export function keyLabel(index, style) {
  if (style !== 'letters') return String(index + 1)
  let label = ''
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) label = String.fromCharCode(65 + (n % 26)) + label
  return label
}

// The floors in sheet order: the start room's floor first, then the rest as
// listed, then any a room names that's gone.
function floorOrder(dungeon) {
  const startFloor = dungeon.rooms.find((r) => r.id === dungeon.start)?.floor
  const known = dungeon.floors.map((f) => f.id)
  const ids = [...new Set([startFloor, ...known, ...dungeon.rooms.map((r) => r.floor)].filter((id) => id != null))]
  return ids.filter((id) => dungeon.rooms.some((r) => r.floor === id))
}

// How many connections each room is from the start, walking every connection
// both ways. Rooms the start can't get to aren't in the map.
function stepsFromStart(dungeon) {
  const steps = new Map()
  if (!dungeon.rooms.some((r) => r.id === dungeon.start)) return steps
  steps.set(dungeon.start, 0)
  const queue = [dungeon.start]
  while (queue.length > 0) {
    const id = queue.shift()
    for (const e of dungeon.edges) {
      const other = e.from === id ? e.to : e.to === id ? e.from : null
      if (other !== null && !steps.has(other)) {
        steps.set(other, steps.get(id) + 1)
        queue.push(other)
      }
    }
  }
  return steps
}

/**
 * Every room id in sheet order. Floor by floor (see floorOrder); within a
 * floor, rooms the game master has put in order come first, in that order,
 * and the rest follow from the entrance outward, and then top to bottom and
 * left to right on the map.
 */
export function sheetOrder(dungeon) {
  const laid = withMapLayout(dungeon)
  const steps = stepsFromStart(dungeon)
  const placed = new Map((dungeon.sheet?.order ?? []).map((id, i) => [id, i]))
  const rank = (room) => [
    placed.get(room.id) ?? Infinity,
    steps.get(room.id) ?? Infinity,
    room.rect?.y ?? 0,
    room.rect?.x ?? 0,
    laid.rooms.indexOf(room),
  ]
  const byRank = (a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i] ? -1 : 1
    return 0
  }
  return floorOrder(dungeon).flatMap((floor) =>
    laid.rooms
      .filter((r) => r.floor === floor)
      .sort(byRank)
      .map((r) => r.id),
  )
}

/**
 * The sheet order with room `id` moved one place up (-1) or down (+1) among
 * the rooms on its floor, for the dungeon's `sheet.order`. Unchanged when it's
 * already first or last.
 */
export function movedOrder(dungeon, id, by) {
  const order = sheetOrder(dungeon)
  const floorOf = new Map(dungeon.rooms.map((r) => [r.id, r.floor]))
  const peers = order.filter((other) => floorOf.get(other) === floorOf.get(id))
  const j = peers.indexOf(id) + by
  if (j < 0 || j >= peers.length || !peers.includes(id)) return order
  const i = order.indexOf(id)
  const k = order.indexOf(peers[j])
  const next = [...order]
  ;[next[i], next[k]] = [next[k], next[i]]
  return next
}

const isShown = (room) => !room.player?.hidden

/**
 * The sheet for `audience` ('gm' or 'players'): the floors that have rooms
 * on it, each with its rooms in order and their keys. The players' sheet
 * leaves out the rooms hidden from them. Rooms are laid out for the map.
 * @returns {{ floor: { id: string, name: string }, entries: { room: object, key: string }[] }[]}
 */
export function sheetSections(dungeon, audience) {
  const laid = withMapLayout(dungeon)
  const byId = new Map(laid.rooms.map((r) => [r.id, r]))
  const style = dungeon.sheet?.keys
  const rooms = sheetOrder(dungeon)
    .map((id) => byId.get(id))
    .filter((room) => audience !== 'players' || isShown(room))
  const keys = new Map(rooms.map((room, i) => [room.id, keyLabel(i, style)]))
  const sections = []
  for (const room of rooms) {
    let section = sections.at(-1)
    if (section?.floor.id !== room.floor) {
      section = { floor: dungeon.floors.find((f) => f.id === room.floor) ?? { id: room.floor, name: room.floor }, entries: [] }
      sections.push(section)
    }
    section.entries.push({ room, key: keys.get(room.id) })
  }
  return sections
}

/**
 * The players' keys, by room id, for the game master to see which number a
 * room has on the handout.
 * @returns {Map<string, string>}
 */
export function playerKeys(dungeon) {
  return new Map(sheetSections(dungeon, 'players').flatMap((s) => s.entries.map((e) => [e.room.id, e.key])))
}

/**
 * Only what the players may see of `dungeon`, to put in a handout link: the
 * rooms not hidden from them, with only the notes (and contents) picked for
 * them, the connections between those rooms, and the rooms' places on the
 * map. The goal, and anything the game master's view alone uses, is left out.
 */
export function playerHandout(dungeon) {
  const laid = withMapLayout(dungeon)
  const shown = laid.rooms.filter(isShown)
  const ids = new Set(shown.map((r) => r.id))
  const rooms = shown.map((r) => {
    const parts = playerParts(r)
    const room = { id: r.id, floor: r.floor, label: r.label, rect: { ...r.rect }, contents: parts.includes('contents') ? r.contents : [] }
    const notes = Object.fromEntries(Object.entries(r.notes ?? {}).filter(([field]) => parts.includes(field)))
    if (Object.keys(notes).length > 0) room.notes = notes
    if (r.player?.show) room.player = { show: r.player.show }
    return room
  })
  const handout = {
    version: dungeon.version,
    name: dungeon.name,
    floors: dungeon.floors.filter((f) => rooms.some((r) => r.floor === f.id)),
    rooms,
    edges: dungeon.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
    start: ids.has(dungeon.start) ? dungeon.start : null,
    goal: null,
  }
  // Baked in, so the handout keeps the order whatever the hidden rooms did to it.
  handout.sheet = { order: sheetOrder(dungeon).filter((id) => ids.has(id)) }
  if (dungeon.sheet?.keys) handout.sheet.keys = dungeon.sheet.keys
  return handout
}
