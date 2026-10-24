# Changelog

All notable changes to Dungeon Delver. Versions match the git tags.

## Unreleased

The first step toward a dungeon builder for tabletop RPGs.

### Added

- **Room notes for the game master** (format version 4). Each room has boxes for its description, enemies, traps and hazards, treasure, and hidden details, plus a plain notes box for everything else. They're free text, not tied to any game system, so they fit whatever game you run. Notes are kept in saves, share links, and JSON exports, and the Sunken Cistern example has a few to show how they look.

## 1.1 (2026-10-23)

Quality of life: undo, keyboard shortcuts, and a layout for phones.

### Added

- **Undo and redo**, with the ↶ ↷ buttons in the header or Ctrl+Z and Ctrl+Shift+Z (⌘ on a Mac). A quick burst of edits, like dragging a room or typing a name, undoes in one step; adding or removing a room or connection is always its own step.
- **Keyboard shortcuts** in the builder, listed by pressing **?** or the ? button: **N** to add a room, arrow keys to move the selected room (Shift+arrows resize it on the map), **Delete**, **Enter** to rename, **S** and **G** for start and goal, **V** to switch views, **[** and **]** for floors, and **+**, **−**, **0** to zoom. Arrow keys still step through softlock playback when nothing is selected. Shortcuts are off while typing in a field.
- **Phone layout.** On small screens the builder fills the screen: a one-line header with the less used buttons in a ⋯ menu, the map or graph taking the rest, and the side panel as a sheet that opens from the bottom. The softlock list makes way for the map during playback.
- **Touch editing on the map.** Pinch to zoom, double-tap the grid to add a room, and bigger corners, door targets, "+" spots, and connect arrow on touch screens. Double-tapping empty space adds a room in the graph too, and its connection dots are bigger.

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
