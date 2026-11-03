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

- Each system declares where its screens live (`places: [{ path: 'main/sub/subsub', render }]` in its `index.js`, see Interface > Navigation). It never adds a main tab.

- Every record (follower, region, biome, area, building, project, item) has a `customFields` object. The Arbiter can add, rename and remove custom fields and stats in the app with no code, so a new rule can be tracked before it is ever automated.

- Every schema change increments `schemaVersion` and adds a migration in `src/data/migrations.js`, so old saves always load after an update.

- Rules values live in JSON tables, never hard-coded.

- Every system is faction-aware (see Factions and ownership). Anything a system adds that can belong to someone (resources, buildings, tasks, Morale, Harvesting, Crafting, Training, Combat, and every later system) stores an owner faction, follows the faction selector, and writes its Day Log entries with the faction they belong to. Moves between factions go through a transfer command that logs for both factions.

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
  /sync              world file sync: the world saved to a .json file in a synced folder
  /systems           one self-contained folder per game system (see Extensibility)
    registry.js      the one central list every system registers itself in (and its places)
    /<name>          that system's data slice, commands, rules tables, screens and panels
  /assets            sprites (optional; app must work with none)
/tests               Vitest tests for /rules
RULES.md             the King's Game rules, written by the Arbiter
CLAUDE.md            this file
```

Modules talk through the world store and commands. UI never edits data directly; it dispatches commands.

## World file sync (using one world on several computers)

**Rule: never edit the same world on two computers at the same time.** The app warns, but it cannot merge two sets of changes: when both computers change the world, one version wins and the other is only kept as a backup file.

How it works (`src/sync`, Chrome and Edge only, through the File System Access API; no server, no accounts):

- A world can be linked to a world file: a `.json` file the Arbiter picks, for example in a Google Drive for desktop, OneDrive or Dropbox folder that the sync service keeps the same on every computer. Settings > World file > "Save world as file" links the open world; on another computer, the world list's "Open world file" opens it (taking the same world id, so it is the same world, not a copy). After picking the file, the Arbiter is asked to confirm its folder (the browser can't find a file's folder by itself); that folder holds the backups. The link (file and folder handles, the last revision seen, unsaved-changes flag) is stored per world in IndexedDB (`fileLinks` store); the browser asks again for permission when needed (the top bar's file button says "allow access").
- The world file is the normal world JSON plus a top-level `sync` block: `{ revision, lastSavedAt, lastSavedBy, openOn, openOnAt }`. `sync` is save bookkeeping, not world data: it is never in the world in memory, Import JSON drops it, and changing it is not a command. The world data itself still changes only through commands.
- IndexedDB stays the local copy and cache. Every change is saved there at once, then to the world file after a few seconds without changes (autosave delay), and at once when the day changes (`setCurrentDay`, and the Stage 6 `advanceDay` / `reverseDay` commands: keep those type names, or call `saveFileNow()`). Leaving the world (< Worlds) or switching away from the tab saves waiting changes.
- Every save of the world adds 1 to `sync.revision`. Before writing, the app re-reads the file: if its revision is not the one this computer last loaded or saved, another computer saved it, and the app stops saving and asks: Reload theirs (this computer's unsaved changes are kept as a backup), Keep mine (theirs is backed up first, then mine is saved), Save mine as a copy (mine becomes a new world with its own file; this world takes theirs), or Decide later.
- Opening a world and returning to its tab check the file. If it is newer and this computer has no unsaved changes: "This world was changed on [device] at [time]. Reload?". Nothing is saved to the file until the Arbiter chooses.
- `openOn` names the computer that has the world open. It is written when the world opens and cleared when it closes, without changing the revision or the world. Opening (or returning to) a world open on another device shows "This world may be open on [device]"; the Arbiter can continue anyway. Closing a tab without leaving the world can leave a stale marker: the warning says so.
- Backups: before a save overwrites the file, the old file is copied to `backups/` next to it, as `<file name> backup <date time>[ - note].json`, at most once per "minutes between backups" plus whenever the day changes, and before Keep mine, Reload theirs and Restore. The newest N are kept (other worlds' backups in the same folder are left alone). Settings > Backups lists them; Restore makes a backup the world and the file (backing up the current file first).
- This computer's settings (device name, autosave on or off, autosave delay, backups kept, minutes between backups) belong to the computer, not the world: they are in localStorage (`src/sync/deviceSettings.js`), shown in Settings > This computer.
- Browsers without the File System Access API (Firefox, Safari) can't link world files: the app says so and the Arbiter moves worlds with Export JSON and Import JSON.

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
- Moving paint (`src/map/paintBlock.js`, any tool except Pan): Ctrl+drag draws a selection box around paint; Ctrl+drag inside the box moves its painted cells (one `paintTiles` command, one undo step; empty cells in the box don't cover anything; the move is refused if paint would leave the map's edge). Delete erases the box's paint, Esc or a plain click clears the box. Only the map's own paint moves, never the inherited base layer or objects.

- An object must still exist, display and be editable if its sprite is missing. Fall back to a colored square with a short label.

## Data model

One world (campaign) is one JSON document with a `schemaVersion`. Every record has a unique `id`. Definitions (types) are separate from instances (things in the world) and are editable in the app.

Every instance record (containers, buildings, followers, projects, and items when they are added) also has a `customFields` object: Arbiter-made fields and stats, added, renamed and removed in the app. Each field stores its name, value type and value. These are not repeated in the field lists below.

**meta:** name, currentDay, schemaVersion, created and modified dates.

**definitions:**

- regionTypes, biomeTypes, areaTypes (an Area's focus: Mine, Farm, Building Site, Harvest Zone, District...), buildingTypes (default footprint, construction stage thresholds, sprite key), tileTypes (paint colors and textures).

- resourceTypes: name, description, tags (for example `[Wood]`, `[Food]`, `[Medical Herb]`, `[Special]`), foodValue (Food per unit, default 1; a resource tagged Food feeds characters at Advance Day).

- factions (Factions tab; shape in `src/data/factions.js`): name, type (Player, NPC, Wild/Monster, Unaligned), color, banner icon, leader (a character), home location, description, notes, relations `{ otherFactionId: stance }` (Allied, Friendly, Neutral, Wary, Hostile, At War, each direction separate, unset = Neutral; list in `src/data/defaults/stances.json`), trackNeeds and usesStamina (Advance Day), and for Player factions sparkNotes and followerCallNotes (manual for now; Authority Level moved to the Crown Bearer in Stage 6.6). Factions replaced the old Teams.

- connectivity: `{ levels: [{ level, description, notes }] }`, each Connectivity level's reminder text (RULES.md, Crown Bearers > Connectivity), editable in Crown Bearers > Connectivity with "Reset to RULES.md". Default in `src/rules/tables/connectivity.json` (a test keeps it equal to RULES.md); helpers in `src/rules/connectivity.js`.

- In stasis until the Combat stage (kept in the data and filled by the seed import, hidden in the app; `IN_STASIS` in `src/systems/characters/libraries.js`): conditions.

- Character libraries, all editable in Characters > Libraries, each entry with customFields (shapes in `src/systems/characters/libraries.js`):
  - species: name, baseStamina (for the Stamina formula), hungerMax, thirstMax (null = not set), notes, defaultFields copied onto its characters (Baseliner: Base Stamina 1, Hunger 5, Thirst 3; Vulture: Base Stamina, Hunger and Thirst blank, default fields Mask, Vault Value, Essence notes).
  - bodyTypes: name, species, rarity, maxLevel (null = not yet established), statCeiling, prerequisite, level progression table `[{ lv, bodyLv, STR, SPD, TOU, notes }]`, traits granted, description.
  - skills: name, tier (T1 to T5, or a special tier such as "Inner Monster"), adeptWith, required theories, canBoost (yes / no / blank), description, skillFeature, limitation.
  - traits: name, tags, description, narrativeFeature, mechanicalFeature. A Pact is a Trait tagged "Pact".
  - conditions (in stasis): name, description, mechanicalFeature.
  - equipment: name, grade (F, D, C, B, A, S, plus EX and Max flags), type, range, attackPower, damage, defense, protection, special or weapon trait, description.

- theories, recipes (later stages).

**players:** name, notes, factionIds (the factions they control), and connections: the Crown Bearer(s) they are connected to, `[{ crownBearerId, connectivity (1 to 10), history: [{ day, oldLevel, newLevel, reason }] }]` (`src/data/factions.js`, `src/data/crownBearers.js`). Players are Crown Bearers (RULES.md): the player plays through the Crown Bearer, and Connectivity says how closely.

**crownBearers:** name, title (e.g. First Sky King), pronouns, personalityNotes (personality and values), authorityLevel, factionId (the faction ruled), crownId, vesselId (the current vessel, a character; '' = none), vesselHistory `[{ characterId, name, fromDay, toDay, ended }]`, status (`inVessel` | `withoutVessel`), sparkNotes `{ [day]: text }` (Spark of Change notes per day), divergenceNotes, notes (`src/data/crownBearers.js`).

**crowns:** relic items: name, description, attunedBearerId, location `{ kind: 'vessel' (worn by the attuned Crown Bearer's vessel) | 'place' (containerId) | 'character' (characterId) | 'unknown', note }`, notes.

**Vessels.** A Crown Bearer's body is a character (its vessel). "Change vessel" closes the old vessel's history line (with how it ended) and opens a new one. When a vessel dies (Mark dead), its Crown Bearer becomes "without vessel" in the same undo step and the Arbiter is asked where the Crown is now; there is no automatic recovery (RULES.md: Crown recovery is played out in the writing). Connectivity effects are reminders only and are never enforced.

**containers:** every World, Region, Biome and Area. Fields: id, kind (`world` | `region` | `biome` | `area`), parentId, typeId, name, claimFactionId (Regions, Biomes and Areas: the faction that claims it, '' = unclaimed; the map draws a dashed border in its color), description, dangerLevel (Biomes and Areas; for an Area, empty means "same as its Biome"; Regions have none), species, civilizations and mapScale (Regions), residents notes, sparse tile map, list of placed object ids, for Biomes and Areas a list of resource availabilities `{ resourceTypeId, availability, notes, known }`, and for Areas assignedFollowerIds. Regions, Biomes and Areas also have `discovered` (true or false) and `undiscoveredName` (default "???"), used by Resolution Logs for places the followers haven't discovered. A resource's `known` flag says whether it has been found; logs say "Known Resource Found" and hide unknown ones.

**placedObjects:** id, containerId, kind (`region` | `biome` | `area` | `building` | `marker`), refId (the region, biome, area or building it represents), x, y, w, h, spriteKey, label.

**buildings:** id, buildingTypeId, name, ownerFactionId, areaId (optional: the Area it belongs to; empty means it stands alone on the Biome Map), constructionState, projectId (optional), storage (resource counts), properties (free-form key/value the Arbiter can add), notes.

**characters:** followers, enemies and NPCs (the stat sheet; shape in `src/systems/characters/characterModel.js`). Identity: name, factionId (one current faction), factionHistory `[{ factionId, fromDay, toDay (null = still in it), reason }]`, speciesId, locationContainerId (a Region, Biome or Area), currentAssignment, bio, notes. Body: bodyTypeId, bodyTypeLevel, bodyLevel, STR, SPD, TOU, health `{ current, max }` (the Health formula proposes max: `MAX(1, ROUNDUP((Body Level + STR + TOU) / 3))`, from the Combat Profiles sheet, in `src/rules/health.js` and `tables/health.json`). Daily budget: staminaMax (the Stamina formula proposes it), staminaMaxOverride, staminaRemaining (SPD feeds the formula but is otherwise a combat stat). Needs: hunger and thirst `{ current, max }`. skills `[{ skillId, tier, level }]` plus defenseSkillId, theories `[{ name, percent }]`, traits `[{ traitId, note }]`, conditions `[{ conditionId or one-off name, modifier text, durationDays, note }]` (in stasis on the sheet), weapons `[{ equipmentId, qty }]`, armorId, otherGear, inventory, combat (manual text fields: resistance, defense, actions, attack, basePower, physicalDamageMod, effectiveDamage), alive, death `{ cause, day }` (the Death Log). Areas list the characters assigned to work there in `assignedFollowerIds` (name kept from before characters replaced followers).

**projects:** id, name, ownerFactionId, sizeLabel, workloadRequired, workloadCurrent, siteBuildingId, driveBuilding, locationContainerId, requirements (checklist `{ kind, text, refId, met }`), status (`planned` | `active` | `paused` | `complete`), notes, and a workday history: for each day, the participants, Stamina invested, dice type, each die result, bonuses, total, Event roll, Event result, effect and Arbiter notes, plus the log (shape in `src/systems/projects/projectModel.js` and `workdayAccept.js`).

**tasks:** simple tasks (Stamina spent on anything without a Resolution Method yet): day, description, ownerFactionId, location, participants `[{ characterId, name, stamina }]`, result, notes, log (`src/systems/time/taskModel.js`).

**dayLogs:** per day, `startOfDays` (one Start of Day record per Player faction: Spark of Change, Spark of Balance, followers offered and accepted or refused, day event, notes, and its text) and the ordered Day Log entries (Resolution Logs, simple tasks, transfers, each faction's "Day N ended" summary and narration), each with the factionId whose day it belongs to ('' = every faction's), see `src/data/dayLog.js`.

**stockpiles:** records `{ name, ownerFactionId, placeId ('' = the faction's main stockpile), counts: { resourceTypeId: count }, notes }` (`src/systems/resources/stockpileModel.js`). Each faction has a main stockpile and may keep more at places. Minimal (counts set by hand, eaten at Advance Day) until the Resources stage.

**Factions and ownership.** Characters have one current faction (plus their history); stockpiles, buildings, Projects and simple tasks have an owner faction; Regions, Biomes and Areas may be claimed. Changing a character's faction, a building's owner, or moving resources between factions (trade, gift, theft, loss) is a transfer command (`src/systems/factions/transfers.js`) that logs a Day Log entry for both factions. The Day number is shared by the whole world.

**log:** the action log (see Commands) plus end-of-day snapshots: the whole world (without its log) saved by Advance Day just before the day changes, the newest `meta.settings.snapshotsKept` kept (default 30), see `src/data/snapshots.js`.

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
- A window (about 750 x 560 pixels, like a game's console window) over its tab that the Arbiter can drag by its header, anywhere in the center area up to the side panel. A tall scene banner (150 px) is kept for the Stage 9 scene and animation. Anything that does not fit, such as Edit details, scrolls inside it. A setup step shows only its questions in the Info pane.
- Header: type icon, task name, portraits of assigned characters.
- Scene banner: the Rendered View of the task's Area with character sprites (Stage 9); a plain colored strip before then. Yield bubbles (e.g. "+3 Wood") appear over the banner.
- Info panel: party size; location (shows [???] if undiscovered); Environmental Danger meter with 6 segments (Safe, Low, Moderate, High, Extreme, Lethal); member tiles showing portrait, Stamina spent, die type and source (e.g. "1 Stamina · d6 · Digger T1"), and key equipment icons.
- Type-specific info: Project shows a Workload bar (current / required); Harvest shows target resource and Availability; Training shows teacher, Theory and Max Possible Progress; Crafting shows Recipe, Crafting Cost and item count.
- Log panel: plays line by line and pauses at Oregon Trail style questions (Y/N, or typed answers) marked as `{{@stop}}` lines in the log template. The Resolution Log for this task (see Resolution Logs), labeled by Day and roll number, never clock times (King's Game has no in-day clock). Entries show the real rolls from RULES.md (e.g. "Harvest Roll (Abundant): 14, Good Success, Yield 6" then "Danger (Moderate): None"). Copy and Copy whole day buttons. Training changes Theory percent, never stats.
- Arbiter controls (hidden in Player View): roll, reroll, edit any result, accept, cancel. Nothing commits until accepted.
- Player View hides Arbiter controls so cards can be screenshotted for players.
- Build order: Stage 5 builds the card framework in plain style with the Project type; Stage 6 connects Stamina and the Day Log; Harvest, Training and Crafting types come after the MVP; Stage 8.5 applies the pixel frame look shown in the mockups; Stage 9 fills the scene banner.

## Commands, undo and time

- Every change is a command object `{ type, payload, do(world), undo(world) }`, pushed to the action log.

- Undo and redo walk the log within the current day.

- Advance Day (`src/systems/time`): a wizard of proposals, each editable or skippable: Review (unspent Stamina, Projects with no workday today, food, open drafts), Meal (food eaten from which stockpiles, who eats), Needs (Hunger, Hungry, Thirst), Conditions (durations count down, 0 proposed for removal), Stamina (reset to max), Summary. Accept saves a snapshot, then applies everything as ONE `advanceDay` command (a day boundary: undo stops there), adds "Day N ended" to the Day Log and saves the world file at once. Nothing is auto-applied before Accept. Project Events are rolled on each workday (Stage 5), not at Advance Day.

- Reverse Day: after a confirmation that says what will be lost, restores the newest snapshot (the previous day just before Advance Day), or any older one from the list. The action log is cut back to that point, so that day's own actions can still be undone. It replaces the whole world, so it is not a command: the world as it was is kept as a "before Reverse Day" snapshot and "Undo Reverse Day" takes it back.

- The Arbiter can manually set currentDay.

## Stamina and tasks

- Stamina is the daily activity budget. Each character has Stamina max and Stamina remaining. Advance Day resets Stamina remaining to Stamina max.
- SPD (Speed) is a separate combat stat from Body Types (turn order and Actions in combat). It does not affect daily tasks.
- Stamina max follows the formula in RULES.md (Followers > Stamina): Species Base Stamina + FLOOR((SPD - 1) / 2) (Baseliner Base 1; `src/rules/stamina.js`, `tables/stamina.json`). It is a stored field: the sheet shows the breakdown ("1 base + 1 from SPD 4 = 2"), proposes the formula's value when SPD changes (accepted with Use, or with the Body Type table or level-up), and the Arbiter can override it per character (`staminaMaxOverride`, with Return to formula). A species with no Base Stamina shows a warning and Stamina max is manual.

Assigning a character to a task spends Stamina from staminaRemaining. Every task record stores who, what, how much Stamina, the result and notes. Stamina values and costs are always editable. Do not invent an action economy beyond what RULES.md states.

## Interface

- Pixel-art inspired, game-like rather than spreadsheet-like. Compact, readable, icon-driven. Reference screenshots are in `/references` (Kingdom Maker Inc., Starmancer, Orb of Creation, Kingdom Two Crowns).

- Layout: the top bar, the main tabs with their sub-tab and sub-sub-tab rows, the content in the center, the contextual detail panel on the right, and the bottom quick bar (see Navigation).

### Navigation

- At most 6 main tabs. Each main tab has at most 5 sub-tabs. A third level (sub-sub-tabs) is used only when a sub-tab needs it.
- Every system registers where it lives (main tab, sub-tab, optional sub-sub-tab) through the central registry: a system's `index.js` lists `places: [{ path, render(world, { detailPanel, path }) }]`, and `src/systems/registry.js` registers them. The layout itself (labels, order, icons, planned slots) is in `src/ui/tabLayout.js`; `registerPlace` refuses an unknown main tab or a 6th sub-tab. New systems must fit into an existing main tab; never add a 7th main tab. A slot with no screen shows "Coming in a later stage". A test (`tests/tabLayout.test.js`) checks the limits and that every slot not planned for later is filled.
- Each main tab remembers the last sub-tab opened (and each sub-tab its last sub-sub-tab). Keyboard shortcuts 1 to 6 switch main tabs (not while typing). The old flat tab ids still work in `navigate({ tab })` through each sub-tab's `alias`.
- Style: main tabs are large icon-and-label buttons, sub-tabs a row of smaller buttons below them, sub-sub-tabs a smaller row below that (similar to Orb of Creation). They use the shared component classes `.main-tab`, `.sub-tab`, `.subsub-tab` (and `.quick-bar`), so Stage 8.5 can reskin them.
- Layout:
  1. World: World Map | Region Map | Biome Map | Locations (Regions, Biomes, Areas: a searchable list with discovered flags)
  2. Realm (follows the faction selector): Today (Overview, Tasks, Advance Day) | Projects (Active, Planned, Completed) | Resources (Stockpiles, Transfers) | Buildings (By Area, All) | Factions (Factions, Relations)
  3. People: Roster (Living, Death Log) | Crown Bearers (Bearers, Connectivity, Vessels) | Progression (Theories & Skills)
  4. Chronicle: Day Log (By Day, Copy Day) | Notes (Stage 8) | History (undo and redo action list, Reverse Day, Set Day, day snapshots)
  5. Codex (Arbiter only, hidden in Player View): Library (Species, Body Types, Skills, Traits, Conditions, Equipment, Resource Types) | World Types (Region, Biome, Area, Building, Tile Types) | Rules (Rule Tables, Log Templates, Open Rules) | Assets (Stage 9)
  6. System: Worlds (Open, Save File, Import/Export, Backups) | Display (Theme, Player View) | Preferences (Device Name, Autosave, Snapshots)
- Always visible outside the tabs:
  - Top bar: world name, Day N, Advance Day button (opens Realm > Today > Advance Day), faction selector, Player View toggle, undo and redo (plus the save and world file status).
  - Right panel: details of the current selection, on any tab.
  - Bottom quick bar (`src/ui/quickBar.js`): up to 6 pinned shortcuts the Arbiter chooses (a screen, a Project, a character, an Area), saved per world on this computer (localStorage). Systems add pin kinds with `registerPinKind`.
- Planned future placements (not built yet): Recipes and Crafting under Realm > Resources; Morale, Territory and Tech Tree under Realm > Factions; Skill Tree under People > Progression; Military (Units, Armies, Combat) as a new sub-tab under People; Harvesting and Training as Task types under Realm > Today.

- Arbiter-only fields are flagged. A Player View mode hides Arbiter-only controls and information for screenshot export.

- Faction selector (top bar, `src/ui/factionSelector.js`): one faction, or "All factions" (Arbiter only). The Characters, Today, Resources, Projects and Log tabs show the selected faction by default (under All factions, grouped or labelled by faction). It is view state per computer (localStorage), not world data. New records (characters, buildings, Projects, tasks) start owned by the selected faction.

- Player View (top bar): only the selected faction's own information ("All factions" is not offered) and no Arbiter-only controls (elements with the `arbiter-only` class are hidden), for screenshots to players.

- Keep the UI simple. New systems get their own sub-tab, sub-sub-tab or panel inside the existing main tabs (see Navigation), not more buttons on existing screens.

- Keep all UI styling centralized: colors, fonts, spacing, borders and panel styles come from shared CSS variables and reusable component classes (panel, button, tab, field, badge). No one-off inline styles in components. This keeps the Stage 8.5 overhaul a reskin rather than a rewrite. The one exception is a color that comes from the data (a tile type's, category's or faction's own color): pass it to a component class as a CSS variable (for example `style="--swatch: #5fbf55"` with `.swatch { background: var(--swatch) }`), not as a full inline style. Faction chips use this pattern (`swatchStyle` in `src/ui/colors.js`, which also picks light or dark text so a label stays readable on any color). The remaining data-color inline styles (tile swatches, placeable dots, the faction dot in Libraries and the faction border on map lists) should be moved to it when those files are next touched.

## Development stages

Build one stage at a time. Each stage must run and be manually testable before starting the next. After each stage, update the Progress section below.

0. **Skeleton.** Vite project, folder layout, world schema, create a new world, world list, save and load to IndexedDB, JSON export and import.

1. **World Map canvas.** Sparse grid, pan, zoom, paint tiles, place, remove, select, move, duplicate.

2. **Region and Biome Maps.** Regions and Biomes as enterable objects, Areas as zones on the Biome Map, the three map tabs, breadcrumb, info panels, editable definitions for region, biome and area types.

3. **Buildings.** Multi-cell buildings on the Biome Map, either inside an Area (areaId, for example the Communal Sleeping Hole on a Building Site Area) or standing alone on the Biome Map, building type editor, placeholder sprites, editable properties, construction stage visuals (Empty Site, Foundation, Under Construction, Completed) driven by editable percentage thresholds.

4. **Characters.** Characters tab (followers, enemies, NPCs) with roster and stat sheet, every field editable: identity, Body Type and body stats, Stamina, needs, Skills, Theories, Traits and Pacts, Conditions, Equipment, a manual combat profile. Editable libraries (Species, Body Types, Skills, Traits, Conditions, Equipment, Teams). Theory and Skill helpers, death and Death Log. Import the seed data (see Seed Data). No combat formulas: combat values are plain fields until the Combat stage.

5. **Projects.** Create a Project on a building site, assign followers, choose Stamina, roll Work Dice per RULES.md, roll the Event, show the proposed result, Arbiter accepts, edits or rerolls. First stage that must produce Resolution Logs (see that section) and the Day Log in the Log tab.

5.5. **World file sync.** Save a world to a .json file in a synced folder (Google Drive, OneDrive, Dropbox) and use it on several computers: autosave to the file, revision checks and conflict choices, "open on" marker, backups folder with restore, device settings, Export / Import fallback (see World file sync).

6. **Time.** Stamina tracking, task records, Advance Day with proposals, undo, redo, reverse day. Advance Day also saves to the world file at once (see World file sync).

6.5. **Factions.** Faction records with relations and end-of-day settings, players, ownership of characters, stockpiles, buildings, Projects and tasks, claims on the map, the faction selector and Player View, transfers between factions logged for both, and the Stage 6 systems made per faction.

6.6. **Crown Bearers and Connectivity.** The Crown Bearers section of RULES.md; Crown Bearers with vessels, Crowns, Players' Connectivity to their Crown Bearers with history, the editable Connectivity table (reminders only), vessel death asking where the Crown is, Connectivity on the Start of Day.

6.7. **Tab structure.** Navigation only: the 6 main tabs with sub-tabs and sub-sub-tabs, every screen moved into its place, the top bar Advance Day button, keys 1 to 6, the quick bar.

7. **Persistence and sharing polish.** Multiple worlds, Player View screenshot mode.

8. **Notes.** A Notes tab for long-form game notes (rules drafts, lore, session logs, world state). Markdown text, titles, tags, folders, search. Any note can link to followers, regions, biomes, areas, buildings and projects, and those records show their linked notes. Import from Markdown or plain text files so notes can be moved over from UpNote.

8.5. **UI Overhaul (pixel UI kit).** Replace the placeholder interface with pixel-art UI elements the Arbiter downloads from itch.io: panels and frames, buttons, tabs, scrollbars, sliders, checkboxes, tooltips, icons, cursors and a pixel font.
   - Theme layer: all UI art is loaded through one theme definition (which image is used for panels, buttons, icons, fonts and colors), so a UI kit can be swapped or updated by changing the theme files, not the app code.
   - Panels and buttons use 9-slice scaling so pixel frames stretch to any size without blurring. Pixel-perfect rendering (nearest-neighbor, integer scale).
   - An icon set for resources, stats (STR, SPD, TOU, Health), conditions, building categories and map tools, with text fallbacks if an icon is missing.
   - Each UI asset records its source pack, author, URL and license. Purchased or restrictive-license UI packs live in /assets-private/ (listed in .gitignore, never pushed); free CC0-style packs may be committed.
   - Keep the layout from earlier stages: this stage changes the look, not how things work.
   - Faction banners: replace the simple banner icon with a layered banner designer: a base color plus stacked pattern layers (stripes, borders, crosses, emblems and similar), each with its own color, saved per faction and shown on the map, faction selector and Task Cards. Use original pattern art, not assets from any other game.

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

10. **Combat.** Implement the King's Game combat rules once the Arbiter finalizes them (currently in the Combat Profiles sheet, Rules tab). Until then the combat profile on each character stays manual, and no combat formulas, attack rolls or calculated combat values are written. This stage also brings Conditions back out of stasis. Sides in combat come from factions and their relations (Teams were replaced by factions in Stage 6.5).
    - Tools become real Equipment here, with Equipment and combat. A tool is an Equipment entry like any other (for example a Stone Spear: Grade F, Weapon, Range, Attack Power 1, Damage 1, Special, Description): a Pickaxe has a bonus stat, and its description says what that bonus applies to. A workday then takes a participant's tool bonus from the tools they carry, instead of the manual "Tools" box Projects use until then.

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
- [x] Stage 5: Projects system (`src/systems/projects`). Schema v12 (migration 11 to 12 adds `dayLogs`, `meta.settings.markEdited` and `character.assignmentProjectId`). Rules in `src/rules/projects.js` with `tables/projects.json` (Project Sizes, Work Die per Tier, +9 Level bonus cap, d20 Event ladder and descriptions), `dice.js`, and `logTemplate.js` (fills `{{value}}`, `{{#list}}`, `{{^empty}}` templates). Projects tab: create (name, size), list (status, Workload bar, site, assigned), detail panel (status, size, Workload current / required editable, building site link with "progress drives the building" (current / required %, one undo step with the link), location, assigned characters, requirements checklist (material, tool, Skill or other, optional library link, met tick; unmet only warns), workday history with each log, notes, custom fields, Mark complete when the Workload is reached (the building shows Completed)). Workday Task Card (shared framework `src/ui/taskCard.js`: header with portraits, banner strip, Info with Danger meter, member tiles, editable log with Copy and Copy whole day, Arbiter controls hidden in Player View): participants and Stamina (1 Stamina = 1 Work Die; going over Stamina remaining needs an override tick), relevant Skill picked from the character's list (die from Tier, Level bonus), die and bonus overrides, a manual tool bonus per participant (added once to their work for the day) with Condition and gear reminders, Roll all / Roll empty / type in physical dice / reroll one, d20 Event rolled or typed or set by hand with its RULES.md description, effect text with quick picks, Workload change, Conditions added to participants, notes. The draft is view state (`state.js`, `workdayDraft.js`); Accept (`workdayAccept.js`) is one batch: Workload, status planned to active, building progress, Stamina spent, Conditions, the workday in `project.workdays`, and the Resolution Log in the Day Log. Resolution Log template `templates/projectWorkday.txt` (written from the order in the brief: `references/roll-log-examples.md` has not been added yet). Day Log (`src/data/dayLog.js`, Log tab > Day Log): entries per day in order, edit, remove, narration between entries, Copy whole day; Action Log kept as the second view. Settings: optional "(edited)" note in logs. Shared helpers `src/data/places.js` (place picker, Danger at a place, log place names with [???]). `infoSections` now takes any record kind: Projects adds "Projects here" to Areas, the Project on the building panel, and "Assigned Project (active Projects)" on the character sheet; death clears it.
- [x] Stage 5 revisions: placing a building offers to create its Project, already linked (`onPlaced` hook in `src/map/objectKinds.js`, shared dialog `src/ui/dialog.js`, `projects/buildingPrompt.js`). The Task Card is a small window floating over its tab, dragged by its header (position kept while the app is open). Workday in two steps: Setup shows the party compactly in the Info pane (Stamina, relevant Skill, tools; asks before overspending Stamina), then Confirm party plays the Resolution Log line by line (click to skip ahead) and pauses at questions written as `{{@stop}}` lines in the template (`splitScript` in `rules/logTemplate.js`): Roll the Work Dice? Y/N (N = type in physical dice), Roll the Project Event? Y/N (N = type it), then typed answers for the effect, Workload change, Conditions (Y/N, a form, repeat) and notes, then Accept this workday? Y/N (N opens Edit details). "Edit details" keeps the full controls for rerolls and any change (`workdaySetup.js`, `workdayPrompts.js`).
- [x] Stamina formula (approved by the Arbiter, RULES.md Followers > Stamina): Stamina max = Species Base Stamina + FLOOR((SPD - 1) / 2), in `src/rules/stamina.js` with `tables/stamina.json` and tests (SPD 1, 2, 3, 4, 5, 8, 13). Species "default Stamina" is now Base Stamina. Sheet (`characters/staminaSection.js`): breakdown, Use button when the stored value differs, override marker and Return to formula, warning when the species has no Base Stamina. Body Type Apply and Level up body include the new Stamina max unless overridden. New characters start at the formula's value. Schema v13 (migration 12 to 13 renames staminaDefault to baseStamina, also in old undo entries, and adds staminaMaxOverride = false; stored values are kept and the sheet proposes the formula's). Schema v14 (migration 13 to 14 applies the formula once to every character that is not overridden and whose species has a Base Stamina: Stamina max = formula, Stamina remaining capped at it; the old values dated from before the rule). The roster marks a Stamina max that differs from the formula and is not yet accepted with "!".
- [x] Stage 5.5: World file sync (`src/sync`, see World file sync). `worldFile.js` (File System Access calls: pickers, read, write, backups folder), `syncNames.js` (pure helpers with tests: revisions, backup names, pruning, when to back up), `fileSync.js` (the open world's sync: open check, autosave, conflict pause, open-on marker, tab focus checks), `syncActions.js` (save world as file, open world file, save mine as a copy, backups folder, stop syncing), `syncBackups.js` (when to back up, write and prune backups, list, Restore), `syncPrompts.js` (the questions), `deviceSettings.js` (this computer's settings in localStorage). IndexedDB version 2 adds the `fileLinks` store. The store gained `onWorldChange` (called after every command, undo and redo) and `refreshSaveStatus`. Top bar: a world file button (status; click saves, checks, resolves or asks for access). Settings: World file panel with backups list and Restore, This computer panel. World list: Open world file, and "World file: name" on linked worlds. No schema change: the file's `sync` block is not world data.
- [x] Moving paint: Ctrl+drag selection box and move on every map (`src/map/paintBlock.js`; see Grid rules). `paintTiles` takes an optional Log label ("Moved N painted tile(s)"); no schema change.
- [x] Stage 6: Time. Schema v15 (migration 14 to 15 adds `tasks`, `foodValue` on resource types, `settings.snapshotsKept`). Resources system (`src/systems/resources`, minimal until the Resources stage): kingdom stockpile and optional stockpiles at places, with name, count, tags and Food value, `setStockpile` command. Time system (`src/systems/time`): Today tab (current Day, end of day readiness: unspent Stamina, active Projects with no workday today, food available vs needed, Hunger 0; living characters with Stamina, assignment, Hunger, Thirst and condition badges, filters Everyone / Has Stamina left / Idle (no Project and no assignment) / On a Project; Done today: tasks and Project workdays from the Day Log; Time controls). Start of Day record in the side panel (`startOfDay.js`, template `templates/startOfDay.txt`), shown and copied at the top of the Day Log. "Log a task" as a Task Card ("Task: ..."; who, Stamina each with an overspend override, where, result, notes; editable log from `templates/simpleTask.txt`; Accept spends Stamina and adds a Day Log entry in one step; Remove gives the Stamina back). Advance Day wizard (`advancePlan.js`, `advanceSteps.js`, `advanceWizard.js`, rules in `src/rules/needs.js` with `tables/needs.json`, "Day N ended" from `templates/dayEnded.txt`, `advanceDay` command in `timeCommands.js`). Reverse Day, Undo Reverse Day, snapshot list and Set Day (`timeControls.js`, `src/data/snapshots.js`, `store.replaceWorld`); snapshots kept is in Settings > Time. The store marks commands with `dayBoundary`. Log tab: Start of Day box, "Task N" and "Day ended" labels.
- [x] Stage 6.5: Factions. Schema v16 (migration 15 to 16: starter factions Apollyon (Player), Vulture Pack (NPC) and Unaligned, Hostile to each other both ways, reusing a faction with the same name; characters get a faction from their old team (Ally: Apollyon, Enemy: Vulture Pack, other: Unaligned) and a history line; `teamId` and the Teams library are removed; stockpiles become records (the kingdom stockpile is Apollyon's main one); buildings, Projects, tasks, Day Log entries and the Start of Day record go to Apollyon; containers get `claimFactionId`; `meta.settings.factionReview` shows the owner review; an undo wall on the old action log). Shared model `src/data/factions.js` with `defaults/factions.json` and `defaults/stances.json`. Factions system (`src/systems/factions`): Factions tab (faction list and panel with relations, end-of-day settings, Player fields, delete only when it owns nothing; relations table; players), `transfers.js` (resources: trade with optional return, gift, theft, loss; building; character, each one undo step logging both factions), `migrationReview.js` (owner pickers per record with Set all; Done or Later). Top bar faction selector and Player View (`src/ui/factionSelector.js`); task cards follow Player View too. Characters: faction on the sheet is a move with a reason (`factionSection.js`) and an editable faction history; the roster filter is the selector; the seed import maps teams to factions; Factions left Characters > Libraries. Buildings and Projects: owner faction (a building owner change is a transfer). Claims: "Claimed by" in the Region, Biome and Area panels and a dashed faction border on the map (`claimOf` in `mapView.js` / `renderer.js`). Resources: per-faction stockpiles, new stockpile (main or at a place), transfer form. Today: per faction (readiness grouped by faction under All), tasks have an owner faction, Start of Day per Player faction. Advance Day: Meal and Needs per faction with trackNeeds (own stockpiles only), Stamina reset per faction with usesStamina, conditions count down for all, summary and one "Day N ended" entry per faction. Log tab: filters to the selected faction, labels entries by faction under All; Copy whole day copies the faction's day, or every faction under a heading.
- [x] Stage 6.6: Crown Bearers and Connectivity. RULES.md gained the Crown Bearers and Connectivity section (word for word from the Arbiter). Schema v17 (migration 16 to 17: `crownBearers`, `crowns`, `definitions.connectivity`, `connections` on players; adds the First Sky King ruling Apollyon with the Crown of Authority (worn by the vessel, no vessel yet), Authority Level copied from the faction, and Connectivity 9 for every player controlling Apollyon, or for a placeholder player "Apollyon's Player" if none). New worlds start with the same. Crown Bearers system (`src/systems/crownBearers`): Crown Bearers tab (Crown Bearers of the selected faction, Crowns, Players moved here from the Factions tab with their Connectivity links, change with a reason, and history, the Connectivity table editor); Crown Bearer panel (vessel portrait and link to the sheet, status, Authority Level, each player's Connectivity with that level's text as a reminder, today's Spark of Change notes and earlier days, Change vessel, editable vessel history, identity fields, divergence notes); Crown panel (attuned Crown Bearer, where it is: worn by the vessel, at a place, held by a character or unknown, with a note). Death hook in `characters/death.js` (`registerDeathHook`): a vessel's death leaves its Crown Bearer without a vessel in the same undo step, then asks where the Crown is. The faction panel shows its Crown Bearer and Authority Level instead of its own. Start of Day shows the faction's Crown Bearer Connectivity (with its reminder) at the top of the panel and in the record's text. `ui/dom.js` only touches `window` in a browser, so Node tests can load UI files.
- [x] Stage 6.7: Tab structure (navigation only; features unchanged). `src/ui/tabLayout.js` (the layout, limits, `registerPlace`, aliases for the old tab ids), `src/ui/navigation.js` (main / sub / sub-sub path, remembered sub-tabs), `src/ui/worldScreen.js` (top bar with Advance Day, main tab, sub-tab and sub-sub-tab rows, placeholders), `src/ui/quickBar.js` (pins: screens, plus Projects, characters and Areas registered by their systems), keys 1 to 6 in `main.js`. Systems declare `places` instead of `tabs`. Screens split into their places: Today (Overview, Tasks, Advance Day; the time controls moved to Chronicle > History), Projects by status (paused with Active), Resources, Buildings (By Area is new grouping; the list follows the faction selector), Factions, Roster and Death Log, Crown Bearers (Bearers; Connectivity = Players plus the table; Vessels = vessel table plus Crowns), Libraries one per Codex screen (Resource Types gained a library editor; Conditions shown with an in-stasis note), World Types (the existing type editors; the tile type editor is shared with the Paint panel), building types and categories, the seed import in System > Worlds > Import/Export, the Settings tab split into System screens and Log Templates (the "(edited)" option). New small screens: World > Locations (`src/systems/locations`), People > Progression (read-only Skills and Theories, `characters/progressionView.js`), Chronicle > Copy Day, Codex > Rules (read-only rule tables and log templates, Open Rules read from this file; `src/systems/codex`), Chronicle (`src/systems/chronicle`) and System (`src/systems/settings`). `tests/tabLayout.test.js`.
- [ ] Stage 7
- [ ] Stage 8
- [ ] Stage 8.5
- [ ] Stage 9

## Open Rules (ask the Arbiter, do not invent)

- How Skill Level increases, and its maximum (RULES.md implies Lv 10).

- When a Skill tiers up: are the combined Theories or Skills consumed, and what happens to its Level?

- Full attribute list and meaning (seen: Strength, Agility, Intelligence, Charisma, Willpower, Might) and what Body Type means.

- Training: table from the d20 teaching quality roll to the number of dice, and the Understanding Roll success ladder.

- Thirst: how it goes down each day and what happens at 0. Manual for now: the Advance Day Needs step has Drank (max) / -1 / No change per character.

- Death from hunger: what happens at Hunger 0, and after how long. For now Hunger 0 is only flagged "at risk of death"; the Arbiter decides, nothing dies automatically.

- Food and Hunger are not in RULES.md yet. Used now, from the Arbiter's Stage 6 brief (in `src/rules/tables/needs.json`): 1 Food per character per day, Food value per unit (default 1), fed = Hunger back to max, unfed = Hunger -1 and the Hungry condition ("-1 to all rolls per day without food"; the days without food are counted on the condition). Add these to RULES.md. Still open: does eating remove Hungry at once (proposed yes, the Arbiter can untick it), and does the -1 grow with each day without food?

- Conditions are in stasis on the stat sheet (no editor until the Combat stage), but Today shows them as badges and Advance Day counts their durations down and adds or removes Hungry. Should the sheet's Conditions editor come back now?

- Conditions and healing: durations, how injuries heal.

- The combat system (in testing by the Arbiter; to be added as its own later stage, Stage 10). Combat values are manual fields until then.

- Hunger and Thirst for Vultures (left blank on the Vulture species).

- When a Theory becomes a T1 Skill, is the Theory removed? (RULES.md says it "becomes" the Skill, but T1 to T2 needs 5 Theories at 100%, so some must stay as Theories.) For now a checkbox, on by default.

- Morale and Prosperity rules.

- Trait and Pact structure.

- How much each tool adds. Settled for Projects: the only modifiers are the relevant Skill's Level bonus on every Work Die (up to +9) and tools that make the task easier, which add to the work an individual does per turn; a tool the Project requires is the baseline and adds nothing. The workday has a manual "Tools" number per participant, added once to their work for the day; in the Equipment and Combat stage, tools become Equipment entries whose bonus stat and description (what the bonus applies to) fill it instead (see Stage 10). Still open: tool bonuses for Harvests, and carry limits with storage equipment.

- Conditions (e.g. "-3 to all tasks") are shown on the workday as reminders only; the Project Resolution Method does not apply them to Work Dice.

- Which Work Die a special-tier Skill (e.g. "Inner Monster") gives on a Project. For now the Arbiter picks the die.

- Specific Boon and Setback options for Project Events (the workday offers the examples from each event's RULES.md description as quick picks; the effect is free text).

- Harvest carry limit without storage equipment (seen as 6 per Stamina for Emerald Puff Fruits): is it per resource, or a general rule?
