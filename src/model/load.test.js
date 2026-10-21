import { describe, expect, it } from 'vitest'
import { CURRENT_VERSION, emptyDungeon } from './dungeon.js'
import { loadDungeon } from './load.js'

const codes = (problems) => problems.map((p) => p.code)

const minimal = {
  version: 1,
  floors: [{ id: '1F', name: 'Ground Floor' }],
  rooms: [{ id: 'a', floor: '1F' }, { id: 'b', floor: '1F' }],
  edges: [{ id: 'e1', from: 'a', to: 'b' }],
  start: 'a',
  goal: 'b',
}

describe('loadDungeon', () => {
  it('accepts a JSON string or a parsed object', () => {
    expect(loadDungeon(JSON.stringify(minimal))).toEqual(loadDungeon(minimal))
  })

  it('fills in defaults', () => {
    const { dungeon, problems } = loadDungeon(minimal)
    expect(problems).toEqual([])
    expect(dungeon.name).toBe('Untitled Dungeon')
    expect(dungeon.rooms[0]).toEqual({ id: 'a', floor: '1F', label: 'a', contents: [] })
    expect(dungeon.edges[0]).toEqual({ id: 'e1', from: 'a', to: 'b', kind: 'door', gate: { type: 'open' }, oneWay: false })
  })

  it('keeps a room rect only when one is given', () => {
    const rect = { x: 0, y: 0, w: 4, h: 3 }
    const { dungeon } = loadDungeon({ ...minimal, rooms: [{ ...minimal.rooms[0], rect }, minimal.rooms[1]] })
    expect(dungeon.rooms[0].rect).toEqual(rect)
    expect('rect' in dungeon.rooms[1]).toBe(false)
  })

  it('keeps a room graphPos only when one is given', () => {
    const graphPos = { x: 120, y: -40 }
    const { dungeon } = loadDungeon({ ...minimal, rooms: [{ ...minimal.rooms[0], graphPos }, minimal.rooms[1]] })
    expect(dungeon.rooms[0].graphPos).toEqual(graphPos)
    expect('graphPos' in dungeon.rooms[1]).toBe(false)
  })

  it('migrates a version 1 dungeon to the current version', () => {
    const { dungeon, problems } = loadDungeon(minimal)
    expect(minimal.version).toBe(1)
    expect(dungeon.version).toBe(CURRENT_VERSION)
    expect(problems).toEqual([])
  })

  it('does not change its input', () => {
    const input = structuredClone(minimal)
    loadDungeon(input)
    expect(input).toEqual(minimal)
  })

  it('round-trips an empty dungeon', () => {
    const { dungeon } = loadDungeon(emptyDungeon('Test'))
    expect(dungeon).toEqual(emptyDungeon('Test'))
  })

  it('reads a dungeon with no version as the current version, with a warning', () => {
    const { version: _, ...unversioned } = minimal
    const { dungeon, problems } = loadDungeon(unversioned)
    expect(dungeon.version).toBe(CURRENT_VERSION)
    expect(codes(problems)).toEqual(['missingVersion'])
  })

  it.each([
    ['invalid JSON', '{ nope', 'invalidJson'],
    ['an array', '[]', 'notADungeon'],
    ['null', null, 'notADungeon'],
    ['a bad version', { ...minimal, version: 'one' }, 'invalidVersion'],
    ['a newer version', { ...minimal, version: CURRENT_VERSION + 1 }, 'newerVersion'],
  ])('rejects %s', (_, input, code) => {
    const { dungeon, problems } = loadDungeon(input)
    expect(dungeon).toBeNull()
    expect(codes(problems)).toEqual([code])
  })
})
