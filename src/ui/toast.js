// A short message in the corner that goes away by itself ("Player View is
// read-only"). It lives on document.body, so screen redraws keep it.
import { h } from './dom.js';

let current = null;

export function showToast(text, ms = 3000) {
  current?.remove();
  const toast = h('div', { class: 'toast frame', role: 'status' }, text);
  document.body.append(toast);
  current = toast;
  setTimeout(() => toast.remove(), ms);
}
