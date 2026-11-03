// The bottom quick bar: up to 6 shortcuts the Arbiter pins (a screen, a
// Project, a character, an Area...). Pins are view state for this computer
// (localStorage, per world), like the faction selector: not world data.
//
// Screens can always be pinned. Other kinds come from systems:
//   registerPinKind(kind, { label, options(world) -> [{ value, label }],
//                           name(world, id) -> text or null (gone),
//                           open(world, id) })
import { h } from './dom.js';
import { openDialog } from './dialog.js';
import { navigatePath, currentPath } from './navigation.js';
import { MAIN_TABS, splitPath, subTab, mainTab } from './tabLayout.js';

export const MAX_PINS = 6;
const pinKinds = {};

export function registerPinKind(kind, def) {
  pinKinds[kind] = def;
}

const storageKey = (world) => `kg.quickBar.${world.meta.id}`;

export function getPins(world) {
  try {
    const pins = JSON.parse(localStorage.getItem(storageKey(world)) ?? '[]');
    return Array.isArray(pins) ? pins.slice(0, MAX_PINS) : [];
  } catch {
    return [];
  }
}

function savePins(world, pins, redraw) {
  try {
    localStorage.setItem(storageKey(world), JSON.stringify(pins.slice(0, MAX_PINS)));
  } catch {
    // not saved (blocked storage): the bar just doesn't remember
  }
  redraw();
}

// "Realm > Projects > Active"
export function pathLabel(path) {
  const { main, sub, subsub } = splitPath(path);
  const s = subTab(main, sub);
  return [mainTab(main)?.label, s?.label, s?.subsubs.find((x) => x.id === subsub)?.label].filter(Boolean).join(' > ');
}

function pinLabel(world, pin) {
  if (pin.kind === 'place') return pathLabel(pin.path);
  return pinKinds[pin.kind]?.name(world, pin.id) ?? null;
}

function openPin(world, pin) {
  if (pin.kind === 'place') return navigatePath(pin.path);
  pinKinds[pin.kind]?.open(world, pin.id);
}

function iconFor(pin) {
  if (pin.kind === 'place') return MAIN_TABS.find((m) => m.id === splitPath(pin.path).main)?.icon ?? '★';
  return pinKinds[pin.kind]?.icon ?? '★';
}

function askPin(world, pins, redraw) {
  const choices = [{ value: 'place', label: `This screen: ${pathLabel(currentPath())}` }, ...Object.entries(pinKinds).map(([kind, def]) => ({ value: kind, label: def.label }))];
  const kind = h('select', { class: 'wide' }, choices.map((c) => h('option', { value: c.value }, c.label)));
  const target = h('select', { class: 'wide' });
  const targetRow = h('div', {}, h('label', {}, 'Which one'), target);
  const fill = () => {
    const def = pinKinds[kind.value];
    targetRow.hidden = !def;
    if (def) target.replaceChildren(...def.options(world).map((o) => h('option', { value: o.value }, o.label)));
  };
  kind.addEventListener('change', fill);
  fill();
  openDialog({
    title: 'Pin to the quick bar',
    body: [h('label', {}, 'Pin'), kind, targetRow],
    buttons: [
      {
        label: 'Pin',
        primary: true,
        onClick: () => {
          const pin = kind.value === 'place' ? { kind: 'place', path: currentPath() } : target.value ? { kind: kind.value, id: target.value } : null;
          if (pin) savePins(world, [...pins, pin], redraw);
        },
      },
      { label: 'Cancel' },
    ],
  });
}

export function renderQuickBar(world) {
  const bar = h('footer', { class: 'quick-bar' });
  const redraw = () => bar.replaceChildren(...content(world, redraw).flat().filter(Boolean));
  redraw();
  return bar;
}

function content(world, redraw) {
  const pins = getPins(world);
  const shown = pins.map((pin, i) => ({ pin, i, label: pinLabel(world, pin) })).filter((p) => p.label);
  return [
    h('span', { class: 'muted small quick-title' }, 'Quick bar'),
    shown.map(({ pin, i, label }) =>
      h(
        'span',
        { class: 'quick-pin' },
        h('button', { class: 'btn small', title: `Open ${label}`, onclick: () => openPin(world, pin) }, h('span', { class: 'tab-icon' }, iconFor(pin)), ` ${label}`),
        h('button', { class: 'chip-x', title: 'Unpin', onclick: () => savePins(world, pins.filter((_, j) => j !== i), redraw) }, 'x'),
      ),
    ),
    pins.length < MAX_PINS ? h('button', { class: 'btn small', title: `Pin a screen, Project, character or Area (up to ${MAX_PINS})`, onclick: () => askPin(world, pins, redraw) }, '+ Pin') : h('span', { class: 'muted small' }, `${MAX_PINS} pins (the most)`),
  ];
}
