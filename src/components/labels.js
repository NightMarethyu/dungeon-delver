// Display names for the dungeon format's types. Kept in one place so a later
// TTRPG mode can swap them out. The icons that go with them are in
// icons/icons.js.

export const KIND_LABELS = { door: 'Door', stairs: 'Stairs', drop: 'Drop', passage: 'Passage' }
export const GATE_LABELS = { open: 'Open', smallKey: 'Small key', bigKey: 'Big key', item: 'Needs item', puzzle: 'Puzzle' }
export const CONTENT_LABELS = {
  smallKey: 'Small key',
  bigKey: 'Big key',
  item: 'Item',
  treasure: 'Treasure',
  enemy: 'Enemy',
  trap: 'Trap',
  puzzle: 'Puzzle',
  npc: 'Character',
  custom: 'Custom',
}
// Hints for a content's name box. An item's name must match the gate it
// opens; for the rest it's whatever the game master wants to see.
export const CONTENT_NAME_HINTS = {
  item: 'e.g. hookshot',
  treasure: 'e.g. 50 gold',
  enemy: 'e.g. 3 goblins',
  trap: 'e.g. pit trap',
  puzzle: 'e.g. statue riddle',
  npc: 'e.g. the ferryman',
  custom: 'Name it, e.g. altar',
}

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

// Who a notes sheet is for: the game master's full notes, or the players' handout.
export const AUDIENCES = { gm: 'Game master', players: 'Players' }

// Tags on a room for its role, and for the solver's highlight where the color
// alone isn't enough.
export const ROLE_TAGS = { start: '▶ Start', goal: '★ Goal' }
export const MARK_TAGS = { optional: 'Optional', unreachable: 'Unreachable', stuck: 'Stuck' }

// Short text for a room's contents or an edge's gate, like "Small key",
// "hookshot", or "3 goblins". Open gates have no text.
export function thingText(thing) {
  if (!thing || thing.type === 'open') return ''
  if (thing.type === 'item') return thing.name || 'item?'
  if (thing.type === 'custom') return thing.name || 'custom?'
  if (thing.name) return thing.name
  return GATE_LABELS[thing.type] ?? CONTENT_LABELS[thing.type] ?? thing.type
}

// A room content's full description for a tooltip, like "Enemy: 3 goblins".
export function contentTitle(content) {
  const label = CONTENT_LABELS[content.type] ?? content.type
  if (content.type === 'custom') return thingText(content)
  return content.name ? `${label}: ${content.name}` : label
}
