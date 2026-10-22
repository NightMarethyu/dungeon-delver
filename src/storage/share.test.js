import { describe, expect, it } from 'vitest'
import { loadDungeon } from '../model/load.js'
import twoFloor from '../solver/__fixtures__/two-floor.json'
import { decodeShare, encodeShare } from './share.js'

const dungeon = loadDungeon(twoFloor).dungeon

describe('share links', () => {
  it('round-trips a dungeon', () => {
    const { dungeon: shared, problems } = decodeShare(encodeShare(dungeon))
    expect(shared).toEqual(dungeon)
    expect(problems.filter((p) => p.severity === 'error')).toEqual([])
  })

  it('only uses characters that are safe in a URL hash', () => {
    expect(encodeShare(dungeon)).toMatch(/^[A-Za-z0-9+\-$]+$/)
  })

  it('migrates links made with an older format', () => {
    const old = { ...dungeon, version: 1 }
    expect(decodeShare(encodeShare(old)).dungeon).toEqual(dungeon)
  })

  it.each([['garbage!!'], [''], [encodeShare(dungeon).slice(0, 20)]])('reports a broken link for %j', (data) => {
    const { dungeon: shared, problems } = decodeShare(data)
    expect(shared).toBeNull()
    expect(problems[0].severity).toBe('error')
  })
})
