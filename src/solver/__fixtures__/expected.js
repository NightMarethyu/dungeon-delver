// What the solver should report for each fixture. Phase 1's solver tests run
// every fixture against these.
//
// - softlocks: one entry per softlock, as the choices that lead to it, in
//   order. A choice is the id of a small-key door the player opens or a
//   one-way edge they take. Only the first choice that makes the goal
//   unreachable counts, not every dead state after it.
// - unreachableRooms, optionalRooms: room ids in any order.
// - criticalPath: the rooms walked on one shortest winning route, in order. A
//   room appears again when the route backtracks through it. null when the
//   dungeon can't be beaten.

export const EXPECTED = {
  trivial: {
    beatable: true,
    softlocks: [],
    unreachableRooms: [],
    optionalRooms: [],
    criticalPath: ['start', 'goal'],
  },
  // Spending the only key on the dead end strands the player.
  'key-softlock': {
    beatable: true,
    softlocks: [['toDead']],
    unreachableRooms: [],
    optionalRooms: ['dead'],
    criticalPath: ['start', 'keyRoom', 'goal'],
  },
  // Taking the drop into the pit strands the player.
  'one-way-trap': {
    beatable: true,
    softlocks: [['drop']],
    unreachableRooms: [],
    optionalRooms: ['pit'],
    criticalPath: ['start', 'hub', 'goal'],
  },
  // The big key is behind a big-key door, so nothing past the entrance opens.
  unbeatable: {
    beatable: false,
    softlocks: [],
    unreachableRooms: ['bigChest', 'goal'],
    optionalRooms: [],
    criticalPath: null,
  },
  'two-floor': {
    beatable: true,
    softlocks: [],
    unreachableRooms: [],
    optionalRooms: [],
    criticalPath: ['start', 'upStairs', 'downStairs', 'goal'],
  },
  // The hookshot is behind a key door, and the boss needs the hookshot.
  'item-gate': {
    beatable: true,
    softlocks: [],
    unreachableRooms: [],
    optionalRooms: [],
    criticalPath: ['start', 'hub', 'chest', 'hub', 'goal'],
  },
  'optional-rooms': {
    beatable: true,
    softlocks: [],
    unreachableRooms: [],
    optionalRooms: ['rupees'],
    criticalPath: ['start', 'goal'],
  },
  // Four keys for two doors: no order of choices can strand the player.
  'key-surplus': {
    beatable: true,
    softlocks: [],
    unreachableRooms: [],
    optionalRooms: ['closet'],
    criticalPath: ['start', 'mid', 'goal'],
  },
}
