# Dungeon Delver

Exploring custom Zelda dungeons and whether they would work.

Sketch how a dungeon's rooms connect and what locks each connection (small keys, the big key, items like the hookshot, one-way drops). Dungeon Delver tells you whether the dungeon can be beaten, how a player could softlock, which rooms are optional, and what the critical path is.

It's a static site, hosted on GitHub Pages, with no accounts and no server. Version 0.1 is the graph editor; the map view is in progress.

![The landing page, with saved dungeons and examples](docs/screenshots/landing-page.png)

## Features

- **Build a dungeon as a graph.** Add, rename, move, and delete rooms, and drag between them to connect them. The side panel edits a room's contents (small keys, the big key, named items) or a connection's lock and kind (door, stairs, drop, passage, one-way). Pick the start and goal rooms, and sort rooms into floors.
- **Lay it out as a map.** Switch the builder from Graph to Map to see one floor at a time, with rooms as rectangles on a snap grid. Drag rooms to move them, drag a corner to resize, and double-click the grid to add a room. Rooms that have never been on the map are placed automatically, roughly where they sit in the graph. Connections and solver highlights on the map are still to come.
- **Light and dark themes.** The site follows your system setting until you pick one with the toggle in the header.
- **Live results.** The solver re-checks the dungeon as you edit. A banner says whether it's beatable and how a player could get stuck, and the canvas highlights the critical path, optional rooms, and unreachable rooms.
- **Softlock playback.** Step through each way a player can get stuck, one door or drop at a time, and see which rooms they're trapped in.
- **Saved in your browser.** Dungeons save themselves in `localStorage`, several at once, and are listed on the front page.
- **Share links.** "Share link" copies a link with the whole dungeon packed into it (compressed with `lz-string`), so nothing is uploaded anywhere. Whoever opens it can look, edit, and save their own copy.
- **JSON export and import**, for backups and for moving dungeons between browsers.
- **Three example dungeons** to try: a gentle first one, a key softlock, and a one-way drop trap. An example joins your dungeons only once you change it.

![Live results on the Sunken Cistern example](docs/screenshots/live-results.png)

![The map view of the Sunken Cistern's lower floor, in the dark theme](docs/screenshots/map-view.png)

![Playing back a softlock: the wasted key leaves the player stuck](docs/screenshots/softlock-playback.png)

![A dungeon opened from a share link](docs/screenshots/shared-link.png)

## Development

```sh
npm install
npm run dev     # local dev server
npm test        # unit tests (Vitest)
npm run lint    # oxlint
npm run build   # production build in dist/
```

Pushes to `main` run lint, tests, and the build, then deploy to GitHub Pages.

## Project layout

| Path | What it holds |
| --- | --- |
| `src/model/` | Dungeon format, validation, defaults, version migration. See [its README](src/model/README.md). |
| `src/solver/` | Pure solver logic and its tests |
| `src/solver/__fixtures__/` | Test dungeons as JSON, with the results the solver should give |
| `src/components/graph/` | The React Flow graph editor |
| `src/components/map/` | The SVG map editor, and its pure grid geometry (`grid.js`) |
| `src/components/panels/` | The side panel (selected room or connection, or the dungeon's start, goal, and floors), the solver results banner, and softlock playback |
| `src/components/results.js` | Turns solver results into banner text, highlights, and playback marks |
| `src/pages/` | The landing page and the builder |
| `src/routing.js` | Hash routing (`#/`, `#/edit/<id>`, `#/share/<data>`), so every page works on GitHub Pages |
| `src/storage/` | Saved dungeons in `localStorage`, share links, and JSON export |
| `src/examples/` | The example dungeons on the front page, with tests that they show what their blurbs promise |
| `docs/screenshots/` | Screenshots for this README |

## License

The code is under the license in [LICENSE](LICENSE).

The Legend of Zelda is a trademark of Nintendo. This is an unofficial fan project and is not affiliated with or endorsed by Nintendo. It uses no Nintendo assets.
