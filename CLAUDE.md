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

- Every record (follower, region, biome, area, building, project, item) has a `customFields` object. The Arbiter can add, rename and remove custom fields and stats in the app with no code, so a new rule can be tracked before it is ever automated.

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

The map is three separate tabs (World Map, Region Map, Biome Map), each with its own sparse, effectively infinite square grid. They are linked by IDs, not by one continuous zoom.

Terminology (largest to smallest):

- **Region:** a major, large area containing multiple Biomes (for example Kie's Grove).
- **Biome:** a medium-size area with its own resources (for example one of the Gardens of Kie's Grove). A Biome with the type "Settlement" is a town or camp. A small Region can hold a single Biome covering all of it (the Central Grasslands Region holds one Biome, the Grasslands): they cover the same ground but are separate records on separate tabs, each with its own information.
- **Area:** a smaller zone with a specific focus (a mine, a building site, a harvest zone, a farm, a district).

**World Map.** The largest scale. Holds Regions (for example Kie's Grove, the Central Grasslands, the Barrenlands, the Tower of Apocalypse). Selecting a Region shows an info panel: description, species that live there, civilizations or cities that reside there, and notes. Regions have no Danger Level of their own: danger belongs to each Biome.

**Region Map.** Opened by entering a Region. Breaks it into Biomes, for example the ten Gardens of Kie's Grove, plus a single large block for each Settlement Biome. Unlike the other two maps it is bounded: it covers exactly the Region's footprint on the World Map, with each World Map cell scaled up to mapScale x mapScale Region Map cells (editable per Region, default 10), so a Region only has room for so many Biomes. The World Map tiles under the Region are drawn scaled up as its background; the Region Map's own paint goes on top. This is one-way on purpose: painting the Region Map never changes the World Map (the Arbiter paints each map; the World Map stays the big picture). Nothing can be painted or placed outside the edge. From Stage 9 the background uses the rendered terrain. Selecting a Biome shows its resources (each with an Availability rating), its residents (followers, creatures, NPCs present), its Environmental Danger Level and notes.

**Biome Map.** Opened by entering a Biome. The detailed view: Areas, individual buildings, construction sites, roads, storage, and later the explicit connections between them (logistics and automation links). Areas are outlined zones with a multi-cell footprint; other objects (buildings, markers) can sit inside them. Selecting an Area shows its area type (focus), description, Danger Level (defaults to the Biome's, can be overridden), resources with Availability, assigned followers and notes. Selecting any object shows its full details and actions.

Zones and solid objects: on every map, Regions, Biomes and Areas are zones (outlines) and everything else (Settlements, markers, buildings) is solid. Zones can't overlap other zones and solid objects can't overlap other solid objects, but a solid object can sit inside a zone, for example a Settlement inside a Biome or a marker inside a Region. Which layer a placeable uses is set by `"layer": "zone"` in its placeables.json.

Navigation: double-click (or an Enter button) on a Region or Biome opens the next tab focused on it. A breadcrumb (World > Kie's Grove > Jade Garden) and the tab bar move back up. Each tab remembers its own camera position per container.

Future option (do not build until asked): Areas are already containers, so one could become enterable (for example the inside of a mine) by adding `'area'` to the enterable kinds in `src/ui/navigation.js` and adding a map tab for it.

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

- regionTypes, biomeTypes, areaTypes (an Area's focus: Mine, Farm, Building Site, Harvest Zone, District...), buildingTypes (default footprint, construction stage thresholds, sprite key), tileTypes (paint colors and textures).

- resourceTypes: name, description, tags (for example `[Wood]`, `[Food]`, `[Medical Herb]`, `[Special]`).

- species: name, base attributes, notes (for example Baseliner).

- theories, skills, traits, conditions, recipes.

**containers:** every World, Region, Biome and Area. Fields: id, kind (`world` | `region` | `biome` | `area`), parentId, typeId, name, description, dangerLevel (Biomes and Areas; for an Area, empty means "same as its Biome"; Regions have none), species, civilizations and mapScale (Regions), residents notes, sparse tile map, list of placed object ids, for Biomes and Areas a list of resource availabilities `{ resourceTypeId, availability, notes }`, and for Areas assignedFollowerIds.

**placedObjects:** id, containerId, kind (`region` | `biome` | `area` | `building` | `marker`), refId (the region, biome, area or building it represents), x, y, w, h, spriteKey, label.

**buildings:** id, buildingTypeId, name, areaId (optional: the Area it belongs to; empty means it stands alone on the Biome Map), constructionState, projectId (optional), storage (resource counts), properties (free-form key/value the Arbiter can add), notes.

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

- Layout: main canvas in the center, management tabs across the top (World Map, Region Map, Biome Map, Followers, Projects, Resources, Log, Settings), contextual detail panel on the right when something is selected.

- Arbiter-only fields are flagged. A Player View mode hides Arbiter-only controls and information for screenshot export.

- Keep the UI simple. New systems get their own tab or panel, not more buttons on existing ones.

## Development stages

Build one stage at a time. Each stage must run and be manually testable before starting the next. After each stage, update the Progress section below.

0. **Skeleton.** Vite project, folder layout, world schema, create a new world, world list, save and load to IndexedDB, JSON export and import.

1. **World Map canvas.** Sparse grid, pan, zoom, paint tiles, place, remove, select, move, duplicate.

2. **Region and Biome Maps.** Regions and Biomes as enterable objects, Areas as zones on the Biome Map, the three map tabs, breadcrumb, info panels, editable definitions for region, biome and area types.

3. **Buildings.** Multi-cell buildings on the Biome Map, either inside an Area (areaId, for example the Communal Sleeping Hole on a Building Site Area) or standing alone on the Biome Map, building type editor, placeholder sprites, editable properties, construction stage visuals (Empty Site, Foundation, Under Construction, Completed) driven by editable percentage thresholds.

4. **Followers.** Followers tab with roster and detail panel, every field editable. Import the current roster (see Seed Data).

5. **Projects.** Create a Project on a building site, assign followers, choose Speed, roll Work Dice per RULES.md, roll the Event, show the proposed result, Arbiter accepts, edits or rerolls.

6. **Time.** Speed tracking, task records, Advance Day with proposals, undo, redo, reverse day.

7. **Persistence and sharing polish.** Multiple worlds, Player View screenshot mode.

8. **Notes.** A Notes tab for long-form game notes (rules drafts, lore, session logs, world state). Markdown text, titles, tags, folders, search. Any note can link to followers, regions, biomes, areas, buildings and projects, and those records show their linked notes. Import from Markdown or plain text files so notes can be moved over from UpNote.

9. **Rendered View (procedural pixel terrain) and Stamps.**

   Rendered View
   - Each map tab toggles between Tile view (editing) and Rendered view (playing and screenshots).
   - Everything in Rendered view is drawn by code. No AI, no network, no required image files.
   - Pixel look: draw the scene onto a small offscreen canvas at low resolution (e.g. 16 pixels per tile), then scale it up to the screen with nearest-neighbor at integer zoom levels (imageSmoothingEnabled = false). This makes all code-drawn shapes come out as crisp pixel art automatically.
   - Style: very simple, bright, chunky pixel art with a dark brown outline color (#3b2414 or similar, editable in Settings), matching the Arbiter's stamp assets.
   - The renderer is a pure function of the tile data plus a saved seed.

   Terrain smoothing
   - Water, roads, paths and biome borders are smoothed into curved, flowing shapes instead of square stairs, while staying inside their painted cells. A diagonal staircase of water cells becomes a diagonal river.
   - Water gets a darker outline edge, a few lighter ripple pixels, and a small shore band where it meets land.
   - Neighboring terrain types blend with a soft, slightly irregular border instead of a hard grid line.

   Procedural details (drawn by code)
   - Grass tufts, small flowers, pebbles, simple pixel trees (round leafy, tall, pine), bushes and rocks, generated from the seed.
   - Each tile type has editable density settings, e.g. Grassland: Trees Sparse, Grass tufts Moderate, Flowers Few, Rocks Few. Region, biome and area types can override them.
   - Details avoid water and roads, and trees keep a small gap from shores.
   - Objects are sorted by y so lower ones draw in front.
   - The Arbiter can Reroll the seed, Lock the result, and click any detail to move or delete it. Locked and edited details are saved.

   Stamps (optional assets)
   - Assets are not used automatically. They are stamps the Arbiter chooses to place by hand.
   - Asset Library tab: import single PNGs or a sprite sheet on a plain white background. The sheet importer auto-detects each object, removes the background, trims it, and lets the Arbiter name and tag each piece. Tags come from names (every word is a tag, numbers ignored, plurals singular) and stay editable.
   - Stamp palette in Rendered view: search or filter stamps by tag, click one, then click the map to place it. Placed stamps can be moved, scaled in whole-number steps, flipped, layered above or below, and deleted. Stamps snap to the pixel grid, and also to the tile grid if snapping is on.
   - Placed stamps are saved per container as decoration objects. They are visual only; they don't change game data unless the Arbiter links a stamp to a building or other record.
   - Buildings can optionally use a chosen stamp per construction stage. If none is set, the renderer draws a simple code-drawn placeholder for each stage.

After the MVP (do not start without being asked): Harvesting tab, resources and stockpiles UI, Crafting, Training, building connections and automation (always pausable and overridable), Morale and Prosperity, population groups, Units, Armies.

## Seed data

The first test world should recreate the current campaign so the app is tested against real data: Day 8, 15 living Baseliner followers (Speed 1, Hunger 5/5, Thirst 3/3), the Communal Sleeping Hole Project at 30 of 75 Workload, and the map:

- Regions on the World Map: the Central Grasslands, Kie's Grove, the Ruined Forge of Creation and the Tower of Apocalypse.
- Biomes on the Region Maps: the Jade Garden (in Kie's Grove) with its resources; the Grasslands, a single Biome covering the whole Central Grasslands Region.
- Areas on the Biome Maps: a Building Site Area holding the Communal Sleeping Hole building and its Project (the Arbiter will say which Biome it is in). The Arbiter will provide the roster and world notes as text files.

## Working agreement for the AI

- Before writing code for a stage, briefly state the plan and the files you will touch.

- Keep files small and focused. Prefer adding a module over growing one past roughly 300 lines.

- Write Vitest tests for every rules function, using the worked examples in RULES.md (for example the Stone Spear crafting example) as test cases.

- When a rule is missing, do not guess. Leave it editable, mark it `// RULE NEEDED:`, and add it to Open Rules.

- After finishing a stage, tell the developer exactly how to test it by hand.

## Progress

- [x] Stage 0: world schema (v1), IndexedDB save/load with autosave, world list (create, open, delete), JSON export/import (an import never overwrites: a clashing id becomes a copy), command registry with undo/redo (Ctrl+Z / Ctrl+Y), Log and Settings tabs (rename world, set day). Map, Followers, Projects and Resources tabs are placeholders.
- [x] Stage 1: World Map canvas. Shared map engine in `src/map` (camera, sparse grid, renderer, tools, panels) usable by any container. Tools: select/move, pan (drag, right/middle drag, WASD), zoom at cursor, paint and erase tiles (one undo step per stroke), place Region or Marker, remove, duplicate, edit properties (name, position, size, color, sprite key). Editable tile types. Generic `customFields` editor on every placed object. System registry (`src/systems/registry.js`) with World Map as the first system. Schema v2 (migration 1 to 2 adds customFields, object color, default tile types).
- [x] Stage 2: Region Map and Biome Map systems (`src/systems/regionMap`, `src/systems/biomeMap`) on the shared map engine. Navigation state (`src/ui/navigation.js`) holds the open tab, Region and Biome; enter with double-click, Enter key or the Enter button; breadcrumb on every map; cameras saved per container in localStorage (view state, not world data); each map keeps its own selection. Region info panel (name, type, description, species as shared `definitions.species`, civilizations, Biomes here, notes, Region Map scale; no Danger Level) and Biome info panel (Environmental Danger Level, resources as shared `definitions.resourceTypes` with Availability, residents, notes); with nothing selected the Region and Biome Maps show their own container's info. Bounded Region Map (`src/map/regionFrame.js`): the Region's World Map footprint scaled up by its mapScale, with the World Map tiles drawn scaled up as the background and everything outside the edge shaded and blocked. Areas on the Biome Map: containers of kind `area`, drawn as outlined zones; info panel with area type (focus), Danger Level inherited from the Biome unless overridden, resources, assigned followers (empty until Stage 4), notes. Danger and Availability ladders are rules tables in `src/rules/tables/`. Editable Region, Biome and Area types (name, color, default fields copied on when a type is set). Settlement placeable = Biome with the Settlement type, drawn as a block. Two occupancy layers: Regions, Biomes and Areas are zones, Settlements and markers are solid; each only blocks its own layer, so Settlements and markers can sit inside Biomes and Regions. Removing a Region, Biome or Area warns what is inside and removes and restores all of it in one undo step. Generic `batch` command for one-step multi-changes. Schema v5 (migration 2 to 3 adds typeId, speciesIds, civilizations and starter types; 3 to 4 renames Sub-Areas to Biomes in data and the undo log, adds Area types and assignedFollowerIds; 4 to 5 adds mapScale).
- [x] Stage 3: Buildings system (`src/systems/buildings`). Shared map engine hook `src/map/objectKinds.js`: a system registers a kind of placed object backed by its own record (create, duplicate, linked records, name, draw, info panel, re-link on footprint change) and can add placeables to a kind of map, so the Biome Map gets "Building" without the biomeMap system changing. Place/remove payloads carry `linked` records, so removing a building, or a Biome or Region holding buildings, undoes in one step. A building is a placed object (kind `building`, solid layer) plus a `buildings` record (type, name, areaId, constructionProgress 0-100, forcedStage, projectId for Stage 5, storage counts, properties as key/value, stageStamps for Stage 9, notes, customFields). Placing it links it to the Area covering most of its cells; moving, rotating or resizing re-links; the panel can change the link. Rotate (R or button) turns non-square footprints around their center with overlap and edge checks (`setFootprint` command). Placeholder visuals per stage: Empty Site dashed outline, Foundation hatched, Under Construction partly filled, Completed solid, plus a progress bar; color from the type's category. Stage = highest threshold at or below progress (`stages.js`, thresholds per type, defaults in `tables/constructionStages.json`), or a forced stage. Buildings tab: building type editor (name, category, default footprint, stage thresholds, default properties, custom fields), category editor (name, color), list of all buildings with Show. Duplicates start with empty storage. Schema v6 (migration 5 to 6 adds starter building categories).
- [ ] Stage 4
- [ ] Stage 5
- [ ] Stage 6
- [ ] Stage 7
- [ ] Stage 8
- [ ] Stage 9

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
