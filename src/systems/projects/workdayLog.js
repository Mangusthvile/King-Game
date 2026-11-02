// The Project Resolution Log (CLAUDE.md, Resolution Logs). The wording lives
// in templates/projectWorkday.txt, so the Arbiter can change it without
// touching code; this file only works out the values the template uses.
// The log always shows the final (possibly edited) values.
import template from './templates/projectWorkday.txt?raw';
import { fillTemplate, splitScript } from '../../rules/logTemplate.js';
import { logPlaceName, dangerAt } from '../../data/places.js';
import { resolutionCount } from '../../data/dayLog.js';
import { REQUIREMENT_KINDS, requirementText } from './projectModel.js';

const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

// " +2 (Stone Shovel)": the tool bonus, added once to the participant's
// work for the day (RULES.md: tools increase the work done per turn).
function extrasText(p) {
  return p.toolBonus ? ` ${signed(p.toolBonus)} (${p.toolNote || 'tools'})` : '';
}

// The template's values for a resolved workday (see workdayDraft.resolveDraft).
export function workdayLogData(world, draft, resolved) {
  const { project, working, total, event, before, after } = resolved;
  const day = world.meta.currentDay;
  const markEdited = !!world.meta.settings?.markEdited;
  const kindName = (id) => REQUIREMENT_KINDS.find((k) => k.id === id)?.name ?? id;
  const participants = working.map((r) => ({
    name: r.name,
    stamina: r.p.stamina,
    die: r.die ?? '?',
    bonusText: r.bonus ? ` (+${r.bonus} per die)` : '',
    extrasText: extrasText(r.p),
    rollsText: r.p.rolls.map((roll) => `(${roll ?? '?'}${r.bonus ? `+${r.bonus}` : ''})`).join(''),
    work: r.work ?? '?',
    editedText: markEdited && r.p.edited.some(Boolean) ? ' (edited)' : '',
  }));
  const notables = working
    .filter((r) => r.skill)
    .map((r) => ({ name: r.name, skillName: r.skillName, tier: r.skill.tier, level: r.skill.level, die: r.die ?? '?', bonusText: r.bonus ? `, +${r.bonus} per die` : '' }));
  const toolLines = working
    .filter((r) => r.p.toolNote || r.p.toolBonus)
    .map((r) => `${r.name}: ${r.p.toolNote || 'tools'}${r.p.toolBonus ? ` (${signed(r.p.toolBonus)} work)` : ''}`);
  const prerequisites = project.requirements.map((req) => ({ mark: req.met ? 'x' : ' ', text: `${requirementText(world, req)} (${kindName(req.kind)})` }));

  return {
    day,
    rollNumber: resolutionCount(world, day, 'project') + 1,
    projectName: project.name,
    sizeText: project.sizeLabel || 'Not set',
    required: project.workloadRequired,
    prior: before,
    location: logPlaceName(world, project.locationContainerId),
    danger: dangerAt(world, project.locationContainerId) || 'Not set',
    partySize: working.length,
    participantNames: working.map((r) => r.name).join(', ') || 'Nobody',
    hasNotables: notables.length > 0,
    notables,
    participants,
    hasTools: toolLines.length > 0,
    toolLines,
    hasPrerequisites: prerequisites.length > 0,
    prerequisites,
    total: total ?? '?',
    eventRoll: draft.eventRoll ?? '-',
    eventEditedText: markEdited && (draft.eventEdited || draft.eventOverrideId) ? ' (edited)' : '',
    eventName: event?.name ?? 'Not rolled yet',
    eventDescription: event?.description ?? '',
    effect: draft.effect.trim(),
    workloadChangeText: draft.workloadChange ? signed(draft.workloadChange) : '',
    conditionsAdded: draft.conditionsToAdd.map((c) => ({
      name: world.characters[c.characterId]?.name ?? '?',
      condition: [c.name, c.modifier, c.durationDays ? `${c.durationDays} day(s)` : ''].filter(Boolean).join(', '),
    })),
    notes: draft.notes.trim(),
    after: after ?? '?',
  };
}

// The questions the workday asks while its log plays, in order. Each is a
// {{@name}} stop in the template (see rules/logTemplate.js).
export const WORKDAY_STOPS = ['rollDice', 'rollEvent', 'effect', 'workloadChange', 'conditions', 'notes'];

// The log as lines plus the stops where it pauses: { lines, stops }.
export function workdayLogScript(world, draft, resolved) {
  return splitScript(fillTemplate(template, workdayLogData(world, draft, resolved)), WORKDAY_STOPS);
}

// The finished log text (what is saved and copied).
export function workdayLogText(world, draft, resolved) {
  return workdayLogScript(world, draft, resolved).lines.join('\n');
}
