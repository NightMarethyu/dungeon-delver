// Finds the critical path: one shortest winning route, room by room. Pure, like
// the rest of the solver.
//
// Unlike explore.js, this follows the player step by step, because contents
// are only collected by walking into a room. A step is
// { room, emptied rooms, opened doors }, and routes are ranked by fewest
// choices (doors opened and one-way edges taken), then fewest rooms walked.

import { inventory, isPassable, needsKey, otherEnd } from './graph.js'

// A small binary heap ordered by [choices, steps].
class Queue {
  items = []
  static less = (a, b) => a.choices < b.choices || (a.choices === b.choices && a.steps < b.steps)

  get size() {
    return this.items.length
  }

  push(item) {
    const { items } = this
    items.push(item)
    let i = items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (!Queue.less(items[i], items[parent])) break
      ;[items[i], items[parent]] = [items[parent], items[i]]
      i = parent
    }
  }

  pop() {
    const { items } = this
    const top = items[0]
    const last = items.pop()
    if (items.length > 0) {
      items[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let best = i
        if (l < items.length && Queue.less(items[l], items[best])) best = l
        if (r < items.length && Queue.less(items[r], items[best])) best = r
        if (best === i) break
        ;[items[i], items[best]] = [items[best], items[i]]
        i = best
      }
    }
    return top
  }
}

const sortedKey = (set) => [...set].sort().join(',')

/** @returns {string[] | null} room ids from start to goal, or null if none was found */
export function criticalPath(graph, { maxSteps }) {
  // Only rooms with something in them change what the player holds.
  const hasContents = (room) => graph.contents.get(room).length > 0
  const keyOf = (s) => `${s.room}|${sortedKey(s.collected)}|${sortedKey(s.opened)}`

  const start = {
    room: graph.start,
    collected: new Set(hasContents(graph.start) ? [graph.start] : []),
    opened: new Set(),
    choices: 0,
    steps: 0,
    prev: null,
  }
  const queue = new Queue()
  queue.push(start)
  const done = new Set()

  while (queue.size > 0) {
    const step = queue.pop()
    const key = keyOf(step)
    if (done.has(key)) continue
    done.add(key)
    if (step.room === graph.goal) {
      const route = []
      for (let s = step; s; s = s.prev) route.push(s.room)
      return route.reverse()
    }
    if (done.size >= maxSteps) return null

    const inv = inventory(graph, step.collected, step.opened)
    const moves = [
      ...graph.twoWay.get(step.room).map((edge) => [edge, otherEnd(edge, step.room)]),
      ...graph.oneWay.get(step.room).map((edge) => [edge, edge.to]),
    ]
    for (const [edge, next] of moves) {
      const costsKey = needsKey(edge, step.opened)
      if (costsKey ? inv.keys <= 0 : !isPassable(edge, inv, step.opened)) continue
      const collected = hasContents(next) && !step.collected.has(next) ? new Set([...step.collected, next]) : step.collected
      const opened = costsKey ? new Set([...step.opened, edge.id]) : step.opened
      queue.push({
        room: next,
        collected,
        opened,
        choices: step.choices + (costsKey || edge.oneWay ? 1 : 0),
        steps: step.steps + 1,
        prev: step,
      })
    }
  }
  return null
}
