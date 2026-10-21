# Dungeon format

One format serves every view. The graph editor, the map view, and the solver all read and write the same `Dungeon` object. The solver never reads geometry.

The JSDoc types are in [`dungeon.js`](dungeon.js). Load saved or shared JSON with `loadDungeon` from [`load.js`](load.js), which migrates old versions, fills in defaults, and returns any data problems from [`validate.js`](validate.js).

## Example

```json
{
  "version": 1,
  "name": "Example Dungeon",
  "floors": [{ "id": "1F", "name": "Ground Floor" }],
  "rooms": [
    { "id": "r1", "floor": "1F", "label": "Entrance", "contents": [{ "type": "smallKey" }] },
    { "id": "r2", "floor": "1F", "label": "Chest Room", "rect": { "x": 4, "y": 0, "w": 4, "h": 3 }, "contents": [{ "type": "item", "name": "hookshot" }] }
  ],
  "edges": [
    { "id": "e1", "from": "r1", "to": "r2", "kind": "door", "gate": { "type": "smallKey" } }
  ],
  "start": "r1",
  "goal": "r2"
}
```

## Fields

| Field | Meaning | Default when loading |
| --- | --- | --- |
| `version` | Format version. Bump it, and add a migration in `load.js`, whenever the format changes. | Current version, with a warning |
| `name` | Dungeon name. | `"Untitled Dungeon"` |
| `floors[]` | `{ id, name }`. | `[]` |
| `rooms[]` | `{ id, floor, label, contents, rect? }`. | `label` = `id`, `contents` = `[]` |
| `rooms[].rect` | `{ x, y, w, h }` in grid units. Only the map view uses it. Optional. | Left out |
| `edges[]` | `{ id, from, to, kind, gate, oneWay }`. | `kind` = `"door"`, `gate` = open, `oneWay` = `false` |
| `start`, `goal` | Room ids. | `null` |

## Rules

- **Edges are two-way** unless `oneWay` is `true`, which allows travel `from → to` only.
- **`kind`** is `door`, `stairs`, `drop`, or `passage`. It only affects rendering.
- **Gates:**
  - `open`: always passable.
  - `smallKey`: costs one small key the first time it's opened, from either side. It then stays open. Small keys are interchangeable.
  - `bigKey`: passable while holding the big key. Never used up.
  - `item`: passable while holding the item named by `name`. Never used up.
- **Contents** are `smallKey`, `bigKey`, or `item` with a `name`. They're collected on entering the room.
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
| `edgeMissingRoom` | warning | An edge's `from` or `to` room doesn't exist |
| `selfLoop` | warning | An edge connects a room to itself |
| `unknownEdgeKind` | warning | An edge has an unknown `kind` |
| `unknownGateType`, `gateMissingItemName` | warning | An edge's gate is unknown, or an item gate has no item name |
| `unknownContentType`, `contentMissingItemName` | warning | A room holds something unknown, or an item with no name |
