// The character record (followers, enemies and NPCs) and small read-only
// helpers about characters.
//
// world.characters[id]:
//   identity:  name, factionId, speciesId, locationContainerId (Region, Biome
//              or Area), currentAssignment (free text until Stage 5), bio, notes
//   teamId:    Ally / Enemy / Neutral, in stasis until the Combat stage
//   body:      bodyTypeId, bodyTypeLevel, bodyLevel, STR, SPD, TOU,
//              health: { current, max }   max proposed by rules/health.js
//   daily:     speedRemaining   SPD doubles as the daily Speed budget
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

export const COMBAT_FIELDS = [
  { key: 'resistance', label: 'Resistance' },
  { key: 'defense', label: 'Defense' },
  { key: 'actions', label: 'Actions' },
  { key: 'attack', label: 'Attack' },
  { key: 'basePower', label: 'Base Power' },
  { key: 'physicalDamageMod', label: 'Physical Damage Mod' },
  { key: 'effectiveDamage', label: 'Effective Damage' },
];

// A new character with its species' Hunger and Thirst max and default
// fields copied on. values overrides any field (used by the seed import).
export function createCharacter(world, values = {}) {
  const species = world.definitions.species[values.speciesId ?? ''];
  return {
    id: newId('character'),
    name: 'New Character',
    factionId: '',
    teamId: '',
    speciesId: species?.id ?? '',
    locationContainerId: '',
    currentAssignment: '',
    bio: '',
    notes: '',
    bodyTypeId: '',
    bodyTypeLevel: 1,
    bodyLevel: 1,
    STR: 1,
    SPD: 1,
    TOU: 1,
    health: { current: null, max: null },
    speedRemaining: 1,
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

// Every Region, Biome and Area as a select option, indented under its parent.
export function locationOptions(world) {
  const options = [];
  const visit = (parentId, depth) => {
    for (const c of Object.values(world.containers)) {
      if (c.parentId !== parentId || !['region', 'biome', 'area'].includes(c.kind)) continue;
      options.push({ value: c.id, label: `${'  '.repeat(depth)}${depth ? '└ ' : ''}${c.name}` });
      visit(c.id, depth + 1);
    }
  };
  visit(world.meta.rootContainerId, 0);
  return options;
}

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
