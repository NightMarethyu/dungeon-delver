import { describe, expect, it } from 'vitest'
import { doorlessNeighbors, mapConnections } from './doors.js'
import { sharedWall, spotBeside, touches, withMapLayout } from './grid.js'

const room = (id, rect, extra = {}) => ({ id, floor: '1F', label: id, contents: [], rect, ...extra })
const edge = (id, from, to, extra = {}) => ({ id, from, to, kind: 'door', gate: { type: 'open' }, oneWay: false, ...extra })

describe('sharedWall', () => {
  it('finds the stretch of wall two rooms share', () => {
    expect(sharedWall({ x: 0, y: 0, w: 4, h: 3 }, { x: 4, y: 1, w: 4, h: 3 })).toEqual({ x1: 4, y1: 1, x2: 4, y2: 3, side: 'right' })
    expect(sharedWall({ x: 0, y: 3, w: 4, h: 3 }, { x: 2, y: 0, w: 4, h: 3 })).toEqual({ x1: 2, y1: 3, x2: 4, y2: 3, side: 'top' })
  })

  it("doesn't count rooms that only meet at a corner, or are apart", () => {
    expect(touches({ x: 0, y: 0, w: 4, h: 3 }, { x: 4, y: 3, w: 4, h: 3 })).toBe(false)
    expect(touches({ x: 0, y: 0, w: 4, h: 3 }, { x: 5, y: 0, w: 4, h: 3 })).toBe(false)
  })
})

describe('mapConnections', () => {
  const rooms = [room('a', { x: 0, y: 0, w: 4, h: 3 }), room('b', { x: 4, y: 0, w: 4, h: 3 }), room('c', { x: 0, y: 10, w: 4, h: 3 })]

  it('puts a door in the middle of a shared wall', () => {
    const [c] = mapConnections(rooms, [edge('e1', 'a', 'b')])
    expect(c.door).toEqual({ x: 4, y: 1.5, vertical: true })
    expect(c.line).toBeNull()
  })

  it('draws a line between connected rooms that are apart', () => {
    const [c] = mapConnections(rooms, [edge('e1', 'a', 'c')])
    expect(c.door).toBeNull()
    expect(c.line).toEqual({ x1: 2, y1: 1.5, x2: 2, y2: 11.5 })
  })

  it('draws nothing between rooms that share a wall but no connection, or for other floors', () => {
    expect(mapConnections(rooms, [])).toEqual([])
    expect(mapConnections(rooms, [edge('e1', 'a', 'elsewhere', { kind: 'stairs' })])).toEqual([])
  })
})

describe('doorlessNeighbors', () => {
  it('lists rooms sharing a wall with no connection yet', () => {
    const rooms = [room('a', { x: 0, y: 0, w: 4, h: 3 }), room('b', { x: 4, y: 0, w: 4, h: 3 }), room('c', { x: 0, y: 3, w: 4, h: 3 })]
    expect(doorlessNeighbors(rooms, [edge('e1', 'b', 'a')], 'a')).toEqual(['c'])
  })
})

describe('spotBeside', () => {
  it('shares a wall with every connected room it can', () => {
    const a = { x: 0, y: 0, w: 4, h: 3 }
    const b = { x: 8, y: 0, w: 4, h: 3 }
    expect(spotBeside({ w: 4, h: 3 }, [a, b], [a, b], [a, b])).toEqual({ x: 4, y: 0 })
  })

  it('stays clear of rooms it has no door to', () => {
    const a = { x: 0, y: 0, w: 4, h: 3 }
    const other = { x: 4, y: -3, w: 4, h: 3 }
    const spot = spotBeside({ w: 4, h: 3 }, [a], [a], [a, other], { x: 6, y: 1.5 })
    const rect = { ...spot, w: 4, h: 3 }
    expect(touches(rect, a)).toBe(true)
    expect(touches(rect, other)).toBe(false)
  })
})

describe('withMapLayout and connections', () => {
  it('places connected rooms side by side, so each door has a wall', () => {
    const d = {
      version: 2,
      name: 'T',
      floors: [{ id: '1F', name: '1F' }],
      rooms: ['a', 'b', 'c', 'd'].map((id, i) => ({ id, floor: '1F', label: id, contents: [], graphPos: { x: i * 220, y: 0 } })),
      edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'c'), edge('e3', 'b', 'd')],
      start: null,
      goal: null,
    }
    const laid = withMapLayout(d)
    expect(mapConnections(laid.rooms, laid.edges).every((c) => c.door)).toBe(true)
  })
})
