import { describe, expect, it } from 'vitest'
import { emptyDungeon } from './dungeon.js'
import {
  addEdge,
  addFloor,
  addRoom,
  firstEmoji,
  itemNames,
  moveFloor,
  nextId,
  removeEdge,
  removeFloor,
  removeRoom,
  renameFloor,
  reverseEdge,
  setEndpoint,
  setPlayerHidden,
  setPlayerPart,
  setSheet,
  withContentEmoji,
  withContentName,
  withContentType,
  updateEdge,
  setRoomNote,
  updateRoom,
} from './edit.js'
import { validateDungeon } from './validate.js'

// Three rooms, a-b connected; a is start and c is goal.
function sample() {
  let d = emptyDungeon()
  for (const id of ['a', 'b', 'c']) d.rooms.push({ id, floor: '1F', label: id, contents: [] })
  d.edges.push({ id: 'e1', from: 'a', to: 'b', kind: 'door', gate: { type: 'open' }, oneWay: false })
  d = { ...d, start: 'a', goal: 'c' }
  return d
}

describe('nextId', () => {
  it('fills the first free number', () => {
    expect(nextId('r', [])).toBe('r1')
    expect(nextId('r', [{ id: 'r1' }, { id: 'r3' }])).toBe('r2')
  })
})

describe('rooms', () => {
  it('adds a valid room on the first floor', () => {
    const { dungeon, id } = addRoom(emptyDungeon(), { graphPos: { x: 10, y: 20 } })
    expect(id).toBe('r1')
    expect(dungeon.rooms).toEqual([{ id: 'r1', floor: '1F', label: 'Room 1', contents: [], graphPos: { x: 10, y: 20 } }])
    expect(validateDungeon(dungeon).filter((p) => p.severity === 'warning')).toEqual([])
  })

  it('adds a room on a given floor with a map rect', () => {
    const { dungeon } = addRoom(emptyDungeon(), { floor: '1F', rect: { x: 1, y: 2, w: 4, h: 3 } })
    expect(dungeon.rooms[0].rect).toEqual({ x: 1, y: 2, w: 4, h: 3 })
    expect(validateDungeon(dungeon).filter((p) => p.severity === 'warning')).toEqual([])
  })

  it('updates only the named room', () => {
    const d = updateRoom(sample(), 'b', { label: 'Big Chest' })
    expect(d.rooms.map((r) => r.label)).toEqual(['a', 'Big Chest', 'c'])
  })

  it('removes a room with its edges and its start/goal role', () => {
    const d = removeRoom(sample(), 'a')
    expect(d.rooms.map((r) => r.id)).toEqual(['b', 'c'])
    expect(d.edges).toEqual([])
    expect(d.start).toBeNull()
    expect(d.goal).toBe('c')
  })

  it('sets and clears a room note', () => {
    let d = setRoomNote(sample(), 'b', 'traps', 'Pit under the rug')
    d = setRoomNote(d, 'b', 'other', 'Smells of smoke')
    expect(d.rooms[1].notes).toEqual({ traps: 'Pit under the rug', other: 'Smells of smoke' })
    expect('notes' in d.rooms[0]).toBe(false)
    d = setRoomNote(d, 'b', 'traps', '')
    expect(d.rooms[1].notes).toEqual({ other: 'Smells of smoke' })
    d = setRoomNote(d, 'b', 'other', '')
    expect('notes' in d.rooms[1]).toBe(false)
  })

  it('leaves its input alone', () => {
    const before = sample()
    const copy = structuredClone(before)
    addRoom(before)
    updateRoom(before, 'a', { label: 'x' })
    setRoomNote(before, 'a', 'description', 'x')
    removeRoom(before, 'a')
    expect(before).toEqual(copy)
  })
})

describe('edges', () => {
  it('adds an open two-way door', () => {
    const { dungeon, id } = addEdge(sample(), 'b', 'c')
    expect(id).toBe('e2')
    expect(dungeon.edges[1]).toEqual({ id: 'e2', from: 'b', to: 'c', kind: 'door', gate: { type: 'open' }, oneWay: false })
  })

  it.each([
    ['a room to itself', 'a', 'a'],
    ['a missing room', 'a', 'zz'],
    ['rooms already connected', 'b', 'a'],
  ])('refuses to connect %s', (_, from, to) => {
    const d = sample()
    expect(addEdge(d, from, to)).toEqual({ dungeon: d, id: null })
  })

  it('updates, reverses, and removes an edge', () => {
    let d = updateEdge(sample(), 'e1', { gate: { type: 'smallKey' }, oneWay: true })
    expect(d.edges[0]).toMatchObject({ gate: { type: 'smallKey' }, oneWay: true })
    d = reverseEdge(d, 'e1')
    expect(d.edges[0]).toMatchObject({ from: 'b', to: 'a' })
    expect(removeEdge(d, 'e1').edges).toEqual([])
  })
})

describe('room contents', () => {
  it('keeps the name when changing type, unless the new type is a key', () => {
    const goblins = { type: 'enemy', name: '3 goblins', emoji: '👹' }
    expect(withContentType(goblins, 'trap')).toEqual({ type: 'trap', name: '3 goblins' })
    expect(withContentType(goblins, 'smallKey')).toEqual({ type: 'smallKey' })
    expect(withContentType({ type: 'bigKey' }, 'custom')).toEqual({ type: 'custom', name: '' })
    expect(withContentType({ type: 'bigKey' }, 'treasure')).toEqual({ type: 'treasure' })
  })

  it('drops an empty name, except from an item or custom thing', () => {
    expect(withContentName({ type: 'enemy', name: 'Bat' }, '')).toEqual({ type: 'enemy' })
    expect(withContentName({ type: 'custom', name: 'Altar' }, '')).toEqual({ type: 'custom', name: '' })
    expect(withContentName({ type: 'treasure' }, '50 gold')).toEqual({ type: 'treasure', name: '50 gold' })
  })

  it('sets and clears an emoji icon', () => {
    expect(withContentEmoji({ type: 'smallKey' }, '🗝️')).toEqual({ type: 'smallKey', emoji: '🗝️' })
    expect(withContentEmoji({ type: 'smallKey', emoji: '🗝️' }, null)).toEqual({ type: 'smallKey' })
    expect(withContentEmoji({ type: 'smallKey', emoji: '🗝️' }, '  ')).toEqual({ type: 'smallKey' })
  })

  it('takes one whole character as an emoji', () => {
    expect(firstEmoji('🧙‍♀️ wizard')).toBe('🧙‍♀️')
    expect(firstEmoji('🇳🇴')).toBe('🇳🇴')
    expect(firstEmoji('')).toBeNull()
    expect(firstEmoji(undefined)).toBeNull()
  })
})

describe('itemNames', () => {
  it('lists items from rooms and gates once each', () => {
    let d = updateRoom(sample(), 'a', { contents: [{ type: 'item', name: 'hookshot' }, { type: 'smallKey' }] })
    d = updateEdge(d, 'e1', { gate: { type: 'item', name: 'bow' } })
    d = updateRoom(d, 'c', { contents: [{ type: 'item', name: 'hookshot' }] })
    expect(itemNames(d)).toEqual(['bow', 'hookshot'])
  })
})

describe('start and goal', () => {
  it('sets and clears either end', () => {
    expect(setEndpoint(sample(), 'start', 'b')).toMatchObject({ start: 'b', goal: 'c' })
    expect(setEndpoint(sample(), 'goal', null)).toMatchObject({ start: 'a', goal: null })
  })

  it("won't let one room be both", () => {
    expect(setEndpoint(sample(), 'goal', 'a')).toMatchObject({ start: null, goal: 'a' })
    expect(setEndpoint(sample(), 'start', 'c')).toMatchObject({ start: 'c', goal: null })
  })
})

describe('floors', () => {
  it('adds a floor with a fresh id', () => {
    const { dungeon, id } = addFloor(sample())
    expect(id).toBe('f1')
    expect(dungeon.floors).toEqual([{ id: '1F', name: 'Ground Floor' }, { id: 'f1', name: 'Floor 2' }])
  })

  it('renames and reorders floors', () => {
    let d = addFloor(sample(), 'Basement').dungeon
    d = renameFloor(d, '1F', 'Lobby')
    d = moveFloor(d, 'f1', -1)
    expect(d.floors).toEqual([{ id: 'f1', name: 'Basement' }, { id: '1F', name: 'Lobby' }])
    expect(moveFloor(d, 'f1', -1)).toBe(d)
  })

  it("moves a removed floor's rooms to a neighboring floor", () => {
    let d = addFloor(sample(), 'Basement').dungeon
    d = updateRoom(d, 'b', { floor: 'f1' })
    const without2 = removeFloor(d, 'f1')
    expect(without2.floors.map((f) => f.id)).toEqual(['1F'])
    expect(without2.rooms.every((r) => r.floor === '1F')).toBe(true)
    const without1 = removeFloor(d, '1F')
    expect(without1.rooms.every((r) => r.floor === 'f1')).toBe(true)
    expect(validateDungeon(without1).filter((p) => p.code === 'unknownFloor')).toEqual([])
  })

  it("won't remove the last floor", () => {
    const d = sample()
    expect(removeFloor(d, '1F')).toBe(d)
  })
})

describe('players and the notes sheet', () => {
  const base = { ...emptyDungeon(), rooms: [{ id: 'r1', floor: '1F', label: 'A', contents: [] }] }

  it('hides a room from the players and shows it again', () => {
    const hidden = setPlayerHidden(base, 'r1', true)
    expect(hidden.rooms[0].player).toEqual({ hidden: true })
    expect(setPlayerHidden(hidden, 'r1', false).rooms[0]).toEqual(base.rooms[0])
  })

  it('shows and hides parts, dropping a view that matches the default', () => {
    const more = setPlayerPart(base, 'r1', 'secrets', true)
    expect(more.rooms[0].player).toEqual({ show: ['description', 'secrets'] })
    expect(setPlayerPart(more, 'r1', 'secrets', false).rooms[0]).toEqual(base.rooms[0])
    expect(setPlayerPart(base, 'r1', 'description', false).rooms[0].player).toEqual({ show: [] })
  })

  it('changes sheet settings, dropping the ones set back to default', () => {
    const lettered = setSheet(base, { keys: 'letters' })
    expect(lettered.sheet).toEqual({ keys: 'letters' })
    expect(setSheet(lettered, { keys: undefined })).toEqual(base)
  })
})
