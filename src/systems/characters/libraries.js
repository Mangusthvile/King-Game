// The character libraries (definitions the Arbiter edits in Characters >
// Libraries): what fields each has, how to make a new entry, and which
// characters use an entry. Every entry has customFields.
//
//   species:    { name, baseStamina, hungerMax, thirstMax, notes, defaultFields }
//   bodyTypes:  { name, speciesId, rarity, maxLevel (null = not yet established),
//                 statCeiling (null = none), prerequisite,
//                 levels: [{ lv, bodyLv, STR, SPD, TOU, notes }], grantsTraitIds, description }
//   skills:     { name, tier ("T1"-"T5" or special, e.g. "Inner Monster"), adeptWith,
//                 theories: [names], canBoost (true / false / null), description,
//                 skillFeature, limitation, notes }
//   traits:     { name, tags (a Pact is tagged "Pact"), description, narrativeFeature, mechanicalFeature }
//   factions:   { name, color, description, notes }
//   conditions: { name, description, mechanicalFeature }      (in stasis)
//   equipment:  { name, grade, ex, max, type, range, attackPower, damage, defense,
//                 protection, special, description, notes }
//   teams:      { name, color }                               (in stasis)
//
// In stasis: Teams (Ally, Enemy, Neutral) and Conditions belong to the
// combat system, which is still being tested. Their library entries and
// the characters' teamId and conditions stay in the data (the seed import
// still fills them), but they are hidden everywhere until the Combat stage.
// To bring one back, remove it from IN_STASIS.
import { newId } from '../../data/ids.js';
import { createSpecies } from '../../data/schema.js';

export const GRADES = ['F', 'D', 'C', 'B', 'A', 'S'];
export const SKILL_TIERS = ['T1', 'T2', 'T3', 'T4', 'T5', 'Inner Monster'];
export const IN_STASIS = ['teams', 'conditions'];
export const inStasis = (key) => IN_STASIS.includes(key);

const entry = (prefix, name, fields) => ({ id: newId(prefix), name, ...fields, customFields: {} });

export const LIBRARIES = [
  {
    key: 'factions',
    label: 'Factions',
    create: (name = 'New Faction') => ({ id: newId('faction'), name, color: '#888888', description: '', notes: '', customFields: {} }),
    fields: [
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    summary: () => '',
  },
  {
    key: 'species',
    label: 'Species',
    create: (name = 'New Species') => createSpecies(name),
    fields: [
      { key: 'baseStamina', label: 'Base Stamina (Stamina = Base + FLOOR((SPD - 1) / 2))', type: 'number', placeholder: 'not set' },
      { key: 'hungerMax', label: 'Hunger max', type: 'number', placeholder: 'not set' },
      { key: 'thirstMax', label: 'Thirst max', type: 'number', placeholder: 'not set' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'defaultFields', label: 'Default fields (copied onto its characters)', type: 'defaultFields' },
    ],
    summary: (world, e) => `Base Stamina ${e.baseStamina ?? '-'}, Hunger ${e.hungerMax ?? '-'}, Thirst ${e.thirstMax ?? '-'}`,
  },
  {
    key: 'bodyTypes',
    label: 'Body Types',
    create: (name = 'New Body Type') =>
      entry('bodyType', name, { speciesId: '', rarity: 'Common', maxLevel: 1, statCeiling: null, prerequisite: '', levels: [], grantsTraitIds: [], description: '' }),
    fields: [
      { key: 'speciesId', label: 'Species', type: 'ref', library: 'species' },
      { key: 'rarity', label: 'Rarity', type: 'text' },
      { key: 'maxLevel', label: 'Max level', type: 'number', placeholder: 'not yet established' },
      { key: 'statCeiling', label: 'Stat ceiling', type: 'number', placeholder: 'none' },
      { key: 'prerequisite', label: 'Prerequisite', type: 'textarea' },
      { key: 'levels', label: 'Level progression', type: 'levels' },
      { key: 'grantsTraitIds', label: 'Traits granted', type: 'refList', library: 'traits' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    summary: (world, e) => `${world.definitions.species[e.speciesId]?.name ?? '-'}, ${e.rarity}, max Lv ${e.maxLevel ?? 'not yet established'}`,
  },
  {
    key: 'skills',
    label: 'Skills',
    create: (name = 'New Skill') =>
      entry('skill', name, { tier: 'T1', adeptWith: '', theories: [], canBoost: null, description: '', skillFeature: '', limitation: '', notes: '' }),
    fields: [
      { key: 'tier', label: 'Tier', type: 'text', suggestions: SKILL_TIERS },
      { key: 'adeptWith', label: 'Adept With', type: 'text' },
      { key: 'theories', label: 'Required Theories', type: 'stringList' },
      { key: 'canBoost', label: 'Can Boost', type: 'triState' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'skillFeature', label: 'Skill Feature', type: 'textarea' },
      { key: 'limitation', label: 'Limitation', type: 'textarea' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    summary: (world, e) => `${e.tier}${e.adeptWith ? `, adept with ${e.adeptWith}` : ''}`,
  },
  {
    key: 'traits',
    label: 'Traits & Pacts',
    create: (name = 'New Trait') => entry('trait', name, { tags: [], description: '', narrativeFeature: '', mechanicalFeature: '' }),
    fields: [
      { key: 'tags', label: 'Tags (a Pact has the tag "Pact")', type: 'stringList' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'narrativeFeature', label: 'Narrative feature', type: 'textarea' },
      { key: 'mechanicalFeature', label: 'Mechanical feature', type: 'textarea' },
    ],
    summary: (world, e) => (e.tags?.length ? e.tags.join(', ') : 'Trait'),
  },
  {
    key: 'conditions',
    label: 'Conditions',
    create: (name = 'New Condition') => entry('condition', name, { description: '', mechanicalFeature: '' }),
    fields: [
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'mechanicalFeature', label: 'Mechanical feature', type: 'textarea' },
    ],
    summary: () => '',
  },
  {
    key: 'equipment',
    label: 'Equipment',
    create: (name = 'New Equipment') =>
      entry('equipment', name, {
        grade: 'F',
        ex: false,
        max: false,
        type: '',
        range: '',
        attackPower: '',
        damage: '',
        defense: '',
        protection: '',
        special: '',
        description: '',
        notes: '',
      }),
    fields: [
      { key: 'grade', label: 'Grade', type: 'select', options: GRADES },
      { key: 'ex', label: 'EX', type: 'checkbox' },
      { key: 'max', label: 'Max', type: 'checkbox' },
      { key: 'type', label: 'Type', type: 'text' },
      { key: 'range', label: 'Range', type: 'text' },
      { key: 'attackPower', label: 'Attack Power', type: 'value' },
      { key: 'damage', label: 'Damage', type: 'value' },
      { key: 'defense', label: 'Defense', type: 'value' },
      { key: 'protection', label: 'Protection', type: 'value' },
      { key: 'special', label: 'Special or weapon trait', type: 'textarea' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    summary: (world, e) => `${e.grade}${e.ex ? ' EX' : ''}${e.max ? ' Max' : ''} ${e.type}`,
  },
  {
    key: 'teams',
    label: 'Teams',
    create: (name = 'New Team') => ({ id: newId('team'), name, color: '#888888', customFields: {} }),
    fields: [{ key: 'color', label: 'Color', type: 'color' }],
    summary: () => '',
  },
];

export const libraryPath = (key) => `definitions.${key}`;

export function library(key) {
  return LIBRARIES.find((l) => l.key === key);
}

// How many characters use a library entry (for the delete warning).
export function countUsers(world, key, id) {
  const uses = {
    species: (c) => c.speciesId === id,
    bodyTypes: (c) => c.bodyTypeId === id,
    skills: (c) => c.skills?.some((s) => s.skillId === id),
    traits: (c) => c.traits?.some((t) => t.traitId === id),
    conditions: (c) => c.conditions?.some((x) => x.conditionId === id),
    equipment: (c) => c.armorId === id || c.weapons?.some((w) => w.equipmentId === id),
    teams: (c) => c.teamId === id,
    factions: (c) => c.factionId === id,
  }[key];
  return uses ? Object.values(world.characters).filter(uses).length : 0;
}

// A Pact is a Trait tagged "Pact".
export function isPact(trait) {
  return !!trait?.tags?.some((t) => t.toLowerCase() === 'pact');
}
