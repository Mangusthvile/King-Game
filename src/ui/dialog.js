// A small modal dialog on top of everything (a question with a short form).
// It lives on document.body, so screen redraws don't remove it.
//   openDialog({ title, body: [nodes], buttons: [{ label, primary, onClick }] })
// A button's onClick may return false to keep the dialog open.
// Escape or a click outside closes it like the last button.
import { h } from './dom.js';

export function openDialog({ title, body = [], buttons = [] }) {
  const close = () => {
    overlay.remove();
    window.removeEventListener('keydown', onKey, true);
  };
  const press = (button) => {
    if (button?.onClick?.() !== false) close();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') press(buttons.at(-1));
  };
  const dialog = h(
    'div',
    { class: 'dialog frame', role: 'dialog' },
    h('h2', {}, title),
    body,
    h(
      'div',
      { class: 'row dialog-buttons' },
      buttons.map((b) => h('button', { class: b.primary ? 'btn primary' : 'btn', onclick: () => press(b) }, b.label)),
    ),
  );
  const overlay = h('div', { class: 'dialog-overlay', onpointerdown: (e) => e.target === overlay && press(buttons.at(-1)) }, dialog);
  document.body.append(overlay);
  window.addEventListener('keydown', onKey, true);
  dialog.querySelector('input, select, button')?.focus();
  return close;
}
