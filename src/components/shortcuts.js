// The builder's keyboard shortcuts: which key does what, for the handler in
// Builder.jsx and for the list in the shortcuts dialog.

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

// Single keys, pressed without Ctrl, Cmd, or Alt. Shift is allowed, since
// some keyboards need it for "?" or "+".
const KEYS = {
  Delete: 'delete',
  Backspace: 'delete',
  Escape: 'escape',
  Enter: 'rename',
  F2: 'rename',
  n: 'addRoom',
  v: 'toggleView',
  s: 'setStart',
  g: 'setGoal',
  '[': 'prevFloor',
  PageUp: 'prevFloor',
  ']': 'nextFloor',
  PageDown: 'nextFloor',
  '+': 'zoomIn',
  '=': 'zoomIn',
  '-': 'zoomOut',
  _: 'zoomOut',
  0: 'fit',
  '?': 'help',
}

/**
 * What a keydown does in the builder: { action } with one of the actions
 * above, 'undo', 'redo', or 'arrow' (with dx, dy, and whether Shift is held),
 * or null if the key isn't a shortcut.
 */
export function shortcutFor(event) {
  const command = event.ctrlKey || event.metaKey
  if (command && !event.altKey) {
    const key = event.key.toLowerCase()
    if (key === 'z') return { action: event.shiftKey ? 'redo' : 'undo' }
    if (key === 'y' && !event.shiftKey) return { action: 'redo' }
    return null
  }
  if (command || event.altKey) return null
  if (ARROWS[event.key]) {
    const [dx, dy] = ARROWS[event.key]
    return { action: 'arrow', dx, dy, shift: event.shiftKey }
  }
  const action = KEYS[event.key] ?? KEYS[event.key.toLowerCase()]
  return action ? { action } : null
}

// Elements where keys belong to the element: typing, or pressing a button.
const TYPING = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

/** Whether a keydown on `target` should be left to it, rather than be a shortcut. */
export function keyBelongsTo(target, shortcut) {
  if (!target || !target.tagName) return false
  if (TYPING.has(target.tagName) || target.isContentEditable) return true
  // Enter on a button or link presses it.
  return shortcut.action === 'rename' && (target.tagName === 'BUTTON' || target.tagName === 'A')
}

/** The list in the shortcuts dialog, as groups of [keys, what they do]. */
export function shortcutList(mac) {
  const mod = mac ? '⌘' : 'Ctrl'
  return [
    {
      title: 'Editing',
      rows: [
        [[mod, 'Z'], 'Undo'],
        [[mod, 'Shift', 'Z'], 'Redo'],
        [['N'], 'Add a room (beside the selected one, on the map)'],
        [['Delete'], 'Delete the selected room or connection'],
        [['Enter'], 'Rename the selected room'],
        [['S'], 'Make the selected room the start'],
        [['G'], 'Make the selected room the goal'],
        [['Esc'], 'Deselect, or stop softlock playback'],
      ],
    },
    {
      title: 'Moving rooms',
      rows: [
        [['←', '↑', '→', '↓'], 'Move the selected room'],
        [['Shift', '←', '↑', '→', '↓'], 'Resize the selected room (map) or move it further (graph)'],
      ],
    },
    {
      title: 'Viewing',
      rows: [
        [['V'], 'Switch between the map and the graph'],
        [['['], 'Previous floor (map)'],
        [[']'], 'Next floor (map)'],
        [['+'], 'Zoom in'],
        [['−'], 'Zoom out'],
        [['0'], 'Fit everything in view'],
        [['←', '→'], 'Step through softlock playback, when nothing is selected'],
        [['?'], 'Show these shortcuts'],
      ],
    },
  ]
}
