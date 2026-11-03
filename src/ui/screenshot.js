// The camera button in the top bar: saves a PNG of the map, a panel or the
// whole screen (Stage 7). Screenshots follow Player View rules for the
// selected faction unless "Include Arbiter info" is ticked: Player View is
// turned on for a moment (not saved), the screen is drawn again, captured,
// and put back.
//   Map: drawn from the map data (map/mapShot.js), optionally cropped to the
//        map's edge or the selected Region, Biome or Area, without the grid.
//   Panels and the whole screen: copied from the page (ui/domCapture.js).
// Options: a caption (world name, Day N, faction) and 1x, 2x or 3x scale
// (nearest-neighbor, so pixels stay crisp). Taking a screenshot changes no
// world data.
import { h } from './dom.js';
import { openDialog } from './dialog.js';
import { navigate, getNavigation } from './navigation.js';
import { MAIN_TABS, subTab } from './tabLayout.js';
import { isPlayerView, selectedFactionId, setPlayerViewOverride } from './factionSelector.js';
import { factionName } from '../data/factions.js';
import { getActiveView } from '../map/mapKeyboard.js';
import { mapShot, cropRect } from '../map/mapShot.js';
import { objectName } from '../map/placement.js';
import { placeName } from './playerView.js';
import { captureElement } from './domCapture.js';
import { screenshotFileName } from './shotName.js';

// The last options used (view state, kept while the app is open).
const options = { target: 'map', arbiterInfo: false, hideGrid: false, caption: true, scale: 2, crop: 'view' };

const TARGETS = [
  { id: 'map', label: 'Map view', available: () => !!getActiveView()?.canvas.isConnected },
  { id: 'details', label: 'Side panel (character sheet, Project, selection)', selector: '.detail-panel' },
  { id: 'taskCard', label: 'Task Card', selector: '.task-window' },
  { id: 'content', label: 'Main screen (for example the Day Log for a day)', selector: '.content' },
  { id: 'screen', label: 'Whole screen', selector: '.world-screen' },
];

const isAvailable = (t) => (t.available ? t.available() : !!document.querySelector(t.selector));

export function openScreenshotDialog(world) {
  const targets = TARGETS.filter(isAvailable);
  if (!targets.some((t) => t.id === options.target)) options.target = targets[0]?.id ?? 'screen';
  const message = h('p', { class: 'message error small' });

  const select = (value, choices, onValue) => {
    const el = h('select', { onchange: (e) => onValue(e.target.value) }, choices.map((c) => h('option', { value: c.value }, c.label)));
    el.value = String(value);
    return el;
  };
  const check = (label, key, title = '') => h('label', { class: 'check-label', title }, h('input', { type: 'checkbox', checked: options[key], onchange: (e) => (options[key] = e.target.checked) }), ` ${label}`);

  const view = getActiveView();
  const crops = [
    { value: 'view', label: 'What the map shows now' },
    { value: 'edge', label: view?.frameBounds ? 'The whole map (its edge)' : 'Everything on the map' },
    view && cropRect(view, 'selected') ? { value: 'selected', label: `The selected outline (${objectName(world, world.placedObjects[view.state.selectedId])})` } : null,
  ].filter(Boolean);
  if (!crops.some((c) => c.value === options.crop)) options.crop = 'view';

  const mapOptions = h(
    'div',
    { class: 'option-grid' },
    h('label', {}, 'Crop'),
    select(options.crop, crops, (v) => (options.crop = v)),
    h('span', {}),
    check('Hide the grid', 'hideGrid'),
  );
  const showMapOptions = () => (mapOptions.hidden = options.target !== 'map');
  showMapOptions();

  const faction = selectedFactionId(world);
  openDialog({
    title: 'Screenshot',
    body: [
      h(
        'div',
        { class: 'option-grid' },
        h('label', {}, 'What'),
        select(
          options.target,
          targets.map((t) => ({ value: t.id, label: t.label })),
          (v) => ((options.target = v), showMapOptions()),
        ),
        h('label', {}, 'Scale'),
        select(options.scale, [1, 2, 3].map((n) => ({ value: n, label: `${n}x` })), (v) => (options.scale = Number(v))),
      ),
      mapOptions,
      check('Caption (world name, Day, faction)', 'caption'),
      h('br'),
      check('Include Arbiter info', 'arbiterInfo', 'Off: the screenshot uses Player View rules for the selected faction.'),
      h('p', { class: 'muted small' }, isPlayerView(world) ? 'Player View is on.' : `Without Arbiter info, the screenshot shows what ${factionName(world, faction) || 'the first Player faction'} would see in Player View.`),
      message,
    ],
    buttons: [
      {
        label: 'Save PNG',
        primary: true,
        onClick: () => {
          if (!options.arbiterInfo && MAIN_TABS.find((m) => m.id === getNavigation(world).main)?.arbiterOnly) {
            message.textContent = 'The Codex is Arbiter-only. Tick "Include Arbiter info" to capture it.';
            return false;
          }
          takeScreenshot(world).catch((err) => alert(`Screenshot failed: ${err.message}`));
        },
      },
      { label: 'Cancel' },
    ],
  });
}

// The next drawn frame, or 100 ms at most (a background tab draws no frames).
const nextFrame = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
    setTimeout(resolve, 100);
  });

async function takeScreenshot(world) {
  const usePlayerView = !options.arbiterInfo && !isPlayerView(world);
  if (usePlayerView) {
    setPlayerViewOverride(true);
    navigate({}); // draw the screen again with Player View rules
  }
  try {
    await nextFrame(); // let the map and panels finish drawing
    await nextFrame();
    const { canvas, subject } = await capture(world);
    const factionId = selectedFactionId(world);
    const final = finish(canvas, captionText(world, factionId));
    download(final, screenshotFileName({ faction: factionName(world, factionId), day: world.meta.currentDay, subject }));
  } finally {
    if (usePlayerView) {
      setPlayerViewOverride(null);
      navigate({});
    }
  }
}

// The picture and the name of what it shows (for the file name).
async function capture(world) {
  if (options.target === 'map') {
    const view = getActiveView();
    if (!view) throw new Error('No map is open.');
    const selected = options.crop === 'selected' && world.placedObjects[view.state.selectedId];
    return { canvas: mapShot(view, { crop: options.crop, hideGrid: options.hideGrid }), subject: selected ? objectName(world, selected) : placeName(world, view.container) };
  }
  const target = TARGETS.find((t) => t.id === options.target);
  const el = document.querySelector(target.selector);
  if (!el) throw new Error(`There is no ${target.label.toLowerCase()} on screen.`);
  return { canvas: await captureElement(el), subject: subjectOf(world, el) };
}

function subjectOf(world, el) {
  if (options.target === 'details') {
    // The record's own Name field ("character_1.name"), not a name inside a list.
    const name = [...el.querySelectorAll('input[data-key$=".name"]')].find((input) => input.dataset.key.split('.').length === 2);
    return name?.value || el.querySelector('h2')?.textContent || 'Details';
  }
  if (options.target === 'taskCard') return el.querySelector('.task-name')?.textContent || 'Task';
  const nav = getNavigation(world);
  const sub = subTab(nav.main, nav.sub);
  return sub?.subsubs.find((x) => x.id === nav.subsub)?.label ? `${sub.label} ${sub.subsubs.find((x) => x.id === nav.subsub).label}` : sub?.label ?? '';
}

function captionText(world, factionId) {
  return [world.meta.name, `Day ${world.meta.currentDay}`, factionId ? factionName(world, factionId) : 'All factions'].join(' · ');
}

const CAPTION_HEIGHT = 18;

// Adds the caption strip, then scales up by whole pixels (no smoothing).
function finish(source, caption) {
  const strip = options.caption ? CAPTION_HEIGHT : 0;
  const base = document.createElement('canvas');
  base.width = source.width;
  base.height = source.height + strip;
  const ctx = base.getContext('2d');
  ctx.drawImage(source, 0, 0);
  if (strip) {
    const css = getComputedStyle(document.documentElement);
    ctx.fillStyle = css.getPropertyValue('--panel').trim() || '#1f1a17';
    ctx.fillRect(0, source.height, base.width, strip);
    ctx.fillStyle = css.getPropertyValue('--text').trim() || '#ece3d6';
    ctx.font = `12px ${css.getPropertyValue('--font').trim() || 'monospace'}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(caption, 6, source.height + strip / 2, base.width - 12);
  }
  const scale = options.scale;
  if (scale === 1) return base;
  const out = document.createElement('canvas');
  out.width = base.width * scale;
  out.height = base.height * scale;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false; // pixel-perfect
  octx.drawImage(base, 0, 0, out.width, out.height);
  return out;
}

function download(canvas, fileName) {
  canvas.toBlob((blob) => {
    if (!blob) return alert('Screenshot failed: the picture is too big. Try a smaller scale or crop.');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
