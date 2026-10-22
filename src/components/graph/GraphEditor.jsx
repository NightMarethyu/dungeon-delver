import {
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { addEdge, addRoom, removeEdge, removeRoom, updateRoom } from '../../model/edit.js'
import DungeonEdge from './DungeonEdge.jsx'
import { freePosition } from './layout.js'
import RoomNode from './RoomNode.jsx'
import { useTheme } from '../../theme.js'
import { passageIconName, puzzleRooms } from '../icons/icons.js'

const nodeTypes = { room: RoomNode }
const edgeTypes = { dungeon: DungeonEdge }
// Roughly half a new room's size, so a room added at a point is centered on it.
const HALF_ROOM = { x: 60, y: 22 }
// How far the arrow keys move a room, and with Shift held.
const NUDGE = 20
const BIG_NUDGE = 100
// Two taps closer together than this, in ms, are a double tap.
const DOUBLE_TAP = 350

/**
 * The React Flow canvas. The dungeon is the only source of truth: nodes and
 * edges are rebuilt from it on every change, and every edit goes back through
 * the pure functions in model/edit.js.
 *
 * @param {{
 *   dungeon: import('../../model/dungeon.js').Dungeon,
 *   onChange: (update: (d: import('../../model/dungeon.js').Dungeon) => import('../../model/dungeon.js').Dungeon) => void,
 *   selection: { kind: 'room' | 'edge', id: string } | null,
 *   onSelect: React.Dispatch<React.SetStateAction<{ kind: 'room' | 'edge', id: string } | null>>,
 *   highlights: { rooms: Map<string, string>, edges: Map<string, string> },
 *     a mark per room and a CSS class per connection, from results.js
 *   commands: React.Ref, given the commands the keyboard shortcuts run:
 *     addRoom(), nudge(roomId, dx, dy, shift), floor(step), zoomIn(), zoomOut(), fit()
 * }} props
 */
function Canvas({ dungeon, onChange, selection, onSelect, highlights, commands }) {
  const wrapper = useRef(null)
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow()
  // When the empty canvas was last tapped, to spot a double tap. Touch screens
  // don't reliably report one as a double click.
  const lastPaneClick = useRef(0)
  const theme = useTheme()
  // React Flow measures each node after it renders. Keep those sizes, since
  // nodes rebuilt without them would be measured again from scratch.
  const [sizes, setSizes] = useState({})

  const nodes = useMemo(() => {
    // Only name each room's floor when there's more than one.
    const floorNames = dungeon.floors.length > 1 ? new Map(dungeon.floors.map((f) => [f.id, f.name])) : null
    const puzzles = puzzleRooms(dungeon)
    return dungeon.rooms.map((room) => ({
      id: room.id,
      type: 'room',
      position: room.graphPos ?? { x: 0, y: 0 },
      measured: sizes[room.id],
      selected: selection?.kind === 'room' && selection.id === room.id,
      data: {
        room,
        role: room.id === dungeon.start ? 'start' : room.id === dungeon.goal ? 'goal' : null,
        mark: highlights.rooms.get(room.id) ?? null,
        floorName: floorNames && (floorNames.get(room.floor) ?? room.floor),
        hasPuzzle: puzzles.has(room.id),
        onRename: (label) => onChange((d) => updateRoom(d, room.id, { label })),
      },
    }))
  }, [dungeon, highlights, sizes, selection, onChange])

  const edges = useMemo(
    () =>
      dungeon.edges.map((edge) => ({
        id: edge.id,
        type: 'dungeon',
        source: edge.from,
        target: edge.to,
        selected: selection?.kind === 'edge' && selection.id === edge.id,
        className: `gate-${edge.gate.type} kind-${edge.kind}${highlights.edges.has(edge.id) ? ` ${highlights.edges.get(edge.id)}` : ''}`,
        markerEnd: edge.oneWay ? { type: MarkerType.ArrowClosed, width: 18, height: 18, color: `var(--gate-${edge.gate.type})` } : undefined,
        data: { edge, passage: passageIconName(dungeon, edge) },
      })),
    [dungeon, highlights, selection],
  )

  const handleChanges = useCallback(
    (kind, changes) => {
      // Selection changes come as pairs (deselect the old, select the new) that
      // can arrive in either order, and across the node and edge handlers. So
      // only clear the selection if it's still the thing being deselected.
      const deselect = (id) => onSelect((current) => (current?.kind === kind && current.id === id ? null : current))
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          const { x, y } = change.position
          onChange((d) => updateRoom(d, change.id, { graphPos: { x: Math.round(x), y: Math.round(y) } }))
        } else if (change.type === 'dimensions' && change.dimensions) {
          setSizes((s) => ({ ...s, [change.id]: change.dimensions }))
        } else if (change.type === 'remove') {
          onChange((d) => (kind === 'room' ? removeRoom(d, change.id) : removeEdge(d, change.id)))
          if (kind === 'room') {
            setSizes((s) => {
              const rest = { ...s }
              delete rest[change.id]
              return rest
            })
          }
          deselect(change.id)
        } else if (change.type === 'select') {
          if (change.selected) onSelect({ kind, id: change.id })
          else deselect(change.id)
        }
      }
    },
    [onChange, onSelect],
  )

  const onConnect = useCallback(
    ({ source, target }) => {
      const { dungeon: next, id } = addEdge(dungeon, source, target)
      if (!id) return
      onChange(() => next)
      onSelect({ kind: 'edge', id })
    },
    [dungeon, onChange, onSelect],
  )

  function addRoomAt(point) {
    const graphPos = freePosition({ x: Math.round(point.x - HALF_ROOM.x), y: Math.round(point.y - HALF_ROOM.y) }, dungeon.rooms)
    const { dungeon: next, id } = addRoom(dungeon, { graphPos })
    onChange(() => next)
    onSelect({ kind: 'room', id })
  }

  function addRoomInView() {
    const box = wrapper.current.getBoundingClientRect()
    addRoomAt(screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 }))
  }

  function onPaneClick(event) {
    const double = event.detail === 2 || event.timeStamp - lastPaneClick.current < DOUBLE_TAP
    lastPaneClick.current = double ? 0 : event.timeStamp
    if (double) addRoomAt(screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }

  useImperativeHandle(commands, () => ({
    addRoom: addRoomInView,
    nudge(id, dx, dy, shift) {
      const step = shift ? BIG_NUDGE : NUDGE
      onChange((d) => {
        const { x, y } = d.rooms.find((r) => r.id === id).graphPos ?? { x: 0, y: 0 }
        return updateRoom(d, id, { graphPos: { x: x + dx * step, y: y + dy * step } })
      })
      return true
    },
    // The graph shows every floor at once.
    floor: () => {},
    zoomIn: () => zoomIn(),
    zoomOut: () => zoomOut(),
    fit: () => fitView({ maxZoom: 1 }),
  }))

  return (
    <div className="graph-canvas" ref={wrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={(changes) => handleChanges('room', changes)}
        onEdgesChange={(changes) => handleChanges('edge', changes)}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={40}
        // Delete, like the other shortcuts, is handled by the builder.
        deleteKeyCode={null}
        multiSelectionKeyCode={null}
        selectionKeyCode={null}
        zoomOnDoubleClick={false}
        colorMode={theme}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
        <Panel position="top-left">
          <button type="button" className="primary" onClick={addRoomInView}>
            + Add room
          </button>
        </Panel>
        {dungeon.rooms.length === 0 && (
          <Panel position="top-center" className="canvas-hint">
            Add a room, or double-click empty space, to start your dungeon.
          </Panel>
        )}
      </ReactFlow>
    </div>
  )
}

export default function GraphEditor(props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
