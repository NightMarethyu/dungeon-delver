// Editing operations on a Dungeon. Pure, like the rest of the model: each one
// takes a dungeon and returns a new one, leaving its input unchanged. The
// editors call these instead of changing the dungeon themselves.

import { DEFAULT_PLAYER_PARTS, PLAYER_PARTS, playerParts } from './dungeon.js'

// The first `${prefix}${n}` that isn't taken, counting from 1.
export function nextId(prefix, items) {
  const taken = new Set(items.map((item) => item.id))
  let n = 1
  while (taken.has(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

/**
 * Adds a room on the first floor, or on `floor` if given, at a graph position
 * and map rect if given.
 * @returns {{ dungeon: import('./dungeon.js').Dungeon, id: string }}
 */
export function addRoom(dungeon, { graphPos, rect, floor } = {}) {
  const id = nextId('r', dungeon.rooms)
  const room = {
    id,
    floor: floor ?? dungeon.floors[0]?.id ?? '1F',
    label: `Room ${id.slice(1)}`,
    contents: [],
  }
  if (graphPos) room.graphPos = { x: graphPos.x, y: graphPos.y }
  if (rect) room.rect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h }
  return { dungeon: { ...dungeon, rooms: [...dungeon.rooms, room] }, id }
}

export function updateRoom(dungeon, id, patch) {
  return { ...dungeon, rooms: dungeon.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }
}

// Sets one of a room's notes. An empty note is left out, and so is `notes`
// once every note is empty, so rooms without notes stay as they were.
export function setRoomNote(dungeon, id, field, text) {
  return {
    ...dungeon,
    rooms: dungeon.rooms.map((r) => {
      if (r.id !== id) return r
      const notes = { ...r.notes, [field]: text }
      if (text === '') delete notes[field]
      const room = { ...r, notes }
      if (Object.keys(notes).length === 0) delete room.notes
      return room
    }),
  }
}

// A room with its `player` view changed by `change`, which gets a copy. The
// view is left out once it says nothing the default doesn't.
function withPlayer(room, change) {
  const player = { ...room.player }
  change(player)
  if (!player.hidden) delete player.hidden
  if (player.show && player.show.length === DEFAULT_PLAYER_PARTS.length && player.show.every((p) => DEFAULT_PLAYER_PARTS.includes(p))) {
    delete player.show
  }
  const next = { ...room, player }
  if (Object.keys(player).length === 0) delete next.player
  return next
}

// Hides a room from the players' handout, map and all, or shows it again.
export function setPlayerHidden(dungeon, id, hidden) {
  return {
    ...dungeon,
    rooms: dungeon.rooms.map((r) => (r.id === id ? withPlayer(r, (p) => (p.hidden = hidden)) : r)),
  }
}

// Shows or hides one part of a room (a note, or its contents) on the players' handout.
export function setPlayerPart(dungeon, id, part, shown) {
  return {
    ...dungeon,
    rooms: dungeon.rooms.map((r) => {
      if (r.id !== id) return r
      const show = new Set(playerParts(r))
      if (shown) show.add(part)
      else show.delete(part)
      return withPlayer(r, (p) => (p.show = PLAYER_PARTS.filter((x) => show.has(x))))
    }),
  }
}

// Changes the notes sheet's settings. A setting given as undefined goes back
// to its default, and `sheet` is left out once every one has.
export function setSheet(dungeon, patch) {
  const sheet = { ...dungeon.sheet, ...patch }
  for (const key of Object.keys(sheet)) if (sheet[key] === undefined) delete sheet[key]
  const next = { ...dungeon, sheet }
  if (Object.keys(sheet).length === 0) delete next.sheet
  return next
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

// The first character the user typed, as the icon for a room's content. One
// character as the eye sees it, so an emoji built from several code points
// (like 🧙‍♀️ or a flag) stays whole. Null when there is none.
export function firstEmoji(text) {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (!trimmed) return null
  const [first] = new Intl.Segmenter().segment(trimmed)
  return first.segment
}

// A room's content changed to another type. Its name is kept when the new type
// can have one (keys can't), and an item or custom thing always gets one. Its
// emoji is dropped, since it was picked for the old type.
export function withContentType(content, type) {
  if (type === 'smallKey' || type === 'bigKey') return { type }
  if (type === 'item' || type === 'custom') return { type, name: content.name ?? '' }
  return content.name ? { type, name: content.name } : { type }
}

// A room's content renamed. An item or custom thing keeps an empty name, so its
// box stays; other contents drop it.
export function withContentName(content, name) {
  if (name || content.type === 'item' || content.type === 'custom') return { ...content, name }
  const { name: _old, ...rest } = content
  return rest
}

// A room's content with its icon set to an emoji, or back to the default with
// null (or anything that isn't one).
export function withContentEmoji(content, emoji) {
  const { emoji: _old, ...rest } = content
  const kept = firstEmoji(emoji)
  return kept ? { ...rest, emoji: kept } : rest
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
