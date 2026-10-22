// Display names for the dungeon format's types. Kept in one place so a later
// TTRPG mode can swap them out. The icons that go with them are in
// icons/icons.js.

export const KIND_LABELS = { door: 'Door', stairs: 'Stairs', drop: 'Drop', passage: 'Passage' }
export const GATE_LABELS = { open: 'Open', smallKey: 'Small key', bigKey: 'Big key', item: 'Needs item', puzzle: 'Puzzle' }
export const CONTENT_LABELS = { smallKey: 'Small key', bigKey: 'Big key', item: 'Item' }

// Tags on a room for its role, and for the solver's highlight where the color
// alone isn't enough.
export const ROLE_TAGS = { start: '▶ Start', goal: '★ Goal' }
export const MARK_TAGS = { optional: 'Optional', unreachable: 'Unreachable', stuck: 'Stuck' }

// Short text for a room's contents or an edge's gate, like "Small key" or
// "hookshot". Open gates have no text.
export function thingText(thing) {
  if (!thing || thing.type === 'open') return ''
  if (thing.type === 'item') return thing.name || 'item?'
  return GATE_LABELS[thing.type] ?? CONTENT_LABELS[thing.type] ?? thing.type
}
