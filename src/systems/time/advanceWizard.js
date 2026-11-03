// The Advance Day wizard: Review, Meal, Needs, Conditions, Stamina,
// Summary, grouped by faction. Every step is a proposal the Arbiter can
// edit or skip; Accept on the Summary saves a snapshot of the day, then
// applies everything as ONE advanceDay command (the shared day goes up by 1
// and each faction's "Day N ended" entry goes into its Day Log). The world file saves at once (sync/fileSync.js).
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { takeSnapshot } from '../../data/snapshots.js';
import { resolvePlan, dayEndedText, buildAdvance, SUMMARY_GROUPS } from './advancePlan.js';
import { mealStep, needsStep, conditionsStep, staminaStep } from './advanceSteps.js';
import { readiness, openDrafts } from './readiness.js';
import { activeFactionIds, factionName } from '../../data/factions.js';
import { timeView as view } from './state.js';

const STEPS = [
  { id: 'review', label: 'Review', render: reviewStep },
  { id: 'meal', label: 'Meal', render: mealStep, skippable: 'No food is taken from any stockpile (who ate still counts for Hunger).' },
  { id: 'needs', label: 'Needs', render: needsStep, skippable: 'Hunger, Hungry and Thirst stay as they are.' },
  { id: 'conditions', label: 'Conditions', render: conditionsStep, skippable: 'Condition durations do not count down.' },
  { id: 'stamina', label: 'Stamina', render: staminaStep, skippable: 'Stamina remaining is not reset.' },
  { id: 'summary', label: 'Summary', render: summaryStep },
];

function reviewStep(world) {
  const item = (warn, text) => h('li', { class: warn ? 'flag-text' : 'ok-text' }, text);
  const drafts = openDrafts(world);
  return [
    h('p', {}, `Before ending Day ${world.meta.currentDay} for the whole world, check what is still open. You can continue anyway.`),
    activeFactionIds(world).map((fid) => {
      const r = readiness(world, fid);
      return [
        h('h3', { class: 'faction-heading' }, factionName(world, fid)),
        h(
          'ul',
          { class: 'wizard-list' },
          r.unspent.length ? item(true, `Unspent Stamina: ${r.unspent.map((c) => `${c.name} (${c.staminaRemaining})`).join(', ')}`) : item(false, 'No unspent Stamina.'),
          r.idleProjects.length ? item(true, `Active Projects with no workday today: ${r.idleProjects.map((p) => p.name).join(', ')}`) : null,
          r.trackNeeds ? item(r.foodHave < r.foodNeed, `Food: ${r.foodHave} available, ${r.foodNeed} needed.`) : h('li', { class: 'muted' }, 'Needs not tracked.'),
          r.atRisk.map((c) => item(true, `${c.name} is already at Hunger 0.`)),
        ),
      ];
    }),
    drafts.length ? h('ul', { class: 'wizard-list' }, drafts.map((text) => item(true, text))) : null,
  ];
}

// The summary grouped by faction, then by step, with each faction's
// "Day N ended" log text (editable).
function summaryStep(world, plan, resolved, refresh) {
  const notes = h('input', { type: 'text', class: 'wide', value: plan.notes, placeholder: 'Notes for every faction\'s Day Log (optional)', 'data-key': 'wiz.notes' });
  notes.addEventListener('change', () => ((plan.notes = notes.value), refresh()));
  const skipped = STEPS.filter((s) => s.skippable && plan.skip[s.id]).map((s) => s.label);
  const listOf = (lines) => SUMMARY_GROUPS.filter((g) => lines.some((l) => l.group === g)).map((g) => [h('h4', {}, g), h('ul', { class: 'wizard-list' }, lines.filter((l) => l.group === g).map((l) => h('li', { class: l.warn ? 'flag-text' : '' }, l.text)))]);
  return [
    skipped.length ? h('p', { class: 'muted small' }, `Skipped: ${skipped.join(', ')}`) : null,
    notes,
    resolved.groups.map((g) => {
      const generated = dayEndedText(world, plan, resolved, g);
      const text = h('textarea', { class: 'day-log-text', rows: 8, value: plan.logTexts[g.factionId] ?? generated, spellcheck: false, 'data-key': `wiz.log.${g.factionId}` });
      text.addEventListener('change', () => {
        if (text.value === generated) delete plan.logTexts[g.factionId];
        else plan.logTexts[g.factionId] = text.value;
        refresh();
      });
      const lines = resolved.lines.filter((l) => l.factionId === g.factionId);
      return h(
        'div',
        { class: 'wizard-faction' },
        h('h3', { class: 'faction-heading' }, g.name),
        lines.length ? listOf(lines) : h('p', { class: 'muted small' }, 'No changes.'),
        h('h4', {}, `Day Log: "Day ${world.meta.currentDay} Ended: ${g.name}"`),
        text,
        g.factionId in plan.logTexts ? h('button', { class: 'btn small', onclick: () => (delete plan.logTexts[g.factionId], refresh()) }, 'Rebuild log') : null,
      );
    }),
    listOf(resolved.lines.filter((l) => l.factionId === null)),
  ];
}

function accept(world, plan, resolved) {
  const command = buildAdvance(world, plan, resolved);
  view.wizard = null;
  takeSnapshot(world); // the day as it is now, for Reverse Day
  dispatch(command);
}

export function renderAdvanceWizard(world, refresh) {
  const plan = view.wizard;
  const resolved = resolvePlan(world, plan);
  const step = STEPS[plan.step];
  const last = plan.step === STEPS.length - 1;
  const skipped = step.skippable && plan.skip[step.id];

  return h(
    'section',
    { class: 'frame panel wizard' },
    h('div', { class: 'row' }, h('h2', {}, `Advance Day: end Day ${world.meta.currentDay}`), h('div', { class: 'spacer' }), h('button', { class: 'btn small', onclick: () => ((view.wizard = null), refresh()) }, 'Cancel')),
    h(
      'div',
      { class: 'wizard-steps' },
      STEPS.map((s, i) =>
        h('button', { class: `btn small${i === plan.step ? ' active' : ''}${s.skippable && plan.skip[s.id] ? ' skipped' : ''}`, onclick: () => ((plan.step = i), refresh()) }, `${i + 1}. ${s.label}`),
      ),
    ),
    step.skippable
      ? h(
          'label',
          { class: 'check-label small', title: step.skippable },
          h('input', { type: 'checkbox', checked: skipped, onchange: (e) => ((plan.skip[step.id] = e.target.checked), refresh()) }),
          ` Skip this step: ${step.skippable}`,
        )
      : null,
    h('div', { class: skipped ? 'wizard-body skipped' : 'wizard-body' }, step.render(world, plan, resolved, refresh)),
    h(
      'div',
      { class: 'row wizard-nav' },
      h('button', { class: 'btn', disabled: plan.step === 0, onclick: () => ((plan.step -= 1), refresh()) }, 'Back'),
      h('div', { class: 'spacer' }),
      last
        ? h('button', { class: 'btn primary', title: `Save a snapshot, apply every change and start Day ${world.meta.currentDay + 1}`, onclick: () => accept(world, plan, resolved) }, `Accept: start Day ${world.meta.currentDay + 1}`)
        : h('button', { class: 'btn primary', onclick: () => ((plan.step += 1), refresh()) }, 'Next'),
    ),
  );
}
