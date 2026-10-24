import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../examples/index.js'
import { floorPlans, mapFileName, mapPages, mapPdf, pageCount, printLayout, tileName, tiling } from './battleMap.js'

const room = (id, rect, extra = {}) => ({ id, floor: '1F', label: id, contents: [], rect, ...extra })
const dungeonOf = (rooms, edges = []) => ({
  version: 6,
  name: 'Test Keep',
  floors: [{ id: '1F', name: 'Ground' }],
  rooms,
  edges,
  start: rooms[0]?.id ?? null,
  goal: null,
})
const text = (bytes) => String.fromCharCode(...bytes)

describe('tiling', () => {
  it('fits a small map on one page', () => {
    expect(tiling(5, 4)).toMatchObject({ cols: 1, rows: 1 })
  })

  it('turns the page when that takes fewer pages', () => {
    expect(tiling(9, 6)).toMatchObject({ landscape: true, cols: 1, rows: 1 })
    expect(tiling(6, 9)).toMatchObject({ landscape: false, cols: 1, rows: 1 })
  })

  it('splits a big map across pages', () => {
    const t = tiling(20, 12)
    expect(t.cols * t.rows).toBe(Math.min(Math.ceil(20 / 7) * Math.ceil(12 / 9), Math.ceil(20 / 9) * Math.ceil(12 / 7)))
  })
})

describe('tileName', () => {
  it('names pages by row letter and column number', () => {
    expect(tileName(0, 0)).toBe('A1')
    expect(tileName(1, 2)).toBe('B3')
  })
})

describe('printLayout', () => {
  it('prints each map square an inch wide, or more at a bigger scale', () => {
    const d = dungeonOf([room('a', { x: 0, y: 0, w: 4, h: 3 })])
    expect(pageCount(d, { scale: 1 })).toBe(1)
    const [floor] = printLayout(d, { scale: 4 })
    expect(floor.w).toBeCloseTo(16.5)
    expect(floor.h).toBeCloseTo(12.5)
  })

  it('leaves out pages with no room on them', () => {
    // An L: rooms down the left and along the bottom leave the top right empty.
    const d = dungeonOf([room('a', { x: 0, y: 0, w: 3, h: 8 }), room('b', { x: 0, y: 8, w: 16, h: 3 })])
    const [floor] = printLayout(d, { scale: 1 })
    const { cols, rows } = floor.layout
    expect(cols * rows).toBeGreaterThan(floor.tiles.length)
    expect(floor.overview).toBe(true)
    expect(pageCount(d)).toBe(floor.tiles.length + 1)
  })

  it("leaves the rooms hidden from players off the players' map", () => {
    const d = dungeonOf([room('a', { x: 0, y: 0, w: 4, h: 3 }), room('secret', { x: 4, y: 0, w: 4, h: 3 }, { player: { hidden: true } })])
    expect(floorPlans(d, 'gm')[0].rooms.map((r) => r.id)).toEqual(['a', 'secret'])
    expect(floorPlans(d, 'players')[0].rooms.map((r) => r.id)).toEqual(['a'])
    const pdf = text(mapPdf(d, { audience: 'players' }))
    expect(pdf).not.toContain('(secret)')
  })
})

describe('mapPages', () => {
  it('draws the grid inside the rooms only when asked', () => {
    const d = dungeonOf([room('a', { x: 0, y: 0, w: 4, h: 3 })])
    const lines = (grid) => (mapPages(d, { grid })[0].content.match(/ l$/gm) ?? []).length
    expect(lines('square')).toBeGreaterThan(lines('none'))
    expect(lines('hex')).toBeGreaterThan(lines('square'))
  })

  it("labels rooms with their keys and names, as on the notes sheet", () => {
    const d = dungeonOf([room('a', { x: 0, y: 0, w: 6, h: 3 }, { label: 'Great Hall' }), room('b', { x: 6, y: 0, w: 4, h: 3 })], [
      { id: 'e1', from: 'a', to: 'b', gate: { type: 'smallKey' } },
    ])
    const content = mapPages(d)[0].content
    expect(content).toContain('(1) Tj')
    expect(content).toContain('(2) Tj')
    expect(content).toContain('(Great Hall) Tj')
  })

  it('makes a page set for every example', () => {
    for (const { dungeon } of EXAMPLES) {
      for (const grid of ['square', 'hex']) expect(mapPages(dungeon, { grid, paper: 'a4' }).length).toBe(pageCount(dungeon))
    }
  })
})

describe('mapFileName', () => {
  it('names the file after the dungeon', () => {
    expect(mapFileName({ name: "Thornback's Lair!" })).toBe('thornbacks-lair-map.pdf')
    expect(mapFileName({ name: '' })).toBe('dungeon-map.pdf')
  })
})
