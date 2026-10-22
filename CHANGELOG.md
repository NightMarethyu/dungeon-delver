# Changelog

All notable changes to Dungeon Delver. Versions match the git tags.

## 1.0 (2026-10-22)

The map view is finished: a dungeon can be laid out floor by floor, and the solver's results show on the map as well as on the graph.

### Added

- **Map view**, now the default. One floor at a time, with floor tabs and rooms as rectangles on a snap grid: drag to move, drag a corner to resize, double-click the grid to add a room. Rooms that have never been on the map are placed automatically, beside the rooms they connect to.
- **Doors in shared walls.** Connected rooms that sit side by side get a door in their shared wall, marked with its lock's icon and an arrow if it's one-way. Connected rooms that aren't side by side yet get a dashed line, and a button to move them together. Add a door with the **+** on a shared wall or by dragging the arrow in a selected room's corner, and the map offers one when you put a room against another.
- **Stairs and holes** to other floors show inside their room. Click one to jump to the room at the other end.
- **Solver highlights on the map.** The critical path, optional rooms, and unreachable rooms are marked on rooms, doors, and stairs, and each floor's tab gets a dot when the critical path goes through it. Softlock playback works on the map too, switching to the floor where each step happens and marking the floor where the player ends up stuck.
- **Puzzle locks** (format version 3). A connection can be locked by a puzzle solved inside one of its rooms, which opens it from that side only, or by a puzzle on the door itself, solvable from either side.
- **Drawn icons** for keys, the big key, chests, items, puzzles, doors, stairs, and holes, recolored to suit the theme.
- **Light and dark themes**, following the system setting until you pick one.
- The site's version is shown at the bottom of the front page.

### Changed

- Floors are listed top floor first, so one-way stairs point the right way.
- The builder remembers whether you last used the map or the graph.

## 0.1 (2026-10-21)

The first release: the solver and the graph editor.

- A solver for small keys, the big key, items, and one-way connections, reporting whether a dungeon can be beaten, every way to softlock it, optional and unreachable rooms, and the critical path.
- A graph editor with a side panel for rooms and connections, start and goal rooms, and floors.
- Live results as you edit, and step-by-step softlock playback.
- Several dungeons saved in the browser, share links, and JSON export and import.
- Three example dungeons.
