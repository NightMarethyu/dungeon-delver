import { readFile, writeFile } from 'node:fs/promises'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const ROLL_TABLES_FILE = new URL('./src/data/roll-tables.json', import.meta.url)

// The roll tables authoring page (tables.html) reads and saves
// src/data/roll-tables.json through this. Only the dev server has it: the
// build takes index.html alone, so the page and this endpoint never ship.
function rollTablesFile() {
  return {
    name: 'roll-tables-file',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__roll-tables', async (req, res) => {
        try {
          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json')
            res.end(await readFile(ROLL_TABLES_FILE, 'utf8'))
            return
          }
          if (req.method === 'POST') {
            let body = ''
            for await (const chunk of req) body += chunk
            JSON.parse(body)
            await writeFile(ROLL_TABLES_FILE, body)
            res.end('saved')
            return
          }
          res.statusCode = 405
          res.end()
        } catch (error) {
          res.statusCode = 500
          res.end(String(error))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), rollTablesFile()],
  // GitHub Pages serves this project site from /<repo-name>/
  base: '/dungeon-delver/',
})
