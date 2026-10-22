import { describe, expect, it } from 'vitest'
import { emptyDungeon } from '../model/dungeon.js'
import { loadDungeon } from '../model/load.js'
import { exportFileName, exportJson } from './transfer.js'

describe('JSON export', () => {
  it('writes JSON that imports back to the same dungeon', () => {
    const dungeon = { ...emptyDungeon('Water Temple'), rooms: [{ id: 'r1', floor: '1F', label: 'Lobby', contents: [], graphPos: { x: 4, y: 8 } }] }
    expect(loadDungeon(exportJson(dungeon)).dungeon).toEqual(dungeon)
  })

  it.each([
    ['Forest Hollow', 'forest-hollow.json'],
    ["  Ganon's  Tower!! ", 'ganon-s-tower.json'],
    ['', 'dungeon.json'],
    ['???', 'dungeon.json'],
  ])('names the file for %j', (name, file) => {
    expect(exportFileName(emptyDungeon(name))).toBe(file)
  })
})
