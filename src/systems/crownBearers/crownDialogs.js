// The questions the Crown Bearers system asks: change vessel, change a
// Connectivity level (with a reason), and where a Crown is now.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { openDialog } from '../../ui/dialog.js';
import { placeOptions } from '../../data/places.js';
import { CROWN_LOCATIONS } from '../../data/crownBearers.js';
import { clampConnectivity, connectivityLevel, CONNECTIVITY_MIN, CONNECTIVITY_MAX } from '../../rules/connectivity.js';
import { changeVessel, setCrownLocation, setConnectivity } from './crownModel.js';

const characterOptions = (world, exceptId = '') =>
  Object.values(world.characters)
    .filter((c) => c.alive && c.id !== exceptId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: c.name }));

const selectOf = (options, value = '') => {
  const select = h('select', { class: 'wide' }, options.map((o) => h('option', { value: o.value }, o.label)));
  select.value = value;
  return select;
};

export function askChangeVessel(world, bearer) {
  const current = world.characters[bearer.vesselId];
  const pick = selectOf([{ value: '', label: '(no vessel)' }, ...characterOptions(world, bearer.vesselId)]);
  const reason = h('input', { type: 'text', class: 'wide', placeholder: 'e.g. Vessel gave up the Crown, Crown taken by force...' });
  openDialog({
    title: `Change ${bearer.name}'s vessel`,
    body: [
      h('p', {}, current ? `Current vessel: ${current.name}. Their line in the vessel history ends today (Day ${world.meta.currentDay}).` : 'No vessel now.'),
      h('label', {}, 'New vessel'),
      pick,
      current ? [h('label', {}, `How it ended for ${current.name}`), reason] : null,
    ],
    buttons: [
      { label: 'Change vessel', primary: true, onClick: () => dispatch(changeVessel(world, bearer, pick.value, reason.value)) },
      { label: 'Cancel' },
    ],
  });
}

export function askConnectivity(world, player, index) {
  const link = player.connections[index];
  const level = h('input', { type: 'number', class: 'short-input', min: CONNECTIVITY_MIN, max: CONNECTIVITY_MAX, step: 1, value: link.connectivity ?? '' });
  const reminder = h('p', { class: 'muted small connectivity-text' });
  const show = () => (reminder.textContent = connectivityLevel(world, clampConnectivity(level.value))?.description ?? '');
  level.addEventListener('input', show);
  show();
  const reason = h('input', { type: 'text', class: 'wide', placeholder: 'Why it changed (optional)' });
  openDialog({
    title: `Connectivity: ${player.name} and ${world.crownBearers[link.crownBearerId]?.name ?? '(removed Crown Bearer)'}`,
    body: [h('p', {}, `Now ${link.connectivity ?? '-'}. The change is added to the history with today's day (Day ${world.meta.currentDay}).`), h('label', {}, `New level (${CONNECTIVITY_MIN} to ${CONNECTIVITY_MAX})`), level, reminder, h('label', {}, 'Reason'), reason],
    buttons: [
      {
        label: 'Change',
        primary: true,
        onClick: () => {
          const n = clampConnectivity(level.value);
          if (n === null || n === link.connectivity) return;
          dispatch(setConnectivity(world, player, index, n, reason.value));
        },
      },
      { label: 'Cancel' },
    ],
  });
}

// Where a Crown is now. title: the question (e.g. after its vessel died).
export function askCrownLocation(world, crown, title = `Where is the ${crown.name}?`, intro = '') {
  const loc = crown.location ?? {};
  const kind = selectOf(CROWN_LOCATIONS.map((l) => ({ value: l.id, label: l.name })), loc.kind === 'vessel' && intro ? 'unknown' : loc.kind ?? 'unknown');
  const place = selectOf([{ value: '', label: '(pick a place)' }, ...placeOptions(world)], loc.containerId ?? '');
  const holder = selectOf([{ value: '', label: '(pick a character)' }, ...characterOptions(world)], loc.characterId ?? '');
  const note = h('input', { type: 'text', class: 'wide', value: loc.note ?? '', placeholder: 'Note (optional), e.g. buried under the rubble' });
  const placeRow = h('div', {}, h('label', {}, 'Place'), place);
  const holderRow = h('div', {}, h('label', {}, 'Held by'), holder);
  const update = () => {
    placeRow.hidden = kind.value !== 'place';
    holderRow.hidden = kind.value !== 'character';
  };
  kind.addEventListener('change', update);
  update();
  openDialog({
    title,
    body: [intro ? h('p', {}, intro) : null, h('label', {}, 'Where'), kind, placeRow, holderRow, h('label', {}, 'Note'), note],
    buttons: [
      { label: 'Save', primary: true, onClick: () => dispatch(setCrownLocation(world, crown, { kind: kind.value, containerId: place.value, characterId: holder.value, note: note.value.trim() })) },
      { label: 'Decide later' },
    ],
  });
}
