import { describe, expect, it } from 'vitest'
import { bounds, fits, freeSpot, isValidRect, moveRect, overlaps, resizeRect, ROOM_SIZE, withMapLayout } from './grid.js'

const room = (id, extra = {}) => ({ id, floor: '1F', label: id, contents: [], ...extra })
const dungeonOf = (rooms) => ({ version: 2, name: 'Test', floors: [{ id: '1F', name: '1F' }, { id: 'B1', name: 'B1' }], rooms, edges: [], start: null, goal: null })

describe('overlaps', () => {
  it('counts rooms that share only a wall as not overlapping', () => {
    expect(overlaps({ x: 0, y: 0, w: 4, h: 3 }, { x: 4, y: 0, w: 4, h: 3 })).toBe(false)
    expect(overlaps({ x: 0, y: 0, w: 4, h: 3 }, { x: 3, y: 2, w: 4, h: 3 })).toBe(true)
  })
})

describe('freeSpot', () => {
  it('takes the wanted spot when it is clear', () => {
    expect(freeSpot({ x: 2, y: 3 }, ROOM_SIZE, [])).toEqual({ x: 2, y: 3 })
  })

  it('moves to the nearest spot that keeps a gap from other rooms', () => {
    const spot = freeSpot({ x: 0, y: 0 }, ROOM_SIZE, [{ x: 0, y: 0, w: 4, h: 3 }])
    expect(fits({ ...spot, ...ROOM_SIZE }, [{ x: -1, y: -1, w: 6, h: 5 }])).toBe(true)
  })
})

describe('withMapLayout', () => {
  it('returns the same dungeon when every room has a rect', () => {
    const d = dungeonOf([room('r1', { rect: { x: 0, y: 0, w: 2, h: 2 } })])
    expect(withMapLayout(d)).toBe(d)
  })

  it('places missing rooms without moving placed ones or overlapping them', () => {
    const placed = { x: 0, y: 0, w: 4, h: 3 }
    const d = dungeonOf([room('r1', { rect: placed }), room('r2'), room('r3'), room('r4', { graphPos: { x: 0, y: 0 } })])
    const laid = withMapLayout(d)
    expect(laid.rooms[0].rect).toBe(placed)
    const rects = laid.rooms.map((r) => r.rect)
    for (const r of rects) expect(isValidRect(r)).toBe(true)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i], rects[j])).toBe(false)
    }
  })

  it('follows the graph layout when rooms have graph positions', () => {
    const laid = withMapLayout(dungeonOf([room('r1', { graphPos: { x: 0, y: 0 } }), room('r2', { graphPos: { x: 440, y: 0 } })]))
    expect(laid.rooms[0].rect).toMatchObject({ x: 0, y: 0 })
    expect(laid.rooms[1].rect).toMatchObject({ x: 10, y: 0 })
  })

  it('lays out each floor on its own', () => {
    const laid = withMapLayout(dungeonOf([room('r1'), room('r2', { floor: 'B1' })]))
    expect(laid.rooms[0].rect).toEqual(laid.rooms[1].rect)
  })

  it('replaces a rect that is unusable', () => {
    const laid = withMapLayout(dungeonOf([room('r1', { rect: { x: 0, y: 0, w: 0, h: 2 } })]))
    expect(isValidRect(laid.rooms[0].rect)).toBe(true)
  })
})

describe('moveRect and resizeRect', () => {
  const rect = { x: 2, y: 2, w: 4, h: 3 }

  it('moves by whole cells', () => {
    expect(moveRect(rect, -1, 2)).toEqual({ x: 1, y: 4, w: 4, h: 3 })
  })

  it('keeps the opposite corner fixed', () => {
    expect(resizeRect(rect, 'se', 2, 1)).toEqual({ x: 2, y: 2, w: 6, h: 4 })
    expect(resizeRect(rect, 'nw', 1, -1)).toEqual({ x: 3, y: 1, w: 3, h: 4 })
  })

  it('never shrinks below one cell', () => {
    expect(resizeRect(rect, 'nw', 10, 10)).toEqual({ x: 5, y: 4, w: 1, h: 1 })
    expect(resizeRect(rect, 'se', -10, -10)).toEqual({ x: 2, y: 2, w: 1, h: 1 })
  })
})

describe('bounds', () => {
  it('surrounds every rect', () => {
    expect(bounds([{ x: 0, y: 1, w: 2, h: 2 }, { x: 4, y: -1, w: 1, h: 1 }])).toEqual({ x: 0, y: -1, w: 5, h: 4 })
    expect(bounds([])).toBeNull()
  })
})
