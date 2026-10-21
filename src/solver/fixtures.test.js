import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadDungeon } from '../model/load.js'
import { EXPECTED } from './__fixtures__/expected.js'
import { solve } from './solve.js'

const dir = new URL('./__fixtures__/', import.meta.url)
const fixtures = readdirSync(dir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => [file.replace(/\.json$/, ''), readFileSync(new URL(file, dir), 'utf8')])

describe('solver fixtures', () => {
  it('every fixture has expected results, and every expected result has a fixture', () => {
    expect(fixtures.map(([name]) => name).sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  describe.each(fixtures)('%s', (name, json) => {
    const { dungeon, problems } = loadDungeon(json)
    const expected = EXPECTED[name]

    it('loads with no data problems', () => {
      expect(problems).toEqual([])
    })

    it('only names rooms and edges that exist', () => {
      const rooms = new Set(dungeon.rooms.map((r) => r.id))
      const edges = new Set(dungeon.edges.map((e) => e.id))
      const roomRefs = [...expected.unreachableRooms, ...expected.optionalRooms, ...(expected.criticalPath ?? [])]
      expect(roomRefs.filter((id) => !rooms.has(id))).toEqual([])
      expect(expected.softlocks.flat().filter((id) => !edges.has(id))).toEqual([])
    })

    it('matches the expected solver results', () => {
      const result = solve(dungeon)
      expect(result.status).toBe('ok')
      expect({
        beatable: result.beatable,
        softlocks: result.softlocks.map((s) => s.choices.map((c) => c.edge)),
        unreachableRooms: [...result.unreachableRooms].sort(),
        optionalRooms: [...result.optionalRooms].sort(),
        criticalPath: result.criticalPath,
      }).toEqual({
        ...expected,
        unreachableRooms: [...expected.unreachableRooms].sort(),
        optionalRooms: [...expected.optionalRooms].sort(),
      })
    })
  })
})
