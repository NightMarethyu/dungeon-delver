// The dungeon format. Pure data, no React: both views and the solver read it.
// See README.md in this folder for the rules behind each field.

export const CURRENT_VERSION = 1

export const GATE_TYPES = ['open', 'smallKey', 'bigKey', 'item']
export const CONTENT_TYPES = ['smallKey', 'bigKey', 'item']
// Only affects rendering. The solver ignores it.
export const EDGE_KINDS = ['door', 'stairs', 'drop', 'passage']

/**
 * @typedef {{ id: string, name: string }} Floor
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect
 * @typedef {{ type: 'smallKey' } | { type: 'bigKey' } | { type: 'item', name: string }} Content
 * @typedef {{ id: string, floor: string, label: string, rect?: Rect, contents: Content[] }} Room
 * @typedef {{ type: 'open' } | { type: 'smallKey' } | { type: 'bigKey' } | { type: 'item', name: string }} Gate
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
