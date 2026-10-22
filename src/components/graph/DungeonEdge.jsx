import { BaseEdge, EdgeLabelRenderer, getStraightPath, useInternalNode } from '@xyflow/react'
import Icon from '../icons/Icon.jsx'
import { gateIconName } from '../icons/icons.js'
import { KIND_LABELS, thingText } from '../labels.js'
import { borderPoint, center } from './layout.js'

function nodeRect(node) {
  const { x, y } = node.internals.positionAbsolute
  return { x, y, w: node.measured.width ?? 0, h: node.measured.height ?? 0 }
}

// A connection drawn as a straight line between the edges of its two rooms,
// whichever handle it was dragged from. Edges in the dungeon format have no
// sides, so the line follows the rooms around as they move.
export default function DungeonEdge({ id, source, target, data, markerEnd, interactionWidth }) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  if (!sourceNode || !targetNode) return null

  const a = nodeRect(sourceNode)
  const b = nodeRect(targetNode)
  const from = borderPoint(a, center(b))
  const to = borderPoint(b, center(a))
  const [path, labelX, labelY] = getStraightPath({ sourceX: from.x, sourceY: from.y, targetX: to.x, targetY: to.y })

  const { edge, passage } = data
  const parts = [edge.kind !== 'door' && KIND_LABELS[edge.kind], thingText(edge.gate)].filter(Boolean)
  const gated = edge.gate.type !== 'open'

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={interactionWidth} />
      {parts.length > 0 && (
        <EdgeLabelRenderer>
          <div
            className={`edge-label gate-${edge.gate.type}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {passage && <Icon name={passage} size={14} />}
            {gated && <Icon name={gateIconName(edge.gate)} size={14} />}
            {parts.join(' · ')}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
