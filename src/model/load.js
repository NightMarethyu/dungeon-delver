// Turns saved or shared JSON into a complete Dungeon: parses it, migrates old
// versions, fills in defaults, and validates. Pure, like the rest of the model.
//
// loadDungeon never throws. It returns { dungeon, problems }. If the input
// can't be read as a dungeon at all, dungeon is null and problems explains why.

import { CURRENT_VERSION, NOTE_FIELDS } from './dungeon.js'
import { validateDungeon } from './validate.js'

// MIGRATIONS[n] turns a version n dungeon into version n + 1.
// Add one here, and bump CURRENT_VERSION, whenever the format changes.
const MIGRATIONS = {
  // Version 2 added the optional rooms[].graphPos. Nothing to change.
  1: (raw) => raw,
  // Version 3 added the puzzle gate. Nothing to change.
  2: (raw) => raw,
  // Version 4 added the optional rooms[].notes. Nothing to change.
  3: (raw) => raw,
}

const fatal = (code, message) => ({
  dungeon: null,
  problems: [{ severity: 'error', code, message, ids: [] }],
})

const asArray = (value) => (Array.isArray(value) ? value : [])

// Keeps the known note fields that hold text, or nothing when none do.
function normalizeNotes(notes) {
  if (!notes || typeof notes !== 'object') return undefined
  const kept = Object.fromEntries(NOTE_FIELDS.filter((f) => typeof notes[f] === 'string' && notes[f] !== '').map((f) => [f, notes[f]]))
  return Object.keys(kept).length > 0 ? kept : undefined
}

function normalize(raw) {
  return {
    version: CURRENT_VERSION,
    name: typeof raw.name === 'string' ? raw.name : 'Untitled Dungeon',
    floors: asArray(raw.floors).map((f) => ({ id: String(f.id), name: f.name ?? String(f.id) })),
    rooms: asArray(raw.rooms).map((r) => {
      const room = {
        id: String(r.id),
        floor: r.floor,
        label: r.label ?? String(r.id),
        contents: asArray(r.contents).map((c) => ({ ...c })),
      }
      if (r.rect !== undefined) room.rect = { ...r.rect }
      if (r.graphPos !== undefined) room.graphPos = { ...r.graphPos }
      const notes = normalizeNotes(r.notes)
      if (notes) room.notes = notes
      return room
    }),
    edges: asArray(raw.edges).map((e) => ({
      id: String(e.id),
      from: e.from,
      to: e.to,
      kind: e.kind ?? 'door',
      gate: e.gate ? { ...e.gate } : { type: 'open' },
      oneWay: e.oneWay === true,
    })),
    start: raw.start ?? null,
    goal: raw.goal ?? null,
  }
}

/**
 * @param {string | object} input dungeon JSON, as a string or already parsed
 * @returns {{ dungeon: import('./dungeon.js').Dungeon | null, problems: object[] }}
 */
export function loadDungeon(input) {
  let raw = input
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input)
    } catch {
      return fatal('invalidJson', "This isn't valid JSON.")
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fatal('notADungeon', "This doesn't look like a dungeon.")
  }

  const loadProblems = []
  let version = raw.version
  if (version === undefined) {
    version = CURRENT_VERSION
    loadProblems.push({ severity: 'warning', code: 'missingVersion', message: `No version given, so it was read as version ${CURRENT_VERSION}.`, ids: [] })
  }
  if (!Number.isInteger(version) || version < 1) {
    return fatal('invalidVersion', `"${version}" isn't a valid version.`)
  }
  if (version > CURRENT_VERSION) {
    return fatal('newerVersion', `This dungeon was saved by a newer version of the app (format ${version}).`)
  }
  for (let v = version; v < CURRENT_VERSION; v++) raw = MIGRATIONS[v](raw)

  const dungeon = normalize(raw)
  return { dungeon, problems: [...loadProblems, ...validateDungeon(dungeon)] }
}
