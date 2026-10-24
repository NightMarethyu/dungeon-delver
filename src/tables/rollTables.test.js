import { describe, expect, it } from 'vitest'
import sample from '../data/roll-tables.json'
import {
  cleanTables,
  entryRanges,
  formatTables,
  parseDice,
  pickEntry,
  rollDice,
  rollTable,
  slugify,
  totalWeight,
  validateTables,
} from './rollTables.js'

const codes = (problems) => problems.map((p) => p.code)
// A "random" that returns these values in turn.
const sequence = (...values) => {
  let i = 0
  return () => values[i++ % values.length]
}

const table = (id, entries, extra = {}) => ({ id, name: id, category: 'other', entries, ...extra })
const file = (...tables) => ({ version: 1, tables })

describe('the shipped tables file', () => {
  it('has no problems', () => {
    expect(validateTables(sample)).toEqual([])
  })

  it('is already formatted', async () => {
    const { readFileSync } = await import('node:fs')
    const text = readFileSync(new URL('../data/roll-tables.json', import.meta.url), 'utf8')
    expect(formatTables(sample)).toBe(text)
  })
})

describe('slugify', () => {
  it('makes an id from a name', () => {
    expect(slugify('Minor Treasure!')).toBe('minor-treasure')
    expect(slugify('  Crème brûlée  ')).toBe('creme-brulee')
  })
})

describe('weights', () => {
  const t = table('t', [{ text: 'a', weight: 3 }, { text: 'b' }, { text: 'c', weight: 2 }])

  it('add up to the die', () => {
    expect(totalWeight(t)).toBe(6)
  })

  it('give each entry a range', () => {
    expect(entryRanges(t)).toEqual([{ from: 1, to: 3 }, { from: 4, to: 4 }, { from: 5, to: 6 }])
  })

  it('pick entries in proportion', () => {
    expect(pickEntry(t, () => 0).text).toBe('a')
    expect(pickEntry(t, () => 2.9 / 6).text).toBe('a')
    expect(pickEntry(t, () => 3 / 6).text).toBe('b')
    expect(pickEntry(t, () => 0.999).text).toBe('c')
  })
})

describe('dice', () => {
  it('parses dice and plain numbers', () => {
    expect(parseDice('2d6')).toEqual({ count: 2, sides: 6, op: null, by: null })
    expect(parseDice('d20')).toEqual({ count: 1, sides: 20, op: null, by: null })
    expect(parseDice('1d4 + 1')).toEqual({ count: 1, sides: 4, op: '+', by: 1 })
    expect(parseDice('3d6*10')).toEqual({ count: 3, sides: 6, op: '*', by: 10 })
    expect(parseDice('5')).toEqual({ value: 5 })
  })

  it('rejects what isn\'t dice', () => {
    expect(parseDice('goblins')).toBeNull()
    expect(parseDice('2d0')).toBeNull()
    expect(parseDice('0d6')).toBeNull()
  })

  it('rolls', () => {
    expect(rollDice(parseDice('2d6+1'), () => 0)).toBe(3)
    expect(rollDice(parseDice('2d6*10'), () => 0.999)).toBe(120)
    expect(rollDice(parseDice('1d4-1'), () => 0)).toBe(0)
  })
})

describe('rollTable', () => {
  it('rolls dice and other tables in the result', () => {
    expect(rollTable(sample, 'sample-treasure', () => 0)).toBe('2 coins')
    expect(rollTable(sample, 'sample-treasure', sequence(0.99, 0))).toBe('A small gem: Red stone')
  })

  it('returns null for a missing or empty table', () => {
    expect(rollTable(sample, 'nope')).toBeNull()
    expect(rollTable(file(table('empty', [])), 'empty')).toBeNull()
  })

  it('stops a loop instead of running forever', () => {
    const looped = file(table('a', [{ text: 'a [b]' }]), table('b', [{ text: 'b [a]' }]))
    expect(rollTable(looped, 'a', () => 0)).toMatch(/…$/)
  })
})

describe('validateTables', () => {
  it('rejects something that isn\'t a tables file', () => {
    expect(codes(validateTables({ rooms: [] }))).toEqual(['notTables'])
  })

  it('checks table ids, names, and categories', () => {
    const problems = validateTables(
      file(
        { name: 'No id', category: 'other', entries: [{ text: 'x' }] },
        { id: 'Bad Id', name: 'x', category: 'other', entries: [{ text: 'x' }] },
        { id: 'same', name: 'x', category: 'loot', entries: [{ text: 'x' }] },
        { id: 'same', category: 'other', entries: [] },
      ),
    )
    expect(codes(problems)).toEqual(['missingId', 'invalidId', 'unknownCategory', 'duplicateId', 'missingName', 'noEntries'])
  })

  it('checks results', () => {
    const problems = validateTables(
      file(table('t', [{ text: ' ' }, { text: 'x', weight: 0 }, { text: '{2 goblins}' }, { text: '[nowhere]' }])),
    )
    expect(codes(problems)).toEqual(['emptyEntry', 'invalidWeight', 'invalidDice', 'unknownTable'])
    expect(problems.map((p) => p.entry)).toEqual([0, 1, 2, 3])
  })

  it('finds tables that roll on each other in a loop', () => {
    const problems = validateTables(file(table('a', [{ text: '[b]' }]), table('b', [{ text: '[a]' }])))
    expect(codes(problems)).toEqual(['tableLoop'])
    expect(problems[0].message).toContain('a → b → a')
  })
})

describe('saving', () => {
  it('drops empty fields and default weights, and sorts tables', () => {
    const data = file(
      table('z', [{ text: ' kept ', weight: 1, tags: [' Undead ', 'undead', ''] }, { text: '' }], { name: 'Zed', category: 'enemy', description: ' ', tags: [] }),
      table('a', [{ text: 'x', weight: 2 }], { name: 'Alpha', category: 'treasure' }),
    )
    expect(cleanTables(data).tables).toEqual([
      { id: 'a', name: 'Alpha', category: 'treasure', entries: [{ text: 'x', weight: 2 }] },
      { id: 'z', name: 'Zed', category: 'enemy', entries: [{ text: 'kept', tags: ['undead'] }] },
    ])
  })

  it('writes JSON that reads back the same', () => {
    const data = file(table('a', [{ text: 'say "hi"', weight: 2 }]), table('b', []))
    expect(JSON.parse(formatTables(data))).toEqual(cleanTables(data))
  })
})
