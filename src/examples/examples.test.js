import { describe, expect, it } from 'vitest'
import { loadDungeon } from '../model/load.js'
import { solve } from '../solver/index.js'
import { EXAMPLES } from './index.js'

// What each example is there to show off. If an edit changes one of these,
// update its blurb too.
const EXPECTED = {
  'mossy-hollow': { softlocks: 0, optionalRooms: ['fountain'] },
  'sunken-cistern': { softlocks: 2, optionalRooms: ['storeroom'] },
  'ember-spire': { softlocks: 2, optionalRooms: ['vault'] },
}

describe.each(EXAMPLES)('example $id', ({ id, dungeon: raw }) => {
  const { dungeon, problems } = loadDungeon(raw)

  it('loads cleanly in the current format', () => {
    expect(problems).toEqual([])
    expect(raw).toEqual(dungeon)
  })

  it('gives the results its blurb promises', () => {
    const result = solve(dungeon)
    expect(result.status).toBe('ok')
    expect(result.beatable).toBe(true)
    expect(result.unreachableRooms).toEqual([])
    expect(result.softlocks).toHaveLength(EXPECTED[id].softlocks)
    expect(result.optionalRooms).toEqual(EXPECTED[id].optionalRooms)
  })

  it('places every room on the canvas', () => {
    expect(dungeon.rooms.every((r) => r.graphPos)).toBe(true)
  })
})
