import Icon from '../icons/Icon.jsx'
import { gateIconName, passageIconName } from '../icons/icons.js'
import { floorLinks, mapConnections } from '../map/doors.js'
import { bounds, CELL } from '../map/grid.js'

// Cells of space around the rooms.
const MARGIN = 0.5
// The map is drawn smaller than the editor's, at most this many pixels per cell.
const MAX_SCALE = 0.9
const DOOR = { length: CELL * 0.7, thickness: 7 }
// The key in each room, and the icons, in map units at a small map's size.
// Bigger maps scale them up, so they stay readable once the map is shrunk to fit.
const KEY_RADIUS = 15
const ICON = 20
const WIDE = 900

/**
 * A floor's rooms as a small, plain map for the notes sheet: the rooms, their
 * doors with the icons of their locks, stairs and holes, and each room's key
 * (1, 2, 3 or A, B, C) in its middle. Click a key to jump to its notes.
 * @param {{ rooms: object[], edges: object[], dungeon: object, keys: Map<string, string>,
 *   active?: string | null, start?: string | null, onPick?: (id: string) => void }} props
 *   `rooms` must all have rects, and only connections between them are drawn. `keys` has every
 *   room on the sheet, on any floor.
 */
export default function SheetMap({ rooms, edges, dungeon, keys, active, start, onPick }) {
  // Stairs and holes only to rooms on the sheet, as the rest may be secret.
  const visible = keys
  const box = bounds(rooms.map((r) => r.rect))
  if (!box) return null
  const width = (box.w + 2 * MARGIN) * CELL
  const height = (box.h + 2 * MARGIN) * CELL
  const scale = Math.max(1, width / WIDE, height / WIDE)
  const links = floorLinks(dungeon, rooms)
  const name = (id) => rooms.find((r) => r.id === id)?.label ?? id

  return (
    <svg
      className="sheet-map"
      viewBox={`${(box.x - MARGIN) * CELL} ${(box.y - MARGIN) * CELL} ${width} ${height}`}
      style={{ width: `min(100%, ${Math.round(width * MAX_SCALE)}px)` }}
      role="img"
      aria-label={`Map of ${rooms.length} room${rooms.length === 1 ? '' : 's'}`}
    >
      {rooms.map((room) => (
        <rect
          key={room.id}
          className={`sheet-map-room${room.id === active ? ' active' : ''}`}
          x={room.rect.x * CELL}
          y={room.rect.y * CELL}
          width={room.rect.w * CELL}
          height={room.rect.h * CELL}
        />
      ))}
      {mapConnections(rooms, edges).map(({ edge, door, line }) => {
        if (door) {
          const vertical = door.vertical
          const x = door.x * CELL
          const y = door.y * CELL
          const w = vertical ? DOOR.thickness : DOOR.length
          const h = vertical ? DOOR.length : DOOR.thickness
          return (
            <g key={edge.id} className={`sheet-map-door gate-${edge.gate.type}`}>
              <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={2} />
              {edge.gate.type !== 'open' && (
                <>
                  <circle className="sheet-map-lock" cx={x} cy={y} r={ICON * scale * 0.62} />
                  <Icon name={gateIconName(edge.gate)} size={ICON * scale} x={x - (ICON * scale) / 2} y={y - (ICON * scale) / 2} />
                </>
              )}
            </g>
          )
        }
        return (
          <line key={edge.id} className="sheet-map-link" x1={line.x1 * CELL} y1={line.y1 * CELL} x2={line.x2 * CELL} y2={line.y2 * CELL} />
        )
      })}
      {rooms.map((room) => {
        const cx = (room.rect.x + room.rect.w / 2) * CELL
        const cy = (room.rect.y + room.rect.h / 2) * CELL
        const r = Math.min(KEY_RADIUS * scale, (Math.min(room.rect.w, room.rect.h) * CELL) / 2 - 2)
        const passages = (links.get(room.id) ?? []).filter((link) => visible.has(link.other))
        const label = `${keys.get(room.id)}: ${name(room.id)}`
        return (
          <g
            key={room.id}
            className={`sheet-map-key${room.id === start ? ' start' : ''}${onPick ? ' pickable' : ''}`}
            onClick={onPick ? () => onPick(room.id) : undefined}
          >
            <title>{label}</title>
            <circle cx={cx} cy={cy} r={r} />
            <text x={cx} y={cy} fontSize={r * 1.15} dominantBaseline="central" textAnchor="middle">
              {keys.get(room.id)}
            </text>
            {passages.slice(0, 2).map((link, i) => {
              const size = ICON * scale
              return (
                <Icon
                  key={link.edge.id}
                  name={passageIconName(dungeon, link.edge)}
                  size={size}
                  x={(room.rect.x + room.rect.w) * CELL - size * (i + 1) - 3}
                  y={(room.rect.y + room.rect.h) * CELL - size - 3}
                />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
