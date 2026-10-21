// Finds data problems in a loaded dungeon. Pure, like the rest of the model.
//
// Each problem is { severity, code, message, ids }:
// - severity 'error' means the solver can't give a meaningful answer
//   (no start or goal); 'warning' means something is off but the rest of the
//   dungeon can still be checked.
// - code is a stable string for tests and for the UI to key on.
// - ids are the rooms, edges, or floors the problem is about, so the editor can
//   highlight them.

import { CONTENT_TYPES, EDGE_KINDS, GATE_TYPES } from './dungeon.js'

const problem = (severity, code, message, ids = []) => ({ severity, code, message, ids })

function findDuplicates(items, code, noun, problems) {
  const seen = new Set()
  for (const { id } of items) {
    if (seen.has(id)) problems.push(problem('warning', code, `Two ${noun}s share the id "${id}".`, [id]))
    seen.add(id)
  }
}

function checkNamed(thing, types, where, codePrefix, problems, ids) {
  if (!thing || !types.includes(thing.type)) {
    problems.push(problem('warning', `unknown${codePrefix}Type`, `${where} has an unknown type "${thing?.type}".`, ids))
  } else if (thing.type === 'item' && !thing.name) {
    problems.push(problem('warning', `${codePrefix.toLowerCase()}MissingItemName`, `${where} needs an item name.`, ids))
  }
}

function isValidRect(rect) {
  return ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(rect[k])) && rect.w > 0 && rect.h > 0
}

function isValidPoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y)
}

/** @param {import('./dungeon.js').Dungeon} dungeon */
export function validateDungeon(dungeon) {
  const problems = []
  const floorIds = new Set(dungeon.floors.map((f) => f.id))
  const roomIds = new Set(dungeon.rooms.map((r) => r.id))

  findDuplicates(dungeon.floors, 'duplicateFloorId', 'floor', problems)
  findDuplicates(dungeon.rooms, 'duplicateRoomId', 'room', problems)
  findDuplicates(dungeon.edges, 'duplicateEdgeId', 'connection', problems)

  for (const [field, noun] of [['start', 'Start'], ['goal', 'Goal']]) {
    const id = dungeon[field]
    if (id == null) {
      problems.push(problem('error', `missing${noun}`, `No ${field} room is set.`))
    } else if (!roomIds.has(id)) {
      problems.push(problem('error', `unknown${noun}`, `The ${field} room "${id}" doesn't exist.`, [id]))
    }
  }

  for (const room of dungeon.rooms) {
    const where = `Room "${room.label}"`
    if (!floorIds.has(room.floor)) {
      problems.push(problem('warning', 'unknownFloor', `${where} is on a floor that doesn't exist ("${room.floor}").`, [room.id]))
    }
    if (room.rect !== undefined && !isValidRect(room.rect)) {
      problems.push(problem('warning', 'invalidRect', `${where} has an invalid map rectangle.`, [room.id]))
    }
    if (room.graphPos !== undefined && !isValidPoint(room.graphPos)) {
      problems.push(problem('warning', 'invalidGraphPos', `${where} has an invalid graph position.`, [room.id]))
    }
    for (const content of room.contents) {
      checkNamed(content, CONTENT_TYPES, `Something in ${where.toLowerCase()}`, 'Content', problems, [room.id])
    }
  }

  for (const edge of dungeon.edges) {
    const where = `Connection "${edge.id}"`
    for (const end of ['from', 'to']) {
      if (!roomIds.has(edge[end])) {
        problems.push(problem('warning', 'edgeMissingRoom', `${where} leads to a room that doesn't exist ("${edge[end]}").`, [edge.id]))
      }
    }
    if (edge.from === edge.to) {
      problems.push(problem('warning', 'selfLoop', `${where} connects a room to itself.`, [edge.id]))
    }
    if (!EDGE_KINDS.includes(edge.kind)) {
      problems.push(problem('warning', 'unknownEdgeKind', `${where} has an unknown kind "${edge.kind}".`, [edge.id]))
    }
    checkNamed(edge.gate, GATE_TYPES, where, 'Gate', problems, [edge.id])
  }

  return problems
}
