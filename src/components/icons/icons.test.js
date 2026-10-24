import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONTENT_TYPES, GATE_TYPES } from '../../model/dungeon.js'
import { CONTENT_EMOJI, CONTENT_ICONS, EMOJI_CHOICES, GATE_ICONS, ICONS, contentIcon, passageIconName, puzzleRooms } from './icons.js'
import { parseIcon, UNSUPPORTED_SHAPES } from './parse.js'

const dir = new URL('../../assets/icons/', import.meta.url)
const drawings = readdirSync(dir)
  .filter((file) => file.endsWith('.svg'))
  .map((file) => [file.replace(/\.svg$/, ''), readFileSync(new URL(file, dir), 'utf8')])

describe('parseIcon', () => {
  it('reads paths with their class styles, and swaps drawn colors for theme colors', () => {
    const svg = `<svg viewBox="0 0 10 10"><defs><style>
      .cls-1{fill:#FBB03B;stroke:#000000;stroke-width:30;stroke-miterlimit:10}
      .cls-2{fill:none;stroke:#123456}
    </style></defs><path d="M0 0 L1 1" class="cls-1"/><path class="cls-2" d="M2 2"/><path d="M3 3" fill="#abcdef"/></svg>`
    expect(parseIcon(svg)).toEqual({
      viewBox: '0 0 10 10',
      paths: [
        { d: 'M0 0 L1 1', fill: 'var(--icon-gold)', stroke: 'var(--icon-ink)', strokeWidth: 30, strokeMiterlimit: 10 },
        { d: 'M2 2', fill: 'none', stroke: '#123456' },
        { d: 'M3 3', fill: '#abcdef' },
      ],
    })
  })

  it('fills an unstyled path black, as SVG does', () => {
    expect(parseIcon('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>').paths).toEqual([{ d: 'M0 0', fill: 'var(--icon-void)' }])
  })
})

describe.each(drawings)('the %s drawing', (name, svg) => {
  it('only uses shapes the parser reads', () => {
    expect(svg).not.toMatch(UNSUPPORTED_SHAPES)
  })

  it('parses to paths, each with path data', () => {
    const { paths } = ICONS[name]
    expect(paths.length).toBeGreaterThan(0)
    expect(paths.every((p) => p.d && p.d.length > 0)).toBe(true)
  })
})

describe('icon choices', () => {
  it('every gate has a drawn icon', () => {
    expect(GATE_TYPES.map((t) => GATE_ICONS[t]).filter((n) => !ICONS[n])).toEqual([])
  })

  it('every content type has a drawn icon or, failing that, an emoji', () => {
    expect(Object.values(CONTENT_ICONS).filter((n) => !ICONS[n])).toEqual([])
    expect(CONTENT_TYPES.filter((t) => !CONTENT_ICONS[t] && !CONTENT_EMOJI[t])).toEqual([])
  })

  it('keeps the drawn art for keys and items', () => {
    expect(contentIcon({ type: 'smallKey' })).toEqual({ name: 'key' })
    expect(contentIcon({ type: 'bigKey' })).toEqual({ name: 'big_key' })
    expect(contentIcon({ type: 'item', name: 'hookshot' })).toEqual({ name: 'chest' })
  })

  it("uses a content's own emoji over its drawn icon", () => {
    expect(contentIcon({ type: 'smallKey', emoji: '🗝️' })).toEqual({ emoji: '🗝️' })
    expect(contentIcon({ type: 'enemy' })).toEqual({ emoji: CONTENT_EMOJI.enemy })
    expect(contentIcon({ type: 'nope' })).toBeNull()
  })

  it('offers each emoji once', () => {
    expect(new Set(EMOJI_CHOICES).size).toBe(EMOJI_CHOICES.length)
  })
})

describe('passageIconName', () => {
  const dungeon = {
    floors: [{ id: '2F' }, { id: '1F' }],
    rooms: [
      { id: 'up', floor: '2F' },
      { id: 'down', floor: '1F' },
      { id: 'beside', floor: '1F' },
    ],
    edges: [],
  }
  const edge = (from, to, kind, oneWay = false) => ({ from, to, kind, oneWay, gate: { type: 'open' } })

  it.each([
    ['a drop', edge('up', 'down', 'drop', true), 'hole'],
    ['two-way stairs', edge('up', 'down', 'stairs'), 'stairs_two_way'],
    ['one-way stairs to a lower floor', edge('up', 'down', 'stairs', true), 'stairs_down'],
    ['one-way stairs to a higher floor', edge('down', 'up', 'stairs', true), 'stairs_up'],
    ['a passage between floors', edge('down', 'up', 'passage'), 'stairs_two_way'],
    ['a door on one floor', edge('down', 'beside', 'door'), null],
  ])('picks the icon for %s', (_, e, name) => {
    expect(passageIconName(dungeon, e)).toBe(name)
  })
})

describe('puzzleRooms', () => {
  it('lists the rooms puzzles are solved in, not puzzles on the door itself', () => {
    const edges = [
      { from: 'a', to: 'b', gate: { type: 'puzzle', at: 'b' } },
      { from: 'a', to: 'c', gate: { type: 'puzzle' } },
      { from: 'a', to: 'd', gate: { type: 'puzzle', at: 'zz' } },
      { from: 'a', to: 'e', gate: { type: 'open' } },
    ]
    expect([...puzzleRooms({ edges })]).toEqual(['b'])
  })
})
