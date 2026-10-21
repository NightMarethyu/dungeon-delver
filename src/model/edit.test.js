import { describe, expect, it } from 'vitest'
import { emptyDungeon } from './dungeon.js'
import { addEdge, addRoom, itemNames, nextId, removeEdge, removeRoom, reverseEdge, updateEdge, updateRoom } from './edit.js'
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

  it('leaves its input alone', () => {
    const before = sample()
    const copy = structuredClone(before)
    addRoom(before)
    updateRoom(before, 'a', { label: 'x' })
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

describe('itemNames', () => {
  it('lists items from rooms and gates once each', () => {
    let d = updateRoom(sample(), 'a', { contents: [{ type: 'item', name: 'hookshot' }, { type: 'smallKey' }] })
    d = updateEdge(d, 'e1', { gate: { type: 'item', name: 'bow' } })
    d = updateRoom(d, 'c', { contents: [{ type: 'item', name: 'hookshot' }] })
    expect(itemNames(d)).toEqual(['bow', 'hookshot'])
  })
})
