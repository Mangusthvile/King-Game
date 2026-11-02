// Colors that come from the data (a faction's, a tile type's...). Passed to
// component classes as CSS variables (CLAUDE.md, Interface), never as a
// full inline style.

// Brightness of a "#rrggbb" (or "#rgb") color from 0 (black) to 1 (white),
// weighted the way eyes see it. null if it isn't a hex color.
export function brightness(hex) {
  const m = String(hex ?? '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const full = m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Dark text on light colors, light text on dark ones, so a label stays
// readable whatever color the Arbiter picks.
export function textColorFor(hex) {
  const value = brightness(hex);
  return value !== null && value < 0.55 ? '#f4ece0' : '#120d09';
}

// style="--swatch: ...; --swatch-text: ..." for a chip with a data color.
export function swatchStyle(color) {
  return color ? `--swatch: ${color}; --swatch-text: ${textColorFor(color)}` : null;
}
