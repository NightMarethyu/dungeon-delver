// The app's icons, by name. Every drawing in src/assets/icons/ is loaded at
// build time and parsed once (parse.js). Which icon stands for which part of
// a dungeon is decided here, in one place, so a later TTRPG mode can swap them.

import { parseIcon } from './parse.js'

const files = import.meta.glob('../../assets/icons/*.svg', { query: '?raw', import: 'default', eager: true })

/** Icon name (the file name without .svg) → parsed drawing. */
export const ICONS = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [path.match(/([^/]+)\.svg$/)[1], parseIcon(svg)]),
)

// What a room can hold. The drawn icons come first; a type with no drawing
// yet falls back to an emoji. Any content can swap its icon for an emoji the
// user picks (its `emoji`).
export const CONTENT_ICONS = { smallKey: 'key', bigKey: 'big_key', item: 'chest', treasure: 'chest', puzzle: 'puzzle' }
export const CONTENT_EMOJI = { enemy: '👹', trap: '🪤', npc: '🧑', custom: '⭐' }

// Emoji offered when picking a content's icon. Any other can be typed in.
export const EMOJI_CHOICES = [
  '🗝️', '💰', '💎', '👑', '🗡️', '🛡️', '🏹', '🪄', '📜', '🧪', '🍖', '🪙',
  '👹', '💀', '🐉', '🕷️', '🐀', '🧟', '👻', '🦇', '🐍', '🧌',
  '🧙', '🧝', '🧑', '👸', '🤴', '🧞',
  '🪤', '🔥', '⚡', '🕳️', '🧩', '🗿', '⚰️', '🕯️', '📖', '⛲', '🚪', '⭐', '❓', '❗',
]
// What locks a connection. Open connections use the plain door.
export const GATE_ICONS = { open: 'door', smallKey: 'door_locked', bigKey: 'big_key_door', item: 'item_pouch', puzzle: 'puzzle' }

// The icon for a gate or a room's contents.
export const gateIconName = (gate) => GATE_ICONS[gate?.type] ?? null
export const contentIconName = (content) => CONTENT_ICONS[content?.type] ?? null

// How to draw a room's content: { emoji } for the user's pick or a type with
// no drawing, otherwise { name } of the drawn icon. Null for an unknown type.
export function contentIcon(content) {
  if (content?.emoji) return { emoji: content.emoji }
  const name = contentIconName(content)
  if (name) return { name }
  const emoji = CONTENT_EMOJI[content?.type]
  return emoji ? { emoji } : null
}

// The icon for a connection's way between floors: a hole for a drop, and
// stairs for anything else that changes floor (or is marked as stairs). The
// stairs' arrow shows which way the player can go. Floors are listed from the
// top down, so a later floor in the list is lower. Null for a plain door.
export function passageIconName(dungeon, edge) {
  if (edge.kind === 'drop') return 'hole'
  const floorOf = (id) => dungeon.rooms.find((r) => r.id === id)?.floor
  const from = floorOf(edge.from)
  const to = floorOf(edge.to)
  if (edge.kind !== 'stairs' && from === to) return null
  if (!edge.oneWay) return 'stairs_two_way'
  const level = (floor) => dungeon.floors.findIndex((f) => f.id === floor)
  return level(to) < level(from) ? 'stairs_up' : 'stairs_down'
}

// The rooms that hold a puzzle opening one of their connections.
export function puzzleRooms(dungeon) {
  return new Set(dungeon.edges.filter((e) => e.gate.type === 'puzzle' && (e.gate.at === e.from || e.gate.at === e.to)).map((e) => e.gate.at))
}
