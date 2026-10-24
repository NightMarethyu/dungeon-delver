// Roll tables: lists of things a game master can roll on, like treasure or
// wandering enemies. Pure data and pure functions, no React. The authoring
// page (tables.html, dev only) writes the file; a later generator in the
// editor rolls on it. See README.md in this folder for the format.

export const TABLES_VERSION = 1

// What a table is for. The first ones match the room contents and notes a
// table's results would go into; `room` is for room descriptions, `name` for
// names of anything, and `other` is the catch-all.
export const TABLE_CATEGORIES = ['treasure', 'enemy', 'trap', 'puzzle', 'npc', 'room', 'name', 'other']

// Ids are what other tables use to roll on this one: [table-id] in a result.
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// {2d6}, {d20}, {1d4+1}, {3d6*10}, {5}: dice in a result, rolled each time.
const DICE_PATTERN = /^(\d*)d(\d+)(?:([+\-*])(\d+))?$|^(\d+)$/
const INLINE_PATTERN = /\{([^{}]*)\}|\[([^[\]]*)\]/g
// How deep tables may roll on other tables before rolling stops.
const MAX_DEPTH = 10

/**
 * @typedef {{ text: string, weight?: number, tags?: string[] }} TableEntry  `weight` is
 *   how many times more likely than a weight-1 entry; 1 when left out
 * @typedef {{ id: string, name: string, category: string, description?: string, tags?: string[], entries: TableEntry[] }} RollTable
 * @typedef {{ version: number, tables: RollTable[] }} RollTables
 */

/** @returns {RollTables} */
export function emptyTables() {
  return { version: TABLES_VERSION, tables: [] }
}

/** A table id made from its name: "Minor Treasure!" → "minor-treasure". */
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const weightOf = (entry) => entry.weight ?? 1
const isWeight = (w) => Number.isInteger(w) && w >= 1

/** The sum of a table's weights: the die it rolls, like d20 when they add to 20. */
export function totalWeight(table) {
  return table.entries.reduce((sum, entry) => sum + weightOf(entry), 0)
}

/**
 * Each entry's range on the table's die, as the printed table would show it:
 * [{ from: 1, to: 3 }, { from: 4, to: 4 }, ...].
 */
export function entryRanges(table) {
  let next = 1
  return table.entries.map((entry) => {
    const from = next
    next += weightOf(entry)
    return { from, to: next - 1 }
  })
}

/** Parses "2d6+1" into { count, sides, op, by }, or a plain number into { value }. Null when it isn't dice. */
export function parseDice(text) {
  const match = DICE_PATTERN.exec(String(text).replace(/\s+/g, ''))
  if (!match) return null
  if (match[5] !== undefined) return { value: Number(match[5]) }
  const count = match[1] === '' ? 1 : Number(match[1])
  const sides = Number(match[2])
  if (count < 1 || count > 100 || sides < 1) return null
  return { count, sides, op: match[3] ?? null, by: match[4] === undefined ? null : Number(match[4]) }
}

/** Rolls parsed dice. `random` returns a number in [0, 1), like Math.random. */
export function rollDice(dice, random = Math.random) {
  if ('value' in dice) return dice.value
  let total = 0
  for (let i = 0; i < dice.count; i++) total += 1 + Math.floor(random() * dice.sides)
  if (dice.op === '+') return total + dice.by
  if (dice.op === '-') return total - dice.by
  if (dice.op === '*') return total * dice.by
  return total
}

/** The {dice} and [table-id] references in a result's text. */
export function inlineParts(text) {
  const parts = []
  for (const match of String(text).matchAll(INLINE_PATTERN)) {
    if (match[1] !== undefined) parts.push({ kind: 'dice', source: match[1].trim() })
    else parts.push({ kind: 'table', source: match[2].trim() })
  }
  return parts
}

const problem = (severity, code, message, table = null, entry = null) => ({ severity, code, message, table, entry })

/**
 * Finds problems in a tables file. Each is { severity, code, message, table, entry }:
 * `table` is the table's index and `entry` the entry's index, so the page can
 * point at them. 'error' means rolling would go wrong; 'warning' that something
 * looks unfinished.
 */
export function validateTables(data) {
  const problems = []
  if (!data || typeof data !== 'object' || !Array.isArray(data.tables)) {
    return [problem('error', 'notTables', 'This isn\'t a roll tables file: it needs a "tables" list.')]
  }
  if (data.version !== TABLES_VERSION) {
    problems.push(problem('warning', 'unknownVersion', `The file says version ${data.version}; this page writes version ${TABLES_VERSION}.`))
  }
  const ids = new Map()
  data.tables.forEach((table, t) => {
    const label = table.name || table.id || `Table ${t + 1}`
    if (!table.id) problems.push(problem('error', 'missingId', `"${label}" needs an id.`, t))
    else if (!ID_PATTERN.test(table.id)) problems.push(problem('error', 'invalidId', `"${label}" has the id "${table.id}". Use lowercase letters, digits, and dashes.`, t))
    else if (ids.has(table.id)) problems.push(problem('error', 'duplicateId', `Two tables share the id "${table.id}".`, t))
    else ids.set(table.id, t)
    if (!table.name) problems.push(problem('warning', 'missingName', `Table "${table.id || t + 1}" needs a name.`, t))
    if (!TABLE_CATEGORIES.includes(table.category)) {
      problems.push(problem('error', 'unknownCategory', `"${label}" has an unknown category "${table.category}".`, t))
    }
    if (!Array.isArray(table.entries) || table.entries.length === 0) {
      problems.push(problem('warning', 'noEntries', `"${label}" has nothing to roll yet.`, t))
    }
  })
  data.tables.forEach((table, t) => {
    const label = table.name || table.id || `Table ${t + 1}`
    ;(table.entries ?? []).forEach((entry, e) => {
      const where = `"${label}" result ${e + 1}`
      if (!String(entry.text ?? '').trim()) problems.push(problem('error', 'emptyEntry', `${where} has no text.`, t, e))
      if (entry.weight !== undefined && !isWeight(entry.weight)) {
        problems.push(problem('error', 'invalidWeight', `${where} has the weight ${entry.weight}. Use a whole number, 1 or more.`, t, e))
      }
      for (const part of inlineParts(entry.text ?? '')) {
        if (part.kind === 'dice' && !parseDice(part.source)) {
          problems.push(problem('error', 'invalidDice', `${where} has {${part.source}}, which isn't dice like {2d6} or {1d4+1}.`, t, e))
        } else if (part.kind === 'table' && !ids.has(part.source)) {
          problems.push(problem('error', 'unknownTable', `${where} rolls on [${part.source}], but no table has that id.`, t, e))
        }
      }
    })
  })
  for (const cycle of findCycles(data.tables, ids)) {
    problems.push(problem('error', 'tableLoop', `These tables roll on each other in a loop: ${cycle.join(' → ')}.`, ids.get(cycle[0])))
  }
  return problems
}

// Loops of tables rolling on each other, like a → b → a, each as a list of ids.
function findCycles(tables, ids) {
  const refs = new Map(
    tables.filter((table) => ids.get(table.id) !== undefined).map((table) => [
      table.id,
      [...new Set((table.entries ?? []).flatMap((entry) => inlineParts(entry.text ?? '')).filter((p) => p.kind === 'table' && ids.has(p.source)).map((p) => p.source))],
    ]),
  )
  const cycles = []
  const done = new Set()
  const visit = (id, path) => {
    if (path.includes(id)) {
      cycles.push([...path.slice(path.indexOf(id)), id])
      return
    }
    if (done.has(id)) return
    for (const next of refs.get(id) ?? []) visit(next, [...path, id])
    done.add(id)
  }
  for (const id of refs.keys()) visit(id, [])
  return cycles
}

/** Picks one entry of `table` by weight. */
export function pickEntry(table, random = Math.random) {
  const roll = Math.floor(random() * totalWeight(table))
  let seen = 0
  for (const entry of table.entries) {
    seen += weightOf(entry)
    if (roll < seen) return entry
  }
  return table.entries.at(-1)
}

/**
 * Rolls once on the table with `id`: picks an entry, then rolls its {dice}
 * and the [tables] it names. Returns the finished text, or null when there's
 * no such table or it's empty.
 */
export function rollTable(data, id, random = Math.random, depth = 0) {
  const table = data.tables.find((t) => t.id === id)
  if (!table || table.entries.length === 0) return null
  return expand(pickEntry(table, random).text, data, random, depth)
}

function expand(text, data, random, depth) {
  return String(text).replace(INLINE_PATTERN, (whole, dice, tableId) => {
    if (dice !== undefined) {
      const parsed = parseDice(dice)
      return parsed ? String(rollDice(parsed, random)) : whole
    }
    if (depth >= MAX_DEPTH) return '…'
    return rollTable(data, tableId.trim(), random, depth + 1) ?? whole
  })
}

/**
 * Cleans a tables file for saving: trims text, drops empty optional fields
 * and weights of 1, and sorts tables by category, then name.
 */
export function cleanTables(data) {
  const tags = (list) => [...new Set((list ?? []).map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))]
  const tables = data.tables.map((table) => {
    const clean = { id: table.id, name: String(table.name ?? '').trim(), category: table.category }
    const description = String(table.description ?? '').trim()
    if (description) clean.description = description
    if (tags(table.tags).length) clean.tags = tags(table.tags)
    clean.entries = (table.entries ?? [])
      .filter((entry) => String(entry.text ?? '').trim())
      .map((entry) => {
        const out = { text: String(entry.text).trim() }
        if (entry.weight !== undefined && entry.weight !== 1) out.weight = entry.weight
        if (tags(entry.tags).length) out.tags = tags(entry.tags)
        return out
      })
    return clean
  })
  const order = (table) => TABLE_CATEGORIES.indexOf(table.category)
  tables.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name))
  return { version: TABLES_VERSION, tables }
}

/**
 * The tables file as text: indented JSON, with each result on a line of its
 * own so the file stays easy to read and to diff.
 */
export function formatTables(data) {
  const clean = cleanTables(data)
  const lines = ['{', `  "version": ${clean.version},`, '  "tables": [']
  clean.tables.forEach((table, t) => {
    lines.push('    {')
    const { entries, ...fields } = table
    for (const [key, value] of Object.entries(fields)) lines.push(`      ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    if (entries.length === 0) {
      lines.push('      "entries": []')
    } else {
      lines.push('      "entries": [')
      entries.forEach((entry, e) => {
        const body = Object.entries(entry).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(', ')
        lines.push(`        { ${body} }${e < entries.length - 1 ? ',' : ''}`)
      })
      lines.push('      ]')
    }
    lines.push(`    }${t < clean.tables.length - 1 ? ',' : ''}`)
  })
  lines.push('  ]', '}')
  return lines.join('\n') + '\n'
}
