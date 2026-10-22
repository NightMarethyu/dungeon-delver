// JSON export and import, for backups and for moving dungeons between browsers.
// The file is the dungeon itself, in the same format the solver fixtures use,
// so importing is just loadDungeon on the file's text.

/** The dungeon as pretty-printed JSON, ready to save as a file. */
export function exportJson(dungeon) {
  return `${JSON.stringify(dungeon, null, 2)}\n`
}

/** A file name for the dungeon, from its name: "Forest Hollow" → "forest-hollow.json". */
export function exportFileName(dungeon) {
  const slug = (dungeon.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'dungeon'}.json`
}

/** Starts a download of `text` as a file. Browser only. */
export function downloadText(fileName, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
