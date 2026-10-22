import { thingText } from '../labels.js'
import Icon from './Icon.jsx'
import { contentIconName } from './icons.js'

const PUZZLE_TITLE = 'Puzzle: solving it here opens a connection'

// A room's contents as chips with their icons, plus a puzzle chip when the
// room holds a puzzle that opens one of its connections. `compact` chips, for
// the map's smaller rooms, show only the icon unless it's a named item.
export default function RoomChips({ room, hasPuzzle, compact = false }) {
  if (room.contents.length === 0 && !hasPuzzle) return null
  const size = compact ? 18 : 14
  return (
    <ul className={`room-contents${compact ? ' compact' : ''}`}>
      {room.contents.map((c, i) => {
        const text = thingText(c)
        const iconOnly = compact && c.type !== 'item'
        return (
          <li key={i} className={`chip chip-${c.type}${iconOnly ? ' icon-only' : ''}`} title={iconOnly ? text : undefined} aria-label={iconOnly ? text : undefined}>
            <Icon name={contentIconName(c)} size={size} />
            {!iconOnly && text}
          </li>
        )
      })}
      {hasPuzzle && (
        <li className={`chip chip-puzzle${compact ? ' icon-only' : ''}`} title={PUZZLE_TITLE} aria-label={compact ? PUZZLE_TITLE : undefined}>
          <Icon name="puzzle" size={size} />
          {!compact && 'Puzzle'}
        </li>
      )}
    </ul>
  )
}
