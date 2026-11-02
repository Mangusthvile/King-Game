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

**2. The Arbiter has absolute authority.** Every important value is a stored, editable field, never a value that only exists as a calculation. The rules engine PROPOSES results (dice rolls, progress, yields); the Arbiter can accept, edit, reroll or discard before anything is committed. The Arbiter must be able to set any number to anything (1,000 of a resource, finish a Project instantly, change any Stamina or stat).

**3. Everything is undoable.** Every change to world data goes through a command that records how to reverse it. No code may mutate world state directly.

## Extensibility (required)

- New game systems will be added often. Each system (Harvesting, Crafting, Morale, Notes, etc.) is a self-contained module in `/src/systems/<name>/` with its own data slice, commands, rules tables, tab and panels. It registers itself in one central registry file. Adding a system should not require editing other systems.

- Every record (follower, region, biome, area, building, project, item) has a `customFields` object. The Arbiter can add, rename and remove custom fields and stats in the app with no code, so a new rule can be tracked before it is ever automated.

- Every schema change increments `schemaVersion` and adds a migration in `src/data/migrations.js`, so old saves always load after an update.

- Rules values live in JSON tables, never hard-coded.

- Prerequisites and "leads to" links are structured data, not just text. When adding or changing Skills, Traits, Recipes or buildings, store their prerequisites and what they lead to as lists of references by id (for example `requiredSkillIds`, `leadsToIds`), so the Skill Tree and Tech Tree (Stages 11 and 12) can be generated later without reworking the data. Free-text notes can sit alongside, but never instead of, the structured list. Current gap: a Skill's required Theories are stored as names (`theories: ["Theory of Combat"]`) because Theories have no library yet; convert them to ids when a Theories library is added.

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

The map is three separate tabs, one per map level: World Map (shows Regions), Region Map (shows Biomes) and Biome Map (shows Areas and buildings). Each has its own sparse square grid and its own paint layer. They are linked by IDs and footprints, not by one continuous zoom. There are exactly three map tabs; Areas are not enterable.

### Linked map levels and the inherited base layer

The same rule links World to Region and Region to Biome (`src/map/mapFrame.js`):

- Every Region has a footprint on the World Map and every Biome a footprint on its Region Map. Each has a scale factor, `mapScale` (child map cells per parent map cell; default 8, editable in its info panel).
- The child map covers exactly that footprint scaled up (footprint w x mapScale by h x mapScale cells, centered on cell 0, 0). Nothing can be painted or placed outside its edge.
- Inherited base layer: the child map shows the parent's terrain under its footprint (the parent's own paint, or what the parent itself inherits), scaled up. The child's own paint draws on top and can cover the inherited base anywhere.
- The base is worked out from the parent each time the map is drawn, so painting a parent updates its children's base at once, and never changes the child's own paint. Painting a child never changes its parent: the Arbiter paints each map.
- Each parent map shows its children as outlined sections with a mini preview of the child's own paint and objects inside the outline. Hovering an object shows its name; double-click enters a Region or Biome.

Terminology (largest to smallest):

- **Region:** a major, large area containing multiple Biomes (for example Kie's Grove).
- **Biome:** a medium-size area with its own resources (for example one of the Gardens of Kie's Grove). A Biome with the type "Settlement" is a town or camp. A small Region can hold a single Biome covering all of it (the Central Grasslands Region holds one Biome, the Grasslands): they cover the same ground but are separate records on separate tabs, each with its own information.
- **Area:** a smaller zone with a specific focus (a mine, a building site, a harvest zone, a farm, a district).

**World Map.** The largest scale. Holds Regions (for example Kie's Grove, the Central Grasslands, the Barrenlands, the Tower of Apocalypse). Selecting a Region shows an info panel: description, species that live there, civilizations or cities that reside there, and notes. Regions have no Danger Level of their own: danger belongs to each Biome.

**Region Map.** Opened by entering a Region. Breaks it into Biomes, for example the ten Gardens of Kie's Grove, plus a single large block for each Settlement Biome. Bounded by the Region's World Map footprint (see Linked map levels), so a Region only has room for so many Biomes; the World Map terrain under it is its inherited base layer. From Stage 9 the base uses the rendered terrain. Selecting a Biome shows its resources (each with an Availability rating), its residents (followers, creatures, NPCs present), its Environmental Danger Level and notes.

**Biome Map.** Opened by entering a Biome. Shown as a framed board (a clear thick border around the Biome's footprint, in the style of Stacklands), bounded by the Biome's Region Map footprint with the Region's terrain as its inherited base layer. Outside the board is dimmed and panning is limited to the board plus a small margin (grown to include anything left outside the edge, so nothing is unreachable). The detailed view: Areas, individual buildings, construction sites, roads, storage, and later the explicit connections between them (logistics and automation links). Areas are outlined zones with a multi-cell footprint; other objects (buildings, markers) can sit inside them. Selecting an Area shows its area type (focus), description, Danger Level (defaults to the Biome's, can be overridden), resources with Availability, assigned followers and notes. Selecting any object shows its full details and actions.

Zones and solid objects: on every map, Regions, Biomes and Areas are zones (outlines) and everything else (Settlements, markers, buildings) is solid. Zones can't overlap other zones and solid objects can't overlap other solid objects, but a solid object can sit inside a zone, for example a Settlement inside a Biome or a marker inside a Region. Which layer a placeable uses is set by `"layer": "zone"` in its placeables.json.

Navigation: double-click (or an Enter button) on a Region or Biome opens the next tab focused on it. A breadcrumb (World > Kie's Grove > Jade Garden) and the tab bar move back up. Each tab remembers its own camera position per container.

Areas are not enterable: they are outlined sections on the Biome Map's board, and buildings stay on the Biome Map.

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

- factions: `{ name, color, description, notes }`, an editable list the Arbiter fills (a character's alignment or allegiance).

- In stasis until the Combat stage (kept in the data and filled by the seed import, hidden in the app; `IN_STASIS` in `src/systems/characters/libraries.js`): teams `{ name, color }` (Ally, Enemy, Neutral) and conditions.

- Character libraries, all editable in Characters > Libraries, each entry with customFields (shapes in `src/systems/characters/libraries.js`):
  - species: name, staminaDefault, hungerMax, thirstMax (null = not set), notes, defaultFields copied onto its characters (Baseliner: Stamina 1, Hunger 5, Thirst 3; Vulture: Stamina, Hunger and Thirst blank, default fields Mask, Vault Value, Essence notes).
  - bodyTypes: name, species, rarity, maxLevel (null = not yet established), statCeiling, prerequisite, level progression table `[{ lv, bodyLv, STR, SPD, TOU, notes }]`, traits granted, description.
  - skills: name, tier (T1 to T5, or a special tier such as "Inner Monster"), adeptWith, required theories, canBoost (yes / no / blank), description, skillFeature, limitation.
  - traits: name, tags, description, narrativeFeature, mechanicalFeature. A Pact is a Trait tagged "Pact".
  - conditions (in stasis): name, description, mechanicalFeature.
  - equipment: name, grade (F, D, C, B, A, S, plus EX and Max flags), type, range, attackPower, damage, defense, protection, special or weapon trait, description.

- theories, recipes (later stages).

**containers:** every World, Region, Biome and Area. Fields: id, kind (`world` | `region` | `biome` | `area`), parentId, typeId, name, description, dangerLevel (Biomes and Areas; for an Area, empty means "same as its Biome"; Regions have none), species, civilizations and mapScale (Regions), residents notes, sparse tile map, list of placed object ids, for Biomes and Areas a list of resource availabilities `{ resourceTypeId, availability, notes, known }`, and for Areas assignedFollowerIds. Regions, Biomes and Areas also have `discovered` (true or false) and `undiscoveredName` (default "???"), used by Resolution Logs for places the followers haven't discovered. A resource's `known` flag says whether it has been found; logs say "Known Resource Found" and hide unknown ones.

**placedObjects:** id, containerId, kind (`region` | `biome` | `area` | `building` | `marker`), refId (the region, biome, area or building it represents), x, y, w, h, spriteKey, label.

**buildings:** id, buildingTypeId, name, areaId (optional: the Area it belongs to; empty means it stands alone on the Biome Map), constructionState, projectId (optional), storage (resource counts), properties (free-form key/value the Arbiter can add), notes.

**characters:** followers, enemies and NPCs (the stat sheet; shape in `src/systems/characters/characterModel.js`). Identity: name, factionId, speciesId, locationContainerId (a Region, Biome or Area), currentAssignment, bio, notes. Body: bodyTypeId, bodyTypeLevel, bodyLevel, STR, SPD, TOU, health `{ current, max }` (the Health formula proposes max: `MAX(1, ROUNDUP((Body Level + STR + TOU) / 3))`, from the Combat Profiles sheet, in `src/rules/health.js` and `tables/health.json`). Daily budget: staminaMax, staminaRemaining (separate from SPD). Needs: hunger and thirst `{ current, max }`. skills `[{ skillId, tier, level }]` plus defenseSkillId, theories `[{ name, percent }]`, traits `[{ traitId, note }]`, teamId and conditions `[{ conditionId or one-off name, modifier text, durationDays, note }]` (both in stasis), weapons `[{ equipmentId, qty }]`, armorId, otherGear, inventory, combat (manual text fields: resistance, defense, actions, attack, basePower, physicalDamageMod, effectiveDamage), alive, death `{ cause, day }` (the Death Log). Areas list the characters assigned to work there in `assignedFollowerIds` (name kept from before characters replaced followers).

**projects:** id, name, sizeLabel, workloadRequired, workloadCurrent, siteBuildingId, requirements (text and resource list), status (`planned` | `active` | `paused` | `complete`), and a workday history: for each day, the participants, Stamina invested, dice type, each die result, bonuses, Event roll, Event result and Arbiter notes.

**stockpiles:** resource counts owned by the kingdom, and per building or location.

**log:** the action log (see Commands) plus a full world snapshot saved at the start of every day.

Rules tables (Harvest availability ladders, Environmental Danger table, Work Die by Tier, Project sizes and Event table, Crafting tables, Point Conversion table) are stored as JSON in `/src/rules/tables/`, never hard-coded in logic, so the Arbiter can change a number without touching code.

## Resolution Logs (required for every roll system)

- Every resolution method (Project, Harvest, Crafting, Training, and any future one) produces a text log of the roll, formatted like the Arbiter's own write-ups. The format reference is `references/roll-log-examples.md` (to be added by the Arbiter); match its wording, order, separator lines and roll notation as closely as possible. Its examples come from older game days and say "Speed"; follow their format but write "Stamina".

- Each log lists: who took part; the location (shown as `[???]` followed by "(Location Name Not Discovered)" if the place is undiscovered, using its undiscoveredName); the Danger Level; what was attempted; the Stamina spent and dice (for example "King has spent 4 Stamina on this task: (+4d20)"); equipment and storage effects; every individual roll with its result; totals; and events.

- After rolling, the log appears in a panel with a "Copy" button. The Arbiter can edit the text before copying.

- Every log is also saved to that day's Day Log. The Log tab shows each day's full Day Log in order, with "Copy whole day" so the Arbiter can paste it straight into the day's write-up. The Arbiter can add free-text narration between entries.

- Log templates live in editable template files (one per resolution method) with placeholders, so the Arbiter can change wording later without code changes.

- If the Arbiter edits a result (overrides a roll or yield), the log shows the final value. An optional setting adds a small "(edited)" note.

- Stage 5 (Projects) is the first stage that must implement this.

## Task Cards (core UI for every Stamina-spending activity)

Mockups: `references/ui/task-card-mockup-1.png` (four cards) and `references/ui/task-card-mockup-2.png` (one card). They show the target look and layout; their placeholder text (the "Expedition" title, clock times, generic "Check" rolls) is superseded by the rules below.

- One shared window style for any task where characters spend Stamina. Title format: "[Type]: [Task name]" (Harvest, Project, Training, Crafting, and future types). Each type plugs into the card framework as a module (Extensibility rules).
- Header: type icon, task name, portraits of assigned characters.
- Scene banner: the Rendered View of the task's Area with character sprites (Stage 9); a plain colored strip before then. Yield bubbles (e.g. "+3 Wood") appear over the banner.
- Info panel: party size; location (shows [???] if undiscovered); Environmental Danger meter with 6 segments (Safe, Low, Moderate, High, Extreme, Lethal); member tiles showing portrait, Stamina spent, die type and source (e.g. "1 Stamina · d6 · Digger T1"), and key equipment icons.
- Type-specific info: Project shows a Workload bar (current / required); Harvest shows target resource and Availability; Training shows teacher, Theory and Max Possible Progress; Crafting shows Recipe, Crafting Cost and item count.
- Log panel: the Resolution Log for this task (see Resolution Logs), labeled by Day and roll number, never clock times (King's Game has no in-day clock). Entries show the real rolls from RULES.md (e.g. "Harvest Roll (Abundant): 14, Good Success, Yield 6" then "Danger (Moderate): None"). Copy and Copy whole day buttons. Training changes Theory percent, never stats.
- Arbiter controls (hidden in Player View): roll, reroll, edit any result, accept, cancel. Nothing commits until accepted.
- Player View hides Arbiter controls so cards can be screenshotted for players.
- Build order: Stage 5 builds the card framework in plain style with the Project type; Stage 6 connects Stamina and the Day Log; Harvest, Training and Crafting types come after the MVP; Stage 8.5 applies the pixel frame look shown in the mockups; Stage 9 fills the scene banner.

## Commands, undo and time

- Every change is a command object `{ type, payload, do(world), undo(world) }`, pushed to the action log.

- Undo and redo walk the log within the current day.

- Advance Day: save a snapshot, increment currentDay, reset every living character's staminaRemaining to their staminaMax, then present the end-of-day steps (food consumption, hunger and thirst, Project Event rolls) as proposals for the Arbiter to accept or edit. Do not auto-apply.

- Reverse Day: restore the previous day's snapshot after a confirmation.

- The Arbiter can manually set currentDay.

## Stamina and tasks

- Stamina is the daily activity budget. Each character has Stamina max and Stamina remaining. Advance Day resets Stamina remaining to Stamina max.
- SPD (Speed) is a separate combat stat from Body Types (turn order and Actions in combat). It does not affect daily tasks.
- Stamina max is an editable field with a default per species (Baseliner: 1). RULE NEEDED: how Stamina max is determined or increased (see Open Rules).

Assigning a character to a task spends Stamina from staminaRemaining. Every task record stores who, what, how much Stamina, the result and notes. Stamina values and costs are always editable. Do not invent an action economy beyond what RULES.md states.

## Interface

- Pixel-art inspired, game-like rather than spreadsheet-like. Compact, readable, icon-driven. Reference screenshots are in `/references` (Kingdom Maker Inc., Starmancer, Orb of Creation, Kingdom Two Crowns).

- Layout: main canvas in the center, management tabs across the top (World Map, Region Map, Biome Map, Followers, Projects, Resources, Log, Settings), contextual detail panel on the right when something is selected.

- Arbiter-only fields are flagged. A Player View mode hides Arbiter-only controls and information for screenshot export.

- Keep the UI simple. New systems get their own tab or panel, not more buttons on existing ones.

- Keep all UI styling centralized: colors, fonts, spacing, borders and panel styles come from shared CSS variables and reusable component classes (panel, button, tab, field, badge). No one-off inline styles in components. This keeps the Stage 8.5 overhaul a reskin rather than a rewrite. The one exception is a color that comes from the data (a tile type's, category's or faction's own color): pass it to a component class as a CSS variable (for example `style="--swatch: #5fbf55"` with `.swatch { background: var(--swatch) }`), not as a full inline style. The seven existing data-color inline styles (tile swatches, placeable dots, faction chips) should be moved to this pattern when those files are next touched.

## Development stages

Build one stage at a time. Each stage must run and be manually testable before starting the next. After each stage, update the Progress section below.

0. **Skeleton.** Vite project, folder layout, world schema, create a new world, world list, save and load to IndexedDB, JSON export and import.

1. **World Map canvas.** Sparse grid, pan, zoom, paint tiles, place, remove, select, move, duplicate.

2. **Region and Biome Maps.** Regions and Biomes as enterable objects, Areas as zones on the Biome Map, the three map tabs, breadcrumb, info panels, editable definitions for region, biome and area types.

3. **Buildings.** Multi-cell buildings on the Biome Map, either inside an Area (areaId, for example the Communal Sleeping Hole on a Building Site Area) or standing alone on the Biome Map, building type editor, placeholder sprites, editable properties, construction stage visuals (Empty Site, Foundation, Under Construction, Completed) driven by editable percentage thresholds.

4. **Characters.** Characters tab (followers, enemies, NPCs) with roster and stat sheet, every field editable: identity, Body Type and body stats, Stamina, needs, Skills, Theories, Traits and Pacts, Conditions, Equipment, a manual combat profile. Editable libraries (Species, Body Types, Skills, Traits, Conditions, Equipment, Teams). Theory and Skill helpers, death and Death Log. Import the seed data (see Seed Data). No combat formulas: combat values are plain fields until the Combat stage.

5. **Projects.** Create a Project on a building site, assign followers, choose Stamina, roll Work Dice per RULES.md, roll the Event, show the proposed result, Arbiter accepts, edits or rerolls. First stage that must produce Resolution Logs (see that section) and the Day Log in the Log tab.

6. **Time.** Stamina tracking, task records, Advance Day with proposals, undo, redo, reverse day.

7. **Persistence and sharing polish.** Multiple worlds, Player View screenshot mode.

8. **Notes.** A Notes tab for long-form game notes (rules drafts, lore, session logs, world state). Markdown text, titles, tags, folders, search. Any note can link to followers, regions, biomes, areas, buildings and projects, and those records show their linked notes. Import from Markdown or plain text files so notes can be moved over from UpNote.

8.5. **UI Overhaul (pixel UI kit).** Replace the placeholder interface with pixel-art UI elements the Arbiter downloads from itch.io: panels and frames, buttons, tabs, scrollbars, sliders, checkboxes, tooltips, icons, cursors and a pixel font.
   - Theme layer: all UI art is loaded through one theme definition (which image is used for panels, buttons, icons, fonts and colors), so a UI kit can be swapped or updated by changing the theme files, not the app code.
   - Panels and buttons use 9-slice scaling so pixel frames stretch to any size without blurring. Pixel-perfect rendering (nearest-neighbor, integer scale).
   - An icon set for resources, stats (STR, SPD, TOU, Health), conditions, building categories and map tools, with text fallbacks if an icon is missing.
   - Each UI asset records its source pack, author, URL and license. Purchased or restrictive-license UI packs live in /assets-private/ (listed in .gitignore, never pushed); free CC0-style packs may be committed.
   - Keep the layout from earlier stages: this stage changes the look, not how things work.

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

   Detail levels
   - The renderer uses a detail level per map, because each map shows the land at a different scale:
     - World Map: low detail. Terrain colors, ponds, tiny sparse trees.
     - Region Map: medium detail. Geysers, more trees, bushes, small rocks.
     - Biome Map: high detail. Larger detailed props such as boulders, full trees and grass tufts, drawn bigger on the framed board.
   - Each tile type has separate density settings per detail level (for example Grassland trees: World Few, Region Sparse, Biome Moderate).
   - Details avoid water and roads, and trees keep a small gap from shores.
   - Objects are sorted by y so lower ones draw in front.
   - The Arbiter can Reroll the seed, Lock the result, and click any detail to move or delete it. Locked and edited details are saved.

   Stamps (optional assets)
   - Assets are not used automatically. They are stamps the Arbiter chooses to place by hand.
   - Asset Library tab: import single PNGs or a sprite sheet on a plain white background. The sheet importer auto-detects each object, removes the background, trims it, and lets the Arbiter name and tag each piece. Tags come from names (every word is a tag, numbers ignored, plurals singular) and stay editable.
   - Stamp palette in Rendered view: search or filter stamps by tag, click one, then click the map to place it. Placed stamps can be moved, scaled in whole-number steps, flipped, layered above or below, and deleted. Stamps snap to the pixel grid, and also to the tile grid if snapping is on.
   - Placed stamps are saved per container as decoration objects. They are visual only; they don't change game data unless the Arbiter links a stamp to a building or other record.
   - Buildings can optionally use a chosen stamp per construction stage. If none is set, the renderer draws a simple code-drawn placeholder for each stage.

10. **Combat.** Implement the King's Game combat rules once the Arbiter finalizes them (currently in the Combat Profiles sheet, Rules tab). Until then the combat profile on each character stays manual, and no combat formulas, attack rolls or calculated combat values are written. This stage also brings Teams (Ally, Enemy, Neutral) and Conditions back out of stasis.

11. **Skill Tree** (later stage). A visual tree of how progression connects: Theories lead to Skills, Skills tier up into higher-tier Skills (T1 to T5), and Skills or other conditions can lead to Traits.
    - Built from the Skills and Traits libraries: each Skill's required Theories, each tier-up's required Skills, and an optional "leads to" list on Skills and Traits.
    - Nodes show the name and tier, color-coded by status for a selected character: known, in progress (with percent), or not started.
    - The Arbiter can add, remove or edit links by hand. Nothing is assumed; unknown links stay blank.

12. **Tech Tree** (much later stage). A kingdom-level tree of technologies and discoveries (for example Claw Weapons, Scaled Armor, Metal Remedies, Grove Medicine).
    - Shows each technology's prerequisites (Skills, resources, Recipes, buildings or other technologies) and what it unlocks.
    - Tracks which technologies the kingdom has discovered, is researching, or hasn't found.
    - Uses the same node and link system as the Skill Tree.

After the MVP (do not start without being asked): Harvesting tab, resources and stockpiles UI, Crafting, Training, building connections and automation (always pausable and overridable), Morale and Prosperity, population groups, Units, Armies.

## Seed data

Characters: the current test world uses the 10 test characters from `references/test-characters.json` (with its Skills, Traits, Pacts, Conditions and Equipment) and the Body Types in `references/body-types.json`, loaded with Characters > Import seed data. The real follower roster (`references/roster.txt`) will be imported in a later stage; do not import it until asked.

The rest of the first test world should recreate the current campaign: Day 8, the Communal Sleeping Hole Project at 30 of 75 Workload, and the map:

- Regions on the World Map: the Central Grasslands, Kie's Grove, the Ruined Forge of Creation and the Tower of Apocalypse.
- Biomes on the Region Maps: the Jade Garden (in Kie's Grove) with its resources; the Grasslands, a single Biome covering the whole Central Grasslands Region.
- Areas on the Biome Maps: a Building Site Area holding the Communal Sleeping Hole building and its Project (the Arbiter will say which Biome it is in). The Arbiter will provide the world notes as text files.

## Working agreement for the AI

- Before writing code for a stage, briefly state the plan and the files you will touch.

- Keep files small and focused. Prefer adding a module over growing one past roughly 300 lines.

- Write Vitest tests for every rules function, using the worked examples in RULES.md (for example the Stone Spear crafting example) as test cases.

- When a rule is missing, do not guess. Leave it editable, mark it `// RULE NEEDED:`, and add it to Open Rules.

- After finishing a stage, tell the developer exactly how to test it by hand.

## Progress

- [x] Stage 0: world schema (v1), IndexedDB save/load with autosave, world list (create, open, delete), JSON export/import (an import never overwrites: a clashing id becomes a copy), command registry with undo/redo (Ctrl+Z / Ctrl+Y), Log and Settings tabs (rename world, set day). Map, Followers, Projects and Resources tabs are placeholders.
- [x] Stage 1: World Map canvas. Shared map engine in `src/map` (camera, sparse grid, renderer, tools, panels) usable by any container. Tools: select/move, pan (drag, right/middle drag, WASD), zoom at cursor, paint and erase tiles (one undo step per stroke), place Region or Marker, remove, duplicate, edit properties (name, position, size, color, sprite key). Editable tile types. Generic `customFields` editor on every placed object. System registry (`src/systems/registry.js`) with World Map as the first system. Schema v2 (migration 1 to 2 adds customFields, object color, default tile types).
- [x] Stage 2: Region Map and Biome Map systems (`src/systems/regionMap`, `src/systems/biomeMap`) on the shared map engine. Navigation state (`src/ui/navigation.js`) holds the open tab, Region and Biome; enter with double-click, Enter key or the Enter button; breadcrumb on every map; cameras saved per container in localStorage (view state, not world data); each map keeps its own selection. Region info panel (name, type, description, species as shared `definitions.species`, civilizations, Biomes here, notes, Region Map scale; no Danger Level) and Biome info panel (Environmental Danger Level, resources as shared `definitions.resourceTypes` with Availability, residents, notes); with nothing selected the Region and Biome Maps show their own container's info. Bounded Region Map (`src/map/regionFrame.js`, now `mapFrame.js`): the Region's World Map footprint scaled up by its mapScale, with the World Map tiles drawn scaled up as the background and everything outside the edge shaded and blocked. Areas on the Biome Map: containers of kind `area`, drawn as outlined zones; info panel with area type (focus), Danger Level inherited from the Biome unless overridden, resources, assigned followers (empty until Stage 4), notes. Danger and Availability ladders are rules tables in `src/rules/tables/`. Editable Region, Biome and Area types (name, color, default fields copied on when a type is set). Settlement placeable = Biome with the Settlement type, drawn as a block. Two occupancy layers: Regions, Biomes and Areas are zones, Settlements and markers are solid; each only blocks its own layer, so Settlements and markers can sit inside Biomes and Regions. Removing a Region, Biome or Area warns what is inside and removes and restores all of it in one undo step. Generic `batch` command for one-step multi-changes. Schema v5 (migration 2 to 3 adds typeId, speciesIds, civilizations and starter types; 3 to 4 renames Sub-Areas to Biomes in data and the undo log, adds Area types and assignedFollowerIds; 4 to 5 adds mapScale).
- [x] Stage 3: Buildings system (`src/systems/buildings`). Shared map engine hook `src/map/objectKinds.js`: a system registers a kind of placed object backed by its own record (create, duplicate, linked records, name, draw, info panel, re-link on footprint change) and can add placeables to a kind of map, so the Biome Map gets "Building" without the biomeMap system changing. Place/remove payloads carry `linked` records, so removing a building, or a Biome or Region holding buildings, undoes in one step. A building is a placed object (kind `building`, solid layer) plus a `buildings` record (type, name, areaId, constructionProgress 0-100, forcedStage, projectId for Stage 5, storage counts, properties as key/value, stageStamps for Stage 9, notes, customFields). Placing it links it to the Area covering most of its cells; moving, rotating or resizing re-links; the panel can change the link. Rotate (R or button) turns non-square footprints around their center with overlap and edge checks (`setFootprint` command). Placeholder visuals per stage: Empty Site dashed outline, Foundation hatched, Under Construction partly filled, Completed solid, plus a progress bar; color from the type's category. Stage = highest threshold at or below progress (`stages.js`, thresholds per type, defaults in `tables/constructionStages.json`), or a forced stage. Buildings tab: building type editor (name, category, default footprint, stage thresholds, default properties, custom fields), category editor (name, color), list of all buildings with Show. Duplicates start with empty storage. Schema v6 (migration 5 to 6 adds starter building categories).
- [x] Discovery data (for Resolution Logs): Regions, Biomes and Areas have `discovered` and `undiscoveredName` ("???"); resources listed in Biomes and Areas have `known`. Checkboxes in the info panels. Schema v7 (migration 6 to 7: existing places start discovered, existing resources known).
- [x] Stage 3.5: Linked map levels (`src/map/mapFrame.js`). One rule for World to Region and Region to Biome: the child map covers its footprint on the parent scaled by its mapScale (default 8, editable in the Region and Biome panels), with the parent's terrain under the footprint as an inherited base layer (`terrainAt`: own paint, else inherited, recursively), recomputed each draw so parent paint shows up live. Parent maps draw a mini preview of each child's own paint and objects inside its outline (`src/map/childPreview.js`); hovering any object shows its name. Biome Map is a framed board: thick border, dimmed outside, camera clamped to the board plus a 64px margin (`clampCamera`). Zoom levels 2 and 3 added so a whole board fits on screen (only every 10th grid line below 4px). Schema v8 (migration 7 to 8 sets Biomes' unused mapScale to 8; Regions keep theirs).
- [x] Stage 4: Characters system (`src/systems/characters`): Characters tab with Roster, Libraries and Import seed data views. Schema v9 (migration 8 to 9: the unused followers collection becomes characters; adds teams and the character libraries; species get Hunger max, Thirst max and default fields; Baseliner and Vulture added or completed). Libraries: generic editor driven by field lists in `libraries.js` (Body Types have a level table editor, `levelsTable.js`). Roster: live search, sort, filters (team, species, Body Type, location, alive or dead), compact rows (team, species, Body Type, STR, SPD, TOU, Health, Speed remaining / SPD, condition icons; Speed renamed Stamina later, see below), Death Log section. Stat sheet: every field editable; choosing a Body Type and level shows the table's stats (and granted Traits) as a proposal to Apply or ignore (`src/rules/bodyTypes.js`); stat ceiling warning; Level up body shows the next row and the prerequisite; Health is manual; Skill Bonus = Level - 1 shown per Skill; one Defense Skill; Theory and Skill helpers (`src/rules/skills.js`, tier labels, special tiers have no Tier-up); Traits and Pacts from the library with a note; Conditions from the library or one-off; weapons, armor or shield, other gear, inventory; collapsed manual combat profile (no calculation). Death clears assignments in one step; Revive. Seed import (`seedImport.js`, tested on the real files): libraries first, then characters linked by name; unmatched names become new flagged entries; existing entries are reused, never overwritten; one undo step. Hooks: `src/ui/infoSections.js` (systems add sections to Region/Biome/Area panels: "Characters here") and map badges in `objectKinds.js` (character count on each Area).
- [x] Stage 4 revisions: Factions (editable library, on the sheet, roster column and filter) replace Teams on screen; Teams and Conditions are in stasis (data and seed import kept, hidden until the Combat stage). Health max formula from the Combat Profiles sheet (`src/rules/health.js`, tested against all 10 seed characters) shown on the sheet with a Use button, and applied with Body Type table proposals and Level up body (current Health is left alone). Schema v10 (migration 9 to 10 adds factions and factionId).
- [x] Stamina: the daily activity budget is Stamina (staminaMax, staminaRemaining on characters, staminaDefault on species, Baseliner 1), separate from the combat stat SPD. RULES.md task wording renamed from Speed to Stamina. Sheet shows "Stamina remaining today / Stamina max" with the Needs; roster shows Stamina remaining. Schema v11 (migration 10 to 11 copies the old daily Speed values into Stamina; SPD unchanged).
- [ ] Stage 5
- [ ] Stage 6
- [ ] Stage 7
- [ ] Stage 8
- [ ] Stage 8.5
- [ ] Stage 9

## Open Rules (ask the Arbiter, do not invent)

- How Skill Level increases, and its maximum (RULES.md implies Lv 10).

- When a Skill tiers up: are the combined Theories or Skills consumed, and what happens to its Level?

- How Stamina max is determined or increased (it is an editable field with a species default, Baseliner 1, for now).

- Full attribute list and meaning (seen: Strength, Agility, Intelligence, Charisma, Willpower, Might) and what Body Type means.

- Training: table from the d20 teaching quality roll to the number of dice, and the Understanding Roll success ladder.

- Thirst consequences per day without water.

- Conditions and healing: durations, how injuries heal.

- The combat system (in testing by the Arbiter; to be added as its own later stage, Stage 10). Combat values are manual fields until then.

- Hunger and Thirst for Vultures (left blank on the Vulture species).

- When a Theory becomes a T1 Skill, is the Theory removed? (RULES.md says it "becomes" the Skill, but T1 to T2 needs 5 Theories at 100%, so some must stay as Theories.) For now a checkbox, on by default.

- Morale and Prosperity rules.

- Trait and Pact structure.

- Equipment and tool bonuses for Projects and Harvests; carry limits with storage equipment.

- Specific Boon and Setback options for Project Events.

- Harvest carry limit without storage equipment (seen as 6 per Stamina for Emerald Puff Fruits): is it per resource, or a general rule?
