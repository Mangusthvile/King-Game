// The Theory and Skill helpers in the character panel. They follow RULES.md
// (src/rules/skills.js) but only propose: the Arbiter picks or creates the
// Skill, picks which items are related, and confirms.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField, addRecord, batch } from '../../commands/recordCommands.js';
import { COMBINE_COUNT, tierUpSource, tierUpCandidates, convertTheoryToSkill, tierUpSkill, tierNumber } from '../../rules/skills.js';
import { library, libraryPath } from './libraries.js';
import { libName } from './characterModel.js';

// Saves new theories and skills lists as one undo step (plus any new library Skill).
function saveLists(world, c, label, { theories, skills }, extra = []) {
  dispatch(
    batch(label, [
      ...extra,
      theories.length !== c.theories.length ? setField(world, 'characters', c.id, 'theories', theories, c.name) : null,
      setField(world, 'characters', c.id, 'skills', skills, c.name),
    ]),
  );
}

// "Theory of Fire is at 100%: make it a T1 Skill?" Pick a library Skill or
// type a new name (which creates it in the Skills library).
export function convertForm(world, c, theoryIndex, onClose) {
  const theory = c.theories[theoryIndex];
  if (!theory) return null;
  const select = h(
    'select',
    { 'data-key': `${c.id}.convertSkill` },
    h('option', { value: '' }, 'New Skill (type its name)...'),
    Object.values(world.definitions.skills).map((s) => h('option', { value: s.id }, `${s.name} (${s.tier})`)),
  );
  const name = h('input', { type: 'text', class: 'wide', placeholder: 'New Skill name (for example Fire Starter)', 'data-key': `${c.id}.convertName` });
  const remove = h('input', { type: 'checkbox', checked: true });
  const message = h('p', { class: 'message error small' });
  return h(
    'form',
    {
      class: 'helper-box',
      onsubmit: (e) => {
        e.preventDefault();
        let skillId = select.value;
        const skillName = skillId ? libName(world, 'skills', skillId) : name.value.trim();
        const extra = [];
        if (!skillId) {
          if (!skillName) return (message.textContent = 'Pick a Skill or type a new name.');
          const created = { ...library('skills').create(skillName), theories: [theory.name] };
          extra.push(addRecord(libraryPath('skills'), created));
          skillId = created.id;
        }
        onClose();
        saveLists(world, c, `${c.name}: ${theory.name} became the T1 Skill ${skillName} Lv1`, convertTheoryToSkill(c.theories, c.skills, theoryIndex, { skillId }, remove.checked), extra);
      },
    },
    h('h3', {}, `${theory.name} is complete`),
    h('p', { class: 'small' }, 'RULES.md: a Theory at 100% becomes a T1 Skill at Lv1. Pick the Skill or create one:'),
    select,
    name,
    h('label', { class: 'check-label small' }, remove, ' Remove the Theory (it becomes the Skill)'),
    message,
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn small primary', type: 'submit' }, 'Create T1 Skill'),
      h('button', { class: 'btn small', type: 'button', onclick: onClose }, 'Not now'),
    ),
  );
}

// Pick the related items to combine, then raise the Skill one Tier.
export function tierUpForm(world, c, skillIndex, onClose) {
  const skill = c.skills[skillIndex];
  const source = skill && tierUpSource(skill.tier);
  if (!source) return null;
  const candidates = tierUpCandidates(c.theories, c.skills, skillIndex);
  const boxes = candidates.map((cand) => ({ cand, box: h('input', { type: 'checkbox' }) }));
  const count = h('span', { class: 'small' });
  const updateCount = () => {
    const n = boxes.filter((b) => b.box.checked).length;
    count.textContent = `${n} of ${COMBINE_COUNT} picked`;
    count.className = n === COMBINE_COUNT ? 'small ok-text' : 'small muted';
  };
  boxes.forEach((b) => b.box.addEventListener('change', updateCount));
  updateCount();
  // RULE NEEDED: whether combined items are consumed is an open rule, so
  // the Arbiter decides each time (unticked by default).
  const remove = h('input', { type: 'checkbox' });
  const what = source.kind === 'theory' ? 'Theories at 100%' : `T${source.tier} Skills`;
  const itemLabel = (cand) =>
    cand.kind === 'theory' ? `${cand.item.name} (${cand.item.percent}%)` : `${libName(world, 'skills', cand.item.skillId)} ${cand.item.tier} Lv${cand.item.level}`;
  const skillName = libName(world, 'skills', skill.skillId);
  const n = tierNumber(skill.tier);

  return h(
    'form',
    {
      class: 'helper-box',
      onsubmit: (e) => {
        e.preventDefault();
        const picks = boxes.filter((b) => b.box.checked).map((b) => ({ kind: b.cand.kind, index: b.cand.index }));
        if (picks.length !== COMBINE_COUNT && !confirm(`RULES.md needs ${COMBINE_COUNT} related ${what}; ${picks.length} picked.\n\nTier up anyway?`)) return;
        onClose();
        saveLists(world, c, `${c.name}: ${skillName} rose to T${n + 1}`, tierUpSkill(c.theories, c.skills, skillIndex, picks, remove.checked));
      },
    },
    h('h3', {}, `Tier up ${skillName} (T${n} to T${n + 1})`),
    h('p', { class: 'small' }, `RULES.md: combine ${COMBINE_COUNT} related ${what}. You decide which are related.`),
    candidates.length
      ? h('div', { class: 'pick-list' }, boxes.map(({ cand, box }) => h('label', { class: 'check-label small' }, box, ' ', itemLabel(cand))))
      : h('p', { class: 'muted small' }, `This character has no ${what}.`),
    count,
    h('label', { class: 'check-label small' }, remove, ' Remove the combined items'),
    h('p', { class: 'muted small' }, 'The Level is kept. (Both are open rules: see Open Rules in CLAUDE.md.)'),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn small primary', type: 'submit' }, 'Tier up'),
      h('button', { class: 'btn small', type: 'button', onclick: onClose }, 'Cancel'),
    ),
  );
}
