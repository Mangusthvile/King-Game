# King's Game: Arbiter's Kingdom Simulator

This file is the project brief. Read it at the start of every session before writing code.

## What this app is

A private, local tool for the Arbiter (Game Master) of King's Game, a custom tabletop-style ruleset. It is a visual world map plus a kingdom, follower and project manager. It is NOT a video game: no victory conditions, no campaign, no forced progression.

This is a helper for playing King's Game, not a full game. It records, organizes and assists; the Arbiter plays the game.

Three purposes, in priority order:

1. Mapping and worldbuilding.

2. Kingdom and civilization management.

3. Follower and population management.

The developer is a beginner programmer building with AI assistance. Prefer simple, readable code over clever code. Explain non-obvious decisions in short comments.

## The three laws of this project

These override convenience. If a task seems to require breaking one, stop and ask.

**1. Never invent game rules.** King's Game is an existing ruleset, documented in RULES.md. Implement those rules exactly. If a mechanic is missing or unclear, make the value a manual, editable field and add a `// RULE NEEDED:` comment plus an entry in the Open Rules list at the bottom of this file. Do not fill gaps with generic RPG or colony-sim mechanics.

**2. The Arbiter has absolute authority.** Every important value is a stored, editable field, never a value that only exists as a calculation. The rules engine PROPOSES results (dice rolls, progress, yields); the Arbiter can accept, edit, reroll or discard before anything is committed. The Arbiter must be able to set any number to anything (1,000 of a resource, finish a Project instantly, change any Speed).

**3. Everything is undoable.** Every change to world data goes through a command that records how to reverse it. No code may mutate world state directly.

## Extensibility (required)

- New game systems will be added often. Each system (Harvesting, Crafting, Morale, Notes, etc.) is a self-contained module in `/src/systems/<name>/` with its own data slice, commands, rules tables, tab and panels. It registers itself in one central registry file. Adding a system should not require editing other systems.

- Every record (follower, region, sub-area, building, project, item) has a `customFields` object. The Arbiter can add, rename and remove custom fields and stats in the app with no code, so a new rule can be tracked before it is ever automated.

- Every schema change increments `schemaVersion` and adds a migration in `src/data/migrations.js`, so old saves always load after an update.

- Rules values live in JSON tables, never hard-coded.

- Do not refactor Stage 0 code now unless it blocks this. Apply these rules from Stage 1 onward.

## Tech stack

- Plain JavaScript (ES modules), HTML and CSS. No framework for now.

- Vite as the dev server and bundler. Run with `npm run dev`.

- HTML Canvas 2D for the map. Ordinary HTML/CSS for panels, tabs and forms.

- IndexedDB for local saves (use the small `idb` package). JSON export and import for backups.

- Vitest for unit tests of the rules engine only (dice, tables, resolution methods).

- No server, no accounts, no cloud database, no paid services. Must run fully offline from the local folder.

- Pixel art: render with `image-rendering: pixelated` and `ctx.imageSmoothingEnabled = false`. Use integer zoom steps when drawing sprites.

Ask before adding any other dependency.

## Folder layout

```
/src
  main.js            entry point, wires everything together
  /data              world schema, definitions, default data, save/load, migrations
  /commands          command objects (do / undo) and the action log
  /rules             pure functions implementing RULES.md, plus rules tables as JSON
  /map               camera, sparse grid, rendering, tools (paint, place, select, move)
  /ui                tabs, side panels, detail panels, dialogs
  /systems           one self-contained folder per game system (see Extensibility)
    registry.js      the one central list every system registers itself in
    /<name>          that system's data slice, commands, rules tables, tab and panels
  /assets            sprites (optional; app must work with none)
/tests               Vitest tests for /rules
RULES.md             the King's Game rules, written by the Arbiter
CLAUDE.md            this file
```

Modules talk through the world store and commands. UI never edits data directly; it dispatches commands.

## The map: three map tabs

The map is three separate tabs, each with its own sparse, effectively infinite square grid. They are linked by IDs, not by one continuous zoom.

**World Map.** The largest scale. Holds Regions: biomes, territories and other large features (for example Kie's Grove, the Central Grasslands, the Barrenlands, the Tower of Apocalypse). Selecting a Region shows an info panel: description, Environmental Danger Level, species that live there, civilizations or cities that reside there, and notes.

**Region Map.** Opened by entering a Region. Breaks it into Sub-Areas, for example the ten Gardens of Kie's Grove, plus a single large block for each settlement or city. Selecting a Sub-Area shows its resources (each with an Availability rating), its residents (followers, creatures, NPCs present), its Danger Level and notes.

**Local Map.** Opened by entering a Sub-Area. The detailed view: individual buildings, construction sites, harvesting zones, roads, storage, and later the explicit connections between them (logistics and automation links). Selecting an object shows its full details and actions.

Navigation: double-click (or an Enter button) on a Region or Sub-Area opens the next tab focused on it. A breadcrumb (World > Kie's Grove > Jade Garden) and the tab bar move back up. Each tab remembers its own camera position per container.

### Grid rules (all three tabs)

- Store only occupied cells, in a Map keyed by the string `"x,y"`. Never allocate a full grid.

- Camera is `{ x, y, zoom }`. Each frame, compute the visible cell range from the camera and canvas size, draw procedural grid lines, then draw only cells and objects in range.

- Placed objects use an anchor cell plus `w` and `h` (multi-cell footprints). Keep an occupancy index (cell key to objectId) for click hit-testing and overlap checks.

- Tools: pan (drag or WASD), zoom (wheel, centered on cursor), paint (single cell and drag to paint many), place, remove, select, move, duplicate, edit properties.

- An object must still exist, display and be editable if its sprite is missing. Fall back to a colored square with a short label.

## Data model

One world (campaign) is one JSON document with a `schemaVersion`. Every record has a unique `id`. Definitions (types) are separate from instances (things in the world) and are editable in the app.

Every instance record (containers, buildings, followers, projects, and items when they are added) also has a `customFields` object: Arbiter-made fields and stats, added, renamed and removed in the app. Each field stores its name, value type and value. These are not repeated in the field lists below.

**meta:** name, currentDay, schemaVersion, created and modified dates.

**definitions:**

- regionTypes, subAreaTypes, buildingTypes (default footprint, construction stage thresholds, sprite key), tileTypes (paint colors and textures).

- resourceTypes: name, description, tags (for example `[Wood]`, `[Food]`, `[Medical Herb]`, `[Special]`).

- species: name, base attributes, notes (for example Baseliner).

- theories, skills, traits, conditions, recipes.

**containers:** every World, Region and Sub-Area. Fields: id, kind (`world` | `region` | `subArea`), parentId, name, description, dangerLevel, residents notes, sparse tile map, list of placed object ids, and for Sub-Areas a list of resource availabilities `{ resourceTypeId, availability, notes }`.

**placedObjects:** id, containerId, kind (`region` | `subArea` | `building` | `harvestZone` | `marker`), refId (the region, sub-area or building it represents), x, y, w, h, spriteKey, label.

**buildings:** id, buildingTypeId, name, constructionState, projectId (optional), storage (resource counts), properties (free-form key/value the Arbiter can add), notes.

**followers:** id, name, speciesId, attributes, speedMax, speedRemaining, hunger `{ current, max }`, thirst `{ current, max }`, theories `[{ name, percent }]`, skills `[{ name, tier, level }]`, traits (Pacts are stored as Traits), conditions (for example a broken arm at -3 to all tasks), inventory, equipment, locationContainerId, currentAssignment, bio, notes, alive or dead plus a death log entry.

**projects:** id, name, sizeLabel, workloadRequired, workloadCurrent, siteBuildingId, requirements (text and resource list), status (`planned` | `active` | `paused` | `complete`), and a workday history: for each day, the participants, Speed invested, dice type, each die result, bonuses, Event roll, Event result and Arbiter notes.

**stockpiles:** resource counts owned by the kingdom, and per building or location.

**log:** the action log (see Commands) plus a full world snapshot saved at the start of every day.

Rules tables (Harvest availability ladders, Environmental Danger table, Work Die by Tier, Project sizes and Event table, Crafting tables, Point Conversion table) are stored as JSON in `/src/rules/tables/`, never hard-coded in logic, so the Arbiter can change a number without touching code.

## Commands, undo and time

- Every change is a command object `{ type, payload, do(world), undo(world) }`, pushed to the action log.

- Undo and redo walk the log within the current day.

- Advance Day: save a snapshot, increment currentDay, reset every follower's speedRemaining to speedMax, then present the end-of-day steps (food consumption, hunger and thirst, Project Event rolls) as proposals for the Arbiter to accept or edit. Do not auto-apply.

- Reverse Day: restore the previous day's snapshot after a confirmation.

- The Arbiter can manually set currentDay.

## Speed and tasks

Speed is how much activity an individual can perform per day. Assigning a follower to a task spends Speed from speedRemaining. Every task record stores who, what, how much Speed, the result and notes. Speed values and costs are always editable. Do not invent an action economy beyond what RULES.md states.

## Interface

- Pixel-art inspired, game-like rather than spreadsheet-like. Compact, readable, icon-driven. Reference screenshots are in `/references` (Kingdom Maker Inc., Starmancer, Orb of Creation, Kingdom Two Crowns).

- Layout: main canvas in the center, management tabs across the top (World Map, Region Map, Local Map, Followers, Projects, Resources, Log, Settings), contextual detail panel on the right when something is selected.

- Arbiter-only fields are flagged. A Player View mode hides Arbiter-only controls and information for screenshot export.

- Keep the UI simple. New systems get their own tab or panel, not more buttons on existing ones.

## Development stages

Build one stage at a time. Each stage must run and be manually testable before starting the next. After each stage, update the Progress section below.

0. **Skeleton.** Vite project, folder layout, world schema, create a new world, world list, save and load to IndexedDB, JSON export and import.

1. **World Map canvas.** Sparse grid, pan, zoom, paint tiles, place, remove, select, move, duplicate.

2. **Region and Local Maps.** Regions and Sub-Areas as enterable objects, the three map tabs, breadcrumb, info panels, editable definitions for region and sub-area types.

3. **Buildings.** Multi-cell buildings on the Local Map, building type editor, placeholder sprites, editable properties, construction stage visuals (Empty Site, Foundation, Under Construction, Completed) driven by editable percentage thresholds.

4. **Followers.** Followers tab with roster and detail panel, every field editable. Import the current roster (see Seed Data).

5. **Projects.** Create a Project on a building site, assign followers, choose Speed, roll Work Dice per RULES.md, roll the Event, show the proposed result, Arbiter accepts, edits or rerolls.

6. **Time.** Speed tracking, task records, Advance Day with proposals, undo, redo, reverse day.

7. **Persistence and sharing polish.** Multiple worlds, Player View screenshot mode.

8. **Notes.** A Notes tab for long-form game notes (rules drafts, lore, session logs, world state). Markdown text, titles, tags, folders, search. Any note can link to followers, regions, sub-areas, buildings and projects, and those records show their linked notes. Import from Markdown or plain text files so notes can be moved over from UpNote.

After the MVP (do not start without being asked): Harvesting tab, resources and stockpiles UI, Crafting, Training, building connections and automation (always pausable and overridable), Morale and Prosperity, population groups, Units, Armies.

## Seed data

The first test world should recreate the current campaign so the app is tested against real data: Day 8, 15 living Baseliner followers (Speed 1, Hunger 5/5, Thirst 3/3), the Communal Sleeping Hole Project at 30 of 75 Workload, and Regions for the Central Grasslands, Kie's Grove (with the Jade Garden and its resources), the Ruined Forge of Creation and the Tower of Apocalypse. The Arbiter will provide the roster and world notes as text files.

## Working agreement for the AI

- Before writing code for a stage, briefly state the plan and the files you will touch.

- Keep files small and focused. Prefer adding a module over growing one past roughly 300 lines.

- Write Vitest tests for every rules function, using the worked examples in RULES.md (for example the Stone Spear crafting example) as test cases.

- When a rule is missing, do not guess. Leave it editable, mark it `// RULE NEEDED:`, and add it to Open Rules.

- After finishing a stage, tell the developer exactly how to test it by hand.

## Progress

- [x] Stage 0: world schema (v1), IndexedDB save/load with autosave, world list (create, open, delete), JSON export/import (an import never overwrites: a clashing id becomes a copy), command registry with undo/redo (Ctrl+Z / Ctrl+Y), Log and Settings tabs (rename world, set day). Map, Followers, Projects and Resources tabs are placeholders.
- [ ] Stage 1
- [ ] Stage 2
- [ ] Stage 3
- [ ] Stage 4
- [ ] Stage 5
- [ ] Stage 6
- [ ] Stage 7
- [ ] Stage 8

## Open Rules (ask the Arbiter, do not invent)

- How Skill Level increases, and its maximum (RULES.md implies Lv 10).

- When a Skill tiers up: are the combined Theories or Skills consumed, and what happens to its Level?

- How a follower's Speed increases above 1.

- Full attribute list and meaning (seen: Strength, Agility, Intelligence, Charisma, Willpower, Might) and what Body Type means.

- Training: table from the d20 teaching quality roll to the number of dice, and the Understanding Roll success ladder.

- Thirst consequences per day without water.

- Conditions and healing: durations, how injuries heal.

- Morale and Prosperity rules.

- Trait and Pact structure.

- Equipment and tool bonuses for Projects and Harvests; carry limits with storage equipment.

- Specific Boon and Setback options for Project Events.
