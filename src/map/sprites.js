// Optional sprites. Drop a PNG into /src/assets/sprites/ and use its file name
// (without .png) as a spriteKey. The app works with no sprites at all: anything
// whose sprite is missing is drawn as a colored square with a label instead.

// Vite finds every PNG in the folder at build time. An empty folder is fine.
const spriteUrls = import.meta.glob('../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const PREFIX = '../assets/sprites/';
const images = {}; // spriteKey -> HTMLImageElement

// Every sprite key available, for the Sprite picker in the detail panel.
export function spriteKeys() {
  return Object.keys(spriteUrls)
    .map((path) => path.slice(PREFIX.length, -'.png'.length))
    .sort();
}

export function spriteExists(key) {
  return `${PREFIX}${key}.png` in spriteUrls;
}
const loadListeners = new Set();

// Called with no arguments whenever a sprite finishes loading, so the map can redraw.
export function onSpriteLoad(listener) {
  loadListeners.add(listener);
  return () => loadListeners.delete(listener);
}

// Returns a ready-to-draw image, or null if there is no such sprite (yet).
export function getSprite(key) {
  if (!key) return null;
  if (!images[key]) {
    const url = spriteUrls[`${PREFIX}${key}.png`];
    if (!url) return null;
    const img = new Image();
    img.onload = () => loadListeners.forEach((fn) => fn());
    img.src = url;
    images[key] = img;
  }
  const img = images[key];
  return img.complete && img.naturalWidth > 0 ? img : null;
}
