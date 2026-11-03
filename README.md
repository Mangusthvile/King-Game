# King's Game: Arbiter's Kingdom Simulator

A private tool for the Arbiter of King's Game: a world map (World, Region and Biome Maps) plus a kingdom, follower, Project and Day Log manager. It runs on your own computer, offline, with no accounts and no server. Your worlds are saved in the browser on this computer, and optionally in a world file you choose.

This guide covers installing and running the app, using one world on several computers, taking screenshots for players, and keeping backups.

## Install (once per computer)

1. Install **Node.js** (the LTS version) from <https://nodejs.org>.
2. Get this folder onto the computer (copy it, or clone it with Git).
3. Open a terminal in the folder and run:

   ```bash
   npm install
   ```

## Run

```bash
npm run dev
```

Open the address it prints (normally <http://localhost:5173>) in **Chrome or Edge**. World files only work in Chrome and Edge; in Firefox or Safari, use Export and Import JSON instead.

To stop the app, press Ctrl+C in the terminal. Your worlds stay saved.

To run the automated tests (rules, migrations, world tools):

```bash
npm test
```

## Worlds

The first screen lists the worlds saved on this computer. Each one shows its Day, when it was last saved and on which computer, its world file (if any) and its size.

- **Create World**: an empty world, or "Libraries and rules of ..." to copy another world's species, Body Types, Skills, Traits, Equipment, resource, place, building and tile types, factions and rule settings. No characters, map, Projects or history are copied.
- **Duplicate**: a full copy with its own id, for testing or a "what if" timeline. The copy is not linked to the original's world file.
- **Rename**, **Export** (downloads a JSON backup) and **Delete** (you type the world's name to confirm; a world file is never deleted).
- **Import JSON**: brings in an exported world. A broken or foreign file is refused with a list of what is wrong; nothing is changed. Importing a world you already have makes a copy named "(imported)".
- Old worlds are upgraded automatically when opened or imported.

## Open a world file

A world file is the whole world saved as a `.json` file in a folder you choose. Put that folder inside Google Drive, OneDrive or Dropbox, and the world is kept in step on every computer.

- **First computer**: open the world, go to **System > Worlds > Save File**, click **Save world as file**, pick a place in your synced folder, then confirm the folder (it holds the `backups` folder).
- **Other computers**: on the world list, click **Open world file** and pick the same file. It opens as the same world, not a copy.
- The top bar's file button shows the status. If it says "allow access", click it: the browser asks again for permission after a restart.

## Sync between computers

**Never edit the same world on two computers at the same time.** The app cannot merge two sets of changes.

- Every change is saved on this computer at once, then to the world file a few seconds later, and immediately when the day changes.
- Before saving, the app checks whether another computer has saved the file since. If so it stops and asks you to choose: **Reload theirs**, **Keep mine**, **Save mine as a copy**, or **Decide later**. The version that loses is kept as a backup file.
- When you open a world (or come back to its tab), the app checks for a newer file and offers to reload it.
- "This world may be open on [device]" means the other computer still has it open, or was closed without leaving the world. Close it there first if you can.
- Give each computer a clear name in **System > Preferences > Device Name**.

## Player View and screenshots

**Player View** (top bar) shows the world as one faction's players may see it. A blue banner at the top shows it is on.
- Only the selected faction's characters, resources, buildings, Projects and Day Log are shown.
- Undiscovered Regions, Biomes and Areas appear as their undiscovered name, for example `[???]`, and resources not found yet are hidden.
- Arbiter-only fields are hidden.
- Nothing can be changed until you turn it off (**Back to Arbiter view**).

**Arbiter-only fields.** Every field has a small eye next to its name: 👁 means players see it, ◌ means Arbiter-only. Click the eye to switch it (Ctrl+Z undoes it). Notes, custom fields, the combat profile and Connectivity history start as Arbiter-only. Change that list in **System > Display > Player View**.

**Screenshots.** Click the camera button 📷 in the top bar and choose:
- **What**: the map view, the side panel (a character sheet, a Project, the selection), an open Task Card, the main screen (for example the Day Log for a day), or the whole screen.
- **Scale**: 1x, 2x or 3x. Pixels are scaled up sharply, never blurred.
- **Map only**: crop to what the map shows now, to the whole map (the Region or Biome edge), or to the selected Region, Biome or Area outline. You can also hide the grid.
- **Caption**: adds the world name, Day and faction under the picture.
- **Include Arbiter info**: off by default, so screenshots follow Player View rules for the selected faction even when you are in the Arbiter view.

Files are named like `Apollyon_Day8_JadeGarden.png` and go to your Downloads folder.

## Back up

Use more than one of these:

1. **Export JSON** (world list, or System > Worlds > Import/Export): a full copy of the world in one file. Keep a few in a safe place.
2. **World file backups**: with a world file, older versions are copied into the `backups` folder next to it automatically, at most every few minutes and whenever the day changes. **System > Worlds > Backups** lists them; **Restore** shows what a backup holds before replacing the world (the current file is backed up first).
3. **Day snapshots**: Advance Day saves the whole world just before the day changes (the newest 30 by default, set in System > Preferences > Snapshots). **System > Worlds > Backups** shows what each holds; restoring one is the same as **Reverse Day** (Chronicle > History), and "Undo Reverse Day" takes it back.

**Storage** (System > Worlds > Storage) shows how much browser storage your worlds use and warns when it gets full. **Ask the browser to keep the data** asks the browser not to clear saved worlds when the disk is nearly full.

## For developers

`CLAUDE.md` is the project brief (stages, data model, rules of the codebase), and `RULES.md` holds the King's Game rules.
