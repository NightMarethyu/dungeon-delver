import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { emptyDungeon } from '../model/dungeon.js'
import { loadDungeon } from '../model/load.js'
import { replay } from '../solver/replay.js'
import { solve } from '../solver/solve.js'
import { describeChoice, floorMarks, holdingText, pathEdges, playbackMarks, roomMarks, summarize } from './results.js'

const fixture = (name) =>
  loadDungeon(readFileSync(new URL(`../solver/__fixtures__/${name}.json`, import.meta.url), 'utf8')).dungeon

describe('summarize', () => {
  it('asks for a start and goal before checking', () => {
    const summary = summarize(solve(emptyDungeon()))
    expect(summary).toMatchObject({ tone: 'info', title: 'Not checked yet' })
    expect(summary.detail).toBe('Pick a start room. Pick a goal room.')
  })

  it.each([
    ['trivial', 'good', 'Beatable, no softlocks'],
    ['key-softlock', 'warn', 'Beatable, but softlock possible'],
    ['unbeatable', 'bad', 'Not beatable'],
  ])('%s is %s', (name, tone, title) => {
    expect(summarize(solve(fixture(name)))).toMatchObject({ tone, title })
  })

  it('says when the check was cut short', () => {
    const summary = summarize(solve(fixture('key-softlock'), { maxStates: 1 }))
    expect(summary.tone).toBe('warn')
    expect(summary.title).toMatch(/too complex/i)
  })
})

describe('roomMarks', () => {
  it('marks the critical path and optional rooms', () => {
    const marks = roomMarks(solve(fixture('key-softlock')))
    expect(Object.fromEntries(marks)).toEqual({ start: 'path', keyRoom: 'path', goal: 'path', dead: 'optional' })
  })

  it('marks unreachable rooms', () => {
    const result = solve(fixture('unbeatable'))
    const marks = roomMarks(result)
    expect(result.unreachableRooms.length).toBeGreaterThan(0)
    for (const id of result.unreachableRooms) expect(marks.get(id)).toBe('unreachable')
  })
})

describe('pathEdges', () => {
  it('finds the connection walked between each pair of rooms', () => {
    const d = fixture('key-softlock')
    const ids = pathEdges(d, solve(d).criticalPath)
    expect(ids.size).toBe(2)
    for (const id of ids) {
      const edge = d.edges.find((e) => e.id === id)
      expect(['start', 'keyRoom', 'goal']).toContain(edge.from)
      expect(['start', 'keyRoom', 'goal']).toContain(edge.to)
    }
  })

  it("won't walk a one-way edge backwards", () => {
    const d = {
      ...emptyDungeon(),
      edges: [{ id: 'e1', from: 'a', to: 'b', kind: 'drop', gate: { type: 'open' }, oneWay: true }],
    }
    expect([...pathEdges(d, ['a', 'b'])]).toEqual(['e1'])
    expect([...pathEdges(d, ['b', 'a'])]).toEqual([])
    expect(pathEdges(d, null).size).toBe(0)
  })
})

describe('describeChoice', () => {
  it('names the rooms on each side', () => {
    const d = fixture('key-softlock')
    expect(describeChoice(d, { type: 'openDoor', edge: 'toDead' })).toBe('Open the small key door between Entrance and Dead End')
    const trap = fixture('one-way-trap')
    expect(describeChoice(trap, { type: 'oneWay', edge: 'drop' })).toBe('Take the one-way drop from Hub to Pit')
  })
})

describe('playbackMarks', () => {
  const dungeon = fixture('key-softlock')
  const steps = replay(dungeon, solve(dungeon).softlocks[0].choices)

  it('shows where the player starts, with the rest faded', () => {
    const { rooms, edges } = playbackMarks(dungeon, steps, 0)
    expect(Object.fromEntries(rooms)).toEqual({ start: 'here', dead: 'out', keyRoom: 'out', goal: 'out' })
    expect(edges.size).toBe(0)
  })

  it('marks the stuck rooms and the door just opened on the last step', () => {
    const { rooms, edges } = playbackMarks(dungeon, steps, 1)
    expect(Object.fromEntries(rooms)).toEqual({ start: 'stuck', dead: 'stuck', keyRoom: 'out', goal: 'out' })
    expect(Object.fromEntries(edges)).toEqual({ toDead: 'pb-current' })
  })

  it('focuses the start, then where each choice happens', () => {
    expect(playbackMarks(dungeon, steps, 0).focus).toBe('start')
    expect(playbackMarks(dungeon, steps, 1).focus).toBe('start')
    const trap = fixture('one-way-trap')
    const drop = replay(trap, [{ type: 'oneWay', edge: 'drop' }])
    expect(playbackMarks(trap, drop, 1).focus).toBe('pit')
  })
})

describe('floorMarks', () => {
  const dungeon = {
    ...emptyDungeon(),
    floors: [{ id: 'f1', name: '1F' }, { id: 'f2', name: '2F' }, { id: 'f3', name: '3F' }],
    rooms: [
      { id: 'a', label: 'A', floor: 'f1', contents: [] },
      { id: 'b', label: 'B', floor: 'f1', contents: [] },
      { id: 'c', label: 'C', floor: 'f2', contents: [] },
      { id: 'd', label: 'D', floor: 'f3', contents: [] },
    ],
  }

  it('gives each floor its strongest mark, and none to floors without one', () => {
    const marks = floorMarks(dungeon, new Map([['a', 'path'], ['b', 'stuck'], ['c', 'optional'], ['d', 'out']]))
    expect(Object.fromEntries(marks)).toEqual({ f1: 'stuck' })
    expect(Object.fromEntries(floorMarks(dungeon, new Map([['c', 'path'], ['d', 'here']])))).toEqual({ f2: 'path', f3: 'here' })
  })
})

describe('holdingText', () => {
  it.each([
    [{ keys: 0, bigKey: false, items: [] }, 'nothing'],
    [{ keys: 1, bigKey: false, items: [] }, '1 small key'],
    [{ keys: 2, bigKey: true, items: ['hookshot', ''] }, '2 small keys, big key, hookshot, unnamed item'],
  ])('describes %j', (step, text) => {
    expect(holdingText(step)).toBe(text)
  })
})
