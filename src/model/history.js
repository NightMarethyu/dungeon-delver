// Undo and redo for the editor: the dungeons before and after the one on
// screen. Edits that come in a quick burst (dragging a room in the graph,
// typing a name) count as one step, so one undo takes back the whole burst.
// Adding or removing a room or connection is always a step of its own.

// Edits closer together than this, in ms, join the step before them.
export const MERGE_WINDOW = 600
// How many steps back undo can go.
export const LIMIT = 100

/** A history with nothing to undo or redo. */
export const startHistory = (present) => ({ past: [], present, future: [], at: -Infinity })

/** Whether two dungeons have the same rooms and connections, edited or not. */
export function sameParts(a, b) {
  const ids = (list) => list.map((x) => x.id).join(' ')
  return ids(a.rooms) === ids(b.rooms) && ids(a.edges) === ids(b.edges)
}

/**
 * Moves the history on to `next`, made at time `now` (ms). It joins the step
 * before it if that was moments ago and `mergeable` says the two can join.
 * Anything that could be redone is dropped, as it would be in any editor.
 */
export function record(history, next, now, mergeable = () => true) {
  if (next === history.present) return history
  const merge = now - history.at < MERGE_WINDOW && mergeable(history.present, next)
  return {
    past: merge ? history.past : [...history.past, history.present].slice(-LIMIT),
    present: next,
    future: [],
    at: now,
  }
}

/** Goes back a step, if there is one. The next edit starts a new step. */
export function undo(history) {
  if (history.past.length === 0) return history
  return { past: history.past.slice(0, -1), present: history.past.at(-1), future: [history.present, ...history.future], at: -Infinity }
}

/** Goes forward a step that was undone, if there is one. */
export function redo(history) {
  if (history.future.length === 0) return history
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1), at: -Infinity }
}
