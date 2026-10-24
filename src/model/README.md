# Dungeon format

One format serves every view. The graph editor, the map view, and the solver all read and write the same `Dungeon` object. The solver never reads geometry.

The JSDoc types are in [`dungeon.js`](dungeon.js). Load saved or shared JSON with `loadDungeon` from [`load.js`](load.js), which migrates old versions, fills in defaults, and returns any data problems from [`validate.js`](validate.js).

## Example

```json
{
  "version": 6,
  "name": "Example Dungeon",
  "floors": [{ "id": "1F", "name": "Ground Floor" }],
  "rooms": [
    { "id": "r1", "floor": "1F", "label": "Entrance", "notes": { "description": "A mossy arch.", "traps": "Loose flagstone by the door." }, "contents": [{ "type": "smallKey" }, { "type": "enemy", "name": "2 bats", "emoji": "🦇" }] },
    { "id": "r2", "floor": "1F", "label": "Chest Room", "rect": { "x": 4, "y": 0, "w": 4, "h": 3 }, "player": { "show": ["description", "contents"] }, "contents": [{ "type": "item", "name": "hookshot" }] }
  ],
  "edges": [
    { "id": "e1", "from": "r1", "to": "r2", "kind": "door", "gate": { "type": "smallKey" } }
  ],
  "start": "r1",
  "goal": "r2",
  "sheet": { "keys": "letters", "order": ["r2", "r1"] }
}
```

## Fields

| Field | Meaning | Default when loading |
| --- | --- | --- |
| `version` | Format version. Bump it, and add a migration in `load.js`, whenever the format changes. | Current version, with a warning |
| `name` | Dungeon name. | `"Untitled Dungeon"` |
| `floors[]` | `{ id, name }`, listed from the top floor down. The map uses the order to tell stairs up from stairs down. | `[]` |
| `rooms[]` | `{ id, floor, label, contents, rect? }`. | `label` = `id`, `contents` = `[]` |
| `rooms[].rect` | `{ x, y, w, h }` in grid units. Only the map view uses it. Optional. | Left out |
| `rooms[].graphPos` | `{ x, y }` in pixels. Only the graph editor uses it; rooms without one are laid out on a grid. Optional. Added in version 2. | Left out |
| `rooms[].notes` | The game master's notes: `{ description?, enemies?, traps?, treasure?, secrets?, other? }`, each free text. Not tied to any game system, and the solver ignores them. Empty notes are left out, and so is `notes` when every one is empty. Added in version 4. | Left out; unknown fields and non-text values are dropped |
| `rooms[].player` | What the players' handout shows of the room: `{ hidden?, show? }`. `hidden: true` leaves the room off the handout, map and all. `show` lists the parts it shows, from `contents` and the note fields; without it, only the `description`. Left out when it says nothing beyond the default. Added in version 6. | Left out; unknown parts are dropped |
| `rooms[].contents[]` | What the room holds: `{ type, name?, emoji? }`. See the rules below for the types. | `[]` |
| `rooms[].contents[].emoji` | One emoji (or any single character) shown instead of the content's icon. Optional. Added in version 5. | Left out; kept only when it's a non-empty string, cut to its first character |
| `edges[]` | `{ id, from, to, kind, gate, oneWay }`. | `kind` = `"door"`, `gate` = open, `oneWay` = `false` |
| `start`, `goal` | Room ids. | `null` |
| `sheet` | The notes sheet's settings: `{ keys?, order? }`. `keys` is `"numbers"` (1, 2, 3, the default) or `"letters"` (A, B, C). `order` lists room ids in the order the game master put them; rooms not in it follow, from the entrance outward. Optional. Added in version 6. | Left out; an unknown `keys` is dropped |

## Rules

- **Edges are two-way** unless `oneWay` is `true`, which allows travel `from → to` only.
- **`kind`** is `door`, `stairs`, `drop`, or `passage`. It only affects rendering.
- **Gates:**
  - `open`: always passable.
  - `smallKey`: costs one small key the first time it's opened, from either side. It then stays open. Small keys are interchangeable.
  - `bigKey`: passable while holding the big key. Never used up.
  - `item`: passable while holding the item named by `name`. Never used up.
  - `puzzle`: opened by solving a puzzle in the room named by `at`, which must be one of the edge's two rooms. The player solves it on reaching that room (it costs nothing), and it then stays open from both sides. From the other side it stays shut until then, like a shutter door opened by a switch. With no `at`, the puzzle is on the door itself and can be solved from either side, so it never blocks the player. Added in version 3.
- **Contents** come in two groups:
  - What the solver counts: `smallKey`, `bigKey`, or `item` with a `name`. They're collected on entering the room.
  - What the game master notes: `treasure`, `enemy`, `trap`, `puzzle`, `npc` (shown as "Character"), and `custom`. Each may have a `name` for its detail ("3 goblins"), and `custom` needs one, since the name is all it is. The solver ignores them: they never lock or open anything. A `puzzle` here is only a note; a puzzle that opens a connection is a puzzle gate. Added in version 5.
- Gate and content types are data, not hardcoded rules, so a later TTRPG mode can rename them.

## Data problems

Each problem is `{ severity, code, message, ids }`. `ids` lists the rooms, edges, or floors involved, so the editor can highlight them.

| Code | Severity | When |
| --- | --- | --- |
| `invalidJson`, `notADungeon`, `invalidVersion`, `newerVersion` | error | The input can't be loaded at all (`dungeon` is `null`) |
| `missingStart`, `missingGoal` | error | No start or goal room is set |
| `unknownStart`, `unknownGoal` | error | The start or goal room doesn't exist |
| `missingVersion` | warning | No `version`; read as the current one |
| `duplicateFloorId`, `duplicateRoomId`, `duplicateEdgeId` | warning | Two things share an id |
| `unknownFloor` | warning | A room's floor doesn't exist |
| `invalidRect` | warning | A room's `rect` isn't four numbers with positive size |
| `invalidGraphPos` | warning | A room's `graphPos` isn't two numbers |
| `edgeMissingRoom` | warning | An edge's `from` or `to` room doesn't exist |
| `selfLoop` | warning | An edge connects a room to itself |
| `unknownEdgeKind` | warning | An edge has an unknown `kind` |
| `unknownGateType`, `gateMissingItemName` | warning | An edge's gate is unknown, or an item gate has no item name |
| `puzzleRoomNotOnEdge` | warning | A puzzle gate's `at` names a room the edge doesn't connect; it's read as solvable from either side |
| `unknownContentType`, `contentMissingItemName` | warning | A room holds something unknown, or an item with no name |
| `contentMissingName` | warning | A room holds a custom thing with no name |
