// Display names for the dungeon format's types. Kept in one place so a later
// TTRPG mode can swap them out. The icons that go with them are in
// icons/icons.js.

export const KIND_LABELS = { door: 'Door', stairs: 'Stairs', drop: 'Drop', passage: 'Passage' }
export const GATE_LABELS = { open: 'Open', smallKey: 'Small key', bigKey: 'Big key', item: 'Needs item', puzzle: 'Puzzle' }
export const CONTENT_LABELS = { smallKey: 'Small key', bigKey: 'Big key', item: 'Item' }

// A room's note fields: the label, and a hint shown in the empty box. Kept
// system-neutral so any game's stats or rules can go in them.
export const NOTE_LABELS = {
  description: { label: 'Description', hint: 'What the players see, hear, and smell when they walk in.' },
  enemies: { label: 'Enemies', hint: 'Who or what is here, how many, and what they do.' },
  traps: { label: 'Traps and hazards', hint: 'What sets it off, what happens, and how to spot or get past it.' },
  treasure: { label: 'Treasure', hint: 'Loot, where it is, and what it is worth.' },
  secrets: { label: 'Hidden details', hint: 'Clues, secret doors, and things only a careful search finds.' },
  other: { label: 'Notes', hint: 'Anything else.' },
}

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
