import { describe, expect, it } from 'vitest'
import { loadDungeon } from '../model/load.js'
import { solve } from './solve.js'

const KEY = { type: 'smallKey' }

// Builds a one-floor dungeon from a compact description. `rooms` maps id to
// contents; `edges` are [id, from, to, gate?, extra?].
function dungeon(rooms, edges, extra = {}) {
  const { dungeon: d, problems } = loadDungeon({
    version: 1,
    floors: [{ id: '1F', name: 'Ground Floor' }],
    rooms: Object.entries(rooms).map(([id, contents]) => ({ id, floor: '1F', contents })),
    edges: edges.map(([id, from, to, gate = { type: 'open' }, more = {}]) => ({ id, from, to, gate, ...more })),
    start: 'start',
    goal: 'goal',
    ...extra,
  })
  return { d, problems }
}

const solveRooms = (...args) => solve(dungeon(...args).d)
const softlockEdges = (result) => result.softlocks.map((s) => s.choices.map((c) => c.edge))

describe('solve', () => {
  it('counts spending a key on a door whose two sides are already connected as a softlock', () => {
    const result = solveRooms(
      { start: [KEY], side: [], goal: [] },
      [
        ['walk', 'start', 'side'],
        ['waste', 'start', 'side', KEY],
        ['bossDoor', 'side', 'goal', KEY],
      ],
    )
    expect(result.beatable).toBe(true)
    expect(softlockEdges(result)).toEqual([['waste']])
  })

  it('does not count a drop with a way back as a softlock', () => {
    const result = solveRooms(
      { start: [], pit: [], goal: [] },
      [
        ['drop', 'start', 'pit', undefined, { oneWay: true }],
        ['ladder', 'pit', 'start'],
        ['e1', 'start', 'goal'],
      ],
    )
    expect(result.softlocks).toEqual([])
  })

  it('keeps keys collected before a drop, even from rooms left behind', () => {
    const result = solveRooms(
      { start: [], closet: [KEY], pit: [], goal: [] },
      [
        ['e1', 'start', 'closet'],
        ['drop', 'start', 'pit', undefined, { oneWay: true }],
        ['bossDoor', 'pit', 'goal', KEY],
      ],
    )
    expect(result.beatable).toBe(true)
    expect(result.softlocks).toEqual([])
    expect(result.criticalPath).toEqual(['start', 'closet', 'start', 'pit', 'goal'])
  })

  it('reports the choice before a drop that leaves the player without a key', () => {
    const result = solveRooms(
      { start: [KEY], dead: [], pit: [], goal: [] },
      [
        ['toDead', 'start', 'dead', KEY],
        ['drop', 'start', 'pit', undefined, { oneWay: true }],
        ['bossDoor', 'pit', 'goal', KEY],
      ],
    )
    expect(softlockEdges(result)).toEqual([['toDead']])
  })

  it('says where the player is stuck', () => {
    const result = solveRooms(
      { start: [], pit: [], goal: [] },
      [
        ['drop', 'start', 'pit', undefined, { oneWay: true }],
        ['e1', 'start', 'goal'],
      ],
    )
    expect(result.softlocks).toEqual([{ choices: [{ type: 'oneWay', edge: 'drop' }], stuckIn: ['pit'] }])
  })

  it('opens a key door from either side', () => {
    const result = solveRooms({ start: [KEY], goal: [] }, [['door', 'goal', 'start', KEY]])
    expect(result.beatable).toBe(true)
  })

  it('opens a puzzle with no room given from either side', () => {
    const result = solveRooms({ start: [], goal: [] }, [['door', 'goal', 'start', { type: 'puzzle' }]])
    expect(result.beatable).toBe(true)
  })

  it('keeps a puzzle solved after a drop, on the critical path too', () => {
    const result = solveRooms(
      { start: [], pit: [{ type: 'item', name: 'hookshot' }], goal: [] },
      [
        ['drop', 'start', 'pit', undefined, { oneWay: true }],
        ['ladder', 'pit', 'start', { type: 'puzzle', at: 'start' }],
        ['gap', 'start', 'goal', { type: 'item', name: 'hookshot' }],
      ],
    )
    expect(result.softlocks).toEqual([])
    expect(result.criticalPath).toEqual(['start', 'pit', 'start', 'goal'])
  })

  it('counts a drop past an unsolved puzzle as a softlock', () => {
    const result = solveRooms(
      { start: [], pit: [], goal: [] },
      [
        ['drop', 'start', 'pit', undefined, { oneWay: true }],
        ['ladder', 'pit', 'start', { type: 'puzzle', at: 'pit' }],
        ['e1', 'start', 'goal', { type: 'puzzle', at: 'goal' }],
      ],
    )
    expect(result.beatable).toBe(false)
  })

  it('handles a locked one-way door', () => {
    const result = solveRooms({ start: [KEY], goal: [] }, [['door', 'start', 'goal', KEY, { oneWay: true }]])
    expect(result.beatable).toBe(true)
    expect(result.criticalPath).toEqual(['start', 'goal'])
  })

  it('walks the critical path through the side room an item is in', () => {
    const result = solveRooms(
      { start: [], side: [{ type: 'item', name: 'hookshot' }], goal: [] },
      [
        ['e1', 'start', 'side'],
        ['gap', 'start', 'goal', { type: 'item', name: 'hookshot' }],
      ],
    )
    expect(result.criticalPath).toEqual(['start', 'side', 'start', 'goal'])
  })

  it('does not list unreachable rooms as optional', () => {
    const result = solveRooms(
      { start: [], vault: [], goal: [] },
      [
        ['e1', 'start', 'goal'],
        ['sealed', 'start', 'vault', { type: 'bigKey' }],
      ],
    )
    expect(result.unreachableRooms).toEqual(['vault'])
    expect(result.optionalRooms).toEqual([])
  })

  it('refuses to solve without a goal', () => {
    const result = solveRooms({ start: [], goal: [] }, [['e1', 'start', 'goal']], { goal: null })
    expect(result.status).toBe('invalid')
    expect(result.beatable).toBe(false)
    expect(result.warnings.map((w) => w.code)).toEqual(['missingGoal'])
  })

  it('still solves around an edge to a missing room, with a warning', () => {
    const result = solveRooms({ start: [], goal: [] }, [
      ['e1', 'start', 'goal'],
      ['e2', 'start', 'nowhere'],
    ])
    expect(result.status).toBe('ok')
    expect(result.beatable).toBe(true)
    expect(result.warnings.map((w) => w.code)).toEqual(['edgeMissingRoom'])
  })

  describe('state-count guard', () => {
    // A hub with a key and a key door for each of n dead ends, plus an open
    // way to the goal: every subset of opened doors is a state, so 2^n states.
    function manyDoors(n) {
      const rooms = { start: Array.from({ length: n }, () => KEY), goal: [] }
      const edges = [['e0', 'start', 'goal']]
      for (let i = 0; i < n; i++) {
        rooms[`dead${i}`] = []
        edges.push([`door${i}`, 'start', `dead${i}`, KEY])
      }
      return dungeon(rooms, edges).d
    }

    it('fully checks a dungeon under the limit', () => {
      const result = solve(manyDoors(10))
      expect(result.status).toBe('ok')
      expect(result.stateCount).toBe(2 ** 10)
      expect(result.softlocks).toEqual([])
    })

    it('stops and reports a dungeon that is too complex', () => {
      const result = solve(manyDoors(10), { maxStates: 100 })
      expect(result.status).toBe('tooComplex')
      expect(result.stateCount).toBe(100)
      expect(result.beatable).toBe(true)
    })
  })
})
