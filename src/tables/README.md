# Roll tables

Roll tables are lists a game master rolls on: treasure, wandering enemies, trap ideas, names. They live in one file, [`src/data/roll-tables.json`](../data/roll-tables.json), and nothing is fetched from anywhere: the site rolls on them in the browser. The functions are in [`rollTables.js`](rollTables.js), pure and tested.

## Writing them

Run `npm run tables` (or `npm run dev` and open `/dungeon-delver/tables.html`). The page reads `src/data/roll-tables.json`, and **Save to project** writes it back, formatted. **Download JSON** gives the same file to put there by hand. The page lists problems as you go and can test-roll any table. Unsaved changes are kept in the browser until you save or discard them.

The page and its save endpoint exist only on the dev server. `npm run build` builds `index.html` alone, so neither ships to GitHub Pages.

## Format

```json
{
  "version": 1,
  "tables": [
    {
      "id": "minor-treasure",
      "name": "Minor treasure",
      "category": "treasure",
      "description": "Loose valuables in early rooms.",
      "tags": ["shallow"],
      "entries": [
        { "text": "{2d6} coins", "weight": 3 },
        { "text": "A gem: [gems]" },
        { "text": "A silver ring", "tags": ["cursed"] }
      ]
    }
  ]
}
```

| Field | Needed? | Meaning |
| --- | --- | --- |
| `version` | yes | Always `1` for now. Bump it, with a migration, if the format changes. |
| `tables[].id` | yes | Lowercase letters, digits, and dashes. Unique. Other tables roll on this one with `[id]`, so changing it breaks them; the page shows where. |
| `tables[].name` | yes | What the game master sees. |
| `tables[].category` | yes | One of `treasure`, `enemy`, `trap`, `puzzle`, `npc`, `room`, `name`, `other`. The first five match room contents, so the editor can offer treasure tables beside treasure, and so on. `room` is for room descriptions, `name` for names, and `other` for helper tables rolled from other tables. |
| `tables[].entries[]` | yes | The results. At least one. |
| `entries[].text` | yes | The result. May hold `{dice}` and `[table-id]` (below). |
| `entries[].weight` | no | A whole number, 1 or more; 1 when left out. An entry with weight 3 is three times as likely as one with weight 1. The weights add up to the table's die: weights summing to 20 make a d20 table, and the page shows each entry's range on it (1–3, 4, 5–6...). |
| `tables[].description` | no | A note for whoever writes the tables. |
| `tables[].tags`, `entries[].tags` | no | Free words, like a theme (`undead`, `swamp`) or depth (`shallow`, `deep`). Saved lowercase. Not used yet; meant for a later filter like "only undead enemies". |

### Inside a result

- `{2d6}` is rolled each time: `{d20}`, `{1d4+1}`, `{1d6-1}`, `{3d6*10}`, or a plain `{5}`.
- `[gems]` rolls on the table with id `gems` and puts its result in. Tables can nest up to 10 deep; a loop (a rolls b, b rolls a) is an error.

## Problems

`validateTables(data)` returns `{ severity, code, message, table, entry }`, where `table` and `entry` are indexes. Errors: `notTables`, `missingId`, `invalidId`, `duplicateId`, `unknownCategory`, `emptyEntry`, `invalidWeight`, `invalidDice`, `unknownTable`, `tableLoop`. Warnings: `unknownVersion`, `missingName`, `noEntries`.
