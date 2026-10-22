// Display names for the dungeon format's types. Kept in one place so a later
// TTRPG mode can swap them out.

export const KIND_LABELS = { door: 'Door', stairs: 'Stairs', drop: 'Drop', passage: 'Passage' }
export const GATE_LABELS = { open: 'Open', smallKey: 'Small key', bigKey: 'Big key', item: 'Needs item' }
export const CONTENT_LABELS = { smallKey: 'Small key', bigKey: 'Big key', item: 'Item' }

const ICONS = { smallKey: '🔑', bigKey: '🗝️', item: '◆' }

// Short text for a room's contents or an edge's gate, like "🔑 Small key" or
// "◆ hookshot". Open gates have no text.
export function thingText(thing) {
  if (!thing || thing.type === 'open') return ''
  if (thing.type === 'item') return `${ICONS.item} ${thing.name || 'item?'}`
  return `${ICONS[thing.type] ?? ''} ${CONTENT_LABELS[thing.type] ?? thing.type}`.trim()
}

// The icon for a gate, like 🔑 for a small-key door. Open gates have none.
export const gateIcon = (gate) => (gate?.type === 'open' ? '' : ICONS[gate?.type] ?? '')
