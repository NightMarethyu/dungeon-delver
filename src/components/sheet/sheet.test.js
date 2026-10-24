import { describe, expect, it } from 'vitest'
import { emptyDungeon } from '../../model/dungeon.js'
import { setPlayerHidden, setPlayerPart, setSheet } from '../../model/edit.js'
import { keyLabel, movedOrder, playerHandout, playerKeys, sheetOrder, sheetSections } from './sheet.js'

const room = (id, floor, x, y, extra = {}) => ({ id, floor, label: `Room ${id}`, rect: { x, y, w: 4, h: 3 }, contents: [], ...extra })
const edge = (id, from, to) => ({ id, from, to, kind: 'door', gate: { type: 'open' }, oneWay: false })

// Two floors. On 1F the start is a, which leads to c and then b; d is cut off.
// The basement's e is only reached by stairs from b.
const dungeon = {
  ...emptyDungeon('Test'),
  floors: [
    { id: 'B1', name: 'Basement' },
    { id: '1F', name: 'Ground Floor' },
  ],
  rooms: [
    room('b', '1F', 8, 0, { notes: { description: 'Dusty.', secrets: 'A loose brick.' }, contents: [{ type: 'smallKey' }] }),
    room('a', '1F', 0, 0, { notes: { description: 'The way in.' } }),
    room('c', '1F', 4, 0),
    room('d', '1F', 0, 10),
    room('e', 'B1', 0, 0),
  ],
  edges: [edge('e1', 'a', 'c'), edge('e2', 'c', 'b'), { ...edge('e3', 'b', 'e'), kind: 'stairs' }],
  start: 'a',
  goal: 'e',
}

describe('keyLabel', () => {
  it('counts from 1, or from A and on past Z', () => {
    expect([0, 1, 9].map((i) => keyLabel(i, 'numbers'))).toEqual(['1', '2', '10'])
    expect([0, 25, 26, 27, 51, 52, 701, 702].map((i) => keyLabel(i, 'letters'))).toEqual(['A', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA'])
  })

  it('uses numbers unless told otherwise', () => {
    expect(keyLabel(2)).toBe('3')
  })
})

describe('sheetOrder', () => {
  it('goes floor by floor from the entrance, start floor first', () => {
    expect(sheetOrder(dungeon)).toEqual(['a', 'c', 'b', 'd', 'e'])
  })

  it('falls back to map order with no start', () => {
    expect(sheetOrder({ ...dungeon, start: null })).toEqual(['e', 'a', 'c', 'b', 'd'])
  })

  it('puts the rooms the game master ordered first on their floor', () => {
    expect(sheetOrder(setSheet(dungeon, { order: ['d', 'b'] }))).toEqual(['d', 'b', 'a', 'c', 'e'])
  })
})

describe('movedOrder', () => {
  it('swaps a room with its neighbor on the same floor', () => {
    expect(movedOrder(dungeon, 'c', -1)).toEqual(['c', 'a', 'b', 'd', 'e'])
    expect(movedOrder(dungeon, 'b', 1)).toEqual(['a', 'c', 'd', 'b', 'e'])
  })

  it("doesn't move a room past the ends of its floor", () => {
    expect(movedOrder(dungeon, 'd', 1)).toEqual(sheetOrder(dungeon))
    expect(movedOrder(dungeon, 'e', -1)).toEqual(sheetOrder(dungeon))
  })

  it('sticks once saved as the order', () => {
    const moved = setSheet(dungeon, { order: movedOrder(dungeon, 'd', -1) })
    expect(sheetOrder(moved)).toEqual(['a', 'c', 'd', 'b', 'e'])
  })
})

describe('sheetSections', () => {
  const keysOf = (sections) => sections.map((s) => [s.floor.id, s.entries.map((e) => `${e.key}:${e.room.id}`)])

  it('keys every room, floor by floor', () => {
    expect(keysOf(sheetSections(dungeon, 'gm'))).toEqual([
      ['1F', ['1:a', '2:c', '3:b', '4:d']],
      ['B1', ['5:e']],
    ])
  })

  it('uses letters when asked', () => {
    expect(keysOf(sheetSections(setSheet(dungeon, { keys: 'letters' }), 'gm'))[1]).toEqual(['B1', ['E:e']])
  })

  it('leaves hidden rooms off the players sheet, with no gap in the keys', () => {
    const hidden = setPlayerHidden(dungeon, 'c', true)
    expect(keysOf(sheetSections(hidden, 'gm'))[0][1]).toContain('2:c')
    expect(keysOf(sheetSections(hidden, 'players'))).toEqual([
      ['1F', ['1:a', '2:b', '3:d']],
      ['B1', ['4:e']],
    ])
    expect(playerKeys(hidden).get('b')).toBe('2')
    expect(playerKeys(hidden).has('c')).toBe(false)
  })

  it('places rooms with no rect', () => {
    const unplaced = { ...dungeon, rooms: dungeon.rooms.map(({ rect: _rect, ...r }) => r) }
    const rooms = sheetSections(unplaced, 'gm').flatMap((s) => s.entries.map((e) => e.room))
    expect(rooms.every((r) => r.rect)).toBe(true)
  })
})

describe('playerHandout', () => {
  it('keeps only what the players may see', () => {
    const d = setPlayerPart(setPlayerHidden(dungeon, 'c', true), 'b', 'contents', true)
    const handout = playerHandout(d)
    expect(handout.rooms.map((r) => r.id)).toEqual(['b', 'a', 'd', 'e'])
    expect(handout.rooms[0].notes).toEqual({ description: 'Dusty.' })
    expect(handout.rooms[0].contents).toEqual([{ type: 'smallKey' }])
    expect(handout.rooms[1].contents).toEqual([])
    expect(handout.edges.map((e) => e.id)).toEqual(['e3'])
    expect(handout.goal).toBeNull()
    expect(JSON.stringify(handout)).not.toContain('loose brick')
  })

  it('keys its rooms as the players sheet does', () => {
    const d = setPlayerHidden(dungeon, 'c', true)
    const keys = (x, audience) => sheetSections(x, audience).flatMap((s) => s.entries.map((e) => `${e.key}:${e.room.id}`))
    expect(keys(playerHandout(d), 'players')).toEqual(keys(d, 'players'))
  })

  it('shows notes the game master picked', () => {
    const d = setPlayerPart(setPlayerPart(dungeon, 'b', 'secrets', true), 'b', 'description', false)
    expect(playerHandout(d).rooms[0].notes).toEqual({ secrets: 'A loose brick.' })
  })
})
