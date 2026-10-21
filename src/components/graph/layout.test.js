import { describe, expect, it } from 'vitest'
import { emptyDungeon } from '../../model/dungeon.js'
import { borderPoint, freePosition, gridPosition, withGraphLayout } from './layout.js'

describe('withGraphLayout', () => {
  it('places only the rooms that have no position', () => {
    const d = emptyDungeon()
    d.rooms = [
      { id: 'a', floor: '1F', label: 'a', contents: [] },
      { id: 'b', floor: '1F', label: 'b', contents: [], graphPos: { x: 5, y: 5 } },
    ]
    const laid = withGraphLayout(d)
    expect(laid.rooms.map((r) => r.graphPos)).toEqual([gridPosition(0), { x: 5, y: 5 }])
    expect(withGraphLayout(laid)).toBe(laid)
  })
})

describe('freePosition', () => {
  it('steps past rooms already at the spot', () => {
    const rooms = [{ graphPos: { x: 0, y: 0 } }, { graphPos: { x: 24, y: 24 } }, {}]
    expect(freePosition({ x: 0, y: 0 }, rooms)).toEqual({ x: 48, y: 48 })
    expect(freePosition({ x: 7, y: 0 }, rooms)).toEqual({ x: 7, y: 0 })
  })
})

describe('borderPoint', () => {
  const rect = { x: 0, y: 0, w: 100, h: 40 }

  it('leaves through the side wall for a target off to the side', () => {
    expect(borderPoint(rect, { x: 250, y: 20 })).toEqual({ x: 100, y: 20 })
  })

  it('leaves through the top or bottom for a steep target', () => {
    expect(borderPoint(rect, { x: 50, y: -100 })).toEqual({ x: 50, y: 0 })
    expect(borderPoint(rect, { x: 70, y: 220 })).toEqual({ x: 52, y: 40 })
  })

  it('returns the center when the target is the center', () => {
    expect(borderPoint(rect, { x: 50, y: 20 })).toEqual({ x: 50, y: 20 })
  })
})
