# Dungeon Delver

Exploring custom Zelda dungeons and whether they would work.

Sketch how a dungeon's rooms connect and what locks each connection (small keys, the big key, items like the hookshot, one-way drops). Dungeon Delver tells you whether the dungeon can be beaten, how a player could softlock, which rooms are optional, and what the critical path is.

It's a static site, hosted on GitHub Pages. It's under construction. The solver is done, and the graph editor is in progress: you can add, rename, move, and delete rooms, drag between them to connect them, edit a room's contents or a connection's lock in the side panel, pick the start and goal rooms, and organize rooms into floors. The solver re-checks the dungeon as you edit: a banner says whether it's beatable and how a player could get stuck, and the canvas highlights the critical path, optional rooms, and unreachable rooms. Softlock playback, saving, and sharing come next, then a map view.

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
| `src/components/panels/` | The side panel (selected room or connection, or the dungeon's start, goal, and floors) and the solver results banner |
| `src/components/results.js` | Turns solver results into banner text and highlights |

## License

The code is under the license in [LICENSE](LICENSE).

The Legend of Zelda is a trademark of Nintendo. This is an unofficial fan project and is not affiliated with or endorsed by Nintendo. It uses no Nintendo assets.
