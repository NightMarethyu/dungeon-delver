import { describe, expect, it } from 'vitest'
import { mapConnections } from '../components/map/doors.js'
import { withMapLayout } from '../components/map/grid.js'
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

  it('lays out on the map with every door in a shared wall', () => {
    const laid = withMapLayout(dungeon)
    for (const floor of laid.floors) {
      const apart = mapConnections(laid.rooms.filter((r) => r.floor === floor.id), laid.edges).filter((c) => !c.door)
      expect(apart.map((c) => c.edge.id)).toEqual([])
    }
  })

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
