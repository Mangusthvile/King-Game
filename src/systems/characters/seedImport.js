// Seed data import: builds a plan from references/body-types.json and
// references/test-characters.json, for the preview. Libraries come first,
// then characters, linked to library entries by name (case-insensitive).
// Anything a character names that no library has is created as a new
// library entry and flagged. Entries that already exist are reused, never
// overwritten. Nothing changes until the plan's commands are dispatched.
import { newId } from '../../data/ids.js';
import { addRecord, batch } from '../../commands/recordCommands.js';
import { library, libraryPath } from './libraries.js';
import { createCharacter, COMBAT_FIELDS } from './characterModel.js';

const ORDER = ['traits', 'conditions', 'equipment', 'skills', 'species', 'teams', 'bodyTypes'];
const lower = (s) => String(s ?? '').trim().toLowerCase();
const text = (v) => (v === null || v === undefined ? '' : v);

// plan = {
//   entries: { [libraryKey]: [{ name, status: 'new' | 'existing' | 'created', flag, entry }] },
//   characters: [{ character, flags: [], include }],
//   fileNotes: [] }
export function buildImportPlan(world, bodyFile, charFile) {
  const defs = world.definitions;
  const plan = { entries: Object.fromEntries(ORDER.map((k) => [k, []])), characters: [], fileNotes: bodyFile?.notes ?? [] };
  const byName = Object.fromEntries(ORDER.map((k) => [k, new Map(Object.values(defs[k] ?? {}).map((e) => [lower(e.name), e]))]));

  // A library entry from a seed list: reuse a same-name entry, else add it.
  const seed = (key, raw, fill) => {
    const found = byName[key].get(lower(raw.name));
    if (found) return plan.entries[key].push({ name: raw.name, status: 'existing', entry: found });
    const entry = { ...library(key).create(raw.name.trim()), ...fill(raw) };
    byName[key].set(lower(raw.name), entry);
    plan.entries[key].push({ name: raw.name, status: 'new', entry });
  };
  // A name a character or Body Type refers to: its id, created (and
  // flagged) if no library has it. flags collects the reasons.
  const ensure = (key, name, flags, why, fill = {}) => {
    if (!lower(name)) return '';
    const found = byName[key].get(lower(name));
    if (found) return found.id;
    const entry = { ...library(key).create(String(name).trim()), ...fill };
    byName[key].set(lower(name), entry);
    const flag = `${why}: "${name}" is not in the ${library(key).label} list, so it was created`;
    plan.entries[key].push({ name, status: 'created', flag, entry });
    flags?.push(flag);
    return entry.id;
  };

  for (const t of charFile?.traits ?? []) seed('traits', t, (r) => ({ tags: r.tags ?? [], description: text(r.description), narrativeFeature: text(r.narrativeFeature), mechanicalFeature: text(r.mechanicalFeature) }));
  for (const c of charFile?.conditions ?? []) seed('conditions', c, (r) => ({ description: text(r.description), mechanicalFeature: text(r.mechanicalFeature) }));
  for (const e of charFile?.equipment ?? [])
    seed('equipment', e, (r) => ({
      grade: r.grade ?? 'F',
      ex: !!r.ex,
      max: !!r.max,
      type: text(r.type),
      range: text(r.range),
      attackPower: text(r.attackPower),
      damage: text(r.damage),
      defense: text(r.defense),
      protection: text(r.protection),
      special: text(r.special),
      description: text(r.description),
      notes: text(r.note),
    }));
  for (const s of charFile?.skills ?? [])
    seed('skills', s, (r) => ({
      tier: r.tier ?? 'T1',
      adeptWith: text(r.adeptWith),
      theories: r.theories ?? [],
      canBoost: r.canBoost ?? null,
      description: text(r.description),
      skillFeature: text(r.skillFeature),
      limitation: text(r.limitation),
      notes: text(r.note),
    }));

  for (const b of bodyFile?.bodyTypes ?? []) {
    const flags = [];
    const speciesId = ensure('species', b.species, flags, `Body Type ${b.name}`);
    const grantsTraitIds = (b.grantsTraits ?? []).map((t) => ensure('traits', t, flags, `Body Type ${b.name}`));
    seed('bodyTypes', b, (r) => ({
      speciesId,
      rarity: text(r.rarity),
      maxLevel: r.maxLevel ?? null,
      statCeiling: r.statCeiling ?? null,
      prerequisite: text(r.prerequisite),
      levels: structuredClone(r.levels ?? []),
      grantsTraitIds,
      description: text(r.description),
    }));
  }

  // Species made by the plan are not in the world yet; characters need
  // their Hunger, Thirst and default fields.
  const speciesById = { ...defs.species, ...Object.fromEntries(plan.entries.species.map((p) => [p.entry.id, p.entry])) };
  const existingNames = new Set(Object.values(world.characters).map((c) => lower(c.name)));

  for (const raw of charFile?.characters ?? []) {
    const flags = [];
    const who = raw.name;
    const speciesId = ensure('species', raw.species, flags, who);
    const values = {
      name: raw.name,
      teamId: ensure('teams', raw.team, flags, who),
      speciesId,
      bodyTypeId: ensure('bodyTypes', raw.bodyType, flags, who),
      bodyTypeLevel: raw.bodyTypeLevel ?? 1,
      bodyLevel: raw.bodyLevel ?? 1,
      STR: raw.STR ?? null,
      SPD: raw.SPD ?? null,
      TOU: raw.TOU ?? null,
      health: { current: raw.health ?? null, max: raw.health ?? null },
      speedRemaining: raw.SPD ?? null,
      skills: (raw.skills ?? []).map((s) => ({ skillId: ensure('skills', s.name, flags, who, { tier: s.tier ?? 'T1' }), tier: s.tier ?? 'T1', level: s.level ?? 1 })),
      defenseSkillId: raw.defenseSkill ? ensure('skills', raw.defenseSkill, flags, who) : '',
      theories: structuredClone(raw.theories ?? []),
      traits: [
        ...(raw.traits ?? []).map((t) => ({ traitId: ensure('traits', t, flags, who), note: '' })),
        ...(raw.pacts ?? []).map((t) => ({ traitId: ensure('traits', t, flags, who, { tags: ['Pact'] }), note: '' })),
      ],
      weapons: (raw.weapons ?? []).map((w) => ({ equipmentId: ensure('equipment', w.name, flags, who, { type: 'Weapon' }), qty: w.qty ?? 1 })),
      armorId: raw.armorOrShield ? ensure('equipment', raw.armorOrShield, flags, who) : '',
      otherGear: text(raw.otherGear),
      bio: text(raw.bio),
      notes: text(raw.note),
      combat: Object.fromEntries(COMBAT_FIELDS.map((f) => [f.key, String(text(raw.combatManual?.[f.key]))])),
    };
    const character = createCharacter({ definitions: { ...defs, species: speciesById } }, values);
    // Vulture extras go into the species' default fields, matched by name.
    setCustom(character, 'Mask', 'text', raw.mask);
    setCustom(character, 'Vault Value', 'number', raw.vaultValue);
    setCustom(character, 'Essence notes', 'text', raw.essenceNotes);
    const duplicate = existingNames.has(lower(raw.name));
    if (duplicate) flags.push('A character with this name already exists (unticked)');
    plan.characters.push({ character, flags, include: !duplicate });
  }
  return plan;
}

// Puts a value into the custom field with that name, adding the field if
// the character doesn't have it. Empty values are skipped.
function setCustom(character, name, type, value) {
  if (value === undefined || value === null || value === '') return;
  const found = Object.entries(character.customFields).find(([, f]) => lower(f.name) === lower(name));
  if (found) found[1].value = value;
  else character.customFields[newId('field')] = { name, type, value };
}

// One undo step: the new library entries (in dependency order), then the
// ticked characters.
export function importCommand(plan) {
  const entries = ORDER.flatMap((key) => plan.entries[key].filter((p) => p.status !== 'existing').map((p) => addRecord(libraryPath(key), p.entry)));
  const characters = plan.characters.filter((p) => p.include).map((p) => addRecord('characters', p.character));
  return batch(`Imported seed data: ${entries.length} library entries, ${characters.length} character(s)`, [...entries, ...characters]);
}

export const IMPORT_ORDER = ORDER;
