import { describe, expect, it } from 'vitest'
import { CURRENT_VERSION, emptyDungeon } from '../model/dungeon.js'
import { SAVES_KEY, createSave, deleteSave, listSaves, readSave, writeSave } from './saves.js'

// A stand-in for localStorage.
function memoryStorage() {
  const items = new Map()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
  }
}

const named = (name) => emptyDungeon(name)

describe('saves', () => {
  it('starts empty', () => {
    expect(listSaves(memoryStorage())).toEqual([])
  })

  it('keeps several dungeons, newest first', () => {
    const storage = memoryStorage()
    const a = createSave(storage, named('Forest Temple'), 1000)
    const b = createSave(storage, named('Water Temple'), 2000)
    expect(listSaves(storage)).toEqual([
      { id: b, name: 'Water Temple', rooms: 0, updatedAt: 2000 },
      { id: a, name: 'Forest Temple', rooms: 0, updatedAt: 1000 },
    ])
  })

  it('reads a save back through loadDungeon', () => {
    const storage = memoryStorage()
    const id = createSave(storage, named('Forest Temple'))
    expect(readSave(storage, id)).toEqual({ dungeon: named('Forest Temple'), problems: expect.any(Array) })
    expect(readSave(storage, 'missing')).toBeNull()
  })

  it('migrates old formats on read', () => {
    const storage = memoryStorage()
    storage.setItem(SAVES_KEY, JSON.stringify({ old: { updatedAt: 1, dungeon: { ...named('Old'), version: 1 } } }))
    expect(readSave(storage, 'old').dungeon.version).toBe(CURRENT_VERSION)
  })

  it('overwrites and deletes', () => {
    const storage = memoryStorage()
    const id = createSave(storage, named('Draft'), 1)
    writeSave(storage, id, named('Final'), 2)
    expect(listSaves(storage)).toEqual([{ id, name: 'Final', rooms: 0, updatedAt: 2 }])
    deleteSave(storage, id)
    expect(listSaves(storage)).toEqual([])
  })

  it('survives missing, broken, or full storage without throwing', () => {
    expect(listSaves(null)).toEqual([])
    expect(createSave(null, named('X'))).toBeNull()

    const broken = memoryStorage()
    broken.setItem(SAVES_KEY, 'not json')
    expect(listSaves(broken)).toEqual([])

    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') } }
    expect(writeSave(full, 'x', named('X'))).toBe(false)
  })
})
