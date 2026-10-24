// The dungeon format. Pure data, no React: both views and the solver read it.
// See README.md in this folder for the rules behind each field.

export const CURRENT_VERSION = 4

export const GATE_TYPES = ['open', 'smallKey', 'bigKey', 'item', 'puzzle']
export const CONTENT_TYPES = ['smallKey', 'bigKey', 'item']
// Only affects rendering. The solver ignores it.
export const EDGE_KINDS = ['door', 'stairs', 'drop', 'passage']
// The game master's notes on a room, one free text box each. Not tied to any
// game system, and the solver never reads them. `other` is the catch-all.
export const NOTE_FIELDS = ['description', 'enemies', 'traps', 'treasure', 'secrets', 'other']

/**
 * @typedef {{ id: string, name: string }} Floor
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect
 * @typedef {{ type: 'smallKey' } | { type: 'bigKey' } | { type: 'item', name: string }} Content
 * @typedef {{ x: number, y: number }} Point
 * @typedef {Partial<Record<'description' | 'enemies' | 'traps' | 'treasure' | 'secrets' | 'other', string>>} RoomNotes
 * @typedef {{ id: string, floor: string, label: string, rect?: Rect, graphPos?: Point, notes?: RoomNotes, contents: Content[] }} Room
 * @typedef {{ type: 'open' } | { type: 'smallKey' } | { type: 'bigKey' } | { type: 'item', name: string } | { type: 'puzzle', at?: string }} Gate
 * @typedef {{ id: string, from: string, to: string, kind: string, gate: Gate, oneWay: boolean }} Edge
 * @typedef {{
 *   version: number,
 *   name: string,
 *   floors: Floor[],
 *   rooms: Room[],
 *   edges: Edge[],
 *   start: string | null,
 *   goal: string | null,
 * }} Dungeon
 */

/** @returns {Dungeon} */
export function emptyDungeon(name = 'Untitled Dungeon') {
  return {
    version: CURRENT_VERSION,
    name,
    floors: [{ id: '1F', name: 'Ground Floor' }],
    rooms: [],
    edges: [],
    start: null,
    goal: null,
  }
}
