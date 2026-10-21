import { describe, expect, it } from 'vitest'
import { loadDungeon } from './load.js'

const base = () => ({
  version: 1,
  floors: [{ id: '1F', name: 'Ground Floor' }],
  rooms: [
    { id: 'a', floor: '1F', label: 'A' },
    { id: 'b', floor: '1F', label: 'B' },
  ],
  edges: [{ id: 'e1', from: 'a', to: 'b' }],
  start: 'a',
  goal: 'b',
})

function problemsFor(change) {
  const raw = base()
  change(raw)
  return loadDungeon(raw).problems.map(({ severity, code, ids }) => ({ severity, code, ids }))
}

describe('validateDungeon', () => {
  it('finds nothing wrong with a valid dungeon', () => {
    expect(problemsFor(() => {})).toEqual([])
  })

  it.each([
    ['a missing start', (d) => delete d.start, { severity: 'error', code: 'missingStart', ids: [] }],
    ['a missing goal', (d) => delete d.goal, { severity: 'error', code: 'missingGoal', ids: [] }],
    ['a start room that does not exist', (d) => (d.start = 'zz'), { severity: 'error', code: 'unknownStart', ids: ['zz'] }],
    ['a goal room that does not exist', (d) => (d.goal = 'zz'), { severity: 'error', code: 'unknownGoal', ids: ['zz'] }],
    ['an edge to a missing room', (d) => (d.edges[0].to = 'zz'), { severity: 'warning', code: 'edgeMissingRoom', ids: ['e1'] }],
    ['a room on a missing floor', (d) => (d.rooms[1].floor = 'B9'), { severity: 'warning', code: 'unknownFloor', ids: ['b'] }],
    ['a duplicate room id', (d) => d.rooms.push({ id: 'b', floor: '1F' }), { severity: 'warning', code: 'duplicateRoomId', ids: ['b'] }],
    ['a duplicate edge id', (d) => d.edges.push({ id: 'e1', from: 'b', to: 'a' }), { severity: 'warning', code: 'duplicateEdgeId', ids: ['e1'] }],
    ['a duplicate floor id', (d) => d.floors.push({ id: '1F', name: 'Again' }), { severity: 'warning', code: 'duplicateFloorId', ids: ['1F'] }],
    ['an edge from a room to itself', (d) => (d.edges[0].to = 'a'), { severity: 'warning', code: 'selfLoop', ids: ['e1'] }],
    ['an unknown edge kind', (d) => (d.edges[0].kind = 'portal'), { severity: 'warning', code: 'unknownEdgeKind', ids: ['e1'] }],
    ['an unknown gate type', (d) => (d.edges[0].gate = { type: 'magic' }), { severity: 'warning', code: 'unknownGateType', ids: ['e1'] }],
    ['an item gate with no item name', (d) => (d.edges[0].gate = { type: 'item' }), { severity: 'warning', code: 'gateMissingItemName', ids: ['e1'] }],
    ['an unknown content type', (d) => (d.rooms[0].contents = [{ type: 'rupee' }]), { severity: 'warning', code: 'unknownContentType', ids: ['a'] }],
    ['an item with no name', (d) => (d.rooms[0].contents = [{ type: 'item' }]), { severity: 'warning', code: 'contentMissingItemName', ids: ['a'] }],
    ['an invalid rect', (d) => (d.rooms[0].rect = { x: 0, y: 0, w: 0, h: 2 }), { severity: 'warning', code: 'invalidRect', ids: ['a'] }],
    ['an invalid graph position', (d) => (d.rooms[0].graphPos = { x: 1, y: 'up' }), { severity: 'warning', code: 'invalidGraphPos', ids: ['a'] }],
  ])('reports %s', (_, change, expected) => {
    expect(problemsFor(change)).toEqual([expected])
  })

  it('gives every problem a readable message', () => {
    const { problems } = loadDungeon({ ...base(), start: null, edges: [{ id: 'e1', from: 'a', to: 'zz' }] })
    expect(problems.length).toBeGreaterThan(0)
    for (const p of problems) expect(p.message).toMatch(/\w/)
  })
})
