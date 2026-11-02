// The Task Card: one shared window for every task where characters spend
// Stamina (CLAUDE.md, Task Cards). Each task type (Project now; Harvest,
// Training, Crafting later) calls renderTaskCard with its own pieces; the
// card only does the layout. Plain styling until Stage 8.5; the scene banner
// is a colored strip until Stage 9.
//
// renderTaskCard({
//   type:        { label: 'Project', icon: '⚒' }
//   name:        the task name, shown as "[type]: [name]"
//   members:     [{ name, color }] portraits in the header ('' color = default)
//   bannerText:  short text on the scene banner (yield bubbles later)
//   info:        nodes for the Info panel (use infoRow, dangerMeter)
//   memberTiles: nodes (use memberTile)
//   typeInfo:    type-specific nodes (a Project's Workload bar)
//   infoBody:    replaces the whole Info pane content (a setup step's
//                questions); the Info pane is then the wider one
//   log:         { title, text, readOnly, onEdit(text), onReset, onCopyDay,
//                  content (nodes shown instead of the text box), copyText }
//   controls:    Arbiter-only nodes (hidden in Player View)
//   position:    { x, y } of the window inside its tab; onMove(position)
//                after the Arbiter drags it by its header
//   playerView, onTogglePlayerView, onClose
// })
// The card is a small window floating over its tab, dragged by its header.
import { h } from './dom.js';
import { DANGER_LEVELS } from '../data/places.js';

// A square portrait: initials on the character's (faction) color.
export function portrait(name, color = '', size = '') {
  const initials = (name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return h('span', { class: `portrait ${size}`, title: name, style: color ? `--swatch: ${color}` : null }, initials);
}

export function infoRow(icon, label, value) {
  return h('div', { class: 'task-info-row' }, h('span', { class: 'task-icon' }, icon), h('span', {}, label), h('span', { class: 'task-info-value' }, value));
}

// The Environmental Danger meter: 6 segments, Safe to Lethal.
export function dangerMeter(level) {
  const index = DANGER_LEVELS.indexOf(level);
  return h(
    'span',
    { class: 'danger-meter', title: level || 'Danger Level not set' },
    DANGER_LEVELS.map((name, i) => h('span', { class: i <= index ? `danger-seg on seg-${i}` : 'danger-seg', title: name })),
    h('span', { class: 'small' }, level || 'Not set'),
  );
}

// A member tile: portrait, then short lines ("1 Stamina · d6 · Digger T1").
export function memberTile({ name, color, lines = [], warn = false }) {
  return h(
    'div',
    { class: warn ? 'member-tile warn' : 'member-tile' },
    portrait(name, color),
    h('div', { class: 'member-lines' }, h('span', {}, name), lines.map((l) => h('span', { class: 'muted small' }, l))),
  );
}

// A small "i" that shows a help text when hovered (or focused with Tab).
export function infoTip(text) {
  if (!text) return null;
  return h('span', { class: 'info-tip', tabIndex: 0, 'aria-label': text, 'data-tip': text }, 'i');
}

// A current / required bar.
export function progressBar(current, required) {
  const percent = required > 0 ? Math.max(0, Math.min(100, (current / required) * 100)) : 0;
  return h(
    'div',
    { class: 'work-bar', title: `${current} / ${required}` },
    h('div', { class: 'work-bar-fill', style: `--fill: ${percent}%` }),
    h('span', { class: 'work-bar-text' }, `${current} / ${required}`),
  );
}

export async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const old = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => (button.textContent = old), 1200);
    }
  } catch {
    window.prompt('Copy this text:', text);
  }
}

function logPanel(log) {
  const area = log.content ? null : h('textarea', { class: 'task-log-text', value: log.text, readOnly: !!log.readOnly, 'data-key': 'taskcard.log', spellcheck: false });
  area?.addEventListener('change', () => log.onEdit?.(area.value));
  const copy = h('button', { class: 'btn small', onclick: () => copyText(area ? area.value : log.text, copy) }, 'Copy');
  const copyDay = log.onCopyDay ? h('button', { class: 'btn small', onclick: () => log.onCopyDay(copy) }, 'Copy whole day') : null;
  return h(
    'section',
    { class: 'task-pane task-log' },
    h('div', { class: 'task-pane-title' }, log.title ?? 'Log'),
    log.content ?? area,
    h(
      'div',
      { class: 'row' },
      copy,
      copyDay,
      log.onReset ? h('button', { class: 'btn small arbiter-only', title: 'Throw away your edits and rebuild the log from the current values', onclick: log.onReset }, 'Rebuild log') : null,
      log.edited ? h('span', { class: 'muted small arbiter-only' }, 'Edited by hand') : null,
    ),
  );
}

// Drags the window by its header (not by its buttons). It stays inside the
// area it floats over: its right edge can go right up to that area's edge
// (next to the side panel), and its title bar never leaves the bottom.
function makeDraggable(win, handle, onMove) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button, input, select')) return;
    e.preventDefault();
    const startX = e.clientX - win.offsetLeft;
    const startY = e.clientY - win.offsetTop;
    const move = (ev) => {
      const parent = win.offsetParent;
      const maxX = Math.max(0, (parent?.clientWidth ?? 0) - win.offsetWidth);
      const maxY = Math.max(0, (parent?.clientHeight ?? 0) + (parent?.scrollTop ?? 0) - handle.offsetHeight);
      win.style.setProperty('--x', `${Math.min(maxX, Math.max(0, ev.clientX - startX))}px`);
      win.style.setProperty('--y', `${Math.min(maxY, Math.max(0, ev.clientY - startY))}px`);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onMove?.({ x: win.offsetLeft, y: win.offsetTop });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
}

export function renderTaskCard(card) {
  const pos = card.position ?? { x: 16, y: 16 };
  const head = h(
    'header',
    { class: 'task-head', title: 'Drag to move' },
    h('span', { class: 'task-type-icon' }, card.type.icon),
    h('h2', { class: 'task-title' }, `${card.type.label}: `, h('span', { class: 'task-name' }, card.name)),
    h('div', { class: 'task-portraits' }, card.members.map((m) => portrait(m.name, m.color))),
    h('div', { class: 'spacer' }),
    h('button', { class: card.playerView ? 'btn small active' : 'btn small', title: 'Hide Arbiter controls (for screenshots)', onclick: card.onTogglePlayerView }, 'Player View'),
    h('button', { class: 'btn small', title: 'Close (the workday is kept until you Cancel it)', onclick: card.onClose }, 'X'),
  );
  const win = h(
    'div',
    { class: card.playerView ? 'task-card task-window frame player-view' : 'task-card task-window frame', style: `--x: ${pos.x}px; --y: ${pos.y}px` },
    head,
    h('div', { class: 'task-banner' }, h('span', { class: 'small' }, card.bannerText ?? '')),
    h(
      'div',
      { class: card.infoBody ? 'task-body wide-info' : 'task-body' },
      h(
        'section',
        { class: 'task-pane' },
        h('div', { class: 'task-pane-title' }, 'Info'),
        // A setup step (infoBody) shows only its questions, not the info rows.
        card.infoBody ?? [
          card.info,
          card.typeInfo,
          h('div', { class: 'task-pane-sub' }, `Members (${card.memberTiles.length})`),
          h('div', { class: 'member-tiles' }, card.memberTiles.length ? card.memberTiles : h('p', { class: 'muted small' }, 'Nobody yet.')),
        ],
      ),
      logPanel(card.log),
    ),
    card.controls ? h('div', { class: 'task-controls arbiter-only' }, card.controls) : null,
  );
  makeDraggable(win, head, card.onMove);
  return win;
}
