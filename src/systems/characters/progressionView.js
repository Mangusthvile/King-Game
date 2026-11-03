// People > Progression > Theories & Skills: a read-only overview of every
// living character of the selected faction, with their Skills (Tier and
// Level) and Theories (percent). Edit them on the stat sheet (click a name).
// Later: the Skill Tree (Stage 11) as a sub-sub-tab here.
import { h } from '../../ui/dom.js';
import { navigate } from '../../ui/navigation.js';
import { selectedFactionId } from '../../ui/factionSelector.js';
import { libName } from './characterModel.js';
import { selectCharacter } from './state.js';

export function renderProgression(world, { detailPanel }) {
  detailPanel.replaceChildren(h('h2', {}, 'Progression'), h('p', { class: 'muted small' }, 'Click a name to open the stat sheet, where Skills and Theories are edited (with the Theory and Skill helpers).'));
  const factionId = selectedFactionId(world);
  const list = Object.values(world.characters)
    .filter((c) => c.alive && (!factionId || c.factionId === factionId))
    .sort((a, b) => a.name.localeCompare(b.name));
  const rows = list.map((c) =>
    h(
      'tr',
      {},
      h('td', {}, h('button', { class: 'link-button', onclick: () => (selectCharacter(c.id), navigate({ main: 'people', sub: 'roster', subsub: 'living' })) }, c.name)),
      h('td', {}, (c.skills ?? []).map((s) => h('div', { class: 'small' }, `${libName(world, 'skills', s.skillId)} ${s.tier ?? ''} Lv${s.level ?? '-'}`))),
      h('td', {}, (c.theories ?? []).map((t) => h('div', { class: 'small' }, `${t.name}: ${t.percent ?? 0}%`))),
    ),
  );
  return h(
    'div',
    { class: 'tab-page wide-page' },
    h(
      'section',
      { class: 'frame panel' },
      h('h2', {}, `Theories & Skills (${list.length})`),
      rows.length
        ? h('table', { class: 'building-table small' }, h('thead', {}, h('tr', {}, ['Character', 'Skills', 'Theories'].map((t) => h('th', {}, t)))), h('tbody', {}, rows))
        : h('p', { class: 'muted small' }, 'No living characters here.'),
    ),
  );
}
