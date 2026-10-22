// Saved dungeons in localStorage, several at once. Pure apart from the storage
// it's given, so tests can pass a stand-in.
//
// Everything lives under one key as { [id]: { updatedAt, dungeon } }. Dungeons
// are small, so rewriting the whole thing on each save is cheap. Reads go
// through loadDungeon, so old save formats are migrated on the way in.
//
// Storage can be missing or throw (private windows, full quota, blocked site
// data). Reads then come back empty and writes return false; nothing throws.

import { loadDungeon } from '../model/load.js'

export const SAVES_KEY = 'dungeon-delver:saves'

/** localStorage, or null when the browser won't give it to us. */
export function browserStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function readAll(storage) {
  try {
    const all = JSON.parse(storage?.getItem(SAVES_KEY) ?? '{}')
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {}
  } catch {
    return {}
  }
}

function writeAll(storage, all) {
  if (!storage) return false
  try {
    storage.setItem(SAVES_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

export const newSaveId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * The saved dungeons, most recently changed first.
 * @returns {{ id: string, name: string, rooms: number, updatedAt: number }[]}
 */
export function listSaves(storage) {
  return Object.entries(readAll(storage))
    .map(([id, save]) => ({
      id,
      name: save?.dungeon?.name || 'Untitled Dungeon',
      rooms: Array.isArray(save?.dungeon?.rooms) ? save.dungeon.rooms.length : 0,
      updatedAt: Number(save?.updatedAt) || 0,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * One saved dungeon, loaded and migrated.
 * @returns {ReturnType<typeof loadDungeon> | null} null when there's no such save
 */
export function readSave(storage, id) {
  const save = readAll(storage)[id]
  return save ? loadDungeon(save.dungeon) : null
}

/** Saves `dungeon` under `id`, replacing what was there. Returns whether it worked. */
export function writeSave(storage, id, dungeon, now = Date.now()) {
  const all = readAll(storage)
  all[id] = { updatedAt: now, dungeon }
  return writeAll(storage, all)
}

/** Saves `dungeon` under a new id and returns the id, or null if it couldn't be saved. */
export function createSave(storage, dungeon, now = Date.now()) {
  const id = newSaveId()
  return writeSave(storage, id, dungeon, now) ? id : null
}

export function deleteSave(storage, id) {
  const all = readAll(storage)
  delete all[id]
  return writeAll(storage, all)
}
