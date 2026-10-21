// Steps through one sequence of choices, for softlock playback. Pure, like the
// rest of the solver.
//
// Each step is where the player stands after a choice: the region they can
// walk freely, the key doors opened so far, and what they hold. Step 0 is the
// start, before any choice.

import { freeClosure } from './explore.js'
import { buildGraph, needsKey } from './graph.js'

/**
 * @param {import('../model/dungeon.js').Dungeon} dungeon
 * @param {{ type: 'openDoor' | 'oneWay', edge: string }[]} choices as in a
 *   softlock from solve()
 * @returns {{ choice: object | null, region: string[], opened: string[], keys: number, bigKey: boolean, items: string[] }[]}
 *   one step per choice, plus the start. Stops early at a choice that names a
 *   connection that no longer exists.
 */
export function replay(dungeon, choices) {
  const graph = buildGraph(dungeon)
  const edges = new Map(dungeon.edges.map((e) => [e.id, e]))
  const step = (choice, anchor, opened, collected) => {
    const { region, collected: emptied, inv } = freeClosure(graph, anchor, opened, collected)
    return {
      choice,
      region: [...region],
      opened: [...opened],
      keys: inv.keys,
      bigKey: inv.bigKey,
      items: [...inv.items],
      state: { region, opened, collected: emptied },
    }
  }

  const steps = [step(null, dungeon.start, new Set(), new Set())]
  for (const choice of choices) {
    const edge = edges.get(choice.edge)
    if (!edge) break
    const { region, opened, collected } = steps.at(-1).state
    const nextOpened = needsKey(edge, opened) ? new Set([...opened, edge.id]) : opened
    const anchor = choice.type === 'oneWay' ? edge.to : [...region][0]
    steps.push(step(choice, anchor, nextOpened, collected))
  }
  return steps.map(({ state: _state, ...rest }) => rest)
}
