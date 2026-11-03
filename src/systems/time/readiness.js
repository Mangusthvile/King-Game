// "End of day readiness": what is still open today, per faction, for the
// Today tab and the Advance Day wizard's Review step. Read-only.
import { foodAvailable } from '../resources/stockpileModel.js';
import { foodNeeded } from '../../rules/needs.js';
import { factionSettings } from '../../data/factions.js';
import { projectsView } from '../projects/state.js';
import { timeView } from './state.js';

// Living characters, by name. factionId: only that faction's ('' = every
// faction's).
export const livingCharacters = (world, factionId = '') =>
  Object.values(world.characters)
    .filter((c) => c.alive && (!factionId || c.factionId === factionId))
    .sort((a, b) => a.name.localeCompare(b.name));

// One faction's readiness. factionId is exact: '' = the characters with no
// faction.
//   { factionId, living, unspent: [characters with Stamina left],
//     idleProjects: [its active Projects with no workday today],
//     trackNeeds, foodHave, foodNeed, atRisk: [Hunger 0] }
export function readiness(world, factionId) {
  const day = world.meta.currentDay;
  const living = livingCharacters(world).filter((c) => (c.factionId ?? '') === factionId);
  const { trackNeeds, usesStamina } = factionSettings(world, factionId);
  return {
    factionId,
    living,
    unspent: usesStamina ? living.filter((c) => (c.staminaRemaining ?? 0) > 0) : [],
    idleProjects: Object.values(world.projects).filter((p) => (p.ownerFactionId ?? '') === factionId && p.status === 'active' && !(p.workdays ?? []).some((w) => w.day === day)),
    trackNeeds,
    foodHave: factionId ? foodAvailable(world, factionId) : 0,
    foodNeed: trackNeeds ? foodNeeded(living.length) : 0,
    atRisk: trackNeeds ? living.filter((c) => c.hunger?.current === 0) : [],
  };
}

// Unfinished drafts (a workday or task not accepted), for every faction.
export function openDrafts(world) {
  const drafts = [];
  const workday = projectsView.workday;
  if (workday && world.projects[workday.projectId]) drafts.push(`A workday on "${world.projects[workday.projectId].name}" is open and not accepted.`);
  if (timeView.task) drafts.push('A task is open in "Log a task" and not accepted.');
  return drafts;
}
