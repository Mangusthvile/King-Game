// Tiny helper for building DOM elements without a framework.
//   h('button', { class: 'btn', onclick: fn }, 'Save')
// Props starting with "on" become event listeners; everything else is set as
// a property (or attribute if no such property exists). Children can be
// strings, nodes, arrays, or null/false (skipped).
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on')) {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'class') {
      el.className = value;
    } else if (key in el) {
      el[key] = value;
    } else {
      el.setAttribute(key, value);
    }
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) appendChildren(el, child);
    else el.append(child instanceof Node ? child : String(child));
  }
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

// Every edit redraws the screen, which replaces all elements. Without this,
// finishing one field by clicking another (Description, then Notes) would
// lose that click. Fields with a data-key get the focus back after a redraw.
let pressedKey = null;
window.addEventListener('pointerdown', (e) => (pressedKey = e.target.closest?.('[data-key]')?.dataset.key ?? null), true);
window.addEventListener('pointerup', () => (pressedKey = null), true);

export function restoreFocus(root) {
  if (!pressedKey) return;
  const active = document.activeElement;
  if (active && active !== document.body && active.isConnected) return;
  root.querySelector(`[data-key="${CSS.escape(pressedKey)}"]`)?.focus();
}
