import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadDungeon } from '../model/load.js'
import { replay } from './replay.js'
import { solve } from './solve.js'

const dir = new URL('./__fixtures__/', import.meta.url)
const load = (name) => loadDungeon(readFileSync(new URL(`${name}.json`, dir), 'utf8')).dungeon
const fixtures = readdirSync(dir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''))

describe('replay', () => {
  it('starts in the start region with nothing opened', () => {
    const [first] = replay(load('key-softlock'), [])
    expect(first).toEqual({ choice: null, region: ['start'], opened: [], keys: 1, bigKey: false, items: [] })
  })

  it('follows a key softlock: the key is spent on the dead end', () => {
    const steps = replay(load('key-softlock'), [{ type: 'openDoor', edge: 'toDead' }])
    expect(steps).toHaveLength(2)
    expect(steps[1].region.sort()).toEqual(['dead', 'start'])
    expect(steps[1].opened).toEqual(['toDead'])
    expect(steps[1].keys).toBe(0)
  })

  it('moves the player to the far end of a one-way edge', () => {
    const steps = replay(load('one-way-trap'), [{ type: 'oneWay', edge: 'drop' }])
    expect(steps[0].region.sort()).toEqual(['goal', 'hub', 'start'])
    expect(steps[1].region).toEqual(['pit'])
  })

  it('stops at a choice whose connection no longer exists', () => {
    expect(replay(load('key-softlock'), [{ type: 'openDoor', edge: 'gone' }])).toHaveLength(1)
  })

  it.each(fixtures)('ends every softlock in %s where the solver says the player is stuck', (name) => {
    const dungeon = load(name)
    for (const softlock of solve(dungeon).softlocks) {
      const steps = replay(dungeon, softlock.choices)
      expect(steps).toHaveLength(softlock.choices.length + 1)
      expect(steps.at(-1).region.sort()).toEqual([...softlock.stuckIn].sort())
    }
  })
})
