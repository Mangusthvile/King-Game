// A workday in progress (the Project Task Card). It is view state: the
// Arbiter sets participants, Stamina and Skills, rolls or types in dice,
// rolls the Event and edits anything, and only Accept (workdayAccept.js)
// turns it into commands.
//
// draft: { projectId,   (the day is always today: world.meta.currentDay)
//   participants: [{ characterId, stamina, skillId ('' = no relevant Skill),
//                    dieOverride, bonusOverride (null = from the Skill),
//                    toolBonus, toolNote (tools that make the task easier),
//                    rolls: [n | null], edited: [bool] }],
//   eventRoll, eventEdited, eventOverrideId ('' = from the roll),
//   effect, workloadChange, conditionsToAdd: [{ characterId, conditionId, name, modifier, durationDays }],
//   notes, staminaOverride, logText (null = generated),
//   phase: 'setup' (choosing the party in the Info pane) | 'run' (the log plays),
//   revealed (log lines shown so far), answered: { stopName: true },
//   sub (a prompt's second step: 'manualDice', 'manualEvent', 'conditionForm'),
//   declined (the Arbiter answered N to "Accept this workday?") }
import { workDieForTier, levelBonus, participantWork, totalWork, workloadAfter, eventForRoll, eventById, EVENT_DIE } from '../../rules/projects.js';
import { rollDie, isValidRoll } from '../../rules/dice.js';
import { tierNumber } from '../../rules/skills.js';
import { assignedCharacters } from './projectModel.js';

export function newParticipant(characterId, stamina = 1) {
  return {
    characterId,
    stamina,
    skillId: '',
    dieOverride: null,
    bonusOverride: null,
    toolBonus: 0,
    toolNote: '',
    rolls: Array(stamina).fill(null),
    edited: Array(stamina).fill(false),
  };
}

// A new workday for today, with the Project's assigned characters added
// (1 Stamina each if they have any left).
export function newDraft(world, project) {
  return {
    projectId: project.id,
    participants: assignedCharacters(world, project.id).map((c) => newParticipant(c.id, (c.staminaRemaining ?? 0) >= 1 ? 1 : 0)),
    eventRoll: null,
    eventEdited: false,
    eventOverrideId: '',
    effect: '',
    workloadChange: 0,
    conditionsToAdd: [],
    notes: '',
    staminaOverride: false,
    logText: null,
    phase: 'setup',
    revealed: 0,
    answered: {},
    sub: null,
    declined: false,
  };
}

// Each Stamina invested = 1 Work Die, so the dice list follows the Stamina.
export function setStamina(p, stamina) {
  p.stamina = stamina;
  p.rolls = Array.from({ length: stamina }, (_, i) => p.rolls[i] ?? null);
  p.edited = Array.from({ length: stamina }, (_, i) => p.edited[i] ?? false);
}

// The character's Skills the Arbiter may pick as the relevant one, highest
// Tier first (special tiers last). Picking is always the Arbiter's call.
export function skillChoices(world, character) {
  return (character?.skills ?? [])
    .filter((s) => s.skillId && world.definitions.skills[s.skillId])
    .map((s) => ({ ...s, name: world.definitions.skills[s.skillId].name, die: workDieForTier(s.tier), bonus: levelBonus(s.level) }))
    .sort((a, b) => (tierNumber(b.tier) ?? -1) - (tierNumber(a.tier) ?? -1));
}

// Everything worked out for one participant: their Skill, die, bonus and work.
export function resolveParticipant(world, p) {
  const character = world.characters[p.characterId];
  const skill = p.skillId ? character?.skills.find((s) => s.skillId === p.skillId) : null;
  const dieAuto = workDieForTier(skill ? skill.tier : '');
  const bonusAuto = levelBonus(skill?.level ?? null);
  const die = p.dieOverride ?? dieAuto;
  const bonus = p.bonusOverride ?? bonusAuto;
  const remaining = character?.staminaRemaining ?? null;
  return {
    p,
    character,
    name: character?.name ?? '(removed character)',
    skill,
    skillName: skill ? world.definitions.skills[skill.skillId]?.name ?? '(deleted Skill)' : '',
    dieAuto,
    bonusAuto,
    die, // null: a special-tier Skill with no die picked yet
    bonus,
    work: die ? participantWork({ rolls: p.rolls, bonus, toolBonus: p.toolBonus }) : null,
    remaining,
    // Going over Stamina remaining (or with none set) needs the Arbiter's override.
    overspend: p.stamina > 0 && (remaining === null || p.stamina > remaining),
  };
}

// The whole proposal: participants, total, the Event and the new Workload.
export function resolveDraft(world, draft) {
  const project = world.projects[draft.projectId];
  const people = draft.participants.map((p) => resolveParticipant(world, p));
  const working = people.filter((r) => r.p.stamina > 0);
  const missingDie = working.some((r) => !r.die);
  const total = missingDie ? null : totalWork(working.map((r) => ({ rolls: r.p.rolls, bonus: r.bonus, toolBonus: r.p.toolBonus })));
  const event = draft.eventOverrideId ? eventById(draft.eventOverrideId) : eventForRoll(draft.eventRoll);
  const before = project?.workloadCurrent ?? 0;
  return {
    project,
    people,
    working,
    missingDie,
    total,
    event,
    before,
    after: total === null ? null : workloadAfter(before, total, draft.workloadChange || 0),
    overspend: working.filter((r) => r.overspend),
  };
}

// ---- Dice ----

// "Roll": rolls every Work Die of every participant (rerolling any result).
export function rollAll(world, draft, rng) {
  for (const p of draft.participants) {
    const { die } = resolveParticipant(world, p);
    if (!die) continue;
    p.rolls = p.rolls.map(() => rollDie(die, rng));
    p.edited = p.edited.map(() => false);
  }
}

// Rolls only the dice that have no result yet.
export function rollMissing(world, draft, rng) {
  for (const p of draft.participants) {
    const { die } = resolveParticipant(world, p);
    if (!die) continue;
    p.rolls = p.rolls.map((r) => r ?? rollDie(die, rng));
  }
}

export function rerollDie(world, p, index, rng) {
  const { die } = resolveParticipant(world, p);
  if (!die) return;
  p.rolls[index] = rollDie(die, rng);
  p.edited[index] = false;
}

// A result typed by the Arbiter. Typing into an empty die is entering a
// physical roll; changing a result that was already there is an edit.
// Returns false (nothing changed) if the value is not a valid result.
export function typeRoll(world, p, index, value) {
  const { die } = resolveParticipant(world, p);
  if (value === null) {
    p.rolls[index] = null;
    p.edited[index] = false;
    return true;
  }
  if (!die || !isValidRoll(value, die)) return false;
  if (p.rolls[index] !== null && p.rolls[index] !== value) p.edited[index] = true;
  p.rolls[index] = value;
  return true;
}

export function rollEvent(draft, rng) {
  draft.eventRoll = rollDie(EVENT_DIE, rng);
  draft.eventEdited = false;
  draft.eventOverrideId = '';
}

export function typeEventRoll(draft, value) {
  if (value === null) {
    draft.eventRoll = null;
    draft.eventEdited = false;
    return true;
  }
  if (!isValidRoll(value, EVENT_DIE)) return false;
  if (draft.eventRoll !== null && draft.eventRoll !== value) draft.eventEdited = true;
  draft.eventRoll = value;
  return true;
}
