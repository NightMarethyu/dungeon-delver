// The roll tables authoring page. Dev only (tables.html, `npm run tables`):
// it reads and saves src/data/roll-tables.json through the dev server, and
// can download the same file. The format is in src/tables/README.md.

import { useEffect, useMemo, useRef, useState } from 'react'
import ThemeToggle from '../../components/ThemeToggle.jsx'
import {
  TABLE_CATEGORIES,
  emptyTables,
  entryRanges,
  formatTables,
  rollTable,
  slugify,
  totalWeight,
  validateTables,
} from '../../tables/rollTables.js'

const FILE_URL = '/__roll-tables'
const FILE_NAME = 'roll-tables.json'
const DRAFT_KEY = 'dungeon-delver:roll-tables-draft'

const CATEGORY_LABELS = {
  treasure: 'Treasure',
  enemy: 'Enemies',
  trap: 'Traps',
  puzzle: 'Puzzles',
  npc: 'Characters',
  room: 'Room descriptions',
  name: 'Names',
  other: 'Other',
}

const readDraft = () => {
  try {
    const text = window.localStorage.getItem(DRAFT_KEY)
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

const writeDraft = (data) => {
  try {
    if (data) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
    else window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    // No storage: the draft just isn't kept between visits.
  }
}

const splitTags = (text) => text.split(',').map((tag) => tag.trim()).filter(Boolean)
const joinTags = (tags) => (tags ?? []).join(', ')

// "3 | text" gives a weight of 3; a line with no "|" has weight 1.
function parseBulk(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(\d+)\s*\|\s*(.+)$/.exec(line)
      return match ? { text: match[2], weight: Number(match[1]) } : { text: line }
    })
}

const uniqueId = (base, tables, except) => {
  const taken = new Set(tables.filter((t) => t !== except).map((t) => t.id))
  let id = base || 'table'
  for (let n = 2; taken.has(id); n++) id = `${base || 'table'}-${n}`
  return id
}

function download(text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: FILE_NAME })
  link.click()
  URL.revokeObjectURL(url)
}

function Problems({ problems, onPick }) {
  if (problems.length === 0) return <p className="rt-ok">No problems.</p>
  return (
    <ul className="rt-problems">
      {problems.map((p, i) => (
        <li key={i} className={p.severity}>
          {p.table === null ? (
            p.message
          ) : (
            <button type="button" className="link" onClick={() => onPick(p.table)}>
              {p.message}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function EntryRow({ entry, range, problem, onChange, onRemove, onMove, onEnter, autoFocus }) {
  return (
    <li className={problem ? 'rt-entry has-problem' : 'rt-entry'} title={problem?.message}>
      <span className="rt-range">{range.from === range.to ? range.from : `${range.from}–${range.to}`}</span>
      <input
        className="rt-weight"
        type="number"
        min="1"
        step="1"
        value={entry.weight ?? 1}
        onChange={(e) => onChange({ ...entry, weight: e.target.value === '' ? 1 : Number(e.target.value) })}
        aria-label="Weight"
      />
      <input
        className="rt-text"
        value={entry.text}
        autoFocus={autoFocus}
        placeholder="What the roll gives, like {2d6} coins or [gem-table]"
        onChange={(e) => onChange({ ...entry, text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onEnter()
          }
        }}
        aria-label="Result"
      />
      <input
        className="rt-tags"
        value={joinTags(entry.tags)}
        placeholder="tags"
        onChange={(e) => onChange({ ...entry, tags: splitTags(e.target.value) })}
        aria-label="Tags, separated by commas"
      />
      <span className="rt-row-buttons">
        <button type="button" onClick={() => onMove(-1)} aria-label="Move up">↑</button>
        <button type="button" onClick={() => onMove(1)} aria-label="Move down">↓</button>
        <button type="button" className="danger" onClick={onRemove} aria-label="Remove result">✕</button>
      </span>
    </li>
  )
}

function TableForm({ data, index, problems, onChange, onDelete }) {
  const table = data.tables[index]
  const [bulk, setBulk] = useState('')
  const [rolls, setRolls] = useState([])
  const [focusRow, setFocusRow] = useState(null)

  const ranges = entryRanges(table)
  const total = totalWeight(table)
  const entryProblem = (e) => problems.find((p) => p.table === index && p.entry === e)
  const update = (changes) => onChange({ ...table, ...changes })
  const setEntries = (entries) => update({ entries })
  const insertAt = (at, entry = { text: '' }) => {
    setEntries([...table.entries.slice(0, at), entry, ...table.entries.slice(at)])
    setFocusRow(at)
  }
  const move = (e, by) => {
    const to = e + by
    if (to < 0 || to >= table.entries.length) return
    const entries = [...table.entries]
    ;[entries[e], entries[to]] = [entries[to], entries[e]]
    setEntries(entries)
  }

  return (
    <section className="rt-form">
      <div className="rt-fields">
        <label>
          Name
          <input
            value={table.name}
            onChange={(e) => {
              const name = e.target.value
              // A new table's id follows its name until the id is typed in. An
              // existing one keeps its id, since other tables may roll on it.
              update(table.autoId ? { name, id: uniqueId(slugify(name), data.tables, table) } : { name })
            }}
            placeholder="Minor treasure"
          />
        </label>
        <label>
          Id <span className="muted">(other tables roll on it with [{table.id || 'id'}])</span>
          <input
            value={table.id}
            onChange={(e) => update({ id: e.target.value, autoId: false })}
          />
        </label>
        <label>
          Category
          <select value={table.category} onChange={(e) => update({ category: e.target.value })}>
            {TABLE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tags <span className="muted">(comma separated, like a theme or depth)</span>
          <input value={joinTags(table.tags)} onChange={(e) => update({ tags: splitTags(e.target.value) })} />
        </label>
        <label className="wide">
          Description <span className="muted">(for you; optional)</span>
          <input value={table.description ?? ''} onChange={(e) => update({ description: e.target.value })} />
        </label>
      </div>

      <div className="rt-entries-head">
        <h2>
          Results <span className="muted">· roll d{total || '—'}</span>
        </h2>
        <span className="muted">Weight = how many numbers on the die it covers.</span>
      </div>
      <ol className="rt-entries">
        {table.entries.map((entry, e) => (
          <EntryRow
            key={e}
            entry={entry}
            range={ranges[e]}
            problem={entryProblem(e)}
            autoFocus={focusRow === e}
            onChange={(next) => setEntries(table.entries.map((x, i) => (i === e ? next : x)))}
            onRemove={() => setEntries(table.entries.filter((_, i) => i !== e))}
            onMove={(by) => move(e, by)}
            onEnter={() => insertAt(e + 1)}
          />
        ))}
      </ol>
      <button type="button" onClick={() => insertAt(table.entries.length)}>
        + Add result
      </button>

      <details className="rt-bulk">
        <summary>Paste many results</summary>
        <p className="muted">One result per line. Start a line with a number and a bar, like <code>3 | A rusty sword</code>, to give it that weight.</p>
        <textarea rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <button
          type="button"
          disabled={!bulk.trim()}
          onClick={() => {
            setEntries([...table.entries.filter((x) => x.text.trim()), ...parseBulk(bulk)])
            setBulk('')
          }}
        >
          Add these
        </button>
      </details>

      <div className="rt-try">
        <button type="button" className="primary" disabled={!table.entries.length} onClick={() => setRolls(Array.from({ length: 5 }, () => rollTable(data, table.id)))}>
          Roll 5 times
        </button>
        {rolls.length > 0 && (
          <ol className="rt-rolls">
            {rolls.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        )}
      </div>

      <button type="button" className="danger rt-delete" onClick={onDelete}>
        Delete this table
      </button>
    </section>
  )
}

export default function TablesEditor() {
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState(0)
  const [savedText, setSavedText] = useState(null)
  const [status, setStatus] = useState('')
  const [draft, setDraft] = useState(null)
  const [filter, setFilter] = useState('')
  const fileInput = useRef(null)

  useEffect(() => {
    fetch(FILE_URL)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .catch(() => {
        setStatus(`Couldn't read src/data/${FILE_NAME}; starting empty.`)
        return emptyTables()
      })
      .then((file) => {
        setData(file)
        setSavedText(formatTables(file))
        const old = readDraft()
        if (old && formatTables(old) !== formatTables(file)) setDraft(old)
        else writeDraft(null)
      })
  }, [])

  const text = useMemo(() => (data ? formatTables(data) : ''), [data])
  const problems = useMemo(() => (data ? validateTables(data) : []), [data])
  const dirty = data !== null && text !== savedText
  useEffect(() => {
    if (draft) return
    writeDraft(dirty ? data : null)
  }, [data, dirty, draft])
  useEffect(() => {
    const warn = (e) => dirty && e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (!data) return <p className="rt-loading">Loading…</p>

  const tables = data.tables
  const setTables = (next) => setData({ ...data, tables: next })
  const addTable = () => {
    const table = { id: uniqueId('new-table', tables), name: '', category: 'treasure', entries: [{ text: '' }], autoId: true }
    setTables([...tables, table])
    setSelected(tables.length)
  }
  const errors = problems.filter((p) => p.severity === 'error').length

  const save = async () => {
    try {
      const res = await fetch(FILE_URL, { method: 'POST', body: text })
      if (!res.ok) throw new Error(await res.text())
      setSavedText(text)
      setStatus(`Saved to src/data/${FILE_NAME}.`)
    } catch (error) {
      setStatus(`Couldn't save: ${error.message}. Download the file instead.`)
    }
  }

  const open = async (file) => {
    try {
      const parsed = JSON.parse(await file.text())
      if (validateTables(parsed).some((p) => p.code === 'notTables')) throw new Error('it has no "tables" list')
      setData(parsed)
      setSelected(0)
      setStatus(`Opened ${file.name}. Save to put it in the project.`)
    } catch (error) {
      setStatus(`Couldn't open ${file.name}: ${error.message}.`)
    }
  }

  const query = filter.trim().toLowerCase()
  const shown = tables
    .map((table, i) => ({ table, i }))
    .filter(({ table }) => !query || [table.name, table.id, ...(table.tags ?? [])].some((s) => s?.toLowerCase().includes(query)))

  return (
    <div className="rt-page">
      <header className="rt-header">
        <div>
          <h1>Roll tables</h1>
          <p className="muted">
            Dev only. Edits <code>src/data/{FILE_NAME}</code>
            {dirty ? ' · unsaved changes' : ''}
          </p>
        </div>
        <div className="rt-actions">
          <button type="button" className="primary" onClick={save} disabled={!dirty}>
            Save to project
          </button>
          <button type="button" onClick={() => download(text)}>
            Download JSON
          </button>
          <button type="button" onClick={() => fileInput.current.click()}>
            Open file…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              if (e.target.files[0]) open(e.target.files[0])
              e.target.value = ''
            }}
          />
          <ThemeToggle />
        </div>
      </header>
      {status && <p className="rt-status">{status}</p>}
      {draft && (
        <div className="rt-draft">
          You have unsaved changes from last time.
          <button
            type="button"
            onClick={() => {
              setData(draft)
              setDraft(null)
            }}
          >
            Bring them back
          </button>
          <button
            type="button"
            onClick={() => {
              writeDraft(null)
              setDraft(null)
            }}
          >
            Discard them
          </button>
        </div>
      )}

      <div className="rt-body">
        <nav className="rt-list">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a table" aria-label="Find a table" />
          {TABLE_CATEGORIES.map((category) => {
            const inCategory = shown.filter(({ table }) => table.category === category)
            if (inCategory.length === 0) return null
            return (
              <div key={category}>
                <h3>{CATEGORY_LABELS[category]}</h3>
                <ul>
                  {inCategory.map(({ table, i }) => (
                    <li key={i}>
                      <button type="button" className={i === selected ? 'selected' : ''} onClick={() => setSelected(i)}>
                        {table.name || <em>Unnamed</em>}
                        <span className="muted"> · {table.entries.length}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          {shown.some(({ table }) => !TABLE_CATEGORIES.includes(table.category)) && (
            <div>
              <h3>Unknown category</h3>
              <ul>
                {shown
                  .filter(({ table }) => !TABLE_CATEGORIES.includes(table.category))
                  .map(({ table, i }) => (
                    <li key={i}>
                      <button type="button" className={i === selected ? 'selected' : ''} onClick={() => setSelected(i)}>
                        {table.name || table.id}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <button type="button" className="primary" onClick={addTable}>
            + New table
          </button>
        </nav>

        <main>
          {tables[selected] ? (
            <TableForm
              key={selected}
              data={data}
              index={selected}
              problems={problems}
              onChange={(table) => setTables(tables.map((t, i) => (i === selected ? table : t)))}
              onDelete={() => {
                if (!window.confirm(`Delete "${tables[selected].name || tables[selected].id}"?`)) return
                setTables(tables.filter((_, i) => i !== selected))
                setSelected(0)
              }}
            />
          ) : (
            <p className="muted">No tables yet. Make one with “New table”.</p>
          )}
        </main>

        <aside className="rt-side">
          <h2>
            Problems{' '}
            <span className="muted">
              · {errors} {errors === 1 ? 'error' : 'errors'}
            </span>
          </h2>
          <Problems problems={problems} onPick={setSelected} />
          <h2>Writing results</h2>
          <ul className="rt-help">
            <li>
              <code>{'{2d6}'}</code> rolls dice in the text. Also <code>{'{d20}'}</code>, <code>{'{1d4+1}'}</code>, <code>{'{3d6*10}'}</code>.
            </li>
            <li>
              <code>[table-id]</code> rolls on another table and puts its result in.
            </li>
            <li>Press Enter in a result to add the next one.</li>
          </ul>
        </aside>
      </div>
    </div>
  )
}
