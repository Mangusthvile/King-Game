// The character record (followers, enemies and NPCs) and small read-only
// helpers about characters.
//
// world.characters[id]:
//   identity:  name, factionId (data/factions.js), factionHistory: [{ factionId,
//              fromDay, toDay (null = still in it), reason }], speciesId, locationContainerId (Region, Biome
//              or Area), currentAssignment (free text), assignmentProjectId
//              (the Project they work on, '' = none; set from the Projects
//              system's section on the sheet), bio, notes
//   body:      bodyTypeId, bodyTypeLevel, bodyLevel, STR, SPD, TOU,
//              health: { current, max }   max proposed by rules/health.js
//   daily:     staminaMax, staminaRemaining   the daily activity budget, spent on
//              tasks and reset by Advance Day. Stamina max follows the formula
//              Base Stamina + FLOOR((SPD - 1) / 2) (rules/stamina.js) unless
//              staminaMaxOverride is true (the Arbiter set their own value).
//   needs:     hunger: { current, max }, thirst: { current, max }
//   skills:    [{ skillId, tier, level }], defenseSkillId
//   theories:  [{ name, percent }]   no automatic numerical bonus
//   traits:    [{ traitId, note }]   a Pact is a library Trait tagged "Pact"
//   conditions:[{ conditionId ('' = one-off), name, modifier (text), durationDays, note }]
//              in stasis until the Combat stage (kept, not shown)
//   gear:      weapons: [{ equipmentId, qty }], armorId, otherGear (text),
//              inventory: [{ name, quantity, notes }]
//   combat:    { resistance, defense, actions, attack, basePower,
//                physicalDamageMod, effectiveDamage }   plain text: the combat
//              system is still being tested, nothing is calculated
//   alive, death: { cause, day } | null, customFields
import { newId } from '../../data/ids.js';
import { setField } from '../../commands/recordCommands.js';
import { staminaFormula, staminaBreakdown } from '../../rules/stamina.js';

export const COMBAT_FIELDS = [
  { key: 'resistance', label: 'Resistance' },
  { key: 'defense', label: 'Defense' },
  { key: 'actions', label: 'Actions' },
  { key: 'attack', label: 'Attack' },
  { key: 'basePower', label: 'Base Power' },
  { key: 'physicalDamageMod', label: 'Physical Damage Mod' },
  { key: 'effectiveDamage', label: 'Effective Damage' },
];

// A new character with its species' Stamina, Hunger and Thirst max and default
// fields copied on. values overrides any field (used by the seed import).
export function createCharacter(world, values = {}) {
  const species = world.definitions.species[values.speciesId ?? ''];
  const stamina = staminaFormula(species?.baseStamina, values.SPD ?? 1); // null if the species has no Base Stamina
  return {
    id: newId('character'),
    name: 'New Character',
    factionId: '',
    factionHistory: [],
    speciesId: species?.id ?? '',
    locationContainerId: '',
    currentAssignment: '',
    assignmentProjectId: '',
    bio: '',
    notes: '',
    bodyTypeId: '',
    bodyTypeLevel: 1,
    bodyLevel: 1,
    STR: 1,
    SPD: 1,
    TOU: 1,
    health: { current: null, max: null },
    staminaMax: stamina,
    staminaRemaining: stamina,
    staminaMaxOverride: false,
    hunger: { current: species?.hungerMax ?? null, max: species?.hungerMax ?? null },
    thirst: { current: species?.thirstMax ?? null, max: species?.thirstMax ?? null },
    skills: [],
    defenseSkillId: '',
    theories: [],
    traits: [],
    conditions: [],
    weapons: [],
    armorId: '',
    otherGear: '',
    inventory: [],
    combat: Object.fromEntries(COMBAT_FIELDS.map((f) => [f.key, ''])),
    alive: true,
    death: null,
    customFields: structuredClone(species?.defaultFields ?? {}),
    ...values,
  };
}

// The name of a library entry, or a dash / "(deleted)".
export function libName(world, libraryKey, id) {
  if (!id) return '-';
  return world.definitions[libraryKey]?.[id]?.name ?? '(deleted)';
}

// Every Region, Biome and Area as a select option (shared with other systems).
export { placeOptions as locationOptions } from '../../data/places.js';

export function locationName(world, character) {
  if (!character.locationContainerId) return '-';
  return world.containers[character.locationContainerId]?.name ?? '(removed place)';
}

// Living characters located in a container (with nested: also in the
// Biomes and Areas inside it).
export function charactersAt(world, containerId, { nested = false } = {}) {
  const ids = new Set([containerId]);
  // Keep adding children of what we have until nothing new is found.
  for (let grew = nested; grew; ) {
    grew = false;
    for (const c of Object.values(world.containers)) {
      if (ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return Object.values(world.characters).filter((c) => c.alive && ids.has(c.locationContainerId));
}

// The Stamina formula for a character (or for proposed stats { SPD }):
//   { species, breakdown ({ base, fromSpd, total, text } or null), missingBase }
// missingBase: the species has no Base Stamina, so Stamina max is manual.
export function staminaFor(world, c, stats = {}) {
  const species = world.definitions.species[c.speciesId];
  const SPD = stats.SPD ?? c.SPD;
  return {
    species,
    breakdown: staminaBreakdown(species?.baseStamina, SPD),
    missingBase: species?.baseStamina === null || species?.baseStamina === undefined,
  };
}

// The command that sets Stamina max to the formula for these stats (for
// example the SPD of a body level-up), or null: not when the Arbiter
// overrode it, the formula can't be worked out, or nothing changes.
export function staminaCommand(world, c, stats = {}) {
  if (c.staminaMaxOverride) return null;
  const total = staminaFor(world, c, stats).breakdown?.total ?? null;
  return total !== null && total !== c.staminaMax ? setField(world, 'characters', c.id, 'staminaMax', total, c.name) : null;
}
