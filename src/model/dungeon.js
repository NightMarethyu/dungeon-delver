// The dungeon format. Pure data, no React: both views and the solver read it.
// See README.md in this folder for the rules behind each field.

export const CURRENT_VERSION = 6

export const GATE_TYPES = ['open', 'smallKey', 'bigKey', 'item', 'puzzle']
// What a room can hold. The keys and items change what the player can open,
// so the solver reads them. The rest are for the game master and the solver
// ignores them: they never lock or open anything.
export const SOLVER_CONTENT_TYPES = ['smallKey', 'bigKey', 'item']
export const NOTE_CONTENT_TYPES = ['treasure', 'enemy', 'trap', 'puzzle', 'npc', 'custom']
export const CONTENT_TYPES = [...SOLVER_CONTENT_TYPES, ...NOTE_CONTENT_TYPES]
// Contents that need a name: an item is matched to its gate by name, and a
// custom thing is only what the user calls it. Other note contents may have
// one (like "3 goblins"); keys never do.
export const NAMED_CONTENT_TYPES = ['item', 'custom']
// Only affects rendering. The solver ignores it.
export const EDGE_KINDS = ['door', 'stairs', 'drop', 'passage']
// The game master's notes on a room, one free text box each. Not tied to any
// game system, and the solver never reads them. `other` is the catch-all.
export const NOTE_FIELDS = ['description', 'enemies', 'traps', 'treasure', 'secrets', 'other']
// What the players' handout can show of a room: its contents and each note.
// A room shows only its description unless the game master picks more.
export const PLAYER_PARTS = ['contents', ...NOTE_FIELDS]
export const DEFAULT_PLAYER_PARTS = ['description']
// How the notes sheet labels its rooms: 1, 2, 3 or A, B, C.
export const KEY_STYLES = ['numbers', 'letters']

/**
 * @typedef {{ id: string, name: string }} Floor
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect
 * @typedef {{ type: 'smallKey' } | { type: 'bigKey' } | { type: 'item', name: string }
 *   | { type: 'treasure' | 'enemy' | 'trap' | 'puzzle' | 'npc', name?: string } | { type: 'custom', name: string }} ContentKind
 * @typedef {ContentKind & { emoji?: string }} Content  `emoji` replaces the drawn icon
 * @typedef {{ x: number, y: number }} Point
 * @typedef {Partial<Record<'description' | 'enemies' | 'traps' | 'treasure' | 'secrets' | 'other', string>>} RoomNotes
 * @typedef {{ hidden?: true, show?: string[] }} PlayerView  what the handout shows of a room:
 *   nothing when `hidden`, otherwise the parts in `show` (DEFAULT_PLAYER_PARTS when left out)
 * @typedef {{ id: string, floor: string, label: string, rect?: Rect, graphPos?: Point, notes?: RoomNotes, player?: PlayerView, contents: Content[] }} Room
 * @typedef {{ keys?: 'numbers' | 'letters', order?: string[] }} SheetSettings  the notes sheet's
 *   room labels, and the room ids in the order the game master put them
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
 *   sheet?: SheetSettings,
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

/** The parts of `room` the players' handout shows (see PlayerView). */
export function playerParts(room) {
  return room.player?.show ?? DEFAULT_PLAYER_PARTS
}
