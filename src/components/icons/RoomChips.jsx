import { NAMED_CONTENT_TYPES } from '../../model/dungeon.js'
import { contentTitle, thingText } from '../labels.js'
import ContentIcon from './ContentIcon.jsx'
import Icon from './Icon.jsx'

const PUZZLE_TITLE = 'Puzzle: solving it here opens a connection'

// A room's contents as chips with their icons, plus a puzzle chip when the
// room holds a puzzle that opens one of its connections. `compact` chips, for
// the map's smaller rooms, show only the icon unless it's an item or a custom
// thing, which are only known by their names.
export default function RoomChips({ room, hasPuzzle, compact = false }) {
  if (room.contents.length === 0 && !hasPuzzle) return null
  const size = compact ? 18 : 14
  return (
    <ul className={`room-contents${compact ? ' compact' : ''}`}>
      {room.contents.map((c, i) => {
        const text = thingText(c)
        const title = contentTitle(c)
        const iconOnly = compact && !NAMED_CONTENT_TYPES.includes(c.type)
        return (
          <li key={i} className={`chip chip-${c.type}${iconOnly ? ' icon-only' : ''}`} title={title !== text || iconOnly ? title : undefined} aria-label={iconOnly ? title : undefined}>
            <ContentIcon content={c} size={size} />
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
