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
