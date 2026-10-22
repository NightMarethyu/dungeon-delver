import { describe, expect, it } from 'vitest'
import { LIMIT, MERGE_WINDOW, record, redo, sameParts, startHistory, undo } from './history.js'

describe('history', () => {
  it('undoes and redoes steps in order', () => {
    let h = startHistory('a')
    h = record(h, 'b', 0)
    h = record(h, 'c', MERGE_WINDOW * 2)
    h = undo(h)
    expect(h.present).toBe('b')
    h = undo(h)
    expect(h.present).toBe('a')
    expect(undo(h)).toBe(h)
    h = redo(redo(h))
    expect(h.present).toBe('c')
    expect(redo(h)).toBe(h)
  })

  it('merges a quick burst of edits into one step', () => {
    let h = startHistory('a')
    h = record(h, 'b', 1000)
    h = record(h, 'c', 1100)
    h = record(h, 'd', 1200)
    expect(undo(h).present).toBe('a')
  })

  it('starts a new step after an undo, however quick', () => {
    let h = record(startHistory('a'), 'b', 0)
    h = record(h, 'c', MERGE_WINDOW * 2)
    h = record(undo(h), 'x', MERGE_WINDOW * 2 + 1)
    expect(h.future).toEqual([])
    expect(undo(h).present).toBe('b')
  })

  it('ignores a change that changes nothing', () => {
    const h = record(startHistory('a'), 'b', 0)
    expect(record(h, 'b', 5000)).toBe(h)
  })

  it('keeps only the last LIMIT steps', () => {
    let h = startHistory(0)
    for (let i = 1; i <= LIMIT + 10; i++) h = record(h, i, i * MERGE_WINDOW * 2)
    expect(h.past).toHaveLength(LIMIT)
    expect(h.past[0]).toBe(10)
  })

  it('keeps edits apart when they may not merge', () => {
    let h = record(startHistory('a'), 'b', 1000)
    h = record(h, 'c', 1100, () => false)
    expect(undo(h).present).toBe('b')
  })
})

describe('sameParts', () => {
  const dungeon = (rooms, edges = []) => ({ rooms: rooms.map((id) => ({ id, label: id })), edges: edges.map((id) => ({ id })) })

  it('matches dungeons that only differ in what their parts say', () => {
    const a = dungeon(['r1', 'r2'], ['e1'])
    expect(sameParts(a, { ...a, rooms: [{ id: 'r1', label: 'Renamed' }, a.rooms[1]] })).toBe(true)
  })

  it('tells apart dungeons with a room or connection added or removed', () => {
    expect(sameParts(dungeon(['r1']), dungeon(['r1', 'r2']))).toBe(false)
    expect(sameParts(dungeon(['r1'], ['e1']), dungeon(['r1']))).toBe(false)
  })
})
